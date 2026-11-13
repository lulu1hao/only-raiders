import fs from 'node:fs'
import path from 'node:path'
import {
  buildEventMarkersForMap,
  buildTrialMarkersForMap,
  TRIAL_CATEGORIES,
} from './eventMarkersBuilder.mjs'
import {
  buildPlantMarkersForMap,
  buildPlantZonesForMap,
  PLANT_CATEGORIES,
} from './plantMarkersBuilder.mjs'
import {
  buildEliteArcMarkersForMap,
  buildEliteArcZonesForMap,
  ELITE_ARC_CATEGORIES,
} from './eliteArcMarkersBuilder.mjs'

const ROOT = 'e:/qianproject/arc-map'

// ============================================================================
// 1. Server Regions (5 Global Matchmaking Regions from ARC Raiders)
// ============================================================================
const SERVERS = [
  {
    id: 'AS',
    code: 'ASIA',
    officialRegionKey: 'east-asia',
    name: '亚服',
    fullName: '亚太战区服务器 (Asia Pacific)',
    tzLabel: 'UTC+8 (北京时间)',
    utcOffsetHours: 8,
    europeOffsetHours: -5,
    seedOffset: 0,
    pingHint: '32 ms',
  },
  {
    id: 'EU',
    code: 'EUROPE',
    officialRegionKey: 'europe',
    name: '欧服',
    fullName: '欧洲战区服务器 (Europe Central)',
    tzLabel: 'UTC+1 (法兰克福)',
    utcOffsetHours: 1,
    europeOffsetHours: 0,
    seedOffset: 3,
    pingHint: '148 ms',
  },
  {
    id: 'NA',
    code: 'N.AMERICA',
    officialRegionKey: 'north-america',
    name: '美服',
    fullName: '北美战区服务器 (North America)',
    tzLabel: 'UTC-5 (美东时间)',
    utcOffsetHours: -5,
    europeOffsetHours: 7,
    seedOffset: 7,
    pingHint: '165 ms',
  },
  {
    id: 'SA',
    code: 'S.AMERICA',
    officialRegionKey: 'brazil',
    name: '南美服',
    fullName: '南美战区服务器 (South America)',
    tzLabel: 'UTC-3 (圣保罗)',
    utcOffsetHours: -3,
    europeOffsetHours: 6,
    seedOffset: 11,
    pingHint: '210 ms',
  },
  {
    id: 'OC',
    code: 'OCEANIA',
    officialRegionKey: 'oceania',
    name: '澳服',
    fullName: '大洋洲战区服务器 (Oceania)',
    tzLabel: 'UTC+10 (悉尼)',
    utcOffsetHours: 10,
    europeOffsetHours: -9,
    seedOffset: 5,
    pingHint: '115 ms',
  },
]

// ============================================================================
// 2. Official Loot Theme Mapping (from Pioneer/Core/UI/UI_Elements/Icons/Map)
// ============================================================================
const LOOT_THEME_META = {
  Industrial: { zh: '工业', en: 'Industrial', icon: 'game-maps/icons/T_UI_Icon_Loot_Industrial.png' },
  Mechanical: { zh: '机械元件', en: 'Mechanical', icon: 'game-maps/icons/T_UI_Icon_Loot-Mechanical.png' },
  Electrical: { zh: '电力', en: 'Electrical', icon: 'game-maps/icons/T_UI_Icon_Loot-Electrical.png' },
  Technological: { zh: '科技', en: 'Technological', icon: 'game-maps/icons/T_UI_Icon_Loot-Technological.png' },
  Medical: { zh: '医疗', en: 'Medical', icon: 'game-maps/icons/T_UI_Icon_Loot_Medical.png' },
  Commercial: { zh: '商业', en: 'Commercial', icon: 'game-maps/icons/T_UI_Icon_Loot_Commercial.png' },
  Residential: { zh: '住宅', en: 'Residential', icon: 'game-maps/icons/T_UI_Icon_Loot_Household.png' },
  Household: { zh: '住宅', en: 'Household', icon: 'game-maps/icons/T_UI_Icon_Loot_Household.png' },
  Security: { zh: '安保', en: 'Security', icon: 'game-maps/icons/T_UI_Icon_Loot_Military.png' },
  Military: { zh: '军事', en: 'Military', icon: 'game-maps/icons/T_UI_Icon_Loot_Military.png' },
  Nature: { zh: '自然', en: 'Nature', icon: 'game-maps/icons/T_UI_Icon_Loot-Nature.png' },
  ARC: { zh: 'ARC组件', en: 'ARC', icon: 'game-maps/icons/T_UI_Icon_Loot_Arc.png' },
  Exodus: { zh: '离巢科技', en: 'Exodus', icon: 'game-maps/icons/T_UI_Icon_Loot_Exodus.png' },
  OldWorld: { zh: '旧世界', en: 'Old World', icon: 'game-maps/icons/T_UI_Icon_Loot_Educational.png' },
  Raider: { zh: '奇袭者', en: 'Raider', icon: 'game-maps/icons/T_UI_Icon_Loot_Raider.png' },
}

