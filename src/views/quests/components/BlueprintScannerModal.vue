<script setup>
import { useBlueprintsStore } from '../../../stores/useBlueprintsStore'

const store = useBlueprintsStore()

const steps = ['导入截图', '比对槽位', '生成清单']
</script>

<template>
  <div
    v-if="store.showScreenshotScannerModal"
    class="scan-modal-backdrop"
    @click.self="store.showScreenshotScannerModal = false"
  >
    <div class="scan-modal" role="dialog" aria-modal="true" aria-label="截图识别蓝图">
      <i class="ar-stripe"></i>
      <header class="sm-head">
        <h3 class="ar-title">截图识别蓝图</h3>
        <span class="ar-chip ar-chip--accent">预留</span>
        <button
          class="sm-close"
          aria-label="关闭"
          @click="store.showScreenshotScannerModal = false"
        >
          ×
        </button>
      </header>

      <div class="sm-body">
        <div class="sm-dropzone">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 16V4m0 0l-4.5 4.5M12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <h4>拖入或 Ctrl + V 粘贴蓝图页截图</h4>
          <p class="ar-num">1080P · 1440P · 4K</p>
        </div>

        <ol class="sm-steps">
          <li v-for="(s, i) in steps" :key="s" class="sm-step">
            <span class="ar-num">{{ String(i + 1).padStart(2, '0') }}</span>
            <strong>{{ s }}</strong>
          </li>
        </ol>

        <div class="sm-foot">
          <span class="sm-note">识别暂未接入，可在卡片上手动标记</span>
          <button
            class="ar-btn ar-btn--sm"
            @click="
              store.bpOwnershipFilter = 'MISSING';
              store.showScreenshotScannerModal = false
            "
          >
            查看缺失 →
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scan-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(12, 6, 16, 0.84);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 90;
  padding: 20px;
}

.scan-modal {
  width: 100%;
  max-width: 600px;
  background: var(--bg-panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.sm-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 18px 12px;
  border-bottom: 2px solid var(--line-strong);
}

.sm-head .ar-title {
  font-size: 20px;
}

.sm-close {
  margin-left: auto;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  color: var(--tx-2);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}

.sm-close:hover {
  color: var(--tx-1);
  box-shadow: inset 0 0 0 1px var(--cream);
}

.sm-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sm-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 28px 20px;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius);
  background: var(--bg-1);
  text-align: center;
  color: var(--tx-3);
}

.sm-dropzone svg {
  width: 28px;
  height: 28px;
  color: var(--amber);
}

.sm-dropzone h4 {
  margin: 4px 0 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--tx-1);
}

.sm-dropzone p {
  margin: 0;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--tx-3);
}

.sm-steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.sm-step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-2);
  border-radius: var(--radius-sm);
}

.sm-step span {
  font-size: 16px;
  color: var(--amber);
}

.sm-step strong {
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-1);
}

.sm-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.sm-note {
  font-size: 12px;
  color: var(--tx-3);
}
</style>
