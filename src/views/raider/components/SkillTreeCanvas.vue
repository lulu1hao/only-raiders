<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRaiderStore } from '../../../stores/useRaiderStore'

const store = useRaiderStore()

const viewportRef = ref(null)
const panX = ref(0)
const panY = ref(0)
const scale = ref(0.72)
const isDragging = ref(false)
const isAnimatingView = ref(false)

let pointerActive = false
let dragStartX = 0
let dragStartY = 0
let startPanX = 0
let startPanY = 0
let movedDistance = 0
let resizeObserver = null
let animTimer = null

const DRAG_THRESHOLD = 8

const WORLD_ORIGIN_X = 1200
const WORLD_ORIGIN_Y = 900
const WORLD_WIDTH = 2400
const WORLD_HEIGHT = 1800

const branchHeaders = computed(() => [
  {
    id: 'conditioning',
    x: -255,
    y: 392,
    align: 'right',
    info: store.branchMap.conditioning,
    points: store.branchPoints.conditioning,
  },
  {
    id: 'mobility',
    x: 0,
    y: -504,
    align: 'center',
    info: store.branchMap.mobility,
    points: store.branchPoints.mobility,
  },
  {
    id: 'survival',
    x: 255,
    y: 392,
    align: 'left',
    info: store.branchMap.survival,
    points: store.branchPoints.survival,
  },
])

const rootSplinePaths = computed(() => {
  const splines = store.currentTree.rootSplines || {}
  const nodes = store.currentTree.nodes || []
  const list = []

  for (const b of store.branches) {
    const sp = splines[b.id]
    if (!sp || !sp.points || sp.points.length < 2) continue
    const pts = sp.points
    const rootNode = nodes.find((n) => n.branch === b.id && n.tier === 0)

    let d = ''
    if (rootNode) {
      d += `M ${rootNode.x + WORLD_ORIGIN_X} ${rootNode.y + WORLD_ORIGIN_Y} `
      d += `L ${pts[0].x + WORLD_ORIGIN_X} ${pts[0].y + WORLD_ORIGIN_Y} `
    } else {
      d += `M ${pts[0].x + WORLD_ORIGIN_X} ${pts[0].y + WORLD_ORIGIN_Y} `
    }

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i]
      const p1 = pts[i + 1]
      const c1x = p0.x + (p0.dx || 0) / 3 + WORLD_ORIGIN_X
      const c1y = p0.y + (p0.dy || 0) / 3 + WORLD_ORIGIN_Y
      const c2x = p1.x - (p1.dx || 0) / 3 + WORLD_ORIGIN_X
      const c2y = p1.y - (p1.dy || 0) / 3 + WORLD_ORIGIN_Y
      const x = p1.x + WORLD_ORIGIN_X
      const y = p1.y + WORLD_ORIGIN_Y
      d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)} `
    }

    const rootUnlocked = rootNode ? (store.nodeStates[rootNode.nodeId]?.points || 0) > 0 : false
    list.push({
      branch: b.id,
      color: b.color,
      thickness: sp.thickness || 13,
      d: d.trim(),
      active: rootUnlocked,
      dimmed: store.focusedBranch !== 'all' && store.focusedBranch !== b.id,
    })
  }
  return list
})

const connectionItems = computed(() => {
  const states = store.nodeStates
  return (store.currentTree.connections || []).map((conn) => {
    const fromSt = states[conn.fromNodeId]
    const toSt = states[conn.toNodeId]
    const fromAllocated = (fromSt?.points || 0) > 0
    const toAllocated = (toSt?.points || 0) > 0

    let state = 'locked'
    if (fromAllocated && toAllocated) {
      state = 'active'
    } else if (fromAllocated && (toSt?.status === 'available' || toSt?.node?.kind !== 'normal')) {
      state = 'ready'
    }

    const d = conn.points
      .map(
        (pt, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${(pt.x + WORLD_ORIGIN_X).toFixed(1)} ${(pt.y + WORLD_ORIGIN_Y).toFixed(1)}`,
      )
      .join(' ')

    return {
      id: conn.id,
      branch: conn.branch,
      color: store.branchMap[conn.branch]?.color || '#ffffff',
      state,
      d,
      dimmed: store.focusedBranch !== 'all' && store.focusedBranch !== conn.branch,
    }
  })
})

