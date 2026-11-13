<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import raiderData from '../../../data/raiderSkillsData.json'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'
import { assetUrl } from '../../../utils/assetUrl'
import { analyzeBuildSyncDiff } from '../../../utils/raiderAutoSyncPlanner'

const overlayStore = useOverlayWindowStore()

const vw = ref(typeof window !== 'undefined' ? window.innerWidth : 1920)
const vh = ref(typeof window !== 'undefined' ? window.innerHeight : 1080)
const guideAlpha = ref(0.96)

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
  else if (guideAlpha.value > 0.55) guideAlpha.value = 0.4
  else guideAlpha.value = 0.96
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

const branchColorMap = Object.fromEntries(raiderData.branches.map((b) => [b.id, b.color]))

const guideSpec = computed(() => overlayStore.raiderGuideSpec)

const diffPlan = computed(() => {
  const spec = guideSpec.value
  if (!spec?.targetBuild) return null
  return analyzeBuildSyncDiff(spec.inGameBuild || null, spec.targetBuild, raiderData.tree)
})

const markers = computed(() => {
  const plan = diffPlan.value
  if (!plan) return []
  const W = vw.value
  // DWM 全屏穿透悬浮窗高度为 monitor_h - 1px，补偿 1px 获得精确 1080p 缩放
  const H = vh.value + 1
  const S = Math.min(W / 1920, H / 1080)
  const ox = W * 0.5
  const oy = H * 0.5

  return plan.steps.map((step, idx) => {
    const node = step.node
    const x = Math.round(ox + node.x * S)
    const y = Math.round(oy + node.y * S)
    const isLarge = node.shape === 'large-circle'
    const isDiamond = node.shape === 'diamond'
    const size = Math.round((isLarge ? 92 : isDiamond ? 76 : 56) * S)

    const label =
      step.kind === 'gate'
        ? step.skillName
        : step.currentPoints > 0
          ? `${step.currentPoints}→${step.targetPoints}`
          : `+${step.targetPoints}`

    return {
      key: `${node.nodeId}-${idx}`,
      order: idx + 1,
      kind: step.kind,
      isDiamond,
      x,
      y,
      size,
      color: branchColorMap[node.branch] || '#5fffff',
      label,
      skillName: step.skillName,
      icon: step.icon ? assetUrl(step.icon) : null,
    }
  })
})
</script>

