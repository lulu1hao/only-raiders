<script setup>
import { useRouter } from 'vue-router'
import { useQuestsStore } from '../../../stores/useQuestsStore'
import { useMapsStore } from '../../../stores/useMapsStore'

const store = useQuestsStore()
const mapsStore = useMapsStore()
const router = useRouter()

function openTrialMap(tr, mapId) {
  const targetMapId = mapId || tr.recommendedMapIds?.[0] || 'dam-battlegrounds'
  if (tr.recommendedEventId) {
    mapsStore.setManualEvent(targetMapId, tr.recommendedEventId)
  }
  router.push({
    name: 'maps-detail',
    params: { mapId: targetMapId },
    query: tr.recommendedEventId ? { event: tr.recommendedEventId } : {},
  })
}
</script>

<template>
  <div class="trials-grid">
    <article v-for="tr in store.dailyTrials" :key="tr.id" class="trial-card ar-panel">
      <div class="tr-head">
        <span class="ar-label">{{ tr.type }}</span>
        <span class="ar-chip ar-chip--accent">{{ tr.doubleModifier }}</span>
      </div>
      <h3>{{ tr.title }}</h3>
      <p class="tr-target">{{ tr.target }}</p>
      <div class="tr-map">
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M6 1.2a3.6 3.6 0 0 0-3.6 3.6C2.4 7.6 6 10.8 6 10.8s3.6-3.2 3.6-6A3.6 3.6 0 0 0 6 1.2zm0 4.9a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"
            fill="currentColor"
          />
        </svg>
        <strong>{{ tr.recommendedMap }}</strong>
        <button
          type="button"
          class="tr-map-go"
          @click="openTrialMap(tr)"
        >
          进入对应详图 →
        </button>
      </div>
      <div class="tr-tiers">
        <div v-for="(t, idx) in tr.tiers" :key="idx" class="tr-tier-row">
          <span class="tr-rank">{{ t.rank }}</span>
          <strong class="tr-rew">{{ t.reward }}</strong>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.trials-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  padding-right: 4px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.trial-card {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: inset 0 3px 0 var(--c-quests);
}

.tr-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.trial-card h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--tx-1);
}

.tr-target {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--tx-2);
}

.tr-map {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--tx-3);
}

.tr-map svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.tr-map strong {
  font-weight: 600;
  color: var(--tx-1);
}

.tr-map-go {
  margin-left: auto;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--line-strong);
  border-radius: 3px;
  background: var(--bg-2);
  color: var(--amber);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.tr-map-go:hover {
  background: var(--amber);
  border-color: var(--amber);
  color: var(--ink);
}

.tr-tiers {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  border-top: 2px solid var(--line-strong);
}

.tr-tier-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  font-size: 12.5px;
  border-bottom: 1px solid var(--line-subtle);
}

.tr-tier-row:last-child {
  border-bottom: none;
}

.tr-rank {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--tx-3);
}

.tr-rew {
  font-weight: 600;
  color: var(--tx-1);
  text-align: right;
}

@media (max-width: 1080px) {
  .trials-grid {
    grid-template-columns: 1fr;
  }
}
</style>
