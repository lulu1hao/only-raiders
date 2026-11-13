/**
 * raiderVisionRecognizer.js
 *
 * 奇袭者（Raider）实机技能树截图视觉识别与门控弹窗卡片定位引擎（纯前端 Canvas 2D，零机器学习依赖）
 *
 * 核心几何基准（经实机 1080p/576p 截图验证）：
 * - 游戏内技能树为不可缩放平移的全屏居中视口，raiderSkillsData.json 的 (node.x, node.y)
 *   直接对应 1920x1080 分辨率下相对于屏幕中心 (960, 540) 的 1:1 像素偏移：
 *     S = Math.min(W / 1920, H / 1080)
 *     px = W / 2 + node.x * S
 *     py = H / 2 + node.y * S
 */

import { assetUrl } from './questItemIcons.js'

const MASK_SIZE = 24
let cachedIconMasksPromise = null
let cachedDigitTemplates = null

/**
 * 判断像素是否属于指定分支的高亮主题色
 * - conditioning (强化): #1fff76 (翠绿)
 * - mobility     (机动): #ffd205 (明黄)
 * - survival     (生存): #f60010 (赤红)
 */
export function isBranchHighlightPixel(r, g, b, branch) {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b
  const min = r < g ? (r < b ? r : b) : g < b ? g : b
  const sat = max - min
  if (sat < 70 || max < 115) return false

  if (branch === 'conditioning') {
    return g > 140 && g > r + 50 && g >= b
  }
  if (branch === 'mobility') {
    return r > 150 && g > 120 && b < 105 && Math.abs(r - g) < 95
  }
  if (branch === 'survival') {
    return r > 145 && r > g + 75 && r > b + 75
  }
  return false
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function bilinearMaxChannel(data, width, height, fx, fy) {
  const cx = clamp(fx, 0, width - 1.001)
  const cy = clamp(fy, 0, height - 1.001)
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  const tx = cx - x0
  const ty = cy - y0

  const idx00 = (y0 * width + x0) * 4
  const idx10 = idx00 + 4
  const idx01 = idx00 + width * 4
  const idx11 = idx01 + 4

  const m00 = Math.max(data[idx00], data[idx00 + 1], data[idx00 + 2])
  const m10 = Math.max(data[idx10], data[idx10 + 1], data[idx10 + 2])
  const m01 = Math.max(data[idx01], data[idx01 + 1], data[idx01 + 2])
  const m11 = Math.max(data[idx11], data[idx11 + 1], data[idx11 + 2])

  return (m00 * (1 - tx) + m10 * tx) * (1 - ty) + (m01 * (1 - tx) + m11 * tx) * ty
}

/**
 * 计算两个等长浮点向量的归一化互相关系数 (Pearson NCC, [-1, 1])
 */
export function computeNCC(a, b) {
  const n = a.length
  if (!n || n !== b.length) return 0
  let sumA = 0
  let sumB = 0
  for (let i = 0; i < n; i++) {
    sumA += a[i]
    sumB += b[i]
  }
  const meanA = sumA / n
  const meanB = sumB / n
  let num = 0
  let denA = 0
  let denB = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA
    const db = b[i] - meanB
    num += da * db
    denA += da * da
    denB += db * db
  }
  if (denA <= 1e-6 || denB <= 1e-6) return 0
  return num / Math.sqrt(denA * denB)
}

/**
 * 从 RGBA 数据提取指定紧致包围盒并重采样为 24x24 归一化正方形掩码
 */
function resampleSquareMask24(sampleFn, minX, maxX, minY, maxY) {
  const bw = Math.max(1, maxX - minX + 1)
  const bh = Math.max(1, maxY - minY + 1)
  const side = Math.max(bw, bh)
  const ox = minX - (side - bw) * 0.5
  const oy = minY - (side - bh) * 0.5
  const out = new Float32Array(MASK_SIZE * MASK_SIZE)

  // 每个目标网格做 2x2 超采样抗锯齿
  const step = side / MASK_SIZE
  for (let j = 0; j < MASK_SIZE; j++) {
    for (let i = 0; i < MASK_SIZE; i++) {
      let acc = 0
      for (let sy = 0.25; sy <= 0.75; sy += 0.5) {
        for (let sx = 0.25; sx <= 0.75; sx += 0.5) {
          acc += sampleFn(ox + (i + sx) * step, oy + (j + sy) * step)
        }
      }
      out[j * MASK_SIZE + i] = acc * 0.25
    }
  }
  return out
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = src
  })
}

/**
 * 预加载并缓存所有门控候选技能（或全部技能）的 24x24 标准 Alpha 形状掩码
 */
export async function ensureSkillIconMasks(tree) {
  if (cachedIconMasksPromise) return cachedIconMasksPromise

  cachedIconMasksPromise = (async () => {
    const masks = {}
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    const entries = Object.values(tree?.skills || {})
    await Promise.all(
      entries.map(async (sk) => {
        if (!sk?.icon) return
        try {
          const img = await loadImageElement(assetUrl(sk.icon))
          ctx.clearRect(0, 0, 128, 128)
          ctx.drawImage(img, 0, 0, 128, 128)
          const { data } = ctx.getImageData(0, 0, 128, 128)

          let minX = 128
          let maxX = -1
          let minY = 128
          let maxY = -1
          for (let y = 0; y < 128; y++) {
            for (let x = 0; x < 128; x++) {
              const a = data[(y * 128 + x) * 4 + 3]
              if (a > 80) {
                if (x < minX) minX = x
                if (x > maxX) maxX = x
                if (y < minY) minY = y
                if (y > maxY) maxY = y
              }
            }
          }
          if (maxX < minX || maxY < minY) return

          masks[sk.id] = resampleSquareMask24(
            (fx, fy) => {
              const ix = clamp(Math.round(fx), 0, 127)
              const iy = clamp(Math.round(fy), 0, 127)
              return data[(iy * 128 + ix) * 4 + 3] / 255
            },
            minX,
            maxX,
            minY,
            maxY,
          )
        } catch {
          // 忽略个别图标加载异常
        }
      }),
    )
    return masks
  })()

  return cachedIconMasksPromise
}

