/**
 * raiderAutoSyncPlanner.js
 *
 * 奇袭者（Raider）游戏内自动同步加点：
 * 1. 游戏当前状态与目标存档的差量计算（Diff）与冲突拦截
 * 2. 严格满足前置节点与 10P/30P/40P 门槛的拓扑动作编排
 * 3. 基于 Tauri Win32 安全输入原语 + 实时视觉闭环反馈的执行引擎
 */

import { invokeTauri, isTauriRuntime } from '../stores/useOverlayWindowStore.js'
import {
  captureNodeVisualSignature,
  computeViewportTransform,
  decodeSourceToImageData,
  detectRaiderScreenKind,
  didPointTakeEffect,
  locateGateModalTargets,
  recognizeBuildFromImageData,
} from './raiderVisionRecognizer.js'

const BRANCH_EXEC_ORDER = ['conditioning', 'mobility', 'survival']
const NEUTRAL_PARK_NORM_X = 0.045
const NEUTRAL_PARK_NORM_Y = 0.52

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function computeBuildBranchPoints(build, tree) {
  const sums = { conditioning: 0, mobility: 0, survival: 0 }
  const alloc = build?.allocations || {}
  const gates = build?.gateSelections || {}
  for (const node of tree?.nodes || []) {
    const sid = node.kind === 'normal' ? node.skillId : gates[node.slotKey] || null
    if (sid && alloc[sid]) {
      sums[node.branch] = (sums[node.branch] || 0) + alloc[sid]
    }
  }
  return sums
}

/**
 * 对比游戏内实机加点与目标配装存档，生成差量步骤或冲突报告
 */
export function analyzeBuildSyncDiff(inGameBuild, targetBuild, tree) {
  const curAlloc = inGameBuild?.allocations || {}
  const curGates = inGameBuild?.gateSelections || {}
  const tgtAlloc = targetBuild?.allocations || {}
  const tgtGates = targetBuild?.gateSelections || {}

  const conflicts = []
  const steps = []

  // 按分支 -> tier (0..6) -> slotIndex (0..1) 严格排序，确保所有前置与点数池门槛自然满足
  const sortedNodes = [...(tree?.nodes || [])].sort((a, b) => {
    const ba = BRANCH_EXEC_ORDER.indexOf(a.branch)
    const bb = BRANCH_EXEC_ORDER.indexOf(b.branch)
    if (ba !== bb) return ba - bb
    if (a.tier !== b.tier) return a.tier - b.tier
    return (a.slotIndex || 0) - (b.slotIndex || 0)
  })

  let totalCurrentPoints = 0
  let totalTargetPoints = 0
  let totalDeltaPoints = 0

  for (const node of sortedNodes) {
    if (node.kind === 'normal') {
      const sk = tree.skills[node.skillId]
      const curPts = curAlloc[node.skillId] || 0
      const tgtPts = tgtAlloc[node.skillId] || 0
      totalCurrentPoints += curPts
      totalTargetPoints += tgtPts

      if (curPts > tgtPts) {
        conflicts.push({
          nodeId: node.nodeId,
          branch: node.branch,
          skillName: sk?.name || node.skillId,
          reason: `游戏内已投 ${curPts}P，超出目标配装 (${tgtPts}P)`,
        })
      } else if (tgtPts > curPts) {
        const delta = tgtPts - curPts
        totalDeltaPoints += delta
        steps.push({
          kind: 'normal',
          node,
          skillId: node.skillId,
          skillName: sk?.name || node.skillId,
          icon: sk?.icon || null,
          branch: node.branch,
          currentPoints: curPts,
          targetPoints: tgtPts,
          deltaPoints: delta,
        })
      }
    } else {
      const curSid = curGates[node.slotKey] || null
      const tgtSid = tgtGates[node.slotKey] || null
      if (curSid) totalCurrentPoints += 1
      if (tgtSid) totalTargetPoints += 1

      if (curSid && curSid !== tgtSid) {
        const curSk = tree.skills[curSid]
        const tgtSk = tgtSid ? tree.skills[tgtSid] : null
        conflicts.push({
          nodeId: node.nodeId,
          branch: node.branch,
          skillName: curSk?.name || curSid,
          reason: tgtSk
            ? `槽位已装备「${curSk?.name || curSid}」，与目标「${tgtSk.name}」冲突`
            : `槽位已装备「${curSk?.name || curSid}」，但目标配装未启用该槽位`,
        })
      } else if (!curSid && tgtSid) {
        const tgtSk = tree.skills[tgtSid]
        totalDeltaPoints += 1
        steps.push({
          kind: 'gate',
          node,
          slotKey: node.slotKey,
          targetSkillId: tgtSid,
          skillName: tgtSk?.name || tgtSid,
          icon: tgtSk?.icon || null,
          branch: node.branch,
          currentPoints: 0,
          targetPoints: 1,
          deltaPoints: 1,
        })
      }
    }
  }

  return {
    canIncrementalSync: conflicts.length === 0,
    alreadySynced: conflicts.length === 0 && steps.length === 0,
    conflicts,
    steps,
    totalCurrentPoints,
    totalTargetPoints,
    totalDeltaPoints,
  }
}

