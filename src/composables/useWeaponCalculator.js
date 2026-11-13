import weaponsData from '../data/weaponsData.json'
import { assetUrl } from '../utils/assetUrl'

export { assetUrl }

export const rarityMeta = {
  Common: { cn: '普通', color: '#a4a5aa' },
  Uncommon: { cn: '罕见', color: '#26bf57' },
  Rare: { cn: '稀有', color: '#00a9f2' },
  Epic: { cn: '史诗', color: '#cc3099' },
  Legendary: { cn: '传奇', color: '#ffc600' },
}

export const armorPenCnMap = {
  'Very Weak': '极弱 (20%)',
  Weak: '较弱 (40–50%)',
  Moderate: '中等 (80–100%)',
  Strong: '强力 (150–250%)',
  'Very Strong': '极强 (250–300%)',
}

export const classTabs = [
  { id: 'ALL', label: '全部' },
  { id: '突击步枪', label: '突击步枪' },
  { id: '战斗步枪', label: '战斗步枪' },
  { id: '冲锋枪', label: '冲锋枪' },
  { id: '霰弹枪', label: '霰弹枪' },
  { id: '手枪', label: '手枪' },
  { id: '手炮', label: '手炮' },
  { id: '轻机枪', label: '轻机枪' },
  { id: '狙击步枪', label: '狙击步枪' },
  { id: '特殊重武', label: '特殊重武' },
]

export const slotNormalization = {
  Muzzle: ['Muzzle'],
  'Shotgun-Muzzle': ['Shotgun Muzzle'],
  Underbarrel: ['Underbarrel'],
  'Light-Mag': ['Light Magazine'],
  'Medium-Mag': ['Medium Magazine'],
  'Heavy-Mag': ['Heavy Magazine'],
  'Shotgun-Mag': ['Shotgun Magazine'],
  Stock: ['Stock'],
}

export const slotLabels = {
  Muzzle: { name: '标准枪口', rule: '步枪/冲锋枪/手枪/狙击通用' },
  'Shotgun-Muzzle': { name: '霰弹枪口', rule: '仅限霰弹枪专属装配' },
  Underbarrel: { name: '下挂握把', rule: '仅限下挂导轨武器' },
  'Light-Mag': { name: '轻型弹匣', rule: '仅限轻型弹药武器' },
  'Medium-Mag': { name: '中型弹匣', rule: '仅限中型弹药武器' },
  'Heavy-Mag': { name: '重型弹匣', rule: '仅限重型弹药武器' },
  'Shotgun-Mag': { name: '霰弹弹匣', rule: '仅限霰弹枪专属装配' },
  Stock: { name: '战术枪托', rule: '仅限标准枪托槽武器' },
}

export const slotPlaceholderMod = {
  Muzzle: 'compensator-i',
  'Shotgun-Muzzle': 'shotgun-choke-i',
  Underbarrel: 'vertical-grip-i',
  'Light-Mag': 'extended-light-mag-i',
  'Medium-Mag': 'extended-medium-mag-i',
  'Heavy-Mag': 'extended-medium-mag-i',
  'Shotgun-Mag': 'extended-shotgun-mag-i',
  Stock: 'stable-stock-i',
}

export const gradeColors = { I: '#26bf57', II: '#00a9f2', III: '#cc3099' }

export const MOD_RARITY_BY_ID = {
  'angled-grip-i': 'Common',
  'angled-grip-ii': 'Uncommon',
  'angled-grip-iii': 'Rare',
  'compensator-i': 'Common',
  'compensator-ii': 'Uncommon',
  'compensator-iii': 'Rare',
  'extended-barrel-i': 'Uncommon',
  'extended-barrel-ii': 'Rare',
  'extended-barrel-iii': 'Epic',
  'extended-light-mag-i': 'Common',
  'extended-light-mag-ii': 'Uncommon',
  'extended-light-mag-iii': 'Rare',
  'extended-medium-mag-i': 'Common',
  'extended-medium-mag-ii': 'Uncommon',
  'extended-medium-mag-iii': 'Rare',
  'extended-shotgun-mag-i': 'Common',
  'extended-shotgun-mag-ii': 'Uncommon',
  'extended-shotgun-mag-iii': 'Rare',
  'horizontal-grip': 'Epic',
  'kinetic-converter': 'Legendary',
  'lightweight-stock': 'Epic',
  'muzzle-brake-i': 'Common',
  'muzzle-brake-ii': 'Uncommon',
  'muzzle-brake-iii': 'Rare',
  'padded-stock': 'Epic',
  'shotgun-choke-i': 'Common',
  'shotgun-choke-ii': 'Uncommon',
  'shotgun-choke-iii': 'Rare',
  'shotgun-silencer': 'Epic',
  'silencer-i': 'Uncommon',
  'silencer-ii': 'Rare',
  'silencer-iii': 'Epic',
  'stable-stock-i': 'Common',
  'stable-stock-ii': 'Uncommon',
  'stable-stock-iii': 'Rare',
  'vertical-grip-i': 'Common',
  'vertical-grip-ii': 'Uncommon',
  'vertical-grip-iii': 'Rare',
  'anvil-splitter': 'Legendary',
}

