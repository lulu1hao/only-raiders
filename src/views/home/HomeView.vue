<script setup>
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import gsap from 'gsap'

const router = useRouter()

const stageRef = ref(null)
const svgRef = ref(null)
const hoveredStripe = ref(null)
const introDone = ref(false)
let tl = null
let lastPointerPos = null

// All 4 iconic stripes (0: Red, 1: Yellow, 2: Green, 3: Cyan curved) act as interactive navigation tracks
const stripeModules = [
  {
    idx: 0,
    id: 'weapons',
    code: '01',
    title: '武器',
    chars: ['武', '器'],
    en: 'WEAPONS',
    count: 26,
    path: '/weapons/workbench',
    coreColor: '#FF0000',
    leftRimColor: '#D00000',
    rightRimColor: '#C82451',
    coreD: 'M-7.893-90L70.799 58',
    leftRimD: 'M-11.798-90L66.894 58',
    rightRimD: 'M-3.988-90L74.704 58',
    cx: 30.39,
    cy: -18,
    textColor: '#F9EEDF',
    badgeBg: '#090C19',
    badgeFg: '#F9EEDF',
  },
  {
    idx: 1,
    id: 'quests',
    code: '02',
    title: '任务',
    chars: ['任', '务'],
    en: 'QUESTS',
    count: 123,
    path: '/quests/archive',
    coreColor: '#FFEA00',
    leftRimColor: '#FF5600',
    rightRimColor: '#E6A34C',
    coreD: 'M-19.253-90L59.439 58',
    leftRimD: 'M-23.158-90L55.534 58',
    rightRimD: 'M-15.348-90L63.344 58',
    cx: 19.03,
    cy: -18,
    textColor: '#090C19',
    badgeBg: '#090C19',
    badgeFg: '#FFEA00',
  },
  {
    idx: 2,
    id: 'maps',
    code: '03',
    title: '地图',
    chars: ['地', '图'],
    en: 'MAPS',
    count: 7,
    path: '/maps',
    coreColor: '#05FF74',
    leftRimColor: '#00A900',
    rightRimColor: '#57BB7C',
    coreD: 'M-30.615-90L48.077 58',
    leftRimD: 'M-34.520-90L44.172 58',
    rightRimD: 'M-26.710-90L51.982 58',
    cx: 7.67,
    cy: -18,
    textColor: '#090C19',
    badgeBg: '#090C19',
    badgeFg: '#05FF74',
  },
  {
    idx: 3,
    id: 'raider',
    code: '04',
    title: '奇袭者',
    chars: ['奇', '袭', '者'],
    en: 'RAIDER',
    count: 48,
    path: '/raider',
    curved: true,
    coreColor: '#5FFFFF',
    leftRimColor: '#0093ED',
    rightRimColor: '#75B8DD',
    coreD: 'M-32.403-72L-2.129-15.062C9.35 6.527 14.861 29.095 15.292 51.166',
    leftRimD: 'M-36.308-72L-5.173-13.443C3.681 3.209 9.069 20.95 11.014 38.906',
    rightRimD: 'M-28.499-72L.915-16.681C12.394 4.908 17.905 27.476 18.336 49.547',
    cx: -3.691,
    cy: -18,
    textColor: '#090C19',
    badgeBg: '#090C19',
    badgeFg: '#5FFFFF',
  },
]

// Slope dx/dy of the straight stripes: 61.678 / 116 = 0.531707
const STRIPE_SLOPE = 61.678 / 116
const IDLE_CORE_WIDTH = 6.896
// Narrowed by ~40%: hovered core width = 13.8 (Δw_perp = 6.904 -> ΔX = 7.82 -> half = 3.91)
const HOVER_CORE_WIDTH = 13.8
const HALF_EXPAND_X = 3.91

