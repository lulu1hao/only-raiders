<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMapsStore } from '../../stores/useMapsStore'
import { traderMeta, useQuestsStore } from '../../stores/useQuestsStore'
import { assetUrl } from '../../utils/assetUrl'
import { parseQuestRequiredItems } from '../../utils/questItemIcons'
import {
  buildMapEliteArcCategories,
  buildMapExtractionLegend,
  buildMapLootLegend,
  buildMapPlantCategories,
  buildMapSpecialEvents,
  buildMapTrialCategories,
  collectActiveTacticalMarkers,
  countLiveServerEventMarkers,
  getStagePlaceName as formatStagePlaceName,
  polyPointsSquare,
  resolveCurrentLayerObj,
  resolveLiveServerEventIds,
} from '../../composables/useTacticalMapCommons'

const route = useRoute()
const router = useRouter()
const mapsStore = useMapsStore()
const questsStore = useQuestsStore()

const currentMapId = computed(() => String(route.params.mapId || 'dam-battlegrounds'))
const currentMap = computed(() => mapsStore.getMapById(currentMapId.value))
const activeState = computed(() => mapsStore.getActiveStateForMap(currentMap.value.id))

// Multi-layer state (0 = Surface / Lower, 1 = Underground / Upper)
const activeMapLayer = ref(0)

// Interactive Legend Filter: clicking a loot category in the right-side legend highlights matching POIs
const selectedLootCategoryId = ref('')

const currentLayerObj = computed(() =>
  resolveCurrentLayerObj(currentMap.value, activeMapLayer.value),
)

// POIs on the active layer, separated by TargetZoomLevel (0 = Macro neighborhood pills, 1 = Major buildings, 2 = Minor landmarks)
const layerPois = computed(() =>
  (currentMap.value.pois || []).filter((p) => (p.layer ?? 0) === activeMapLayer.value),
)

const macroPois = computed(() => layerPois.value.filter((p) => p.zoom === 0))
const majorPois = computed(() => layerPois.value.filter((p) => p.zoom === 1))
const minorPois = computed(() => layerPois.value.filter((p) => p.zoom === 2))

// Separate regular landmarks from locked key rooms so both switches in the Icon Filter form work independently
const normalMajorPois = computed(() =>
  layerPois.value.filter((p) => p.zoom === 1 && !p.lockedRoom && !p.keyRequired),
)
const normalMinorPois = computed(() =>
  layerPois.value.filter((p) => p.zoom === 2 && !p.lockedRoom && !p.keyRequired),
)
const lockedRoomPois = computed(() =>
  layerPois.value.filter((p) => Boolean(p.lockedRoom || p.keyRequired)),
)

const standardExtractions = computed(() =>
  (currentMap.value.extractions || []).filter((e) => e.type !== 'hatch'),
)
const raiderHatches = computed(() =>
  (currentMap.value.extractions || []).filter((e) => e.type === 'hatch'),
)

// Loot zones on the active layer
const layerLootZones = computed(() =>
  (currentMap.value.lootZones || []).filter((lz) => (lz.layer ?? 0) === activeMapLayer.value),
)

// Selected POI inside the tactical map
const activePoi = computed(() => {
  const pois = currentMap.value.pois || []
  return pois.find((p) => p.id === mapsStore.selectedPoiId) || null
})

// Selected Extraction point (optional inspection)
const selectedExtId = ref('')

// Selected Special Event / Trial Marker for detailed tactical inspection
const selectedEventMarkerId = ref('')
const selectedTrialId = ref('')

// Icon Filter Form state (1:1 with OverlayMiniRadarMap)
const showFilterForm = ref(false)
const locGroupCollapsed = ref(false)
const arcGroupCollapsed = ref(false)
const plantGroupCollapsed = ref(false)
const evGroupCollapsed = ref(false)

// Independent switches for "当前事件点", "精英 ARC", "植物与自然", and individual "事件与试炼" items
const showLiveEventMarkers = ref(true)
const enabledEventIds = ref([])
const enabledTrialIds = ref([])
const enabledPlantIds = ref([])
const enabledEliteArcIds = ref([])
const highlightedPoiRadius = ref(0)

const mapSpecialEvents = computed(() => buildMapSpecialEvents(currentMap.value, mapsStore))
const mapTrialCategories = computed(() => buildMapTrialCategories(currentMap.value, mapsStore))
const mapPlantCategories = computed(() => buildMapPlantCategories(currentMap.value, mapsStore))
const mapEliteArcCategories = computed(() =>
  buildMapEliteArcCategories(currentMap.value, mapsStore),
)
const liveServerEventIds = computed(() => resolveLiveServerEventIds(activeState.value))
const liveServerEventMarkersCount = computed(() =>
  countLiveServerEventMarkers(currentMap.value, liveServerEventIds.value),
)

const activeTrialCategory = computed(() => {
  const trId = enabledTrialIds.value[0] || selectedTrialId.value
  return trId ? mapsStore.getTrialCategoryById(trId) : null
})

// Combined active Event, Trial, Plant & Elite ARC markers across all layers
const allLayersActiveEventMarkers = computed(() => {
  if (!mapsStore.layers.eventMarkers) return []
  return collectActiveTacticalMarkers(currentMap.value, {
    showLiveEventMarkers: showLiveEventMarkers.value,
    liveEventIds: liveServerEventIds.value,
    enabledEventIds: enabledEventIds.value,
    enabledTrialIds: enabledTrialIds.value,
    enabledPlantIds: enabledPlantIds.value,
    enabledEliteArcIds: enabledEliteArcIds.value,
    layerFilter: null,
  })
})

// Event/Trial/Plant/EliteARC markers filtered to the currently active map layer (0 = Surface/Lower, 1 = Underground/Upper)
const activeEventMarkers = computed(() =>
  allLayersActiveEventMarkers.value.filter((em) => (em.layer ?? 0) === activeMapLayer.value),
)

// Highlighted Plant & POI Foraging Range Circles (小鸡仔/工坊植物道具范围标注)
const allLayersActivePlantZones = computed(() => {
  const m = currentMap.value
  const zDict = m.plantZones || {}
  const out = []
  for (const plId of enabledPlantIds.value) {
    for (const z of zDict[plId] || []) {
      out.push(z)
    }
  }
  if (highlightedPoiRadius.value > 0 && activePoi.value && !enabledEliteArcIds.value.length) {
    const p = activePoi.value
    const alreadyCovered = out.some(
      (z) => (z.layer ?? 0) === (p.layer ?? 0) && Math.hypot(z.x - p.x, z.y - p.y) <= 4.2,
    )
    if (!alreadyCovered) {
      const firstPlantCat = enabledPlantIds.value[0]
        ? mapsStore.getPlantCategoryById(enabledPlantIds.value[0])
        : null
      out.push({
        id: `poi-range-${p.id}`,
        plantId: firstPlantCat?.id || 'poi-target',
        layer: p.layer ?? 0,
        x: p.x,
        y: p.y,
        radius: highlightedPoiRadius.value,
        label: firstPlantCat ? `${p.name} · ${firstPlantCat.name}采集区` : `${p.name} · 搜寻范围`,
        poiName: p.name,
        count: 1,
        accent: firstPlantCat?.accent || '#4ade80',
        icon: firstPlantCat?.icon || '',
      })
    }
  }
  return out
})

const activePlantZones = computed(() =>
  allLayersActivePlantZones.value.filter((z) => (z.layer ?? 0) === activeMapLayer.value),
)

const selectedEventMarker = computed(
  () =>
    allLayersActiveEventMarkers.value.find((em) => em.id === selectedEventMarkerId.value) ||
    null,
)

// Form Section 1 ("地点") rows definition (1:1 with OverlayMiniRadarMap)
const locationFormRows = computed(() => [
  {
    key: 'extractions',
    label: '撤离点',
    icon: standardExtractions.value[0]?.icon || 'game-maps/icons/T_UI_Icons_ExtractLift.png',
    count: standardExtractions.value.length,
    on: Boolean(mapsStore.layers.extractions),
    toggle: () => {
      mapsStore.layers.extractions = !mapsStore.layers.extractions
    },
  },
  {
    key: 'hatches',
    label: '奇袭者暗门',
    icon: raiderHatches.value[0]?.icon || 'game-maps/icons/T_UI_Icons_ExtractHatch.png',
    count: raiderHatches.value.length,
    on: Boolean(mapsStore.layers.hatches),
    toggle: () => {
      mapsStore.layers.hatches = !mapsStore.layers.hatches
    },
  },
  {
    key: 'lootZones',
    label: '战利品区',
    icon: 'game-maps/icons/T_UI_Icon_Loot-Military.png',
    count: layerLootZones.value.length,
    on: Boolean(mapsStore.layers.lootZones),
    toggle: () => {
      mapsStore.layers.lootZones = !mapsStore.layers.lootZones
    },
  },
  {
    key: 'pois',
    label: '地标',
    icon: 'game-maps/icons/T_UI_LocationLogo_Generic.png',
    count: macroPois.value.length + normalMajorPois.value.length + normalMinorPois.value.length,
    on: Boolean(mapsStore.layers.pois),
    toggle: () => {
      mapsStore.layers.pois = !mapsStore.layers.pois
    },
  },
  {
    key: 'lockedRooms',
    label: '钥匙房',
    icon: 'items/T_UI_Utility_Key.png',
    count: lockedRoomPois.value.length,
    on: Boolean(mapsStore.layers.lockedRooms),
    toggle: () => {
      mapsStore.layers.lockedRooms = !mapsStore.layers.lockedRooms
    },
  },
  {
    key: 'liveEvents',
    label: '当前事件点',
    subTag:
      activeState.value.livePrimary?.id !== 'standard-patrol'
        ? activeState.value.livePrimary?.name
        : '常规',
    icon: activeState.value.livePrimary?.gameIcon || 'game-maps/icons/T_Icon_Event.png',
    count: liveServerEventMarkersCount.value,
    on: Boolean(showLiveEventMarkers.value),
    toggle: () => {
      mapsStore.layers.eventMarkers = true
      showLiveEventMarkers.value = !showLiveEventMarkers.value
    },
  },
])

const locationGroupTotalCount = computed(() =>
  locationFormRows.value.reduce((acc, r) => acc + r.count, 0),
)

const isAnyLocationRowOn = computed(() => locationFormRows.value.some((r) => r.on))

function toggleAllLocationRows() {
  const next = !isAnyLocationRowOn.value
  mapsStore.layers.extractions = next
  mapsStore.layers.hatches = next
  mapsStore.layers.lootZones = next
  mapsStore.layers.pois = next
  mapsStore.layers.lockedRooms = next
  mapsStore.layers.eventMarkers = true
  showLiveEventMarkers.value = next
}

// Form Section 2 ("事件与试炼") helpers
const eventsAndTrialsTotalCount = computed(() => {
  let sum = 0
  for (const e of mapSpecialEvents.value) sum += e.count
  for (const t of mapTrialCategories.value) sum += t.count
  return sum
})

const isAnyEventOrTrialOn = computed(
  () => enabledEventIds.value.length > 0 || enabledTrialIds.value.length > 0,
)

function toggleAllEventsAndTrials() {
  mapsStore.layers.eventMarkers = true
  if (isAnyEventOrTrialOn.value) {
    enabledEventIds.value = []
    enabledTrialIds.value = []
  } else {
    enabledEventIds.value = mapSpecialEvents.value.map((e) => e.id)
    enabledTrialIds.value = mapTrialCategories.value.map((t) => t.id)
  }
}

function isEventEnabled(evId) {
  return enabledEventIds.value.includes(evId)
}

function toggleEventItem(evId) {
  mapsStore.layers.eventMarkers = true
  const idx = enabledEventIds.value.indexOf(evId)
  if (idx >= 0) {
    enabledEventIds.value.splice(idx, 1)
  } else {
    enabledEventIds.value.push(evId)
    const markers = currentMap.value.eventMarkers?.[evId] || []
    if (markers.length > 0 && !markers.some((m) => (m.layer ?? 0) === activeMapLayer.value)) {
      activeMapLayer.value = markers[0].layer ?? 0
    }
  }
}

function isTrialEnabled(trId) {
  return enabledTrialIds.value.includes(trId)
}

function toggleTrialItem(trId) {
  mapsStore.layers.eventMarkers = true
  const idx = enabledTrialIds.value.indexOf(trId)
  if (idx >= 0) {
    enabledTrialIds.value.splice(idx, 1)
  } else {
    enabledTrialIds.value.push(trId)
    const markers = currentMap.value.trialMarkers?.[trId] || []
    if (markers.length > 0 && !markers.some((m) => (m.layer ?? 0) === activeMapLayer.value)) {
      activeMapLayer.value = markers[0].layer ?? 0
    }
  }
}

// Form Section 3 ("植物与自然") helpers
const plantsTotalCount = computed(() =>
  mapPlantCategories.value.reduce((acc, p) => acc + p.count, 0),
)

const isAnyPlantOn = computed(() => enabledPlantIds.value.length > 0)

function toggleAllPlants() {
  mapsStore.layers.eventMarkers = true
  if (isAnyPlantOn.value) {
    enabledPlantIds.value = []
  } else {
    enabledPlantIds.value = mapPlantCategories.value.map((p) => p.id)
  }
}

function isPlantEnabled(plantId) {
  return enabledPlantIds.value.includes(plantId)
}

function togglePlantItem(plantId) {
  mapsStore.layers.eventMarkers = true
  const idx = enabledPlantIds.value.indexOf(plantId)
  if (idx >= 0) {
    enabledPlantIds.value.splice(idx, 1)
  } else {
    enabledPlantIds.value.push(plantId)
    const markers = currentMap.value.plantMarkers?.[plantId] || []
    if (markers.length > 0 && !markers.some((m) => (m.layer ?? 0) === activeMapLayer.value)) {
      activeMapLayer.value = markers[0].layer ?? 0
    }
  }
}

// Form Section 4 ("精英 ARC") helpers
const eliteArcsTotalCount = computed(() =>
  mapEliteArcCategories.value.reduce((acc, a) => acc + a.count, 0),
)

const isAnyEliteArcOn = computed(() => enabledEliteArcIds.value.length > 0)

function toggleAllEliteArcs() {
  mapsStore.layers.eventMarkers = true
  if (isAnyEliteArcOn.value) {
    enabledEliteArcIds.value = []
  } else {
    enabledEliteArcIds.value = mapEliteArcCategories.value.map((a) => a.id)
  }
}

function isEliteArcEnabled(arcId) {
  return enabledEliteArcIds.value.includes(arcId)
}

function toggleEliteArcItem(arcId) {
  mapsStore.layers.eventMarkers = true
  const idx = enabledEliteArcIds.value.indexOf(arcId)
  if (idx >= 0) {
    enabledEliteArcIds.value.splice(idx, 1)
  } else {
    enabledEliteArcIds.value.push(arcId)
    const markers = currentMap.value.eliteArcMarkers?.[arcId] || []
    if (markers.length > 0 && !markers.some((m) => (m.layer ?? 0) === activeMapLayer.value)) {
      activeMapLayer.value = markers[0].layer ?? 0
    }
  }
}

const activeFilterSwitchesCount = computed(
  () =>
    locationFormRows.value.filter((r) => r.on).length +
    enabledEventIds.value.length +
    enabledTrialIds.value.length +
    enabledPlantIds.value.length +
    enabledEliteArcIds.value.length,
)

function clearEventAndTrialMarkers() {
  selectedTrialId.value = ''
  selectedEventMarkerId.value = ''
  showLiveEventMarkers.value = false
  enabledEventIds.value = []
  enabledTrialIds.value = []
  enabledPlantIds.value = []
  enabledEliteArcIds.value = []
  highlightedPoiRadius.value = 0
}

function selectEventOnMap(eventId) {
  selectedEventMarkerId.value = ''
  if (!eventId || eventId === 'LIVE') {
    selectedTrialId.value = ''
    mapsStore.layers.eventMarkers = true
    showLiveEventMarkers.value = true
    mapsStore.setManualEvent(currentMap.value.id, 'LIVE')
    return
  }
  toggleEventItem(eventId)
}

function selectEventMarker(marker) {
  if (selectedEventMarkerId.value === marker.id) {
    selectedEventMarkerId.value = ''
  } else {
    selectedEventMarkerId.value = marker.id
    mapsStore.selectedPoiId = ''
  }
}

// Distinct extraction types on this map for the right-side In-Game Legend (Screenshot 1)
const mapExtractionLegend = computed(() =>
  buildMapExtractionLegend(currentMap.value.extractions || []),
)

