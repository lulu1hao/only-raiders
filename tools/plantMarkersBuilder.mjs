import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const verifiedActors = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'verifiedMapActors.json'), 'utf8'),
)

const pad2 = (n) => String(n).padStart(2, '0')

// ============================================================================
// 1. Plant & Nature Categories (Referenced from arctracker.io + Scrappy / Workshop)
// ============================================================================
export const PLANT_CATEGORIES = [
  {
    id: 'plant-lemon',
    name: '柠檬',
    enName: 'Lemon',
    shortName: '柠檬',
    icon: 'items/T_UI_Icon_Consumable_Lemon.png',
    accent: '#facc15',
    scrappyUse: '废品仔 Lv.2→Lv.3 晋升 (×3) · 喂食器【爆炸物/手雷】掉落 · 水果拼盘配方',
    summary: '生长于温带果园与公园绿地的柠檬树，可直接拾取落果或对树干按交互键“踢树 (Kick Tree)”摇落树冠柠檬。',
  },
  {
    id: 'plant-apricot',
    name: '杏子',
    enName: 'Apricot',
    shortName: '杏子',
    icon: 'items/T_UI_Icon_Consumable_Apricot.png',
    accent: '#fb923c',
    scrappyUse: '废品仔 Lv.2→Lv.3 (×3) & Lv.4→Lv.5 (×12) · 喂食器【武器台/枪械零件】掉落 · 水果拼盘配方',
    summary: '红湖小岛、马拉诺公园与蓝门橄榄树林常见的杏树集群，踢击树干或搜寻树下草丛可高效采集。',
  },
  {
    id: 'plant-prickly-pear',
    name: '仙人掌果',
    enName: 'Prickly Pear',
    shortName: '仙人掌果',
    icon: 'items/T_UI_Icon_Consumable_PricklyPear.png',
    accent: '#f43f5e',
    scrappyUse: '废品仔 Lv.3→Lv.4 晋升 (×6) · 喂食器【工具台/战术道具】掉落 · 水果拼盘配方',
    summary: '结生于干旱荒漠与沙丘边缘仙人掌丛（Prickly Pear Cactus）根部的紫红色浆果，靠近仙人掌底部地面即可拾取。',
  },
  {
    id: 'plant-olives',
    name: '橄榄',
    enName: 'Olives',
    shortName: '橄榄',
    icon: 'items/T_UI_Icon_Consumable_Olives_A.png',
    accent: '#84cc16',
    scrappyUse: '废品仔 Lv.3→Lv.4 晋升 (×6) · 喂食器【医疗品/充能材料】掉落',
    summary: '蓝门【橄榄树林 (Olive Grove)】与【奇袭者避难所】的特产作物，树冠下与果园地面密集刷新。',
  },
  {
    id: 'plant-mushroom',
    name: '蘑菇',
    enName: 'Mushroom',
    shortName: '蘑菇',
    icon: 'items/T_UI_Icon_Consumable_Mushroom.png',
    accent: '#d97706',
    scrappyUse: '废品仔 Lv.4→Lv.5 满级晋升 (×12) · 喂食器【护盾/增强包/装备核心】掉落',
    summary: '喜阴湿环境的野生菌类，集中生长于水培穹顶水池、水处理控制中心潮湿管道、沼泽腐木与排水暗渠。',
  },
  {
    id: 'plant-great-mullein',
    name: '毛蕊花',
    enName: 'Great Mullein',
    shortName: '毛蕊花',
    icon: 'items/T_UI_Icon_Salvage_TorchGinger.png',
    accent: '#eab308',
    scrappyUse: '医疗实验室合成【草药绷带 / 消毒绷带】核心草药 · 日常植物契约目标',
    summary: '开有醒目黄色花穗的高株药用植物（大毛蕊花），广泛分布于水培穹顶、沼泽草甸、城市公园花坛与农田田埂。',
  },
  {
    id: 'plant-agave',
    name: '龙舌兰',
    enName: 'Agave',
    shortName: '龙舌兰',
    icon: 'items/T_UI_Icon_Consumable_Agave.png',
    accent: '#10b981',
    scrappyUse: '喂食器【成品枪械配件/改装件】掉落 · 医疗合成【龙舌兰汁】原料',
    summary: '耐旱的肉质莲座植物，在大坝苍白公寓西坡、太空港水塔荒漠、掩埋废城沙丘与裂潮镇海滩成片分布。',
  },
  {
    id: 'plant-moss',
    name: '苔藓',
    enName: 'Moss',
    shortName: '苔藓',
    icon: 'items/T_UI_Icon_Consumable_Moss.png',
    accent: '#14b8a6',
    scrappyUse: '医疗实验室合成【复苏剂 (Defibrillator) / 补水喷雾】核心原料',
    summary: '附着于水培温室水槽、沼泽枯木与地下潮湿岩壁的绿植苔藓。',
  },
  {
    id: 'plant-candleberries',
    name: '烛莓',
    enName: 'Candleberries',
    shortName: '烛莓',
    icon: 'items/T_UI_Icon_Salvage_Event_Item_Candleberries.png',
    accent: '#ef4444',
    scrappyUse: '喂食器【“帝王”调制器/研究站核心仪器/哨站建材】专属投喂果物',
    summary: '寒带与湿地灌木丛结出的鲜红浆果，在彭多拉山口冰封河谷、大坝旧战场及各战区灌木带高密度刷新。',
  },
  {
    id: 'plant-fruit-basket',
    name: '柳条水果篮',
    enName: 'Fruit Basket',
    shortName: '水果篮',
    icon: 'game-maps/icons/T_UI_Icon_Loot-Nature.png',
    accent: '#22c55e',
    scrappyUse: '单次开启可一次性混出多颗【柠檬 + 杏子 + 橄榄 + 仙人掌果 + 蘑菇 + 树脂】',
    summary: '战区野外营地与温室散落的编织柳条篮（Wicker Fruit Basket），是集齐废品仔全套升级果物最快的高产容器。',
  },
]

export const PLANT_CATEGORIES_BY_ID = Object.fromEntries(
  PLANT_CATEGORIES.map((c) => [c.id, c]),
)

