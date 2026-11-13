<script setup>
import { computed, ref, watch } from 'vue'
import { useWorkshopStore } from '../../../stores/useWorkshopStore'
import { assetUrl, resolveItemIconUrl } from '../../../utils/questItemIcons'
import EmptyState from '../../../components/common/EmptyState.vue'
import ResItemTile from './ResItemTile.vue'
import ResMapLinks from './ResMapLinks.vue'

/**
 * 工作台：左侧设施列表 → 中间按等级展开（升级材料 + 解锁配方）→ 右侧检视器（点击任意道具查看来源/配方）
 */
const store = useWorkshopStore()

const station = computed(() => store.selectedStation)
const curLv = computed(() => store.lvOf(station.value.id))

const expanded = ref(new Set())
const selection = ref(null) // { kind: 'material' | 'unlock', item, level }

const iconOf = (it) => (it?.icon ? assetUrl(it.icon) : resolveItemIconUrl(it?.enName || it?.zhName || it?.name))
const stationIconOf = (st) => {
  if (!st) return ''
  const lv = store.lvOf(st.id)
  const lvObj = st.levels?.find((l) => l.level === lv)
  return iconOf(lvObj?.icon ? lvObj : st)
}
const lvTitle = (t) => String(t ?? '').replace(/^Lv\.\s*\d+\s*/i, '').split(' (')[0]
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

function levelState(lv) {
  if (lv.level <= curLv.value) return { text: '已建成', cls: 'ok' }
  if (lv.level === curLv.value + 1) return { text: '下一级', cls: 'warn' }
  return { text: '未解锁', cls: '' }
}

function unlockGroupsOf(lv) {
  if (lv.unlockGroups?.length) return lv.unlockGroups
  if (lv.unlocks?.length) return [{ key: 'all', label: '解锁配方', items: lv.unlocks }]
  return []
}

function resetView() {
  const levels = station.value?.levels || []
  // 默认只展开「未建成」的等级；全部建成时展开最高级
  const open = levels.filter((l) => l.level > curLv.value).map((l) => l.level)
  expanded.value = new Set(open.length ? open : levels.slice(-1).map((l) => l.level))

  const target = levels.find((l) => l.level > curLv.value) || levels[levels.length - 1]
  if (!target) {
    selection.value = null
  } else if (target.materials?.length) {
    selection.value = { kind: 'material', item: target.materials[0], level: target.level }
  } else {
    const firstUnlock = unlockGroupsOf(target)[0]?.items?.[0]
    selection.value = firstUnlock ? { kind: 'unlock', item: firstUnlock, level: target.level } : null
  }
}

watch(() => store.selectedStationId, resetView, { immediate: true })

function toggleLevel(level) {
  const next = new Set(expanded.value)
  next.has(level) ? next.delete(level) : next.add(level)
  expanded.value = next
}

function select(kind, item, level) {
  selection.value = { kind, item, level }
}

const isSelected = (kind, item) =>
  selection.value?.kind === kind &&
  (selection.value.item === item ||
    (item.id && selection.value.item.id === item.id))

const selectedRecipeMapLinks = computed(() => {
  if (selection.value?.kind !== 'unlock') return []
  const out = []
  for (const ing of selection.value.item?.recipe || []) {
    for (const lk of ing.mapLinks || []) {
      out.push(lk)
    }
  }
  return out
})

function stationProgress(st) {
  return { cur: store.lvOf(st.id), max: st.maxLevel }
}
</script>