// Distinct loot categories present on this map for the right-side In-Game Legend (Screenshot 1 order)
const mapLootLegend = computed(() => buildMapLootLegend(currentMap.value.pois || []))

function poiMatchesLootFilter(poi) {
  if (!selectedLootCategoryId.value) return false
  return (poi.lootTags || []).some((lt) => lt.zh === selectedLootCategoryId.value)
}

function toggleLootFilter(zhLabel) {
  selectedLootCategoryId.value = selectedLootCategoryId.value === zhLabel ? '' : zhLabel
}

// Quests for this map
const questFilterMode = ref('TODO') // 'TODO' | 'ALL'
const mapQuestCatFilter = ref('ALL')
const expandedQuestIds = ref([])
const expandAllQuestDescs = ref(false)
const hoveredQuest = ref(null)
const questTooltipPos = ref({ x: 0, y: 0 })

function isQuestDescExpanded(questId) {
  return expandAllQuestDescs.value || expandedQuestIds.value.includes(questId)
}

function toggleQuestDesc(questId) {
  const idx = expandedQuestIds.value.indexOf(questId)
  if (idx >= 0) {
    expandedQuestIds.value.splice(idx, 1)
  } else {
    expandedQuestIds.value.push(questId)
  }
}

function toggleExpandAllQuestDescs() {
  expandAllQuestDescs.value = !expandAllQuestDescs.value
  if (!expandAllQuestDescs.value) {
    expandedQuestIds.value = []
  }
}

let tooltipRafId = 0
let pendingTooltipX = 0
let pendingTooltipY = 0

function updateQuestTooltipCoord(clientX, clientY) {
  const pad = 18
  const tipW = 336
  const tipH = 180
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1440
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900
  const x = Math.min(vw - tipW - 14, clientX + pad)
  const y = Math.min(vh - tipH - 14, Math.max(14, clientY + 12))
  questTooltipPos.value = { x, y }
}

function onQuestRowEnter(q, e) {
  hoveredQuest.value = q
  updateQuestTooltipCoord(e.clientX, e.clientY)
}

function onQuestRowMove(e) {
  if (!hoveredQuest.value) return
  pendingTooltipX = e.clientX
  pendingTooltipY = e.clientY
  if (tooltipRafId) return
  tooltipRafId = requestAnimationFrame(() => {
    tooltipRafId = 0
    if (hoveredQuest.value) {
      updateQuestTooltipCoord(pendingTooltipX, pendingTooltipY)
    }
  })
}

function onQuestRowLeave() {
  hoveredQuest.value = null
  if (tooltipRafId) {
    cancelAnimationFrame(tooltipRafId)
    tooltipRafId = 0
  }
}

const allMapQuests = computed(() => mapsStore.getQuestsForMap(currentMap.value.id))
const todoMapQuests = computed(() => mapsStore.getTodoQuestsForMap(currentMap.value.id))
const displayedMapQuests = computed(() => {
  const base = questFilterMode.value === 'TODO' ? todoMapQuests.value : allMapQuests.value
  if (mapQuestCatFilter.value === 'ALL') return base
  return base.filter((q) => q.taskType === mapQuestCatFilter.value)
})

// Active Tracked Quest Spatial Targets (Green Zones & Detailed Landmarks)
const selectedQuestLandmarkId = ref('')
const selectedQuestZoneId = ref('')

const currentQuestMapTargets = computed(() => {
  const q = mapsStore.trackedQuest
  if (!q?.mapTargets) return { zones: [], landmarks: [] }
  return q.mapTargets[currentMap.value.id] || { zones: [], landmarks: [] }
})

const allLayersQuestZones = computed(() => currentQuestMapTargets.value.zones || [])
const allLayersQuestLandmarks = computed(() => currentQuestMapTargets.value.landmarks || [])

const activeQuestZones = computed(() =>
  allLayersQuestZones.value.filter((z) => (z.layer ?? 0) === activeMapLayer.value),
)
const activeQuestLandmarks = computed(() =>
  allLayersQuestLandmarks.value.filter((lm) => (lm.layer ?? 0) === activeMapLayer.value),
)

const selectedQuestLandmark = computed(
  () => allLayersQuestLandmarks.value.find((lm) => lm.id === selectedQuestLandmarkId.value) || null,
)
const selectedQuestZone = computed(
  () => allLayersQuestZones.value.find((z) => z.id === selectedQuestZoneId.value) || null,
)

const trackedQuestMapList = computed(() => {
  const q = mapsStore.trackedQuest
  if (!q) return []
  const ids = q.mapIds?.length ? q.mapIds : Object.keys(q.mapTargets || {})
  return ids.map((id) => mapsStore.getMapById(id)).filter(Boolean)
})

// Pan & Zoom state for the 2D tactical map canvas
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const boardRef = ref(null)
const boardSize = ref(720)
let boardRo = null

function updateBoardSize() {
  const el = boardRef.value
  if (!el) return
  const availW = Math.max(300, el.clientWidth - 210)
  const availH = Math.max(300, el.clientHeight - 48)
  const next = Math.max(280, Math.floor(Math.min(availW, availH)))
  if (Math.abs(next - boardSize.value) >= 1) {
    boardSize.value = next
  }
}

function centerMapAt(xPct, yPct, targetZoom = 1.45) {
  const z = Math.min(2.6, Math.max(1, targetZoom))
  zoom.value = z
  if (z <= 1.02) {
    pan.value = { x: 0, y: 0 }
    return
  }
  const sz = boardSize.value || 720
  const dx = ((50 - xPct) / 100) * sz * z
  const dy = ((50 - yPct) / 100) * sz * z
  const maxPan = (z - 1) * 420 + 110
  pan.value = {
    x: Math.max(-maxPan, Math.min(maxPan, Math.round(dx))),
    y: Math.max(-maxPan, Math.min(maxPan, Math.round(dy))),
  }
}

function focusOnTrackedQuest(preferredLmId = '') {
  // Hide event/trial pins when focusing on a quest so quest areas/landmarks stand out cleanly
  selectedTrialId.value = ''
  selectedEventMarkerId.value = ''
  showLiveEventMarkers.value = false
  enabledEventIds.value = []
  enabledTrialIds.value = []

  const lms = allLayersQuestLandmarks.value
  const zns = allLayersQuestZones.value
  if (!lms.length && !zns.length) return

  if (preferredLmId) {
    const foundLm = lms.find((l) => l.id === preferredLmId)
    if (foundLm) {
      activeMapLayer.value = foundLm.layer ?? 0
      selectedQuestLandmarkId.value = foundLm.id
      selectedQuestZoneId.value = ''
      centerMapAt(foundLm.x, foundLm.y, 1.55)
      return
    }
  }

  if (lms.length) {
    const first = lms[0]
    activeMapLayer.value = first.layer ?? 0
    selectedQuestLandmarkId.value = first.id
    selectedQuestZoneId.value = ''
    centerMapAt(first.x, first.y, lms.length === 1 ? 1.5 : 1.32)
  } else if (zns.length) {
    const firstZ = zns[0]
    activeMapLayer.value = firstZ.layer ?? 0
    selectedQuestZoneId.value = firstZ.id
    selectedQuestLandmarkId.value = ''
    centerMapAt(firstZ.x, firstZ.y, zns.length === 1 ? 1.4 : 1.24)
  }
}

function selectQuestLandmark(lm) {
  selectedEventMarkerId.value = ''
  selectedQuestZoneId.value = ''
  activeMapLayer.value = lm.layer ?? 0
  if (selectedQuestLandmarkId.value === lm.id) {
    centerMapAt(lm.x, lm.y, Math.max(zoom.value, 1.55))
  } else {
    selectedQuestLandmarkId.value = lm.id
    centerMapAt(lm.x, lm.y, Math.max(zoom.value, 1.48))
  }
}

function selectQuestZone(z) {
  selectedEventMarkerId.value = ''
  selectedQuestLandmarkId.value = ''
  activeMapLayer.value = z.layer ?? 0
  selectedQuestZoneId.value = selectedQuestZoneId.value === z.id ? '' : z.id
  centerMapAt(z.x, z.y, Math.max(zoom.value, 1.38))
}

function clearTrackedQuest() {
  mapsStore.trackedQuestId = ''
  selectedQuestLandmarkId.value = ''
  selectedQuestZoneId.value = ''
}

// Counter-scale factor so markers stay crisp and never bloat when zooming in
const markerInvScale = computed(() => +(1 / Math.pow(zoom.value, 0.75)).toFixed(3))

// Progressive disclosure
const showMajorPoisNow = computed(
  () =>
    Boolean(
      zoom.value >= 1.22 ||
        selectedLootCategoryId.value ||
        mapsStore.layers.minorPois,
    ),
)
const showMinorPoisNow = computed(
  () => Boolean(mapsStore.layers.minorPois || zoom.value >= 1.55),
)

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

function adjustZoom(delta) {
  const next = Math.min(3.2, Math.max(1, +(zoom.value + delta).toFixed(2)))
  zoom.value = next
  if (next === 1) {
    pan.value = { x: 0, y: 0 }
  }
}

function onWheel(e) {
  e.preventDefault()
  const delta = e.deltaY < 0 ? 0.22 : -0.22
  adjustZoom(delta)
}

function onPointerDown(e) {
  if (e.button !== 0) return
  if (
    e.target.closest(
      '.poi-major-marker, .poi-minor-marker, .ext-marker, .event-landmark-marker, .event-pin-marker, .plant-zone-pill, .event-marker-inspector, .quest-landmark-pin, .quest-zone-pill, .quest-landmark-inspector, .ingame-right-legend, .canvas-status-overlay, .ingame-map-bottom-bar',
    )
  ) {
    return
  }
  isPanning.value = true
  panStart.value = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
}

let panRafId = 0
let pendingPanClientX = 0
let pendingPanClientY = 0

function onPointerMove(e) {
  if (!isPanning.value) return
  pendingPanClientX = e.clientX
  pendingPanClientY = e.clientY
  if (panRafId) return
  panRafId = requestAnimationFrame(() => {
    panRafId = 0
    if (!isPanning.value) return
    const maxPan = (zoom.value - 1) * 420 + 110
    const rawX = pendingPanClientX - panStart.value.x
    const rawY = pendingPanClientY - panStart.value.y
    pan.value = {
      x: Math.max(-maxPan, Math.min(maxPan, rawX)),
      y: Math.max(-maxPan, Math.min(maxPan, rawY)),
    }
  })
}

function onPointerUp() {
  isPanning.value = false
  if (panRafId) {
    cancelAnimationFrame(panRafId)
    panRafId = 0
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (showFilterForm.value) {
      showFilterForm.value = false
    } else if (selectedQuestLandmarkId.value || selectedQuestZoneId.value) {
      selectedQuestLandmarkId.value = ''
      selectedQuestZoneId.value = ''
    } else if (selectedEventMarkerId.value) {
      selectedEventMarkerId.value = ''
    } else if (selectedLootCategoryId.value) {
      selectedLootCategoryId.value = ''
    } else if (zoom.value > 1) {
      resetView()
    } else {
      router.push('/maps')
    }
  }
}

function syncFromRoute() {
  const m = currentMap.value
  mapsStore.previewMapId = m.id
  activeMapLayer.value = m.defaultLayer ?? 0
  selectedLootCategoryId.value = ''
  selectedEventMarkerId.value = ''
  selectedTrialId.value = ''
  selectedQuestLandmarkId.value = ''
  selectedQuestZoneId.value = ''
  enabledEventIds.value = []
  enabledTrialIds.value = []
  enabledPlantIds.value = []
  enabledEliteArcIds.value = []
  highlightedPoiRadius.value = 0
  showLiveEventMarkers.value = true
  mapsStore.layers.eventMarkers = true
  if (route.query.trial) {
    const trId = String(route.query.trial)
    selectedTrialId.value = trId
    enabledTrialIds.value = [trId]
  } else if (route.query.event) {
    const evId = String(route.query.event)
    mapsStore.setManualEvent(m.id, evId)
    enabledEventIds.value = [evId]
  }
  if (route.query.plant) {
    const rawPlants = String(route.query.plant)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (rawPlants.length) {
      enabledPlantIds.value = rawPlants
      mapsStore.layers.eventMarkers = true
    }
  }
  if (route.query.arc) {
    const rawArcs = String(route.query.arc)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (rawArcs.length) {
      enabledEliteArcIds.value = rawArcs
      mapsStore.layers.eventMarkers = true
    }
  }
  if (route.query.radius) {
    highlightedPoiRadius.value = Number(route.query.radius) || 4.5
  } else if (route.query.poi) {
    highlightedPoiRadius.value = 4.2
  }
  if (route.query.quest) {
    mapsStore.trackedQuestId = String(route.query.quest)
  }
  if (route.query.poi) {
    const poiQuery = String(route.query.poi).trim().toLowerCase()
    const pois = m.pois || []
    const matchedPoi = pois.find(
      (p) =>
        String(p.id).toLowerCase() === poiQuery ||
        String(p.name || '').toLowerCase().includes(poiQuery) ||
        String(p.enName || '').toLowerCase().includes(poiQuery),
    )
    if (matchedPoi) {
      activeMapLayer.value = matchedPoi.layer ?? 0
      mapsStore.selectedPoiId = matchedPoi.id
      if (matchedPoi.lockedRoom || matchedPoi.keyRequired) {
        mapsStore.layers.lockedRooms = true
      } else {
        mapsStore.layers.pois = true
        mapsStore.layers.minorPois = true
      }
      if (enabledPlantIds.value.length || enabledEliteArcIds.value.length) {
        const candidates = []
        for (const plId of enabledPlantIds.value) {
          for (const pm of m.plantMarkers?.[plId] || []) {
            candidates.push(pm)
          }
        }
        for (const arcId of enabledEliteArcIds.value) {
          for (const am of m.eliteArcMarkers?.[arcId] || []) {
            candidates.push(am)
          }
        }
        let nearest = null
        let bestDist = Infinity
        for (const pm of candidates) {
          const d = Math.hypot(pm.x - matchedPoi.x, pm.y - matchedPoi.y)
          if (d < bestDist) {
            bestDist = d
            nearest = pm
          }
        }
        if (nearest && bestDist <= 14) {
          selectedEventMarkerId.value = nearest.id
        }
      }
      centerMapAt(matchedPoi.x, matchedPoi.y, 1.52)
    } else if (enabledPlantIds.value.length) {
      const firstPl = (m.plantMarkers?.[enabledPlantIds.value[0]] || [])[0]
      if (firstPl) {
        activeMapLayer.value = firstPl.layer ?? 0
        selectedEventMarkerId.value = firstPl.id
        centerMapAt(firstPl.x, firstPl.y, 1.48)
      }
    } else if (enabledEliteArcIds.value.length) {
      const firstArc = (m.eliteArcMarkers?.[enabledEliteArcIds.value[0]] || [])[0]
      if (firstArc) {
        activeMapLayer.value = firstArc.layer ?? 0
        selectedEventMarkerId.value = firstArc.id
        centerMapAt(firstArc.x, firstArc.y, 1.48)
      }
    }
  } else if (enabledPlantIds.value.length) {
    const firstPl = (m.plantMarkers?.[enabledPlantIds.value[0]] || [])[0]
    if (firstPl) {
      activeMapLayer.value = firstPl.layer ?? 0
      selectedEventMarkerId.value = firstPl.id
      centerMapAt(firstPl.x, firstPl.y, 1.45)
    }
  } else if (enabledEliteArcIds.value.length) {
    const firstArc = (m.eliteArcMarkers?.[enabledEliteArcIds.value[0]] || [])[0]
    if (firstArc) {
      activeMapLayer.value = firstArc.layer ?? 0
      selectedEventMarkerId.value = firstArc.id
      centerMapAt(firstArc.x, firstArc.y, 1.45)
    }
  } else if (mapsStore.trackedQuestId) {
    focusOnTrackedQuest(route.query.lm ? String(route.query.lm) : '')
  }
}

watch(
  () => [
    route.params.mapId,
    route.query.quest,
    route.query.lm,
    route.query.poi,
    route.query.plant,
    route.query.arc,
    route.query.radius,
    route.query.event,
    route.query.trial,
  ],
  () => {
    resetView()
    syncFromRoute()
  },
  { immediate: true },
)

onMounted(() => {
  mapsStore.startClock()
  updateBoardSize()
  if (mapsStore.trackedQuestId) {
    focusOnTrackedQuest(route.query.lm ? String(route.query.lm) : '')
  }
  if (typeof ResizeObserver !== 'undefined' && boardRef.value) {
    boardRo = new ResizeObserver(() => updateBoardSize())
    boardRo.observe(boardRef.value)
  }
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  mapsStore.stopClock()
  if (boardRo) {
    boardRo.disconnect()
    boardRo = null
  }
  window.removeEventListener('keydown', onKeyDown)
})

