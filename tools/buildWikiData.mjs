import fs from 'node:fs'
import { buildQuestMapTargets } from './questMapTargetsBuilder.mjs'
import path from 'node:path'

const stepDir = 'C:/Users/翟毅/.gemini/antigravity/brain/aa2c6358-05f4-4981-9a49-1632dd88190d/.system_generated/steps'
const rawWeapons = fs.readFileSync(path.join(stepDir, '1246/output.txt'), 'utf8')
const rawAmp = fs.readFileSync(path.join(stepDir, '1240/output.txt'), 'utf8')
const rawHtml = fs.readFileSync(path.join(stepDir, '1248/output.txt'), 'utf8')

// Chinese names & tactical descriptions for all 26 ARC Raiders weapons
const WEAPON_ZH = {
  Kettle: {
    zhName: '水壶 (Kettle)',
    zhClass: '突击步枪',
    zhAmmo: '轻型弹药',
    zhMode: '半自动单发',
    desc: '高精准度半自动轻型步枪，免费配装常客。升级大幅提升弹速与换弹速度；5级增幅可解锁【爆裂弹】（对ARC护甲+400%伤害）、【破盾弹】（对护盾+100%伤害）或【全自动改造】。'
  },
  Rattler: {
    zhName: '响尾蛇 (Rattler)',
    zhClass: '突击步枪',
    zhAmmo: '中型弹药',
    zhMode: '全自动连发',
    desc: '高性价比全自动中型步枪，默认每次装填2发子弹。升级从12发扩充至24发弹匣；5级增幅可改装【+40发超大弹鼓】、【单次装填+2发】与【铝热燃烧弹】。'
  },
  Arpeggio: {
    zhName: '三连奏 (Arpeggio)',
    zhClass: '突击步枪',
    zhAmmo: '中型弹药',
    zhMode: '三连发点射',
    desc: '精准三连发点射步枪，中远距离压制力极强。升级至 IV 级可获得惊人的 +60% 射速提升与 -50% 换弹时间缩减，爆发秒伤跃升明显。'
  },
  Tempest: {
    zhName: '风暴 (Tempest)',
    zhClass: '突击步枪',
    zhAmmo: '中型弹药',
    zhMode: '全自动连发',
    desc: '史诗级全自动主力步枪，兼顾高射速与优秀射程。升级至 IV 级可减少 50% 水平后坐力与 40% 换弹时间，中距离控枪极其稳定。'
  },
  Bettina: {
    zhName: '贝蒂娜 (Bettina)',
    zhClass: '突击步枪',
    zhAmmo: '重型弹药',
    zhMode: '全自动连发',
    desc: '使用重型弹药的重型突击步枪，具备 2.0x 强力破甲倍率。升级提升 15% 射速；5级增幅支持【+15发扩容】或【半自动高伤 + 爆裂弹】双流派。'
  },
  Ferro: {
    zhName: '生铁 (Ferro)',
    zhClass: '战斗步枪',
    zhAmmo: '重型弹药',
    zhMode: '折管单发',
    desc: '开荒神器级重型单发步枪，单发伤害高达 40（爆头 2.5x = 100），1.5x 破甲。升级至 IV 级可缩短 39% 折管换弹时间，高频远程点名。'
  },
  Stiletto: {
    zhName: '“细剑” (Stiletto)',
    zhClass: '战斗步枪',
    zhAmmo: '轻型弹药',
    zhMode: '半自动单发',
    desc: '轻量化精确射手步枪，单发伤害 19。升级至 IV 级同时提升 +25.7% 射速、+6 弹匣容量并缩短 31.6% 换弹时间，成长性极高。'
  },
  Renegade: {
    zhName: '叛逆 (Renegade)',
    zhClass: '战斗步枪',
    zhAmmo: '中型弹药',
    zhMode: '杠杆连珠',
    desc: '西部风格杠杆式步枪，单发伤害 35、射程高达 68.8。升级至 IV 级获得恐怖的 +75% 射速提升；5级增幅可加装【光学狙击镜】与【快速装填】。'
  },
  Aphelion: {
    zhName: '远日点 (Aphelion)',
    zhClass: '战斗步枪',
    zhAmmo: '能量弹夹',
    zhMode: '二连发能量脉冲',
    desc: '传奇级双发脉冲能量步枪，2.5x 强效破甲。5级增幅支持【蓄力多发齐射 (Charged Burst)】、【脉冲扩容】与【铝热燃烧电浆】。'
  },
  Stitcher: {
    zhName: '钉机 (Stitcher)',
    zhClass: '冲锋枪',
    zhAmmo: '轻型弹药',
    zhMode: '全自动连发',
    desc: '高射速近战冲锋枪（680 RPM）。升级至 IV 级可降低 50% 水平后坐力与 40% 换弹时间，配合扩容弹匣近战融化护盾。'
  },
  Canto: {
    zhName: '颂歌 (Canto)',
    zhClass: '冲锋枪',
    zhAmmo: '中型弹药',
    zhMode: '全自动连发',
    desc: '罕见使用中型弹药的冲锋枪，兼顾高射速与 0.8x 破甲。升级增加 6 发弹容并降低 45% 散布；5级增幅可转为【卡宾枪构型】或【冲刺射击 + 燃烧弹】。'
  },
  Bobcat: {
    zhName: '山猫 (Bobcat)',
    zhClass: '冲锋枪',
    zhAmmo: '轻型弹药',
    zhMode: '全自动连发',
    desc: '史诗级超高射速冲锋枪（射速 66.7）。升级至 IV 级降低 50% 最大散布、45% 水平后坐力与 40% 换弹时间，室内近战T0利器。'
  },
  Il_Toro: {
    zhName: '公牛 (Il Toro)',
    zhClass: '霰弹枪',
    zhAmmo: '霰弹枪弹药',
    zhMode: '泵动式',
    desc: '大威力泵动式霰弹枪。升级至 IV 级提升 +50% 射速与 +3 弹仓容量；5级增幅可解锁质变【独头弹 (Slug Rounds)】：单发高伤且对ARC护甲造成 1.5x 巨额伤害！'
  },
  Vulcano: {
    zhName: '火山 (Vulcano)',
    zhClass: '霰弹枪',
    zhAmmo: '霰弹枪弹药',
    zhMode: '半自动连喷',
    desc: '史诗级半自动连发霰弹枪，近距离瞬间爆发极高。升级至 IV 级可再提升 +30% 射速并减少 40% 换弹时间。'
  },
  Dolabra: {
    zhName: '錾斧 (Dolabra)',
    zhClass: '霰弹枪',
    zhAmmo: '能量弹夹',
    zhMode: '半自动/蓄力能量',
    desc: '特殊能量霰弹武器，腰射造成 50 伤害，满蓄力射程可达 80 并具备 1.5x 强力破甲。'
  },
  Hairpin: {
    zhName: '发夹 (Hairpin)',
    zhClass: '手枪',
    zhAmmo: '轻型弹药',
    zhMode: '滑套单发(消音)',
    desc: '自带高隐蔽性的战术手枪，单发伤害 20。升级提升 +30% 射速；5级增幅可解锁【半自动改造 (+150%射速)】、【追踪弹】或【铝热燃烧弹】。'
  },
  Burletta: {
    zhName: '布尔莱塔 (Burletta)',
    zhClass: '手枪',
    zhAmmo: '轻型弹药',
    zhMode: '半自动单发',
    desc: '轻巧速射半自动手枪。升级至 IV 级缩短 50% 换弹时间；5级增幅可改造为【三连发/五连发点射】或【+60%射速全自动手枪】。'
  },
  Venator: {
    zhName: '复仇者 (Venator)',
    zhClass: '手枪',
    zhAmmo: '中型弹药',
    zhMode: '半自动双发齐射',
    desc: '每次扣动扳机发射 2 枚弹头的强力中型手枪（2×8=16伤害）。升级至 IV 级提升 +40% 射速并减少 50% 换弹时间。'
  },
  Bantam: {
    zhName: '“小钢炮” (Bantam)',
    zhClass: '手炮',
    zhAmmo: '重型弹药',
    zhMode: '双动式左轮',
    desc: '速射双动式重型左轮手炮，单发伤害 24、1.5x 破甲。升级至 IV 级减少 44.1% 换弹时间与 24% 射击散布。'
  },
  Anvil: {
    zhName: '铁砧 (Anvil)',
    zhClass: '手炮',
    zhAmmo: '重型弹药',
    zhMode: '单动式重型手炮',
    desc: '极具人气的重型手炮，单发伤害 40、爆头 2.5x（100伤害）。升级至 IV 级提升 +75% 射速；5级增幅可选择【爆裂弹 (+5伤害/+33%破甲)】或【铁砧分裂弹 (Anvil Splitter)】！'
  },
  Torrente: {
    zhName: '奔流 (Torrente)',
    zhClass: '轻机枪',
    zhAmmo: '中型弹药',
    zhMode: '全自动压制',
    desc: '重火力压制机枪，基础 60 发大弹鼓。升级至 IV 级弹鼓扩充至 90 发（+30发）并缩短 45% 换弹时间，持续火力覆盖无敌。'
  },
  Osprey: {
    zhName: '鱼鹰 (Osprey)',
    zhClass: '狙击步枪',
    zhAmmo: '中型弹药',
    zhMode: '栓动式狙击',
    desc: '超远射程（80.3）栓动狙击步枪，单发伤害 45。升级至 IV 级缩短 60% 拉栓时间；5级增幅可解锁【对ARC弱点伤害+100%】、【开镜拉栓】或【5秒追踪弹】。'
  },
  Jupiter: {
    zhName: '木星 (Jupiter)',
    zhClass: '狙击步枪',
    zhAmmo: '能量弹夹',
    zhMode: '栓动式电磁狙击',
    desc: '传奇级重型能量狙击枪，单发伤害 60，拥有全游戏最高的 3.0x 极强 ARC 破甲倍率！5级增幅支持【+5发弹容】、【高倍狙击镜】与【开镜拉栓】。'
  },
  Rascal: {
    zhName: '无赖 (Rascal)',
    zhClass: '特殊重武',
    zhAmmo: '榴弹弹药',
    zhMode: '折管单发榴弹',
    desc: '便携式折管榴弹发射器，单发 75 爆炸伤害、2.5x 极强破甲。5级增幅可解锁【+100%弹速高速榴弹】或【大范围铝热燃烧榴弹】。'
  },
  Hullcracker: {
    zhName: '裂甲者 (Hullcracker)',
    zhClass: '特殊重武',
    zhAmmo: '榴弹弹药',
    zhMode: '泵动式五连榴弹',
    desc: '史诗级反ARC装甲专用泵动式榴弹发射器，单发伤害高达 100（2.5x 破甲）。升级至 IV 级提升 +53% 射速；5级增幅解锁【整匣快速换弹】与【铝热燃烧榴弹】。'
  },
  Equalizer: {
    zhName: '制裁者 (Equalizer)',
    zhClass: '特殊重武',
    zhAmmo: '能量弹夹',
    zhMode: '全自动持续激光束',
    desc: '传奇级高容量实验型光束步枪（蓝图产自收割者 Harvester），50发能量池、2.5x 极强破甲。5级增幅解锁【持续照射递增伤害】、【对ARC弱点+67%伤害】与【+30发能量扩容】。'
  }
}

