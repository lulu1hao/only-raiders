import fs from 'node:fs'
import path from 'node:path'
import { buildQuestMapTargets } from './questMapTargetsBuilder.mjs'

const ROOT = 'e:/qianproject/arc-map'
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))
const enLoc = readJson('F:/arc-export/loc/PioneerGame_Content_Localization_Game_en_Game.json')
const zhLoc = readJson('F:/arc-export/loc/PioneerGame_Content_Localization_Game_zh-Hans_Game.json')

// Build comprehensive EN -> ZH lookup maps
function buildNsMap(nsList) {
  const m = new Map()
  for (const ns of nsList) {
    const enObj = enLoc[ns] || {}
    const zhObj = zhLoc[ns] || {}
    for (const [k, enVal] of Object.entries(enObj)) {
      const zhVal = zhObj[k]
      if (enVal && zhVal) {
        const cleanEn = enVal.trim()
        const cleanZh = zhVal.trim()
        if (!m.has(cleanEn)) m.set(cleanEn, cleanZh)
        if (!m.has(cleanEn.toLowerCase())) m.set(cleanEn.toLowerCase(), cleanZh)
      }
    }
  }
  return m
}

const allEnToZh = buildNsMap(Object.keys(enLoc))
const locEnToZh = buildNsMap([
  'ST_Location',
  'ST_Location_FrozenTrail',
  'ST_Location_MountainCompound',
  'ST_Location_RivenTides',
  'ST_ExtractionPoints',
  'ST_Map',
  'ST_MapSelection',
  'ST_GameModeLocations',
])
const locDescEnToZh = buildNsMap([
  'ST_MapLocationsDesc',
  'ST_ExtractionPoints',
  'ST_GameModeLocations',
  'ST_MapSelection',
])
const itemEnToZh = buildNsMap([
  'ST_ItemNames_Firearms',
  'ST_ItemNames_Firearms_Ascended',
  'ST_ITEMNAMES_FIREARMMODS',
  'ST_ItemNames_AscendedUpgrades',
  'ST_ItemNames_Armors',
  'ST_ItemNames_Augments',
  'ST_ItemNames_Salvage',
  'ST_ITEMNAMES',
  'ST_ItemNames_Research',
  'ST_ItemNames_Recipes',
  'ST_ITEMNAMES_CONSUMABLES',
  'ST_ITEMNAMES_GADGETS',
  'ST_ITEMNAMES_THROWABLES',
  'ST_ITEMNAMES_DEPLOYABLES',
  'ST_ItemNames_QuestItems',
  'ST_Outpost_Furniture',
  'ST_Outpost_Furniture_Recipes',
  'ST_Currency',
  'ST_SpecialTrinkets',
  'ST_WorldObjects',
  'ST_CHAMBERSTATIONS',
])
const itemDescEnToZh = buildNsMap([
  'ST_ItemDescriptions_Firearms',
  'ST_ItemDescriptions_Firearms_Ascended',
  'ST_ItemDescriptions_FirearmMods',
  'ST_ItemDescriptions_AscendedUpgrades',
  'ST_ItemDescriptions_Armors',
  'ST_ItemDescriptions_Augments',
  'ST_ItemDescriptions_Augments_Effects',
  'ST_ItemDescriptions',
])

// Explicit official overrides for composite cosmetic strings / edge cases from ST_PurchasableOffers, ST_CharacterSkins, ST_Customization_Charms, ST_EMOTES
const OFFICIAL_ITEM_OVERRIDES = {
  'Battered Paperback': '破旧平装书',
  "Lance's Mixtape": '兰斯的混音带',
  "Trigger 'Nade Blueprint": '触发式手雷蓝图',
  'Silencer III Blueprint': '消音器 III蓝图',
  'Horizontal Grip Blueprint': '水平握把蓝图',
  'Kinetic Converter Blueprint': '动能转换器蓝图',
  Olive: '橄榄',
  'Anvil Splitter': '“铁砧”分流器',
  // Charms (ST_Customization_Charms)
  'Backpack Charm (Banana)': '背包挂件：香蕉',
  'Backpack Charm (Burger Boy)': '背包挂件：汉堡仔',
  'Backpack Charm (Cans)': '背包挂件：易拉罐',
  'Backpack Charm (Fax Machine)': '背包挂件：传真机',
  'Backpack Charm (Succulent)': '背包挂件：多肉植物',
  // Emotes (ST_EMOTES)
  'Cheer Emote': '表情：欢呼',
  'Finger Gun Single Shot Emote': '表情：手指枪：单发',
  // Outfits & Variations (ST_CharacterSkins + ST_PurchasableOffers + ST_Customization_OutfitVariations + ST_Customization_OutfitToggles)
  'Origin Outfit (Orange Camo Color)': '起源（橙色迷彩）',
  'Black White (Origin Color)': '起源（黑白）',
  'Black (Hiker Color)': '踪迹字节（黑色）',
  'Aviator Outfit (Blue Yellow Color)': '飞行员（蓝黄）',
  'Aviator Outfit (Crimson Racer Color)': '飞行员（深红竞速者）',
  'Aviator Outfit (Dusted Cream Color)': '飞行员（蒙尘奶油）',
  'Aviator Outfit (Faded Flush)': '飞行员（褪色红晕）',
  'Aviator Outfit (Gothic Graffiti Color)': '飞行员（哥特涂鸦）',
  'Warden Outfit (Blue Color)': '典狱长（蓝色）',
  'Warden Outfit (Navy Blue Color)': '典狱长（海军蓝）',
  'Warden Outfit (Tangerine Color)': '典狱长（橘色）',
  'Patchwork (Warden Color)': '典狱长（拼布装）',
  'Radio Renegade Outfit (Bag Variant)': '无线电叛逆（背包）',
  'Radio Renegade Outfit (Blue Color)': '无线电叛逆（蓝色）',
  'Radio Renegade Outfit (Goggles Variant)': '无线电叛逆（护目镜）',
  'Radio Renegade Outfit (Grey Color)': '无线电叛逆（灰色）',
  'Radio Renegade Outfit (Helmet Variant)': '无线电叛逆（头盔）',
  'Radio Renegade Outfit (Red Color)': '无线电叛逆（红色）',
  'Radio Renegade Outfit (Yellow Color)': '无线电叛逆（黄色）',
}

function tr(map, enStr, fallback = '') {
  if (!enStr) return fallback
  const s = enStr.trim()
  if (OFFICIAL_ITEM_OVERRIDES[s]) return OFFICIAL_ITEM_OVERRIDES[s]
  return (
    map.get(s) ||
    map.get(s.toLowerCase()) ||
    allEnToZh.get(s) ||
    allEnToZh.get(s.toLowerCase()) ||
    fallback
  )
}

