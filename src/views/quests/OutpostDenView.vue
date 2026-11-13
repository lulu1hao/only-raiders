<script setup>
import { computed } from 'vue'
import SubNavBar from '../../components/common/SubNavBar.vue'
import EmptyState from '../../components/common/EmptyState.vue'
import ResItemTile from './components/ResItemTile.vue'
import ResMapLinks from './components/ResMapLinks.vue'
import { useOutpostStore } from '../../stores/useOutpostStore'
import { assetUrl } from '../../utils/questItemIcons'

const store = useOutpostStore()

/* 推荐使用顺序：先做避风港解锁哨站 → 扩建房间 → 建造家具 */
const subNavItems = computed(() => [
  { id: 'projects', label: '工程', count: `${store.completedStageIds.length}/${store.totalStages}` },
  { id: 'rooms', label: '房间', count: store.outpostRooms.length },
  {
    id: 'furniture',
    label: '家具',
    count: `${store.builtFurnitureIds.length}/${store.furnitureList.length}`,
  },
])

const storageOptions = [
  { id: 'all', label: '全部' },
  { id: 'has_storage', label: '可储物' },
  { id: 'trinket', label: '藏品' },
  { id: 'weapon', label: '武器' },
  { id: 'pillow', label: '枕头' },
  { id: 'functional', label: '仓库/衣柜' },
]

const storageTagClass = {
  trinket: 'warn',
  weapon: 'danger',
  pillow: 'info',
  stash: 'ok',
  wardrobe: 'ok',
}

const short = (s) => String(s ?? '').split(' (')[0]
const stripEmoji = (s) => String(s ?? '').replace(/^[^\p{L}\p{N}]+/u, '')

