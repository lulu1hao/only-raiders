/**
 * raiderAcquisitionCatalog.js
 *
 * 奇袭者自动配装补货渠道目录与策略路由（工坊制作 + 商人金币购买）
 * 支持按补货来源策略、弹药偏好及本地工坊等级/蓝图档案预筛，决定首末渠道与预览徽标。
 */

import acquisitionData from '../data/raiderAcquisitionData.json'
import { useBlueprintsStore } from '../stores/useBlueprintsStore'
import { useWorkshopStore } from '../stores/useWorkshopStore'

export const WORKSHOP_STATIONS_ORDER = [
  'workbench',
  'medical_lab',
  'gunsmith',
  'gear_bench',
  'utility_station',
  'explosives_station',
  'refiner',
]

export const TRADERS_ORDER = ['shani', 'tian_wen', 'lance', 'apollo']

export const DEFAULT_RAIDER_SYNC_OPTIONS = {
  // 仅自动配装快速使用栏位（默认关闭）
  quickUseOnly: false,
  // 按要求默认关闭武器等级匹配与武器配件同步，由用户在 UI 显式开启
  syncWeaponTier: false,
  syncWeaponMods: false,
  // 仓库缺失时是否启用工坊/商人自动补货
  autoRestockEnabled: false,
  // 'trader_first' | 'workshop_first' | 'trader_only' | 'workshop_only'
  restockSourcePolicy: 'trader_first',
  ammoPreferTrader: true,
  respectLocalProgression: false,
}

export const RESTOCK_POLICY_OPTIONS = [
  { value: 'trader_first', label: '优先商人购买 → 工坊制作兜底' },
  { value: 'workshop_first', label: '优先工坊制作 → 商人购买兜底' },
  { value: 'trader_only', label: '仅从商人购买' },
  { value: 'workshop_only', label: '仅从工坊制作' },
]

const AMMO_IDS = new Set([
  'LightAmmo',
  'MediumAmmo',
  'HeavyAmmo',
  'ShotgunAmmo',
  'LauncherAmmo',
  'EnergyAmmo',
])

const STATION_SHORT_ZH = {
  workbench: '工作台',
  gunsmith: '武器台',
  gear_bench: '装备台',
  medical_lab: '医疗室',
  explosives_station: '爆炸台',
  utility_station: '工具台',
  refiner: '精加工',
}

export function sanitizeRaiderSyncOptions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const validPolicies = new Set(RESTOCK_POLICY_OPTIONS.map((o) => o.value))
  return {
    quickUseOnly: src.quickUseOnly === true,
    syncWeaponTier: src.syncWeaponTier === true,
    syncWeaponMods: src.syncWeaponMods === true,
    autoRestockEnabled: src.autoRestockEnabled === true,
    restockSourcePolicy: validPolicies.has(src.restockSourcePolicy)
      ? src.restockSourcePolicy
      : DEFAULT_RAIDER_SYNC_OPTIONS.restockSourcePolicy,
    ammoPreferTrader:
      typeof src.ammoPreferTrader === 'boolean'
        ? src.ammoPreferTrader
        : DEFAULT_RAIDER_SYNC_OPTIONS.ammoPreferTrader,
    respectLocalProgression: src.respectLocalProgression === true,
  }
}

/**
 * 解析并计算经过范围开关与策略互斥规则裁剪后的生效选项（不修改原始持久化配置）
 */
export function resolveEffectiveSyncOptions(raw) {
  const base = sanitizeRaiderSyncOptions(raw)
  const quickUseOnly = base.quickUseOnly
  const policy = base.restockSourcePolicy
  const usesWorkshop = base.autoRestockEnabled && policy !== 'trader_only'

  let ammoPreferTrader
  if (quickUseOnly || policy === 'workshop_only') {
    ammoPreferTrader = false
  } else if (policy === 'trader_first' || policy === 'trader_only') {
    ammoPreferTrader = true
  } else {
    ammoPreferTrader = base.ammoPreferTrader
  }

  const respectLocalProgression =
    policy === 'trader_only' ? false : base.respectLocalProgression
  const syncWeaponTier = quickUseOnly ? false : base.syncWeaponTier
  const syncWeaponMods = quickUseOnly ? false : base.syncWeaponMods
  const allowWorkshopUpgrade = Boolean(!quickUseOnly && base.syncWeaponTier && usesWorkshop)

  return {
    ...base,
    quickUseOnly,
    syncWeaponTier,
    syncWeaponMods,
    ammoPreferTrader,
    respectLocalProgression,
    usesWorkshop,
    allowWorkshopUpgrade,
  }
}

