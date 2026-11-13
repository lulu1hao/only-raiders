<script setup>
import { computed, defineAsyncComponent, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQuestsStore } from '../../stores/useQuestsStore'
import { useWorkshopStore } from '../../stores/useWorkshopStore'
import { useBlueprintsStore } from '../../stores/useBlueprintsStore'
import { useOutpostStore } from '../../stores/useOutpostStore'
import SearchInput from '../../components/common/SearchInput.vue'
import './resource-shared.css'

const DataSyncModal = defineAsyncComponent(() => import('./components/DataSyncModal.vue'))

const showSyncModal = ref(false)

const route = useRoute()
const router = useRouter()

const questsStore = useQuestsStore()
const workshopStore = useWorkshopStore()
const blueprintsStore = useBlueprintsStore()
const outpostStore = useOutpostStore()

const activeSubTab = computed(() => route.meta?.subTab || 'quests')

const searchPlaceholder = computed(
  () =>
    ({
      quests: '搜索任务名称、商人、地点',
      workshop: '搜索工作台、配方、材料、食物',
      outpost: '搜索家具、材料、储物类型',
      blueprints: '搜索蓝图名称、材料',
    })[activeSubTab.value] || '搜索',
)

const mainTabs = [
  { id: 'quests', title: '任务', path: '/quests/archive' },
  { id: 'workshop', title: '工坊', path: '/quests/workshop' },
  { id: 'outpost', title: '哨站', path: '/quests/outpost' },
  { id: 'blueprints', title: '蓝图', path: '/quests/blueprints' },
]

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

const stats = computed(() => [
  {
    id: 'quests',
    label: '任务',
    value: questsStore.completedQuestIds.length,
    total: questsStore.totalQuests,
  },
  {
    id: 'workshop',
    label: '工坊',
    value: workshopStore.currentWorkshopLevels,
    total: workshopStore.totalWorkshopLevels,
  },
  {
    id: 'outpost',
    label: '哨站工程',
    value: outpostStore.completedStageIds.length,
    total: outpostStore.totalStages,
  },
  {
    id: 'blueprints',
    label: '蓝图',
    value: blueprintsStore.validOwnedCount,
    total: blueprintsStore.allBlueprintsCount,
  },
])
</script>

<template>
  <main class="page-viewport qr-shell">
    <header class="qr-header">
      <nav class="qr-main-tabs" aria-label="任务资源分区">
        <button
          v-for="tab in mainTabs"
          :key="tab.id"
          class="qr-tab"
          :class="{ active: activeSubTab === tab.id }"
          @click="router.push(tab.path)"
        >
          {{ tab.title }}
        </button>
      </nav>

      <div class="qr-controls">
        <div class="qr-telemetry">
          <div v-for="s in stats" :key="s.id" class="qr-stat">
            <span class="qr-stat-label">{{ s.label }}</span>
            <strong class="ar-num">
              {{ s.value }}<small>/{{ s.total }}</small>
            </strong>
            <i class="qr-stat-bar"><b :style="{ width: pct(s.value, s.total) + '%' }"></b></i>
          </div>
        </div>

        <SearchInput v-model="questsStore.globalSearch" :placeholder="searchPlaceholder" />

        <button type="button" class="qr-sync-btn" @click="showSyncModal = true">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13.5 8a5.5 5.5 0 0 1-9.39 3.89M2.5 8a5.5 5.5 0 0 1 9.39-3.89M10 1.5h2.5V4M6 14.5H3.5V12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>数据同步</span>
        </button>
      </div>
    </header>

    <RouterView />
    <DataSyncModal v-if="showSyncModal" v-model="showSyncModal" />
  </main>
</template>

<style scoped>
.qr-shell {
  height: calc(100vh - var(--topbar-h, 56px));
  overflow: hidden;
  background: var(--bg-0);
  color: var(--tx-1);
  padding: 0 28px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.qr-header {
  flex-shrink: 0;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 24px;
  min-height: 60px;
  border-bottom: 1px solid var(--line);
}

/* Module tabs: large condensed labels with amber underline (in-game top menu) */
.qr-main-tabs {
  display: flex;
  gap: 4px;
}

.qr-tab {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0 18px;
  background: none;
  border: none;
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: color 0.15s var(--ease);
}

.qr-tab:first-child {
  padding-left: 2px;
}

.qr-tab:hover {
  color: var(--tx-1);
}

.qr-tab.active {
  color: var(--cream);
}

.qr-tab::after {
  content: '';
  position: absolute;
  left: 18px;
  right: 18px;
  bottom: -1px;
  height: 3px;
  background: var(--amber);
  transform: scaleX(0);
  transition: transform 0.2s var(--ease-out);
}

.qr-tab:first-child::after {
  left: 2px;
}

.qr-tab.active::after {
  transform: scaleX(1);
}

.qr-controls {
  display: flex;
  align-items: center;
  gap: 18px;
}

.qr-sync-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.qr-sync-btn svg {
  width: 14px;
  height: 14px;
  color: var(--amber);
}

.qr-sync-btn:hover {
  border-color: var(--amber);
  background: color-mix(in srgb, var(--amber) 14%, var(--bg-2));
}

.qr-telemetry {
  display: flex;
  gap: 20px;
}

.qr-stat {
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 8px;
  row-gap: 5px;
  min-width: 78px;
}

.qr-stat-label {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--tx-3);
}

.qr-stat strong {
  justify-self: end;
  font-size: 18px;
  color: var(--tx-1);
}

.qr-stat strong small {
  font-size: 12px;
  color: var(--tx-3);
  margin-left: 1px;
}

.qr-stat-bar {
  grid-column: 1 / -1;
  display: block;
  height: 2px;
  background: var(--line);
}

.qr-stat-bar b {
  display: block;
  height: 100%;
  background: var(--amber);
}

@media (max-width: 1200px) {
  .qr-header {
    flex-wrap: wrap;
    padding-bottom: 10px;
  }
}
</style>
