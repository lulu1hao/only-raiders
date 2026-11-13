import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import questsData from '../data/questsData.json'
import dailyTrialsData from '../data/dailyTrialsData.json'

export const traderMeta = {
  Shani: {
    name: '萨尼',
    en: 'Shani',
    role: '安全与情报主管',
    color: '#38bdf8',
    avatar: '/traders/T_UI_TRADER_Shani.png',
    dock: '/traders/T_UI_DOCK_Traders_Shani.png',
  },
  Celeste: {
    name: '塞莱斯特',
    en: 'Celeste',
    role: '斯佩兰扎社区领袖',
    color: '#34d399',
    avatar: '/traders/T_UI_TRADER_Celeste.png',
    dock: '/traders/T_UI_DOCK_Traders_Celeste.webp',
  },
  'Tian Wen': {
    name: '天玟',
    en: 'Tian Wen',
    role: '重装军火武器商',
    color: '#f59e0b',
    avatar: '/traders/T_UI_TRADER_TianWen.png',
    dock: '/traders/T_UI_DOCK_Traders_TianWen.png',
  },
  Lance: {
    name: '兰斯',
    en: 'Lance',
    role: '医疗与义体商',
    color: '#a78bfa',
    avatar: '/traders/T_UI_TRADER_Lance.png',
    dock: '/traders/T_UI_DOCK_Traders_Lance.png',
  },
  Apollo: {
    name: '阿波罗',
    en: 'Apollo',
    role: '机械工程与蓝图商',
    color: '#fb7185',
    avatar: '/traders/T_UI_TRADER_Apollo.png',
    dock: '/traders/T_UI_DOCK_Traders_Apollo.png',
  },
  'Nomadic Envoys': {
    name: '游牧使团',
    en: 'Nomadic Envoys',
    role: '地表赛季特使',
    color: '#2dd4bf',
    avatar: '/traders/T_UI_DOCK_Traders_Nomad.png',
    dock: '/traders/T_UI_DOCK_Traders_Nomad.png',
  },
}

export const eventCampaignMeta = {
  Frozen_Trail: {
    image: '/traders/T_UI_Location_FrozenTrail.webp',
    icon: '/game-maps/icons/T_Icon_MapCondition_Frost.png',
    color: '#38bdf8',
  },
  Riven_Tides: {
    image: '/traders/T_UI_Location_RivenTides.webp',
    icon: '/game-maps/icons/T_Icon_StormAftermath.png',
    color: '#2dd4bf',
  },
  Flashpoint: {
    image: '/traders/T_UI_Codex_ARC_Emperor_EntryTile.webp',
    icon: '/game-maps/icons/T_UI_Icon_Event-ARC-Probe.png',
    color: '#f59e0b',
  },
  Shrouded_Sky: {
    image: '/traders/T_UI_Codex_ARC_Frigates_EntryTile.webp',
    icon: '/game-maps/icons/T_Icon_MapCondition_Turbulence.png',
    color: '#a78bfa',
  },
  Headwinds: {
    image: '/traders/T_UI_Codex_Topside_BlueGateNomads_EntryTile.webp',
    icon: '/game-maps/icons/T_Icon_MapCondition_BirdCity.png',
    color: '#34d399',
  },
  Cold_Snap: {
    image: '/traders/T_UI_Codex_WinterEvent_EntryTile_1.webp',
    icon: '/game-maps/icons/T_Icon_MapCondition_Frost.png',
    color: '#60a5fa',
  },
  North_Line: {
    image: '/traders/T_UI_Location_StellaMontis.webp',
    icon: '/game-maps/icons/T_UI_Icon_LockedGate.png',
    color: '#fb7185',
  },
}

const STATIC_QUESTS = Object.freeze((questsData.quests || []).map((q) => Object.freeze(q)))
const STATIC_TASK_CATEGORIES = Object.freeze(questsData.taskCategories || [])
const STATIC_DAILY_TRIALS = Object.freeze(dailyTrialsData || [])
const STATIC_TRADER_QUESTS = Object.freeze(
  STATIC_QUESTS.filter((q) => q.questCategory === 'trader'),
)
const STATIC_EVENT_QUESTS = Object.freeze(
  STATIC_QUESTS.filter((q) => q.questCategory === 'event'),
)

