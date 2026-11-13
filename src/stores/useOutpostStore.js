import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import outpostVerifiedData from '../data/outpostVerifiedData.json'
import { useQuestsStore } from './useQuestsStore'

export const useOutpostStore = defineStore(
  'outpost',
  () => {
    const outpostSubTab = ref('projects') // 'projects' | 'rooms' | 'den' | 'furniture'
    const selectedRoomId = ref('room-base')
    const selectedFurnitureCategory = ref('ALL')
    const selectedStorageFilter = ref('all') // 'all' | 'has_storage' | 'trinket' | 'weapon' | 'pillow' | 'functional'
    const selectedFurnitureId = ref(outpostVerifiedData.furnitureList?.[0]?.id || '')
    const selectedProjectId = ref('proj-sheltered-retreat')

    const completedStageIds = ref([])
    const builtFurnitureIds = ref([])
    const unlockedRoomIds = ref(['room-base'])
    const raiderDenLevel = ref('Lv.1')

    const completedStageIdSet = computed(() => new Set(completedStageIds.value))
    const builtFurnitureIdSet = computed(() => new Set(builtFurnitureIds.value))
    const unlockedRoomIdSet = computed(() => new Set(unlockedRoomIds.value))

    const shelteredRetreat = outpostVerifiedData.shelteredRetreat
    const raiderProjects = Object.freeze(outpostVerifiedData.raiderProjects || [])
    const outpostRooms = Object.freeze(outpostVerifiedData.outpostRooms || [])
    const raiderDenStages = Object.freeze(outpostVerifiedData.raiderDenStages || [])
    const furnitureCategories = Object.freeze(outpostVerifiedData.furnitureCategories || [])
    const furnitureList = Object.freeze(
      (outpostVerifiedData.furnitureList || []).map((f) => Object.freeze(f)),
    )

    /** 避风港（前置）+ 4 个奇袭者工程，统一为一个列表 */
    const allProjects = Object.freeze([
      ...(shelteredRetreat ? [Object.freeze({ ...shelteredRetreat, isUnlockProject: true })] : []),
      ...raiderProjects.map((p) => Object.freeze({ ...p, isUnlockProject: false })),
    ])

    const totalStages = allProjects.reduce((acc, p) => acc + (p.stages?.length || 0), 0)

    const stageKey = (projId, stageNo) => `${projId}-s${stageNo}`

    const selectedProject = computed(
      () => allProjects.find((p) => p.id === selectedProjectId.value) || allProjects[0],
    )

    const selectedRoom = computed(
      () => outpostRooms.find((r) => r.id === selectedRoomId.value) || outpostRooms[0],
    )

    function matchStorageFilter(f, sf) {
      if (sf === 'all') return true
      if (sf === 'has_storage') return f.storageType !== 'none'
      if (sf === 'functional') return f.storageType === 'stash' || f.storageType === 'wardrobe'
      return f.storageType === sf
    }

    function matchKeyword(f, kw) {
      if (!kw) return true
      const hay = [
        f.name,
        f.enName,
        f.categoryZh,
        f.functionalRole,
        f.storageTypeLabel,
        f.storageBadge,
        ...(f.craftMaterials || []).map((m) => `${m.zhName} ${m.enName}`),
        ...(f.researchMaterials || []).map((m) => `${m.zhName} ${m.enName}`),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(kw)
    }

    const searchKeyword = computed(() => {
      const questsStore = useQuestsStore()
      return (questsStore.globalSearch || '').trim().toLowerCase()
    })

    /** 仅应用「储物筛选 + 搜索」，用于左侧分类计数 */
    const furnitureBeforeCategory = computed(() =>
      furnitureList.filter(
        (f) =>
          matchStorageFilter(f, selectedStorageFilter.value) && matchKeyword(f, searchKeyword.value),
      ),
    )

    const categoryCounts = computed(() => {
      const map = { ALL: furnitureBeforeCategory.value.length }
      for (const f of furnitureBeforeCategory.value) map[f.category] = (map[f.category] || 0) + 1
      return map
    })

    const filteredFurniture = computed(() =>
      furnitureBeforeCategory.value.filter(
        (f) =>
          selectedFurnitureCategory.value === 'ALL' || f.category === selectedFurnitureCategory.value,
      ),
    )

    const selectedFurniture = computed(() => {
      const list = filteredFurniture.value
      return list.find((f) => f.id === selectedFurnitureId.value) || list[0] || null
    })

    function isStageDone(key) {
      return completedStageIdSet.value.has(key)
    }

    function toggleStageDone(key) {
      const idx = completedStageIds.value.indexOf(key)
      if (idx >= 0) completedStageIds.value.splice(idx, 1)
      else completedStageIds.value.push(key)
    }

    function projectDoneCount(proj) {
      return (proj?.stages || []).filter((s) => isStageDone(stageKey(proj.id, s.stage))).length
    }

    function isFurnitureBuilt(id) {
      return builtFurnitureIdSet.value.has(id)
    }

    function toggleFurnitureBuilt(id) {
      const idx = builtFurnitureIds.value.indexOf(id)
      if (idx >= 0) builtFurnitureIds.value.splice(idx, 1)
      else builtFurnitureIds.value.push(id)
    }

    function isRoomUnlocked(roomId) {
      return unlockedRoomIdSet.value.has(roomId)
    }

    function toggleRoomUnlocked(roomId) {
      if (roomId === 'room-base') return
      const idx = unlockedRoomIds.value.indexOf(roomId)
      if (idx >= 0) unlockedRoomIds.value.splice(idx, 1)
      else unlockedRoomIds.value.push(roomId)
    }

    return {
      outpostSubTab,
      selectedRoomId,
      selectedFurnitureCategory,
      selectedStorageFilter,
      selectedFurnitureId,
      selectedProjectId,
      completedStageIds,
      builtFurnitureIds,
      unlockedRoomIds,
      raiderDenLevel,
      shelteredRetreat,
      raiderProjects,
      allProjects,
      totalStages,
      outpostRooms,
      raiderDenStages,
      furnitureCategories,
      furnitureList,
      selectedProject,
      selectedRoom,
      categoryCounts,
      filteredFurniture,
      selectedFurniture,
      stageKey,
      isStageDone,
      toggleStageDone,
      projectDoneCount,
      isFurnitureBuilt,
      toggleFurnitureBuilt,
      isRoomUnlocked,
      toggleRoomUnlocked,
    }
  },
  {
    persist: {
      key: 'arc_outpost_store_v3',
      pick: ['completedStageIds', 'builtFurnitureIds', 'unlockedRoomIds', 'raiderDenLevel'],
    },
  },
)
