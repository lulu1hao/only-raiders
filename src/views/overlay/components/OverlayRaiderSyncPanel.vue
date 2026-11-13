<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRaiderStore } from '../../../stores/useRaiderStore'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'
import {
  computeBuildBranchBreakdown,
  computeBuildGateChips,
  useRaiderVisionSync,
} from '../../../composables/useRaiderVisionSync'
import {
  abortRaiderAutoSync,
  analyzeBuildSyncDiff,
  runRaiderAutoSyncSession,
} from '../../../utils/raiderAutoSyncPlanner'

const store = useRaiderStore()
const overlayStore = useOverlayWindowStore()

const rt = computed(() => overlayStore.raiderSyncRuntime)

// ======================== 1. 一键自动加点与识图共享状态 ========================
const showTimingOpts = ref(false)
const importSuccessNote = ref('')

const {
  isDesktop,
  fileInputRef,
  isRecognizing,
  recognizeError,
  previewUrl,
  recognizedResult,
  saveImportName,
  revokePreviewUrl,
  recognizedBranches,
  recognizedGates,
  processImageSource,
  handleCaptureGameForRecognize,
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
  currentLabelPrefix: '当前编辑配装',
  defaultRecognizeError: '未能从画面中识别出奇袭者技能树',
  emptyClipboardError: '剪贴板中暂无图片，请先截图后再粘贴',
  pasteHintError: '请直接在此悬浮窗按下 Ctrl + V 粘贴截图',
  defaultPrecheckError: '请确认游戏当前停留在「奇袭者 → 技能树」主画面',
  onBeforeProcess: () => {
    importSuccessNote.value = ''
  },
})

const activeTargetSource = computed(
  () =>
    availableBuildSources.value.find((it) => it.key === rt.value.sourceKey) ||
    availableBuildSources.value[0],
)

const targetBranchSummary = computed(() =>
  computeBuildBranchBreakdown(
    activeTargetSource.value?.build,
    store.currentTree,
    store.branches,
  ),
)

const targetGateChips = computed(() =>
  computeBuildGateChips(
    activeTargetSource.value?.build,
    store.currentTree,
    store.branchMap,
  ),
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
    rt.value.banner = null
  })
}

async function handleStartAutoSync() {
  const src = activeTargetSource.value
  if (!src || src.spent <= 0) {
    rt.value.banner = {
      type: 'warn',
      text: '所选配装尚未分配技能点，请先切换配装存档或在规划器中点选技能。',
    }
    return
  }

  const wasCollapsed = overlayStore.collapsed
  rt.value.running = true
  rt.value.banner = null
  rt.value.progressPct = 2
  rt.value.text = '正在切入游戏窗口...'

  try {
    // 自动收起为顶部 48px 胶囊进度条，让出完整技能树与 3选2 视野
    if (!wasCollapsed) {
      await overlayStore.setCollapsed(true)
    }

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
        if (ev?.message) rt.value.text = ev.message
        if (typeof ev?.progressPct === 'number') rt.value.progressPct = ev.progressPct
      },
    })

    if (!res.ok && res.needsReset) {
      precheckInGameBuild.value = res.inGameBuild || null
      rt.value.banner = {
        type: 'warn',
        text: res.message,
        conflicts: res.conflicts || [],
      }
    } else if (res.ok) {
      precheckInGameBuild.value = null
      rt.value.banner = {
        type: 'ok',
        text: res.message,
      }
    }
  } catch (err) {
    rt.value.banner = {
      type: err?.aborted ? 'warn' : 'err',
      text: err?.message || '自动加点已停止',
    }
  } finally {
    rt.value.running = false
    rt.value.text = ''
    rt.value.progressPct = 0
    if (!wasCollapsed) {
      await overlayStore.setCollapsed(false)
    }
    void refreshGameWindowStatus()
  }
}

async function handleStopAutoSync() {
  await abortRaiderAutoSync()
}