export const useQuestsStore = defineStore(
  'quests',
  () => {
    const globalSearch = ref('')
    const questSubTab = ref('trader') // 'trader' | 'event'
    const activeTrader = ref('ALL')
    const activeEventCampaign = ref('ALL')
    const activeTaskType = ref('ALL')
    const eventViewMode = ref('campaigns') // 'campaigns' | 'trials'
    const questStatusFilter = ref('ALL') // 'ALL' | 'TODO' | 'DONE'
    const selectedQuestId = ref(STATIC_QUESTS[0]?.id || '')
    const taskCategories = STATIC_TASK_CATEGORIES

    // Persisted arrays of IDs
    const completedQuestIds = ref([])
    const completedQuestIdSet = computed(() => new Set(completedQuestIds.value))

    function isQuestDone(id) {
      return completedQuestIdSet.value.has(id)
    }

    function toggleQuestDone(id) {
      const idx = completedQuestIds.value.indexOf(id)
      if (idx >= 0) completedQuestIds.value.splice(idx, 1)
      else completedQuestIds.value.push(id)
    }

    const traderQuests = computed(() => STATIC_TRADER_QUESTS)
    const eventQuests = computed(() => STATIC_EVENT_QUESTS)

    const traderStats = computed(() => {
      const list = ['Shani', 'Celeste', 'Tian Wen', 'Lance', 'Apollo']
      return list.map((id) => {
        const all = traderQuests.value.filter((q) => q.trader === id)
        const done = all.filter((q) => isQuestDone(q.id)).length
        return {
          id,
          ...traderMeta[id],
          total: all.length,
          done,
          pct: all.length ? Math.round((done / all.length) * 100) : 0,
        }
      })
    })

    const eventCampaignStats = computed(() => {
      const campaigns = questsData.campaigns.filter((c) => c.id !== 'All_Quests')
      return campaigns.map((c) => {
        const all = eventQuests.value.filter((q) => (q.campaigns || []).includes(c.id))
        const done = all.filter((q) => isQuestDone(q.id)).length
        const meta = eventCampaignMeta[c.id] || {
          image: '/traders/T_UI_Codex_Toledo_Outpost_EntryTile.webp',
          icon: '/game-maps/icons/T_Icon_Event.png',
          color: '#f59e0b',
        }
        return {
          id: c.id,
          label: c.label.split(' (')[0],
          sub: c.label.match(/\((.+)\)/)?.[1] || c.id,
          ...meta,
          total: all.length,
          done,
          pct: all.length ? Math.round((done / all.length) * 100) : 0,
        }
      })
    })

    const filteredQuestList = computed(() => {
      const base = questSubTab.value === 'trader' ? traderQuests.value : eventQuests.value
      const kw = globalSearch.value.trim().toLowerCase()

      return base.filter((q) => {
        if (questSubTab.value === 'trader' && activeTrader.value !== 'ALL') {
          if (q.trader !== activeTrader.value) return false
        }
        if (questSubTab.value === 'event' && activeEventCampaign.value !== 'ALL') {
          if (!(q.campaigns || []).includes(activeEventCampaign.value)) return false
        }
        if (activeTaskType.value !== 'ALL' && q.taskType !== activeTaskType.value) {
          return false
        }
        if (questStatusFilter.value !== 'ALL') {
          if (questStatusFilter.value === 'TODO' && isQuestDone(q.id)) return false
          if (questStatusFilter.value === 'DONE' && !isQuestDone(q.id)) return false
        }

        if (kw) {
          const hay = [
            q.zhTitle,
            q.title,
            q.trader,
            q.zhTrader,
            q.zhLocation,
            q.taskTypeLabel,
            q.zhRequiredItems,
            ...(q.zhRewards || []),
          ]
            .join(' ')
            .toLowerCase()
          return hay.includes(kw)
        }
        return true
      })
    })

    watch(
      filteredQuestList,
      (list) => {
        if (list.length && !list.some((q) => q.id === selectedQuestId.value)) {
          selectedQuestId.value = list[0].id
        }
      },
      { immediate: true },
    )

    const selectedQuest = computed(
      () =>
        filteredQuestList.value.find((q) => q.id === selectedQuestId.value) ||
        filteredQuestList.value[0] ||
        null,
    )

    return {
      globalSearch,
      questSubTab,
      activeTrader,
      activeEventCampaign,
      activeTaskType,
      taskCategories,
      eventViewMode,
      questStatusFilter,
      selectedQuestId,
      completedQuestIds,
      traderQuests,
      eventQuests,
      traderStats,
      eventCampaignStats,
      filteredQuestList,
      selectedQuest,
      dailyTrials: STATIC_DAILY_TRIALS,
      totalQuests: questsData.totalQuests,
      isQuestDone,
      toggleQuestDone,
    }
  },
  {
    persist: {
      key: 'arc_quests_store_v2',
      pick: ['completedQuestIds'],
    },
  },
)
