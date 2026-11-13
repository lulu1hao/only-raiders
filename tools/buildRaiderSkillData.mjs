/**
 * buildRaiderSkillData.mjs
 *
 * 从最新游戏 Pak 逆向产物（F:/arc-export/raider-skills & F:/arc-export/loc，构建号 CL1450810）
 * 构建奇袭者（Raider）现行正式版技能树拓扑、门控互斥规则与精简核心数值数据包：
 *   - 输出数据：src/data/raiderSkillsData.json
 *   - 输出图标：public/icons/skills/*.png
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const EXPORT_DIR = 'F:/arc-export'
const RAIDER_EXPORT_DIR = path.join(EXPORT_DIR, 'raider-skills')
const RAW_ICONS_DIR = path.join(RAIDER_EXPORT_DIR, 'icons_raw')
const CLEAN_EXPORT_ICONS_DIR = path.join(RAIDER_EXPORT_DIR, 'icons')
const PUBLIC_SKILL_ICONS_DIR = path.join(ROOT, 'public/icons/skills')
const PUBLIC_ITEMS_DIR = path.join(ROOT, 'public/items')
const OUT_JSON = path.join(ROOT, 'src/data/raiderSkillsData.json')

function readJsonClean(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  return JSON.parse(raw)
}

function parseVec2(str) {
  const nums = [...String(str || '').matchAll(/[-+]?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
  return { x: nums[0] || 0, y: nums[1] || 0 }
}

function round1(n) {
  return Math.round(n * 10) / 10
}

// 1. 同步全部官方技能 PNG 图标
function syncSkillIcons() {
  fs.mkdirSync(PUBLIC_SKILL_ICONS_DIR, { recursive: true })
  fs.mkdirSync(CLEAN_EXPORT_ICONS_DIR, { recursive: true })

  const foundPngs = new Map()
  function walk(dir) {
    if (!fs.existsSync(dir)) return
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) walk(full)
      else if (ent.name.toLowerCase().endsWith('.png')) {
        foundPngs.set(ent.name, full)
      }
    }
  }
  walk(RAW_ICONS_DIR)

  for (const [fileName, srcPath] of foundPngs.entries()) {
    fs.copyFileSync(srcPath, path.join(PUBLIC_SKILL_ICONS_DIR, fileName))
    fs.copyFileSync(srcPath, path.join(CLEAN_EXPORT_ICONS_DIR, fileName))
  }
  console.log(`[icons] 已同步 ${foundPngs.size} 个官方技能图标至 public/icons/skills/`)
  return foundPngs
}

const exportedPngMap = syncSkillIcons()
const existingItemIcons = new Set(
  fs.existsSync(PUBLIC_ITEMS_DIR) ? fs.readdirSync(PUBLIC_ITEMS_DIR) : [],
)

function resolveItemIcon(candidates) {
  for (const c of candidates) {
    if (existingItemIcons.has(c)) return `/items/${c}`
  }
  const lowerList = [...existingItemIcons]
  for (const c of candidates) {
    const stem = c.replace(/\.png$/i, '').toLowerCase()
    const hit = lowerList.find((f) => f.toLowerCase().includes(stem))
    if (hit) return `/items/${hit}`
  }
  return null
}

// 2. 加载中英文本地化与逆向包数据
const enLoc = readJsonClean(
  path.join(EXPORT_DIR, 'loc/PioneerGame_Content_Localization_Game_en_Game.json'),
)
const zhLoc = readJsonClean(
  path.join(EXPORT_DIR, 'loc/PioneerGame_Content_Localization_Game_zh-Hans_Game.json'),
)
const skillsEnriched = readJsonClean(path.join(RAIDER_EXPORT_DIR, 'skills_enriched.json'))
const mapScreenCdo = readJsonClean(path.join(RAIDER_EXPORT_DIR, 'map_screen_cdo.json'))

const enToZh = {}
for (const ns of Object.keys(enLoc)) {
  for (const [k, v] of Object.entries(enLoc[ns] || {})) {
    if (zhLoc[ns]?.[k]) enToZh[v] = zhLoc[ns][k]
  }
}

function tr(enStr, fallback = '') {
  return enToZh[enStr] || fallback || enStr
}

function iconPathFromAsset(assetStr) {
  if (!assetStr) return null
  const baseLower = (assetStr.split('/').pop().split('.')[0] + '.png').toLowerCase()
  for (const actualName of exportedPngMap.keys()) {
    if (actualName.toLowerCase() === baseLower) {
      return `/icons/skills/${actualName}`
    }
  }
  return null
}

// 3. 局内制造解锁物品清单（仅保留中文名与图标）
const CRAFT_RECIPES = {
  inRoundCrafting: [
    {
      name: tr('Bandage', '绷带'),
      icon: resolveItemIcon(['T_UI_Icon_HealingHoT_Small.png']),
    },
    {
      name: tr('Shield Recharger', '护盾充能器'),
      icon: resolveItemIcon(['T_UI_Icon_Consumable_ShieldOverTimePack.png']),
    },
    {
      name: tr('Adrenaline Shot', '肾上腺素针剂'),
      icon: resolveItemIcon(['T_UI_Icon_AdrenalinShot.png']),
    },
    {
      name: tr('Light Impact Grenade', '轻型冲击手雷'),
      icon: resolveItemIcon(['T_UI_Icon_Throwable_ImpactGrenade_Small.png']),
    },
    {
      name: tr("Li'l Smoke Grenade", '小型烟雾手雷'),
      icon: resolveItemIcon(['T_UI_Icon_Throwable_SmokeGrenade_Small.png']),
    },
    {
      name: tr('Flame Spray', '火焰喷雾'),
      icon: resolveItemIcon(['T_UI_Icon_SprayCan_Fire.png']),
    },
    {
      name: tr('Fruit Mix', '什锦水果'),
      icon: resolveItemIcon(['T_UI_Icon_Consumable_FruitMix.png']),
    },
    {
      name: tr('Crude Explosives', '粗制炸药'),
      icon: resolveItemIcon(['T_UI_Icon_Salvage_ExplosiveMixture.png']),
    },
    {
      name: tr('Agave Juice', '龙舌兰汁'),
      icon: resolveItemIcon(['T_UI_Icon_Consumable_AgaveJuice.png']),
    },
  ],
  travelingTinkerer: [
    {
      name: tr('Raider Hatch Key', '奇袭者暗门钥匙'),
      icon: resolveItemIcon(['T_UI_Icon_KeyItem_RaiderHatchKey.png']),
    },
    {
      name: tr('Herbal Bandage', '草药绷带'),
      icon: resolveItemIcon(['T_UI_Icon_HealingHoT_Improvised.png']),
    },
    {
      name: tr('Noisemaker', '发声器'),
      icon: resolveItemIcon(['T_UI_Icon_Deployable_SoundTrap.png']),
    },
    {
      name: tr('Blaze Grenade Trap', '烈焰手雷陷阱'),
      icon: resolveItemIcon(['T_UI_Icon_LaserTrap_DoTGrenade_A.png']),
    },
    {
      name: tr('Smoke Grenade Trap', '烟雾手雷陷阱'),
      icon: resolveItemIcon(['T_UI_Icon_LaserTrap_SmokeGrenade.png']),
    },
    {
      name: tr('Gas Grenade Trap', '毒气手雷陷阱'),
      icon: resolveItemIcon(['T_UI_Icon_LaserTrap_StaminaDoT.png']),
    },
    {
      name: tr('Lure Grenade Trap', '诱饵手雷陷阱'),
      icon: resolveItemIcon(['T_UI_Icon_LaserTrap_ThrowableDecoy.png']),
    },
  ],
  nomadicCrafting: [
    {
      name: tr('Light Ammo', '轻型弹药'),
      icon: resolveItemIcon(['T_UI_Icon_LightAmmo.png']),
    },
    {
      name: tr('Medium Ammo', '中型弹药'),
      icon: resolveItemIcon(['T_UI_Icon_MediumAmmo.png']),
    },
    {
      name: tr('Heavy Ammo', '重型弹药'),
      icon: resolveItemIcon(['T_UI_Icon_HeavyAmmo.png']),
    },
    {
      name: tr('Shotgun Ammo', '霰弹弹药'),
      icon: resolveItemIcon(['T_UI_Icon_ShotgunAmmo.png']),
    },
    {
      name: tr('Defibrillator', '复苏剂'),
      icon: resolveItemIcon(['T_UI_Icon_Defibrillator.png']),
    },
    {
      name: tr('Zipline', '滑索'),
      icon: resolveItemIcon(['T_UI_Icon_Zipline.png']),
    },
    {
      name: tr('Shrapnel Grenade', '碎片手雷'),
      icon: resolveItemIcon(['T_UI_Icon_Throwable_ShrapnelGrenade.png']),
    },
  ],
}

// 4. 现行版本 48 项技能极简核心数值配置（仅保留关键指标与数字，无多余修饰长句）
const SKILL_META = {
  // ==================== CONDITIONING 强化 ====================
  'used-to-the-weight': {
    enName: 'Used To The Weight',
    statLabel: '护盾移速惩罚减免',
    statCategory: 'encumbrance',
    badge: '-50% 盾牌减速',
    levels: [{ lv: 1, display: '-50%', note: '中盾 2.5% · 重盾 7.5%' }],
  },
  'three-deep-breaths': {
    enName: 'Three Deep Breaths',
    statLabel: '脱离力竭耐力阈值',
    statCategory: 'stamina',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${v} 点耐力`,
        note: `默认 20 · 提前 ${Math.round((1 - v / 20) * 100)}%`,
      })),
    badgeFn: (vals) => `${vals[vals.length - 1]}点脱力竭`,
  },
  'vigorous-vaulter': {
    enName: 'Vigorous Vaulter',
    statLabel: '力竭翻越速度',
    statCategory: 'traversal',
    badge: '免力竭减速',
    levels: [{ lv: 1, display: '100% 原速', note: '移除力竭慢翻惩罚' }],
  },
  'stubborn-mule': {
    enName: 'Stubborn Mule',
    statLabel: '超重回耐负重缓冲',
    statCategory: 'encumbrance',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${v} kg`,
        note: '',
      })),
    badgeFn: (vals) => `+${vals[vals.length - 1]}kg 缓冲`,
  },
  'vault-n-carry': {
    enName: "Vault 'n' Carry",
    statLabel: '搬运重物翻越',
    statCategory: 'traversal',
    badge: '搬运物可翻越',
    levels: [{ lv: 1, display: '机制解锁', note: '持电池/箱子可翻越' }],
  },
  'mules-gallop': {
    enName: "Mule's Gallop",
    statLabel: '超重强行冲刺',
    statCategory: 'encumbrance',
    badge: '52.5% 冲刺速',
    levels: [{ lv: 1, display: '52.5% 冲刺速', note: '解除超重禁跑' }],
  },
  'back-on-your-feet': {
    enName: 'Back On Your Feet',
    statLabel: '重伤脱战自动回血',
    statCategory: 'survivability',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `回至 ${v} HP`,
        note: '受击打断',
      })),
    badgeFn: (vals) => `回至 ${vals[0]} HP`,
  },
  'downed-but-determined': {
    enName: 'Downed But Determined',
    statLabel: '倒地流血速率',
    statCategory: 'survivability',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: `存活 ${round1(100 / v)}s`,
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% (133.3s)`,
  },
  'crawl-before-you-walk': {
    enName: 'Crawl Before You Walk',
    statLabel: '倒地爬行移速',
    statCategory: 'survivability',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `+${Math.round((vals[vals.length - 1] - 1) * 100)}% 爬行速`,
  },
  'broad-shoulders': {
    enName: 'Broad Shoulders',
    statLabel: '最大负重上限',
    statCategory: 'encumbrance',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${v} kg`,
        note: '',
      })),
    badgeFn: (vals) => `+${vals[vals.length - 1]} kg`,
  },
  'speedy-mule': {
    enName: 'Speedy Mule',
    statLabel: '严重超重移速',
    statCategory: 'encumbrance',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${round1((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `+${round1((vals[vals.length - 1] - 1) * 100)}% 超重移速`,
  },
  'loaded-arms': {
    enName: 'Loaded Arms',
    statLabel: '已装备武器重量',
    statCategory: 'encumbrance',
    badge: '-50% 枪重',
    levels: [{ lv: 1, display: '-50%', note: '仅主副槽已装备枪械' }],
  },
  'proficient-pryer': {
    enName: 'Proficient Pryer',
    statLabel: '破门撬锁耗时',
    statCategory: 'looting',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: `10s → ${round1(10 * v)}s`,
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 撬锁耗时`,
  },
  'security-breach': {
    enName: 'Security Breach',
    statLabel: '安防保险柜撬锁',
    statCategory: 'looting',
    badge: '可撬保险柜',
    levels: [{ lv: 1, display: '二级破拆解锁', note: '可撬安防保险柜' }],
  },
  'weapon-bash': {
    enName: 'Weapon Bash',
    statLabel: '持枪快速近战',
    statCategory: 'combat',
    badge: '持枪近战重击',
    levels: [{ lv: 1, display: '枪托重击', note: '免切近战武器硬直' }],
  },
  'bull-rush': {
    enName: 'Bull Rush',
    statLabel: '收枪冲刺撞击',
    statCategory: 'combat',
    badge: '≥3.25m/s 撞飞',
    warningText: tr('Only available while weapon is stowed', '仅收枪时可用'),
    levels: [{ lv: 1, display: '≥3.25 m/s 触发', note: '冲刺撞退敌人/小型ARC' }],
  },

  // ==================== MOBILITY 机动性 ====================
  'youthful-lungs': {
    enName: 'Youthful Lungs',
    statLabel: '最大耐力上限',
    statCategory: 'stamina',
    badge: '+25% 耐力上限',
    levels: [{ lv: 1, display: '+25%', note: '' }],
  },
  'sure-footed-scrambler': {
    enName: 'Sure-Footed Scrambler',
    statLabel: '陡坡冲刺攀爬时长',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${v} s`,
        note: '',
      })),
    badgeFn: (vals) => `+${vals[vals.length - 1]}s 陡坡攀爬`,
  },
  'nimble-climber': {
    enName: 'Nimble Climber',
    statLabel: '攀爬与翻越速度',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `+${Math.round((vals[vals.length - 1] - 1) * 100)}% 攀爬速`,
  },
  'ready-to-roll': {
    enName: 'Ready To Roll',
    statLabel: '坠落受身判定窗口',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `+${Math.round((vals[vals.length - 1] - 1) * 100)}% 受身窗口`,
  },
  'fight-or-flight': {
    enName: 'Fight Or Flight',
    statLabel: '受击瞬间回复耐力',
    statCategory: 'stamina',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${v} 点`,
        note: '含内置冷却',
      })),
    badgeFn: (vals) => `受击 +${vals[vals.length - 1]} 耐力`,
  },
  'vault-spring': {
    enName: 'Vault Spring',
    statLabel: '翻越末端弹跳',
    statCategory: 'traversal',
    badge: '翻越末端起跳',
    levels: [{ lv: 1, display: '二段弹跳', note: '翻越结束按跳跃触发' }],
  },
  'vaults-on-vaults-on-vaults': {
    enName: 'Vaults on Vaults on Vaults',
    statLabel: '翻越耐力消耗',
    statCategory: 'stamina',
    badge: '-100% 翻越耗耐',
    levels: [{ lv: 1, display: '-100% (0耗耐)', note: '' }],
  },
  'effortless-roll': {
    enName: 'Effortless Roll',
    statLabel: '翻滚耐力消耗',
    statCategory: 'stamina',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 翻滚耗耐`,
  },
  'slip-and-slide': {
    enName: 'Slip and Slide',
    statLabel: '滑铲地面摩擦阻力',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 摩擦`,
  },
  'right-back-at-it': {
    enName: 'Right Back At It',
    statLabel: '重着陆起身速度',
    statCategory: 'traversal',
    badge: '+25% 起身速',
    levels: [{ lv: 1, display: '+25% (1.25x)', note: '' }],
  },
  'off-the-wall': {
    enName: 'Off The Wall',
    statLabel: '蹬墙反弹跳跃初速',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `+${Math.round((vals[vals.length - 1] - 1) * 100)}% 蹬墙跳`,
  },
  'marathon-runner': {
    enName: 'Marathon Runner',
    statLabel: '移动与冲刺耐力消耗',
    statCategory: 'stamina',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: `续航 +${round1((1 / v - 1) * 100)}%`,
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 移动耗耐`,
  },
  'swift-start': {
    enName: 'Swift Start',
    statLabel: '起跑爆发加速时长',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${v} s`,
        note: '',
      })),
    badgeFn: (vals) => `+${vals[vals.length - 1]}s 起跑爆发`,
  },
  'sprinting-on-fumes': {
    enName: 'Sprinting On Fumes',
    statLabel: '濒空耐力无限冲刺',
    statCategory: 'stamina',
    badge: '<2.2 耐力锁底',
    levels: [{ lv: 1, display: '<2.2 耐力锁底', note: '36s停耐5s · 72s停耐14s' }],
  },
  'wall-run': {
    enName: 'Wall Run',
    statLabel: '垂直墙面向上奔跑',
    statCategory: 'traversal',
    badge: '≥4.0m/s 蹬墙跑',
    levels: [{ lv: 1, display: '≥4.0 m/s 触发', note: '冲刺上墙抓高处边缘' }],
  },
  'in-the-flow': {
    enName: 'In The Flow',
    statLabel: '连续跑酷心流满层加成',
    statCategory: 'traversal',
    badge: '-65%耗耐/+25%翻越',
    levels: [{ lv: 1, display: '-65% 耗耐', note: '+25% 翻越速度' }],
  },

  // ==================== SURVIVAL 生存 ====================
  'in-round-crafting': {
    enName: 'In-Round Crafting',
    statLabel: '局内基础现场制作',
    statCategory: 'crafting',
    badge: '解锁 9 种配方',
    levels: [{ lv: 1, display: '解锁 9 种配方', note: '' }],
    unlockedItems: CRAFT_RECIPES.inRoundCrafting,
  },
  'looters-instincts': {
    enName: "Looter's Instincts",
    statLabel: '容器搜索揭示耗时',
    statCategory: 'looting',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 搜索耗时`,
  },
  'silent-scavenger': {
    enName: 'Silent Scavenger',
    statLabel: '搜刮战利品噪音',
    statCategory: 'stealth',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 搜刮噪音`,
  },
  'sturdy-ankles': {
    enName: 'Sturdy Ankles',
    statLabel: '非致命高处摔落伤害',
    statCategory: 'survivability',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 摔落伤`,
  },
  'agile-croucher': {
    enName: 'Agile Croucher',
    statLabel: '蹲伏移动速度',
    statCategory: 'stealth',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `+${Math.round((vals[vals.length - 1] - 1) * 100)}% 蹲行速`,
  },
  'quick-roll': {
    enName: 'Quick Roll',
    statLabel: '战术快速短翻滚',
    statCategory: 'traversal',
    badge: '快速低耗翻滚',
    levels: [{ lv: 1, display: '快翻替换', note: '耗耐更低 · 收招更快' }],
  },
  'minesweeper': {
    enName: 'Minesweeper',
    statLabel: '地雷与绊雷拆除',
    statCategory: 'survivability',
    badge: '可拆地雷陷阱',
    levels: [{ lv: 1, display: '排雷回收', note: '近距离交互拆除爆炸物' }],
  },
  'stylish-landing': {
    enName: 'Stylish Landing',
    statLabel: '受身翻滚最大允许落差',
    statCategory: 'traversal',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `+${round1(v / 100)} m`,
        note: '',
      })),
    badgeFn: (vals) => `+${round1(vals[vals.length - 1] / 100)}m 受身落差`,
  },
  'turtle-crawl': {
    enName: 'Turtle Crawl',
    statLabel: '倒地状态受击减伤',
    statCategory: 'survivability',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `-${round1((1 - v) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `-${round1((1 - vals[vals.length - 1]) * 100)}% 倒地减伤`,
  },
  'traveling-tinkerer': {
    enName: 'Traveling Tinkerer',
    statLabel: '进阶工具与暗门钥匙制作',
    statCategory: 'crafting',
    badge: '新增 7 种配方',
    levels: [{ lv: 1, display: '新增 7 种配方', note: '含奇袭者暗门钥匙' }],
    unlockedItems: CRAFT_RECIPES.travelingTinkerer,
  },
  'looters-luck': {
    enName: "Looter's Luck",
    statLabel: '双格战利品同时揭示概率',
    statCategory: 'looting',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${round1(v * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${round1(vals[vals.length - 1] * 100)}% 双倍揭示`,
  },
  'gentle-pressure': {
    enName: 'Gentle Pressure',
    statLabel: '破门撬箱噪音强度',
    statCategory: 'stealth',
    formatLevels: (vals) =>
      vals.map((v, i) => ({
        lv: i + 1,
        display: `${Math.round((v - 1) * 100)}%`,
        note: '',
      })),
    badgeFn: (vals) => `${Math.round((vals[vals.length - 1] - 1) * 100)}% 撬锁噪音`,
  },
  'a-little-extra': {
    enName: 'A Little Extra',
    statLabel: '破拆物体额外产出',
    statCategory: 'looting',
    badge: '+1~2 材料',
    levels: [{ lv: 1, display: '+1~2 份材料', note: '撬门/箱直接掉落' }],
  },
  'road-warrior': {
    enName: 'Road Warrior',
    statLabel: '局内拆解返还与ARC掉落',
    statCategory: 'looting',
    badge: '100%拆解+ARC增产',
    levels: [{ lv: 1, display: '100% 满额拆解', note: 'ARC 弹药/电池增产' }],
  },
  'nomadic-crafting': {
    enName: 'Nomadic Crafting',
    statLabel: '高阶弹药与战术道具制作',
    statCategory: 'crafting',
    badge: '新增 7 种高阶配方',
    levels: [{ lv: 1, display: '新增 7 种配方', note: '全弹药 · 复苏剂 · 滑索' }],
    unlockedItems: CRAFT_RECIPES.nomadicCrafting,
  },
  'field-repair': {
    enName: 'Field Repair',
    statLabel: '局内装备应急修复上限',
    statCategory: 'crafting',
    badge: '修至 30% 耐久',
    levels: [{ lv: 1, display: '30% 最大耐久', note: '武器 · 护盾 · 道具' }],
  },
}

function buildSkillRecord(skillId, maxPointsOverride) {
  const meta = SKILL_META[skillId]
  if (!meta) throw new Error(`Missing SKILL_META for ${skillId}`)

  const exact = skillsEnriched.find(
    (s) => s.version === 2 && (s.enName || '').toLowerCase() === meta.enName.toLowerCase(),
  )
  const fallback = skillsEnriched.find(
    (s) => (s.enName || '').toLowerCase() === meta.enName.toLowerCase(),
  )
  const pak = exact || fallback
  if (!pak) throw new Error(`Missing Pak skill asset for ${skillId} (${meta.enName})`)

  const rawValues = pak.values || null
  const maxPoints = maxPointsOverride ?? (pak.maxLevel === 5 ? 5 : 1)

  let levels = []
  let badge = ''
  if (rawValues && meta.formatLevels) {
    levels = meta.formatLevels(rawValues)
    badge = meta.badgeFn ? meta.badgeFn(rawValues) : levels[levels.length - 1].display
  } else if (meta.levels) {
    levels = meta.levels
    badge = meta.badge || levels[levels.length - 1].display
  }

  const icon = iconPathFromAsset(pak.icon) || iconPathFromAsset(fallback?.icon)
  if (!icon) throw new Error(`Missing icon PNG for ${skillId} (${pak.icon})`)

  return {
    id: skillId,
    name: tr(pak.enName),
    icon,
    maxPoints,
    statLabel: meta.statLabel,
    statCategory: meta.statCategory,
    badge,
    warningText: meta.warningText || null,
    levels,
    unlockedItems: meta.unlockedItems || null,
  }
}

// 5. 解析 WBP_SkillTreeMapScreen.uasset 现行版几何模板与轨道
const CATEGORY_KEY_MAP = {
  'UI.CharacterSkill.Category.Conditioning': 'conditioning',
  'UI.CharacterSkill.Category.Mobility': 'mobility',
  'UI.CharacterSkill.Category.Survival': 'survival',
}

function extractBranchGeometry(templatesArray) {
  const out = {}
  for (const entry of templatesArray) {
    const branchId = CATEGORY_KEY_MAP[entry.k.TagName]
    const tpl = entry.v
    const rotDeg = Number(tpl.RotationAngle || 0)
    const rad = (-rotDeg * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const cell = parseVec2(tpl.GridCellSize)
    const offset = parseVec2(tpl.Offset)

    const gridToScreen = (gx, gy) => {
      const lx = gx * cell.x
      const ly = gy * cell.y
      return {
        x: round1(lx * cos - ly * sin + offset.x),
        y: round1(lx * sin + ly * cos + offset.y),
      }
    }

    const nodePositions = {}
    const rawConnections = []

    for (const n of tpl.NodeMap || []) {
      const nodeId = Number(n.k)
      const g = parseVec2(n.v.GridCoords)
      const sc = gridToScreen(g.x, g.y)
      nodePositions[nodeId] = {
        grid: g,
        x: sc.x,
        y: sc.y,
        rawChildren: n.v.ChildConnections || [],
      }
    }

    for (const [nodeIdStr, info] of Object.entries(nodePositions)) {
      const fromId = Number(nodeIdStr)
      for (const conn of info.rawChildren) {
        const toId = Number(conn.NodeID)
        const target = nodePositions[toId]
        if (!target) continue
        const pts = [{ x: info.x, y: info.y }]
        for (const j of conn.Joints || []) {
          const jOff = parseVec2(j.Offset)
          pts.push(gridToScreen(info.grid.x + jOff.x, info.grid.y + jOff.y))
        }
        pts.push({ x: target.x, y: target.y })
        rawConnections.push({
          id: `${fromId}-${toId}`,
          branch: branchId,
          fromNodeId: fromId,
          toNodeId: toId,
          points: pts,
        })
      }
    }

    const splinePts = (tpl.RootSpline || []).map((sp) => {
      const p = parseVec2(sp.Point)
      const d = parseVec2(sp.Direction)
      return {
        x: round1(p.x + offset.x),
        y: round1(Math.min(p.y + offset.y, 620)),
        dx: round1(d.x),
        dy: round1(d.y),
      }
    })

    out[branchId] = {
      nodePositions,
      connections: rawConnections,
      rootSpline: splinePts,
      rootSplineThickness: tpl.RootSplineThickness || 14,
    }
  }
  return out
}

// 6. 组装现行正式版技能树拓扑
function buildLiveTree() {
  const geom = extractBranchGeometry(mapScreenCdo.RevampedTreeTemplates)

  const NODE_PLAN = {
    conditioning: {
      singleNodes: [
        { nodeId: 1000, skillId: 'used-to-the-weight', maxPoints: 1, tier: 0, isMajor: true, parents: [] },
        { nodeId: 1011, skillId: 'three-deep-breaths', maxPoints: 5, tier: 1, isMajor: false, parents: [1000] },
        { nodeId: 1010, skillId: 'stubborn-mule', maxPoints: 5, tier: 1, isMajor: false, parents: [1000] },
        { nodeId: 1021, skillId: 'vigorous-vaulter', maxPoints: 1, tier: 2, isMajor: false, parents: [1011] },
        { nodeId: 1020, skillId: 'vault-n-carry', maxPoints: 1, tier: 2, isMajor: false, parents: [1010] },
        { nodeId: 1042, skillId: 'downed-but-determined', maxPoints: 5, tier: 4, isMajor: false, parents: [1030] },
        { nodeId: 1041, skillId: 'broad-shoulders', maxPoints: 5, tier: 4, isMajor: false, parents: [1030] },
        { nodeId: 1040, skillId: 'loaded-arms', maxPoints: 1, tier: 4, isMajor: false, parents: [1030] },
        { nodeId: 1052, skillId: 'crawl-before-you-walk', maxPoints: 5, tier: 5, isMajor: false, parents: [1042] },
        { nodeId: 1051, skillId: 'speedy-mule', maxPoints: 5, tier: 5, isMajor: false, parents: [1041] },
        { nodeId: 1050, skillId: 'proficient-pryer', maxPoints: 5, tier: 5, isMajor: false, parents: [1040] },
      ],
      gatedNodes: [
        {
          nodeId: 1030,
          slotKey: 'conditioning-choice',
          gateType: 'choice',
          tier: 3,
          groupId: 'conditioning-gate-10',
          maxSelectable: 1,
          slotIndex: 0,
          minBranchPoints: 10,
          earlyPoolOnly: true,
          parents: [1021, 1020],
          candidateIds: ['back-on-your-feet', 'mules-gallop'],
        },
        {
          nodeId: 1060,
          slotKey: 'conditioning-capstone-30',
          gateType: 'capstone',
          tier: 6,
          groupId: 'conditioning-gate-cap',
          maxSelectable: 2,
          slotIndex: 0,
          minBranchPoints: 30,
          earlyPoolOnly: false,
          parents: [1052, 1051, 1050],
          candidateIds: ['security-breach', 'weapon-bash', 'bull-rush'],
        },
        {
          nodeId: 1061,
          slotKey: 'conditioning-capstone-40',
          gateType: 'capstone',
          tier: 6,
          groupId: 'conditioning-gate-cap',
          maxSelectable: 2,
          slotIndex: 1,
          minBranchPoints: 40,
          earlyPoolOnly: false,
          parents: [1052, 1051, 1050],
          candidateIds: ['security-breach', 'weapon-bash', 'bull-rush'],
        },
      ],
    },
    mobility: {
      singleNodes: [
        { nodeId: 2000, skillId: 'youthful-lungs', maxPoints: 1, tier: 0, isMajor: true, parents: [] },
        { nodeId: 2010, skillId: 'sure-footed-scrambler', maxPoints: 5, tier: 1, isMajor: false, parents: [2000] },
        { nodeId: 2011, skillId: 'nimble-climber', maxPoints: 5, tier: 1, isMajor: false, parents: [2000] },
        { nodeId: 2020, skillId: 'ready-to-roll', maxPoints: 5, tier: 2, isMajor: false, parents: [2010] },
        { nodeId: 2021, skillId: 'fight-or-flight', maxPoints: 5, tier: 2, isMajor: false, parents: [2011] },
        { nodeId: 2040, skillId: 'effortless-roll', maxPoints: 5, tier: 4, isMajor: false, parents: [2030] },
        { nodeId: 2041, skillId: 'right-back-at-it', maxPoints: 1, tier: 4, isMajor: false, parents: [2030] },
        { nodeId: 2042, skillId: 'marathon-runner', maxPoints: 5, tier: 4, isMajor: false, parents: [2030] },
        { nodeId: 2050, skillId: 'slip-and-slide', maxPoints: 5, tier: 5, isMajor: false, parents: [2040] },
        { nodeId: 2051, skillId: 'off-the-wall', maxPoints: 5, tier: 5, isMajor: false, parents: [2041] },
        { nodeId: 2052, skillId: 'swift-start', maxPoints: 5, tier: 5, isMajor: false, parents: [2042] },
      ],
      gatedNodes: [
        {
          nodeId: 2030,
          slotKey: 'mobility-choice',
          gateType: 'choice',
          tier: 3,
          groupId: 'mobility-gate-10',
          maxSelectable: 1,
          slotIndex: 0,
          minBranchPoints: 10,
          earlyPoolOnly: true,
          parents: [2020, 2021],
          candidateIds: ['vault-spring', 'vaults-on-vaults-on-vaults'],
        },
        {
          nodeId: 2060,
          slotKey: 'mobility-capstone-30',
          gateType: 'capstone',
          tier: 6,
          groupId: 'mobility-gate-cap',
          maxSelectable: 2,
          slotIndex: 0,
          minBranchPoints: 30,
          earlyPoolOnly: false,
          parents: [2050, 2051, 2052],
          candidateIds: ['sprinting-on-fumes', 'wall-run', 'in-the-flow'],
        },
        {
          nodeId: 2061,
          slotKey: 'mobility-capstone-40',
          gateType: 'capstone',
          tier: 6,
          groupId: 'mobility-gate-cap',
          maxSelectable: 2,
          slotIndex: 1,
          minBranchPoints: 40,
          earlyPoolOnly: false,
          parents: [2050, 2051, 2052],
          candidateIds: ['sprinting-on-fumes', 'wall-run', 'in-the-flow'],
        },
      ],
    },
    survival: {
      singleNodes: [
        { nodeId: 3000, skillId: 'in-round-crafting', maxPoints: 1, tier: 0, isMajor: true, parents: [] },
        { nodeId: 3010, skillId: 'looters-instincts', maxPoints: 5, tier: 1, isMajor: false, parents: [3000] },
        { nodeId: 3011, skillId: 'sturdy-ankles', maxPoints: 5, tier: 1, isMajor: false, parents: [3000] },
        { nodeId: 3020, skillId: 'silent-scavenger', maxPoints: 5, tier: 2, isMajor: false, parents: [3010] },
        { nodeId: 3021, skillId: 'agile-croucher', maxPoints: 5, tier: 2, isMajor: false, parents: [3011] },
        { nodeId: 3042, skillId: 'stylish-landing', maxPoints: 5, tier: 4, isMajor: false, parents: [3030] },
        { nodeId: 3041, skillId: 'traveling-tinkerer', maxPoints: 1, tier: 4, isMajor: false, parents: [3030] },
        { nodeId: 3040, skillId: 'gentle-pressure', maxPoints: 5, tier: 4, isMajor: false, parents: [3030] },
        { nodeId: 3052, skillId: 'turtle-crawl', maxPoints: 5, tier: 5, isMajor: false, parents: [3042] },
        { nodeId: 3051, skillId: 'looters-luck', maxPoints: 5, tier: 5, isMajor: false, parents: [3041] },
        { nodeId: 3050, skillId: 'a-little-extra', maxPoints: 1, tier: 5, isMajor: false, parents: [3040] },
      ],
      gatedNodes: [
        {
          nodeId: 3030,
          slotKey: 'survival-choice',
          gateType: 'choice',
          tier: 3,
          groupId: 'survival-gate-10',
          maxSelectable: 1,
          slotIndex: 0,
          minBranchPoints: 10,
          earlyPoolOnly: true,
          parents: [3020, 3021],
          candidateIds: ['quick-roll', 'minesweeper'],
        },
        {
          nodeId: 3060,
          slotKey: 'survival-capstone-30',
          gateType: 'capstone',
          tier: 6,
          groupId: 'survival-gate-cap',
          maxSelectable: 2,
          slotIndex: 0,
          minBranchPoints: 30,
          earlyPoolOnly: false,
          parents: [3052, 3051, 3050],
          candidateIds: ['road-warrior', 'nomadic-crafting', 'field-repair'],
        },
        {
          nodeId: 3061,
          slotKey: 'survival-capstone-40',
          gateType: 'capstone',
          tier: 6,
          groupId: 'survival-gate-cap',
          maxSelectable: 2,
          slotIndex: 1,
          minBranchPoints: 40,
          earlyPoolOnly: false,
          parents: [3052, 3051, 3050],
          candidateIds: ['road-warrior', 'nomadic-crafting', 'field-repair'],
        },
      ],
    },
  }

  const skills = {}
  const nodes = []
  const connections = []
  const rootSplines = {}

  for (const [branchId, plan] of Object.entries(NODE_PLAN)) {
    const g = geom[branchId]
    connections.push(...g.connections)
    rootSplines[branchId] = {
      thickness: g.rootSplineThickness,
      points: g.rootSpline,
    }

    for (const sn of plan.singleNodes) {
      const pos = g.nodePositions[sn.nodeId]
      const rec = buildSkillRecord(sn.skillId, sn.maxPoints)
      skills[sn.skillId] = { ...rec, branch: branchId, nodeType: 'normal' }
      nodes.push({
        nodeId: sn.nodeId,
        slotKey: `${branchId}-${sn.nodeId}`,
        branch: branchId,
        kind: 'normal',
        shape: sn.isMajor ? 'large-circle' : 'circle',
        tier: sn.tier,
        x: pos.x,
        y: pos.y,
        skillId: sn.skillId,
        parentNodeIds: sn.parents,
        minBranchPoints: 0,
      })
    }

    for (const gn of plan.gatedNodes) {
      const pos = g.nodePositions[gn.nodeId]
      for (const cid of gn.candidateIds) {
        if (!skills[cid]) {
          const rec = buildSkillRecord(cid, 1)
          skills[cid] = { ...rec, branch: branchId, nodeType: gn.gateType, groupId: gn.groupId }
        }
      }
      nodes.push({
        nodeId: gn.nodeId,
        slotKey: gn.slotKey,
        branch: branchId,
        kind: gn.gateType,
        shape: 'diamond',
        tier: gn.tier,
        x: pos.x,
        y: pos.y,
        groupId: gn.groupId,
        maxSelectable: gn.maxSelectable,
        slotIndex: gn.slotIndex,
        earlyPoolOnly: gn.earlyPoolOnly,
        candidateIds: gn.candidateIds,
        parentNodeIds: gn.parents,
        minBranchPoints: gn.minBranchPoints,
      })
    }
  }

  return {
    nodes,
    skills,
    connections,
    rootSplines,
  }
}

const liveTree = buildLiveTree()

// 7. 推荐配装（仅保留关键分系点数与核心标签）
const PRESET_BUILDS = [
  {
    id: 'all-round-76',
    name: '全能双核心 (76P)',
    tag: '76P 通用',
    maxPoints: 76,
    highlights: ['强化 31P', '机动 31P', '生存 14P', '安防突破', '疲态冲刺', '快速翻滚'],
    allocations: {
      'used-to-the-weight': 1,
      'three-deep-breaths': 5,
      'stubborn-mule': 5,
      'vigorous-vaulter': 1,
      'back-on-your-feet': 1,
      'downed-but-determined': 5,
      'crawl-before-you-walk': 5,
      'broad-shoulders': 5,
      'loaded-arms': 1,
      'proficient-pryer': 1,
      'security-breach': 1,
      'youthful-lungs': 1,
      'nimble-climber': 5,
      'fight-or-flight': 5,
      'vaults-on-vaults-on-vaults': 1,
      'effortless-roll': 5,
      'right-back-at-it': 1,
      'marathon-runner': 5,
      'slip-and-slide': 2,
      'swift-start': 5,
      'sprinting-on-fumes': 1,
      'in-round-crafting': 1,
      'looters-instincts': 5,
      'silent-scavenger': 4,
      'quick-roll': 1,
      'stylish-landing': 1,
      'turtle-crawl': 2,
    },
    gateSelections: {
      'conditioning-choice': 'back-on-your-feet',
      'conditioning-capstone-30': 'security-breach',
      'mobility-choice': 'vaults-on-vaults-on-vaults',
      'mobility-capstone-30': 'sprinting-on-fumes',
      'survival-choice': 'quick-roll',
    },
  },
  {
    id: 'heavy-looter-76',
    name: '重装驮兽搜刮 (76P)',
    tag: '76P 摸金',
    maxPoints: 76,
    highlights: ['强化 31P', '机动 24P', '生存 21P', '安防突破', '驮兽疾奔', '暗门钥匙'],
    allocations: {
      'used-to-the-weight': 1,
      'three-deep-breaths': 5,
      'vigorous-vaulter': 1,
      'stubborn-mule': 4,
      'vault-n-carry': 1,
      'mules-gallop': 1,
      'loaded-arms': 1,
      'broad-shoulders': 5,
      'speedy-mule': 5,
      'proficient-pryer': 5,
      'downed-but-determined': 1,
      'security-breach': 1,
      'youthful-lungs': 1,
      'nimble-climber': 5,
      'fight-or-flight': 4,
      'vault-spring': 1,
      'marathon-runner': 5,
      'swift-start': 5,
      'effortless-roll': 3,
      'in-round-crafting': 1,
      'looters-instincts': 5,
      'silent-scavenger': 4,
      'quick-roll': 1,
      'traveling-tinkerer': 1,
      'looters-luck': 5,
      'gentle-pressure': 3,
      'a-little-extra': 1,
    },
    gateSelections: {
      'conditioning-choice': 'mules-gallop',
      'conditioning-capstone-30': 'security-breach',
      'mobility-choice': 'vault-spring',
      'survival-choice': 'quick-roll',
    },
  },
  {
    id: 'pvp-hunter-91',
    name: '满远征机动猎手 (91P)',
    tag: '91P 满配',
    maxPoints: 91,
    highlights: ['强化 42P', '机动 42P', '生存 7P', '双终极×2', '疲态冲刺', '行云流水'],
    allocations: {
      'used-to-the-weight': 1,
      'three-deep-breaths': 5,
      'stubborn-mule': 5,
      'vigorous-vaulter': 1,
      'vault-n-carry': 1,
      'back-on-your-feet': 1,
      'downed-but-determined': 5,
      'crawl-before-you-walk': 5,
      'broad-shoulders': 5,
      'speedy-mule': 5,
      'loaded-arms': 1,
      'proficient-pryer': 5,
      'security-breach': 1,
      'bull-rush': 1,
      'youthful-lungs': 1,
      'sure-footed-scrambler': 2,
      'nimble-climber': 5,
      'fight-or-flight': 5,
      'vaults-on-vaults-on-vaults': 1,
      'effortless-roll': 5,
      'slip-and-slide': 5,
      'right-back-at-it': 1,
      'off-the-wall': 5,
      'marathon-runner': 5,
      'swift-start': 5,
      'sprinting-on-fumes': 1,
      'in-the-flow': 1,
      'in-round-crafting': 1,
      'looters-instincts': 5,
      'silent-scavenger': 1,
    },
    gateSelections: {
      'conditioning-choice': 'back-on-your-feet',
      'conditioning-capstone-30': 'security-breach',
      'conditioning-capstone-40': 'bull-rush',
      'mobility-choice': 'vaults-on-vaults-on-vaults',
      'mobility-capstone-30': 'sprinting-on-fumes',
      'mobility-capstone-40': 'in-the-flow',
    },
  },
]

const payload = {
  meta: {
    baseSkillPoints: 76,
    pointsPerExpedition: 5,
    maxExpeditions: 3,
    maxTotalSkillPoints: 91,
    resetCoinCostPerPoint: 2000,
  },
  branches: [
    {
      id: 'conditioning',
      name: '强化',
      color: '#1fff76',
    },
    {
      id: 'mobility',
      name: '机动性',
      color: '#ffd205',
    },
    {
      id: 'survival',
      name: '生存',
      color: '#f60010',
    },
  ],
  tree: liveTree,
  presets: PRESET_BUILDS,
}

for (const s of Object.values(payload.tree.skills)) {
  const diskIcon = path.join(ROOT, 'public', s.icon)
  if (!fs.existsSync(diskIcon)) {
    throw new Error(`[validate] 技能 ${s.id} 图标不存在: ${diskIcon}`)
  }
  if (!s.levels || s.levels.length === 0) {
    throw new Error(`[validate] 技能 ${s.id} 缺少数值等级阶梯`)
  }
}

for (const preset of payload.presets) {
  const sum = Object.values(preset.allocations).reduce((a, b) => a + b, 0)
  if (sum !== preset.maxPoints) {
    throw new Error(`[validate] 预设 ${preset.id} 点数总和 ${sum} !== ${preset.maxPoints}`)
  }
}

fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + '\n', 'utf8')
console.log(
  `[done] 已生成精简版 ${OUT_JSON} (${(fs.statSync(OUT_JSON).size / 1024).toFixed(1)} KB, ${payload.tree.nodes.length} 槽位 / ${Object.keys(payload.tree.skills).length} 技能)`,
)
