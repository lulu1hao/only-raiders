/**
 * raiderAcquisitionRecognizer.js
 *
 * 工坊 (WBP_WorkshopScreen / WBP_GeneratorScreenTabbed) 与 商人 (WBP_NPCSelectionScreen / WBP_NPCTradeScreen)
 * 离线视觉识别模块：提供页面状态判定、152x96 商品/蓝图网格相位检索、右侧操作卡长按按钮与数量步进器动态定位、
 * 以及武器升级页 (WBP_GeneratorScreenUpgradeTab) 可升级武器格检索。
 */

import weaponsData from '../data/weaponsData.json'
import {
  SQ_H,
  SQ_W,
  WP_H,
  WP_W,
  analyzeCardState,
  bilerpLum,
  bilerpRgb,
  classifyGlyph,
  clamp,
  ensureLoadoutTemplates,
  locateLoadoutViewport,
  mapRectFloat,
  medianOf,
  sampleIconBoxBilerp,
  scoreTemplateAgainstObs,
  weaponVariantsOf,
} from './raiderLoadoutRecognizer'

export const NAV_1080P = {
  subScreenBack: { x: 86, y: 30 },
  bottomEscBack: { x: 96, y: 1034 },
  tabInventoryPill: { x: 264, y: 1034 },
  topBar: {
    play: { x: 138, y: 30 },
    workshop: { x: 238, y: 30 },
    raider: { x: 320, y: 30 },
    outpost: { x: 408, y: 30 },
    traders: { x: 484, y: 30 },
  },
}

export const WORKSHOP_1080P = {
  homeTiles: {
    scrappy: { x: 488, y: 912 },
    workbench: { x: 632, y: 912 },
    medical_lab: { x: 748, y: 912 },
    gunsmith: { x: 864, y: 912 },
    gear_bench: { x: 980, y: 912 },
    utility_station: { x: 1096, y: 912 },
    explosives_station: { x: 1212, y: 912 },
    refiner: { x: 1328, y: 912 },
    research_station: { x: 1444, y: 912 },
  },
  quickNav: {
    scrappy: { x: 68, y: 338 },
    workbench: { x: 68, y: 388 },
    medical_lab: { x: 68, y: 440 },
    gunsmith: { x: 68, y: 488 },
    gear_bench: { x: 68, y: 540 },
    utility_station: { x: 68, y: 590 },
    explosives_station: { x: 68, y: 640 },
    refiner: { x: 68, y: 690 },
    research_station: { x: 68, y: 742 },
  },
  gunsmithTabs: {
    craft: { x: 404, y: 30 },
    weaponUpgrade: { x: 506, y: 30 },
    stationUpgrade: { x: 604, y: 30 },
  },
  craftGrid: {
    originX: 148,
    originY: 176,
    tileW: 152,
    tileH: 96,
    pitchX: 160,
    pitchY: 104,
    cols: 3,
    rows: 7,
    clipTopY: 168,
    clipBottomY: 974,
    scrollHover: { x: 304, y: 484 },
  },
}

export const TRADER_1080P = {
  piazzaCards: {
    celeste: { x: 240, y: 356 },
    shani: { x: 482, y: 666 },
    tian_wen: { x: 750, y: 556 },
    lance: { x: 1028, y: 316 },
    apollo: { x: 1280, y: 454 },
  },
  quickNav: {
    celeste: { x: 68, y: 418 },
    shani: { x: 68, y: 466 },
    tian_wen: { x: 68, y: 514 },
    lance: { x: 68, y: 564 },
    apollo: { x: 68, y: 616 },
  },
  tradeTab: { x: 312, y: 30 },
  shopGrid: {
    originX: 852,
    originY: 160,
    tileW: 152,
    tileH: 96,
    pitchX: 160,
    pitchY: 104,
    cols: 3,
    rows: 7,
    clipTopY: 152,
    clipBottomY: 924,
    scrollHover: { x: 1008, y: 468 },
  },
}

const OFFER_WEAPON_BOX_FRAC = { cx: 0.5, cy: 0.39, wf: 0.78, hf: 0.62 }
const OFFER_TILE_BADGE = { x: 5, y: 74, w: 18, h: 18 }

const weaponMetaById = new Map((weaponsData.weapons || []).map((w) => [w.id, w]))