// Pure SVG geometry animation state (zero CSS opacity/transform transitions -> zero Chromium Overlap layer churn)
const anim = reactive({
  shift0: 0,
  shift1: 0,
  shift2: 0,
  shift3: 0,
  rimExp0: 0,
  rimExp1: 0,
  rimExp2: 0,
  rimExp3: 0,
  coreW0: IDLE_CORE_WIDTH,
  coreW1: IDLE_CORE_WIDTH,
  coreW2: IDLE_CORE_WIDTH,
  coreW3: IDLE_CORE_WIDTH,
  contentOp0: 0,
  contentOp1: 0,
  contentOp2: 0,
  contentOp3: 0,
  logoShift: 0,
  wordX0: 0,
  wordX1: 0,
  wordOp0: 1,
  wordOp1: 1,
})

function targetGroupShift(lineIdx, h) {
  if (h === null) return 0
  if (lineIdx > h) return -HALF_EXPAND_X
  if (lineIdx < h) return HALF_EXPAND_X
  return 0
}

watch(hoveredStripe, (h) => {
  gsap.to(anim, {
    shift0: targetGroupShift(0, h),
    shift1: targetGroupShift(1, h),
    shift2: targetGroupShift(2, h),
    shift3: targetGroupShift(3, h),
    rimExp0: h === 0 ? HALF_EXPAND_X : 0,
    rimExp1: h === 1 ? HALF_EXPAND_X : 0,
    rimExp2: h === 2 ? HALF_EXPAND_X : 0,
    rimExp3: h === 3 ? HALF_EXPAND_X : 0,
    coreW0: h === 0 ? HOVER_CORE_WIDTH : IDLE_CORE_WIDTH,
    coreW1: h === 1 ? HOVER_CORE_WIDTH : IDLE_CORE_WIDTH,
    coreW2: h === 2 ? HOVER_CORE_WIDTH : IDLE_CORE_WIDTH,
    coreW3: h === 3 ? HOVER_CORE_WIDTH : IDLE_CORE_WIDTH,
    contentOp0: h === 0 ? 1 : 0,
    contentOp1: h === 1 ? 1 : 0,
    contentOp2: h === 2 ? 1 : 0,
    contentOp3: h === 3 ? 1 : 0,
    logoShift: h !== null ? HALF_EXPAND_X : 0,
    duration: 0.3,
    ease: 'power3.out',
    overwrite: 'auto',
  })
})

function stripeBaseCenterX(m, sy) {
  if (m.curved) return cyanCenterX(sy)
  return m.cx + (sy - m.cy) * STRIPE_SLOPE
}

// Schmitt-trigger geometric hit testing in static SVG space (prevents shifted-stripe hover oscillation)
function resolveHoveredStripeAtSvg(sx, sy) {
  if (sy < -70 || sy > 36) return null

  const cur = hoveredStripe.value
  if (cur !== null) {
    const cm = stripeModules[cur]
    if (cm && (!cm.curved || sy <= 50)) {
      if (Math.abs(sx - stripeBaseCenterX(cm, sy)) <= 8.15) {
        return cur
      }
    }
  }

  let bestIdx = null
  let bestDist = 5.75
  for (const m of stripeModules) {
    if (m.curved && sy > 50) continue
    const d = Math.abs(sx - stripeBaseCenterX(m, sy))
    if (d <= bestDist) {
      bestDist = d
      bestIdx = m.idx
    }
  }
  return bestIdx
}

function updateHoverFromClientPoint(clientX, clientY) {
  const svgEl = svgRef.value
  if (!svgEl || !svgEl.getScreenCTM) return
  const ctm = svgEl.getScreenCTM()
  if (!ctm) return
  const inv = ctm.inverse()
  const sx = clientX * inv.a + clientY * inv.c + inv.e
  const sy = clientX * inv.b + clientY * inv.d + inv.f
  const next = resolveHoveredStripeAtSvg(sx, sy)
  if (hoveredStripe.value !== next) {
    hoveredStripe.value = next
  }
}

function onStagePointerMove(e) {
  lastPointerPos = { x: e.clientX, y: e.clientY }
  if (!introDone.value) return
  updateHoverFromClientPoint(e.clientX, e.clientY)
}