// Parse Amplified_Weapons from rawAmp
const ampStart = rawAmp.indexOf('================ Amplified_Weapons')
const ampSection = ampStart >= 0 ? rawAmp.slice(ampStart) : ''
const ampByWeapon = {}
const divRegex = /<div id="([^"]+)"[\s\S]*?(?=<div id="|<\/div>\s*<\/div>)/g
let dm
while ((dm = divRegex.exec(ampSection)) !== null) {
  const wKey = dm[1].replace(/\s+/g, '_')
  const block = dm[0]
  const tables = block.split('{| class="wikitable').slice(1)
  const perks = []
  for (const tb of tables) {
    const titleMatch = tb.match(/!\s*style="[^"]*"\s*\|\s*([^\n\r]+)/)
    const name = titleMatch ? titleMatch[1].trim() : 'Amplification'
    const lines = tb.split('\n').map((l) => l.trim())
    const descLines = []
    const statBullets = []
    let materials = ''
    let research = ''
    let conflicts = ''
    for (const line of lines) {
      if (line.startsWith('*')) {
        statBullets.push(line.replace(/^\*+\s*/, '').trim())
      } else if (line.startsWith("'''Materials:'''")) {
        materials = line.replace("'''Materials:'''", '').replace(/\[\[|\]\]/g, '').replace(/<br\s*\/?>/gi, '').trim()
      } else if (line.startsWith("'''Research:'''")) {
        research = line.replace("'''Research:'''", '').replace(/\[\[[^|\]]*\|([^\]]+)\]\]/g, '$1').replace(/\[\[|\]\]/g, '').replace(/<br\s*\/?>/gi, '').trim()
      } else if (line.startsWith("'''Conflicts:'''")) {
        conflicts = line.replace("'''Conflicts:'''", '').replace(/<br\s*\/?>/gi, '').trim()
      } else if (line.startsWith('| ') && !line.includes('style=')) {
        descLines.push(line.slice(2).trim())
      }
    }
    // Extract numerical modifiers from statBullets for interactive calculator
    let dmgAdd = 0
    let dmgMult = 1
    let rofMult = 1
    let magAdd = 0
    let arcArmorMult = 1
    let weakpointMult = 1
    let shieldMult = 1
    let burnDps = 0
    let burnSec = 0
    let projectilesMult = 1

    for (const b of statBullets) {
      let m
      if ((m = b.match(/^([+-]?\d+(?:\.\d+)?)\s*Base Damage/i))) {
        dmgAdd += parseFloat(m[1])
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Increased Projectile Damage/i))) {
        dmgMult *= 1 + parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Reduced Projectile Damage/i))) {
        dmgMult *= 1 - parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^\+(\d+)\s*Projectiles Per Shot/i))) {
        projectilesMult = 1 + parseInt(m[1], 10)
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Increased Fire Rate/i))) {
        rofMult *= 1 + parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Reduced Fire Rate/i))) {
        rofMult *= 1 - parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^([+-]?\d+)\s*Magazine Size/i))) {
        magAdd += parseInt(m[1], 10)
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Increased Damage vs ARC Armor/i))) {
        arcArmorMult *= 1 + parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Reduced Damage vs ARC Armor/i))) {
        arcArmorMult *= 1 - parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Increased Damage vs ARC Weak Points/i))) {
        weakpointMult *= 1 + parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^(\d+(?:\.\d+)?)%\s*Increased Damage vs Raider Shields/i))) {
        shieldMult *= 1 + parseFloat(m[1]) / 100
      }
      if ((m = b.match(/^\+(\d+(?:\.\d+)?)\/s\s*Burn Damage/i))) {
        burnDps = parseFloat(m[1])
      }
      if ((m = b.match(/^\+(\d+(?:\.\d+)?)s\s*Burn Duration/i))) {
        burnSec = parseFloat(m[1])
      }
    }

    perks.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      description: descLines.join(' '),
      effects: statBullets,
      materials,
      research,
      conflicts,
      modifiers: {
        dmgAdd,
        dmgMult,
        rofMult,
        magAdd,
        arcArmorMult,
        weakpointMult,
        shieldMult,
        burnDps,
        burnSec,
        projectilesMult
      }
    })
  }
  ampByWeapon[wKey] = perks
}