async function handleLaunchGuide() {
  const src = activeTargetSource.value
  if (!src || src.spent <= 0) {
    rt.value.banner = {
      type: 'warn',
      text: '请先选择有效的目标配装存档（点数 > 0）',
    }
    return
  }
  await overlayStore.launchRaiderPerspectiveGuide({
    origin: 'overlay',
    title: src.name,
    targetBuild: src.build,
    inGameBuild: precheckInGameBuild.value || null,
  })
}

function applyRecognizedBuildAction(saveArchive = false) {
  const res = recognizedResult.value
  if (!res?.ok) return
  const applied = store.applyRecognizedBuild(res.allocations, res.gateSelections, '悬浮窗识图')
  if (!applied.ok) {
    recognizeError.value = applied.reason || '应用配装失败'
    return
  }
  if (saveArchive) {
    const name = saveImportName.value.trim() || `实机导入 (${res.totalPoints}P)`
    const rec = store.saveCustomBuild(name)
    saveImportName.value = ''
    if (rec?.id) {
      rt.value.sourceKey = `saved:${rec.id}`
    }
    importSuccessNote.value = `✓ 已保存为存档「${rec.name}」并同步至主窗口画布！`
  } else {
    rt.value.sourceKey = 'current'
    importSuccessNote.value = `✓ 已载入当前画布（共 ${res.totalPoints}P，主窗口已实时同步）！`
  }
}

function onOverlayPaste(e) {
  if (
    overlayStore.activeTab !== 'raider' ||
    overlayStore.collapsed ||
    overlayStore.raiderSyncRuntime?.moduleMode === 'loadout'
  ) {
    return
  }
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const blob = it.getAsFile()
      if (blob) {
        rt.value.subTab = 'recognize'
        void processImageSource(blob, blob)
        e.preventDefault()
        return
      }
    }
  }
}

let winPollTimer = null

function pollGameWinIfIdle() {
  if (!isDesktop || rt.value.running || overlayStore.collapsed) return
  void refreshGameWindowStatus()
}

onMounted(() => {
  void refreshGameWindowStatus()
  window.addEventListener('paste', onOverlayPaste)
  window.addEventListener('focus', pollGameWinIfIdle)
  if (isDesktop) {
    winPollTimer = window.setInterval(pollGameWinIfIdle, 3500)
  }
})

onBeforeUnmount(() => {
  if (winPollTimer) {
    window.clearInterval(winPollTimer)
    winPollTimer = null
  }
  window.removeEventListener('paste', onOverlayPaste)
  window.removeEventListener('focus', pollGameWinIfIdle)
  revokePreviewUrl()
})
</script>

