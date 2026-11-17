import { computed, reactive } from 'vue'

const PREFS_STORAGE_KEY = 'only_raiders_updater_prefs_v1'
const DEFAULT_REPO = 'lulu1hao/only-raiders'
const FALLBACK_VERSION = '0.1.3'

function getTauriInvoke() {
  if (typeof window === 'undefined') return null
  return window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke || null
}

function isTauriRuntime() {
  return Boolean(getTauriInvoke())
}

async function invokeStrict(cmd, args = {}) {
  const invoke = getTauriInvoke()
  if (!invoke) {
    throw new Error('当前运行在浏览器预览模式，自动替换更新仅在桌面端 exe 中可用')
  }
  try {
    return await invoke(cmd, args)
  } catch (err) {
    if (typeof err === 'string') throw new Error(err)
    if (err instanceof Error) throw err
    throw new Error(String(err ?? '未知错误'))
  }
}

function loadPrefs() {
  const defaults = {
    autoCheck: true,
    useMirror: true,
    ignoredVersion: '',
  }
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw)
    return {
      autoCheck: typeof parsed?.autoCheck === 'boolean' ? parsed.autoCheck : defaults.autoCheck,
      useMirror: typeof parsed?.useMirror === 'boolean' ? parsed.useMirror : defaults.useMirror,
      ignoredVersion: typeof parsed?.ignoredVersion === 'string' ? parsed.ignoredVersion : '',
    }
  } catch {
    return defaults
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore storage quota failures
  }
}

const initialPrefs = loadPrefs()

const state = reactive({
  initialized: false,
  isDesktopApp: isTauriRuntime(),
  modalOpen: false,
  checking: false,
  downloading: false,
  currentVersion: FALLBACK_VERSION,
  productName: 'only raiders',
  repo: DEFAULT_REPO,
  exePath: '',
  exeDir: '',
  canSelfReplace: false,
  isDevBuild: false,
  release: null,
  checkError: '',
  checkNotice: '',
  lastCheckedAt: null,
  progress: {
    stage: 'idle',
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    message: '',
    error: null,
  },
  prefs: initialPrefs,
})

let pollTimer = null
let bootChecked = false

function stopProgressPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function startProgressPolling() {
  stopProgressPolling()
  pollTimer = setInterval(async () => {
    if (!isTauriRuntime()) {
      stopProgressPolling()
      return
    }
    try {
      const p = await invokeStrict('get_update_progress')
      if (p) state.progress = p
    } catch {
      // keep polling until install promise settles
    }
  }, 180)
}

function compareSimpleSemver(currentRaw, nextRaw) {
  const norm = (v) =>
    String(v || '')
      .trim()
      .replace(/^[vV]/, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0)
  const a = norm(currentRaw)
  const b = norm(nextRaw)
  for (let i = 0; i < 3; i += 1) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0)
    if (diff !== 0) return diff > 0
  }
  return false
}

async function initVersionInfo() {
  state.isDesktopApp = isTauriRuntime()
  if (state.isDesktopApp) {
    try {
      const info = await invokeStrict('get_app_version_info')
      if (info) {
        state.currentVersion = info.version || FALLBACK_VERSION
        state.productName = info.productName || 'only raiders'
        state.repo = info.repo || DEFAULT_REPO
        state.exePath = info.exePath || ''
        state.exeDir = info.exeDir || ''
        state.isDevBuild = Boolean(info.isDevBuild)
        state.canSelfReplace = Boolean(info.canSelfReplace)
      }
    } catch {
      // keep fallback metadata
    }
  }
  state.initialized = true
}

async function checkForUpdates({ silent = false } = {}) {
  if (state.checking || state.downloading) return null
  if (!state.initialized) {
    await initVersionInfo()
  }

  state.checking = true
  state.checkError = ''
  state.checkNotice = ''

  try {
    let result = null
    if (state.isDesktopApp) {
      result = await invokeStrict('check_app_update', {
        useMirror: state.prefs.useMirror,
        customRepo: null,
      })
    } else {
      const res = await fetch(`https://api.github.com/repos/${state.repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
      if (res.status === 404) {
        throw new Error(`仓库 ${state.repo} 尚未发布任何 Release（或尚未创建 GitHub 仓库）`)
      }
      if (!res.ok) {
        throw new Error(`GitHub API 返回状态码 ${res.status}`)
      }
      const data = await res.json()
      const tagName = data.tag_name || ''
      const latestVersion = tagName.replace(/^[vV]/, '')
      const assets = Array.isArray(data.assets) ? data.assets : []
      const exeAsset =
        assets.find((a) => /^(only[ _-]raiders\.exe)$/i.test(a.name || '')) ||
        assets.find((a) => String(a.name || '').toLowerCase().endsWith('.exe')) ||
        null

      result = {
        currentVersion: state.currentVersion,
        latestVersion,
        tagName,
        releaseName: data.name || tagName,
        releaseNotes: data.body || '',
        publishedAt: data.published_at || '',
        htmlUrl: data.html_url || `https://github.com/${state.repo}/releases`,
        hasUpdate: compareSimpleSemver(state.currentVersion, tagName),
        assetName: exeAsset?.name || null,
        assetSize: exeAsset?.size ?? null,
        downloadUrl: exeAsset?.browser_download_url || null,
        directDownloadUrl: exeAsset?.browser_download_url || null,
        repo: state.repo,
        mirrorUsed: false,
      }
    }

    state.release = result
    state.lastCheckedAt = Date.now()

    if (!result.hasUpdate) {
      state.checkNotice = `当前 v${state.currentVersion} 已是最新版本`
    } else if (!silent && state.prefs.ignoredVersion === result.latestVersion) {
      state.checkNotice = `发现新版本 v${result.latestVersion}（此前已选择跳过提醒）`
    }
    return result
  } catch (err) {
    const msg = err?.message || String(err)
    state.lastCheckedAt = Date.now()
    if (msg.includes('尚未发布任何 Release') || msg.includes('404')) {
      state.checkNotice = '仓库暂未发布在线 Release，首次推送源码并发布 v0.1.1+ Tag 后即可检测更新。'
      if (!silent) {
        state.checkError = ''
      }
    } else if (!silent) {
      state.checkError = msg
    }
    return null
  } finally {
    state.checking = false
  }
}