const renderedNodes = computed(() => {
  const tree = store.currentTree
  return tree.nodes.map((node) => {
    const st = store.nodeStates[node.nodeId]
    const branchColor = store.branchMap[node.branch]?.color || '#5fffff'
    const sk = st?.skill || null
    const pts = st?.points || 0
    const maxPts = st?.maxPoints || 1

    let xrayText = ''
    let titleLabel = ''
    let gateHint = ''

    if (node.kind === 'normal' && sk) {
      titleLabel = sk.name
      if (pts > 0) {
        const lvObj = sk.levels[Math.min(pts, sk.levels.length) - 1]
        xrayText = lvObj?.display || sk.badge
      } else {
        xrayText = sk.badge
      }
    } else {
      if (sk && pts > 0) {
        titleLabel = sk.name
        const lvObj = sk.levels[0]
        xrayText = lvObj?.display || sk.badge
      } else {
        titleLabel = node.kind === 'choice' ? '2选1' : '3选2'
        xrayText = `${node.minBranchPoints}P`
        gateHint = node.kind === 'choice' ? '2选1' : '3选2'
      }
    }

    const candidatePreviews =
      node.kind !== 'normal' && !sk
        ? (node.candidateIds || [])
            .map((cid) => tree.skills[cid])
            .filter(Boolean)
            .slice(0, 3)
        : []

    return {
      node,
      state: st,
      skill: sk,
      points: pts,
      maxPoints: maxPts,
      status: st?.status || 'locked',
      branchColor,
      left: node.x + WORLD_ORIGIN_X,
      top: node.y + WORLD_ORIGIN_Y,
      isSelected: store.selectedNodeId === node.nodeId,
      dimmed: store.focusedBranch !== 'all' && store.focusedBranch !== node.branch,
      titleLabel,
      xrayText,
      gateHint,
      candidatePreviews,
    }
  })
})

function triggerSmoothCamera() {
  isAnimatingView.value = true
  if (animTimer) clearTimeout(animTimer)
  animTimer = setTimeout(() => {
    isAnimatingView.value = false
  }, 300)
}

function fitToView(branchId = store.focusedBranch, animate = true) {
  const el = viewportRef.value
  if (!el) return
  const vw = el.clientWidth || 1000
  const vh = el.clientHeight || 720

  const targetNodes = store.currentTree.nodes.filter(
    (n) => branchId === 'all' || n.branch === branchId,
  )
  if (targetNodes.length === 0) return

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity

  for (const n of targetNodes) {
    if (n.x < minX) minX = n.x
    if (n.x > maxX) maxX = n.x
    if (n.y < minY) minY = n.y
    if (n.y > maxY) maxY = n.y
  }

  if (branchId === 'all' || branchId === 'mobility') {
    minY = Math.min(minY, -520)
  }
  if (branchId === 'all') {
    maxY = Math.max(maxY, 490)
  } else {
    maxY = Math.max(maxY, 340)
  }

  const padX = branchId === 'all' ? 140 : 160
  const padY = branchId === 'all' ? 110 : 130
  const boxW = maxX - minX + padX * 2
  const boxH = maxY - minY + padY * 2

  const nextScale = Math.max(0.42, Math.min(1.18, Math.min(vw / boxW, vh / boxH)))
  const centerX = (minX + maxX) * 0.5 + WORLD_ORIGIN_X
  const centerY = (minY + maxY) * 0.5 + WORLD_ORIGIN_Y

  if (animate) triggerSmoothCamera()
  scale.value = nextScale
  panX.value = Math.round(vw * 0.5 - centerX * nextScale)
  panY.value = Math.round(vh * 0.5 - centerY * nextScale)
}

