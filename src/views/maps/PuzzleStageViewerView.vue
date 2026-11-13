<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useThreePuzzleEngine, categoryMeta } from '../../composables/useThreePuzzleEngine'
import FloorSlicerBar from './components/FloorSlicerBar.vue'
import NodeDetailDrawer from './components/NodeDetailDrawer.vue'

const props = defineProps({
  stageKey: { type: String, default: 'refuge' },
})

const route = useRoute()
const router = useRouter()
const viewportRef = ref(null)

const {
  activeStageKey,
  mapCategories,
  selectedCategoryId,
  currentCategoryStages,
  currentPuzzle,
  isWalker,
  isFrigate,
  isRefuge,
  isFort,
  isBlueGate,
  loading,
  loadError,
  modelStats,
  activeNodeId,
  activeCircuitFilter,
  autoClipOnSelect,
  activeMaze,
  activeRoute,
  crusherAnimEnabled,
  crusherStateLabel,
  crusherClosurePct,
  activeRouteMeta,
  minClipZ,
  maxClipZ,
  clipZ,
  showRoof,
  showTerrain,
  xrayShell,
  showWalkways,
  showDoors,
  showCables,
  showMachinery,
  showCircuits,
  showRoomVolumes,
  wireframe,
  flyMode,
  hud,
  circuitTabs,
  filteredNodes,
  activeNode,
  activeConnections,
  switchStage,
  selectMapCategoryTab,
  selectNode,
  applyFloorPreset,
  setOverview,
  focusCrusherChamber,
} = useThreePuzzleEngine(
  viewportRef,
  () => route.params.stageKey || props.stageKey,
  (newStageKey) => {
    router.replace(`/maps/viewer/${newStageKey}`)
  }
)

// ---- template-local presentation helpers (no engine logic) ----
const legendOpen = ref(true)
const sidebarOpen = ref(true)

// Region accents follow the rainbow-cable tokens (same mapping as home / hub)
const regionAccent = {
  'blue-gate': 'var(--rb-green)',
  'stella-montis': 'var(--rb-cyan)',
  'dam-battlegrounds': 'var(--amber)',
}

const parentMapByStage = {
  stella: 'stella-montis',
  caz: 'dam-battlegrounds',
  refuge: 'blue-gate',
  fort: 'blue-gate',
  walker: 'pendola-pass',
  frigate: 'spaceport',
}

function goBackToMap() {
  const fromMap = route.query.fromMap || parentMapByStage[activeStageKey.value] || 'dam-battlegrounds'
  router.push(`/maps/${fromMap}`)
}

// "迷宫 1 (Maze 01)" -> "迷宫 1"
const stripParen = (s = '') => s.replace(/\s*[（(][^()（）]*[)）]\s*$/, '')

// "雪山 · 坠落帝王" -> "坠落帝王"
const shortStage = (t = '') => t.split(' · ').pop()

