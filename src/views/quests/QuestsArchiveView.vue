<script setup>
import { computed } from 'vue'
import { useQuestsStore } from '../../stores/useQuestsStore'
import SubNavBar from '../../components/common/SubNavBar.vue'
import TraderFilterRail from './components/TraderFilterRail.vue'
import QuestListPanel from './components/QuestListPanel.vue'
import QuestInspectorPanel from './components/QuestInspectorPanel.vue'
import DailyTrialsGrid from './components/DailyTrialsGrid.vue'

const store = useQuestsStore()

const subNavItems = computed(() => [
  { id: 'trader', label: '商人', count: store.traderQuests.length },
  {
    id: 'event',
    label: '活动',
    count: store.eventQuests.length + store.dailyTrials.length,
  },
])

const statusOptions = [
  { id: 'ALL', label: '全部' },
  { id: 'TODO', label: '待办' },
  { id: 'DONE', label: '完成' },
]

const showWorkbench = computed(
  () =>
    store.questSubTab === 'trader' ||
    (store.questSubTab === 'event' && store.eventViewMode === 'campaigns'),
)
</script>

<template>
  <section class="qr-section">
    <SubNavBar v-model="store.questSubTab" :items="subNavItems">
      <template #filters>
        <div v-if="store.questSubTab === 'event'" class="ar-tabs seg">
          <button
            class="ar-tab"
            :class="{ active: store.eventViewMode === 'campaigns' }"
            @click="store.eventViewMode = 'campaigns'"
          >
            战役 <em class="ar-count">{{ store.eventQuests.length }}</em>
          </button>
          <button
            class="ar-tab"
            :class="{ active: store.eventViewMode === 'trials' }"
            @click="store.eventViewMode = 'trials'"
          >
            试炼 <em class="ar-count">{{ store.dailyTrials.length }}</em>
          </button>
        </div>

        <div v-if="showWorkbench" class="ar-tabs seg">
          <button
            v-for="opt in statusOptions"
            :key="opt.id"
            class="ar-tab"
            :class="{ active: store.questStatusFilter === opt.id }"
            @click="store.questStatusFilter = opt.id"
          >
            {{ opt.label }}
          </button>
        </div>
      </template>
    </SubNavBar>

    <div v-if="showWorkbench" class="quest-workbench">
      <TraderFilterRail />
      <QuestListPanel />
      <QuestInspectorPanel />
    </div>

    <DailyTrialsGrid
      v-else-if="store.questSubTab === 'event' && store.eventViewMode === 'trials'"
    />
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

.seg .ar-count {
  font-style: normal;
}

.quest-workbench {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) 400px;
  gap: 16px;
  align-items: stretch;
  overflow: hidden;
}

@media (max-width: 1360px) {
  .quest-workbench {
    grid-template-columns: 240px minmax(0, 1fr) 340px;
  }
}

@media (max-width: 1080px) {
  .quest-workbench {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
}
</style>
