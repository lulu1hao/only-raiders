<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { isTauriRuntime, useOverlayStore } from '../../stores/useOverlayStore'
import { traderMeta, useQuestsStore } from '../../stores/useQuestsStore'
import { useMapsStore } from '../../stores/useMapsStore'
import { useBlueprintsStore } from '../../stores/useBlueprintsStore'
import { useRaiderStore } from '../../stores/useRaiderStore'
import { useRaiderLoadoutStore } from '../../stores/useRaiderLoadoutStore'
import { assetUrl } from '../../utils/assetUrl'
import { ITEM_ICON_MAP, parseQuestRequiredItems } from '../../utils/questItemIcons'
import { abortRaiderAutoSync } from '../../utils/raiderAutoSyncPlanner'
import { useSoundboard } from '../../composables/useSoundboard'
import RotationCountdownText from '../../components/common/RotationCountdownText.vue'

const OverlayMiniRadarMap = defineAsyncComponent(
  () => import('./components/OverlayMiniRadarMap.vue'),
)
const OverlaySoundboardPanel = defineAsyncComponent(
  () => import('./components/OverlaySoundboardPanel.vue'),
)
const OverlayRaiderSkillGuide = defineAsyncComponent(
  () => import('./components/OverlayRaiderSkillGuide.vue'),
)
const OverlayRaiderLoadoutGuide = defineAsyncComponent(
  () => import('./components/OverlayRaiderLoadoutGuide.vue'),
)
const OverlayRaiderSyncPanel = defineAsyncComponent(
  () => import('./components/OverlayRaiderSyncPanel.vue'),
)
const OverlayRaiderLoadoutPanel = defineAsyncComponent(
  () => import('./components/OverlayRaiderLoadoutPanel.vue'),
)

const overlayStore = useOverlayStore()
const questsStore = useQuestsStore()
const mapsStore = useMapsStore()
const blueprintsStore = useBlueprintsStore()
const raiderStore = useRaiderStore()
const loadoutStore = useRaiderLoadoutStore()

function stopRaiderSyncNow() {
  void abortRaiderAutoSync()
}
const {
  state: sbState,
  initialize: initSoundboard,
  action: sbAction,
  startPolling: startSbPolling,
} = useSoundboard()

let stopSbPolling = null
const sbCurrentTrack = computed(() =>
  sbState.tracks.find((t) => t.id === sbState.status.trackId),
)

const showOpacityPanel = ref(false)
const showHotkeysTip = ref(false)
const expandedQuestIds = ref([])
const expandedQuestIdSet = computed(() => new Set(expandedQuestIds.value))

const activeStatesByMap = computed(() => {
  const dict = {}
  for (const m of mapsStore.maps) {
    dict[m.id] = mapsStore.getActiveStateForMap(m.id)
  }
  return dict
})

const activeMapState = computed(
  () =>
    activeStatesByMap.value[overlayStore.overlayMapId] ||
    mapsStore.getActiveStateForMap(overlayStore.overlayMapId),
)

const mapTodoCount = computed(
  () => mapsStore.getTodoQuestsForMap(overlayStore.overlayMapId).length,
)

function isQuestExpanded(qId) {
  return expandedQuestIdSet.value.has(qId)
}

function toggleQuestExpand(qId) {
  const idx = expandedQuestIds.value.indexOf(qId)
  if (idx >= 0) expandedQuestIds.value.splice(idx, 1)
  else expandedQuestIds.value.push(qId)
}

function locateQuestOnOverlayMap(quest) {
  mapsStore.trackedQuestId = quest.id
  const targetMapIds = quest.mapIds?.length
    ? quest.mapIds
    : Object.keys(quest.mapTargets || {})
  if (targetMapIds.length && !targetMapIds.includes(overlayStore.overlayMapId)) {
    overlayStore.overlayMapId = targetMapIds[0]
  } else if (quest.recommendedMapId && !targetMapIds.length) {
    overlayStore.overlayMapId = quest.recommendedMapId
  }
  overlayStore.activeTab = 'map'
  overlayStore.mapSubMode = 'radar'
}

function resolveBpThumb(bp) {
  if (bp.icon) return assetUrl(bp.icon)
  if (bp.gameIcon) return assetUrl(bp.gameIcon)
  const baseEn = String(bp.enName || '')
    .replace(/\s*(Blueprint|Design|Stencil)$/i, '')
    .trim()
  if (baseEn && ITEM_ICON_MAP[baseEn]) {
    return assetUrl(`/items/${ITEM_ICON_MAP[baseEn]}`)
  }
  return assetUrl(bp.blueprintIcon || '/items/T_UI_Icon_Recipe.png')
}

function cleanBpTitle(bp) {
  if (bp.itemName) return bp.itemName
  return String(bp.name || '').replace(/\s*(蓝图|设计图|涂装模板)$/, '')
}

function onTitlebarMouseDown(e) {
  if (e.button !== 0) return
  if (e.target.closest('button, input, select, a, .no-drag')) return
  overlayStore.startDrag()
}

function selectMapFromSchedule(mapId) {
  overlayStore.overlayMapId = mapId
  overlayStore.mapSubMode = 'radar'
}

const hasMountedRaider = ref(
  overlayStore.activeTab === 'raider' ||
    Boolean(overlayStore.raiderOverlayIntent?.ts) ||
    Boolean(overlayStore.raiderSyncRuntime?.running),
)

watch(
  () => [
    overlayStore.activeTab,
    overlayStore.raiderOverlayIntent?.ts,
    overlayStore.raiderSyncRuntime?.running,
  ],
  ([tab, intentTs, running]) => {
    if (tab === 'raider' || intentTs || running) {
      hasMountedRaider.value = true
    }
  },
)

const isWindowActive = computed(() => !isTauriRuntime() || overlayStore.overlayVisible)
let holdingClock = false

function syncBackgroundTimers(active) {
  if (active) {
    if (!holdingClock) {
      mapsStore.startClock()
      holdingClock = true
    }
    if (!stopSbPolling) {
      stopSbPolling = startSbPolling()
    }
  } else {
    if (holdingClock) {
      mapsStore.stopClock()
      holdingClock = false
    }
    if (stopSbPolling) {
      stopSbPolling()
      stopSbPolling = null
    }
  }
}

watch(isWindowActive, (active) => {
  syncBackgroundTimers(active)
})