/**
 * 构建用于 1/5 ~ 4/5 分子识别的 6x8 标准字模模板 ('1', '2', '3', '4')
 */
function ensureDigitTemplates() {
  if (cachedDigitTemplates) return cachedDigitTemplates
  cachedDigitTemplates = {}
  if (typeof document === 'undefined') return cachedDigitTemplates

  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d', { willReadFrequently: true })

  for (const d of [1, 2, 3, 4]) {
    ctx.clearRect(0, 0, 32, 32)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, 32, 32)
    ctx.fillStyle = '#fff'
    ctx.font = '700 22px "Barlow", "Segoe UI", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(d), 16, 16)

    const { data } = ctx.getImageData(0, 0, 32, 32)
    let xMin = 31
    let xMax = 0
    let yMin = 31
    let yMax = 0
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        if (data[(y * 32 + x) * 4] > 90) {
          if (x < xMin) xMin = x
          if (x > xMax) xMax = x
          if (y < yMin) yMin = y
          if (y > yMax) yMax = y
        }
      }
    }
    const bw = Math.max(1, xMax - xMin)
    const bh = Math.max(1, yMax - yMin)
    const tpl = new Float32Array(6 * 8)
    for (let r = 0; r < 8; r++) {
      for (let col = 0; col < 6; col++) {
        const sx = clamp(Math.round(xMin + (col / 5) * bw), 0, 31)
        const sy = clamp(Math.round(yMin + (r / 7) * bh), 0, 31)
        tpl[r * 6 + col] = data[(sy * 32 + sx) * 4] / 255
      }
    }
    cachedDigitTemplates[d] = tpl
  }
  return cachedDigitTemplates
}

/**
 * 计算截图视口变换参数
 * 经实机 1080p/576p 验证，游戏 UMG 视口严格以 (W/2, H/2) 为原点按 S = min(W/1920, H/1080) 等比缩放
 */
export function computeViewportTransform(imageData) {
  const { width: W, height: H } = imageData
  const scale = Math.min(W / 1920, H / 1080)
  const originX = W * 0.5
  const originY = H * 0.5

  return {
    width: W,
    height: H,
    scale,
    originX,
    originY,
    nodeToPixel(node) {
      return {
        x: originX + node.x * scale,
        y: originY + node.y * scale,
      }
    },
  }
}

/**
 * 检测当前画面属于：
 * - 'tree'       : 奇袭者技能树主界面
 * - 'gate_modal' : 2选1 / 3选2 门控技能选择界面（图3）
 * - 'unknown'    : 其他非技能树画面
 */
export function detectRaiderScreenKind(imageData) {
  const { width: W, height: H, data } = imageData
  if (W < 400 || H < 250) return 'unknown'

  // 1. 检查背景整体暗度（技能树与门控界面均为深色背景 #060a14）
  const bgProbes = [
    [0.12, 0.18],
    [0.88, 0.18],
    [0.15, 0.82],
    [0.85, 0.82],
  ]
  let darkBgHits = 0
  for (const [rx, ry] of bgProbes) {
    const px = Math.round(rx * W)
    const py = Math.round(ry * H)
    const idx = (py * W + px) * 4
    const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
    if (lum < 42) darkBgHits++
  }
  if (darkBgHits < 3) return 'unknown'

  // 2. 检查是否为图 3 门控选择弹窗：底部 y=0.877H 处存在左右两个浅灰色胶囊按钮
  //    左按钮「消耗点数」x ∈ [0.32W, 0.47W]，右按钮「关闭」x ∈ [0.53W, 0.67W]，中间 x=0.50W 为深黑间隙
  const btnY = Math.round(0.877 * H)
  let leftBtnBright = 0
  let rightBtnBright = 0
  for (let k = 0; k < 7; k++) {
    const lx = Math.round((0.33 + k * 0.02) * W)
    const rx = Math.round((0.54 + k * 0.02) * W)
    const li = (btnY * W + lx) * 4
    const ri = (btnY * W + rx) * 4
    if (data[li] > 115 && data[li + 1] > 115 && data[li + 2] > 115) leftBtnBright++
    if (data[ri] > 115 && data[ri + 1] > 115 && data[ri + 2] > 115) rightBtnBright++
  }
  const gapIdx = (btnY * W + Math.round(0.5 * W)) * 4
  const gapDark = (data[gapIdx] + data[gapIdx + 1] + data[gapIdx + 2]) / 3 < 45
  if (leftBtnBright >= 5 && rightBtnBright >= 5 && gapDark) {
    return 'gate_modal'
  }

  // 3. 检查底部中央三条主干颜色轨道（绿/黄/红根部样条线 y ≈ 0.90H, x ≈ 0.5W 附近）
  const stemY = Math.round(0.91 * H)
  let greenHit = false
  let yellowHit = false
  let redHit = false
  const scanX0 = Math.max(0, Math.round(0.45 * W))
  const scanX1 = Math.min(W - 1, Math.round(0.55 * W))
  for (let x = scanX0; x <= scanX1; x++) {
    const idx = (stemY * W + x) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    if (isBranchHighlightPixel(r, g, b, 'conditioning')) greenHit = true
    if (isBranchHighlightPixel(r, g, b, 'mobility')) yellowHit = true
    if (isBranchHighlightPixel(r, g, b, 'survival')) redHit = true
  }

  if ((greenHit && yellowHit) || (yellowHit && redHit) || (greenHit && redHit)) {
    return 'tree'
  }

  return 'unknown'
}

