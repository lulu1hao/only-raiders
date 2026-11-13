# Arc Raiders 大坝 3D 地图 · 上下文（2026-10-23）

> 这份文档记录「现在是什么状态、为什么是这个状态、怎么继续」。
> 现在是**单一全图模式**：打开就是 2.4 × 2.4 km、3 m 采样地形 + 34 处 POI + 28 个坝体构件，不再区分区域版/全图版。
> 第七节是核验，第八节是上一轮试过并回退的方案，第九节是这次改成全图默认的过程。

---

## 一、目标

一个独立桌面小工具（Tauri 2 + Vue 3 + three.js），把 Arc Raiders 的 `TheDam_02` 大坝区域做成可自由飞行的 3D 场景：

- 2.4 × 2.4 km 真实地形（landscape 高度图解码，3 m 采样）
- 34 处地图 POI，其中 7 处按“区域内全部 actor”做成近景
- 坝区 28 个真实构件（主控楼 / 动力楼 / 溢洪闸 / 溢洪道墙 / 厂房）
- 目标是“建筑对、位置对、地面别糊成一团”，不追求 1:1 材质

---

## 二、当前状态

**全图 2.4 × 2.4 km（X 3472–5872，Y 4387–6787），3 m 采样。**

| 层 | 内容 | 文件 | 三角面 | 体积 |
|---|---|---|---|---|
| 地形 | landscape 高度图，3 m | `world/dam-terrain.glb` | 1,411,200 | 35.9 MB |
| 坝体 | POI16 水电站 28 个构件 | `poi16/*.glb` | 182,321 | 9.4 MB |
| POI 粗模 | 34 处，每处 25k 面预算 | `world/poi-coarse/*.glb` | 995,279 | 43.1 MB |
| 近景·测试附楼 | 544 件 | `poi-merged/annex.glb` | 150,448 | 6.6 MB |
| 近景·水处理厂 | 976 件 | `poi-merged/water.glb` | 236,079 | 10.4 MB |
| 近景·发电厂 | 112 件 | `poi-merged/power.glb` | 185,321 | 7.5 MB |
| 近景·水培穹顶 | 326 件 | `poi-merged/hydroponic.glb` | 204,570 | 9.6 MB |
| 近景·红湖 | 165 件 | `poi-merged/redlakes.glb` | 144,302 | 6.1 MB |
| 近景·控制塔 | 374 件 | `poi-merged/controltower.glb` | 78,585 | 3.9 MB |
| 近景·水塔 | 248 件 | `poi-merged/watertowers.glb` | 138,273 | 6.3 MB |
| **合计** | | | **≈ 347 万（实际渲染）** | **138.8 MB** |

- 地形元数据：739,600 顶点 / 1,411,200 面 / 400 个 126 m 组件，高程 −548.1 ~ −101.8 m
- 近景 7 处合计 1,137,578 面 / 50.4 MB；34 处粗模里有 8 处的粗模在应用里隐藏（`the-dam` + 7 处近景），实际渲染 ≈ 347 万面
- 桌面包 `release\TheDam3D.exe` 重打后 **43.2 MB**
- 首次加载资源 138.8 MB，比 5 m 版本明显慢（机器相关）

### 目录

```
E:\qianproject\arc-map
├─ src/App.vue                 查看器（three.js + HUD，单一全图模式）
├─ src/data/arcDamWorldMeta.json 全图地形元数据
├─ src/data/arcDamProps.json   28 个坝体构件
├─ src/data/arcDamPoiMeta.json 7 处近景清单
├─ src/data/arcDamWorld.json   34 处 POI（点位来自 DA_MapAreaInfo）
├─ src/data/arcDamMapAreas.json 34 个点位 + 6 条 AreaSplinePoints
├─ public/maps/world/dam-terrain.glb   全图地形（3 m）35.9 MB
├─ public/maps/world/poi-coarse/*.glb  34 处粗模 43.1 MB
├─ public/maps/poi16/*.glb             坝体构件 9.4 MB
├─ public/maps/poi-merged/*.glb        7 处近景 50.4 MB
├─ tools/                       核验脚本（bbox / 埋深 / POI 审计 / 截图）
├─ src-tauri/                   Tauri 2 桌面包
└─ docs/                        截图 + 本文档
```

