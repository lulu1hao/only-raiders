<script setup>
import { ref } from 'vue'

defineProps({
  activeNode: { type: Object, default: null },
  categoryMeta: { type: Object, required: true },
  isBlueGate: { type: Boolean, default: false },
  activeConnections: { type: Object, default: () => ({ outgoing: [], incoming: [] }) },
})

const emit = defineEmits(['select-node'])
const collapsed = ref(false)
</script>

<template>
  <div
    v-if="activeNode"
    class="inspector-card"
    :class="{ 'is-collapsed': collapsed }"
    :style="{ '--cat': categoryMeta[activeNode.category]?.color }"
  >
    <!-- Cream in-game inspect header -->
    <header
      class="insp-head"
      :title="collapsed ? '点击展开点位详情' : '点击收起点位详情'"
      @click="collapsed = !collapsed"
    >
      <div class="insp-top">
        <span class="insp-code ar-num">{{ activeNode.code }}</span>
        <span v-if="!collapsed" class="insp-cat">{{ categoryMeta[activeNode.category]?.label }}</span>
        <span v-else class="insp-collapsed-title">{{ activeNode.title }}</span>
        <span v-if="!collapsed" class="insp-coord ar-num" title="UE 坐标 (m)">
          {{ activeNode.x.toFixed(1) }}, {{ activeNode.y.toFixed(1) }}, {{ activeNode.z.toFixed(1) }}
        </span>
        <button
          type="button"
          class="insp-toggle-btn"
          :title="collapsed ? '展开详情卡片' : '收起详情卡片'"
          @click.stop="collapsed = !collapsed"
        >
          <span>{{ collapsed ? '展开' : '隐藏' }}</span>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path
              :d="collapsed ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
        </button>
      </div>
      <h2 v-if="!collapsed">{{ activeNode.title }}</h2>
    </header>

    <div v-if="!collapsed" class="insp-body">
      <div class="insp-req">
        <span class="req-label">{{ isBlueGate ? '属性' : '条件' }}</span>
        <span class="req-text">
          {{ isBlueGate ? `${activeNode.floor} · ${activeNode.requirement}` : activeNode.requirement }}
        </span>
      </div>
      <p class="insp-desc">{{ activeNode.description }}</p>

      <div
        v-if="activeConnections.outgoing.length || activeConnections.incoming.length"
        class="insp-links"
      >
        <div v-if="activeConnections.incoming.length" class="link-row">
          <span class="link-label" title="前置阶段 / 控制源">前置</span>
          <div class="link-pills">
            <button
              v-for="inc in activeConnections.incoming"
              :key="inc.id"
              class="link-pill"
              :title="inc.title"
              @click="emit('select-node', inc)"
            >
              <b>{{ inc.code }}</b>{{ inc.title }}
            </button>
          </div>
        </div>
        <div v-if="activeConnections.outgoing.length" class="link-row">
          <span class="link-label" title="后续联动 / 通往">后续</span>
          <div class="link-pills">
            <button
              v-for="out in activeConnections.outgoing"
              :key="out.id"
              class="link-pill"
              :title="out.title"
              @click="emit('select-node', out)"
            >
              <b>{{ out.code }}</b>{{ out.title }}
            </button>
          </div>
        </div>
      </div>

      <div v-if="!isBlueGate && activeNode.subtitle" class="insp-asset" title="资产标识">
        {{ activeNode.subtitle }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.inspector-card {
  position: absolute;
  right: 12px;
  bottom: 46px;
  width: 380px;
  max-height: calc(100% - 120px);
  display: flex;
  flex-direction: column;
  border-radius: var(--radius);
  overflow: hidden;
  background: rgba(9, 12, 25, 0.94);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px var(--line);
  backdrop-filter: blur(8px);
  transition: width 0.2s var(--ease);
}

.inspector-card.is-collapsed {
  width: auto;
  max-width: 320px;
}

.insp-head {
  flex: 0 0 auto;
  padding: 10px 14px 12px;
  background: var(--cream);
  color: var(--ink);
  box-shadow: inset 0 4px 0 var(--cat, var(--amber));
  cursor: pointer;
  user-select: none;
}

.inspector-card.is-collapsed .insp-head {
  padding: 8px 12px;
}

.insp-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.inspector-card.is-collapsed .insp-top {
  margin-top: 0;
}

.insp-code {
  flex: 0 0 auto;
  height: 20px;
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  border-radius: 3px;
  background: var(--ink);
  color: var(--cream);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.insp-cat {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--ink-2);
}

.insp-collapsed-title {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.insp-coord {
  margin-left: auto;
  font-size: 12px;
  color: var(--ink-3);
}

.insp-toggle-btn {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid rgba(9, 12, 25, 0.22);
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.08);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.insp-coord + .insp-toggle-btn {
  margin-left: 4px;
}

.insp-toggle-btn:hover {
  background: var(--ink);
  color: var(--cream);
}

.insp-head h2 {
  margin: 6px 0 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.02em;
  color: var(--ink);
}

.insp-body {
  min-height: 0;
  overflow-y: auto;
  padding: 12px 14px 12px;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-hover) transparent;
}

.insp-req {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 7px 10px;
  background: var(--bg-2);
  border-radius: var(--radius-sm);
  box-shadow: inset 3px 0 0 var(--amber);
}

.req-label {
  flex: 0 0 auto;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--amber);
}

.req-text {
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--tx-1);
}

.insp-desc {
  margin: 10px 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--tx-2);
}

.insp-links {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-row {
  display: grid;
  grid-template-columns: 34px 1fr;
  align-items: start;
  gap: 6px;
}

.link-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.link-label {
  line-height: 24px;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--tx-3);
}

.link-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  max-width: 100%;
  height: 24px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-3);
  color: var(--tx-1);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.link-pill b {
  font-family: var(--font-display);
  font-weight: 700;
  color: var(--amber);
}

.link-pill:hover {
  background: var(--cream);
  color: var(--ink);
}

.link-pill:hover b {
  color: var(--ink);
}

.insp-asset {
  margin-top: 10px;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 10.5px;
  color: var(--tx-3);
  opacity: 0.8;
  word-break: break-all;
}
</style>