<template>
  <section class="ors-root">
    <!-- Top Sub-Mode Switcher -->
    <div class="ors-subbar no-drag">
      <div class="ors-mode-pills">
        <button
          type="button"
          class="ors-mode-btn"
          :class="{ active: rt.subTab === 'sync' }"
          :disabled="rt.running"
          @click="rt.subTab = 'sync'; refreshGameWindowStatus()"
        >
          一键自动加点
        </button>
        <button
          type="button"
          class="ors-mode-btn"
          :class="{ active: rt.subTab === 'recognize' }"
          :disabled="rt.running"
          @click="rt.subTab = 'recognize'"
        >
          截图识别导入
        </button>
      </div>

      <button
        type="button"
        class="ors-jump-btn"
        title="在主窗口打开完整奇袭者技能树规划器"
        @click="overlayStore.openInMainWindow('/raider', false)"
      >
        主规划器 ↗
      </button>
    </div>

    <!-- =================================================================
         SUB-TAB 1: 局内一键自动加点
         ================================================================= -->
    <div v-if="rt.subTab === 'sync'" class="ors-scroll">
      <!-- 1. 选择目标配装存档 -->
      <div class="ors-card">
        <div class="ors-card-head">
          <span class="ors-title">1. 目标加点配装存档</span>
          <strong class="ors-pts-pill ar-num">共 {{ activeTargetSource?.spent || 0 }}P</strong>
        </div>

        <select
          v-model="rt.sourceKey"
          class="ors-select"
          :disabled="rt.running"
        >
          <option
            v-for="opt in availableBuildSources"
            :key="opt.key"
            :value="opt.key"
          >
            [{{ opt.group }}] {{ opt.name }}
          </option>
        </select>

        <div class="ors-branch-row">
          <span
            v-for="b in targetBranchSummary"
            :key="b.id"
            class="ors-branch-chip"
          >
            <i :style="{ background: b.color }"></i>
            {{ b.name }} <strong class="ar-num">{{ b.pts }}P</strong>
          </span>
        </div>

        <div v-if="targetGateChips.length" class="ors-gate-strip">
          <span
            v-for="g in targetGateChips"
            :key="g.slotKey"
            class="ors-gate-badge"
            :style="{ '--gc': g.color }"
          >
            <img :src="g.icon" alt="" />
            {{ g.name }}
          </span>
        </div>
      </div>

      <!-- 2. 游戏窗口与实机加点预检 -->
      <div class="ors-card">
        <div class="ors-card-head">
          <span class="ors-title">2. 游戏状态与差量对比</span>
          <div class="ors-head-right">
            <span
              v-if="isDesktop"
              class="ors-win-dot"
              :class="{ ok: gameWinStatus?.found }"
            >
              {{ gameWinStatus?.found ? '已连游戏' : '未检测游戏' }}
            </span>
            <button
              v-if="isDesktop"
              type="button"
              class="ors-mini-btn"
              :disabled="precheckLoading || rt.running"
              @click="handlePrecheckInGameState"
            >
              {{ precheckLoading ? '识图中...' : '读取当前进度' }}
            </button>
          </div>
        </div>

        <div v-if="precheckError" class="ors-alert is-warn">
          {{ precheckError }}
        </div>

        <div v-if="liveDiffPreview" class="ors-diff-panel">
          <template v-if="!liveDiffPreview.canIncrementalSync">
            <div class="ors-diff-warn">
              检测到 {{ liveDiffPreview.conflicts.length }} 处已有加点冲突（保护金币不自动重置）：
            </div>
            <ul class="ors-conflict-list">
              <li v-for="(c, idx) in liveDiffPreview.conflicts.slice(0, 4)" :key="idx">
                <strong>{{ c.skillName }}</strong>：{{ c.reason }}
              </li>
            </ul>
            <div class="ors-diff-hint">
              请先在游戏技能树界面长按 <kbd>R</kbd> 重置，再点击下方一键自动加点。
            </div>
          </template>

          <template v-else-if="liveDiffPreview.alreadySynced">
            <div class="ors-diff-ok">
              ✓ 游戏内加点已与目标配装完全一致（{{ liveDiffPreview.totalTargetPoints }}P）
            </div>
          </template>

          <template v-else>
            <div class="ors-diff-summary">
              <span>
                {{
                  precheckInGameBuild
                    ? `实机已投 ${liveDiffPreview.totalCurrentPoints}P → 增量补齐`
                    : '启动时自动识图跳过已点节点（含 2选1 / 3选2）'
                }}
              </span>
              <strong class="ar-num">
                待点 {{ liveDiffPreview.steps.length }} 项 · +{{ liveDiffPreview.totalDeltaPoints }}P
              </strong>
            </div>
          </template>
        </div>
      </div>

      <!-- 3. 游戏代码级长按与动画等待微调 -->
      <div class="ors-card ors-adv-card">
        <button
          type="button"
          class="ors-adv-toggle"
          @click="showTimingOpts = !showTimingOpts"
        >
          <span>
            时序参数：小点 {{ store.syncPrefs.smallHoldDurationMs }}ms · 大点 {{ store.syncPrefs.bigHoldDurationMs }}ms · 动画等 {{ (store.syncPrefs.postPointDelayMs / 1000).toFixed(1) }}s
          </span>
          <em>{{ showTimingOpts ? '▲' : '▼' }}</em>
        </button>

        <div v-if="showTimingOpts" class="ors-adv-body">
          <div class="ors-opt-row">
            <label title="游戏 DT_GenericInputActions 实测阈值 0.5s (500ms)，达标自动提前松手">小技能长按 (游戏0.5s)</label>
            <input
              v-model.number="store.syncPrefs.smallHoldDurationMs"
              type="range"
              min="380"
              max="880"
              step="20"
              :disabled="rt.running"
            />
            <strong class="ar-num">{{ store.syncPrefs.smallHoldDurationMs }}ms</strong>
          </div>

          <div class="ors-opt-row">
            <label title="游戏 BP_DefaultCommonUIHoldData 实测阈值 0.8s (800ms)，达标自动提前松手">大技能/菱形 (游戏0.8s)</label>
            <input
              v-model.number="store.syncPrefs.bigHoldDurationMs"
              type="range"
              min="650"
              max="1450"
              step="25"
              :disabled="rt.running"
            />
            <strong class="ar-num">{{ store.syncPrefs.bigHoldDurationMs }}ms</strong>
          </div>

          <div class="ors-opt-row">
            <label title="每次投入技能点后等待游戏加载与连线解锁动画完成">加点后动画等待</label>
            <input
              v-model.number="store.syncPrefs.postPointDelayMs"
              type="range"
              min="300"
              max="2500"
              step="100"
              :disabled="rt.running"
            />
            <strong class="ar-num">{{ (store.syncPrefs.postPointDelayMs / 1000).toFixed(1) }}s</strong>
          </div>

          <div class="ors-opt-row">
            <label>2选1 / 3选2 打开方式</label>
            <select v-model="store.syncPrefs.gateOpenMode" class="ors-mini-select">
              <option value="auto">自动自适应 (单击+0.8s长按兜底)</option>
              <option value="click">优先单击打开</option>
              <option value="hold">固定长按打开</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 实时运行状态或完成/中止结果 -->
      <div v-if="rt.running" class="ors-running-bar">
        <div class="ors-run-text">
          <span class="ors-spin"></span>
          <span>{{ rt.text }}</span>
        </div>
        <button type="button" class="ors-stop-btn" @click="handleStopAutoSync">
          急停 (ESC)
        </button>
      </div>

      <div
        v-if="rt.banner"
        class="ors-alert"
        :class="`is-${rt.banner.type}`"
      >
        <div>{{ rt.banner.text }}</div>
        <ul v-if="rt.banner.conflicts?.length" class="ors-conflict-list">
          <li v-for="(c, idx) in rt.banner.conflicts.slice(0, 4)" :key="idx">
            <strong>{{ c.skillName }}</strong>：{{ c.reason }}
          </li>
        </ul>
      </div>

      <div class="ors-safety-tip">
        提示：请先在游戏内打开「奇袭者 → 技能树」。开始后悬浮窗将自动收起为顶部进度条不挡画面，按 <kbd>ESC</kbd> / <kbd>F10</kbd> 或大幅移动鼠标立即急停。
      </div>
    </div>

    <!-- Sync Sticky Footer Buttons -->
    <div v-if="rt.subTab === 'sync'" class="ors-footer no-drag">
      <button
        type="button"
        class="ors-sec-btn"
        :disabled="rt.running || !activeTargetSource?.spent"
        title="全屏鼠标穿透叠加 +N 与门控图标指引，手动跟点零风控"
        @click="handleLaunchGuide"
      >
        透视跟点指引
      </button>

      <button
        v-if="isDesktop"
        type="button"
        class="ors-pri-btn"
        :disabled="rt.running || !activeTargetSource?.spent"
        @click="handleStartAutoSync"
      >
        {{ rt.running ? '正在游戏内自动加点...' : '一键自动加点' }}
      </button>
    </div>

    <!-- =================================================================
         SUB-TAB 2: 实机截图识别当前加点
         ================================================================= -->
    <div v-else class="ors-scroll">
      <div class="ors-card">
        <div class="ors-card-head">
          <span class="ors-title">实机技能树识图导入</span>
          <span class="ors-sub-note">自动穿透悬浮窗抓屏</span>
        </div>

        <div class="ors-rec-actions">
          <button
            v-if="isDesktop"
            type="button"
            class="ors-pri-btn compact"
            :disabled="isRecognizing"
            @click="handleCaptureGameForRecognize"
          >
            {{ isRecognizing ? '正在识别...' : '一键抓取游戏技能树' }}
          </button>

          <button
            type="button"
            class="ors-sec-btn compact"
            :disabled="isRecognizing"
            @click="handleReadClipboard"
          >
            粘贴截图 (Ctrl+V)
          </button>

          <button
            type="button"
            class="ors-sec-btn compact"
            :disabled="isRecognizing"
            @click="fileInputRef?.click()"
          >
            选择图片
          </button>

          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="ors-hidden-file"
            @change="onFileSelected"
          />
        </div>

        <div
          class="ors-dropzone"
          @dragover.prevent
          @drop="onDropImage"
        >
          <img v-if="previewUrl" :src="previewUrl" alt="技能树截图预览" class="ors-preview-img" />
          <div v-else class="ors-drop-hint">
            <strong>点击上方「一键抓取游戏技能树」或直接按 <kbd>Ctrl + V</kbd> 粘贴截图</strong>
            <span>离线毫秒级识别全部 42 个大小技能节点、2选1 门控与 3选2 终极技能</span>
          </div>
        </div>

        <div v-if="recognizeError" class="ors-alert is-warn">
          {{ recognizeError }}
        </div>

        <div v-if="importSuccessNote" class="ors-alert is-ok">
          {{ importSuccessNote }}
        </div>
      </div>

      <!-- Recognition Result -->
      <div v-if="recognizedResult?.ok" class="ors-card ors-rec-result">
        <div class="ors-card-head">
          <span class="ors-title">识别结果</span>
          <strong class="ors-pts-pill ar-num">总投入 {{ recognizedResult.totalPoints }}P</strong>
        </div>

        <div class="ors-branch-row">
          <span
            v-for="b in recognizedBranches"
            :key="b.id"
            class="ors-branch-chip"
          >
            <i :style="{ background: b.color }"></i>
            {{ b.name }} <strong class="ar-num">{{ b.pts }}P</strong>
          </span>
        </div>

        <div v-if="recognizedGates.length" class="ors-gate-strip">
          <span
            v-for="g in recognizedGates"
            :key="g.slotKey"
            class="ors-gate-badge"
            :style="{ '--gc': g.color }"
          >
            <img :src="g.icon" alt="" />
            {{ g.name }}
          </span>
        </div>

        <div class="ors-save-row">
          <input
            v-model="saveImportName"
            type="text"
            class="ors-input"
            placeholder="输入存档名称（可选，如：跑酷搜刮流）"
          />
        </div>

        <div class="ors-rec-apply-btns">
          <button
            type="button"
            class="ors-sec-btn compact"
            @click="applyRecognizedBuildAction(true)"
          >
            另存为配装存档
          </button>
          <button
            type="button"
            class="ors-pri-btn compact"
            @click="applyRecognizedBuildAction(false)"
          >
            载入当前画布
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ors-root {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.ors-subbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--line);
  background: var(--ov-bg-bar);
}

