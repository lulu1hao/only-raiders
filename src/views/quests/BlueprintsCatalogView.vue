<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, ref } from 'vue'
import { useBlueprintsStore, rarityLabelMap } from '../../stores/useBlueprintsStore'
import { assetUrl } from '../../utils/assetUrl'
import { ITEM_ICON_MAP } from '../../utils/questItemIcons'
import SubNavBar from '../../components/common/SubNavBar.vue'
import EmptyState from '../../components/common/EmptyState.vue'

const BlueprintScannerModal = defineAsyncComponent(
  () => import('./components/BlueprintScannerModal.vue'),
)

const store = useBlueprintsStore()

function resolveBpIcon(bp) {
  if (bp.icon) return assetUrl(bp.icon)
  if (bp.gameIcon) return assetUrl(bp.gameIcon)
  const baseEn = String(bp.enName || '')
    .replace(/\s*(Blueprint|Design|Stencil)$/i, '')
    .trim()
  if (baseEn && ITEM_ICON_MAP[baseEn]) {
    return assetUrl(`/items/${ITEM_ICON_MAP[baseEn]}`)
  }
  return assetUrl(bp.blueprintIcon || '/items/T_UI_Icon_Recipe.png')
}

function resolvePaperIcon(bp) {
  return assetUrl(
    bp.blueprintIcon ||
      (store.blueprintSubTab === 'furniture'
        ? '/items/T_UI_Icon_FurnitureRecipe.png'
        : '/items/T_UI_Icon_Recipe.png'),
  )
}

function resolveTypeIcon(bp) {
  return bp.typeIcon ? assetUrl(bp.typeIcon) : ''
}

function cleanBpName(bp) {
  if (bp.itemName) return bp.itemName
  return String(bp.name || '').replace(/\s*(蓝图|设计图|涂装模板)$/, '')
}

const subNavItems = computed(() => [
  { id: 'weapon_item', label: '武器与道具蓝图', count: store.weaponItemBlueprints.length },
  { id: 'furniture', label: '哨站家具设计图', count: store.furnitureBlueprints.length },
  { id: 'stencil', label: '武器涂装模板', count: store.stencilBlueprints.length },
])

const ownershipOptions = [
  { id: 'ALL', label: '全部' },
  { id: 'MISSING', label: '缺失' },
  { id: 'OWNED', label: '已掌握' },
]

const rarityOptions = [
  { id: 'ALL', label: '全品质' },
  { id: 'legendary', label: '传奇' },
  { id: 'epic', label: '史诗' },
  { id: 'rare', label: '稀有' },
  { id: 'uncommon', label: '罕见' },
  { id: 'common', label: '普通' },
]

const hoveredBp = ref(null)
const tooltipPos = ref({ x: 0, y: 0 })
let tooltipRafId = 0
let pendingClientX = 0
let pendingClientY = 0

function applyTooltipCoords(cx, cy) {
  const pad = 18
  const tw = 340
  const th = 250
  let x = cx + pad
  let y = cy + 12
  if (x + tw > window.innerWidth - 12) x = cx - tw - pad
  if (y + th > window.innerHeight - 12) y = Math.max(12, window.innerHeight - th - 12)
  if (tooltipPos.value.x !== x || tooltipPos.value.y !== y) {
    tooltipPos.value = { x, y }
  }
}

function onCardMouseEnter(bp, e) {
  hoveredBp.value = bp
  applyTooltipCoords(e.clientX, e.clientY)
}

function onCardMouseMove(e) {
  if (!hoveredBp.value) return
  pendingClientX = e.clientX
  pendingClientY = e.clientY
  if (tooltipRafId) return
  tooltipRafId = requestAnimationFrame(() => {
    tooltipRafId = 0
    if (hoveredBp.value) {
      applyTooltipCoords(pendingClientX, pendingClientY)
    }
  })
}

function onCardMouseLeave() {
  hoveredBp.value = null
  if (tooltipRafId) {
    cancelAnimationFrame(tooltipRafId)
    tooltipRafId = 0
  }
}