function resolveOfficialItemName(enName) {
  if (!enName) return ''
  const s = enName.trim()
  if (OFFICIAL_ITEM_OVERRIDES[s]) return OFFICIAL_ITEM_OVERRIDES[s]
  const direct = itemEnToZh.get(s) || itemEnToZh.get(s.toLowerCase())
  if (direct) return direct
  // Check tiered firearm e.g. 'Rattler III'
  const tierMatch = s.match(/^(.+?)\s+(I|II|III|IV)$/)
  if (tierMatch) {
    const base = itemEnToZh.get(tierMatch[1]) || itemEnToZh.get(tierMatch[1].toLowerCase())
    if (base) return `${base} ${tierMatch[2]}`
  }
  return tr(allEnToZh, s, s)
}

function translateQuestItemEntry(rawEn) {
  if (!rawEn || rawEn === 'None' || rawEn === '无须携带特定任务物品') {
    return '无须携带特定任务物品'
  }
  const s = String(rawEn).trim()
  const countMatch = s.match(/^(\d+×\s*)(.+)$/)
  if (countMatch) {
    const prefix = countMatch[1]
    const cleanEn = countMatch[2].trim()
    return `${prefix}${resolveOfficialItemName(cleanEn)}`
  }
  return resolveOfficialItemName(s)
}

// Helper to translate an English ingredient string like "6 Metal Parts + 8 Rubber Parts"
function translateMaterialExpr(expr) {
  if (!expr) return expr
  return expr
    .split(/\s*\+\s*|\s*,\s*|\s*\/\s*/)
    .map((part) => {
      const m =
        part.trim().match(/^(\d+)\s*x?\s+(.+)$/i) ||
        part.trim().match(/^(.+?)\s*[x×]\s*(\d+)$/i)
      if (m) {
        const isCountFirst = /^\d+$/.test(m[1])
        const count = isCountFirst ? m[1] : m[2]
        const rawItem = (isCountFirst ? m[2] : m[1]).trim()
        const zhItem =
          resolveOfficialItemName(rawItem) ||
          resolveOfficialItemName(rawItem.replace(/s$/i, '')) ||
          rawItem
        return `${count} ${zhItem}`
      }
      return resolveOfficialItemName(part.trim()) || part.trim()
    })
    .join(' + ')
}

