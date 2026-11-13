<script setup>
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { formatBytesMb, useAppUpdater } from '../../composables/useAppUpdater'

const {
  state,
  hasAnyUpdate,
  checkForUpdates,
  startUpdateInstall,
  openReleasePage,
  openExeDir,
  setAutoCheck,
  setUseMirror,
  ignoreLatestVersion,
  clearIgnoredVersion,
  closeUpdateModal,
} = useAppUpdater()

const isBusy = computed(() => state.checking || state.downloading)

const releaseTimeLabel = computed(() => {
  const raw = state.release?.publishedAt
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString('zh-CN', { hour12: false })
})

const progressLabel = computed(() => {
  if (!state.downloading && state.progress.stage === 'idle') return ''
  const p = state.progress
  if (p.downloadedBytes > 0 && p.totalBytes > 0) {
    return `${formatBytesMb(p.downloadedBytes)} / ${formatBytesMb(p.totalBytes)} (${p.percent}%)`
  }
  if (p.downloadedBytes > 0) {
    return `${formatBytesMb(p.downloadedBytes)}`
  }
  return p.message || ''
})

const canDirectInstall = computed(() => {
  return (
    state.isDesktopApp &&
    state.canSelfReplace &&
    Boolean(state.release?.downloadUrl || state.release?.directDownloadUrl) &&
    !state.downloading
  )
})

