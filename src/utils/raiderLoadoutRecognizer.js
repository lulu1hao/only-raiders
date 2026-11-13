/**
 * raiderLoadoutRecognizer.js
 *
 * 奇袭者（Raider）「战备」(WBP_NewInventoryLoadout + WBP_InventoryStash) 离线视觉识别引擎
 * 纯前端 Canvas 2D 多特征融合（UMG 原生比例 Alpha 合成双线性背景平面 RGB NCC + 有向 Sobel 梯度 NCC + 品质角标与底栏徽章检测），零外部依赖
 */

import loadoutData from '../data/raiderLoadoutData.json'
import weaponsData from '../data/weaponsData.json'
import weaponVisuals from '../data/weaponVisuals.json'
import { assetUrl } from './assetUrl'
import { decodeSourceToImageData } from './raiderVisionRecognizer'

export { decodeSourceToImageData }

const REF_W = 1920
const REF_H = 1080

const FILTER_ORDER = [
  'all',
  'augment',
  'armor',
  'weapons',
  'ammunition',
  'modifications',
  'utilities',
  'keys',
  'materials',
  'misc',
]

// 1920x1080 下各槽位精确像素矩形 (与 WBP_NewInventoryLoadout / WBP_InventoryStash UMG 1:1 实测对齐)
export const UMG_RECTS_1080P = {
  stashFilters: {
    // WBP_InventoryFilterList 左侧分类栏 (圆心 x=99, y=294 起按 50px 步进纵向排列)
    all: { x: 99, y: 294 },
    augment: { x: 99, y: 344 },
    armor: { x: 99, y: 394 },
    weapons: { x: 99, y: 444 },
    ammunition: { x: 99, y: 494 },
    modifications: { x: 99, y: 544 },
    utilities: { x: 99, y: 594 },
    keys: { x: 99, y: 644 },
    materials: { x: 99, y: 694 },
    misc: { x: 99, y: 744 },
  },
  stashGrid: {
    originX: 152,
    originY: 272,
    tileW: 96,
    tileH: 96,
    pitchX: 104,
    pitchY: 104,
    cols: 4,
    rows: 6,
    clipBottomY: 944,
  },
  stashScrollbar: {
    x0: 581,
    x1: 589,
    bgX: 574,
    y0: 274,
    y1: 940,
  },
  // 储备箱第 1~2 列暗缝 (352..360) × 第 2~3 行暗缝 (576..584) 十字正中心，悬停滚轮零卡片高亮、零 Tooltip 遮挡
  stashScrollHover: { x: 356, y: 580 },
  augment: { x: 692, y: 272, w: 144, h: 96 },
  shield: { x: 852, y: 272, w: 144, h: 96 },
  weapon1: { x: 692, y: 392, w: 304, h: 200 },
  weapon2: { x: 692, y: 608, w: 304, h: 200 },
  backpack: Array.from({ length: 24 }, (_, idx) => ({
    x: 1044 + (idx % 4) * 104,
    y: 272 + Math.floor(idx / 4) * 104,
    w: 96,
    h: 96,
  })),
  quickUse: [
    { x: 1503, y: 272, w: 96, h: 96 },
    { x: 1607, y: 272, w: 96, h: 96 },
    { x: 1711, y: 272, w: 96, h: 96 },
    { x: 1503, y: 376, w: 96, h: 96 },
    { x: 1607, y: 376, w: 96, h: 96 },
    { x: 1711, y: 376, w: 96, h: 96 },
  ],
  aux: [
    { x: 1503, y: 543, w: 96, h: 96 },
    { x: 1607, y: 543, w: 96, h: 96 },
    { x: 1711, y: 543, w: 96, h: 96 },
  ],
  safePocketNoAux: [
    { x: 1503, y: 543, w: 96, h: 96 },
    { x: 1607, y: 543, w: 96, h: 96 },
    { x: 1711, y: 543, w: 96, h: 96 },
  ],
  safePocketWithAux: [
    { x: 1503, y: 711, w: 96, h: 96 },
    { x: 1607, y: 711, w: 96, h: 96 },
    { x: 1711, y: 711, w: 96, h: 96 },
  ],
}

const SQ_W = 28
const SQ_H = 28
const WP_W = 44
const WP_H = 22
const MOD_W = 20
const MOD_H = 20
const GLYPH_W = 18
const GLYPH_H = 18

/**
 * WBP_InventoryWeaponSlot (304x200 @1080p) 子控件几何（取自游戏 UMG 资产 + 实机截图实测）：
 * - 底栏 36px：左侧 TypeIcon = 弹药类型图标 (DA_UIMetaData.TinyIcon，如 T_UI_Ammo_Shotgun)
 * - 配件栏：38x38 配件格 + 8px 间距，外层 ModificationSlotsContainer 左右各 4px 内边距；
 *   增强型武器 (Ascended) 在其右侧追加 40x40 的 AscendedUpgradeSlot（24px 增强图标），整行水平居中。
 */
const WEAPON_CARD = {
  w: 304,
  typeIcon: { x: 8, y: 168, w: 24, h: 24 },
  modRowCenterY: 134,
  modBox: 38,
  modGap: 8,
  modPad: 4,
  upgradeBox: 40,
  upgradeIcon: 24,
}
// 储备箱 96x96 物品格底栏左侧 TinyIcon 徽章（武器格 = 弹药类型图标；实测字形中心约 (13, 82)）
const TILE_BADGE = { x: 5, y: 74, w: 16, h: 16 }

const weaponMetaById = new Map((weaponsData.weapons || []).map((w) => [w.id, w]))

// UMG ScaleBox 内图标在卡片内的归一化中心与宽高占比 (cx, cy, wFrac, hFrac)
const ICON_BOX_SPECS = {
  tile: { cx: 0.5, cy: 0.38, wf: 0.73, hf: 0.73 },
  gear: { cx: 0.5, cy: 0.38, wf: 0.5, hf: 0.75 },
  weaponSlot: { cx: 0.5, cy: 0.27, wf: 0.572, hf: 0.435 },
  weaponTileTight: { cx: 0.5, cy: 0.382, wf: 0.75, hf: 0.375 },
  weaponTileWide: { cx: 0.5, cy: 0.382, wf: 0.86, hf: 0.43 },
  modBox: { cx: 0.5, cy: 0.5, wf: 0.82, hf: 0.82 },
}

const MOD_SLOT_NORMALIZATION = {
  Muzzle: ['Muzzle'],
  'Shotgun-Muzzle': ['Shotgun Muzzle'],
  Underbarrel: ['Underbarrel'],
  'Light-Mag': ['Light Magazine'],
  'Medium-Mag': ['Medium Magazine'],
  'Heavy-Mag': ['Heavy Magazine'],
  'Shotgun-Mag': ['Shotgun Magazine'],
  Stock: ['Stock'],
}

let cachedTemplatesPromise = null

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function medianOf(arr) {
  if (!arr.length) return 0
  const sorted = arr.slice().sort((a, b) => a - b)
  const mid = sorted.length >> 1
  return sorted.length & 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) * 0.5
}