/**
 * 抓取当前运行中的《ARC Raiders》客户区画面并解码为 ImageData
 */
export async function captureGameClientImageData(hwnd = 0, maxWidth = 2560) {
  if (!isTauriRuntime()) {
    throw new Error('仅桌面端支持直接抓取游戏窗口画面，浏览器端请使用 Ctrl+V 粘贴截图。')
  }
  let winInfo = null
  let targetHwnd = Number(hwnd) || 0
  if (!targetHwnd) {
    winInfo = await invokeTauri('raider_find_game_window')
    targetHwnd = winInfo?.hwnd || 0
  }
  if (!targetHwnd) {
    throw new Error('未检测到运行中的《ARC Raiders》(PioneerGame) 窗口，请先启动游戏。')
  }

  const rawBmp = await invokeTauri('raider_capture_client', {
    hwnd: targetHwnd,
    maxWidth,
  })
  if (!rawBmp) {
    throw new Error('抓取游戏窗口画面失败，请确认游戏使用「无边框窗口」或「窗口化」模式运行。')
  }

  const imageData = await decodeSourceToImageData(rawBmp, maxWidth)
  return {
    hwnd: targetHwnd,
    winInfo,
    imageData,
  }
}

/**
 * 请求立即中止正在执行的自动同步任务
 */
export async function abortRaiderAutoSync() {
  if (isTauriRuntime()) {
    await invokeTauri('raider_abort_sync')
  }
}

/**
 * 执行游戏内一键自动同步加点主循环（全量闭环 v3）：
 * - 方案 A：每次松手后 38ms 自动将鼠标归位至左侧纯黑安全区 (0.045W, 0.52H)，彻底消除悬浮 Tooltip 遮挡节点与角标
 * - 方案 B：废除连发盲按与盲目重试，改为每投入 1 点必做屏幕识别闭环
 * - 方案 C：前后帧节点角标 + 分支 H3 霓虹总点计数框色度差分锁定，叠加分支与全局点数熔断上限
 * - 方案 D：Rust 底层微区域监听分支计数跳变，达标瞬间提前松开左键，且小点上限严格锁在 < 2×500ms 以内
 */
export async function runRaiderAutoSyncSession(args) {
  try {
    return await runRaiderAutoSyncSessionInner(args)
  } finally {
    if (isTauriRuntime()) {
      await invokeTauri('raider_finish_sync').catch(() => {})
    }
  }
}

