import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import mapCategoriesData from '../data/mapCategories.json'

// Lazy-loaded on demand ONLY when the 3D Puzzle Viewer is entered
let THREE = null
let OrbitControlsClass = null
let GLTFLoaderClass = null
let MeshoptDecoderRef = null

const STAGE_LOADERS = {
  stella: () => import('../data/stellaPuzzle.json'),
  refuge: () => import('../data/refugePuzzle.json'),
  fort: () => import('../data/fortPuzzle.json'),
  frigate: () => import('../data/frigatePuzzle.json'),
  walker: () => import('../data/walkerPuzzle.json'),
  caz: () => import('../data/cazPuzzle.json'),
}

const VALID_STAGE_KEYS = new Set(Object.keys(STAGE_LOADERS))

const EMPTY_PUZZLE = Object.freeze({
  stageName: '加载中...',
  subTitle: '',
  regionBadge: '',
  summary: '',
  modelUrl: '',
  center: [0, 0, 0],
  floors: [],
  walkthrough: [],
  nodes: [],
})

export const categoryMeta = {
  power: { label: '交互点位', color: '#10b981', badgeBg: '#065f46' },
  'puzzle-door': { label: '核心机关 / 门体', color: '#38bdf8', badgeBg: '#155e75' },
  'keycard-door': { label: '钥匙卡门', color: '#f472b6', badgeBg: '#831843' },
  'loot-room': { label: '地下室 / 密室', color: '#facc15', badgeBg: '#713f12' },
  room: { label: '核心舱室 / 金库区', color: '#facc15', badgeBg: '#713f12' },
  entry: { label: '入口 / 撤离点', color: '#fb923c', badgeBg: '#7c2d12' },
}

const circuitColors = {
  CORE: '#38bdf8',
  BTN: '#10b981',
  BAT: '#10b981',
  A: '#34d399',
  B: '#f59e0b',
  C: '#22d3ee',
  D: '#ef4444',
  E: '#fb923c',
}

const DEFAULT_NODE_BY_STAGE = {
  stella: 'wing-assembly',
  refuge: 'refuge-quad-relay',
  fort: 'fort-triple-relay',
  frigate: 'precious-cargo-ratchet',
  walker: 'sorting-matrix-maze',
  caz: 'power-station',
}

const DEFAULT_CLIP_BY_STAGE = {
  stella: 47.5,
  refuge: -268.0,
  fort: -220.0,
  frigate: 42.0,
  walker: 60.0,
  caz: -375.5,
}