<template>
  <div class="rs-workbench">
    <!-- ============ Rail: stations ============ -->
    <aside class="rs-panel">
      <div class="rs-panel-head">
        <span class="ar-label">工作台</span>
        <span class="rs-count">{{ store.visibleStations.length }}</span>
      </div>
      <div class="rs-rail-list">
        <button
          v-for="st in store.visibleStations"
          :key="st.id"
          class="rs-rail-item ar-row"
          :class="{ active: station.id === st.id }"
          :title="st.enName"
          @click="store.selectedStationId = st.id"
        >
          <span class="rs-rail-top">
            <img :src="iconOf(st)" :alt="st.zhName" class="rs-rail-icon" loading="lazy" />
            <strong>{{ st.zhName }}</strong>
            <span class="rs-num">
              {{ stationProgress(st).cur }}<small>/{{ st.maxLevel }}</small>
            </span>
          </span>
          <span class="rs-bar">
            <b :style="{ width: pct(stationProgress(st).cur, st.maxLevel) + '%' }"></b>
          </span>
        </button>
        <EmptyState v-if="!store.visibleStations.length" message="无匹配工作台" />
      </div>
    </aside>

    <!-- ============ Center: level timeline ============ -->
    <div v-if="station" class="ws-center">
      <header class="rs-panel ws-head">
        <img :src="stationIconOf(station)" :alt="station.zhName" class="ws-head-icon" />
        <div class="ws-head-text">
          <h2>
            {{ station.zhName }}
            <small>{{ station.enName }}</small>
          </h2>
          <p>{{ station.role }}</p>
        </div>
        <div class="ws-head-lv">
          <span class="ar-label">当前等级</span>
          <div class="ar-tabs seg">
            <button
              v-for="n in station.maxLevel + 1"
              :key="n"
              class="ar-tab"
              :class="{ active: curLv === n - 1 }"
              @click="store.setStationLevel(station.id, n - 1, station.maxLevel)"
            >
              {{ n - 1 === 0 ? '未建' : `Lv.${n - 1}` }}
            </button>
          </div>
        </div>
      </header>

      <article
        v-for="lv in station.levels"
        :key="lv.level"
        class="rs-panel lv-card"
        :class="{ built: lv.level <= curLv, next: lv.level === curLv + 1 }"
      >
        <button class="lv-head" :aria-expanded="expanded.has(lv.level)" @click="toggleLevel(lv.level)">
          <span class="lv-no">LV.{{ lv.level }}</span>
          <strong class="lv-title">{{ lvTitle(lv.title) }}</strong>
          <span v-if="lv.requiresOutpost" class="rs-tag info">需哨站</span>
          <span class="lv-meta">
            {{ lv.materials?.length || 0 }} 种材料 · {{ lv.unlocks?.length || 0 }} 项配方
          </span>
          <span class="rs-tag" :class="levelState(lv).cls">{{ levelState(lv).text }}</span>
          <i class="lv-caret" :class="{ open: expanded.has(lv.level) }">▾</i>
        </button>

        <div v-if="expanded.has(lv.level)" class="lv-body">
          <section>
            <div class="rs-block-head">
              <h4>升级材料</h4>
              <span>{{ lv.materials?.length ? '点击查看获取来源' : '' }}</span>
            </div>
            <div v-if="lv.materials?.length" class="tile-grid">
              <ResItemTile
                v-for="(m, i) in lv.materials"
                :key="i"
                :item="m"
                clickable
                :pin="!!m.mapLinks?.length"
                :active="isSelected('material', m)"
                @select="select('material', m, lv.level)"
              />
            </div>
            <div v-else class="rs-note">无需材料，默认解锁</div>
          </section>

          <section v-for="g in unlockGroupsOf(lv)" :key="g.key">
            <div class="rs-block-head">
              <h4>解锁 · {{ g.label }}</h4>
              <span>{{ g.items.length }}</span>
            </div>
            <div class="tile-grid">
              <ResItemTile
                v-for="u in g.items"
                :key="u.id"
                :item="{ ...u, zhName: String(u.name).split(' (')[0] }"
                :badge="u.blueprintRequired || u.type === 'blueprint' ? '蓝图' : ''"
                clickable
                :active="isSelected('unlock', u)"
                @select="select('unlock', u, lv.level)"
              />
            </div>
          </section>
        </div>
      </article>
    </div>

    <!-- ============ Inspector ============ -->
    <aside class="rs-panel rs-sticky">
      <template v-if="selection">
        <header class="rs-insp-head" :class="selection.item.rarity ? `rc-${selection.item.rarity}` : ''">
          <div class="rs-insp-hero">
            <img :src="iconOf(selection.item)" :alt="selection.item.zhName || selection.item.name" />
            <div>
              <div class="rs-insp-eyebrow">
                <span>{{ selection.kind === 'material' ? '升级材料' : selection.item.categoryLabel || '制造配方' }}</span>
              </div>
              <h2 class="rs-insp-title">
                {{ selection.item.zhName || String(selection.item.name).split(' (')[0] }}
              </h2>
              <span class="rs-insp-en">{{ selection.item.enName }}</span>
            </div>
          </div>
          <dl class="rs-insp-kv">
            <template v-if="selection.kind === 'material'">
              <div>
                <dt>需求数量</dt>
                <dd>×{{ selection.item.count }}</dd>
              </div>
              <div>
                <dt>用于</dt>
                <dd>{{ station.zhName }} Lv.{{ selection.level }}</dd>
              </div>
            </template>
            <template v-else>
              <div>
                <dt>解锁于</dt>
                <dd>{{ station.zhName }} Lv.{{ selection.level }}</dd>
              </div>
              <div>
                <dt>蓝图</dt>
                <dd>{{ selection.item.blueprintRequired ? '需先学习蓝图' : '无需蓝图' }}</dd>
              </div>
            </template>
          </dl>
        </header>

        <div class="rs-insp-body">
          <template v-if="selection.kind === 'material'">
            <section v-if="selection.item.source">
              <div class="rs-block-head"><h4>获取来源</h4></div>
              <p class="rs-text">{{ selection.item.source }}</p>
            </section>
            <section>
              <div class="rs-block-head">
                <h4>地图点位</h4>
                <span>{{ selection.item.mapLinks?.length || 0 }}</span>
              </div>
              <ResMapLinks v-if="selection.item.mapLinks?.length" :links="selection.item.mapLinks" />
              <div v-else class="rs-note">该材料主要通过合成或全图通用搜刮获得，无固定点位</div>
            </section>
          </template>

          <template v-else>
            <section>
              <div class="rs-block-head">
                <h4>制造所需材料</h4>
                <span>{{ selection.item.recipe?.length || 0 }} 种</span>
              </div>
              <div v-if="selection.item.recipe?.length" class="tile-grid">
                <ResItemTile
                  v-for="(ing, i) in selection.item.recipe"
                  :key="i"
                  :item="ing"
                  :pin="!!ing.mapLinks?.length"
                />
              </div>
              <div v-else class="rs-note">无需额外材料</div>
            </section>
            <section v-if="selectedRecipeMapLinks.length">
              <div class="rs-block-head">
                <h4>植物原料采集范围</h4>
                <span>{{ selectedRecipeMapLinks.length }}</span>
              </div>
              <ResMapLinks :links="selectedRecipeMapLinks" />
            </section>
          </template>
        </div>
      </template>
      <div v-else class="rs-empty">点击左侧任意材料或配方查看详情</div>
    </aside>
  </div>
