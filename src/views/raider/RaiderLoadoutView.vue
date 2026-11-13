<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRaiderLoadoutStore } from '../../stores/useRaiderLoadoutStore'
import { modColor } from '../../composables/useWeaponCalculator'
import {
  activeLoadoutDrag,
  clearLoadoutDrag,
  readLoadoutDrag,
  startLoadoutDrag,
} from './composables/useLoadoutDrag'
import LoadoutPickerSidebar from './components/LoadoutPickerSidebar.vue'

const route = useRoute()
const router = useRouter()
const store = useRaiderLoadoutStore()

const sidebarRef = ref(null)
const hoverDropTarget = ref(null)

const aug = computed(() => store.activeAugment)
const sh = computed(() => store.activeShield)
const sel = computed(() => store.selectedSlot)
const slotIcons = computed(() => store.data.slotIcons)

const filledBackpackCount = computed(
  () => store.backpackSlotsView.filter((s) => Boolean(s.item)).length,
)
const filledQuickUseCount = computed(
  () => store.quickUseSlotsView.filter((s) => Boolean(s.item)).length,
)
const totalAuxDisplayCount = computed(
  () => (aug.value.integratedItem ? 1 : 0) + store.auxSlotsView.length,
)
const filledAuxDisplayCount = computed(
  () =>
    (aug.value.integratedItem ? 1 : 0) +
    store.auxSlotsView.filter((s) => Boolean(s.item)).length,
)
const filledSafePocketCount = computed(
  () => store.safePocketSlotsView.filter((s) => Boolean(s.item)).length,
)

const auxCategoryPlaceholder = computed(() => {
  const key = aug.value.auxSlots?.slotKey
  if (key === 'aux_grenade') return store.assetUrl(slotIcons.value.auxGrenade)
  if (key === 'aux_healing') return store.assetUrl(slotIcons.value.auxHealing)
  if (key === 'aux_utility') return store.assetUrl(slotIcons.value.auxUtility)
  if (key === 'aux_trinket') return store.assetUrl(slotIcons.value.auxTrinket)
  return store.assetUrl(slotIcons.value.quickUse)
})

function modSilhouetteUrl(slotKey) {
  return store.assetUrl(
    slotIcons.value.modSlots?.[slotKey] || '/items/T_UI_Mods_Muzzle.png',
  )
}

function isSlotFocused(kind, index = 0) {
  if (sel.value.kind !== kind) return false
  if (kind === 'augment' || kind === 'shield') return true
  return sel.value.index === index
}

function focusWeaponModSlot(weaponIdx, modSlotKey) {
  store.selectSlot({
    kind: 'weapon',
    index: weaponIdx,
    subMode: 'mod',
    modSlotKey,
  })
}

function focusWeaponAmp(weaponIdx) {
  store.selectSlot({
    kind: 'weapon',
    index: weaponIdx,
    subMode: 'amp',
  })
}

/* =========================================================================
   Drag & Drop Handlers (Weapons, Weapon Mods, and All Item Containers)
   ========================================================================= */
function targetKey(kind, a = 0, b = '') {
  return `${kind}:${a}:${b}`
}

function onDragEndGlobal() {
  hoverDropTarget.value = null
  clearLoadoutDrag()
}

// 1. Augment & Shield Drop
function canDropOnGear(gearKind, drag) {
  if (!drag) return false
  if (gearKind === 'augment') return drag.kind === 'picker-augment'
  if (gearKind === 'shield') {
    return (
      drag.kind === 'picker-shield' &&
      aug.value.allowedShields.includes(drag.shieldId)
    )
  }
  return false
}

function onGearDragOver(e, gearKind) {
  const drag = activeLoadoutDrag.value
  if (!drag) return
  if (
    (gearKind === 'augment' && drag.kind === 'picker-augment') ||
    (gearKind === 'shield' && drag.kind === 'picker-shield')
  ) {
    e.preventDefault()
    const valid = canDropOnGear(gearKind, drag)
    hoverDropTarget.value = { key: targetKey(gearKind), valid }
  }
}

function onGearDrop(e, gearKind) {
  e.preventDefault()
  const drag = readLoadoutDrag(e)
  hoverDropTarget.value = null
  clearLoadoutDrag()
  if (!drag) return
  if (gearKind === 'augment' && drag.kind === 'picker-augment') {
    store.setAugment(drag.augmentId)
  } else if (gearKind === 'shield' && drag.kind === 'picker-shield') {
    store.setShield(drag.shieldId)
  }
}

// 2. Weapon Card Drag & Drop (Swap Weapon 0 <-> Weapon 1, or Drop from Sidebar)
function onWeaponDragStart(e, wIdx) {
  if (!store.weaponDetails[wIdx]) {
    e.preventDefault()
    return
  }
  startLoadoutDrag(e, { kind: 'slot-weapon', weaponIndex: wIdx })
}

function canDropOnWeapon(wIdx, drag) {
  if (!drag) return false
  if (drag.kind === 'slot-weapon') return drag.weaponIndex !== wIdx
  if (drag.kind === 'picker-weapon') return true
  if (drag.kind === 'picker-mod') {
    const wd = store.weaponDetails[wIdx]
    return Boolean(
      wd &&
        wd.weapon.modSlots?.includes(drag.modSlotKey) &&
        !wd.lockedSlots[drag.modSlotKey],
    )
  }
  return false
}

function onWeaponDragOver(e, wIdx) {
  const drag = activeLoadoutDrag.value
  if (!drag) return
  if (
    drag.kind === 'slot-weapon' ||
    drag.kind === 'picker-weapon' ||
    drag.kind === 'picker-mod'
  ) {
    e.preventDefault()
    const valid = canDropOnWeapon(wIdx, drag)
    hoverDropTarget.value = { key: targetKey('weapon', wIdx), valid }
  }
}

