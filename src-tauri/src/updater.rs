use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::Write;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, State, WebviewWindow};

const DEFAULT_REPO: &str = "lulu1hao/only-raiders";
const PRODUCT_NAME: &str = "only raiders";
const CN_MIRROR_PREFIX: &str = "https://ghfast.top/";
const MIN_EXE_BYTES: u64 = 1024 * 1024; // 1 MB
const MAX_EXE_BYTES: u64 = 350 * 1024 * 1024; // 350 MB

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterProgress {
    pub stage: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: u8,
    pub message: String,
    pub error: Option<String>,
}

impl Default for UpdaterProgress {
    fn default() -> Self {
        Self {
            stage: "idle".to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            percent: 0,
            message: String::new(),
            error: None,
        }
    }
}

pub struct UpdaterState {
    client: Client,
    progress: Arc<Mutex<UpdaterProgress>>,
    busy: Arc<AtomicBool>,
}

struct BusyGuard(Arc<AtomicBool>);

impl Drop for BusyGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub fn create_updater_state() -> UpdaterState {
    let client = Client::builder()
        .user_agent("only-raiders-updater/0.1")
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(600))
        .build()
        .unwrap_or_else(|_| Client::new());

    UpdaterState {
        client,
        progress: Arc::new(Mutex::new(UpdaterProgress::default())),
        busy: Arc::new(AtomicBool::new(false)),
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppVersionInfo {
    pub version: String,
    pub product_name: String,
    pub repo: String,
    pub exe_path: String,
    pub exe_dir: String,
    pub is_dev_build: bool,
    pub can_self_replace: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub tag_name: String,
    pub release_name: String,
    pub release_notes: String,
    pub published_at: String,
    pub html_url: String,
    pub has_update: bool,
    pub asset_name: Option<String>,
    pub asset_size: Option<u64>,
    pub download_url: Option<String>,
    pub direct_download_url: Option<String>,
    pub repo: String,
    pub mirror_used: bool,
}

#[derive(Debug, Deserialize)]
struct GitHubAsset {
    name: String,
    size: u64,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    tag_name: String,
    name: Option<String>,
    body: Option<String>,
    html_url: String,
    published_at: Option<String>,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    assets: Vec<GitHubAsset>,
}

#[derive(Debug, Eq, PartialEq)]
struct ParsedVersion {
    major: u64,
    minor: u64,
    patch: u64,
    prerelease: Option<String>,
}

fn parse_version(raw: &str) -> Option<ParsedVersion> {
    let trimmed = raw.trim();
    let no_prefix = trimmed
        .strip_prefix('v')
        .or_else(|| trimmed.strip_prefix('V'))
        .unwrap_or(trimmed);
    let no_build = no_prefix.split('+').next().unwrap_or(no_prefix);
    let mut pre_split = no_build.splitn(2, '-');
    let core = pre_split.next()?;
    let prerelease = pre_split
        .next()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string);

    let mut nums = core.split('.');
    let major = nums.next()?.parse::<u64>().ok()?;
    let minor = nums.next().unwrap_or("0").parse::<u64>().ok()?;
    let patch = nums.next().unwrap_or("0").parse::<u64>().ok()?;
    if nums.next().is_some() {
        return None;
    }

    Some(ParsedVersion {
        major,
        minor,
        patch,
        prerelease,
    })
}

fn is_newer_version(current_raw: &str, candidate_raw: &str) -> bool {
    match (parse_version(current_raw), parse_version(candidate_raw)) {
        (Some(cur), Some(cand)) => {
            let core_cur = (cur.major, cur.minor, cur.patch);
            let core_cand = (cand.major, cand.minor, cand.patch);
            if core_cand != core_cur {
                return core_cand > core_cur;
            }
            match (cur.prerelease, cand.prerelease) {
                (Some(_), None) => true,
                (None, Some(_)) => false,
                (Some(c_pre), Some(n_pre)) => n_pre > c_pre,
                (None, None) => false,
            }
        }
        _ => {
            let cur = current_raw.trim().trim_start_matches(['v', 'V']);
            let cand = candidate_raw.trim().trim_start_matches(['v', 'V']);
            !cand.is_empty() && cand != cur
        }
    }
}