function switchMap(mapId) {
  router.push({
    name: 'maps-detail',
    params: { mapId },
    query: mapsStore.trackedQuestId ? { quest: mapsStore.trackedQuestId } : {},
  })
}

function selectPoi(poi) {
  mapsStore.selectedPoiId = mapsStore.selectedPoiId === poi.id ? '' : poi.id
}

function open3DStage(stageKey) {
  router.push({
    name: 'maps-viewer',
    params: { stageKey },
    query: { fromMap: currentMap.value.id },
  })
}

function getStagePlaceName(st) {
  return formatStagePlaceName(st, currentMap.value?.name)
}

function selectQuestInMap(quest) {
  mapsStore.trackedQuestId = quest.id
  questsStore.selectedQuestId = quest.id
  const targetIds = quest.mapIds?.length ? quest.mapIds : Object.keys(quest.mapTargets || {})
  if (targetIds.length && !targetIds.includes(currentMap.value.id)) {
    switchMap(targetIds[0])
  } else {
    focusOnTrackedQuest()
  }
}
</script>

<template>
  <main class="tactical-detail-shell">
    <!-- Main 2-Column Tactical Workbench (Left: Quest System Sidebar, Right: 1:1 In-Game Tactical Map Stage) -->
    <div class="tmd-workbench">
      <!-- LEFT SIDEBAR: Deep Quest System Integration (任务系统联动工作台) -->
      <aside class="tmd-quest-panel">
        <!-- Quick Back & Map Switcher Header inside Left Sidebar -->
        <div class="tqp-nav-bar">
          <button
            type="button"
            class="tqp-back-btn"
            title="返回卡拉布雷塔大地图 (ESC)"
            @click="router.push('/maps')"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M13 8H4M7.5 4l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
            <span>返回大地图</span>
          </button>

          <select
            class="tqp-map-select"
            :value="currentMap.id"
            aria-label="切换目的地详图"
            @change="switchMap($event.target.value)"
          >
            <option v-for="m in mapsStore.maps" :key="m.id" :value="m.id">
              {{ m.name }}
            </option>
          </select>
        </div>

        <!-- 1. Currently Tracked Quest Card -->
        <section v-if="mapsStore.trackedQuest" class="trp-tracked-card ar-cream">
          <div class="ttc-top">
            <div class="ttc-badges">
              <span class="ttc-badge">
                <img
                  :src="assetUrl('game-maps/icons/T_UI_QUEST_Visit.png')"
                  alt=""
                  class="ttc-badge-icon"
                />
                当前追踪
              </span>
              <span
                v-if="mapsStore.trackedQuest.taskTypeLabel"
                class="ttc-type-tag"
                :style="{ '--cat-c': mapsStore.trackedQuest.taskTypeColor || '#26bf57' }"
              >
                {{ mapsStore.trackedQuest.taskTypeLabel }}
              </span>
            </div>
            <button
              type="button"
              class="ttc-clear-btn"
              title="取消追踪"
              @click="clearTrackedQuest"
            >
              ✕
            </button>
          </div>

          <h2 class="ttc-title">{{ mapsStore.trackedQuest.zhTitle }}</h2>

          <!-- Multi-Map Switcher for Cross-Map Quests -->
          <div v-if="trackedQuestMapList.length > 1" class="ttc-map-pills">
            <button
              v-for="tm in trackedQuestMapList"
              :key="tm.id"
              type="button"
              class="ttc-map-pill"
              :class="{ active: tm.id === currentMap.id }"
              @click="switchMap(tm.id)"
            >
              {{ tm.name }}
            </button>
          </div>

          <div
            v-if="parseQuestRequiredItems(mapsStore.trackedQuest).length"
            class="ttc-req"
          >
            <span class="ttc-req-label">需携带道具：</span>
            <div class="ttc-req-items">
              <div
                v-for="(it, idx) in parseQuestRequiredItems(mapsStore.trackedQuest)"
                :key="idx"
                class="ttc-req-chip"
                :title="it.fullLabel"
              >
                <img :src="it.icon" :alt="it.zhName" />
                <strong>{{ it.count ? `${it.count} ` : '' }}{{ it.zhName }}</strong>
              </div>
            </div>
          </div>

          <!-- Interactive Spatial Targets on Current Map -->
          <div
            v-if="allLayersQuestLandmarks.length || allLayersQuestZones.length"
            class="ttc-targets-box"
          >
            <div class="ttc-targets-head">
              <span>本图目标点位 (点击定位)</span>
              <button
                type="button"
                class="ttc-focus-btn"
                @click="focusOnTrackedQuest()"
              >
                居中视野 ⌖
              </button>
            </div>

            <!-- Landmarks List -->
            <div v-if="allLayersQuestLandmarks.length" class="ttc-target-list">
              <button
                v-for="lm in allLayersQuestLandmarks"
                :key="lm.id"
                type="button"
                class="ttc-target-item landmark"
                :class="{ active: selectedQuestLandmarkId === lm.id }"
                @click="selectQuestLandmark(lm)"
              >
                <span class="tti-step">{{ lm.step }}</span>
                <div class="tti-main">
                  <strong>{{ lm.title }}</strong>
                  <span>{{ lm.areaName }}</span>
                </div>
              </button>
            </div>

            <!-- Green Zones List -->
            <div v-if="allLayersQuestZones.length" class="ttc-target-list">
              <button
                v-for="z in allLayersQuestZones"
                :key="z.id"
                type="button"
                class="ttc-target-item zone"
                :class="{ active: selectedQuestZoneId === z.id }"
                @click="selectQuestZone(z)"
              >
                <span class="tti-zone-dot"></span>
                <div class="tti-main">
                  <strong>{{ z.label }}</strong>
                  <span v-if="z.subLabel">{{ z.subLabel }}</span>
                </div>
              </button>
            </div>
          </div>

          <div v-else class="ttc-desc-box">
            <div class="ttc-any-hint">🌐 全图任意位置均可完成，无需划定区域</div>
            <p class="ttc-desc-text">
              {{ mapsStore.trackedQuest.zhDescription }}
            </p>
          </div>
        </section>

        <!-- 2. All Quests Available in this Map Sector -->
        <div class="trp-list-head">
          <div class="tlh-left">
            <h3>{{ currentMap.name }}任务 ({{ displayedMapQuests.length }})</h3>
          </div>

          <div class="tlh-right-actions">
            <button
              type="button"
              class="tlh-expand-all-btn"
              :class="{ active: expandAllQuestDescs }"
              :title="expandAllQuestDescs ? '收起全部任务详情（悬停可预览）' : '展开全部任务详情'"
              @click="toggleExpandAllQuestDescs"
            >
              <span>{{ expandAllQuestDescs ? '收起' : '详情' }}</span>
              <svg
                class="mqr-chevron-svg"
                :class="{ open: expandAllQuestDescs }"
                viewBox="0 0 12 12"
                aria-hidden="true"
              >
                <path
                  d="M2.5 4.5L6 8l3.5-3.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>

            <div class="ar-tabs seg-mini">
              <button
                type="button"
                class="ar-tab"
                :class="{ active: questFilterMode === 'TODO' }"
                @click="questFilterMode = 'TODO'"
              >
                待办
              </button>
              <button
                type="button"
                class="ar-tab"
                :class="{ active: questFilterMode === 'ALL' }"
                @click="questFilterMode = 'ALL'"
              >
                全部
              </button>
            </div>
          </div>
        </div>

        <div class="trp-quest-scroll" @mouseleave="onQuestRowLeave">
          <article
            v-for="q in displayedMapQuests"
            :key="q.id"
            class="map-quest-row ar-row"
            :class="{
              active: mapsStore.trackedQuestId === q.id,
              done: questsStore.isQuestDone(q.id),
              expanded: isQuestDescExpanded(q.id),
            }"
            @click="selectQuestInMap(q)"
            @mouseenter="onQuestRowEnter(q, $event)"
            @mousemove="onQuestRowMove($event)"
            @mouseleave="onQuestRowLeave"
          >
            <button
              type="button"
              class="mqr-check"
              :class="{ checked: questsStore.isQuestDone(q.id) }"
              title="切换完成状态"
              @click.stop="questsStore.toggleQuestDone(q.id)"
            >
              <svg v-if="questsStore.isQuestDone(q.id)" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <div class="mqr-body">
              <div class="mqr-top">
                <strong class="mqr-title">{{ q.zhTitle }}</strong>
                <span
                  v-if="q.taskTypeLabel"
                  class="mqr-cat-tag"
                  :style="{ '--cat-c': q.taskTypeColor || '#26bf57' }"
                >
                  {{ q.taskTypeLabel }}
                </span>
                <span class="mqr-trader">
                  <i :style="{ background: traderMeta[q.trader]?.color || 'var(--tx-3)' }"></i>
                  {{ traderMeta[q.trader]?.name || q.trader }}
                </span>

                <button
                  v-if="q.zhDescription"
                  type="button"
                  class="mqr-expand-btn"
                  :class="{ open: isQuestDescExpanded(q.id) }"
                  :title="isQuestDescExpanded(q.id) ? '收起具体内容' : '展开具体内容'"
                  @click.stop="toggleQuestDesc(q.id)"
                >
                  <svg class="mqr-chevron-svg" :class="{ open: isQuestDescExpanded(q.id) }" viewBox="0 0 12 12" aria-hidden="true">
                    <path
                      d="M2.5 4.5L6 8l3.5-3.5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <p v-if="q.zhDescription && isQuestDescExpanded(q.id)" class="mqr-desc">
                {{ q.zhDescription }}
              </p>
            </div>
          </article>

          <div v-if="!displayedMapQuests.length" class="trp-empty">
            <p>当前战区没有待办任务</p>
            <button
              type="button"
              class="ar-btn ar-btn--ghost ar-btn--sm"
              @click="questFilterMode = 'ALL'"
            >
              查看全部 {{ allMapQuests.length }} 个任务
            </button>
          </div>
        </div>
      </aside>

      <!-- Floating Cursor Tooltip for Hovered Quest Row -->
      <Teleport to="body">
        <div
          v-if="hoveredQuest && hoveredQuest.zhDescription"
          class="mqr-cursor-tooltip"
          :style="{
            left: `${questTooltipPos.x}px`,
            top: `${questTooltipPos.y}px`,
          }"
        >
          <div class="mct-head">
            <strong class="mct-title">{{ hoveredQuest.zhTitle }}</strong>
            <span
              v-if="hoveredQuest.taskTypeLabel"
              class="mqr-cat-tag"
              :style="{ '--cat-c': hoveredQuest.taskTypeColor || '#26bf57' }"
            >
              {{ hoveredQuest.taskTypeLabel }}
            </span>
            <span class="mct-trader">
              <i :style="{ background: traderMeta[hoveredQuest.trader]?.color || 'var(--tx-3)' }"></i>
              {{ traderMeta[hoveredQuest.trader]?.name || hoveredQuest.trader }}
            </span>
          </div>
          <p class="mct-desc">{{ hoveredQuest.zhDescription }}</p>
          <div
            v-if="parseQuestRequiredItems(hoveredQuest).length"
            class="mct-reqs"
          >
            <span
              v-for="(it, idx) in parseQuestRequiredItems(hoveredQuest)"
              :key="idx"
              class="mct-req-chip"
            >
              <img :src="it.icon" alt="" />
              <b>{{ it.count ? `${it.count} ` : '' }}{{ it.zhName }}</b>
            </span>
          </div>
          <div class="mct-foot">点击任务在右侧地图中定位与追踪</div>
        </div>
      </Teleport>

      <!-- MAIN RIGHT AREA: 1:1 Authentic In-Game Tactical Map Stage (Screenshot 1) -->
      <section
        class="tmd-canvas-stage"
        :class="[`env-${activeState.activePrimary.id}`, { panning: isPanning }]"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <!-- Top-Left Minimal Status, Multi-Layer Switcher & Special Event Marker Switcher -->
        <div class="canvas-status-overlay">
          <div class="cso-top-row">
            <div v-if="currentMap.layers?.length > 1" class="layer-switch-bar">
              <button
                v-for="lyr in currentMap.layers"
                :key="lyr.id"
                type="button"
                class="lsb-btn"
                :class="{ active: activeMapLayer === lyr.id }"
                @click.stop="activeMapLayer = lyr.id"
              >
                <span>{{ lyr.label }}</span>
              </button>
            </div>

            <!-- Live / Manual Event & Weekly Trials Status Pill -->
            <div class="cso-pill">
              <button
                type="button"
                class="cso-live-btn"
                :class="{ active: !activeState.isManual && !selectedTrialId }"
                title="点击恢复跟随服务器实时轮换事件"
                @click.stop="selectEventOnMap('LIVE')"
              >
                <span
                  class="cso-live-dot"
                  :class="{ manual: activeState.isManual || Boolean(selectedTrialId) }"
                ></span>
                <span>
                  {{
                    selectedTrialId
                      ? '试炼导航'
                      : activeState.isManual
                        ? '预览模式'
                        : `实时 (${mapsStore.selectedServer.name})`
                  }}
                </span>
              </button>

              <template v-if="activeTrialCategory">
                <img
                  v-if="activeTrialCategory.icon"
                  :src="assetUrl(activeTrialCategory.icon)"
                  alt=""
                  class="cso-icon"
                />
                <strong>{{ activeTrialCategory.name }}</strong>
              </template>
              <template v-else-if="activeState.activePrimary.id !== 'standard-patrol'">
                <img
                  v-if="activeState.activePrimary.gameIcon"
                  :src="assetUrl(activeState.activePrimary.gameIcon)"
                  alt=""
                  class="cso-icon"
                />
                <strong>{{ activeState.activePrimary.name }}</strong>
              </template>
              <template v-else-if="!activeState.activeSecondary">
                <span class="cso-std-label">常规部署</span>
              </template>

              <template v-if="!selectedTrialId && !activeState.isManual && activeState.activeSecondary">
                <span
                  v-if="activeState.activePrimary.id !== 'standard-patrol'"
                  style="opacity: 0.55"
                >
                  +
                </span>
                <img
                  v-if="activeState.activeSecondary.gameIcon"
                  :src="assetUrl(activeState.activeSecondary.gameIcon)"
                  alt=""
                  class="cso-icon"
                />
                <strong>{{ activeState.activeSecondary.name }}</strong>
              </template>

              <button
                v-if="activeEventMarkers.length || activePlantZones.length"
                type="button"
                class="cso-marker-count"
                title="点击隐藏地图上的事件/试炼/植物/精英ARC标注"
                @click.stop="clearEventAndTrialMarkers"
              >
                已标注 {{ activeEventMarkers.length || activePlantZones.length }} 处 ✕
              </button>

              <!-- Unified Toggle: Icon & Event Filter Form (Matches Overlay Window) -->
              <div class="cso-mode-tabs">
                <button
                  type="button"
                  class="cmt-btn"
                  :class="{ active: showFilterForm }"
                  title="展开/收起地标、钥匙房、精英ARC、植物与自然、事件与试炼筛选表单"
                  @click.stop="showFilterForm = !showFilterForm"
                >
                  <span>图标筛选</span>
                  <em class="cmt-count ar-num">{{ activeFilterSwitchesCount }}</em>
                </button>
              </div>
            </div>
          </div>

          <!-- IMAGE-2-STYLE SELECTABLE ICON & EVENT FILTER FORM (1:1 with Overlay Window) -->
          <aside
            v-if="showFilterForm"
            class="omr-filter-popover tmd-filter-popover"
            @wheel.stop
            @pointerdown.stop
          >
            <div class="ofp-top-bar">
              <span class="ofp-top-title">图标筛选</span>
              <button
                type="button"
                class="ofp-close-btn"
                title="收起图标筛选面板"
                @click="showFilterForm = false"
              >
                ✕
              </button>
            </div>

            <div class="ofp-scroll">
              <!-- GROUP 1: 地点 (Base Locations & Current Live Event) -->
              <section class="ofp-group">
                <header class="ofp-group-head accent-blue">
                  <button
                    type="button"
                    class="ofp-collapse-btn"
                    @click="locGroupCollapsed = !locGroupCollapsed"
                  >
                    <span class="ofp-chevron" :class="{ collapsed: locGroupCollapsed }">▾</span>
                    <strong>地点</strong>
                    <em class="ar-num">{{ locationGroupTotalCount }}</em>
                  </button>

                  <button
                    type="button"
                    class="ofp-eye-btn"
                    :class="{ muted: !isAnyLocationRowOn }"
                    title="一键开启/关闭全部地点图层"
                    @click="toggleAllLocationRows"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <path
                        d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
                        stroke="currentColor"
                        stroke-width="1.4"
                      />
                      <circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4" />
                    </svg>
                  </button>
                </header>

                <div v-if="!locGroupCollapsed" class="ofp-list">
                  <div
                    v-for="row in locationFormRows"
                    :key="row.key"
                    class="ofp-row"
                    :class="{ on: row.on }"
                    @click="row.toggle()"
                  >
                    <div class="ofp-icon-sq" :class="{ on: row.on }">
                      <img :src="assetUrl(row.icon)" alt="" />
                    </div>

                    <div class="ofp-label-wrap">
                      <span class="ofp-name">{{ row.label }}</span>
                      <small v-if="row.subTag" class="ofp-sub-badge">{{ row.subTag }}</small>
                    </div>

                    <span class="ofp-count ar-num">{{ row.count }}</span>

                    <button
                      type="button"
                      class="ofp-switch"
                      :class="{ on: row.on }"
                      :aria-checked="row.on"
                      role="switch"
                      @click.stop="row.toggle()"
                    >
                      <span class="ofp-knob"></span>
                    </button>
                  </div>
                </div>
              </section>

              <!-- GROUP 2: 植物与自然 (Scrappy & Workshop Plant Foraging Spawns & Ranges) -->
              <section
                v-if="mapPlantCategories.length"
                class="ofp-group"
              >
                <header class="ofp-group-head accent-green">
                  <button
                    type="button"
                    class="ofp-collapse-btn"
                    @click="plantGroupCollapsed = !plantGroupCollapsed"
                  >
                    <span class="ofp-chevron" :class="{ collapsed: plantGroupCollapsed }">▾</span>
                    <strong>植物与自然</strong>
                    <em class="ar-num">{{ plantsTotalCount }}</em>
                  </button>

                  <button
                    type="button"
                    class="ofp-eye-btn"
                    :class="{ muted: !isAnyPlantOn }"
                    title="一键开启/关闭全部植物采集点与范围标注"
                    @click="toggleAllPlants"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <path
                        d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
                        stroke="currentColor"
                        stroke-width="1.4"
                      />
                      <circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4" />
                    </svg>
                  </button>
                </header>

                <div v-if="!plantGroupCollapsed" class="ofp-list">
                  <div
                    v-for="pl in mapPlantCategories"
                    :key="`pl-${pl.id}`"
                    class="ofp-row"
                    :class="{ on: isPlantEnabled(pl.id) }"
                    :style="{ '--plant-c': pl.accent || '#4ade80' }"
                    @click="togglePlantItem(pl.id)"
                  >
                    <div class="ofp-icon-plant" :class="{ on: isPlantEnabled(pl.id) }">
                      <img :src="assetUrl(pl.icon)" alt="" />
                    </div>

                    <div class="ofp-label-wrap">
                      <span class="ofp-name">{{ pl.name }}</span>
                      <small class="ofp-kind-tag plant">{{ pl.kindLabel }}</small>
                    </div>

                    <span class="ofp-count ar-num" :title="`共 ${pl.totalNodes} 处植株刷新点`">
                      {{ pl.count }}
                    </span>

                    <button
                      type="button"
                      class="ofp-switch plant-sw"
                      :class="{ on: isPlantEnabled(pl.id) }"
                      :aria-checked="isPlantEnabled(pl.id)"
                      role="switch"
                      @click.stop="togglePlantItem(pl.id)"
                    >
                      <span class="ofp-knob"></span>
                    </button>
                  </div>
                </div>
              </section>

              <!-- GROUP 3: 精英 ARC (Medium/Heavy Elite ARC Spawns & Activity Ranges, Small ARCs Excluded) -->
              <section
                v-if="mapEliteArcCategories.length"
                class="ofp-group"
              >
                <header class="ofp-group-head accent-red">
                  <button
                    type="button"
                    class="ofp-collapse-btn"
                    @click="arcGroupCollapsed = !arcGroupCollapsed"
                  >
                    <span class="ofp-chevron" :class="{ collapsed: arcGroupCollapsed }">▾</span>
                    <strong>精英 ARC</strong>
                    <em class="ar-num">{{ eliteArcsTotalCount }}</em>
                  </button>

                  <button
                    type="button"
                    class="ofp-eye-btn"
                    :class="{ muted: !isAnyEliteArcOn }"
                    title="一键开启/关闭全部精英ARC刷新点与活动范围标注"
                    @click="toggleAllEliteArcs"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <path
                        d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
                        stroke="currentColor"
                        stroke-width="1.4"
                      />
                      <circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4" />
                    </svg>
                  </button>
                </header>

                <div v-if="!arcGroupCollapsed" class="ofp-list">
                  <div
                    v-for="arc in mapEliteArcCategories"
                    :key="`arc-${arc.id}`"
                    class="ofp-row"
                    :class="{ on: isEliteArcEnabled(arc.id) }"
                    :style="{ '--arc-c': arc.accent || '#ef4444' }"
                    @click="toggleEliteArcItem(arc.id)"
                  >
                    <div class="ofp-icon-arc" :class="{ on: isEliteArcEnabled(arc.id) }">
                      <img :src="assetUrl(arc.icon)" alt="" />
                    </div>

                    <div class="ofp-label-wrap">
                      <span class="ofp-name">{{ arc.name }}</span>
                      <small class="ofp-kind-tag arc">{{ arc.kindLabel }}</small>
                    </div>

                    <span class="ofp-count ar-num" :title="`共 ${arc.totalUnits} 处刷新点位`">
                      {{ arc.count }}
                    </span>

                    <button
                      type="button"
                      class="ofp-switch arc-sw"
                      :class="{ on: isEliteArcEnabled(arc.id) }"
                      :aria-checked="isEliteArcEnabled(arc.id)"
                      role="switch"
                      @click.stop="toggleEliteArcItem(arc.id)"
                    >
                      <span class="ofp-knob"></span>
                    </button>
                  </div>
                </div>
              </section>

              <!-- GROUP 4: 事件与试炼 (All Special Events & Weekly Trials Landmarks on this map) -->
              <section
                v-if="mapSpecialEvents.length || mapTrialCategories.length"
                class="ofp-group"
              >
                <header class="ofp-group-head accent-orange">
                  <button
                    type="button"
                    class="ofp-collapse-btn"
                    @click="evGroupCollapsed = !evGroupCollapsed"
                  >
                    <span class="ofp-chevron" :class="{ collapsed: evGroupCollapsed }">▾</span>
                    <strong>事件与试炼</strong>
                    <em class="ar-num">{{ eventsAndTrialsTotalCount }}</em>
                  </button>

                  <button
                    type="button"
                    class="ofp-eye-btn"
                    :class="{ muted: !isAnyEventOrTrialOn }"
                    title="一键开启/关闭全部特殊事件与试炼地标"
                    @click="toggleAllEventsAndTrials"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <path
                        d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z"
                        stroke="currentColor"
                        stroke-width="1.4"
                      />
                      <circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.4" />
                    </svg>
                  </button>
                </header>

                <div v-if="!evGroupCollapsed" class="ofp-list">
                  <!-- Special Events Rows -->
                  <div
                    v-for="ev in mapSpecialEvents"
                    :key="`ev-${ev.id}`"
                    class="ofp-row"
                    :class="{ on: isEventEnabled(ev.id) }"
                    @click="toggleEventItem(ev.id)"
                  >
                    <div class="ofp-icon-circle" :class="{ on: isEventEnabled(ev.id) }">
                      <img :src="assetUrl(ev.icon)" alt="" />
                    </div>

                    <div class="ofp-label-wrap">
                      <span class="ofp-name">{{ ev.name }}</span>
                      <small class="ofp-kind-tag ev">事件</small>
                    </div>

                    <span class="ofp-count ar-num">{{ ev.count }}</span>

                    <button
                      type="button"
                      class="ofp-switch"
                      :class="{ on: isEventEnabled(ev.id) }"
                      :aria-checked="isEventEnabled(ev.id)"
                      role="switch"
                      @click.stop="toggleEventItem(ev.id)"
                    >
                      <span class="ofp-knob"></span>
                    </button>
                  </div>

                  <!-- Weekly Trials Rows -->
                  <div
                    v-for="tr in mapTrialCategories"
                    :key="`tr-${tr.id}`"
                    class="ofp-row"
                    :class="{ on: isTrialEnabled(tr.id) }"
                    @click="toggleTrialItem(tr.id)"
                  >
                    <div class="ofp-icon-circle" :class="{ on: isTrialEnabled(tr.id) }">
                      <img :src="assetUrl(tr.icon)" alt="" />
                    </div>

                    <div class="ofp-label-wrap">
                      <span class="ofp-name">{{ tr.name }}</span>
                      <small class="ofp-kind-tag tr">试炼</small>
                    </div>

                    <span class="ofp-count ar-num">{{ tr.count }}</span>

                    <button
                      type="button"
                      class="ofp-switch"
                      :class="{ on: isTrialEnabled(tr.id) }"
                      :aria-checked="isTrialEnabled(tr.id)"
                      role="switch"
                      @click.stop="toggleTrialItem(tr.id)"
                    >
                      <span class="ofp-knob"></span>
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>

        <!-- 1:1 Square Transformable Tactical Map Board (Matches Screenshot 1 Vignette & Proportions) -->
        <div ref="boardRef" class="tactical-board-center">
          <div
            class="tactical-map-plane"
            :style="{
              width: `${boardSize}px`,
              height: `${boardSize}px`,
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              '--inv-scale': markerInvScale,
            }"
          >
            <!-- 1. Official Extracted 2048x2048 Tactical Map Texture -->
            <template v-if="currentLayerObj.overlayOnBase">
              <img
                :src="assetUrl(currentMap.tacticalImage)"
                :alt="currentMap.name"
                class="tactical-base-img dimmed-for-underground"
                draggable="false"
              />
              <img
                :src="assetUrl(currentLayerObj.image)"
                :alt="`${currentMap.name} - ${currentLayerObj.label}`"
                class="tactical-overlay-img"
                draggable="false"
              />
            </template>
            <template v-else>
              <img
                :src="assetUrl(currentLayerObj.image || currentMap.tacticalImage)"
                :alt="currentMap.name"
                class="tactical-base-img"
                draggable="false"
              />
            </template>

            <!-- Soft Radial Dark Vignette Mask around Map Edges (Matches Screenshot 1 seamlessly) -->
            <div class="tactical-vignette-mask" aria-hidden="true"></div>

            <!-- 2. Official AreaSplinePoints Polygons (Red & Yellow Loot Zone Outlines in Screenshot 1) -->
            <svg
              class="tactical-map-svg"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              fill="none"
            >
              <g v-if="mapsStore.layers.lootZones" class="loot-zones-layer">
                <polygon
                  v-for="lz in layerLootZones"
                  :key="lz.id"
                  :points="polyPointsSquare(lz.polygon)"
                  :fill="
                    lz.tier === 'high'
                      ? 'rgba(255, 59, 47, 0.13)'
                      : lz.tier === 'medium'
                        ? 'rgba(255, 188, 19, 0.12)'
                        : 'rgba(245, 238, 224, 0.04)'
                  "
                  :stroke="
                    activePoi?.id === lz.poiId
                      ? '#ffffff'
                      : lz.tier === 'high'
                        ? '#ff3b2f'
                        : lz.tier === 'medium'
                          ? '#ffbc13'
                          : 'rgba(245, 238, 224, 0.4)'
                  "
                  :stroke-width="activePoi?.id === lz.poiId ? 3.2 : 2.3"
                  stroke-linejoin="round"
                  class="area-spline-poly"
                />
              </g>

              <!-- 2B. Puzzle Signal Vectors (No circular zones or patrol paths) -->
              <g
                v-if="mapsStore.layers.eventMarkers && activeEventMarkers.length"
                class="event-zones-svg-layer"
              >
                <template v-for="em in activeEventMarkers" :key="`svg-${em.id}`">
                  <!-- Puzzle / Signal Guide Vector (only shown when a marker is clicked) -->
                  <line
                    v-if="em.targetXY && selectedEventMarkerId === em.id"
                    :x1="em.x * 10"
                    :y1="em.y * 10"
                    :x2="em.targetXY[0] * 10"
                    :y2="em.targetXY[1] * 10"
                    :stroke="em.accent || '#ffbc13'"
                    stroke-width="2.2"
                    stroke-dasharray="7 6"
                    stroke-opacity="0.78"
                    class="ev-svg-link-line"
                  />
                </template>
              </g>

              <!-- 2B-Plant. Plant & Foraging Range Circles (小鸡仔/工坊植物采集范围标注) -->
              <g
                v-if="activePlantZones.length"
                class="plant-zones-svg-layer"
              >
                <template v-for="pz in activePlantZones" :key="`pzone-${pz.id}`">
                  <circle
                    :cx="pz.x * 10"
                    :cy="pz.y * 10"
                    :r="(pz.radius || 4.5) * 10"
                    :fill="pz.accent || '#4ade80'"
                    fill-opacity="0.16"
                    :stroke="pz.accent || '#4ade80'"
                    stroke-width="2.8"
                    class="plant-range-circle"
                  />
                  <circle
                    :cx="pz.x * 10"
                    :cy="pz.y * 10"
                    :r="Math.max(14, (pz.radius || 4.5) * 10 - 6)"
                    fill="none"
                    :stroke="pz.accent || '#4ade80'"
                    stroke-width="1.6"
                    stroke-dasharray="7 5"
                    stroke-opacity="0.88"
                    class="plant-range-circle-dash"
                  />
                </template>
              </g>

              <!-- 2C. Tracked Quest Green Area Ranges & Sequential Step Route Lines -->
              <g
                v-if="activeQuestZones.length || activeQuestLandmarks.length"
                class="quest-green-zones-svg-layer"
              >
                <template v-for="z in activeQuestZones" :key="`qzone-${z.id}`">
                  <template v-if="z.polygon?.length">
                    <polygon
                      :points="polyPointsSquare(z.polygon)"
                      fill="rgba(38, 191, 87, 0.24)"
                      stroke="#26bf57"
                      stroke-width="3.4"
                      stroke-linejoin="round"
                      class="quest-green-poly"
                    />
                    <polygon
                      :points="polyPointsSquare(z.polygon)"
                      fill="none"
                      stroke="#8affb3"
                      stroke-width="1.8"
                      stroke-dasharray="9 6"
                      stroke-linejoin="round"
                      class="quest-green-poly-dash"
                    />
                  </template>
                  <template v-else>
                    <circle
                      :cx="z.x * 10"
                      :cy="z.y * 10"
                      :r="z.r || 50"
                      fill="rgba(38, 191, 87, 0.22)"
                      stroke="#26bf57"
                      stroke-width="3.2"
                      class="quest-green-circle"
                    />
                    <circle
                      :cx="z.x * 10"
                      :cy="z.y * 10"
                      :r="Math.max(18, (z.r || 50) - 7)"
                      fill="none"
                      stroke="#8affb3"
                      stroke-width="1.7"
                      stroke-dasharray="8 6"
                      class="quest-green-circle-dash"
                    />
                  </template>
                </template>

                <template v-for="lm in activeQuestLandmarks" :key="`qlm-line-${lm.id}`">
                  <line
                    v-if="lm.targetXY"
                    :x1="lm.x * 10"
                    :y1="lm.y * 10"
                    :x2="lm.targetXY[0] * 10"
                    :y2="lm.targetXY[1] * 10"
                    stroke="#5dff8e"
                    stroke-width="2.4"
                    stroke-dasharray="8 6"
                    stroke-opacity="0.88"
                    class="quest-step-line"
                  />
                </template>
              </g>
            </svg>

            <!-- 3. ZOOM 0: In-Game Dark Pill Neighborhood Labels (郊区, 新区, 西村, 老城区 in Screenshot 1) -->
            <div
              v-if="mapsStore.layers.pois"
              class="pois-macro-layer"
              aria-hidden="true"
            >
              <div
                v-for="mp in macroPois"
                :key="mp.id"
                class="poi-macro-pill"
                :style="{ left: `${mp.x}%`, top: `${mp.y}%` }"
              >
                <span>{{ mp.name }}</span>
              </div>
            </div>

            <!-- 4. Official Extraction Points & Raider Hatches (White Rounded-Square Style from Screenshot 1) -->
            <div class="extractions-layer">
              <template v-for="ext in currentMap.extractions" :key="ext.id">
                <!-- Standard Extraction Point (地铁站 / 货运电梯 / 通风井) -->
                <div
                  v-if="ext.type !== 'hatch' && mapsStore.layers.extractions"
                  class="ext-marker return-point"
                  :class="{
                    reduced: activeState.reducedExtractions,
                    'show-label': zoom >= 1.45 || selectedExtId === ext.id,
                  }"
                  :style="{ left: `${ext.x}%`, top: `${ext.y}%` }"
                  :title="`${ext.name} (${ext.enName})\n类型：${ext.typeLabel}`"
                  @click.stop="selectedExtId = selectedExtId === ext.id ? '' : ext.id"
                >
                  <div class="ingame-white-sq">
                    <img :src="assetUrl(ext.icon)" :alt="ext.typeLabel" class="iws-glyph" />
                  </div>
                  <span class="em-caption">{{ ext.name }}</span>
                </div>

                <!-- Raider Hatch (奇袭者暗门 — Same White Rounded-Square Style as Screenshot 1) -->
                <div
                  v-else-if="ext.type === 'hatch' && mapsStore.layers.hatches"
                  class="ext-marker hatch-point"
                  :class="{
                    disabled: activeState.hatchesDisabled,
                    'show-label': zoom >= 1.55 || selectedExtId === ext.id,
                  }"
                  :style="{ left: `${ext.x}%`, top: `${ext.y}%` }"
                  :title="
                    activeState.hatchesDisabled
                      ? `${ext.name} (${ext.enName})\n🚫 当前环境 (${activeState.activePrimary.name}) 下奇袭者暗门已锁死关闭`
                      : `${ext.name} (${ext.enName})\n类型：奇袭者暗门`
                  "
                  @click.stop="selectedExtId = selectedExtId === ext.id ? '' : ext.id"
                >
                  <div class="ingame-white-sq">
                    <img :src="assetUrl(ext.icon)" :alt="ext.typeLabel" class="iws-glyph" />
                    <i v-if="activeState.hatchesDisabled" class="em-lock-slash">✕</i>
                  </div>
                  <span class="em-caption">
                    {{ ext.name }}
                    <em v-if="activeState.hatchesDisabled">(关闭)</em>
                  </span>
                </div>
              </template>
            </div>

            <!-- 5. ZOOM 1: Major Named Buildings & Locked Key Rooms -->
            <div
              v-if="(mapsStore.layers.pois && showMajorPoisNow) || mapsStore.layers.lockedRooms"
              class="pois-major-layer"
            >
              <template v-for="poi in majorPois" :key="poi.id">
                <div
                  v-if="
                    (poi.lockedRoom || poi.keyRequired
                      ? mapsStore.layers.lockedRooms
                      : mapsStore.layers.pois && showMajorPoisNow) &&
                    (!selectedLootCategoryId || poiMatchesLootFilter(poi))
                  "
                  class="poi-major-marker"
                  :class="[
                    `tier-${poi.tier}`,
                    {
                      active: activePoi?.id === poi.id || poiMatchesLootFilter(poi),
                      'has-3d': Boolean(poi.linkedStage),
                    },
                  ]"
                  :style="{ left: `${poi.x}%`, top: `${poi.y}%` }"
                  :title="`${poi.name} (${poi.enName})${poi.keyRequired ? `\n🔑 ${poi.keyRequired}` : ''}${poi.desc ? `\n${poi.desc}` : ''}`"
                  role="button"
                  tabindex="0"
                  @click.stop="selectPoi(poi)"
                  @keydown.enter.stop="selectPoi(poi)"
                >
                  <div class="pmj-title-row">
                    <img
                      v-if="poi.keyRequired || poi.lockedRoom"
                      :src="assetUrl('items/T_UI_Utility_Key.png')"
                      alt=""
                      class="pmj-key-icon"
                    />
                    <strong class="pmj-name">{{ poi.name }}</strong>
                    <button
                      v-if="poi.linkedStage"
                      type="button"
                      class="pmj-3d-badge"
                      title="点击进入 3D 机关解谜图"
                      @click.stop="open3DStage(poi.linkedStage)"
                    >
                      3D
                    </button>
                  </div>

                  <div v-if="poi.lootTags?.length" class="pmj-loot-row">
                    <img
                      v-for="lt in poi.lootTags"
                      :key="lt.id"
                      :src="assetUrl(lt.icon)"
                      :alt="lt.zh"
                      :title="`产出：${lt.zh}`"
                      class="pmj-loot-icon"
                    />
                  </div>
                </div>
              </template>
            </div>

            <!-- 6. ZOOM 2: Minor Sub-Landmarks (Shown when Zoom >= 155% or Toggled) -->
            <div v-if="mapsStore.layers.pois && showMinorPoisNow" class="pois-minor-layer">
              <template v-for="poi in normalMinorPois" :key="poi.id">
                <div
                  v-if="!selectedLootCategoryId || poiMatchesLootFilter(poi)"
                  class="poi-minor-marker"
                  :class="{ active: activePoi?.id === poi.id }"
                  :style="{ left: `${poi.x}%`, top: `${poi.y}%` }"
                  :title="`${poi.name} (${poi.enName})`"
                  role="button"
                  tabindex="0"
                  @click.stop="selectPoi(poi)"
                >
                  <span class="pmn-dot"></span>
                  <span class="pmn-label">{{ poi.name }}</span>
                </div>
              </template>
            </div>

            <!-- 7. SPECIAL EVENT LANDMARKS & SPAWN NODES LAYER (女王/收割者、族母、奇袭者箱、航向重定向等) -->
            <div
              v-if="mapsStore.layers.eventMarkers && activeEventMarkers.length"
              class="event-markers-layer"
            >
              <template v-for="em in activeEventMarkers" :key="em.id">
                <!-- TYPE A: Boss / Major Event Landmark (女王收割者、族母、坠落帝王核心、隐藏地堡、封锁大门) -->
                <div
                  v-if="em.kind === 'boss-landmark' || em.kind === 'puzzle-hub'"
                  class="event-landmark-marker"
                  :class="[
                    `kind-${em.kind}`,
                    { active: selectedEventMarkerId === em.id },
                  ]"
                  :style="{
                    left: `${em.x}%`,
                    top: `${em.y}%`,
                    '--ev-accent': em.accent || '#ffbc13',
                  }"
                  role="button"
                  tabindex="0"
                  @click.stop="selectEventMarker(em)"
                  @keydown.enter.stop="selectEventMarker(em)"
                >
                  <div class="elm-crest-wrap">
                    <div class="elm-crest">
                      <img :src="assetUrl(em.icon)" :alt="em.title" class="elm-main-icon" />
                    </div>
                    <!-- Secondary Boss/Guard Badge (e.g. Queen Peppermint Icon on Harvester) -->
                    <div
                      v-if="em.secondaryIcon"
                      class="elm-sub-crest"
                    >
                      <img :src="assetUrl(em.secondaryIcon)" alt="Queen" />
                    </div>
                  </div>

                  <!-- Only shown when clicked -->
                  <div v-if="selectedEventMarkerId === em.id" class="elm-plate">
                    <div class="elm-plate-top">
                      <strong class="elm-title">{{ em.title }}</strong>
                      <button
                        v-if="em.linkedStage"
                        type="button"
                        class="elm-3d-btn"
                        title="点击进入 3D 机关解谜图"
                        @click.stop="open3DStage(em.linkedStage)"
                      >
                        3D
                      </button>
                    </div>
                    <span v-if="em.subLabel" class="elm-sub">{{ em.subLabel }}</span>
                  </div>
                </div>

                <!-- TYPE B: Multi-Point Spawn Node / Puzzle Step / Patrol Node -->
                <div
                  v-else
                  class="event-pin-marker"
                  :class="[
                    `kind-${em.kind}`,
                    { active: selectedEventMarkerId === em.id },
                  ]"
                  :style="{
                    left: `${em.x}%`,
                    top: `${em.y}%`,
                    '--ev-accent': em.accent || '#ffbc13',
                  }"
                  role="button"
                  tabindex="0"
                  @click.stop="selectEventMarker(em)"
                  @keydown.enter.stop="selectEventMarker(em)"
                >
                  <div class="epm-badge">
                    <img :src="assetUrl(em.icon)" :alt="em.title" class="epm-icon" />
                    <span v-if="em.count > 1" class="epm-index">×{{ em.count }}</span>
                  </div>
                  <!-- Only shown when clicked -->
                  <div v-if="selectedEventMarkerId === em.id" class="epm-caption">
                    <strong>{{ em.title }}</strong>
                    <span v-if="em.subLabel">{{ em.subLabel }}</span>
                  </div>
                </div>
              </template>
            </div>

            <!-- 7B. PLANT & FORAGING RANGE FLOATING LABELS -->
            <div
              v-if="activePlantZones.length"
              class="plant-zones-pill-layer"
            >
              <div
                v-for="pz in activePlantZones"
                :key="`pz-pill-${pz.id}`"
                class="plant-zone-pill"
                :style="{
                  left: `${pz.x}%`,
                  top: `${Math.max(4, pz.y - (pz.radius || 4.5))}%`,
                  '--pz-c': pz.accent || '#4ade80',
                }"
                @click.stop="centerMapAt(pz.x, pz.y, Math.max(zoom, 1.52))"
              >
                <img v-if="pz.icon" :src="assetUrl(pz.icon)" alt="" class="pzp-icon" />
                <span class="pzp-text">{{ pz.label }}</span>
              </div>
            </div>

            <!-- 8. TRACKED QUEST GREEN ZONE BADGES & COMPACT NUMBERED LANDMARK PINS LAYER -->
            <div
              v-if="activeQuestZones.length || activeQuestLandmarks.length"
              class="quest-targets-layer"
            >
              <!-- Green Area Pins (only when no specific landmarks are present) -->
              <template v-if="!activeQuestLandmarks.length">
                <div
                  v-for="(z, zIdx) in activeQuestZones"
                  :key="z.id"
                  class="quest-landmark-pin lm-zone"
                  :class="{ active: selectedQuestZoneId === z.id }"
                  :style="{ left: `${z.x}%`, top: `${z.y}%` }"
                  role="button"
                  tabindex="0"
                  :title="`${z.label}\n点击在下方卡片查看详情`"
                  @click.stop="selectQuestZone(z)"
                  @keydown.enter.stop="selectQuestZone(z)"
                >
                  <span class="qlp-pulse" aria-hidden="true"></span>
                  <div class="qlp-head">
                    <img
                      v-if="activeQuestZones.length === 1"
                      :src="assetUrl('game-maps/icons/T_UI_QUEST_Visit.png')"
                      alt=""
                      class="qlp-icon"
                    />
                    <span v-else class="qlp-num">{{ zIdx + 1 }}</span>
                  </div>
                </div>
              </template>

              <!-- Compact Numbered / Single-Icon Quest Landmark Pins -->
              <div
                v-for="lm in activeQuestLandmarks"
                :key="lm.id"
                class="quest-landmark-pin"
                :class="[
                  `lm-${lm.type}`,
                  { active: selectedQuestLandmarkId === lm.id },
                ]"
                :style="{ left: `${lm.x}%`, top: `${lm.y}%` }"
                role="button"
                tabindex="0"
                :title="`步骤 ${lm.step} · ${lm.title}\n📍 ${lm.areaName}\n点击在下方卡片查看详情`"
                @click.stop="selectQuestLandmark(lm)"
                @keydown.enter.stop="selectQuestLandmark(lm)"
              >
                <span class="qlp-pulse" aria-hidden="true"></span>
                <div class="qlp-head">
                  <img
                    v-if="activeQuestLandmarks.length === 1"
                    :src="assetUrl(lm.icon)"
                    alt=""
                    class="qlp-icon"
                  />
                  <span v-else class="qlp-num">{{ lm.step }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BOTTOM-LEFT QUEST LANDMARK / GREEN ZONE LOCATION INSPECTOR CARD -->
        <aside
          v-if="selectedQuestLandmark || selectedQuestZone"
          class="quest-landmark-inspector"
        >
          <template v-if="selectedQuestLandmark">
            <div class="qli-head">
              <div class="qli-step-box">
                <span class="qli-step-num">#{{ selectedQuestLandmark.step }}</span>
                <img :src="assetUrl(selectedQuestLandmark.icon)" alt="" class="qli-icon" />
              </div>
              <div class="qli-titles">
                <div class="qli-kicker">
                  <span class="qli-type-badge">{{ selectedQuestLandmark.typeLabel }}</span>
                  <span v-if="mapsStore.trackedQuest" class="qli-quest-name">
                    {{ mapsStore.trackedQuest.zhTitle }}
                  </span>
                </div>
                <h3 class="qli-title">{{ selectedQuestLandmark.title }}</h3>
              </div>
              <button
                type="button"
                class="qli-close"
                title="关闭 (ESC)"
                @click="selectedQuestLandmarkId = ''"
              >
                ✕
              </button>
            </div>

            <div class="qli-area-bar">
              <span>📍 具体方位：</span>
              <strong>{{ selectedQuestLandmark.areaName }}</strong>
            </div>

            <div v-if="selectedQuestLandmark.itemText" class="qli-item-bar">
              <span>🎒 关联道具：</span>
              <strong>{{ selectedQuestLandmark.itemText }}</strong>
            </div>

            <p class="qli-detail">{{ selectedQuestLandmark.detail }}</p>

            <div v-if="selectedQuestLandmark.linkedStage" class="qli-actions">
              <button
                type="button"
                class="emi-stage-btn"
                @click="open3DStage(selectedQuestLandmark.linkedStage)"
              >
                <span>进入 3D 立体实景指引图</span>
                <span>→</span>
              </button>
            </div>
          </template>

          <template v-else-if="selectedQuestZone">
            <div class="qli-head">
              <div class="qli-step-box zone">
                <img
                  :src="assetUrl('game-maps/icons/T_UI_QUEST_Visit.png')"
                  alt=""
                  class="qli-icon"
                />
              </div>
              <div class="qli-titles">
                <div class="qli-kicker">
                  <span class="qli-type-badge zone">绿色任务区域</span>
                  <span v-if="mapsStore.trackedQuest" class="qli-quest-name">
                    {{ mapsStore.trackedQuest.zhTitle }}
                  </span>
                </div>
                <h3 class="qli-title">{{ selectedQuestZone.label }}</h3>
              </div>
              <button
                type="button"
                class="qli-close"
                title="关闭 (ESC)"
                @click="selectedQuestZoneId = ''"
              >
                ✕
              </button>
            </div>

            <p v-if="selectedQuestZone.subLabel" class="qli-detail">
              {{ selectedQuestZone.subLabel }}
            </p>
          </template>
        </aside>

        <!-- BOTTOM-LEFT TACTICAL EVENT MARKER INSPECTOR CARD -->
        <aside
          v-if="selectedEventMarker && !selectedQuestLandmark && !selectedQuestZone"
          class="event-marker-inspector"
          :style="{ '--ev-accent': selectedEventMarker.accent || '#ffbc13' }"
        >
          <div class="emi-head">
            <div class="emi-icon-box">
              <img :src="assetUrl(selectedEventMarker.icon)" alt="" class="emi-main-icon" />
              <img
                v-if="selectedEventMarker.secondaryIcon"
                :src="assetUrl(selectedEventMarker.secondaryIcon)"
                alt=""
                class="emi-sec-icon"
              />
            </div>
            <div class="emi-titles">
              <div class="emi-kicker-row">
                <span class="emi-badge">{{ selectedEventMarker.badgeText || '标注' }}</span>
                <span v-if="selectedEventMarker.subLabel" class="emi-coord">
                  {{ selectedEventMarker.subLabel }}
                </span>
              </div>
              <h3 class="emi-title">{{ selectedEventMarker.title }}</h3>
            </div>
            <button
              type="button"
              class="emi-close"
              title="关闭详情 (ESC)"
              @click="selectedEventMarkerId = ''"
            >
              ✕
            </button>
          </div>

          <p class="emi-desc">{{ selectedEventMarker.desc }}</p>

          <div v-if="selectedEventMarker.lootHint" class="emi-loot-box">
            <span>战利品与战术提示：</span>
            <strong>{{ selectedEventMarker.lootHint }}</strong>
          </div>

          <div v-if="selectedEventMarker.linkedStage" class="emi-actions">
            <button
              type="button"
              class="emi-stage-btn"
              @click="open3DStage(selectedEventMarker.linkedStage)"
            >
              <span>进入 3D 立体机关解谜图</span>
              <span>→</span>
            </button>
          </div>
        </aside>

        <!-- RIGHT-SIDE IN-GAME LEGEND PANEL (1:1 Match with Screenshot 1: 掩埋废城 ────────) -->
        <aside class="ingame-right-legend" aria-label="地图图例">
          <!-- Map Title + Horizontal Line -->
          <div class="irl-header">
            <h2 class="irl-title">{{ currentMap.name }}</h2>
            <span class="irl-line"></span>
          </div>

          <!-- Extraction Types (White Rounded-Square Icons: 地铁站 / 货运电梯 / 通风井 + 奇袭者暗门) -->
          <div class="irl-group">
            <button
              v-for="item in mapExtractionLegend"
              :key="item.key"
              type="button"
              class="irl-row"
              :class="{
                muted: item.isHatch
                  ? !mapsStore.layers.hatches
                  : !mapsStore.layers.extractions,
              }"
              :title="item.isHatch ? '点击显示/隐藏奇袭者暗门' : `点击显示/隐藏${item.label}`"
              @click="
                item.isHatch
                  ? (mapsStore.layers.hatches = !mapsStore.layers.hatches)
                  : (mapsStore.layers.extractions = !mapsStore.layers.extractions)
              "
            >
              <span class="irl-white-sq">
                <img :src="assetUrl(item.icon)" alt="" />
              </span>
              <span class="irl-label">{{ item.label }}</span>
            </button>

            <!-- Active Special Event / Weekly Trial Layer Toggle inside Right Legend -->
            <button
              v-if="allLayersActiveEventMarkers.length"
              type="button"
              class="irl-row event-legend-row"
              :class="{ muted: !mapsStore.layers.eventMarkers }"
              :title="activeTrialCategory ? '点击显示/隐藏当前周常试炼点位标注' : '点击显示/隐藏当前特殊事件点位标注'"
              @click="mapsStore.layers.eventMarkers = !mapsStore.layers.eventMarkers"
            >
              <span
                class="irl-event-sq"
                :style="{
                  '--ev-accent': activeTrialCategory
                    ? activeTrialCategory.accent
                    : activeState.activePrimary.accent || '#ffbc13',
                }"
              >
                <img
                  :src="
                    assetUrl(
                      activeTrialCategory
                        ? activeTrialCategory.icon
                        : activeState.activePrimary.id !== 'standard-patrol'
                          ? activeState.activePrimary.gameIcon
                          : activeState.activeSecondary?.gameIcon || 'game-maps/icons/T_Icon_Event.png',
                    )
                  "
                  alt=""
                />
              </span>
              <span class="irl-label">
                {{ activeTrialCategory ? '试炼标注' : '事件地标' }} ({{ activeEventMarkers.length }})
              </span>
            </button>
          </div>

          <!-- Loot Categories Present on This Map (机械元件, 商业, 科技, 住宅, 医疗, 自然, 旧世界...) -->
          <div class="irl-group loot-group">
            <button
              v-for="lt in mapLootLegend"
              :key="lt.zh"
              type="button"
              class="irl-row loot-row"
              :class="{ active: selectedLootCategoryId === lt.zh }"
              :title="`点击在地图上高亮所有产出【${lt.zh}】的建筑`"
              @click="toggleLootFilter(lt.zh)"
            >
              <img :src="assetUrl(lt.icon)" alt="" class="irl-loot-icon" />
              <span class="irl-label">{{ lt.zh }}</span>
            </button>
          </div>

          <!-- Quick Detail Toggle & Server Indicator -->
          <div class="irl-footer">
            <button
              type="button"
              class="irl-toggle-btn"
              :class="{ active: mapsStore.layers.minorPois }"
              @click="mapsStore.layers.minorPois = !mapsStore.layers.minorPois"
            >
              {{ mapsStore.layers.minorPois ? '隐藏次级地标' : '显示全部地标' }}
            </button>
          </div>

          <div v-if="currentMap.linkedStages3D?.length" class="irl-3d-dock">
            <button
              v-for="st in currentMap.linkedStages3D"
              :key="st.stageKey"
              type="button"
              class="irl-3d-card-btn"
              @click="open3DStage(st.stageKey)"
            >
              <span class="i3c-place">
                <i class="i3c-dot"></i>
                <strong class="i3c-title">{{ getStagePlaceName(st) }}</strong>
              </span>
              <span class="i3c-action">进入</span>
            </button>
          </div>
        </aside>

        <!-- BOTTOM-CENTER IN-GAME KEYBIND BAR (Screenshot 1: ESC 返回 · 平移 · 放大) -->
        <footer class="ingame-map-bottom-bar">
          <button
            type="button"
            class="imbb-item clickable"
            @click="zoom > 1 ? resetView() : router.push('/maps')"
          >
            <kbd class="imbb-key">ESC</kbd>
            <span>返回</span>
          </button>

          <div class="imbb-item">
            <span class="imbb-icon">🖱</span>
            <span>平移</span>
          </div>

          <div class="imbb-item">
            <span class="imbb-icon">⚙</span>
            <span>放大</span>
          </div>
        </footer>
      </section>
    </div>
  </main>
