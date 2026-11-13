import { createRouter, createWebHistory } from 'vue-router'

const validStages = ['refuge', 'fort', 'frigate', 'walker', 'caz', 'stella']

const routes = [
  {
    path: '/',
    redirect: '/home',
  },
  {
    path: '/home',
    name: 'home',
    component: () => import('../views/home/HomeView.vue'),
    meta: { module: 'home', title: '总览' },
  },
  {
    path: '/weapons',
    component: () => import('../views/weapons/WeaponsLayout.vue'),
    meta: { module: 'weapons', title: '武器' },
    redirect: '/weapons/workbench',
    children: [
      {
        path: 'workbench',
        name: 'weapons-workbench',
        component: () => import('../views/weapons/WeaponWorkbenchView.vue'),
        meta: { module: 'weapons', subView: 'workbench' },
      },
      {
        path: 'compare',
        name: 'weapons-compare',
        component: () => import('../views/weapons/WeaponCompareView.vue'),
        meta: { module: 'weapons', subView: 'compare' },
      },
    ],
  },
  {
    path: '/quests',
    component: () => import('../views/quests/QuestsResourceLayout.vue'),
    meta: { module: 'quests', title: '任务资源' },
    redirect: '/quests/archive',
    children: [
      {
        path: 'archive',
        name: 'quests-archive',
        component: () => import('../views/quests/QuestsArchiveView.vue'),
        meta: { module: 'quests', subTab: 'quests' },
      },
      {
        path: 'workshop',
        name: 'quests-workshop',
        component: () => import('../views/quests/WorkshopScrappyView.vue'),
        meta: { module: 'quests', subTab: 'workshop' },
      },
      {
        path: 'outpost',
        name: 'quests-outpost',
        component: () => import('../views/quests/OutpostDenView.vue'),
        meta: { module: 'quests', subTab: 'outpost' },
      },
      {
        path: 'blueprints',
        name: 'quests-blueprints',
        component: () => import('../views/quests/BlueprintsCatalogView.vue'),
        meta: { module: 'quests', subTab: 'blueprints' },
      },
    ],
  },
  {
    path: '/maps',
    name: 'maps-world',
    component: () => import('../views/maps/WorldMapSelectView.vue'),
    meta: { module: 'maps', subView: 'world' },
  },
  {
    path: '/maps/viewer/:stageKey?',
    name: 'maps-viewer',
    component: () => import('../views/maps/PuzzleStageViewerView.vue'),
    meta: { module: 'maps', subView: 'viewer' },
  },
  {
    path: '/maps/:mapId',
    name: 'maps-detail',
    component: () => import('../views/maps/TacticalMapDetailView.vue'),
    meta: { module: 'maps', subView: 'detail' },
  },
  {
    path: '/raider',
    component: () => import('../views/raider/RaiderLayout.vue'),
    meta: { module: 'raider', title: '奇袭者' },
    redirect: (to) =>
      to.query?.loadout
        ? { path: '/raider/loadout', query: to.query }
        : { path: '/raider/skills', query: to.query },
    children: [
      {
        path: 'skills',
        name: 'raider',
        component: () => import('../views/raider/RaiderSkillTreeView.vue'),
        meta: { module: 'raider', subTab: 'skills', title: '奇袭者 · 天赋树' },
      },
      {
        path: 'loadout',
        name: 'raider-loadout',
        component: () => import('../views/raider/RaiderLoadoutView.vue'),
        meta: { module: 'raider', subTab: 'loadout', title: '奇袭者 · 战备' },
      },
    ],
  },
  {
    path: '/overlay',
    name: 'overlay',
    component: () => import('../views/overlay/OverlayWindowView.vue'),
    meta: { module: 'overlay', isOverlay: true, title: '战术悬浮窗' },
  },
]

const rawBase = import.meta.env.BASE_URL || '/'
const router = createRouter({
  history: createWebHistory(rawBase === './' ? '/' : rawBase),
  routes,
})

// Backward compatibility with legacy ?tab= and ?stage= query params + ?window=overlay / Tauri overlay label
router.beforeEach((to) => {
  const isTauriOverlay =
    typeof window !== 'undefined' &&
    window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label === 'overlay'

  if (
    (isTauriOverlay ||
      to.query.window === 'overlay' ||
      (typeof window !== 'undefined' && window.location.search.includes('window=overlay'))) &&
    to.name !== 'overlay'
  ) {
    return { name: 'overlay' }
  }

  const stageParam = to.query.stage
  const tabParam = to.query.tab

  if (stageParam && validStages.includes(stageParam) && to.name !== 'maps-viewer') {
    return { name: 'maps-viewer', params: { stageKey: stageParam } }
  }
  if (tabParam && to.path === '/home') {
    if (tabParam === 'weapons') return { path: '/weapons/workbench' }
    if (tabParam === 'quests') return { path: '/quests/archive' }
    if (tabParam === 'maps') return { path: '/maps' }
    if (tabParam === 'raider') return { path: '/raider' }
  }
  return true
})

export default router