function parsePerkModifiers(perkStr) {
  const effects = perkStr
    ? perkStr
        .split(/<br\s*\/?>/i)
        .map((s) => s.trim())
        .filter(Boolean)
    : []
  let rofPct = 0
  let reloadReductionPct = 0
  let recoilReductionPct = 0
  let velocityPct = 0
  let magBonus = 0
  let durabilityBonus = 0
  let dispersionReductionPct = 0

  for (const ef of effects) {
    let m
    if ((m = ef.match(/(\d+(?:\.\d+)?)%\s*Increased Fire Rate/i))) rofPct += parseFloat(m[1])
    if ((m = ef.match(/(\d+(?:\.\d+)?)%\s*Reduced Bolt Action Time/i))) rofPct += parseFloat(m[1])
    if ((m = ef.match(/(\d+(?:\.\d+)?)%\s*Reduced Reload Time/i))) reloadReductionPct += parseFloat(m[1])
    if ((m = ef.match(/(\d+(?:\.\d+)?)%\s*Reduced Horizontal Recoil/i))) recoilReductionPct += parseFloat(m[1])
    if ((m = ef.match(/(\d+(?:\.\d+)?)%\s*Increased Bullet Velocity/i))) velocityPct += parseFloat(m[1])
    if ((m = ef.match(/\+(\d+)\s*Magazine Size/i))) magBonus += parseInt(m[1], 10)
    if ((m = ef.match(/\+(\d+)\s*Durability/i))) durabilityBonus += parseInt(m[1], 10)
    if ((m = ef.match(/(\d+(?:\.\d+)?)%\s*Reduced (?:Max Shot |Per-Shot |Dispersion Recovery )/i))) {
      dispersionReductionPct += parseFloat(m[1])
    }
  }
  return {
    effects,
    rofPct,
    reloadReductionPct,
    recoilReductionPct,
    velocityPct,
    magBonus,
    durabilityBonus,
    dispersionReductionPct
  }
}