.ors-mode-pills {
  display: inline-flex;
  gap: 4px;
  padding: 2px;
  border-radius: 4px;
  background: rgba(8, 12, 22, 0.72);
  border: 1px solid var(--line-strong);
}

.ors-mode-btn {
  height: 25px;
  padding: 0 10px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.14s;
}

.ors-mode-btn:hover:not(:disabled) {
  color: var(--cream);
}

.ors-mode-btn.active {
  background: var(--amber);
  color: #090c19;
  text-shadow: none;
}

.ors-jump-btn {
  height: 25px;
  padding: 0 8px;
  border-radius: 3px;
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--tx-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ors-jump-btn:hover {
  border-color: var(--cream);
  color: var(--cream);
}

.ors-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ors-card {
  padding: 9px 10px;
  border-radius: 5px;
  background: var(--ov-bg-card);
  border: 1px solid var(--line-strong);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ors-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ors-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--cream);
}

.ors-sub-note {
  font-size: 10.5px;
  color: var(--tx-3);
}

.ors-pts-pill {
  padding: 1px 7px;
  border-radius: 3px;
  background: rgba(95, 255, 255, 0.14);
  border: 1px solid rgba(95, 255, 255, 0.42);
  color: #5fffff;
  font-size: 11px;
}

.ors-select,
.ors-input,
.ors-mini-select {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(7, 10, 19, 0.9);
  color: var(--cream);
  font-size: 12px;
  font-weight: 700;
  outline: none;
}

