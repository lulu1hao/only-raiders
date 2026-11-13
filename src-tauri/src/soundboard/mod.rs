mod audio;
mod decode;
mod folders;
pub mod help;

use audio::{EngineCommand, Shared, BROADCAST, OFF, PREVIEW};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{atomic::Ordering, mpsc, Arc, Mutex},
};
use tauri::{AppHandle, Manager, State, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
    pub output_device: String,
    pub mic_device: String,
    pub monitor_device: String,
    pub mic_enabled: bool,
    pub monitor_enabled: bool,
    pub music_volume: f32,
    pub mic_volume: f32,
    pub monitor_volume: f32,
    pub looping: bool,
    pub toggle_shortcut: String,
    pub stop_shortcut: String,
    pub mute_shortcut: String,
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            output_device: String::new(),
            mic_device: String::new(),
            monitor_device: String::new(),
            mic_enabled: false,
            monitor_enabled: false,
            music_volume: 0.5,
            mic_volume: 1.,
            monitor_volume: 0.5,
            looping: false,
            toggle_shortcut: "Ctrl+Alt+P".into(),
            stop_shortcut: "Ctrl+Alt+S".into(),
            mute_shortcut: "Ctrl+Alt+M".into(),
        }
    }
}
impl Settings {
    fn validate(&self) -> Result<(), String> {
        for value in [self.music_volume, self.mic_volume, self.monitor_volume] {
            if !value.is_finite() || !(0.0..=1.0).contains(&value) {
                return Err("音量必须在 0–100% 之间".into());
            }
        }
        Ok(())
    }
    fn same_devices(&self, other: &Self) -> bool {
        self.output_device == other.output_device
            && self.mic_device == other.mic_device
            && self.monitor_device == other.monitor_device
            && self.mic_enabled == other.mic_enabled
            && self.monitor_enabled == other.monitor_enabled
    }
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    id: String,
    name: String,
    path: PathBuf,
    favorite: bool,
    shortcut: String,
    // None means the file was imported by hand and is never touched by a rescan.
    #[serde(default)]
    source_folder: Option<PathBuf>,
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Library {
    tracks: Vec<Track>,
    // Folders watched as music libraries. Hidden paths stay out of the list on every rescan.
    folders: Vec<PathBuf>,
    hidden: Vec<PathBuf>,
    settings: Settings,
}
#[derive(Clone, PartialEq)]
struct Binding {
    shortcut: Shortcut,
    action: String,
    track_id: Option<String>,
}

// Hard ceiling shared by manual imports and scanned folders.
const MAX_TRACKS: usize = 1000;

pub struct SoundboardRuntime {
    shared: Arc<Shared>,
    tx: mpsc::Sender<EngineCommand>,
    library: Mutex<Library>,
    bindings: Mutex<HashMap<u32, Binding>>,
    write_gate: Mutex<()>,
    decode_gate: Mutex<()>,
    shortcut_error: Mutex<Option<String>>,
    path: PathBuf,
}
impl Drop for SoundboardRuntime {
    fn drop(&mut self) {
        let _ = self.tx.send(EngineCommand::Shutdown);
    }
}

pub fn setup(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let directory = app.path().app_data_dir()?;
    std::fs::create_dir_all(&directory)?;
    let path = directory.join("soundboard.json");
    if !path.exists() {
        if let Some(parent) = directory.parent() {
            let legacy_lulu = parent.join("com.lulu.desktop").join("soundboard.json");
            if legacy_lulu.is_file() {
                let _ = std::fs::copy(&legacy_lulu, &path);
            }
        }
    }
    let mut warning = None;
    let library = match std::fs::read(&path) {
        Ok(bytes) => match serde_json::from_slice::<Library>(&bytes) {
            Ok(library)
                if library.settings.validate().is_ok() && library.tracks.len() <= MAX_TRACKS =>
            {
                library
            }
            _ => {
                let backup = directory.join(format!("soundboard-corrupt-{}.json", timestamp()));
                std::fs::copy(&path, &backup)?;
                warning = Some(format!(
                    "音效台设置损坏，原文件已备份至 {}",
                    backup.display()
                ));
                Library::default()
            }
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Library::default(),
        Err(e) => return Err(e.into()),
    };
    let shared = Arc::new(Shared::default());
    shared.apply(&library.settings);
    *shared.error.lock().unwrap() = warning;
    let tx = audio::spawn(shared.clone());
    app.manage(SoundboardRuntime {
        shared,
        tx,
        library: Mutex::new(library),
        bindings: Mutex::new(HashMap::new()),
        write_gate: Mutex::new(()),
        decode_gate: Mutex::new(()),
        shortcut_error: Mutex::new(None),
        path,
    });
    let handle = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = handle.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let library = state.library.lock().unwrap().clone();
        if let Err(error) = commit(&handle, &state, library, false) {
            *state.shortcut_error.lock().unwrap() = Some(error);
        }
    });
    Ok(())
}
fn timestamp() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos()
}
fn authorize(window: &WebviewWindow) -> Result<(), String> {
    if !matches!(window.label(), "main" | "overlay") {
        return Err("音效台仅允许从主窗口或悬浮窗操作".into());
    }
    Ok(())
}
fn bindings(library: &Library) -> Result<HashMap<u32, Binding>, String> {
    let settings = &library.settings;
    let mut bindings = HashMap::new();
    let mut add = |text: &str, action: &str, track_id: Option<String>| -> Result<(), String> {
        if text.trim().is_empty() {
            return Ok(());
        }
        let shortcut: Shortcut = text
            .trim()
            .parse()
            .map_err(|e| format!("快捷键 {text} 无效：{e}"))?;
        if shortcut.mods.is_empty() {
            return Err("快捷键至少需要 Ctrl、Alt 或 Shift 等一个修饰键".into());
        }
        if bindings
            .insert(
                shortcut.id(),
                Binding {
                    shortcut,
                    action: action.into(),
                    track_id,
                },
            )
            .is_some()
        {
            return Err(format!("快捷键重复：{text}。每个操作需要不同的组合键。"));
        }
        Ok(())
    };
    add(&settings.toggle_shortcut, "toggle", None)?;
    add(&settings.stop_shortcut, "stop", None)?;
    add(&settings.mute_shortcut, "mute", None)?;
    for track in &library.tracks {
        add(&track.shortcut, "play", Some(track.id.clone()))?;
    }
    Ok(bindings)
}
// Called under write_gate. Register new keys before releasing old ones; on a
// conflict or disk failure preserve the previously working configuration.
fn commit(
    app: &AppHandle,
    state: &SoundboardRuntime,
    library: Library,
    save: bool,
) -> Result<(), String> {
    commit_with_shortcuts(
        state,
        library,
        save,
        |shortcut| {
            app.global_shortcut()
                .register(shortcut)
                .map_err(|e| e.to_string())
        },
        |shortcut| {
            let _ = app.global_shortcut().unregister(shortcut);
        },
    )
}