function onStagePointerLeave() {
  lastPointerPos = null
  hoveredStripe.value = null
}

function onStageClick() {
  if (hoveredStripe.value !== null) {
    const m = stripeModules[hoveredStripe.value]
    if (m) {
      router.push(m.path)
      return
    }
  }
  playIntro()
}

// Exact centerline X along the curved Cyan stripe (linear above y=-15.062, cubic Bezier below)
function cyanCenterX(y) {
  if (y <= -15.062) {
    return -32.403 + (y + 72) * ((-2.129 - -32.403) / (-15.062 - -72))
  }
  let lo = 0
  let hi = 1
  for (let i = 0; i < 10; i++) {
    const t = (lo + hi) * 0.5
    const u = 1 - t
    const by =
      u * u * u * -15.062 +
      3 * u * u * t * 6.527 +
      3 * u * t * t * 29.095 +
      t * t * t * 51.166
    if (by < y) lo = t
    else hi = t
  }
  const t = (lo + hi) * 0.5
  const u = 1 - t
  return (
    u * u * u * -2.129 +
    3 * u * u * t * 9.35 +
    3 * u * t * t * 14.861 +
    t * t * t * 15.292
  )
}

// Compute coordinates along a stripe's centerline at a vertical offset dy from cy (-18)
function stripePt(m, dy) {
  const y = m.cy + dy
  if (m.curved) {
    return { x: cyanCenterX(y), y }
  }
  return {
    x: m.cx + dy * STRIPE_SLOPE,
    y,
  }
}

function stripeBadgeTopDy(m) {
  return m.chars.length === 3 ? -16.2 : -12.6
}

function stripeBadgeBotDy(m) {
  return m.chars.length === 3 ? 16.2 : 12.6
}

function stripeCharDy(m, charIdx) {
  if (m.chars.length === 3) {
    return (charIdx - 1) * 7.6
  }
  return charIdx === 0 ? -4.0 : 4.0
}

function handleStripeClick(m) {
  router.push(m.path)
}

function playIntro() {
  const root = stageRef.value
  if (!root) return

  hoveredStripe.value = null
  introDone.value = false

  if (tl) {
    tl.kill()
  }

  // Group paths by line index (0: Red, 1: Yellow, 2: Green, 3: Cyan)
  const lineGroups = [0, 1, 2, 3].map((idx) =>
    Array.from(root.querySelectorAll(`[data-line="${idx}"]`)),
  )

  lineGroups.flat().forEach((path) => {
    const len = path.getTotalLength ? path.getTotalLength() : 160
    gsap.set(path, {
      strokeDasharray: len,
      strokeDashoffset: len,
      opacity: 1,
    })
  })

  anim.wordX0 = -24
  anim.wordX1 = -24
  anim.wordOp0 = 0
  anim.wordOp1 = 0

  tl = gsap.timeline({
    defaults: { overwrite: 'auto' },
    onComplete: () => {
      introDone.value = true
      // Clear dasharray after intro so stroke-width transitions cleanly without dash artifacts
      lineGroups.flat().forEach((path) => {
        gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' })
      })
      if (lastPointerPos) {
        updateHoverFromClientPoint(lastPointerPos.x, lastPointerPos.y)
      }
    },
  })

  // 1. 3 straight lines + 1 angled line emerge from the top and extend downward to completion
  lineGroups.forEach((group, idx) => {
    tl.to(
      group,
      {
        strokeDashoffset: 0,
        duration: 0.85,
        ease: 'power3.inOut',
      },
      idx * 0.08,
    )
  })

  // 2. Reveal Only Raiders logo emerging from behind the Red stripe occlusion plane using pure SVG attributes
  tl.to(
    anim,
    {
      wordX0: 0,
      wordOp0: 1,
      duration: 0.56,
      ease: 'power3.out',
    },
    '-=0.32',
  )
  tl.to(
    anim,
    {
      wordX1: 0,
      wordOp1: 1,
      duration: 0.56,
      ease: 'power3.out',
    },
    '-=0.48',
  )
}