fn authorize(window: &WebviewWindow) -> Result<(), String> {
    if !matches!(window.label(), "main" | "overlay") {
        return Err("仅允许从主窗口或悬浮窗执行更新操作".into());
    }
    Ok(())
}

fn validate_repo(custom_repo: Option<String>) -> Result<String, String> {
    let raw = custom_repo.unwrap_or_else(|| DEFAULT_REPO.to_string());
    let trimmed = raw.trim().to_string();
    let mut parts = trimmed.split('/');
    let owner = parts.next().unwrap_or_default();
    let repo = parts.next().unwrap_or_default();
    if parts.next().is_some() || owner.is_empty() || repo.is_empty() {
        return Err("GitHub 仓库格式无效，应为 owner/repo".into());
    }
    let valid_part = |s: &str| {
        !s.contains("..")
            && s.chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
    };
    if !valid_part(owner) || !valid_part(repo) {
        return Err("GitHub 仓库名包含非法字符".into());
    }
    Ok(format!("{owner}/{repo}"))
}

fn is_allowed_github_url(url: &str) -> bool {
    let allowed_prefixes = [
        "https://github.com/",
        "https://api.github.com/",
        "https://objects.githubusercontent.com/",
        "https://release-assets.githubusercontent.com/",
        "https://github-releases.githubusercontent.com/",
        "https://ghfast.top/https://github.com/",
        "https://ghfast.top/https://objects.githubusercontent.com/",
        "https://ghfast.top/https://release-assets.githubusercontent.com/",
        "https://ghfast.top/https://github-releases.githubusercontent.com/",
        "https://ghfast.top/https://api.github.com/",
    ];
    allowed_prefixes.iter().any(|prefix| url.starts_with(prefix))
}

fn apply_mirror(url: &str, use_mirror: bool) -> String {
    if !use_mirror {
        return url.to_string();
    }
    if url.starts_with(CN_MIRROR_PREFIX) {
        return url.to_string();
    }
    if url.starts_with("https://github.com/")
        || url.starts_with("https://objects.githubusercontent.com/")
        || url.starts_with("https://release-assets.githubusercontent.com/")
        || url.starts_with("https://github-releases.githubusercontent.com/")
        || url.starts_with("https://api.github.com/")
    {
        format!("{CN_MIRROR_PREFIX}{url}")
    } else {
        url.to_string()
    }
}

fn is_dev_executable(path: &Path) -> bool {
    if cfg!(debug_assertions) {
        return true;
    }
    let normalized = path.to_string_lossy().to_ascii_lowercase();
    normalized.contains("\\target\\debug\\") || normalized.contains("/target/debug/")
}

fn set_progress(state: &UpdaterState, next: UpdaterProgress) {
    if let Ok(mut guard) = state.progress.lock() {
        *guard = next;
    }
}

fn pick_best_asset(assets: &[GitHubAsset]) -> Option<&GitHubAsset> {
    let preferred = ["only raiders.exe", "only-raiders.exe", "only_raiders.exe"];
    for target in preferred {
        if let Some(found) = assets
            .iter()
            .find(|a| a.name.eq_ignore_ascii_case(target))
        {
            return Some(found);
        }
    }
    assets
        .iter()
        .find(|a| a.name.to_ascii_lowercase().ends_with(".exe"))
}