/**
 * 识别部分加点节点（1/5 ~ 4/5）底部胶囊角标中的分子数字 (1 | 2 | 3 | 4)
 * 返回按置信度降序排列的候选评分数组 [{ digit, score }, ...]
 */
function recognizePartialNumerator(imageData, cx, cy, scale) {
  const { data, width: W, height: H } = imageData
  const digitTemplates = ensureDigitTemplates()

  // 在 1080p 基准下，节点圆心下方胶囊左侧分子数字位于 dx ∈ [-12.8, -5.3], dy ∈ [18.3, 28.1]（避开右侧斜杠 '/' 与胶囊边圆角）
  const vals = new Float32Array(16 * 16)
  let minV = Infinity
  let maxV = -Infinity

  for (let j = 0; j < 16; j++) {
    const dy = (18.3 + (j / 15) * 9.8) * scale
    for (let i = 0; i < 16; i++) {
      const dx = (-12.8 + (i / 15) * 7.5) * scale
      const v = bilinearMaxChannel(data, W, H, cx + dx, cy + dy)
      vals[j * 16 + i] = v
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
  }

  const span = Math.max(1, maxV - minV)
  let xMin = 15
  let xMax = 0
  let yMin = 15
  let yMax = 0
  let leftMargin = 0
  let topRight = 0
  let lowLeft = 0
  let lowRight = 0
  let crossBar = 0

  for (let j = 0; j < 16; j++) {
    for (let i = 0; i < 16; i++) {
      const nv = (vals[j * 16 + i] - minV) / span
      vals[j * 16 + i] = nv
      if (nv > 0.45) {
        if (i < xMin) xMin = i
        if (i > xMax) xMax = i
        if (j < yMin) yMin = j
        if (j > yMax) yMax = j
      }
      if (i <= 2) leftMargin += nv
      if (j <= 3 && i >= 8) topRight += nv
      if (j >= 9 && j <= 13 && i >= 2 && i <= 7) lowLeft += nv
      if (j >= 9 && j <= 13 && i >= 10 && i <= 15) lowRight += nv
      if (j >= 9 && j <= 12) crossBar += nv
    }
  }

  if (xMax < xMin || yMax < yMin) {
    return [
      { digit: 1, score: 0.25 },
      { digit: 2, score: 0.2 },
      { digit: 3, score: 0.15 },
      { digit: 4, score: 0.1 },
    ]
  }

  const aspectW = xMax - xMin + 1
  const bw = Math.max(1, xMax - xMin)
  const bh = Math.max(1, yMax - yMin)

  const glyph6x8 = new Float32Array(6 * 8)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 6; c++) {
      const si = clamp(Math.round(xMin + (c / 5) * bw), 0, 15)
      const sj = clamp(Math.round(yMin + (r / 7) * bh), 0, 15)
      glyph6x8[r * 6 + c] = vals[sj * 16 + si]
    }
  }

  // 基于字符笔画拓扑不变量的判别分（在 576p~4K 实机图上对 1/2/3/4 具备大间隔分离度）
  const scores = { 1: 0, 2: 0, 3: 0, 4: 0 }

  // '1': 单竖干居中，左侧留白极宽 (leftMargin < 8.5, xMin >= 3, aspectW <= 13)
  if (leftMargin < 8.5) scores[1] += 1.5
  else scores[1] -= 0.85
  if (xMin >= 3 && aspectW <= 13) scores[1] += 1.1
  else scores[1] -= 0.65

  // '4': 右上象限完全悬空 (topRight < 10.5)，且中下部满宽横杠极密 (crossBar > 36.5)
  if (topRight < 10.5) scores[4] += 1.45
  else scores[4] -= 0.8
  if (crossBar > 36.5) scores[4] += 1.2
  else scores[4] -= 0.45

  // '2' vs '3': 均在左边界有笔画且右上饱满，核心拓扑差异在下半腰部 (j = 9..13)：
  //   - '2' 斜撇向左下穿过 (lowLeft > lowRight)，右下悬空
  //   - '3' 下半圆弧绕右下闭合 (lowRight > lowLeft)，左下悬空且顶部为平横杠
  if (leftMargin >= 8.5 && topRight >= 10.5) {
    if (lowLeft > lowRight + 1.2) {
      scores[2] += 1.55
      scores[3] -= 0.45
    } else if (lowRight > lowLeft + 1.2) {
      scores[3] += 1.55
      scores[2] -= 0.45
    }
    if (lowRight < 12.5) scores[2] += 0.65
    if (lowRight >= 13.0 && topRight >= 20.0) scores[3] += 0.75
  }

  // 叠加 Canvas 标准字模 NCC 相似度作为辅助参考
  for (const d of [1, 2, 3, 4]) {
    if (digitTemplates[d]) {
      scores[d] += computeNCC(glyph6x8, digitTemplates[d]) * 0.45
    }
  }

  return [1, 2, 3, 4]
    .map((digit) => ({ digit, score: scores[digit] }))
    .sort((a, b) => b.score - a.score)
}

