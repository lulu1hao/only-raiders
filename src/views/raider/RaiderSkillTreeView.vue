<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRaiderStore } from '../../stores/useRaiderStore'
import SkillTreeCanvas from './components/SkillTreeCanvas.vue'
import SkillInspectorPanel from './components/SkillInspectorPanel.vue'
import GatedSelectionModal from './components/GatedSelectionModal.vue'

const route = useRoute()
const router = useRouter()
const store = useRaiderStore()

const canvasRef = ref(null)
const inspectorRef = ref(null)

function onPagePaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const blob = it.getAsFile()
      if (blob) {
        e.preventDefault()
        inspectorRef.value?.openAndProcessImage?.(blob)
        return
      }
    }
  }
}

onMounted(() => {
  if (route.query.build) {
    const ok = store.importShareCode(String(route.query.build))
    if (ok) {
      router.replace({ path: '/raider' })
    }
  }
  window.addEventListener('paste', onPagePaste)
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPagePaste)
})
</script>

<template>
  <main class="raider-page">
    <!-- Main Workspace (Full-Height Skill Tree + Inline Switchable Right Control Sidebar) -->
    <div class="raider-workspace">
      <SkillTreeCanvas ref="canvasRef" />
      <SkillInspectorPanel ref="inspectorRef" />
    </div>

    <GatedSelectionModal />

    <Teleport to="body">
      <Transition name="toast-pop">
        <div
          v-if="store.toast"
          :key="store.toast.ts"
          class="raider-toast"
          :class="[`is-${store.toast.type}`]"
        >
          {{ store.toast.text }}
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.raider-page {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
  overflow: hidden;
}

.raider-workspace {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.raider-toast {
  position: fixed;
  left: 50%;
  bottom: 26px;
  transform: translateX(-50%);
  z-index: 420;
  padding: 8px 15px;
  border-radius: 6px;
  background: rgba(14, 18, 34, 0.96);
  border: 1px solid rgba(206, 193, 176, 0.28);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
  color: #f9eedf;
  font-family: var(--font-body);
  font-size: 12.5px;
  font-weight: 700;
  pointer-events: none;
}

.raider-toast.is-warn {
  border-color: var(--amber);
  color: var(--amber);
}

.raider-toast.is-ok {
  border-color: var(--c-raider);
  color: var(--c-raider);
}

.toast-pop-enter-active,
.toast-pop-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast-pop-enter-from,
.toast-pop-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
