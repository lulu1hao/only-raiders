<script setup>
import { pctDelta, deltaClass } from '../../../composables/useWeaponCalculator'

defineProps({
  weapon: { type: Object, required: true },
  calc: { type: Object, required: true },
  ampIds: { type: Array, default: () => [] },
  statRows: { type: Array, default: () => [] },
  handlingItems: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="col-result">
    <header class="ar-head w-head">
      <h2>属性</h2>
      <span class="w-meta">
        TIER {{ calc.tierObj?.roman }} · 增强 {{ ampIds.length }} · 配件 {{ calc.equippedModsList.length }}
      </span>
    </header>

    <section class="ar-panel attr-card">
      <div class="attr-head">
        <div>
          <span class="ar-label">持续秒伤 DPS</span>
          <strong class="attr-dps ar-num">{{ calc.enhancedBodyDps.toFixed(1) }}</strong>
        </div>
        <span class="attr-dps-base">
          基础 <b class="ar-num">{{ calc.baseBodyDps.toFixed(1) }}</b>
          <em
            v-if="pctDelta(calc.baseBodyDps, calc.enhancedBodyDps)"
            :class="deltaClass(calc.baseBodyDps, calc.enhancedBodyDps)"
          >
            {{ pctDelta(calc.baseBodyDps, calc.enhancedBodyDps) }}
          </em>
        </span>
      </div>

      <div class="stat-rows">
        <div v-for="r in statRows" :key="r.label" class="stat-row">
          <span class="sr-label">{{ r.label }}</span>
          <div class="sr-bar">
            <i class="sr-base" :style="{ width: `${r.baseW}%` }"></i>
            <i
              v-if="r.deltaW > 0.2"
              class="sr-delta"
              :class="r.tone"
              :style="{ left: `${r.deltaLeft}%`, width: `${r.deltaW}%` }"
            ></i>
          </div>
          <span class="sr-val">
            {{ r.cur.toFixed(r.digits) }}<small class="sr-unit">{{ r.unit }}</small>
            <em v-if="r.diffText" :class="r.tone">{{ r.diffText }}</em>
          </span>
        </div>
      </div>

      <div class="info-rows">
        <div>
          <span>爆头倍率</span>
          <b>{{ calc.effectiveHsMult.toFixed(2) }}×</b>
        </div>
        <div>
          <span>ARC 穿透</span>
          <b>
            {{ Math.round(calc.baseArmorMult * 100) }}% →
            {{ Math.round(calc.arcArmorMult * 100) }}%
          </b>
        </div>
        <div>
          <span>破盾倍率</span>
          <b>{{ (calc.shieldMult * 100).toFixed(0) }}%</b>
        </div>
        <div>
          <span>重量</span>
          <b>{{ weapon.baseStats?.weight ?? '—' }}</b>
        </div>
      </div>

      <div class="ih-head">
        <span class="ar-label">操控</span>
      </div>
      <div class="handling-grid">
        <div v-for="h in handlingItems" :key="h.label" class="h-cell">
          <span>{{ h.label }}</span>
          <b :class="h.state">{{ h.value }}</b>
        </div>
      </div>
    </section>
  </div>
</template>
