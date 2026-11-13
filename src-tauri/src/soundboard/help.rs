use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager};

// Official VB-Audio entry points. The current pack name is read from the official page first so a
// version bump does not break the button; the constant below is the fallback.
const CABLE_PAGE: &str = "https://vb-audio.com/Cable/";
const CABLE_FALLBACK: &str = "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip";
const CABLE_LIMIT: u64 = 64 * 1024 * 1024;

static LAST_PACK: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

fn last_pack() -> &'static Mutex<Option<PathBuf>> {
    LAST_PACK.get_or_init(|| Mutex::new(None))
}

// Only fixed help destinations are accepted; the frontend cannot launch arbitrary commands.
#[tauri::command]
pub fn soundboard_open_help(
    window: tauri::WebviewWindow,
    destination: String,
) -> Result<(), String> {
    super::authorize(&window)?;
    #[cfg(target_os = "windows")]
    {
        let mut command = match destination.as_str() {
            "driver" => {
                let mut c = std::process::Command::new("rundll32.exe");
                c.args(["url.dll,FileProtocolHandler", CABLE_PAGE]);
                c
            }
            "sound" => {
                let mut c = std::process::Command::new("control.exe");
                c.arg("mmsys.cpl");
                c
            }
            // The path never comes from the frontend: only the pack this app downloaded.
            "cable_folder" => {
                let path = last_pack()
                    .lock()
                    .unwrap()
                    .clone()
                    .ok_or("尚未下载安装包，请先点击「一键下载 VB-CABLE」。")?;
                let mut c = std::process::Command::new("explorer.exe");
                c.arg(select(&path));
                c
            }
            _ => return Err("未知的帮助入口".into()),
        };
        no_window(&mut command)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = destination;
        Err(format!("首版游戏音效台面向 Windows，请手动打开 {CABLE_PAGE}"))
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CableDownload {
    path: String,
    folder: String,
    bytes: u64,
    reused: bool,
    extracted: bool,
}

// Downloads the official VB-CABLE driver pack. The driver itself still needs an elevated install
// and a reboot, so this only fetches, unpacks and reveals the files.
#[tauri::command]
pub async fn soundboard_download_cable(
    window: tauri::WebviewWindow,
    app: AppHandle,
) -> Result<CableDownload, String> {
    super::authorize(&window)?;
    let directory = app
        .path()
        .download_dir()
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| format!("无法定位下载目录：{e}"))?;
    std::fs::create_dir_all(&directory).map_err(|e| format!("无法创建下载目录：{e}"))?;

    // A previous click may already have fetched the pack; never download it twice.
    if let Some(path) = existing_pack(&directory) {
        return Ok(finish(path, true));
    }

    let url = resolve_pack_url().await;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(20))
        .user_agent("LuluSoundboard/1.0 (VB-CABLE one click download)")
        .build()
        .map_err(|e| e.to_string())?;
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("无法连接下载服务器（{url}）：{e}"))?
        .error_for_status()
        .map_err(|e| format!("下载失败：{e}。可点击「打开官方下载页」手动下载。"))?;
    if response.content_length().is_some_and(|len| len > CABLE_LIMIT) {
        return Err("安装包体积异常，已中止下载".into());
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("下载中断：{e}"))?;
    if bytes.len() < 64 * 1024 || !bytes.starts_with(b"PK") {
        return Err("下载内容不是有效的安装包，可能被网络或代理拦截。请点击「打开官方下载页」手动下载。".into());
    }
    let path = directory.join(pack_name(&url));
    let temporary = path.with_extension("zip.part");
    let target = path.clone();
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        std::fs::write(&temporary, bytes).map_err(|e| format!("无法写入安装包：{e}"))?;
        std::fs::rename(&temporary, &target).map_err(|e| format!("无法保存安装包：{e}"))
    })
    .await
    .map_err(|e| e.to_string())??;
    Ok(finish(path, false))
}

// Unpacks best effort and opens the folder so the elevated installer is one double click away.
fn finish(zip: PathBuf, reused: bool) -> CableDownload {
    let (path, extracted) = unpack(&zip).unwrap_or((zip, false));
    *last_pack().lock().unwrap() = Some(path.clone());
    let folder = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| path.clone());
    reveal(&path);
    CableDownload {
        bytes: std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0),
        folder: folder.display().to_string(),
        path: path.display().to_string(),
        reused,
        extracted,
    }
}

fn existing_pack(directory: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(directory).ok()?;
    entries.flatten().map(|entry| entry.path()).find(|path| {
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase();
        name.starts_with("vbcable_driver_pack") && name.ends_with(".zip") && is_pack(path)
    })
}

fn is_pack(path: &Path) -> bool {
    use std::io::Read;
    let Ok(mut file) = std::fs::File::open(path) else {
        return false;
    };
    if file.metadata().map(|m| m.len() < 64 * 1024).unwrap_or(true) {
        return false;
    }
    let mut magic = [0u8; 2];
    file.read_exact(&mut magic).is_ok() && &magic == b"PK"
}

