import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { QUEST_RULES_PART1 } from './questMapRulesPart1.mjs'
import { QUEST_RULES_PART2 } from './questMapRulesPart2.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

export const QUEST_CATEGORY_META = {
  'area-recon': {
    id: 'area-recon',
    label: '区域勘察',
    shortLabel: '勘察',
    modeLabel: '绿色区域',
    color: '#26bf57',
    icon: '/game-maps/icons/T_UI_QUEST_Visit.png',
  },
  'area-photo': {
    id: 'area-photo',
    label: '拍照侦察',
    shortLabel: '拍照',
    modeLabel: '绿色区域',
    color: '#20d6a7',
    icon: '/game-maps/icons/T_UI_Ping_Enemy_Camera.png',
  },
  'area-loot': {
    id: 'area-loot',
    label: '区域搜刮',
    shortLabel: '搜刮',
    modeLabel: '绿色区域',
    color: '#59d96e',
    icon: '/game-maps/icons/T_UI_Icon_Map_Region.png',
  },
  'area-combat': {
    id: 'area-combat',
    label: '区域猎杀',
    shortLabel: '猎杀',
    modeLabel: '绿色区域',
    color: '#7ee83f',
    icon: '/game-maps/icons/T_UI_QUEST_Kill.png',
  },
  'item-collect': {
    id: 'item-collect',
    label: '道具收集',
    shortLabel: '收集',
    modeLabel: '任务地标',
    color: '#ffb800',
    icon: '/game-maps/icons/T_UI_Icon_Task_Collect.png',
  },
  'item-deliver': {
    id: 'item-deliver',
    label: '物资交付',
    shortLabel: '交付',
    modeLabel: '任务地标',
    color: '#ff7a2f',
    icon: '/game-maps/icons/T_UI_Icon_Task_Collect.png',
  },
  'device-interact': {
    id: 'device-interact',
    label: '机关交互',
    shortLabel: '机关',
    modeLabel: '任务地标',
    color: '#38d6ff',
    icon: '/game-maps/icons/T_UI_Icon_Quest.png',
  },
}

const LANDMARK_TYPE_ICONS = {
  collect: '/game-maps/icons/T_UI_Icon_Task_Collect.png',
  deliver: '/game-maps/icons/T_UI_Icon_Task_Collect.png',
  interact: '/game-maps/icons/T_UI_Icon_Quest.png',
  photo: '/game-maps/icons/T_UI_Ping_Enemy_Camera.png',
}

const LANDMARK_TYPE_LABELS = {
  collect: '道具拾取',
  deliver: '物资交付',
  interact: '交互点位',
  photo: '拍照点位',
}