// ============================================================================
// 2. Supplemental Verified Plant Spawns (arctracker.io + In-Game Verified Spawns
//    for Prickly Pear, Mushroom, Great Mullein, Moss, and Indoor Seed Vault)
// ============================================================================
const SUPPLEMENTAL_PLANT_SPAWNS = {
  'dam-battlegrounds': {
    'plant-lemon': [
      {
        x: 48.57,
        y: 37.52,
        layer: 0,
        count: 3,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶综合体中央温室培育槽与柳条果篮固定产出新鲜柠檬。',
      },
      {
        x: 45.62,
        y: 39.73,
        layer: 0,
        count: 2,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶西南翼玻璃温室植物箱与自然补给篮。',
      },
    ],
    'plant-apricot': [
      {
        x: 48.8,
        y: 36.9,
        layer: 0,
        count: 3,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶综合体北侧生态温室果木架与果篮产出杏子。',
      },
    ],
    'plant-prickly-pear': [
      {
        x: 59.4,
        y: 26.8,
        layer: 0,
        count: 4,
        area: '发电厂综合体',
        enArea: 'Power Generation Complex',
        note: '发电厂综合体北侧向阳荒坡仙人掌丛（arctracker.io 实测高产点），仙人掌根部地面可直接拾取仙人掌果。',
      },
      {
        x: 63.8,
        y: 29.2,
        layer: 0,
        count: 3,
        area: '发电厂综合体',
        enArea: 'Power Generation Complex',
        note: '发电厂东侧与受控访问区北坡之间的干旱乱石仙人掌群。',
      },
      {
        x: 67.2,
        y: 58.6,
        layer: 0,
        count: 3,
        area: '红湖阳台',
        enArea: 'Red Lakes Balcony',
        note: '红湖阳台与输电塔南侧干旱沙坡仙人掌株下刷新。',
      },
      {
        x: 71.4,
        y: 54.8,
        layer: 0,
        count: 2,
        area: '输电塔',
        enArea: 'Electrical Tower',
        note: '红湖东岸输电塔基座周边仙人掌丛。',
      },
      {
        x: 28.6,
        y: 33.4,
        layer: 0,
        count: 3,
        area: '苍白公寓',
        enArea: 'Pale Apartments',
        note: '苍白公寓西侧山坡与龙舌兰伴生的仙人掌丛。',
      },
    ],
    'plant-olives': [
      {
        x: 48.57,
        y: 37.52,
        layer: 0,
        count: 3,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶综合体植物培育架与茂盛花开柳条果篮可产出橄榄。',
      },
      {
        x: 45.62,
        y: 39.73,
        layer: 0,
        count: 2,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶西侧温室果篮与标本箱。',
      },
    ],
    'plant-mushroom': [
      {
        x: 48.2,
        y: 36.4,
        layer: 0,
        count: 5,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶综合体主穹顶内部浅水池边缘与潮湿培养槽（废品仔 Lv.5 蘑菇最稳采集点）。',
      },
      {
        x: 50.8,
        y: 38.2,
        layer: 0,
        count: 4,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶东侧积水涵洞与倒伏腐木树皮上密集簇生。',
      },
      {
        x: 45.9,
        y: 40.1,
        layer: 0,
        count: 3,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶南侧湿地浅滩腐木群。',
      },
      {
        x: 41.8,
        y: 48.6,
        layer: 0,
        count: 4,
        area: '水处理控制中心',
        enArea: 'Water Treatment Control',
        note: '水处理控制中心东侧一楼潮湿管道走廊（贴近冷却水管内侧地面固定刷 3~4 朵蘑菇）。',
      },
      {
        x: 43.4,
        y: 50.2,
        layer: 0,
        count: 3,
        area: '水处理控制中心',
        enArea: 'Water Treatment Control',
        note: '水处理控制中心外侧蓄水池与排水渠阴暗角落。',
      },
      {
        x: 31.2,
        y: 49.8,
        layer: 0,
        count: 4,
        area: '沼泽南部岗哨',
        enArea: 'South Swamp Outpost',
        note: '西部湿地与沼泽南部岗哨周边的巨大枯木树根与树干表面。',
      },
      {
        x: 34.5,
        y: 44.6,
        layer: 0,
        count: 3,
        area: '旧战场',
        enArea: 'Old Battleground',
        note: '旧战场湿地泥潭边缘的腐烂树桩。',
      },
      {
        x: 50.81,
        y: 64.61,
        layer: 0,
        count: 4,
        area: '植物的根',
        enArea: 'Roots',
        note: '废料场北侧【植物的根 (Roots)】巨树根部洞穴内潮湿地面。',
      },
    ],
    'plant-great-mullein': [
      {
        x: 47.4,
        y: 36.8,
        layer: 0,
        count: 6,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶综合体内外草甸高密度刷新黄色花穗的【大毛蕊花 (Great Mullein)】。',
      },
      {
        x: 50.2,
        y: 35.1,
        layer: 0,
        count: 5,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶东北侧浅滩草丛，单趟可采齐 6~10 株毛蕊花。',
      },
      {
        x: 34.6,
        y: 42.8,
        layer: 0,
        count: 4,
        area: '旧战场',
        enArea: 'Old Battleground',
        note: '旧战场至沼泽南部岗哨沿线湿地草丛。',
      },
      {
        x: 33.8,
        y: 48.5,
        layer: 0,
        count: 4,
        area: '沼泽南部岗哨',
        enArea: 'South Swamp Outpost',
        note: '沼泽南部岗哨北侧河滩高草区。',
      },
      {
        x: 65.8,
        y: 52.4,
        layer: 0,
        count: 3,
        area: '红湖阳台',
        enArea: 'Red Lakes Balcony',
        note: '红湖阳台西侧岸坡草丛。',
      },
    ],
    'plant-moss': [
      {
        x: 48.0,
        y: 37.8,
        layer: 0,
        count: 5,
        area: '水培穹顶综合体',
        enArea: 'Hydroponic Dome Complex',
        note: '水培穹顶综合体水池护栏与恒湿培育箱内高产苔藓（Moss）。',
      },
      {
        x: 32.5,
        y: 47.4,
        layer: 0,
        count: 4,
        area: '沼泽南部岗哨',
        enArea: 'South Swamp Outpost',
        note: '大坝西部沼泽倒伏树干与阴湿岩石表面。',
      },
      {
        x: 41.5,
        y: 48.9,
        layer: 0,
        count: 3,
        area: '水处理控制中心',
        enArea: 'Water Treatment Control',
        note: '水处理控制中心滤水池内壁与管道接口。',
      },
    ],
  },

  'buried-city': {
    'plant-prickly-pear': [
      {
        x: 31.2,
        y: 76.4,
        layer: 0,
        count: 4,
        area: '废弃的高速公路营地',
        enArea: 'Abandoned Highway Camp',
        note: '西南外围【废弃的高速公路营地】南侧沙丘仙人掌群，地面固定刷新多颗仙人掌果。',
      },
      {
        x: 35.4,
        y: 78.2,
        layer: 0,
        count: 3,
        area: '废弃的高速公路营地',
        enArea: 'Abandoned Highway Camp',
        note: '高架桥断桥南端沙丘仙人掌丛。',
      },
      {
        x: 57.8,
        y: 86.4,
        layer: 0,
        count: 4,
        area: '玫瑰广场',
        enArea: 'Plaza Rosa',
        note: '南部边缘玫瑰广场与南站外围沙丘仙人掌丛（近南部撤离点沿线）。',
      },
      {
        x: 48.5,
        y: 83.2,
        layer: 0,
        count: 3,
        area: '玫瑰广场',
        enArea: 'Plaza Rosa',
        note: '玫瑰广场西南沙坡仙人掌株下拾取。',
      },
      {
        x: 69.8,
        y: 31.4,
        layer: 0,
        count: 4,
        area: '沙丘尽头',
        enArea: "Dune's End",
        note: '东北外围【沙丘尽头 (Dune\'s End)】荒漠边缘仙人掌带。',
      },
      {
        x: 73.2,
        y: 36.8,
        layer: 0,
        count: 3,
        area: '沙丘尽头',
        enArea: "Dune's End",
        note: '沙丘尽头南侧与埋没的楼群交界沙坡仙人掌。',
      },
      {
        x: 24.6,
        y: 28.5,
        layer: 0,
        count: 3,
        area: '马拉诺车站',
        enArea: 'Marano Station',
        note: '西北外围马拉诺车站与苏杜兰仓库西侧荒漠仙人掌丛。',
      },
    ],
    'plant-great-mullein': [
      {
        x: 47.8,
        y: 44.6,
        layer: 0,
        count: 5,
        area: '马拉诺公园',
        enArea: 'Marano Park',
        note: '马拉诺公园中央花坛与绿植带密集生长大毛蕊花。',
      },
      {
        x: 61.4,
        y: 55.8,
        layer: 0,
        count: 4,
        area: '阿布斯托药房',
        enArea: 'Arbusto Pharmacy',
        note: '阿布斯托广场与药房门口的药用植物花箱。',
      },
      {
        x: 53.4,
        y: 72.6,
        layer: 0,
        count: 3,
        area: '玫瑰广场',
        enArea: 'Plaza Rosa',
        note: '玫瑰广场街心花园草丛。',
      },
    ],
    'plant-agave': [
      {
        x: 70.4,
        y: 33.2,
        layer: 0,
        count: 5,
        area: '沙丘尽头',
        enArea: "Dune's End",
        note: '掩埋废城东北【沙丘尽头】荒漠岩石区龙舌兰植株群。',
      },
      {
        x: 67.8,
        y: 29.5,
        layer: 0,
        count: 3,
        area: '沙丘尽头',
        enArea: "Dune's End",
        note: '市集废墟东侧至沙丘尽头的向阳沙坡龙舌兰。',
      },
      {
        x: 30.4,
        y: 75.8,
        layer: 0,
        count: 4,
        area: '废弃的高速公路营地',
        enArea: 'Abandoned Highway Camp',
        note: '西南废弃高速公路营地外围沙丘龙舌兰丛。',
      },
      {
        x: 24.2,
        y: 26.8,
        layer: 0,
        count: 3,
        area: '马拉诺车站',
        enArea: 'Marano Station',
        note: '马拉诺车站北侧荒漠边缘龙舌兰。',
      },
    ],
  },

  spaceport: {
    'plant-prickly-pear': [
      {
        x: 25.4,
        y: 28.2,
        layer: 0,
        count: 4,
        area: '燃料库',
        enArea: 'Fuel Depot',
        note: '太空港西北【燃料库】至【水塔】外围荒漠仙人掌丛，仙人掌株下高产仙人掌果。',
      },
      {
        x: 21.8,
        y: 35.4,
        layer: 0,
        count: 4,
        area: '水塔',
        enArea: 'Water Towers',
        note: '西侧水塔外围防风沙丘仙人掌带（近任务【在地图上】仙人掌打卡点）。',
      },
      {
        x: 31.2,
        y: 24.8,
        layer: 0,
        count: 3,
        area: '燃料库',
        enArea: 'Fuel Depot',
        note: '燃料库北侧围墙缺口外荒漠仙人掌群。',
      },
      {
        x: 58.4,
        y: 71.6,
        layer: 0,
        count: 4,
        area: '员工停车场',
        enArea: 'Staff Parking',
        note: '南部员工停车场与变电站南侧外围荒漠仙人掌丛。',
      },
      {
        x: 64.2,
        y: 68.5,
        layer: 0,
        count: 3,
        area: '服务大楼',
        enArea: 'Service Buildings',
        note: '服务大楼东南外围沙地仙人掌。',
      },
      {
        x: 72.6,
        y: 46.4,
        layer: 0,
        count: 3,
        area: '东部平原仓库',
        enArea: 'East Plains Warehouses',
        note: '东部平原外围荒漠仙人掌丛。',
      },
    ],
    'plant-mushroom': [
      {
        x: 62.8,
        y: 35.4,
        layer: 0,
        count: 4,
        area: '小机库',
        enArea: 'Little Hangar',
        note: '太空港【小机库 (Little Hangar)】东侧排水沟渠与潮湿树皮（arctracker.io 实测蘑菇高产点）。',
      },
      {
        x: 64.2,
        y: 37.6,
        layer: 0,
        count: 3,
        area: '小机库',
        enArea: 'Little Hangar',
        note: '小机库东南侧阴暗涵洞与倒木。',
      },
      {
        x: 56.8,
        y: 32.4,
        layer: 0,
        count: 4,
        area: '壕沟',
        enArea: 'The Trench',
        note: '北部【壕沟 (The Trench)】底层阴暗导流渠湿壁与腐木。',
      },
      {
        x: 21.2,
        y: 34.8,
        layer: 0,
        count: 3,
        area: '水塔',
        enArea: 'Water Towers',
        note: '西侧水塔底部漏水管道阴暗处。',
      },
    ],
    'plant-great-mullein': [
      {
        x: 57.4,
        y: 33.2,
        layer: 0,
        count: 4,
        area: '壕沟',
        enArea: 'The Trench',
        note: '北部战壕坡顶绿植草丛刷新大毛蕊花。',
      },
      {
        x: 66.4,
        y: 54.8,
        layer: 0,
        count: 3,
        area: '通讯塔',
        enArea: 'Communications Tower',
        note: '东部通讯塔周边草地。',
      },
    ],
  },

  'blue-gate': {
    'plant-mushroom': [
      {
        x: 32.8,
        y: 45.4,
        layer: 0,
        count: 5,
        area: '复仇者林地',
        enArea: "Trapper's Glade",
        note: '蓝门西部【复仇者林地 (Trapper\'s Glade)】阴暗森林腐木与树根群，盛产野生蘑菇。',
      },
      {
        x: 36.4,
        y: 47.2,
        layer: 0,
        count: 4,
        area: '森林',
        enArea: 'The Forest',
        note: '中央森林溪谷倒伏树干表面。',
      },
      {
        x: 29.8,
        y: 42.1,
        layer: 0,
        count: 3,
        area: '荒芜空地',
        enArea: 'Barren Clearing',
        note: '荒芜空地南缘林地阴影处腐木。',
      },
      {
        x: 61.5,
        y: 36.8,
        layer: 0,
        count: 3,
        area: '数据仓库',
        enArea: 'Data Vault',
        note: '北部山区松林阴坡树根处。',
      },
    ],
    'plant-great-mullein': [
      {
        x: 43.6,
        y: 61.8,
        layer: 0,
        count: 5,
        area: '橄榄树林',
        enArea: 'Olive Grove',
        note: '橄榄树林北侧草坡与农田田埂密集生长大毛蕊花。',
      },
      {
        x: 48.2,
        y: 60.4,
        layer: 0,
        count: 4,
        area: '农田',
        enArea: 'Farmlands',
        note: '南部农田灌溉渠两岸草丛。',
      },
      {
        x: 35.4,
        y: 44.2,
        layer: 0,
        count: 4,
        area: '复仇者林地',
        enArea: "Trapper's Glade",
        note: '复仇者林地林间空地草甸。',
      },
      {
        x: 38.6,
        y: 33.4,
        layer: 0,
        count: 3,
        area: '村庄',
        enArea: 'Village',
        note: '蓝门村庄梯田花坛与后院草地。',
      },
    ],
    'plant-moss': [
      {
        x: 33.5,
        y: 46.1,
        layer: 0,
        count: 4,
        area: '复仇者林地',
        enArea: "Trapper's Glade",
        note: '复仇者林地潮湿岩石与朽木表面苔藓。',
      },
      {
        x: 37.2,
        y: 45.8,
        layer: 0,
        count: 3,
        area: '森林',
        enArea: 'The Forest',
        note: '森林溪流两岸苔石。',
      },
    ],
  },

  'stella-montis': {
    'plant-mushroom': [
      {
        x: 73.83,
        y: 77.69,
        layer: 0,
        count: 4,
        area: '种子库',
        enArea: 'Seed Vault',
        note: '星辰山底层【种子库 (Seed Vault)】恒湿生物培养架与真菌标本箱。',
      },
      {
        x: 34.6,
        y: 52.4,
        layer: 0,
        count: 3,
        area: '西侧地道',
        enArea: 'Western Tunnel',
        note: '西侧地道潮湿渗水管廊墙角。',
      },
    ],
    'plant-candleberries': [
      {
        x: 73.83,
        y: 77.69,
        layer: 0,
        count: 5,
        area: '种子库',
        enArea: 'Seed Vault',
        note: '星辰山【种子库】寒带植物标本柜与自然补给容器产出烛莓与混合种子。',
      },
      {
        x: 70.11,
        y: 63.58,
        layer: 0,
        count: 4,
        area: '中庭',
        enArea: 'Atrium',
        note: '中央中庭室内生态花坛与自然柳条篮。',
      },
    ],
    'plant-moss': [
      {
        x: 74.5,
        y: 76.8,
        layer: 0,
        count: 4,
        area: '种子库',
        enArea: 'Seed Vault',
        note: '种子库水培实验槽内高产苔藓与种子。',
      },
    ],
  },
}