onMounted(() => {
  syncBackgroundTimers(isWindowActive.value)
  void initSoundboard().catch(() => {})
})

onBeforeUnmount(() => {
  syncBackgroundTimers(false)
})
</script>

<template>
  <div
    class="overlay-root"
    :class="{
      'is-collapsed': overlayStore.collapsed,
      'is-fullscreen': overlayStore.fullscreen,
      'is-click-through': overlayStore.clickThrough,
      'has-left-drawer':
        overlayStore.leftDrawerOpen && !overlayStore.fullscreen && !overlayStore.collapsed,
    }"
    :style="{ '--ov-alpha': overlayStore.opacity }"
  >
    <!-- =================================================================
         MODE 1: 48px Top Mini Capsule Bar (折叠胶囊态)
         ================================================================= -->
    <header
      v-if="overlayStore.collapsed"
      class="ov-mini-capsule"
      @mousedown="onTitlebarMouseDown"
    >
      <div class="omc-drag-grip" title="按住拖拽位置">⋮⋮</div>

      <template v-if="overlayStore.raiderSyncRuntime?.running">
        <div class="omc-raider-sync no-drag">
          <span class="omc-rs-tag ar-num">
            {{
              overlayStore.raiderSyncRuntime.moduleMode === 'loadout' ? '自动配装' : '自动加点'
            }}
            {{ overlayStore.raiderSyncRuntime.progressPct }}%
          </span>
          <span class="omc-rs-msg">{{ overlayStore.raiderSyncRuntime.text }}</span>
          <i
            class="omc-rs-bar"
            :style="{ width: `${overlayStore.raiderSyncRuntime.progressPct}%` }"
          ></i>
        </div>

        <div class="omc-right no-drag">
          <button
            type="button"
            class="ov-icon-btn omc-stop-btn"
            title="立即停止自动加点并释放鼠标左键 (快捷键 ESC / F10)"
            @click="stopRaiderSyncNow"
          >
            急停 (ESC)
          </button>
        </div>
      </template>

      <template v-else>
        <!-- Server & Live Rotation Countdown -->
        <div class="omc-timer" title="当前服务器整点词条轮换倒计时">
          <span class="omc-srv">{{ mapsStore.selectedServer.id }}</span>
          <strong class="ar-num"><RotationCountdownText /></strong>
        </div>

        <!-- Current Map & Active Condition -->
        <button
          type="button"
          class="omc-map-pill"
          title="点击展开并查看当前地图"
          @click="overlayStore.toggleCollapsed(); overlayStore.activeTab = 'map'"
        >
          <span class="omc-map-name">{{ overlayStore.activeOverlayMap?.name }}</span>
          <span class="omc-cond-sep">·</span>
          <span class="omc-cond-name">{{ activeMapState.activePrimary.name }}</span>
        </button>

        <!-- Tracked / Pinned Quest Summary -->
        <button
          type="button"
          class="omc-quest-pill"
          title="点击展开查看局内任务"
          @click="overlayStore.toggleCollapsed(); overlayStore.activeTab = 'quests'"
        >
          <template v-if="overlayStore.miniBarQuest">
            <span class="omc-q-tag">追踪</span>
            <span class="omc-q-txt">{{ overlayStore.miniBarQuest.zhTitle }}</span>
          </template>
          <template v-else>
            <span class="omc-q-tag">待办</span>
            <span class="omc-q-txt">{{ mapTodoCount }} 项当前图任务</span>
          </template>
        </button>

        <div class="omc-right no-drag">
          <button
            type="button"
            class="ov-icon-btn lock-btn"
            :class="{ active: overlayStore.clickThrough }"
            title="鼠标穿透开关（开启后鼠标移至顶部仍可点击取消穿透，快捷键 Alt+X / F10）"
            @click="overlayStore.toggleClickThrough()"
          >
            {{ overlayStore.clickThrough ? '取消穿透' : '穿透' }}
          </button>
          <button
            type="button"
            class="ov-icon-btn"
            title="展开完整悬浮窗 (Alt+M)"
            @click="overlayStore.toggleCollapsed()"
          >
            展开
          </button>
          <button
            type="button"
            class="ov-icon-btn close"
            title="关闭悬浮窗并返回主窗口 (Alt+Q / F9)"
            @click="overlayStore.closeOverlay(true)"
          >
            ✕
          </button>
        </div>
      </template>
    </header>

    <!-- =================================================================
         MODE 2: Full Tactical Overlay Window (展开态)
         ================================================================= -->
    <template v-else>
      <div class="ar-stripe"></div>

      <!-- Custom Frameless Titlebar (Always interactive on hover even in click-through mode) -->
      <header class="ov-titlebar" @mousedown="onTitlebarMouseDown">
        <div class="ovt-left">
          <span class="ovt-grip" title="按住此处拖拽悬浮窗">⋮⋮</span>
          <span class="ovt-brand">ARC HUD</span>
          <div class="ovt-timer-pill" title="服务器词条轮换倒计时">
            <span>{{ mapsStore.selectedServer.name }}</span>
            <strong class="ar-num"><RotationCountdownText /></strong>
          </div>
        </div>

        <div class="ovt-controls no-drag">
          <!-- Hotkeys Info Button -->
          <button
            type="button"
            class="ov-icon-btn"
            :class="{ active: showHotkeysTip }"
            title="查看全局快捷键说明"
            @click="showHotkeysTip = !showHotkeysTip; showOpacityPanel = false"
          >
            热键
          </button>

          <!-- Background Opacity Popover Button -->
          <button
            type="button"
            class="ov-icon-btn"
            :class="{ active: showOpacityPanel }"
            title="调节背景不透明度（仅淡化底色，文字保持高清突出）"
            @click="showOpacityPanel = !showOpacityPanel; showHotkeysTip = false"
          >
            背景 {{ Math.round(overlayStore.opacity * 100) }}%
          </button>

          <!-- Always on Top Toggle -->
          <button
            type="button"
            class="ov-icon-btn"
            :class="{ active: overlayStore.alwaysOnTop }"
            title="窗口置顶开关"
            @click="overlayStore.toggleAlwaysOnTop()"
          >
            置顶
          </button>

          <!-- Click-Through Lock Toggle -->
          <button
            type="button"
            class="ov-icon-btn lock-btn"
            :class="{ active: overlayStore.clickThrough }"
            title="开启/取消鼠标穿透（开启后下方内容点击直达游戏，顶部栏仍可用鼠标点击取消穿透，快捷键 Alt+X / F10）"
            @click="overlayStore.toggleClickThrough()"
          >
            {{ overlayStore.clickThrough ? '取消穿透' : '穿透' }}
          </button>

          <!-- Collapse to Mini Capsule -->
          <button
            type="button"
            class="ov-icon-btn"
            title="折叠为顶部迷你胶囊条 (Alt+M)"
            @click="overlayStore.toggleCollapsed()"
          >
            ▬
          </button>

          <!-- Close Overlay & Restore Main Window -->
          <button
            type="button"
            class="ov-icon-btn close"
            title="关闭悬浮窗并恢复主窗口 (Alt+Q / F9)"
            @click="overlayStore.closeOverlay(true)"
          >
            ✕
          </button>
        </div>
      </header>

      <!-- Click-Through Locked Notice Banner -->
      <div v-if="overlayStore.clickThrough && !overlayStore.fullscreen" class="ov-lock-banner">
        <span>下方区域已开启鼠标穿透 · 顶部栏可直接点击【取消穿透】</span>
        <strong>Alt+X / F10</strong>
      </div>

      <!-- Background Opacity Slider Bar (Collapsible) -->
      <div v-if="showOpacityPanel" class="ov-dropdown-bar no-drag">
        <div class="odb-row">
          <span class="odb-lbl">背景底色浓度（文字始终保持 100% 清晰）</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            :value="overlayStore.opacity"
            class="odb-slider"
            @input="overlayStore.setOpacity(Number($event.target.value))"
          />
          <strong class="ar-num odb-val">{{ Math.round(overlayStore.opacity * 100) }}%</strong>
        </div>
        <div class="odb-presets">
          <button
            v-for="p in [0.15, 0.35, 0.6, 0.85, 1]"
            :key="p"
            type="button"
            class="odb-preset-btn"
            :class="{ active: Math.abs(overlayStore.opacity - p) < 0.03 }"
            @click="overlayStore.setOpacity(p)"
          >
            {{ Math.round(p * 100) }}%
          </button>
        </div>
      </div>

      <!-- Global Hotkeys Cheat Sheet (Collapsible) -->
      <div v-if="showHotkeysTip" class="ov-dropdown-bar hotkeys-bar no-drag">
        <div class="hk-row">
          <span>呼出 / 隐藏悬浮窗</span>
          <div><kbd>Alt + Q</kbd> / <kbd>F9</kbd></div>
        </div>
        <div class="hk-row">
          <span>全屏地图透视对标模式</span>
          <div><kbd>Alt + F</kbd></div>
        </div>
        <div class="hk-row">
          <span>开启 / 取消鼠标穿透标点</span>
          <div><kbd>Alt + X</kbd> / <kbd>F10</kbd></div>
        </div>
        <div class="hk-row">
          <span>折叠 / 展开迷你胶囊条</span>
          <div><kbd>Alt + M</kbd></div>
        </div>
      </div>

      <!-- 4 Core Module Navigation Tabs (Single-line tactical layout, no emoji clutter) -->
      <nav v-if="!overlayStore.fullscreen" class="ov-nav-tabs no-drag" aria-label="悬浮窗功能切换">
        <button
          type="button"
          class="ov-nav-tab"
          :class="{ active: overlayStore.activeTab === 'quests' }"
          @click="overlayStore.activeTab = 'quests'"
        >
          <span>局内任务</span>
          <em class="ar-num">{{ mapTodoCount }}</em>
        </button>

        <button
          type="button"
          class="ov-nav-tab"
          :class="{ active: overlayStore.activeTab === 'map' }"
          @click="overlayStore.activeTab = 'map'"
        >
          <span>地图/词条</span>
        </button>

        <button
          type="button"
          class="ov-nav-tab"
          :class="{ active: overlayStore.activeTab === 'blueprints' }"
          @click="overlayStore.activeTab = 'blueprints'"
        >
          <span>蓝图</span>
          <em class="ar-num">{{ blueprintsStore.validOwnedCount }}/{{ blueprintsStore.allBlueprintsCount }}</em>
        </button>

        <button
          type="button"
          class="ov-nav-tab"
          :class="{
            active: overlayStore.activeTab === 'raider',
            'is-live-audio': overlayStore.raiderSyncRuntime?.running,
          }"
          @click="overlayStore.activeTab = 'raider'"
        >
          <span>奇袭者</span>
          <em v-if="overlayStore.raiderSyncRuntime?.running" class="ar-num live-dot">●</em>
          <em
            v-else-if="overlayStore.raiderSyncRuntime?.moduleMode === 'loadout'"
            class="ar-num"
          >
            {{ loadoutStore.loadoutSummary.totalWeight }}kg
          </em>
          <em v-else-if="raiderStore.totalSpentPoints > 0" class="ar-num">
            {{ raiderStore.totalSpentPoints }}P
          </em>
        </button>

        <button
          type="button"
          class="ov-nav-tab"
          :class="{
            active: overlayStore.activeTab === 'soundboard',
            'is-live-audio': sbState.status.playing,
          }"
          @click="overlayStore.activeTab = 'soundboard'"
        >
          <span>局内放歌</span>
          <em v-if="sbState.status.playing" class="ar-num live-dot">▶</em>
          <em v-else-if="sbState.tracks.length" class="ar-num">{{ sbState.tracks.length }}</em>
        </button>
      </nav>

      <!-- ===============================================================
           TAB 1: 局内任务单 (Raid Quests & Pin Tracker)
           =============================================================== -->
      <section
        v-if="overlayStore.fullscreen && overlayStore.raiderGuideSpec?.active"
        class="ov-tab-body"
      >
        <OverlayRaiderLoadoutGuide
          v-if="overlayStore.raiderGuideSpec.kind === 'loadout'"
        />
        <OverlayRaiderSkillGuide v-else />
      </section>

      <section v-else-if="overlayStore.activeTab === 'quests'" class="ov-tab-body">
        <div class="ov-filter-head">
          <div class="ov-quest-bar">
            <select
              v-model="overlayStore.overlayMapId"
              class="omr-map-select"
              aria-label="当前出击战区"
            >
              <option v-for="m in mapsStore.maps" :key="m.id" :value="m.id">
                {{ m.name }}
              </option>
            </select>

            <div class="ov-scope-pills">
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.questScopeFilter === 'MAP' }"
                @click="overlayStore.questScopeFilter = 'MAP'"
              >
                本图待办 ({{ mapTodoCount }})
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.questScopeFilter === 'PINNED' }"
                @click="overlayStore.questScopeFilter = 'PINNED'"
              >
                置顶 ({{ overlayStore.pinnedQuestIds.length }})
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.questScopeFilter === 'ALL_TODO' }"
                @click="overlayStore.questScopeFilter = 'ALL_TODO'"
              >
                全部待办
              </button>
            </div>
          </div>

          <div class="ov-search-wrap">
            <input
              v-model="overlayStore.questSearch"
              type="text"
              class="ar-input ov-search-input"
              placeholder="搜索任务名称、商人、目标..."
            />
            <button
              v-if="overlayStore.questSearch"
              type="button"
              class="ov-search-clear"
              @click="overlayStore.questSearch = ''"
            >
              ✕
            </button>
          </div>
        </div>

        <div class="ov-scroll-list">
          <article
            v-for="q in overlayStore.overlayQuestsList"
            :key="q.id"
            class="ov-quest-card"
            :class="{
              done: questsStore.isQuestDone(q.id),
              pinned: overlayStore.isQuestPinned(q.id),
              tracked: mapsStore.trackedQuestId === q.id,
            }"
          >
            <div class="oqc-head" @click="toggleQuestExpand(q.id)">
              <button
                type="button"
                class="oqc-check"
                :class="{ checked: questsStore.isQuestDone(q.id) }"
                title="勾选完成状态（与主窗口实时同步）"
                @click.stop="questsStore.toggleQuestDone(q.id)"
              >
                <span v-if="questsStore.isQuestDone(q.id)">✓</span>
              </button>

              <div class="oqc-main">
                <div class="oqc-title-row">
                  <strong class="oqc-title">{{ q.zhTitle }}</strong>
                  <span
                    v-if="q.taskTypeLabel"
                    class="oqc-type-badge"
                    :style="{ '--tc': q.taskTypeColor || '#26bf57' }"
                  >
                    {{ q.taskTypeLabel }}
                  </span>
                </div>

                <div class="oqc-meta-row">
                  <span class="oqc-trader">
                    <i :style="{ background: traderMeta[q.trader]?.color || '#94a3b8' }"></i>
                    {{ traderMeta[q.trader]?.name || q.trader }}
                  </span>
                  <span class="oqc-loc">{{ q.zhLocation }}</span>
                </div>
              </div>

              <div class="oqc-actions" @click.stop>
                <button
                  type="button"
                  class="oqc-icon-btn"
                  :class="{ active: overlayStore.isQuestPinned(q.id) }"
                  title="星标置顶此任务"
                  @click="overlayStore.togglePinQuest(q.id)"
                >
                  ★
                </button>
                <button
                  type="button"
                  class="oqc-locate-btn"
                  :class="{ active: mapsStore.trackedQuestId === q.id }"
                  title="在悬浮窗 2D 战术地图中标点追踪"
                  @click="locateQuestOnOverlayMap(q)"
                >
                  ⌖ 标点
                </button>
              </div>
            </div>

            <!-- Required Items to Bring / Submit -->
            <div v-if="parseQuestRequiredItems(q).length" class="oqc-reqs">
              <div
                v-for="(it, idx) in parseQuestRequiredItems(q)"
                :key="idx"
                class="oqc-req-chip"
              >
                <img :src="it.icon" alt="" />
                <span>{{ it.count ? `${it.count} ` : '' }}{{ it.zhName }}</span>
              </div>
            </div>

            <!-- Expanded Objective Description & Spatial Steps -->
            <div v-if="isQuestExpanded(q.id) || overlayStore.isQuestPinned(q.id)" class="oqc-detail">
              <p v-if="q.zhDescription" class="oqc-desc">{{ q.zhDescription }}</p>
              <div
                v-if="q.mapTargets?.[overlayStore.overlayMapId]?.landmarks?.length"
                class="oqc-steps"
              >
                <div
                  v-for="lm in q.mapTargets[overlayStore.overlayMapId].landmarks"
                  :key="lm.id"
                  class="oqc-step-row"
                  @click="locateQuestOnOverlayMap(q)"
                >
                  <b class="osr-num">{{ lm.step }}</b>
                  <span>{{ lm.title }} ({{ lm.areaName }})</span>
                </div>
              </div>
            </div>
          </article>

          <div v-if="!overlayStore.overlayQuestsList.length" class="ov-empty">
            <p>
              {{
                overlayStore.questScopeFilter === 'PINNED'
                  ? '尚未置顶任何任务，点击任务右侧 ★ 即可置顶'
                  : '当前筛选下没有待办任务'
              }}
            </p>
          </div>
        </div>
      </section>

      <!-- ===============================================================
           TAB 3: 地图 / 词条 (2D Tactical Radar & Live Schedule)
           =============================================================== -->
      <section v-else-if="overlayStore.activeTab === 'map'" class="ov-tab-body">
        <div v-if="!overlayStore.fullscreen" class="ov-map-mode-bar">
          <div class="ar-tabs ov-seg">
            <button
              type="button"
              class="ar-tab"
              :class="{ active: overlayStore.mapSubMode === 'radar' }"
              @click="overlayStore.mapSubMode = 'radar'"
            >
              地图
            </button>
            <button
              type="button"
              class="ar-tab"
              :class="{ active: overlayStore.mapSubMode === 'schedule' }"
              @click="overlayStore.mapSubMode = 'schedule'"
            >
              <RotationCountdownText prefix="全地图事件轮换 (" suffix=")" />
            </button>
          </div>
        </div>

        <!-- Sub-Mode A: 2D Tactical Radar Map -->
        <OverlayMiniRadarMap v-if="overlayStore.mapSubMode === 'radar' || overlayStore.fullscreen" />

        <!-- Sub-Mode B: 7 Maps Live Condition Schedule -->
        <div v-else class="ov-schedule-wrap">
          <div class="osw-server-bar">
            <span class="osw-lbl">服务器分区：</span>
            <div class="ov-scope-pills">
              <button
                v-for="srv in mapsStore.servers"
                :key="srv.id"
                type="button"
                class="ov-pill"
                :class="{ active: mapsStore.selectedServerId === srv.id }"
                @click="mapsStore.selectedServerId = srv.id"
              >
                {{ srv.name }}
              </button>
            </div>
            <button
              type="button"
              class="ov-icon-btn"
              title="同步官方最新轮换时间表"
              @click="mapsStore.refreshOfficialSchedule(true)"
            >
              ↻
            </button>
          </div>

          <div class="ov-scroll-list">
            <article
              v-for="m in mapsStore.maps"
              :key="m.id"
              class="ov-sched-card"
              :class="{ active: overlayStore.overlayMapId === m.id }"
              @click="selectMapFromSchedule(m.id)"
            >
              <div class="osc-head">
                <div>
                  <strong class="osc-map-name">{{ m.name }}</strong>
                  <small class="osc-map-en">{{ m.enName }}</small>
                </div>
                <span class="osc-todo-badge">
                  {{ mapsStore.getTodoQuestsForMap(m.id).length }} 待办任务 →
                </span>
              </div>

              <!-- Current Slot & Next Hour Forecast -->
              <div class="osc-slots">
                <div
                  v-for="(slot, sIdx) in mapsStore.getUpcomingSchedule(m.id, 3)"
                  :key="sIdx"
                  class="osc-slot-row"
                  :class="{ current: sIdx === 0 }"
                >
                  <span class="osr-time ar-num">
                    {{ sIdx === 0 ? '当前' : `+${sIdx}h` }} ({{ slot.rangeText }})
                  </span>
                  <div class="osr-events">
                    <span class="osr-ev primary">
                      <img
                        v-if="slot.primaryEvent.gameIcon"
                        :src="assetUrl(slot.primaryEvent.gameIcon)"
                        alt=""
                      />
                      {{ slot.primaryEvent.name }}
                    </span>
                    <span v-if="slot.secondaryEvent" class="osr-ev secondary">
                      + {{ slot.secondaryEvent.name }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Hazard / Rule Modifiers -->
              <div
                v-if="
                  activeStatesByMap[m.id]?.hatchesDisabled ||
                  activeStatesByMap[m.id]?.reducedExtractions
                "
                class="osc-hazards"
              >
                <span v-if="activeStatesByMap[m.id]?.hatchesDisabled" class="hz-chip">
                  奇袭者暗门关闭
                </span>
                <span
                  v-if="activeStatesByMap[m.id]?.reducedExtractions"
                  class="hz-chip"
                >
                  常规撤离点削减
                </span>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- ===============================================================
           TAB 4: 蓝图查重 (Blueprints Quick Check)
           =============================================================== -->
      <section v-else-if="overlayStore.activeTab === 'blueprints'" class="ov-tab-body">
        <div class="ov-filter-head">
          <div class="ov-search-wrap">
            <input
              v-model="overlayStore.bpSearch"
              type="text"
              class="ar-input ov-search-input"
              placeholder="搜蓝图名称、工作台、合成材料..."
            />
            <button
              v-if="overlayStore.bpSearch"
              type="button"
              class="ov-search-clear"
              @click="overlayStore.bpSearch = ''"
            >
              ✕
            </button>
          </div>

          <div class="ov-bp-filters">
            <div class="ov-scope-pills">
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpSubFilter === 'ALL' }"
                @click="overlayStore.bpSubFilter = 'ALL'"
              >
                全部
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpSubFilter === 'weapon_item' }"
                @click="overlayStore.bpSubFilter = 'weapon_item'"
              >
                武器/道具
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpSubFilter === 'furniture' }"
                @click="overlayStore.bpSubFilter = 'furniture'"
              >
                家具
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpSubFilter === 'stencil' }"
                @click="overlayStore.bpSubFilter = 'stencil'"
              >
                涂装
              </button>
            </div>

            <div class="ov-scope-pills">
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpStatusFilter === 'ALL' }"
                @click="overlayStore.bpStatusFilter = 'ALL'"
              >
                全状态
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpStatusFilter === 'MISSING' }"
                @click="overlayStore.bpStatusFilter = 'MISSING'"
              >
                未掌握
              </button>
              <button
                type="button"
                class="ov-pill"
                :class="{ active: overlayStore.bpStatusFilter === 'OWNED' }"
                @click="overlayStore.bpStatusFilter = 'OWNED'"
              >
                已掌握
              </button>
            </div>
          </div>
        </div>

        <div class="ov-scroll-list">
          <article
            v-for="bp in overlayStore.filteredOverlayBlueprints"
            :key="bp.id"
            class="ov-bp-row"
            :class="[`r-${bp.rarity}`, { owned: blueprintsStore.isBlueprintOwned(bp.id) }]"
          >
            <div class="obr-thumb">
              <img :src="resolveBpThumb(bp)" :alt="bp.name" loading="lazy" />
            </div>

            <div class="obr-info">
              <div class="obr-top">
                <strong>{{ cleanBpTitle(bp) }}</strong>
                <span class="obr-pool-tag">{{ bp.poolLabel }}</span>
              </div>
              <div class="obr-sub">
                <span>{{ bp.station }}</span>
                <span v-if="bp.materials" class="obr-mat">· {{ bp.materials }}</span>
              </div>
            </div>

            <button
              type="button"
              class="obr-own-btn"
              :class="{ active: blueprintsStore.isBlueprintOwned(bp.id) }"
              @click="blueprintsStore.toggleBlueprintOwned(bp.id)"
            >
              {{ blueprintsStore.isBlueprintOwned(bp.id) ? '✓ 已掌握' : '+ 标记掌握' }}
            </button>
          </article>

          <div v-if="!overlayStore.filteredOverlayBlueprints.length" class="ov-empty">
            <p>未找到匹配的蓝图</p>
          </div>
        </div>
      </section>

      <!-- ===============================================================
           TAB 5: 局内放歌与语音混音 (In-Match Soundboard & Voice Mixer)
           =============================================================== -->
      <section v-else-if="overlayStore.activeTab === 'soundboard'" class="ov-tab-body">
        <OverlaySoundboardPanel />
      </section>
    </template>

    <!-- ===============================================================
         TAB 4: 奇袭者（二级导航：天赋树 | 战备）
         (使用 v-show 保活：自动加点/配装收起为顶部 48px 胶囊条时任务不中断)
         =============================================================== -->
    <div
      v-if="hasMountedRaider"
      v-show="
        !overlayStore.collapsed &&
        !overlayStore.fullscreen &&
        overlayStore.activeTab === 'raider'
      "
      class="ov-tab-body ov-raider-host"
    >
      <nav class="ov-raider-subnav no-drag" aria-label="奇袭者子模块切换">
        <button
          type="button"
          class="orsn-tab"
          :class="{ active: overlayStore.raiderSyncRuntime.moduleMode !== 'loadout' }"
          :disabled="overlayStore.raiderSyncRuntime.running"
          @click="overlayStore.raiderSyncRuntime.moduleMode = 'skills'"
        >
          <span>天赋树</span>
          <em class="ar-num">{{ raiderStore.totalSpentPoints }}/{{ raiderStore.maxSkillPoints }}P</em>
        </button>
        <button
          type="button"
          class="orsn-tab"
          :class="{ active: overlayStore.raiderSyncRuntime.moduleMode === 'loadout' }"
          :disabled="overlayStore.raiderSyncRuntime.running"
          @click="overlayStore.raiderSyncRuntime.moduleMode = 'loadout'"
        >
          <span>战备</span>
          <em class="ar-num">{{ loadoutStore.loadoutSummary.totalWeight }}/{{ loadoutStore.loadoutSummary.maxWeight }}kg</em>
        </button>
      </nav>

      <OverlayRaiderSyncPanel
        v-show="overlayStore.raiderSyncRuntime.moduleMode !== 'loadout'"
        class="ov-raider-pane"
      />
      <OverlayRaiderLoadoutPanel
        v-show="overlayStore.raiderSyncRuntime.moduleMode === 'loadout'"
        class="ov-raider-pane"
      />
    </div>

    <!-- Global Background Audio Mini Bar (Shown when audio channel is connected on other tabs) -->
    <footer
      v-if="
        !overlayStore.collapsed &&
        sbState.status.mode &&
        overlayStore.activeTab !== 'soundboard' &&
        !overlayStore.fullscreen
      "
      class="ov-sb-mini-dock no-drag"
    >
      <div
        class="osmd-left"
        title="点击切换到局内放歌面板"
        @click="overlayStore.activeTab = 'soundboard'"
      >
        <span class="osmd-dot" :class="{ playing: sbState.status.playing }"></span>
        <span class="osmd-mode">
          {{ sbState.status.mode === 2 ? '游戏发送' : '试听' }}
        </span>
        <strong class="osmd-track">
          {{ sbCurrentTrack?.name || '音效台待命' }}
        </strong>
      </div>

      <div class="osmd-actions">
        <button
          v-if="sbCurrentTrack"
          type="button"
          class="osmd-btn"
          @click="sbAction('toggle').catch(() => {})"
        >
          {{ sbState.status.playing ? '暂停' : '播放' }}
        </button>
        <button
          v-if="sbState.status.playing"
          type="button"
          class="osmd-btn"
          @click="sbAction('stop').catch(() => {})"
        >
          停止
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* =====================================================================
   ROOT CONTAINER: Background-Only Opacity (--ov-alpha)
   Foreground text, icons, and badges stay 100% crisp & opaque!
   ===================================================================== */