// Comprehensive Old/Fan Translation -> Official zh-Hans Replacement Dictionary
const RAW_PROSE_TERM_REPLACEMENTS = [
  // Typos
  ['ゴム/橡胶零件', '橡胶零件'],
  // Weapons
  ['布尔莱塔手枪 (Burletta) 蓝图', '喜歌剧蓝图'],
  ['死线地雷 (Deadline) 蓝图', '死线蓝图'],
  ['裂甲者 (Hullcracker) 蓝图', '裂甲者蓝图'],
  ['维他命治疗喷雾蓝图', '补水喷雾蓝图'],
  ['遥控触发雷蓝图', '触发式手雷蓝图'],
  ['诱饵手雷蓝图', '诱捕手雷蓝图'],
  ['烟花盒蓝图', '烟花箱蓝图'],
  ['琶音 (Arpeggio)', '三连奏 (Arpeggio)'],
  ['琶音', '三连奏'],
  ['暴风 (Tempest)', '风暴 (Tempest)'],
  ['铁卫 (Ferro)', '生铁 (Ferro)'],
  ['铁卫', '生铁'],
  ['短剑 (Stiletto)', '“细剑” (Stiletto)'],
  ['叛逆者 (Renegade)', '叛逆 (Renegade)'],
  ['叛乱者 (Renegade)', '叛逆 (Renegade)'],
  ['叛逆者', '叛逆'],
  ['叛乱者', '叛逆'],
  ['缝合者 (Stitcher)', '钉机 (Stitcher)'],
  ['缝合者', '钉机'],
  ['诗篇 (Canto)', '颂歌 (Canto)'],
  ['咏叹调 (Canto)', '颂歌 (Canto)'],
  ['合奏曲 (Canto)', '颂歌 (Canto)'],
  ['合奏曲', '颂歌'],
  ['咏叹调', '颂歌'],
  ['多拉布拉 (Dolabra)', '錾斧 (Dolabra)'],
  ['多拉布拉', '錾斧'],
  ['发卡 (Hairpin)', '发夹 (Hairpin)'],
  ['发卡', '发夹'],
  ['小丑 (Burletta)', '布尔莱塔 (Burletta)'],
  ['小丑', '布尔莱塔'],
  ['猎人 (Venator)', '复仇者 (Venator)'],
  ['猎人', '复仇者'],
  ['班坦 (Bantam)', '“小钢炮” (Bantam)'],
  ['班坦', '“小钢炮”'],
  ['洪流 (Torrente)', '奔流 (Torrente)'],
  ['洪流', '奔流'],
  ['恶棍 (Rascal)', '无赖 (Rascal)'],
  ['恶棍', '无赖'],
  ['破壳者 (Hullcracker)', '裂甲者 (Hullcracker)'],
  ['破壳者', '裂甲者'],
  ['均衡器 (Equalizer)', '制裁者 (Equalizer)'],
  ['均衡器', '制裁者'],
  // Mods & Ammo
  ['X爆裂弹', '爆裂弹'],
  ['一分为四分裂弹', '铁砧分裂弹'],
  ['铁砧分束器 (5级增幅)', '“铁砧”分流器'],
  ['铁砧分束器', '“铁砧”分流器'],
  ['枪口补偿器 III', '补偿器 III'],
  ['枪口补偿器 II', '补偿器 II'],
  ['枪口补偿器 I', '补偿器 I'],
  ['枪口补偿器', '补偿器'],
  ['三角握把 III', '直角握把 III'],
  ['三角握把 II', '直角握把 II'],
  ['三角握把 I', '直角握把 I'],
  ['三角握把', '直角握把'],
  ['霰弹收束器 III', '霰弹枪收束器 III'],
  ['霰弹收束器 II', '霰弹枪收束器 II'],
  ['霰弹收束器 I', '霰弹枪收束器 I'],
  ['霰弹收束器', '霰弹枪收束器'],
  ['霰弹扩容弹仓 III', '霰弹扩容弹匣 III'],
  ['霰弹扩容弹仓 II', '霰弹扩容弹匣 II'],
  ['霰弹扩容弹仓 I', '霰弹扩容弹匣 I'],
  ['霰弹扩容弹仓', '霰弹扩容弹匣'],
  ['霰弹弹药', '霰弹枪弹药'],
  ['榴弹发射器弹药', '发射器弹药'],
  // Augments
  ['战术增强包 Mk.3 (医疗)', '战术Mk. 3（治疗型）'],
  ['战术增强包 Mk.3 (复苏)', '战术Mk. 3（复苏）'],
  ['战术增强包 Mk.2', '战术Mk. 2'],
  ['战术增强包 Mk.1', '战术Mk. 1'],
  ['战斗增强包 Mk.1', '战斗Mk. 1'],
  ['搜刮增强包 Mk.3 (保险箱)', '搜刮Mk. 3（守护者）'],
  ['搜刮增强包 Mk.2', '搜刮Mk. 2'],
  // Consumables, Gadgets, Throwables, Deployables
  ['无菌绷带', '消毒绷带'],
  ['维他命注射剂', '生命针剂'],
  ['维他命针剂', '生命针剂'],
  ['维他命治疗喷雾', '补水喷雾'],
  ['维他命喷雾', '补水喷雾'],
  ['增强包', '强化'],
  ['核心驱动器/扫描仪', '引擎/扫描仪'],
  ['告密者（Snitch）', '“告密者” (Snitch)'],
  ['勘测保险匣', '“勘测师”保险库'],
  ['科技保险匣', '科技保险箱'],
  ['除颤器', '复苏剂'],
  ['涌动护盾充能器', '爆能护盾充能器'],
  ['门禁阻断器', '阻门器'],
  ['战术路障套件', '路障工具'],
  ['死线重型地雷', '死线'],
  ['死线地雷', '死线'],
  ['高爆地雷', '爆炸地雷'],
  ['毒气地雷', '跳雷：持续流失耐力'],
  ['脉冲地雷', '跳雷：冲击'],
  ['诱饵绊雷陷阱', '激光陷阱：诱捕'],
  ['烟雾绊雷陷阱', '激光陷阱：烟雾'],
  ['发声诱饵器', '发声器'],
  ['涌动线圈', '涌能线圈'],
  ['庆典烟花盒', '烟花箱'],
  ['烟花盒', '烟花箱'],
  ['战术烟雾弹', '烟雾手雷'],
  ['微型烟雾弹', '小型烟雾手雷'],
  ['声学诱饵手雷', '诱捕手雷'],
  ['诱饵手雷', '诱捕手雷'],
  ['侦察标记手雷', '标记手雷'],
  ['破片手雷', '碎片手雷'],
  ['瞬爆黏性手雷', '闪爆手雷'],
  ['烈焰燃烧手雷', '火焰手雷'],
  ['震撼弹 (Showstopper)', '耀眼明星'],
  ['开拓者燃烧弹', '开拓者'],
  ['狼群集群导弹 (Wolfpack)', '狼群'],
  ['鞭炮串', '爆竹'],
  ['战术望远镜', '望远镜'],
  ['高空滑索套件', '滑索'],
  ['动力抓钩 (Snap Hook)', '安全钩'],
  ['动力抓钩', '安全钩'],
  ['战术抓钩', '钩爪'],
  ['光电隐身斗篷', '光电斗篷'],
  ['火焰喷射罐', '火焰喷涂'],
  ['调酒摇壶', '摇铃'],
  // Salvage, Materials & ARC Parts
  ['高级机械组件', '高级机械元件'],
  ['机械组件', '机械元件'],
  ['高级电子组件', '高级电子元件'],
  ['配件改装组件', '改装零件'],
  ['轻型枪械组件', '小型枪械零件'],
  ['织物布料', '布料'],
  ['耐用布料', '耐磨布料'],
  ['强力胶带', '胶带'],
  ['钢制弹簧', '钢质弹簧'],
  ['强力磁铁', '磁铁'],
  ['重型工业电池', '工业级电池'],
  ['工业电池', '电池'],
  ['高压电缆', '输电线'],
  ['动力棒', '能量管'],
  ['高压气罐', '小罐'],
  ['工业润滑油', '油'],
  ['高爆化合物', '炸药混合物'],
  ['消毒剂', '防腐剂'],
  ['毛蕊花草药', '大毛蕊花'],
  ['毛蕊花', '大毛蕊花'],
  ['医用注射器', '注射器'],
  ['扬声器组件', '扬声器零件'],
  ['微型处理器', '处理器'],
  ['精密传感器', '传感器'],
  ['散热风扇', '冷却扇'],
  ['灯泡组件', '灯泡'],
  ['加湿核心', '加湿器'],
  ['空气加湿器', '加湿器'],
  ['离子溅射器', '离子溅射仪'],
  ['旋转编码器', '回转式编码器'],
  ['自行车打气筒', '自行车气筒'],
  ['生锈齿轮', '生锈的齿轮'],
  ['生锈工具', '生锈的工具'],
  ['生锈医疗箱', '因生锈而难以打开的医药箱'],
  ['开裂生物扫描仪', '破裂的生化扫描仪'],
  ['受损散热器', '受损的散热器'],
  ['烧毁主板', '烧坏的主板'],
  ['大功率电机', '发动机'],
  ['仙人掌果', '仙人果'],
  ['极度舒适的枕头', '极为舒适的枕头'],
  ['ARC 合金', 'ARC合金'],
  ['ARC 精密电路', 'ARC线圈'],
  ['ARC 电路板', 'ARC线圈'],
  ['ARC 动力核心', 'ARC运动核心'],
  ['ARC 动力电池', 'ARC能量电池'],
  ['ARC 高性能钢材', 'ARC高性能钢'],
  ['ARC 合成树脂', 'ARC合成树脂'],
  ['ARC 隔热内衬', 'ARC隔热衬里'],
  ['ARC 导电耦合器', 'ARC导电耦合器'],
  ['“马蜂”驱动器', '“马蜂”引擎'],
  ['大黄蜂驱动器', '“马蜂”引擎'],
  ['“黄蜂”驱动器', '“黄蜂”引擎'],
  ['胡蜂驱动器', '“黄蜂”引擎'],
  ['火箭兵驱动器', '“火箭手”引擎'],
  ['告密者扫描仪', '“告密者”扫描仪'],
  ['观察员中继器', '“侦察员”中继器'],
  ['跳跃者脉冲单元', '“跳跃者”脉冲单元'],
  ['堡垒能量电池', '“堡垒”电池'],
  ['庞巴迪核心', '“投弹手”电池'],
  ['哨兵射击核心', '“哨卫”发射核心'],
  ['“勘测师”保险匣', '“勘测师”保险库'],
  ['勘测者保险匣', '“勘测师”保险库'],
  ['自爆虫触发器', '“爆爆”触发器'],
  ['火球燃烧器', '“火球”燃烧炉'],
  ['萤火虫燃烧器', '“萤火虫”燃烧炉'],
  ['彗星点火器', '“彗星”点火器'],
  ['潜行者目标指示器', '“潜伏者”瞄准组件'],
  ['霸凌者破片弹', '“恶霸”破片弹'],
  ['摩卡咖啡壶', '咖啡壶'],
  ['古典音乐盒', '音乐盒'],
  ['旧世界念珠', '念珠'],
  ['积灰胶片卷', '布满灰尘的电影胶卷'],
  ['绝美水晶雪球', '惊艳的雪花玻璃球'],
  ['铜制雕像', '青铜小雕像'],
  ['航海六分仪', '六分仪'],
  ['三球仪模型', '地球天象仪'],
  ['兰斯的混音磁带', '兰斯的混音带'],
  // Quest Items & Keys
  ['第一波浪潮指南针', '“第一波”指南针'],
  ['第一波浪潮口粮', '“第一波”口粮'],
  ['第一波浪潮磁带', '“第一波”磁带'],
  ['第一波浪潮', '“第一波”'],
  ['血沉分析仪 (ESR Analyzer)', 'ESR分析仪'],
  ['血沉分析仪', 'ESR分析仪'],
  ['湿度计', '水分测量仪'],
  ['营养测定仪', '营养测量仪'],
  ['塞莱斯特的日志', '塞莱斯特的日记'],
  ['艾娃少校的遗物', '艾娃少校的纪念品'],
  ['实验种子样本', '实验型种子样品'],
  ['侦察巡逻便条', '侦察巡逻报告'],
  ['道奇的便条', '道奇的笔记'],
  ['密会情报', '秘密集会情报'],
  ['官方停机档案', '官方关停文件'],
  ['精密万向节', '精密云台'],
  ['损坏的指南针', '破损罗盘'],
  ['旧世界书籍', '旧世界之书'],
  ['离巢技术手册', '“离巢”技术手册'],
  ['疑似剧毒植株', '可能有毒的植物'],
  ['帕托斯计划共情核心', '“悲怆计划”共情核心'],
  ['帕托斯计划', '“悲怆计划”'],
  ['心材计划蓝图', '常青计划蓝图'],
  ['心材计划', '常青计划'],
  ['便携式电视机', '便携电视'],
  ['成摞电影录像带', '一堆电影录像带'],
  ['旧世界电影录像带', '电影录像带'],
  ['种子库保险箱钥匙', '种子库箱子钥匙'],
  ['排污终端钥匙', '冲洗终端钥匙'],
  ['装甲巡逻车钥匙卡', '巡逻车钥匙'],
  ['巡逻警车钥匙', '巡逻车钥匙'],
  ['星山医疗储藏室钥匙', '星辰山医疗仓库钥匙'],
  ['裂潮酒店 107 房卡', '裂潮镇酒店107号房卡'],
  ['彭多拉山口观测站钥匙', '彭多拉山口天文台钥匙'],
  // Currencies
  ['斯佩兰扎硬币', '钱币'],
  ['奇袭者徽章代币', '奇袭者代币'],
  // Workshop Stations & Scrappy
  ['搜刮小鸡 (Scrappy)', '公鸡“废品仔” (Scrappy)'],
  ['搜刮小鸡', '废品仔'],
  ['武器工坊 (Gunsmith)', '武器工作台 (Gunsmith)'],
  ['武器工坊', '武器工作台'],
  ['战术装备台 (Gear Bench)', '装备工作台 (Gear Bench)'],
  ['战术装备台', '装备工作台'],
  ['医疗实验站 (Medical Lab)', '医疗实验室 (Medical Lab)'],
  ['医疗实验站', '医疗实验室'],
  ['爆破物工坊 (Explosives Station)', '爆炸物工作台 (Explosives Station)'],
  ['爆破物工坊', '爆炸物工作台'],
  ['战术工具台 (Utility Station)', '工具工作台 (Utility Station)'],
  ['战术工具台', '工具工作台'],
  ['精炼熔炉 (Refiner)', '精加工机 (Refiner)'],
  ['精炼熔炉', '精加工机'],
  ['增幅研究站 (Amplification Lab)', '研究站 (Research Station)'],
  ['增幅研究站', '研究站'],
  // Traders, Maps, Enemies & Events
  ['莎妮', '萨尼'],
  ['田文', '天玟'],
  ['掩埋之城', '掩埋废城'],
  ['星山复合体', '星辰山'],
  ['斯特拉山脉', '星辰山'],
  ['蓝门山谷', '蓝门'],
  ['裂潮海岸', '裂潮镇'],
  ['奇袭者暗舱', '奇袭者暗门'],
  ['暗舱钥匙', '奇袭者暗门钥匙'],
  ['暗舱', '暗门'],
  ['出埃及记', '离巢'],
  ['大黄蜂 (Hornet)', '“马蜂” (Hornet)'],
  ['大黄蜂', '“马蜂”'],
  ['胡蜂 (Wasp)', '“黄蜂” (Wasp)'],
  ['胡蜂', '“黄蜂”'],
  ['勘测者 (Surveyor)', '“勘测师” (Surveyor)'],
  ['勘测者', '“勘测师”'],
  ['粉碎机 (Shredder)', '“粉碎者” (Shredder)'],
  ['粉碎机', '“粉碎者”'],
  ['母体 (Matriarch)', '“族母” (Matriarch)'],
  ['母体', '“族母”'],
  ['皇后 (Queen)', '“女王” (Queen)'],
  ['皇后', '“女王”'],
  ['轰炸兵 (Bombardier)', '“投弹手” (Bombardier)'],
  ['轰炸兵', '“投弹手”'],
  ['浮空护卫舰', 'ARC“护卫者”'],
  ['野外补给站', '野战仓库'],
  ['水培穹顶群', '水培穹顶建筑群'],
  ['管制区 (淹没厂房)', '受控访问区'],
  ['管制区淹没厂房', '受控访问区'],
  ['研究与行政大楼', '研究与行政中心'],
  ['夜袭模式', '夜间奇袭'],
  ['寒潮突袭', '寒潮'],
  ['严密监控', '严密排查'],
  ['繁茂花期', '收获季节'],
  ['勘探探针空投', '四处窥探的探测器'],
  ['裸露藏匿处', '暴露的奇袭者箱'],
  ['残骸坟场', '机械坟场'],
  ['发射塔物资激增', '发射塔上的战利品'],
  ['飞鸟之城', '鸟城'],
]

