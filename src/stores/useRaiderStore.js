import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import raiderData from '../data/raiderSkillsData.json'

const STORAGE_KEY = 'arc_raider_skill_planner_v2'
const LEGACY_KEY = 'arc_raider_skill_planner_v1'

export const STAT_CATEGORY_META = {
  stamina: { id: 'stamina', label: '耐力与恢复', order: 1 },
  traversal: { id: 'traversal', label: '机动与跑酷', order: 2 },
  encumbrance: { id: 'encumbrance', label: '负重与护盾', order: 3 },
  looting: { id: 'looting', label: '搜刮与破拆', order: 4 },
  stealth: { id: 'stealth', label: '潜行与静音', order: 5 },
  crafting: { id: 'crafting', label: '局内制造与维修', order: 6 },
  combat: { id: 'combat', label: '近战与冲撞', order: 7 },
  survivability: { id: 'survivability', label: '倒地与生存', order: 8 },
}

function cloneBuild(b) {
  return {
    allocations: { ...(b?.allocations || {}) },
    gateSelections: { ...(b?.gateSelections || {}) },
  }
}

function loadPersistedState() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
    const legacyRaw = window.localStorage.getItem(LEGACY_KEY)
    if (legacyRaw) {
      const leg = JSON.parse(legacyRaw)
      return {
        expeditionCount: leg?.expeditionCount || 0,
        showXRayBadges: leg?.showXRayBadges !== false,
        sidebarCollapsed: false,
        build: leg?.builds?.v2 || { allocations: {}, gateSelections: {} },
        savedBuilds: Array.isArray(leg?.savedBuilds)
          ? leg.savedBuilds.filter((s) => !s.version || s.version === 'v2')
          : [],
      }
    }
    return null
  } catch {
    return null
  }
}

