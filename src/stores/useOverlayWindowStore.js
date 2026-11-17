import { computed, nextTick, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import { flushPersistedStorage } from './index'

export function isTauriRuntime() {
  return Boolean(
    typeof window !== 'undefined' &&
      (typeof window.__TAURI_INTERNALS__?.invoke === 'function' ||
        typeof window.__TAURI__?.core?.invoke === 'function'),
  )
}

export function isOverlayWindowContext() {
  if (typeof window === 'undefined') return false
  if (window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label === 'overlay') return true
  if (window.location.search.includes('window=overlay')) return true
  if (window.location.pathname.startsWith('/overlay')) return true
  return false
}

export async function invokeTauri(cmd, args = {}) {
  if (typeof window === 'undefined') return null
  const fn = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke
  if (typeof fn !== 'function') return null
  try {
    return await fn(cmd, args)
  } catch (err) {
    console.warn(`[Overlay Tauri IPC] ${cmd} failed:`, err)
    return null
  }
}

const STORE_ID_BY_STORAGE_KEY = {
  arc_quests_store_v2: 'quests',
  arc_workshop_store_v3: 'workshop',
  arc_outpost_store_v3: 'outpost',
  arc_blueprints_store_v3: 'blueprints',
  arc_maps_store_v2: 'maps',
}

export const OVERLAY_NAV_ITEMS = [
  { id: 'quests', label: '局内任务', desc: '当前地图待办与追踪目标' },
  { id: 'map', label: '地图/词条', desc: '2D 战术雷达与整点词条轮换' },
  { id: 'blueprints', label: '蓝图', desc: '局内拾取蓝图快速查重' },
  { id: 'raider', label: '奇袭者', desc: '天赋树/战备识别与自动同步' },
  { id: 'soundboard', label: '局内放歌', desc: '语音混音与局内音效台' },
]

const VALID_NAV_IDS = new Set(OVERLAY_NAV_ITEMS.map((it) => it.id))
const NAV_META_BY_ID = Object.fromEntries(OVERLAY_NAV_ITEMS.map((it) => [it.id, it]))

export function createDefaultNavTabsConfig() {
  return OVERLAY_NAV_ITEMS.map((it) => ({ id: it.id, visible: true }))
}

export function normalizeNavTabsConfig(raw) {
  const seen = new Set()
  const result = []
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const id = typeof entry === 'string' ? entry : entry?.id
      if (!id || !VALID_NAV_IDS.has(id) || seen.has(id)) continue
      seen.add(id)
      const visible =
        typeof entry === 'object' && entry !== null ? entry.visible !== false : true
      result.push({ id, visible })
    }
  }
  for (const item of OVERLAY_NAV_ITEMS) {
    if (!seen.has(item.id)) {
      seen.add(item.id)
      result.push({ id: item.id, visible: true })
    }
  }
  if (!result.some((it) => it.visible)) {
    if (result[0]) result[0].visible = true
  }
  return result
}