/**
 * 检测左下角是否出现「R 重置」提示（存在已投入技能点时游戏会渲染该按钮）
 */
function detectHasAllocatedResetPrompt(imageData) {
  const { width: W, height: H, data } = imageData
  // 在 1080p 中，「R」按键方块位于约 x ∈ [0.195W, 0.220W], y ∈ [0.942H, 0.968H]
  const x0 = Math.round(0.196 * W)
  const x1 = Math.round(0.218 * W)
  const y0 = Math.round(0.944 * H)
  const y1 = Math.round(0.966 * H)
  let greyKeyPixels = 0
  let total = 0
  for (let y = y0; y <= y1; y += 2) {
    for (let x = x0; x <= x1; x += 2) {
      total++
      const idx = (y * W + x) * 4
      const lum = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
      if (lum > 75 && lum < 210) greyKeyPixels++
    }
  }
  return total > 0 && greyKeyPixels / total > 0.28
}

/**
 * 从实机技能树截图识别完整的加点存档（allocations + gateSelections）
 */
export async function recognizeBuildFromImageData(imageData, tree) {
  const screenKind = detectRaiderScreenKind(imageData)
  if (screenKind === 'gate_modal') {
    return {
      ok: false,
      screenKind,
      error: '当前画面处于「门控技能二选一/三选二弹窗」，请先返回技能树主界面再截图识别。',
    }
  }
  if (screenKind === 'unknown') {
    return {
      ok: false,
      screenKind,
      error: '未检测到奇袭者技能树界面，请确保游戏处于全屏/无边框「奇袭者 → 技能树」画面。',
    }
  }

  const iconMasks = await ensureSkillIconMasks(tree)
  const tf = computeViewportTransform(imageData, tree)
  const { width: W, height: H, data } = imageData
  const S = tf.scale

  const allocations = {}
  const gateSelections = {}
  const partialRankingByNodeId = new Map()
  const rawGateScoresByGroup = new Map()

  for (const node of tree.nodes) {
    const { x: cx, y: cy } = tf.nodeToPixel(node)

    if (node.kind === 'normal') {
      const sk = tree.skills[node.skillId]
      const maxPts = sk?.maxPoints || 1
      const isLarge = node.shape === 'large-circle'

      // 1. 采样圆内区域与环形护城河区域（避开中心反色图标剪影）
      const innerR = (isLarge ? 29.0 : 17.0) * S
      const iconR = (isLarge ? 20.0 : 13.0) * S
      const moatRMin = (isLarge ? 23.0 : 13.8) * S
      const moatRMax = (isLarge ? 35.0 : 20.2) * S

      const scanR = Math.ceil(Math.max(innerR, moatRMax))
      let innerCnt = 0
      let innerColored = 0
      let iconCnt = 0
      let iconColored = 0
      let moatCnt = 0
      let moatColored = 0

      for (let dy = -scanR; dy <= scanR; dy++) {
        for (let dx = -scanR; dx <= scanR; dx++) {
          const d2 = dx * dx + dy * dy
          if (d2 > moatRMax * moatRMax) continue
          const px = clamp(Math.round(cx + dx), 0, W - 1)
          const py = clamp(Math.round(cy + dy), 0, H - 1)
          const idx = (py * W + px) * 4
          const colored = isBranchHighlightPixel(
            data[idx],
            data[idx + 1],
            data[idx + 2],
            node.branch,
          )

          if (d2 <= innerR * innerR) {
            innerCnt++
            if (colored) innerColored++
          }
          if (d2 <= iconR * iconR) {
            iconCnt++
            if (colored) iconColored++
          }
          if (d2 >= moatRMin * moatRMin && d2 <= moatRMax * moatRMax) {
            moatCnt++
            if (colored) moatColored++
          }
        }
      }

      const innerRatio = innerColored / Math.max(1, innerCnt)
      const iconRatio = iconColored / Math.max(1, iconCnt)
      const moatRatio = moatColored / Math.max(1, moatCnt)

      // 实心满级判定：护城河纯色占比高或整个内盘纯色占比高
      if (moatRatio >= 0.42 || innerRatio >= 0.44) {
        allocations[node.skillId] = maxPts
      } else if (maxPts > 1 && iconRatio >= 0.045) {
        // 5点技能部分加点 (1/5 ~ 4/5)：背景护城河深黑，中心图标为高亮分支色
        const ranked = recognizePartialNumerator(imageData, cx, cy, S)
        partialRankingByNodeId.set(node.nodeId, ranked)
        allocations[node.skillId] = ranked[0].digit
      }
      // 否则为 0 点（不写入 allocations）
    } else {
      // 门控菱形槽（choice 2选1 / capstone 3选2）
      const fillLim = Math.ceil(24.0 * S)
      let diamondCnt = 0
      let diamondColored = 0
      for (let dy = -fillLim; dy <= fillLim; dy++) {
        for (let dx = -fillLim; dx <= fillLim; dx++) {
          const manhattan = Math.abs(dx) + Math.abs(dy)
          if (manhattan <= 25.0 * S) {
            diamondCnt++
            const px = clamp(Math.round(cx + dx), 0, W - 1)
            const py = clamp(Math.round(cy + dy), 0, H - 1)
            const idx = (py * W + px) * 4
            if (isBranchHighlightPixel(data[idx], data[idx + 1], data[idx + 2], node.branch)) {
              diamondColored++
            }
          }
        }
      }

      const diamondFillRatio = diamondColored / Math.max(1, diamondCnt)
      if (diamondFillRatio < 0.28) continue

      // 菱形已激活：提取内部反色黑色剪影 (|dx| + |dy| <= 34 * S)
      const silLim = Math.ceil(28.0 * S)
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity

      for (let dy = -silLim; dy <= silLim; dy++) {
        for (let dx = -silLim; dx <= silLim; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= 34.0 * S) {
            const px = clamp(Math.round(cx + dx), 0, W - 1)
            const py = clamp(Math.round(cy + dy), 0, H - 1)
            const idx = (py * W + px) * 4
            const mx = Math.max(data[idx], data[idx + 1], data[idx + 2])
            if (mx < 135) {
              if (px < minX) minX = px
              if (px > maxX) maxX = px
              if (py < minY) minY = py
              if (py > maxY) maxY = py
            }
          }
        }
      }

      const candScores = []
      if (maxX >= minX && maxY >= minY) {
        const obsMask = resampleSquareMask24(
          (fx, fy) => {
            const mx = bilinearMaxChannel(data, W, H, fx, fy)
            return clamp((220 - mx) / 200, 0, 1)
          },
          minX,
          maxX,
          minY,
          maxY,
        )

        for (const cid of node.candidateIds || []) {
          const tpl = iconMasks[cid]
          const sc = tpl ? computeNCC(obsMask, tpl) : 0
          candScores.push({ cid, score: sc })
        }
      } else {
        for (const cid of node.candidateIds || []) {
          candScores.push({ cid, score: 0 })
        }
      }

      candScores.sort((a, b) => b.score - a.score)
      const list = rawGateScoresByGroup.get(node.groupId) || []
      list.push({ node, candScores })
      rawGateScoresByGroup.set(node.groupId, list)
    }
  }

  // 门控组联合最优指派（保证同一互斥组 3选2 绝不选出重复技能）
  for (const [, slots] of rawGateScoresByGroup.entries()) {
    slots.sort((a, b) => (a.node.slotIndex || 0) - (b.node.slotIndex || 0))
    if (slots.length === 1) {
      const chosen = slots[0].candScores[0]?.cid
      if (chosen) {
        gateSelections[slots[0].node.slotKey] = chosen
        allocations[chosen] = 1
      }
    } else if (slots.length >= 2) {
      let bestPair = null
      let bestSum = -Infinity
      for (const a of slots[0].candScores) {
        for (const b of slots[1].candScores) {
          if (a.cid === b.cid) continue
          const sum = a.score + b.score
          if (sum > bestSum) {
            bestSum = sum
            bestPair = [a.cid, b.cid]
          }
        }
      }
      if (bestPair) {
        gateSelections[slots[0].node.slotKey] = bestPair[0]
        allocations[bestPair[0]] = 1
        gateSelections[slots[1].node.slotKey] = bestPair[1]
        allocations[bestPair[1]] = 1
      }
    }
  }

  // 拓扑自检与微调：若门控槽已点亮但前置分支池差 1~2 点（极端模糊截图下），按次优候选数字自动修正
  repairBuildWithTopology(tree, allocations, gateSelections, partialRankingByNodeId)

  const branchPoints = { conditioning: 0, mobility: 0, survival: 0 }
  const partialConfidences = {}
  for (const node of tree.nodes) {
    const sid = node.kind === 'normal' ? node.skillId : gateSelections[node.slotKey] || null
    if (sid && allocations[sid]) {
      branchPoints[node.branch] = (branchPoints[node.branch] || 0) + allocations[sid]
    }
    if (node.kind === 'normal' && partialRankingByNodeId.has(node.nodeId)) {
      const ranked = partialRankingByNodeId.get(node.nodeId)
      partialConfidences[node.skillId] = (ranked?.[0]?.score ?? 0) - (ranked?.[1]?.score ?? 0)
    }
  }

  const totalPoints = Object.values(allocations).reduce((acc, v) => acc + v, 0)
  const hasResetBtn = detectHasAllocatedResetPrompt(imageData)

  return {
    ok: true,
    screenKind: 'tree',
    transform: tf,
    allocations,
    gateSelections,
    branchPoints,
    partialConfidences,
    totalPoints,
    hasResetBtn,
  }
}