</template>

<style scoped>
.tactical-detail-shell {
  flex: 1;
  min-height: 0;
  height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  background: #080b12;
  color: var(--tx-1);
  overflow: hidden;
}

/* ---------- 2-Column Workbench (Left: Quest Sidebar, Right: In-Game Map Stage) ---------- */
.tmd-workbench {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 350px minmax(0, 1fr);
}

@media (max-width: 1200px) {
  .tmd-workbench {
    grid-template-columns: 310px minmax(0, 1fr);
  }
}

/* ---------- Left Quest Integration Sidebar ---------- */
.tmd-quest-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-panel);
  border-right: 1px solid var(--line);
  z-index: 12;
}

.tqp-nav-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--line);
}

.tqp-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 10px;
  border-radius: 4px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.tqp-back-btn:hover {
  border-color: var(--amber);
}

.tqp-map-select {
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

.trp-tracked-card {
  flex-shrink: 0;
  padding: 14px 16px;
  border-top: 4px solid var(--amber);
}

.ttc-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ttc-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 800;
  color: var(--ink);
}

.ttc-badge-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(0.12);
}

.ttc-order {
  font-size: 13px;
  color: var(--ink-2);
}

.ttc-title {
  margin: 4px 0 2px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 800;
  color: var(--ink);
}

