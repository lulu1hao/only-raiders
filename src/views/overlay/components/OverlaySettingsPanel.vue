<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'

const props = defineProps({
  context: {
    type: String,
    default: 'overlay',
  },
})

const emit = defineEmits(['close'])

const overlayStore = useOverlayWindowStore()
const showHotkeys = ref(props.context === 'main')

const rootRef = ref(null)
const listRef = ref(null)
const draggingIdx = ref(-1)
const targetIdx = ref(-1)
const draggingId = ref(null)
const dragDeltaY = ref(0)

let startClientY = 0
let startScrollTop = 0
let rowStep = 44
let itemCount = 5
let minDeltaY = 0
let maxDeltaY = 0

function onPointerMove(ev) {
  if (draggingIdx.value < 0) return
  const scrollDelta = (rootRef.value?.scrollTop || 0) - startScrollTop
  const rawDelta = ev.clientY - startClientY + scrollDelta
  const clampedDelta = Math.max(minDeltaY, Math.min(maxDeltaY, rawDelta))
  dragDeltaY.value = clampedDelta

  const offsetSlots = Math.round(clampedDelta / rowStep)
  targetIdx.value = Math.max(0, Math.min(itemCount - 1, draggingIdx.value + offsetSlots))
}

function stopPointerDrag(commit = false) {
  const from = draggingIdx.value
  const to = targetIdx.value

  draggingIdx.value = -1
  targetIdx.value = -1
  draggingId.value = null
  dragDeltaY.value = 0

  if (typeof window !== 'undefined') {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
    window.removeEventListener('blur', onPointerCancel)
  }

  if (commit && from >= 0 && to >= 0 && from !== to) {
    overlayStore.moveNavTab(from, to)
  }
}

function onPointerUp() {
  stopPointerDrag(true)
}

function onPointerCancel() {
  stopPointerDrag(false)
}

function onRowPointerDown(e, idx, id) {
  if (e.button !== 0) return
  if (e.target.closest('.osp-vis-btn')) return
  e.preventDefault()
  stopPointerDrag(false)

  const rows = listRef.value?.querySelectorAll('[data-nav-idx]')
  itemCount = rows?.length || overlayStore.orderedNavTabs.length
  if (rows && rows.length > 1) {
    rowStep = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top
  } else if (rows?.[0]) {
    rowStep = rows[0].getBoundingClientRect().height + 4
  } else {
    rowStep = 44
  }
  minDeltaY = -idx * rowStep - 6
  maxDeltaY = (itemCount - 1 - idx) * rowStep + 6

  startClientY = e.clientY
  startScrollTop = rootRef.value?.scrollTop || 0
  draggingIdx.value = idx
  targetIdx.value = idx
  draggingId.value = id
  dragDeltaY.value = 0

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('blur', onPointerCancel)
}

function getRowStyle(idx) {
  if (draggingIdx.value < 0) return undefined
  if (idx === draggingIdx.value) {
    return { transform: `translate3d(0, ${dragDeltaY.value}px, 0)` }
  }
  if (draggingIdx.value < targetIdx.value && idx > draggingIdx.value && idx <= targetIdx.value) {
    return { transform: `translate3d(0, ${-rowStep}px, 0)` }
  }
  if (draggingIdx.value > targetIdx.value && idx >= targetIdx.value && idx < draggingIdx.value) {
    return { transform: `translate3d(0, ${rowStep}px, 0)` }
  }
  return undefined
}

onBeforeUnmount(() => {
  stopPointerDrag(false)
})
</script>