const BRANCH_COUNTER_UMG_BOX = {
  conditioning: { dx0: -285, dx1: -215, dy0: 346, dy1: 376 },
  mobility: { dx0: -45, dx1: 45, dy0: 78, dy1: 106 },
  survival: { dx0: 265, dx1: 335, dy0: 346, dy1: 376 },
}

function bilinearBranchChroma(data, width, height, fx, fy, branch) {
  const cx = clamp(fx, 0, width - 1.001)
  const cy = clamp(fy, 0, height - 1.001)
  const x0 = Math.floor(cx)
  const y0 = Math.floor(cy)
  const tx = cx - x0
  const ty = cy - y0

  const sampleAt = (ix, iy) => {
    const idx = (iy * width + ix) * 4
    const r = data[idx]
    const g = data[idx + 1]
    const b = data[idx + 2]
    if (branch === 'conditioning') return Math.max(0, g - r) / 255
    if (branch === 'mobility') return Math.max(0, Math.min(r, g) - b) / 255
    if (branch === 'survival') return Math.max(0, r - Math.max(g, b)) / 255
    return 0
  }

  const c00 = sampleAt(x0, y0)
  const c10 = sampleAt(x0 + 1, y0)
  const c01 = sampleAt(x0, y0 + 1)
  const c11 = sampleAt(x0 + 1, y0 + 1)
  return (c00 * (1 - tx) + c10 * tx) * (1 - ty) + (c01 * (1 - tx) + c11 * tx) * ty
}

