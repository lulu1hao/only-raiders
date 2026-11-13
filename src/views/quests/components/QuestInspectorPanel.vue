<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { traderMeta, useQuestsStore } from '../../../stores/useQuestsStore'
import { useMapsStore } from '../../../stores/useMapsStore'
import { assetUrl, parseQuestRequiredItems, parseQuestRewards } from '../../../utils/questItemIcons'

const store = useQuestsStore()
const mapsStore = useMapsStore()
const router = useRouter()

const q = computed(() => store.selectedQuest)
const done = computed(() => (q.value ? store.isQuestDone(q.value.id) : false))
const requiredItemList = computed(() => parseQuestRequiredItems(q.value))
const rewardItemList = computed(() => parseQuestRewards(q.value))

const linkedMaps = computed(() => {
  if (!q.value) return []
  const explicitIds = q.value.mapIds || []
  if (explicitIds.length) {
    return explicitIds.map((id) => mapsStore.getMapById(id)).filter(Boolean)
  }
  const targetIds = Object.keys(q.value.mapTargets || {})
  if (targetIds.length) {
    return targetIds.slice(0, 2).map((id) => mapsStore.getMapById(id)).filter(Boolean)
  }
  const fallback = q.value.recommendedMapId || 'dam-battlegrounds'
  return [mapsStore.getMapById(fallback)].filter(Boolean)
})

const flatPreviewTargets = computed(() => {
  if (!q.value?.mapTargets) return []
  const items = []
  for (const [mId, data] of Object.entries(q.value.mapTargets)) {
    const mapObj = mapsStore.getMapById(mId)
    for (const lm of data.landmarks || []) {
      items.push({
        key: lm.id,
        mapId: mId,
        mapName: mapObj?.name || mId,
        kind: 'landmark',
        step: lm.step,
        title: lm.title,
        sub: lm.areaName,
        detail: lm.detail,
        itemText: lm.itemText,
      })
    }
    for (const z of data.zones || []) {
      items.push({
        key: z.id,
        mapId: mId,
        mapName: mapObj?.name || mId,
        kind: 'zone',
        title: z.label,
        sub: z.subLabel,
        detail: '',
      })
    }
  }
  return items.slice(0, 6)
})

function openDetailedMap(mapId, landmarkId = '') {
  if (!q.value) return
  mapsStore.trackedQuestId = q.value.id
  const query = { quest: q.value.id }
  if (landmarkId) query.lm = landmarkId
  router.push({
    name: 'maps-detail',
    params: { mapId },
    query,
  })
}
</script>

