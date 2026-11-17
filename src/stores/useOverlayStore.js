import { computed, ref } from 'vue'
import { defineStore, storeToRefs } from 'pinia'
import questsData from '../data/questsData.json'
import { useQuestsStore } from './useQuestsStore'
import { useBlueprintsStore } from './useBlueprintsStore'
import { useMapsStore } from './useMapsStore'
import {
  OVERLAY_NAV_ITEMS,
  isTauriRuntime,
  isOverlayWindowContext,
  useOverlayWindowStore,
} from './useOverlayWindowStore'

export { OVERLAY_NAV_ITEMS, isTauriRuntime, isOverlayWindowContext }

export const useOverlayStore = defineStore('overlay', () => {
  const winStore = useOverlayWindowStore()
  const {
    activeTab,
    navTabsConfig,
    hideSingleNavBar,
    orderedNavTabs,
    visibleNavTabs,
    isDefaultNavConfig,
    mapSubMode,
    overlayMapId,
    overlayVisible,
    collapsed,
    fullscreen,
    clickThrough,
    alwaysOnTop,
    opacity,
    mapOpacity,
    autoMinimizeMain,
    leftDrawerOpen,
    pinnedQuestIds,
    pinnedQuestIdSet,
    stashedItemCounts,
    savedMapAlignments,
    raiderGuideSpec,
    raiderOverlayIntent,
    raiderSyncRuntime,
  } = storeToRefs(winStore)

  const questsStore = useQuestsStore()
  const blueprintsStore = useBlueprintsStore()
  const mapsStore = useMapsStore()

  // Filter state for "Raid Quests" tab
  const questScopeFilter = ref('MAP') // 'MAP' | 'PINNED' | 'ALL_TODO'
  const questSearch = ref('')

  // Filter state for "Blueprints" tab
  const bpSearch = ref('')
  const bpSubFilter = ref('ALL') // 'ALL' | 'weapon_item' | 'furniture' | 'stencil'
  const bpStatusFilter = ref('ALL') // 'ALL' | 'MISSING' | 'OWNED'

  const {
    isTabVisible,
    getNavTabLabel,
    switchToFirstVisibleTab,
    setNavTabVisible,
    moveNavTab,
    setHideSingleNavBar,
    resetNavTabsConfig,
    isQuestPinned,
    togglePinQuest,
    getStashedCount,
    setStashedCount,
    adjustStashedCount,
    openOverlay,
    openOverlayAtRaider,
    closeOverlay,
    toggleOverlay,
    setCollapsed,
    toggleCollapsed,
    setFullscreen,
    toggleFullscreen,
    launchRaiderPerspectiveGuide,
    exitRaiderPerspectiveGuide,
    setLeftDrawerOpen,
    setMapOpacity,
    saveMapAlignment,
    getMapAlignment,
    clearMapAlignment,
    setClickThrough,
    toggleClickThrough,
    toggleAlwaysOnTop,
    setOpacity,
    setAutoMinimizeMain,
    startDrag,
    openInMainWindow,
    initCrossWindowSync,
  } = winStore

  /* =====================================================================
     1. Raid Quests List (Map-linked + Pinned + Search)
     ===================================================================== */
  const activeOverlayMap = computed(() => mapsStore.getMapById(overlayMapId.value))

  const overlayQuestsList = computed(() => {
    const kw = questSearch.value.trim().toLowerCase()
    let base = []
    if (questScopeFilter.value === 'PINNED') {
      base = questsData.quests.filter((q) => isQuestPinned(q.id))
    } else if (questScopeFilter.value === 'MAP') {
      base = mapsStore.getTodoQuestsForMap(overlayMapId.value)
    } else {
      base = questsData.quests.filter((q) => !questsStore.isQuestDone(q.id))
    }

    if (kw) {
      base = base.filter((q) =>
        [
          q.zhTitle,
          q.title,
          q.trader,
          q.zhTrader,
          q.zhLocation,
          q.zhDescription,
          q.zhRequiredItems,
        ]
          .join(' ')
          .toLowerCase()
          .includes(kw),
      )
    }

    return [...base].sort((a, b) => {
      const pa = isQuestPinned(a.id) ? 0 : 1
      const pb = isQuestPinned(b.id) ? 0 : 1
      if (pa !== pb) return pa - pb
      return (a.order || 999) - (b.order || 999)
    })
  })

  // Primary headline quest shown in the 48px Mini Capsule Bar
  const miniBarQuest = computed(() => {
    if (mapsStore.trackedQuest && !questsStore.isQuestDone(mapsStore.trackedQuest.id)) {
      return mapsStore.trackedQuest
    }
    const firstPinned = questsData.quests.find(
      (q) => isQuestPinned(q.id) && !questsStore.isQuestDone(q.id),
    )
    if (firstPinned) return firstPinned
    const mapTodos = mapsStore.getTodoQuestsForMap(overlayMapId.value)
    return mapTodos[0] || null
  })

  /* =====================================================================
     2. Blueprints Quick Lookup
     ===================================================================== */
  const allBlueprintsPool = computed(() => [
    ...blueprintsStore.weaponItemBlueprints.map((b) => ({
      ...b,
      poolKey: 'weapon_item',
      poolLabel: '武器/道具',
    })),
    ...blueprintsStore.furnitureBlueprints.map((b) => ({
      ...b,
      poolKey: 'furniture',
      poolLabel: '哨站家具',
    })),
    ...blueprintsStore.stencilBlueprints.map((b) => ({
      ...b,
      poolKey: 'stencil',
      poolLabel: '涂装模板',
    })),
  ])

  const filteredOverlayBlueprints = computed(() => {
    const kw = bpSearch.value.trim().toLowerCase()
    return allBlueprintsPool.value.filter((bp) => {
      if (bpSubFilter.value !== 'ALL' && bp.poolKey !== bpSubFilter.value) return false
      const owned = blueprintsStore.isBlueprintOwned(bp.id)
      if (bpStatusFilter.value === 'MISSING' && owned) return false
      if (bpStatusFilter.value === 'OWNED' && !owned) return false
      if (kw) {
        const hay = [
          bp.name,
          bp.itemName || '',
          bp.enName,
          bp.itemEnName || '',
          bp.station || '',
          bp.materials || '',
          bp.source || '',
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(kw)
      }
      return true
    })
  })

  return {
    activeTab,
    navTabsConfig,
    hideSingleNavBar,
    orderedNavTabs,
    visibleNavTabs,
    isDefaultNavConfig,
    mapSubMode,
    overlayMapId,
    activeOverlayMap,
    overlayVisible,
    collapsed,
    fullscreen,
    clickThrough,
    alwaysOnTop,
    opacity,
    mapOpacity,
    autoMinimizeMain,
    leftDrawerOpen,
    pinnedQuestIds,
    pinnedQuestIdSet,
    stashedItemCounts,
    savedMapAlignments,
    raiderGuideSpec,
    raiderOverlayIntent,
    raiderSyncRuntime,
    questScopeFilter,
    questSearch,
    bpSearch,
    bpSubFilter,
    bpStatusFilter,
    overlayQuestsList,
    miniBarQuest,
    allBlueprintsPool,
    filteredOverlayBlueprints,
    isTabVisible,
    getNavTabLabel,
    switchToFirstVisibleTab,
    setNavTabVisible,
    moveNavTab,
    setHideSingleNavBar,
    resetNavTabsConfig,
    isQuestPinned,
    togglePinQuest,
    getStashedCount,
    setStashedCount,
    adjustStashedCount,
    openOverlay,
    openOverlayAtRaider,
    closeOverlay,
    toggleOverlay,
    setCollapsed,
    toggleCollapsed,
    setFullscreen,
    toggleFullscreen,
    launchRaiderPerspectiveGuide,
    exitRaiderPerspectiveGuide,
    setLeftDrawerOpen,
    setMapOpacity,
    saveMapAlignment,
    getMapAlignment,
    clearMapAlignment,
    setClickThrough,
    toggleClickThrough,
    toggleAlwaysOnTop,
    setOpacity,
    setAutoMinimizeMain,
    startDrag,
    openInMainWindow,
    initCrossWindowSync,
  }
})
