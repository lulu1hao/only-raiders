<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRaiderStore } from '../../../stores/useRaiderStore'

const store = useRaiderStore()

const modalState = computed(() => store.activeGateModalState)

const branchInfo = computed(() => {
  if (!modalState.value) return null
  return store.branchMap[modalState.value.node.branch] || null
})

const ruleTitle = computed(() => {
  if (!modalState.value) return ''
  const n = modalState.value.node
  return `${n.candidateIds?.length || 2} 选 ${n.maxSelectable || 1}`
})

const candidates = computed(() => {
  if (!modalState.value) return []
  const node = modalState.value.node
  const tree = store.currentTree
  const currentSelectedId = store.currentBuild.gateSelections?.[node.slotKey] || null

  return (node.candidateIds || [])
    .map((cid) => {
      const sk = tree.skills[cid]
      if (!sk) return null

      let usedInSiblingSlot = false
      for (const other of tree.nodes) {
        if (
          other.groupId === node.groupId &&
          other.slotKey !== node.slotKey &&
          store.currentBuild.gateSelections?.[other.slotKey] === cid
        ) {
          usedInSiblingSlot = true
        }
      }

      const isCurrent = currentSelectedId === cid
      const lv0 = sk.levels?.[0] || null
      const canEquip =
        !isCurrent &&
        !usedInSiblingSlot &&
        modalState.value.prerequisitesMet &&
        (currentSelectedId ? true : store.remainingPoints > 0)

      return {
        skill: sk,
        lv0,
        isCurrent,
        usedInSiblingSlot,
        canEquip,
      }
    })
    .filter(Boolean)
})

function onPick(item) {
  if (!modalState.value || !item) return
  if (item.isCurrent) {
    store.closeGateModal()
    return
  }
  store.selectGateSkill(modalState.value.node.nodeId, item.skill.id)
}

function onClearSlot() {
  if (!modalState.value) return
  if (store.clearGateSlot(modalState.value.node.slotKey)) {
    store.closeGateModal()
  }
}

function onKeyDown(e) {
  if (e.key === 'Escape' && store.activeGateModalNodeId !== null) {
    store.closeGateModal()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <Teleport to="body">
    <Transition name="gate-fade">
      <div
        v-if="modalState"
        class="gate-modal-backdrop"
        @click.self="store.closeGateModal()"
      >
        <div
          class="gate-modal-panel"
          :class="{ 'is-tri-grid': candidates.length === 3 }"
          :style="{ '--b-col': branchInfo?.color || '#5fffff' }"
          role="dialog"
          aria-modal="true"
        >
          <div class="gate-accent-bar"></div>

          <header class="gate-header">
            <div class="gate-header-left">
              <span class="gate-branch-tag">{{ branchInfo?.name }}</span>
              <h2 class="gate-title">
                {{
                  modalState.node.kind === 'choice'
                    ? '10P 互斥门控'
                    : `${modalState.node.minBranchPoints}P 终极槽 #${modalState.node.slotIndex + 1}`
                }}
                <em>{{ ruleTitle }}</em>
              </h2>
            </div>

            <div class="gate-header-right">
              <div
                class="gate-progress-pill"
                :class="{ ready: modalState.prerequisitesMet }"
              >
                <strong>{{ modalState.requiredPoolPts }} / {{ modalState.node.minBranchPoints }} P</strong>
              </div>
              <button
                v-if="modalState.skill"
                type="button"
                class="unequip-btn"
                @click="onClearSlot"
              >
                卸下 (+1P)
              </button>
              <button type="button" class="gate-close-btn" @click="store.closeGateModal()">
                ✕
              </button>
            </div>
          </header>

          <div v-if="!modalState.prerequisitesMet" class="gate-lock-banner">
            {{ modalState.lockReason }}
          </div>

          <div class="gate-cards-grid">
            <article
              v-for="item in candidates"
              :key="item.skill.id"
              class="gate-card"
              :class="{
                'is-equipped': item.isCurrent,
                'is-sibling-locked': item.usedInSiblingSlot,
                'is-equipable': item.canEquip,
              }"
              @click="onPick(item)"
            >
              <div class="card-top">
                <div class="card-icon-box">
                  <img :src="item.skill.icon" :alt="item.skill.name" />
                </div>
                <div class="card-head-meta">
                  <span v-if="item.isCurrent" class="status-chip equipped">已装备</span>
                  <span v-else-if="item.usedInSiblingSlot" class="status-chip mutex">已占用</span>
                  <span v-else class="status-chip neutral">1 P</span>
                  <h3 class="card-name">{{ item.skill.name }}</h3>
                </div>
              </div>

              <div class="card-data-box">
                <div class="data-metric">{{ item.skill.statLabel }}</div>
                <div class="data-val-row">
                  <strong class="data-val">{{ item.lv0?.display || item.skill.badge }}</strong>
                  <span v-if="item.lv0?.note" class="data-note">{{ item.lv0.note }}</span>
                </div>
                <div v-if="item.skill.warningText" class="data-warn">
                  ⚠ {{ item.skill.warningText }}
                </div>

                <div
                  v-if="item.skill.unlockedItems && item.skill.unlockedItems.length"
                  class="recipe-chips"
                >
                  <span
                    v-for="rc in item.skill.unlockedItems"
                    :key="rc.name"
                    class="recipe-chip"
                  >
                    <img v-if="rc.icon" :src="rc.icon" :alt="rc.name" />
                    <span>{{ rc.name }}</span>
                  </span>
                </div>
              </div>

              <button
                v-if="item.isCurrent"
                type="button"
                class="pick-btn current"
                @click.stop="store.closeGateModal()"
              >
                ✓ 已激活
              </button>
              <button
                v-else-if="item.usedInSiblingSlot"
                type="button"
                class="pick-btn locked"
                @click.stop="onPick(item)"
              >
                相邻槽已装备
              </button>
              <button
                v-else
                type="button"
                class="pick-btn"
                :class="item.canEquip ? 'primary' : 'locked'"
                @click.stop="onPick(item)"
              >
                {{
                  !modalState.prerequisitesMet
                    ? '前置不足'
                    : modalState.skill
                      ? '切换'
                      : store.remainingPoints > 0
                        ? '解锁 (-1P)'
                        : '点数不足'
                }}
              </button>
            </article>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.gate-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 220;
  background: rgba(6, 8, 17, 0.8);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.gate-modal-panel {
  width: 100%;
  max-width: 640px;
  background: var(--bg-panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.78);
  overflow: hidden;
}

.gate-modal-panel.is-tri-grid {
  max-width: 900px;
}

.gate-accent-bar {
  height: 3px;
  background: var(--b-col);
}

.gate-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}