function onWeaponDrop(e, wIdx) {
  e.preventDefault()
  const drag = readLoadoutDrag(e)
  hoverDropTarget.value = null
  clearLoadoutDrag()
  if (!drag) return
  if (drag.kind === 'slot-weapon') {
    store.moveOrSwapWeapons(drag.weaponIndex, wIdx)
  } else if (drag.kind === 'picker-weapon') {
    store.setWeapon(wIdx, drag.weaponId)
    store.selectSlot({ kind: 'weapon', index: wIdx, subMode: 'weapon' })
  } else if (drag.kind === 'picker-mod') {
    store.setWeaponMod(wIdx, drag.modSlotKey, drag.modId)
  }
}

// 3. Weapon Mod Box Drag & Drop
function onModDragStart(e, wIdx, sk) {
  const modId = store.weaponDetails[wIdx]?.entry?.mods?.[sk]
  if (!modId) {
    e.preventDefault()
    return
  }
  e.stopPropagation()
  startLoadoutDrag(e, {
    kind: 'slot-mod',
    weaponIndex: wIdx,
    modSlotKey: sk,
    modId,
  })
}

function canDropOnModBox(wIdx, sk, drag) {
  if (!drag) return false
  const wd = store.weaponDetails[wIdx]
  if (!wd || wd.lockedSlots[sk]) return false
  if (drag.kind === 'picker-mod') {
    return store
      .getCompatibleModsForSlot(sk)
      .some((m) => m.id === drag.modId)
  }
  if (drag.kind === 'slot-mod') {
    if (drag.weaponIndex === wIdx && drag.modSlotKey === sk) return false
    return store
      .getCompatibleModsForSlot(sk)
      .some((m) => m.id === drag.modId)
  }
  return false
}

function onModDragOver(e, wIdx, sk) {
  const drag = activeLoadoutDrag.value
  if (!drag || (drag.kind !== 'picker-mod' && drag.kind !== 'slot-mod')) return
  e.preventDefault()
  e.stopPropagation()
  const valid = canDropOnModBox(wIdx, sk, drag)
  hoverDropTarget.value = { key: targetKey('mod', wIdx, sk), valid }
}

function onModDrop(e, wIdx, sk) {
  e.preventDefault()
  e.stopPropagation()
  const drag = readLoadoutDrag(e)
  hoverDropTarget.value = null
  clearLoadoutDrag()
  if (!drag) return
  if (drag.kind === 'picker-mod') {
    store.setWeaponMod(wIdx, sk, drag.modId)
  } else if (drag.kind === 'slot-mod') {
    store.moveOrSwapWeaponMods(drag.weaponIndex, drag.modSlotKey, wIdx, sk)
  }
}

// 4. Universal Item Tile Drag & Drop (backpack / quickUse / aux / safePocket)
function onItemTileDragStart(e, container, idx, itemObj) {
  if (!itemObj) {
    e.preventDefault()
    return
  }
  startLoadoutDrag(e, {
    kind: 'slot-item',
    container,
    index: idx,
    itemId: itemObj.id,
  })
}

function canDropOnItemTile(container, idx, drag) {
  if (!drag) return false
  if (drag.kind === 'slot-item') {
    return store.canMoveOrSwapItems(drag.container, drag.index, container, idx)
  }
  if (drag.kind === 'picker-item') {
    return store.canContainerAcceptItem(container, drag.itemId)
  }
  return false
}

function onItemTileDragOver(e, container, idx) {
  const drag = activeLoadoutDrag.value
  if (!drag || (drag.kind !== 'slot-item' && drag.kind !== 'picker-item')) return
  e.preventDefault()
  const valid = canDropOnItemTile(container, idx, drag)
  hoverDropTarget.value = { key: targetKey(container, idx), valid }
}

function onItemTileDrop(e, container, idx) {
  e.preventDefault()
  const drag = readLoadoutDrag(e)
  hoverDropTarget.value = null
  clearLoadoutDrag()
  if (!drag) return
  if (drag.kind === 'slot-item') {
    store.moveOrSwapItems(drag.container, drag.index, container, idx)
  } else if (drag.kind === 'picker-item') {
    if (store.setContainerItem(container, idx, drag.itemId, null, false)) {
      store.selectSlot({ kind: container, index: idx })
    }
  }
}

function dropStateClass(kind, a = 0, b = '') {
  const cur = hoverDropTarget.value
  if (!cur || cur.key !== targetKey(kind, a, b)) return ''
  return cur.valid ? 'is-drop-valid' : 'is-drop-invalid'
}

function onDragLeaveKey(kind, a = 0, b = '') {
  if (hoverDropTarget.value?.key === targetKey(kind, a, b)) {
    hoverDropTarget.value = null
  }
}

/* =========================================================================
   Global Paste -> Inline Sidebar Vision Import
   ========================================================================= */
function onPagePaste(e) {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const blob = it.getAsFile()
      if (blob) {
        e.preventDefault()
        sidebarRef.value?.openAndProcessImage?.(blob)
        return
      }
    }
  }
}

onMounted(() => {
  if (route.query.loadout) {
    const ok = store.importShareCode(String(route.query.loadout))
    if (ok) {
      router.replace({ path: '/raider/loadout' })
    }
  }
  window.addEventListener('paste', onPagePaste)
  window.addEventListener('dragend', onDragEndGlobal)
})

onBeforeUnmount(() => {
  window.removeEventListener('paste', onPagePaste)
  window.removeEventListener('dragend', onDragEndGlobal)
})
</script>