/**
 * 将全客户端窗口截图尺寸换算为标准 1920x1080 DPI 视口变换
 */
export function computeClientViewport1080p(imageData) {
  const W = imageData?.width || 1920
  const H = imageData?.height || 1080
  if (W / Math.max(1, H) >= 16 / 9 - 0.02) {
    const scale = H / 1080
    return { scale, ox: (W - 1920 * scale) * 0.5, oy: 0 }
  }
  const scale = W / 1920
  return { scale, ox: 0, oy: (H - 1080 * scale) * 0.5 }
}

function lumAt(imageData, vp, x1080, y1080) {
  return bilerpLum(
    imageData.data,
    imageData.width,
    imageData.height,
    vp.ox + x1080 * vp.scale,
    vp.oy + y1080 * vp.scale,
  )
}

function rgbAt(imageData, vp, x1080, y1080, outRgb) {
  bilerpRgb(
    imageData.data,
    imageData.width,
    imageData.height,
    vp.ox + x1080 * vp.scale,
    vp.oy + y1080 * vp.scale,
    outRgb,
  )
}

/**
 * 判断当前全客户端画面所处的 UI 页面特征
 */
export function inspectAcquisitionScreen(imageData) {
  if (!imageData) {
    return {
      isLoadout: false,
      hasSubScreenBack: false,
      hasTabInventoryPill: false,
      hasRightDetailCard: false,
      hasLobbyBar: false,
      activeLobbyTab: null,
    }
  }
  const vp = computeClientViewport1080p(imageData)
  const loadoutLoc = locateLoadoutViewport(imageData, { fullWindowOnly: true })
  const isLoadout = Boolean(loadoutLoc.ok && loadoutLoc.hasStashPanel)

  // 0. 左上角圆形 '<' 返回按钮 (WBP_TopBar 返回工坊/商人总览，center=86,30)
  const backOuter = (lumAt(imageData, vp, 64, 30) + lumAt(imageData, vp, 106, 30)) * 0.5
  const backRing =
    (lumAt(imageData, vp, 74, 30) +
      lumAt(imageData, vp, 92, 30) +
      lumAt(imageData, vp, 86, 20) +
      lumAt(imageData, vp, 86, 40)) *
    0.25
  const backChev = Math.max(
    lumAt(imageData, vp, 80, 30),
    lumAt(imageData, vp, 82, 30),
    lumAt(imageData, vp, 84, 30),
  )
  const hasSubScreenBack =
    !isLoadout && backOuter <= 30 && backRing >= 34 && backRing <= 82 && backChev >= 120

  // 1. 左下角 [TAB键 物品栏] 右半段白色胶囊区域 (x=268..322, y=1020..1048, 避开左侧深色 TAB键 键帽)
  const pillLums = []
  for (let y = 1020; y <= 1048; y += 7) {
    for (let x = 268; x <= 322; x += 12) {
      pillLums.push(lumAt(imageData, vp, x, y))
    }
  }
  const hasTabInventoryPill = !isLoadout && medianOf(pillLums) >= 160

  // 2. 右侧奶油色物品/购买详情卡片 (x=1425..1850, y=165..340, RGB ~#f9eedf)
  const cardLums = []
  const rgb = [0, 0, 0]
  let warmCount = 0
  let totalCard = 0
  for (let y = 180; y <= 340; y += 28) {
    for (let x = 1440; x <= 1840; x += 48) {
      rgbAt(imageData, vp, x, y, rgb)
      const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
      cardLums.push(lum)
      totalCard++
      if (rgb[0] >= 200 && rgb[1] >= 188 && rgb[2] >= 165 && rgb[0] >= rgb[2]) {
        warmCount++
      }
    }
  }
  const hasRightDetailCard =
    medianOf(cardLums) >= 188 && warmCount >= Math.ceil(totalCard * 0.65)

  // 3. 大厅顶栏检测：非物品栏/子界面返回页 + [奖励通行证/商店] 常驻标签亮区 + 任一大厅页签顶部白色胶囊描边 (y=13..16)
  const hasLobbyCapsuleTopAt = (cx) => {
    let topHits = 0
    for (let dx = -28; dx <= 28; dx += 6) {
      for (const yy of [13, 14, 15, 16]) {
        if (lumAt(imageData, vp, cx + dx, yy) >= 85) {
          topHits++
          break
        }
      }
    }
    return topHits >= 5
  }
  const countBrightGlyphs = (x0, x1) => {
    let hits = 0
    for (let y = 22; y <= 36; y += 2) {
      for (let x = x0; x <= x1; x += 4) {
        if (lumAt(imageData, vp, x, y) >= 85) hits++
      }
    }
    return hits
  }
  const hasPassAndShopLabels =
    countBrightGlyphs(548, 640) >= 20 && countBrightGlyphs(678, 716) >= 12
  let matchedTab = null
  for (const tabKey of ['play', 'workshop', 'raider', 'outpost', 'traders']) {
    if (hasLobbyCapsuleTopAt(NAV_1080P.topBar[tabKey].x)) {
      matchedTab = tabKey
      break
    }
  }

  const hasLobbyBar =
    !isLoadout &&
    !hasSubScreenBack &&
    !hasRightDetailCard &&
    hasPassAndShopLabels &&
    Boolean(matchedTab)
  const activeLobbyTab = hasLobbyBar ? matchedTab : null

  return {
    vp,
    isLoadout,
    hasSubScreenBack,
    hasTabInventoryPill,
    hasRightDetailCard,
    hasLobbyBar,
    activeLobbyTab,
  }
}

