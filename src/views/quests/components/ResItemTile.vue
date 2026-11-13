<script setup>
import { computed } from 'vue'
import { assetUrl, resolveItemIconUrl } from '../../../utils/questItemIcons'

/**
 * 统一的道具格子：图标 + 数量角标 + 名称。
 * 用于升级材料、制造配方、奖励、喂食掉落等所有「道具清单」场景。
 */
const props = defineProps({
  item: { type: Object, required: true },
  /** 角标文本，默认取 item.count（数字前自动加 ×） */
  badge: { type: [String, Number], default: undefined },
  active: { type: Boolean, default: false },
  clickable: { type: Boolean, default: false },
  /** 显示地图图钉角标（该道具有可跳转的地图点位） */
  pin: { type: Boolean, default: false },
})

defineEmits(['select'])

const icon = computed(() => {
  const it = props.item
  if (it.icon) return assetUrl(it.icon)
  return resolveItemIconUrl(it.enName || it.zhName || it.name || it.item)
})

const name = computed(() => {
  const it = props.item
  return it.zhName || it.name || String(it.item || '').split(' (')[0]
})

const badgeText = computed(() => {
  if (props.badge !== undefined) return props.badge
  const c = props.item.count
  return typeof c === 'number' ? `×${c}` : ''
})

const rarityClass = computed(() => (props.item.rarity ? `rc-${props.item.rarity}` : ''))
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="res-tile"
    :class="[rarityClass, { active, clickable }]"
    :title="item.enName ? `${name} · ${item.enName}` : name"
    @click="clickable && $emit('select', item)"
  >
    <span class="rt-thumb">
      <img :src="icon" :alt="name" loading="lazy" />
      <b v-if="badgeText" class="rt-qty">{{ badgeText }}</b>
      <i v-if="pin" class="rt-pin" aria-label="可在地图中找到">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 3.2 4.5 8.5 4.5 8.5s4.5-5.3 4.5-8.5A4.5 4.5 0 0 0 8 1.5zm0 6.2a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z"
            fill="currentColor"
          />
        </svg>
      </i>
    </span>
    <span class="rt-name">{{ name }}</span>
  </component>
</template>

<style scoped>
.res-tile {
  --rc: var(--line-strong);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 0;
  padding: 7px 6px 8px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  color: var(--tx-1);
  text-align: center;
}

.res-tile.clickable {
  cursor: pointer;
  transition: border-color 0.14s, background 0.14s;
}

.res-tile.clickable:hover {
  border-color: var(--amber);
  background: var(--bg-3);
}

.res-tile.active {
  border-color: var(--amber);
  background: color-mix(in srgb, var(--amber) 12%, var(--bg-2));
}

.rt-thumb {
  position: relative;
  width: 100%;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: radial-gradient(circle at 50% 50%, rgba(255, 244, 224, 0.08) 0%, rgba(9, 12, 25, 0.55) 100%);
  box-shadow: inset 0 -2px 0 var(--rc);
}

.rt-thumb img {
  max-width: 44px;
  max-height: 44px;
  object-fit: contain;
}

.rt-qty {
  position: absolute;
  right: 3px;
  bottom: 3px;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(9, 12, 25, 0.88);
  color: var(--amber);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
}

.rt-pin {
  position: absolute;
  left: 3px;
  top: 3px;
  display: inline-flex;
  width: 15px;
  height: 15px;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  background: rgba(9, 12, 25, 0.85);
  color: var(--c-maps);
}

.rt-pin svg {
  width: 11px;
  height: 11px;
}

.rt-name {
  width: 100%;
  font-size: 11.5px;
  line-height: 1.25;
  color: var(--tx-1);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
