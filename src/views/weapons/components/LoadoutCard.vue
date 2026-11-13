<script setup>
import { inject } from 'vue'
import { useWeaponsStore } from '../../../stores/useWeaponsStore'
import {
  assetUrl,
  slotLabels,
  formatAmpTrigger,
  modGrade,
  modColor,
  pctDelta,
  deltaClass,
} from '../../../composables/useWeaponCalculator'

const props = defineProps({
  weapon: { type: Object, required: true },
  calc: { type: Object, required: true },
  ampIds: { type: Array, default: () => [] },
  mods: { type: Object, default: () => ({}) },
  compareIdx: { type: Number, default: -1 },
  isBestFn: { type: Function, default: null },
})

const emit = defineEmits(['clear-mods'])

const store = useWeaponsStore()
const overlay = inject('weaponsOverlay')
const tone = inject('weaponsTone', (c) => c)

function isMenuOpen(type, slotKey = '') {
  if (!overlay?.menu.open) return false
  if (overlay.menu.type !== type) return false
  if (overlay.menu.compareIdx !== props.compareIdx) return false
  if (type === 'mod' && overlay.menu.slotKey !== slotKey) return false
  return true
}

function getEquipped(slot) {
  return store.equippedMod(slot, props.compareIdx)
}

function checkBest(getter, higherBetter = true) {
  if (!props.isBestFn || props.compareIdx < 0) return false
  return props.isBestFn(getter, props.compareIdx, higherBetter)
}
</script>

