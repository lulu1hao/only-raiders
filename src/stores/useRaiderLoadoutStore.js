import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import loadoutData from '../data/raiderLoadoutData.json'
import weaponsData from '../data/weaponsData.json'
import weaponVisuals from '../data/weaponVisuals.json'
import {
  applyAmpToggle,
  assetUrl,
  computeWeaponStats,
  getCompatibleModsForSlot,
  getLockedSlots,
  getModById,
  getWeaponById,
  rarityMeta,
  resolveWeaponVisualState,
  slotLabels,
} from '../composables/useWeaponCalculator'
import { useRaiderStore } from './useRaiderStore'

const STORAGE_KEY = 'arc_raider_loadout_v1'
const SHARE_PREFIX = 'ARL.'
const MAX_BACKPACK_CAP = 24
const MAX_QUICK_CAP = 5
const MAX_AUX_CAP = 3
const MAX_SAFE_CAP = 3

const QUICK_USE_ALLOWED_CATS = ['medical', 'throwable', 'deployable', 'gadget']

const augmentMap = new Map(loadoutData.augments.map((a) => [a.id, a]))
const shieldMap = new Map(loadoutData.shields.map((s) => [s.id, s]))
const quickItemMap = new Map(loadoutData.quickUseItems.map((q) => [q.id, q]))
const weaponMap = new Map((weaponsData.weapons || []).map((w) => [w.id, w]))

function makeNullArray(len) {
  return Array.from({ length: len }, () => null)
}

function createStarterLoadout() {
  const bp = makeNullArray(MAX_BACKPACK_CAP)
  bp[0] = { itemId: 'ShotgunAmmo', count: 20 }
  bp[1] = { itemId: 'MediumAmmo', count: 80 }
  bp[2] = { itemId: 'Armorpack', count: 5 }
  bp[3] = { itemId: 'BasicStickyGrenade', count: 5 }

  return {
    augmentId: 'looting_mk2',
    shieldId: 'light',
    weapons: [
      {
        weaponId: 'il_toro',
        tier: 1,
        ampIds: [],
        mods: {
          'Shotgun-Muzzle': 'shotgun-choke-i',
        },
      },
      {
        weaponId: 'renegade',
        tier: 2,
        ampIds: [],
        mods: {
          Muzzle: 'silencer-i',
        },
      },
    ],
    backpack: bp,
    quickUse: [
      { itemId: 'HealingHoT_Small', count: 5 },
      { itemId: 'Consumable_ShieldOverTimePack', count: 5 },
      { itemId: 'AdrenalinShot', count: 5 },
      null,
      null,
    ],
    aux: [null, null, null],
    safePocket: [{ itemId: 'Defibrillator', count: 2 }, null, null],
  }
}

export function createEmptyLoadout() {
  return {
    augmentId: 'none',
    shieldId: null,
    weapons: [null, null],
    backpack: makeNullArray(MAX_BACKPACK_CAP),
    quickUse: makeNullArray(MAX_QUICK_CAP),
    aux: makeNullArray(MAX_AUX_CAP),
    safePocket: makeNullArray(MAX_SAFE_CAP),
  }
}

export function getContainerAllowedCategories(container, augObj) {
  if (container === 'backpack' || container === 'safePocket') return null
  if (container === 'quickUse') return QUICK_USE_ALLOWED_CATS
  if (container === 'aux') return augObj?.auxSlots?.allowedCategories || []
  return null
}

export function getContainerCapacity(container, augObj) {
  if (!augObj) return 0
  if (container === 'backpack') return augObj.backpackSlots || 10
  if (container === 'quickUse') return augObj.quickUseSlots || 4
  if (container === 'aux') return augObj.auxSlots?.count || 0
  if (container === 'safePocket') return augObj.safePocketSlots || 0
  return 0
}

function sanitizeWeaponEntry(raw) {
  if (!raw || !raw.weaponId || !weaponMap.has(raw.weaponId)) return null
  const w = weaponMap.get(raw.weaponId)
  const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
  let tier = Math.max(1, Math.min(maxTier, Math.round(Number(raw.tier) || 1)))
  const validAmpSet = new Set((w.amplifications || []).map((a) => a.id))
  const ampIds = Array.isArray(raw.ampIds)
    ? raw.ampIds.filter((id) => validAmpSet.has(id))
    : []
  // 增强型武器（游戏内 Ascended 变体，可无额外增强项）：恒为满级
  const amplified = raw.amplified === true || ampIds.length > 0
  if (amplified && tier < maxTier) tier = maxTier

  const locked = getLockedSlots(w, ampIds)
  const mods = {}
  if (raw.mods && typeof raw.mods === 'object') {
    for (const slotKey of w.modSlots || []) {
      if (locked[slotKey]) continue
      const modId = raw.mods[slotKey]
      if (!modId) continue
      const compat = getCompatibleModsForSlot(slotKey)
      if (compat.some((m) => m.id === modId)) {
        mods[slotKey] = modId
      }
    }
  }
  return amplified && ampIds.length === 0
    ? { weaponId: w.id, tier, ampIds, mods, amplified: true }
    : { weaponId: w.id, tier, ampIds, mods }
}

function sanitizeItemStack(raw, allowedCategories = null) {
  if (!raw || !raw.itemId || !quickItemMap.has(raw.itemId)) return null
  const item = quickItemMap.get(raw.itemId)
  if (Array.isArray(allowedCategories) && !allowedCategories.includes(item.category)) {
    return null
  }
  const count = Math.max(1, Math.min(item.maxStack || 1, Math.round(Number(raw.count) || 1)))
  return { itemId: item.id, count }
}