.ors-select:focus,
.ors-input:focus {
  border-color: var(--amber);
}

.ors-branch-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ors-branch-chip {
  flex: 1;
  min-width: 84px;
  height: 24px;
  padding: 0 7px;
  border-radius: 3px;
  background: var(--ov-bg-chip);
  border: 1px solid var(--line);
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--tx-2);
}

.ors-branch-chip i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 4px;
}

.ors-branch-chip strong {
  color: var(--cream);
  margin-left: auto;
}

.ors-gate-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ors-gate-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 21px;
  padding: 0 6px;
  border-radius: 3px;
  background: rgba(10, 14, 24, 0.85);
  border: 1px solid color-mix(in srgb, var(--gc, #5fffff) 55%, transparent);
  color: var(--cream);
  font-size: 10.5px;
  font-weight: 700;
}

.ors-gate-badge img {
  width: 13px;
  height: 13px;
  object-fit: contain;
}

.ors-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ors-win-dot {
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(148, 163, 184, 0.16);
  color: var(--tx-3);
}

.ors-win-dot.ok {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.ors-mini-btn {
  height: 23px;
  padding: 0 8px;
  border-radius: 3px;
  border: 1px solid rgba(95, 255, 255, 0.45);
  background: rgba(95, 255, 255, 0.12);
  color: #5fffff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ors-mini-btn:hover:not(:disabled) {
  background: rgba(95, 255, 255, 0.22);
}

.ors-diff-panel {
  padding: 7px 8px;
  border-radius: 4px;
  background: rgba(7, 11, 20, 0.72);
  border: 1px dashed var(--line-strong);
  font-size: 11.5px;
}

.ors-diff-summary {
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: var(--tx-2);
}

.ors-diff-summary strong {
  color: var(--amber);
  font-size: 12px;
}

.ors-diff-ok {
  color: #86efac;
  font-weight: 700;
}

.ors-diff-warn {
  color: #fca5a5;
  font-weight: 700;
  margin-bottom: 4px;
}

.ors-conflict-list {
  margin: 4px 0;
  padding-left: 16px;
  color: var(--tx-1);
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ors-diff-hint {
  color: var(--amber);
  font-size: 11px;
  margin-top: 3px;
}

.ors-adv-card {
  padding: 0;
}

.ors-adv-toggle {
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--tx-2);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  cursor: pointer;
  text-align: left;
}

.ors-adv-toggle:hover {
  color: var(--cream);
}

.ors-adv-toggle em {
  font-style: normal;
  color: var(--amber);
}

.ors-adv-body {
  padding: 6px 10px 10px;
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ors-opt-row {
  display: grid;
  grid-template-columns: 118px 1fr 48px;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--tx-2);
}

.ors-opt-row input[type='range'] {
  width: 100%;
  accent-color: var(--amber);
}

.ors-opt-row strong {
  text-align: right;
  color: var(--amber);
}

.ors-opt-row .ors-mini-select {
  grid-column: 2 / 4;
  height: 26px;
  font-size: 11px;
}

.ors-running-bar {
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(255, 188, 19, 0.16);
  border: 1px solid var(--amber);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.ors-run-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--cream);
  min-width: 0;
}

.ors-spin {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgba(255, 188, 19, 0.3);
  border-top-color: var(--amber);
  animation: ors-rot 0.75s linear infinite;
  flex-shrink: 0;
}

@keyframes ors-rot {
  to {
    transform: rotate(360deg);
  }
}

.ors-stop-btn {
  height: 25px;
  padding: 0 9px;
  border-radius: 3px;
  border: 1px solid #ef4444;
  background: #dc2626;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  flex-shrink: 0;
}

.ors-alert {
  padding: 7px 9px;
  border-radius: 4px;
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.45;
}

.ors-alert.is-ok {
  background: rgba(22, 163, 74, 0.22);
  border: 1px solid rgba(74, 222, 128, 0.5);
  color: #bbf7d0;
}

.ors-alert.is-warn {
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid rgba(251, 191, 36, 0.5);
  color: #fde68a;
}

.ors-alert.is-err {
  background: rgba(220, 38, 38, 0.24);
  border: 1px solid rgba(248, 113, 113, 0.55);
  color: #fecaca;
}

.ors-safety-tip {
  font-size: 10.5px;
  line-height: 1.45;
  color: var(--tx-3);
}

.ors-safety-tip kbd,
.ors-diff-hint kbd,
.ors-drop-hint kbd {
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line-strong);
  color: var(--amber);
  font-family: var(--font-mono);
  font-size: 10px;
}