function zoomBy(factor) {
  const el = viewportRef.value
  if (!el) return
  const cx = el.clientWidth * 0.5
  const cy = el.clientHeight * 0.5
  const nextScale = Math.max(0.4, Math.min(1.85, scale.value * factor))
  const ratio = nextScale / scale.value
  triggerSmoothCamera()
  panX.value = Math.round(cx - (cx - panX.value) * ratio)
  panY.value = Math.round(cy - (cy - panY.value) * ratio)
  scale.value = nextScale
}

function onWheel(e) {
  e.preventDefault()
  const el = viewportRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const factor = e.deltaY < 0 ? 1.11 : 0.9
  const nextScale = Math.max(0.4, Math.min(1.85, scale.value * factor))
  const ratio = nextScale / scale.value
  isAnimatingView.value = false
  panX.value = Math.round(mx - (mx - panX.value) * ratio)
  panY.value = Math.round(my - (my - panY.value) * ratio)
  scale.value = nextScale
}

function onPointerDown(e) {
  if (e.button !== 0 && e.button !== 1) return
  if (e.target.closest('.canvas-hud-stop')) return
  pointerActive = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  startPanX = panX.value
  startPanY = panY.value
  movedDistance = 0
}

function onPointerMove(e) {
  if (!pointerActive) return
  const dx = e.clientX - dragStartX
  const dy = e.clientY - dragStartY
  movedDistance = Math.hypot(dx, dy)
  if (!isDragging.value) {
    if (movedDistance < DRAG_THRESHOLD) return
    isDragging.value = true
    isAnimatingView.value = false
  }
  panX.value = Math.round(startPanX + dx)
  panY.value = Math.round(startPanY + dy)
}

function onPointerUp() {
  pointerActive = false
  isDragging.value = false
}

function onNodeLeftClick(e, item) {
  if (movedDistance >= DRAG_THRESHOLD) return
  if (item.node.kind !== 'normal') {
    store.openGateModal(item.node.nodeId)
    return
  }
  store.allocateNode(item.node.nodeId, e.shiftKey)
}

function onNodeRightClick(e, item) {
  e.preventDefault()
  if (movedDistance >= DRAG_THRESHOLD) return
  store.selectNode(item.node.nodeId)
  store.deallocateNode(item.node.nodeId, e.shiftKey)
}

function setBranchFocus(branchId) {
  store.focusedBranch = branchId
  fitToView(branchId, true)
}

function centerOnNode(nodeId) {
  const el = viewportRef.value
  const node = store.currentTree.nodes.find((n) => n.nodeId === nodeId)
  if (!el || !node) return
  const vw = el.clientWidth
  const vh = el.clientHeight
  const targetScale = Math.max(scale.value, 0.82)
  triggerSmoothCamera()
  scale.value = targetScale
  panX.value = Math.round(vw * 0.5 - (node.x + WORLD_ORIGIN_X) * targetScale)
  panY.value = Math.round(vh * 0.5 - (node.y + WORLD_ORIGIN_Y) * targetScale)
}

defineExpose({ fitToView, centerOnNode })

