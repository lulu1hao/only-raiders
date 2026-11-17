<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRaiderLoadoutStore } from '../../../stores/useRaiderLoadoutStore'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'
import { useRaiderLoadoutSync } from '../../../composables/useRaiderLoadoutSync'
import {
  abortRaiderAutoSync,
  analyzeLoadoutSyncDiff,
  describeLoadoutBrief,
  runLoadoutAutoSyncSession,
} from '../../../utils/raiderLoadoutSyncPlanner'
import {
  classTabs,
  getAmpRestrictionState,
  modColor,
  modGrade,
  shortAmpName,
  slotPlaceholderImg,
  toEffects,
} from '../../../composables/useWeaponCalculator'
import { startLoadoutDrag } from '../composables/useLoadoutDrag'

const store = useRaiderLoadoutStore()
const overlayStore = useOverlayWindowStore()

const collapsed = ref(false)
// Primary inline sidebar mode: 'pick' | 'share' | 'recognize' | 'sync'
const sidebarTab = ref('pick')

// Picker filters
const augFamilyFilter = ref('ALL')
const weaponSearch = ref('')
const weaponClassFilter = ref('ALL')
const itemSearch = ref('')
const itemCatFilter = ref('ALL')

// Share & Save state
const customSaveName = ref('')
const shareInput = ref('')

// Sync state
const selectedSourceKey = ref('current')
const isSyncRunning = ref(false)
const syncStatusMsg = ref('')
const syncBanner = ref(null)

const {
  isDesktop,
  fileInputRef,
  isRecognizing,
  recognizeError,
  previewUrl,
  recognizedResult,
  recognizedSlotsView,
  saveImportName,
  revokePreviewUrl,
  processImageSource,
  handleCaptureGameForRecognize,
  triggerFileSelect,
  onFileSelected,
  onDropImage,
  handleReadClipboard,
  gameWinStatus,
  precheckInGameLoadout,
  precheckLoading,
  precheckError,
  availableLoadoutSources,
  refreshGameWindowStatus,
  runPrecheckInGameState,
  weaponLoadWaitSec,
  syncOptions,
  syncOptionsUi,
  RESTOCK_POLICY_OPTIONS,
} = useRaiderLoadoutSync(store, {
  currentLabelPrefix: '当前战备',
})

const sel = computed(() => store.selectedSlot)
const aug = computed(() => store.activeAugment)
const shareCode = computed(() => store.exportShareCode())

const activeWeaponIndex = computed(() => (sel.value.index === 1 ? 1 : 0))
const activeWeaponDetail = computed(
  () => store.weaponDetails[activeWeaponIndex.value] || null,
)

const isItemContainerSelected = computed(() =>
  ['backpack', 'quickUse', 'aux', 'safePocket'].includes(sel.value.kind),
)

// Whenever user clicks a slot on the board, switch sidebar to 'pick' and expand if collapsed
watch(
  () => sel.value.seq,
  (nextSeq, prevSeq) => {
    if (nextSeq !== prevSeq && prevSeq !== undefined && !isSyncRunning.value) {
      sidebarTab.value = 'pick'
      if (collapsed.value) collapsed.value = false
    }
  },
)

// Ensure modSlotKey defaults to first available mod slot when switching to mod subMode
watch(
  () => [
    sel.value.kind,
    sel.value.index,
    sel.value.subMode,
    activeWeaponDetail.value?.weapon?.id,
  ],
  () => {
    if (sel.value.kind !== 'weapon' || sel.value.subMode !== 'mod') return
    const slots = activeWeaponDetail.value?.weapon?.modSlots || []
    if (
      slots.length &&
      (!sel.value.modSlotKey || !slots.includes(sel.value.modSlotKey))
    ) {
      store.selectedSlot.modSlotKey = slots[0]
    }
  },
  { immediate: true },
)

// Keep itemCatFilter valid when switching between item containers
watch(
  () => [sel.value.kind, aug.value.id],
  () => {
    if (!isItemContainerSelected.value) return
    const validIds = itemCategoryTabs.value.map((t) => t.id)
    if (!validIds.includes(itemCatFilter.value)) {
      itemCatFilter.value = validIds[0] || 'ALL'
    }
  },
)

function switchSidebarTab(tab) {
  if (isSyncRunning.value) return
  sidebarTab.value = tab
  if (tab === 'sync') {
    void refreshGameWindowStatus()
  }
}

function openAndProcessImage(blob) {
  collapsed.value = false
  sidebarTab.value = 'recognize'
  void processImageSource(blob, blob)
}

defineExpose({
  switchSidebarTab,
  openAndProcessImage,
})

/* =========================================================================
   Picker Computed Lists
   ========================================================================= */
const augFamilyTabs = [
  { id: 'ALL', label: '全部' },
  { id: 'combat', label: '战斗' },
  { id: 'tactical', label: '战术' },
  { id: 'looting', label: '搜刮' },
  { id: 'starter', label: '基础' },
]

const filteredAugments = computed(() =>
  store.data.augments.filter(
    (a) => augFamilyFilter.value === 'ALL' || a.family === augFamilyFilter.value,
  ),
)

const enrichedWeapons = computed(() => {
  const kw = weaponSearch.value.trim().toLowerCase()
  return store.weaponsList
    .filter((w) => {
      if (weaponClassFilter.value !== 'ALL' && w.zhClass !== weaponClassFilter.value) {
        return false
      }
      if (!kw) return true
      return [w.zhName, w.name, w.zhClass, w.zhAmmo]
        .join(' ')
        .toLowerCase()
        .includes(kw)
    })
    .map((w) => ({
      ...w,
      mag: w.baseStats?.magazineSize || 0,
      rColor: store.rarityMeta[w.rarity]?.color || '#a4a5aa',
    }))
})

const currentModSlotKey = computed(() => {
  const slots = activeWeaponDetail.value?.weapon?.modSlots || []
  if (!slots.length) return null
  return slots.includes(sel.value.modSlotKey) ? sel.value.modSlotKey : slots[0]
})

const compatibleMods = computed(() => {
  if (!currentModSlotKey.value) return []
  return store.getCompatibleModsForSlot(currentModSlotKey.value).map((m) => ({
    ...m,
    grade: modGrade(m),
    color: modColor(m),
    effects: toEffects(m.zhEffects).slice(0, 2),
  }))
})

const CAT_SHORT_LABELS = {
  ammo: '弹药',
  medical: '医疗',
  throwable: '投掷',
  deployable: '陷阱',
  gadget: '工具',
  key: '钥匙',
  trinket: '饰品',
  material: '材料',
}

const itemCategoryTabs = computed(() => {
  if (sel.value.kind === 'aux') {
    const allowed = aug.value.auxSlots?.allowedCategories || []
    const tabs = allowed.map((id) => ({ id, label: CAT_SHORT_LABELS[id] || id }))
    return tabs.length > 1 ? [{ id: 'ALL', label: '全部' }, ...tabs] : tabs
  }
  if (sel.value.kind === 'quickUse') {
    return [
      { id: 'ALL', label: '全部' },
      { id: 'medical', label: '医疗' },
      { id: 'throwable', label: '投掷' },
      { id: 'deployable', label: '陷阱' },
      { id: 'gadget', label: '工具' },
    ]
  }
  return [
    { id: 'ALL', label: '全部' },
    { id: 'ammo', label: '弹药' },
    { id: 'medical', label: '医疗' },
    { id: 'throwable', label: '投掷' },
    { id: 'deployable', label: '陷阱' },
    { id: 'gadget', label: '工具' },
    { id: 'key', label: '钥匙' },
    { id: 'trinket', label: '饰品' },
    { id: 'material', label: '材料' },
  ]
})

