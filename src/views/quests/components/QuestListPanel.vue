<script setup>
import { useRouter } from 'vue-router'
import { traderMeta, useQuestsStore } from '../../../stores/useQuestsStore'
import { useMapsStore } from '../../../stores/useMapsStore'
import { assetUrl } from '../../../utils/questItemIcons'
import EmptyState from '../../../components/common/EmptyState.vue'

const store = useQuestsStore()
const mapsStore = useMapsStore()
const router = useRouter()

function jumpToQuestMap(q) {
  store.selectedQuestId = q.id
  mapsStore.trackedQuestId = q.id
  const targetMapId =
    q.primaryMapId || q.mapIds?.[0] || q.recommendedMapId || 'dam-battlegrounds'
  router.push({
    name: 'maps-detail',
    params: { mapId: targetMapId },
    query: { quest: q.id },
  })
}
</script>

<template>
  <div class="q-list-panel ar-panel">
    <div class="list-head">
      <div class="lh-top">
        <span class="ar-label">任务列表</span>
        <span class="lh-count ar-num">{{ store.filteredQuestList.length }}</span>
      </div>

      <!-- Task Category Filter Pills -->
      <div class="q-cat-bar" role="tablist" aria-label="任务分类筛选">
        <button
          type="button"
          class="q-cat-pill"
          :class="{ active: store.activeTaskType === 'ALL' }"
          @click="store.activeTaskType = 'ALL'"
        >
          全部
        </button>
        <button
          v-for="cat in store.taskCategories"
          :key="cat.id"
          type="button"
          class="q-cat-pill"
          :class="{ active: store.activeTaskType === cat.id }"
          :style="{ '--cat-c': cat.color }"
          @click="store.activeTaskType = store.activeTaskType === cat.id ? 'ALL' : cat.id"
        >
          <i class="q-cat-dot"></i>
          <span>{{ cat.label }}</span>
        </button>
      </div>
    </div>

    <div class="q-list-scroll">
      <article
        v-for="q in store.filteredQuestList"
        :key="q.id"
        class="q-row ar-row"
        :class="{
          active: store.selectedQuest && store.selectedQuest.id === q.id,
          done: store.isQuestDone(q.id),
        }"
        :title="q.title"
        @click="store.selectedQuestId = q.id"
      >
        <button
          class="q-check"
          :class="{ checked: store.isQuestDone(q.id) }"
          :aria-pressed="store.isQuestDone(q.id)"
          title="完成"
          @click.stop="store.toggleQuestDone(q.id)"
        >
          <svg v-if="store.isQuestDone(q.id)" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>

        <span class="q-order ar-num">{{ String(q.order).padStart(3, '0') }}</span>

        <div class="q-row-main">
          <strong class="q-title">{{ q.zhTitle }}</strong>
          <div class="q-row-meta">
            <span class="q-trader">
              <img
                v-if="traderMeta[q.trader]?.avatar"
                :src="assetUrl(traderMeta[q.trader].avatar)"
                :alt="traderMeta[q.trader]?.name"
                class="q-trader-ava"
                loading="lazy"
              />
              <i v-else :style="{ background: traderMeta[q.trader]?.color || 'var(--tx-3)' }"></i>
              {{ traderMeta[q.trader]?.name || q.trader }}
            </span>
            <span class="q-loc">{{ q.zhLocation.split(' (')[0] }}</span>
          </div>
        </div>

        <div class="q-flags">
          <span
            v-if="q.taskTypeLabel"
            class="q-type-tag"
            :style="{ '--cat-c': q.taskTypeColor || '#26bf57' }"
          >
            {{ q.taskTypeLabel }}
          </span>
          <button
            type="button"
            class="q-map-btn"
            title="进入战术地图查看高亮区域/地标"
            @click.stop="jumpToQuestMap(q)"
          >
            进入地图 →
          </button>
        </div>
      </article>

      <EmptyState v-if="!store.filteredQuestList.length" message="无匹配任务" />
    </div>
  </div>
</template>

<style scoped>
.q-list-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.list-head {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 16px 10px;
  border-bottom: 1px solid var(--line);
}

.lh-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lh-count {
  font-size: 14px;
  color: var(--tx-2);
}

.q-cat-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.q-cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 9px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.14s ease;
}

.q-cat-pill:hover {
  border-color: var(--cat-c, var(--amber));
  color: var(--tx-1);
}

.q-cat-pill.active {
  background: color-mix(in srgb, var(--cat-c, var(--amber)) 20%, var(--bg-2));
  border-color: var(--cat-c, var(--amber));
  color: var(--cream);
}

.q-cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--cat-c, var(--amber));
}

.q-list-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.q-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  border-bottom: 1px solid var(--line-subtle);
  cursor: pointer;
}

.q-row.done .q-title,
.q-row.done .q-row-meta {
  opacity: 0.45;
}

.q-row.done .q-title {
  text-decoration: line-through;
  text-decoration-color: var(--tx-3);
}

.q-check {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1.5px solid var(--line-strong);
  border-radius: 3px;
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.q-check:hover {
  border-color: var(--cream);
}

.q-check.checked {
  border-color: var(--amber);
  background: var(--amber);
}

.q-check svg {
  width: 12px;
  height: 12px;
}

.q-order {
  width: 26px;
  flex-shrink: 0;
  font-size: 12.5px;
  color: var(--tx-3);
}

.q-row-main {
  flex: 1;
  min-width: 0;
}

.q-title {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--tx-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.q-row-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  font-size: 12px;
  color: var(--tx-3);
}

.q-trader {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--tx-2);
}

.q-trader i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.q-trader-ava {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--line-strong);
}

.q-flags {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.q-type-tag {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid color-mix(in srgb, var(--cat-c) 55%, transparent);
  background: color-mix(in srgb, var(--cat-c) 14%, transparent);
  color: var(--cat-c);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
}

.q-map-btn {
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  background: var(--bg-2);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}

.q-map-btn:hover {
  border-color: var(--amber);
  background: var(--amber);
  color: var(--ink);
}
</style>