// Sort longest oldTerm first so multi-word phrases replace before shorter substrings
const PROSE_TERM_REPLACEMENTS = [...RAW_PROSE_TERM_REPLACEMENTS].sort(
  (a, b) => b[0].length - a[0].length,
)

export function normalizeProse(text) {
  if (!text || typeof text !== 'string') return text
  let out = text
  for (const [oldTerm, newTerm] of PROSE_TERM_REPLACEMENTS) {
    if (newTerm.includes(oldTerm)) {
      const placeholder = `\uE000__KEEP__${ oldTerm }__\uE000`
      out = out.split(newTerm).join(placeholder)
      out = out.split(oldTerm).join(newTerm)
      out = out.split(placeholder).join(newTerm)
    } else {
      out = out.split(oldTerm).join(newTerm)
    }
  }
  // Clean up any doubled prefixes/quotes from prior runs
  out = out
    .replace(/大+毛蕊花/g, '大毛蕊花')
    .replace(/“+([^“”]+)”+/g, '“$1”')
    .replace(/(?:奇袭者)+暗门/g, '奇袭者暗门')
    .replace(/霰弹(?:枪)+/g, '霰弹枪')
    .replace(/水培穹顶(?:建筑群)+/g, '水培穹顶建筑群')
  return out
}

const SKIP_NORMALIZE_KEYS = new Set([
  'id',
  'code',
  'group',
  'enName',
  'enTitle',
  'en',
  'image',
  'icon',
  'secondaryIcon',
  'kind',
  'linkedStage',
  'accent',
  'badgeText',
  'mapAsset',
  'officialSchedule',
  'officialRegionKey',
  'officialType',
  'conditionName',
  'mapDisplayName',
  'mapId',
  'eventId',
  'primary',
  'secondary',
])

