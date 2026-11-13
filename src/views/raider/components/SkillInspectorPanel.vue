<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRaiderStore } from '../../../stores/useRaiderStore'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'
import { useRaiderVisionSync } from '../../../composables/useRaiderVisionSync'
import {
  abortRaiderAutoSync,
  analyzeBuildSyncDiff,
  runRaiderAutoSyncSession,
} from '../../../utils/raiderAutoSyncPlanner'

const store = useRaiderStore()
const overlayStore = useOverlayWindowStore()

// Primary inline sidebar mode: 'node' | 'share' | 'recognize' | 'sync'
const sidebarTab = ref('node')

// Share & Save state
const customBuildName = ref('')
const shareInput = ref('')

// Sync state
const selectedSourceKey = ref('current')
const showAdvancedSyncOpts = ref(false)
const isSyncRunning = ref(false)
const syncStatusMsg = ref('')
const syncResultBanner = ref(null)

const {
  isDesktop,
  fileInputRef,
  isRecognizing,
  recognizeError,
  previewUrl,
  recognizedResult,
  saveImportName,
  revokePreviewUrl,
  recognizedBranches: recognizedBranchBreakdown,
  recognizedGates: recognizedGateSkills,
  processImageSource: processImageBlobOrBuffer,
  handleCaptureGameForRecognize,
  triggerFileSelect,
  onFileSelected,
  onDropImage,
  handleReadClipboard,
  gameWinStatus,
  precheckInGameBuild,
  precheckLoading,
  precheckError,
  availableBuildSources,
  refreshGameWindowStatus,
  runPrecheckInGameState,
} = useRaiderVisionSync(store, {
  currentLabelPrefix: '当前天赋树',
  defaultRecognizeError: '未能从截图中识别出技能树结构',
  emptyClipboardError: '剪贴板中未找到截图，请先按 Win+Shift+S 或 PrintScreen 截图',
  pasteHintError: '请直接按 Ctrl + V 粘贴剪贴板截图',
  defaultPrecheckError: '未能读取游戏内技能树，请确认游戏停留在技能树画面',
  includePresets: false,
})

const sel = computed(() => store.selectedNodeState)
const currentShareCode = computed(() => store.exportShareCode())

// Whenever user selects/clicks a node on the canvas, switch inline panel back to 'node'
watch(
  () => store.selectSeq,
  (nextSeq, prevSeq) => {
    if (nextSeq !== prevSeq && prevSeq !== undefined && !isSyncRunning.value) {
      sidebarTab.value = 'node'
    }
  },
)

watch(
  () => [sel.value?.node?.slotKey, sel.value?.skill?.id],
  () => {
    if (!sel.value || sel.value.node.kind === 'normal') {
      store.selectedCandidateId = null
      return
    }
    const cands = sel.value.node.candidateIds || []
    if (!store.selectedCandidateId || !cands.includes(store.selectedCandidateId)) {
      store.selectedCandidateId = sel.value.skill?.id || cands[0] || null
    }
  },
  { immediate: true },
)

const branchInfo = computed(() => {
  if (!sel.value) return null
  return store.branchMap[sel.value.node.branch] || null
})

const gateCandidates = computed(() => {
  if (!sel.value || sel.value.node.kind === 'normal') return []
  const node = sel.value.node
  return (node.candidateIds || [])
    .map((cid) => {
      const sk = store.currentTree.skills[cid]
      if (!sk) return null
      let usedInSibling = false
      for (const other of store.currentTree.nodes) {
        if (
          other.groupId === node.groupId &&
          other.slotKey !== node.slotKey &&
          store.currentBuild.gateSelections?.[other.slotKey] === cid
        ) {
          usedInSibling = true
        }
      }
      return {
        ...sk,
        isCurrent: sel.value.skill?.id === cid,
        usedInSibling,
      }
    })
    .filter(Boolean)
})

const activeSkill = computed(() => {
  if (!sel.value) return null
  if (sel.value.node.kind === 'normal') return sel.value.skill
  const match = gateCandidates.value.find((c) => c.id === store.selectedCandidateId)
  return match || gateCandidates.value.find((c) => c.isCurrent) || gateCandidates.value[0] || null
})

const slotBadgeText = computed(() => {
  if (!sel.value) return ''
  const n = sel.value.node
  if (n.kind === 'choice') return '10P · 2选1'
  if (n.kind === 'capstone') return `${n.minBranchPoints}P · 3选2`
  return `Lv. ${sel.value.points} / ${sel.value.maxPoints}`
})

function onEquipActiveCandidate() {
  if (!sel.value || !activeSkill.value) return
  if (sel.value.skill?.id === activeSkill.value.id || activeSkill.value.usedInSibling) return
  store.selectGateSkill(sel.value.node.nodeId, activeSkill.value.id)
}

/* =========================================================================
   Share & Save Actions
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
  const url = `${window.location.origin}/raider?build=${encodeURIComponent(currentShareCode.value)}`
  void copyText(url, '链接')
}

function handleSaveBuild() {
  store.saveCustomBuild(customBuildName.value)
  customBuildName.value = ''
}

function handleImportCode() {
  if (store.importShareCode(shareInput.value)) {
    shareInput.value = ''
  }
}

/* =========================================================================
   Vision Recognition & Game Sync Actions
   ========================================================================= */