onBeforeUnmount(() => {
  if (tooltipRafId) {
    cancelAnimationFrame(tooltipRafId)
    tooltipRafId = 0
  }
})
</script>

<template>
  <section class="qr-section">
    <SubNavBar v-model="store.blueprintSubTab" :items="subNavItems">
      <template #filters>
        <!-- In-game "Found: X / Y" indicator from WBP_WorkshopRecipeScreen -->
        <div class="bp-found-badge" title="当前分区已掌握蓝图进度 (ID_CHAMBERS_RECIPES_FOUND)">
          <img :src="assetUrl('/items/T_UI_Icon_Blueprint.png')" alt="" class="bp-found-ico" />
          <span class="bp-found-lbl">找到：</span>
          <strong class="ar-num">{{ store.activeTabOwnedCount }}</strong>
          <small class="ar-num">/ {{ store.activeBlueprintPool.length }}</small>
        </div>

        <div class="ar-tabs seg">
          <button
            v-for="o in ownershipOptions"
            :key="o.id"
            class="ar-tab"
            :class="{ active: store.bpOwnershipFilter === o.id }"
            @click="store.bpOwnershipFilter = o.id"
          >
            {{ o.label }}
            <em v-if="o.id === 'OWNED'" class="ar-count">{{ store.activeTabOwnedCount }}</em>
          </button>
        </div>

        <div class="ar-tabs seg">
          <button
            v-for="o in rarityOptions"
            :key="o.id"
            class="ar-tab"
            :class="[{ active: store.bpRarityFilter === o.id }, `r-${o.id}`]"
            @click="store.bpRarityFilter = o.id"
          >
            <i v-if="o.id !== 'ALL'" class="r-dot"></i>
            {{ o.label }}
          </button>
        </div>

        <button
          class="ar-btn ar-btn--ghost ar-btn--sm scan-btn"
          @click="store.showScreenshotScannerModal = true"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M1.5 5V2.5a1 1 0 0 1 1-1H5M11 1.5h2.5a1 1 0 0 1 1 1V5M14.5 11v2.5a1 1 0 0 1-1 1H11M5 14.5H2.5a1 1 0 0 1-1-1V11M4.5 8h7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          截图识别
        </button>
      </template>
    </SubNavBar>

    <!-- In-game Category Filter Bar (WBP_InventorySlotContainer / InventoryFilter) -->
    <div v-if="store.categoryFilterOptions.length" class="bp-cat-bar">
      <button
        v-for="cat in store.categoryFilterOptions"
        :key="cat.id"
        class="bp-cat-pill"
        :class="{ active: store.bpCategoryFilter === cat.id }"
        @click="store.bpCategoryFilter = cat.id"
      >
        <img v-if="cat.icon" :src="assetUrl(cat.icon)" alt="" class="bp-cat-ico" />
        <span>{{ cat.label }}</span>
        <em class="ar-num">{{ cat.count }}</em>
      </button>
    </div>

    <!-- Authentic In-Game Compact Slot Grid -->
    <div class="bp-grid bp-grid--slot">
      <article
        v-for="bp in store.filteredBlueprints"
        :key="bp.id"
        class="bp-card bp-card--slot"
        :class="[
          `rarity-${bp.rarity}`,
          { owned: store.isBlueprintOwned(bp.id) },
        ]"
        @mouseenter="onCardMouseEnter(bp, $event)"
        @mousemove="onCardMouseMove"
        @mouseleave="onCardMouseLeave"
      >
        <div class="bpc-visual">
          <!-- Authentic In-Game Blueprint Paper / Field Notes Backing Graphic -->
          <img
            :src="resolvePaperIcon(bp)"
            alt=""
            class="bpc-paper-bg"
            aria-hidden="true"
            loading="lazy"
          />

          <!-- Top-left Item Name -->
          <div class="bpc-top-left">
            <strong class="bpc-main-title">{{ cleanBpName(bp) }}</strong>
          </div>

          <!-- Top-right In-Game Slot Indicators (TypeIcon + Owned Checkmark Button) -->
          <div class="bpc-top-right">
            <span v-if="resolveTypeIcon(bp)" class="bpc-type-ico-wrap" :title="bp.subType">
              <img :src="resolveTypeIcon(bp)" alt="" class="bpc-type-ico" />
            </span>

            <button
              class="bpc-own-btn"
              :class="{ active: store.isBlueprintOwned(bp.id) }"
              :aria-pressed="store.isBlueprintOwned(bp.id)"
              @click.stop="store.toggleBlueprintOwned(bp.id)"
            >
              <img
                v-if="store.isBlueprintOwned(bp.id)"
                :src="assetUrl('/items/T_Icon_Checkmark_Small.png')"
                alt=""
                class="bpc-check-ico"
              />
              <span>{{ store.isBlueprintOwned(bp.id) ? '已掌握' : '未掌握' }}</span>
            </button>
          </div>

          <!-- Crafted Item / Weapon / Furniture / Stencil Icon -->
          <img
            :src="resolveBpIcon(bp)"
            :alt="bp.name"
            class="bpc-img"
            loading="lazy"
          />

          <!-- Bottom-left Blueprint Badge & English Name -->
          <div class="bpc-bottom-bar">
            <span class="bpc-en-sub">
              <img :src="assetUrl('/items/T_UI_Icon_Blueprint.png')" alt="" class="bpc-mini-bp-ico" />
              {{ bp.itemEnName || bp.enName.replace(/\s*(Blueprint|Design)$/i, '') }}
            </span>
          </div>
        </div>
      </article>
    </div>

    <!-- Floating In-Game Inspect Tooltip on hover -->
    <Teleport to="body">
      <div
        v-if="hoveredBp"
        class="bp-inspect-tooltip"
        :class="`rarity-${hoveredBp.rarity}`"
        :style="{ left: tooltipPos.x + 'px', top: tooltipPos.y + 'px' }"
      >
        <div class="bpi-head">
          <img :src="resolvePaperIcon(hoveredBp)" alt="" class="bpi-paper" />
          <div class="bpi-titles">
            <div class="bpi-rarity">{{ rarityLabelMap[hoveredBp.rarity] || hoveredBp.rarity }}</div>
            <h4>{{ hoveredBp.name }}</h4>
            <span>{{ hoveredBp.enName }} · {{ hoveredBp.subType }}</span>
          </div>
        </div>
        <p v-if="hoveredBp.buff || hoveredBp.description" class="bpi-desc">
          {{ hoveredBp.buff || hoveredBp.description }}
        </p>
        <div class="bpi-meta">
          <div>
            <span>制作工位</span>
            <strong>{{ hoveredBp.station }}</strong>
          </div>
          <div>
            <span>所需材料</span>
            <strong>{{ hoveredBp.materials }}</strong>
          </div>
          <div>
            <span>获取途径</span>
            <strong>{{ hoveredBp.source }}</strong>
          </div>
        </div>
      </div>
    </Teleport>

    <EmptyState v-if="!store.filteredBlueprints.length" message="无匹配蓝图" />

    <BlueprintScannerModal v-if="store.showScreenshotScannerModal" />
  </section>