function validateBuildState(tree, allocations, gateSelections) {
  const nodesById = new Map()
  for (const n of tree.nodes) nodesById.set(n.nodeId, n)

  const getNodeSkillId = (node) => {
    if (node.kind === 'normal') return node.skillId
    return gateSelections[node.slotKey] || null
  }

  const getNodePoints = (node) => {
    const sid = getNodeSkillId(node)
    if (!sid) return 0
    return allocations[sid] || 0
  }

  const representedSkills = new Set()
  const groupUsedSkills = new Map()

  for (const node of tree.nodes) {
    if (node.kind === 'normal') {
      representedSkills.add(node.skillId)
      const pts = allocations[node.skillId] || 0
      const sk = tree.skills[node.skillId]
      if (!sk || pts < 0 || pts > sk.maxPoints) {
        return { valid: false, reason: '技能点数超出上限' }
      }
    } else {
      const sid = gateSelections[node.slotKey]
      if (sid) {
        if (!node.candidateIds.includes(sid)) {
          return { valid: false, reason: '门控槽位候选无效' }
        }
        const used = groupUsedSkills.get(node.groupId) || new Set()
        if (used.has(sid)) {
          return { valid: false, reason: '互斥组不可重复选择同一技能' }
        }
        used.add(sid)
        groupUsedSkills.set(node.groupId, used)
        representedSkills.add(sid)
        if ((allocations[sid] || 0) !== 1) {
          return { valid: false, reason: '门控技能点数状态异常' }
        }
      }
    }
  }

  for (const [sid, pts] of Object.entries(allocations)) {
    if (pts > 0 && !representedSkills.has(sid)) {
      return { valid: false, reason: '存在未绑定节点的技能点' }
    }
  }

  const pointsInTierRange = (branchId, minTier, maxTier) => {
    let sum = 0
    for (const node of tree.nodes) {
      if (node.branch === branchId && node.tier >= minTier && node.tier <= maxTier) {
        sum += getNodePoints(node)
      }
    }
    return sum
  }

  for (const node of tree.nodes) {
    const pts = getNodePoints(node)
    if (pts <= 0) continue

    if (node.parentNodeIds && node.parentNodeIds.length > 0) {
      const hasUnlockedParent = node.parentNodeIds.some((pid) => {
        const pNode = nodesById.get(pid)
        return pNode && getNodePoints(pNode) > 0
      })
      if (!hasUnlockedParent) {
        const sk = tree.skills[getNodeSkillId(node)]
        return {
          valid: false,
          reason: `无法回退：下游「${sk?.name || node.nodeId}」依赖此前置节点`,
        }
      }
    }

    if (node.minBranchPoints > 0) {
      if (node.earlyPoolOnly) {
        const earlyPts = pointsInTierRange(node.branch, 0, 2)
        if (earlyPts < node.minBranchPoints) {
          const sk = tree.skills[getNodeSkillId(node)]
          return {
            valid: false,
            reason: `无法回退：「${sk?.name || '门控'}」需前段满 ${node.minBranchPoints}P`,
          }
        }
      } else if (node.kind === 'capstone' && node.slotIndex === 1) {
        const firstSlot = tree.nodes.find(
          (n) => n.groupId === node.groupId && n.slotIndex === 0,
        )
        const firstPts = firstSlot ? getNodePoints(firstSlot) : 0
        const nonCapPts = pointsInTierRange(node.branch, 0, 5)
        if (firstPts <= 0) {
          return {
            valid: false,
            reason: '无法回退：需先保留第 1 终极槽位',
          }
        }
        if (nonCapPts + firstPts < node.minBranchPoints) {
          const sk = tree.skills[getNodeSkillId(node)]
          return {
            valid: false,
            reason: `无法回退：「${sk?.name || ''}」需分支前置满 ${node.minBranchPoints}P`,
          }
        }
      } else {
        const priorPts = pointsInTierRange(node.branch, 0, node.tier - 1)
        if (priorPts < node.minBranchPoints) {
          const sk = tree.skills[getNodeSkillId(node)]
          return {
            valid: false,
            reason: `无法回退：「${sk?.name || ''}」需分支前置满 ${node.minBranchPoints}P`,
          }
        }
      }
    }
  }

  return { valid: true, reason: '' }
}

