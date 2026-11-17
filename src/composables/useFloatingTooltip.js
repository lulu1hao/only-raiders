import { computed, nextTick, reactive, ref } from 'vue'
import { useWeaponsStore } from '../stores/useWeaponsStore'
import {
  applyAmpToggle,
  assetUrl,
  computeWeaponStats,
  diffRows,
  getAmpIconPath,
  getAmpRestrictionState,
  getAscensionIconPath,
  getCompatibleModsForSlot,
  modColor,
  resolveWeaponVisualState,
  shortAmpName,
  slotLabels,
  slotPlaceholderImg,
  toEffects,
} from './useWeaponCalculator'

const menu = reactive({
  open: false,
  type: '',
  slotKey: '',
  compareIdx: null,
  x: 0,
  y: 0,
  minW: 0,
  maxH: 520,
})
const menuEl = ref(null)
let menuAnchor = null

const tip = reactive({
  show: false,
  kind: '',
  data: null,
  compareIdx: null,
  x: 0,
  y: 0,
})
const tipEl = ref(null)
let tipAnchor = null

export function useFloatingTooltip() {
  const store = useWeaponsStore()

  const menuCtx = computed(() => store.getCtx(menu.compareIdx))

  function placeMenu() {
    const el = menuEl.value
    if (!el || !menuAnchor) return
    const w = el.offsetWidth
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = menuAnchor.left
    const y = menuAnchor.bottom + 6
    if (x + w > vw - 8) x = Math.max(8, vw - 8 - w)
    menu.x = x
    menu.y = y
    menu.maxH = Math.max(180, vh - y - 10)
  }

  function hideTip() {
    tip.show = false
  }

  function closeMenu() {
    menu.open = false
    hideTip()
  }

  function toggleMenu(type, evt, slotKey = '', compareIdx = null) {
    if (
      menu.open &&
      menu.type === type &&
      menu.slotKey === slotKey &&
      menu.compareIdx === compareIdx
    ) {
      closeMenu()
      return
    }
    const ctx = store.getCtx(compareIdx)
    if (type === 'mod' && ctx.calc?.lockedSlots[slotKey]) return
    menuAnchor = evt.currentTarget.getBoundingClientRect()
    const initY = menuAnchor.bottom + 6
    Object.assign(menu, {
      open: true,
      type,
      slotKey,
      compareIdx,
      x: menuAnchor.left,
      y: initY,
      minW: menuAnchor.width,
      maxH: Math.max(180, window.innerHeight - initY - 10),
    })
    hideTip()
    nextTick(placeMenu)
  }

  function equipMod(slotKey, modId) {
    const ctx = store.getCtx(menu.compareIdx)
    if (ctx.isCompare) {
      store.setCompareSlotMod(ctx.slot, slotKey, modId)
    } else {
      store.setWorkbenchMod(slotKey, modId)
    }
    closeMenu()
  }

  function pickTier(tierNum) {
    const ctx = store.getCtx(menu.compareIdx)
    if (ctx.isCompare) {
      store.selectCompareSlotTier(ctx.slot, tierNum)
    } else {
      store.selectWorkbenchTier(tierNum)
    }
    closeMenu()
  }

  function toggleMenuAmp(amp) {
    const ctx = store.getCtx(menu.compareIdx)
    if (ctx.isCompare) {
      store.toggleCompareSlotAmp(ctx.slot, amp)
    } else {
      store.toggleWorkbenchAmp(amp)
    }
  }

  function placeTip() {
    const el = tipEl.value
    if (!el || !tipAnchor) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let x = tipAnchor.right + 10
    if (x + w > vw - 8) x = tipAnchor.left - 10 - w
    if (x < 8) x = Math.max(8, Math.min(vw - 8 - w, tipAnchor.left))
    let y = tipAnchor.top
    if (y + h > vh - 8) y = vh - 8 - h
    if (y < 8) y = 8
    tip.x = x
    tip.y = y
  }

  function showTip(kind, data, evt, compareIdx = null) {
    tipAnchor = evt.currentTarget.getBoundingClientRect()
    Object.assign(tip, {
      show: true,
      kind,
      data,
      compareIdx,
      x: tipAnchor.right + 10,
      y: tipAnchor.top,
    })
    nextTick(placeTip)
  }

  function showSlotTip(slotKey, evt, compareIdx = null) {
    const ctx = store.getCtx(compareIdx)
    if (ctx.calc?.lockedSlots[slotKey]) {
      showTip('slot-locked', { slotKey }, evt, compareIdx)
    } else if (store.equippedMod(slotKey, compareIdx)) {
      showTip('mod', { mod: store.equippedMod(slotKey, compareIdx), slotKey }, evt, compareIdx)
    } else {
      showTip('slot-empty', { slotKey }, evt, compareIdx)
    }
  }

  const tipView = computed(() => {
    if (!tip.show) return null
    const ctx = store.getCtx(tip.compareIdx)
    const w = ctx.weapon
    const c = ctx.calc
    if (!w || !c) return null
    const tierNum = ctx.tier
    const amps = ctx.ampIds
    const mods = ctx.mods

    if (tip.kind === 'mod') {
      const { mod, slotKey } = tip.data
      const isEquipped = mods[slotKey] === mod.id && !c.lockedSlots[slotKey]
      const without = { ...mods }
      delete without[slotKey]
      const from = isEquipped ? computeWeaponStats(w, tierNum, amps, without) : c
      const to = isEquipped
        ? c
        : computeWeaponStats(w, tierNum, amps, { ...mods, [slotKey]: mod.id })
      return {
        title: mod.zhName,
        sub: `${mod.name} · ${mod.zhSlot || slotLabels[slotKey]?.name || slotKey}`,
        img: assetUrl(mod.image),
        color: modColor(mod),
        badge: isEquipped ? '已装配' : '',
        effects: toEffects(mod.zhEffects),
        diffTitle: isEquipped ? '该配件对当前配装的贡献' : '装配后变化（相对当前配装）',
        diffs: diffRows(from, to),
        foot: [mod.zhStation, mod.zhMaterials && `材料：${mod.zhMaterials}`].filter(Boolean),
      }
    }

    if (tip.kind === 'slot-empty' || tip.kind === 'slot-locked') {
      const { slotKey } = tip.data
      const locked = tip.kind === 'slot-locked'
      return {
        title: slotLabels[slotKey]?.name || slotKey,
        sub: slotLabels[slotKey]?.rule || '',
        img: slotPlaceholderImg(slotKey),
        color: locked ? '#ff3026' : '#a4a5aa',
        badge: locked ? '已锁定' : '空槽位',
        desc: locked
          ? `因激活【${c.lockedSlots[slotKey]}】增强，该配件插槽被占用，无法装配。`
          : `点击格子打开配件列表，可装配 ${getCompatibleModsForSlot(slotKey).length} 种兼容配件。`,
        effects: [],
        foot: [],
      }
    }

    if (tip.kind === 'tier') {
      const t = tip.data || {}
      const maxTier = w.tiers?.[w.tiers.length - 1]?.tier || 1
      const clearsAmps = t.tier < maxTier && amps.length > 0
      const isCurrent = c.clampedTier === t.tier
      const to = computeWeaponStats(w, t.tier, clearsAmps ? [] : amps, mods)
      const priceStr = t.sellPrice ? `${t.sellPrice.toLocaleString()} 奇袭者币` : ''
      const buyStr =
        t.tier === 1 && w.traderBuyPrice
          ? `（商人售价 ${w.traderBuyPrice.toLocaleString()} 币）`
          : ''
      return {
        title: `TIER ${t.roman || t.tier}`,
        sub: t.label || '工坊强化等级',
        img: assetUrl(resolveWeaponVisualState(w, t.tier, clearsAmps ? [] : amps).hdImage),
        color: '#ffbc13',
        badge: isCurrent ? '当前等级' : '',
        effects: t.zhEffects?.length
          ? toEffects(t.zhEffects)
          : [
              {
                text: w.tiers.length > 1 ? '出厂标准面板，无额外加成' : '出厂即满级精密结构',
                tone: 'neu',
              },
            ],
        meta: [
          priceStr && { label: '武器造价 / 估值', val: `${priceStr}${buyStr}` },
          w.zhCraftStation && {
            label: '工坊与蓝图',
            val: `${w.zhCraftStation} · ${w.requiresBlueprint ? '需设计蓝图' : '默认解锁'}`,
          },
          t.zhMaterials && {
            label: t.tier === 1 ? '锻造所需材料' : '本级升级材料',
            val: t.zhMaterials,
          },
        ].filter(Boolean),
        warn: !isCurrent && clearsAmps ? '5 级增强要求满级，切换到该等级将停用全部增强。' : '',
        diffTitle: isCurrent ? '' : '切换后变化（相对当前配装）',
        diffs: isCurrent ? null : diffRows(c, to),
        foot: [`最大耐久 ${t.durability ?? c.baseDurability}`],
      }
    }

    if (tip.kind === 'amp') {
      const amp = tip.data
      const st = getAmpRestrictionState(w, amp, amps)
      const res = applyAmpToggle(w, tierNum, amps, mods, amp)
      const other = computeWeaponStats(w, res.tier, res.ampIds, res.mods)
      const rules = [
        ...st.reqLabels.map((x) => ({ cls: 'req', text: `前置：${x}` })),
        ...st.conflictLabels.map((x) => ({ cls: 'conf', text: `互斥：${x}` })),
        ...st.slotLockLabels.map((x) => ({ cls: 'lock', text: `禁用插槽：${x}` })),
      ]
      let warn = ''
      if (!st.isActive) {
        const notes = []
        if (st.activeConflicts.length)
          notes.push(`将自动停用「${st.activeConflicts.join(' / ')}」`)
        if (st.missingReqs.length) notes.push(`将自动启用前置「${st.missingReqs.join(' / ')}」`)
        const lostMods = Object.keys(mods).filter((k) => mods[k] && !res.mods[k])
        if (lostMods.length)
          notes.push(`将卸下 ${lostMods.map((k) => slotLabels[k]?.name || k).join(' / ')} 配件`)
        if (res.tier !== tierNum) notes.push('将自动升至满级')
        warn = notes.join('；')
      }
      return {
        title: amp.zhName || amp.name,
        sub: amp.name,
        img: assetUrl(getAmpIconPath(w.id, amp.id)),
        color: '#ffc600',
        badge: st.isActive ? '已激活' : st.activeConflicts.length ? '互斥' : '',
        desc: amp.zhDesc || amp.description,
        effects: toEffects(amp.zhEffects),
        meta: [
          (amp.zhResearch || amp.research) && {
            label: '研究任务',
            val: amp.zhResearch || amp.research,
          },
          amp.zhMaterials && { label: '研究道具', val: amp.zhMaterials },
          w.ampCoreModule && {
            label: '5级升阶核心',
            val: `1× ${w.ampCoreModule.split(' (')[0]}（工坊/研究站 Lv.4）`,
          },
        ].filter(Boolean),
        rules,
        warn,
        diffTitle: st.isActive ? '该增强对当前配装的贡献' : '激活后变化（相对当前配装）',
        diffs: st.isActive ? diffRows(other, c) : diffRows(c, other),
        foot: [],
      }
    }

    if (tip.kind === 'ampSummary') {
      const active = (w.amplifications || []).filter((a) => amps.includes(a.id))
      return {
        title: '已激活的 5 级增强',
        sub: `${active.length} 项 · 激活增强额外 +${w.rarity === 'Legendary' ? 100 : 70} 耐久`,
        img: assetUrl(getAscensionIconPath(w.id)),
        color: '#ffc600',
        groups: active.map((a) => ({
          name: `${shortAmpName(a)}（${a.zhMaterials}）`,
          effects: [
            ...toEffects(a.zhEffects),
            { text: `研究任务：${a.zhResearch || a.research}`, tone: 'neu' },
          ],
        })),
        effects: [],
        foot: [
          w.ampCoreModule && `5级升阶核心：1× ${w.ampCoreModule.split(' (')[0]}`,
          '点击打开列表可切换增强',
        ].filter(Boolean),
      }
    }
    return null
  })

  return {
    menu,
    menuEl,
    menuCtx,
    tip,
    tipEl,
    tipView,
    toggleMenu,
    closeMenu,
    equipMod,
    pickTier,
    toggleMenuAmp,
    showTip,
    hideTip,
    showSlotTip,
    getCompatibleModsForSlot,
  }
}