</template>

<style scoped>
.qr-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}

/* In-game "Found: X / Y" badge */
.bp-found-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 3px;
  background: rgba(15, 20, 34, 0.85);
  border: 1px solid rgba(242, 169, 0, 0.38);
  font-family: var(--font-display);
  font-size: 12px;
  color: var(--tx-2);
}

.bp-found-ico {
  width: 14px;
  height: 14px;
  object-fit: contain;
  opacity: 0.9;
}

.bp-found-lbl {
  font-weight: 700;
  color: var(--tx-2);
}

.bp-found-badge strong {
  font-size: 13.5px;
  color: var(--amber);
}

.bp-found-badge small {
  font-size: 11.5px;
  color: var(--tx-3);
}

/* Category sub-filter bar */
.bp-cat-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.bp-cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 11px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: rgba(13, 17, 28, 0.72);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bp-cat-pill:hover {
  border-color: var(--line-strong);
  color: var(--tx-1);
}

.bp-cat-pill.active {
  background: rgba(242, 232, 213, 0.94);
  border-color: var(--cream);
  color: #0b0e17;
}

.bp-cat-ico {
  width: 14px;
  height: 14px;
  object-fit: contain;
  filter: brightness(1.1);
}

.bp-cat-pill.active .bp-cat-ico {
  filter: invert(1) brightness(0.2);
}

