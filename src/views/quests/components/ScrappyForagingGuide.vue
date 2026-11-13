<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkshopStore } from '../../../stores/useWorkshopStore'
import { assetUrl } from '../../../utils/questItemIcons'
import ResItemTile from './ResItemTile.vue'
import ResMapLinks from './ResMapLinks.vue'

/**
 * 废品仔等级：左侧 Lv.1~5 → 右侧该级所需道具（含地图点位）与单局产出
 */
const store = useWorkshopStore()
const router = useRouter()

const cur = computed(() => store.stationLevels.scrappy ?? 1)
const lv = computed(() => store.selectedScrappy)

function jumpToPrimaryMap(mat) {
  const lk = mat?.mapLinks?.[0]
  if (!lk?.mapId) return
  const query = {}
  if (lk.poiName) query.poi = lk.poiName
  if (lk.plantId) query.plant = lk.plantId
  if (lk.radius) query.radius = String(lk.radius)
  router.push({
    name: 'maps-detail',
    params: { mapId: lk.mapId },
    query,
  })
}

function stateOf(level) {
  if (level <= cur.value) return { text: level === cur.value ? '当前' : '已达成', cls: 'ok' }
  if (level === cur.value + 1) return { text: '下一级', cls: 'warn' }
  return { text: '未达成', cls: '' }
}

const durations = [
  { key: 'm1', label: '存活 > 1 分钟' },
  { key: 'm6', label: '存活 > 6 分钟' },
  { key: 'm15', label: '存活 > 15 分钟' },
]
</script>

<template>
  <div class="rs-split">
    <aside class="rs-panel">
      <div class="rs-panel-head">
        <span class="ar-label">废品仔等级</span>
        <span class="rs-count">当前 Lv.{{ cur }}</span>
      </div>
      <div class="rs-rail-list">
        <button
          v-for="l in store.scrappyLevels"
          :key="l.level"
          class="rs-rail-item ar-row"
          :class="{ active: lv?.level === l.level }"
          @click="store.selectedScrappyLevel = l.level"
        >
          <span class="rs-rail-top">
            <img :src="assetUrl(l.icon)" :alt="l.title" class="rs-rail-icon" loading="lazy" />
            <span class="sc-rail-text">
              <strong>{{ l.title }}</strong>
              <span class="rs-rail-sub">
                {{ l.enTitle }} · {{ l.materials?.length ? `${l.materials.length} 种道具` : '默认' }}
              </span>
            </span>
            <span class="rs-tag" :class="stateOf(l.level).cls">{{ stateOf(l.level).text }}</span>
          </span>
        </button>
      </div>
    </aside>

    <div v-if="lv" class="sc-main">
      <header class="rs-panel sc-head">
        <img :src="assetUrl(lv.icon)" :alt="lv.title" />
        <div class="sc-head-text">
          <span class="ar-label">LV.{{ lv.level }} · {{ lv.enTitle }}</span>
          <h2>{{ lv.title.replace(/^Lv\.\d+\s*/, '') }}</h2>
          <p class="rs-text">{{ lv.summary }}</p>
        </div>
        <button
          class="ar-btn ar-btn--sm"
          :class="{ 'ar-btn--ghost': cur !== lv.level }"
          @click="store.setStationLevel('scrappy', lv.level, 5)"
        >
          {{ cur === lv.level ? '✓ 当前等级' : '设为当前等级' }}
        </button>
      </header>

      <section class="rs-panel">
        <div class="rs-panel-head">
          <span class="ar-label">晋升所需道具</span>
          <span class="rs-count">{{ lv.materials?.length || 0 }}</span>
        </div>
        <div v-if="!lv.materials?.length" class="rs-insp-body">
          <div class="rs-note">初始等级，完成首局行动返回后自动入驻，无需道具。</div>
        </div>
        <div v-else class="sc-mats">
          <div v-for="(m, i) in lv.materials" :key="i" class="sc-mat">
            <ResItemTile
              :item="m"
              :pin="!!m.mapLinks?.length"
              :clickable="!!m.mapLinks?.length"
              class="sc-mat-tile"
              @select="jumpToPrimaryMap(m)"
            />
            <div class="sc-mat-info">
              <div class="sc-mat-title">
                <strong>{{ m.zhName }}</strong>
                <span>{{ m.enName }}</span>
                <span v-if="m.category" class="rs-tag">{{ m.category }}</span>
              </div>
              <p class="rs-text">{{ m.source }}</p>
              <ResMapLinks :links="m.mapLinks" compact />
            </div>
          </div>
        </div>
      </section>

      <section v-if="lv.yields" class="rs-panel">
        <div class="rs-panel-head">
          <span class="ar-label">单局搜集产出</span>
          <span class="rs-count">基础资源 / 混合种子</span>
        </div>
        <table class="rs-table">
          <thead>
            <tr>
              <th>存活时长</th>
              <th class="num">撤离成功 · 资源</th>
              <th class="num">撤离成功 · 种子</th>
              <th class="num">撤离失败 · 资源</th>
              <th class="num">撤离失败 · 种子</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in durations" :key="d.key">
              <td>{{ d.label }}</td>
              <td class="num">{{ lv.yields.extracted?.[d.key]?.res ?? '—' }}</td>
              <td class="num">{{ lv.yields.extracted?.[d.key]?.seeds ?? '—' }}</td>
              <td class="num">{{ lv.yields.failed?.[d.key]?.res ?? '—' }}</td>
              <td class="num">{{ lv.yields.failed?.[d.key]?.seeds ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>

<style scoped>
.sc-rail-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sc-rail-text strong {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sc-main {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.sc-head,
.sc-main > .rs-panel {
  flex-shrink: 0;
}

.sc-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  border-top: 3px solid var(--amber);
}

.sc-head > img {
  width: 72px;
  height: 72px;
  flex-shrink: 0;
  object-fit: contain;
}

.sc-head-text {
  flex: 1;
  min-width: 0;
}

.sc-head-text h2 {
  margin: 2px 0 4px;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--tx-1);
}

.sc-mats {
  display: flex;
  flex-direction: column;
}

.sc-mat {
  display: flex;
  gap: 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-subtle);
}

.sc-mat:last-child {
  border-bottom: none;
}

.sc-mat-tile {
  width: 88px;
  flex-shrink: 0;
}

.sc-mat-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sc-mat-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.sc-mat-title strong {
  font-size: 15px;
  color: var(--tx-1);
}

.sc-mat-title > span:not(.rs-tag) {
  font-size: 12px;
  color: var(--tx-3);
}
</style>