function percentileOf(arr, q) {
  if (!arr.length) return 0
  const sorted = arr.slice().sort((a, b) => a - b)
  const idx = clamp((sorted.length - 1) * q, 0, sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const t = idx - lo
  return sorted[lo] * (1 - t) + sorted[hi] * t
}

const MOD_RARITY_BY_ID = {
  'angled-grip-i': 'Common',
  'angled-grip-ii': 'Uncommon',
  'angled-grip-iii': 'Rare',
  'compensator-i': 'Common',
  'compensator-ii': 'Uncommon',
  'compensator-iii': 'Rare',
  'extended-barrel-i': 'Uncommon',
  'extended-barrel-ii': 'Rare',
  'extended-barrel-iii': 'Epic',
  'extended-light-mag-i': 'Common',
  'extended-light-mag-ii': 'Uncommon',
  'extended-light-mag-iii': 'Rare',
  'extended-medium-mag-i': 'Common',
  'extended-medium-mag-ii': 'Uncommon',
  'extended-medium-mag-iii': 'Rare',
  'extended-shotgun-mag-i': 'Common',
  'extended-shotgun-mag-ii': 'Uncommon',
  'extended-shotgun-mag-iii': 'Rare',
  'horizontal-grip': 'Epic',
  'kinetic-converter': 'Legendary',
  'lightweight-stock': 'Epic',
  'muzzle-brake-i': 'Common',
  'muzzle-brake-ii': 'Uncommon',
  'muzzle-brake-iii': 'Rare',
  'padded-stock': 'Epic',
  'shotgun-choke-i': 'Common',
  'shotgun-choke-ii': 'Uncommon',
  'shotgun-choke-iii': 'Rare',
  'shotgun-silencer': 'Epic',
  'silencer-i': 'Uncommon',
  'silencer-ii': 'Rare',
  'silencer-iii': 'Epic',
  'stable-stock-i': 'Common',
  'stable-stock-ii': 'Uncommon',
  'stable-stock-iii': 'Rare',
  'vertical-grip-i': 'Common',
  'vertical-grip-ii': 'Uncommon',
  'vertical-grip-iii': 'Rare',
  'anvil-splitter': 'Legendary',
}

function inferModRarity(mod) {
  if (mod?.rarity) return mod.rarity
  if (mod?.id && MOD_RARITY_BY_ID[mod.id]) return MOD_RARITY_BY_ID[mod.id]
  const name = mod?.name || ''
  if (name.endsWith(' I')) return 'Common'
  if (name.endsWith(' II')) return 'Uncommon'
  if (name.endsWith(' III')) return 'Rare'
  return 'Epic'
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (/^https?:\/\//i.test(src)) {
      try {
        const u = new URL(src, window.location?.href || 'http://localhost')
        if (window.location && u.origin !== window.location.origin) {
          img.crossOrigin = 'anonymous'
        }
      } catch {
        img.crossOrigin = 'anonymous'
      }
    }
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * 按 UMG 原生贴图画幅直接构建 RGBA 浮点模板（保留原始留白比例与 Alpha 通道，与实机 ScaleBox 1:1 对齐）
 */
async function buildRgbaIconTemplate(iconPath, outW, outH) {
  const img = await loadImg(assetUrl(iconPath))
  const srcW = img.naturalWidth || img.width || outW
  const srcH = img.naturalHeight || img.height || outH

  // 两级平滑下采样，消除 512px -> 28px 直接抽样混叠伪影
  const midW = Math.min(srcW, outW * 4)
  const midH = Math.min(srcH, outH * 4)
  const midCanvas = document.createElement('canvas')
  midCanvas.width = midW
  midCanvas.height = midH
  const midCtx = midCanvas.getContext('2d')
  midCtx.imageSmoothingEnabled = true
  midCtx.imageSmoothingQuality = 'high'
  midCtx.clearRect(0, 0, midW, midH)
  midCtx.drawImage(img, 0, 0, midW, midH)

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.clearRect(0, 0, outW, outH)
  ctx.drawImage(midCanvas, 0, 0, outW, outH)

  const { data } = ctx.getImageData(0, 0, outW, outH)
  const len = outW * outH
  const r = new Float32Array(len)
  const g = new Float32Array(len)
  const b = new Float32Array(len)
  const a = new Float32Array(len)

  let alphaSum = 0
  for (let i = 0; i < len; i++) {
    const p = i * 4
    const alpha = data[p + 3] / 255
    // 注意 Canvas 2D getImageData 返回非预乘直通色值
    r[i] = data[p]
    g[i] = data[p + 1]
    b[i] = data[p + 2]
    a[i] = alpha
    alphaSum += alpha
  }

  if (alphaSum < 0.5) return null
  return { r, g, b, a, w: outW, h: outH }
}

/**
 * 预加载并缓存所有强化、护盾、武器、武器配件与道具的 RGBA 视觉模板
 */
export async function ensureLoadoutTemplates() {
  if (cachedTemplatesPromise) return cachedTemplatesPromise

  cachedTemplatesPromise = (async () => {
    const db = {
      augments: new Map(),
      shields: new Map(),
      weapons: new Map(),
      items: new Map(),
      mods: new Map(),
      // `${weaponId}|${'base'|'asc'}|${'big'|'small'}` -> 模板（asc = 增强型武器，品质恒为 Legendary）
      weaponVariants: new Map(),
      // 弹药类型名 (weaponsData.ammo) -> 白色字形模板
      ammo: new Map(),
      // 增强图标资产名 (T_UI_Icon_Upgrade_*) -> 白色字形模板
      ampIcons: new Map(),
    }

    const tasks = []

    const addVariant = (w, variant, size, iconPath, rarity) => {
      if (!iconPath) return
      const isBig = size === 'big'
      tasks.push(
        buildRgbaIconTemplate(iconPath, isBig ? WP_W : SQ_W, isBig ? WP_H : SQ_H)
          .then((tpl) => {
            if (tpl) {
              db.weaponVariants.set(`${w.id}|${variant}|${size}`, {
                ...tpl,
                meta: { ...w, rarity, variant },
              })
            }
          })
          .catch(() => {}),
      )
    }

    for (const w of weaponsData.weapons || []) {
      const vis = weaponVisuals.weapons?.[w.id]
      addVariant(w, 'base', 'big', w.image, w.rarity)
      addVariant(w, 'base', 'small', vis?.imageSmall, w.rarity)
      if (vis?.ascended) {
        const ascRarity = vis.ascended.rarity || 'Legendary'
        addVariant(w, 'asc', 'big', vis.ascended.image, ascRarity)
        addVariant(w, 'asc', 'small', vis.ascended.imageSmall, ascRarity)
      }
    }

    for (const [ammoName, iconPath] of Object.entries(weaponVisuals.ammoIcons || {})) {
      tasks.push(
        buildRgbaIconTemplate(iconPath, GLYPH_W, GLYPH_H)
          .then((tpl) => {
            if (tpl) db.ammo.set(ammoName, tpl)
          })
          .catch(() => {}),
      )
    }

    for (const [iconName, iconPath] of Object.entries(weaponVisuals.ampIcons || {})) {
      tasks.push(
        buildRgbaIconTemplate(iconPath, GLYPH_W, GLYPH_H)
          .then((tpl) => {
            if (tpl) db.ampIcons.set(iconName, tpl)
          })
          .catch(() => {}),
      )
    }

    for (const aug of loadoutData.augments) {
      if (aug.id === 'none' || !aug.icon) continue
      tasks.push(
        buildRgbaIconTemplate(aug.icon, SQ_W, SQ_H)
          .then((tpl) => {
            if (tpl) db.augments.set(aug.id, { ...tpl, meta: aug })
          })
          .catch(() => {}),
      )
    }

    for (const sh of loadoutData.shields) {
      if (!sh.icon) continue
      tasks.push(
        buildRgbaIconTemplate(sh.icon, SQ_W, SQ_H)
          .then((tpl) => {
            if (tpl) db.shields.set(sh.id, { ...tpl, meta: sh })
          })
          .catch(() => {}),
      )
    }

    for (const w of weaponsData.weapons || []) {
      if (!w.image) continue
      tasks.push(
        buildRgbaIconTemplate(w.image, WP_W, WP_H)
          .then((tpl) => {
            if (tpl) db.weapons.set(w.id, { ...tpl, meta: w })
          })
          .catch(() => {}),
      )
    }

    for (const it of loadoutData.quickUseItems) {
      if (!it.icon) continue
      tasks.push(
        buildRgbaIconTemplate(it.icon, SQ_W, SQ_H)
          .then((tpl) => {
            if (tpl) db.items.set(it.id, { ...tpl, meta: it })
          })
          .catch(() => {}),
      )
    }

    for (const m of weaponsData.weaponMods || []) {
      if (!m.image) continue
      tasks.push(
        buildRgbaIconTemplate(m.image, MOD_W, MOD_H)
          .then((tpl) => {
            if (tpl) {
              db.mods.set(m.id, {
                ...tpl,
                meta: { ...m, rarity: m.rarity || inferModRarity(m) },
              })
            }
          })
          .catch(() => {}),
      )
    }

    await Promise.all(tasks)
    if (db.items.size === 0 || db.weapons.size === 0) {
      cachedTemplatesPromise = null
    }
    return db
  })()

  return cachedTemplatesPromise
}

/**
 * 亚像素双线性采样 RGB 与亮度
 */
function bilerpRgb(data, W, H, fx, fy, outRgb) {
  const cx = clamp(fx, 0, W - 1.001)
  const cy = clamp(fy, 0, H - 1.001)
  const x0 = cx | 0
  const y0 = cy | 0
  const dx = cx - x0
  const dy = cy - y0
  const w00 = (1 - dx) * (1 - dy)
  const w10 = dx * (1 - dy)
  const w01 = (1 - dx) * dy
  const w11 = dx * dy

  const p00 = (y0 * W + x0) * 4
  const p10 = p00 + 4
  const p01 = p00 + W * 4
  const p11 = p01 + 4

  outRgb[0] =
    w00 * data[p00] + w10 * data[p10] + w01 * data[p01] + w11 * data[p11]
  outRgb[1] =
    w00 * data[p00 + 1] +
    w10 * data[p10 + 1] +
    w01 * data[p01 + 1] +
    w11 * data[p11 + 1]
  outRgb[2] =
    w00 * data[p00 + 2] +
    w10 * data[p10 + 2] +
    w01 * data[p01 + 2] +
    w11 * data[p11 + 2]
}

function bilerpLum(data, W, H, fx, fy) {
  const cx = clamp(fx, 0, W - 1.001)
  const cy = clamp(fy, 0, H - 1.001)
  const x0 = cx | 0
  const y0 = cy | 0
  const dx = cx - x0
  const dy = cy - y0
  const w00 = (1 - dx) * (1 - dy)
  const w10 = dx * (1 - dy)
  const w01 = (1 - dx) * dy
  const w11 = dx * dy

  const p00 = (y0 * W + x0) * 4
  const p10 = p00 + 4
  const p01 = p00 + W * 4
  const p11 = p01 + 4

  const r =
    w00 * data[p00] + w10 * data[p10] + w01 * data[p01] + w11 * data[p11]
  const g =
    w00 * data[p00 + 1] +
    w10 * data[p10 + 1] +
    w01 * data[p01 + 1] +
    w11 * data[p11 + 1]
  const b =
    w00 * data[p00 + 2] +
    w10 * data[p10 + 2] +
    w01 * data[p01 + 2] +
    w11 * data[p11 + 2]
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function mapRectFloat(rect1080, vp) {
  return {
    x: vp.ox + rect1080.x * vp.scale,
    y: vp.oy + rect1080.y * vp.scale,
    w: rect1080.w * vp.scale,
    h: rect1080.h * vp.scale,
  }
}

function mapRect(rect, vp) {
  return {
    x: Math.round(vp.ox + rect.x * vp.scale),
    y: Math.round(vp.oy + rect.y * vp.scale),
    w: Math.max(8, Math.round(rect.w * vp.scale)),
    h: Math.max(8, Math.round(rect.h * vp.scale)),
  }
}

/**
 * 亚像素槽位边框-暗缝对比度评分（精准锁定 1px 装备框线对比外侧 8px 暗底板，兼容悬停奶油高亮卡）
 */
function scoreViewportAlignment(imageData, vp) {
  const { data, width: W, height: H } = imageData
  const probeRects = [
    UMG_RECTS_1080P.augment,
    UMG_RECTS_1080P.shield,
    UMG_RECTS_1080P.weapon1,
    UMG_RECTS_1080P.weapon2,
    UMG_RECTS_1080P.backpack[0],
    UMG_RECTS_1080P.backpack[1],
    UMG_RECTS_1080P.backpack[2],
    UMG_RECTS_1080P.backpack[3],
    UMG_RECTS_1080P.quickUse[0],
    UMG_RECTS_1080P.quickUse[1],
    UMG_RECTS_1080P.quickUse[2],
    UMG_RECTS_1080P.quickUse[3],
  ]

  let edgeAcc = 0
  let edgeSamples = 0
  let darkGutters = 0
  let validRects = 0

  for (const r0 of probeRects) {
    const fx0 = vp.ox + r0.x * vp.scale
    const fy0 = vp.oy + r0.y * vp.scale
    const fw = r0.w * vp.scale
    const fh = r0.h * vp.scale
    if (fx0 < 1.5 || fy0 < 1.5 || fx0 + fw >= W - 1.5 || fy0 + fh >= H - 1.5) {
      continue
    }
    validRects++

    for (let s = 0.2; s <= 0.81; s += 0.2) {
      const sx1080 = r0.x + r0.w * s
      const px = vp.ox + sx1080 * vp.scale
      const topBorder = Math.max(
        bilerpLum(data, W, H, px, vp.oy + (r0.y + 0.5) * vp.scale),
        bilerpLum(data, W, H, px, vp.oy + (r0.y + 1.2) * vp.scale),
      )
      const topGutter = bilerpLum(data, W, H, px, vp.oy + (r0.y - 4.0) * vp.scale)

      const botBorder = Math.max(
        bilerpLum(data, W, H, px, vp.oy + (r0.y + r0.h - 0.5) * vp.scale),
        bilerpLum(data, W, H, px, vp.oy + (r0.y + r0.h - 1.2) * vp.scale),
      )
      const botGutter = bilerpLum(
        data,
        W,
        H,
        px,
        vp.oy + (r0.y + r0.h + 4.0) * vp.scale,
      )

      edgeAcc +=
        Math.min(45, Math.max(0, topBorder - topGutter)) +
        Math.min(45, Math.max(0, botBorder - botGutter))
      edgeSamples += 2

      const sy1080 = r0.y + r0.h * s
      const py = vp.oy + sy1080 * vp.scale
      const leftBorder = Math.max(
        bilerpLum(data, W, H, vp.ox + (r0.x + 0.5) * vp.scale, py),
        bilerpLum(data, W, H, vp.ox + (r0.x + 1.2) * vp.scale, py),
      )
      const leftGutter = bilerpLum(
        data,
        W,
        H,
        vp.ox + (r0.x - 4.0) * vp.scale,
        py,
      )

      const rightBorder = Math.max(
        bilerpLum(data, W, H, vp.ox + (r0.x + r0.w - 0.5) * vp.scale, py),
        bilerpLum(data, W, H, vp.ox + (r0.x + r0.w - 1.2) * vp.scale, py),
      )
      const rightGutter = bilerpLum(
        data,
        W,
        H,
        vp.ox + (r0.x + r0.w + 4.0) * vp.scale,
        py,
      )

      edgeAcc +=
        Math.min(45, Math.max(0, leftBorder - leftGutter)) +
        Math.min(45, Math.max(0, rightBorder - rightGutter))
      edgeSamples += 2
    }

    const midGutter = bilerpLum(
      data,
      W,
      H,
      vp.ox + (r0.x + r0.w * 0.5) * vp.scale,
      vp.oy + (r0.y - 4.0) * vp.scale,
    )
    if (midGutter < 68) darkGutters++
  }

  if (validRects < 8 || !edgeSamples || darkGutters < Math.ceil(validRects * 0.55)) {
    return -999
  }
  const coverageFactor = validRects >= 11 ? 1 : 0.88 + validRects * 0.01
  return (edgeAcc / edgeSamples) * coverageFactor
}

/**
 * 针对任意自由裁剪 (Win+Shift+S) 截图的二维可分离边框梳状定位器：
 * 先在 1D 列均值上对 18 条纵向槽位边界与 8px 暗缝做多尺度梳状匹配锁定 (scale, ox)，
 * 再在对应列上做纵向边界扫描锁定 oy，最后交由亚像素 scoreViewportAlignment 精修。
 */
function solveArbitraryCropViewport(imageData) {
  const { data, width: W, height: H } = imageData
  const avgCol = new Float32Array(W)
  const yStart = Math.max(0, Math.floor(H * 0.14))
  const yEnd = Math.min(H - 1, Math.ceil(H * 0.86))
  const ySamples = 32
  const invYSamples = 1 / ySamples

  for (let s = 0; s < ySamples; s++) {
    const y = Math.round(yStart + ((yEnd - yStart) * s) / (ySamples - 1))
    const rowOff = y * W * 4
    for (let x = 0; x < W; x++) {
      const p = rowOff + x * 4
      avgCol[x] += (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) * invYSamples
    }
  }

  const sampleCol1D = (fx) => {
    const cx = clamp(fx, 0, W - 1.001)
    const x0 = cx | 0
    const t = cx - x0
    return avgCol[x0] * (1 - t) + avgCol[x0 + 1] * t
  }

  const leftBordersX = [692, 852, 1044, 1148, 1252, 1356, 1503, 1607, 1711]
  const rightBordersX = [836, 996, 1140, 1244, 1348, 1452, 1599, 1703, 1807]

  const sMin = Math.max(0.34, Math.min(W / 3840, H / 2160, 0.45))
  const sMax = Math.min(2.6, (W + 48) / 960, (H + 48) / 450)
  if (sMax < sMin) return null

  const scaleSet = new Set()
  for (let sc = sMin; sc <= sMax; sc *= 1.032) {
    scaleSet.add(+sc.toFixed(4))
  }
  for (const stdSc of [
    0.5,
    0.5333,
    0.6667,
    0.75,
    0.8,
    0.9,
    1.0,
    1.125,
    1.25,
    1.3333,
    1.5,
    1.7778,
    2.0,
  ]) {
    if (stdSc >= sMin && stdSc <= sMax) scaleSet.add(stdSc)
  }
  const scales = Array.from(scaleSet).sort((a, b) => a - b)

  const topXSeeds = []
  const pushXSeed = (cand) => {
    // 抑制相邻重复峰
    for (let i = 0; i < topXSeeds.length; i++) {
      const ex = topXSeeds[i]
      if (
        Math.abs(ex.scale - cand.scale) / cand.scale < 0.04 &&
        Math.abs(ex.ox - cand.ox) < 10
      ) {
        if (cand.xScore > ex.xScore) topXSeeds[i] = cand
        return
      }
    }
    topXSeeds.push(cand)
    topXSeeds.sort((a, b) => b.xScore - a.xScore)
    if (topXSeeds.length > 18) topXSeeds.length = 18
  }

  for (const sc of scales) {
    const oxMin = Math.floor(-692 * sc - 24)
    const oxMax = Math.ceil(W + 24 - 1711 * sc)
    if (oxMax < oxMin) continue
    const oxStep = Math.max(1, Math.round(1.8 * sc))
    let bestOxForScale = null

    for (let ox = oxMin; ox <= oxMax; ox += oxStep) {
      let sum = 0
      let cnt = 0
      let darkOk = 0
      for (let i = 0; i < leftBordersX.length; i++) {
        const bx = ox + leftBordersX[i] * sc
        if (bx < 4 || bx >= W - 4) continue
        const brd = Math.max(sampleCol1D(bx + 0.6 * sc), sampleCol1D(bx + 1.3 * sc))
        const gut = sampleCol1D(bx - 3.8 * sc)
        sum += Math.min(32, Math.max(-8, brd - gut))
        if (gut < 68) darkOk++
        cnt++
      }
      for (let i = 0; i < rightBordersX.length; i++) {
        const bx = ox + rightBordersX[i] * sc
        if (bx < 4 || bx >= W - 4) continue
        const brd = Math.max(sampleCol1D(bx - 0.6 * sc), sampleCol1D(bx - 1.3 * sc))
        const gut = sampleCol1D(bx + 3.8 * sc)
        sum += Math.min(32, Math.max(-8, brd - gut))
        if (gut < 68) darkOk++
        cnt++
      }
      if (cnt < 12 || darkOk < cnt * 0.5) continue
      const xScore = sum / cnt
      if (!bestOxForScale || xScore > bestOxForScale.xScore) {
        bestOxForScale = { scale: sc, ox, xScore }
      }
    }
    if (bestOxForScale && bestOxForScale.xScore > 1.6) {
      pushXSeed(bestOxForScale)
    }
  }

  const probeY = [
    { xMid: 764, yTop: 272, yBot: 368 },
    { xMid: 924, yTop: 272, yBot: 368 },
    { xMid: 844, yTop: 392, yBot: 592 },
    { xMid: 1092, yTop: 272, yBot: 368 },
    { xMid: 1196, yTop: 272, yBot: 368 },
    { xMid: 1300, yTop: 376, yBot: 472 },
    { xMid: 1404, yTop: 480, yBot: 576 },
    { xMid: 1551, yTop: 272, yBot: 368 },
    { xMid: 1655, yTop: 272, yBot: 368 },
  ]

  let bestVp = null
  let bestAlign = -Infinity

  for (const seed of topXSeeds) {
    const sc = seed.scale
    const oyMin = Math.floor(-272 * sc - 24)
    const oyMax = Math.ceil(H + 36 - 688 * sc)
    if (oyMax < oyMin) continue
    const oyStep = Math.max(1, Math.round(2.0 * sc))

    let bestOy = null
    let bestYScore = -Infinity

    for (let oy = oyMin; oy <= oyMax; oy += oyStep) {
      let ySum = 0
      let yCnt = 0
      for (let i = 0; i < probeY.length; i++) {
        const p = probeY[i]
        const px = seed.ox + p.xMid * sc
        if (px < 2 || px >= W - 2) continue
        const ty = oy + p.yTop * sc
        const by = oy + p.yBot * sc
        if (ty >= 4 && ty < H - 4) {
          const brd = Math.max(
            bilerpLum(data, W, H, px, ty + 0.6 * sc),
            bilerpLum(data, W, H, px, ty + 1.3 * sc),
          )
          const gut = bilerpLum(data, W, H, px, ty - 3.8 * sc)
          ySum += Math.min(38, Math.max(-8, brd - gut))
          yCnt++
        }
        if (by >= 4 && by < H - 4) {
          const brd = Math.max(
            bilerpLum(data, W, H, px, by - 0.6 * sc),
            bilerpLum(data, W, H, px, by - 1.3 * sc),
          )
          const gut = bilerpLum(data, W, H, px, by + 3.8 * sc)
          ySum += Math.min(38, Math.max(-8, brd - gut))
          yCnt++
        }
      }
      if (yCnt >= 8) {
        const avgY = ySum / yCnt
        if (avgY > bestYScore) {
          bestYScore = avgY
          bestOy = oy
        }
      }
    }

    if (bestOy === null) continue

    // 在 (seed.scale, seed.ox, bestOy) 邻域做 2D 槽位框线精细对齐
    for (const ds of [0.985, 0.993, 1.0, 1.007, 1.015]) {
      const rSc = seed.scale * ds
      const rOxCenter = Math.round(seed.ox + (seed.scale - rSc) * 1250)
      const rOyCenter = Math.round(bestOy + (seed.scale - rSc) * 480)
      for (let dy = -4; dy <= 4; dy += 2) {
        for (let dx = -4; dx <= 4; dx += 2) {
          const candVp = {
            mode: 'cropped_auto',
            scale: rSc,
            ox: rOxCenter + dx,
            oy: rOyCenter + dy,
          }
          const raw = scoreViewportAlignment(imageData, candVp)
          if (raw > bestAlign) {
            bestAlign = raw
            bestVp = candVp
          }
        }
      }
    }
  }

  if (bestVp) {
    const cOx = bestVp.ox
    const cOy = bestVp.oy
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const candVp = {
          mode: 'cropped_auto',
          scale: bestVp.scale,
          ox: cOx + dx,
          oy: cOy + dy,
        }
        const raw = scoreViewportAlignment(imageData, candVp)
        if (raw > bestAlign) {
          bestAlign = raw
          bestVp = candVp
        }
      }
    }
  }

  return bestVp ? { vp: bestVp, score: bestAlign } : null
}

/**
 * 自动定位截图中的 WBP_NewInventoryLoadout 视口变换（支持 16:9、16:10、21:9 带鱼屏、窗口化标题栏偏移及任意 Win+Shift+S 局部裁剪截图）
 */
export function locateLoadoutViewport(imageData) {
  const { width: W, height: H } = imageData
  if (W < 360 || H < 240) {
    return { ok: false, error: '截图分辨率过低，无法识别战备槽位' }
  }

  const sFullH = H / REF_H
  const sFullW = W / REF_W
  const sFit = Math.min(sFullW, sFullH)
  const candidates = [
    // 1. 标准 16:9 / 按高度自适应居中视口 (1080p / 2K / 4K / 21:9 居中)
    {
      mode: 'centered',
      scale: sFullH,
      ox: (W - REF_W * sFullH) * 0.5,
      oy: 0,
      prior: 1.1,
    },
    // 2. 带鱼屏右侧锚定视口
    {
      mode: 'right_anchored',
      scale: sFullH,
      ox: W - REF_W * sFullH,
      oy: 0,
      prior: 0.9,
    },
    // 3. 16:10 屏幕 (如 2560x1600 / 1920x1200) 按宽度自适应上下留边视口
    {
      mode: 'letterbox_16_10',
      scale: sFit,
      ox: (W - REF_W * sFit) * 0.5,
      oy: (H - REF_H * sFit) * 0.5,
      prior: 0.95,
    },
    // 4. 含 Windows 窗口标题栏整窗截图 (如 1920x1112 / 2560x1472, 顶部 28~42px 标题栏)
    {
      mode: 'windowed_titlebar',
      scale: sFullW,
      ox: 0,
      oy: Math.max(24, H - REF_H * sFullW),
      prior: 0.8,
    },
    // 5. 仅截取右侧战备面板 (1236x856 @ 1080p, 起点 636, 112)
    (() => {
      const sc = Math.min(W / 1236, H / 856)
      return {
        mode: 'cropped_panel',
        scale: sc,
        ox: (W - 1236 * sc) * 0.5 - 636 * sc,
        oy: (H - 856 * sc) * 0.5 - 112 * sc,
        prior: 0,
      }
    })(),
    // 6. 同时截取左侧储备箱 + 右侧配装双面板 (不含顶底栏，1800x856 @ 1080p, 起点 60, 112)
    (() => {
      const sc = Math.min(W / 1812, H / 856)
      return {
        mode: 'cropped_dual_panel',
        scale: sc,
        ox: (W - 1812 * sc) * 0.5 - 54 * sc,
        oy: (H - 856 * sc) * 0.5 - 112 * sc,
        prior: 0,
      }
    })(),
  ]

  let best = null
  let bestBase = null
  let bestRaw = -Infinity
  let bestScore = -Infinity

  for (const base of candidates) {
    const step = Math.max(2, Math.round(3 * base.scale))
    const halfSteps = Math.max(3, Math.round((16 * base.scale) / step))
    for (let ky = -halfSteps; ky <= halfSteps; ky++) {
      const dy = ky * step
      for (let kx = -halfSteps; kx <= halfSteps; kx++) {
        const dx = kx * step
        const vp = {
          mode: base.mode,
          scale: base.scale,
          ox: base.ox + dx,
          oy: base.oy + dy,
        }
        const raw = scoreViewportAlignment(imageData, vp)
        if (raw < -900) continue
        const sc = raw + base.prior - (Math.abs(dx) + Math.abs(dy)) * 0.04
        if (sc > bestScore) {
          bestScore = sc
          bestRaw = raw
          best = vp
          bestBase = base
        }
      }
    }
  }

  // 1px 精细对齐微调，确保 (ox, oy) 精确落锁
  if (best && bestBase) {
    const centerOx = best.ox
    const centerOy = best.oy
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const vp = {
          mode: bestBase.mode,
          scale: bestBase.scale,
          ox: centerOx + dx,
          oy: centerOy + dy,
        }
        const raw = scoreViewportAlignment(imageData, vp)
        if (raw < -900) continue
        const drift =
          Math.abs(vp.ox - bestBase.ox) + Math.abs(vp.oy - bestBase.oy)
        const sc = raw + bestBase.prior - drift * 0.04
        if (sc > bestScore) {
          bestScore = sc
          bestRaw = raw
          best = vp
        }
      }
    }
  }

  // Stage 2: 当固定视口预设未能高置信命中（如 Win+Shift+S 任意手绘框选截图）时，启用通用多尺度梳状求解器
  if (!best || bestRaw < 11.5) {
    const solved = solveArbitraryCropViewport(imageData)
    if (solved && solved.score > bestRaw + 0.5 && solved.score >= 4.5) {
      best = solved.vp
      bestRaw = solved.score
      bestScore = solved.score
    }
  }

  if (!best || bestScore < 4.5) {
    return {
      ok: false,
      error: '未检测到奇袭者「战备」配装画面，请打开游戏内仓库/战备配装界面后截图',
    }
  }

  return {
    ok: true,
    viewport: best,
    alignmentScore: +bestScore.toFixed(2),
    hasStashPanel: best.ox + 152 * best.scale >= 0,
  }
}