async fn fetch_latest_release(
    client: &Client,
    repo: &str,
    use_mirror: bool,
) -> Result<(GitHubRelease, bool), String> {
    let direct_api = format!("https://api.github.com/repos/{repo}/releases/latest");
    let mirror_api = format!("{CN_MIRROR_PREFIX}{direct_api}");

    let candidates: Vec<(&str, bool)> = if use_mirror {
        vec![(&mirror_api, true), (&direct_api, false)]
    } else {
        vec![(&direct_api, false)]
    };

    let mut last_error = String::new();
    for (endpoint, mirrored) in candidates {
        let resp = client
            .get(endpoint)
            .timeout(Duration::from_secs(20))
            .header("Accept", "application/vnd.github+json")
            .send()
            .await;

        match resp {
            Ok(res) => {
                let status = res.status();
                if status.as_u16() == 404 {
                    return Err(format!(
                        "仓库 {repo} 尚未发布任何 Release（或尚未创建 GitHub 仓库）"
                    ));
                }
                if !status.is_success() {
                    last_error = format!("GitHub API 返回状态码 {status}");
                    continue;
                }
                match res.json::<GitHubRelease>().await {
                    Ok(release) if !release.draft && !release.prerelease => {
                        return Ok((release, mirrored));
                    }
                    Ok(_) => {
                        last_error = "最新 Release 处于草稿或预发布状态".into();
                    }
                    Err(e) => {
                        last_error = format!("解析 Release 元数据失败：{e}");
                    }
                }
            }
            Err(e) => {
                last_error = format!("网络请求失败：{e}");
            }
        }
    }

    if last_error.is_empty() {
        last_error = "无法连接到 GitHub Release 服务".into();
    }
    Err(last_error)
}

#[tauri::command]
pub fn get_app_version_info(window: WebviewWindow) -> Result<AppVersionInfo, String> {
    authorize(&window)?;
    let exe_path = std::env::current_exe().map_err(|e| format!("读取当前程序路径失败：{e}"))?;
    let exe_dir = exe_path
        .parent()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let is_dev = is_dev_executable(&exe_path);

    Ok(AppVersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        product_name: PRODUCT_NAME.to_string(),
        repo: DEFAULT_REPO.to_string(),
        exe_path: exe_path.to_string_lossy().to_string(),
        exe_dir,
        is_dev_build: is_dev,
        can_self_replace: !is_dev && exe_path.parent().is_some(),
    })
}

#[tauri::command]
pub async fn check_app_update(
    window: WebviewWindow,
    state: State<'_, UpdaterState>,
    use_mirror: bool,
    custom_repo: Option<String>,
) -> Result<UpdateCheckResult, String> {
    authorize(&window)?;
    let repo = validate_repo(custom_repo)?;
    let current_version = env!("CARGO_PKG_VERSION").to_string();

    set_progress(
        &state,
        UpdaterProgress {
            stage: "checking".into(),
            message: format!("正在从 {repo} 检查最新版本..."),
            ..Default::default()
        },
    );

    match fetch_latest_release(&state.client, &repo, use_mirror).await {
        Ok((release, mirror_used)) => {
            let latest_version = release
                .tag_name
                .trim()
                .trim_start_matches(['v', 'V'])
                .to_string();
            let has_update = is_newer_version(&current_version, &release.tag_name);
            let best_asset = pick_best_asset(&release.assets);
            let direct_download_url = best_asset.map(|a| a.browser_download_url.clone());
            let download_url = direct_download_url
                .as_deref()
                .map(|u| apply_mirror(u, use_mirror));

            set_progress(
                &state,
                UpdaterProgress {
                    stage: "idle".into(),
                    message: if has_update {
                        format!("发现新版本 v{latest_version}")
                    } else {
                        format!("当前已是最新版本 v{current_version}")
                    },
                    ..Default::default()
                },
            );

            Ok(UpdateCheckResult {
                current_version,
                latest_version,
                tag_name: release.tag_name,
                release_name: release.name.unwrap_or_default(),
                release_notes: release.body.unwrap_or_default(),
                published_at: release.published_at.unwrap_or_default(),
                html_url: release.html_url,
                has_update,
                asset_name: best_asset.map(|a| a.name.clone()),
                asset_size: best_asset.map(|a| a.size),
                download_url,
                direct_download_url,
                repo,
                mirror_used,
            })
        }
        Err(err) => {
            set_progress(
                &state,
                UpdaterProgress {
                    stage: "error".into(),
                    message: "检查更新失败".into(),
                    error: Some(err.clone()),
                    ..Default::default()
                },
            );
            Err(err)
        }
    }
}