/**
 * 扫描右上方奶油详情卡内的「黄色长按主按钮」、「资源不足红条」以及数量步进器 (+/-) 中心坐标
 */
export function inspectRightActionPanel(imageData, viewport = null) {
  if (!imageData) {
    return {
      actionable: false,
      insufficientResources: false,
      hasStepper: false,
      plusEnabled: false,
      minusEnabled: false,
    }
  }
  const vp = viewport || computeClientViewport1080p(imageData)
  const rgb = [0, 0, 0]

  // 1. 逐行扫描 y1080 = 700..960 寻找明黄色主按钮 (PurchaseButton 激活态)
  const yellowRows = []
  const redRows = []
  for (let y = 690; y <= 962; y += 2) {
    let yellowHits = 0
    let redHits = 0
    let samples = 0
    for (let x = 1445; x <= 1825; x += 20) {
      rgbAt(imageData, vp, x, y, rgb)
      samples++
      const r = rgb[0]
      const g = rgb[1]
      const b = rgb[2]
      if (r >= 195 && g >= 128 && b <= 98 && r - b >= 105) yellowHits++
      else if (r >= 135 && g <= 66 && b <= 66 && r - g >= 72) redHits++
    }
    if (yellowHits >= samples * 0.55) yellowRows.push(y)
    if (redHits >= samples * 0.55) redRows.push(y)
  }

  // 提取最长连续行带
  const findBestBand = (rows, minHeight) => {
    if (!rows.length) return null
    let bestStart = rows[0]
    let bestEnd = rows[0]
    let curStart = rows[0]
    let curEnd = rows[0]
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] - curEnd <= 6) {
        curEnd = rows[i]
      } else {
        if (curEnd - curStart > bestEnd - bestStart) {
          bestStart = curStart
          bestEnd = curEnd
        }
        curStart = rows[i]
        curEnd = rows[i]
      }
    }
    if (curEnd - curStart > bestEnd - bestStart) {
      bestStart = curStart
      bestEnd = curEnd
    }
    return bestEnd - bestStart >= minHeight
      ? { y0: bestStart, y1: bestEnd, midY: (bestStart + bestEnd) * 0.5 }
      : null
  }

  const yellowBand = findBestBand(yellowRows, 24)
  const redBand = findBestBand(redRows, 14)

  const actionable = Boolean(yellowBand)
  const btnX1080 = 1637
  const btnY1080 = yellowBand ? yellowBand.midY : null

  // 2. 在主按钮 / 资源不足红条上方搜寻 WBP_AmountSelector (- / ×N / +)
  // 采样圆形内距中心偏移 (±8, ±6) 处填充色，避开 '+'/'-' 白色中心字符与禁用灰态误判
  let hasStepper = false
  let stepperY1080 = null
  let plusEnabled = false
  let minusEnabled = false
  const xMinus = 1520
  const xPlus = 1752
  const anchorY = btnY1080 ?? (redBand ? redBand.y1 + 78 : null)

  if (anchorY != null) {
    const searchTop = Math.max(580, Math.round(anchorY - 195))
    const searchBot = Math.min(900, Math.round(anchorY - 34))
    let bestStepperScore = -Infinity

    for (let y = searchTop; y <= searchBot; y += 2) {
      const mFill = medianOf([
        lumAt(imageData, vp, xMinus - 8, y - 6),
        lumAt(imageData, vp, xMinus + 8, y - 6),
        lumAt(imageData, vp, xMinus - 8, y + 6),
        lumAt(imageData, vp, xMinus + 8, y + 6),
      ])
      const pFill = medianOf([
        lumAt(imageData, vp, xPlus - 8, y - 6),
        lumAt(imageData, vp, xPlus + 8, y - 6),
        lumAt(imageData, vp, xPlus - 8, y + 6),
        lumAt(imageData, vp, xPlus + 8, y + 6),
      ])
      if (mFill > 135 || pFill > 135) continue

      const gapMin = Math.min(
        lumAt(imageData, vp, 1492, y),
        lumAt(imageData, vp, 1556, y),
        lumAt(imageData, vp, 1716, y),
        lumAt(imageData, vp, 1780, y),
      )
      if (gapMin < 180) continue

      const boxLum = medianOf([
        lumAt(imageData, vp, 1584, y),
        lumAt(imageData, vp, 1604, y),
        lumAt(imageData, vp, 1672, y),
        lumAt(imageData, vp, 1688, y),
      ])
      if (boxLum < 165 || boxLum > 218 || gapMin - boxLum < 8) continue

      const sc = gapMin - (mFill + pFill) * 0.35
      if (sc > bestStepperScore) {
        bestStepperScore = sc
        stepperY1080 = y
        hasStepper = true
        plusEnabled = pFill <= 62
        minusEnabled = mFill <= 62
      }
    }
  }

  const W = imageData.width
  const H = imageData.height
  const normOf = (x1080, y1080) => ({
    x: clamp((vp.ox + x1080 * vp.scale) / W, 0.02, 0.98),
    y: clamp((vp.oy + y1080 * vp.scale) / H, 0.02, 0.98),
  })

  const btnNorm = btnY1080 ? normOf(btnX1080, btnY1080) : null
  const minusNorm = hasStepper ? normOf(xMinus, stepperY1080) : null
  const plusNorm = hasStepper ? normOf(xPlus, stepperY1080) : null

  return {
    actionable,
    insufficientResources: Boolean(redBand),
    btnY1080,
    btnNormX: btnNorm?.x ?? null,
    btnNormY: btnNorm?.y ?? null,
    hasStepper,
    stepperY1080,
    plusEnabled,
    minusEnabled,
    minusNormX: minusNorm?.x ?? null,
    plusNormX: plusNorm?.x ?? null,
    stepperNormY: plusNorm?.y ?? null,
  }
}