function applyRecognizedToCanvas(alsoSaveArchive = false) {
  const res = recognizedResult.value
  if (!res?.ok) return
  const applied = store.applyRecognizedBuild(res.allocations, res.gateSelections, '实机截图')
  if (!applied.ok) return
  if (alsoSaveArchive) {
    const name = saveImportName.value.trim() || `实机导入 (${res.totalPoints}P)`
    store.saveCustomBuild(name)
    saveImportName.value = ''
  }
}

const activeTargetSource = computed(
  () =>
    availableBuildSources.value.find((item) => item.key === selectedSourceKey.value) ||
    availableBuildSources.value[0],
)

const liveDiffPreview = computed(() => {
  if (!activeTargetSource.value) return null
  return analyzeBuildSyncDiff(
    precheckInGameBuild.value,
    activeTargetSource.value.build,
    store.currentTree,
  )
})

async function handlePrecheckInGameState() {
  await runPrecheckInGameState(() => {
    syncResultBanner.value = null
  })
}

async function handleStartAutoSync() {
  const src = activeTargetSource.value
  if (!src || src.spent <= 0) {
    syncResultBanner.value = {
      type: 'warn',
      text: '所选天赋尚未分配技能点，请先加点或切换存档。',
    }
    return
  }

  isSyncRunning.value = true
  syncResultBanner.value = null
  syncStatusMsg.value = '准备切入游戏窗口...'

  try {
    const res = await runRaiderAutoSyncSession({
      targetBuild: src.build,
      tree: store.currentTree,
      options: {
        smallHoldDurationMs: store.syncPrefs.smallHoldDurationMs,
        bigHoldDurationMs: store.syncPrefs.bigHoldDurationMs,
        postPointDelayMs: store.syncPrefs.postPointDelayMs,
        gateOpenMode: store.syncPrefs.gateOpenMode,
        gateConfirmMode: store.syncPrefs.gateConfirmMode,
      },
      onProgress(ev) {
        if (ev?.message) {
          syncStatusMsg.value = ev.message
        }
      },
    })

    if (!res.ok && res.needsReset) {
      precheckInGameBuild.value = res.inGameBuild || null
      syncResultBanner.value = {
        type: 'warn',
        text: res.message,
        conflicts: res.conflicts || [],
      }
    } else if (res.ok) {
      precheckInGameBuild.value = null
      syncResultBanner.value = {
        type: 'ok',
        text: res.message,
      }
      store.notify(res.message, 'ok')
    }
  } catch (err) {
    syncResultBanner.value = {
      type: err?.aborted ? 'warn' : 'err',
      text: err?.message || '同步已中断',
    }
  } finally {
    isSyncRunning.value = false
    syncStatusMsg.value = ''
    void refreshGameWindowStatus()
  }
}

async function handleStopAutoSync() {
  await abortRaiderAutoSync()
}

async function handleLaunchPerspectiveGuide() {
  const src = activeTargetSource.value
  if (!src || src.spent <= 0) {
    store.notify('请先选择有效的目标天赋（点数 > 0）', 'warn')
    return
  }
  await overlayStore.launchRaiderPerspectiveGuide({
    origin: 'main',
    title: src.name,
    targetBuild: src.build,
    inGameBuild: precheckInGameBuild.value || null,
  })
}

function switchSidebarTab(tab) {
  if (isSyncRunning.value) return
  sidebarTab.value = tab
  if (tab === 'sync') {
    void refreshGameWindowStatus()
  }
}

function openAndProcessImage(blob) {
  if (store.sidebarCollapsed) store.toggleSidebar(false)
  sidebarTab.value = 'recognize'
  void processImageBlobOrBuffer(blob, blob)
}

defineExpose({
  switchSidebarTab,
  openAndProcessImage,
})

onBeforeUnmount(() => {
  revokePreviewUrl()
})
</script>