const focusedItemSlotInfo = computed(() => {
  if (!isItemContainerSelected.value) return null
  const kind = sel.value.kind
  const idx = sel.value.index
  const labelMap = {
    backpack: `背包 #${idx + 1}`,
    quickUse: `快速使用 #${idx + 1}`,
    aux: `强化栏位 #${idx + 1}`,
    safePocket: `安全口袋 #${idx + 1}`,
  }
  const viewMap = {
    backpack: store.backpackSlotsView,
    quickUse: store.quickUseSlotsView,
    aux: store.auxSlotsView,
    safePocket: store.safePocketSlotsView,
  }
  const slotEntry = viewMap[kind]?.[idx] || null
  return {
    container: kind,
    index: idx,
    label: labelMap[kind] || `栏位 #${idx + 1}`,
    item: slotEntry?.item || null,
    stack: slotEntry?.stack || 0,
  }
})

const filteredItems = computed(() => {
  if (!isItemContainerSelected.value) return []
  const kw = itemSearch.value.trim().toLowerCase()
  const container = sel.value.kind

  return store.data.quickUseItems.filter((it) => {
    if (!store.canContainerAcceptItem(container, it)) return false
    if (itemCatFilter.value !== 'ALL' && it.category !== itemCatFilter.value) {
      return false
    }
    if (!kw) return true
    return [it.zhName, it.name, it.categoryLabel, ...(it.statTags || [])]
      .join(' ')
      .toLowerCase()
      .includes(kw)
  })
})

function handlePickContainerItem(itemId) {
  if (!isItemContainerSelected.value) return
  store.setContainerItem(sel.value.kind, sel.value.index, itemId)
}

/* =========================================================================
   Share & Local Saves Actions
   ========================================================================= */
async function copyText(text, label) {
  try {
    await navigator.clipboard.writeText(text)
    store.notify(`已复制${label}`, 'ok')
  } catch {
    store.notify('复制失败', 'warn')
  }
}

function copyShareUrl() {
  const url = `${window.location.origin}/raider/loadout?loadout=${encodeURIComponent(shareCode.value)}`
  copyText(url, '战备链接')
}

function handleSaveLoadout() {
  store.saveCustomLoadout(customSaveName.value)
  customSaveName.value = ''
}

function handleImportShareCode() {
  if (store.importShareCode(shareInput.value)) {
    shareInput.value = ''
  }
}

/* =========================================================================
   Vision Recognition & Game Sync Actions
   ========================================================================= */
const activeTargetSource = computed(
  () =>
    availableLoadoutSources.value.find((x) => x.key === selectedSourceKey.value) ||
    availableLoadoutSources.value[0],
)

const liveDiff = computed(() => {
  if (!activeTargetSource.value) return null
  return analyzeLoadoutSyncDiff(
    precheckInGameLoadout.value,
    activeTargetSource.value.loadout,
    syncOptions.value,
  )
})

function applyRecognizedAction(alsoSave = false) {
  const res = recognizedResult.value
  if (!res?.ok) return
  store.applyRecognizedLoadout(res.loadout, '截图')
  if (alsoSave) {
    const name =
      saveImportName.value.trim() ||
      `识图战备 (${describeLoadoutBrief(res.loadout).slice(0, 12)})`
    store.saveCustomLoadout(name)
    saveImportName.value = ''
  }
}

async function handlePrecheck() {
  await runPrecheckInGameState(() => {
    syncBanner.value = null
  })
}

async function handleStartAutoSync() {
  const src = activeTargetSource.value
  if (!src || !liveDiff.value?.totalTargetSlots) {
    syncBanner.value = {
      type: 'warn',
      text: syncOptions.value.quickUseOnly
        ? '所选战备未配置「快速使用」栏位道具，请先配置快捷栏或关闭「只自动配装快速使用」'
        : '所选战备为空，请先选配装备',
    }
    return
  }
  isSyncRunning.value = true
  syncBanner.value = null
  syncStatusMsg.value = '正在连接游戏窗口...'
  const wasOverlayExpanded = overlayStore.visible && !overlayStore.collapsed
  if (wasOverlayExpanded) {
    await overlayStore.setCollapsed(true).catch(() => {})
  }
  try {
    const res = await runLoadoutAutoSyncSession({
      targetLoadout: src.loadout,
      weaponLoadWaitMs: Math.round((Number(weaponLoadWaitSec.value) || 0) * 1000),
      syncOptions: syncOptions.value,
      onProgress(ev) {
        if (ev?.message) syncStatusMsg.value = ev.message
      },
    })
    if (res.inGameLoadout) {
      precheckInGameLoadout.value = res.inGameLoadout
    }
    syncBanner.value = {
      type: res.ok ? (res.remainingCount > 0 ? 'warn' : 'ok') : 'err',
      text: res.message,
    }
    if (res.ok && res.remainingCount === 0) {
      store.notify(res.message, 'ok')
    }
  } catch (err) {
    syncBanner.value = {
      type: err?.aborted ? 'warn' : 'err',
      text: err?.message || '同步已中断',
    }
  } finally {
    if (wasOverlayExpanded) {
      await overlayStore.setCollapsed(false).catch(() => {})
    }
    isSyncRunning.value = false
    syncStatusMsg.value = ''
    void refreshGameWindowStatus()
  }
}

async function handleStopSync() {
  await abortRaiderAutoSync()
}

async function handleLaunchPerspectiveGuide() {
  const src = activeTargetSource.value
  if (!src || !liveDiff.value?.totalTargetSlots) {
    store.notify(
      syncOptions.value.quickUseOnly
        ? '所选战备未配置「快速使用」栏位道具，请先配置快捷栏或关闭「只自动配装快速使用」'
        : '当前战备为空，请先选配装备',
      'warn',
    )
    return
  }
  await overlayStore.launchRaiderPerspectiveGuide({
    kind: 'loadout',
    origin: 'main',
    title: src.shortTitle || '目标战备',
    targetLoadout: src.loadout,
    inGameLoadout: precheckInGameLoadout.value || null,
    syncOptions: { ...syncOptions.value },
  })
}

onBeforeUnmount(() => {
  revokePreviewUrl()
})
</script>