/**
 * 采样步进器中央数量显示框 [×N] 区域像素签名，用于判断点击 '+' 后数值是否真实递增
 */
export function sampleStepperQtyBoxSignature(imageData, vp, stepperY1080) {
  if (!imageData || !vp || stepperY1080 == null) return null
  const vals = []
  for (let y = stepperY1080 - 9; y <= stepperY1080 + 9; y += 2) {
    for (let x = 1606; x <= 1668; x += 2) {
      vals.push(lumAt(imageData, vp, x, y))
    }
  }
  return Float32Array.from(vals)
}

/**
 * 比对步进器中央数量显示框前后的像素签名是否发生变化
 */
export function didStepperQtyBoxChange(sigA, sigB) {
  if (!sigA || !sigB || !sigA.length || sigA.length !== sigB.length) return false
  let sumDiff = 0
  let maxDiff = 0
  for (let i = 0; i < sigA.length; i++) {
    const d = Math.abs(sigA[i] - sigB[i])
    sumDiff += d
    if (d > maxDiff) maxDiff = d
  }
  return sumDiff / sigA.length >= 1.2 || maxDiff >= 18
}

/**
 * 检测 152x96 商品/蓝图网格的垂直滚动相位，返回所有完整可见行的 1080p 起始 Y 坐标
 */