/**
 * 解析卡片占用态、悬停奶油高亮态 (#f9eedf) 与左下方品质三角角标
 * cardType: 'tile' | 'gear' | 'weaponSlot'
 */
function analyzeCardState(imageData, frect, cardType = 'tile') {
  const { data, width: W, height: H } = imageData
  const { x: rx, y: ry, w: rw, h: rh } = frect
  if (rx < 1 || ry < 1 || rx + rw >= W - 1 || ry + rh >= H - 1 || rw < 10 || rh < 10) {
    return { occupied: false, rarity: null, rarityConfident: false, hovered: false }
  }

  const rgb = [0, 0, 0]

  // 1. 采样卡片上缘底板亮度，检测是否处于悬停/选中奶油色高亮态 (#f9eedf, lum ~235)
  const topLums = []
  for (let sy = 0.06; sy <= 0.17; sy += 0.055) {
    const py = ry + rh * sy
    for (let sx = 0.14; sx <= 0.86; sx += 0.12) {
      topLums.push(bilerpLum(data, W, H, rx + rw * sx, py))
    }
  }
  const topBgLum = medianOf(topLums)
  const hovered = topBgLum >= 160

  // 2. 检测底栏深色条背景与左下角纯白分类图标徽章（所有已装备槽位必有底栏徽章，空槽位绝无底栏徽章）
  const fy0Frac = cardType === 'weaponSlot' ? 0.815 : 0.795
  const fy1Frac = 0.955
  const footerBgLums = []
  for (let sy = fy0Frac; sy <= fy1Frac; sy += 0.04) {
    const py = ry + rh * sy
    for (let sx = 0.3; sx <= 0.62; sx += 0.08) {
      footerBgLums.push(bilerpLum(data, W, H, rx + rw * sx, py))
    }
  }
  const footerBgLum = percentileOf(footerBgLums, 0.25)

  const bx1Frac =
    cardType === 'weaponSlot' ? 0.11 : cardType === 'gear' ? 0.165 : 0.235
  const badgeLums = []
  const bStepsX = 8
  const bStepsY = 6
  for (let jy = 0; jy < bStepsY; jy++) {
    const py = ry + rh * (fy0Frac + ((fy1Frac - fy0Frac) * jy) / (bStepsY - 1))
    for (let ix = 0; ix < bStepsX; ix++) {
      const px = rx + rw * (0.028 + ((bx1Frac - 0.028) * ix) / (bStepsX - 1))
      badgeLums.push(bilerpLum(data, W, H, px, py))
    }
  }
  const badgePeak = percentileOf(badgeLums, 0.92)
  const badgeContrast = badgePeak - footerBgLum
  const hasFooterBadge =
    footerBgLum < 72 && badgePeak >= 92 && badgeContrast >= 48

  // 3. 检测底栏正上方左侧的品质三角角标 (EUIColorState::Rarity*)
  const wy0Frac = cardType === 'weaponSlot' ? 0.565 : 0.505
  const wy1Frac = cardType === 'weaponSlot' ? 0.785 : 0.755
  const wx1Frac =
    cardType === 'weaponSlot' ? 0.105 : cardType === 'gear' ? 0.175 : 0.255

  const votes = { Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 }
  let greyWedgePx = 0
  let wedgeTotal = 0
  const wSteps = 9

  for (let jy = 0; jy < wSteps; jy++) {
    const vRel = jy / (wSteps - 1)
    const py = ry + rh * (wy0Frac + (wy1Frac - wy0Frac) * vRel)
    for (let ix = 0; ix < wSteps; ix++) {
      const uRel = ix / (wSteps - 1)
      if (vRel - uRel < 0.05) continue
      wedgeTotal++
      const px = rx + rw * (0.015 + (wx1Frac - 0.015) * uRel)
      bilerpRgb(data, W, H, px, py, rgb)
      const r = rgb[0]
      const g = rgb[1]
      const b = rgb[2]
      const mx = Math.max(r, g, b)
      const mn = Math.min(r, g, b)
      const sat = mx - mn
      const lum = 0.299 * r + 0.587 * g + 0.114 * b

      if (sat >= 34 && mx >= 80) {
        if (g > r + 24 && g >= b + 8) votes.Uncommon++
        else if (b > r + 30 && g >= r - 12) votes.Rare++
        else if (r > g + 24 && b > g + 14) votes.Epic++
        else if (r > 140 && g > 95 && b < g - 25) votes.Legendary++
      } else if (
        !hovered &&
        sat < 28 &&
        lum >= 90 &&
        lum <= 212 &&
        lum - topBgLum >= 30
      ) {
        greyWedgePx++
      }
    }
  }

  let bestColRarity = null
  let bestColVotes = 0
  for (const [k, cnt] of Object.entries(votes)) {
    if (cnt > bestColVotes) {
      bestColVotes = cnt
      bestColRarity = k
    }
  }

  const minColVotes = Math.max(3, Math.round(wedgeTotal * 0.14))
  const hasColoredWedge = bestColVotes >= minColVotes
  const occupied = hasFooterBadge || hasColoredWedge

  if (!occupied) {
    return { occupied: false, rarity: null, rarityConfident: false, hovered }
  }

  let rarity = null
  let rarityConfident = false
  if (hasColoredWedge) {
    rarity = bestColRarity
    rarityConfident = true
  } else if (hasFooterBadge) {
    rarity = 'Common'
    rarityConfident =
      !hovered && greyWedgePx >= Math.max(3, Math.round(wedgeTotal * 0.12))
  }

  return {
    occupied: true,
    rarity,
    rarityConfident,
    hovered,
    topBgLum,
  }
}

/**
 * 亚像素采样槽位内 UMG 图标框，并拟合四角双线性底板背景平面与有向梯度场
 */
function sampleIconBoxBilerp(imageData, frect, boxType, outW, outH) {
  const { data, width: W, height: H } = imageData
  const spec = ICON_BOX_SPECS[boxType]
  const bw = frect.w * spec.wf
  const bh = frect.h * spec.hf
  const x0 = frect.x + frect.w * spec.cx - bw * 0.5
  const y0 = frect.y + frect.h * spec.cy - bh * 0.5

  const len = outW * outH
  const obsR = new Float32Array(len)
  const obsG = new Float32Array(len)
  const obsB = new Float32Array(len)
  const obsLum = new Float32Array(len)
  const valid = new Float32Array(len)
  const rgb = [0, 0, 0]

  const isTileLike =
    boxType === 'tile' ||
    boxType === 'weaponTileTight' ||
    boxType === 'weaponTileWide'
  const isMod = boxType === 'modBox'

  for (let j = 0; j < outH; j++) {
    const fy = y0 + ((j + 0.5) * bh) / outH
    const relYCard = (fy - frect.y) / Math.max(1, frect.h)
    for (let i = 0; i < outW; i++) {
      const fx = x0 + ((i + 0.5) * bw) / outW
      const relXCard = (fx - frect.x) / Math.max(1, frect.w)
      const idx = j * outW + i
      bilerpRgb(data, W, H, fx, fy, rgb)
      obsR[idx] = rgb[0]
      obsG[idx] = rgb[1]
      obsB[idx] = rgb[2]
      obsLum[idx] = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]

      // 屏蔽左下角品质三角角标区域，防止角标边缘干扰图标轮廓
      if (isTileLike && relXCard < 0.27 && relYCard - relXCard > 0.43) {
        valid[idx] = 0
      } else if (isMod && relXCard < 0.35 && relYCard - relXCard > 0.44) {
        valid[idx] = 0
      } else {
        valid[idx] = 1
      }
    }
  }

  const cornerMedianRgb = (xStart, xEnd, yStart, yEnd) => {
    const rs = []
    const gs = []
    const bs = []
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const k = y * outW + x
        rs.push(obsR[k])
        gs.push(obsG[k])
        bs.push(obsB[k])
      }
    }
    return [medianOf(rs), medianOf(gs), medianOf(bs)]
  }

  const cxSpan = Math.min(4, Math.max(2, Math.round(outW * 0.14)))
  const cySpan = Math.min(3, Math.max(2, Math.round(outH * 0.13)))
  const tl = cornerMedianRgb(0, cxSpan, 0, cySpan)
  const tr = cornerMedianRgb(outW - cxSpan, outW, 0, cySpan)
  const br = cornerMedianRgb(outW - cxSpan, outW, outH - cySpan, outH)
  // 左下背景取角标正上方的左侧边缘，避免采样到品质色块本身
  const mlY0 = Math.max(0, Math.floor(outH * 0.45))
  const mlY1 = Math.max(mlY0 + 2, Math.floor(outH * 0.62))
  const bl = cornerMedianRgb(0, Math.min(3, cxSpan), mlY0, mlY1)

  const bgR = new Float32Array(len)
  const bgG = new Float32Array(len)
  const bgB = new Float32Array(len)
  for (let j = 0; j < outH; j++) {
    const v = outH > 1 ? j / (outH - 1) : 0
    for (let i = 0; i < outW; i++) {
      const u = outW > 1 ? i / (outW - 1) : 0
      const w00 = (1 - u) * (1 - v)
      const w10 = u * (1 - v)
      const w01 = (1 - u) * v
      const w11 = u * v
      const idx = j * outW + i
      bgR[idx] = w00 * tl[0] + w10 * tr[0] + w01 * bl[0] + w11 * br[0]
      bgG[idx] = w00 * tl[1] + w10 * tr[1] + w01 * bl[1] + w11 * br[1]
      bgB[idx] = w00 * tl[2] + w10 * tr[2] + w01 * bl[2] + w11 * br[2]
    }
  }

  const gx = new Float32Array(len)
  const gy = new Float32Array(len)
  const validGrad = new Float32Array(len)
  for (let j = 1; j < outH - 1; j++) {
    for (let i = 1; i < outW - 1; i++) {
      const idx = j * outW + i
      gx[idx] = obsLum[idx + 1] - obsLum[idx - 1]
      gy[idx] = obsLum[idx + outW] - obsLum[idx - outW]
      validGrad[idx] =
        valid[idx] *
        valid[idx + 1] *
        valid[idx - 1] *
        valid[idx + outW] *
        valid[idx - outW]
    }
  }

  return {
    w: outW,
    h: outH,
    obsR,
    obsG,
    obsB,
    obsLum,
    bgR,
    bgG,
    bgB,
    gx,
    gy,
    valid,
    validGrad,
  }
}

/**
 * 计算模板在当前实机槽位背景平面上 Alpha 合成后的 RGB NCC + 有向梯度 NCC + 品质匹配分
 */
function scoreTemplateAgainstObs(obs, cardState, tpl) {
  const { w, h, obsR, obsG, obsB, bgR, bgG, bgB, gx, gy, valid, validGrad } = obs
  const len = w * h
  const synR = new Float32Array(len)
  const synG = new Float32Array(len)
  const synB = new Float32Array(len)
  const synLum = new Float32Array(len)

  let validCount = 0
  let sumObs = 0
  let sumSyn = 0

  for (let i = 0; i < len; i++) {
    const a = tpl.a[i]
    const ia = 1 - a
    const sr = a * tpl.r[i] + ia * bgR[i]
    const sg = a * tpl.g[i] + ia * bgG[i]
    const sb = a * tpl.b[i] + ia * bgB[i]
    synR[i] = sr
    synG[i] = sg
    synB[i] = sb
    synLum[i] = 0.299 * sr + 0.587 * sg + 0.114 * sb

    if (valid[i] > 0) {
      validCount += 3
      sumObs += obsR[i] + obsG[i] + obsB[i]
      sumSyn += sr + sg + sb
    }
  }

  let sRgb = 0
  if (validCount >= 12) {
    const meanObs = sumObs / validCount
    const meanSyn = sumSyn / validCount
    let cov = 0
    let varObs = 0
    let varSyn = 0
    for (let i = 0; i < len; i++) {
      if (valid[i] <= 0) continue
      const dr0 = obsR[i] - meanObs
      const dr1 = synR[i] - meanSyn
      const dg0 = obsG[i] - meanObs
      const dg1 = synG[i] - meanSyn
      const db0 = obsB[i] - meanObs
      const db1 = synB[i] - meanSyn
      cov += dr0 * dr1 + dg0 * dg1 + db0 * db1
      varObs += dr0 * dr0 + dg0 * dg0 + db0 * db0
      varSyn += dr1 * dr1 + dg1 * dg1 + db1 * db1
    }
    const denom = Math.sqrt(varObs * varSyn)
    if (denom > 1e-5) sRgb = cov / denom
  }

  // 有向梯度 (gx, gy) 相关性（由于 synLum 叠加了同源背景，悬停反相卡或高亮光晕均保持同向极性）
  let gradCount = 0
  let sumGxO = 0
  let sumGxS = 0
  const synGx = new Float32Array(len)
  const synGy = new Float32Array(len)
  for (let j = 1; j < h - 1; j++) {
    for (let i = 1; i < w - 1; i++) {
      const idx = j * w + i
      if (validGrad[idx] <= 0) continue
      const sgx = synLum[idx + 1] - synLum[idx - 1]
      const sgy = synLum[idx + w] - synLum[idx - w]
      synGx[idx] = sgx
      synGy[idx] = sgy
      gradCount += 2
      sumGxO += gx[idx] + gy[idx]
      sumGxS += sgx + sgy
    }
  }

  let sGrad = 0
  if (gradCount >= 12) {
    const meanGO = sumGxO / gradCount
    const meanGS = sumGxS / gradCount
    let covG = 0
    let varGO = 0
    let varGS = 0
    for (let i = 0; i < len; i++) {
      if (validGrad[i] <= 0) continue
      const dx0 = gx[i] - meanGO
      const dx1 = synGx[i] - meanGS
      const dy0 = gy[i] - meanGO
      const dy1 = synGy[i] - meanGS
      covG += dx0 * dx1 + dy0 * dy1
      varGO += dx0 * dx0 + dy0 * dy0
      varGS += dx1 * dx1 + dy1 * dy1
    }
    const denomG = Math.sqrt(varGO * varGS)
    if (denomG > 1e-5) sGrad = covG / denomG
  }

  let score = sRgb * 0.56 + sGrad * 0.44
  const obsRar = cardState?.rarity
  const tplRar = tpl.meta?.rarity
  if (obsRar && tplRar) {
    if (obsRar === tplRar) {
      score += cardState.rarityConfident ? 0.14 : 0.07
    } else {
      score -= cardState.rarityConfident ? 0.12 : 0.04
    }
  }

  return score
}

