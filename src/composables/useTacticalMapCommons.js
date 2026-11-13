const polyPointsCache = new WeakMap()

/**
 * 1:1 Square SVG Coordinate Helper (0..100% -> 0..1000), memoized by polygon array reference.
 */
export function polyPointsSquare(pts = []) {
  if (!Array.isArray(pts) || !pts.length) return ''
  const cached = polyPointsCache.get(pts)
  if (cached !== undefined) return cached
  const str = pts.map(([x, y]) => `${+(x * 10).toFixed(1)},${+(y * 10).toFixed(1)}`).join(' ')
  polyPointsCache.set(pts, str)
  return str
}

export const LOOT_ORDER = Object.freeze([
  'mechanical',
  'commercial',
  'technological',
  'residential',
  'household',
  'medical',
  'nature',
  'oldworld',
  'industrial',
  'electrical',
  'security',
  'military',
  'exodus',
  'arc',
  'raider',
])

export const STAGE_PLACE_NAME_MAP = Object.freeze({
  caz: '受控访问区',
  frigate: 'ARC“护卫者”',
  refuge: '奇袭者避难所',
  fort: '古堡要塞',
  stella: '星辰山',
  walker: '坠落帝王',
})

export function getStagePlaceName(st, fallbackMapName = '') {
  if (!st) return ''
  if (STAGE_PLACE_NAME_MAP[st.stageKey]) return STAGE_PLACE_NAME_MAP[st.stageKey]
  const stripped = String(st.title || '')
    .replace(/^.+?·\s*/, '')
    .replace(/\s*(?:全图\s*)?3D.*$/i, '')
    .trim()
  return stripped || fallbackMapName || st.title
}

export function resolveCurrentLayerObj(map, activeLayerId) {
  const layersList = map?.layers || []
  return (
    layersList.find((l) => l.id === activeLayerId) ||
    layersList[0] || {
      id: 0,
      label: '地表全图',
      enLabel: 'SURFACE',
      image: map?.tacticalImage,
      overlayOnBase: false,
    }
  )
}

export function getShortLayerLabel(map, lyr) {
  const mapName = map?.name || ''
  const en = String(lyr?.enLabel || '').toUpperCase()
  const isUpper =
    en.includes('SURFACE') ||
    en.includes('UPPER') ||
    (map?.id !== 'stella-montis' && lyr?.id === 0)
  return `${mapName}${isUpper ? '上' : '下'}`
}

export function buildMapExtractionLegend(extractions = []) {
  const seen = new Map()
  for (const e of extractions) {
    if (e.type !== 'hatch' && !seen.has('return')) {
      seen.set('return', {
        key: 'return',
        label: e.typeLabel,
        icon: e.icon,
        isHatch: false,
      })
    }
  }
  for (const e of extractions) {
    if (e.type === 'hatch' && !seen.has('hatch')) {
      seen.set('hatch', {
        key: 'hatch',
        label: '奇袭者暗门',
        icon: e.icon,
        isHatch: true,
      })
    }
  }
  return [...seen.values()]
}