<template>
  <div class="ldp-shell" :class="{ 'is-collapsed': collapsed }">
    <!-- Reopen Pill when Collapsed -->
    <button
      v-if="collapsed"
      type="button"
      class="ldp-reopen-btn"
      title="展开战备侧边栏"
      @click="collapsed = false"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          d="M10 3.5L5.5 8 10 12.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>战备侧栏</span>
    </button>

    <aside class="ldp-panel" :aria-hidden="collapsed">
      <!-- Top Hub: Brand + Quick Utility Buttons + 4 Inline Mode Tabs -->
      <header class="ldp-top">
        <div class="top-row">
          <div class="top-brand">
            <span class="brand-bar"></span>
            <h2 class="brand-title">战备</h2>
          </div>

          <div class="top-actions">
            <button
              type="button"
              class="mini-top-btn"
              title="呼出局内置顶悬浮窗 (Alt+Q)"
              :disabled="isSyncRunning"
              @click="
                overlayStore.openOverlayAtRaider(
                  sidebarTab === 'recognize' ? 'recognize' : 'sync',
                  'loadout',
                )
              "
            >
              悬浮窗
            </button>
            <button
              type="button"
              class="mini-top-btn danger"
              :disabled="isSyncRunning"
              @click="store.clearLoadout()"
            >
              清空
            </button>
            <button
              type="button"
              class="collapse-btn"
              title="收起侧边栏"
              :disabled="isSyncRunning"
              @click="collapsed = true"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M6 3.5L10.5 8 6 12.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <!-- Primary Inline Sidebar Switcher (Replaces All Modals) -->
        <nav class="mode-tabs" aria-label="战备功能切换">
          <button
            type="button"
            class="mode-tab"
            :class="{ active: sidebarTab === 'pick' }"
            :disabled="isSyncRunning"
            @click="switchSidebarTab('pick')"
          >
            选配
          </button>
          <button
            type="button"
            class="mode-tab"
            :class="{ active: sidebarTab === 'share' }"
            :disabled="isSyncRunning"
            @click="switchSidebarTab('share')"
          >
            战备分享
          </button>
          <button
            type="button"
            class="mode-tab"
            :class="{ active: sidebarTab === 'recognize' }"
            :disabled="isSyncRunning"
            @click="switchSidebarTab('recognize')"
          >
            识图导入
          </button>
          <button
            type="button"
            class="mode-tab accent"
            :class="{ active: sidebarTab === 'sync' }"
            :disabled="isSyncRunning"
            @click="switchSidebarTab('sync')"
          >
            同步至游戏
          </button>
        </nav>
      </header>

      <!-- ===============================================================
           INLINE TAB 1: 选配 (Equipment & Item Picker)
           =============================================================== -->
      <template v-if="sidebarTab === 'pick'">
        <nav class="slot-tabs" aria-label="槽位切换">
          <button
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'augment' }"
            @click="store.selectSlot({ kind: 'augment' })"
          >
            强化
          </button>
          <button
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'shield' }"
            @click="store.selectSlot({ kind: 'shield' })"
          >
            护盾
          </button>
          <button
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'weapon' && sel.index === 0 }"
            @click="
              store.selectSlot({
                kind: 'weapon',
                index: 0,
                subMode: sel.subMode || 'weapon',
              })
            "
          >
            武器 I
          </button>
          <button
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'weapon' && sel.index === 1 }"
            @click="
              store.selectSlot({
                kind: 'weapon',
                index: 1,
                subMode: sel.subMode || 'weapon',
              })
            "
          >
            武器 II
          </button>
          <button
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'backpack' }"
            @click="
              store.selectSlot({
                kind: 'backpack',
                index: sel.kind === 'backpack' ? sel.index : 0,
              })
            "
          >
            背包
          </button>
          <button
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'quickUse' }"
            @click="
              store.selectSlot({
                kind: 'quickUse',
                index: sel.kind === 'quickUse' ? sel.index : 0,
              })
            "
          >
            快捷
          </button>
          <button
            v-if="aug.auxSlots?.count"
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'aux' }"
            @click="
              store.selectSlot({
                kind: 'aux',
                index: sel.kind === 'aux' ? sel.index : 0,
              })
            "
          >
            强化栏
          </button>
          <button
            v-if="aug.safePocketSlots > 0"
            type="button"
            class="st-btn"
            :class="{ active: sel.kind === 'safePocket' }"
            @click="
              store.selectSlot({
                kind: 'safePocket',
                index: sel.kind === 'safePocket' ? sel.index : 0,
              })
            "
          >
            安全袋
          </button>
        </nav>

        <!-- 1A. Augment Picker -->
        <div v-if="sel.kind === 'augment'" class="ldp-view">
          <div class="filter-bar">
            <div class="chip-row">
              <button
                v-for="t in augFamilyTabs"
                :key="t.id"
                type="button"
                class="f-chip"
                :class="{ active: augFamilyFilter === t.id }"
                @click="augFamilyFilter = t.id"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <div class="scroll-list">
            <button
              v-for="item in filteredAugments"
              :key="item.id"
              type="button"
              class="pick-card"
              :class="{ active: store.currentLoadout.augmentId === item.id }"
              :style="{ '--rc': store.rarityMeta[item.rarity]?.color || '#a4a5aa' }"
              draggable="true"
              @dragstart="
                startLoadoutDrag($event, {
                  kind: 'picker-augment',
                  augmentId: item.id,
                })
              "
              @click="store.setAugment(item.id)"
            >
              <div class="pc-icon">
                <img
                  :src="store.assetUrl(item.icon)"
                  :alt="item.zhName"
                  loading="lazy"
                  draggable="false"
                />
              </div>
              <div class="pc-main">
                <div class="pc-title-row">
                  <strong class="pc-name">{{ item.zhName }}</strong>
                  <span class="pc-sub">{{ item.shieldLabel }}</span>
                </div>
                <div class="pc-tags">
                  <span class="m-tag">背包 {{ item.backpackSlots }}</span>
                  <span class="m-tag">快捷 {{ item.quickUseSlots }}</span>
                  <span v-if="item.safePocketSlots > 0" class="m-tag">
                    安全袋 {{ item.safePocketSlots }}
                  </span>
                  <span v-if="item.auxSlots" class="m-tag cyan">
                    {{ item.auxSlots.label }}×{{ item.auxSlots.count }}
                  </span>
                  <span v-if="item.integratedItem" class="m-tag amber">
                    {{ item.integratedItem.zhName }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- 1B. Shield Picker -->
        <div v-else-if="sel.kind === 'shield'" class="ldp-view">
          <div class="filter-bar">
            <div class="focused-bar">
              <span>允许护盾：<strong>{{ aug.shieldLabel }}</strong></span>
              <button
                v-if="store.currentLoadout.shieldId"
                type="button"
                class="mini-act-btn"
                @click="store.setShield(null)"
              >
                卸下
              </button>
            </div>
          </div>

          <div class="scroll-list">
            <button
              v-for="shItem in store.data.shields"
              :key="shItem.id"
              type="button"
              class="pick-card"
              :class="{
                active: store.currentLoadout.shieldId === shItem.id,
                locked: !aug.allowedShields.includes(shItem.id),
              }"
              :style="{
                '--rc': store.rarityMeta[shItem.rarity]?.color || '#00a9f2',
              }"
              :draggable="aug.allowedShields.includes(shItem.id)"
              @dragstart="
                startLoadoutDrag($event, {
                  kind: 'picker-shield',
                  shieldId: shItem.id,
                })
              "
              @click="store.setShield(shItem.id)"
            >
              <div class="pc-icon">
                <img
                  :src="store.assetUrl(shItem.icon)"
                  :alt="shItem.zhName"
                  draggable="false"
                />
              </div>
              <div class="pc-main">
                <div class="pc-title-row">
                  <strong class="pc-name">{{ shItem.zhName }}</strong>
                  <span
                    v-if="!aug.allowedShields.includes(shItem.id)"
                    class="lock-pill"
                  >
                    受限
                  </span>
                </div>
                <div class="pc-tags">
                  <span class="m-tag hi">充能 {{ shItem.charge }}</span>
                  <span class="m-tag pos">减伤 {{ shItem.mitigationPct }}%</span>
                  <span v-if="shItem.movePenaltyPct > 0" class="m-tag warn">
                    移速 -{{ shItem.movePenaltyPct }}%
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- 1C. Weapon / Mod / Amp Picker -->
        <div v-else-if="sel.kind === 'weapon'" class="ldp-view">
          <div class="filter-bar">
            <!-- Active Weapon Quick Controls (Tier I–IV + Swap + Clear) -->
            <div v-if="activeWeaponDetail" class="focused-bar">
              <strong class="fb-name">{{ activeWeaponDetail.weapon.zhName }}</strong>
              <div class="fb-right">
                <div
                  v-if="activeWeaponDetail.weapon.tiers?.length > 1"
                  class="tier-pills"
                >
                  <button
                    v-for="t in activeWeaponDetail.weapon.tiers"
                    :key="t.tier"
                    type="button"
                    class="tp-btn"
                    :class="{ active: activeWeaponDetail.entry.tier === t.tier }"
                    @click="store.setWeaponTier(activeWeaponIndex, t.tier)"
                  >
                    {{ t.roman }}
                  </button>
                </div>
                <button
                  v-if="activeWeaponDetail.hasAscendedVariant"
                  type="button"
                  class="mini-act-btn amp-toggle"
                  :class="{ active: activeWeaponDetail.amplified }"
                  title="切换增强型版本 (Ascended，橙色传说品质)"
                  @click="store.setWeaponAmplified(activeWeaponIndex, !activeWeaponDetail.amplified)"
                >
                  增强
                </button>
                <button
                  type="button"
                  class="mini-act-btn"
                  title="互换主副武器"
                  @click="store.swapWeapons()"
                >
                  ⇄
                </button>
                <button
                  type="button"
                  class="mini-act-btn"
                  @click="store.setWeapon(activeWeaponIndex, null)"
                >
                  卸下
                </button>
              </div>
            </div>

            <div class="w-subtabs">
              <button
                type="button"
                class="wst-btn"
                :class="{ active: sel.subMode !== 'mod' && sel.subMode !== 'amp' }"
                @click="
                  store.selectSlot({
                    kind: 'weapon',
                    index: activeWeaponIndex,
                    subMode: 'weapon',
                  })
                "
              >
                枪械 ({{ store.weaponsList.length }})
              </button>
              <button
                type="button"
                class="wst-btn"
                :disabled="!activeWeaponDetail"
                :class="{ active: sel.subMode === 'mod' }"
                @click="
                  store.selectSlot({
                    kind: 'weapon',
                    index: activeWeaponIndex,
                    subMode: 'mod',
                  })
                "
              >
                配件 ({{ activeWeaponDetail?.weapon?.modSlots?.length || 0 }})
              </button>
              <button
                v-if="activeWeaponDetail?.weapon?.amplifications?.length"
                type="button"
                class="wst-btn"
                :class="{ active: sel.subMode === 'amp' }"
                @click="
                  store.selectSlot({
                    kind: 'weapon',
                    index: activeWeaponIndex,
                    subMode: 'amp',
                  })
                "
              >
                5级增强 ({{ activeWeaponDetail.weapon.amplifications.length }})
              </button>
            </div>

            <!-- Weapon Search & Class Filter -->
            <template v-if="sel.subMode !== 'mod' && sel.subMode !== 'amp'">
              <input
                v-model="weaponSearch"
                type="text"
                class="s-input"
                placeholder="搜索武器 / 弹药..."
              />
              <div class="chip-row">
                <button
                  v-for="c in classTabs"
                  :key="c.id"
                  type="button"
                  class="f-chip"
                  :class="{ active: weaponClassFilter === c.id }"
                  @click="weaponClassFilter = c.id"
                >
                  {{ c.label }}
                </button>
              </div>
            </template>

            <!-- Mod Slot Selector -->
            <template v-else-if="sel.subMode === 'mod' && activeWeaponDetail">
              <div class="chip-row">
                <button
                  v-for="sk in activeWeaponDetail.weapon.modSlots"
                  :key="sk"
                  type="button"
                  class="f-chip"
                  :class="{
                    active: currentModSlotKey === sk,
                    locked: Boolean(activeWeaponDetail.lockedSlots[sk]),
                  }"
                  @click="store.selectedSlot.modSlotKey = sk"
                >
                  {{ store.slotLabels[sk]?.name || sk }}
                </button>
              </div>
            </template>
          </div>

          <!-- Firearms List -->
          <div v-if="sel.subMode !== 'mod' && sel.subMode !== 'amp'" class="scroll-list">
            <button
              v-for="w in enrichedWeapons"
              :key="w.id"
              type="button"
              class="pick-card weapon-row"
              :class="{ active: activeWeaponDetail?.weapon?.id === w.id }"
              :style="{ '--rc': w.rColor }"
              draggable="true"
              title="点击装配或拖入左侧武器栏"
              @dragstart="
                startLoadoutDrag($event, {
                  kind: 'picker-weapon',
                  weaponId: w.id,
                })
              "
              @click="store.setWeapon(activeWeaponIndex, w.id)"
            >
              <div class="wp-thumb">
                <img
                  :src="store.assetUrl(w.image)"
                  :alt="w.zhName"
                  loading="lazy"
                  draggable="false"
                />
              </div>
              <div class="pc-main">
                <div class="pc-title-row">
                  <strong class="pc-name">{{ w.zhName }}</strong>
                </div>
                <div class="pc-tags">
                  <span class="m-tag">{{ w.zhClass }}</span>
                  <span class="m-tag">{{ w.zhAmmo }}</span>
                  <span class="m-tag ar-num">弹匣 {{ w.mag }}</span>
                </div>
              </div>
            </button>
          </div>

          <!-- Mods List -->
          <div
            v-else-if="sel.subMode === 'mod' && activeWeaponDetail"
            class="scroll-list"
          >
            <div v-if="!activeWeaponDetail.weapon.modSlots?.length" class="empty-tip">
              该武器无配件槽
            </div>
            <div
              v-else-if="
                currentModSlotKey && activeWeaponDetail.lockedSlots[currentModSlotKey]
              "
              class="empty-tip warn"
            >
              已被「{{ activeWeaponDetail.lockedSlots[currentModSlotKey] }}」锁定
            </div>
            <template v-else-if="currentModSlotKey">
              <button
                v-if="activeWeaponDetail.entry.mods?.[currentModSlotKey]"
                type="button"
                class="clear-slot-bar"
                @click="store.setWeaponMod(activeWeaponIndex, currentModSlotKey, null)"
              >
                ✕ 卸下当前配件
              </button>

              <button
                v-for="m in compatibleMods"
                :key="m.id"
                type="button"
                class="pick-card"
                :class="{
                  active: activeWeaponDetail.entry.mods?.[currentModSlotKey] === m.id,
                }"
                :style="{ '--rc': m.color }"
                draggable="true"
                @dragstart="
                  startLoadoutDrag($event, {
                    kind: 'picker-mod',
                    modId: m.id,
                    modSlotKey: currentModSlotKey,
                  })
                "
                @click="
                  store.setWeaponMod(
                    activeWeaponIndex,
                    currentModSlotKey,
                    activeWeaponDetail.entry.mods?.[currentModSlotKey] === m.id
                      ? null
                      : m.id,
                  )
                "
              >
                <div class="pc-icon sm">
                  <img
                    :src="
                      store.assetUrl(m.image) || slotPlaceholderImg(currentModSlotKey)
                    "
                    :alt="m.zhName"
                    loading="lazy"
                    draggable="false"
                  />
                </div>
                <div class="pc-main">
                  <div class="pc-title-row">
                    <strong class="pc-name">{{ m.zhName || m.name }}</strong>
                  </div>
                  <div class="pc-tags">
                    <span
                      v-for="(ef, idx) in m.effects"
                      :key="idx"
                      class="m-tag"
                      :class="ef.tone === 'pos' ? 'pos' : ef.tone === 'neg' ? 'warn' : ''"
                    >
                      {{ ef.text }}
                    </span>
                  </div>
                </div>
              </button>
            </template>
          </div>

          <!-- Tier 5 Amplifications List -->
          <div
            v-else-if="sel.subMode === 'amp' && activeWeaponDetail"
            class="scroll-list"
          >
            <button
              v-for="amp in activeWeaponDetail.weapon.amplifications"
              :key="amp.id"
              type="button"
              class="pick-card"
              :class="{ active: activeWeaponDetail.entry.ampIds.includes(amp.id) }"
              style="--rc: #ffc600"
              @click="store.toggleWeaponAmp(activeWeaponIndex, amp)"
            >
              <div class="pc-main">
                <div class="pc-title-row">
                  <strong class="pc-name">{{ shortAmpName(amp) }}</strong>
                  <span
                    v-if="activeWeaponDetail.entry.ampIds.includes(amp.id)"
                    class="m-tag amber"
                  >
                    已启用
                  </span>
                  <span
                    v-else-if="
                      getAmpRestrictionState(
                        activeWeaponDetail.weapon,
                        amp,
                        activeWeaponDetail.entry.ampIds,
                      ).reasonText
                    "
                    class="m-tag warn"
                  >
                    {{
                      getAmpRestrictionState(
                        activeWeaponDetail.weapon,
                        amp,
                        activeWeaponDetail.entry.ampIds,
                      ).reasonText
                    }}
                  </span>
                </div>
                <div class="pc-tags">
                  <span
                    v-for="(ef, idx) in toEffects(amp.zhEffects).slice(0, 3)"
                    :key="idx"
                    class="m-tag"
                    :class="ef.tone === 'pos' ? 'pos' : ef.tone === 'neg' ? 'warn' : ''"
                  >
                    {{ ef.text }}
                  </span>
                </div>
              </div>
            </button>
          </div>
        </div>

        <!-- 1D. Item Container Picker (Backpack / Quick Use / Aux / Safe Pocket) -->
        <div v-else class="ldp-view">
          <div class="filter-bar">
            <div v-if="focusedItemSlotInfo" class="focused-bar">
              <span class="fb-slot">
                <strong>{{ focusedItemSlotInfo.label }}</strong>
                <em v-if="focusedItemSlotInfo.item" class="fb-item">
                  · {{ focusedItemSlotInfo.item.zhName }}
                </em>
              </span>

              <div v-if="focusedItemSlotInfo.item" class="fb-right">
                <div
                  v-if="focusedItemSlotInfo.item.maxStack > 1"
                  class="stack-stepper"
                >
                  <button
                    type="button"
                    @click="
                      store.adjustContainerCount(
                        focusedItemSlotInfo.container,
                        focusedItemSlotInfo.index,
                        -1,
                      )
                    "
                  >
                    −
                  </button>
                  <strong class="ar-num">
                    ×{{ focusedItemSlotInfo.stack }}
                  </strong>
                  <button
                    type="button"
                    :disabled="
                      focusedItemSlotInfo.stack >= focusedItemSlotInfo.item.maxStack
                    "
                    @click="
                      store.adjustContainerCount(
                        focusedItemSlotInfo.container,
                        focusedItemSlotInfo.index,
                        1,
                      )
                    "
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  class="mini-act-btn"
                  @click="handlePickContainerItem(null)"
                >
                  清空
                </button>
              </div>
            </div>

            <input
              v-model="itemSearch"
              type="text"
              class="s-input"
              placeholder="搜索弹药 / 医疗 / 投掷 / 钥匙 / 材料..."
            />

            <div v-if="itemCategoryTabs.length > 1" class="chip-row">
              <button
                v-for="cat in itemCategoryTabs"
                :key="cat.id"
                type="button"
                class="f-chip"
                :class="{ active: itemCatFilter === cat.id }"
                @click="itemCatFilter = cat.id"
              >
                {{ cat.label }}
              </button>
            </div>
          </div>

          <div class="scroll-list">
            <button
              v-for="it in filteredItems"
              :key="it.id"
              type="button"
              class="pick-card"
              :class="{ active: focusedItemSlotInfo?.item?.id === it.id }"
              :style="{ '--rc': store.rarityMeta[it.rarity]?.color || '#a4a5aa' }"
              draggable="true"
              title="点击放入当前格，或直接拖入任意栏位"
              @dragstart="
                startLoadoutDrag($event, {
                  kind: 'picker-item',
                  itemId: it.id,
                })
              "
              @click="handlePickContainerItem(it.id)"
            >
              <div class="pc-icon sm">
                <img
                  :src="store.assetUrl(it.icon)"
                  :alt="it.zhName"
                  loading="lazy"
                  draggable="false"
                />
              </div>
              <div class="pc-main">
                <div class="pc-title-row">
                  <strong class="pc-name">{{ it.zhName }}</strong>
                  <span class="pc-sub ar-num">×{{ it.maxStack }}</span>
                </div>
                <div class="pc-tags">
                  <span class="m-tag">{{ it.categoryLabel }}</span>
                  <span
                    v-for="st in (it.statTags || []).slice(0, 2)"
                    :key="st"
                    class="m-tag hi"
                  >
                    {{ st }}
                  </span>
                </div>
              </div>
            </button>

            <div v-if="!filteredItems.length" class="empty-tip">无匹配道具</div>
          </div>
        </div>
      </template>

      <!-- ===============================================================
           INLINE TAB 2: 战备分享 (Share Code, Link & Local Saves — NO Presets)
           =============================================================== -->
      <div v-else-if="sidebarTab === 'share'" class="ldp-view pad-view">
        <div class="inline-block">
          <div class="ib-title">分享码与链接</div>
          <div class="inp-row">
            <input type="text" readonly :value="shareCode" class="s-input mono" />
            <button
              type="button"
              class="act-btn primary"
              @click="copyText(shareCode, '战备码')"
            >
              复制码
            </button>
            <button type="button" class="act-btn" @click="copyShareUrl">
              链接
            </button>
          </div>

          <div class="inp-row">
            <input
              v-model="shareInput"
              type="text"
              class="s-input"
              placeholder="粘贴 ARL.xxx 战备码或分享链接..."
              @keydown.enter="handleImportShareCode"
            />
            <button
              type="button"
              class="act-btn"
              :disabled="!shareInput.trim()"
              @click="handleImportShareCode"
            >
              导入
            </button>
          </div>
        </div>

        <div class="inline-block grow-block">
          <div class="ib-title">本地存档 ({{ store.savedLoadouts.length }}/12)</div>
          <div class="inp-row">
            <input
              v-model="customSaveName"
              type="text"
              class="s-input"
              placeholder="输入存档名称..."
              @keydown.enter="handleSaveLoadout"
            />
            <button
              type="button"
              class="act-btn primary"
              @click="handleSaveLoadout"
            >
              保存
            </button>
          </div>

          <div v-if="!store.savedLoadouts.length" class="empty-tip">
            暂无本地战备存档
          </div>
          <div v-else class="saves-scroll">
            <div
              v-for="sv in store.savedLoadouts"
              :key="sv.id"
              class="save-row"
            >
              <div class="sr-info">
                <strong>{{ sv.name }}</strong>
                <span>{{ describeLoadoutBrief(sv.loadout) }}</span>
              </div>
              <div class="sr-acts">
                <button
                  type="button"
                  class="mini-act-btn primary"
                  @click="store.loadCustomLoadout(sv.id)"
                >
                  载入
                </button>
                <button
                  type="button"
                  class="mini-act-btn"
                  @click="
                    copyText(
                      store.encodeLoadoutToShareCode(sv.loadout),
                      '存档分享码',
                    )
                  "
                >
                  码
                </button>
                <button
                  type="button"
                  class="mini-act-btn danger"
                  @click="store.deleteCustomLoadout(sv.id)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===============================================================
           INLINE TAB 3: 识图导入 (Inline Screenshot / Game Capture Import)
           =============================================================== -->
      <div v-else-if="sidebarTab === 'recognize'" class="ldp-view pad-view">
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          hidden
          @change="onFileSelected"
        />

        <div
          class="inline-dropzone"
          @dragover.prevent
          @drop="onDropImage"
          @click="triggerFileSelect"
        >
          <strong>Ctrl+V 粘贴战备截图 · 拖入或点击上传</strong>
          <div class="idz-btns" @click.stop>
            <button
              v-if="isDesktop"
              type="button"
              class="act-btn primary"
              :disabled="isRecognizing"
              @click="handleCaptureGameForRecognize"
            >
              {{ isRecognizing ? '识别中...' : '抓取游戏窗口' }}
            </button>
            <button
              type="button"
              class="act-btn"
              :disabled="isRecognizing"
              @click="handleReadClipboard"
            >
              剪贴板
            </button>
            <button
              type="button"
              class="act-btn"
              :disabled="isRecognizing"
              @click="triggerFileSelect"
            >
              选择图片
            </button>
          </div>
        </div>

        <div v-if="recognizeError" class="inline-msg err">{{ recognizeError }}</div>

        <div v-if="recognizedResult?.ok" class="inline-block grow-block">
          <div class="rec-summary-bar">
            <img
              v-if="previewUrl"
              :src="previewUrl"
              alt=""
              class="rec-thumb"
            />
            <div class="rsb-txt">
              <strong>已识别 {{ recognizedSlotsView.length }} 项装备/物资</strong>
              <span>{{ describeLoadoutBrief(recognizedResult.loadout) }}</span>
            </div>
          </div>

          <div class="inp-row">
            <input
              v-model="saveImportName"
              type="text"
              class="s-input"
              placeholder="可选存档名称..."
            />
            <button
              type="button"
              class="act-btn"
              @click="applyRecognizedAction(true)"
            >
              存为存档
            </button>
            <button
              type="button"
              class="act-btn primary"
              @click="applyRecognizedAction(false)"
            >
              应用
            </button>
          </div>

          <div class="sync-slot-scroll">
            <div
              v-for="s in recognizedSlotsView"
              :key="s.key"
              class="sync-slot-row"
              :style="{ '--sc': s.color }"
            >
              <img :src="s.icon" alt="" />
              <div class="ssr-info">
                <div class="ssr-top">
                  <small>{{ s.slotLabel }}</small>
                  <strong>{{ s.targetName }}</strong>
                </div>
                <div v-if="s.subTags?.length" class="ssr-sub">
                  {{ s.subTags.slice(0, 3).join(' · ') }}
                </div>
              </div>
              <em class="ar-num">{{ s.badge }}</em>
            </div>
          </div>
        </div>
      </div>

      <!-- ===============================================================
           INLINE TAB 4: 同步至游戏 (Perspective Guide + Auto Stash Sync)
           =============================================================== -->
      <div v-else-if="sidebarTab === 'sync'" class="ldp-view pad-view">
        <div class="inline-block">
          <div class="ib-head-between">
            <span class="ib-title">目标战备</span>
            <span
              v-if="isDesktop"
              class="win-status"
              :class="{ ok: gameWinStatus?.found }"
            >
              <i></i>
              {{ gameWinStatus?.found ? '游戏在线' : '未检测到游戏' }}
            </span>
          </div>

          <select
            v-model="selectedSourceKey"
            class="s-select"
            :disabled="isSyncRunning"
          >
            <option
              v-for="src in availableLoadoutSources"
              :key="src.key"
              :value="src.key"
            >
              [{{ src.group }}] {{ src.name }}
            </option>
          </select>

          <button
            type="button"
            class="act-btn amber full-w"
            :disabled="isSyncRunning || !liveDiff?.totalTargetSlots"
            @click="handleLaunchPerspectiveGuide"
          >
            全屏透视配装指引 (Alt+F)
          </button>

          <div
            v-if="isDesktop"
            class="weapon-wait-row"
            :class="{ disabled: syncOptions.quickUseOnly }"
            :title="
              syncOptions.quickUseOnly
                ? '已开启「只自动配装快速使用」，自动跳过武器 3D 渲染等待'
                : '新版游戏武器缩略图为实时 3D 渲染，加载较慢；选中武器栏、翻页查找武器、拖入武器后都会等待该时长再识别'
            "
          >
            <span class="ww-label">武器加载等待</span>
            <input
              v-model.number="weaponLoadWaitSec"
              type="range"
              min="0"
              max="15"
              step="0.5"
              :disabled="isSyncRunning || syncOptions.quickUseOnly"
            />
            <span v-if="syncOptions.quickUseOnly" class="ww-skip">已跳过</span>
            <template v-else>
              <input
                v-model.number="weaponLoadWaitSec"
                type="number"
                class="ww-num"
                min="0"
                max="15"
                step="0.5"
                :disabled="isSyncRunning"
              />
              <span class="ww-unit">秒</span>
            </template>
          </div>

          <div v-if="isDesktop" class="sync-opts-box">
            <div class="so-checks">
              <label
                class="so-chk wide so-chk-scope"
                title="启用后只识别和配装快速使用栏位里的道具，跳过武器等待及其他所有装备栏位"
              >
                <input
                  v-model="syncOptions.quickUseOnly"
                  type="checkbox"
                  :disabled="isSyncRunning"
                />
                <span>只自动配装快速使用</span>
                <em class="so-opt-pill" :class="{ active: syncOptions.quickUseOnly }">仅快捷栏</em>
              </label>
              <label
                class="so-chk"
                :class="{ disabled: syncOptionsUi.weaponOptsDisabled }"
                :title="syncOptionsUi.weaponTierTitle"
              >
                <input
                  type="checkbox"
                  :checked="syncOptionsUi.weaponTierChecked"
                  :disabled="isSyncRunning || syncOptionsUi.weaponOptsDisabled"
                  @change="syncOptions.syncWeaponTier = $event.target.checked"
                />
                <span>匹配武器等级 (I~IV)</span>
              </label>
              <label
                class="so-chk"
                :class="{ disabled: syncOptionsUi.weaponOptsDisabled }"
                :title="syncOptionsUi.weaponModsTitle"
              >
                <input
                  type="checkbox"
                  :checked="syncOptionsUi.weaponModsChecked"
                  :disabled="isSyncRunning || syncOptionsUi.weaponOptsDisabled"
                  @change="syncOptions.syncWeaponMods = $event.target.checked"
                />
                <span>同步武器配件</span>
              </label>
              <label class="so-chk wide" title="仓库找不到缺失物品时，自动前往商人购买或工坊制造（跳过游牧使团与以物易物项）">
                <input
                  v-model="syncOptions.autoRestockEnabled"
                  type="checkbox"
                  :disabled="isSyncRunning"
                />
                <span>仓库缺失时自动补货 (商人/工坊)</span>
              </label>
            </div>

            <div v-if="syncOptions.autoRestockEnabled" class="so-restock-sub">
              <select
                v-model="syncOptions.restockSourcePolicy"
                class="s-select"
                :disabled="isSyncRunning"
              >
                <option
                  v-for="opt in RESTOCK_POLICY_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </option>
              </select>
              <div class="so-checks">
                <label
                  class="so-chk"
                  :class="{ disabled: syncOptionsUi.ammoPreferDisabled }"
                  :title="syncOptionsUi.ammoPreferTitle"
                >
                  <input
                    type="checkbox"
                    :checked="syncOptionsUi.ammoPreferChecked"
                    :disabled="isSyncRunning || syncOptionsUi.ammoPreferDisabled"
                    @change="syncOptions.ammoPreferTrader = $event.target.checked"
                  />
                  <span>弹药优先商人</span>
                </label>
                <label
                  class="so-chk"
                  :class="{ disabled: syncOptionsUi.progressionDisabled }"
                  :title="syncOptionsUi.progressionTitle"
                >
                  <input
                    type="checkbox"
                    :checked="syncOptionsUi.progressionChecked"
                    :disabled="isSyncRunning || syncOptionsUi.progressionDisabled"
                    @change="syncOptions.respectLocalProgression = $event.target.checked"
                  />
                  <span>按工坊/蓝图档案预筛</span>
                </label>
              </div>
            </div>
          </div>

          <div v-if="isDesktop" class="inp-row">
            <button
              type="button"
              class="act-btn flex-1"
              :disabled="isSyncRunning || precheckLoading"
              @click="handlePrecheck"
            >
              {{ precheckLoading ? '扫描中...' : '读取实机差量' }}
            </button>
            <button
              v-if="!isSyncRunning"
              type="button"
              class="act-btn primary flex-1"
              :disabled="!liveDiff?.totalTargetSlots"
              @click="handleStartAutoSync"
            >
              {{ syncOptionsUi.getPrimaryActionLabel(true) }}
            </button>
            <button
              v-else
              type="button"
              class="act-btn danger flex-1"
              @click="handleStopSync"
            >
              急停 (ESC)
            </button>
          </div>

          <div v-if="isSyncRunning && syncStatusMsg" class="inline-msg info">
            {{ syncStatusMsg }}
          </div>
          <div v-if="precheckError" class="inline-msg err">{{ precheckError }}</div>
          <div v-if="syncBanner" class="inline-msg" :class="syncBanner.type">
            {{ syncBanner.text }}
          </div>
        </div>

        <div v-if="liveDiff?.entries?.length" class="inline-block grow-block">
          <div class="ib-head-between">
            <span class="ib-title">{{ syncOptions.quickUseOnly ? '快捷栏清单' : '槽位清单' }} ({{ liveDiff.totalTargetSlots }})</span>
            <span v-if="liveDiff.hasLiveSnapshot" class="diff-count ar-num">
              就绪 <b class="ok">{{ liveDiff.matchedCount }}</b> · 待装
              <b class="warn">{{ liveDiff.pendingCount }}</b>
            </span>
          </div>

          <div class="sync-slot-scroll">
            <div
              v-for="e in liveDiff.entries"
              :key="e.key"
              class="sync-slot-row"
              :class="{ matched: e.matched }"
              :style="{ '--sc': e.color }"
            >
              <img :src="e.icon" alt="" />
              <div class="ssr-info">
                <div class="ssr-top">
                  <small>{{ e.slotLabel }}</small>
                  <strong>{{ e.targetName }}</strong>
                </div>
                <div v-if="e.subTags?.length || (!e.matched && e.restockBadge)" class="ssr-sub">
                  <span v-if="!e.matched && e.restockBadge" class="ssr-restock-tag">
                    {{ e.restockBadge }}
                  </span>
                  <span v-if="e.subTags?.length">{{ e.subTags.slice(0, 3).join(' · ') }}</span>
                </div>
              </div>
              <em class="ar-num">{{ e.matched ? '✓' : e.badge }}</em>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.ldp-shell {
  position: relative;
  width: 356px;
  flex-shrink: 0;
  height: 100%;
  transition: width 0.2s ease;
}