async function startUpdateInstall() {
  if (state.downloading) return
  const targetUrl = state.release?.directDownloadUrl || state.release?.downloadUrl
  if (!targetUrl) {
    state.checkError = '该 Release 未包含可安装的 .exe 文件，请点击「前往 Releases 页面」手动下载。'
    return
  }

  state.downloading = true
  state.checkError = ''
  state.checkNotice = ''
  state.progress = {
    stage: 'downloading',
    downloadedBytes: 0,
    totalBytes: state.release?.assetSize || 0,
    percent: 0,
    message: '正在准备下载新版本...',
    error: null,
  }

  startProgressPolling()
  try {
    await invokeStrict('download_and_install_update', {
      downloadUrl: targetUrl,
      expectedSize: state.release?.assetSize ?? null,
      useMirror: state.prefs.useMirror,
    })
    const latest = await invokeStrict('get_update_progress').catch(() => null)
    if (latest) state.progress = latest
  } catch (err) {
    const msg = err?.message || String(err)
    state.checkError = msg
    state.progress = {
      ...state.progress,
      stage: 'error',
      message: msg,
      error: msg,
    }
  } finally {
    stopProgressPolling()
    state.downloading = false
  }
}

async function openReleasePage() {
  const url = state.release?.htmlUrl || `https://github.com/${state.repo}/releases`
  if (state.isDesktopApp) {
    try {
      await invokeStrict('open_update_url', { url })
      return
    } catch (err) {
      state.checkError = err?.message || String(err)
      return
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function openExeDir() {
  if (!state.isDesktopApp) return
  try {
    await invokeStrict('open_exe_directory')
  } catch (err) {
    state.checkError = err?.message || String(err)
  }
}

function setAutoCheck(value) {
  state.prefs.autoCheck = Boolean(value)
  savePrefs(state.prefs)
}

function setUseMirror(value) {
  state.prefs.useMirror = Boolean(value)
  savePrefs(state.prefs)
}

function ignoreLatestVersion() {
  if (state.release?.latestVersion) {
    state.prefs.ignoredVersion = state.release.latestVersion
    savePrefs(state.prefs)
    state.modalOpen = false
  }
}

function clearIgnoredVersion() {
  state.prefs.ignoredVersion = ''
  savePrefs(state.prefs)
}

function openUpdateModal() {
  state.modalOpen = true
  if (!state.checking && !state.downloading && !state.lastCheckedAt) {
    checkForUpdates({ silent: false })
  }
}

function closeUpdateModal() {
  if (state.downloading) return
  state.modalOpen = false
}

async function runStartupAutoCheck() {
  if (bootChecked) return
  bootChecked = true
  await initVersionInfo()
  if (state.prefs.autoCheck) {
    setTimeout(() => {
      checkForUpdates({ silent: true })
    }, 1800)
  }
}

export function formatBytesMb(bytes) {
  const num = Number(bytes)
  if (!Number.isFinite(num) || num <= 0) return '未知大小'
  return `${(num / (1024 * 1024)).toFixed(1)} MB`
}

export function useAppUpdater() {
  const hasVisibleUpdate = computed(() => {
    const rel = state.release
    return Boolean(rel?.hasUpdate && rel.latestVersion !== state.prefs.ignoredVersion)
  })

  const hasAnyUpdate = computed(() => Boolean(state.release?.hasUpdate))

  return {
    state,
    hasVisibleUpdate,
    hasAnyUpdate,
    initVersionInfo,
    checkForUpdates,
    startUpdateInstall,
    openReleasePage,
    openExeDir,
    setAutoCheck,
    setUseMirror,
    ignoreLatestVersion,
    clearIgnoredVersion,
    openUpdateModal,
    closeUpdateModal,
    runStartupAutoCheck,
    formatBytesMb,
  }
}
