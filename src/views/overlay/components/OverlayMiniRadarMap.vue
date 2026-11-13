<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMapsStore } from '../../../stores/useMapsStore'
import { useQuestsStore } from '../../../stores/useQuestsStore'
import { useOverlayStore } from '../../../stores/useOverlayStore'
import { assetUrl } from '../../../utils/assetUrl'
import {
  buildMapEliteArcCategories,
  buildMapPlantCategories,
  buildMapSpecialEvents,
  buildMapTrialCategories,
  collectActiveTacticalMarkers,
  countLiveServerEventMarkers,
  getShortLayerLabel as formatShortLayerLabel,
  polyPointsSquare,
  resolveCurrentLayerObj,
  resolveLiveServerEventIds,
} from '../../../composables/useTacticalMapCommons'

const mapsStore = useMapsStore()
const questsStore = useQuestsStore()
const overlayStore = useOverlayStore()

const currentMap = computed(() => mapsStore.getMapById(overlayStore.overlayMapId))
const activeState = computed(() => mapsStore.getActiveStateForMap(currentMap.value.id))

const activeMapLayer = ref(0)
const showMapAlphaBar = ref(false)
const showFilterForm = ref(false)

// Collapsible sections inside the Image-2-style Filter Form
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

const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0 })
const boardWrapRef = ref(null)
const boardSize = ref(340)
const saveToastText = ref('')
let saveToastTimer = null
let ro = null

const inspectedItem = ref(null) // { type: 'quest-lm' | 'quest-zone' | 'poi' | 'ext' | 'event', data }

const savedAlignForCurrentMap = computed(() =>
  overlayStore.getMapAlignment(currentMap.value.id),
)

// Concise 2-layer naming: "蓝门上" / "蓝门下", "太空港上" / "太空港下", "星辰山上" / "星辰山下"
function getShortLayerLabel(lyr) {
  return formatShortLayerLabel(currentMap.value, lyr)
}

const currentLayerObj = computed(() =>
  resolveCurrentLayerObj(currentMap.value, activeMapLayer.value),
)

const layerLootZones = computed(() =>
  (currentMap.value.lootZones || []).filter((lz) => (lz.layer ?? 0) === activeMapLayer.value),
)

const layerPois = computed(() =>
  (currentMap.value.pois || []).filter((p) => (p.layer ?? 0) === activeMapLayer.value),
)

const macroPois = computed(() => layerPois.value.filter((p) => p.zoom === 0))

// Separate regular landmarks from locked key rooms so both switches in the form work independently
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

// Tracked quest targets on this map
const currentQuestTargets = computed(() => {
  const q = mapsStore.trackedQuest
  if (!q?.mapTargets) return { zones: [], landmarks: [] }
  return q.mapTargets[currentMap.value.id] || { zones: [], landmarks: [] }
})

const activeQuestZones = computed(() =>
  (currentQuestTargets.value.zones || []).filter((z) => (z.layer ?? 0) === activeMapLayer.value),
)

const activeQuestLandmarks = computed(() =>
  (currentQuestTargets.value.landmarks || []).filter(
    (lm) => (lm.layer ?? 0) === activeMapLayer.value,
  ),
)

/* =====================================================================
   Events & Weekly Trials Catalog for Form Section 2 ("事件与试炼")
   ===================================================================== */
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

// Combined active Event, Trial, Plant & Elite ARC markers on the current map layer
const activeEventMarkers = computed(() =>
  collectActiveTacticalMarkers(currentMap.value, {
    showLiveEventMarkers: showLiveEventMarkers.value,
    liveEventIds: liveServerEventIds.value,
    enabledEventIds: enabledEventIds.value,
    enabledTrialIds: enabledTrialIds.value,
    enabledPlantIds: enabledPlantIds.value,
    enabledEliteArcIds: enabledEliteArcIds.value,
    layerFilter: activeMapLayer.value,
  }),
)

const activePlantZones = computed(() => {
  const m = currentMap.value
  const zDict = m.plantZones || {}
  const out = []
  for (const plId of enabledPlantIds.value) {
    for (const z of zDict[plId] || []) {
      if ((z.layer ?? 0) === activeMapLayer.value) {
        out.push(z)
      }
    }
  }
  return out
})

// Form Section 1 ("地点") rows definition
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

const markerInvScale = computed(() => +(1 / Math.pow(Math.max(0.45, zoom.value), 0.72)).toFixed(3))

function updateBoardSize() {
  const el = boardWrapRef.value
  if (!el) return
  const pad = overlayStore.fullscreen ? 16 : 8
  const next = Math.max(220, Math.min(el.clientWidth - pad, el.clientHeight - pad))
  if (Math.abs(next - boardSize.value) >= 1) {
    boardSize.value = Math.floor(next)
  }
}

function resetView() {
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}

function applySavedAlignmentIfAny() {
  const saved = overlayStore.getMapAlignment(currentMap.value.id)
  if (saved) {
    zoom.value = saved.zoom || 1
    pan.value = { x: saved.x || 0, y: saved.y || 0 }
    return true
  }
  return false
}

function handleSaveAlignment() {
  overlayStore.saveMapAlignment(currentMap.value.id, zoom.value, pan.value.x, pan.value.y)
  saveToastText.value = '已记忆'
  if (saveToastTimer) clearTimeout(saveToastTimer)
  saveToastTimer = setTimeout(() => {
    saveToastText.value = ''
  }, 1600)
}