// "阶段一：底层中继" -> { num: '1', name: '底层中继' } ; "全部 (22)" -> { name: '全部', count: '22' }
const CN_NUM = { 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6' }
function fmtTab(label = '') {
  let name = label
  let num = ''
  let count = ''
  const cnt = name.match(/^(.*?)\s*\((\d+)\)$/)
  if (cnt) {
    name = cnt[1]
    count = cnt[2]
  }
  const stg = name.match(/^阶段([一二三四五六/]+)[：:]\s*(.*)$/)
  if (stg) {
    num = stg[1].replace(/[一二三四五六]/g, (c) => CN_NUM[c])
    name = stg[2]
  }
  return { num, name, count }
}

const fmtCode = (s = '') => s.replace(/_/g, ' ').toUpperCase()
const formattedCircuitTabs = computed(() =>
  circuitTabs.value.map((tab) => ({ ...tab, fmt: fmtTab(tab.label) })),
)
</script>

<template>
  <div class="layout" :class="{ 'sidebar-collapsed': !sidebarOpen }">
    <!-- Left tactical panel -->
    <aside v-show="sidebarOpen" class="sidebar">
      <!-- Region + stage navigation -->
      <nav class="sb-nav">
        <div class="region-row">
          <button class="back-btn" title="返回所属战区详细地图" @click="goBackToMap">
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M13 8H4M7.5 4l-4 4 4 4" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
          <div class="region-tabs">
            <button
              v-for="cat in mapCategories"
              :key="cat.id"
              :class="{ active: selectedCategoryId === cat.id }"
              :style="{ '--accent': regionAccent[cat.id] || cat.accent }"
              :title="`${cat.name} · ${cat.stages.length} 关卡`"
              @click="selectMapCategoryTab(cat)"
            >
              {{ cat.name.split(' ')[0] }}
            </button>
          </div>
          <button
            type="button"
            class="collapse-sb-btn"
            title="隐藏左侧控制栏"
            @click="sidebarOpen = false"
          >
            <span>隐藏</span>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M10 4L6 8l4 4" fill="none" stroke="currentColor" stroke-width="2" />
            </svg>
          </button>
        </div>

        <div class="ar-tabs stage-tabs">
          <button
            v-for="st in currentCategoryStages"
            :key="st.stageKey"
            class="ar-tab"
            :class="{ active: activeStageKey === st.stageKey }"
            :title="`${st.code} · ${st.title}`"
            @click="switchStage(st.stageKey)"
          >
            {{ shortStage(st.title) }}
          </button>
        </div>
      </nav>

      <!-- Stage title -->
      <header class="stage-head" :style="{ '--accent': regionAccent[selectedCategoryId] || 'var(--c-maps)' }">
        <h1 class="ar-title" :title="currentPuzzle.subtitle">{{ currentPuzzle.title }}</h1>
        <div class="stage-meta">
          <template v-if="!loading && modelStats.triangles">
            <span><b class="ar-num">{{ modelStats.layers }}</b> 图层</span>
            <span><b class="ar-num">{{ (modelStats.triangles / 1000).toFixed(1) }}k</b> 面</span>
          </template>
          <span><b class="ar-num">{{ currentPuzzle.nodes.length }}</b> 点位</span>
        </div>
      </header>

      <!-- Fallen Emperor: maze / route variants + crusher timer -->
      <section v-if="isWalker" class="sb-sec">
        <div class="sec-head"><span>迷宫</span></div>
        <div class="seg seg-4">
          <button
            v-for="mz in currentPuzzle.mazes"
            :key="mz.id"
            :class="{ active: activeMaze === mz.id }"
            :style="{ '--v-color': mz.color }"
            :title="`${mz.label} · ${mz.desc}`"
            @click="activeMaze = mz.id"
          >
            <i></i>{{ stripParen(mz.label) }}
          </button>
        </div>

        <div class="sec-head">
          <span>路线</span>
          <em v-if="activeRouteMeta"><b class="ar-num">{{ activeRouteMeta.openDoorCount }}</b> 门开启</em>
        </div>
        <div class="seg seg-3">
          <button
            v-for="rt in currentPuzzle.routes"
            :key="rt.id"
            :class="{ active: activeRoute === rt.id }"
            :style="{ '--v-color': rt.color || 'var(--c-maps)' }"
            :title="rt.desc"
            @click="activeRoute = rt.id"
          >
            <i></i>{{ rt.label.replace('路线 ', '') }}
          </button>
        </div>

        <div
          v-if="activeRouteMeta"
          class="route-card"
          :style="{ '--r-color': activeRouteMeta.color || 'var(--c-maps)' }"
        >
          <div class="rc-doors">{{ activeRouteMeta.openDoorsSummary }}</div>
          <div class="rc-desc">{{ activeRouteMeta.desc }}</div>
        </div>

        <div class="sec-head">
          <span>粉碎压机</span>
          <em class="ct-state" :class="{ danger: crusherClosurePct > 65 }">{{ crusherStateLabel }}</em>
        </div>
        <div class="ct-jaw-track" title="定位至中央粉碎压机室" @click="focusCrusherChamber">
          <div class="ct-jaw left" :style="{ width: `${14 + crusherClosurePct * 0.34}%` }"></div>
          <div class="ct-gap-label ar-num">{{ crusherClosurePct }}%</div>
          <div class="ct-jaw right" :style="{ width: `${14 + crusherClosurePct * 0.34}%` }"></div>
        </div>
        <div class="ct-actions">
          <button
            class="ar-btn ar-btn--ghost ar-btn--sm"
            :title="crusherAnimEnabled ? '暂停定时冲压' : '恢复定时冲压'"
            @click="crusherAnimEnabled = !crusherAnimEnabled"
          >
            {{ crusherAnimEnabled ? '暂停' : '恢复' }}
          </button>
          <button
            class="ar-btn ar-btn--ghost ar-btn--sm"
            title="定位压机室 (-8m)"
            @click="focusCrusherChamber"
          >
            定位压机
          </button>
        </div>
      </section>

      <!-- Floor height cutaway -->
      <FloorSlicerBar
        v-model:clipZ="clipZ"
        v-model:autoClipOnSelect="autoClipOnSelect"
        :min-clip-z="minClipZ"
        :max-clip-z="maxClipZ"
        :floors="currentPuzzle.floors"
        @apply-preset="applyFloorPreset"
      />

      <!-- Interactive nodes -->
      <section class="sb-sec nodes-section">
        <div class="sec-head">
          <span>点位</span>
          <em><b class="ar-num">{{ filteredNodes.length }}</b> / {{ currentPuzzle.nodes.length }}</em>
        </div>
        <div class="circuit-tabs">
          <button
            v-for="tab in formattedCircuitTabs"
            :key="tab.id"
            :class="{ active: activeCircuitFilter === tab.id }"
            :title="tab.label"
            @click="activeCircuitFilter = tab.id"
          >
            <b v-if="tab.fmt.num" class="ar-num">{{ tab.fmt.num }}</b>
            {{ tab.fmt.name }}
            <span v-if="tab.fmt.count" class="ar-count">{{ tab.fmt.count }}</span>
          </button>
        </div>

        <ul class="node-list">
          <li v-for="node in filteredNodes" :key="node.id">
            <button
              class="node-btn ar-row"
              :class="{ active: node.id === activeNodeId }"
              @click="selectNode(node, true)"
            >
              <span
                class="node-code"
                :style="{ '--nc': categoryMeta[node.category]?.color }"
              >
                {{ node.code }}
              </span>
              <div class="node-main">
                <div class="node-name">{{ node.title }}</div>
                <div class="node-sub">{{ node.floor }} · {{ node.requirement }}</div>
              </div>
            </button>
          </li>
        </ul>
      </section>
    </aside>

    <!-- Main 3D viewport -->
    <main class="stage">
      <div ref="viewportRef" class="viewport"></div>

      <!-- Reopen left sidebar button when collapsed -->
      <button
        v-if="!sidebarOpen"
        type="button"
        class="expand-sb-btn"
        title="展开左侧控制栏"
        @click="sidebarOpen = true"
      >
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        <span>展开面板</span>
      </button>

      <!-- Top-left legend -->
      <div class="legend-card" :class="{ collapsed: !legendOpen, 'shifted-down': !sidebarOpen }">
        <button class="legend-title" :title="legendOpen ? '收起图例' : '展开图例'" @click="legendOpen = !legendOpen">
          <span>图例</span>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path :d="legendOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'" fill="none" stroke="currentColor" stroke-width="2" />
          </svg>
        </button>
        <template v-if="legendOpen">
          <div v-if="isRefuge" class="legend-grid">
            <span><i style="background: #10b981"></i>按钮刷新点 (24处)</span>
            <span><i style="background: #38bdf8"></i>四联中继器 / 地窖铁门</span>
            <span><i style="background: #facc15"></i>地下室地窖物资区</span>
            <span><i style="background: #334b3c"></i>3D 地形地貌</span>
          </div>
          <div v-else-if="isFort" class="legend-grid">
            <span><i style="background: #10b981"></i>工业电池刷新点 (11处)</span>
            <span><i style="background: #38bdf8"></i>3座配电箱 / 中继器 / 地窖门</span>
            <span><i style="background: #facc15"></i>地下室地窖物资区</span>
            <span><i style="background: #334b3c"></i>3D 地形地貌</span>
          </div>
          <div v-else-if="isFrigate" class="legend-grid">
            <span><i style="background: #f43f5e"></i>32处弱点靶 (门/风扇/踏板)</span>
            <span><i style="background: #f59e0b"></i>26座旋转护盾环 / 战壕吊桥</span>
            <span><i style="background: #10b981"></i>11座动力核心 / 破译终端</span>
            <span><i style="background: #a3e635"></i>4台酸液毒雾排风扇</span>
            <span><i style="background: #38bdf8"></i>11扇隔舱门 / 34扇进度舱盖</span>
            <span><i style="background: #fb923c"></i>货舱顶底滑门 / 挂钩锁扣</span>
          </div>
          <div v-else-if="isWalker" class="legend-grid">
            <span><i style="background: #10b981"></i>本路线开启舱门 / 35处矩阵弱点</span>
            <span><i style="background: #732a30"></i>本路线锁死隔舱门 (不可开启)</span>
            <span><i style="background: #ea580c"></i>定时往复巨型粉碎压机 (左/右)</span>
            <span><i style="background: #f59e0b"></i>分拣迷宫墙 / 中央活塞升降机</span>
            <span><i style="background: #ef4444"></i>顶层高能激光束 / 护盾挡板</span>
            <span><i style="background: #facc15"></i>16座帝王核心战利品舱盖</span>
          </div>
          <div v-else class="legend-grid">
            <span><i style="background: #10b981"></i>供电箱 / 修复电柜</span>
            <span><i style="background: #22d3ee"></i>通电解谜门 (4扇)</span>
            <span><i style="background: #f472b6"></i>管制区钥匙卡门</span>
            <span><i style="background: #facc15"></i>高压电缆 / 密室区</span>
            <span><i style="background: #d97706"></i>金属走道 / 楼梯</span>
            <span><i style="background: #fb923c"></i>垂直爬梯 / 涵洞门</span>
          </div>
        </template>
      </div>

      <!-- Top-right layer & camera toolbar -->
      <div class="hud">
        <div class="hud-group">
          <label v-if="isBlueGate" :class="{ on: showTerrain }" title="地形地貌">
            <input v-model="showTerrain" type="checkbox" /><i></i>地形
          </label>
          <label
            :class="{ on: showRoof }"
            :title="
              isFrigate
                ? '护卫舰外装甲顶壳'
                : isWalker
                  ? '帝王外装甲壳'
                  : isRefuge
                    ? '教堂/钟楼屋顶'
                    : isFort
                      ? '要塞塔顶/胸墙'
                      : '屋顶格栅'
            "
          >
            <input v-model="showRoof" type="checkbox" /><i></i>
            {{ isFrigate || isWalker ? '外壳' : isFort ? '塔顶' : '屋顶' }}
          </label>
          <label :class="{ on: xrayShell }" title="舱体透视 (X-Ray)">
            <input v-model="xrayShell" type="checkbox" /><i></i>透视
          </label>
          <label
            :class="{ on: showWalkways }"
            :title="isFrigate ? '吊桥/翻转踏板/攀爬阵' : isBlueGate ? '木梯/栈道/石阶' : '升降机/爬梯'"
          >
            <input v-model="showWalkways" type="checkbox" /><i></i>
            {{ isFrigate ? '吊桥' : isBlueGate ? '梯道' : '升降机' }}
          </label>
          <label
            :class="{ on: showDoors }"
            :title="isFrigate ? '隔舱门/滑门/进度舱盖' : isBlueGate ? '地窖铁门' : '门体/战利品舱'"
          >
            <input v-model="showDoors" type="checkbox" /><i></i>
            {{ isFrigate ? '舱门' : isBlueGate ? '铁门' : '门体' }}
          </label>
          <label
            v-if="!isBlueGate"
            :class="{ on: showCables }"
            :title="isFrigate ? '终端/锁扣/棘轮开关' : '信号/供电电缆'"
          >
            <input v-model="showCables" type="checkbox" /><i></i>
            {{ isFrigate ? '开关' : '电缆' }}
          </label>
          <label
            :class="{ on: showMachinery }"
            :title="isFrigate ? '核心/护盾/风扇/弱点' : isBlueGate ? '中继器/配电箱/物资箱' : '机关/激光/冷却塔'"
          >
            <input v-model="showMachinery" type="checkbox" /><i></i>
            {{ isFrigate ? '核心' : isBlueGate ? '装置' : '机关' }}
          </label>
          <label v-if="!isBlueGate" :class="{ on: showCircuits }" title="逻辑连线">
            <input v-model="showCircuits" type="checkbox" /><i></i>连线
          </label>
          <label :class="{ on: showRoomVolumes }" title="密室范围">
            <input v-model="showRoomVolumes" type="checkbox" /><i></i>密室
          </label>
          <label :class="{ on: wireframe }" title="线框">
            <input v-model="wireframe" type="checkbox" /><i></i>线框
          </label>
        </div>

        <div class="hud-group hud-cam">
          <button
            class="seg-btn"
            :class="{ active: !flyMode }"
            title="轨道视角"
            @click="flyMode = false"
          >
            轨道
          </button>
          <button
            class="seg-btn"
            :class="{ active: flyMode }"
            title="WASD 漫游"
            @click="flyMode = true"
          >
            WASD
          </button>
          <span class="hud-sep"></span>
          <button title="俯视" @click="setOverview(true)">俯视</button>
          <button title="全景复位" @click="setOverview(false)">复位</button>
        </div>
      </div>

      <!-- Bottom-right node inspector -->
      <NodeDetailDrawer
        :active-node="activeNode"
        :category-meta="categoryMeta"
        :is-blue-gate="isBlueGate"
        :active-connections="activeConnections"
        @select-node="selectNode($event, true)"
      />

      <div v-if="loading" class="status-toast" :title="currentPuzzle.modelUrl">
        <span class="st-bar"></span>
        <span class="st-label">加载模型</span>
        <strong>{{ currentPuzzle.title }}</strong>
      </div>
      <div v-else-if="loadError" class="status-toast error">
        <span class="st-label">加载失败</span>
        <strong>{{ loadError }}</strong>
      </div>

      <footer class="coords-bar">
        <span>
          <em>XYZ</em>
          <b class="ar-num">{{ hud.x }}</b> · <b class="ar-num">{{ hud.y }}</b> · <b class="ar-num">{{ hud.z }}</b> m
        </span>
        <span v-if="isWalker">
          <em>迷宫</em><b>{{ fmtCode(activeMaze) }}</b>
          <em>路线</em><b>{{ fmtCode(activeRoute) }}</b>
        </span>
        <span><em>剖切</em><b class="ar-num">{{ clipZ.toFixed(1) }}</b> m</span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: 368px 1fr;
  height: calc(100vh - var(--topbar-h, 56px));
  background: var(--bg-0);
  color: var(--tx-1);
  font-family: var(--font-body);
}

