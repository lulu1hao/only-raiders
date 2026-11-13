<script setup>
import { useRouter } from 'vue-router'

/**
 * 地图点位跳转列表。点击后进入战术地图并通过 ?poi= 自动聚焦对应地标。
 */
defineProps({
  links: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
})

const router = useRouter()

function go(link) {
  if (!link?.mapId) return
  const query = {}
  if (link.poiName) query.poi = link.poiName
  if (link.plantId) query.plant = link.plantId
  if (link.arcId) query.arc = link.arcId
  if (link.radius) query.radius = String(link.radius)
  router.push({
    name: 'maps-detail',
    params: { mapId: link.mapId },
    query,
  })
}

function label(link) {
  const raw = link.label || `${link.mapName} · ${link.poiName}`
  return String(raw).replace(/^跳转地图[:：]\s*/, '')
}
</script>

<template>
  <div v-if="links?.length" class="res-maplinks" :class="{ compact }">
    <button
      v-for="(lk, i) in links"
      :key="i"
      type="button"
      class="rml-btn"
      :title="`进入 ${lk.mapName} · 定位 ${lk.poiName}`"
      @click.stop="go(lk)"
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z"
          fill="currentColor"
        />
      </svg>
      <span class="rml-text">
        <strong>{{ lk.mapName }}</strong>
        <small v-if="!compact">{{ label(lk) }}</small>
        <small v-else>{{ lk.poiName }}</small>
      </span>
      <span v-if="lk.plantId || lk.radius" class="rml-zone-tag">范围标注</span>
      <span v-else-if="lk.arcId" class="rml-zone-tag">精确点位</span>
      <i class="rml-arr">→</i>
    </button>
  </div>
</template>

<style scoped>
.res-maplinks {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.res-maplinks.compact {
  flex-direction: row;
  flex-wrap: wrap;
}

.rml-btn {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 7px 11px;
  background: var(--bg-1);
  border: 1px solid color-mix(in srgb, var(--c-maps) 55%, transparent);
  border-left: 3px solid var(--c-maps);
  border-radius: var(--radius-sm);
  color: var(--tx-1);
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}

.compact .rml-btn {
  width: auto;
  padding: 4px 9px;
}

.rml-btn:hover {
  background: var(--bg-3);
  transform: translateX(2px);
}

.rml-btn svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: var(--c-maps);
}

.rml-text {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.rml-text strong {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
}

.rml-text small {
  min-width: 0;
  font-size: 12px;
  color: var(--tx-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rml-arr {
  font-style: normal;
  font-weight: 800;
  color: var(--c-maps);
}

.rml-zone-tag {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  color: #4ade80;
  background: rgba(34, 197, 94, 0.14);
  border: 1px solid rgba(74, 222, 128, 0.35);
}
</style>
