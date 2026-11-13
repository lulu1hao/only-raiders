import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const PUBLIC_ITEMS_DIR = path.join(ROOT, 'public', 'items')
const OUT_FILE = path.join(ROOT, 'src', 'data', 'raiderLoadoutData.json')

const RECIPES_DUMP = 'F:/arc-export/recipes_dump.json'
const ZH_LOC = 'F:/arc-export/loc/PioneerGame_Content_Localization_Game_zh-Hans_Game.json'
const EN_LOC = 'F:/arc-export/loc/PioneerGame_Content_Localization_Game_en_Game.json'

const QUALITY_TO_RARITY = {
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))
}

const dump = readJson(RECIPES_DUMP)
const zhRaw = readJson(ZH_LOC)
const enRaw = readJson(EN_LOC)
const weaponsData = readJson(path.join(ROOT, 'src', 'data', 'weaponsData.json'))
const publicItemSet = new Set(fs.readdirSync(PUBLIC_ITEMS_DIR))

const enToZh = new Map()
for (const ns of Object.keys(enRaw)) {
  const enNs = enRaw[ns] || {}
  const zhNs = zhRaw[ns] || {}
  for (const k of Object.keys(enNs)) {
    if (zhNs[k] && !enToZh.has(enNs[k])) {
      enToZh.set(enNs[k], zhNs[k])
    }
  }
}

function resolveItemIcon(rawIconStr, fallback = '/items/T_UI_ItemCategory_Utility.png') {
  if (!rawIconStr) return fallback
  const base = rawIconStr.split('.').pop()?.trim()
  if (!base) return fallback
  const png = `${base}.png`
  if (publicItemSet.has(png)) return `/items/${png}`
  return fallback
}

// ============================================================================
// 1. Slot Empty Icons, Mod Silhouettes & Ammo HUD Icons (Official UMG Icons)
// ============================================================================
const slotIcons = {
  augment: '/items/T_UI_ItemCategory_Augmentation.png',
  shield: '/items/T_UI_Generic_Armour.png',
  shieldLight: '/items/T_UI_ItemCategory_Armor_Light.png',
  shieldMedium: '/items/T_UI_ItemCategory_Armor_Medium.png',
  shieldHeavy: '/items/T_UI_ItemCategory_Armor_Heavy.png',
  weapon: '/items/T_UI_ItemCategory_Weapon.png',
  quickUse: '/items/T_UI_ItemCategory_Utility.png',
  auxGrenade: '/items/T_UI_Utility_Grenade.png',
  auxHealing: '/items/T_UI_Utility_Regenerative.png',
  auxUtility: '/items/T_UI_Utility_Tool.png',
  auxTrinket: '/items/T_UI_ItemCategory_Trinket.png',
  safePocket: '/items/T_UI_Inventory_Safepocket.png',
  modSlots: {
    Muzzle: '/items/T_UI_Mods_Muzzle.png',
    'Shotgun-Muzzle': '/items/T_UI_Mods_Shotgun-Muzzle.png',
    Underbarrel: '/items/T_UI_Mods_Grip.png',
    'Light-Mag': '/items/T_UI_Mods_Mag-Light.png',
    'Medium-Mag': '/items/T_UI_Mods_Mag-Medium.png',
    'Heavy-Mag': '/items/T_UI_Mods_Mag-Medium.png',
    'Shotgun-Mag': '/items/T_UI_Mods_Mag-Shotgun.png',
    Stock: '/items/T_UI_Mods_Stock.png',
  },
  ammoHud: {
    'Light Ammo': '/items/T_UI_Ammo_Light.png',
    'Medium Ammo': '/items/T_UI_Ammo_Medium.png',
    'Heavy Ammo': '/items/T_UI_Ammo_Heavy.png',
    'Shotgun Ammo': '/items/T_UI_Ammo_Shotgun.png',
    'Energy Clip': '/items/T_UI_Ammo_Energy.png',
    'Launcher Ammo': '/items/T_UI_Ammo_Launcher.png',
    轻型弹药: '/items/T_UI_Ammo_Light.png',
    中型弹药: '/items/T_UI_Ammo_Medium.png',
    重型弹药: '/items/T_UI_Ammo_Heavy.png',
    霰弹枪弹药: '/items/T_UI_Ammo_Shotgun.png',
    能量弹夹: '/items/T_UI_Ammo_Energy.png',
    发射器弹药: '/items/T_UI_Ammo_Launcher.png',
  },
  categoryBadges: {
    medical: '/items/T_UI_Utility_Regenerative.png',
    throwable: '/items/T_UI_Utility_Grenade.png',
    deployable: '/items/T_UI_Utility_Mine.png',
    gadget: '/items/T_UI_ItemCategory_Gadget.png',
    key: '/items/T_UI_Utility_Key.png',
    trinket: '/items/T_UI_ItemCategory_Trinket.png',
    material: '/items/T_UI_Utility_Tool.png',
  },
}