function setExactZoom(nextVal) {
  const clamped = Math.min(4.5, Math.max(0.3, +Number(nextVal || 1).toFixed(3)))
  zoom.value = clamped
}

function adjustZoom(delta) {
  setExactZoom(zoom.value + delta)
}

function centerAt(xPct, yPct, targetZoom = 1.55) {
  const z = Math.min(3.5, Math.max(0.4, targetZoom))
  zoom.value = z
  const sz = boardSize.value || 340
  const dx = ((50 - xPct) / 100) * sz * z
  const dy = ((50 - yPct) / 100) * sz * z
  const maxPan = Math.max(sz * 0.9, (z - 0.3) * (sz * 0.75))
  pan.value = {
    x: Math.max(-maxPan, Math.min(maxPan, Math.round(dx))),
    y: Math.max(-maxPan, Math.min(maxPan, Math.round(dy))),
  }
}

function selectQuestLandmark(lm, shouldCenter = false) {
  if (!lm) return
  activeMapLayer.value = lm.layer ?? 0
  inspectedItem.value = { type: 'quest-lm', data: lm }
  if (shouldCenter && !(overlayStore.fullscreen && savedAlignForCurrentMap.value)) {
    centerAt(lm.x, lm.y, Math.max(zoom.value, 1.55))
  }
}

function focusTrackedQuest() {
  const allLms = currentQuestTargets.value.landmarks || []
  const allZones = currentQuestTargets.value.zones || []
  if (allLms.length) {
    const first = allLms[0]
    activeMapLayer.value = first.layer ?? 0
    inspectedItem.value = { type: 'quest-lm', data: first }
    if (!(overlayStore.fullscreen && savedAlignForCurrentMap.value)) {
      centerAt(first.x, first.y, 1.6)
    }
  } else if (allZones.length) {
    const firstZ = allZones[0]
    activeMapLayer.value = firstZ.layer ?? 0
    inspectedItem.value = { type: 'quest-zone', data: firstZ }
    if (!(overlayStore.fullscreen && savedAlignForCurrentMap.value)) {
      centerAt(firstZ.x, firstZ.y, 1.45)
    }
  }
}

function onWheel(e) {
  e.preventDefault()
  const step = e.shiftKey ? 0.015 : overlayStore.fullscreen ? 0.06 : 0.18
  adjustZoom(e.deltaY < 0 ? step : -step)
}

function onPointerDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('.omr-pin, .omr-hud-btn, .omr-inspector, .omr-filter-popover')) return
  isPanning.value = true
  panStart.value = { x: e.clientX - pan.value.x, y: e.clientY - pan.value.y }
}

let panRafId = 0
let pendingPanX = 0
let pendingPanY = 0

