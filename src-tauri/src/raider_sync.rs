use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::ipc::Response;
use tauri::{AppHandle, Manager};

static ABORT_SYNC: AtomicBool = AtomicBool::new(false);
static SYNC_ACTIVE: AtomicBool = AtomicBool::new(false);
static LAST_SYNC_BEAT_MS: AtomicU64 = AtomicU64::new(0);
static LAST_CURSOR_POS: Mutex<Option<(i32, i32)>> = Mutex::new(None);

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn mark_sync_active() {
    SYNC_ACTIVE.store(true, Ordering::SeqCst);
    LAST_SYNC_BEAT_MS.store(now_epoch_ms(), Ordering::SeqCst);
}

fn clear_sync_active() {
    SYNC_ACTIVE.store(false, Ordering::SeqCst);
}

pub fn is_sync_active() -> bool {
    if !SYNC_ACTIVE.load(Ordering::SeqCst) {
        return false;
    }
    let last = LAST_SYNC_BEAT_MS.load(Ordering::SeqCst);
    now_epoch_ms().saturating_sub(last) < 15_000
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameWindowInfoDto {
    pub found: bool,
    pub hwnd: usize,
    pub title: String,
    pub process_name: String,
    pub client_x: i32,
    pub client_y: i32,
    pub client_width: i32,
    pub client_height: i32,
    pub is_foreground: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncActionResultDto {
    pub ok: bool,
    pub aborted: bool,
    pub reason: String,
}

#[cfg(target_os = "windows")]
mod imp {
    use super::*;
    use std::collections::HashMap;
    use std::ffi::c_void;

    const VK_ESCAPE: i32 = 0x1B;
    const VK_F10: i32 = 0x79;
    const VK_MENU: u8 = 0x12;
    const VK_LSHIFT: u8 = 0xA0;
    const SCANCODE_LSHIFT: u8 = 0x2A;

    const SW_RESTORE: i32 = 9;
    const PROCESS_QUERY_LIMITED_INFORMATION: u32 = 0x1000;
    const TH32CS_SNAPPROCESS: u32 = 0x00000002;
    const INVALID_HANDLE_VALUE: isize = -1;

    const SRCCOPY: u32 = 0x00CC0020;
    const HALFTONE: i32 = 4;
    const DIB_RGB_COLORS: u32 = 0;
    const BI_RGB: u32 = 0;
    const PW_CLIENTONLY: u32 = 0x00000001;
    const PW_RENDERFULLCONTENT: u32 = 0x00000002;

    const INPUT_MOUSE: u32 = 0;
    const MOUSEEVENTF_MOVE: u32 = 0x0001;
    const MOUSEEVENTF_LEFTDOWN: u32 = 0x0002;
    const MOUSEEVENTF_LEFTUP: u32 = 0x0004;
    const MOUSEEVENTF_WHEEL: u32 = 0x0800;
    const MOUSEEVENTF_VIRTUALDESK: u32 = 0x4000;
    const MOUSEEVENTF_ABSOLUTE: u32 = 0x8000;
    const WHEEL_DELTA: i32 = 120;
    const KEYEVENTF_EXTENDEDKEY: u32 = 0x0001;
    const KEYEVENTF_KEYUP: u32 = 0x0002;

    const SM_XVIRTUALSCREEN: i32 = 76;
    const SM_YVIRTUALSCREEN: i32 = 77;
    const SM_CXVIRTUALSCREEN: i32 = 78;
    const SM_CYVIRTUALSCREEN: i32 = 79;

    const WDA_NONE: u32 = 0x00000000;
    const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TOPMOST: isize = 0x00000008;
    const WS_EX_LAYERED: isize = 0x00080000;
    const WS_EX_TRANSPARENT: isize = 0x00000020;

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct POINT {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    #[derive(Default, Clone, Copy)]
    struct RECT {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct BITMAPINFOHEADER {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct BITMAPINFO {
        bmi_header: BITMAPINFOHEADER,
        bmi_colors: [u32; 1],
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct MOUSEINPUT {
        dx: i32,
        dy: i32,
        mouse_data: u32,
        dw_flags: u32,
        time: u32,
        dw_extra_info: usize,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct INPUT {
        type_: u32,
        mi: MOUSEINPUT,
    }

    #[cfg(target_arch = "x86_64")]
    const _: () = assert!(std::mem::size_of::<INPUT>() == 40);

    #[repr(C)]
    #[derive(Clone, Copy)]
    #[allow(dead_code)]
    struct PROCESSENTRY32W {
        dw_size: u32,
        cnt_usage: u32,
        th32_process_id: u32,
        th32_default_heap_id: usize,
        th32_module_id: u32,
        cnt_threads: u32,
        th32_parent_process_id: u32,
        pc_pri_class_base: i32,
        dw_flags: u32,
        sz_exe_file: [u16; 260],
    }

    #[cfg(target_arch = "x86_64")]
    const _: () = assert!(std::mem::size_of::<PROCESSENTRY32W>() == 568);

    type WndEnumProc = unsafe extern "system" fn(*mut c_void, isize) -> i32;

    #[link(name = "user32")]
    extern "system" {
        fn EnumWindows(lp_enum_func: WndEnumProc, l_param: isize) -> i32;
        fn IsWindow(hwnd: *mut c_void) -> i32;
        fn IsWindowVisible(hwnd: *mut c_void) -> i32;
        fn IsIconic(hwnd: *mut c_void) -> i32;
        fn ShowWindow(hwnd: *mut c_void, n_cmd_show: i32) -> i32;
        fn GetForegroundWindow() -> *mut c_void;
        fn SetForegroundWindow(hwnd: *mut c_void) -> i32;
        fn BringWindowToTop(hwnd: *mut c_void) -> i32;
        fn GetWindowTextW(hwnd: *mut c_void, lp_string: *mut u16, n_max_count: i32) -> i32;
        fn GetClassNameW(hwnd: *mut c_void, lp_class_name: *mut u16, n_max_count: i32) -> i32;
        fn GetClientRect(hwnd: *mut c_void, lp_rect: *mut RECT) -> i32;
        fn ClientToScreen(hwnd: *mut c_void, lp_point: *mut POINT) -> i32;
        fn GetWindowThreadProcessId(hwnd: *mut c_void, lpdw_process_id: *mut u32) -> u32;
        fn GetDC(hwnd: *mut c_void) -> *mut c_void;
        fn ReleaseDC(hwnd: *mut c_void, hdc: *mut c_void) -> i32;
        fn PrintWindow(hwnd: *mut c_void, hdc_blt: *mut c_void, n_flags: u32) -> i32;
        fn GetCursorPos(lp_point: *mut POINT) -> i32;
        fn SetCursorPos(x: i32, y: i32) -> i32;
        fn GetSystemMetrics(n_index: i32) -> i32;
        fn GetAsyncKeyState(vkey: i32) -> i16;
        fn SendInput(c_inputs: u32, p_inputs: *const INPUT, cb_size: i32) -> u32;
        fn keybd_event(b_vk: u8, b_scan: u8, dw_flags: u32, dw_extra_info: usize);
        fn GetWindowDisplayAffinity(hwnd: *mut c_void, pdw_affinity: *mut u32) -> i32;
        fn SetWindowDisplayAffinity(hwnd: *mut c_void, dw_affinity: u32) -> i32;
        fn GetWindowLongPtrW(hwnd: *mut c_void, n_index: i32) -> isize;
        fn SetWindowLongPtrW(hwnd: *mut c_void, n_index: i32, dw_new_long: isize) -> isize;
    }

    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmFlush() -> i32;
    }

    #[link(name = "gdi32")]
    extern "system" {
        fn CreateCompatibleDC(hdc: *mut c_void) -> *mut c_void;
        fn DeleteDC(hdc: *mut c_void) -> i32;
        fn SelectObject(hdc: *mut c_void, h: *mut c_void) -> *mut c_void;
        fn DeleteObject(ho: *mut c_void) -> i32;
        fn CreateDIBSection(
            hdc: *mut c_void,
            pbmi: *const BITMAPINFO,
            usage: u32,
            ppv_bits: *mut *mut u8,
            h_section: *mut c_void,
            offset: u32,
        ) -> *mut c_void;
        fn BitBlt(
            hdc: *mut c_void,
            x: i32,
            y: i32,
            cx: i32,
            cy: i32,
            hdc_src: *mut c_void,
            x1: i32,
            y1: i32,
            rop: u32,
        ) -> i32;
        fn StretchBlt(
            hdc_dest: *mut c_void,
            x_dest: i32,
            y_dest: i32,
            w_dest: i32,
            h_dest: i32,
            hdc_src: *mut c_void,
            x_src: i32,
            y_src: i32,
            w_src: i32,
            h_src: i32,
            rop: u32,
        ) -> i32;
        fn SetStretchBltMode(hdc: *mut c_void, mode: i32) -> i32;
        fn SetBrushOrgEx(hdc: *mut c_void, x: i32, y: i32, lppt: *mut POINT) -> i32;
    }

    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(dw_desired_access: u32, b_inherit_handle: i32, dw_process_id: u32) -> *mut c_void;
        fn CloseHandle(h_object: *mut c_void) -> i32;
        fn QueryFullProcessImageNameW(
            h_process: *mut c_void,
            dw_flags: u32,
            lp_exe_name: *mut u16,
            lpdw_size: *mut u32,
        ) -> i32;
        fn CreateToolhelp32Snapshot(dw_flags: u32, th32_process_id: u32) -> *mut c_void;
        fn Process32FirstW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
        fn Process32NextW(h_snapshot: *mut c_void, lppe: *mut PROCESSENTRY32W) -> i32;
    }

    fn is_vkey_down(vk: i32) -> bool {
        unsafe { (GetAsyncKeyState(vk) as u16 & 0x8000) != 0 }
    }

    fn send_mouse_flag(flag: u32) {
        let inp = INPUT {
            type_: INPUT_MOUSE,
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouse_data: 0,
                dw_flags: flag,
                time: 0,
                dw_extra_info: 0,
            },
        };
        unsafe {
            let _ = SendInput(1, &inp, std::mem::size_of::<INPUT>() as i32);
        }
    }

    fn send_mouse_wheel(delta: i32) {
        let inp = INPUT {
            type_: INPUT_MOUSE,
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouse_data: delta as u32,
                dw_flags: MOUSEEVENTF_WHEEL,
                time: 0,
                dw_extra_info: 0,
            },
        };
        unsafe {
            let _ = SendInput(1, &inp, std::mem::size_of::<INPUT>() as i32);
        }
    }

    /// 移动系统光标并同步注入 Win32 绝对坐标 MOUSEEVENTF_MOVE 事件，
    /// 确保 Unreal Engine 5 Slate (FSlateApplication::ProcessMouseMoveEvent) 实时更新悬停控件与拖拽状态。
    fn move_cursor_input(x: i32, y: i32) -> (i32, i32) {
        let mut actual_x = x;
        let mut actual_y = y;
        unsafe {
            let _ = SetCursorPos(x, y);

            let vx = GetSystemMetrics(SM_XVIRTUALSCREEN);
            let vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
            let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN).max(1);
            let vh = GetSystemMetrics(SM_CYVIRTUALSCREEN).max(1);
            let abs_x = (((x - vx) as i64 * 65536 + 32768) / vw as i64).clamp(0, 65535) as i32;
            let abs_y = (((y - vy) as i64 * 65536 + 32768) / vh as i64).clamp(0, 65535) as i32;

            let inp = INPUT {
                type_: INPUT_MOUSE,
                mi: MOUSEINPUT {
                    dx: abs_x,
                    dy: abs_y,
                    mouse_data: 0,
                    dw_flags: MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK,
                    time: 0,
                    dw_extra_info: 0,
                },
            };
            let _ = SendInput(1, &inp, std::mem::size_of::<INPUT>() as i32);

            let mut cur = POINT::default();
            if GetCursorPos(&mut cur) != 0 {
                actual_x = cur.x;
                actual_y = cur.y;
            }
        }
        if let Ok(mut g) = LAST_CURSOR_POS.lock() {
            *g = Some((actual_x, actual_y));
        }
        (actual_x, actual_y)
    }

    struct LeftButtonReleaseGuard {
        pressed: bool,
    }

    impl LeftButtonReleaseGuard {
        fn press() -> Self {
            send_mouse_flag(MOUSEEVENTF_LEFTDOWN);
            Self { pressed: true }
        }

        fn release(&mut self) {
            if self.pressed {
                send_mouse_flag(MOUSEEVENTF_LEFTUP);
                self.pressed = false;
            }
        }
    }

    impl Drop for LeftButtonReleaseGuard {
        fn drop(&mut self) {
            if self.pressed {
                send_mouse_flag(MOUSEEVENTF_LEFTUP);
                self.pressed = false;
            }
        }
    }

    struct ShiftKeyReleaseGuard {
        pressed: bool,
    }

    impl ShiftKeyReleaseGuard {
        fn press() -> Self {
            unsafe {
                keybd_event(VK_LSHIFT, SCANCODE_LSHIFT, 0, 0);
            }
            Self { pressed: true }
        }

        fn release(&mut self) {
            if self.pressed {
                unsafe {
                    keybd_event(VK_LSHIFT, SCANCODE_LSHIFT, KEYEVENTF_KEYUP, 0);
                }
                self.pressed = false;
            }
        }
    }

    impl Drop for ShiftKeyReleaseGuard {
        fn drop(&mut self) {
            if self.pressed {
                unsafe {
                    keybd_event(VK_LSHIFT, SCANCODE_LSHIFT, KEYEVENTF_KEYUP, 0);
                }
                self.pressed = false;
            }
        }
    }

    /// 截屏时临时将本软件窗口（主窗口 + 悬浮窗）设为 WDA_EXCLUDEFROMCAPTURE，
    /// 确保桌面 DWM 合成抓取 100% 穿透本软件窗口无遮挡、零闪烁，完美兼容 DX12 Flip-Model 游戏窗口。
    struct ExcludeCaptureGuard {
        entries: Vec<(*mut c_void, u32)>,
        all_excluded: bool,
    }

    impl ExcludeCaptureGuard {
        fn enter_many(hwnd_nums: &[usize]) -> Self {
            let mut entries = Vec::new();
            let mut any_changed = false;
            let mut all_excluded = true;

            unsafe {
                for &num in hwnd_nums {
                    if num == 0 {
                        continue;
                    }
                    let hwnd = num as *mut c_void;
                    if IsWindow(hwnd) == 0 || IsWindowVisible(hwnd) == 0 || IsIconic(hwnd) != 0 {
                        continue;
                    }
                    let mut prev = WDA_NONE;
                    let _ = GetWindowDisplayAffinity(hwnd, &mut prev);
                    if prev == WDA_EXCLUDEFROMCAPTURE {
                        continue;
                    }
                    if SetWindowDisplayAffinity(hwnd, WDA_EXCLUDEFROMCAPTURE) != 0 {
                        entries.push((hwnd, prev));
                        any_changed = true;
                    } else {
                        all_excluded = false;
                    }
                }
                if any_changed {
                    // 双重 DwmFlush 确保双缓冲桌面合成帧已彻底剔除本软件遮挡窗口
                    let _ = DwmFlush();
                    let _ = DwmFlush();
                }
            }

            Self {
                entries,
                all_excluded,
            }
        }

        fn enter(overlay_hwnd_num: usize) -> Self {
            Self::enter_many(&[overlay_hwnd_num])
        }
    }

    impl Drop for ExcludeCaptureGuard {
        fn drop(&mut self) {
            for &(hwnd, prev) in self.entries.iter().rev() {
                if !hwnd.is_null() {
                    unsafe {
                        let _ = SetWindowDisplayAffinity(hwnd, prev);
                    }
                }
            }
        }
    }

    /// 发送键鼠点击/长按期间临时开启悬浮窗 WS_EX_TRANSPARENT 鼠标穿透，防止悬浮窗拦截点击或抢夺焦点
    struct OverlayPassThroughGuard {
        hwnd: *mut c_void,
        prev_ex: isize,
        changed: bool,
    }

    impl OverlayPassThroughGuard {
        fn enter(overlay_hwnd_num: usize) -> Self {
            let hwnd = overlay_hwnd_num as *mut c_void;
            if hwnd.is_null() {
                return Self {
                    hwnd,
                    prev_ex: 0,
                    changed: false,
                };
            }
            unsafe {
                if IsWindow(hwnd) == 0 || IsWindowVisible(hwnd) == 0 {
                    return Self {
                        hwnd,
                        prev_ex: 0,
                        changed: false,
                    };
                }
                let prev_ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
                if (prev_ex & WS_EX_TRANSPARENT) != 0 {
                    return Self {
                        hwnd,
                        prev_ex,
                        changed: false,
                    };
                }
                let _ = SetWindowLongPtrW(
                    hwnd,
                    GWL_EXSTYLE,
                    prev_ex | WS_EX_LAYERED | WS_EX_TRANSPARENT,
                );
                Self {
                    hwnd,
                    prev_ex,
                    changed: true,
                }
            }
        }
    }

    impl Drop for OverlayPassThroughGuard {
        fn drop(&mut self) {
            if self.changed && !self.hwnd.is_null() {
                unsafe {
                    let _ = SetWindowLongPtrW(self.hwnd, GWL_EXSTYLE, self.prev_ex);
                }
            }
        }
    }

    fn query_process_basename(pid: u32) -> String {
        if pid == 0 {
            return String::new();
        }
        unsafe {
            let h_proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
            if h_proc.is_null() {
                return String::new();
            }
            let mut buf = [0u16; 520];
            let mut sz = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(h_proc, 0, buf.as_mut_ptr(), &mut sz);
            let _ = CloseHandle(h_proc);
            if ok == 0 || sz == 0 {
                return String::new();
            }
            let full = String::from_utf16_lossy(&buf[..sz as usize]);
            full.rsplit(['\\', '/']).next().unwrap_or("").to_string()
        }
    }

    fn query_window_title(hwnd: *mut c_void) -> String {
        unsafe {
            let mut buf = [0u16; 256];
            let n = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if n <= 0 {
                String::new()
            } else {
                String::from_utf16_lossy(&buf[..n as usize])
            }
        }
    }

    fn query_window_class(hwnd: *mut c_void) -> String {
        unsafe {
            let mut buf = [0u16; 128];
            let n = GetClassNameW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
            if n <= 0 {
                String::new()
            } else {
                String::from_utf16_lossy(&buf[..n as usize])
            }
        }
    }

    fn query_client_screen_bounds(hwnd: *mut c_void) -> Option<(i32, i32, i32, i32)> {
        unsafe {
            let mut rc = RECT::default();
            if GetClientRect(hwnd, &mut rc) == 0 {
                return None;
            }
            let w = rc.right - rc.left;
            let h = rc.bottom - rc.top;
            if w <= 0 || h <= 0 {
                return None;
            }
            let mut pt = POINT { x: 0, y: 0 };
            if ClientToScreen(hwnd, &mut pt) == 0 {
                return None;
            }
            Some((pt.x, pt.y, w, h))
        }
    }

    /// 使用 Win32 Toolhelp32 系统进程表快照按 PID 获取可执行文件名（无需对受 EAC/高权限保护的游戏进程调用 OpenProcess）
    fn snapshot_process_names() -> HashMap<u32, String> {
        let mut map = HashMap::new();
        unsafe {
            let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
            if snap.is_null() || (snap as isize) == INVALID_HANDLE_VALUE {
                return map;
            }
            let mut entry: PROCESSENTRY32W = std::mem::zeroed();
            entry.dw_size = std::mem::size_of::<PROCESSENTRY32W>() as u32;
            if Process32FirstW(snap, &mut entry) != 0 {
                loop {
                    let nul_pos = entry
                        .sz_exe_file
                        .iter()
                        .position(|&c| c == 0)
                        .unwrap_or(entry.sz_exe_file.len());
                    if nul_pos > 0 && entry.th32_process_id != 0 {
                        let name = String::from_utf16_lossy(&entry.sz_exe_file[..nul_pos]);
                        map.insert(entry.th32_process_id, name);
                    }
                    if Process32NextW(snap, &mut entry) == 0 {
                        break;
                    }
                }
            }
            let _ = CloseHandle(snap);
        }
        map
    }

    struct EnumCandidate {
        best_score: i32,
        best_dto: Option<GameWindowInfoDto>,
        fg_hwnd: *mut c_void,
        self_pid: u32,
        proc_map: HashMap<u32, String>,
    }

    unsafe extern "system" fn enum_game_windows_cb(hwnd: *mut c_void, l_param: isize) -> i32 {
        let ctx = &mut *(l_param as *mut EnumCandidate);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let mut pid = 0u32;
        let _ = GetWindowThreadProcessId(hwnd, &mut pid);
        if pid == 0 || pid == ctx.self_pid {
            return 1;
        }

        // 先判断最小化状态，避免最小化时 GetClientRect 返回 0x0 导致窗口被提前丢弃
        let iconic = IsIconic(hwnd) != 0;
        let (cx, cy, cw, ch) = match query_client_screen_bounds(hwnd) {
            Some(bounds) => bounds,
            None if iconic => (0, 0, 0, 0),
            None => return 1,
        };
        // 跳过启动器小弹窗或极小托盘窗口（除非已最小化）
        if !iconic && (cw < 640 || ch < 360) {
            return 1;
        }

        let proc_name = ctx
            .proc_map
            .get(&pid)
            .cloned()
            .unwrap_or_else(|| query_process_basename(pid));
        let proc_lower = proc_name.to_lowercase();

        // 排除本软件自身及崩溃上报/反作弊启动器附属进程
        if proc_lower.contains("arc-map")
            || proc_lower.contains("only raiders")
            || proc_lower.contains("crashreportclient")
            || proc_lower.contains("start_protected_game")
            || proc_lower.contains("easyanticheat")
        {
            return 1;
        }

        let class_name = query_window_class(hwnd);
        let title = query_window_title(hwnd);
        let title_lower = title.to_lowercase();
        let title_trim = title_lower.trim();

        let mut score = 0;
        if proc_lower.contains("pioneergame")
            || proc_lower.contains("arcraiders")
            || proc_lower == "pioneer.exe"
        {
            score += 120;
        }
        if class_name == "UnrealWindow" {
            score += 45;
        }
        if title_trim.contains("arc raiders")
            || title_trim.contains("arcraiders")
            || title_trim == "pioneer"
            || title_trim.starts_with("pioneergame")
            || title_trim.starts_with("pioneer ")
        {
            score += 55;
        }

        if score >= 80 {
            if !iconic {
                score += 10;
            }
            if hwnd == ctx.fg_hwnd {
                score += 5;
            }
            if score > ctx.best_score {
                ctx.best_score = score;
                ctx.best_dto = Some(GameWindowInfoDto {
                    found: true,
                    hwnd: hwnd as usize,
                    title,
                    process_name: proc_name,
                    client_x: cx,
                    client_y: cy,
                    client_width: cw,
                    client_height: ch,
                    is_foreground: hwnd == ctx.fg_hwnd,
                });
            }
        }
        1
    }

    pub fn find_game_window() -> GameWindowInfoDto {
        let fg = unsafe { GetForegroundWindow() };
        let mut ctx = EnumCandidate {
            best_score: 0,
            best_dto: None,
            fg_hwnd: fg,
            self_pid: std::process::id(),
            proc_map: snapshot_process_names(),
        };
        unsafe {
            let _ = EnumWindows(enum_game_windows_cb, &mut ctx as *mut EnumCandidate as isize);
        }
        ctx.best_dto.unwrap_or(GameWindowInfoDto {
            found: false,
            hwnd: 0,
            title: String::new(),
            process_name: String::new(),
            client_x: 0,
            client_y: 0,
            client_width: 0,
            client_height: 0,
            is_foreground: false,
        })
    }

    pub fn focus_game_window(hwnd_num: usize) -> SyncActionResultDto {
        ABORT_SYNC.store(false, Ordering::SeqCst);
        if let Ok(mut g) = LAST_CURSOR_POS.lock() {
            *g = None;
        }

        let hwnd = hwnd_num as *mut c_void;
        unsafe {
            if hwnd.is_null() || IsWindow(hwnd) == 0 {
                return SyncActionResultDto {
                    ok: false,
                    aborted: false,
                    reason: "游戏窗口句柄已失效，请确认游戏仍在运行。".into(),
                };
            }

            if IsIconic(hwnd) != 0 {
                let _ = ShowWindow(hwnd, SW_RESTORE);
                std::thread::sleep(Duration::from_millis(180));
            }

            let _ = BringWindowToTop(hwnd);
            let _ = SetForegroundWindow(hwnd);

            if GetForegroundWindow() != hwnd {
                // 使用轻量 Alt 键事件解除 Win32 前台锁限制
                keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY, 0);
                let _ = SetForegroundWindow(hwnd);
                keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
            }

            for _ in 0..12 {
                if GetForegroundWindow() == hwnd {
                    return SyncActionResultDto {
                        ok: true,
                        aborted: false,
                        reason: String::new(),
                    };
                }
                std::thread::sleep(Duration::from_millis(25));
            }
        }

        SyncActionResultDto {
            ok: false,
            aborted: false,
            reason: "无法切换到游戏窗口，请检查游戏是否以管理员权限运行（若是，请以相同权限运行本软件）。".into(),
        }
    }

    /// 截取目标游戏窗口客户区，输出标准 24-bit BGR BMP 二进制字节流（避免 32-bit GDI Alpha=0 透明问题且体积小 25%）
    pub fn capture_client_bmp(
        hwnd_num: usize,
        main_hwnd_num: usize,
        overlay_hwnd_num: usize,
        max_width: u32,
    ) -> Result<Vec<u8>, String> {
        let hwnd = hwnd_num as *mut c_void;
        unsafe {
            if hwnd.is_null() || IsWindow(hwnd) == 0 {
                return Err("游戏窗口不存在或已关闭".into());
            }
            if IsIconic(hwnd) != 0 {
                return Err("游戏窗口当前处于最小化状态，请先恢复显示游戏窗口".into());
            }
        }

        let (client_x, client_y, src_w, src_h) =
            query_client_screen_bounds(hwnd).ok_or_else(|| "无法读取游戏窗口客户区尺寸".to_string())?;
        if src_w < 320 || src_h < 200 {
            return Err("游戏窗口尺寸异常".into());
        }

        let cap_w = max_width.clamp(640, 3840) as i32;
        let (dst_w, dst_h) = if src_w > cap_w {
            let h = ((src_h as i64 * cap_w as i64) / src_w as i64).max(1) as i32;
            (cap_w, h)
        } else {
            (src_w, src_h)
        };

        let row_stride = ((dst_w * 3 + 3) & !3) as usize;
        let pixel_bytes_len = row_stride * (dst_h as usize);

        unsafe {
            let screen_dc = GetDC(std::ptr::null_mut());
            if screen_dc.is_null() {
                return Err("无法获取屏幕绘制上下文".into());
            }

            let dst_dc = CreateCompatibleDC(screen_dc);
            if dst_dc.is_null() {
                let _ = ReleaseDC(std::ptr::null_mut(), screen_dc);
                return Err("创建内存 DC 失败".into());
            }

            let bmi = BITMAPINFO {
                bmi_header: BITMAPINFOHEADER {
                    bi_size: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    bi_width: dst_w,
                    // 正数 bi_height 为标准自底向上 BMP，所有浏览器解码器 100% 兼容
                    bi_height: dst_h,
                    bi_planes: 1,
                    bi_bit_count: 24,
                    bi_compression: BI_RGB,
                    bi_size_image: pixel_bytes_len as u32,
                    bi_x_pels_per_meter: 0,
                    bi_y_pels_per_meter: 0,
                    bi_clr_used: 0,
                    bi_clr_important: 0,
                },
                bmi_colors: [0],
            };

            let mut dst_bits_ptr: *mut u8 = std::ptr::null_mut();
            let dst_dib = CreateDIBSection(
                dst_dc,
                &bmi,
                DIB_RGB_COLORS,
                &mut dst_bits_ptr,
                std::ptr::null_mut(),
                0,
            );
            if dst_dib.is_null() || dst_bits_ptr.is_null() {
                let _ = DeleteDC(dst_dc);
                let _ = ReleaseDC(std::ptr::null_mut(), screen_dc);
                return Err("分配截图缓冲区失败".into());
            }

            let old_dst_obj = SelectObject(dst_dc, dst_dib);
            let fg = GetForegroundWindow();
            let is_fg = fg == hwnd;
            let fg_is_self = (main_hwnd_num != 0 && fg == main_hwnd_num as *mut c_void)
                || (overlay_hwnd_num != 0 && fg == overlay_hwnd_num as *mut c_void);

            // 将可能遮挡游戏画面的本软件窗口（悬浮窗 + 非前台游戏时的主窗口/置顶主窗口）全部临时设为 WDA_EXCLUDEFROMCAPTURE
            let mut exclude_list = vec![overlay_hwnd_num];
            if main_hwnd_num != 0 {
                let main_topmost =
                    (GetWindowLongPtrW(main_hwnd_num as *mut c_void, GWL_EXSTYLE) & WS_EX_TOPMOST)
                        != 0;
                if !is_fg || main_topmost {
                    exclude_list.push(main_hwnd_num);
                }
            }
            let exclude_guard = ExcludeCaptureGuard::enter_many(&exclude_list);

            // DX12 Flip-Model (UnrealWindow) 下优先走 DWM 桌面合成穿透抓取（当游戏在前台，或本软件窗口在前台且已穿透剔除时 100% 实时无遮挡）
            let prefer_dwm_bitblt = is_fg || (fg_is_self && exclude_guard.all_excluded);
            let mut captured_via_print_window = false;

            // 仅当有其他第三方窗口遮挡游戏且无法通过本软件穿透消除时，尝试 PrintWindow 抓取
            if !prefer_dwm_bitblt {
                let pw_dc = CreateCompatibleDC(screen_dc);
                if !pw_dc.is_null() {
                    let src_stride = ((src_w * 3 + 3) & !3) as usize;
                    let pw_bmi = BITMAPINFO {
                        bmi_header: BITMAPINFOHEADER {
                            bi_size: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                            bi_width: src_w,
                            bi_height: src_h,
                            bi_planes: 1,
                            bi_bit_count: 24,
                            bi_compression: BI_RGB,
                            bi_size_image: (src_stride * src_h as usize) as u32,
                            bi_x_pels_per_meter: 0,
                            bi_y_pels_per_meter: 0,
                            bi_clr_used: 0,
                            bi_clr_important: 0,
                        },
                        bmi_colors: [0],
                    };
                    let mut pw_bits: *mut u8 = std::ptr::null_mut();
                    let pw_dib = CreateDIBSection(
                        pw_dc,
                        &pw_bmi,
                        DIB_RGB_COLORS,
                        &mut pw_bits,
                        std::ptr::null_mut(),
                        0,
                    );
                    if !pw_dib.is_null() && !pw_bits.is_null() {
                        let old_pw = SelectObject(pw_dc, pw_dib);
                        let ok = PrintWindow(hwnd, pw_dc, PW_CLIENTONLY | PW_RENDERFULLCONTENT);
                        if ok != 0 {
                            let slice = std::slice::from_raw_parts(pw_bits, src_stride * src_h as usize);
                            let step = (slice.len() / 64).max(3);
                            let non_black = slice.iter().step_by(step).any(|&b| b > 12);
                            if non_black {
                                if dst_w == src_w && dst_h == src_h {
                                    let _ = BitBlt(dst_dc, 0, 0, dst_w, dst_h, pw_dc, 0, 0, SRCCOPY);
                                } else {
                                    let _ = SetStretchBltMode(dst_dc, HALFTONE);
                                    let _ = SetBrushOrgEx(dst_dc, 0, 0, std::ptr::null_mut());
                                    let _ = StretchBlt(
                                        dst_dc, 0, 0, dst_w, dst_h, pw_dc, 0, 0, src_w, src_h, SRCCOPY,
                                    );
                                }
                                captured_via_print_window = true;
                            }
                        }
                        let _ = SelectObject(pw_dc, old_pw);
                        let _ = DeleteObject(pw_dib);
                    }
                    let _ = DeleteDC(pw_dc);
                }
            }

            // DWM 桌面合成无损抓取（自动剔除已设为 WDA_EXCLUDEFROMCAPTURE 的主窗口与悬浮窗）
            if !captured_via_print_window {
                if dst_w == src_w && dst_h == src_h {
                    let _ = BitBlt(dst_dc, 0, 0, dst_w, dst_h, screen_dc, client_x, client_y, SRCCOPY);
                } else {
                    let _ = SetStretchBltMode(dst_dc, HALFTONE);
                    let _ = SetBrushOrgEx(dst_dc, 0, 0, std::ptr::null_mut());
                    let _ = StretchBlt(
                        dst_dc, 0, 0, dst_w, dst_h, screen_dc, client_x, client_y, src_w, src_h, SRCCOPY,
                    );
                }
            }
            drop(exclude_guard);

            // 组装 54 字节标准 BMP 文件头 + 像素数据
            let total_file_size = 54 + pixel_bytes_len;
            let mut bmp = Vec::with_capacity(total_file_size);
            // BITMAPFILEHEADER (14 bytes)
            bmp.extend_from_slice(b"BM");
            bmp.extend_from_slice(&(total_file_size as u32).to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&54u32.to_le_bytes());
            // BITMAPINFOHEADER (40 bytes)
            bmp.extend_from_slice(&40u32.to_le_bytes());
            bmp.extend_from_slice(&dst_w.to_le_bytes());
            bmp.extend_from_slice(&dst_h.to_le_bytes());
            bmp.extend_from_slice(&1u16.to_le_bytes());
            bmp.extend_from_slice(&24u16.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&(pixel_bytes_len as u32).to_le_bytes());
            bmp.extend_from_slice(&0i32.to_le_bytes());
            bmp.extend_from_slice(&0i32.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());
            bmp.extend_from_slice(&0u32.to_le_bytes());

            let raw_pixels = std::slice::from_raw_parts(dst_bits_ptr, pixel_bytes_len);
            bmp.extend_from_slice(raw_pixels);

            let _ = SelectObject(dst_dc, old_dst_obj);
            let _ = DeleteObject(dst_dib);
            let _ = DeleteDC(dst_dc);
            let _ = ReleaseDC(std::ptr::null_mut(), screen_dc);

            Ok(bmp)
        }
    }

    fn check_safety_guards(hwnd: *mut c_void, check_drift: bool, anchor: Option<(i32, i32)>) -> Option<String> {
        if ABORT_SYNC.load(Ordering::SeqCst) {
            clear_sync_active();
            return Some("已手动点击停止同步".into());
        }
        if is_vkey_down(VK_ESCAPE) || is_vkey_down(VK_F10) {
            ABORT_SYNC.store(true, Ordering::SeqCst);
            clear_sync_active();
            return Some("检测到按下急停键 (ESC / F10)，已安全中止同步".into());
        }
        unsafe {
            if GetForegroundWindow() != hwnd {
                ABORT_SYNC.store(true, Ordering::SeqCst);
                clear_sync_active();
                return Some("游戏窗口失去焦点，已自动安全中止同步".into());
            }
            if check_drift {
                if let Some((ax, ay)) = anchor {
                    let mut pt = POINT::default();
                    if GetCursorPos(&mut pt) != 0 {
                        let dx = (pt.x - ax) as f64;
                        let dy = (pt.y - ay) as f64;
                        if (dx * dx + dy * dy).sqrt() > 42.0 {
                            ABORT_SYNC.store(true, Ordering::SeqCst);
                            clear_sync_active();
                            return Some("检测到物理鼠标大幅移动，已立即交还控制权".into());
                        }
                    }
                }
            }
        }
        None
    }

    fn park_cursor_neutral(cx: i32, cy: i32, cw: i32, ch: i32) -> (i32, i32) {
        let px = (cx + (0.045 * cw as f64).round() as i32).clamp(cx + 4, (cx + cw - 4).max(cx + 4));
        let py = (cy + (0.520 * ch as f64).round() as i32).clamp(cy + 4, (cy + ch - 4).max(cy + 4));
        move_cursor_input(px, py)
    }

    /// 微区域 GDI 采样器（仅监控对应分支 H3 大字计数框色度跳变，单次 BitBlt < 0.1ms，RAII 零句柄泄漏）
    struct BranchCounterSampler {
        screen_dc: *mut c_void,
        mem_dc: *mut c_void,
        dib: *mut c_void,
        old_obj: *mut c_void,
        bits_ptr: *mut u8,
        sx: i32,
        sy: i32,
        sw: i32,
        sh: i32,
        stride: usize,
        branch_kind: u8, // 1 = conditioning, 2 = mobility, 3 = survival
    }

    impl BranchCounterSampler {
        fn new(cx: i32, cy: i32, cw: i32, ch: i32, branch: &str) -> Option<Self> {
            let (dx0, dx1, dy0, dy1, branch_kind) = match branch {
                "conditioning" => (-285.0, -215.0, 346.0, 376.0, 1u8),
                "mobility" => (-45.0, 45.0, 78.0, 106.0, 2u8),
                "survival" => (265.0, 335.0, 346.0, 376.0, 3u8),
                _ => return None,
            };

            let s = (cw as f64 / 1920.0).min(ch as f64 / 1080.0).clamp(0.45, 3.0);
            let ox = cx as f64 + cw as f64 * 0.5;
            let oy = cy as f64 + ch as f64 * 0.5;

            let sx = (ox + dx0 * s).round() as i32;
            let sy = (oy + dy0 * s).round() as i32;
            let sw = ((dx1 - dx0) * s).round().clamp(16.0, 320.0) as i32;
            let sh = ((dy1 - dy0) * s).round().clamp(10.0, 140.0) as i32;

            if sx < cx || sy < cy || sx + sw > cx + cw || sy + sh > cy + ch {
                return None;
            }

            let stride = ((sw * 3 + 3) & !3) as usize;
            let byte_len = stride * (sh as usize);

            unsafe {
                let screen_dc = GetDC(std::ptr::null_mut());
                if screen_dc.is_null() {
                    return None;
                }
                let mem_dc = CreateCompatibleDC(screen_dc);
                if mem_dc.is_null() {
                    let _ = ReleaseDC(std::ptr::null_mut(), screen_dc);
                    return None;
                }

                let bmi = BITMAPINFO {
                    bmi_header: BITMAPINFOHEADER {
                        bi_size: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                        bi_width: sw,
                        bi_height: sh,
                        bi_planes: 1,
                        bi_bit_count: 24,
                        bi_compression: BI_RGB,
                        bi_size_image: byte_len as u32,
                        bi_x_pels_per_meter: 0,
                        bi_y_pels_per_meter: 0,
                        bi_clr_used: 0,
                        bi_clr_important: 0,
                    },
                    bmi_colors: [0],
                };

                let mut bits_ptr: *mut u8 = std::ptr::null_mut();
                let dib = CreateDIBSection(
                    mem_dc,
                    &bmi,
                    DIB_RGB_COLORS,
                    &mut bits_ptr,
                    std::ptr::null_mut(),
                    0,
                );
                if dib.is_null() || bits_ptr.is_null() {
                    let _ = DeleteDC(mem_dc);
                    let _ = ReleaseDC(std::ptr::null_mut(), screen_dc);
                    return None;
                }

                let old_obj = SelectObject(mem_dc, dib);
                Some(Self {
                    screen_dc,
                    mem_dc,
                    dib,
                    old_obj,
                    bits_ptr,
                    sx,
                    sy,
                    sw,
                    sh,
                    stride,
                    branch_kind,
                })
            }
        }

        fn sample_chroma(&mut self, out: &mut Vec<u8>) -> bool {
            let total_px = (self.sw * self.sh) as usize;
            out.clear();
            out.reserve(total_px);
            unsafe {
                let ok = BitBlt(
                    self.mem_dc,
                    0,
                    0,
                    self.sw,
                    self.sh,
                    self.screen_dc,
                    self.sx,
                    self.sy,
                    SRCCOPY,
                );
                if ok == 0 {
                    return false;
                }
                let raw = std::slice::from_raw_parts(self.bits_ptr, self.stride * (self.sh as usize));
                for row in 0..(self.sh as usize) {
                    let row_off = row * self.stride;
                    for col in 0..(self.sw as usize) {
                        let idx = row_off + col * 3;
                        let b = raw[idx];
                        let g = raw[idx + 1];
                        let r = raw[idx + 2];
                        let chroma = match self.branch_kind {
                            1 => g.saturating_sub(r),
                            2 => r.min(g).saturating_sub(b),
                            _ => r.saturating_sub(g.max(b)),
                        };
                        out.push(chroma);
                    }
                }
            }
            true
        }

        fn did_counter_jump(base: &[u8], cur: &[u8]) -> bool {
            if base.is_empty() || base.len() != cur.len() {
                return false;
            }
            let mut active_cnt: u32 = 0;
            let mut diff_sum: u32 = 0;
            let mut strong_px: u32 = 0;
            for (&a, &b) in base.iter().zip(cur.iter()) {
                let d = a.abs_diff(b);
                if d >= 68 {
                    strong_px += 1;
                }
                if a > 35 || b > 35 {
                    active_cnt += 1;
                    diff_sum += d as u32;
                }
            }
            let min_strong = ((base.len() as u32) / 140).max(8);
            active_cnt >= 10
                && ((diff_sum as f64 / active_cnt as f64) >= 16.0 || strong_px >= min_strong)
        }
    }

    impl Drop for BranchCounterSampler {
        fn drop(&mut self) {
            unsafe {
                if !self.mem_dc.is_null() && !self.old_obj.is_null() {
                    let _ = SelectObject(self.mem_dc, self.old_obj);
                }
                if !self.dib.is_null() {
                    let _ = DeleteObject(self.dib);
                }
                if !self.mem_dc.is_null() {
                    let _ = DeleteDC(self.mem_dc);
                }
                if !self.screen_dc.is_null() {
                    let _ = ReleaseDC(std::ptr::null_mut(), self.screen_dc);
                }
            }
        }
    }

    pub fn exec_safe_input(
        hwnd_num: usize,
        overlay_hwnd_num: usize,
        kind: &str,
        norm_x: f64,
        norm_y: f64,
        hold_ms: u64,
        check_drift: bool,
        park_after: bool,
        early_release_after_ms: Option<u64>,
        branch: Option<&str>,
        to_norm_x: Option<f64>,
        to_norm_y: Option<f64>,
        wheel_delta: Option<i32>,
    ) -> SyncActionResultDto {
        let hwnd = hwnd_num as *mut c_void;
        let prev_anchor = LAST_CURSOR_POS.lock().ok().and_then(|g| *g);

        if let Some(reason) = check_safety_guards(hwnd, check_drift, prev_anchor) {
            return SyncActionResultDto {
                ok: false,
                aborted: true,
                reason,
            };
        }

        let Some((cx, cy, cw, ch)) = query_client_screen_bounds(hwnd) else {
            return SyncActionResultDto {
                ok: false,
                aborted: true,
                reason: "无法获取游戏窗口坐标，已中止同步".into(),
            };
        };

        let _ov_pass = OverlayPassThroughGuard::enter(overlay_hwnd_num);

        // 纯归位指令（移至左侧空白安全区消除技能悬浮 Tooltip 遮挡，不执行任何点击）
        if kind == "park" {
            let px = (cx + (norm_x.clamp(0.02, 0.98) * cw as f64).round() as i32)
                .clamp(cx + 4, (cx + cw - 4).max(cx + 4));
            let py = (cy + (norm_y.clamp(0.02, 0.98) * ch as f64).round() as i32)
                .clamp(cy + 4, (cy + ch - 4).max(cy + 4));
            let _ = move_cursor_input(px, py);
            return SyncActionResultDto {
                ok: true,
                aborted: false,
                reason: String::new(),
            };
        }

        // 附加 ±1px 拟人微偏移（滚轮指令锁死在储备箱 8px 暗缝十字中心，零偏移杜绝触发悬浮提示框）
        let (jx, jy) = if kind == "scroll" {
            (0, 0)
        } else {
            let nanos = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.subsec_nanos())
                .unwrap_or(0);
            ((nanos % 3) as i32 - 1, ((nanos / 7) % 3) as i32 - 1)
        };

        let raw_x = cx + (norm_x.clamp(0.01, 0.99) * cw as f64).round() as i32 + jx;
        let raw_y = cy + (norm_y.clamp(0.01, 0.99) * ch as f64).round() as i32 + jy;
        let desired_x = raw_x.clamp(cx + 4, (cx + cw - 4).max(cx + 4));
        let desired_y = raw_y.clamp(cy + 4, (cy + ch - 4).max(cy + 4));

        // 同时发送 SetCursorPos 与 SendInput(MOUSEEVENTF_MOVE)，确保 UE5 Slate 更新 WidgetsUnderPointer
        let (target_x, target_y) = move_cursor_input(desired_x, desired_y);

        // 悬停等待游戏 UI 捕获焦点
        std::thread::sleep(Duration::from_millis(55));

        if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
            return SyncActionResultDto {
                ok: false,
                aborted: true,
                reason,
            };
        }

        // 鼠标滚轮滚动指令（用于储备箱长列表大幅翻页检索）
        if kind == "scroll" {
            let mut remaining = wheel_delta.unwrap_or(-2040).clamp(-6000, 6000);
            while remaining != 0 {
                let step = if remaining > 0 {
                    remaining.min(WHEEL_DELTA)
                } else {
                    remaining.max(-WHEEL_DELTA)
                };
                send_mouse_wheel(step);
                remaining -= step;
                if remaining != 0 {
                    std::thread::sleep(Duration::from_millis(15));
                    if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                        return SyncActionResultDto {
                            ok: false,
                            aborted: true,
                            reason,
                        };
                    }
                }
            }

            if park_after {
                std::thread::sleep(Duration::from_millis(38));
                if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                    return SyncActionResultDto {
                        ok: false,
                        aborted: true,
                        reason,
                    };
                }
                park_cursor_neutral(cx, cy, cw, ch);
            }
            return SyncActionResultDto {
                ok: true,
                aborted: false,
                reason: String::new(),
            };
        }

        // 鼠标平滑拖拽投放指令（真实 MOUSEEVENTF_MOVE 驱动 UE5 Slate OnDragDetected -> OnDragOver -> OnDrop）
        if kind == "drag" {
            let dst_nx = to_norm_x.unwrap_or(norm_x).clamp(0.01, 0.99);
            let dst_ny = to_norm_y.unwrap_or(norm_y).clamp(0.01, 0.99);
            let end_x = (cx + (dst_nx * cw as f64).round() as i32 + jx)
                .clamp(cx + 4, (cx + cw - 4).max(cx + 4));
            let end_y = (cy + (dst_ny * ch as f64).round() as i32 + jy)
                .clamp(cy + 4, (cy + ch - 4).max(cy + 4));

            let down_settle = if hold_ms >= 48 {
                hold_ms.clamp(48, 180)
            } else {
                50
            };

            let mut guard = LeftButtonReleaseGuard::press();
            std::thread::sleep(Duration::from_millis(down_settle));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                guard.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }

            let dx_total = (end_x - target_x) as f64;
            let dy_total = (end_y - target_y) as f64;
            let dist = (dx_total * dx_total + dy_total * dy_total).sqrt();

            // 首步在源卡片内部移动 ~10px 越过 UE5 Slate 5px DragTriggerDistance，确保 NativeOnDragDetected 必触发
            if dist > 14.0 {
                let kick = 10.0 / dist;
                let kx = (target_x as f64 + dx_total * kick).round() as i32;
                let ky = (target_y as f64 + dy_total * kick).round() as i32;
                let (init_x, init_y) = move_cursor_input(kx, ky);
                std::thread::sleep(Duration::from_millis(32));
                if let Some(reason) = check_safety_guards(hwnd, true, Some((init_x, init_y))) {
                    guard.release();
                    return SyncActionResultDto {
                        ok: false,
                        aborted: true,
                        reason,
                    };
                }
            }

            let steps: i32 = 14;
            for s in 1..=steps {
                let u = s as f64 / steps as f64;
                let eased = 1.0 - (1.0 - u) * (1.0 - u);
                let sx = (target_x as f64 + dx_total * eased).round() as i32;
                let sy = (target_y as f64 + dy_total * eased).round() as i32;
                let (cur_x, cur_y) = move_cursor_input(sx, sy);
                std::thread::sleep(Duration::from_millis(12));
                if let Some(reason) = check_safety_guards(hwnd, true, Some((cur_x, cur_y))) {
                    guard.release();
                    return SyncActionResultDto {
                        ok: false,
                        aborted: true,
                        reason,
                    };
                }
            }

            let (final_x, final_y) = move_cursor_input(end_x, end_y);
            // 末端悬停 ~4 帧让目标 UMG 槽位稳定进入 OnDragOver 态后再松开左键触发 OnDrop
            std::thread::sleep(Duration::from_millis(65));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((final_x, final_y))) {
                guard.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            guard.release();
            std::thread::sleep(Duration::from_millis(45));

            if park_after {
                if let Some(reason) = check_safety_guards(hwnd, true, Some((final_x, final_y))) {
                    return SyncActionResultDto {
                        ok: false,
                        aborted: true,
                        reason,
                    };
                }
                park_cursor_neutral(cx, cy, cw, ch);
            }
            return SyncActionResultDto {
                ok: true,
                aborted: false,
                reason: String::new(),
            };
        }

        // 游戏原生 [SHIFT] + 左键快速移动装备指令（底部栏提示：SHIFT 快速移动）
        if kind == "shift_click" {
            let mut shift_guard = ShiftKeyReleaseGuard::press();
            std::thread::sleep(Duration::from_millis(30));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                shift_guard.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            let mut btn_guard = LeftButtonReleaseGuard::press();
            std::thread::sleep(Duration::from_millis(48));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                btn_guard.release();
                shift_guard.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            btn_guard.release();
            std::thread::sleep(Duration::from_millis(30));
            shift_guard.release();

            if park_after {
                std::thread::sleep(Duration::from_millis(38));
                if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                    return SyncActionResultDto {
                        ok: false,
                        aborted: true,
                        reason,
                    };
                }
                park_cursor_neutral(cx, cy, cw, ch);
            }
            return SyncActionResultDto {
                ok: true,
                aborted: false,
                reason: String::new(),
            };
        }

        // 双击快速装配兜底指令
        if kind == "double_click" {
            let mut g1 = LeftButtonReleaseGuard::press();
            std::thread::sleep(Duration::from_millis(42));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                g1.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            g1.release();
            std::thread::sleep(Duration::from_millis(55));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            let mut g2 = LeftButtonReleaseGuard::press();
            std::thread::sleep(Duration::from_millis(42));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                g2.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            g2.release();

            if park_after {
                std::thread::sleep(Duration::from_millis(38));
                if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                    return SyncActionResultDto {
                        ok: false,
                        aborted: true,
                        reason,
                    };
                }
                park_cursor_neutral(cx, cy, cw, ch);
            }
            return SyncActionResultDto {
                ok: true,
                aborted: false,
                reason: String::new(),
            };
        }

        let press_duration = if kind == "hold" {
            hold_ms.clamp(120, 2500)
        } else {
            48
        };

        let early_min_ms = if kind == "hold" {
            early_release_after_ms.filter(|&m| m >= 350 && m + 15 < press_duration)
        } else {
            None
        };

        let _exclude_ov = early_min_ms.map(|_| ExcludeCaptureGuard::enter(overlay_hwnd_num));
        let mut sampler = match (early_min_ms, branch) {
            (Some(_), Some(br)) => BranchCounterSampler::new(cx, cy, cw, ch, br),
            _ => None,
        };
        let mut base_chroma: Vec<u8> = Vec::new();
        let mut cur_chroma: Vec<u8> = Vec::new();
        let mut baseline_captured = false;

        // RAII 守卫确保即使中途急停也 100% 释放鼠标左键
        let mut guard = LeftButtonReleaseGuard::press();
        let start = Instant::now();
        while start.elapsed() < Duration::from_millis(press_duration) {
            let remain = Duration::from_millis(press_duration).saturating_sub(start.elapsed());
            let step_sleep = if sampler.is_some() { 12 } else { 15 };
            std::thread::sleep(remain.min(Duration::from_millis(step_sleep)));

            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                guard.release();
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }

            if let (Some(min_ms), Some(ref mut smp)) = (early_min_ms, sampler.as_mut()) {
                let elapsed_ms = start.elapsed().as_millis() as u64;
                if !baseline_captured && elapsed_ms >= min_ms.saturating_sub(40) {
                    baseline_captured = smp.sample_chroma(&mut base_chroma);
                } else if baseline_captured && elapsed_ms >= min_ms {
                    if smp.sample_chroma(&mut cur_chroma)
                        && BranchCounterSampler::did_counter_jump(&base_chroma, &cur_chroma)
                    {
                        // 分支 H3 总点计数器已在画面上 +1 跳变，立即松开左键！
                        break;
                    }
                }
            }
        }
        guard.release();
        drop(sampler);
        drop(_exclude_ov);

        if park_after {
            // 留出 ~2.3 帧让 Slate 在节点原位完整结算 MouseUp，随后立即移入左侧空白安全区消除悬浮卡片遮挡
            std::thread::sleep(Duration::from_millis(38));
            if let Some(reason) = check_safety_guards(hwnd, true, Some((target_x, target_y))) {
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            park_cursor_neutral(cx, cy, cw, ch);
        } else {
            unsafe {
                let mut cur = POINT::default();
                if GetCursorPos(&mut cur) != 0 {
                    if let Ok(mut g) = LAST_CURSOR_POS.lock() {
                        *g = Some((cur.x, cur.y));
                    }
                }
            }
        }

        SyncActionResultDto {
            ok: true,
            aborted: false,
            reason: String::new(),
        }
    }

    pub fn wait_safe(hwnd_num: usize, duration_ms: u64, check_drift: bool) -> SyncActionResultDto {
        let hwnd = hwnd_num as *mut c_void;
        let clamped_ms = duration_ms.clamp(20, 6000);
        let anchor = LAST_CURSOR_POS.lock().ok().and_then(|g| *g);
        let start = Instant::now();
        while start.elapsed() < Duration::from_millis(clamped_ms) {
            if let Some(reason) = check_safety_guards(hwnd, check_drift, anchor) {
                return SyncActionResultDto {
                    ok: false,
                    aborted: true,
                    reason,
                };
            }
            let remain = Duration::from_millis(clamped_ms).saturating_sub(start.elapsed());
            std::thread::sleep(remain.min(Duration::from_millis(20)));
        }
        if let Some(reason) = check_safety_guards(hwnd, check_drift, anchor) {
            return SyncActionResultDto {
                ok: false,
                aborted: true,
                reason,
            };
        }
        SyncActionResultDto {
            ok: true,
            aborted: false,
            reason: String::new(),
        }
    }
}