export function sanitizeLoadoutState(raw) {
  if (!raw || typeof raw !== 'object') return createEmptyLoadout()
  const augmentId = augmentMap.has(raw.augmentId) ? raw.augmentId : 'none'
  const aug = augmentMap.get(augmentId)

  let shieldId = raw.shieldId && shieldMap.has(raw.shieldId) ? raw.shieldId : null
  if (shieldId && !aug.allowedShields.includes(shieldId)) {
    shieldId = aug.maxShieldTier || 'light'
  }

  const rawWeapons = Array.isArray(raw.weapons) ? raw.weapons : []
  const weapons = [sanitizeWeaponEntry(rawWeapons[0]), sanitizeWeaponEntry(rawWeapons[1])]

  const bpCap = aug.backpackSlots || 10
  const rawBp = Array.isArray(raw.backpack) ? raw.backpack : []
  const backpack = Array.from({ length: MAX_BACKPACK_CAP }, (_, idx) =>
    idx < bpCap ? sanitizeItemStack(rawBp[idx], null) : null,
  )

  const hasExplicitQuCap =
    typeof raw.quickUseSlotCap === 'number' && Number.isFinite(raw.quickUseSlotCap)
  const quCap = hasExplicitQuCap
    ? Math.max(4, Math.min(MAX_QUICK_CAP, Math.round(raw.quickUseSlotCap)))
    : aug.quickUseSlots || 4
  const rawQu = Array.isArray(raw.quickUse) ? raw.quickUse : []
  const quickUse = Array.from({ length: MAX_QUICK_CAP }, (_, idx) =>
    idx < quCap ? sanitizeItemStack(rawQu[idx], QUICK_USE_ALLOWED_CATS) : null,
  )

  const auxAllowed = aug.auxSlots?.allowedCategories || null
  const auxCap = aug.auxSlots?.count || 0
  const rawAux = Array.isArray(raw.aux) ? raw.aux : []
  const aux = Array.from({ length: MAX_AUX_CAP }, (_, idx) =>
    idx < auxCap && auxAllowed ? sanitizeItemStack(rawAux[idx], auxAllowed) : null,
  )

  const spCap = aug.safePocketSlots || 0
  const rawSp = Array.isArray(raw.safePocket) ? raw.safePocket : []
  const safePocket = Array.from({ length: MAX_SAFE_CAP }, (_, idx) =>
    idx < spCap ? sanitizeItemStack(rawSp[idx], null) : null,
  )

  const result = {
    augmentId,
    shieldId,
    weapons,
    backpack,
    quickUse,
    aux,
    safePocket,
  }
  if (hasExplicitQuCap) {
    result.quickUseSlotCap = quCap
  }
  if (raw._quickUseOnly === true) {
    result._quickUseOnly = true
  }
  return result
}

function cloneLoadout(l) {
  return sanitizeLoadoutState(JSON.parse(JSON.stringify(l || createEmptyLoadout())))
}

function loadPersisted() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