function matchBestInSlot(
  imageData,
  frect,
  cardType,
  boxType,
  candidateMap,
  filterFn = null,
  minScore = 0.4,
) {
  const state = analyzeCardState(imageData, frect, cardType)
  if (!state.occupied) return null

  const isWp = boxType === 'weaponSlot'
  const obs = sampleIconBoxBilerp(
    imageData,
    frect,
    boxType,
    isWp ? WP_W : SQ_W,
    isWp ? WP_H : SQ_H,
  )

  let bestId = null
  let bestScore = -Infinity
  let bestMeta = null

  for (const [id, tpl] of candidateMap.entries()) {
    if (filterFn && !filterFn(tpl.meta)) continue
    const sc = scoreTemplateAgainstObs(obs, state, tpl)
    if (sc > bestScore) {
      bestScore = sc
      bestId = id
      bestMeta = tpl.meta
    }
  }

  if (!bestId || bestScore < minScore) return null
  return {
    id: bestId,
    score: +bestScore.toFixed(3),
    meta: bestMeta,
    state,
  }
}

/**
 * 识别武器底栏右侧罗马数字等级角标 (I ~ IV)
 * 采用 0.5px 归一化采样 + 卡片右侧选框隔离 + 内腰竖笔横跨宽度 (避开上下横衬线) 精准区分 I/II/III/IV
 */
function estimateWeaponTier(imageData, weaponRect1080, vp, maxTier = 4) {
  if (maxTier <= 1) return 1
  const { data, width: W, height: H } = imageData

  const dxStart = 268.0
  const dxStep = 0.5
  const Wr = 69 // 268.0 .. 302.0
  const dyStart = 166.0
  const dyStep = 0.5
  const Hr = 61 // 166.0 .. 196.0
  const raw = new Float32Array(Hr * Wr)

  for (let iy = 0; iy < Hr; iy++) {
    const py = vp.oy + (weaponRect1080.y + dyStart + iy * dyStep) * vp.scale
    const rowOff = iy * Wr
    for (let ix = 0; ix < Wr; ix++) {
      const px = vp.ox + (weaponRect1080.x + dxStart + ix * dxStep) * vp.scale
      raw[rowOff + ix] = bilerpLum(data, W, H, px, py)
    }
  }

  const quietVals = []
  for (let iy = 0; iy < Hr; iy++) {
    if (iy > 4 && iy < 56) continue
    const rowOff = iy * Wr
    for (let ix = 12; ix <= 53; ix++) {
      quietVals.push(raw[rowOff + ix])
    }
  }
  const bg = percentileOf(quietVals, 0.25)

  const coreVals = []
  for (let iy = 10; iy <= 50; iy++) {
    const rowOff = iy * Wr
    for (let ix = 16; ix <= 52; ix++) {
      coreVals.push(raw[rowOff + ix])
    }
  }
  const pk = percentileOf(coreVals, 0.985)
  const contrast = pk - bg
  if (contrast < 18) return 1

  const obs = new Float32Array(Hr * Wr)
  for (let i = 0; i < obs.length; i++) {
    obs[i] = clamp((raw[i] - bg) / contrast, 0, 1)
  }

  // 抑制右侧卡片边框/选中高亮白框，并在左右空隙处切断耐久度与边框残余
  for (let ix = 48; ix < Wr; ix++) {
    let topSum = 0
    let botSum = 0
    for (let iy = 0; iy <= 4; iy++) topSum += obs[iy * Wr + ix]
    for (let iy = 56; iy < Hr; iy++) botSum += obs[iy * Wr + ix]
    if (topSum / 5 > 0.22 && botSum / 5 > 0.22) {
      for (let iy = 0; iy < Hr; iy++) {
        obs[iy * Wr + ix] = 0
        if (ix - 1 >= 48) obs[iy * Wr + ix - 1] *= 0.25
      }
    }
  }

  for (let ix = 20; ix >= 0; ix--) {
    let colMax = 0
    for (let iy = 12; iy <= 47; iy++) {
      const v = obs[iy * Wr + ix]
      if (v > colMax) colMax = v
    }
    if (colMax < 0.16) {
      for (let k = 0; k <= ix; k++) {
        for (let iy = 0; iy < Hr; iy++) obs[iy * Wr + k] = 0
      }
      break
    }
  }

  for (let ix = 48; ix < Wr; ix++) {
    let colMax = 0
    for (let iy = 12; iy <= 47; iy++) {
      const v = obs[iy * Wr + ix]
      if (v > colMax) colMax = v
    }
    if (colMax < 0.16) {
      for (let k = ix; k < Wr; k++) {
        for (let iy = 0; iy < Hr; iy++) obs[iy * Wr + k] = 0
      }
      break
    }
  }

  let yTop = -1
  let yBot = -1
  let activeRowCount = 0
  for (let iy = 0; iy < Hr; iy++) {
    const rowOff = iy * Wr
    let rMax = 0
    for (let ix = 10; ix <= 57; ix++) {
      const v = obs[rowOff + ix]
      if (v > rMax) rMax = v
    }
    if (rMax >= 0.35) {
      if (yTop < 0) yTop = iy
      yBot = iy
      activeRowCount++
    }
  }
  if (activeRowCount < 16 || yTop < 0) return 1

  const gh = Math.max(20, yBot - yTop + 1)
  const s0 = Math.max(0, yTop + Math.round(gh * 0.25))
  const s1 = Math.min(Hr - 1, yTop + Math.round(gh * 0.75))
  let stemFirst = -1
  let stemLast = -1
  const colSlice = []
  for (let ix = 0; ix < Wr; ix++) {
    colSlice.length = 0
    for (let iy = s0; iy <= s1; iy++) colSlice.push(obs[iy * Wr + ix])
    if (percentileOf(colSlice, 0.8) >= 0.36) {
      if (stemFirst < 0) stemFirst = ix
      stemLast = ix
    }
  }
  if (stemFirst < 0) return 1

  const stemSpanPx = (stemLast - stemFirst + 1) * 0.5
  if (stemSpanPx < 7.4) return 1
  if (stemSpanPx < 13.3) return Math.min(maxTier, 2)

  // 区分 III 与 IV：IV 右侧 V 字形上宽下窄，上下 1/3 内收斜度明显
  const u0 = Math.max(0, yTop + Math.round(gh * 0.06))
  const u1 = Math.min(Hr - 1, yTop + Math.round(gh * 0.36))
  const l0 = Math.max(0, yTop + Math.round(gh * 0.64))
  const l1 = Math.min(Hr - 1, yTop + Math.round(gh * 0.94))

  const findBandBounds = (r0, r1) => {
    let first = -1
    let last = -1
    for (let ix = 0; ix < Wr; ix++) {
      colSlice.length = 0
      for (let iy = r0; iy <= r1; iy++) colSlice.push(obs[iy * Wr + ix])
      if (percentileOf(colSlice, 0.75) >= 0.34) {
        if (first < 0) first = ix
        last = ix
      }
    }
    return { first, last }
  }

  const ub = findBandBounds(u0, u1)
  const lb = findBandBounds(l0, l1)
  if (ub.first >= 0 && lb.first >= 0) {
    const uRight = ub.last * 0.5
    const lRight = lb.last * 0.5
    const uSpan = (ub.last - ub.first + 1) * 0.5
    const lSpan = (lb.last - lb.first + 1) * 0.5
    if (uRight - lRight >= 1.15 || uSpan - lSpan >= 1.4) {
      return Math.min(maxTier, 4)
    }
  }
  return Math.min(maxTier, 3)
}

const STACK_GLYPH_H = 25
const STACK_LEFT_PAD = 10
const STACK_RIGHT_PAD = 4
const STACK_GLYPHS_BARLOW_35 = {
  0: {
    adv: 19.88,
    lsb: 1,
    w: 18,
    b64: 'AABL7//9owAAABr//////pAAAb////////kACP///bvf//5gHP/+cAAI//+wXv/5AAAAv//TXv/mAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/lAAAAj//lXv/mAAAAj//lXv/5AAAAv//TDP/+cAAI//+wCP///bvf//5gAK////////kAABr//////oAAAABK7//9kgAAAAAAAAAAAAAA',
  },
  1: {
    adv: 12.35,
    lsb: 1,
    w: 10,
    b64: 'ACnv/9Qp7///1L/////Ur////9Sf2p//1DMAj//UAACP/9QAAI//1AAAj//UAACP/9QAAI//1AAAj//UAACP/9QAAI//1AAAj//UAACP/9QAAI//1AAAj//UAACP/9QAAI//1AAAj//UAACP/9QAAI//1AAAf//UAAAAAAA=',
  },
  2: {
    adv: 19.28,
    lsb: 1,
    w: 17,
    b64: 'AAF87//sUAAABd//////sgAG7///////wgLP//7K3///kH7/+yAAXf/9Of/+UAAAj//ln//SAAAF7/5Z//wAAACP/+UAAAAAABz//SAAAAAACP//kAAAAAAF7//TAAAAAALP//gAAAAAAs//+QAAAAABv//7EAAAAACf//wgAAAAAJ///UAAAAAAj//9UAAAAAB+//5gAAAAAG7//mAAAAAAbv//gAAAAABd///Kqqqqqnn//////////Z//////////2f/////////8AAAAAAAAAAAA',
  },
  3: {
    adv: 18.58,
    lsb: 1,
    w: 17,
    b64: 'n/////////sJ/////////7Cf////////+wWaqqqqr///sAAAAABd///UAAAAAF3//8MAAAAAbv//wwAAAABu///DAAAAAH7//8IAAAAAPf///+kgAAAAj/////1AAAAArqjP//wQAAAAAACf/+cAAAAAAALf/6AAAAAAAAr//QAAAAAAAJ//1M//sAAACf/9S//8AAAAr//Rr//lAAAt//wG7/+yABr//4Ac///rvv//0wBN///////mAABM/////+cAAAAXzv/9kgAAAAAAAAAAAAAA',
  },
  4: {
    adv: 20.47,
    lsb: 1,
    w: 18,
    b64: 'AAAAbv/4AAAAAAAAv//TAAAAAAAF7/+QAAAAAAAL//5AAAAAAABe//oAAAAAAACv/+UAAAAAAATv/7AAAAAAAAn//mAAAAAAAD3/+wAAAAAAAI//5gAL//wAAt//wQAL//0ACP//cAAL//0AHP/8IAAL//0Af//4AAAL//0Av//////////83//////////93//////////9iqqqqqqt//2oAAAAAAAL//0AAAAAAAAL//0AAAAAAAAL//0AAAAAAAAL//0AAAAAAAAL//0AAAAAAAAL//wAAAAAAAAAAAAA',
  },
  5: {
    adv: 18.55,
    lsb: 1,
    w: 17,
    b64: 'f/////////kI/////////5CP////////+Qj//qqqqqqpUI//1AAAAAAACP/9QAAAAAAAj//UAAAAAAAI//1AAAAAAACP/9Q4qoQAAAj//s////1gAI////////6ACP////////5gj///pAS///sI//+gAAG//9QlVVIAAAj//mAAAAAAAF7/+AAAAAAABe//h+7tUAAAbv/3bv/5AAAL//5S3//lAAfv/8EI///8rf//+AAb///////7EAAr//////oQAAAFvv/+tAAAAAAAAAAAAAAA',
  },
  6: {
    adv: 18.51,
    lsb: 1,
    w: 17,
    b64: 'AAKN7//rUAAABu//////sgAG7///////sQHP//7K3//+cG7//CAAj//6CP/+YAAAz//Aj//UAAAK7uwI//1AAAAAAACP/9QoqpUAAAj//a////1gAI////////+ACP////////5gj///tAXP//sI//+xAAHP/9SP/+YAAAj//mj//kAAAF7/+I//1AAABe//iP/+UAAAbv/mXv/4AAAK//5S3//VAAbv/8AI///srf//5wAb///////7EAAr//////oQAAAFzv/+tQAAAAAAAAAAAAAA',
  },
  7: {
    adv: 17.08,
    lsb: 0,
    w: 17,
    b64: 'fv////////+4//////////uP/////////7j//Kqqqq7/+o//kAAACP/+ZczGAAABz//SAAAAAABe//kAAAAAAAr//lAAAAAAA9//sAAAAAAAj//3AAAAAAAL//0wAAAAAAXv/6AAAAAAAJ//5QAAAAAALf/8EAAAAAAH//+AAAAAAAC//9QAAAAAAE7/+wAAAAAACf/+YAAAAAABz//SAAAAAABu//kAAAAAAAv//kAAAAAABO//sAAAAAAAj//3AAAAAAAM//0gAAAAAAAAAAAAAAAA',
  },
  8: {
    adv: 18.65,
    lsb: 1,
    w: 17,
    b64: 'AAB87//rUAAABM//////oQACz///////kACv//7K3//+YE7//DAAbv/6Bu/+YAAAr//Qf//lAAAJ//0F7/+QAAHP/7AL//6iBc//5wBe///////7EABe//////oQABv//////+cACf//7K3//+UE7//DAAbv/7CP/+YAAAr//Tn//TAAAH//5b//0AAABe/+Wv/9MAAAf//ln//mAAAK//5F7//DAAfv/7AL///srf//5wBN///////6AABN//////oQAAAXzv/+tAAAAAAAAAAAAAAA',
  },
  9: {
    adv: 18.44,
    lsb: 1,
    w: 16,
    b64: 'AAKd///ZIAAAbv/////mAAbv//////5gLf//673//9KP//oQAJ//+L//0gAALf/73/+wAAAK//zf/5AAAAn//d//oAAACv/9v//SAAAt//2f//oQAa///U7//+u+///9CP////////0An/////7//QAEvv/9ef/9AAAAAAAJ//0VVUAAAAn//X//5QAACf/9fv/3AAAM//1e//wwAI//+wv//+y9///nBe///////7EAXf/////6EAACje//60AAAAAAAAAAAAA=',
  },
  '×': {
    adv: 15.29,
    lsb: 1,
    w: 14,
    b64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoQAAAB0ACv9QAAJ/UC//9QAn//Un//9Sf//sgn//+///CAAn////8IAAAn///wgAAAJ///8MAAAn////8MACf//3//8MJ///Cn//8Kf/8IAn/+yCfwgAAn7IABSAAAAQgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
  },
}

let decodedStackGlyphs = null
const stackStringTplCache = new Map()

