import questsData from '../data/questsData.json'
import questResourcesData from '../data/questResourcesData.json'
import outpostVerifiedData from '../data/outpostVerifiedData.json'

export const SYNC_CONFIG_STORAGE_KEY = 'arc_tracker_sync_cfg_v1'

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')

const stripNumPrefix = (s) => String(s || '').replace(/^\d+[_-]+/, '')

// 1. Quest lookup table (123 quests)
const questLookup = new Map()
for (const q of questsData.quests || []) {
  questLookup.set(q.id, q.id)
  questLookup.set(norm(q.id), q.id)
  questLookup.set(norm(q.title), q.id)
  if (q.zhTitle) questLookup.set(q.zhTitle.trim(), q.id)
}
questLookup.set('wheneverythingfalls', 'where-everything-falls')

// 2. Workshop station lookup table
const stationKeyLookup = new Map([
  ['gunsmith', 'gunsmith'],
  ['weapon_bench', 'gunsmith'],
  ['weaponbench', 'gunsmith'],
  ['gear_bench', 'gear_bench'],
  ['gearbench', 'gear_bench'],
  ['equipment_bench', 'gear_bench'],
  ['equipmentbench', 'gear_bench'],
  ['medical_lab', 'medical_lab'],
  ['medicallab', 'medical_lab'],
  ['med_station', 'medical_lab'],
  ['medstation', 'medical_lab'],
  ['explosives_station', 'explosives_station'],
  ['explosivesstation', 'explosives_station'],
  ['explosives_bench', 'explosives_station'],
  ['explosivesbench', 'explosives_station'],
  ['utility_station', 'utility_station'],
  ['utilitystation', 'utility_station'],
  ['utility_bench', 'utility_station'],
  ['utilitybench', 'utility_station'],
  ['refiner', 'refiner'],
  ['research_station', 'research_station'],
  ['researchstation', 'research_station'],
  ['workbench', 'workbench'],
  ['scrappy', 'scrappy'],
])

// 3. Outpost project lookup table
const allProjects = [
  ...(outpostVerifiedData.shelteredRetreat ? [outpostVerifiedData.shelteredRetreat] : []),
  ...(outpostVerifiedData.raiderProjects || []),
]
const projectLookup = new Map()
for (const p of allProjects) {
  projectLookup.set(p.id, p)
  projectLookup.set(norm(p.id), p)
  projectLookup.set(norm(p.enName), p)
  projectLookup.set(norm(`${p.enName} Project`), p)
  if (p.name) projectLookup.set(p.name.trim(), p)
}

// 4. Blueprint lookup table (208 blueprints)
const allBlueprints = [
  ...(questResourcesData.blueprints?.weaponItemBlueprints || []),
  ...(questResourcesData.blueprints?.furnitureBlueprints || []),
  ...(questResourcesData.blueprints?.stencilBlueprints || []),
]
const blueprintLookup = new Map()
for (const bp of allBlueprints) {
  blueprintLookup.set(bp.id, bp.id)
  blueprintLookup.set(norm(bp.id), bp.id)
  if (bp.enName) blueprintLookup.set(norm(bp.enName), bp.id)
  if (bp.itemEnName) {
    blueprintLookup.set(norm(bp.itemEnName), bp.id)
    blueprintLookup.set(norm(`${bp.itemEnName} Blueprint`), bp.id)
  }
  if (bp.name) blueprintLookup.set(bp.name.trim(), bp.id)
  if (bp.itemName) blueprintLookup.set(bp.itemName.trim(), bp.id)
  if (bp.assetName) blueprintLookup.set(norm(bp.assetName), bp.id)
}

export function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY)
    if (!raw) return { appKey: '', userKey: '', playerName: '', lastSyncedAt: 0 }
    return { appKey: '', userKey: '', playerName: '', lastSyncedAt: 0, ...JSON.parse(raw) }
  } catch {
    return { appKey: '', userKey: '', playerName: '', lastSyncedAt: 0 }
  }
}

export function saveSyncConfig(patch) {
  const next = { ...loadSyncConfig(), ...patch }
  try {
    localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore storage quota errors
  }
  return next
}