---

## 三、运行与打包

```powershell
cd E:\qianproject\arc-map
npm run dev                     # 浏览器 http://localhost:5180

# 打包（务必带 custom-protocol，否则 exe 会去连 dev server）
npm run build
cd src-tauri
cargo build --release --offline --features custom-protocol
# 产物：src-tauri\target\release\arc-map.exe
```

`build.ps1` 会一键做上面两步并复制到 `release\TheDam3D.exe`。
Tauri 把 `dist/` 整个嵌进 exe：资源 138.8 MB → exe 43.2 MB（已实机启动验证）。

---

## 四、数据从哪来、怎么重新生成

解包工具：`C:\Users\翟毅\AppData\Local\finals-map\extractor-latest`（CUE4Parse + Theia，已打 4 个补丁）。
游戏 Paks：`F:\SteamLibrary\steamapps\common\Arc Raiders\PioneerGame\Content\Paks`。

```powershell
cd C:\Users\翟毅\AppData\Local\finals-map\extractor-latest
$env:DOTNET_ROOT='C:\Users\翟毅\AppData\Local\finals-map\dotnet'
$dn='C:\Users\翟毅\AppData\Local\finals-map\dotnet\dotnet.exe'
$cli='bin\Release\net10.0\extractor-latest.dll'
$skip='--skip=SM_South,SM_Weeds,SM_Cobweb,SM_Shrub,SM_CandleBerries,SM_FX,SM_DecalMesh,SM_StickerDecals,SM_ClothBundle,SM_DebrisPile,SM_MetalDebrisPile,SM_ConcreteDebris,SM_Snowpile,SM_Dam_Ivy,SM_WaterPlane,Plane,1M_Cube,Occluder,MeshDecal,EnemyWreck,Backdrop,SM_Base_Rock,Cables,Wires,LightBlock,LightGeo,Barrel,Chair,Desk,Crate,Sign,StreetLight,SM_POI16_'

# 全图地形（2.4×2.4 km，3 m）—— 当前用的
& $dn $cli terrain 'TheDam_02/TheDam_02_P/_Generated_' dam-terrain.glb --step=3 --bounds=3472,4387,5872,6787

# 7 处近景：区域内全部构件，不按预算裁件（--tris=0），用游戏自带 LOD
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 4976 5888 125 annex.glb $skip --tris=0 --minvol=2
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 4433.5 5593 130 water.glb $skip --tris=0 --minvol=2
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 5009 5189 170 power.glb $skip --tris=0 --minvol=2
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 4618.9 5280.1 165 hydroponic.glb $skip --tris=0 --minvol=2
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 5141.4 5536.3 230 redlakes.glb $skip --tris=0 --minvol=2
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 4301.7 5897.9 140 watertowers.glb $skip --tris=0 --minvol=2

# 控制塔：塔体本身由 28 个坝体构件呈现，这里只烘塔周结构。
# 不能用上面的 $skip（带 SM_POI16_），并要排除已由构件覆盖的网格。
# 必须跳过 LightGeo：不跳会渲染成一个 31 m 的大白盒。
$ctskip='--skip=SM_South,SM_Weeds,SM_Cobweb,SM_Shrub,SM_CandleBerries,SM_FX,SM_DecalMesh,SM_StickerDecals,SM_ClothBundle,SM_DebrisPile,SM_MetalDebrisPile,SM_ConcreteDebris,SM_Snowpile,SM_Dam_Ivy,SM_WaterPlane,Plane,1M_Cube,Occluder,MeshDecal,EnemyWreck,Backdrop,SM_Base_Rock,Cables,Wires,LightBlock,LightGeo,Barrel,Chair,Desk,Crate,Sign,StreetLight,SM_POI16_PowerControl_02_A,SM_POI16_MainControl_01,SM_POI16_Auxiliary_Spillway_01_C,SM_POI16_Maintenance_01,SM_POI16_Spillways_01_A_Damaged,SM_POI16_WaterControl_01_Edited_A,SM_POI16_Spillway_01,SM_POI16_Tower_01_A,SM_POI16_SpillwayWallFront_01_A,SM_POI16_SpillwayWallFront_01_B,SM_POI16_SpillwayWallMid_01_A,SM_POI16_SpillwayWallMid_01_E,SM_POI16_SpillwayWallMid_01_F,SM_POI16_FloodedPowerhouse_01_A_Center,SM_Gvt_,SM_Wrh_,SM_Rsr_,SM_Catwalk_,SM_Elevator_,SM_Barrier,SM_ConcreteWeeds,SM_PipeLarge,SM_SupportBuilding,SM_Tarmac,SM_Block_,SM_POI_09,SM_POI16_Pillar_03'
& $dn $cli poimerged 'TheDam_02/TheDam_02_P/_Generated_' 4789.3 5647.7 110 controltower.glb $ctskip --tris=0 --minvol=2

# 地图 POI 清单（34 条）
& $dn $cli mapareas 'PioneerGame/Content/Pioneer/Maps/TheDam_02/DA_MapAreaInfo_TheDam_02_P' dam-pois.json

# 34 处粗模（用 25k 面预算；被近景替换的 8 处实际不显示）
& $dn $cli poibatch 'TheDam_02/TheDam_02_P/_Generated_' dam-pois.json outdir --tris=25000 --minvol=0.5 --r0=420 --r1=360 --r2=300 $skip
```