export function getModRarity(mod) {
  if (!mod) return 'Common'
  if (mod.rarity && rarityMeta[mod.rarity]) return mod.rarity
  if (mod.id && MOD_RARITY_BY_ID[mod.id]) return MOD_RARITY_BY_ID[mod.id]
  const name = mod.name || ''
  if (name.endsWith(' I')) return 'Common'
  if (name.endsWith(' II')) return 'Uncommon'
  if (name.endsWith(' III')) return 'Rare'
  return 'Epic'
}

export function getWeaponById(id) {
  return weaponsData.weapons.find((w) => w.id === id) || weaponsData.weapons[0]
}

export function getCompatibleModsForSlot(slotKey) {
  const allowed = slotNormalization[slotKey] || [slotKey]
  return (weaponsData.weaponMods || []).filter((m) => allowed.includes(m.slot))
}

export function getModById(modId) {
  if (!modId) return null
  return (weaponsData.weaponMods || []).find((m) => m.id === modId) || null
}

export function slotPlaceholderImg(slotKey) {
  return assetUrl(getModById(slotPlaceholderMod[slotKey])?.image)
}

export function modGrade(mod) {
  const m = /\s(I{1,3})$/.exec(mod?.name || '')
  return m ? m[1] : ''
}

export function modColor(mod) {
  return rarityMeta[getModRarity(mod)]?.color || '#a4a5aa'
}

export const shortAmpName = (amp) => amp?.zhName?.split(' (')[0] || amp?.name || ''

export function formatAmpTrigger(w, ampIds) {
  if (!w?.amplifications?.length) return '无可用增强'
  const active = w.amplifications.filter((a) => (ampIds || []).includes(a.id))
  if (!active.length) return '未激活'
  if (active.length === 1) return shortAmpName(active[0])
  return `${shortAmpName(active[0])} 等 ${active.length} 项`
}

const LOWER_IS_BETTER = [
  '后坐',
  '散布',
  '换弹时间',
  '恢复时间',
  '噪音',
  '耗时',
  '消耗速率',
  '拉栓时间',
]

export function effectTone(text) {
  const m = /([+-])\s?\d/.exec(text || '')
  if (!m) return 'neu'
  const head = text.slice(0, m.index)
  const lowerIsBetter = LOWER_IS_BETTER.some((k) => head.includes(k))
  return (m[1] === '+') !== lowerIsBetter ? 'pos' : 'neg'
}

export const toEffects = (list) =>
  (list || []).map((text) => ({ text, tone: effectTone(text) }))

export function pctDelta(baseVal, newVal) {
  if (!baseVal) return ''
  const diff = ((newVal - baseVal) / baseVal) * 100
  if (Math.abs(diff) < 0.4) return ''
  return `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`
}

export function deltaClass(baseVal, newVal) {
  return newVal < baseVal ? 'down' : 'up'
}

export function getLockedSlots(weapon, enabledAmpIds) {
  const locked = {}
  if (!weapon) return locked
  for (const amp of weapon.amplifications || []) {
    if (!enabledAmpIds.includes(amp.id)) continue
    for (const slotKey of amp.conflictSlots || []) {
      locked[slotKey] = amp.zhName?.split(' (')[0] || amp.name
    }
  }
  return locked
}

