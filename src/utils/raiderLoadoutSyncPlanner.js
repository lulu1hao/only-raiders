/**
 * raiderLoadoutSyncPlanner.js
 *
 * 奇袭者「战备」实机差量比对、1:1 全屏透视槽位投影计算 & 桌面端仓库辅助自动装配引擎
 */

import loadoutData from '../data/raiderLoadoutData.json'
import weaponsData from '../data/weaponsData.json'
import weaponVisuals from '../data/weaponVisuals.json'
import { getModById, rarityMeta, shortAmpName } from '../composables/useWeaponCalculator'
import { invokeTauri, isTauriRuntime } from '../stores/useOverlayWindowStore'
import { assetUrl } from './assetUrl'
import {
  DEFAULT_RAIDER_SYNC_OPTIONS,
  readLocalProgressionContext,
  resolveEffectiveSyncOptions,
  resolveItemRestockChannels,
} from './raiderAcquisitionCatalog'
import { runAutoRestockSession } from './raiderAutoRestockRunner'
import { abortRaiderAutoSync, captureGameClientImageData } from './raiderAutoSyncPlanner'
import {
  CAPTURE_MAX_WIDTH,
  execSafeClick,
  execSafeCtrlClick,
  execSafeDoubleClick,
  execSafeDrag,
  execSafePark,
  execSafeScroll,
  execSafeShiftClick,
  pointNorm,
  rectCenterNorm,
  waitSafeOrThrow,
} from './raiderInputHelpers'
import {
  MOD_SLOT_NORMALIZATION,
  UMG_RECTS_1080P,
  detectSelectedNonBackpackSlot1080p,
  didStashScrollChange,
  findBatchTargetsInStashGrid,
  findTargetInStashGrid,
  inspectEquippedWeaponSlotDetail,
  inspectStashPageState,
  inspectWeaponCard,
  isRect1080pSelected,
  isStashFilterRailActive,
  recognizeLoadoutFromImageData,
  resolveVisibleModSlotKeys,
  resolveWeaponVisualVariant,
  verifyTargetSlotMatched,
  weaponModRowBoxes,
} from './raiderLoadoutRecognizer'

export { abortRaiderAutoSync, captureGameClientImageData }

/**
 * 仓库检索 / 槽位复核的匹配选项：增强型状态、目标增强项、武器等级门槛及配件槽类型
 */
function itemMatchOpts(item, override = {}) {
  if (item?.kind === 'weapon') {
    return {
      amplified: item.amplified,
      ampIds: item.ampIds || [],
      minTier: item.minTier || 1,
      strictMinTier: item.strictMinTier || 0,
      strictTierMatch: Boolean(item.strictTierMatch),
      ...override,
    }
  }
  if (item?.kind === 'mod') {
    return {
      modSlotKey: item.modSlotKey,
      ...override,
    }
  }
  if (item?.kind === 'quickUse' || item?.kind === 'aux' || item?.kind === 'safePocket') {
    return {
      amplified: item?.amplified,
      minCount: Math.max(1, Number(item?.targetCount) || 1),
      ...override,
    }
  }
  return { amplified: item?.amplified, ...override }
}

function isWeaponEntryAmplified(entry) {
  return Boolean(entry?.amplified || (entry?.ampIds || []).length)
}

const augMap = new Map(loadoutData.augments.map((a) => [a.id, a]))
const shieldMap = new Map(loadoutData.shields.map((s) => [s.id, s]))
const itemMap = new Map(loadoutData.quickUseItems.map((q) => [q.id, q]))
const weaponMap = new Map((weaponsData.weapons || []).map((w) => [w.id, w]))

const ROMAN = ['I', 'II', 'III', 'IV']

/**
 * 将物品分类精准映射到左侧储备箱导航栏按钮 (WBP_InventoryFilterList)
 */
function resolveItemStashFilter(category) {
  switch (category) {
    case 'ammo':
      return 'ammunition'
    case 'medical':
    case 'throwable':
    case 'deployable':
    case 'gadget':
      return 'utilities'
    case 'key':
      return 'keys'
    case 'material':
      return 'materials'
    case 'trinket':
      return 'misc'
    default:
      return 'all'
  }
}

export function describeLoadoutBrief(loadout) {
  if (!loadout) return '空战备'
  const aug = augMap.get(loadout.augmentId) || augMap.get('none')
  const sh = loadout.shieldId ? shieldMap.get(loadout.shieldId) : null
  const wNames = (loadout.weapons || [])
    .map((w) => (w?.weaponId ? weaponMap.get(w.weaponId)?.zhName : null))
    .filter(Boolean)

  const parts = []
  if (aug && aug.id !== 'none') parts.push(aug.zhName)
  if (sh) parts.push(sh.shortName || sh.zhName)
  if (wNames.length) parts.push(wNames.join(' + '))
  return parts.length ? parts.join(' · ') : '裸装配置'
}

function findModIdForSlot(modsObj, slotKey) {
  if (!modsObj || typeof modsObj !== 'object') return null
  if (modsObj[slotKey]) return modsObj[slotKey]
  const aliases = MOD_SLOT_NORMALIZATION[slotKey] || []
  for (const a of aliases) {
    if (modsObj[a]) return modsObj[a]
  }
  return null
}

/**
 * 计算目标战备与游戏内实机战备的逐槽位差量及 1080p UMG 投影框
 */