.layout.sidebar-collapsed {
  grid-template-columns: 1fr;
}

/* ================= Sidebar ================= */
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--bg-panel);
  border-right: 1px solid var(--line);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bg-hover) transparent;
}

.sb-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 0;
}

.region-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.back-btn {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  color: var(--tx-2);
  cursor: pointer;
  transition: color 0.15s, box-shadow 0.15s;
}

.back-btn:hover {
  color: var(--cream);
  box-shadow: inset 0 0 0 1px var(--cream);
}

.collapse-sb-btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 30px;
  padding: 0 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  box-shadow: inset 0 0 0 1px var(--line-strong);
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: color 0.15s, box-shadow 0.15s, background 0.15s;
}

.collapse-sb-btn:hover {
  color: var(--cream);
  background: var(--bg-2);
  box-shadow: inset 0 0 0 1px var(--cream);
}

.region-tabs {
  flex: 1;
  display: flex;
  gap: 2px;
  min-width: 0;
  border-bottom: 1px solid var(--line);
}

.region-tabs button {
  position: relative;
  flex: 1;
  height: 30px;
  padding: 0 4px;
  background: none;
  border: none;
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.15s;
}

.region-tabs button::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: -1px;
  height: 2px;
  background: var(--accent);
  transform: scaleX(0);
  transition: transform 0.2s var(--ease-out);
}