onMounted(async () => {
  await nextTick()
  fitToView('all', false)
  if (typeof ResizeObserver !== 'undefined' && viewportRef.value) {
    let prevW = viewportRef.value.clientWidth
    resizeObserver = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 0
      const delta = w - prevW
      if (Math.abs(delta) > 8) {
        // Shift camera horizontally by half of width delta so center stays anchored when sidebar toggles
        panX.value = Math.round(panX.value + delta * 0.5)
        prevW = w
      }
    })
    resizeObserver.observe(viewportRef.value)
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onBeforeUnmount(() => {
  if (resizeObserver) resizeObserver.disconnect()
  if (animTimer) clearTimeout(animTimer)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <section
    ref="viewportRef"
    class="skill-canvas-viewport"
    :class="{ 'is-dragging': isDragging }"
    @pointerdown="onPointerDown"
    @wheel="onWheel"
    @contextmenu.prevent
  >
    <div class="canvas-backdrop" aria-hidden="true"></div>

    <!-- Branch Focus Filter Pills -->
    <div class="canvas-branch-pills canvas-hud-stop">
      <button
        type="button"
        class="focus-pill"
        :class="{ active: store.focusedBranch === 'all' }"
        @click="setBranchFocus('all')"
      >
        全局
      </button>
      <button
        v-for="b in store.branches"
        :key="b.id"
        type="button"
        class="focus-pill"
        :class="{ active: store.focusedBranch === b.id }"
        :style="{ '--b-col': b.color }"
        @click="setBranchFocus(b.id)"
      >
        <span class="pill-dot"></span>
        <span>{{ b.name }}</span>
        <strong class="pill-pts">{{ store.branchPoints[b.id] }}</strong>
      </button>
    </div>

    <!-- Pan & Zoom World Stage -->
    <div
      class="world-stage"
      :class="{ 'smooth-cam': isAnimatingView, 'is-moving': isDragging || isAnimatingView }"
      :style="{
        width: `${WORLD_WIDTH}px`,
        height: `${WORLD_HEIGHT}px`,
        transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
      }"
    >
      <svg
        class="world-svg"
        :width="WORLD_WIDTH"
        :height="WORLD_HEIGHT"
        :viewBox="`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`"
        fill="none"
      >
        <defs>
          <filter id="glow-line" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g class="constellation-guides" opacity="0.2">
          <circle :cx="WORLD_ORIGIN_X" :cy="WORLD_ORIGIN_Y + 240" r="240" stroke="#606576" stroke-width="1" stroke-dasharray="4 8" />
          <circle :cx="WORLD_ORIGIN_X" :cy="WORLD_ORIGIN_Y + 240" r="460" stroke="#606576" stroke-width="1" stroke-dasharray="4 10" />
          <circle :cx="WORLD_ORIGIN_X" :cy="WORLD_ORIGIN_Y + 240" r="690" stroke="#606576" stroke-width="1" stroke-dasharray="3 12" />
        </g>

        <g class="connections-layer">
          <path
            v-for="conn in connectionItems"
            :key="conn.id"
            :d="conn.d"
            class="conn-path"
            :class="[`is-${conn.state}`, { 'is-dimmed': conn.dimmed }]"
            :stroke="conn.state === 'locked' ? '#4a5064' : conn.color"
            :stroke-width="conn.state === 'active' ? 6.5 : conn.state === 'ready' ? 4 : 3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </g>

        <g class="roots-layer">
          <g
            v-for="sp in rootSplinePaths"
            :key="sp.branch"
            :class="{ 'is-dimmed': sp.dimmed }"
          >
            <path
              v-if="sp.active"
              :d="sp.d"
              :stroke="sp.color"
              :stroke-width="sp.thickness + 6"
              stroke-linecap="round"
              opacity="0.24"
              filter="url(#glow-line)"
            />
            <path
              :d="sp.d"
              :stroke="sp.color"
              :stroke-width="sp.thickness"
              :opacity="sp.active ? 0.96 : 0.68"
              stroke-linecap="round"
            />
          </g>
        </g>
      </svg>

      <!-- Clean Branch Point Callouts -->
      <div
        v-for="bh in branchHeaders"
        :key="bh.id"
        class="branch-callout"
        :class="[
          `align-${bh.align}`,
          { 'is-dimmed': store.focusedBranch !== 'all' && store.focusedBranch !== bh.id },
        ]"
        :style="{
          left: `${bh.x + WORLD_ORIGIN_X}px`,
          top: `${bh.y + WORLD_ORIGIN_Y}px`,
          '--b-col': bh.info.color,
        }"
      >
        <div class="bh-row">
          <span class="bh-zh">{{ bh.info.name }}</span>
          <span class="bh-pts">{{ bh.points }}</span>
        </div>
      </div>

      <!-- Interactive Skill Nodes -->
      <div
        v-for="item in renderedNodes"
        :key="item.node.slotKey"
        class="skill-node-wrap"
        :class="[
          `shape-${item.node.shape}`,
          `kind-${item.node.kind}`,
          `status-${item.status}`,
          {
            'is-selected': item.isSelected,
            'is-dimmed': item.dimmed,
          },
        ]"
        :style="{
          left: `${item.left}px`,
          top: `${item.top}px`,
          '--n-col': item.branchColor,
        }"
        role="button"
        tabindex="0"
        :aria-label="`${item.titleLabel} (${item.points}/${item.maxPoints})`"
        @click.stop="onNodeLeftClick($event, item)"
        @contextmenu.stop="onNodeRightClick($event, item)"
        @keydown.enter.stop="onNodeLeftClick($event, item)"
      >
        <div class="node-core">
          <div class="node-inner">
            <template v-if="item.skill">
              <img
                :src="item.skill.icon"
                :alt="item.skill.name"
                class="node-icon"
                draggable="false"
              />
            </template>
            <template v-else>
              <div class="gate-empty-emblem">
                <div class="gate-mini-icons">
                  <img
                    v-for="cand in item.candidatePreviews"
                    :key="cand.id"
                    :src="cand.icon"
                    :alt="cand.name"
                    class="gate-mini-img"
                    draggable="false"
                  />
                </div>
                <span class="gate-rule-tag">{{ item.gateHint }}</span>
              </div>
            </template>
          </div>

          <span
            v-if="item.node.kind !== 'normal' && item.skill"
            class="gate-swap-chip"
            title="切换候选技能"
          >
            ⇄
          </span>

          <span
            v-if="item.status === 'locked' && item.node.minBranchPoints > 0"
            class="node-threshold-chip"
          >
            {{ item.node.minBranchPoints }}P
          </span>
        </div>

        <div v-if="item.node.kind === 'normal' || item.points > 0" class="node-lv-pill">
          {{ item.points }}/{{ item.maxPoints }}
        </div>

        <div class="node-caption">
          <span class="node-name-tx">{{ item.titleLabel }}</span>
          <span v-if="store.showXRayBadges && item.xrayText" class="node-xray-pill">
            {{ item.xrayText }}
          </span>
        </div>
      </div>
    </div>

    <!-- Compact Controls Hint -->
    <div class="canvas-legend canvas-hud-stop">
      <span><kbd>左键</kbd>+1</span>
      <span><kbd>Shift+左键</kbd>点满</span>
      <span><kbd>右键</kbd>-1</span>
    </div>

    <!-- Camera Zoom Bar -->
    <div class="canvas-zoom-bar canvas-hud-stop">
      <button type="button" class="zoom-btn" title="缩小" @click="zoomBy(0.86)">−</button>
      <span class="zoom-pct">{{ Math.round(scale * 100) }}%</span>
      <button type="button" class="zoom-btn" title="放大" @click="zoomBy(1.16)">+</button>
      <button type="button" class="zoom-btn reset" @click="fitToView('all', true)">
        居中
      </button>
    </div>
  </section>