导出器能力（`extractor-latest`，已重编译）：

- `--tris=0` 表示不设三角面预算，区域内所有 actor 都烘进去
- ISM / HISM 根组件按 `PerInstanceSMData` 展开成每个实例一份
- `meshinv <prefix> <cx> <cy> <r>` 列出一个半径内“网格名 → 实例数/体积/位置”，用来核对区域内到底有什么
- `poimerged` 里会打印参与烘焙的网格名 × 实例数，方便查“大白盒”是哪来的

点位/多边形解析：

```powershell
node tools/parse-mapareas.mjs F:\arc-export\dam-mapareas.txt src\data\arcDamMapAreas.json
```

---

## 五、坐标约定（**别改**）

```
glTF x = UE x / 100
glTF y = UE z / 100
glTF z = +UE y / 100      // 是 +y，不是 -y
实例摆放：position(x, z, y)，rotation.y = -yaw，镜像实例 scale.z = -1
```

场景统一偏移（区域/全图共用过，现在只有全图）：

```
OFFSET = (-4672, +500, -5587)     // REF = 2.4 km bounds 中心
scene = UE 米 + OFFSET
```

- 地形网格按 126 m 组件对齐，实际范围比 `--bounds` 略大（3 m 版 z 到 6804）
- 俯视相机 `up = (0,0,-1)`，屏幕上方是 −UE Y（南），与游戏地图“北向上”差 180°；想对图用「镜像」
- `z = +UE y` 本身是一次镜像，默认视角与游戏内左右相反，「镜像」按钮把 `worldRoot.scale.z` 取反

---

## 六、页面实现要点

- 单一模式：`worldGroup`（全图地形 + 34 粗模 + 标记）+ `propsRoot`（28 构件 + 7 近景）；不再有区域地形和全图按钮
- 启动直接加载全图（139 MB）；加载中显示百分比，完成后 `snapFrame()` 直接给到确定的第一帧（不依赖 GSAP 补间，避免 60 MB 解析把动画卡在半路）
- 地形加载后做 (x,z) 高度均值焊接 + `computeVertexNormals`（3 m 版 739k 顶点也走焊接，阈值 900k）
- 相机 `fitDistance = 2898`，`activeCenter` 为地形包围盒中心；自由视角 / Orbit 切换、复位、飞览、俯视都基于它
- 图层开关：区域标记 / 镜像 / 线框 / 坝体 / 7 处近景 / 水面 / 复位 / 飞览 / 俯视
- 「区域标记」：34 个点位（竖线 + 圆环 + 文字）+ 6 条 `AreaSplinePoints` 多边形，颜色按 zoom 分级
- 调试钩子：`__arcWorld()`、`__arcState()`、`__arcToggleMarkers()`、`__arcFocusPoi(tag)`、`__arcPoiCenter(tag)`、`__arcLookAt(x,y,z,dist)`、`__arcPick(nx,ny)`、`__arcCam`
- 截图：`node tools/shot.mjs out.png --expr="..."`（连 127.0.0.1:9222 的无头 Edge）