<template>
  <main class="loadout-page">
    <div class="loadout-workspace">
      <!-- Center Game-Authentic 3-Column Loadout Stage -->
      <section class="loadout-stage">
        <div class="ld-board-scroll">
          <div class="ld-board">
            <!-- =====================================================
                 COLUMN 1: 装备 (Augment + Shield + Weapon 1 & 2)
                 ===================================================== -->
            <section class="ld-col col-equip">
              <header class="sec-head">
                <h2 class="sec-title">装备</h2>
              </header>

              <!-- Top Row: Augment + Shield -->
              <div class="equip-top-pair">
                <!-- Augment Card -->
                <div
                  class="arc-card gear-card"
                  :class="[
                    {
                      'is-selected': isSlotFocused('augment'),
                      'is-empty': aug.id === 'none',
                    },
                    dropStateClass('augment'),
                  ]"
                  :style="{
                    '--rc':
                      aug.id !== 'none'
                        ? store.rarityMeta[aug.rarity]?.color || '#a4a5aa'
                        : '#2a344a',
                  }"
                  :title="
                    aug.id !== 'none'
                      ? `${aug.zhName}（右键卸下）`
                      : '点击选择强化'
                  "
                  @click="store.selectSlot({ kind: 'augment' })"
                  @contextmenu.prevent="store.setAugment('none')"
                  @dragover="onGearDragOver($event, 'augment')"
                  @dragleave="onDragLeaveKey('augment')"
                  @drop="onGearDrop($event, 'augment')"
                >
                  <template v-if="aug.id !== 'none'">
                    <div class="gear-art">
                      <img
                        :src="store.assetUrl(aug.icon)"
                        :alt="aug.zhName"
                        draggable="false"
                      />
                    </div>
                    <svg
                      class="rarity-wedge"
                      viewBox="0 0 36 44"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M0,0 C2,24 14,40 36,44 L0,44 Z" fill="currentColor" />
                    </svg>
                    <footer class="card-foot">
                      <img
                        :src="store.assetUrl(slotIcons.augment)"
                        alt=""
                        class="foot-cat-ico"
                        draggable="false"
                      />
                      <span class="foot-val ar-num">100/100</span>
                    </footer>
                  </template>

                  <div v-else class="empty-center">
                    <img
                      :src="store.assetUrl(slotIcons.augment)"
                      alt=""
                      class="empty-sil"
                      draggable="false"
                    />
                  </div>
                </div>

                <!-- Shield Card -->
                <div
                  class="arc-card gear-card"
                  :class="[
                    {
                      'is-selected': isSlotFocused('shield'),
                      'is-empty': !sh,
                    },
                    dropStateClass('shield'),
                  ]"
                  :style="{
                    '--rc': sh
                      ? store.rarityMeta[sh.rarity]?.color || '#26bf57'
                      : '#2a344a',
                  }"
                  :title="
                    sh
                      ? `${sh.zhName}（右键卸下）`
                      : `点击选择护盾（${aug.shieldLabel}）`
                  "
                  @click="store.selectSlot({ kind: 'shield' })"
                  @contextmenu.prevent="store.setShield(null)"
                  @dragover="onGearDragOver($event, 'shield')"
                  @dragleave="onDragLeaveKey('shield')"
                  @drop="onGearDrop($event, 'shield')"
                >
                  <template v-if="sh">
                    <div class="gear-art">
                      <img
                        :src="store.assetUrl(sh.icon)"
                        :alt="sh.zhName"
                        draggable="false"
                      />
                    </div>
                    <svg
                      class="rarity-wedge"
                      viewBox="0 0 36 44"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M0,0 C2,24 14,40 36,44 L0,44 Z" fill="currentColor" />
                    </svg>
                    <footer class="card-foot">
                      <img
                        :src="store.assetUrl(sh.categoryIcon)"
                        alt=""
                        class="foot-cat-ico"
                        draggable="false"
                      />
                      <span class="foot-val ar-num">100/100</span>
                    </footer>
                  </template>

                  <div v-else class="empty-center">
                    <img
                      :src="store.assetUrl(slotIcons.shieldLight)"
                      alt=""
                      class="empty-sil"
                      draggable="false"
                    />
                  </div>
                </div>
              </div>

              <!-- Weapon 1 & Weapon 2 Cards -->
              <div
                v-for="wIdx in [0, 1]"
                :key="wIdx"
                class="arc-card weapon-card"
                :class="[
                  {
                    'is-selected': isSlotFocused('weapon', wIdx),
                    'is-empty': !store.weaponDetails[wIdx],
                    'is-dragging':
                      activeLoadoutDrag?.kind === 'slot-weapon' &&
                      activeLoadoutDrag?.weaponIndex === wIdx,
                  },
                  dropStateClass('weapon', wIdx),
                ]"
                :style="{
                  '--rc': store.weaponDetails[wIdx]
                    ? store.rarityMeta[store.weaponDetails[wIdx].displayRarity]?.color ||
                      '#a4a5aa'
                    : '#2a344a',
                }"
                :draggable="Boolean(store.weaponDetails[wIdx])"
                :title="
                  store.weaponDetails[wIdx]
                    ? `${store.weaponDetails[wIdx].amplified ? '增强型 ' : ''}${store.weaponDetails[wIdx].weapon.zhName} · 拖动可互换主副武器 · 右键卸下`
                    : `点击选配武器 ${wIdx === 0 ? 'I' : 'II'}`
                "
                @click="store.selectSlot({ kind: 'weapon', index: wIdx, subMode: 'weapon' })"
                @contextmenu.prevent="store.setWeapon(wIdx, null)"
                @dragstart="onWeaponDragStart($event, wIdx)"
                @dragover="onWeaponDragOver($event, wIdx)"
                @dragleave="onDragLeaveKey('weapon', wIdx)"
                @drop="onWeaponDrop($event, wIdx)"
              >
                <template v-if="store.weaponDetails[wIdx]">
                  <!-- Weapon Horizontal Silhouette -->
                  <div class="wc-art">
                    <img
                      :src="store.assetUrl(store.weaponDetails[wIdx].displayImage)"
                      :alt="store.weaponDetails[wIdx].weapon.zhName"
                      draggable="false"
                    />
                  </div>

                  <!-- Mod Slot Row (Centered Above Bottom Bar) -->
                  <div
                    v-if="
                      store.weaponDetails[wIdx].weapon.modSlots?.length ||
                      store.weaponDetails[wIdx].amplified
                    "
                    class="wc-mods"
                    @click.stop
                  >
                    <button
                      v-for="sk in store.weaponDetails[wIdx].weapon.modSlots"
                      :key="sk"
                      type="button"
                      class="mod-box"
                      :class="[
                        {
                          equipped: Boolean(store.weaponDetails[wIdx].entry.mods?.[sk]),
                          locked: Boolean(store.weaponDetails[wIdx].lockedSlots[sk]),
                          active:
                            sel.kind === 'weapon' &&
                            sel.index === wIdx &&
                            sel.subMode === 'mod' &&
                            sel.modSlotKey === sk,
                        },
                        dropStateClass('mod', wIdx, sk),
                      ]"
                      :style="{
                        '--mc': store.weaponDetails[wIdx].entry.mods?.[sk]
                          ? modColor(
                              store.getModById(store.weaponDetails[wIdx].entry.mods[sk]),
                            )
                          : 'transparent',
                      }"
                      :draggable="Boolean(store.weaponDetails[wIdx].entry.mods?.[sk])"
                      :title="
                        store.weaponDetails[wIdx].lockedSlots[sk]
                          ? `已锁定：${store.weaponDetails[wIdx].lockedSlots[sk]}`
                          : store.weaponDetails[wIdx].entry.mods?.[sk]
                            ? `${store.getModById(store.weaponDetails[wIdx].entry.mods[sk])?.zhName}（拖动互换 · 右键卸下）`
                            : `选配${store.slotLabels[sk]?.name || sk}`
                      "
                      @click="focusWeaponModSlot(wIdx, sk)"
                      @contextmenu.prevent="store.setWeaponMod(wIdx, sk, null)"
                      @dragstart="onModDragStart($event, wIdx, sk)"
                      @dragover="onModDragOver($event, wIdx, sk)"
                      @dragleave="onDragLeaveKey('mod', wIdx, sk)"
                      @drop="onModDrop($event, wIdx, sk)"
                    >
                      <svg
                        v-if="store.weaponDetails[wIdx].entry.mods?.[sk]"
                        class="mod-wedge"
                        viewBox="0 0 18 22"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path d="M0,0 C1,12 7,20 18,22 L0,22 Z" fill="currentColor" />
                      </svg>
                      <img
                        :src="
                          store.weaponDetails[wIdx].entry.mods?.[sk]
                            ? store.assetUrl(
                                store.getModById(
                                  store.weaponDetails[wIdx].entry.mods[sk],
                                )?.image,
                              )
                            : modSilhouetteUrl(sk)
                        "
                        alt=""
                        draggable="false"
                      />
                    </button>

                    <button
                      v-if="store.weaponDetails[wIdx].amplified"
                      type="button"
                      class="amp-mini-badge"
                      title="已启用增强型 (Ascended，点击调整)"
                      @click="focusWeaponAmp(wIdx)"
                    >
                      {{
                        store.weaponDetails[wIdx].entry.ampIds.length
                          ? `★${store.weaponDetails[wIdx].entry.ampIds.length}`
                          : '★增强'
                      }}
                    </button>
                  </div>

                  <!-- Curved Rarity Wedge -->
                  <svg
                    class="rarity-wedge weapon-wedge"
                    viewBox="0 0 46 58"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path d="M0,0 C3,32 18,52 46,58 L0,58 Z" fill="currentColor" />
                  </svg>

                  <!-- Bottom Status Bar (Ammo 0/Mag + Durability + Roman Tier) -->
                  <footer class="card-foot weapon-foot">
                    <div class="wf-left">
                      <img
                        :src="store.assetUrl(store.weaponDetails[wIdx].ammoIcon)"
                        alt=""
                        class="wf-ammo-ico"
                        draggable="false"
                      />
                      <span class="wf-mag ar-num">
                        0/{{ store.weaponDetails[wIdx].calc.enhancedMag }}
                      </span>
                    </div>

                    <div class="wf-right">
                      <span class="wf-dur ar-num">
                        {{ store.weaponDetails[wIdx].durabilityMax }}/{{
                          store.weaponDetails[wIdx].durabilityMax
                        }}
                      </span>
                      <button
                        type="button"
                        class="wf-roman"
                        title="点击切换武器等级 (I–IV)"
                        @click.stop="store.cycleWeaponTier(wIdx)"
                      >
                        {{ store.weaponDetails[wIdx].roman }}
                      </button>
                    </div>
                  </footer>
                </template>

                <div v-else class="empty-center">
                  <img
                    :src="store.assetUrl(slotIcons.weapon)"
                    alt=""
                    class="empty-sil weapon-sil"
                    draggable="false"
                  />
                </div>
              </div>
            </section>

            <!-- =====================================================
                 COLUMN 2: 背包 (4-Column Grid of Dynamic Capacity)
                 ===================================================== -->
            <section class="ld-col col-backpack">
              <header class="sec-head">
                <h2 class="sec-title">背包</h2>
                <span class="sec-count ar-num">
                  {{ filledBackpackCount }}/{{ aug.backpackSlots }}
                </span>
              </header>

              <div class="slot-grid-4">
                <div
                  v-for="cell in store.backpackSlotsView"
                  :key="cell.index"
                  class="arc-card item-tile"
                  :class="[
                    {
                      'is-selected': isSlotFocused('backpack', cell.index),
                      'is-empty': !cell.item,
                      'is-dragging':
                        activeLoadoutDrag?.kind === 'slot-item' &&
                        activeLoadoutDrag?.container === 'backpack' &&
                        activeLoadoutDrag?.index === cell.index,
                    },
                    dropStateClass('backpack', cell.index),
                  ]"
                  :style="{
                    '--rc': cell.item
                      ? store.rarityMeta[cell.item.rarity]?.color || '#a4a5aa'
                      : '#252f44',
                  }"
                  :draggable="Boolean(cell.item)"
                  :title="
                    cell.item
                      ? `${cell.item.zhName} ×${cell.stack}（拖动移动/互换 · 右键清空）`
                      : `背包 #${cell.index + 1}`
                  "
                  @click="store.selectSlot({ kind: 'backpack', index: cell.index })"
                  @contextmenu.prevent="store.setContainerItem('backpack', cell.index, null)"
                  @dragstart="onItemTileDragStart($event, 'backpack', cell.index, cell.item)"
                  @dragover="onItemTileDragOver($event, 'backpack', cell.index)"
                  @dragleave="onDragLeaveKey('backpack', cell.index)"
                  @drop="onItemTileDrop($event, 'backpack', cell.index)"
                >
                  <template v-if="cell.item">
                    <div class="tile-art">
                      <img
                        :src="store.assetUrl(cell.item.icon)"
                        :alt="cell.item.zhName"
                        draggable="false"
                      />
                    </div>
                    <svg
                      class="rarity-wedge tile-wedge"
                      viewBox="0 0 28 36"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M0,0 C2,20 11,32 28,36 L0,36 Z" fill="currentColor" />
                    </svg>
                    <footer class="card-foot tile-foot">
                      <img
                        :src="store.assetUrl(cell.item.badgeIcon)"
                        alt=""
                        class="tf-cat-ico"
                        draggable="false"
                      />
                      <div class="tf-stack-wrap" @click.stop>
                        <button
                          v-if="cell.item.maxStack > 1"
                          type="button"
                          class="tf-step"
                          title="减少数量"
                          @click="store.adjustContainerCount('backpack', cell.index, -1)"
                        >
                          −
                        </button>
                        <span class="tf-count ar-num">×{{ cell.stack }}</span>
                        <button
                          v-if="cell.item.maxStack > 1"
                          type="button"
                          class="tf-step"
                          :disabled="cell.stack >= cell.item.maxStack"
                          title="增加数量"
                          @click="store.adjustContainerCount('backpack', cell.index, 1)"
                        >
                          +
                        </button>
                      </div>
                    </footer>
                  </template>
                </div>
              </div>
            </section>

            <!-- =====================================================
                 COLUMN 3: 快速使用 · 强化栏位 · 安全口袋
                 ===================================================== -->
            <section class="ld-col col-right-stack">
              <!-- 1. 快速使用 -->
              <div class="right-group">
                <header class="sec-head">
                  <h2 class="sec-title">快速使用</h2>
                  <span class="sec-count ar-num">
                    {{ filledQuickUseCount }}/{{ aug.quickUseSlots }}
                  </span>
                </header>

                <div class="slot-grid-3">
                  <div
                    v-for="cell in store.quickUseSlotsView"
                    :key="cell.index"
                    class="arc-card item-tile"
                    :class="[
                      {
                        'is-selected': isSlotFocused('quickUse', cell.index),
                        'is-empty': !cell.item,
                        'is-dragging':
                          activeLoadoutDrag?.kind === 'slot-item' &&
                          activeLoadoutDrag?.container === 'quickUse' &&
                          activeLoadoutDrag?.index === cell.index,
                      },
                      dropStateClass('quickUse', cell.index),
                    ]"
                    :style="{
                      '--rc': cell.item
                        ? store.rarityMeta[cell.item.rarity]?.color || '#a4a5aa'
                        : '#252f44',
                    }"
                    :draggable="Boolean(cell.item)"
                    :title="
                      cell.item
                        ? `${cell.item.zhName} ×${cell.stack}（拖动移动/互换 · 右键清空）`
                        : `快速使用 #${cell.index + 1}`
                    "
                    @click="store.selectSlot({ kind: 'quickUse', index: cell.index })"
                    @contextmenu.prevent="store.setContainerItem('quickUse', cell.index, null)"
                    @dragstart="onItemTileDragStart($event, 'quickUse', cell.index, cell.item)"
                    @dragover="onItemTileDragOver($event, 'quickUse', cell.index)"
                    @dragleave="onDragLeaveKey('quickUse', cell.index)"
                    @drop="onItemTileDrop($event, 'quickUse', cell.index)"
                  >
                    <template v-if="cell.item">
                      <div class="tile-art">
                        <img
                          :src="store.assetUrl(cell.item.icon)"
                          :alt="cell.item.zhName"
                          draggable="false"
                        />
                      </div>
                      <svg
                        class="rarity-wedge tile-wedge"
                        viewBox="0 0 28 36"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path d="M0,0 C2,20 11,32 28,36 L0,36 Z" fill="currentColor" />
                      </svg>
                      <footer class="card-foot tile-foot">
                        <img
                          :src="store.assetUrl(cell.item.badgeIcon)"
                          alt=""
                          class="tf-cat-ico"
                          draggable="false"
                        />
                        <div class="tf-stack-wrap" @click.stop>
                          <button
                            v-if="cell.item.maxStack > 1"
                            type="button"
                            class="tf-step"
                            @click="store.adjustContainerCount('quickUse', cell.index, -1)"
                          >
                            −
                          </button>
                          <span class="tf-count ar-num">×{{ cell.stack }}</span>
                          <button
                            v-if="cell.item.maxStack > 1"
                            type="button"
                            class="tf-step"
                            :disabled="cell.stack >= cell.item.maxStack"
                            @click="store.adjustContainerCount('quickUse', cell.index, 1)"
                          >
                            +
                          </button>
                        </div>
                      </footer>
                    </template>

                    <div v-else class="empty-center">
                      <img
                        :src="store.assetUrl(slotIcons.quickUse)"
                        alt=""
                        class="empty-sil tile-sil"
                        draggable="false"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2. 强化栏位 (Shown when Augment grants Aux Slots or Integrated Item) -->
              <div v-if="totalAuxDisplayCount > 0" class="right-group">
                <header class="sec-head">
                  <h2 class="sec-title">强化栏位</h2>
                  <span class="sec-count ar-num">
                    {{ filledAuxDisplayCount }}/{{ totalAuxDisplayCount }}
                  </span>
                </header>

                <div class="slot-grid-3">
                  <!-- Fixed Integrated Item -->
                  <div
                    v-if="aug.integratedItem"
                    class="arc-card item-tile is-integrated"
                    style="--rc: #ffbc13"
                    :title="`${aug.integratedItem.zhName}（强化内置固定模块）`"
                  >
                    <div class="tile-art">
                      <img
                        :src="store.assetUrl(aug.integratedItem.icon)"
                        :alt="aug.integratedItem.zhName"
                        draggable="false"
                      />
                    </div>
                    <svg
                      class="rarity-wedge tile-wedge"
                      viewBox="0 0 28 36"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                    >
                      <path d="M0,0 C2,20 11,32 28,36 L0,36 Z" fill="currentColor" />
                    </svg>
                    <footer class="card-foot tile-foot">
                      <img
                        :src="store.assetUrl(slotIcons.augment)"
                        alt=""
                        class="tf-cat-ico"
                        draggable="false"
                      />
                      <span class="tf-count ar-num">×1</span>
                    </footer>
                  </div>

                  <!-- Equippable Aux Slots -->
                  <div
                    v-for="cell in store.auxSlotsView"
                    :key="cell.index"
                    class="arc-card item-tile"
                    :class="[
                      {
                        'is-selected': isSlotFocused('aux', cell.index),
                        'is-empty': !cell.item,
                        'is-dragging':
                          activeLoadoutDrag?.kind === 'slot-item' &&
                          activeLoadoutDrag?.container === 'aux' &&
                          activeLoadoutDrag?.index === cell.index,
                      },
                      dropStateClass('aux', cell.index),
                    ]"
                    :style="{
                      '--rc': cell.item
                        ? store.rarityMeta[cell.item.rarity]?.color || '#a4a5aa'
                        : '#252f44',
                    }"
                    :draggable="Boolean(cell.item)"
                    :title="
                      cell.item
                        ? `${cell.item.zhName} ×${cell.stack}（拖动移动/互换 · 右键清空）`
                        : `强化栏位 #${cell.index + 1}（${cell.spec.label}）`
                    "
                    @click="store.selectSlot({ kind: 'aux', index: cell.index })"
                    @contextmenu.prevent="store.setContainerItem('aux', cell.index, null)"
                    @dragstart="onItemTileDragStart($event, 'aux', cell.index, cell.item)"
                    @dragover="onItemTileDragOver($event, 'aux', cell.index)"
                    @dragleave="onDragLeaveKey('aux', cell.index)"
                    @drop="onItemTileDrop($event, 'aux', cell.index)"
                  >
                    <template v-if="cell.item">
                      <div class="tile-art">
                        <img
                          :src="store.assetUrl(cell.item.icon)"
                          :alt="cell.item.zhName"
                          draggable="false"
                        />
                      </div>
                      <svg
                        class="rarity-wedge tile-wedge"
                        viewBox="0 0 28 36"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path d="M0,0 C2,20 11,32 28,36 L0,36 Z" fill="currentColor" />
                      </svg>
                      <footer class="card-foot tile-foot">
                        <img
                          :src="store.assetUrl(cell.item.badgeIcon)"
                          alt=""
                          class="tf-cat-ico"
                          draggable="false"
                        />
                        <div class="tf-stack-wrap" @click.stop>
                          <button
                            v-if="cell.item.maxStack > 1"
                            type="button"
                            class="tf-step"
                            @click="store.adjustContainerCount('aux', cell.index, -1)"
                          >
                            −
                          </button>
                          <span class="tf-count ar-num">×{{ cell.stack }}</span>
                          <button
                            v-if="cell.item.maxStack > 1"
                            type="button"
                            class="tf-step"
                            :disabled="cell.stack >= cell.item.maxStack"
                            @click="store.adjustContainerCount('aux', cell.index, 1)"
                          >
                            +
                          </button>
                        </div>
                      </footer>
                    </template>

                    <div v-else class="empty-center">
                      <img
                        :src="auxCategoryPlaceholder"
                        alt=""
                        class="empty-sil tile-sil"
                        draggable="false"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- 3. 安全口袋 (Shown when Augment grants Safe Pockets) -->
              <div v-if="store.safePocketSlotsView.length > 0" class="right-group">
                <header class="sec-head">
                  <h2 class="sec-title">安全口袋</h2>
                  <span class="sec-count ar-num">
                    {{ filledSafePocketCount }}/{{ aug.safePocketSlots }}
                  </span>
                </header>

                <div class="slot-grid-3">
                  <div
                    v-for="cell in store.safePocketSlotsView"
                    :key="cell.index"
                    class="arc-card item-tile"
                    :class="[
                      {
                        'is-selected': isSlotFocused('safePocket', cell.index),
                        'is-empty': !cell.item,
                        'is-dragging':
                          activeLoadoutDrag?.kind === 'slot-item' &&
                          activeLoadoutDrag?.container === 'safePocket' &&
                          activeLoadoutDrag?.index === cell.index,
                      },
                      dropStateClass('safePocket', cell.index),
                    ]"
                    :style="{
                      '--rc': cell.item
                        ? store.rarityMeta[cell.item.rarity]?.color || '#a4a5aa'
                        : '#252f44',
                    }"
                    :draggable="Boolean(cell.item)"
                    :title="
                      cell.item
                        ? `${cell.item.zhName} ×${cell.stack}（拖动移动/互换 · 右键清空）`
                        : `安全口袋 #${cell.index + 1}`
                    "
                    @click="store.selectSlot({ kind: 'safePocket', index: cell.index })"
                    @contextmenu.prevent="
                      store.setContainerItem('safePocket', cell.index, null)
                    "
                    @dragstart="
                      onItemTileDragStart($event, 'safePocket', cell.index, cell.item)
                    "
                    @dragover="onItemTileDragOver($event, 'safePocket', cell.index)"
                    @dragleave="onDragLeaveKey('safePocket', cell.index)"
                    @drop="onItemTileDrop($event, 'safePocket', cell.index)"
                  >
                    <template v-if="cell.item">
                      <div class="tile-art">
                        <img
                          :src="store.assetUrl(cell.item.icon)"
                          :alt="cell.item.zhName"
                          draggable="false"
                        />
                      </div>
                      <svg
                        class="rarity-wedge tile-wedge"
                        viewBox="0 0 28 36"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <path d="M0,0 C2,20 11,32 28,36 L0,36 Z" fill="currentColor" />
                      </svg>
                      <footer class="card-foot tile-foot">
                        <img
                          :src="store.assetUrl(cell.item.badgeIcon)"
                          alt=""
                          class="tf-cat-ico"
                          draggable="false"
                        />
                        <div class="tf-stack-wrap" @click.stop>
                          <button
                            v-if="cell.item.maxStack > 1"
                            type="button"
                            class="tf-step"
                            @click="store.adjustContainerCount('safePocket', cell.index, -1)"
                          >
                            −
                          </button>
                          <span class="tf-count ar-num">×{{ cell.stack }}</span>
                          <button
                            v-if="cell.item.maxStack > 1"
                            type="button"
                            class="tf-step"
                            :disabled="cell.stack >= cell.item.maxStack"
                            @click="store.adjustContainerCount('safePocket', cell.index, 1)"
                          >
                            +
                          </button>
                        </div>
                      </footer>
                    </template>

                    <div v-else class="empty-center">
                      <img
                        :src="store.assetUrl(slotIcons.safePocket)"
                        alt=""
                        class="empty-sil tile-sil"
                        draggable="false"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <!-- Right Sidebar: Inline Switchable Picker / Share / Recognize / Sync -->
      <LoadoutPickerSidebar ref="sidebarRef" />
    </div>

    <!-- Concise Toast -->
    <Teleport to="body">
      <Transition name="ld-toast">
        <div
          v-if="store.toast"
          :key="store.toast.ts"
          class="loadout-toast"
          :class="[`is-${store.toast.tone}`]"
        >
          {{ store.toast.msg }}
        </div>
      </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.loadout-page {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #080b16;
  overflow: hidden;
}