export function getAmpRestrictionState(weapon, amp, enabledAmpIds) {
  const isActive = enabledAmpIds.includes(amp.id)
  const ampMap = Object.fromEntries((weapon.amplifications || []).map((a) => [a.id, a]))

  const missingReqs = (amp.requiresIds || [])
    .filter((reqId) => !enabledAmpIds.includes(reqId))
    .map((reqId) => ampMap[reqId]?.zhName?.split(' (')[0] || reqId)

  const activeConflicts = (amp.conflictAmpIds || [])
    .filter((cId) => enabledAmpIds.includes(cId))
    .map((cId) => ampMap[cId]?.zhName?.split(' (')[0] || cId)

  const reqLabels = (amp.requiresIds || []).map(
    (reqId) => ampMap[reqId]?.zhName?.split(' (')[0] || reqId,
  )
  const conflictLabels = (amp.conflictAmpIds || []).map(
    (cId) => ampMap[cId]?.zhName?.split(' (')[0] || cId,
  )
  const slotLockLabels = (amp.conflictSlots || []).map((s) => slotLabels[s]?.name || s)

  return {
    isActive,
    missingReqs,
    activeConflicts,
    reqLabels,
    conflictLabels,
    slotLockLabels,
  }
}

export function applyAmpToggle(weapon, currentTier, currentAmpIds, currentMods, targetAmp) {
  let nextTier = currentTier
  let nextAmps = [...currentAmpIds]
  const nextMods = { ...currentMods }

  const idx = nextAmps.indexOf(targetAmp.id)
  if (idx >= 0) {
    const toRemove = new Set([targetAmp.id])
    let changed = true
    while (changed) {
      changed = false
      for (const a of weapon.amplifications || []) {
        if (
          nextAmps.includes(a.id) &&
          !toRemove.has(a.id) &&
          (a.requiresIds || []).some((r) => toRemove.has(r))
        ) {
          toRemove.add(a.id)
          changed = true
        }
      }
    }
    nextAmps = nextAmps.filter((id) => !toRemove.has(id))
  } else {
    const maxTier = weapon.tiers?.[weapon.tiers.length - 1]?.tier || 1
    if (nextTier < maxTier) nextTier = maxTier

    const toAdd = new Set([targetAmp.id])
    let changed = true
    while (changed) {
      changed = false
      for (const id of [...toAdd]) {
        const aObj = (weapon.amplifications || []).find((a) => a.id === id)
        for (const reqId of aObj?.requiresIds || []) {
          if (!toAdd.has(reqId)) {
            toAdd.add(reqId)
            changed = true
          }
        }
      }
    }

    const conflictsToRemove = new Set()
    for (const id of toAdd) {
      const aObj = (weapon.amplifications || []).find((a) => a.id === id)
      for (const cId of aObj?.conflictAmpIds || []) {
        conflictsToRemove.add(cId)
      }
    }
    for (const a of weapon.amplifications || []) {
      if ((a.conflictAmpIds || []).some((cId) => toAdd.has(cId))) {
        conflictsToRemove.add(a.id)
      }
    }
    changed = true
    while (changed) {
      changed = false
      for (const a of weapon.amplifications || []) {
        if (
          !conflictsToRemove.has(a.id) &&
          (a.requiresIds || []).some((r) => conflictsToRemove.has(r))
        ) {
          conflictsToRemove.add(a.id)
          changed = true
        }
      }
    }

    nextAmps = nextAmps.filter((id) => !conflictsToRemove.has(id))
    for (const id of toAdd) {
      if (!nextAmps.includes(id)) nextAmps.push(id)
    }
  }

  const locked = getLockedSlots(weapon, nextAmps)
  for (const lockedSlot of Object.keys(locked)) {
    if (nextMods[lockedSlot]) {
      delete nextMods[lockedSlot]
    }
  }

  return {
    tier: nextTier,
    ampIds: nextAmps,
    mods: nextMods,
  }
}