.ttc-en {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-2);
  margin-bottom: 10px;
}

.ttc-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0 0 10px;
  padding-top: 8px;
  border-top: 1px solid rgba(9, 12, 25, 0.14);
}

.ttc-kv > div + div {
  padding-left: 10px;
  border-left: 1px solid rgba(9, 12, 25, 0.14);
}

.ttc-kv dt {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--ink-3);
}

.ttc-kv dd {
  margin: 2px 0 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
}

.ttc-req {
  padding: 8px 10px;
  background: rgba(9, 12, 25, 0.08);
  border-radius: 3px;
  font-size: 12px;
  color: var(--ink);
  margin-bottom: 10px;
}

.ttc-req-label {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-2);
}

.ttc-req-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ttc-req-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 4px 5px;
  background: rgba(9, 12, 25, 0.86);
  color: var(--cream);
  border-radius: 3px;
  font-size: 12px;
}

.ttc-req-chip img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.ttc-desc-box {
  padding: 9px 11px;
  background: var(--ink);
  color: var(--cream);
  border-radius: 4px;
  border-left: 3px solid var(--amber);
}

.ttc-desc-head {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 4px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--amber);
}

.ttc-desc-icon {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.ttc-desc-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--cream);
}

.trp-list-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 15px 10px;
  border-bottom: 1px solid var(--line);
}

