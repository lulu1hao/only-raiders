<script setup>
import { useWorkshopStore } from '../../../stores/useWorkshopStore'
import EmptyState from '../../../components/common/EmptyState.vue'
import ResItemTile from './ResItemTile.vue'
import ResMapLinks from './ResMapLinks.vue'

/**
 * 待收集材料：根据各工作台 / 废品仔的当前等级，汇总所有未建成等级仍需的升级材料
 */
const store = useWorkshopStore()
</script>

<template>
  <section class="rs-panel mat-panel">
    <div class="rs-panel-head">
      <span class="ar-label">待收集升级材料</span>
      <span class="rs-count">{{ store.visibleMaterials.length }} 种</span>
    </div>

    <div v-if="store.visibleMaterials.length" class="mat-scroll">
      <table class="rs-table mat-table">
        <thead>
          <tr>
            <th>材料</th>
            <th class="num">还需</th>
            <th>用于</th>
            <th>获取来源 / 地图点位</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in store.visibleMaterials" :key="m.enName">
            <td>
              <div class="mat-cell">
                <ResItemTile :item="m" badge="" class="mat-tile" />
                <div>
                  <strong>{{ m.zhName }}</strong>
                  <small>{{ m.enName }}</small>
                </div>
              </div>
            </td>
            <td class="num mat-qty">×{{ m.count }}</td>
            <td>
              <div class="used-by">
                <span v-for="(u, i) in m.usedBy" :key="i" class="ar-chip">
                  {{ u.label }} <b>×{{ u.count }}</b>
                </span>
              </div>
            </td>
            <td>
              <div class="src-cell">
                <p v-if="m.source">{{ m.source }}</p>
                <ResMapLinks :links="m.mapLinks" compact />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState
      v-else
      :message="store.remainingWorkshopMaterials.length ? '无匹配材料' : '全部设施已满级，无需再收集'"
    />
  </section>
</template>

<style scoped>
.mat-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.mat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.mat-table td {
  vertical-align: top;
}

.mat-cell {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 200px;
}

.mat-tile {
  width: 56px;
  flex-shrink: 0;
  padding: 3px;
}

.mat-tile :deep(.rt-name) {
  display: none;
}

.mat-tile :deep(.rt-thumb) {
  height: 44px;
}

.mat-cell strong {
  display: block;
  font-size: 14px;
  color: var(--tx-1);
}

.mat-cell small {
  font-size: 11.5px;
  color: var(--tx-3);
}

.mat-qty {
  font-size: 16px;
  color: var(--amber) !important;
  white-space: nowrap;
}

.used-by {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-width: 280px;
}

.used-by b {
  color: var(--amber);
  font-weight: 700;
}

.src-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.src-cell p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--tx-3);
}
</style>