.loadout-workspace {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

/* ============================================================================
   Game-Authentic Midnight Navy Loadout Canvas (Matches Screenshot 1)
   ============================================================================ */
.loadout-stage {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(62% 58% at 38% 36%, rgba(22, 38, 74, 0.42) 0%, transparent 72%),
    radial-gradient(50% 50% at 72% 76%, rgba(16, 28, 56, 0.35) 0%, transparent 75%),
    linear-gradient(180deg, #0a0f1f 0%, #070a14 100%);
}

.ld-board-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 28px 32px 36px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.ld-board {
  --tile: 80px;
  --gap: 9px;
  --col-gap: 36px;
  display: flex;
  align-items: flex-start;
  gap: var(--col-gap);
  margin: auto 0;
}

@media (min-width: 1640px) {
  .ld-board {
    --tile: 88px;
    --gap: 10px;
    --col-gap: 44px;
  }
}

@media (max-width: 1380px) {
  .ld-board {
    --tile: 72px;
    --gap: 8px;
    --col-gap: 26px;
  }
}

.ld-col {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.col-equip {
  width: calc(var(--tile) * 3 + var(--gap) * 2 + 16px);
}

.col-right-stack {
  display: flex;
  flex-direction: column;
  gap: 26px;
}

.right-group {
  display: flex;
  flex-direction: column;
}

/* Section Headers: "装备" | "背包 13/22" | "快速使用 3/4" */
.sec-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
  padding-left: 2px;
}

.sec-title {
  margin: 0;
  font-family: var(--font-display, 'Rajdhani', sans-serif);
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #f3efe6;
}

.sec-count {
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  font-weight: 700;
  color: #e4e0d8;
}

/* ============================================================================
   Shared ARC Raiders Slot Card Base (.arc-card)
   ============================================================================ */
.arc-card {
  --rc: #2a344a;
  --foot-h: 22px;
  position: relative;
  border-radius: 6px;
  background:
    radial-gradient(
      115% 95% at 8% 95%,
      color-mix(in srgb, var(--rc) 18%, transparent) 0%,
      transparent 62%
    ),
    linear-gradient(180deg, #101729 0%, #0b101d 100%);
  border: 1px solid color-mix(in srgb, var(--rc) 58%, rgba(255, 255, 255, 0.14));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  cursor: pointer;
  user-select: none;
  overflow: hidden;
  transition:
    border-color 0.15s ease,
    transform 0.14s ease,
    box-shadow 0.15s ease;
}

.arc-card.is-empty {
  background: rgba(13, 18, 32, 0.72);
  border-color: rgba(255, 255, 255, 0.09);
  box-shadow: none;
}

.arc-card:hover {
  border-color: color-mix(in srgb, var(--rc) 82%, rgba(255, 255, 255, 0.42));
}

.arc-card.is-empty:hover {
  border-color: rgba(255, 255, 255, 0.24);
  background: rgba(18, 25, 44, 0.85);
}

/* ARC Raiders Prismatic Rainbow Selection Rim (Matches Weapon 1 in Screenshot 1) */
.arc-card.is-selected {
  box-shadow:
    0 0 18px rgba(95, 255, 255, 0.18),
    0 6px 20px rgba(0, 0, 0, 0.45);
}

.arc-card.is-selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1.6px;
  background: linear-gradient(
    132deg,
    #ebfffa 0%,
    #39f38d 24%,
    #5fffff 50%,
    #d648ff 76%,
    #fff4d2 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  z-index: 6;
}

.arc-card.is-dragging {
  opacity: 0.42;
  transform: scale(0.97);
}

.arc-card.is-drop-valid {
  border-color: #39f38d !important;
  box-shadow:
    0 0 0 1px #39f38d,
    0 0 16px rgba(57, 243, 141, 0.35) !important;
}

.arc-card.is-drop-invalid {
  border-color: #ff4438 !important;
  box-shadow: 0 0 0 1px rgba(255, 68, 56, 0.65) !important;
}

/* Signature Bottom-Left Concave Rarity Wedge */
.rarity-wedge {
  position: absolute;
  left: 0;
  bottom: var(--foot-h);
  width: 28px;
  height: 36px;
  color: var(--rc);
  pointer-events: none;
  z-index: 2;
}

/* Bottom Info Bar */
.card-foot {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--foot-h);
  padding: 0 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(6, 9, 17, 0.84);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  z-index: 3;
}

.foot-cat-ico {
  width: 13px;
  height: 13px;
  object-fit: contain;
  filter: brightness(0) invert(0.95);
  opacity: 0.92;
}

.foot-val {
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  font-weight: 700;
  color: #d7d5ce;
}

.empty-center {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-sil {
  width: 38px;
  height: 38px;
  object-fit: contain;
  opacity: 0.14;
  filter: brightness(0) invert(1);
}

/* ============================================================================
   Column 1: Augment + Shield + Weapon 1 & 2
   ============================================================================ */
.equip-top-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 18px;
}

.gear-card {
  aspect-ratio: 144 / 96;
  --foot-h: 22px;
}

.gear-art {
  position: absolute;
  inset: 6px 10px 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.gear-art img {
  max-width: 78%;
  max-height: 92%;
  object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.6));
}

.weapon-card {
  aspect-ratio: 304 / 200;
  --foot-h: 28px;
}

.weapon-card + .weapon-card {
  margin-top: 14px;
}

.weapon-wedge {
  width: 38px;
  height: 52px;
}

.wc-art {
  position: absolute;
  top: 10px;
  left: 16px;
  right: 16px;
  bottom: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.wc-art img {
  max-width: 82%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.68));
  transition: transform 0.16s ease;
}