function onPointerMove(e) {
  if (!isPanning.value) return
  pendingPanX = e.clientX
  pendingPanY = e.clientY
  if (panRafId) return
  panRafId = requestAnimationFrame(() => {
    panRafId = 0
    if (!isPanning.value) return
    const sz = boardSize.value || 340
    const maxPan = Math.max(sz * 0.85, zoom.value * sz * 0.75)
    const rx = pendingPanX - panStart.value.x
    const ry = pendingPanY - panStart.value.y
    pan.value = {
      x: Math.max(-maxPan, Math.min(maxPan, Math.round(rx))),
      y: Math.max(-maxPan, Math.min(maxPan, Math.round(ry))),
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

watch(
  () => overlayStore.overlayMapId,
  (newMapId) => {
    const m = mapsStore.getMapById(newMapId)
    activeMapLayer.value = m.defaultLayer ?? 0
    enabledEventIds.value = []
    enabledTrialIds.value = []
    enabledPlantIds.value = []
    enabledEliteArcIds.value = []
    inspectedItem.value = null
    if (overlayStore.fullscreen && applySavedAlignmentIfAny()) {
      return
    }
    resetView()
    if (mapsStore.trackedQuestId) {
      focusTrackedQuest()
    }
  },
)

watch(
  () => overlayStore.fullscreen,
  async (isFs) => {
    await nextTick()
    updateBoardSize()
    if (isFs) {
      applySavedAlignmentIfAny()
    } else {
      resetView()
    }
  },
)

watch(
  [showFilterForm, () => overlayStore.fullscreen, () => overlayStore.collapsed],
  async ([isOpen, isFs, isCol]) => {
    await overlayStore.setLeftDrawerOpen(Boolean(isOpen && !isFs && !isCol))
    await nextTick()
    updateBoardSize()
  },
  { immediate: true },
)

watch(
  () => mapsStore.trackedQuestId,
  (newQId) => {
    if (newQId) {
      focusTrackedQuest()
    } else if (inspectedItem.value?.type?.startsWith('quest')) {
      inspectedItem.value = null
    }
  },
)

onMounted(() => {
  updateBoardSize()
  if (typeof ResizeObserver !== 'undefined' && boardWrapRef.value) {
    ro = new ResizeObserver(() => updateBoardSize())
    ro.observe(boardWrapRef.value)
  }
  if (overlayStore.fullscreen) {
    applySavedAlignmentIfAny()
  } else if (mapsStore.trackedQuestId) {
    focusTrackedQuest()
  }
})

onBeforeUnmount(() => {
  overlayStore.setLeftDrawerOpen(false)
  if (ro) {
    ro.disconnect()
    ro = null
  }
  if (saveToastTimer) {
    clearTimeout(saveToastTimer)
  }
})
</script>

<template>
  <div
    class="omr-shell"
    :class="{ 'is-fs-mode': overlayStore.fullscreen }"
    :style="{ '--map-alpha': overlayStore.mapOpacity }"
  >
    <!-- =================================================================
         UNIFIED COMPACT SETTINGS PANEL (Same width & layout in both
         normal overlay window and fullscreen mode!)
         ================================================================= -->
    <div class="omr-settings-dock no-drag">
      <!-- ROW 1: Single-line aligned Map Select + Short Layer Tabs (蓝门上/蓝门下) + Filter Form + Opacity + Fullscreen -->
      <div class="omr-toolbar">
        <select
          v-model="overlayStore.overlayMapId"
          class="omr-map-select"
          aria-label="选择战区地图"
        >
          <option v-for="m in mapsStore.maps" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
        </select>

        <div v-if="currentMap.layers?.length > 1" class="omr-layer-tabs">
          <button
            v-for="lyr in currentMap.layers"
            :key="lyr.id"
            type="button"
            class="omr-layer-btn"
            :class="{ active: activeMapLayer === lyr.id }"
            @click="activeMapLayer = lyr.id"
          >
            {{ getShortLayerLabel(lyr) }}
          </button>
        </div>

        <div class="omr-toolbar-right">
          <!-- Toggle Button for Image-2-Style Selectable Filter Form -->
          <button
            type="button"
            class="omr-tool-btn"
            :class="{ active: showFilterForm }"
            title="展开/收起地标、钥匙房、当前事件与试炼筛选表单"
            @click="showFilterForm = !showFilterForm; showMapAlphaBar = false"
          >
            <span>图标筛选</span>
            <em class="ar-num">{{ activeFilterSwitchesCount }}</em>
          </button>

          <button
            type="button"
            class="omr-tool-btn"
            :class="{ active: showMapAlphaBar }"
            title="点击展开调节地图透明度与对位比例"
            @click="showMapAlphaBar = !showMapAlphaBar; showFilterForm = false"
          >
            透明 {{ Math.round(overlayStore.mapOpacity * 100) }}%
          </button>

          <button
            type="button"
            class="omr-tool-btn fs-trigger"
            :class="{ active: overlayStore.fullscreen }"
            title="放大至全屏透明对标模式 / 恢复小窗口 (快捷键 Alt+F)"
            @click="overlayStore.toggleFullscreen()"
          >
            {{ overlayStore.fullscreen ? '退出全屏' : '全屏' }}
          </button>
        </div>
      </div>

      <!-- ROW 2 (Collapsible or shown in Fullscreen): Single-line Map Opacity + Scale -->
      <div v-if="showMapAlphaBar || overlayStore.fullscreen" class="omr-alpha-panel">
        <div class="oap-row">
          <span class="oai-lbl">透明</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            :value="overlayStore.mapOpacity"
            class="oai-slider"
            @input="overlayStore.setMapOpacity(Number($event.target.value))"
          />
          <strong class="ar-num oai-val">{{ Math.round(overlayStore.mapOpacity * 100) }}%</strong>

          <span class="oap-divider"></span>

          <span class="oai-lbl">比例</span>
          <button type="button" class="oai-step" @click="adjustZoom(-0.02)">−</button>
          <input
            type="range"
            min="0.35"
            max="3.0"
            step="0.01"
            :value="zoom"
            class="oai-slider"
            @input="setExactZoom(Number($event.target.value))"
          />
          <button type="button" class="oai-step" @click="adjustZoom(0.02)">+</button>
          <strong class="ar-num oai-val">{{ Math.round(zoom * 100) }}%</strong>

          <button
            v-if="overlayStore.fullscreen"
            type="button"
            class="oai-preset"
            title="记忆当前地图的缩放比例与偏移位置"
            @click="handleSaveAlignment"
          >
            {{ saveToastText || '记忆' }}
          </button>
          <button
            v-if="overlayStore.fullscreen && savedAlignForCurrentMap"
            type="button"
            class="oai-preset"
            @click="applySavedAlignmentIfAny"
          >
            恢复
          </button>
          <button type="button" class="oai-preset" @click="resetView">重置</button>
        </div>
      </div>

      <!-- Tracked Quest Mini Strip (if active) -->
      <div v-if="mapsStore.trackedQuest" class="omr-tracked-strip">
        <div class="ots-left" @click="focusTrackedQuest" title="点击居中定位任务目标">
          <span class="ots-dot">⌖</span>
          <strong class="ots-title">{{ mapsStore.trackedQuest.zhTitle }}</strong>
          <span
            v-if="currentQuestTargets.landmarks?.length || currentQuestTargets.zones?.length"
            class="ots-count"
          >
            {{ currentQuestTargets.landmarks?.length || currentQuestTargets.zones?.length }}处标点
          </span>
          <span v-else class="ots-any">全图通用</span>
        </div>
        <div class="ots-actions">
          <div v-if="currentQuestTargets.landmarks?.length > 1" class="ots-steps">
            <button
              v-for="lm in currentQuestTargets.landmarks"
              :key="lm.id"
              type="button"
              class="ots-step-pill"
              :class="{
                active:
                  inspectedItem?.type === 'quest-lm' && inspectedItem?.data?.id === lm.id,
              }"
              :title="`步骤 ${lm.step}: ${lm.title}`"
              @click.stop="selectQuestLandmark(lm, true)"
            >
              {{ lm.step }}
            </button>
          </div>
          <button
            type="button"
            class="ots-done-btn"
            :class="{ done: questsStore.isQuestDone(mapsStore.trackedQuest.id) }"
            title="标记此任务已完成"
            @click="questsStore.toggleQuestDone(mapsStore.trackedQuest.id)"
          >
            {{ questsStore.isQuestDone(mapsStore.trackedQuest.id) ? '✓ 已完成' : '完成' }}
          </button>
          <button
            type="button"
            class="ots-clear-btn"
            title="取消地图标点追踪"
            @click="mapsStore.trackedQuestId = ''"
          >
            ✕
          </button>
        </div>
      </div>
    </div>

    <!-- ===============================================================
         IMAGE-2-STYLE SELECTABLE LAYER & EVENT FILTER FORM
         Displayed to the LEFT of the floating overlay window in both
         normal mode and fullscreen mode so it never blocks the map!
         =============================================================== -->
    <aside
      v-if="showFilterForm"
      class="omr-filter-popover no-drag"
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

    <!-- =================================================================
         INTERACTIVE 1:1 TACTICAL MAP CANVAS
         ================================================================= -->
    <div
      ref="boardWrapRef"
      class="omr-board-wrap"
      :class="{ panning: isPanning, 'is-fs-board': overlayStore.fullscreen }"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    >

      <div
        class="omr-plane"
        :style="{
          width: `${boardSize}px`,
          height: `${boardSize}px`,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          '--inv-scale': markerInvScale,
        }"
      >
        <template v-if="currentLayerObj.overlayOnBase">
          <img
            :src="assetUrl(currentMap.tacticalImage)"
            :alt="currentMap.name"
            class="omr-base-img dimmed"
            draggable="false"
          />
          <img
            :src="assetUrl(currentLayerObj.image)"
            :alt="currentLayerObj.label"
            class="omr-overlay-img"
            draggable="false"
          />
        </template>
        <template v-else>
          <img
            :src="assetUrl(currentLayerObj.image || currentMap.tacticalImage)"
            :alt="currentMap.name"
            class="omr-base-img"
            draggable="false"
          />
        </template>

        <!-- Alignment Border Frame (helps align map edges when mapOpacity is low) -->
        <div v-if="overlayStore.fullscreen" class="omr-align-frame"></div>

        <!-- SVG Polygons: Loot Zones & Tracked Quest Green Zones -->
        <svg class="omr-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" fill="none">
          <g v-if="mapsStore.layers.lootZones">
            <polygon
              v-for="lz in layerLootZones"
              :key="lz.id"
              :points="polyPointsSquare(lz.polygon)"
              :fill="
                lz.tier === 'high'
                  ? 'rgba(255, 59, 47, 0.16)'
                  : lz.tier === 'medium'
                    ? 'rgba(255, 188, 19, 0.14)'
                    : 'rgba(245, 238, 224, 0.05)'
              "
              :stroke="
                lz.tier === 'high'
                  ? '#ff3b2f'
                  : lz.tier === 'medium'
                    ? '#ffbc13'
                    : 'rgba(245, 238, 224, 0.35)'
              "
              stroke-width="2.4"
              stroke-linejoin="round"
            />
          </g>

          <g v-if="activeQuestZones.length || activeQuestLandmarks.length">
            <template v-for="z in activeQuestZones" :key="`qz-${z.id}`">
              <polygon
                v-if="z.polygon?.length"
                :points="polyPointsSquare(z.polygon)"
                fill="rgba(38, 191, 87, 0.28)"
                stroke="#26bf57"
                stroke-width="3.6"
              />
              <circle
                v-else
                :cx="z.x * 10"
                :cy="z.y * 10"
                :r="z.r || 50"
                fill="rgba(38, 191, 87, 0.26)"
                stroke="#26bf57"
                stroke-width="3.4"
              />
            </template>
            <template v-for="lm in activeQuestLandmarks" :key="`ql-line-${lm.id}`">
              <line
                v-if="lm.targetXY"
                :x1="lm.x * 10"
                :y1="lm.y * 10"
                :x2="lm.targetXY[0] * 10"
                :y2="lm.targetXY[1] * 10"
                stroke="rgba(74, 222, 128, 0.85)"
                stroke-width="2.6"
                stroke-dasharray="7 5"
              />
            </template>
          </g>

          <g v-if="activePlantZones.length">
            <template v-for="pz in activePlantZones" :key="`pz-${pz.id}`">
              <circle
                :cx="pz.x * 10"
                :cy="pz.y * 10"
                :r="(pz.radius || 4.5) * 10"
                :fill="pz.accent || '#4ade80'"
                fill-opacity="0.16"
                :stroke="pz.accent || '#4ade80'"
                stroke-width="2.8"
              />
              <circle
                :cx="pz.x * 10"
                :cy="pz.y * 10"
                :r="Math.max(14, (pz.radius || 4.5) * 10 - 6)"
                fill="none"
                :stroke="pz.accent || '#4ade80'"
                stroke-width="1.5"
                stroke-dasharray="7 5"
                stroke-opacity="0.85"
              />
            </template>
          </g>
        </svg>

        <!-- Regular Landmarks (Macro + Major + Minor POIs) -->
        <div v-if="mapsStore.layers.pois" class="omr-layer-abs">
          <div
            v-for="mp in macroPois"
            :key="mp.id"
            class="omr-macro-label"
            :style="{ left: `${mp.x}%`, top: `${mp.y}%` }"
          >
            {{ mp.name }}
          </div>

          <button
            v-for="p in normalMajorPois"
            :key="p.id"
            type="button"
            class="omr-pin omr-poi-pin"
            :style="{ left: `${p.x}%`, top: `${p.y}%` }"
            :title="p.name"
            @click.stop="inspectedItem = { type: 'poi', data: p }"
          >
            <span class="omr-poi-txt">{{ p.name }}</span>
          </button>

          <template v-if="zoom >= 1.35 || overlayStore.fullscreen">
            <button
              v-for="mn in normalMinorPois"
              :key="mn.id"
              type="button"
              class="omr-pin omr-minor-pin"
              :style="{ left: `${mn.x}%`, top: `${mn.y}%` }"
              :title="mn.name"
              @click.stop="inspectedItem = { type: 'poi', data: mn }"
            >
              <i class="omp-dot"></i>
              <span>{{ mn.name }}</span>
            </button>
          </template>
        </div>

        <!-- Locked Key Rooms (Controlled independently by "钥匙房" switch) -->
        <div v-if="mapsStore.layers.lockedRooms" class="omr-layer-abs">
          <button
            v-for="kr in lockedRoomPois"
            :key="kr.id"
            type="button"
            class="omr-pin omr-poi-pin has-key"
            :style="{ left: `${kr.x}%`, top: `${kr.y}%` }"
            :title="`${kr.name}${kr.keyRequired ? ` (${kr.keyRequired})` : ''}`"
            @click.stop="inspectedItem = { type: 'poi', data: kr }"
          >
            <img :src="assetUrl('items/T_UI_Utility_Key.png')" alt="" class="omr-key-icon" />
            <span class="omr-poi-txt">{{ kr.name }}</span>
          </button>
        </div>

        <!-- Extractions & Raider Hatches -->
        <div class="omr-layer-abs">
          <template v-for="ext in currentMap.extractions" :key="ext.id">
            <button
              v-if="ext.type !== 'hatch' && mapsStore.layers.extractions"
              type="button"
              class="omr-pin omr-ext-pin"
              :style="{ left: `${ext.x}%`, top: `${ext.y}%` }"
              :title="`${ext.name} (${ext.typeLabel})`"
              @click.stop="inspectedItem = { type: 'ext', data: ext }"
            >
              <img :src="assetUrl(ext.icon)" alt="" />
            </button>

            <button
              v-else-if="ext.type === 'hatch' && mapsStore.layers.hatches"
              type="button"
              class="omr-pin omr-ext-pin hatch"
              :class="{ disabled: activeState.hatchesDisabled }"
              :style="{ left: `${ext.x}%`, top: `${ext.y}%` }"
              :title="`${ext.name} (奇袭者暗门)`"
              @click.stop="inspectedItem = { type: 'ext', data: ext }"
            >
              <img :src="assetUrl(ext.icon)" alt="" />
              <i v-if="activeState.hatchesDisabled" class="omr-slash">✕</i>
            </button>
          </template>
        </div>

        <!-- Active Event & Weekly Trial Markers -->
        <div v-if="activeEventMarkers.length" class="omr-layer-abs">
          <button
            v-for="em in activeEventMarkers"
            :key="em.id"
            type="button"
            class="omr-pin omr-ev-pin"
            :class="{ boss: em.kind === 'boss-landmark' || em.kind === 'puzzle-hub' }"
            :style="{ left: `${em.x}%`, top: `${em.y}%`, '--ev-c': em.accent || '#ffbc13' }"
            :title="em.title"
            @click.stop="inspectedItem = { type: 'event', data: em }"
          >
            <img v-if="em.icon" :src="assetUrl(em.icon)" alt="" />
            <span v-else>★</span>
          </button>
        </div>

        <!-- Tracked Quest Green Zone Pins & Compact Numbered Step Landmarks -->
        <div v-if="activeQuestZones.length || activeQuestLandmarks.length" class="omr-layer-abs">
          <template v-if="!activeQuestLandmarks.length">
            <button
              v-for="(z, zIdx) in activeQuestZones"
              :key="z.id"
              type="button"
              class="omr-pin omr-qzone-pin"
              :class="{
                active:
                  inspectedItem?.type === 'quest-zone' && inspectedItem?.data?.id === z.id,
              }"
              :style="{ left: `${z.x}%`, top: `${z.y}%` }"
              :title="z.label"
              @click.stop="inspectedItem = { type: 'quest-zone', data: z }"
            >
              <img
                v-if="activeQuestZones.length === 1"
                :src="assetUrl('game-maps/icons/T_UI_QUEST_Visit.png')"
                alt=""
                class="omr-qlm-icon"
              />
              <b v-else>{{ zIdx + 1 }}</b>
            </button>
          </template>

          <button
            v-for="lm in activeQuestLandmarks"
            :key="lm.id"
            type="button"
            class="omr-pin omr-qlm-pin"
            :class="{
              active:
                inspectedItem?.type === 'quest-lm' && inspectedItem?.data?.id === lm.id,
            }"
            :style="{ left: `${lm.x}%`, top: `${lm.y}%` }"
            :title="`步骤 ${lm.step} · ${lm.title}`"
            @click.stop="selectQuestLandmark(lm, false)"
          >
            <img
              v-if="activeQuestLandmarks.length === 1"
              :src="assetUrl(lm.icon)"
              alt=""
              class="omr-qlm-icon"
            />
            <b v-else>{{ lm.step }}</b>
          </button>
        </div>
      </div>

      <!-- Selected Pin Inspector Card (Bottom) -->
      <div v-if="inspectedItem" class="omr-inspector" :class="`is-${inspectedItem.type}`">
        <div class="oi-head">
          <div v-if="inspectedItem.type === 'quest-lm'" class="oi-q-title-row">
            <span class="oi-q-step">步骤 {{ inspectedItem.data.step }}</span>
            <span v-if="inspectedItem.data.typeLabel" class="oi-q-type">
              {{ inspectedItem.data.typeLabel }}
            </span>
            <strong class="oi-q-name">{{ inspectedItem.data.title }}</strong>
          </div>
          <div v-else-if="inspectedItem.type === 'quest-zone'" class="oi-q-title-row">
            <span class="oi-q-step">任务区域</span>
            <strong class="oi-q-name">{{ inspectedItem.data.label }}</strong>
          </div>
          <strong v-else-if="inspectedItem.type === 'poi'">
            {{ inspectedItem.data.name }}
            <small v-if="inspectedItem.data.enName">({{ inspectedItem.data.enName }})</small>
          </strong>
          <strong v-else-if="inspectedItem.type === 'ext'">
            {{ inspectedItem.data.name }} · {{ inspectedItem.data.typeLabel }}
          </strong>
          <strong v-else-if="inspectedItem.type === 'event'">
            {{ inspectedItem.data.title }}
          </strong>

          <div class="oi-head-right">
            <div
              v-if="
                inspectedItem.type === 'quest-lm' &&
                currentQuestTargets.landmarks?.length > 1
              "
              class="oi-q-nav"
            >
              <button
                v-for="lm in currentQuestTargets.landmarks"
                :key="lm.id"
                type="button"
                class="oi-q-nav-btn"
                :class="{ active: inspectedItem.data.id === lm.id }"
                @click="selectQuestLandmark(lm, true)"
              >
                {{ lm.step }}
              </button>
            </div>
            <button type="button" class="oi-close" @click="inspectedItem = null">✕</button>
          </div>
        </div>

        <div
          v-if="
            inspectedItem.type === 'quest-lm' &&
            (inspectedItem.data.areaName || inspectedItem.data.itemText)
          "
          class="oi-q-meta"
        >
          <span v-if="inspectedItem.data.areaName" class="oi-q-area">
            📍 {{ inspectedItem.data.areaName }}
          </span>
          <span v-if="inspectedItem.data.itemText" class="oi-q-item">
            🎒 {{ inspectedItem.data.itemText }}
          </span>
        </div>

        <p
          v-if="
            inspectedItem.data.detail ||
            inspectedItem.data.desc ||
            inspectedItem.data.description ||
            inspectedItem.data.hint ||
            inspectedItem.data.subLabel
          "
          class="oi-desc"
        >
          {{
            inspectedItem.data.detail ||
            inspectedItem.data.desc ||
            inspectedItem.data.description ||
            inspectedItem.data.hint ||
            inspectedItem.data.subLabel
          }}
        </p>
        <p
          v-else-if="
            inspectedItem.type === 'ext' &&
            inspectedItem.data.type === 'hatch' &&
            activeState.hatchesDisabled
          "
          class="oi-desc warn"
        >
          当前环境（{{ activeState.activePrimary.name }}）下奇袭者暗门已锁死关闭，请前往常规撤离点。
        </p>
        <div
          v-if="inspectedItem.type === 'poi' && inspectedItem.data.lootTags?.length"
          class="oi-tags"
        >
          <span v-for="lt in inspectedItem.data.lootTags" :key="lt.id" class="ar-chip">
            {{ lt.zh }}
          </span>
          <span
            v-if="inspectedItem.data.lockedRoom || inspectedItem.data.keyRequired"
            class="ar-chip ar-chip--accent"
          >
            含上锁钥匙房
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.omr-shell {
  --map-alpha: 0.55;
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* =====================================================================
   UNIFIED COMPACT SETTINGS DOCK
   ===================================================================== */
.omr-settings-dock {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.omr-shell.is-fs-mode .omr-settings-dock {
  position: relative;
  z-index: 20;
  width: min(480px, 95vw);
  margin-left: auto;
  margin-right: 10px;
  padding: 6px 10px 8px;
  background: rgba(7, 10, 20, 0.92);
  border: 1px solid rgba(206, 193, 176, 0.32);
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
}

/* ROW 1: Strict single-line toolbar */
.omr-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  min-height: 28px;
}

.omr-map-select {
  height: 28px;
  padding: 0 8px;
  background: rgba(18, 24, 42, 0.9);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  outline: none;
  cursor: pointer;
  flex-shrink: 0;
}

.omr-map-select option {
  background: #0d1222;
  color: var(--cream);
}

.omr-layer-tabs {
  display: inline-flex;
  align-items: center;
  height: 28px;
  background: rgba(18, 24, 42, 0.88);
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  padding: 2px;
  gap: 2px;
  flex-shrink: 0;
}

.omr-layer-btn {
  height: 22px;
  padding: 0 7px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.omr-layer-btn.active {
  background: var(--cream);
  color: var(--ink);
  text-shadow: none;
}

.omr-toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.omr-tool-btn {
  height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(18, 24, 42, 0.88);
  color: var(--tx-1);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.14s;
}

.omr-tool-btn em {
  font-style: normal;
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.18);
  color: var(--amber);
}

.omr-tool-btn:hover,
.omr-tool-btn.active {
  border-color: var(--amber);
  color: var(--amber);
}

.omr-tool-btn.fs-trigger {
  background: rgba(255, 188, 19, 0.16);
  border-color: rgba(255, 188, 19, 0.55);
  color: var(--amber);
}

.omr-tool-btn.fs-trigger:hover,
.omr-tool-btn.fs-trigger.active {
  background: var(--amber);
  color: #090c19;
  text-shadow: none;
}

/* ROW 2: Map Opacity & Alignment Panel */
.omr-alpha-panel {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 6px 8px;
  background: rgba(11, 15, 28, 0.88);
  border: 1px solid var(--line);
  border-radius: 4px;
}

.oap-row {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: nowrap;
}

.oap-divider {
  width: 1px;
  height: 14px;
  background: rgba(206, 193, 176, 0.25);
  margin: 0 2px;
  flex-shrink: 0;
}

.oai-lbl {
  font-size: 11px;
  color: var(--tx-2);
  white-space: nowrap;
  flex-shrink: 0;
}

.oai-slider {
  flex: 1;
  min-width: 44px;
  accent-color: var(--amber);
  cursor: pointer;
}

.oai-val {
  font-size: 11px;
  color: var(--amber);
  min-width: 30px;
  text-align: right;
  flex-shrink: 0;
}

.oai-preset,
.oai-step {
  height: 21px;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: rgba(9, 12, 25, 0.85);
  color: var(--tx-2);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
}

.oai-preset.active,
.oai-preset:hover,
.oai-step:hover {
  border-color: var(--amber);
  color: var(--amber);
}

/* =====================================================================
   IMAGE-2-STYLE SELECTABLE LAYER & EVENT FILTER FORM
   Docked to the LEFT of the floating overlay window in both normal & fullscreen modes
   ===================================================================== */
.omr-filter-popover {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  max-height: 100vh;
  z-index: 30;
  background: #141720;
  border: 1px solid rgba(206, 193, 176, 0.32);
  border-radius: 6px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.omr-shell.is-fs-mode .omr-filter-popover {
  top: 6px;
  right: calc(min(480px, 95vw) + 16px);
  left: auto;
  width: 280px;
  height: auto;
  max-height: calc(100vh - 16px);
  z-index: 30;
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

/* Rounded Square Icon Box for Group 1 ("地点") — Matches Image 2 */
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

/* Circular Ring Icon Box for Group 2 ("事件与试炼") — Matches Image 2 */
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

/* Amber Toggle Switch — Matches Image 2 */
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

/* Tracked Quest Strip */
.omr-tracked-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px;
  background: rgba(16, 65, 35, 0.45);
  border: 1px solid rgba(38, 191, 87, 0.55);
  border-radius: 4px;
}

.ots-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
}

.ots-dot {
  color: #4ade80;
  font-weight: 800;
}

.ots-title {
  font-size: 12px;
  color: var(--tx-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ots-count,
.ots-any {
  font-size: 10.5px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.65);
  color: #86efac;
  white-space: nowrap;
}

.ots-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ots-steps {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-right: 2px;
}

.ots-step-pill {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1px solid rgba(74, 222, 128, 0.55);
  background: rgba(5, 46, 22, 0.85);
  color: #bbf7d0;
  font-size: 10.5px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.14s ease;
}

.ots-step-pill:hover,
.ots-step-pill.active {
  background: #22c55e;
  border-color: #ecfdf5;
  color: #052e16;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
}

.ots-done-btn,
.ots-clear-btn {
  height: 22px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(9, 12, 25, 0.75);
  color: var(--tx-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ots-done-btn.done {
  background: var(--c-quests);
  color: #061109;
  border-color: transparent;
  text-shadow: none;
}

/* =====================================================================
   MAP BOARD CANVAS
   ===================================================================== */
.omr-board-wrap {
  position: relative;
  flex: 1;
  min-height: 220px;
  background: rgba(6, 9, 18, calc(var(--map-alpha, 0.55) * 0.55));
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
}

.omr-board-wrap.is-fs-board {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1;
  background: transparent;
  border: none;
}

.omr-board-wrap.panning {
  cursor: grabbing;
}

.omr-plane {
  position: relative;
  transform-origin: center center;
  flex-shrink: 0;
}

.omr-base-img,
.omr-overlay-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  opacity: var(--map-alpha, 0.55);
  transition: opacity 0.08s linear;
}

.omr-base-img.dimmed {
  opacity: calc(var(--map-alpha, 0.55) * 0.4);
}

.omr-align-frame {
  position: absolute;
  inset: 0;
  border: 1.5px dashed rgba(255, 188, 19, 0.45);
  pointer-events: none;
  z-index: 1;
}

.omr-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.omr-layer-abs {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 3;
}

.omr-macro-label {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(9, 12, 25, 0.82);
  border: 1px solid rgba(249, 238, 223, 0.28);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.omr-pin {
  position: absolute;
  transform: translate(-50%, -50%) scale(var(--inv-scale, 1));
  pointer-events: auto;
  cursor: pointer;
  border: none;
}

.omr-poi-pin {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(12, 16, 28, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.26);
  color: var(--tx-1);
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
}

.omr-poi-pin.has-key {
  border-color: var(--amber);
  color: var(--cream);
}

.omr-key-icon {
  width: 11px;
  height: 11px;
  object-fit: contain;
  flex-shrink: 0;
}

.omr-minor-pin {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.78);
  color: var(--tx-2);
  font-size: 9px;
  white-space: nowrap;
}

.omp-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cream);
}

.omr-ext-pin {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  background: #f5eee0;
  border: 1.5px solid #090c19;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.75);
}

.omr-ext-pin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: brightness(0.08);
}