export function buildMapLootLegend(pois = []) {
  const byLabel = new Map()
  for (const p of pois) {
    for (const lt of p.lootTags || []) {
      if (!byLabel.has(lt.zh)) {
        byLabel.set(lt.zh, {
          id: lt.id,
          zh: lt.zh,
          en: lt.en,
          icon: lt.icon,
        })
      }
    }
  }
  return [...byLabel.values()].sort((a, b) => {
    const ia = LOOT_ORDER.indexOf(a.id)
    const ib = LOOT_ORDER.indexOf(b.id)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

export function buildMapSpecialEvents(map, mapsStore) {
  if (!map || !mapsStore) return []
  const evIds = (map.supportedEvents || []).filter((id) => id !== 'standard-patrol')
  return evIds
    .map((id) => {
      const ev = mapsStore.getEventById(id)
      const markers = map.eventMarkers?.[id] || []
      return {
        id,
        name: ev.name,
        icon: ev.gameIcon || 'game-maps/icons/T_Icon_Event.png',
        accent: ev.accent || '#ffbc13',
        count: markers.length,
        kindLabel: '事件',
        event: ev,
      }
    })
    .filter((item) => item.count > 0)
}

export function buildMapTrialCategories(map, mapsStore) {
  if (!map || !mapsStore) return []
  const dict = map.trialMarkers || {}
  return (mapsStore.trialCategories || [])
    .map((cat) => {
      const markers = dict[cat.id] || []
      return {
        ...cat,
        id: cat.id,
        name: cat.name,
        icon: cat.icon || 'game-maps/icons/T_Icon_Event.png',
        accent: cat.accent || '#ffbc13',
        summary: cat.summary,
        count: markers.length,
        kindLabel: '试炼',
      }
    })
    .filter((item) => item.count > 0)
}

export function buildMapPlantCategories(map, mapsStore) {
  if (!map || !mapsStore) return []
  const dict = map.plantMarkers || {}
  const zonesDict = map.plantZones || {}
  return (mapsStore.plantCategories || [])
    .map((cat) => {
      const markers = dict[cat.id] || []
      const zones = zonesDict[cat.id] || []
      const totalNodes = markers.reduce((sum, item) => sum + (item.count || 1), 0)
      return {
        ...cat,
        id: cat.id,
        name: cat.name,
        icon: cat.icon || 'items/T_UI_Lemons.png',
        accent: cat.accent || '#4ade80',
        count: markers.length,
        totalNodes,
        zoneCount: zones.length,
        kindLabel: cat.shortTag || '植物',
      }
    })
    .filter((item) => item.count > 0)
}

export function buildMapEliteArcCategories(map, mapsStore) {
  if (!map || !mapsStore) return []
  const dict = map.eliteArcMarkers || {}
  return (mapsStore.eliteArcCategories || [])
    .map((cat) => {
      const markers = dict[cat.id] || []
      const totalUnits = markers.reduce((sum, item) => sum + (item.count || 1), 0)
      return {
        ...cat,
        id: cat.id,
        name: cat.name,
        icon: cat.icon || 'items/T_UI_Icon_Salvage_Chonk_Part.png',
        accent: cat.accent || '#ef4444',
        count: markers.length,
        totalUnits,
        kindLabel: cat.roleTag || '精英ARC',
      }
    })
    .filter((item) => item.count > 0)
}

export function resolveLiveServerEventIds(activeState) {
  if (!activeState) return []
  const ids = []
  if (activeState.livePrimary && activeState.livePrimary.id !== 'standard-patrol') {
    ids.push(activeState.livePrimary.id)
  }
  if (activeState.liveSecondary && activeState.liveSecondary.id !== 'standard-patrol') {
    if (!ids.includes(activeState.liveSecondary.id)) ids.push(activeState.liveSecondary.id)
  }
  return ids
}

export function countLiveServerEventMarkers(map, liveIds = []) {
  const dict = map?.eventMarkers || {}
  let total = 0
  for (const id of liveIds) {
    total += (dict[id] || []).length
  }
  return total
}

export function collectActiveTacticalMarkers(map, opts = {}) {
  if (!map) return []
  const {
    showLiveEventMarkers = true,
    liveEventIds = [],
    enabledEventIds = [],
    enabledTrialIds = [],
    enabledPlantIds = [],
    enabledEliteArcIds = [],
    layerFilter = null,
  } = opts

  const evDict = map.eventMarkers || {}
  const trDict = map.trialMarkers || {}
  const plDict = map.plantMarkers || {}
  const arcDict = map.eliteArcMarkers || {}
  const seen = new Set()
  const out = []

  const pushMarkers = (list) => {
    for (const item of list || []) {
      if (layerFilter !== null && (item.layer ?? 0) !== layerFilter) continue
      if (seen.has(item.id)) continue
      seen.add(item.id)
      out.push(item)
    }
  }

  if (showLiveEventMarkers) {
    for (const liveId of liveEventIds) pushMarkers(evDict[liveId])
  }
  for (const evId of enabledEventIds) pushMarkers(evDict[evId])
  for (const trId of enabledTrialIds) pushMarkers(trDict[trId])
  for (const plId of enabledPlantIds) pushMarkers(plDict[plId])
  for (const arcId of enabledEliteArcIds) pushMarkers(arcDict[arcId])

  return out
}