.weapon-card:hover .wc-art img {
  transform: scale(1.03);
}

.weapon-sil {
  width: 68px;
  height: 68px;
  opacity: 0.12;
}

/* Centered Mod Slot Boxes inside Weapon Card */
.wc-mods {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  z-index: 4;
}

.mod-box {
  --mc: transparent;
  position: relative;
  width: 34px;
  height: 34px;
  padding: 4px;
  border-radius: 4px;
  background: rgba(20, 27, 44, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.14s ease;
}

.mod-box img {
  position: relative;
  z-index: 2;
  width: 22px;
  height: 22px;
  object-fit: contain;
  opacity: 0.34;
  filter: brightness(0) invert(1);
}

.mod-box.equipped {
  background: linear-gradient(180deg, #141c30 0%, #0d1322 100%);
  border-color: color-mix(in srgb, var(--mc) 68%, rgba(255, 255, 255, 0.2));
}

.mod-box.equipped img {
  opacity: 1;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6));
}

.mod-wedge {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 14px;
  height: 18px;
  color: var(--mc);
  z-index: 1;
  pointer-events: none;
}

.mod-box:hover {
  border-color: rgba(255, 255, 255, 0.55);
  transform: translateY(-1px);
}

.mod-box.active {
  border-color: #5fffff;
  box-shadow: 0 0 0 1px #5fffff;
}