export const useRaiderLoadoutStore = defineStore('raiderLoadout', () => {
  const persisted = loadPersisted()
  const raiderStore = useRaiderStore()

  const currentLoadout = ref(
    persisted?.currentLoadout
      ? sanitizeLoadoutState(persisted.currentLoadout)
      : createStarterLoadout(),
  )
  const linkSkillTree = ref(persisted?.linkSkillTree !== false)
  const savedLoadouts = ref(Array.isArray(persisted?.savedLoadouts) ? persisted.savedLoadouts : [])

  // UI Selection state: which slot is focused for the right-hand picker
  // kind: 'augment' | 'shield' | 'weapon' | 'backpack' | 'quickUse' | 'aux' | 'safePocket'
  const selectedSlot = ref({
    kind: 'weapon',
    index: 0,
    subMode: 'weapon', // 'weapon' | 'mod' | 'amp'
    modSlotKey: null,
    seq: 1,
  })

  const toast = ref(null)
  let toastTimer = null
  function notify(msg, tone = 'info') {
    toast.value = { msg, tone, ts: Date.now() }
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = null
    }, 2400)
  }

  function buildPersistPayload() {
    return {
      currentLoadout: currentLoadout.value,
      linkSkillTree: linkSkillTree.value,
      savedLoadouts: savedLoadouts.value,
    }
  }

  function flushPersistence() {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistPayload()))
    } catch {
      // ignore storage quota errors
    }
  }

  watch(
    [currentLoadout, linkSkillTree, savedLoadouts],
    () => {
      flushPersistence()
    },
    { deep: true },
  )

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue || e.newValue === e.oldValue) return
      try {
        const parsed = JSON.parse(e.newValue)
        if (parsed?.currentLoadout) {
          const next = sanitizeLoadoutState(parsed.currentLoadout)
          if (JSON.stringify(currentLoadout.value) !== JSON.stringify(next)) {
            currentLoadout.value = next
          }
        }
        if (typeof parsed?.linkSkillTree === 'boolean') {
          linkSkillTree.value = parsed.linkSkillTree
        }
        if (Array.isArray(parsed?.savedLoadouts)) {
          if (JSON.stringify(savedLoadouts.value) !== JSON.stringify(parsed.savedLoadouts)) {
            savedLoadouts.value = parsed.savedLoadouts
          }
        }
      } catch {
        // ignore malformed json
      }
    })
  }

  /* =========================================================================
     Computed Lookups & Views
     ========================================================================= */
  const activeAugment = computed(
    () => augmentMap.get(currentLoadout.value.augmentId) || augmentMap.get('none'),
  )

  const activeShield = computed(() =>
    currentLoadout.value.shieldId ? shieldMap.get(currentLoadout.value.shieldId) || null : null,
  )

  const skillSynergy = computed(() => {
    const allocs = raiderStore.currentBuild?.allocations || {}
    const broadPts = Number(allocs['broad-shoulders'] || 0)
    const loadedArmsPts = Number(allocs['loaded-arms'] || 0)
    const usedToWeightPts = Number(allocs['used-to-the-weight'] || 0)

    const bonusWeightKg = linkSkillTree.value ? broadPts * 2 : 0
    const weaponWeightMult = linkSkillTree.value && loadedArmsPts > 0 ? 0.5 : 1
    const shieldPenaltyMult = linkSkillTree.value && usedToWeightPts > 0 ? 0.5 : 1

    const activePerks = []
    if (broadPts > 0) activePerks.push(`阔肩 +${broadPts * 2}kg`)
    if (loadedArmsPts > 0) activePerks.push('武器减负 -50%')
    if (usedToWeightPts > 0) activePerks.push('负重如常 -50%')

    return {
      broadPts,
      loadedArmsPts,
      usedToWeightPts,
      bonusWeightKg,
      weaponWeightMult,
      shieldPenaltyMult,
      activePerks,
      hasAnyPerkInTree: broadPts > 0 || loadedArmsPts > 0 || usedToWeightPts > 0,
    }
  })

  const weaponDetails = computed(() =>
    [0, 1].map((idx) => {
      const entry = currentLoadout.value.weapons[idx]
      if (!entry) return null
      const weapon = getWeaponById(entry.weaponId)
      if (!weapon) return null
      const calc = computeWeaponStats(weapon, entry.tier, entry.ampIds, entry.mods)
      const lockedSlots = getLockedSlots(weapon, entry.ampIds)
      const tierObj =
        (weapon.tiers || []).find((t) => t.tier === entry.tier) || weapon.tiers?.[0] || {}

      let modsWeight = 0
      for (const slotKey of weapon.modSlots || []) {
        if (lockedSlots[slotKey]) continue
        const mId = entry.mods?.[slotKey]
        if (mId) modsWeight += Number(loadoutData.modWeights?.[mId] || 0.5)
      }
      const baseGunWeight = Number(weapon.baseStats?.weight || 0)
      const effectiveGunWeight =
        baseGunWeight * skillSynergy.value.weaponWeightMult + modsWeight

      const ammoHudMap = loadoutData.slotIcons?.ammoHud || {}
      const ammoIcon =
        ammoHudMap[weapon.zhAmmo] ||
        ammoHudMap[weapon.ammo] ||
        '/items/T_UI_Ammo_Medium.png'

      const durabilityMax = 100 + ((entry.tier || 1) - 1) * 10
      const ascVis = weaponVisuals.weapons?.[weapon.id]?.ascended || null
      const hasAscendedVariant = Boolean(ascVis || weapon.amplifications?.length)
      const amplified = entry.amplified === true || (entry.ampIds?.length || 0) > 0
      const effectiveAmps = entry.ampIds?.length ? entry.ampIds : amplified ? ['__asc__'] : []
      const visState = resolveWeaponVisualState(weapon, entry.tier || 1, effectiveAmps)
      const displayImage = visState.hdImage || (amplified && ascVis?.image) || weapon.image
      const displayRarity = visState.displayRarity

      return {
        index: idx,
        entry,
        weapon,
        calc,
        lockedSlots,
        roman: tierObj.roman || 'I',
        ammoIcon,
        durabilityMax,
        baseGunWeight,
        modsWeight,
        slotWeight: +effectiveGunWeight.toFixed(2),
        amplified,
        hasAscendedVariant,
        displayImage,
        displayRarity,
      }
    }),
  )

  function buildContainerView(containerKey, count, extraProps = {}) {
    const arr = currentLoadout.value[containerKey] || []
    return Array.from({ length: count }, (_, idx) => {
      const raw = arr[idx]
      const item = raw?.itemId ? quickItemMap.get(raw.itemId) || null : null
      return {
        container: containerKey,
        index: idx,
        stack: item ? raw.count : 0,
        item,
        weight: item ? +(item.weight * raw.count).toFixed(2) : 0,
        ...extraProps,
      }
    })
  }

  const backpackSlotsView = computed(() =>
    buildContainerView('backpack', activeAugment.value.backpackSlots || 10),
  )

  const quickUseSlotsView = computed(() =>
    buildContainerView('quickUse', activeAugment.value.quickUseSlots || 4),
  )

  const auxSlotsView = computed(() => {
    const spec = activeAugment.value.auxSlots
    if (!spec || !spec.count) return []
    return buildContainerView('aux', spec.count, { spec })
  })

  const safePocketSlotsView = computed(() =>
    buildContainerView('safePocket', activeAugment.value.safePocketSlots || 0),
  )

  const loadoutSummary = computed(() => {
    const aug = activeAugment.value
    const sh = activeShield.value
    const syn = skillSynergy.value

    const augWeight = Number(aug.weight || 0)
    const shieldWeight = sh ? Number(sh.weight || 0) : 0
    const weaponsWeight = weaponDetails.value.reduce((acc, w) => acc + (w?.slotWeight || 0), 0)
    const bpWeight = backpackSlotsView.value.reduce((acc, s) => acc + s.weight, 0)
    const quWeight = quickUseSlotsView.value.reduce((acc, s) => acc + s.weight, 0)
    const auxWeight = auxSlotsView.value.reduce((acc, s) => acc + s.weight, 0)
    const spWeight = safePocketSlotsView.value.reduce((acc, s) => acc + s.weight, 0)

    const totalWeight = +(
      augWeight +
      shieldWeight +
      weaponsWeight +
      bpWeight +
      quWeight +
      auxWeight +
      spWeight
    ).toFixed(1)
    const baseMaxWeight = Number(aug.maxWeight || 35)
    const maxWeight = baseMaxWeight + syn.bonusWeightKg
    const weightPct = maxWeight > 0 ? Math.min(100, Math.round((totalWeight / maxWeight) * 100)) : 0
    const overweight = totalWeight > maxWeight

    return {
      totalWeight,
      baseMaxWeight,
      maxWeight,
      weightPct,
      overweight,
    }
  })

  /* =========================================================================
     Slot Selection & Mutation Actions
     ========================================================================= */
  function selectSlot(spec) {
    selectedSlot.value = {
      kind: spec.kind || 'augment',
      index: spec.index ?? 0,
      subMode: spec.subMode || 'weapon',
      modSlotKey: spec.modSlotKey || null,
      seq: (selectedSlot.value.seq || 0) + 1,
    }
  }

  function canContainerAcceptItem(container, itemOrId, augObj = activeAugment.value) {
    const item = typeof itemOrId === 'string' ? quickItemMap.get(itemOrId) : itemOrId
    if (!item) return false
    const cap = getContainerCapacity(container, augObj)
    if (cap <= 0) return false
    const allowed = getContainerAllowedCategories(container, augObj)
    if (!allowed) return true
    return allowed.includes(item.category)
  }

  function setAugment(augmentId) {
    if (!augmentMap.has(augmentId)) return
    const nextAug = augmentMap.get(augmentId)
    const prev = currentLoadout.value

    let nextShield = prev.shieldId
    let shieldAdjusted = false
    if (nextShield && !nextAug.allowedShields.includes(nextShield)) {
      nextShield = nextAug.maxShieldTier || 'light'
      shieldAdjusted = true
    }

    // Preserve overflow items from shrinking containers into available backpack slots
    const nextBpCap = nextAug.backpackSlots || 10
    const nextQuCap = nextAug.quickUseSlots || 4
    const nextAuxCap = nextAug.auxSlots?.count || 0
    const nextAuxAllowed = nextAug.auxSlots?.allowedCategories || []
    const nextSpCap = nextAug.safePocketSlots || 0

    const bpDraft = Array.from({ length: MAX_BACKPACK_CAP }, (_, i) =>
      i < nextBpCap ? prev.backpack?.[i] || null : null,
    )
    const overflowItems = []
    for (let i = nextBpCap; i < MAX_BACKPACK_CAP; i++) {
      if (prev.backpack?.[i]) overflowItems.push(prev.backpack[i])
    }

    const quDraft = Array.from({ length: MAX_QUICK_CAP }, (_, i) => {
      const it = prev.quickUse?.[i] || null
      if (!it) return null
      if (i < nextQuCap) return it
      overflowItems.push(it)
      return null
    })

    const auxDraft = Array.from({ length: MAX_AUX_CAP }, (_, i) => {
      const it = prev.aux?.[i] || null
      if (!it) return null
      const meta = quickItemMap.get(it.itemId)
      if (i < nextAuxCap && meta && nextAuxAllowed.includes(meta.category)) {
        return it
      }
      overflowItems.push(it)
      return null
    })

    const spDraft = Array.from({ length: MAX_SAFE_CAP }, (_, i) => {
      const it = prev.safePocket?.[i] || null
      if (!it) return null
      if (i < nextSpCap) return it
      overflowItems.push(it)
      return null
    })

    for (const ov of overflowItems) {
      const emptyIdx = bpDraft.findIndex((cell, idx) => idx < nextBpCap && !cell)
      if (emptyIdx >= 0) bpDraft[emptyIdx] = ov
    }

    currentLoadout.value = sanitizeLoadoutState({
      ...prev,
      augmentId,
      shieldId: nextShield,
      backpack: bpDraft,
      quickUse: quDraft,
      aux: auxDraft,
      safePocket: spDraft,
    })

    // Ensure selectedSlot stays in bounds
    const curKind = selectedSlot.value.kind
    if (['backpack', 'quickUse', 'aux', 'safePocket'].includes(curKind)) {
      const cap = getContainerCapacity(curKind, nextAug)
      if (cap <= 0) {
        selectSlot({ kind: 'augment' })
      } else if (selectedSlot.value.index >= cap) {
        selectSlot({ kind: curKind, index: 0 })
      }
    }

    if (shieldAdjusted) {
      const shObj = shieldMap.get(nextShield)
      notify(`护盾已适配为「${shObj?.zhName || nextShield}」`, 'info')
    }
  }

  function setShield(shieldId) {
    if (!shieldId) {
      currentLoadout.value.shieldId = null
      return
    }
    if (!shieldMap.has(shieldId)) return
    const aug = activeAugment.value
    if (!aug.allowedShields.includes(shieldId)) {
      notify(`当前强化仅支持：${aug.shieldLabel}`, 'warn')
      return
    }
    currentLoadout.value.shieldId = shieldId
  }

  function setWeapon(slotIndex, weaponId) {
    const idx = slotIndex === 1 ? 1 : 0
    if (!weaponId) {
      currentLoadout.value.weapons[idx] = null
      return
    }
    const w = weaponMap.get(weaponId)
    if (!w) return
    const prev = currentLoadout.value.weapons[idx]
    if (prev?.weaponId === weaponId) return
    const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
    currentLoadout.value.weapons[idx] = {
      weaponId: w.id,
      tier: maxTier,
      ampIds: [],
      mods: {},
    }
  }

  function swapWeapons() {
    const [w0, w1] = currentLoadout.value.weapons
    currentLoadout.value.weapons = [w1, w0]
    if (selectedSlot.value.kind === 'weapon') {
      selectSlot({
        ...selectedSlot.value,
        index: selectedSlot.value.index === 0 ? 1 : 0,
      })
    }
  }

  function moveOrSwapWeapons(fromIdx, toIdx) {
    const a = fromIdx === 1 ? 1 : 0
    const b = toIdx === 1 ? 1 : 0
    if (a === b) return false
    const next = [...currentLoadout.value.weapons]
    const tmp = next[a]
    next[a] = next[b]
    next[b] = tmp
    currentLoadout.value.weapons = next
    selectSlot({
      kind: 'weapon',
      index: b,
      subMode: 'weapon',
      modSlotKey: null,
    })
    return true
  }

  function setWeaponTier(slotIndex, tierNum) {
    const idx = slotIndex === 1 ? 1 : 0
    const entry = currentLoadout.value.weapons[idx]
    if (!entry) return
    const w = weaponMap.get(entry.weaponId)
    if (!w) return
    const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
    const nextTier = Math.max(1, Math.min(maxTier, Number(tierNum) || 1))
    const nextAmps = nextTier < maxTier ? [] : entry.ampIds
    currentLoadout.value.weapons[idx] = sanitizeWeaponEntry({
      ...entry,
      tier: nextTier,
      ampIds: nextAmps,
      amplified: nextTier < maxTier ? false : entry.amplified,
    })
  }

  function cycleWeaponTier(slotIndex) {
    const idx = slotIndex === 1 ? 1 : 0
    const entry = currentLoadout.value.weapons[idx]
    if (!entry) return
    const w = weaponMap.get(entry.weaponId)
    if (!w) return
    const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
    if (maxTier <= 1) return
    const nextTier = entry.tier >= maxTier ? 1 : entry.tier + 1
    setWeaponTier(idx, nextTier)
  }

  function setWeaponMod(slotIndex, modSlotKey, modId) {
    const idx = slotIndex === 1 ? 1 : 0
    const entry = currentLoadout.value.weapons[idx]
    if (!entry) return false
    const w = weaponMap.get(entry.weaponId)
    if (!w || !(w.modSlots || []).includes(modSlotKey)) return false
    const locked = getLockedSlots(w, entry.ampIds)
    if (locked[modSlotKey]) {
      notify(`槽位已被 5级增强「${locked[modSlotKey]}」锁定`, 'warn')
      return false
    }
    if (modId) {
      const compat = getCompatibleModsForSlot(modSlotKey)
      if (!compat.some((m) => m.id === modId)) {
        notify('该配件不适配当前武器槽位', 'warn')
        return false
      }
    }
    const nextMods = { ...(entry.mods || {}) }
    if (!modId) {
      delete nextMods[modSlotKey]
    } else {
      nextMods[modSlotKey] = modId
    }
    currentLoadout.value.weapons[idx] = {
      ...entry,
      mods: nextMods,
    }
    return true
  }

  function moveOrSwapWeaponMods(srcWeaponIdx, srcSlotKey, dstWeaponIdx, dstSlotKey) {
    if (srcWeaponIdx === dstWeaponIdx && srcSlotKey === dstSlotKey) return false
    const srcEntry = currentLoadout.value.weapons[srcWeaponIdx]
    const dstEntry = currentLoadout.value.weapons[dstWeaponIdx]
    if (!srcEntry || !dstEntry) return false
    const srcModId = srcEntry.mods?.[srcSlotKey]
    if (!srcModId) return false

    const dstW = weaponMap.get(dstEntry.weaponId)
    const srcW = weaponMap.get(srcEntry.weaponId)
    if (!dstW || !srcW) return false
    const dstLocked = getLockedSlots(dstW, dstEntry.ampIds)
    const srcLocked = getLockedSlots(srcW, srcEntry.ampIds)
    if (dstLocked[dstSlotKey] || srcLocked[srcSlotKey]) return false

    const dstCompat = getCompatibleModsForSlot(dstSlotKey)
    if (!dstCompat.some((m) => m.id === srcModId)) {
      notify('配件类型与目标槽位不匹配', 'warn')
      return false
    }

    const dstModId = dstEntry.mods?.[dstSlotKey] || null
    if (dstModId) {
      const srcCompat = getCompatibleModsForSlot(srcSlotKey)
      if (!srcCompat.some((m) => m.id === dstModId)) {
        notify('无法互换不同规格配件', 'warn')
        return false
      }
    }

    const nextWeapons = [...currentLoadout.value.weapons]
    const nextSrcMods = { ...(srcEntry.mods || {}) }
    if (dstModId) nextSrcMods[srcSlotKey] = dstModId
    else delete nextSrcMods[srcSlotKey]

    const nextDstMods = { ...(dstEntry.mods || {}) }
    nextDstMods[dstSlotKey] = srcModId

    nextWeapons[srcWeaponIdx] = { ...srcEntry, mods: nextSrcMods }
    nextWeapons[dstWeaponIdx] = { ...dstEntry, mods: nextDstMods }
    currentLoadout.value.weapons = nextWeapons
    return true
  }

  function toggleWeaponAmp(slotIndex, ampObj) {
    const idx = slotIndex === 1 ? 1 : 0
    const entry = currentLoadout.value.weapons[idx]
    if (!entry || !ampObj) return
    const w = weaponMap.get(entry.weaponId)
    if (!w) return
    const res = applyAmpToggle(w, entry.tier, entry.ampIds || [], entry.mods || {}, ampObj)
    currentLoadout.value.weapons[idx] = sanitizeWeaponEntry({
      ...entry,
      tier: res.tier,
      ampIds: res.ampIds,
      mods: res.mods,
      amplified: res.ampIds.length > 0,
    })
  }

  function setWeaponAmplified(slotIndex, enable) {
    const idx = slotIndex === 1 ? 1 : 0
    const entry = currentLoadout.value.weapons[idx]
    if (!entry) return
    const w = weaponMap.get(entry.weaponId)
    if (!w) return
    const ascVis = weaponVisuals.weapons?.[w.id]?.ascended
    if (enable && !ascVis && !(w.amplifications?.length > 0)) return
    const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
    currentLoadout.value.weapons[idx] = sanitizeWeaponEntry({
      ...entry,
      tier: enable ? maxTier : entry.tier,
      ampIds: enable ? entry.ampIds || [] : [],
      amplified: Boolean(enable),
    })
  }

  function setContainerItem(container, slotIndex, itemId, customCount = null, autoAdvance = true) {
    if (!['backpack', 'quickUse', 'aux', 'safePocket'].includes(container)) return false
    const cap = getContainerCapacity(container, activeAugment.value)
    if (slotIndex < 0 || slotIndex >= cap) return false

    if (!itemId) {
      currentLoadout.value[container][slotIndex] = null
      return true
    }

    const item = quickItemMap.get(itemId)
    if (!item || !canContainerAcceptItem(container, item)) {
      if (container === 'aux') {
        notify(`该强化栏位仅限放入：${activeAugment.value.auxSlots?.label || '指定道具'}`, 'warn')
      } else if (container === 'quickUse') {
        notify('快速使用栏仅限放入医疗、投掷、陷阱或战术工具', 'warn')
      }
      return false
    }

    const count =
      customCount !== null
        ? Math.max(1, Math.min(item.maxStack || 1, Math.round(Number(customCount) || 1)))
        : item.maxStack || 1

    currentLoadout.value[container][slotIndex] = { itemId: item.id, count }

    if (autoAdvance) {
      const nextEmpty = currentLoadout.value[container].findIndex(
        (s, i) => i > slotIndex && i < cap && !s,
      )
      if (nextEmpty >= 0) {
        selectSlot({ kind: container, index: nextEmpty })
      }
    }
    return true
  }

  function adjustContainerCount(container, slotIndex, delta) {
    if (!['backpack', 'quickUse', 'aux', 'safePocket'].includes(container)) return
    const raw = currentLoadout.value[container]?.[slotIndex]
    if (!raw) return
    const item = quickItemMap.get(raw.itemId)
    if (!item) return
    const next = raw.count + delta
    if (next <= 0) {
      currentLoadout.value[container][slotIndex] = null
    } else {
      currentLoadout.value[container][slotIndex] = {
        ...raw,
        count: Math.min(item.maxStack || 1, next),
      }
    }
  }

  function setQuickUseItem(slotIndex, itemId, customCount = null) {
    return setContainerItem('quickUse', slotIndex, itemId, customCount)
  }

  function adjustQuickUseCount(slotIndex, delta) {
    adjustContainerCount('quickUse', slotIndex, delta)
  }

  function setAuxItem(slotIndex, itemId, customCount = null) {
    return setContainerItem('aux', slotIndex, itemId, customCount)
  }

  function adjustAuxCount(slotIndex, delta) {
    adjustContainerCount('aux', slotIndex, delta)
  }

  function canMoveOrSwapItems(srcContainer, srcIdx, dstContainer, dstIdx) {
    if (!['backpack', 'quickUse', 'aux', 'safePocket'].includes(srcContainer)) return false
    if (!['backpack', 'quickUse', 'aux', 'safePocket'].includes(dstContainer)) return false
    if (srcContainer === dstContainer && srcIdx === dstIdx) return false

    const aug = activeAugment.value
    const srcCap = getContainerCapacity(srcContainer, aug)
    const dstCap = getContainerCapacity(dstContainer, aug)
    if (srcIdx < 0 || srcIdx >= srcCap || dstIdx < 0 || dstIdx >= dstCap) return false

    const srcRaw = currentLoadout.value[srcContainer]?.[srcIdx]
    if (!srcRaw?.itemId) return false
    const srcItem = quickItemMap.get(srcRaw.itemId)
    if (!srcItem || !canContainerAcceptItem(dstContainer, srcItem, aug)) return false

    const dstRaw = currentLoadout.value[dstContainer]?.[dstIdx]
    if (!dstRaw?.itemId) return true
    if (dstRaw.itemId === srcRaw.itemId) return true

    const dstItem = quickItemMap.get(dstRaw.itemId)
    if (!dstItem) return true
    if (canContainerAcceptItem(srcContainer, dstItem, aug)) return true

    // Allow displaced item to shift into an empty backpack slot if dstContainer is backpack/safePocket
    const bpCap = getContainerCapacity('backpack', aug)
    const hasEmptyBp = currentLoadout.value.backpack.some(
      (cell, idx) => idx < bpCap && !cell && !(dstContainer === 'backpack' && idx === dstIdx),
    )
    return hasEmptyBp
  }

  function moveOrSwapItems(srcContainer, srcIdx, dstContainer, dstIdx) {
    if (srcContainer === dstContainer && srcIdx === dstIdx) return false
    const aug = activeAugment.value
    const srcRaw = currentLoadout.value[srcContainer]?.[srcIdx]
    if (!srcRaw?.itemId) return false
    const srcItem = quickItemMap.get(srcRaw.itemId)
    if (!srcItem) return false

    if (!canContainerAcceptItem(dstContainer, srcItem, aug)) {
      notify('目标栏位不支持放入该类型道具', 'warn')
      return false
    }

    const dstRaw = currentLoadout.value[dstContainer]?.[dstIdx]

    // 1. Move to empty slot
    if (!dstRaw?.itemId) {
      currentLoadout.value[dstContainer][dstIdx] = { ...srcRaw }
      currentLoadout.value[srcContainer][srcIdx] = null
      selectSlot({ kind: dstContainer, index: dstIdx })
      return true
    }

    // 2. Stack merge if identical item and target stack has room
    const maxStack = srcItem.maxStack || 1
    if (dstRaw.itemId === srcRaw.itemId && dstRaw.count < maxStack) {
      const add = Math.min(maxStack - dstRaw.count, srcRaw.count)
      currentLoadout.value[dstContainer][dstIdx] = {
        itemId: dstRaw.itemId,
        count: dstRaw.count + add,
      }
      const rem = srcRaw.count - add
      currentLoadout.value[srcContainer][srcIdx] =
        rem > 0 ? { itemId: srcRaw.itemId, count: rem } : null
      selectSlot({ kind: dstContainer, index: dstIdx })
      return true
    }

    // 3. Direct position swap if reverse item is compatible with srcContainer
    const dstItem = quickItemMap.get(dstRaw.itemId)
    if (!dstItem || canContainerAcceptItem(srcContainer, dstItem, aug)) {
      currentLoadout.value[dstContainer][dstIdx] = { ...srcRaw }
      currentLoadout.value[srcContainer][srcIdx] = { ...dstRaw }
      selectSlot({ kind: dstContainer, index: dstIdx })
      return true
    }

    // 4. Fallback: relocate dstRaw to first empty backpack slot
    const bpCap = getContainerCapacity('backpack', aug)
    const emptyBpIdx = currentLoadout.value.backpack.findIndex(
      (cell, idx) => idx < bpCap && !cell && !(dstContainer === 'backpack' && idx === dstIdx),
    )
    if (emptyBpIdx >= 0) {
      currentLoadout.value.backpack[emptyBpIdx] = { ...dstRaw }
      currentLoadout.value[dstContainer][dstIdx] = { ...srcRaw }
      currentLoadout.value[srcContainer][srcIdx] = null
      selectSlot({ kind: dstContainer, index: dstIdx })
      return true
    }

    notify('原栏位不支持互换该道具', 'warn')
    return false
  }

  function clearLoadout() {
    currentLoadout.value = createEmptyLoadout()
    selectSlot({ kind: 'augment' })
    notify('战备已清空', 'info')
  }

  /* =========================================================================
     Custom Saves, Share Code & Recognition Apply
     ========================================================================= */
  function saveCustomLoadout(nameInput) {
    const name = String(nameInput || '').trim() || `战备方案 ${savedLoadouts.value.length + 1}`
    const entry = {
      id: `ld_${Date.now().toString(36)}`,
      name: name.slice(0, 24),
      savedAt: Date.now(),
      loadout: cloneLoadout(currentLoadout.value),
    }
    savedLoadouts.value = [entry, ...savedLoadouts.value].slice(0, 12)
    notify(`已保存「${entry.name}」`, 'ok')
    return entry
  }

  function loadCustomLoadout(saveId) {
    const target = savedLoadouts.value.find((s) => s.id === saveId)
    if (!target) return false
    currentLoadout.value = cloneLoadout(target.loadout)
    notify(`已载入「${target.name}」`, 'ok')
    return true
  }

  function deleteCustomLoadout(saveId) {
    savedLoadouts.value = savedLoadouts.value.filter((s) => s.id !== saveId)
  }

  function encodeLoadoutToShareCode(loadoutObj = currentLoadout.value) {
    const l = sanitizeLoadoutState(loadoutObj)
    const sparseBp = []
    l.backpack.forEach((cell, idx) => {
      if (cell?.itemId) sparseBp.push([idx, cell.itemId, cell.count])
    })

    const compact = {
      v: 2,
      a: l.augmentId,
      s: l.shieldId || '',
      w: l.weapons.map((w) =>
        w
          ? w.amplified && !(w.ampIds || []).length
            ? [w.weaponId, w.tier, [], w.mods || {}, 1]
            : [w.weaponId, w.tier, w.ampIds || [], w.mods || {}]
          : null,
      ),
      q: l.quickUse.map((q) => (q ? [q.itemId, q.count] : null)),
      x: l.aux.map((x) => (x ? [x.itemId, x.count] : null)),
    }
    if (sparseBp.length) compact.b = sparseBp
    if (l.safePocket.some(Boolean)) {
      compact.p = l.safePocket.map((p) => (p ? [p.itemId, p.count] : null))
    }
    return SHARE_PREFIX + toBase64Url(JSON.stringify(compact))
  }

  function exportShareCode() {
    return encodeLoadoutToShareCode(currentLoadout.value)
  }

  function decodeShareCodeToLoadout(rawInput) {
    let token = String(rawInput || '').trim()
    if (!token) return null
    const qMatch = /[?&]loadout=([^&#\s]+)/i.exec(token)
    if (qMatch) token = decodeURIComponent(qMatch[1])
    const pIdx = token.indexOf(SHARE_PREFIX)
    if (pIdx >= 0) token = token.slice(pIdx + SHARE_PREFIX.length)
    token = token.trim()
    if (!token) return null

    const parsed = JSON.parse(fromBase64Url(token))
    if (!parsed || typeof parsed !== 'object') return null

    const bp = makeNullArray(MAX_BACKPACK_CAP)
    if (Array.isArray(parsed.b)) {
      for (const entry of parsed.b) {
        if (Array.isArray(entry) && entry.length >= 3) {
          const idx = Number(entry[0])
          if (idx >= 0 && idx < MAX_BACKPACK_CAP) {
            bp[idx] = { itemId: entry[1], count: entry[2] }
          }
        }
      }
    }

    return sanitizeLoadoutState({
      augmentId: parsed.a || 'none',
      shieldId: parsed.s || null,
      weapons: Array.isArray(parsed.w)
        ? parsed.w.map((item) =>
            Array.isArray(item)
              ? {
                  weaponId: item[0],
                  tier: item[1],
                  ampIds: item[2] || [],
                  mods: item[3] || {},
                  // 第 5 位：增强型（Ascended）但未选择增强项
                  amplified: item[4] === 1 || item[4] === true,
                }
              : null,
          )
        : [null, null],
      backpack: bp,
      quickUse: Array.isArray(parsed.q)
        ? parsed.q.map((item) =>
            Array.isArray(item) ? { itemId: item[0], count: item[1] } : null,
          )
        : [],
      aux: Array.isArray(parsed.x)
        ? parsed.x.map((item) =>
            Array.isArray(item) ? { itemId: item[0], count: item[1] } : null,
          )
        : [],
      safePocket: Array.isArray(parsed.p)
        ? parsed.p.map((item) =>
            Array.isArray(item) ? { itemId: item[0], count: item[1] } : null,
          )
        : [],
    })
  }

  function importShareCode(rawInput) {
    try {
      const decoded = decodeShareCodeToLoadout(rawInput)
      if (!decoded) {
        notify('战备分享码无效', 'warn')
        return false
      }
      currentLoadout.value = decoded
      const aug = augmentMap.get(decoded.augmentId)
      notify(`已导入战备（${aug?.zhName || '配装'}）`, 'ok')
      return true
    } catch {
      notify('战备分享码解析失败', 'warn')
      return false
    }
  }

  function applyRecognizedLoadout(recognizedPayload, sourceLabel = '截图') {
    const next = sanitizeLoadoutState(recognizedPayload)
    currentLoadout.value = next
    const aug = augmentMap.get(next.augmentId)
    notify(`已从${sourceLabel}识别载入战备（${aug?.zhName || '配装'}）`, 'ok')
    return { ok: true, loadout: next }
  }

  return {
    data: loadoutData,
    weaponsList: weaponsData.weapons || [],
    rarityMeta,
    slotLabels,
    assetUrl,
    getModById,
    getCompatibleModsForSlot,
    currentLoadout,
    linkSkillTree,
    savedLoadouts,
    selectedSlot,
    toast,
    activeAugment,
    activeShield,
    skillSynergy,
    weaponDetails,
    backpackSlotsView,
    quickUseSlotsView,
    auxSlotsView,
    safePocketSlotsView,
    loadoutSummary,
    notify,
    selectSlot,
    canContainerAcceptItem,
    getContainerCapacity,
    setAugment,
    setShield,
    setWeapon,
    swapWeapons,
    moveOrSwapWeapons,
    setWeaponTier,
    cycleWeaponTier,
    setWeaponMod,
    moveOrSwapWeaponMods,
    toggleWeaponAmp,
    setWeaponAmplified,
    setContainerItem,
    adjustContainerCount,
    setQuickUseItem,
    adjustQuickUseCount,
    setAuxItem,
    adjustAuxCount,
    canMoveOrSwapItems,
    moveOrSwapItems,
    clearLoadout,
    saveCustomLoadout,
    loadCustomLoadout,
    deleteCustomLoadout,
    encodeLoadoutToShareCode,
    decodeShareCodeToLoadout,
    exportShareCode,
    importShareCode,
    applyRecognizedLoadout,
    flushPersistence,
  }
})