// Windows ships bsdtar as tar.exe, so the pack needs no zip dependency.
fn unpack(zip: &Path) -> Option<(PathBuf, bool)> {
    let folder = zip.parent()?.join("VB-CABLE");
    std::fs::create_dir_all(&folder).ok()?;
    let mut command = std::process::Command::new("tar.exe");
    command.args(["-xf"]).arg(zip).arg("-C").arg(&folder);
    let status = no_window(&mut command).status().ok()?;
    if !status.success() {
        return None;
    }
    let setup = std::fs::read_dir(&folder)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|s| s.to_str())
                .unwrap_or_default()
                .to_ascii_lowercase()
                .starts_with("vbcable_setup")
        })?;
    Some((setup, true))
}

fn reveal(path: &Path) {
    let mut command = std::process::Command::new("explorer.exe");
    command.arg(select(path));
    let _ = no_window(&mut command).spawn();
}

// Used by the soundboard module to open a library folder the runtime already validated.
pub(super) fn open_folder(path: &Path) -> Result<(), String> {
    let mut command = std::process::Command::new("explorer.exe");
    command.arg(path);
    no_window(&mut command)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("无法打开文件夹：{e}"))
}

fn select(path: &Path) -> String {
    format!("/select,{}", path.display())
}

#[cfg(target_os = "windows")]
fn no_window(command: &mut std::process::Command) -> &mut std::process::Command {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x08000000)
}
#[cfg(not(target_os = "windows"))]
fn no_window(command: &mut std::process::Command) -> &mut std::process::Command {
    command
}

async fn resolve_pack_url() -> String {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .connect_timeout(Duration::from_secs(6))
        .user_agent("LuluSoundboard/1.0 (VB-CABLE one click download)")
        .build()
    {
        Ok(client) => client,
        Err(_) => return CABLE_FALLBACK.into(),
    };
    let Ok(response) = client.get(CABLE_PAGE).send().await else {
        return CABLE_FALLBACK.into();
    };
    let Ok(body) = response.bytes().await else {
        return CABLE_FALLBACK.into();
    };
    match current_pack(&String::from_utf8_lossy(&body)) {
        Some(url) => url,
        None => CABLE_FALLBACK.into(),
    }
}

// Reads the pack link out of the official page: an absolute link when one is present, otherwise
// the file name is resolved against the official download host.
fn current_pack(html: &str) -> Option<String> {
    let start = html.find("VBCABLE_Driver_Pack")?;
    let tail = &html[start..];
    let end = tail
        .find(|c: char| !(c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-')))
        .unwrap_or(tail.len());
    let name = &tail[..end];
    if !name.ends_with(".zip") || name.len() > 64 {
        return None;
    }
    let head = &html[..start];
    if let Some(index) = head.rfind("http") {
        if start - index < 200 {
            let candidate = &html[index..start + end];
            if candidate.chars().all(|c| {
                c.is_ascii_alphanumeric() || matches!(c, ':' | '/' | '.' | '_' | '-' | '?' | '=')
            }) {
                return Some(candidate.to_string());
            }
        }
    }
    Some(format!("https://download.vb-audio.com/Download_CABLE/{name}"))
}

fn pack_name(url: &str) -> String {
    url.rsplit('/')
        .next()
        .filter(|name| {
            let name = name.to_ascii_lowercase();
            name.ends_with(".zip") && name.starts_with("vbcable")
        })
        .unwrap_or("VBCABLE_Driver_Pack.zip")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pack_link_comes_from_the_page_and_falls_back_to_the_official_host() {
        assert_eq!(
            current_pack(r#"<a href="VBCABLE_Driver_Pack43.zip">Download</a>"#).unwrap(),
            "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip"
        );
        assert_eq!(
            current_pack(
                r#"<a href="https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip">x</a>"#
            )
            .unwrap(),
            "https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip"
        );
        assert!(current_pack("<p>no pack here</p>").is_none());
        assert!(current_pack("VBCABLE_Driver_Packnotzip").is_none());
    }
    #[test]
    fn pack_name_is_always_a_local_zip_file_name() {
        assert_eq!(
            pack_name("https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack43.zip"),
            "VBCABLE_Driver_Pack43.zip"
        );
        assert_eq!(pack_name("https://example.com/evil/../../x.exe"), "VBCABLE_Driver_Pack.zip");
        assert_eq!(pack_name("https://example.com/"), "VBCABLE_Driver_Pack.zip");
    }
    #[test]
    fn reveal_targets_the_downloaded_file_and_missing_packs_are_rejected() {
        assert_eq!(
            select(Path::new("C:\\Users\\a\\Downloads\\VBCABLE_Driver_Pack43.zip")),
            "/select,C:\\Users\\a\\Downloads\\VBCABLE_Driver_Pack43.zip"
        );
        assert!(!is_pack(Path::new("C:\\lulu-no-such-VBCABLE_Driver_Pack43.zip")));
    }
}
