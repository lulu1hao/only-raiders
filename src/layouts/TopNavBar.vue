<script setup>
import { useAppUpdater } from '../composables/useAppUpdater'

const {
  state: updaterState,
  hasVisibleUpdate,
  openUpdateModal,
} = useAppUpdater()
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOverlayWindowStore } from '../stores/useOverlayWindowStore'

const route = useRoute()
const router = useRouter()
const overlayStore = useOverlayWindowStore()

const navItems = [
  { id: 'home', label: '总览', path: '/home' },
  { id: 'weapons', label: '武器', path: '/weapons/workbench' },
  { id: 'quests', label: '任务资源', path: '/quests/archive' },
  { id: 'maps', label: '地图', path: '/maps' },
  { id: 'raider', label: '奇袭者', path: '/raider' },
]

const activeModule = computed(() => route.meta?.module || 'home')
</script>

<template>
  <header class="topbar">
    <div class="brand" @click="router.push('/home')" title="返回首页">
      <svg
        class="brand-mark"
        width="54"
        height="28"
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

    <nav class="nav">
      <button
        v-for="n in navItems"
        :key="n.id"
        class="nav-tab"
        :class="{ active: activeModule === n.id }"
        @click="router.push(n.path)"
      >
        {{ n.label }}
      </button>
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

      <label
        class="tnb-min-toggle"
        title="开启独立悬浮窗时，自动最小化主窗口（关闭悬浮窗时自动恢复）"
      >
        <input
          type="checkbox"
          :checked="overlayStore.autoMinimizeMain"
          @change="overlayStore.setAutoMinimizeMain($event.target.checked)"
        />
        <span>自动最小化主窗</span>
      </label>

      <button
        type="button"
        class="tnb-overlay-btn"
        :class="{ active: overlayStore.overlayVisible }"
        title="开启/关闭独立桌面置顶悬浮窗 (全局快捷键: Alt+Q 或 F9)"
        @click="overlayStore.toggleOverlay()"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect
            x="1.5"
            y="2.5"
            width="9.5"
            height="7.5"
            rx="1.2"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            opacity="0.55"
          />
          <rect
            x="5.5"
            y="5.5"
            width="9"
            height="8"
            rx="1.2"
            fill="var(--plum)"
            stroke="currentColor"
            stroke-width="1.6"
          />
        </svg>
        <span>{{ overlayStore.overlayVisible ? '关闭悬浮窗' : '悬浮窗模式' }}</span>
        <kbd class="tnb-kbd">Alt+Q</kbd>
      </button>

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
        <span class="tnb-update-text">
          {{
            updaterState.downloading
              ? `${updaterState.progress.percent}%`
              : hasVisibleUpdate
                ? '有更新'
                : '更新'
          }}
        </span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  z-index: 50;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: var(--topbar-h);
  flex: 0 0 var(--topbar-h);
  padding: 0 24px;
  background: var(--plum);
  border-bottom: 1px solid var(--line);
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
  display: flex;
  gap: 4px;
  height: 100%;
}

.nav-tab {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 20px;
  background: none;
  border: none;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 0.15s var(--ease);
}
.nav-tab:hover {
  color: var(--cream);
}
.nav-tab.active {
  color: var(--cream);
}
.nav-tab::after {
  content: '';
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: 0;
  height: 3px;
  background: var(--amber);
  transform: scaleX(0);
  transition: transform 0.2s var(--ease-out);
}
.nav-tab.active::after {
  transform: scaleX(1);
}

.topbar-right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 12px;
}

.tnb-min-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 600;
  color: var(--tx-3);
  cursor: pointer;
  user-select: none;
}

.tnb-min-toggle:hover {
  color: var(--tx-2);
}

.tnb-min-toggle input {
  accent-color: var(--amber);
  cursor: pointer;
}

.tnb-unlock-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--amber);
  background: rgba(255, 188, 19, 0.16);
  color: var(--amber);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.tnb-overlay-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.16s var(--ease);
}

.tnb-overlay-btn:hover {
  border-color: var(--amber);
  background: rgba(255, 188, 19, 0.12);
}

.tnb-overlay-btn.active {
  border-color: var(--amber);
  background: var(--amber);
  color: var(--ink);
}

.tnb-kbd {
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.16);
  font-family: var(--font-mono);
  font-size: 10.5px;
  color: var(--amber);
}

.tnb-overlay-btn.active .tnb-kbd {
  background: rgba(9, 12, 25, 0.85);
  color: var(--cream);
}
.tnb-update-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #d7d2c6;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.tnb-update-btn:hover {
  border-color: rgba(255, 188, 19, 0.52);
  background: rgba(255, 188, 19, 0.1);
  color: #fff6df;
}

.tnb-update-btn.has-update {
  border-color: rgba(255, 188, 19, 0.7);
  background: rgba(255, 188, 19, 0.16);
  color: var(--ui-complementary, #ffbc13);
}

.tnb-update-ver {
  opacity: 0.78;
  font-variant-numeric: tabular-nums;
}

.tnb-update-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ui-highlight, #fd4b10);
  box-shadow: 0 0 8px rgba(253, 75, 16, 0.9);
}

.tnb-update-text {
  font-weight: 700;
}
</style>