.trp-list-head h3 {
  margin: 2px 0 0;
  font-family: var(--font-display);
  font-size: 15.5px;
  color: var(--cream);
  white-space: nowrap;
}

.tlh-right-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tlh-expand-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 26px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.14s ease;
}

.tlh-expand-all-btn:hover,
.tlh-expand-all-btn.active {
  border-color: var(--amber);
  color: var(--amber);
  background: rgba(255, 188, 19, 0.1);
}

.seg-mini .ar-tab {
  height: 26px;
  padding: 0 9px;
  font-size: 11.5px;
}

.seg-mini em {
  font-style: normal;
  margin-left: 3px;
}

.trp-quest-scroll {
  flex: 1;
  overflow-y: auto;
}

.map-quest-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 9px 14px;
  border-bottom: 1px solid var(--line-subtle);
  cursor: pointer;
  transition: background 0.12s ease;
}

.map-quest-row:hover {
  background: rgba(245, 238, 224, 0.04);
}

.map-quest-row.active {
  background: rgba(255, 188, 19, 0.08);
  box-shadow: inset 3px 0 0 var(--amber);
}

.map-quest-row.done .mqr-title {
  text-decoration: line-through;
  opacity: 0.5;
}

.mqr-check {
  margin-top: 2px;
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1.5px solid var(--line-strong);
  border-radius: 3px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
}

.mqr-check.checked {
  background: var(--amber);
  border-color: var(--amber);
}

.mqr-check svg {
  width: 11px;
  height: 11px;
}

.mqr-body {
  flex: 1;
  min-width: 0;
}

.mqr-top {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
}

.mqr-title {
  font-size: 13.5px;
  color: var(--tx-1);
}

.mqr-expand-btn {
  margin-left: auto;
  width: 22px;
  height: 20px;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border-radius: 3px;
  border: 1px solid transparent;
  background: rgba(245, 238, 224, 0.05);
  color: var(--tx-3);
  cursor: pointer;
  transition: all 0.14s ease;
}

.mqr-expand-btn:hover,
.mqr-expand-btn.open {
  border-color: rgba(255, 188, 19, 0.45);
  background: rgba(255, 188, 19, 0.14);
  color: var(--amber);
}

.mqr-chevron-svg {
  width: 12px;
  height: 12px;
  transition: transform 0.18s ease;
}

.mqr-chevron-svg.open {
  transform: rotate(180deg);
}

.mqr-desc {
  margin: 7px 0 2px;
  padding: 6px 9px;
  border-radius: 4px;
  background: rgba(9, 12, 22, 0.55);
  border-left: 2px solid var(--amber);
  font-size: 12px;
  line-height: 1.5;
  color: var(--tx-2);
}

:global(.mqr-cursor-tooltip) {
  position: fixed;
  z-index: 9999;
  width: 328px;
  max-width: calc(100vw - 28px);
  padding: 11px 13px;
  border-radius: 6px;
  background: rgba(11, 15, 26, 0.97);
  border: 1px solid rgba(255, 188, 19, 0.65);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: #f5eee0;
  pointer-events: none;
}

:global(.mqr-cursor-tooltip .mct-head) {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 7px;
  padding-bottom: 7px;
  margin-bottom: 7px;
  border-bottom: 1px solid rgba(245, 238, 224, 0.14);
}

:global(.mqr-cursor-tooltip .mct-title) {
  font-family: var(--font-display);
  font-size: 14.5px;
  font-weight: 800;
  color: #ffffff;
}

:global(.mqr-cursor-tooltip .mct-trader) {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: rgba(245, 238, 224, 0.72);
}

:global(.mqr-cursor-tooltip .mct-trader i) {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

:global(.mqr-cursor-tooltip .mct-desc) {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: rgba(245, 238, 224, 0.94);
}

:global(.mqr-cursor-tooltip .mct-reqs) {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 8px;
}

:global(.mqr-cursor-tooltip .mct-req-chip) {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px 2px 4px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.14);
  border: 1px solid rgba(255, 188, 19, 0.35);
  font-size: 11px;
  color: #ffdf85;
}

:global(.mqr-cursor-tooltip .mct-req-chip img) {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

:global(.mqr-cursor-tooltip .mct-foot) {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed rgba(245, 238, 224, 0.12);
  font-size: 11px;
  color: #ffbc13;
  font-weight: 600;
}

.mqr-trader {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  color: var(--tx-3);
}

.mqr-trader i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.mqr-req-tag {
  padding: 0 5px;
  border-radius: 2px;
  background: rgba(255, 188, 19, 0.14);
  color: var(--amber);
  font-size: 10.5px;
}

.trp-empty {
  padding: 28px 16px;
  text-align: center;
  color: var(--tx-3);
  font-size: 13px;
}

/* ============================================================================
   MAIN RIGHT AREA: 1:1 In-Game Tactical Map Stage (Matches Screenshot 1)
   ============================================================================ */
.tmd-canvas-stage {
  position: relative;
  overflow: hidden;
  background: #080b12;
  cursor: grab;
  user-select: none;
}

.tmd-canvas-stage.panning {
  cursor: grabbing;
}

/* Top-Left Minimal Layer Switcher & Event Pill */
.canvas-status-overlay {
  position: absolute;
  top: 16px;
  left: 18px;
  right: 255px;
  z-index: 14;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  pointer-events: none;
}

.cso-top-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  pointer-events: auto;
}

.layer-switch-bar {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: 6px;
  background: rgba(14, 18, 28, 0.92);
  border: 1px solid rgba(245, 238, 224, 0.22);
}

.lsb-btn {
  height: 26px;
  padding: 0 11px;
  border-radius: 4px;
  background: transparent;
  border: 0;
  color: rgba(245, 238, 224, 0.72);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.lsb-btn.active {
  background: #f5eee0;
  color: #0d101b;
}

.cso-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 10px 4px 6px;
  border-radius: 999px;
  background: rgba(14, 18, 28, 0.94);
  border: 1px solid rgba(245, 238, 224, 0.22);
  color: #f5eee0;
  font-size: 12px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.65);
}

.cso-live-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(245, 238, 224, 0.08);
  border: 1px solid rgba(245, 238, 224, 0.18);
  color: rgba(245, 238, 224, 0.85);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.cso-live-btn.active {
  background: rgba(38, 191, 87, 0.16);
  border-color: rgba(38, 191, 87, 0.55);
  color: #5dff8e;
}

.cso-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #26bf57;
  box-shadow: 0 0 6px #26bf57;
}

.cso-live-dot.manual {
  background: #ffbc13;
  box-shadow: 0 0 6px #ffbc13;
}

.cso-std-label {
  color: rgba(245, 238, 224, 0.72);
  font-weight: 700;
}

.cso-icon {
  width: 15px;
  height: 15px;
  object-fit: contain;
}

.cso-marker-count {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 188, 19, 0.16);
  border: 1px solid rgba(255, 188, 19, 0.42);
  color: #ffbc13;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.14s ease;
}

.cso-marker-count:hover {
  background: rgba(255, 77, 79, 0.22);
  border-color: rgba(255, 77, 79, 0.55);
  color: #ff9c9e;
}

.cso-mode-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(245, 238, 224, 0.06);
  border: 1px solid rgba(245, 238, 224, 0.16);
}

.cmt-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 9px;
  border-radius: 999px;
  background: transparent;
  border: none;
  color: rgba(245, 238, 224, 0.85);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.14s ease;
}

.cmt-btn:hover {
  color: #ffffff;
}

.cmt-btn.active {
  background: rgba(255, 188, 19, 0.22);
  color: #ffbc13;
}

.cmt-count {
  font-style: normal;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.18);
  color: var(--amber);
}

/* =====================================================================
   IMAGE-2-STYLE SELECTABLE ICON & EVENT FILTER FORM (1:1 with Overlay)
   ===================================================================== */
.omr-filter-popover.tmd-filter-popover {
  pointer-events: auto;
  width: 280px;
  max-height: calc(100vh - 140px);
  background: #141720;
  border: 1px solid rgba(206, 193, 176, 0.32);
  border-radius: 6px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ofp-top-bar {
  flex-shrink: 0;
  height: 34px;
  padding: 0 10px;
  background: #0f121a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ofp-top-title {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  color: var(--cream);
}

.ofp-close-btn {
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #94a3b8;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ofp-close-btn:hover {
  border-color: var(--amber);
  color: var(--amber);
}

.ofp-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ofp-scroll::-webkit-scrollbar {
  width: 5px;
}

.ofp-scroll::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}

.ofp-scroll::-webkit-scrollbar-thumb {
  background: rgba(206, 193, 176, 0.35);
  border-radius: 3px;
}

.ofp-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--amber);
}

.ofp-group {
  flex-shrink: 0;
  background: #1a1e29;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 7px;
  overflow: hidden;
}

.ofp-group-head {
  position: relative;
  height: 36px;
  padding: 0 10px 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.ofp-group-head::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  bottom: 7px;
  width: 3px;
  border-radius: 0 2px 2px 0;
  background: #3b82f6;
}

.ofp-group-head.accent-orange::before {
  background: #ea580c;
}

.ofp-group-head.accent-green::before {
  background: #22c55e;
}

