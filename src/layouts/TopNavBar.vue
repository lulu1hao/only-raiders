<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppUpdater } from '../composables/useAppUpdater'
import { useGlidingNavIndicator } from '../composables/useGlidingNavIndicator'
import { invokeTauri, isTauriRuntime, useOverlayWindowStore } from '../stores/useOverlayWindowStore'
import OverlaySettingsPanel from '../views/overlay/components/OverlaySettingsPanel.vue'

const {
  state: updaterState,
  hasVisibleUpdate,
  openUpdateModal,
} = useAppUpdater()

const route = useRoute()
const router = useRouter()
const overlayStore = useOverlayWindowStore()

const isDesktop = isTauriRuntime()
const isMaximized = ref(false)
const showOverlaySettings = ref(false)
const overlayGroupRef = ref(null)

async function syncMaximizedState() {
  if (!isDesktop) return
  const res = await invokeTauri('main_window_is_maximized')
  if (typeof res === 'boolean') {
    isMaximized.value = res
  }
}

async function handleToggleMaximize() {
  if (!isDesktop) return
  const next = await invokeTauri('main_window_toggle_maximize')
  if (typeof next === 'boolean') {
    isMaximized.value = next
  }
}

function onTopbarMouseDown(e) {
  if (!isDesktop || e.button !== 0) return
  if (
    e.target.closest(
      'button, a, input, select, textarea, .brand, .nav-tab, .no-drag, .tnb-overlay-popover',
    )
  ) {
    return
  }
  if (!isMaximized.value && e.clientY < 4) return
  if (e.detail >= 2) {
    e.preventDefault()
    void handleToggleMaximize()
    return
  }
  void invokeTauri('main_window_start_drag')
}

function onDocPointerDown(e) {
  if (!showOverlaySettings.value) return
  if (overlayGroupRef.value && !overlayGroupRef.value.contains(e.target)) {
    showOverlaySettings.value = false
  }
}

function onDocKeyDown(e) {
  if (e.key === 'Escape' && showOverlaySettings.value) {
    showOverlaySettings.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    showOverlaySettings.value = false
  },
)

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeyDown)
  if (isDesktop) {
    void syncMaximizedState()
    window.__ARC_ON_MAIN_MAXIMIZED__ = (val) => {
      isMaximized.value = Boolean(val)
    }
    window.addEventListener('resize', syncMaximizedState)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeyDown)
  if (isDesktop) {
    if (window.__ARC_ON_MAIN_MAXIMIZED__) {
      delete window.__ARC_ON_MAIN_MAXIMIZED__
    }
    window.removeEventListener('resize', syncMaximizedState)
  }
})

const navItems = [
  { id: 'home', label: '总览', path: '/home', rgb: [255, 188, 19] },
  { id: 'weapons', label: '武器', path: '/weapons/workbench', rgb: [253, 75, 16] },
  { id: 'quests', label: '任务资源', path: '/quests/archive', rgb: [255, 210, 5] },
  { id: 'maps', label: '地图', path: '/maps', rgb: [31, 255, 118] },
  { id: 'raider', label: '奇袭者', path: '/raider', rgb: [95, 255, 255] },
]

const activeModule = computed(() => route.meta?.module || 'home')

const {
  navRef,
  setTabRef,
  onTabPointerEnter,
  onNavPointerLeave,
  railStyle,
  glowStyle,
  hoverPillStyle,
} = useGlidingNavIndicator({
  activeId: activeModule,
  items: navItems,
  insetLeft: 16,
  insetRight: 16,
  pillInset: 5,
})
</script>