function matchQuestId(rawItem) {
  if (!rawItem) return null
  if (typeof rawItem === 'string') {
    return (
      questLookup.get(rawItem) ||
      questLookup.get(norm(rawItem)) ||
      questLookup.get(norm(stripNumPrefix(rawItem))) ||
      null
    )
  }
  if (typeof rawItem === 'object') {
    const isExplicitlyIncomplete =
      rawItem.completed === false ||
      rawItem.isCompleted === false ||
      rawItem.status === 'incomplete' ||
      rawItem.status === 'todo' ||
      rawItem.state === 'incomplete'
    if (isExplicitlyIncomplete) return null

    const candidates = [
      rawItem.id,
      rawItem.questId,
      rawItem.slug,
      stripNumPrefix(rawItem.id || rawItem.questId || ''),
      typeof rawItem.name === 'string' ? rawItem.name : rawItem.name?.en,
      rawItem.title,
      rawItem.enName,
      rawItem.name?.['zh-CN'],
    ]
    for (const c of candidates) {
      if (!c) continue
      const hit = questLookup.get(c) || questLookup.get(norm(c))
      if (hit) return hit
    }
  }
  return null
}

function matchBlueprintId(rawItem) {
  if (!rawItem) return null
  if (typeof rawItem === 'string') {
    return blueprintLookup.get(rawItem) || blueprintLookup.get(norm(rawItem)) || null
  }
  if (typeof rawItem === 'object') {
    const isExplicitlyMissing =
      rawItem.learned === false ||
      rawItem.isLearned === false ||
      rawItem.owned === false ||
      rawItem.unlocked === false ||
      rawItem.status === 'missing' ||
      rawItem.status === 'unlearned'
    if (isExplicitlyMissing) return null

    const candidates = [
      rawItem.id,
      rawItem.blueprintId,
      rawItem.itemId,
      rawItem.slug,
      typeof rawItem.name === 'string' ? rawItem.name : rawItem.name?.en,
      rawItem.enName,
      rawItem.itemName,
      rawItem.name?.['zh-CN'],
    ]
    for (const c of candidates) {
      if (!c) continue
      const hit = blueprintLookup.get(c) || blueprintLookup.get(norm(c))
      if (hit) return hit
    }
  }
  return null
}

function collectCandidateItems(node, out = []) {
  if (!node) return out
  if (Array.isArray(node)) {
    for (const el of node) collectCandidateItems(el, out)
    return out
  }
  if (typeof node === 'string') {
    out.push(node)
    return out
  }
  if (typeof node === 'object') {
    if (node.id || node.questId || node.blueprintId || node.itemId || node.name || node.title) {
      out.push(node)
    }
    for (const [k, v] of Object.entries(node)) {
      if (['meta', 'pagination', 'summary', 'stats', 'counts'].includes(k)) continue
      if (Array.isArray(v)) {
        collectCandidateItems(v, out)
      } else if (v && typeof v === 'object' && !('en' in v)) {
        if (typeof v.completed === 'boolean' || typeof v.learned === 'boolean' || typeof v.owned === 'boolean') {
          out.push({ id: k, ...v })
        } else {
          collectCandidateItems(v, out)
        }
      } else if (v === true && (questLookup.has(norm(k)) || blueprintLookup.has(norm(k)))) {
        out.push(k)
      }
    }
  }
  return out
}

