import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ICONS, SPECIFIC_EVENT_MARKERS } from './verifiedTrialPoisAndArcs.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VERIFIED_ACTORS = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'verifiedMapActors.json'), 'utf8'),
)

const pad2 = (n) => String(n).padStart(2, '0')

// Clean developer / UE5 blueprint jargon & raw meter coordinates from marker text
function sanitizeText(str = '') {
  if (!str) return ''
  return str
    .replace(/UE5\s*关卡实测坐标\s*\([^)]*\)[，。；]?\s*/g, '')
    .replace(/UE5\s*实测[^（(]*\([^)]*\)[。，]?\s*/g, '')
    .replace(/，?对应蓝图【[^】]+】/g, '')
    .replace(/（世界坐标:\s*[^）]+）/g, '')
    .replace(/\s*\((?:BP_|SM_|DA_|RoundConfiguration_)[^)]*\)/g, '')
    .replace(/(?:BP_|SM_|DA_|RoundConfiguration_)[A-Za-z0-9_]+(?:\s*×\d+)?\s*·\s*/g, '')
    .replace(/^(?:BP_|SM_|DA_|RoundConfiguration_)[A-Za-z0-9_/\s]+$/g, '')
    .replace(/\s*\([A-Za-z0-9\s'&-]{3,}\)/g, '')
    .replace(/\s*\(\d+m,\s*-?\d+m(?:,\s*-?\d+m)?\)/g, '')
    .trim()
}

function cleanMarker(m) {
  return {
    ...m,
    title: sanitizeText(m.title),
    subLabel: sanitizeText(m.subLabel),
    desc: sanitizeText(m.desc),
    lootHint: sanitizeText(m.lootHint),
  }
}

// ============================================================================
// 1. Weekly Trials Categories Metadata (Core World Interaction Trials Only)
// ============================================================================
export const TRIAL_CATEGORIES = [
  {
    id: 'trial-deliver-crates',
    name: '递送前线箱子',
    shortLabel: '递送前线箱子',
    icon: ICONS.fieldDepot,
    accent: '#ffbc13',
    summary:
      '在地图中找到重型【前线箱子】，双手搬运至邻近的蓝顶【前线仓库】终端槽位交付，即可推进周常试炼并弹出一整排免费军火与医疗补给（点击箱子图标可查看最短搬运路线）。',
  },
  {
    id: 'trial-raider-caches',
    name: '搜索奇袭者箱',
    shortLabel: '搜索奇袭者箱',
    icon: ICONS.raiderCache,
    accent: '#ffbc13',
    summary:
      '前往野外藏匿点，留意地面风车/隆起标识或靠近至 15 米内聆听规律的机械滴答声，交互开启【奇袭者箱】或彭多拉山口专属【冰封奇袭者箱】即可计分。',
  },
  {
    id: 'trial-supply-drops',
    name: '呼叫补给空投',
    shortLabel: '呼叫补给空投',
    icon: ICONS.supplyStation,
    accent: '#38bdf8',
    summary:
      '前往固定【补给呼叫站】拉下天线手柄发射信号弹，等待约 30 秒轨道空投舱伞降落地后开启搜刮（信号弹会向全图暴露位置，建议掩体观察后拉烟搜刮）。',
  },
  {
    id: 'trial-first-wave-husks',
    name: '搜索第一波残骸',
    shortLabel: '搜索第一波残骸',
    icon: ICONS.baronHusk,
    accent: '#a4a5aa',
    summary:
      '前往旧时代遗留的【男爵巨型外壳】、【伐木手残骸】、【火箭手/黄蜂外壳】与金属残骸堆，撬开装甲舱盖即可搜刮第一波机械核心并累积试炼积分。',
  },
  {
    id: 'trial-arc-probes',
    name: '开启探测器与运输机',
    shortLabel: '探测器与运输机',
    icon: ICONS.probe,
    accent: '#00a9f2',
    summary:
      '寻找释放黑烟与脉冲蜂鸣的【ARC 勘探探测器】或坠毁【ARC 运输机】，强行撬开装甲板搜刮传感器与电路组件即可推进试炼。',
  },
  {
    id: 'trial-harvest-plants',
    name: '采集植物与果篮',
    shortLabel: '采集植物与果篮',
    icon: ICONS.lushBlooms,
    accent: '#26bf57',
    summary:
      '前往自然植被区采摘【大大毛蕊花、野生蘑菇、龙舌兰、烛莓、柠檬、杏子、橄榄】，或在【收获季节】期间搜刮高产【柳条水果篮】快速冲分。',
  },
]

// ============================================================================
// 2. Special Events Builders (8 Active Special Events, 100% UE5 Verified)
// ============================================================================
function buildLushBloomsFromActors(mapObj) {
  const baskets = VERIFIED_ACTORS[mapObj.id]?.fruitBaskets || []
  return baskets.map((b, idx) => ({
    id: `${mapObj.shortPrefix}-bloom-${pad2(idx + 1)}`,
    eventId: 'lush-blooms',
    kind: idx === 0 ? 'puzzle-hub' : 'spawn-node',
    layer: b.layer ?? 0,
    x: b.x,
    y: b.y,
    worldCoord: { x: b.wx, y: b.wy, z: b.wz },
    title: `柳条水果篮刷点 #${pad2(idx + 1)} · ${b.area}`,
    subLabel: `周边共 ${b.count} 处果篮刷新点`,
    badgeText: `#${pad2(idx + 1)}`,
    icon: ICONS.lushBlooms,
    accent: '#26bf57',
    desc: `位于【${b.area}】的柳条水果篮刷新点（周边密集包含 ${b.count} 处刷点）。在【收获季节】期间高概率刷出果篮，单次搜索即可获取大量水果、草药与种子。`,
    lootHint: '产出：柠檬、杏子、大大毛蕊花、红莓、野生蘑菇与各类种子',
  }))
}

function buildUncoveredCachesFromActors(mapObj) {
  const caches = VERIFIED_ACTORS[mapObj.id]?.uncoveredCaches || []
  return caches.map((c, idx) => ({
    id: `${mapObj.shortPrefix}-cache-${pad2(idx + 1)}`,
    eventId: 'uncovered-caches',
    kind: 'spawn-node',
    layer: c.layer ?? 0,
    x: c.x,
    y: c.y,
    worldCoord: { x: c.wx, y: c.wy, z: c.wz },
    title: `暴露的奇袭者箱 #${pad2(idx + 1)} · ${c.area}`,
    subLabel: `周边共 ${c.count} 处候选藏匿点`,
    badgeText: `#${pad2(idx + 1)}`,
    icon: ICONS.raiderCache,
    accent: '#ffbc13',
    desc: `位于【${c.area}】的野外埋藏奇袭者防水补给箱。靠近至 15 米内会听到规律的机械滴答声与引信闪烁，需在倒计时自毁前定位并开启。`,
    lootHint: '产出：改装武器、弹药、武器与医疗蓝图、高阶医疗品与奇袭者硬币',
  }))
}

function buildProspectingProbesFromActors(mapObj) {
  const probes = VERIFIED_ACTORS[mapObj.id]?.probesAndCouriers || []
  return probes.map((p, idx) => {
    const isCourier = p.subKind === 'courier'
    return {
      id: `${mapObj.shortPrefix}-probe-${pad2(idx + 1)}`,
      eventId: 'prospecting-probes',
      kind: 'spawn-node',
      layer: p.layer ?? 0,
      x: p.x,
      y: p.y,
      worldCoord: { x: p.wx, y: p.wy, z: p.wz },
      title: isCourier
        ? `ARC 坠毁运输机 #${pad2(idx + 1)} · ${p.area}`
        : `ARC 勘探探测器 #${pad2(idx + 1)} · ${p.area}`,
      subLabel: `周边共 ${p.count} 处着陆点`,
      badgeText: `#${pad2(idx + 1)}`,
      icon: ICONS.probe,
      accent: '#00a9f2',
      desc: `位于【${p.area}】外围开阔地的 ARC 探测器/运输机着陆点。顶部持续释放黑烟与脉冲蜂鸣，强行撬开装甲板会触发警报，可搜刮高阶电子科技材料。`,
      lootHint: '产出：传感器、ARC线圈、运动核心与电池',
    }
  })
}

function buildBirdCityFromActors(mapObj) {
  const nests = VERIFIED_ACTORS[mapObj.id]?.birdNests || []
  return nests.map((n, idx) => ({
    id: `${mapObj.shortPrefix}-bird-${pad2(idx + 1)}`,
    eventId: 'bird-city',
    kind: idx === 0 ? 'puzzle-hub' : 'spawn-node',
    layer: n.layer ?? 0,
    x: n.x,
    y: n.y,
    worldCoord: { x: n.wx, y: n.wy, z: n.wz },
    title: `烟囱鸟巢 #${pad2(idx + 1)} · ${n.area}`,
    subLabel: `周边共 ${n.count} 处鸟巢刷点`,
    badgeText: `鸟巢#${pad2(idx + 1)}`,
    icon: ICONS.birdCity,
    accent: '#ebdecb',
    desc: `位于【${n.area}】屋顶烟囱旁的鸟巢刷点。在【鸟城】事件期间高产旧世界饰品与稀有材料，靠近时注意惊飞鸟群会暴露位置。`,
    lootHint: '产出：旧世界珍品、奇袭者硬币与稀有材料',
  }))
}

const RIVEN_TIDES_BURIED_TREASURES = [
  { x: 24.8, y: 42.4, wx: -302, wy: -349, wz: -194, area: '蔚蓝海滩北段浅滩' },
  { x: 38.22, y: 37.92, wx: -141, wy: -403, wz: -186, area: '干涸海床西侧沙洲' },
  { x: 42.72, y: 34.76, wx: -87, wy: -441, wz: -195, area: '干涸海床中央沉船区' },
  { x: 50.58, y: 32.52, wx: 7, wy: -468, wz: -191, area: '巨型防波堤内侧沙滩' },
  { x: 58.43, y: 37.64, wx: 101, wy: -406, wz: -194, area: '干涸河床入海口西岸' },
  { x: 59.05, y: 47.38, wx: 109, wy: -289, wz: -194, area: '干涸河床中段沙洲' },
  { x: 64.13, y: 32.21, wx: 170, wy: -471, wz: -196, area: '深水港北侧防波堤外滩' },
  { x: 64.43, y: 41.55, wx: 173, wy: -359, wz: -206, area: '西码头前沿退潮海床' },
  { x: 70.56, y: 31.57, wx: 247, wy: -479, wz: -174, area: '东顺岸码头北端浅滩' },
  { x: 70.49, y: 35.11, wx: 246, wy: -437, wz: -195, area: '深水港主航道浅滩' },
  { x: 71.43, y: 41.49, wx: 257, wy: -360, wz: -195, area: '东顺岸码头南侧海床' },
  { x: 76.17, y: 41.08, wx: 314, wy: -365, wz: -195, area: '集装箱堆场西侧岸滩' },
]

function buildBuriedTreasureForRivenTides(mapObj) {
  return RIVEN_TIDES_BURIED_TREASURES.map((t, idx) => ({
    id: `${mapObj.shortPrefix}-treasure-${pad2(idx + 1)}`,
    eventId: 'buried-treasure',
    kind: idx === 0 ? 'puzzle-hub' : 'spawn-node',
    layer: 0,
    x: t.x,
    y: t.y,
    worldCoord: { x: t.wx, y: t.wy, z: t.wz },
    title: `海滩埋藏宝物 #${pad2(idx + 1)} · ${t.area}`,
    subLabel: '使用港务局探测器定位发掘',
    badgeText: `宝藏#${pad2(idx + 1)}`,
    icon: ICONS.buriedTreasure,
    accent: '#2dd4bf',
    desc: `位于【${t.area}】的沙滩埋藏点。在【赶海淘金】期间可使用拾取的港务局探测器发掘埋藏宝物，注意规避沙滩地雷。`,
    lootHint: '产出：高价值旧世界饰品、珍品与稀有零件',
  }))
}

const ACTIVE_SPECIAL_EVENT_IDS = new Set([
  'harvester',
  'matriarch',
  'arc-frigate',
  'launch-tower-loot',
  'fallen-emperor',
  'hidden-bunker',
  'locked-gate',
  'lush-blooms',
  'uncovered-caches',
  'prospecting-probes',
  'bird-city',
  'buried-treasure',
])

export function buildEventMarkersForMap(mapObj) {
  // Stella Montis is a 100% indoor underground compound with no outdoor special event pins
  if (mapObj.id === 'stella-montis') return {}

  const result = {}

  for (const eventId of mapObj.supportedEvents || []) {
    if (!ACTIVE_SPECIAL_EVENT_IDS.has(eventId)) continue

    if (SPECIFIC_EVENT_MARKERS[mapObj.id]?.[eventId]) {
      result[eventId] = SPECIFIC_EVENT_MARKERS[mapObj.id][eventId].map(cleanMarker)
    } else if (eventId === 'lush-blooms') {
      result[eventId] = buildLushBloomsFromActors(mapObj)
    } else if (eventId === 'uncovered-caches') {
      result[eventId] = buildUncoveredCachesFromActors(mapObj)
    } else if (eventId === 'prospecting-probes') {
      result[eventId] = buildProspectingProbesFromActors(mapObj)
    } else if (eventId === 'bird-city') {
      result[eventId] = buildBirdCityFromActors(mapObj)
    } else if (eventId === 'buried-treasure' && mapObj.id === 'riven-tides') {
      result[eventId] = buildBuriedTreasureForRivenTides(mapObj)
    }
  }

  return result
}

// ============================================================================
// 3. Weekly Trials Markers Builder per Map (6 Core World Interaction Trials)
// ============================================================================
const SUPPLEMENT_FIELD_DEPOTS = {
  'blue-gate': [
    {
      x: 50.24,
      y: 63.89,
      wx: 5,
      wy: 272,
      wz: -274,
      area: '南部农田前线仓库',
      crateXY: [47.55, 65.1, -48, 295, -271, '废弃农庄木棚前线箱'],
    },
    {
      x: 33.58,
      y: 45.4,
      wx: -321,
      wy: -90,
      wz: -275,
      area: '捕兽者林地前线仓库',
      crateXY: [30.85, 49.48, -374, -10, -280, '庄严残骸旁前线箱'],
    },
    {
      x: 50.6,
      y: 38.61,
      wx: 12,
      wy: -223,
      wz: -242,
      area: '加固接待处外围前线仓库',
      crateXY: [48.27, 38.61, -34, -223, -235, '接待处西坡前线箱'],
    },
  ],
}

export function buildTrialMarkersForMap(mapObj) {
  // Stella Montis is an indoor underground facility and does not host outdoor surface trials
  if (mapObj.id === 'stella-montis') return {}

  const actorData = VERIFIED_ACTORS[mapObj.id] || {}
  const supportedEvents = new Set(mapObj.supportedEvents || [])
  const trials = {}

  // --------------------------------------------------------------------------
  // 1. Deliver Field Crates (递送前线箱子: Field Depots + Field Crates)
  // --------------------------------------------------------------------------
  const depots = actorData.fieldDepots || []
  const crates = actorData.fieldCrates || []
  const a3Markers = []

  if (depots.length > 0) {
    depots.forEach((d, idx) => {
      a3Markers.push({
        id: `${mapObj.shortPrefix}-trial-depot-${pad2(idx + 1)}`,
        eventId: 'trial-deliver-crates',
        kind: 'puzzle-hub',
        layer: d.layer ?? 0,
        x: d.x,
        y: d.y,
        worldCoord: { x: d.wx, y: d.wy, z: d.wz },
        title: `前线仓库 #${pad2(idx + 1)} · ${d.area}`,
        subLabel: '前线箱子交付终端',
        badgeText: `仓库#${pad2(idx + 1)}`,
        icon: ICONS.fieldDepot,
        accent: '#ffbc13',
        desc: `位于【${d.area}】的蓝顶集装箱前线仓库。将周边搜寻到的重型【前线箱子】搬运至此仓库内的凹槽交付，即可获得试炼积分并弹出一整排免费军火与医疗补给。`,
        lootHint: '交付产出：武器箱、护盾充能器、高阶弹药与医疗品',
      })
    })
    crates.forEach((c, idx) => {
      a3Markers.push({
        id: `${mapObj.shortPrefix}-trial-crate-${pad2(idx + 1)}`,
        eventId: 'trial-deliver-crates',
        kind: 'puzzle-step',
        layer: c.layer ?? 0,
        x: c.x,
        y: c.y,
        worldCoord: { x: c.wx, y: c.wy, z: c.wz },
        title: `前线箱子刷新点 #${pad2(idx + 1)} · ${c.area}`,
        subLabel: '点击显示前往最近前线仓库路线',
        badgeText: `箱#${pad2(idx + 1)}`,
        icon: ICONS.fieldCrate,
        accent: '#38bdf8',
        targetXY: c.targetXY || undefined,
        desc: `位于【${c.area}】周边的重型前线物资箱刷新点。双手搬起箱子后沿引导虚线送往最近的前线仓库即可完成递送。`,
        lootHint: '点击图标可在地图上查看通往最近【前线仓库】的最短搬运连线',
      })
    })
  } else if (SUPPLEMENT_FIELD_DEPOTS[mapObj.id]) {
    SUPPLEMENT_FIELD_DEPOTS[mapObj.id].forEach((d, idx) => {
      a3Markers.push({
        id: `${mapObj.shortPrefix}-trial-depot-${pad2(idx + 1)}`,
        eventId: 'trial-deliver-crates',
        kind: 'puzzle-hub',
        layer: 0,
        x: d.x,
        y: d.y,
        worldCoord: { x: d.wx, y: d.wy, z: d.wz },
        title: `前线仓库 #${pad2(idx + 1)} · ${d.area}`,
        subLabel: '前线箱子交付终端',
        badgeText: `仓库#${pad2(idx + 1)}`,
        icon: ICONS.fieldDepot,
        accent: '#ffbc13',
        desc: `位于【${d.area}】的前线仓库交付点。搬运周边的重型前线箱子插入仓库内槽位即可解锁补给并获得周常试炼积分。`,
        lootHint: '交付产出：高阶军火、护盾充能器与医疗物资',
      })
      if (d.crateXY) {
        a3Markers.push({
          id: `${mapObj.shortPrefix}-trial-crate-${pad2(idx + 1)}`,
          eventId: 'trial-deliver-crates',
          kind: 'puzzle-step',
          layer: 0,
          x: d.crateXY[0],
          y: d.crateXY[1],
          worldCoord: { x: d.crateXY[2], y: d.crateXY[3], z: d.crateXY[4] },
          title: `前线箱子刷新点 #${pad2(idx + 1)} · ${d.crateXY[5]}`,
          subLabel: '搬运至相邻前线仓库交付',
          badgeText: `箱#${pad2(idx + 1)}`,
          icon: ICONS.fieldCrate,
          accent: '#38bdf8',
          targetXY: [d.x, d.y],
          desc: `位于【${d.crateXY[5]}】的前线箱子刷点，搬起后沿引导线送往相邻前线仓库即可完成交付。`,
          lootHint: '夜间奇袭或电磁风暴期间递送可获得双倍试炼积分',
        })
      }
    })
  }
  trials['trial-deliver-crates'] = a3Markers

  // --------------------------------------------------------------------------
  // 2. Search Raider Caches / Frozen Raider Caches (搜索奇袭者箱)
  // --------------------------------------------------------------------------
  trials['trial-raider-caches'] = (actorData.uncoveredCaches || []).map((c, idx) => {
    const isFrozen = c.subKind === 'frozen' || mapObj.id === 'pendola-pass'
    return {
      id: `${mapObj.shortPrefix}-trial-cache-${pad2(idx + 1)}`,
      eventId: 'trial-raider-caches',
      kind: 'spawn-node',
      layer: c.layer ?? 0,
      x: c.x,
      y: c.y,
      worldCoord: { x: c.wx, y: c.wy, z: c.wz },
      title: isFrozen
        ? `冰封奇袭者箱 #${pad2(idx + 1)} · ${c.area}`
        : `奇袭者箱 #${pad2(idx + 1)} · ${c.area}`,
      subLabel: `周边共 ${c.count} 处刷点`,
      badgeText: isFrozen ? `冰封#${pad2(idx + 1)}` : `#${pad2(idx + 1)}`,
      icon: ICONS.raiderCache,
      accent: isFrozen ? '#66ffff' : '#ffbc13',
      desc: `位于【${c.area}】的${isFrozen ? '雪地冰封奇袭者箱' : '野外奇袭者防水补给箱'}。靠近留心聆听机械滴答声或观察地面隆起标识即可交互开启。`,
      lootHint: '产出：改装枪械、弹药、设计蓝图与奇袭者硬币',
    }
  })

  // --------------------------------------------------------------------------
  // 3. Call & Search Supply Drops (呼叫补给空投)
  // --------------------------------------------------------------------------
  trials['trial-supply-drops'] = (actorData.supplyCallStations || []).map((s, idx) => ({
    id: `${mapObj.shortPrefix}-trial-supply-${pad2(idx + 1)}`,
    eventId: 'trial-supply-drops',
    kind: 'puzzle-hub',
    layer: s.layer ?? 0,
    x: s.x,
    y: s.y,
    worldCoord: { x: s.wx, y: s.wy, z: s.wz },
    title: `补给呼叫站 #${pad2(idx + 1)} · ${s.area}`,
    subLabel: '发射信号弹呼叫轨道空投舱',
    badgeText: `空投#${pad2(idx + 1)}`,
    icon: ICONS.supplyStation,
    accent: '#38bdf8',
    desc: `位于【${s.area}】的固定空投呼叫终端。拉下天线手柄发射信号弹后，轨道补给伞降舱将在约 30 秒后降落至此位置旁，开启搜刮即可获得试炼积分。`,
    lootHint: '信号弹会向全图暴露位置，建议呼叫后隐蔽观察并在落地后拉烟搜刮',
  }))

  // --------------------------------------------------------------------------
  // 4. Search First Wave Husks (搜索第一波残骸)
  // --------------------------------------------------------------------------
  const a6Markers = []
  ;(actorData.baronHusks || []).forEach((b, idx) => {
    a6Markers.push({
      id: `${mapObj.shortPrefix}-trial-baron-${pad2(idx + 1)}`,
      eventId: 'trial-first-wave-husks',
      kind: 'boss-landmark',
      layer: b.layer ?? 0,
      x: b.x,
      y: b.y,
      worldCoord: { x: b.wx, y: b.wy, z: b.wz },
      title: `巨型“男爵”外壳 #${pad2(idx + 1)} · ${b.area}`,
      subLabel: '顶部反应堆舱盖可撬开',
      badgeText: '男爵残骸',
      icon: ICONS.baronHusk,
      accent: '#ffbc13',
      desc: `“第一波”遗留的巨型男爵机甲主残骸，攀爬至顶部强行撬开舱盖（退避规避一次高温喷火后）可搜刮高分残骸核心。`,
      lootHint: '单座男爵残骸及周边腿部外壳可提供大量试炼积分',
    })
  })
  ;(actorData.deforesterHusks || []).forEach((d, idx) => {
    a6Markers.push({
      id: `${mapObj.shortPrefix}-trial-deforester-${pad2(idx + 1)}`,
      eventId: 'trial-first-wave-husks',
      kind: 'puzzle-hub',
      layer: d.layer ?? 0,
      x: d.x,
      y: d.y,
      worldCoord: { x: d.wx, y: d.wy, z: d.wz },
      title: `伐木手巨型残骸 #${pad2(idx + 1)} · ${d.area}`,
      subLabel: '内部可进入撬开多处容器',
      badgeText: '伐木手',
      icon: ICONS.baronHusk,
      accent: '#a4a5aa',
      desc: `位于【${d.area}】的第一波双层圆环机甲【伐木手】巨型残骸，内部有多处可撬开的第一波机械容器。`,
      lootHint: '产出：ARC高性能钢、动力电池与第一波机械核心',
    })
  })
  ;(actorData.mediumHusks || []).forEach((m, idx) => {
    a6Markers.push({
      id: `${mapObj.shortPrefix}-trial-medhusk-${pad2(idx + 1)}`,
      eventId: 'trial-first-wave-husks',
      kind: 'spawn-node',
      layer: m.layer ?? 0,
      x: m.x,
      y: m.y,
      worldCoord: { x: m.wx, y: m.wy, z: m.wz },
      title: `火箭手/中型第一波外壳 #${pad2(idx + 1)} · ${m.area}`,
      subLabel: `周边共 ${m.count} 处可撬外壳`,
      badgeText: `中型#${pad2(idx + 1)}`,
      icon: ICONS.arcWreckage,
      accent: '#a4a5aa',
      desc: `位于【${m.area}】的第一波中型机甲/火箭手残骸外壳群（周边含 ${m.count} 处刷新点），部分带电外壳撬开时注意规避电弧。`,
      lootHint: '产出：ARC合金、电池、损坏的“火箭手”引擎与电路板',
    })
  })
  ;(actorData.smallHusks || []).slice(0, 10).forEach((s, idx) => {
    a6Markers.push({
      id: `${mapObj.shortPrefix}-trial-smhusk-${pad2(idx + 1)}`,
      eventId: 'trial-first-wave-husks',
      kind: 'spawn-node',
      layer: s.layer ?? 0,
      x: s.x,
      y: s.y,
      worldCoord: { x: s.wx, y: s.wy, z: s.wz },
      title: `黄蜂外壳与第一波残骸堆 #${pad2(idx + 1)} · ${s.area}`,
      subLabel: `周边共 ${s.count} 处交互点`,
      badgeText: `残骸#${pad2(idx + 1)}`,
      icon: ICONS.arcWreckage,
      accent: '#a4a5aa',
      desc: `位于【${s.area}】的小型第一波机械残骸与金属残骸堆（含 ${s.count} 处交互点），可快速连续搜刮累加试炼积分。`,
      lootHint: '产出：ARC合金、钢质弹簧、导线与基础机械零件',
    })
  })
  trials['trial-first-wave-husks'] = a6Markers

  // --------------------------------------------------------------------------
  // 5. Open ARC Probes / Search Couriers (开启探测器与运输机)
  // --------------------------------------------------------------------------
  trials['trial-arc-probes'] = (actorData.probesAndCouriers || []).map((p, idx) => {
    const isCourier = p.subKind === 'courier'
    return {
      id: `${mapObj.shortPrefix}-trial-probe-${pad2(idx + 1)}`,
      eventId: 'trial-arc-probes',
      kind: isCourier ? 'puzzle-hub' : 'spawn-node',
      layer: p.layer ?? 0,
      x: p.x,
      y: p.y,
      worldCoord: { x: p.wx, y: p.wy, z: p.wz },
      title: isCourier
        ? `ARC 运输机残骸 #${pad2(idx + 1)} · ${p.area}`
        : `ARC 勘探探测器 #${pad2(idx + 1)} · ${p.area}`,
      subLabel: `周边共 ${p.count} 处着陆点`,
      badgeText: isCourier ? `运输机#${pad2(idx + 1)}` : `探针#${pad2(idx + 1)}`,
      icon: isCourier ? ICONS.courier : ICONS.probe,
      accent: '#00a9f2',
      desc: `位于【${p.area}】的${isCourier ? '坠毁 ARC 装甲运输机' : '坠毁 ARC 地质探测器'}刷新点。撬开舱门即可推进周常试炼。`,
      lootHint: '产出：传感器、ARC线圈、信使黑匣与运动核心',
    }
  })

  // --------------------------------------------------------------------------
  // 6. Harvest Plants (采集植物与果篮)
  // --------------------------------------------------------------------------
  const a8Markers = []
  ;(actorData.plants || []).forEach((pl, idx) => {
    a8Markers.push({
      id: `${mapObj.shortPrefix}-trial-plant-${pad2(idx + 1)}`,
      eventId: 'trial-harvest-plants',
      kind: 'spawn-node',
      layer: pl.layer ?? 0,
      x: pl.x,
      y: pl.y,
      worldCoord: { x: pl.wx, y: pl.wy, z: pl.wz },
      title: `可采集植物群落 #${pad2(idx + 1)} · ${pl.plantType} (${pl.area})`,
      subLabel: `周边密集分布 ${pl.count} 株`,
      badgeText: `植物#${pad2(idx + 1)}`,
      icon: ICONS.lushBlooms,
      accent: '#26bf57',
      desc: `位于【${pl.area}】的【${pl.plantType}】自然群落（周边密集分布 ${pl.count} 株，伴生大大毛蕊花与野生蘑菇），每次采摘均计入周常试炼。`,
      lootHint: '产出：杏子、柠檬、橄榄、龙舌兰叶、大大毛蕊花与烛果',
    })
  })
  if (supportedEvents.has('lush-blooms')) {
    ;(actorData.fruitBaskets || []).slice(0, 10).forEach((fb, idx) => {
      a8Markers.push({
        id: `${mapObj.shortPrefix}-trial-basket-${pad2(idx + 1)}`,
        eventId: 'trial-harvest-plants',
        kind: 'puzzle-hub',
        layer: fb.layer ?? 0,
        x: fb.x,
        y: fb.y,
        worldCoord: { x: fb.wx, y: fb.wy, z: fb.wz },
        title: `柳条水果篮刷点 #${pad2(idx + 1)} · ${fb.area}`,
        subLabel: `周边共 ${fb.count} 处果篮刷点`,
        badgeText: `果篮#${pad2(idx + 1)}`,
        icon: ICONS.lushBlooms,
        accent: '#1fff76',
        desc: `位于【${fb.area}】的柳条水果篮刷新点（含 ${fb.count} 处候选刷点），在【收获季节】期间搜刮果篮可一次性获取大量植物果实与种子。`,
        lootHint: '单篮产出 4~8 份水果、蘑菇、大大毛蕊花与杂交种子',
      })
    })
  }
  trials['trial-harvest-plants'] = a8Markers

  for (const [k, arr] of Object.entries(trials)) {
    if (!arr || arr.length === 0) delete trials[k]
  }

  return trials
}