// ============================================================================
// 2. Shields (Extracted from BP_Item_Armor_* & DA_UIMetaData_Armor_*)
// ============================================================================
const shields = [
  {
    id: 'light',
    key: 'Armor_LightBody',
    name: 'Light Shield',
    zhName: enToZh.get('Light Shield') || '轻型护盾',
    shortName: '轻盾',
    rarity: 'Uncommon',
    icon: '/items/T_UI_Icon_Armor_LightBody.png',
    categoryIcon: slotIcons.shieldLight,
    weight: 5,
    charge: 40,
    segments: 4,
    mitigationPct: 40,
    movePenaltyPct: 0,
    statTags: ['充能 40', '减伤 40%', '移速 0%'],
  },
  {
    id: 'medium',
    key: 'Armor_MediumBody',
    name: 'Medium Shield',
    zhName: enToZh.get('Medium Shield') || '中型护盾',
    shortName: '中盾',
    rarity: 'Rare',
    icon: '/items/T_UI_Icon_Armor_MediumBody.png',
    categoryIcon: slotIcons.shieldMedium,
    weight: 7,
    charge: 70,
    segments: 7,
    mitigationPct: 42.5,
    movePenaltyPct: 5,
    statTags: ['充能 70', '减伤 42.5%', '移速 -5%'],
  },
  {
    id: 'heavy',
    key: 'Armor_HeavyBody',
    name: 'Heavy Shield',
    zhName: enToZh.get('Heavy Shield') || '重型护盾',
    shortName: '重盾',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Armor_HeavyBody.png',
    categoryIcon: slotIcons.shieldHeavy,
    weight: 9,
    charge: 90,
    segments: 9,
    mitigationPct: 52.5,
    movePenaltyPct: 10,
    statTags: ['充能 90', '减伤 52.5%', '移速 -10%'],
  },
]

// ============================================================================
// 3. Augments (Extracted from DA_Item_Augment_* + DA_Inventory_LF_* + Skills)
// ============================================================================
const SHIELD_ALLOW_MAP = {
  light: ['light'],
  medium: ['light', 'medium'],
  heavy: ['light', 'medium', 'heavy'],
}
const SHIELD_LABEL_MAP = {
  light: '仅轻盾',
  medium: '轻/中盾',
  heavy: '全护盾',
}