function getDecodedStackGlyphs() {
  if (decodedStackGlyphs) return decodedStackGlyphs
  decodedStackGlyphs = {}
  for (const [ch, spec] of Object.entries(STACK_GLYPHS_BARLOW_35)) {
    const binStr =
      typeof atob === 'function'
        ? atob(spec.b64)
        : Buffer.from(spec.b64, 'base64').toString('binary')
    const nPix = STACK_GLYPH_H * spec.w
    const arr = new Float32Array(nPix)
    for (let i = 0; i < nPix; i++) {
      const byte = binStr.charCodeAt(i >> 1) & 0xff
      const nib = (i & 1) === 0 ? byte >> 4 : byte & 0x0f
      arr[i] = nib / 15
    }
    decodedStackGlyphs[ch] = {
      adv: spec.adv,
      lsb: spec.lsb,
      w: spec.w,
      arr,
    }
  }
  return decodedStackGlyphs
}

function getStackStringTemplate(str, tracking, blur, leftPad = STACK_LEFT_PAD) {
  const key = `${str}|${tracking}|${blur ? 1 : 0}|${leftPad}`
  const hit = stackStringTplCache.get(key)
  if (hit) return hit

  const glyphs = getDecodedStackGlyphs()
  let pen = leftPad
  const draws = []
  let maxInkX = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    const g = glyphs[ch]
    if (!g) continue
    const gx = Math.round(pen + g.lsb)
    draws.push({ gx, g })
    if (gx + g.w > maxInkX) maxInkX = gx + g.w
    pen += g.adv + tracking + (ch === '×' && tracking > 0 ? 0.8 : 0)
  }

  const w = Math.max(1, maxInkX + STACK_RIGHT_PAD)
  const h = STACK_GLYPH_H
  let data = new Float32Array(h * w)
  for (const { gx, g } of draws) {
    for (let y = 0; y < h; y++) {
      const dstOff = y * w + gx
      const srcOff = y * g.w
      for (let x = 0; x < g.w; x++) {
        if (gx + x >= 0 && gx + x < w && g.arr[srcOff + x] > data[dstOff + x]) {
          data[dstOff + x] = g.arr[srcOff + x]
        }
      }
    }
  }

  if (blur) {
    const tmp = new Float32Array(h * w)
    const out = new Float32Array(h * w)
    for (let y = 0; y < h; y++) {
      const rowOff = y * w
      for (let x = 0; x < w; x++) {
        const l = x > 0 ? data[rowOff + x - 1] : 0
        const c = data[rowOff + x]
        const r = x + 1 < w ? data[rowOff + x + 1] : 0
        tmp[rowOff + x] = 0.25 * l + 0.5 * c + 0.25 * r
      }
    }
    let pk = 0
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = y > 0 ? tmp[(y - 1) * w + x] : 0
        const c = tmp[y * w + x]
        const b = y + 1 < h ? tmp[(y + 1) * w + x] : 0
        const v = 0.25 * t + 0.5 * c + 0.25 * b
        out[y * w + x] = v
        if (v > pk) pk = v
      }
    }
    if (pk > 0) {
      for (let i = 0; i < out.length; i++) out[i] /= pk
    }
    data = out
  }

  let sum = 0
  for (let i = 0; i < data.length; i++) sum += data[i]
  const mean = sum / data.length
  const zm = new Float32Array(data.length)
  let normSq = 0
  for (let i = 0; i < data.length; i++) {
    const d = data[i] - mean
    zm[i] = d
    normSq += d * d
  }
  const tpl = {
    w,
    h,
    data,
    zm,
    norm: Math.sqrt(normSq) + 1e-6,
  }
  stackStringTplCache.set(key, tpl)
  return tpl
}

function scoreStackTemplateInObs(obs, Wp, y0, x1, tpl) {
  const Wt = tpl.w
  const Ht = tpl.h
  const x0 = x1 - Wt
  if (x0 < 0 || x1 > Wp || y0 < 0) return -Infinity
  const n = Wt * Ht

  let winSum = 0
  for (let y = 0; y < Ht; y++) {
    const oOff = (y0 + y) * Wp + x0
    for (let x = 0; x < Wt; x++) winSum += obs[oOff + x]
  }
  const winMean = winSum / n

  let dot = 0
  let winSq = 0
  let mseSum = 0
  for (let y = 0; y < Ht; y++) {
    const oOff = (y0 + y) * Wp + x0
    const tOff = y * Wt
    for (let x = 0; x < Wt; x++) {
      const ov = obs[oOff + x]
      const wd = ov - winMean
      dot += tpl.zm[tOff + x] * wd
      winSq += wd * wd
      const err = tpl.data[tOff + x] - ov
      mseSum += err * err
    }
  }
  const zncc = dot / (tpl.norm * (Math.sqrt(winSq) + 1e-6))
  const mse = mseSum / n
  return zncc - 0.65 * mse
}

/**
 * 识别 96x96 物品格底栏右下角的堆叠数量 (×1 ~ ×500)
 * 基于 game 内 Barlow SemiBold 600 精确半像素字形模板滑动 ZNCC+MSE 联合匹配
 */
export function recognizeTileStackCount(imageData, tileRect1080, vp, maxStack = 1) {
  const cap = Math.max(1, Math.round(Number(maxStack) || 1))
  if (cap <= 1) return 1

  const { data, width: W, height: H } = imageData
  const dxStart = 28.0
  const dxStep = 0.5
  const Wp = 137 // 28.0 .. 96.0
  const dyStart = 71.0
  const dyStep = 0.5
  const Hp = 47 // 71.0 .. 94.0
  const raw = new Float32Array(Hp * Wp)

  for (let iy = 0; iy < Hp; iy++) {
    const py = vp.oy + (tileRect1080.y + dyStart + iy * dyStep) * vp.scale
    const rowOff = iy * Wp
    for (let ix = 0; ix < Wp; ix++) {
      const px = vp.ox + (tileRect1080.x + dxStart + ix * dxStep) * vp.scale
      raw[rowOff + ix] = bilerpLum(data, W, H, px, py)
    }
  }

  const normVals = []
  for (let iy = 6; iy < 40; iy++) {
    const rowOff = iy * Wp
    for (let ix = 32; ix < 126; ix++) normVals.push(raw[rowOff + ix])
  }
  const bg = percentileOf(normVals, 0.2)
  const pk = percentileOf(normVals, 0.992)
  const contrast = pk - bg
  if (contrast < 22) return cap

  const obs = new Float32Array(Hp * Wp)
  for (let i = 0; i < obs.length; i++) {
    obs[i] = clamp((raw[i] - bg) / contrast, 0, 1)
  }

  // 清除卡片右边框干扰 (dx >= 93.5 / ix >= 131 以及同时贯穿顶部和底部静区的亮竖线；避免误伤奶油悬停高亮顶边)
  for (let iy = 0; iy < Hp; iy++) {
    const rowOff = iy * Wp
    for (let ix = 131; ix < Wp; ix++) obs[rowOff + ix] = 0
  }
  for (let ix = 122; ix < 131; ix++) {
    let topSum = 0
    let botSum = 0
    for (let iy = 0; iy < 5; iy++) topSum += obs[iy * Wp + ix]
    for (let iy = Hp - 4; iy < Hp; iy++) botSum += obs[iy * Wp + ix]
    if (topSum / 5 > 0.22 && botSum / 4 > 0.22) {
      for (let iy = 0; iy < Hp; iy++) obs[iy * Wp + ix] = 0
    }
  }

  // 定位 25 半像素行高的文字基带 [bestY .. bestY + 24]
  const rowEnergy = new Float32Array(Hp)
  const rowSlice = []
  for (let iy = 0; iy < Hp; iy++) {
    rowSlice.length = 0
    const rowOff = iy * Wp
    for (let ix = 76; ix < 128; ix++) rowSlice.push(obs[rowOff + ix])
    rowEnergy[iy] = percentileOf(rowSlice, 0.92)
  }

  let bestY = 11
  let bestYE = -Infinity
  for (let y0 = 5; y0 <= Hp - 26; y0++) {
    let inner = 0
    for (let k = y0; k < y0 + STACK_GLYPH_H; k++) inner += rowEnergy[k]
    let outer = 0
    for (let k = Math.max(0, y0 - 3); k < y0; k++) outer += rowEnergy[k]
    for (let k = y0 + STACK_GLYPH_H; k < Math.min(Hp, y0 + STACK_GLYPH_H + 3); k++) {
      outer += rowEnergy[k]
    }
    const e = inner - 1.6 * outer
    if (e > bestYE) {
      bestYE = e
      bestY = y0
    }
  }

  // 查找最右侧笔画边界 xRight
  let xRight = -1
  for (let ix = 130; ix >= 75; ix--) {
    let colMax = 0
    let colSum = 0
    let prevMax = 0
    for (let iy = bestY; iy < bestY + STACK_GLYPH_H; iy++) {
      const v = obs[iy * Wp + ix]
      const vp1 = obs[iy * Wp + ix - 1]
      if (v > colMax) colMax = v
      if (vp1 > prevMax) prevMax = vp1
      colSum += v
    }
    if (colMax >= 0.36 && (prevMax >= 0.28 || colSum >= 2.2)) {
      xRight = ix
      break
    }
  }
  if (xRight < 74) return cap

  const useBlur = vp.scale < 0.72
  let cands
  if (cap <= 100) {
    cands = []
    for (let v = 1; v <= cap; v++) cands.push(v)
  } else {
    // 若最大堆叠 > 100（如 LightAmmo=500），先匹配末位数字前 3 名裁剪候选集
    const digitScores = []
    for (let d = 0; d <= 9; d++) {
      const dTpl = getStackStringTemplate(String(d), 0, useBlur, 0)
      let bestD = -Infinity
      for (let dxS = -1; dxS <= 1; dxS++) {
        const s = scoreStackTemplateInObs(
          obs,
          Wp,
          bestY,
          xRight + STACK_RIGHT_PAD + 1 + dxS,
          dTpl,
        )
        if (s > bestD) bestD = s
      }
      digitScores.push({ d, s: bestD })
    }
    digitScores.sort((a, b) => b.s - a.s)
    const topUnits = new Set(digitScores.slice(0, 3).map((x) => x.d))
    cands = []
    for (let v = 1; v <= cap; v++) {
      if (v <= 20 || topUnits.has(v % 10)) cands.push(v)
    }
  }

  let bestVal = cap
  let bestScore = -Infinity
  for (let ci = 0; ci < cands.length; ci++) {
    const val = cands[ci]
    const sStr = '×' + val
    const trackings = val >= 10 ? [0.0, 1.1] : [0.5]
    for (let ti = 0; ti < trackings.length; ti++) {
      const tpl = getStackStringTemplate(sStr, trackings[ti], useBlur)
      for (let dy = -1; dy <= 1; dy++) {
        const yy = bestY + dy
        if (yy < 0 || yy + STACK_GLYPH_H > Hp) continue
        for (let dxS = -2; dxS <= 2; dxS++) {
          const sc = scoreStackTemplateInObs(
            obs,
            Wp,
            yy,
            xRight + STACK_RIGHT_PAD + 1 + dxS,
            tpl,
          )
          if (sc > bestScore) {
            bestScore = sc
            bestVal = val
          }
        }
      }
    }
  }

  return bestScore >= 0.28 ? bestVal : cap
}

/* =========================================================================
   武器卡片「模组无关」特征识别（2026-11 版本起武器缩略图改为 BP_WeaponIconCapture 实时 3D 渲染，
   随配件/机位变化，静态贴图仅作辅助；身份主要由以下 UI 特征融合确定）
   ========================================================================= */

function sampleLumGrid(imageData, fx0, fy0, fw, fh, outW, outH, out) {
  const { data, width: W, height: H } = imageData
  for (let j = 0; j < outH; j++) {
    const fy = fy0 + ((j + 0.5) * fh) / outH
    for (let i = 0; i < outW; i++) {
      out[j * outW + i] = bilerpLum(data, W, H, fx0 + ((i + 0.5) * fw) / outW, fy)
    }
  }
  return out
}

function nccFloat(a, b, n) {
  let sa = 0
  let sb = 0
  for (let i = 0; i < n; i++) {
    sa += a[i]
    sb += b[i]
  }
  const ma = sa / n
  const mb = sb / n
  let cov = 0
  let va = 0
  let vb = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma
    const db = b[i] - mb
    cov += da * db
    va += da * da
    vb += db * db
  }
  const den = Math.sqrt(va * vb)
  return den > 1e-6 ? cov / den : 0
}

/**
 * 白色单色 UI 字形 (弹药类型 / 增强图标) 与指定 1080p 方框的 NCC 匹配，
 * 内置 ±1.5px 平移与 ±12% 缩放搜索吸收亚像素布局误差与 HALFTONE 缩放模糊。
 */
function scoreGlyphInBox(imageData, box1080, vp, tpl) {
  const n = tpl.w * tpl.h
  const obs = new Float32Array(n)
  let best = -1
  for (const s of [0.88, 1.0, 1.12]) {
    const bw = box1080.w * s
    const bh = box1080.h * s
    for (let dy = -1.5; dy <= 1.5; dy += 1.5) {
      for (let dx = -1.5; dx <= 1.5; dx += 1.5) {
        const cx = box1080.x + box1080.w * 0.5 + dx
        const cy = box1080.y + box1080.h * 0.5 + dy
        sampleLumGrid(
          imageData,
          vp.ox + (cx - bw * 0.5) * vp.scale,
          vp.oy + (cy - bh * 0.5) * vp.scale,
          bw * vp.scale,
          bh * vp.scale,
          tpl.w,
          tpl.h,
          obs,
        )
        const sc = nccFloat(obs, tpl.a, n)
        if (sc > best) best = sc
      }
    }
  }
  return best
}

function classifyGlyph(imageData, box1080, vp, tplMap, allowedKeys = null) {
  const { width: W, height: H } = imageData
  const fx = vp.ox + box1080.x * vp.scale
  const fy = vp.oy + box1080.y * vp.scale
  if (fx < 1 || fy < 1 || fx + box1080.w * vp.scale >= W - 1 || fy + box1080.h * vp.scale >= H - 1) {
    return { key: null, score: 0, margin: 0, confident: false }
  }
  let bestKey = null
  let best = -Infinity
  let second = -Infinity
  for (const [key, tpl] of tplMap.entries()) {
    if (allowedKeys && !allowedKeys.includes(key)) continue
    const sc = scoreGlyphInBox(imageData, box1080, vp, tpl)
    if (sc > best) {
      second = best
      best = sc
      bestKey = key
    } else if (sc > second) {
      second = sc
    }
  }
  const margin = Number.isFinite(second) ? best - second : best
  return {
    key: bestKey,
    score: +best.toFixed(3),
    margin: +margin.toFixed(3),
    confident: best >= 0.55 && margin >= 0.07,
  }
}

function offsetRect(base1080, sub) {
  return { x: base1080.x + sub.x, y: base1080.y + sub.y, w: sub.w, h: sub.h }
}

/**
 * 计算武器卡片配件行在给定假设 (n 个配件格, 是否增强型) 下的各格 1080p 位置
 */
function weaponModRowBoxes(cardRect1080, n, asc) {
  const C = WEAPON_CARD
  const modsW = n > 0 ? n * C.modBox + (n - 1) * C.modGap : 0
  const containerW = n > 0 ? modsW + C.modPad * 2 : 0
  const totalW = containerW + (asc ? C.upgradeBox : 0)
  const left = cardRect1080.x + (C.w - totalW) * 0.5
  const mods = []
  for (let i = 0; i < n; i++) {
    mods.push({
      x: left + C.modPad + i * (C.modBox + C.modGap),
      y: cardRect1080.y + C.modRowCenterY - C.modBox * 0.5,
      w: C.modBox,
      h: C.modBox,
    })
  }
  const upgrade = asc
    ? {
        x: left + containerW,
        y: cardRect1080.y + C.modRowCenterY - C.upgradeBox * 0.5,
        w: C.upgradeBox,
        h: C.upgradeBox,
      }
    : null
  return { mods, upgrade }
}

/**
 * 检测武器卡片配件行布局：配件格数量 n (0~4) 与是否存在增强槽 (增强型武器)。
 * 沿配件格上下描边带提取 1D 描边强度剖面，与各假设的格子占位指示函数做皮尔逊相关。
 */