.overlay-root {
  --ov-alpha: 0.94;
  --ov-bg-main: rgba(9, 12, 25, var(--ov-alpha));
  --ov-bg-bar: rgba(7, 10, 20, calc(0.32 + var(--ov-alpha) * 0.68));
  --ov-bg-card: rgba(16, 22, 38, calc(0.18 + var(--ov-alpha) * 0.78));
  --ov-bg-chip: rgba(20, 27, 46, calc(0.24 + var(--ov-alpha) * 0.72));
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--ov-bg-main);
  color: var(--tx-1);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.88);
  border: 1px solid rgba(206, 193, 176, 0.32);
  overflow: hidden;
  user-select: none;
}

.overlay-root.is-click-through {
  border-color: rgba(255, 188, 19, 0.75);
}

.overlay-root.has-left-drawer {
  width: calc(100vw - 286px);
  margin-left: 286px;
  overflow: visible;
}

.overlay-root.has-left-drawer > .ov-tab-body {
  overflow: visible;
}

.overlay-root.is-fullscreen {
  background: transparent;
  border: none;
  overflow: visible;
}

.overlay-root.is-fullscreen > .ar-stripe,
.overlay-root.is-fullscreen > .ov-titlebar,
.overlay-root.is-fullscreen > .ov-dropdown-bar {
  position: relative;
  z-index: 20;
  width: min(480px, 95vw);
  margin-left: auto;
  margin-right: 10px;
  border-left: 1px solid rgba(206, 193, 176, 0.32);
  border-right: 1px solid rgba(206, 193, 176, 0.32);
}

