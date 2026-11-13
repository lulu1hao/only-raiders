// Quest Map Rules — Part 2 (Quests 63 to 123)

export const QUEST_RULES_PART2 = {
  'what-goes-around': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'tribute-to-toledo': {
    cat: 'item-collect',
    mode: 'none',
    targets: {},
  },
  'a-wrench-in-the-works': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-arrival-building', label: '到达楼西侧工业维修区', sub: '破坏后勤信标并取回扳手' }],
        landmarks: [
          { x: 33.16, y: 41.5, title: '工业车间调校台与信标', area: '到达楼西南侧 · 维修辅楼1F车间', type: 'interact', detail: '前往候机楼与到达楼西侧的外围工业维修车间，在黄色工作台旁破坏ARC后勤信标并取回工坊调校扳手。' },
        ],
      },
    },
  },
  'exploring-pendola-pass': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'pendola-pass': {
        zones: [
          { poi: 'pp-observatory', label: '晴空天文台 (步骤①)', sub: '中层控制室检索终端' },
          { poi: 'pp-railyard', label: '铁路站场 (步骤②)', sub: '乘滑索登高塔顶端修复天线' },
        ],
        landmarks: [
          { step: 1, x: 71.91, y: 37.89, title: '天文台观测主控终端', area: '晴空天文台 · 中层圆顶控制室', type: 'interact', detail: '前往地图东北角的晴空天文台，进入主穹顶中层控制室，在弧形仪表台终端上检索深空记录。', targetXY: [66.41, 62.33] },
          { step: 2, x: 66.41, y: 62.33, title: '编组站高塔通信天线', area: '铁路站场 · 东侧高耸调度铁塔顶', type: 'interact', detail: '前往东南侧的铁路站场，利用铁塔垂直滑索登上塔顶平台，交互修复受损的通信天线。' },
        ],
      },
    },
  },
  'clean-hands': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'pendola-pass': {
        zones: [{ poi: 'pp-old-town', label: '老城区走私交易区', sub: '隐秘潜入取走加密账本' }],
        landmarks: [
          { x: 34.58, y: 63.26, title: '走私者加密账本', area: '老城区 · 中央石砌酒馆2F暗室桌面', type: 'collect', item: '拾取：走私者加密账本', detail: '避开街区外围巡逻的重型机甲，从老城区西侧小巷进入二层石屋，在木桌抽屉上取走加密账本。' },
        ],
      },
    },
  },
  'with-a-trace': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [
          { poi: 'bg-barren-clearing-l0-z2', r: 46, label: '荒芜空地 (步骤①)', sub: '调查银翼坠机残骸' },
          { poi: 'bg-adorned-wreckage-l0-z1', r: 46, label: '庄严残骸 (步骤②)', sub: '检查黄色球形通信装置' },
        ],
        landmarks: [
          { step: 1, x: 25.63, y: 39.97, title: '击落的银翼战机残骸', area: '荒芜空地 · 西侧林间弹坑', type: 'interact', detail: '前往蓝门最西侧的荒芜空地，在男爵残骸西边的树林空地中调查银白色机翼碎片。', targetXY: [30.85, 49.48] },
          { step: 2, x: 30.85, y: 49.48, title: '球形黄色通信装置', area: '庄严残骸 · 倾斜树干形金属梁前方', type: 'interact', detail: '往南走到庄严残骸，在巨大倾斜金属残骸正前方的地面上找到黄黑相间的球形通信舱交互调查。' },
        ],
      },
    },
  },
  'cold-storage': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-loading-bay', label: '装卸区与地铁大厅低温货柜', sub: '保温冷柜内寻获旧世界之书' }],
        landmarks: [
          { step: 1, x: 34.58, y: 51.55, layer: 1, title: '装卸区低温保温容器 #1', area: '上层 · 装卸区 (Loading Bay) 货台白色冷链箱', type: 'collect', item: '拾取：旧世界之书', detail: '前往星辰山装卸区货台，打开结霜的白色保温冷链箱，在内部拾取【旧世界之书】并安全撤离。' },
          { step: 2, x: 59.87, y: 33.03, layer: 0, title: '地铁大厅北侧低温容器 #2 (备选)', area: '下层 · 大厅地铁站台旁保温箱', type: 'collect', item: '拾取：旧世界之书', detail: '备选点位：下层大厅地铁站台北侧的白色保温冷柜。' },
        ],
      },
    },
  },
  'sparks-fly': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'digging-up-dirt': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-santa-maria-houses-l0-z1', r: 44, label: '圣玛丽亚住宅区', sub: '从屋顶潜入内庭院沙土挖掘黑料盒' }],
        landmarks: [
          { x: 50.38, y: 65.15, title: '掩埋的机密黑料盒 (Dead Drop)', area: '圣玛丽亚住宅区 · 建筑群封闭内庭院沙堆中央', type: 'interact', detail: '爬上圣玛丽亚住宅区屋顶，从破损天窗或顶楼滑索降入一楼封闭中庭沙地，在中央圆盘状喷泉沙堆处交互挖出黑料盒。' },
        ],
      },
    },
  },
  'home-to-roost': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-security-wing-l1-z0', layer: 1, r: 48, label: '地下层 · 安保翼楼员工休息室与没收室', sub: '寻获没收室钥匙卡并破坏白色通讯装置' }],
        landmarks: [
          { step: 1, x: 54.85, y: 35.18, layer: 1, title: '1. 安保翼楼员工休息室大门', area: '地下层 · 安保翼楼北端员工休息室门禁', type: 'interact', detail: '切换至蓝门【地下层】地图，前往安保翼楼北端，打开员工休息室大门。', targetXY: [53.0, 39.82] },
          { step: 2, x: 53.0, y: 39.82, layer: 1, title: '2. 员工更衣室红衣服旁钥匙卡', area: '地下层 · 安保翼楼中段更衣室 (MANTIS Locker Room)', type: 'collect', item: '拾取：没收室钥匙卡', detail: '进入安保翼楼中段的员工更衣室，在挂有红色衣物的工作柜旁搜寻并拾取【没收室钥匙卡】。', targetXY: [50.84, 41.58] },
          { step: 3, x: 50.84, y: 41.58, layer: 1, title: '3. 没收室金库 & 白色通讯装置', area: '地下层 · 安保翼楼西侧没收室 (Confiscation Room)', type: 'interact', item: '使用：没收室钥匙卡', detail: '用刚拾取的钥匙卡打开西侧【没收室】防爆门，破坏桌上的白色通讯装置即可完成任务并搜刮金库。' },
        ],
      },
    },
  },
  'shoring-up-defenses': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'riven-tides': {
        zones: [{ poi: 'rt-grand-hotel', r: 48, label: '高架桥防御工事与商业街卷帘门', sub: '勘察高架桥第一波防线并关闭商店卷帘门' }],
        landmarks: [
          { step: 1, x: 64.01, y: 50.54, title: '1. 高架桥下第一波防御工事 #1', area: '南部高架桥北段 · 防御沙袋阵地', type: 'interact', detail: '前往裂潮镇东南部高架桥下方，调查旧时代第一波机械浪潮遗留的防御工事。', targetXY: [56.33, 51.77] },
          { step: 2, x: 56.33, y: 51.77, title: '2. 高架桥下第一波防御工事 #2', area: '海滨大道东端高架桥下 · 重机枪掩体', type: 'interact', detail: '顺着高架桥向西调查第二处第一波防御掩体。', targetXY: [30.77, 63.45] },
          { step: 3, x: 30.77, y: 63.45, title: '3. 废弃商店金属卷帘门开关 #1', area: '蔚蓝全景大酒店东侧 · 商业街店铺门口', type: 'interact', detail: '前往蔚蓝全景大酒店东侧商业街，拉下开关降下废弃商店的金属卷帘门。', targetXY: [29.01, 63.98] },
          { step: 4, x: 29.01, y: 63.98, title: '4. 废弃商店金属卷帘门开关 #2', area: '蔚蓝全景大酒店东南 · 街角店铺门口', type: 'interact', detail: '在相邻的街角店铺门口关闭第二道金属卷帘门。' },
        ],
      },
    },
  },
  'worth-your-salt': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-rocket-assembly', label: '火箭组装区', sub: '2F拿隐藏电池，充能后去北端终端交付' }],
        landmarks: [
          { step: 1, x: 60.53, y: 41.99, title: '隐藏电池原型箱', area: '火箭组装区 · 西南角2F铁架猫道红柜旁', type: 'collect', item: '搬运：隐藏电池原型', detail: '从火箭组装厂西侧铁梯上二楼金属走道，在尽头红色立式工具柜后的白色箱子内取出电池原型。', targetXY: [61.0, 42.8] },
          { step: 2, x: 61.0, y: 42.8, title: '高架机械充能台', area: '火箭组装区 · 中央2F大型蓝色控制台', type: 'interact', item: '操作：为电池充能', detail: '抱着电池走到中央二楼平台，放入插槽拉下开关完成充能，再取出充满电的电池。', targetXY: [61.51, 41.48] },
          { step: 3, x: 61.51, y: 41.48, title: '电池交付暗箱', area: '火箭组装区 · 1F东北角小门外墙角', type: 'interact', item: '交付：充满电的电池', detail: '抱着充满电的电池下到一楼东北角出口内侧，装入墙角的白色方形交接盒完成任务。' },
        ],
      },
    },
  },
  'wires-crossed': {
    cat: 'area-combat',
    mode: 'landmark',
    recMap: 'blue-gate',
    targets: {
      'blue-gate': {
        landmarks: [
          { x: 71.96, y: 34.55, title: '测量员 (Surveyor) 高频刷新与巡弋区', area: '朝圣者峰东侧山坡 · 测量员巡逻线', type: 'collect', item: '击毁并搜刮：测量员残骸', detail: '寻找向天空发射蓝色激光信标的大型球体【测量员 (Surveyor)】，将其击毁后在残骸中搜刮独特电子部件。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { x: 47.7, y: 41.67, title: '测量员 (Surveyor) 高频巡弋区', area: '发射塔北侧停机坪 · 测量员巡逻线', type: 'collect', item: '击毁并搜刮：测量员残骸', detail: '在太空港中央发射塔周边开阔地寻找发射蓝色光束的【测量员】，击毁并搜刮其残骸。' },
        ],
      },
      'buried-city': {
        landmarks: [
          { x: 29.84, y: 66.85, title: '测量员 (Surveyor) 高频巡弋区', area: '奢华公寓东侧沙丘 · 测量员巡逻线', type: 'collect', item: '击毁并搜刮：测量员残骸', detail: '在掩埋废城西南部开阔沙街寻找【测量员】，击毁并搜刮其残骸。' },
        ],
      },
    },
  },
  'taking-stock': {
    cat: 'item-deliver',
    mode: 'landmark',
    recMap: 'stella-montis',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-atrium', label: '上层 · 中庭南侧信号放大器终端', sub: '搜刮或携带信号放大器装入终端' }],
        landmarks: [
          { x: 58.67, y: 61.01, layer: 1, title: '远距通讯信号放大器插槽', area: '上层 · 中庭 (Atrium) 南侧控制室终端', type: 'deliver', item: '需交付：1× 信号放大器', detail: '在局内科技箱搜刮或提前携带1个【信号放大器】，前往星辰山【上层】中庭南侧控制室，将其安装至通讯终端插槽。' },
        ],
      },
    },
  },
  'the-clean-dream': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-launch-towers', label: '发射塔西侧地下隧道 (步骤①)', sub: '在地下维护隧道监测4个净化罐' }],
        landmarks: [
          { step: 1, x: 44.67, y: 45.84, layer: 1, title: '地下设施隧道4处净化储水罐 #1', area: '发射塔西侧地下维护隧道 · 储水罐大厅', type: 'interact', detail: '从出发航站楼东侧斜坡进入地下维护隧道（切换至地下图层可见），在摆放4个大型白色圆柱净化罐的房间内交互监测。', targetXY: [42.31, 38.8] },
          { step: 2, x: 42.31, y: 38.8, layer: 1, title: '地下隧道北段净化罐室 #2 (备选)', area: '到达楼东南侧地下隧道 · 北端净水室', type: 'interact', detail: '顺着地下隧道向北也可找到第二组净化储水罐。' },
        ],
      },
      'blue-gate': {
        zones: [{ poi: 'bg-maintenance-bunker-l0-z2', r: 46, label: '维护区地堡 · 拍照与调查区', sub: '步骤②：进入地堡监测净水系统并拍照蓝图' }],
        landmarks: [
          { step: 3, x: 53.73, y: 59.12, title: '净水系统与蓝图拍照点', area: '维护区地堡 · 地下主厅大罐体与2F控制室白板', type: 'photo', detail: '从维护区地堡地面大通风口滑索下到底层，先调查中央巨型净水罐，再上楼梯进小控制室对墙上的蓝图拍照。' },
        ],
      },
    },
  },
  'snap-and-salvage': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [
          { poi: 'sm-sandbox-l0-z1', r: 46, label: '下层 · 沙盘 (拍照范围)', sub: '步骤①：对准沙盘内的漫游者拍照' },
        ],
        landmarks: [
          { step: 1, x: 49.74, y: 50.06, layer: 0, title: '星际漫游者拍照点', area: '下层 · 机器人沙盘 (Sandbox) 中央大型漫游车旁', type: 'photo', detail: '切至星辰山【下层】，进入中央沙盘测试场，站在巨型多轮星际漫游车正面按交互键拍照。', targetXY: [65.12, 33.55] },
          { step: 2, x: 65.12, y: 33.55, layer: 1, title: '安全检查站研究档案', area: '上层 · 大厅北侧安全检查站办公室桌面', type: 'interact', detail: '前往大厅北侧的安全检查站办公室，撬门进入后在桌面的绿色文件夹处交互翻找研究记录（并在局内搜刮磁控管与流量控制器交付给田文）。' },
        ],
      },
    },
  },
  'out-of-the-shadows': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'building-a-library': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-library', label: '图书馆 · 珍本搜寻区', sub: '单局内在1F与2F书架集齐3册珍本图书' }],
        landmarks: [
          { step: 1, x: 45.72, y: 35.75, title: '浪漫主义图书 (1/3)', area: '图书馆 · 1F大厅东侧矮书架', type: 'collect', item: '拾取：浪漫本', detail: '进入图书馆一楼大厅，在东侧靠窗的木制小书架中层拾取第一本书。', targetXY: [44.87, 34.3] },
          { step: 2, x: 44.87, y: 34.3, title: '侦探悬疑图书 (2/3)', area: '图书馆 · 1F北侧高书柜', type: 'collect', item: '拾取：侦探本', detail: '在一楼通往二楼的楼梯转角左侧书架上拾取第二本书。', targetXY: [43.17, 36.58] },
          { step: 3, x: 43.17, y: 36.58, title: '奇幻冒险图书 (3/3)', area: '图书馆 · 2F西侧环廊阅读区书架', type: 'collect', item: '拾取：奇幻本', detail: '走楼梯上至图书馆二楼西侧环廊，在阅览桌后的立式书架上拾取第三本书并安全撤离。' },
        ],
      },
    },
  },
  'someone-else-s-shoes': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-sandbox-l0-z1', r: 44, label: '下层 · 快递无人机与广播终端', sub: '寻获调音器包裹并在广播终端播放音乐' }],
        landmarks: [
          { step: 1, x: 53.18, y: 56.63, layer: 0, title: '坠毁快递无人机与调音器包裹', area: '下层 · 机器人沙盘南侧走廊无人机残骸', type: 'collect', item: '拾取：音频调谐器包裹', detail: '切至星辰山【下层】，在机器人沙盘南侧走廊找到坠毁的快递无人机，拾取散落的【音频调谐器】包裹。', targetXY: [22.52, 64.53] },
          { step: 2, x: 22.52, y: 64.53, layer: 1, title: '医学研究部南翼广播终端', area: '上层 · 医学研究部南侧控制室', type: 'interact', detail: '前往【上层】医学研究部南侧控制室，将调音器接入广播系统。', targetXY: [36.62, 50.95] },
          { step: 3, x: 36.62, y: 50.95, layer: 1, title: '装卸区主扩音器控制台', area: '上层 · 装卸区 (Loading Bay) 北侧调度室', type: 'interact', detail: '前往装卸区北侧调度室，启动主扩音器向全设施播放音乐。' },
        ],
      },
    },
  },
  'nothing-ventured': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'boarding-the-frigate': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-the-trench-l0-z2', r: 56, label: '北侧战壕 · 护卫舰登舰区', sub: '击破双舷吊桥弱点，用滑索/抓钩登舰' }],
        landmarks: [
          { x: 55.45, y: 33.93, title: 'ARC“护卫者”登舰切入点', area: '北侧壕沟上空 · 护卫舰底部吊桥舱门', type: 'interact', linkedStage: 'frigate', detail: '在【ARC“护卫者”】事件期间，在战壕掩体后射击护卫舰两侧黄色吊桥弱点使其放下，用抓钩或滑索登舰进入中层走廊（可点击下方按钮打开3D登舰路线图）。' },
        ],
      },
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-red-lakes-l0-z0', r: 60, label: '红湖空域 · 护卫舰巡航区', sub: '击破吊桥弱点登舰' }],
        landmarks: [
          { x: 69.57, y: 47.91, title: '红湖护卫舰登舰点', area: '红湖干涸湖床 · 护卫舰悬停处', type: 'interact', linkedStage: 'frigate', detail: '当护卫舰在红湖上空悬停时，击破吊桥弱点利用滑索登舰。' },
        ],
      },
    },
  },
  'sizing-things-up': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'pendola-pass': {
        zones: [{ poi: 'pp-fallen-emperor', r: 56, label: '倒下的“帝王” · 四处高地勘察范围', sub: '依次登上3处山脊高地观测并靠近帝王号残骸勘测' }],
        landmarks: [
          { step: 1, x: 45.84, y: 64.52, title: '1. 老城区东侧山坡高地观测点', area: '老城区东坡 · 俯瞰冰谷高地', type: 'interact', detail: '前往彭多拉山口老城区东侧山坡制高点，交互观测远处的帝王号残骸。', targetXY: [34.22, 41.5] },
          { step: 2, x: 34.22, y: 41.5, title: '2. 冰封河谷西岸悬崖观测点', area: '倒下的“帝王”东北侧 · 河谷悬崖高地', type: 'interact', detail: '前往冰封河谷西岸悬崖高地，完成第二处远距观测。', targetXY: [59.15, 48.81] },
          { step: 3, x: 59.15, y: 48.81, title: '3. 中转隧道东口山脊观测点', area: '中转隧道东侧 · 高山瞭望点', type: 'interact', detail: '前往中转隧道东口山脊高地，完成第三处远距观测。', targetXY: [35.19, 51.4] },
          { step: 4, x: 35.19, y: 51.4, title: '4. 倒下的“帝王”东侧腿部勘测点', area: '倒下的“帝王”东侧 · 机甲主舱门外围', type: 'collect', item: '拾取：ARC导电耦合器', linkedStage: 'walker', detail: '靠近西侧【倒下的“帝王”】巨型残骸东侧腿部与主舱口，完成近距离勘测并拾取导电耦合器。' },
        ],
      },
    },
  },
  'a-toxic-trail': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [
          { poi: 'dam-water-treatment', label: '水处理控制中心北侧泄洪池', sub: '步骤①：前往泄洪池调查毒桶并顺流向西追踪' },
          { poi: 'dam-swamp-l0-z0', r: 55, label: '湿地毒桶拍照范围', sub: '步骤②：对卡车残骸拍照明确责任方' },
        ],
        landmarks: [
          { step: 1, x: 40.34, y: 47.55, title: '排污渠进水口毒桶', area: '水处理控制中心北侧 · 排水格栅泄洪池', type: 'interact', detail: '先到水处理控制中心北侧污水沟，检查格栅旁漂浮的化工毒桶。', targetXY: [37.55, 46.9] },
          { step: 2, x: 37.55, y: 46.9, title: '沼泽倾覆运毒卡车拍照点', area: '湿地 (Swamp) 东缘 · 泥潭半沉没货运卡车', type: 'photo', detail: '顺着污水流向往西走约100米进入湿地东缘，找到车厢散落毒桶的半沉没卡车，站在车旁按交互键拍照并搜查线索。' },
        ],
      },
    },
  },
  'tracks-of-the-beast': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'pendola-pass': {
        zones: [{ x: 34.22, y: 41.5, r: 58, label: '帝王号雪谷足迹追踪区', sub: '沿雪地巨型脚印扫描散落的装甲碎片' }],
        landmarks: [
          { step: 1, x: 38.5, y: 38.2, title: '巨兽机械足印 #1', area: '欢迎大门西北雪坡 · 1号深坑足印', type: 'interact', detail: '在欢迎大门西北侧雪原找到巨大的圆形踩踏焦坑，交互扫描坑边的机甲碎片。', targetXY: [34.22, 41.5] },
          { step: 2, x: 34.22, y: 41.5, title: '巨兽机械足印 #2 & 装甲板', area: '倒下的“帝王”东北侧 · 断裂冰谷', type: 'interact', detail: '顺着雪地焦黑足印向西南走到帝王号残骸前方的冰沟，扫描脱落的主装甲板完成追踪。' },
        ],
      },
    },
  },
  'the-league': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-water-towers-l0-z2', r: 46, label: '水塔球门 · 拍照与收集区', sub: '拍摄简易球门并在旁拾取打气筒' }],
        landmarks: [
          { step: 1, x: 34.58, y: 62.97, title: '简易金属足球门与打气筒', area: '水塔 · 西南侧高架水塔正下方空地', type: 'photo', item: '拾取：自行车气筒', detail: '前往大坝西南角的水塔，在白色金属水塔支架下对着简易球门拍照，并在旁边的红色工具箱上拾取【自行车气筒】。' },
        ],
      },
      'buried-city': {
        zones: [{ poi: 'bc-marano-park-l0-z2', r: 44, label: '马拉诺公园与车站书报亭', sub: '在街边绿顶书报亭内拾取瘪掉的足球与赛事杂志' }],
        landmarks: [
          { step: 2, x: 49.86, y: 45.39, title: '瘪掉的足球与杂志 (马拉诺公园西)', area: '马拉诺公园西侧 · 街角墨绿色书报亭', type: 'collect', item: '拾取：瘪掉的足球', detail: '前往掩埋废城中央马拉诺公园西侧街角的墨绿色书报亭，拾取【瘪掉的足球】与足球杂志。' },
          { step: 3, x: 33.36, y: 32.37, title: '瘪掉的足球与杂志 (马拉诺车站旁)', area: '马拉诺车站东北侧 · 墨绿色书报亭', type: 'collect', item: '拾取：瘪掉的足球', detail: '备选点位：西北部马拉诺车站东北侧街角的墨绿色书报亭。' },
        ],
      },
    },
  },
  'celeste-s-childhood-drawings': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'riven-tides': {
        zones: [{ poi: 'rt-mulatierra-hill-l0-z0', r: 48, label: '裂潮镇三处童年涂鸦搜寻点', sub: '在旧公寓、骡丘学校与海堤木屋寻回童年涂鸦' }],
        landmarks: [
          { step: 1, x: 29.58, y: 64.83, title: '1. 蔚蓝全景酒店东侧旧公寓涂鸦', area: '蔚蓝全景大酒店东侧 · 2F儿童房墙面与抽屉', type: 'collect', item: '拾取：童年涂鸦 #1', detail: '前往裂潮镇西侧蔚蓝全景大酒店东侧的居民楼二楼，在儿童房拾取第一份童年涂鸦。', targetXY: [49.72, 70.11] },
          { step: 2, x: 49.72, y: 70.11, title: '2. 骡丘旧学校教室涂鸦画册', area: '骡丘 (Mulatierra Hill) 南端 · 2F旧教室课桌', type: 'collect', item: '拾取：童年涂鸦 #2', detail: '前往中南部骡丘住宅群南端的二楼旧学校教室，在课桌抽屉里取回第二份涂鸦画册。', targetXY: [78.39, 49.09] },
          { step: 3, x: 78.39, y: 49.09, title: '3. 集装箱堆场南岸海堤小屋涂鸦', area: '集装箱堆场南侧 · 临海木屋', type: 'collect', item: '拾取：童年涂鸦 #3', detail: '前往最东侧集装箱堆场南岸的临海小屋，取回第三份童年涂鸦。' },
        ],
      },
    },
  },
  'ruins-and-reverberations': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'pendola-pass': {
        zones: [{ poi: 'pp-observatory', label: '晴空天文台外围回音壁', sub: '需携带1×“侦察员”中继器' }],
        landmarks: [
          { x: 71.07, y: 38.88, title: '高山回音壁谐振信标座', area: '晴空天文台南侧 · 悬崖声学反射架', type: 'deliver', item: '需携带：1× “侦察员”中继器', detail: '携带1个【“侦察员”中继器】（击毁观察员Spotter掉落）前往晴空天文台南侧悬崖边，将中继器装入声学谐振支架并激活。' },
        ],
      },
    },
  },
  'a-path-not-yours': {
    cat: 'item-collect',
    mode: 'landmark',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-highway-collapse-l0-z2', r: 52, label: '高速公路崩塌区至比尔古恩藏身处', sub: '循红布条木桩路标寻找悬崖信箱与日志' }],
        landmarks: [
          { step: 1, x: 36.41, y: 60.01, title: '1. 奇袭者石堆路标起点', area: '高速公路崩塌区北侧 · 林间绑红布条木桩', type: 'interact', detail: '前往蓝门西南部高速公路崩塌区北缘，找到绑有红布条的奇袭者路标木桩，顺着向西延伸的线索前进。', targetXY: [26.8, 57.71] },
          { step: 2, x: 26.8, y: 57.71, title: '2. 比尔古恩的藏身处悬崖信箱', area: '比尔古恩的藏身处 (Bilguun\'s Hideout) · 西南悬崖边', type: 'collect', item: '拾取：奇袭者信件与遗物', detail: '沿着红布条木桩一路向西抵达悬崖边的【比尔古恩的藏身处】，在掩体旁的信箱处完成交互并取回遗物。' },
        ],
      },
    },
  },
  'outstanding-balance': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [
          { poi: 'bg-data-vault', label: '数据仓库地下室 (步骤①)', sub: '搜寻未结清账单记录' },
          { poi: 'bg-pilgrims-peak', label: '朝圣者峰通信室 (步骤②)', sub: '在2F控制室终端核销记录' },
        ],
        landmarks: [
          { step: 1, x: 55.8, y: 34.15, layer: 1, title: '1. 数据仓库地下室加密账本', area: '数据仓库 (Data Vault) 地下层 · 档案柜桌面', type: 'collect', item: '拾取：未结清账目记录', detail: '前往蓝门北部的数据仓库地下层，在服务器机房旁的办公桌上读取并拾取账目记录。', targetXY: [71.22, 33.79] },
          { step: 2, x: 71.22, y: 33.79, layer: 0, title: '2. 朝圣者峰通信塔终端', area: '朝圣者峰 · 北侧塔楼2F通信控制室', type: 'interact', detail: '前往东北角的朝圣者峰二楼控制室，在终端处上传并核销账单记录。' },
        ],
      },
    },
  },
  'with-a-view': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [
          { poi: 'sm-medical-research', r: 44, label: '上层 · 西翼控制室与西北通讯廊', sub: '用回转式编码器开门，操作彩色电缆终端并拾取信号转换器' },
        ],
        landmarks: [
          { step: 1, x: 13.82, y: 40.93, layer: 1, title: '1. 西翼控制室回转式编码器电闸', area: '上层 · 医学研究部北侧控制间外墙', type: 'interact', item: '需携带：1× 回转式编码器', detail: '携带1个【回转式编码器】前往星辰山【上层】西翼（医学研究部北侧），在墙面控制盒装入编码器拉下红色电闸开门。', targetXY: [12.24, 41.17] },
          { step: 2, x: 12.24, y: 41.17, layer: 1, title: '2. 内室彩色电缆服务器电脑', area: '上层 · 编码器解锁房间内部电脑桌', type: 'interact', detail: '进入刚开启的控制室，在连接着彩色粗电缆的亮屏电脑终端上交互读取信号。', targetXY: [24.77, 27.08] },
          { step: 3, x: 24.77, y: 27.08, layer: 1, title: '3. 西北环廊信号转换器箱', area: '上层 · 西北角通讯走廊终端箱', type: 'collect', item: '拾取：信号转换器', detail: '前往上层西北角走廊，在设备箱中拾取【信号转换器】并安全撤离交付给夏妮。' },
        ],
      },
    },
  },
  'on-deaf-ears': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [
          { poi: 'sm-lobby', label: '上层 · 大厅接待处 (步骤①)', sub: '查阅访客日志' },
          { poi: 'sm-auditorium-l1-z2', r: 42, label: '上层 · 礼堂与医学研究部/车间', sub: '步骤②③④：访问讲台电脑、打印机与电话终端' },
        ],
        landmarks: [
          { step: 1, x: 60.36, y: 35.6, layer: 1, title: '1. 大厅接待台访客电脑', area: '上层 · 大厅 (Lobby) 2F西侧服务台', type: 'interact', detail: '前往星辰山上层大厅二楼西侧走道，在护栏边的办公电脑上查阅研究员访客名单。', targetXY: [70.21, 47.88] },
          { step: 2, x: 70.21, y: 47.88, layer: 1, title: '2. 礼堂主讲台笔记终端', area: '上层 · 礼堂 (Auditorium) 阶梯讲台', type: 'interact', detail: '进入大厅东南侧的阶梯礼堂，走到最下方演讲台终端处读取讲座笔记。', targetXY: [20.73, 55.61] },
          { step: 3, x: 20.73, y: 55.61, layer: 1, title: '3. 医学研究部办公隔间打印机', area: '上层 · 医学研究部中央办公室复印机', type: 'interact', detail: '前往西侧医学研究部中央办公隔间，在落地式复印机处交互打印撤离警告记录。', targetXY: [35.52, 26.65] },
          { step: 4, x: 35.52, y: 26.65, layer: 1, title: '4. 组装车间西北主管室电话终端', area: '上层 · 组装车间西北侧控制室', type: 'interact', detail: '前往北部组装车间西北侧主管办公室，调查桌面上的内部通讯电话终端。' },
        ],
      },
    },
  },
  'combat-recon': {
    cat: 'area-combat',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [
          { poi: 'bc-parking-garage-l0-z2', r: 44, label: '停车场顶楼侦察点', sub: '在防水布掩体下观察并击毁2架黄蜂' },
          { poi: 'bc-marano-park-l0-z2', r: 44, label: '马拉诺公园侦察点', sub: '在公园高架棚下观察并猎杀黄蜂' },
          { poi: 'bc-plaza-rosa', r: 44, label: '老城区南端钟楼侦察点', sub: '在顶楼露台望远镜旁完成侦察猎杀' },
        ],
        landmarks: [
          { step: 1, x: 51.92, y: 35.87, title: '1. 停车场顶层狙击观察位', area: '停车场 · 顶层西北角蓝白防水布帐篷内', type: 'interact', detail: '登上停车场最顶层，走入西北角搭着遮阳布的观察位交互打钩，并在附近击毁黄蜂无人机。', targetXY: [44.82, 50.16] },
          { step: 2, x: 44.82, y: 50.16, title: '2. 马拉诺公园高架观察位', area: '马拉诺公园 · 南侧混凝土阶梯遮阳棚平台', type: 'interact', detail: '登上马拉诺公园南侧阶梯顶部的遮阳棚掩体，靠近观察点触发进度。', targetXY: [48.25, 67.81] },
          { step: 3, x: 48.25, y: 67.81, title: '3. 老城区南端钟楼顶层观察位', area: '老城区与罗莎广场之间 · 钟楼顶层露台', type: 'interact', detail: '登上老城区南端高塔顶层露台，在望远镜掩体旁完成第三处侦察点打卡。' },
        ],
      },
    },
  },
  'a-new-type-of-plant': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-old-battleground', r: 48, label: '旧战场变异植物搜索区', sub: '男爵残骸周边采集可能有毒的植物' }],
        landmarks: [
          { x: 31.2, y: 43.1, title: '辐射变异的剧毒植株', area: '旧战场 · 中央男爵机甲残骸南侧浅水边', type: 'collect', item: '拾取：可能有毒的植物', detail: '前往大坝西侧的旧战场，在巨型男爵残骸旁边的泥水坑边缘找到冒着黄绿色孢子微光的红叶植物，交互采集并撤离。' },
        ],
      },
    },
  },
  'empathetic-prototypes': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-arrival-building', label: '到达楼高科技实验室', sub: '保险柜中寻获“悲怆计划”共情核心' }],
        landmarks: [
          { x: 39.64, y: 35.18, title: '“悲怆计划”共情核心保险箱', area: '到达楼 · 2F东翼机密研发室', type: 'collect', item: '拾取：“悲怆计划”共情核心', detail: '进入太空港到达楼二楼东翼实验室，打开靠墙的密码保险箱取回【“悲怆计划”共情核心】并安全撤离。' },
        ],
      },
    },
  },
  'the-first-nomads': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-reinforced-reception', r: 54, label: '蓝门地下安保翼楼与朝圣者峰', sub: '调阅初代游牧民迁徙档案' }],
        landmarks: [
          { step: 1, x: 51.12, y: 43.17, layer: 1, title: '1. 地下安保翼楼游牧民档案柜', area: '地下层 · 安保翼楼南侧档案室', type: 'interact', detail: '进入蓝门地下层安保翼楼南侧档案室，查阅初代游牧民首次目击记录。', targetXY: [71.22, 33.78] },
          { step: 2, x: 71.22, y: 33.78, layer: 0, title: '2. 朝圣者峰通信塔中继记录', area: '朝圣者峰 · 北侧塔楼2F科研室', type: 'interact', detail: '前往东北角的朝圣者峰二楼控制室，读取游牧民通信频率日志。' },
        ],
      },
      'stella-montis': {
        zones: [{ poi: 'sm-cultural-archives', label: '上层 · 通讯辅楼与中央走廊', sub: '调阅游牧民历史馆藏与终端' }],
        landmarks: [
          { step: 3, x: 65.33, y: 50.81, layer: 1, title: '3. 通讯辅楼 (Communications Annex) 终端', area: '上层 · 中央走廊东侧通讯辅楼', type: 'interact', detail: '前往星辰山【上层】中央走廊东侧的通讯辅楼，检索游牧民通讯记录。', targetXY: [64.17, 54.69] },
          { step: 4, x: 64.17, y: 54.69, layer: 1, title: '4. 中央走廊东端加密终端', area: '上层 · 中央走廊东端控制室', type: 'interact', detail: '在相邻的中央走廊东端控制室完成数据比对。' },
        ],
      },
      'spaceport': {
        zones: [{ poi: 'sp-fuel-processing', r: 52, label: '外围隐藏地堡顶部圆顶遗迹', sub: '调查外围游牧民信标遗迹' }],
        landmarks: [
          { step: 5, x: 34.25, y: 49.23, layer: 0, title: '5. 外围隐藏地堡顶部游牧民信标', area: '燃料处理厂东侧 · 隐藏地堡地表圆顶旁', type: 'interact', detail: '前往太空港燃料处理厂东侧的外围隐藏地堡地表圆顶，调查初代游牧民留下的定位信标。' },
        ],
      },
    },
  },
  'keeping-an-eye-out': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-highway-collapse-l0-z2', r: 50, label: '比尔古恩的藏身处 · 飞船尾翼掩体', sub: '在悬崖边飞船尾翼残骸掩体内部拍照记录线索' }],
        landmarks: [
          { x: 26.94, y: 57.75, title: '比尔古恩的藏身处拍照点', area: '高速公路崩塌区西端悬崖 · 比尔古恩的藏身处 (Bilguun\'s Hideout)', type: 'photo', detail: '前往蓝门西南角悬崖边的【比尔古恩的藏身处】，钻入巨大的金属飞船尾翼残骸内部掩体，对墙面线索按交互键拍照。' },
        ],
      },
    },
  },
  'a-first-foothold': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'blue-gate': {
        landmarks: [
          { step: 1, x: 69.14, y: 54.44, title: '1. 山脊线瞭望台卫星通信圆盘', area: '山脊线东南角 · 脚手架瞭望台顶', type: 'interact', detail: '前往地图东南侧山脊线边缘的铁架瞭望台，爬梯登顶旋转校准卫星通信圆盘。', targetXY: [40.02, 64.08] },
          { step: 2, x: 40.02, y: 64.08, title: '2. 橄榄树林西侧农舍棚顶通讯终端', area: '橄榄树林西侧 · 铁皮棚顶通讯台', type: 'interact', detail: '前往橄榄树林西面紧邻的破旧铁皮小棚屋，踩着木箱爬上棚顶启动黄色通讯终端。', targetXY: [32.71, 46.57] },
          { step: 3, x: 32.71, y: 46.57, title: '3. 捕兽者林地奇袭者建筑屋顶铁皮', area: '捕兽者林地南侧 · 石木农舍屋顶', type: 'interact', detail: '前往西侧森林下方的捕兽者林地，爬上农舍倾斜屋顶，交互钉牢松动的瓦楞铁皮。', targetXY: [56.97, 32.51] },
          { step: 4, x: 56.97, y: 32.51, title: '4. 数据仓库北侧山坡无线电天线', area: '数据仓库正北 · 石头山坡雷达天线基座', type: 'interact', detail: '前往北部数据仓库北侧山坡，在雷达天线基座处交互固定拉索。' },
        ],
      },
    },
  },
  'battening-down': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'riven-tides': {
        zones: [
          { poi: 'rt-port-authority', label: '港务局大楼与深水港码头', sub: '激活气象浮标、关闭防洪闸门并启动海啸预警' },
        ],
        landmarks: [
          { step: 1, x: 68.43, y: 37.71, title: '1. 深水港东侧气象监测浮标终端', area: '深水港主航道 · 西码头东端栈桥', type: 'interact', detail: '前往裂潮镇东北部深水港栈桥，激活第一座海岸气象监测终端。', targetXY: [44.62, 43.59] },
          { step: 2, x: 44.62, y: 43.59, title: '2. 港务局大楼外侧防洪闸门开关', area: '港务局大楼 · 北侧临海堤岸闸门室', type: 'interact', detail: '前往中北部港务局大楼外侧码头，拉下堤岸边的防洪闸门控制杆。', targetXY: [26.98, 44.55] },
          { step: 3, x: 26.98, y: 44.55, title: '3. 蔚蓝海滩南端防波堤控制箱', area: '蔚蓝海滩南端 · 海岸防洪控制室', type: 'interact', detail: '前往西岸蔚蓝海滩南端，锁定海岸防波堤控制箱。', targetXY: [75.95, 35.69] },
          { step: 4, x: 75.95, y: 35.69, title: '4. 东北角灯塔海啸预警发射器', area: '东顺岸码头北端 · 海角灯塔基座', type: 'interact', detail: '前往地图东北角东顺岸码头尽头的灯塔基座，启动海啸预警发射器。' },
        ],
      },
    },
  },
  'to-the-skies': {
    cat: 'area-loot',
    mode: 'none',
    targets: {},
  },
  'mixed-signals': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'clamoring-for-attention': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-checkpoint', label: '仓库综合体、村庄与检查站广播网', sub: '依次校准2处高音喇叭并在检查站播放广播' }],
        landmarks: [
          { step: 1, x: 60.39, y: 45.21, title: '1. 仓库综合体东侧扩音喇叭塔', area: '仓库综合体 · 东侧广场广播杆', type: 'interact', detail: '前往蓝门仓库综合体东侧广场，校准第 1 座扩音喇叭配电箱。', targetXY: [41.65, 33.5] },
          { step: 2, x: 41.65, y: 33.5, title: '2. 村庄南口街角高音喇叭塔', area: '村庄 (Village) · 南口广场电线杆', type: 'interact', detail: '前往西北部村庄南口街角，校准第 2 座高音喇叭配电箱。', targetXY: [49.99, 49.43] },
          { step: 3, x: 49.99, y: 49.43, title: '3. 检查站北侧主广播控制终端', area: '检查站 · 北侧收费大棚广播控制箱', type: 'interact', detail: '前往中央检查站北侧大棚，启动主广播终端引开机器群。' },
        ],
      },
    },
  },
  'waking-the-grid': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-departure-building', r: 48, label: '太空港高压变压器与电网控制室', sub: '开启两座变压器，合上配电箱并在到达楼西侧启动终端' }],
        landmarks: [
          { step: 1, x: 42.2, y: 54.08, title: '燃料管道东侧高压变压器开关 #1', area: '燃料管道东侧 · 管线南段变电箱', type: 'interact', detail: '前往燃料管道东侧变电围栏，拉下第 1 座高压变压器开关。', targetXY: [54.9, 65.17] },
          { step: 2, x: 54.9, y: 65.17, title: '集装箱仓储区南侧变压器开关 #2', area: '集装箱仓储区南侧 · 荒原变电围栏', type: 'interact', detail: '前往集装箱仓储区南侧变电围栏，拉下第 2 座高压变压器开关。', targetXY: [39.04, 46.42] },
          { step: 3, x: 39.04, y: 46.42, title: '出发航站楼南侧配电合闸箱', area: '候机楼 (Departure Building) · 南侧外墙配电间', type: 'interact', detail: '前往候机楼南侧外墙配电箱完成合闸。', targetXY: [37.8, 35.16] },
          { step: 4, x: 37.8, y: 35.16, title: '到达航站楼西侧电网控制室终端', area: '到达楼 (Arrival Building) · 西侧电网控制房', type: 'interact', detail: '前往到达航站楼西侧电网控制房，启动主控终端唤醒全图电网。' },
        ],
      },
    },
  },
  'a-rising-tide': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-piazza-roma-l0-z2', label: '罗马广场西北工头公寓 (步骤①)', sub: '进入工头加盖日志公寓查看白板线索' }],
        landmarks: [
          { step: 1, x: 35.04, y: 53.32, title: '1. 工头加盖公寓工程白板 #1', area: '罗马广场西北 · 屋顶加盖公寓2F书房', type: 'interact', detail: '前往掩埋废城罗马广场西北侧公寓，在工程白板前查阅大坝重建计划线索（西侧 32.02%, 56.50% 为备选点）。' },
          { step: 2, x: 32.02, y: 56.5, title: '1B. 西村公寓工程白板 (备选)', area: '西村南侧公寓 · 2F办公间', type: 'interact', detail: '西村公寓内的备选工程白板点位。' },
        ],
      },
      'dam-battlegrounds': {
        zones: [
          { poi: 'dam-power-generation', label: '发电厂综合体与防洪道 (步骤②③)', sub: '寻找发电厂施工日志并通过地下通道前往防洪闸控制室' },
        ],
        landmarks: [
          { step: 3, x: 64.37, y: 33.14, title: '2. 发电厂综合体东侧施工日志', area: '发电厂综合体东翼 · 1F工程值班室', type: 'interact', detail: '前往大坝战场北部的发电厂综合体东翼，读取大坝重建项目的施工日志。', targetXY: [58.2, 36.05] },
          { step: 4, x: 58.2, y: 36.05, title: '3. 防洪闸门地下通道控制室', area: '发电厂南侧电力控制区 (Power Control) · 闸门控制间', type: 'interact', detail: '顺着发电厂南侧地下通道前往防洪闸门控制室，交互完成最终调查。' },
        ],
      },
    },
  },
  'collision-course': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'turnabout': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-north-trench-tower-l0-z2', label: '北壕沟塔 · 黑客上传区', sub: '需携带太空港战壕塔钥匙登顶上传数据' }],
        landmarks: [
          { x: 54.59, y: 29.84, title: '北壕沟塔顶黑客终端', area: '北壕沟塔 · 2F上锁控制室笔记本电脑', type: 'interact', item: '需携带：太空港战壕塔钥匙', detail: '携带【太空港战壕塔钥匙】前往地图北部的北壕沟塔（注意不是南塔），解锁一楼大门或从屋顶破窗滑索进入二楼，在黄色包裹旁的笔记本电脑交互上传黑客文件。' },
        ],
      },
    },
  },
  'a-prime-specimen': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-broken-earth-l0-z2', r: 48, label: '砍伐者残骸区 (山脊线南 / 庄严残骸)', sub: '用2块ARC动力电池解除两道火焰陷阱并下载数据' }],
        landmarks: [
          { step: 1, x: 63.25, y: 58.96, title: '双层脉冲砍伐者 #1 (山脊线南)', area: '山脊线南侧 / 破碎地貌东坡 · 巨型圆筒砍伐者残骸', type: 'interact', item: '需准备：2× ARC能量电池', detail: '找到山坡上的巨型圆筒状【砍伐者】机甲残骸：1)将第1块ARC动力电池塞入外壳插槽并射击引爆关闭外层喷火；2)钻入内部将第2块电池塞入内舱插槽关闭内层火焰；3)爬到顶层平台终端交互下载数据（任选一具砍伐者均可完成）。' },
          { step: 2, x: 32.91, y: 51.28, title: '双层脉冲砍伐者 #2 (庄严残骸东)', area: '庄严残骸东南侧林地 · 砍伐者残骸', type: 'interact', item: '需准备：2× ARC能量电池', detail: '西侧庄严残骸东南面的第二具【砍伐者】机甲残骸，同样可完成任务。' },
          { step: 3, x: 25.96, y: 50.04, title: '双层脉冲砍伐者 #3 (庄严残骸西)', area: '庄严残骸西侧林地 · 砍伐者残骸', type: 'interact', item: '需准备：2× ARC能量电池', detail: '西侧庄严残骸西面的第三具【砍伐者】机甲残骸，同样可完成任务。' },
        ],
      },
    },
  },
  'nothing-gained': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'disrupting-the-frigate': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-the-trench-l0-z2', r: 56, label: 'ARC“护卫者”内部核心破坏区', sub: '击毁4台酸雾风扇与10座护盾核心，操作底层双棘轮夺取核心' }],
        landmarks: [
          { x: 55.45, y: 33.93, title: '护卫舰底层双棘轮与核心舱', area: 'ARC“护卫者”舰体内部 · 底层货舱与上层核心室', type: 'interact', linkedStage: 'frigate', detail: '登舰后依次击毁走廊内的4台黄色酸雾风扇与10座旋转护盾柱，到底层货舱操作双棘轮升起平台，登顶夺取护卫舰核心模块（点击下方按钮查看3D立体全点位解谜图）。' },
        ],
      },
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-red-lakes-l0-z0', r: 60, label: '红湖 · 护卫舰副本区', sub: '登舰破坏风扇与护盾核心' }],
        landmarks: [
          { x: 69.57, y: 47.91, title: '护卫舰核心夺取点', area: '红湖空域 · 护卫舰内部', type: 'interact', linkedStage: 'frigate', detail: '点击下方按钮可打开3D护卫舰内部4台风扇、10座护盾核心与双棘轮机关的完整位置图。' },
        ],
      },
    },
  },
  'the-stench-of-corruption': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-departure-building', label: '候机楼与地下排污隧道', sub: '1F西南更衣室拿钥匙，下地下隧道开排污室刷协议' }],
        landmarks: [
          { step: 1, x: 38.2, y: 46.1, title: '冲洗终端钥匙衣架', area: '候机楼 · 1F西南角员工更衣室', type: 'collect', item: '拾取：冲洗终端钥匙', detail: '从候机楼西南侧破墙或大门进入一楼更衣室，在靠墙挂着两件荧光黄安全背心的衣架处交互，钥匙会掉在地上，低头拾取。', targetXY: [41.8, 44.2] },
          { step: 2, x: 41.8, y: 44.2, layer: 1, title: '地下隧道上锁排污控制室', area: '候机楼东侧地下维护隧道 · 蓄水池旁控制间', type: 'interact', item: '使用：冲洗终端钥匙', detail: '前往候机楼东侧外面下入地下隧道（可切至地下图层），用刚拿到的钥匙打开积水池旁的上锁铁门，在室内终端交互覆盖排污协议。' },
        ],
      },
    },
  },
  'bait-fetch-blast': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'pendola-pass': {
        zones: [{ poi: 'pp-railroad-junction-l0-z1', r: 48, label: '铁路枢纽诱饵爆破区', sub: '需携带1×“恶霸”破片弹' }],
        landmarks: [
          { x: 59.57, y: 44.46, title: '重装机甲诱饵引爆台', area: '铁路枢纽 (Railroad Junction) · 铁轨交汇处信号亭旁', type: 'deliver', item: '需携带：1× “恶霸”破片弹', detail: '携带1枚【“恶霸”破片弹】前往彭多拉山口中北部的铁路枢纽，在铁轨旁开启诱饵信标引出机甲并用破片弹将其炸毁。' },
        ],
      },
    },
  },
  'belly-of-the-beast': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'pendola-pass': {
        zones: [{ poi: 'pp-fallen-emperor', r: 58, label: '倒下的“帝王”机甲内部', sub: '穿越分拣迷宫与粉碎压机室，扫描中央反应堆核心' }],
        landmarks: [
          { x: 27.31, y: 50.97, title: '帝王号中央反应堆核心舱', area: '倒下的“帝王”内部 · 分拣迷宫与压机室尽头', type: 'interact', linkedStage: 'walker', detail: '从帝王号腹部破口进入机甲内部，穿过随机开启的分拣门迷宫，趁巨型粉碎压机抬起间隙滑铲通过，抵达最深处反应堆核心舱完成扫描（点击下方按钮查看3D内部迷宫路线图）。' },
        ],
      },
    },
  },
  'test-case': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'celeste-s-teenage-rebellion': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'riven-tides': {
        zones: [
          { poi: 'rt-wharf-l0-z2', label: '老城区、货运码头与东北悬崖基地', sub: '寻找少年时期涂鸦、恢复俱乐部供电并启动海滨天线' },
          { x: 82.23, y: 35.17, r: 44, label: '东北角海滨悬崖天线 (步骤③)', sub: '启动悬崖秘密基地通讯天线' },
        ],
        landmarks: [
          { step: 1, x: 48.3, y: 60.22, title: '1. 老城区中心广场涂鸦与电源箱', area: '老城区 · 中心广场北侧涂鸦墙', type: 'interact', detail: '前往裂潮镇老城区中心广场北侧，调查墙上的标志涂鸦并检查电源线路。', targetXY: [29.63, 50.8] },
          { step: 2, x: 29.63, y: 50.8, title: '2. 货运码头西侧仓库秘密据点', area: '货运码头 (Wharf) · 西侧红砖仓库2F', type: 'interact', detail: '前往西侧货运码头仓库二楼，开启备用电源并检索少年时期的集会线索。', targetXY: [82.23, 35.17] },
          { step: 3, x: 82.23, y: 35.17, title: '3. 海滨悬崖秘密基地通信天线', area: '船舶码头东北角 · 海滨悬崖通信天线 (Harbor Cliff Antenna)', type: 'interact', detail: '前往地图最东北角的海岸悬崖哨站，启动悬崖边的秘密基地通信天线完成任务。' },
        ],
      },
    },
  },
  'divided': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'pendola-pass': {
        zones: [
          { poi: 'pp-weather-station', label: '装卸站台与高山气象站 (步骤①②)', sub: '调查南区与东区幸存者记录' },
          { poi: 'pp-train-station', label: '调度塔与阿尔玛特拉火车站 (步骤③④)', sub: '调查北区铁道哨所与火车站主终端' },
        ],
        landmarks: [
          { step: 1, x: 69.49, y: 70.99, title: '1. 装卸站台西侧货运调度室记录', area: '装卸站台 (Loading Platform) · 西侧值班室', type: 'interact', detail: '前往彭多拉山口东南部的装卸站台西侧值班室，查阅第一份派系分歧记录。', targetXY: [72.01, 50.17] },
          { step: 2, x: 72.01, y: 50.17, title: '2. 高山气象站南侧观测哨记录', area: '高山气象站 (Weather Station) · 南侧耳房', type: 'interact', detail: '前往东侧的高山气象站南翼房间，查阅第二份记录。', targetXY: [48.76, 33.36] },
          { step: 3, x: 48.76, y: 33.36, title: '3. 调度塔北侧铁道哨所通告板', area: '调度塔 (Dispatch Tower) · 北侧铁道旁岗亭', type: 'interact', detail: '前往中北部调度塔北侧的铁道哨亭，查阅第三份记录。', targetXY: [43.7, 42.62] },
          { step: 4, x: 43.7, y: 42.62, title: '4. 阿尔马特拉火车站候车厅主终端', area: '阿尔马特拉火车站 · 1F大厅中央终端', type: 'interact', detail: '前往阿尔马特拉火车站一楼候车大厅，在中央终端汇总全部四处记录。' },
        ],
      },
    },
  },
  'settled-in-full': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'movie-night': {
    cat: 'item-collect',
    mode: 'landmark',
    recMap: 'stella-montis',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-cultural-archives', label: '上层 · 文化档案馆视听室', sub: '搜寻旧世界录像磁带与便携电视' }],
        landmarks: [
          { x: 69.26, y: 61.86, layer: 1, title: '文化档案馆旧世界录像带收藏架', area: '上层 · 文化档案馆 (Cultural Archives) 西南侧视听阅览室', type: 'collect', item: '拾取：一摞电影磁带 & 便携电视', detail: '前往星辰山【上层】东南侧的文化档案馆，在西南角视听阅览室的档案架上拾取【一摞电影磁带】（并在居民区/商业箱搜刮一台【便携式电视】一同交付给阿波罗）。' },
        ],
      },
    },
  },
  'stable-housing': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-security-bridge-l1-z2', r: 44, label: '上层 · 安保区过道桥', sub: '破译保险箱取回常青计划蓝图' }],
        landmarks: [
          { step: 1, x: 69.21, y: 37.34, layer: 1, title: '安保桥门禁控制终端', area: '上层 · 安保区过道桥东侧值班室', type: 'interact', detail: '前往星辰山上层大厅东北侧的安保区过道桥，先在东侧值班室终端解锁密码权限。', targetXY: [68.53, 36.36] },
          { step: 2, x: 68.53, y: 36.36, layer: 1, title: '常青计划蓝图保险箱', area: '上层 · 安保区过道桥北侧主管室', type: 'collect', item: '拾取：常青计划蓝图', detail: '进入隔壁主管办公室开启保险箱，取出【常青计划蓝图】并安全撤离。' },
        ],
      },
    },
  },
  'on-the-map': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-container-storage', label: '集装箱仓库 (最终步骤⑤)', sub: '按顺序完成4处三角测量后，登顶集装箱仓库发送信号' }],
        landmarks: [
          { step: 1, x: 38.14, y: 53.91, title: '燃料管道南侧龙门架天线', area: '燃料管道 (Fuel Lines) · 南侧龙门架天线终端', type: 'interact', detail: '前往太空港西南部燃料管道南侧的龙门架下，在天线箱处交互并获取下一处坐标线索。', targetXY: [56.71, 39.16] },
          { step: 2, x: 56.71, y: 39.16, title: '燃料控制单元北侧防水布货堆', area: '燃料控制单元 · 钢架下方灰白防水布木箱', type: 'interact', detail: '前往东北部燃料控制单元，在盖着防水布的木箱堆旁喷涂三角测量标记。', targetXY: [44.57, 30.97] },
          { step: 3, x: 44.57, y: 30.97, title: '货运仓库起重机仙人掌涂鸦箱', area: '货运仓库 (Shipping Warehouse) · 起重机旁红色集装箱', type: 'interact', detail: '前往北部货运仓库外围起重机下，在绘有仙人掌涂鸦的集装箱侧面喷涂标记。', targetXY: [58.88, 54.13] },
          { step: 4, x: 58.88, y: 54.13, title: '集装箱仓库1F中段控制室', area: '集装箱仓库 · 1F主通道控制室墙面', type: 'interact', detail: '前往中央偏东南的集装箱仓库一楼控制室，喷涂第 4 处标记。', targetXY: [59.48, 56.4] },
          { step: 5, x: 59.48, y: 56.4, title: '集装箱仓库顶楼露天信标箱', area: '集装箱仓库 · 顶层露天屋顶南端', type: 'interact', detail: '乘室内电梯井滑索直达集装箱仓库最高层露天屋顶，在屋顶南端盖着防水布的信标设备箱处交互完成任务。' },
        ],
      },
    },
  },
  'bombing-run': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'armored-transports': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [
          { poi: 'bg-checkpoint', label: '检查站 (步骤①：拿钥匙卡)', sub: '在蓝顶哨亭内拾取巡逻车钥匙' },
          { poi: 'bg-traffic-tunnel-l1-z1', r: 52, label: '通行隧道 (步骤②：开装甲车)', sub: '进入检查站北侧地下隧道开启上锁装甲车' },
        ],
        landmarks: [
          { step: 1, x: 46.56, y: 52.35, layer: 0, title: '巡逻车钥匙哨亭', area: '检查站 · 中央蓝白条纹小收费亭内桌面', type: 'collect', item: '拾取：巡逻车钥匙', detail: '前往蓝门中央的检查站大棚下，进入蓝顶小哨亭内部，在靠墙小木桌上拾取【巡逻车钥匙】。', targetXY: [54.09, 46.23] },
          { step: 2, x: 54.09, y: 46.23, layer: 1, title: '隧道内上锁的装甲运兵车', area: '通行隧道 (地下层) · 检查站往北隧道内军用卡车后门', type: 'interact', item: '使用：巡逻车钥匙', detail: '从检查站北侧大洞口走入地下【通行隧道】（可切至地下图层），找到车尾闪着黄灯的墨绿色军用装甲车，用钥匙卡打开后车门搜刮完成。' },
        ],
      },
    },
  },
  'where-everything-falls': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-launch-towers', label: '发射塔坠落残骸区', sub: '调查轨道坠落物并取回黑匣记录仪' }],
        landmarks: [
          { x: 48.36, y: 42.17, title: '发射场轨道坠落黑匣子', area: '发射塔 · 中央发射台导流槽残骸旁', type: 'interact', detail: '前往太空港中央的双子发射塔基座下方，在焦黑的导流槽轨道坠落物残骸旁交互读取黑匣记录仪。' },
        ],
      },
    },
  },
}