const weaponBlocks = rawWeapons.split('=== WEAPON: ').slice(1)
const weapons = []

for (const b of weaponBlocks) {
  const key = b.split(' ')[0].trim()
  const get = (k) => {
    const m = b.match(new RegExp('\\|\\s*' + k + '\\s*=\\s*([^\\n\\r}]+)', 'i'))
    return m ? m[1].trim() : ''
  }

  const name = get('name') || key.replace('_', ' ')
  const rarity = get('rarity') || 'Common'
  const quote = get('weaponquote')
  const type = get('type') || 'Assault Rifle'
  const ammo = get('ammo') || 'Medium Ammo'
  const rawMag = get('magsize').split('{{!}}')[0].trim()
  const baseMag = parseInt(rawMag, 10) || 10

  const rawDmg = get('damage')
  let baseDamage = parseFloat(rawDmg) || 10
  let pellets = 1
  if (key === 'Il_Toro') {
    baseDamage = 67.5
    pellets = 9
  } else if (key === 'Venator') {
    baseDamage = 16
    pellets = 2
  } else if (key === 'Dolabra') {
    baseDamage = 50
  }

  const rawRof = get('firerate')
  const baseFireRate = parseFloat(rawRof) || 15
  const rpmMatch = rawRof.match(/\((\d+)\s*RPM\)/i)
  const rpm = rpmMatch ? parseInt(rpmMatch[1], 10) : Math.round(baseFireRate * 15)

  const rawRange = get('range').replace(/<[^>]+>/g, '').trim()
  const baseRange = parseFloat(rawRange) || (key === 'Equalizer' ? 68.6 : key === 'Dolabra' ? 80 : 45)

  const rawHs = get('headshotmultiplier')
  const headshotMult = parseFloat(rawHs) || (type === 'Shotgun' || type === 'Special' ? 1.5 : 2.0)

  const rawPen = get('ARCarmorpenetr')
  const penMultMatch = rawPen.match(/\(([\d.]+)x?\)/i)
  const arcPenMult = penMultMatch ? parseFloat(penMultMatch[1]) : 1.0
  const arcPenLabel = rawPen.split('(')[0].trim() || 'Moderate'

  const stability = parseFloat(get('stability')) || 70
  const agility = parseFloat(get('agility')) || 55
  const stealth = parseFloat(get('stealth')) || 20
  const weight = parseFloat(get('weight')) || 6.0

  const d1 = parseInt(get('durability1'), 10) || 500
  const d2 = parseInt(get('durability2'), 10) || d1 + 60
  const d3 = parseInt(get('durability3'), 10) || d2 + 75
  const d4 = parseInt(get('durability4'), 10) || d3 + 90

  const modSlots = (get('compatiblemods') || '')
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const craftIngredients = get('ingredients').replace(/\[\[|\]\]/g, '')
  const l2 = parsePerkModifiers(get('level2-perks'))
  const l3 = parsePerkModifiers(get('level3-perks'))
  const l4 = parsePerkModifiers(get('level4-perks'))

  const canUpgradeTiers = l2.effects.length > 0 || l3.effects.length > 0 || l4.effects.length > 0

  const tiers = [
    {
      tier: 1,
      roman: 'I',
      label: `${name} I (基础型)`,
      materials: craftIngredients || '顶部搜刮 / 蓝图制作',
      durability: d1,
      ...parsePerkModifiers('')
    },
    ...(canUpgradeTiers
      ? [
          {
            tier: 2,
            roman: 'II',
            label: `${name} II (二级强化)`,
            materials: get('level2-ingredients'),
            durability: d2,
            ...l2
          },
          {
            tier: 3,
            roman: 'III',
            label: `${name} III (三级强化)`,
            materials: get('level3-ingredients'),
            durability: d3,
            ...l3
          },
          {
            tier: 4,
            roman: 'IV',
            label: `${name} IV (满级精工)`,
            materials: get('level4-ingredients'),
            durability: d4,
            ...l4
          }
        ]
      : [])
  ]

  const zhMeta = WEAPON_ZH[key] || {
    zhName: name,
    zhClass: type,
    zhAmmo: ammo,
    zhMode: get('firingmode'),
    desc: quote
  }

  weapons.push({
    id: key.toLowerCase(),
    key,
    name,
    zhName: zhMeta.zhName,
    rarity,
    type,
    zhClass: zhMeta.zhClass,
    ammo,
    zhAmmo: zhMeta.zhAmmo,
    firingMode: get('firingmode') || 'Semi-Automatic',
    zhMode: zhMeta.zhMode,
    quote,
    description: zhMeta.desc,
    baseStats: {
      damage: baseDamage,
      pellets,
      rawDamageText: rawDmg || String(baseDamage),
      headshotMultiplier: headshotMult,
      headshotDamage: Math.round(baseDamage * headshotMult * 10) / 10,
      fireRate: baseFireRate,
      rpm,
      dps: Math.round((baseDamage * baseFireRate) * 10) / 10,
      range: baseRange,
      magazineSize: baseMag,
      arcArmorPenetration: arcPenLabel,
      arcArmorMultiplier: arcPenMult,
      arcArmorDps: Math.round((baseDamage * baseFireRate * arcPenMult) * 10) / 10,
      stability,
      agility,
      stealth,
      weight,
      durability: d1
    },
    modSlots,
    tiers,
    amplifications: ampByWeapon[key] || []
  })
}

