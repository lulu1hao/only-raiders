<script setup>
import { useMapsStore } from '../../stores/useMapsStore'

defineProps({
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
})

const mapsStore = useMapsStore()
</script>

<template>{{ prefix }}{{ mapsStore.rotationCountdownText }}{{ suffix }}</template>