export function applySyncPayloadToStores(payload, stores) {
  const { questsStore, workshopStore, outpostStore, blueprintsStore } = stores
  const summary = {
    quests: 0,
    stations: 0,
    stages: 0,
    blueprints: 0,
    playerName: '',
  }

  // 1. Direct local backup format
  if (payload?.source === 'arc-map-backup' && payload?.data) {
    const d = payload.data
    if (Array.isArray(d.completedQuestIds)) {
      questsStore.completedQuestIds = [...new Set(d.completedQuestIds)]
      summary.quests = questsStore.completedQuestIds.length
    }
    if (d.stationLevels && typeof d.stationLevels === 'object') {
      workshopStore.stationLevels = { ...workshopStore.stationLevels, ...d.stationLevels }
      summary.stations = Object.keys(d.stationLevels).length
    }
    if (Array.isArray(d.completedStageIds)) {
      outpostStore.completedStageIds = [...new Set(d.completedStageIds)]
      summary.stages = outpostStore.completedStageIds.length
    }
    if (Array.isArray(d.builtFurnitureIds)) {
      outpostStore.builtFurnitureIds = [...new Set(d.builtFurnitureIds)]
    }
    if (Array.isArray(d.unlockedRoomIds)) {
      outpostStore.unlockedRoomIds = [...new Set(d.unlockedRoomIds)]
    }
    if (d.raiderDenLevel) {
      outpostStore.raiderDenLevel = d.raiderDenLevel
    }
    if (Array.isArray(d.ownedBlueprintIds)) {
      blueprintsStore.ownedBlueprintIds = [...new Set(d.ownedBlueprintIds)]
      summary.blueprints = blueprintsStore.ownedBlueprintIds.length
    }
    return summary
  }

  // 2. ARC Tracker API v2 payload
  const prof = payload?.profile?.user || payload?.profile || {}
  summary.playerName =
    prof.username || prof.displayName || prof.embarkId || prof.name || ''

  // Quests
  if (payload?.quests) {
    const rawQuests = collectCandidateItems(payload.quests)
    const matchedQuests = new Set(questsStore.completedQuestIds)
    for (const rq of rawQuests) {
      const qid = matchQuestId(rq)
      if (qid) matchedQuests.add(qid)
    }
    questsStore.completedQuestIds = [...matchedQuests]
    summary.quests = questsStore.completedQuestIds.length
  }

  // Hideout / Workshop
  if (payload?.hideout) {
    const nextLevels = { ...workshopStore.stationLevels }
    const modules =
      payload.hideout.modules ||
      payload.hideout.hideoutModules ||
      payload.hideout.stations ||
      payload.hideout
    const entries = Array.isArray(modules)
      ? modules
      : typeof modules === 'object'
        ? Object.entries(modules).map(([k, v]) =>
            typeof v === 'object' ? { id: k, ...v } : { id: k, level: v },
          )
        : []

    for (const m of entries) {
      if (!m) continue
      const rawKey = m.id || m.moduleId || m.stationId || (typeof m.name === 'string' ? m.name : m.name?.en)
      const stKey =
        stationKeyLookup.get(String(rawKey || '').toLowerCase()) ||
        stationKeyLookup.get(norm(rawKey))
      const lv = Number(m.level ?? m.currentLevel ?? m.unlockedLevel ?? m.tier)
      if (stKey && Number.isFinite(lv) && lv >= 0) {
        nextLevels[stKey] = lv
        summary.stations++
      }
    }
    workshopStore.stationLevels = nextLevels
  }

  // Outpost Projects
  if (payload?.projects) {
    const matchedStages = new Set(outpostStore.completedStageIds)
    const projs =
      payload.projects.projects || payload.projects.items || payload.projects
    const entries = Array.isArray(projs)
      ? projs
      : typeof projs === 'object'
        ? Object.entries(projs).map(([k, v]) =>
            typeof v === 'object' ? { id: k, ...v } : { id: k, currentPhase: v },
          )
        : []

    for (const p of entries) {
      if (!p) continue
      const rawId = p.id || p.projectId || (typeof p.name === 'string' ? p.name : p.name?.en)
      const targetProj =
        projectLookup.get(rawId) ||
        projectLookup.get(norm(rawId)) ||
        projectLookup.get(norm(String(rawId || '').replace(/_project$/, '')))
      if (!targetProj) continue

      const maxStage = targetProj.stages?.length || 5
      const completedPhaseCount = Number(
        p.completedPhase ?? p.completedPhases ?? p.currentPhase ?? p.level ?? (p.completed ? maxStage : 0),
      )
      if (Number.isFinite(completedPhaseCount) && completedPhaseCount > 0) {
        for (let s = 1; s <= Math.min(maxStage, completedPhaseCount); s++) {
          matchedStages.add(`${targetProj.id}-s${s}`)
        }
      }
      if (Array.isArray(p.phases)) {
        for (const ph of p.phases) {
          const phNum = Number(ph?.phase ?? ph?.stage ?? ph?.order ?? ph?.id)
          if (
            Number.isFinite(phNum) &&
            (ph?.completed === true || ph?.isCompleted === true || ph?.status === 'completed')
          ) {
            matchedStages.add(`${targetProj.id}-s${phNum}`)
          }
        }
      }
    }
    outpostStore.completedStageIds = [...matchedStages]
    summary.stages = outpostStore.completedStageIds.length
  }

  // Blueprints
  if (payload?.blueprints) {
    const rawBps = collectCandidateItems(payload.blueprints)
    const matchedBps = new Set(blueprintsStore.ownedBlueprintIds)
    for (const rb of rawBps) {
      const bpid = matchBlueprintId(rb)
      if (bpid) matchedBps.add(bpid)
    }
    blueprintsStore.ownedBlueprintIds = [...matchedBps]
    summary.blueprints = blueprintsStore.ownedBlueprintIds.length
  }

  return summary
}

export function buildLocalBackupPayload(stores) {
  const { questsStore, workshopStore, outpostStore, blueprintsStore } = stores
  return {
    source: 'arc-map-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      completedQuestIds: [...questsStore.completedQuestIds],
      stationLevels: { ...workshopStore.stationLevels },
      completedStageIds: [...outpostStore.completedStageIds],
      builtFurnitureIds: [...outpostStore.builtFurnitureIds],
      unlockedRoomIds: [...outpostStore.unlockedRoomIds],
      raiderDenLevel: outpostStore.raiderDenLevel,
      ownedBlueprintIds: [...blueprintsStore.ownedBlueprintIds],
    },
  }
}