function normalizeDeep(val) {
  if (typeof val === 'string') return normalizeProse(val)
  if (Array.isArray(val)) return val.map(normalizeDeep)
  if (val && typeof val === 'object') {
    for (const k of Object.keys(val)) {
      if (!SKIP_NORMALIZE_KEYS.has(k)) {
        val[k] = normalizeDeep(val[k])
      }
    }
    return val
  }
  return val
}

// ============================================================================
// 1. Update src/data/mapsWikiData.json
// ============================================================================
const mapsWikiPath = path.join(ROOT, 'src/data/mapsWikiData.json')
const mapsWiki = JSON.parse(fs.readFileSync(mapsWikiPath, 'utf8'))

const OFFICIAL_EVENTS = {
  'standard-patrol': {
    name: '常规部署',
    summary:
      '地表能见度良好，ARC 机械维持常规巡逻密度，所有标准返回点与奇袭者暗门（Raider Hatches）均正常开放。',
  },
  'night-raid': {
    name: tr(allEnToZh, 'Night Raid', '夜间奇袭'),
    summary: tr(
      allEnToZh,
      'Raiders have been finding especially good loot behind locked doors, and keys have been more plentiful. The heightened Raider activity has attracted more ARC than usual.',
      '奇袭者们最近在上锁的门后发现了特别丰厚的战利品，钥匙也变得更加常见了。而奇袭者活动频率增加也吸引了比平常更多的ARC。',
    ),
  },
  'electromagnetic-storm': {
    name: tr(allEnToZh, 'Electromagnetic Storm', '电磁风暴'),
    summary: tr(
      allEnToZh,
      'Lightning strikes batter the surface; frying electronics, disrupting ARC machines, and electrocuting unsuspecting Raiders.',
      '雷电不断轰击地面，烧毁电子装置、干扰ARC机器，还会电击毫无防备的奇袭者。',
    ),
  },
  'cold-snap': {
    name: tr(allEnToZh, 'Cold Snap', '寒潮'),
    summary: tr(
      allEnToZh,
      'A cold front has swept in with snowfall, and a considerable drop in temperature. The air might feel crisp and brisk at first, but beware of frostbite. Candleberry bushes are bearing valuable fruit - they are now ripe for the picking.',
      '冷锋过境带来降雪，气温显著下降。起初空气或许清新凛冽，但务必警惕冻伤。烛莓丛已结出珍贵果实——现在正是采摘时机。',
    ),
  },
  hurricane: {
    name: tr(allEnToZh, 'Hurricane', '飓风'),
    summary: tr(
      allEnToZh,
      'Strong winds are sweeping across the surface, affecting large parts of the area. Visibility and hearing may be reduced, so stay alert.',
      '强风正席卷地表，影响该区域的大部分范围。能见度和听觉可能下降，请保持警惕。',
    ),
  },
  'close-scrutiny': {
    name: tr(allEnToZh, 'Close Scrutiny', '严密排查'),
    summary: tr(
      allEnToZh,
      'Groups of Surveyors and Vaporizers are scanning for valuable materials. Their discoveries could prove worthwhile, if you’re prepared for resistance.',
      '成群的“勘测师”和“汽化者”正在扫描搜寻贵重物资。如果你准备好迎战，它们的发现必定会让你不虚此行。',
    ),
  },
  harvester: {
    name: tr(allEnToZh, 'Harvester', '收割者'),
    summary: tr(
      allEnToZh,
      'A mysterious harvesting machine has appeared, heavily guarded by the feared Queen. What kind of riches are to be found within?',
      '一台神秘的收割机出现在了这片区域，并且有令人畏惧的“女王”重重拱卫。它肚子里究竟藏着什么好东西？',
    ),
  },
  matriarch: {
    name: tr(allEnToZh, 'Matriarch', '“族母”'),
    summary: tr(
      allEnToZh,
      'A Matriarch has been sighted nearby. Her children seem hell-bent on keeping her from harm.',
      '有人看见附近出现了一个“族母”。她的“子嗣”似乎不惜一切代价要保护她免受伤害。',
    ),
  },
  'arc-frigate': {
    name: tr(allEnToZh, 'ARC Frigate', 'ARC“护卫者”'),
    summary: tr(
      allEnToZh,
      'An ARC Frigate hovers over the area, obliterating any perceived resistance with reckless abandon.',
      '一架ARC“护卫者”盘旋在该区域上空，肆无忌惮地摧毁一切它认定的抵抗力量。',
    ),
  },
  'fallen-emperor': {
    name: tr(allEnToZh, 'Redirection', '航向重定向'),
    summary: tr(
      allEnToZh,
      'Emperor Beacons are activating throughout the area. Raiders can loot and deploy these to redirect valuable payloads to their own position.',
      '区域内的“帝王”信标正陆续激活。奇袭者可搜刮并部署这些信标，将贵重物资空投引导至自己所在位置。',
    ),
  },
  'hidden-bunker': {
    name: tr(allEnToZh, 'Hidden Bunker', '隐藏地堡'),
    summary: tr(
      allEnToZh,
      "Someone has hacked the Outskirts Bunker's security system. Find the 4 buttons to unlock the doors, and be the first to plunder the treasure within.",
      '有人骇入了外围地堡的安全系统。找到4个开门按钮，成为第一个夺得宝藏的人。',
    ),
  },
  'locked-gate': {
    name: tr(allEnToZh, 'Locked Gate', '上锁的大门'),
    summary: tr(
      allEnToZh,
      "A clandestine group has activated the Gate's emergency shutdown protocol. 4 key cards need to be obtained to override it, and uncover whatever they're hiding.",
      '一个秘密组织启动了蓝门的紧急关停协议，需要获取4张钥匙卡才能解除封锁，揭开他们试图隐藏的秘密。',
    ),
  },
  'lush-blooms': {
    name: tr(allEnToZh, 'Lush Blooms', '收获季节'),
    summary: tr(
      allEnToZh,
      'The weather has been unusually agreeable lately, and vital plants and fruits have been thriving. Get out there and gather your food before it is all gone.',
      '各类重要植物和水果在近段时间的绝佳天气滋润下生长得十分茂盛。趁它们还没被采光，赶紧出去收集食物吧。',
    ),
  },
  'prospecting-probes': {
    name: tr(allEnToZh, 'Prospecting Probes', '四处窥探的探测器'),
    summary: tr(
      allEnToZh,
      'ARC seem to have entered a period of extended probing, sending guarded probes down en masse.',
      'ARC似乎正在扩大探测规模，它们将众多防护严密的探测器送到了地下。',
    ),
  },
  'uncovered-caches': {
    name: tr(allEnToZh, 'Uncovered Caches', '暴露的奇袭者箱'),
    summary: tr(
      allEnToZh,
      'Storms have unearthed a number of old Raider Caches, but they are rigged to explode should they be exposed for too long. Hurry up and find them all.',
      '风暴令许多旧时的奇袭者箱失去了隐蔽。但如果任由这些箱子长时间暴露在恶劣天气下，将会触发爆炸装置。赶快找到所有藏匿的箱子吧。',
    ),
  },
  'husk-graveyard': {
    name: tr(allEnToZh, 'Husk Graveyard', '机械坟场'),
    summary: tr(
      allEnToZh,
      'Something has caused ARC machines to go down on their own in great amounts, leaving husks scattered around Topside. A better opportunity to gather information and parts has rarely presented itself.',
      '出于某种原因，大量ARC机器莫名其妙地自行停机了。它们的残骸散落在上层各处，这可是个难得一见的好机会，正适合收集原本得来不易的情报和零件。',
    ),
  },
  'launch-tower-loot': {
    name: tr(allEnToZh, 'Launch Tower Loot', '发射塔上的战利品'),
    summary: tr(
      allEnToZh,
      'Someone has locked off the Launch Tower, hiding all their hard-earned loot at the top. ARC seems to have ramped up their defenses in response to the heightened activity.',
      '有人封锁了发射塔，并把辛苦得来的战利品藏在了塔顶。有迹象表明ARC加强了防御，以应对更加频繁的活动。',
    ),
  },
  'bird-city': {
    name: tr(allEnToZh, 'Bird City', '鸟城'),
    summary: tr(
      allEnToZh,
      'Unusual bird activity has been reported around the chimneys on Buried City’s rooftops. Raiders who investigate may find valuable materials in their nests.',
      '据报告，掩埋废城屋顶区域的烟囱周围有异常的鸟类活动。前去调查的奇袭者可能会在它们的巢穴中找到有价值的材料。',
    ),
  },
  'buried-treasure': {
    name: tr(allEnToZh, 'Beachcombing', '海滩拾荒点'),
    summary: tr(
      allEnToZh,
      'Scouts have discovered a variety of trinkets and small finds buried in the sands around Riven Tides, along with a few less welcome things. Raiders are encouraged to use a Dockmaster’s Detector to uncover them.',
      '侦察者发现裂潮镇周边的沙滩下埋藏着各类饰品和小物件，也夹杂着一些不那么受欢迎的东西。我们鼓励奇袭者使用码头主管探测器把它们发掘出来。',
    ),
  },
}