</template>

<style scoped>
.skill-canvas-viewport {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg-0);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.skill-canvas-viewport.is-dragging {
  cursor: grabbing;
}

.canvas-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 22% 62%, rgba(31, 255, 118, 0.055) 0%, transparent 45%),
    radial-gradient(circle at 50% 35%, rgba(255, 210, 5, 0.05) 0%, transparent 46%),
    radial-gradient(circle at 78% 62%, rgba(246, 0, 16, 0.055) 0%, transparent 45%),
    radial-gradient(circle at 50% 82%, rgba(95, 255, 255, 0.04) 0%, transparent 48%);
}

.canvas-branch-pills {
  position: absolute;
  top: 14px;
  left: 16px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px;
  border-radius: var(--radius);
  background: rgba(14, 18, 34, 0.86);
  border: 1px solid var(--line-strong);
  backdrop-filter: blur(10px);
}

.focus-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 27px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.focus-pill:hover {
  color: var(--cream);
  background: rgba(255, 255, 255, 0.06);
}

.focus-pill.active {
  color: var(--cream);
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--b-col, var(--c-raider));
}

.pill-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--b-col);
  box-shadow: 0 0 6px var(--b-col);
}

.pill-pts {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--b-col, var(--cream));
}

.world-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}

.world-stage.is-moving {
  will-change: transform;
}

