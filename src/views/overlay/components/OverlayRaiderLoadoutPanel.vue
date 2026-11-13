<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRaiderLoadoutStore } from '../../../stores/useRaiderLoadoutStore'
import { useOverlayWindowStore } from '../../../stores/useOverlayWindowStore'
import { useRaiderLoadoutSync } from '../../../composables/useRaiderLoadoutSync'
import {
  abortRaiderAutoSync,
  analyzeLoadoutSyncDiff,
  describeLoadoutBrief,
  runLoadoutAutoSyncSession,
} from '../../../utils/raiderLoadoutSyncPlanner'

const store = useRaiderLoadoutStore()
const overlayStore = useOverlayWindowStore()

const rt = computed(() => overlayStore.raiderSyncRuntime)
const importNote = ref('')

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
} = useRaiderLoadoutSync(store, {
  currentLabelPrefix: '当前战备',
  onBeforeProcess: () => {
    importNote.value = ''
  },
})

const activeTargetSource = computed(
  () =>
    availableLoadoutSources.value.find((x) => x.key === rt.value.loadoutSourceKey) ||
    availableLoadoutSources.value[0],
)

const liveDiff = computed(() => {
  if (!activeTargetSource.value) return null
  return analyzeLoadoutSyncDiff(
    precheckInGameLoadout.value,
    activeTargetSource.value.loadout,
  )
})

async function handlePrecheck() {
  await runPrecheckInGameState(() => {
    rt.value.banner = null
  })
}

