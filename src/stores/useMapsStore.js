import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import mapsWikiData from '../data/mapsWikiData.json'
import questsData from '../data/questsData.json'
import { useQuestsStore } from './useQuestsStore'
import { invokeTauri, isTauriRuntime } from './useOverlayWindowStore'

// Official Embark Map Conditions rotate on the hour, lasting 60 minutes (durationInSeconds: 3600)
const ROTATION_WINDOW_MS = 60 * 60 * 1000

const OFFICIAL_MAP_NAME_TO_ID = {
  'Dam Battlegrounds': 'dam-battlegrounds',
  'Buried City': 'buried-city',
  Spaceport: 'spaceport',
  'The Blue Gate': 'blue-gate',
  'Stella Montis': 'stella-montis',
  'Riven Tides': 'riven-tides',
  'Pendola Pass': 'pendola-pass',
}

const OFFICIAL_COND_NAME_TO_ID = {
  'ARC Frigate': 'arc-frigate',
  Beachcombing: 'buried-treasure',
  'Bird City': 'bird-city',
  'Close Scrutiny': 'close-scrutiny',
  'Cold Snap': 'cold-snap',
  'Electromagnetic Storm': 'electromagnetic-storm',
  Harvester: 'harvester',
  'Hidden Bunker': 'hidden-bunker',
  Hurricane: 'hurricane',
  'Husk Graveyard': 'husk-graveyard',
  'Launch Tower Loot': 'launch-tower-loot',
  'Locked Gate': 'locked-gate',
  'Lush Blooms': 'lush-blooms',
  Matriarch: 'matriarch',
  'Night Raid': 'night-raid',
  'Prospecting Probes': 'prospecting-probes',
  Redirection: 'fallen-emperor',
  'Uncovered Caches': 'uncovered-caches',
}