<template>
  <div
    class="skp-shell"
    :class="{ 'is-collapsed': store.sidebarCollapsed }"
    :style="{ '--b-col': branchInfo?.color || '#5fffff' }"
  >
    <!-- Reopen Pill when Collapsed -->
    <button
      v-if="store.sidebarCollapsed"
      type="button"
      class="skp-reopen-btn"
      title="展开天赋树侧边栏"
      aria-label="展开天赋树侧边栏"
      @click="store.toggleSidebar(false)"
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
      <span>天赋树</span>
      <strong class="reopen-pts" :class="{ zero: store.remainingPoints === 0 }">
        {{ store.remainingPoints }}/{{ store.maxSkillPoints }}
      </strong>
    </button>

    <aside class="skp-panel" :aria-hidden="store.sidebarCollapsed">
      <!-- Top Hub: Brand + Points + Quick Controls + Expedition + 5 Inline Mode Tabs -->
      <header class="skp-top">
        <div class="top-row">
          <div class="top-brand">
            <span class="brand-bar"></span>
            <h2 class="brand-title">天赋树</h2>
            <div class="points-hud" :class="{ zero: store.remainingPoints === 0 }">
              <strong class="pts-remain">{{ store.remainingPoints }}</strong>
              <span class="pts-sep">/</span>
              <span class="pts-total">{{ store.maxSkillPoints }}</span>
            </div>
          </div>

          <div class="top-actions">
            <button
              type="button"
              class="mini-top-btn"
              :class="{ active: store.showXRayBadges }"
              title="切换画布技能数值角标"
              @click="store.showXRayBadges = !store.showXRayBadges"
            >
              <span class="xray-dot"></span>
              <span>角标</span>
            </button>
            <button
              type="button"
              class="mini-top-btn"
              title="呼出局内置顶悬浮窗 (Alt+Q)"
              :disabled="isSyncRunning"
              @click="
                overlayStore.openOverlayAtRaider(
                  sidebarTab === 'recognize' ? 'recognize' : 'sync',
                )
              "
            >
              悬浮窗
            </button>
            <button
              type="button"
              class="mini-top-btn danger"
              :disabled="store.totalSpentPoints === 0 || isSyncRunning"
              @click="store.resetCurrentTree()"
            >
              <span>重置</span>
              <small v-if="store.totalSpentPoints > 0" class="coin-tag">
                {{ (store.resetCoinCost / 1000).toFixed(0) }}k
              </small>
            </button>
            <button
              type="button"
              class="collapse-btn"
              title="收起侧边栏"
              :disabled="isSyncRunning"
              @click="store.toggleSidebar(true)"
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

        <div class="exp-row">
          <span class="exp-label">远征上限</span>
          <div class="exp-btns">
            <button
              v-for="exp in [0, 1, 2, 3]"
              :key="exp"
              type="button"
              class="exp-btn"
              :class="{ active: store.expeditionCount === exp }"
              :disabled="isSyncRunning"
              @click="store.setExpeditionCount(exp)"
            >
              {{ exp === 0 ? '76P' : `+${exp * 5}` }}
            </button>
          </div>
        </div>

        <!-- Primary Inline Sidebar Switcher (Replaces All Modals/Drawers) -->
        <nav class="mode-tabs" aria-label="天赋树功能切换">
          <button
            type="button"
            class="mode-tab"
            :class="{ active: sidebarTab === 'node' }"
            :disabled="isSyncRunning"
            @click="switchSidebarTab('node')"
          >
            节点
          </button>
          <button
            type="button"
            class="mode-tab"
            :class="{ active: sidebarTab === 'share' }"
            :disabled="isSyncRunning"
            @click="switchSidebarTab('share')"
          >
            天赋分享
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
           INLINE TAB 1: 节点 (Selected Skill Node Inspector & Gate Switcher)
           =============================================================== -->
      <div v-if="sidebarTab === 'node'" class="skp-view">
        <template v-if="sel && activeSkill">
          <div class="insp-header">
            <div class="insp-top-bar">
              <span class="branch-badge">
                <i class="b-dot"></i>
                {{ branchInfo?.name }}
              </span>
              <span class="slot-lv-badge" :class="{ active: sel.points > 0 }">
                {{ slotBadgeText }}
              </span>
            </div>

            <!-- Diamond Gate Candidate Tabs (Inline 2选1 / 3选2) -->
            <div v-if="sel.node.kind !== 'normal'" class="gate-tabs-wrap">
              <button
                v-for="cand in gateCandidates"
                :key="cand.id"
                type="button"
                class="gp-tab"
                :class="{ active: activeSkill.id === cand.id }"
                @click="store.selectedCandidateId = cand.id"
              >
                <img :src="cand.icon" :alt="cand.name" />
                <span>{{ cand.name }}</span>
                <em v-if="cand.isCurrent">已选</em>
                <em v-else-if="cand.usedInSibling" class="mutex">已占</em>
              </button>
            </div>

            <!-- Skill Icon + Name + Metric -->
            <div class="skill-hero">
              <div class="hero-icon-frame" :class="[`st-${sel.status}`]">
                <img :src="activeSkill.icon" :alt="activeSkill.name" />
              </div>
              <div class="hero-titles">
                <h3 class="hero-name">{{ activeSkill.name }}</h3>
                <div class="hero-metric">{{ activeSkill.statLabel }}</div>
              </div>
            </div>

            <!-- Compact Condition / Lock Tag -->
            <div v-if="activeSkill.warningText" class="mini-tag warn">
              ⚠ {{ activeSkill.warningText }}
            </div>
            <div v-if="sel.lockReason && sel.points === 0" class="mini-tag lock">
              {{ sel.lockReason }}
            </div>

            <!-- Allocation Buttons (100% Inline — No Modal Button) -->
            <div class="alloc-actions">
              <template v-if="sel.node.kind === 'normal'">
                <button
                  type="button"
                  class="node-act-btn sub"
                  :disabled="sel.points <= 0"
                  @click="store.deallocateNode(sel.node.nodeId, false)"
                >
                  −1
                </button>
                <button
                  type="button"
                  class="node-act-btn add"
                  :class="{ 'is-locked': !sel.canIncrement }"
                  @click="store.allocateNode(sel.node.nodeId, false)"
                >
                  +1
                </button>
                <button
                  v-if="sel.maxPoints > 1"
                  type="button"
                  class="node-act-btn max"
                  :class="{ 'is-locked': !sel.canIncrement }"
                  @click="store.allocateNode(sel.node.nodeId, true)"
                >
                  点满
                </button>
              </template>

              <template v-else>
                <button
                  v-if="sel.skill?.id === activeSkill.id"
                  type="button"
                  class="node-act-btn current wide"
                  disabled
                >
                  ✓ 当前已装备
                </button>
                <button
                  v-else-if="activeSkill.usedInSibling"
                  type="button"
                  class="node-act-btn sub wide"
                  disabled
                >
                  相邻槽已装备
                </button>
                <button
                  v-else
                  type="button"
                  class="node-act-btn add wide"
                  :class="{ 'is-locked': !sel.prerequisitesMet && !sel.skill }"
                  @click="onEquipActiveCandidate"
                >
                  {{
                    sel.skill
                      ? `⇄ 切换为「${activeSkill.name}」`
                      : `解锁「${activeSkill.name}」(-1P)`
                  }}
                </button>

                <button
                  v-if="sel.skill"
                  type="button"
                  class="node-act-btn sub"
                  @click="store.clearGateSlot(sel.node.slotKey)"
                >
                  卸下
                </button>
              </template>
            </div>
          </div>

          <!-- Streamlined Key Data Body -->
          <div class="insp-body">
            <div class="levels-list">
              <div
                v-for="lv in activeSkill.levels"
                :key="lv.lv"
                class="lv-row"
                :class="{
                  'is-current': sel.skill?.id === activeSkill.id && sel.points === lv.lv,
                  'is-passed': sel.skill?.id === activeSkill.id && sel.points > lv.lv,
                }"
              >
                <span class="lv-idx">
                  Lv.{{ lv.lv }}
                  <em v-if="sel.skill?.id === activeSkill.id && sel.points === lv.lv">当前</em>
                </span>
                <strong class="lv-val">{{ lv.display }}</strong>
                <span v-if="lv.note" class="lv-note">{{ lv.note }}</span>
              </div>
            </div>

            <div
              v-if="activeSkill.unlockedItems && activeSkill.unlockedItems.length"
              class="recipes-block"
            >
              <div class="recipes-title">
                解锁配方 ({{ activeSkill.unlockedItems.length }})
              </div>
              <div class="craft-grid">
                <div
                  v-for="item in activeSkill.unlockedItems"
                  :key="item.name"
                  class="craft-chip"
                >
                  <img v-if="item.icon" :src="item.icon" :alt="item.name" />
                  <span>{{ item.name }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-tip">
          点击左侧技能树节点查看详情与加点
        </div>
      </div>

      <!-- ===============================================================
           INLINE TAB 2: 天赋分享 (Share Code, Link & Local Saves)
           =============================================================== -->
      <div v-else-if="sidebarTab === 'share'" class="skp-view pad-view">
        <div class="inline-block">
          <div class="ib-title">分享码与链接</div>
          <div class="inp-row">
            <input type="text" readonly :value="currentShareCode" class="s-input mono" />
            <button
              type="button"
              class="act-btn primary"
              @click="copyText(currentShareCode, '分享码')"
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
              placeholder="粘贴 AR.xxx 分享码或分享链接..."
              @keydown.enter="handleImportCode"
            />
            <button
              type="button"
              class="act-btn"
              :disabled="!shareInput.trim()"
              @click="handleImportCode"
            >
              导入
            </button>
          </div>
        </div>

        <div class="inline-block grow-block">
          <div class="ib-title">本地存档 ({{ store.savedBuilds.length }}/12)</div>
          <div class="inp-row">
            <input
              v-model="customBuildName"
              type="text"
              class="s-input"
              placeholder="输入存档名称..."
              @keydown.enter="handleSaveBuild"
            />
            <button type="button" class="act-btn primary" @click="handleSaveBuild">
              保存
            </button>
          </div>

          <div v-if="!store.savedBuilds.length" class="empty-tip">
            暂无本地天赋存档
          </div>
          <div v-else class="saves-scroll">
            <div
              v-for="sb in store.savedBuilds"
              :key="sb.id"
              class="save-row"
            >
              <div class="sr-info">
                <strong>{{ sb.name }}</strong>
                <span>
                  {{ sb.spentPoints }}P{{ sb.expeditionCount ? ` · 远征+${sb.expeditionCount * 5}` : '' }}
                </span>
              </div>
              <div class="sr-acts">
                <button
                  type="button"
                  class="mini-act-btn primary"
                  @click="store.loadCustomBuild(sb.id)"
                >
                  载入
                </button>
                <button
                  type="button"
                  class="mini-act-btn"
                  @click="
                    copyText(
                      store.encodeBuildToShareCode(sb, sb.expeditionCount),
                      '存档分享码',
                    )
                  "
                >
                  码
                </button>
                <button
                  type="button"
                  class="mini-act-btn danger"
                  @click="store.deleteCustomBuild(sb.id)"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===============================================================
           INLINE TAB 4: 识图导入 (Inline Screenshot / Game Capture Import)
           =============================================================== -->
      <div v-else-if="sidebarTab === 'recognize'" class="skp-view pad-view">
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
          <strong>Ctrl+V 粘贴技能树截图 · 拖入或点击上传</strong>
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
              alt="技能树截图预览"
              class="rec-thumb"
            />
            <div class="rsb-txt">
              <strong>已识别总投入 {{ recognizedResult.totalPoints }}P</strong>
              <div class="dist-legend">
                <span
                  v-for="b in recognizedBranchBreakdown"
                  :key="b.id"
                  class="dist-item"
                >
                  <i :style="{ background: b.color }"></i>
                  {{ b.name }} <strong>{{ b.pts }}P</strong>
                </span>
              </div>
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
              @click="applyRecognizedToCanvas(true)"
            >
              存为存档
            </button>
            <button
              type="button"
              class="act-btn primary"
              @click="applyRecognizedToCanvas(false)"
            >
              应用
            </button>
          </div>

          <div v-if="recognizedGateSkills.length" class="sync-slot-scroll">
            <div
              v-for="g in recognizedGateSkills"
              :key="g.slotKey"
              class="sync-slot-row"
              :style="{ '--sc': g.branchColor }"
            >
              <img :src="g.icon" alt="" />
              <div class="ssr-info">
                <small>门控 / 终极技能</small>
                <strong>{{ g.name }}</strong>
              </div>
              <em>1P</em>
            </div>
          </div>
        </div>
      </div>

      <!-- ===============================================================
           INLINE TAB 5: 同步至游戏 (Perspective Guide + Auto Point Sync)
           =============================================================== -->
      <div v-else-if="sidebarTab === 'sync'" class="skp-view pad-view">
        <div class="inline-block">
          <div class="ib-head-between">
            <span class="ib-title">目标天赋 ({{ activeTargetSource?.spent || 0 }}P)</span>
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
              v-for="opt in availableBuildSources"
              :key="opt.key"
              :value="opt.key"
            >
              [{{ opt.group }}] {{ opt.name }}
            </option>
          </select>

          <button
            type="button"
            class="act-btn amber full-w"
            :disabled="isSyncRunning || !activeTargetSource?.spent"
            @click="handleLaunchPerspectiveGuide"
          >
            全屏透视加点引导 (Alt+F)
          </button>

          <div v-if="isDesktop" class="inp-row">
            <button
              type="button"
              class="act-btn flex-1"
              :disabled="isSyncRunning || precheckLoading"
              @click="handlePrecheckInGameState"
            >
              {{ precheckLoading ? '读取中...' : '读取实机对比' }}
            </button>
            <button
              v-if="!isSyncRunning"
              type="button"
              class="act-btn primary flex-1"
              :disabled="!activeTargetSource?.spent"
              @click="handleStartAutoSync"
            >
              一键自动加点
            </button>
            <button
              v-else
              type="button"
              class="act-btn danger flex-1"
              @click="handleStopAutoSync"
            >
              急停 (ESC)
            </button>
          </div>

          <div v-if="isSyncRunning && syncStatusMsg" class="inline-msg info">
            {{ syncStatusMsg }}
          </div>
          <div v-if="precheckError" class="inline-msg err">{{ precheckError }}</div>
          <div
            v-if="syncResultBanner"
            class="inline-msg"
            :class="syncResultBanner.type"
          >
            <div>{{ syncResultBanner.text }}</div>
            <ul v-if="syncResultBanner.conflicts?.length" class="conflict-list">
              <li v-for="(c, idx) in syncResultBanner.conflicts.slice(0, 4)" :key="idx">
                <strong>{{ c.skillName }}</strong>：{{ c.reason }}
              </li>
            </ul>
          </div>
        </div>

        <!-- Timing Tuning Collapsible -->
        <div class="inline-block">
          <button
            type="button"
            class="adv-toggle"
            @click="showAdvancedSyncOpts = !showAdvancedSyncOpts"
          >
            <span>
              时序微调（{{ store.syncPrefs.smallHoldDurationMs }}ms /
              {{ store.syncPrefs.bigHoldDurationMs }}ms /
              {{ (store.syncPrefs.postPointDelayMs / 1000).toFixed(1) }}s）
            </span>
            <em>{{ showAdvancedSyncOpts ? '▲' : '▼' }}</em>
          </button>

          <div v-if="showAdvancedSyncOpts" class="adv-body">
            <div class="opt-row">
              <label>小节点长按</label>
              <input
                v-model.number="store.syncPrefs.smallHoldDurationMs"
                type="range"
                min="380"
                max="880"
                step="20"
                :disabled="isSyncRunning"
              />
              <strong>{{ store.syncPrefs.smallHoldDurationMs }}ms</strong>
            </div>
            <div class="opt-row">
              <label>大节点/菱形</label>
              <input
                v-model.number="store.syncPrefs.bigHoldDurationMs"
                type="range"
                min="650"
                max="1450"
                step="25"
                :disabled="isSyncRunning"
              />
              <strong>{{ store.syncPrefs.bigHoldDurationMs }}ms</strong>
            </div>
            <div class="opt-row">
              <label>加点后等待</label>
              <input
                v-model.number="store.syncPrefs.postPointDelayMs"
                type="range"
                min="300"
                max="2500"
                step="100"
                :disabled="isSyncRunning"
              />
              <strong>{{ (store.syncPrefs.postPointDelayMs / 1000).toFixed(1) }}s</strong>
            </div>
            <div class="opt-row">
              <label>菱形打开方式</label>
              <select
                v-model="store.syncPrefs.gateOpenMode"
                class="s-select sm"
                :disabled="isSyncRunning"
              >
                <option value="auto">自动探测</option>
                <option value="click">单击左键</option>
                <option value="hold">固定长按</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Diff Preview & Step List -->
        <div v-if="liveDiffPreview" class="inline-block grow-block">
          <template v-if="!liveDiffPreview.canIncrementalSync">
            <div class="inline-msg warn">
              <div>
                检测到 {{ liveDiffPreview.conflicts.length }} 处冲突（请先在游戏内长按 R 重置）：
              </div>
              <ul class="conflict-list">
                <li v-for="(c, idx) in liveDiffPreview.conflicts.slice(0, 5)" :key="idx">
                  <strong>{{ c.skillName }}</strong>：{{ c.reason }}
                </li>
              </ul>
            </div>
          </template>

          <template v-else-if="liveDiffPreview.alreadySynced">
            <div class="inline-msg ok">
              ✓ 游戏内当前加点已与目标一致（{{ liveDiffPreview.totalTargetPoints }}P）
            </div>
          </template>

          <template v-else>
            <div class="ib-head-between">
              <span class="ib-title">
                待执行节点 ({{ liveDiffPreview.steps.length }})
              </span>
              <span class="diff-count">
                {{
                  precheckInGameBuild
                    ? `实机 ${liveDiffPreview.totalCurrentPoints}P · `
                    : ''
                }}补 <b>+{{ liveDiffPreview.totalDeltaPoints }}P</b>
              </span>
            </div>

            <div class="sync-slot-scroll">
              <div
                v-for="(step, idx) in liveDiffPreview.steps"
                :key="`${step.node.nodeId}-${idx}`"
                class="sync-slot-row"
                :style="{ '--sc': store.branchMap[step.branch]?.color || '#5fffff' }"
              >
                <img v-if="step.icon" :src="step.icon" alt="" />
                <div class="ssr-info">
                  <small>{{ store.branchMap[step.branch]?.name }}</small>
                  <strong>{{ step.skillName }}</strong>
                </div>
                <em>
                  {{ step.kind === 'gate' ? '门控' : `+${step.deltaPoints}P` }}
                </em>
              </div>
            </div>
          </template>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.skp-shell {
  position: relative;
  width: 356px;
  flex: 0 0 356px;
  height: 100%;
  transition: width 0.2s ease, flex-basis 0.2s ease;
  z-index: 18;
}

.skp-shell.is-collapsed {
  width: 0;
  flex-basis: 0;
}

.skp-reopen-btn {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 25;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 11px 0 9px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(13, 18, 34, 0.94);
  color: #f4efe6;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
}

.skp-reopen-btn:hover {
  border-color: #5fffff;
  color: #5fffff;
}

.reopen-pts {
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  color: #5fffff;
}

.reopen-pts.zero {
  color: #ffbc13;
}

.skp-panel {
  width: 356px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0c1120;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  transition: transform 0.2s ease;
}

.skp-shell.is-collapsed .skp-panel {
  transform: translateX(100%);
  pointer-events: none;
}

/* ============================================================================
   Top Header + Expedition Row + 5-Way Inline Mode Tabs
   ============================================================================ */
.skp-top {
  padding: 10px 12px 0;
  background: #0e1526;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.top-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.brand-bar {
  width: 3px;
  height: 15px;
  border-radius: 2px;
  background: #5fffff;
  box-shadow: 0 0 8px rgba(95, 255, 255, 0.5);
  flex-shrink: 0;
}

.brand-title {
  margin: 0;
  font-family: var(--font-display, sans-serif);
  font-size: 15px;
  font-weight: 800;
  color: #f4efe6;
  white-space: nowrap;
}

.points-hud {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  padding: 1px 7px;
  border-radius: 4px;
  background: #080c18;
  border: 1px solid rgba(95, 255, 255, 0.35);
}

.points-hud.zero {
  border-color: rgba(255, 188, 19, 0.55);
}

.pts-remain {
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  font-weight: 800;
  color: #5fffff;
}

.points-hud.zero .pts-remain {
  color: #ffbc13;
}

.pts-sep,
.pts-total {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  color: #8f96a8;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.mini-top-btn {
  height: 24px;
  padding: 0 7px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.04);
  color: #cfd2dc;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.14s ease;
}

