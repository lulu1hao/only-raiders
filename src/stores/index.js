import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'

const DEBOUNCE_MS = 160
const lastCommittedByKey = new Map()
const pendingValueByKey = new Map()
const timerByKey = new Map()

function commitKeyNow(key) {
  const timer = timerByKey.get(key)
  if (timer) {
    clearTimeout(timer)
    timerByKey.delete(key)
  }
  if (!pendingValueByKey.has(key)) return
  const val = pendingValueByKey.get(key)
  pendingValueByKey.delete(key)
  if (typeof window === 'undefined') return
  if (lastCommittedByKey.get(key) === val) return
  try {
    window.localStorage.setItem(key, val)
    lastCommittedByKey.set(key, val)
  } catch {
    // Ignore storage quota errors
  }
}

export function flushPersistedStorage(targetKey = null) {
  if (targetKey) {
    commitKeyNow(targetKey)
    return
  }
  for (const key of [...pendingValueByKey.keys()]) {
    commitKeyNow(key)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && typeof e.newValue === 'string') {
      lastCommittedByKey.set(e.key, e.newValue)
    }
  })
  const flushAll = () => flushPersistedStorage()
  window.addEventListener('pagehide', flushAll)
  window.addEventListener('beforeunload', flushAll)
}

const debouncedLocalStorage = {
  getItem(key) {
    if (pendingValueByKey.has(key)) {
      return pendingValueByKey.get(key)
    }
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(key)
    if (raw !== null) {
      lastCommittedByKey.set(key, raw)
    }
    return raw
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return
    if (!pendingValueByKey.has(key) && lastCommittedByKey.get(key) === value) {
      return
    }
    pendingValueByKey.set(key, value)
    const prevTimer = timerByKey.get(key)
    if (prevTimer) clearTimeout(prevTimer)
    timerByKey.set(
      key,
      window.setTimeout(() => {
        commitKeyNow(key)
      }, DEBOUNCE_MS),
    )
  },
}

const pinia = createPinia()
pinia.use(
  createPersistedState({
    storage: debouncedLocalStorage,
  }),
)

export { pinia }
export default pinia