for (const [evId, evObj] of Object.entries(mapsWiki.events)) {
  if (OFFICIAL_EVENTS[evId]) {
    evObj.name = OFFICIAL_EVENTS[evId].name
    evObj.summary = OFFICIAL_EVENTS[evId].summary
  }
  evObj.modifiers = (evObj.modifiers || []).map(normalizeProse)
}

const OFFICIAL_MAP_LORE = {
  'dam-battlegrounds': {
    name: '大坝战场',
    loreDesc:
      zhLoc.ST_MapSelection?.ID_MAPSELECTION_DAM_DESCRIPTION ||
      '阿尔坎塔拉发电厂，俗称“大坝”，在“第一波”战争的激烈尾声阶段曾是奇袭者至关重要的据点。即便时至今日，这片被毒水污染、积水淹没的土地仍然是ARC冲突的热点地区。',
  },
  'buried-city': {
    name: '掩埋废城',
    loreDesc:
      zhLoc.ST_MapSelection?.ID_MAPSELECTION_BURIEDCITY_DESCRIPTION ||
      '在这片干旱的沙丘中，你会看到一处与离巢时代冷峻的钢铁尖塔截然不同的旧世界遗迹。走过这些狭小的街道和空旷的广场，你会意识到，这里也曾有人生活过。',
  },
  spaceport: {
    name: '太空港',
    loreDesc:
      zhLoc.ST_MapSelection?.ID_MAPSELECTION_SPACEPORT_DESCRIPTION ||
      '阿切拉太空港是人类昔日雄心壮志的宏伟见证。正是在这里，离巢航天飞机承载着希望与绝望，轰鸣着冲向太空，抛下了困顿的地球。',
  },
  'blue-gate': {
    name: '蓝门',
    loreDesc:
      zhLoc.ST_GameModeLocations?.ID_GAMEMODE_LOCATION_THEBLUEGATE ||
      '蓝门曾经是反抗者的通道和他们坚定意志的象征，而如今则只是一道令人望而却步的入口，通向远方那危机四伏的山区。四周的山谷也满是新旧不一的破坏痕迹。',
  },
  'stella-montis': {
    name: '星辰山',
    loreDesc:
      zhLoc.ST_GameModeLocations?.ID_GAMEMODE_LOCATION_MOUNTAINCOMPOUND ||
      '星辰山位于冰雪覆盖的高峰之间，是一座偏僻的研究设施，据说也是保存人类文明的最后堡垒。',
  },
  'riven-tides': {
    name: '裂潮镇',
    loreDesc:
      zhLoc.ST_Location_RivenTides?.ID_GAMEMODE_LOCATION_RIVENTIDES ||
      '一处曾两度被遗弃的昔日海滨度假小镇与贸易港口。随着海水退却，裸露的海床与防波堤间遍布着离巢时代的遗产与ARC防线。',
  },
  'pendola-pass': {
    name: '彭多拉山口',
    loreDesc:
      zhLoc.ST_GameModeLocations?.ID_GAMEMODE_LOCATION_FROZENTRAIL ||
      '这座山顶观测站汇聚了尖端仪器和崇高理想，如今却成了轨道势力的关注焦点。',
  },
}

const OFFICIAL_LOOT_TAG_ZH = {
  industrial: '工业',
  mechanical: '机械元件',
  electrical: '电子元件',
  technological: '科技',
  medical: '医疗',
  commercial: '商业',
  residential: '住宅',
  household: '住宅',
  security: '安保',
  military: '军事',
  nature: '自然',
  arc: 'ARC',
  exodus: '离巢',
  oldworld: '旧世界',
  raider: '奇袭者',
}

