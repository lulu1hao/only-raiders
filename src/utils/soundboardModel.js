export const defaultSoundboardSettings = () => ({
  outputDevice: '',
  micDevice: '',
  monitorDevice: '',
  micEnabled: false,
  monitorEnabled: false,
  musicVolume: 0.5,
  micVolume: 1,
  monitorVolume: 0.5,
  looping: false,
  toggleShortcut: 'Ctrl+Alt+P',
  stopShortcut: 'Ctrl+Alt+S',
  muteShortcut: 'Ctrl+Alt+M',
})

export function formatAudioTime(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export function filterAudioTracks(tracks, query, favoritesOnly) {
  const needle = (query || '').trim().toLocaleLowerCase()
  return (tracks || []).filter(
    (track) =>
      (!favoritesOnly || track.favorite) && track.name.toLocaleLowerCase().includes(needle),
  )
}

// Same grammar the backend accepts: modifiers first, exactly one main key last, no empty token.
const shortcutModifiers = ['ctrl', 'control', 'alt', 'shift', 'super', 'cmd', 'command', 'meta']
export function normalizeShortcut(value) {
  return (value || '')
    .split('+')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) =>
      token === 'control' ? 'ctrl' : ['command', 'cmd', 'meta'].includes(token) ? 'super' : token,
    )
    .join('+')
}

// Returns '' when the combination can be saved; mirrors the Rust checks so the UI can block it early.
export function validateShortcut(value, others = []) {
  const text = (value || '').trim()
  if (!text) return ''
  const tokens = text.split('+').map((token) => token.trim())
  if (tokens.some((token) => !token)) return '快捷键格式不正确，请用录制按钮重新设置'
  const normalized = normalizeShortcut(text)
  const conflict = others.find(
    (other) => other && other.value && normalizeShortcut(other.value) === normalized,
  )
  if (conflict) return `与「${conflict.label || '其他快捷键'}」重复，请换一个组合键`
  if (shortcutModifiers.includes(tokens[tokens.length - 1].toLowerCase()))
    return '还缺少一个主键，例如 Ctrl+Alt+1'
  const modifiers = tokens.slice(0, -1).map((token) => token.toLowerCase())
  if (modifiers.some((token) => !shortcutModifiers.includes(token)))
    return '修饰键要写在前面，例如 Ctrl+Alt+1'
  if (!modifiers.length) return '至少需要 Ctrl、Alt 或 Shift 中的一个修饰键'
  return ''
}

export const folderName = (path) => (path || '').split(/[\\/]/).filter(Boolean).pop() || path || ''

// event.code → the exact spelling the global-shortcut backend parses (global-hotkey parse_key).
const shortcutPunctuation = {
  Backquote: '`',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
}
const shortcutNamed = [
  'Enter',
  'Space',
  'Tab',
  'CapsLock',
  'End',
  'Home',
  'Insert',
  'PageUp',
  'PageDown',
  'PrintScreen',
  'ScrollLock',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'NumLock',
  'Pause',
  'NumpadAdd',
  'NumpadSubtract',
  'NumpadMultiply',
  'NumpadDivide',
  'NumpadDecimal',
  'NumpadEnter',
  'NumpadEqual',
  ...Array.from({ length: 10 }, (_, index) => `Numpad${index}`),
]
export function shortcutKeyName(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit[0-9]$/.test(code)) return code.slice(5)
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code
  if (shortcutPunctuation[code]) return shortcutPunctuation[code]
  return shortcutNamed.includes(code) ? code : ''
}

// Suggestions only fill unset choices. Never silently replace a saved, disconnected device.
export function suggestAudioDevices(settings, devices) {
  return {
    ...settings,
    outputDevice:
      settings.outputDevice ||
      (devices.outputs || []).find((d) => /cable input/i.test(d.name))?.id ||
      '',
    micDevice: settings.micDevice || (devices.inputs || []).find((d) => !d.virtualHint)?.id || '',
    monitorDevice:
      settings.monitorDevice || (devices.outputs || []).find((d) => !d.virtualHint)?.id || '',
  }
}

export function validateAudioDevices(settings, devices, mode) {
  const find = (list, id) => (list || []).find((device) => device.id === id)
  if (mode === 'broadcast' && !find(devices.outputs, settings.outputDevice)?.virtualHint)
    return '未检测到虚拟发送设备（如 CABLE Input）。请先点「指南 → 一键下载 VB-CABLE」安装虚拟声卡，或先使用「本地试听」。'
  if (mode === 'preview' || settings.monitorEnabled) {
    const device = find(devices.outputs, settings.monitorDevice)
    if (!device || device.virtualHint) return '请选择在线的真实耳机或扬声器作为试听设备。'
    if (mode === 'broadcast' && settings.monitorDevice === settings.outputDevice)
      return '发送设备和监听耳机不能相同。'
  }
  if (mode === 'broadcast' && settings.micEnabled) {
    const device = find(devices.inputs, settings.micDevice)
    if (!device || device.virtualHint) return '请选择在线的真实麦克风。'
  }
  return ''
}