export function useThreePuzzleEngine(viewportRef, stageKeyGetter, onStageChange) {
  const urlParams = new URLSearchParams(window.location.search)
  const rawStageParam = urlParams.get('stage')
  const propKey = stageKeyGetter()
  const initialStageKey =
    propKey && VALID_STAGE_KEYS.has(propKey)
      ? propKey
      : rawStageParam && VALID_STAGE_KEYS.has(rawStageParam)
        ? rawStageParam
        : 'refuge'

  const activeStageKey = ref(initialStageKey)
  const loadedStages = shallowRef({})

  async function ensureStageData(stageKey) {
    if (loadedStages.value[stageKey]) return loadedStages.value[stageKey]
    const loader = STAGE_LOADERS[stageKey] || STAGE_LOADERS.refuge
    const mod = await loader()
    const data = Object.freeze(mod.default || mod)
    loadedStages.value = { ...loadedStages.value, [stageKey]: data }
    return data
  }

  const mapCategories = mapCategoriesData.categories
  const activeMapCategory = computed(() => {
    for (const cat of mapCategories) {
      if (cat.stages.some((s) => s.stageKey === activeStageKey.value)) {
        return cat.id
      }
    }
    return 'blue-gate'
  })
  const selectedCategoryId = ref(activeMapCategory.value)
  watch(activeMapCategory, (v) => {
    selectedCategoryId.value = v
  })
  const currentCategoryStages = computed(() => {
    const cat = mapCategories.find((c) => c.id === selectedCategoryId.value) || mapCategories[0]
    return cat.stages
  })
  const currentPuzzle = computed(
    () => loadedStages.value[activeStageKey.value] || EMPTY_PUZZLE,
  )
  const isStella = computed(() => activeStageKey.value === 'stella')
  const isWalker = computed(() => activeStageKey.value === 'walker')
  const isFrigate = computed(() => activeStageKey.value === 'frigate')
  const isRefuge = computed(() => activeStageKey.value === 'refuge')
  const isFort = computed(() => activeStageKey.value === 'fort')
  const isBlueGate = computed(() => isRefuge.value || isFort.value)
  const isLargeShip = computed(() => isWalker.value || isFrigate.value || isStella.value)

  const loading = ref(true)
  const loadError = ref('')
  const modelStats = ref({ layers: 0, vertices: 0, triangles: 0 })

  const activeNodeId = ref(
    urlParams.get('node') || DEFAULT_NODE_BY_STAGE[initialStageKey] || 'refuge-quad-relay'
  )
  const activeCircuitFilter = ref('ALL')
  const autoClipOnSelect = ref(true)

  const activeMaze = ref(urlParams.get('maze') || 'maze_01')
  const activeRoute = ref(urlParams.get('route') || 'route_1a')
  const crusherAnimEnabled = ref(urlParams.get('crusher') !== '0')
  const crusherFixedAlpha =
    urlParams.get('crusherAlpha') !== null ? Number(urlParams.get('crusherAlpha')) : null
  const crusherStateLabel = ref('张开通行窗口 (21.0m)')
  const crusherClosurePct = ref(0)

  const activeRouteMeta = computed(() => {
    if (!isWalker.value || !currentPuzzle.value.routes) return null
    return currentPuzzle.value.routes.find((r) => r.id === activeRoute.value) || null
  })

  const minClipZ = computed(() => {
    if (isStella.value) return 4.0
    if (isRefuge.value) return -305.0
    if (isFort.value) return -260.0
    if (isFrigate.value) return -46.0
    if (isWalker.value) return -68.0
    return -396.0
  })
  const maxClipZ = computed(() => {
    if (isStella.value) return 85.0
    if (isRefuge.value) return -268.0
    if (isFort.value) return -220.0
    if (isFrigate.value) return 42.0
    if (isWalker.value) return 60.0
    return -355.0
  })
  const clipZ = ref(
    urlParams.get('clip') !== null
      ? Number(urlParams.get('clip'))
      : DEFAULT_CLIP_BY_STAGE[initialStageKey] ?? -268.0
  )

  const showRoof = ref(urlParams.get('hull') !== '0')
  const showTerrain = ref(true)
  const xrayShell = ref(urlParams.get('xray') === '1')
  const showWalkways = ref(true)
  const showDoors = ref(true)
  const showCables = ref(true)
  const showMachinery = ref(true)
  const showCircuits = ref(!['refuge', 'fort'].includes(initialStageKey))
  const showRoomVolumes = ref(true)
  const showMarkers = ref(true)
  const wireframe = ref(false)
  const flyMode = ref(false)
  const hud = ref({ x: 0, y: 0, z: 0 })

  const circuitTabs = computed(() => {
    if (isStella.value) {
      return [
        { id: 'ALL', label: '全部 (27)' },
        { id: 'A', label: '主翼区 (7)' },
        { id: 'B', label: '钥匙房 (4)' },
        { id: 'C', label: '撤离点 (6)' },
        { id: 'D', label: '跨层/隧道 (6)' },
        { id: 'E', label: '配电箱 (4)' },
      ]
    }
    if (isRefuge.value) {
      return [
        { id: 'ALL', label: '全部 (27)' },
        { id: 'BTN', label: '按钮点位 (24)' },
        { id: 'CORE', label: '地窖与中继 (3)' },
      ]
    }
    if (isFort.value) {
      return [
        { id: 'ALL', label: '全部 (17)' },
        { id: 'BAT', label: '电池刷新点 (11)' },
        { id: 'CORE', label: '配电箱与地窖 (6)' },
      ]
    }
    if (isFrigate.value) {
      return [
        { id: 'ALL', label: '全部 (25)' },
        { id: 'A', label: '阶段一：双舷战壕/吊桥' },
        { id: 'B', label: '阶段二：酸雾风扇/弱点门' },
        { id: 'D', label: '阶段三：10核护盾/脊中继' },
        { id: 'C', label: '阶段四/五：中枢核/货舱棘轮' },
        { id: 'E', label: '登舰口/顶底舱门' },
      ]
    }
    if (isWalker.value) {
      return [
        { id: 'ALL', label: '全部 (22)' },
        { id: 'A', label: '阶段一：底层中继' },
        { id: 'B', label: '阶段二：迷宫/压机' },
        { id: 'D', label: '阶段三：弹鼓/激光' },
        { id: 'C', label: '阶段四：耦合器金库' },
        { id: 'E', label: '入口/升降机/撤离' },
      ]
    }
    return [
      { id: 'ALL', label: '全部点位' },
      { id: 'A', label: '回路 A (上层供电)' },
      { id: 'B', label: '回路 B (底层金库)' },
      { id: 'C', label: '钥匙卡 C (中层)' },
      { id: 'E', label: '潜入/爬梯' },
    ]
  })

  const nodesById = computed(() => {
    const map = new Map()
    for (const n of currentPuzzle.value.nodes) map.set(n.id, n)
    return map
  })

  const filteredNodes = computed(() => {
    const list = currentPuzzle.value.nodes
    if (activeCircuitFilter.value === 'ALL') return list
    return list.filter((n) => n.circuit === activeCircuitFilter.value)
  })

  const activeNode = computed(
    () => nodesById.value.get(activeNodeId.value) || currentPuzzle.value.nodes[0]
  )

  const activeConnections = computed(() => {
    const cur = activeNode.value
    if (!cur) return { outgoing: [], incoming: [] }
    if (isWalker.value && currentPuzzle.value.routePaths) {
      const rDef = currentPuzzle.value.routePaths[activeRoute.value]
      if (!rDef || !rDef.segments) return { outgoing: [], incoming: [] }
      const outIds = new Set()
      const inIds = new Set()
      for (const seg of rDef.segments) {
        if (seg.fromId === cur.id && seg.toId) outIds.add(seg.toId)
        if (seg.toId === cur.id && seg.fromId) inIds.add(seg.fromId)
      }
      const outgoing = Array.from(outIds)
        .map((id) => nodesById.value.get(id))
        .filter(Boolean)
      const incoming = Array.from(inIds)
        .map((id) => nodesById.value.get(id))
        .filter(Boolean)
      return { outgoing, incoming }
    }
    const outgoing = (cur.connectsTo || []).map((id) => nodesById.value.get(id)).filter(Boolean)
    const incoming = currentPuzzle.value.nodes.filter((n) => (n.connectsTo || []).includes(cur.id))
    return { outgoing, incoming }
  })

  let renderer
  let scene
  let camera
  let controls
  let clipPlane
  let sliceHelperGrid
  let baseGrid
  let sunLight
  let fillLight
  let currentModelRoot = null
  let animId = 0
  let flyAnim = null
  let raycaster = null
  let pickMouse = null
  let needsRender = true
  let lastFrameTime = 0
  let tickFn = null

  function requestRender() {
    needsRender = true
    if (!animId && renderer && tickFn && !isUnmounted && !document.hidden) {
      lastFrameTime = performance.now()
      animId = requestAnimationFrame(tickFn)
    }
  }

  const layerMeshes = new Map()
  const markerSprites = new Map()
  const roomMeshes = new Map()
  let markerGroup
  let circuitGroup
  let roomGroup
  const keyState = new Set()

  function toThreeVec(ueX, ueY, ueZ) {
    return new THREE.Vector3(ueX, ueZ, ueY)
  }

  function makeBadgeTexture(node, isSelected) {
    const meta = categoryMeta[node.category] || categoryMeta.entry
    const isCompactPoint = isBlueGate.value && (node.circuit === 'BTN' || node.circuit === 'BAT')
    const text = isBlueGate.value
      ? isCompactPoint && !isSelected
        ? node.code
        : node.title
      : `${node.code} · ${node.title}`
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const font = '700 23px "Barlow Semi Condensed", "Barlow", "Microsoft YaHei UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.font = font
    const textW = Math.ceil(ctx.measureText(text).width)
    const padX = isCompactPoint && !isSelected ? 14 : 18
    const w = Math.max(isCompactPoint && !isSelected ? 74 : 136, textW + padX * 2)
    const h = 48
    canvas.width = w
    canvas.height = h

    ctx.font = font
    ctx.fillStyle = isSelected ? 'rgba(249, 238, 223, 0.97)' : 'rgba(9, 12, 25, 0.88)'
    ctx.strokeStyle = isSelected ? '#ffbc13' : meta.color
    ctx.lineWidth = isSelected ? 3.5 : 2

    const r = 10
    ctx.beginPath()
    ctx.moveTo(r, 3)
    ctx.lineTo(w - r, 3)
    ctx.quadraticCurveTo(w - 3, 3, w - 3, r)
    ctx.lineTo(w - 3, h - r)
    ctx.quadraticCurveTo(w - 3, h - 3, w - r, h - 3)
    ctx.lineTo(r, h - 3)
    ctx.quadraticCurveTo(3, h - 3, 3, h - r)
    ctx.lineTo(3, r)
    ctx.quadraticCurveTo(3, 3, r, 3)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = meta.color
    ctx.fillRect(9, 11, 5, h - 22)

    ctx.fillStyle = isSelected ? '#090c19' : '#f9eedf'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 20, h / 2 + 1)

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return { tex, aspect: w / h }
  }

  function disposeObject3D(root) {
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
          mat.dispose()
        }
      }
    })
  }

  function buildPuzzleOverlays() {
    if (!scene) return
    if (markerGroup) {
      scene.remove(markerGroup)
      disposeObject3D(markerGroup)
    }
    if (circuitGroup) {
      scene.remove(circuitGroup)
      disposeObject3D(circuitGroup)
    }
    if (roomGroup) {
      scene.remove(roomGroup)
      disposeObject3D(roomGroup)
    }

    markerGroup = new THREE.Group()
    circuitGroup = new THREE.Group()
    roomGroup = new THREE.Group()
    markerSprites.clear()
    roomMeshes.clear()

    const nodes = currentPuzzle.value.nodes

    for (const node of nodes) {
      if (!node.box) continue
      let bx, by, bz
      let centerVec
      if (Array.isArray(node.box)) {
        ;[bx, by, bz] = node.box
        centerVec = toThreeVec(node.x, node.y, node.z)
      } else if (node.box.min && node.box.max) {
        const [minX, minY, minZ] = node.box.min
        const [maxX, maxY, maxZ] = node.box.max
        bx = Math.abs(maxX - minX)
        by = Math.abs(maxZ - minZ)
        bz = Math.abs(maxY - minY)
        centerVec = toThreeVec((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5)
      } else {
        continue
      }

      const geom = new THREE.BoxGeometry(bx, by, bz)
      const color = new THREE.Color(circuitColors[node.circuit] || '#22d3ee')
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geom, mat)
      mesh.position.copy(centerVec)
      if (node.yaw && Array.isArray(node.box)) {
        mesh.rotation.y = -THREE.MathUtils.degToRad(node.yaw)
      }

      const edges = new THREE.EdgesGeometry(geom)
      const lineMat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.58,
      })
      const wire = new THREE.LineSegments(edges, lineMat)
      mesh.add(wire)

      roomGroup.add(mesh)
      roomMeshes.set(node.id, { mesh, mat, lineMat })
    }

    if (currentPuzzle.value.routePaths) {
      const routeEntries = Object.entries(currentPuzzle.value.routePaths)
      for (const [routeKey, routeDef] of routeEntries) {
        const routeColor = routeDef.color || '#10b981'
        for (const seg of routeDef.segments || []) {
          if (!seg.points || seg.points.length < 2) continue
          const vecs = seg.points.map(([px, py, pz]) => toThreeVec(px, py, pz + 0.9))
          const maxZ = Math.max(...seg.points.map((p) => p[2]))
          const curve = new THREE.CatmullRomCurve3(vecs, false, 'centripetal', 0.25)
          const tubeGeom = new THREE.TubeGeometry(
            curve,
            Math.max(28, vecs.length * 14),
            0.48,
            10,
            false
          )
          const tubeMat = new THREE.MeshBasicMaterial({
            color: seg.color || routeColor,
            transparent: true,
            opacity: 0.94,
          })
          const tube = new THREE.Mesh(tubeGeom, tubeMat)
          tube.userData = {
            routeId: routeKey,
            from: seg.fromId,
            to: seg.toId,
            label: seg.label,
            maxZ,
          }
          circuitGroup.add(tube)

          const xrayGeom = new THREE.TubeGeometry(
            curve,
            Math.max(24, vecs.length * 12),
            0.2,
            8,
            false
          )
          const xrayMat = new THREE.MeshBasicMaterial({
            color: seg.color || routeColor,
            transparent: true,
            opacity: 0.44,
            depthTest: false,
          })
          const xrayTube = new THREE.Mesh(xrayGeom, xrayMat)
          xrayTube.renderOrder = 5
          xrayTube.userData = {
            routeId: routeKey,
            maxZ,
          }
          circuitGroup.add(xrayTube)

          for (let i = 1; i < seg.points.length - 1; i++) {
            const [wx, wy, wz] = seg.points[i]
            const wpGeom = new THREE.SphereGeometry(0.95, 14, 14)
            const wpMat = new THREE.MeshBasicMaterial({
              color: seg.color || routeColor,
              transparent: true,
              opacity: 0.88,
              depthTest: false,
            })
            const wpMesh = new THREE.Mesh(wpGeom, wpMat)
            wpMesh.renderOrder = 6
            wpMesh.position.copy(toThreeVec(wx, wy, wz + 0.9))
            wpMesh.userData = {
              routeId: routeKey,
              maxZ: wz,
            }
            circuitGroup.add(wpMesh)
          }
        }
      }
    } else {
      const tubeRadius = isLargeShip.value ? 0.22 : 0.08
      for (const src of nodes) {
        if (!src.connectsTo || src.connectsTo.length === 0) continue
        const p0 = toThreeVec(src.x, src.y, src.z + 0.6)
        const colorHex = circuitColors[src.circuit] || '#22d3ee'

        for (const targetId of src.connectsTo) {
          const dst = nodesById.value.get(targetId)
          if (!dst) continue
          const p1 = toThreeVec(dst.x, dst.y, dst.z + 0.6)
          const mid = p0.clone().lerp(p1, 0.5)
          mid.y += Math.max(1.2, p0.distanceTo(p1) * 0.1)

          const curve = new THREE.CatmullRomCurve3([p0, mid, p1])
          const tubeGeom = new THREE.TubeGeometry(curve, 28, tubeRadius, 8, false)
          const tubeMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.85,
          })
          const tube = new THREE.Mesh(tubeGeom, tubeMat)
          tube.userData = {
            from: src.id,
            to: dst.id,
            circuit: src.circuit,
            maxZ: Math.max(src.z, dst.z),
          }
          circuitGroup.add(tube)
        }
      }
    }

    const beaconScale = isLargeShip.value ? 2.1 : isBlueGate.value ? 0.85 : 1.0
    for (const node of nodes) {
      const meta = categoryMeta[node.category] || categoryMeta.entry
      const pos = toThreeVec(node.x, node.y, node.z)
      const nodeHolder = new THREE.Group()
      nodeHolder.position.copy(pos)

      const isRoom = node.category === 'loot-room' || node.category === 'room'
      const sphereGeom = new THREE.SphereGeometry((isRoom ? 0.36 : 0.28) * beaconScale, 16, 16)
      const sphereMat = new THREE.MeshBasicMaterial({ color: meta.color })
      const sphere = new THREE.Mesh(sphereGeom, sphereMat)
      sphere.position.y = 0.3 * beaconScale
      nodeHolder.add(sphere)

      const ringGeom = new THREE.RingGeometry(0.42 * beaconScale, 0.65 * beaconScale, 24)
      ringGeom.rotateX(-Math.PI / 2)
      const ringMat = new THREE.MeshBasicMaterial({
        color: meta.color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
      })
      const ring = new THREE.Mesh(ringGeom, ringMat)
      ring.position.y = 0.12 * beaconScale
      nodeHolder.add(ring)

      const stemHeight = (isRoom ? 2.2 : 1.55) * beaconScale
      const stemGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.3 * beaconScale, 0),
        new THREE.Vector3(0, stemHeight, 0),
      ])
      const stemMat = new THREE.LineBasicMaterial({ color: meta.color })
      nodeHolder.add(new THREE.Line(stemGeom, stemMat))

      const isSel = node.id === activeNodeId.value
      const { tex, aspect } = makeBadgeTexture(node, isSel)
      const spriteMat = new THREE.SpriteMaterial({
        map: tex,
        depthTest: false,
        transparent: true,
      })
      const sprite = new THREE.Sprite(spriteMat)
      const h = (isSel ? 1.25 : 0.95) * beaconScale
      sprite.scale.set(h * aspect, h, 1)
      sprite.position.set(0, stemHeight + 0.5 * beaconScale, 0)
      sprite.renderOrder = isSel ? 20 : 10
      sprite.userData = { nodeId: node.id }
      nodeHolder.add(sprite)

      markerSprites.set(node.id, {
        holder: nodeHolder,
        sprite,
        ring,
        aspect,
        worldPos: pos.clone(),
        ueZ: node.z,
        circuit: node.circuit,
      })
      markerGroup.add(nodeHolder)
    }

    scene.add(roomGroup)
    scene.add(circuitGroup)
    scene.add(markerGroup)
    syncVisibility()
  }

  function updateMarkerSelection() {
    for (const node of currentPuzzle.value.nodes) {
      const entry = markerSprites.get(node.id)
      if (!entry) continue
      const isSel = node.id === activeNodeId.value
      if (entry.sprite.material.map) entry.sprite.material.map.dispose()
      const { tex, aspect } = makeBadgeTexture(node, isSel)
      entry.aspect = aspect
      entry.sprite.material.map = tex
      entry.sprite.material.needsUpdate = true
      entry.sprite.renderOrder = isSel ? 30 : 10
      entry.ring.scale.setScalar(isSel ? 1.5 : 1.0)
    }

    for (const [id, rm] of roomMeshes.entries()) {
      const isSel = id === activeNodeId.value
      rm.mat.opacity = isSel ? 0.2 : 0.07
      rm.lineMat.opacity = isSel ? 0.92 : 0.42
    }
    syncVisibility()
  }

  function syncVisibility() {
    if (!scene) return
    clipPlane.constant = clipZ.value

    if (sliceHelperGrid) {
      sliceHelperGrid.position.y = clipZ.value
      sliceHelperGrid.visible = clipZ.value < maxClipZ.value - 1.0
    }

    if (baseGrid) {
      baseGrid.visible = !(isBlueGate.value && showTerrain.value)
    }

    for (const [name, meshList] of layerMeshes.entries()) {
      let vis = true
      if (name === 'roof_ceiling') vis = showRoof.value
      else if (name === 'terrain') vis = showTerrain.value
      else if (name === 'walkways') vis = showWalkways.value
      else if (name === 'doors') vis = showDoors.value
      else if (name === 'cables') vis = showCables.value
      else if (name === 'machinery' || name === 'crusher_left' || name === 'crusher_right') {
        vis = showMachinery.value
      } else if (name.startsWith('maze_')) {
        vis = activeMaze.value === 'all' || activeMaze.value === name
      } else if (name.startsWith('route_')) {
        vis = activeRoute.value === 'all' || activeRoute.value === name
      }

      const isShell = name === 'shell_walls' || name === 'roof_ceiling'
      for (const m of meshList) {
        m.visible = vis
        if (m.material) {
          m.material.wireframe = wireframe.value
          if (isShell) {
            m.material.transparent = xrayShell.value
            m.material.opacity = xrayShell.value ? 0.2 : 1.0
            m.material.depthWrite = !xrayShell.value
          }
        }
      }
    }

    if (markerGroup) {
      markerGroup.visible = showMarkers.value
      for (const [id, entry] of markerSprites.entries()) {
        const matchFilter =
          activeCircuitFilter.value === 'ALL' || entry.circuit === activeCircuitFilter.value
        entry.holder.visible =
          matchFilter && (id === activeNodeId.value || entry.ueZ <= clipZ.value + 3.0)
      }
    }
    if (circuitGroup) {
      circuitGroup.visible = showCircuits.value
      for (const child of circuitGroup.children) {
        const maxZ = child.userData?.maxZ ?? -390
        const routeId = child.userData?.routeId
        const routeMatch =
          !routeId || activeRoute.value === 'all' || routeId === activeRoute.value
        child.visible = routeMatch && maxZ <= clipZ.value + 3.5
      }
    }
    if (roomGroup) {
      roomGroup.visible = showRoomVolumes.value
      for (const [id, rm] of roomMeshes.entries()) {
        const n = nodesById.value.get(id)
        rm.mesh.visible = id === activeNodeId.value || !n || n.z <= clipZ.value + 4.0
      }
    }
    requestRender()
  }

  watch(
    [
      clipZ,
      showRoof,
      showTerrain,
      xrayShell,
      showWalkways,
      showDoors,
      showCables,
      showMachinery,
      showCircuits,
      showRoomVolumes,
      showMarkers,
      wireframe,
      activeMaze,
      activeRoute,
      activeCircuitFilter,
    ],
    syncVisibility
  )

  watch(activeNodeId, () => {
    updateMarkerSelection()
  })

  async function switchStage(stageKey) {
    if (activeStageKey.value === stageKey) return
    activeStageKey.value = stageKey
    if (onStageChange) onStageChange(stageKey)
    activeCircuitFilter.value = 'ALL'
    clipZ.value = DEFAULT_CLIP_BY_STAGE[stageKey] ?? -268.0
    showRoof.value = true
    showTerrain.value = true
    showCircuits.value = !['refuge', 'fort'].includes(stageKey)
    xrayShell.value = false
    activeNodeId.value = DEFAULT_NODE_BY_STAGE[stageKey] || 'refuge-quad-relay'
    loading.value = true
    await ensureStageData(stageKey)
    if (activeStageKey.value !== stageKey || !scene) return
    reconfigureStageEnvironment()
    buildPuzzleOverlays()
    loadPuzzleModel()
    setOverview(false)
  }

  function selectMapCategoryTab(cat) {
    selectedCategoryId.value = cat.id
    if (!cat.stages.some((s) => s.stageKey === activeStageKey.value) && cat.stages.length > 0) {
      switchStage(cat.stages[0].stageKey)
    }
  }

  watch(stageKeyGetter, (newKey) => {
    if (newKey && VALID_STAGE_KEYS.has(newKey) && newKey !== activeStageKey.value) {
      switchStage(newKey)
    }
  })

  function selectNode(node, shouldFly = true) {
    activeNodeId.value = node.id
    if (autoClipOnSelect.value && typeof node.recommendedClipZ === 'number') {
      clipZ.value = node.recommendedClipZ
    }
    if (shouldFly) {
      flyToNode(node)
    }
  }

  function selectWalkthrough(step) {
    const target = nodesById.value.get(step.focusId)
    if (target) selectNode(target, true)
  }

  function applyFloorPreset(floor) {
    clipZ.value = floor.clipZ
  }

  function flyToNode(node) {
    if (!camera || !controls) return
    const targetPos = toThreeVec(node.x, node.y, node.z + 0.8)
    const isRoom = node.category === 'loot-room' || node.category === 'room'
    const baseDist = isStella.value
      ? isRoom
        ? 58
        : 32
      : isLargeShip.value
        ? isRoom
          ? 48
          : 30
        : isRoom
          ? 20
          : 13
    const yawRad = THREE.MathUtils.degToRad((node.yaw || 0) - 38)
    const camTargetPos = new THREE.Vector3(
      targetPos.x + Math.cos(yawRad) * baseDist,
      targetPos.y + baseDist * 0.68,
      targetPos.z + Math.sin(yawRad) * baseDist
    )

    flyAnim = {
      startCam: camera.position.clone(),
      endCam: camTargetPos,
      startTarget: controls.target.clone(),
      endTarget: targetPos,
      t0: performance.now(),
      duration: 550,
    }
    requestRender()
  }

  function setOverview(topDown = false) {
    if (!camera || !controls) return
    const [cx, cy, cz] = currentPuzzle.value.center
    const targetPos = toThreeVec(cx, cy, cz)
    let endCam
    if (isStella.value) {
      endCam = topDown
        ? new THREE.Vector3(cx, cz + 315, cy + 0.01)
        : new THREE.Vector3(cx + 150, cz + 155, cy + 175)
    } else if (isFrigate.value) {
      endCam = topDown
        ? new THREE.Vector3(cx, cz + 240, cy + 0.01)
        : new THREE.Vector3(cx + 125, cz + 96, cy + 142)
    } else if (isWalker.value) {
      endCam = topDown
        ? new THREE.Vector3(cx, cz + 230, cy + 0.01)
        : new THREE.Vector3(cx + 115, cz + 92, cy + 135)
    } else if (isRefuge.value) {
      endCam = topDown
        ? new THREE.Vector3(cx, cz + 115, cy + 0.01)
        : new THREE.Vector3(cx + 48, cz + 44, cy + 54)
    } else if (isFort.value) {
      endCam = topDown
        ? new THREE.Vector3(cx, cz + 135, cy + 0.01)
        : new THREE.Vector3(cx + 58, cz + 52, cy + 64)
    } else {
      endCam = topDown
        ? new THREE.Vector3(cx, cz + 115, cy + 0.01)
        : new THREE.Vector3(cx - 48, cz + 52, cy + 56)
    }

    flyAnim = {
      startCam: camera.position.clone(),
      endCam,
      startTarget: controls.target.clone(),
      endTarget: targetPos,
      t0: performance.now(),
      duration: 500,
    }
    requestRender()
  }

  function reconfigureStageEnvironment() {
    if (!scene) return
    const [cx, cy, cz] = currentPuzzle.value.center
    if (sunLight) {
      sunLight.position.set(cx - 90, cz + 160, cy - 80)
    }
    if (fillLight) {
      fillLight.position.set(cx + 110, cz + 80, cy + 100)
    }
    if (baseGrid) {
      const gridY = isStella.value
        ? 4.0
        : isFrigate.value
          ? -48.0
          : isWalker.value
            ? -68.0
            : isRefuge.value
              ? -304.0
              : isFort.value
                ? -260.0
                : -400.0
      baseGrid.position.set(cx, gridY, cy)
      baseGrid.scale.setScalar(isStella.value ? 2.8 : isLargeShip.value ? 1.8 : 0.85)
    }
    if (sliceHelperGrid) {
      sliceHelperGrid.position.set(cx, clipZ.value, cy)
      sliceHelperGrid.scale.set(
        isStella.value ? 3.2 : isFrigate.value ? 2.2 : isWalker.value ? 1.75 : isBlueGate.value ? 0.68 : 1.0,
        1.0,
        isStella.value ? 2.6 : isFrigate.value ? 1.5 : isWalker.value ? 1.25 : isBlueGate.value ? 0.68 : 1.0
      )
    }
  }

  function loadPuzzleModel() {
    if (!GLTFLoaderClass) return
    const loader = new GLTFLoaderClass()
    if (MeshoptDecoderRef) loader.setMeshoptDecoder(MeshoptDecoderRef)
    loading.value = true
    loadError.value = ''

    if (currentModelRoot && scene) {
      scene.remove(currentModelRoot)
      disposeObject3D(currentModelRoot)
      currentModelRoot = null
    }
    layerMeshes.clear()

    const targetUrl = currentPuzzle.value.modelUrl
    if (!targetUrl) return
    loader.load(
      targetUrl,
      (gltf) => {
        if (!scene || currentPuzzle.value.modelUrl !== targetUrl) {
          disposeObject3D(gltf.scene)
          return
        }
        const root = gltf.scene
        currentModelRoot = root
        let verts = 0
        let tris = 0
        let layersCount = 0

        root.traverse((obj) => {
          if (!obj.isMesh) return
          const layerName = obj.name || obj.parent?.name || 'shell_walls'
          const isRouteOrMaze = layerName.startsWith('maze_') || layerName.startsWith('route_')
          const isCrusher = layerName === 'crusher_left' || layerName === 'crusher_right'
          const isTerrain = layerName === 'terrain'
          if (obj.material) {
            const oldMats = Array.isArray(obj.material) ? obj.material : [obj.material]
            for (const m of oldMats) m?.dispose?.()
          }
          const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: isTerrain
              ? 0.94
              : isCrusher
                ? 0.42
                : layerName === 'doors' || layerName === 'machinery' || isRouteOrMaze
                  ? 0.5
                  : 0.8,
            metalness: isTerrain
              ? 0.02
              : isCrusher
                ? 0.34
                : layerName === 'doors' || layerName === 'walkways' || isRouteOrMaze
                  ? 0.25
                  : 0.08,
            side: THREE.DoubleSide,
            clippingPlanes: isTerrain ? [] : [clipPlane],
            clipShadows: !isTerrain,
          })
          obj.material = mat
          obj.userData.baseZ = obj.position.z
          if (obj.geometry && !obj.geometry.boundingSphere) {
            obj.geometry.computeBoundingSphere()
          }

          if (!layerMeshes.has(layerName)) {
            layerMeshes.set(layerName, [])
            layersCount++
          }
          layerMeshes.get(layerName).push(obj)

          const posAttr = obj.geometry.attributes.position
          const idxAttr = obj.geometry.index
          if (posAttr) verts += posAttr.count
          if (idxAttr) tris += Math.round(idxAttr.count / 3)
        })

        scene.add(root)
        modelStats.value = { layers: layersCount, vertices: verts, triangles: tris }
        loading.value = false
        syncVisibility()
      },
      undefined,
      (err) => {
        loadError.value = err?.message || String(err)
        loading.value = false
        requestRender()
      }
    )
  }

  let flyYaw = 0
  let flyPitch = 0
  let isLookDragging = false
  let lastPointerX = 0
  let lastPointerY = 0
  let pointerDownX = 0
  let pointerDownY = 0
  let savedOrbitDist = 45

  function syncFlyAnglesFromCamera() {
    if (!camera) return
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    flyPitch = Math.asin(THREE.MathUtils.clamp(forward.y, -0.999, 0.999))
    flyYaw = Math.atan2(-forward.x, -forward.z)
    camera.rotation.order = 'YXZ'
    camera.rotation.set(flyPitch, flyYaw, 0, 'YXZ')
  }

  watch(flyMode, (enabled) => {
    if (!camera || !controls) return
    if (enabled) {
      savedOrbitDist = Math.max(8, Math.min(160, camera.position.distanceTo(controls.target)))
      syncFlyAnglesFromCamera()
      controls.enabled = false
    } else {
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward)
      controls.target.copy(camera.position).addScaledVector(forward, savedOrbitDist)
      controls.enabled = true
      controls.update()
    }
    requestRender()
  })

  watch(crusherAnimEnabled, () => {
    requestRender()
  })

  function pickMarkerAt(clientX, clientY) {
    if (!markerGroup || !viewportRef.value) return
    const rect = viewportRef.value.getBoundingClientRect()
    if (!pickMouse) pickMouse = new THREE.Vector2()
    pickMouse.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    if (!raycaster) raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(pickMouse, camera)
    const sprites = Array.from(markerSprites.values()).map((v) => v.sprite)
    const hits = raycaster.intersectObjects(sprites, false)
    if (hits.length > 0) {
      const id = hits[0].object.userData?.nodeId
      const node = nodesById.value.get(id)
      if (node) selectNode(node, true)
    }
  }

  function onPointerDown(e) {
    if (!viewportRef.value) return
    pointerDownX = e.clientX
    pointerDownY = e.clientY
    lastPointerX = e.clientX
    lastPointerY = e.clientY

    if (flyMode.value && (e.button === 0 || e.button === 2)) {
      isLookDragging = true
      flyAnim = null
      try {
        renderer?.domElement?.setPointerCapture(e.pointerId)
      } catch {}
    }
    requestRender()
  }

  function onPointerMove(e) {
    if (e.buttons !== 0) requestRender()
    if (!flyMode.value || !isLookDragging || !camera) return
    const dx = e.clientX - lastPointerX
    const dy = e.clientY - lastPointerY
    lastPointerX = e.clientX
    lastPointerY = e.clientY

    const sensitivity = 0.0028
    flyYaw -= dx * sensitivity
    flyPitch = THREE.MathUtils.clamp(
      flyPitch - dy * sensitivity,
      -Math.PI * 0.485,
      Math.PI * 0.485
    )
    camera.rotation.order = 'YXZ'
    camera.rotation.set(flyPitch, flyYaw, 0, 'YXZ')

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    controls.target.copy(camera.position).addScaledVector(forward, savedOrbitDist)
    requestRender()
  }

  function onPointerUp(e) {
    if (isLookDragging) {
      isLookDragging = false
      try {
        renderer?.domElement?.releasePointerCapture(e.pointerId)
      } catch {}
    }
    if (e.button === 0 && Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY) < 5) {
      pickMarkerAt(e.clientX, e.clientY)
    }
    requestRender()
  }

  function onWheel(e) {
    requestRender()
    if (!flyMode.value || !camera) return
    e.preventDefault()
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const step = (e.deltaY < 0 ? 1 : -1) * (keyState.has('shift') ? 16 : 7)
    camera.position.addScaledVector(forward, step)
    controls.target.copy(camera.position).addScaledVector(forward, savedOrbitDist)
  }

  function onKey(e, down) {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
    const k = e.key.toLowerCase()
    if (down) {
      keyState.add(k)
      if (!flyMode.value && ['w', 'a', 's', 'd', 'q', 'e'].includes(k)) {
        flyMode.value = true
      }
      requestRender()
    } else {
      keyState.delete(k)
    }
  }

  function stepFlyCamera(dt) {
    if (!flyMode.value || keyState.size === 0 || !camera) return
    flyAnim = null
    const speed = (keyState.has('shift') ? 65 : 26) * dt
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
    const delta = new THREE.Vector3()
    if (keyState.has('w')) delta.addScaledVector(forward, speed)
    if (keyState.has('s')) delta.addScaledVector(forward, -speed)
    if (keyState.has('d')) delta.addScaledVector(right, speed)
    if (keyState.has('a')) delta.addScaledVector(right, -speed)
    if (keyState.has('e') || keyState.has(' ')) delta.y += speed
    if (keyState.has('q') || keyState.has('c')) delta.y -= speed
    camera.position.add(delta)
    controls.target.copy(camera.position).addScaledVector(forward, savedOrbitDist)
  }

  function focusCrusherChamber() {
    const n = nodesById.value.get('compactor-press-left')
    if (n) {
      clipZ.value = -4.0
      selectNode(n, true)
    }
  }

  function updateWalkerCrushers(now) {
    if (!isWalker.value) return
    const spec = currentPuzzle.value.crusherSpec || {
      strokeMeters: 9.45,
      cycleSeconds: 9.0,
      openHoldSeconds: 2.0,
      slamSeconds: 1.1,
      closedHoldSeconds: 1.7,
      retractSeconds: 4.2,
    }

    let alpha = 0
    if (crusherFixedAlpha !== null && !Number.isNaN(crusherFixedAlpha)) {
      alpha = THREE.MathUtils.clamp(crusherFixedAlpha, 0, 1)
      crusherStateLabel.value =
        alpha > 0.5 ? '闭合锁死 (齿缝 2.1m)' : '张开通行窗口 (21.0m)'
    } else if (crusherAnimEnabled.value) {
      const t = (now / 1000) % spec.cycleSeconds
      const tOpen = spec.openHoldSeconds
      const tSlam = tOpen + spec.slamSeconds
      const tClosed = tSlam + spec.closedHoldSeconds

      if (t < tOpen) {
        alpha = 0
        crusherStateLabel.value = '张开通行窗口 (21.0m)'
      } else if (t < tSlam) {
        const u = (t - tOpen) / spec.slamSeconds
        alpha = u * u * (3 - 2 * u)
        crusherStateLabel.value = '高速合拢冲压中!'
      } else if (t < tClosed) {
        alpha = 1
        crusherStateLabel.value = '闭合锁死 (齿缝 2.1m)'
      } else {
        const u = (t - tClosed) / spec.retractSeconds
        alpha = Math.pow(Math.max(0, 1 - u), 1.8)
        crusherStateLabel.value = '液压回退张开中...'
      }
    } else {
      alpha = crusherClosurePct.value / 100
    }

    crusherClosurePct.value = Math.round(alpha * 100)
    const stroke = (spec.strokeMeters || 9.45) * alpha

    const leftMeshes = layerMeshes.get('crusher_left')
    if (leftMeshes) {
      for (const m of leftMeshes) m.position.z = (m.userData.baseZ || 0) - stroke
    }
    const rightMeshes = layerMeshes.get('crusher_right')
    if (rightMeshes) {
      for (const m of rightMeshes) m.position.z = (m.userData.baseZ || 0) + stroke
    }

    const leftMarker = markerSprites.get('compactor-press-left')
    if (leftMarker) {
      leftMarker.holder.position.z = 15.9 - stroke
      leftMarker.worldPos.z = 15.9 - stroke
    }
    const rightMarker = markerSprites.get('compactor-press-right')
    if (rightMarker) {
      rightMarker.holder.position.z = -15.9 + stroke
      rightMarker.worldPos.z = -15.9 + stroke
    }
  }

  function onResize() {
    if (!viewportRef.value || !renderer) return
    const { clientWidth: w, clientHeight: h } = viewportRef.value
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
    requestRender()
  }

  let cleanupListeners = null
  let isUnmounted = false

  onMounted(async () => {
    const el = viewportRef.value
    if (!el) return

    loading.value = true
    try {
      const [threeMod, orbitMod, gltfMod, meshoptMod] = await Promise.all([
        THREE ? Promise.resolve(THREE) : import('three'),
        OrbitControlsClass
          ? Promise.resolve({ OrbitControls: OrbitControlsClass })
          : import('three/examples/jsm/controls/OrbitControls.js'),
        GLTFLoaderClass
          ? Promise.resolve({ GLTFLoader: GLTFLoaderClass })
          : import('three/examples/jsm/loaders/GLTFLoader.js'),
        MeshoptDecoderRef
          ? Promise.resolve({ MeshoptDecoder: MeshoptDecoderRef })
          : import('three/examples/jsm/libs/meshopt_decoder.module.js'),
        ensureStageData(activeStageKey.value),
      ])
      THREE = threeMod
      OrbitControlsClass = orbitMod.OrbitControls
      GLTFLoaderClass = gltfMod.GLTFLoader
      MeshoptDecoderRef = meshoptMod.MeshoptDecoder
    } catch (err) {
      loadError.value = err?.message || String(err)
      loading.value = false
      return
    }

    if (isUnmounted || !viewportRef.value) return

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.localClippingEnabled = true
    el.appendChild(renderer.domElement)

    scene = new THREE.Scene()
    scene.background = new THREE.Color('#090c19')
    scene.fog = new THREE.FogExp2('#090c19', 0.0014)

    clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), clipZ.value)

    camera = new THREE.PerspectiveCamera(48, el.clientWidth / Math.max(1, el.clientHeight), 0.3, 1400)
    controls = new OrbitControlsClass(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxDistance = 520
    controls.minDistance = 2
    controls.addEventListener('start', requestRender)
    controls.addEventListener('change', requestRender)

    const [cx, cy, cz] = currentPuzzle.value.center

    scene.add(new THREE.HemisphereLight(0xe2e8f0, 0x1e293b, 1.18))
    sunLight = new THREE.DirectionalLight(0xfff7ed, 1.38)
    scene.add(sunLight)
    fillLight = new THREE.DirectionalLight(0x38bdf8, 0.58)
    scene.add(fillLight)

    baseGrid = new THREE.GridHelper(160, 32, 0x2e3240, 0x151a2b)
    scene.add(baseGrid)

    const sliceRimGeom = new THREE.EdgesGeometry(new THREE.PlaneGeometry(126, 108))
    sliceRimGeom.rotateX(-Math.PI / 2)
    sliceHelperGrid = new THREE.LineSegments(
      sliceRimGeom,
      new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
    )
    scene.add(sliceHelperGrid)

    reconfigureStageEnvironment()

    if (isStella.value) {
      camera.position.set(cx + 150, cz + 155, cy + 175)
    } else if (isFrigate.value) {
      camera.position.set(cx + 125, cz + 96, cy + 142)
    } else if (isWalker.value) {
      camera.position.set(cx + 115, cz + 92, cy + 135)
    } else if (isRefuge.value) {
      camera.position.set(cx + 48, cz + 44, cy + 54)
    } else if (isFort.value) {
      camera.position.set(cx + 58, cz + 52, cy + 64)
    } else {
      camera.position.set(cx - 48, cz + 52, cy + 56)
    }
    controls.target.set(cx, cz, cy)
    controls.update()
    syncFlyAnglesFromCamera()

    buildPuzzleOverlays()
    loadPuzzleModel()

    const keyDown = (e) => onKey(e, true)
    const keyUp = (e) => onKey(e, false)
    const preventContextMenu = (e) => {
      if (flyMode.value) e.preventDefault()
    }
    const onVisibilityChange = () => {
      if (!document.hidden) requestRender()
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null
    ro?.observe(el)
    window.addEventListener('resize', onResize)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    document.addEventListener('visibilitychange', onVisibilityChange)
    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointercancel', onPointerUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
    renderer.domElement.addEventListener('contextmenu', preventContextMenu)

    cleanupListeners = () => {
      ro?.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      controls?.removeEventListener('start', requestRender)
      controls?.removeEventListener('change', requestRender)
      renderer?.domElement?.removeEventListener('pointerdown', onPointerDown)
      renderer?.domElement?.removeEventListener('pointermove', onPointerMove)
      renderer?.domElement?.removeEventListener('pointerup', onPointerUp)
      renderer?.domElement?.removeEventListener('pointercancel', onPointerUp)
      renderer?.domElement?.removeEventListener('wheel', onWheel)
      renderer?.domElement?.removeEventListener('contextmenu', preventContextMenu)
    }

    lastFrameTime = performance.now()
    tickFn = (now) => {
      if (isUnmounted || !renderer || !scene || !camera) {
        animId = 0
        return
      }
      needsRender = false
      const dt = Math.min(0.1, (now - lastFrameTime) / 1000)
      lastFrameTime = now

      if (flyAnim) {
        const u = Math.min(1, (now - flyAnim.t0) / flyAnim.duration)
        const ease = 1 - Math.pow(1 - u, 3)
        camera.position.lerpVectors(flyAnim.startCam, flyAnim.endCam, ease)
        controls.target.lerpVectors(flyAnim.startTarget, flyAnim.endTarget, ease)
        camera.lookAt(controls.target)
        syncFlyAnglesFromCamera()
        if (u >= 1) flyAnim = null
      }

      stepFlyCamera(dt)
      const controlsMoved = !flyMode.value && controls ? controls.update() : false
      updateWalkerCrushers(now)
      const scaleFactor = isLargeShip.value ? 0.015 : 0.014
      const maxBadgeH = isLargeShip.value ? 3.2 : 1.35
      for (const [id, entry] of markerSprites.entries()) {
        if (!entry.holder.visible) continue
        const d = camera.position.distanceTo(entry.worldPos)
        const h =
          THREE.MathUtils.clamp(d * scaleFactor, 0.28, maxBadgeH) *
          (id === activeNodeId.value ? 1.22 : 1.0)
        entry.sprite.scale.set(h * entry.aspect, h, 1)
      }
      const hudRef = flyMode.value ? camera.position : controls.target
      const nx = Math.round(hudRef.x)
      const ny = Math.round(hudRef.z)
      const nz = Math.round(hudRef.y * 10) / 10
      if (nx !== hud.value.x || ny !== hud.value.y || nz !== hud.value.z) {
        hud.value = { x: nx, y: ny, z: nz }
      }
      renderer.render(scene, camera)

      const orbitDragging = !flyMode.value && controls && controls.state !== -1
      const flyActive =
        Boolean(flyAnim) || (flyMode.value && (keyState.size > 0 || isLookDragging))
      const walkerAnimating =
        isWalker.value &&
        crusherAnimEnabled.value &&
        (crusherFixedAlpha === null || Number.isNaN(crusherFixedAlpha))
      const keepRunning =
        !document.hidden &&
        (needsRender || controlsMoved || orbitDragging || flyActive || walkerAnimating)

      if (keepRunning) {
        animId = requestAnimationFrame(tickFn)
      } else {
        animId = 0
      }
    }
    animId = requestAnimationFrame(tickFn)
  })

  onBeforeUnmount(() => {
    isUnmounted = true
    cancelAnimationFrame(animId)
    animId = 0
    tickFn = null
    cleanupListeners?.()
    if (scene) {
      disposeObject3D(scene)
      scene.clear()
      scene = null
    }
    controls?.dispose?.()
    if (renderer) {
      renderer.domElement?.parentNode?.removeChild(renderer.domElement)
      renderer.dispose()
      renderer = null
    }
  })

  return {
    activeStageKey,
    mapCategories,
    selectedCategoryId,
    currentCategoryStages,
    currentPuzzle,
    isStella,
    isWalker,
    isFrigate,
    isRefuge,
    isFort,
    isBlueGate,
    loading,
    loadError,
    modelStats,
    activeNodeId,
    activeCircuitFilter,
    autoClipOnSelect,
    activeMaze,
    activeRoute,
    crusherAnimEnabled,
    crusherStateLabel,
    crusherClosurePct,
    activeRouteMeta,
    minClipZ,
    maxClipZ,
    clipZ,
    showRoof,
    showTerrain,
    xrayShell,
    showWalkways,
    showDoors,
    showCables,
    showMachinery,
    showCircuits,
    showRoomVolumes,
    wireframe,
    flyMode,
    hud,
    circuitTabs,
    filteredNodes,
    activeNode,
    activeConnections,
    switchStage,
    selectMapCategoryTab,
    selectNode,
    selectWalkthrough,
    applyFloorPreset,
    setOverview,
    focusCrusherChamber,
  }
}