fn commit_with_shortcuts(
    state: &SoundboardRuntime,
    library: Library,
    save: bool,
    register: impl Fn(Shortcut) -> Result<(), String>,
    unregister: impl Fn(Shortcut),
) -> Result<(), String> {
    library.settings.validate()?;
    let next = bindings(&library)?;
    // Compare requested bindings, not only successfully registered keys. A
    // startup conflict must not prevent importing audio or saving volume/devices.
    let update_shortcuts = !save || next != bindings(&state.library.lock().unwrap())?;
    let previous = state.bindings.lock().unwrap().clone();
    let mut added = Vec::new();
    for (id, binding) in &next {
        if !update_shortcuts || previous.contains_key(id) {
            continue;
        }
        if let Err(e) = register(binding.shortcut) {
            for shortcut in added {
                unregister(shortcut);
            }
            return Err(format!(
                "快捷键 {} 注册失败，可能被其他软件占用：{e}",
                binding.shortcut
            ));
        }
        added.push(binding.shortcut);
    }
    if save {
        let result = (|| -> Result<(), String> {
            let bytes = serde_json::to_vec_pretty(&library).map_err(|e| e.to_string())?;
            let temporary = state.path.with_extension("json.tmp");
            std::fs::write(&temporary, bytes).map_err(|e| e.to_string())?;
            std::fs::rename(&temporary, &state.path).map_err(|e| e.to_string())
        })();
        if let Err(e) = result {
            for shortcut in added {
                unregister(shortcut);
            }
            return Err(format!("设置保存失败：{e}"));
        }
    }
    if update_shortcuts {
        *state.bindings.lock().unwrap() = next.clone();
        for (id, binding) in previous {
            if !next.contains_key(&id) {
                unregister(binding.shortcut);
            }
        }
        *state.shortcut_error.lock().unwrap() = None;
    }
    state.shared.apply(&library.settings);
    *state.library.lock().unwrap() = library;
    Ok(())
}
pub fn shortcut_handler(
    app: &AppHandle,
    shortcut: &Shortcut,
    event: tauri_plugin_global_shortcut::ShortcutEvent,
) {
    if event.state != ShortcutState::Pressed {
        return;
    }
    let Some(state) = app.try_state::<SoundboardRuntime>() else {
        return;
    };
    let binding = state.bindings.lock().unwrap().get(&shortcut.id()).cloned();
    if let Some(binding) = binding {
        let app = app.clone();
        tauri::async_runtime::spawn_blocking(move || {
            let state = app.state::<SoundboardRuntime>();
            if let Err(error) = control(&state, &binding.action, binding.track_id, None) {
                *state.shared.error.lock().unwrap() = Some(error);
            }
        });
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    mode: u8,
    playing: bool,
    loading: bool,
    track_id: Option<String>,
    position: f64,
    duration: f64,
    mic_muted: bool,
    music_peak: f32,
    mic_peak: f32,
    output_peak: f32,
    error: Option<String>,
    shortcut_error: Option<String>,
}
#[tauri::command]
pub fn soundboard_status(
    window: WebviewWindow,
    state: State<SoundboardRuntime>,
) -> Result<Status, String> {
    authorize(&window)?;
    let s = &state.shared;
    let (playing, loading, track_id, position, duration) = {
        let t = s.transport.lock().unwrap();
        let duration = t.clip.as_ref().map_or(0., |clip| clip.duration());
        let position = t
            .clip
            .as_ref()
            .map_or(0., |clip| (t.cursor / clip.rate as f64).min(duration));
        (t.playing, t.loading, t.track_id.clone(), position, duration)
    };
    Ok(Status {
        mode: s.mode.load(Ordering::Acquire),
        playing,
        loading,
        track_id,
        position,
        duration,
        mic_muted: s.mic_muted.load(Ordering::Relaxed),
        music_peak: audio::gain(&s.music_peak),
        mic_peak: audio::gain(&s.mic_peak),
        output_peak: audio::gain(&s.output_peak),
        error: s.error.lock().unwrap().clone(),
        shortcut_error: state.shortcut_error.lock().unwrap().clone(),
    })
}
#[tauri::command]
pub fn soundboard_library(
    window: WebviewWindow,
    state: State<SoundboardRuntime>,
) -> Result<Library, String> {
    authorize(&window)?;
    Ok(state.library.lock().unwrap().clone())
}
#[tauri::command]
pub async fn soundboard_devices(window: WebviewWindow) -> Result<audio::Devices, String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(audio::devices)
        .await
        .map_err(|e| e.to_string())?
}
fn disconnect(state: &SoundboardRuntime) -> Result<(), String> {
    let (reply, rx) = mpsc::channel();
    state
        .tx
        .send(EngineCommand::Disconnect(reply))
        .map_err(|e| e.to_string())?;
    rx.recv().map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn soundboard_configure(
    window: WebviewWindow,
    app: AppHandle,
    settings: Settings,
) -> Result<(), String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        let reconnect = !library.settings.same_devices(&settings);
        library.settings = settings;
        commit(&app, &state, library, true)?;
        if reconnect {
            disconnect(&state)?;
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn soundboard_levels(
    window: WebviewWindow,
    state: State<SoundboardRuntime>,
    music: f32,
    mic: f32,
    monitor: f32,
) -> Result<(), String> {
    authorize(&window)?;
    for value in [music, mic, monitor] {
        if !value.is_finite() || !(0.0..=1.0).contains(&value) {
            return Err("音量必须在 0–100% 之间".into());
        }
    }
    audio::set_gain(&state.shared.music_gain, music);
    audio::set_gain(&state.shared.mic_gain, mic);
    audio::set_gain(&state.shared.monitor_gain, monitor);
    Ok(())
}
#[derive(Serialize)]
pub struct ImportResult {
    added: usize,
    skipped: Vec<String>,
}
#[tauri::command]
pub async fn soundboard_import(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<ImportResult, String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(files) = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("导入音乐或音效")
            .add_filter("音频", &["mp3", "wav", "flac"])
            .blocking_pick_files()
        else {
            return Ok(ImportResult {
                added: 0,
                skipped: Vec::new(),
            });
        };
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        let mut result = ImportResult {
            added: 0,
            skipped: Vec::new(),
        };
        let base_timestamp = timestamp();
        for (index, file) in files.into_iter().enumerate() {
            let path = file.into_path().map_err(|e| e.to_string())?;
            let path = match path.canonicalize() {
                Ok(path) => path,
                Err(e) => {
                    result.skipped.push(e.to_string());
                    continue;
                }
            };
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            if library.tracks.iter().any(|t| t.path == path) {
                result.skipped.push(format!("{name}：已在音效库中"));
                continue;
            }
            let extension = path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_ascii_lowercase();
            if !["mp3", "wav", "flac"].contains(&extension.as_str()) || !path.is_file() {
                result.skipped.push(format!("{name}：不支持的文件类型"));
                continue;
            }
            if std::fs::metadata(&path).map_err(|e| e.to_string())?.len() > 256 * 1024 * 1024 {
                result.skipped.push(format!("{name}：超过 256 MB"));
                continue;
            }
            if library.tracks.len() >= MAX_TRACKS {
                result
                    .skipped
                    .push(format!("音效库最多保存 {MAX_TRACKS} 个文件"));
                break;
            }
            library.tracks.push(Track {
                id: format!("{}_{}", base_timestamp, index),
                name,
                path,
                favorite: false,
                shortcut: String::new(),
                source_folder: None,
            });
            result.added += 1;
        }
        if result.added > 0 {
            commit(&app, &state, library, true)?;
        }
        Ok(result)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn soundboard_update_track(
    window: WebviewWindow,
    app: AppHandle,
    id: String,
    name: String,
    favorite: bool,
    shortcut: String,
) -> Result<(), String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        if name.trim().is_empty() || name.chars().count() > 100 {
            return Err("名称需要 1–100 个字符".into());
        }
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        let track = library
            .tracks
            .iter_mut()
            .find(|t| t.id == id)
            .ok_or("音效不存在")?;
        track.name = name.trim().into();
        track.favorite = favorite;
        track.shortcut = shortcut.trim().into();
        commit(&app, &state, library, true)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn soundboard_remove_track(
    window: WebviewWindow,
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        let removed = library
            .tracks
            .iter()
            .find(|t| t.id == id)
            .map(|t| (t.path.clone(), t.source_folder.is_some()));
        library.tracks.retain(|t| t.id != id);
        // A folder entry is hidden, not deleted: the file stays and a rescan must not re-add it.
        if let Some((path, true)) = removed {
            if !library.hidden.contains(&path) {
                library.hidden.push(path);
            }
        }
        commit(&app, &state, library, true)?;
        let mut t = state.shared.transport.lock().unwrap();
        if t.track_id.as_deref() == Some(&id) {
            state.shared.generation.fetch_add(1, Ordering::AcqRel);
            *t = Default::default();
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}
// Music libraries are folders, not one-off file picks: the list follows the folder contents.
#[tauri::command]
pub async fn soundboard_add_folders(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<folders::ScanSummary, String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let Some(picked) = app
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("选择音乐库文件夹")
            .blocking_pick_folders()
        else {
            return Ok(folders::ScanSummary {
                cancelled: true,
                ..Default::default()
            });
        };
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        let mut changed = false;
        for folder in picked {
            let path = folder.into_path().map_err(|e| e.to_string())?;
            let Ok(path) = path.canonicalize() else {
                continue;
            };
            if !path.is_dir() || library.folders.contains(&path) {
                continue;
            }
            library.folders.push(path);
            changed = true;
        }
        if !changed {
            return Ok(folders::ScanSummary {
                folders: library.folders.len(),
                total: library.tracks.len(),
                ..Default::default()
            });
        }
        let scan = folders::scan(&library.folders, &library.hidden, MAX_TRACKS);
        let summary = folders::merge(&mut library, scan, MAX_TRACKS);
        commit(&app, &state, library, true)?;
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn soundboard_remove_folder(
    window: WebviewWindow,
    app: AppHandle,
    path: String,
) -> Result<folders::ScanSummary, String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        let target = PathBuf::from(path);
        if !library.folders.contains(&target) {
            return Err("该文件夹不在音乐库中，请刷新后重试".into());
        }
        library.folders.retain(|folder| folder != &target);
        let before = library.tracks.len();
        library
            .tracks
            .retain(|track| track.source_folder.as_deref() != Some(target.as_path()));
        library.hidden.retain(|hidden| !hidden.starts_with(&target));
        let summary = folders::ScanSummary {
            removed: before - library.tracks.len(),
            total: library.tracks.len(),
            folders: library.folders.len(),
            ..Default::default()
        };
        commit(&app, &state, library, true)?;
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn soundboard_rescan(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<folders::ScanSummary, String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        if library.folders.is_empty() {
            return Ok(folders::ScanSummary {
                total: library.tracks.len(),
                ..Default::default()
            });
        }
        let scan = folders::scan(&library.folders, &library.hidden, MAX_TRACKS);
        let summary = folders::merge(&mut library, scan, MAX_TRACKS);
        commit(&app, &state, library, true)?;
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub async fn soundboard_unhide_all(
    window: WebviewWindow,
    app: AppHandle,
) -> Result<folders::ScanSummary, String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<SoundboardRuntime>();
        let _gate = state.write_gate.lock().unwrap();
        let mut library = state.library.lock().unwrap().clone();
        library.hidden.clear();
        let scan = folders::scan(&library.folders, &library.hidden, MAX_TRACKS);
        let summary = folders::merge(&mut library, scan, MAX_TRACKS);
        commit(&app, &state, library, true)?;
        Ok(summary)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
pub fn soundboard_open_folder(
    window: WebviewWindow,
    state: State<SoundboardRuntime>,
    path: String,
) -> Result<(), String> {
    authorize(&window)?;
    // Only a folder the user added to the library can be opened; the frontend cannot pass anything else.
    let path = PathBuf::from(path);
    if !state.library.lock().unwrap().folders.contains(&path) {
        return Err("只能打开已加入音乐库的文件夹".into());
    }
    help::open_folder(&path)
}
fn play(state: &SoundboardRuntime, id: String) -> Result<(), String> {
    let s = &state.shared;
    if s.mode.load(Ordering::Acquire) == OFF || s.fault.load(Ordering::Acquire) {
        return Err("请先连接游戏发送或本地试听".into());
    }
    let path = state
        .library
        .lock()
        .unwrap()
        .tracks
        .iter()
        .find(|t| t.id == id)
        .map(|t| t.path.clone())
        .ok_or("音效不存在")?;
    let ticket;
    {
        let mut t = s.transport.lock().unwrap();
        ticket = s.generation.fetch_add(1, Ordering::AcqRel) + 1;
        if t.track_id.as_deref() == Some(&id) && t.clip.is_some() {
            t.cursor = 0.;
            t.playing = true;
            t.loading = false;
            return Ok(());
        }
        *t = audio::Transport {
            track_id: Some(id),
            loading: true,
            ..Default::default()
        };
    }
    *s.error.lock().unwrap() = None;
    // Serialize decoding to bound memory even under rapid hotkey presses.
    let _decode = state.decode_gate.lock().unwrap();
    if s.generation.load(Ordering::Acquire) != ticket {
        return Ok(());
    }
    let result = decode::decode_file(&path, &s.generation, ticket);
    let mut t = s.transport.lock().unwrap();
    if s.generation.load(Ordering::Acquire) != ticket {
        return Ok(());
    }
    t.loading = false;
    match result {
        Ok(clip) => {
            t.clip = Some(Arc::new(clip));
            t.playing = s.mode.load(Ordering::Acquire) != OFF && !s.fault.load(Ordering::Acquire);
            Ok(())
        }
        Err(error) => {
            *s.error.lock().unwrap() = Some(error.clone());
            Err(error)
        }
    }
}
fn control(
    state: &SoundboardRuntime,
    action: &str,
    id: Option<String>,
    value: Option<f64>,
) -> Result<(), String> {
    let s = &state.shared;
    match action {
        "play" => play(state, id.ok_or("请选择音效")?),
        "stop" => {
            s.stop();
            Ok(())
        }
        "mute" => {
            s.mic_muted.fetch_xor(true, Ordering::Relaxed);
            Ok(())
        }
        "clear_error" => {
            *s.error.lock().unwrap() = None;
            Ok(())
        }
        "toggle" => {
            let mut t = s.transport.lock().unwrap();
            if t.loading {
                s.generation.fetch_add(1, Ordering::AcqRel);
                t.loading = false;
                return Ok(());
            }
            if s.mode.load(Ordering::Acquire) == OFF {
                return Err("请先连接游戏发送或本地试听".into());
            }
            let clip = t.clip.as_ref().ok_or("请先从音效库选择音乐")?;
            if t.cursor >= clip.frames.len() as f64 {
                t.cursor = 0.;
            }
            t.playing = !t.playing;
            Ok(())
        }
        "seek" => {
            let value = value.filter(|v| v.is_finite()).ok_or("无效的播放位置")?;
            let mut t = s.transport.lock().unwrap();
            let clip = t.clip.as_ref().ok_or("尚未加载音乐")?;
            t.cursor = value.clamp(0., clip.duration()) * clip.rate as f64;
            Ok(())
        }
        "preview" | "broadcast" => {
            let _gate = state.write_gate.lock().unwrap();
            let settings = state.library.lock().unwrap().settings.clone();
            let (reply, rx) = mpsc::channel();
            state
                .tx
                .send(EngineCommand::Connect(
                    settings,
                    if action == "preview" {
                        PREVIEW
                    } else {
                        BROADCAST
                    },
                    reply,
                ))
                .map_err(|e| e.to_string())?;
            rx.recv().map_err(|e| e.to_string())?
        }
        "disconnect" => {
            let _gate = state.write_gate.lock().unwrap();
            disconnect(state)
        }
        _ => Err("未知的音效台操作".into()),
    }
}
#[tauri::command]
pub async fn soundboard_control(
    window: WebviewWindow,
    app: AppHandle,
    action: String,
    id: Option<String>,
    value: Option<f64>,
) -> Result<(), String> {
    authorize(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        control(&app.state::<SoundboardRuntime>(), &action, id, value)
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};

    fn test_runtime() -> SoundboardRuntime {
        let (tx, _) = mpsc::channel();
        SoundboardRuntime {
            shared: Arc::new(Shared::default()),
            tx,
            library: Mutex::new(Library::default()),
            bindings: Mutex::new(HashMap::new()),
            write_gate: Mutex::new(()),
            decode_gate: Mutex::new(()),
            shortcut_error: Mutex::new(None),
            path: std::env::temp_dir().join(format!("lulu-import-test-{}.json", timestamp())),
        }
    }

    #[test]
    fn startup_shortcut_conflict_does_not_block_library_or_audio_settings() {
        let state = test_runtime();
        let attempts = Cell::new(0);
        let released = RefCell::new(Vec::new());
        let error = commit_with_shortcuts(
            &state,
            Library::default(),
            false,
            |_: Shortcut| {
                attempts.set(attempts.get() + 1);
                if attempts.get() == 3 {
                    Err("HotKey already registered".into())
                } else {
                    Ok(())
                }
            },
            |key| released.borrow_mut().push(key),
        )
        .unwrap_err();
        assert_eq!(released.borrow().len(), 2);
        assert!(state.bindings.lock().unwrap().is_empty());
        *state.shortcut_error.lock().unwrap() = Some(error.clone());

        let mut library = state.library.lock().unwrap().clone();
        library.tracks.push(Track {
            id: "imported".into(),
            name: "音乐".into(),
            path: "音乐.wav".into(),
            favorite: false,
            shortcut: String::new(),
            source_folder: None,
        });
        commit_with_shortcuts(
            &state,
            library,
            true,
            |_| panic!("Import must not retry conflicting shortcuts"),
            |_| panic!("Import must not unregister shortcuts"),
        )
        .unwrap();
        let mut library = state.library.lock().unwrap().clone();
        library.tracks[0].name = "重新命名".into();
        library.tracks[0].favorite = true;
        library.settings.music_volume = 0.25;
        library.settings.monitor_device = "Headphones".into();
        commit_with_shortcuts(
            &state,
            library,
            true,
            |_| panic!("Metadata and audio settings must not retry shortcuts"),
            |_| panic!("Existing shortcuts must be retained"),
        )
        .unwrap();

        let saved: Library = serde_json::from_slice(&std::fs::read(&state.path).unwrap()).unwrap();
        assert_eq!(saved.tracks.len(), 1);
        assert_eq!(saved.tracks[0].name, "重新命名");
        assert!(saved.tracks[0].favorite);
        assert_eq!(saved.settings.monitor_device, "Headphones");
        assert_eq!(audio::gain(&state.shared.music_gain), 0.25);
        assert_eq!(*state.shortcut_error.lock().unwrap(), Some(error));
        assert!(state.bindings.lock().unwrap().is_empty());
        std::fs::remove_file(&state.path).unwrap();
    }

    #[test]
    fn changed_shortcut_conflict_preserves_saved_library_and_registered_keys() {
        let state = test_runtime();
        commit_with_shortcuts(&state, Library::default(), false, |_| Ok(()), |_| {}).unwrap();
        commit_with_shortcuts(&state, Library::default(), true, |_| Ok(()), |_| {}).unwrap();
        let original_file = std::fs::read(&state.path).unwrap();
        let original_bindings = state.bindings.lock().unwrap().clone();
        let mut library = state.library.lock().unwrap().clone();
        library.settings.stop_shortcut = "Ctrl+Alt+F8".into();
        library.settings.mute_shortcut = "Ctrl+Alt+F9".into();
        let attempts = Cell::new(0);
        let released = RefCell::new(Vec::new());
        assert!(commit_with_shortcuts(
            &state,
            library,
            true,
            |_| {
                attempts.set(attempts.get() + 1);
                if attempts.get() == 2 {
                    Err("occupied".into())
                } else {
                    Ok(())
                }
            },
            |key| released.borrow_mut().push(key),
        )
        .is_err());
        assert_eq!(released.borrow().len(), 1);
        assert!(!original_bindings.contains_key(&released.borrow()[0].id()));
        assert!(*state.bindings.lock().unwrap() == original_bindings);
        assert_eq!(state.library.lock().unwrap().settings, Settings::default());
        assert_eq!(std::fs::read(&state.path).unwrap(), original_file);
        std::fs::remove_file(&state.path).unwrap();
    }

    #[test]
    fn shortcuts_reject_alias_duplicates_and_plain_gameplay_keys() {
        let mut library = Library::default();
        assert_eq!(bindings(&library).unwrap().len(), 3);
        library.settings.stop_shortcut = "Control+Alt+P".into();
        assert!(bindings(&library).is_err());
        library.settings.stop_shortcut = "P".into();
        assert!(bindings(&library).is_err());
    }
    #[test]
    fn rejects_invalid_volume_and_detects_device_changes() {
        let mut settings = Settings::default();
        settings.music_volume = f32::NAN;
        assert!(settings.validate().is_err());
        settings.music_volume = 0.3;
        assert!(settings.same_devices(&Settings::default()));
        settings.mic_enabled = true;
        assert!(!settings.same_devices(&Settings::default()));
    }
    #[test]
    fn batch_import_ids_are_strictly_unique() {
        let base_timestamp = timestamp();
        let mut ids = std::collections::HashSet::new();
        for i in 0..100 {
            let id = format!("{}_{}", base_timestamp, i);
            assert!(ids.insert(id), "Duplicate track ID generated in batch import");
        }
        assert_eq!(ids.len(), 100);
    }
}