.overlay-root.is-fullscreen > .ar-stripe {
  margin-top: 6px;
  border-radius: 5px 5px 0 0;
}

.overlay-root.is-fullscreen > .ov-titlebar {
  background: rgba(7, 10, 20, 0.94);
}

.overlay-root.is-fullscreen > .ov-tab-body {
  padding: 0;
  gap: 0;
  overflow: visible;
}

/* =====================================================================
   MODE 1: 48px Top Mini Capsule Bar
   ===================================================================== */
.ov-mini-capsule {
  height: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: var(--ov-bg-bar);
  cursor: move;
}

.omc-drag-grip {
  color: var(--tx-2);
  font-size: 13px;
  letter-spacing: -1px;
  flex-shrink: 0;
}

.omc-timer {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.18);
  border: 1px solid rgba(255, 188, 19, 0.45);
  font-size: 12px;
  color: var(--amber);
  flex-shrink: 0;
}

.omc-srv {
  font-size: 10px;
  font-weight: 800;
}

.omc-map-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--cream);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.omc-cond-sep {
  opacity: 0.6;
}

.omc-cond-name {
  color: var(--amber);
}

.omc-quest-pill {
  flex: 1;
  min-width: 0;
  height: 26px;
  padding: 0 8px;
  border-radius: 3px;
  border: 1px solid rgba(38, 191, 87, 0.45);
  background: rgba(16, 56, 32, calc(0.28 + var(--ov-alpha) * 0.62));
  color: var(--tx-1);
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
}