function capacityText(f) {
  if (!f) return ''
  if (f.storageType === 'weapon') return `${f.storageSlots} 把武器`
  if (f.storageType === 'wardrobe') return '外观衣柜（不占格）'
  if (f.storageType === 'stash' && !f.storageSlots) return '与仓库互通'
  if (f.storageSlots > 0) return `${f.storageSlots} 格`
  return '无（装饰 / 照明）'
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

const currentDen = computed(
  () => store.raiderDenStages.find((d) => d.level === store.raiderDenLevel) || store.raiderDenStages[0],
)
</script>

<template>
  <section class="qr-section">
    <SubNavBar v-model="store.outpostSubTab" :items="subNavItems">
      <template v-if="store.outpostSubTab === 'furniture'" #filters>
        <div class="ar-tabs seg">
          <button
            v-for="o in storageOptions"
            :key="o.id"
            class="ar-tab"
            :class="{ active: store.selectedStorageFilter === o.id }"
            @click="store.selectedStorageFilter = o.id"
          >
            {{ o.label }}
          </button>
        </div>
      </template>
    </SubNavBar>

    <!-- ============================ 工程 ============================ -->
    <div v-if="store.outpostSubTab === 'projects'" class="rs-split">
      <aside class="rs-panel">
        <div class="rs-panel-head"><span class="ar-label">哨站工程</span></div>
        <div class="rs-rail-list">
          <button
            v-for="p in store.allProjects"
            :key="p.id"
            class="rs-rail-item ar-row"
            :class="{ active: store.selectedProject?.id === p.id }"
            @click="store.selectedProjectId = p.id"
          >
            <span class="rs-rail-top">
              <strong>{{ short(p.name).replace(/（.*）$/, '') }}</strong>
              <span class="rs-num">
                {{ store.projectDoneCount(p) }}<small>/{{ p.stages.length }}</small>
              </span>
            </span>
            <span class="rs-rail-sub">{{ p.isUnlockProject ? '前置 · 解锁哨站与研究站' : p.enName }}</span>
            <span class="rs-bar">
              <b :style="{ width: pct(store.projectDoneCount(p), p.stages.length) + '%' }"></b>
            </span>
          </button>
        </div>
      </aside>

      <div v-if="store.selectedProject" class="proj-main">
        <header class="rs-panel proj-head">
          <div class="proj-head-text">
            <span class="rs-tag" :class="store.selectedProject.isUnlockProject ? 'warn' : 'info'">
              {{ store.selectedProject.badge }}
            </span>
            <h2>{{ short(store.selectedProject.name) }}</h2>
            <p class="rs-text">{{ store.selectedProject.summary }}</p>
          </div>
          <div class="proj-head-progress">
            <span class="ar-label">阶段进度</span>
            <strong class="rs-num big">
              {{ store.projectDoneCount(store.selectedProject) }}<small>/{{ store.selectedProject.stages.length }}</small>
            </strong>
          </div>
        </header>

        <ol class="stage-list">
          <li
            v-for="st in store.selectedProject.stages"
            :key="st.stage"
            class="rs-panel stage-card"
            :class="{ done: store.isStageDone(store.stageKey(store.selectedProject.id, st.stage)) }"
          >
            <div class="stage-head">
              <button
                class="rs-check"
                :class="{ checked: store.isStageDone(store.stageKey(store.selectedProject.id, st.stage)) }"
                title="标记阶段完成"
                @click="store.toggleStageDone(store.stageKey(store.selectedProject.id, st.stage))"
              >
                <svg
                  v-if="store.isStageDone(store.stageKey(store.selectedProject.id, st.stage))"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                >
                  <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="2" />
                </svg>
              </button>
              <span class="stage-no">{{ String(st.stage).padStart(2, '0') }}</span>
              <h3>{{ String(st.name).replace(/^阶段\s*\d+[:：]\s*/, '') }}</h3>
              <span v-if="st.enName" class="stage-en">{{ st.enName }}</span>
            </div>

            <p v-if="st.objective" class="rs-text stage-obj">{{ st.objective }}</p>
            <ResMapLinks v-if="st.mapLinks?.length" :links="st.mapLinks" compact class="stage-links" />

            <div class="stage-grid">
              <div>
                <div class="rs-block-head">
                  <h4>提交物资</h4>
                  <span>{{ st.requirements?.length || 0 }} 项</span>
                </div>
                <div class="tile-grid">
                  <ResItemTile
                    v-for="(m, i) in st.requirements"
                    :key="i"
                    :item="m"
                    :pin="!!m.mapLinks?.length"
                  />
                </div>
                <div v-if="st.requirements?.some((m) => m.mapLinks?.length)" class="req-sources">
                  <template v-for="(m, i) in st.requirements" :key="i">
                    <div v-if="m.mapLinks?.length" class="req-src-row">
                      <span>{{ m.zhName }}</span>
                      <ResMapLinks :links="m.mapLinks" compact />
                    </div>
                  </template>
                </div>
              </div>
              <div>
                <div class="rs-block-head">
                  <h4>阶段奖励</h4>
                  <span>{{ st.rewards?.length || 0 }} 项</span>
                </div>
                <div class="tile-grid">
                  <ResItemTile v-for="(r, i) in st.rewards" :key="i" :item="r" />
                </div>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>

    <!-- ============================ 房间 ============================ -->
    <div v-else-if="store.outpostSubTab === 'rooms'" class="rs-split">
      <aside class="rs-panel">
        <div class="rs-panel-head">
          <span class="ar-label">房间模块</span>
          <span class="rs-count">{{ store.unlockedRoomIds.length }}/{{ store.outpostRooms.length }}</span>
        </div>
        <div class="rs-rail-list">
          <button
            v-for="room in store.outpostRooms"
            :key="room.id"
            class="rs-rail-item ar-row"
            :class="{ active: store.selectedRoom?.id === room.id }"
            @click="store.selectedRoomId = room.id"
          >
            <span class="rs-rail-top">
              <img :src="assetUrl(room.image)" :alt="room.name" class="room-thumb" loading="lazy" />
              <span class="room-rail-text">
                <strong>{{ room.name }}</strong>
                <span class="rs-rail-sub">{{ room.totalSlots }} 栏位 · {{ room.enName }}</span>
              </span>
              <span v-if="store.isRoomUnlocked(room.id)" class="rs-tag ok">已有</span>
            </span>
          </button>
        </div>
      </aside>

      <div v-if="store.selectedRoom" class="room-main">
        <article class="rs-panel room-hero">
          <img :src="assetUrl(store.selectedRoom.heroImage || store.selectedRoom.image)" :alt="store.selectedRoom.name" />
          <div class="room-hero-info">
            <span class="rs-tag warn">{{ store.selectedRoom.badge }}</span>
            <h2>
              {{ store.selectedRoom.name }}
              <small>{{ store.selectedRoom.enName }}</small>
            </h2>
            <p class="rs-text">{{ store.selectedRoom.themeDesc }}</p>

            <dl class="rs-facts">
              <div>
                <dt>总栏位</dt>
                <dd>{{ store.selectedRoom.totalSlots }}</dd>
              </div>
              <div>
                <dt>工作台</dt>
                <dd>{{ store.selectedRoom.slotSummary.workbench }}</dd>
              </div>
              <div>
                <dt>地面</dt>
                <dd>{{ store.selectedRoom.slotSummary.floor }}</dd>
              </div>
              <div>
                <dt>墙面</dt>
                <dd>{{ store.selectedRoom.slotSummary.wall }}</dd>
              </div>
              <div>
                <dt>吊顶</dt>
                <dd>{{ store.selectedRoom.slotSummary.ceiling }}</dd>
              </div>
            </dl>

            <button
              class="ar-btn ar-btn--sm"
              :class="{ 'ar-btn--ghost': !store.isRoomUnlocked(store.selectedRoom.id) }"
              :disabled="store.selectedRoom.id === 'room-base'"
              @click="store.toggleRoomUnlocked(store.selectedRoom.id)"
            >
              {{
                store.selectedRoom.id === 'room-base'
                  ? '默认房间'
                  : store.isRoomUnlocked(store.selectedRoom.id)
                    ? '✓ 已解锁'
                    : '标记为已解锁'
              }}
            </button>
          </div>
        </article>

        <div class="room-cols">
          <section class="rs-panel">
            <div class="rs-panel-head">
              <span class="ar-label">栏位规格</span>
              <span class="rs-count">{{ store.selectedRoom.slotBreakdown.length }} 类</span>
            </div>
            <table class="rs-table">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>尺寸</th>
                  <th class="num">数量</th>
                  <th>适合摆放</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(sb, i) in store.selectedRoom.slotBreakdown" :key="i">
                  <td class="slot-type">{{ short(sb.type) }}</td>
                  <td class="slot-size">{{ sb.size }}</td>
                  <td class="num">{{ sb.count }}</td>
                  <td>{{ sb.usage }}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section class="rs-panel room-side">
            <div class="rs-panel-head"><span class="ar-label">解锁与特性</span></div>
            <div class="rs-insp-body">
              <div>
                <div class="rs-block-head"><h4>解锁条件</h4></div>
                <p class="rs-text">{{ store.selectedRoom.unlockCondition }}</p>
              </div>
              <div v-if="store.selectedRoom.stationUnlocks?.length">
                <div class="rs-block-head"><h4>房间特性</h4></div>
                <ul class="plain-list">
                  <li v-for="(s, i) in store.selectedRoom.stationUnlocks" :key="i">{{ s }}</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- ============================ 家具 ============================ -->
    <div v-else-if="store.outpostSubTab === 'furniture'" class="rs-workbench">
      <aside class="rs-panel">
        <div class="rs-panel-head"><span class="ar-label">家具分类</span></div>
        <div class="rs-rail-list">
          <button
            v-for="cat in store.furnitureCategories"
            :key="cat.id"
            class="rs-rail-item ar-row"
            :class="{ active: store.selectedFurnitureCategory === cat.id }"
            @click="store.selectedFurnitureCategory = cat.id"
          >
            <span class="rs-rail-top">
              <strong>{{ cat.label }}</strong>
              <span class="rs-num">{{ store.categoryCounts[cat.id] || 0 }}</span>
            </span>
          </button>
        </div>
      </aside>

      <div class="rs-panel">
        <div class="rs-panel-head">
          <span class="ar-label">家具列表</span>
          <span class="rs-count">{{ store.filteredFurniture.length }}</span>
        </div>
        <div class="rs-scroll">
          <div
            v-for="f in store.filteredFurniture"
            :key="f.id"
            class="rs-row ar-row"
            :class="[`rc-${f.rarity}`, { active: store.selectedFurniture?.id === f.id }]"
            @click="store.selectedFurnitureId = f.id"
          >
            <button
              class="rs-check"
              :class="{ checked: store.isFurnitureBuilt(f.id) }"
              title="标记已建造"
              @click.stop="store.toggleFurnitureBuilt(f.id)"
            >
              <svg v-if="store.isFurnitureBuilt(f.id)" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>
            <img :src="assetUrl(f.icon)" :alt="f.name" class="rs-row-icon" loading="lazy" />
            <div class="rs-row-main">
              <strong class="rs-row-title">{{ f.name }}</strong>
              <div class="rs-row-meta">
                <span>{{ short(f.placement) }}</span>
                <span>{{ f.size }}</span>
              </div>
            </div>
            <span class="rs-tag" :class="storageTagClass[f.storageType]">
              {{ f.storageType === 'none' ? '装饰' : capacityText(f) }}
            </span>
          </div>
          <EmptyState v-if="!store.filteredFurniture.length" message="无匹配家具" />
        </div>
      </div>

      <aside v-if="store.selectedFurniture" class="rs-panel rs-sticky">
        <header class="rs-insp-head" :class="`rc-${store.selectedFurniture.rarity}`">
          <div class="rs-insp-hero">
            <img :src="assetUrl(store.selectedFurniture.icon)" :alt="store.selectedFurniture.name" />
            <div>
              <div class="rs-insp-eyebrow">
                <span>{{ store.selectedFurniture.categoryZh }}</span>
              </div>
              <h2 class="rs-insp-title">{{ store.selectedFurniture.name }}</h2>
              <span class="rs-insp-en">{{ store.selectedFurniture.enName }}</span>
            </div>
          </div>
          <dl class="rs-insp-kv">
            <div>
              <dt>摆放位置</dt>
              <dd>{{ short(store.selectedFurniture.placement) }} · {{ store.selectedFurniture.size }}</dd>
            </div>
            <div>
              <dt>储物容量</dt>
              <dd>{{ capacityText(store.selectedFurniture) }}</dd>
            </div>
          </dl>
          <button
            class="rs-insp-action"
            :class="{ active: store.isFurnitureBuilt(store.selectedFurniture.id) }"
            @click="store.toggleFurnitureBuilt(store.selectedFurniture.id)"
          >
            {{ store.isFurnitureBuilt(store.selectedFurniture.id) ? '✓ 已建造' : '标记已建造' }}
          </button>
        </header>

        <div class="rs-insp-body">
          <section>
            <div class="rs-block-head"><h4>用途</h4></div>
            <p class="rs-text">{{ store.selectedFurniture.functionalRole }}</p>
          </section>

          <section v-if="store.selectedFurniture.storageType !== 'none'">
            <div class="rs-block-head">
              <h4>可存放</h4>
              <span>{{ stripEmoji(store.selectedFurniture.storageBadge) }}</span>
            </div>
            <p class="rs-text">{{ store.selectedFurniture.storageTypeLabel }}</p>
          </section>

          <section>
            <div class="rs-block-head">
              <h4>建造材料</h4>
              <span>{{ store.selectedFurniture.craftMaterials?.length || 0 }} 种</span>
            </div>
            <div v-if="store.selectedFurniture.craftMaterials?.length" class="tile-grid">
              <ResItemTile v-for="(m, i) in store.selectedFurniture.craftMaterials" :key="i" :item="m" />
            </div>
            <div v-else class="rs-note">无需建造材料（默认配备或工程奖励直接获得）</div>
          </section>

          <section>
            <div class="rs-block-head">
              <h4>研究站研发</h4>
              <span>{{ store.selectedFurniture.researchMaterials?.length ? '需研发' : '无需研发' }}</span>
            </div>
            <div v-if="store.selectedFurniture.researchMaterials?.length" class="tile-grid">
              <ResItemTile
                v-for="(m, i) in store.selectedFurniture.researchMaterials"
                :key="i"
                :item="m"
              />
            </div>
            <p class="rs-text unlock-note">{{ store.selectedFurniture.unlockMethod }}</p>
          </section>
        </div>
      </aside>
    </div>
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

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}