// ============================================================================
// 3. Explicit Foraging Range Zones per Map & Plant Category (`plantZones`)
//    Used to draw highlighted foraging range circles on TacticalMapDetailView
//    and OverlayMiniRadarMap when a plant filter is enabled or jumped to!
// ============================================================================
export const PLANT_FORAGING_ZONES = {
  'dam-battlegrounds': {
    'plant-lemon': [
      {
        id: 'dam-zone-lemon-dome',
        plantId: 'plant-lemon',
        layer: 0,
        x: 47.5,
        y: 38.4,
        radius: 4.5,
        name: '水培穹顶综合体 · 温室果篮与柠檬培育区',
        enName: 'Hydroponic Dome Lemon & Basket Zone',
      },
    ],
    'plant-apricot': [
      {
        id: 'dam-zone-apricot-redlake',
        plantId: 'plant-apricot',
        layer: 0,
        x: 68.5,
        y: 52.8,
        radius: 4.8,
        name: '红湖阳台与湖心岛 · 野生杏树林采集范围',
        enName: 'Red Lakes Balcony Apricot Grove',
      },
      {
        id: 'dam-zone-apricot-dome',
        plantId: 'plant-apricot',
        layer: 0,
        x: 48.6,
        y: 37.5,
        radius: 3.8,
        name: '水培穹顶综合体 · 温室杏果采集区',
        enName: 'Hydroponic Dome Apricot Zone',
      },
    ],
    'plant-prickly-pear': [
      {
        id: 'dam-zone-pear-power',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 61.6,
        y: 28.0,
        radius: 4.6,
        name: '发电厂综合体北坡 · 干旱山脊仙人掌丛范围',
        enName: 'Power Generation North Ridge Cactus Patch',
      },
      {
        id: 'dam-zone-pear-redlake',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 69.2,
        y: 56.8,
        radius: 4.2,
        name: '红湖阳台与输电塔南坡 · 仙人掌果采集范围',
        enName: 'Red Lakes & Electrical Tower Cactus Patch',
      },
    ],
    'plant-olives': [
      {
        id: 'dam-zone-olives-dome',
        plantId: 'plant-olives',
        layer: 0,
        x: 47.2,
        y: 38.6,
        radius: 4.2,
        name: '水培穹顶综合体 · 柳条果篮与橄榄培育区',
        enName: 'Hydroponic Dome Olives Zone',
      },
    ],
    'plant-mushroom': [
      {
        id: 'dam-zone-mushroom-dome',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 48.3,
        y: 38.2,
        radius: 4.6,
        name: '水培穹顶综合体 · 室内水池与潮湿温室蘑菇高产区',
        enName: 'Hydroponic Dome Pool Mushroom Zone',
      },
      {
        id: 'dam-zone-mushroom-water',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 42.5,
        y: 49.4,
        radius: 3.8,
        name: '水处理控制中心 · 东侧潮湿管道走廊蘑菇区',
        enName: 'Water Treatment Pipe Corridor Mushroom Zone',
      },
      {
        id: 'dam-zone-mushroom-swamp',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 32.6,
        y: 47.2,
        radius: 5.0,
        name: '沼泽南部岗哨与旧战场 · 腐木树干蘑菇带',
        enName: 'South Swamp Outpost & Old Battleground Logs',
      },
    ],
    'plant-great-mullein': [
      {
        id: 'dam-zone-mullein-dome',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 48.5,
        y: 36.4,
        radius: 4.6,
        name: '水培穹顶综合体 · 大毛蕊花密集培育带',
        enName: 'Hydroponic Dome Great Mullein Zone',
      },
      {
        id: 'dam-zone-mullein-swamp',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 34.2,
        y: 45.6,
        radius: 4.8,
        name: '旧战场与沼泽南部岗哨 · 湿地草甸毛蕊花带',
        enName: 'Swamp Meadow Great Mullein Zone',
      },
    ],
    'plant-agave': [
      {
        id: 'dam-zone-agave-pale',
        plantId: 'plant-agave',
        layer: 0,
        x: 35.2,
        y: 31.2,
        radius: 5.4,
        name: '苍白公寓与红宝石宅邸 · 西北山坡龙舌兰高产带',
        enName: 'Pale Apartments & Ruby Residence Agave Slope',
      },
    ],
    'plant-moss': [
      {
        id: 'dam-zone-moss-dome',
        plantId: 'plant-moss',
        layer: 0,
        x: 48.0,
        y: 37.8,
        radius: 4.2,
        name: '水培穹顶综合体 · 水槽苔藓密集采集区',
        enName: 'Hydroponic Dome Moss Zone',
      },
    ],
    'plant-candleberries': [
      {
        id: 'dam-zone-candle-swamp',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 34.4,
        y: 44.8,
        radius: 5.2,
        name: '旧战场与沼泽南部岗哨 · 烛莓灌木高密区',
        enName: 'Old Battleground Candleberry Zone',
      },
      {
        id: 'dam-zone-candle-dome',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 50.8,
        y: 34.0,
        radius: 5.0,
        name: '水培穹顶与西部断桥 · 烛莓灌木带',
        enName: 'Hydroponic Dome & West Bridge Candleberry Zone',
      },
    ],
    'plant-fruit-basket': [
      {
        id: 'dam-zone-basket-dome',
        plantId: 'plant-fruit-basket',
        layer: 0,
        x: 49.2,
        y: 33.8,
        radius: 6.2,
        name: '水培穹顶与西部断桥 · 柳条水果篮核心密集带',
        enName: 'Hydroponic Dome & West Bridge Fruit Basket Cluster',
      },
    ],
  },

  'buried-city': {
    'plant-lemon': [
      {
        id: 'bc-zone-lemon-park',
        plantId: 'plant-lemon',
        layer: 0,
        x: 47.8,
        y: 43.2,
        radius: 4.6,
        name: '马拉诺公园与图书馆 · 柠檬树林采集范围',
        enName: 'Marano Park & Library Lemon Grove',
      },
      {
        id: 'bc-zone-lemon-grandioso',
        plantId: 'plant-lemon',
        layer: 0,
        x: 32.8,
        y: 65.0,
        radius: 3.8,
        name: '奢华公寓庭院 · 柠檬树采集区',
        enName: 'Grandioso Apartments Courtyard Lemon Trees',
      },
      {
        id: 'bc-zone-lemon-santamaria',
        plantId: 'plant-lemon',
        layer: 0,
        x: 51.2,
        y: 68.3,
        radius: 3.2,
        name: '圣玛丽亚住宅区 · 街心柠檬树采集区',
        enName: 'Santa Maria Houses Lemon Trees',
      },
    ],
    'plant-apricot': [
      {
        id: 'bc-zone-apricot-park',
        plantId: 'plant-apricot',
        layer: 0,
        x: 48.0,
        y: 44.1,
        radius: 4.4,
        name: '马拉诺公园 · 中央杏树林核心采集范围',
        enName: 'Marano Park Apricot Grove',
      },
      {
        id: 'bc-zone-apricot-rosa',
        plantId: 'plant-apricot',
        layer: 0,
        x: 53.3,
        y: 73.5,
        radius: 3.8,
        name: '玫瑰广场 · 街心花园杏树带',
        enName: 'Plaza Rosa Apricot Trees',
      },
    ],
    'plant-prickly-pear': [
      {
        id: 'bc-zone-pear-highway',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 33.3,
        y: 77.2,
        radius: 4.8,
        name: '废弃的高速公路营地 · 西南沙丘仙人掌丛范围',
        enName: 'Abandoned Highway Camp Cactus Dunes',
      },
      {
        id: 'bc-zone-pear-south',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 53.5,
        y: 84.8,
        radius: 5.0,
        name: '玫瑰广场南侧外围沙丘 · 仙人掌果密集带',
        enName: 'Southern Outskirts Cactus Belt',
      },
      {
        id: 'bc-zone-pear-dunes',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 71.2,
        y: 34.0,
        radius: 4.6,
        name: '沙丘尽头 · 东北荒漠仙人掌丛范围',
        enName: "Dune's End Desert Cactus Patch",
      },
    ],
    'plant-great-mullein': [
      {
        id: 'bc-zone-mullein-park',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 48.6,
        y: 43.8,
        radius: 4.0,
        name: '马拉诺公园 · 中央花坛毛蕊花区',
        enName: 'Marano Park Great Mullein Flowerbeds',
      },
      {
        id: 'bc-zone-mullein-arbusto',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 64.8,
        y: 59.6,
        radius: 4.6,
        name: '阿布斯托药房与广场 · 药草花箱区',
        enName: 'Piazza Arbusto & Pharmacy Herb Planters',
      },
    ],
    'plant-agave': [
      {
        id: 'bc-zone-agave-dunes',
        plantId: 'plant-agave',
        layer: 0,
        x: 69.2,
        y: 31.5,
        radius: 4.5,
        name: '沙丘尽头 · 荒漠岩石区龙舌兰丛',
        enName: "Dune's End Agave Cluster",
      },
      {
        id: 'bc-zone-agave-highway',
        plantId: 'plant-agave',
        layer: 0,
        x: 30.4,
        y: 75.8,
        radius: 4.0,
        name: '废弃的高速公路营地 · 西南沙坡龙舌兰带',
        enName: 'Abandoned Highway Camp Agave Slope',
      },
    ],
    'plant-candleberries': [
      {
        id: 'bc-zone-candle-park',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 49.5,
        y: 44.8,
        radius: 4.8,
        name: '马拉诺公园与研究所 · 烛莓灌木丛',
        enName: 'Marano Park Candleberry Bushes',
      },
    ],
    'plant-fruit-basket': [
      {
        id: 'bc-zone-basket-north',
        plantId: 'plant-fruit-basket',
        layer: 0,
        x: 36.5,
        y: 22.8,
        radius: 5.5,
        name: '苏杜兰仓库与马拉诺车站 · 柳条水果篮密集区',
        enName: 'Su Durante Warehouses Fruit Basket Zone',
      },
    ],
  },

  spaceport: {
    'plant-lemon': [
      {
        id: 'sp-zone-lemon-staff',
        plantId: 'plant-lemon',
        layer: 0,
        x: 55.0,
        y: 69.8,
        radius: 3.5,
        name: '员工停车场 · 南侧绿植柠檬树区',
        enName: 'Staff Parking Lemon Trees',
      },
      {
        id: 'sp-zone-lemon-carpark',
        plantId: 'plant-lemon',
        layer: 0,
        x: 36.1,
        y: 31.7,
        radius: 3.5,
        name: '航站楼停车场 · 柠檬树采集区',
        enName: 'Car Park Lemon Trees',
      },
    ],
    'plant-apricot': [
      {
        id: 'sp-zone-apricot-east',
        plantId: 'plant-apricot',
        layer: 0,
        x: 67.5,
        y: 52.5,
        radius: 4.8,
        name: '通讯塔与东部平原仓库 · 杏树林采集区',
        enName: 'Communications Tower & East Plains Apricot Trees',
      },
      {
        id: 'sp-zone-apricot-trench',
        plantId: 'plant-apricot',
        layer: 0,
        x: 56.0,
        y: 32.0,
        radius: 4.2,
        name: '壕沟与北壕沟塔 · 杏树采集带',
        enName: 'The Trench Apricot Zone',
      },
    ],
    'plant-prickly-pear': [
      {
        id: 'sp-zone-pear-northwest',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 26.2,
        y: 29.5,
        radius: 5.6,
        name: '燃料库与水塔外围荒漠 · 仙人掌果核心采集带',
        enName: 'Fuel Depot & Water Towers Cactus Perimeter',
      },
      {
        id: 'sp-zone-pear-south',
        plantId: 'plant-prickly-pear',
        layer: 0,
        x: 61.2,
        y: 70.0,
        radius: 4.6,
        name: '员工停车场与服务大楼南侧 · 荒漠仙人掌丛',
        enName: 'Staff Parking South Cactus Patch',
      },
    ],
    'plant-mushroom': [
      {
        id: 'sp-zone-mushroom-hangar',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 63.5,
        y: 36.5,
        radius: 4.0,
        name: '小机库东侧排水沟渠 · 潮湿树皮蘑菇高产带',
        enName: 'Little Hangar East Drainage Ditch Mushrooms',
      },
      {
        id: 'sp-zone-mushroom-trench',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 55.6,
        y: 31.6,
        radius: 4.0,
        name: '北部战壕导流槽 · 阴暗湿壁蘑菇区',
        enName: 'North Trench Shaded Channel Mushrooms',
      },
    ],
    'plant-great-mullein': [
      {
        id: 'sp-zone-mullein-trench',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 57.4,
        y: 33.2,
        radius: 3.8,
        name: '北部壕沟边缘 · 毛蕊花草丛',
        enName: 'The Trench Great Mullein Patch',
      },
    ],
    'plant-agave': [
      {
        id: 'sp-zone-agave-west',
        plantId: 'plant-agave',
        layer: 0,
        x: 25.2,
        y: 31.5,
        radius: 5.4,
        name: '燃料库与水塔西侧荒漠 · 龙舌兰密集区',
        enName: 'Fuel Depot & Water Towers Agave Belt',
      },
      {
        id: 'sp-zone-agave-trench',
        plantId: 'plant-agave',
        layer: 0,
        x: 60.3,
        y: 35.7,
        radius: 4.2,
        name: '壕沟与小机库 · 龙舌兰采集带',
        enName: 'The Trench & Little Hangar Agave Zone',
      },
    ],
    'plant-candleberries': [
      {
        id: 'sp-zone-candle-east',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 68.2,
        y: 54.8,
        radius: 5.2,
        name: '通讯塔与集装箱仓库 · 烛莓灌木高产区',
        enName: 'Communications Tower Candleberry Zone',
      },
    ],
    'plant-fruit-basket': [
      {
        id: 'sp-zone-basket-shipping',
        plantId: 'plant-fruit-basket',
        layer: 0,
        x: 42.0,
        y: 26.8,
        radius: 4.8,
        name: '货运仓库 · 柳条水果篮超高密刷新区',
        enName: 'Shipping Warehouse Fruit Basket Cluster',
      },
    ],
  },

  'blue-gate': {
    'plant-lemon': [
      {
        id: 'bg-zone-lemon-grove',
        plantId: 'plant-lemon',
        layer: 0,
        x: 45.8,
        y: 64.6,
        radius: 4.8,
        name: '橄榄树林与废弃农庄 · 柠檬树核心高产区（踢树/拾取）',
        enName: 'Olive Grove & Ruined Homestead Lemon Orchard',
      },
      {
        id: 'bg-zone-lemon-village',
        plantId: 'plant-lemon',
        layer: 0,
        x: 35.5,
        y: 33.1,
        radius: 4.0,
        name: '蓝门村庄 · 梯田柠檬树林采集区',
        enName: 'Blue Gate Village Lemon Trees',
      },
      {
        id: 'bg-zone-lemon-wreckage',
        plantId: 'plant-lemon',
        layer: 0,
        x: 35.0,
        y: 52.4,
        radius: 3.0,
        name: '庄严残骸 · 柠檬果树点位',
        enName: 'Adorned Wreckage Lemon Trees',
      },
    ],
    'plant-apricot': [
      {
        id: 'bg-zone-apricot-grove',
        plantId: 'plant-apricot',
        layer: 0,
        x: 44.8,
        y: 63.9,
        radius: 4.4,
        name: '橄榄树林与废弃农庄 · 杏树果园采集范围',
        enName: 'Olive Grove & Ruined Homestead Apricot Orchard',
      },
      {
        id: 'bg-zone-apricot-village',
        plantId: 'plant-apricot',
        layer: 0,
        x: 36.3,
        y: 33.2,
        radius: 3.8,
        name: '蓝门村庄 · 北坡杏树林采集范围',
        enName: 'Blue Gate Village Apricot Trees',
      },
    ],
    'plant-olives': [
      {
        id: 'bg-zone-olives-grove',
        plantId: 'plant-olives',
        layer: 0,
        x: 44.1,
        y: 65.2,
        radius: 4.8,
        name: '橄榄树林 (Olive Grove) · 全游最高产橄榄核心区',
        enName: 'Olive Grove Core Harvesting Zone',
      },
      {
        id: 'bg-zone-olives-refuge',
        plantId: 'plant-olives',
        layer: 0,
        x: 35.5,
        y: 35.2,
        radius: 3.8,
        name: '奇袭者避难所与村庄 · 古橄榄树群',
        enName: "Raider's Refuge & Village Olive Trees",
      },
    ],
    'plant-mushroom': [
      {
        id: 'bg-zone-mushroom-glade',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 33.2,
        y: 45.2,
        radius: 4.8,
        name: '复仇者林地与森林 · 阴湿腐木蘑菇采集区',
        enName: "Trapper's Glade & Forest Mushroom Logs",
      },
    ],
    'plant-great-mullein': [
      {
        id: 'bg-zone-mullein-grove',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 45.8,
        y: 61.2,
        radius: 4.6,
        name: '橄榄树林与农田 · 田埂大毛蕊花带',
        enName: 'Olive Grove & Farmlands Great Mullein Belt',
      },
      {
        id: 'bg-zone-mullein-glade',
        plantId: 'plant-great-mullein',
        layer: 0,
        x: 35.4,
        y: 44.2,
        radius: 3.8,
        name: '复仇者林地 · 林间草药区',
        enName: "Trapper's Glade Herb Clearing",
      },
    ],
    'plant-moss': [
      {
        id: 'bg-zone-moss-glade',
        plantId: 'plant-moss',
        layer: 0,
        x: 35.2,
        y: 45.9,
        radius: 4.0,
        name: '复仇者林地与森林 · 溪谷苔藓采集区',
        enName: "Trapper's Glade Moss Zone",
      },
    ],
    'plant-candleberries': [
      {
        id: 'bg-zone-candle-west',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 28.8,
        y: 43.8,
        radius: 5.5,
        name: '荒芜空地与复仇者林地 · 烛莓灌木密集带',
        enName: 'Barren Clearing & Glade Candleberry Zone',
      },
    ],
    'plant-fruit-basket': [
      {
        id: 'bg-zone-basket-homestead',
        plantId: 'plant-fruit-basket',
        layer: 0,
        x: 45.6,
        y: 64.5,
        radius: 4.8,
        name: '废弃农庄与橄榄树林 · 柳条水果篮高产区',
        enName: 'Ruined Homestead & Olive Grove Fruit Baskets',
      },
    ],
  },

  'stella-montis': {
    'plant-mushroom': [
      {
        id: 'sm-zone-mushroom-seedvault',
        plantId: 'plant-mushroom',
        layer: 0,
        x: 73.83,
        y: 77.69,
        radius: 4.2,
        name: '种子库 (Seed Vault) · 恒湿真菌培养室',
        enName: 'Seed Vault Fungal Culture Zone',
      },
    ],
    'plant-candleberries': [
      {
        id: 'sm-zone-candle-seedvault',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 73.83,
        y: 77.69,
        radius: 4.5,
        name: '种子库与中庭 · 寒带植物标本与烛莓补给区',
        enName: 'Seed Vault & Atrium Botanical Supply Zone',
      },
    ],
    'plant-moss': [
      {
        id: 'sm-zone-moss-seedvault',
        plantId: 'plant-moss',
        layer: 0,
        x: 74.2,
        y: 77.2,
        radius: 3.8,
        name: '种子库 · 水培苔藓培养槽',
        enName: 'Seed Vault Moss Culture Tanks',
      },
    ],
    'plant-fruit-basket': [
      {
        id: 'sm-zone-basket-archives',
        plantId: 'plant-fruit-basket',
        layer: 0,
        x: 78.5,
        y: 60.2,
        radius: 6.0,
        name: '文化档案馆与中庭 · 室内自然水果篮区',
        enName: 'Cultural Archives & Atrium Fruit Baskets',
      },
    ],
  },

  'riven-tides': {
    'plant-apricot': [
      {
        id: 'rt-zone-apricot-riverbed',
        plantId: 'plant-apricot',
        layer: 0,
        x: 39.6,
        y: 75.0,
        radius: 3.8,
        name: '干涸河床 · 杏树采集区',
        enName: 'Dried Riverbed Apricot Trees',
      },
    ],
    'plant-agave': [
      {
        id: 'rt-zone-agave-beach',
        plantId: 'plant-agave',
        layer: 0,
        x: 21.5,
        y: 59.5,
        radius: 6.5,
        name: '蔚蓝海滩、泳池区与网球场 · 海岸龙舌兰高产带',
        enName: 'Azzurro Beach & Poolside Agave Belt',
      },
      {
        id: 'rt-zone-agave-riverbed',
        plantId: 'plant-agave',
        layer: 0,
        x: 38.7,
        y: 74.1,
        radius: 4.0,
        name: '干涸河床 · 龙舌兰滩涂',
        enName: 'Dried Riverbed Agave Cluster',
      },
    ],
    'plant-fruit-basket': [
      {
        id: 'rt-zone-basket-port',
        plantId: 'plant-fruit-basket',
        layer: 0,
        x: 44.5,
        y: 41.5,
        radius: 5.5,
        name: '港务局大楼与海岸 · 柳条水果篮刷新区',
        enName: 'Port Authority Fruit Basket Zone',
      },
    ],
  },

  'pendola-pass': {
    'plant-candleberries': [
      {
        id: 'pp-zone-candle-north-river',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 54.6,
        y: 35.0,
        radius: 6.0,
        name: '冰封河谷北段与研究员住所区 · 极寒烛莓灌木核心高产带',
        enName: 'Northern Frozen River & Researcher Lodgings Candleberries',
      },
      {
        id: 'pp-zone-candle-south-river',
        plantId: 'plant-candleberries',
        layer: 0,
        x: 59.5,
        y: 70.2,
        radius: 6.5,
        name: '冰封河谷南段、交通隧道与军需超市 · 烛莓灌木采集带',
        enName: 'Southern Frozen River & Transit Tunnel Candleberries',
      },
    ],
  },
}

