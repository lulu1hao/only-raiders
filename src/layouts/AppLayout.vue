<script setup>
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TopNavBar from './TopNavBar.vue'
import AppUpdateModal from '../components/common/AppUpdateModal.vue'
import { useAppUpdater } from '../composables/useAppUpdater'
import { isOverlayWindowContext, useOverlayWindowStore } from '../stores/useOverlayWindowStore'

const route = useRoute()
const router = useRouter()
const overlayStore = useOverlayWindowStore()

const isOverlayRoute = computed(
  () => Boolean(route.meta?.isOverlay) || isOverlayWindowContext(),
)

watch(
  isOverlayRoute,
  (val) => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('is-overlay-window', Boolean(val))
    }
  },
  { immediate: true },
)

const { runStartupAutoCheck } = useAppUpdater()

onMounted(() => {
  overlayStore.initCrossWindowSync(router)
  if (!isOverlayRoute.value) {
    runStartupAutoCheck()
  }
})
</script>

<template>
  <div class="app-shell" :class="{ 'is-overlay-shell': isOverlayRoute }">
    <TopNavBar v-if="!isOverlayRoute" />
    <AppUpdateModal v-if="!isOverlayRoute" />
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-0);
  color: var(--tx-1);
}

.app-shell.is-overlay-shell {
  background: transparent;
}
</style>
