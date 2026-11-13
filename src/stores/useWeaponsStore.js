import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import weaponsData from '../data/weaponsData.json'
import {
  applyAmpToggle,
  armorPenCnMap,
  buildHandlingItemsFromCalc,
  buildStatRowsFromCalc,
  classTabs,
  computeWeaponStats,
  getModById,
  getWeaponById,
  rarityMeta,
  slotPlaceholderImg,
} from '../composables/useWeaponCalculator'

export const useWeaponsStore = defineStore(
  'weapons',
  () => {
    // Sidebar filters
    const searchQuery = ref('')
    const selectedClass = ref('ALL')
    const sortBy = ref('dps')

    // Single weapon workbench state
    const selectedWeaponId = ref(weaponsData.weapons[0]?.id || 'kettle')
    const selectedTier = ref(4)
    const activeAmpIds = ref(['x-rounds'])
    const selectedMods = ref({})

    // Multi-weapon comparison slots (2 or 3 builds side-by-side)
    const activeCompareSlotIdx = ref(0)
    const nextCompareInsertIdx = ref(0)
    const compareSlots = reactive([
      {
        uid: 'slot-1',
        weaponId: 'kettle',
        tier: 4,
        ampIds: ['x-rounds'],
        mods: { Stock: 'kinetic-converter' },
        userFilled: false,
      },
      {
        uid: 'slot-2',
        weaponId: 'il_toro',
        tier: 4,
        ampIds: ['slug-rounds'],
        mods: {
          'Shotgun-Muzzle': 'shotgun-silencer',
          'Shotgun-Mag': 'extended-shotgun-mag-iii',
        },
        userFilled: false,
      },
    ])

    const enrichedWeapons = computed(() =>
      weaponsData.weapons.map((w) => {
        const rMeta = rarityMeta[w.rarity] || rarityMeta.Common
        const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
        const firstAmp = w.amplifications?.[0]
        const initAmps = firstAmp
          ? applyAmpToggle(w, maxTier, [], {}, firstAmp).ampIds
          : []
        const preview = computeWeaponStats(w, maxTier, initAmps, {})
        return {
          ...w,
          rarityCn: rMeta.cn,
          rarityColor: rMeta.color,
          armorPenCn:
            armorPenCnMap[w.baseStats?.arcArmorPenetration] ||
            w.baseStats?.arcArmorPenetration,
          preview,
          hasUniqueAmp: (w.amplifications || []).length > 0,
        }
      }),
    )

    const filteredWeapons = computed(() => {
      const q = searchQuery.value.trim().toLowerCase()
      const list = enrichedWeapons.value.filter((w) => {
        if (selectedClass.value !== 'ALL' && w.zhClass !== selectedClass.value) return false
        if (q) {
          const hay = `${w.name} ${w.zhName} ${w.zhClass} ${w.zhAmmo}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })

      return list.sort((a, b) => {
        if (sortBy.value === 'dps') return b.preview.enhancedBodyDps - a.preview.enhancedBodyDps
        if (sortBy.value === 'armorDps')
          return b.preview.enhancedArmorDps - a.preview.enhancedArmorDps
        if (sortBy.value === 'damage') return b.preview.singleShotDmg - a.preview.singleShotDmg
        if (sortBy.value === 'rpm') return b.preview.enhancedRpm - a.preview.enhancedRpm
        if (sortBy.value === 'range') return b.preview.enhancedRange - a.preview.enhancedRange
        return 0
      })
    })

    const selectedEnriched = computed(
      () =>
        enrichedWeapons.value.find((w) => w.id === selectedWeaponId.value) ||
        enrichedWeapons.value[0],
    )

    const currentCalc = computed(() => {
      if (!selectedEnriched.value) return null
      return computeWeaponStats(
        selectedEnriched.value,
        selectedTier.value,
        activeAmpIds.value,
        selectedMods.value,
      )
    })

    function selectWeaponForWorkbench(wId) {
      if (selectedWeaponId.value === wId) return
      selectedWeaponId.value = wId
      const w = getWeaponById(wId)
      if (!w) return
      const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
      selectedTier.value = maxTier
      selectedMods.value = {}
      const firstAmp = w.amplifications?.[0]
      if (firstAmp) {
        const res = applyAmpToggle(w, maxTier, [], {}, firstAmp)
        activeAmpIds.value = res.ampIds
      } else {
        activeAmpIds.value = []
      }
    }

    function selectWorkbenchTier(tierNum) {
      selectedTier.value = tierNum
      const maxTier =
        selectedEnriched.value?.tiers?.[selectedEnriched.value.tiers.length - 1]?.tier || 1
      if (tierNum < maxTier && activeAmpIds.value.length > 0) {
        activeAmpIds.value = []
      }
    }

    function toggleWorkbenchAmp(amp) {
      const res = applyAmpToggle(
        selectedEnriched.value,
        selectedTier.value,
        activeAmpIds.value,
        selectedMods.value,
        amp,
      )
      selectedTier.value = res.tier
      activeAmpIds.value = res.ampIds
      selectedMods.value = res.mods
    }

    function clearWorkbenchMods() {
      selectedMods.value = {}
    }

    function setWorkbenchMod(slotKey, modId) {
      if (!modId) {
        delete selectedMods.value[slotKey]
      } else {
        selectedMods.value[slotKey] = modId
      }
    }

    /* ============ Multi-Weapon Comparison Actions ============ */
    const nextCompareTargetIdx = computed(() => {
      const freeIdx = compareSlots.findIndex((s) => !s.userFilled)
      if (freeIdx !== -1) return freeIdx
      if (compareSlots.length < 3) return 2
      return nextCompareInsertIdx.value % compareSlots.length
    })

    function addThirdCompareSlot() {
      if (compareSlots.length >= 3) return
      const fallbackId =
        weaponsData.weapons.find((w) => !compareSlots.some((s) => s.weaponId === w.id))?.id ||
        'anvil'
      const w = getWeaponById(fallbackId)
      const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
      const firstAmp = w.amplifications?.[0]
      const initAmps = firstAmp ? applyAmpToggle(w, maxTier, [], {}, firstAmp).ampIds : []
      compareSlots.push({
        uid: `slot-${Date.now()}`,
        weaponId: fallbackId,
        tier: maxTier,
        ampIds: initAmps,
        mods: {},
        userFilled: false,
      })
      activeCompareSlotIdx.value = compareSlots.length - 1
    }

    function removeCompareSlot(idx) {
      if (compareSlots.length <= 2) return
      compareSlots.splice(idx, 1)
      if (activeCompareSlotIdx.value >= compareSlots.length) {
        activeCompareSlotIdx.value = compareSlots.length - 1
      }
    }

    function sendCurrentBuildToCompare(explicitIdx = null) {
      let targetIdx =
        explicitIdx !== null && explicitIdx !== undefined
          ? explicitIdx
          : nextCompareTargetIdx.value
      if (targetIdx >= compareSlots.length && compareSlots.length < 3) {
        addThirdCompareSlot()
        targetIdx = compareSlots.length - 1
      }
      const target = compareSlots[targetIdx] || compareSlots[0]
      if (!target) return targetIdx
      target.weaponId = selectedWeaponId.value
      target.tier = selectedTier.value
      target.ampIds = [...activeAmpIds.value]
      target.mods = { ...selectedMods.value }
      target.userFilled = true
      activeCompareSlotIdx.value = targetIdx
      nextCompareInsertIdx.value = (targetIdx + 1) % 3
      return targetIdx
    }

    function changeCompareSlotWeapon(slot, newWeaponId) {
      const w = getWeaponById(newWeaponId)
      const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
      slot.weaponId = newWeaponId
      slot.tier = maxTier
      slot.mods = {}
      slot.userFilled = true
      const firstAmp = w.amplifications?.[0]
      slot.ampIds = firstAmp ? applyAmpToggle(w, maxTier, [], {}, firstAmp).ampIds : []
    }

    function selectCompareSlotTier(slot, tierNum) {
      const w = getWeaponById(slot.weaponId)
      const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
      slot.tier = tierNum
      slot.userFilled = true
      if (tierNum < maxTier && slot.ampIds.length > 0) {
        slot.ampIds = []
      }
    }

    function toggleCompareSlotAmp(slot, amp) {
      const w = getWeaponById(slot.weaponId)
      const res = applyAmpToggle(w, slot.tier, slot.ampIds, slot.mods, amp)
      slot.tier = res.tier
      slot.ampIds = res.ampIds
      slot.mods = res.mods
      slot.userFilled = true
    }

    function setCompareSlotMod(slot, slotKey, modId) {
      if (!modId) {
        delete slot.mods[slotKey]
      } else {
        slot.mods[slotKey] = modId
      }
      slot.userFilled = true
    }

    function resetCompareSlot(slot) {
      const w = getWeaponById(slot.weaponId)
      slot.tier = w.tiers?.[w.tiers.length - 1]?.tier || 1
      slot.ampIds = []
      slot.mods = {}
      slot.userFilled = false
    }

    const compareComputedList = computed(() =>
      compareSlots.map((slot, idx) => {
        const w =
          enrichedWeapons.value.find((item) => item.id === slot.weaponId) ||
          enrichedWeapons.value[0]
        const calc = computeWeaponStats(w, slot.tier, slot.ampIds, slot.mods)
        return {
          idx,
          slot,
          weapon: w,
          calc,
        }
      }),
    )

    function getCtx(compareIdx = null) {
      if (
        compareIdx !== null &&
        compareIdx !== undefined &&
        compareIdx >= 0 &&
        compareComputedList.value[compareIdx]
      ) {
        const item = compareComputedList.value[compareIdx]
        return {
          isCompare: true,
          compareIdx,
          slot: item.slot,
          weapon: item.weapon,
          calc: item.calc,
          tier: item.slot.tier,
          ampIds: item.slot.ampIds,
          mods: item.slot.mods,
        }
      }
      return {
        isCompare: false,
        compareIdx: -1,
        slot: null,
        weapon: selectedEnriched.value,
        calc: currentCalc.value,
        tier: selectedTier.value,
        ampIds: activeAmpIds.value,
        mods: selectedMods.value,
      }
    }

    function equippedMod(slotKey, compareIdx = null) {
      const ctx = getCtx(compareIdx)
      if (ctx.calc?.lockedSlots[slotKey]) return null
      return getModById(ctx.mods?.[slotKey])
    }

    const statRows = computed(() => buildStatRowsFromCalc(currentCalc.value))
    const handlingItems = computed(() => buildHandlingItemsFromCalc(currentCalc.value))

    function handleRosterClick(wId, mode = 'workbench') {
      if (mode === 'compare') {
        const slot = compareSlots[activeCompareSlotIdx.value] || compareSlots[0]
        if (slot) changeCompareSlotWeapon(slot, wId)
      } else {
        selectWeaponForWorkbench(wId)
      }
    }

    function isBestMetric(getter, idx, higherBetter = true) {
      const list = compareComputedList.value
      if (list.length < 2 || !list[idx]) return false
      const vals = list.map((x) => Number(getter(x)) || 0)
      const target = vals[idx]
      const best = higherBetter ? Math.max(...vals) : Math.min(...vals)
      const worst = higherBetter ? Math.min(...vals) : Math.max(...vals)
      if (Math.abs(best - worst) < 0.01) return false
      return Math.abs(target - best) < 0.01
    }

    return {
      classTabs,
      searchQuery,
      selectedClass,
      sortBy,
      selectedWeaponId,
      selectedTier,
      activeAmpIds,
      selectedMods,
      activeCompareSlotIdx,
      nextCompareInsertIdx,
      compareSlots,
      enrichedWeapons,
      filteredWeapons,
      selectedEnriched,
      currentCalc,
      statRows,
      handlingItems,
      nextCompareTargetIdx,
      compareComputedList,
      selectWeaponForWorkbench,
      selectWorkbenchTier,
      toggleWorkbenchAmp,
      clearWorkbenchMods,
      setWorkbenchMod,
      addThirdCompareSlot,
      removeCompareSlot,
      sendCurrentBuildToCompare,
      changeCompareSlotWeapon,
      selectCompareSlotTier,
      toggleCompareSlotAmp,
      setCompareSlotMod,
      resetCompareSlot,
      getCtx,
      equippedMod,
      getWeaponById,
      slotPlaceholderImg,
      handleRosterClick,
      isBestMetric,
    }
  },
  {
    persist: {
      key: 'arc_weapons_store_v1',
      pick: ['selectedWeaponId', 'selectedTier', 'activeAmpIds', 'selectedMods'],
    },
  },
)
