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
import { abortRaiderAutoSync, captureGameClientImageData } from './raiderAutoSyncPlanner'
import {
  UMG_RECTS_1080P,
  detectSelectedNonBackpackSlot1080p,
  didStashScrollChange,
  findTargetInStashGrid,
  inspectStashPageState,
  isRect1080pSelected,
  isStashFilterRailActive,
  recognizeLoadoutFromImageData,
  verifyTargetSlotMatched,
} from './raiderLoadoutRecognizer'

export { abortRaiderAutoSync, captureGameClientImageData }

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

/**
 * 计算目标战备与游戏内实机战备的逐槽位差量及 1080p UMG 投影框
 */
export function analyzeLoadoutSyncDiff(inGameLoadout, targetLoadout) {
  const tgt = targetLoadout || {}
  const live = inGameLoadout || null
  const entries = []

  const tgtAug = augMap.get(tgt.augmentId) || augMap.get('none')
  const liveAug = live ? augMap.get(live.augmentId) || augMap.get('none') : null

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
    const tgtAmplified = Boolean(wEntry.amplified || (wEntry.ampIds || []).length)
    const liveAmplified = Boolean(liveW?.amplified || (liveW?.ampIds || []).length)
    const matched = Boolean(
      liveW && liveW.weaponId === wMeta.id && liveAmplified === tgtAmplified,
    )

    const roman = ROMAN[(wEntry.tier || 1) - 1] || 'I'
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

    entries.push({
      key: `weapon${i + 1}`,
      kind: 'weapon',
      slotIndex: i,
      stashFilter: 'weapons',
      slotLabel: `武器 ${i === 0 ? 'I' : 'II'}`,
      targetId: wMeta.id,
      targetName: tgtAmplified ? `增强型 ${wMeta.zhName}` : wMeta.zhName,
      amplified: tgtAmplified,
      icon: assetUrl(
        (tgtAmplified && weaponVisuals.weapons?.[wMeta.id]?.ascended?.image) || wMeta.image,
      ),
      rarity: tgtAmplified ? 'Legendary' : wMeta.rarity,
      color: rarityMeta[tgtAmplified ? 'Legendary' : wMeta.rarity]?.color || '#fd4b10',
      badge: tgtAmplified ? '增强型' : `Lv.${roman}`,
      modBadges,
      subTags: [...ampBadges, ...modBadges.map((m) => m.name)],
      liveName: liveWMeta
        ? liveAmplified
          ? `增强型 ${liveWMeta.zhName}`
          : liveWMeta.zhName
        : null,
      matched,
      rect1080p: i === 0 ? UMG_RECTS_1080P.weapon1 : UMG_RECTS_1080P.weapon2,
    })
  }

  // 4. 快速使用栏位
  const quLimit = tgtAug?.quickUseSlots || 4
  for (let i = 0; i < quLimit; i++) {
    const qEntry = tgt.quickUse?.[i]
    if (!qEntry?.itemId) continue
    const qMeta = itemMap.get(qEntry.itemId)
    if (!qMeta) continue

    const liveQ = live?.quickUse?.[i]
    const liveQMeta = liveQ?.itemId ? itemMap.get(liveQ.itemId) : null
    const matched = Boolean(liveQ && liveQ.itemId === qMeta.id)

    entries.push({
      key: `quickUse${i}`,
      kind: 'quickUse',
      slotIndex: i,
      stashFilter: 'utilities',
      slotLabel: `快捷 ${i + 1}`,
      targetId: qMeta.id,
      targetName: qMeta.zhName,
      icon: assetUrl(qMeta.icon),
      rarity: qMeta.rarity,
      color: rarityMeta[qMeta.rarity]?.color || '#26bf57',
      targetCount: qEntry.count || 1,
      badge: `×${qEntry.count || 1}`,
      subTags: qMeta.statTags?.slice(0, 1) || [],
      liveName: liveQMeta ? liveQMeta.zhName : null,
      matched,
      rect1080p: UMG_RECTS_1080P.quickUse[i],
    })
  }

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

      const liveA = live?.aux?.[i]
      const liveAMeta = liveA?.itemId ? itemMap.get(liveA.itemId) : null
      const matched = Boolean(liveA && liveA.itemId === aMeta.id)
      const rectIdx = Math.min(2, i + integratedOffset)

      entries.push({
        key: `aux${i}`,
        kind: 'aux',
        slotIndex: i,
        stashFilter: resolveItemStashFilter(aMeta.category),
        slotLabel: `${auxSpec.label} ${i + 1}`,
        targetId: aMeta.id,
        targetName: aMeta.zhName,
        icon: assetUrl(aMeta.icon),
        rarity: aMeta.rarity,
        color: rarityMeta[aMeta.rarity]?.color || '#ffbc13',
        targetCount: aEntry.count || 1,
        badge: `×${aEntry.count || 1}`,
        subTags: aMeta.statTags?.slice(0, 1) || [],
        liveName: liveAMeta ? liveAMeta.zhName : null,
        matched,
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

    const liveSp = live?.safePocket?.[i]
    const liveSpMeta = liveSp?.itemId ? itemMap.get(liveSp.itemId) : null
    const matched = Boolean(liveSp && liveSp.itemId === spMeta.id)

    entries.push({
      key: `safePocket${i}`,
      kind: 'safePocket',
      slotIndex: i,
      stashFilter: resolveItemStashFilter(spMeta.category),
      slotLabel: `安全袋 ${i + 1}`,
      targetId: spMeta.id,
      targetName: spMeta.zhName,
      icon: assetUrl(spMeta.icon),
      rarity: spMeta.rarity,
      color: rarityMeta[spMeta.rarity]?.color || '#00a9f2',
      targetCount: spEntry.count || 1,
      badge: `×${spEntry.count || 1}`,
      subTags: spMeta.statTags?.slice(0, 1) || [],
      liveName: liveSpMeta ? liveSpMeta.zhName : null,
      matched,
      rect1080p: spRects?.[i] || UMG_RECTS_1080P.safePocketWithAux[i],
    })
  }

  // 7. 背包槽位
  const bpLimit = tgtAug?.backpackSlots || 10
  for (let i = 0; i < bpLimit; i++) {
    const bEntry = tgt.backpack?.[i]
    if (!bEntry?.itemId) continue
    const bMeta = itemMap.get(bEntry.itemId)
    if (!bMeta) continue

    const liveB = live?.backpack?.[i]
    const liveBMeta = liveB?.itemId ? itemMap.get(liveB.itemId) : null
    const matched = Boolean(liveB && liveB.itemId === bMeta.id)

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
      targetCount: bEntry.count || 1,
      badge: `×${bEntry.count || 1}`,
      subTags: bMeta.statTags?.slice(0, 1) || [],
      liveName: liveBMeta ? liveBMeta.zhName : null,
      matched,
      rect1080p: UMG_RECTS_1080P.backpack[i],
    })
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

