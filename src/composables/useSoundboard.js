import { reactive } from 'vue'
import { defaultSoundboardSettings } from '../utils/soundboardModel'

function isTauriRuntime() {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__)
  )
}

export async function invokeSoundboard(cmd, args = {}) {
  if (typeof window === 'undefined') {
    throw new Error('当前环境不支持桌面音频通道')
  }
  const fn = window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke
  if (typeof fn !== 'function') {
    throw new Error('请在桌面客户端中使用局内放歌功能')
  }
  return await fn(cmd, args)
}

const state = reactive({
  desktop: isTauriRuntime(),
  ready: false,
  starting: false,
  startupError: '',
  startupStep: '',
  startupAttempts: 0,
  pollError: '',
  tracks: [],
  settings: defaultSoundboardSettings(),
  folders: [],
  hiddenCount: 0,
  devices: { inputs: [], outputs: [] },
  error: '',
  notice: '',
  status: {
    mode: 0,
    playing: false,
    loading: false,
    trackId: null,
    position: 0,
    duration: 0,
    micMuted: false,
    musicPeak: 0,
    micPeak: 0,
    outputPeak: 0,
    error: null,
    shortcutError: null,
  },
})

const startupSteps = [
  ['soundboard_library', '读取音效库', () => refreshLibrary()],
  ['soundboard_devices', '枚举音频设备', () => refreshDevices()],
  ['soundboard_status', '读取播放状态', () => refreshStatus(true)],
]
const startupRetries = [400, 1200, 2500, 5000, 5000, 5000]
let initializing = null
let retryTimer = null
let retryIndex = 0
let timer = null
let references = 0
let currentRefreshPromise = null
let pendingForce = false

async function refreshStatus(force = false) {
  state.desktop = isTauriRuntime()
  if (!state.desktop) return
  if (currentRefreshPromise) {
    if (force) pendingForce = true
    return currentRefreshPromise
  }
  currentRefreshPromise = (async () => {
    try {
      state.status = await invokeSoundboard('soundboard_status')
      state.pollError = ''
    } catch (error) {
      state.pollError = `读取播放状态失败：${String(error)}`
    } finally {
      currentRefreshPromise = null
      if (pendingForce) {
        pendingForce = false
        void refreshStatus(true)
      }
    }
  })()
  return currentRefreshPromise
}

async function refreshLibrary() {
  state.desktop = isTauriRuntime()
  if (!state.desktop) return
  const library = await invokeSoundboard('soundboard_library')
  state.tracks = library.tracks || []
  state.settings = library.settings || defaultSoundboardSettings()
  state.folders = library.folders || []
  state.hiddenCount = (library.hidden || []).length
}

async function refreshDevices() {
  state.desktop = isTauriRuntime()
  if (!state.desktop) return
  state.devices = await invokeSoundboard('soundboard_devices')
}

async function run(callback) {
  state.error = ''
  try {
    return await callback()
  } catch (error) {
    state.error = String(error)
    throw error
  }
}

async function startup() {
  state.starting = true
  for (const [command, label, call] of startupSteps) {
    state.startupStep = label
    try {
      await call()
    } catch (error) {
      state.starting = false
      state.startupError = `${label}失败（${command}）：${String(error)}`
      scheduleRetry()
      throw error
    }
  }
  state.starting = false
  state.startupError = ''
  state.startupStep = ''
  retryIndex = 0
  state.startupAttempts = 0
  state.ready = true
}

function scheduleRetry() {
  if (retryTimer || retryIndex >= startupRetries.length) return
  const delay = startupRetries[retryIndex]
  retryIndex++
  state.startupAttempts = retryIndex
  retryTimer = setTimeout(() => {
    retryTimer = null
    void initialize().catch(() => {})
  }, delay)
}

async function initialize() {
  state.desktop = isTauriRuntime()
  if (!state.desktop) {
    state.ready = true
    return
  }
  if (state.ready) return
  if (!initializing) {
    initializing = startup().finally(() => {
      initializing = null
    })
  }
  return initializing
}

async function retryStartup() {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryIndex = 0
  state.startupAttempts = 0
  state.startupError = ''
  initializing = null
  return initialize().catch(() => {})
}

async function action(act, id = null, value = null) {
  state.desktop = isTauriRuntime()
  if (!state.desktop) return
  return run(async () => {
    await invokeSoundboard('soundboard_control', { action: act, id, value })
    await refreshStatus(true)
  })
}

async function configure(settings) {
  state.desktop = isTauriRuntime()
  if (!state.desktop) return
  return run(async () => {
    await invokeSoundboard('soundboard_configure', { settings })
    await refreshLibrary()
    await refreshStatus(true)
  })
}

function scheduleNextPoll() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  if (!state.desktop || references <= 0) return
  const isHidden = typeof document !== 'undefined' && document.hidden
  const isActive =
    state.status.playing || state.status.loading || Number(state.status.mode) > 0
  const delay = isHidden ? 3000 : isActive ? 250 : 1200
  timer = setTimeout(async () => {
    timer = null
    if (references <= 0) return
    if (typeof document === 'undefined' || !document.hidden) {
      await refreshStatus()
    }
    scheduleNextPoll()
  }, delay)
}

function startPolling() {
  state.desktop = isTauriRuntime()
  references++
  if (state.desktop && !timer) {
    void refreshStatus().finally(() => {
      scheduleNextPoll()
    })
  }
  return () => {
    references = Math.max(0, references - 1)
    if (references === 0 && timer) {
      clearTimeout(timer)
      timer = null
    }
  }
}

export function useSoundboard() {
  return {
    state,
    initialize,
    retryStartup,
    action,
    configure,
    run,
    refreshLibrary,
    refreshDevices,
    refreshStatus,
    startPolling,
  }
}
