mod api_bridge;
mod raider_sync;
mod soundboard;
mod updater;

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, PhysicalPosition, PhysicalSize,
    Position, Size, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent,
};

static IGNORE_CURSOR_APPLIED: AtomicBool = AtomicBool::new(false);

fn apply_ignore_cursor(win: &WebviewWindow, ignore: bool) {
    let _ = win.set_ignore_cursor_events(ignore);
    IGNORE_CURSOR_APPLIED.store(ignore, Ordering::SeqCst);
}

const OVERLAY_DEFAULT_W: f64 = 420.0;
const OVERLAY_DEFAULT_H: f64 = 660.0;
const OVERLAY_MINI_H: f64 = 48.0;
const OVERLAY_DRAWER_W: f64 = 286.0;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayStateDto {
    pub visible: bool,
    pub collapsed: bool,
    pub fullscreen: bool,
    pub click_through: bool,
    pub always_on_top: bool,
    pub opacity: f64,
    pub auto_minimize_main: bool,
    pub left_drawer_open: bool,
}

pub struct OverlayManager {
    pub visible: bool,
    pub collapsed: bool,
    pub fullscreen: bool,
    pub click_through: bool,
    pub always_on_top: bool,
    pub opacity: f64,
    pub auto_minimize_main: bool,
    pub left_drawer_open: bool,
    pub expanded_width: f64,
    pub expanded_height: f64,
    pub saved_pos: Option<(i32, i32)>,
}

impl Default for OverlayManager {
    fn default() -> Self {
        Self {
            visible: false,
            collapsed: false,
            fullscreen: false,
            click_through: false,
            always_on_top: true,
            opacity: 0.88,
            auto_minimize_main: true,
            left_drawer_open: false,
            expanded_width: OVERLAY_DEFAULT_W,
            expanded_height: OVERLAY_DEFAULT_H,
            saved_pos: None,
        }
    }
}

impl OverlayManager {
    pub fn to_dto(&self) -> OverlayStateDto {
        OverlayStateDto {
            visible: self.visible,
            collapsed: self.collapsed,
            fullscreen: self.fullscreen,
            click_through: self.click_through,
            always_on_top: self.always_on_top,
            opacity: self.opacity,
            auto_minimize_main: self.auto_minimize_main,
            left_drawer_open: self.left_drawer_open,
        }
    }
}

#[cfg(target_os = "windows")]
mod win32 {
    use std::ffi::c_void;

    pub const VK_SHIFT: i32 = 0x10;
    pub const VK_CONTROL: i32 = 0x11;
    pub const VK_MENU: i32 = 0x12; // Alt
    pub const VK_Q: i32 = 0x51;
    pub const VK_X: i32 = 0x58;
    pub const VK_M: i32 = 0x4D;
    pub const VK_F: i32 = 0x46;
    pub const VK_F9: i32 = 0x78;
    pub const VK_F10: i32 = 0x79;

    pub const SWP_NOZORDER: u32 = 0x0004;
    pub const SWP_NOACTIVATE: u32 = 0x0010;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    pub struct POINT {
        pub x: i32,
        pub y: i32,
    }

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    pub struct RECT {
        pub left: i32,
        pub top: i32,
        pub right: i32,
        pub bottom: i32,
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn GetAsyncKeyState(vkey: i32) -> i16;
        pub fn GetCursorPos(lp_point: *mut POINT) -> i32;
        pub fn GetWindowRect(hwnd: *mut c_void, lp_rect: *mut RECT) -> i32;
        pub fn SetWindowPos(
            hwnd: *mut c_void,
            hwnd_insert_after: *mut c_void,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            u_flags: u32,
        ) -> i32;
    }

    pub fn is_key_down(vkey: i32) -> bool {
        unsafe { (GetAsyncKeyState(vkey) as u16 & 0x8000) != 0 }
    }

