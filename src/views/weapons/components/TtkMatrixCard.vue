<script setup>
defineProps({
  calc: { type: Object, required: true },
})
</script>

<template>
  <section class="bench-bottom">
    <header class="ar-head w-head">
      <h2>击杀效率 TTK</h2>
      <span class="w-meta"><b class="ar-num">{{ calc.enhancedRpm.toFixed(0) }}</b> RPM</span>
    </header>

    <section class="ar-panel ttk-card">
      <table class="ttk">
        <thead>
          <tr>
            <th>目标</th>
            <th>命中数</th>
            <th>击杀时间</th>
            <th>全爆头</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in calc.ttkTable" :key="row.id">
            <td class="t-target">
              <strong>{{ row.label }}</strong>
              <small>{{ row.sub }}</small>
            </td>
            <td>
              <span v-if="row.enhBtk !== row.baseBtk" class="t-old">{{ row.baseBtk }}</span>
              <b :class="{ better: row.enhBtk < row.baseBtk }">{{ row.enhBtk }}</b>
              <small class="t-unit">发</small>
            </td>
            <td>
              <span v-if="Math.abs(row.enhTtk - row.baseTtk) > 0.02" class="t-old">
                {{ row.baseTtk.toFixed(2) }}s
              </span>
              <b :class="{ better: row.enhTtk < row.baseTtk - 0.02 }">
                {{ row.enhTtk.toFixed(2) }}
              </b>
              <small class="t-unit">s</small>
            </td>
            <td class="t-hs">
              <b>{{ row.enhHsTtk.toFixed(2) }}</b><small class="t-unit">s</small>
              <span class="t-hs-btk">{{ row.enhHsBtk }} 发</span>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </section>
</template>