#[cfg(target_os = "windows")]
fn resolve_main_hwnd(app: &AppHandle) -> usize {
    app.get_webview_window("main")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as usize)
        .unwrap_or(0)
}

#[cfg(target_os = "windows")]
fn resolve_overlay_hwnd(app: &AppHandle) -> usize {
    app.get_webview_window("overlay")
        .and_then(|w| w.hwnd().ok())
        .map(|h| h.0 as usize)
        .unwrap_or(0)
}

#[tauri::command]
pub async fn raider_find_game_window() -> Result<GameWindowInfoDto, String> {
    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn_blocking(move || imp::find_game_window())
            .await
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("当前系统暂不支持窗口抓取".into())
    }
}

#[tauri::command]
pub async fn raider_focus_game_window(hwnd: usize) -> Result<SyncActionResultDto, String> {
    #[cfg(target_os = "windows")]
    {
        mark_sync_active();
        tauri::async_runtime::spawn_blocking(move || imp::focus_game_window(hwnd))
            .await
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = hwnd;
        Err("当前系统暂不支持窗口控制".into())
    }
}

#[tauri::command]
pub async fn raider_capture_client(
    app: AppHandle,
    hwnd: usize,
    max_width: Option<u32>,
) -> Result<Response, String> {
    #[cfg(target_os = "windows")]
    {
        let mw = max_width.unwrap_or(2560);
        let main_hwnd = resolve_main_hwnd(&app);
        let ov_hwnd = resolve_overlay_hwnd(&app);
        let bmp = tauri::async_runtime::spawn_blocking(move || {
            imp::capture_client_bmp(hwnd, main_hwnd, ov_hwnd, mw)
        })
        .await
        .map_err(|e| e.to_string())??;
        Ok(Response::new(bmp))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, hwnd, max_width);
        Err("当前系统暂不支持窗口抓取".into())
    }
}