.mod-box.locked {
  opacity: 0.28;
  cursor: not-allowed;
}

.mod-box.is-drop-valid {
  border-color: #39f38d !important;
  box-shadow: 0 0 0 1px #39f38d !important;
}

.mod-box.is-drop-invalid {
  border-color: #ff4438 !important;
}

.amp-mini-badge {
  height: 22px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 198, 0, 0.5);
  background: rgba(255, 198, 0, 0.14);
  color: #ffc600;
  font-family: var(--font-mono, monospace);
  font-size: 10.5px;
  font-weight: 800;
  cursor: pointer;
}

/* Weapon Bottom Strip */
.weapon-foot {
  padding: 0 10px;
}

.wf-left,
.wf-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wf-ammo-ico {
  width: 15px;
  height: 15px;
  object-fit: contain;
  filter: brightness(0) invert(0.96);
}

.wf-mag {
  font-family: var(--font-mono, monospace);
  font-size: 12.5px;
  font-weight: 800;
  color: #f4f1ea;
}

.wf-dur {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  font-weight: 700;
  color: #cfd0d6;
}

.wf-roman {
  padding: 0 4px;
  margin-left: 1px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #b8bcc8;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: all 0.14s ease;
}

.wf-roman:hover {
  color: #5fffff;
  background: rgba(95, 255, 255, 0.12);
}

