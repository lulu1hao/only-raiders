<script setup>
defineProps({
  message: {
    type: String,
    default: '暂无匹配',
  },
})
</script>

<template>
  <div class="empty-state">
    {{ message }}
  </div>
</template>

<style scoped>
.empty-state {
  padding: 40px 24px;
  text-align: center;
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