.omc-q-tag {
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(38, 191, 87, 0.28);
  color: #86efac;
  font-size: 10px;
  flex-shrink: 0;
}

.omc-q-txt {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.omc-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.omc-raider-sync {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(95, 255, 255, 0.55);
  background: rgba(8, 22, 34, 0.88);
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
}

.omc-rs-tag {
  position: relative;
  z-index: 1;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(95, 255, 255, 0.2);
  color: #5fffff;
  font-size: 10.5px;
  font-weight: 800;
  flex-shrink: 0;
}

.omc-rs-msg {
  position: relative;
  z-index: 1;
  font-size: 11px;
  font-weight: 700;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.omc-rs-bar {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2.5px;
  background: linear-gradient(90deg, #5fffff, #ffd205);
  transition: width 0.2s ease;
}

.omc-stop-btn {
  border-color: #f87171 !important;
  background: #dc2626 !important;
  color: #fff !important;
  font-weight: 800;
  padding: 0 9px;
}

/* =====================================================================
   MODE 2: Full Overlay Titlebar & Controls
   ===================================================================== */
.ov-titlebar {
  flex-shrink: 0;
  height: 38px;
  padding: 0 10px;
  background: var(--ov-bg-bar);
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: move;
}

.ovt-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-shrink: 0;
}

.ovt-grip {
  color: var(--tx-3);
  font-size: 12px;
  letter-spacing: -1px;
}

.ovt-brand {
  font-family: var(--font-title);
  font-size: 12.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--cream);
  white-space: nowrap;
}

.ovt-timer-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.16);
  border: 1px solid rgba(255, 188, 19, 0.38);
  font-size: 11px;
  font-weight: 700;
  color: var(--amber);
  white-space: nowrap;
}