.mini-top-btn:hover:not(:disabled) {
  border-color: rgba(95, 255, 255, 0.55);
  color: #5fffff;
}

.mini-top-btn.active {
  border-color: rgba(95, 255, 255, 0.5);
  background: rgba(95, 255, 255, 0.1);
  color: #f4efe6;
}

.mini-top-btn.danger:hover:not(:disabled) {
  border-color: #ff4a3d;
  color: #ff6257;
}

.mini-top-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.xray-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #6f778b;
}

.mini-top-btn.active .xray-dot {
  background: #5fffff;
  box-shadow: 0 0 6px #5fffff;
}

.coin-tag {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: #ffbc13;
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

.collapse-btn:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.exp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #080c18;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.exp-label {
  font-size: 11px;
  font-weight: 700;
  color: #8f96a8;
  white-space: nowrap;
}

.exp-btns {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.exp-btn {
  height: 20px;
  padding: 0 4px;
  border-radius: 3px;
  border: 1px solid transparent;
  background: transparent;
  color: #8f96a8;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.exp-btn:hover:not(:disabled) {
  color: #e6e8f0;
}

.exp-btn.active {
  background: rgba(255, 188, 19, 0.16);
  border-color: rgba(255, 188, 19, 0.55);
  color: #ffbc13;
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
  white-space: nowrap;
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
  left: 4px;
  right: 4px;
  bottom: 0;
  height: 2px;
  background: currentColor;
  border-radius: 2px 2px 0 0;
}

/* ============================================================================
   View Containers
   ============================================================================ */
.skp-view {
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

/* ============================================================================
   TAB 1: Node Inspector
   ============================================================================ */
.insp-header {
  padding: 12px 14px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--b-col) 9%, #0e1526) 0%,
    #0c1120 100%
  );
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}

