<script setup>
defineProps({
  items: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="sub-bar">
    <div class="ar-tabs">
      <button
        v-for="item in items"
        :key="item.id"
        class="ar-tab"
        :class="{ active: modelValue === item.id }"
        @click="emit('update:modelValue', item.id)"
      >
        <span>{{ item.label }}</span>
        <em v-if="item.count !== undefined" class="ar-count">{{ item.count }}</em>
      </button>
    </div>

    <div v-if="$slots.filters" class="sub-filters">
      <slot name="filters" />
    </div>
  </div>
</template>

<style scoped>
.sub-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.ar-count {
  font-style: normal;
}

.sub-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