.ovt-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ov-icon-btn {
  height: 24px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--tx-1);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  transition: all 0.14s;
}

.ov-icon-btn:hover {
  border-color: var(--cream);
  color: var(--cream);
}

.ov-icon-btn.active {
  background: rgba(255, 188, 19, 0.25);
  border-color: var(--amber);
  color: var(--amber);
}

.ov-icon-btn.lock-btn.active {
  background: var(--amber);
  border-color: var(--amber);
  color: #090c19;
  text-shadow: none;
  box-shadow: 0 0 10px rgba(255, 188, 19, 0.55);
}

.ov-icon-btn.close:hover {
  background: var(--st-danger);
  border-color: var(--st-danger);
  color: #fff;
}

.ov-lock-banner {
  flex-shrink: 0;
  padding: 4px 10px;
  background: rgba(255, 188, 19, 0.24);
  border-bottom: 1px solid var(--amber);
  color: var(--cream);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ov-lock-banner strong {
  color: var(--amber);
  font-family: var(--font-mono);
  white-space: nowrap;
}

/* Dropdown Bars (Opacity & Hotkeys) */
.ov-dropdown-bar {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(11, 15, 28, 0.94);
  border-bottom: 1px solid var(--line-strong);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.odb-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.odb-lbl {
  font-size: 11px;
  color: var(--tx-2);
  white-space: nowrap;
}

.odb-slider {
  flex: 1;
  accent-color: var(--amber);
  cursor: pointer;
}

.odb-val {
  font-size: 12px;
  color: var(--amber);
  min-width: 34px;
  text-align: right;
}

.odb-presets {
  display: flex;
  gap: 5px;
}

.odb-preset-btn {
  flex: 1;
  height: 22px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: var(--ov-bg-chip);
  color: var(--tx-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.odb-preset-btn.active {
  border-color: var(--amber);
  color: var(--amber);
}

.hotkeys-bar .hk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11.5px;
  color: var(--tx-1);
}

.hotkeys-bar kbd {
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-3);
  border: 1px solid var(--line-strong);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--amber);
}

/* 5-Tab Bar (Strictly single-line, no wrap) */
.ov-nav-tabs {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  background: var(--ov-bg-bar);
  border-bottom: 1px solid var(--line-strong);
}

.ov-nav-tab {
  position: relative;
  height: 36px;
  padding: 0 2px;
  border: none;
  background: transparent;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}

.ov-nav-tab:hover {
  color: var(--cream);
  background: rgba(249, 238, 223, 0.05);
}

.ov-nav-tab.active {
  color: var(--cream);
  background: rgba(249, 238, 223, 0.08);
}

.ov-nav-tab.active::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 0;
  height: 2.5px;
  background: var(--amber);
}