.insp-top-bar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.branch-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--b-col) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--b-col) 48%, transparent);
  color: var(--b-col);
  font-size: 11.5px;
  font-weight: 800;
}

.b-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--b-col);
}

.slot-lv-badge {
  margin-left: auto;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  font-weight: 800;
  color: #8f96a8;
}

.slot-lv-badge.active {
  color: var(--b-col);
}

.gate-tabs-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.gp-tab {
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #101729;
  color: #b7bdce;
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.gp-tab img {
  width: 14px;
  height: 14px;
  object-fit: contain;
}

.gp-tab.active {
  border-color: var(--b-col);
  color: #f4efe6;
  background: color-mix(in srgb, var(--b-col) 15%, #101729);
}

.gp-tab em {
  font-style: normal;
  font-size: 9.5px;
  padding: 0 4px;
  border-radius: 2px;
  background: var(--b-col);
  color: #080c18;
  font-weight: 800;
}

.gp-tab em.mutex {
  background: rgba(255, 188, 19, 0.25);
  color: #ffbc13;
}

.skill-hero {
  display: flex;
  align-items: center;
  gap: 11px;
}

.hero-icon-frame {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: #080c18;
  border: 2px solid #4d5368;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-icon-frame.st-partial,
.hero-icon-frame.st-maxed {
  border-color: var(--b-col);
  box-shadow: 0 0 14px color-mix(in srgb, var(--b-col) 32%, transparent);
}

.hero-icon-frame img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}

.hero-titles {
  min-width: 0;
}

.hero-name {
  margin: 0;
  font-family: var(--font-title, sans-serif);
  font-size: 16.5px;
  font-weight: 800;
  color: #f4efe6;
  line-height: 1.2;
}

.hero-metric {
  margin-top: 3px;
  font-size: 12px;
  font-weight: 600;
  color: #5fffff;
}

.mini-tag {
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 700;
}

.mini-tag.warn {
  background: rgba(255, 188, 19, 0.12);
  border: 1px solid rgba(255, 188, 19, 0.34);
  color: #ffbc13;
}

.mini-tag.lock {
  background: rgba(255, 48, 38, 0.1);
  border: 1px solid rgba(255, 48, 38, 0.3);
  color: #ff8079;
}

.alloc-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-act-btn {
  flex: 1 1 0;
  height: 30px;
  padding: 0 9px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.14s ease;
}

.node-act-btn.wide {
  flex: 2 1 0;
}

.node-act-btn.add {
  background: var(--b-col);
  border: 1px solid var(--b-col);
  color: #080c18;
}

.node-act-btn.max {
  flex: 0 0 auto;
  background: color-mix(in srgb, var(--b-col) 18%, #101729);
  border: 1px solid var(--b-col);
  color: var(--b-col);
}

.node-act-btn.current {
  background: color-mix(in srgb, var(--b-col) 15%, #101729);
  border: 1px solid var(--b-col);
  color: var(--b-col);
  opacity: 0.9;
  cursor: default;
}

.node-act-btn.add.is-locked,
.node-act-btn.max.is-locked {
  opacity: 0.45;
}

.node-act-btn.sub {
  background: #101729;
  border: 1px solid rgba(255, 255, 255, 0.16);
  color: #cfd2dc;
}

.node-act-btn.sub:hover:not(:disabled) {
  border-color: #ff6b63;
  color: #ff6b63;
}

.node-act-btn:disabled:not(.current) {
  opacity: 0.4;
  cursor: not-allowed;
}

.insp-body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.levels-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.lv-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 6px 10px;
  border-radius: 5px;
  background: #101729;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.lv-row.is-passed {
  border-color: color-mix(in srgb, var(--b-col) 30%, rgba(255, 255, 255, 0.08));
}

.lv-row.is-current {
  background: color-mix(in srgb, var(--b-col) 14%, #101729);
  border-color: var(--b-col);
}

.lv-idx {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 54px;
  font-family: var(--font-mono, monospace);
  font-size: 11.5px;
  font-weight: 800;
  color: #8f96a8;
}

.lv-idx em {
  font-style: normal;
  padding: 0 4px;
  border-radius: 3px;
  background: var(--b-col);
  color: #080c18;
  font-size: 9.5px;
}

.lv-val {
  font-family: var(--font-mono, monospace);
  font-size: 13.5px;
  font-weight: 800;
  color: var(--b-col);
}

.lv-note {
  margin-left: auto;
  font-size: 11px;
  color: #b7bdce;
  text-align: right;
}

.recipes-block {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.recipes-title {
  font-size: 11.5px;
  font-weight: 700;
  color: #8f96a8;
}

.craft-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5px;
}

.craft-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 7px;
  border-radius: 5px;
  background: rgba(8, 12, 24, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.08);
  min-width: 0;
}

.craft-chip img {
  width: 20px;
  height: 20px;
  object-fit: contain;
  flex-shrink: 0;
}

.craft-chip span {
  font-size: 11.5px;
  font-weight: 700;
  color: #f4efe6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================================
   Shared Inline Panel Primitives (Stats, Share, Recognize, Sync)
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

.kpi-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.kpi-cell {
  padding: 6px 8px;
  border-radius: 5px;
  background: rgba(8, 12, 24, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kpi-cell span {
  font-size: 10.5px;
  color: #8f96a8;
}

.kpi-cell strong {
  font-family: var(--font-mono, monospace);
  font-size: 14px;
  font-weight: 800;
  color: #f4efe6;
}

.kpi-cell strong.cyan {
  color: #5fffff;
}

.kpi-cell small {
  font-size: 10.5px;
  color: #8f96a8;
}

.dist-bar {
  height: 5px;
  border-radius: 999px;
  background: #080c18;
  display: flex;
  overflow: hidden;
}

.dist-seg {
  height: 100%;
  transition: width 0.2s ease;
}

.dist-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: #9ba2b4;
}

.dist-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.dist-item i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.dist-item strong {
  font-family: var(--font-mono, monospace);
  color: #f4efe6;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.stat-entry-row {
  --sc: #5fffff;
  width: 100%;
  padding: 6px 8px;
  border-radius: 5px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-left: 3px solid var(--sc);
  background: rgba(8, 12, 24, 0.65);
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.13s ease, background 0.13s ease;
}

.stat-entry-row:hover {
  background: #151e35;
  border-color: rgba(255, 255, 255, 0.24);
  border-left-color: var(--sc);
}

.stat-entry-row img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

.ser-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ser-info strong {
  font-size: 12px;
  color: #f4efe6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ser-info small {
  font-size: 10.5px;
  color: #8f96a8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ser-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
}

.ser-val {
  font-style: normal;
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  font-weight: 800;
  color: var(--sc);
}

.ser-lv {
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: #8f96a8;
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

.s-select.sm {
  width: auto;
  height: 24px;
  padding: 0 6px;
  font-size: 11px;
}

.s-input:focus,
.s-select:focus {
  border-color: rgba(95, 255, 255, 0.55);
}

.s-input.mono {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
}

.inp-row {
  display: flex;
  align-items: center;
  gap: 6px;
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
  width: 52px;
  height: 34px;
  border-radius: 4px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.14);
  flex-shrink: 0;
}

.rsb-txt {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.rsb-txt > strong {
  font-size: 12px;
  color: #5fffff;
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
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: #9ba2b4;
}

.diff-count b {
  color: #5fffff;
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

.sync-slot-row img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  flex-shrink: 0;
}

.ssr-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ssr-info small {
  font-size: 10px;
  color: #8f96a8;
}

.ssr-info strong {
  font-size: 11.5px;
  color: #f2ede4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sync-slot-row em {
  font-style: normal;
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  font-weight: 800;
  color: var(--sc);
}

.adv-toggle {
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: #b7bdce;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.adv-toggle em {
  font-style: normal;
  color: #8f96a8;
}

.adv-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.opt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: #9ba2b4;
}

.opt-row label {
  min-width: 68px;
  flex-shrink: 0;
}

.opt-row input[type='range'] {
  flex: 1 1 auto;
  accent-color: #5fffff;
}

.opt-row strong {
  min-width: 44px;
  text-align: right;
  font-family: var(--font-mono, monospace);
  color: #f4efe6;
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

.conflict-list {
  margin: 5px 0 0;
  padding-left: 16px;
  font-weight: 600;
  font-size: 11px;
  color: #e6e8f0;
}

.empty-tip {
  padding: 24px 12px;
  text-align: center;
  font-size: 12px;
  color: #7d8599;
}
</style>