const SAFE_PARK_X = 0.02
const SAFE_PARK_Y = 0.5

async function waitSafeOrThrow(hwnd, durationMs, checkDrift = true) {
  // 后端单次安全等待上限 6000ms：超长等待（如武器加载等待）分段执行，全程保持 ESC/F10/鼠标急停监听
  let remaining = Math.max(20, Math.round(durationMs))
  while (remaining > 0) {
    const chunk = Math.min(remaining, 5000)
    remaining -= chunk
    const res = await invokeTauri('raider_wait_safe', {
      hwnd,
      durationMs: Math.max(20, chunk),
      checkDrift,
    })
    if (!res) {
      throw new Error('安全等待指令通信失败，已安全中止')
    }
    if (res.aborted || !res.ok) {
      const err = new Error(res.reason || '已触发安全急停')
      err.aborted = Boolean(res.aborted)
      throw err
    }
  }
}

async function execSafePark(hwnd, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'park',
    normX: SAFE_PARK_X,
    normY: SAFE_PARK_Y,
    holdMs: 0,
    checkDrift,
    parkAfter: false,
  })
  if (!res) {
    throw new Error('键鼠归位指令通信失败，已安全中止')
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

async function execSafeClick(hwnd, normX, normY, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'click',
    normX,
    normY,
    holdMs: 48,
    checkDrift,
    parkAfter: false,
  })
  if (!res) {
    throw new Error('键鼠点击指令通信失败，已安全中止')
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

const CAPTURE_MAX_WIDTH = 2560

async function execSafeDrag(
  hwnd,
  fromNormX,
  fromNormY,
  toNormX,
  toNormY,
  checkDrift = true,
  holdMs = 52,
) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'drag',
    normX: fromNormX,
    normY: fromNormY,
    toNormX,
    toNormY,
    holdMs,
    checkDrift,
    parkAfter: true,
  })
  if (!res) {
    throw new Error('键鼠拖拽指令通信失败，已安全中止')
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

async function execSafeShiftClick(hwnd, normX, normY, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'shift_click',
    normX,
    normY,
    holdMs: 48,
    checkDrift,
    parkAfter: true,
  })
  if (!res) {
    throw new Error('快捷移动指令通信失败，已安全中止')
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

async function execSafeDoubleClick(hwnd, normX, normY, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'double_click',
    normX,
    normY,
    holdMs: 42,
    checkDrift,
    parkAfter: true,
  })
  if (!res) {
    throw new Error('双击装配指令通信失败，已安全中止')
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

async function execSafeScroll(hwnd, normX, normY, wheelDelta, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'scroll',
    normX,
    normY,
    wheelDelta,
    holdMs: 0,
    checkDrift,
    // 滚轮悬停点 (356, 580) 已精确落在储备箱第 1~2 列与第 2~3 行的 8px 暗缝十字中心，无需归位避免焦点跳出滚动容器
    parkAfter: false,
  })
  if (!res) {
    throw new Error('滚轮翻页指令通信失败，已安全中止')
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

const MAX_SCROLL_PAGES_DOWN = 20
const MAX_SCROLL_PAGES_UP = 22
const SCROLL_STEP_DOWN = -2040 // 向下 17 格滚轮（UE5 约跨越 5.2 行 / ~21 格，大幅提升滑动幅度并保留 ~1.25 行重叠防漏格）
const SCROLL_STEP_UP = 2160 // 向上 18 格滚轮大幅回溯

function rectCenterNorm(rect1080p, vp, W, H) {
  return {
    x: (vp.ox + (rect1080p.x + rect1080p.w * 0.5) * vp.scale) / W,
    y: (vp.oy + (rect1080p.y + rect1080p.h * 0.5) * vp.scale) / H,
  }
}

function pointNorm(pt1080p, vp, W, H) {
  return {
    x: (vp.ox + pt1080p.x * vp.scale) / W,
    y: (vp.oy + pt1080p.y * vp.scale) / H,
  }
}

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
}) {
  const hoverPt = pointNorm(UMG_RECTS_1080P.stashScrollHover, vp, W, H)
  let curImg =
    initialImageData ||
    (await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)).imageData

  // 1. 先检索当前可见页（命中则零滚动直出）
  let hit = await findTargetInStashGrid(
    curImg,
    vp,
    item.kind,
    item.targetId,
    item.targetCount || null,
    { amplified: item.amplified },
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
        item.targetCount || null,
        { amplified: item.amplified },
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
        item.targetCount || null,
        { amplified: item.amplified },
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
 * 桌面端：抓取游戏战备界面比对差量，自动执行：
 * 1) 非背包槽位：优先点击右侧目标战备栏位触发游戏原生单槽过滤（完全绕开左侧导航栏失焦限制）+ 仓库自动滚轮检索装配；
 * 2) 背包槽位：自动检测并点击背包槽/解除非背包白框锁定以恢复最左侧分类导航栏焦点，按精确分类筛选 + 滚轮翻页拖拽装配。
 */
