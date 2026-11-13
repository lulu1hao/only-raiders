import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const pad2 = (n) => String(n).padStart(2, '0')

// ============================================================================
// 1. Elite ARC Categories (7 Medium / Heavy Elite ARCs Only — Small ARCs Excluded)
//    Referenced from arctracker.io & Official ARC Raiders Codex
// ============================================================================
export const ELITE_ARC_CATEGORIES = [
  {
    id: 'arc-sentinel',
    name: '哨卫',
    enName: 'Sentinel',
    shortName: '哨卫',
    roleTag: '远程狙击',
    icon: 'items/T_UI_Icon_Salvage_Sniper_Part.png',
    accent: '#f97316',
    dropItem: '“哨卫”发射核心 (Sentinel Firing Core) · 武器工作台 Lv.3 升级核心材料',
    weakpoint: '橙色激光瞄准镜下方的旋转关节与背部散热电容',
    summary:
      '固定部署于高层建筑屋顶、大坝塔楼与峡谷高架桥底部的重型远程狙击炮塔。锁定奇袭者时会投射醒目的橙色瞄准激光，蓄力后发射高穿甲狙击弹。',
  },
  {
    id: 'arc-shredder',
    name: '粉碎者',
    enName: 'Shredder',
    shortName: '粉碎者',
    roleTag: '近战重装',
    icon: 'items/T_UI_Icon_Salvage_TorchGinger.png',
    accent: '#e11d48',
    dropItem: '“粉碎者”陀螺仪 (Shredder Gyro) · 高级机械元件 · 重型霰弹片',
    weakpoint: '底盘下方的反重力悬浮推进器与背部涡轮进气口',
    summary:
      '利用悬浮推进系统在室内长廊、地下隧道与机库高密区巡弋的近战处决机甲。发现目标后会高速突进并向四周喷射 360° 致命霰弹破片。',
  },
  {
    id: 'arc-bastion',
    name: '堡垒',
    enName: 'Bastion',
    shortName: '堡垒',
    roleTag: '重装机甲',
    icon: 'items/T_UI_Icon_Salvage_Chonk_Part.png',
    accent: '#ef4444',
    dropItem: '“堡垒”电池 (Bastion Cell) · 装备工作台 Lv.3 升级核心材料 · 先进机械元件',
    weakpoint: '膝部黄色液压关节圆柱与后背暴露的黄色核聚变核心罐',
    summary:
      '全身披挂厚重玄武装甲的重型四足陆战机甲，配备高射速旋转加特林机炮。正面装甲极难击穿，需集火腿部黄色关节使其跪地，再绕后攻击背部核心罐。',
  },
  {
    id: 'arc-bombardier',
    name: '投弹手',
    enName: 'Bombardier',
    shortName: '投弹手',
    roleTag: '重炮轰炸',
    icon: 'items/T_UI_Icon_Salvage_MonkPart.png',
    accent: '#a855f7',
    dropItem: '“投弹手”电池 (Bombardier Cell) · 精加工机 Lv.3 升级核心材料 · 爆裂物组件',
    weakpoint: '优先击落随行的 2 架观测无人机以致盲火控，再攻击背部黄色迫击炮装填舱',
    summary:
      '搭载双联重型迫击炮的远程曲射轰炸机甲，常由两架小型观测机伴随提供跨掩体视野。一旦被锁定会倾泻密集高爆弹幕，必须贴近死角或击毁观测机。',
  },
  {
    id: 'arc-leaper',
    name: '跳跃者',
    enName: 'Leaper',
    shortName: '跳跃者',
    roleTag: '高机动突袭',
    icon: 'items/T_UI_Icon_Salvage_Mat_Bison_Part.png',
    accent: '#eab308',
    dropItem: '“跳跃者”脉冲单元 (Leaper Pulse Unit) · 工具工作台 Lv.3 升级核心材料',
    weakpoint: '面部中央黄色光学核心眼与腾空蓄力时展开的腿部推进器',
    summary:
      '具备超远距离跳跃能力的高机动四足猎杀机甲（俗称“蜘蛛/野牛”）。能瞬间跃上屋顶或跨越峡谷发动范围震荡践踏与电磁脉冲，对火焰伤害尤为脆弱。',
  },
  {
    id: 'arc-rocketeer',
    name: '火箭手',
    enName: 'Rocketeer',
    shortName: '火箭手',
    roleTag: '重型空优',
    icon: 'items/T_UI_Icon_Salvage_Mat_HeavyDronePart.png',
    accent: '#38bdf8',
    dropItem: '“火箭手”引擎 (Rocketeer Driver) · 爆炸物工作台 Lv.3 升级核心材料',
    weakpoint: '左右两侧挂载的四联装向量推进涡轮引擎（击毁单侧即可令其失衡坠毁）',
    summary:
      '统治开阔领空的重装甲悬浮炮艇，双翼挂载多管齐射火箭巢。发射前会有多道红色激光锁定地面，齐射火力足以瞬间团灭无掩体小队。',
  },
  {
    id: 'arc-vaporizer',
    name: '汽化者',
    enName: 'Vaporizer',
    shortName: '汽化者',
    roleTag: '高能热熔',
    icon: 'items/T_UI_Icon_Salvage_HeavyDroneLaser_Part.png',
    accent: '#06b6d4',
    dropItem: '高能激光聚焦核心 · 先进电力组件 · ARC 能量电池',
    weakpoint: '机身下方蓄能发光的青色热熔聚焦镜与两侧散热鳍片',
    summary:
      '搭载持续性高能热熔激光束的精英重型武装机甲。发射前会凝聚刺目的青白色电弧，激光扫射路径会产生高温汽化带，需利用坚固掩体规避其照射周期。',
  },
]

export const ELITE_ARC_CATEGORIES_BY_ID = Object.fromEntries(
  ELITE_ARC_CATEGORIES.map((c) => [c.id, c]),
)

// ============================================================================