.ov-nav-tab em {
  font-style: normal;
  font-size: 10px;
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.16);
  color: var(--amber);
  line-height: 15px;
}

.ov-nav-tab em.live-dot {
  background: rgba(74, 222, 128, 0.22);
  color: #4ade80;
}

.ov-sb-mini-dock {
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  background: var(--ov-bg-bar);
  border-top: 1px solid var(--line-strong);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.osmd-left {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.osmd-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  flex-shrink: 0;
}

.osmd-dot.playing {
  background: #4ade80;
  box-shadow: 0 0 6px rgba(74, 222, 128, 0.8);
}

.osmd-mode {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.16);
  color: var(--amber);
  flex-shrink: 0;
}

.osmd-track {
  font-size: 11px;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osmd-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.osmd-btn {
  height: 20px;
  padding: 0 6px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--tx-1);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
}

.osmd-btn:hover {
  border-color: var(--amber);
  color: var(--amber);
}

/* Tab Content Container */
.ov-tab-body {
  flex: 1;
  min-height: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}

.ov-filter-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ov-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.ov-search-input {
  width: 100%;
  height: 30px;
  padding-right: 28px;
  font-size: 12px;
  background: var(--ov-bg-chip) !important;
  color: var(--tx-1) !important;
}

.ov-search-clear {
  position: absolute;
  right: 6px;
  border: none;
  background: transparent;
  color: var(--tx-2);
  cursor: pointer;
  font-size: 12px;
}

.ov-scope-pills {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.ov-pill {
  height: 24px;
  padding: 0 8px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.14s;
}

.ov-pill:hover {
  color: var(--cream);
  border-color: var(--cream);
}

.ov-pill.active {
  background: var(--cream);
  border-color: var(--cream);
  color: var(--ink);
  text-shadow: none;
}

.ov-pill.safe.active {
  background: #34d399;
  border-color: #34d399;
  color: #042f2e;
  text-shadow: none;
}

.ov-scroll-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-right: 2px;
}