onMounted(() => {
  playIntro()
})

onBeforeUnmount(() => {
  if (tl) tl.kill()
})
</script>

<template>
  <main ref="stageRef" class="page-viewport home-stage">
    <!-- Full-Stage ARC Raiders style interactive rainbow lines + Only Raiders diagonally occluded logo -->
    <div
      class="stage-lines"
      :class="{ 'has-hover': hoveredStripe !== null }"
      :title="hoveredStripe !== null ? stripeModules[hoveredStripe]?.title : '点击空白处重播动效'"
      @pointermove="onStagePointerMove"
      @pointerleave="onStagePointerLeave"
      @click="onStageClick"
    >
      <svg
        ref="svgRef"
        class="ar-lines-svg"
        viewBox="-38 -68 192 100"
        preserveAspectRatio="xMinYMid slice"
        fill="none"
        shape-rendering="geometricPrecision"
        text-rendering="geometricPrecision"
        aria-label="Only Raiders"
      >
        <defs>
          <clipPath id="clip-stage-lines">
            <rect x="-38" y="-68" width="192" height="100" />
          </clipPath>
          <!-- Diagonal occlusion plane parallel to the Red stripe's right edge (slope dx/dy = 61.678/116) -->
          <clipPath id="clip-logo-occlusion">
            <polygon points="9.76,-70 240,-70 240,40 68.25,40" />
          </clipPath>
        </defs>

        <g clip-path="url(#clip-stage-lines)">
          <!-- Interactive Stripes 0..3: Red (武器), Yellow (任务), Green (地图), Cyan (奇袭者) -->
          <g
            v-for="m in stripeModules"
            :key="m.id"
            class="stripe-track stripe-interactive"
            :class="[{ 'is-hovered': hoveredStripe === m.idx }, `stripe-${m.id}`]"
            :transform="`translate(${anim['shift' + m.idx]}, 0)`"
            role="button"
            tabindex="0"
            :aria-label="`${m.title} (${m.en})`"
            @focus="introDone && (hoveredStripe = m.idx)"
            @blur="hoveredStripe === m.idx && (hoveredStripe = null)"
            @keydown.enter.stop="handleStripeClick(m)"
          >
            <!-- Left Rim -->
            <path
              :data-line="m.idx"
              class="stripe-rim"
              :transform="`translate(${-anim['rimExp' + m.idx]}, 0)`"
              :stroke="m.leftRimColor"
              stroke-width="1.254"
              :d="m.leftRimD"
            />

            <!-- Right Rim -->
            <path
              :data-line="m.idx"
              class="stripe-rim"
              :transform="`translate(${anim['rimExp' + m.idx]}, 0)`"
              :stroke="m.rightRimColor"
              stroke-width="1.254"
              :d="m.rightRimD"
            />

            <!-- Expanding Core Stripe -->
            <path
              :data-line="m.idx"
              class="stripe-core"
              :stroke="m.coreColor"
              :stroke-width="anim['coreW' + m.idx]"
              :d="m.coreD"
            />

            <!-- In-Stripe Button Content (driven via SVG opacity attribute to prevent Chromium Overlap layer churn) -->
            <g
              v-show="anim['contentOp' + m.idx] > 0.01"
              class="stripe-content"
              :opacity="anim['contentOp' + m.idx]"
              :style="{ '--st-fg': m.textColor }"
            >
              <!-- Top Tactical Code Badge along stripe centerline -->
              <g
                :transform="`translate(${stripePt(m, stripeBadgeTopDy(m)).x}, ${stripePt(m, stripeBadgeTopDy(m)).y})`"
              >
                <rect
                  x="-4.1"
                  y="-2.4"
                  width="8.2"
                  height="4.0"
                  rx="1.1"
                  :fill="m.badgeBg"
                />
                <text
                  x="0"
                  y="0.4"
                  text-anchor="middle"
                  class="stripe-code-tx"
                  :fill="m.badgeFg"
                >
                  {{ m.code }}
                </text>
              </g>

              <!-- Chinese Characters along stripe centerline (武/器, 任/务, 地/图, 奇/袭/者) -->
              <text
                v-for="(ch, cIdx) in m.chars"
                :key="cIdx"
                :x="stripePt(m, stripeCharDy(m, cIdx)).x"
                :y="stripePt(m, stripeCharDy(m, cIdx)).y + (m.chars.length === 3 ? 2.1 : 2.3)"
                text-anchor="middle"
                class="stripe-char-tx"
                :class="{ 'is-tri': m.chars.length === 3 }"
                :fill="m.textColor"
              >
                {{ ch }}
              </text>

              <!-- Bottom Action Arrow Badge along stripe centerline -->
              <g
                :transform="`translate(${stripePt(m, stripeBadgeBotDy(m)).x}, ${stripePt(m, stripeBadgeBotDy(m)).y})`"
              >
                <circle cx="0" cy="0" r="2.6" :fill="m.badgeBg" />
                <path
                  d="M-0.7 -1.15L0.85 0L-0.7 1.15"
                  fill="none"
                  :stroke="m.badgeFg"
                  stroke-width="0.75"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </g>
            </g>
          </g>

          <!-- ARC Raiders Diagonal-Occluded Wordmark: Only / Raiders (animated via SVG attribute, no CSS layer blur) -->
          <g
            class="ar-logo-lockup"
            :transform="`translate(${anim.logoShift}, 0)`"
          >
            <g clip-path="url(#clip-logo-occlusion)">
              <g :transform="`translate(${anim.wordX0}, 0)`" :opacity="anim.wordOp0">
                <text x="26.6" y="-23.5" class="logo-svg-only">Only</text>
              </g>
              <g :transform="`translate(${anim.wordX1}, 0)`" :opacity="anim.wordOp1">
                <text x="40.0" y="-0.8" class="logo-svg-raiders">
                  <tspan class="logo-r-cap">R</tspan><tspan class="logo-aiders-low">aiders</tspan>
                </text>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  </main>