/* ============================================================================
   Columns 2 & 3: Square Item Tiles (Backpack / Quick Use / Aux / Safe Pocket)
   ============================================================================ */
.slot-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, var(--tile));
  gap: var(--gap);
}

.slot-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, var(--tile));
  gap: var(--gap);
}

.item-tile {
  width: var(--tile);
  height: var(--tile);
  --foot-h: 20px;
}

.item-tile.is-integrated {
  cursor: default;
}

.tile-wedge {
  width: 22px;
  height: 28px;
}

.tile-art {
  position: absolute;
  inset: 5px 6px 21px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.tile-art img {
  max-width: 84%;
  max-height: 88%;
  object-fit: contain;
  filter: drop-shadow(0 4px 9px rgba(0, 0, 0, 0.62));
}

.tile-sil {
  width: 42%;
  height: 42%;
  opacity: 0.13;
}

.tile-foot {
  padding: 0 5px;
}

.tf-cat-ico {
  width: 11px;
  height: 11px;
  object-fit: contain;
  filter: brightness(0) invert(0.96);
  flex-shrink: 0;
}

.tf-stack-wrap {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.tf-count {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
  color: #f2efe8;
}

.tf-step {
  display: none;
  width: 13px;
  height: 13px;
  padding: 0;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(18, 25, 42, 0.95);
  color: #f2efe8;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.item-tile:hover .tf-step {
  display: inline-flex;
}

.tf-step:hover:not(:disabled) {
  border-color: #5fffff;
  color: #5fffff;
}

.tf-step:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* ============================================================================
   Toast
   ============================================================================ */
.loadout-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 420;
  padding: 8px 16px;
  border-radius: 6px;
  background: rgba(12, 17, 32, 0.96);
  border: 1px solid rgba(206, 193, 176, 0.28);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65);
  color: #f7efe2;
  font-size: 12.5px;
  font-weight: 700;
  pointer-events: none;
}

.loadout-toast.is-ok {
  border-color: #5fffff;
  color: #5fffff;
}

.loadout-toast.is-warn {
  border-color: #ffbc13;
  color: #ffbc13;
}

.ld-toast-enter-active,
.ld-toast-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.ld-toast-enter-from,
.ld-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