.region-tabs button:hover {
  color: var(--tx-1);
}

.region-tabs button.active {
  color: var(--cream);
}

.region-tabs button.active::after {
  transform: scaleX(1);
}

.stage-tabs {
  display: flex;
}

.stage-tabs .ar-tab {
  flex: 1;
  justify-content: center;
  padding: 0 8px;
  letter-spacing: 0.03em;
}

.stage-head {
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--line);
}

.stage-head h1 {
  font-size: 22px;
  line-height: 1.15;
}

.stage-meta {
  display: flex;
  gap: 14px;
  margin-top: 8px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--tx-3);
}

.stage-meta b {
  margin-right: 3px;
  font-size: 14px;
  color: var(--tx-2);
}

/* Section shell shared look (mirrored in child components) */
.sb-sec {
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.sec-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin: 0 0 8px;
}

.sec-head:not(:first-child) {
  margin-top: 14px;
}

.sec-head > span {
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--tx-3);
}

.sec-head > em {
  font-style: normal;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--tx-3);
}

.sec-head > em b {
  font-size: 13px;
  color: var(--tx-1);
}

/* Segmented variant buttons */
.seg {
  display: grid;
  gap: 2px;
  padding: 3px;
  background: var(--bg-2);
  border-radius: var(--radius);
}