---

## 七、区域核验

以游戏 `DA_MapAreaInfo_TheDam_02_P` 为基准（34 个点位 + 6 条多边形），用 glb 包围盒、最近三角面距离、地形埋深采样做对照。

### 7.1 近景与 POI 多边形

| 区域 | 点位（UE m） | 近景包围盒（m） | POI 多边形 | 覆盖 |
|---|---|---|---|---|
| 测试附楼 | 4975.8, 5888.3 | X 4869.7–5079.1 / Y 5761.1–6000.8 | X 4926–5035 / Y 5821–5953 | ✅ |
| 水处理厂 | 4433.5, 5593.0 | X 4314.0–4571.4 / Y 5500.1–5708.6 | X 4397–4485 / Y 5531–5647 | ✅ |
| 发电厂 | 5008.7, 5188.6 | X 4783.1–5192.1 / Y 5048.3–5365.4 | X 4838–5140 / Y 5052–5260 | ✅ |
| 水培穹顶 | 4618.9, 5280.1 | X 4470.6–4762.8 / Y 5121.4–5431.6 | X 4501–4723 / Y 5174–5396 | ✅ |

红湖 / 水塔 / 控制塔没有多边形，点位均落在各自包围盒内：

| 区域 | 点位 | 包围盒（m） |
|---|---|---|
| 红湖 | 5141.4, 5536.3 | X 4920.5–5279.9 / Y 5338.9–5755.8 |
| 水塔 | 4301.7, 5897.9 | X 4202.2–4447.8 / Y 5742.7–5968.4 |
| 控制塔 | 4789.3, 5647.7 | X 4676.3–4965.7 / Y 5523.1–5775.7 |

### 7.2 34 处 POI 的点位偏差

| 项目 | 结果 |
|---|---|
| 点位到自身最近三角面 ≤ 50 m | 33 / 34 |
| 原偏差最大的 Water Towers | 272 m → 重烘后点位落在包围盒内（`SM_WaterTower_01_A` ×3、`SM_WaterTower_02_A` ×5 等） |
| 剩余偏差 | Formicai Hills 52 m；West / East Broken Bridge 15 / 26 m；South Swamp Outpost 20 m；Victory Ridge 41 m——多为标记点与几何中心的正常偏差 |
| 其余 | 点位基本落在自身几何 0–20 m 内 |

### 7.3 建筑与地形贴合

把建筑顶点投影到地形高度场，统计低于地表 0.5 m / 2 m 的比例：

| 区域 | 中位高差 | 低于 0.5 m | 低于 2 m | 最深 |
|---|---|---|---|---|
| 测试附楼 | +9.0 m | 7.9% | 5.4% | −29.2 m |
| 水处理厂 | +9.5 m | 2.2% | 1.4% | −14.7 m |
| 发电厂 | +4.0 m | 30.9% | 29.2% | −78.6 m |

发电厂的 31% 主要是坡上的挡墙 / 基础；平台上的草皮穿出是 landscape hole 缺失导致的（第十节）。

### 7.4 关于“构件数”

`arealist` 统计半径内全部 actor（含树、石头、灯、触发器），不能直接当完整度；`poimerged --tris=0` 后近景是“通过 skip + minvol 的全部 actor”：

- 水处理厂 r=130：976 件
- 水培穹顶 r=165：326 件
- 红湖 r=230：165 件
- 水塔 r=140：248 件
- 控制塔 r=110：374 件（排除已由构件覆盖的网格）