.ors-footer {
  flex-shrink: 0;
  padding: 8px 10px;
  border-top: 1px solid var(--line-strong);
  background: var(--ov-bg-bar);
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: 7px;
}

.ors-pri-btn,
.ors-sec-btn {
  height: 33px;
  padding: 0 10px;
  border-radius: 4px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.14s;
  white-space: nowrap;
}

.ors-pri-btn.compact,
.ors-sec-btn.compact {
  height: 29px;
  font-size: 11.5px;
}

.ors-pri-btn {
  border: 1px solid #5fffff;
  background: linear-gradient(180deg, rgba(95, 255, 255, 0.28), rgba(95, 255, 255, 0.14));
  color: #5fffff;
}

.ors-pri-btn:hover:not(:disabled) {
  background: #5fffff;
  color: #061019;
  text-shadow: none;
}

.ors-sec-btn {
  border: 1px solid var(--line-strong);
  background: var(--ov-bg-chip);
  color: var(--cream);
}

.ors-sec-btn:hover:not(:disabled) {
  border-color: var(--amber);
  color: var(--amber);
}

.ors-pri-btn:disabled,
.ors-sec-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.ors-rec-actions {
  display: grid;
  grid-template-columns: 1.25fr 1fr auto;
  gap: 5px;
}

.ors-hidden-file {
  display: none;
}

.ors-dropzone {
  min-height: 112px;
  max-height: 168px;
  border-radius: 4px;
  border: 1px dashed var(--line-strong);
  background: rgba(6, 9, 18, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 6px;
}

.ors-preview-img {
  width: 100%;
  max-height: 154px;
  object-fit: contain;
  border-radius: 3px;
}

.ors-drop-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  padding: 10px 8px;
  font-size: 11px;
  color: var(--tx-3);
}

.ors-drop-hint strong {
  color: var(--tx-1);
  font-size: 11.5px;
}

.ors-rec-apply-btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
</style>
