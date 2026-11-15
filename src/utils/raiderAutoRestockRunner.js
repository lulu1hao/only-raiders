/**
 * raiderAutoRestockRunner.js
 *
 * 自动补货与武器升级执行器（阶段 2）：
 * - 全程仅使用 UMG 鼠标导航（禁止合成 VK_ESCAPE，避免触发 Rust 端急停中断）
 * - 严格跳过 游牧使团 (nomad) 与 塞莱斯特 (celeste) 的以物易物商店
 * - 支持多件物品按 商人 (shani -> tian_wen -> lance -> apollo) 与 工坊站点 批处理合单
 * - [E 制作] / [购买] / [升级] 统一采用 920ms 左键长按 + 数量步进器 (+/-) 批量结算
 */

import { captureGameClientImageData } from './raiderAutoSyncPlanner'
import {
  CAPTURE_MAX_WIDTH,
  execSafeClick,
  execSafeHold,
  execSafePark,
  execSafeScroll,
  pointNorm,
  waitSafeOrThrow,
} from './raiderInputHelpers'
import {
  TRADERS_ORDER,
  WORKSHOP_STATIONS_ORDER,
  readLocalProgressionContext,
  resolveItemRestockChannels,
} from './raiderAcquisitionCatalog'
import {
  NAV_1080P,
  TRADER_1080P,
  WORKSHOP_1080P,
  computeClientViewport1080p,
  computeOfferGridSignature,
  didOfferGridScrollChange,
  didStepperQtyBoxChange,
  findOfferTilesInGrid,
  findUpgradableWeaponTiles,
  inspectAcquisitionScreen,
  inspectRightActionPanel,
  sampleStepperQtyBoxSignature,
} from './raiderAcquisitionRecognizer'

const HOLD_CONFIRM_MS = 920

async function captureAndVp(hwnd) {
  const cap = await captureGameClientImageData(hwnd, CAPTURE_MAX_WIDTH)
  const vp = computeClientViewport1080p(cap.imageData)
  return {
    cap,
    imageData: cap.imageData,
    vp,
    W: cap.imageData.width,
    H: cap.imageData.height,
  }
}

async function clickPt1080(hwnd, vp, W, H, pt1080, waitMs = 340, parkAfter = true) {
  const pt = pointNorm(pt1080, vp, W, H)
  await execSafeClick(hwnd, pt.x, pt.y, true, false)
  await waitSafeOrThrow(hwnd, waitMs)
  if (parkAfter) {
    await execSafePark(hwnd)
    await waitSafeOrThrow(hwnd, 75)
  }
}

/**
 * 在 152x96 商品/蓝图网格中滚动检索并执行批量购买或制造
 */