.ldp-shell.is-collapsed {
  width: 0;
}

.ldp-reopen-btn {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(13, 18, 34, 0.94);
  color: #f4efe6;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
}

.ldp-reopen-btn:hover {
  border-color: #5fffff;
  color: #5fffff;
}

.ldp-panel {
  width: 356px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0c1120;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  transition: transform 0.2s ease;
}

.ldp-shell.is-collapsed .ldp-panel {
  transform: translateX(100%);
  pointer-events: none;
}

/* ============================================================================
   Top Header & 4-Way Inline Mode Tabs
   ============================================================================ */
.ldp-top {
  padding: 10px 12px 0;
  background: #0e1526;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.top-brand {
  display: flex;
  align-items: center;
  gap: 7px;
}

.brand-bar {
  width: 3px;
  height: 15px;
  border-radius: 2px;
  background: #5fffff;
  box-shadow: 0 0 8px rgba(95, 255, 255, 0.5);
}

.brand-title {
  margin: 0;
  font-family: var(--font-display, sans-serif);
  font-size: 15px;
  font-weight: 800;
  color: #f4efe6;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.mini-top-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #cfd2dc;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.14s ease;
}

.mini-top-btn:hover:not(:disabled) {
  border-color: rgba(95, 255, 255, 0.55);
  color: #5fffff;
}