export function detectOfferRowOrigins1080p(imageData, vp, gridSpec) {
  const defaultRows = Array.from(
    { length: gridSpec.rows },
    (_, r) => gridSpec.originY + r * gridSpec.pitchY,
  ).filter((y) => y + gridSpec.tileH <= gridSpec.clipBottomY + 2)

  if (!imageData || !vp || vp.scale <= 0) return defaultRows

  const { data, width: W, height: H } = imageData
  const lumFn = (x1080, y1080) =>
    bilerpLum(data, W, H, vp.ox + x1080 * vp.scale, vp.oy + y1080 * vp.scale)

  const sampleXs = []
  for (let c = 0; c < gridSpec.cols; c++) {
    const cx = gridSpec.originX + c * gridSpec.pitchX + gridSpec.tileW * 0.5
    sampleXs.push(cx - 28, cx + 28)
  }

  let bestPhase = 0
  let bestScore = -Infinity

  for (let phase = 0; phase < gridSpec.pitchY; phase += 2) {
    let acc = 0
    let samples = 0
    let darkCount = 0
    for (let k = -1; k <= gridSpec.rows; k++) {
      const yTop = gridSpec.originY + phase + k * gridSpec.pitchY
      const yBot = yTop + gridSpec.tileH
      if (yBot < gridSpec.clipTopY + 4 || yBot + 9 > gridSpec.clipBottomY - 2) continue

      for (const sx of sampleXs) {
        const gMid = Math.max(
          lumFn(sx, yBot + 2.5),
          lumFn(sx, yBot + 4.0),
          lumFn(sx, yBot + 5.5),
        )
        const bBot = Math.max(lumFn(sx, yBot - 0.6), lumFn(sx, yBot - 1.4))
        const bNext = Math.max(lumFn(sx, yBot + 8.6), lumFn(sx, yBot + 9.4))
        if (gMid < 42) {
          acc +=
            Math.min(40, Math.max(0, bBot - gMid)) * 0.55 +
            Math.min(40, Math.max(0, bNext - gMid)) * 0.45
          darkCount++
        } else {
          acc -= (gMid - 32) * 0.75
        }
        samples++
      }
    }
    if (samples > 0 && darkCount >= samples * 0.7) {
      const prior = phase <= 1 || phase >= gridSpec.pitchY - 1 ? 1.2 : 0
      const avg = acc / samples + prior
      if (avg > bestScore) {
        bestScore = avg
        bestPhase = phase
      }
    }
  }

  const rows = []
  for (let k = -1; k <= gridSpec.rows; k++) {
    const yTop = gridSpec.originY + bestPhase + k * gridSpec.pitchY
    if (yTop >= gridSpec.clipTopY - 2 && yTop + gridSpec.tileH <= gridSpec.clipBottomY + 2) {
      rows.push(yTop)
    }
  }
  return rows.length ? rows : defaultRows
}

/**
 * 提取 152x96 商品/制作网格当前屏特征签名（用于判断滚轮是否到底/到顶）
 */
export function computeOfferGridSignature(imageData, vp, gridSpec) {
  const sigCols = 15
  const sigRows = 24
  const sig = new Float32Array(sigCols * sigRows)
  const wSpan = gridSpec.cols * gridSpec.pitchX - 16
  const hSpan = gridSpec.clipBottomY - gridSpec.clipTopY - 24
  let idx = 0
  for (let r = 0; r < sigRows; r++) {
    const y = gridSpec.clipTopY + 12 + (r / (sigRows - 1)) * hSpan
    for (let c = 0; c < sigCols; c++) {
      const x = gridSpec.originX + 8 + (c / (sigCols - 1)) * wSpan
      sig[idx++] = lumAt(imageData, vp, x, y)
    }
  }
  return sig
}

export function didOfferGridScrollChange(prevSig, nextSig) {
  if (!prevSig || !nextSig || prevSig.length !== nextSig.length) return false
  let sum = 0
  for (let i = 0; i < prevSig.length; i++) sum += Math.abs(prevSig[i] - nextSig[i])
  return sum / prevSig.length >= 2.2
}

/**
 * 检测 152x96 OfferTile 右下价格栏是否出现红字不足 (如免费配装强化券 0/1 或限购售罄)
 */
function hasOfferTileRedFooterCost(imageData, vp, r1080) {
  const rgb = [0, 0, 0]
  let redPx = 0
  for (let y = r1080.y + 76; y <= r1080.y + 92; y += 3) {
    for (let x = r1080.x + 92; x <= r1080.x + 146; x += 6) {
      rgbAt(imageData, vp, x, y, rgb)
      if (rgb[0] >= 145 && rgb[0] - rgb[1] >= 58 && rgb[0] - rgb[2] >= 58) {
        redPx++
      }
    }
  }
  return redPx >= 3
}