export function computeWeaponStats(w, tierNum, enabledAmpIds = [], modMap = {}) {
  const bs = w.baseStats || {}
  const baseDmg = Number(bs.damage) || 10
  const basePellets = Number(bs.pellets) || 1
  const perPelletBase = baseDmg / basePellets
  const baseFireRate = Number(bs.fireRate) || 15
  const baseRpm = Number(bs.rpm) || 120
  const baseHsMult = Number(bs.headshotMultiplier) || 1.5
  const baseMag = Number(bs.magazineSize) || 1
  const baseArmorMult = Number(bs.arcArmorMultiplier) || 0.5
  const baseRange = Number(bs.range) || 40
  const baseStability = Number(bs.stability) || 70
  const baseAgility = Number(bs.agility) || 55
  const baseStealth = Number(bs.stealth) || 15
  const baseDurability = Number(bs.durability) || 500

  const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
  const clampedTier = Math.min(maxTier, Math.max(1, tierNum || 1))
  const tierObj = (w.tiers || []).find((t) => t.tier === clampedTier) || w.tiers?.[0] || {}
  const tm = tierObj.modifiers || {}

  let rofMult = tm.rofMult || 1 + (Number(tierObj.rofPct) || 0) / 100
  let magBonus = Number(tm.magAdd ?? tierObj.magBonus) || 0
  let durabilityVal = Number(tierObj.durability) || baseDurability

  let vRecoilPct = Number(tm.vRecoilPct) || 0
  let hRecoilPct = Number(tm.hRecoilPct ?? tierObj.recoilReductionPct) || 0
  let recoilRecPct = Number(tm.recoilRecPct) || 0
  let dispersionPct = Number(tm.dispersionPct ?? tierObj.dispersionReductionPct) || 0
  let reloadPct = Number(tm.reloadPct ?? tierObj.reloadReductionPct) || 0
  let velocityPct = Number(tm.velocityPct ?? tierObj.velocityPct) || 0
  let rangePct = Number(tm.rangePct) || 0
  let adsPct = Number(tm.adsPct) || 0
  let equipPct = Number(tm.equipPct) || 0
  let noisePct = Number(tm.noisePct) || 0
  let durabilityBurnPct = Number(tm.durabilityBurnPct) || 0

  let dmgAdd = 0
  let projectileDmgMult = 1
  let pelletDelta = 0
  let burstAdd = 0
  let arcArmorMult = baseArmorMult
  let weakpointMult = 1
  let hsMultFactor = 1
  let shieldMult = 1
  let burnDps = 0
  let burnSec = 0
  let hasSprintShooting = false
  let firingModeAfter = w.zhMode || w.firingMode
  const activeEffectTags = []

  const validAmps = (w.amplifications || []).filter((a) => enabledAmpIds.includes(a.id))

  if (validAmps.length > 0) {
    const ampDurBonus = w.rarity === 'Legendary' ? 100 : 70
    durabilityVal += ampDurBonus
  }

  for (const amp of validAmps) {
    const m = amp.modifiers || {}
    const sName = shortAmpName(amp)
    if (m.dmgAdd) dmgAdd += m.dmgAdd
    if (m.projectileDmgMult && m.projectileDmgMult !== 1) projectileDmgMult *= m.projectileDmgMult
    if (m.pelletDelta) pelletDelta += m.pelletDelta
    if (m.burstAdd) burstAdd += m.burstAdd
    if (m.rofMult && m.rofMult !== 1) rofMult *= m.rofMult
    if (m.magAdd) magBonus += m.magAdd
    if (m.arcArmorMult && m.arcArmorMult !== 1) arcArmorMult *= m.arcArmorMult
    if (m.weakpointMult && m.weakpointMult !== 1) weakpointMult *= m.weakpointMult
    if (m.hsMultFactor && m.hsMultFactor !== 1) hsMultFactor *= m.hsMultFactor
    if (m.shieldMult && m.shieldMult !== 1) shieldMult *= m.shieldMult
    if (m.burnDps) {
      burnDps += m.burnDps
      burnSec = Math.max(burnSec, m.burnSec || 2)
    }

    vRecoilPct += m.vRecoilPct || 0
    hRecoilPct += m.hRecoilPct || 0
    recoilRecPct += m.recoilRecPct || 0
    dispersionPct += m.dispersionPct || 0
    reloadPct += m.reloadPct || 0
    velocityPct += m.velocityPct || 0
    rangePct += m.rangePct || 0
    adsPct += m.adsPct || 0
    equipPct += m.equipPct || 0
    noisePct += m.noisePct || 0
    durabilityBurnPct += m.durabilityBurnPct || 0

    if (amp.id === 'sprint-shooting') hasSprintShooting = true
    if (amp.id === 'full-auto') firingModeAfter = '全自动连发 (5级增幅)'
    else if (amp.id === 'semi-auto') firingModeAfter = '半自动速射 (5级增幅)'
    else if (amp.id === 'burst-fire') {
      firingModeAfter = burstAdd >= 4 ? '五连发点射 (5级增幅)' : '三连发点射 (5级增幅)'
    } else if (amp.id === 'charged-burst') {
      firingModeAfter = '蓄力多发齐射 (5级增幅)'
    }

    for (const zf of amp.zhEffects || []) {
      activeEffectTags.push(`${sName}：${zf}`)
    }
  }

  const lockedSlots = getLockedSlots(w, enabledAmpIds)
  const equippedModsList = []

  for (const slotKey of w.modSlots || []) {
    if (lockedSlots[slotKey]) continue
    const modId = modMap?.[slotKey]
    if (!modId) continue
    const allowedMods = getCompatibleModsForSlot(slotKey)
    const mod = allowedMods.find((m) => m.id === modId)
    if (!mod) continue

    equippedModsList.push({ slotKey, mod })
    const mm = mod.modifiers || {}
    if (mm.magAdd) magBonus += mm.magAdd
    if (mm.rofMult && mm.rofMult !== 1) rofMult *= mm.rofMult

    vRecoilPct += mm.vRecoilPct || 0
    hRecoilPct += mm.hRecoilPct || 0
    recoilRecPct += mm.recoilRecPct || 0
    dispersionPct += mm.dispersionPct || 0
    reloadPct += mm.reloadPct || 0
    velocityPct += mm.velocityPct || 0
    rangePct += mm.rangePct || 0
    adsPct += mm.adsPct || 0
    equipPct += mm.equipPct || 0
    noisePct += mm.noisePct || 0
    durabilityBurnPct += mm.durabilityBurnPct || 0

    for (const zf of mod.zhEffects || []) {
      activeEffectTags.push(`${mod.zhName}：${zf}`)
    }
  }

  const pelletCount = Math.max(1, basePellets + pelletDelta)
  const perPelletDmg = Math.max(0.5, (perPelletBase + dmgAdd / basePellets) * projectileDmgMult)
  const singleShotDmg = Math.max(1, perPelletDmg * pelletCount)

  const effectiveHsMult = Math.max(1, baseHsMult * hsMultFactor * weakpointMult)
  const baseHsDmg = baseDmg * baseHsMult
  const headshotDmg = singleShotDmg * effectiveHsMult

  const enhancedFireRate = baseFireRate * rofMult
  const enhancedRpm = baseRpm * rofMult
  const totalFireRatePct = (rofMult - 1) * 100

  const enhancedMag = Math.max(1, baseMag + magBonus)
  const burnTotalPerHit = burnDps * burnSec

  const baseRps = baseRpm / 60
  const enhancedRps = enhancedRpm / 60
  const baseBodyDps = baseDmg * baseRps
  const enhancedBodyDps = singleShotDmg * enhancedRps + burnDps

  const baseHsDps = baseHsDmg * baseRps
  const enhancedHsDps = headshotDmg * enhancedRps + burnDps

  const baseArmorDmg = baseDmg * baseArmorMult
  const enhancedArmorDmg = singleShotDmg * arcArmorMult
  const baseArmorDps = baseArmorDmg * baseRps
  const enhancedArmorDps = enhancedArmorDmg * enhancedRps + burnDps

  const enhancedShieldDmg = singleShotDmg * shieldMult
  const baseMagDamage = baseDmg * baseMag
  const enhancedMagDamage = singleShotDmg * enhancedMag

  const enhancedRange = Math.max(5, baseRange * (1 + rangePct / 100 + velocityPct * 0.0015))
  const enhancedStability = Math.min(
    100,
    Math.max(
      5,
      baseStability +
        (vRecoilPct + hRecoilPct) * 0.25 +
        dispersionPct * 0.15 +
        recoilRecPct * 0.12,
    ),
  )
  const enhancedAgility = Math.min(
    100,
    Math.max(
      5,
      baseAgility + adsPct * 0.12 + equipPct * 0.2 + (hasSprintShooting ? 12 : 0),
    ),
  )
  const enhancedStealth = Math.min(100, Math.max(1, baseStealth + noisePct * 0.8))

  const shieldTargets = [
    { id: 'none', label: '无护盾奇袭者', sub: '100 HP', ehp: 100, usesShield: false },
    { id: 'light', label: '轻型护盾', sub: '140 EHP · 40%减伤', ehp: 140, usesShield: true },
    { id: 'medium', label: '中型护盾', sub: '175 EHP · 42.5%减伤', ehp: 175, usesShield: true },
    { id: 'heavy', label: '重型护盾', sub: '210 EHP · 52.5%减伤', ehp: 210, usesShield: true },
  ]

  const ttkTable = shieldTargets.map((t) => {
    const baseHit = baseDmg
    const enhHit = t.usesShield
      ? singleShotDmg * (0.4 + 0.6 * shieldMult) + burnDps * 0.5
      : singleShotDmg + burnDps * 0.5

    const baseBtk = Math.max(1, Math.ceil(t.ehp / Math.max(1, baseHit)))
    const enhBtk = Math.max(1, Math.ceil(t.ehp / Math.max(1, enhHit)))
    const baseTtk = ((baseBtk - 1) * 60) / Math.max(1, baseRpm)
    const enhTtk = ((enhBtk - 1) * 60) / Math.max(1, enhancedRpm)

    const enhHsBtk = Math.max(1, Math.ceil(t.ehp / Math.max(1, enhHit * effectiveHsMult)))
    const enhHsTtk = ((enhHsBtk - 1) * 60) / Math.max(1, enhancedRpm)

    return {
      ...t,
      baseBtk,
      enhBtk,
      baseTtk,
      enhTtk,
      enhHsBtk,
      enhHsTtk,
    }
  })

  return {
    clampedTier,
    tierObj,
    baseDmg,
    singleShotDmg,
    perPelletDmg,
    basePellets,
    pelletCount,
    burstAdd,
    burnDps,
    burnSec,
    burnTotalPerHit,
    baseHsMult,
    effectiveHsMult,
    baseHsDmg,
    headshotDmg,
    baseFireRate,
    enhancedFireRate,
    baseRpm,
    enhancedRpm,
    baseMag,
    enhancedMag,
    baseBodyDps,
    enhancedBodyDps,
    baseHsDps,
    enhancedHsDps,
    baseArmorMult,
    arcArmorMult,
    baseArmorDmg,
    enhancedArmorDmg,
    baseArmorDps,
    enhancedArmorDps,
    shieldMult,
    enhancedShieldDmg,
    baseMagDamage,
    enhancedMagDamage,
    baseRange,
    enhancedRange,
    baseStability,
    enhancedStability,
    baseAgility,
    enhancedAgility,
    baseStealth,
    enhancedStealth,
    baseDurability,
    durabilityVal,
    durabilityBurnPct,
    totalFireRatePct,
    vRecoilPct,
    hRecoilPct,
    recoilRecPct,
    dispersionPct,
    reloadPct,
    velocityPct,
    rangePct,
    adsPct,
    equipPct,
    noisePct,
    firingModeAfter,
    activeEffectTags,
    equippedModsList,
    lockedSlots,
    ttkTable,
  }
}