export function analyzeLoadoutSyncDiff(inGameLoadout, targetLoadout, rawSyncOptions = {}) {
  const syncOptions = resolveEffectiveSyncOptions(rawSyncOptions)
  const progressionCtx =
    syncOptions.autoRestockEnabled && syncOptions.respectLocalProgression
      ? readLocalProgressionContext()
      : null
  const tgt = targetLoadout || {}
  const live = inGameLoadout || null
  const entries = []

  const tgtAug = augMap.get(tgt.augmentId) || augMap.get('none')
  const liveAug = live ? augMap.get(live.augmentId) || augMap.get('none') : null

  if (!syncOptions.quickUseOnly) {
    // 1. 强化槽
    if (tgtAug && tgtAug.id !== 'none') {
      const matched = Boolean(live && live.augmentId === tgtAug.id)
      entries.push({
        key: 'augment',
        kind: 'augment',
        stashFilter: 'augment',
        slotLabel: '强化',
        targetId: tgtAug.id,
        targetName: tgtAug.zhName,
        icon: assetUrl(tgtAug.icon),
        rarity: tgtAug.rarity,
        color: rarityMeta[tgtAug.rarity]?.color || '#5fffff',
        badge: `${tgtAug.maxWeight}kg`,
        subTags: [],
        liveName: liveAug && liveAug.id !== 'none' ? liveAug.zhName : null,
        matched,
        rect1080p: UMG_RECTS_1080P.augment,
      })
    }

    // 2. 护盾槽
    const tgtShield = tgt.shieldId ? shieldMap.get(tgt.shieldId) : null
    const liveShield = live?.shieldId ? shieldMap.get(live.shieldId) : null
    if (tgtShield) {
      const matched = Boolean(live && live.shieldId === tgtShield.id)
      entries.push({
        key: 'shield',
        kind: 'shield',
        stashFilter: 'armor',
        slotLabel: '护盾',
        targetId: tgtShield.id,
        targetName: tgtShield.zhName,
        icon: assetUrl(tgtShield.icon),
        rarity: tgtShield.rarity,
        color: rarityMeta[tgtShield.rarity]?.color || '#00a9f2',
        badge: `充能${tgtShield.charge}`,
        subTags: [`减伤${tgtShield.mitigationPct}%`],
        liveName: liveShield ? liveShield.zhName : null,
        matched,
        rect1080p: UMG_RECTS_1080P.shield,
      })
    }

    // 3. 武器 I & II
    for (let i = 0; i < 2; i++) {
      const wEntry = tgt.weapons?.[i]
      if (!wEntry?.weaponId) continue
      const wMeta = weaponMap.get(wEntry.weaponId)
      if (!wMeta) continue

      const liveW = live?.weapons?.[i]
      const liveWMeta = liveW?.weaponId ? weaponMap.get(liveW.weaponId) : null
      // 增强型武器（游戏内 Ascended 变体）与普通版本为不同物品：须同时比对增强状态
      const tgtAmplified = isWeaponEntryAmplified(wEntry)
      const liveAmplified = isWeaponEntryAmplified(liveW)
      const liveSameWeapon = Boolean(
        liveW && liveW.weaponId === wMeta.id && liveAmplified === tgtAmplified,
      )
      const tgtTier = tgtAmplified ? 1 : Math.max(1, Math.min(4, Number(wEntry.tier) || 1))
      const liveTier = liveSameWeapon ? Math.max(1, Number(liveW.tier) || 1) : 0
      const tierMatched = !syncOptions.syncWeaponTier || tgtAmplified || liveTier >= tgtTier
      const matched = Boolean(liveSameWeapon && tierMatched)
      const needsTierUpgrade = Boolean(
        syncOptions.syncWeaponTier && !tgtAmplified && liveSameWeapon && liveTier < tgtTier,
      )
      // 增强型武器的部分增强项（瞄准镜 / 卡宾枪托 / 弹鼓）会改变实机缩略图，按目标增强组合选取对应外观
      const tgtVisual = resolveWeaponVisualVariant(wMeta.id, tgtAmplified, wEntry.ampIds || [])

      const roman = ROMAN[tgtTier - 1] || 'I'
      const liveRoman = ROMAN[liveTier - 1] || String(liveTier)
      const modBadges = Object.values(wEntry.mods || {})
        .map((mId) => getModById(mId))
        .filter(Boolean)
        .map((m) => ({
          id: m.id,
          name: m.zhName || m.name,
          icon: assetUrl(m.image),
        }))
      const ampBadges = (wMeta.amplifications || [])
        .filter((a) => (wEntry.ampIds || []).includes(a.id))
        .map((a) => shortAmpName(a))

      const wRect = i === 0 ? UMG_RECTS_1080P.weapon1 : UMG_RECTS_1080P.weapon2
      entries.push({
        key: `weapon${i + 1}`,
        kind: 'weapon',
        slotIndex: i,
        stashFilter: 'weapons',
        slotLabel: `武器 ${i === 0 ? 'I' : 'II'}`,
        targetId: wMeta.id,
        targetName: tgtAmplified ? `增强型 ${wMeta.zhName}` : wMeta.zhName,
        amplified: tgtAmplified,
        ampIds: [...(wEntry.ampIds || [])],
        targetTier: tgtTier,
        liveTier,
        needsTierUpgrade,
        minTier: syncOptions.syncWeaponTier && !tgtAmplified ? tgtTier : 1,
        strictTierMatch: Boolean(syncOptions.syncWeaponTier && !tgtAmplified && tgtTier > 1),
        icon: assetUrl(
          (tgtAmplified &&
            (tgtVisual?.image || weaponVisuals.weapons?.[wMeta.id]?.ascended?.image)) ||
            wMeta.image,
        ),
        rarity: tgtAmplified ? 'Legendary' : wMeta.rarity,
        color: rarityMeta[tgtAmplified ? 'Legendary' : wMeta.rarity]?.color || '#fd4b10',
        badge: tgtAmplified
          ? '增强型'
          : needsTierUpgrade
            ? `Lv.${liveRoman}→${roman}`
            : `Lv.${roman}`,
        modBadges,
        subTags: [...ampBadges, ...modBadges.map((m) => m.name)],
        liveName: liveWMeta
          ? liveAmplified
            ? `增强型 ${liveWMeta.zhName}`
            : liveWMeta.zhName
          : null,
        matched,
        rect1080p: wRect,
      })

      // 3b. 武器配件差异条目（默认关闭，仅开启 syncWeaponMods 时参与计算）
      if (syncOptions.syncWeaponMods && wEntry.mods && typeof wEntry.mods === 'object') {
        const slotKeys = resolveVisibleModSlotKeys(wMeta, {
          amplified: tgtAmplified,
          ampIds: wEntry.ampIds || [],
          mods: wEntry.mods,
        })
        const modBoxes = weaponModRowBoxes(wRect, slotKeys.length, tgtAmplified).mods
        for (let sIdx = 0; sIdx < slotKeys.length; sIdx++) {
          const slotKey = slotKeys[sIdx]
          const modId = findModIdForSlot(wEntry.mods, slotKey)
          if (!modId) continue
          const modMeta = getModById(modId)
          if (!modMeta) continue

          const liveModId = liveSameWeapon ? findModIdForSlot(liveW?.mods, slotKey) : null
          const modMatched = Boolean(liveSameWeapon && liveModId === modId)
          entries.push({
            key: `weapon${i}_mod_${slotKey}`,
            kind: 'mod',
            weaponSlotIndex: i,
            parentWeaponId: wMeta.id,
            parentAmplified: tgtAmplified,
            modSlotKey: slotKey,
            slotIndex: sIdx,
            stashFilter: 'modifications',
            slotLabel: `武器${i === 0 ? 'I' : 'II'}配件`,
            targetId: modMeta.id,
            targetName: modMeta.zhName || modMeta.name,
            icon: assetUrl(modMeta.image || modMeta.icon || ''),
            rarity: modMeta.rarity || 'Common',
            color: rarityMeta[modMeta.rarity]?.color || '#37d7ff',
            targetCount: 1,
            badge: '配件',
            subTags: [wMeta.zhName],
            liveName: liveModId ? getModById(liveModId)?.zhName || liveModId : null,
            matched: modMatched,
            rect1080p: modBoxes[sIdx] || wRect,
          })
        }
      }
    }
  }

  const evalPositionalSlot = (liveSlot, targetEntry, meta) => {
    const tgtCount = Math.max(1, Number(targetEntry?.count) || 1)
    const liveCount = liveSlot?.itemId ? Math.max(1, Number(liveSlot.count) || 1) : 0
    const sameItem = Boolean(liveSlot && liveSlot.itemId === meta.id)
    const matched = Boolean(sameItem && liveCount >= tgtCount)
    const deficitCount = matched ? 0 : sameItem ? tgtCount - liveCount : tgtCount
    const liveMeta = liveSlot?.itemId ? itemMap.get(liveSlot.itemId) : null
    return {
      tgtCount,
      liveCount: sameItem ? liveCount : 0,
      deficitCount,
      matched,
      badge: !matched && sameItem ? `${liveCount}/${tgtCount}` : `×${tgtCount}`,
      liveName: liveMeta
        ? liveCount > 1 || sameItem
          ? `${liveMeta.zhName} ×${liveCount}`
          : liveMeta.zhName
        : null,
    }
  }

  // 4. 快速使用栏位
  const tgtQuLimit = tgtAug?.quickUseSlots || 4
  const liveQuCap = live
    ? typeof live.quickUseSlotCap === 'number'
      ? live.quickUseSlotCap
      : liveAug?.quickUseSlots || 4
    : tgtQuLimit
  const quLimit = syncOptions.quickUseOnly && live ? Math.min(tgtQuLimit, liveQuCap) : tgtQuLimit
  for (let i = 0; i < quLimit; i++) {
    const qEntry = tgt.quickUse?.[i]
    if (!qEntry?.itemId) continue
    const qMeta = itemMap.get(qEntry.itemId)
    if (!qMeta) continue

    const pos = evalPositionalSlot(live?.quickUse?.[i], qEntry, qMeta)
    entries.push({
      key: `quickUse${i}`,
      kind: 'quickUse',
      slotIndex: i,
      stashFilter: 'utilities',
      itemCategory: qMeta.category,
      slotLabel: `快捷 ${i + 1}`,
      targetId: qMeta.id,
      targetName: qMeta.zhName,
      icon: assetUrl(qMeta.icon),
      rarity: qMeta.rarity,
      color: rarityMeta[qMeta.rarity]?.color || '#26bf57',
      targetCount: pos.tgtCount,
      liveCount: pos.liveCount,
      deficitCount: pos.deficitCount,
      badge: pos.badge,
      subTags: qMeta.statTags?.slice(0, 1) || [],
      liveName: pos.liveName,
      matched: pos.matched,
      rect1080p: UMG_RECTS_1080P.quickUse[i],
    })
  }

  if (!syncOptions.quickUseOnly) {
    // 5. 强化专属槽位
    const auxSpec = tgtAug?.auxSlots
    const hasAuxRow = Boolean(tgtAug?.integratedItem || auxSpec?.count)
    if (auxSpec?.count) {
      const integratedOffset = tgtAug.integratedItem ? 1 : 0
      for (let i = 0; i < auxSpec.count; i++) {
        const aEntry = tgt.aux?.[i]
        if (!aEntry?.itemId) continue
        const aMeta = itemMap.get(aEntry.itemId)
        if (!aMeta) continue

        const pos = evalPositionalSlot(live?.aux?.[i], aEntry, aMeta)
        const rectIdx = Math.min(2, i + integratedOffset)
        entries.push({
          key: `aux${i}`,
          kind: 'aux',
          slotIndex: i,
          stashFilter: resolveItemStashFilter(aMeta.category),
          itemCategory: aMeta.category,
          slotLabel: `${auxSpec.label} ${i + 1}`,
          targetId: aMeta.id,
          targetName: aMeta.zhName,
          icon: assetUrl(aMeta.icon),
          rarity: aMeta.rarity,
          color: rarityMeta[aMeta.rarity]?.color || '#ffbc13',
          targetCount: pos.tgtCount,
          liveCount: pos.liveCount,
          deficitCount: pos.deficitCount,
          badge: pos.badge,
          subTags: aMeta.statTags?.slice(0, 1) || [],
          liveName: pos.liveName,
          matched: pos.matched,
          rect1080p: UMG_RECTS_1080P.aux[rectIdx],
        })
      }
    }

    // 6. 安全口袋槽位
    const spLimit = tgtAug?.safePocketSlots || 0
    const spRects = hasAuxRow
      ? UMG_RECTS_1080P.safePocketWithAux
      : UMG_RECTS_1080P.safePocketNoAux
    for (let i = 0; i < spLimit; i++) {
      const spEntry = tgt.safePocket?.[i]
      if (!spEntry?.itemId) continue
      const spMeta = itemMap.get(spEntry.itemId)
      if (!spMeta) continue

      const pos = evalPositionalSlot(live?.safePocket?.[i], spEntry, spMeta)
      entries.push({
        key: `safePocket${i}`,
        kind: 'safePocket',
        slotIndex: i,
        stashFilter: resolveItemStashFilter(spMeta.category),
        itemCategory: spMeta.category,
        slotLabel: `安全袋 ${i + 1}`,
        targetId: spMeta.id,
        targetName: spMeta.zhName,
        icon: assetUrl(spMeta.icon),
        rarity: spMeta.rarity,
        color: rarityMeta[spMeta.rarity]?.color || '#00a9f2',
        targetCount: pos.tgtCount,
        liveCount: pos.liveCount,
        deficitCount: pos.deficitCount,
        badge: pos.badge,
        subTags: spMeta.statTags?.slice(0, 1) || [],
        liveName: pos.liveName,
        matched: pos.matched,
        rect1080p: spRects?.[i] || UMG_RECTS_1080P.safePocketWithAux[i],
      })
    }

    // 7. 背包槽位（仅比较物品种类与总数量，不要求格位顺序一致）
    const bpLimit = tgtAug?.backpackSlots || 10
    const liveBpRemain = new Map()
    if (Array.isArray(live?.backpack)) {
      for (const lb of live.backpack) {
        if (!lb?.itemId) continue
        const qty = Math.max(1, Number(lb.count) || 1)
        liveBpRemain.set(lb.itemId, (liveBpRemain.get(lb.itemId) || 0) + qty)
      }
    }
    for (let i = 0; i < bpLimit; i++) {
      const bEntry = tgt.backpack?.[i]
      if (!bEntry?.itemId) continue
      const bMeta = itemMap.get(bEntry.itemId)
      if (!bMeta) continue

      const tgtCount = Math.max(1, Number(bEntry.count) || 1)
      const avail = liveBpRemain.get(bMeta.id) || 0
      const take = Math.min(avail, tgtCount)
      if (take > 0) {
        liveBpRemain.set(bMeta.id, avail - take)
      }
      const matched = avail >= tgtCount
      const deficitCount = matched ? 0 : tgtCount - avail

      entries.push({
        key: `backpack${i}`,
        kind: 'backpack',
        slotIndex: i,
        stashFilter: resolveItemStashFilter(bMeta.category),
        itemCategory: bMeta.category,
        slotLabel: `背包 ${i + 1}`,
        targetId: bMeta.id,
        targetName: bMeta.zhName,
        icon: assetUrl(bMeta.icon),
        rarity: bMeta.rarity,
        color: rarityMeta[bMeta.rarity]?.color || '#a4a5aa',
        targetCount: tgtCount,
        deficitCount,
        badge: !matched && avail > 0 ? `${avail}/${tgtCount}` : `×${tgtCount}`,
        subTags: bMeta.statTags?.slice(0, 1) || [],
        liveName: avail > 0 ? `${bMeta.zhName} ×${take}` : null,
        matched,
        rect1080p: UMG_RECTS_1080P.backpack[i],
      })
    }
  }

  if (syncOptions.autoRestockEnabled) {
    for (const entry of entries) {
      if (entry.matched) continue
      if (entry.needsTierUpgrade) {
        entry.canRestock = false
        entry.restockBadge = syncOptions.allowWorkshopUpgrade ? '工坊·升级' : '仅商人·不升阶'
        continue
      }
      const ch = resolveItemRestockChannels(
        entry.kind,
        entry.targetId,
        syncOptions,
        progressionCtx,
        { amplified: Boolean(entry.amplified) },
      )
      entry.canRestock = ch.canRestock
      entry.restockBadge = ch.badgeLabel
    }
  }

  const matchedCount = entries.filter((e) => e.matched).length
  const pendingCount = entries.length - matchedCount

  return {
    entries,
    matchedCount,
    pendingCount,
    totalTargetSlots: entries.length,
    hasLiveSnapshot: Boolean(live),
    alreadySynced: Boolean(live) && entries.length > 0 && pendingCount === 0,
  }
}

const MAX_SCROLL_PAGES_DOWN = 20
const MAX_SCROLL_PAGES_UP = 22
const SCROLL_STEP_DOWN = -2040 // 向下 17 格滚轮（UE5 约跨越 5.2 行 / ~21 格，大幅提升滑动幅度并保留 ~1.25 行重叠防漏格）
const SCROLL_STEP_UP = 2160 // 向上 18 格滚轮大幅回溯

