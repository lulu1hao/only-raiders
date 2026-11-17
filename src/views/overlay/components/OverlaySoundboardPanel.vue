<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { invokeSoundboard, useSoundboard } from '../../../composables/useSoundboard'
import {
  defaultSoundboardSettings,
  filterAudioTracks,
  folderName,
  formatAudioTime,
  shortcutKeyName,
  suggestAudioDevices,
  validateAudioDevices,
  validateShortcut,
} from '../../../utils/soundboardModel'

const {
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
} = useSoundboard()

const draft = reactive(defaultSoundboardSettings())
const levels = reactive({ musicVolume: 0.5, micVolume: 1, monitorVolume: 0.5 })

const query = ref('')
const favoritesOnly = ref(false)
const busy = ref(false)
const importing = ref(false)
const scanning = ref(false)
const downloadingCable = ref(false)

// Active collapsible sub-drawer: '' | 'mixer' | 'devices' | 'shortcuts' | 'guide'
const activeDrawer = ref('')

const libraryFeedback = reactive({ message: '', failed: false })
const cableFeedback = reactive({ message: '', failed: false })

// Track Editor Modal state
const editOpen = ref(false)
const editing = reactive({ id: '', name: '', favorite: false, shortcut: '', sourceFolder: null })
const editError = ref('')
const editBusy = ref(false)

// Seek state
const seeking = ref(false)
const seekPosition = ref(0)

// Inline Shortcut Recorder state (shared by global shortcuts & track shortcut editor)
const recordingTarget = ref('') // '' | 'toggleShortcut' | 'stopShortcut' | 'muteShortcut' | 'trackShortcut'
const recordingPreview = ref('')
const recordingHint = ref('')
let lastShortcutCommit = 0

const modifierCodes = [
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight',
  'MetaLeft',
  'MetaRight',
]

const globalShortcutFields = [
  { label: '播放 / 暂停', key: 'toggleShortcut', placeholder: 'Ctrl+Alt+P' },
  { label: '停止音乐', key: 'stopShortcut', placeholder: 'Ctrl+Alt+S' },
  { label: '麦克风静音', key: 'muteShortcut', placeholder: 'Ctrl+Alt+M' },
]

const trackShortcutBindings = computed(() =>
  state.tracks
    .filter((track) => track.shortcut)
    .map((track) => ({ id: track.id, label: track.name, value: track.shortcut })),
)

const shortcutConflicts = (selfLabel) => [
  ...globalShortcutFields
    .filter((field) => field.label !== selfLabel && draft[field.key])
    .map((field) => ({ label: field.label, value: draft[field.key] })),
  ...trackShortcutBindings.value,
]

const globalShortcutIssues = computed(() =>
  globalShortcutFields
    .map((field) => ({
      label: field.label,
      key: field.key,
      message: validateShortcut(draft[field.key], shortcutConflicts(field.label)),
    }))
    .filter((field) => field.message),
)

const editingConflicts = computed(() => [
  ...globalShortcutFields
    .filter((field) => draft[field.key])
    .map((field) => ({ label: field.label, value: draft[field.key] })),
  ...trackShortcutBindings.value.filter((binding) => binding.id !== editing.id),
])

const editingShortcutIssue = computed(() =>
  validateShortcut(editing.shortcut, editingConflicts.value),
)

const visibleTracks = computed(() =>
  filterAudioTracks(state.tracks, query.value, favoritesOnly.value),
)
const currentTrack = computed(() =>
  state.tracks.find((track) => track.id === state.status.trackId),
)
const hasCable = computed(() =>
  (state.devices.outputs || []).some((d) => /cable input/i.test(d.name)),
)
const modeText = computed(
  () => ['未连接', '本地试听', '游戏发送'][state.status.mode] || '未连接',
)
const physicalOutputs = computed(() => (state.devices.outputs || []).filter((d) => !d.virtualHint))
const physicalInputs = computed(() => (state.devices.inputs || []).filter((d) => !d.virtualHint))
const virtualOutputs = computed(() => (state.devices.outputs || []).filter((d) => d.virtualHint))

const settingsDirty = computed(() =>
  [
    'outputDevice',
    'micDevice',
    'monitorDevice',
    'micEnabled',
    'monitorEnabled',
    'toggleShortcut',
    'stopShortcut',
    'muteShortcut',
  ].some((key) => draft[key] !== state.settings[key]),
)

const connectionDetail = computed(() => {
  if (state.status.mode === 2) return state.settings.outputDevice || '虚拟音频发送已连接'
  if (state.status.mode === 1) return state.settings.monitorDevice || '本地耳机试听已连接'
  return '选择「试听」仅自己听；选「游戏发送」混入队友语音'
})

const meterWidth = (value) => `${Math.min(100, Math.max(0, (Number(value) || 0) * 100))}%`

const swallow = (promise) => promise.catch(() => {})

function toggleDrawer(name) {
  activeDrawer.value = activeDrawer.value === name ? '' : name
  stopRecording()
}

/* =====================================================================
   Shortcut Recording Handlers
   ===================================================================== */
function modifiersOf(event) {
  const mods = []
  if (event.ctrlKey) mods.push('Ctrl')
  if (event.altKey) mods.push('Alt')
  if (event.shiftKey) mods.push('Shift')
  if (event.metaKey) mods.push('Super')
  return mods
}

function startRecording(targetKey) {
  if (!state.desktop) return
  if (Date.now() - lastShortcutCommit < 350) return
  if (recordingTarget.value === targetKey) {
    stopRecording()
    return
  }
  recordingTarget.value = targetKey
  recordingPreview.value = ''
  recordingHint.value = '请按下组合键（Esc 取消，Delete 清除）'
}

function stopRecording() {
  recordingTarget.value = ''
  recordingPreview.value = ''
  recordingHint.value = ''
}

function commitRecordedShortcut(targetKey, val) {
  lastShortcutCommit = Date.now()
  if (targetKey === 'trackShortcut') {
    editing.shortcut = val
  } else if (targetKey in draft) {
    draft[targetKey] = val
  }
  stopRecording()
}