export function buildQuestMapTargets() {
  const questsPath = path.join(ROOT, 'src/data/questsData.json')
  const mapsPath = path.join(ROOT, 'src/data/mapsWikiData.json')
  const verifiedActorsPath = path.join(ROOT, 'tools/verifiedMapActors.json')

  const questsData = JSON.parse(fs.readFileSync(questsPath, 'utf8'))
  const mapsWiki = JSON.parse(fs.readFileSync(mapsPath, 'utf8'))
  const verifiedActors = JSON.parse(fs.readFileSync(verifiedActorsPath, 'utf8'))

  // Build POI lookup by mapId -> poiId -> poi
  const poiLookup = {}
  for (const m of mapsWiki.maps || []) {
    poiLookup[m.id] = {}
    for (const p of m.pois || []) {
      poiLookup[m.id][p.id] = p
    }
    // Also attach lootZones polygon to poi if missing
    for (const lz of m.lootZones || []) {
      if (lz.poiId && poiLookup[m.id][lz.poiId] && !poiLookup[m.id][lz.poiId].polygon?.length) {
        poiLookup[m.id][lz.poiId].polygon = lz.polygon
      }
    }
  }

  const allRules = { ...QUEST_RULES_PART1, ...QUEST_RULES_PART2 }

  // Store category metadata at top level of questsData
  questsData.taskCategories = Object.values(QUEST_CATEGORY_META)

  let matchedCount = 0

  for (const q of questsData.quests || []) {
    const rule = allRules[q.id]
    if (!rule) {
      console.warn(`[WARN] No quest map rule for quest: ${q.id}`)
      continue
    }
    matchedCount++

    // Preserve questCategory ('trader' | 'event') used by QuestsArchiveView sub-tabs
    q.questCategory = (q.campaigns || []).some((c) => c !== 'All_Quests') ? 'event' : 'trader'

    const catMeta = QUEST_CATEGORY_META[rule.cat] || QUEST_CATEGORY_META['area-recon']
    q.taskType = catMeta.id
    q.taskTypeLabel = catMeta.label
    q.taskTypeShort = catMeta.shortLabel
    q.taskTypeColor = catMeta.color
    q.taskTypeIcon = catMeta.icon

    const isLandmarkCategory = ['item-collect', 'item-deliver', 'device-interact'].includes(rule.cat)

    if (rule.mode === 'none') {
      q.mapDisplayMode = 'none'
      q.recommendedMapId = q.mapIds?.[0] || null
      q.primaryMapId = q.mapIds?.[0] || null
      q.mapTargets = {}
      continue
    }

    q.mapDisplayMode = isLandmarkCategory ? 'landmark' : rule.mode || 'zone'

    // Ensure primaryMapId & recommendedMapId are always valid for specific-location quests
    const targetMapKeys = Object.keys(rule.targets || {})
    const recMap = rule.recMap || q.mapIds?.[0] || targetMapKeys[0] || 'dam-battlegrounds'
    q.recommendedMapId = recMap
    q.primaryMapId = q.mapIds?.[0] || recMap
    if (targetMapKeys.length) {
      const mergedMapIds = new Set([...(q.mapIds || []), ...targetMapKeys])
      q.mapIds = Array.from(mergedMapIds)
    }

    const mapTargets = {}

    // Process explicit per-map targets
    for (const [mId, mSpec] of Object.entries(rule.targets || {})) {
      const mPois = poiLookup[mId] || {}
      const defaultLayer = mId === 'stella-montis' ? 1 : 0

      const findPoi = (poiId) => {
        if (!poiId) return null
        if (mPois[poiId]) return mPois[poiId]
        const prefixKey = Object.keys(mPois).find((k) => k.startsWith(`${poiId}-`))
        return prefixKey ? mPois[prefixKey] : null
      }

      const landmarks = (mSpec.landmarks || []).map((lm, idx) => {
        const lmType = lm.type || 'interact'
        const cleanTitle = String(lm.title || '')
          .replace(/^\d+[A-Za-z]?\.\s*/, '')
          .trim()
        return {
          id: `${q.id}-${mId}-lm-${idx + 1}`,
          step: idx + 1,
          layer: lm.layer ?? defaultLayer,
          x: Number(lm.x),
          y: Number(lm.y),
          title: cleanTitle,
          type: lmType,
          typeLabel: LANDMARK_TYPE_LABELS[lmType] || '任务地标',
          icon: LANDMARK_TYPE_ICONS[lmType] || '/game-maps/icons/T_UI_Icon_Quest.png',
          areaName: lm.area || '目标位置',
          itemText: lm.item || null,
          detail: lm.detail || '',
          targetXY: lm.targetXY || null,
          linkedStage: lm.linkedStage || null,
        }
      })

      // Only separate if two landmarks on the same layer have near-identical coordinates (< 0.45%)
      const MIN_SEP = 0.45
      for (let i = 0; i < landmarks.length; i++) {
        for (let j = i + 1; j < landmarks.length; j++) {
          const a = landmarks[i]
          const b = landmarks[j]
          if (a.layer !== b.layer) continue
          let dx = b.x - a.x
          let dy = b.y - a.y
          const dist = Math.hypot(dx, dy)
          if (dist < MIN_SEP) {
            if (dist < 0.01) {
              dx = 1
              dy = 0
            } else {
              dx /= dist
              dy /= dist
            }
            const push = (MIN_SEP - dist) * 0.52
            a.x = Number(Math.max(2, Math.min(98, a.x - dx * push)).toFixed(2))
            a.y = Number(Math.max(2, Math.min(98, a.y - dy * push)).toFixed(2))
            b.x = Number(Math.max(2, Math.min(98, b.x + dx * push)).toFixed(2))
            b.y = Number(Math.max(2, Math.min(98, b.y + dy * push)).toFixed(2))
          }
        }
      }

      // Keep targetXY synced with the next step's nudged coordinates when targetXY was pointing to it
      for (let i = 0; i < landmarks.length - 1; i++) {
        if (landmarks[i].targetXY) {
          landmarks[i].targetXY = [landmarks[i + 1].x, landmarks[i + 1].y]
        }
      }

      // Only area quests (area-recon, area-photo, area-loot, area-combat) draw green zones.
      // Item/Device quests (item-collect, item-deliver, device-interact) show detailed landmarks only.
      const rawZones = isLandmarkCategory ? [] : mSpec.zones || []

      const zones = rawZones.map((z, idx) => {
        const refPoi = findPoi(z.poi)
        const fallbackLm = landmarks[idx] || landmarks[0] || null
        const x = z.x ?? refPoi?.x ?? fallbackLm?.x ?? 50
        const y = z.y ?? refPoi?.y ?? fallbackLm?.y ?? 50
        const layer = z.layer ?? refPoi?.layer ?? fallbackLm?.layer ?? defaultLayer
        const polygon = z.polygon || (refPoi?.polygon?.length ? refPoi.polygon : null)
        return {
          id: `${q.id}-${mId}-zone-${idx + 1}`,
          layer,
          poiId: refPoi?.id || z.poi || null,
          label: z.label || refPoi?.name || '任务目标区域',
          subLabel: z.sub || '',
          x,
          y,
          r: z.r || (polygon ? 44 : 50),
          polygon,
        }
      })

      mapTargets[mId] = { zones, landmarks }
    }

    q.mapTargets = mapTargets
  }

  fs.writeFileSync(questsPath, JSON.stringify(questsData, null, 2), 'utf8')
  console.log(
    `[questMapTargetsBuilder] Enriched ${matchedCount}/${questsData.quests.length} quests in src/data/questsData.json`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildQuestMapTargets()
}
