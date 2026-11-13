<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'
import { analyzeLoadoutSyncDiff } from '../../../utils/raiderLoadoutSyncPlanner'

const overlayStore = useOverlayWindowStore()

const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)
const guideAlpha = ref(0.95)
const hideMatched = ref(false)
const anchorMode = ref('center') // 'center' | 'right' (for 21:9 ultrawide)

const isUltrawide = computed(() => vw.value / Math.max(1, vh.value) > 1.85)

function onResize() {
  vw.value = window.innerWidth || 1920
  vh.value = window.innerHeight || 1080
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    void overlayStore.exitRaiderPerspectiveGuide('back')
  }
}

function cycleGuideAlpha() {
  if (guideAlpha.value > 0.85) guideAlpha.value = 0.68
  else if (guideAlpha.value > 0.55) guideAlpha.value = 0.42
  else guideAlpha.value = 0.95
}

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeyDown)
})

const guideSpec = computed(() => overlayStore.raiderGuideSpec)

const diffPlan = computed(() => {
  const spec = guideSpec.value
  if (!spec?.targetLoadout) return null
  return analyzeLoadoutSyncDiff(spec.inGameLoadout || null, spec.targetLoadout)
})

const projectedBoxes = computed(() => {
  const plan = diffPlan.value
  if (!plan) return []
  const W = vw.value
  // DWM 全屏穿透窗口高度为 monitor_h - 1px，补偿 1px 获得精确 1080p 缩放
  const H = vh.value + 1
  const S = H / 1080
  const ox =
    anchorMode.value === 'right' ? W - 1920 * S : (W - 1920 * S) * 0.5
  const oy = 0

  return plan.entries
    .filter((e) => !(hideMatched.value && e.matched))
    .map((entry) => {
      const r = entry.rect1080p
      return {
        ...entry,
        x: Math.round(ox + r.x * S),
        y: Math.round(oy + r.y * S),
        w: Math.round(r.w * S),
        h: Math.round(r.h * S),
      }
    })
})
</script>

<template>
  <div class="rlg-shell">
    <!-- Top-Right Interactive Control Dock (Inside Win32 500x136 smart hit-test zone) -->
    <div class="rlg-settings-dock no-drag" @pointerdown.stop>
      <div class="rlg-toolbar">
        <div class="rlg-dock-info">
          <span class="rlg-dot"></span>
          <strong class="rlg-dock-title" :title="guideSpec?.title || '目标战备'">
            {{ guideSpec?.title || '目标战备' }}
          </strong>
          <em v-if="diffPlan" class="rlg-dock-pts ar-num">
            {{
              diffPlan.hasLiveSnapshot
                ? `待装 ${diffPlan.pendingCount}/${diffPlan.totalTargetSlots}`
                : `${diffPlan.totalTargetSlots} 槽位`
            }}
          </em>
        </div>

        <div class="rlg-toolbar-right">
          <button
            v-if="diffPlan?.hasLiveSnapshot && diffPlan.matchedCount > 0"
            type="button"
            class="rlg-tool-btn"
            :class="{ active: hideMatched }"
            @click="hideMatched = !hideMatched"
          >
            {{ hideMatched ? '仅看缺失' : '全部槽位' }}
          </button>

          <button
            v-if="isUltrawide"
            type="button"
            class="rlg-tool-btn"
            @click="anchorMode = anchorMode === 'center' ? 'right' : 'center'"
          >
            {{ anchorMode === 'center' ? '居中锚定' : '右侧锚定' }}
          </button>

          <button
            type="button"
            class="rlg-tool-btn"
            @click="cycleGuideAlpha"
          >
            {{ Math.round(guideAlpha * 100) }}%
          </button>

          <button
            type="button"
            class="rlg-tool-btn exit"
            title="退出全屏透视配装指引 (Alt+F / ESC)"
            @click="overlayStore.exitRaiderPerspectiveGuide('back')"
          >
            退出透视
          </button>
        </div>
      </div>
    </div>

    <!-- Fullscreen Click-Through Slot Projection Layer -->
    <div class="rlg-canvas" :style="{ opacity: guideAlpha }">
      <div class="rlg-banner">
        <span class="rlg-dot"></span>
        <strong>战备透视指引</strong>
        <span class="rlg-hk">
          鼠标穿透已开启 · 对照槽位直接装配 · 按 <kbd>Alt+F</kbd> 或右上角退出
        </span>
      </div>

      <div
        v-for="box in projectedBoxes"
        :key="box.key"
        class="rlg-slot-box"
        :class="[
          `kind-${box.kind}`,
          { 'is-matched': box.matched },
        ]"
        :style="{
          left: `${box.x}px`,
          top: `${box.y}px`,
          width: `${box.w}px`,
          height: `${box.h}px`,
          '--sc': box.matched ? '#26bf57' : box.color,
        }"
      >
        <div class="rsb-top-pill">
          <img :src="box.icon" alt="" class="rsb-ico" />
          <span class="rsb-name">{{ box.targetName }}</span>
          <strong class="rsb-badge ar-num">{{ box.matched ? '✓' : box.badge }}</strong>
        </div>

        <!-- Weapon Mod Strip at Bottom of Weapon Slot -->
        <div
          v-if="box.kind === 'weapon' && (box.modBadges?.length || box.subTags?.length)"
          class="rsb-weapon-mods"
        >
          <span
            v-for="mb in box.modBadges"
            :key="mb.id"
            class="rsb-mod-chip"
          >
            <img v-if="mb.icon" :src="mb.icon" alt="" />
            <b>{{ mb.name }}</b>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rlg-shell {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.rlg-settings-dock {
  position: relative;
  z-index: 20;
  width: min(490px, 95vw);
  margin-left: auto;
  margin-right: 10px;
  padding: 6px 10px 8px;
  background: rgba(7, 10, 20, 0.92);
  border: 1px solid rgba(206, 193, 176, 0.32);
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);
  pointer-events: auto;
}