function onRecorderKeydown(targetKey, event) {
  if (recordingTarget.value !== targetKey) return
  event.preventDefault()
  event.stopPropagation()
  if (event.key === 'Escape') {
    stopRecording()
    return
  }
  if (event.code === 'Delete' || event.code === 'Backspace') {
    commitRecordedShortcut(targetKey, '')
    return
  }
  const mods = modifiersOf(event)
  if (modifierCodes.includes(event.code)) {
    recordingPreview.value = mods.join('+')
    recordingHint.value = '请再按一个主键（字母/数字/F1–F24/小键盘）'
    return
  }
  const key = shortcutKeyName(event.code)
  if (!key) {
    recordingPreview.value = mods.join('+')
    recordingHint.value = '该按键不支持作为全局热键，请换一个'
    return
  }
  if (!mods.length) {
    recordingPreview.value = key
    recordingHint.value = '至少需要按住 Ctrl、Alt 或 Shift 之一'
    return
  }
  commitRecordedShortcut(targetKey, [...mods, key].join('+'))
}

/* =====================================================================
   Lifecycle & Device / Library Operations
   ===================================================================== */
let stopPolling = null
onMounted(async () => {
  stopPolling = startPolling()
  try {
    await initialize()
    Object.assign(draft, suggestAudioDevices(state.settings, state.devices))
    for (const key of Object.keys(levels)) {
      levels[key] = state.settings[key]
    }
    if (!state.settings.outputDevice && !state.status.mode) {
      activeDrawer.value = 'devices'
    }
  } catch {
    activeDrawer.value = 'devices'
  }
})

onUnmounted(() => {
  stopPolling?.()
})

watch(
  () => state.ready,
  (ready) => {
    if (ready) void scanOnOpen()
  },
  { immediate: true },
)

async function scanOnOpen() {
  if (!state.desktop || !state.folders.length || scanning.value) return
  scanning.value = true
  try {
    const summary = await invokeSoundboard('soundboard_rescan')
    await refreshLibrary()
    if (summary.added || summary.removed) {
      libraryFeedback.failed = false
      libraryFeedback.message = `自动同步完成：新增 ${summary.added} 首，移除 ${summary.removed} 首`
    }
  } catch {
    // Ignore background auto-scan error
  } finally {
    scanning.value = false
  }
}

function shortcutBlocker() {
  const [first] = globalShortcutIssues.value
  if (!first) return ''
  activeDrawer.value = 'shortcuts'
  return `全局热键冲突：「${first.label}」${first.message}`
}

async function refreshDeviceList() {
  busy.value = true
  try {
    await run(refreshDevices)
    Object.assign(draft, suggestAudioDevices(draft, state.devices))
    state.notice = '音频设备列表已刷新'
  } catch {
    // Handled by run()
  } finally {
    busy.value = false
  }
}

async function saveSettings() {
  await configure({ ...state.settings, ...draft, ...levels })
  Object.assign(draft, state.settings)
}

async function saveDevices() {
  const blocked = shortcutBlocker()
  if (blocked) {
    state.error = blocked
    return
  }
  busy.value = true
  try {
    await saveSettings()
    state.notice = '设备设置已保存'
  } catch {
    // Handled by run()
  } finally {
    busy.value = false
  }
}

async function saveShortcuts() {
  const blocked = shortcutBlocker()
  if (blocked) {
    state.error = blocked
    return
  }
  busy.value = true
  try {
    await configure({
      ...state.settings,
      ...levels,
      toggleShortcut: draft.toggleShortcut,
      stopShortcut: draft.stopShortcut,
      muteShortcut: draft.muteShortcut,
    })
    state.notice = '全局热键已保存生效'
  } catch {
    // Handled by run()
  } finally {
    busy.value = false
  }
}

async function connect(mode) {
  const error = validateAudioDevices(draft, state.devices, mode)
  if (error) {
    state.error = error
    activeDrawer.value = 'devices'
    return
  }
  const blocked = shortcutBlocker()
  if (blocked) {
    state.error = blocked
    return
  }
  busy.value = true
  try {
    await saveSettings()
    await action(mode)
    activeDrawer.value = ''
    state.notice =
      mode === 'broadcast'
        ? '游戏发送已连接！请将游戏内麦克风设为 CABLE Output'
        : '本地试听已连接（仅在耳机播放）'
  } catch {
    // Handled by run()
  } finally {
    busy.value = false
  }
}

async function importTracks() {
  if (importing.value || !state.desktop) return
  importing.value = true
  Object.assign(libraryFeedback, { message: '', failed: false })
  try {
    const result = await run(() => invokeSoundboard('soundboard_import'))
    await refreshLibrary()
    if (result.added) {
      query.value = ''
      favoritesOnly.value = false
    }
    libraryFeedback.message = result.added
      ? `已导入 ${result.added} 首音频${result.skipped?.length ? `（跳过 ${result.skipped.length} 项）` : ''}`
      : result.skipped?.join('；') || ''
    libraryFeedback.failed = !result.added && Boolean(result.skipped?.length)
  } catch (error) {
    Object.assign(libraryFeedback, { message: `导入失败：${String(error)}`, failed: true })
  } finally {
    importing.value = false
  }
}

async function addFolders() {
  if (scanning.value || !state.desktop) return
  scanning.value = true
  Object.assign(libraryFeedback, { failed: false, message: '正在选择音乐文件夹…' })
  try {
    const summary = await run(() => invokeSoundboard('soundboard_add_folders'))
    await refreshLibrary()
    if (summary.cancelled) {
      Object.assign(libraryFeedback, { failed: false, message: '' })
      return
    }
    Object.assign(libraryFeedback, {
      failed: false,
      message: `已同步文件夹：共 ${summary.total} 首（新增 ${summary.added} 首）`,
    })
  } catch (error) {
    Object.assign(libraryFeedback, { failed: true, message: `添加文件夹失败：${String(error)}` })
  } finally {
    scanning.value = false
  }
}