/**
 * 在 152x96 商品/制作格子的宽幅上区采样武器 44x22 浮点观测量
 */
function sampleOfferWeaponBox(imageData, frect) {
  const { data, width: W, height: H } = imageData
  const bw = frect.w * OFFER_WEAPON_BOX_FRAC.wf
  const bh = frect.h * OFFER_WEAPON_BOX_FRAC.hf
  const x0 = frect.x + frect.w * OFFER_WEAPON_BOX_FRAC.cx - bw * 0.5
  const y0 = frect.y + frect.h * OFFER_WEAPON_BOX_FRAC.cy - bh * 0.5

  const len = WP_W * WP_H
  const obsR = new Float32Array(len)
  const obsG = new Float32Array(len)
  const obsB = new Float32Array(len)
  const obsLum = new Float32Array(len)
  const valid = new Float32Array(len)
  const rgb = [0, 0, 0]

  for (let j = 0; j < WP_H; j++) {
    const fy = y0 + ((j + 0.5) * bh) / WP_H
    const relY = (fy - frect.y) / Math.max(1, frect.h)
    for (let i = 0; i < WP_W; i++) {
      const fx = x0 + ((i + 0.5) * bw) / WP_W
      const relX = (fx - frect.x) / Math.max(1, frect.w)
      const idx = j * WP_W + i
      bilerpRgb(data, W, H, fx, fy, rgb)
      obsR[idx] = rgb[0]
      obsG[idx] = rgb[1]
      obsB[idx] = rgb[2]
      obsLum[idx] = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
      valid[idx] = relX < 0.18 && relY > 0.52 ? 0 : 1
    }
  }

  const cornerMedian = (xs, xe, ys, ye) => {
    const rs = []
    const gs = []
    const bs = []
    for (let y = ys; y < ye; y++) {
      for (let x = xs; x < xe; x++) {
        const k = y * WP_W + x
        rs.push(obsR[k])
        gs.push(obsG[k])
        bs.push(obsB[k])
      }
    }
    return [medianOf(rs), medianOf(gs), medianOf(bs)]
  }

  const tl = cornerMedian(0, 4, 0, 3)
  const tr = cornerMedian(WP_W - 4, WP_W, 0, 3)
  const br = cornerMedian(WP_W - 4, WP_W, WP_H - 3, WP_H)
  const bl = cornerMedian(0, 3, Math.floor(WP_H * 0.45), Math.floor(WP_H * 0.68))

  const bgR = new Float32Array(len)
  const bgG = new Float32Array(len)
  const bgB = new Float32Array(len)
  for (let j = 0; j < WP_H; j++) {
    const v = j / (WP_H - 1)
    for (let i = 0; i < WP_W; i++) {
      const u = i / (WP_W - 1)
      const idx = j * WP_W + i
      const w00 = (1 - u) * (1 - v)
      const w10 = u * (1 - v)
      const w01 = (1 - u) * v
      const w11 = u * v
      bgR[idx] = w00 * tl[0] + w10 * tr[0] + w01 * bl[0] + w11 * br[0]
      bgG[idx] = w00 * tl[1] + w10 * tr[1] + w01 * bl[1] + w11 * br[1]
      bgB[idx] = w00 * tl[2] + w10 * tr[2] + w01 * bl[2] + w11 * br[2]
    }
  }

  const gx = new Float32Array(len)
  const gy = new Float32Array(len)
  const validGrad = new Float32Array(len)
  for (let j = 1; j < WP_H - 1; j++) {
    for (let i = 1; i < WP_W - 1; i++) {
      const idx = j * WP_W + i
      gx[idx] = obsLum[idx + 1] - obsLum[idx - 1]
      gy[idx] = obsLum[idx + WP_W] - obsLum[idx - WP_W]
      validGrad[idx] =
        valid[idx] * valid[idx + 1] * valid[idx - 1] * valid[idx + WP_W] * valid[idx - WP_W]
    }
  }

  return { w: WP_W, h: WP_H, obsR, obsG, obsB, obsLum, bgR, bgG, bgB, gx, gy, valid, validGrad }
}

