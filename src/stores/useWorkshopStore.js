import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import questResourcesData from '../data/questResourcesData.json'
import { useQuestsStore } from './useQuestsStore'

export const useWorkshopStore = defineStore(
  'workshop',
  () => {
    const workshopSubTab = ref('stations') // 'stations' | 'scrappy' | 'feeder' | 'materials'
    const selectedStationId = ref('gunsmith')
    const selectedScrappyLevel = ref(2)
    const selectedFeederCategory = ref('ALL')
    const selectedFeederFoodId = ref('feeder-fruit-mix')
    const materialsScope = ref('ALL') // 'ALL' | 'stations' | 'scrappy'

    const stationLevels = ref({
      gunsmith: 1,
      gear_bench: 1,
      medical_lab: 1,
      explosives_station: 1,
      utility_station: 1,
      refiner: 1,
      research_station: 0,
      workbench: 1,
      scrappy: 1,
    })

    const stations = questResourcesData.workshop.stations || []
    const scrappyLevels = questResourcesData.workshop.scrappyLevels || []
    const scrappyFeeder = questResourcesData.workshop.scrappyFeeder || {
      categories: [],
      foods: [],
      rules: [],
    }

    const keyword = computed(() => (useQuestsStore().globalSearch || '').trim().toLowerCase())
    const hit = (parts) => parts.join(' ').toLowerCase().includes(keyword.value)

    const lvOf = (id) => stationLevels.value[id] ?? (id === 'research_station' ? 0 : 1)

    const selectedStation = computed(
      () => stations.find((s) => s.id === selectedStationId.value) || stations[0],
    )

    /** 搜索时，仅保留名称 / 配方 / 升级材料命中的工作台 */
    const visibleStations = computed(() => {
      if (!keyword.value) return stations
      return stations.filter((st) =>
        hit([
          st.name,
          st.enName,
          ...st.levels.flatMap((l) => [
            ...(l.materials || []).map((m) => `${m.zhName} ${m.enName}`),
            ...(l.unlocks || []).map((u) => `${u.name} ${u.enName}`),
          ]),
        ]),
      )
    })

    const selectedScrappy = computed(
      () => scrappyLevels.find((l) => l.level === selectedScrappyLevel.value) || scrappyLevels[0],
    )

    const feederFoodsBySearch = computed(() => {
      const foods = scrappyFeeder.foods || []
      if (!keyword.value) return foods
      return foods.filter((f) =>
        hit([
          f.name,
          f.enName,
          f.categoryLabel,
          ...(f.rewardGroups || []).flatMap((g) => g.items.map((i) => `${i.zhName} ${i.enName}`)),
        ]),
      )
    })

    const feederCategoryCounts = computed(() => {
      const map = { ALL: feederFoodsBySearch.value.length }
      for (const f of feederFoodsBySearch.value) map[f.categoryKey] = (map[f.categoryKey] || 0) + 1
      return map
    })

    const filteredFeederFoods = computed(() => {
      const cat = selectedFeederCategory.value
      if (!cat || cat === 'ALL') return feederFoodsBySearch.value
      return feederFoodsBySearch.value.filter((f) => f.categoryKey === cat)
    })

    const selectedFeederFood = computed(() => {
      const list = filteredFeederFoods.value
      return list.find((f) => f.id === selectedFeederFoodId.value) || list[0] || null
    })

    function setStationLevel(stationId, level, maxLevel = 5) {
      const clamped = Math.max(0, Math.min(maxLevel, level))
      stationLevels.value = { ...stationLevels.value, [stationId]: clamped }
    }

    /** 尚未建成等级所需的全部升级材料（按道具合并） */
    const remainingWorkshopMaterials = computed(() => {
      const tally = new Map()
      const addMat = (m, sourceName, scope) => {
        if (typeof m.count !== 'number' || m.count <= 0) return
        const key = m.enName || m.item
        const prev = tally.get(key) || {
          item: m.item,
          zhName: m.zhName || String(m.item).split(' (')[0],
          enName: m.enName || key,
          icon: m.icon || null,
          source: m.source || '',
          count: 0,
          usedBy: [],
          scopes: new Set(),
          mapLinks: m.mapLinks || [],
        }
        prev.count += m.count
        prev.usedBy.push({ label: sourceName, count: m.count })
        prev.scopes.add(scope)
        if (!prev.mapLinks.length && m.mapLinks?.length) prev.mapLinks = m.mapLinks
        tally.set(key, prev)
      }

      stations.forEach((st) => {
        const cur = lvOf(st.id)
        st.levels.forEach((lvObj) => {
          if (lvObj.level > cur) {
            ;(lvObj.materials || []).forEach((m) =>
              addMat(m, `${st.zhName} Lv.${lvObj.level}`, 'stations'),
            )
          }
        })
      })

      const scCur = stationLevels.value.scrappy ?? 1
      scrappyLevels.forEach((lvObj) => {
        if (lvObj.level > scCur) {
          ;(lvObj.materials || []).forEach((m) => addMat(m, `废品仔 Lv.${lvObj.level}`, 'scrappy'))
        }
      })

      return [...tally.values()]
        .map((x) => ({ ...x, scopes: [...x.scopes] }))
        .sort((a, b) => b.count - a.count)
    })

    const visibleMaterials = computed(() =>
      remainingWorkshopMaterials.value.filter(
        (m) =>
          (materialsScope.value === 'ALL' || m.scopes.includes(materialsScope.value)) &&
          (!keyword.value || hit([m.zhName, m.enName, m.source])),
      ),
    )

    const totalWorkshopLevels = computed(
      () => stations.reduce((acc, s) => acc + s.levels.length, 0) + scrappyLevels.length,
    )

    const currentWorkshopLevels = computed(() => {
      const stCount = stations.reduce(
        (acc, s) => acc + s.levels.filter((l) => l.level <= lvOf(s.id)).length,
        0,
      )
      const scLv = stationLevels.value.scrappy ?? 1
      return stCount + scrappyLevels.filter((l) => l.level <= scLv).length
    })

    return {
      workshopSubTab,
      selectedStationId,
      selectedScrappyLevel,
      selectedFeederCategory,
      selectedFeederFoodId,
      materialsScope,
      stationLevels,
      stations,
      visibleStations,
      scrappyLevels,
      scrappyFeeder,
      selectedStation,
      selectedScrappy,
      feederCategoryCounts,
      filteredFeederFoods,
      selectedFeederFood,
      remainingWorkshopMaterials,
      visibleMaterials,
      totalWorkshopLevels,
      currentWorkshopLevels,
      lvOf,
      setStationLevel,
    }
  },
  {
    persist: {
      key: 'arc_workshop_store_v3',
      pick: ['stationLevels'],
    },
  },
)