.ofp-group-head.accent-red::before {
  background: #ef4444;
}

.ofp-collapse-btn {
  border: none;
  background: transparent;
  color: #f1f5f9;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 0;
}

.ofp-chevron {
  font-size: 11px;
  color: #94a3b8;
  transition: transform 0.15s;
}

.ofp-chevron.collapsed {
  transform: rotate(-90deg);
}

.ofp-collapse-btn em {
  font-style: normal;
  font-size: 11.5px;
  font-weight: 600;
  color: #64748b;
}

.ofp-eye-btn {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ofp-eye-btn:hover {
  color: #f8fafc;
  background: rgba(255, 255, 255, 0.06);
}

.ofp-eye-btn.muted {
  opacity: 0.38;
}

.ofp-list {
  padding: 4px 6px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ofp-row {
  height: 36px;
  padding: 0 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  transition: background 0.12s;
}

.ofp-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.ofp-icon-sq {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #525866;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  flex-shrink: 0;
  transition: background 0.15s;
}

.ofp-icon-sq.on {
  background: #ffffff;
}

.ofp-icon-sq img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: brightness(0.08);
}

.ofp-icon-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #2b2f3a;
  border: 2px solid #454b59;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.ofp-icon-circle img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.45;
}

.ofp-icon-circle.on {
  background: #ea580c;
  border-color: #fdba74;
}

.ofp-icon-circle.on img {
  opacity: 1;
  filter: brightness(0.1);
}

.ofp-icon-plant {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #232834;
  border: 1.5px solid #454b59;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.ofp-icon-plant img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.62;
  transition: opacity 0.15s, transform 0.15s;
}

.ofp-icon-plant.on {
  background: rgba(34, 197, 94, 0.18);
  border-color: var(--plant-c, #4ade80);
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.28);
}

.ofp-icon-plant.on img {
  opacity: 1;
  transform: scale(1.06);
}

.ofp-icon-arc {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: #271b22;
  border: 1.5px solid #4e3542;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.ofp-icon-arc img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.65;
  transition: opacity 0.15s, transform 0.15s;
}

.ofp-icon-arc.on {
  background: rgba(239, 68, 68, 0.22);
  border-color: var(--arc-c, #ef4444);
  box-shadow: 0 0 9px rgba(239, 68, 68, 0.35);
}

.ofp-icon-arc.on img {
  opacity: 1;
  transform: scale(1.08);
}

.ofp-label-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 5px;
}

.ofp-name {
  font-size: 12.5px;
  font-weight: 600;
  color: #94a3b8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ofp-row.on .ofp-name {
  color: #f8fafc;
}

.ofp-sub-badge,
.ofp-kind-tag {
  font-size: 9.5px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.16);
  color: var(--amber);
  flex-shrink: 0;
}

.ofp-kind-tag.tr {
  background: rgba(56, 189, 248, 0.16);
  color: #7dd3fc;
}

.ofp-kind-tag.plant {
  background: rgba(74, 222, 128, 0.16);
  color: #86efac;
}

.ofp-kind-tag.arc {
  background: rgba(239, 68, 68, 0.18);
  color: #fca5a5;
}

.ofp-count {
  font-size: 12px;
  color: #64748b;
  flex-shrink: 0;
}

.ofp-switch {
  width: 34px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid #475569;
  background: #262b38;
  padding: 2px;
  display: flex;
  align-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.16s;
}

.ofp-knob {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #94a3b8;
  transition: transform 0.16s, background 0.16s;
}

.ofp-switch.on {
  background: #f59e0b;
  border-color: #f59e0b;
}