<template>
  <div
    ref="rootRef"
    class="osp-root no-drag"
    :class="[`ctx-${context}`, { 'is-sorting': draggingIdx >= 0 }]"
  >
    <div class="osp-header">
      <div class="osp-title-wrap">
        <span class="osp-title">悬浮窗设置</span>
        <span class="osp-sync-badge">双端实时同步</span>
      </div>
      <button
        type="button"
        class="osp-close-btn"
        title="关闭设置面板"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>

    <div class="osp-body">
      <!-- Section 1: Navigation Bar Order & Visibility -->
      <section class="osp-section">
        <div class="osp-sec-head">
          <span class="osp-sec-title">导航栏管理（按住条目上下拖动排序）</span>
          <button
            type="button"
            class="osp-reset-btn"
            :disabled="overlayStore.isDefaultNavConfig"
            title="恢复默认 5 个导航栏顺序与显示状态"
            @click="overlayStore.resetNavTabsConfig()"
          >
            恢复默认
          </button>
        </div>

        <div ref="listRef" class="osp-nav-list" :class="{ 'is-dragging': draggingIdx >= 0 }">
          <div
            v-for="(item, idx) in overlayStore.orderedNavTabs"
            :key="item.id"
            :data-nav-idx="idx"
            class="osp-nav-row"
            :class="{
              'is-hidden': !item.visible,
              'is-dragging': draggingId === item.id,
            }"
            :style="getRowStyle(idx)"
            title="按住上下拖动调整导航栏顺序"
            @pointerdown="onRowPointerDown($event, idx, item.id)"
          >
            <span class="osp-grip" aria-hidden="true">
              <svg viewBox="0 0 12 16" width="12" height="16">
                <circle cx="3.5" cy="3.5" r="1.15" fill="currentColor" />
                <circle cx="8.5" cy="3.5" r="1.15" fill="currentColor" />
                <circle cx="3.5" cy="8" r="1.15" fill="currentColor" />
                <circle cx="8.5" cy="8" r="1.15" fill="currentColor" />
                <circle cx="3.5" cy="12.5" r="1.15" fill="currentColor" />
                <circle cx="8.5" cy="12.5" r="1.15" fill="currentColor" />
              </svg>
            </span>

            <div class="osp-info">
              <strong>{{ item.label }}</strong>
              <small>{{ item.desc }}</small>
            </div>

            <button
              type="button"
              class="osp-vis-btn"
              :class="{ active: item.visible }"
              :disabled="item.visible && overlayStore.visibleNavTabs.length <= 1"
              :title="
                item.visible && overlayStore.visibleNavTabs.length <= 1
                  ? '至少保留 1 个导航栏'
                  : item.visible
                    ? '点击隐藏此导航栏'
                    : '点击显示此导航栏'
              "
              @pointerdown.stop
              @click="overlayStore.setNavTabVisible(item.id, !item.visible)"
            >
              {{ item.visible ? '✓ 显示' : '已隐藏' }}
            </button>
          </div>
        </div>

        <label class="osp-check-row">
          <input
            type="checkbox"
            :checked="overlayStore.hideSingleNavBar"
            @change="overlayStore.setHideSingleNavBar($event.target.checked)"
          />
          <span>仅开启 1 个模块时自动收起导航栏</span>
        </label>
      </section>

      <!-- Section 2: Window & Display -->
      <section class="osp-section">
        <div class="osp-sec-head">
          <span class="osp-sec-title">窗口与显示</span>
          <strong class="ar-num osp-alpha-val">{{ Math.round(overlayStore.opacity * 100) }}%</strong>
        </div>

        <div class="osp-alpha-row">
          <span class="osp-alpha-lbl">背景底色浓度</span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            :value="overlayStore.opacity"
            class="osp-slider"
            @input="overlayStore.setOpacity(Number($event.target.value))"
          />
        </div>

        <div class="osp-presets">
          <button
            v-for="p in [0.15, 0.35, 0.6, 0.85, 1]"
            :key="p"
            type="button"
            class="osp-preset-btn"
            :class="{ active: Math.abs(overlayStore.opacity - p) < 0.03 }"
            @click="overlayStore.setOpacity(p)"
          >
            {{ Math.round(p * 100) }}%
          </button>
        </div>

        <label class="osp-check-row">
          <input
            type="checkbox"
            :checked="overlayStore.autoMinimizeMain"
            @change="overlayStore.setAutoMinimizeMain($event.target.checked)"
          />
          <span>开启悬浮窗时自动最小化主窗口（关闭时自动恢复）</span>
        </label>
      </section>

      <!-- Section 3: Global Hotkeys -->
      <section class="osp-section osp-hk-section">
        <button
          type="button"
          class="osp-hk-toggle"
          @click="showHotkeys = !showHotkeys"
        >
          <span>全局快捷键说明</span>
          <span class="osp-hk-arrow">{{ showHotkeys ? '▾' : '▸' }}</span>
        </button>

        <div v-if="showHotkeys" class="osp-hk-list">
          <div class="osp-hk-row">
            <span>呼出 / 隐藏悬浮窗</span>
            <div><kbd>Alt + Q</kbd> / <kbd>F9</kbd></div>
          </div>
          <div class="osp-hk-row">
            <span>全屏地图透视对标模式</span>
            <div><kbd>Alt + F</kbd></div>
          </div>
          <div class="osp-hk-row">
            <span>开启 / 取消鼠标穿透标点</span>
            <div><kbd>Alt + X</kbd> / <kbd>F10</kbd></div>
          </div>
          <div class="osp-hk-row">
            <span>折叠 / 展开迷你胶囊条</span>
            <div><kbd>Alt + M</kbd></div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.osp-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  color: var(--tx-1);
  overflow-y: auto;
}