async function runRaiderAutoSyncSessionInner({
  targetBuild,
  tree,
  options = {},
  onProgress = () => {},
}) {
  if (!isTauriRuntime()) {
    throw new Error('自动键鼠同步仅在桌面客户端中可用，或可切换为透视引导模式。')
  }

  // 游戏 UAsset 实测：DT_GenericInputActions 小节点 HoldTime = 0.5s (500ms)；
  // BP_DefaultCommonUIHoldData_C 大节点/菱形节点 HoldTime = 0.8s (800ms)。
  // 严格将单次长按上限锁死在 2 倍阈值以内 (< 1000ms / < 1600ms)，物理杜绝单次按压跳 2 点。
  const smallHoldDurationMs = Math.max(
    380,
    Math.min(880, Number(options.smallHoldDurationMs ?? options.holdDurationMs) || 580),
  )
  const bigHoldDurationMs = Math.max(
    650,
    Math.min(1450, Number(options.bigHoldDurationMs) || 960),
  )
  const postPointDelayMs = Number.isFinite(Number(options.postPointDelayMs))
    ? Math.max(250, Math.min(3500, Number(options.postPointDelayMs)))
    : 1000
  const gateOpenMode = options.gateOpenMode || 'auto' // 'auto' | 'click' | 'hold'
  const gateConfirmMode = options.gateConfirmMode || 'auto' // 'auto' | 'click' | 'hold'

  onProgress({
    phase: 'locating_window',
    progressPct: 2,
    message: '正在定位《ARC Raiders》游戏窗口...',
  })
  const winInfo = await invokeTauri('raider_find_game_window')
  if (!winInfo?.found || !winInfo?.hwnd) {
    throw new Error('未找到运行中的《ARC Raiders》窗口，请先启动游戏并打开「奇袭者 → 技能树」界面。')
  }

  const hwnd = winInfo.hwnd
  onProgress({
    phase: 'focusing',
    progressPct: 5,
    message: '正在激活游戏窗口并移开鼠标遮挡读取当前进度...',
  })
  const focused = await invokeTauri('raider_focus_game_window', { hwnd })
  if (!focused?.ok) {
    throw new Error(focused?.reason || '无法激活游戏窗口焦点，请尝试以相同权限运行软件。')
  }
  await sleep(320)

  const execState = {
    isFirstInput: true,
    spentPoints: 0,
    totalDeltaPoints: 1,
  }

  const execInputChecked = async (payload) => {
    const res = await invokeTauri('raider_exec_input', {
      hwnd,
      checkDrift: !execState.isFirstInput,
      ...payload,
    })
    execState.isFirstInput = false
    if (!res) {
      throw new Error('键鼠指令通信失败，已安全中止。')
    }
    if (res.aborted) {
      const err = new Error(res.reason || '已中止自动同步')
      err.aborted = true
      throw err
    }
    return res
  }

  // 带 20ms 级 ESC / F10 / 鼠标移动急停监听的安全等待
  const waitSafe = async (durationMs) => {
    const ms = Math.max(20, Math.round(durationMs))
    const res = await invokeTauri('raider_wait_safe', {
      hwnd,
      durationMs: ms,
      checkDrift: !execState.isFirstInput,
    })
    if (res?.aborted) {
      const err = new Error(res.reason || '已中止自动同步')
      err.aborted = true
      throw err
    }
  }

  const parkAndCaptureTree = async (waitBeforeCaptureMs = 150) => {
    await execInputChecked({
      kind: 'park',
      normX: NEUTRAL_PARK_NORM_X,
      normY: NEUTRAL_PARK_NORM_Y,
      holdMs: 0,
    })
    await waitSafe(waitBeforeCaptureMs)
    const { imageData } = await captureGameClientImageData(hwnd, 1920)
    const rec = await recognizeBuildFromImageData(imageData, tree)
    return { imageData, rec }
  }

  // 先将光标移至左侧空白安全区消除任何已有悬浮提示框，再截取初始画面
  let { imageData: initImg, rec: initRec } = await parkAndCaptureTree(160)
  if (detectRaiderScreenKind(initImg) === 'gate_modal') {
    await execInputChecked({
      kind: 'click',
      normX: 0.598,
      normY: 0.877,
      holdMs: 0,
      parkAfter: true,
    })
    await waitSafe(550)
    const retryInit = await captureGameClientImageData(hwnd, 1920)
    initImg = retryInit.imageData
    initRec = await recognizeBuildFromImageData(initImg, tree)
  }

  if (!initRec.ok) {
    throw new Error(initRec.error || '请先在游戏内打开「奇袭者 → 技能树」主界面后再启动同步。')
  }

  const plan = analyzeBuildSyncDiff(initRec, targetBuild, tree)
  if (!plan.canIncrementalSync) {
    return {
      ok: false,
      needsReset: true,
      conflicts: plan.conflicts,
      inGameBuild: initRec,
      message: `检测到 ${plan.conflicts.length} 处游戏内已有加点与目标配装冲突，请先在游戏内按 R 重置技能树后再同步。`,
    }
  }

  if (plan.alreadySynced) {
    return {
      ok: true,
      alreadySynced: true,
      completedSteps: 0,
      totalDeltaPoints: 0,
      message: '游戏内当前技能树已与目标配装完全一致，无需重复加点！',
    }
  }

  execState.totalDeltaPoints = Math.max(1, plan.totalDeltaPoints)
  const calcPct = () =>
    Math.min(98, Math.round(8 + (execState.spentPoints / execState.totalDeltaPoints) * 88))

  const tf = initRec.transform || computeViewportTransform(initImg, tree)

  // 分支预算与总预算硬熔断账本（绝不允许任何分支或总点数超出目标配装）
  const targetBranchBudgets = computeBuildBranchPoints(targetBuild, tree)
  const targetTotalBudget = plan.totalTargetPoints
  const initBranchPts = initRec.branchPoints || computeBuildBranchPoints(initRec, tree)
  const confirmedBranchPts = {
    conditioning: initBranchPts.conditioning || 0,
    mobility: initBranchPts.mobility || 0,
    survival: initBranchPts.survival || 0,
  }
  let confirmedTotalPts = initRec.totalPoints || 0
  let lastTreeImg = initImg
  let lastTreeRec = initRec

  // 打开指定门控菱形选择弹窗并返回卡片与按钮定位结果
  const openAndLocateGateModal = async (gateNode, targetSkillId) => {
    const pt = tf.nodeToPixel(gateNode)
    const normX = pt.x / tf.width
    const normY = pt.y / tf.height

    let { imageData: modalImg } = await captureGameClientImageData(hwnd, 1920)
    let modalTargets = await locateGateModalTargets(
      modalImg,
      gateNode.candidateIds,
      targetSkillId,
      tree,
    )

    if (!modalTargets.isModalOpen) {
      if (gateOpenMode !== 'hold') {
        await execInputChecked({
          kind: 'click',
          normX,
          normY,
          holdMs: 0,
          parkAfter: false,
        })
        await waitSafe(480)
        const capAfterClick = await captureGameClientImageData(hwnd, 1920)
        modalImg = capAfterClick.imageData
        modalTargets = await locateGateModalTargets(
          modalImg,
          gateNode.candidateIds,
          targetSkillId,
          tree,
        )
      }

      if (!modalTargets.isModalOpen && (gateOpenMode === 'auto' || gateOpenMode === 'hold')) {
        await execInputChecked({
          kind: 'hold',
          normX,
          normY,
          holdMs: bigHoldDurationMs,
          parkAfter: false,
        })
        await waitSafe(520)
        const capAfterHold = await captureGameClientImageData(hwnd, 1920)
        modalImg = capAfterHold.imageData
        modalTargets = await locateGateModalTargets(
          modalImg,
          gateNode.candidateIds,
          targetSkillId,
          tree,
        )
      }

      // 若因前序连线解锁动画刚结束导致首次未响应，额外等待后再试一轮
      if (!modalTargets.isModalOpen) {
        await waitSafe(560)
        await execInputChecked({
          kind: 'click',
          normX,
          normY,
          holdMs: 0,
          parkAfter: false,
        })
        await waitSafe(480)
        let retryCap = await captureGameClientImageData(hwnd, 1920)
        modalImg = retryCap.imageData
        modalTargets = await locateGateModalTargets(
          modalImg,
          gateNode.candidateIds,
          targetSkillId,
          tree,
        )
        if (!modalTargets.isModalOpen) {
          await execInputChecked({
            kind: 'hold',
            normX,
            normY,
            holdMs: Math.min(1450, bigHoldDurationMs + 220),
            parkAfter: false,
          })
          await waitSafe(520)
          retryCap = await captureGameClientImageData(hwnd, 1920)
          modalImg = retryCap.imageData
          modalTargets = await locateGateModalTargets(
            modalImg,
            gateNode.candidateIds,
            targetSkillId,
            tree,
          )
        }
      }
    } else {
      await waitSafe(220)
    }

    return { modalImg, modalTargets }
  }

  const stepsList = plan.steps
  for (let i = 0; i < stepsList.length; i++) {
    const step = stepsList[i]
    const pt = tf.nodeToPixel(step.node)
    const normX = pt.x / tf.width
    const normY = pt.y / tf.height

    if (step.kind === 'normal') {
      const sk = tree.skills[step.skillId]
      const maxPts = sk?.maxPoints || 1
      const isBigNode = step.node.shape !== 'circle' || maxPts === 1
      const baseHoldMs = isBigNode ? bigHoldDurationMs : smallHoldDurationMs
      const earlyReleaseMinMs = isBigNode ? 835 : 530
      const kindTag = isBigNode ? '大技能' : '小技能'

      let confirmedPts = step.currentPoints
      const initNodeSig = captureNodeVisualSignature(lastTreeImg, step.node)
      if (initNodeSig.isMaxed) {
        confirmedPts = maxPts
      } else if (lastTreeRec?.ok) {
        const recAlloc = lastTreeRec.allocations?.[step.skillId] || 0
        const recConf = lastTreeRec.partialConfidences?.[step.skillId] ?? 0
        if (recAlloc >= maxPts || (recAlloc > confirmedPts && recConf >= 1.25)) {
          confirmedPts = Math.max(confirmedPts, recAlloc)
        }
      }

      let missedStreak = 0

      // 逐点严格视觉闭环：每长按 1 点 -> 自动移鼠至空白区 -> 等待加载动画 -> 截屏识图与前后帧差分确认
      while (confirmedPts < step.targetPoints) {
        if (
          (confirmedBranchPts[step.branch] || 0) >= (targetBranchBudgets[step.branch] || 0) ||
          confirmedTotalPts >= targetTotalBudget
        ) {
          break
        }

        const prevSig = captureNodeVisualSignature(lastTreeImg, step.node)
        if (prevSig.isMaxed) {
          confirmedPts = maxPts
          break
        }

        const attemptHoldMs =
          missedStreak === 0
            ? baseHoldMs
            : isBigNode
              ? Math.min(1450, baseHoldMs + missedStreak * 130)
              : Math.min(880, baseHoldMs + missedStreak * 100)

        onProgress({
          phase: 'allocating_normal',
          stepIndex: i,
          totalSteps: stepsList.length,
          step,
          subIndex: confirmedPts - step.currentPoints + 1,
          subTotal: step.deltaPoints,
          progressPct: calcPct(),
          message:
            missedStreak > 0
              ? `[${i + 1}/${stepsList.length}] 补按${kindTag}「${step.skillName}」(${confirmedPts + 1}/${step.targetPoints}) · ESC 急停`
              : `[${i + 1}/${stepsList.length}] 长按${kindTag}「${step.skillName}」(${confirmedPts + 1}/${step.targetPoints}) · ESC 急停`,
        })

        await execInputChecked({
          kind: 'hold',
          normX,
          normY,
          holdMs: attemptHoldMs,
          parkAfter: true,
          earlyReleaseAfterMs: earlyReleaseMinMs,
          branch: step.branch,
        })

        onProgress({
          phase: 'waiting_animation',
          stepIndex: i,
          totalSteps: stepsList.length,
          step,
          progressPct: calcPct(),
          message: `[${i + 1}/${stepsList.length}] 「${step.skillName}」等待动画并识图核验 (${(postPointDelayMs / 1000).toFixed(1)}s) · ESC 急停`,
        })
        await waitSafe(postPointDelayMs)

        // 此时鼠标已在松手瞬间停靠在左侧空白区 (0.045W, 0.52H)，无任何悬浮卡片遮挡！
        let { imageData: nextTreeImg } = await captureGameClientImageData(hwnd, 1920)
        if (detectRaiderScreenKind(nextTreeImg) === 'gate_modal') {
          await execInputChecked({
            kind: 'click',
            normX: 0.598,
            normY: 0.877,
            holdMs: 0,
            parkAfter: true,
          })
          await waitSafe(500)
          const closed = await captureGameClientImageData(hwnd, 1920)
          nextTreeImg = closed.imageData
        }

        const nextTreeRec = await recognizeBuildFromImageData(nextTreeImg, tree)
        const nextSig = captureNodeVisualSignature(nextTreeImg, step.node)
        const diff = didPointTakeEffect(prevSig, nextSig)

        lastTreeImg = nextTreeImg
        if (nextTreeRec.ok) {
          lastTreeRec = nextTreeRec
        }

        if (diff.tookEffect) {
          missedStreak = 0
          confirmedPts += 1
          confirmedBranchPts[step.branch] = (confirmedBranchPts[step.branch] || 0) + 1
          confirmedTotalPts += 1
          execState.spentPoints += 1

          if (
            nextSig.isMaxed ||
            (nextTreeRec.ok && (nextTreeRec.allocations[step.skillId] || 0) >= maxPts)
          ) {
            confirmedPts = maxPts
            break
          }

          if (nextTreeRec.ok) {
            const recAlloc = nextTreeRec.allocations[step.skillId] || 0
            const recConf = nextTreeRec.partialConfidences?.[step.skillId] ?? 0
            if (recAlloc >= step.targetPoints && recConf >= 1.25) {
              confirmedPts = Math.max(confirmedPts, recAlloc)
            }
          }
        } else if (
          nextSig.isMaxed ||
          (nextTreeRec.ok && (nextTreeRec.allocations[step.skillId] || 0) >= maxPts)
        ) {
          confirmedPts = maxPts
          break
        } else {
          // 节点与分支 H3 计数器均无像素跳变，确认为真实漏按，最多安全补试 2 次
          missedStreak += 1
          if (missedStreak > 2) {
            break
          }
        }
      }
    } else {
      // 门控菱形槽（2选1 choice / 3选2 capstone）：
      // 单次选卡 + 单次点击「消耗点数」，绝不在弹窗内根据按钮亮度盲点第 2 次（防止 3选2 焦点切换误装其他卡片），
      // 统一回到无遮挡主技能树界面做 100% 剪影识图真值核验！
      if (lastTreeRec?.ok && (lastTreeRec.allocations?.[step.targetSkillId] || 0) >= 1) {
        continue
      }
      if (
        (confirmedBranchPts[step.branch] || 0) >= (targetBranchBudgets[step.branch] || 0) ||
        confirmedTotalPts >= targetTotalBudget
      ) {
        continue
      }

      const gateTypeLabel = step.node.kind === 'capstone' ? '3选2终极' : '2选1门控'
      onProgress({
        phase: 'selecting_gate',
        stepIndex: i,
        totalSteps: stepsList.length,
        step,
        progressPct: calcPct(),
        message: `[${i + 1}/${stepsList.length}] 装备${gateTypeLabel}「${step.skillName}」 · ESC 急停`,
      })

      const { modalImg, modalTargets } = await openAndLocateGateModal(
        step.node,
        step.targetSkillId,
      )
      if (!modalTargets.isModalOpen) {
        throw new Error(
          `未能打开${gateTypeLabel}「${step.skillName}」选择界面（可能前置点数尚未解锁或画面被遮挡），已安全停止。`,
        )
      }

      // 点击目标候选技能卡片
      const cardNormX = modalTargets.targetCardCenter.x / modalImg.width
      const cardNormY = modalTargets.targetCardCenter.y / modalImg.height
      await execInputChecked({
        kind: 'click',
        normX: cardNormX,
        normY: cardNormY,
        holdMs: 0,
        parkAfter: false,
      })
      await waitSafe(320)

      // 单次点击左下角「消耗点数」确认按钮并等待加载动画
      const spendNormX = modalTargets.spendButtonCenter.x / modalImg.width
      const spendNormY = modalTargets.spendButtonCenter.y / modalImg.height
      const confirmKind = gateConfirmMode === 'hold' ? 'hold' : 'click'
      await execInputChecked({
        kind: confirmKind,
        normX: spendNormX,
        normY: spendNormY,
        holdMs: confirmKind === 'hold' ? bigHoldDurationMs : 0,
        parkAfter: false,
      })

      confirmedBranchPts[step.branch] = (confirmedBranchPts[step.branch] || 0) + 1
      confirmedTotalPts += 1
      execState.spentPoints += 1

      onProgress({
        phase: 'waiting_animation',
        stepIndex: i,
        totalSteps: stepsList.length,
        step,
        progressPct: calcPct(),
        message: `[${i + 1}/${stepsList.length}] 「${step.skillName}」等待加载动画 (${(postPointDelayMs / 1000).toFixed(1)}s) · ESC 急停`,
      })
      await waitSafe(postPointDelayMs)

      const { imageData: afterConfirmImg } = await captureGameClientImageData(hwnd, 1920)
      const afterKind = detectRaiderScreenKind(afterConfirmImg)

      const nextStep = stepsList[i + 1]
      const hasNextSlotInSameModal = Boolean(
        nextStep &&
          nextStep.kind === 'gate' &&
          nextStep.node.groupId &&
          nextStep.node.groupId === step.node.groupId &&
          (confirmedBranchPts[step.branch] || 0) < (targetBranchBudgets[step.branch] || 0) &&
          confirmedTotalPts < targetTotalBudget,
      )

      // 若同一 3选2 弹窗紧接着还要选第 2 个槽位且弹窗仍开着，则直接进入下一步连选第 2 张卡片
      if (hasNextSlotInSameModal && afterKind === 'gate_modal') {
        continue
      }

      // 否则关闭弹窗并将鼠标停靠在空白区，回到技能树主画面做剪影真值核验
      if (afterKind === 'gate_modal') {
        await execInputChecked({
          kind: 'click',
          normX: modalTargets.closeButtonCenter.x / modalImg.width,
          normY: modalTargets.closeButtonCenter.y / modalImg.height,
          holdMs: 0,
          parkAfter: true,
        })
        await waitSafe(520)
      } else {
        await execInputChecked({
          kind: 'park',
          normX: NEUTRAL_PARK_NORM_X,
          normY: NEUTRAL_PARK_NORM_Y,
          holdMs: 0,
        })
        await waitSafe(140)
      }

      const { imageData: treeVerifyImg } = await captureGameClientImageData(hwnd, 1920)
      const treeVerifyRec = await recognizeBuildFromImageData(treeVerifyImg, tree)
      if (treeVerifyRec.ok) {
        lastTreeImg = treeVerifyImg
        lastTreeRec = treeVerifyRec

        // 核验本组所有已执行门控槽位是否均已真实装备上树
        const groupStepsDone = stepsList
          .slice(0, i + 1)
          .filter((s) => s.kind === 'gate' && s.node.groupId === step.node.groupId)
        const missingGateSteps = groupStepsDone.filter(
          (gs) => !(lastTreeRec.allocations?.[gs.targetSkillId] >= 1),
        )

        if (missingGateSteps.length > 0) {
          confirmedBranchPts[step.branch] = Math.max(
            0,
            (confirmedBranchPts[step.branch] || 0) - missingGateSteps.length,
          )
          confirmedTotalPts = Math.max(0, confirmedTotalPts - missingGateSteps.length)

          // 仅对主技能树真值确认为未装备的缺失技能做最多 1 次精准补选
          for (const ms of missingGateSteps) {
            if (
              (confirmedBranchPts[ms.branch] || 0) >= (targetBranchBudgets[ms.branch] || 0) ||
              confirmedTotalPts >= targetTotalBudget
            ) {
              break
            }

            const reOpen = await openAndLocateGateModal(ms.node, ms.targetSkillId)
            if (!reOpen.modalTargets.isModalOpen) break

            await execInputChecked({
              kind: 'click',
              normX: reOpen.modalTargets.targetCardCenter.x / reOpen.modalImg.width,
              normY: reOpen.modalTargets.targetCardCenter.y / reOpen.modalImg.height,
              holdMs: 0,
              parkAfter: false,
            })
            await waitSafe(350)

            await execInputChecked({
              kind: 'click',
              normX: reOpen.modalTargets.spendButtonCenter.x / reOpen.modalImg.width,
              normY: reOpen.modalTargets.spendButtonCenter.y / reOpen.modalImg.height,
              holdMs: 0,
              parkAfter: false,
            })
            await waitSafe(postPointDelayMs)

            const reAfter = await captureGameClientImageData(hwnd, 1920)
            if (detectRaiderScreenKind(reAfter.imageData) === 'gate_modal') {
              await execInputChecked({
                kind: 'click',
                normX: reOpen.modalTargets.closeButtonCenter.x / reOpen.modalImg.width,
                normY: reOpen.modalTargets.closeButtonCenter.y / reOpen.modalImg.height,
                holdMs: 0,
                parkAfter: true,
              })
              await waitSafe(520)
            } else {
              await execInputChecked({
                kind: 'park',
                normX: NEUTRAL_PARK_NORM_X,
                normY: NEUTRAL_PARK_NORM_Y,
                holdMs: 0,
              })
              await waitSafe(140)
            }

            const reTree = await captureGameClientImageData(hwnd, 1920)
            const reTreeRec = await recognizeBuildFromImageData(reTree.imageData, tree)
            if (reTreeRec.ok) {
              lastTreeImg = reTree.imageData
              lastTreeRec = reTreeRec
              if (reTreeRec.allocations?.[ms.targetSkillId] >= 1) {
                confirmedBranchPts[ms.branch] = (confirmedBranchPts[ms.branch] || 0) + 1
                confirmedTotalPts += 1
              } else {
                throw new Error(
                  `未能完成${gateTypeLabel}「${ms.skillName}」装备（请检查游戏内剩余可用技能点是否充足）。`,
                )
              }
            }
          }
        }
      }
    }
  }

  // 终态无遮挡读取确认（不再执行盲目二轮补点，彻底杜绝超额加点）
  let verifiedPoints = confirmedTotalPts
  try {
    const finalCheck = await parkAndCaptureTree(180)
    if (detectRaiderScreenKind(finalCheck.imageData) === 'gate_modal') {
      await execInputChecked({
        kind: 'click',
        normX: 0.598,
        normY: 0.877,
        holdMs: 0,
        parkAfter: true,
      })
      await waitSafe(500)
      const afterClose = await captureGameClientImageData(hwnd, 1920)
      const afterCloseRec = await recognizeBuildFromImageData(afterClose.imageData, tree)
      if (afterCloseRec.ok) {
        verifiedPoints = afterCloseRec.totalPoints
      }
    } else if (finalCheck.rec.ok) {
      verifiedPoints = finalCheck.rec.totalPoints
    }
  } catch (err) {
    if (err?.aborted) throw err
  }

  const actualAdded = Math.max(0, verifiedPoints - (initRec.totalPoints || 0))

  onProgress({
    phase: 'done',
    progressPct: 100,
    message: `同步完成！当前总投入 ${verifiedPoints}P`,
  })

  return {
    ok: true,
    alreadySynced: false,
    completedSteps: stepsList.length,
    totalDeltaPoints: actualAdded || execState.spentPoints,
    verifiedPoints,
    message: `同步完成！本次精准投入 ${actualAdded || execState.spentPoints} 点技能（当前总计 ${verifiedPoints}P / 目标 ${plan.totalTargetPoints}P）。`,
  }
}