// ============================================================================
// 4. Build Plant Markers & Zones for a Map (`buildPlantMarkersForMap`)
// ============================================================================
const RAW_PLANT_TYPE_TO_CATEGORY_ID = {
  '柠檬树 (Lemon)': 'plant-lemon',
  '杏树 (Apricot)': 'plant-apricot',
  '橄榄树 (Olive)': 'plant-olives',
  '龙舌兰 (Agave)': 'plant-agave',
  '烛莓灌木 (Candleberries)': 'plant-candleberries',
}

export function buildPlantMarkersForMap(map) {
  const mapActors = verifiedActors[map.id] || {}
  const suppByPlant = SUPPLEMENTAL_PLANT_SPAWNS[map.id] || {}
  const byCategory = {}

  for (const cat of PLANT_CATEGORIES) {
    byCategory[cat.id] = []
  }

  // 1. Add UE5-extracted plant clusters from verifiedMapActors.json
  for (const p of mapActors.plants || []) {
    const catId = RAW_PLANT_TYPE_TO_CATEGORY_ID[p.plantType]
    if (!catId) continue
    const cat = PLANT_CATEGORIES_BY_ID[catId]
    const idx = byCategory[catId].length + 1
    byCategory[catId].push({
      id: `${map.shortPrefix || map.id}-${catId}-${pad2(idx)}`,
      plantId: catId,
      kind: 'plant-cluster',
      layer: p.layer || 0,
      x: p.x,
      y: p.y,
      count: p.count || 1,
      area: p.area,
      enArea: p.enArea,
      worldCoord: p.wx !== undefined ? { x: p.wx, y: p.wy, z: p.wz } : undefined,
      title: `${cat.name} (${cat.enName}) ×${p.count || 1} · ${p.area}`,
      enTitle: `${p.plantEn || cat.enName} (×${p.count || 1}) — ${p.enArea}`,
      subLabel: `${p.area} · 实测集群 (${p.count || 1}株)`,
      badgeText: `${cat.shortName}×${p.count || 1}`,
      icon: cat.icon,
      accent: cat.accent,
      desc: `UE5 关卡实测【${cat.name} (${cat.enName})】生长点（位于${p.area}，该点位簇拥约 ${p.count || 1} 株可交互植株）。${cat.summary}`,
      lootHint: cat.scrappyUse,
    })
  }

  // 2. Add supplemental verified spawns (Prickly Pear, Mushroom, Great Mullein, Moss, etc.)
  for (const [catId, list] of Object.entries(suppByPlant)) {
    const cat = PLANT_CATEGORIES_BY_ID[catId]
    if (!cat) continue
    for (const s of list) {
      const idx = byCategory[catId].length + 1
      byCategory[catId].push({
        id: `${map.shortPrefix || map.id}-${catId}-${pad2(idx)}`,
        plantId: catId,
        kind: 'plant-cluster',
        layer: s.layer || 0,
        x: s.x,
        y: s.y,
        count: s.count || 1,
        area: s.area,
        enArea: s.enArea,
        title: `${cat.name} (${cat.enName}) ×${s.count || 1} · ${s.area}`,
        enTitle: `${cat.enName} (×${s.count || 1}) — ${s.enArea}`,
        subLabel: `${s.area} · 高频采集点 (约${s.count || 1}处)`,
        badgeText: `${cat.shortName}×${s.count || 1}`,
        icon: cat.icon,
        accent: cat.accent,
        desc: s.note || `${s.area}周边的【${cat.name} (${cat.enName})】固定采集点。${cat.summary}`,
        lootHint: cat.scrappyUse,
      })
    }
  }

  // 3. Add UE5-extracted Wicker Fruit Baskets from verifiedMapActors.json
  const basketCat = PLANT_CATEGORIES_BY_ID['plant-fruit-basket']
  ;(mapActors.fruitBaskets || []).forEach((b, i) => {
    byCategory['plant-fruit-basket'].push({
      id: `${map.shortPrefix || map.id}-plant-fruit-basket-${pad2(i + 1)}`,
      plantId: 'plant-fruit-basket',
      kind: 'plant-cluster',
      layer: b.layer || 0,
      x: b.x,
      y: b.y,
      count: b.count || 1,
      area: b.area,
      enArea: b.enArea,
      worldCoord: b.wx !== undefined ? { x: b.wx, y: b.wy, z: b.wz } : undefined,
      title: `柳条水果篮 (Fruit Basket) ×${b.count} · ${b.area}`,
      enTitle: `Wicker Fruit Basket Cluster (×${b.count}) — ${b.enArea}`,
      subLabel: `BP_NatureLoot_Basket_C · ${b.area} (${b.count}处候选点)`,
      badgeText: `果篮×${b.count}`,
      icon: basketCat.icon,
      accent: basketCat.accent,
      desc: `UE5 关卡实测柳条水果篮集群（位于${b.area}，含 ${b.count} 处刷点）。开启单个水果篮可一次性获得柠檬、杏子、橄榄、仙人掌果与蘑菇！`,
      lootHint: basketCat.scrappyUse,
    })
  })

  return byCategory
}