<template>
  <header
    class="topbar"
    :class="{ 'is-desktop': isDesktop }"
    @mousedown="onTopbarMouseDown"
  >
    <div class="brand" @click="router.push('/home')" title="返回首页">
      <svg
        class="brand-mark"
        width="43"
        height="22"
        viewBox="0 0 62 32"
        fill="none"
        aria-hidden="true"
      >
        <mask id="nav-ar-mask" width="62" height="32" x="0" y="0" maskUnits="userSpaceOnUse">
          <path fill="#fff" d="M.157.013h61.126V31.19H.157z" />
        </mask>
        <g mask="url(#nav-ar-mask)">
          <path stroke="#D00000" stroke-width="1.254" d="M-2.43-72.381L59.248 43.619" />
          <path stroke="#C82451" stroke-width="1.254" d="M3.659-75.619L65.337 40.381" />
          <path stroke="#FF5600" stroke-width="1.254" d="M-13.79-72.381L47.888 43.619" />
          <path stroke="#E6A34C" stroke-width="1.254" d="M-7.701-75.619L53.977 40.381" />
          <path stroke="#00A900" stroke-width="1.254" d="M-25.152-72.381L36.526 43.619" />
          <path stroke="#57BB7C" stroke-width="1.254" d="M-19.063-75.619L42.615 40.381" />
          <path
            stroke="#75B8DD"
            stroke-width="1.254"
            d="M-28.499-72L.915-16.681C12.394 4.908 17.905 27.476 18.336 49.547"
          />
          <path
            stroke="#0093ED"
            stroke-width="1.254"
            d="M-36.308-72L-5.173-13.443C3.681 3.209 9.069 20.95 11.014 38.906"
          />
          <path stroke="#FF0000" stroke-width="6.896" d="M.614-74L62.292 42" />
          <path stroke="#FFEA00" stroke-width="6.896" d="M-10.746-74L50.933 42" />
          <path stroke="#05FF74" stroke-width="6.896" d="M-22.108-74L39.571 42" />
          <path
            stroke="#5FFFFF"
            stroke-width="6.896"
            d="M-32.403-72L-2.129-15.062C9.35 6.527 14.861 29.095 15.292 51.166"
          />
        </g>
      </svg>
    </div>

    <nav
      ref="navRef"
      class="nav"
      :style="{ '--nav-accent-rgb': railStyle['--nav-accent-rgb'] }"
      @pointerleave="onNavPointerLeave"
    >
      <span class="nav-hover-pill" :style="hoverPillStyle" aria-hidden="true" />
      <span class="nav-active-glow" :style="glowStyle" aria-hidden="true" />
      <button
        v-for="n in navItems"
        :key="n.id"
        :ref="(el) => setTabRef(n.id, el)"
        type="button"
        class="nav-tab"
        :class="{ active: activeModule === n.id }"
        @pointerenter="onTabPointerEnter(n.id)"
        @focus="onTabPointerEnter(n.id)"
        @blur="onNavPointerLeave"
        @click="router.push(n.path)"
      >
        <span class="nav-tab-label">{{ n.label }}</span>
      </button>
      <span class="nav-active-rail" :style="railStyle" aria-hidden="true" />
    </nav>

    <div class="topbar-right">
      <button
        v-if="overlayStore.overlayVisible && overlayStore.clickThrough"
        type="button"
        class="tnb-unlock-btn"
        title="解除悬浮窗的鼠标穿透锁定 (Alt+X / F10)"
        @click="overlayStore.setClickThrough(false)"
      >
        解除穿透 (Alt+X)
      </button>

      <div ref="overlayGroupRef" class="tnb-overlay-group">
        <button
          type="button"
          class="tnb-icon-btn tnb-overlay-btn"
          :class="{ active: overlayStore.overlayVisible }"
          :title="
            overlayStore.overlayVisible
              ? '关闭悬浮窗 (Alt+Q / F9)'
              : '开启悬浮窗模式 (Alt+Q / F9)'
          "
          :aria-label="overlayStore.overlayVisible ? '关闭悬浮窗' : '开启悬浮窗模式'"
          @click="overlayStore.toggleOverlay()"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              d="M5.2 10H2.8A1.3 1.3 0 0 1 1.5 8.7V3.8A1.3 1.3 0 0 1 2.8 2.5h6.9A1.3 1.3 0 0 1 11 3.8v1.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.45"
              stroke-linecap="round"
              opacity="0.65"
            />
            <rect
              x="5.2"
              y="5.2"
              width="9.3"
              height="8.3"
              rx="1.3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </button>

        <button
          type="button"
          class="tnb-icon-btn tnb-overlay-cfg-btn"
          :class="{ active: showOverlaySettings }"
          title="悬浮窗设置（自定义导航栏顺序与显示）"
          aria-label="悬浮窗设置"
          @click="showOverlaySettings = !showOverlaySettings"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path
              fill="currentColor"
              d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"
            />
          </svg>
        </button>

        <div v-if="showOverlaySettings" class="tnb-overlay-popover">
          <OverlaySettingsPanel context="main" @close="showOverlaySettings = false" />
        </div>
      </div>

      <button
        type="button"
        class="tnb-update-btn"
        :class="{
          'has-update': hasVisibleUpdate,
          'is-busy': updaterState.checking || updaterState.downloading,
        }"
        :title="
          hasVisibleUpdate
            ? `发现新版本 v${updaterState.release?.latestVersion}，点击查看更新`
            : `当前版本 v${updaterState.currentVersion}，点击检查更新`
        "
        @click="openUpdateModal"
      >
        <span class="tnb-update-ver">v{{ updaterState.currentVersion }}</span>
        <span v-if="hasVisibleUpdate" class="tnb-update-dot" />
        <span v-if="updaterState.downloading" class="tnb-update-pct">
          {{ updaterState.progress.percent }}%
        </span>
      </button>

      <div v-if="isDesktop" class="tnb-win-controls no-drag">
        <button
          type="button"
          class="tnb-win-btn"
          title="最小化"
          aria-label="最小化"
          @click="invokeTauri('main_window_minimize')"
        >
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d="M1 5h8" stroke="currentColor" stroke-width="1.15" />
          </svg>
        </button>
        <button
          type="button"
          class="tnb-win-btn"
          :title="isMaximized ? '向下还原' : '最大化'"
          :aria-label="isMaximized ? '向下还原' : '最大化'"
          @click="handleToggleMaximize"
        >
          <svg v-if="!isMaximized" viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <rect
              x="1.5"
              y="1.5"
              width="7"
              height="7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.15"
            />
          </svg>
          <svg v-else viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path
              d="M3 2.5V1.5h5.5V7H7.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
            />
            <rect
              x="1.5"
              y="3"
              width="5.5"
              height="5.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
            />
          </svg>
        </button>
        <button
          type="button"
          class="tnb-win-btn is-close"
          title="关闭"
          aria-label="关闭"
          @click="invokeTauri('main_window_close')"
        >
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path
              d="M1.5 1.5l7 7M8.5 1.5l-7 7"
              stroke="currentColor"
              stroke-width="1.15"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  z-index: 200;
  display: grid;
  grid-template-columns: minmax(64px, 1fr) auto minmax(max-content, 1fr);
  align-items: center;
  height: var(--topbar-h);
  flex: 0 0 var(--topbar-h);
  padding: 0 18px;
  background: var(--plum);
  border-bottom: 1px solid var(--line);
}