/**
 * 推导战备同步选项在 UI 层的勾选展示、禁用态、提示文案与主操作按钮名称
 */
export function describeSyncOptionsUiState(raw) {
  const base = sanitizeRaiderSyncOptions(raw)
  const effective = resolveEffectiveSyncOptions(base)
  const policy = base.restockSourcePolicy

  let ammoPreferTitle =
    '优先工坊制作时，弹药例外优先在枪械商人「天纹」处成组购买，节省工作台材料'
  if (base.quickUseOnly) {
    ammoPreferTitle = '已开启「只自动配装快速使用」，快捷栏不包含弹药'
  } else if (policy === 'workshop_only') {
    ammoPreferTitle = '「仅从工坊制作」策略下不前往商人购买'
  } else if (policy === 'trader_only') {
    ammoPreferTitle = '「仅从商人购买」策略下所有可购物品均从商人采购'
  } else if (policy === 'trader_first') {
    ammoPreferTitle = '「优先商人购买」策略下已默认优先向商人采购'
  }

  return {
    effective,
    weaponOptsDisabled: base.quickUseOnly,
    weaponTierChecked: !base.quickUseOnly && base.syncWeaponTier,
    weaponModsChecked: !base.quickUseOnly && base.syncWeaponMods,
    weaponTierTitle: base.quickUseOnly
      ? '已开启「只自动配装快速使用」，跳过武器识别与等级校对'
      : '开启后将校对武器 I~IV 等阶，优先取仓库高阶武器或在工坊武器台自动升阶（默认关闭）',
    weaponModsTitle: base.quickUseOnly
      ? '已开启「只自动配装快速使用」，跳过武器与配件识别装配'
      : '开启后将核对并同步武器枪口/弹匣/枪托/握把等配件（默认关闭）',
    ammoPreferDisabled: base.quickUseOnly || policy !== 'workshop_first',
    ammoPreferChecked: effective.ammoPreferTrader,
    ammoPreferTitle,
    progressionDisabled: policy === 'trader_only',
    progressionChecked: effective.respectLocalProgression,
    progressionTitle:
      policy === 'trader_only'
        ? '「仅从商人购买」策略下不使用工坊配方与蓝图'
        : '结合本软件「工坊升级 / 蓝图追踪」档案，预筛尚未解锁的工作台配方与蓝图',
    getPrimaryActionLabel(compact = false) {
      if (base.quickUseOnly) {
        return base.autoRestockEnabled ? '补货并配装快捷栏' : '自动配装快速使用'
      }
      if (base.autoRestockEnabled) return '自动补货并配装'
      return compact ? '仓库辅助配装' : '仓库辅助自动配装'
    },
  }
}

/**
 * 读取本地工坊站点等级与已拥有蓝图进度上下文（兼容跨窗口与非组件环境）
 */
export function readLocalProgressionContext() {
  let stationLevels = null
  let ownedSet = null

  try {
    const ws = useWorkshopStore()
    if (ws?.stationLevels) stationLevels = ws.stationLevels
  } catch {
    /* ignore if Pinia is not active */
  }
  try {
    const bp = useBlueprintsStore()
    if (Array.isArray(bp?.ownedBlueprintIds)) ownedSet = new Set(bp.ownedBlueprintIds)
  } catch {
    /* ignore */
  }

  if ((!stationLevels || !ownedSet) && typeof window !== 'undefined' && window.localStorage) {
    if (!stationLevels) {
      try {
        const raw = window.localStorage.getItem('arc_workshop_store_v3')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.stationLevels && typeof parsed.stationLevels === 'object') {
            stationLevels = parsed.stationLevels
          }
        }
      } catch {
        /* ignore */
      }
    }
    if (!ownedSet) {
      try {
        const raw = window.localStorage.getItem('arc_blueprints_store_v3')
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed?.ownedBlueprintIds)) {
            ownedSet = new Set(parsed.ownedBlueprintIds)
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  return {
    getStationLevel(stationId) {
      if (!stationLevels) return stationId === 'research_station' ? 0 : 1
      const v = Number(stationLevels[stationId])
      return Number.isFinite(v) ? v : 1
    },
    hasBlueprint(blueprintId) {
      if (!blueprintId || !ownedSet) return true
      return ownedSet.has(blueprintId)
    },
  }
}

/**
 * 查询单个战备条目的工坊与商人获取渠道详情
 */