function detectWeaponModLayout(imageData, cardRect1080, vp) {
  const { data, width: W, height: H } = imageData
  const x0 = cardRect1080.x + 28
  const x1 = cardRect1080.x + WEAPON_CARD.w - 28
  const step = 1
  const cy = cardRect1080.y + WEAPON_CARD.modRowCenterY
  const xs = []
  const prof = []
  const lum = (x, y) => bilerpLum(data, W, H, vp.ox + x * vp.scale, vp.oy + y * vp.scale)
  for (let x = x0; x <= x1; x += step) {
    // 上描边 (y≈115/114) 与下描边 (y≈153/154) 相对外侧 4px 背景的亮度增量
    const topEdge = Math.max(lum(x, cy - 19.4), lum(x, cy - 18.6), lum(x, cy - 20.2))
    const topOut = lum(x, cy - 24)
    const botEdge = Math.max(lum(x, cy + 18.6), lum(x, cy + 19.4), lum(x, cy + 20.2))
    const botOut = lum(x, cy + 24)
    // 格子内部背板与外部背景的差异（Backplate 为 Secondary 色）
    const inner = lum(x, cy - 12) + lum(x, cy + 12)
    const outer = topOut + botOut
    xs.push(x)
    prof.push(
      Math.max(0, topEdge - topOut) + Math.max(0, botEdge - botOut) + 0.35 * (inner - outer),
    )
  }

  const table = {}
  let bestAll = { n: 0, asc: false, corr: -1 }
  for (const asc of [false, true]) {
    for (let n = 0; n <= 4; n++) {
      if (n === 0 && !asc) continue
      const { mods, upgrade } = weaponModRowBoxes(cardRect1080, n, asc)
      const boxes = upgrade ? [...mods, upgrade] : mods
      const ind = []
      const val = []
      for (let k = 0; k < xs.length; k++) {
        const x = xs[k]
        let inside = 0
        let dontCare = false
        for (const b of boxes) {
          if (x >= b.x + 7 && x <= b.x + b.w - 7) inside = 1
          else if (x >= b.x - 2 && x <= b.x + b.w + 2) dontCare = true
        }
        if (!inside && dontCare) continue
        ind.push(inside)
        val.push(prof[k])
      }
      const c = nccFloat(ind, val, ind.length)
      table[`${n}|${asc}`] = c
      if (c > bestAll.corr) bestAll = { n, asc, corr: c }
    }
  }

  // 无配件格且无增强槽的武器（如木星 / 制裁者）：整行剖面平坦
  let meanProf = 0
  for (const v of prof) meanProf += v
  meanProf /= Math.max(1, prof.length)
  const flat = meanProf < 4
  if (flat) {
    for (const k of Object.keys(table)) table[k] = Math.min(table[k], 0.2)
    table['0|false'] = 0.9
  } else {
    table['0|false'] = Math.max(0, 0.6 - meanProf / 40)
  }
  let best = { n: 0, asc: false, corr: -1 }
  for (const [k, c] of Object.entries(table)) {
    if (c > best.corr) {
      const [nStr, aStr] = k.split('|')
      best = { n: Number(nStr), asc: aStr === 'true', corr: c }
    }
  }
  return {
    n: best.n,
    asc: best.asc,
    corr: +best.corr.toFixed(3),
    flat,
    table,
    confident: best.corr >= 0.45,
  }
}

function possibleVisibleModCounts(weaponMeta, variant) {
  const nSlots = (weaponMeta?.modSlots || []).length
  if (variant !== 'asc') return [nSlots]
  const amps = weaponVisuals.weapons?.[weaponMeta.id]?.ascended?.amps || {}
  const counts = new Set([nSlots])
  const union = new Set()
  for (const a of Object.values(amps)) {
    const rm = a.removesSlotPositions || []
    if (rm.length) counts.add(Math.max(0, nSlots - rm.length))
    rm.forEach((p) => union.add(p))
  }
  counts.add(Math.max(0, nSlots - union.size))
  return [...counts]
}

/**
 * 识别增强型武器增强槽内的 24px 增强图标，返回对应 app 增强 id 列表
 */
function recognizeAscendedUpgrade(imageData, upgradeBox1080, vp, weaponMeta, db) {
  const asc = weaponVisuals.weapons?.[weaponMeta?.id]?.ascended
  if (!asc || !upgradeBox1080 || !db.ampIcons?.size) return { ampIds: [], iconKey: null }
  const iconToAmp = new Map()
  for (const [ampId, spec] of Object.entries(asc.amps || {})) {
    if (spec.icon && !iconToAmp.has(spec.icon)) iconToAmp.set(spec.icon, ampId)
  }
  const allowed = [...iconToAmp.keys(), asc.ascensionIcon || 'T_UI_Icon_Upgrade_Amplified']
  const inset = (WEAPON_CARD.upgradeBox - WEAPON_CARD.upgradeIcon) * 0.5
  const iconBox = {
    x: upgradeBox1080.x + inset,
    y: upgradeBox1080.y + inset,
    w: WEAPON_CARD.upgradeIcon,
    h: WEAPON_CARD.upgradeIcon,
  }
  const res = classifyGlyph(imageData, iconBox, vp, db.ampIcons, allowed)
  if (!res.key || res.score < 0.5) return { ampIds: [], iconKey: null, score: res.score }
  const ampId = iconToAmp.get(res.key)
  return { ampIds: ampId ? [ampId] : [], iconKey: res.key, score: res.score }
}

/**
 * 融合识别武器卡片：弹药类型图标 + 配件格数量 + 增强槽 + 品质角标 + 静态贴图辅助匹配
 * @returns {null | { occupied, identified, weaponId, amplified, score, margin, ammo, layout, state }}
 */
export async function inspectWeaponCard(imageData, viewport, rect1080p) {
  if (!imageData || !viewport || !rect1080p) return null
  const db = await ensureLoadoutTemplates()
  const res = identifyWeaponCard(imageData, rect1080p, viewport, db)
  if (!res) return null
  const { meta, state, ...rest } = res
  return { ...rest, rarity: state?.rarity || null }
}

function identifyWeaponCard(imageData, cardRect1080, vp, db) {
  const frect = mapRectFloat(cardRect1080, vp)
  const { width: W, height: H } = imageData
  if (frect.x < 1 || frect.y < 1 || frect.x + frect.w >= W - 1 || frect.y + frect.h >= H - 1) {
    return null
  }
  const state = analyzeCardState(imageData, frect, 'weaponSlot')
  if (!state.occupied) return { occupied: false, identified: false, state }

  const ammo = db.ammo?.size
    ? classifyGlyph(imageData, offsetRect(cardRect1080, WEAPON_CARD.typeIcon), vp, db.ammo)
    : { key: null, confident: false }
  const layout = detectWeaponModLayout(imageData, cardRect1080, vp)
  const obs = sampleIconBoxBilerp(imageData, frect, 'weaponSlot', WP_W, WP_H)

  // 增强槽字形证据：在各增强布局假设的增强槽位置检测增强图标（按布局相关度取最可信位置）
  const ascGlyphAt = new Map()
  const ascGlyphScore = (w, n) => {
    const key = `${w.id}|${n}`
    if (ascGlyphAt.has(key)) return ascGlyphAt.get(key)
    const { upgrade } = weaponModRowBoxes(cardRect1080, n, true)
    const r = recognizeAscendedUpgrade(imageData, upgrade, vp, w, db)
    const sc = r.score ?? (r.iconKey ? 0.6 : 0)
    ascGlyphAt.set(key, sc)
    return sc
  }

  const scored = []
  for (const w of weaponsData.weapons || []) {
    const nSlots = (w.modSlots || []).length
    for (const variant of ['base', 'asc']) {
      const tpl =
        db.weaponVariants?.get(`${w.id}|${variant}|big`) ||
        (variant === 'base' ? db.weapons.get(w.id) : null)
      if (!tpl) continue
      const thumb = scoreTemplateAgainstObs(obs, state, tpl)
      let s = thumb
      if (ammo.key) {
        if (ammo.confident) s += ammo.key === w.ammo ? 0.3 : -0.45
        else s += ammo.key === w.ammo ? 0.08 : -0.04
      }

      // 布局拟合：候选武器(版本)允许的配件格布局中相关度最高者，相对全局最优布局的差距计罚
      const allowedN = variant === 'asc' ? possibleVisibleModCounts(w, 'asc') : [nSlots]
      let fitN = allowedN[0]
      let fit = -1
      for (const n of allowedN) {
        const c = layout.table?.[`${n}|${variant === 'asc'}`] ?? -1
        if (c > fit) {
          fit = c
          fitN = n
        }
      }
      if (layout.corr >= 0.3) s += 0.6 * Math.min(0, fit - layout.corr) + (fit >= 0.6 ? 0.08 : 0)

      if (variant === 'asc') {
        const g = ascGlyphScore(w, fitN)
        s += g >= 0.55 ? 0.15 : g < 0.35 ? -0.2 : 0
      }
      scored.push({ w, variant, s, thumb, fitN, fit })
    }
  }
  scored.sort((a, b) => b.s - a.s)
  const top = scored[0]
  if (!top) return { occupied: true, identified: false, state, ammo, layout }
  // 同一武器的另一变体不计入「竞品差距」
  const rival = scored.find((x) => x.w.id !== top.w.id)
  const margin = rival ? top.s - rival.s : top.s
  const resolvedLayout = {
    n: top.fitN,
    asc: top.variant === 'asc',
    corr: +top.fit.toFixed(3),
    confident: top.fit >= 0.45,
  }

  if (top.s < 0.45) {
    return {
      occupied: true,
      identified: false,
      state,
      ammo,
      layout: resolvedLayout,
      score: +top.s.toFixed(3),
    }
  }
  return {
    occupied: true,
    identified: true,
    weaponId: top.w.id,
    meta: top.w,
    amplified: top.variant === 'asc',
    score: +top.s.toFixed(3),
    thumb: +top.thumb.toFixed(3),
    margin: +margin.toFixed(3),
    ammo,
    layout: resolvedLayout,
    state,
  }
}

/**
 * 根据增强/配件格数量推断当前可见的配件槽位键序列（增强可移除指定位置的配件槽）
 */
function resolveVisibleModSlotKeys(weaponMeta, amplified, visibleCount, ampIds = []) {
  const slots = weaponMeta?.modSlots || []
  if (!amplified || visibleCount >= slots.length) return slots.slice(0, visibleCount)
  const amps = weaponVisuals.weapons?.[weaponMeta.id]?.ascended?.amps || {}
  const removed = new Set()
  for (const id of ampIds) (amps[id]?.removesSlotPositions || []).forEach((p) => removed.add(p))
  if (slots.length - removed.size !== visibleCount) {
    removed.clear()
    for (const a of Object.values(amps)) {
      const rm = a.removesSlotPositions || []
      if (rm.length && slots.length - rm.length === visibleCount) {
        rm.forEach((p) => removed.add(p))
        break
      }
    }
  }
  const keys = slots.filter((_, idx) => !removed.has(idx))
  return keys.slice(0, visibleCount)
}

function inferAmpIdsFromRemovedSlots(weaponMeta, visibleCount) {
  const slots = weaponMeta?.modSlots || []
  const amps = weaponVisuals.weapons?.[weaponMeta?.id]?.ascended?.amps || {}
  const missing = slots.length - visibleCount
  if (missing <= 0) return []
  const cands = Object.entries(amps).filter(
    ([, a]) => (a.removesSlotPositions || []).length === missing,
  )
  return cands.length === 1 ? [cands[0][0]] : []
}

/**
 * 识别武器卡片中部已装配的配件槽位 (38x38 @ 1080p, 居中排列在 y+115；增强型武器整体左移 20px)
 */
function recognizeEquippedWeaponMods(
  imageData,
  weaponRect1080,
  vp,
  weaponMeta,
  modMap,
  layoutOverride = null,
) {
  const allSlots = weaponMeta?.modSlots || []
  if (!allSlots.length || !modMap?.size) return {}

  const { data, width: W, height: H } = imageData
  const slots = layoutOverride?.slotKeys || allSlots
  const n = slots.length
  const boxes = weaponModRowBoxes(weaponRect1080, n, Boolean(layoutOverride?.amplified)).mods
  const rgb = [0, 0, 0]
  const mods = {}

  for (let idx = 0; idx < n; idx++) {
    const slotKey = slots[idx]
    const allowedSlots = MOD_SLOT_NORMALIZATION[slotKey] || [slotKey]
    const box1080 = boxes[idx]
    const frect = mapRectFloat(box1080, vp)
    if (frect.x < 1 || frect.y < 1 || frect.x + frect.w >= W - 1 || frect.y + frect.h >= H - 1) {
      continue
    }

    const obs = sampleIconBoxBilerp(imageData, frect, 'modBox', MOD_W, MOD_H)

    // 采样小格右上深色背景基准亮度，用于识别灰底 Common 品质角标 (#a4a5aa)
    const bgSamples = []
    for (let by = 4; by <= 12; by += 4) {
      for (let bx = 22; bx <= 34; bx += 4) {
        bgSamples.push(
          bilerpLum(
            data,
            W,
            H,
            vp.ox + (box1080.x + bx) * vp.scale,
            vp.oy + (box1080.y + by) * vp.scale,
          ),
        )
      }
    }
    const modBgLum = medianOf(bgSamples)

    // 检测配件小格左下品质色标与高亮金属峰值（未装配占位灰标峰值 ~96-112 且无品质角标）
    const votes = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 }
    for (let wy = 24; wy <= 36; wy += 2) {
      for (let wx = 1; wx <= 12; wx += 2) {
        if ((wy - 24) / 12 - wx / 12 < 0) continue
        bilerpRgb(
          data,
          W,
          H,
          vp.ox + (box1080.x + wx) * vp.scale,
          vp.oy + (box1080.y + wy) * vp.scale,
          rgb,
        )
        const r = rgb[0]
        const g = rgb[1]
        const b = rgb[2]
        const lum = 0.299 * r + 0.587 * g + 0.114 * b
        const mx = Math.max(r, g, b)
        const sat = mx - Math.min(r, g, b)
        if (sat >= 24 && mx >= 64) {
          if (g > r + 18 && g >= b + 5) votes.Uncommon++
          else if (b > r + 22 && g >= r - 10) votes.Rare++
          else if (r > g + 18 && b > g + 12) votes.Epic++
          else if (r > 125 && g > 85 && b < g - 20) votes.Legendary++
        } else if (sat <= 20 && lum >= 82 && lum - modBgLum >= 44) {
          votes.Common++
        }
      }
    }

    let modRarity = null
    let bestCnt = 0
    for (const [k, cnt] of Object.entries(votes)) {
      if (cnt > bestCnt) {
        bestCnt = cnt
        modRarity = k
      }
    }
    if (bestCnt < 2) modRarity = null

    let peakLum = 0
    for (let k = 0; k < obs.obsLum.length; k++) {
      if (obs.obsLum[k] > peakLum) peakLum = obs.obsLum[k]
    }

    const modOccupied = modRarity !== null || peakLum >= 140
    if (!modOccupied) continue

    const modState = {
      occupied: true,
      rarity: modRarity,
      rarityConfident: modRarity !== null,
    }
    let bestModId = null
    let bestModScore = -Infinity
    for (const [mId, tpl] of modMap.entries()) {
      if (!allowedSlots.includes(tpl.meta.slot)) continue
      const sc = scoreTemplateAgainstObs(obs, modState, tpl)
      if (sc > bestModScore) {
        bestModScore = sc
        bestModId = mId
      }
    }

    if (bestModId && bestModScore >= 0.46) {
      mods[slotKey] = bestModId
    }
  }

  return mods
}

/**
 * 从 ImageData 完整识别游戏内当前「战备」配装
 */