export const useOverlayWindowStore = defineStore(
  'overlayWindow',
  () => {
    // Active tab inside the overlay window: 'quests' | 'map' | 'blueprints' | 'raider' | 'soundboard'
    const activeTab = ref('quests')
    // Persisted navigation bar order & visibility preferences
    const navTabsConfig = ref(createDefaultNavTabsConfig())
    const hideSingleNavBar = ref(false)
    // Map tab sub-mode: 'radar' (2D tactical map) | 'schedule' (7-map live conditions rotation)
    const mapSubMode = ref('radar')
    // Active map inside overlay (defaults to dam-battlegrounds)
    const overlayMapId = ref('dam-battlegrounds')

    // Window state (synced with Tauri Rust backend)
    const overlayVisible = ref(false)
    const collapsed = ref(false)
    const fullscreen = ref(false)
    const clickThrough = ref(false)
    const alwaysOnTop = ref(true)
    const opacity = ref(0.94)
    const mapOpacity = ref(0.55)
    const autoMinimizeMain = ref(true)
    const leftDrawerOpen = ref(false)

    // Persisted user tracking preferences for Overlay
    const pinnedQuestIds = ref([])
    const stashedItemCounts = ref({})
    // Persisted per-map fullscreen alignment (zoom, panX, panY)
    const savedMapAlignments = ref({})
    // Persisted Raider skill tree perspective guide payload
    const raiderGuideSpec = ref(null)
    // Cross-window intent to jump straight to Raider tab inside Overlay
    const raiderOverlayIntent = ref(null)
    // In-window runtime state for Raider Auto-Sync (survives collapse/expand transitions)
    const raiderSyncRuntime = ref({
      moduleMode: 'skills', // 'skills' | 'loadout'
      running: false,
      text: '',
      progressPct: 0,
      banner: null,
      sourceKey: 'current',
      loadoutSourceKey: 'current',
      subTab: 'sync',
    })

    // Navigation bar customization helpers
    const orderedNavTabs = computed(() =>
      normalizeNavTabsConfig(navTabsConfig.value).map((entry) => ({
        ...NAV_META_BY_ID[entry.id],
        visible: entry.visible,
      })),
    )

    const visibleNavTabs = computed(() => orderedNavTabs.value.filter((t) => t.visible))

    const isDefaultNavConfig = computed(() => {
      if (hideSingleNavBar.value) return false
      const normalized = normalizeNavTabsConfig(navTabsConfig.value)
      return normalized.every(
        (entry, idx) => entry.id === OVERLAY_NAV_ITEMS[idx]?.id && entry.visible === true,
      )
    })

    function persistOverlayPrefsNow() {
      const piniaInst = getActivePinia()
      piniaInst?._s?.get('overlayWindow')?.$persist?.()
      flushPersistedStorage('arc_overlay_store_v1')
      void nextTick(() => {
        piniaInst?._s?.get('overlayWindow')?.$persist?.()
        flushPersistedStorage('arc_overlay_store_v1')
      })
    }

    function isTabVisible(tabId) {
      return visibleNavTabs.value.some((t) => t.id === tabId)
    }

    function getNavTabLabel(tabId) {
      return NAV_META_BY_ID[tabId]?.label || tabId
    }

    function switchToFirstVisibleTab() {
      activeTab.value = visibleNavTabs.value[0]?.id || 'quests'
    }

    function setNavTabVisible(tabId, visible) {
      const normalized = normalizeNavTabsConfig(navTabsConfig.value)
      const target = normalized.find((it) => it.id === tabId)
      if (!target) return false
      const nextVisible = Boolean(visible)
      if (!nextVisible) {
        const visibleCount = normalized.filter((it) => it.visible).length
        if (visibleCount <= 1 && target.visible) {
          return false
        }
      }
      const next = normalized.map((it) =>
        it.id === tabId ? { ...it, visible: nextVisible } : it,
      )
      navTabsConfig.value = normalizeNavTabsConfig(next)
      if (!nextVisible && (activeTab.value === tabId || !isTabVisible(activeTab.value))) {
        switchToFirstVisibleTab()
      }
      persistOverlayPrefsNow()
      return true
    }

    function moveNavTab(fromIndex, toIndex) {
      const list = normalizeNavTabsConfig(navTabsConfig.value).map((it) => ({ ...it }))
      if (
        fromIndex < 0 ||
        fromIndex >= list.length ||
        toIndex < 0 ||
        toIndex >= list.length ||
        fromIndex === toIndex
      ) {
        return
      }
      const [moved] = list.splice(fromIndex, 1)
      list.splice(toIndex, 0, moved)
      navTabsConfig.value = list
      persistOverlayPrefsNow()
    }

    function setHideSingleNavBar(val) {
      hideSingleNavBar.value = Boolean(val)
      persistOverlayPrefsNow()
    }

    function resetNavTabsConfig() {
      navTabsConfig.value = createDefaultNavTabsConfig()
      hideSingleNavBar.value = false
      persistOverlayPrefsNow()
    }

    // O(1) Set lookup for pinned quests
    const pinnedQuestIdSet = computed(() => new Set(pinnedQuestIds.value))

    function isQuestPinned(questId) {
      return pinnedQuestIdSet.value.has(questId)
    }

    function togglePinQuest(questId) {
      const idx = pinnedQuestIds.value.indexOf(questId)
      if (idx >= 0) pinnedQuestIds.value.splice(idx, 1)
      else pinnedQuestIds.value.push(questId)
    }

    function getStashedCount(enKey) {
      return Number(stashedItemCounts.value[enKey]) || 0
    }

    function setStashedCount(enKey, nextVal) {
      const clamped = Math.max(0, Math.round(Number(nextVal) || 0))
      if (clamped <= 0) {
        const copy = { ...stashedItemCounts.value }
        delete copy[enKey]
        stashedItemCounts.value = copy
      } else {
        stashedItemCounts.value = {
          ...stashedItemCounts.value,
          [enKey]: clamped,
        }
      }
    }

    function adjustStashedCount(enKey, delta) {
      setStashedCount(enKey, getStashedCount(enKey) + delta)
    }

    function applyDto(dto) {
      if (!dto) return
      const prevFs = fullscreen.value
      overlayVisible.value = Boolean(dto.visible)
      collapsed.value = Boolean(dto.collapsed)
      if (typeof dto.fullscreen === 'boolean') {
        fullscreen.value = dto.fullscreen
        if (dto.fullscreen && !prevFs && !raiderGuideSpec.value?.active) {
          activeTab.value = 'map'
          mapSubMode.value = 'radar'
        }
        if (!dto.fullscreen && prevFs) {
          if (raiderGuideSpec.value?.active) {
            raiderGuideSpec.value = null
            activeTab.value = 'raider'
          } else if (!isTabVisible(activeTab.value)) {
            switchToFirstVisibleTab()
          }
        }
      }
      if (!dto.visible && raiderGuideSpec.value?.active) {
        raiderGuideSpec.value = null
      }
      clickThrough.value = Boolean(dto.clickThrough)
      alwaysOnTop.value = Boolean(dto.alwaysOnTop)
      if (typeof dto.opacity === 'number') {
        opacity.value = dto.opacity
      }
      if (typeof dto.autoMinimizeMain === 'boolean') {
        autoMinimizeMain.value = dto.autoMinimizeMain
      }
      if (typeof dto.leftDrawerOpen === 'boolean') {
        leftDrawerOpen.value = dto.leftDrawerOpen
      }
    }

    let browserPopupRef = null

    async function openOverlay() {
      if (!overlayVisible.value && !raiderGuideSpec.value?.active && !isTabVisible(activeTab.value)) {
        switchToFirstVisibleTab()
      }
      if (isTauriRuntime()) {
        const dto = await invokeTauri('open_overlay_window', {
          minimizeMain: autoMinimizeMain.value,
          opacity: opacity.value,
        })
        applyDto(dto)
      } else {
        overlayVisible.value = true
        browserPopupRef = window.open(
          '/?window=overlay',
          'arc_tactical_overlay',
          'width=420,height=660,menubar=no,toolbar=no,location=no,status=no',
        )
      }
    }

    async function closeOverlay(restoreMain = true) {
      if (isTauriRuntime()) {
        const dto = await invokeTauri('close_overlay_window', { restoreMain })
        applyDto(dto)
      } else {
        overlayVisible.value = false
        if (isOverlayWindowContext()) {
          window.close()
        } else if (browserPopupRef && !browserPopupRef.closed) {
          browserPopupRef.close()
          browserPopupRef = null
        }
      }
    }

    async function toggleOverlay() {
      if (isTauriRuntime()) {
        const dto = await invokeTauri('toggle_overlay_window', {
          minimizeMain: autoMinimizeMain.value,
        })
        applyDto(dto)
      } else {
        if (overlayVisible.value) await closeOverlay(true)
        else await openOverlay()
      }
    }

    async function setCollapsed(val) {
      const next = Boolean(val)
      collapsed.value = next
      if (next) fullscreen.value = false
      if (isTauriRuntime()) {
        const dto = await invokeTauri('set_overlay_collapsed', { collapsed: next })
        applyDto(dto)
      }
    }

    async function toggleCollapsed() {
      await setCollapsed(!collapsed.value)
    }

    async function openOverlayAtRaider(subTab = 'sync', moduleMode = 'skills') {
      const normalizedMode = moduleMode === 'loadout' ? 'loadout' : 'skills'
      const intent = {
        subTab: subTab === 'recognize' ? 'recognize' : 'sync',
        moduleMode: normalizedMode,
        ts: Date.now(),
      }
      raiderOverlayIntent.value = intent
      raiderSyncRuntime.value.subTab = intent.subTab
      raiderSyncRuntime.value.moduleMode = normalizedMode
      activeTab.value = 'raider'
      raiderGuideSpec.value = null
      const piniaInst = getActivePinia()
      piniaInst?._s?.get('raiderSkills')?.flushPersistence?.()
      piniaInst?._s?.get('raiderLoadout')?.flushPersistence?.()
      piniaInst?._s?.get('overlayWindow')?.$persist?.()
      flushPersistedStorage('arc_overlay_store_v1')
      if (isTauriRuntime()) {
        await invokeTauri('open_overlay_window', {
          minimizeMain: autoMinimizeMain.value,
          opacity: opacity.value,
        })
        await invokeTauri('set_overlay_click_through', { clickThrough: false })
        await invokeTauri('set_overlay_fullscreen', { fullscreen: false })
        const dto = await invokeTauri('set_overlay_collapsed', { collapsed: false })
        applyDto(dto)
      } else {
        await openOverlay()
        fullscreen.value = false
        collapsed.value = false
      }
    }

    async function setFullscreen(val) {
      const next = Boolean(val)
      const wasGuide = Boolean(raiderGuideSpec.value?.active)
      fullscreen.value = next
      if (next) {
        collapsed.value = false
        if (!wasGuide) {
          activeTab.value = 'map'
          mapSubMode.value = 'radar'
        }
      } else if (wasGuide) {
        raiderGuideSpec.value = null
        activeTab.value = 'raider'
        clickThrough.value = false
      } else if (!isTabVisible(activeTab.value)) {
        switchToFirstVisibleTab()
      }
      if (isTauriRuntime()) {
        if (!next && wasGuide) {
          await invokeTauri('set_overlay_click_through', { clickThrough: false })
        }
        const dto = await invokeTauri('set_overlay_fullscreen', { fullscreen: next })
        applyDto(dto)
      }
    }

    async function launchRaiderPerspectiveGuide(spec) {
      const origin = spec?.origin === 'main' ? 'main' : 'overlay'
      const guideKind = spec?.kind === 'loadout' ? 'loadout' : 'skills'
      activeTab.value = 'raider'
      raiderSyncRuntime.value.subTab = 'sync'
      raiderSyncRuntime.value.moduleMode = guideKind
      raiderGuideSpec.value = {
        active: true,
        kind: guideKind,
        origin,
        title: spec?.title || (guideKind === 'loadout' ? '当前战备' : '当前配装'),
        targetBuild: spec?.targetBuild || { allocations: {}, gateSelections: {} },
        inGameBuild: spec?.inGameBuild || null,
        targetLoadout: spec?.targetLoadout || null,
        inGameLoadout: spec?.inGameLoadout || null,
        syncOptions: spec?.syncOptions || null,
        ts: Date.now(),
      }
      const piniaInst = getActivePinia()
      piniaInst?._s?.get('raiderSkills')?.flushPersistence?.()
      piniaInst?._s?.get('raiderLoadout')?.flushPersistence?.()
      piniaInst?._s?.get('overlayWindow')?.$persist?.()
      flushPersistedStorage('arc_overlay_store_v1')
      if (isTauriRuntime()) {
        await invokeTauri('open_overlay_window', {
          minimizeMain: origin === 'main' ? true : autoMinimizeMain.value,
          opacity: opacity.value,
        })
        await invokeTauri('set_overlay_collapsed', { collapsed: false })
        await invokeTauri('set_overlay_fullscreen', { fullscreen: true })
        const dto = await invokeTauri('set_overlay_click_through', { clickThrough: true })
        applyDto(dto)
      } else {
        await openOverlay()
        fullscreen.value = true
      }
    }

    async function exitRaiderPerspectiveGuide(mode = 'back') {
      const prevOrigin = raiderGuideSpec.value?.origin || 'overlay'
      const prevKind = raiderGuideSpec.value?.kind === 'loadout' ? 'loadout' : 'skills'
      raiderGuideSpec.value = null
      activeTab.value = 'raider'
      raiderSyncRuntime.value.subTab = 'sync'
      raiderSyncRuntime.value.moduleMode = prevKind
      clickThrough.value = false
      const piniaInst = getActivePinia()
      piniaInst?._s?.get('raiderSkills')?.flushPersistence?.()
      piniaInst?._s?.get('raiderLoadout')?.flushPersistence?.()
      piniaInst?._s?.get('overlayWindow')?.$persist?.()
      flushPersistedStorage('arc_overlay_store_v1')

      if (mode === 'close') {
        const restoreMain = prevOrigin === 'main' || autoMinimizeMain.value
        if (isTauriRuntime()) {
          await invokeTauri('set_overlay_click_through', { clickThrough: false })
          await invokeTauri('set_overlay_fullscreen', { fullscreen: false })
          const dto = await invokeTauri('close_overlay_window', { restoreMain })
          applyDto(dto)
        } else {
          fullscreen.value = false
          overlayVisible.value = false
        }
        return
      }

      // Default ('back'): exit fullscreen & click-through and return to compact Raider overlay window
      if (isTauriRuntime()) {
        await invokeTauri('set_overlay_click_through', { clickThrough: false })
        const dto = await invokeTauri('set_overlay_fullscreen', { fullscreen: false })
        applyDto(dto)
      } else {
        fullscreen.value = false
      }
    }

    async function toggleFullscreen() {
      await setFullscreen(!fullscreen.value)
    }

    async function setLeftDrawerOpen(val) {
      const next = Boolean(val) && !fullscreen.value && !collapsed.value
      leftDrawerOpen.value = next
      if (isTauriRuntime()) {
        const dto = await invokeTauri('set_overlay_left_drawer', { open: next })
        applyDto(dto)
      }
    }

    function setMapOpacity(val) {
      const num = Number(val)
      const clamped = Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0.55
      mapOpacity.value = +clamped.toFixed(2)
    }

    function saveMapAlignment(mapId, zoomVal, panX, panY) {
      if (!mapId) return
      savedMapAlignments.value = {
        ...savedMapAlignments.value,
        [mapId]: {
          zoom: +Number(zoomVal || 1).toFixed(3),
          x: Math.round(Number(panX) || 0),
          y: Math.round(Number(panY) || 0),
        },
      }
    }

    function getMapAlignment(mapId) {
      return savedMapAlignments.value?.[mapId] || null
    }

    function clearMapAlignment(mapId) {
      if (!mapId || !savedMapAlignments.value?.[mapId]) return
      const copy = { ...savedMapAlignments.value }
      delete copy[mapId]
      savedMapAlignments.value = copy
    }

    async function setClickThrough(val) {
      const next = Boolean(val)
      clickThrough.value = next
      if (isTauriRuntime()) {
        const dto = await invokeTauri('set_overlay_click_through', { clickThrough: next })
        applyDto(dto)
      }
    }

    async function toggleClickThrough() {
      await setClickThrough(!clickThrough.value)
    }

    async function toggleAlwaysOnTop() {
      const next = !alwaysOnTop.value
      alwaysOnTop.value = next
      if (isTauriRuntime()) {
        const dto = await invokeTauri('set_overlay_always_on_top', { alwaysOnTop: next })
        applyDto(dto)
      }
    }

    let opacityIpcPending = false
    let queuedOpacityVal = null

    async function setOpacity(val) {
      const clamped = Math.max(0.1, Math.min(1, Number(val) ?? 0.88))
      opacity.value = clamped
      persistOverlayPrefsNow()
      if (isTauriRuntime()) {
        queuedOpacityVal = clamped
        if (opacityIpcPending) return
        opacityIpcPending = true
        try {
          while (queuedOpacityVal !== null) {
            const sendVal = queuedOpacityVal
            queuedOpacityVal = null
            const dto = await invokeTauri('set_overlay_opacity', { opacity: sendVal })
            if (queuedOpacityVal === null && dto) {
              applyDto(dto)
            }
          }
        } finally {
          opacityIpcPending = false
        }
      }
    }

    async function setAutoMinimizeMain(val) {
      const next = Boolean(val)
      autoMinimizeMain.value = next
      persistOverlayPrefsNow()
      if (isTauriRuntime()) {
        const dto = await invokeTauri('set_overlay_auto_minimize', { autoMinimize: next })
        applyDto(dto)
      }
    }

    async function startDrag() {
      if (isTauriRuntime()) {
        await invokeTauri('start_overlay_drag')
      }
    }

    async function openInMainWindow(path, hideOverlay = false) {
      if (isTauriRuntime()) {
        await invokeTauri('navigate_main_window', { path, hideOverlay })
      } else if (window.opener && !window.opener.closed) {
        window.opener.location.href = path
        window.opener.focus()
      }
    }

    let syncInitialized = false
    async function initCrossWindowSync(router) {
      if (syncInitialized || typeof window === 'undefined') return
      syncInitialized = true
      const pinia = getActivePinia()
      navTabsConfig.value = normalizeNavTabsConfig(navTabsConfig.value)

      window.addEventListener('storage', (e) => {
        if (!e.key || !e.newValue || e.newValue === e.oldValue) return
        try {
          const parsed = JSON.parse(e.newValue)
          if (e.key === 'arc_overlay_store_v1') {
            if (Array.isArray(parsed.navTabsConfig)) {
              const normalized = normalizeNavTabsConfig(parsed.navTabsConfig)
              if (JSON.stringify(navTabsConfig.value) !== JSON.stringify(normalized)) {
                navTabsConfig.value = normalized
                if (
                  !fullscreen.value &&
                  !raiderGuideSpec.value?.active &&
                  !isTabVisible(activeTab.value)
                ) {
                  switchToFirstVisibleTab()
                }
              }
            }
            if (
              typeof parsed.hideSingleNavBar === 'boolean' &&
              hideSingleNavBar.value !== parsed.hideSingleNavBar
            ) {
              hideSingleNavBar.value = parsed.hideSingleNavBar
            }
            if (
              !isTauriRuntime() &&
              typeof parsed.opacity === 'number' &&
              opacity.value !== parsed.opacity
            ) {
              opacity.value = parsed.opacity
            }
            if (
              !isTauriRuntime() &&
              typeof parsed.autoMinimizeMain === 'boolean' &&
              autoMinimizeMain.value !== parsed.autoMinimizeMain
            ) {
              autoMinimizeMain.value = parsed.autoMinimizeMain
            }
            if (
              Array.isArray(parsed.pinnedQuestIds) &&
              JSON.stringify(pinnedQuestIds.value) !== JSON.stringify(parsed.pinnedQuestIds)
            ) {
              pinnedQuestIds.value = parsed.pinnedQuestIds
            }
            if (
              parsed.stashedItemCounts &&
              JSON.stringify(stashedItemCounts.value) !== JSON.stringify(parsed.stashedItemCounts)
            ) {
              stashedItemCounts.value = parsed.stashedItemCounts
            }
            if (
              parsed.savedMapAlignments &&
              JSON.stringify(savedMapAlignments.value) !== JSON.stringify(parsed.savedMapAlignments)
            ) {
              savedMapAlignments.value = parsed.savedMapAlignments
            }
            if (
              JSON.stringify(raiderGuideSpec.value) !== JSON.stringify(parsed.raiderGuideSpec ?? null)
            ) {
              raiderGuideSpec.value = parsed.raiderGuideSpec ?? null
            }
            if (
              parsed.raiderOverlayIntent &&
              parsed.raiderOverlayIntent.ts !== raiderOverlayIntent.value?.ts
            ) {
              raiderOverlayIntent.value = parsed.raiderOverlayIntent
              if (parsed.raiderOverlayIntent.subTab) {
                raiderSyncRuntime.value.subTab = parsed.raiderOverlayIntent.subTab
              }
              if (parsed.raiderOverlayIntent.moduleMode) {
                raiderSyncRuntime.value.moduleMode = parsed.raiderOverlayIntent.moduleMode
              }
              activeTab.value = 'raider'
            }
            return
          }
          const storeId = STORE_ID_BY_STORAGE_KEY[e.key]
          const targetStore = storeId ? pinia?._s?.get(storeId) : null
          if (targetStore && parsed && typeof parsed === 'object') {
            const diff = {}
            let hasDiff = false
            for (const [k, v] of Object.entries(parsed)) {
              if (JSON.stringify(targetStore.$state[k]) !== JSON.stringify(v)) {
                diff[k] = v
                hasDiff = true
              }
            }
            if (hasDiff) {
              targetStore.$patch(diff)
            }
          }
        } catch {
          // Ignore malformed JSON
        }
      })

      window.__ARC_ON_OVERLAY_STATE__ = (dto) => {
        applyDto(dto)
      }
      window.__ARC_ON_MAIN_NAV__ = (path) => {
        if (!isOverlayWindowContext() && path && router) {
          router.push(String(path))
        }
      }

      if (
        isOverlayWindowContext() &&
        raiderOverlayIntent.value?.ts &&
        Date.now() - raiderOverlayIntent.value.ts < 8000
      ) {
        activeTab.value = 'raider'
        if (raiderOverlayIntent.value.subTab) {
          raiderSyncRuntime.value.subTab = raiderOverlayIntent.value.subTab
        }
        if (raiderOverlayIntent.value.moduleMode) {
          raiderSyncRuntime.value.moduleMode = raiderOverlayIntent.value.moduleMode
        }
      } else if (
        !fullscreen.value &&
        !raiderGuideSpec.value?.active &&
        !isTabVisible(activeTab.value)
      ) {
        switchToFirstVisibleTab()
      }

      if (isTauriRuntime()) {
        const initial = await invokeTauri('get_overlay_state')
        if (initial) {
          overlayVisible.value = Boolean(initial.visible)
          collapsed.value = Boolean(initial.collapsed)
          fullscreen.value = Boolean(initial.fullscreen)
          clickThrough.value = Boolean(initial.clickThrough)
          alwaysOnTop.value = Boolean(initial.alwaysOnTop)
        }
        await invokeTauri('set_overlay_opacity', { opacity: opacity.value })
        await invokeTauri('set_overlay_auto_minimize', { autoMinimize: autoMinimizeMain.value })
      }
    }

    return {
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
  },
  {
    persist: {
      key: 'arc_overlay_store_v1',
      pick: [
        'navTabsConfig',
        'hideSingleNavBar',
        'opacity',
        'mapOpacity',
        'autoMinimizeMain',
        'pinnedQuestIds',
        'stashedItemCounts',
        'savedMapAlignments',
        'raiderGuideSpec',
        'raiderOverlayIntent',
      ],
    },
  },
)