.world-stage.smooth-cam {
  transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.world-svg {
  position: absolute;
  left: 0;
  top: 0;
  pointer-events: none;
  overflow: visible;
}

.conn-path {
  transition: stroke 0.18s ease, opacity 0.18s ease, stroke-width 0.18s ease;
  opacity: 0.42;
}

.conn-path.is-ready {
  opacity: 0.72;
  stroke-dasharray: 7 6;
}

.conn-path.is-active {
  opacity: 0.98;
  filter: drop-shadow(0 0 6px currentColor);
}

.is-dimmed {
  opacity: 0.18 !important;
}

.branch-callout {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.bh-row {
  display: inline-flex;
  align-items: baseline;
  gap: 9px;
}

.bh-zh {
  font-family: var(--font-title);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.05em;
  color: var(--cream);
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.75);
}

.bh-pts {
  font-family: var(--font-mono);
  font-size: 25px;
  font-weight: 800;
  color: var(--b-col);
  text-shadow: 0 0 14px color-mix(in srgb, var(--b-col) 45%, transparent);
}

.skill-node-wrap {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  outline: none;
  z-index: 4;
}

.skill-node-wrap.is-selected {
  z-index: 6;
}

.node-core {
  position: relative;
  width: 58px;
  height: 58px;
  border-radius: 50%;
  background: #131828;
  border: 2.5px solid #4d5368;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.58);
  transition: border-color 0.14s var(--ease), box-shadow 0.14s var(--ease), background-color 0.14s var(--ease);
}

.shape-large-circle .node-core {
  width: 74px;
  height: 74px;
  border-width: 3px;
}

.shape-diamond .node-core {
  width: 62px;
  height: 62px;
  border-radius: 10px;
  transform: rotate(45deg);
  border-width: 2.8px;
}

.node-inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: inherit;
}

.shape-diamond .node-inner {
  transform: rotate(-45deg);
  overflow: visible;
}

.node-icon {
  width: 34px;
  height: 34px;
  object-fit: contain;
  opacity: 0.45;
  filter: grayscale(0.4) brightness(0.95);
}

.shape-large-circle .node-icon {
  width: 44px;
  height: 44px;
}

.shape-diamond .node-icon {
  width: 38px;
  height: 38px;
}