function scoreSingleOfferTileForTarget(
  imageData,
  vp,
  r1080,
  kind,
  targetId,
  db,
  targetTpl,
  tplMap,
) {
  // 152x96 左侧 96x96 对齐左缘底栏图标 & 品质三角，居中 96x96 对齐方形图标中心
  const leftTile1080 = { x: r1080.x, y: r1080.y, w: r1080.h, h: r1080.h }
  const leftFrect = mapRectFloat(leftTile1080, vp)
  const state = analyzeCardState(imageData, leftFrect, 'tile')
  if (!state.occupied) return null

  const centerSquare1080 = {
    x: r1080.x + (r1080.w - r1080.h) * 0.5,
    y: r1080.y,
    w: r1080.h,
    h: r1080.h,
  }
  const centerFrect = mapRectFloat(centerSquare1080, vp)
  const isWeapon = kind === 'weapon'

  if (isWeapon) {
    const wMeta = weaponMetaById.get(targetId)
    if (!wMeta) return null
    const baseVariants = weaponVariantsOf(wMeta).filter((v) => !v.asc)
    if (!baseVariants.length) return null

    if (state.rarityConfident && state.rarity && state.rarity !== wMeta.rarity) {
      return null
    }
    const ammo = db.ammo?.size
      ? classifyGlyph(
          imageData,
          { x: r1080.x + OFFER_TILE_BADGE.x, y: r1080.y + OFFER_TILE_BADGE.y, w: OFFER_TILE_BADGE.w, h: OFFER_TILE_BADGE.h },
          vp,
          db.ammo,
        )
      : { key: null, confident: false }
    if (ammo.confident && ammo.key !== wMeta.ammo) return null

    const offerFrect = mapRectFloat(r1080, vp)
    const obsWide = sampleOfferWeaponBox(imageData, offerFrect)
    const obsSmall = sampleIconBoxBilerp(imageData, centerFrect, 'tile', SQ_W, SQ_H)

    const scoreWp = (w) => {
      const rar = w.rarity
      if (state.rarityConfident && state.rarity && rar && state.rarity !== rar) return -Infinity
      const big = db.weaponVariants?.get(`${w.id}|base|big`) || db.weapons.get(w.id)
      const small = db.weaponVariants?.get(`${w.id}|base|small`)
      let s = -Infinity
      if (big) s = Math.max(s, scoreTemplateAgainstObs(obsWide, state, big))
      if (small) s = Math.max(s, scoreTemplateAgainstObs(obsSmall, state, small))
      return s
    }

    const targetScore = scoreWp(wMeta)
    const uniqueByCues =
      ammo.confident &&
      ammo.key === wMeta.ammo &&
      state.rarityConfident &&
      state.rarity === wMeta.rarity &&
      !(weaponsData.weapons || []).some(
        (rw) => rw.id !== targetId && rw.ammo === ammo.key && rw.rarity === state.rarity,
      )

    if (!Number.isFinite(targetScore) || targetScore < (uniqueByCues ? 0.2 : 0.46)) {
      return null
    }

    for (const rw of uniqueByCues ? [] : weaponsData.weapons || []) {
      if (rw.id === targetId) continue
      if (ammo.confident && rw.ammo !== ammo.key) continue
      const rs = scoreWp(rw)
      if (Number.isFinite(rs) && rs > targetScore + 0.04) return null
    }

    return {
      score: targetScore + (ammo.confident ? 0.05 : 0) + (uniqueByCues ? 0.35 : 0),
      rawScore: targetScore,
      hasRedCost: hasOfferTileRedFooterCost(imageData, vp, r1080),
    }
  }

  // 非武器方形物品 (强化/护盾/配件/消耗品)
  const targetRarity = targetTpl?.meta?.rarity || null
  if (state.rarityConfident && state.rarity && targetRarity && state.rarity !== targetRarity) {
    return null
  }

  const obs = sampleIconBoxBilerp(imageData, centerFrect, 'tile', SQ_W, SQ_H)
  const targetScore = scoreTemplateAgainstObs(obs, state, targetTpl)
  if (targetScore < 0.5) return null

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
    const otherSc = scoreTemplateAgainstObs(obs, state, otherTpl)
    if (otherSc > targetScore + 0.038) return null
  }

  return {
    score: targetScore,
    rawScore: targetScore,
    hasRedCost: hasOfferTileRedFooterCost(imageData, vp, r1080),
  }
}

