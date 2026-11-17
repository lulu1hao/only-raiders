<script setup>
import { inject } from 'vue'
import {
  assetUrl,
  getAmpIconPath,
  resolveWeaponVisualState,
  slotLabels,
  modGrade,
  modColor,
  shortAmpName,
  getAmpRestrictionState,
} from '../../../composables/useWeaponCalculator'

const overlay = inject('weaponsOverlay')
const tone = inject('weaponsTone', (c) => c)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="overlay.menu.open"
      class="wm-backdrop"
      @click="overlay.closeMenu"
      @wheel.passive="overlay.closeMenu"
    ></div>

    <div
      v-if="overlay.menu.open && overlay.menuCtx.weapon"
      :ref="(el) => (overlay.menuEl = el)"
      class="wm-menu"
      :class="`is-${overlay.menu.type}`"
      :style="{
        left: `${overlay.menu.x}px`,
        top: `${overlay.menu.y}px`,
        minWidth: `${overlay.menu.minW}px`,
        maxHeight: `${overlay.menu.maxH || 520}px`,
      }"
    >
      <!-- Mod picker -->
      <template v-if="overlay.menu.type === 'mod'">
        <div class="wm-menu-head">
          <strong>{{ slotLabels[overlay.menu.slotKey]?.name || overlay.menu.slotKey }}</strong>
          <small>{{ slotLabels[overlay.menu.slotKey]?.rule }}</small>
        </div>
        <div class="mm-grid">
          <button
            class="mm-item none"
            :class="{ active: !overlay.menuCtx.mods[overlay.menu.slotKey] }"
            @click="overlay.equipMod(overlay.menu.slotKey, null)"
            @mouseenter="overlay.hideTip"
          >
            <span class="mm-none">∅</span>
            <span class="mm-name">不装配</span>
          </button>
          <button
            v-for="m in overlay.getCompatibleModsForSlot(overlay.menu.slotKey)"
            :key="m.id"
            class="mm-item"
            :class="{ active: overlay.menuCtx.mods[overlay.menu.slotKey] === m.id }"
            :style="{ '--g': tone(modColor(m)) }"
            @click="overlay.equipMod(overlay.menu.slotKey, m.id)"
            @mouseenter="overlay.showTip('mod', { mod: m, slotKey: overlay.menu.slotKey }, $event, overlay.menu.compareIdx)"
            @mouseleave="overlay.hideTip"
          >
            <img :src="assetUrl(m.image)" alt="" draggable="false" />
            <span v-if="modGrade(m)" class="mm-grade">{{ modGrade(m) }}</span>
            <span class="mm-name">{{ m.zhName }}</span>
          </button>
        </div>
      </template>

      <!-- Tier list -->
      <template v-else-if="overlay.menu.type === 'tier'">
        <div class="wm-menu-head">
          <strong>强化等级</strong>
          <small>{{ overlay.menuCtx.weapon.tiers.length > 1 ? '增强需满级' : '固定等级' }}</small>
        </div>
        <div class="dl">
          <button
            v-for="t in overlay.menuCtx.weapon.tiers"
            :key="t.tier"
            class="dl-item"
            :class="{ active: overlay.menuCtx.calc?.clampedTier === t.tier }"
            @click="overlay.pickTier(t.tier)"
            @mouseenter="overlay.showTip('tier', t, $event, overlay.menu.compareIdx)"
            @mouseleave="overlay.hideTip"
          >
            <span class="dl-radio"></span>
            <img
              class="dl-tier-thumb"
              :src="assetUrl(resolveWeaponVisualState(overlay.menuCtx.weapon, t.tier, []).hdImage)"
              alt=""
              draggable="false"
            />
            <span class="dl-body">
              <strong>
                TIER {{ t.roman }}
                <em v-if="t.sellPrice" class="dl-price">{{ t.sellPrice.toLocaleString() }} 币</em>
              </strong>
              <small>{{ t.zhEffects?.length ? t.zhEffects.slice(0, 3).join(' · ') : '标准面板' }}</small>
              <small v-if="t.zhMaterials" class="dl-meta">
                <i>{{ t.tier === 1 ? '锻造' : '升级' }}</i>{{ t.zhMaterials }}
              </small>
            </span>
          </button>
        </div>
      </template>

      <!-- Amplification list (multi-select) -->
      <template v-else-if="overlay.menu.type === 'amp'">
        <div class="wm-menu-head">
          <strong>5 级增强</strong>
          <small>可多选</small>
        </div>
        <div class="dl">
          <button
            v-for="amp in overlay.menuCtx.weapon.amplifications"
            :key="amp.id"
            class="dl-item amp"
            :class="{
              active: overlay.menuCtx.ampIds.includes(amp.id),
              conflicted:
                !overlay.menuCtx.ampIds.includes(amp.id) &&
                getAmpRestrictionState(overlay.menuCtx.weapon, amp, overlay.menuCtx.ampIds).activeConflicts.length > 0,
            }"
            @click="overlay.toggleMenuAmp(amp)"
            @mouseenter="overlay.showTip('amp', amp, $event, overlay.menu.compareIdx)"
            @mouseleave="overlay.hideTip"
          >
            <span class="dl-box"></span>
            <img
              class="dl-amp-icon"
              :src="assetUrl(getAmpIconPath(overlay.menuCtx.weapon.id, amp.id))"
              alt=""
              draggable="false"
            />
            <span class="dl-body">
              <strong>
                {{ shortAmpName(amp) }}
                <em
                  v-if="
                    !overlay.menuCtx.ampIds.includes(amp.id) &&
                    getAmpRestrictionState(overlay.menuCtx.weapon, amp, overlay.menuCtx.ampIds).activeConflicts.length
                  "
                  class="dl-tag conf"
                >互斥</em>
                <em
                  v-else-if="
                    !overlay.menuCtx.ampIds.includes(amp.id) &&
                    getAmpRestrictionState(overlay.menuCtx.weapon, amp, overlay.menuCtx.ampIds).missingReqs.length
                  "
                  class="dl-tag req"
                >需前置</em>
              </strong>
              <small>{{ (amp.zhEffects || []).slice(0, 2).join(' · ') }}</small>
              <small class="dl-meta">
                <i>研究</i>{{ (amp.zhResearch || amp.research)?.split(' (')[0] }}
                <i>材料</i>{{ amp.zhMaterials }}
              </small>
            </span>
          </button>
        </div>
      </template>
    </div>
  </Teleport>
</template>