.mini-top-btn.danger:hover:not(:disabled) {
  border-color: #ff4a3d;
  color: #ff6257;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.03);
  color: #aeb4c4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.collapse-btn:hover {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.mode-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
}

.mode-tab {
  position: relative;
  height: 32px;
  padding: 0 4px;
  border: none;
  background: none;
  color: #8f96a8;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: color 0.14s ease;
}

.mode-tab:hover:not(:disabled) {
  color: #e4e6ed;
}

.mode-tab.active {
  color: #5fffff;
}

.mode-tab.accent.active {
  color: #ffbc13;
}

.mode-tab.active::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 0;
  height: 2px;
  background: currentColor;
  border-radius: 2px 2px 0 0;
}

/* ============================================================================
   Slot Category Switcher Strip (Inside Pick Tab)
   ============================================================================ */
.slot-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 10px;
  background: #0a0f1d;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.st-btn {
  height: 24px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: #9ba2b4;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.13s ease;
}

.st-btn:hover {
  color: #f0ece4;
  border-color: rgba(255, 255, 255, 0.24);
}

.st-btn.active {
  border-color: rgba(95, 255, 255, 0.55);
  background: rgba(95, 255, 255, 0.12);
  color: #5fffff;
}

/* ============================================================================
   Picker Views & Lists
   ============================================================================ */