/**
 * 确保最左侧仓库分类导航栏 (WBP_InventoryFilterList) 处于聚焦可点击态。
 * 当此前点击过任意非背包栏位导致左侧导航栏压暗失焦时：
 * 1) 优先点击背包格切换焦点（退出非背包单槽锁定态，恢复左侧导航栏焦点）；
 * 2) 若仍处于压暗态，自动识别右侧白框选中的非背包槽位并再次点击以解除锁定。
 */
async function ensureStashFilterRailFocused({
  hwnd,
  vp,
  W,
  H,
  preferredBackpackRect1080p,
  lastNonBackpackRect1080p,
}) {
  let cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
  if (isStashFilterRailActive(cap.imageData, vp)) {
    return { focused: true, recovered: false, imageData: cap.imageData }
  }

  // 步骤 1：点击背包槽位解除非背包栏位的单槽过滤锁定
  const bpRect = preferredBackpackRect1080p || UMG_RECTS_1080P.backpack[0]
  const bpPt = rectCenterNorm(bpRect, vp, W, H)
  if (bpPt.x > 0.25 && bpPt.x < 0.96 && bpPt.y > 0.1 && bpPt.y < 0.92) {
    await execSafeClick(hwnd, bpPt.x, bpPt.y)
    await waitSafeOrThrow(hwnd, 155)
    await execSafePark(hwnd)
    await waitSafeOrThrow(hwnd, 75)
    cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
    if (isStashFilterRailActive(cap.imageData, vp)) {
      return { focused: true, recovered: true, imageData: cap.imageData }
    }
  }

  // 步骤 2：检测并再次点击当前带白框的选中非背包槽位，彻底退出单槽选择态
  const lockedRect =
    detectSelectedNonBackpackSlot1080p(cap.imageData, vp) || lastNonBackpackRect1080p
  if (lockedRect) {
    const lkPt = rectCenterNorm(lockedRect, vp, W, H)
    if (lkPt.x > 0.25 && lkPt.x < 0.98 && lkPt.y > 0.1 && lkPt.y < 0.92) {
      await execSafeClick(hwnd, lkPt.x, lkPt.y)
      await waitSafeOrThrow(hwnd, 155)
      await execSafePark(hwnd)
      await waitSafeOrThrow(hwnd, 75)
      cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
      if (isStashFilterRailActive(cap.imageData, vp)) {
        return { focused: true, recovered: true, imageData: cap.imageData }
      }
    }
  }

  return {
    focused: isStashFilterRailActive(cap.imageData, vp),
    recovered: true,
    imageData: cap.imageData,
  }
}

/**
 * 在当前储备箱视图中检索目标物品，若首屏未命中则自动驱动鼠标滚轮双向分页扫描（含触底/触顶视觉判定）。
 */
async function searchItemInStashWithScroll({
  hwnd,
  vp,
  W,
  H,
  item,
  scrollState,
  initialImageData = null,
  basePct = 50,
  stepLabel = '',
  onProgress,
  settleMs = null,
  matchOptsOverride = null,
  preferredCount = null,
}) {
  const hoverPt = pointNorm(UMG_RECTS_1080P.stashScrollHover, vp, W, H)
  const searchOpts = itemMatchOpts(item, matchOptsOverride || {})
  const prefCount = preferredCount ?? (item.deficitCount || item.targetCount || null)
  let curImg =
    initialImageData ||
    (await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)).imageData

  // 1. 先检索当前可见页（命中则零滚动直出）
  let hit = await findTargetInStashGrid(
    curImg,
    vp,
    item.kind,
    item.targetId,
    prefCount,
    searchOpts,
  )
  if (hit) {
    return { hit, imageData: curImg }
  }

  const firstPage = inspectStashPageState(curImg, vp)
  const startedConfirmedAtTop =
    Boolean(scrollState.atTop) && !firstPage.scrolledFromTop

  // 若确认在列表最顶部且当前页不足 20 格、末行无物品且无滚动条，说明已完整显示全部物品，无需无效滚轮操作
  if (
    startedConfirmedAtTop &&
    firstPage.occupiedCount < 20 &&
    firstPage.bottomRowsOccupied === 0 &&
    !firstPage.hasScrollbar
  ) {
    return null
  }

  let prevSig = firstPage.signature

  // 2. 向下大幅翻页检索，直至命中、触底或画面签名不再变化
  const canScrollDown =
    !firstPage.atBottom &&
    (firstPage.occupiedCount >= 20 ||
      firstPage.bottomRowsOccupied > 0 ||
      firstPage.hasScrollbar)

  if (canScrollDown) {
    for (let page = 1; page <= MAX_SCROLL_PAGES_DOWN; page++) {
      onProgress?.({
        progressPct: basePct,
        message: `滚动查找仓库：${item.targetName} · 下翻第 ${page} 页 ${stepLabel}`,
      })
      await execSafeScroll(hwnd, hoverPt.x, hoverPt.y, SCROLL_STEP_DOWN)
      // 武器格为实时 3D 渲染缩略图，翻页后需等待其加载完成（可配置）
      await waitSafeOrThrow(hwnd, settleMs ?? 210)

      const nextCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
      curImg = nextCap.imageData
      const pageState = inspectStashPageState(curImg, vp)

      if (!didStashScrollChange(prevSig, pageState.signature)) {
        // 滚动条已到底部尽头
        break
      }
      scrollState.atTop = false
      prevSig = pageState.signature

      hit = await findTargetInStashGrid(
        curImg,
        vp,
        item.kind,
        item.targetId,
        prefCount,
        searchOpts,
      )
      if (hit) {
        return { hit, imageData: curImg }
      }

      if (
        pageState.atBottom ||
        (pageState.occupiedCount < 20 &&
          pageState.bottomRowsOccupied === 0 &&
          !pageState.hasScrollbar)
      ) {
        break
      }
    }
  }

  // 3. 若起始时列表处于中途/底部滚动位置（如手动翻过仓库或上一件物品下翻过），向上大幅回溯至顶部补齐上半区
  if (!startedConfirmedAtTop || firstPage.scrolledFromTop) {
    for (let page = 1; page <= MAX_SCROLL_PAGES_UP; page++) {
      onProgress?.({
        progressPct: basePct,
        message: `滚动查找仓库：${item.targetName} · 上翻回溯 ${stepLabel}`,
      })
      await execSafeScroll(hwnd, hoverPt.x, hoverPt.y, SCROLL_STEP_UP)
      await waitSafeOrThrow(hwnd, settleMs ?? 205)

      const upCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
      curImg = upCap.imageData
      const upState = inspectStashPageState(curImg, vp)

      if (!didStashScrollChange(prevSig, upState.signature)) {
        scrollState.atTop = true
        break
      }
      prevSig = upState.signature

      hit = await findTargetInStashGrid(
        curImg,
        vp,
        item.kind,
        item.targetId,
        prefCount,
        searchOpts,
      )
      if (hit) {
        scrollState.atTop = !upState.scrolledFromTop
        return { hit, imageData: curImg }
      }

      if (upState.hasScrollbar && !upState.scrolledFromTop) {
        scrollState.atTop = true
        break
      }
    }
  }

  return null
}

/**
 * 双武器栏：若目标武器当前已装备在另一武器栏（且该栏的目标并非同款同版本武器），
 * 直接从另一武器栏拖拽到目标栏（游戏原生互换），避免仓库内找不到已装备武器而漏装/误替换。
 */
async function trySwapFromOtherWeaponSlot({
  hwnd,
  vp,
  W,
  H,
  item,
  slotRect1080p,
  dstPt,
  imageData,
  targetLoadout,
  settleMs,
  weaponWait,
  onLoadingWait,
}) {
  if (item?.kind !== 'weapon') return null
  const otherIdx = item.slotIndex === 0 ? 1 : 0
  const otherRect = otherIdx === 0 ? UMG_RECTS_1080P.weapon1 : UMG_RECTS_1080P.weapon2
  const otherTarget = targetLoadout?.weapons?.[otherIdx]
  if (
    otherTarget?.weaponId === item.targetId &&
    isWeaponEntryAmplified(otherTarget) === Boolean(item.amplified)
  ) {
    return null
  }
  const img = imageData || (await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)).imageData
  const otherDetail = await inspectEquippedWeaponSlotDetail(img, vp, otherIdx)
  const otherVariantOk =
    otherDetail?.identified &&
    otherDetail.weaponId === item.targetId &&
    Boolean(otherDetail.amplified) === Boolean(item.amplified)
  if (!otherVariantOk) return null

  const curDetail = await inspectEquippedWeaponSlotDetail(img, vp, item.slotIndex)
  if (
    curDetail?.identified &&
    curDetail.weaponId === item.targetId &&
    Boolean(curDetail.amplified) === Boolean(item.amplified) &&
    (curDetail.tier || 1) >= (otherDetail.tier || 1)
  ) {
    return null
  }
  if (item.minTier > 1 && !item.amplified && (otherDetail.tier || 1) < item.minTier) {
    // 若开启匹配等级，另一栏的同款低于目标等级且当前无须低阶兜底，先按需保留/互换逻辑决定
    if (curDetail?.identified && curDetail.weaponId === item.targetId) {
      return null
    }
  }

  // 抓取另一武器卡片的缩略图区域（避开中部配件格，防止误拖配件）
  const grabPt = {
    x: (vp.ox + (otherRect.x + otherRect.w * 0.5) * vp.scale) / W,
    y: (vp.oy + (otherRect.y + 54) * vp.scale) / H,
  }
  await execSafeDrag(hwnd, grabPt.x, grabPt.y, dstPt.x, dstPt.y, true, 64)
  await waitSafeOrThrow(hwnd, settleMs)
  let cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
  let res = await verifyTargetSlotMatched(
    cap.imageData,
    vp,
    'weapon',
    slotRect1080p,
    item.targetId,
    itemMatchOpts(item, { strictTierMatch: false }),
  )
  if (!res.matched && res.loading && weaponWait > 0) {
    onLoadingWait?.()
    await waitSafeOrThrow(hwnd, weaponWait)
    cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
    res = await verifyTargetSlotMatched(
      cap.imageData,
      vp,
      'weapon',
      slotRect1080p,
      item.targetId,
      itemMatchOpts(item, { strictTierMatch: false }),
    )
  }
  return {
    attempted: true,
    matched: Boolean(res.matched),
    tierMatched: Boolean(res.tierMatched),
    imageData: cap.imageData,
  }
}

/**
 * 桌面端：抓取游戏战备界面比对差量，自动执行：
 * 1) 非背包槽位：优先点击右侧目标战备栏位触发游戏原生单槽过滤（完全绕开左侧导航栏失焦限制）+ 仓库自动滚轮检索装配；
 * 2) 背包槽位：自动检测并点击背包槽/解除非背包白框锁定以恢复最左侧分类导航栏焦点，按精确分类筛选 + 滚轮翻页拖拽装配。
 */
export const DEFAULT_WEAPON_LOAD_WAIT_MS = 3000

