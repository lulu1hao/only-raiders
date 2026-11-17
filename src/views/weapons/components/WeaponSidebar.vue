<script setup>
import { computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWeaponsStore } from '../../../stores/useWeaponsStore'
import { assetUrl, resolveWeaponVisualState } from '../../../composables/useWeaponCalculator'

const route = useRoute()
const router = useRouter()
const store = useWeaponsStore()
const tone = inject('weaponsTone', (c) => c)

const isCompare = computed(() => route.path.includes('/weapons/compare'))

const sortUnits = { dps: 'DPS', armorDps: '破甲', damage: '单发', rpm: 'RPM', range: 'M' }

function rowVisual(w) {
  if (!isCompare.value && w.id === store.selectedWeaponId) {
    return resolveWeaponVisualState(w, store.selectedTier, store.activeAmpIds)
  }
  const activeSlot = store.compareSlots[store.activeCompareSlotIdx]
  if (isCompare.value && activeSlot?.weaponId === w.id) {
    return resolveWeaponVisualState(w, activeSlot.tier, activeSlot.ampIds)
  }
  return resolveWeaponVisualState(w, 1, [])
}

function switchMode(mode) {
  router.push(mode === 'compare' ? '/weapons/compare' : '/weapons/workbench')
}

function handleClick(weaponId) {
  store.handleRosterClick(weaponId, isCompare.value ? 'compare' : 'workbench')
}
</script>

<template>
  <aside class="w-side">
    <div class="ar-tabs w-mode">
      <button class="ar-tab" :class="{ active: !isCompare }" @click="switchMode('workbench')">
        改装
      </button>
      <button class="ar-tab" :class="{ active: isCompare }" @click="switchMode('compare')">
        对比 <span class="ar-count">{{ store.compareSlots.length }}</span>
      </button>
    </div>

    <label class="w-search">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input v-model="store.searchQuery" type="text" placeholder="搜索武器 / 分类 / 弹药" />
    </label>

    <div class="w-chips">
      <button
        v-for="c in store.classTabs"
        :key="c.id"
        :class="{ active: store.selectedClass === c.id }"
        @click="store.selectedClass = c.id"
      >
        {{ c.label }}
      </button>
    </div>

    <div class="w-sort">
      <span class="ar-label">排序</span>
      <select v-model="store.sortBy" class="select compact">
        <option value="dps">持续秒伤 DPS</option>
        <option value="armorDps">ARC 破甲秒伤</option>
        <option value="damage">单发伤害</option>
        <option value="rpm">射速 RPM</option>
        <option value="range">有效射程</option>
      </select>
      <span class="w-count ar-num">{{ store.filteredWeapons.length }}/{{ store.enrichedWeapons.length }}</span>
    </div>

    <div v-if="isCompare" class="w-target">
      <span class="ar-label">替换目标</span>
      <b class="ar-num">#{{ store.activeCompareSlotIdx + 1 }}</b>
    </div>

    <div class="roster">
      <button
        v-for="w in store.filteredWeapons"
        :key="w.id"
        class="w-item ar-row"
        :class="{
          active: !isCompare
            ? w.id === store.selectedWeaponId
            : store.compareSlots[store.activeCompareSlotIdx]?.weaponId === w.id,
        }"
        :style="{ '--r': tone(rowVisual(w).displayRarityColor) }"
        @click="handleClick(w.id)"
      >
        <span class="wi-thumb">
          <img
            :src="assetUrl(rowVisual(w).hdImage)"
            :alt="w.zhName"
            class="wi-icon"
            loading="lazy"
            draggable="false"
          />
        </span>
        <span class="wi-info">
          <strong>
            <span class="wi-name">{{ w.zhName }}</span>
            <i v-if="w.hasUniqueAmp" class="wi-star" title="支持 5 级增强">★5</i>
          </strong>
          <small>
            <b>{{ w.rarityCn }}</b> · {{ w.zhClass }} · {{ w.modSlots.length ? `${w.modSlots.length} 槽` : '一体式' }}
          </small>
        </span>
        <span class="wi-stat">
          <b class="ar-num">
            {{
              (store.sortBy === 'armorDps'
                ? w.preview.enhancedArmorDps
                : store.sortBy === 'damage'
                  ? w.preview.singleShotDmg
                  : store.sortBy === 'rpm'
                    ? w.preview.enhancedRpm
                    : store.sortBy === 'range'
                      ? w.preview.enhancedRange
                      : w.preview.enhancedBodyDps
              ).toFixed(store.sortBy === 'rpm' ? 0 : 1)
            }}
          </b>
          <small>{{ sortUnits[store.sortBy] }}</small>
        </span>
      </button>

      <div v-if="!store.filteredWeapons.length" class="empty">无匹配武器</div>
    </div>
  </aside>
</template>