// Parse Weapon Mods from rawHtml
const modStartIdx = rawHtml.indexOf('=== PARSED: Weapon_Mods ===')
const modsHtml = modStartIdx >= 0 ? rawHtml.slice(modStartIdx) : ''
const modRows = modsHtml.split('<tr>').slice(2)
const weaponMods = []

for (const row of modRows) {
  const tds = row.split('<td').slice(1).map((c) => '<td' + c.split('</td>')[0] + '</td>')
  if (tds.length < 5) continue
  const strip = (h) =>
    h
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#160;|&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
  const modName = strip(tds[0])
  const slot = strip(tds[1])
  const funcDivs = [...tds[2].matchAll(/<div>([\s\S]*?)<\/div>/g)]
    .map((m) => strip(m[1]))
    .filter(Boolean)
  const station = strip(tds[3])
  const materials = strip(tds[4])
  if (!modName) continue

  // Numeric modifiers for attachment simulator
  let magAdd = 0
  let rofMult = 1
  let vRecoilMult = 1
  let hRecoilMult = 1
  let reloadMult = 1
  let velocityMult = 1
  for (const f of funcDivs) {
    let m
    if ((m = f.match(/^\+(\d+)\s*Magazine Size/i))) magAdd += parseInt(m[1], 10)
    if ((m = f.match(/^(\d+(?:\.\d+)?)%\s*Increased Fire Rate/i))) rofMult *= 1 + parseFloat(m[1]) / 100
    if ((m = f.match(/^(\d+(?:\.\d+)?)%\s*Reduced Vertical Recoil/i))) vRecoilMult *= 1 - parseFloat(m[1]) / 100
    if ((m = f.match(/^(\d+(?:\.\d+)?)%\s*Reduced Horizontal Recoil/i))) hRecoilMult *= 1 - parseFloat(m[1]) / 100
    if ((m = f.match(/^(\d+(?:\.\d+)?)%\s*Reduced Reload Time/i))) reloadMult *= 1 - parseFloat(m[1]) / 100
    if ((m = f.match(/^(\d+(?:\.\d+)?)%\s*Increased Bullet Velocity/i))) velocityMult *= 1 + parseFloat(m[1]) / 100
  }

  weaponMods.push({
    id: modName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name: modName,
    slot,
    effects: funcDivs,
    station,
    materials,
    modifiers: {
      magAdd,
      rofMult,
      vRecoilMult,
      hRecoilMult,
      reloadMult,
      velocityMult
    }
  })
}