.gate-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.gate-branch-tag {
  padding: 2px 8px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--b-col) 16%, transparent);
  border: 1px solid color-mix(in srgb, var(--b-col) 50%, transparent);
  color: var(--b-col);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
}

.gate-title {
  margin: 0;
  font-family: var(--font-title);
  font-size: 16.5px;
  font-weight: 800;
  color: var(--cream);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.gate-title em {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--bg-2);
  color: var(--c-raider);
}

.gate-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gate-progress-pill {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 48, 38, 0.12);
  border: 1px solid rgba(255, 48, 38, 0.4);
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--cream);
}

.gate-progress-pill.ready {
  background: rgba(38, 191, 87, 0.14);
  border-color: rgba(38, 191, 87, 0.45);
}

.unequip-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 48, 38, 0.45);
  background: rgba(255, 48, 38, 0.12);
  color: #ff6b63;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.gate-close-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--tx-2);
  cursor: pointer;
}

.gate-lock-banner {
  margin: 10px 18px 0;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  background: rgba(255, 188, 19, 0.1);
  border: 1px solid rgba(255, 188, 19, 0.34);
  color: var(--amber);
  font-size: 12px;
  font-weight: 700;
}

.gate-cards-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 14px 18px 18px;
}

.is-tri-grid .gate-cards-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 820px) {
  .gate-cards-grid,
  .is-tri-grid .gate-cards-grid {
    grid-template-columns: 1fr;
  }
}

.gate-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 13px;
  border-radius: var(--radius);
  background: var(--bg-card);
  border: 1px solid var(--line-strong);
  cursor: pointer;
  transition: border-color 0.14s var(--ease), background 0.14s var(--ease);
}

.gate-card:hover {
  border-color: color-mix(in srgb, var(--b-col) 65%, var(--cream));
}

.gate-card.is-equipped {
  border-color: var(--b-col);
}

.gate-card.is-sibling-locked {
  opacity: 0.6;
}

.card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-icon-box {
  width: 48px;
  height: 48px;
  border-radius: 9px;
  background: var(--bg-0);
  border: 1.5px solid color-mix(in srgb, var(--b-col) 55%, #4a5064);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-icon-box img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.status-chip {
  display: inline-block;
  padding: 0 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  margin-bottom: 2px;
}

.status-chip.equipped {
  background: color-mix(in srgb, var(--b-col) 22%, transparent);
  color: var(--b-col);
  border: 1px solid var(--b-col);
}

.status-chip.mutex {
  background: rgba(255, 48, 38, 0.15);
  color: #ff6b63;
}

.status-chip.neutral {
  background: rgba(255, 255, 255, 0.07);
  color: var(--tx-3);
}

.card-name {
  margin: 0;
  font-family: var(--font-title);
  font-size: 15.5px;
  font-weight: 800;
  color: var(--cream);
}

.card-data-box {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  background: rgba(9, 12, 25, 0.72);
  border: 1px solid var(--line);
}

.data-metric {
  font-size: 11.5px;
  color: var(--tx-3);
}

.data-val-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.data-val {
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 800;
  color: var(--b-col);
}

.data-note {
  font-size: 11px;
  color: var(--tx-2);
}

.data-warn {
  font-size: 11px;
  font-weight: 700;
  color: var(--amber);
}

.recipe-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.recipe-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--bg-2);
  border: 1px solid var(--line);
  font-size: 11px;
  color: var(--cream-2);
}

.recipe-chip img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.pick-btn {
  width: 100%;
  height: 32px;
  border-radius: var(--radius-sm);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 800;
  cursor: pointer;
}

.pick-btn.primary {
  background: var(--b-col);
  border: 1px solid var(--b-col);
  color: var(--ink);
}

.pick-btn.locked {
  background: var(--bg-2);
  border: 1px solid var(--line);
  color: var(--tx-3);
}

.pick-btn.current {
  background: color-mix(in srgb, var(--b-col) 16%, var(--bg-2));
  border: 1px solid var(--b-col);
  color: var(--b-col);
}

.gate-fade-enter-active,
.gate-fade-leave-active {
  transition: opacity 0.16s ease;
}
.gate-fade-enter-from,
.gate-fade-leave-to {
  opacity: 0;
}
</style>
