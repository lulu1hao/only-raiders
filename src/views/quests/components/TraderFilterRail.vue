<script setup>
import { useQuestsStore } from '../../../stores/useQuestsStore'
import { assetUrl } from '../../../utils/questItemIcons'

const store = useQuestsStore()
</script>

<template>
  <aside class="q-rail ar-panel">
    <div class="rail-head">
      <span class="ar-label">{{ store.questSubTab === 'trader' ? '商人委托' : '赛季活动战役' }}</span>
      <span class="rail-sub">{{ store.questSubTab === 'trader' ? '5 位联络人' : '7 大行动' }}</span>
    </div>

    <!-- Trader Filter List (with real in-game trader portraits) -->
    <div v-if="store.questSubTab === 'trader'" class="rail-list">
      <button
        class="rail-item ar-row"
        :class="{ active: store.activeTrader === 'ALL' }"
        @click="store.activeTrader = 'ALL'"
      >
        <div class="ri-main">
          <div class="ri-avatar ri-avatar--all">
            <img :src="assetUrl('/game-maps/icons/T_UI_Icon_Quest.png')" alt="全部商人" />
          </div>
          <div class="ri-info">
            <div class="ri-title-row">
              <strong>全部商人任务</strong>
              <span class="ri-num ar-num">{{ store.traderQuests.length }}</span>
            </div>
            <span class="ri-role">斯佩兰扎全部常驻委托</span>
          </div>
        </div>
      </button>

      <button
        v-for="t in store.traderStats"
        :key="t.id"
        class="rail-item ar-row"
        :class="{ active: store.activeTrader === t.id }"
        :style="{ '--tr-c': t.color }"
        :title="`${t.name} (${t.en}) · ${t.role}`"
        @click="store.activeTrader = t.id"
      >
        <div class="ri-main">
          <div class="ri-avatar">
            <img :src="assetUrl(t.avatar)" :alt="t.name" loading="lazy" />
            <i class="ri-badge-dot" :style="{ background: t.color }"></i>
          </div>
          <div class="ri-info">
            <div class="ri-title-row">
              <strong>{{ t.name }}</strong>
              <span class="ri-num ar-num">{{ t.done }}<small>/{{ t.total }}</small></span>
            </div>
            <span class="ri-role">{{ t.role }}</span>
          </div>
        </div>
        <span class="ri-bar">
          <b :style="{ width: t.pct + '%', background: t.color }"></b>
        </span>
      </button>
    </div>

    <!-- Event Campaign Filter List (with real in-game campaign thumbnails & icons) -->
    <div v-else class="rail-list">
      <button
        class="rail-item ar-row"
        :class="{ active: store.activeEventCampaign === 'ALL' }"
        @click="store.activeEventCampaign = 'ALL'"
      >
        <div class="ri-main">
          <div class="ri-avatar ri-avatar--all">
            <img :src="assetUrl('/game-maps/icons/T_Icon_Event.png')" alt="全部赛季活动" />
          </div>
          <div class="ri-info">
            <div class="ri-title-row">
              <strong>全部赛季活动</strong>
              <span class="ri-num ar-num">{{ store.eventQuests.length }}</span>
            </div>
            <span class="ri-role">全部限时与赛季剧情线</span>
          </div>
        </div>
      </button>

      <button
        v-for="c in store.eventCampaignStats"
        :key="c.id"
        class="rail-item ar-row"
        :class="{ active: store.activeEventCampaign === c.id }"
        :style="{ '--tr-c': c.color }"
        :title="`${c.label} · ${c.sub}`"
        @click="store.activeEventCampaign = c.id"
      >
        <div class="ri-main">
          <div class="ri-banner">
            <img :src="assetUrl(c.image)" :alt="c.label" class="ri-banner-img" loading="lazy" />
            <span v-if="c.icon" class="ri-banner-icon">
              <img :src="assetUrl(c.icon)" alt="" />
            </span>
          </div>
          <div class="ri-info">
            <div class="ri-title-row">
              <strong>{{ c.label }}</strong>
              <span class="ri-num ar-num">{{ c.done }}<small>/{{ c.total }}</small></span>
            </div>
            <span class="ri-role">{{ c.sub }}</span>
          </div>
        </div>
        <span class="ri-bar">
          <b :style="{ width: c.pct + '%', background: c.color }"></b>
        </span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.q-rail {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.rail-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--line);
}

.rail-sub {
  font-size: 11px;
  color: var(--tx-3);
}

.rail-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 4px 0;
}

.rail-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--line-subtle);
  text-align: left;
  cursor: pointer;
  color: var(--tx-2);
  font-family: var(--font-body);
}

.rail-item:last-child {
  border-bottom: none;
}

.rail-item.active {
  color: var(--tx-1);
}

.ri-main {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
}

/* Trader Portrait Avatar */
.ri-avatar {
  position: relative;
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background: var(--bg-2);
  border: 1.5px solid color-mix(in srgb, var(--tr-c, var(--line-strong)) 55%, transparent);
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rail-item.active .ri-avatar {
  border-color: var(--tr-c, var(--amber));
  box-shadow: 0 0 10px color-mix(in srgb, var(--tr-c, var(--amber)) 32%, transparent);
}

.ri-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ri-avatar--all {
  padding: 8px;
  border-color: var(--line-strong);
}

.ri-avatar--all img {
  object-fit: contain;
  opacity: 0.9;
}

.ri-badge-dot {
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: 0 0 0 1.5px var(--bg-1);
}

/* Event Campaign Thumbnail Banner */
.ri-banner {
  position: relative;
  width: 52px;
  height: 38px;
  border-radius: 5px;
  background: var(--bg-2);
  border: 1px solid color-mix(in srgb, var(--tr-c, var(--line-strong)) 50%, transparent);
  overflow: hidden;
  flex-shrink: 0;
}

.rail-item.active .ri-banner {
  border-color: var(--tr-c, var(--amber));
}

.ri-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ri-banner-icon {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background: rgba(9, 12, 25, 0.85);
  padding: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ri-banner-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.ri-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ri-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.ri-title-row strong {
  font-size: 14px;
  font-weight: 700;
  color: var(--tx-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ri-role {
  font-size: 11.5px;
  color: var(--tx-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ri-num {
  font-size: 14px;
  color: var(--tx-1);
  flex-shrink: 0;
}

.ri-num small {
  font-size: 11px;
  color: var(--tx-3);
}

.ri-bar {
  display: block;
  height: 2px;
  background: var(--line);
  border-radius: 1px;
  overflow: hidden;
}

.ri-bar b {
  display: block;
  height: 100%;
  background: var(--amber);
}
</style>
