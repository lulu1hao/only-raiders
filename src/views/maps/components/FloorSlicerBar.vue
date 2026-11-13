<script setup>
defineProps({
  clipZ: { type: Number, required: true },
  minClipZ: { type: Number, required: true },
  maxClipZ: { type: Number, required: true },
  floors: { type: Array, default: () => [] },
  autoClipOnSelect: { type: Boolean, default: true },
})

const emit = defineEmits(['update:clipZ', 'update:autoClipOnSelect', 'apply-preset'])

// "上层：高能激光室 (+48m)" -> { name: '高能激光室', z: '+48m' }
function parseFloor(label = '') {
  let name = label
  let z = ''
  const m = name.match(/^(.*?)\s*[（(]([^()（）]+)[)）]\s*$/)
  if (m) {
    name = m[1]
    z = m[2]
  }
  const parts = name.split(/[：:]/)
  if (parts.length > 1 && parts[1].trim()) name = parts.slice(1).join('：').trim()
  return { name, z }
}
</script>

<template>
  <section class="sb-sec slice-box">
    <div class="sec-head">
      <span>剖切</span>
      <strong class="slice-val ar-num">{{ clipZ.toFixed(1) }}<small>m</small></strong>
    </div>
    <input
      type="range"
      class="slice-slider"
      :min="minClipZ"
      :max="maxClipZ"
      step="0.5"
      :value="clipZ"
      :style="{ '--p': `${((clipZ - minClipZ) / Math.max(0.001, maxClipZ - minClipZ)) * 100}%` }"
      @input="emit('update:clipZ', Number($event.target.value))"
    />
  </section>
</template>

<style scoped>
.sb-sec {
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 8px;
}

.sec-head > span {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tx-3);
}

.slice-val {
  font-size: 18px;
  color: var(--amber);
}

.slice-val small {
  margin-left: 2px;
  font-size: 12px;
  color: var(--tx-3);
}

/* Custom range: amber fill, square cream thumb */
.slice-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}

.slice-slider::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--amber) 0 var(--p, 50%), var(--bg-hover) var(--p, 50%) 100%);
}

.slice-slider::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--amber) 0 var(--p, 50%), var(--bg-hover) var(--p, 50%) 100%);
}

.slice-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 16px;
  margin-top: -6px;
  border: none;
  border-radius: 2px;
  background: var(--cream);
}

.slice-slider::-moz-range-thumb {
  width: 12px;
  height: 16px;
  border: none;
  border-radius: 2px;
  background: var(--cream);
}

.slice-slider:focus-visible {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}

.floor-presets {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  margin-top: 10px;
}

.floor-presets button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  height: 30px;
  padding: 0 9px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-2);
  color: var(--tx-2);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.fp-name {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fp-z {
  flex: 0 0 auto;
  font-size: 11.5px;
  color: var(--tx-3);
}

.floor-presets button:hover {
  background: var(--bg-hover);
  color: var(--tx-1);
  box-shadow: inset 3px 0 0 var(--amber);
}

.floor-presets button.active {
  background: var(--cream);
  color: var(--ink);
  box-shadow: none;
}

.floor-presets button.active .fp-z {
  color: var(--ink-2);
}

.auto-slice-chk {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--tx-2);
  cursor: pointer;
  user-select: none;
}

.auto-slice-chk input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.auto-slice-chk i {
  position: relative;
  width: 26px;
  height: 14px;
  border-radius: 2px;
  background: var(--bg-hover);
  transition: background 0.15s;
}

.auto-slice-chk i::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 1px;
  background: var(--tx-3);
  transition: transform 0.15s var(--ease), background 0.15s;
}

.auto-slice-chk input:checked + i {
  background: var(--amber);
}

.auto-slice-chk input:checked + i::after {
  transform: translateX(12px);
  background: var(--ink);
}

.auto-slice-chk input:focus-visible + i {
  outline: 1px solid var(--amber);
  outline-offset: 2px;
}
</style>