/* =====================================================================
   TAB 1: Raid Quests Cards
   ===================================================================== */
.ov-quest-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.omr-map-select {
  height: 26px;
  padding: 0 8px;
  background: var(--ov-bg-chip);
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  outline: none;
  cursor: pointer;
}

.omr-map-select option {
  background: #0d1222;
  color: var(--cream);
}

.ov-quest-card {
  padding: 7px 9px;
  background: var(--ov-bg-card);
  border: 1px solid var(--line);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ov-quest-card.pinned {
  border-color: rgba(255, 188, 19, 0.55);
  box-shadow: inset 3px 0 0 var(--amber);
}

.ov-quest-card.tracked {
  border-color: rgba(38, 191, 87, 0.72);
}

.ov-quest-card.done {
  opacity: 0.62;
}

.oqc-head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.oqc-check {
  margin-top: 2px;
  width: 17px;
  height: 17px;
  border-radius: 3px;
  border: 1.5px solid var(--line-strong);
  background: rgba(9, 12, 25, 0.8);
  color: #061109;
  font-size: 11px;
  font-weight: 900;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  text-shadow: none;
}

.oqc-check.checked {
  background: var(--c-quests);
  border-color: var(--c-quests);
}

.oqc-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.oqc-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.oqc-title {
  font-size: 13px;
  color: var(--cream);
}

.oqc-type-badge {
  padding: 0 5px;
  border-radius: 2px;
  background: color-mix(in srgb, var(--tc) 24%, rgba(9, 12, 25, 0.75));
  color: var(--tc);
  font-size: 10px;
  font-weight: 700;
}

.oqc-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--tx-2);
}

.oqc-trader {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tx-1);
}

.oqc-trader i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.oqc-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.oqc-icon-btn {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--tx-2);
  font-size: 12px;
  cursor: pointer;
}

.oqc-icon-btn.active {
  color: var(--amber);
  border-color: var(--amber);
}

.oqc-locate-btn {
  height: 24px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid rgba(38, 191, 87, 0.5);
  background: rgba(16, 65, 35, 0.55);
  color: #4ade80;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.oqc-locate-btn.active {
  background: #26bf57;
  color: #051b0c;
  text-shadow: none;
}

.oqc-reqs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 25px;
}

.oqc-req-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.72);
  border: 1px solid var(--line);
  font-size: 11px;
  color: var(--cream);
}

.oqc-req-chip img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.oqc-detail {
  padding-left: 25px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.oqc-desc {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.42;
  color: var(--tx-1);
}

.oqc-steps {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.oqc-step-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #86efac;
  cursor: pointer;
}

.osr-num {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: rgba(38, 191, 87, 0.32);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}

/* =====================================================================
   TAB 3: Live Schedule Cards
   ===================================================================== */
.ov-map-mode-bar {
  flex-shrink: 0;
}

.ov-seg {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.ov-seg .ar-tab {
  justify-content: center;
  height: 26px;
  font-size: 11.5px;
}

.ov-schedule-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.osw-server-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.osw-lbl {
  font-size: 11.5px;
  color: var(--tx-2);
}

.ov-sched-card {
  padding: 8px 10px;
  background: var(--ov-bg-card);
  border: 1px solid var(--line);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.14s;
}

.ov-sched-card:hover,
.ov-sched-card.active {
  border-color: var(--amber);
}

.osc-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.osc-map-name {
  font-size: 13.5px;
  color: var(--cream);
}

.osc-map-en {
  margin-left: 6px;
  font-size: 11px;
  color: var(--tx-2);
}

.osc-todo-badge {
  font-size: 11px;
  color: var(--amber);
  font-weight: 700;
}

.osc-slots {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.osc-slot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--tx-2);
}

.osc-slot-row.current {
  color: var(--tx-1);
  font-weight: 700;
}

.osr-events {
  display: flex;
  align-items: center;
  gap: 5px;
}

.osr-ev {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.osr-ev img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.osc-slot-row.current .osr-ev.primary {
  color: var(--amber);
}

.osc-hazards {
  display: flex;
  gap: 6px;
}

.hz-chip {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(255, 48, 38, 0.22);
  color: #ff8078;
}

/* =====================================================================
   TAB 4: Blueprints Compact Rows
   ===================================================================== */
.ov-bp-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  flex-wrap: wrap;
}

.ov-bp-row {
  --rc: var(--r-common);
  padding: 6px 8px;
  background: var(--ov-bg-card);
  border: 1px solid var(--line);
  border-left: 3px solid var(--rc);
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.ov-bp-row.r-uncommon {
  --rc: var(--r-uncommon);
}
.ov-bp-row.r-rare {
  --rc: var(--r-rare);
}
.ov-bp-row.r-epic {
  --rc: var(--r-epic);
}
.ov-bp-row.r-legendary {
  --rc: var(--r-legendary);
}

.ov-bp-row.owned {
  background: rgba(255, 188, 19, 0.1);
}

.obr-thumb {
  width: 34px;
  height: 34px;
  border-radius: 4px;
  background: rgba(9, 12, 25, 0.72);
  padding: 3px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.obr-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.obr-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.obr-top {
  display: flex;
  align-items: center;
  gap: 6px;
}

.obr-top strong {
  font-size: 12.5px;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obr-pool-tag {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  color: var(--tx-2);
  flex-shrink: 0;
}

.obr-sub {
  font-size: 11px;
  color: var(--tx-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.obr-own-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--tx-1);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.obr-own-btn.active {
  background: var(--amber);
  border-color: var(--amber);
  color: #090c19;
  text-shadow: none;
}

.ov-empty {
  padding: 28px 12px;
  text-align: center;
  color: var(--tx-2);
  font-size: 12.5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.ov-raider-host {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ov-raider-subnav {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 5px 10px;
  background: rgba(9, 12, 25, 0.72);
  border-bottom: 1px solid var(--line);
}

.orsn-tab {
  height: 28px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: rgba(18, 23, 38, 0.7);
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}

.orsn-tab em {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--tx-3);
}

.orsn-tab.active {
  border-color: rgba(95, 255, 255, 0.52);
  background: rgba(95, 255, 255, 0.14);
  color: var(--cream);
}

.orsn-tab.active em {
  color: var(--c-raider);
}

.orsn-tab:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ov-raider-pane {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