fs.writeFileSync(
  'e:/qianproject/arc-map/src/data/weaponsData.json',
  JSON.stringify({ updatedFrom: 'https://arcraiders.wiki/wiki/Weapons', weapons, weaponMods }, null, 2),
  'utf8'
)
console.log(`Wrote weaponsData.json: ${weapons.length} weapons, ${weaponMods.length} mods`)

// Now parse Quests from rawHtml
const questsHtml = modStartIdx >= 0 ? rawHtml.slice(0, modStartIdx) : rawHtml
const tabPanels = questsHtml.split('<div class="tabber__panel"').slice(1)
const questsMap = new Map()

const TRADER_ZH = {
  Shani: '萨尼 (Shani · 安全主管)',
  Celeste: '塞莱斯特 (Celeste · 社区领袖)',
  'Tian Wen': '天玟 (Tian Wen · 军火武器商)',
  Lance: '兰斯 (Lance · 医疗与义体商)',
  Apollo: '阿波罗 (Apollo · 机械与蓝图商)'
}

const LOCATION_META = {
  'Dam Battlegrounds': {
    zhLocation: '大坝战场 (Dam Battlegrounds)',
    mapCategory: 'dam',
    linkedStage: 'caz',
    linkedStageLabel: '进入【大坝 · 受控访问区】3D地图'
  },
  'The Blue Gate': {
    zhLocation: '蓝门 (The Blue Gate)',
    mapCategory: 'blue-gate',
    linkedStage: 'refuge',
    linkedStageLabel: '进入【蓝门 · 避难所/古代要塞】3D地图'
  },
  'Blue Gate': {
    zhLocation: '蓝门 (The Blue Gate)',
    mapCategory: 'blue-gate',
    linkedStage: 'refuge',
    linkedStageLabel: '进入【蓝门 · 避难所/古代要塞】3D地图'
  },
  'Stella Montis': {
    zhLocation: '星辰山 (Stella Montis)',
    mapCategory: 'stella-montis',
    linkedStage: 'walker',
    linkedStageLabel: '进入【雪山 · 坠落帝王】3D地图'
  },
  'Pendola Pass': {
    zhLocation: '彭多拉山口 · 雪山冰道 (Pendola Pass)',
    mapCategory: 'stella-montis',
    linkedStage: 'walker',
    linkedStageLabel: '进入【雪山 · 坠落帝王】3D地图'
  },
  'Buried City': {
    zhLocation: '掩埋废城 (Buried City)',
    mapCategory: 'buried-city',
    linkedStage: null,
    linkedStageLabel: null
  },
  'The Spaceport': {
    zhLocation: '太空港 (The Spaceport)',
    mapCategory: 'spaceport',
    linkedStage: 'frigate',
    linkedStageLabel: '查看【ARC“护卫者”】3D机关图'
  },
  Spaceport: {
    zhLocation: '太空港 (The Spaceport)',
    mapCategory: 'spaceport',
    linkedStage: 'frigate',
    linkedStageLabel: '查看【ARC“护卫者”】3D机关图'
  },
  Any: {
    zhLocation: '任意战区 (Any Topside Map)',
    mapCategory: 'any',
    linkedStage: null,
    linkedStageLabel: null
  }
}