.ldp-view {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pad-view {
  padding: 10px;
  gap: 10px;
  overflow-y: auto;
}

.filter-bar {
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}

.focused-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 26px;
  font-size: 12px;
  color: #cfd3de;
}

.fb-name,
.fb-slot {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fb-item {
  font-style: normal;
  color: #5fffff;
  font-weight: 700;
}

.fb-right {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.tier-pills {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
}

.tp-btn {
  min-width: 22px;
  height: 20px;
  padding: 0 4px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: #9ba2b4;
  font-family: Georgia, serif;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.tp-btn.active {
  background: rgba(95, 255, 255, 0.2);
  color: #5fffff;
}

.stack-stepper {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
}

.stack-stepper button {
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  color: #f3efe6;
  font-weight: 800;
  cursor: pointer;
}

.stack-stepper button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stack-stepper strong {
  font-size: 11.5px;
  color: #5fffff;
  min-width: 24px;
  text-align: center;
}

.mini-act-btn {
  height: 22px;
  padding: 0 7px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
  color: #d2d5df;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.mini-act-btn:hover {
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
}

.mini-act-btn.primary {
  border-color: rgba(95, 255, 255, 0.45);
  color: #5fffff;
}

.mini-act-btn.danger:hover {
  border-color: #ff4a3d;
  color: #ff6257;
}

.mini-act-btn.amp-toggle.active {
  border-color: rgba(255, 198, 0, 0.7);
  background: rgba(255, 198, 0, 0.16);
  color: #ffc600;
}

.w-subtabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}

.wst-btn {
  height: 26px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: #9ba2b4;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.wst-btn.active {
  border-color: rgba(95, 255, 255, 0.5);
  background: rgba(95, 255, 255, 0.11);
  color: #f4efe6;
}

.wst-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.s-input,
.s-select {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #080c18;
  color: #f2efe8;
  font-size: 12px;
  outline: none;
}

.s-input:focus,
.s-select:focus {
  border-color: rgba(95, 255, 255, 0.55);
}

.s-input.mono {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.f-chip {
  height: 22px;
  padding: 0 7px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: #969db0;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.f-chip.active {
  border-color: rgba(95, 255, 255, 0.5);
  background: rgba(95, 255, 255, 0.12);
  color: #5fffff;
}

.f-chip.locked {
  opacity: 0.4;
}

.scroll-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.clear-slot-bar {
  height: 28px;
  border-radius: 5px;
  border: 1px dashed rgba(255, 92, 82, 0.45);
  background: rgba(255, 74, 61, 0.08);
  color: #ff7c73;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.pick-card {
  --rc: #a4a5aa;
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 9px;
  text-align: left;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-left: 3px solid var(--rc);
  background: #101729;
  color: #eef0f5;
  cursor: pointer;
  transition: all 0.13s ease;
}

.pick-card:hover:not(.locked) {
  background: #151e35;
  border-color: rgba(255, 255, 255, 0.25);
  border-left-color: var(--rc);
}

.pick-card.active {
  background: rgba(95, 255, 255, 0.08);
  border-color: rgba(95, 255, 255, 0.55);
  border-left-color: #5fffff;
}

.pick-card.locked {
  opacity: 0.42;
  cursor: not-allowed;
}

.pc-icon {
  width: 42px;
  height: 42px;
  border-radius: 5px;
  background: rgba(7, 10, 20, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pc-icon.sm {
  width: 36px;
  height: 36px;
}

.pc-icon img {
  max-width: 84%;
  max-height: 84%;
  object-fit: contain;
}

.wp-thumb {
  width: 68px;
  height: 38px;
  border-radius: 5px;
  background: rgba(7, 10, 20, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wp-thumb img {
  max-width: 90%;
  max-height: 88%;
  object-fit: contain;
}

.pc-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pc-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.pc-name {
  font-size: 12.5px;
  font-weight: 800;
  color: #f4efe6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pc-sub {
  font-size: 11px;
  color: #969db0;
  flex-shrink: 0;
}

.lock-pill {
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 74, 61, 0.16);
  color: #ff6e63;
  font-size: 10px;
  font-weight: 800;
}

.pc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.m-tag {
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.05);
  color: #a9b0c2;
  font-size: 10.5px;
  font-weight: 600;
}

.m-tag.hi {
  color: #e9ecf4;
}

.m-tag.pos {
  color: #46df7a;
}

.m-tag.warn {
  color: #ff9c59;
}

.m-tag.cyan {
  color: #5fffff;
}

.m-tag.amber {
  color: #ffbc13;
}

/* ============================================================================
   Inline Panels: Share, Recognize, Sync
   ============================================================================ */
.inline-block {
  padding: 10px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  background: #101729;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.grow-block {
  flex: 1 1 auto;
  min-height: 0;
}

.ib-title {
  font-size: 12px;
  font-weight: 800;
  color: #f2ede4;
}

.ib-head-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.inp-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.weapon-wait-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(8, 12, 24, 0.6);
  font-size: 11.5px;
  color: rgba(242, 239, 232, 0.78);
}

.weapon-wait-row.disabled {
  opacity: 0.48;
}

.weapon-wait-row .ww-skip {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  color: #8f96a8;
}

.weapon-wait-row .ww-label {
  flex-shrink: 0;
}

.weapon-wait-row input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: #00d6e4;
}

.weapon-wait-row .ww-num {
  width: 46px;
  height: 22px;
  padding: 0 4px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: #080c18;
  color: #f2efe8;
  font-size: 11.5px;
  text-align: right;
  outline: none;
}

.weapon-wait-row .ww-unit {
  flex-shrink: 0;
  opacity: 0.7;
}

.act-btn {
  height: 30px;
  padding: 0 10px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.05);
  color: #e6e8f0;
  font-size: 11.5px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.14s ease;
}

.act-btn:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.36);
}