export const STAT_SCALE = (() => {
  const ws = weaponsData.weapons
  const mx = (fn) => Math.max(...ws.map((w) => Number(fn(w.baseStats || {})) || 0))
  return {
    dmg: mx((b) => b.damage) * 1.2,
    rpm: mx((b) => b.rpm) * 1.2,
    dps: mx((b) => ((Number(b.damage) || 0) * (Number(b.rpm) || 0)) / 60) * 1.2,
    mag: mx((b) => b.magazineSize) * 1.2,
    range: mx((b) => b.range) * 1.2,
    dur: 1600,
  }
})()

export function buildStatRow(label, base, cur, scale, digits, unit = '') {
  const b = Math.min(1, Math.max(0, base / scale))
  const v = Math.min(1, Math.max(0, cur / scale))
  const diff = cur - base
  const changed = Math.abs(diff) >= (digits ? 0.05 : 0.5)
  return {
    label,
    cur,
    digits,
    unit,
    baseW: Math.min(b, v) * 100,
    deltaLeft: Math.min(b, v) * 100,
    deltaW: Math.abs(v - b) * 100,
    tone: !changed ? 'neu' : diff > 0 ? 'pos' : 'neg',
    diffText: changed ? `${diff > 0 ? '+' : ''}${diff.toFixed(digits)}` : '',
  }
}