async function rescanLibrary() {
  if (scanning.value || !state.desktop) return
  scanning.value = true
  try {
    const summary = await run(() => invokeSoundboard('soundboard_rescan'))
    await refreshLibrary()
    Object.assign(libraryFeedback, {
      failed: false,
      message: `扫描完成：共 ${summary.total} 首（新增 ${summary.added}，移除 ${summary.removed}）`,
    })
  } catch (error) {
    Object.assign(libraryFeedback, { failed: true, message: `扫描失败：${String(error)}` })
  } finally {
    scanning.value = false
  }
}

async function removeFolder(folder) {
  if (scanning.value || !state.desktop) return
  scanning.value = true
  try {
    const summary = await run(() => invokeSoundboard('soundboard_remove_folder', { path: folder }))
    await refreshLibrary()
    Object.assign(libraryFeedback, {
      failed: false,
      message: `已移除文件夹 ${folderName(folder)}（移除 ${summary.removed} 首记录）`,
    })
  } catch (error) {
    Object.assign(libraryFeedback, { failed: true, message: `移除失败：${String(error)}` })
  } finally {
    scanning.value = false
  }
}

async function unhideAll() {
  if (scanning.value || !state.desktop) return
  scanning.value = true
  try {
    const summary = await run(() => invokeSoundboard('soundboard_unhide_all'))
    await refreshLibrary()
    Object.assign(libraryFeedback, {
      failed: false,
      message: `已恢复隐藏音频：+${summary.added} 首`,
    })
  } catch (error) {
    Object.assign(libraryFeedback, { failed: true, message: `恢复失败：${String(error)}` })
  } finally {
    scanning.value = false
  }
}

function openFolder(folder) {
  swallow(run(() => invokeSoundboard('soundboard_open_folder', { path: folder })))
}

async function downloadCable() {
  if (downloadingCable.value || !state.desktop) return
  downloadingCable.value = true
  Object.assign(cableFeedback, { failed: false, message: '正在下载 VB-CABLE 虚拟声卡驱动包…' })
  try {
    const result = await run(() => invokeSoundboard('soundboard_download_cable'))
    const where = result.extracted ? `已解压至 ${result.folder}` : `已保存至 ${result.path}`
    Object.assign(cableFeedback, {
      failed: false,
      message: `${result.reused ? '已定位已有安装包，' : '下载成功，'}${where}。请右键 VBCABLE_Setup_x64.exe「以管理员身份运行」，安装后重启电脑。`,
    })
  } catch (error) {
    Object.assign(cableFeedback, {
      failed: true,
      message: `下载失败：${String(error)}（请点击「官方下载页」手动下载）`,
    })
  } finally {
    downloadingCable.value = false
  }
}

function openHelp(destination) {
  swallow(run(() => invokeSoundboard('soundboard_open_help', { destination })))
}

async function playTrack(track) {
  if (!state.status.mode) {
    state.error = '请先点击上方「试听」或「游戏发送」连接音频通道'
    activeDrawer.value = 'devices'
    return
  }
  await swallow(action('play', track.id))
}

async function togglePlay() {
  if (!state.status.mode) {
    state.error = '请先点击上方「试听」或「游戏发送」连接音频通道'
    activeDrawer.value = 'devices'
    return
  }
  if (!currentTrack.value) {
    if (visibleTracks.value.length > 0) {
      await playTrack(visibleTracks.value[0])
    } else {
      state.error = '请先导入或选择一首音频'
    }
    return
  }
  await swallow(action('toggle'))
}

function liveLevels() {
  if (!state.desktop) return
  swallow(
    run(() =>
      invokeSoundboard('soundboard_levels', {
        music: levels.musicVolume,
        mic: levels.micVolume,
        monitor: levels.monitorVolume,
      }),
    ),
  )
}

async function saveLevels() {
  try {
    await configure({ ...state.settings, ...levels })
  } catch {
    // Ignore
  }
}

async function toggleLoop() {
  try {
    await configure({ ...state.settings, ...levels, looping: !state.settings.looping })
    draft.looping = state.settings.looping
  } catch {
    // Ignore
  }
}

async function toggleFavorite(track) {
  try {
    await run(() =>
      invokeSoundboard('soundboard_update_track', {
        id: track.id,
        name: track.name,
        favorite: !track.favorite,
        shortcut: track.shortcut,
      }),
    )
    await refreshLibrary()
  } catch {
    // Ignore
  }
}

async function openTrackEditor(track, autoRecordShortcut = false) {
  Object.assign(editing, {
    id: track.id,
    name: track.name,
    favorite: Boolean(track.favorite),
    shortcut: track.shortcut || '',
    sourceFolder: track.sourceFolder || null,
  })
  editError.value = ''
  editOpen.value = true
  await nextTick()
  if (autoRecordShortcut) {
    startRecording('trackShortcut')
  }
}

function closeTrackEditor() {
  stopRecording()
  editOpen.value = false
}

async function saveTrackEdit() {
  if (editingShortcutIssue.value) {
    editError.value = editingShortcutIssue.value
    return
  }
  editBusy.value = true
  try {
    await invokeSoundboard('soundboard_update_track', {
      id: editing.id,
      name: editing.name,
      favorite: editing.favorite,
      shortcut: editing.shortcut,
    })
    await refreshLibrary()
    await refreshStatus(true)
    closeTrackEditor()
  } catch (error) {
    editError.value = String(error)
  } finally {
    editBusy.value = false
  }
}

async function removeEditingTrack() {
  editBusy.value = true
  try {
    await invokeSoundboard('soundboard_remove_track', { id: editing.id })
    await refreshLibrary()
    closeTrackEditor()
  } catch (error) {
    editError.value = String(error)
  } finally {
    editBusy.value = false
  }
}

async function onSeekChange(event) {
  try {
    await action('seek', null, Number(event.target.value))
  } catch {
    // Ignore
  } finally {
    seeking.value = false
  }
}

function isMissing(list, id) {
  return Boolean(id && !(list || []).some((d) => d.id === id))
}
</script>