#[tauri::command]
pub async fn raider_exec_input(
    app: AppHandle,
    hwnd: usize,
    kind: String,
    norm_x: f64,
    norm_y: f64,
    hold_ms: Option<u64>,
    check_drift: Option<bool>,
    park_after: Option<bool>,
    early_release_after_ms: Option<u64>,
    branch: Option<String>,
    to_norm_x: Option<f64>,
    to_norm_y: Option<f64>,
    wheel_delta: Option<i32>,
) -> Result<SyncActionResultDto, String> {
    #[cfg(target_os = "windows")]
    {
        mark_sync_active();
        let hm = hold_ms.unwrap_or(580);
        let cd = check_drift.unwrap_or(true);
        let pa = park_after.unwrap_or(false);
        let ov_hwnd = resolve_overlay_hwnd(&app);
        tauri::async_runtime::spawn_blocking(move || {
            imp::exec_safe_input(
                hwnd,
                ov_hwnd,
                &kind,
                norm_x,
                norm_y,
                hm,
                cd,
                pa,
                early_release_after_ms,
                branch.as_deref(),
                to_norm_x,
                to_norm_y,
                wheel_delta,
            )
        })
        .await
        .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (
            app,
            hwnd,
            kind,
            norm_x,
            norm_y,
            hold_ms,
            check_drift,
            park_after,
            early_release_after_ms,
            branch,
            to_norm_x,
            to_norm_y,
            wheel_delta,
        );
        Err("当前系统暂不支持输入模拟".into())
    }
}

#[tauri::command]
pub async fn raider_wait_safe(
    hwnd: usize,
    duration_ms: u64,
    check_drift: Option<bool>,
) -> Result<SyncActionResultDto, String> {
    #[cfg(target_os = "windows")]
    {
        mark_sync_active();
        let cd = check_drift.unwrap_or(true);
        tauri::async_runtime::spawn_blocking(move || imp::wait_safe(hwnd, duration_ms, cd))
            .await
            .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (hwnd, duration_ms, check_drift);
        Err("当前系统暂不支持同步等待".into())
    }
}

#[tauri::command]
pub async fn raider_abort_sync() -> Result<(), String> {
    ABORT_SYNC.store(true, Ordering::SeqCst);
    clear_sync_active();
    Ok(())
}

#[tauri::command]
pub async fn raider_finish_sync() -> Result<(), String> {
    clear_sync_active();
    Ok(())
}