export function buildRestockBillAndUpgrades(diff, rawSyncOptions) {
  const syncOptions = resolveEffectiveSyncOptions(rawSyncOptions)
  const billMap = new Map()
  const upgradeTasks = []

  for (const e of diff?.entries || []) {
    if (e.matched) continue
    if (e.kind === 'weapon' && e.needsTierUpgrade) {
      if (syncOptions.allowWorkshopUpgrade && !e.amplified && e.targetTier > 1) {
        upgradeTasks.push({
          weaponId: e.targetId,
          weaponName: e.targetName,
          fromTier: Math.max(1, e.liveTier || 1),
          targetTier: e.targetTier,
          requiresAcquiredKey: null,
        })
      }
      continue
    }

    const acqKind = ['augment', 'shield', 'weapon', 'mod'].includes(e.kind) ? e.kind : 'item'
    const key = `${acqKind}|${e.targetId}|${e.amplified ? 1 : 0}`
    const existing = billMap.get(key)
    const addCount = Math.max(1, Number(e.deficitCount ?? e.targetCount) || 1)
    if (existing) {
      existing.neededCount += addCount
    } else {
      billMap.set(key, {
        key,
        kind: acqKind,
        targetId: e.targetId,
        targetName: e.targetName,
        amplified: Boolean(e.amplified),
        neededCount: addCount,
      })
    }

    if (syncOptions.allowWorkshopUpgrade && e.kind === 'weapon' && !e.amplified && e.targetTier > 1) {
      upgradeTasks.push({
        weaponId: e.targetId,
        weaponName: e.targetName,
        fromTier: 1,
        targetTier: e.targetTier,
        requiresAcquiredKey: key,
      })
    }
  }

  return {
    restockBill: Array.from(billMap.values()),
    upgradeTasks,
  }
}

/**
 * 计算两帧储备箱网格视觉签名之间的平均绝对差异
 */
function stashSignatureMeanDiff(sigA, sigB) {
  if (!sigA || !sigB || sigA.length !== sigB.length || !sigA.length) return 0
  let sum = 0
  for (let i = 0; i < sigA.length; i++) {
    sum += Math.abs(sigA[i] - sigB[i])
  }
  return sum / sigA.length
}

/**
 * 按当前实机实际穿戴的强化动态校验槽位上限与安全口袋行坐标
 */
function resolveDynamicSlotRect(item, activeAugmentInGame, tgtAug, inGameQuickUseCap = null) {
  let slotRect1080p = item.rect1080p
  if (item.kind === 'quickUse') {
    const quCap =
      typeof inGameQuickUseCap === 'number'
        ? inGameQuickUseCap
        : activeAugmentInGame?.quickUseSlots || 4
    if (item.slotIndex >= quCap) {
      return { skip: true, rect1080p: null }
    }
  }
  if (activeAugmentInGame && activeAugmentInGame.id !== tgtAug.id) {
    if (
      item.kind === 'backpack' &&
      item.slotIndex >= (activeAugmentInGame.backpackSlots || 10)
    ) {
      return { skip: true, rect1080p: null }
    }
    if (item.kind === 'aux' && !activeAugmentInGame.auxSlots?.count) {
      return { skip: true, rect1080p: null }
    }
    if (item.kind === 'safePocket') {
      if (item.slotIndex >= (activeAugmentInGame.safePocketSlots || 0)) {
        return { skip: true, rect1080p: null }
      }
      const liveHasAux = Boolean(
        activeAugmentInGame.integratedItem || activeAugmentInGame.auxSlots?.count,
      )
      const liveSpRects = liveHasAux
        ? UMG_RECTS_1080P.safePocketWithAux
        : UMG_RECTS_1080P.safePocketNoAux
      slotRect1080p = liveSpRects[item.slotIndex] || slotRect1080p
    }
  }
  return { skip: false, rect1080p: slotRect1080p }
}

/**
 * 为指定筛选类目组装主筛选页与兜底跨类筛选页顺序
 */
function buildCandidateFiltersForGroup(primaryFilterKey, entries) {
  if (entries.some((e) => e.kind === 'mod')) {
    return ['modifications']
  }
  const primary = primaryFilterKey || 'all'
  const filters = [primary]
  if (entries.some((e) => e.itemCategory === 'material') && !filters.includes('misc')) {
    filters.push('misc')
  }
  if (
    primary !== 'all' &&
    entries.some((e) => ['key', 'material', 'trinket', 'gadget'].includes(e.itemCategory))
  ) {
    filters.push('all')
  }
  return filters
}

/**
 * 识别存在「同物品拆分为多份非满堆叠占用 ≥2 个精确栏位」的 itemId：
 * 例如安全袋放 ×1、快捷栏放 ×1 而单格上限为 5，此类物品必须走单槽精准拖拽，避免 Shift 自动堆叠合并。
 */
function detectSplitStackPositionalIds(targetLoadout, activeAug) {
  const stats = new Map()
  const recordSlot = (entry) => {
    if (!entry?.itemId) return
    const meta = itemMap.get(entry.itemId)
    const maxStack = Math.max(1, Number(meta?.maxStack) || 1)
    const cnt = Math.max(1, Number(entry.count) || 1)
    let st = stats.get(entry.itemId)
    if (!st) {
      st = { slots: 0, hasPartial: false }
      stats.set(entry.itemId, st)
    }
    st.slots++
    if (cnt < maxStack) st.hasPartial = true
  }

  const quLim = activeAug?.quickUseSlots || 4
  for (let i = 0; i < quLim; i++) recordSlot(targetLoadout?.quickUse?.[i])

  const auxLim = activeAug?.auxSlots?.count || 0
  for (let i = 0; i < auxLim; i++) recordSlot(targetLoadout?.aux?.[i])

  const spLim = activeAug?.safePocketSlots || 0
  for (let i = 0; i < spLim; i++) recordSlot(targetLoadout?.safePocket?.[i])

  const splitIds = new Set()
  for (const [itemId, st] of stats.entries()) {
    if (st.slots >= 2 && st.hasPartial) {
      splitIds.add(itemId)
    }
  }
  return splitIds
}

/**
 * 枚举当前强化下所有有效的右侧精确位置栏位（快捷栏 / 专属栏 / 安全口袋）及其 1080p 矩形
 */
function collectPositionalSlotSpecs(targetLoadout, activeAug) {
  const specs = []
  const quLim = activeAug?.quickUseSlots || 4
  for (let i = 0; i < quLim; i++) {
    specs.push({
      kind: 'quickUse',
      slotIndex: i,
      rect1080p: UMG_RECTS_1080P.quickUse[i],
      targetEntry: targetLoadout?.quickUse?.[i] || null,
    })
  }

  const auxLim = activeAug?.auxSlots?.count || 0
  const integratedOffset = activeAug?.integratedItem ? 1 : 0
  for (let i = 0; i < auxLim; i++) {
    const rectIdx = Math.min(2, i + integratedOffset)
    specs.push({
      kind: 'aux',
      slotIndex: i,
      rect1080p: UMG_RECTS_1080P.aux[rectIdx],
      targetEntry: targetLoadout?.aux?.[i] || null,
    })
  }

  const hasAuxRow = Boolean(activeAug?.integratedItem || auxLim > 0)
  const spRects = hasAuxRow ? UMG_RECTS_1080P.safePocketWithAux : UMG_RECTS_1080P.safePocketNoAux
  const spLim = activeAug?.safePocketSlots || 0
  for (let i = 0; i < spLim; i++) {
    if (!spRects?.[i]) continue
    specs.push({
      kind: 'safePocket',
      slotIndex: i,
      rect1080p: spRects[i],
      targetEntry: targetLoadout?.safePocket?.[i] || null,
    })
  }
  return specs
}

/**
 * 单槽位检索并直接拖拽装配（供核心装备、武器配件及单/拆分堆叠容器项复用）
 */