export function buildPlantZonesForMap(map) {
  return PLANT_FORAGING_ZONES[map.id] || {}
}

// ============================================================================
// 5. CLI Runner: Update src/data/mapsWikiData.json & src/data/questResourcesData.json
// ============================================================================
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  // 5A. Update mapsWikiData.json
  const mapsWikiPath = path.join(ROOT, 'src/data/mapsWikiData.json')
  const mapsWiki = JSON.parse(fs.readFileSync(mapsWikiPath, 'utf8'))

  mapsWiki.plantCategories = PLANT_CATEGORIES
  let totalPlantMarkers = 0
  let totalPlantZones = 0
  for (const m of mapsWiki.maps || []) {
    m.plantMarkers = buildPlantMarkersForMap(m)
    m.plantZones = buildPlantZonesForMap(m)
    for (const arr of Object.values(m.plantMarkers)) totalPlantMarkers += arr.length
    for (const arr of Object.values(m.plantZones)) totalPlantZones += arr.length
  }

  fs.writeFileSync(mapsWikiPath, JSON.stringify(mapsWiki, null, 2), 'utf8')
  console.log(
    `Updated src/data/mapsWikiData.json: ${PLANT_CATEGORIES.length} plantCategories, ${totalPlantMarkers} plantMarkers, ${totalPlantZones} plantZones`,
  )

  // 5B. Update questResourcesData.json so all Scrappy & Workbench mapLinks match official POI names
  //     and include plantId + radius for range annotation!
  const qrPath = path.join(ROOT, 'src/data/questResourcesData.json')
  const qr = JSON.parse(fs.readFileSync(qrPath, 'utf8'))

  // Official POI Name Normalization Table per mapId
  const POI_FIX_BY_MAP = {
    'dam-battlegrounds': {
      水坝主体: '大坝',
      发电建筑群: '发电厂综合体',
      研究与行政中心: '研究与行政区',
      测试附属楼: '测试附楼',
      水培圆顶建筑群: '水培穹顶综合体',
      住宅区: '苍白公寓',
    },
    'buried-city': {
      地铁站: '南站地铁楼梯口',
      广场公寓: '奢华公寓',
      南部车站: '废弃的高速公路营地',
      外围荒漠: '沙丘尽头',
      大酒店: '奢华公寓',
    },
    spaceport: {
      火箭组装厂: '火箭组装区',
      发射台: '发射塔',
      中央机库: '维护区机库',
      通信塔: '通讯塔',
      地下通道: '发射塔地下维护管网',
      车辆维护区: '载具维护区',
      外围荒漠: '燃料库',
    },
    'blue-gate': {
      橄榄林: '橄榄树林',
      要塞: '古代要塞',
      护卫舰航线: '检查站',
    },
    'stella-montis': {
      实验室: '医学研究部',
      服务器机房: '文化档案馆主机后勤室',
      高山区域: '种子库',
    },
    'pendola-pass': {
      铁路调车场: '铁路站场',
      山顶观测站: '晴空天文台',
      观测站: '晴空天文台',
      水泵站: '管控接收站',
    },
  }

  // Normalize all station material mapLinks first & attach plant mapLinks to recipe ingredients
  const PLANT_INGREDIENT_LINKS = {
    'Great Mullein': [
      {
        mapId: 'dam-battlegrounds',
        mapName: '大坝战场',
        poiName: '水培穹顶综合体',
        plantId: 'plant-great-mullein',
        radius: 4.6,
        label: '大坝战场 · 水培穹顶综合体大毛蕊花带（标注范围）',
      },
      {
        mapId: 'buried-city',
        mapName: '掩埋废城',
        poiName: '马拉诺公园',
        plantId: 'plant-great-mullein',
        radius: 4.0,
        label: '掩埋废城 · 马拉诺公园与阿布斯托药房（标注范围）',
      },
      {
        mapId: 'blue-gate',
        mapName: '蓝门',
        poiName: '橄榄树林',
        plantId: 'plant-great-mullein',
        radius: 4.6,
        label: '蓝门 · 橄榄树林与农田毛蕊花带（标注范围）',
      },
    ],
    Moss: [
      {
        mapId: 'dam-battlegrounds',
        mapName: '大坝战场',
        poiName: '水培穹顶综合体',
        plantId: 'plant-moss',
        radius: 4.2,
        label: '大坝战场 · 水培穹顶水槽与沼泽苔藓区（标注范围）',
      },
      {
        mapId: 'blue-gate',
        mapName: '蓝门',
        poiName: '复仇者林地',
        plantId: 'plant-moss',
        radius: 4.0,
        label: '蓝门 · 复仇者林地潮湿岩石苔藓（标注范围）',
      },
      {
        mapId: 'stella-montis',
        mapName: '星辰山',
        poiName: '种子库',
        plantId: 'plant-moss',
        radius: 3.8,
        label: '星辰山 · 种子库水培苔藓槽（标注范围）',
      },
    ],
  }

  for (const st of qr.workshop?.stations || []) {
    for (const lv of st.levels || []) {
      for (const m of lv.materials || []) {
        for (const lk of m.mapLinks || []) {
          const fixedPoi = POI_FIX_BY_MAP[lk.mapId]?.[lk.poiName]
          if (fixedPoi) lk.poiName = fixedPoi
          if (!lk.radius) lk.radius = 4.5
        }
      }
      const patchRecipeList = (items) => {
        for (const u of items || []) {
          for (const ing of u.recipe || []) {
            if (PLANT_INGREDIENT_LINKS[ing.enName]) {
              ing.mapLinks = PLANT_INGREDIENT_LINKS[ing.enName]
            }
          }
        }
      }
      patchRecipeList(lv.unlocks)
      for (const g of lv.unlockGroups || []) patchRecipeList(g.items)
    }
  }

  // Enrich Scrappy Upgrade Materials (`scrappyLevels`) with exact POIs, plantId & foraging range radius
  const SCRAPPY_MAT_LINKS = {
    'Dog Collar': {
      source: '掩埋废城·圣玛丽亚住宅区/奢华公寓抽屉、大坝战场·苍白公寓与红宝石宅邸储物柜、蓝门·村庄农舍',
      mapLinks: [
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '圣玛丽亚住宅区',
          radius: 4.5,
          label: '掩埋废城 · 圣玛丽亚住宅区与奢华公寓搜刮范围',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '苍白公寓',
          radius: 4.8,
          label: '大坝战场 · 苍白公寓与红宝石宅邸搜刮范围',
        },
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '村庄',
          radius: 4.5,
          label: '蓝门 · 村庄民居室内搜刮范围',
        },
      ],
    },
    Lemon: {
      source: '蓝门·橄榄树林与废弃农庄果树（交互踢树/拾取）、掩埋废城·马拉诺公园与奢华公寓、大坝战场·水培穹顶综合体果篮',
      mapLinks: [
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '橄榄树林',
          plantId: 'plant-lemon',
          radius: 4.8,
          label: '蓝门 · 橄榄树林与废弃农庄柠檬树群（标注范围）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '马拉诺公园',
          plantId: 'plant-lemon',
          radius: 4.6,
          label: '掩埋废城 · 马拉诺公园与奢华公寓柠檬树（标注范围）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '水培穹顶综合体',
          plantId: 'plant-lemon',
          radius: 4.5,
          label: '大坝战场 · 水培穹顶综合体温室与果篮（标注范围）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '员工停车场',
          plantId: 'plant-lemon',
          radius: 3.6,
          label: '太空港 · 员工停车场与北停车场柠檬树（标注范围）',
        },
      ],
    },
    Apricot: {
      source: '掩埋废城·马拉诺公园与玫瑰广场杏树、蓝门·橄榄树林与村庄果园、大坝战场·红湖阳台杏树林',
      mapLinks: [
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '红湖阳台',
          plantId: 'plant-apricot',
          radius: 4.8,
          label: '大坝战场 · 红湖阳台与湖心岛杏树林（标注范围）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '马拉诺公园',
          plantId: 'plant-apricot',
          radius: 4.4,
          label: '掩埋废城 · 马拉诺公园与玫瑰广场杏树林（标注范围）',
        },
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '橄榄树林',
          plantId: 'plant-apricot',
          radius: 4.4,
          label: '蓝门 · 橄榄树林与村庄果园杏树（标注范围）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '通讯塔',
          plantId: 'plant-apricot',
          radius: 4.8,
          label: '太空港 · 通讯塔与北部壕沟杏树带（标注范围）',
        },
      ],
    },
    'Prickly Pear': {
      source: '掩埋废城·废弃的高速公路营地与沙丘尽头仙人掌丛、太空港·燃料库与水塔荒漠仙人掌、大坝战场·发电厂综合体北坡仙人掌下',
      mapLinks: [
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '废弃的高速公路营地',
          plantId: 'plant-prickly-pear',
          radius: 4.8,
          label: '掩埋废城 · 外围沙丘仙人掌丛（标注范围）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '燃料库',
          plantId: 'plant-prickly-pear',
          radius: 5.5,
          label: '太空港 · 燃料库与水塔荒漠仙人掌带（标注范围）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '发电厂综合体',
          plantId: 'plant-prickly-pear',
          radius: 4.6,
          label: '大坝战场 · 发电厂北坡与红湖仙人掌丛（标注范围）',
        },
      ],
    },
    Olives: {
      source: '蓝门·橄榄树林（全游最高产核心区）与奇袭者避难所古橄榄树、大坝战场·水培穹顶综合体柳条果篮',
      mapLinks: [
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '橄榄树林',
          plantId: 'plant-olives',
          radius: 4.8,
          label: '蓝门 · 橄榄树林核心高产果园区（标注范围）',
        },
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '奇袭者避难所',
          plantId: 'plant-olives',
          radius: 3.8,
          label: '蓝门 · 奇袭者避难所与村庄橄榄树群（标注范围）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '水培穹顶综合体',
          plantId: 'plant-olives',
          radius: 4.2,
          label: '大坝战场 · 水培穹顶综合体柳条果篮（标注范围）',
        },
      ],
    },
    'Cat Bed': {
      source: '掩埋废城·奢华公寓与红塔二楼卧室地板、蓝门·村庄住宅与废弃的住宅工程室内',
      mapLinks: [
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '奢华公寓',
          radius: 4.5,
          label: '掩埋废城 · 奢华公寓与红塔卧室搜刮范围',
        },
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '村庄',
          radius: 4.5,
          label: '蓝门 · 村庄住宅室内地板搜刮范围',
        },
      ],
    },
    Mushroom: {
      source: '大坝战场·水培穹顶综合体水池/水处理控制中心潮湿管道/沼泽南部岗哨腐木、太空港·小机库东侧排水沟渠、蓝门·复仇者林地',
      mapLinks: [
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '水培穹顶综合体',
          plantId: 'plant-mushroom',
          radius: 4.6,
          label: '大坝战场 · 水培穹顶水池与温室蘑菇区（标注范围）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '水处理控制中心',
          plantId: 'plant-mushroom',
          radius: 3.8,
          label: '大坝战场 · 水处理控制中心潮湿管道走廊（标注范围）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '小机库',
          plantId: 'plant-mushroom',
          radius: 4.0,
          label: '太空港 · 小机库东侧排水渠与战壕蘑菇带（标注范围）',
        },
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '复仇者林地',
          plantId: 'plant-mushroom',
          radius: 4.8,
          label: '蓝门 · 复仇者林地与森林腐木蘑菇区（标注范围）',
        },
      ],
    },
    'Very Comfortable Pillow': {
      source: '掩埋废城·奢华公寓与圣玛丽亚住宅区床铺、裂潮镇·蔚蓝全景酒店套房、星辰山·中庭与商务中心休息室沙发',
      mapLinks: [
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '奢华公寓',
          radius: 4.5,
          label: '掩埋废城 · 奢华公寓客房床铺搜刮范围',
        },
        {
          mapId: 'riven-tides',
          mapName: '裂潮镇',
          poiName: '蔚蓝全景酒店',
          radius: 4.5,
          label: '裂潮镇 · 蔚蓝全景酒店套房床铺搜刮范围',
        },
        {
          mapId: 'stella-montis',
          mapName: '星辰山',
          poiName: '中庭',
          radius: 4.2,
          label: '星辰山 · 中庭与商务中心休息室搜刮范围',
        },
      ],
    },
  }

  for (const lv of qr.workshop?.scrappyLevels || []) {
    for (const m of lv.materials || []) {
      const spec = SCRAPPY_MAT_LINKS[m.enName]
      if (spec) {
        m.source = spec.source
        m.mapLinks = spec.mapLinks
      }
    }
  }

  // Enrich Scrappy Feeder Foods (`scrappyFeeder.foods`) with exact POIs, plantId & foraging range radius
  const FEEDER_FOOD_LINKS = {
    'feeder-fruit-mix': {
      mapLinks: [
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '橄榄树林',
          plantId: 'plant-lemon,plant-apricot,plant-fruit-basket',
          radius: 4.8,
          label: '蓝门 · 橄榄树林采集柠檬+杏子+柳条果篮（标注范围）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '马拉诺公园',
          plantId: 'plant-lemon,plant-apricot,plant-prickly-pear',
          radius: 4.6,
          label: '掩埋废城 · 马拉诺公园果树与外围仙人掌果（标注范围）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '水培穹顶综合体',
          plantId: 'plant-fruit-basket,plant-lemon,plant-apricot',
          radius: 5.5,
          label: '大坝战场 · 水培穹顶综合体柳条水果篮集群（标注范围）',
        },
      ],
    },
    'feeder-candleberries': {
      obtainMethod: '彭多拉山口·冰封河谷与研究员住所区寒带灌木丛、大坝战场·旧战场与水培穹顶灌木、星辰山·种子库采集',
      mapLinks: [
        {
          mapId: 'pendola-pass',
          mapName: '彭多拉山口',
          poiName: '冰封河',
          plantId: 'plant-candleberries',
          radius: 6.0,
          label: '彭多拉山口 · 冰封河谷北/南段烛莓灌木带（标注范围）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '旧战场',
          plantId: 'plant-candleberries',
          radius: 5.2,
          label: '大坝战场 · 旧战场与水培穹顶烛莓灌木群（标注范围）',
        },
        {
          mapId: 'stella-montis',
          mapName: '星辰山',
          poiName: '种子库',
          plantId: 'plant-candleberries',
          radius: 4.5,
          label: '星辰山 · 种子库寒带植栽箱与自然容器（标注范围）',
        },
      ],
    },
    'feeder-apricot': {
      obtainMethod: '大坝战场·红湖阳台杏树林、掩埋废城·马拉诺公园杏树、蓝门·橄榄树林与村庄果园采集',
      mapLinks: SCRAPPY_MAT_LINKS.Apricot.mapLinks,
    },
    'feeder-agave': {
      obtainMethod: '大坝战场·苍白公寓西坡、裂潮镇·蔚蓝海滩与泳池区、太空港·水塔与燃料库荒漠、掩埋废城·沙丘尽头采集',
      mapLinks: [
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '苍白公寓',
          plantId: 'plant-agave',
          radius: 5.4,
          label: '大坝战场 · 苍白公寓与红宝石宅邸龙舌兰高产坡（标注范围）',
        },
        {
          mapId: 'riven-tides',
          mapName: '裂潮镇',
          poiName: '蔚蓝海滩',
          plantId: 'plant-agave',
          radius: 6.5,
          label: '裂潮镇 · 蔚蓝海滩与泳池区海岸龙舌兰带（标注范围）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '水塔',
          plantId: 'plant-agave',
          radius: 5.4,
          label: '太空港 · 水塔与燃料库西侧荒漠龙舌兰（标注范围）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '沙丘尽头',
          plantId: 'plant-agave',
          radius: 4.5,
          label: '掩埋废城 · 沙丘尽头荒漠岩石区龙舌兰丛（标注范围）',
        },
      ],
    },
    'feeder-mushroom': {
      obtainMethod: SCRAPPY_MAT_LINKS.Mushroom.source,
      mapLinks: SCRAPPY_MAT_LINKS.Mushroom.mapLinks,
    },
    'feeder-lemon': {
      obtainMethod: SCRAPPY_MAT_LINKS.Lemon.source,
      mapLinks: SCRAPPY_MAT_LINKS.Lemon.mapLinks,
    },
    'feeder-olives': {
      obtainMethod: SCRAPPY_MAT_LINKS.Olives.source,
      mapLinks: SCRAPPY_MAT_LINKS.Olives.mapLinks,
    },
    'feeder-prickly-pear': {
      obtainMethod: SCRAPPY_MAT_LINKS['Prickly Pear'].source,
      mapLinks: SCRAPPY_MAT_LINKS['Prickly Pear'].mapLinks,
    },
  }

  for (const food of qr.workshop?.scrappyFeeder?.foods || []) {
    const spec = FEEDER_FOOD_LINKS[food.id]
    if (spec) {
      if (spec.obtainMethod) food.obtainMethod = spec.obtainMethod
      food.mapLinks = spec.mapLinks
    }
    if (Array.isArray(food.craftRecipe)) {
      for (const ing of food.craftRecipe) {
        if (ing.enName === 'Lemon') {
          ing.feederFoodId = 'feeder-lemon'
          ing.mapLinks = SCRAPPY_MAT_LINKS.Lemon.mapLinks
        } else if (ing.enName === 'Apricot') {
          ing.feederFoodId = 'feeder-apricot'
          ing.mapLinks = SCRAPPY_MAT_LINKS.Apricot.mapLinks
        } else if (ing.enName === 'Prickly Pear') {
          ing.feederFoodId = 'feeder-prickly-pear'
          ing.mapLinks = SCRAPPY_MAT_LINKS['Prickly Pear'].mapLinks
        }
      }
    }
  }

  fs.writeFileSync(qrPath, JSON.stringify(qr, null, 2), 'utf8')
  console.log('Updated src/data/questResourcesData.json with verified POI names, plantIds, and foraging range radii')
}
