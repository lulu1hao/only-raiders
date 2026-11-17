<script setup>
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { useWeaponsStore } from '../../stores/useWeaponsStore'
import LoadoutCard from './components/LoadoutCard.vue'

const router = useRouter()
const store = useWeaponsStore()
const overlay = inject('weaponsOverlay')
const tone = inject('weaponsTone', (c) => c)
</script>

<template>
  <main class="compare-arena" @scroll.passive="overlay.closeMenu">
    <header class="ar-head w-head ca-header">
      <h2>武器对比</h2>
      <div class="ca-actions">
        <button
          v-if="store.compareSlots.length < 3"
          class="ar-btn ar-btn--sm"
          title="添加第 3 把对比武器"
          @click="store.addThirdCompareSlot"
        >
          + 添加栏位
        </button>
        <button class="ar-btn ar-btn--sm ar-btn--ghost" @click="router.push('/weapons/workbench')">
          返回改装
        </button>
      </div>
    </header>

    <!-- Loadout Cards for Each Compared Weapon -->
    <section
      class="ca-columns"
      :style="{ gridTemplateColumns: `repeat(${store.compareComputedList.length}, minmax(0, 1fr))` }"
    >
      <section
        v-for="(item, idx) in store.compareComputedList"
        :key="item.slot.uid"
        class="ar-panel loadout ca-col"
        :class="{ focused: store.activeCompareSlotIdx === idx }"
        :style="{ '--r': tone(item.slot.ampIds?.length ? '#ffc600' : item.weapon.rarityColor) }"
        @click="store.activeCompareSlotIdx = idx"
      >
        <div class="cac-head">
          <div class="cac-slot-bar">
            <span class="cac-badge">
              <b class="ar-num">#{{ idx + 1 }}</b>
              <i v-if="store.activeCompareSlotIdx === idx" title="在左侧列表点选武器以替换此栏">替换目标</i>
            </span>
            <div class="cac-head-btns">
              <button class="cac-reset" title="重置为白板配置" @click.stop="store.resetCompareSlot(item.slot)">
                重置
              </button>
              <button
                v-if="store.compareSlots.length > 2"
                class="cac-remove"
                @click.stop="store.removeCompareSlot(idx)"
              >
                移除
              </button>
            </div>
          </div>

          <div class="cac-select-row">
            <select
              :value="item.slot.weaponId"
              class="select cac-weapon-select"
              @change="store.changeCompareSlotWeapon(item.slot, $event.target.value)"
            >
              <option
                v-for="w in store.enrichedWeapons"
                :key="w.id"
                :value="w.id"
              >
                [{{ w.zhClass }} · {{ w.rarityCn }}] {{ w.zhName }}
              </option>
            </select>
            <span
              class="cac-dps-pill"
              :class="{ best: store.isBestMetric((x) => x.calc.enhancedBodyDps, idx, true) }"
            >
              <b class="ar-num">{{ item.calc.enhancedBodyDps.toFixed(1) }}</b> DPS
            </span>
          </div>
        </div>

        <LoadoutCard
          :weapon="item.weapon"
          :calc="item.calc"
          :amp-ids="item.slot.ampIds"
          :mods="item.slot.mods"
          :compare-idx="idx"
          :is-best-fn="store.isBestMetric"
          @clear-mods="item.slot.mods = {}"
        />
      </section>
    </section>

    <!-- Side-by-Side Real-Time Comparison Matrix (TTK at the top) -->
    <section class="ca-matrix">
      <header class="ar-head w-head">
        <h2>数据对比</h2>
        <span class="w-meta"><i class="best-pill">★</i> 最优</span>
      </header>

      <div class="ar-panel matrix-table-wrap">
        <table class="matrix-table">
          <thead>
            <tr>
              <th class="m-label-col"></th>
              <th
                v-for="item in store.compareComputedList"
                :key="item.slot.uid"
                :style="{ '--r': tone(item.weapon.rarityColor) }"
              >
                <span class="m-th-name">{{ item.weapon.zhName }}</span>
                <small class="m-th-sub">
                  TIER {{ item.calc.tierObj?.roman }} · 增强 {{ item.slot.ampIds.length }} · 配件 {{ item.calc.equippedModsList.length }}
                </small>
              </th>
            </tr>
          </thead>
          <tbody>
            <!-- Section 1 (Top): TTK Comparison -->
            <tr class="m-sec-row">
              <td :colspan="store.compareComputedList.length + 1">
                TTK · 奇袭者护盾 <small>越低越好</small>
              </td>
            </tr>
            <tr v-for="(tRow, tIdx) in store.compareComputedList[0]?.calc.ttkTable || []" :key="tRow.id">
              <td class="m-metric">{{ tRow.label }} <small>{{ tRow.sub }}</small></td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.ttkTable[tIdx].enhTtk, idx, false) }"
              >
                <strong>
                  {{ item.calc.ttkTable[tIdx].enhTtk.toFixed(2) }}<small>s</small>
                  <span class="m-inline">{{ item.calc.ttkTable[tIdx].enhBtk }} 发</span>
                </strong>
                <i v-if="store.isBestMetric((x) => x.calc.ttkTable[tIdx].enhTtk, idx, false)" class="best-pill">★</i>
                <span class="m-sub">
                  爆头 {{ item.calc.ttkTable[tIdx].enhHsTtk.toFixed(2) }}s · {{ item.calc.ttkTable[tIdx].enhHsBtk }} 发
                </span>
              </td>
            </tr>

            <!-- Section 2: Core Output -->
            <tr class="m-sec-row">
              <td :colspan="store.compareComputedList.length + 1">输出 · 破甲</td>
            </tr>
            <tr>
              <td class="m-metric">持续秒伤 <small>DPS</small></td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.enhancedBodyDps, idx, true) }"
              >
                <strong>{{ item.calc.enhancedBodyDps.toFixed(1) }}</strong>
                <i v-if="store.isBestMetric((x) => x.calc.enhancedBodyDps, idx, true)" class="best-pill">★</i>
                <span class="m-sub">基础 {{ item.calc.baseBodyDps.toFixed(1) }}</span>
              </td>
            </tr>
            <tr>
              <td class="m-metric">爆头秒伤 <small>HS DPS</small></td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.enhancedHsDps, idx, true) }"
              >
                <strong>{{ item.calc.enhancedHsDps.toFixed(1) }}</strong>
                <i v-if="store.isBestMetric((x) => x.calc.enhancedHsDps, idx, true)" class="best-pill">★</i>
                <span class="m-sub">单发 {{ item.calc.headshotDmg.toFixed(1) }} · {{ item.calc.effectiveHsMult.toFixed(2) }}×</span>
              </td>
            </tr>
            <tr>
              <td class="m-metric">ARC 破甲秒伤</td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.enhancedArmorDps, idx, true) }"
              >
                <strong>{{ item.calc.enhancedArmorDps.toFixed(1) }}</strong>
                <i v-if="store.isBestMetric((x) => x.calc.enhancedArmorDps, idx, true)" class="best-pill">★</i>
                <span class="m-sub">单发 {{ item.calc.enhancedArmorDmg.toFixed(1) }} · {{ Math.round(item.calc.arcArmorMult * 100) }}%</span>
              </td>
            </tr>
            <tr>
              <td class="m-metric">单发伤害</td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.singleShotDmg, idx, true) }"
              >
                <strong>{{ item.calc.singleShotDmg.toFixed(1) }}</strong>
                <i v-if="store.isBestMetric((x) => x.calc.singleShotDmg, idx, true)" class="best-pill">★</i>
                <span class="m-sub">
                  基础 {{ item.calc.baseDmg.toFixed(1) }}
                  <template v-if="item.calc.pelletCount > 1"> · {{ item.calc.pelletCount }} 弹片</template>
                </span>
              </td>
            </tr>
            <tr>
              <td class="m-metric">护盾单发</td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.enhancedShieldDmg, idx, true) }"
              >
                <strong>{{ item.calc.enhancedShieldDmg.toFixed(1) }}</strong>
                <i v-if="store.isBestMetric((x) => x.calc.enhancedShieldDmg, idx, true)" class="best-pill">★</i>
                <span class="m-sub">破盾 {{ (item.calc.shieldMult * 100).toFixed(0) }}%</span>
              </td>
            </tr>
            <tr>
              <td class="m-metric">射速 <small>RPM</small></td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.enhancedRpm, idx, true) }"
              >
                <strong>{{ item.calc.enhancedRpm.toFixed(0) }}</strong>
                <i v-if="store.isBestMetric((x) => x.calc.enhancedRpm, idx, true)" class="best-pill">★</i>
                <span class="m-sub">
                  基础 {{ item.calc.baseRpm.toFixed(0) }} · {{ item.calc.totalFireRatePct >= 0 ? '+' : '' }}{{ item.calc.totalFireRatePct.toFixed(0) }}%
                </span>
              </td>
            </tr>
            <tr>
              <td class="m-metric">弹匣 · 总伤</td>
              <td
                v-for="(item, idx) in store.compareComputedList"
                :key="item.slot.uid"
                :class="{ best: store.isBestMetric((x) => x.calc.enhancedMagDamage, idx, true) }"
              >
                <strong>
                  {{ item.calc.enhancedMagDamage.toFixed(0) }}
                  <span class="m-inline">{{ item.calc.enhancedMag }} 发</span>
                </strong>
                <i v-if="store.isBestMetric((x) => x.calc.enhancedMagDamage, idx, true)" class="best-pill">★</i>
                <span class="m-sub">基础 {{ item.calc.baseMag }} 发 · {{ item.calc.baseMagDamage.toFixed(0) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