async function equipSingleEntryDirect(ctx, item, { pct, stepLabel }) {
  const {
    hwnd,
    vp,
    W,
    H,
    targetLoadout,
    tgtAug,
    syncOptions,
    weaponWait,
    onProgress,
  } = ctx
  const stepWait = (normalMs) =>
    item?.kind === 'weapon' ? Math.max(normalMs, weaponWait) : normalMs

  const { skip, rect1080p } = resolveDynamicSlotRect(
    item,
    ctx.activeAugmentInGame,
    tgtAug,
    ctx.inGameQuickUseCap,
  )
  if (skip || !rect1080p) return

  let slotRect1080p = rect1080p
  let dstPt = rectCenterNorm(slotRect1080p, vp, W, H)
  onProgress?.({
    progressPct: pct,
    message: `装配 ${item.slotLabel}：${item.targetName} ${stepLabel}`,
  })

  if (item.kind !== 'backpack' && item.kind !== 'mod') {
    // ==================== 分支 A：非背包/非配件栏位（原生目标槽过滤模式） ====================
    const alreadySelected = ctx.latestFrameImg
      ? isRect1080pSelected(ctx.latestFrameImg, vp, slotRect1080p)
      : false

    let postSlotImg = ctx.latestFrameImg
    if (!alreadySelected) {
      await execSafeClick(hwnd, dstPt.x, dstPt.y)
      ctx.lastNonBackpackRect = slotRect1080p
      ctx.activeFilter = null
      ctx.scrollState.atTop = false
      if (item.kind === 'weapon' && weaponWait > 0) {
        onProgress?.({
          progressPct: pct,
          message: `等待武器列表加载 ${(weaponWait / 1000).toFixed(1)} 秒：${item.targetName} ${stepLabel}`,
        })
      }
      await waitSafeOrThrow(hwnd, stepWait(165))
      await execSafePark(hwnd)
      await waitSafeOrThrow(hwnd, 75)
      postSlotImg = (await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)).imageData
      ctx.latestFrameImg = postSlotImg
    } else {
      ctx.lastNonBackpackRect = slotRect1080p
    }

    const preCheck = await verifyTargetSlotMatched(
      postSlotImg,
      vp,
      item.kind,
      slotRect1080p,
      item.targetId,
      itemMatchOpts(item),
    )
    if (preCheck.matched) {
      if (item.kind === 'augment') {
        ctx.activeAugmentInGame = tgtAug
        ctx.inGameQuickUseCap = tgtAug?.quickUseSlots || 4
      }
      return
    }

    const isPositionalStack =
      item.kind === 'quickUse' || item.kind === 'aux' || item.kind === 'safePocket'
    let curHaveCount =
      isPositionalStack && preCheck.itemMatched ? Math.max(1, Number(preCheck.count) || 1) : 0

    // 武器等阶控制：若本槽已装备目标同款武器（如 Lv.II），仅当仓库存在更高等级 (> curTier) 时替换，防止低阶覆盖高阶
    const alreadySameWeaponLowerTier = Boolean(
      item.kind === 'weapon' &&
        syncOptions.syncWeaponTier &&
        !item.amplified &&
        preCheck.weaponMatched &&
        !preCheck.tierMatched,
    )
    const currentWeaponTier = alreadySameWeaponLowerTier ? Math.max(1, preCheck.tier || 1) : 0

    // 双武器栏：仅当未持有同款武器或目标需要换位时尝试另一武器栏互换
    if (item.kind === 'weapon' && !alreadySameWeaponLowerTier) {
      const swapRes = await trySwapFromOtherWeaponSlot({
        hwnd,
        vp,
        W,
        H,
        item,
        slotRect1080p,
        dstPt,
        imageData: postSlotImg,
        targetLoadout,
        settleMs: stepWait(175),
        weaponWait,
        onLoadingWait: () =>
          onProgress?.({
            progressPct: pct,
            message: `武器栏加载中，继续等待 ${(weaponWait / 1000).toFixed(1)} 秒：${item.targetName} ${stepLabel}`,
          }),
      })
      if (swapRes?.attempted) {
        ctx.latestFrameImg = swapRes.imageData
        postSlotImg = swapRes.imageData
        if (swapRes.matched) {
          ctx.anyChanged = true
          if (swapRes.tierMatched || !syncOptions.syncWeaponTier || item.amplified) {
            ctx.equippedCount++
          } else {
            ctx.equippedBaseWeapon = true
          }
          return
        }
      }
    }

    if (isStashFilterRailActive(postSlotImg, vp)) {
      const filterPt = UMG_RECTS_1080P.stashFilters[item.stashFilter]
      if (filterPt) {
        const fp = pointNorm(filterPt, vp, W, H)
        if (fp.x > 0.01 && fp.x < 0.35 && fp.y > 0.1 && fp.y < 0.9) {
          await execSafeClick(hwnd, fp.x, fp.y)
          ctx.activeFilter = item.stashFilter
          ctx.scrollState.atTop = true
          await waitSafeOrThrow(hwnd, stepWait(160))
          await execSafePark(hwnd)
          await waitSafeOrThrow(hwnd, 75)
          postSlotImg = null
          ctx.latestFrameImg = null
        }
      }
    }

    const isTieredWeapon =
      item.kind === 'weapon' && syncOptions.syncWeaponTier && !item.amplified
    const maxRounds = isPositionalStack ? 4 : 1

    for (let round = 0; round < maxRounds; round++) {
      let found = null
      let activeSearchOpts = null
      const neededRemain = isPositionalStack
        ? Math.max(1, (Number(item.targetCount) || 1) - curHaveCount)
        : item.targetCount || null
      const searchImg = round === 0 ? postSlotImg : ctx.latestFrameImg

      if (isTieredWeapon) {
        const minWanted = alreadySameWeaponLowerTier ? currentWeaponTier + 1 : item.targetTier
        activeSearchOpts = { minTier: item.targetTier, strictMinTier: minWanted }
        found = await searchItemInStashWithScroll({
          hwnd,
          vp,
          W,
          H,
          item,
          scrollState: ctx.scrollState,
          initialImageData: searchImg,
          basePct: pct,
          stepLabel,
          onProgress,
          settleMs: stepWait(210),
          matchOptsOverride: activeSearchOpts,
        })
        // 若目标武器尚未装备、且仓库内无达标高阶拷贝，允许先取低阶本体以便阶段 2 在武器台升阶
        if (!found?.hit && !alreadySameWeaponLowerTier && minWanted > 1) {
          ctx.scrollState.atTop = false
          activeSearchOpts = { minTier: item.targetTier, strictMinTier: 0 }
          found = await searchItemInStashWithScroll({
            hwnd,
            vp,
            W,
            H,
            item,
            scrollState: ctx.scrollState,
            initialImageData: null,
            basePct: pct,
            stepLabel,
            onProgress,
            settleMs: stepWait(210),
            matchOptsOverride: activeSearchOpts,
          })
        }
      } else {
        found = await searchItemInStashWithScroll({
          hwnd,
          vp,
          W,
          H,
          item,
          scrollState: ctx.scrollState,
          initialImageData: searchImg,
          basePct: pct,
          stepLabel,
          onProgress,
          settleMs: item.kind === 'weapon' ? stepWait(210) : null,
          preferredCount: neededRemain,
        })
      }

      if (found?.imageData) ctx.latestFrameImg = found.imageData
      if (!found?.hit) {
        if (isPositionalStack) ctx.exhaustedTargetIds.add(item.targetId)
        break
      }

      const dragMatchOpts = itemMatchOpts(item, {
        ...(activeSearchOpts || {}),
        strictTierMatch: false,
      })

      const captureAndVerify = async () => {
        let cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        let res = await verifyTargetSlotMatched(
          cap.imageData,
          vp,
          item.kind,
          slotRect1080p,
          item.targetId,
          dragMatchOpts,
        )
        if (!res.matched && res.loading && item.kind === 'weapon' && weaponWait > 0) {
          onProgress?.({
            progressPct: pct,
            message: `武器栏加载中，继续等待 ${(weaponWait / 1000).toFixed(1)} 秒：${item.targetName} ${stepLabel}`,
          })
          await waitSafeOrThrow(hwnd, weaponWait)
          cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
          res = await verifyTargetSlotMatched(
            cap.imageData,
            vp,
            item.kind,
            slotRect1080p,
            item.targetId,
            dragMatchOpts,
          )
        }
        ctx.latestFrameImg = cap.imageData
        return { cap, res }
      }

      const hasMadeProgress = (res) =>
        Boolean(
          res.matched ||
            (isPositionalStack && res.itemMatched && (res.count || 1) > curHaveCount),
        )

      // 策略 1（首选）：真实平滑拖拽
      await execSafeDrag(hwnd, found.hit.normX, found.hit.normY, dstPt.x, dstPt.y, true, 52)
      await waitSafeOrThrow(hwnd, stepWait(165))
      let { cap: verifyCap, res: verifyRes } = await captureAndVerify()

      // 策略 2（重压慢拖兜底）
      if (!hasMadeProgress(verifyRes)) {
        const reHit = await findTargetInStashGrid(
          verifyCap.imageData,
          vp,
          item.kind,
          item.targetId,
          neededRemain,
          dragMatchOpts,
        )
        if (reHit) {
          await execSafeDrag(hwnd, reHit.normX, reHit.normY, dstPt.x, dstPt.y, true, 96)
          await waitSafeOrThrow(hwnd, stepWait(175))
          ;({ cap: verifyCap, res: verifyRes } = await captureAndVerify())
        }
      }

      // 策略 3（原生 SHIFT 快速移动 / 双击兜底）
      let quickMoveSafe =
        !hasMadeProgress(verifyRes) &&
        (!verifyRes.occupied || item.kind === 'augment' || item.kind === 'shield')
      if (quickMoveSafe && item.kind === 'weapon' && item.slotIndex === 1) {
        const w1 = await inspectWeaponCard(verifyCap.imageData, vp, UMG_RECTS_1080P.weapon1)
        quickMoveSafe = Boolean(w1?.occupied)
      }
      if (quickMoveSafe) {
        const reHit2 = await findTargetInStashGrid(
          verifyCap.imageData,
          vp,
          item.kind,
          item.targetId,
          neededRemain,
          dragMatchOpts,
        )
        if (reHit2) {
          await execSafeShiftClick(hwnd, reHit2.normX, reHit2.normY)
          await waitSafeOrThrow(hwnd, stepWait(165))
          ;({ cap: verifyCap, res: verifyRes } = await captureAndVerify())
        }
        if (!hasMadeProgress(verifyRes)) {
          const reHit3 = await findTargetInStashGrid(
            verifyCap.imageData,
            vp,
            item.kind,
            item.targetId,
            neededRemain,
            dragMatchOpts,
          )
          if (reHit3) {
            await execSafeDoubleClick(hwnd, reHit3.normX, reHit3.normY)
            await waitSafeOrThrow(hwnd, stepWait(165))
            ;({ cap: verifyCap, res: verifyRes } = await captureAndVerify())
          }
        }
      }

      if (verifyRes.matched) {
        ctx.anyChanged = true
        if (item.kind === 'weapon' && syncOptions.syncWeaponTier && !item.amplified) {
          if (verifyRes.tierMatched) ctx.equippedCount++
          else ctx.equippedBaseWeapon = true
        } else {
          ctx.equippedCount++
        }
        if (item.kind === 'augment') {
          ctx.activeAugmentInGame = tgtAug
          ctx.inGameQuickUseCap = tgtAug?.quickUseSlots || 4
        }
        break
      }

      if (isPositionalStack && verifyRes.itemMatched && (verifyRes.count || 1) > curHaveCount) {
        ctx.anyChanged = true
        curHaveCount = verifyRes.count || 1
        continue
      }
      break
    }
    return
  }

  // ==================== 分支 B：背包 & 武器配件栏位（恢复左侧导航栏焦点 + 分类翻页拖拽） ====================
  const focusRes = await ensureStashFilterRailFocused({
    hwnd,
    vp,
    W,
    H,
    preferredBackpackRect1080p:
      item.kind === 'backpack' ? slotRect1080p : UMG_RECTS_1080P.backpack[0],
    lastNonBackpackRect1080p: ctx.lastNonBackpackRect,
  })
  if (focusRes.recovered) {
    ctx.activeFilter = null
    ctx.lastNonBackpackRect = null
    ctx.scrollState.atTop = false
  }

  let reuseImg = focusRes.imageData
  if (item.kind === 'mod') {
    let wDetail = await inspectEquippedWeaponSlotDetail(reuseImg, vp, item.weaponSlotIndex)
    if (wDetail?.occupied && !wDetail.identified && weaponWait > 0) {
      await waitSafeOrThrow(hwnd, weaponWait)
      reuseImg = (await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)).imageData
      wDetail = await inspectEquippedWeaponSlotDetail(reuseImg, vp, item.weaponSlotIndex)
    }
    if (
      !wDetail?.identified ||
      wDetail.weaponId !== item.parentWeaponId ||
      Boolean(wDetail.amplified) !== Boolean(item.parentAmplified)
    ) {
      return
    }
    if (wDetail.mods?.[item.modSlotKey] === item.targetId) {
      return
    }
    slotRect1080p = wDetail.modRectsBySlotKey?.[item.modSlotKey] || slotRect1080p
    dstPt = rectCenterNorm(slotRect1080p, vp, W, H)
  }

  const candidateFilters = buildCandidateFiltersForGroup(item.stashFilter, [item])
  let found = null
  for (const filterKey of candidateFilters) {
    const filterPt = UMG_RECTS_1080P.stashFilters[filterKey]
    if (filterPt && ctx.activeFilter !== filterKey && focusRes.focused) {
      const fp = pointNorm(filterPt, vp, W, H)
      if (fp.x > 0.01 && fp.x < 0.35 && fp.y > 0.1 && fp.y < 0.9) {
        await execSafeClick(hwnd, fp.x, fp.y)
        ctx.activeFilter = filterKey
        ctx.scrollState.atTop = true
        reuseImg = null
        await waitSafeOrThrow(hwnd, 160)
        await execSafePark(hwnd)
        await waitSafeOrThrow(hwnd, 75)
      }
    }

    found = await searchItemInStashWithScroll({
      hwnd,
      vp,
      W,
      H,
      item,
      scrollState: ctx.scrollState,
      initialImageData: reuseImg,
      basePct: pct,
      stepLabel,
      onProgress,
    })
    reuseImg = null
    if (found?.hit) break
  }

  if (!found?.hit) return

  await execSafeDrag(hwnd, found.hit.normX, found.hit.normY, dstPt.x, dstPt.y, true, 52)
  await waitSafeOrThrow(hwnd, 165)

  let verifyCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
  let verifyRes = await verifyTargetSlotMatched(
    verifyCap.imageData,
    vp,
    item.kind,
    slotRect1080p,
    item.targetId,
    itemMatchOpts(item),
  )

  if (!verifyRes.matched) {
    const reHit = await findTargetInStashGrid(
      verifyCap.imageData,
      vp,
      item.kind,
      item.targetId,
      item.targetCount || null,
      itemMatchOpts(item),
    )
    if (reHit) {
      await execSafeDrag(hwnd, reHit.normX, reHit.normY, dstPt.x, dstPt.y, true, 96)
      await waitSafeOrThrow(hwnd, 175)
      verifyCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
      verifyRes = await verifyTargetSlotMatched(
        verifyCap.imageData,
        vp,
        item.kind,
        slotRect1080p,
        item.targetId,
        itemMatchOpts(item),
      )
    }
  }

  ctx.latestFrameImg = verifyCap.imageData
  if (verifyRes.matched) {
    ctx.anyChanged = true
    ctx.equippedCount++
  } else if (verifyRes.itemMatched) {
    ctx.anyChanged = true
  }
}