export function getItemAcquisitionInfo(kind, targetId, opts = {}) {
  if (!targetId) {
    return { restockable: false, workshop: null, trader: null, isAmmo: false }
  }

  // 增强型武器 (Ascended) 在工坊与常规商人处不可直接制造或金币购买
  if (kind === 'weapon' && opts?.amplified) {
    return {
      restockable: false,
      workshop: null,
      trader: null,
      isAmmo: false,
      nonRestockReason: '增强型无法自动补货',
    }
  }

  let rec = null
  if (kind === 'shield') rec = acquisitionData.shields?.[targetId]
  else if (kind === 'augment') rec = acquisitionData.augments?.[targetId]
  else if (kind === 'weapon') rec = acquisitionData.weapons?.[targetId]
  else if (kind === 'mod') rec = acquisitionData.weaponMods?.[targetId]
  else rec = acquisitionData.items?.[targetId]

  const workshop = rec?.workshop || null
  const trader = rec?.trader || null
  const isAmmo = AMMO_IDS.has(targetId)

  return {
    workshop,
    trader,
    isAmmo,
    restockable: Boolean(workshop || trader),
    nonRestockReason: workshop || trader ? '' : '仅战局搜刮/兑换',
  }
}

/**
 * 结合用户补货策略、弹药偏好与本地进度档案，计算最终补货渠道顺序与 UI 预览徽标
 */
export function resolveItemRestockChannels(
  kind,
  targetId,
  syncOptions = {},
  progressionCtx = null,
  opts = {},
) {
  const options = resolveEffectiveSyncOptions(syncOptions)
  const info = getItemAcquisitionInfo(kind, targetId, opts)
  if (!info.restockable) {
    return {
      canRestock: false,
      channels: [],
      info,
      badgeLabel: info.nonRestockReason || '仅搜刮',
      skipReason: info.nonRestockReason || '无法制造或购买',
    }
  }

  let traderAvail = Boolean(info.trader)
  let workshopAvail = Boolean(info.workshop)
  let workshopSkipReason = ''

  if (workshopAvail && options.respectLocalProgression && progressionCtx) {
    const ws = info.workshop
    const stLv = progressionCtx.getStationLevel(ws.stationId)
    const wbLv = progressionCtx.getStationLevel('workbench')
    const canViaWorkbench = Boolean(ws.fallbackWorkbenchLv1 && wbLv >= 1)

    if (stLv < ws.minLevel && !canViaWorkbench) {
      workshopAvail = false
      workshopSkipReason = `需${STATION_SHORT_ZH[ws.stationId] || ws.stationZh}Lv.${ws.minLevel}`
    } else if (ws.blueprintRequired && ws.blueprintId && !progressionCtx.hasBlueprint(ws.blueprintId)) {
      workshopAvail = false
      workshopSkipReason = '缺少蓝图'
    }
  }

  const policy = options.restockSourcePolicy
  const wantTrader = policy !== 'workshop_only' && traderAvail
  const wantWorkshop = policy !== 'trader_only' && workshopAvail

  const channels = []
  if (policy === 'trader_only') {
    if (wantTrader) channels.push('trader')
  } else if (policy === 'workshop_only') {
    if (wantWorkshop) channels.push('workshop')
  } else if (info.isAmmo && options.ammoPreferTrader && wantTrader) {
    channels.push('trader')
    if (wantWorkshop) channels.push('workshop')
  } else if (policy === 'workshop_first') {
    if (wantWorkshop) channels.push('workshop')
    if (wantTrader) channels.push('trader')
  } else {
    if (wantTrader) channels.push('trader')
    if (wantWorkshop) channels.push('workshop')
  }

  if (!channels.length) {
    let skipReason = '当前策略不可补'
    if (policy === 'trader_only' && !info.trader) skipReason = '商人无售(可改工坊)'
    else if (policy === 'workshop_only' && !info.workshop) skipReason = '工坊不可造'
    else if (workshopSkipReason) skipReason = workshopSkipReason
    return {
      canRestock: false,
      channels: [],
      info,
      badgeLabel: skipReason,
      skipReason,
    }
  }

  const primary = channels[0]
  const badgeLabel =
    primary === 'trader'
      ? `商人·${info.trader.traderZh}`
      : `工坊·${STATION_SHORT_ZH[info.workshop.stationId] || info.workshop.stationZh}`

  return {
    canRestock: true,
    channels,
    info,
    badgeLabel,
    skipReason: '',
  }
}