/**
 * 提取单个技能节点及所属分支 H3 总点计数器的分辨率无关视觉特征签名（用于每次加点前后帧精准差分校验）
 */
export function captureNodeVisualSignature(imageData, node) {
  const tf = computeViewportTransform(imageData)
  const { width: W, height: H, data } = imageData
  const S = tf.scale
  const { x: cx, y: cy } = tf.nodeToPixel(node)

  let innerRatio = 0
  let iconRatio = 0
  let moatRatio = 0
  let isMaxed = false
  let isLit = false

  if (node.kind === 'normal') {
    const isLarge = node.shape === 'large-circle'
    const innerR = (isLarge ? 29.0 : 17.0) * S
    const iconR = (isLarge ? 20.0 : 13.0) * S
    const moatRMin = (isLarge ? 23.0 : 13.8) * S
    const moatRMax = (isLarge ? 35.0 : 20.2) * S
    const scanR = Math.ceil(Math.max(innerR, moatRMax))

    let innerCnt = 0
    let innerColored = 0
    let iconCnt = 0
    let iconColored = 0
    let moatCnt = 0
    let moatColored = 0

    for (let dy = -scanR; dy <= scanR; dy++) {
      for (let dx = -scanR; dx <= scanR; dx++) {
        const d2 = dx * dx + dy * dy
        if (d2 > moatRMax * moatRMax) continue
        const px = clamp(Math.round(cx + dx), 0, W - 1)
        const py = clamp(Math.round(cy + dy), 0, H - 1)
        const idx = (py * W + px) * 4
        const colored = isBranchHighlightPixel(data[idx], data[idx + 1], data[idx + 2], node.branch)
        if (d2 <= innerR * innerR) {
          innerCnt++
          if (colored) innerColored++
        }
        if (d2 <= iconR * iconR) {
          iconCnt++
          if (colored) iconColored++
        }
        if (d2 >= moatRMin * moatRMin && d2 <= moatRMax * moatRMax) {
          moatCnt++
          if (colored) moatColored++
        }
      }
    }

    innerRatio = innerColored / Math.max(1, innerCnt)
    iconRatio = iconColored / Math.max(1, iconCnt)
    moatRatio = moatColored / Math.max(1, moatCnt)
    isMaxed = moatRatio >= 0.42 || innerRatio >= 0.44
    isLit = isMaxed || iconRatio >= 0.045
  } else {
    const fillLim = Math.ceil(24.0 * S)
    let diamondCnt = 0
    let diamondColored = 0
    for (let dy = -fillLim; dy <= fillLim; dy++) {
      for (let dx = -fillLim; dx <= fillLim; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 25.0 * S) {
          diamondCnt++
          const px = clamp(Math.round(cx + dx), 0, W - 1)
          const py = clamp(Math.round(cy + dy), 0, H - 1)
          const idx = (py * W + px) * 4
          if (isBranchHighlightPixel(data[idx], data[idx + 1], data[idx + 2], node.branch)) {
            diamondColored++
          }
        }
      }
    }
    innerRatio = diamondColored / Math.max(1, diamondCnt)
    isMaxed = innerRatio >= 0.28
    isLit = isMaxed
  }

  // 采样节点下方 (x/5) 胶囊左侧分子数字微网格 (16x12，精准避开右侧恒定不变的 '/5' 分母)
  const badgePatch = new Float32Array(16 * 12)
  for (let j = 0; j < 12; j++) {
    const dy = (18.0 + (j / 11) * 10.2) * S
    for (let i = 0; i < 16; i++) {
      const dx = (-13.2 + (i / 15) * 8.2) * S
      badgePatch[j * 16 + i] = bilinearMaxChannel(data, W, H, cx + dx, cy + dy) / 255
    }
  }

  // 采样所属分支根部 H3 霓虹大字计数框色度网格 (44x18)
  const box = BRANCH_COUNTER_UMG_BOX[node.branch] || BRANCH_COUNTER_UMG_BOX.mobility
  const branchPatch = new Float32Array(44 * 18)
  for (let j = 0; j < 18; j++) {
    const dy = (box.dy0 + (j / 17) * (box.dy1 - box.dy0)) * S
    for (let i = 0; i < 44; i++) {
      const dx = (box.dx0 + (i / 43) * (box.dx1 - box.dx0)) * S
      branchPatch[j * 44 + i] = bilinearBranchChroma(
        data,
        W,
        H,
        tf.originX + dx,
        tf.originY + dy,
        node.branch,
      )
    }
  }

  return {
    nodeId: node.nodeId,
    branch: node.branch,
    innerRatio,
    iconRatio,
    moatRatio,
    isLit,
    isMaxed,
    badgePatch,
    branchPatch,
  }
}

