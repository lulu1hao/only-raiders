<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMapsStore } from '../../stores/useMapsStore'
import { assetUrl } from '../../utils/assetUrl'
import RotationCountdownText from '../../components/common/RotationCountdownText.vue'

// Lazy-loaded on demand ONLY when the user clicks "3D 视图"
let THREE = null
let GLTFLoaderClass = null
let MeshoptDecoderRef = null

const route = useRoute()
const router = useRouter()
const mapsStore = useMapsStore()

// UI Overlay State (Screenshot 2 & Screenshot 3)
const isCardOpen = ref(false)
const showLocationList = ref(false)
const showServerMenu = ref(false)
const showScheduleDrawer = ref(false)

// 3D Mode State: Default off unless previously enabled and persisted by the user
const is3DMode = ref(Boolean(mapsStore.worldMap3DEnabled))
const is3DLoading = ref(false)
const is3DReady = ref(false)

// Exact 3D Surface Coordinates on SM_FrontEndMap_01.glb (matched 1:1 with SM_LightTrail_01.glb endpoints)
// SM_FrontEndMap_01 terrain bounds: X in [-0.001, 3.039], Y in [-1.935, 1.105], Z in [0.002, 0.284]
// Board center is (1.519, -0.415, 0.04)
const NODE_3D_COORDS = {
  'pendola-pass': { x: 2.115, y: 0.475, z: 0.185 },
  spaceport: { x: 0.802, y: -0.495, z: 0.036 },
  'stella-montis': { x: 2.136, y: -0.369, z: 0.092 },
  'blue-gate': { x: 2.105, y: -0.878, z: 0.048 },
  'dam-battlegrounds': { x: 1.558, y: -1.106, z: 0.048 },
  'buried-city': { x: 0.595, y: -0.915, z: 0.026 },
  'riven-tides': { x: 0.365, y: -1.392, z: 0.02 },
}

// Practice Range (靶场) pill shown in the center of Screenshot 3
const PRACTICE_RANGE_3D = { x: 1.72, y: -0.645, z: 0.072 }

// Projected 2D screen coordinates (updated from 2D mathematical projection or 3D PerspectiveCamera)
const projectedNodes = reactive({})
const projectedPractice = reactive({ x: -999, y: -999, visible: false })
const board2DStyle = reactive({
  left: '0px',
  top: '0px',
  width: '0px',
  height: '0px',
})

// Viewport & Camera Pan/Zoom State
const stageRef = ref(null)
const canvasWrapRef = ref(null)
const isPanning = ref(false)
const dragMoved = ref(false)
const panStart = ref({ x: 0, y: 0 })

// Board center in SM_FrontEndMap_01 local space
const BOARD_CENTER = { x: 1.519, y: -0.415, z: 0.04 }
const OVERVIEW_DIST = 4.68 // Fits the 3.14m × 3.14m framed relief board top-to-bottom like Screenshot 3

const camTarget = reactive({
  x: BOARD_CENTER.x,
  y: BOARD_CENTER.y,
  dist: OVERVIEW_DIST,
})
const camCurrent = {
  x: BOARD_CENTER.x,
  y: BOARD_CENTER.y,
  dist: OVERVIEW_DIST,
}

const isZoomed = computed(() => camTarget.dist < OVERVIEW_DIST - 0.15)

const activeStateByMap = computed(() => {
  const dict = {}
  for (const m of mapsStore.maps) {
    dict[m.id] = mapsStore.getActiveStateForMap(m.id)
  }
  return dict
})

const previewMap = computed(() => mapsStore.getMapById(mapsStore.previewMapId))
const previewActiveState = computed(
  () =>
    activeStateByMap.value[previewMap.value.id] ||
    mapsStore.getActiveStateForMap(previewMap.value.id),
)
const previewUpcoming = computed(() => mapsStore.getUpcomingSchedule(previewMap.value.id, 8))

// Smoothly focus/zoom the camera onto a target node (Screenshot 2)
function focusOnMapNode(mapObj) {
  if (!mapObj) return
  const pos3d = NODE_3D_COORDS[mapObj.id] || BOARD_CENTER
  // Shift camera slightly to the right (+0.26m) so the selected node sits to the left of the Cream Card
  camTarget.x = Math.max(0.45, Math.min(2.6, pos3d.x + 0.26))
  camTarget.y = Math.max(-1.45, Math.min(0.65, pos3d.y - 0.04))
  camTarget.dist = 2.45
  scheduleCameraStep()
}

function resetOverview() {
  isCardOpen.value = false
  showScheduleDrawer.value = false
  camTarget.x = BOARD_CENTER.x
  camTarget.y = BOARD_CENTER.y
  camTarget.dist = OVERVIEW_DIST
  scheduleCameraStep()
}

function handleNodeClick(mapId) {
  if (isCardOpen.value && mapsStore.previewMapId === mapId) {
    enterDetailedMap(mapId)
    return
  }
  mapsStore.previewMapId = mapId
  isCardOpen.value = true
  showLocationList.value = false
  showServerMenu.value = false
  focusOnMapNode(mapsStore.getMapById(mapId))
}

function selectFromLocationList(mapId) {
  mapsStore.previewMapId = mapId
  isCardOpen.value = true
  showLocationList.value = false
  focusOnMapNode(mapsStore.getMapById(mapId))
}

function enterDetailedMap(mapId, options = {}) {
  mapsStore.previewMapId = mapId
  if (options.eventId) {
    mapsStore.setManualEvent(mapId, options.eventId)
  }
  const query = {}
  const qId = options.questId || route.query.quest || mapsStore.trackedQuestId
  if (qId) query.quest = qId
  if (options.eventId) query.event = options.eventId
  router.push({
    name: 'maps-detail',
    params: { mapId },
    query,
  })
}

function isQuestTargetedMap(mapId) {
  const tq = mapsStore.trackedQuest
  if (!tq) return false
  if (!tq.mapIds || tq.mapIds.length === 0) return true
  return tq.mapIds.includes(mapId)
}

function onWheel(e) {
  e.preventDefault()
  const delta = e.deltaY > 0 ? 0.38 : -0.38
  const nextDist = Math.max(1.75, Math.min(OVERVIEW_DIST, +(camTarget.dist + delta).toFixed(2)))
  camTarget.dist = nextDist
  if (nextDist >= OVERVIEW_DIST - 0.05) {
    camTarget.x = BOARD_CENTER.x
    camTarget.y = BOARD_CENTER.y
  }
  scheduleCameraStep()
}

function onPointerDown(e) {
  if (e.button !== 0) return
  dragMoved.value = false
  if (
    e.target.closest(
      '.ingame-node, .ingame-dest-card, .ingame-hud-bl, .ingame-bottom-bar, .wc-quest-banner',
    )
  ) {
    return
  }
  isPanning.value = true
  panStart.value = { x: e.clientX, y: e.clientY }
}

function onPointerMove(e) {
  if (!isPanning.value) return
  const dx = e.clientX - panStart.value.x
  const dy = e.clientY - panStart.value.y
  if (Math.hypot(dx, dy) > 4) {
    dragMoved.value = true
  }
  panStart.value = { x: e.clientX, y: e.clientY }

  const el = stageRef.value
  const h = el ? el.clientHeight : 900
  // Convert pixel delta to meters at current camera distance
  const worldPerPixel = (2 * camCurrent.dist * Math.tan((38 * Math.PI) / 360)) / h
  camTarget.x = Math.max(0.25, Math.min(2.8, camTarget.x - dx * worldPerPixel))
  camTarget.y = Math.max(-1.65, Math.min(0.85, camTarget.y + dy * worldPerPixel))
  scheduleCameraStep()
}

function onPointerUp(e) {
  if (isPanning.value && !dragMoved.value) {
    if (
      isCardOpen.value &&
      !e.target.closest(
        '.ingame-node, .ingame-dest-card, .ingame-hud-bl, .ingame-bottom-bar, .wc-quest-banner',
      )
    ) {
      resetOverview()
    }
    showLocationList.value = false
    showServerMenu.value = false
  }
  isPanning.value = false
  dragMoved.value = false
}

function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (showLocationList.value || showServerMenu.value) {
      showLocationList.value = false
      showServerMenu.value = false
    } else if (isCardOpen.value || isZoomed.value) {
      resetOverview()
    }
  }
}

