<script setup>
import { computed } from 'vue'
import { useWorkshopStore } from '../../../stores/useWorkshopStore'
import { assetUrl } from '../../../utils/questItemIcons'
import EmptyState from '../../../components/common/EmptyState.vue'
import ResItemTile from './ResItemTile.vue'
import ResMapLinks from './ResMapLinks.vue'

/**
 * 废品仔喂食器（满级后附加投喂）：左侧掉落类别 → 中间 8 种食物 → 右侧该食物的固定加成与特殊掉落
 */
const store = useWorkshopStore()

const food = computed(() => store.selectedFeederFood)
const rarityLabel = { common: '普通', uncommon: '非凡', rare: '稀有', epic: '史诗', legendary: '传奇' }
const rewardCount = (f) => (f.rewardGroups || []).reduce((a, g) => a + g.items.length, 0)
</script>

<template>
  <div class="rs-workbench">
    <aside class="feeder-rail">
      <div class="rs-panel">
        <div class="rs-panel-head"><span class="ar-label">掉落类别</span></div>
        <div class="rs-rail-list">
          <button
            v-for="c in store.scrappyFeeder.categories"
            :key="c.id"
            class="rs-rail-item ar-row"
            :class="{ active: store.selectedFeederCategory === c.id }"
            @click="store.selectedFeederCategory = c.id"
          >
            <span class="rs-rail-top">
              <strong>{{ c.id === 'ALL' ? '全部食物' : c.label }}</strong>
              <span class="rs-num">{{ store.feederCategoryCounts[c.id] || 0 }}</span>
            </span>
          </button>
        </div>
      </div>

      <div class="rs-panel">
        <div class="rs-panel-head"><span class="ar-label">喂食规则</span></div>
        <ol class="rule-list">
          <li v-for="(r, i) in store.scrappyFeeder.rules" :key="i">{{ r }}</li>
        </ol>
      </div>
    </aside>

    <div class="rs-panel">
      <div class="rs-panel-head">
        <span class="ar-label">可投喂食物</span>
        <span class="rs-count">{{ store.filteredFeederFoods.length }}</span>
      </div>
      <div class="rs-scroll">
        <div
          v-for="f in store.filteredFeederFoods"
          :key="f.id"
          class="rs-row ar-row"
          :class="[`rc-${f.rarity}`, { active: food?.id === f.id }]"
          @click="store.selectedFeederFoodId = f.id"
        >
          <img :src="assetUrl(f.icon)" :alt="f.name" class="rs-row-icon" loading="lazy" />
          <div class="rs-row-main">
            <strong class="rs-row-title">{{ f.name }}</strong>
            <div class="rs-row-meta">
              <span>{{ f.categoryLabel }}</span>
            </div>
          </div>
          <span class="rs-tag ok">{{ f.basicHaulBoost?.length || 0 }} 项 +5</span>
          <span class="rs-tag warn">{{ rewardCount(f) }} 种掉落</span>
        </div>
        <EmptyState v-if="!store.filteredFeederFoods.length" message="无匹配食物" />
      </div>
    </div>

    <aside v-if="food" class="rs-panel rs-sticky">
      <header class="rs-insp-head" :class="`rc-${food.rarity}`">
        <div class="rs-insp-hero">
          <img :src="assetUrl(food.icon)" :alt="food.name" />
          <div>
            <div class="rs-insp-eyebrow">
              <span>{{ rarityLabel[food.rarity] || food.rarity }}</span>
            </div>
            <h2 class="rs-insp-title">{{ food.name }}</h2>
            <span class="rs-insp-en">{{ food.enName }}</span>
          </div>
        </div>
        <dl class="rs-insp-kv">
          <div>
            <dt>掉落类别</dt>
            <dd>{{ food.categoryLabel }}</dd>
          </div>
          <div>
            <dt>特殊掉落</dt>
            <dd>{{ rewardCount(food) }} 种</dd>
          </div>
        </dl>
      </header>

      <div class="rs-insp-body">
        <section>
          <div class="rs-block-head">
            <h4>获取方式与采集地图范围</h4>
            <span v-if="food.mapLinks?.length">{{ food.mapLinks.length }} 处地图范围</span>
          </div>
          <p class="rs-text">{{ food.obtainMethod }}</p>
          <div v-if="food.craftRecipe?.length" class="tile-grid recipe">
            <ResItemTile
              v-for="(ing, i) in food.craftRecipe"
              :key="i"
              :item="ing"
              :pin="!!ing.mapLinks?.length"
              :clickable="!!ing.feederFoodId"
              @select="ing.feederFoodId && (store.selectedFeederFoodId = ing.feederFoodId)"
            />
          </div>
          <ResMapLinks v-if="food.mapLinks?.length" :links="food.mapLinks" class="food-links" />
        </section>

        <section>
          <div class="rs-block-head">
            <h4>固定加成</h4>
            <span>每消耗 1 份</span>
          </div>
          <div class="tile-grid">
            <ResItemTile v-for="(b, i) in food.basicHaulBoost" :key="i" :item="b" :badge="b.bonus" />
          </div>
        </section>

        <section v-for="(g, gi) in food.rewardGroups" :key="gi">
          <div class="rs-block-head">
            <h4>{{ g.groupTitle }}</h4>
            <span>{{ g.items.length }} 种</span>
          </div>
          <div class="tile-grid">
            <ResItemTile
              v-for="(it, i) in g.items"
              :key="i"
              :item="it"
              :badge="it.isDouble ? '×2' : ''"
            />
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.feeder-rail {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feeder-rail > .rs-panel {
  flex-shrink: 0;
}

.rule-list {
  margin: 0;
  padding: 10px 16px 12px 32px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tx-3);
}

.tile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 8px;
}

.tile-grid.recipe,
.food-links {
  margin-top: 10px;
}
</style>