const CAMPAIGN_ZH = {
  All_Quests: '主线与常驻任务 (Core Questline)',
  Frozen_Trail: '冰封雪道赛季 (Frozen Trail · 坠落帝王)',
  Riven_Tides: '裂潮行动 (Riven Tides)',
  Flashpoint: '闪点行动 (Flashpoint)',
  Shrouded_Sky: '蔽日天空 (Shrouded Sky · ARC“护卫者”)',
  Headwinds: '逆风行动 (Headwinds)',
  Cold_Snap: '寒潮 (Cold Snap)',
  North_Line: '北境战线 (North Line)'
}

const stripHtml = (h) =>
  h
    .replace(/<li[^>]*>/gi, ' • ')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

for (const panel of tabPanels) {
  const idMatch = panel.match(/id="tabber-([^"]+)"/)
  const tabId = idMatch ? idMatch[1] : 'All_Quests'
  const rows = panel.split('<tr>').slice(2)

  rows.forEach((row, idx) => {
    const tds = row.split('<td').slice(1).map((c) => '<td' + c.split('</td>')[0] + '</td>')
    if (tds.length < 6) return
    const title = stripHtml(tds[1])
    if (!title) return
    const trader = stripHtml(tds[2]) || 'Shani'
    const rawLoc = stripHtml(tds[3]) || 'Any'
    const reqItems = stripHtml(tds[4]).replace(/^•\s*/, '') || '无特殊前置物资'
    const rewards = [...tds[5].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripHtml(m[1]))
      .filter(Boolean)
    if (rewards.length === 0) {
      const fallbackReward = stripHtml(tds[5])
      if (fallbackReward && fallbackReward !== '—') rewards.push(fallbackReward)
    }

    // Match location metadata
    let locMeta = LOCATION_META.Any
    for (const [k, v] of Object.entries(LOCATION_META)) {
      if (rawLoc.toLowerCase().includes(k.toLowerCase())) {
        locMeta = v
        break
      }
    }
    // Check if quest title/location relates to Fort or Refuge specifically
    let linkedStage = locMeta.linkedStage
    let linkedStageLabel = locMeta.linkedStageLabel
    if (/Fort|Battery|Cellar/i.test(title) && locMeta.mapCategory === 'blue-gate') {
      linkedStage = 'fort'
      linkedStageLabel = '进入【蓝门 · 古代要塞】3D地图'
    } else if (/Walker|Emperor|Collector|Frozen/i.test(title) || tabId === 'Frozen_Trail') {
      linkedStage = 'walker'
      linkedStageLabel = '进入【雪山 · 坠落帝王】3D地图'
    } else if (/Frigate|Sky/i.test(title) || tabId === 'Shrouded_Sky') {
      linkedStage = 'frigate'
      linkedStageLabel = '进入【高空 · ARC“护卫者”】3D地图'
    }

    const qId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (!questsMap.has(qId)) {
      questsMap.set(qId, {
        id: qId,
        order: questsMap.size + 1,
        title,
        trader,
        zhTrader: TRADER_ZH[trader] || trader,
        location: rawLoc,
        zhLocation: locMeta.zhLocation,
        mapCategory: locMeta.mapCategory,
        linkedStage,
        linkedStageLabel,
        requiredItems: reqItems === '—' ? '无须携带特定任务物品' : reqItems,
        rewards: rewards.length ? rewards : ['经验值与奇袭者代币 (Raider Coins)'],
        campaigns: [tabId],
        zhCampaign: CAMPAIGN_ZH[tabId] || tabId
      })
    } else {
      const existing = questsMap.get(qId)
      if (!existing.campaigns.includes(tabId)) {
        existing.campaigns.push(tabId)
        if (tabId !== 'All_Quests') {
          existing.zhCampaign = CAMPAIGN_ZH[tabId] || tabId
          if (tabId === 'Frozen_Trail' && !existing.linkedStage) {
            existing.linkedStage = 'walker'
            existing.linkedStageLabel = '进入【雪山 · 坠落帝王】3D地图'
          } else if (tabId === 'Shrouded_Sky' && !existing.linkedStage) {
            existing.linkedStage = 'frigate'
            existing.linkedStageLabel = '进入【高空 · ARC“护卫者”】3D地图'
          }
        }
      }
    }
  })
}

const quests = Array.from(questsMap.values())
fs.writeFileSync(
  'e:/qianproject/arc-map/src/data/questsData.json',
  JSON.stringify(
    {
      updatedFrom: 'https://arcraiders.wiki/wiki/Quests',
      totalQuests: quests.length,
      campaigns: Object.entries(CAMPAIGN_ZH).map(([id, label]) => ({ id, label })),
      traders: Object.entries(TRADER_ZH).map(([id, label]) => ({ id, label })),
      quests
    },
    null,
    2
  ),
  'utf8'
)
console.log(`Wrote questsData.json: ${quests.length} quests`)
buildQuestMapTargets()
