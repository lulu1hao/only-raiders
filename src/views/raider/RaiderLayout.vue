<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRaiderStore } from '../../stores/useRaiderStore'
import { useGlidingNavIndicator } from '../../composables/useGlidingNavIndicator'

const route = useRoute()
const router = useRouter()
const raiderStore = useRaiderStore()

const activeSubTab = computed(() => route.meta?.subTab || 'skills')

const navTabs = [
  { id: 'skills', label: '天赋树', path: '/raider/skills' },
  { id: 'loadout', label: '战备', path: '/raider/loadout' },
]

const {
  navRef,
  setTabRef,
  onTabPointerEnter,
  onNavPointerLeave,
  railStyle,
  glowStyle,
  hoverPillStyle,
} = useGlidingNavIndicator({
  activeId: activeSubTab,
  items: navTabs,
  insetLeft: 16,
  insetRight: 16,
  pillInset: 5,
  defaultRgb: [95, 255, 255],
})
</script>

<template>
  <div class="raider-shell">
    <header class="raider-subnav">
      <nav ref="navRef" class="rsn-tabs" aria-label="奇袭者分区导航" @pointerleave="onNavPointerLeave">
        <span class="rsn-hover-pill" :style="hoverPillStyle" aria-hidden="true" />
        <span class="rsn-active-glow" :style="glowStyle" aria-hidden="true" />
        <button
          v-for="tab in navTabs"
          :key="tab.id"
          :ref="(el) => setTabRef(tab.id, el)"
          type="button"
          class="rsn-tab"
          :class="{ active: activeSubTab === tab.id }"
          @pointerenter="onTabPointerEnter(tab.id)"
          @focus="onTabPointerEnter(tab.id)"
          @blur="onNavPointerLeave"
          @click="router.push(tab.path)"
        >
          <span class="rsn-label">{{ tab.label }}</span>
          <em v-if="tab.id === 'skills'" class="rsn-badge ar-num">
            {{ raiderStore.totalSpentPoints }}/{{ raiderStore.maxSkillPoints }}P
          </em>
        </button>
        <span class="rsn-active-rail" :style="railStyle" aria-hidden="true" />
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
  position: relative;
  display: flex;
  align-items: stretch;
  gap: 4px;
  margin-left: -10px;
}

.rsn-hover-pill {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  border-radius: 6px;
  background: linear-gradient(
    180deg,
    rgba(249, 238, 223, 0.075) 0%,
    rgba(249, 238, 223, 0.03) 100%
  );
  border: 1px solid rgba(249, 238, 223, 0.11);
  pointer-events: none;
  z-index: 0;
  will-change: transform, width, opacity;
}

.rsn-active-glow {
  position: absolute;
  top: 5px;
  bottom: 5px;
  left: 0;
  border-radius: 6px;
  pointer-events: none;
  z-index: 0;
  background: linear-gradient(
    180deg,
    rgba(var(--nav-accent-rgb, 95, 255, 255), 0.07) 0%,
    rgba(var(--nav-accent-rgb, 95, 255, 255), 0.16) 100%
  );
  border: 1px solid rgba(var(--nav-accent-rgb, 95, 255, 255), 0.26);
  will-change: transform, width, opacity;
}

.rsn-active-rail {
  position: absolute;
  left: 0;
  bottom: 5px;
  height: 2px;
  border-radius: 999px;
  pointer-events: none;
  z-index: 2;
  background: rgb(var(--nav-accent-rgb, 95, 255, 255));
  box-shadow: 0 0 8px rgba(var(--nav-accent-rgb, 95, 255, 255), 0.55);
  will-change: transform, width, opacity;
}

.rsn-tab {
  position: relative;
  z-index: 1;
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
  transition: color 0.2s var(--ease);
}

.rsn-label {
  display: inline-block;
  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.rsn-tab:hover {
  color: var(--tx-1);
}

.rsn-tab:hover .rsn-label,
.rsn-tab.active .rsn-label {
  transform: translateY(-0.5px);
}

.rsn-tab.active {
  color: var(--cream);
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
  transition:
    border-color 0.22s var(--ease),
    color 0.22s var(--ease);
}

.rsn-tab.active .rsn-badge {
  border-color: rgba(95, 255, 255, 0.38);
  color: var(--c-raider);
}

@media (prefers-reduced-motion: reduce) {
  .rsn-tab,
  .rsn-label,
  .rsn-badge {
    transition: none;
  }
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