.ofp-switch.plant-sw.on {
  background: var(--plant-c, #22c55e);
  border-color: var(--plant-c, #22c55e);
}

.ofp-switch.arc-sw.on {
  background: var(--arc-c, #ef4444);
  border-color: var(--arc-c, #ef4444);
}

.ofp-switch.on .ofp-knob {
  transform: translateX(16px);
  background: #111827;
}

.plant-range-circle-dash {
  animation: evDashFlow 16s linear infinite;
}

.plant-zones-pill-layer {
  position: absolute;
  inset: 0;
  z-index: 9;
  pointer-events: none;
}

.plant-zone-pill {
  position: absolute;
  transform: translate(-50%, -100%) scale(var(--inv-scale, 1));
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px 2px 5px;
  border-radius: 999px;
  background: rgba(10, 15, 22, 0.92);
  border: 1.5px solid var(--pz-c, #4ade80);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.85), 0 0 10px rgba(74, 222, 128, 0.28);
  pointer-events: auto;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.plant-zone-pill:hover {
  transform: translate(-50%, -100%) scale(calc(var(--inv-scale, 1) * 1.07));
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.92), 0 0 14px var(--pz-c, #4ade80);
}

.pzp-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.pzp-text {
  font-size: 10.5px;
  font-weight: 800;
  color: #f0fdf4;
  letter-spacing: 0.01em;
}

/* Elite ARC Activity Range Circles & Multi-ARC Roster Floating Pills */
.elite-arc-range-circle-dash {
  animation: evDashFlow 14s linear infinite;
}

.cso-expand-btn {
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid rgba(245, 238, 224, 0.18);
  color: rgba(245, 238, 224, 0.75);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.cso-expand-btn:hover {
  border-color: #f5eee0;
  color: #ffffff;
}

.cso-event-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  max-width: 780px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(10, 14, 22, 0.9);
  border: 1px solid rgba(245, 238, 224, 0.16);
  backdrop-filter: blur(8px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.72);
  pointer-events: auto;
}

.trials-strip {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  max-width: 780px;
}

.tsh-clear-btn {
  height: 25px;
  padding: 0 8px;
  border-radius: 5px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.tsh-clear-btn:hover {
  background: rgba(239, 68, 68, 0.28);
  color: #ffffff;
}

.trials-strip-pills {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.cso-strip-desc {
  padding: 5px 8px;
  border-radius: 5px;
  background: rgba(245, 238, 224, 0.05);
  border-left: 2.5px solid #ffbc13;
  color: rgba(245, 238, 224, 0.88);
  font-size: 11.5px;
  line-height: 1.45;
}

.csd-label {
  color: #ffbc13;
  font-weight: 800;
}

.ces-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 25px;
  padding: 0 8px;
  border-radius: 5px;
  background: rgba(245, 238, 224, 0.05);
  border: 1px solid rgba(245, 238, 224, 0.14);
  color: rgba(245, 238, 224, 0.82);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.14s ease;
}

.ces-pill:hover {
  background: rgba(245, 238, 224, 0.12);
  border-color: var(--ev-accent, #ffbc13);
  color: #ffffff;
}

.ces-pill.active {
  background: rgba(255, 188, 19, 0.18);
  border-color: var(--ev-accent, #ffbc13);
  color: #ffffff;
  box-shadow: 0 0 10px rgba(255, 188, 19, 0.25);
}

.ces-pill.is-live::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #26bf57;
  box-shadow: 0 0 5px #26bf57;
}

.ces-icon {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.ces-name {
  white-space: nowrap;
}

.ces-count {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.45);
  color: var(--ev-accent, #ffbc13);
}

/* 1:1 Square Tactical Board Container */
.tactical-board-center {
  position: absolute;
  inset: 0;
  padding-right: 170px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.tactical-map-plane {
  position: relative;
  flex-shrink: 0;
  background: #080b12;
  transform-origin: center center;
}

.tactical-base-img,
.tactical-overlay-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: fill;
  pointer-events: none;
  filter: contrast(1.04) saturate(0.92);
}

.tactical-base-img.dimmed-for-underground {
  opacity: 0.34;
  filter: brightness(0.5) saturate(0.4);
}

.tactical-overlay-img {
  z-index: 1;
}

/* Soft Radial Vignette Fade into #080b12 (Matches Screenshot 1's borderless circular fade) */
.tactical-vignette-mask {
  position: absolute;
  inset: -2px;
  z-index: 2;
  pointer-events: none;
  background: radial-gradient(
    circle at 50% 50%,
    transparent 50%,
    rgba(8, 11, 18, 0.55) 70%,
    rgba(8, 11, 18, 0.92) 84%,
    #080b12 96%
  );
}

.tactical-map-svg {
  position: absolute;
  inset: 0;
  z-index: 3;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ---------- Layer 3: ZOOM 0 In-Game Dark Pill Neighborhood Labels (郊区, 新区, 西村, 老城区) ---------- */
.pois-macro-layer {
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
}

.poi-macro-pill {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  padding: 2px 8px;
  border-radius: 3px;
  background: rgba(12, 15, 23, 0.86);
  color: #f5eee0;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.78);
}

/* ---------- Layer 4: White Rounded-Square Extraction & Hatch Icons (Exact Screenshot 1 Design) ---------- */
.extractions-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.ext-marker {
  position: absolute;
  width: 22px;
  height: 22px;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  display: grid;
  place-items: center;
  pointer-events: auto;
  cursor: pointer;
}

.ext-marker:hover,
.ext-marker.show-label {
  z-index: 16;
}

.ingame-white-sq {
  position: relative;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: #f5eee0;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.88),
    0 0 0 1px rgba(12, 15, 24, 0.45);
  display: grid;
  place-items: center;
  transition: transform 0.14s ease, background 0.14s ease;
}

.ext-marker:hover .ingame-white-sq {
  transform: scale(1.14);
  background: #ffffff;
}

.ext-marker.disabled .ingame-white-sq {
  opacity: 0.45;
}

.iws-glyph {
  width: 15px;
  height: 15px;
  object-fit: contain;
  filter: brightness(0.06);
}

.em-lock-slash {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-style: normal;
  font-size: 13px;
  font-weight: 900;
  color: #ff382e;
}

.em-caption {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  display: none;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(12, 15, 23, 0.94);
  color: #f5eee0;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.8);
  pointer-events: none;
}

.ext-marker:hover .em-caption,
.ext-marker.show-label .em-caption {
  display: inline-block;
}

.em-caption em {
  font-style: normal;
  color: #ff6b6b;
}

/* ---------- Layer 5: Major Named Buildings (Progressive Zoom / Legend Highlight) ---------- */
.pois-major-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.poi-major-marker {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  pointer-events: auto;
}

.poi-major-marker:hover,
.poi-major-marker.active {
  z-index: 18;
}

.pmj-title-row {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(12, 15, 23, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.poi-major-marker.active .pmj-title-row {
  background: rgba(12, 15, 23, 0.96);
  box-shadow: 0 0 0 1.5px #ffbc13, 0 4px 12px rgba(0, 0, 0, 0.88);
}

.pmj-name {
  font-size: 12px;
  font-weight: 800;
  color: #f5eee0;
  white-space: nowrap;
}

.poi-major-marker.active .pmj-name {
  color: #ffbc13;
}

.pmj-key-icon {
  width: 11px;
  height: 11px;
  object-fit: contain;
}

.pmj-3d-badge {
  padding: 1px 6px;
  border: 1.5px solid #ffbc13;
  border-radius: 3px;
  background: linear-gradient(135deg, #ffbc13 0%, #ff9900 100%);
  color: #090c16;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  box-shadow: 0 0 8px rgba(255, 188, 19, 0.65);
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.pmj-3d-badge:hover {
  transform: scale(1.12);
  box-shadow: 0 0 12px rgba(255, 188, 19, 0.95);
}

.pmj-loot-row {
  margin-top: 2px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 5px;
  border-radius: 4px;
  background: rgba(12, 15, 23, 0.86);
}

.pmj-loot-icon {
  width: 12px;
  height: 12px;
  object-fit: contain;
}

/* ---------- Layer 6: Minor Sub-Landmarks ---------- */
.pois-minor-layer {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

.poi-minor-marker {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1.5px 6px;
  border-radius: 3px;
  background: rgba(12, 15, 23, 0.78);
  pointer-events: auto;
  cursor: pointer;
}

.pmn-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #f5eee0;
}

.pmn-label {
  font-size: 11px;
  font-weight: 700;
  color: rgba(245, 238, 224, 0.88);
  white-space: nowrap;
}

/* ============================================================================
   Layer 7: SPECIAL EVENT LANDMARKS & SPAWN NODES (女王/收割者、族母、奇袭者箱、航向重定向等)
   ============================================================================ */
.ev-svg-patrol-line {
  animation: evDashFlow 18s linear infinite;
}

.ev-svg-link-line {
  animation: evDashFlow 14s linear infinite;
}

@keyframes evDashFlow {
  to {
    stroke-dashoffset: -170;
  }
}

.event-markers-layer {
  position: absolute;
  inset: 0;
  z-index: 8;
  pointer-events: none;
}

/* ---------- TYPE A: Boss / Major Event Landmark (Harvester & Queen, Matriarch, Frigate, Fallen Emperor, Bunker, Locked Gate) ---------- */
.event-landmark-marker {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 19;
}

.event-landmark-marker:hover,
.event-landmark-marker.active {
  z-index: 26;
}

.elm-crest-wrap {
  position: relative;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
}

.elm-pulse-halo {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 1.5px solid var(--ev-accent, #ffbc13);
  background: radial-gradient(circle, rgba(255, 198, 0, 0.22) 0%, transparent 72%);
  animation: elmHaloPulse 2.4s ease-out infinite;
  pointer-events: none;
}

@keyframes elmHaloPulse {
  0% {
    transform: scale(0.86);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.36);
    opacity: 0;
  }
}

.elm-crest {
  width: 40px;
  height: 40px;
  border-radius: 9px;
  transform: rotate(45deg);
  background: radial-gradient(circle at 30% 30%, #1d2436, #0a0d16 80%);
  border: 2px solid var(--ev-accent, #ffbc13);
  box-shadow:
    0 4px 14px rgba(0, 0, 0, 0.92),
    0 0 14px rgba(255, 188, 19, 0.35),
    inset 0 0 8px rgba(255, 255, 255, 0.12);
  display: grid;
  place-items: center;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.event-landmark-marker:hover .elm-crest,
.event-landmark-marker.active .elm-crest {
  transform: rotate(45deg) scale(1.1);
  box-shadow:
    0 6px 18px rgba(0, 0, 0, 0.96),
    0 0 20px var(--ev-accent, #ffbc13);
}

.elm-main-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
  transform: rotate(-45deg);
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.85));
}

.elm-sub-crest {
  position: absolute;
  right: -7px;
  bottom: -4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #14090d;
  border: 1.5px solid #ff3026;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
  display: grid;
  place-items: center;
}

.elm-sub-crest img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.elm-corner-tag {
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0 5px;
  border-radius: 3px;
  background: var(--ev-accent, #ffbc13);
  color: #090c14;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: 0.04em;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
}

.elm-plate {
  margin-top: 5px;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(10, 13, 21, 0.94);
  border: 1px solid var(--ev-accent, #ffbc13);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.elm-plate-top {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.elm-title {
  font-size: 11.5px;
  font-weight: 800;
  color: #f5eee0;
  white-space: nowrap;
}

.elm-3d-btn {
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid #38bdf8;
  background: rgba(56, 189, 248, 0.16);
  color: #66ffff;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 900;
  cursor: pointer;
}

.elm-3d-btn:hover {
  background: #38bdf8;
  color: #080b12;
}

.elm-sub {
  font-size: 10px;
  font-weight: 700;
  color: var(--ev-accent, #ffbc13);
  white-space: nowrap;
}

/* ---------- TYPE B: Multi-Point Spawn Node / Puzzle Step / Patrol Node ---------- */
.event-pin-marker {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  cursor: pointer;
  z-index: 15;
}

.event-pin-marker:hover,
.event-pin-marker.active {
  z-index: 25;
}

.epm-badge {
  position: relative;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(12, 16, 26, 0.94);
  border: 1.5px solid var(--ev-accent, #ffbc13);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.9),
    0 0 8px rgba(0, 0, 0, 0.5);
  display: grid;
  place-items: center;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.event-pin-marker.kind-puzzle-step .epm-badge {
  width: 29px;
  height: 29px;
  border-width: 2px;
  background: radial-gradient(circle at 30% 30%, #1f273b, #0c101b);
}

.event-pin-marker:hover .epm-badge,
.event-pin-marker.active .epm-badge {
  transform: scale(1.18);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.95),
    0 0 12px var(--ev-accent, #ffbc13);
}

.epm-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.epm-index {
  position: absolute;
  top: -6px;
  right: -7px;
  padding: 0 3.5px;
  border-radius: 3px;
  background: var(--ev-accent, #ffbc13);
  color: #090c14;
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 900;
  line-height: 1.35;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.85);
}

.epm-caption {
  position: absolute;
  top: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(10, 13, 21, 0.96);
  border: 1px solid var(--ev-accent, #ffbc13);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.92);
  white-space: nowrap;
  pointer-events: none;
}

.epm-caption strong {
  font-size: 11px;
  font-weight: 800;
  color: #f5eee0;
}

.epm-caption span {
  font-size: 9.5px;
  font-weight: 700;
  color: var(--ev-accent, #ffbc13);
}

/* ---------- Bottom-Left Tactical Event Marker Inspector Card ---------- */
.event-marker-inspector {
  position: absolute;
  left: 20px;
  bottom: 54px;
  width: 360px;
  max-width: calc(100% - 40px);
  z-index: 22;
  padding: 13px 15px;
  border-radius: 8px;
  background: rgba(11, 15, 24, 0.96);
  border: 1px solid var(--ev-accent, #ffbc13);
  border-left: 4px solid var(--ev-accent, #ffbc13);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
}

.emi-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.emi-icon-box {
  position: relative;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 7px;
  background: rgba(245, 238, 224, 0.06);
  border: 1px solid var(--ev-accent, #ffbc13);
  display: grid;
  place-items: center;
}

.emi-main-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.emi-sec-icon {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #14090d;
  border: 1px solid #ff3026;
  object-fit: contain;
}

.emi-titles {
  flex: 1;
  min-width: 0;
}

.emi-kicker-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 2px;
}

.emi-badge {
  padding: 0 5px;
  border-radius: 3px;
  background: var(--ev-accent, #ffbc13);
  color: #090c14;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 900;
}

.emi-coord {
  font-size: 10.5px;
  color: rgba(245, 238, 224, 0.58);
}

.emi-title {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: #f5eee0;
  line-height: 1.3;
}

.emi-en {
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: rgba(245, 238, 224, 0.55);
}

.emi-close {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid rgba(245, 238, 224, 0.16);
  color: rgba(245, 238, 224, 0.72);
  font-size: 12px;
  cursor: pointer;
}

.emi-close:hover {
  border-color: #f5eee0;
  color: #ffffff;
}

.emi-desc {
  margin: 9px 0;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(245, 238, 224, 0.88);
}

.emi-loot-box {
  padding: 7px 9px;
  border-radius: 4px;
  background: rgba(255, 188, 19, 0.1);
  border: 1px solid rgba(255, 188, 19, 0.28);
  font-size: 11.5px;
  line-height: 1.45;
  color: #f5eee0;
}

.emi-loot-box span {
  color: var(--ev-accent, #ffbc13);
  font-weight: 800;
}

.emi-actions {
  margin-top: 9px;
}

.emi-stage-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 11px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.16);
  border: 1px solid #38bdf8;
  color: #66ffff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.emi-stage-btn:hover {
  background: rgba(56, 189, 248, 0.28);
}

.irl-event-sq {
  width: 19px;
  height: 19px;
  border-radius: 3.5px;
  background: rgba(14, 18, 28, 0.95);
  border: 1.5px solid var(--ev-accent, #ffbc13);
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}

.irl-event-sq img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

/* ============================================================================
   RIGHT-SIDE IN-GAME LEGEND PANEL (1:1 Match with Screenshot 1: 掩埋废城 ────────)
   ============================================================================ */
.ingame-right-legend {
  position: absolute;
  top: 34px;
  bottom: 24px;
  right: 28px;
  width: 268px;
  z-index: 12;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 14px;
  pointer-events: none;
}

.irl-header,
.irl-group,
.irl-footer {
  width: 210px;
  pointer-events: auto;
}

.irl-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.irl-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #f5eee0;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.irl-line {
  flex: 1;
  height: 1px;
  background: rgba(245, 238, 224, 0.36);
}

.irl-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.irl-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 3px 6px;
  margin-left: -6px;
  border-radius: 5px;
  background: transparent;
  border: 0;
  color: #f5eee0;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-align: left;
  transition: background 0.14s ease, opacity 0.14s ease, color 0.14s ease;
}

.irl-row:hover {
  background: rgba(245, 238, 224, 0.08);
}

.irl-row.muted {
  opacity: 0.38;
}

.irl-row.active {
  background: rgba(255, 188, 19, 0.16);
  color: #ffbc13;
}

.irl-white-sq {
  width: 19px;
  height: 19px;
  border-radius: 3.5px;
  background: #f5eee0;
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
}

.irl-white-sq img {
  width: 13px;
  height: 13px;
  object-fit: contain;
  filter: brightness(0.06);
}

.irl-loot-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
  margin: 0 1.5px;
  flex-shrink: 0;
  opacity: 0.92;
}

.irl-label {
  letter-spacing: 0.02em;
}

.irl-footer {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid rgba(245, 238, 224, 0.12);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.irl-toggle-btn {
  height: 28px;
  padding: 0 10px;
  border-radius: 4px;
  background: rgba(245, 238, 224, 0.06);
  border: 1px solid rgba(245, 238, 224, 0.18);
  color: rgba(245, 238, 224, 0.8);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.irl-toggle-btn:hover,
.irl-toggle-btn.active {
  background: rgba(245, 238, 224, 0.16);
  border-color: #f5eee0;
  color: #ffffff;
}

/* In-Game Style Bottom-Right 3D Stage Entry Buttons */
.irl-3d-dock {
  margin-top: auto;
  width: 210px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: auto;
}

.irl-3d-card-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 8px 10px 8px 12px;
  border-radius: 5px;
  background: rgba(20, 21, 24, 0.86);
  border: 1px solid rgba(235, 224, 204, 0.38);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.72),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
  color: #f5eee0;
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    outline-color 0.15s ease;
}

.irl-3d-card-btn:hover {
  background: rgba(30, 32, 38, 0.96);
  border-color: #f5ead8;
  outline: 2px solid rgba(245, 234, 216, 0.45);
  outline-offset: 2px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.85);
}

.i3c-place {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.i3c-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f5ead8;
  box-shadow: 0 0 6px rgba(245, 234, 216, 0.55);
  flex-shrink: 0;
  transition: background 0.15s ease, box-shadow 0.15s ease;
}

.irl-3d-card-btn:hover .i3c-dot {
  background: #ffbe26;
  box-shadow: 0 0 8px rgba(255, 190, 38, 0.85);
}

.i3c-title {
  font-size: 13.5px;
  font-weight: 800;
  color: #f5eee0;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.i3c-action {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 12px;
  border-radius: 999px;
  background: #ffbe26;
  border: 1px solid #e5a410;
  color: #14161b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.2;
  box-shadow: 0 3px 10px rgba(255, 190, 38, 0.25);
  transition: filter 0.14s ease, transform 0.14s ease;
}

.irl-3d-card-btn:hover .i3c-action {
  filter: brightness(1.06);
  transform: translateY(-0.5px);
}

/* ---------- Bottom-Center In-Game Keybind Bar (Screenshot 1) ---------- */
.ingame-map-bottom-bar {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 12;
  display: inline-flex;
  align-items: center;
  gap: 22px;
}

.imbb-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: rgba(245, 238, 224, 0.74);
  font-size: 12.5px;
  font-weight: 700;
  background: transparent;
  border: 0;
  padding: 0;
}

.imbb-item.clickable {
  cursor: pointer;
}

.imbb-item.clickable:hover {
  color: #ffffff;
}

.imbb-key {
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(245, 238, 224, 0.86);
  color: #0d101b;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
}

.imbb-icon {
  font-size: 13px;
  opacity: 0.82;
}

/* ============================================================================
   TRACKED QUEST: SIDEBAR TARGETS, GREEN AREA ZONES & DETAILED LANDMARKS
   ============================================================================ */
.ttc-badges {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ttc-type-tag {
  padding: 2px 7px;
  border-radius: 3px;
  background: var(--ink);
  color: var(--cat-c, #26bf57);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
}

.ttc-clear-btn {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  border: 1px solid rgba(9, 12, 25, 0.22);
  background: transparent;
  color: var(--ink-2);
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.ttc-clear-btn:hover {
  background: var(--ink);
  color: var(--cream);
}

.ttc-map-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 6px 0 8px;
}

.ttc-map-pill {
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid rgba(9, 12, 25, 0.28);
  background: rgba(9, 12, 25, 0.08);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.ttc-map-pill.active {
  background: var(--ink);
  color: var(--amber);
  border-color: var(--ink);
}

.ttc-targets-box {
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--ink);
  color: var(--cream);
  border-left: 3px solid #26bf57;
}

.ttc-targets-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 800;
  color: #5dff8e;
}

.ttc-focus-btn {
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid rgba(93, 255, 142, 0.4);
  background: rgba(38, 191, 87, 0.16);
  color: #8affb3;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}

.ttc-focus-btn:hover {
  background: rgba(38, 191, 87, 0.3);
}

.ttc-target-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ttc-target-list + .ttc-target-list {
  margin-top: 5px;
}

.ttc-target-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(245, 238, 224, 0.14);
  color: var(--cream);
  text-align: left;
  cursor: pointer;
  transition: all 0.14s ease;
}

.ttc-target-item:hover,
.ttc-target-item.active {
  background: rgba(38, 191, 87, 0.2);
  border-color: #26bf57;
}

.ttc-target-item.landmark:hover,
.ttc-target-item.landmark.active {
  background: rgba(255, 184, 0, 0.2);
  border-color: var(--amber);
}

.tti-step {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: var(--amber);
  color: var(--ink);
  display: inline-grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 900;
  flex-shrink: 0;
}

.tti-zone-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #26bf57;
  box-shadow: 0 0 8px #26bf57;
  flex-shrink: 0;
}

.tti-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.tti-main strong {
  font-size: 12px;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tti-main span {
  font-size: 10.5px;
  color: rgba(245, 238, 224, 0.68);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tlh-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tlh-cat-select {
  height: 24px;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  color: var(--tx-1);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.mqr-cat-tag {
  padding: 0 6px;
  border-radius: 3px;
  border: 1px solid color-mix(in srgb, var(--cat-c) 55%, transparent);
  background: color-mix(in srgb, var(--cat-c) 14%, transparent);
  color: var(--cat-c);
  font-family: var(--font-display);
  font-size: 10.5px;
  font-weight: 700;
}

/* SVG Green Area Ranges & Route Lines */
.quest-green-poly,
.quest-green-circle {
  filter: drop-shadow(0 0 10px rgba(38, 191, 87, 0.55));
  animation: questGreenPulse 2.4s ease-in-out infinite;
}

.quest-green-poly-dash,
.quest-green-circle-dash,
.quest-step-line {
  animation: questDashFlow 14s linear infinite;
}

@keyframes questGreenPulse {
  0%,
  100% {
    fill-opacity: 0.9;
    stroke-opacity: 0.95;
  }
  50% {
    fill-opacity: 0.55;
    stroke-opacity: 0.65;
  }
}

@keyframes questDashFlow {
  to {
    stroke-dashoffset: -140;
  }
}

/* HTML Quest Targets Layer on Map Plane */
.quest-targets-layer {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

.quest-zone-pill {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 10px;
  border-radius: 5px;
  background: rgba(8, 24, 14, 0.92);
  border: 1.5px solid #26bf57;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.72), 0 0 12px rgba(38, 191, 87, 0.35);
  color: #eafff0;
  cursor: pointer;
  transition: transform 0.14s ease, border-color 0.14s ease;
}

.quest-zone-pill.has-landmarks {
  transform: translate(-50%, calc(-50% - 34px)) scale(var(--inv-scale, 1));
}

.quest-zone-pill:hover,
.quest-zone-pill.active {
  border-color: #8affb3;
  background: rgba(12, 38, 22, 0.96);
}

.qzp-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #26bf57;
  box-shadow: 0 0 8px #5dff8e;
  flex-shrink: 0;
}

.qzp-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.qzp-text strong {
  font-size: 12px;
  font-weight: 800;
  color: #7effa3;
  white-space: nowrap;
}

.qzp-text span {
  font-size: 10.5px;
  color: rgba(234, 255, 240, 0.85);
  white-space: nowrap;
}

/* Detailed Quest Landmark Pin */
.quest-landmark-pin {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  pointer-events: auto;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  z-index: 11;
}

.quest-landmark-pin.active {
  z-index: 15;
}

.qlp-pulse {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 1.5px solid #22c55e;
  opacity: 0.75;
  animation: qlpRipple 1.8s ease-out infinite;
  pointer-events: none;
}

.quest-landmark-pin.lm-photo .qlp-pulse {
  border-color: #26bf57;
}

@keyframes qlpRipple {
  0% {
    transform: scale(0.85);
    opacity: 0.85;
  }
  100% {
    transform: scale(1.65);
    opacity: 0;
  }
}

.qlp-head {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #16a34a;
  border: 1.5px solid #ecfdf5;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
  transition: transform 0.14s ease, border-color 0.14s ease, background 0.14s ease;
}

.quest-landmark-pin.lm-deliver .qlp-head {
  background: #ea580c;
}

.quest-landmark-pin.lm-interact .qlp-head {
  background: #16a34a;
}

.quest-landmark-pin.lm-photo .qlp-head {
  background: #10b981;
}

.quest-landmark-pin:hover .qlp-head,
.quest-landmark-pin.active .qlp-head {
  transform: scale(1.15);
  border-color: #ffffff;
  background: #facc15;
}

.qlp-num {
  color: #052e16;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
}

.qlp-icon {
  width: 12px;
  height: 12px;
  object-fit: contain;
  filter: brightness(0.08);
}

.qlp-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(10, 14, 24, 0.94);
  border: 1px solid rgba(255, 184, 0, 0.65);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.75);
  max-width: 190px;
}

.quest-landmark-pin.active .qlp-label {
  border-color: #ffffff;
  background: rgba(16, 23, 38, 0.98);
}

.qlp-label strong {
  font-size: 11.5px;
  font-weight: 800;
  color: #fff6e0;
  white-space: nowrap;
}

.qlp-sub {
  font-size: 10px;
  color: #ffd166;
  white-space: nowrap;
}

/* Bottom-Left Quest Landmark Location Detail Inspector */
.quest-landmark-inspector {
  position: absolute;
  left: 22px;
  bottom: 22px;
  width: 350px;
  max-width: calc(100% - 44px);
  z-index: 16;
  padding: 13px 15px;
  border-radius: 7px;
  background: rgba(11, 15, 25, 0.96);
  border: 1.5px solid #ffb800;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(8px);
}

.qli-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qli-step-box {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 8px;
  border-radius: 5px;
  background: rgba(255, 184, 0, 0.16);
  border: 1px solid rgba(255, 184, 0, 0.55);
  flex-shrink: 0;
}

.qli-step-box.zone {
  background: rgba(38, 191, 87, 0.18);
  border-color: #26bf57;
}

.qli-step-num {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 900;
  color: #ffb800;
}

.qli-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.qli-titles {
  flex: 1;
  min-width: 0;
}

.qli-kicker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 2px;
}

.qli-type-badge {
  padding: 1px 6px;
  border-radius: 3px;
  background: #ffb800;
  color: #090c14;
  font-size: 10.5px;
  font-weight: 900;
}

.qli-type-badge.zone {
  background: #26bf57;
}

.qli-quest-name {
  font-size: 11px;
  color: rgba(245, 238, 224, 0.68);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qli-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  color: #ffffff;
}

.qli-close {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(245, 238, 224, 0.2);
  background: transparent;
  color: rgba(245, 238, 224, 0.75);
  cursor: pointer;
}

.qli-close:hover {
  border-color: #ffffff;
  color: #ffffff;
}

.qli-area-bar {
  margin-top: 9px;
  padding: 6px 9px;
  border-radius: 4px;
  background: rgba(38, 191, 87, 0.14);
  border-left: 3px solid #26bf57;
  font-size: 12px;
  color: #eafff0;
}

.qli-area-bar span {
  color: #7effa3;
  font-weight: 700;
}

.qli-item-bar {
  margin-top: 6px;
  padding: 5px 9px;
  border-radius: 4px;
  background: rgba(255, 184, 0, 0.14);
  border-left: 3px solid #ffb800;
  font-size: 12px;
  color: #fff6e0;
}

.qli-item-bar span {
  color: #ffb800;
  font-weight: 700;
}

.qli-detail {
  margin: 9px 0 0;
  font-size: 12.5px;
  line-height: 1.55;
  color: rgba(245, 238, 224, 0.94);
}

.qli-actions {
  margin-top: 9px;
}

.ttc-any-hint {
  margin-bottom: 6px;
  padding: 5px 8px;
  border-radius: 4px;
  background: rgba(245, 238, 224, 0.08);
  border-left: 3px solid var(--tx-3);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--tx-2);
}
</style>