/**
 * 阶段 3a：对同一筛选类目下的多格物品执行「Ctrl 多选 + Shift 快速移仓」
 */
async function batchQuickMoveContainerGroup(ctx, primaryFilterKey, groupEntries, { pct }) {
  const { hwnd, vp, W, H, onProgress } = ctx
  const demandRemain = new Map()
  for (const e of groupEntries) {
    const qty = Math.max(1, Number(e.deficitCount ?? e.targetCount) || 1)
    demandRemain.set(e.targetId, (demandRemain.get(e.targetId) || 0) + qty)
  }

  const buildActiveDemands = () => {
    const list = []
    for (const [targetId, neededCount] of demandRemain.entries()) {
      if (neededCount <= 0) continue
      const meta = itemMap.get(targetId)
      list.push({
        targetId,
        neededCount,
        maxStack: meta?.maxStack || 1,
      })
    }
    return list
  }

  const focusRes = await ensureStashFilterRailFocused({
    hwnd,
    vp,
    W,
    H,
    preferredBackpackRect1080p: UMG_RECTS_1080P.backpack[0],
    lastNonBackpackRect1080p: ctx.lastNonBackpackRect,
  })
  if (focusRes.recovered) {
    ctx.activeFilter = null
    ctx.lastNonBackpackRect = null
    ctx.scrollState.atTop = false
  }
  if (!focusRes.focused) {
    return { movedAny: false, abortedByFull: true }
  }

  const hoverPt = pointNorm(UMG_RECTS_1080P.stashScrollHover, vp, W, H)
  const candidateFilters = buildCandidateFiltersForGroup(primaryFilterKey, groupEntries)
  let movedAny = false
  let abortedByFull = false

  for (const filterKey of candidateFilters) {
    if (buildActiveDemands().length === 0 || abortedByFull) break

    const filterPt = UMG_RECTS_1080P.stashFilters[filterKey]
    if (filterPt) {
      const fp = pointNorm(filterPt, vp, W, H)
      if (fp.x > 0.01 && fp.x < 0.35 && fp.y > 0.1 && fp.y < 0.9) {
        await execSafeClick(hwnd, fp.x, fp.y)
        ctx.activeFilter = filterKey
        ctx.scrollState.atTop = true
        await waitSafeOrThrow(hwnd, 160)
        await execSafePark(hwnd)
        await waitSafeOrThrow(hwnd, 75)
      }
    }

    let curImg = (await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)).imageData
    ctx.latestFrameImg = curImg
    let firstPage = inspectStashPageState(curImg, vp)
    let prevSig = firstPage.signature
    const startedConfirmedAtTop = Boolean(ctx.scrollState.atTop) && !firstPage.scrolledFromTop

    const sweepVisiblePage = async () => {
      for (let round = 0; round < 6; round++) {
        const demands = buildActiveDemands()
        if (!demands.length) return true

        const hits = await findBatchTargetsInStashGrid(curImg, vp, demands)
        if (!hits.length) return false

        const preSig = inspectStashPageState(curImg, vp).signature
        onProgress?.({
          progressPct: pct,
          message: `批量多选移仓 (${filterKey})：选中 ${hits.length} 格`,
        })

        if (hits.length >= 2) {
          for (let hi = 0; hi < hits.length; hi++) {
            await execSafeCtrlClick(hwnd, hits[hi].normX, hits[hi].normY, true, false)
            await waitSafeOrThrow(hwnd, 55)
          }
          const lastHit = hits[hits.length - 1]
          await execSafeShiftClick(hwnd, lastHit.normX, lastHit.normY)
        } else {
          await execSafeShiftClick(hwnd, hits[0].normX, hits[0].normY)
        }

        await waitSafeOrThrow(hwnd, 185)
        const postCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        curImg = postCap.imageData
        ctx.latestFrameImg = curImg
        const postState = inspectStashPageState(curImg, vp)
        firstPage = postState

        // 若仓库网格像素未变化，说明右侧战备容器已满或被锁定，提前结束批移交给核对阶段
        if (stashSignatureMeanDiff(preSig, postState.signature) < 0.65) {
          abortedByFull = true
          return true
        }

        movedAny = true
        for (const h of hits) {
          const curNeed = demandRemain.get(h.targetId) || 0
          demandRemain.set(h.targetId, Math.max(0, curNeed - Math.max(1, h.count || 1)))
        }
        prevSig = postState.signature
      }
      return false
    }

    await sweepVisiblePage()
    if (buildActiveDemands().length === 0 || abortedByFull) continue

    if (
      startedConfirmedAtTop &&
      firstPage.occupiedCount < 20 &&
      firstPage.bottomRowsOccupied === 0 &&
      !firstPage.hasScrollbar
    ) {
      continue
    }

    const canScrollDown =
      !firstPage.atBottom &&
      (firstPage.occupiedCount >= 20 || firstPage.bottomRowsOccupied > 0 || firstPage.hasScrollbar)

    if (canScrollDown) {
      for (let page = 1; page <= MAX_SCROLL_PAGES_DOWN; page++) {
        if (buildActiveDemands().length === 0 || abortedByFull) break
        onProgress?.({
          progressPct: pct,
          message: `批量检索仓库 (${filterKey}) · 下翻第 ${page} 页`,
        })
        await execSafeScroll(hwnd, hoverPt.x, hoverPt.y, SCROLL_STEP_DOWN)
        await waitSafeOrThrow(hwnd, 200)

        const nextCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        curImg = nextCap.imageData
        ctx.latestFrameImg = curImg
        const pageState = inspectStashPageState(curImg, vp)
        if (!didStashScrollChange(prevSig, pageState.signature)) break

        ctx.scrollState.atTop = false
        prevSig = pageState.signature
        await sweepVisiblePage()
        if (buildActiveDemands().length === 0 || abortedByFull) break

        if (
          pageState.atBottom ||
          (pageState.occupiedCount < 20 &&
            pageState.bottomRowsOccupied === 0 &&
            !pageState.hasScrollbar)
        ) {
          break
        }
      }
    }

    if (buildActiveDemands().length > 0 && !abortedByFull && (!startedConfirmedAtTop || firstPage.scrolledFromTop)) {
      for (let page = 1; page <= MAX_SCROLL_PAGES_UP; page++) {
        if (buildActiveDemands().length === 0 || abortedByFull) break
        await execSafeScroll(hwnd, hoverPt.x, hoverPt.y, SCROLL_STEP_UP)
        await waitSafeOrThrow(hwnd, 200)

        const upCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        curImg = upCap.imageData
        ctx.latestFrameImg = curImg
        const upState = inspectStashPageState(curImg, vp)
        if (!didStashScrollChange(prevSig, upState.signature)) {
          ctx.scrollState.atTop = true
          break
        }
        prevSig = upState.signature
        await sweepVisiblePage()
        if (upState.hasScrollbar && !upState.scrolledFromTop) {
          ctx.scrollState.atTop = true
          break
        }
      }
    }
  }

  if (!abortedByFull) {
    for (const [targetId, rem] of demandRemain.entries()) {
      if (rem > 0) {
        ctx.exhaustedTargetIds.add(targetId)
      }
    }
  }

  return { movedAny, abortedByFull }
}

/**
 * 阶段 3b：右侧战备栏精确核对与理货
 * Pass 1：将背包或错位栏位中的目标道具拖回快捷栏 / 专属栏 / 安全口袋准确槽位；
 * Pass 2：将 Shift 误塞入「目标应为空」或「背包所需」的精确栏位道具腾挪到空余背包格。
 */