---

## 八、试过并回退的整图方案（上一轮）及原因

上一轮的做法：

1. 全图地形 2.4 × 2.4 km（10 m → 5 m 采样）
2. 从 `DA_MapAreaInfo` 拿 34 个 POI 坐标，`poibatch` 批量烘粗模（43.1 MB）
3. 近景三块中模按距离 420 m 自动替换
4. 坝芯全量烘焙（443 件 / 90 万面 / 38.9 MB），法线重建，地形按建筑脚垫压平

**回退原因**：

- 34 个 POI 很多区域构件不全 / 位置不对，整体观感比 900 m 区域版差
- 地形与建筑贴合差（没有 landscape hole 数据），楼板被地形穿过
- 全图 5 m 地形 + 34 粗模 + 坝芯 = 125 MB，明显更重
- 坝芯全量烘焙里构件集合不完整（kit 缺失），不是坐标问题

**保留的结论**：

- `SM_POI16_PowerControl_2` 的真实变换与 `arcDamProps.json` 一致 → 构件共用同一个 prefab 原点，位置本来就是对的
- 拼接缺口来自 kit 不全 + landscape hole / 地形补丁未提取 + 部分法线朝内

---

## 九、这次改成全图默认

1. **统一世界坐标**：所有资产挂同一个 `OFFSET`，不再切模式
2. **构件补位**：`the-dam.glb`（8.2k 面）和 7 处近景的粗模在应用里隐藏，用 28 个构件 + 7 块近景顶上
3. **全部近景不裁件**：水处理厂 / 水培 / 红湖 / 水塔 / 控制塔用 `--tris=0` 重烘；Water Towers 的 272 m 偏差由此修正
4. **地面提到 3 m**：地形从 5 m 换成 3 m（739,600 顶点 / 1,411,200 面 / 35.9 MB），并继续做接缝焊接
5. **确定的第一帧**：启动直接 `snapFrame()`，避免大资源解析把 GSAP 入场动画卡在半路
6. **去掉区域/全图区分**：默认就是全图，代价是首次加载变慢

结果：

- 桌面包 43.2 MB，首次加载资源 138.8 MB
- 全图实际渲染 ≈ 347 万面
- 近景（7 处 + 坝区）用真实 actor 变换；其余 27 处是 25k 面粗模
- 老问题没变：没有 landscape hole，个别楼板被地形盖住

---

## 十、已知问题

1. 构件无贴图，统一混凝土灰；材质没有按 ID 区分
2. 部分坝体网格法线朝内 → 深色面
3. 没有 landscape visibility hole 数据：约 2%–31% 的建筑顶点低于地表，发电厂平台能看到草皮穿出
4. 坝芯 kit 不完整（缺闸墩、导轨、栏杆等），用 28 个精选构件近似
5. 27 处粗模仍是 25k 面预算，远处观感是骨架级；要更完整需要逐处重烘（体积会涨）
6. 水培 / 红湖用游戏 LOD：LOD0 体积 83.3 MB / 29.4 MB（实测），当前为控体积没上
7. `z = +UE y` 带来镜像，俯视屏幕上方是南
8. 3 m 地形仍是“高度图 + 顶点色”，没有游戏里的地表贴图 / 道路细节，近看会显得糊
9. 控制塔的 `SM_LightGeo_Cube_01` 是 31 m 实心盒，烘焙必须显式跳过

---

## 十一、下一步

1. **地表更近一步**：试 2 m 采样（约 1.6M 顶点 / 80 MB），或给地形加材质（草地 / 岩石分带），解决“糊成一团”
2. **粗模升级**：对剩余 27 处按重要性重烘（水塔 / 断桥 / 控制塔附近已做），`--tris=0`
3. 地形挖洞：探 `ULandscapeComponent` 的 WeightmapTextures / visibility layer，解决楼板穿模
4. 给模型加材质分组（混凝土 / 金属 / 屋顶）
5. 体积控制：meshopt / Draco 量化（138.8 MB → 40–50 MB）
6. 打包前跑一次 `build.ps1`