.omr-ext-pin.hatch.disabled {
  background: rgba(120, 30, 30, 0.92);
  border-color: #ff4d4f;
}

.omr-slash {
  position: absolute;
  color: #ff3026;
  font-style: normal;
  font-size: 13px;
  font-weight: 900;
}

.omr-ev-pin {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(9, 12, 25, 0.92);
  border: 1.5px solid var(--ev-c, var(--amber));
  color: var(--ev-c, var(--amber));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.75);
}

.omr-ev-pin.boss {
  width: 26px;
  height: 26px;
  border-width: 2px;
}

.omr-ev-pin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.omr-qzone-pin,
.omr-qlm-pin {
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  background: #16a34a;
  border: 1.5px solid #ecfdf5;
  color: #052e16;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 1px 5px rgba(0, 0, 0, 0.9),
    0 0 6px rgba(34, 197, 94, 0.55);
  z-index: 6;
  transition:
    transform 0.12s ease,
    border-color 0.12s ease,
    box-shadow 0.12s ease,
    background 0.12s ease;
}

.omr-qzone-pin:hover,
.omr-qlm-pin:hover,
.omr-qzone-pin.active,
.omr-qlm-pin.active {
  background: #facc15;
  border-color: #ffffff;
  box-shadow:
    0 0 0 2px rgba(250, 204, 21, 0.65),
    0 2px 8px rgba(0, 0, 0, 0.95);
  z-index: 9;
}