.seg-4 {
  grid-template-columns: repeat(4, 1fr);
}

.seg-3 {
  grid-template-columns: repeat(3, 1fr);
}

.seg button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 28px;
  padding: 0 6px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--tx-2);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.seg button i {
  flex: 0 0 auto;
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--v-color);
}

.seg button:hover {
  color: var(--tx-1);
  background: rgba(236, 226, 208, 0.06);
}

.seg button.active {
  background: var(--cream);
  color: var(--ink);
}

.route-card {
  margin-top: 8px;
  padding: 9px 11px;
  background: var(--bg-2);
  border-radius: var(--radius-sm);
  box-shadow: inset 3px 0 0 var(--r-color);
}

.rc-doors {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--tx-1);
}

.rc-desc {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.55;
  color: var(--tx-2);
}

.ct-state {
  color: var(--st-ok) !important;
}

.ct-state.danger {
  color: var(--rb-orange) !important;
}

.ct-jaw-track {
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 20px;
  background: var(--bg-0);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line-strong);
  overflow: hidden;
  cursor: pointer;
}

.ct-jaw {
  height: 100%;
  background: repeating-linear-gradient(
    -45deg,
    var(--rb-orange) 0 6px,
    color-mix(in srgb, var(--rb-orange) 70%, #000) 6px 12px
  );
  transition: width 0.08s linear;
}

.ct-gap-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--cream);
  text-shadow: 0 1px 2px var(--ink);
  pointer-events: none;
}