export const useRaiderStore = defineStore('raiderSkills', () => {
  const saved = loadPersistedState()

  const expeditionCount = ref(
    Number.isInteger(saved?.expeditionCount)
      ? Math.max(0, Math.min(3, saved.expeditionCount))
      : 0,
  )
  const showXRayBadges = ref(saved?.showXRayBadges !== false)
  const sidebarCollapsed = ref(saved?.sidebarCollapsed === true)
  const focusedBranch = ref('all')
  const selectedNodeId = ref(2000)
  const selectedCandidateId = ref(null)
  const selectSeq = ref(0)
  const activeGateModalNodeId = ref(null)
  const currentBuild = ref(
    saved?.build ? cloneBuild(saved.build) : { allocations: {}, gateSelections: {} },
  )
  const savedBuilds = ref(Array.isArray(saved?.savedBuilds) ? saved.savedBuilds : [])
  const syncPrefs = ref({
    smallHoldDurationMs: Math.max(
      380,
      Math.min(880, Number(saved?.syncPrefs?.smallHoldDurationMs) || 580),
    ),
    bigHoldDurationMs: Math.max(
      650,
      Math.min(1450, Number(saved?.syncPrefs?.bigHoldDurationMs) || 960),
    ),
    postPointDelayMs: Number.isFinite(Number(saved?.syncPrefs?.postPointDelayMs))
      ? Math.max(250, Math.min(3000, Number(saved.syncPrefs.postPointDelayMs)))
      : 1000,
    gateOpenMode: saved?.syncPrefs?.gateOpenMode || 'auto',
    gateConfirmMode: saved?.syncPrefs?.gateConfirmMode || 'auto',
  })
  const toast = ref(null)

  let toastTimer = null
  function notify(text, type = 'info') {
    if (toastTimer) clearTimeout(toastTimer)
    toast.value = { text, type, ts: Date.now() }
    toastTimer = setTimeout(() => {
      toast.value = null
    }, 2400)
  }

  let applyingExternalStorage = false
  let lastSerializedState = ''

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue || e.newValue === lastSerializedState) return
      try {
        const parsed = JSON.parse(e.newValue)
        if (!parsed || typeof parsed !== 'object') return
        applyingExternalStorage = true
        lastSerializedState = e.newValue
        if (Number.isInteger(parsed.expeditionCount)) {
          expeditionCount.value = Math.max(0, Math.min(3, parsed.expeditionCount))
        }
        if (typeof parsed.showXRayBadges === 'boolean') {
          showXRayBadges.value = parsed.showXRayBadges
        }
        if (parsed.build && typeof parsed.build === 'object') {
          currentBuild.value = cloneBuild(parsed.build)
        }
        if (Array.isArray(parsed.savedBuilds)) {
          savedBuilds.value = parsed.savedBuilds
        }
        if (parsed.syncPrefs && typeof parsed.syncPrefs === 'object') {
          syncPrefs.value = {
            ...syncPrefs.value,
            ...parsed.syncPrefs,
          }
        }
      } catch {
        // Ignore malformed storage payload
      } finally {
        applyingExternalStorage = false
      }
    })
  }

  let persistTimer = null

  function flushPersistence() {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    if (typeof window === 'undefined' || applyingExternalStorage) return
    try {
      const serialized = JSON.stringify({
        expeditionCount: expeditionCount.value,
        showXRayBadges: showXRayBadges.value,
        sidebarCollapsed: sidebarCollapsed.value,
        build: currentBuild.value,
        savedBuilds: savedBuilds.value,
        syncPrefs: syncPrefs.value,
      })
      if (serialized !== lastSerializedState) {
        lastSerializedState = serialized
        window.localStorage.setItem(STORAGE_KEY, serialized)
      }
    } catch {
      // Ignore storage errors
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushPersistence)
    window.addEventListener('beforeunload', flushPersistence)
  }

  watch(
    [expeditionCount, showXRayBadges, sidebarCollapsed, currentBuild, savedBuilds, syncPrefs],
    () => {
      if (typeof window === 'undefined' || applyingExternalStorage) return
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = window.setTimeout(flushPersistence, 160)
    },
    { deep: true },
  )

  const meta = raiderData.meta
  const branches = raiderData.branches
  const branchMap = Object.fromEntries(branches.map((b) => [b.id, b]))
  const presets = raiderData.presets
  const currentTree = raiderData.tree

  const maxSkillPoints = computed(
    () => meta.baseSkillPoints + expeditionCount.value * meta.pointsPerExpedition,
  )

  const nodesById = new Map(currentTree.nodes.map((n) => [n.nodeId, n]))

  function getNodeSkillId(node) {
    if (!node) return null
    if (node.kind === 'normal') return node.skillId
    return currentBuild.value.gateSelections?.[node.slotKey] || null
  }

  function getNodePoints(node) {
    const sid = getNodeSkillId(node)
    if (!sid) return 0
    return currentBuild.value.allocations?.[sid] || 0
  }

  const branchPoints = computed(() => {
    const sums = { conditioning: 0, mobility: 0, survival: 0 }
    for (const node of currentTree.nodes) {
      sums[node.branch] = (sums[node.branch] || 0) + getNodePoints(node)
    }
    return sums
  })

  const earlyBranchPoints = computed(() => {
    const sums = { conditioning: 0, mobility: 0, survival: 0 }
    for (const node of currentTree.nodes) {
      if (node.tier <= 2) {
        sums[node.branch] = (sums[node.branch] || 0) + getNodePoints(node)
      }
    }
    return sums
  })

  const nonCapstoneBranchPoints = computed(() => {
    const sums = { conditioning: 0, mobility: 0, survival: 0 }
    for (const node of currentTree.nodes) {
      if (node.tier <= 5) {
        sums[node.branch] = (sums[node.branch] || 0) + getNodePoints(node)
      }
    }
    return sums
  })

  const totalSpentPoints = computed(() =>
    Object.values(branchPoints.value).reduce((a, b) => a + b, 0),
  )

  const remainingPoints = computed(() => maxSkillPoints.value - totalSpentPoints.value)

  const resetCoinCost = computed(() => totalSpentPoints.value * meta.resetCoinCostPerPoint)

  const nodeStates = computed(() => {
    const out = {}
    for (const node of currentTree.nodes) {
      const sid = getNodeSkillId(node)
      const sk = sid ? currentTree.skills[sid] : null
      const pts = sid ? currentBuild.value.allocations?.[sid] || 0 : 0
      const maxPts = node.kind === 'normal' ? sk?.maxPoints || 1 : 1

      const pathReady =
        !node.parentNodeIds ||
        node.parentNodeIds.length === 0 ||
        node.parentNodeIds.some((pid) => {
          const pNode = nodesById.get(pid)
          return pNode && getNodePoints(pNode) > 0
        })

      let requiredPoolPts = branchPoints.value[node.branch] || 0
      let prevSlotReady = true
      if (node.minBranchPoints > 0) {
        if (node.earlyPoolOnly) {
          requiredPoolPts = earlyBranchPoints.value[node.branch] || 0
        } else if (node.kind === 'capstone' && node.slotIndex === 1) {
          const firstSlot = currentTree.nodes.find(
            (n) => n.groupId === node.groupId && n.slotIndex === 0,
          )
          const firstPts = firstSlot ? getNodePoints(firstSlot) : 0
          prevSlotReady = firstPts > 0
          requiredPoolPts = (nonCapstoneBranchPoints.value[node.branch] || 0) + firstPts
        } else {
          let sumBelow = 0
          for (const other of currentTree.nodes) {
            if (other.branch === node.branch && other.tier < node.tier) {
              sumBelow += getNodePoints(other)
            }
          }
          requiredPoolPts = sumBelow
        }
      }

      const thresholdReady = node.minBranchPoints <= 0 || requiredPoolPts >= node.minBranchPoints
      const prerequisitesMet = pathReady && prevSlotReady && thresholdReady

      let status = 'locked'
      if (pts >= maxPts && maxPts > 0) {
        status = 'maxed'
      } else if (pts > 0) {
        status = 'partial'
      } else if (prerequisitesMet) {
        status = 'available'
      }

      let lockReason = ''
      if (!pathReady) {
        lockReason = '需先解锁前置节点'
      } else if (!prevSlotReady) {
        lockReason = '需先解锁 30P 终极槽'
      } else if (!thresholdReady) {
        const bName = branchMap[node.branch]?.name || node.branch
        lockReason = node.earlyPoolOnly
          ? `${bName}前段需满 ${node.minBranchPoints}P (${requiredPoolPts}/${node.minBranchPoints})`
          : `${bName}需满 ${node.minBranchPoints}P (${requiredPoolPts}/${node.minBranchPoints})`
      } else if (pts < maxPts && remainingPoints.value <= 0) {
        lockReason = '技能点已用尽'
      }

      out[node.nodeId] = {
        node,
        skillId: sid,
        skill: sk,
        points: pts,
        maxPoints: maxPts,
        pathReady,
        prevSlotReady,
        thresholdReady,
        requiredPoolPts,
        prerequisitesMet,
        canIncrement: prerequisitesMet && pts < maxPts && remainingPoints.value > 0,
        status,
        lockReason,
      }
    }
    return out
  })

  const selectedNodeState = computed(() => {
    if (selectedNodeId.value == null) return null
    return nodeStates.value[selectedNodeId.value] || null
  })

  const activeGateModalState = computed(() => {
    if (activeGateModalNodeId.value == null) return null
    return nodeStates.value[activeGateModalNodeId.value] || null
  })

  function toggleSidebar(forceValue) {
    sidebarCollapsed.value =
      typeof forceValue === 'boolean' ? forceValue : !sidebarCollapsed.value
  }

  function setExpeditionCount(count) {
    const clamped = Math.max(0, Math.min(meta.maxExpeditions, Number(count) || 0))
    const newBudget = meta.baseSkillPoints + clamped * meta.pointsPerExpedition
    if (totalSpentPoints.value > newBudget) {
      notify(`已分配 ${totalSpentPoints.value}P，超出 ${newBudget}P 上限`, 'warn')
      return false
    }
    expeditionCount.value = clamped
    return true
  }

  function selectNode(nodeId, candidateId = null) {
    if (selectedNodeId.value !== nodeId) {
      selectedNodeId.value = nodeId
      selectedCandidateId.value = candidateId
    } else if (candidateId) {
      selectedCandidateId.value = candidateId
    }
    selectSeq.value += 1
  }

  function openGateModal(nodeId) {
    selectNode(nodeId)
    activeGateModalNodeId.value = nodeId
  }

  function closeGateModal() {
    activeGateModalNodeId.value = null
  }

  function allocateNode(nodeId, fillToMax = false) {
    const st = nodeStates.value[nodeId]
    if (!st) return false
    const wasSelected = selectedNodeId.value === nodeId
    selectedNodeId.value = nodeId
    selectedCandidateId.value = null
    selectSeq.value += 1

    if (st.node.kind !== 'normal') {
      activeGateModalNodeId.value = nodeId
      return true
    }

    if (!st.prerequisitesMet) {
      notify(st.lockReason || '前置未满足', 'warn')
      return false
    }
    if (st.points >= st.maxPoints) {
      if (wasSelected) {
        notify(`「${st.skill?.name || '该技能'}」已满级，右键可回退`, 'info')
      }
      return false
    }
    if (remainingPoints.value <= 0) {
      notify(`已达 ${maxSkillPoints.value}P 上限`, 'warn')
      return false
    }

    const add = fillToMax
      ? Math.min(st.maxPoints - st.points, remainingPoints.value)
      : 1
    if (add <= 0) return false

    const next = cloneBuild(currentBuild.value)
    next.allocations[st.skillId] = st.points + add
    currentBuild.value = next
    return true
  }

  function deallocateNode(nodeId, clearAll = false) {
    const st = nodeStates.value[nodeId]
    if (!st) return false
    selectedNodeId.value = nodeId
    selectSeq.value += 1

    if (st.points <= 0) {
      if (st.node.kind !== 'normal') activeGateModalNodeId.value = nodeId
      return false
    }

    if (st.node.kind !== 'normal') {
      return clearGateSlot(st.node.slotKey)
    }

    const targetPts = clearAll ? 0 : st.points - 1
    const next = cloneBuild(currentBuild.value)
    if (targetPts <= 0) {
      delete next.allocations[st.skillId]
    } else {
      next.allocations[st.skillId] = targetPts
    }

    const check = validateBuildState(currentTree, next.allocations, next.gateSelections)
    if (!check.valid) {
      notify(check.reason, 'warn')
      return false
    }

    currentBuild.value = next
    return true
  }

  function selectGateSkill(nodeId, candidateSkillId) {
    const st = nodeStates.value[nodeId]
    if (!st || st.node.kind === 'normal') return false
    const node = st.node
    if (!node.candidateIds.includes(candidateSkillId)) return false
    selectedNodeId.value = nodeId
    selectedCandidateId.value = candidateSkillId
    selectSeq.value += 1

    for (const other of currentTree.nodes) {
      if (
        other.groupId === node.groupId &&
        other.slotKey !== node.slotKey &&
        currentBuild.value.gateSelections[other.slotKey] === candidateSkillId
      ) {
        notify('互斥组不可重复装备同一技能', 'warn')
        return false
      }
    }

    if (!st.prerequisitesMet) {
      notify(st.lockReason || '前置点数未达标', 'warn')
      return false
    }

    const prevSkillId = currentBuild.value.gateSelections[node.slotKey] || null
    if (prevSkillId === candidateSkillId) {
      activeGateModalNodeId.value = null
      return true
    }

    if (!prevSkillId && remainingPoints.value <= 0) {
      notify(`可用点数不足（上限 ${maxSkillPoints.value}P）`, 'warn')
      return false
    }

    const next = cloneBuild(currentBuild.value)
    if (prevSkillId) delete next.allocations[prevSkillId]
    next.gateSelections[node.slotKey] = candidateSkillId
    next.allocations[candidateSkillId] = 1

    const check = validateBuildState(currentTree, next.allocations, next.gateSelections)
    if (!check.valid) {
      notify(check.reason, 'warn')
      return false
    }

    currentBuild.value = next
    activeGateModalNodeId.value = null
    return true
  }

  function clearGateSlot(slotKey) {
    const node = currentTree.nodes.find((n) => n.slotKey === slotKey)
    if (!node) return false
    const prevSkillId = currentBuild.value.gateSelections[slotKey]
    if (!prevSkillId) return false

    const next = cloneBuild(currentBuild.value)
    delete next.gateSelections[slotKey]
    delete next.allocations[prevSkillId]

    if (node.kind === 'capstone' && node.slotIndex === 0) {
      const slot1 = currentTree.nodes.find(
        (n) => n.groupId === node.groupId && n.slotIndex === 1,
      )
      const slot1Skill = slot1 ? next.gateSelections[slot1.slotKey] : null
      if (slot1 && slot1Skill) {
        next.gateSelections[node.slotKey] = slot1Skill
        delete next.gateSelections[slot1.slotKey]
      }
    }

    const check = validateBuildState(currentTree, next.allocations, next.gateSelections)
    if (!check.valid) {
      notify(check.reason, 'warn')
      return false
    }

    currentBuild.value = next
    return true
  }

  function resetCurrentTree() {
    currentBuild.value = { allocations: {}, gateSelections: {} }
    activeGateModalNodeId.value = null
    notify('已清空技能加点', 'info')
  }

  function applyPreset(presetId) {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return false
    const neededExp = Math.max(
      0,
      Math.ceil((preset.maxPoints - meta.baseSkillPoints) / meta.pointsPerExpedition),
    )
    if (expeditionCount.value < neededExp) {
      expeditionCount.value = neededExp
    }
    currentBuild.value = {
      allocations: { ...preset.allocations },
      gateSelections: { ...(preset.gateSelections || {}) },
    }
    activeGateModalNodeId.value = null
    notify(`已载入：${preset.name}`, 'ok')
    return true
  }

  function saveCustomBuild(customName) {
    const name = String(customName || '').trim() || `配装 #${savedBuilds.value.length + 1}`
    const record = {
      id: `cb_${Date.now().toString(36)}`,
      name,
      expeditionCount: expeditionCount.value,
      spentPoints: totalSpentPoints.value,
      allocations: { ...currentBuild.value.allocations },
      gateSelections: { ...currentBuild.value.gateSelections },
    }
    savedBuilds.value = [record, ...savedBuilds.value].slice(0, 12)
    notify(`已保存「${name}」`, 'ok')
    return record
  }

  function loadCustomBuild(id) {
    const rec = savedBuilds.value.find((item) => item.id === id)
    if (!rec) return false
    expeditionCount.value = Math.max(0, Math.min(3, rec.expeditionCount || 0))
    currentBuild.value = {
      allocations: { ...(rec.allocations || {}) },
      gateSelections: { ...(rec.gateSelections || {}) },
    }
    activeGateModalNodeId.value = null
    notify(`已载入「${rec.name}」`, 'ok')
    return true
  }

  function deleteCustomBuild(id) {
    savedBuilds.value = savedBuilds.value.filter((item) => item.id !== id)
  }

  function encodeBuildToShareCode(buildObj = currentBuild.value, expCount = expeditionCount.value) {
    const skillKeys = Object.keys(currentTree.skills).sort()
    const slotKeys = currentTree.nodes
      .filter((n) => n.kind !== 'normal')
      .map((n) => n.slotKey)
      .sort()

    const allocPairs = []
    for (const [sid, pts] of Object.entries(buildObj?.allocations || {})) {
      if (pts > 0) {
        const idx = skillKeys.indexOf(sid)
        if (idx >= 0) allocPairs.push([idx, pts])
      }
    }

    const gatePairs = []
    for (const [sKey, sid] of Object.entries(buildObj?.gateSelections || {})) {
      const slotIdx = slotKeys.indexOf(sKey)
      const skillIdx = skillKeys.indexOf(sid)
      if (slotIdx >= 0 && skillIdx >= 0) gatePairs.push([slotIdx, skillIdx])
    }

    const compact = [2, Math.max(0, Math.min(3, Number(expCount) || 0)), allocPairs, gatePairs]
    const json = JSON.stringify(compact)
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    return `AR.${b64}`
  }

  function exportShareCode() {
    return encodeBuildToShareCode(currentBuild.value, expeditionCount.value)
  }

  function importShareCode(rawInput) {
    try {
      let str = String(rawInput || '').trim()
      if (!str) return false
      if (str.includes('build=')) {
        const u = new URL(str, 'http://localhost')
        str = u.searchParams.get('build') || str
      }
      if (str.startsWith('AR.')) str = str.slice(3)
      const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4)
      const json = decodeURIComponent(escape(atob(padded)))
      const parsed = JSON.parse(json)
      if (!Array.isArray(parsed) || parsed.length < 4 || parsed[0] === 1) {
        throw new Error('格式不兼容')
      }

      const exp = Math.max(0, Math.min(3, Number(parsed[1]) || 0))
      const skillKeys = Object.keys(currentTree.skills).sort()
      const slotKeys = currentTree.nodes
        .filter((n) => n.kind !== 'normal')
        .map((n) => n.slotKey)
        .sort()

      const allocations = {}
      for (const [idx, pts] of parsed[2] || []) {
        const sid = skillKeys[idx]
        if (sid && pts > 0) allocations[sid] = pts
      }

      const gateSelections = {}
      for (const [slotIdx, skillIdx] of parsed[3] || []) {
        const sKey = slotKeys[slotIdx]
        const sid = skillKeys[skillIdx]
        if (sKey && sid) gateSelections[sKey] = sid
      }

      const check = validateBuildState(currentTree, allocations, gateSelections)
      if (!check.valid) {
        notify(`导入失败：${check.reason}`, 'warn')
        return false
      }

      const spent = Object.values(allocations).reduce((a, b) => a + b, 0)
      const minExp = Math.max(
        exp,
        Math.ceil(Math.max(0, spent - meta.baseSkillPoints) / meta.pointsPerExpedition),
      )
      if (minExp > 3) {
        notify('导入失败：超出 91P 上限', 'warn')
        return false
      }

      expeditionCount.value = minExp
      currentBuild.value = { allocations, gateSelections }
      activeGateModalNodeId.value = null
      notify(`已导入配装（${spent}P）`, 'ok')
      return true
    } catch {
      notify('分享码无效', 'warn')
      return false
    }
  }

  function applyRecognizedBuild(allocationsInput, gateSelectionsInput, sourceLabel = '截图') {
    const allocations = { ...(allocationsInput || {}) }
    const gateSelections = { ...(gateSelectionsInput || {}) }
    const check = validateBuildState(currentTree, allocations, gateSelections)
    if (!check.valid) {
      notify(`识别结果校验未通过：${check.reason}`, 'warn')
      return { ok: false, reason: check.reason }
    }

    const spent = Object.values(allocations).reduce((a, b) => a + b, 0)
    if (spent > meta.maxTotalSkillPoints) {
      notify(`识别点数异常（${spent}P 超出 91P 上限）`, 'warn')
      return { ok: false, reason: '超出 91P 上限' }
    }

    const neededExp = Math.max(
      0,
      Math.ceil(Math.max(0, spent - meta.baseSkillPoints) / meta.pointsPerExpedition),
    )
    if (expeditionCount.value < neededExp) {
      expeditionCount.value = Math.min(meta.maxExpeditions, neededExp)
    }

    currentBuild.value = { allocations, gateSelections }
    activeGateModalNodeId.value = null
    notify(`已从${sourceLabel}识别载入（${spent}P）`, 'ok')
    return { ok: true, spent }
  }

  const aggregatedBuildSummary = computed(() => {
    const groupsMap = new Map()
    const unlockedRecipes = []

    for (const cat of Object.values(STAT_CATEGORY_META)) {
      groupsMap.set(cat.id, { ...cat, entries: [] })
    }

    for (const node of currentTree.nodes) {
      const st = nodeStates.value[node.nodeId]
      if (!st || st.points <= 0 || !st.skill) continue
      const sk = st.skill
      const lvObj =
        sk.levels[Math.min(st.points, sk.levels.length) - 1] || sk.levels[0] || null

      const entry = {
        nodeId: node.nodeId,
        branch: node.branch,
        branchColor: branchMap[node.branch]?.color || '#5fffff',
        skillId: sk.id,
        name: sk.name,
        icon: sk.icon,
        points: st.points,
        maxPoints: st.maxPoints,
        statLabel: sk.statLabel,
        displayValue: lvObj?.display || sk.badge,
        note: lvObj?.note || '',
      }

      const catKey = groupsMap.has(sk.statCategory) ? sk.statCategory : 'survivability'
      groupsMap.get(catKey).entries.push(entry)

      if (Array.isArray(sk.unlockedItems) && sk.unlockedItems.length > 0) {
        for (const item of sk.unlockedItems) {
          unlockedRecipes.push({
            ...item,
            sourceSkillName: sk.name,
          })
        }
      }
    }

    const categories = Array.from(groupsMap.values())
      .filter((g) => g.entries.length > 0)
      .sort((a, b) => a.order - b.order)

    return {
      categories,
      unlockedRecipes,
      activeSkillCount: categories.reduce((acc, g) => acc + g.entries.length, 0),
    }
  })

  return {
    meta,
    branches,
    branchMap,
    presets,
    expeditionCount,
    showXRayBadges,
    sidebarCollapsed,
    focusedBranch,
    selectedNodeId,
    selectedCandidateId,
    selectSeq,
    activeGateModalNodeId,
    currentTree,
    currentBuild,
    savedBuilds,
    syncPrefs,
    toast,
    maxSkillPoints,
    branchPoints,
    earlyBranchPoints,
    nonCapstoneBranchPoints,
    totalSpentPoints,
    remainingPoints,
    resetCoinCost,
    nodeStates,
    selectedNodeState,
    activeGateModalState,
    aggregatedBuildSummary,
    notify,
    toggleSidebar,
    setExpeditionCount,
    selectNode,
    openGateModal,
    closeGateModal,
    allocateNode,
    deallocateNode,
    selectGateSkill,
    clearGateSlot,
    resetCurrentTree,
    applyPreset,
    saveCustomBuild,
    loadCustomBuild,
    deleteCustomBuild,
    encodeBuildToShareCode,
    exportShareCode,
    importShareCode,
    applyRecognizedBuild,
    flushPersistence,
  }
})