export const DEFAULT_WEAPON_LOAD_WAIT_MS = 3000

export async function runLoadoutAutoSyncSession({
  targetLoadout,
  onProgress,
  weaponLoadWaitMs = DEFAULT_WEAPON_LOAD_WAIT_MS,
}) {
  if (!isTauriRuntime()) {
    throw new Error('仅桌面端支持自动配装，浏览器端请使用全屏透视配装指引')
  }
  // 武器缩略图为游戏实时 3D 渲染 (BP_WeaponIconCapture)，加载明显慢于普通物品：武器相关步骤统一等待该时长
  const weaponWait = Math.round(
    Math.max(0, Math.min(15000, Number(weaponLoadWaitMs) || 0)),
  )
  const stepWait = (item, normalMs) =>
    item?.kind === 'weapon' ? Math.max(normalMs, weaponWait) : normalMs

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

    onProgress?.({ progressPct: 16, message: '正在扫描当前实机战备槽位...' })
    let firstCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
    let firstRec = await recognizeLoadoutFromImageData(firstCap.imageData)
    // 武器栏已占用但缩略图仍在加载（无法识别）时，按配置等待后重扫一次
    if (
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
      firstRec = await recognizeLoadoutFromImageData(firstCap.imageData)
    }
    if (!firstRec.ok) {
      return {
        ok: false,
        message: firstRec.error || '请先在游戏内打开「仓库 / 战备」界面后再执行同步',
      }
    }

    const initialDiff = analyzeLoadoutSyncDiff(firstRec.loadout, targetLoadout)
    if (initialDiff.totalTargetSlots === 0) {
      return {
        ok: false,
        message: '目标战备为空，请先配置装备后再同步',
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

    if (!firstRec.hasStashPanel) {
      return {
        ok: true,
        inGameLoadout: firstRec.loadout,
        equippedCount: 0,
        remainingCount: initialDiff.pendingCount,
        message: `已识别差量（待装配 ${initialDiff.pendingCount} 项），当前画面无仓库栏，可开启透视指引装配`,
      }
    }

    const vp = firstRec.viewport
    const W = firstCap.imageData.width
    const H = firstCap.imageData.height

    // 装配顺序编排：
    // 1. 强化 (augment) 最优先（决定背包格数、快捷栏数、专属栏与安全口袋位置）；
    // 2. 其余非背包栏位（护盾 -> 武器 -> 快捷栏 -> 强化专属栏 -> 安全口袋），全程使用右侧目标槽原生过滤，无需依赖左侧导航栏；
    // 3. 背包栏位最后统一执行（点击背包格一次性恢复最左侧分类导航栏焦点后批量筛选拖拽入包）。
    const rawPending = initialDiff.entries.filter((e) => !e.matched)
    const pendingList = [
      ...rawPending.filter((e) => e.kind === 'augment'),
      ...rawPending.filter((e) => e.kind !== 'augment' && e.kind !== 'backpack'),
      ...rawPending.filter((e) => e.kind === 'backpack'),
    ]

    const tgtAug = augMap.get(targetLoadout?.augmentId) || augMap.get('none')
    const liveInitialAug =
      augMap.get(firstRec.loadout?.augmentId) || augMap.get('none')
    let activeAugmentInGame =
      firstRec.loadout?.augmentId === tgtAug.id ? tgtAug : liveInitialAug

    let equippedCount = 0
    let activeFilter = null
    let latestFrameImg = firstCap.imageData
    let lastNonBackpackRect = detectSelectedNonBackpackSlot1080p(
      firstCap.imageData,
      vp,
    )
    const scrollState = { atTop: false }

    for (let idx = 0; idx < pendingList.length; idx++) {
      const item = pendingList[idx]
      const stepLabel = `(${idx + 1}/${pendingList.length})`
      const pct = Math.min(92, 22 + Math.round(((idx + 1) / pendingList.length) * 68))

      // 若目标强化未能在仓库中找到并装备，按当前实机实际穿戴的强化动态校验槽位上限与安全口袋行坐标
      let slotRect1080p = item.rect1080p
      if (activeAugmentInGame && activeAugmentInGame.id !== tgtAug.id) {
        if (
          item.kind === 'backpack' &&
          item.slotIndex >= (activeAugmentInGame.backpackSlots || 10)
        ) {
          continue
        }
        if (
          item.kind === 'quickUse' &&
          item.slotIndex >= (activeAugmentInGame.quickUseSlots || 4)
        ) {
          continue
        }
        if (item.kind === 'aux' && !activeAugmentInGame.auxSlots?.count) {
          continue
        }
        if (item.kind === 'safePocket') {
          if (item.slotIndex >= (activeAugmentInGame.safePocketSlots || 0)) {
            continue
          }
          const liveHasAux = Boolean(
            activeAugmentInGame.integratedItem ||
              activeAugmentInGame.auxSlots?.count,
          )
          const liveSpRects = liveHasAux
            ? UMG_RECTS_1080P.safePocketWithAux
            : UMG_RECTS_1080P.safePocketNoAux
          slotRect1080p = liveSpRects[item.slotIndex] || slotRect1080p
        }
      }

      const dstPt = rectCenterNorm(slotRect1080p, vp, W, H)
      onProgress?.({
        progressPct: pct,
        message: `装配 ${item.slotLabel}：${item.targetName} ${stepLabel}`,
      })

      if (item.kind !== 'backpack') {
        // ==================== 分支 A：非背包栏位（原生目标槽过滤模式） ====================
        // 先确保右侧目标战备栏位处于选中态（若玩家此前已选中该格则无需重复点击，防止二次点击取消单槽过滤）
        const alreadySelected = latestFrameImg
          ? isRect1080pSelected(latestFrameImg, vp, slotRect1080p)
          : false

        let postSlotImg = latestFrameImg
        if (!alreadySelected) {
          await execSafeClick(hwnd, dstPt.x, dstPt.y)
          lastNonBackpackRect = slotRect1080p
          activeFilter = null
          scrollState.atTop = false
          if (item.kind === 'weapon' && weaponWait > 0) {
            onProgress?.({
              progressPct: pct,
              message: `等待武器列表加载 ${(weaponWait / 1000).toFixed(1)} 秒：${item.targetName} ${stepLabel}`,
            })
          }
          await waitSafeOrThrow(hwnd, stepWait(item, 165))
          await execSafePark(hwnd)
          await waitSafeOrThrow(hwnd, 75)
          postSlotImg = (
            await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
          ).imageData
          latestFrameImg = postSlotImg
        } else {
          lastNonBackpackRect = slotRect1080p
        }

        const preCheck = await verifyTargetSlotMatched(
          postSlotImg,
          vp,
          item.kind,
          slotRect1080p,
          item.targetId,
          { amplified: item.amplified },
        )
        if (preCheck.matched) {
          if (item.kind === 'augment') activeAugmentInGame = tgtAug
          continue
        }

        // 若个别槽位（如安全口袋）未锁定最左侧分类栏，则顺带点击对应分类按钮加速过滤
        if (isStashFilterRailActive(postSlotImg, vp)) {
          const filterPt = UMG_RECTS_1080P.stashFilters[item.stashFilter]
          if (filterPt) {
            const fp = pointNorm(filterPt, vp, W, H)
            if (fp.x > 0.01 && fp.x < 0.35 && fp.y > 0.1 && fp.y < 0.9) {
              await execSafeClick(hwnd, fp.x, fp.y)
              activeFilter = item.stashFilter
              scrollState.atTop = true
              await waitSafeOrThrow(hwnd, stepWait(item, 160))
              await execSafePark(hwnd)
              await waitSafeOrThrow(hwnd, 75)
              postSlotImg = null
              latestFrameImg = null
            }
          }
        }

        const found = await searchItemInStashWithScroll({
          hwnd,
          vp,
          W,
          H,
          item,
          scrollState,
          initialImageData: postSlotImg,
          basePct: pct,
          stepLabel,
          onProgress,
          settleMs: item.kind === 'weapon' ? stepWait(item, 210) : null,
        })
        if (found?.imageData) latestFrameImg = found.imageData
        if (!found?.hit) continue

        // 抓帧复核目标槽；武器栏若仍在加载实时渲染缩略图（已占用但无法识别），再等待一轮后复核
        const captureAndVerify = async () => {
          let cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
          let res = await verifyTargetSlotMatched(
            cap.imageData,
            vp,
            item.kind,
            slotRect1080p,
            item.targetId,
            { amplified: item.amplified },
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
              { amplified: item.amplified },
            )
          }
          latestFrameImg = cap.imageData
          return { cap, res }
        }

        // 策略 1（首选）：真实 MOUSEEVENTF_MOVE 平滑拖拽 (Stash 匹配格 -> 右侧指定目标战备槽)，兼容空槽与已装备槽替换
        await execSafeDrag(
          hwnd,
          found.hit.normX,
          found.hit.normY,
          dstPt.x,
          dstPt.y,
          true,
          52,
        )
        await waitSafeOrThrow(hwnd, stepWait(item, 165))

        let { cap: verifyCap, res: verifyRes } = await captureAndVerify()

        // 策略 2（重压慢拖兜底）：重新在当前储备箱画面定位物品后，加长按压与起拖时间再次精准拖拽投放
        if (!verifyRes.matched) {
          const reHit = await findTargetInStashGrid(
            verifyCap.imageData,
            vp,
            item.kind,
            item.targetId,
            item.targetCount || null,
            { amplified: item.amplified },
          )
          if (reHit) {
            await execSafeDrag(
              hwnd,
              reHit.normX,
              reHit.normY,
              dstPt.x,
              dstPt.y,
              true,
              96,
            )
            await waitSafeOrThrow(hwnd, stepWait(item, 175))
            ;({ cap: verifyCap, res: verifyRes } = await captureAndVerify())
          }
        }

        // 策略 3（原生 SHIFT 快速移动 / 双击兜底）：仅在目标槽为空或唯一单槽（强化/护盾）时启用，避免覆盖非目标槽
        if (
          !verifyRes.matched &&
          (!verifyRes.occupied || item.kind === 'augment' || item.kind === 'shield')
        ) {
          const reHit2 = await findTargetInStashGrid(
            verifyCap.imageData,
            vp,
            item.kind,
            item.targetId,
            item.targetCount || null,
            { amplified: item.amplified },
          )
          if (reHit2) {
            await execSafeShiftClick(hwnd, reHit2.normX, reHit2.normY)
            await waitSafeOrThrow(hwnd, stepWait(item, 165))
            ;({ cap: verifyCap, res: verifyRes } = await captureAndVerify())
          }
          if (!verifyRes.matched) {
            const reHit3 = await findTargetInStashGrid(
              verifyCap.imageData,
              vp,
              item.kind,
              item.targetId,
              item.targetCount || null,
              { amplified: item.amplified },
            )
            if (reHit3) {
              await execSafeDoubleClick(hwnd, reHit3.normX, reHit3.normY)
              await waitSafeOrThrow(hwnd, stepWait(item, 165))
              ;({ cap: verifyCap, res: verifyRes } = await captureAndVerify())
            }
          }
        }

        if (verifyRes.matched) {
          equippedCount++
          if (item.kind === 'augment') {
            activeAugmentInGame = tgtAug
          }
        }
      } else {
        // ==================== 分支 B：背包栏位（自动恢复左侧导航栏焦点 + 分类翻页拖拽） ====================
        const focusRes = await ensureStashFilterRailFocused({
          hwnd,
          vp,
          W,
          H,
          preferredBackpackRect1080p: slotRect1080p,
          lastNonBackpackRect1080p: lastNonBackpackRect,
        })
        if (focusRes.recovered) {
          activeFilter = null
          lastNonBackpackRect = null
          scrollState.atTop = false
        }

        const candidateFilters = [item.stashFilter || 'all']
        if (item.itemCategory === 'material' && !candidateFilters.includes('misc')) {
          candidateFilters.push('misc')
        }
        if (
          candidateFilters[0] !== 'all' &&
          ['key', 'material', 'trinket', 'gadget'].includes(item.itemCategory)
        ) {
          candidateFilters.push('all')
        }

        let found = null
        let reuseImg = focusRes.imageData
        for (const filterKey of candidateFilters) {
          const filterPt = UMG_RECTS_1080P.stashFilters[filterKey]
          if (filterPt && activeFilter !== filterKey && focusRes.focused) {
            const fp = pointNorm(filterPt, vp, W, H)
            if (fp.x > 0.01 && fp.x < 0.35 && fp.y > 0.1 && fp.y < 0.9) {
              await execSafeClick(hwnd, fp.x, fp.y)
              activeFilter = filterKey
              scrollState.atTop = true
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
            scrollState,
            initialImageData: reuseImg,
            basePct: pct,
            stepLabel,
            onProgress,
          })
          reuseImg = null
          if (found?.hit) break
        }

        if (!found?.hit) continue

        // 背包槽位采用真实 MOUSEEVENTF_MOVE 平滑拖拽 (Stash -> 指定背包格)，精准落位不打乱左侧导航栏焦点
        await execSafeDrag(
          hwnd,
          found.hit.normX,
          found.hit.normY,
          dstPt.x,
          dstPt.y,
          true,
          52,
        )
        await waitSafeOrThrow(hwnd, 165)

        let verifyCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
        let verifyRes = await verifyTargetSlotMatched(
          verifyCap.imageData,
          vp,
          item.kind,
          slotRect1080p,
          item.targetId,
          { amplified: item.amplified },
        )

        if (!verifyRes.matched) {
          const reHit = await findTargetInStashGrid(
            verifyCap.imageData,
            vp,
            item.kind,
            item.targetId,
            item.targetCount || null,
            { amplified: item.amplified },
          )
          if (reHit) {
            await execSafeDrag(
              hwnd,
              reHit.normX,
              reHit.normY,
              dstPt.x,
              dstPt.y,
              true,
              96,
            )
            await waitSafeOrThrow(hwnd, 175)
            verifyCap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
            verifyRes = await verifyTargetSlotMatched(
              verifyCap.imageData,
              vp,
              item.kind,
              slotRect1080p,
              item.targetId,
              { amplified: item.amplified },
            )
          }
        }

        if (verifyRes.matched) {
          equippedCount++
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
    const finalRec = await recognizeLoadoutFromImageData(finalCap.imageData)
    const finalLoadout = finalRec.ok ? finalRec.loadout : firstRec.loadout
    const finalDiff = analyzeLoadoutSyncDiff(finalLoadout, targetLoadout)

    const msg =
      finalDiff.pendingCount === 0
        ? `同步完成（已就绪 ${finalDiff.matchedCount}/${finalDiff.totalTargetSlots} 项）`
        : equippedCount > 0
          ? `已自动装配 ${equippedCount} 项，剩余 ${finalDiff.pendingCount} 项未在仓库中找到，可开启透视指引核对`
          : `已完成全仓滚动检索（匹配 ${finalDiff.matchedCount}/${finalDiff.totalTargetSlots} 项），缺失项不在仓库中，可开启透视指引查看`

    return {
      ok: true,
      inGameLoadout: finalLoadout,
      equippedCount,
      remainingCount: finalDiff.pendingCount,
      message: msg,
    }
  } finally {
    if (isTauriRuntime()) {
      await invokeTauri('raider_finish_sync').catch(() => {})
    }
  }
}