    /// Atomically adjust a window's outer width by `delta_w_px` while keeping its right edge (`rect.right`)
    /// and its outer height (`rect.bottom - rect.top`) anchored at the exact same screen coordinates.
    /// Using outer-rect delta directly avoids Win32 `WS_THICKFRAME` client-vs-outer size shrinkage.
    pub fn adjust_width_anchored_right(hwnd_ptr: *mut c_void, delta_w_px: i32, min_outer_w_px: i32) {
        if hwnd_ptr.is_null() {
            return;
        }
        unsafe {
            let mut rect = RECT::default();
            if GetWindowRect(hwnd_ptr, &mut rect) != 0 {
                let cur_w = rect.right - rect.left;
                let cur_h = rect.bottom - rect.top;
                let new_w = (cur_w + delta_w_px).max(min_outer_w_px);
                let new_left = rect.right - new_w;
                let _ = SetWindowPos(
                    hwnd_ptr,
                    std::ptr::null_mut(),
                    new_left,
                    rect.top,
                    new_w,
                    cur_h,
                    SWP_NOZORDER | SWP_NOACTIVATE,
                );
            }
        }
    }

    /// Returns true if the mouse cursor is currently inside the interactive control header
    /// of the given `hwnd`. In normal window mode, this is the top `44px` titlebar;
    /// in fullscreen mode, this is the compact top-right control panel (`500x120` logical px).
    pub fn is_cursor_in_top_bar(
        hwnd_ptr: *mut c_void,
        bar_height_px: i32,
        right_width_px: Option<i32>,
    ) -> bool {
        if hwnd_ptr.is_null() {
            return false;
        }
        unsafe {
            let mut pt = POINT::default();
            let mut rect = RECT::default();
            if GetCursorPos(&mut pt) != 0 && GetWindowRect(hwnd_ptr, &mut rect) != 0 {
                let in_y = pt.y >= rect.top && pt.y <= (rect.top + bar_height_px);
                if !in_y {
                    return false;
                }
                if let Some(rw) = right_width_px {
                    return pt.x >= (rect.right - rw) && pt.x <= rect.right;
                }
                return pt.x >= rect.left && pt.x <= rect.right;
            }
        }
        false
    }
}

fn ensure_overlay_window(app: &AppHandle, state: &OverlayManager) -> Result<WebviewWindow, String> {
    if let Some(existing) = app.get_webview_window("overlay") {
        return Ok(existing);
    }

    let width = state.expanded_width;
    let height = if state.collapsed {
        OVERLAY_MINI_H
    } else {
        state.expanded_height
    };

    // Enable `.transparent(true)` so CSS background alpha controls ONLY the background surface,
    // keeping all foreground text and icons at 100% crisp opacity!
    let win = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .title("ARC Raiders · 战术悬浮窗")
        .inner_size(width, height)
        .min_inner_size(340.0, OVERLAY_MINI_H)
        .decorations(false)
        .transparent(true)
        .always_on_top(state.always_on_top)
        .resizable(!state.collapsed && !state.fullscreen)
        .focused(true)
        .visible(false)
        .build()
        .map_err(|e| format!("Failed to create overlay window: {e}"))?;

    // Position near top-right of the primary monitor
    if let Ok(Some(monitor)) = win.primary_monitor() {
        let scale = monitor.scale_factor();
        let PhysicalSize {
            width: mon_w,
            height: _,
        } = *monitor.size();
        let logical_mon_w = mon_w as f64 / scale;
        let x = (logical_mon_w - width - 28.0).max(20.0);
        let y = 42.0;
        let _ = win.set_position(Position::Logical(LogicalPosition { x, y }));
    }

    let app_for_ev = app.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = close_overlay_internal(&app_for_ev, true);
        }
    });

    Ok(win)
}

fn emit_overlay_state(app: &AppHandle, dto: &OverlayStateDto) {
    let _ = app.emit("overlay-state-changed", dto.clone());
    if let Ok(json) = serde_json::to_string(dto) {
        let js = format!("window.__ARC_ON_OVERLAY_STATE__ && window.__ARC_ON_OVERLAY_STATE__({json});");
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.eval(&js);
        }
        if let Some(ov_win) = app.get_webview_window("overlay") {
            let _ = ov_win.eval(&js);
        }
    }
}