async function rearrangeRightPanelContainers(ctx, { pct }) {
  const { hwnd, vp, W, H, targetLoadout, onProgress } = ctx
  let curCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
  ctx.latestFrameImg = curCap.imageData
  let curRec = await recognizeLoadoutFromImageData(curCap.imageData, { fullWindowOnly: true })
  if (!curRec?.ok) return false

  const activeAug = ctx.activeAugmentInGame
  const bpCap = activeAug?.backpackSlots || 10
  const posSpecs = collectPositionalSlotSpecs(targetLoadout, activeAug)
  let rearrangedAny = false

  const readPosSlot = (rec, spec) => rec?.loadout?.[spec.kind]?.[spec.slotIndex] || null
  const isSpecSatisfied = (rec, spec) => {
    const tgtId = spec.targetEntry?.itemId
    const cur = readPosSlot(rec, spec)
    if (!tgtId) return !cur?.itemId
    const tgtCount = Math.max(1, Number(spec.targetEntry?.count) || 1)
    return cur?.itemId === tgtId && Math.max(1, Number(cur?.count) || 1) >= tgtCount
  }

  // Pass 1：对齐快捷栏 / 专属栏 / 安全口袋目标槽位（支持部分堆叠二次/多次合并补齐）
  for (const dstSpec of posSpecs) {
    const tgtId = dstSpec.targetEntry?.itemId
    if (!tgtId) continue
    if (isSpecSatisfied(curRec, dstSpec)) continue

    const tgtCount = Math.max(1, Number(dstSpec.targetEntry?.count) || 1)
    const triedDonorKeys = new Set()

    for (let attempt = 0; attempt < 3; attempt++) {
      if (isSpecSatisfied(curRec, dstSpec)) break

      const prevSlot = readPosSlot(curRec, dstSpec)
      const prevCount =
        prevSlot?.itemId === tgtId ? Math.max(1, Number(prevSlot.count) || 1) : 0

      // 优先从非目标精确栏位取件（一次拖拽顺带释放误占槽位），其次从背包取件
      let donorRect = null
      let donorKey = null
      for (const altSpec of posSpecs) {
        if (altSpec === dstSpec) continue
        if (altSpec.targetEntry?.itemId === tgtId) continue
        if (readPosSlot(curRec, altSpec)?.itemId !== tgtId) continue
        const key = `${altSpec.kind}:${altSpec.slotIndex}`
        if (triedDonorKeys.has(key)) continue
        donorRect = altSpec.rect1080p
        donorKey = key
        break
      }
      if (!donorRect) {
        const liveBp = curRec.loadout?.backpack || []
        for (let bi = Math.min(liveBp.length, bpCap) - 1; bi >= 0; bi--) {
          if (liveBp[bi]?.itemId !== tgtId) continue
          const key = `bp:${bi}`
          if (triedDonorKeys.has(key)) continue
          donorRect = UMG_RECTS_1080P.backpack[bi]
          donorKey = key
          break
        }
      }
      if (!donorRect || !donorKey) break

      triedDonorKeys.add(donorKey)
      const srcPt = rectCenterNorm(donorRect, vp, W, H)
      const dstPt = rectCenterNorm(dstSpec.rect1080p, vp, W, H)
      onProgress?.({
        progressPct: pct,
        message: `整理右侧栏位：将 ${itemMap.get(tgtId)?.zhName || tgtId} 拖入指定格`,
      })
      await execSafeDrag(hwnd, srcPt.x, srcPt.y, dstPt.x, dstPt.y, true, 52)
      await waitSafeOrThrow(hwnd, 165)

      let verifyCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
      let verifyRes = await verifyTargetSlotMatched(
        verifyCap.imageData,
        vp,
        dstSpec.kind,
        dstSpec.rect1080p,
        tgtId,
        { minCount: tgtCount },
      )
      let progressed =
        verifyRes.matched || (verifyRes.itemMatched && (verifyRes.count || 1) > prevCount)
      if (!progressed) {
        await execSafeDrag(hwnd, srcPt.x, srcPt.y, dstPt.x, dstPt.y, true, 96)
        await waitSafeOrThrow(hwnd, 175)
        verifyCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        verifyRes = await verifyTargetSlotMatched(
          verifyCap.imageData,
          vp,
          dstSpec.kind,
          dstSpec.rect1080p,
          tgtId,
          { minCount: tgtCount },
        )
        progressed =
          verifyRes.matched || (verifyRes.itemMatched && (verifyRes.count || 1) > prevCount)
      }

      if (progressed) rearrangedAny = true
      ctx.latestFrameImg = verifyCap.imageData
      const nextRec = await recognizeLoadoutFromImageData(verifyCap.imageData, {
        fullWindowOnly: true,
      })
      if (nextRec?.ok) {
        curRec = nextRec
      }
      if (!progressed) break
    }
  }

  // Pass 2：统计背包所需种类数量，将错落入精确栏位的物品腾挪到空闲背包格
  const bpNeedCounts = new Map()
  for (let bi = 0; bi < bpCap; bi++) {
    const be = targetLoadout?.backpack?.[bi]
    if (!be?.itemId) continue
    bpNeedCounts.set(be.itemId, (bpNeedCounts.get(be.itemId) || 0) + Math.max(1, be.count || 1))
  }
  const liveBpNow = curRec.loadout?.backpack || []
  for (let bi = 0; bi < liveBpNow.length; bi++) {
    const lb = liveBpNow[bi]
    if (!lb?.itemId) continue
    const rem = bpNeedCounts.get(lb.itemId) || 0
    if (rem > 0) bpNeedCounts.set(lb.itemId, Math.max(0, rem - Math.max(1, lb.count || 1)))
  }

  for (const posSpec of posSpecs) {
    const curItem = readPosSlot(curRec, posSpec)
    if (!curItem?.itemId) continue
    const tgtId = posSpec.targetEntry?.itemId || null
    if (tgtId === curItem.itemId) continue

    const shouldEvict = !tgtId || (bpNeedCounts.get(curItem.itemId) || 0) > 0
    if (!shouldEvict) continue

    let emptyBpIdx = -1
    const liveBpList = curRec.loadout?.backpack || []
    for (let bi = 0; bi < bpCap; bi++) {
      if (!liveBpList[bi]?.itemId) {
        emptyBpIdx = bi
        break
      }
    }
    if (emptyBpIdx < 0) break

    const srcPt = rectCenterNorm(posSpec.rect1080p, vp, W, H)
    const dstPt = rectCenterNorm(UMG_RECTS_1080P.backpack[emptyBpIdx], vp, W, H)
    onProgress?.({
      progressPct: pct,
      message: `腾挪错位物品至背包：${itemMap.get(curItem.itemId)?.zhName || curItem.itemId}`,
    })
    await execSafeDrag(hwnd, srcPt.x, srcPt.y, dstPt.x, dstPt.y, true, 52)
    await waitSafeOrThrow(hwnd, 165)

    const evCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
    ctx.latestFrameImg = evCap.imageData
    rearrangedAny = true
    const nextRec = await recognizeLoadoutFromImageData(evCap.imageData, { fullWindowOnly: true })
    if (nextRec?.ok) {
      curRec = nextRec
    }
  }

  return rearrangedAny
}

/**
 * 执行一轮「仓库检索 -> 实机拖拽/装配」遍历（三阶段流水线：核心装备 -> 武器配件 -> 容器批移/核对/补位）
 */
async function executeStashEquipPass({
  hwnd,
  targetLoadout,
  baseLoadout,
  pendingEntries,
  initialImageData,
  vp,
  W,
  H,
  syncOptions,
  weaponWait,
  pctStart = 20,
  pctEnd = 90,
  onProgress,
}) {
  const tgtAug = augMap.get(targetLoadout?.augmentId) || augMap.get('none')
  const liveInitialAug = augMap.get(baseLoadout?.augmentId) || augMap.get('none')

  const activeAugmentInGame = baseLoadout?.augmentId === tgtAug.id ? tgtAug : liveInitialAug
  const inGameQuickUseCap =
    typeof baseLoadout?.quickUseSlotCap === 'number'
      ? baseLoadout.quickUseSlotCap
      : activeAugmentInGame?.quickUseSlots || 4

  const ctx = {
    hwnd,
    vp,
    W,
    H,
    targetLoadout,
    tgtAug,
    syncOptions,
    weaponWait,
    onProgress,
    equippedCount: 0,
    equippedBaseWeapon: false,
    anyChanged: false,
    activeAugmentInGame,
    inGameQuickUseCap,
    activeFilter: null,
    latestFrameImg: initialImageData,
    lastNonBackpackRect: detectSelectedNonBackpackSlot1080p(initialImageData, vp),
    scrollState: { atTop: false },
    exhaustedTargetIds: new Set(),
  }

  const coreEntries = [
    ...pendingEntries.filter((e) => e.kind === 'augment'),
    ...pendingEntries.filter((e) => e.kind === 'shield' || e.kind === 'weapon'),
  ]
  const modEntries = pendingEntries.filter((e) => e.kind === 'mod')
  const containerEntries = pendingEntries.filter(
    (e) =>
      e.kind === 'quickUse' ||
      e.kind === 'aux' ||
      e.kind === 'safePocket' ||
      e.kind === 'backpack',
  )

  const totalApprox = Math.max(1, coreEntries.length + modEntries.length + containerEntries.length)
  const calcPct = (done) =>
    Math.min(pctEnd, pctStart + Math.round((done / totalApprox) * (pctEnd - pctStart)))

  let stepDone = 0

  // 阶段 1：核心装备（强化 / 护盾 / 武器）单槽精准装配
  for (const item of coreEntries) {
    stepDone++
    await equipSingleEntryDirect(ctx, item, {
      pct: calcPct(stepDone),
      stepLabel: `(${stepDone}/${totalApprox})`,
    })
  }

  // 阶段 2：武器配件精准装配
  for (const item of modEntries) {
    stepDone++
    await equipSingleEntryDirect(ctx, item, {
      pct: calcPct(stepDone),
      stepLabel: `(${stepDone}/${totalApprox})`,
    })
  }

  // 阶段 3：容器物品（快捷栏 / 专属栏 / 安全口袋 / 背包）
  const activeContainerPending = containerEntries.filter(
    (e) =>
      !resolveDynamicSlotRect(e, ctx.activeAugmentInGame, tgtAug, ctx.inGameQuickUseCap).skip,
  )

  if (activeContainerPending.length > 0) {
    if (syncOptions.quickUseOnly) {
      // 仅快速使用模式：逐格单槽直拖装配，不执行批量 Shift 移仓与跨容器理货
      for (const item of activeContainerPending) {
        if (ctx.exhaustedTargetIds.has(item.targetId)) continue
        stepDone++
        await equipSingleEntryDirect(ctx, item, {
          pct: calcPct(Math.min(totalApprox, stepDone)),
          stepLabel: `(${stepDone}/${totalApprox})`,
        })
      }
    } else {
      const splitStackIds = detectSplitStackPositionalIds(targetLoadout, ctx.activeAugmentInGame)
      const directFallbackEntries = []
      const filterGroups = new Map()

      for (const entry of activeContainerPending) {
        if (entry.kind !== 'backpack' && splitStackIds.has(entry.targetId)) {
          directFallbackEntries.push(entry)
          continue
        }
        const fKey = entry.stashFilter || 'all'
        if (!filterGroups.has(fKey)) filterGroups.set(fKey, [])
        filterGroups.get(fKey).push(entry)
      }

      const batchGroups = []
      for (const [fKey, group] of filterGroups.entries()) {
        // 同一筛选栏内仅剩单个格位待装时，直接单次拖拽比 Shift+核对更省步骤
        if (group.length === 1) {
          directFallbackEntries.push(group[0])
        } else {
          batchGroups.push([fKey, group])
        }
      }

      // 阶段 3a：同筛选栏多格物品 Ctrl 多选 + Shift 快速移仓
      let batchMovedAny = false
      for (const [fKey, group] of batchGroups) {
        const bRes = await batchQuickMoveContainerGroup(ctx, fKey, group, {
          pct: calcPct(stepDone + Math.max(1, Math.round(group.length * 0.5))),
        })
        if (bRes.movedAny) batchMovedAny = true
      }

      // 阶段 3b：右侧快捷栏 / 专属栏 / 安全口袋对位核对与错位腾挪
      let rearrangedAny = false
      if (batchMovedAny || directFallbackEntries.some((e) => e.kind !== 'backpack')) {
        rearrangedAny = await rearrangeRightPanelContainers(ctx, {
          pct: calcPct(stepDone + Math.max(1, activeContainerPending.length - 1)),
        })
      }

      // 阶段 3c：整画面复核剩余缺口，未满或需精准放置的物品走单槽拖拽补齐
      let remainingDirect = directFallbackEntries
      if (batchMovedAny || rearrangedAny) {
        ctx.anyChanged = true
        const afterCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        ctx.latestFrameImg = afterCap.imageData
        const afterRec = await recognizeLoadoutFromImageData(afterCap.imageData, { fullWindowOnly: true })
        if (afterRec?.ok) {
          const afterDiff = analyzeLoadoutSyncDiff(afterRec.loadout, targetLoadout, syncOptions)
          const afterByKey = new Map(afterDiff.entries.map((e) => [e.key, e]))
          remainingDirect = []
          for (const pe of activeContainerPending) {
            const ae = afterByKey.get(pe.key)
            if (ae?.matched) {
              ctx.equippedCount++
            } else if (ae && !ctx.exhaustedTargetIds.has(ae.targetId)) {
              remainingDirect.push(ae)
            }
          }
        }
      }

      for (const item of remainingDirect) {
        if (ctx.exhaustedTargetIds.has(item.targetId)) continue
        stepDone++
        await equipSingleEntryDirect(ctx, item, {
          pct: calcPct(Math.min(totalApprox, stepDone)),
          stepLabel: `(${stepDone}/${totalApprox})`,
        })
      }
    }
  }

  return {
    equippedCount: ctx.equippedCount,
    equippedBaseWeapon: ctx.equippedBaseWeapon,
    anyChanged: Boolean(ctx.anyChanged || ctx.equippedCount > 0 || ctx.equippedBaseWeapon),
    activeAugmentInGame: ctx.activeAugmentInGame,
    lastNonBackpackRect: ctx.lastNonBackpackRect,
  }
}