#[tauri::command]
pub fn get_update_progress(
    window: WebviewWindow,
    state: State<'_, UpdaterState>,
) -> Result<UpdaterProgress, String> {
    authorize(&window)?;
    let guard = state
        .progress
        .lock()
        .map_err(|_| "读取更新状态锁失败".to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub async fn download_and_install_update(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, UpdaterState>,
    download_url: String,
    expected_size: Option<u64>,
    use_mirror: bool,
) -> Result<(), String> {
    authorize(&window)?;

    if state
        .busy
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("已有更新任务正在进行中".into());
    }
    let _busy_guard = BusyGuard(Arc::clone(&state.busy));

    let current_exe =
        std::env::current_exe().map_err(|e| format!("无法获取当前程序路径：{e}"))?;
    if is_dev_executable(&current_exe) {
        return Err(
            "当前为开发调试模式，不能覆盖调试二进制；请使用构建后的 release\\only raiders.exe 或从 Release 页面手动下载。"
                .into(),
        );
    }

    let final_url = apply_mirror(download_url.trim(), use_mirror);
    if !is_allowed_github_url(&final_url) {
        return Err("拒绝从不受信任的下载地址更新".into());
    }

    let parent_dir = current_exe
        .parent()
        .ok_or_else(|| "无法解析当前程序所在目录".to_string())?;
    let exe_name = current_exe
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "无法解析当前可执行文件名".to_string())?;

    let staged_new = parent_dir.join(format!("{exe_name}.new"));
    let backup_old = parent_dir.join(format!("{exe_name}.old"));

    let _ = fs::remove_file(&staged_new);

    set_progress(
        &state,
        UpdaterProgress {
            stage: "downloading".into(),
            downloaded_bytes: 0,
            total_bytes: expected_size.unwrap_or(0),
            percent: 0,
            message: "正在连接下载服务器...".into(),
            error: None,
        },
    );

    let mut response = state
        .client
        .get(&final_url)
        .send()
        .await
        .map_err(|e| {
            let msg = format!("下载更新失败：{e}");
            set_progress(
                &state,
                UpdaterProgress {
                    stage: "error".into(),
                    message: msg.clone(),
                    error: Some(msg.clone()),
                    ..Default::default()
                },
            );
            msg
        })?;

    if !response.status().is_success() {
        let msg = format!("下载服务器返回异常状态码：{}", response.status());
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                message: msg.clone(),
                error: Some(msg.clone()),
                ..Default::default()
            },
        );
        return Err(msg);
    }

    let total_bytes = response
        .content_length()
        .or(expected_size)
        .unwrap_or(0);

    let mut file = File::create(&staged_new).map_err(|e| {
        let msg = format!(
            "无法在 {} 创建临时更新文件（请确认目录有写入权限，勿放在只读或受保护目录）：{e}",
            parent_dir.display()
        );
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                message: msg.clone(),
                error: Some(msg.clone()),
                ..Default::default()
            },
        );
        msg
    })?;

    let mut downloaded: u64 = 0;
    let mut header_checked = false;

    while let Some(chunk) = response.chunk().await.map_err(|e| {
        let _ = fs::remove_file(&staged_new);
        let msg = format!("下载数据流中断：{e}");
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                downloaded_bytes: downloaded,
                total_bytes,
                percent: if total_bytes > 0 {
                    ((downloaded.saturating_mul(100)) / total_bytes).min(100) as u8
                } else {
                    0
                },
                message: msg.clone(),
                error: Some(msg.clone()),
            },
        );
        msg
    })? {
        if !header_checked {
            if chunk.len() < 2 || &chunk[..2] != b"MZ" {
                let _ = fs::remove_file(&staged_new);
                let msg = "下载的文件不是有效的 Windows 可执行程序（可能是镜像或网络拦截页面）"
                    .to_string();
                set_progress(
                    &state,
                    UpdaterProgress {
                        stage: "error".into(),
                        message: msg.clone(),
                        error: Some(msg.clone()),
                        ..Default::default()
                    },
                );
                return Err(msg);
            }
            header_checked = true;
        }

        downloaded = downloaded.saturating_add(chunk.len() as u64);
        if downloaded > MAX_EXE_BYTES {
            let _ = fs::remove_file(&staged_new);
            let msg = "更新包体积超出安全上限，已中止下载".to_string();
            set_progress(
                &state,
                UpdaterProgress {
                    stage: "error".into(),
                    message: msg.clone(),
                    error: Some(msg.clone()),
                    ..Default::default()
                },
            );
            return Err(msg);
        }

        file.write_all(&chunk).map_err(|e| {
            let _ = fs::remove_file(&staged_new);
            let msg = format!("写入更新文件失败：{e}");
            set_progress(
                &state,
                UpdaterProgress {
                    stage: "error".into(),
                    message: msg.clone(),
                    error: Some(msg.clone()),
                    ..Default::default()
                },
            );
            msg
        })?;

        let percent = if total_bytes > 0 {
            ((downloaded.saturating_mul(100)) / total_bytes).min(99) as u8
        } else {
            0
        };
        set_progress(
            &state,
            UpdaterProgress {
                stage: "downloading".into(),
                downloaded_bytes: downloaded,
                total_bytes,
                percent,
                message: format!(
                    "正在下载更新... {:.1} MB{}",
                    downloaded as f64 / (1024.0 * 1024.0),
                    if total_bytes > 0 {
                        format!(" / {:.1} MB", total_bytes as f64 / (1024.0 * 1024.0))
                    } else {
                        String::new()
                    }
                ),
                error: None,
            },
        );
    }

    file.flush().and_then(|_| file.sync_all()).map_err(|e| {
        let _ = fs::remove_file(&staged_new);
        format!("落盘校验失败：{e}")
    })?;
    drop(file);

    set_progress(
        &state,
        UpdaterProgress {
            stage: "verifying".into(),
            downloaded_bytes: downloaded,
            total_bytes: total_bytes.max(downloaded),
            percent: 99,
            message: "正在校验新版本文件完整性...".into(),
            error: None,
        },
    );

    if downloaded < MIN_EXE_BYTES {
        let _ = fs::remove_file(&staged_new);
        let msg = "下载的文件过小，疑似不完整".to_string();
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                message: msg.clone(),
                error: Some(msg.clone()),
                ..Default::default()
            },
        );
        return Err(msg);
    }

    if let Some(expected) = expected_size.filter(|&s| s > 0) {
        if downloaded != expected {
            let _ = fs::remove_file(&staged_new);
            let msg = format!(
                "文件大小校验不一致（期望 {expected} 字节，实际 {downloaded} 字节），请重试"
            );
            set_progress(
                &state,
                UpdaterProgress {
                    stage: "error".into(),
                    message: msg.clone(),
                    error: Some(msg.clone()),
                    ..Default::default()
                },
            );
            return Err(msg);
        }
    }

    set_progress(
        &state,
        UpdaterProgress {
            stage: "replacing".into(),
            downloaded_bytes: downloaded,
            total_bytes: downloaded,
            percent: 100,
            message: "正在替换程序并准备重启...".into(),
            error: None,
        },
    );

    let _ = fs::remove_file(&backup_old);
    if let Err(e) = fs::rename(&current_exe, &backup_old) {
        let _ = fs::remove_file(&staged_new);
        let msg = format!("替换旧版本失败（文件可能被占用或无写入权限）：{e}");
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                message: msg.clone(),
                error: Some(msg.clone()),
                ..Default::default()
            },
        );
        return Err(msg);
    }

    if let Err(e) = fs::rename(&staged_new, &current_exe) {
        let _ = fs::rename(&backup_old, &current_exe);
        let _ = fs::remove_file(&staged_new);
        let msg = format!("写入新版本失败，已自动回滚：{e}");
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                message: msg.clone(),
                error: Some(msg.clone()),
                ..Default::default()
            },
        );
        return Err(msg);
    }

    set_progress(
        &state,
        UpdaterProgress {
            stage: "restarting".into(),
            downloaded_bytes: downloaded,
            total_bytes: downloaded,
            percent: 100,
            message: "更新成功，正在重启 only raiders...".into(),
            error: None,
        },
    );

    if let Err(e) = spawn_relaunch(&current_exe) {
        let msg = format!("新版本已替换就绪，但自动重启失败，请手动重新打开：{e}");
        set_progress(
            &state,
            UpdaterProgress {
                stage: "error".into(),
                message: msg.clone(),
                error: Some(msg.clone()),
                ..Default::default()
            },
        );
        return Err(msg);
    }

    let app_for_exit = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(280));
        app_for_exit.exit(0);
    });

    Ok(())
}