.ct-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 8px;
}

/* ---- Nodes ---- */
.nodes-section {
  display: flex;
  flex-direction: column;
  flex: 1 0 auto;
  min-height: 240px;
  border-bottom: none;
}

.circuit-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

.circuit-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 9px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--bg-2);
  color: var(--tx-2);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.circuit-tabs button b {
  font-size: 12px;
  color: var(--amber);
}

.circuit-tabs button .ar-count {
  font-family: var(--font-display);
  font-size: 11px;
  opacity: 0.6;
}

.circuit-tabs button:hover {
  color: var(--tx-1);
  background: var(--bg-hover);
}

.circuit-tabs button.active {
  background: var(--cream);
  color: var(--ink);
}

.circuit-tabs button.active b {
  color: var(--ink);
}

.node-list {
  list-style: none;
  margin: 0 -16px;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.node-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
}

.node-code {
  flex-shrink: 0;
  min-width: 36px;
  height: 24px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  background: color-mix(in srgb, var(--nc, var(--tx-3)) 16%, transparent);
  color: var(--nc, var(--tx-2));
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.node-btn.active .node-code {
  background: var(--nc, var(--tx-2));
  color: var(--ink);
}

.node-main {
  min-width: 0;
  flex: 1;
}

.node-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--tx-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-sub {
  margin-top: 1px;
  font-size: 11.5px;
  color: var(--tx-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ================= Stage / overlays ================= */
.stage {
  position: relative;
  overflow: hidden;
}

.viewport {
  width: 100%;
  height: 100%;
}

.expand-sb-btn {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 15;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: rgba(9, 12, 25, 0.92);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45), inset 0 0 0 1px var(--line-strong);
  color: var(--cream);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
  backdrop-filter: blur(6px);
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.expand-sb-btn:hover {
  background: var(--cream);
  color: var(--ink);
}

.legend-card {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 8px 12px 10px;
  background: rgba(9, 12, 25, 0.88);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line);
  backdrop-filter: blur(6px);
  transition: top 0.2s var(--ease);
}

.legend-card.shifted-down {
  top: 52px;
}

.legend-card.collapsed {
  padding-bottom: 8px;
}

.legend-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  margin-bottom: 6px;
  background: none;
  border: none;
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  cursor: pointer;
}

.legend-card.collapsed .legend-title {
  margin-bottom: 0;
}

.legend-title:hover {
  color: var(--cream);
}

.legend-grid {
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 4px 14px;
  font-size: 11.5px;
  color: var(--tx-2);
}

.legend-grid span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.legend-grid i {
  width: 9px;
  height: 9px;
  border-radius: 1px;
  display: inline-block;
}

/* Top-right toolbar */
.hud {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: flex-start;
  gap: 8px;
  max-width: calc(100% - 560px);
  min-width: 300px;
}

.hud-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 2px;
  padding: 3px;
  background: rgba(9, 12, 25, 0.88);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line);
  backdrop-filter: blur(6px);
}

