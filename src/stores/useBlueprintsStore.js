import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import questResourcesData from '../data/questResourcesData.json'
import { useQuestsStore } from './useQuestsStore'

export const rarityLabelMap = {
  legendary: '传奇 · LEGENDARY',
  epic: '史诗 · EPIC',
  rare: '稀有 · RARE',
  uncommon: '罕见 · UNCOMMON',
  common: '普通 · COMMON',
}

export const useBlueprintsStore = defineStore(
  'blueprints',
  () => {
    const blueprintSubTab = ref('weapon_item') // 'weapon_item' | 'furniture' | 'stencil'
    const bpCategoryFilter = ref('ALL')
    const bpOwnershipFilter = ref('ALL') // 'ALL' | 'MISSING' | 'OWNED'
    const bpRarityFilter = ref('ALL') // 'ALL' | 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common'
    const showScreenshotScannerModal = ref(false)

    const weaponItemBlueprints = Object.freeze(
      (questResourcesData.blueprints.weaponItemBlueprints || []).map((b) => Object.freeze(b)),
    )
    const furnitureBlueprints = Object.freeze(
      (questResourcesData.blueprints.furnitureBlueprints || []).map((b) => Object.freeze(b)),
    )
    const stencilBlueprints = Object.freeze(
      (questResourcesData.blueprints.stencilBlueprints || []).map((b) => Object.freeze(b)),
    )

    const allValidIds = new Set([
      ...weaponItemBlueprints.map((b) => b.id),
      ...furnitureBlueprints.map((b) => b.id),
      ...stencilBlueprints.map((b) => b.id),
    ])

    const ownedBlueprintIds = ref(['bp-wpn-anvil', 'bp-item-lure'])
    const ownedBlueprintIdSet = computed(() => new Set(ownedBlueprintIds.value))

    watch(blueprintSubTab, () => {
      bpCategoryFilter.value = 'ALL'
    })

    const allBlueprintsCount = computed(
      () => weaponItemBlueprints.length + furnitureBlueprints.length + stencilBlueprints.length,
    )

    const validOwnedCount = computed(
      () => ownedBlueprintIds.value.filter((id) => allValidIds.has(id)).length,
    )

    function isBlueprintOwned(id) {
      return ownedBlueprintIdSet.value.has(id)
    }

    function toggleBlueprintOwned(id) {
      const idx = ownedBlueprintIds.value.indexOf(id)
      if (idx >= 0) ownedBlueprintIds.value.splice(idx, 1)
      else ownedBlueprintIds.value.push(id)
    }

    const activeBlueprintPool = computed(() => {
      if (blueprintSubTab.value === 'furniture') return furnitureBlueprints
      if (blueprintSubTab.value === 'stencil') return stencilBlueprints
      return weaponItemBlueprints
    })

    const activeTabOwnedCount = computed(
      () => activeBlueprintPool.value.filter((bp) => isBlueprintOwned(bp.id)).length,
    )

    const categoryFilterOptions = computed(() => {
      const pool = activeBlueprintPool.value
      const counts = new Map()
      const labels = new Map()
      const icons = new Map()
      for (const bp of pool) {
        const cat = bp.category || 'other'
        counts.set(cat, (counts.get(cat) || 0) + 1)
        if (!labels.has(cat)) labels.set(cat, bp.categoryLabel || cat)
        if (!icons.has(cat) && bp.typeIcon) icons.set(cat, bp.typeIcon)
      }
      if (counts.size <= 1) return []
      const list = [{ id: 'ALL', label: '全部类别', count: pool.length, icon: '' }]
      for (const [id, count] of counts.entries()) {
        list.push({ id, label: labels.get(id), count, icon: icons.get(id) || '' })
      }
      return list
    })

    const filteredBlueprints = computed(() => {
      const questsStore = useQuestsStore()
      const kw = questsStore.globalSearch.trim().toLowerCase()
      return activeBlueprintPool.value.filter((bp) => {
        const isOwned = isBlueprintOwned(bp.id)
        if (bpCategoryFilter.value !== 'ALL' && bp.category !== bpCategoryFilter.value) return false
        if (bpOwnershipFilter.value === 'MISSING' && isOwned) return false
        if (bpOwnershipFilter.value === 'OWNED' && !isOwned) return false
        if (bpRarityFilter.value !== 'ALL' && bp.rarity !== bpRarityFilter.value) return false
        if (kw) {
          return [
            bp.name,
            bp.itemName || '',
            bp.enName,
            bp.itemEnName || '',
            bp.categoryLabel || '',
            bp.subType,
            bp.station,
            bp.materials,
            bp.source,
            bp.description || '',
            bp.buff || '',
          ]
            .join(' ')
            .toLowerCase()
            .includes(kw)
        }
        return true
      })
    })

    return {
      blueprintSubTab,
      bpCategoryFilter,
      bpOwnershipFilter,
      bpRarityFilter,
      showScreenshotScannerModal,
      ownedBlueprintIds,
      validOwnedCount,
      weaponItemBlueprints,
      furnitureBlueprints,
      stencilBlueprints,
      allBlueprintsCount,
      activeBlueprintPool,
      activeTabOwnedCount,
      categoryFilterOptions,
      filteredBlueprints,
      isBlueprintOwned,
      toggleBlueprintOwned,
    }
  },
  {
    persist: {
      key: 'arc_blueprints_store_v3',
      pick: ['ownedBlueprintIds'],
    },
  },
)