fn spawn_relaunch(exe_path: &Path) -> Result<(), String> {
    let mut cmd = std::process::Command::new(exe_path);
    if let Some(dir) = exe_path.parent() {
        cmd.current_dir(dir);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        cmd.creation_flags(DETACHED_PROCESS);
    }
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("启动新进程失败：{e}"))
}

#[tauri::command]
pub fn open_update_url(window: WebviewWindow, url: String) -> Result<(), String> {
    authorize(&window)?;
    let trimmed = url.trim();
    if !is_allowed_github_url(trimmed) {
        return Err("仅允许打开 GitHub 发布页面或下载链接".into());
    }
    open_in_browser(trimmed)
}

#[tauri::command]
pub fn open_exe_directory(window: WebviewWindow) -> Result<(), String> {
    authorize(&window)?;
    let exe_path = std::env::current_exe().map_err(|e| format!("无法获取程序路径：{e}"))?;
    let dir = exe_path
        .parent()
        .ok_or_else(|| "无法解析程序目录".to_string())?;
    #[cfg(windows)]
    {
        std::process::Command::new("explorer.exe")
            .arg(dir)
            .spawn()
            .map_err(|e| format!("打开文件夹失败：{e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = dir;
        Err("仅支持 Windows 打开目录".into())
    }
}

fn open_in_browser(url: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("rundll32.exe")
            .args(["url.dll,FileProtocolHandler", url])
            .spawn()
            .map_err(|e| format!("打开浏览器失败：{e}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        let _ = url;
        Err("当前平台不支持自动打开浏览器".into())
    }
}

pub fn cleanup_old_executable() {
    let Ok(current_exe) = std::env::current_exe() else {
        return;
    };
    let Some(parent) = current_exe.parent() else {
        return;
    };
    let Some(exe_name) = current_exe.file_name().and_then(|n| n.to_str()) else {
        return;
    };
    let old_path = parent.join(format!("{exe_name}.old"));
    let new_path = parent.join(format!("{exe_name}.new"));
    let _ = fs::remove_file(&new_path);

    if old_path.exists() {
        if fs::remove_file(&old_path).is_err() {
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(900));
                let _ = fs::remove_file(&old_path);
            });
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn semver_comparison_handles_v_prefix_and_prerelease() {
        assert!(is_newer_version("0.1.0", "v0.1.1"));
        assert!(is_newer_version("0.1.0", "0.2.0"));
        assert!(is_newer_version("0.1.0-beta.1", "0.1.0"));
        assert!(!is_newer_version("0.1.0", "0.1.0"));
        assert!(!is_newer_version("0.1.2", "v0.1.1"));
        assert!(!is_newer_version("0.2.0", "0.2.0-rc.1"));
    }

    #[test]
    fn repo_and_url_validation_reject_unsafe_inputs() {
        assert_eq!(validate_repo(None).unwrap(), "lulu1hao/only-raiders");
        assert!(validate_repo(Some("https://evil.com/x".into())).is_err());
        assert!(validate_repo(Some("../other/repo".into())).is_err());
        assert!(is_allowed_github_url(
            "https://ghfast.top/https://github.com/lulu1hao/only-raiders/releases/download/v0.1.1/only%20raiders.exe"
        ));
        assert!(!is_allowed_github_url("https://example.com/only-raiders.exe"));
    }
}