.hud label,
.hud button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--tx-3);
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, color 0.15s;
}

.hud label input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.hud label i {
  width: 8px;
  height: 8px;
  border-radius: 1px;
  box-shadow: inset 0 0 0 1.5px currentColor;
  transition: background 0.15s, box-shadow 0.15s;
}

.hud label:hover,
.hud button:hover {
  color: var(--tx-1);
  background: rgba(236, 226, 208, 0.07);
}

.hud label.on {
  color: var(--cream);
}

.hud label.on i {
  background: var(--amber);
  box-shadow: none;
}

.hud label:focus-within {
  outline: 1px solid var(--amber);
}

.hud button.seg-btn.active {
  background: var(--cream);
  color: var(--ink);
}

.hud-sep {
  width: 1px;
  margin: 5px 3px;
  background: var(--line-strong);
}

/* Loading / error */
.status-toast {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 260px;
  padding: 14px 18px 12px;
  background: rgba(9, 12, 25, 0.94);
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 1px var(--line-strong);
  overflow: hidden;
}

.status-toast .st-bar {
  position: absolute;
  top: 0;
  left: 0;
  height: 3px;
  width: 40%;
  background: var(--amber);
  animation: load-slide 1.2s var(--ease) infinite;
}

.status-toast .st-label {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--amber);
}

.status-toast strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--cream);
}

.status-toast.error {
  box-shadow: inset 0 0 0 1px var(--st-danger), inset 4px 0 0 var(--st-danger);
}

.status-toast.error .st-label {
  color: var(--st-danger);
}

@keyframes load-slide {
  from {
    transform: translateX(-100%);
  }
  to {
    transform: translateX(250%);
  }
}

/* Bottom status bar */
.coords-bar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  height: 26px;
  padding: 0 12px;
  background: rgba(9, 12, 25, 0.85);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--line);
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--tx-3);
}

.coords-bar em {
  margin-right: 6px;
  font-style: normal;
  font-size: 10.5px;
  letter-spacing: 0.12em;
  color: var(--tx-3);
}

.coords-bar em:not(:first-child) {
  margin-left: 12px;
}

.coords-bar b {
  font-weight: 700;
  color: var(--tx-1);
}
</style>