.topbar.is-desktop {
  padding-right: 0;
  user-select: none;
}

.brand {
  display: flex;
  align-items: center;
  cursor: pointer;
  justify-self: start;
}

.brand-mark {
  display: block;
  flex-shrink: 0;
}

.nav {
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 2px;
  height: 100%;
}

.nav-hover-pill {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 0;
  border-radius: 6px;
  background: linear-gradient(
    180deg,
    rgba(249, 238, 223, 0.08) 0%,
    rgba(249, 238, 223, 0.035) 100%
  );
  border: 1px solid rgba(249, 238, 223, 0.11);
  pointer-events: none;
  z-index: 0;
  will-change: transform, width, opacity;
}

.nav-active-glow {
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 0;
  border-radius: 6px;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(var(--nav-accent-rgb, 255, 188, 19), 0.08) 0%,
    rgba(var(--nav-accent-rgb, 255, 188, 19), 0.16) 100%
  );
  border: 1px solid rgba(var(--nav-accent-rgb, 255, 188, 19), 0.26);
  will-change: transform, width, opacity;
}

.nav-active-rail {
  position: absolute;
  left: 0;
  bottom: 6px;
  height: 2px;
  border-radius: 999px;
  pointer-events: none;
  z-index: 2;
  background: rgb(var(--nav-accent-rgb, 255, 188, 19));
  box-shadow: 0 0 7px rgba(var(--nav-accent-rgb, 255, 188, 19), 0.55);
  will-change: transform, width, opacity;
}

