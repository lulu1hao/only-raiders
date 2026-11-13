import { computed, ref } from 'vue'
import { invokeTauri, isTauriRuntime } from '../stores/useOverlayWindowStore'
import { assetUrl } from '../utils/assetUrl'
import {
  decodeSourceToImageData,
  recognizeBuildFromImageData,
} from '../utils/raiderVisionRecognizer'
import { captureGameClientImageData } from '../utils/raiderAutoSyncPlanner'

export function computeBuildBranchBreakdown(build, tree, branches) {
  if (!build || !tree?.nodes) return []
  const sums = { conditioning: 0, mobility: 0, survival: 0 }
  for (const node of tree.nodes) {
    const sid =
      node.kind === 'normal' ? node.skillId : build.gateSelections?.[node.slotKey] || null
    if (sid) {
      sums[node.branch] = (sums[node.branch] || 0) + (build.allocations?.[sid] || 0)
    }
  }
  return (branches || []).map((b) => ({
    ...b,
    pts: sums[b.id] || 0,
  }))
}

export function computeBuildGateChips(build, tree, branchMap) {
  if (!build || !tree?.nodes) return []
  const list = []
  for (const node of tree.nodes) {
    if (node.kind === 'normal') continue
    const sid = build.gateSelections?.[node.slotKey]
    if (!sid) continue
    const sk = tree.skills?.[sid]
    if (sk) {
      const color = branchMap?.[node.branch]?.color || '#5fffff'
      list.push({
        slotKey: node.slotKey,
        name: sk.name,
        icon: assetUrl(sk.icon),
        color,
        branchColor: color,
      })
    }
  }
  return list
}

export function useRaiderVisionSync(store, options = {}) {
  const {
    currentLabelPrefix = '当前编辑中配装',
    defaultRecognizeError = '未能从截图中识别出技能树结构',
    emptyClipboardError = '剪贴板中未找到截图，请先在游戏内按 Win+Shift+S 或 PrintScreen 截图',
    pasteHintError = '请直接按下 Ctrl + V 粘贴剪贴板截图',
    defaultPrecheckError = '未能读取游戏内技能树，请确认游戏当前停留在技能树画面',
    includePresets = true,
    onBeforeProcess = null,
  } = options

  const isDesktop = isTauriRuntime()

  // 1. Shared image recognition state & lifecycle
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

  const recognizedBranches = computed(() =>
    recognizedResult.value?.ok
      ? computeBuildBranchBreakdown(
          recognizedResult.value,
          store.currentTree,
          store.branches,
        )
      : [],
  )

  const recognizedGates = computed(() =>
    recognizedResult.value?.ok
      ? computeBuildGateChips(recognizedResult.value, store.currentTree, store.branchMap)
      : [],
  )

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

      const imgData = await decodeSourceToImageData(source, 1920)
      const rec = await recognizeBuildFromImageData(imgData, store.currentTree)
      if (!rec.ok) {
        recognizeError.value = rec.error || defaultRecognizeError
        return
      }
      recognizedResult.value = rec
    } catch (err) {
      recognizeError.value = err?.message || '图像解析失败，请重试'
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
        recognizeError.value =
          '未检测到运行中的《ARC Raiders》窗口，请确认游戏已启动，或直接使用 Ctrl+V 粘贴截图。'
        return
      }
      const rawBmp = await invokeTauri('raider_capture_client', {
        hwnd: winInfo.hwnd,
        maxWidth: 1920,
      })
      if (!rawBmp) {
        recognizeError.value =
          '抓取游戏画面失败，请确认游戏为无边框窗口/窗口化模式，或使用 Ctrl+V 粘贴截图。'
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

  // 2. Shared build source catalog & game-window precheck state
  const gameWinStatus = ref(null)
  const precheckInGameBuild = ref(null)
  const precheckLoading = ref(false)
  const precheckError = ref('')

  const availableBuildSources = computed(() => {
    const opts = [
      {
        key: 'current',
        group: '当前画布',
        name: `${currentLabelPrefix} (${store.totalSpentPoints}P)`,
        spent: store.totalSpentPoints,
        build: {
          allocations: store.currentBuild.allocations,
          gateSelections: store.currentBuild.gateSelections,
        },
      },
    ]

    for (const sb of store.savedBuilds) {
      opts.push({
        key: `saved:${sb.id}`,
        group: '我的存档',
        name: `${sb.name} (${sb.spentPoints}P)`,
        spent: sb.spentPoints,
        build: {
          allocations: sb.allocations || {},
          gateSelections: sb.gateSelections || {},
        },
      })
    }

    if (includePresets) {
      for (const pr of store.presets) {
        opts.push({
          key: `preset:${pr.id}`,
          group: '官方预设',
          name: `${pr.name}`,
          spent: pr.maxPoints,
          build: {
            allocations: pr.allocations || {},
            gateSelections: pr.gateSelections || {},
          },
        })
      }
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
      const { imageData } = await captureGameClientImageData(info?.hwnd || 0, 1920)
      const rec = await recognizeBuildFromImageData(imageData, store.currentTree)
      if (!rec.ok) {
        precheckError.value = rec.error || defaultPrecheckError
        return
      }
      precheckInGameBuild.value = rec
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
    saveImportName,
    revokePreviewUrl,
    recognizedBranches,
    recognizedGates,
    processImageSource,
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
  }
}
