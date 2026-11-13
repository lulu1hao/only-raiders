const rawBase = import.meta.env?.BASE_URL || '/'
export const BASE_URL = rawBase === './' ? '/' : rawBase

export function assetUrl(relPath) {
  if (!relPath) return ''
  const str = String(relPath)
  if (
    str.startsWith('http://') ||
    str.startsWith('https://') ||
    str.startsWith('data:') ||
    str.startsWith('blob:')
  ) {
    return str
  }
  const norm = str.replace(/^\/+/, '').replace(/^outpost\//, 'items/')
  return `${BASE_URL}${norm}`
}