<template>
  <div class="osb-shell">
    <!-- =================================================================
         1. TOP AUDIO CHANNEL BAR + SUB-DRAWER TABS
         ================================================================= -->
    <div class="osb-header-card">
      <div class="osb-channel-row">
        <div class="osb-status-info" :title="connectionDetail">
          <span
            class="osb-status-dot"
            :class="{
              preview: state.status.mode === 1,
              broadcast: state.status.mode === 2,
            }"
          ></span>
          <div class="osb-status-text">
            <strong>{{ modeText }}</strong>
            <small>{{ connectionDetail }}</small>
          </div>
        </div>

        <div class="osb-conn-btns">
          <button
            v-if="state.status.mode"
            type="button"
            class="osb-btn danger"
            :disabled="busy"
            @click="swallow(action('disconnect'))"
          >
            断开
          </button>
          <template v-else>
            <button
              type="button"
              class="osb-btn"
              :disabled="!state.desktop || busy || !state.ready"
              title="仅在自己的耳机或扬声器试听，无需安装虚拟声卡"
              @click="connect('preview')"
            >
              试听
            </button>
            <button
              type="button"
              class="osb-btn primary"
              :disabled="!state.desktop || busy || !state.ready"
              title="将音乐与麦克风混音后通过虚拟声卡发送至游戏语音"
              @click="connect('broadcast')"
            >
              {{ busy ? '连接中' : '游戏发送' }}
            </button>
          </template>
        </div>
      </div>

      <!-- 4 Sub-Drawer Toggles -->
      <div class="osb-subnav">
        <button
          type="button"
          class="osb-subtab"
          :class="{ active: activeDrawer === 'mixer' }"
          @click="toggleDrawer('mixer')"
        >
          <span>实时调音</span>
        </button>
        <button
          type="button"
          class="osb-subtab"
          :class="{ active: activeDrawer === 'devices' }"
          @click="toggleDrawer('devices')"
        >
          <span>音频设备</span>
          <i v-if="settingsDirty" class="osb-dirty-dot" title="有未保存更改"></i>
        </button>
        <button
          type="button"
          class="osb-subtab"
          :class="{ active: activeDrawer === 'shortcuts' }"
          @click="toggleDrawer('shortcuts')"
        >
          <span>放歌热键</span>
        </button>
        <button
          type="button"
          class="osb-subtab"
          :class="{ active: activeDrawer === 'guide' }"
          @click="toggleDrawer('guide')"
        >
          <span>声卡指南</span>
        </button>
      </div>
    </div>

    <!-- =================================================================
         ALERTS & NOTICES
         ================================================================= -->
    <div v-if="state.startupError" class="osb-alert warn">
      <span>{{ state.startupError }}</span>
      <button type="button" class="osb-mini-btn" :disabled="state.starting" @click="retryStartup">
        重试
      </button>
    </div>

    <div v-if="state.error || state.status.error || state.pollError" class="osb-alert error">
      <span>{{ state.error || state.status.error || state.pollError }}</span>
      <button
        type="button"
        class="osb-mini-btn"
        @click="state.error = ''; swallow(action('clear_error'))"
      >
        ✕
      </button>
    </div>

    <div v-if="state.notice" class="osb-alert info">
      <span>{{ state.notice }}</span>
      <button type="button" class="osb-mini-btn" @click="state.notice = ''">✕</button>
    </div>

    <!-- =================================================================
         2. COLLAPSIBLE DRAWERS (调音 / 设备 / 热键 / 指南)
         ================================================================= -->
    <!-- DRAWER A: 实时调音 (Live 3-Channel Mixer) -->
    <section v-if="activeDrawer === 'mixer'" class="osb-drawer">
      <div class="osb-mix-row">
        <span class="osb-mix-lbl">音乐发送</span>
        <input
          v-model.number="levels.musicVolume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="osb-slider"
          @input="liveLevels"
          @change="saveLevels"
        />
        <strong class="ar-num osb-mix-val">{{ Math.round(levels.musicVolume * 100) }}%</strong>
      </div>
      <div class="osb-meter"><span :style="{ width: meterWidth(state.status.musicPeak) }"></span></div>

      <div class="osb-mix-row">
        <span class="osb-mix-lbl">麦克风</span>
        <input
          v-model.number="levels.micVolume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="osb-slider"
          @input="liveLevels"
          @change="saveLevels"
        />
        <strong class="ar-num osb-mix-val">{{ Math.round(levels.micVolume * 100) }}%</strong>
        <button
          type="button"
          class="osb-mini-btn"
          :class="{ active: state.status.micMuted }"
          :disabled="!state.settings.micEnabled || state.status.mode !== 2"
          @click="swallow(action('mute'))"
        >
          {{ state.status.micMuted ? '已静音' : '静音' }}
        </button>
      </div>
      <div class="osb-meter cyan"><span :style="{ width: meterWidth(state.status.micPeak) }"></span></div>

      <div class="osb-mix-row">
        <span class="osb-mix-lbl">耳机试听</span>
        <input
          v-model.number="levels.monitorVolume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          class="osb-slider"
          @input="liveLevels"
          @change="saveLevels"
        />
        <strong class="ar-num osb-mix-val">{{ Math.round(levels.monitorVolume * 100) }}%</strong>
      </div>
      <div class="osb-meter" :class="{ hot: state.status.outputPeak > 0.9 }">
        <span :style="{ width: meterWidth(state.status.outputPeak) }"></span>
      </div>
    </section>

    <!-- DRAWER B: 音频设备配置 (Audio Devices) -->
    <section v-if="activeDrawer === 'devices'" class="osb-drawer">
      <div class="osb-field">
        <label>发送设备（游戏内选对应 CABLE Output）</label>
        <select v-model="draft.outputDevice" class="osb-select">
          <option value="">请选择虚拟声卡（如 CABLE Input）</option>
          <option v-if="isMissing(virtualOutputs, draft.outputDevice)" :value="draft.outputDevice">
            {{ draft.outputDevice }}（已离线）
          </option>
          <option v-for="d in virtualOutputs" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>

      <div class="osb-field">
        <div class="osb-field-head">
          <label>真实麦克风（与音乐混音发送）</label>
          <label class="osb-check">
            <input v-model="draft.micEnabled" type="checkbox" />
            <span>接入麦克风</span>
          </label>
        </div>
        <select v-model="draft.micDevice" class="osb-select">
          <option value="">请选择真实麦克风</option>
          <option v-if="isMissing(physicalInputs, draft.micDevice)" :value="draft.micDevice">
            {{ draft.micDevice }}（已离线）
          </option>
          <option v-for="d in physicalInputs" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>

      <div class="osb-field">
        <div class="osb-field-head">
          <label>监听耳机（自己听到的设备）</label>
          <label class="osb-check">
            <input v-model="draft.monitorEnabled" type="checkbox" />
            <span>发送时同步监听</span>
          </label>
        </div>
        <select v-model="draft.monitorDevice" class="osb-select">
          <option value="">请选择耳机或扬声器</option>
          <option v-if="isMissing(physicalOutputs, draft.monitorDevice)" :value="draft.monitorDevice">
            {{ draft.monitorDevice }}（已离线）
          </option>
          <option v-for="d in physicalOutputs" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </div>

      <div class="osb-drawer-foot">
        <span class="osb-cable-tag" :class="{ ok: hasCable }">
          {{ hasCable ? '✓ 已检测到虚拟声卡' : '未检测到虚拟声卡' }}
        </span>
        <div class="osb-foot-actions">
          <button
            v-if="!hasCable"
            type="button"
            class="osb-btn"
            :disabled="downloadingCable"
            @click="downloadCable"
          >
            {{ downloadingCable ? '下载中…' : '下载声卡' }}
          </button>
          <button type="button" class="osb-btn" :disabled="busy" @click="refreshDeviceList">
            刷新
          </button>
          <button type="button" class="osb-btn primary" :disabled="busy" @click="saveDevices">
            保存设置
          </button>
        </div>
      </div>
    </section>

    <!-- DRAWER C: 放歌全局热键 (Global Shortcuts) -->
    <section v-if="activeDrawer === 'shortcuts'" class="osb-drawer">
      <div
        v-for="field in globalShortcutFields"
        :key="field.key"
        class="osb-hk-item"
      >
        <span class="osb-hk-label">{{ field.label }}</span>
        <button
          type="button"
          class="osb-recorder-btn"
          :class="{ recording: recordingTarget === field.key }"
          @click="startRecording(field.key)"
          @keydown="onRecorderKeydown(field.key, $event)"
          @blur="stopRecording"
        >
          {{
            recordingTarget === field.key
              ? recordingPreview || '按下组合键…'
              : draft[field.key] || '未设置（点击录制）'
          }}
        </button>
      </div>

      <p v-if="recordingTarget && recordingTarget !== 'trackShortcut'" class="osb-hk-hint">
        {{ recordingHint }}
      </p>
      <p
        v-for="issue in globalShortcutIssues"
        :key="issue.key"
        class="osb-hk-hint bad"
      >
        「{{ issue.label }}」{{ issue.message }}
      </p>

      <div class="osb-drawer-foot">
        <span class="osb-cable-tag">点击按钮后按组合键录制，Delete 清除</span>
        <button
          type="button"
          class="osb-btn primary"
          :disabled="busy || globalShortcutIssues.length > 0"
          @click="saveShortcuts"
        >
          保存热键
        </button>
      </div>
    </section>

    <!-- DRAWER D: 声卡指南与一键下载 (VB-CABLE Setup Guide) -->
    <section v-if="activeDrawer === 'guide'" class="osb-drawer osb-guide-drawer">
      <div class="osb-guide-step">
        <strong>01 安装虚拟声卡</strong>
        <p>局内放歌需通过虚拟声卡将音乐送入游戏麦克风。点击下方一键下载并右键管理员安装后重启电脑。</p>
        <div class="osb-foot-actions">
          <button
            type="button"
            class="osb-btn primary"
            :disabled="downloadingCable"
            @click="downloadCable"
          >
            {{ downloadingCable ? '正在下载…' : '一键下载 VB-CABLE' }}
          </button>
          <button type="button" class="osb-btn" @click="openHelp('driver')">官方下载页 ↗</button>
        </div>
      </div>

      <p v-if="cableFeedback.message" class="osb-hk-hint" :class="{ bad: cableFeedback.failed }">
        {{ cableFeedback.message }}
        <button
          v-if="!cableFeedback.failed"
          type="button"
          class="osb-inline-link"
          @click="openHelp('cable_folder')"
        >
          打开安装包目录
        </button>
      </p>

      <div class="osb-guide-step">
        <strong>02 配置设备与游戏语音</strong>
        <p>在「音频设备」中将发送设备设为 CABLE Input，勾选「接入麦克风」，并将游戏内语音输入设为 CABLE Output。</p>
        <div class="osb-foot-actions">
          <button type="button" class="osb-btn" @click="activeDrawer = 'devices'">去选设备</button>
          <button type="button" class="osb-btn" @click="openHelp('sound')">
            Windows 声音设置 ↗
          </button>
        </div>
      </div>
    </section>

    <!-- =================================================================
         3. AUDIO LIBRARY & TRACK LIST (Scrollable Main Area)
         ================================================================= -->
    <div class="osb-library-card">
      <!-- Library Toolbar -->
      <div class="osb-lib-toolbar">
        <div class="osb-search-box">
          <input
            v-model="query"
            type="text"
            class="ar-input osb-search-input"
            placeholder="搜索音乐或音效…"
          />
          <button v-if="query" type="button" class="osb-clear-q" @click="query = ''">✕</button>
        </div>

        <button
          type="button"
          class="osb-btn"
          :class="{ active: favoritesOnly }"
          title="仅看收藏音效"
          @click="favoritesOnly = !favoritesOnly"
        >
          ★ 收藏
        </button>

        <button
          type="button"
          class="osb-btn"
          :disabled="!state.desktop || scanning"
          title="添加音乐库文件夹（自动扫描文件夹内音频）"
          @click="addFolders"
        >
          +文件夹
        </button>

        <button
          v-if="state.folders.length"
          type="button"
          class="osb-btn"
          :disabled="!state.desktop || scanning"
          title="重新扫描音乐文件夹"
          @click="rescanLibrary"
        >
          扫描
        </button>

        <button
          type="button"
          class="osb-btn primary"
          :disabled="!state.desktop || importing"
          title="导入单个或多个音频文件 (MP3 / WAV / FLAC)"
          @click="importTracks"
        >
          +导入
        </button>
      </div>

      <!-- Watched Folders Strip -->
      <div v-if="state.folders.length" class="osb-folders-strip">
        <div v-for="folder in state.folders" :key="folder" class="osb-folder-chip">
          <span :title="folder" @click="openFolder(folder)">{{ folderName(folder) }}</span>
          <button type="button" title="移除文件夹" @click="removeFolder(folder)">✕</button>
        </div>
        <button
          v-if="state.hiddenCount"
          type="button"
          class="osb-unhide-btn"
          @click="unhideAll"
        >
          恢复隐藏 ({{ state.hiddenCount }})
        </button>
      </div>

      <p
        v-if="libraryFeedback.message"
        class="osb-lib-feedback"
        :class="{ bad: libraryFeedback.failed }"
      >
        {{ libraryFeedback.message }}
      </p>

      <!-- Track List -->
      <div v-if="!visibleTracks.length" class="osb-empty">
        <strong>{{ state.tracks.length ? '未找到匹配的音频' : '音效库暂无音乐' }}</strong>
        <p>支持 MP3 / WAV / FLAC · 点击右上角「+导入」或「+文件夹」添加音乐</p>
      </div>

      <div v-else class="osb-track-list">
        <div
          v-for="(track, idx) in visibleTracks"
          :key="track.id"
          class="osb-track-row"
          :class="{
            active: track.id === state.status.trackId,
            playing: track.id === state.status.trackId && state.status.playing,
          }"
          @dblclick="playTrack(track)"
        >
          <button
            type="button"
            class="osb-play-cell"
            :title="`从头播放 ${track.name}`"
            @click="playTrack(track)"
          >
            <span v-if="track.id === state.status.trackId && state.status.playing" class="osb-eq">
              <i></i><i></i><i></i>
            </span>
            <span v-else class="osb-idx ar-num">{{ String(idx + 1).padStart(2, '0') }}</span>
          </button>

          <div class="osb-track-main" @click="playTrack(track)">
            <strong class="osb-track-name" :title="track.name">{{ track.name }}</strong>
          </div>

          <button
            type="button"
            class="osb-hk-chip"
            :class="{ bound: Boolean(track.shortcut) }"
            :title="track.shortcut ? `快捷键 ${track.shortcut}（点击修改）` : '点击绑定播放快捷键'"
            @click.stop="openTrackEditor(track, true)"
          >
            {{ track.shortcut || '+键' }}
          </button>

          <button
            type="button"
            class="osb-fav-btn"
            :class="{ on: track.favorite }"
            title="收藏 / 取消收藏"
            @click.stop="toggleFavorite(track)"
          >
            ★
          </button>

          <button
            type="button"
            class="osb-edit-btn"
            title="编辑名称、快捷键或移除"
            @click.stop="openTrackEditor(track, false)"
          >
            编辑
          </button>
        </div>
      </div>
    </div>

    <!-- =================================================================
         4. PINNED BOTTOM NOW-PLAYING TRANSPORT BAR
         ================================================================= -->
    <footer class="osb-player-bar">
      <div class="osb-player-top">
        <div class="osb-transport-btns">
          <button
            type="button"
            class="osb-tp-btn"
            :disabled="!currentTrack && !state.status.loading"
            title="停止音乐（保留麦克风）"
            @click="swallow(action('stop'))"
          >
            ■
          </button>
          <button
            type="button"
            class="osb-tp-btn play"
            :disabled="!state.tracks.length || state.status.loading"
            :title="state.status.playing ? '暂停音乐' : '播放音乐'"
            @click="togglePlay"
          >
            {{ state.status.playing ? '⏸' : '▶' }}
          </button>
          <button
            type="button"
            class="osb-tp-btn"
            :class="{ active: state.settings.looping }"
            title="单曲循环开关"
            @click="toggleLoop"
          >
            ↻
          </button>
        </div>

        <div class="osb-now-info">
          <strong class="osb-now-title">
            {{ currentTrack?.name || '点击列表音乐即可播放' }}
          </strong>
          <span class="osb-now-time ar-num">
            {{ formatAudioTime(seeking ? seekPosition : state.status.position) }} /
            {{ formatAudioTime(state.status.duration) }}
          </span>
        </div>
      </div>

      <div class="osb-player-bottom">
        <input
          type="range"
          min="0"
          :max="state.status.duration || 1"
          step="0.1"
          :value="seeking ? seekPosition : state.status.position"
          :disabled="!state.status.duration || state.status.loading"
          class="osb-seek-slider"
          title="拖动调节播放进度"
          @input="seeking = true; seekPosition = Number($event.target.value)"
          @change="onSeekChange"
          @blur="seeking = false"
        />

        <div class="osb-quick-vol" title="实时音乐发送音量">
          <span>音量</span>
          <input
            v-model.number="levels.musicVolume"
            type="range"
            min="0"
            max="1"
            step="0.02"
            class="osb-vol-slider"
            @input="liveLevels"
            @change="saveLevels"
          />
          <strong class="ar-num">{{ Math.round(levels.musicVolume * 100) }}%</strong>
        </div>
      </div>
    </footer>

    <!-- =================================================================
         5. INLINE TRACK EDITOR OVERLAY MODAL
         ================================================================= -->
    <div v-if="editOpen" class="osb-modal-mask" @click.self="closeTrackEditor">
      <form class="osb-modal-card" @submit.prevent="saveTrackEdit">
        <div class="osb-modal-head">
          <strong>编辑音效与快捷键</strong>
          <button type="button" class="osb-mini-btn" @click="closeTrackEditor">✕</button>
        </div>

        <div class="osb-field">
          <label>音效名称</label>
          <input v-model="editing.name" type="text" maxlength="100" required class="ar-input" />
        </div>

        <div class="osb-field">
          <label>全局播放热键（游戏内直接按键触发）</label>
          <button
            type="button"
            class="osb-recorder-btn full"
            :class="{ recording: recordingTarget === 'trackShortcut' }"
            @click="startRecording('trackShortcut')"
            @keydown="onRecorderKeydown('trackShortcut', $event)"
            @blur="stopRecording"
          >
            {{
              recordingTarget === 'trackShortcut'
                ? recordingPreview || '请按下组合键（Delete 清除）…'
                : editing.shortcut || '点击此处后按下组合键（如 Ctrl+Alt+1）'
            }}
          </button>
          <small v-if="recordingTarget === 'trackShortcut'" class="osb-hk-hint">
            {{ recordingHint }}
          </small>
          <small v-else-if="editingShortcutIssue" class="osb-hk-hint bad">
            {{ editingShortcutIssue }}
          </small>
        </div>

        <label class="osb-check">
          <input v-model="editing.favorite" type="checkbox" />
          <span>加入收藏音效</span>
        </label>

        <p v-if="editError" class="osb-hk-hint bad">{{ editError }}</p>

        <div class="osb-modal-foot">
          <button
            type="button"
            class="osb-btn danger"
            :disabled="editBusy"
            @click="removeEditingTrack"
          >
            {{ editing.sourceFolder ? '从列表隐藏' : '移除音效' }}
          </button>
          <button
            type="submit"
            class="osb-btn primary"
            :disabled="editBusy || Boolean(editingShortcutIssue)"
          >
            {{ editBusy ? '保存中…' : '保存修改' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.osb-shell {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* =====================================================================
   1. TOP CHANNEL BAR & SUB-DRAWER NAV
   ===================================================================== */
.osb-header-card {
  flex-shrink: 0;
  background: var(--ov-bg-card);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.osb-channel-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.osb-status-info {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  flex: 1;
}

.osb-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #64748b;
  flex-shrink: 0;
}

.osb-status-dot.preview {
  background: #38bdf8;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.7);
}

.osb-status-dot.broadcast {
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.8);
}

.osb-status-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.osb-status-text strong {
  font-size: 12px;
  color: var(--cream);
  line-height: 1.2;
}

.osb-status-text small {
  font-size: 10.5px;
  color: var(--tx-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osb-conn-btns {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.osb-btn {
  height: 26px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(18, 24, 42, 0.88);
  color: var(--tx-1);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.14s;
}

.osb-btn:hover:not(:disabled),
.osb-btn.active {
  border-color: var(--amber);
  color: var(--amber);
}

.osb-btn.primary {
  background: rgba(255, 188, 19, 0.18);
  border-color: rgba(255, 188, 19, 0.65);
  color: var(--amber);
}

.osb-btn.primary:hover:not(:disabled) {
  background: var(--amber);
  color: #090c19;
  text-shadow: none;
}

.osb-btn.danger {
  border-color: rgba(244, 63, 94, 0.55);
  color: #fda4af;
}

.osb-btn.danger:hover:not(:disabled) {
  background: rgba(244, 63, 94, 0.2);
}

.osb-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.osb-subnav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
}

.osb-subtab {
  position: relative;
  height: 24px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: rgba(9, 12, 25, 0.65);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
}

.osb-subtab.active {
  background: var(--cream);
  color: var(--ink);
  border-color: var(--cream);
  text-shadow: none;
}

.osb-dirty-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--amber);
}

/* =====================================================================
   ALERTS & NOTICES
   ===================================================================== */
.osb-alert {
  flex-shrink: 0;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.osb-alert.error {
  background: rgba(127, 29, 29, 0.55);
  border: 1px solid rgba(248, 113, 113, 0.55);
  color: #fecaca;
}

.osb-alert.warn {
  background: rgba(120, 53, 15, 0.55);
  border: 1px solid rgba(251, 191, 36, 0.55);
  color: #fde68a;
}

.osb-alert.info {
  background: rgba(15, 62, 42, 0.55);
  border: 1px solid rgba(74, 222, 128, 0.5);
  color: #bbf7d0;
}

.osb-mini-btn {
  height: 20px;
  padding: 0 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(9, 12, 25, 0.7);
  color: var(--tx-1);
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  flex-shrink: 0;
}

.osb-mini-btn.active {
  background: var(--amber);
  color: #090c19;
  border-color: var(--amber);
  text-shadow: none;
}

/* =====================================================================
   2. COLLAPSIBLE DRAWERS
   ===================================================================== */
.osb-drawer {
  flex-shrink: 0;
  background: var(--ov-bg-card);
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  padding: 7px 9px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.osb-mix-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.osb-mix-lbl {
  width: 52px;
  font-size: 11px;
  color: var(--tx-2);
  flex-shrink: 0;
}

.osb-slider {
  flex: 1;
  accent-color: var(--amber);
  cursor: pointer;
}

.osb-mix-val {
  width: 34px;
  text-align: right;
  font-size: 11px;
  color: var(--amber);
  flex-shrink: 0;
}

.osb-meter {
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-top: -3px;
}

.osb-meter span {
  display: block;
  height: 100%;
  background: #4ade80;
  transition: width 0.08s linear;
}

.osb-meter.cyan span {
  background: #38bdf8;
}

.osb-meter.hot span {
  background: #f43f5e;
}

.osb-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.osb-field label {
  font-size: 11px;
  color: var(--tx-2);
}

.osb-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.osb-check {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--cream);
  cursor: pointer;
}

.osb-select {
  height: 26px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(11, 15, 28, 0.92);
  color: var(--cream);
  font-size: 11.5px;
  outline: none;
}

.osb-select option {
  background: #0d1222;
  color: var(--cream);
}

.osb-drawer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding-top: 2px;
}

.osb-cable-tag {
  font-size: 10.5px;
  color: var(--tx-2);
}

.osb-cable-tag.ok {
  color: #4ade80;
}

.osb-foot-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}

.osb-hk-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.osb-hk-label {
  font-size: 11.5px;
  color: var(--tx-1);
}

.osb-recorder-btn {
  height: 25px;
  min-width: 145px;
  padding: 0 8px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(9, 12, 25, 0.85);
  color: var(--amber);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.osb-recorder-btn.full {
  width: 100%;
  height: 28px;
}

.osb-recorder-btn.recording {
  border-color: #f43f5e;
  background: rgba(244, 63, 94, 0.18);
  color: #fecdd3;
}

.osb-hk-hint {
  margin: 0;
  font-size: 10.5px;
  color: var(--tx-2);
}

.osb-hk-hint.bad {
  color: #fca5a5;
}

.osb-guide-step {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.osb-guide-step strong {
  font-size: 11.5px;
  color: var(--amber);
}

.osb-guide-step p {
  margin: 0;
  font-size: 11px;
  color: var(--tx-2);
  line-height: 1.4;
}

.osb-inline-link {
  border: none;
  background: transparent;
  color: var(--amber);
  font-size: 10.5px;
  text-decoration: underline;
  cursor: pointer;
  padding: 0 4px;
}

/* =====================================================================
   3. AUDIO LIBRARY & TRACK LIST
   ===================================================================== */
.osb-library-card {
  flex: 1;
  min-height: 0;
  background: var(--ov-bg-card);
  border: 1px solid var(--line);
  border-radius: 5px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
}

.osb-lib-toolbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.osb-search-box {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}

.osb-search-input {
  width: 100%;
  height: 26px;
  padding: 0 22px 0 8px;
  font-size: 11.5px;
}

.osb-clear-q {
  position: absolute;
  right: 4px;
  border: none;
  background: transparent;
  color: var(--tx-2);
  font-size: 11px;
  cursor: pointer;
}

.osb-folders-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.osb-folder-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(18, 24, 42, 0.85);
  border: 1px solid var(--line);
  font-size: 10.5px;
  color: var(--tx-2);
}

.osb-folder-chip span {
  cursor: pointer;
}

.osb-folder-chip span:hover {
  color: var(--cream);
}

.osb-folder-chip button {
  border: none;
  background: transparent;
  color: var(--tx-3);
  font-size: 10px;
  cursor: pointer;
  padding: 0;
}

.osb-unhide-btn {
  border: 1px dashed var(--line-strong);
  background: transparent;
  color: var(--amber);
  font-size: 10px;
  border-radius: 3px;
  padding: 1px 5px;
  cursor: pointer;
}

.osb-lib-feedback {
  margin: 0;
  font-size: 10.5px;
  color: #86efac;
}

.osb-lib-feedback.bad {
  color: #fca5a5;
}

.osb-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 16px;
  color: var(--tx-2);
}

.osb-empty strong {
  font-size: 12.5px;
  color: var(--cream);
  margin-bottom: 4px;
}

.osb-empty p {
  margin: 0;
  font-size: 11px;
}

.osb-track-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-right: 2px;
}