.status-available .node-core {
  border-color: color-mix(in srgb, var(--n-col) 68%, #ffffff);
  background: #182034;
  box-shadow: 0 0 14px color-mix(in srgb, var(--n-col) 24%, transparent);
}

.status-available .node-icon {
  opacity: 0.9;
  filter: none;
}

.status-partial .node-core {
  border-color: var(--n-col);
  background: color-mix(in srgb, var(--n-col) 16%, #121728);
  box-shadow: 0 0 18px color-mix(in srgb, var(--n-col) 38%, transparent);
}

.status-partial .node-icon {
  opacity: 1;
}

.status-maxed .node-core {
  border-color: var(--n-col);
  background: color-mix(in srgb, var(--n-col) 28%, #101524);
  box-shadow:
    0 0 0 2px rgba(9, 12, 25, 0.85),
    0 0 22px color-mix(in srgb, var(--n-col) 55%, transparent);
}

.status-maxed .node-icon {
  opacity: 1;
  filter: brightness(1.1) drop-shadow(0 0 6px color-mix(in srgb, var(--n-col) 55%, transparent));
}

.skill-node-wrap:hover .node-core {
  border-color: color-mix(in srgb, var(--n-col) 76%, var(--cream));
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--n-col) 34%, transparent),
    0 6px 18px rgba(0, 0, 0, 0.64);
}

.skill-node-wrap:hover .node-name-tx {
  color: var(--cream);
}

.skill-node-wrap.is-selected .node-core {
  box-shadow:
    0 0 0 3px var(--bg-0),
    0 0 0 5px var(--cream),
    0 0 24px color-mix(in srgb, var(--n-col) 55%, transparent);
}

.gate-empty-emblem {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.gate-mini-icons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1px;
}

.gate-mini-img {
  width: 17px;
  height: 17px;
  object-fit: contain;
  opacity: 0.78;
}

.gate-rule-tag {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 800;
  color: var(--cream);
  background: rgba(9, 12, 25, 0.88);
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.gate-swap-chip {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: var(--bg-0);
  border: 1.5px solid var(--n-col);
  color: var(--n-col);
  font-size: 11px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: rotate(-45deg);
}

.node-threshold-chip {
  position: absolute;
  top: -10px;
  right: -10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: #0b0f1e;
  border: 1px solid #606576;
  color: var(--tx-2);
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 800;
  transform: rotate(-45deg);
}

.node-lv-pill {
  margin-top: -8px;
  padding: 1px 7px;
  border-radius: 999px;
  background: #0b0e1b;
  border: 1px solid #4d5368;
  color: var(--tx-2);
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 800;
  line-height: 1.3;
  z-index: 2;
}

.status-partial .node-lv-pill,
.status-maxed .node-lv-pill {
  border-color: var(--n-col);
  color: var(--n-col);
}

.shape-diamond .node-lv-pill {
  margin-top: 4px;
}

.node-caption {
  position: absolute;
  top: calc(100% + 3px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: max-content;
  max-width: 124px;
  cursor: pointer;
}

.node-name-tx {
  font-family: var(--font-body);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--tx-2);
  text-align: center;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95), 0 0 8px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
}

.status-partial .node-name-tx,
.status-maxed .node-name-tx,
.is-selected .node-name-tx {
  color: var(--cream);
}

.node-xray-pill {
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.88);
  border: 1px solid rgba(164, 165, 170, 0.24);
  color: var(--c-raider);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.25;
  white-space: nowrap;
}

.status-partial .node-xray-pill,
.status-maxed .node-xray-pill {
  border-color: color-mix(in srgb, var(--n-col) 58%, transparent);
  color: var(--n-col);
  background: rgba(9, 12, 25, 0.94);
}

.canvas-legend {
  position: absolute;
  left: 16px;
  bottom: 14px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 10px;
  border-radius: var(--radius);
  background: rgba(14, 18, 34, 0.84);
  border: 1px solid var(--line);
  backdrop-filter: blur(8px);
  font-size: 11px;
  color: var(--tx-3);
}

.canvas-legend kbd {
  padding: 1px 5px;
  margin-right: 3px;
  border-radius: 3px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  color: var(--cream-2);
  font-family: var(--font-mono);
  font-size: 10px;
}

.canvas-zoom-bar {
  position: absolute;
  right: 16px;
  bottom: 14px;
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius);
  background: rgba(14, 18, 34, 0.88);
  border: 1px solid var(--line-strong);
  backdrop-filter: blur(8px);
}

.zoom-btn {
  height: 27px;
  min-width: 27px;
  padding: 0 8px;
  border-radius: var(--radius-sm);
  border: 1px solid transparent;
  background: var(--bg-2);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}

.zoom-btn:hover {
  border-color: var(--c-raider);
  color: var(--c-raider);
}

.zoom-btn.reset {
  font-size: 11.5px;
}

.zoom-pct {
  min-width: 42px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--tx-2);
}
</style>