</template>

<style scoped>
.home-stage {
  position: relative;
  width: 100%;
  height: calc(100vh - var(--topbar-h, 56px));
  background: var(--bg-0);
  user-select: none;
  overflow: hidden;
}

.stage-lines {
  position: relative;
  z-index: 1;
  height: 100%;
  width: 100%;
}

.ar-lines-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
}

.stage-lines.has-hover {
  cursor: pointer;
}

/* ---------- Interactive Stripe Tracks ---------- */
.stripe-interactive {
  outline: none;
}

.stripe-content {
  pointer-events: none;
}

.stripe-code-tx {
  font-family: var(--font-mono);
  font-size: 2.45px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.stripe-char-tx {
  font-family: var(--font-title);
  font-size: 6.4px;
  font-weight: 900;
  letter-spacing: 0.02em;
}

.stripe-char-tx.is-tri {
  font-size: 5.9px;
}

/* ---------- Only Raiders Logo Lockup ---------- */
.logo-svg-only {
  font-family: 'Urbanist', 'Prompt', sans-serif;
  font-size: 28px;
  font-weight: 900;
  fill: var(--cream);
  letter-spacing: -0.045em;
  text-rendering: geometricPrecision;
}

.logo-svg-raiders {
  font-size: 26.5px;
  font-weight: 900;
  fill: var(--cream);
  stroke: var(--bg-0);
  stroke-width: 1.5px;
  stroke-linejoin: round;
  paint-order: stroke fill;
  letter-spacing: -0.04em;
  text-rendering: geometricPrecision;
}

.logo-r-cap {
  font-family: 'Prompt', sans-serif;
  font-weight: 800;
}

.logo-aiders-low {
  font-family: 'Urbanist', sans-serif;
  font-weight: 900;
  letter-spacing: -0.045em;
}
</style>