function parseOfficialHtmlSchedule(html) {
  const match = html.match(/\{\\"conditionItems\\":\[[\s\S]*?\\"serverNow\\":\d+\}/)
  if (!match) return null
  const data = JSON.parse(JSON.parse(`"${match[0]}"`))
  const typeByCond = new Map((data.conditionItems || []).map((c) => [c.name, c.type]))
  const entries = []
  for (const raw of data.liveEntries || []) {
    const mapId = OFFICIAL_MAP_NAME_TO_ID[raw.mapDisplayName]
    const eventId = OFFICIAL_COND_NAME_TO_ID[raw.conditionName]
    if (!mapId || !eventId) continue
    entries.push({
      mapId,
      eventId,
      conditionName: raw.conditionName,
      mapDisplayName: raw.mapDisplayName,
      officialType: typeByCond.get(raw.conditionName) || 'minor',
      durationInSeconds: raw.durationInSeconds || 3600,
      startTimestamp: raw.startTimestamp,
      endTimestamp: raw.endTimestamp,
      regionTimestamps: raw.regionTimestamps || null,
    })
  }
  if (!entries.length) return null
  return {
    sourceUrl: 'https://arcraiders.com/map-conditions',
    fetchedAt: Date.now(),
    serverNow: data.serverNow || Date.now(),
    windowDurationMs: ROTATION_WINDOW_MS,
    minStartTimestamp: Math.min(...entries.map((e) => e.startTimestamp)),
    maxEndTimestamp: Math.max(...entries.map((e) => e.endTimestamp)),
    entries,
  }
}

export const useMapsStore = defineStore(
  'maps',
  () => {
    const questsStore = useQuestsStore()

    // Persisted server preference
    const selectedServerId = ref('AS')
    // Persisted 3D World Map toggle preference (defaults to false: do not load 3D unless enabled)
    const worldMap3DEnabled = ref(false)
    // Level 1 World Map preview selection
    const previewMapId = ref('dam-battlegrounds')
    // Manual event overrides per map: { [mapId]: eventId } (empty/null = follow live server schedule)
    const manualEventByMap = ref({})
    // Active quest being tracked inside map views (synced with ?quest= query param)
    const trackedQuestId = ref('')
    // Active POI inspected inside detailed map view
    const selectedPoiId = ref('')

    // Tactical map layer visibility switches
    const layers = ref({
      lootZones: true,
      pois: true,
      minorPois: false,
      extractions: true,
      hatches: true,
      lockedRooms: true,
      stages3D: true,
      eventMarkers: true,
      grid: false,
    })

    // Official Embark schedule state (initialized from build-time official snapshot, upgraded live on mount)
    const officialSchedule = shallowRef(mapsWikiData.officialSchedule || null)
    const isSyncingSchedule = ref(false)
    const scheduleSyncSource = ref(
      mapsWikiData.officialSchedule?.entries?.length ? 'official-snapshot' : 'cycle',
    )

    // Clock offset (serverNow - clientNow) so local clock drifts don't desync schedule
    const clockSkewMs = ref(0)
    const nowMs = ref(Date.now())
    let clockTimer = null
    let clockConsumers = 0
    let hasAttemptedInitialSync = false

    function applyLiveSchedulePayload(payload) {
      if (!payload || !Array.isArray(payload.entries) || payload.entries.length === 0) return false
      officialSchedule.value = payload
      scheduleSyncSource.value = 'official-live'
      if (payload.serverNow) {
        clockSkewMs.value = payload.serverNow - Date.now()
        nowMs.value = Date.now() + clockSkewMs.value
      }
      return true
    }

    async function refreshOfficialSchedule(force = false) {
      if (isSyncingSchedule.value) return false
      isSyncingSchedule.value = true
      try {
        // 0. Prefer native Rust command in Tauri runtime (works in packaged tauri build with zero CORS)
        if (isTauriRuntime()) {
          const ipcPayload = await invokeTauri('fetch_official_schedule', { force })
          if (ipcPayload?.ok && applyLiveSchedulePayload(ipcPayload)) {
            return true
          }
        }

        // 1. Try Vite dev/preview proxy endpoint (/api/official-schedule)
        try {
          const apiUrl = `/api/official-schedule${force ? '?force=1' : ''}`
          const res = await fetch(apiUrl, { headers: { Accept: 'application/json' } })
          if (res.ok) {
            const json = await res.json()
            if (json?.ok && applyLiveSchedulePayload(json)) {
              return true
            }
          }
        } catch {
          // Fallback to direct fetch
        }

        // 2. Try direct fetch from https://arcraiders.com/map-conditions (non-CORS fallback)
        try {
          const directRes = await fetch('https://arcraiders.com/map-conditions')
          if (directRes.ok) {
            const html = await directRes.text()
            const parsed = parseOfficialHtmlSchedule(html)
            if (applyLiveSchedulePayload(parsed)) {
              return true
            }
          }
        } catch {
          // Ignore and retain snapshot
        }

        return false
      } finally {
        isSyncingSchedule.value = false
      }
    }

    function startClock() {
      clockConsumers++
      if (!hasAttemptedInitialSync) {
        hasAttemptedInitialSync = true
        refreshOfficialSchedule(false)
      }
      if (clockTimer) return
      nowMs.value = Date.now() + clockSkewMs.value
      clockTimer = window.setInterval(() => {
        nowMs.value = Date.now() + clockSkewMs.value
      }, 1000)
    }

    function stopClock() {
      clockConsumers = Math.max(0, clockConsumers - 1)
      if (clockConsumers === 0 && clockTimer) {
        clearInterval(clockTimer)
        clockTimer = null
      }
    }

    const worldMapImage = mapsWikiData.worldMapImage || 'game-maps/world-calabretta.jpg'
    const servers = Object.freeze(mapsWikiData.servers || [])
    const eventsDict = Object.freeze(mapsWikiData.events || {})
    const trialCategories = Object.freeze(mapsWikiData.trialCategories || [])
    const plantCategories = Object.freeze(mapsWikiData.plantCategories || [])
    const eliteArcCategories = Object.freeze(mapsWikiData.eliteArcCategories || [])
    const maps = Object.freeze((mapsWikiData.maps || []).map((m) => Object.freeze(m)))

    const selectedServer = computed(
      () => servers.find((s) => s.id === selectedServerId.value) || servers[0],
    )

    const mapsById = new Map()
    for (const item of maps) mapsById.set(item.id, item)

    const trialCategoriesById = new Map()
    for (const tc of trialCategories) trialCategoriesById.set(tc.id, tc)

    const plantCategoriesById = new Map()
    for (const pc of plantCategories) plantCategoriesById.set(pc.id, pc)

    const eliteArcCategoriesById = new Map()
    for (const ac of eliteArcCategories) eliteArcCategoriesById.set(ac.id, ac)

    const questsById = new Map()
    const questsByMapId = new Map()
    for (const q of questsData.quests || []) {
      questsById.set(q.id, q)
      const targetMapIds = q.mapIds?.length
        ? q.mapIds
        : q.recommendedMapId
          ? [q.recommendedMapId]
          : []
      for (const mid of targetMapIds) {
        if (!questsByMapId.has(mid)) questsByMapId.set(mid, [])
        questsByMapId.get(mid).push(q)
      }
    }

    function getMapById(mapId) {
      return mapsById.get(mapId) || maps[0]
    }

    function getEventById(eventId) {
      return eventsDict[eventId] || eventsDict['standard-patrol']
    }

    function getTrialCategoryById(trialId) {
      return trialCategoriesById.get(trialId) || null
    }

    function getPlantCategoryById(plantId) {
      return plantCategoriesById.get(plantId) || null
    }

    function getEliteArcCategoryById(arcId) {
      return eliteArcCategoriesById.get(arcId) || null
    }

    // Current 1-hour rotation slot index & countdown string
    const currentSlotIndex = computed(() => Math.floor(nowMs.value / ROTATION_WINDOW_MS))

    const rotationRemainingSec = computed(() => {
      const elapsed = nowMs.value % ROTATION_WINDOW_MS
      return Math.max(0, Math.floor((ROTATION_WINDOW_MS - elapsed) / 1000))
    })

    const rotationCountdownText = computed(() => {
      const total = rotationRemainingSec.value
      const mm = String(Math.floor(total / 60)).padStart(2, '0')
      const ss = String(total % 60).padStart(2, '0')
      return `${mm}:${ss}`
    })

    // Transform official entries to the target server region (1:1 with module 31036 of arcraiders.com)
    const regionAdjustedScheduleByServer = computed(() => {
      const rawEntries = officialSchedule.value?.entries || []
      const byServer = new Map()
      if (!rawEntries.length) return byServer

      for (const srv of servers) {
        const regKey = srv.officialRegionKey || 'europe'
        let minRegionStart = Infinity
        let maxRegionEnd = -Infinity
        const adjusted = []

        for (const e of rawEntries) {
          const rt = regKey !== 'europe' ? e.regionTimestamps?.[regKey] : null
          const startTimestamp = rt ? rt[0] : e.startTimestamp
          const endTimestamp = rt ? rt[1] : e.endTimestamp
          if (rt || regKey === 'europe') {
            if (startTimestamp < minRegionStart) minRegionStart = startTimestamp
            if (endTimestamp > maxRegionEnd) maxRegionEnd = endTimestamp
          }
          adjusted.push({
            ...e,
            startTimestamp,
            endTimestamp,
          })
        }

        byServer.set(srv.id, {
          minRegionStart,
          maxRegionEnd,
          entries: adjusted,
        })
      }
      return byServer
    })

    // Compute live scheduled primary (Major) & secondary (Minor) events for a map on a server + hour offset
    function getScheduledSlotForMap(mapId, slotOffset = 0, serverId = selectedServerId.value) {
      const map = getMapById(mapId)
      const srv = servers.find((s) => s.id === serverId) || servers[0]
      const startMs = (currentSlotIndex.value + slotOffset) * ROTATION_WINDOW_MS
      const endMs = startMs + ROTATION_WINDOW_MS

      // 1. Check exact match inside the official Embark liveEntries window for this server region
      const regionData = regionAdjustedScheduleByServer.value.get(srv.id)
      if (
        regionData &&
        startMs >= regionData.minRegionStart &&
        startMs < regionData.maxRegionEnd
      ) {
        const slotEntries = regionData.entries.filter(
          (e) => e.mapId === map.id && e.startTimestamp <= startMs && startMs < e.endTimestamp,
        )
        const majorEntry = slotEntries.find((e) => e.officialType === 'major')
        const minorEntry = slotEntries.find((e) => e.officialType === 'minor')
        return {
          slotOffset,
          startMs,
          endMs,
          isOfficialLive: true,
          primaryEvent: majorEntry
            ? getEventById(majorEntry.eventId)
            : getEventById('standard-patrol'),
          secondaryEvent: minorEntry ? getEventById(minorEntry.eventId) : null,
        }
      }

      // 2. Seamless fallback using the map's 42-hour official rotationCycle + exact regional hour offset
      const cycle = map.rotationCycle || [{ primary: 'standard-patrol', secondary: null }]
      const anchorStartMs = officialSchedule.value?.minStartTimestamp || 0
      const europeEquivalentMs = startMs - (srv.europeOffsetHours ?? 0) * ROTATION_WINDOW_MS
      const rawIdx = Math.floor((europeEquivalentMs - anchorStartMs) / ROTATION_WINDOW_MS)
      const idx = ((rawIdx % cycle.length) + cycle.length) % cycle.length
      const pair = cycle[idx] || { primary: 'standard-patrol', secondary: null }

      return {
        slotOffset,
        startMs,
        endMs,
        isOfficialLive: false,
        primaryEvent: getEventById(pair.primary),
        secondaryEvent: pair.secondary ? getEventById(pair.secondary) : null,
      }
    }

    // Effective active state for a map (respects manual override if set, otherwise live server slot)
    function getActiveStateForMap(mapId) {
      const liveSlot = getScheduledSlotForMap(mapId, 0)
      const manualId = manualEventByMap.value[mapId]
      const isManual = Boolean(manualId && eventsDict[manualId])
      const activePrimary = isManual ? getEventById(manualId) : liveSlot.primaryEvent
      const activeSecondary =
        isManual && liveSlot.secondaryEvent?.id === manualId ? null : liveSlot.secondaryEvent

      // Check if either primary or secondary event disables hatches or extends duration
      const map = getMapById(mapId)
      const hatchesDisabled = Boolean(
        activePrimary.hatchesDisabled || (!isManual && activeSecondary?.hatchesDisabled),
      )
      const reducedExtractions = Boolean(
        activePrimary.reducedExtractions || (!isManual && activeSecondary?.reducedExtractions),
      )
      const effectiveDuration = Math.max(
        map.durationMinutes || 30,
        activePrimary.durationMinutes || 30,
        !isManual && activeSecondary?.durationMinutes ? activeSecondary.durationMinutes : 30,
      )

      return {
        isManual,
        manualEventId: isManual ? manualId : null,
        isOfficialLive: liveSlot.isOfficialLive,
        livePrimary: liveSlot.primaryEvent,
        liveSecondary: liveSlot.secondaryEvent,
        activePrimary,
        activeSecondary,
        hatchesDisabled,
        reducedExtractions,
        effectiveDuration,
      }
    }

    function setManualEvent(mapId, eventId) {
      if (!eventId || eventId === 'LIVE') {
        const next = { ...manualEventByMap.value }
        delete next[mapId]
        manualEventByMap.value = next
      } else {
        manualEventByMap.value = {
          ...manualEventByMap.value,
          [mapId]: eventId,
        }
      }
    }

    // Get upcoming N 1-hour windows for a map on the active server
    function getUpcomingSchedule(mapId, count = 8) {
      const list = []
      const fmtHour = (ms) => {
        const d = new Date(ms)
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      }
      for (let i = 0; i < count; i++) {
        const slot = getScheduledSlotForMap(mapId, i)
        const rangeText = `${fmtHour(slot.startMs)}-${fmtHour(slot.endMs)}`
        list.push({
          ...slot,
          rangeText,
          timeLabel: i === 0 ? `当前 (${rangeText})` : rangeText,
        })
      }
      return list
    }

    // Quests linked to a specific map (including Any-map quests that have targets/recommendation on this map)
    function getQuestsForMap(mapId) {
      return questsByMapId.get(mapId) || []
    }

    function getTodoQuestsForMap(mapId) {
      return getQuestsForMap(mapId).filter((q) => !questsStore.isQuestDone(q.id))
    }

    const trackedQuest = computed(() => {
      if (!trackedQuestId.value) return null
      return questsById.get(trackedQuestId.value) || null
    })

    return {
      worldMapImage,
      servers,
      eventsDict,
      trialCategories,
      plantCategories,
      eliteArcCategories,
      maps,
      selectedServerId,
      selectedServer,
      worldMap3DEnabled,
      previewMapId,
      manualEventByMap,
      trackedQuestId,
      trackedQuest,
      selectedPoiId,
      layers,
      officialSchedule,
      isSyncingSchedule,
      scheduleSyncSource,
      rotationRemainingSec,
      rotationCountdownText,
      refreshOfficialSchedule,
      startClock,
      stopClock,
      getMapById,
      getEventById,
      getTrialCategoryById,
      getPlantCategoryById,
      getEliteArcCategoryById,
      getScheduledSlotForMap,
      getActiveStateForMap,
      setManualEvent,
      getUpcomingSchedule,
      getQuestsForMap,
      getTodoQuestsForMap,
    }
  },
  {
    persist: {
      key: 'arc_maps_store_v2',
      pick: ['selectedServerId', 'layers', 'worldMap3DEnabled'],
    },
  },
)