async function searchAndAcquireInOfferGrid({
  hwnd,
  gridSpec,
  kind,
  targetId,
  neededCount,
  yieldPerAction = 1,
  maxPages = 6,
  settleWaitMs = 180,
  isGridScrolled = false,
}) {
  let scrolled = isGridScrolled
  let acquired = 0

  // 若同一站点/商人在上一件物品时已向下滚过，先回滚至顶部避免遗漏前排商品
  if (scrolled) {
    for (let up = 0; up < maxPages; up++) {
      const cur = await captureAndVp(hwnd)
      const prevSig = computeOfferGridSignature(cur.imageData, cur.vp, gridSpec)
      const hPt = pointNorm(gridSpec.scrollHover, cur.vp, cur.W, cur.H)
      await execSafeScroll(hwnd, hPt.x, hPt.y, 1200)
      await waitSafeOrThrow(hwnd, 180)
      const next = await captureAndVp(hwnd)
      const nextSig = computeOfferGridSignature(next.imageData, next.vp, gridSpec)
      if (!didOfferGridScrollChange(prevSig, nextSig)) break
    }
    await execSafePark(hwnd)
    await waitSafeOrThrow(hwnd, 70)
    scrolled = false
  }

  for (let page = 0; page <= maxPages; page++) {
    const frame = await captureAndVp(hwnd)
    const matches = await findOfferTilesInGrid(frame.imageData, frame.vp, gridSpec, kind, targetId)

    for (const cand of matches) {
      await execSafeClick(hwnd, cand.normX, cand.normY, true, false)
      await waitSafeOrThrow(hwnd, settleWaitMs)
      await execSafePark(hwnd)
      await waitSafeOrThrow(hwnd, 80)

      let pFrame = await captureAndVp(hwnd)
      let panel = inspectRightActionPanel(pFrame.imageData, pFrame.vp)
      if (!panel.actionable || panel.insufficientResources) {
        continue
      }

      const unitYield = Math.max(1, Number(yieldPerAction) || 1)
      for (let cycle = 0; cycle < 3 && acquired < neededCount; cycle++) {
        const wantedActions = Math.max(1, Math.ceil((neededCount - acquired) / unitYield))

        if (panel.hasStepper && panel.plusNormX != null) {
          let actualExtraSteps = 0
          if (wantedActions > 1 && panel.plusEnabled) {
            const targetSteps = Math.min(wantedActions - 1, 29)
            for (let s = 0; s < targetSteps; s++) {
              const prevQtySig = sampleStepperQtyBoxSignature(
                pFrame.imageData,
                pFrame.vp,
                panel.stepperY1080,
              )
              await execSafeClick(hwnd, panel.plusNormX, panel.stepperNormY, true, false)
              await waitSafeOrThrow(hwnd, 65)
              const nextFrame = await captureAndVp(hwnd)
              const nextQtySig = sampleStepperQtyBoxSignature(
                nextFrame.imageData,
                nextFrame.vp,
                panel.stepperY1080,
              )
              pFrame = nextFrame
              if (!didStepperQtyBoxChange(prevQtySig, nextQtySig)) {
                break
              }
              actualExtraSteps++
            }
            await execSafePark(hwnd)
            await waitSafeOrThrow(hwnd, 75)
            pFrame = await captureAndVp(hwnd)
            panel = inspectRightActionPanel(pFrame.imageData, pFrame.vp)

            // 若因金币或库存限购导致步进上限处不可买，回退 '-' 步进直至黄色按钮激活
            let stepBackTries = 0
            while (
              actualExtraSteps > 0 &&
              (!panel.actionable || panel.insufficientResources) &&
              panel.minusNormX != null &&
              stepBackTries < actualExtraSteps
            ) {
              await execSafeClick(hwnd, panel.minusNormX, panel.stepperNormY, true, false)
              await waitSafeOrThrow(hwnd, 90)
              await execSafePark(hwnd)
              await waitSafeOrThrow(hwnd, 70)
              actualExtraSteps--
              stepBackTries++
              pFrame = await captureAndVp(hwnd)
              panel = inspectRightActionPanel(pFrame.imageData, pFrame.vp)
            }
          }

          if (panel.actionable && !panel.insufficientResources && panel.btnNormX != null) {
            await execSafeHold(hwnd, panel.btnNormX, panel.btnNormY, HOLD_CONFIRM_MS, true, true)
            await waitSafeOrThrow(hwnd, 340)
            acquired += (1 + actualExtraSteps) * unitYield
            if (acquired >= neededCount) {
              return { ok: true, count: Math.min(neededCount, acquired), scrolled }
            }
            pFrame = await captureAndVp(hwnd)
            panel = inspectRightActionPanel(pFrame.imageData, pFrame.vp)
            if (!panel.actionable || panel.insufficientResources) {
              break
            }
          } else {
            break
          }
        } else {
          // 无数量步进器（武器/配件/强化/护盾等单件商品），按需循环长按确认
          const repeatMax = Math.min(wantedActions, 6)
          let done = 0
          for (let rep = 0; rep < repeatMax; rep++) {
            if (rep > 0) {
              await waitSafeOrThrow(hwnd, 130)
              pFrame = await captureAndVp(hwnd)
              panel = inspectRightActionPanel(pFrame.imageData, pFrame.vp)
              if (!panel.actionable || panel.insufficientResources || panel.btnNormX == null) {
                break
              }
            }
            await execSafeHold(hwnd, panel.btnNormX, panel.btnNormY, HOLD_CONFIRM_MS, true, true)
            await waitSafeOrThrow(hwnd, 340)
            done++
          }
          if (done > 0) {
            acquired += done * unitYield
            if (acquired >= neededCount) {
              return { ok: true, count: Math.min(neededCount, acquired), scrolled }
            }
          }
          break
        }
      }
    }
    if (acquired >= neededCount) {
      return { ok: true, count: Math.min(neededCount, acquired), scrolled }
    }

    if (page >= maxPages) break

    const prevSig = computeOfferGridSignature(frame.imageData, frame.vp, gridSpec)
    const hPt = pointNorm(gridSpec.scrollHover, frame.vp, frame.W, frame.H)
    await execSafeScroll(hwnd, hPt.x, hPt.y, -960)
    await waitSafeOrThrow(hwnd, Math.max(190, Math.round(settleWaitMs)))
    await execSafePark(hwnd)
    await waitSafeOrThrow(hwnd, 75)
    scrolled = true

    const nextFrame = await captureAndVp(hwnd)
    const nextSig = computeOfferGridSignature(nextFrame.imageData, nextFrame.vp, gridSpec)
    if (!didOfferGridScrollChange(prevSig, nextSig)) {
      break
    }
  }

  return { ok: acquired > 0, count: Math.min(neededCount, acquired), scrolled }
}