.osb-track-row {
  height: 32px;
  padding: 0 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(11, 15, 28, 0.65);
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.12s;
}

.osb-track-row:hover {
  border-color: var(--line-strong);
  background: rgba(18, 25, 44, 0.85);
}

.osb-track-row.active {
  border-color: rgba(255, 188, 19, 0.55);
  background: rgba(255, 188, 19, 0.1);
}

.osb-play-cell {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--tx-2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.osb-track-row:hover .osb-play-cell,
.osb-track-row.active .osb-play-cell {
  color: var(--amber);
}

.osb-idx {
  font-size: 10.5px;
}

.osb-eq {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 11px;
}

.osb-eq i {
  width: 2px;
  height: 100%;
  background: #4ade80;
  animation: osbEqPulse 0.65s infinite ease-in-out alternate;
}

.osb-eq i:nth-child(2) {
  animation-delay: 0.2s;
}

.osb-eq i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes osbEqPulse {
  0% {
    height: 3px;
  }
  100% {
    height: 11px;
  }
}

.osb-track-main {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.osb-track-name {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--tx-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osb-track-row.active .osb-track-name {
  color: var(--amber);
}

.osb-hk-chip {
  height: 20px;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: rgba(9, 12, 25, 0.75);
  color: var(--tx-3);
  font-family: var(--font-mono);
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
}

.osb-hk-chip.bound {
  border-color: rgba(255, 188, 19, 0.45);
  color: var(--amber);
}

.osb-fav-btn {
  border: none;
  background: transparent;
  color: var(--tx-3);
  font-size: 13px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
}

.osb-fav-btn.on {
  color: var(--amber);
}

.osb-edit-btn {
  height: 20px;
  padding: 0 5px;
  border-radius: 3px;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--tx-2);
  font-size: 10px;
  cursor: pointer;
  flex-shrink: 0;
}

.osb-edit-btn:hover {
  border-color: var(--cream);
  color: var(--cream);
}

/* =====================================================================
   4. BOTTOM PINNED PLAYER BAR
   ===================================================================== */
.osb-player-bar {
  flex-shrink: 0;
  background: var(--ov-bg-bar);
  border: 1px solid var(--line-strong);
  border-radius: 5px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.osb-player-top {
  display: flex;
  align-items: center;
  gap: 8px;
}

.osb-transport-btns {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.osb-tp-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid var(--line-strong);
  background: rgba(18, 24, 42, 0.9);
  color: var(--tx-1);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.osb-tp-btn.play {
  width: 28px;
  background: var(--amber);
  border-color: var(--amber);
  color: #090c19;
  font-weight: 800;
  text-shadow: none;
}

.osb-tp-btn.active {
  border-color: var(--amber);
  color: var(--amber);
}

.osb-tp-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.osb-now-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.osb-now-title {
  font-size: 11.5px;
  color: var(--cream);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.osb-now-time {
  font-size: 10.5px;
  color: var(--tx-2);
  flex-shrink: 0;
}

.osb-player-bottom {
  display: flex;
  align-items: center;
  gap: 8px;
}

.osb-seek-slider {
  flex: 1;
  min-width: 80px;
  accent-color: var(--amber);
  cursor: pointer;
}

.osb-quick-vol {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: var(--tx-2);
  flex-shrink: 0;
}

.osb-vol-slider {
  width: 58px;
  accent-color: var(--amber);
  cursor: pointer;
}

.osb-quick-vol strong {
  width: 28px;
  text-align: right;
  color: var(--amber);
}

/* =====================================================================
   5. TRACK EDITOR MODAL
   ===================================================================== */
.osb-modal-mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(5, 8, 16, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.osb-modal-card {
  width: 100%;
  max-width: 340px;
  background: #121728;
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.85);
}

.osb-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--cream);
}

.osb-modal-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 4px;
}
</style>