<template>
  <div class="rhg-shell">
    <!-- Top-Right Interactive Control Dock (Aligned with OverlayMiniRadarMap fullscreen dock
         and positioned strictly inside Win32 500x136 smart hit-test auto-unpierce zone) -->
    <div class="rhg-settings-dock no-drag" @pointerdown.stop>
      <div class="rhg-toolbar">
        <div class="rhg-dock-info">
          <span class="rhg-dot"></span>
          <strong class="rhg-dock-title" :title="guideSpec?.title || '目标配装'">
            {{ guideSpec?.title || '目标配装' }}
          </strong>
          <em v-if="diffPlan" class="rhg-dock-pts ar-num">
            +{{ diffPlan.totalDeltaPoints }}P · {{ markers.length }}节点
          </em>
        </div>

        <div class="rhg-toolbar-right">
          <button
            type="button"
            class="rhg-tool-btn"
            title="点击切换透视光圈与角标清晰度"
            @click="cycleGuideAlpha"
          >
            标注 {{ Math.round(guideAlpha * 100) }}%
          </button>

          <button
            type="button"
            class="rhg-tool-btn fs-trigger active"
            title="退出全屏透视跟点指引并返回悬浮窗加点面板 (快捷键 Alt+F / ESC)"
            @click="overlayStore.exitRaiderPerspectiveGuide('back')"
          >
            退出透视
          </button>
        </div>
      </div>
    </div>

    <!-- Fullscreen Click-Through Canvas Projection Layer -->
    <div class="raider-hud-guide" :style="{ opacity: guideAlpha }">
      <div class="rhg-banner">
        <span class="rhg-dot"></span>
        <strong>透视跟点指引</strong>
        <span v-if="diffPlan" class="rhg-meta">
          共需投入 <em>{{ diffPlan.totalDeltaPoints }}P</em>
        </span>
        <span class="rhg-hk">
          鼠标已穿透直达游戏 · 右上角点击【退出透视】或按 <kbd>Alt+F</kbd> 返回
        </span>
      </div>

      <!-- 1:1 Projected Node Rings & Badges -->
      <div
        v-for="m in markers"
        :key="m.key"
        class="rhg-marker"
        :class="{ 'is-diamond': m.isDiamond, 'is-gate': m.kind === 'gate' }"
        :style="{
          left: `${m.x}px`,
          top: `${m.y}px`,
          width: `${m.size}px`,
          height: `${m.size}px`,
          '--mc': m.color,
        }"
      >
        <div class="rhg-ring"></div>
        <div class="rhg-pill">
          <img v-if="m.kind === 'gate' && m.icon" :src="m.icon" alt="" class="rhg-gate-ico" />
          <span>{{ m.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rhg-shell {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

/* Matches OverlayMiniRadarMap .omr-shell.is-fs-mode .omr-settings-dock */
.rhg-settings-dock {
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
  pointer-events: auto;
}

.rhg-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 28px;
}

.rhg-dock-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
}

.rhg-dock-title {
  font-family: var(--font-display, sans-serif);
  font-size: 12px;
  font-weight: 800;
  color: var(--cream, #f3efe6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rhg-dock-pts {
  flex-shrink: 0;
  font-style: normal;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(95, 255, 255, 0.16);
  border: 1px solid rgba(95, 255, 255, 0.42);
  color: #5fffff;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
}

.rhg-toolbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.rhg-tool-btn {
  height: 28px;
  padding: 0 9px;
  border-radius: 4px;
  border: 1px solid var(--line-strong, rgba(206, 193, 176, 0.35));
  background: rgba(18, 24, 42, 0.88);
  color: var(--tx-1, #f3efe6);
  font-family: var(--font-display, sans-serif);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.14s;
}

.rhg-tool-btn:hover {
  border-color: var(--amber, #ffbc13);
  color: var(--amber, #ffbc13);
}

.rhg-tool-btn.fs-trigger.active {
  background: var(--amber, #ffbc13);
  border-color: var(--amber, #ffbc13);
  color: #090c19;
  font-weight: 800;
  text-shadow: none;
}

.rhg-tool-btn.fs-trigger.active:hover {
  background: #ffd04d;
  border-color: #ffd04d;
}

.raider-hud-guide {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  overflow: hidden;
  transition: opacity 0.15s ease;
}

.rhg-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 13px;
  border-radius: 999px;
  background: rgba(7, 11, 20, 0.88);
  border: 1px solid rgba(95, 255, 255, 0.55);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.65);
  font-size: 11.5px;
  color: #f3efe6;
  white-space: nowrap;
}

@media (max-width: 1460px) {
  .rhg-banner {
    left: 14px;
    transform: none;
  }
}

.rhg-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5fffff;
  box-shadow: 0 0 8px #5fffff;
  flex-shrink: 0;
}

.rhg-meta em {
  font-style: normal;
  font-weight: 800;
  color: #ffbc13;
}

.rhg-hk {
  color: #9aa7bd;
  font-size: 11px;
}

.rhg-hk kbd {
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  color: #fff;
  font-family: var(--font-mono, monospace);
  font-size: 10.5px;
}

.rhg-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.rhg-ring {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2.5px dashed var(--mc);
  box-shadow:
    0 0 12px color-mix(in srgb, var(--mc) 65%, transparent),
    inset 0 0 8px color-mix(in srgb, var(--mc) 35%, transparent);
  animation: rhg-pulse 1.8s ease-in-out infinite;
}

.rhg-marker.is-diamond .rhg-ring {
  border-radius: 6px;
  transform: rotate(45deg) scale(0.74);
  border-style: solid;
}

.rhg-pill {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 4px);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(6, 10, 18, 0.94);
  border: 1.5px solid var(--mc);
  color: #ffffff;
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  font-weight: 800;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.85);
}

.rhg-marker.is-gate .rhg-pill {
  font-family: var(--font-display, sans-serif);
  padding: 2px 9px;
  background: rgba(12, 18, 32, 0.96);
}

.rhg-gate-ico {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

@keyframes rhg-pulse {
  0%,
  100% {
    opacity: 0.95;
  }
  50% {
    opacity: 0.52;
  }
}
</style>
