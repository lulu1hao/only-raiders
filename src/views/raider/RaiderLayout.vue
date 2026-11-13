<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRaiderStore } from '../../stores/useRaiderStore'

const route = useRoute()
const router = useRouter()
const raiderStore = useRaiderStore()

const activeSubTab = computed(() => route.meta?.subTab || 'skills')

const navTabs = [
  { id: 'skills', label: '天赋树', path: '/raider/skills' },
  { id: 'loadout', label: '战备', path: '/raider/loadout' },
]
</script>

<template>
  <div class="raider-shell">
    <header class="raider-subnav">
      <nav class="rsn-tabs" aria-label="奇袭者分区导航">
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          type="button"
          class="rsn-tab"
          :class="{ active: activeSubTab === tab.id }"
          @click="router.push(tab.path)"
        >
          <span class="rsn-label">{{ tab.label }}</span>
          <em v-if="tab.id === 'skills'" class="rsn-badge ar-num">
            {{ raiderStore.totalSpentPoints }}/{{ raiderStore.maxSkillPoints }}P
          </em>
        </button>
      </nav>

      <div v-if="activeSubTab === 'skills'" class="rsn-right">
        <div class="rsn-branches">
          <span
            v-for="b in raiderStore.branches"
            :key="b.id"
            class="rsn-branch-chip"
          >
            <i :style="{ background: b.color }"></i>
            <span>{{ b.name }}</span>
            <strong class="ar-num">{{ raiderStore.branchPoints[b.id] || 0 }}</strong>
          </span>
        </div>
      </div>
    </header>

    <div class="raider-subview-host">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
.raider-shell {
  width: 100%;
  height: calc(100vh - var(--topbar-h, 56px));
  display: flex;
  flex-direction: column;
  background: var(--bg-0);
  overflow: hidden;
}

.raider-subnav {
  flex: 0 0 40px;
  height: 40px;
  padding: 0 20px;
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--line-strong);
  z-index: 22;
}

.rsn-tabs {
  display: flex;
  align-items: stretch;
  gap: 4px;
}

.rsn-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: none;
  border: none;
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.15s var(--ease);
}

.rsn-tab:first-child {
  padding-left: 4px;
}

.rsn-tab:hover {
  color: var(--tx-1);
}

.rsn-tab.active {
  color: var(--cream);
}

.rsn-tab::after {
  content: '';
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: -1px;
  height: 2.5px;
  background: var(--c-raider);
  box-shadow: 0 0 8px rgba(95, 255, 255, 0.45);
  transform: scaleX(0);
  transition: transform 0.18s var(--ease-out);
}

.rsn-tab:first-child::after {
  left: 4px;
}

.rsn-tab.active::after {
  transform: scaleX(1);
}

.rsn-badge {
  font-style: normal;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-0);
  border: 1px solid var(--line);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--tx-3);
}

.rsn-tab.active .rsn-badge {
  border-color: rgba(95, 255, 255, 0.38);
  color: var(--c-raider);
}

.rsn-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rsn-branches {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rsn-branch-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  color: var(--tx-3);
}

.rsn-branch-chip i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.rsn-branch-chip strong {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--tx-1);
}

.raider-subview-host {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

@media (max-width: 760px) {
  .rsn-branches {
    display: none;
  }
}
</style>