<template>
  <aside class="q-inspector">
    <template v-if="q">
      <header class="insp-card ar-cream">
        <div class="ic-top">
          <span
            v-if="q.taskTypeLabel"
            class="ic-type-badge"
            :style="{ '--cat-c': q.taskTypeColor || '#26bf57' }"
          >
            {{ q.taskTypeLabel }}
          </span>
          <span class="ic-mode-tag">
            {{
              q.mapDisplayMode === 'none'
                ? '🌐 任意地点 (不划定区域)'
                : q.mapDisplayMode === 'zone' || q.mapDisplayMode === 'hybrid'
                  ? '🟢 绿色区域范围'
                  : '📍 详细任务地标'
            }}
          </span>
        </div>
        <h2 class="ic-title">{{ q.zhTitle }}</h2>
        <dl class="ic-kv">
          <div class="ic-trader-cell">
            <img
              v-if="traderMeta[q.trader]?.avatar"
              :src="assetUrl(traderMeta[q.trader].avatar)"
              :alt="traderMeta[q.trader]?.name"
              class="ic-trader-ava"
            />
            <div>
              <dt>商人</dt>
              <dd :title="q.zhTrader">{{ (q.zhTrader || '—').split(' (')[0] }}</dd>
            </div>
          </div>
          <div>
            <dt>战区</dt>
            <dd :title="q.zhLocation">{{ (q.zhLocation || '—').split(' (')[0] }}</dd>
          </div>
        </dl>
        <button
          class="ic-done"
          :class="{ active: done }"
          @click="store.toggleQuestDone(q.id)"
        >
          <svg v-if="done" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
          {{ done ? '已完成' : '标记完成' }}
        </button>
      </header>

      <div class="insp-body">
        <!-- Direct Map Entry Button(s) -->
        <div class="insp-map-actions">
          <button
            v-for="m in linkedMaps"
            :key="m.id"
            type="button"
            class="insp-enter-map-btn"
            :style="{ '--m-c': m.accent }"
            @click="openDetailedMap(m.id)"
          >
            <span class="iemb-text">
              {{
                q.mapDisplayMode === 'none'
                  ? `进入【${m.name}】(全图任意位置)`
                  : `进入【${m.name}】查看${
                      q.mapDisplayMode === 'zone' || q.mapDisplayMode === 'hybrid'
                        ? '绿色区域'
                        : '任务地标'
                    }`
              }}
            </span>
            <span class="iemb-arr">→</span>
          </button>
        </div>

        <!-- Concise Quest Briefing -->
        <section v-if="q.zhDescription" class="insp-block">
          <div class="ib-head">
            <h4>执行目标</h4>
          </div>
          <div class="desc-box">
            {{ q.zhDescription }}
          </div>
        </section>

        <!-- Map Targets Quick List -->
        <section v-if="flatPreviewTargets.length" class="insp-block">
          <div class="ib-head">
            <h4>地图标注点位</h4>
            <span class="ib-count ar-num">{{ flatPreviewTargets.length }}</span>
          </div>
          <div class="insp-target-list">
            <div
              v-for="t in flatPreviewTargets"
              :key="t.key"
              class="itl-card"
              :class="t.kind"
              role="button"
              tabindex="0"
              @click="openDetailedMap(t.mapId, t.kind === 'landmark' ? t.key : '')"
            >
              <div class="itl-head">
                <span class="itl-badge" :class="t.kind">
                  {{ t.kind === 'zone' ? '绿色范围' : `地标 #${t.step}` }}
                </span>
                <strong class="itl-title">{{ t.title }}</strong>
                <span class="itl-map">{{ t.mapName }}</span>
              </div>
              <div v-if="t.sub" class="itl-sub">📍 {{ t.sub }}</div>
              <div v-if="t.detail" class="itl-detail">{{ t.detail }}</div>
            </div>
          </div>
        </section>

        <section v-if="requiredItemList.length" class="insp-block">
          <div class="ib-head">
            <h4>所需道具</h4>
            <span class="ib-count ar-num">{{ requiredItemList.length }}</span>
          </div>
          <div class="q-item-grid">
            <div
              v-for="(it, idx) in requiredItemList"
              :key="idx"
              class="q-item-card req"
              :title="it.fullLabel"
            >
              <div class="qic-thumb">
                <img :src="it.icon" :alt="it.zhName" loading="lazy" />
                <span v-if="it.count" class="qic-qty ar-num">{{ it.count }}</span>
              </div>
              <span class="qic-name">{{ it.zhName }}</span>
            </div>
          </div>
        </section>

        <section v-if="rewardItemList.length" class="insp-block">
          <div class="ib-head">
            <h4>任务奖励</h4>
            <span class="ib-count ar-num">{{ rewardItemList.length }}</span>
          </div>
          <div class="q-item-grid">
            <div
              v-for="(it, idx) in rewardItemList"
              :key="idx"
              class="q-item-card rew"
              :title="it.fullLabel"
            >
              <div class="qic-thumb">
                <img :src="it.icon" :alt="it.zhName" loading="lazy" />
                <span v-if="it.count" class="qic-qty ar-num">{{ it.count }}</span>
              </div>
              <span class="qic-name">{{ it.zhName }}</span>
            </div>
          </div>
        </section>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.q-inspector {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: var(--bg-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
}

.insp-card {
  flex-shrink: 0;
  position: relative;
  padding: 15px 18px 16px;
  border-top: 4px solid var(--amber);
}

.ic-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.ic-type-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 3px;
  background: var(--ink);
  color: var(--cat-c, #26bf57);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 800;
}

.ic-mode-tag {
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--ink-2);
}

