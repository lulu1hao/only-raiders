# Only Raiders

ARC Raiders 战术辅助桌面应用（基于 Vue 3 + Vite + Tauri 2 构建，单文件便携可执行程序 `only raiders.exe`）。

## 主要功能

- **高精战术地图 & 雷达悬浮窗**：覆盖全地图精确资源点与已校准的精英 ARC 点位（`Alt+Q` 快速呼出/隐藏悬浮窗）。
- **任务与工坊材料联动**：追踪任务、工坊与远征所需材料，并关联对应地图位置。
- **内置在线更新**：启动时可自动后台检查 GitHub Releases（`lulu1hao/only-raiders`），支持国内镜像加速（`ghfast.top`）、下载进度显示及便携单文件原位替换重启。
- **游戏同步与音频台**：支持游戏同步辅助与桌面音频控制台工具。

## 本地开发与打包

### 安装依赖与启动开发模式

```powershell
npm install
npm run dev
```

### 构建便携单文件版（Windows）

项目根目录下提供一键打包脚本，会在执行前端构建后以离线 Cargo 模式编译并输出至 `release\only raiders.exe`：

```powershell
.\build.ps1
```

## 发布新版本与自动在线更新

1. 同步更新 [package.json](package.json)、[src-tauri/Cargo.toml](src-tauri/Cargo.toml) 与 [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json) 中的版本号（例如 `0.1.1`）。
2. 提交变更后创建并推送版本标签：

```powershell
git tag v0.1.1
git push origin main --tags
```

GitHub Actions 工作流 [.github/workflows/release.yml](.github/workflows/release.yml) 会自动编译 Windows 便携版并上传 `only raiders.exe` 到对应 Release，客户端即可一键检测并完成更新。
