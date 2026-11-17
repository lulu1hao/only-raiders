import { computed, ref, watch } from 'vue'
import { invokeTauri, isTauriRuntime } from '../stores/useOverlayWindowStore'
import { sanitizeLoadoutState } from '../stores/useRaiderLoadoutStore'
import {
  DEFAULT_RAIDER_SYNC_OPTIONS,
  RESTOCK_POLICY_OPTIONS,
  describeSyncOptionsUiState,
  sanitizeRaiderSyncOptions,
} from '../utils/raiderAcquisitionCatalog'
import {
  decodeSourceToImageData,
  recognizeLoadoutFromImageData,
} from '../utils/raiderLoadoutRecognizer'
import {
  analyzeLoadoutSyncDiff,
  captureGameClientImageData,
  describeLoadoutBrief,
} from '../utils/raiderLoadoutSyncPlanner'

export { RESTOCK_POLICY_OPTIONS }

// 武器栏加载等待（秒）：武器缩略图由游戏实时 3D 渲染，加载较慢；全局共享并持久化，主窗口与悬浮窗同步
const WEAPON_WAIT_STORAGE_KEY = 'arcmap.raider.weaponLoadWaitSec'
export const WEAPON_WAIT_MIN_SEC = 0
export const WEAPON_WAIT_MAX_SEC = 15
export const WEAPON_WAIT_DEFAULT_SEC = 3

function clampWeaponWaitSec(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return WEAPON_WAIT_DEFAULT_SEC
  return Math.round(Math.min(WEAPON_WAIT_MAX_SEC, Math.max(WEAPON_WAIT_MIN_SEC, n)) * 10) / 10
}

function readStoredWeaponWaitSec() {
  try {
    const raw = window.localStorage?.getItem(WEAPON_WAIT_STORAGE_KEY)
    return raw == null ? WEAPON_WAIT_DEFAULT_SEC : clampWeaponWaitSec(raw)
  } catch {
    return WEAPON_WAIT_DEFAULT_SEC
  }
}

const weaponLoadWaitSec = ref(readStoredWeaponWaitSec())
watch(weaponLoadWaitSec, (v) => {
  const c = clampWeaponWaitSec(v)
  if (c !== v) {
    weaponLoadWaitSec.value = c
    return
  }
  try {
    window.localStorage?.setItem(WEAPON_WAIT_STORAGE_KEY, String(c))
  } catch {
    /* ignore quota / privacy mode */
  }
})
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === WEAPON_WAIT_STORAGE_KEY && e.newValue != null) {
      weaponLoadWaitSec.value = clampWeaponWaitSec(e.newValue)
    }
  })
}

export function useWeaponLoadWait() {
  const weaponLoadWaitMs = computed(() => Math.round(clampWeaponWaitSec(weaponLoadWaitSec.value) * 1000))
  return { weaponLoadWaitSec, weaponLoadWaitMs }
}

// 自动配装进阶选项（武器等级匹配、武器配件同步、缺失时工坊/商人自动补货）：默认关闭，全局持久化且主窗与悬浮窗实时同步
const SYNC_OPTIONS_STORAGE_KEY = 'arcmap.raider.syncOptions.v1'

function readStoredSyncOptions() {
  try {
    const raw = window.localStorage?.getItem(SYNC_OPTIONS_STORAGE_KEY)
    return raw ? sanitizeRaiderSyncOptions(JSON.parse(raw)) : { ...DEFAULT_RAIDER_SYNC_OPTIONS }
  } catch {
    return { ...DEFAULT_RAIDER_SYNC_OPTIONS }
  }
}