export async function runLoadoutAutoSyncSession({
  targetLoadout,
  onProgress,
  weaponLoadWaitMs = DEFAULT_WEAPON_LOAD_WAIT_MS,
  syncOptions: rawSyncOptions = DEFAULT_RAIDER_SYNC_OPTIONS,
}) {
  if (!isTauriRuntime()) {
    throw new Error('仅桌面端支持自动配装，浏览器端请使用全屏透视配装指引')
  }
  const syncOptions = resolveEffectiveSyncOptions(rawSyncOptions)
  const weaponWait = Math.round(
    Math.max(0, Math.min(15000, Number(weaponLoadWaitMs) || 0)),
  )

  try {
    onProgress?.({ progressPct: 5, message: '正在定位游戏窗口...' })
    const winInfo = await invokeTauri('raider_find_game_window')
    if (!winInfo?.found || !winInfo?.hwnd) {
      throw new Error('未检测到运行中的《ARC Raiders》窗口')
    }
    const hwnd = winInfo.hwnd

    const focused = await invokeTauri('raider_focus_game_window', { hwnd })
    if (!focused?.ok) {
      return {
        ok: false,
        message:
          focused?.reason ||
          '无法激活游戏窗口焦点，若游戏以管理员身份运行，请以管理员身份启动本软件',
      }
    }
    await waitSafeOrThrow(hwnd, 120, false)
    await execSafePark(hwnd, false)
    await waitSafeOrThrow(hwnd, 90, true)

    onProgress?.({
      progressPct: 16,
      message: syncOptions.quickUseOnly
        ? '正在扫描快速使用栏位...'
        : '正在扫描当前实机战备槽位...',
    })
    let firstCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
    let firstRec = await recognizeLoadoutFromImageData(firstCap.imageData, {
      fullWindowOnly: true,
      quickUseOnly: syncOptions.quickUseOnly,
    })
    if (
      !syncOptions.quickUseOnly &&
      firstRec.ok &&
      weaponWait > 0 &&
      (firstRec.weaponSlotStates || []).some((s) => s?.occupied && !s.identified)
    ) {
      onProgress?.({
        progressPct: 18,
        message: `武器栏加载中，等待 ${(weaponWait / 1000).toFixed(1)} 秒后重新扫描...`,
      })
      await waitSafeOrThrow(hwnd, weaponWait)
      firstCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
      firstRec = await recognizeLoadoutFromImageData(firstCap.imageData, {
        fullWindowOnly: true,
        quickUseOnly: syncOptions.quickUseOnly,
      })
    }
    if (!firstRec.ok) {
      return {
        ok: false,
        message: firstRec.error || '请先在游戏内打开「仓库 / 战备」界面后再执行同步',
      }
    }

    const initialDiff = analyzeLoadoutSyncDiff(firstRec.loadout, targetLoadout, syncOptions)
    if (initialDiff.totalTargetSlots === 0) {
      return {
        ok: false,
        message: syncOptions.quickUseOnly
          ? '所选战备未配置「快速使用」栏位道具，请先配置快捷栏或关闭「只自动配装快速使用」'
          : '目标战备为空，请先配置装备后再同步',
      }
    }
    if (initialDiff.alreadySynced) {
      return {
        ok: true,
        inGameLoadout: firstRec.loadout,
        equippedCount: 0,
        remainingCount: 0,
        message: '实机战备已与目标方案完全一致',
      }
    }

    if (!firstRec.hasStashPanel && !syncOptions.autoRestockEnabled) {
      return {
        ok: true,
        inGameLoadout: firstRec.loadout,
        equippedCount: 0,
        remainingCount: initialDiff.pendingCount,
        message: `已识别差量（待装配 ${initialDiff.pendingCount} 项），当前画面无仓库栏，可开启透视指引装配`,
      }
    }

    let vp = firstRec.viewport
    let W = firstCap.imageData.width
    let H = firstCap.imageData.height
    let equippedCount = 0
    let activeAugmentInGame = augMap.get(firstRec.loadout?.augmentId) || augMap.get('none')
    let lastNonBackpackRect = detectSelectedNonBackpackSlot1080p(firstCap.imageData, vp)
    let midLoadout = firstRec.loadout

    // 阶段 1：优先从仓库检索并装配已拥有的装备/配件
    if (firstRec.hasStashPanel) {
      const p1 = await executeStashEquipPass({
        hwnd,
        targetLoadout,
        baseLoadout: firstRec.loadout,
        pendingEntries: initialDiff.entries.filter((e) => !e.matched),
        initialImageData: firstCap.imageData,
        vp,
        W,
        H,
        syncOptions,
        weaponWait,
        pctStart: 20,
        pctEnd: syncOptions.autoRestockEnabled ? 54 : 92,
        onProgress,
      })
      equippedCount += p1.equippedCount
      activeAugmentInGame = p1.activeAugmentInGame
      lastNonBackpackRect = p1.lastNonBackpackRect

      if (syncOptions.autoRestockEnabled && p1.anyChanged) {
        const midCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        const midRec = await recognizeLoadoutFromImageData(midCap.imageData, {
          fullWindowOnly: true,
          quickUseOnly: syncOptions.quickUseOnly,
        })
        if (midRec?.ok) {
          midLoadout = midRec.loadout
        }
      }
    }

    // 阶段 2 & 3：当开启「自动补货」且仍有缺口或低阶武器时，批量前往商人购买 / 工坊制造 / 武器升级后返仓补装
    let restockSummary = { boughtCount: 0, craftedCount: 0, upgradedCount: 0 }
    if (syncOptions.autoRestockEnabled) {
      const midDiff = analyzeLoadoutSyncDiff(midLoadout, targetLoadout, syncOptions)
      if (midDiff.pendingCount > 0) {
        const { restockBill, upgradeTasks } = buildRestockBillAndUpgrades(midDiff, syncOptions)
        if (restockBill.length > 0 || upgradeTasks.length > 0) {
          const restockRes = await runAutoRestockSession({
            hwnd,
            restockBill,
            upgradeTasks,
            syncOptions,
            weaponLoadWaitMs: weaponWait,
            onProgress,
          })
          restockSummary = {
            boughtCount: restockRes.boughtCount || 0,
            craftedCount: restockRes.craftedCount || 0,
            upgradedCount: restockRes.upgradedCount || 0,
          }

          if (
            restockRes.ok &&
            (restockSummary.boughtCount > 0 ||
              restockSummary.craftedCount > 0 ||
              restockSummary.upgradedCount > 0)
          ) {
            onProgress?.({ progressPct: 78, message: '补货完毕，正在返仓二次装配...' })
            let postCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
            let postRec = await recognizeLoadoutFromImageData(postCap.imageData, {
              fullWindowOnly: true,
              quickUseOnly: syncOptions.quickUseOnly,
            })
            if (
              !syncOptions.quickUseOnly &&
              postRec.ok &&
              weaponWait > 0 &&
              (postRec.weaponSlotStates || []).some((s) => s?.occupied && !s.identified)
            ) {
              await waitSafeOrThrow(hwnd, weaponWait)
              postCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
              postRec = await recognizeLoadoutFromImageData(postCap.imageData, {
                fullWindowOnly: true,
                quickUseOnly: syncOptions.quickUseOnly,
              })
            }
            if (postRec.ok && postRec.hasStashPanel) {
              vp = postRec.viewport
              W = postCap.imageData.width
              H = postCap.imageData.height
              const postDiff = analyzeLoadoutSyncDiff(postRec.loadout, targetLoadout, syncOptions)
              if (postDiff.pendingCount > 0) {
                const p3 = await executeStashEquipPass({
                  hwnd,
                  targetLoadout,
                  baseLoadout: postRec.loadout,
                  pendingEntries: postDiff.entries.filter((e) => !e.matched),
                  initialImageData: postCap.imageData,
                  vp,
                  W,
                  H,
                  syncOptions,
                  weaponWait,
                  pctStart: 79,
                  pctEnd: 94,
                  onProgress,
                })
                equippedCount += p3.equippedCount
                activeAugmentInGame = p3.activeAugmentInGame
                lastNonBackpackRect = p3.lastNonBackpackRect
              }
            }
          }
        }
      }
    }

    // 收尾焦点复原：若最后一步停留在非背包槽位导致左侧分类栏失焦，优先点击空闲背包格自动恢复焦点方便玩家后续操作
    const bpSlotCap = activeAugmentInGame?.backpackSlots || 10
    let neutralBpIdx = 0
    for (let bi = 0; bi < bpSlotCap; bi++) {
      if (!targetLoadout?.backpack?.[bi]?.itemId && !firstRec.loadout?.backpack?.[bi]) {
        neutralBpIdx = bi
        break
      }
    }
    await ensureStashFilterRailFocused({
      hwnd,
      vp,
      W,
      H,
      preferredBackpackRect1080p:
        UMG_RECTS_1080P.backpack[neutralBpIdx] || UMG_RECTS_1080P.backpack[0],
      lastNonBackpackRect1080p: lastNonBackpackRect,
    })

    onProgress?.({ progressPct: 96, message: '正在复核实机战备状态...' })
    const finalCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
    const finalRec = await recognizeLoadoutFromImageData(finalCap.imageData, {
      fullWindowOnly: true,
      quickUseOnly: syncOptions.quickUseOnly,
    })
    const finalLoadout = finalRec.ok ? finalRec.loadout : firstRec.loadout
    const finalDiff = analyzeLoadoutSyncDiff(finalLoadout, targetLoadout, syncOptions)

    const restockParts = []
    if (restockSummary.boughtCount > 0) restockParts.push(`购买 ${restockSummary.boughtCount} 件`)
    if (restockSummary.craftedCount > 0) restockParts.push(`制造 ${restockSummary.craftedCount} 件`)
    if (restockSummary.upgradedCount > 0) restockParts.push(`升级 ${restockSummary.upgradedCount} 级`)
    const restockSuffix = restockParts.length ? `（${restockParts.join(' · ')}）` : ''

    const msg =
      finalDiff.pendingCount === 0
        ? `同步完成（已就绪 ${finalDiff.matchedCount}/${finalDiff.totalTargetSlots} 项${restockSuffix}）`
        : equippedCount > 0 || restockParts.length > 0
          ? `已装配 ${equippedCount} 项${restockSuffix}，剩余 ${finalDiff.pendingCount} 项暂缺，可开启透视指引核对`
          : `已完成全仓滚动检索（匹配 ${finalDiff.matchedCount}/${finalDiff.totalTargetSlots} 项），缺失项不在仓库中，可开启透视指引查看`

    return {
      ok: true,
      inGameLoadout: finalLoadout,
      equippedCount,
      restockSummary,
      remainingCount: finalDiff.pendingCount,
      message: msg,
    }
  } finally {
    if (isTauriRuntime()) {
      await invokeTauri('raider_finish_sync').catch(() => {})
    }
  }
}