/* ---------- 工程 ---------- */
.proj-main {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.proj-head {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding: 16px 18px;
  border-top: 3px solid var(--amber);
}

.proj-head-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.proj-head h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--tx-1);
}

.proj-head-progress {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.rs-num.big {
  font-size: 28px;
}

.rs-num.big small {
  font-size: 15px;
}

.stage-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 4px 0 0;
  list-style: none;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stage-card {
  flex-shrink: 0;
  padding: 13px 16px 15px;
  border-left: 3px solid var(--line-strong);
}

.stage-card.done {
  border-left-color: var(--amber);
}

.stage-card.done h3 {
  color: var(--tx-3);
  text-decoration: line-through;
}

.stage-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stage-no {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--tx-3);
}

.stage-head h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  color: var(--tx-1);
}

.stage-en {
  font-size: 12px;
  color: var(--tx-3);
}

.stage-obj {
  margin-top: 8px;
}

.stage-links {
  margin-top: 8px;
}

.stage-grid {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 18px;
  margin-top: 12px;
}

.req-sources {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.req-src-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--tx-3);
}

.req-src-row > span {
  flex-shrink: 0;
  min-width: 64px;
}

/* ---------- 房间 ---------- */
.room-thumb {
  width: 56px;
  height: 38px;
  flex-shrink: 0;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--line);
}