const raiderSyncOptions = ref(readStoredSyncOptions())
watch(
  raiderSyncOptions,
  (val) => {
    try {
      const clean = sanitizeRaiderSyncOptions(val)
      window.localStorage?.setItem(SYNC_OPTIONS_STORAGE_KEY, JSON.stringify(clean))
    } catch {
      /* ignore quota / privacy mode */
    }
  },
  { deep: true },
)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SYNC_OPTIONS_STORAGE_KEY) {
      try {
        raiderSyncOptions.value = e.newValue
          ? sanitizeRaiderSyncOptions(JSON.parse(e.newValue))
          : { ...DEFAULT_RAIDER_SYNC_OPTIONS }
      } catch {
        raiderSyncOptions.value = { ...DEFAULT_RAIDER_SYNC_OPTIONS }
      }
    }
  })
}

const syncOptionsUi = computed(() => describeSyncOptionsUiState(raiderSyncOptions.value))

export function useRaiderSyncOptions() {
  return { syncOptions: raiderSyncOptions, syncOptionsUi, RESTOCK_POLICY_OPTIONS }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function useRaiderLoadoutSync(loadoutStore, options = {}) {
  const {
    currentLabelPrefix = '当前战备',
    defaultRecognizeError = '未能识别战备槽位，请确认截图为游戏内「仓库 / 战备」界面',
    emptyClipboardError = '剪贴板中未找到截图，请先按 Win+Shift+S 截图后再粘贴',
    pasteHintError = '请直接按下 Ctrl + V 粘贴截图',
    defaultPrecheckError = '未能读取游戏内战备，请确认游戏停留在「仓库 / 战备」画面',
    onBeforeProcess = null,
  } = options

  const isDesktop = isTauriRuntime()

  // 1. 识图导入状态
  const fileInputRef = ref(null)
  const isRecognizing = ref(false)
  const recognizeError = ref('')
  const previewUrl = ref('')
  const recognizedResult = ref(null)
  const saveImportName = ref('')

  function revokePreviewUrl() {
    if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl.value)
    }
    previewUrl.value = ''
  }

  const recognizedSlotsView = computed(() => {
    if (!recognizedResult.value?.ok) return []
    const clean = sanitizeLoadoutState(recognizedResult.value.loadout)
    return analyzeLoadoutSyncDiff(null, clean).entries
  })

  async function processImageSource(source, displayBlob = null) {
    isRecognizing.value = true
    recognizeError.value = ''
    if (onBeforeProcess) onBeforeProcess()
    recognizedResult.value = null
    try {
      revokePreviewUrl()
      if (displayBlob instanceof Blob) {
        previewUrl.value = URL.createObjectURL(displayBlob)
      } else if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
        previewUrl.value = URL.createObjectURL(new Blob([source], { type: 'image/bmp' }))
      }

      const imgData = await decodeSourceToImageData(source, 2560)
      const rec = await recognizeLoadoutFromImageData(imgData)
      if (!rec.ok) {
        recognizeError.value = rec.error || defaultRecognizeError
        return
      }
      recognizedResult.value = {
        ...rec,
        loadout: sanitizeLoadoutState(rec.loadout),
      }
    } catch (err) {
      recognizeError.value = err?.message || '图像解析失败'
    } finally {
      isRecognizing.value = false
    }
  }

  async function handleCaptureGameForRecognize() {
    isRecognizing.value = true
    recognizeError.value = ''
    if (onBeforeProcess) onBeforeProcess()
    try {
      const winInfo = await invokeTauri('raider_find_game_window')
      if (!winInfo?.found || !winInfo?.hwnd) {
        recognizeError.value = '未检测到运行中的《ARC Raiders》窗口，请使用 Ctrl+V 粘贴截图'
        return
      }
      const rawBmp = await invokeTauri('raider_capture_client', {
        hwnd: winInfo.hwnd,
        maxWidth: 2560,
      })
      if (!rawBmp) {
        recognizeError.value = '抓取游戏画面失败，请确认游戏为窗口化/无边框模式，或按 Ctrl+V 粘贴截图'
        return
      }
      await processImageSource(rawBmp)
    } catch (err) {
      recognizeError.value = err?.message || '窗口抓取异常'
    } finally {
      isRecognizing.value = false
    }
  }

  function triggerFileSelect() {
    fileInputRef.value?.click()
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    await processImageSource(file, file)
  }

  async function onDropImage(e) {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0]
    if (file && file.type.startsWith('image/')) {
      await processImageSource(file, file)
    }
  }

  async function handleReadClipboard() {
    if (!navigator.clipboard?.read) {
      recognizeError.value = pasteHintError
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imgType = item.types.find((t) => t.startsWith('image/'))
        if (imgType) {
          const blob = await item.getType(imgType)
          await processImageSource(blob, blob)
          return
        }
      }
      recognizeError.value = emptyClipboardError
    } catch {
      recognizeError.value = pasteHintError
    }
  }

  // 2. 战备源列表与实机比对状态
  const gameWinStatus = ref(null)
  const precheckInGameLoadout = ref(null)
  const precheckLoading = ref(false)
  const precheckError = ref('')

  // 从「仅快速使用」切回完整战备模式时，丢弃仅包含快捷栏的局部实机快照，避免误判其余槽位缺失
  watch(
    () => raiderSyncOptions.value.quickUseOnly,
    (next, prev) => {
      if (prev && !next && precheckInGameLoadout.value?._quickUseOnly) {
        precheckInGameLoadout.value = null
      }
    },
  )

  const availableLoadoutSources = computed(() => {
    const curBrief = describeLoadoutBrief(loadoutStore.currentLoadout)
    const opts = [
      {
        key: 'current',
        group: '当前编辑',
        name: `${currentLabelPrefix}（${curBrief}）`,
        shortTitle: currentLabelPrefix,
        loadout: sanitizeLoadoutState(loadoutStore.currentLoadout),
      },
    ]

    for (const sl of loadoutStore.savedLoadouts) {
      opts.push({
        key: `saved:${sl.id}`,
        group: '本地存档',
        name: `${sl.name}（${describeLoadoutBrief(sl.loadout)}）`,
        shortTitle: sl.name,
        loadout: sanitizeLoadoutState(sl.loadout),
      })
    }

    return opts
  })

  async function refreshGameWindowStatus() {
    if (!isDesktop) return
    const info = await invokeTauri('raider_find_game_window')
    gameWinStatus.value = info || { found: false }
  }

  async function runPrecheckInGameState(onBeforePrecheck = null) {
    if (!isDesktop) return
    precheckLoading.value = true
    precheckError.value = ''
    if (onBeforePrecheck) onBeforePrecheck()
    try {
      await refreshGameWindowStatus()
      const info = gameWinStatus.value
      const quickUseOnly = Boolean(raiderSyncOptions.value?.quickUseOnly)
      let { imageData } = await captureGameClientImageData(info?.hwnd || 0, 2560)
      let rec = await recognizeLoadoutFromImageData(imageData, { quickUseOnly })
      // 武器栏已占用但实时渲染缩略图仍在加载时，按配置等待后重读一次（仅快捷栏模式跳过）
      const waitMs = Math.round(clampWeaponWaitSec(weaponLoadWaitSec.value) * 1000)
      if (
        !quickUseOnly &&
        rec.ok &&
        waitMs > 0 &&
        (rec.weaponSlotStates || []).some((s) => s?.occupied && !s.identified)
      ) {
        await sleep(waitMs)
        ;({ imageData } = await captureGameClientImageData(info?.hwnd || 0, 2560))
        rec = await recognizeLoadoutFromImageData(imageData, { quickUseOnly })
      }
      if (!rec.ok) {
        precheckError.value = rec.error || defaultPrecheckError
        return
      }
      precheckInGameLoadout.value = sanitizeLoadoutState(rec.loadout)
    } catch (err) {
      precheckError.value = err?.message || '读取游戏内状态失败'
    } finally {
      precheckLoading.value = false
    }
  }

  return {
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
    syncOptions: raiderSyncOptions,
    syncOptionsUi,
    RESTOCK_POLICY_OPTIONS,
  }
}