.nav-tab {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  background: none;
  border: none;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.07em;
  cursor: pointer;
  transition: color 0.22s var(--ease);
}

.nav-tab-label {
  display: inline-block;
  transition:
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    text-shadow 0.26s ease;
}

.nav-tab:hover {
  color: var(--cream);
}

.nav-tab:hover .nav-tab-label,
.nav-tab.active .nav-tab-label {
  transform: translateY(-0.5px);
}

.nav-tab.active {
  color: var(--cream);
}

.nav-tab.active .nav-tab-label {
  text-shadow: 0 0 14px rgba(var(--nav-accent-rgb, 255, 188, 19), 0.26);
}

@media (prefers-reduced-motion: reduce) {
  .nav-tab,
  .nav-tab-label {
    transition: none;
  }
}

.topbar-right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tnb-overlay-group {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tnb-icon-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 6px;
  border: 1px solid rgba(249, 238, 223, 0.12);
  background: rgba(249, 238, 223, 0.04);
  color: var(--tx-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    border-color 0.16s var(--ease),
    background 0.16s var(--ease),
    color 0.16s var(--ease);
}

.tnb-icon-btn:hover {
  border-color: rgba(255, 188, 19, 0.48);
  background: rgba(255, 188, 19, 0.1);
  color: var(--cream);
}

.tnb-icon-btn.active {
  border-color: rgba(255, 188, 19, 0.7);
  background: rgba(255, 188, 19, 0.18);
  color: var(--amber);
}

.tnb-overlay-popover {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 380px;
  background: rgba(11, 15, 28, 0.98);
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  z-index: 300;
}

.tnb-unlock-btn {
  height: 28px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid var(--amber);
  background: rgba(255, 188, 19, 0.16);
  color: var(--amber);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.tnb-update-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid rgba(249, 238, 223, 0.12);
  background: rgba(249, 238, 223, 0.04);
  color: var(--tx-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 0.16s var(--ease),
    background 0.16s var(--ease),
    color 0.16s var(--ease);
}

.tnb-update-btn:hover {
  border-color: rgba(255, 188, 19, 0.48);
  background: rgba(255, 188, 19, 0.1);
  color: var(--cream);
}

.tnb-update-btn.has-update {
  border-color: rgba(255, 188, 19, 0.7);
  background: rgba(255, 188, 19, 0.18);
  color: var(--amber);
}

.tnb-update-ver {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.tnb-update-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ui-highlight, #fd4b10);
  box-shadow: 0 0 8px rgba(253, 75, 16, 0.9);
}

.tnb-update-pct {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  color: var(--amber);
}

.tnb-win-controls {
  display: inline-flex;
  align-items: stretch;
  height: var(--topbar-h);
  margin-left: 4px;
  padding-left: 4px;
  position: relative;
}

.tnb-win-controls::before {
  content: '';
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 1px;
  background: var(--line);
}

.tnb-win-btn {
  width: 44px;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--tx-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.14s var(--ease), color 0.14s var(--ease);
}

.tnb-win-btn:hover {
  background: rgba(249, 238, 223, 0.08);
  color: var(--cream);
}

.tnb-win-btn.is-close:hover {
  background: #e81123;
  color: #ffffff;
}

@media (max-width: 1180px) {
  .topbar {
    padding-left: 12px;
  }

  .nav-tab {
    padding: 0 12px;
  }

  .topbar-right {
    gap: 5px;
  }
}
</style>
