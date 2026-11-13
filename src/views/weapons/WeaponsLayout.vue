<script setup>
import { provide, reactive, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useWeaponsStore } from '../../stores/useWeaponsStore'
import { useFloatingTooltip } from '../../composables/useFloatingTooltip'
import WeaponSidebar from './components/WeaponSidebar.vue'
import ModSlotPicker from './components/ModSlotPicker.vue'
import ModHoverTooltip from './components/ModHoverTooltip.vue'
import './weapons.css'

const route = useRoute()
const store = useWeaponsStore()
const overlay = reactive(useFloatingTooltip(store))

provide('weaponsOverlay', overlay)

// Map legacy hex colours coming from the calculator/store onto design tokens
// (rarity / status). Unknown values pass through unchanged.
const TONE = {
  '#94a3b8': 'var(--r-common)',
  '#10b981': 'var(--r-uncommon)',
  '#38bdf8': 'var(--r-rare)',
  '#a855f7': 'var(--r-epic)',
  '#f59e0b': 'var(--r-legendary)',
  '#f87171': 'var(--st-danger)',
  '#f5a524': 'var(--amber)',
  '#ffc23d': 'var(--gold)',
}
const tone = (c) => TONE[String(c || '').toLowerCase()] || c
provide('weaponsTone', tone)

watch(
  () => [route.path, store.selectedWeaponId, store.activeCompareSlotIdx],
  () => {
    overlay.closeMenu()
  }
)
</script>

<template>
  <div class="weapons-module">
    <WeaponSidebar />
    <RouterView />
    <ModSlotPicker />
    <ModHoverTooltip />
  </div>
</template>