function computeActiveUnionMad(a, b, threshold = 0.14, minActive = 8) {
  if (!a || !b || a.length !== b.length || a.length === 0) {
    return { allMad: 0, activeMad: 0, activeCount: 0, strongChanged: 0 }
  }
  let sumAll = 0
  let sumAct = 0
  let cntAct = 0
  let strongChanged = 0
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i])
    sumAll += d
    if (d >= 0.26) strongChanged++
    if (a[i] > threshold || b[i] > threshold) {
      cntAct++
      sumAct += d
    }
  }
  return {
    allMad: sumAll / a.length,
    activeMad: cntAct >= minActive ? sumAct / cntAct : 0,
    activeCount: cntAct,
    strongChanged,
  }
}

/**
 * 对比单次长按加点前后两帧的节点与分支计数器视觉特征，判定该 1 点是否已在游戏内真实生效
 */
export function didPointTakeEffect(prevSig, nextSig) {
  if (!prevSig || !nextSig) {
    return {
      tookEffect: false,
      becameLit: false,
      becameMaxed: false,
      branchActiveMad: 0,
      badgeActiveMad: 0,
      innerDelta: 0,
    }
  }
  const branchDiff = computeActiveUnionMad(prevSig.branchPatch, nextSig.branchPatch, 0.14, 8)
  const badgeDiff = computeActiveUnionMad(prevSig.badgePatch, nextSig.badgePatch, 0.18, 6)
  const becameLit = !prevSig.isLit && nextSig.isLit
  const becameMaxed = !prevSig.isMaxed && nextSig.isMaxed
  const innerDelta = Math.abs(nextSig.innerRatio - prevSig.innerRatio)

  const tookEffect = Boolean(
    becameLit ||
      becameMaxed ||
      branchDiff.activeMad >= 0.055 ||
      branchDiff.strongChanged >= 7 ||
      badgeDiff.activeMad >= 0.095 ||
      badgeDiff.strongChanged >= 6 ||
      innerDelta >= 0.12,
  )

  return {
    tookEffect,
    becameLit,
    becameMaxed,
    branchActiveMad: branchDiff.activeMad,
    badgeActiveMad: badgeDiff.activeMad,
    branchStrongChanged: branchDiff.strongChanged,
    badgeStrongChanged: badgeDiff.strongChanged,
    innerDelta,
  }
}

/**
 * 利用技能树固有拓扑门槛对边界模糊节点做合法性对齐
 */
function repairBuildWithTopology(tree, allocations, gateSelections, partialRankingByNodeId) {
  const nodesById = new Map(tree.nodes.map((n) => [n.nodeId, n]))
  const getNodeSkill = (n) => (n.kind === 'normal' ? n.skillId : gateSelections[n.slotKey] || null)
  const getNodePts = (n) => {
    const sid = getNodeSkill(n)
    return sid ? allocations[sid] || 0 : 0
  }

  // 1. 清理无任何已解锁父节点的孤立误判节点
  let changed = true
  while (changed) {
    changed = false
    for (const n of tree.nodes) {
      const pts = getNodePts(n)
      if (pts <= 0 || !n.parentNodeIds?.length) continue
      const okParent = n.parentNodeIds.some((pid) => {
        const p = nodesById.get(pid)
        return p && getNodePts(p) > 0
      })
      if (!okParent) {
        const sid = getNodeSkill(n)
        if (sid) delete allocations[sid]
        if (n.kind !== 'normal') delete gateSelections[n.slotKey]
        changed = true
      }
    }
  }

  // 2. 若 10P 门控或 30P/40P 终极槽已激活，核对前置池点数是否满足门槛
  for (const gateNode of tree.nodes) {
    if (gateNode.kind === 'normal' || getNodePts(gateNode) <= 0) continue
    const maxTier = gateNode.earlyPoolOnly ? 2 : 5
    const priorNodes = tree.nodes.filter(
      (n) => n.branch === gateNode.branch && n.tier <= maxTier,
    )
    const poolNodes = priorNodes.filter((n) => n.kind === 'normal')

    let extraFirstCap = 0
    if (gateNode.kind === 'capstone' && gateNode.slotIndex === 1) {
      const slot0 = tree.nodes.find(
        (n) => n.groupId === gateNode.groupId && n.slotIndex === 0,
      )
      extraFirstCap = slot0 ? getNodePts(slot0) : 0
    }

    let sum = priorNodes.reduce((acc, n) => acc + getNodePts(n), 0) + extraFirstCap
    let guard = 0
    while (sum < gateNode.minBranchPoints && guard++ < 4) {
      // 在该池的部分加点节点中挑选提升代价最小的节点 +1
      let bestNode = null
      let bestScore = -Infinity
      for (const pn of poolNodes) {
        const ranked = partialRankingByNodeId.get(pn.nodeId)
        const cur = getNodePts(pn)
        const maxP = tree.skills[pn.skillId]?.maxPoints || 5
        if (!ranked || cur <= 0 || cur >= maxP) continue
        const nextChoice = ranked.find((r) => r.digit > cur)
        const sc = nextChoice ? nextChoice.score : -5
        if (sc > bestScore) {
          bestScore = sc
          bestNode = { pn, targetDigit: nextChoice ? nextChoice.digit : cur + 1 }
        }
      }
      if (!bestNode) break
      const add = Math.min(bestNode.targetDigit - getNodePts(bestNode.pn), gateNode.minBranchPoints - sum)
      if (add <= 0) break
      allocations[bestNode.pn.skillId] = getNodePts(bestNode.pn) + add
      sum += add
    }
  }
}