fn open_overlay_internal(
    app: &AppHandle,
    minimize_main: Option<bool>,
    opacity_override: Option<f64>,
) -> Result<OverlayStateDto, String> {
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;

    if let Some(mm) = minimize_main {
        mgr.auto_minimize_main = mm;
    }
    if let Some(op) = opacity_override {
        mgr.opacity = op.clamp(0.10, 1.0);
    }

    let should_min_main = mgr.auto_minimize_main;
    let always_top = mgr.always_on_top;
    mgr.visible = true;
    mgr.click_through = false;
    let dto = mgr.to_dto();
    let mgr_snapshot = OverlayManager {
        visible: mgr.visible,
        collapsed: mgr.collapsed,
        fullscreen: mgr.fullscreen,
        click_through: mgr.click_through,
        always_on_top: mgr.always_on_top,
        opacity: mgr.opacity,
        auto_minimize_main: mgr.auto_minimize_main,
        left_drawer_open: mgr.left_drawer_open,
        expanded_width: mgr.expanded_width,
        expanded_height: mgr.expanded_height,
        saved_pos: mgr.saved_pos,
    };
    drop(mgr);

    let win = ensure_overlay_window(app, &mgr_snapshot)?;
    apply_ignore_cursor(&win, false);
    let _ = win.set_always_on_top(always_top);
    let _ = win.show();
    let _ = win.set_focus();

    if should_min_main {
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.minimize();
        }
    }

    emit_overlay_state(app, &dto);
    Ok(dto)
}

fn close_overlay_internal(app: &AppHandle, restore_main: bool) -> Result<OverlayStateDto, String> {
    let was_fs = {
        let mutex = app.state::<Mutex<OverlayManager>>();
        let mgr = mutex.lock().map_err(|e| e.to_string())?;
        mgr.fullscreen
    };
    if was_fs {
        let _ = set_fullscreen_internal(app, false);
    }

    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;
    mgr.visible = false;
    mgr.click_through = false;
    let dto = mgr.to_dto();
    drop(mgr);

    if let Some(win) = app.get_webview_window("overlay") {
        apply_ignore_cursor(&win, false);
        let _ = win.hide();
    }

    if restore_main {
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.unminimize();
            let _ = main_win.show();
            let _ = main_win.set_focus();
        }
    }

    emit_overlay_state(app, &dto);
    Ok(dto)
}

fn toggle_overlay_internal(app: &AppHandle, minimize_main: Option<bool>) -> Result<OverlayStateDto, String> {
    let is_vis = {
        let mutex = app.state::<Mutex<OverlayManager>>();
        let mgr = mutex.lock().map_err(|e| e.to_string())?;
        mgr.visible
    };
    if is_vis {
        close_overlay_internal(app, true)
    } else {
        open_overlay_internal(app, minimize_main, None)
    }
}

fn set_left_drawer_internal(app: &AppHandle, open: bool) -> Result<OverlayStateDto, String> {
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;

    if mgr.fullscreen || mgr.collapsed {
        mgr.left_drawer_open = false;
        let dto = mgr.to_dto();
        drop(mgr);
        return Ok(dto);
    }

    if mgr.left_drawer_open == open {
        let dto = mgr.to_dto();
        drop(mgr);
        return Ok(dto);
    }

    if let Some(win) = app.get_webview_window("overlay") {
        let scale = win.scale_factor().unwrap_or(1.0);
        let drawer_px = (OVERLAY_DRAWER_W * scale).round() as i32;
        let min_outer_w_px = (340.0 * scale).round() as i32;
        if open {
            if let Ok(phys_size) = win.inner_size() {
                let cur_lw = (phys_size.width as f64 / scale).max(360.0);
                let cur_lh = (phys_size.height as f64 / scale).max(440.0);
                mgr.expanded_width = cur_lw;
                mgr.expanded_height = cur_lh;
            }
            #[cfg(target_os = "windows")]
            if let Ok(hwnd) = win.hwnd() {
                win32::adjust_width_anchored_right(hwnd.0, drawer_px, min_outer_w_px);
            }
            mgr.left_drawer_open = true;
        } else {
            #[cfg(target_os = "windows")]
            if let Ok(hwnd) = win.hwnd() {
                win32::adjust_width_anchored_right(hwnd.0, -drawer_px, min_outer_w_px);
            }
            mgr.left_drawer_open = false;
        }
    } else {
        mgr.left_drawer_open = false;
    }

    let dto = mgr.to_dto();
    drop(mgr);
    emit_overlay_state(app, &dto);
    Ok(dto)
}

