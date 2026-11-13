<script setup>
import { computed } from 'vue'
import { useWorkshopStore } from '../../stores/useWorkshopStore'
import SubNavBar from '../../components/common/SubNavBar.vue'
import StationUpgradeMatrix from './components/StationUpgradeMatrix.vue'
import ScrappyForagingGuide from './components/ScrappyForagingGuide.vue'
import ScrappyFeederBoard from './components/ScrappyFeederBoard.vue'
import WorkshopMaterialsList from './components/WorkshopMaterialsList.vue'

const store = useWorkshopStore()

const subNavItems = computed(() => [
  { id: 'stations', label: '工作台', count: store.stations.length },
  { id: 'scrappy', label: '废品仔', count: `Lv.${store.stationLevels.scrappy ?? 1}` },
  { id: 'feeder', label: '喂食器', count: store.scrappyFeeder.foods?.length || 0 },
  { id: 'materials', label: '待收集材料', count: store.remainingWorkshopMaterials.length },
])

const scopeOptions = [
  { id: 'ALL', label: '全部' },
  { id: 'stations', label: '工作台' },
  { id: 'scrappy', label: '废品仔' },
]
</script>

<template>
  <section class="qr-section">
    <SubNavBar v-model="store.workshopSubTab" :items="subNavItems">
      <template v-if="store.workshopSubTab === 'materials'" #filters>
        <div class="ar-tabs seg">
          <button
            v-for="o in scopeOptions"
            :key="o.id"
            class="ar-tab"
            :class="{ active: store.materialsScope === o.id }"
            @click="store.materialsScope = o.id"
          >
            {{ o.label }}
          </button>
        </div>
      </template>
    </SubNavBar>

    <StationUpgradeMatrix v-if="store.workshopSubTab === 'stations'" />
    <ScrappyForagingGuide v-else-if="store.workshopSubTab === 'scrappy'" />
    <ScrappyFeederBoard v-else-if="store.workshopSubTab === 'feeder'" />
    <WorkshopMaterialsList v-else />
  </section>
</template>

<style scoped>
.qr-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.seg {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line);
}

.seg .ar-tab {
  height: 26px;
  padding: 0 11px;
  font-size: 12px;
}
</style>