// ============================================================================
// 3. Map Conditions & Dynamic Events (with Official Game Icons)
// ============================================================================
const MAP_EVENTS = {
  'standard-patrol': {
    id: 'standard-patrol',
    name: '常规巡逻',
    enName: 'Standard Patrol',
    category: 'standard',
    categoryLabel: '常规部署',
    severity: 'normal',
    accent: '#3f92ac',
    icon: 'compass',
    gameIcon: 'game-maps/icons/T_UI_LocationLogo_Generic.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '1.0× 标准产出',
    trialBonusLabel: '标准试炼积分',
    summary: '地表能见度良好，ARC 机械维持常规巡逻密度，所有标准撤离点与奇袭者暗门（Raider Hatches）均正常开放。',
    modifiers: [
      '全部标准撤离升降梯/地铁站正常运行',
      '奇袭者暗门（Raider Hatches）可使用奇袭者暗门钥匙开启',
      '常规战利品刷新率与标准 ARC 巡逻警戒度',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Map_Conditions',
  },
  'night-raid': {
    id: 'night-raid',
    name: '夜间奇袭',
    enName: 'Night Raid',
    category: 'major-condition',
    categoryLabel: '全局高危环境',
    severity: 'danger',
    accent: '#ff3026',
    icon: 'moon',
    gameIcon: 'game-maps/icons/T_Icon_Event.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_NightRaid.png',
    durationMinutes: 30,
    hatchesDisabled: true,
    reducedExtractions: true,
    lootMultiplierLabel: '2.0× 高价值战利品',
    trialBonusLabel: '周常试炼积分 ×2',
    summary: '伸手不见五指的黑夜笼罩战区。全图战利品价值与蓝图掉率显著提升，但所有奇袭者暗门锁死关闭，且常规撤离点数量削减。',
    modifiers: [
      '全局高价值容器、保险箱与蓝图掉率大幅提升',
      '所有奇袭者暗门（Raider Hatches）彻底停用关闭',
      '可用常规撤离点数量减少，撤离点争夺显著加剧',
      'ARC 巡逻队数量与侵略性提高，开启手电筒易暴露位置',
      '在此环境下完成行动可获得 2 倍周常试炼（Trials）积分',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Night_Raid',
  },
  'electromagnetic-storm': {
    id: 'electromagnetic-storm',
    name: '电磁风暴',
    enName: 'Electromagnetic Storm',
    category: 'major-condition',
    categoryLabel: '全局高危环境',
    severity: 'danger',
    accent: '#ffd205',
    icon: 'bolt',
    gameIcon: 'game-maps/icons/T_UI_Icon_Loot-Electrical.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_ElectromagneticStorm.png',
    durationMinutes: 30,
    hatchesDisabled: true,
    reducedExtractions: true,
    lootMultiplierLabel: '1.8× 科技/全品类加成',
    trialBonusLabel: '周常试炼积分 ×2',
    summary: '狂暴的电磁雷暴肆虐地表。落雷会周期性轰击开阔地带（可摧毁小型 ARC 或麻痹大型机械），暗门全面停用，雷击点可采集稀有【石化闪电】。',
    modifiers: [
      '地表周期性触发高能落雷（落雷前地面有电荷预警圈）',
      '雷击处有概率生成专属稀有材料【石化闪电 (Fossilized Lightning)】',
      '所有奇袭者暗门（Raider Hatches）因电磁干扰锁死关闭',
      '可用常规撤离点数量减少，全局战利品价值大幅提升',
      '在此环境下完成行动可获得 2 倍周常试炼（Trials）积分',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Electromagnetic_Storm',
  },
  'cold-snap': {
    id: 'cold-snap',
    name: '寒潮',
    enName: 'Cold Snap',
    category: 'major-condition',
    categoryLabel: '全局高危环境',
    severity: 'warn',
    accent: '#66ffff',
    icon: 'snowflake',
    gameIcon: 'game-maps/icons/T_Icon_MapCondition_Frost.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_ColdSnap.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '1.5× 战利品 + 专属烛果',
    trialBonusLabel: '寒潮契约加成',
    summary: '极寒暴风雪席卷战区。长期暴露在户外会累积冻伤（Frostbite），需进入室内或靠近热源恢复体温；水面冻结成冰可直接通行，野外刷新专属【烛果】。',
    modifiers: [
      '户外持续累积冻伤值，需利用建筑室内或火源回温',
      '涉水区域与浅湖完全结冰，开辟全新冰面战术穿插路线',
      '全图刷新寒潮专属植物【烛果灌木 (Candleberries)】',
      '全局高阶战利品与珍品刷新率提升',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Cold_Snap',
  },
  hurricane: {
    id: 'hurricane',
    name: '飓风席卷',
    enName: 'Hurricane',
    category: 'major-condition',
    categoryLabel: '全局高危环境',
    severity: 'warn',
    accent: '#38bdf8',
    icon: 'wind',
    gameIcon: 'game-maps/icons/T_Icon_MapCondition_Turbulence.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_Turbulence.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: true,
    lootMultiplierLabel: '1.6× 高价值战利品',
    trialBonusLabel: '恶劣气候加成',
    summary: '狂风暴雨大幅压缩视野并掩盖脚步声，户外飞沙走石会缓慢磨损暴露者的护盾，同时伴随高密度 ARC 机械增援与高额战利品回报。',
    modifiers: [
      '强风豪雨遮蔽远距离视线并大幅衰减枪声与脚步声传播',
      '长期处于无遮蔽户外环境将受到轻微持续护盾损耗',
      '全局战利品品质提升，部分次级撤离点受风暴影响关闭',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Hurricane',
  },
  'close-scrutiny': {
    id: 'close-scrutiny',
    name: '严密排查',
    enName: 'Close Scrutiny',
    category: 'minor-condition',
    categoryLabel: 'ARC 戒严行动',
    severity: 'warn',
    accent: '#fd4b10',
    icon: 'eye',
    gameIcon: 'game-maps/icons/T_UI_Ping_Enemy_Extractor.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_Extractor.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '专属产出：勘测师与汽化者物资',
    trialBonusLabel: '侦察猎杀高收益',
    summary: '成群的“勘测师”和“汽化者”正在扫描搜寻贵重物资。如果你准备好迎战，它们的发现必定会让你不虚此行。',
    modifiers: [
      '全图“勘测师”（Surveyor）与“汽化者”（Vaporizer）刷新密度大幅提升',
      '高威胁侦察护卫编队巡弋，击毁可夺取稀有电子组件与核心矩阵',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Close_Scrutiny',
  },
  harvester: {
    id: 'harvester',
    name: '收割者降临',
    enName: 'The Harvester',
    category: 'major-event',
    categoryLabel: '巨型首领事件',
    severity: 'danger',
    accent: '#ffc600',
    icon: 'boss',
    gameIcon: 'game-maps/icons/T_IconHarverster.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_Harvester.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '掉落：传奇武器蓝图',
    trialBonusLabel: '巨兽攻坚热点',
    summary: '巨型 ARC 资源收割机降临战区，外围由【“女王” (Queen)】级重型机甲严密护卫。突破内部周期性烈焰喷射机关，可夺取木星、制裁者、远日点等传奇武器蓝图！',
    modifiers: [
      '战区固定刷新【收割者 (Harvester)】巨型机械建筑与护卫“女王”',
      '收割者内部每隔数分钟触发高温火焰清场，需把握破译窗口',
      '核心金库高概率产出【木星 Jupiter】、【制裁者 Equalizer】、【远日点 Aphelion】传奇蓝图',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Harvester',
  },
  matriarch: {
    id: 'matriarch',
    name: '“族母”游荡',
    enName: 'Matriarch',
    category: 'major-event',
    categoryLabel: '巨型首领事件',
    severity: 'danger',
    accent: '#f60010',
    icon: 'skull',
    gameIcon: 'game-maps/icons/T_UI_Ping_Enemy_Spearmint.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_Spearmint.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '掉落：“族母”核心/传奇组件',
    trialBonusLabel: '重装讨伐热点',
    summary: '超重型首领级 ARC 机械【“族母” (Matriarch)】在主干道巡弋。需要重型破甲武器（如裂甲者、铁砧、木星）与小队协同集火击破其反应堆装甲。',
    modifiers: [
      '战区主干道刷新超重型首领【“族母” (Matriarch)】及其护卫无人机群',
      '击破装甲弱点与核心可获取高价值传奇研究组件与反应堆核心',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Matriarch',
  },
  'arc-frigate': {
    id: 'arc-frigate',
    name: 'ARC“护卫者”',
    enName: 'ARC Frigate (Shrouded Sky)',
    category: 'major-event',
    categoryLabel: '旗舰登舰解谜',
    severity: 'danger',
    accent: '#38bdf8',
    icon: 'ship',
    gameIcon: 'game-maps/icons/T_UI_Ping_Enemy_Frigate.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_Frigate.png',
    durationMinutes: 35,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '掉落：5级武器增幅模块',
    trialBonusLabel: '支持 3D 机关图联动',
    linkedStage: 'frigate',
    summary: '【蔽日天空】大型ARC“护卫者”悬停于战区上空。从双舷战壕击破吊桥弱点登舰，破坏 4 台酸雾风扇与 10 座旋转护盾核心，在底层货舱操作双棘轮夺取珍贵货物。',
    modifiers: [
      '开放空中母舰【ARC“护卫者”】登舰索道与双舷吊桥',
      '完成 10 核护盾与货舱棘轮解谜可获 5 级武器增幅核心材料',
      '点击地图中的护卫舰图标可直接进入【ARC“护卫者” 3D 机关解谜器】',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Shrouded_Sky',
  },
  'fallen-emperor': {
    id: 'fallen-emperor',
    name: '航向重定向',
    enName: 'Course Redirection (Emperor Beacons)',
    category: 'major-event',
    categoryLabel: '帝王信标与3D解谜',
    severity: 'danger',
    accent: '#38bdf8',
    icon: 'walker',
    gameIcon: 'game-maps/icons/T_Icon_MapCondition_Redirection.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_Redirection.png',
    durationMinutes: 35,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '掉落：帝王空投舱 & 16座金库',
    trialBonusLabel: '支持 3D 机关图联动',
    linkedStage: 'walker',
    summary: '区域内的“帝王”信标正陆续激活。奇袭者可从 10 座信标插槽面板拆出并部署“帝王”信标，将贵重物资空投引导至自己所在位置，或深入【倒下的“帝王”】内部四层迷宫开启 16 座耦合器金库。',
    modifiers: [
      '全图 10 座“帝王”信标插槽面板 (BP_CollectorTransmitterPanel) 陆续激活，可拆取并部署“帝王”信标引导空投',
      '雪原各处分布 19 处埋藏/损毁的“帝王”空投舱 (BP_SocketContainer_ArcPayload_01)',
      '点击地图中的倒下的“帝王”地标可直接进入【坠落帝王 3D 路线与剖切解谜器】',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Frozen_Trail',
  },
  'hidden-bunker': {
    id: 'hidden-bunker',
    name: '隐藏掩体开启',
    enName: 'Hidden Bunker',
    category: 'major-event',
    categoryLabel: '太空港专属大型解谜',
    severity: 'danger',
    accent: '#ffbc13',
    icon: 'vault',
    gameIcon: 'game-maps/icons/T_UI_Icon_System_Ping_Bunker.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_HiddenBunker.png',
    durationMinutes: 40,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '40分钟长局 · 掩体金库开放',
    trialBonusLabel: '周常试炼积分 ×2',
    summary: '太空港专属大型事件！单局时间延长至 40 分钟。奇袭者需前往航站楼与塔台屋顶激活多处通信天线，协同破译终端密码以开启外围隐藏地下掩体（Outskirts Bunker）。',
    modifiers: [
      '战区单局部署时间由 30 分钟延长至 40 分钟',
      '激活屋顶天线阵列后解锁外围隐藏掩体多层地下金库',
      '掩体内部产出大量高阶科技组件、稀有武器箱与蓝图',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Hidden_Bunker',
  },
  'locked-gate': {
    id: 'locked-gate',
    name: '封锁大门行动',
    enName: 'Locked Gate',
    category: 'major-event',
    categoryLabel: '蓝门专属大型解谜',
    severity: 'danger',
    accent: '#1fff76',
    icon: 'lock',
    gameIcon: 'game-maps/icons/T_UI_Icon_LockedGate.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_LockedGate.png',
    durationMinutes: 40,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '40分钟长局 · 隧道禁区开放',
    trialBonusLabel: '高价值金库事件',
    summary: '蓝门专属大型事件！单局时间延长至 40 分钟。围绕中央检查站【门禁控制室 (Gate Control Room)】搜集安全代码与门禁卡，开启深层地下隧道网的高价值封锁扇区。',
    modifiers: [
      '战区单局部署时间由 30 分钟延长至 40 分钟',
      '中央门禁控制室与深层隧道封锁区开放破译',
      '极高概率产出史诗级武器配件、蓝图与离巢模块',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Locked_Gate',
  },
  'lush-blooms': {
    id: 'lush-blooms',
    name: '收获季节',
    enName: 'Lush Blooms',
    category: 'minor-condition',
    categoryLabel: '自然资源丰收',
    severity: 'safe',
    accent: '#26bf57',
    icon: 'leaf',
    gameIcon: 'game-maps/icons/T_UI_Icon_Loot-Nature.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_LushBlooms.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '2.0× 植物/草药/果实产出',
    trialBonusLabel: '小鸡与医疗采集最佳窗口',
    summary: '温和湿润的气候令地表植被蓬勃生长。全图大毛蕊花（Great Mullein）、柠檬、杏子、红莓与野生蘑菇刷新密度翻倍，是升级废品仔与制作医疗品的黄金窗口。',
    modifiers: [
      '全图草药、水果、蘑菇与自然采集点数量翻倍',
      '水培穹顶、橄榄园、马拉诺公园等生态区产出极高',
      '视野晴朗开阔，非常适合低风险采集与完成植物类契约',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Lush_Blooms',
  },
  'prospecting-probes': {
    id: 'prospecting-probes',
    name: '四处窥探的探测器',
    enName: 'Prospecting Probes',
    category: 'minor-condition',
    categoryLabel: '科技资源事件',
    severity: 'info',
    accent: '#00a9f2',
    icon: 'satellite',
    gameIcon: 'game-maps/icons/T_UI_Icon_Event-ARC-Probe.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_ProspectingProbes.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '高产：传感器 / 电路 / 运动核心',
    trialBonusLabel: '工坊升级材料热点',
    summary: '多枚 ARC 地质勘探探针从轨道坠落至战区各处。每个探针坠落点均由小型巡逻队守卫，拆解探针可稳定获取大量传感器、电路板与运动核心。',
    modifiers: [
      '全图周期性标记多个【勘探探针 (Prospecting Probe)】空投点',
      '搜刮探针残骸高产传感器 (Sensors)、电子元件与 ARC 电路',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Prospecting_Probes',
  },
  'uncovered-caches': {
    id: 'uncovered-caches',
    name: '暴露的奇袭者箱',
    enName: 'Uncovered Caches',
    category: 'minor-condition',
    categoryLabel: '补给富集事件',
    severity: 'info',
    accent: '#ffbc13',
    icon: 'box',
    gameIcon: 'game-maps/icons/T_UI_Icon_Map_Raider-Cache.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_UncoveredCaches.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '全图新增野外埋藏补给箱',
    trialBonusLabel: '单人摸金推荐',
    summary: '地壳震动与雨水冲刷令大批旧时代埋藏的奇袭者防水补给桶与地下藏匿箱重见天日，在外围荒野即可搜刮到丰厚的弹药、医疗品与珍品。',
    modifiers: [
      '战区外围林地、河床与沙丘新增大量【裸露藏匿箱】刷新点',
      '无需深入高危红区即可快速装满背包并安全撤离',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Uncovered_Caches',
  },
  'husk-graveyard': {
    id: 'husk-graveyard',
    name: '机械坟场',
    enName: 'Husk Graveyard',
    category: 'minor-condition',
    categoryLabel: '机械残骸富集',
    severity: 'info',
    accent: '#a4a5aa',
    icon: 'cog',
    gameIcon: 'game-maps/icons/T_UI_Icon_Map_Arc-Wreckage.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_HuskGraveyard.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '2.0× ARC合金与机械零件',
    trialBonusLabel: '远征造船材料首选',
    summary: '旧大战遗留的大批重型 ARC 机械残骸（Husks）暴露于地表。撬开残骸外壳可获取海量 ARC合金、钢质弹簧、电池与损坏的驱动核心。',
    modifiers: [
      '全图刷新高密度大型机械残骸（Baron / Wasp / Bastion Husks）',
      '极高产出 ARC合金、电池与机械元件，部分残骸带有静电陷阱',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Husk_Graveyard',
  },
  'launch-tower-loot': {
    id: 'launch-tower-loot',
    name: '发射塔上的战利品',
    enName: 'Launch Tower Loot',
    category: 'minor-condition',
    categoryLabel: '太空港热点事件',
    severity: 'warn',
    accent: '#fd4b10',
    icon: 'rocket',
    gameIcon: 'game-maps/icons/T_Icon_MapCondition_LaunchTower.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_LaunchTowerLoot.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '发射塔顶层高阶军火箱 ×2',
    trialBonusLabel: '高危速攻热点',
    summary: '太空港中央双子发射塔（Launch Towers）顶层平台解锁特殊军用空投舱，高密度刷新稀有武器箱、高级电子元件与离巢火控模块。',
    modifiers: [
      '中央发射塔顶层连廊与控制室武器箱、科技保险匣数量翻倍',
      '发射塔升降索道周边交火强度显著上升',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/The_Spaceport',
  },
  'bird-city': {
    id: 'bird-city',
    name: '鸟城',
    enName: 'Bird City',
    category: 'minor-condition',
    categoryLabel: '掩埋废城生态事件',
    severity: 'info',
    accent: '#ebdecb',
    icon: 'feather',
    gameIcon: 'game-maps/icons/T_Icon_MapCondition_BirdCity.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_BirdCity.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '屋顶巢穴珍品与声学预警',
    trialBonusLabel: '屋顶潜行博弈',
    summary: '在掩埋废城周围发现了鸟群，它们聚集在烟囱附近，许多人认为这一现象背后有什么邪恶目的。',
    modifiers: [
      '街道与屋顶分布高密度敏感鸟群，惊飞后产生远距离视觉/声音提示',
      '烟囱与高层屋顶鸟巢额外刷新贵重饰品与有价值的材料',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Buried_City',
  },
  'buried-treasure': {
    id: 'buried-treasure',
    name: '海滩拾荒点',
    enName: 'Beachcombing',
    category: 'minor-condition',
    categoryLabel: '裂潮镇专属事件',
    severity: 'info',
    accent: '#2dd4bf',
    icon: 'box',
    gameIcon: 'game-maps/icons/T_Icon_MapCondition_BuriedTreasure.png',
    previewImage: 'game-maps/conditions/T_UI_MapCondition_BuriedTreasure.png',
    durationMinutes: 30,
    hatchesDisabled: false,
    reducedExtractions: false,
    lootMultiplierLabel: '沙滩埋藏宝物与可拾取探测器',
    trialBonusLabel: '裂潮镇寻宝热点',
    summary: '侦察者发现裂潮镇周边的沙滩下埋藏着各类饰品和小物件，也夹杂着一些不那么受欢迎的东西。我们鼓励奇袭者使用码头主管探测器把它们发掘出来。',
    modifiers: [
      '裂潮镇干涸海床与沙滩埋藏大量高价值旧世界饰品与财宝',
      '全图刷新可拾取的【码头主管探测器】，同时需警惕沙滩埋设的地雷',
    ],
    wikiUrl: 'https://arcraiders.wiki/wiki/Riven_Tides',
  },
}

// ============================================================================
// 4. Complete Bilingual Translation Dictionary for All Official Game POIs & Extractions
// ============================================================================
const ZH_POI_NAMES = {
  // Dam Battlegrounds
  'The Dam': '大坝核心区',
  Swamp: '西部沼泽',
  'Victory Ridge': '胜利山脊',
  'Water Towers': '水塔群',
  'Electrical Substation': '变电站',
  'Red Lakes': '红湖盆地',
  'Scrap Yard': '废料场',
  'Formicai Hills': '蚁丘高地',
  'Formicai Outpost': '蚁丘哨站',
  'Primary Facility': '主厂房设施',
  "Ben Welder's Sunroof": '本·韦尔德天窗营地',
  'Ruby Residence': '红宝石公寓',
  Wreckage: '机甲残骸区',
  'Hydroponic Dome Complex': '水培穹顶建筑群',
  'Pale Apartments': '苍白公寓',
  'West Broken Bridge': '西断桥',
  'Raider Outpost East': '东侧奇袭者哨站',
  Floodgates: '溢洪闸门',
  'East Broken Bridge': '东断桥',
  'Pattern House': '模型屋',
  'Old Battleground': '旧战场男爵残骸',
  'Small Creek': '小溪谷',
  'South Swamp Outpost': '南沼泽哨站',
  'Electrical Tower': '高压电塔',
  'Control Tower': '中央控制塔',
  'Power Generation Complex': '发电综合体',
  'Testing Annex': '测试附楼',
  'Controlled Access Zone': '受控访问区',
  'Research & Administration': '研究与行政中心',
  'Red Lakes Balcony': '红湖观景台',
  'Pipeline Tower': '管道塔',
  'The Breach': '大坝决口',
  'Water Treatment Control': '水处理控制中心',
  'Generator Hall': '发电机大厅',
  'North Complex Elevator': '北发电厂升降梯',
  'Central Swamp Lift': '中央沼泽升降梯',
  'Water Treatment Elevator': '水处理厂升降梯',
  'Red Lakes Balcony Lift': '红湖阳台升降梯',
  "Good Old Baron's Hatch": '旧男爵暗门',
  'Sunroof Hatch': '天窗暗门',
  'Red Lakes Hatch': '红湖暗门',
  'Pump House Hatch': '水泵房暗门',

  // Buried City
  'New District': '新区',
  'West Village': '西村',
  'Old Town': '老城区',
  Outskirts: '郊区',
  'Corso da Vinci': '达芬奇大道',
  'Market Ruins': '集市废墟',
  'Piazza Roma': '罗马广场',
  'Parking Garage': '多层停车库',
  'Space Travel': '太空旅行大厦 (J.Kozma)',
  'Church Ruins': '教堂废墟',
  'Grandioso Apartments': '宏伟公寓群',
  'Marano Station': '马拉诺火车站',
  'Plaza Rosa': '罗莎广场 (药房)',
  'Red Tower': '红塔',
  'Piazza Arbusto': '阿布斯托广场',
  Hospital: '市立医院',
  Research: '科研中心',
  'Su Durante Warehouses': '苏杜兰特仓库群',
  'Buried Properties': '掩埋民宅区',
  Galleria: '拱廊商业街',
  'Gas Station': '加油站',
  'Main Street': '主街',
  'Abandoned Highway Camp': '废弃高架桥营地',
  'Marano Park': '马拉诺公园',
  Library: '市立图书馆',
  Warehouse: '西侧仓库',
  "Dune's End": '沙丘尽头',
  'Maintenance Depot': '维修车库',
  'Town Hall': '市政厅',
  'Santa Maria Houses': '圣玛丽亚古宅',
  'Southern Station': '南侧地铁站',
  'Western Station': '西侧地铁站',
  'Eastern Station': '东侧地铁站',
  'Northern Station': '北侧地铁站',
  'Train Station Hatch': '火车站暗门',
  'Collapsed Supermarket Hatch': '坍塌超市暗门',
  'Old Town Hatch': '老城暗门',
  'Highway Overpass Hatch': '高架桥暗门',

  // Spaceport
  'The Spaceport': '太空港核心区',
  'La Chiesa': '教堂区',
  'East Plains': '东部平原',
  'Alberi Hills': '阿尔贝里丘陵',
  'Fuel Storage': '燃料储罐区',
  'Service Buildings': '勤务楼群',
  'East Plains Warehouses': '东平原仓库',
  'Staff Parking': '员工停车场',
  'Fuel Processing': '燃料加工厂',
  'Communications Tower': '通信塔',
  'Fuel Depot': '燃料库',
  'Maintenance Hangar': '维修机库',
  'Security Checkpoint': '安检站',
  'Jiangsu Warehouse': '江苏货运仓库',
  'Fuel Lines': '输油管线',
  'Rocket Assembly': '火箭总装车间',
  'The Trench': '导流战壕',
  'Arrival Building': '到达航站楼',
  'Shipping Warehouse': '航运仓库',
  'Departure Building': '出发航站楼',
  'Car Park': '车库',
  'Fuel Control': '燃料控制室',
  'Container Storage': '集装箱堆场',
  'East Container Yard': '东集装箱场',
  'West Container Yard': '西集装箱场',
  'Little Hangar': '小型机库',
  'East Hangar': '东机库',
  'Vehicle Maintenance': '车辆维护中心',
  'Launch Towers': '双子发射塔',
  'North Trench Tower': '北战壕塔台',
  'South Trench Tower': '南战壕塔台',
  'West Hangar': '西机库',
  'Control Tower A6': 'A6 主控制塔台',
  'East Elevator': '东区撤离升降梯',
  'Central Elevator': '中央撤离升降梯',
  'West Elevator': '西区撤离升降梯',
  'South Elevator': '南区撤离升降梯',
  'Trench Hatch West': '西战壕暗门',
  'Trench Hatch East': '东战壕暗门',
  'Departures Hatch': '出发大厅暗门',
  'Control Hatch': '塔台暗门',

  // The Blue Gate
  'Gate Approach': '蓝门引道',
  'The Mountains': '北部高山',
  'The Forest': '西部森林',
  'Traffic Tunnel': '地下交通隧道',
  Ridgeline: '东部山脊线',
  Checkpoint: '蓝门主检查站',
  "Pilgrim's Peak": '朝圣者峰通信站',
  'Outer Gates': '外层闸门',
  Headhouse: '竖井首楼',
  Farmlands: '南部农田区',
  'Maintenance Wing': '地下维护翼楼',
  "Raider's Refuge": '奇袭者避难所',
  Village: '蓝门山村',
  'Reinforced Reception': '加固接待中心',
  'Warehouse Complex': '综合仓库群',
  'Barren Clearing': '荒芜林间空地',
  'Security Wing': '地下安保翼楼',
  'Adorned Wreckage': '装饰残骸',
  'Highway Collapse': '断桥塌方处',
  'Data Vault': '数据金库',
  'Maintenance Bunker': '维护地堡',
  "Trapper's Glade": '捕兽者林地',
  'Abandoned Housing Project': '废弃住宅工程',
  'Olive Grove': '橄榄林',
  'Broken Earth': '裂地沟壑',
  'Ruined Homestead': '废墟农庄',
  'Ancient Fort': '古堡要塞',
  'Gate Control Room': '门禁控制室',
  'Warehouse Airshaft': '仓库通风竖井',
  'Forest Airshaft': '森林通风竖井',
  'Overlook Airshaft': '观景台通风竖井',
  'Cliffside Airshaft': '悬崖通风竖井',
  'Fragrant Hatch': '芳香暗门',
  'Prefab Hatch': '预制房暗门',
  'Reinforced Hatch': '加固暗门',
  'Lucky Hatch': '幸运暗门',

  // Stella Montis
  'Loading Bay': '货运装卸湾',
  Atrium: '中央中庭',
  'Cultural Archives': '文化档案馆',
  Sandbox: '机器人测试沙盒',
  'Medical Research': '医疗研究翼楼',
  'Western Tunnel': '西侧隧道',
  'Eastern Tunnel': '东侧隧道',
  Assembly: '总装车间',
  Communications: '通信中心',
  'Central Corridor': '中央走廊',
  'Seed Vault': '末日种子金库',
  'Lobby Metro': '大堂地铁层',
  'Business Center': '商务中心',
  Lobby: '安保主大堂',
  'Logistics Admin': '后勤行政室',
  'Robotic Sandbox B': '机器人沙盒 B 区',
  Cafeteria: '员工餐厅',
  'Assembly Workshops': '总装工坊',
  'Collapsed Tunnel': '坍塌隧道',
  Auditorium: '报告厅',
  'Viewing Deck': '观景甲板',
  'Cargo Dock A': 'A 号货运月台',
  'Business Lounge': '商务贵宾室',
  'Robotic Sandbox A': '机器人沙盒 A 区',
  'Control Room': '主控室',
  'Storage Room': '储藏室',
  'Cargo Dock B': 'B 号货运月台',
  'Assembly Line': '自动化装配线',
  'Security Bridge': '安保天桥',
  'Lobby Metro Station': '大堂地铁撤离站',
  'Assembly Hatch': '总装车间暗门',
  'Eastern Tunnel Hatch': '东隧道暗门',
  'Loading Bay Metro Station': '装卸湾地铁撤离站',
  'Sandbox Hatch': '沙盒暗门',
  'Seed Vault Airshaft': '种子库通风竖井',

  // Riven Tides
  Seabed: '干涸海床',
  'Mulatierra Hill': '穆拉蒂拉山丘',
  'Hotel Complex': '度假酒店群',
  Harbor: '深水港区',
  'Weighing Checkpoint': '称重检查站',
  'Transfer Depot': '中转车库',
  'Dried Riverbed': '干涸河床',
  Wavebreaker: '巨型防波堤',
  'Customs House': '海关大楼',
  Poolside: '泳池露台',
  'Hotel Panorama Azzurro': '蔚蓝全景大酒店',
  'Azzurro Beach': '蔚蓝海滩',
  'Port Authority Building': '港务局大厦',
  'Stacking Yard': '集装箱堆场',
  Wharf: '西码头',
  'Tennis Court': '网球场',
  Quay: '东顺岸码头',
  'Marano Road': '马拉诺公路',
  'Special Handling Tunnel': '特勤货运隧道',
  'Beach Bar': '海滩酒吧',
  Railyard: '港区铁路编组站',
  'Seaside Elevator': '海滨撤离升降梯',
  'Weighbridge Hatch': '地磅暗门',
  'Customs Elevator': '海关撤离升降梯',
  'Hilltop Hatch': '山顶暗门',
  'Saltswept Hatch': '盐风暗门',

  // Pendola Pass
  'Northern Tracks': '北部铁道区',
  'Almatera Village': '阿尔马特拉村',
  'Southern Pass': '南山口',
  'Freight Terminal': '货运终端区',
  'Railroad Junction': '铁路枢纽站',
  'Fallen Emperor': '坠落帝王机甲残骸',
  'Commissary Supermarket': '军需超市',
  'Loading Platforms': '装卸站台',
  'Almatera Station': '阿尔马特拉火车站',
  'Researcher Lodgings': '研究员宿舍',
  'Truck Stop': '卡车驿站',
  'Frozen River': '冰封河谷',
  'Transit Tunnel': '中转隧道',
  'Dispatch Tower': '调度塔',
  'Weather Station': '高山气象站',
  'Cielo Sereno Observatory': '晴空深空观测站',
  'Old Hamlet': '古老村落',
  'Deep-Space Telescope': '深空射电望远镜',
  'Piazza della Rupe': '悬崖广场',
  'Porta Benvenuti': '迎宾门',
  'Controlled Receiving Facility': '受控接收设施',
  'Reckless Transceiver': '鲁莽号信标终端',
  'Northern Transceiver': '北轨信标终端',
  'Supermarket Transceiver': '超市信标终端',
  'Glacial Transceiver': '冰川信标终端',
}

// ============================================================================
// 5. Helper to Parse DA_MapAreaInfo_*_P Dumps
// ============================================================================
function readTextAuto(filePath) {
  const buf = fs.readFileSync(filePath)
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le')
  if (buf.includes(0x00)) return buf.toString('utf16le')
  return buf.toString('utf8')
}

function splitTopLevelBraces(str) {
  const start = str.indexOf('{Location=')
  if (start < 0) return []
  const chunks = []
  let depth = 0
  let cur = ''
  for (let i = start; i < str.length; i++) {
    const ch = str[i]
    if (ch === '{') {
      depth++
      if (depth === 1) cur = ''
    }
    if (depth > 0) cur += ch
    if (ch === '}') {
      depth--
      if (depth === 0) chunks.push(cur)
    }
  }
  return chunks
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseGameMapDump(spec) {
  const txt = readTextAuto(spec.dumpFile)
  const lines = txt.split(/\r?\n/)
  const maLine = lines.find((l) => l.includes('MapAreas = [')) || ''
  const epLine = lines.find((l) => l.includes('ExtractionPoints = [')) || ''

  const areaChunks = splitTopLevelBraces(maLine)
  const epChunks = splitTopLevelBraces(epLine)

  const rawAreas = []
  for (const c of areaChunks) {
    const loc = c.match(/Location=X=(-?[\d.]+) Y=(-?[\d.]+) Z=(-?[\d.]+)/)
    const zoom = c.match(/TargetZoomLevel=(\d+)/)
    const layer = c.match(/TargetMapLayer=(\d+)/)
    const titleMatch = c.match(/Title=([^,]*)/)
    const descMatch = c.match(/Description=(.*?), AreaSplinePoints=/s)
    const headerMatch = c.match(/HeaderImage=([^,]*)/)
    const threatMatch = c.match(/ThreatLevel=(\d+)/)
    const lootMatch = c.match(/LootTags=(.*?) \(FGameplayTagContainer\)/)
    const spMatch = c.match(/AreaSplinePoints=\[(.*?)\]/s)

    if (!loc || !titleMatch) continue
    const enName = titleMatch[1].trim()
    if (!enName) continue

    const wx = parseFloat(loc[1])
    const wy = parseFloat(loc[2])
    const wz = parseFloat(loc[3])
    const u = Number((((wx - spec.worldPosX) / spec.worldSizeX) * 100).toFixed(2))
    const v = Number((((wy - spec.worldPosY) / spec.worldSizeY) * 100).toFixed(2))

    const zLevel = zoom ? Number(zoom[1]) : 0
    const mLayer = layer ? Number(layer[1]) : 0
    const threat = threatMatch ? Number(threatMatch[1]) : 0

    // Parse polygon points
    const polygon = []
    if (spMatch && spMatch[1]) {
      for (const pm of spMatch[1].matchAll(/X=(-?[\d.]+) Y=(-?[\d.]+)/g)) {
        const pu = Number((((parseFloat(pm[1]) - spec.worldPosX) / spec.worldSizeX) * 100).toFixed(2))
        const pv = Number((((parseFloat(pm[2]) - spec.worldPosY) / spec.worldSizeY) * 100).toFixed(2))
        polygon.push([pu, pv])
      }
    }

    // Parse loot tags
    const lootTags = []
    if (lootMatch && lootMatch[1].trim()) {
      const rawTags = lootMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      for (const rt of rawTags) {
        const shortTag = rt.split('.').pop()
        const meta = LOOT_THEME_META[shortTag] || {
          zh: shortTag,
          en: shortTag,
          icon: 'game-maps/icons/T_UI_Icon_Loot_Industrial.png',
        }
        lootTags.push({
          id: shortTag.toLowerCase(),
          zh: meta.zh,
          en: meta.en,
          icon: meta.icon,
        })
      }
    }

    // Parse header image
    let headerImage = null
    if (headerMatch && headerMatch[1].trim()) {
      const hName = headerMatch[1].trim().split('.').pop()
      if (hName) headerImage = `game-maps/pois/${hName}.jpg`
    }

    const enDesc = descMatch ? descMatch[1].trim() : ''
    const zhName = ZH_POI_NAMES[enName] || enName

    // Link 3D stage or key info if applicable
    const extra = (spec.poiOverrides && spec.poiOverrides[enName]) || {}

    rawAreas.push({
      id: extra.id || `${spec.shortPrefix}-${slugify(enName)}-l${mLayer}-z${zLevel}`,
      name: zhName,
      enName,
      zoom: zLevel,
      layer: mLayer,
      threat,
      tier: threat >= 3 ? 'high' : threat >= 1 || zLevel === 1 ? 'medium' : zLevel === 0 ? 'macro' : 'normal',
      x: u,
      y: v,
      worldCoord: {
        x: Math.round(wx / 100),
        y: Math.round(wy / 100),
        z: Math.round(wz / 100),
      },
      polygon,
      lootTags,
      lootTypes: lootTags.map((lt) => lt.zh),
      headerImage,
      enDesc,
      desc: extra.desc || enDesc || `${zhName}（${enName}）战术点位，世界坐标 (${Math.round(wx / 100)}m, ${Math.round(wy / 100)}m)。`,
      keyRequired: extra.keyRequired || null,
      linkedStage: extra.linkedStage || null,
    })
  }

  // Deduplicate identical titles on the same layer (prefer the entry with polygon/lootTags/Zoom 1)
  const dedupedMap = new Map()
  for (const area of rawAreas) {
    const key = `${area.layer}:${area.enName}:${Math.round(area.x / 3)}:${Math.round(area.y / 3)}`
    const existing = dedupedMap.get(key)
    if (!existing) {
      dedupedMap.set(key, area)
    } else {
      const score = (a) => (a.polygon.length ? 10 : 0) + (a.lootTags.length ? 5 : 0) + (a.zoom === 1 ? 3 : 0)
      if (score(area) > score(existing)) {
        dedupedMap.set(key, area)
      }
    }
  }
  const pois = [...dedupedMap.values()]

  if (Array.isArray(spec.additionalPois)) {
    for (const ap of spec.additionalPois) {
      const zLevel = ap.zoom ?? 2
      const mLayer = ap.layer ?? 0
      const threat = ap.threat ?? 0
      const lootTags = (ap.lootTags || []).map((shortTag) => {
        const meta = LOOT_THEME_META[shortTag] || {
          zh: shortTag,
          en: shortTag,
          icon: 'game-maps/icons/T_UI_Icon_Loot_Industrial.png',
        }
        return {
          id: shortTag.toLowerCase(),
          zh: meta.zh,
          en: meta.en,
          icon: meta.icon,
        }
      })
      pois.push({
        id: ap.id || `${spec.shortPrefix}-${slugify(ap.enName)}-l${mLayer}-z${zLevel}`,
        name: ap.name || ZH_POI_NAMES[ap.enName] || ap.enName,
        enName: ap.enName,
        zoom: zLevel,
        layer: mLayer,
        threat,
        tier:
          ap.tier ||
          (threat >= 3 ? 'high' : threat >= 1 || zLevel === 1 ? 'medium' : zLevel === 0 ? 'macro' : 'normal'),
        x: ap.x,
        y: ap.y,
        worldCoord: ap.worldCoord || {
          x: Math.round(((ap.x / 100) * spec.worldSizeX + spec.worldPosX) / 100),
          y: Math.round(((ap.y / 100) * spec.worldSizeY + spec.worldPosY) / 100),
          z: 0,
        },
        polygon: ap.polygon || [],
        lootTags,
        lootTypes: lootTags.map((lt) => lt.zh),
        headerImage: ap.headerImage || null,
        enDesc: ap.enDesc || '',
        desc: ap.desc || `${ap.name}（${ap.enName}）战术地标点位。`,
        keyRequired: ap.keyRequired || null,
        linkedStage: ap.linkedStage || null,
        poiKind: ap.poiKind || 'landmark',
      })
    }
  }

  // Build lootZones from all POIs that have official AreaSplinePoints polygons
  const lootZones = pois
    .filter((p) => p.polygon && p.polygon.length >= 3)
    .map((p) => ({
      id: `zone-${p.id}`,
      poiId: p.id,
      name: p.name,
      enName: p.enName,
      layer: p.layer,
      threat: p.threat,
      tier: p.threat >= 3 ? 'high' : 'medium',
      lootTypes: p.lootTypes,
      lootTags: p.lootTags,
      polygon: p.polygon,
    }))

  // Parse official ExtractionPoints
  const extractions = []
  for (const c of epChunks) {
    const loc = c.match(/Location=X=(-?[\d.]+) Y=(-?[\d.]+) Z=(-?[\d.]+)/)
    const titleMatch = c.match(/Title=([^,]*)/)
    const descMatch = c.match(/Description=(.*?), UITypeTag=/s)
    const tagMatch = c.match(/TagName=([^}]+)/)
    if (!loc || !titleMatch) continue

    const enName = titleMatch[1].trim()
    const zhName = ZH_POI_NAMES[enName] || enName
    const wx = parseFloat(loc[1])
    const wy = parseFloat(loc[2])
    const wz = parseFloat(loc[3])
    const u = Number((((wx - spec.worldPosX) / spec.worldSizeX) * 100).toFixed(2))
    const v = Number((((wy - spec.worldPosY) / spec.worldSizeY) * 100).toFixed(2))

    const rawTag = tagMatch ? tagMatch[1].trim() : ''
    let type = 'elevator'
    let typeLabel = '货运电梯'
    let icon = 'game-maps/icons/T_UI_Icons_ExtractLift.png'
    if (rawTag.endsWith('.Hatch')) {
      type = 'hatch'
      typeLabel = '奇袭者暗门'
      icon = 'game-maps/icons/T_UI_Icons_ExtractHatch.png'
    } else if (rawTag.endsWith('.Metro')) {
      type = 'metro'
      typeLabel = '地铁站'
      icon = 'game-maps/icons/T_UI_Icons_ExtractMetro.png'
    } else if (rawTag.endsWith('.Fan')) {
      type = 'airshaft'
      typeLabel = '通风井'
      icon = 'game-maps/icons/T_UI_Icon_Extraction_Fan.png'
    } else if (rawTag.includes('MultiProbe') || rawTag.endsWith('.Terminal')) {
      type = 'terminal'
      typeLabel = '撤离信标'
      icon = 'game-maps/icons/T_UI_Icon_Event-ARC-Probe.png'
    }

    extractions.push({
      id: `${spec.shortPrefix}-ext-${slugify(enName)}`,
      name: zhName,
      enName,
      desc: descMatch ? descMatch[1].trim() : '',
      type,
      typeLabel,
      icon,
      x: u,
      y: v,
      worldCoord: {
        x: Math.round(wx / 100),
        y: Math.round(wy / 100),
        z: Math.round(wz / 100),
      },
    })
  }

  return { pois, lootZones, extractions }
}

// ============================================================================
// 6. Playable Surface Maps (7 Official Topside Maps — Practice Range Excluded)
//    Note on World Map Positions (worldPos):
//    Derived from DA_*_GameModeLocationMetaData RelativePositionOnMap (X, Z)
//    mapped onto the official Calabretta topographic map (world-calabretta.jpg)
// ============================================================================
const RAW_MAPS = [
  {
    id: 'dam-battlegrounds',
    shortPrefix: 'dam',
    code: 'SECTOR 01 · THE DAM',
    name: '大坝战场',
    enName: 'Dam Battlegrounds',
    subName: 'Alcantara Power Plant (阿尔坎塔拉水电站)',
    areaRegion: 'Calabretta | Center (阿尔坎塔拉流域)',
    unlockText: '初始解锁 (0 轮)',
    difficultyTier: 2,
    difficultyLabel: 'II 阶 · 中危湿地水坝',
    durationMinutes: 30,
    accent: '#ffbc13',
    coverArt: 'game-maps/locations/dam-battlegrounds.jpg',
    tacticalImage: 'game-maps/tactical/dam-battlegrounds.jpg',
    hasUnderground: false,
    defaultLayer: 0,
    layers: [{ id: 0, label: '地表全图', enLabel: 'SURFACE', image: 'game-maps/tactical/dam-battlegrounds.jpg' }],
    dumpFile: 'F:/arc-export/mapareas-dam.txt',
    worldPosX: 347184.0,
    worldPosY: 438656.0,
    worldSizeX: 240000.0,
    worldSizeY: 240000.0,
    biome: '淹没水电站 / 毒沼湿地 / 红湖林区',
    // Matches "ALCANTARA PLANT" on full 1:1 world-calabretta.jpg
    worldPos: { x: 53.5, y: 70.0 },
    wikiUrl: 'https://arcraiders.wiki/wiki/Dam_Battlegrounds',
    loreDesc:
      '阿尔坎塔拉发电大坝曾是托莱多地区的能源命脉。第一次浪潮的惨烈交火将这里化作了遍布机械残骸、排洪渠与高耸控制塔的泥泞焦土。',
    summary:
      '斯佩兰扎奇袭者踏入地表的第一站。围绕决口的阿尔坎塔拉巨型水电站（The Dam）展开，中央控制塔与研究行政大楼产出极高，西侧水处理控制中心与北侧水培穹顶建筑群适合稳健搜刮，北端受控访问区内藏双回路通电金库。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
      'electromagnetic-storm',
      'cold-snap',
      'hurricane',
      'harvester',
      'matriarch',
      'arc-frigate',
      'close-scrutiny',
      'lush-blooms',
      'prospecting-probes',
      'uncovered-caches',
      'husk-graveyard',
    ],
    rotationCycle: [
      { primary: 'standard-patrol', secondary: 'close-scrutiny' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'electromagnetic-storm', secondary: null },
      { primary: 'standard-patrol', secondary: 'lush-blooms' },
      { primary: 'harvester', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: 'prospecting-probes' },
      { primary: 'cold-snap', secondary: null },
      { primary: 'standard-patrol', secondary: 'husk-graveyard' },
      { primary: 'matriarch', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'arc-frigate', secondary: null },
      { primary: 'standard-patrol', secondary: 'uncovered-caches' },
      { primary: 'hurricane', secondary: null },
      { primary: 'standard-patrol', secondary: null },
    ],
    linkedStages3D: [
      {
        stageKey: 'caz',
        title: '大坝 · 受控访问区 3D 机关图',
        badge: '双回路供电解谜',
        poiId: 'dam-controlled-access-zone',
      },
    ],
    poiOverrides: {
      'Control Tower': {
        id: 'dam-control-tower',
        keyRequired: '大坝控制塔钥匙 (Dam Control Tower Key)',
        desc: '全图制高点与高危交火中心。顶层指挥室锁闭着稀有军火与科技保险箱，电梯井与外墙滑索是唯一登顶通道。',
      },
      'Research & Administration': {
        id: 'dam-research-admin',
        keyRequired: '大坝员工室钥匙 (Dam Staff Room Key)',
        desc: '紧邻控制塔的综合办公楼，密集分布办公抽屉、服务器机柜与员工休息室，高产电子元件与蓝图。',
      },
      'Controlled Access Zone': {
        id: 'dam-controlled-access-zone',
        linkedStage: 'caz',
        desc: '大坝深处的高危封闭实验区（淹没厂房 Flooded Powerhouse）。需从两侧车间拾取动力电池或引爆燃料桶完成双回路通电以开启中央军火金库！点击可直达 3D 机关图。',
      },
      'Power Generation Complex': {
        id: 'dam-power-generation',
        desc: '北部核心工业建筑群，内含多层涡轮机舱与配电走廊，富含电池、铜线圈与机械零件。',
      },
      'Testing Annex': {
        id: 'dam-testing-annex',
        keyRequired: '大坝测试附楼钥匙 (Dam Testing Annex Key)',
        desc: '东南侧半淹没的科研附楼，二层实验室与封闭档案室盛产医疗物资、化学试剂与科技组件。',
      },
      'Hydroponic Dome Complex': {
        id: 'dam-hydroponic-dome',
        desc: '西北沼泽边缘的玻璃生态穹顶群，盛产大毛蕊花、苔藓、种子与工业加湿器，在【收获季节】事件下收益翻倍。',
      },
      'Water Treatment Control': {
        id: 'dam-water-treatment',
        keyRequired: '大坝监控室钥匙 (Dam Surveillance Key)',
        desc: '西侧工业枢纽，任务【水患隐忧 (Water Troubles)】的目标取水点位于厂房外侧蓄水池。',
      },
      'Old Battleground': {
        id: 'dam-old-battleground',
        desc: '第一次浪潮留下的巨型【男爵残骸 (Baron Husk)】所在地，契约【沉睡男爵】需攀爬残骸顶部撬开反应堆核心。',
      },
    },
    additionalPois: [
      {
        id: 'dam-red-lakes-bunker-l0-z2',
        name: '红湖地堡',
        enName: 'Red Lakes Bunker',
        x: 70.21,
        y: 40.88,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Military', 'Industrial'],
        desc: '位于红湖东北边缘与东断桥南侧之间的半掩埋混凝土防空地堡，内含军用储物柜与工业补给。',
      },
      {
        id: 'dam-spillway-gates-l0-z2',
        name: '溢洪道闸门',
        enName: 'Spillway Gates',
        x: 51.5,
        y: 47.79,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Industrial', 'Mechanical'],
        desc: '连接主厂房设施与大坝防洪闸之间的核心溢洪道闸门走廊。',
      },
      {
        id: 'dam-maintenance-l0-z2',
        name: '主厂房维修区',
        enName: 'Maintenance',
        x: 48.27,
        y: 50.95,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Industrial', 'Mechanical'],
        desc: '主厂房设施南翼的工业机修车间，遍布工具柜、机械元件与工业电池。',
      },
      {
        id: 'dam-power-control-l0-z2',
        name: '电力控制室',
        enName: 'Power Control',
        x: 59.19,
        y: 36.64,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Electrical', 'Technological'],
        keyRequired: '大坝受控访问区钥匙 (Dam Controlled Access Zone Key)',
        desc: '紧邻受控访问区南侧的高压配电控制室，高产电子元件、导线与电力保险丝。',
      },
      {
        id: 'dam-underpass-l0-z2',
        name: '受控区地下通道',
        enName: 'Underpass',
        x: 60.15,
        y: 34.71,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Industrial'],
        desc: '穿越大坝北侧受控访问区与发电厂综合体下方的隐蔽地下涵洞通道。',
      },
      {
        id: 'dam-lower-gallery-l0-z2',
        name: '下层泄洪长廊',
        enName: 'Lower Gallery',
        x: 57.97,
        y: 57.99,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Industrial'],
        desc: '红湖观景台下方的坝体下层观察长廊与泄洪道入口，契约【水源危机】的关键穿插路线。',
      },
      {
        id: 'dam-roots-l0-z2',
        name: '巨树根部藏匿点',
        enName: 'Roots',
        x: 50.81,
        y: 64.61,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Nature', 'Raider'],
        desc: '废料场北侧小溪谷旁的巨型枯树根部，树根洞穴下常刷新高价值奇袭者藏匿物与自然草药。',
      },
      {
        id: 'dam-east-broken-ridge-l0-z2',
        name: '东断脊制高点',
        enName: 'East Broken Ridge',
        x: 75.08,
        y: 38.27,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Raider'],
        desc: '东断桥外侧的高地山脊视野点，可俯瞰整个红湖北部与东侧道路。',
      },
      {
        id: 'dam-west-broken-ridge-l0-z2',
        name: '西破碎山脊',
        enName: 'West Broken Ridge',
        x: 49.82,
        y: 24.42,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Raider', 'Military'],
        desc: '凯旋岭东侧断裂高架桥下方的破碎山脊营地，契约【凯旋岭的回声】藏身处所在地。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-dam-tower',
        keyName: '大坝控制塔钥匙 (Dam Control Tower Key)',
        rarity: 'epic',
        poiName: '中央控制塔 (Control Tower) 顶层',
        x: 55.02,
        y: 52.68,
        layer: 0,
        lootSummary: '高阶军用武器箱、安全储物柜、稀有配件与蓝图',
      },
      {
        id: 'key-dam-caz',
        keyName: '大坝受控访问区钥匙 (Dam Controlled Access Zone Key)',
        rarity: 'epic',
        poiName: '受控访问区 (Controlled Access Zone) 电力控制室',
        x: 58.86,
        y: 36.32,
        layer: 0,
        lootSummary: '高阶科技组件、军用武器箱与电力实验蓝图',
      },
      {
        id: 'key-dam-powerrod',
        keyName: '能量管军火室 (Power Rod Locked Room)',
        rarity: 'epic',
        poiName: '发电厂综合体东侧能量管密封室',
        x: 64.84,
        y: 34.72,
        layer: 0,
        lootSummary: '消耗1根能量管开启，必出高阶武器箱与稀有配件',
      },
      {
        id: 'key-dam-annex',
        keyName: '大坝测试附楼钥匙 (Dam Testing Annex Key)',
        rarity: 'rare',
        poiName: '测试附楼 (Testing Annex) 二层实验室 (2处门)',
        x: 62.96,
        y: 62.98,
        layer: 0,
        altCoords: [[61.84, 63.5]],
        lootSummary: '高阶医疗箱、传感器、实验日志与珍品',
      },
      {
        id: 'key-dam-staff',
        keyName: '大坝员工室钥匙 (Dam Staff Room Key)',
        rarity: 'uncommon',
        poiName: '研究与行政中心 (Research & Admin) 一层',
        x: 54.11,
        y: 52.73,
        layer: 0,
        lootSummary: '电子元件、居民珍品、奇袭者硬币与随机钥匙',
      },
      {
        id: 'key-dam-surveillance',
        keyName: '大坝监控室钥匙 (Dam Surveillance Key)',
        rarity: 'uncommon',
        poiName: '水处理控制中心 (Water Treatment Control)',
        x: 40.87,
        y: 51.43,
        layer: 0,
        lootSummary: '工业机械元件、安保弹药箱与武器改装件',
      },
    ],
  },
  {
    id: 'buried-city',
    shortPrefix: 'bc',
    code: 'SECTOR 02 · BURIED CITY',
    name: '掩埋废城',
    enName: 'Buried City',
    subName: 'Calabretta South · 沙海吞噬的旧世界都会',
    areaRegion: 'Calabretta | South (南部荒漠)',
    unlockText: '完成 2 轮行动解锁',
    difficultyTier: 2,
    difficultyLabel: 'II 阶 · 巷战/垂直屋顶高危区',
    durationMinutes: 30,
    accent: '#f05023',
    coverArt: 'game-maps/locations/buried-city.jpg',
    tacticalImage: 'game-maps/tactical/buried-city.jpg',
    hasUnderground: false,
    defaultLayer: 0,
    layers: [{ id: 0, label: '地表全图', enLabel: 'SURFACE', image: 'game-maps/tactical/buried-city.jpg' }],
    dumpFile: 'F:/arc-export/mapareas-buriedcity.txt',
    worldPosX: 58506.133,
    worldPosY: 464084.469,
    worldSizeX: 100000.0,
    worldSizeY: 100000.0,
    biome: '干旱沙丘 / 坍塌钟楼街区 / 地下地铁网',
    worldPos: { x: 36.2, y: 64.5 },
    wikiUrl: 'https://arcraiders.wiki/wiki/Buried_City',
    loreDesc:
      '在这片干旱的沙丘中，你会看到一处与离巢时代冷峻的钢铁尖塔截然不同的旧世界遗迹。走过这些狭小的街道和空旷的广场，你会意识到，这里也曾有人生活过。',
    summary:
      '被滚滚黄沙半掩埋的旧世界意大利古城。狭窄的街巷、利用滑索互通的多层屋顶以及深入地下的地铁站构成了极具压迫感的立体巷战网络。市立医院、市政厅与太空旅行大厦是全图争夺最激烈的物资中心。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
      'cold-snap',
      'hurricane',
      'arc-frigate',
      'close-scrutiny',
      'bird-city',
      'lush-blooms',
      'prospecting-probes',
      'uncovered-caches',
      'husk-graveyard',
    ],
    rotationCycle: [
      { primary: 'arc-frigate', secondary: null },
      { primary: 'standard-patrol', secondary: 'bird-city' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: 'uncovered-caches' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'cold-snap', secondary: null },
      { primary: 'standard-patrol', secondary: 'lush-blooms' },
      { primary: 'standard-patrol', secondary: 'close-scrutiny' },
      { primary: 'hurricane', secondary: null },
      { primary: 'standard-patrol', secondary: 'prospecting-probes' },
      { primary: 'standard-patrol', secondary: 'husk-graveyard' },
    ],
    linkedStages3D: [],
    poiOverrides: {
      'Town Hall': {
        id: 'bc-town-hall',
        keyRequired: '掩埋废城市政厅钥匙 (Buried City Town Hall Key)',
        desc: '古城中心地标建筑，使用市政厅钥匙可开启顶层议会金库，必出高阶珍品、武器箱与加密档案。',
      },
      Hospital: {
        id: 'bc-hospital',
        keyRequired: '掩埋废城医院钥匙 (Buried City Hospital Key)',
        desc: '全图最大的医疗资源产地，3 层病房与手术室遍布消毒绷带、复苏剂、强效医疗包与实验药剂。',
      },
      'Space Travel': {
        id: 'bc-space-travel',
        keyRequired: 'J.科兹马创投公司钥匙 (J. Kozma Ventures Key)',
        desc: '离巢时代的商业航天巨头总部，高层机房盛产高阶科技组件、传感器与加密蓝图。',
      },
      Library: {
        id: 'bc-library',
        desc: '任务【图书馆藏书】核心地点，内部书架与阅览室高产旧世界珍品、研究手稿与钥匙。',
      },
      'Plaza Rosa': {
        id: 'bc-plaza-rosa',
        desc: '南部核心街区，广场两侧坐落着著名的【罗莎广场药房】，是兰斯医疗任务的必经之地。',
      },
      'Grandioso Apartments': {
        id: 'bc-grandioso-apartments',
        keyRequired: '掩埋废城住宅总钥匙 (Buried City Residential Master Key)',
        desc: '西南部多层公寓群，大量卧室抽屉与衣柜可稳定搜刮民居珍品、布料、小鸡升级枕头与蓝图。',
      },
    },
    additionalPois: [
      {
        id: 'bc-piazza-roma-rooftop-l0-z2',
        name: '罗马广场康维尼奥顶层',
        enName: 'Piazza Roma Convenio Rooftop',
        x: 36.59,
        y: 57.03,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Residential', 'Technological'],
        desc: '罗马广场南侧康维尼奥大楼上方的屋顶花园与研究员加密公寓，契约【铺平道路】与【意外先机】的核心目标点。',
      },
      {
        id: 'bc-secluded-roof-terrace-l0-z2',
        name: '南站西南隐蔽天台',
        enName: 'Secluded Roof Terrace',
        x: 42.75,
        y: 77.47,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Electrical', 'Raider'],
        desc: '南侧地铁站西南方向的蓝色防水布隐蔽屋顶露台，契约【锁定目标】需在此使用3根电线修复太阳能板。',
      },
      {
        id: 'bc-buried-properties-mural-l0-z2',
        name: '埋没楼群壁画建筑',
        enName: 'Buried Properties Mural Building',
        x: 71.48,
        y: 40.96,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Residential'],
        desc: '埋没的楼群北侧带有巨幅外墙壁画的标志性建筑，契约【重返巅峰】的喷漆标记点。',
      },
      {
        id: 'bc-arbusto-pharmacy-l0-z2',
        name: '阿布斯托药房',
        enName: 'Arbusto Pharmacy',
        x: 69.87,
        y: 60.67,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Medical', 'Residential'],
        desc: '崩塌高架桥与东侧地铁站旁的绿十字药房及二楼药剂师旧居，契约【药剂师日常】与【废墟秘辛】的核心点位。',
      },
      {
        id: 'bc-metro-access-east-l0-z2',
        name: '东站地铁楼梯口',
        enName: 'East Metro Stairs Down',
        x: 58.31,
        y: 58.43,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '通往东侧地铁站地下站台的下行楼梯入口（周边另有 (68.79, 61.83)、(61.66, 71.09)、(56.23, 68.48) 三处地铁口）。',
      },
      {
        id: 'bc-metro-access-north-l0-z2',
        name: '北站地铁楼梯口',
        enName: 'North Metro Stairs Down',
        x: 46.03,
        y: 36.69,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '图书馆与医院之间通往北侧地铁站地下站台的下行楼梯入口（周边另有 (42.27, 28.34)、(48.89, 25.27)、(55.57, 38.28) 三处地铁口）。',
      },
      {
        id: 'bc-metro-access-west-l0-z2',
        name: '西站地铁楼梯口',
        enName: 'West Metro Stairs Down',
        x: 38.02,
        y: 47.06,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '罗马广场旁通往西侧地铁站地下站台的下行楼梯入口（周边另有 (46.32, 48.50)、(39.12, 55.79) 两处地铁口）。',
      },
      {
        id: 'bc-metro-access-south-l0-z2',
        name: '南站地铁楼梯口',
        enName: 'South Metro Stairs Down',
        x: 51.04,
        y: 74.91,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '玫瑰广场南侧通往南侧地铁站地下站台的下行楼梯入口。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-bc-townhall',
        keyName: '掩埋废城市政厅钥匙 (Buried City Town Hall Key)',
        rarity: 'epic',
        poiName: '市政厅 (Town Hall) 议会金库',
        x: 53.85,
        y: 53.92,
        layer: 0,
        lootSummary: '史诗级军火箱、旧世界黄金珍品与高阶蓝图',
      },
      {
        id: 'key-bc-hospital',
        keyName: '掩埋废城医院钥匙 (Buried City Hospital Key)',
        rarity: 'rare',
        poiName: '市立医院 (Hospital) 三楼隔离药房',
        x: 48.22,
        y: 25.4,
        layer: 0,
        lootSummary: '大批量高级医疗包、复苏剂、强效兴奋剂与医疗蓝图',
      },
      {
        id: 'key-bc-jkv',
        keyName: 'J.科兹马创投公司门禁卡 (Buried City JKV Employee Access Card)',
        rarity: 'rare',
        poiName: '太空旅行大厦 (Space Travel) 四楼VIP室',
        x: 57.56,
        y: 40.46,
        layer: 0,
        lootSummary: '离巢科技组件、传感器与高阶武器箱',
      },
      {
        id: 'key-bc-residential',
        keyName: '掩埋废城住宅总钥匙 (Buried City Residential Master Key)',
        rarity: 'uncommon',
        poiName: '宏伟公寓群 (30.39, 63.74)、主街南公寓 (43.59, 70.76) 与阿布斯托南宅 (64.23, 66.17)',
        x: 30.39,
        y: 63.74,
        layer: 0,
        altCoords: [
          [43.59, 70.76],
          [64.23, 66.17],
        ],
        lootSummary: '高价值民居古董、奇袭者硬币与生活物资',
      },
    ],
  },
  {
    id: 'spaceport',
    shortPrefix: 'sp',
    code: 'SECTOR 03 · THE SPACEPORT',
    name: '太空港',
    enName: 'The Spaceport',
    subName: 'Acerra Spaceport (阿切拉航天发射中心)',
    areaRegion: 'Calabretta | North (阿切拉盆地)',
    unlockText: '完成 4 轮行动解锁',
    difficultyTier: 3,
    difficultyLabel: 'III–IV 阶 · 开阔狙击/重装机甲区',
    durationMinutes: 30,
    accent: '#00a9f2',
    coverArt: 'game-maps/locations/spaceport.jpg',
    tacticalImage: 'game-maps/tactical/spaceport.jpg',
    undergroundImage: 'game-maps/tactical/spaceport-underground.webp',
    hasUnderground: true,
    defaultLayer: 0,
    layers: [
      { id: 0, label: '地表发射场', enLabel: 'SURFACE', image: 'game-maps/tactical/spaceport.jpg' },
      { id: 1, label: '地下战壕与掩体', enLabel: 'UNDERGROUND', image: 'game-maps/tactical/spaceport-underground.webp', overlayOnBase: true },
    ],
    dumpFile: 'F:/arc-export/mapareas-spaceport.txt',
    worldPosX: 86487.0,
    worldPosY: 213286.0,
    worldSizeX: 240000.0,
    worldSizeY: 240000.0,
    biome: '巨型火箭发射台 / 地下导流战壕 / 航站楼',
    // Matches "Accerra" on full 1:1 world-calabretta.jpg
    worldPos: { x: 40.5, y: 49.0 },
    wikiUrl: 'https://arcraiders.wiki/wiki/The_Spaceport',
    loreDesc:
      '阿切拉太空港曾是人类迈向星海的离巢时代的骄傲。如今高耸入云的双子发射塔与庞大的地下维护隧道中，仍埋藏着无数尖端航空科技与旧时代的辉煌遗物。',
    summary:
      '旧人类【离巢】时代宏伟的阿切拉航天中心。中央矗立着高耸入云的双子发射塔，地下由错综复杂的排焰导流战壕与维护隧道相连。拥有专属 40 分钟大型解谜事件【隐藏掩体 (Hidden Bunker)】与【发射塔上的战利品】。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
      'electromagnetic-storm',
      'cold-snap',
      'hurricane',
      'hidden-bunker',
      'launch-tower-loot',
      'harvester',
      'matriarch',
      'arc-frigate',
      'close-scrutiny',
      'lush-blooms',
      'prospecting-probes',
      'uncovered-caches',
      'husk-graveyard',
    ],
    rotationCycle: [
      { primary: 'standard-patrol', secondary: null },
      { primary: 'hidden-bunker', secondary: null },
      { primary: 'standard-patrol', secondary: 'launch-tower-loot' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: 'prospecting-probes' },
      { primary: 'electromagnetic-storm', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'harvester', secondary: null },
      { primary: 'standard-patrol', secondary: 'husk-graveyard' },
      { primary: 'arc-frigate', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'cold-snap', secondary: null },
      { primary: 'standard-patrol', secondary: 'close-scrutiny' },
      { primary: 'matriarch', secondary: null },
      { primary: 'standard-patrol', secondary: 'lush-blooms' },
    ],
    linkedStages3D: [
      {
        stageKey: 'frigate',
        title: '蔽日天空 · ARC“护卫者” 3D 机关图',
        badge: '10核护盾 + 双棘轮货舱',
        poiId: 'sp-launch-towers',
      },
    ],
    poiOverrides: {
      'Launch Towers': {
        id: 'sp-launch-towers',
        linkedStage: 'frigate',
        desc: '太空港绝对核心地标。通过高速滑索可登上百米高空连廊，在【发射塔上的战利品】期间刷新顶级空投军火箱。',
      },
      'Control Tower A6': {
        id: 'sp-control-tower-a6',
        keyRequired: '太空港控制塔钥匙 (Spaceport Control Tower Key)',
        desc: '俯瞰整个发射场的指挥中枢，顶层雷达室需使用控制塔钥匙开启，屋顶设有【隐藏掩体】通信天线。',
      },
      'Rocket Assembly': {
        id: 'sp-rocket-assembly',
        desc: '超大型垂直火箭组装厂房，内部天车走廊与测试台高产火箭推进剂、磁性加速线圈与重工业组件。',
      },
      'Departure Building': {
        id: 'sp-departure-building',
        desc: '西侧大型航站楼，值机大厅与贵宾休息室拥有极高密度的行李箱、商业收银机与安检储物柜。',
      },
      'Arrival Building': {
        id: 'sp-arrival-building',
        desc: '西北侧航站楼，内部设有医疗急救站与行李分拣处，屋顶同样分布有隐藏掩体任务天线。',
      },
      'Container Storage': {
        id: 'sp-container-storage',
        keyRequired: '太空港集装箱室钥匙 (Spaceport Container Storage Key)',
        desc: '东南侧巨型集装箱迷宫，二层悬挂控制室需钥匙解锁，内含多座军火武器箱。',
      },
    },
    additionalPois: [
      {
        id: 'sp-outskirts-hidden-bunker-l0-z1',
        name: '外围隐藏地堡',
        enName: 'Outskirts Hidden Bunker',
        x: 34.34,
        y: 49.15,
        layer: 0,
        zoom: 1,
        threat: 3,
        lootTags: ['Technological', 'Military', 'Exodus'],
        desc: '燃料处理厂与燃料管道之间的地下大型掩体（设 (33.54, 50.08)、(34.71, 53.07)、(36.15, 48.89) 三座防爆门），【隐藏地堡】事件与契约【初代游牧民】的核心目标点。',
      },
      {
        id: 'sp-underground-utility-tunnels-l1-z1',
        name: '发射塔地下维护管网',
        enName: 'Underground Utility Tunnels',
        x: 44.67,
        y: 45.84,
        layer: 1,
        zoom: 1,
        threat: 2,
        lootTags: ['Industrial', 'Mechanical', 'Electrical'],
        desc: '贯穿双子发射塔与候机楼底部的地下维护隧道与净水过滤室，契约【更换水源】、【净水之梦】与【腐败恶臭】的核心地下点位。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-sp-control',
        keyName: '太空港控制塔钥匙 (Spaceport Control Tower Key)',
        rarity: 'epic',
        poiName: 'A6 主控制塔台 (Control Tower A6) 顶层',
        x: 49.69,
        y: 53.58,
        layer: 0,
        altCoords: [
          [49.61, 53.27],
          [50.06, 53.48],
        ],
        lootSummary: '顶级科技保险箱、高阶武器箱与蓝图',
      },
      {
        id: 'key-sp-trench',
        keyName: '太空港战壕塔钥匙 (Spaceport Trench Tower Key)',
        rarity: 'rare',
        poiName: '北战壕塔 (54.84, 29.83) 与南战壕塔 (52.78, 30.60)',
        x: 54.84,
        y: 29.83,
        layer: 0,
        altCoords: [
          [54.11, 29.16],
          [52.78, 30.6],
          [53.51, 31.27],
        ],
        lootSummary: '军用狙击枪箱、高倍镜配件与重型弹药',
      },
      {
        id: 'key-sp-container',
        keyName: '太空港集装箱室钥匙 (Spaceport Container Storage Key)',
        rarity: 'rare',
        poiName: '集装箱堆场 (Container Storage) 悬挂控制室',
        x: 58.88,
        y: 54.87,
        layer: 0,
        altCoords: [
          [59.57, 55.5],
          [59.22, 54.21],
          [59.64, 55.14],
        ],
        lootSummary: '工业稀有组件、磁控管与机械蓝图',
      },
      {
        id: 'key-sp-warehouse',
        keyName: '太空港仓库钥匙 (Spaceport Warehouse Key)',
        rarity: 'uncommon',
        poiName: '航运仓库 (Shipping Warehouse) 二层办公室',
        x: 44.6,
        y: 28.37,
        layer: 0,
        altCoords: [[43.85, 29.26]],
        lootSummary: '工业材料、传感器与奇袭者补给',
      },
    ],
  },
  {
    id: 'blue-gate',
    shortPrefix: 'bg',
    code: 'SECTOR 04 · THE BLUE GATE',
    name: '蓝门',
    enName: 'The Blue Gate',
    subName: 'Calabretta North · 通往北方雪山要塞的咽喉',
    areaRegion: 'Calabretta | North (山谷门户)',
    unlockText: '完成 7 轮行动解锁',
    difficultyTier: 4,
    difficultyLabel: 'IV 阶 · 高危隧道与山谷要塞',
    durationMinutes: 30,
    accent: '#38bdf8',
    coverArt: 'game-maps/locations/blue-gate.jpg',
    tacticalImage: 'game-maps/tactical/blue-gate.jpg',
    undergroundImage: 'game-maps/tactical/blue-gate-underground.png',
    hasUnderground: true,
    defaultLayer: 0,
    layers: [
      { id: 0, label: '地表山谷', enLabel: 'SURFACE', image: 'game-maps/tactical/blue-gate.jpg' },
      { id: 1, label: '地下隧道与翼楼', enLabel: 'UNDERGROUND', image: 'game-maps/tactical/blue-gate-underground.png', overlayOnBase: true },
    ],
    dumpFile: 'F:/arc-export/mapareas-bluegate.txt',
    worldPosX: -97750.0,
    worldPosY: -97750.0,
    worldSizeX: 195500.0,
    worldSizeY: 195500.0,
    biome: '高山峡谷 / 地下交通隧道网 / 古堡要塞',
    worldPos: { x: 63.5, y: 63.0 },
    wikiUrl: 'https://arcraiders.wiki/wiki/The_Blue_Gate',
    loreDesc:
      '通往北方高地的咽喉要道。险峻的翠绿山谷之下贯穿着错综复杂的跨山高速隧道与坚固的地下门禁设施，是奇袭者向北远征的必经之地。',
    summary:
      '连接低地锈带与北部崇山峻岭的咽喉要道。地表由开阔农田、山村、古堡要塞与奇袭者避难所组成；地下则隐藏着庞大的洲际交通隧道、安保翼楼与维护翼楼。内置【避难所 4 红钮】与【古堡 3 电池盒】两套完整 3D 机关图。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
      'electromagnetic-storm',
      'cold-snap',
      'hurricane',
      'locked-gate',
      'harvester',
      'matriarch',
      'arc-frigate',
      'close-scrutiny',
      'lush-blooms',
      'prospecting-probes',
      'uncovered-caches',
      'husk-graveyard',
    ],
    rotationCycle: [
      { primary: 'standard-patrol', secondary: null },
      { primary: 'locked-gate', secondary: null },
      { primary: 'standard-patrol', secondary: 'lush-blooms' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: 'prospecting-probes' },
      { primary: 'electromagnetic-storm', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'cold-snap', secondary: null },
      { primary: 'standard-patrol', secondary: 'close-scrutiny' },
      { primary: 'matriarch', secondary: null },
      { primary: 'standard-patrol', secondary: 'husk-graveyard' },
      { primary: 'arc-frigate', secondary: null },
      { primary: 'standard-patrol', secondary: null },
    ],
    linkedStages3D: [
      {
        stageKey: 'refuge',
        title: '蓝门 · 奇袭者避难所 3D 机关图',
        badge: '4红钮地窖解锁 (13选4)',
        poiId: 'bg-raiders-refuge',
      },
      {
        stageKey: 'fort',
        title: '蓝门 · 古堡要塞 3D 机关图',
        badge: '3电池盒供电开启地窖',
        poiId: 'bg-ancient-fort',
      },
    ],
    poiOverrides: {
      "Raider's Refuge": {
        id: 'bg-raiders-refuge',
        linkedStage: 'refuge',
        desc: '西部林区教堂废墟改造的避难所。在教堂内外 13 个随机刷新槽位中找齐每局生成的 4 个红钮开关并全部按下，即可开启地下室红光指示灯旁的高价值地窖门！点击可进入 3D 机关图。',
      },
      'Ancient Fort': {
        id: 'bg-ancient-fort',
        linkedStage: 'fort',
        desc: '南部山脊上的中世纪古堡废墟。在外围 11 个黄色引线盒刷新点中找到动力电池，插入堡内 3 个电池保险丝盒即可解封古堡地下金库！点击可进入 3D 机关图。',
      },
      Checkpoint: {
        id: 'bg-checkpoint',
        desc: '蓝门高速路的巨型收费与安检大棚，停满废弃军车与装甲运兵车，是进入地下交通隧道的正面入口。',
      },
      'Security Wing': {
        id: 'bg-security-wing',
        desc: '位于地下层（可切换至地下图层查看）的安保核心区，高密度产出军用武器箱、战术护盾与高级电子件。',
      },
      'Maintenance Wing': {
        id: 'bg-maintenance-wing',
        desc: '位于地下层的巨型隧道维护车间，遍布工业储物柜、发动机组件与电路板。',
      },
      "Pilgrim's Peak": {
        id: 'bg-pilgrims-peak',
        keyRequired: '蓝门通信塔钥匙 (Blue Gate Communication Tower Key)',
        desc: '东北高山之巅的雷达通信站，视野覆盖全谷，盛产传感器、无线电模块与狙击步枪。',
      },
    },
    additionalPois: [
      {
        id: 'bg-white-watchtower-l0-z2',
        name: '山脊白色瞭望塔',
        enName: 'White Watchtower',
        x: 55.56,
        y: 52.56,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Raider', 'Security'],
        desc: '位于仓储综合区与门禁控制室正南方的白色高耸瞭望塔，契约【重返巅峰】在蓝门的指定喷漆标记点。',
      },
      {
        id: 'bg-bilguuns-hideout-l0-z2',
        name: '比尔根的悬崖庇护所',
        enName: "Bilguun's Hideout",
        x: 26.94,
        y: 57.75,
        layer: 0,
        zoom: 2,
        threat: 1,
        lootTags: ['Raider', 'Nature'],
        desc: '高速公路崩塌区西端悬崖下的游牧民隐秘藏身处，契约【保持警戒】与【殊途不同归】的核心终点地标。',
      },
      {
        id: 'bg-mantis-locker-room-l1-z2',
        name: '地下隧道螫蝎更衣室',
        enName: 'MANTIS Locker Room',
        x: 53.0,
        y: 39.82,
        layer: 1,
        zoom: 2,
        threat: 2,
        lootTags: ['Security', 'Residential'],
        desc: '位于蓝门地下通行隧道中段的螫蝎（MANTIS）后勤更衣室，契约【倦鸟归巢】需在此搜寻车辆称重记录与隐藏钥匙。',
      },
      {
        id: 'bg-confiscation-vault-l1-z2',
        name: '地下没收物库房',
        enName: 'Confiscation Vault',
        x: 50.88,
        y: 41.36,
        layer: 1,
        zoom: 2,
        threat: 3,
        lootTags: ['Security', 'Military'],
        keyRequired: '蓝门没收室钥匙 (Blue Gate Confiscation Room Key)',
        desc: '位于加固前台正下方地下安保翼楼的核心扣押品金库，契约【倦鸟归巢】与【死胡同】的地下目标室。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-bg-confiscation',
        keyName: '蓝门没收室钥匙 (Blue Gate Confiscation Room Key)',
        rarity: 'epic',
        poiName: '加固接待中心 / 地下安保翼楼没收室',
        x: 50.88,
        y: 41.36,
        layer: 1,
        altCoords: [[51.15, 41.09]],
        lootSummary: '海关扣押的高阶违禁军火箱、史诗配件与蓝图',
      },
      {
        id: 'key-bg-comms',
        keyName: '蓝门通信塔钥匙 (Blue Gate Communication Tower Key)',
        rarity: 'rare',
        poiName: '朝圣者峰通信站 (Pilgrim\'s Peak) 地下机房',
        x: 71.29,
        y: 35.2,
        layer: 0,
        lootSummary: '高级科技模块、传感器与稀有武器箱',
      },
      {
        id: 'key-bg-cellar',
        keyName: '蓝门地窖钥匙 (Blue Gate Cellar Key)',
        rarity: 'uncommon',
        poiName: '橄榄林南侧酒窖 (42.62, 66.56) 与捕兽者林地西侧地窖 (32.58, 45.22)',
        x: 42.62,
        y: 66.56,
        layer: 0,
        altCoords: [[32.58, 45.22]],
        lootSummary: '旧世界珍品、医疗品与奇袭者补给箱',
      },
      {
        id: 'key-bg-village',
        keyName: '蓝门村庄钥匙 (Blue Gate Village Key)',
        rarity: 'uncommon',
        poiName: '蓝门山村 (Village) 西北上锁民宅',
        x: 35.79,
        y: 33.49,
        layer: 0,
        lootSummary: '民居收藏品、织物、硬币与设计图',
      },
      {
        id: 'key-bg-patrolcar',
        keyName: '巡逻车钥匙 (Patrol Car Key)',
        rarity: 'uncommon',
        poiName: '地下通行隧道与外门检查站上锁装甲巡逻车 (11处刷新)',
        x: 53.44,
        y: 46.04,
        layer: 1,
        altCoords: [
          [52.5, 48.11],
          [55.54, 44.02],
          [56.98, 42.21],
          [58.11, 40.83],
          [58.97, 38.82],
          [59.14, 37.31],
        ],
        lootSummary: '军用枪械箱、重型弹药与武器配件',
      },
    ],
  },
  {
    id: 'stella-montis',
    shortPrefix: 'sm',
    code: 'SECTOR 05 · STELLA MONTIS',
    name: '星辰山',
    enName: 'Stella Montis',
    subName: 'North Belt · 雪山深处的全封闭双层科研地堡',
    areaRegion: 'Northern Mountains (北境雪山复合体)',
    unlockText: '完成 12 轮行动解锁',
    difficultyTier: 4,
    difficultyLabel: 'IV–V 阶 · 室内近战/高密实验室',
    durationMinutes: 30,
    accent: '#c084fc',
    coverArt: 'game-maps/locations/stella-montis.jpg',
    tacticalImage: 'game-maps/tactical/stella-montis-upper.webp',
    undergroundImage: 'game-maps/tactical/stella-montis-lower.webp',
    hasUnderground: true,
    defaultLayer: 1,
    layers: [
      { id: 1, label: '上层研究区 (UPPER)', enLabel: 'UPPER LEVEL', image: 'game-maps/tactical/stella-montis-upper.webp' },
      { id: 0, label: '下层与隧道 (LOWER)', enLabel: 'LOWER & TUNNELS', image: 'game-maps/tactical/stella-montis-lower.webp' },
    ],
    dumpFile: 'F:/arc-export/mapareas-stellamontis.txt',
    worldPosX: -26538.461,
    worldPosY: -24572.932,
    worldSizeX: 43100.0,
    worldSizeY: 43100.0,
    biome: '上下双层全室内山体设施 / 末日种子库 / 医疗翼',
    worldPos: { x: 63.2, y: 49.5 },
    wikiUrl: 'https://arcraiders.wiki/wiki/Stella_Montis',
    loreDesc:
      '深嵌于北境雪山腹地的双层高度机密科研复合体。在冰冷的机器人沙盒、种子库与无菌医疗中心内，封存着离巢时代最核心的科研成果。',
    summary:
      '雕凿在北境极寒雪山山体内部的超大型双层地下科研复合体（离巢研究总部）。全图无户外开阔地，分为【上层研究区】与【下层隧道/种子库】，遍布“粉碎者”（Shredder）、自动机枪塔与高价值实验室，是顶级科技与蓝图的终极产地。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
    ],
    rotationCycle: [
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: null },
    ],
    linkedStages3D: [
      {
        stageKey: 'stella',
        title: '星辰山 · 全图 3D 立体建筑群导航',
        badge: '5层高度剖切 × 7大主翼 × 4间钥匙房 × 6撤离点',
        poiId: 'sm-assembly-workshops',
      },
    ],
    poiOverrides: {
      'Medical Research': {
        id: 'sm-medical-research',
        linkedStage: 'stella',
        keyRequired: '星辰山医疗仓库钥匙 (Stella Montis Medical Storage Key)',
        desc: '北翼双层生物与神经科学实验室，盛产实验性医疗药剂、基因样本与高阶科技组件。点击可进入星辰山 3D 全图查看上下层连通动线。',
      },
      'Assembly Workshops': {
        id: 'sm-assembly-workshops',
        linkedStage: 'stella',
        keyRequired: '星山总装管理员钥匙 (Stella Montis Assembly Admin Key)',
        desc: '西北翼精密原型机组装车间，遍布离巢实验武器部件、磁轨线圈与蓝图保险箱。点击可进入星辰山 3D 全图查看车间与西部隧道立体结构。',
      },
      'Cultural Archives': {
        id: 'sm-cultural-archives',
        linkedStage: 'stella',
        keyRequired: '星山档案馆钥匙 (Stella Montis Archives Key)',
        desc: '东翼恒温文物与历史档案金库，全游戏旧世界高价值艺术品与珍品密度最高的区域。点击可在 3D 全图中定位最东端档案金库钥匙房。',
      },
      'Seed Vault': {
        id: 'sm-seed-vault',
        linkedStage: 'stella',
        desc: '位于东南下层的极寒植物基因保存库，毗邻通风井撤离点与东部隧道舱门，产出珍稀植物样本与冷冻科技模块。',
      },
      Lobby: {
        id: 'sm-lobby',
        linkedStage: 'stella',
        keyRequired: '星山安保检查站钥匙 (Stella Montis Security Checkpoint Key)',
        desc: '复合体东侧三层挑高安检大厅，西接安检天桥钥匙房，底层直通大厅地铁撤离站台。',
      },
      'Robotic Sandbox': {
        id: 'sm-robotic-sandbox',
        linkedStage: 'stella',
        desc: '中央中层机甲测试沙盘大厅，四向连通医疗研究部、装卸湾与中央走廊，北侧设有沙盒奇袭者撤离舱门。',
      },
      'Loading Bay': {
        id: 'sm-loading-bay',
        linkedStage: 'stella',
        desc: '西南跨四层垂直货运天井，内设三联高速垂直索道井，最底端直达海拔 +6m 的装卸湾地铁撤离站台。',
      },
    },
    additionalPois: [
      {
        id: 'sm-communications-annex-l1-z2',
        name: '通讯站辅楼控制室',
        enName: 'Communications Annex',
        x: 65.33,
        y: 50.81,
        layer: 1,
        zoom: 2,
        threat: 2,
        lootTags: ['Electrical', 'Technological'],
        desc: '上层通讯站东侧的电力变压与变频器辅楼，契约【初代游牧民】在星辰山的核验点位。',
      },
      {
        id: 'sm-archives-mainframe-l1-z2',
        name: '文化档案馆主机后勤室',
        enName: 'Archives Mainframe Backroom',
        x: 91.22,
        y: 56.78,
        layer: 1,
        zoom: 2,
        threat: 3,
        lootTags: ['Technological', 'OldWorld'],
        desc: '上层文化档案馆最东端的机房后勤室，契约【残缺日志】最终步骤的主机数据终端所在地。',
      },
      {
        id: 'sm-stairs-west-tunnel-1-l1-z2',
        name: '下行梯口 · 西地道北',
        enName: 'Stairs Down (West Tunnel N)',
        x: 48.36,
        y: 36.26,
        layer: 1,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接星辰山上层中央走廊与下层西侧地道的垂直梯井。',
      },
      {
        id: 'sm-stairs-west-tunnel-2-l1-z2',
        name: '下行梯口 · 西地道南',
        enName: 'Stairs Down (West Tunnel S)',
        x: 45.97,
        y: 38.06,
        layer: 1,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接星辰山上层与下层西侧地道的辅助攀爬梯口。',
      },
      {
        id: 'sm-stairs-lobby-metro-w-l1-z2',
        name: '下行楼梯 · 大厅地铁西',
        enName: 'Stairs Down (Lobby Metro W)',
        x: 53.4,
        y: 28.77,
        layer: 1,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '从上层大厅北翼通往下层大厅地铁站的楼梯通道。',
      },
      {
        id: 'sm-stairs-security-bridge-l1-z2',
        name: '下行楼梯 · 安保桥北',
        enName: 'Stairs Down (Security Bridge)',
        x: 65.41,
        y: 29.94,
        layer: 1,
        zoom: 2,
        threat: 2,
        lootTags: [],
        poiKind: 'stairs',
        desc: '从上层安保区过道桥东侧通往下层大厅地铁站的楼梯通道。',
      },
      {
        id: 'sm-stairs-cargo-dock-a-l1-z2',
        name: '下行楼梯 · A号货运月台',
        enName: 'Stairs Down (Cargo Dock A)',
        x: 29.65,
        y: 53.59,
        layer: 1,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接上层A号货运月台与下层装卸区底层的楼梯井。',
      },
      {
        id: 'sm-stairs-medical-south-l1-z2',
        name: '下行楼梯 · 医疗区南翼',
        enName: 'Stairs Down (Medical South)',
        x: 26.28,
        y: 66.43,
        layer: 1,
        zoom: 2,
        threat: 2,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接上层医学研究部南端与下层走廊的楼梯通道。',
      },
      {
        id: 'sm-stairs-cargo-dock-b-l1-z2',
        name: '下行楼梯 · B号货运月台南',
        enName: 'Stairs Down (Cargo Dock B)',
        x: 34.3,
        y: 68.8,
        layer: 1,
        zoom: 2,
        threat: 1,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接上层装卸区南端与下层机器人沙盘B区西侧的楼梯通道。',
      },
      {
        id: 'sm-stairs-east-tunnel-n-l1-z2',
        name: '下行攀爬井 · 东地道北',
        enName: 'Stairs Down (East Tunnel N)',
        x: 73.73,
        y: 53.36,
        layer: 1,
        zoom: 2,
        threat: 2,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接上层礼堂/文化档案馆交界处与下层东侧地道的上下攀爬井。',
      },
      {
        id: 'sm-stairs-east-tunnel-s-l1-z2',
        name: '下行攀爬井 · 东地道南',
        enName: 'Stairs Down (East Tunnel S)',
        x: 78.16,
        y: 64.38,
        layer: 1,
        zoom: 2,
        threat: 2,
        lootTags: [],
        poiKind: 'stairs',
        desc: '连接上层文化档案馆南翼与下层种子库入口走廊的楼梯通道（契约【秘密会面】集会点之一）。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-sm-security',
        keyName: '星山安保检查站钥匙 (Stella Montis Security Checkpoint Key)',
        rarity: 'epic',
        poiName: '安保主大堂 (Lobby) 安保过道桥东侧核心军火库',
        x: 68.89,
        y: 35.86,
        layer: 1,
        lootSummary: '实验型武器箱、重型护盾与顶级武器改装件',
      },
      {
        id: 'key-sm-archives',
        keyName: '星山档案馆钥匙 (Stella Montis Archives Key)',
        rarity: 'epic',
        poiName: '文化档案馆 (Cultural Archives) 东端储存室金库',
        x: 92.43,
        y: 44.81,
        layer: 1,
        lootSummary: '连发手枪【颂歌 Canto】相关线索、天价旧世界古董与蓝图',
      },
      {
        id: 'key-sm-medical',
        keyName: '星辰山医疗仓库钥匙 (Stella Montis Medical Storage Key)',
        rarity: 'rare',
        poiName: '医疗研究翼楼 (Medical Research) 西北无菌库房',
        x: 13.93,
        y: 47.79,
        layer: 1,
        lootSummary: '顶级医疗箱、复活复苏剂与高纯度化学试剂',
      },
      {
        id: 'key-sm-admin',
        keyName: '星山总装管理员钥匙 (Stella Montis Assembly Admin Key)',
        rarity: 'rare',
        poiName: '总装工坊 (Assembly Workshops) 中央走廊北侧主管室',
        x: 37.56,
        y: 36.83,
        layer: 1,
        altCoords: [[40.34, 36.13]],
        lootSummary: '离巢核心模块、精密电子件与工坊蓝图',
      },
    ],
  },
  {
    id: 'riven-tides',
    shortPrefix: 'rt',
    code: 'SECTOR 06 · RIVEN TIDES',
    name: '裂潮镇',
    enName: 'Riven Tides',
    subName: 'Tyrrhenian Coast · 两度废弃的蔚蓝海湾度假村',
    areaRegion: 'Calabretta | West Coast (第勒尼安海岸)',
    unlockText: '裂潮更新解锁',
    difficultyTier: 5,
    difficultyLabel: 'V 阶 · 旗舰级海岸高危战区',
    durationMinutes: 30,
    accent: '#2dd4bf',
    coverArt: 'game-maps/locations/riven-tides.jpg',
    tacticalImage: 'game-maps/tactical/riven-tides.jpg',
    hasUnderground: false,
    defaultLayer: 0,
    layers: [{ id: 0, label: '地表海湾', enLabel: 'SURFACE', image: 'game-maps/tactical/riven-tides.jpg' }],
    dumpFile: 'F:/arc-export/mapareas-riventides.txt',
    worldPosX: -60000.0,
    worldPosY: -85800.0,
    worldSizeX: 120000.0,
    worldSizeY: 120000.0,
    biome: '干涸海床 / 豪华海景酒店 / 深水货港防波堤',
    worldPos: { x: 32.5, y: 78.5 },
    wikiUrl: 'https://arcraiders.wiki/wiki/Riven_Tides',
    loreDesc:
      '第勒尼安海岸线上两度被遗弃的昔日海滨小镇与深水贸易港。海水退却后裸露的干涸海床与奢华的海景酒店，如今已成为奇袭者与 ARC 机械争夺的前沿。',
    summary:
      '第勒尼安海岸线上两度被遗弃的昔日度假天堂与深水贸易港。海水退却后裸露的干涸海床遍布巨型防波堤与搁浅船只，西侧耸立着奢华的【蔚蓝全景大酒店】，东侧则是集装箱林立的港务局与海关大楼。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
      'buried-treasure',
      'prospecting-probes',
      'uncovered-caches',
      'lush-blooms',
      'arc-frigate',
    ],
    rotationCycle: [
      { primary: 'standard-patrol', secondary: 'buried-treasure' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: 'lush-blooms' },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'arc-frigate', secondary: null },
      { primary: 'standard-patrol', secondary: 'buried-treasure' },
      { primary: 'standard-patrol', secondary: null },
    ],
    linkedStages3D: [],
    poiOverrides: {
      'Hotel Panorama Azzurro': {
        id: 'rt-hotel-azzurro',
        keyRequired: '裂潮镇酒店房卡 102/107/113/205/208/311/404 (Hotel Keycards)',
        desc: '西海岸地标级豪华度假酒店，分布 7 间门禁卡上锁套房与夜总会电路密室，高产顶级奢华珍品、武器箱与医疗物资。',
      },
      'Port Authority Building': {
        id: 'rt-port-authority',
        keyRequired: '裂潮镇机密档案室/安全储藏室门禁卡 (Classified Records / Secure Storage Keycard)',
        desc: '深水港中央调度大厦，内部设有机密档案室（44.99, 43.77）与安全储藏室（45.50, 41.79）两座高价值门禁房。',
      },
      'Stacking Yard': {
        id: 'rt-stacking-yard',
        keyRequired: '裂潮镇起重机房门禁卡 (Riven Tides Crane House Keycard)',
        desc: '东港核心集装箱堆料场，南侧高架龙门吊设有上锁的起重机控制房（65.25, 56.37）。',
      },
      'Customs House': {
        id: 'rt-customs-house',
        desc: '南部进出口查验中心，扣押物仓库与三栋办公楼内藏有大量军用枪械箱、弹药与电子模块。',
      },
    },
    additionalPois: [
      {
        id: 'rt-sentinel-l0-z1',
        name: '哨兵高地',
        enName: 'Sentinel',
        x: 40.29,
        y: 44.67,
        layer: 0,
        zoom: 1,
        threat: 2,
        lootTags: ['Security', 'Industrial'],
        desc: '俯瞰干涸海床与港务局大厦西侧的海岸防线高地。',
      },
      {
        id: 'rt-pier-l0-z2',
        name: '东港突堤栈桥',
        enName: 'Pier',
        x: 78.11,
        y: 51.49,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Industrial', 'Commercial'],
        desc: '东顺岸码头（Quay）向海湾延伸的突堤栈桥，契约【塞莱斯特的童年涂鸦】第三处画作点位。',
      },
      {
        id: 'rt-breakwater-l0-z2',
        name: '北侧防波堤外段',
        enName: 'Breakwater',
        x: 61.76,
        y: 38.55,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Industrial'],
        desc: '巨型防波堤（Wavebreaker）北端延伸出海面的外侧堤坝，契约【严阵以待】需在此拍摄海堤裂缝。',
      },
      {
        id: 'rt-secret-button-l0-z2',
        name: '集装箱场机关按钮',
        enName: 'Button',
        x: 57.92,
        y: 55.06,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Industrial', 'Security'],
        desc: '位于集装箱堆场西侧控制门（58.20, 55.65）旁的联动机关按钮。',
      },
      {
        id: 'rt-nightclub-vault-l0-z2',
        name: '全景酒店夜总会密室',
        enName: 'Nightclub Puzzle Vault',
        x: 31.17,
        y: 64.56,
        layer: 0,
        zoom: 2,
        threat: 3,
        lootTags: ['Commercial', 'OldWorld'],
        desc: '蔚蓝全景大酒店东南侧夜总会内的继电器解谜密室（BP_PuzzleRelay_Nightclub_01），解开电路可开启豪华吧台金库。',
      },
      {
        id: 'rt-crane-house-l0-z2',
        name: '堆料场起重机控制房',
        enName: 'Crane House',
        x: 65.25,
        y: 56.37,
        layer: 0,
        zoom: 2,
        threat: 3,
        lootTags: ['Industrial', 'Mechanical'],
        keyRequired: '裂潮镇起重机房门禁卡 (Riven Tides Crane House Keycard)',
        desc: '集装箱堆场南侧的高架龙门吊控制室，左右两侧（64.32, 56.53 与 66.17, 56.21）设有门禁卡锁门。',
      },
      {
        id: 'rt-harbor-cliff-antenna-l0-z2',
        name: '海港东北悬崖巨型天线',
        enName: 'Harbor Cliff Antenna',
        x: 82.23,
        y: 35.17,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Electrical', 'Raider'],
        desc: '俯瞰整个裂潮镇港口的东北角悬崖雷达天线站，契约【塞莱斯特的叛逆期】需在此焊接发电机并启动发射器。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-rt-classified',
        keyName: '裂潮镇机密档案室门禁卡 (Riven Tides Classified Records Keycard)',
        rarity: 'epic',
        poiName: '港务局大厦 (Port Authority Building) 机密档案室',
        x: 44.99,
        y: 43.77,
        layer: 0,
        altCoords: [[45.46, 42.44]],
        lootSummary: '离巢贸易机密档案、顶级科技保险箱与史诗武器蓝图',
      },
      {
        id: 'key-rt-secure-storage',
        keyName: '裂潮镇安全储藏室门禁卡 (Riven Tides Secure Storage Keycard)',
        rarity: 'rare',
        poiName: '港务局大厦 (Port Authority Building) 北翼安全储藏室',
        x: 45.5,
        y: 41.79,
        layer: 0,
        lootSummary: '高阶军用武器箱、传感器与稀有改装件',
      },
      {
        id: 'key-rt-crane-house',
        keyName: '裂潮镇起重机房门禁卡 (Riven Tides Crane House Keycard)',
        rarity: 'rare',
        poiName: '集装箱堆场 (Stacking Yard) 起重机控制房',
        x: 66.17,
        y: 56.21,
        layer: 0,
        altCoords: [[64.32, 56.53]],
        lootSummary: '重工业精密组件、磁控管与高级军火箱',
      },
      {
        id: 'key-rt-hotel-rooms',
        keyName: '裂潮镇酒店客房门禁卡 102/107/113/205/208/311/404 (Riven Tides Hotel Keycards)',
        rarity: 'uncommon',
        poiName: '蔚蓝全景大酒店与泳池别墅区 7 间上锁套房',
        x: 27.68,
        y: 60.91,
        layer: 0,
        altCoords: [
          [26.67, 60.77],
          [29.32, 62.4],
          [30.25, 64.58],
          [29.85, 63.85],
          [20.15, 62.09],
          [20.48, 61.54],
        ],
        lootSummary: '奢华旧世界饰品、高价值生活物资与武器箱',
      },
      {
        id: 'key-rt-patrolcar',
        keyName: '巡逻车钥匙 (Patrol Car Key)',
        rarity: 'uncommon',
        poiName: '海关大楼与穆拉蒂拉山丘周边上锁装甲巡逻车 (4处刷新)',
        x: 44.03,
        y: 69.29,
        layer: 0,
        altCoords: [
          [42.1, 62.83],
          [57.68, 78.95],
          [53.23, 79.82],
        ],
        lootSummary: '军用弹药箱、战术道具与枪械配件',
      },
    ],
  },
  {
    id: 'pendola-pass',
    shortPrefix: 'pp',
    code: 'SECTOR 07 · PENDOLA PASS',
    name: '彭多拉山口',
    enName: 'Pendola Pass',
    subName: 'Frozen Trail · 坠落帝王与晴空深空观测站',
    areaRegion: 'Northern Alps (极寒雪峰山口)',
    unlockText: '冰封小径更新解锁',
    difficultyTier: 3,
    difficultyLabel: 'III–IV 阶 · 极寒雪山/巨型机甲内部',
    durationMinutes: 30,
    accent: '#66ffff',
    coverArt: 'game-maps/locations/pendola-pass.jpg',
    tacticalImage: 'game-maps/tactical/pendola-pass.jpg',
    hasUnderground: false,
    defaultLayer: 0,
    layers: [{ id: 0, label: '地表雪山', enLabel: 'SURFACE', image: 'game-maps/tactical/pendola-pass.jpg' }],
    dumpFile: 'F:/arc-export/mapareas-pendolapass.txt',
    worldPosX: -81000.0,
    worldPosY: -81000.0,
    worldSizeX: 162000.0,
    worldSizeY: 162000.0,
    biome: '极寒高山观测站 / 坠落帝王残骸 / 冰封铁路网',
    worldPos: { x: 68.0, y: 21.0 },
    wikiUrl: 'https://arcraiders.wiki/wiki/Pendola_Pass',
    loreDesc:
      '坐落于高海拔极寒雪峰之巅的科学山口。长达两百米的巨型四足机甲残骸横亘在冰封山谷之中，东北峰顶则耸立着俯瞰群山的深空观测站。',
    summary:
      '坐落于高海拔极寒雪峰之巅的科学山口。长达 200 米的巨型四足机甲【坠落帝王 (Fallen Emperor)】横亘在阿尔马特拉村西侧山谷，东北峰顶则耸立着【晴空深空观测站】。内置完整的【坠落帝王 3D 迷宫/路线/压机解谜器】。',
    supportedEvents: [
      'standard-patrol',
      'night-raid',
      'fallen-emperor',
      'arc-frigate',
    ],
    rotationCycle: [
      { primary: 'standard-patrol', secondary: null },
      { primary: 'fallen-emperor', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'night-raid', secondary: null },
      { primary: 'standard-patrol', secondary: null },
      { primary: 'arc-frigate', secondary: null },
    ],
    linkedStages3D: [
      {
        stageKey: 'walker',
        title: '雪山 · 坠落帝王 3D 机关图',
        badge: '3套迷宫 × 6条动态路线 × 粉碎压机',
        poiId: 'pp-fallen-emperor',
      },
    ],
    poiOverrides: {
      'Fallen Emperor': {
        id: 'pp-fallen-emperor',
        linkedStage: 'walker',
        keyRequired: '帝王门户导管 (Emperor Gateway Conduit)',
        desc: '坠毁在阿尔马特拉村西侧峡谷的巨型四足帝王机甲。内部包含 4 层甲板、3 套随机分拣迷宫、6 条动态路线与定时巨型粉碎压机！点击可直接进入 3D 内部路线导航图。',
      },
      'Cielo Sereno Observatory': {
        id: 'pp-observatory',
        keyRequired: '彭多拉观测站钥匙 (Pendola Pass Observatory Key)',
        desc: '位于东北山顶盆地的离巢时代射电深空观测站，任务【探索彭多拉山口】需进入主楼中层控制室检索科技终端。',
      },
      'Old Town': {
        id: 'pp-old-town',
        keyRequired: '彭多拉老城钥匙 (Pendola Pass Old Town Key)',
        desc: '全图容器密度最高的传统山地街区（单局约 77 个搜索点），使用老城钥匙可开启高价值封闭公寓。',
      },
      Railyard: {
        id: 'pp-railyard',
        keyRequired: '彭多拉编组站钥匙 (Pendola Pass Railyard Key)',
        desc: '东南货运枢纽，矗立着全图最高的通讯铁塔（任务【探索彭多拉山口】需利用滑索登顶并用 1 根导线修复天线）。',
      },
      'Almatera Station': {
        id: 'pp-train-station',
        keyRequired: '彭多拉火车站钥匙 (Pendola Pass Train Station Key)',
        desc: '连接高山缆车与货运铁轨的客运站台，毗邻军需超市，适合补充医疗品与食品。',
      },
    },
    additionalPois: [
      {
        id: 'pp-shelter-north-tracks-l0-z2',
        name: '防寒紧急避难舱 #1 (北轨)',
        enName: 'Emergency Shelter (Northern Tracks)',
        x: 53.06,
        y: 23.7,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于北部铁道区的极寒避难舱（Flash Freeze Hatch），暴风雪期间可进入舱内快速恢复体温并补充基础物资。',
      },
      {
        id: 'pp-shelter-dispatch-nw-l0-z2',
        name: '防寒紧急避难舱 #2 (调度塔西北)',
        enName: 'Emergency Shelter (Dispatch NW)',
        x: 45.14,
        y: 31.77,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于调度塔西北侧雪坡的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-observatory-w-l0-z2',
        name: '防寒紧急避难舱 #3 (天文台西)',
        enName: 'Emergency Shelter (Observatory W)',
        x: 67.75,
        y: 41.1,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于晴空深空观测站西侧山道的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-station-e-l0-z2',
        name: '防寒紧急避难舱 #4 (火车站东)',
        enName: 'Emergency Shelter (Station E)',
        x: 51.54,
        y: 41.47,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于阿尔马特拉火车站东侧铁轨旁的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-junction-s-l0-z2',
        name: '防寒紧急避难舱 #5 (铁路枢纽南)',
        enName: 'Emergency Shelter (Junction S)',
        x: 58.31,
        y: 52.21,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于铁路枢纽南侧冰谷的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-frozen-river-l0-z2',
        name: '防寒紧急避难舱 #6 (冰封河谷)',
        enName: 'Emergency Shelter (Frozen River)',
        x: 47.91,
        y: 53.97,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于中央冰封河谷大桥北侧的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-weather-sw-l0-z2',
        name: '防寒紧急避难舱 #7 (气象站西南)',
        enName: 'Emergency Shelter (Weather Station SW)',
        x: 69.89,
        y: 55.41,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于高山气象站西南侧与铁路编组站北侧之间的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-old-town-w-l0-z2',
        name: '防寒紧急避难舱 #8 (老城区西)',
        enName: 'Emergency Shelter (Old Town W)',
        x: 27.17,
        y: 60.8,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于老城区西侧与坠落帝王南端交界处的极寒防冻避难舱。',
      },
      {
        id: 'pp-shelter-south-pass-l0-z2',
        name: '防寒紧急避难舱 #9 (南山口)',
        enName: 'Emergency Shelter (Southern Pass)',
        x: 59.09,
        y: 71.0,
        layer: 0,
        zoom: 2,
        threat: 0,
        lootTags: ['Medical', 'Raider'],
        poiKind: 'shelter',
        desc: '位于南山口与装卸站台西侧之间的极寒防冻避难舱。',
      },
      {
        id: 'pp-old-town-puzzle-door-l0-z2',
        name: '老城区序列密码门金库',
        enName: 'Old Town Sequence Puzzle Vault',
        x: 35.61,
        y: 63.41,
        layer: 0,
        zoom: 2,
        threat: 2,
        lootTags: ['Residential', 'OldWorld'],
        desc: '老城区东侧的随机序列按钮密码门（BP_InteractiveDoor_RandomizedSequencePuzzleDoor），按正确顺序激活外围指示灯开关即可开启。',
      },
    ],
    lockedRooms: [
      {
        id: 'key-pp-conduit',
        keyName: '帝王门户导管 (Emperor Gateway Conduit)',
        rarity: 'legendary',
        poiName: '坠落帝王核心舱室入口',
        x: 27.31,
        y: 50.97,
        layer: 0,
        lootSummary: '开启坠落帝王深层反应堆与 16 座耦合器核心金库',
      },
      {
        id: 'key-pp-observatory',
        keyName: '彭多拉观测站钥匙 (Pendola Pass Observatory Key)',
        rarity: 'epic',
        poiName: '晴空深空观测站核心机房',
        x: 68.87,
        y: 39.08,
        layer: 0,
        lootSummary: '深空导航模块、磁控管、高阶电子件与武器蓝图',
      },
      {
        id: 'key-pp-railyard',
        keyName: '彭多拉编组站钥匙 (Pendola Pass Railyard Key)',
        rarity: 'rare',
        poiName: '铁路编组站受控接收设施',
        x: 66.13,
        y: 59.97,
        layer: 0,
        lootSummary: '工业军火箱、高级机械元件与重型弹药',
      },
      {
        id: 'key-pp-oldtown',
        keyName: '彭多拉老城钥匙 (Pendola Pass Old Town Key)',
        rarity: 'uncommon',
        poiName: '阿尔马特拉老城区西侧上锁公寓',
        x: 30.95,
        y: 63.55,
        layer: 0,
        lootSummary: '高密度民居珍品、保暖装备与奇袭者硬币',
      },
      {
        id: 'key-pp-station',
        keyName: '彭多拉火车站钥匙 (Pendola Pass Train Station Key)',
        rarity: 'uncommon',
        poiName: '阿尔马特拉车站站长室',
        x: 43.89,
        y: 42.46,
        layer: 0,
        lootSummary: '安保储物柜、医疗箱与工具包',
      },
    ],
  },
]

// ============================================================================
// 7. Fetch Official Live Schedule from https://arcraiders.com/map-conditions
// ============================================================================
const OFFICIAL_MAP_NAME_TO_ID = {
  'Dam Battlegrounds': 'dam-battlegrounds',
  'Buried City': 'buried-city',
  Spaceport: 'spaceport',
  'The Blue Gate': 'blue-gate',
  'Stella Montis': 'stella-montis',
  'Riven Tides': 'riven-tides',
  'Pendola Pass': 'pendola-pass',
}

const OFFICIAL_COND_NAME_TO_ID = {
  'ARC Frigate': 'arc-frigate',
  Beachcombing: 'buried-treasure',
  'Bird City': 'bird-city',
  'Close Scrutiny': 'close-scrutiny',
  'Cold Snap': 'cold-snap',
  'Electromagnetic Storm': 'electromagnetic-storm',
  Harvester: 'harvester',
  'Hidden Bunker': 'hidden-bunker',
  Hurricane: 'hurricane',
  'Husk Graveyard': 'husk-graveyard',
  'Launch Tower Loot': 'launch-tower-loot',
  'Locked Gate': 'locked-gate',
  'Lush Blooms': 'lush-blooms',
  Matriarch: 'matriarch',
  'Night Raid': 'night-raid',
  'Prospecting Probes': 'prospecting-probes',
  Redirection: 'fallen-emperor',
  'Uncovered Caches': 'uncovered-caches',
}

const OFFICIAL_MAJOR_CONDITION_IDS = new Set([
  'arc-frigate',
  'close-scrutiny',
  'cold-snap',
  'electromagnetic-storm',
  'hidden-bunker',
  'hurricane',
  'locked-gate',
  'night-raid',
])

for (const [evId, evObj] of Object.entries(MAP_EVENTS)) {
  evObj.officialType =
    evId === 'standard-patrol'
      ? 'standard'
      : OFFICIAL_MAJOR_CONDITION_IDS.has(evId)
        ? 'major'
        : 'minor'
}

async function fetchOfficialScheduleFromEmbark() {
  const url = 'https://arcraiders.com/map-conditions'
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const match = html.match(/\{\\"conditionItems\\":\[[\s\S]*?\\"serverNow\\":\d+\}/)
    if (!match) throw new Error('Could not find conditionItems payload in HTML')
    const unescaped = JSON.parse(`"${match[0]}"`)
    const data = JSON.parse(unescaped)

    const typeByCondName = new Map(
      (data.conditionItems || []).map((c) => [c.name, c.type]),
    )

    const entries = []
    for (const raw of data.liveEntries || []) {
      const mapId = OFFICIAL_MAP_NAME_TO_ID[raw.mapDisplayName]
      const eventId = OFFICIAL_COND_NAME_TO_ID[raw.conditionName]
      if (!mapId || !eventId) continue
      const officialType =
        typeByCondName.get(raw.conditionName) ||
        (OFFICIAL_MAJOR_CONDITION_IDS.has(eventId) ? 'major' : 'minor')

      entries.push({
        mapId,
        eventId,
        conditionName: raw.conditionName,
        mapDisplayName: raw.mapDisplayName,
        officialType,
        durationInSeconds: raw.durationInSeconds || 3600,
        startTimestamp: raw.startTimestamp,
        endTimestamp: raw.endTimestamp,
        regionTimestamps: raw.regionTimestamps || null,
      })
    }

    if (entries.length === 0) throw new Error('Parsed 0 schedule entries')

    const minStartTimestamp = Math.min(...entries.map((e) => e.startTimestamp))
    const maxEndTimestamp = Math.max(...entries.map((e) => e.endTimestamp))

    console.log(
      `Fetched official Embark schedule from ${url}: ${entries.length} entries (${new Date(minStartTimestamp).toISOString()} ~ ${new Date(maxEndTimestamp).toISOString()})`,
    )

    return {
      sourceUrl: url,
      fetchedAt: Date.now(),
      serverNow: data.serverNow || Date.now(),
      windowDurationMs: 3600000,
      minStartTimestamp,
      maxEndTimestamp,
      entries,
    }
  } catch (err) {
    console.warn(`Warning: Live fetch from ${url} failed (${err.message}), checking existing snapshot...`)
    try {
      const existing = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'src/data/mapsWikiData.json'), 'utf8'),
      )
      if (existing.officialSchedule?.entries?.length) {
        return existing.officialSchedule
      }
    } catch {
      // ignore
    }
    return null
  }
}

const officialSchedule = await fetchOfficialScheduleFromEmbark()

const MAPS = RAW_MAPS.map((spec) => {
  const { pois, lootZones, extractions } = parseGameMapDump(spec)
  const { dumpFile, poiOverrides, additionalPois, ...cleanSpec } = spec

  // If we have the official schedule, build the map's hourly rotationCycle directly from the real 42-hour timeline
  let rotationCycle = cleanSpec.rotationCycle
  if (officialSchedule?.entries?.length) {
    const minStart = officialSchedule.minStartTimestamp
    const maxEnd = officialSchedule.maxEndTimestamp
    const totalHours = Math.max(1, Math.round((maxEnd - minStart) / 3600000))
    const realCycle = []
    for (let h = 0; h < totalHours; h++) {
      const slotStart = minStart + h * 3600000
      const slotEntries = officialSchedule.entries.filter(
        (e) => e.mapId === cleanSpec.id && e.startTimestamp === slotStart,
      )
      const majorEntry = slotEntries.find((e) => e.officialType === 'major')
      const minorEntry = slotEntries.find((e) => e.officialType === 'minor')
      realCycle.push({
        primary: majorEntry ? majorEntry.eventId : 'standard-patrol',
        secondary: minorEntry ? minorEntry.eventId : null,
      })
    }
    if (realCycle.length > 0) {
      rotationCycle = realCycle
    }
  }

  const mapResult = {
    ...cleanSpec,
    rotationCycle,
    pois,
    lootZones,
    extractions,
  }
  mapResult.eventMarkers = buildEventMarkersForMap(mapResult)
  mapResult.trialMarkers = buildTrialMarkersForMap(mapResult)
  mapResult.plantMarkers = buildPlantMarkersForMap(mapResult)
  mapResult.plantZones = buildPlantZonesForMap(mapResult)
  mapResult.eliteArcMarkers = buildEliteArcMarkersForMap(mapResult)
  mapResult.eliteArcZones = buildEliteArcZonesForMap(mapResult)
  return mapResult
})

// ============================================================================
// 8. Write src/data/mapsWikiData.json
// ============================================================================
const mapsWikiPayload = {
  updatedFrom:
    'PioneerGame/Content/Pioneer/Maps/DA_MapAreaInfo_*_P + https://arcraiders.com/map-conditions + arcraiders.wiki',
  worldMapImage: 'game-maps/world-calabretta.jpg',
  excludedMaps: ['Practice Range (靶场已按规划排除)'],
  servers: SERVERS,
  events: MAP_EVENTS,
  trialCategories: TRIAL_CATEGORIES,
  plantCategories: PLANT_CATEGORIES,
  eliteArcCategories: ELITE_ARC_CATEGORIES,
  officialSchedule,
  maps: MAPS,
}

fs.writeFileSync(
  path.join(ROOT, 'src/data/mapsWikiData.json'),
  JSON.stringify(mapsWikiPayload, null, 2),
  'utf8'
)
console.log(
  `Wrote src/data/mapsWikiData.json: ${MAPS.length} maps, ${MAPS.reduce((acc, m) => acc + m.pois.length, 0)} official POIs, ${MAPS.reduce((acc, m) => acc + m.extractions.length, 0)} official extractions, ${officialSchedule?.entries?.length || 0} official schedule entries`
)

// ============================================================================
// 8. Upgrade src/data/questsData.json with full multi-map linkage (mapIds)
// ============================================================================
const questsPath = path.join(ROOT, 'src/data/questsData.json')
const questsJson = JSON.parse(fs.readFileSync(questsPath, 'utf8'))

const MAP_NAME_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m.name]))

function resolveQuestMaps(q) {
  const locText = q.location || 'Any'
  const matched = []

  const add = (id) => {
    if (!matched.includes(id)) matched.push(id)
  }

  if (/Dam Battlegrounds/i.test(locText)) add('dam-battlegrounds')
  if (/Buried City/i.test(locText)) add('buried-city')
  if (/Spaceport/i.test(locText)) add('spaceport')
  if (/Blue Gate/i.test(locText)) add('blue-gate')
  if (/Stella Montis/i.test(locText)) add('stella-montis')
  if (/Riven Tides/i.test(locText)) add('riven-tides')
  if (/Pendola Pass/i.test(locText)) add('pendola-pass')

  if (matched.length === 0) {
    if (/Frigate/i.test(locText) || (q.campaigns || []).includes('Shrouded_Sky')) {
      add('spaceport')
      add('dam-battlegrounds')
    } else if ((q.campaigns || []).includes('Frozen_Trail')) {
      add('pendola-pass')
      add('stella-montis')
    } else if ((q.campaigns || []).includes('Riven_Tides')) {
      add('riven-tides')
    }
  }

  return matched
}

function resolveQuestTargetPois(q, mapIds) {
  const t = `${q.title || ''} ${q.zhTitle || ''}`
  const pois = []
  if (mapIds.includes('buried-city')) {
    if (/Library|图书馆/i.test(t)) pois.push('bc-library')
    if (/Hospital|Medical|医/i.test(t)) pois.push('bc-hospital')
    if (/Town Hall|市政厅/i.test(t)) pois.push('bc-town-hall')
    if (/Plaza|Rosa|Pharmacy|药/i.test(t)) pois.push('bc-plaza-rosa')
  }
  if (mapIds.includes('dam-battlegrounds')) {
    if (/Water|水处理/i.test(t)) pois.push('dam-water-treatment')
    if (/Hydroponic|水培|农/i.test(t)) pois.push('dam-hydroponic-dome')
    if (/Tower|控制塔/i.test(t)) pois.push('dam-control-tower')
    if (/Baron|男爵|Battleground/i.test(t)) pois.push('dam-old-battleground')
  }
  if (mapIds.includes('pendola-pass')) {
    if (/Observatory|观测/i.test(t)) pois.push('pp-observatory')
    if (/Emperor|Walker|帝王/i.test(t)) pois.push('pp-fallen-emperor')
    if (/Railyard|编组站/i.test(t)) pois.push('pp-railyard')
  }
  if (mapIds.includes('blue-gate')) {
    if (/Refuge|避难所/i.test(t)) pois.push('bg-raiders-refuge')
    if (/Fort|要塞/i.test(t)) pois.push('bg-ancient-fort')
  }
  return pois
}

const QUEST_ZH_DESCRIPTIONS = {
  'picking-up-the-pieces': '部署至任意地表战区，前往带有战利品分类图标的资源点搜刮至少 3 个容器，熟悉地表搜刮与安全撤离流程后返回向萨尼复命。',
  'clearer-skies': '在任意战区击毁 3 架低空巡逻的 ARC 飞行无人机（如“黄蜂” Wasp 或“马蜂” Hornet），并搜刮提交 3 个【ARC合金】以协助萨尼清理领空。',
  'trash-into-treasure': '深入地表工业或电力战区搜刮 1 块【电池】与 6 根【导线】，带回斯佩兰扎交予萨尼用于基地基础设施抢修。',
  'off-the-radar': '前往任意地表战区的【野战仓库 (Field Depot)】，攀爬至屋顶交互修复受损的通信天线，恢复奇袭者前哨雷达链路。',
  'a-bad-feeling': '在地表战区寻找任意坠毁的【ARC 勘探探针 (ARC Probe)】或【ARC 信使 (ARC Courier)】，撬开外壳完成调查并搜刮内部黑匣数据。',
  'hatch-repairs': '前往任意战区的【奇袭者暗门 (Raider Hatch)】位置，靠近暗门外部输气管线完成交互抢修，完成后将在暗门旁刷出 1 把免费奇袭者暗门钥匙。',
  'the-right-tool': '实战武器火力测试：在任意地表战区使用枪械或手雷成功摧毁 1 台【火球 (Fireball)】、1 架【“马蜂” (Hornet)】与 1 座【哨戒炮塔 (Turret)】。',
  'down-to-earth': '前往战区内的【野战仓库 (Field Depot)】，在周边搜寻重型【野外物资箱 (Field Crate)】，将其搬运至补给站内的交付槽位解锁丰厚补给。',
  'a-better-use': '在指定战区内找到呼叫终端，请求投放 1 次【奇袭者空投补给 (Supply Drop)】，等待空投舱降落后开启并搜刮其中的战略物资。',
  'the-trifecta': '猎杀三种主力侦察/护卫无人机：击毁“马蜂”、告密者（Snitch）与“黄蜂”，各收集 2 个核心驱动器/扫描仪带回交给萨尼。',
  'greasing-her-palms': '为塞莱斯特勘察三处关键禁区：前往大坝战场【水处理控制中心】上锁检查室、掩埋废城【航天大楼】6楼推进器外侧，以及太空港【火箭组装厂】外围完成交互探查。',
  'dormant-barons': '前往大坝战场【旧战场】、太空港或蓝门，寻获巨型【男爵残骸 (Baron Husk)】，攀爬至残骸顶部强行撬开核心舱（注意触发火焰喷射后迅速退避，待冷却后再上前搜刮）。',
  'what-we-left-behind': '搜寻三处奇袭者旧营地：前往掩埋废城【南站】地下停车场、大坝战场【南沼泽哨站】以及太空港【白沙丘】藏匿处，各搜刮 2 个容器。',
  'broken-monument': '前往大坝战场东侧的【废料场 (Scrap Yard)】，在巨型机械残骸旁先后寻获“第一波”的【指南针】、【军用口粮】与【旧磁带】并在单局内安全撤离带出。',
  'marked-for-death': '前往掩埋废城西北角的【苏阿雷斯药房 (Su Durante Warehouses)】，调查外墙上的奇袭者记号并循线索追查失踪侦察员的下落。',
  'straight-record': '前往大坝战场北部的【胜利岭 (Victory Ridge)】，找到旧时代EMP陷阱信标，依次关闭北侧、东侧与南侧的 3 处电源开关以解除区域威胁。',
  'market-correction': '前往掩埋废城【马拉诺车站 (Marano Station)】附近的书报亭，定位并破坏隐藏在废墟后的走私者秘密物资箱。',
  'doctor-s-orders': '为医疗商兰斯筹集急救物资：在医疗点位或水培生态区搜集 1 份【耐磨布料】、1 株【大毛蕊花】、1 支【注射器】与 2 瓶【防腐剂】。',
  'keeping-the-memory': '前往大坝战场东北部的【残骸谷 (Wreckage)】，在废墟间找到阵亡奇袭者的遗留头盔，将其捧回纪念柱旁安放致敬。',
  'eyes-on-the-prize': '携带至少 3 根【导线】前往掩埋废城西南侧（罗莎广场南面）的隐蔽屋顶天台，利用导线修复屋顶太阳能供电线路。',
  'medical-merchandise': '前往太空港【出发航站楼】医务室、大坝战场【研究与行政中心】二楼医疗室以及掩埋废城【医院】，搜刮医疗容器获取紧缺药品。',
  'echoes-of-victory-ridge': '前往大坝战场【胜利岭】断桥下方的旧军营帐篷，从战术指挥盒中取回任务物品【艾娃少校的臂章】并安全撤离交付塞莱斯特。',
  'industrial-espionage': '携带天玟提供的【布尔莱塔 (Burletta)】手枪前往掩埋废城北部的【工业外围】，将武器秘密存放在燃气管道区的指定军火交接箱内。',
  'a-reveal-in-ruins': '前往掩埋废城的任意药店（如阿布斯托药房或玫瑰广场药房）或蓝门村庄药房，在室内柜台后方搜寻 1 台【ESR分析仪】并带出移交兰斯。',
  'unexpected-initiative': '前往掩埋废城实现温室计划：在【奢华公寓】屋顶花园取得【水分测量仪】，并前往【罗马广场】南侧康维尼奥破败屋顶花园寻获【营养测量仪】，一并带出交给天玟。',
  'a-lay-of-the-land': '前往太空港【江苏仓库 (Jiangsu Warehouse)】二楼调度官室取得航运清单，随后前往【1号控制塔】顶层露天平台搜出【激光雷达扫描仪】并撤离。',
  'a-symbol-of-unification': '前往大坝战场西南湖畔的【福尔米卡前哨站 (Formica Outpost)】，在营地寻获【奇袭者旗帜】并在可俯瞰红湖的露台旗杆处将其升起。',
  'eyes-in-the-sky': '先后前往大坝战场【控制塔】屋顶、掩埋废城【画廊】天台招牌顶以及太空港【通讯塔】高处，在三处制高点安装激光雷达扫描信标。',
  'celeste-s-journals': '在单局部署中前往大坝战场：先后从【南沼泽哨站】与北部【奇袭者前哨东】床铺旁取回 2 本【塞莱斯特的日记】并成功撤离。',
  'the-major-s-footlocker': '前往大坝战场西北角的【红宝石住宅区 (Ruby Residence)】，在二楼卧室寻获【艾娃少校的纪念品】并在单局内安全带回。',
  'a-balanced-harvest': '前往大坝战场中央的【研究与行政中心 (Research & Administration)】，进入上层温室实验室终端下载农业基因改良档案。',
  'back-on-top': '巡视四座战区标志性建筑并用喷漆做上记号：大坝战场【壁画屋】、蓝门仓储综合区以南的【白色瞭望塔】、太空港【南壕沟塔】与掩埋废城【埋没的楼群】内的壁画建筑。',
  'untended-garden': '前往大坝战场北部的【水培穹顶建筑群 (Hydroponic Dome Complex)】，访问穹顶内的中央植物培养档案库，将实验数据上传至野战仓库终端。',
  'our-presence-up-there': '前往大坝战场西南侧的【模式屋 (Pattern House)】，开启底层配电室电源开关，随后登上屋顶操作天线完成讯号发射。',
  'after-rain-comes': '携带 2 块【电池】与 5 根【导线】前往掩埋废城【奢华公寓】东侧被积水淹没的太阳能阵列，修复浸水电路恢复供电。',
  'the-root-of-the-matter': '前往大坝战场【研究与行政中心】带绝佳视野的房间，或掩埋废城【科研中心】大楼，从低温培养罐中搜出【实验型种子样品】并安全撤离交给塞莱斯特。',
  'lost-in-transmission': '前往太空港南侧的【6号控制塔 (Control Tower A6)】，登上塔顶控制室使用终端建立安全通讯连接。',
  'water-troubles': '前往大坝战场【红湖观景台】下方的泄洪隧道（下层长廊西侧进水口），潜入区域供水入口对蓄水池水源进行采样。',
  'communication-hideout': '前往掩埋废城老城区的【红塔 (Red Tower)】，找到电池单元装入发电机并启动电源，随后开启红塔附近的天线终端。',
  'into-the-fray': '猎杀重型跳跃机甲：摧毁 1 台【跳跃者 (Leaper / Bison)】，从其残骸中拆取 1 枚【“跳跃者”脉冲单元】并带回交给萨尼。',
  'source-of-the-contamination': '前往大坝战场【水处理控制中心 (Water Treatment Control)】北侧的【泛滥泄洪池】，调查水体中泄露的化学原料桶以查明污染源。',
  'paving-the-way': '先前往任意艾纳里卡（ENELICA）建筑公告板查阅研究员便条，随后前往掩埋废城【罗马广场】康维尼奥大楼上方的顶层公寓，在研究员加密终端上核对研究数据。',
  'switching-the-supply': '前往太空港发射塔下方的地下维护隧道，找到主输水管道阀门并手动转动手轮切换供水管线。',
  'deciphering-the-data': '前往太空港北部的【燃料控制区】与中部的【抵达航站楼】，在两处磁能解密终端上依次运行破译程序。',
  'a-warm-place-to-rest': '前往掩埋废城【废弃高速公路营地】，寻访幸存者留下的背包，随后顺着沿途插有红布条的木桩找寻最终的安息墓碑。',
  'groundbreaking': '前往蓝门的【朝圣者之峰】上锁房间搜寻建筑研究资料，随后找到白板上描绘的【废弃的住宅工程】并完成拍摄。',
  'dust-on-the-wires': '前往太空港东侧任意野战仓库使用电台发送侦察队日志，随后前往【维护区机库】北侧的旧奇袭者塔楼互动终端并搜查遗物，将【侦察巡逻报告】交给萨尼。',
  'prescriptions-of-the-past': '前往太空港【出发航站楼 (Departure Building)】，进入二楼医疗体检室翻找旧时代的医疗处方档案。',
  'a-dead-end': '深入蓝门地下【安保翼楼（螫蝎地下设施）】，进入受控上锁房间搜寻“常青计划”记录，并在尘封放映室取回 1 卷【布满灰尘的电影胶卷】交给萨尼。',
  'power-out': '前往太空港【变电站 / 电力站】，找到备用发电机电池组并将其装入配电盒，合闸恢复区域照明与电力。',
  'fragmented-logs': '携带 1 个【电子元件】前往星辰山：先在【机器人沙盘】控制室修复故障终端，随后接通沙盘附近管道后勤室的电源，最后前往上层【文化档案馆】后勤室启动主机数据终端。',
  'flickering-threat': '前往大坝战场【发电厂建筑群 (Power Generation Complex)】，深入底层涡轮机房修复受损的主发电机。',
  'furtive-meetings': '深入星辰山搜寻三处秘密集会点：1) 【医学研究部】南侧楼梯下方；2) 下层【机器人沙盘B区】与【种子库】之间的通风井旁；3) 连接【文化档案馆】与【种子库】的楼梯底部，搜查取得【秘密集会情报】交给萨尼。',
  'bees-': '前往蓝门南部的【橄榄园 (Olive Grove)】，在蜂箱群旁小心采集蜂蜜与蜂群生态样本。',
  'last-entry': '前往星辰山下层的【种子库 (Seed Vault)】，在工作站获取线索并从相邻房间找回隐藏钥匙，开启种子存放箱取回【官方关停文件】。',
  'espresso': '深入掩埋废城或大坝战场的咖啡吧台，找到一台浓缩咖啡机拆取可用零件，将【浓缩咖啡机零件】带回给阿波罗。',
  'line-in-the-sand': '前往掩埋废城沙丘交界防线，部署警报信标并清理盘踞在街区入口的 ARC 巡逻队。',
  'safe-passage': '使用手雷或爆炸物摧毁至少 2 台阻碍通行道口的 ARC 护卫机甲（如哨兵或火球），开辟安全撤离通道。',
  'life-of-a-pharmacist': '前往掩埋废城崩塌高架桥旁的【阿布斯托药房】及二楼药剂师旧居，依次记录药剂师的技能、品味、家人与爱好。',
  'safe-harbor': '前往裂潮镇【蔚蓝全景酒店】餐厅后厨查找员工留下的素描线索，随后前往素描描绘的西南海岸线长椅旁，挖出掩埋的【精密云台】并安全撤离交给天玟。',
  'reduced-to-rubble': '前往蓝门的【公路塌方区 (Highway Collapse)】，在断桥拍下坍塌现场照片，随后穿过【破碎大地】前往坠机残骸调查。',
  'in-my-image': '部署至星辰山，在设施内找到并搜索 3 具类人仿生机器人（Androids）以解析其核心记录。',
  'what-goes-around': '拾取被击毁的【火球】掉落的【“火球”燃烧炉 (Fireball Burner)】，将其作为投掷燃烧弹扔向任意 ARC 敌机并将其烧毁。',
  'tribute-to-toledo': '制作或搜刮 1 根【能量管 (Power Rod)】，带回斯佩兰扎提交给塞莱斯特用于点亮托莱多纪念区。',
  'a-wrench-in-the-works': '潜入太空港工业维修车间，破坏 ARC 自动化后勤信标并取回工坊调校扳手。',
  'exploring-pendola-pass': '前往彭多拉山口：先后登上东北【晴空深空观测站】中层控制室检索终端，再前往东南【铁路编组站】利用滑索登上高塔顶端修复天线。',
  'clean-hands': '在彭多拉山口雪原中追踪走私者交易点，在不触发周边重型机甲警报的前提下取走加密账本。',
  'with-a-trace': '前往蓝门西南侧的【荒芜空地 (Barren Clearing)】与【饰钉山脊】，调查被击落的巨型银翼残骸与球形黄色通信装置。',
  'cold-storage': '前往星辰山装卸区与地铁站台，搜刮任意 J. Kozma Ventures 白色保温货柜，取回【旧世界之书】交给萨尼。',
  'sparks-fly': '使用【响指手雷 (Snap Blast)】或【扳机手雷】直接炸毁 1 架【“马蜂” (Hornet)】无人机，完成阿波罗的爆破测试。',
  'digging-up-dirt': '前往掩埋废城【圣玛丽亚建筑群 (Santa Maria Houses)】，从屋顶天窗或滑索潜入阁楼与内庭院，挖出埋藏在沙土中的机密黑料盒。',
  'home-to-roost': '深入蓝门地下通行隧道扫描任意机器人，随后前往隧道中段的【螫蝎更衣室】查阅车辆称重记录并寻获隐藏钥匙，开启【没收物库房】将最新安保录音传输给萨尼。',
  'shoring-up-defenses': '在裂潮镇摧毁 5 架“黄蜂”与 3 架“萤火虫”，携带 1 块【ARC合金】攀爬至【堆料场】起重机顶部加固奇袭者建筑，并用木板封住【蔚蓝全景酒店】的百叶窗。',
  'worth-your-salt': '前往太空港【火箭组装厂 (Rocket Assembly)】，在高层平台红色工具柜旁找到隐藏电池，为充能终端通电并完成充能。',
  'wires-crossed': '跨战区收集三类核心组件：1 个【“哨卫”发射核心】、1 个【“告密者”扫描仪】与 1 个【“勘测师”保险库】并交付工坊。',
  'taking-stock': '前往星辰山上层【中庭 (Atrium)】清点并交互检查储物箱库存。',
  'the-clean-dream': '前往太空港地下维护隧道监测过滤净化系统并搜刮容器，随后前往蓝门【维护地堡】监测净水系统并带回【净化系统蓝图】交给阿波罗。',
  'snap-and-salvage': '前往星辰山下层【沙盘】检查任意星际探测车，在上层【大厅】安全检查站寻找研究文件，并将 1 个【磁控管】与 1 个【流量控制器】交给天玟。',
  'out-of-the-shadows': '合力击毁高威胁飞行火力机甲【火箭兵 (Rocketeer)】，从其坠落残骸中回收 1 个【“火箭手”引擎】。',
  'building-a-library': '前往掩埋废城中央的【图书馆 (Library)】，在书架间搜寻 1 本言情小说、1 本侦探小说与 1 本冒险小说并带回交给阿波罗。',
  'someone-else-s-shoes': '在星辰山扫描任意机器人，随后前往上层【医学研究部】3号研究实验室找到指定机器人，最后抵达下层【西侧地道】控制室搜寻线索。',
  'nothing-ventured': '高阶猎杀筹备：收集 3 个【“彗星”点火器】、3 个【“火箭手”引擎】、6 块【ARC线圈】与 6 个【ARC运动核心】。',
  'boarding-the-frigate': '在【ARC“护卫者”】事件期间，从双舷战壕击破吊桥弱点，利用抓钩或滑索强行登舰并进入护卫舰中层走廊（可点击左侧地标 3D 按钮查看登舰路线）。',
  'sizing-things-up': '前往彭多拉山口围绕【倒下的“帝王”】展开全面勘测：1) 拍摄老城区外大桥旁的帝王腿部照片；2) 破开阿尔玛特拉站旁坠毁探测器并检查电路；3) 分析铁路枢纽旁帝王腿部外露区；4) 深入帝王底部搜寻埋藏的收割者空投，将【ARC导电耦合器】交给塞莱斯特。',
  'a-toxic-trail': '返回大坝战场【水处理控制中心】下方的供水口，在沼泽浅滩中搜寻油桶来源的痕迹，传输倾覆运毒卡车的位置并搜查破坏者线索。',
  'tracks-of-the-beast': '沿着彭多拉山口雪谷中【坠落帝王】踩踏出的巨型机械足印追踪，扫描沿途散落的机甲装甲碎片。',
  'the-league': '前往大坝战场【水塔】拍摄球门照片并寻找【自行车气筒】，再前往掩埋废城【马拉诺公园】旁报刊亭拍摄足球杂志并拾取【瘪掉的足球】，一并交给阿波罗。',
  'celeste-s-childhood-drawings': '前往裂潮镇追寻塞莱斯特的往昔印记：1) 在【蔚蓝全景酒店】找到她少年时的房间搜寻旧物；2) 找到【海关大楼】第三栋屋顶的画作；3) 找到东侧【船舶码头】栈桥处的画作。',
  'ruins-and-reverberations': '携带 1 个【“侦察员”中继器】前往彭多拉山口【古老废墟】，在高山回音壁架设谐振信标。',
  'a-path-not-yours': '在蓝门【高速公路崩塌区】下方找到游民路径起点，沿着路径标记前往西端悬崖的【比尔根庇护所】，在下方埋藏储物箱与秘密储备箱中取回【破损罗盘】交付游牧使团。',
  'outstanding-balance': '前往蓝门地下【通行隧道】寻找道奇的秘密储备箱，随后登上东北角【朝圣峰】天线塔顶搜查交易地点，找回【道奇的笔记】交给天玟。',
  'with-a-view': '携带 1 个【回转式编码器】前往星辰山上层【组装厂装配线】附近的控制室启动服务器开关，随后与室内电脑互动识别部件，并将 1 台【离子溅射仪】交给萨尼。',
  'on-deaf-ears': '在星辰山上层：1) 在【大厅】接待处电脑查找研究员访客记录；2) 在【礼堂】讲台查阅讲座笔记；3) 在【医学研究部】电脑查找原型信息；4) 在【组装厂车间】找到打印的货运日志。',
  'combat-recon': '前往掩埋废城探查【停车场】楼梯间、【马拉诺公园】巴士内或【主街】阁楼的掩护点，摧毁 2 架“侦察员”并将 1 个【“侦察员”中继器】交给萨尼。',
  'a-new-type-of-plant': '前往大坝战场【旧战场】男爵残骸周边，采集 1 株在机械辐射下变异的【可能有毒的植物】并交给兰斯化验。',
  'empathetic-prototypes': '前往太空港高科技研发区，在实验室保险柜中寻获【“悲怆计划”共情核心】并安全撤离。',
  'the-first-nomads': '跨三图追查初代游牧民信号：1) 在蓝门【安保翼楼】控制室使用变频器并检查【朝圣峰】天线增幅器；2) 在星辰山【通讯站】辅楼修复变压器并接入变频器；3) 在太空港【外围隐藏地堡】传输球体位置并探索淹水地窖、服务器大厅、监控室与发电机房。',
  'keeping-an-eye-out': '前往蓝门荒芜空地南缘的【高速公路崩塌区】，沿着悬崖小径找到西端的【比尔根庇护所】并搜寻有关他下落的线索。',
  'a-first-foothold': '巩固蓝门前线：前往：1) 【山脊瞭望塔】修复屋顶通信盘；2) 【橄榄园】西侧农舍启动终端；3) 【捕兽者林中空地】固定农舍屋顶铁皮；4) 【数据金库】固定北侧教堂屋顶卫星天线。',
  'battening-down': '在裂潮镇执行三项防灾任务：1) 沿着【防波堤】与【港务局】拍摄海堤上的裂缝；2) 在【蔚蓝海滩】海岸线采集样本；3) 前往东北部海堤修复漏油管道。',
  'to-the-skies': '筹集升空强化材料：上交 1 份【ARC高性能钢】、1 份【ARC合成树脂】、1 份【ARC隔热衬里】与 1 个【“爆爆”触发器】。',
  'mixed-signals': '在任意战区追踪并摧毁滚球状的【ARC “勘测师” (Surveyor)】，拾取并带出 1 个【“勘测师”保险库 (Surveyor Vault)】。',
  'clamoring-for-attention': '在蓝门制造声响引开ARC：1) 用 3 根【导线】修复并鸣响【综合仓库群】旁的紧急警报器；2) 用 1 块【电池】启动【村庄】内的音响；3) 鸣响【检查站】旁的任意巴士喇叭。',
  'waking-the-grid': '在太空港唤醒安保电网：1) 在任意守卫塔启动安保传感器；2) 在【候机楼】启动安保控制中心；3) 前往【到达楼】数据办公室搜寻安保入侵痕迹。',
  'a-rising-tide': '先前往掩埋废城【罗马广场】南侧找到设下路障的工头公寓访问数字日志，随后前往大坝战场【发电厂综合体】设法进入【受控访问区】，搜寻工头重建项目的线索。',
  'collision-course': '在任意战区击毁高速冲撞型 ARC 单位，回收 1 枚【“彗星”点火器】提交给军火商。',
  'turnabout': '前往太空港【北战壕塔 (North Trench Tower)】，登上塔楼将存放在机密终端内的黑客数据上传至斯佩兰扎网络。',
  'a-prime-specimen': '前往蓝门【破碎地貌】东侧或西侧林地的双层脉冲发生器【伐木手 (Deforester)】，利用 2 块【ARC能量电池】先后解除内外两道火焰喷射陷阱并搜刮终端数据。',
  'nothing-gained': '终极巨兽讨伐证明：击败【“族母” (Matriarch)】与收割者护卫【“女王” (Queen)】，各取回 1 枚核心反应堆！',
  'disrupting-the-frigate': '登上【ARC“护卫者”】，依次击毁 4 台酸雾风扇与 10 座旋转护盾核心，并在底层货舱操作双棘轮夺取护卫舰核心模块（可点击进入 3D 机关图查看全部点位）。',
  'the-stench-of-corruption': '前往太空港【出发航站楼】一楼西南角更衣室，搜寻挂有安全背心的衣架取得【冲洗终端钥匙】，随后下到地下隧道开启排污控制室大门。',
  'bait-fetch-blast': '携带 1 枚【“恶霸”破片弹】前往彭多拉山口，利用诱饵信标引出重装机甲并将其炸毁。',
  'belly-of-the-beast': '深入彭多拉山口【坠落帝王】机甲内部，穿越随机分拣迷宫与定时粉碎压机室，抵达中央反应堆核心舱完成扫描（支持 3D 迷宫路线图联动）。',
  'test-case': '收集三类燃烧/驱动核心：上交 1 个【“火球”燃烧炉】、1 个【“萤火虫”燃烧炉】与 1 个【“马蜂”引擎】供工坊测试。',
  'celeste-s-teenage-rebellion': '前往裂潮镇：1) 登上中央【穆拉蒂拉山丘】瞭望塔传输位置并标记 3 个 ARC 单位；2) 前往海滩北侧旧奇袭者营地搜寻无线电发射器；3) 前往港口东北悬崖的大型天线处焊接发电机并启动发射器。',
  'divided': '前往彭多拉山口的四处地点搜寻游民录音：1) 【装卸站台】；2) 【高山气象站】；3) 【调度塔】；4) 【阿尔马特拉火车站】。',
  'settled-in-full': '在任意战区重创并摧毁重型装甲单位【堡垒 (Bastion)】，拆取 1 枚【“堡垒”电池】全额抵清军火债务。',
  'movie-night': '前往星辰山上层【文化档案馆】西侧休息区或掩埋废城住宅公寓，搜刮 1 台【便携电视】与 1 摞【一堆电影录像带】交给阿波罗筹办电影之夜。',
  'stable-housing': '前往星辰山上层【安全桥】与研发室，破译保险箱取回【常青计划蓝图】并安全撤离。',
  'on-the-map': '在太空港完成四处位置打卡与标记：1) 【燃料管道】断裂处；2) 【燃料控制单元】附近天线；3) 围墙缺口处的仙人掌丛；4) 【集装箱仓库】大楼屋顶，并标记盖有防水布的容器。',
  'bombing-run': '在任意战区猎杀高空轰炸机甲【“投弹手” (Bombardier)】，利用掩体规避迫击炮弹幕并将其彻底击毁。',
  'armored-transports': '前往蓝门【检查站 (Checkpoint)】，在哨亭内搜寻【巡逻车钥匙】，随后进入后方蓝色门禁隧道搜刮上锁的装甲运兵车。',
  'where-everything-falls': '前往太空港中央发射区与陨落残骸坑，调查轨道坠落物并取回黑匣记录仪。',
}

function buildQuestDescription(q, mapIds) {
  if (QUEST_ZH_DESCRIPTIONS[q.id]) {
    return QUEST_ZH_DESCRIPTIONS[q.id]
  }
  const mapText = mapIds.length
    ? `前往【${mapIds.map((id) => MAP_NAME_BY_ID[id]).join(' / ')}】战区`
    : '部署至任意地表战区'
  const reqText =
    q.zhRequiredItems && q.zhRequiredItems !== '无须携带特定任务物品'
      ? `，搜集或携带任务关键物资（${q.zhRequiredItems}）`
      : '，根据地图引导前往目标点位完成交互调查'
  return `${mapText}${reqText}，完成后安全撤离返回斯佩兰扎向${(q.zhTrader || '').split(' (')[0]}交付任务。`
}

let specificMapQuestCount = 0
for (const q of questsJson.quests) {
  const mapIds = resolveQuestMaps(q)
  q.mapIds = mapIds
  q.primaryMapId = mapIds[0] || null
  q.zhLocations = mapIds.length ? mapIds.map((id) => MAP_NAME_BY_ID[id]) : ['任意战区']
  q.targetPoiIds = resolveQuestTargetPois(q, mapIds)
  q.zhDescription = buildQuestDescription(q, mapIds)

  if (mapIds.length === 1) {
    const m = MAPS.find((item) => item.id === mapIds[0])
    q.zhLocation = `${m.name} (${m.enName})`
    q.mapCategory = m.id
    specificMapQuestCount++
  } else if (mapIds.length > 1) {
    q.zhLocation = mapIds.map((id) => MAP_NAME_BY_ID[id]).join(' / ')
    q.mapCategory = mapIds[0]
    specificMapQuestCount++
  } else {
    q.zhLocation = '任意战区 (Any Topside Map)'
    q.mapCategory = 'any'
  }
}

fs.writeFileSync(questsPath, JSON.stringify(questsJson, null, 2), 'utf8')
console.log(`Updated src/data/questsData.json: ${specificMapQuestCount}/${questsJson.quests.length} quests mapped to specific playable maps`)

// ============================================================================
// 9. Upgrade src/data/questResourcesData.json dailyTrials with mapIds & eventId
// ============================================================================
const resPath = path.join(ROOT, 'src/data/questResourcesData.json')
const resJson = JSON.parse(fs.readFileSync(resPath, 'utf8'))

const trialLinkage = {
  'trial-01': { mapIds: ['dam-battlegrounds', 'spaceport', 'blue-gate'], eventId: 'night-raid' },
  'trial-02': { mapIds: ['spaceport', 'dam-battlegrounds', 'blue-gate'], eventId: 'electromagnetic-storm' },
  'trial-03': { mapIds: ['spaceport'], eventId: 'hidden-bunker' },
  'trial-04': { mapIds: ['dam-battlegrounds', 'buried-city'], eventId: 'standard-patrol' },
  'trial-05': { mapIds: ['dam-battlegrounds', 'blue-gate', 'buried-city'], eventId: 'lush-blooms' },
  'trial-06': { mapIds: ['pendola-pass'], eventId: 'fallen-emperor' },
}

for (const tr of resJson.dailyTrials || []) {
  const link = trialLinkage[tr.id]
  if (link) {
    tr.recommendedMapIds = link.mapIds
    tr.recommendedEventId = link.eventId
  }
}

fs.writeFileSync(resPath, JSON.stringify(resJson, null, 2), 'utf8')
console.log('Updated src/data/questResourcesData.json dailyTrials with recommendedMapIds and recommendedEventId')

// Automatically apply official Simplified Chinese (zh-Hans) localization from Game.locres
await import('./applyOfficialLocalization.mjs')