.ic-title {
  margin: 7px 0 12px;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  line-height: 1.15;
  color: var(--ink);
}

.ic-kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 0 0 12px;
  border-top: 1px solid rgba(9, 12, 25, 0.14);
}

.ic-kv > div {
  padding: 7px 0 0;
}

.ic-trader-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ic-trader-ava {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  object-fit: cover;
  background: var(--ink);
  border: 1px solid rgba(9, 12, 25, 0.25);
  flex-shrink: 0;
}

.ic-kv > div + div {
  padding-left: 12px;
  border-left: 1px solid rgba(9, 12, 25, 0.14);
}

.ic-kv dt {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-3);
}

.ic-kv dd {
  margin: 2px 0 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ic-done {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--ink);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.ic-done.active {
  background: var(--amber);
  color: var(--ink);
}

.ic-done svg {
  width: 13px;
  height: 13px;
}

.insp-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.insp-map-actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.insp-enter-map-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding: 10px 13px;
  background: var(--bg-1);
  border: 1px solid var(--m-c, #26bf57);
  border-left: 3px solid var(--m-c, #26bf57);
  border-radius: var(--radius-sm);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.insp-enter-map-btn:hover {
  background: var(--bg-3);
  transform: translateX(2px);
}

.iemb-arr {
  color: var(--m-c, #26bf57);
  font-size: 14px;
  font-weight: 800;
}

.ib-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--line-strong);
}

.ib-head h4 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  color: var(--tx-1);
}

.ib-count {
  font-size: 13px;
  color: var(--tx-3);
}

.desc-box {
  font-size: 13px;
  line-height: 1.55;
  color: var(--tx-1);
}

/* Map Target Preview Cards */
.insp-target-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.itl-card {
  padding: 8px 10px;
  border-radius: 4px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  border-left: 3px solid #26bf57;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s;
}

.itl-card.landmark {
  border-left-color: var(--amber);
}

.itl-card:hover {
  background: var(--bg-3);
  border-color: var(--amber);
}

.itl-head {
  display: flex;
  align-items: center;
  gap: 6px;
}

.itl-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(38, 191, 87, 0.18);
  color: #5dff8e;
  font-family: var(--font-display);
  font-size: 10.5px;
  font-weight: 700;
}

.itl-badge.landmark {
  background: rgba(255, 184, 0, 0.18);
  color: var(--amber);
}

.itl-title {
  flex: 1;
  font-size: 13px;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.itl-map {
  font-size: 11px;
  color: var(--tx-3);
}

.itl-sub {
  margin-top: 4px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--tx-2);
}

.itl-detail {
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--tx-3);
}

.q-item-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.q-item-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 7px 6px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
}

.q-item-card.req {
  border-color: rgba(255, 180, 0, 0.32);
}

.qic-thumb {
  position: relative;
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(
    circle at 50% 50%,
    rgba(255, 244, 224, 0.08) 0%,
    rgba(9, 12, 25, 0.55) 100%
  );
  border-radius: 3px;
}

.qic-thumb img {
  max-width: 44px;
  max-height: 44px;
  object-fit: contain;
}

.qic-qty {
  position: absolute;
  right: 4px;
  bottom: 2px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(9, 12, 25, 0.88);
  color: var(--amber);
  font-size: 11px;
  font-weight: 700;
}

.qic-name {
  font-size: 11.5px;
  color: var(--tx-1);
  text-align: center;
  line-height: 1.25;
}
</style>