// ============================================================================
// On-Demand Three.js Real-Time 3D Calabretta Relief Diorama + Fast 2D Projection
// ============================================================================
let renderer = null
let scene = null
let camera = null
let rafId = 0
let stageRo = null
let trailShaderMat = null
let tmpVec = null
let threeClock = null

function createLightDotsShaderMaterial() {
  // Replicates PioneerGame's M_FrontEndMap_LightDots / MI_FrontEndMap_LightDots
  // TEXCOORD_0.x = phase along trail, TEXCOORD_1 (uv1) = [0..1, 0..1] quad corner UV
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color('#fff6e5') },
      uColorGlow: { value: new THREE.Color('#ffae19') },
    },
    vertexShader: `
      attribute vec2 uv1;
      varying vec2 vUv0;
      varying vec2 vUv1;
      void main() {
        vUv0 = uv;
        vUv1 = uv1;
        // Lift 3mm along Z so glowing dots never Z-fight with the relief terrain
        vec3 lifted = position + vec3(0.0, 0.0, 0.0035);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(lifted, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColorCore;
      uniform vec3 uColorGlow;
      varying vec2 vUv0;
      varying vec2 vUv1;
      void main() {
        vec2 c = vUv1 - vec2(0.5);
        float dist = length(c) * 2.0;
        if (dist > 1.0) discard;
        float core = smoothstep(0.55, 0.0, dist);
        float halo = pow(clamp(1.0 - dist, 0.0, 1.0), 1.85);
        float wave = 0.78 + 0.22 * sin(vUv0.x * 28.0 - uTime * 2.6);
        vec3 col = mix(uColorGlow, uColorCore, core);
        float alpha = (halo * 0.85 + core * 0.45) * wave;
        gl_FragColor = vec4(col * (1.25 * wave), clamp(alpha, 0.0, 1.0));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

// Build extra 3D glowing dot quads from Stella Montis ridge up to Pendola Pass snow peak
function createPendolaTrailMesh(material) {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1.891, -0.225, 0.076),
    new THREE.Vector3(1.94, 0.02, 0.115),
    new THREE.Vector3(2.02, 0.25, 0.152),
    new THREE.Vector3(2.115, 0.475, 0.186),
  ])
  const dotCount = 26
  const size = 0.0082
  const positions = []
  const uvs = []
  const uv1s = []
  const indices = []

  for (let i = 0; i < dotCount; i++) {
    const t = i / (dotCount - 1)
    const p = curve.getPoint(t)
    const baseIdx = i * 4
    positions.push(
      p.x + size, p.y - size, p.z,
      p.x + size, p.y + size, p.z,
      p.x - size, p.y + size, p.z,
      p.x - size, p.y - size, p.z,
    )
    uvs.push(t, 0, t, 0, t, 0, t, 0)
    uv1s.push(0, 1, 1, 1, 1, 0, 0, 0)
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3)
  }

  const geom = new THREE.BufferGeometry()
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geom.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1s, 2))
  geom.setIndex(indices)
  return new THREE.Mesh(geom, material)
}

// Build Speranza War Room Wall & Sticky Notes around the 3D Map Frame (Matches Screenshot 3)
function buildWarRoomBackdrop(texLoader, disposables) {
  const group = new THREE.Group()

  // Dark Speranza concrete/plaster wall behind the map frame (Z = -0.022)
  const wallGeom = new THREE.PlaneGeometry(11.0, 6.5)
  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#14171c'),
    roughness: 0.92,
    metalness: 0.05,
  })
  const wallMesh = new THREE.Mesh(wallGeom, wallMat)
  wallMesh.position.set(BOARD_CENTER.x, BOARD_CENTER.y, -0.022)
  wallMesh.receiveShadow = true
  group.add(wallMesh)

  // Subtle drop-shadow backing directly behind the 3.15m × 3.14m frame
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.32, 3.32),
    new THREE.MeshBasicMaterial({
      color: 0x020305,
      transparent: true,
      opacity: 0.72,
    }),
  )
  shadowPlane.position.set(BOARD_CENTER.x, BOARD_CENTER.y, -0.019)
  group.add(shadowPlane)

  // Sticky notes clusters on the left & right war-room walls (like Screenshot 3)
  const postItTex = texLoader.load(assetUrl('game-maps/world-3d/T_PostIt_01_C.jpg'))
  postItTex.colorSpace = THREE.SRGBColorSpace
  disposables?.push(postItTex)

  const noteColors = ['#c9a648', '#b8943c', '#d4b359', '#9e7f32', '#c28b42']
  // Left wall notes (X in [-0.78, -0.14]) & Right wall notes (X in [3.20, 3.92])
  const notePlacements = [
    // Left wall cluster
    [-0.24, 0.36, 0.08], [-0.34, 0.33, -0.05], [-0.46, 0.25, 0.04],
    [-0.22, 0.14, -0.06], [-0.36, 0.08, 0.07], [-0.52, -0.02, -0.04],
    [-0.64, -0.06, 0.09], [-0.25, -0.18, 0.03], [-0.39, -0.22, -0.08],
    [-0.19, -0.35, -0.03], [-0.31, -0.44, 0.06], [-0.48, -0.38, -0.05],
    [-0.62, -0.46, 0.04], [-0.23, -0.62, 0.05], [-0.38, -0.68, -0.07],
    [-0.54, -0.74, 0.03], [-0.28, -0.86, -0.04], [-0.44, -0.92, 0.08],
    [-0.68, -0.82, -0.06], [-0.74, -0.96, 0.05],
    // Right wall cluster
    [3.24, 0.28, -0.05], [3.36, 0.24, 0.07], [3.49, 0.18, -0.04],
    [3.28, 0.06, 0.04], [3.42, 0.02, -0.08], [3.58, -0.04, 0.06],
    [3.72, -0.09, -0.05], [3.22, -0.16, -0.03], [3.35, -0.22, 0.05],
    [3.51, -0.26, -0.07], [3.66, -0.29, 0.04], [3.82, -0.21, -0.06],
    [3.26, -0.42, 0.06], [3.41, -0.48, -0.04], [3.56, -0.44, 0.08],
    [3.71, -0.52, -0.05], [3.32, -0.66, -0.06], [3.48, -0.72, 0.05],
    [3.64, -0.68, -0.04], [3.79, -0.76, 0.07],
  ]

  const noteGeom = new THREE.PlaneGeometry(0.095, 0.095)
  notePlacements.forEach(([nx, ny, rot], idx) => {
    const mat = new THREE.MeshStandardMaterial({
      map: postItTex,
      color: new THREE.Color(noteColors[idx % noteColors.length]),
      roughness: 0.85,
      metalness: 0.02,
    })
    const m = new THREE.Mesh(noteGeom, mat)
    m.position.set(nx, ny, -0.016 + (idx % 3) * 0.001)
    m.rotation.z = rot
    group.add(m)
  })

  return group
}

function setupLightingRig(sceneObj) {
  // 1. Moody cool-dark ambient base so unlit edges & war-room walls stay atmospheric (Screenshot 3)
  const hemi = new THREE.HemisphereLight(0x2a3546, 0x0e1218, 0.42)
  sceneObj.add(hemi)

  // Helper to create a focused theatrical SpotLight on the 3D relief terrain
  const addSectorSpot = ({
    pos,
    target,
    color = 0xfff0d6,
    intensity = 5.2,
    distance = 4.5,
    angle = Math.PI / 4.2,
    penumbra = 0.88,
    decay = 1.35,
  }) => {
    const spot = new THREE.SpotLight(color, intensity, distance, angle, penumbra, decay)
    spot.position.set(...pos)
    spot.target.position.set(...target)
    sceneObj.add(spot)
    sceneObj.add(spot.target)
    return spot
  }

  // Spotlight A: Raking across Pendola Pass (彭多拉山口) high 3D snow peaks in the Northeast
  addSectorSpot({
    pos: [2.48, 0.82, 1.05],
    target: [2.05, 0.42, 0.12],
    color: 0xf6f4ef,
    intensity: 5.8,
    distance: 3.6,
    angle: 0.52,
    penumbra: 0.92,
  })

  // Spotlight B: Western / Southwestern sectors (太空港 -> 掩埋废城 -> 裂潮镇)
  addSectorSpot({
    pos: [0.35, -0.35, 1.28],
    target: [0.68, -0.88, 0.02],
    color: 0xffeacc,
    intensity: 6.2,
    distance: 4.2,
    angle: 0.68,
    penumbra: 0.9,
  })

  // Spotlight C: Southern / Southeastern sectors (大坝战场 -> 蓝门 -> 星辰山)
  addSectorSpot({
    pos: [2.35, -1.15, 1.25],
    target: [1.82, -0.76, 0.04],
    color: 0xffebd2,
    intensity: 5.8,
    distance: 4.2,
    angle: 0.66,
    penumbra: 0.9,
  })

  // Spotlight D: Central Toledo Crater fiery amber-orange glow (TOLEDO / RUST BELT RIDGE)
  addSectorSpot({
    pos: [1.52, -0.44, 0.62],
    target: [1.54, -0.46, 0.05],
    color: 0xff9414,
    intensity: 6.5,
    distance: 1.6,
    angle: 0.58,
    penumbra: 0.95,
  })

  // Soft warm spill light on the left & right war-room walls so sticky notes are subtly visible
  const leftWallLight = new THREE.PointLight(0xffd296, 0.55, 2.4, 1.6)
  leftWallLight.position.set(-0.45, -0.35, 0.85)
  sceneObj.add(leftWallLight)

  const rightWallLight = new THREE.PointLight(0xffd296, 0.55, 2.4, 1.6)
  rightWallLight.position.set(3.5, -0.35, 0.85)
  sceneObj.add(rightWallLight)
}

// Terrain surface bounds in SM_FrontEndMap_01.glb:
// X in [-0.0011, 3.0392] (width 3.0403m), Y in [-1.9353, 1.1050] (height 3.0403m)
const TERRAIN_MIN_X = -0.0011
const TERRAIN_MAX_Y = 1.105
const TERRAIN_SPAN = 3.0403
const HALF_FOV_TAN = Math.tan((19 * Math.PI) / 180)

let needsOverlayProjection = true
let sceneGen = 0
let trackedDisposables = []

function setProjectedNode(id, x, y, visible) {
  const cur = projectedNodes[id]
  if (!cur) {
    projectedNodes[id] = { x, y, visible }
  } else {
    if (cur.x !== x) cur.x = x
    if (cur.y !== y) cur.y = y
    if (cur.visible !== visible) cur.visible = visible
  }
}

function setProjectedPractice(x, y, visible) {
  if (projectedPractice.x !== x) projectedPractice.x = x
  if (projectedPractice.y !== y) projectedPractice.y = y
  if (projectedPractice.visible !== visible) projectedPractice.visible = visible
}

function updateProjectedOverlays() {
  if (!stageRef.value) return
  const w = stageRef.value.clientWidth
  const h = stageRef.value.clientHeight
  if (!w || !h) return

  // 3D Mode: project via Three.js PerspectiveCamera
  if (is3DMode.value && camera && tmpVec) {
    for (const m of mapsStore.maps) {
      const c = NODE_3D_COORDS[m.id]
      if (!c) continue
      tmpVec.set(c.x, c.y, c.z + 0.015)
      tmpVec.project(camera)
      setProjectedNode(
        m.id,
        Math.round((tmpVec.x * 0.5 + 0.5) * w),
        Math.round((-tmpVec.y * 0.5 + 0.5) * h),
        tmpVec.z < 1,
      )
    }

    tmpVec.set(PRACTICE_RANGE_3D.x, PRACTICE_RANGE_3D.y, PRACTICE_RANGE_3D.z + 0.015)
    tmpVec.project(camera)
    setProjectedPractice(
      Math.round((tmpVec.x * 0.5 + 0.5) * w),
      Math.round((-tmpVec.y * 0.5 + 0.5) * h),
      tmpVec.z < 1,
    )
    return
  }

  // 2D Mode (Default, zero Three.js overhead): exact 1:1 analytical projection
  const depth = Math.max(0.5, camCurrent.dist - 0.04)
  const pxPerMeter = h / (2 * depth * HALF_FOV_TAN)
  const tiltY = (OVERVIEW_DIST - camCurrent.dist) * 0.035
  const centerY = camCurrent.y + tiltY

  const boardPx = TERRAIN_SPAN * pxPerMeter
  const boardLeft = w * 0.5 + (TERRAIN_MIN_X - camCurrent.x) * pxPerMeter
  const boardTop = h * 0.5 - (TERRAIN_MAX_Y - centerY) * pxPerMeter

  const nextLeft = `${boardLeft.toFixed(1)}px`
  const nextTop = `${boardTop.toFixed(1)}px`
  const nextSize = `${boardPx.toFixed(1)}px`
  if (board2DStyle.left !== nextLeft) board2DStyle.left = nextLeft
  if (board2DStyle.top !== nextTop) board2DStyle.top = nextTop
  if (board2DStyle.width !== nextSize) board2DStyle.width = nextSize
  if (board2DStyle.height !== nextSize) board2DStyle.height = nextSize

  for (const m of mapsStore.maps) {
    const c = NODE_3D_COORDS[m.id]
    if (!c) continue
    setProjectedNode(
      m.id,
      Math.round(w * 0.5 + (c.x - camCurrent.x) * pxPerMeter),
      Math.round(h * 0.5 - (c.y - centerY) * pxPerMeter),
      true,
    )
  }

  setProjectedPractice(
    Math.round(w * 0.5 + (PRACTICE_RANGE_3D.x - camCurrent.x) * pxPerMeter),
    Math.round(h * 0.5 - (PRACTICE_RANGE_3D.y - centerY) * pxPerMeter),
    true,
  )
}

function stepCameraAndRender() {
  rafId = 0

  const dx = camTarget.x - camCurrent.x
  const dy = camTarget.y - camCurrent.y
  const dd = camTarget.dist - camCurrent.dist
  const needsConverge = Math.abs(dx) > 0.0004 || Math.abs(dy) > 0.0004 || Math.abs(dd) > 0.0004
  const camDirty =
    needsConverge ||
    camCurrent.x !== camTarget.x ||
    camCurrent.y !== camTarget.y ||
    camCurrent.dist !== camTarget.dist

  if (needsConverge) {
    camCurrent.x += dx * 0.14
    camCurrent.y += dy * 0.14
    camCurrent.dist += dd * 0.14
  } else if (camDirty) {
    camCurrent.x = camTarget.x
    camCurrent.y = camTarget.y
    camCurrent.dist = camTarget.dist
  }

  if (is3DMode.value && renderer && scene && camera) {
    if (camDirty || needsOverlayProjection) {
      camera.position.set(camCurrent.x, camCurrent.y, camCurrent.dist)
      const tiltY = (OVERVIEW_DIST - camCurrent.dist) * 0.035
      camera.lookAt(camCurrent.x, camCurrent.y + tiltY, 0.04)
      camera.updateMatrixWorld()
      updateProjectedOverlays()
      needsOverlayProjection = false
    }

    if (typeof document === 'undefined' || !document.hidden) {
      if (trailShaderMat && threeClock) {
        trailShaderMat.uniforms.uTime.value = threeClock.getElapsedTime()
      }
      renderer.render(scene, camera)
      rafId = requestAnimationFrame(stepCameraAndRender)
    }
  } else {
    if (camDirty || needsOverlayProjection) {
      updateProjectedOverlays()
      needsOverlayProjection = false
    }
    if (needsConverge) {
      rafId = requestAnimationFrame(stepCameraAndRender)
    }
  }
}

function scheduleCameraStep() {
  needsOverlayProjection = true
  if (!rafId) {
    rafId = requestAnimationFrame(stepCameraAndRender)
  }
}

function disposeSceneResources(root) {
  if (!root) return
  root.traverse((obj) => {
    if (obj.geometry) {
      obj.geometry.dispose()
    }
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (!mat) continue
        if (mat.map) mat.map.dispose()
        if (mat.normalMap) mat.normalMap.dispose()
        mat.dispose()
      }
    }
  })
}

function destroyThreeScene() {
  sceneGen++
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  if (scene) {
    disposeSceneResources(scene)
    scene.clear()
    scene = null
  }
  if (trackedDisposables.length) {
    for (const item of trackedDisposables) {
      item?.dispose?.()
    }
    trackedDisposables = []
  }
  if (trailShaderMat) {
    trailShaderMat.dispose()
    trailShaderMat = null
  }
  if (renderer) {
    renderer.dispose()
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement)
    }
    renderer = null
  }
  camera = null
  threeClock = null
  is3DReady.value = false
}

async function initThreeScene() {
  const wrap = canvasWrapRef.value
  const stage = stageRef.value
  if (!wrap || !stage) return

  const myGen = ++sceneGen

  if (!THREE || !GLTFLoaderClass) {
    is3DLoading.value = true
    try {
      const [threeMod, gltfMod, meshoptMod] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ])
      THREE = threeMod
      GLTFLoaderClass = gltfMod.GLTFLoader
      MeshoptDecoderRef = meshoptMod.MeshoptDecoder
      tmpVec = new THREE.Vector3()
    } catch (err) {
      console.error('Failed to lazy-load Three.js modules:', err)
      is3DLoading.value = false
      is3DMode.value = false
      return
    }
  }

  // Guard if user toggled off 3D or unmounted while modules were loading
  if (myGen !== sceneGen || !is3DMode.value || !canvasWrapRef.value || !stageRef.value) {
    is3DLoading.value = false
    return
  }

  const w = Math.max(320, stage.clientWidth)
  const h = Math.max(320, stage.clientHeight)

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#090b0f')

  camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 25)
  camera.position.set(camCurrent.x, camCurrent.y, camCurrent.dist)
  camera.lookAt(camCurrent.x, camCurrent.y, 0.04)

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w, h)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  wrap.innerHTML = ''
  wrap.appendChild(renderer.domElement)

  const texLoader = new THREE.TextureLoader()
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  trackedDisposables = []

  // 1. Reuse 4K Base Color (world-calabretta.jpg = T_FrontEndMap_01_C) & Load 4K Normal Map (T_FrontEndMap_01_N)
  const mapColorTex = texLoader.load(
    assetUrl(mapsStore.worldMapImage || 'game-maps/world-calabretta.jpg'),
  )
  mapColorTex.flipY = false
  mapColorTex.colorSpace = THREE.SRGBColorSpace
  mapColorTex.anisotropy = maxAniso

  const mapNormalTex = texLoader.load(assetUrl('game-maps/world-3d/T_FrontEndMap_01_N.jpg'))
  mapNormalTex.flipY = false
  mapNormalTex.colorSpace = THREE.NoColorSpace
  mapNormalTex.anisotropy = maxAniso

  const frameColorTex = texLoader.load(assetUrl('game-maps/world-3d/T_FrontEndMap_Frame_01_CR.jpg'))
  frameColorTex.flipY = false
  frameColorTex.wrapS = THREE.RepeatWrapping
  frameColorTex.wrapT = THREE.RepeatWrapping
  frameColorTex.colorSpace = THREE.SRGBColorSpace

  const frameNormalTex = texLoader.load(assetUrl('game-maps/world-3d/T_FrontEndMap_Frame_01_N.jpg'))
  frameNormalTex.flipY = false
  frameNormalTex.wrapS = THREE.RepeatWrapping
  frameNormalTex.wrapT = THREE.RepeatWrapping
  frameNormalTex.colorSpace = THREE.NoColorSpace

  const terrainMaterial = new THREE.MeshStandardMaterial({
    map: mapColorTex,
    normalMap: mapNormalTex,
    // UE5 DirectX normal map has inverted Y channel relative to OpenGL
    normalScale: new THREE.Vector2(1.65, -1.65),
    roughness: 0.76,
    metalness: 0.06,
  })

  const frameMaterial = new THREE.MeshStandardMaterial({
    map: frameColorTex,
    normalMap: frameNormalTex,
    normalScale: new THREE.Vector2(1.2, -1.2),
    roughness: 0.62,
    metalness: 0.25,
  })

  trackedDisposables.push(
    mapColorTex,
    mapNormalTex,
    frameColorTex,
    frameNormalTex,
    terrainMaterial,
    frameMaterial,
  )

  // 2. Add War Room Backdrop Wall & Sticky Notes
  scene.add(buildWarRoomBackdrop(texLoader, trackedDisposables))

  // 3. Setup In-Game Multi-Spotlight Rig
  setupLightingRig(scene)

  // 4. Load Genuine Game 3D Relief Mesh (SM_FrontEndMap_01.glb) & 3D Light Trails (SM_LightTrail_01.glb)
  const gltfLoader = new GLTFLoaderClass()
  if (MeshoptDecoderRef) {
    gltfLoader.setMeshoptDecoder(MeshoptDecoderRef)
  }

  gltfLoader.load(
    assetUrl('game-maps/world-3d/SM_FrontEndMap_01.glb'),
    (gltf) => {
      if (myGen !== sceneGen || !scene) {
        disposeSceneResources(gltf.scene)
        return
      }
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          const matName = child.material?.name || ''
          const oldMats = Array.isArray(child.material) ? child.material : [child.material]
          for (const om of oldMats) om?.dispose?.()
          if (matName.includes('Frame')) {
            child.material = frameMaterial
          } else {
            child.material = terrainMaterial
          }
        }
      })
      scene.add(gltf.scene)
      is3DReady.value = true
      is3DLoading.value = false
    },
    undefined,
    (err) => {
      console.error('Failed to load SM_FrontEndMap_01.glb:', err)
      is3DLoading.value = false
    },
  )

  trailShaderMat = createLightDotsShaderMaterial()
  trackedDisposables.push(trailShaderMat)
  gltfLoader.load(
    assetUrl('game-maps/world-3d/SM_LightTrail_01.glb'),
    (gltf) => {
      if (myGen !== sceneGen || !scene) {
        disposeSceneResources(gltf.scene)
        return
      }
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          const oldMats = Array.isArray(child.material) ? child.material : [child.material]
          for (const om of oldMats) om?.dispose?.()
          child.material = trailShaderMat
        }
      })
      scene.add(gltf.scene)
      scene.add(createPendolaTrailMesh(trailShaderMat))
    },
    undefined,
    (err) => {
      console.error('Failed to load SM_LightTrail_01.glb:', err)
    },
  )

  threeClock = new THREE.Clock()
  scheduleCameraStep()
}

async function toggle3DView() {
  if (is3DLoading.value) return
  if (is3DMode.value) {
    is3DMode.value = false
    mapsStore.worldMap3DEnabled = false
    destroyThreeScene()
    updateProjectedOverlays()
    scheduleCameraStep()
  } else {
    is3DMode.value = true
    mapsStore.worldMap3DEnabled = true
    await nextTick()
    await initThreeScene()
  }
}

function handleResize() {
  if (!stageRef.value) return
  if (is3DMode.value && renderer && camera) {
    const w = Math.max(320, stageRef.value.clientWidth)
    const h = Math.max(320, stageRef.value.clientHeight)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  needsOverlayProjection = true
  updateProjectedOverlays()
}

function onVisibilityChange() {
  if (!document.hidden && is3DMode.value && renderer && !rafId) {
    rafId = requestAnimationFrame(stepCameraAndRender)
  }
}

onMounted(async () => {
  mapsStore.startClock()
  updateProjectedOverlays()

  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    stageRo = new ResizeObserver(() => handleResize())
    stageRo.observe(stageRef.value)
  }
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', onVisibilityChange)

  if (route.query.quest) {
    mapsStore.trackedQuestId = String(route.query.quest)
    const tq = mapsStore.trackedQuest
    if (tq && tq.primaryMapId) {
      mapsStore.previewMapId = tq.primaryMapId
      isCardOpen.value = true
      focusOnMapNode(mapsStore.getMapById(tq.primaryMapId))
    }
  }

  if (is3DMode.value) {
    await nextTick()
    await initThreeScene()
  }
})

onBeforeUnmount(() => {
  mapsStore.stopClock()
  destroyThreeScene()
  if (stageRo) {
    stageRo.disconnect()
    stageRo = null
  }
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

watch(
  () => route.query.quest,
  (q) => {
    if (q) {
      mapsStore.trackedQuestId = String(q)
      const tq = mapsStore.trackedQuest
      if (tq && tq.primaryMapId) {
        mapsStore.previewMapId = tq.primaryMapId
        isCardOpen.value = true
        focusOnMapNode(mapsStore.getMapById(tq.primaryMapId))
      }
    }
  },
)
</script>

<template>
  <main
    ref="stageRef"
    class="ingame-world-stage"
    :class="{ panning: isPanning, 'card-open': isCardOpen }"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <!-- Default Fast 2D Calabretta Tactical Relief Board (Zero Three.js / WebGL overhead until 3D View is clicked) -->
    <div v-if="!is3DMode" class="calabretta-2d-stage" aria-hidden="true">
      <div class="c2d-board" :style="board2DStyle">
        <img
          :src="assetUrl(mapsStore.worldMapImage || 'game-maps/world-calabretta.jpg')"
          alt=""
          class="c2d-map-img"
          draggable="false"
        />
        <!-- Subtle glowing Speranza tunnel trails matching SM_LightTrail_01 endpoints -->
        <svg class="c2d-trails-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
          <defs>
            <filter id="c2dTrailGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g
            fill="none"
            stroke="#ffae19"
            stroke-width="3.2"
            stroke-linecap="round"
            stroke-dasharray="2 11"
            filter="url(#c2dTrailGlow)"
            opacity="0.88"
          >
            <!-- Toledo Center (500,500) radiating to the 7 sectors -->
            <path d="M513,727 C420,660 330,610 264,526" />
            <path d="M513,727 C390,715 280,695 196,664" />
            <path d="M196,664 C165,725 142,775 120,821" />
            <path d="M513,727 C585,710 640,685 693,652" />
            <path d="M693,652 C702,585 704,540 703,485" />
            <path d="M703,485 C698,385 696,295 696,207" />
          </g>
        </svg>
      </div>
    </div>

    <!-- On-Demand Real-Time Three.js WebGL Canvas (Loaded ONLY when user clicks 3D 视图) -->
    <div v-if="is3DMode" ref="canvasWrapRef" class="webgl-diorama-stage"></div>

    <!-- Subtle edge vignette blending the war-room corners into the HUD -->
    <div class="warroom-vignette" aria-hidden="true"></div>

    <!-- Tracked Quest Quick Bar (when navigated from Quests with ?quest=...) -->
    <div v-if="mapsStore.trackedQuest" class="wc-quest-banner">
      <div class="wqb-left">
        <span class="wqb-badge">任务追踪中</span>
        <strong class="wqb-title">{{ mapsStore.trackedQuest.zhTitle }}</strong>
        <span v-if="!mapsStore.trackedQuest.mapIds?.length" class="wqb-loc">
          目标：{{ mapsStore.trackedQuest.zhLocation.split(' (')[0] }}
        </span>
        <span v-else class="wqb-loc">目标战区：</span>
      </div>
      <div class="wqb-actions">
        <button
          v-for="mId in mapsStore.trackedQuest.mapIds"
          :key="mId"
          type="button"
          class="wqb-go-btn"
          @click="enterDetailedMap(mId, { questId: mapsStore.trackedQuest.id })"
        >
          <span>{{ mapsStore.getMapById(mId).name }}</span>
          <span class="wqb-arrow">→</span>
        </button>
        <button
          type="button"
          class="wqb-clear-btn"
          @click="mapsStore.trackedQuestId = ''"
        >
          取消
        </button>
      </div>
    </div>

    <!-- 3D-Projected Destination Nodes Layer (Locked 1:1 to 3D mountain coordinates on SM_FrontEndMap_01) -->
    <div class="cb-nodes-layer">
      <!-- Non-interactive Practice Range (靶场) pill in the center, matching Screenshot 3 -->
      <div
        v-if="projectedPractice.visible"
        class="ingame-node practice-range-node"
        :style="{
          left: `${projectedPractice.x}px`,
          top: `${projectedPractice.y}px`,
        }"
        aria-hidden="true"
      >
        <div class="in-main-row">
          <div class="in-pill practice">
            <span class="in-dot"></span>
            <span class="in-name">靶场</span>
          </div>
        </div>
      </div>

      <!-- 7 Playable Map Nodes -->
      <div
        v-for="m in mapsStore.maps"
        v-show="projectedNodes[m.id]?.visible"
        :key="m.id"
        class="ingame-node"
        :class="{
          selected: isCardOpen && mapsStore.previewMapId === m.id,
          'quest-target': isQuestTargetedMap(m.id),
          'has-major-cond':
            activeStateByMap[m.id]?.activePrimary.id !== 'standard-patrol',
        }"
        :style="{
          left: `${projectedNodes[m.id]?.x ?? -999}px`,
          top: `${projectedNodes[m.id]?.y ?? -999}px`,
        }"
        role="button"
        tabindex="0"
        :aria-label="m.name"
        @pointerdown.stop
        @click.stop="handleNodeClick(m.id)"
        @keydown.enter.stop="handleNodeClick(m.id)"
      >
        <!-- Main Pill Row: ● 地名 + Optional Minor Event Icon Badge -->
        <div class="in-main-row">
          <div class="in-pill">
            <span class="in-dot"></span>
            <span class="in-name">{{ m.name }}</span>
          </div>

          <!-- Inline Minor Condition Icon Badge (shown whenever a minor condition is active, like 大坝战场 / 裂潮镇 in Screenshot 3) -->
          <div
            v-if="activeStateByMap[m.id]?.activeSecondary"
            class="in-minor-badge"
            :title="activeStateByMap[m.id].activeSecondary.name"
          >
            <img
              v-if="activeStateByMap[m.id].activeSecondary.gameIcon"
              :src="assetUrl(activeStateByMap[m.id].activeSecondary.gameIcon)"
              alt=""
            />
          </div>
        </div>

        <!-- Second Stacked Row: Major Condition / Event (like 星辰山 -> 夜间奇袭 or 掩埋废城 -> ARC“护卫者” in Screenshot 3) -->
        <div
          v-if="activeStateByMap[m.id]?.activePrimary.id !== 'standard-patrol'"
          class="in-cond-row"
        >
          <span class="in-cond-icon-wrap">
            <img
              v-if="activeStateByMap[m.id].activePrimary.gameIcon"
              :src="assetUrl(activeStateByMap[m.id].activePrimary.gameIcon)"
              alt=""
            />
          </span>
          <span class="in-cond-name">
            {{ activeStateByMap[m.id].activePrimary.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- Bottom-Left In-Game HUD: LOCATION LIST + 🌐 亚洲 (Screenshot 2 & 3) -->
    <div class="ingame-hud-bl">
      <!-- Pop-up Location List Menu -->
      <transition name="fade-up">
        <div v-if="showLocationList" class="loc-list-popover">
          <div class="llp-head">
            <span>地点列表 · 目的地名录</span>
            <small>{{ mapsStore.selectedServer.name }}官网实时</small>
          </div>
          <button
            v-for="m in mapsStore.maps"
            :key="m.id"
            type="button"
            class="llp-item"
            :class="{ active: mapsStore.previewMapId === m.id && isCardOpen }"
            @click="selectFromLocationList(m.id)"
          >
            <div class="llpi-left">
              <span class="llpi-dot"></span>
              <strong>{{ m.name }}</strong>
              <span class="llpi-en">{{ m.enName }}</span>
            </div>
            <div class="llpi-right">
              <span
                v-if="activeStateByMap[m.id]?.activePrimary.id !== 'standard-patrol'"
                class="llpi-cond"
              >
                <img
                  v-if="activeStateByMap[m.id].activePrimary.gameIcon"
                  :src="assetUrl(activeStateByMap[m.id].activePrimary.gameIcon)"
                  alt=""
                />
                {{ activeStateByMap[m.id].activePrimary.name }}
              </span>
              <span
                v-if="activeStateByMap[m.id]?.activeSecondary"
                class="llpi-cond minor"
              >
                <img
                  v-if="activeStateByMap[m.id].activeSecondary.gameIcon"
                  :src="assetUrl(activeStateByMap[m.id].activeSecondary.gameIcon)"
                  alt=""
                />
                {{ activeStateByMap[m.id].activeSecondary.name }}
              </span>
            </div>
          </button>
        </div>
      </transition>

      <!-- Pop-up Server Selector Menu -->
      <transition name="fade-up">
        <div v-if="showServerMenu" class="server-list-popover">
          <div class="slp-head">
            <span>切换匹配服务器 · 官网整点轮换</span>
            <em class="ar-num"><RotationCountdownText prefix="剩余 " /></em>
          </div>
          <button
            v-for="srv in mapsStore.servers"
            :key="srv.id"
            type="button"
            class="slp-item"
            :class="{ active: mapsStore.selectedServerId === srv.id }"
            @click="
              mapsStore.selectedServerId = srv.id;
              showServerMenu = false
            "
          >
            <span class="slpi-name">{{ srv.name.replace('服', '') }} ({{ srv.code }})</span>
            <small class="slpi-tz">{{ srv.tzLabel }}</small>
          </button>
          <div class="slp-foot">
            <span class="slpf-src">
              {{
                mapsStore.scheduleSyncSource === 'official-live'
                  ? '● 已同步 arcraiders.com 实时排期'
                  : '● 官方排期快照 (arcraiders.com)'
              }}
            </span>
            <button
              type="button"
              class="slpf-sync-btn"
              :disabled="mapsStore.isSyncingSchedule"
              @click.stop="mapsStore.refreshOfficialSchedule(true)"
            >
              {{ mapsStore.isSyncingSchedule ? '同步中...' : '↻ 刷新' }}
            </button>
          </div>
        </div>
      </transition>

      <div class="hud-bl-row">
        <button
          type="button"
          class="location-list-btn"
          :class="{ active: showLocationList }"
          @click.stop="
            showLocationList = !showLocationList;
            showServerMenu = false
          "
        >
          <span>地点列表</span>
        </button>

        <button
          type="button"
          class="toggle-3d-btn"
          :class="{ active: is3DMode, loading: is3DLoading }"
          :disabled="is3DLoading"
          title="点击按需加载/卸载 3D 地形模型视图（默认不加载 3D 以节省内存与显存）"
          @click.stop="toggle3DView"
        >
          <span class="t3d-dot"></span>
          <span>
            {{ is3DLoading ? '3D 加载中...' : is3DMode ? '3D 视图 · 已开启' : '3D 视图' }}
          </span>
        </button>
      </div>

      <button
        type="button"
        class="server-region-btn"
        title="点击切换服务器战区（不同服务器拥有对应的实时活动轮换）"
        @click.stop="
          showServerMenu = !showServerMenu;
          showLocationList = false
        "
      >
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5" />
          <ellipse cx="10" cy="10" rx="3.6" ry="7.5" stroke="currentColor" stroke-width="1.3" />
          <path d="M2.8 10h14.4M4 6.2h12M4 13.8h12" stroke="currentColor" stroke-width="1.2" />
        </svg>
        <span>{{ mapsStore.selectedServer.name === '亚服' ? '亚洲' : mapsStore.selectedServer.name }}</span>
        <small class="srb-timer ar-num"><RotationCountdownText /></small>
      </button>
    </div>

    <!-- Right-Side Floating In-Game Cream Destination Card (Screenshot 2: 目的地 Card) -->
    <transition name="card-pop">
      <aside v-if="isCardOpen && previewMap" class="ingame-dest-card">
        <!-- Top Location Photo with Difficulty Bar & Concave Arch Transition -->
        <div class="idc-hero">
          <img
            v-if="previewMap.coverArt"
            :src="assetUrl(previewMap.coverArt)"
            :alt="previewMap.name"
            class="idc-cover-img"
          />

          <!-- Top-Left In-Game Difficulty Bar: 难度 ■■□□□ -->
          <div class="idc-difficulty">
            <span class="idcd-label">难度</span>
            <div class="idcd-bars">
              <i
                v-for="i in 5"
                :key="i"
                class="idcd-bar"
                :class="{ filled: i <= previewMap.difficultyTier }"
              ></i>
            </div>
          </div>

          <!-- Active Condition Pill on Cover Top-Right (Only shown when a special event/condition is active) -->
          <button
            v-if="
              previewActiveState.activePrimary.id !== 'standard-patrol' ||
              previewActiveState.activeSecondary
            "
            type="button"
            class="idc-cond-chip"
            :title="`点击查看 ${mapsStore.selectedServer.name} 活动轮换时间表`"
            @click="showScheduleDrawer = !showScheduleDrawer"
          >
            <img
              v-if="
                (previewActiveState.activePrimary.id !== 'standard-patrol'
                  ? previewActiveState.activePrimary
                  : previewActiveState.activeSecondary
                )?.gameIcon
              "
              :src="
                assetUrl(
                  (previewActiveState.activePrimary.id !== 'standard-patrol'
                    ? previewActiveState.activePrimary
                    : previewActiveState.activeSecondary
                  ).gameIcon,
                )
              "
              alt=""
            />
            <span>
              {{
                (previewActiveState.activePrimary.id !== 'standard-patrol'
                  ? previewActiveState.activePrimary
                  : previewActiveState.activeSecondary
                ).name
              }}
            </span>
          </button>

          <!-- Smooth Concave Cream Arch at Bottom of Cover Image (Matches Screenshot 2) -->
          <svg
            class="idc-arch-svg"
            viewBox="0 0 360 34"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M0,0 Q180,34 360,0 L360,34 L0,34 Z" fill="#f5ead8" />
          </svg>
        </div>

        <!-- Center-Aligned Cream Card Body -->
        <div class="idc-body">
          <div class="idc-kicker">目的地</div>
          <h2 class="idc-title">{{ previewMap.name }}</h2>

          <p class="idc-lore">
            {{ previewMap.loreDesc || previewMap.summary }}
          </p>

          <!-- Compact Collapsible Server Event Schedule -->
          <div class="idc-meta-strip">
            <button
              type="button"
              class="idcms-pill"
              @click="showScheduleDrawer = !showScheduleDrawer"
            >
              <span><RotationCountdownText :prefix="`${mapsStore.selectedServer.name}轮换 (`" suffix=")" /></span>
              <small>{{ showScheduleDrawer ? '收起 ▲' : '时间表 ▼' }}</small>
            </button>
          </div>

          <!-- Expandable Server Rotation Schedule Drawer -->
          <div v-if="showScheduleDrawer" class="idc-schedule-box">
            <div class="idcs-head">
              <span>
                {{
                  mapsStore.scheduleSyncSource === 'official-live'
                    ? '● 官网实时排期 (arcraiders.com)'
                    : '● 官网整点排期 (arcraiders.com)'
                }}
              </span>
              <button
                type="button"
                class="idcs-sync-btn"
                :disabled="mapsStore.isSyncingSchedule"
                @click.stop="mapsStore.refreshOfficialSchedule(true)"
              >
                {{ mapsStore.isSyncingSchedule ? '同步中' : '↻ 刷新' }}
              </button>
            </div>
            <button
              v-for="(slot, idx) in previewUpcoming"
              :key="idx"
              type="button"
              class="idcs-row"
              :class="{ current: idx === 0 }"
              @click="
                enterDetailedMap(previewMap.id, {
                  eventId: (
                    slot.primaryEvent.id !== 'standard-patrol'
                      ? slot.primaryEvent
                      : slot.secondaryEvent || slot.primaryEvent
                  ).id,
                })
              "
            >
              <span class="idcs-time ar-num">{{ slot.timeLabel }}</span>
              <span class="idcs-ev">
                <template
                  v-if="slot.primaryEvent.id !== 'standard-patrol' && slot.secondaryEvent"
                >
                  <img
                    v-if="slot.primaryEvent.gameIcon"
                    :src="assetUrl(slot.primaryEvent.gameIcon)"
                    alt=""
                  />
                  <span>{{ slot.primaryEvent.name }}</span>
                  <span class="idcs-plus">+</span>
                  <img
                    v-if="slot.secondaryEvent.gameIcon"
                    :src="assetUrl(slot.secondaryEvent.gameIcon)"
                    alt=""
                  />
                  <span>{{ slot.secondaryEvent.name }}</span>
                </template>
                <template v-else>
                  <img
                    v-if="
                      (slot.primaryEvent.id !== 'standard-patrol'
                        ? slot.primaryEvent
                        : slot.secondaryEvent
                      )?.gameIcon
                    "
                    :src="
                      assetUrl(
                        (slot.primaryEvent.id !== 'standard-patrol'
                          ? slot.primaryEvent
                          : slot.secondaryEvent
                        ).gameIcon,
                      )
                    "
                    alt=""
                  />
                  <span>
                    {{
                      (slot.primaryEvent.id !== 'standard-patrol'
                        ? slot.primaryEvent
                        : slot.secondaryEvent || slot.primaryEvent
                      ).name
                    }}
                  </span>
                </template>
              </span>
            </button>
          </div>

          <!-- Bottom Single Pill Button: 进入地图 -->
          <div class="idc-actions">
            <button
              type="button"
              class="idc-btn idc-btn--amber"
              @click="enterDetailedMap(previewMap.id)"
            >
              进入地图
            </button>
          </div>
        </div>
      </aside>
    </transition>

    <!-- Bottom In-Game Keybind Bar (Screenshot 2 & 3) -->
    <footer class="ingame-bottom-bar">
      <button
        type="button"
        class="ibb-item clickable"
        @click="isCardOpen || isZoomed ? resetOverview() : router.push('/quests/archive')"
      >
        <kbd class="ibb-key">ESC</kbd>
        <span>{{ isCardOpen || isZoomed ? '返回全图' : '返回' }}</span>
      </button>

      <div class="ibb-item">
        <span class="ibb-mouse-icon">🖱</span>
        <span>平移</span>
      </div>

      <div class="ibb-item">
        <span class="ibb-mouse-icon">⚙</span>
        <span>放大</span>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.ingame-world-stage {
  position: relative;
  width: 100%;
  height: calc(100vh - 56px);
  min-height: 620px;
  overflow: hidden;
  background: #090b0f;
  user-select: none;
  cursor: grab;
}

.ingame-world-stage.panning {
  cursor: grabbing;
}

/* ============================================================================
   1. Fast 2D Board Stage (Default) & On-Demand Three.js WebGL 3D Relief Stage
   ============================================================================ */
.calabretta-2d-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  background: radial-gradient(circle at 50% 50%, #161a21 0%, #090b0f 85%);
  overflow: hidden;
  pointer-events: none;
}

.c2d-board {
  position: absolute;
  border-radius: 4px;
  box-shadow:
    0 0 0 10px #22262e,
    0 0 0 12px rgba(245, 234, 216, 0.18),
    0 28px 68px rgba(0, 0, 0, 0.88);
  background: #101318;
  will-change: left, top, width, height;
}

.c2d-map-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: fill;
  filter: contrast(1.04) saturate(1.05);
  user-select: none;
}

.c2d-trails-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.webgl-diorama-stage {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

.webgl-diorama-stage :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.warroom-vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
  background: radial-gradient(
    ellipse 86% 88% at 50% 50%,
    transparent 56%,
    rgba(4, 6, 9, 0.55) 84%,
    rgba(3, 4, 7, 0.88) 100%
  );
}

/* ============================================================================
   2. Tracked Quest Banner
   ============================================================================ */
.wc-quest-banner {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 45;
  width: max-content;
  max-width: calc(100vw - 32px);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px 6px 12px;
  border-radius: 6px;
  background: rgba(14, 17, 24, 0.94);
  border: 1px solid rgba(255, 196, 54, 0.52);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  white-space: nowrap;
}

.wqb-left {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: #f4eee1;
  white-space: nowrap;
  flex-shrink: 0;
}

.wqb-badge {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 4px;
  background: #ffbe2e;
  color: #111318;
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.03em;
  white-space: nowrap;
  flex-shrink: 0;
}

.wqb-title {
  font-size: 14px;
  font-weight: 800;
  color: #f6f2ea;
  white-space: nowrap;
}

.wqb-loc {
  color: rgba(244, 238, 225, 0.65);
  font-size: 12.5px;
  white-space: nowrap;
}

.wqb-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  flex-shrink: 0;
}

.wqb-go-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 11px;
  border-radius: 4px;
  border: 1px solid rgba(255, 196, 54, 0.55);
  background: rgba(255, 196, 54, 0.14);
  color: #ffd15c;
  font-size: 12.5px;
  font-weight: 700;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.wqb-go-btn:hover {
  background: #ffbe2e;
  border-color: #ffbe2e;
  color: #111318;
}

.wqb-arrow {
  font-size: 12px;
  line-height: 1;
}

.wqb-clear-btn {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(244, 238, 225, 0.78);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.wqb-clear-btn:hover {
  border-color: rgba(244, 238, 225, 0.5);
  color: #ffffff;
}

/* ============================================================================
   3. 3D-Projected Destination Node Pills (Screenshot 2 & Screenshot 3)
   ============================================================================ */
.cb-nodes-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
}

.ingame-node {
  position: absolute;
  transform: translate(-50%, -50%);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  z-index: 12;
  transition: filter 0.15s ease;
}

.ingame-node.practice-range-node {
  pointer-events: none;
  cursor: default;
  z-index: 10;
}

.ingame-node:hover {
  z-index: 25;
  filter: brightness(1.08);
}

.ingame-node.selected {
  z-index: 30;
}

.in-main-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

/* Dark Charcoal Pill with Solid Cream Dot: ● 掩埋废城 */
.in-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px 5px 9px;
  border-radius: 6px;
  background: rgba(22, 24, 29, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.72),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(4px);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.in-pill.practice {
  background: rgba(44, 46, 56, 0.85);
  border-color: rgba(168, 139, 250, 0.42);
}

.ingame-node:hover .in-pill {
  background: rgba(30, 33, 40, 0.96);
  border-color: rgba(245, 234, 216, 0.48);
}

.ingame-node.selected .in-pill {
  background: rgba(20, 22, 27, 0.98);
  border-color: #f5ead8;
  box-shadow:
    0 0 0 2px rgba(245, 234, 216, 0.25),
    0 10px 24px rgba(0, 0, 0, 0.85);
}

.ingame-node.quest-target .in-pill {
  border-color: #ffbe2e;
  box-shadow: 0 0 0 2px rgba(255, 190, 46, 0.32);
}

.in-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #f5ead8;
  box-shadow: 0 0 6px rgba(245, 234, 216, 0.65);
  flex-shrink: 0;
}

.ingame-node.selected .in-dot {
  background: #ffbe2e;
  box-shadow: 0 0 8px rgba(255, 190, 46, 0.9);
}

.in-name {
  color: #f5eee0;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
  line-height: 1.1;
}

/* Inline Minor Condition Icon Next to Main Pill (Screenshot 3: 大坝战场 ⚙ / 裂潮镇 🌿) */
.in-minor-badge {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(22, 24, 29, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.65);
}

.in-minor-badge img {
  width: 15px;
  height: 15px;
  object-fit: contain;
  filter: brightness(1.1);
}

/* Stacked Second Row for Major Condition (Screenshot 3: 掩埋废城 -> ARC“护卫者”, 星辰山 -> 夜间奇袭) */
.in-cond-row {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 5px;
  border-radius: 6px;
  background: rgba(20, 22, 27, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.68);
}

.in-cond-icon-wrap {
  width: 19px;
  height: 19px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.in-cond-icon-wrap img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.in-cond-name {
  color: #e8dfd0;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

/* ============================================================================
   4. Bottom-Left In-Game HUD: LOCATION LIST + 🌐 亚洲 (Screenshot 2 & 3)
   ============================================================================ */
.ingame-hud-bl {
  position: absolute;
  left: 36px;
  bottom: 72px;
  z-index: 35;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}

.hud-bl-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.location-list-btn {
  min-width: 156px;
  padding: 9px 16px;
  border-radius: 5px;
  background: rgba(20, 21, 24, 0.76);
  border: 1px solid rgba(235, 224, 204, 0.35);
  color: #e5dac7;
  font-family: var(--font-sans, sans-serif);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: left;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: all 0.16s ease;
}

.location-list-btn:hover,
.location-list-btn.active {
  background: rgba(34, 36, 42, 0.92);
  border-color: rgba(245, 234, 216, 0.72);
  color: #fff;
}

.toggle-3d-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 14px;
  border-radius: 5px;
  background: rgba(20, 21, 24, 0.76);
  border: 1px solid rgba(235, 224, 204, 0.35);
  color: #e5dac7;
  font-family: var(--font-sans, sans-serif);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: all 0.16s ease;
}

.toggle-3d-btn:hover:not(:disabled) {
  background: rgba(34, 36, 42, 0.92);
  border-color: rgba(255, 190, 46, 0.72);
  color: #fff;
}

.toggle-3d-btn.active {
  background: rgba(255, 190, 46, 0.18);
  border-color: rgba(255, 190, 46, 0.75);
  color: #ffd15c;
}

.toggle-3d-btn:disabled {
  opacity: 0.68;
  cursor: wait;
}

.t3d-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(235, 224, 204, 0.45);
  transition: all 0.16s ease;
}

.toggle-3d-btn.active .t3d-dot {
  background: #ffbe2e;
  box-shadow: 0 0 8px rgba(255, 190, 46, 0.9);
}

.toggle-3d-btn.loading .t3d-dot {
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.9);
}

.server-region-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: rgba(232, 223, 208, 0.85);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.server-region-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.srb-timer {
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(232, 223, 208, 0.7);
  font-size: 11px;
}

/* Location List Popover */
.loc-list-popover {
  width: 340px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(18, 20, 25, 0.96);
  border: 1px solid rgba(235, 224, 204, 0.28);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.llp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 700;
  color: rgba(235, 224, 204, 0.65);
  letter-spacing: 0.06em;
}

.llp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #f3ece0;
  cursor: pointer;
  text-align: left;
  transition: all 0.14s ease;
}

.llp-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.llp-item.active {
  background: rgba(245, 234, 216, 0.12);
  border-color: rgba(245, 234, 216, 0.38);
}

.llpi-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.llpi-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #f5ead8;
}

.llpi-left strong {
  font-size: 13px;
}

.llpi-en {
  font-size: 11px;
  color: rgba(243, 236, 224, 0.45);
}

.llpi-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.llpi-cond {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  font-size: 11px;
  color: #e8dfd0;
}

.llpi-cond img {
  width: 12px;
  height: 12px;
  object-fit: contain;
}

/* Server Selector Popover */
.server-list-popover {
  width: 240px;
  padding: 10px;
  border-radius: 10px;
  background: rgba(18, 20, 25, 0.96);
  border: 1px solid rgba(235, 224, 204, 0.28);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slp-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  color: rgba(235, 224, 204, 0.68);
}

.slp-head em {
  font-style: normal;
  color: #ffbe2e;
}

.slp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #f3ece0;
  font-size: 12px;
  cursor: pointer;
}

.slp-item:hover {
  background: rgba(255, 255, 255, 0.07);
}

.slp-item.active {
  background: rgba(255, 190, 46, 0.15);
  border-color: rgba(255, 190, 46, 0.45);
  color: #ffcf5c;
  font-weight: 700;
}

.slpi-tz {
  font-size: 11px;
  color: rgba(243, 236, 224, 0.5);
}

.slp-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
  padding: 6px 8px 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 10.5px;
  color: rgba(235, 224, 204, 0.68);
}

.slpf-src {
  color: #5eead4;
  font-weight: 600;
}

.slpf-sync-btn {
  padding: 2px 7px;
  border-radius: 4px;
  border: 1px solid rgba(235, 224, 204, 0.25);
  background: rgba(255, 255, 255, 0.06);
  color: #f3ece0;
  font-size: 10.5px;
  cursor: pointer;
}

.slpf-sync-btn:hover:not(:disabled) {
  background: rgba(255, 190, 46, 0.2);
  border-color: rgba(255, 190, 46, 0.5);
}

/* ============================================================================
   5. Right-Side Floating Cream Destination Card (Screenshot 2: 目的地 Card)
   ============================================================================ */
.ingame-dest-card {
  position: absolute;
  top: 44%;
  right: 38px;
  transform: translateY(-50%);
  width: 318px;
  border-radius: 14px;
  background: #f5ead8;
  color: #181a20;
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.82),
    0 0 0 1px rgba(255, 255, 255, 0.22);
  overflow: hidden;
  z-index: 40;
  display: flex;
  flex-direction: column;
}

.idc-hero {
  position: relative;
  width: 100%;
  height: 186px;
  background: #1c2026;
  overflow: hidden;
}

.idc-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Top-Left Difficulty Indicator: 难度 ■■□□□ */
.idc-difficulty {
  position: absolute;
  top: 12px;
  left: 14px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(14, 16, 20, 0.62);
  backdrop-filter: blur(4px);
}

.idcd-label {
  color: #f5eee0;
  font-size: 12px;
  font-weight: 700;
}

.idcd-bars {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.idcd-bar {
  width: 8px;
  height: 8px;
  border-radius: 1.5px;
  background: rgba(255, 255, 255, 0.28);
}

.idcd-bar.filled {
  background: #ffffff;
  box-shadow: 0 0 4px rgba(255, 255, 255, 0.6);
}

/* Top-Right Active Condition Pill on Cover */
.idc-cond-chip {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(14, 16, 20, 0.72);
  color: #f5eee0;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  backdrop-filter: blur(4px);
}

.idc-cond-chip img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.idc-cond-chip em {
  font-style: normal;
  color: #ffcf66;
}

/* Smooth Concave Cream Arch at Bottom of Hero Image */
.idc-arch-svg {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  width: 100%;
  height: 28px;
  display: block;
  pointer-events: none;
}

.idc-body {
  padding: 4px 24px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.idc-kicker {
  font-size: 12px;
  font-weight: 700;
  color: rgba(24, 26, 32, 0.56);
  letter-spacing: 0.06em;
  margin-bottom: 2px;
}

.idc-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 900;
  color: #14161b;
  letter-spacing: 0.02em;
}

.idc-lore {
  margin: 0 0 16px;
  font-size: 12.5px;
  line-height: 1.62;
  color: rgba(24, 26, 32, 0.82);
  text-align: left;
  min-height: 76px;
}

.idc-meta-strip {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 14px;
}

.idcms-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(20, 22, 27, 0.16);
  background: rgba(20, 22, 27, 0.06);
  color: #23262e;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.idcms-pill:hover {
  background: rgba(20, 22, 27, 0.11);
}

.idcms-pill small {
  color: rgba(20, 22, 27, 0.58);
  font-size: 10px;
}

/* Collapsible Server Schedule Drawer inside Cream Card */
.idc-schedule-box {
  width: 100%;
  max-height: 210px;
  overflow-y: auto;
  margin-bottom: 14px;
  padding: 6px;
  border-radius: 8px;
  background: rgba(20, 22, 27, 0.07);
  border: 1px solid rgba(20, 22, 27, 0.12);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.idcs-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px 5px;
  border-bottom: 1px solid rgba(20, 22, 27, 0.1);
  font-size: 10px;
  font-weight: 700;
  color: #166534;
}

.idcs-sync-btn {
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid rgba(20, 22, 27, 0.2);
  background: rgba(255, 255, 255, 0.45);
  color: #181a20;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
}

.idcs-sync-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.8);
}

.idcs-plus {
  opacity: 0.55;
  margin: 0 1px;
}

.idcs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: #1f222a;
  font-size: 11.5px;
  cursor: pointer;
  text-align: left;
}

.idcs-row:hover {
  background: rgba(20, 22, 27, 0.08);
}

.idcs-row.current {
  background: rgba(20, 22, 27, 0.12);
  font-weight: 700;
}

.idcs-time {
  font-size: 11px;
  color: rgba(20, 22, 27, 0.65);
}

.idcs-ev {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.idcs-ev img {
  width: 13px;
  height: 13px;
  object-fit: contain;
  filter: invert(0.85);
}

.idcs-ev em {
  font-style: normal;
  color: #8f5b00;
}

/* Bottom Pill Buttons: 查看 & 选择目的地 */
.idc-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 4px;
}

.idc-btn {
  width: 100%;
  height: 40px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.15s ease;
}

.idc-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.idc-btn--dark {
  background: #12151c;
  border: 1px solid #12151c;
  color: #f5ead8;
}

.idc-btn--amber {
  background: #ffbe26;
  border: 1px solid #e5a410;
  color: #14161b;
  box-shadow: 0 6px 16px rgba(255, 190, 38, 0.32);
}

/* ============================================================================
   6. Bottom In-Game Keybind Bar (Screenshot 2 & 3)
   ============================================================================ */
.ingame-bottom-bar {
  position: absolute;
  left: 36px;
  bottom: 20px;
  z-index: 35;
  display: inline-flex;
  align-items: center;
  gap: 20px;
  padding: 6px 14px;
  border-radius: 999px;
  background: rgba(14, 16, 20, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(6px);
}

.ibb-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: rgba(242, 234, 218, 0.85);
  font-size: 12px;
  font-weight: 600;
  border: none;
  background: transparent;
  padding: 0;
}

.ibb-item.clickable {
  cursor: pointer;
}

.ibb-item.clickable:hover {
  color: #ffffff;
}

.ibb-key {
  padding: 2px 7px;
  border-radius: 4px;
  background: #e8dfd0;
  color: #14161b;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
}

.ibb-mouse-icon {
  font-size: 13px;
  opacity: 0.82;
}

/* Transitions */
.card-pop-enter-active,
.card-pop-leave-active {
  transition:
    opacity 0.22s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.card-pop-enter-from,
.card-pop-leave-to {
  opacity: 0;
  transform: translateY(-50%) translateX(24px) scale(0.96);
}

.fade-up-enter-active,
.fade-up-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.fade-up-enter-from,
.fade-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 960px) {
  .ingame-dest-card {
    right: 16px;
    width: 286px;
  }

  .ingame-hud-bl {
    left: 16px;
    bottom: 64px;
  }

  .ingame-bottom-bar {
    left: 16px;
  }
}
</style>
