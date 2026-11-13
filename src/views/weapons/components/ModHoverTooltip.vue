<script setup>
import { inject } from 'vue'

const overlay = inject('weaponsOverlay')
const tone = inject('weaponsTone', (c) => c)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="overlay.tipView"
      :ref="(el) => (overlay.tipEl = el)"
      class="wm-tip"
      :style="{ left: `${overlay.tip.x}px`, top: `${overlay.tip.y}px`, '--g': tone(overlay.tipView.color) }"
    >
      <div class="tp-head">
        <img v-if="overlay.tipView.img" :src="overlay.tipView.img" alt="" />
        <div class="tp-title">
          <strong>{{ overlay.tipView.title }}</strong>
          <small v-if="overlay.tipView.sub">{{ overlay.tipView.sub }}</small>
        </div>
        <span v-if="overlay.tipView.badge" class="tp-badge">{{ overlay.tipView.badge }}</span>
      </div>

      <p v-if="overlay.tipView.desc" class="tp-desc">{{ overlay.tipView.desc }}</p>

      <ul v-if="overlay.tipView.effects.length" class="tp-fx">
        <li v-for="(e, i) in overlay.tipView.effects" :key="i" :class="e.tone">{{ e.text }}</li>
      </ul>

      <div v-if="overlay.tipView.meta?.length" class="tp-meta">
        <div v-for="(m, i) in overlay.tipView.meta" :key="i" class="tp-meta-row">
          <span>{{ m.label }}</span>
          <b>{{ m.val }}</b>
        </div>
      </div>

      <div v-for="g in overlay.tipView.groups || []" :key="g.name" class="tp-group">
        <h6>{{ g.name }}</h6>
        <ul class="tp-fx">
          <li v-for="(e, i) in g.effects" :key="i" :class="e.tone">{{ e.text }}</li>
        </ul>
      </div>

      <div v-if="overlay.tipView.rules?.length" class="tp-rules">
        <b v-for="(r, i) in overlay.tipView.rules" :key="i" :class="r.cls">{{ r.text }}</b>
      </div>

      <div v-if="overlay.tipView.warn" class="tp-warn">{{ overlay.tipView.warn }}</div>

      <div v-if="overlay.tipView.diffs" class="tp-diff">
        <h6>{{ overlay.tipView.diffTitle }}</h6>
        <div v-for="d in overlay.tipView.diffs" :key="d.label" class="tp-diff-row">
          <span>{{ d.label }}</span>
          <span>
            {{ d.from }} → <b :class="d.tone">{{ d.to }}</b>
          </span>
        </div>
        <div v-if="!overlay.tipView.diffs.length" class="tp-none">属性无变化</div>
      </div>

      <div v-if="overlay.tipView.foot.length" class="tp-foot">
        <span v-for="(f, i) in overlay.tipView.foot" :key="i">{{ f }}</span>
      </div>
    </div>
  </Teleport>
</template>