.room-rail-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.room-rail-text strong {
  font-size: 14px;
  font-weight: 600;
}

.room-main {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.room-hero,
.room-cols {
  flex-shrink: 0;
}

.room-hero {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
}

.room-hero > img {
  width: 100%;
  height: 100%;
  min-height: 240px;
  object-fit: cover;
  background: var(--bg-1);
}

.room-hero-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  padding: 18px 20px;
}

.room-hero-info h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 700;
  color: var(--tx-1);
}

.room-hero-info h2 small {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-3);
}

.room-hero-info .rs-facts {
  width: 100%;
}

.room-cols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;
}

.slot-type {
  color: var(--tx-1);
  font-weight: 600;
  white-space: nowrap;
}

.slot-size {
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: nowrap;
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--tx-2);
}

/* ---------- 巢穴 ---------- */
.den-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 16px;
  align-items: start;
}

.den-row {
  cursor: pointer;
}

.den-row:hover td {
  background: var(--bg-hover);
}

.den-lv {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--amber);
  white-space: nowrap;
}

.den-name {
  color: var(--tx-1);
  font-weight: 600;
  white-space: nowrap;
}

/* ---------- 家具 ---------- */
.unlock-note {
  margin-top: 8px;
  font-size: 12px;
  color: var(--tx-3);
}

@media (max-width: 1280px) {
  .room-hero,
  .room-cols,
  .den-wrap,
  .stage-grid {
    grid-template-columns: 1fr;
  }
}
</style>