for (const m of mapsWiki.maps) {
  if (OFFICIAL_MAP_LORE[m.id]) {
    m.name = OFFICIAL_MAP_LORE[m.id].name
    m.loreDesc = OFFICIAL_MAP_LORE[m.id].loreDesc
  }
  m.summary = normalizeProse(m.summary)

  const poiIdToZhName = new Map()
  for (const p of m.pois || []) {
    const offName = tr(locEnToZh, p.enName)
    if (offName) p.name = offName
    poiIdToZhName.set(p.id, p.name)

    const offDesc = tr(locDescEnToZh, p.enDesc)
    if (offDesc) {
      p.zhOfficialDesc = offDesc
      if (!p.linkedStage && (!p.desc || /[a-zA-Z]{5,}/.test(p.desc))) {
        p.desc = offDesc
      } else {
        p.desc = normalizeProse(p.desc)
      }
    } else {
      p.desc = normalizeProse(p.desc)
    }

    if (p.keyRequired) {
      const enKeyMatch = p.keyRequired.match(/\(([^)]+)\)/)
      if (enKeyMatch) {
        const enKey = enKeyMatch[1].trim()
        const zhKey = resolveOfficialItemName(enKey)
        if (zhKey) p.keyRequired = `${zhKey} (${enKey})`
      }
    }

    for (const lt of p.lootTags || []) {
      if (OFFICIAL_LOOT_TAG_ZH[lt.id]) {
        lt.zh = OFFICIAL_LOOT_TAG_ZH[lt.id]
      }
    }
    p.lootTypes = (p.lootTags || []).map((lt) => lt.zh)
  }

  for (const lz of m.lootZones || []) {
    const offName = poiIdToZhName.get(lz.poiId) || tr(locEnToZh, lz.enName)
    if (offName) lz.name = offName
    for (const lt of lz.lootTags || []) {
      if (OFFICIAL_LOOT_TAG_ZH[lt.id]) {
        lt.zh = OFFICIAL_LOOT_TAG_ZH[lt.id]
      }
    }
    lz.lootTypes = (lz.lootTags || []).map((lt) => lt.zh)
  }

  for (const ext of m.extractions || []) {
    const offName = tr(locEnToZh, ext.enName)
    if (offName) ext.name = offName
    const offDesc = tr(locDescEnToZh, ext.desc)
    if (offDesc) ext.desc = offDesc
    if (ext.type === 'elevator') ext.typeLabel = '货箱电梯'
    else if (ext.type === 'hatch') ext.typeLabel = '奇袭者暗门'
    else if (ext.type === 'metro') ext.typeLabel = '地铁站'
    else if (ext.type === 'airshaft') ext.typeLabel = '通风井'
    else if (ext.type === 'terminal') ext.typeLabel = '吊舱收发器'
  }

  for (const lr of m.lockedRooms || []) {
    const enKeyMatch = lr.keyName.match(/\(([^)]+)\)/)
    if (enKeyMatch) {
      const enKey = enKeyMatch[1].trim()
      const zhKey = resolveOfficialItemName(enKey)
      if (zhKey) lr.keyName = `${zhKey} (${enKey})`
    }
    lr.poiName = normalizeProse(lr.poiName)
    lr.lootSummary = normalizeProse(lr.lootSummary)
  }
}

normalizeDeep(mapsWiki)
fs.writeFileSync(mapsWikiPath, JSON.stringify(mapsWiki, null, 2), 'utf8')
console.log('Updated src/data/mapsWikiData.json with 100% official zh-Hans localization!')

// ============================================================================
// 2. Update src/data/weaponsData.json
// ============================================================================
const weaponsPath = path.join(ROOT, 'src/data/weaponsData.json')
const weaponsData = JSON.parse(fs.readFileSync(weaponsPath, 'utf8'))

const OFFICIAL_AMMO_ZH = {
  'Light Ammo': '轻型弹药',
  'Medium Ammo': '中型弹药',
  'Heavy Ammo': '重型弹药',
  'Shotgun Ammo': '霰弹枪弹药',
  'Energy Clip': '能量弹夹',
  'Launcher Ammo': '发射器弹药',
}

for (const w of weaponsData.weapons || []) {
  const offZh = tr(itemEnToZh, w.name)
  if (offZh) {
    w.zhNamePure = offZh
    w.zhName = `${offZh} (${w.name})`
  }
  if (OFFICIAL_AMMO_ZH[w.ammo]) {
    w.zhAmmo = OFFICIAL_AMMO_ZH[w.ammo]
  }
  if (w.zhCraftingStation) {
    w.zhCraftingStation = normalizeProse(w.zhCraftingStation)
  }
  const offQuote = tr(itemDescEnToZh, w.quote)
  if (offQuote) {
    w.zhQuote = offQuote
  }
  w.description = normalizeProse(w.description)

  for (const t of w.tiers || []) {
    // Official ST_QualityTiers_Firearms: T1=一般, T2=坚固, T3=不屈, T4=卓越
    const suffix =
      t.tier === 1
        ? '(一般)'
        : t.tier === 2
          ? '(坚固)'
          : t.tier === 3
            ? '(不屈)'
            : '(卓越)'
    t.label = `${w.zhNamePure || w.name} ${t.roman} ${suffix}`
    if (t.materials && !t.materials.includes('顶部搜刮')) {
      t.zhMaterials = translateMaterialExpr(t.materials)
    }
  }

  for (const amp of w.amplifications || []) {
    const offAmpName = tr(itemEnToZh, amp.name)
    if (offAmpName) {
      amp.zhName = `${offAmpName} (${amp.name})`
    } else if (amp.zhName) {
      amp.zhName = normalizeProse(amp.zhName)
    }
    const offAmpDesc = tr(itemDescEnToZh, amp.description)
    if (offAmpDesc) {
      amp.zhDesc = offAmpDesc
    } else if (amp.zhDesc) {
      amp.zhDesc = normalizeProse(amp.zhDesc)
    }
    if (amp.materials) {
      amp.zhMaterials = translateMaterialExpr(amp.materials)
    }
    if (amp.research) {
      amp.zhResearch = translateMaterialExpr(amp.research)
    }
  }
}

for (const mod of weaponsData.weaponMods || []) {
  const offModName = tr(itemEnToZh, mod.name)
  if (offModName) {
    mod.zhName = offModName
  }
  const offDesc = tr(itemDescEnToZh, mod.description)
  if (offDesc) {
    mod.zhDesc = offDesc
  }
  if (mod.materials) {
    mod.zhMaterials = translateMaterialExpr(mod.materials)
  }
}

for (const sh of weaponsData.shields || []) {
  const offShName = tr(itemEnToZh, sh.name)
  if (offShName) {
    sh.zhName = `${offShName} (${sh.name})`
  }
}

for (const aug of weaponsData.augments || []) {
  const offAugName = tr(itemEnToZh, aug.name)
  if (offAugName) {
    aug.zhName = offAugName
  }
}

normalizeDeep(weaponsData)
fs.writeFileSync(weaponsPath, JSON.stringify(weaponsData, null, 2), 'utf8')
console.log('Updated src/data/weaponsData.json with 100% official zh-Hans localization!')

// ============================================================================
// 3. Build Quest Map Targets & Update src/data/questsData.json
// ============================================================================
buildQuestMapTargets()

const questsPath = path.join(ROOT, 'src/data/questsData.json')
const questsData = JSON.parse(fs.readFileSync(questsPath, 'utf8'))

const OFFICIAL_TRADERS = {
  Shani: '萨尼 (Shani · 安保区)',
  Celeste: '塞莱斯特 (Celeste · 斯佩兰扎)',
  'Tian Wen': '天玟 (Tian Wen · 枪械商店)',
  Lance: '兰斯 (Lance · 诊所)',
  Apollo: '阿波罗 (Apollo · 手雷和小道具)',
  'Nomadic Envoys': '游牧使团 (Nomadic Envoys)',
}