export function buildStatRowsFromCalc(c) {
  if (!c) return []
  return [
    buildStatRow('单发伤害', c.baseDmg, c.singleShotDmg, STAT_SCALE.dmg, 1),
    buildStatRow('射速 (RPM)', c.baseRpm, c.enhancedRpm, STAT_SCALE.rpm, 0),
    buildStatRow('持续秒伤 (DPS)', c.baseBodyDps, c.enhancedBodyDps, STAT_SCALE.dps, 1),
    buildStatRow('弹匣容量', c.baseMag, c.enhancedMag, STAT_SCALE.mag, 0, ' 发'),
    buildStatRow('有效射程', c.baseRange, c.enhancedRange, STAT_SCALE.range, 1, ' m'),
    buildStatRow('稳定性', c.baseStability, c.enhancedStability, 100, 1),
    buildStatRow('机动性', c.baseAgility, c.enhancedAgility, 100, 1),
    buildStatRow('隐蔽性', c.baseStealth, c.enhancedStealth, 100, 0),
    buildStatRow('最大耐久', c.baseDurability, c.durabilityVal, STAT_SCALE.dur, 0),
  ]
}

export function buildHandlingItemsFromCalc(c) {
  if (!c) return []
  return [
    {
      label: '综合射速加成',
      value: `${c.totalFireRatePct > 0 ? '+' : ''}${c.totalFireRatePct.toFixed(0)}%`,
      state: c.totalFireRatePct > 0.4 ? 'pos' : c.totalFireRatePct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '垂直后坐控制',
      value: `${c.vRecoilPct > 0 ? '+' : ''}${c.vRecoilPct.toFixed(0)}%`,
      state: c.vRecoilPct > 0.4 ? 'pos' : c.vRecoilPct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '水平后坐控制',
      value: `${c.hRecoilPct > 0 ? '+' : ''}${c.hRecoilPct.toFixed(0)}%`,
      state: c.hRecoilPct > 0.4 ? 'pos' : c.hRecoilPct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '散布收敛控制',
      value: `${c.dispersionPct > 0 ? '+' : ''}${c.dispersionPct.toFixed(0)}%`,
      state: c.dispersionPct > 0.4 ? 'pos' : c.dispersionPct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '换弹速度提升',
      value: `${c.reloadPct > 0 ? '+' : ''}${c.reloadPct.toFixed(0)}%`,
      state: c.reloadPct > 0.4 ? 'pos' : c.reloadPct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '子弹初速加成',
      value: `${c.velocityPct > 0 ? '+' : ''}${c.velocityPct.toFixed(0)}%`,
      state: c.velocityPct > 0.4 ? 'pos' : c.velocityPct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '开镜/切枪机动',
      value: `${c.adsPct + c.equipPct > 0 ? '+' : ''}${(c.adsPct + c.equipPct).toFixed(0)}%`,
      state:
        c.adsPct + c.equipPct > 0.4 ? 'pos' : c.adsPct + c.equipPct < -0.4 ? 'neg' : 'neu',
    },
    {
      label: '射击噪音抑制',
      value: `${c.noisePct > 0 ? '-' : ''}${c.noisePct.toFixed(0)}%`,
      state: c.noisePct > 0.4 ? 'pos' : 'neu',
    },
  ]
}

const DIFF_DEFS = [
  ['单发伤害', 'singleShotDmg', 1],
  ['持续秒伤', 'enhancedBodyDps', 1],
  ['ARC 破甲秒伤', 'enhancedArmorDps', 1],
  ['射速 RPM', 'enhancedRpm', 0],
  ['弹匣容量', 'enhancedMag', 0],
  ['有效射程', 'enhancedRange', 1],
  ['稳定性', 'enhancedStability', 1],
  ['机动性', 'enhancedAgility', 1],
  ['隐蔽性', 'enhancedStealth', 0],
  ['换弹速度', 'reloadPct', 0, '%'],
  ['最大耐久', 'durabilityVal', 0],
]

export function diffRows(from, to) {
  return DIFF_DEFS.map(([label, key, digits, unit = '']) => {
    const a = Number(from[key]) || 0
    const b = Number(to[key]) || 0
    if (Math.abs(b - a) < (digits ? 0.05 : 0.5)) return null
    return {
      label,
      from: `${a.toFixed(digits)}${unit}`,
      to: `${b.toFixed(digits)}${unit}`,
      tone: b > a ? 'pos' : 'neg',
    }
  }).filter(Boolean)
}