.bp-cat-pill em {
  font-style: normal;
  font-size: 11px;
  opacity: 0.75;
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

.seg .ar-count {
  font-style: normal;
}

.r-dot {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--rc, var(--tx-3));
}

.r-legendary {
  --rc: var(--r-legendary);
}
.r-epic {
  --rc: var(--r-epic);
}
.r-rare {
  --rc: var(--r-rare);
}
.r-uncommon {
  --rc: var(--r-uncommon);
}
.r-common {
  --rc: var(--r-common);
}

.scan-btn svg {
  width: 13px;
  height: 13px;
}

/* ---------- Grid ---------- */
.bp-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  grid-auto-rows: max-content;
  padding: 2px 6px 24px 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.bp-grid--slot {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
}

.bp-card {
  --rc: var(--r-uncommon);
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}

.bp-card:hover {
  border-color: color-mix(in srgb, var(--rc) 70%, #ffffff);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.48);
}

.bp-card.rarity-common {
  --rc: var(--r-common);
}
.bp-card.rarity-uncommon {
  --rc: var(--r-uncommon);
}
.bp-card.rarity-rare {
  --rc: var(--r-rare);
}
.bp-card.rarity-epic {
  --rc: var(--r-epic);
}
.bp-card.rarity-legendary {
  --rc: var(--r-legendary);
}

.bp-card.owned {
  border-color: color-mix(in srgb, var(--amber) 65%, transparent);
  box-shadow: inset 0 0 0 1px rgba(242, 169, 0, 0.22);
}

/* Authentic In-Game Blueprint Slot Visual (WBP_InventoryTileWidget + WBP_InventoryItemSlot) */
.bpc-visual {
  position: relative;
  flex-shrink: 0;
  height: 152px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 38px 14px 26px;
  background:
    radial-gradient(
      ellipse at 50% 62%,
      color-mix(in srgb, var(--rc) 24%, transparent) 0%,
      transparent 70%
    ),
    repeating-linear-gradient(
      0deg,
      rgba(96, 165, 250, 0.035) 0px,
      rgba(96, 165, 250, 0.035) 1px,
      transparent 1px,
      transparent 18px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(96, 165, 250, 0.035) 0px,
      rgba(96, 165, 250, 0.035) 1px,
      transparent 1px,
      transparent 18px
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--rc) 14%, #0f1523) 0%,
      #0a0e18 100%
    );
  border-bottom: 3px solid var(--rc);
  overflow: hidden;
}

.bp-card--slot .bpc-visual {
  height: 138px;
  padding: 34px 10px 24px;
}

/* Authentic in-game Blueprint paper / Field Notes icon (T_UI_Icon_Recipe / T_UI_Icon_FurnitureRecipe) */
.bpc-paper-bg {
  position: absolute;
  left: -6px;
  bottom: -10px;
  width: 96px;
  height: 96px;
  object-fit: contain;
  opacity: 0.24;
  transform: rotate(-8deg);
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.bp-card:hover .bpc-paper-bg {
  opacity: 0.38;
  transform: rotate(-4deg) scale(1.05);
}

.bpc-img {
  position: relative;
  z-index: 2;
  max-width: 78%;
  max-height: 86px;
  object-fit: contain;
  filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.65));
  transition: transform 0.18s ease;
}

.bp-card--slot .bpc-img {
  max-width: 80%;
  max-height: 76px;
}

.bp-card:hover .bpc-img {
  transform: scale(1.05);
}

.bp-card:not(.owned) .bpc-img {
  opacity: 0.92;
}