fn set_fullscreen_internal(app: &AppHandle, fullscreen: bool) -> Result<OverlayStateDto, String> {
    if fullscreen {
        let _ = set_left_drawer_internal(app, false);
    }
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("overlay") {
        if fullscreen && !mgr.fullscreen {
            // Save pre-fullscreen geometry if not currently collapsed
            if let Ok(pos) = win.outer_position() {
                mgr.saved_pos = Some((pos.x, pos.y));
            }
            if !mgr.collapsed {
                if let (Ok(phys_size), Ok(scale)) = (win.inner_size(), win.scale_factor()) {
                    let lw = phys_size.width as f64 / scale;
                    let lh = phys_size.height as f64 / scale;
                    if lw >= 320.0 && lh >= 200.0 {
                        mgr.expanded_width = lw;
                        mgr.expanded_height = lh;
                    }
                }
            }
            mgr.collapsed = false;
            mgr.fullscreen = true;

            // Expand to current monitor bounds (height - 1px keeps DWM transparent composition active)
            let monitor = win
                .current_monitor()
                .ok()
                .flatten()
                .or_else(|| win.primary_monitor().ok().flatten());
            if let Some(mon) = monitor {
                let mon_pos = *mon.position();
                let mon_size = *mon.size();
                let _ = win.set_resizable(false);
                let _ = win.set_position(Position::Physical(PhysicalPosition {
                    x: mon_pos.x,
                    y: mon_pos.y,
                }));
                let _ = win.set_size(Size::Physical(PhysicalSize {
                    width: mon_size.width,
                    height: mon_size.height.saturating_sub(1),
                }));
            }
        } else if !fullscreen && mgr.fullscreen {
            mgr.fullscreen = false;
            mgr.click_through = false;
            let target_w = mgr.expanded_width.max(360.0);
            let target_h = mgr.expanded_height.max(440.0);
            apply_ignore_cursor(&win, false);
            let _ = win.set_resizable(true);
            let _ = win.set_min_size(Some(Size::Logical(LogicalSize {
                width: 350.0,
                height: 420.0,
            })));
            let _ = win.set_size(Size::Logical(LogicalSize {
                width: target_w,
                height: target_h,
            }));
            if let Some((px, py)) = mgr.saved_pos {
                let _ = win.set_position(Position::Physical(PhysicalPosition { x: px, y: py }));
            }
            let _ = win.set_focus();
        }
    } else {
        mgr.fullscreen = fullscreen;
        if fullscreen {
            mgr.collapsed = false;
        } else {
            mgr.click_through = false;
        }
    }

    let dto = mgr.to_dto();
    drop(mgr);
    emit_overlay_state(app, &dto);
    Ok(dto)
}