function onKeyDown(e) {
  if (e.key === 'Escape' && state.modalOpen) {
    closeUpdateModal()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.modalOpen"
      class="aum-backdrop"
      @click.self="closeUpdateModal"
    >
      <section class="aum-dialog" role="dialog" aria-modal="true" aria-label="检查更新">
        <header class="aum-header">
          <div class="aum-title-wrap">
            <span class="aum-badge">ONLY RAIDERS</span>
            <h2 class="aum-title">在线更新中心</h2>
          </div>
          <button
            type="button"
            class="aum-close"
            :disabled="state.downloading"
            title="关闭"
            @click="closeUpdateModal"
          >
            ✕
          </button>
        </header>

        <div class="aum-body">
          <div class="aum-meta-grid">
            <div class="aum-meta-card">
              <span class="aum-meta-label">当前版本</span>
              <strong class="aum-meta-val">v{{ state.currentVersion }}</strong>
            </div>
            <div class="aum-meta-card">
              <span class="aum-meta-label">远端最新版本</span>
              <strong
                class="aum-meta-val"
                :class="{ 'is-new': hasAnyUpdate }"
              >
                <template v-if="state.checking">检查中...</template>
                <template v-else-if="state.release?.latestVersion">
                  v{{ state.release.latestVersion }}
                </template>
                <template v-else>—</template>
              </strong>
            </div>
            <div class="aum-meta-card">
              <span class="aum-meta-label">更新源仓库</span>
              <button
                type="button"
                class="aum-repo-link"
                @click="openReleasePage"
              >
                {{ state.repo }}
              </button>
            </div>
          </div>

          <div class="aum-options">
            <label class="aum-toggle">
              <input
                type="checkbox"
                :checked="state.prefs.useMirror"
                :disabled="state.downloading"
                @change="setUseMirror($event.target.checked)"
              />
              <span>启用国内 GitHub 镜像加速（ghfast.top）</span>
            </label>
            <label class="aum-toggle">
              <input
                type="checkbox"
                :checked="state.prefs.autoCheck"
                :disabled="state.downloading"
                @change="setAutoCheck($event.target.checked)"
              />
              <span>启动时自动后台检查新版本</span>
            </label>
          </div>

          <div v-if="state.checkError" class="aum-alert is-error">
            {{ state.checkError }}
          </div>

          <div v-else-if="state.checkNotice" class="aum-alert is-info">
            {{ state.checkNotice }}
          </div>

          <div v-if="state.release" class="aum-release-box">
            <div class="aum-release-head">
              <div>
                <span class="aum-release-tag">{{ state.release.tagName || state.release.latestVersion }}</span>
                <span v-if="state.release.releaseName" class="aum-release-name">
                  {{ state.release.releaseName }}
                </span>
              </div>
              <span v-if="releaseTimeLabel" class="aum-release-time">
                {{ releaseTimeLabel }}
              </span>
            </div>

            <div class="aum-asset-row" v-if="state.release.assetName">
              <span>安装包：<code>{{ state.release.assetName }}</code></span>
              <span v-if="state.release.assetSize">{{ formatBytesMb(state.release.assetSize) }}</span>
            </div>

            <pre class="aum-release-notes">{{
              state.release.releaseNotes?.trim() || '暂无详细更新日志，可前往 GitHub Releases 查看完整提交说明。'
            }}</pre>
          </div>

          <div v-if="!state.isDesktopApp" class="aum-hint">
            当前为浏览器预览环境，仅支持版本检查与跳转下载页；打包为桌面端 <code>only raiders.exe</code> 后支持一键自动下载并替换重启。
          </div>
          <div v-else-if="state.isDevBuild" class="aum-hint">
            当前为开发调试模式（未锁定发布版可执行文件），可正常检查 Release；生产环境便携包支持原位替换自更新。
          </div>

          <div v-if="state.downloading || state.progress.stage === 'restarting'" class="aum-progress-box">
            <div class="aum-progress-top">
              <span>{{ state.progress.message || '正在下载更新...' }}</span>
              <span class="aum-progress-stat">{{ progressLabel }}</span>
            </div>
            <div class="aum-progress-track">
              <div
                class="aum-progress-fill"
                :style="{ width: `${Math.max(4, state.progress.percent || 0)}%` }"
              />
            </div>
          </div>
        </div>

        <footer class="aum-footer">
          <div class="aum-footer-left">
            <button
              type="button"
              class="aum-btn"
              :disabled="isBusy"
              @click="checkForUpdates({ silent: false })"
            >
              {{ state.checking ? '检查中...' : '立即检查更新' }}
            </button>
            <button
              v-if="state.isDesktopApp"
              type="button"
              class="aum-btn is-ghost"
              :disabled="state.downloading"
              @click="openExeDir"
            >
              程序目录
            </button>
            <button
              v-if="hasAnyUpdate && state.prefs.ignoredVersion !== state.release?.latestVersion"
              type="button"
              class="aum-btn is-ghost"
              :disabled="state.downloading"
              @click="ignoreLatestVersion"
            >
              跳过此版本
            </button>
            <button
              v-else-if="state.prefs.ignoredVersion"
              type="button"
              class="aum-btn is-ghost"
              :disabled="state.downloading"
              @click="clearIgnoredVersion"
            >
              恢复新版本提醒
            </button>
          </div>

          <div class="aum-footer-right">
            <button
              type="button"
              class="aum-btn"
              :disabled="state.downloading"
              @click="openReleasePage"
            >
              前往 Releases
            </button>
            <button
              v-if="hasAnyUpdate"
              type="button"
              class="aum-btn is-primary"
              :disabled="!canDirectInstall"
              @click="startUpdateInstall"
            >
              {{ state.downloading ? '更新下载中...' : '立即更新并重启' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.aum-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(5, 7, 14, 0.78);
  backdrop-filter: blur(6px);
}

.aum-dialog {
  width: min(640px, 100%);
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: var(--ui-secondary, #090c19);
  border: 1px solid rgba(255, 188, 19, 0.34);
  border-radius: 10px;
  box-shadow: 0 22px 60px rgba(0, 0, 0, 0.65);
  color: #f3efe6;
  overflow: hidden;
}

.aum-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 188, 19, 0.06);
}

.aum-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.aum-badge {
  padding: 2px 7px;
  border-radius: 4px;
  background: rgba(255, 188, 19, 0.16);
  border: 1px solid rgba(255, 188, 19, 0.4);
  color: var(--ui-complementary, #ffbc13);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.aum-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #f9f6ee;
}

.aum-close {
  width: 28px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: transparent;
  color: #c5c0b5;
  cursor: pointer;
}

.aum-close:hover:not(:disabled) {
  color: #fff;
  border-color: rgba(255, 188, 19, 0.5);
}

.aum-close:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.aum-body {
  padding: 16px 18px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.aum-meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.aum-meta-card {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.aum-meta-label {
  font-size: 11px;
  color: #a9a49a;
}

.aum-meta-val {
  font-size: 15px;
  font-weight: 700;
  color: #f3efe6;
}

.aum-meta-val.is-new {
  color: var(--ui-complementary, #ffbc13);
}

.aum-repo-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #7cc5ff;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  text-decoration: underline;
  word-break: break-all;
}

.aum-options {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
}

.aum-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #ded9ce;
  cursor: pointer;
}

.aum-toggle input {
  accent-color: var(--ui-complementary, #ffbc13);
}

.aum-alert {
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  line-height: 1.5;
}

.aum-alert.is-error {
  background: rgba(253, 75, 16, 0.14);
  border: 1px solid rgba(253, 75, 16, 0.45);
  color: #ffb8a2;
}

.aum-alert.is-info {
  background: rgba(88, 196, 128, 0.12);
  border: 1px solid rgba(88, 196, 128, 0.36);
  color: #b5f0c8;
}

.aum-release-box {
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aum-release-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.aum-release-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 188, 19, 0.18);
  color: var(--ui-complementary, #ffbc13);
  font-size: 12px;
  font-weight: 700;
  margin-right: 8px;
}

.aum-release-name {
  font-size: 13px;
  font-weight: 600;
  color: #f3efe6;
}

.aum-release-time {
  font-size: 11px;
  color: #9e998e;
}

.aum-asset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #b8b3a8;
}

.aum-asset-row code,
.aum-hint code {
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #f8dfa0;
}

.aum-release-notes {
  margin: 0;
  max-height: 180px;
  overflow-y: auto;
  padding: 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
  color: #d7d2c6;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.aum-hint {
  font-size: 12px;
  line-height: 1.5;
  color: #afa99e;
}

.aum-progress-box {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 188, 19, 0.08);
  border: 1px solid rgba(255, 188, 19, 0.3);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.aum-progress-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #f7e3b0;
}

.aum-progress-stat {
  font-variant-numeric: tabular-nums;
  color: var(--ui-complementary, #ffbc13);
}

.aum-progress-track {
  height: 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.aum-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #ffbc13, #fd4b10);
  transition: width 0.16s ease;
}

.aum-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.2);
}

.aum-footer-left,
.aum-footer-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.aum-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  color: #f3efe6;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}

.aum-btn:hover:not(:disabled) {
  border-color: rgba(255, 188, 19, 0.5);
  background: rgba(255, 188, 19, 0.12);
}

.aum-btn.is-ghost {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.1);
  color: #bdb8ad;
}

.aum-btn.is-primary {
  background: linear-gradient(135deg, #ffbc13, #fd4b10);
  border-color: transparent;
  color: #0b0d14;
  font-weight: 700;
}

.aum-btn.is-primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.aum-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