/**
 * 从「物品栏 / 战备配置」通过点击左下角 UMG [ESC 返回] 或 [TAB键 关闭] 退回大厅顶栏（严禁合成物理 VK_ESCAPE，以免触发急停）
 */
async function ensureOutOfLoadoutScreen(hwnd) {
  for (let i = 0; i < 4; i++) {
    const f = await captureAndVp(hwnd)
    const scr = inspectAcquisitionScreen(f.imageData)
    if (!scr.isLoadout && scr.hasLobbyBar) {
      return f
    }
    if (scr.isLoadout) {
      const btnPt = i < 2 ? NAV_1080P.bottomEscBack : NAV_1080P.tabInventoryPill
      await clickPt1080(hwnd, f.vp, f.W, f.H, btnPt, 460, true)
    } else if (scr.hasSubScreenBack || scr.hasRightDetailCard) {
      await clickPt1080(hwnd, f.vp, f.W, f.H, NAV_1080P.subScreenBack, 420, true)
    } else {
      await clickPt1080(hwnd, f.vp, f.W, f.H, NAV_1080P.bottomEscBack, 420, true)
    }
  }
  return captureAndVp(hwnd)
}

/**
 * 确保从「工坊」或「商人」安全返回「奇袭者 -> 战备配置」双栏界面
 */
async function returnToLoadoutScreen(hwnd) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const f = await captureAndVp(hwnd)
    const scr = inspectAcquisitionScreen(f.imageData)
    if (scr.isLoadout) {
      return true
    }

    if (scr.hasSubScreenBack || scr.hasRightDetailCard) {
      await clickPt1080(hwnd, f.vp, f.W, f.H, NAV_1080P.subScreenBack, 380, true)
      const f2 = await captureAndVp(hwnd)
      const scr2 = inspectAcquisitionScreen(f2.imageData)
      if (scr2.isLoadout) {
        return true
      }
      if (scr2.hasTabInventoryPill) {
        await clickPt1080(hwnd, f2.vp, f2.W, f2.H, NAV_1080P.tabInventoryPill, 520, true)
      }
    } else if (scr.hasTabInventoryPill) {
      await clickPt1080(hwnd, f.vp, f.W, f.H, NAV_1080P.tabInventoryPill, 520, true)
    } else if (scr.hasLobbyBar) {
      await clickPt1080(hwnd, f.vp, f.W, f.H, NAV_1080P.topBar.raider, 380, true)
      const f2 = await captureAndVp(hwnd)
      const scr2 = inspectAcquisitionScreen(f2.imageData)
      if (scr2.hasTabInventoryPill) {
        await clickPt1080(hwnd, f2.vp, f2.W, f2.H, NAV_1080P.tabInventoryPill, 520, true)
      }
    } else {
      await clickPt1080(hwnd, f.vp, f.W, f.H, NAV_1080P.subScreenBack, 420, true)
    }
  }

  const finalCheck = await captureAndVp(hwnd)
  return Boolean(inspectAcquisitionScreen(finalCheck.imageData).isLoadout)
}