const AUGMENT_DEFS = [
  {
    id: 'none',
    family: 'starter',
    familyLabel: '基础',
    mk: 0,
    name: 'No Augment',
    zhName: '无强化（裸装）',
    rarity: 'Common',
    icon: slotIcons.augment,
    weight: 0,
    maxWeight: 35,
    maxShieldTier: 'light',
    backpackSlots: 10,
    quickUseSlots: 4,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: null,
    passive: null,
  },
  {
    id: 'free_loadout',
    family: 'starter',
    familyLabel: '基础',
    mk: 0,
    name: 'Free Loadout Augment',
    zhName: enToZh.get('Free Loadout Augment') || '免费配装强化',
    rarity: 'Common',
    icon: '/items/T_UI_Icon_Augment_Looting_FreeLoadout.png',
    weight: 1,
    maxWeight: 35,
    maxShieldTier: 'light',
    backpackSlots: 14,
    quickUseSlots: 4,
    safePocketSlots: 0,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: null,
    passive: null,
  },
  // Combat Family
  {
    id: 'combat_mk1',
    family: 'combat',
    familyLabel: '战斗',
    mk: 1,
    name: 'Combat Mk. 1',
    zhName: enToZh.get('Combat Mk. 1') || '战斗Mk. 1',
    rarity: 'Uncommon',
    icon: '/items/T_UI_Icon_Augment_Combat_T1.png',
    weight: 2,
    maxWeight: 45,
    maxShieldTier: 'medium',
    backpackSlots: 16,
    quickUseSlots: 4,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: null,
    passive: null,
  },
  {
    id: 'combat_mk2',
    family: 'combat',
    familyLabel: '战斗',
    mk: 2,
    name: 'Combat Mk. 2',
    zhName: enToZh.get('Combat Mk. 2') || '战斗Mk. 2',
    rarity: 'Rare',
    icon: '/items/T_UI_Icon_Augment_Combat_T2.png',
    weight: 3,
    maxWeight: 55,
    maxShieldTier: 'heavy',
    backpackSlots: 18,
    quickUseSlots: 4,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'grenade',
      label: '手雷槽',
      count: 1,
      emptyIcon: slotIcons.auxGrenade,
      allowedCategories: ['throwable'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Health Regen') || '生命值恢复',
      icon: '/items/T_UI_Icon_Health.png',
      summary: '每5s回1HP (受击停30s)',
    },
  },
  {
    id: 'combat_mk3_aggressive',
    family: 'combat',
    familyLabel: '战斗',
    mk: 3,
    name: 'Combat Mk. 3 (Aggressive)',
    zhName: enToZh.get('Combat Mk. 3 (Aggressive)') || '战斗Mk. 3（进攻型）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Combat_T3_Aggressive.png',
    weight: 5,
    maxWeight: 65,
    maxShieldTier: 'heavy',
    backpackSlots: 18,
    quickUseSlots: 4,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'grenade',
      label: '手雷槽',
      count: 2,
      emptyIcon: slotIcons.auxGrenade,
      allowedCategories: ['throwable'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Health Regen++') || '生命值恢复++',
      icon: '/items/T_UI_Icon_HealthPlus.png',
      summary: '每5s回2HP (受击停30s)',
    },
  },
  {
    id: 'combat_mk3_flanking',
    family: 'combat',
    familyLabel: '战斗',
    mk: 3,
    name: 'Combat Mk. 3 (Flanking)',
    zhName: enToZh.get('Combat Mk. 3 (Flanking)') || '战斗Mk. 3（侧翼突击）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Combat_T3_Flanking.png',
    weight: 3,
    maxWeight: 60,
    maxShieldTier: 'medium',
    backpackSlots: 20,
    quickUseSlots: 5,
    safePocketSlots: 2,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'utility',
      label: '部署槽',
      count: 3,
      emptyIcon: slotIcons.auxUtility,
      allowedCategories: ['deployable'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Quickdraw') || '快速拔枪',
      icon: '/items/T_UI_Icon_Quickdraw.png',
      summary: '手枪/手炮切枪 +33%',
    },
  },
  // Tactical Family
  {
    id: 'tactical_mk1',
    family: 'tactical',
    familyLabel: '战术',
    mk: 1,
    name: 'Tactical Mk. 1',
    zhName: enToZh.get('Tactical Mk. 1') || '战术Mk. 1',
    rarity: 'Uncommon',
    icon: '/items/T_UI_Icon_Augment_Utility_T1_A.png',
    weight: 2,
    maxWeight: 40,
    maxShieldTier: 'medium',
    backpackSlots: 15,
    quickUseSlots: 5,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: null,
    passive: null,
  },
  {
    id: 'tactical_mk2',
    family: 'tactical',
    familyLabel: '战术',
    mk: 2,
    name: 'Tactical Mk. 2',
    zhName: enToZh.get('Tactical Mk. 2') || '战术Mk. 2',
    rarity: 'Rare',
    icon: '/items/T_UI_Icon_Augment_Utility_T2.png',
    weight: 2,
    maxWeight: 45,
    maxShieldTier: 'medium',
    backpackSlots: 17,
    quickUseSlots: 5,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'utility',
      label: '部署槽',
      count: 1,
      emptyIcon: slotIcons.auxUtility,
      allowedCategories: ['deployable'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Emergency Smoke') || '应急烟幕',
      icon: '/items/T_UI_Icon_Smoke.png',
      summary: '破盾自动释放小型烟幕',
    },
  },
  {
    id: 'tactical_mk3_defensive',
    family: 'tactical',
    familyLabel: '战术',
    mk: 3,
    name: 'Tactical Mk. 3 (Defensive)',
    zhName: enToZh.get('Tactical Mk. 3 (Defensive)') || '战术Mk. 3（防御型）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Utility_T3_Defensive.png',
    weight: 5,
    maxWeight: 60,
    maxShieldTier: 'heavy',
    backpackSlots: 20,
    quickUseSlots: 5,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: {
      id: 'IntegratedShieldRepair',
      zhName: enToZh.get('Integrated Shield Recharger') || '内置护盾充能器',
      enName: 'Integrated Shield Recharger',
      icon: '/items/T_UI_Icon_IntegratedShieldRepair.png',
      cooldownSec: 120,
      summary: '充盾50 · 5s · CD 120s',
    },
    passive: {
      zhName: enToZh.get('Running Repair') || '奔跑修复',
      icon: '/items/T_UI_Icon_MobileRepair.png',
      summary: '可奔跑中使用护盾充能器',
    },
  },
  {
    id: 'tactical_mk3_healing',
    family: 'tactical',
    familyLabel: '战术',
    mk: 3,
    name: 'Tactical Mk. 3 (Healing)',
    zhName: enToZh.get('Tactical Mk. 3 (Healing)') || '战术Mk. 3（治疗型）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Utility_T3_Healing.png',
    weight: 4,
    maxWeight: 55,
    maxShieldTier: 'medium',
    backpackSlots: 16,
    quickUseSlots: 4,
    safePocketSlots: 3,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'healing',
      label: '医疗槽',
      count: 3,
      emptyIcon: slotIcons.auxHealing,
      allowedCategories: ['medical'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Cloud of Renewal') || '回复之云',
      icon: '/items/T_UI_EoR_Revive_Aug.png',
      summary: '被扶起释放45HP治疗云 (CD 45s)',
    },
  },
  {
    id: 'tactical_mk3_smoke',
    family: 'tactical',
    familyLabel: '战术',
    mk: 3,
    name: 'Tactical Mk. 3 (Smoke)',
    zhName: enToZh.get('Tactical Mk. 3 (Smoke)') || '战术Mk. 3（烟雾）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Utility_T3_Smoke.png',
    weight: 4,
    maxWeight: 50,
    maxShieldTier: 'medium',
    backpackSlots: 19,
    quickUseSlots: 5,
    safePocketSlots: 2,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'utility',
      label: '部署槽',
      count: 2,
      emptyIcon: slotIcons.auxUtility,
      allowedCategories: ['deployable'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Emergency Smoke') || '应急烟幕',
      icon: '/items/T_UI_Icon_Smoke.png',
      summary: '破盾自动释放小型烟幕',
    },
  },
  {
    id: 'tactical_mk3_revival',
    family: 'tactical',
    familyLabel: '战术',
    mk: 3,
    name: 'Tactical Mk. 3 (Revival)',
    zhName: enToZh.get('Tactical Mk. 3 (Revival)') || '战术Mk. 3（复苏）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Raider_T4_Revival.png',
    weight: 3,
    maxWeight: 65,
    maxShieldTier: 'light',
    backpackSlots: 16,
    quickUseSlots: 5,
    safePocketSlots: 2,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: {
      id: 'IntegratedDefibrillator',
      zhName: enToZh.get('Integrated Defibrillator') || '内置复苏剂',
      enName: 'Integrated Defibrillator',
      icon: '/items/T_UI_Icon_IntegratedDefibrillator.png',
      cooldownSec: 240,
      summary: '扶起50HP · 1.5s · CD 240s',
    },
    passive: {
      zhName: enToZh.get('Health Regen') || '生命值恢复',
      icon: '/items/T_UI_Icon_Health.png',
      summary: '每5s回1HP (受击停30s)',
    },
  },
  // Looting Family
  {
    id: 'looting_mk1',
    family: 'looting',
    familyLabel: '搜刮',
    mk: 1,
    name: 'Looting Mk. 1',
    zhName: enToZh.get('Looting Mk. 1') || '搜刮Mk. 1',
    rarity: 'Uncommon',
    icon: '/items/T_UI_Icon_Augment_Looting_T1.png',
    weight: 1,
    maxWeight: 50,
    maxShieldTier: 'light',
    backpackSlots: 18,
    quickUseSlots: 4,
    safePocketSlots: 1,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: null,
    passive: null,
  },
  {
    id: 'looting_mk2',
    family: 'looting',
    familyLabel: '搜刮',
    mk: 2,
    name: 'Looting Mk. 2',
    zhName: enToZh.get('Looting Mk. 2') || '搜刮Mk. 2',
    rarity: 'Rare',
    icon: '/items/T_UI_Icon_Augment_Looting_T2.png',
    weight: 2,
    maxWeight: 60,
    maxShieldTier: 'light',
    backpackSlots: 22,
    quickUseSlots: 4,
    safePocketSlots: 2,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'trinket',
      label: '饰品槽',
      count: 3,
      emptyIcon: slotIcons.auxTrinket,
      allowedCategories: ['trinket'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Anti-Tick Field') || '抗跳蚤力场',
      icon: '/items/T_UI_Ping_Enemy_Tick.png',
      summary: '1s自动震落附着跳蚤',
    },
  },
  {
    id: 'looting_mk3_cautious',
    family: 'looting',
    familyLabel: '搜刮',
    mk: 3,
    name: 'Looting Mk. 3 (Cautious)',
    zhName: enToZh.get('Looting Mk. 3 (Cautious)') || '搜刮Mk. 3（谨慎型）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Looting_T3_Cautious.png',
    weight: 3,
    maxWeight: 70,
    maxShieldTier: 'light',
    backpackSlots: 24,
    quickUseSlots: 5,
    safePocketSlots: 2,
    unrestrictedSafePocket: false,
    auxSlots: null,
    integratedItem: {
      id: 'IntegratedBinoculars',
      zhName: enToZh.get('Integrated Binoculars') || '内置望远镜',
      enName: 'Integrated Binoculars',
      icon: '/items/T_UI_Icon_IntegratedBinoculars_01.png',
      cooldownSec: 0,
      summary: '自带变焦望远镜',
    },
    passive: {
      zhName: enToZh.get('Emergency Adrenaline') || '应急肾上腺素',
      icon: '/items/T_UI_Icon_ADDS.png',
      summary: '破盾自动注射弱效肾上腺素',
    },
  },
  {
    id: 'looting_mk3_survivor',
    family: 'looting',
    familyLabel: '搜刮',
    mk: 3,
    name: 'Looting Mk. 3 (Survivor)',
    zhName: enToZh.get('Looting Mk. 3 (Survivor)') || '搜刮Mk. 3（生存型）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Looting_T3_DBNO.png',
    weight: 4,
    maxWeight: 80,
    maxShieldTier: 'medium',
    backpackSlots: 20,
    quickUseSlots: 5,
    safePocketSlots: 3,
    unrestrictedSafePocket: false,
    auxSlots: {
      type: 'utility',
      label: '部署槽',
      count: 1,
      emptyIcon: slotIcons.auxUtility,
      allowedCategories: ['deployable'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Emergency Tourniquet') || '应急止血带',
      icon: '/items/T_UI_EoR_DBNO_Aug.png',
      summary: '倒地静止最高回至75%血',
    },
  },
  {
    id: 'looting_mk3_safekeeper',
    family: 'looting',
    familyLabel: '搜刮',
    mk: 3,
    name: 'Looting Mk. 3 (Safekeeper)',
    zhName: enToZh.get('Looting Mk. 3 (Safekeeper)') || '搜刮Mk. 3（守护者）',
    rarity: 'Epic',
    icon: '/items/T_UI_Icon_Augment_Raider_T4_Safekeeper.png',
    weight: 5,
    maxWeight: 65,
    maxShieldTier: 'heavy',
    backpackSlots: 18,
    quickUseSlots: 4,
    safePocketSlots: 1,
    unrestrictedSafePocket: true,
    auxSlots: {
      type: 'trinket',
      label: '饰品槽',
      count: 2,
      emptyIcon: slotIcons.auxTrinket,
      allowedCategories: ['trinket'],
    },
    integratedItem: null,
    passive: {
      zhName: enToZh.get('Unrestricted Safe Pocket') || '无限制安全口袋',
      icon: '/items/T_UI_Icon_Augment_SafeKeeper.png',
      summary: '安全口袋可放任意物品(含武器/护盾)',
    },
  },
]

const augments = AUGMENT_DEFS.map((a) => ({
  ...a,
  allowedShields: SHIELD_ALLOW_MAP[a.maxShieldTier],
  shieldLabel: SHIELD_LABEL_MAP[a.maxShieldTier],
}))

// ============================================================================
// 4. Quick Use Items & Trinkets (Parsed from recipes_dump.json)
// ============================================================================
const byFile = new Map()
for (const r of dump) {
  if (!byFile.has(r.file)) byFile.set(r.file, [])
  byFile.get(r.file).push(r)
}

function parseEffectTags(fxStr) {
  if (!fxStr) return { tags: [], totalHeal: 0, totalShield: 0, damage: 0 }
  const entries = []
  const re = /StaticTitle=([^,]*),\s*TextFormat=([^,]*),\s*ModifierValue=([0-9.]+)/g
  let m
  while ((m = re.exec(fxStr)) !== null) {
    entries.push({
      title: m[1].trim(),
      fmt: m[2].trim(),
      val: Number(m[3]),
    })
  }

  const byTitle = Object.fromEntries(entries.map((e) => [e.title, e]))
  const tags = []
  let totalHeal = 0
  let totalShield = 0
  let damage = 0

  if (byTitle['Heal Capacity']) {
    totalHeal = byTitle['Heal Capacity'].val
    const rate = byTitle['Healing']?.val
    tags.push(rate ? `治疗 ${totalHeal} (${rate}/s)` : `治疗 ${totalHeal}`)
  } else if (byTitle['Healing']) {
    const h = byTitle['Healing']
    const dur = byTitle['Duration']?.val
    if (h.fmt.includes('/s') && dur) {
      totalHeal = Math.round(h.val * dur)
      tags.push(`回血 ${totalHeal} (${dur}s)`)
    } else {
      totalHeal = h.val
      tags.push(`回血 ${h.val}`)
    }
  }

  if (byTitle['Recharge']) {
    const rc = byTitle['Recharge']
    const dur = byTitle['Duration']?.val
    if (rc.fmt.includes('/s') && dur) {
      totalShield = Math.round(rc.val * dur)
      tags.push(`充盾 ${totalShield} (${dur}s)`)
    } else {
      totalShield = rc.val
      tags.push(`充盾 ${rc.val}`)
    }
  }

  if (byTitle['Stamina Regeneration']) {
    const sr = byTitle['Stamina Regeneration']
    const dur = byTitle['Duration']?.val
    tags.push(dur ? `耐力 +${sr.val}/s (${dur}s)` : `耐力 +${sr.val}/s`)
  } else if (byTitle['Stamina']) {
    tags.push(`耐力 +${byTitle['Stamina'].val}`)
  }

  if (byTitle['Damage']) {
    const d = byTitle['Damage']
    if (d.fmt.includes('x12')) {
      damage = d.val * 12
      tags.push(`伤害 ${d.val}×12`)
    } else if (d.fmt.includes('x8')) {
      damage = d.val * 8
      tags.push(`伤害 ${d.val}×8`)
    } else if (d.fmt.includes('/s')) {
      const dur = byTitle['Duration']?.val
      damage = dur ? d.val * dur : d.val
      tags.push(dur ? `灼烧 ${d.val}/s (${dur}s)` : `伤害 ${d.val}/s`)
    } else {
      damage = d.val
      tags.push(`伤害 ${d.val}`)
    }
  }

  if (byTitle['Stamina Drain']) {
    tags.push(`耗耐 ${byTitle['Stamina Drain'].val}/s`)
  }
  if (byTitle['ARC Stun Duration']) {
    tags.push(`眩晕ARC ${byTitle['ARC Stun Duration'].val}s`)
  }
  if (byTitle['Health']) {
    tags.push(`耐久 ${byTitle['Health'].val}`)
  }
  if (byTitle['Use Time'] && tags.length < 3) {
    tags.push(`耗时 ${byTitle['Use Time'].val}s`)
  }
  if (byTitle['Range'] && tags.length < 2) {
    tags.push(`距离 ${byTitle['Range'].val}m`)
  }
  if (byTitle['Tether Distance'] && tags.length < 2) {
    tags.push(`距离 ${byTitle['Tether Distance'].val}m`)
  }
  if (byTitle['Homing Range'] && tags.length < 2) {
    tags.push(`索敌 ${byTitle['Homing Range'].val}m`)
  }
  if (byTitle['Radius'] && tags.length < 2) {
    tags.push(`范围 ${byTitle['Radius'].val}m`)
  }
  if (byTitle['Safe Fall Height'] && tags.length < 2) {
    tags.push(`减伤高 +${byTitle['Safe Fall Height'].val}m`)
  }
  if (byTitle['Illumination Radius'] && tags.length < 2) {
    tags.push(`照明 ${byTitle['Illumination Radius'].val}m`)
  }
  if (byTitle['Duration'] && tags.length === 0) {
    tags.push(`持续 ${byTitle['Duration'].val}s`)
  }

  return { tags: tags.slice(0, 2), totalHeal, totalShield, damage }
}

const SKIP_ITEM_IDS = new Set([
  'HealthCloud', // internal skill projectile
])

const CORE_PRIORITY_ORDER = [
  // Ammo
  'LightAmmo',
  'MediumAmmo',
  'HeavyAmmo',
  'ShotgunAmmo',
  'EnergyAmmo',
  'LauncherAmmo',
  // Medical & Shield
  'Consumable_ShieldOverTimePack',
  'Armorpack',
  'HealingHoT_Small',
  'HealingHoT_Improvised',
  'HealingHoT_Medium',
  'HealthPack_01',
  'HealthSpray',
  'Defibrillator',
  'AdrenalinShot',
  'Consumable_FruitMix',
  // Throwables
  'HEGrenade',
  'StickyRemoteGrenade',
  'BasicStickyGrenade',
  'ScatterMissileGrenade',
  'DoTGrenade',
  'SmokeGrenade',
  'StunGrenade',
  'HomingMissileGrenade',
  'Throwable_ShrapnelGrenade',
  'Throwable_ImpactGrenade_Small',
  'Throwable_SmokeGrenade_Small',
  'Throwable_StaminaDoTGrenade',
  'Throwable_TaggingGrenade',
  'ThrowableDecoy',
  'Throwable_TetherGrenade',
  'Throwable_Trailblazer',
  'CrashPad',
  // Deployables
  'TimedMine_Explosive',
  'Deployable_JumpMine_Explosive',
  'JoltMine',
  'DeployableBarricade',
  'Zipline',
  'DoorBlocker',
  'EmitterTrap_TeslaCoil',
  'JumpMine_Impulse',
  'JumpMine_StaminaDoT',
  'LaserTrap_DoTGrenade',
  'LaserTrap_SmokeGrenade',
  // Gadgets
  'SnapHook',
  'GrapplingHook',
  'ARCFriendifierGadgetV2',
  'TetherGun',
  'PoweredDescender',
  'CommonBinoculars',
  'SprayCan_Fire',
  // Raid Keys
  'KeyItem_RaiderHatchKey',
]
const priorityIndexMap = new Map(CORE_PRIORITY_ORDER.map((id, idx) => [id, idx]))

const AMMO_BADGE_MAP = {
  LightAmmo: '/items/T_UI_Ammo_Light.png',
  MediumAmmo: '/items/T_UI_Ammo_Medium.png',
  HeavyAmmo: '/items/T_UI_Ammo_Heavy.png',
  ShotgunAmmo: '/items/T_UI_Ammo_Shotgun.png',
  EnergyAmmo: '/items/T_UI_Ammo_Energy.png',
  LauncherAmmo: '/items/T_UI_Ammo_Launcher.png',
}

const CATEGORY_LABELS = {
  ammo: '弹药',
  medical: '医疗/护盾',
  throwable: '投掷手雷',
  deployable: '陷阱/部署',
  gadget: '战术工具',
  key: '钥匙/门卡',
  trinket: '饰品贵重',
  material: '制造材料',
}

const quickUseCategories = [
  { id: 'ALL', label: '全部' },
  { id: 'ammo', label: '弹药' },
  { id: 'medical', label: '医疗/护盾' },
  { id: 'throwable', label: '投掷手雷' },
  { id: 'deployable', label: '陷阱/部署' },
  { id: 'gadget', label: '战术工具' },
  { id: 'key', label: '钥匙/门卡' },
  { id: 'trinket', label: '饰品贵重' },
  { id: 'material', label: '制造材料' },
]

const quickUseItems = []
for (const r of dump) {
  if (!r.exportName.startsWith('DA_Item_')) continue
  if (r.props.DevelopmentAvailability !== 'EDevelopmentAvailability::UserFacing') continue
  if (r.props.bNonTransferable === 'True') continue

  const rawCat = (r.props.ItemCategory || '').replace('EItemCategory::', '')
  const tagsStr = r.props.InventoryItemTypeTags || ''
  const isTrinket = tagsStr.includes('Inventory.ItemType.Misc.Trinket')
  const isAmmo = rawCat === 'RiflePayload'
  const isQuickCat = ['Consumable', 'Gadget', 'Throwable', 'Deployable'].includes(rawCat)
  const isMisc = rawCat === 'Misc'
  if (!isQuickCat && !isAmmo && !isMisc) continue

  const id = r.exportName.replace('DA_Item_', '')
  if (SKIP_ITEM_IDS.has(id)) continue

  const isDuck = id.includes('RubberDuck')

  const dir = r.file.split('/').slice(0, -1).join('/')
  let ui = null
  for (const [f, list] of byFile) {
    if (f.startsWith(`${dir}/`) && f.includes('DA_UIMetaData_')) {
      for (const exp of list) {
        if (exp.props.ItemName) ui = exp.props
      }
    }
  }
  if (!ui || ui.ItemName === 'Deprecated Data') continue

  const iconPath = resolveItemIcon(ui.Icon, '')
  if (!iconPath) continue

  const enName = ui.ItemName
  const zhName = enToZh.get(enName) || enName
  const qNum = Number(ui.QualityLevel || 1)
  const rarity = QUALITY_TO_RARITY[qNum] || 'Common'
  const weight = Number(r.props.Weight || 0)
  const maxStack = Math.max(1, Number(r.props.MaxStackCount || 1))
  const isImprovised = tagsStr.includes('Inventory.ItemType.Improvised')
  const isKey =
    r.file.includes('/Keys/') ||
    tagsStr.includes('Inventory.ItemType.Misc.KeyCode') ||
    enName.includes(' Key') ||
    id.includes('HatchKey')

  let category = 'material'
  if (isAmmo) category = 'ammo'
  else if (rawCat === 'Consumable') category = 'medical'
  else if (rawCat === 'Throwable') category = 'throwable'
  else if (rawCat === 'Deployable') category = 'deployable'
  else if (rawCat === 'Gadget') category = 'gadget'
  else if (isKey) category = 'key'
  else if (isTrinket || isDuck) category = 'trinket'
  else category = 'material'

  const badgeIcon =
    category === 'ammo'
      ? AMMO_BADGE_MAP[id] || '/items/T_UI_Ammo_Medium.png'
      : slotIcons.categoryBadges[category] || '/items/T_UI_ItemCategory_Utility.png'

  const parsedFx = parseEffectTags(ui.ItemEffectData || '')
  const statTags = [...parsedFx.tags]
  if (!statTags.length) {
    statTags.push(CATEGORY_LABELS[category] || '战备物资')
  }

  quickUseItems.push({
    id,
    name: enName,
    zhName,
    category,
    categoryLabel: CATEGORY_LABELS[category] || '道具',
    badgeIcon,
    isTrinket: category === 'trinket',
    isImprovised,
    rarity,
    qualityLevel: qNum,
    icon: iconPath,
    weight,
    maxStack,
    statTags,
    healAmount: parsedFx.totalHeal,
    shieldAmount: parsedFx.totalShield,
    damageAmount: parsedFx.damage,
  })
}

const CAT_ORDER = {
  ammo: 0,
  medical: 1,
  throwable: 2,
  deployable: 3,
  gadget: 4,
  key: 5,
  trinket: 6,
  material: 7,
}

quickUseItems.sort((a, b) => {
  const pa = priorityIndexMap.has(a.id) ? priorityIndexMap.get(a.id) : 999
  const pb = priorityIndexMap.has(b.id) ? priorityIndexMap.get(b.id) : 999
  if (pa !== pb) return pa - pb
  const ca = CAT_ORDER[a.category] ?? 99
  const cb = CAT_ORDER[b.category] ?? 99
  if (ca !== cb) return ca - cb
  if (a.isImprovised !== b.isImprovised) return a.isImprovised ? 1 : -1
  if (b.qualityLevel !== a.qualityLevel) return b.qualityLevel - a.qualityLevel
  return a.zhName.localeCompare(b.zhName, 'zh-Hans-CN')
})

// ============================================================================
// 5. Weapon Mod Weights (Mapped to weaponsData.weaponMods IDs)
// ============================================================================
const modWeights = {}
for (const mod of weaponsData.weaponMods || []) {
  const gMatch = /\s(I{1,3})$/.exec(mod.name || '')
  if (gMatch) {
    const grade = gMatch[1].length
    modWeights[mod.id] = grade * 0.25
  } else {
    modWeights[mod.id] = 0.5
  }
}

// ============================================================================
// 6. Exact 1920x1080 UMG Loadout Screen Coordinates (from WBP_FrontEnd_Template + WBP_NewInventoryLoadout)
// ============================================================================
const W = 1920
const H = 1080
function normRect(x, y, w, h) {
  return {
    x: Number((x / W).toFixed(5)),
    y: Number((y / H).toFixed(5)),
    w: Number((w / W).toFixed(5)),
    h: Number((h / H).toFixed(5)),
    cx: Number(((x + w / 2) / W).toFixed(5)),
    cy: Number(((y + h / 2) / H).toFixed(5)),
  }
}

const umgLayout1080p = {
  referenceWidth: W,
  referenceHeight: H,
  stashPanel: normRect(48, 112, 568, 856),
  loadoutPanel: normRect(636, 112, 1236, 856),
  slots: {
    augment: normRect(692, 272, 144, 96),
    shield: normRect(852, 272, 144, 96),
    weapon1: normRect(692, 392, 304, 200),
    weapon2: normRect(692, 608, 304, 200),
    backpack: Array.from({ length: 24 }, (_, idx) => {
      const col = idx % 4
      const row = Math.floor(idx / 4)
      return normRect(1048 + col * 104, 272 + row * 104, 96, 96)
    }),
    quickUse: [
      normRect(1504, 272, 96, 96),
      normRect(1608, 272, 96, 96),
      normRect(1712, 272, 96, 96),
      normRect(1504, 376, 96, 96),
      normRect(1608, 376, 96, 96),
      normRect(1712, 376, 96, 96),
    ],
    aux: [
      normRect(1504, 544, 96, 96),
      normRect(1608, 544, 96, 96),
      normRect(1712, 544, 96, 96),
    ],
    safePocketNoAux: [
      normRect(1504, 544, 96, 96),
      normRect(1608, 544, 96, 96),
      normRect(1712, 544, 96, 96),
    ],
    safePocketWithAux: [
      normRect(1504, 712, 96, 96),
      normRect(1608, 712, 96, 96),
      normRect(1712, 712, 96, 96),
    ],
  },
}

const output = {
  version: 1,
  slotIcons,
  shields,
  augments,
  quickUseCategories,
  quickUseItems,
  modWeights,
  umgLayout1080p,
}

fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8')
console.log(
  `Generated ${OUT_FILE}: ${augments.length} augments, ${shields.length} shields, ${quickUseItems.length} quickUse/trinket items`,
)