.omr-qzone-pin b,
.omr-qlm-pin b {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  color: #052e16;
}

.omr-qlm-icon {
  width: 11px;
  height: 11px;
  object-fit: contain;
  filter: brightness(0.08);
}

/* Inspector Drawer */
.omr-inspector {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: min(460px, calc(100% - 16px));
  bottom: 10px;
  z-index: 7;
  padding: 9px 11px;
  background: rgba(9, 12, 25, 0.96);
  border: 1px solid var(--amber);
  border-radius: 6px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.85);
}

.omr-inspector.is-quest-lm,
.omr-inspector.is-quest-zone {
  border-color: #4ade80;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.88),
    0 0 14px rgba(38, 191, 87, 0.22);
}

.oi-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  color: var(--cream);
}

.oi-q-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.oi-q-step {
  padding: 1px 6px;
  border-radius: 3px;
  background: #22c55e;
  color: #052e16;
  font-size: 10.5px;
  font-weight: 900;
  white-space: nowrap;
  flex-shrink: 0;
}

.oi-q-type {
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(38, 191, 87, 0.16);
  border: 1px solid rgba(74, 222, 128, 0.4);
  color: #86efac;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
}

.oi-q-name {
  font-size: 12.5px;
  font-weight: 800;
  color: #ecfdf5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oi-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.oi-q-nav {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.oi-q-nav-btn {
  width: 19px;
  height: 19px;
  border-radius: 50%;
  border: 1px solid rgba(74, 222, 128, 0.45);
  background: rgba(6, 46, 22, 0.8);
  color: #bbf7d0;
  font-size: 10px;
  font-weight: 800;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.oi-q-nav-btn.active,
.oi-q-nav-btn:hover {
  background: #22c55e;
  border-color: #fef08a;
  color: #052e16;
}

.oi-q-meta {
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.oi-q-area {
  font-size: 11px;
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 3px;
}

.oi-q-item {
  font-size: 11px;
  font-weight: 700;
  color: #fde047;
  background: rgba(250, 204, 21, 0.14);
  border: 1px solid rgba(250, 204, 21, 0.35);
  padding: 1px 6px;
  border-radius: 3px;
}

.oi-head small {
  color: var(--tx-3);
  font-weight: 500;
  margin-left: 4px;
}

.oi-close {
  border: none;
  background: transparent;
  color: var(--tx-3);
  cursor: pointer;
  font-size: 12px;
}

.oi-desc {
  margin: 5px 0 0;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--tx-1);
}

.oi-desc.warn {
  color: #ff8078;
}

.oi-tags {
  margin-top: 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