/**
 * 在图 3（2选1 / 3选2 选择弹窗）画面中动态识别并定位目标候选技能卡片的点击坐标
 * 无论弹窗展示 2 张还是 3 张卡片，直接通过匹配卡片中央白色大图标锁定准确位置！
 */
export async function locateGateModalTargets(imageData, candidateIds, targetSkillId, tree) {
  const { width: W, height: H, data } = imageData
  const isModalOpen = detectRaiderScreenKind(imageData) === 'gate_modal'
  const spendButtonCenter = { x: Math.round(0.396 * W), y: Math.round(0.877 * H) }
  const closeButtonCenter = { x: Math.round(0.598 * W), y: Math.round(0.877 * H) }

  // 几何默认兜底位置
  const idxInCands = Math.max(0, (candidateIds || []).indexOf(targetSkillId))
  const totalCands = Math.max(2, (candidateIds || []).length)
  const fallbackXRatio =
    totalCands === 2 ? (idxInCands === 0 ? 0.362 : 0.638) : [0.24, 0.5, 0.76][idxInCands] || 0.5
  let targetCardCenter = {
    x: Math.round(fallbackXRatio * W),
    y: Math.round(0.46 * H),
    matchedByIcon: false,
    score: 0,
  }

  if (!isModalOpen) {
    return { isModalOpen: false, targetCardCenter, spendButtonCenter, closeButtonCenter }
  }

  const iconMasks = await ensureSkillIconMasks(tree)
  const targetMask = iconMasks[targetSkillId]
  if (!targetMask) {
    return { isModalOpen: true, targetCardCenter, spendButtonCenter, closeButtonCenter }
  }

  // 扫描 y ∈ [0.285H, 0.390H], x ∈ [0.10W, 0.90W] 寻找纯白大图标列簇（避开下方 0.405H 起的白色技能名文字）
  const y0 = Math.round(0.285 * H)
  const y1 = Math.round(0.39 * H)
  const x0 = Math.round(0.1 * W)
  const x1 = Math.round(0.9 * W)

  const colHasWhite = new Uint8Array(W)
  for (let x = x0; x <= x1; x++) {
    let whiteCnt = 0
    for (let y = y0; y <= y1; y += 2) {
      const idx = (y * W + x) * 4
      if (data[idx] > 185 && data[idx + 1] > 185 && data[idx + 2] > 185) {
        whiteCnt++
      }
    }
    if (whiteCnt >= 2) colHasWhite[x] = 1
  }

  // 合并相邻白色列（允许图标内部最多 22px @1080p 的断裂间隙）
  const maxGap = Math.max(6, Math.round(0.015 * W))
  const minSpan = Math.max(12, Math.round(0.025 * W))
  const clusters = []
  let curStart = -1
  let curEnd = -1

  for (let x = x0; x <= x1; x++) {
    if (colHasWhite[x]) {
      if (curStart < 0) {
        curStart = x
        curEnd = x
      } else if (x - curEnd <= maxGap) {
        curEnd = x
      } else {
        if (curEnd - curStart + 1 >= minSpan) clusters.push([curStart, curEnd])
        curStart = x
        curEnd = x
      }
    }
  }
  if (curStart >= 0 && curEnd - curStart + 1 >= minSpan) {
    clusters.push([curStart, curEnd])
  }

  let bestScore = -Infinity
  for (const [cx0, cx1] of clusters) {
    let minX = cx1
    let maxX = cx0
    let minY = y1
    let maxY = y0
    for (let y = y0; y <= y1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        const idx = (y * W + x) * 4
        if (data[idx] > 170 && data[idx + 1] > 170 && data[idx + 2] > 170) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
    if (maxX <= minX || maxY <= minY) continue

    const obs = resampleSquareMask24(
      (fx, fy) => {
        const ix = clamp(Math.round(fx), 0, W - 1)
        const iy = clamp(Math.round(fy), 0, H - 1)
        const idx = (iy * W + ix) * 4
        const minCh = Math.min(data[idx], data[idx + 1], data[idx + 2])
        return clamp((minCh - 60) / 180, 0, 1)
      },
      minX,
      maxX,
      minY,
      maxY,
    )

    const sc = computeNCC(obs, targetMask)
    if (sc > bestScore) {
      bestScore = sc
      targetCardCenter = {
        x: Math.round((minX + maxX) * 0.5),
        y: Math.round(0.46 * H),
        matchedByIcon: true,
        score: sc,
      }
    }
  }

  return {
    isModalOpen: true,
    targetCardCenter,
    spendButtonCenter,
    closeButtonCenter,
  }
}

/**
 * 辅助函数：将 Blob / File / ArrayBuffer / URL 解码为浏览器 ImageData
 */
export async function decodeSourceToImageData(source, maxWidth = 1920) {
  let bitmap = null
  if (source instanceof Blob) {
    bitmap = await createImageBitmap(source)
  } else if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
    const blob = new Blob([source], { type: 'image/bmp' })
    bitmap = await createImageBitmap(blob)
  } else if (typeof source === 'string') {
    const img = await loadImageElement(source)
    const ratio = img.naturalWidth > maxWidth ? maxWidth / img.naturalWidth : 1
    const w = Math.max(1, Math.round(img.naturalWidth * ratio))
    const h = Math.max(1, Math.round(img.naturalHeight * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } else {
    throw new Error('不支持的图像输入源')
  }

  try {
    const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1
    const w = Math.max(1, Math.round(bitmap.width * ratio))
    const h = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } finally {
    bitmap.close?.()
  }
}