/**
 * 执行一次批处理自动补货与武器升级会话（阶段 2）
 */
export async function runAutoRestockSession({
  hwnd,
  restockBill = [],
  upgradeTasks = [],
  syncOptions = {},
  weaponLoadWaitMs = 3000,
  onProgress,
}) {
  const progressionCtx = syncOptions.respectLocalProgression
    ? readLocalProgressionContext()
    : null

  const items = (restockBill || [])
    .map((entry) => {
      const resolved = resolveItemRestockChannels(
        entry.kind,
        entry.targetId,
        syncOptions,
        progressionCtx,
        { amplified: Boolean(entry.amplified) },
      )
      return {
        ...entry,
        neededCount: Math.max(1, Number(entry.neededCount) || 1),
        remainingNeeded: Math.max(1, Number(entry.neededCount) || 1),
        channels: resolved.channels,
        channelIdx: 0,
        info: resolved.info,
        canRestock: resolved.canRestock,
        skipReason: resolved.skipReason,
      }
    })
    .filter((it) => it.canRestock && it.channels.length > 0)

  const pendingUpgrades = (upgradeTasks || []).filter(
    (u) => u && u.weaponId && Number(u.targetTier) > Math.max(1, Number(u.fromTier) || 1),
  )

  if (!items.length && !pendingUpgrades.length) {
    return {
      ok: true,
      boughtCount: 0,
      craftedCount: 0,
      upgradedCount: 0,
      returnedToLoadout: true,
      notes: [],
    }
  }

  onProgress?.({ progressPct: 56, message: '退出战备栏，准备前往补货/升级...' })
  await ensureOutOfLoadoutScreen(hwnd)

  const navState = {
    area: 'lobby', // 'lobby' | 'trader' | 'workshop'
    traderId: null,
    stationId: null,
    gunsmithTab: null,
    gridScrolled: false,
  }

  let boughtCount = 0
  let craftedCount = 0
  let upgradedCount = 0
  const acquiredKeys = new Set()
  const notes = []

  const resetNavToLobby = () => {
    navState.area = 'lobby'
    navState.traderId = null
    navState.stationId = null
    navState.gunsmithTab = null
    navState.gridScrolled = false
  }

  const ensureLobbyBarVisible = async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const f = await captureAndVp(hwnd)
      const scr = inspectAcquisitionScreen(f.imageData)
      if (!scr.isLoadout && scr.hasLobbyBar) {
        resetNavToLobby()
        return { ...f, scr }
      }
      const backPt = scr.isLoadout
        ? NAV_1080P.bottomEscBack
        : scr.hasSubScreenBack || scr.hasRightDetailCard
          ? NAV_1080P.subScreenBack
          : NAV_1080P.bottomEscBack
      await clickPt1080(hwnd, f.vp, f.W, f.H, backPt, 420, true)
      resetNavToLobby()
    }
    const fLast = await captureAndVp(hwnd)
    return { ...fLast, scr: inspectAcquisitionScreen(fLast.imageData) }
  }

  const openTrader = async (traderId) => {
    if (!TRADERS_ORDER.includes(traderId)) return false
    if (navState.area === 'trader' && navState.traderId === traderId) return true

    const lobby = await ensureLobbyBarVisible()
    let piazza = lobby
    if (lobby.scr?.activeLobbyTab !== 'traders') {
      await clickPt1080(hwnd, lobby.vp, lobby.W, lobby.H, NAV_1080P.topBar.traders, 400, true)
      piazza = await captureAndVp(hwnd)
    }
    const cardPt = TRADER_1080P.piazzaCards[traderId]
    if (!cardPt) return false
    await clickPt1080(hwnd, piazza.vp, piazza.W, piazza.H, cardPt, 440, true)
    navState.area = 'trader'
    navState.traderId = traderId
    navState.stationId = null
    navState.gunsmithTab = null
    navState.gridScrolled = false

    const post = await captureAndVp(hwnd)
    const scr = inspectAcquisitionScreen(post.imageData)
    if (!scr.hasRightDetailCard) {
      await clickPt1080(hwnd, post.vp, post.W, post.H, TRADER_1080P.tradeTab, 300, true)
    }
    return true
  }

  const openWorkshopStation = async (stationId, gunsmithTab = 'craft') => {
    if (!WORKSHOP_1080P.homeTiles[stationId]) return false

    if (navState.area !== 'workshop' || navState.stationId !== stationId) {
      const lobby = await ensureLobbyBarVisible()
      let home = lobby
      if (lobby.scr?.activeLobbyTab !== 'workshop') {
        await clickPt1080(hwnd, lobby.vp, lobby.W, lobby.H, NAV_1080P.topBar.workshop, 400, true)
        home = await captureAndVp(hwnd)
      }
      await clickPt1080(
        hwnd,
        home.vp,
        home.W,
        home.H,
        WORKSHOP_1080P.homeTiles[stationId],
        440,
        true,
      )
      navState.area = 'workshop'
      navState.traderId = null
      navState.stationId = stationId
      navState.gunsmithTab = 'craft'
      navState.gridScrolled = false
    }

    if (stationId === 'gunsmith' && navState.gunsmithTab !== gunsmithTab) {
      const tabPt = WORKSHOP_1080P.gunsmithTabs[gunsmithTab]
      if (tabPt) {
        const gf = await captureAndVp(hwnd)
        const tabWait =
          gunsmithTab === 'weaponUpgrade'
            ? Math.max(420, Math.min(weaponLoadWaitMs, 2200))
            : 320
        await clickPt1080(hwnd, gf.vp, gf.W, gf.H, tabPt, tabWait, true)
        navState.gunsmithTab = gunsmithTab
        navState.gridScrolled = false
      }
    }
    return true
  }

  const runTraderPass = async () => {
    for (const traderId of TRADERS_ORDER) {
      const queue = items.filter(
        (it) =>
          it.remainingNeeded > 0 &&
          it.channels[it.channelIdx] === 'trader' &&
          it.info?.trader?.traderId === traderId,
      )
      if (!queue.length) continue

      const traderLabel = queue[0].info.trader.traderZh || traderId
      onProgress?.({ progressPct: 60, message: `前往商人「${traderLabel}」采购补货...` })
      const opened = await openTrader(traderId)
      if (!opened) {
        for (const it of queue) it.channelIdx++
        continue
      }

      for (const it of queue) {
        onProgress?.({
          progressPct: 63,
          message: `商人购买：${it.targetName} (需 ${it.remainingNeeded})`,
        })
        const res = await searchAndAcquireInOfferGrid({
          hwnd,
          gridSpec: TRADER_1080P.shopGrid,
          kind: it.kind,
          targetId: it.targetId,
          neededCount: it.remainingNeeded,
          yieldPerAction: it.info.trader?.bundleCount || 1,
          maxPages: 6,
          settleWaitMs: it.kind === 'weapon' ? Math.min(Math.max(220, weaponLoadWaitMs * 0.35), 900) : 185,
          isGridScrolled: navState.gridScrolled,
        })
        navState.gridScrolled = res.scrolled

        if (res.count > 0) {
          boughtCount += res.count
          acquiredKeys.add(it.key)
          it.remainingNeeded = Math.max(0, it.remainingNeeded - res.count)
        }
        if (it.remainingNeeded > 0) {
          // 商人售罄或金币不足时，切往下一备用渠道（若工坊可制作则交由工坊兜底）
          it.channelIdx++
        }
      }
    }
  }

  const runWorkshopCraftPass = async () => {
    const workbenchFallbacks = []

    for (const stationId of WORKSHOP_STATIONS_ORDER) {
      const queue = items.filter(
        (it) =>
          it.remainingNeeded > 0 &&
          it.channels[it.channelIdx] === 'workshop' &&
          it.info?.workshop?.stationId === stationId,
      )
      if (!queue.length) continue

      const stationZh = queue[0].info.workshop.stationZh || stationId
      onProgress?.({ progressPct: 66, message: `前往工坊「${stationZh}」制造补货...` })
      const opened = await openWorkshopStation(stationId, 'craft')
      if (!opened) {
        for (const it of queue) it.channelIdx++
        continue
      }

      for (const it of queue) {
        onProgress?.({
          progressPct: 69,
          message: `工坊制造：${it.targetName} (需 ${it.remainingNeeded})`,
        })
        const res = await searchAndAcquireInOfferGrid({
          hwnd,
          gridSpec: WORKSHOP_1080P.craftGrid,
          kind: it.kind,
          targetId: it.targetId,
          neededCount: it.remainingNeeded,
          yieldPerAction: it.info.workshop?.craftYield || 1,
          maxPages: 8,
          settleWaitMs:
            stationId === 'gunsmith'
              ? Math.min(Math.max(220, weaponLoadWaitMs * 0.35), 900)
              : 185,
          isGridScrolled: navState.gridScrolled,
        })
        navState.gridScrolled = res.scrolled

        if (res.count > 0) {
          craftedCount += res.count
          acquiredKeys.add(it.key)
          it.remainingNeeded = Math.max(0, it.remainingNeeded - res.count)
        }
        if (it.remainingNeeded > 0) {
          if (it.info.workshop?.fallbackWorkbenchLv1 && stationId !== 'workbench') {
            workbenchFallbacks.push(it)
          } else {
            it.channelIdx++
          }
        }
      }
    }

    // Lv.1 工作台共享配方兜底（仅当专属工坊未找到或未解锁时）
    if (workbenchFallbacks.length) {
      onProgress?.({ progressPct: 71, message: '尝试在基础「工作台」补充制造...' })
      const opened = await openWorkshopStation('workbench', 'craft')
      if (opened) {
        for (const it of workbenchFallbacks) {
          if (it.remainingNeeded <= 0) continue
          const res = await searchAndAcquireInOfferGrid({
            hwnd,
            gridSpec: WORKSHOP_1080P.craftGrid,
            kind: it.kind,
            targetId: it.targetId,
            neededCount: it.remainingNeeded,
            yieldPerAction: it.info.workshop?.craftYield || 1,
            maxPages: 8,
            settleWaitMs: 185,
            isGridScrolled: navState.gridScrolled,
          })
          navState.gridScrolled = res.scrolled
          if (res.count > 0) {
            craftedCount += res.count
            acquiredKeys.add(it.key)
            it.remainingNeeded = Math.max(0, it.remainingNeeded - res.count)
          }
          if (it.remainingNeeded > 0) {
            it.channelIdx++
          }
        }
      } else {
        for (const it of workbenchFallbacks) it.channelIdx++
      }
    }
  }

  // 根据策略决定首轮优先 Trader 还是 Workshop，第 2 轮自动执行跨渠道兜底剩余缺口
  const passSequence =
    syncOptions.restockSourcePolicy === 'workshop_first'
      ? ['workshop', 'trader']
      : ['trader', 'workshop']

  if (items.length) {
    for (let round = 0; round < 2; round++) {
      for (const passKind of passSequence) {
        const hasWork = items.some(
          (it) => it.remainingNeeded > 0 && it.channels[it.channelIdx] === passKind,
        )
        if (!hasWork) continue
        if (passKind === 'trader') await runTraderPass()
        else await runWorkshopCraftPass()
      }
    }
  }

  // 武器工作台 -> 武器升级（仅当开启匹配武器等级且有待升阶武器时）
  const activeUpgrades = pendingUpgrades.filter(
    (t) => !t.requiresAcquiredKey || acquiredKeys.has(t.requiresAcquiredKey),
  )
  if (activeUpgrades.length) {
    onProgress?.({ progressPct: 74, message: '前往武器工作台升级目标武器...' })
    const opened = await openWorkshopStation('gunsmith', 'weaponUpgrade')
    if (opened) {
      for (const task of activeUpgrades) {
        const steps = Math.max(
          0,
          Math.min(3, (Number(task.targetTier) || 1) - Math.max(1, Number(task.fromTier) || 1)),
        )
        for (let step = 0; step < steps; step++) {
          onProgress?.({
            progressPct: 75,
            message: `武器升级：${task.weaponName || task.weaponId} (${step + 1}/${steps})`,
          })

          let upgradedThisStep = false
          // 若当前页面未找到可升级武器卡片，最多向下滚动 3 屏查找
          for (let page = 0; page <= 3; page++) {
            const frame = await captureAndVp(hwnd)
            const cands = await findUpgradableWeaponTiles(frame.imageData, frame.vp, task.weaponId)
            const orderedCands = [
              ...cands.filter((c) => !c.hasRedCost),
              ...cands.filter((c) => c.hasRedCost),
            ]

            for (const cand of orderedCands.slice(0, 2)) {
              await execSafeClick(hwnd, cand.normX, cand.normY, true, false)
              await waitSafeOrThrow(hwnd, 240)
              await execSafePark(hwnd)
              await waitSafeOrThrow(hwnd, 80)

              const pFrame = await captureAndVp(hwnd)
              const panel = inspectRightActionPanel(pFrame.imageData, pFrame.vp)
              if (panel.actionable && !panel.insufficientResources && panel.btnNormX != null) {
                await execSafeHold(hwnd, panel.btnNormX, panel.btnNormY, HOLD_CONFIRM_MS, true, true)
                await waitSafeOrThrow(hwnd, 500)
                upgradedCount++
                upgradedThisStep = true
                break
              }
            }

            if (upgradedThisStep || page >= 3) break

            const prevSig = computeOfferGridSignature(
              frame.imageData,
              frame.vp,
              WORKSHOP_1080P.craftGrid,
            )
            const hPt = pointNorm(WORKSHOP_1080P.craftGrid.scrollHover, frame.vp, frame.W, frame.H)
            await execSafeScroll(hwnd, hPt.x, hPt.y, -960)
            await waitSafeOrThrow(hwnd, 240)
            await execSafePark(hwnd)
            await waitSafeOrThrow(hwnd, 75)
            const nextFrame = await captureAndVp(hwnd)
            const nextSig = computeOfferGridSignature(
              nextFrame.imageData,
              nextFrame.vp,
              WORKSHOP_1080P.craftGrid,
            )
            if (!didOfferGridScrollChange(prevSig, nextSig)) break
          }

          if (!upgradedThisStep) {
            notes.push(`${task.weaponName || task.weaponId} 升阶材料不足或未就绪`)
            break
          }
        }
      }
    }
  }

  onProgress?.({ progressPct: 77, message: '补货完成，返回战备配置栏...' })
  const returnedToLoadout = await returnToLoadoutScreen(hwnd)

  return {
    ok: returnedToLoadout,
    boughtCount,
    craftedCount,
    upgradedCount,
    returnedToLoadout,
    notes,
  }
}