async function handleStartAutoSync() {
  const src = activeTargetSource.value
  if (!src || !liveDiff.value?.totalTargetSlots) {
    rt.value.banner = {
      type: 'warn',
      text: '所选战备为空，请先切换战备方案或在主窗口选配装备',
    }
    return
  }

  const wasCollapsed = overlayStore.collapsed
  rt.value.running = true
  rt.value.banner = null
  rt.value.progressPct = 5
  rt.value.text = '正在切入游戏战备画面...'

  try {
    if (!wasCollapsed) {
      await overlayStore.setCollapsed(true)
    }

    const res = await runLoadoutAutoSyncSession({
      targetLoadout: src.loadout,
      weaponLoadWaitMs: Math.round((Number(weaponLoadWaitSec.value) || 0) * 1000),
      onProgress(ev) {
        if (ev?.message) rt.value.text = ev.message
        if (typeof ev?.progressPct === 'number') rt.value.progressPct = ev.progressPct
      },
    })

    if (res.inGameLoadout) {
      precheckInGameLoadout.value = res.inGameLoadout
    }
    rt.value.banner = {
      type: res.ok ? (res.remainingCount > 0 ? 'warn' : 'ok') : 'err',
      text: res.message,
    }
  } catch (err) {
    rt.value.banner = {
      type: err?.aborted ? 'warn' : 'err',
      text: err?.message || '自动配装已停止',
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
  if (!src || !liveDiff.value?.totalTargetSlots) {
    rt.value.banner = {
      type: 'warn',
      text: '请先选择有效的目标战备方案',
    }
    return
  }
  await overlayStore.launchRaiderPerspectiveGuide({
    kind: 'loadout',
    origin: 'overlay',
    title: src.shortTitle || '目标战备',
    targetLoadout: src.loadout,
    inGameLoadout: precheckInGameLoadout.value || null,
  })
}

function applyRecognizedAction(saveArchive = false) {
  const res = recognizedResult.value
  if (!res?.ok) return
  store.applyRecognizedLoadout(res.loadout, '悬浮窗识图')
  if (saveArchive) {
    const name =
      saveImportName.value.trim() ||
      `实机战备 (${describeLoadoutBrief(res.loadout).slice(0, 10)})`
    const saved = store.saveCustomLoadout(name)
    saveImportName.value = ''
    if (saved?.id) rt.value.loadoutSourceKey = `saved:${saved.id}`
    importNote.value = `✓ 已存为「${saved.name}」并同步至主窗口`
  } else {
    rt.value.loadoutSourceKey = 'current'
    importNote.value = '✓ 已应用至当前战备（主窗口实时同步）'
  }
}

function onOverlayPaste(e) {
  if (
    overlayStore.activeTab !== 'raider' ||
    overlayStore.collapsed ||
    rt.value.moduleMode !== 'loadout'
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
  <section class="orl-root">
    <!-- Sub-Mode Switcher -->
    <div class="orl-subbar no-drag">
      <div class="orl-pills">
        <button
          type="button"
          class="orl-pill"
          :class="{ active: rt.subTab === 'sync' }"
          :disabled="rt.running"
          @click="rt.subTab = 'sync'; refreshGameWindowStatus()"
        >
          同步至游戏
        </button>
        <button
          type="button"
          class="orl-pill"
          :class="{ active: rt.subTab === 'recognize' }"
          :disabled="rt.running"
          @click="rt.subTab = 'recognize'"
        >
          识图导入
        </button>
      </div>

      <button
        type="button"
        class="orl-main-link"
        title="在主窗口打开完整战备选配台"
        @click="overlayStore.openInMainWindow('/raider/loadout', true)"
      >
        完整选配 ↗
      </button>
    </div>

    <!-- ===============================================================
         SUB-TAB 1: 同步至游戏 (透视配装指引 + 仓库辅助配装)
         =============================================================== -->
    <div v-if="rt.subTab === 'sync'" class="orl-scroll">
      <div class="orl-card">
        <div class="orl-card-head">
          <span>目标战备方案</span>
          <span v-if="isDesktop" class="win-dot-tag" :class="{ ok: gameWinStatus?.found }">
            <i></i>
            {{ gameWinStatus?.found ? '游戏在线' : '未检测到游戏' }}
          </span>
        </div>

        <select
          v-model="rt.loadoutSourceKey"
          class="orl-select"
          :disabled="rt.running"
        >
          <option
            v-for="src in availableLoadoutSources"
            :key="src.key"
            :value="src.key"
          >
            [{{ src.group }}] {{ src.name }}
          </option>
        </select>

        <!-- Primary Action Buttons -->
        <div class="orl-btn-stack">
          <button
            type="button"
            class="orl-btn amber"
            :disabled="rt.running || !liveDiff?.totalTargetSlots"
            @click="handleLaunchGuide"
          >
            全屏透视配装指引 (Alt+F)
          </button>

          <div v-if="isDesktop" class="orl-wait-row" title="新版游戏武器缩略图为实时 3D 渲染，加载较慢；选中武器栏、翻页查找武器、拖入武器后都会等待该时长再识别">
            <span>武器加载等待</span>
            <input
              v-model.number="weaponLoadWaitSec"
              type="range"
              min="0"
              max="15"
              step="0.5"
              :disabled="rt.running"
            />
            <b class="ar-num">{{ Number(weaponLoadWaitSec).toFixed(1) }}s</b>
          </div>

          <div v-if="isDesktop" class="orl-btn-row">
            <button
              type="button"
              class="orl-btn"
              :disabled="rt.running || precheckLoading"
              @click="handlePrecheck"
            >
              {{ precheckLoading ? '扫描中...' : '读取实机差量' }}
            </button>

            <button
              v-if="!rt.running"
              type="button"
              class="orl-btn cyan"
              :disabled="!liveDiff?.totalTargetSlots"
              @click="handleStartAutoSync"
            >
              仓库辅助自动配装
            </button>
            <button
              v-else
              type="button"
              class="orl-btn danger"
              @click="handleStopAutoSync"
            >
              急停 (ESC)
            </button>
          </div>
        </div>

        <div v-if="precheckError" class="orl-msg err">{{ precheckError }}</div>
        <div v-if="rt.banner" class="orl-msg" :class="rt.banner.type">
          {{ rt.banner.text }}
        </div>
      </div>

      <!-- Compact Slot Checklist -->
      <div v-if="liveDiff?.entries?.length" class="orl-card">
        <div class="orl-card-head">
          <span>槽位清单 ({{ liveDiff.totalTargetSlots }})</span>
          <span v-if="liveDiff.hasLiveSnapshot" class="ar-num">
            已就绪 <b class="ok">{{ liveDiff.matchedCount }}</b> · 待装
            <b class="warn">{{ liveDiff.pendingCount }}</b>
          </span>
        </div>

        <div class="orl-slot-list">
          <div
            v-for="e in liveDiff.entries"
            :key="e.key"
            class="orl-slot-row"
            :class="{ matched: e.matched }"
            :style="{ '--sc': e.color }"
          >
            <img :src="e.icon" alt="" />
            <div class="osr-main">
              <div class="osr-top">
                <small>{{ e.slotLabel }}</small>
                <strong>{{ e.targetName }}</strong>
              </div>
              <div v-if="e.subTags?.length" class="osr-sub">
                {{ e.subTags.slice(0, 3).join(' · ') }}
              </div>
            </div>
            <em class="ar-num">{{ e.matched ? '✓' : e.badge }}</em>
          </div>
        </div>
      </div>
    </div>

    <!-- ===============================================================
         SUB-TAB 2: 识图导入战备
         =============================================================== -->
    <div v-else class="orl-scroll">
      <input
        ref="fileInputRef"
        type="file"
        accept="image/*"
        hidden
        @change="onFileSelected"
      />

      <div
        class="orl-card drop-box"
        @dragover.prevent
        @drop="onDropImage"
      >
        <strong>抓取游戏战备画面或按 Ctrl+V 粘贴截图</strong>
        <div class="orl-btn-row">
          <button
            v-if="isDesktop"
            type="button"
            class="orl-btn cyan"
            :disabled="isRecognizing"
            @click="handleCaptureGameForRecognize"
          >
            {{ isRecognizing ? '识别中...' : '抓取游戏画面' }}
          </button>
          <button
            type="button"
            class="orl-btn"
            :disabled="isRecognizing"
            @click="handleReadClipboard"
          >
            剪贴板
          </button>
          <button
            type="button"
            class="orl-btn"
            :disabled="isRecognizing"
            @click="triggerFileSelect"
          >
            选择图片
          </button>
        </div>

        <div v-if="recognizeError" class="orl-msg err">{{ recognizeError }}</div>
        <div v-if="importNote" class="orl-msg ok">{{ importNote }}</div>
      </div>

      <div v-if="recognizedResult?.ok" class="orl-card">
        <div class="orl-card-head">
          <span>识别结果 ({{ recognizedSlotsView.length }} 项)</span>
          <img v-if="previewUrl" :src="previewUrl" alt="" class="mini-thumb" />
        </div>

        <div class="orl-slot-list">
          <div
            v-for="s in recognizedSlotsView"
            :key="s.key"
            class="orl-slot-row"
            :style="{ '--sc': s.color }"
          >
            <img :src="s.icon" alt="" />
            <div class="osr-main">
              <div class="osr-top">
                <small>{{ s.slotLabel }}</small>
                <strong>{{ s.targetName }}</strong>
              </div>
              <div v-if="s.subTags?.length" class="osr-sub">
                {{ s.subTags.slice(0, 3).join(' · ') }}
              </div>
            </div>
            <em class="ar-num">{{ s.badge }}</em>
          </div>
        </div>

        <input
          v-model="saveImportName"
          type="text"
          class="orl-input"
          placeholder="可选存档名称..."
        />

        <div class="orl-btn-row">
          <button
            type="button"
            class="orl-btn"
            @click="applyRecognizedAction(true)"
          >
            存为存档
          </button>
          <button
            type="button"
            class="orl-btn cyan"
            @click="applyRecognizedAction(false)"
          >
            应用至当前战备
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.orl-root {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.orl-subbar {
  flex-shrink: 0;
  padding: 7px 10px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.orl-pills {
  display: flex;
  gap: 4px;
}

.orl-pill {
  height: 26px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: rgba(14, 18, 34, 0.72);
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
}

.orl-pill.active {
  border-color: rgba(95, 255, 255, 0.5);
  background: rgba(95, 255, 255, 0.13);
  color: var(--c-raider);
}

.orl-main-link {
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--tx-2);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.orl-main-link:hover {
  border-color: var(--amber);
  color: var(--cream);
}

.orl-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.orl-card {
  padding: 9px 10px;
  border-radius: 5px;
  background: rgba(18, 23, 38, 0.85);
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.orl-card.drop-box {
  border-style: dashed;
  text-align: center;
}

.orl-card.drop-box strong {
  font-size: 12px;
  color: var(--cream);
}

.orl-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  color: var(--tx-3);
}

.orl-card-head b.ok {
  color: #36e275;
}

.orl-card-head b.warn {
  color: var(--amber);
}

.win-dot-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: var(--tx-3);
}

.win-dot-tag i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tx-3);
}

.win-dot-tag.ok {
  color: #36e275;
}

.win-dot-tag.ok i {
  background: #26bf57;
}

.orl-select,
.orl-input {
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(9, 12, 25, 0.85);
  color: var(--cream);
  font-size: 11.5px;
  outline: none;
}

.orl-btn-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.orl-btn-row {
  display: flex;
  gap: 6px;
}

.orl-wait-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 2px;
  font-size: 11px;
  color: var(--text-dim, rgba(242, 239, 232, 0.72));
}

.orl-wait-row span {
  flex-shrink: 0;
}

.orl-wait-row input[type='range'] {
  flex: 1 1 auto;
  min-width: 0;
  accent-color: #00d6e4;
}

.orl-wait-row b {
  flex-shrink: 0;
  min-width: 34px;
  text-align: right;
  font-weight: 600;
  color: #f2efe8;
}

.orl-btn {
  flex: 1 1 auto;
  height: 30px;
  padding: 0 10px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 800;
  cursor: pointer;
}

.orl-btn.amber {
  border-color: var(--amber);
  background: var(--amber);
  color: var(--ink);
}

.orl-btn.cyan {
  border-color: rgba(95, 255, 255, 0.55);
  background: rgba(95, 255, 255, 0.15);
  color: var(--c-raider);
}

.orl-btn.danger {
  border-color: var(--st-danger);
  background: rgba(255, 48, 38, 0.18);
  color: #ff7b74;
}

.orl-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.orl-msg {
  padding: 6px 8px;
  border-radius: 4px;
  font-size: 11px;
  border: 1px solid var(--line);
  background: rgba(9, 12, 25, 0.72);
  color: var(--cream);
}

.orl-msg.ok {
  border-color: rgba(38, 191, 87, 0.45);
  color: #36e275;
}

.orl-msg.warn {
  border-color: rgba(255, 188, 19, 0.45);
  color: var(--amber);
}

.orl-msg.err {
  border-color: rgba(255, 48, 38, 0.45);
  color: #ff7b74;
}

.orl-slot-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.orl-slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  background: rgba(9, 12, 25, 0.65);
  border: 1px solid var(--line);
  border-left: 3px solid var(--sc, var(--c-raider));
}

.orl-slot-row.matched {
  opacity: 0.62;
  border-left-color: #26bf57;
}

.orl-slot-row img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex-shrink: 0;
}

.osr-main {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.osr-top {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.osr-top small {
  font-size: 10px;
  color: var(--tx-3);
}

.osr-top strong {
  font-size: 11.5px;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osr-sub {
  font-size: 10px;
  color: var(--tx-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.orl-slot-row em {
  font-style: normal;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
  color: var(--cream);
}

.orl-slot-row.matched em {
  color: #36e275;
}

.mini-thumb {
  width: 48px;
  height: 27px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--line);
}
</style>
