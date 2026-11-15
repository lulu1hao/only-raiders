import { invokeTauri } from '../stores/useOverlayWindowStore'

export const CAPTURE_MAX_WIDTH = 2560
export const SAFE_PARK_X = 0.02
export const SAFE_PARK_Y = 0.5

function assertInputResult(res, failMsg) {
  if (!res) {
    throw new Error(failMsg)
  }
  if (res.aborted || !res.ok) {
    const err = new Error(res.reason || '已触发安全急停')
    err.aborted = Boolean(res.aborted)
    throw err
  }
}

export async function waitSafeOrThrow(hwnd, durationMs, checkDrift = true) {
  // 后端单次安全等待上限 6000ms：超长等待（如武器加载等待）分段执行，全程保持 ESC/F10/鼠标急停监听
  let remaining = Math.max(20, Math.round(durationMs))
  while (remaining > 0) {
    const chunk = Math.min(remaining, 5000)
    remaining -= chunk
    const res = await invokeTauri('raider_wait_safe', {
      hwnd,
      durationMs: Math.max(20, chunk),
      checkDrift,
    })
    assertInputResult(res, '安全等待指令通信失败，已安全中止')
  }
}

export async function execSafePark(hwnd, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'park',
    normX: SAFE_PARK_X,
    normY: SAFE_PARK_Y,
    holdMs: 0,
    checkDrift,
    parkAfter: false,
  })
  assertInputResult(res, '键鼠归位指令通信失败，已安全中止')
}

export async function execSafeClick(hwnd, normX, normY, checkDrift = true, parkAfter = false) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'click',
    normX,
    normY,
    holdMs: 48,
    checkDrift,
    parkAfter,
  })
  assertInputResult(res, '键鼠点击指令通信失败，已安全中止')
}

export async function execSafeHold(
  hwnd,
  normX,
  normY,
  holdMs = 920,
  checkDrift = true,
  parkAfter = true,
) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'hold',
    normX,
    normY,
    holdMs: Math.max(120, Math.min(2500, Math.round(holdMs))),
    checkDrift,
    parkAfter,
  })
  assertInputResult(res, '长按确认指令通信失败，已安全中止')
}

export async function execSafeDrag(
  hwnd,
  fromNormX,
  fromNormY,
  toNormX,
  toNormY,
  checkDrift = true,
  holdMs = 52,
) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'drag',
    normX: fromNormX,
    normY: fromNormY,
    toNormX,
    toNormY,
    holdMs,
    checkDrift,
    parkAfter: true,
  })
  assertInputResult(res, '键鼠拖拽指令通信失败，已安全中止')
}

export async function execSafeShiftClick(hwnd, normX, normY, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'shift_click',
    normX,
    normY,
    holdMs: 48,
    checkDrift,
    parkAfter: true,
  })
  assertInputResult(res, '快捷移动指令通信失败，已安全中止')
}

export async function execSafeCtrlClick(
  hwnd,
  normX,
  normY,
  checkDrift = true,
  parkAfter = false,
) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'ctrl_click',
    normX,
    normY,
    holdMs: 48,
    checkDrift,
    parkAfter,
  })
  assertInputResult(res, '多选点击指令通信失败，已安全中止')
}

export async function execSafeDoubleClick(hwnd, normX, normY, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'double_click',
    normX,
    normY,
    holdMs: 42,
    checkDrift,
    parkAfter: true,
  })
  assertInputResult(res, '双击装配指令通信失败，已安全中止')
}

export async function execSafeScroll(hwnd, normX, normY, wheelDelta, checkDrift = true) {
  const res = await invokeTauri('raider_exec_input', {
    hwnd,
    kind: 'scroll',
    normX,
    normY,
    wheelDelta,
    holdMs: 0,
    checkDrift,
    // 滚轮悬停点已落在暗缝或列表滚动容器内，无需归位避免焦点跳出滚动容器
    parkAfter: false,
  })
  assertInputResult(res, '滚轮翻页指令通信失败，已安全中止')
}

export function rectCenterNorm(rect1080p, vp, W, H) {
  return {
    x: (vp.ox + (rect1080p.x + rect1080p.w * 0.5) * vp.scale) / W,
    y: (vp.oy + (rect1080p.y + rect1080p.h * 0.5) * vp.scale) / H,
  }
}

export function pointNorm(pt1080p, vp, W, H) {
  return {
    x: (vp.ox + pt1080p.x * vp.scale) / W,
    y: (vp.oy + pt1080p.y * vp.scale) / H,
  }
}