.rlg-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
}

.rlg-dock-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}

.rlg-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffbc13;
  box-shadow: 0 0 8px #ffbc13;
  flex-shrink: 0;
}

.rlg-dock-title {
  font-family: var(--font-display, sans-serif);
  font-size: 12px;
  font-weight: 800;
  color: var(--cream, #f9eedf);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rlg-dock-pts {
  flex-shrink: 0;
  font-style: normal;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(95, 255, 255, 0.14);
  border: 1px solid rgba(95, 255, 255, 0.42);
  color: #5fffff;
  font-family: var(--font-mono, monospace);
  font-size: 10.5px;
  font-weight: 800;
}

.rlg-toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.rlg-tool-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(206, 193, 176, 0.28);
  background: rgba(18, 23, 38, 0.92);
  color: #ebdecb;
  font-family: var(--font-display, sans-serif);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.rlg-tool-btn.active {
  border-color: #5fffff;
  color: #5fffff;
}

.rlg-tool-btn.exit {
  border-color: #ffbc13;
  background: #ffbc13;
  color: #090c19;
  font-weight: 800;
}

.rlg-canvas {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 10;
}

.rlg-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  border-radius: 999px;
  background: rgba(7, 10, 20, 0.88);
  border: 1px solid rgba(255, 188, 19, 0.45);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  color: #f9eedf;
  font-size: 11.5px;
  white-space: nowrap;
}

.rlg-hk {
  color: #cec1b0;
  font-size: 11px;
}

.rlg-hk kbd {
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(255, 188, 19, 0.2);
  color: #ffbc13;
  font-family: var(--font-mono, monospace);
  font-size: 10.5px;
}

.rlg-slot-box {
  position: absolute;
  border: 2px solid var(--sc, #5fffff);
  border-radius: 4px;
  box-shadow:
    0 0 12px color-mix(in srgb, var(--sc) 45%, transparent),
    inset 0 0 14px color-mix(in srgb, var(--sc) 16%, transparent);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}

.rlg-slot-box.is-matched {
  opacity: 0.52;
  border-style: dashed;
}

.rsb-top-pill {
  align-self: flex-start;
  max-width: 150%;
  margin: -11px 0 0 -2px;
  padding: 2px 6px 2px 4px;
  border-radius: 4px;
  background: rgba(7, 10, 20, 0.94);
  border: 1px solid var(--sc);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.75);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.rsb-ico {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}

.rsb-name {
  font-size: 11px;
  font-weight: 800;
  color: #f9eedf;
}

.rsb-badge {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 800;
  color: var(--sc);
}

.rsb-weapon-mods {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding: 2px 4px;
  background: rgba(7, 10, 20, 0.88);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.rsb-mod-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 9.5px;
  color: #ebdecb;
}

.rsb-mod-chip img {
  width: 12px;
  height: 12px;
  object-fit: contain;
}

.rsb-mod-chip b {
  font-weight: 700;
}
</style>