<template>
  <div class="loadout-body">
    <!-- Tier & Amplification dropdown triggers -->
    <div class="lo-toolbar">
      <button
        class="dd-trigger"
        :class="{ open: isMenuOpen('tier') }"
        @click.stop="overlay.toggleMenu('tier', $event, '', compareIdx)"
        @mouseenter="!overlay.menu.open && overlay.showTip('tier', calc.tierObj, $event, compareIdx)"
        @mouseleave="overlay.hideTip"
      >
        <span class="dd-label">等级</span>
        <strong>TIER {{ calc.tierObj?.roman }}</strong>
        <i class="dd-caret"></i>
      </button>

      <button
        class="dd-trigger amp"
        :class="{
          open: isMenuOpen('amp'),
          lit: ampIds.length > 0,
        }"
        :disabled="!weapon.amplifications?.length"
        @click.stop="overlay.toggleMenu('amp', $event, '', compareIdx)"
        @mouseenter="!overlay.menu.open && ampIds.length && overlay.showTip('ampSummary', null, $event, compareIdx)"
        @mouseleave="overlay.hideTip"
      >
        <span class="dd-label">5 级增强</span>
        <strong>{{ formatAmpTrigger(weapon, ampIds) }}</strong>
        <i class="dd-caret"></i>
      </button>

      <button
        v-if="Object.values(mods).some(Boolean)"
        class="btn-clear-mods"
        title="卸下全部配件"
        @click.stop="emit('clear-mods')"
      >
        卸下全部
      </button>
    </div>

    <!-- Weapon stage render -->
    <div class="lo-stage">
      <span class="lo-watermark">{{ weapon.name }}</span>
      <img
        class="lo-weapon"
        :src="assetUrl(weapon.image)"
        :alt="weapon.zhName"
        draggable="false"
      />
      <div class="lo-stage-tags">
        <span><b class="ar-num">{{ calc.equippedModsList.length }}/{{ weapon.modSlots.length }}</b> 配件</span>
        <span v-if="ampIds.length" class="gold"><b class="ar-num">{{ ampIds.length }}</b> 增强</span>
      </div>
    </div>

    <!-- Mod slot grid -->
    <div
      v-if="weapon.modSlots.length"
      class="lo-slots"
      :style="{ '--n': weapon.modSlots.length }"
    >
      <button
        v-for="slot in weapon.modSlots"
        :key="slot"
        class="slot-cell"
        :class="{
          equipped: Boolean(getEquipped(slot)),
          locked: Boolean(calc.lockedSlots[slot]),
          open: isMenuOpen('mod', slot),
        }"
        :style="{ '--g': getEquipped(slot) ? tone(modColor(getEquipped(slot))) : 'var(--line-strong)' }"
        @click.stop="overlay.toggleMenu('mod', $event, slot, compareIdx)"
        @mouseenter="!overlay.menu.open && overlay.showSlotTip(slot, $event, compareIdx)"
        @mouseleave="overlay.hideTip"
      >
        <span class="sc-type">{{ slotLabels[slot]?.name || slot }}</span>
        <img
          v-if="getEquipped(slot)"
          class="sc-img"
          :src="assetUrl(getEquipped(slot).image)"
          alt=""
          draggable="false"
        />
        <img
          v-else
          class="sc-img ghost"
          :src="store.slotPlaceholderImg(slot)"
          alt=""
          draggable="false"
        />
        <span v-if="modGrade(getEquipped(slot))" class="sc-grade">{{ modGrade(getEquipped(slot)) }}</span>
        <span class="sc-name">
          {{ calc.lockedSlots[slot] ? '增强占用' : getEquipped(slot)?.zhName || '空' }}
        </span>
        <svg
          v-if="calc.lockedSlots[slot]"
          class="sc-lock"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
        >
          <rect x="5" y="11" width="14" height="10" rx="1.5" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </button>
    </div>
    <div v-else class="empty-box">一体式机匣 · 无配件槽</div>

    <!-- Combat Damage Summary Cards (2x2 Grid) -->
    <div class="stats">
      <div class="stat" :class="{ 'best-stat': checkBest((x) => x.calc.headshotDmg, true) }">
        <span class="s-label">爆头伤害 <i>{{ calc.effectiveHsMult.toFixed(2) }}×</i></span>
        <div class="s-row">
          <strong>{{ calc.headshotDmg.toFixed(1) }}</strong>
          <em
            v-if="pctDelta(calc.baseHsDmg, calc.headshotDmg)"
            :class="deltaClass(calc.baseHsDmg, calc.headshotDmg)"
          >
            {{ pctDelta(calc.baseHsDmg, calc.headshotDmg) }}
          </em>
        </div>
        <span class="s-sub">
          基础 {{ calc.baseHsDmg.toFixed(1) }} · 弱点 <b>{{ calc.enhancedHsDps.toFixed(1) }}</b> DPS
        </span>
      </div>

      <div class="stat" :class="{ 'best-stat': checkBest((x) => x.calc.enhancedArmorDps, true) }">
        <span class="s-label">ARC 破甲秒伤</span>
        <div class="s-row">
          <strong>{{ calc.enhancedArmorDps.toFixed(1) }}</strong>
          <em
            v-if="pctDelta(calc.baseArmorDps, calc.enhancedArmorDps)"
            :class="deltaClass(calc.baseArmorDps, calc.enhancedArmorDps)"
          >
            {{ pctDelta(calc.baseArmorDps, calc.enhancedArmorDps) }}
          </em>
        </div>
        <span class="s-sub">
          基础 {{ calc.baseArmorDps.toFixed(1) }} · 单发 {{ calc.enhancedArmorDmg.toFixed(1) }} · 系数 {{ Math.round(calc.arcArmorMult * 100) }}%
        </span>
      </div>

      <div class="stat" :class="{ 'best-stat': checkBest((x) => x.calc.enhancedShieldDmg, true) }">
        <span class="s-label">护盾单发</span>
        <div class="s-row">
          <strong>{{ calc.enhancedShieldDmg.toFixed(1) }}</strong>
          <em
            v-if="pctDelta(calc.baseDmg, calc.enhancedShieldDmg)"
            :class="deltaClass(calc.baseDmg, calc.enhancedShieldDmg)"
          >
            {{ pctDelta(calc.baseDmg, calc.enhancedShieldDmg) }}
          </em>
        </div>
        <span class="s-sub">破盾倍率 {{ (calc.shieldMult * 100).toFixed(0) }}%</span>
      </div>

      <div class="stat" :class="{ 'best-stat': checkBest((x) => x.calc.enhancedMagDamage, true) }">
        <span class="s-label">单匣总伤</span>
        <div class="s-row">
          <strong>{{ calc.enhancedMagDamage.toFixed(0) }}</strong>
          <em
            v-if="pctDelta(calc.baseMagDamage, calc.enhancedMagDamage)"
            :class="deltaClass(calc.baseMagDamage, calc.enhancedMagDamage)"
          >
            {{ pctDelta(calc.baseMagDamage, calc.enhancedMagDamage) }}
          </em>
        </div>
        <span class="s-sub">基础 {{ calc.baseMagDamage.toFixed(0) }} · {{ calc.enhancedMag }} 发</span>
      </div>
    </div>

    <div v-if="calc.burnDps > 0" class="burn">
      <span class="ar-label">灼烧</span>
      <span>
        每次命中 +<b class="ar-num">{{ calc.burnTotalPerHit.toFixed(1) }}</b>
        <small>（{{ calc.burnDps }}/秒 × {{ calc.burnSec }} 秒）</small>
      </span>
    </div>
  </div>
</template>

<style scoped>
.loadout-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
</style>
