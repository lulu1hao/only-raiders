<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useQuestsStore } from '../../../stores/useQuestsStore'
import { useWorkshopStore } from '../../../stores/useWorkshopStore'
import { useOutpostStore } from '../../../stores/useOutpostStore'
import { useBlueprintsStore } from '../../../stores/useBlueprintsStore'
import {
  loadSyncConfig,
  saveSyncConfig,
  applySyncPayloadToStores,
  buildLocalBackupPayload,
} from '../../../utils/arcTrackerSync'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

const questsStore = useQuestsStore()
const workshopStore = useWorkshopStore()
const outpostStore = useOutpostStore()
const blueprintsStore = useBlueprintsStore()

const cfg = loadSyncConfig()
const appKey = ref(cfg.appKey || '')
const userKey = ref(cfg.userKey || '')
const playerName = ref(cfg.playerName || '')
const showManualKey = ref(false)

const syncing = ref(false)
const statusMsg = ref('')
const statusTone = ref('ok')
const fileInputRef = ref(null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      statusMsg.value = ''
      const latest = loadSyncConfig()
      appKey.value = latest.appKey || ''
      userKey.value = latest.userKey || ''
      playerName.value = latest.playerName || ''
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

let pollTimer = null

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function handleOAuthResult(d) {
  stopPolling()
  syncing.value = false

  if (!d.ok) {
    statusTone.value = 'err'
    statusMsg.value = d.error || '授权失败'
    return
  }

  const summary = applySyncPayloadToStores(d, {
    questsStore,
    workshopStore,
    outpostStore,
    blueprintsStore,
  })

  if (d.accessToken) userKey.value = d.accessToken
  if (summary.playerName) playerName.value = summary.playerName

  saveSyncConfig({
    appKey: appKey.value.trim(),
    userKey: userKey.value.trim(),
    playerName: playerName.value,
    lastSyncedAt: Date.now(),
  })

  statusTone.value = 'ok'
  statusMsg.value = '同步完成'
}

function onOAuthMessage(e) {
  if (e?.origin && e.origin !== window.location.origin) return
  const d = e?.data
  if (!d || d.type !== 'ARC_TRACKER_OAUTH_RESULT') return
  handleOAuthResult(d)
}

onMounted(() => {
  window.addEventListener('message', onOAuthMessage)
})

onBeforeUnmount(() => {
  stopPolling()
  window.removeEventListener('message', onOAuthMessage)
})

async function startOneClickOAuth() {
  stopPolling()
  syncing.value = true
  statusTone.value = 'ok'
  statusMsg.value = '已在浏览器打开授权页...'

  const tauriInvoke =
    typeof window !== 'undefined' &&
    (window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke)

  try {
    if (typeof tauriInvoke === 'function') {
      const j = await tauriInvoke('start_arctracker_oauth')
      if (!j?.ok || !j?.state) {
        throw new Error(j?.error || '启动授权失败')
      }
      const state = j.state
      pollTimer = setInterval(async () => {
        try {
          const pj = await tauriInvoke('poll_arctracker_oauth', { oauthState: state })
          if (pj?.status === 'done' || pj?.status === 'expired') {
            handleOAuthResult(pj)
          }
        } catch {
          // continue polling
        }
      }, 1200)
      return
    }

    const res = await fetch('/api/arctracker-oauth/init')
    const j = await res.json()
    if (!res.ok || !j.ok || !j.state) {
      throw new Error(j.error || '启动授权失败')
    }

    const state = j.state
    pollTimer = setInterval(async () => {
      try {
        const pr = await fetch(`/api/arctracker-oauth/poll?state=${encodeURIComponent(state)}`)
        const pj = await pr.json()
        if (pj.status === 'done' || pj.status === 'expired') {
          handleOAuthResult(pj)
        }
      } catch {
        // continue polling
      }
    }, 1200)
  } catch (err) {
    syncing.value = false
    statusTone.value = 'err'
    statusMsg.value = typeof err === 'string' ? err : err.message || '启动授权失败'
  }
}

async function handleDirectSync() {
  const uk = userKey.value.trim()
  const ak = appKey.value.trim()
  if (!uk) {
    startOneClickOAuth()
    return
  }

  syncing.value = true
  statusMsg.value = ''
  saveSyncConfig({ appKey: ak, userKey: uk })

  try {
    let payload = null
    const tauriInvoke =
      typeof window !== 'undefined' &&
      (window.__TAURI_INTERNALS__?.invoke || window.__TAURI__?.core?.invoke)

    if (typeof tauriInvoke === 'function') {
      try {
        payload = await tauriInvoke('sync_arctracker_quests', {
          appKey: ak,
          userKey: uk,
        })
      } catch (ipcErr) {
        // Fallback to dev server middleware if available
        const res = await fetch('/api/arctracker-sync', {
          method: 'GET',
          headers: {
            'x-app-key': ak,
            'x-user-key': uk,
          },
        }).catch(() => null)
        if (res) {
          payload = await res.json().catch(() => null)
          if (!res.ok || !payload?.ok) {
            throw new Error(payload?.error || String(ipcErr))
          }
        } else {
          throw new Error(typeof ipcErr === 'string' ? ipcErr : ipcErr?.message || '同步失败')
        }
      }
    } else {
      const res = await fetch('/api/arctracker-sync', {
        method: 'GET',
        headers: {
          'x-app-key': ak,
          'x-user-key': uk,
        },
      })
      payload = await res.json()
      if (!res.ok || !payload.ok) {
        throw new Error(payload.error || `HTTP ${res.status}`)
      }
    }

    const summary = applySyncPayloadToStores(payload, {
      questsStore,
      workshopStore,
      outpostStore,
      blueprintsStore,
    })

    if (summary.playerName) playerName.value = summary.playerName
    saveSyncConfig({
      appKey: ak,
      userKey: uk,
      playerName: playerName.value,
      lastSyncedAt: Date.now(),
    })

    statusTone.value = 'ok'
    statusMsg.value = '同步完成'
  } catch (err) {
    statusTone.value = 'err'
    statusMsg.value = err.message || '同步失败'
  } finally {
    syncing.value = false
  }
}

function handleExportJson() {
  const data = buildLocalBackupPayload({
    questsStore,
    workshopStore,
    outpostStore,
    blueprintsStore,
  })
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `arc-progress-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  statusTone.value = 'ok'
  statusMsg.value = '已导出 JSON'
}

function triggerImportJson() {
  fileInputRef.value?.click()
}

async function onFileSelected(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    applySyncPayloadToStores(json, {
      questsStore,
      workshopStore,
      outpostStore,
      blueprintsStore,
    })
    statusTone.value = 'ok'
    statusMsg.value = '已导入进度'
  } catch {
    statusTone.value = 'err'
    statusMsg.value = 'JSON 格式无效'
  }
}
</script>

<template>
  <div v-if="modelValue" class="sync-backdrop" @click.self="close">
    <div class="sync-modal" role="dialog" aria-modal="true" aria-label="数据同步">
      <i class="ar-stripe"></i>

      <header class="sm-head">
        <h3 class="ar-title">数据同步</h3>
        <span v-if="playerName" class="sm-badge sm-badge--ok">{{ playerName }}</span>
        <span v-else class="sm-badge">ARC TRACKER</span>
        <button class="sm-close" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="sm-body">
        <dl class="rs-facts sm-facts">
          <div>
            <dt>任务</dt>
            <dd>
              {{ questsStore.completedQuestIds.length }}<small>/{{ questsStore.totalQuests }}</small>
            </dd>
          </div>
          <div>
            <dt>工坊</dt>
            <dd>
              {{ workshopStore.currentWorkshopLevels }}<small>/{{ workshopStore.totalWorkshopLevels }}</small>
            </dd>
          </div>
          <div>
            <dt>哨站工程</dt>
            <dd>
              {{ outpostStore.completedStageIds.length }}<small>/{{ outpostStore.totalStages }}</small>
            </dd>
          </div>
          <div>
            <dt>蓝图</dt>
            <dd>
              {{ blueprintsStore.validOwnedCount }}<small>/{{ blueprintsStore.allBlueprintsCount }}</small>
            </dd>
          </div>
        </dl>

        <div class="sm-actions">
          <button class="sm-sync-btn" :disabled="syncing" @click="handleDirectSync">
            <span>{{ syncing ? '同步中...' : userKey ? '立即同步' : '一键授权同步' }}</span>
          </button>
          <button
            v-if="userKey"
            type="button"
            class="sm-sub-btn"
            :disabled="syncing"
            @click="startOneClickOAuth"
          >
            重新授权
          </button>
          <button
            type="button"
            class="sm-sub-btn"
            :class="{ active: showManualKey }"
            @click="showManualKey = !showManualKey"
          >
            密钥
          </button>
        </div>

        <div v-if="showManualKey" class="sm-fields">
          <label class="sm-field">
            <span>TOKEN / USER KEY</span>
            <input
              v-model="userKey"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="arc_u1_..."
              @keydown.enter="handleDirectSync"
            />
          </label>
          <label class="sm-field">
            <span>APP KEY (可选)</span>
            <input
              v-model="appKey"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="arc_k1_..."
            />
          </label>
        </div>

        <footer class="sm-foot">
          <div class="sm-io-btns">
            <button type="button" class="sm-io-btn" @click="handleExportJson">导出 JSON</button>
            <button type="button" class="sm-io-btn" @click="triggerImportJson">导入 JSON</button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".json,application/json"
              hidden
              @change="onFileSelected"
            />
          </div>

          <span
            v-if="statusMsg"
            class="sm-status"
            :class="statusTone === 'err' ? 'is-err' : 'is-ok'"
          >
            {{ statusMsg }}
          </span>
        </footer>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sync-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(8, 9, 14, 0.82);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
  padding: 20px;
}

.sync-modal {
  width: 100%;
  max-width: 460px;
  background: var(--bg-panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.72);
}

.sm-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--line-strong);
}

.sm-head .ar-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--cream);
}

.sm-badge {
  height: 20px;
  padding: 0 7px;
  display: inline-flex;
  align-items: center;
  border-radius: 3px;
  background: var(--bg-2);
  border: 1px solid var(--line-strong);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--tx-2);
}

.sm-badge--ok {
  border-color: color-mix(in srgb, var(--amber) 60%, transparent);
  background: color-mix(in srgb, var(--amber) 16%, transparent);
  color: var(--amber);
}

.sm-close {
  margin-left: auto;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--tx-2);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.14s ease;
}

.sm-close:hover {
  border-color: var(--cream);
  color: var(--cream);
}

.sm-body {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.sm-facts {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.sm-actions {
  display: flex;
  gap: 8px;
}

.sm-sync-btn {
  flex: 1;
  height: 38px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--amber);
  color: var(--ink);
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: filter 0.15s ease, opacity 0.15s ease;
}

.sm-sync-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}

.sm-sync-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.sm-sub-btn {
  height: 38px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.14s ease;
}

.sm-sub-btn:hover,
.sm-sub-btn.active {
  border-color: var(--amber);
  color: var(--cream);
}

.sm-fields {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sm-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.sm-field span {
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--tx-3);
}

.sm-field input {
  height: 34px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-1);
  color: var(--tx-1);
  font-family: var(--font-mono);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.sm-field input:focus {
  border-color: var(--amber);
}

.sm-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.sm-io-btns {
  display: flex;
  gap: 8px;
}

.sm-io-btn {
  height: 28px;
  padding: 0 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--line-strong);
  background: var(--bg-2);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all 0.14s ease;
}

.sm-io-btn:hover {
  border-color: var(--cream);
  color: var(--cream);
}

.sm-status {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sm-status.is-ok {
  color: var(--st-ok, #34d399);
}

.sm-status.is-err {
  color: var(--st-danger, #fb7185);
}
</style>