.act-btn.primary {
  border-color: rgba(95, 255, 255, 0.5);
  background: rgba(95, 255, 255, 0.13);
  color: #5fffff;
}

.act-btn.amber {
  border-color: rgba(255, 188, 19, 0.55);
  background: rgba(255, 188, 19, 0.14);
  color: #ffbc13;
}

.act-btn.danger {
  border-color: rgba(255, 74, 61, 0.55);
  background: rgba(255, 74, 61, 0.16);
  color: #ff6c61;
}

.act-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.full-w {
  width: 100%;
}

.flex-1 {
  flex: 1 1 0;
}

.saves-scroll,
.sync-slot-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.save-row {
  padding: 7px 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(8, 12, 24, 0.65);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sr-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sr-info strong {
  font-size: 12px;
  color: #f3efe6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sr-info span {
  font-size: 10.5px;
  color: #8f96a8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sr-acts {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.inline-dropzone {
  padding: 14px 10px;
  border-radius: 6px;
  border: 1px dashed rgba(95, 255, 255, 0.35);
  background: rgba(95, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
  cursor: pointer;
}

.inline-dropzone strong {
  font-size: 12px;
  color: #e6e8f0;
}

.idz-btns {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
}

.rec-summary-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rec-thumb {
  width: 48px;
  height: 32px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.rsb-txt {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rsb-txt strong {
  font-size: 12px;
  color: #5fffff;
}

.rsb-txt span {
  font-size: 10.5px;
  color: #9ba2b4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.win-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #8f96a8;
}

.win-status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #636b7e;
}

.win-status.ok {
  color: #46df7a;
}

.win-status.ok i {
  background: #46df7a;
  box-shadow: 0 0 6px #46df7a;
}

.diff-count {
  font-size: 11px;
  color: #9ba2b4;
}

.diff-count .ok {
  color: #46df7a;
}

.diff-count .warn {
  color: #ffbc13;
}

.sync-slot-row {
  --sc: #5fffff;
  padding: 5px 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 3px solid var(--sc);
  background: rgba(8, 12, 24, 0.65);
  display: flex;
  align-items: center;
  gap: 8px;
}

.sync-slot-row.matched {
  opacity: 0.68;
  border-left-color: #46df7a;
}

.sync-slot-row img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  flex-shrink: 0;
}

.ssr-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ssr-top {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
}

.ssr-info small {
  font-size: 10px;
  color: #8f96a8;
  flex-shrink: 0;
}

.ssr-info strong {
  font-size: 11.5px;
  color: #f2ede4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ssr-sub {
  font-size: 10px;
  color: #8f96a8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-slot-row em {
  font-style: normal;
  font-size: 11px;
  font-weight: 800;
  color: #cfd3de;
}

.inline-msg {
  padding: 7px 9px;
  border-radius: 5px;
  font-size: 11.5px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.05);
  color: #e6e8f0;
}

.inline-msg.ok {
  border: 1px solid rgba(70, 223, 122, 0.45);
  color: #46df7a;
}

.inline-msg.warn {
  border: 1px solid rgba(255, 188, 19, 0.45);
  color: #ffbc13;
}

.inline-msg.err {
  border: 1px solid rgba(255, 74, 61, 0.45);
  color: #ff6e63;
}

.inline-msg.info {
  border: 1px solid rgba(95, 255, 255, 0.4);
  color: #5fffff;
}

.empty-tip {
  padding: 20px 10px;
  text-align: center;
  font-size: 12px;
  color: #7d8599;
}

.empty-tip.warn {
  color: #ffbc13;
}

.sync-opts-box {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 7px 9px;
  border-radius: 5px;
  background: rgba(11, 14, 26, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.so-checks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 8px;
}

.so-chk {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #e6e8f0;
  cursor: pointer;
  user-select: none;
}

.so-chk.wide {
  grid-column: 1 / -1;
}

.so-chk-scope {
  padding-bottom: 6px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.1);
}

.so-opt-pill {
  margin-left: auto;
  padding: 0 5px;
  border-radius: 3px;
  font-style: normal;
  font-size: 9.5px;
  font-weight: 700;
  color: #8f96a8;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
}

.so-opt-pill.active {
  color: #5fffff;
  border-color: rgba(44, 232, 245, 0.4);
  background: rgba(44, 232, 245, 0.14);
}

.so-chk.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.so-chk input {
  margin: 0;
  accent-color: #2ce8f5;
  cursor: inherit;
}

.so-restock-sub {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.ssr-restock-tag {
  display: inline-block;
  margin-right: 5px;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(44, 232, 245, 0.14);
  border: 1px solid rgba(44, 232, 245, 0.35);
  color: #5fffff;
  font-size: 9.5px;
  font-weight: 700;
}
</style>