export async function recognizeLoadoutFromImageData(imageData) {
  const loc = locateLoadoutViewport(imageData)
  if (!loc.ok) return loc

  const vp = loc.viewport
  const db = await ensureLoadoutTemplates()

  const slotConfidences = {}

  // 1. 识别强化 (Augment)
  const augMatch = matchBestInSlot(
    imageData,
    mapRectFloat(UMG_RECTS_1080P.augment, vp),
    'gear',
    'gear',
    db.augments,
  )
  const augmentId = augMatch ? augMatch.id : 'none'
  const activeAugment =
    loadoutData.augments.find((a) => a.id === augmentId) || loadoutData.augments[0]
  if (augMatch) slotConfidences.augment = augMatch.score

  // 2. 识别护盾 (Shield)
  const shFrect = mapRectFloat(UMG_RECTS_1080P.shield, vp)
  const shMatch =
    matchBestInSlot(imageData, shFrect, 'gear', 'gear', db.shields, (sh) =>
      activeAugment.allowedShields.includes(sh.id),
    ) || matchBestInSlot(imageData, shFrect, 'gear', 'gear', db.shields)
  const shieldId = shMatch ? shMatch.id : null
  if (shMatch) slotConfidences.shield = shMatch.score

  // 3. 识别主副武器 (Weapon 1 & Weapon 2)：弹药图标 + 配件格布局 + 增强槽 + 品质融合判定，再识别等级/配件/增强
  const weapons = [null, null]
  const weaponSlotStates = [null, null]
  const wpRects1080 = [UMG_RECTS_1080P.weapon1, UMG_RECTS_1080P.weapon2]
  for (let i = 0; i < 2; i++) {
    const wRect1080 = wpRects1080[i]
    const wid = identifyWeaponCard(imageData, wRect1080, vp, db)
    weaponSlotStates[i] = {
      occupied: Boolean(wid?.occupied),
      identified: Boolean(wid?.identified),
      score: wid?.score ?? 0,
    }
    if (wid?.identified) {
      const wMeta = wid.meta
      const maxTier = wMeta.tiers?.[wMeta.tiers.length - 1]?.tier || 1
      let ampIds = []
      let slotKeys = wMeta.modSlots || []
      if (wid.amplified) {
        const { upgrade } = weaponModRowBoxes(wRect1080, wid.layout.n, true)
        ampIds = recognizeAscendedUpgrade(imageData, upgrade, vp, wMeta, db).ampIds
        if (!ampIds.length) ampIds = inferAmpIdsFromRemovedSlots(wMeta, wid.layout.n)
        slotKeys = resolveVisibleModSlotKeys(wMeta, true, wid.layout.n, ampIds)
      }
      const tier = wid.amplified ? maxTier : estimateWeaponTier(imageData, wRect1080, vp, maxTier)
      const mods = recognizeEquippedWeaponMods(imageData, wRect1080, vp, wMeta, db.mods, {
        amplified: wid.amplified,
        slotKeys,
      })
      weapons[i] = {
        weaponId: wMeta.id,
        tier,
        ampIds,
        amplified: wid.amplified,
        mods,
      }
      slotConfidences[`weapon${i + 1}`] = wid.score
    }
  }

  // 4. 识别背包栏位 (Backpack)
  const bpCount = activeAugment.backpackSlots || 10
  const backpack = Array.from({ length: 24 }, () => null)
  for (let i = 0; i < bpCount; i++) {
    const bFrect = mapRectFloat(UMG_RECTS_1080P.backpack[i], vp)
    if (bFrect.y + bFrect.h >= imageData.height - 2) continue
    const bMatch = matchBestInSlot(
      imageData,
      bFrect,
      'tile',
      'tile',
      db.items,
    )
    if (bMatch) {
      backpack[i] = {
        itemId: bMatch.id,
        count: recognizeTileStackCount(
          imageData,
          UMG_RECTS_1080P.backpack[i],
          vp,
          bMatch.meta.maxStack || 1,
        ),
      }
      slotConfidences[`backpack${i}`] = bMatch.score
    }
  }

  // 5. 识别快速使用栏位 (Quick Use 4 ~ 6 格)
  const quAllowed = new Set(['medical', 'throwable', 'deployable', 'gadget'])
  const quCount = activeAugment.quickUseSlots || 4
  const quickUse = [null, null, null, null, null, null]
  for (let i = 0; i < quCount && i < UMG_RECTS_1080P.quickUse.length; i++) {
    const qFrect = mapRectFloat(UMG_RECTS_1080P.quickUse[i], vp)
    const qMatch = matchBestInSlot(
      imageData,
      qFrect,
      'tile',
      'tile',
      db.items,
      (it) => quAllowed.has(it.category),
    )
    if (qMatch) {
      quickUse[i] = {
        itemId: qMatch.id,
        count: recognizeTileStackCount(
          imageData,
          UMG_RECTS_1080P.quickUse[i],
          vp,
          qMatch.meta.maxStack || 1,
        ),
      }
      slotConfidences[`quickUse${i}`] = qMatch.score
    }
  }

  // 6. 识别强化专属栏位 (Aux Slots)
  const auxSpec = activeAugment.auxSlots
  const hasAuxRow = Boolean(activeAugment.integratedItem || auxSpec?.count)
  const aux = [null, null, null]
  if (auxSpec?.count) {
    const integratedOffset = activeAugment.integratedItem ? 1 : 0
    for (let i = 0; i < auxSpec.count; i++) {
      const rectIdx = Math.min(2, i + integratedOffset)
      const aFrect = mapRectFloat(UMG_RECTS_1080P.aux[rectIdx], vp)
      const aMatch = matchBestInSlot(
        imageData,
        aFrect,
        'tile',
        'tile',
        db.items,
        (it) => auxSpec.allowedCategories.includes(it.category),
      )
      if (aMatch) {
        aux[i] = {
          itemId: aMatch.id,
          count: recognizeTileStackCount(
            imageData,
            UMG_RECTS_1080P.aux[rectIdx],
            vp,
            aMatch.meta.maxStack || 1,
          ),
        }
        slotConfidences[`aux${i}`] = aMatch.score
      }
    }
  }

  // 7. 识别安全口袋栏位 (Safe Pocket)
  const spCount = activeAugment.safePocketSlots || 0
  const spRects = hasAuxRow
    ? UMG_RECTS_1080P.safePocketWithAux
    : UMG_RECTS_1080P.safePocketNoAux
  const safePocket = [null, null, null]
  for (let i = 0; i < spCount; i++) {
    const spFrect = mapRectFloat(spRects[i], vp)
    if (spFrect.y + spFrect.h >= imageData.height - 2) continue
    const spMatch = matchBestInSlot(
      imageData,
      spFrect,
      'tile',
      'tile',
      db.items,
    )
    if (spMatch) {
      safePocket[i] = {
        itemId: spMatch.id,
        count: recognizeTileStackCount(
          imageData,
          spRects[i],
          vp,
          spMatch.meta.maxStack || 1,
        ),
      }
      slotConfidences[`safePocket${i}`] = spMatch.score
    }
  }

  const recognizedCount =
    (augmentId !== 'none' ? 1 : 0) +
    (shieldId ? 1 : 0) +
    weapons.filter(Boolean).length +
    backpack.filter(Boolean).length +
    quickUse.filter(Boolean).length +
    aux.filter(Boolean).length +
    safePocket.filter(Boolean).length

  return {
    ok: true,
    viewport: vp,
    hasStashPanel: loc.hasStashPanel,
    recognizedCount,
    slotConfidences,
    weaponSlotStates,
    loadout: {
      augmentId,
      shieldId,
      weapons,
      backpack,
      quickUse,
      aux,
      safePocket,
    },
  }
}

/**
 * 自动检测左侧储备箱当前的垂直滚动相位，返回所有完整可见行的 1080p 起始 Y 坐标列表。
 * 储备箱实际裁剪区为 y1080 = 270..944 (可完整容纳 6 行并露出第 7 行上半部)。
 */
function detectStashRowOrigins1080p(imageData, viewport) {
  const { data, width: W, height: H } = imageData
  const grid = UMG_RECTS_1080P.stashGrid
  const defaultRows = Array.from(
    { length: grid.rows },
    (_, r) => grid.originY + r * grid.pitchY,
  )
  if (!viewport || viewport.scale <= 0) return defaultRows

  const lumAt1080 = (x1080, y1080) =>
    bilerpLum(
      data,
      W,
      H,
      viewport.ox + x1080 * viewport.scale,
      viewport.oy + y1080 * viewport.scale,
    )

  const sampleCols = [180, 220, 284, 324, 388, 428, 492, 532]
  let bestPhase = 0
  let bestPhaseScore = -Infinity

  for (let phase = 0; phase < grid.pitchY; phase += 1) {
    let acc = 0
    let samples = 0
    let darkCount = 0
    for (let k = -1; k <= grid.rows; k++) {
      const yTop = grid.originY + phase + k * grid.pitchY
      const yBot = yTop + grid.tileH
      if (yBot < 274 || yBot + 9.5 > grid.clipBottomY - 1) continue

      for (const cx of sampleCols) {
        // 真实行间 8px 暗缝 [yBot .. yBot + 8] 全宽均为深色底板，上下两侧紧贴 1px 卡片亮边框
        const gMid = Math.max(
          lumAt1080(cx, yBot + 2.5),
          lumAt1080(cx, yBot + 4.0),
          lumAt1080(cx, yBot + 5.5),
        )
        const bBot = Math.max(
          lumAt1080(cx, yBot - 0.5),
          lumAt1080(cx, yBot - 1.2),
        )
        const bNextTop = Math.max(
          lumAt1080(cx, yBot + 8.5),
          lumAt1080(cx, yBot + 9.2),
        )
        if (gMid < 36) {
          acc +=
            Math.min(42, Math.max(0, bBot - gMid)) * 0.55 +
            Math.min(42, Math.max(0, bNextTop - gMid)) * 0.45
          darkCount++
        } else {
          acc -= (gMid - 30) * 0.85
        }
        samples++
      }
    }
    if (samples > 0 && darkCount >= samples * 0.75) {
      const prior = phase <= 1 || phase >= grid.pitchY - 1 ? 1.2 : 0
      const avg = acc / samples + prior
      if (avg > bestPhaseScore) {
        bestPhaseScore = avg
        bestPhase = phase
      }
    }
  }

  const rows = []
  for (let k = -1; k <= grid.rows; k++) {
    const yTop = grid.originY + bestPhase + k * grid.pitchY
    if (yTop >= 266 && yTop + grid.tileH <= grid.clipBottomY + 2) {
      rows.push(yTop)
    }
  }
  return rows.length ? rows : defaultRows
}

/**
 * 储备箱武器格检索（实时 3D 渲染缩略图）：品质角标 + 底栏弹药徽章硬过滤，
 * 再以 small(储备格机位) / big(紧凑/宽幅) 多框静态贴图匹配，并对同弹药同品质的其他武器做竞品消歧；
 * opts.amplified = true / false 时仅接受增强型 / 普通版本。
 */
function findWeaponInStashGrid(imageData, viewport, targetId, db, opts = {}) {
  const wMeta = weaponMetaById.get(targetId)
  if (!wMeta) return null
  const { width: W, height: H } = imageData
  const grid = UMG_RECTS_1080P.stashGrid
  const rowOrigins = detectStashRowOrigins1080p(imageData, viewport)
  const wantVariants =
    opts.amplified === true ? ['asc'] : opts.amplified === false ? ['base'] : ['base', 'asc']

  const variantRarity = (w, v) =>
    v === 'asc' ? weaponVisuals.weapons?.[w.id]?.ascended?.rarity || 'Legendary' : w.rarity

  let bestCell = null
  let bestScore = -Infinity

  for (let row = 0; row < rowOrigins.length; row++) {
    const rowY = rowOrigins[row]
    for (let col = 0; col < grid.cols; col++) {
      const r1080 = {
        x: grid.originX + col * grid.pitchX,
        y: rowY,
        w: grid.tileW,
        h: grid.tileH,
      }
      const frect = mapRectFloat(r1080, viewport)
      const state = analyzeCardState(imageData, frect, 'tile')
      if (!state.occupied) continue

      const ammo = db.ammo?.size
        ? classifyGlyph(imageData, offsetRect(r1080, TILE_BADGE), viewport, db.ammo)
        : { key: null, confident: false }
      if (ammo.confident && ammo.key !== wMeta.ammo) continue

      const obsSmall = sampleIconBoxBilerp(imageData, frect, 'tile', SQ_W, SQ_H)
      const obsTight = sampleIconBoxBilerp(imageData, frect, 'weaponTileTight', WP_W, WP_H)
      const obsWide = sampleIconBoxBilerp(imageData, frect, 'weaponTileWide', WP_W, WP_H)

      const scoreVariant = (w, v) => {
        const rar = variantRarity(w, v)
        if (state.rarityConfident && state.rarity && rar && state.rarity !== rar) return -Infinity
        const small = db.weaponVariants?.get(`${w.id}|${v}|small`)
        const big =
          db.weaponVariants?.get(`${w.id}|${v}|big`) ||
          (v === 'base' ? db.weapons.get(w.id) : null)
        let s = -Infinity
        if (small) s = Math.max(s, scoreTemplateAgainstObs(obsSmall, state, small))
        if (big) {
          s = Math.max(
            s,
            scoreTemplateAgainstObs(obsTight, state, big),
            scoreTemplateAgainstObs(obsWide, state, big),
          )
        }
        return s
      }

      let targetScore = -Infinity
      for (const v of wantVariants) targetScore = Math.max(targetScore, scoreVariant(wMeta, v))

      // 弹药徽章 + 品质角标已唯一锁定目标武器（同弹药同品质无其他武器/版本）时，
      // 实时渲染缩略图仅需弱一致即可接受，且无需竞品消歧
      const uniqueByCues =
        ammo.confident &&
        ammo.key === wMeta.ammo &&
        state.rarityConfident &&
        state.rarity &&
        wantVariants.some((v) => variantRarity(wMeta, v) === state.rarity) &&
        !(weaponsData.weapons || []).some(
          (rw) =>
            rw.ammo === ammo.key &&
            ['base', 'asc'].some(
              (v) =>
                (v === 'base' || weaponVisuals.weapons?.[rw.id]?.ascended) &&
                variantRarity(rw, v) === state.rarity &&
                !(rw.id === targetId && wantVariants.includes(v)),
            ),
        )

      if (!Number.isFinite(targetScore) || targetScore < (uniqueByCues ? 0.2 : 0.5)) continue

      // 指定增强/普通版本时，若同武器另一版本明显更像则跳过
      if (!uniqueByCues && (opts.amplified === true || opts.amplified === false)) {
        const other = scoreVariant(wMeta, opts.amplified ? 'base' : 'asc')
        if (Number.isFinite(other) && other > targetScore + 0.05) continue
      }

      // 竞品消歧：仅与弹药类型兼容的其他武器比较
      let rivalBeat = false
      for (const rw of uniqueByCues ? [] : weaponsData.weapons || []) {
        if (rw.id === targetId) continue
        if (ammo.key && ammo.confident && rw.ammo !== ammo.key) continue
        for (const v of ['base', 'asc']) {
          const rs = scoreVariant(rw, v)
          if (Number.isFinite(rs) && rs > targetScore + 0.035) {
            rivalBeat = true
            break
          }
        }
        if (rivalBeat) break
      }
      if (rivalBeat) continue

      const rankScore = targetScore + (ammo.confident ? 0.05 : 0) + (uniqueByCues ? 0.4 : 0)
      if (rankScore > bestScore) {
        const cellRect = mapRect(r1080, viewport)
        bestScore = rankScore
        bestCell = {
          row,
          col,
          score: +targetScore.toFixed(3),
          count: 1,
          ammo: ammo.key,
          normX: +((cellRect.x + cellRect.w * 0.5) / W).toFixed(5),
          normY: +((cellRect.y + cellRect.h * 0.5) / H).toFixed(5),
        }
      }
    }
  }
  return bestCell
}

/**
 * 在左侧仓库网格 (WBP_InventoryStash 可见格) 中检索目标物品格子的归一化点击中心。
 * 内置同稀有度近似竞品消歧，杜绝把外形相似的其他道具误判为目标道具。
 */
