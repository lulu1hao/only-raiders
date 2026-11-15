/**
 * buildRaiderAcquisitionData.mjs
 *
 * 从 questResourcesData.json、weaponsData.json 与 raiderLoadoutData.json
 * 离线提取所有护盾、强化、武器、武器配件与快速使用/背包道具的工坊制作 & 商人购买获取渠道，
 * 确定性生成 src/data/raiderAcquisitionData.json。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const questData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/questResourcesData.json'), 'utf8'),
)
const weaponsData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/weaponsData.json'), 'utf8'),
)
const loadoutData = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/data/raiderLoadoutData.json'), 'utf8'),
)

const STATION_META = {
  workbench: { id: 'workbench', zhName: '基础工作台' },
  gunsmith: { id: 'gunsmith', zhName: '武器工作台' },
  gear_bench: { id: 'gear_bench', zhName: '装备工作台' },
  medical_lab: { id: 'medical_lab', zhName: '医疗实验室' },
  explosives_station: { id: 'explosives_station', zhName: '爆炸物工作台' },
  utility_station: { id: 'utility_station', zhName: '工具工作台' },
  refiner: { id: 'refiner', zhName: '精加工机' },
}

const TRADER_META = {
  tian_wen: { id: 'tian_wen', zhName: '天玟', shopZh: '枪械商店' },
  lance: { id: 'lance', zhName: '兰斯', shopZh: '诊所' },
  apollo: { id: 'apollo', zhName: '阿波罗', shopZh: '手雷和小道具' },
  shani: { id: 'shani', zhName: '萨尼', shopZh: '安保区' },
}

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’'`]/g, "'")
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normZh(s) {
  return String(s || '')
    .replace(/[（）()“”"'·\s]/g, '')
    .toLowerCase()
    .trim()
}

const AMMO_OUTPUT_COUNT = {
  LightAmmo: 25,
  MediumAmmo: 20,
  HeavyAmmo: 10,
  ShotgunAmmo: 5,
  LauncherAmmo: 6,
  EnergyAmmo: 1,
}

// 1. 索引全量武器/道具/配件蓝图
const blueprintsByEn = new Map()
const blueprintsByZh = new Map()
for (const bp of questData.blueprints?.weaponItemBlueprints || []) {
  const rec = {
    blueprintId: bp.id,
    station: bp.station || '',
    rarity: bp.rarity || '',
    name: bp.name || '',
  }
  if (bp.itemEnName) blueprintsByEn.set(normKey(bp.itemEnName), rec)
  if (bp.itemName) blueprintsByZh.set(normZh(bp.itemName), rec)
}

function findBlueprintForItem(enName, zhName, weaponFallbackFlag = false) {
  const kEn = normKey(enName)
  const kEnNoTier = normKey(String(enName || '').replace(/\s+I$/i, ''))
  const hit =
    blueprintsByEn.get(kEn) ||
    blueprintsByEn.get(kEnNoTier) ||
    blueprintsByZh.get(normZh(zhName))
  if (hit) {
    return { blueprintRequired: true, blueprintId: hit.blueprintId }
  }
  return {
    blueprintRequired: Boolean(weaponFallbackFlag),
    blueprintId: null,
  }
}

// 2. 提取工作台站点解锁表 (跳过 scrappy 鸡仔与 research_station 研发/强化课题)
const PRIMARY_STATIONS = [
  'gunsmith',
  'gear_bench',
  'medical_lab',
  'explosives_station',
  'utility_station',
  'refiner',
]

const primaryUnlockByEn = new Map()
const primaryUnlockByZh = new Map()
const workbenchLv1ByEn = new Set()
const workbenchLv1ByZh = new Set()

for (const st of questData.workshop?.stations || []) {
  if (!STATION_META[st.id]) continue
  for (const lv of st.levels || []) {
    for (const u of lv.unlocks || []) {
      const enRaw = String(u.enName || '').trim()
      const zhRaw = String(u.name || '').trim()
      // 跳过纯升阶说明条目 (如 Anvil II-IV Upgrade) 与研究课题 (Research / Amplification)
      if (/II-IV Upgrade|Amplification/i.test(enRaw)) continue

      const enClean = enRaw.replace(/\s+I$/i, '').trim()
      const zhClean = zhRaw.replace(/\s*I$/i, '').trim()

      if (st.id === 'workbench') {
        if (enRaw) workbenchLv1ByEn.add(normKey(enRaw))
        if (enClean) workbenchLv1ByEn.add(normKey(enClean))
        if (zhRaw) workbenchLv1ByZh.add(normZh(zhRaw))
        if (zhClean) workbenchLv1ByZh.add(normZh(zhClean))
        continue
      }

      if (!PRIMARY_STATIONS.includes(st.id)) continue

      const entry = {
        stationId: st.id,
        stationZh: STATION_META[st.id].zhName,
        minLevel: Number(lv.level) || 1,
        enRaw,
        zhRaw,
      }

      const register = (map, k) => {
        if (!k) return
        const prev = map.get(k)
        if (!prev || entry.minLevel < prev.minLevel) {
          map.set(k, entry)
        }
      }
      register(primaryUnlockByEn, normKey(enRaw))
      register(primaryUnlockByEn, normKey(enClean))
      register(primaryUnlockByZh, normZh(zhRaw))
      register(primaryUnlockByZh, normZh(zhClean))
    }
  }
}

function resolveWorkshopRecipe(enName, zhName, opts = {}) {
  const kEn = normKey(enName)
  const kZh = normZh(zhName)
  const primary = primaryUnlockByEn.get(kEn) || primaryUnlockByZh.get(kZh) || null
  const inWorkbench = workbenchLv1ByEn.has(kEn) || workbenchLv1ByZh.has(kZh)

  let stationId = primary?.stationId || null
  let minLevel = primary?.minLevel || 1

  // 允许武器或配件字段自带的站点兜底
  if (!stationId && opts.fallbackStationStr) {
    const m = String(opts.fallbackStationStr).match(/(Gunsmith|Gear Bench|Medical Lab|Utility Station|Explosives Station|Refiner|Workbench)\s*(\d+)?/i)
    if (m) {
      const mapName = {
        gunsmith: 'gunsmith',
        'gear bench': 'gear_bench',
        'medical lab': 'medical_lab',
        'utility station': 'utility_station',
        'explosives station': 'explosives_station',
        refiner: 'refiner',
        workbench: 'workbench',
      }
      stationId = mapName[m[1].toLowerCase()] || null
      minLevel = m[2] ? Number(m[2]) : 1
    }
  }

  if (!stationId && inWorkbench) {
    stationId = 'workbench'
    minLevel = 1
  }

  if (!stationId) return null

  const bp = findBlueprintForItem(enName, zhName, opts.requiresBlueprint)
  return {
    stationId,
    stationZh: STATION_META[stationId]?.zhName || stationId,
    minLevel,
    blueprintRequired: bp.blueprintRequired,
    blueprintId: bp.blueprintId,
    outputCount: opts.outputCount || 1,
    fallbackWorkbenchLv1: Boolean(inWorkbench && stationId !== 'workbench'),
  }
}

// 3. 商人白名单映射（仅货币金币商店，不含游牧使团以物易物与塞莱斯特种子店）
const TRADER_CATALOG = {
  shields: {
    light: { traderId: 'lance', bundleCount: 1, limited: false },
    medium: { traderId: 'lance', bundleCount: 1, limited: true },
    heavy: { traderId: 'lance', bundleCount: 1, limited: true },
  },
  augments: {
    combat_mk1: { traderId: 'lance', bundleCount: 1, limited: false },
    looting_mk1: { traderId: 'lance', bundleCount: 1, limited: false },
    tactical_mk1: { traderId: 'lance', bundleCount: 1, limited: false },
    combat_mk2: { traderId: 'lance', bundleCount: 1, limited: true },
    looting_mk2: { traderId: 'lance', bundleCount: 1, limited: true },
    tactical_mk2: { traderId: 'lance', bundleCount: 1, limited: true },
    combat_mk3_aggressive: { traderId: 'lance', bundleCount: 1, limited: true },
    looting_mk3_cautious: { traderId: 'lance', bundleCount: 1, limited: true },
    tactical_mk3_healing: { traderId: 'lance', bundleCount: 1, limited: true },
  },
  weapons: {
    kettle: { traderId: 'tian_wen', bundleCount: 1, limited: false },
    rattler: { traderId: 'tian_wen', bundleCount: 1, limited: false },
    stitcher: { traderId: 'tian_wen', bundleCount: 1, limited: false },
    ferro: { traderId: 'tian_wen', bundleCount: 1, limited: false },
    hairpin: { traderId: 'tian_wen', bundleCount: 1, limited: false },
    arpeggio: { traderId: 'tian_wen', bundleCount: 1, limited: true },
    burletta: { traderId: 'tian_wen', bundleCount: 1, limited: true },
    il_toro: { traderId: 'tian_wen', bundleCount: 1, limited: true },
    renegade: { traderId: 'tian_wen', bundleCount: 1, limited: true },
    anvil: { traderId: 'tian_wen', bundleCount: 1, limited: true },
    hullcracker: { traderId: 'tian_wen', bundleCount: 1, limited: true },
  },
  weaponMods: {
    'angled-grip-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'compensator-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'extended-barrel-i': { traderId: 'tian_wen', bundleCount: 1, limited: true },
    'extended-light-mag-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'extended-medium-mag-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'extended-shotgun-mag-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'muzzle-brake-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'shotgun-choke-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'stable-stock-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
    'vertical-grip-i': { traderId: 'tian_wen', bundleCount: 1, limited: false },
  },
  items: {
    // 天玟 — 常规弹药
    LightAmmo: { traderId: 'tian_wen', bundleCount: 25, limited: false },
    MediumAmmo: { traderId: 'tian_wen', bundleCount: 20, limited: false },
    HeavyAmmo: { traderId: 'tian_wen', bundleCount: 10, limited: false },
    ShotgunAmmo: { traderId: 'tian_wen', bundleCount: 5, limited: false },
    LauncherAmmo: { traderId: 'tian_wen', bundleCount: 6, limited: true },

    // 兰斯 — 诊所医疗品
    HealingHoT_Small: { traderId: 'lance', bundleCount: 1, limited: false },
    HealingHoT_Improvised: { traderId: 'lance', bundleCount: 1, limited: false },
    HealingHoT_Medium: { traderId: 'lance', bundleCount: 1, limited: true },
    Consumable_ShieldOverTimePack: { traderId: 'lance', bundleCount: 1, limited: true },
    Armorpack: { traderId: 'lance', bundleCount: 1, limited: true },
    Defibrillator: { traderId: 'lance', bundleCount: 1, limited: false },
    AdrenalinShot: { traderId: 'lance', bundleCount: 1, limited: false },

    // 阿波罗 — 手雷、地雷与小道具
    Throwable_ImpactGrenade_Small: { traderId: 'apollo', bundleCount: 1, limited: false },
    HEGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    BasicStickyGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    SmokeGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    Throwable_SmokeGrenade_Small: { traderId: 'apollo', bundleCount: 1, limited: false },
    Throwable_StaminaDoTGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    DoTGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    ThrowableDecoy: { traderId: 'apollo', bundleCount: 1, limited: true },
    Throwable_TaggingGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    StickyRemoteGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    Throwable_ShrapnelGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    StunGrenade: { traderId: 'apollo', bundleCount: 1, limited: true },
    JoltMine: { traderId: 'apollo', bundleCount: 1, limited: true },
    Deployable_JumpMine_Explosive: { traderId: 'apollo', bundleCount: 1, limited: true },
    JumpMine_StaminaDoT: { traderId: 'apollo', bundleCount: 1, limited: true },
    JumpMine_Impulse: { traderId: 'apollo', bundleCount: 1, limited: true },
    TimedMine_Explosive: { traderId: 'apollo', bundleCount: 1, limited: true },
    DeployableBarricade: { traderId: 'apollo', bundleCount: 1, limited: false },
    DoorBlocker: { traderId: 'apollo', bundleCount: 1, limited: false },
    Zipline: { traderId: 'apollo', bundleCount: 1, limited: true },
    Deployable_SoundTrap: { traderId: 'apollo', bundleCount: 1, limited: false },
    Deployable_RemoteFlareTrap: { traderId: 'apollo', bundleCount: 1, limited: false },
    Throwable_Glowstick_Red: { traderId: 'apollo', bundleCount: 1, limited: false },
    Throwable_Glowstick_Yellow: { traderId: 'apollo', bundleCount: 1, limited: false },
    Throwable_Glowstick_Blue: { traderId: 'apollo', bundleCount: 1, limited: false },
    Throwable_Glowstick_Green: { traderId: 'apollo', bundleCount: 1, limited: false },

    // 萨尼 — 安保区
    KeyItem_RaiderHatchKey: { traderId: 'shani', bundleCount: 1, limited: true },
    CommonBinoculars: { traderId: 'shani', bundleCount: 1, limited: false },
    Firecrackers: { traderId: 'shani', bundleCount: 1, limited: false },
    Gadget_Instrument_Flute: { traderId: 'shani', bundleCount: 1, limited: false },
  },
}

function formatTraderEntry(spec) {
  if (!spec) return null
  const tm = TRADER_META[spec.traderId]
  return {
    traderId: spec.traderId,
    traderZh: tm?.zhName || spec.traderId,
    shopZh: tm?.shopZh || '',
    currency: 'coins',
    bundleCount: spec.bundleCount || 1,
    limited: Boolean(spec.limited),
  }
}

const out = {
  version: 1,
  stations: STATION_META,
  traders: TRADER_META,
  shields: {},
  augments: {},
  weapons: {},
  weaponMods: {},
  items: {},
}

for (const sh of loadoutData.shields || []) {
  out.shields[sh.id] = {
    workshop: resolveWorkshopRecipe(sh.name, sh.zhName),
    trader: formatTraderEntry(TRADER_CATALOG.shields[sh.id]),
  }
}

for (const aug of loadoutData.augments || []) {
  if (aug.id === 'none' || aug.id === 'free_loadout') continue
  out.augments[aug.id] = {
    workshop: resolveWorkshopRecipe(aug.name, aug.zhName),
    trader: formatTraderEntry(TRADER_CATALOG.augments[aug.id]),
  }
}

for (const wp of weaponsData.weapons || []) {
  out.weapons[wp.id] = {
    workshop: resolveWorkshopRecipe(wp.name, wp.zhName, {
      requiresBlueprint: wp.requiresBlueprint,
      fallbackStationStr: wp.zhCraftStation?.includes('武器工作台') ? wp.zhCraftStation.replace('武器工作台', 'Gunsmith').replace('Lv.', '') : '',
    }),
    trader: formatTraderEntry(TRADER_CATALOG.weapons[wp.id]),
  }
}

for (const mod of weaponsData.weaponMods || []) {
  out.weaponMods[mod.id] = {
    workshop: resolveWorkshopRecipe(mod.name, mod.zhName, {
      fallbackStationStr: mod.station || '',
    }),
    trader: formatTraderEntry(TRADER_CATALOG.weaponMods[mod.id]),
  }
}

for (const it of loadoutData.quickUseItems || []) {
  const workshop = resolveWorkshopRecipe(it.name, it.zhName, {
    outputCount: AMMO_OUTPUT_COUNT[it.id] || 1,
  })
  const trader = formatTraderEntry(TRADER_CATALOG.items[it.id])
  if (workshop || trader) {
    out.items[it.id] = { workshop, trader }
  }
}

const destPath = path.join(ROOT, 'src/data/raiderAcquisitionData.json')
fs.writeFileSync(destPath, JSON.stringify(out, null, 2) + '\n', 'utf8')

// 输出摘要日志以便核对
const stats = {
  shields: Object.keys(out.shields).length,
  augments: Object.keys(out.augments).length,
  weapons: Object.keys(out.weapons).length,
  weaponsWorkshop: Object.values(out.weapons).filter((x) => x.workshop).length,
  weaponsTrader: Object.values(out.weapons).filter((x) => x.trader).length,
  weaponMods: Object.keys(out.weaponMods).length,
  modsWorkshop: Object.values(out.weaponMods).filter((x) => x.workshop).length,
  modsTrader: Object.values(out.weaponMods).filter((x) => x.trader).length,
  itemsMapped: Object.keys(out.items).length,
  itemsWorkshop: Object.values(out.items).filter((x) => x.workshop).length,
  itemsTrader: Object.values(out.items).filter((x) => x.trader).length,
}
console.log('Generated src/data/raiderAcquisitionData.json:', stats)

// 打印所有未映射的非材料/非钥匙/非饰品道具用于核对
const unmappedQuickUse = (loadoutData.quickUseItems || [])
  .filter((it) => !['trinket', 'material', 'key'].includes(it.category) && !out.items[it.id])
  .map((it) => `${it.id} (${it.zhName} / ${it.name})`)
console.log('Raid-only / unmapped quickUse (non-material/key/trinket):', unmappedQuickUse)