.bpc-top-left {
  position: absolute;
  left: 11px;
  top: 8px;
  right: 108px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  z-index: 3;
}

.bpc-main-title {
  font-family: var(--font-display);
  font-size: 16.5px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: #f6f2ea;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.75);
}

.bp-card--slot .bpc-main-title {
  font-size: 14.5px;
}

.bpc-type {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--rc) 20%, rgba(9, 12, 25, 0.78));
  border: 1px solid color-mix(in srgb, var(--rc) 48%, transparent);
  font-size: 11.5px;
  font-weight: 700;
  color: color-mix(in srgb, var(--rc) 78%, #ffffff);
  white-space: nowrap;
}

/* Top-right overlay matching WBP_InventoryItemSlot Overlay_1 -> HorizontalBox_1 */
.bpc-top-right {
  position: absolute;
  right: 8px;
  top: 7px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  z-index: 3;
}

.bpc-type-ico-wrap {
  width: 22px;
  height: 22px;
  border-radius: 3px;
  background: rgba(8, 11, 20, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bpc-type-ico {
  width: 14px;
  height: 14px;
  object-fit: contain;
  opacity: 0.9;
}

.bpc-own-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border: none;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.82);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.bpc-own-btn:hover {
  color: var(--tx-1);
  box-shadow: inset 0 0 0 1px var(--cream);
}

.bpc-own-btn.active {
  background: var(--amber);
  box-shadow: none;
  color: #0b0d14;
}

.bpc-check-ico {
  width: 11px;
  height: 11px;
  object-fit: contain;
  filter: brightness(0.1);
}

.bpc-bottom-bar {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  z-index: 3;
  pointer-events: none;
}

.bpc-en-sub {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: rgba(226, 232, 240, 0.78);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpc-mini-bp-ico {
  width: 12px;
  height: 12px;
  object-fit: contain;
  opacity: 0.82;
  flex-shrink: 0;
}

/* Floating Inspect Tooltip for Slot Mode */
.bp-inspect-tooltip {
  --rc: var(--r-uncommon);
  position: fixed;
  z-index: 9999;
  width: 336px;
  padding: 13px 15px;
  border-radius: 6px;
  background: rgba(11, 14, 23, 0.97);
  border: 1px solid color-mix(in srgb, var(--rc) 65%, rgba(255, 255, 255, 0.2));
  border-top: 3px solid var(--rc);
  box-shadow: 0 16px 38px rgba(0, 0, 0, 0.78);
  pointer-events: none;
  color: var(--tx-1);
}

.bp-inspect-tooltip.rarity-common {
  --rc: var(--r-common);
}
.bp-inspect-tooltip.rarity-uncommon {
  --rc: var(--r-uncommon);
}
.bp-inspect-tooltip.rarity-rare {
  --rc: var(--r-rare);
}
.bp-inspect-tooltip.rarity-epic {
  --rc: var(--r-epic);
}
.bp-inspect-tooltip.rarity-legendary {
  --rc: var(--r-legendary);
}

.bpi-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 9px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.bpi-paper {
  width: 44px;
  height: 44px;
  object-fit: contain;
  flex-shrink: 0;
}

.bpi-titles {
  min-width: 0;
}

.bpi-rarity {
  font-family: var(--font-display);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--rc);
}

.bpi-titles h4 {
  margin: 1px 0 2px;
  font-size: 15px;
  font-weight: 800;
  color: #f6f2ea;
}

.bpi-titles span {
  font-size: 11.5px;
  color: var(--tx-3);
}

.bpi-desc {
  margin: 9px 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--tx-2);
}

.bpi-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
}

.bpi-meta > div {
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: 8px;
  align-items: baseline;
}

.bpi-meta span {
  color: var(--tx-3);
  font-size: 11px;
  font-weight: 700;
}

.bpi-meta strong {
  color: var(--tx-1);
  font-weight: 600;
  line-height: 1.35;
}

@media (max-width: 1400px) {
  .bp-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .bp-grid--slot {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 1080px) {
  .bp-grid,
  .bp-grid--slot {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