/**
 * 在当前 152x96 商品/制作网格中检索所有匹配 targetId 的候选格，按可购买性（非红字成本）与置信度降序返回
 */
export async function findOfferTilesInGrid(imageData, vp, gridSpec, kind, targetId) {
  if (!imageData || !vp || !gridSpec || !targetId) return []
  const db = await ensureLoadoutTemplates()
  const tplMap =
    kind === 'augment'
      ? db.augments
      : kind === 'shield'
        ? db.shields
        : kind === 'mod'
          ? db.modTiles
          : kind === 'weapon'
            ? db.weapons
            : db.items
  const targetTpl = tplMap?.get(targetId) || null
  if (kind !== 'weapon' && !targetTpl) return []

  const rowOrigins = detectOfferRowOrigins1080p(imageData, vp, gridSpec)
  const { width: W, height: H } = imageData
  const matches = []

  for (let row = 0; row < rowOrigins.length; row++) {
    const rowY = rowOrigins[row]
    for (let col = 0; col < gridSpec.cols; col++) {
      const r1080 = {
        x: gridSpec.originX + col * gridSpec.pitchX,
        y: rowY,
        w: gridSpec.tileW,
        h: gridSpec.tileH,
      }
      const res = scoreSingleOfferTileForTarget(
        imageData,
        vp,
        r1080,
        kind,
        targetId,
        db,
        targetTpl,
        tplMap,
      )
      if (!res) continue

      // 非红字价格 (Coin 可直接购买/制作) 排在前面，自动越过兰斯第 0 行免费券以物易物格
      const rankScore = res.score - (res.hasRedCost ? 0.4 : 0)
      matches.push({
        row,
        col,
        score: +res.rawScore.toFixed(3),
        rankScore: +rankScore.toFixed(3),
        hasRedCost: res.hasRedCost,
        normX: clamp((vp.ox + (r1080.x + r1080.w * 0.5) * vp.scale) / W, 0.02, 0.98),
        normY: clamp((vp.oy + (r1080.y + r1080.h * 0.5) * vp.scale) / H, 0.02, 0.98),
      })
    }
  }

  matches.sort((a, b) => b.rankScore - a.rankScore)
  return matches
}

/**
 * 在「武器工作台 -> 武器升级 (WBP_GeneratorScreenUpgradeTab)」左侧手风琴列表中查找可升阶的 targetWeaponId 格子
 */
export async function findUpgradableWeaponTiles(imageData, vp, targetWeaponId) {
  if (!imageData || !vp || !targetWeaponId) return []
  const db = await ensureLoadoutTemplates()
  const wMeta = weaponMetaById.get(targetWeaponId)
  if (!wMeta) return []

  const { width: W, height: H } = imageData
  const grid = WORKSHOP_1080P.craftGrid
  const candidates = []

  // 手风琴各品质分区标题高度不定，沿每列以 6px 纵向步长搜索对齐 152x96 武器卡片
  for (let col = 0; col < grid.cols; col++) {
    const x1080 = grid.originX + col * grid.pitchX
    const colHits = []

    for (let y1080 = 152; y1080 <= 872; y1080 += 6) {
      const r1080 = { x: x1080, y: y1080, w: grid.tileW, h: grid.tileH }
      const res = scoreSingleOfferTileForTarget(
        imageData,
        vp,
        r1080,
        'weapon',
        targetWeaponId,
        db,
        null,
        db.weapons,
      )
      if (!res) continue
      colHits.push({
        col,
        y1080,
        score: res.rawScore,
        hasRedCost: res.hasRedCost,
        normX: clamp((vp.ox + (r1080.x + r1080.w * 0.5) * vp.scale) / W, 0.02, 0.98),
        normY: clamp((vp.oy + (r1080.y + r1080.h * 0.5) * vp.scale) / H, 0.02, 0.98),
      })
    }

    // 同列非极大值抑制 (卡片高度 96px + 8px 暗缝)
    colHits.sort((a, b) => b.score - a.score)
    const kept = []
    for (const h of colHits) {
      if (kept.every((k) => Math.abs(k.y1080 - h.y1080) >= 84)) {
        kept.push(h)
      }
    }
    candidates.push(...kept)
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates
}
