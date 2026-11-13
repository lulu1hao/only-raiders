<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '搜索',
  },
  // Kept for API compatibility; the visual prefix is now a search glyph.
  prefix: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="search">
    <svg class="search-icon" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="search-input"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <button
      v-if="modelValue"
      class="search-clear"
      aria-label="清除"
      @click="emit('update:modelValue', '')"
    >
      ×
    </button>
  </label>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  width: 260px;
  padding: 0 10px;
  background: var(--bg-1);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  transition: border-color 0.15s;
}
.search:focus-within {
  border-color: var(--amber);
}

.search-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--tx-3);
}

.search-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  color: var(--tx-1);
  font-size: 13px;
}
.search-input::placeholder {
  color: var(--tx-3);
}

.search-clear {
  background: transparent;
  border: none;
  color: var(--tx-3);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.search-clear:hover {
  color: var(--cream);
}
</style>