fn set_collapsed_internal(app: &AppHandle, collapsed: bool) -> Result<OverlayStateDto, String> {
    if collapsed {
        let _ = set_left_drawer_internal(app, false);
    }
    // If currently in fullscreen mode, exit fullscreen first before collapsing
    let was_fs = {
        let mutex = app.state::<Mutex<OverlayManager>>();
        let mgr = mutex.lock().map_err(|e| e.to_string())?;
        mgr.fullscreen
    };
    if was_fs {
        let _ = set_fullscreen_internal(app, false);
    }

    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("overlay") {
        if !mgr.collapsed && !mgr.fullscreen {
            if let (Ok(phys_size), Ok(scale)) = (win.inner_size(), win.scale_factor()) {
                let lw = phys_size.width as f64 / scale;
                let lh = phys_size.height as f64 / scale;
                if lw >= 320.0 {
                    mgr.expanded_width = lw;
                }
                if lh > 160.0 {
                    mgr.expanded_height = lh;
                }
            }
        }

        mgr.collapsed = collapsed;
        let target_w = mgr.expanded_width;
        let target_h = if collapsed {
            OVERLAY_MINI_H
        } else {
            mgr.expanded_height.max(440.0)
        };

        if collapsed {
            let _ = win.set_resizable(false);
            let _ = win.set_min_size(Some(Size::Logical(LogicalSize {
                width: 320.0,
                height: OVERLAY_MINI_H,
            })));
            let _ = win.set_size(Size::Logical(LogicalSize {
                width: target_w,
                height: OVERLAY_MINI_H,
            }));
        } else {
            let _ = win.set_resizable(true);
            let _ = win.set_min_size(Some(Size::Logical(LogicalSize {
                width: 350.0,
                height: 420.0,
            })));
            let _ = win.set_size(Size::Logical(LogicalSize {
                width: target_w,
                height: target_h,
            }));
        }
    } else {
        mgr.collapsed = collapsed;
    }

    let dto = mgr.to_dto();
    drop(mgr);
    emit_overlay_state(app, &dto);
    Ok(dto)
}

fn set_click_through_internal(app: &AppHandle, click_through: bool) -> Result<OverlayStateDto, String> {
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;
    mgr.click_through = click_through;
    let dto = mgr.to_dto();
    drop(mgr);

    if let Some(win) = app.get_webview_window("overlay") {
        apply_ignore_cursor(&win, click_through);
        if !click_through {
            let _ = win.set_focus();
        }
    }

    emit_overlay_state(app, &dto);
    Ok(dto)
}

#[tauri::command]
async fn get_overlay_state(app: AppHandle) -> Result<OverlayStateDto, String> {
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mgr = mutex.lock().map_err(|e| e.to_string())?;
    Ok(mgr.to_dto())
}

#[tauri::command]
async fn open_overlay_window(
    app: AppHandle,
    minimize_main: Option<bool>,
    opacity: Option<f64>,
) -> Result<OverlayStateDto, String> {
    open_overlay_internal(&app, minimize_main, opacity)
}

#[tauri::command]
async fn close_overlay_window(
    app: AppHandle,
    restore_main: Option<bool>,
) -> Result<OverlayStateDto, String> {
    close_overlay_internal(&app, restore_main.unwrap_or(true))
}

#[tauri::command]
async fn toggle_overlay_window(
    app: AppHandle,
    minimize_main: Option<bool>,
) -> Result<OverlayStateDto, String> {
    toggle_overlay_internal(&app, minimize_main)
}

#[tauri::command]
async fn set_overlay_collapsed(app: AppHandle, collapsed: bool) -> Result<OverlayStateDto, String> {
    set_collapsed_internal(&app, collapsed)
}

#[tauri::command]
async fn set_overlay_fullscreen(app: AppHandle, fullscreen: bool) -> Result<OverlayStateDto, String> {
    set_fullscreen_internal(&app, fullscreen)
}

#[tauri::command]
async fn set_overlay_left_drawer(app: AppHandle, open: bool) -> Result<OverlayStateDto, String> {
    set_left_drawer_internal(&app, open)
}

#[tauri::command]
async fn set_overlay_click_through(
    app: AppHandle,
    click_through: bool,
) -> Result<OverlayStateDto, String> {
    set_click_through_internal(&app, click_through)
}

#[tauri::command]
async fn set_overlay_always_on_top(
    app: AppHandle,
    always_on_top: bool,
) -> Result<OverlayStateDto, String> {
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;
    mgr.always_on_top = always_on_top;
    let dto = mgr.to_dto();
    drop(mgr);

    if let Some(win) = app.get_webview_window("overlay") {
        let _ = win.set_always_on_top(always_on_top);
    }

    emit_overlay_state(&app, &dto);
    Ok(dto)
}

#[tauri::command]
async fn set_overlay_opacity(app: AppHandle, opacity: f64) -> Result<OverlayStateDto, String> {
    let clamped = opacity.clamp(0.10, 1.0);
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;
    mgr.opacity = clamped;
    let dto = mgr.to_dto();
    drop(mgr);

    emit_overlay_state(&app, &dto);
    Ok(dto)
}