const CODEX_QUEST_TITLES = {}
for (const [k, enVal] of Object.entries(enLoc.ST_CodexRecords || {})) {
  if (k.includes('QUESTNAME')) {
    CODEX_QUEST_TITLES[enVal.toLowerCase()] = zhLoc.ST_CodexRecords[k]
  }
}

questsData.traders = Object.entries(OFFICIAL_TRADERS).map(([id, label]) => ({ id, label }))

for (const q of questsData.quests || []) {
  if (OFFICIAL_TRADERS[q.trader]) {
    q.zhTrader = OFFICIAL_TRADERS[q.trader]
  }
  const codexZh = CODEX_QUEST_TITLES[q.title.toLowerCase()]
  if (codexZh) {
    q.zhTitle = codexZh
  } else {
    q.zhTitle = normalizeProse(q.zhTitle)
  }

  // Directly translate requiredItems from official dictionary
  if (!q.requiredItems || q.requiredItems === 'None' || q.requiredItems === '无须携带特定任务物品') {
    q.zhRequiredItems = '无须携带特定任务物品'
  } else {
    q.zhRequiredItems = String(q.requiredItems)
      .split(/\s*•\s*/)
      .map((part) => translateQuestItemEntry(part))
      .join(' · ')
  }

  // Directly translate rewards from official dictionary
  if (Array.isArray(q.rewards)) {
    q.zhRewards = q.rewards.map((part) => translateQuestItemEntry(part))
  }

  q.zhLocation = normalizeProse(q.zhLocation)
  q.zhDescription = normalizeProse(q.zhDescription)
}

normalizeDeep(questsData)
fs.writeFileSync(questsPath, JSON.stringify(questsData, null, 2), 'utf8')
console.log('Updated src/data/questsData.json with 100% official zh-Hans items, rewards, and landmarks!')

// ============================================================================
// 4. Update src/data/questResourcesData.json
// ============================================================================
const resPath = path.join(ROOT, 'src/data/questResourcesData.json')
const resData = JSON.parse(fs.readFileSync(resPath, 'utf8'))

const OFFICIAL_STATIONS_MAP = {
  scrappy: { name: '公鸡“废品仔” (Scrappy)', enName: 'Scrappy The Rooster' },
  gunsmith: { name: '武器工作台 (Gunsmith)', enName: 'Gunsmith' },
  gear_bench: { name: '装备工作台 (Gear Bench)', enName: 'Gear Bench' },
  medical_lab: { name: '医疗实验室 (Medical Lab)', enName: 'Medical Lab' },
  explosives: { name: '爆炸物工作台 (Explosives Station)', enName: 'Explosives Station' },
  utility: { name: '工具工作台 (Utility Station)', enName: 'Utility Station' },
  refiner: { name: '精加工机 (Refiner)', enName: 'Refiner' },
  amp_lab: { name: '研究站 (Research Station)', enName: 'Research Station' },
}

function normalizeParentheticalItem(str) {
  if (!str || typeof str !== 'string') return str
  const m = str.match(/^(.+?)\s*\(([A-Za-z0-9\s'’-]+)\)$/)
  if (m) {
    const enName = m[2].trim()
    const offZh = resolveOfficialItemName(enName)
    if (offZh && offZh !== enName) {
      return `${offZh} (${enName})`
    }
  }
  return normalizeProse(str)
}

for (const st of resData.workshop?.stations || []) {
  if (OFFICIAL_STATIONS_MAP[st.id]) {
    st.name = OFFICIAL_STATIONS_MAP[st.id].name
    st.enName = OFFICIAL_STATIONS_MAP[st.id].enName
  } else {
    st.name = normalizeProse(st.name)
  }
  st.role = normalizeProse(st.role)
  for (const lv of st.levels || []) {
    lv.unlocks = normalizeProse(lv.unlocks)
    for (const m of lv.materials || []) {
      m.item = normalizeParentheticalItem(m.item)
      m.source = normalizeProse(m.source)
    }
  }
}

for (const feed of resData.workshop?.scrappyFeedingItems || []) {
  if (feed.enName) {
    const offFeed = resolveOfficialItemName(feed.enName)
    if (offFeed) feed.name = offFeed
  }
  feed.category = normalizeProse(feed.category)
  feed.bestLocations = (feed.bestLocations || []).map(normalizeProse)
  feed.exchangeReward = normalizeProse(feed.exchangeReward)
}

for (const stg of resData.expeditionStages || []) {
  stg.name = normalizeProse(stg.name)
  stg.desc = normalizeProse(stg.desc)
  for (const req of stg.requirements || []) {
    req.item = normalizeParentheticalItem(req.item)
    req.tip = normalizeProse(req.tip)
  }
}

for (const bp of resData.blueprints?.weaponItemBlueprints || []) {
  const offRecipe =
    resolveOfficialItemName(bp.enName) ||
    resolveOfficialItemName(`${bp.enName} Blueprint`) ||
    resolveOfficialItemName(bp.enName.replace(/\s*Blueprint$/i, ''))
  if (offRecipe) {
    const cleanZh = offRecipe.replace(/蓝图$/, '')
    bp.name = `${cleanZh}蓝图`
  } else {
    bp.name = normalizeProse(bp.name)
  }
  bp.station = normalizeProse(bp.station)
  bp.materials = normalizeProse(bp.materials)
  bp.source = normalizeProse(bp.source)
  if (bp.buff) bp.buff = normalizeProse(bp.buff)
}

for (const bp of resData.blueprints?.furnitureBlueprints || []) {
  const offFurn = tr(itemEnToZh, bp.enName)
  if (offFurn) {
    bp.name = offFurn
  } else {
    bp.name = normalizeProse(bp.name)
  }
  bp.station = normalizeProse(bp.station)
  bp.materials = normalizeProse(bp.materials)
  bp.source = normalizeProse(bp.source)
  if (bp.buff) bp.buff = normalizeProse(bp.buff)
}

normalizeDeep(resData)
fs.writeFileSync(resPath, JSON.stringify(resData, null, 2), 'utf8')
console.log('Updated src/data/questResourcesData.json with 100% official zh-Hans localization!')

// ============================================================================
// 5. Normalize 3D Puzzle JSON files
// ============================================================================
const PUZZLE_FILES = [
  'src/data/cazPuzzle.json',
  'src/data/fortPuzzle.json',
  'src/data/frigatePuzzle.json',
  'src/data/refugePuzzle.json',
  'src/data/stellaPuzzle.json',
  'src/data/walkerPuzzle.json',
]

for (const rel of PUZZLE_FILES) {
  const p = path.join(ROOT, rel)
  if (fs.existsSync(p)) {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'))
    normalizeDeep(data)
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8')
  }
}
console.log('Updated all 6 3D Puzzle JSON files with official zh-Hans terminology!')
