// Quest Map Rules — Part 1 (Quests 1 to 62)
// Categories:
//   'area-recon'      : 区域勘察 (Green Zone)
//   'area-photo'      : 拍照侦察 (Green Zone)
//   'area-loot'       : 区域搜刮 (Green Zone)
//   'area-combat'     : 区域猎杀 (Green Zone)
//   'item-collect'    : 道具收集 (Landmark Pin + Zone)
//   'item-deliver'    : 物资交付 (Landmark Pin + Zone)
//   'device-interact' : 机关交互 (Landmark Pin + Zone)

export const QUEST_RULES_PART1 = {
  'picking-up-the-pieces': {
    cat: 'area-loot',
    mode: 'none',
    targets: {},
  },
  'clearer-skies': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'trash-into-treasure': {
    cat: 'area-loot',
    mode: 'none',
    targets: {},
  },
  'off-the-radar': {
    cat: 'device-interact',
    mode: 'landmark',
    recMap: 'dam-battlegrounds',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 46.45, y: 36.89, title: '前线仓库屋顶天线 (水培穹顶)', area: '水培穹顶综合体 · 前线仓库顶棚', type: 'interact', detail: '攀爬前线仓库侧面外梯登上蓝色铁皮屋顶，在旋转雷达天线旁交互修复（全图任意一座前线仓库均可完成）。' },
          { step: 2, x: 33.88, y: 48.3, title: '前线仓库屋顶天线 (南沼泽)', area: '沼泽南部岗哨东北 · 前线仓库顶棚', type: 'interact', detail: '登上南沼泽前线仓库屋顶，交互修复雷达天线。' },
          { step: 3, x: 47.89, y: 53.03, title: '前线仓库屋顶天线 (主要设施)', area: '主要设施西侧 · 前线仓库顶棚', type: 'interact', detail: '登上主要设施西侧前线仓库屋顶，交互修复雷达天线。' },
          { step: 4, x: 37.17, y: 61.38, title: '前线仓库屋顶天线 (水塔)', area: '水塔东北侧 · 前线仓库顶棚', type: 'interact', detail: '登上水塔东北侧前线仓库屋顶，交互修复雷达天线。' },
          { step: 5, x: 59.65, y: 57.39, title: '前线仓库屋顶天线 (红湖阳台)', area: '红湖阳台 · 前线仓库顶棚', type: 'interact', detail: '登上红湖阳台前线仓库屋顶，交互修复雷达天线。' },
          { step: 6, x: 69.38, y: 35.2, title: '前线仓库屋顶天线 (东岗哨)', area: '奇袭者岗哨东侧南面 · 前线仓库顶棚', type: 'interact', detail: '登上奇袭者岗哨东侧前线仓库屋顶，交互修复雷达天线。' },
        ],
      },
      'buried-city': {
        landmarks: [
          { step: 1, x: 48.56, y: 28.56, title: '前线仓库屋顶天线 (医院西)', area: '医院西侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上医院西侧前线仓库屋顶，交互修复天线（任选一处即可完成）。' },
          { step: 2, x: 44.8, y: 73.83, title: '前线仓库屋顶天线 (主街南)', area: '主街西南侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上主街前线仓库屋顶，交互修复天线。' },
          { step: 3, x: 78.66, y: 52.63, title: '前线仓库屋顶天线 (埋没楼群东)', area: '埋没的楼群东侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上埋没的楼群东侧前线仓库屋顶，交互修复天线。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { step: 1, x: 35.11, y: 51.63, title: '前线仓库屋顶天线 (燃料管道)', area: '燃料管道西侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上燃料管道前线仓库屋顶，交互修复天线（任选一处即可完成）。' },
          { step: 2, x: 32.84, y: 32.06, title: '前线仓库屋顶天线 (停车场西)', area: '停车场西侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上停车场西侧前线仓库屋顶，交互修复天线。' },
          { step: 3, x: 66.98, y: 49.09, title: '前线仓库屋顶天线 (东部平原仓库)', area: '东部平原仓库南侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上东部平原前线仓库屋顶，交互修复天线。' },
          { step: 4, x: 44.81, y: 69.98, title: '前线仓库屋顶天线 (维护区机库)', area: '维护区机库南侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上维护区机库前线仓库屋顶，交互修复天线。' },
          { step: 5, x: 65.21, y: 65.65, title: '前线仓库屋顶天线 (服务大楼西)', area: '服务大楼西北侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上服务大楼前线仓库屋顶，交互修复天线。' },
        ],
      },
      'riven-tides': {
        landmarks: [
          { step: 1, x: 38.77, y: 70.26, title: '前线仓库屋顶天线 (干涸河床)', area: '干涸河床东北侧 · 前线仓库顶棚', type: 'interact', detail: '攀爬外梯登上干涸河床前线仓库屋顶，交互修复雷达天线。' },
        ],
      },
    },
  },
  'a-bad-feeling': {
    cat: 'area-recon',
    mode: 'none',
    targets: {},
  },
  'hatch-repairs': {
    cat: 'device-interact',
    mode: 'landmark',
    recMap: 'dam-battlegrounds',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 65.09, y: 52.77, title: '奇袭者舱口泄漏液压管 (红湖暗门)', area: '红湖阳台东侧 · 红湖暗门旁', type: 'interact', detail: '前往奇袭者舱口（撤离地井）旁，交互修复嘶嘶冒气的泄漏液压管道，完成后在舱口旁的补给箱中领取免费的【奇袭者舱口钥匙】（任选一处即可完成）。' },
          { step: 2, x: 32.51, y: 58.75, title: '奇袭者舱口泄漏液压管 (旧男爵暗门)', area: '水塔西北侧 · 旧“男爵”的暗门旁', type: 'interact', detail: '前往水塔西北侧奇袭者舱口，交互修复泄漏液压管。' },
          { step: 3, x: 35.94, y: 33.85, title: '奇袭者舱口泄漏液压管 (天台暗门)', area: '本·维尔德的天台北侧 · 天台暗门旁', type: 'interact', detail: '前往本·维尔德的天台北侧奇袭者舱口，交互修复泄漏液压管。' },
          { step: 4, x: 72.87, y: 40.95, title: '奇袭者舱口泄漏液压管 (泵房暗门)', area: '红湖地堡东侧 · 泵房的暗门旁', type: 'interact', detail: '前往红湖地堡东侧奇袭者舱口，交互修复泄漏液压管。' },
        ],
      },
      'buried-city': {
        landmarks: [
          { step: 1, x: 53.62, y: 22.43, title: '奇袭者舱口泄漏液压管 (倒塌超市暗门)', area: '市集废墟北侧 · 倒塌超市的暗门旁', type: 'interact', detail: '前往市集废墟北侧奇袭者舱口旁，交互修复泄漏液压管（任选一处即可完成）。' },
          { step: 2, x: 57.78, y: 54.93, title: '奇袭者舱口泄漏液压管 (立交桥暗门)', area: '阿布斯托广场西侧 · 高速立交桥的暗门旁', type: 'interact', detail: '前往高速立交桥奇袭者舱口旁，交互修复泄漏液压管。' },
          { step: 3, x: 36.93, y: 68.92, title: '奇袭者舱口泄漏液压管 (老城区暗门)', area: '废弃高速公路营地东北 · 老城区的暗门旁', type: 'interact', detail: '前往西南侧老城区暗门旁，交互修复泄漏液压管。' },
          { step: 4, x: 31.05, y: 38.1, title: '奇袭者舱口泄漏液压管 (火车站暗门)', area: '马拉诺车站南侧 · 火车站的暗门旁', type: 'interact', detail: '前往马拉诺车站旁奇袭者舱口，交互修复泄漏液压管。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { step: 1, x: 53.36, y: 46.94, title: '奇袭者舱口泄漏液压管 (出发层暗门)', area: '发射塔南侧 · 出发层的暗门旁', type: 'interact', detail: '前往发射塔南侧奇袭者舱口旁，交互修复泄漏液压管（任选一处即可完成）。' },
          { step: 2, x: 50.73, y: 50.42, title: '奇袭者舱口泄漏液压管 (控制塔暗门)', area: '控制塔A6北侧 · 控制塔的暗门旁', type: 'interact', detail: '前往控制塔A6北侧奇袭者舱口旁，交互修复泄漏液压管。' },
          { step: 3, x: 64.09, y: 38.86, title: '奇袭者舱口泄漏液压管 (东壕沟暗门)', area: '东侧集装箱堆场北 · 东侧壕沟的暗门旁', type: 'interact', detail: '前往东侧壕沟奇袭者舱口旁，交互修复泄漏液压管。' },
          { step: 4, x: 50.33, y: 26.31, title: '奇袭者舱口泄漏液压管 (西壕沟暗门)', area: '西侧集装箱堆场东北 · 西侧壕沟的暗门旁', type: 'interact', detail: '前往西侧壕沟奇袭者舱口旁，交互修复泄漏液压管。' },
        ],
      },
      'blue-gate': {
        landmarks: [
          { step: 1, x: 29.48, y: 46.83, title: '奇袭者舱口泄漏液压管 (加固暗门)', area: '庄严残骸北侧 · 加固暗门旁', type: 'interact', detail: '前往庄严残骸北侧奇袭者舱口旁，交互修复泄漏液压管（任选一处即可完成）。' },
          { step: 2, x: 45.93, y: 35.36, title: '奇袭者舱口泄漏液压管 (幸运暗门)', area: '村庄东南侧 · 幸运暗门旁', type: 'interact', detail: '前往村庄东南侧奇袭者舱口旁，交互修复泄漏液压管。' },
          { step: 3, x: 42.69, y: 59.61, title: '奇袭者舱口泄漏液压管 (馨香暗门)', area: '橄榄树林西北侧 · 馨香暗门旁', type: 'interact', detail: '前往橄榄树林西北侧奇袭者舱口旁，交互修复泄漏液压管。' },
          { step: 4, x: 72.25, y: 45.96, title: '奇袭者舱口泄漏液压管 (预制暗门)', area: '废弃的住宅工程北侧 · 预制暗门旁', type: 'interact', detail: '前往废弃住宅工程北侧奇袭者舱口旁，交互修复泄漏液压管。' },
        ],
      },
      'stella-montis': {
        landmarks: [
          { step: 1, x: 38.92, y: 26.35, layer: 1, title: '奇袭者舱口泄漏液压管 (组装厂暗门)', area: '上层 · 组装厂车间东侧暗门', type: 'interact', detail: '前往上层组装厂车间东侧奇袭者舱口，交互修复泄漏管道（任选一处即可完成）。' },
          { step: 2, x: 76.38, y: 62.41, layer: 0, title: '奇袭者舱口泄漏液压管 (东地道暗门)', area: '下层 · 东侧地道南段暗门', type: 'interact', detail: '前往下层东侧地道奇袭者舱口，交互修复泄漏管道。' },
          { step: 3, x: 48.77, y: 70.95, layer: 0, title: '奇袭者舱口泄漏液压管 (沙盘暗门)', area: '下层 · 机器人沙盘B南侧暗门', type: 'interact', detail: '前往下层机器人沙盘B南侧奇袭者舱口，交互修复泄漏管道。' },
        ],
      },
      'riven-tides': {
        landmarks: [
          { step: 1, x: 33.06, y: 53.29, title: '奇袭者舱口泄漏液压管 (盐蚀暗门)', area: '货运码头南侧 · 盐蚀暗门旁', type: 'interact', detail: '前往货运码头南侧奇袭者舱口旁，交互修复泄漏液压管（任选一处即可完成）。' },
          { step: 2, x: 47.86, y: 60.43, title: '奇袭者舱口泄漏液压管 (山顶暗门)', area: '骡丘北坡 · 山顶暗门旁', type: 'interact', detail: '前往骡丘北坡奇袭者舱口旁，交互修复泄漏液压管。' },
          { step: 3, x: 66.74, y: 65.78, title: '奇袭者舱口泄漏液压管 (地磅暗门)', area: '称重检查站东侧 · 地磅暗门旁', type: 'interact', detail: '前往称重检查站东侧奇袭者舱口旁，交互修复泄漏液压管。' },
        ],
      },
    },
  },
  'the-right-tool': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'down-to-earth': {
    cat: 'item-deliver',
    mode: 'landmark',
    recMap: 'dam-battlegrounds',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 46.45, y: 36.89, title: '前线仓库物资箱交付台 (水培穹顶)', area: '水培穹顶综合体 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在周边营地抱起【野外板条箱】，送入前线仓库内的收集槽解码获取奖励（全图任意前线仓库均可完成）。' },
          { step: 2, x: 33.88, y: 48.3, title: '前线仓库物资箱交付台 (南沼泽)', area: '沼泽南部岗哨东北 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在南沼泽周边拾取野外板条箱，送入前线仓库内交互交付。' },
          { step: 3, x: 47.89, y: 53.03, title: '前线仓库物资箱交付台 (主要设施)', area: '主要设施西侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在主要设施周边拾取野外板条箱，送入前线仓库内交互交付。' },
          { step: 4, x: 37.17, y: 61.38, title: '前线仓库物资箱交付台 (水塔)', area: '水塔东北侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在水塔周边拾取野外板条箱，送入前线仓库内交互交付。' },
          { step: 5, x: 59.65, y: 57.39, title: '前线仓库物资箱交付台 (红湖阳台)', area: '红湖阳台 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在红湖阳台周边拾取野外板条箱，送入前线仓库内交互交付。' },
        ],
      },
      'buried-city': {
        landmarks: [
          { step: 1, x: 48.56, y: 28.56, title: '前线仓库物资箱交付台 (医院西)', area: '医院西侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在周边抱起野外板条箱，送入医院西侧前线仓库内交互交付。' },
          { step: 2, x: 44.8, y: 73.83, title: '前线仓库物资箱交付台 (主街南)', area: '主街西南侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在主街周边抱起野外板条箱，送入前线仓库内交互交付。' },
          { step: 3, x: 78.66, y: 52.63, title: '前线仓库物资箱交付台 (埋没楼群东)', area: '埋没的楼群东侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在埋没的楼群周边抱起野外板条箱，送入前线仓库内交互交付。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { step: 1, x: 35.11, y: 51.63, title: '前线仓库物资箱交付台 (燃料管道)', area: '燃料管道西侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在燃料管道周边抱起野外板条箱，送入前线仓库内交互交付。' },
          { step: 2, x: 32.84, y: 32.06, title: '前线仓库物资箱交付台 (停车场西)', area: '停车场西侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在停车场周边抱起野外板条箱，送入前线仓库内交互交付。' },
          { step: 3, x: 66.98, y: 49.09, title: '前线仓库物资箱交付台 (东部平原仓库)', area: '东部平原仓库南侧 · 前线仓库内部', type: 'deliver', item: '搬运：野外板条箱 (Field Crate)', detail: '在东部平原抱起野外板条箱，送入前线仓库内交互交付。' },
        ],
      },
    },
  },
  'a-better-use': {
    cat: 'device-interact',
    mode: 'landmark',
    recMap: 'dam-battlegrounds',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 40.7, y: 49.91, title: '空投呼叫站 (水处理控制中心)', area: '水处理控制中心 · 户外信号杆', type: 'interact', detail: '靠近发黄光的【空投呼叫站 (Supply Call Station)】终端请求空投，待补给箱落地后开启搜刮（全图任意呼叫站均可完成）。' },
          { step: 2, x: 48.44, y: 36.48, title: '空投呼叫站 (水培穹顶)', area: '水培穹顶综合体 · 户外信号杆', type: 'interact', detail: '在水培穹顶呼叫空投并搜刮落地的补给箱。' },
          { step: 3, x: 56.95, y: 54.23, title: '空投呼叫站 (控制塔)', area: '控制塔东侧 · 户外信号杆', type: 'interact', detail: '在控制塔东侧呼叫空投并搜刮落地的补给箱。' },
          { step: 4, x: 63.47, y: 33.27, title: '空投呼叫站 (发电厂综合体)', area: '发电厂综合体 · 户外信号杆', type: 'interact', detail: '在发电厂综合体呼叫空投并搜刮落地的补给箱。' },
        ],
      },
      'buried-city': {
        landmarks: [
          { step: 1, x: 38.28, y: 46.51, title: '空投呼叫站 (罗马广场)', area: '罗马广场 · 户外信号杆', type: 'interact', detail: '在罗马广场呼叫空投并搜刮落地的补给箱（任选一处即可完成）。' },
          { step: 2, x: 42.74, y: 36.31, title: '空投呼叫站 (图书馆)', area: '图书馆南侧 · 户外信号杆', type: 'interact', detail: '在图书馆南侧呼叫空投并搜刮落地的补给箱。' },
          { step: 3, x: 55.46, y: 73.83, title: '空投呼叫站 (红塔西)', area: '红塔西南侧 · 户外信号杆', type: 'interact', detail: '在红塔西南侧呼叫空投并搜刮落地的补给箱。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { step: 1, x: 40.73, y: 35.35, title: '空投呼叫站 (到达楼)', area: '到达楼东侧 · 户外信号杆', type: 'interact', detail: '在到达楼东侧呼叫空投并搜刮落地的补给箱（任选一处即可完成）。' },
          { step: 2, x: 53.04, y: 51.67, title: '空投呼叫站 (控制塔A6)', area: '控制塔A6东北 · 户外信号杆', type: 'interact', detail: '在控制塔A6旁呼叫空投并搜刮落地的补给箱。' },
          { step: 3, x: 58.78, y: 52.7, title: '空投呼叫站 (集装箱仓库)', area: '集装箱仓库北侧 · 户外信号杆', type: 'interact', detail: '在集装箱仓库北侧呼叫空投并搜刮落地的补给箱。' },
        ],
      },
      'blue-gate': {
        landmarks: [
          { step: 1, x: 42.95, y: 50.33, title: '空投呼叫站 (检查站西)', area: '检查站西侧 · 户外信号杆', type: 'interact', detail: '在检查站西侧呼叫空投并搜刮落地的补给箱（任选一处即可完成）。' },
          { step: 2, x: 37.42, y: 34.49, title: '空投呼叫站 (村庄)', area: '村庄西侧 · 户外信号杆', type: 'interact', detail: '在村庄西侧呼叫空投并搜刮落地的补给箱。' },
          { step: 3, x: 58.75, y: 47.38, title: '空投呼叫站 (仓储综合区)', area: '仓储综合区 · 户外信号杆', type: 'interact', detail: '在仓储综合区呼叫空投并搜刮落地的补给箱。' },
        ],
      },
    },
  },
  'the-trifecta': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'greasing-her-palms': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [
          { poi: 'dam-water-treatment', label: '水处理控制中心 · 勘察区', sub: '需携带水处理控制中心钥匙，开启1F中段上锁检查室' },
        ],
        landmarks: [
          { step: 1, x: 40.27, y: 51.69, title: '水处理控制中心上锁检查室', area: '水处理控制中心 · 1F中央走廊钥匙房', type: 'interact', item: '需携带：大坝水处理控制中心钥匙', detail: '携带【大坝水处理控制中心钥匙】进入水处理控制中心一楼，打开中央走廊的上锁检查室即可触发勘察完成。' },
        ],
      },
      'buried-city': {
        zones: [
          { poi: 'bc-space-travel', label: '航天大楼 · 6F勘察区', sub: '上至6楼打破窗户跳出外侧窗台，走到底部火箭推进器旁' },
        ],
        landmarks: [
          { step: 1, x: 57.7, y: 39.74, title: '航天大楼6F窗外火箭推进器', area: '航天大楼 (Space Travel) · 6F西侧窗台外推进器旁', type: 'interact', detail: '前往掩埋废城航天大楼6楼，打破西侧窗户翻出外墙窄窗台，走到角落的火箭推进器展示品旁完成勘察。' },
        ],
      },
      'spaceport': {
        zones: [
          { poi: 'sp-rocket-assembly', label: '火箭组装区 · 南侧勘察区', sub: '前往火箭组装厂南侧外围红色双集装箱过道中间' },
        ],
        landmarks: [
          { step: 1, x: 55.88, y: 49.48, title: '火箭组装厂南侧推进器集装箱', area: '火箭组装厂南侧外围 · 双红集装箱狭窄过道', type: 'interact', detail: '前往太空港火箭组装厂南侧外围，走进两座红色集装箱之间的狭窄通道即可触发勘察进度。' },
        ],
      },
    },
  },
  'dormant-barons': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 31.51, y: 42.54, title: '休眠男爵核心舱 #1 (旧战场)', area: '旧战场 · 西北森林空地', type: 'interact', detail: '顺着男爵机甲残骸腿部爬上顶部圆盘，撬开舱盖后立刻跳下躲避火焰，待熄灭后上前搜刮（任选一处即可完成）。' },
          { step: 2, x: 36.23, y: 52.29, title: '休眠男爵核心舱 #2 (西沼泽)', area: '水处理控制中心西侧 · 沼泽林间', type: 'interact', detail: '攀爬至西沼泽的巨型男爵机甲顶部圆盘，撬开舱盖躲避烈焰后搜刮。' },
          { step: 3, x: 55.79, y: 41.79, title: '休眠男爵核心舱 #3 (大裂缝)', area: '大裂缝 · 主坝溢洪道北段浅滩', type: 'interact', detail: '位于大坝北侧大裂缝浅滩的男爵巨型残骸，撬开顶部舱盖即可完成。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { step: 1, x: 46.9, y: 58.6, title: '休眠男爵核心舱 #1 (载具维护区)', area: '载具维护区西侧 · 广场空地', type: 'interact', detail: '攀爬至巨型章鱼状男爵残骸顶端撬开核心舱，避开喷火后搜刮（任选一处即可完成）。' },
          { step: 2, x: 33.25, y: 60.9, title: '休眠男爵核心舱 #2 (燃料储存库)', area: '燃料储存库北侧 · 戈壁空地', type: 'interact', detail: '攀爬至燃料储存库北侧的男爵机甲顶部，撬开舱盖待火焰散去后搜刮。' },
          { step: 3, x: 38.62, y: 25.27, title: '休眠男爵核心舱 #3 (货运仓库北)', area: '货运仓库西北侧 · 外围荒原', type: 'interact', detail: '攀爬至货运仓库西北侧的男爵机甲顶部，撬开舱盖待火焰散去后搜刮。' },
        ],
      },
      'blue-gate': {
        landmarks: [
          { step: 1, x: 26.95, y: 39.01, title: '休眠男爵核心舱 (荒芜空地)', area: '荒芜空地 (Barren Clearing) · 森林西北侧', type: 'interact', detail: '攀爬至蓝门西北部荒芜空地中央的巨型男爵机甲顶部，撬开舱盖待火焰散去后搜刮。' },
        ],
      },
    },
  },
  'what-we-left-behind': {
    cat: 'area-loot',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-south-swamp-outpost-l0-z2', r: 46, label: '沼泽南部岗哨', sub: '在铁皮圆顶营地内搜刮2个容器' }],
        landmarks: [
          { step: 1, x: 29.24, y: 51.3, title: '南沼泽岗哨奇袭者营地容器', area: '沼泽南部岗哨 · 西侧圆顶铁皮营房', type: 'collect', detail: '进入南沼泽岗哨西侧的圆顶铁皮建筑内，开启并搜刮任意 2 个容器。' },
        ],
      },
      'buried-city': {
        zones: [{ poi: 'bc-parking-garage-l0-z2', r: 46, label: '停车场底层营地', sub: '滑索下至停车场底层奇袭者营地搜刮2个容器' }],
        landmarks: [
          { step: 2, x: 52.81, y: 39.3, title: '停车场底层奇袭者营地容器', area: '停车场 (Parking Garage) · 底层滑索井营地', type: 'collect', detail: '前往掩埋废城中央停车场，顺着电梯井滑索下到底层奇袭者据点，搜刮任意 2 个容器。' },
        ],
      },
      'spaceport': {
        zones: [{ x: 61.92, y: 57.62, r: 48, label: '集装箱仓储区东南营地', sub: '在围墙高架瞭望掩体上搜刮2个容器' }],
        landmarks: [
          { step: 3, x: 61.92, y: 57.62, title: '集装箱区东南高架掩体营地', area: '集装箱仓储区东南角 · 围墙高架瞭望掩体', type: 'collect', detail: '前往太空港集装箱仓储区东南角外围的高架掩体营地，爬上铁梯搜刮任意 2 个容器。' },
        ],
      },
    },
  },
  'broken-monument': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-scrap-yard-l0-z2', r: 52, label: '废料场任务范围', sub: '单局内集齐3件初代浪潮遗物并撤离' }],
        landmarks: [
          { step: 1, x: 48.6, y: 67.8, title: '初代浪潮指南针', area: '废料场 · 南侧报废车架', type: 'collect', item: '拾取：初代浪潮指南针', detail: '位于废料场偏南侧两辆锈蚀卡车残骸之间的地面小铁盒内。' },
          { step: 2, x: 49.5, y: 66.4, title: '初代浪潮磁带', area: '废料场 · 中部圆柱金属管', type: 'collect', item: '拾取：初代浪潮磁带', detail: '位于废料场中央横放的巨大中空金属圆筒管道内部地面。' },
          { step: 3, x: 50.1, y: 65.3, title: '初代浪潮口粮', area: '废料场 · 北侧野战铁皮棚', type: 'collect', item: '拾取：初代浪潮口粮', detail: '位于废料场北缘带伪装网的破旧铁皮房车/营地箱子上方。' },
        ],
      },
    },
  },
  'marked-for-death': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-su-durante-warehouses-l0-z2', r: 48, label: '苏杜兰仓库区域', sub: '调查外墙记号与树丛藏匿箱' }],
        landmarks: [
          { step: 1, x: 35.73, y: 19.7, title: '仓库外墙奇袭者记号', area: '苏杜兰仓库 · 北侧外墙', type: 'interact', detail: '前往苏杜兰仓库北侧外围墙面，调查白色油漆标记与地面线索。', targetXY: [34.26, 17.16] },
          { step: 2, x: 34.26, y: 17.16, title: '失踪侦察员藏匿箱', area: '苏杜兰仓库 · 西北树林边缘', type: 'interact', detail: '顺着仓库西侧外墙向西北角树丛走，在沙丘树木下交互开启隐藏物资箱。' },
        ],
      },
    },
  },
  'straight-record': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-victory-ridge-l0-z0', r: 52, label: '凯旋岭EMP陷阱区', sub: '启动中央信标后依次关闭3处电源开关' }],
        landmarks: [
          { step: 1, x: 47.88, y: 27.03, title: '旧时代EMP陷阱信标', area: '凯旋岭 · 西断桥西侧高地', type: 'interact', detail: '在凯旋岭断桥西侧高地找到立柱状EMP陷阱终端并先行激活。' },
          { step: 2, x: 48.08, y: 25.99, title: '北侧电源开关 (1/3)', area: '凯旋岭 · 北侧二层废墟', type: 'interact', detail: '攀爬至信标正北方破损混凝土二楼平台，拉下黄色配电开关。' },
          { step: 3, x: 49.46, y: 28.58, title: '东侧电源开关 (2/3)', area: '凯旋岭 · 东侧高压输电架下', type: 'interact', detail: '顺着电线向东南走到倒塌的金属电网支架底座旁，关闭第二个开关。' },
          { step: 4, x: 48.08, y: 31.81, title: '南侧电源开关 (3/3)', area: '凯旋岭 · 南侧小丘树屋旁', type: 'interact', detail: '前往信标正南方道路对面的小土坡铁箱旁，拉下最后一个电源开关。' },
        ],
      },
    },
  },
  'market-correction': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-marano-station-l0-z2', r: 42, label: '马拉诺车站周边', sub: '定位并破坏走私物资箱' }],
        landmarks: [
          { x: 32.76, y: 32.75, title: '走私者秘密物资箱', area: '马拉诺车站 · 东北侧绿顶书报亭旁', type: 'interact', detail: '在马拉诺车站东北侧街角找到墨绿色圆形小书报亭，物资箱藏在亭子紧邻的两个铁皮垃圾桶后面。' },
        ],
      },
    },
  },
  'doctor-s-orders': {
    cat: 'area-loot',
    mode: 'none',
    targets: {},
  },
  'keeping-the-memory': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-wreckage-l0-z2', r: 44, label: '残骸谷纪念区', sub: '寻获阵亡者头盔并安放至纪念杆' }],
        landmarks: [
          { step: 1, x: 54.54, y: 65.68, title: '阵亡奇袭者头盔', area: '残骸 · 巨型机甲残骸下方草丛', type: 'collect', item: '搬运：奇袭者头盔', detail: '进入残骸区中段倒塌的机甲躯干下方小土坡，在灌木丛箱子旁抱起头盔。', targetXY: [55.1, 66.3] },
          { step: 2, x: 55.1, y: 66.3, title: '奇袭者纪念木桩', area: '残骸 · 东侧浅水洼旁', type: 'interact', item: '安放：奇袭者头盔', detail: '捧着头盔往东南走约25米，交互将头盔戴在浅水坑中央的金属纪念短桩上。' },
        ],
      },
    },
  },
  'eyes-on-the-prize': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-plaza-rosa', label: '玫瑰广场西南隐蔽屋顶露台', sub: '需提前携带3×导线入场' }],
        landmarks: [
          { x: 42.75, y: 77.47, title: '隐蔽屋顶露台太阳能配电箱', area: '罗莎广场西南侧 · 隐蔽屋顶露台 (Secluded Roof Terrace)', type: 'deliver', item: '需携带：3× 导线', detail: '前往罗莎广场西南侧红砖建筑群顶楼，翻进蓝色防水布围起的【隐蔽屋顶露台】，消耗3根导线修复太阳能电池板配电箱。' },
        ],
      },
    },
  },
  'medical-merchandise': {
    cat: 'area-loot',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-research-admin', label: '研究与行政区 · 2F医疗室', sub: '在二楼医疗诊室搜刮3个容器' }],
        landmarks: [
          { step: 1, x: 52.73, y: 54.3, title: '研究与行政中心2F医务室', area: '研究与行政区 · 2F东北侧医疗诊室', type: 'collect', detail: '上至研究与行政区二楼东北角带医疗标志的诊室，开启并搜刮 3 个医疗容器。' },
        ],
      },
      'buried-city': {
        zones: [{ poi: 'bc-hospital', label: '医院 · 病房与药局', sub: '在医院任意楼层搜刮3个医疗容器' }],
        landmarks: [
          { step: 2, x: 52.23, y: 30.3, title: '圣玛丽亚医院病房与药局', area: '医院 (Hospital) · 2F与3F医疗室', type: 'collect', detail: '进入掩埋废城北部的医院大楼，在各层病房与药局内搜刮 3 个容器。' },
        ],
      },
      'spaceport': {
        zones: [{ poi: 'sp-departure-building', label: '候机楼 · 2F医务室', sub: '在候机楼二楼急诊室搜刮2个容器' }],
        landmarks: [
          { step: 3, x: 40.11, y: 43.47, title: '出发航站楼2F医疗急救室', area: '出发楼 (Departure Building) · 2F东北侧医疗室', type: 'collect', detail: '前往太空港出发航站楼二楼东北侧的绿十字医疗急救室，在室内搜刮 2 个容器。' },
        ],
      },
    },
  },
  'echoes-of-victory-ridge': {
    cat: 'item-collect',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-west-broken-bridge-l0-z2', r: 44, label: '西部断桥军营区', sub: '取回艾娃少校的臂章' }],
        landmarks: [
          { x: 52.18, y: 25.66, title: '艾娃少校的臂章', area: '凯旋岭 · 西部断桥下方绿顶军用帐篷', type: 'collect', item: '拾取：艾娃少校的臂章', detail: '前往西部断桥高架路面正下方的墨绿色临时军用帐篷内，在桌下铁盒中拾取【艾娃少校的臂章】。' },
        ],
      },
    },
  },
  'industrial-espionage': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-gas-station-l0-z2', r: 46, label: '加油站外围燃气管道区', sub: '需携带布尔莱塔手枪入场' }],
        landmarks: [
          { x: 45.62, y: 17.27, title: '秘密军火交接箱', area: '郊区加油站西北侧 · 巨型橙白燃气罐旁', type: 'deliver', item: '需携带：布尔莱塔手枪', detail: '前往地图最北端加油站旁的工业管道区，在大型横置燃气储罐中间找到武器交接箱，放入布尔莱塔手枪。' },
        ],
      },
    },
  },
  'a-reveal-in-ruins': {
    cat: 'item-collect',
    mode: 'landmark',
    recMap: 'buried-city',
    targets: {
      'buried-city': {
        zones: [
          { poi: 'bc-plaza-rosa', label: '玫瑰广场药房', sub: '一楼街角Farmacia药房' },
          { poi: 'bc-piazza-arbusto-l0-z1', r: 44, label: '阿布斯托广场药房', sub: '地铁口旁绿招牌药房' },
        ],
        landmarks: [
          { step: 1, x: 54.83, y: 73.69, title: 'ESR分析仪 (玫瑰广场药房)', area: '玫瑰广场 · 药房1F收银柜台', type: 'collect', item: '拾取：ESR分析仪', detail: '撬开玫瑰广场东侧绿十字招牌药房大门，在一楼收银台表面直接拾取【ESR分析仪】。' },
          { step: 2, x: 70.87, y: 59.86, title: 'ESR分析仪 (阿布斯托药房)', area: '阿布斯托广场 · 药房1F柜台', type: 'collect', item: '拾取：ESR分析仪', detail: '位于阿布斯托广场东侧药房一楼货架后的结账台桌面上（任选一处拾取即可）。' },
          { step: 3, x: 51.88, y: 29.21, title: 'ESR分析仪 (医院药局)', area: '医院 · 1F药房柜台', type: 'collect', item: '拾取：ESR分析仪', detail: '也可在北部医院一楼药房柜台处拾取【ESR分析仪】。' },
        ],
      },
      'blue-gate': {
        landmarks: [
          { step: 1, x: 36.01, y: 31.53, title: 'ESR分析仪 (蓝门北部医疗站)', area: '奇袭者避难所东北 · 北部山道医疗帐篷', type: 'collect', item: '拾取：ESR分析仪', detail: '在蓝门西北部山道旁的医疗救助站柜台处也可拾取【ESR分析仪】。' },
        ],
      },
    },
  },
  'unexpected-initiative': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [
          { poi: 'bc-grandioso-apartments', label: '奢华公寓天台', sub: '顶层花园拾取水分测量仪' },
          { poi: 'bc-piazza-roma-l0-z2', r: 44, label: '罗马广场 CONVENIO 天台', sub: '屋顶花园种植槽挖掘营养测量仪' },
        ],
        landmarks: [
          { step: 1, x: 28.84, y: 68.07, title: '水分测量仪 (Water Meter)', area: '奢华公寓 · 南栋顶层露天花园', type: 'collect', item: '拾取：水分测量仪', detail: '乘电梯井滑索上至奢华公寓南栋顶楼天台，在种植盆旁的储物箱内取得【水分测量仪】。', targetXY: [36.52, 56.37] },
          { step: 2, x: 36.52, y: 56.37, title: '营养测量仪 (Fertilizer/Nutrient Meter)', area: '罗马广场 · CONVENIO大楼顶层温室花园', type: 'collect', item: '拾取：营养测量仪', detail: '前往罗马广场西侧的 CONVENIO 大楼天台花园，在屋顶种植槽土堆中取得【营养测量仪】并安全撤离。' },
        ],
      },
    },
  },
  'a-lay-of-the-land': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [
          { poi: 'sp-jiangsu-warehouse-l0-z2', r: 44, label: '江苏仓库', sub: '步骤①：获取航运清单' },
          { poi: 'sp-control-tower-a6', label: '控制塔A6', sub: '步骤②：拾取激光雷达扫描仪' },
        ],
        landmarks: [
          { step: 1, x: 26.86, y: 29.23, title: '江苏仓库航运清单', area: '江苏仓库 · 2F监工办公室桌面', type: 'interact', detail: '进入西北角江苏仓库，沿铁梯上至二楼玻璃隔间办公室，在办公桌上查阅航运清单。', targetXY: [52.05, 52.67] },
          { step: 2, x: 52.05, y: 52.67, title: '激光雷达扫描仪', area: '控制塔A6 · 顶层半包围隔间', type: 'collect', item: '拾取：激光雷达扫描仪', detail: '前往控制塔A6，上至顶层控制室屏风隔板后方的白色小箱子内拾取【激光雷达扫描仪】并撤离。' },
        ],
      },
    },
  },
  'a-symbol-of-unification': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-formicai-outpost-l0-z2', r: 44, label: '蚁丘山哨站', sub: '取旗并在东侧观景台升起' }],
        landmarks: [
          { step: 1, x: 49.6, y: 73.9, title: '奇袭者旗帜', area: '蚁丘山哨站 · 圆顶建筑内床铺上', type: 'collect', item: '拾取：奇袭者旗帜', detail: '从南部坡道进入蚁丘山哨站主圆顶厅，在右侧角落黄色布单覆盖的行军床上拾取【奇袭者旗帜】。', targetXY: [50.4, 73.4] },
          { step: 2, x: 50.4, y: 73.4, title: '俯瞰红湖旗杆', area: '蚁丘山哨站 · 东侧露天观景阳台', type: 'interact', item: '升起：奇袭者旗帜', detail: '走出主厅来到东侧朝向红湖的半圆形金属悬挑平台，在栏杆边旗杆处交互升旗。' },
        ],
      },
    },
  },
  'eyes-in-the-sky': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 54.89, y: 52.55, title: '控制塔顶雷达安装点', area: '控制塔 · 顶层露天金属塔架', type: 'interact', detail: '需携带【大坝控制塔钥匙】开启电梯井铁门乘滑索登顶，爬上屋顶最高处天线架安装扫描仪。' },
        ],
      },
      'buried-city': {
        landmarks: [
          { step: 2, x: 60.33, y: 32.93, title: '画廊天台雷达安装点', area: '画廊 (Galleria) · 屋顶北侧高架三脚架', type: 'interact', item: '需携带：1× 滑索', detail: '上至画廊平顶天台，在北侧高耸的黄色起重架下方架设滑索登顶，在三脚架处安装扫描仪。' },
        ],
      },
      'spaceport': {
        landmarks: [
          { step: 3, x: 71.53, y: 57.9, title: '通讯塔雷达安装点', area: '通讯塔 · 顶部折角铁平台', type: 'interact', detail: '前往太空港东侧通讯塔，顺着塔身竖梯爬到最顶层平台栏杆处安装激光雷达。' },
        ],
      },
    },
  },
  'celeste-s-journals': {
    cat: 'item-collect',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 30.87, y: 50.99, title: '塞莱斯特的日记 (南沼泽)', area: '沼泽南部岗哨 · 圆顶屋卧铺隔间', type: 'collect', item: '拾取：日志 (1/2)', detail: '进入沼泽南部岗哨大圆顶内部，在左侧小房间的床垫旁小桌面上拾取第一本日志（注意单局内需连取两本）。', targetXY: [70.95, 32.13] },
          { step: 2, x: 70.95, y: 32.13, title: '塞莱斯特的日记 (东岗哨)', area: '奇袭者岗哨东侧 · 中央居住舱床铺', type: 'collect', item: '拾取：日志 (2/2)', detail: '前往地图东北角的奇袭者岗哨东侧，在可俯瞰大坝裂口的房间床头柜上拾取第二本日志并安全撤离。' },
        ],
      },
    },
  },
  'the-major-s-footlocker': {
    cat: 'item-collect',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-ruby-residence-l0-z2', r: 42, label: '红宝石宅邸', sub: '西北栋二楼搜寻少校遗物' }],
        landmarks: [
          { x: 38.78, y: 28.12, title: '艾娃少校的储物箱', area: '红宝石宅邸 · 西北栋2F卧室书桌旁', type: 'collect', item: '拾取：艾娃少校的纪念品', detail: '进入红宝石宅邸西北侧公寓楼，走楼梯上二楼卧室，在靠窗木桌上的军用储物盒内拾取【艾娃少校的纪念品】。' },
        ],
      },
    },
  },
  'a-balanced-harvest': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-research-admin', label: '研究与行政区', sub: '二楼农业部实验室查阅档案' }],
        landmarks: [
          { x: 53.2, y: 55.43, title: '农业研究档案夹', area: '研究与行政区 · 2F接待大厅右侧实验1室', type: 'interact', detail: '从蓝色外楼梯或电梯井滑索上二楼，穿过碎玻璃走廊进入右侧「Lab 1」，在贴满便签的白板前办公桌上交互翻阅档案。' },
        ],
      },
    },
  },
  'back-on-top': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-pattern-house-l0-z2', r: 42, label: '壁画屋 · 喷漆标记区', sub: '在一楼外墙涂鸦处喷漆标记' }],
        landmarks: [{ x: 59.6, y: 25.64, title: '壁画屋外墙喷漆点', area: '壁画屋 · 北侧一楼外墙', type: 'interact', detail: '靠近壁画屋一楼北侧斑驳的外墙面，按交互键喷涂奇袭者瞭望标记。' }],
      },
      'buried-city': {
        zones: [{ x: 71.48, y: 40.96, r: 42, label: '掩埋地产壁画大楼 · 喷漆标记区', sub: '掩埋地产南侧巨幅壁画外墙' }],
        landmarks: [{ x: 71.48, y: 40.96, title: '壁画大楼外墙喷漆点', area: '掩埋地产 (Buried Properties) 南侧 · 壁画大楼外墙', type: 'interact', detail: '前往掩埋废城东侧的掩埋地产南缘，在绘有巨幅人物壁画的大楼底部墙面交互喷漆。' }],
      },
      'spaceport': {
        zones: [{ poi: 'sp-south-trench-tower-l0-z2', label: '南壕沟塔 · 喷漆标记区', sub: '塔楼底部支撑柱喷漆' }],
        landmarks: [{ x: 53.03, y: 31.71, title: '南壕沟塔喷漆点', area: '南壕沟塔 · 北侧楼梯下墙面', type: 'interact', detail: '前往太空港北侧战壕边的南壕沟塔，在户外金属楼梯下方的混凝土基座墙面上喷漆。' }],
      },
      'blue-gate': {
        zones: [{ x: 55.56, y: 52.56, r: 46, label: '白色瞭望塔 · 喷漆区', sub: '大门控制室南侧白色瞭望塔' }],
        landmarks: [{ x: 55.56, y: 52.56, title: '白色瞭望塔喷漆点', area: '大门控制室南侧 · 白色瞭望塔 (White Watchtower)', type: 'interact', detail: '前往蓝门中央仓库综合体南侧、大门控制室下方的白色瞭望塔，在塔底铁皮墙面上交互喷漆。' }],
      },
    },
  },
  'untended-garden': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-hydroponic-dome', label: '水培穹顶综合体', sub: '下载植物数据并上传至前线仓库' }],
        landmarks: [
          { step: 1, x: 49.99, y: 38.13, title: '水培中央数据终端', area: '水培穹顶综合体 · 东南侧大玻璃穹顶内', type: 'interact', detail: '进入水培穹顶东南侧圆顶温室，在中央金属走道旁的服务器终端下载植物培育档案。', targetXY: [46.55, 36.84] },
          { step: 2, x: 46.55, y: 36.84, title: '前线仓库上传终端', area: '水培穹顶西侧 · 前线仓库内部', type: 'interact', detail: '前往水培穹顶西侧紧邻的前线仓库（或任意前线仓库），在室内右侧电脑终端上传数据。' },
        ],
      },
    },
  },
  'our-presence-up-there': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-pattern-house-l0-z2', r: 42, label: '壁画屋信号发射区', sub: '先开1F电源，再登顶操作天线' }],
        landmarks: [
          { step: 1, x: 59.5, y: 25.8, title: '底层配电室开关', area: '壁画屋 · 1F西南角小配电间', type: 'interact', detail: '进入壁画屋一楼，撬开或走进西南角狭小的配电储藏室，拉下墙上的电源闸刀。', targetXY: [59.7, 25.5] },
          { step: 2, x: 59.7, y: 25.5, title: '屋顶发射天线终端', area: '壁画屋 · 顶楼天台边缘', type: 'interact', detail: '顺着室内楼梯或电梯井竖梯爬上壁画屋顶楼，在屋顶天线立杆旁交互完成信号发射。' },
        ],
      },
    },
  },
  'after-rain-comes': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-grandioso-apartments', label: '奢华公寓东北积水区', sub: '需携带2×电池、5×导线' }],
        landmarks: [
          { x: 34.33, y: 63.16, title: '浸水太阳能阵列配电箱', area: '奢华公寓东北侧 · 低洼积水沙地', type: 'deliver', item: '需携带：2×电池 · 5×导线', detail: '前往奢华公寓东北侧低洼沙坑积水处，找到半淹在水里的太阳能板阵列，提交2块电池和5根导线完成修复。' },
        ],
      },
    },
  },
  'the-root-of-the-matter': {
    cat: 'item-collect',
    mode: 'landmark',
    recMap: 'buried-city',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-research-building', label: '科研大楼 · 弧形观景窗实验室', sub: '俯瞰美景公园的房间内搜寻种子库' }],
        landmarks: [
          { step: 1, x: 55.4, y: 44.85, title: '低温实验种子罐 (科研大楼)', area: '科研大楼 · 1F东侧俯瞰美景公园的弧形大窗房间', type: 'collect', item: '拾取：实验型种子样品', detail: '前往掩埋废城中央偏北的科研大楼（美景公园西侧），进入东侧带巨大弧形观景窗的实验室，从银色圆柱低温罐中取出【实验型种子样品】。' },
        ],
      },
      'dam-battlegrounds': {
        landmarks: [
          { step: 2, x: 52.8, y: 54.6, title: '低温实验种子罐 (研究与行政中心)', area: '研究与行政区 · 2F北端弧形落地窗房间', type: 'collect', item: '拾取：实验型种子样品', detail: '备选点位：上至大坝研究与行政区二楼最北端（可透过大窗俯瞰大坝主体的办公会议室），从银色圆柱形低温罐中取出【实验型种子样品】。' },
        ],
      },
    },
  },
  'lost-in-transmission': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-control-tower-a6', label: '控制塔A6', sub: '登顶建立安全通讯连接' }],
        landmarks: [
          { x: 50.26, y: 53.06, title: '塔顶加密通讯终端', area: '控制塔A6 · 顶层塔台控制室', type: 'interact', detail: '进入控制塔A6一楼大厅，乘黄色滑索直达塔顶控制室，在面向发射场的控制台终端上交互完成连接。' },
        ],
      },
    },
  },
  'water-troubles': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-red-lakes-balcony-l0-z2', r: 44, label: '溢洪道南端防洪蓄水渠', sub: '潜入主坝南端地下引水渠采样' }],
        landmarks: [
          { step: 1, x: 58.19, y: 54.06, title: '溢洪道南端蓄水隧洞入口', area: '控制塔东北 · 溢洪道南端混凝土涵洞口', type: 'interact', detail: '前往控制塔东北侧与下层画廊北侧之间的岸边，走入半淹水的巨大混凝土方形排水涵洞口。', targetXY: [56.19, 55.85] },
          { step: 2, x: 56.19, y: 55.85, title: '主坝蓄水池采样阀门', area: '防洪涵洞内部 · 蓄水池管壁阀门', type: 'interact', detail: '顺着涵洞走入内部蓄水室，在管壁阀门前对流入的水源进行采样。' },
        ],
      },
    },
  },
  'communication-hideout': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-red-tower-l0-z2', r: 42, label: '红塔通讯据点', sub: '装电池开电源，上3F启动电台' }],
        landmarks: [
          { step: 1, x: 62.19, y: 70.64, title: '红塔院内发电机电池槽', area: '红塔 · 1F东侧围墙小院发电机', type: 'interact', detail: '进入红塔外围破墙小院，在发电机旁拾取备用电池塞入插槽，随后开启侧面的黄色电源盒。', targetXY: [60.14, 69.7] },
          { step: 2, x: 60.14, y: 69.7, title: '红塔三楼隐蔽长波终端', area: '红塔 · 3F破墙缺口外侧走廊', type: 'interact', detail: '上至红塔三楼，从墙体破洞钻到外侧窄檐平台，交互启动角落里的黄色长波接收终端。' },
        ],
      },
    },
  },
  'into-the-fray': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'source-of-the-contamination': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        zones: [{ poi: 'dam-water-treatment', label: '水处理控制中心北侧泄洪池', sub: '调查水池中央化学毒桶' }],
        landmarks: [
          { x: 40.07, y: 47.8, title: '泄露的化学原料桶', area: '水处理控制中心北侧 · 浅水沼泽泄洪池', type: 'interact', detail: '前往水处理控制中心大楼正北方的黄绿色污水中，涉水走到池子中央倾斜的蓝色塑料化工桶堆旁交互取样。' },
        ],
      },
    },
  },
  'paving-the-way': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 55.33, y: 53.37, title: 'ENELICA大楼研究员便条', area: '控制塔西北侧 · ENELICA办公楼2F', type: 'interact', detail: '进入大坝研究区与控制塔之间的ENELICA标志建筑（或水处理中心/发电厂ENELICA终端），在办公桌绿色公告板下查阅研究员便条。' },
        ],
      },
      'buried-city': {
        zones: [{ poi: 'bc-piazza-roma-l0-z2', r: 45, label: '罗马广场 CONVENIO 大楼', sub: '顶层下1层房间核对研究员日志' }],
        landmarks: [
          { step: 2, x: 36.59, y: 57.03, title: '研究员加密数据终端', area: '罗马广场 · CONVENIO大楼顶层下1层科研室', type: 'interact', detail: '前往罗马广场西侧的 CONVENIO 公寓大楼，乘滑索上顶楼天台后往下一层楼梯，在种植室隔壁满是显示器的房间内交互核对记录。' },
        ],
      },
      'blue-gate': {
        landmarks: [
          { step: 1, x: 55.02, y: 57.52, title: 'ENELICA中继站记录', area: '维护区地堡北侧 · 蓝门电网站', type: 'interact', detail: '也可在蓝门维护区地堡北侧的ENELICA设施内读取初始便条。' },
        ],
      },
    },
  },
  'switching-the-supply': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-launch-towers', label: '发射塔西侧地下隧道', sub: '转动地下主输水管阀门' }],
        landmarks: [
          { x: 44.46, y: 45.65, layer: 1, title: '地下主输水管道阀门', area: '发射塔西侧 · 地下维护隧道中央积水室', type: 'interact', detail: '从出发楼东侧斜坡或发射塔导流战壕进入地下设施隧道（切换至地下图层可见），在积水管道间找到带蓝色手轮的粗水管，交互旋转阀门。' },
        ],
      },
    },
  },
  'deciphering-the-data': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'spaceport': {
        zones: [
          { poi: 'sp-fuel-control-l0-z1', r: 42, label: '燃料控制单元 (步骤①)', sub: '1F车间解密终端' },
          { poi: 'sp-arrival-building', label: '到达楼 (步骤②)', sub: '2F控制室解密终端' },
        ],
        landmarks: [
          { step: 1, x: 58.49, y: 40.01, title: '磁能解密终端 #1', area: '燃料控制单元 · 1F大厅西北角控制台', type: 'interact', detail: '进入火箭组装区西侧的燃料控制单元，在一楼黄黑警示线旁的主机柜终端上运行第一次解密。', targetXY: [39.64, 35.18] },
          { step: 2, x: 39.64, y: 35.18, title: '磁能解密终端 #2', area: '到达楼 · 2F北侧通讯办公区', type: 'interact', detail: '在同一局内前往西北部到达楼，上二楼北侧摆满仪器的办公桌旁，在第二台磁能终端上完成最终破译。' },
        ],
      },
    },
  },
  'a-warm-place-to-rest': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-abandoned-highway-camp-l0-z2', r: 44, label: '废弃高速公路营地', sub: '检查幸存者背包并循红布木桩寻墓' }],
        landmarks: [
          { step: 1, x: 32.92, y: 71.02, title: '幸存者遗留背包', area: '废弃高速公路营地 · 高架桥断口公交车内', type: 'interact', detail: '登上西南角废弃高速公路高架桥面，在倾覆的公交车/帐篷营地内调查幸存者留下的红色背包。', targetXY: [73.87, 52.27] },
          { step: 2, x: 50.49, y: 58.98, title: '红布条路标中继点', area: '达芬奇大道东侧 · 半埋路标杆', type: 'interact', detail: '顺着高架桥向东北方向沿途寻找绑着红布条的白色木桩线索，一路穿过城区向东。' },
          { step: 3, x: 73.87, y: 52.27, title: '幸存者安息墓碑', area: '埋没的楼群东侧 · 沙丘砖墙废墟', type: 'interact', detail: '在地图东侧「埋没的楼群」再往东一点的半截红砖残垣旁，找到插有红布条木棍与石块的简易坟墓交互完成。' },
        ],
      },
    },
  },
  'groundbreaking': {
    cat: 'area-recon',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [
          { poi: 'bg-pilgrims-peak', label: '朝圣峰建筑工地', sub: '开启锁房查阅科研简报并拍摄住宅工程' },
          { poi: 'bg-abandoned-housing-project-l0-z2', r: 46, label: '废弃的住宅工程', sub: '拍摄住宅工程施工现场' },
        ],
        landmarks: [
          { step: 1, x: 70.66, y: 35.53, title: '朝圣峰掘进科研简报黑板', area: '朝圣峰 · 主塔楼上锁控制室', type: 'interact', item: '需携带：蓝门通信塔钥匙', detail: '前往蓝门东北角的朝圣峰，开启通信塔上锁房间并在黑板前查看科研简报。', targetXY: [70.12, 49.0] },
          { step: 2, x: 70.12, y: 49.0, title: '废弃住宅工程拍照点', area: '废弃的住宅工程 · 户外施工围挡旁', type: 'photo', detail: '前往朝圣峰南侧的废弃住宅工程，对准建筑工地按交互键拍照记录。' },
        ],
      },
    },
  },
  'dust-on-the-wires': {
    cat: 'item-collect',
    mode: 'landmark',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-communications-tower-l0-z2', r: 46, label: '通讯塔与东区配电线网', sub: '沿电缆搜寻侦察巡逻报告' }],
        landmarks: [
          { step: 1, x: 65.21, y: 65.65, title: '受损通信电缆接线箱 #1', area: '服务大楼西北侧 · 高压电线杆下', type: 'interact', detail: '前往太空港东南侧服务大楼西北面戈壁，调查电线杆底部的第一个接线终端。', targetXY: [66.98, 49.09] },
          { step: 2, x: 66.98, y: 49.09, title: '东部平原通信中继箱 #2', area: '东部平原仓库南侧 · 通讯塔西北电线杆', type: 'interact', detail: '顺着架空电缆向北前往东部平原仓库南侧，调查第二个中继接线盒。', targetXY: [44.81, 69.98] },
          { step: 3, x: 44.81, y: 69.98, title: '侦察巡逻报告 & 终端 #3', area: '维护区机库南侧 · 野外营地配电箱旁', type: 'collect', item: '拾取：侦察巡逻报告', detail: '前往维护区机库南侧营地配电箱旁拾取【侦察巡逻报告】（或通讯塔下 71.65%, 58.94% 备选点）。' },
        ],
      },
    },
  },
  'prescriptions-of-the-past': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-departure-building', label: '候机楼 · 2F医疗室', sub: '翻找旧时代医疗处方档案' }],
        landmarks: [
          { x: 39.58, y: 43.17, title: '旧时代处方档案柜', area: '出发楼 · 2F东北侧医疗急救室', type: 'interact', detail: '从出发航站楼正面主楼梯上二楼，左转进入带绿十字标志的医疗急救区，在里面小诊室的办公桌上翻阅医疗档案。' },
        ],
      },
    },
  },
  'a-dead-end': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-reinforced-reception', label: '加固接待处地下 MANTIS 掩体', sub: '深入地下掩体开启锁房并取回尘封胶片' }],
        landmarks: [
          { step: 1, x: 50.72, y: 39.56, layer: 0, title: 'MANTIS 地下设施入口 (加固接待处)', area: '加固接待处 · 1F电梯井与地下通道入口', type: 'interact', detail: '前往蓝门北部的加固接待处，通过电梯井滑索或楼梯进入地下安保翼楼（MANTIS 综合体）。', targetXY: [49.7, 42.4] },
          { step: 2, x: 49.7, y: 42.4, layer: 1, title: '布满灰尘的电影胶卷 & 内部终端', area: '地下层 · 安保翼楼西南侧机密档案室', type: 'collect', item: '拾取：布满灰尘的电影胶卷', detail: '切换至【地下层】地图，前往安保翼楼西南角的机密室，交互启动终端并在金属档案桌面上拾取【布满灰尘的电影胶卷】。' },
        ],
      },
    },
  },
  'power-out': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'spaceport': {
        zones: [{ poi: 'sp-electrical-substation-l0-z2', r: 44, label: '太空港南侧变电站', sub: '搬运电池装入配电盒并合闸' }],
        landmarks: [
          { x: 55.88, y: 76.1, title: '变电站配电合闸箱', area: '变电站 · 南侧红砖控制房内', type: 'interact', item: '搬运：备用发电机电池', detail: '进入太空港正南方的变电站围栏内，在变压器旁拾取掉落的【电池盒】，抱进南侧控制室塞入墙壁插槽，随后拉下总开关。' },
        ],
      },
    },
  },
  'fragmented-logs': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-cultural-archives', label: '文化档案馆后室与沙盘终端', sub: '需携带1×电子元件修复终端' }],
        landmarks: [
          { step: 1, x: 47.04, y: 58.28, layer: 0, title: '受损的科研日志读取器 #1', area: '下层 · 机器人沙盘南侧实验长廊', type: 'deliver', item: '需携带：1× 电子元件', detail: '切至星辰山【下层】地图，在机器人沙盘南侧长廊找到受损的日志终端并消耗1个电子元件修复。', targetXY: [59.94, 56.5] },
          { step: 2, x: 59.94, y: 56.5, layer: 1, title: '上层中庭数据中继终端 #2', area: '上层 · 中央走廊东侧科研台', type: 'interact', detail: '前往【上层】中央走廊东侧终端同步碎片化日志。', targetXY: [91.22, 56.78] },
          { step: 3, x: 91.22, y: 56.78, layer: 1, title: '档案馆主控机房后室 (最终导出)', area: '上层 · 文化档案馆最东端主控机房', type: 'interact', detail: '前往上层最东端的文化档案馆后室主控机房，在大型主机终端导出完整日志。' },
        ],
      },
    },
  },
  'flickering-threat': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'dam-battlegrounds': {
        zones: [
          { poi: 'dam-power-generation', label: '发电厂综合体', sub: '底层涡轮机房修复发电机' },
          { poi: 'dam-generator-hall-l0-z2', r: 40, label: '发电机大厅', sub: '涡轮机与楼上配电开关' },
        ],
        landmarks: [
          { step: 1, x: 59.91, y: 31.38, title: '受损的主涡轮发电机', area: '发电机大厅 · 底层积水坑道中央', type: 'interact', item: '需准备：4× 导线', detail: '跳入发电厂西侧的发电机大厅底层，在大型绿色涡轮发电机侧面交互修复线路（若未带够导线可在厂房内搜刮）。', targetXY: [62.83, 31.38] },
          { step: 2, x: 62.83, y: 31.38, title: '发电厂上层配电合闸箱', area: '发电厂综合体 · 南侧2F走廊尽头', type: 'interact', detail: '修好底层发电机后，从东侧楼梯上二楼走廊，推门进入配电控制间拉下黄色电源开关。' },
        ],
      },
    },
  },
  'furtive-meetings': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-medical-research', r: 42, label: '星辰山秘密集会调查线', sub: '依次排查医学研究部与下层东翼会议室' }],
        landmarks: [
          { step: 1, x: 14.08, y: 65.94, layer: 1, title: '秘密集会线索 #1 (医学研究部)', area: '上层 · 医学研究部西南角实验隔间', type: 'interact', detail: '前往星辰山【上层】最西端的医学研究部西南角房间，调查第一处秘密集会线索。', targetXY: [57.28, 66.7] },
          { step: 2, x: 57.28, y: 66.7, layer: 0, title: '秘密集会线索 #2 (下层沙盘东侧)', area: '下层 · 机器人沙盘B东侧办公区', type: 'interact', detail: '下至【下层】机器人沙盘B东侧办公间，核对第二处接头记录。', targetXY: [68.91, 58.0] },
          { step: 3, x: 68.91, y: 58.0, layer: 0, title: '秘密集会情报档案 (最终拾取)', area: '下层 · 东翼机密会议室桌面', type: 'collect', item: '拾取：秘密集会情报', detail: '前往【下层】东翼（种子库北侧）的机密会议室，在会议桌上拾取【秘密集会情报】并安全撤离。' },
        ],
      },
    },
  },
  'bees-': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [{ poi: 'bg-olive-grove-l0-z2', r: 44, label: '橄榄树林蜂箱区', sub: '在木制蜂箱旁采集蜂蜜样本' }],
        landmarks: [
          { x: 44.07, y: 62.92, title: '橄榄园木制蜂箱群', area: '橄榄树林 · 中央石砌小棚屋旁', type: 'interact', detail: '前往蓝门南部的橄榄树林，在中央爬满藤蔓的开放式小凉棚边找到一排白色木制蜂箱，靠近交互采集样本。' },
        ],
      },
    },
  },
  'last-entry': {
    cat: 'item-collect',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [{ poi: 'sm-seed-vault', label: '下层 · 种子库 (Seed Vault)', sub: '寻获保险箱钥匙并取出停机档案' }],
        landmarks: [
          { step: 1, x: 76.16, y: 67.98, layer: 0, title: '种子库北口监控室终端', area: '下层 · 种子库北口值班室', type: 'interact', detail: '切至星辰山【下层】地图，前往东南角的种子库北侧气密门值班室查看保险箱线索。', targetXY: [77.93, 65.26] },
          { step: 2, x: 77.93, y: 65.26, layer: 0, title: '种子库箱子钥匙', area: '下层 · 种子库东北侧储藏间桌面', type: 'collect', item: '拾取：种子库箱子钥匙', detail: '在种子库东北侧储藏室桌面上拾取【种子库箱子钥匙】。', targetXY: [73.79, 77.78] },
          { step: 3, x: 73.79, y: 77.78, layer: 0, title: '官方关停文件保险箱', area: '下层 · 种子库深处恒温密室', type: 'collect', item: '拾取：官方关停文件', detail: '深入种子库南端恒温密室，用钥匙打开保险箱取出【官方关停文件】并安全撤离。' },
        ],
      },
    },
  },
  'espresso': {
    cat: 'item-collect',
    mode: 'landmark',
    recMap: 'buried-city',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-plaza-rosa', label: '玫瑰广场咖啡馆', sub: '拆取浓缩咖啡机零件' }],
        landmarks: [
          { step: 1, x: 48.03, y: 72.6, title: '意式浓缩咖啡机 (玫瑰广场店)', area: '玫瑰广场 · 西侧红底白字「CAFFÈ」咖啡店1F吧台', type: 'collect', item: '拾取：浓缩咖啡机零件', detail: '前往掩埋废城南部的玫瑰广场，进入挂有红色「CAFFÈ」招牌的一楼咖啡馆，在金属吧台上的咖啡机处交互拆取【浓缩咖啡机零件】。' },
          { step: 2, x: 44.87, y: 64.94, title: '意式浓缩咖啡机 (老城区店)', area: '老城区 · 街角咖啡厅吧台', type: 'collect', item: '拾取：浓缩咖啡机零件', detail: '备选点位：老城区街角咖啡厅一楼吧台上的浓缩咖啡机。' },
          { step: 3, x: 60.54, y: 33.46, title: '意式浓缩咖啡机 (画廊咖啡吧)', area: '画廊 (Galleria) · 1F休息区吧台', type: 'collect', item: '拾取：浓缩咖啡机零件', detail: '备选点位：画廊一楼休息区咖啡吧台上的浓缩咖啡机。' },
        ],
      },
      'dam-battlegrounds': {
        landmarks: [
          { step: 1, x: 54.02, y: 53.77, title: '意式浓缩咖啡机 (研究与行政中心)', area: '研究与行政区 · 2F员工茶水间', type: 'collect', item: '拾取：浓缩咖啡机零件', detail: '在大坝研究与行政中心二楼员工茶水间吧台也可找到浓缩咖啡机并拆取零件。' },
          { step: 2, x: 63.21, y: 63.07, title: '意式浓缩咖啡机 (红湖哨站)', area: '红湖小楼 · 休息室桌面', type: 'collect', item: '拾取：浓缩咖啡机零件', detail: '大坝东南侧休息室内的备选浓缩咖啡机点位。' },
        ],
      },
    },
  },
  'line-in-the-sand': {
    cat: 'device-interact',
    mode: 'landmark',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-dune-s-end-l0-z2', r: 46, label: '沙丘尽头防线', sub: '部署警报信标并清理巡逻队' }],
        landmarks: [
          { x: 63.15, y: 20.96, title: '沙丘交界防线信标点', area: '市集废墟东北 · 沙丘尽头北侧防沙墙', type: 'interact', detail: '前往掩埋废城东北部的沙丘边缘（市集废墟与沙丘尽头之间），在半埋的混凝土路障旁交互部署警报信标。' },
        ],
      },
    },
  },
  'safe-passage': {
    cat: 'area-combat',
    mode: 'none',
    targets: {},
  },
  'life-of-a-pharmacist': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'buried-city': {
        zones: [{ poi: 'bc-piazza-arbusto-l0-z1', r: 44, label: '阿布斯托药房 · 拍照与调查区', sub: '药房1F与2F药剂师旧居调查4处遗物' }],
        landmarks: [
          { step: 1, x: 69.87, y: 60.67, title: '阿布斯托药房旧居4处记录点', area: '阿布斯托广场东侧 · 绿十字药房 (Arbusto Pharmacy) 2F公寓', type: 'photo', detail: '撬开阿布斯托广场地铁口旁的药房大门上二楼居住层，依次交互调查：1)餐桌旁的肖像画框；2)琴房的立式钢琴；3)客厅植物盆栽；4)窗边书桌上的全家福照片。' },
          { step: 2, x: 72.14, y: 61.31, title: '药剂师东街线索点', area: '阿布斯托药房东侧街口', type: 'interact', detail: '药房东侧街口外围辅助线索位置。' },
        ],
      },
    },
  },
  'safe-harbor': {
    cat: 'item-deliver',
    mode: 'landmark',
    targets: {
      'riven-tides': {
        zones: [
          { poi: 'rt-grand-hotel', label: '蔚蓝全景大酒店西岸与西南海角', sub: '勘察海岸观测站并修复引航灯塔' },
        ],
        landmarks: [
          { step: 1, x: 25.79, y: 61.19, title: '海滨观测台信标终端 #1', area: '蔚蓝全景大酒店西侧 · 海岸防波台', type: 'interact', detail: '前往裂潮镇西侧蔚蓝全景大酒店海岸防波台，交互检查第一座海岸导航终端。', targetXY: [18.76, 72.03] },
          { step: 2, x: 18.76, y: 72.03, title: '西南海角引航信标基座 #2', area: '西南海角 · 海岸引航灯塔基座', type: 'deliver', item: '需携带：1× 精密云台', detail: '前往地图西南角海岬灯塔基座（或东北防波堤 62.18%, 37.75%），消耗【精密云台】完成海岸引航信标修复。' },
        ],
      },
    },
  },
  'reduced-to-rubble': {
    cat: 'area-photo',
    mode: 'hybrid',
    targets: {
      'blue-gate': {
        zones: [
          { poi: 'bg-highway-collapse-l0-z2', r: 46, label: '高速公路崩塌区 · 拍照范围', sub: '步骤①：在断桥处拍摄坍塌照片' },
          { poi: 'bg-broken-earth-l0-z2', r: 50, label: '破碎地貌 · 勘察范围', sub: '步骤②：穿过破碎地貌调查巨型残骸' },
        ],
        landmarks: [
          { step: 1, x: 35.9, y: 61.73, title: '断桥坍塌拍照站位点', area: '高速公路崩塌区 · 高架桥断口边缘', type: 'photo', detail: '前往蓝门西南侧的高速公路崩塌区，站在倾斜的高架桥断口路标牌旁，对准坍塌现场按交互键拍照。', targetXY: [55.92, 62.06] },
          { step: 2, x: 55.92, y: 62.06, title: '未知ARC巨型坠机残骸', area: '破碎地貌 (Broken Earth) · 橄榄林东侧深坑', type: 'interact', detail: '从断桥向东穿过橄榄树林来到【破碎地貌】，走到沟壑北端巨大的金属机甲残骸前交互调查。' },
        ],
      },
    },
  },
  'in-my-image': {
    cat: 'device-interact',
    mode: 'hybrid',
    targets: {
      'stella-montis': {
        zones: [
          { poi: 'sm-medical-research', r: 44, label: '上层 · 医学研究部与安保桥', sub: '搜索并调查3具类人安卓义体' },
          { poi: 'sm-robotic-sandbox-b-l0-z2', r: 44, label: '下层 · 机器人沙盘B / 种子库', sub: '类人义体高密分布室' },
        ],
        landmarks: [
          { step: 1, x: 23.08, y: 56.43, layer: 1, title: '类人安卓义体 #1 (医学研究部)', area: '上层 · 医学研究部2F实验舱', type: 'interact', detail: '前往星辰山【上层】西侧的医学研究部（含 17.03%, 59.38% 与 21.92%, 64.23% 等多具义体），在实验台旁交互搜查第 1 具类人安卓义体。', targetXY: [65.52, 33.95] },
          { step: 2, x: 65.52, y: 33.95, layer: 1, title: '类人安卓义体 #2 (安保区过道桥)', area: '上层 · 大厅北侧安保区过道桥', type: 'interact', detail: '前往【上层】大厅北侧安保区过道桥（或自助餐厅 52.13%, 58.10% / 文化档案馆 80.85%, 58.73%），交互搜查第 2 具类人安卓义体。', targetXY: [50.25, 66.5] },
          { step: 3, x: 50.25, y: 66.5, layer: 0, title: '类人安卓义体 #3 (下层机器人沙盘B)', area: '下层 · 机器人沙盘B实验区', type: 'interact', detail: '前往【下层】机器人沙盘B（或种子库 73.04%, 75.85%）交互搜查第 3 具类人安卓义体。' },
        ],
      },
    },
  },
}