#[tauri::command]
async fn set_overlay_auto_minimize(
    app: AppHandle,
    auto_minimize: bool,
) -> Result<OverlayStateDto, String> {
    let mutex = app.state::<Mutex<OverlayManager>>();
    let mut mgr = mutex.lock().map_err(|e| e.to_string())?;
    mgr.auto_minimize_main = auto_minimize;
    let dto = mgr.to_dto();
    drop(mgr);

    emit_overlay_state(&app, &dto);
    Ok(dto)
}

#[tauri::command]
async fn start_overlay_drag(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("overlay") {
        win.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn navigate_main_window(
    app: AppHandle,
    path: String,
    hide_overlay: Option<bool>,
) -> Result<(), String> {
    if hide_overlay.unwrap_or(false) {
        let _ = close_overlay_internal(&app, true);
    } else if let Some(main_win) = app.get_webview_window("main") {
        let _ = main_win.unminimize();
        let _ = main_win.show();
        let _ = main_win.set_focus();
    }
    let _ = app.emit("main-navigate", path.clone());
    if let Ok(path_json) = serde_json::to_string(&path) {
        if let Some(main_win) = app.get_webview_window("main") {
            let _ = main_win.eval(&format!(
                "window.__ARC_ON_MAIN_NAV__ && window.__ARC_ON_MAIN_NAV__({path_json});"
            ));
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn spawn_global_hotkey_listener(app: AppHandle) {
    std::thread::spawn(move || {
        let mut prev_toggle_vis = false;
        let mut prev_raw_lock = false;
        let mut prev_toggle_mini = false;
        let mut prev_toggle_fs = false;
        let mut is_vis_cached = false;

        loop {
            let sleep_ms = if is_vis_cached { 35 } else { 70 };
            std::thread::sleep(std::time::Duration::from_millis(sleep_ms));

            let alt = win32::is_key_down(win32::VK_MENU);
            let ctrl = win32::is_key_down(win32::VK_CONTROL);
            let shift = win32::is_key_down(win32::VK_SHIFT);
            let pure_alt = alt && !ctrl && !shift;
            let pure_fn = !alt && !ctrl && !shift;

            let q = win32::is_key_down(win32::VK_Q);
            let x = win32::is_key_down(win32::VK_X);
            let m = win32::is_key_down(win32::VK_M);
            let f = win32::is_key_down(win32::VK_F);
            let f9 = win32::is_key_down(win32::VK_F9);
            let f10 = win32::is_key_down(win32::VK_F10);

            let sync_busy = raider_sync::is_sync_active();
            let now_toggle_vis = (pure_alt && q) || (pure_fn && f9);
            let raw_lock_combo = (pure_alt && x) || (pure_fn && f10);
            let trigger_lock =
                raw_lock_combo && !prev_raw_lock && !(pure_fn && f10 && sync_busy);
            let now_toggle_mini = pure_alt && m;
            let now_toggle_fs = pure_alt && f;

            if now_toggle_vis && !prev_toggle_vis {
                let _ = toggle_overlay_internal(&app, None);
            }

            // Single lock acquisition per iteration for state snapshot
            let (vis, mut cur_lock, cur_collapsed, mut cur_fs) = {
                let mutex = app.state::<Mutex<OverlayManager>>();
                let snap = if let Ok(mgr) = mutex.lock() {
                    (mgr.visible, mgr.click_through, mgr.collapsed, mgr.fullscreen)
                } else {
                    (false, false, false, false)
                };
                snap
            };
            is_vis_cached = vis;

            if vis {
                if trigger_lock {
                    cur_lock = !cur_lock;
                    let _ = set_click_through_internal(&app, cur_lock);
                }
                if now_toggle_mini && !prev_toggle_mini {
                    let _ = set_collapsed_internal(&app, !cur_collapsed);
                }
                if now_toggle_fs && !prev_toggle_fs {
                    cur_fs = !cur_fs;
                    let _ = set_fullscreen_internal(&app, cur_fs);
                }

                // Smart Click-Through hit-testing synchronized with IGNORE_CURSOR_APPLIED atomic
                let last_ignore_cursor = IGNORE_CURSOR_APPLIED.load(Ordering::SeqCst);
                if cur_lock {
                    if let Some(win) = app.get_webview_window("overlay") {
                        let scale = win.scale_factor().unwrap_or(1.0);
                        let bar_logical = if cur_fs { 136.0 } else { 44.0 };
                        let bar_px = (bar_logical * scale).round() as i32;
                        let right_w_px = if cur_fs {
                            Some((500.0 * scale).round() as i32)
                        } else {
                            None
                        };
                        let in_top_bar = if let Ok(hwnd) = win.hwnd() {
                            win32::is_cursor_in_top_bar(hwnd.0, bar_px, right_w_px)
                        } else {
                            false
                        };
                        let should_ignore = !in_top_bar;
                        if should_ignore != last_ignore_cursor {
                            apply_ignore_cursor(&win, should_ignore);
                        }
                    }
                } else if last_ignore_cursor {
                    if let Some(win) = app.get_webview_window("overlay") {
                        apply_ignore_cursor(&win, false);
                    }
                }
            } else {
                IGNORE_CURSOR_APPLIED.store(false, Ordering::SeqCst);
            }

            prev_toggle_vis = now_toggle_vis;
            prev_raw_lock = raw_lock_combo;
            prev_toggle_mini = now_toggle_mini;
            prev_toggle_fs = now_toggle_fs;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(OverlayManager::default()))
        .manage(api_bridge::create_api_bridge_state())
        .manage(updater::create_updater_state())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(soundboard::shortcut_handler)
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();

            updater::cleanup_old_executable();
            soundboard::setup(&handle)?;

            // Lazy-create the overlay WebView2 window ONLY when the user first opens/toggles it,
            // saving ~150 MB of physical RAM and speeding up cold startup.

            if let Some(main_win) = app.get_webview_window("main") {
                let handle_for_main = handle.clone();
                main_win.on_window_event(move |event| {
                    if let WindowEvent::Destroyed = event {
                        if let Some(ov) = handle_for_main.get_webview_window("overlay") {
                            let _ = ov.destroy();
                        }
                    }
                });
            }

            #[cfg(target_os = "windows")]
            spawn_global_hotkey_listener(handle);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_overlay_state,
            open_overlay_window,
            close_overlay_window,
            toggle_overlay_window,
            set_overlay_collapsed,
            set_overlay_fullscreen,
            set_overlay_left_drawer,
            set_overlay_click_through,
            set_overlay_always_on_top,
            set_overlay_opacity,
            set_overlay_auto_minimize,
            start_overlay_drag,
            navigate_main_window,
            api_bridge::fetch_official_schedule,
            api_bridge::sync_arctracker_quests,
            api_bridge::start_arctracker_oauth,
            api_bridge::poll_arctracker_oauth,
            raider_sync::raider_find_game_window,
            raider_sync::raider_focus_game_window,
            raider_sync::raider_capture_client,
            raider_sync::raider_exec_input,
            raider_sync::raider_wait_safe,
            raider_sync::raider_abort_sync,
            raider_sync::raider_finish_sync,
            soundboard::soundboard_status,
            soundboard::soundboard_library,
            soundboard::soundboard_devices,
            soundboard::soundboard_configure,
            soundboard::soundboard_import,
            soundboard::soundboard_update_track,
            soundboard::soundboard_remove_track,
            soundboard::soundboard_add_folders,
            soundboard::soundboard_remove_folder,
            soundboard::soundboard_rescan,
            soundboard::soundboard_unhide_all,
            soundboard::soundboard_open_folder,
            soundboard::soundboard_control,
            soundboard::soundboard_levels,
            soundboard::help::soundboard_open_help,
            soundboard::help::soundboard_download_cable,
            updater::get_app_version_info,
            updater::check_app_update,
            updater::get_update_progress,
            updater::download_and_install_update,
            updater::open_update_url,
            updater::open_exe_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