</template>

<style scoped>
.ws-center {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.ws-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-top: 3px solid var(--amber);
}

.ws-head-icon {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  object-fit: contain;
}

.ws-head-text {
  flex: 1;
  min-width: 0;
}

.ws-head-text h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--tx-1);
}

.ws-head-text h2 small {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--tx-3);
}

.ws-head-text p {
  margin: 3px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--tx-3);
}

.ws-head-lv {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 5px;
  flex-shrink: 0;
}

.seg {
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line);
}

.seg .ar-tab {
  height: 26px;
  padding: 0 10px;
  font-size: 12px;
}

.lv-card {
  flex-shrink: 0;
  border-left: 3px solid var(--line-strong);
}

.lv-card.built {
  border-left-color: var(--st-ok);
}

.lv-card.next {
  border-left-color: var(--amber);
}

.lv-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 11px 14px;
  background: transparent;
  border: none;
  color: var(--tx-1);
  font-family: var(--font-body);
  text-align: left;
  cursor: pointer;
}

.lv-head:hover {
  background: var(--bg-hover);
}

.lv-no {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 800;
  color: var(--amber);
}

.lv-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
}

.lv-meta {
  margin-left: auto;
  font-size: 12px;
  color: var(--tx-3);
}

.lv-caret {
  font-style: normal;
  color: var(--tx-3);
  transition: transform 0.15s;
  transform: rotate(-90deg);
}

.lv-caret.open {
  transform: none;
}

.lv-card.built:not(:hover) .lv-title {
  color: var(--tx-2);
}

.lv-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 16px 16px;
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}
</style>