// ============================================================================
// 2. Verified Elite ARC Spawn Coordinates per Map (`ELITE_ARC_SPAWNS`)
//    Calibrated against UE5 World Bounds & arctracker.io Pin/Condition Data
// ============================================================================
export const ELITE_ARC_SPAWNS = {
  "dam-battlegrounds": {
    "arc-sentinel": [
      {
        "layer": 0,
        "x": 58.94,
        "y": 37.2,
        "worldCoord": [
          4886.4,
          5279.4
        ],
        "count": 1,
        "poiName": "受控访问区",
        "area": "受控访问区",
        "enArea": "Controlled Access Zone",
        "note": "固定架设于【受控访问区】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 52.05,
        "y": 47.17,
        "worldCoord": [
          4721.2,
          5518.6
        ],
        "count": 2,
        "poiName": "溢洪道闸门",
        "area": "溢洪道闸门",
        "enArea": "Spillway Gates",
        "note": "固定架设于【溢洪道闸门】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 57.05,
        "y": 35.18,
        "worldCoord": [
          4841,
          5230.9
        ],
        "count": 1,
        "poiName": "受控访问区",
        "area": "电力控制综合体",
        "enArea": "Power Control Complex",
        "note": "固定架设于【电力控制综合体】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 50.48,
        "y": 37.97,
        "worldCoord": [
          4683.4,
          5297.8
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · 东侧",
        "enArea": "Hydroponic Dome Complex",
        "note": "固定架设于【水培穹顶综合体】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 45.24,
        "y": 38.41,
        "worldCoord": [
          4557.6,
          5308.4
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · 西南侧",
        "enArea": "Hydroponic Dome Complex",
        "note": "固定架设于【水培穹顶综合体】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 59.07,
        "y": 43.81,
        "worldCoord": [
          4889.5,
          5438
        ],
        "count": 1,
        "poiName": "大裂缝",
        "area": "大裂缝",
        "enArea": "The Breach",
        "note": "固定架设于【大裂缝】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 48.24,
        "y": 51.46,
        "worldCoord": [
          4629.6,
          5621.6
        ],
        "count": 1,
        "poiName": "维护区",
        "area": "维护区",
        "enArea": "Maintenance",
        "note": "固定架设于【维护区】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 40.48,
        "y": 48.35,
        "worldCoord": [
          4443.4,
          5547
        ],
        "count": 1,
        "poiName": "水处理控制中心",
        "area": "水处理中心",
        "enArea": "Water Treatment",
        "note": "固定架设于【水处理中心】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 55.75,
        "y": 58.97,
        "worldCoord": [
          4809.8,
          5801.8
        ],
        "count": 1,
        "poiName": "低地画廊",
        "area": "低地奇袭者营地",
        "enArea": "Raider Camp",
        "note": "固定架设于【低地奇袭者营地】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 62.92,
        "y": 31.9,
        "worldCoord": [
          4981.9,
          5152.2
        ],
        "count": 1,
        "poiName": "发电厂综合体",
        "area": "发电厂通风竖井",
        "enArea": "Ventilation Shaft",
        "note": "固定架设于【发电厂通风竖井】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 0,
        "x": 54.37,
        "y": 51.94,
        "worldCoord": [
          4776.7,
          5633.1
        ],
        "count": 1,
        "poiName": "控制塔",
        "area": "控制塔",
        "enArea": "Control Tower",
        "note": "固定驻守于【控制塔】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 53.27,
        "y": 54.84,
        "worldCoord": [
          4750.3,
          5702.7
        ],
        "count": 1,
        "poiName": "研究与行政区",
        "area": "研究与行政区",
        "enArea": "Research & Administration",
        "note": "固定驻守于【研究与行政区】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 53.88,
        "y": 47.94,
        "worldCoord": [
          4765,
          5537.1
        ],
        "count": 1,
        "poiName": "溢洪道闸门",
        "area": "溢洪道闸门",
        "enArea": "Spillway Gates",
        "note": "固定驻守于【溢洪道闸门】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 44.5,
        "y": 49.53,
        "worldCoord": [
          4539.8,
          5575.3
        ],
        "count": 1,
        "poiName": "水处理控制中心",
        "area": "水处理中心",
        "enArea": "Water Treatment",
        "note": "固定驻守于【水处理中心】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 46.53,
        "y": 38.46,
        "worldCoord": [
          4588.6,
          5309.6
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体",
        "enArea": "Hydroponic Dome Complex",
        "note": "固定驻守于【水培穹顶综合体】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 59.08,
        "y": 36.32,
        "worldCoord": [
          4889.8,
          5258.2
        ],
        "count": 1,
        "poiName": "受控访问区",
        "area": "受控访问区",
        "enArea": "Controlled Access Zone",
        "note": "固定驻守于【受控访问区】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 62.59,
        "y": 62.34,
        "worldCoord": [
          4974,
          5882.7
        ],
        "count": 1,
        "poiName": "测试附楼",
        "area": "测试附楼",
        "enArea": "Testing Annex",
        "note": "固定驻守于【测试附楼】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 62.38,
        "y": 35.23,
        "worldCoord": [
          4969,
          5232.1
        ],
        "count": 1,
        "poiName": "地下通道",
        "area": "地下通道",
        "enArea": "Underpass",
        "note": "固定驻守于【地下通道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 40.75,
        "y": 49.9,
        "worldCoord": [
          4449.8,
          5584.2
        ],
        "count": 1,
        "poiName": "水处理控制中心",
        "area": "水处理控制中心",
        "enArea": "Water Treatment Control",
        "note": "固定驻守于【水处理控制中心】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 0,
        "x": 47.95,
        "y": 37.17,
        "worldCoord": [
          4622.6,
          5278.8
        ],
        "count": 2,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · #1",
        "enArea": "Hydroponic Dome Complex",
        "note": "在【水培穹顶综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.87,
        "y": 51.41,
        "worldCoord": [
          4692.7,
          5620.4
        ],
        "count": 1,
        "poiName": "维护区",
        "area": "维护区 · 东侧 #1",
        "enArea": "Maintenance",
        "note": "在【维护区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 61.2,
        "y": 37.38,
        "worldCoord": [
          4940.5,
          5283.6
        ],
        "count": 2,
        "poiName": "受控访问区",
        "area": "受控访问区 · 东南侧 #1",
        "enArea": "Controlled Access Zone",
        "note": "在【受控访问区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 49.45,
        "y": 40.39,
        "worldCoord": [
          4658.6,
          5355.9
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · 东南侧",
        "enArea": "Hydroponic Dome Complex",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【水培穹顶综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.36,
        "y": 37.21,
        "worldCoord": [
          4920.5,
          5279.6
        ],
        "count": 1,
        "poiName": "受控访问区",
        "area": "受控访问区 · 东南侧 #2",
        "enArea": "Controlled Access Zone",
        "note": "在【受控访问区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.36,
        "y": 51.51,
        "worldCoord": [
          4680.5,
          5622.8
        ],
        "count": 1,
        "poiName": "维护区",
        "area": "维护区 · 东侧 #2",
        "enArea": "Maintenance",
        "note": "在【维护区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 55.31,
        "y": 59.9,
        "worldCoord": [
          4799.3,
          5824.2
        ],
        "count": 1,
        "poiName": "低地画廊",
        "area": "大坝外围",
        "enArea": "The Dam",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【大坝外围】（低地画廊周边）沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [
      {
        "layer": 0,
        "x": 47.6,
        "y": 37.24,
        "worldCoord": [
          4614.2,
          5280.3
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · #1",
        "enArea": "Hydroponic Dome Complex",
        "note": "在【水培穹顶综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.47,
        "y": 50.98,
        "worldCoord": [
          4683,
          5610.1
        ],
        "count": 2,
        "poiName": "维护区",
        "area": "维护区",
        "enArea": "Maintenance",
        "note": "在【维护区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 55.59,
        "y": 60.03,
        "worldCoord": [
          4806,
          5827.3
        ],
        "count": 1,
        "poiName": "低地画廊",
        "area": "大坝外围",
        "enArea": "The Dam",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【大坝外围】（低地画廊周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 49.49,
        "y": 40.12,
        "worldCoord": [
          4659.6,
          5349.4
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · 东南侧",
        "enArea": "Hydroponic Dome Complex",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【水培穹顶综合体】沿预设路径巡逻。"
      }
    ],
    "arc-leaper": [
      {
        "layer": 0,
        "x": 49.87,
        "y": 40.99,
        "worldCoord": [
          4668.6,
          5370.3
        ],
        "count": 2,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体",
        "enArea": "Hydroponic Dome Complex",
        "note": "在【水培穹顶综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 40.31,
        "y": 42.97,
        "worldCoord": [
          4439.3,
          5417.8
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东北侧",
        "enArea": "Swamp",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 67.53,
        "y": 49.12,
        "worldCoord": [
          5092.6,
          5565.4
        ],
        "count": 1,
        "poiName": "红湖",
        "area": "红湖 · 西南侧",
        "enArea": "Red Lakes",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【红湖】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.88,
        "y": 51.65,
        "worldCoord": [
          4933,
          5626.2
        ],
        "count": 1,
        "poiName": "红湖",
        "area": "红湖 · 西侧",
        "enArea": "Red Lakes",
        "note": "在【红湖】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.43,
        "y": 44.34,
        "worldCoord": [
          4538.2,
          5450.7
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东侧",
        "enArea": "Swamp",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.63,
        "y": 52.74,
        "worldCoord": [
          4542.8,
          5652.3
        ],
        "count": 2,
        "poiName": "水处理控制中心",
        "area": "水处理庭院",
        "enArea": "Water Treatment Courtyard",
        "note": "在【水处理庭院】（水处理控制中心周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.19,
        "y": 61.38,
        "worldCoord": [
          4916.3,
          5859.8
        ],
        "count": 2,
        "poiName": "测试附楼",
        "area": "大坝外围 · 西北侧",
        "enArea": "The Dam",
        "note": "在【大坝外围】（测试附楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 59.64,
        "y": 60.64,
        "worldCoord": [
          4903.2,
          5841.9
        ],
        "count": 1,
        "poiName": "低地画廊",
        "area": "大坝外围 · 东南侧",
        "enArea": "The Dam",
        "note": "在【大坝外围】（低地画廊周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 61.55,
        "y": 36.61,
        "worldCoord": [
          4949,
          5265.2
        ],
        "count": 1,
        "poiName": "受控访问区",
        "area": "受控访问区",
        "enArea": "Controlled Access Zone",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【受控访问区】沿预设路径巡逻。"
      }
    ],
    "arc-rocketeer": [
      {
        "layer": 0,
        "x": 39.42,
        "y": 43.79,
        "worldCoord": [
          4417.9,
          5437.5
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东北侧 #1",
        "enArea": "Swamp",
        "note": "在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.84,
        "y": 34.34,
        "worldCoord": [
          4884,
          5210.7
        ],
        "count": 1,
        "poiName": "地下通道",
        "area": "地下通道",
        "enArea": "Underpass",
        "note": "在【地下通道】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.58,
        "y": 61.88,
        "worldCoord": [
          4925.8,
          5871.7
        ],
        "count": 2,
        "poiName": "测试附楼",
        "area": "测试附楼停车场",
        "enArea": "Parking Lot",
        "note": "在【测试附楼停车场】（测试附楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.85,
        "y": 37.89,
        "worldCoord": [
          4716.2,
          5295.9
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东北侧 #2",
        "enArea": "Swamp",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 42.66,
        "y": 52.72,
        "worldCoord": [
          4495.7,
          5651.8
        ],
        "count": 1,
        "poiName": "水处理控制中心",
        "area": "水处理庭院 · 东南侧 #1",
        "enArea": "Water Treatment Courtyard",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【水处理庭院】（水处理控制中心周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 46.94,
        "y": 39.29,
        "worldCoord": [
          4598.4,
          5329.5
        ],
        "count": 2,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · 南侧",
        "enArea": "Hydroponic Dome Complex",
        "spawnCondition": "base+hurricane",
        "note": "【常规 + 飓风叠加刷新】普通战局固定存在 1 处刷新槽位，进入【飓风】地图事件后将在同坐标额外追加刷新。 在【水培穹顶综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.89,
        "y": 45.95,
        "worldCoord": [
          4645.2,
          5489.4
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东侧 #1",
        "enArea": "Swamp",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.8,
        "y": 52.29,
        "worldCoord": [
          4787,
          5641.5
        ],
        "count": 1,
        "poiName": "控制塔",
        "area": "控制塔",
        "enArea": "Control Tower",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【控制塔】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 53.5,
        "y": 48.46,
        "worldCoord": [
          4755.8,
          5549.6
        ],
        "count": 1,
        "poiName": "溢洪道闸门",
        "area": "溢洪道闸门 · 东侧",
        "enArea": "Spillway Gates",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【溢洪道闸门】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 64.37,
        "y": 58.99,
        "worldCoord": [
          5016.7,
          5802.3
        ],
        "count": 1,
        "poiName": "测试附楼",
        "area": "低地画廊东侧",
        "enArea": "Lower Gallery",
        "note": "在【低地画廊东侧】（测试附楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 61.37,
        "y": 32.08,
        "worldCoord": [
          4944.7,
          5156.5
        ],
        "count": 1,
        "poiName": "发电厂综合体",
        "area": "发电厂综合体",
        "enArea": "Power Generation Complex",
        "note": "在【发电厂综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 38.41,
        "y": 43.17,
        "worldCoord": [
          4393.7,
          5422.6
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地中央升降梯",
        "enArea": "Central Swamp Lift",
        "note": "在【湿地中央升降梯】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.85,
        "y": 53.31,
        "worldCoord": [
          4524.2,
          5666
        ],
        "count": 1,
        "poiName": "水处理控制中心",
        "area": "水处理庭院 · 东南侧 #2",
        "enArea": "Water Treatment Courtyard",
        "note": "在【水处理庭院】（水处理控制中心周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.7,
        "y": 43.25,
        "worldCoord": [
          4712.6,
          5424.6
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东侧 #2",
        "enArea": "Swamp",
        "note": "在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.08,
        "y": 38.19,
        "worldCoord": [
          4625.8,
          5303.1
        ],
        "count": 1,
        "poiName": "水培穹顶综合体",
        "area": "水培穹顶综合体 · #2",
        "enArea": "Hydroponic Dome Complex",
        "note": "在【水培穹顶综合体】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.03,
        "y": 45.25,
        "worldCoord": [
          4912.6,
          5472.6
        ],
        "count": 1,
        "poiName": "大裂缝",
        "area": "大裂缝",
        "enArea": "The Breach",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【大裂缝】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 65.73,
        "y": 45.26,
        "worldCoord": [
          5049.4,
          5472.8
        ],
        "count": 1,
        "poiName": "红湖",
        "area": "红湖 · 西北侧",
        "enArea": "Red Lakes",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【红湖】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 53.01,
        "y": 45.8,
        "worldCoord": [
          4744.1,
          5485.8
        ],
        "count": 2,
        "poiName": "溢洪道闸门",
        "area": "溢洪道闸门 · 东北侧",
        "enArea": "Spillway Gates",
        "spawnCondition": "base+hurricane",
        "note": "【常规 + 飓风叠加刷新】普通战局固定存在 1 处刷新槽位，进入【飓风】地图事件后将在同坐标额外追加刷新。 在【溢洪道闸门】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 71.07,
        "y": 46.65,
        "worldCoord": [
          5177.5,
          5506.2
        ],
        "count": 1,
        "poiName": "红湖",
        "area": "红湖 · 东北侧",
        "enArea": "Red Lakes",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【红湖】沿预设路径巡逻。"
      }
    ],
    "arc-vaporizer": [
      {
        "layer": 0,
        "x": 57.47,
        "y": 41.13,
        "worldCoord": [
          4851.1,
          5373.7
        ],
        "count": 1,
        "poiName": "大裂缝",
        "area": "大裂缝",
        "enArea": "The Breach",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【大裂缝】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 62.94,
        "y": 30.57,
        "worldCoord": [
          4982.4,
          5120.2
        ],
        "count": 1,
        "poiName": "发电厂综合体",
        "area": "大坝外围 · 北侧",
        "enArea": "The Dam",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【大坝外围】（发电厂综合体周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 47.91,
        "y": 52.79,
        "worldCoord": [
          4621.7,
          5653.5
        ],
        "count": 1,
        "poiName": "维护区",
        "area": "野外补给站",
        "enArea": "Field Depot",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【野外补给站】（维护区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 52.09,
        "y": 33.11,
        "worldCoord": [
          4722,
          5181.2
        ],
        "count": 1,
        "poiName": "凯旋岭",
        "area": "凯旋岭南麓",
        "enArea": "Victory Ridge",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【凯旋岭南麓】（凯旋岭周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 47.26,
        "y": 43.82,
        "worldCoord": [
          4606.1,
          5438.2
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东侧 #1",
        "enArea": "Swamp",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 63.34,
        "y": 46.83,
        "worldCoord": [
          4992,
          5510.5
        ],
        "count": 1,
        "poiName": "红湖",
        "area": "红湖 · 西侧",
        "enArea": "Red Lakes",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【红湖】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 49.2,
        "y": 45.18,
        "worldCoord": [
          4652.6,
          5470.9
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东侧 #2",
        "enArea": "Swamp",
        "note": "在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.2,
        "y": 47.06,
        "worldCoord": [
          4772.6,
          5516
        ],
        "count": 1,
        "poiName": "溢洪道闸门",
        "area": "溢洪道闸门",
        "enArea": "Spillway Gates",
        "note": "在【溢洪道闸门】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 71.07,
        "y": 46.65,
        "worldCoord": [
          5177.5,
          5506.2
        ],
        "count": 1,
        "poiName": "红湖",
        "area": "红湖 · 东北侧",
        "enArea": "Red Lakes",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【红湖】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.39,
        "y": 43.99,
        "worldCoord": [
          4513.2,
          5442.3
        ],
        "count": 1,
        "poiName": "湿地",
        "area": "湿地沼泽 · 东北侧",
        "enArea": "Swamp",
        "note": "在【湿地沼泽】（湿地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 62.46,
        "y": 57.67,
        "worldCoord": [
          4970.9,
          5770.6
        ],
        "count": 1,
        "poiName": "红湖阳台",
        "area": "大坝外围 · 东侧",
        "enArea": "The Dam",
        "note": "在【大坝外围】（红湖阳台周边）沿预设路径巡逻。"
      }
    ]
  },
  "buried-city": {
    "arc-sentinel": [
      {
        "layer": 0,
        "x": 58.64,
        "y": 43.69,
        "worldCoord": [
          1171.5,
          5077.7
        ],
        "count": 1,
        "poiName": "航天大楼",
        "area": "航天大楼",
        "enArea": "Space Travel",
        "note": "固定架设于【航天大楼】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 53.45,
        "y": 58.14,
        "worldCoord": [
          1119.6,
          5222.2
        ],
        "count": 1,
        "poiName": "市政厅",
        "area": "老城区 · 南侧",
        "enArea": "Old Town",
        "note": "固定架设于【老城区】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 69.42,
        "y": 57.48,
        "worldCoord": [
          1279.3,
          5215.6
        ],
        "count": 1,
        "poiName": "阿布斯托广场",
        "area": "阿布斯托高塔",
        "enArea": "Arbusto Tower",
        "note": "固定架设于【阿布斯托高塔】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 65.76,
        "y": 64.53,
        "worldCoord": [
          1242.7,
          5286.1
        ],
        "count": 1,
        "poiName": "阿布斯托药房",
        "area": "叛乱街区（阿布斯托南）",
        "enArea": "Mutiny Block",
        "note": "固定架设于【叛乱街区（阿布斯托南）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 53.21,
        "y": 68.55,
        "worldCoord": [
          1117.2,
          5326.3
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区 · 西北侧 #1",
        "enArea": "Old Town",
        "note": "固定架设于【老城区】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 50.83,
        "y": 77.38,
        "worldCoord": [
          1093.4,
          5414.6
        ],
        "count": 1,
        "poiName": "南站地铁楼梯口",
        "area": "南站地铁楼梯口",
        "enArea": "Southern Station",
        "note": "固定架设于【南站地铁楼梯口】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 37.23,
        "y": 58.15,
        "worldCoord": [
          957.4,
          5222.3
        ],
        "count": 1,
        "poiName": "罗马广场康维尼奥顶层",
        "area": "罗马广场",
        "enArea": "Piazza Roma",
        "note": "固定架设于【罗马广场】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 45.01,
        "y": 54.87,
        "worldCoord": [
          1035.2,
          5189.5
        ],
        "count": 1,
        "poiName": "达芬奇大道",
        "area": "老城区 · 西北侧 #2",
        "enArea": "Old Town",
        "note": "固定架设于【老城区】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 48.06,
        "y": 43.57,
        "worldCoord": [
          1065.7,
          5076.5
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园",
        "enArea": "Marano Park",
        "note": "固定架设于【马拉诺公园】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 50.03,
        "y": 29.98,
        "worldCoord": [
          1085.4,
          4940.6
        ],
        "count": 1,
        "poiName": "医院",
        "area": "医院",
        "enArea": "Hospital",
        "note": "固定架设于【医院】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 60.05,
        "y": 35.32,
        "worldCoord": [
          1185.6,
          4994
        ],
        "count": 1,
        "poiName": "画廊",
        "area": "画廊",
        "enArea": "Galleria",
        "note": "固定架设于【画廊】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 0,
        "x": 54.07,
        "y": 64.39,
        "worldCoord": [
          1125.8,
          5284.7
        ],
        "count": 1,
        "poiName": "圣玛丽亚住宅区",
        "area": "达芬奇庭院",
        "enArea": "Da Vinci Courtyard",
        "note": "固定驻守于【达芬奇庭院】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 60.6,
        "y": 72.97,
        "worldCoord": [
          1191.1,
          5370.5
        ],
        "count": 1,
        "poiName": "红塔",
        "area": "红塔",
        "enArea": "Red Tower",
        "note": "固定驻守于【红塔】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 39.58,
        "y": 63.06,
        "worldCoord": [
          980.9,
          5271.4
        ],
        "count": 1,
        "poiName": "罗马广场康维尼奥顶层",
        "area": "老城区",
        "enArea": "Old Town",
        "note": "固定驻守于【老城区】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 35.98,
        "y": 56.14,
        "worldCoord": [
          944.9,
          5202.2
        ],
        "count": 1,
        "poiName": "罗马广场康维尼奥顶层",
        "area": "A1公寓楼（康维尼奥周边）",
        "enArea": "Apartment Building A1",
        "note": "固定驻守于【A1公寓楼（康维尼奥周边）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 43.83,
        "y": 51.3,
        "worldCoord": [
          1023.4,
          5153.8
        ],
        "count": 1,
        "poiName": "罗马广场",
        "area": "罗马广场",
        "enArea": "Piazza Roma",
        "note": "固定驻守于【罗马广场】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 55.63,
        "y": 53.76,
        "worldCoord": [
          1141.4,
          5178.4
        ],
        "count": 1,
        "poiName": "市政厅",
        "area": "市政厅",
        "enArea": "Town Hall",
        "note": "固定驻守于【市政厅】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 67.92,
        "y": 62.6,
        "worldCoord": [
          1264.3,
          5266.8
        ],
        "count": 1,
        "poiName": "阿布斯托广场",
        "area": "阿布斯托广场",
        "enArea": "Piazza Arbusto",
        "note": "固定驻守于【阿布斯托广场】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 49.97,
        "y": 73.58,
        "worldCoord": [
          1084.8,
          5376.6
        ],
        "count": 1,
        "poiName": "玫瑰广场",
        "area": "玫瑰广场",
        "enArea": "Plaza Rosa",
        "note": "固定驻守于【玫瑰广场】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 30.09,
        "y": 64.27,
        "worldCoord": [
          886,
          5283.5
        ],
        "count": 1,
        "poiName": "奢华公寓",
        "area": "B2公寓楼（奢华公寓）",
        "enArea": "Apartment Building B2",
        "note": "固定驻守于【B2公寓楼（奢华公寓）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 53.74,
        "y": 41.12,
        "worldCoord": [
          1122.5,
          5052
        ],
        "count": 1,
        "poiName": "新区",
        "area": "研究所（新区）",
        "enArea": "Research",
        "note": "固定驻守于【研究所（新区）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 58.32,
        "y": 41.15,
        "worldCoord": [
          1168.3,
          5052.3
        ],
        "count": 1,
        "poiName": "航天大楼",
        "area": "航天大楼",
        "enArea": "Space Travel",
        "note": "固定驻守于【航天大楼】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 50.79,
        "y": 26.26,
        "worldCoord": [
          1093,
          4903.4
        ],
        "count": 1,
        "poiName": "医院",
        "area": "医院",
        "enArea": "Hospital",
        "note": "固定驻守于【医院】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 0,
        "x": 54.9,
        "y": 69.45,
        "worldCoord": [
          1134.1,
          5335.3
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区",
        "enArea": "Old Town",
        "note": "在【老城区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.96,
        "y": 28.56,
        "worldCoord": [
          1134.7,
          4926.5
        ],
        "count": 2,
        "poiName": "市集废墟",
        "area": "新区",
        "enArea": "New District",
        "note": "在【新区】（市集废墟周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 47.28,
        "y": 53.37,
        "worldCoord": [
          1057.9,
          5174.5
        ],
        "count": 1,
        "poiName": "达芬奇大道",
        "area": "市中心大道",
        "enArea": "City Center",
        "note": "在【市中心大道】（达芬奇大道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.65,
        "y": 44.88,
        "worldCoord": [
          1071.6,
          5089.6
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园",
        "enArea": "Marano Park",
        "note": "在【马拉诺公园】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 66.4,
        "y": 59.15,
        "worldCoord": [
          1249.1,
          5232.3
        ],
        "count": 1,
        "poiName": "阿布斯托广场",
        "area": "阿布斯托广场",
        "enArea": "Piazza Arbusto",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【阿布斯托广场】沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [
      {
        "layer": 0,
        "x": 54.62,
        "y": 37.74,
        "worldCoord": [
          1131.3,
          5018.2
        ],
        "count": 1,
        "poiName": "停车场",
        "area": "停车场",
        "enArea": "Parking Garage",
        "note": "在【停车场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.43,
        "y": 44.51,
        "worldCoord": [
          1069.4,
          5085.9
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园",
        "enArea": "Marano Park",
        "note": "在【马拉诺公园】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 52.21,
        "y": 68.62,
        "worldCoord": [
          1107.2,
          5327
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区",
        "enArea": "Old Town",
        "note": "在【老城区】沿预设路径巡逻。"
      }
    ],
    "arc-leaper": [
      {
        "layer": 0,
        "x": 67.62,
        "y": 59.85,
        "worldCoord": [
          1261.3,
          5239.3
        ],
        "count": 1,
        "poiName": "阿布斯托广场",
        "area": "阿布斯托广场 · 东南侧",
        "enArea": "Piazza Arbusto",
        "note": "在【阿布斯托广场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 41.33,
        "y": 41.56,
        "worldCoord": [
          998.4,
          5056.4
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园 · 西北侧 #1",
        "enArea": "Marano Park",
        "note": "在【马拉诺公园】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.01,
        "y": 69.08,
        "worldCoord": [
          1095.2,
          5331.6
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区 · 西侧",
        "enArea": "Old Town",
        "note": "在【老城区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 34.82,
        "y": 60.76,
        "worldCoord": [
          933.3,
          5248.4
        ],
        "count": 1,
        "poiName": "西村",
        "area": "老城区 · 南侧",
        "enArea": "Old Town",
        "note": "在【老城区】（西村周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 67.03,
        "y": 59.8,
        "worldCoord": [
          1255.4,
          5238.8
        ],
        "count": 1,
        "poiName": "阿布斯托广场",
        "area": "阿布斯托广场 · #2",
        "enArea": "Piazza Arbusto",
        "note": "在【阿布斯托广场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 41.6,
        "y": 42.19,
        "worldCoord": [
          1001.1,
          5062.7
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园 · 西北侧 #2",
        "enArea": "Marano Park",
        "note": "在【马拉诺公园】沿预设路径巡逻。"
      }
    ],
    "arc-rocketeer": [
      {
        "layer": 0,
        "x": 45.79,
        "y": 45.13,
        "worldCoord": [
          1043,
          5092.1
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园",
        "enArea": "Marano Park",
        "note": "在【马拉诺公园】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 55.31,
        "y": 35.8,
        "worldCoord": [
          1138.2,
          4998.8
        ],
        "count": 1,
        "poiName": "停车场",
        "area": "停车场",
        "enArea": "Parking Garage",
        "note": "在【停车场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 66.02,
        "y": 59.72,
        "worldCoord": [
          1245.3,
          5238
        ],
        "count": 1,
        "poiName": "阿布斯托广场",
        "area": "阿布斯托广场",
        "enArea": "Piazza Arbusto",
        "note": "在【阿布斯托广场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 38.97,
        "y": 68.22,
        "worldCoord": [
          974.8,
          5323
        ],
        "count": 1,
        "poiName": "主街",
        "area": "主街西段",
        "enArea": "Main Street",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【主街西段】（主街周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.75,
        "y": 67.97,
        "worldCoord": [
          1102.6,
          5320.5
        ],
        "count": 1,
        "poiName": "圣玛丽亚住宅区",
        "area": "老城区",
        "enArea": "Old Town",
        "note": "在【老城区】（圣玛丽亚住宅区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 31.78,
        "y": 46.36,
        "worldCoord": [
          902.9,
          5104.4
        ],
        "count": 1,
        "poiName": "罗马广场",
        "area": "罗马广场",
        "enArea": "Piazza Roma",
        "note": "在【罗马广场】沿预设路径巡逻。"
      }
    ],
    "arc-vaporizer": [
      {
        "layer": 0,
        "x": 47.67,
        "y": 46.44,
        "worldCoord": [
          1061.8,
          5105.2
        ],
        "count": 1,
        "poiName": "马拉诺公园",
        "area": "马拉诺公园",
        "enArea": "Marano Park",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【马拉诺公园】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 55.09,
        "y": 20.71,
        "worldCoord": [
          1136,
          4847.9
        ],
        "count": 1,
        "poiName": "市集废墟",
        "area": "市集废墟",
        "enArea": "Market Ruins",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【市集废墟】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 69.54,
        "y": 51.65,
        "worldCoord": [
          1280.5,
          5157.3
        ],
        "count": 1,
        "poiName": "埋没的楼群",
        "area": "新区",
        "enArea": "New District",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【新区】（埋没的楼群周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 65.7,
        "y": 66.67,
        "worldCoord": [
          1242.1,
          5307.5
        ],
        "count": 1,
        "poiName": "阿布斯托药房",
        "area": "叛乱街区（阿布斯托南）",
        "enArea": "Mutiny Block",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【叛乱街区（阿布斯托南）】（阿布斯托药房周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 53.03,
        "y": 68.89,
        "worldCoord": [
          1115.4,
          5329.7
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区 · 西北侧",
        "enArea": "Old Town",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【老城区】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 34.16,
        "y": 66.25,
        "worldCoord": [
          926.7,
          5303.3
        ],
        "count": 1,
        "poiName": "奢华公寓",
        "area": "淹没太阳能板区",
        "enArea": "Flooded Solar Panels",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【淹没太阳能板区】（奢华公寓周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.38,
        "y": 61.53,
        "worldCoord": [
          1028.9,
          5256.1
        ],
        "count": 1,
        "poiName": "达芬奇大道",
        "area": "老城区 · 西侧",
        "enArea": "Old Town",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【老城区】（达芬奇大道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.79,
        "y": 36.88,
        "worldCoord": [
          1133,
          5009.6
        ],
        "count": 1,
        "poiName": "停车场",
        "area": "停车场",
        "enArea": "Parking Garage",
        "note": "在【停车场】沿预设路径巡逻。"
      }
    ]
  },
  "spaceport": {
    "arc-sentinel": [
      {
        "layer": 0,
        "x": 53,
        "y": 31.9,
        "worldCoord": [
          2136.9,
          2898.5
        ],
        "count": 1,
        "poiName": "南壕沟塔",
        "area": "南壕沟塔",
        "enArea": "South Trench Tower",
        "note": "固定架设于【南壕沟塔】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 55.43,
        "y": 63.22,
        "worldCoord": [
          2195.2,
          3650.1
        ],
        "count": 1,
        "poiName": "载具维护区",
        "area": "B号载具库（载具维护区南）",
        "enArea": "Vehicle Bay B",
        "note": "固定架设于【B号载具库（载具维护区南）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 42.18,
        "y": 45.61,
        "worldCoord": [
          1877.2,
          3227.5
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "发射台外围 · 东侧 #1",
        "enArea": "Launch Pad",
        "note": "固定架设于【发射台外围】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 59.1,
        "y": 48.37,
        "worldCoord": [
          2283.3,
          3293.7
        ],
        "count": 1,
        "poiName": "火箭组装区",
        "area": "太空港中央主场地 · 南侧",
        "enArea": "Spaceport Main Grounds",
        "note": "固定架设于【太空港中央主场地】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 55.82,
        "y": 56.81,
        "worldCoord": [
          2204.6,
          3496.3
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "设施支援区（控制塔/维护区）",
        "enArea": "Facility Support",
        "note": "固定架设于【设施支援区（控制塔/维护区）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 49.83,
        "y": 44.14,
        "worldCoord": [
          2060.8,
          3192.2
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围 · 东南侧",
        "enArea": "Launch Pad",
        "note": "固定架设于【发射台外围】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 46.23,
        "y": 41.12,
        "worldCoord": [
          1974.4,
          3119.7
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围 · 西北侧",
        "enArea": "Launch Pad",
        "note": "固定架设于【发射台外围】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 49.45,
        "y": 52.5,
        "worldCoord": [
          2051.7,
          3392.9
        ],
        "count": 1,
        "poiName": "控制塔A6",
        "area": "控制塔A6顶部外廊",
        "enArea": "Control Tower Top",
        "note": "固定架设于【控制塔A6顶部外廊】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 57.3,
        "y": 39.12,
        "worldCoord": [
          2240.1,
          3071.7
        ],
        "count": 1,
        "poiName": "燃料控制单元",
        "area": "太空港中央主场地 · 西北侧",
        "enArea": "Spaceport Main Grounds",
        "note": "固定架设于【太空港中央主场地】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 50.02,
        "y": 33.35,
        "worldCoord": [
          2065.3,
          2933.3
        ],
        "count": 1,
        "poiName": "南壕沟塔",
        "area": "太空港中央主场地 · 西南侧",
        "enArea": "Spaceport Main Grounds",
        "note": "固定架设于【太空港中央主场地】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 40.81,
        "y": 35.86,
        "worldCoord": [
          1844.3,
          2993.5
        ],
        "count": 1,
        "poiName": "到达楼",
        "area": "太空港中央主场地 · 东南侧",
        "enArea": "Spaceport Main Grounds",
        "note": "固定架设于【太空港中央主场地】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 36.41,
        "y": 42.03,
        "worldCoord": [
          1738.7,
          3141.6
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "破损围墙（候机楼西）",
        "enArea": "Broken Wall",
        "note": "固定架设于【破损围墙（候机楼西）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 42.43,
        "y": 44.99,
        "worldCoord": [
          1883.2,
          3212.6
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "发射台外围 · 东侧 #2",
        "enArea": "Launch Pad",
        "note": "固定架设于【发射台外围】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 0,
        "x": 50.18,
        "y": 57.83,
        "worldCoord": [
          2069.2,
          3520.8
        ],
        "count": 1,
        "poiName": "载具维护区",
        "area": "载具维护区",
        "enArea": "Vehicle Maintenance",
        "note": "固定驻守于【载具维护区】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 59.99,
        "y": 57.38,
        "worldCoord": [
          2304.6,
          3510
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "集装箱仓库",
        "enArea": "Container Storage",
        "note": "固定驻守于【集装箱仓库】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 53.58,
        "y": 52.77,
        "worldCoord": [
          2150.8,
          3399.3
        ],
        "count": 1,
        "poiName": "控制塔A6",
        "area": "飞控楼（控制塔A6东侧）",
        "enArea": "Flight Control",
        "note": "固定驻守于【飞控楼（控制塔A6东侧）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 39.06,
        "y": 45.48,
        "worldCoord": [
          1802.3,
          3224.4
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "候机楼（出发楼）",
        "enArea": "Departure Building",
        "note": "固定驻守于【候机楼（出发楼）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 39.82,
        "y": 34.96,
        "worldCoord": [
          1820.5,
          2971.9
        ],
        "count": 1,
        "poiName": "到达楼",
        "area": "到达楼",
        "enArea": "Arrival Building",
        "note": "固定驻守于【到达楼】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 45.06,
        "y": 31.4,
        "worldCoord": [
          1946.3,
          2886.5
        ],
        "count": 1,
        "poiName": "货运仓库",
        "area": "货运仓库",
        "enArea": "Shipping Warehouse",
        "note": "固定驻守于【货运仓库】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 52.64,
        "y": 31.71,
        "worldCoord": [
          2128.2,
          2893.9
        ],
        "count": 1,
        "poiName": "南壕沟塔",
        "area": "南壕沟塔",
        "enArea": "South Trench Tower",
        "note": "固定驻守于【南壕沟塔】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 47.38,
        "y": 48.35,
        "worldCoord": [
          2002,
          3293.3
        ],
        "count": 1,
        "poiName": "发射塔地下维护管网",
        "area": "地下维护管网通道 · 东南侧",
        "enArea": "Wilderness",
        "note": "固定驻守于【地下维护管网通道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 41.95,
        "y": 39.68,
        "worldCoord": [
          1871.7,
          3085.2
        ],
        "count": 1,
        "poiName": "发射塔地下维护管网",
        "area": "地下维护管网通道 · 北侧",
        "enArea": "Wilderness",
        "note": "固定驻守于【地下维护管网通道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 35.63,
        "y": 51.84,
        "worldCoord": [
          1720,
          3377
        ],
        "count": 1,
        "poiName": "外围隐藏地堡",
        "area": "野外补给站（地堡南侧）",
        "enArea": "Field Depot",
        "note": "固定驻守于【野外补给站（地堡南侧）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 34.58,
        "y": 50.68,
        "worldCoord": [
          1694.8,
          3349.2
        ],
        "count": 1,
        "poiName": "外围隐藏地堡",
        "area": "外围隐藏地堡内部 · 南侧",
        "enArea": "Bunker Interior",
        "note": "固定驻守于【外围隐藏地堡内部】室内走廊或大厅拐角（高威胁近战破片突袭点）。【隐藏地堡防线】靠近外围隐藏地堡即可触发遭遇。"
      },
      {
        "layer": 0,
        "x": 34.38,
        "y": 49.11,
        "worldCoord": [
          1690,
          3311.5
        ],
        "count": 1,
        "poiName": "外围隐藏地堡",
        "area": "外围隐藏地堡内部 · #2",
        "enArea": "Bunker Interior",
        "note": "固定驻守于【外围隐藏地堡内部】室内走廊或大厅拐角（高威胁近战破片突袭点）。【隐藏地堡防线】靠近外围隐藏地堡即可触发遭遇。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 0,
        "x": 35.07,
        "y": 49.88,
        "worldCoord": [
          1706.5,
          3330
        ],
        "count": 1,
        "poiName": "外围隐藏地堡",
        "area": "外围隐藏地堡广场",
        "enArea": "Hidden Bunker",
        "note": "在【外围隐藏地堡广场】（外围隐藏地堡周边）沿预设路径巡逻。【隐藏地堡防线】靠近外围隐藏地堡即可触发遭遇。"
      },
      {
        "layer": 0,
        "x": 52.4,
        "y": 55.18,
        "worldCoord": [
          2122.5,
          3457.2
        ],
        "count": 1,
        "poiName": "控制塔A6",
        "area": "设施支援区（控制塔/维护区） · 南侧 #1",
        "enArea": "Facility Support",
        "note": "在【设施支援区（控制塔/维护区）】（控制塔A6周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 57.17,
        "y": 32.85,
        "worldCoord": [
          2236.9,
          2921.3
        ],
        "count": 1,
        "poiName": "壕沟",
        "area": "北部壕沟",
        "enArea": "The Trench",
        "note": "在【北部壕沟】（壕沟周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.01,
        "y": 50.04,
        "worldCoord": [
          1921.1,
          3333.8
        ],
        "count": 1,
        "poiName": "燃料管道",
        "area": "燃料管道区 · 东北侧",
        "enArea": "Fuel Lines",
        "note": "在【燃料管道区】（燃料管道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.45,
        "y": 49.44,
        "worldCoord": [
          2267.7,
          3319.4
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "太空港中央主场地 · 北侧",
        "enArea": "Spaceport Main Grounds",
        "note": "在【太空港中央主场地】（集装箱仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 56.99,
        "y": 60.78,
        "worldCoord": [
          2232.6,
          3591.6
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "设施支援区（控制塔/维护区） · 南侧 #2",
        "enArea": "Facility Support",
        "note": "在【设施支援区（控制塔/维护区）】（集装箱仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 33.93,
        "y": 56.59,
        "worldCoord": [
          1679.2,
          3491
        ],
        "count": 1,
        "poiName": "燃料管道",
        "area": "燃料管道区 · 西南侧",
        "enArea": "Fuel Lines",
        "note": "在【燃料管道区】（燃料管道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.97,
        "y": 47.46,
        "worldCoord": [
          1920.2,
          3271.9
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "太空港中央主场地 · 东南侧",
        "enArea": "Spaceport Main Grounds",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【太空港中央主场地】（候机楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.97,
        "y": 39,
        "worldCoord": [
          1920.2,
          3068.9
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围",
        "enArea": "Launch Pad",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【发射台外围】（发射塔周边）沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [
      {
        "layer": 0,
        "x": 33.52,
        "y": 49.06,
        "worldCoord": [
          1669.3,
          3310.3
        ],
        "count": 1,
        "poiName": "外围隐藏地堡",
        "area": "外围隐藏地堡广场",
        "enArea": "Hidden Bunker",
        "note": "在【外围隐藏地堡广场】（外围隐藏地堡周边）沿预设路径巡逻。【隐藏地堡防线】靠近外围隐藏地堡即可触发遭遇。"
      },
      {
        "layer": 0,
        "x": 35.67,
        "y": 46,
        "worldCoord": [
          1721,
          3236.9
        ],
        "count": 1,
        "poiName": "外围隐藏地堡",
        "area": "太空港西区 · 北侧",
        "enArea": "The Spaceport",
        "note": "在【太空港西区】（外围隐藏地堡周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 64.88,
        "y": 41.03,
        "worldCoord": [
          2422,
          3117.6
        ],
        "count": 1,
        "poiName": "东侧集装箱堆场",
        "area": "东侧集装箱堆场",
        "enArea": "East Container Yard",
        "note": "在【东侧集装箱堆场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50,
        "y": 29.51,
        "worldCoord": [
          2064.9,
          2841.1
        ],
        "count": 1,
        "poiName": "西侧集装箱堆场",
        "area": "北部壕沟",
        "enArea": "The Trench",
        "note": "在【北部壕沟】（西侧集装箱堆场周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 52.09,
        "y": 54.97,
        "worldCoord": [
          2115,
          3452.1
        ],
        "count": 1,
        "poiName": "控制塔A6",
        "area": "设施支援区（控制塔/维护区） · 南侧",
        "enArea": "Facility Support",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【设施支援区（控制塔/维护区）】（控制塔A6周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 47.71,
        "y": 31.49,
        "worldCoord": [
          2009.9,
          2888.6
        ],
        "count": 1,
        "poiName": "货运仓库",
        "area": "发射台外围",
        "enArea": "Launch Pad",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【发射台外围】（货运仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 35.91,
        "y": 43.81,
        "worldCoord": [
          1726.7,
          3184.3
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "太空港西区 · 西侧",
        "enArea": "The Spaceport",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【太空港西区】（候机楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 55.18,
        "y": 50.97,
        "worldCoord": [
          2189.2,
          3356.1
        ],
        "count": 1,
        "poiName": "控制塔A6",
        "area": "设施支援区（控制塔/维护区） · 东北侧",
        "enArea": "Facility Support",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【设施支援区（控制塔/维护区）】（控制塔A6周边）沿预设路径巡逻。"
      }
    ],
    "arc-leaper": [
      {
        "layer": 0,
        "x": 55.54,
        "y": 44.84,
        "worldCoord": [
          2197.8,
          3209.1
        ],
        "count": 2,
        "poiName": "火箭组装区",
        "area": "太空港中央主场地",
        "enArea": "Spaceport Main Grounds",
        "note": "在【太空港中央主场地】（火箭组装区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.59,
        "y": 37.09,
        "worldCoord": [
          1935.2,
          3023.1
        ],
        "count": 2,
        "poiName": "到达楼",
        "area": "发射台外围",
        "enArea": "Launch Pad",
        "note": "在【发射台外围】（到达楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.17,
        "y": 56.25,
        "worldCoord": [
          2164.9,
          3482.9
        ],
        "count": 1,
        "poiName": "载具维护区",
        "area": "设施支援区（控制塔/维护区）",
        "enArea": "Facility Support",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【设施支援区（控制塔/维护区）】（载具维护区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 52.18,
        "y": 37.65,
        "worldCoord": [
          2117.2,
          3036.5
        ],
        "count": 1,
        "poiName": "太空港",
        "area": "北部壕沟",
        "enArea": "The Trench",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【北部壕沟】（太空港周边）沿预设路径巡逻。"
      }
    ],
    "arc-rocketeer": [
      {
        "layer": 0,
        "x": 55.35,
        "y": 55.31,
        "worldCoord": [
          2193.3,
          3460.3
        ],
        "count": 2,
        "poiName": "集装箱仓库",
        "area": "设施支援区（控制塔/维护区）",
        "enArea": "Facility Support",
        "spawnCondition": "base+hurricane",
        "note": "【常规 + 飓风叠加刷新】普通战局固定存在 1 处刷新槽位，进入【飓风】地图事件后将在同坐标额外追加刷新。 在【设施支援区（控制塔/维护区）】（集装箱仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.07,
        "y": 42.27,
        "worldCoord": [
          2018.5,
          3147.3
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "中央发射塔 · #1",
        "enArea": "Launch Towers",
        "note": "在【中央发射塔】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.64,
        "y": 41.82,
        "worldCoord": [
          2032.2,
          3136.5
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "中央发射塔 · #2",
        "enArea": "Launch Towers",
        "note": "在【中央发射塔】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.38,
        "y": 46.26,
        "worldCoord": [
          2266,
          3243.1
        ],
        "count": 2,
        "poiName": "火箭组装区",
        "area": "太空港中央主场地 · 西南侧",
        "enArea": "Spaceport Main Grounds",
        "spawnCondition": "base+hurricane",
        "note": "【常规 + 飓风叠加刷新】普通战局固定存在 1 处刷新槽位，进入【飓风】地图事件后将在同坐标额外追加刷新。 在【太空港中央主场地】（火箭组装区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 45.25,
        "y": 37.52,
        "worldCoord": [
          1950.9,
          3033.3
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围 · 西北侧",
        "enArea": "Launch Pad",
        "note": "在【发射台外围】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 46.03,
        "y": 53.37,
        "worldCoord": [
          1969.6,
          3413.7
        ],
        "count": 1,
        "poiName": "控制塔A6",
        "area": "控制塔西侧集装箱区",
        "enArea": "Container Yard",
        "note": "在【控制塔西侧集装箱区】（控制塔A6周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.85,
        "y": 65.07,
        "worldCoord": [
          2109.3,
          3694.5
        ],
        "count": 1,
        "poiName": "教堂区",
        "area": "南侧外围围墙（教堂/机库北）",
        "enArea": "Perimeter Wall",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【南侧外围围墙（教堂/机库北）】（教堂区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 56.97,
        "y": 33.82,
        "worldCoord": [
          2232.2,
          2944.5
        ],
        "count": 1,
        "poiName": "壕沟",
        "area": "北部壕沟 · 东侧",
        "enArea": "The Trench",
        "note": "在【北部壕沟】（壕沟周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 61.82,
        "y": 50.81,
        "worldCoord": [
          2348.6,
          3352.3
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "东部平原（集装箱仓库东）",
        "enArea": "East Plains",
        "note": "在【东部平原（集装箱仓库东）】（集装箱仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.25,
        "y": 51.38,
        "worldCoord": [
          1926.9,
          3366
        ],
        "count": 1,
        "poiName": "燃料管道",
        "area": "运输停车场（燃料管道东）",
        "enArea": "Transport Parking",
        "note": "在【运输停车场（燃料管道东）】（燃料管道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 34.19,
        "y": 41.54,
        "worldCoord": [
          1685.4,
          3129.8
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "太空港西区",
        "enArea": "The Spaceport",
        "note": "在【太空港西区】（候机楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.4,
        "y": 28.73,
        "worldCoord": [
          2098.5,
          2822.4
        ],
        "count": 1,
        "poiName": "北壕沟塔",
        "area": "北部壕沟 · 西侧",
        "enArea": "The Trench",
        "note": "在【北部壕沟】（北壕沟塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 62.72,
        "y": 39.4,
        "worldCoord": [
          2370.2,
          3078.5
        ],
        "count": 1,
        "poiName": "东侧集装箱堆场",
        "area": "北部壕沟 · 西北侧",
        "enArea": "The Trench",
        "note": "在【北部壕沟】（东侧集装箱堆场周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.95,
        "y": 40.21,
        "worldCoord": [
          2039.7,
          3097.9
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围 · 北侧",
        "enArea": "Launch Pad",
        "note": "在【发射台外围】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 46.74,
        "y": 43.97,
        "worldCoord": [
          1986.6,
          3188.1
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围 · 西南侧 #1",
        "enArea": "Launch Pad",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【发射台外围】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 38.99,
        "y": 41.6,
        "worldCoord": [
          1800.6,
          3131.3
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "太空港中央主场地 · 北侧",
        "enArea": "Spaceport Main Grounds",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【太空港中央主场地】（候机楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.96,
        "y": 42.11,
        "worldCoord": [
          2183.9,
          3143.5
        ],
        "count": 1,
        "poiName": "燃料控制单元",
        "area": "发射台外围 · 西南侧 #2",
        "enArea": "Launch Pad",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【发射台外围】（燃料控制单元周边）沿预设路径巡逻。"
      }
    ],
    "arc-vaporizer": [
      {
        "layer": 0,
        "x": 51.85,
        "y": 65.07,
        "worldCoord": [
          2109.3,
          3694.5
        ],
        "count": 1,
        "poiName": "教堂区",
        "area": "南侧外围围墙（教堂/机库北）",
        "enArea": "Perimeter Wall",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【南侧外围围墙（教堂/机库北）】（教堂区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 36.13,
        "y": 31.83,
        "worldCoord": [
          1732,
          2896.8
        ],
        "count": 1,
        "poiName": "停车场",
        "area": "太空港西区",
        "enArea": "The Spaceport",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【太空港西区】（停车场周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 45.81,
        "y": 34.72,
        "worldCoord": [
          1964.3,
          2966.1
        ],
        "count": 1,
        "poiName": "货运仓库",
        "area": "发射台外围 · 南侧 #1",
        "enArea": "Launch Pad",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【发射台外围】（货运仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.9,
        "y": 54.8,
        "worldCoord": [
          2182.5,
          3448.1
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "设施支援区（控制塔/维护区）",
        "enArea": "Facility Support",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【设施支援区（控制塔/维护区）】（集装箱仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.55,
        "y": 44.45,
        "worldCoord": [
          2102.1,
          3199.7
        ],
        "count": 1,
        "poiName": "太空港",
        "area": "发射台外围 · 南侧 #2",
        "enArea": "Launch Pad",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【发射台外围】（太空港周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.84,
        "y": 49.3,
        "worldCoord": [
          1917,
          3316.1
        ],
        "count": 1,
        "poiName": "燃料管道",
        "area": "燃料管道区",
        "enArea": "Fuel Lines",
        "note": "在【燃料管道区】（燃料管道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 52.44,
        "y": 33.29,
        "worldCoord": [
          2123.4,
          2931.8
        ],
        "count": 1,
        "poiName": "南壕沟塔",
        "area": "北部壕沟",
        "enArea": "The Trench",
        "note": "在【北部壕沟】（南壕沟塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 44.27,
        "y": 34.35,
        "worldCoord": [
          1927.3,
          2957.3
        ],
        "count": 1,
        "poiName": "到达楼",
        "area": "太空港中央主场地 · 东侧",
        "enArea": "Spaceport Main Grounds",
        "note": "在【太空港中央主场地】（到达楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 57.47,
        "y": 50.38,
        "worldCoord": [
          2244.2,
          3342
        ],
        "count": 1,
        "poiName": "集装箱仓库",
        "area": "太空港中央主场地 · 北侧 #1",
        "enArea": "Spaceport Main Grounds",
        "note": "在【太空港中央主场地】（集装箱仓库周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 55.34,
        "y": 42.45,
        "worldCoord": [
          2193,
          3151.7
        ],
        "count": 1,
        "poiName": "燃料控制单元",
        "area": "发射台外围 · 西南侧 #1",
        "enArea": "Launch Pad",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【发射台外围】（燃料控制单元周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 39.68,
        "y": 40.51,
        "worldCoord": [
          1817.2,
          3105.1
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "太空港中央主场地 · 北侧 #2",
        "enArea": "Spaceport Main Grounds",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【太空港中央主场地】（候机楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.25,
        "y": 42.36,
        "worldCoord": [
          2022.9,
          3149.5
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "中央发射塔",
        "enArea": "Launch Towers",
        "note": "在【中央发射塔】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 46.74,
        "y": 43.97,
        "worldCoord": [
          1986.6,
          3188.1
        ],
        "count": 1,
        "poiName": "发射塔",
        "area": "发射台外围 · 西南侧 #2",
        "enArea": "Launch Pad",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新（常作为【火箭手】的伴随护卫出没）。 在【发射台外围】（发射塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.31,
        "y": 44.68,
        "worldCoord": [
          1904.3,
          3205.2
        ],
        "count": 1,
        "poiName": "候机楼",
        "area": "发射台外围 · 东侧",
        "enArea": "Launch Pad",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【发射台外围】（候机楼周边）沿预设路径巡逻。"
      }
    ]
  },
  "blue-gate": {
    "arc-sentinel": [
      {
        "layer": 1,
        "x": 56.17,
        "y": 40.93,
        "worldCoord": [
          120.6,
          -177.3
        ],
        "count": 1,
        "poiName": "通行隧道",
        "area": "地下通行隧道",
        "enArea": "Traffic Tunnel",
        "note": "固定架设于【地下通行隧道】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 51.83,
        "y": 47.7,
        "worldCoord": [
          35.8,
          -45
        ],
        "count": 1,
        "poiName": "外部大门",
        "area": "外部大门",
        "enArea": "Outer Gates",
        "note": "固定架设于【外部大门】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 38.02,
        "y": 35.16,
        "worldCoord": [
          -234.2,
          -290.1
        ],
        "count": 1,
        "poiName": "村庄",
        "area": "村庄",
        "enArea": "Village",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 固定架设于【村庄】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 71.27,
        "y": 34.27,
        "worldCoord": [
          415.8,
          -307.5
        ],
        "count": 1,
        "poiName": "朝圣峰",
        "area": "朝圣峰",
        "enArea": "Pilgrim's Peak",
        "note": "固定架设于【朝圣峰】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 62.51,
        "y": 40.3,
        "worldCoord": [
          244.6,
          -189.6
        ],
        "count": 1,
        "poiName": "山区",
        "area": "蓝门引道与坡道 · 南侧",
        "enArea": "Gate Approach",
        "note": "固定架设于【蓝门引道与坡道】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 58.88,
        "y": 46.92,
        "worldCoord": [
          173.6,
          -60.2
        ],
        "count": 1,
        "poiName": "仓储综合区",
        "area": "装卸码头（仓储综合区）",
        "enArea": "Loading Dock",
        "note": "固定架设于【装卸码头（仓储综合区）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 55.45,
        "y": 52.39,
        "worldCoord": [
          106.5,
          46.7
        ],
        "count": 1,
        "poiName": "山脊白色瞭望塔",
        "area": "山脊白色瞭望塔（通风竖井）",
        "enArea": "Ventilation Shaft",
        "note": "固定架设于【山脊白色瞭望塔（通风竖井）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 46.12,
        "y": 40.52,
        "worldCoord": [
          -75.8,
          -185.3
        ],
        "count": 1,
        "poiName": "加固前台",
        "area": "蓝门引道与坡道 · 西侧",
        "enArea": "Gate Approach",
        "note": "固定架设于【蓝门引道与坡道】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 51.71,
        "y": 58.88,
        "worldCoord": [
          33.4,
          173.6
        ],
        "count": 1,
        "poiName": "维护区地堡",
        "area": "农田",
        "enArea": "Farmlands",
        "note": "固定架设于【农田】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 41.01,
        "y": 49.33,
        "worldCoord": [
          -175.8,
          -13.1
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "德西马雷废墟（蓝门入口西）",
        "enArea": "Decimare",
        "note": "固定架设于【德西马雷废墟（蓝门入口西）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 45.69,
        "y": 54.8,
        "worldCoord": [
          -84.3,
          93.8
        ],
        "count": 1,
        "poiName": "检查站",
        "area": "中央检查站",
        "enArea": "Checkpoint",
        "note": "固定架设于【中央检查站】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 31.26,
        "y": 51.91,
        "worldCoord": [
          -366.4,
          37.3
        ],
        "count": 1,
        "poiName": "庄严残骸",
        "area": "庄严残骸",
        "enArea": "Adorned Wreckage",
        "note": "固定架设于【庄严残骸】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 1,
        "x": 54.82,
        "y": 43.37,
        "worldCoord": [
          94.2,
          -129.6
        ],
        "count": 1,
        "poiName": "通行隧道",
        "area": "地下通行隧道 · 南侧",
        "enArea": "Traffic Tunnel",
        "note": "固定驻守于【地下通行隧道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 60.3,
        "y": 43.66,
        "worldCoord": [
          201.4,
          -124
        ],
        "count": 1,
        "poiName": "维护区辅楼",
        "area": "维护区辅楼（地下） · 北侧",
        "enArea": "Maintenance Wing",
        "note": "固定驻守于【维护区辅楼（地下）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 60.48,
        "y": 50.52,
        "worldCoord": [
          204.9,
          10.2
        ],
        "count": 1,
        "poiName": "维护区辅楼",
        "area": "维护区辅楼（地下） · 南侧",
        "enArea": "Maintenance Wing",
        "note": "固定驻守于【维护区辅楼（地下）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 54.95,
        "y": 46.9,
        "worldCoord": [
          96.8,
          -60.6
        ],
        "count": 1,
        "poiName": "维护区辅楼",
        "area": "维护区辅楼（地下） · 西侧",
        "enArea": "Maintenance Wing",
        "note": "固定驻守于【维护区辅楼（地下）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 51.22,
        "y": 41.03,
        "worldCoord": [
          23.9,
          -175.4
        ],
        "count": 1,
        "poiName": "地下没收物库房",
        "area": "安保区辅楼（没收物库房外） · #1",
        "enArea": "Security Wing",
        "note": "固定驻守于【安保区辅楼（没收物库房外）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 50.32,
        "y": 41.7,
        "worldCoord": [
          6.3,
          -162.3
        ],
        "count": 1,
        "poiName": "地下没收物库房",
        "area": "安保区辅楼（没收物库房外） · #2",
        "enArea": "Security Wing",
        "note": "固定驻守于【安保区辅楼（没收物库房外）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 56.29,
        "y": 40.22,
        "worldCoord": [
          123,
          -191.2
        ],
        "count": 1,
        "poiName": "通行隧道",
        "area": "地下通行隧道 · #2",
        "enArea": "Traffic Tunnel",
        "note": "固定驻守于【地下通行隧道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 57.56,
        "y": 35.71,
        "worldCoord": [
          147.8,
          -279.4
        ],
        "count": 1,
        "poiName": "通行隧道",
        "area": "地下通行隧道 · 北侧",
        "enArea": "Traffic Tunnel",
        "note": "固定驻守于【地下通行隧道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 1,
        "x": 55.68,
        "y": 43.4,
        "worldCoord": [
          111,
          -129
        ],
        "count": 1,
        "poiName": "通行隧道",
        "area": "地下通行隧道",
        "enArea": "Traffic Tunnel",
        "note": "在【地下通行隧道】（通行隧道周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.73,
        "y": 49,
        "worldCoord": [
          14.2,
          -19.4
        ],
        "count": 2,
        "poiName": "外部大门",
        "area": "中央检查站 · 南侧",
        "enArea": "Checkpoint",
        "note": "在【中央检查站】（外部大门周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.83,
        "y": 48.18,
        "worldCoord": [
          -22.9,
          -35.6
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "中央检查站 · 东北侧",
        "enArea": "Checkpoint",
        "note": "在【中央检查站】（蓝门入口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 42.46,
        "y": 44.53,
        "worldCoord": [
          -147.4,
          -106.9
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "山地与山脊走廊",
        "enArea": "The Mountains",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【山地与山脊走廊】（蓝门入口周边）沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [
      {
        "layer": 0,
        "x": 34.83,
        "y": 41.68,
        "worldCoord": [
          -296.6,
          -162.7
        ],
        "count": 1,
        "poiName": "奇袭者避难所",
        "area": "奇袭者避难所",
        "enArea": "Raider's Refuge",
        "note": "在【奇袭者避难所】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 59.94,
        "y": 50.27,
        "worldCoord": [
          194.3,
          5.2
        ],
        "count": 2,
        "poiName": "仓储综合区",
        "area": "蓝门引道与坡道",
        "enArea": "Gate Approach",
        "note": "在【蓝门引道与坡道】（仓储综合区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.89,
        "y": 48.5,
        "worldCoord": [
          17.4,
          -29.3
        ],
        "count": 1,
        "poiName": "外部大门",
        "area": "中央检查站 · 南侧 #1",
        "enArea": "Checkpoint",
        "note": "在【中央检查站】（外部大门周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.07,
        "y": 66.25,
        "worldCoord": [
          20.9,
          317.7
        ],
        "count": 1,
        "poiName": "农田",
        "area": "废弃农庄北田",
        "enArea": "Ruined Homestead",
        "note": "在【废弃农庄北田】（农田周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.56,
        "y": 49.2,
        "worldCoord": [
          10.9,
          -15.6
        ],
        "count": 1,
        "poiName": "外部大门",
        "area": "中央检查站 · 南侧 #2",
        "enArea": "Checkpoint",
        "note": "在【中央检查站】（外部大门周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 64.71,
        "y": 40.9,
        "worldCoord": [
          287.6,
          -177.9
        ],
        "count": 1,
        "poiName": "山区",
        "area": "山地与山脊走廊 · 东南侧",
        "enArea": "The Mountains",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【山地与山脊走廊】（山区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.46,
        "y": 57.98,
        "worldCoord": [
          165.4,
          156
        ],
        "count": 1,
        "poiName": "破碎地貌",
        "area": "山地与山脊走廊 · 东北侧",
        "enArea": "The Mountains",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【山地与山脊走廊】（破碎地貌周边）沿预设路径巡逻。"
      }
    ],
    "arc-leaper": [
      {
        "layer": 0,
        "x": 26.67,
        "y": 42.84,
        "worldCoord": [
          -456,
          -140
        ],
        "count": 2,
        "poiName": "荒芜空地",
        "area": "荒芜空地南侧",
        "enArea": "Barren Clearing",
        "note": "在【荒芜空地南侧】（荒芜空地周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 53.31,
        "y": 67.25,
        "worldCoord": [
          64.8,
          337.2
        ],
        "count": 2,
        "poiName": "古代要塞",
        "area": "农田",
        "enArea": "Farmlands",
        "note": "在【农田】（古代要塞周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.73,
        "y": 43.66,
        "worldCoord": [
          92.5,
          -123.9
        ],
        "count": 2,
        "poiName": "候车室",
        "area": "蓝门引道与坡道 · 西南侧",
        "enArea": "Gate Approach",
        "note": "在【蓝门引道与坡道】（候车室周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 42.83,
        "y": 44.71,
        "worldCoord": [
          -140.2,
          -103.4
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "山地与山脊走廊",
        "enArea": "The Mountains",
        "note": "在【山地与山脊走廊】（蓝门入口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 31.68,
        "y": 57.56,
        "worldCoord": [
          -358.2,
          147.8
        ],
        "count": 1,
        "poiName": "比尔根的藏身处",
        "area": "森林",
        "enArea": "The Forest",
        "note": "在【森林】（比尔根的藏身处周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.94,
        "y": 51.66,
        "worldCoord": [
          174.8,
          32.5
        ],
        "count": 1,
        "poiName": "山脊白色瞭望塔",
        "area": "蓝门引道与坡道 · 东侧",
        "enArea": "Gate Approach",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【蓝门引道与坡道】（山脊白色瞭望塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.06,
        "y": 49.34,
        "worldCoord": [
          -37.9,
          -12.9
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "中央检查站",
        "enArea": "Checkpoint",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【中央检查站】（蓝门入口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.01,
        "y": 41.77,
        "worldCoord": [
          0.2,
          -160.9
        ],
        "count": 1,
        "poiName": "加固前台",
        "area": "蓝门引道与坡道 · 南侧",
        "enArea": "Gate Approach",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【蓝门引道与坡道】（加固前台周边）沿预设路径巡逻。"
      },
      {
        "layer": 1,
        "x": 55.64,
        "y": 41.38,
        "worldCoord": [
          110.3,
          -168.5
        ],
        "count": 1,
        "poiName": "通行隧道",
        "area": "地下通行隧道",
        "enArea": "Traffic Tunnel",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【地下通行隧道】（通行隧道周边）沿预设路径巡逻。"
      }
    ],
    "arc-rocketeer": [
      {
        "layer": 0,
        "x": 64.45,
        "y": 44.91,
        "worldCoord": [
          282.5,
          -99.5
        ],
        "count": 1,
        "poiName": "仓储综合区",
        "area": "山地与山脊走廊 · 东侧 #1",
        "enArea": "The Mountains",
        "note": "在【山地与山脊走廊】（仓储综合区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.77,
        "y": 57.36,
        "worldCoord": [
          171.4,
          143.9
        ],
        "count": 1,
        "poiName": "维护区地堡",
        "area": "山地与山脊走廊 · 东侧 #2",
        "enArea": "The Mountains",
        "note": "在【山地与山脊走廊】（维护区地堡周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 37.95,
        "y": 34.36,
        "worldCoord": [
          -235.6,
          -305.8
        ],
        "count": 1,
        "poiName": "村庄",
        "area": "村庄",
        "enArea": "Village",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【村庄】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 33.19,
        "y": 42.13,
        "worldCoord": [
          -328.6,
          -153.9
        ],
        "count": 1,
        "poiName": "森林",
        "area": "森林",
        "enArea": "The Forest",
        "note": "在【森林】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 49.69,
        "y": 54.29,
        "worldCoord": [
          -6.1,
          83.9
        ],
        "count": 1,
        "poiName": "检查站",
        "area": "中央检查站 · 东南侧",
        "enArea": "Checkpoint",
        "note": "在【中央检查站】（检查站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 59.03,
        "y": 44.68,
        "worldCoord": [
          176.5,
          -104
        ],
        "count": 1,
        "poiName": "仓储综合区",
        "area": "装卸码头（仓储综合区）",
        "enArea": "Loading Dock",
        "note": "在【装卸码头（仓储综合区）】（仓储综合区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 41.28,
        "y": 46.9,
        "worldCoord": [
          -170.5,
          -60.6
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "山地与山脊走廊 · 西北侧",
        "enArea": "The Mountains",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【山地与山脊走廊】（蓝门入口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 68.63,
        "y": 34.9,
        "worldCoord": [
          364.2,
          -295.2
        ],
        "count": 1,
        "poiName": "朝圣峰",
        "area": "朝圣峰岗哨站房",
        "enArea": "Station Office",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【朝圣峰岗哨站房】（朝圣峰周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.28,
        "y": 52.61,
        "worldCoord": [
          5.5,
          51
        ],
        "count": 1,
        "poiName": "检查站",
        "area": "中央检查站 · 东侧",
        "enArea": "Checkpoint",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【中央检查站】（检查站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 53.59,
        "y": 62.71,
        "worldCoord": [
          70.2,
          248.5
        ],
        "count": 1,
        "poiName": "破碎地貌",
        "area": "破碎地貌 · 西侧",
        "enArea": "Broken Earth",
        "note": "在【破碎地貌】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 31.91,
        "y": 48.67,
        "worldCoord": [
          -353.7,
          -26
        ],
        "count": 1,
        "poiName": "庄严残骸",
        "area": "庄严残骸",
        "enArea": "Adorned Wreckage",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【庄严残骸】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.89,
        "y": 60.97,
        "worldCoord": [
          17.4,
          214.5
        ],
        "count": 1,
        "poiName": "农田",
        "area": "破碎地貌 · 北侧",
        "enArea": "Broken Earth",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【破碎地貌】（农田周边）沿预设路径巡逻。"
      }
    ],
    "arc-vaporizer": [
      {
        "layer": 0,
        "x": 41.28,
        "y": 46.9,
        "worldCoord": [
          -170.5,
          -60.6
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "山地与山脊走廊 · 西北侧 #1",
        "enArea": "The Mountains",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【山地与山脊走廊】（蓝门入口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 49.65,
        "y": 51.84,
        "worldCoord": [
          -6.8,
          36
        ],
        "count": 1,
        "poiName": "检查站",
        "area": "中央检查站 · 东侧 #1",
        "enArea": "Checkpoint",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【中央检查站】（检查站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 42.8,
        "y": 44.6,
        "worldCoord": [
          -140.8,
          -105.6
        ],
        "count": 1,
        "poiName": "蓝门入口",
        "area": "山地与山脊走廊 · 西北侧 #2",
        "enArea": "The Mountains",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【山地与山脊走廊】（蓝门入口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 40.26,
        "y": 56.73,
        "worldCoord": [
          -190.4,
          131.6
        ],
        "count": 1,
        "poiName": "高速公路崩塌区",
        "area": "中央检查站 · 东北侧",
        "enArea": "Checkpoint",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【中央检查站】（高速公路崩塌区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.37,
        "y": 61.67,
        "worldCoord": [
          163.6,
          228.2
        ],
        "count": 1,
        "poiName": "破碎地貌",
        "area": "破碎地貌 · 东侧",
        "enArea": "Broken Earth",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【破碎地貌】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.47,
        "y": 42.86,
        "worldCoord": [
          204.7,
          -139.6
        ],
        "count": 1,
        "poiName": "仓储综合区",
        "area": "蓝门引道与坡道",
        "enArea": "Gate Approach",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【蓝门引道与坡道】（仓储综合区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 63.75,
        "y": 53.51,
        "worldCoord": [
          268.8,
          68.6
        ],
        "count": 1,
        "poiName": "山脊线",
        "area": "山地与山脊走廊 · 西侧",
        "enArea": "The Mountains",
        "spawnCondition": "close-scrutiny",
        "note": "【特殊地图事件：严密监视 (Close Scrutiny)】专属刷新：作为高价值目标“勘测师 (Surveyor)”的贴身重装护卫伴随巡逻（普通战局不刷新）。 在【山地与山脊走廊】（山脊线周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.28,
        "y": 52.61,
        "worldCoord": [
          5.5,
          51
        ],
        "count": 1,
        "poiName": "检查站",
        "area": "中央检查站 · 东侧 #2",
        "enArea": "Checkpoint",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新（常作为【火箭手】的伴随护卫出没）。 在【中央检查站】（检查站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 33.79,
        "y": 42.57,
        "worldCoord": [
          -316.9,
          -145.3
        ],
        "count": 1,
        "poiName": "奇袭者避难所",
        "area": "森林",
        "enArea": "The Forest",
        "note": "在【森林】（奇袭者避难所周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 58.84,
        "y": 45.12,
        "worldCoord": [
          172.8,
          -95.4
        ],
        "count": 1,
        "poiName": "仓储综合区",
        "area": "装卸码头（仓储综合区）",
        "enArea": "Loading Dock",
        "note": "在【装卸码头（仓储综合区）】（仓储综合区周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 49.33,
        "y": 54.18,
        "worldCoord": [
          -13.1,
          81.7
        ],
        "count": 1,
        "poiName": "检查站",
        "area": "中央检查站 · 东南侧",
        "enArea": "Checkpoint",
        "note": "在【中央检查站】（检查站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 67.97,
        "y": 35.69,
        "worldCoord": [
          351.3,
          -279.8
        ],
        "count": 1,
        "poiName": "朝圣峰",
        "area": "朝圣峰",
        "enArea": "Pilgrim's Peak",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【朝圣峰】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 37.51,
        "y": 34.68,
        "worldCoord": [
          -244.2,
          -299.5
        ],
        "count": 1,
        "poiName": "村庄",
        "area": "村庄",
        "enArea": "Village",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【村庄】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.4,
        "y": 60.86,
        "worldCoord": [
          27.4,
          212.3
        ],
        "count": 1,
        "poiName": "维护区地堡",
        "area": "破碎地貌 · 西南侧",
        "enArea": "Broken Earth",
        "spawnCondition": "hurricane",
        "note": "【地图事件限定：飓风】仅在【飓风】地图条件下额外激活刷新。 在【破碎地貌】（维护区地堡周边）沿预设路径巡逻。"
      }
    ]
  },
  "stella-montis": {
    "arc-sentinel": [
      {
        "layer": 1,
        "x": 58.43,
        "y": 55.75,
        "worldCoord": [
          -13.6,
          -5.5
        ],
        "count": 1,
        "poiName": "中庭",
        "area": "中庭（上层）",
        "enArea": "Atrium",
        "note": "固定架设于【中庭（上层）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 0,
        "x": 63.7,
        "y": 37.16,
        "worldCoord": [
          9.2,
          -85.6
        ],
        "count": 1,
        "poiName": "大厅地铁",
        "area": "大厅地铁站台（下层）",
        "enArea": "Metro Platform",
        "note": "固定驻守于【大厅地铁站台（下层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 20.57,
        "y": 59.44,
        "worldCoord": [
          -176.7,
          10.5
        ],
        "count": 1,
        "poiName": "医学研究部",
        "area": "联络廊道 · 东南侧",
        "enArea": "Walkway",
        "note": "固定驻守于【联络廊道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 19.15,
        "y": 62.94,
        "worldCoord": [
          -182.8,
          25.5
        ],
        "count": 1,
        "poiName": "医学研究部",
        "area": "医学研究部（上层）",
        "enArea": "Medical Research",
        "note": "固定驻守于【医学研究部（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 56.17,
        "y": 59.49,
        "worldCoord": [
          -23.3,
          10.7
        ],
        "count": 1,
        "poiName": "自助餐厅",
        "area": "自助餐厅（上层）",
        "enArea": "Cafeteria",
        "note": "固定驻守于【自助餐厅（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 50.59,
        "y": 47.51,
        "worldCoord": [
          -47.3,
          -41
        ],
        "count": 1,
        "poiName": "机器人沙盘A",
        "area": "机器人沙盘A（下层）",
        "enArea": "Robotic Sandbox A",
        "note": "固定驻守于【机器人沙盘A（下层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 52.55,
        "y": 41.76,
        "worldCoord": [
          -38.9,
          -65.7
        ],
        "count": 1,
        "poiName": "机器人沙盘A",
        "area": "联络廊道",
        "enArea": "Walkway",
        "note": "固定驻守于【联络廊道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 74.63,
        "y": 62.44,
        "worldCoord": [
          56.3,
          23.4
        ],
        "count": 1,
        "poiName": "下行攀爬井 · 东地道南",
        "area": "文化档案馆（上层） · 西北侧",
        "enArea": "Cultural Archives",
        "note": "固定驻守于【文化档案馆（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 83.87,
        "y": 52.55,
        "worldCoord": [
          96.1,
          -19.2
        ],
        "count": 1,
        "poiName": "商务中心等候室",
        "area": "文化档案馆（上层） · 东南侧",
        "enArea": "Cultural Archives",
        "note": "固定驻守于【文化档案馆（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 74.79,
        "y": 47.73,
        "worldCoord": [
          57,
          -40
        ],
        "count": 1,
        "poiName": "礼堂",
        "area": "礼堂（上层）",
        "enArea": "Auditorium",
        "note": "固定驻守于【礼堂（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 62.44,
        "y": 37.44,
        "worldCoord": [
          3.7,
          -84.4
        ],
        "count": 1,
        "poiName": "大厅",
        "area": "大厅室内区（上层） · 东北侧",
        "enArea": "Lobby Interior",
        "note": "固定驻守于【大厅室内区（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 65.86,
        "y": 69.81,
        "worldCoord": [
          18.5,
          55.1
        ],
        "count": 1,
        "poiName": "种子库",
        "area": "下层通风竖井室（种子库北）",
        "enArea": "Air Shaft Room",
        "note": "固定驻守于【下层通风竖井室（种子库北）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 26.64,
        "y": 44.86,
        "worldCoord": [
          -150.6,
          -52.4
        ],
        "count": 1,
        "poiName": "货运码头A",
        "area": "组装厂货运区（上层）",
        "enArea": "Assembly Cargo Bay",
        "note": "固定驻守于【组装厂货运区（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 50.23,
        "y": 64.63,
        "worldCoord": [
          -48.9,
          32.8
        ],
        "count": 1,
        "poiName": "机器人沙盘B",
        "area": "机器人沙盘B（下层）",
        "enArea": "Robotic Sandbox B",
        "note": "固定驻守于【机器人沙盘B（下层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 90.66,
        "y": 44.25,
        "worldCoord": [
          125.4,
          -55
        ],
        "count": 1,
        "poiName": "储存室",
        "area": "文化档案馆（上层） · 西侧",
        "enArea": "Cultural Archives",
        "note": "固定驻守于【文化档案馆（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 60.2,
        "y": 37.57,
        "worldCoord": [
          -5.9,
          -83.8
        ],
        "count": 1,
        "poiName": "大厅",
        "area": "大厅室内区（上层） · 西北侧",
        "enArea": "Lobby Interior",
        "note": "固定驻守于【大厅室内区（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 16.66,
        "y": 47.36,
        "worldCoord": [
          -193.6,
          -41.6
        ],
        "count": 1,
        "poiName": "医学研究部",
        "area": "联络廊道 · 北侧",
        "enArea": "Walkway",
        "note": "固定驻守于【联络廊道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 37.02,
        "y": 71.99,
        "worldCoord": [
          -105.8,
          64.5
        ],
        "count": 1,
        "poiName": "装卸区",
        "area": "下层装卸区南部通道",
        "enArea": "Stella Montis",
        "note": "固定驻守于【下层装卸区南部通道】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 58.69,
        "y": 56.14,
        "worldCoord": [
          -12.4,
          -3.8
        ],
        "count": 1,
        "poiName": "中庭",
        "area": "中庭（上层） · 北侧",
        "enArea": "Atrium",
        "note": "固定驻守于【中庭（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 54.19,
        "y": 62.95,
        "worldCoord": [
          -31.8,
          25.6
        ],
        "count": 1,
        "poiName": "中庭",
        "area": "中庭南侧走廊（上层）",
        "enArea": "Corridor",
        "note": "固定驻守于【中庭南侧走廊（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 1,
        "x": 64.45,
        "y": 58.8,
        "worldCoord": [
          12.4,
          7.7
        ],
        "count": 1,
        "poiName": "中庭",
        "area": "中庭（上层） · 东北侧",
        "enArea": "Atrium",
        "note": "固定驻守于【中庭（上层）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 0,
        "x": 36.44,
        "y": 60.62,
        "worldCoord": [
          -108.3,
          15.5
        ],
        "count": 1,
        "poiName": "装卸区",
        "area": "装卸区下层地铁站台",
        "enArea": "Loading Bay Metro Station",
        "note": "在【装卸区下层地铁站台】（装卸区周边）沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [],
    "arc-leaper": [],
    "arc-rocketeer": [],
    "arc-vaporizer": [
      {
        "layer": 1,
        "x": 36.87,
        "y": 59.18,
        "worldCoord": [
          -106.5,
          9.3
        ],
        "count": 1,
        "poiName": "装卸区",
        "area": "装卸区上层物流大厅",
        "enArea": "Loading Bay Logistics Hall",
        "note": "在【装卸区上层物流大厅】（装卸区周边）沿预设路径巡逻。"
      }
    ]
  },
  "riven-tides": {
    "arc-sentinel": [
      {
        "layer": 0,
        "x": 40.58,
        "y": 44.25,
        "worldCoord": [
          -113,
          -327
        ],
        "count": 1,
        "poiName": "“哨卫”",
        "area": "港务局大楼",
        "enArea": "Port Authority Building",
        "note": "固定架设于【港务局大楼】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 55.61,
        "y": 44.83,
        "worldCoord": [
          67.3,
          -320
        ],
        "count": 1,
        "poiName": "残骸",
        "area": "残骸区",
        "enArea": "Wreckage",
        "note": "固定架设于【残骸区】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 48.31,
        "y": 60.34,
        "worldCoord": [
          -20.3,
          -133.9
        ],
        "count": 1,
        "poiName": "骡丘",
        "area": "支援建筑（骡丘北侧）",
        "enArea": "Support Building",
        "note": "固定架设于【支援建筑（骡丘北侧）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 59.21,
        "y": 57.24,
        "worldCoord": [
          110.5,
          -171.1
        ],
        "count": 1,
        "poiName": "按钮",
        "area": "堆料场",
        "enArea": "Stacking Yard",
        "note": "固定架设于【堆料场】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 51.04,
        "y": 73.63,
        "worldCoord": [
          12.5,
          25.6
        ],
        "count": 1,
        "poiName": "海关大楼",
        "area": "海关大楼",
        "enArea": "Customs House",
        "note": "固定架设于【海关大楼】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 0,
        "x": 44.43,
        "y": 43.58,
        "worldCoord": [
          -66.8,
          -335
        ],
        "count": 1,
        "poiName": "港务局大楼",
        "area": "港务局大楼 · #1",
        "enArea": "Port Authority Building",
        "note": "固定驻守于【港务局大楼】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 42.58,
        "y": 42.39,
        "worldCoord": [
          -89,
          -349.3
        ],
        "count": 1,
        "poiName": "港务局大楼",
        "area": "港务局大楼 · #2",
        "enArea": "Port Authority Building",
        "note": "固定驻守于【港务局大楼】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 30,
        "y": 64.36,
        "worldCoord": [
          -240,
          -85.7
        ],
        "count": 1,
        "poiName": "全景酒店夜总会密室",
        "area": "蔚蓝全景酒店 · #1",
        "enArea": "Hotel Panorama Azzurro",
        "note": "固定驻守于【蔚蓝全景酒店】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 27.12,
        "y": 60.75,
        "worldCoord": [
          -274.6,
          -129
        ],
        "count": 1,
        "poiName": "蔚蓝全景酒店",
        "area": "蔚蓝全景酒店 · 东北侧",
        "enArea": "Hotel Panorama Azzurro",
        "note": "固定驻守于【蔚蓝全景酒店】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 65.26,
        "y": 54.71,
        "worldCoord": [
          183.1,
          -201.5
        ],
        "count": 1,
        "poiName": "堆料场",
        "area": "起重机控制室 · 南侧",
        "enArea": "Crane House",
        "note": "固定驻守于【起重机控制室】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 23.06,
        "y": 60.61,
        "worldCoord": [
          -323.3,
          -130.7
        ],
        "count": 1,
        "poiName": "酒店综合体",
        "area": "蔚蓝全景酒店 · 西侧",
        "enArea": "Hotel Panorama Azzurro",
        "note": "固定驻守于【蔚蓝全景酒店】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 70.83,
        "y": 54.05,
        "worldCoord": [
          250,
          -209.4
        ],
        "count": 1,
        "poiName": "港口",
        "area": "起重机控制室 · 东侧",
        "enArea": "Crane House",
        "note": "固定驻守于【起重机控制室】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 0,
        "x": 47.21,
        "y": 67.02,
        "worldCoord": [
          -33.5,
          -53.8
        ],
        "count": 1,
        "poiName": "骡丘",
        "area": "骡丘",
        "enArea": "Mulatierra Hill",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【投弹手 / 堡垒】中随机刷新其一。 在【骡丘】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 28.77,
        "y": 68.18,
        "worldCoord": [
          -254.8,
          -39.8
        ],
        "count": 1,
        "poiName": "全景酒店夜总会密室",
        "area": "酒店综合体南侧 · 西南侧",
        "enArea": "Hotel Complex",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【投弹手 / 堡垒】中随机刷新其一。 在【酒店综合体南侧】（全景酒店夜总会密室周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.19,
        "y": 48.18,
        "worldCoord": [
          -81.7,
          -279.8
        ],
        "count": 1,
        "poiName": "“哨卫”",
        "area": "中央浅滩海床",
        "enArea": "Seabed",
        "note": "在【中央浅滩海床】（“哨卫”周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 67.56,
        "y": 49.07,
        "worldCoord": [
          210.7,
          -269.2
        ],
        "count": 1,
        "poiName": "港口",
        "area": "堆料场",
        "enArea": "Stacking Yard",
        "note": "在【堆料场】（港口周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 26.95,
        "y": 66.13,
        "worldCoord": [
          -276.6,
          -64.4
        ],
        "count": 1,
        "poiName": "蔚蓝全景酒店",
        "area": "酒店综合体南侧 · 南侧",
        "enArea": "Hotel Complex",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【酒店综合体南侧】（蔚蓝全景酒店周边）沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [
      {
        "layer": 0,
        "x": 47.21,
        "y": 67.02,
        "worldCoord": [
          -33.5,
          -53.8
        ],
        "count": 1,
        "poiName": "骡丘",
        "area": "骡丘",
        "enArea": "Mulatierra Hill",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【投弹手 / 堡垒】中随机刷新其一。 在【骡丘】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 28.77,
        "y": 68.18,
        "worldCoord": [
          -254.8,
          -39.8
        ],
        "count": 1,
        "poiName": "全景酒店夜总会密室",
        "area": "酒店综合体南侧 · 西南侧 #1",
        "enArea": "Hotel Complex",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【投弹手 / 堡垒】中随机刷新其一。 在【酒店综合体南侧】（全景酒店夜总会密室周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 26.98,
        "y": 66.63,
        "worldCoord": [
          -276.2,
          -58.4
        ],
        "count": 1,
        "poiName": "全景酒店夜总会密室",
        "area": "酒店综合体南侧 · 西南侧 #2",
        "enArea": "Hotel Complex",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【酒店综合体南侧】（全景酒店夜总会密室周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 43.62,
        "y": 47.92,
        "worldCoord": [
          -76.6,
          -283
        ],
        "count": 1,
        "poiName": "“哨卫”",
        "area": "中央浅滩海床",
        "enArea": "Seabed",
        "note": "在【中央浅滩海床】（“哨卫”周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 67.74,
        "y": 48.6,
        "worldCoord": [
          212.9,
          -274.8
        ],
        "count": 1,
        "poiName": "港口",
        "area": "堆料场",
        "enArea": "Stacking Yard",
        "note": "在【堆料场】（港口周边）沿预设路径巡逻。"
      }
    ],
    "arc-leaper": [
      {
        "layer": 0,
        "x": 38.84,
        "y": 55.52,
        "worldCoord": [
          -133.9,
          -191.8
        ],
        "count": 1,
        "poiName": "货运码头",
        "area": "中央浅滩海床",
        "enArea": "Seabed",
        "note": "在【中央浅滩海床】（货运码头周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.64,
        "y": 52.73,
        "worldCoord": [
          127.7,
          -225.2
        ],
        "count": 1,
        "poiName": "按钮",
        "area": "堆料场",
        "enArea": "Stacking Yard",
        "note": "在【堆料场】（按钮周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 48.88,
        "y": 71.85,
        "worldCoord": [
          -13.4,
          4.2
        ],
        "count": 1,
        "poiName": "海关大楼",
        "area": "海关大楼",
        "enArea": "Customs House",
        "note": "在【海关大楼】沿预设路径巡逻。"
      }
    ],
    "arc-rocketeer": [
      {
        "layer": 0,
        "x": 46.53,
        "y": 44.5,
        "worldCoord": [
          -41.6,
          -324
        ],
        "count": 1,
        "poiName": "港务局大楼",
        "area": "中央浅滩海床",
        "enArea": "Seabed",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【汽化者 / 火箭手】中随机刷新其一。 在【中央浅滩海床】（港务局大楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 62.41,
        "y": 47.92,
        "worldCoord": [
          148.9,
          -283
        ],
        "count": 1,
        "poiName": "堆料场",
        "area": "港口起重机区 · 北侧",
        "enArea": "Crane",
        "note": "在【港口起重机区】（堆料场周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.09,
        "y": 73.63,
        "worldCoord": [
          1.1,
          25.6
        ],
        "count": 1,
        "poiName": "海关大楼",
        "area": "海关大楼",
        "enArea": "Customs House",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【海关大楼】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 40.3,
        "y": 50.92,
        "worldCoord": [
          -116.4,
          -247
        ],
        "count": 1,
        "poiName": "“哨卫”",
        "area": "残骸区",
        "enArea": "Wreckage",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【残骸区】（“哨卫”周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 28.19,
        "y": 62.29,
        "worldCoord": [
          -261.7,
          -110.5
        ],
        "count": 1,
        "poiName": "蔚蓝全景酒店",
        "area": "全景酒店东侧奇袭者营地",
        "enArea": "Raider Camp",
        "note": "在【全景酒店东侧奇袭者营地】（蔚蓝全景酒店周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 62.34,
        "y": 49.74,
        "worldCoord": [
          148.1,
          -261.1
        ],
        "count": 1,
        "poiName": "堆料场",
        "area": "港口起重机区 · 西北侧",
        "enArea": "Crane",
        "note": "在【港口起重机区】（堆料场周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.69,
        "y": 51.87,
        "worldCoord": [
          128.3,
          -235.6
        ],
        "count": 1,
        "poiName": "按钮",
        "area": "堆料场",
        "enArea": "Stacking Yard",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【堆料场】（按钮周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 46.18,
        "y": 42.56,
        "worldCoord": [
          -45.8,
          -347.3
        ],
        "count": 1,
        "poiName": "港务局大楼",
        "area": "港务局大楼",
        "enArea": "Port Authority Building",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【港务局大楼】沿预设路径巡逻。"
      }
    ],
    "arc-vaporizer": [
      {
        "layer": 0,
        "x": 46.53,
        "y": 44.5,
        "worldCoord": [
          -41.6,
          -324
        ],
        "count": 1,
        "poiName": "港务局大楼",
        "area": "中央浅滩海床",
        "enArea": "Seabed",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【汽化者 / 火箭手】中随机刷新其一。 在【中央浅滩海床】（港务局大楼周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 27.95,
        "y": 61.85,
        "worldCoord": [
          -264.6,
          -115.8
        ],
        "count": 1,
        "poiName": "蔚蓝全景酒店",
        "area": "全景酒店东侧奇袭者营地",
        "enArea": "Raider Camp",
        "note": "在【全景酒店东侧奇袭者营地】（蔚蓝全景酒店周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 50.09,
        "y": 73.63,
        "worldCoord": [
          1.1,
          25.6
        ],
        "count": 1,
        "poiName": "海关大楼",
        "area": "海关大楼",
        "enArea": "Customs House",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【海关大楼】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 40.3,
        "y": 50.92,
        "worldCoord": [
          -116.4,
          -247
        ],
        "count": 1,
        "poiName": "“哨卫”",
        "area": "残骸区",
        "enArea": "Wreckage",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【火箭手 / 汽化者】中随机刷新其一。 在【残骸区】（“哨卫”周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.68,
        "y": 51.32,
        "worldCoord": [
          128.2,
          -242.2
        ],
        "count": 1,
        "poiName": "堆料场",
        "area": "堆料场 · 西北侧",
        "enArea": "Stacking Yard",
        "note": "在【堆料场】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 60.69,
        "y": 51.87,
        "worldCoord": [
          128.3,
          -235.6
        ],
        "count": 1,
        "poiName": "按钮",
        "area": "堆料场 · 东北侧",
        "enArea": "Stacking Yard",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新（常作为【火箭手】的伴随护卫出没）。 在【堆料场】（按钮周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 45.78,
        "y": 42.86,
        "worldCoord": [
          -50.6,
          -343.7
        ],
        "count": 1,
        "poiName": "港务局大楼",
        "area": "港务局大楼",
        "enArea": "Port Authority Building",
        "spawnCondition": "night-raid",
        "note": "【地图事件限定：夜袭】仅在【夜袭】地图条件下额外激活刷新。 在【港务局大楼】沿预设路径巡逻。"
      }
    ]
  },
  "pendola-pass": {
    "arc-sentinel": [
      {
        "layer": 0,
        "x": 64.66,
        "y": 54.86,
        "worldCoord": [
          237.5,
          78.7
        ],
        "count": 1,
        "poiName": "管控接收站",
        "area": "管控接收站",
        "enArea": "Controlled Receiving Facility",
        "note": "固定架设于【管控接收站】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 50.44,
        "y": 44.47,
        "worldCoord": [
          7.1,
          -89.6
        ],
        "count": 1,
        "poiName": "阿尔玛特拉站",
        "area": "加密通讯桅杆（冰封河西岸）",
        "enArea": "Secure Communications Mast",
        "note": "固定架设于【加密通讯桅杆（冰封河西岸）】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      },
      {
        "layer": 0,
        "x": 34.03,
        "y": 51.99,
        "worldCoord": [
          -258.7,
          32.2
        ],
        "count": 1,
        "poiName": "阿尔玛特拉村",
        "area": "阿尔玛特拉村",
        "enArea": "Almatera Village",
        "note": "固定架设于【阿尔玛特拉村】建筑高处、桁架或墙体卡槽位，远距离激光瞄准预警后发射高爆狙击弹。"
      }
    ],
    "arc-shredder": [
      {
        "layer": 0,
        "x": 49.24,
        "y": 55.8,
        "worldCoord": [
          -12.3,
          94
        ],
        "count": 1,
        "poiName": "军需超市",
        "area": "军需超市",
        "enArea": "Commissary Supermarket",
        "note": "固定驻守于【军需超市】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 70.51,
        "y": 38.46,
        "worldCoord": [
          332.3,
          -186.9
        ],
        "count": 1,
        "poiName": "晴空天文台",
        "area": "晴空天文台",
        "enArea": "Cielo Sereno Observatory",
        "note": "固定驻守于【晴空天文台】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 34.58,
        "y": 63.22,
        "worldCoord": [
          -249.8,
          214.2
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区圣索菲亚教堂",
        "enArea": "Santa Sofia Church",
        "note": "固定驻守于【老城区圣索菲亚教堂】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 72.6,
        "y": 29.83,
        "worldCoord": [
          366.1,
          -326.8
        ],
        "count": 1,
        "poiName": "深空望远镜",
        "area": "深空望远镜",
        "enArea": "Deep-Space Telescope",
        "note": "固定驻守于【深空望远镜】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 23.75,
        "y": 49.55,
        "worldCoord": [
          -425.3,
          -7.3
        ],
        "count": 1,
        "poiName": "倒下的“帝王”",
        "area": "倒下的“帝王”残骸内",
        "enArea": "Fallen Emperor",
        "note": "【不重复刷新】该点位每局仅生成 1 次。固定驻守于【倒下的“帝王”残骸内】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 44.79,
        "y": 40.47,
        "worldCoord": [
          -84.4,
          -154.4
        ],
        "count": 1,
        "poiName": "阿尔玛特拉站",
        "area": "阿尔玛特拉站",
        "enArea": "Almatera Station",
        "note": "固定驻守于【阿尔玛特拉站】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      },
      {
        "layer": 0,
        "x": 65.39,
        "y": 67.63,
        "worldCoord": [
          249.3,
          285.6
        ],
        "count": 1,
        "poiName": "货运总站",
        "area": "铁路站场（货运总站南）",
        "enArea": "Railyard",
        "note": "固定驻守于【铁路站场（货运总站南）】室内走廊或大厅拐角（高威胁近战破片突袭点）。"
      }
    ],
    "arc-bastion": [
      {
        "layer": 0,
        "x": 69.18,
        "y": 40.86,
        "worldCoord": [
          310.7,
          -148.1
        ],
        "count": 1,
        "poiName": "晴空天文台",
        "area": "晴空天文台",
        "enArea": "Cielo Sereno Observatory",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【晴空天文台】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.11,
        "y": 35.15,
        "worldCoord": [
          18,
          -240.6
        ],
        "count": 1,
        "poiName": "调度塔",
        "area": "北部铁路枢纽（调度塔南）",
        "enArea": "Railroad Junction",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【北部铁路枢纽（调度塔南）】（调度塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 57.53,
        "y": 68.5,
        "worldCoord": [
          122,
          299.7
        ],
        "count": 1,
        "poiName": "货运总站",
        "area": "南侧山口走廊",
        "enArea": "Southern Pass",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【南侧山口走廊】（货运总站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 34.98,
        "y": 62.22,
        "worldCoord": [
          -243.3,
          198
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区市集广场",
        "enArea": "Piazza Mercato",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【老城区市集广场】（老城区周边）沿预设路径巡逻。"
      }
    ],
    "arc-bombardier": [
      {
        "layer": 0,
        "x": 69.18,
        "y": 40.86,
        "worldCoord": [
          310.7,
          -148.1
        ],
        "count": 1,
        "poiName": "晴空天文台",
        "area": "晴空天文台",
        "enArea": "Cielo Sereno Observatory",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【晴空天文台】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.11,
        "y": 35.15,
        "worldCoord": [
          18,
          -240.6
        ],
        "count": 1,
        "poiName": "调度塔",
        "area": "北部铁路枢纽（调度塔南）",
        "enArea": "Railroad Junction",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【北部铁路枢纽（调度塔南）】（调度塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 57.53,
        "y": 68.5,
        "worldCoord": [
          122,
          299.7
        ],
        "count": 1,
        "poiName": "货运总站",
        "area": "南侧山口走廊",
        "enArea": "Southern Pass",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【南侧山口走廊】（货运总站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 34.98,
        "y": 62.22,
        "worldCoord": [
          -243.3,
          198
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区市集广场",
        "enArea": "Piazza Mercato",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【老城区市集广场】（老城区周边）沿预设路径巡逻。"
      }
    ],
    "arc-leaper": [
      {
        "layer": 0,
        "x": 69.18,
        "y": 40.86,
        "worldCoord": [
          310.7,
          -148.1
        ],
        "count": 1,
        "poiName": "晴空天文台",
        "area": "晴空天文台",
        "enArea": "Cielo Sereno Observatory",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【晴空天文台】沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 51.11,
        "y": 35.15,
        "worldCoord": [
          18,
          -240.6
        ],
        "count": 1,
        "poiName": "调度塔",
        "area": "北部铁路枢纽（调度塔南）",
        "enArea": "Railroad Junction",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【北部铁路枢纽（调度塔南）】（调度塔周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 57.53,
        "y": 68.5,
        "worldCoord": [
          122,
          299.7
        ],
        "count": 1,
        "poiName": "货运总站",
        "area": "南侧山口走廊 · 西南侧",
        "enArea": "Southern Pass",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【南侧山口走廊】（货运总站周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 54.51,
        "y": 60.74,
        "worldCoord": [
          73.1,
          174
        ],
        "count": 1,
        "poiName": "军需超市",
        "area": "南侧山口走廊 · 东南侧",
        "enArea": "Southern Pass",
        "note": "在【南侧山口走廊】（军需超市周边）沿预设路径巡逻。"
      },
      {
        "layer": 0,
        "x": 34.98,
        "y": 62.22,
        "worldCoord": [
          -243.3,
          198
        ],
        "count": 1,
        "poiName": "老城区",
        "area": "老城区市集广场",
        "enArea": "Piazza Mercato",
        "spawnCondition": "pool",
        "note": "【多机甲随机池】该刷怪槽位会在【堡垒 / 投弹手 / 跳跃者】中随机刷新其一。 在【老城区市集广场】（老城区周边）沿预设路径巡逻。"
      }
    ],
    "arc-rocketeer": [],
    "arc-vaporizer": []
  }
}

// ============================================================================
// 3. Elite ARC Activity Ranges (`ELITE_ARC_ACTIVITY_ZONES`)
//    Removed redundant zone rings/pills per user preference (exact spawn markers are shown directly).
// ============================================================================
export const ELITE_ARC_ACTIVITY_ZONES = {}

// ============================================================================
// 4. Builder Functions for `buildMapWikiData.mjs`
// ============================================================================
const SPAWN_CONDITION_META = {
  standard: { badgeSuffix: '', titleTag: '' },
  pool: { badgeSuffix: '(随机池)', titleTag: ' · 随机池' },
  'night-raid': { badgeSuffix: '(夜袭)', titleTag: ' · 夜袭限定' },
  hurricane: { badgeSuffix: '(飓风)', titleTag: ' · 飓风限定' },
  'base+hurricane': { badgeSuffix: '(常规+飓风)', titleTag: ' · 常规+飓风双刷' },
  'close-scrutiny': { badgeSuffix: '(严密监视)', titleTag: ' · 严密监视护卫' },
}

export function buildEliteArcMarkersForMap(map) {
  const mapSpawns = ELITE_ARC_SPAWNS[map.id] || {}
  const byCategory = {}

  for (const cat of ELITE_ARC_CATEGORIES) {
    const rawList = mapSpawns[cat.id] || []
    byCategory[cat.id] = rawList.map((s, idx) => {
      const layer = s.layer ?? 0
      const cond = s.spawnCondition || 'standard'
      const condMeta = SPAWN_CONDITION_META[cond] || SPAWN_CONDITION_META.standard
      const countText = s.count > 1 ? ` ×${s.count}` : ''
      const badgeCountText = s.count > 1 ? `×${s.count}` : ''

      return {
        id: `${map.shortPrefix || map.id}-${cat.id}-${pad2(idx + 1)}`,
        arcId: cat.id,
        kind: 'elite-arc',
        layer,
        x: s.x,
        y: s.y,
        ...(Array.isArray(s.worldCoord) ? { worldCoord: s.worldCoord } : {}),
        count: s.count || 1,
        poiName: s.poiName || s.area,
        area: s.area,
        enArea: s.enArea,
        spawnCondition: cond,
        title: `${cat.name} (${cat.enName})${countText}${condMeta.titleTag} · ${s.area}`,
        enTitle: `${cat.enName}${s.count > 1 ? ` (×${s.count})` : ''} — ${s.enArea}`,
        subLabel: `精英ARC · ${cat.roleTag}${condMeta.badgeSuffix ? ` · ${condMeta.badgeSuffix.replace(/^\(|\)$/g, '')}` : ''} · ${s.poiName || s.area}`,
        badgeText: `${cat.shortName}${badgeCountText}${condMeta.badgeSuffix}`,
        icon: cat.icon,
        accent: cat.accent,
        weakpoint: cat.weakpoint,
        desc: `${s.note || `${s.area}高频刷新的【${cat.name} (${cat.enName})】。`} 弱点提示：${cat.weakpoint}。`,
        lootHint: `核心掉落：${cat.dropItem}`,
      }
    })
  }

  return byCategory
}

export function buildEliteArcZonesForMap(_map) {
  return []
}

// ============================================================================
// 5. CLI Runner: Update `mapsWikiData.json` & `questResourcesData.json`
// ============================================================================
const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isMain) {
  const mapsWikiPath = path.join(ROOT, 'src/data/mapsWikiData.json')
  const mapsWiki = JSON.parse(fs.readFileSync(mapsWikiPath, 'utf8'))

  mapsWiki.eliteArcCategories = ELITE_ARC_CATEGORIES
  let totalArcMarkers = 0
  let totalArcZones = 0
  for (const m of mapsWiki.maps || []) {
    m.eliteArcMarkers = buildEliteArcMarkersForMap(m)
    m.eliteArcZones = buildEliteArcZonesForMap(m)
    for (const arr of Object.values(m.eliteArcMarkers)) totalArcMarkers += arr.length
    totalArcZones += m.eliteArcZones.length
  }

  fs.writeFileSync(mapsWikiPath, JSON.stringify(mapsWiki, null, 2), 'utf8')
  console.log(
    `Updated src/data/mapsWikiData.json: ${ELITE_ARC_CATEGORIES.length} eliteArcCategories, ${totalArcMarkers} eliteArcMarkers, ${totalArcZones} eliteArcZones`,
  )

  // Enrich Workshop Station Elite ARC Drop Materials in `src/data/questResourcesData.json`
  const qrPath = path.join(ROOT, 'src/data/questResourcesData.json')
  const qr = JSON.parse(fs.readFileSync(qrPath, 'utf8'))

  const ELITE_ARC_WORKSHOP_LINKS = {
    'Sentinel Firing Core': {
      source: '大坝战场·溢洪道闸门/受控访问区/水培穹顶、太空港·中央发射塔与控制塔A6、裂潮镇·“哨卫”礁石炮台击毁【哨卫 (Sentinel)】狙击炮塔掉落',
      mapLinks: [
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '溢洪道闸门',
          arcId: 'arc-sentinel',
          label: '大坝战场 · 溢洪道闸门双卡槽与水培/受控区“哨卫”刷新点（精确点位）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '发射塔',
          arcId: 'arc-sentinel',
          label: '太空港 · 中央发射塔双“哨卫”与控制塔A6炮台刷新点（精确点位）',
        },
        {
          mapId: 'riven-tides',
          mapName: '裂潮镇',
          poiName: '“哨卫”',
          arcId: 'arc-sentinel',
          label: '裂潮镇 · “哨卫”礁石炮台与残骸区“哨卫”刷新点（精确点位）',
        },
      ],
    },
    'Bastion Cell': {
      source: '太空港·控制塔A6与外围隐藏地堡/集装箱仓库、大坝战场·水培穹顶综合体与受控访问区、掩埋废城·马拉诺公园击毁重装【堡垒 (Bastion)】机甲掉落',
      mapLinks: [
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '控制塔A6',
          arcId: 'arc-bastion',
          label: '太空港 · 控制塔A6/集装箱仓库与外围地堡“堡垒”刷点（精确点位）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '水培穹顶综合体',
          arcId: 'arc-bastion',
          label: '大坝战场 · 水培穹顶双槽位与受控访问区“堡垒”刷点（精确点位）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '马拉诺公园',
          arcId: 'arc-bastion',
          label: '掩埋废城 · 马拉诺公园与老城区/市集废墟“堡垒”刷点（精确点位）',
        },
      ],
    },
    'Rocketeer Driver': {
      source: '太空港·中央发射塔与集装箱仓库空域、大坝战场·溢洪道闸门与水培穹顶、掩埋废城·马拉诺公园与停车场空域击落【火箭手 (Rocketeer)】重型炮艇掉落',
      mapLinks: [
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '发射塔',
          arcId: 'arc-rocketeer',
          label: '太空港 · 中央发射塔多架“火箭手”高频巡航刷点（精确点位）',
        },
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '溢洪道闸门',
          arcId: 'arc-rocketeer',
          label: '大坝战场 · 溢洪道闸门与水培穹顶“火箭手”巡航刷点（精确点位）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '马拉诺公园',
          arcId: 'arc-rocketeer',
          label: '掩埋废城 · 马拉诺公园与停车场/阿布斯托“火箭手”刷点（精确点位）',
        },
      ],
    },
    'Leaper Pulse Unit': {
      source: '大坝战场·测试附楼与红湖阳台/水培穹顶沼泽、掩埋废城·阿布斯托广场与老城区、彭多拉山口·南侧山口走廊击毁【跳跃者 (Leaper)】四足突袭机甲掉落',
      mapLinks: [
        {
          mapId: 'dam-battlegrounds',
          mapName: '大坝战场',
          poiName: '红湖阳台',
          arcId: 'arc-leaper',
          label: '大坝战场 · 红湖阳台/测试附楼双槽位与水培“跳跃者”刷点（精确点位）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '阿布斯托广场',
          arcId: 'arc-leaper',
          label: '掩埋废城 · 阿布斯托广场双刷位与老城区“跳跃者”刷点（精确点位）',
        },
        {
          mapId: 'pendola-pass',
          mapName: '彭多拉山口',
          poiName: '货运总站',
          arcId: 'arc-leaper',
          label: '彭多拉山口 · 南侧山口独享刷点与随机池“跳跃者”刷点（精确点位）',
        },
      ],
    },
    'Bombardier Cell': {
      source: '蓝门·外部大门/仓储综合区与农田、掩埋废城·马拉诺公园与停车场/老城区、太空港·外围隐藏地堡与东西集装箱堆场击毁【投弹手 (Bombardier)】曲射重炮机甲掉落',
      mapLinks: [
        {
          mapId: 'blue-gate',
          mapName: '蓝门',
          poiName: '检查站',
          arcId: 'arc-bombardier',
          label: '蓝门 · 外部大门/仓储综合区“投弹手”重炮刷点（精确点位）',
        },
        {
          mapId: 'buried-city',
          mapName: '掩埋废城',
          poiName: '马拉诺公园',
          arcId: 'arc-bombardier',
          label: '掩埋废城 · 马拉诺公园与停车场/老城区“投弹手”刷点（精确点位）',
        },
        {
          mapId: 'spaceport',
          mapName: '太空港',
          poiName: '外围隐藏地堡',
          arcId: 'arc-bombardier',
          label: '太空港 · 外围隐藏地堡与东西集装箱堆场“投弹手”刷点（精确点位）',
        },
      ],
    },
  }

  for (const st of qr.workshop?.stations || []) {
    for (const lv of st.levels || []) {
      for (const m of lv.materials || []) {
        const spec = ELITE_ARC_WORKSHOP_LINKS[m.enName]
        if (spec) {
          m.source = spec.source
          m.mapLinks = spec.mapLinks
        }
      }
    }
  }

  fs.writeFileSync(qrPath, JSON.stringify(qr, null, 2), 'utf8')
  console.log('Updated src/data/questResourcesData.json with Elite ARC workshop material mapLinks (arcId)')
}