.osp-root.ctx-overlay {
  max-height: calc(100vh - 54px);
}

.osp-root.ctx-main {
  max-height: min(78vh, 540px);
}

.osp-root.is-sorting,
.osp-root.is-sorting * {
  user-select: none;
  cursor: grabbing !important;
}

.osp-header {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(11, 15, 28, 0.98);
  border-bottom: 1px solid var(--line);
}

.osp-title-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.osp-title {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--cream);
  white-space: nowrap;
}

.osp-sync-badge {
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(63, 146, 172, 0.2);
  border: 1px solid rgba(63, 146, 172, 0.45);
  color: #7dd3fc;
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
}

.osp-close-btn {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: rgba(20, 27, 46, 0.85);
  color: var(--tx-2);
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.osp-close-btn:hover {
  border-color: var(--cream);
  color: var(--cream);
}

.osp-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 9px 12px 11px;
}

.osp-section {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--line);
}

.osp-section:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.osp-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.osp-sec-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--tx-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osp-reset-btn {
  height: 20px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid rgba(255, 188, 19, 0.48);
  background: rgba(255, 188, 19, 0.14);
  color: var(--amber);
  font-family: var(--font-display);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
}

.osp-reset-btn:hover:not(:disabled) {
  background: rgba(255, 188, 19, 0.24);
  border-color: var(--amber);
}

.osp-reset-btn:disabled {
  opacity: 0.38;
  border-color: var(--line);
  background: transparent;
  color: var(--tx-3);
  cursor: not-allowed;
}

.osp-nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.osp-nav-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: rgba(20, 27, 46, 0.72);
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: border-color 0.14s, background 0.14s, opacity 0.14s;
}

.osp-nav-row:hover {
  border-color: var(--line-strong);
}

.osp-nav-row:hover .osp-grip {
  color: var(--amber);
}

.osp-nav-list.is-dragging .osp-nav-row:not(.is-dragging) {
  transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
}

.osp-nav-row.is-hidden {
  opacity: 0.56;
  background: rgba(14, 18, 32, 0.62);
}

.osp-nav-row.is-dragging {
  z-index: 10;
  cursor: grabbing;
  opacity: 1;
  border-color: var(--amber);
  background: rgba(28, 36, 58, 0.96);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
}

.osp-grip {
  width: 18px;
  height: 24px;
  color: var(--tx-3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.14s;
}

.osp-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.osp-info strong {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osp-info small {
  font-size: 10px;
  color: var(--tx-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osp-vis-btn {
  min-width: 52px;
  height: 22px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: rgba(12, 16, 29, 0.78);
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 10.5px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.14s;
}

.osp-vis-btn.active {
  border-color: rgba(38, 191, 87, 0.55);
  background: rgba(38, 191, 87, 0.18);
  color: #86efac;
}

.osp-vis-btn:hover:not(:disabled) {
  border-color: var(--cream);
  color: var(--cream);
}

.osp-vis-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.osp-check-row {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  color: var(--tx-1);
  cursor: pointer;
  user-select: none;
}

.osp-check-row input {
  accent-color: var(--amber);
  cursor: pointer;
  flex-shrink: 0;
}

.osp-alpha-val {
  font-size: 12px;
  color: var(--amber);
}

.osp-alpha-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.osp-alpha-lbl {
  font-size: 11px;
  color: var(--tx-2);
  white-space: nowrap;
}

.osp-slider {
  flex: 1;
  accent-color: var(--amber);
  cursor: pointer;
}

.osp-presets {
  display: flex;
  gap: 5px;
}

.osp-preset-btn {
  flex: 1;
  height: 22px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: rgba(20, 27, 46, 0.85);
  color: var(--tx-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.osp-preset-btn:hover {
  border-color: var(--cream);
  color: var(--cream);
}

.osp-preset-btn.active {
  border-color: var(--amber);
  color: var(--amber);
}

.osp-hk-toggle {
  width: 100%;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.osp-hk-toggle:hover {
  color: var(--cream);
}

.osp-hk-arrow {
  color: var(--amber);
}

.osp-hk-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 2px;
}

.osp-hk-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--tx-1);
}

.osp-hk-row kbd {
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bg-3);
  border: 1px solid var(--line-strong);
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--amber);
}
</style>