export async function findTargetInStashGrid(
  imageData,
  viewport,
  kind,
  targetId,
  preferredCount = null,
  opts = {},
) {
  if (!viewport || viewport.ox + 152 * viewport.scale < 0) return null
  const db = await ensureLoadoutTemplates()
  if (kind === 'weapon') {
    return findWeaponInStashGrid(imageData, viewport, targetId, db, opts || {})
  }
  const tplMap =
    kind === 'augment'
      ? db.augments
      : kind === 'shield'
        ? db.shields
        : kind === 'weapon'
          ? db.weapons
          : db.items
  const targetTpl = tplMap.get(targetId)
  if (!targetTpl) return null

  const { width: W, height: H } = imageData
  const isWeapon = kind === 'weapon'
  const grid = UMG_RECTS_1080P.stashGrid
  const rowOrigins = detectStashRowOrigins1080p(imageData, viewport)
  const targetRarity = targetTpl.meta?.rarity || null

  let bestCell = null
  let bestScore = -Infinity

  for (let row = 0; row < rowOrigins.length; row++) {
    const rowY = rowOrigins[row]
    for (let col = 0; col < grid.cols; col++) {
      const r1080 = {
        x: grid.originX + col * grid.pitchX,
        y: rowY,
        w: grid.tileW,
        h: grid.tileH,
      }
      const frect = mapRectFloat(r1080, viewport)
      const state = analyzeCardState(imageData, frect, 'tile')
      if (!state.occupied) continue

      // 若格子品质色标明确且与目标物品品质不一致，直接跳过（绝不误抓异品质道具）
      if (
        state.rarityConfident &&
        state.rarity &&
        targetRarity &&
        state.rarity !== targetRarity
      ) {
        continue
      }

      let targetScore = -Infinity
      let winningObs = null

      if (isWeapon) {
        const obsTight = sampleIconBoxBilerp(
          imageData,
          frect,
          'weaponTileTight',
          WP_W,
          WP_H,
        )
        const obsWide = sampleIconBoxBilerp(
          imageData,
          frect,
          'weaponTileWide',
          WP_W,
          WP_H,
        )
        const scTight = scoreTemplateAgainstObs(obsTight, state, targetTpl)
        const scWide = scoreTemplateAgainstObs(obsWide, state, targetTpl)
        if (scWide > scTight) {
          targetScore = scWide
          winningObs = obsWide
        } else {
          targetScore = scTight
          winningObs = obsTight
        }
      } else {
        winningObs = sampleIconBoxBilerp(imageData, frect, 'tile', SQ_W, SQ_H)
        targetScore = scoreTemplateAgainstObs(winningObs, state, targetTpl)
      }

      if (targetScore < 0.54) continue

      // 竞品消歧校验：若存在另一件同品质模板在该格得分显著高于目标模板，说明该格是别的近似物品
      let rivalBeat = false
      for (const [otherId, otherTpl] of tplMap.entries()) {
        if (otherId === targetId) continue
        if (
          state.rarityConfident &&
          state.rarity &&
          otherTpl.meta?.rarity &&
          otherTpl.meta.rarity !== state.rarity
        ) {
          continue
        }
        const otherSc = scoreTemplateAgainstObs(winningObs, state, otherTpl)
        if (otherSc > targetScore + 0.035) {
          rivalBeat = true
          break
        }
      }
      if (rivalBeat) continue

      let rankScore = targetScore
      let detectedCount = null
      if (!isWeapon && (targetTpl.meta?.maxStack || 1) > 1) {
        detectedCount = recognizeTileStackCount(
          imageData,
          r1080,
          viewport,
          targetTpl.meta.maxStack,
        )
        if (preferredCount && preferredCount > 1) {
          rankScore +=
            detectedCount >= preferredCount
              ? 0.025
              : (detectedCount / preferredCount) * 0.015
        }
      }

      if (rankScore > bestScore) {
        const cellRect = mapRect(r1080, viewport)
        bestScore = rankScore
        bestCell = {
          row,
          col,
          score: +targetScore.toFixed(3),
          count: detectedCount ?? 1,
          normX: +((cellRect.x + cellRect.w * 0.5) / W).toFixed(5),
          normY: +((cellRect.y + cellRect.h * 0.5) / H).toFixed(5),
        }
      }
    }
  }

  return bestCell
}

/**
 * 检测指定 1080p 槽位当前是否处于奶油底高亮选中态或纯白亮框锁定态
 */
export function isRect1080pSelected(imageData, viewport, rect1080p) {
  if (!imageData || !viewport || viewport.scale <= 0 || !rect1080p) return false
  const { data, width: W, height: H } = imageData
  const frect = mapRectFloat(rect1080p, viewport)
  if (
    frect.x < 2 ||
    frect.y < 2 ||
    frect.x + frect.w >= W - 2 ||
    frect.y + frect.h >= H - 2
  ) {
    return false
  }

  // 1. 实机选中卡片奶油底填充 (#f9eedf, topBgLum ~235，普通未选中卡片 ~15-26)
  const lums = []
  for (let sy = 0.06; sy <= 0.18; sy += 0.06) {
    const py = frect.y + frect.h * sy
    for (let sx = 0.15; sx <= 0.85; sx += 0.14) {
      lums.push(bilerpLum(data, W, H, frect.x + frect.w * sx, py))
    }
  }
  if (medianOf(lums) >= 158) return true

  // 2. 空槽位被点击选中时的亮白外框兜底检测
  const minLum = viewport.scale >= 0.85 ? 140 : 84
  const minContrast = viewport.scale >= 0.85 ? 90 : 52
  const rgb = [0, 0, 0]
  const hasWhiteEdge = (x1080, y1080, horizontal, outerSign) => {
    const outLum = bilerpLum(
      data,
      W,
      H,
      viewport.ox + (horizontal ? x1080 : x1080 + outerSign * 5) * viewport.scale,
      viewport.oy + (horizontal ? y1080 + outerSign * 5 : y1080) * viewport.scale,
    )
    for (let d = -2; d <= 2; d++) {
      bilerpRgb(
        data,
        W,
        H,
        viewport.ox + (horizontal ? x1080 : x1080 + d) * viewport.scale,
        viewport.oy + (horizontal ? y1080 + d : y1080) * viewport.scale,
        rgb,
      )
      const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
      const sat = Math.max(rgb[0], rgb[1], rgb[2]) - Math.min(rgb[0], rgb[1], rgb[2])
      if (lum >= minLum && sat <= 46 && lum - outLum >= minContrast) {
        return true
      }
    }
    return false
  }

  let topHits = 0
  let topTotal = 0
  for (let x = rect1080p.x + 12; x <= rect1080p.x + rect1080p.w - 12; x += 8) {
    topTotal++
    if (hasWhiteEdge(x, rect1080p.y, true, -1)) topHits++
  }
  if (topHits / Math.max(1, topTotal) < 0.5) return false

  let rightHits = 0
  let rightTotal = 0
  for (let y = rect1080p.y + 12; y <= rect1080p.y + rect1080p.h - 12; y += 8) {
    rightTotal++
    if (hasWhiteEdge(rect1080p.x + rect1080p.w, y, false, 1)) rightHits++
  }
  return rightHits / Math.max(1, rightTotal) >= 0.5
}

/**
 * 检测当前右侧战备区是否存在被选中的「非背包栏位」，返回其 1080p 矩形以便再次点击取消单槽锁定。
 */
export function detectSelectedNonBackpackSlot1080p(imageData, viewport) {
  if (!imageData || !viewport || viewport.scale <= 0) return null
  const candidates = [
    UMG_RECTS_1080P.augment,
    UMG_RECTS_1080P.shield,
    UMG_RECTS_1080P.weapon1,
    UMG_RECTS_1080P.weapon2,
    ...UMG_RECTS_1080P.quickUse,
    ...UMG_RECTS_1080P.aux,
    ...UMG_RECTS_1080P.safePocketWithAux,
  ]

  for (const r of candidates) {
    if (isRect1080pSelected(imageData, viewport, r)) {
      return r
    }
  }
  return null
}

/**
 * 识别左侧分类导航栏当前高亮的按钮键值 (如 'all' | 'ammunition' | 'utilities' 等)
 */
export function detectActiveStashFilterKey(imageData, viewport) {
  if (!imageData || !viewport || viewport.scale <= 0) return null
  const { data, width: W, height: H } = imageData
  if (viewport.ox + 80 * viewport.scale < 0) return null

  const ringMeans = []
  for (let i = 0; i < FILTER_ORDER.length; i++) {
    const key = FILTER_ORDER[i]
    const pt = UMG_RECTS_1080P.stashFilters[key]
    let sum = 0
    let cnt = 0
    for (let dy = -14; dy <= 14; dy += 3) {
      for (let dx = -14; dx <= 14; dx += 3) {
        const r2 = dx * dx + dy * dy
        if (r2 < 81 || r2 > 225) continue
        sum += bilerpLum(
          data,
          W,
          H,
          viewport.ox + (pt.x + dx) * viewport.scale,
          viewport.oy + (pt.y + dy) * viewport.scale,
        )
        cnt++
      }
    }
    ringMeans.push({ key, val: cnt ? sum / cnt : 0 })
  }

  const sorted = ringMeans.slice().sort((a, b) => b.val - a.val)
  const med = medianOf(ringMeans.map((x) => x.val))
  if (sorted[0] && sorted[0].val - med >= 18) {
    return sorted[0].key
  }
  return null
}

/**
 * 检测最左侧仓库分类导航栏 (WBP_InventoryFilterList) 当前是否处于可点击聚焦态。
 * 当右侧任意「非背包栏位」被点击选中时，游戏进入单槽过滤模式：
 * 「储备箱」标题亮度相对右侧「配装」标题会压暗至 ~38%-48%，且左侧分类栏锁定不可点击。
 */
export function isStashFilterRailActive(imageData, viewport) {
  if (!imageData || !viewport || viewport.scale <= 0) return false
  const { data, width: W, height: H } = imageData
  if (viewport.ox + 80 * viewport.scale < 0) return false

  // 若右侧存在已选中的非背包槽位，左侧分类栏必处于单槽过滤锁定态
  if (detectSelectedNonBackpackSlot1080p(imageData, viewport)) {
    return false
  }

  const lumAt1080 = (x1080, y1080) =>
    bilerpLum(
      data,
      W,
      H,
      viewport.ox + x1080 * viewport.scale,
      viewport.oy + y1080 * viewport.scale,
    )

  // 对比左侧「储备箱」标题文字峰值与右侧常亮「配装」标题文字峰值，自适应任意分辨率与 HDR/Gamma
  const stashHdr = []
  for (let y = 132; y <= 164; y += 2) {
    for (let x = 76; x <= 156; x += 2) {
      stashHdr.push(lumAt1080(x, y))
    }
  }
  stashHdr.sort((a, b) => b - a)

  const loadoutHdr = []
  for (let y = 132; y <= 164; y += 2) {
    for (let x = 770; x <= 845; x += 2) {
      loadoutHdr.push(lumAt1080(x, y))
    }
  }
  loadoutHdr.sort((a, b) => b - a)

  const topK = 8
  let stashTop = 0
  let loadoutTop = 0
  for (let i = 0; i < topK; i++) {
    stashTop += stashHdr[i] || 0
    loadoutTop += loadoutHdr[i] || 0
  }
  stashTop /= topK
  loadoutTop /= topK

  if (loadoutTop >= 120) {
    return stashTop >= loadoutTop * 0.62
  }
  return stashTop >= 125
}

/**
 * 提取储备箱可见网格页状态（占用格数、末行占用数、滚动条精确位置、画面特征签名）
 */
export function inspectStashPageState(imageData, viewport) {
  const { data, width: W, height: H } = imageData
  const grid = UMG_RECTS_1080P.stashGrid
  const sb = UMG_RECTS_1080P.stashScrollbar
  const sigCols = 16
  const sigRows = 26
  const signature = new Float32Array(sigCols * sigRows)

  if (!viewport || viewport.scale <= 0) {
    return {
      occupiedCount: 0,
      bottomRowsOccupied: 0,
      hasScrollbar: false,
      scrolledFromTop: false,
      atBottom: false,
      signature,
    }
  }

  const lumAt1080 = (x1080, y1080) =>
    bilerpLum(
      data,
      W,
      H,
      viewport.ox + x1080 * viewport.scale,
      viewport.oy + y1080 * viewport.scale,
    )

  let sIdx = 0
  for (let r = 0; r < sigRows; r++) {
    const y1080 = 280 + (r / (sigRows - 1)) * 652
    for (let c = 0; c < sigCols; c++) {
      const x1080 = 160 + (c / (sigCols - 1)) * 388
      signature[sIdx++] = lumAt1080(x1080, y1080)
    }
  }

  const rowOrigins = detectStashRowOrigins1080p(imageData, viewport)
  let occupiedCount = 0
  let bottomRowsOccupied = 0
  const lastRowIdx = rowOrigins.length - 1

  for (let row = 0; row < rowOrigins.length; row++) {
    const rowY = rowOrigins[row]
    for (let col = 0; col < grid.cols; col++) {
      const frect = mapRectFloat(
        {
          x: grid.originX + col * grid.pitchX,
          y: rowY,
          w: grid.tileW,
          h: grid.tileH,
        },
        viewport,
      )
      const st = analyzeCardState(imageData, frect, 'tile')
      if (st.occupied) {
        occupiedCount++
        if (row === lastRowIdx || rowY >= 770) {
          bottomRowsOccupied++
        }
      }
    }
  }

  // 检测右侧垂直滚动条滑块 (实测位于 x1080: 581..589, y1080: 274..940，压暗态峰值 ~95-110，聚焦态 ~150+)
  let firstThumbY = null
  let lastThumbY = null
  let thumbRows = 0
  for (let y = sb.y0; y <= sb.y1; y += 4) {
    let peak = 0
    for (let x = sb.x0; x <= sb.x1; x += 1.5) {
      const l = lumAt1080(x, y)
      if (l > peak) peak = l
    }
    const bgLeft = lumAt1080(sb.bgX, y)
    if (peak >= 66 && peak - bgLeft >= 34) {
      if (firstThumbY === null) firstThumbY = y
      lastThumbY = y
      thumbRows++
    }
  }

  const hasScrollbar = thumbRows >= 4
  const scrolledFromTop = Boolean(
    hasScrollbar && firstThumbY !== null && firstThumbY > 296,
  )
  const atBottom = Boolean(
    hasScrollbar && lastThumbY !== null && lastThumbY >= 926,
  )

  return {
    occupiedCount,
    bottomRowsOccupied,
    hasScrollbar,
    scrolledFromTop,
    atBottom,
    signature,
  }
}

/**
 * 对比滚动前后两帧储备箱网格签名，判断滚轮是否实际推动了列表（返回 false 表示已滚到底部或顶部尽头）。
 */
export function didStashScrollChange(prevSig, nextSig) {
  if (
    !prevSig ||
    !nextSig ||
    prevSig.length !== nextSig.length ||
    !prevSig.length
  ) {
    return false
  }
  let diffSum = 0
  for (let i = 0; i < prevSig.length; i++) {
    diffSum += Math.abs(prevSig[i] - nextSig[i])
  }
  return diffSum / prevSig.length >= 2.2
}

/**
 * 单槽位快速视觉复核：验证指定目标战备槽位是否已成功装配为 targetId（兼容刚装配后的悬停/选中奶油高亮卡）。
 */
export async function verifyTargetSlotMatched(
  imageData,
  viewport,
  kind,
  rect1080p,
  targetId,
  opts = {},
) {
  if (!imageData || !viewport || !rect1080p || !targetId) {
    return { occupied: false, matched: false, score: 0 }
  }
  const db = await ensureLoadoutTemplates()

  if (kind === 'weapon') {
    const wid = identifyWeaponCard(imageData, rect1080p, viewport, db)
    if (!wid?.occupied) return { occupied: false, matched: false, score: 0 }
    if (!wid.identified) {
      // 已占用但无法识别：通常是武器实时渲染缩略图仍在加载
      return { occupied: true, matched: false, loading: true, score: wid.score ?? 0 }
    }
    const variantOk =
      opts?.amplified === true || opts?.amplified === false
        ? wid.amplified === opts.amplified || !wid.layout?.confident
        : true
    return {
      occupied: true,
      matched: wid.weaponId === targetId && variantOk,
      weaponId: wid.weaponId,
      amplified: wid.amplified,
      score: wid.score,
    }
  }

  const candidateMap =
    kind === 'augment'
      ? db.augments
      : kind === 'shield'
        ? db.shields
        : kind === 'weapon'
          ? db.weapons
          : db.items

  const cardType =
    kind === 'weapon'
      ? 'weaponSlot'
      : kind === 'augment' || kind === 'shield'
        ? 'gear'
        : 'tile'
  const frect = mapRectFloat(rect1080p, viewport)
  const state = analyzeCardState(imageData, frect, cardType)
  if (!state.occupied) {
    return { occupied: false, matched: false, score: 0 }
  }

  const isWeapon = kind === 'weapon'
  const obs = sampleIconBoxBilerp(
    imageData,
    frect,
    cardType,
    isWeapon ? WP_W : SQ_W,
    isWeapon ? WP_H : SQ_H,
  )

  let bestId = null
  let bestScore = -Infinity
  for (const [id, tpl] of candidateMap.entries()) {
    const sc = scoreTemplateAgainstObs(obs, state, tpl)
    if (sc > bestScore) {
      bestScore = sc
      bestId = id
    }
  }

  if (bestId === targetId && bestScore >= 0.42) {
    return { occupied: true, matched: true, score: +bestScore.toFixed(3) }
  }

  const targetTpl = candidateMap.get(targetId)
  if (targetTpl) {
    const directScore = scoreTemplateAgainstObs(obs, state, targetTpl)
    if (directScore >= 0.56 && bestScore - directScore < 0.035) {
      return { occupied: true, matched: true, score: +directScore.toFixed(3) }
    }
  }

  return {
    occupied: true,
    matched: false,
    score: Number.isFinite(bestScore) ? +bestScore.toFixed(3) : 0,
  }
}
