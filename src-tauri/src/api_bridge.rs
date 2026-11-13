use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

const SCHEDULE_CACHE_TTL: Duration = Duration::from_secs(5 * 60);
const OAUTH_SESSION_TTL: Duration = Duration::from_secs(5 * 60);

struct PendingPkce {
    client_id: String,
    verifier: String,
    redirect_uri: String,
    created_at: Instant,
}

pub struct ApiBridgeInner {
    pub http: reqwest::Client,
    pub http_no_redirect: reqwest::Client,
    schedule_cache: Mutex<Option<(Instant, Value)>>,
    pending_pkce: Mutex<HashMap<String, PendingPkce>>,
    completed_oauth: Mutex<HashMap<String, Value>>,
}

pub type ApiBridgeState = Arc<ApiBridgeInner>;

pub fn create_api_bridge_state() -> ApiBridgeState {
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let http_no_redirect = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    Arc::new(ApiBridgeInner {
        http,
        http_no_redirect,
        schedule_cache: Mutex::new(None),
        pending_pkce: Mutex::new(HashMap::new()),
        completed_oauth: Mutex::new(HashMap::new()),
    })
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn map_display_name_to_id(name: &str) -> Option<&'static str> {
    match name {
        "Dam Battlegrounds" => Some("dam-battlegrounds"),
        "Buried City" => Some("buried-city"),
        "Spaceport" => Some("spaceport"),
        "The Blue Gate" => Some("blue-gate"),
        "Stella Montis" => Some("stella-montis"),
        "Riven Tides" => Some("riven-tides"),
        "Pendola Pass" => Some("pendola-pass"),
        _ => None,
    }
}

fn cond_name_to_id(name: &str) -> Option<&'static str> {
    match name {
        "ARC Frigate" => Some("arc-frigate"),
        "Beachcombing" => Some("buried-treasure"),
        "Bird City" => Some("bird-city"),
        "Close Scrutiny" => Some("close-scrutiny"),
        "Cold Snap" => Some("cold-snap"),
        "Electromagnetic Storm" => Some("electromagnetic-storm"),
        "Harvester" => Some("harvester"),
        "Hidden Bunker" => Some("hidden-bunker"),
        "Hurricane" => Some("hurricane"),
        "Husk Graveyard" => Some("husk-graveyard"),
        "Launch Tower Loot" => Some("launch-tower-loot"),
        "Locked Gate" => Some("locked-gate"),
        "Lush Blooms" => Some("lush-blooms"),
        "Matriarch" => Some("matriarch"),
        "Night Raid" => Some("night-raid"),
        "Prospecting Probes" => Some("prospecting-probes"),
        "Redirection" => Some("fallen-emperor"),
        "Uncovered Caches" => Some("uncovered-caches"),
        _ => None,
    }
}

fn is_major_event_id(id: &str) -> bool {
    matches!(
        id,
        "arc-frigate"
            | "close-scrutiny"
            | "cold-snap"
            | "electromagnetic-storm"
            | "hidden-bunker"
            | "hurricane"
            | "locked-gate"
            | "night-raid"
    )
}

/// Extract escaped `{\"conditionItems\":[...\"serverNow\":123456}` JSON block embedded in Next.js HTML.
fn extract_official_schedule_json(html: &str) -> Result<Value, String> {
    let start_marker = "{\\\"conditionItems\\\":[";
    let start_idx = html
        .find(start_marker)
        .ok_or_else(|| "conditionItems payload not found".to_string())?;
    let tail = &html[start_idx..];
    let server_marker = "\\\"serverNow\\\":";
    let srv_rel = tail
        .find(server_marker)
        .ok_or_else(|| "serverNow marker not found".to_string())?;
    let after_srv = &tail[srv_rel + server_marker.len()..];
    let digits_len = after_srv
        .bytes()
        .take_while(|b| b.is_ascii_digit())
        .count();
    if digits_len == 0 || !after_srv[digits_len..].starts_with('}') {
        return Err("Malformed serverNow tail in conditionItems payload".into());
    }
    let end_rel = srv_rel + server_marker.len() + digits_len + 1;
    let raw_escaped = &tail[..end_rel];
    let unescaped: String = serde_json::from_str(&format!("\"{raw_escaped}\""))
        .map_err(|e| format!("Failed to unescape schedule payload: {e}"))?;
    serde_json::from_str(&unescaped).map_err(|e| format!("Failed to parse schedule JSON: {e}"))
}

#[tauri::command]
pub async fn fetch_official_schedule(
    state: tauri::State<'_, ApiBridgeState>,
    force: Option<bool>,
) -> Result<Value, String> {
    let force_refresh = force.unwrap_or(false);
    if !force_refresh {
        if let Ok(guard) = state.schedule_cache.lock() {
            if let Some((cached_at, ref payload)) = *guard {
                if cached_at.elapsed() < SCHEDULE_CACHE_TTL {
                    return Ok(payload.clone());
                }
            }
        }
    }

    let url = "https://arcraiders.com/map-conditions";
    let resp = state
        .http
        .get(url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .header("Accept", "text/html,application/xhtml+xml")
        .send()
        .await
        .map_err(|e| format!("请求官方地图轮换页失败：{e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }

    let html = resp
        .text()
        .await
        .map_err(|e| format!("读取官方页面内容失败：{e}"))?;
    let data = extract_official_schedule_json(&html)?;

    let mut type_by_cond = HashMap::<String, String>::new();
    if let Some(items) = data.get("conditionItems").and_then(|v| v.as_array()) {
        for item in items {
            if let (Some(n), Some(t)) = (
                item.get("name").and_then(|v| v.as_str()),
                item.get("type").and_then(|v| v.as_str()),
            ) {
                type_by_cond.insert(n.to_string(), t.to_string());
            }
        }
    }

    let mut entries = Vec::new();
    let mut min_start = i64::MAX;
    let mut max_end = i64::MIN;

    if let Some(live) = data.get("liveEntries").and_then(|v| v.as_array()) {
        for raw in live {
            let Some(map_disp) = raw.get("mapDisplayName").and_then(|v| v.as_str()) else {
                continue;
            };
            let Some(cond_name) = raw.get("conditionName").and_then(|v| v.as_str()) else {
                continue;
            };
            let (Some(map_id), Some(event_id)) =
                (map_display_name_to_id(map_disp), cond_name_to_id(cond_name))
            else {
                continue;
            };

            let start_ts = raw.get("startTimestamp").and_then(|v| v.as_i64()).unwrap_or(0);
            let end_ts = raw.get("endTimestamp").and_then(|v| v.as_i64()).unwrap_or(0);
            if start_ts < min_start {
                min_start = start_ts;
            }
            if end_ts > max_end {
                max_end = end_ts;
            }

            let official_type = type_by_cond
                .get(cond_name)
                .cloned()
                .unwrap_or_else(|| {
                    if is_major_event_id(event_id) {
                        "major".to_string()
                    } else {
                        "minor".to_string()
                    }
                });

            entries.push(json!({
                "mapId": map_id,
                "eventId": event_id,
                "conditionName": cond_name,
                "mapDisplayName": map_disp,
                "officialType": official_type,
                "durationInSeconds": raw.get("durationInSeconds").and_then(|v| v.as_i64()).unwrap_or(3600),
                "startTimestamp": start_ts,
                "endTimestamp": end_ts,
                "regionTimestamps": raw.get("regionTimestamps").cloned().unwrap_or(Value::Null),
            }));
        }
    }

    if entries.is_empty() {
        return Err("官方轮换列表为空".into());
    }

    let now = now_ms();
    let server_now = data
        .get("serverNow")
        .and_then(|v| v.as_u64())
        .unwrap_or(now);

    let payload = json!({
        "ok": true,
        "sourceUrl": url,
        "fetchedAt": now,
        "serverNow": server_now,
        "windowDurationMs": 3_600_000,
        "minStartTimestamp": min_start,
        "maxEndTimestamp": max_end,
        "entries": entries,
    });

    if let Ok(mut guard) = state.schedule_cache.lock() {
        *guard = Some((Instant::now(), payload.clone()));
    }

    Ok(payload)
}

// ============================================================================
// Pure-Rust FIPS 180-4 SHA-256 + Base64URL + OS CSPRNG for OAuth 2.0 PKCE (S256)
// ============================================================================

fn sha256(data: &[u8]) -> [u8; 32] {
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];

    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];

    let bit_len = (data.len() as u64) * 8;
    let mut msg = Vec::with_capacity(data.len() + 72);
    msg.extend_from_slice(data);
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }

        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);

        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let temp1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let temp2 = s0.wrapping_add(maj);

            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(temp1);
            d = c;
            c = b;
            b = a;
            a = temp1.wrapping_add(temp2);
        }

        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }

    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

fn base64url_encode(bytes: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::with_capacity((bytes.len() * 4 + 2) / 3);
    let mut i = 0;
    while i + 3 <= bytes.len() {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8) | (bytes[i + 2] as u32);
        out.push(TABLE[((n >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3f) as usize] as char);
        out.push(TABLE[((n >> 6) & 0x3f) as usize] as char);
        out.push(TABLE[(n & 0x3f) as usize] as char);
        i += 3;
    }
    let rem = bytes.len() - i;
    if rem == 1 {
        let n = (bytes[i] as u32) << 16;
        out.push(TABLE[((n >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3f) as usize] as char);
    } else if rem == 2 {
        let n = ((bytes[i] as u32) << 16) | ((bytes[i + 1] as u32) << 8);
        out.push(TABLE[((n >> 18) & 0x3f) as usize] as char);
        out.push(TABLE[((n >> 12) & 0x3f) as usize] as char);
        out.push(TABLE[((n >> 6) & 0x3f) as usize] as char);
    }
    out
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0x0f) as usize] as char);
    }
    s
}

fn fill_csprng(buf: &mut [u8]) {
    #[cfg(target_os = "windows")]
    {
        #[link(name = "bcrypt")]
        extern "system" {
            fn BCryptGenRandom(
                h_algorithm: *mut std::ffi::c_void,
                pb_buffer: *mut u8,
                cb_buffer: u32,
                dw_flags: u32,
            ) -> i32;
        }
        const BCRYPT_USE_SYSTEM_PREFERRED_RNG: u32 = 0x00000002;
        let status = unsafe {
            BCryptGenRandom(
                std::ptr::null_mut(),
                buf.as_mut_ptr(),
                buf.len() as u32,
                BCRYPT_USE_SYSTEM_PREFERRED_RNG,
            )
        };
        if status == 0 {
            return;
        }
    }

    // Fallback entropy mixer if OS RNG is unavailable
    let mut seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x9e3779b97f4a7c15)
        ^ (buf.as_ptr() as usize as u64);
    for chunk in buf.chunks_mut(32) {
        seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
        let digest = sha256(&seed.to_le_bytes());
        let n = chunk.len();
        chunk.copy_from_slice(&digest[..n]);
    }
}

fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 16);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => {
                out.push('%');
                const HEX: &[u8; 16] = b"0123456789ABCDEF";
                out.push(HEX[(b >> 4) as usize] as char);
                out.push(HEX[(b & 0x0f) as usize] as char);
            }
        }
    }
    out
}

fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
        } else if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push(((h << 4) | l) as u8);
                i += 3;
                continue;
            }
            out.push(bytes[i]);
            i += 1;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_query_params(query: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for pair in query.split('&') {
        if pair.is_empty() {
            continue;
        }
        let mut parts = pair.splitn(2, '=');
        let k = url_decode(parts.next().unwrap_or(""));
        let v = url_decode(parts.next().unwrap_or(""));
        if !k.is_empty() {
            map.insert(k, v);
        }
    }
    map
}

fn open_system_browser(url: &str) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let escaped = url.replace('\'', "''");
        let _ = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &format!("Start-Process '{escaped}'"),
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open").arg(url).spawn();
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = std::process::Command::new("xdg-open").arg(url).spawn();
    }
}

// ============================================================================
// ArcTracker MCP & REST Data Sync
// ============================================================================

fn parse_mcp_text(text: &str) -> Option<Value> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return Some(v);
    }
    for line in trimmed.lines().rev() {
        if let Some(rest) = line.strip_prefix("data:") {
            let candidate = rest.trim();
            if !candidate.is_empty() {
                if let Ok(v) = serde_json::from_str::<Value>(candidate) {
                    return Some(v);
                }
            }
        }
    }
    None
}

fn classify_mcp_read_tool(name_lower: &str) -> bool {
    let is_write = [
        "update", "set_", "mark_", "write", "mutate", "delete", "add_", "create", "log_",
    ]
    .iter()
    .any(|kw| name_lower.contains(kw));
    if is_write {
        return false;
    }
    [
        "profile",
        "account",
        "user",
        "quest",
        "hideout",
        "workshop",
        "project",
        "expedition",
        "blueprint",
        "progress",
    ]
    .iter()
    .any(|kw| name_lower.contains(kw))
}

async fn fetch_via_mcp(client: &reqwest::Client, bearer_token: &str) -> Result<Value, String> {
    let mcp_url = "https://mcp.arctracker.io/mcp";
    let auth_header = format!("Bearer {bearer_token}");

    let init_resp = client
        .post(mcp_url)
        .header("Authorization", &auth_header)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json, text/event-stream")
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
        .json(&json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": { "name": "arc-map", "version": "1.0.0" }
            }
        }))
        .send()
        .await
        .map_err(|e| format!("MCP 连接失败：{e}"))?;

    if !init_resp.status().is_success() {
        let status = init_resp.status().as_u16();
        let err_json = init_resp.json::<Value>().await.unwrap_or(Value::Null);
        let msg = err_json
            .get("error_description")
            .or_else(|| err_json.get("error"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| format!("MCP HTTP {status}"));
        return Err(msg);
    }

    let session_id = init_resp
        .headers()
        .get("mcp-session-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());
    let _ = init_resp.text().await;

    let build_mcp_post = |body: Value| {
        let mut req = client
            .post(mcp_url)
            .header("Authorization", &auth_header)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        if let Some(ref sid) = session_id {
            req = req.header("Mcp-Session-Id", sid);
        }
        req.json(&body)
    };

    let _ = build_mcp_post(json!({
        "jsonrpc": "2.0",
        "method": "notifications/initialized"
    }))
    .send()
    .await;

    let list_resp = build_mcp_post(json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    }))
    .send()
    .await
    .map_err(|e| format!("MCP 工具列表获取失败：{e}"))?;

    let list_text = list_resp.text().await.unwrap_or_default();
    let list_json = parse_mcp_text(&list_text).unwrap_or(Value::Null);
    let tools = list_json
        .get("result")
        .and_then(|r| r.get("tools"))
        .and_then(|t| t.as_array())
        .cloned()
        .unwrap_or_default();

    let mut handles = Vec::new();
    for (idx, tool) in tools.into_iter().enumerate() {
        let Some(name) = tool.get("name").and_then(|v| v.as_str()) else {
            continue;
        };
        let name_lower = name.to_lowercase();
        if !classify_mcp_read_tool(&name_lower) {
            continue;
        }
        let tool_name = name.to_string();
        let c = client.clone();
        let auth = auth_header.clone();
        let sid = session_id.clone();
        handles.push(tauri::async_runtime::spawn(async move {
            let mut req = c
                .post(mcp_url)
                .header("Authorization", auth)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json, text/event-stream")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
            if let Some(s) = sid {
                req = req.header("Mcp-Session-Id", s);
            }
            let r = req
                .json(&json!({
                    "jsonrpc": "2.0",
                    "id": 10 + idx,
                    "method": "tools/call",
                    "params": { "name": tool_name, "arguments": {} }
                }))
                .send()
                .await
                .ok()?;
            let txt = r.text().await.ok()?;
            let j = parse_mcp_text(&txt)?;
            let res_obj = j.get("result")?;
            if let Some(sc) = res_obj.get("structuredContent") {
                if !sc.is_null() {
                    return Some((name_lower, sc.clone()));
                }
            }
            if let Some(arr) = res_obj.get("content").and_then(|v| v.as_array()) {
                let mut texts = Vec::new();
                for item in arr {
                    if item.get("type").and_then(|v| v.as_str()) == Some("text") {
                        if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                            if let Ok(parsed) = serde_json::from_str::<Value>(t) {
                                return Some((name_lower, parsed));
                            }
                            texts.push(t.to_string());
                        }
                    }
                }
                if !texts.is_empty() {
                    return Some((name_lower, Value::String(texts.join("\n"))));
                }
            }
            Some((name_lower, res_obj.clone()))
        }));
    }

    let mut profile = Value::Null;
    let mut quests = Value::Null;
    let mut hideout = Value::Null;
    let mut projects = Value::Null;
    let mut blueprints = Value::Null;

    for h in handles {
        let Ok(Some((n, data))) = h.await else {
            continue;
        };
        if (n.contains("profile") || n.contains("account") || n.contains("user"))
            && profile.is_null()
        {
            profile = data.clone();
        }
        if n.contains("quest") {
            quests = data.get("quests").cloned().unwrap_or_else(|| data.clone());
        }
        if n.contains("hideout") || n.contains("workshop") {
            hideout = data
                .get("hideout")
                .or_else(|| data.get("modules"))
                .cloned()
                .unwrap_or_else(|| data.clone());
        }
        if n.contains("project") || n.contains("expedition") {
            projects = data
                .get("projects")
                .cloned()
                .unwrap_or_else(|| data.clone());
        }
        if n.contains("blueprint") {
            blueprints = data
                .get("blueprints")
                .cloned()
                .unwrap_or_else(|| data.clone());
        }
        if n.contains("progress") && data.is_object() {
            if quests.is_null() {
                if let Some(q) = data.get("quests") {
                    quests = q.clone();
                }
            }
            if hideout.is_null() {
                if let Some(hd) = data.get("hideout").or_else(|| data.get("modules")) {
                    hideout = hd.clone();
                }
            }
            if projects.is_null() {
                if let Some(pj) = data.get("projects") {
                    projects = pj.clone();
                }
            }
            if blueprints.is_null() {
                if let Some(bp) = data.get("blueprints") {
                    blueprints = bp.clone();
                }
            }
            if profile.is_null() {
                if let Some(pf) = data.get("user").or_else(|| data.get("profile")) {
                    profile = pf.clone();
                }
            }
        }
    }

    Ok(json!({
        "profile": profile,
        "quests": quests,
        "hideout": hideout,
        "projects": projects,
        "blueprints": blueprints,
    }))
}

async fn fetch_via_rest(
    client: &reqwest::Client,
    app_key: &str,
    bearer_token: &str,
) -> Result<Value, String> {
    let auth_val = format!("Bearer {bearer_token}");

    let fetch_ep = |ep: &'static str| {
        let c = client.clone();
        let auth = auth_val.clone();
        let ak = app_key.to_string();
        tauri::async_runtime::spawn(async move {
            let mut req = c
                .get(format!("https://arctracker.io{ep}"))
                .header("Authorization", auth)
                .header("Accept", "application/json")
                .header(
                    "User-Agent",
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) arc-map-desktop/0.1",
                );
            if !ak.is_empty() {
                req = req.header("X-App-Key", ak);
            }
            match req.send().await {
                Ok(resp) => {
                    let ok = resp.status().is_success();
                    let status = resp.status().as_u16();
                    let body = resp.json::<Value>().await.unwrap_or(Value::Null);
                    (ok, status, body)
                }
                Err(_) => (false, 502, Value::Null),
            }
        })
    };

    let t_prof = fetch_ep("/api/v2/user/profile");
    let t_quests = fetch_ep("/api/v2/user/quests?locale=en&filter=completed");
    let t_hideout = fetch_ep("/api/v2/user/hideout?locale=en");
    let t_projects = fetch_ep("/api/v2/user/projects?locale=en");
    let t_blueprints = fetch_ep("/api/v2/user/blueprints?locale=en&filter=learned");

    let prof = t_prof.await.unwrap_or((false, 502, Value::Null));
    let quests = t_quests.await.unwrap_or((false, 502, Value::Null));
    let hideout = t_hideout.await.unwrap_or((false, 502, Value::Null));
    let projects = t_projects.await.unwrap_or((false, 502, Value::Null));
    let blueprints = t_blueprints.await.unwrap_or((false, 502, Value::Null));

    if !prof.0 && !quests.0 && !hideout.0 && !projects.0 && !blueprints.0 {
        let extract_err = |r: &(bool, u16, Value)| -> Option<String> {
            r.2.get("error")
                .and_then(|e| e.get("message").or(Some(e)))
                .and_then(|v| v.as_str())
                .or_else(|| r.2.get("message").and_then(|v| v.as_str()))
                .map(|s| s.to_string())
        };
        let msg = extract_err(&prof)
            .or_else(|| extract_err(&quests))
            .or_else(|| extract_err(&blueprints))
            .unwrap_or_else(|| format!("ArcTracker 响应异常 (HTTP {})", prof.1));
        return Err(msg);
    }

    let unwrap_data = |res: (bool, u16, Value)| -> Value {
        if !res.0 {
            return Value::Null;
        }
        res.2.get("data").cloned().unwrap_or(res.2)
    };

    Ok(json!({
        "profile": unwrap_data(prof),
        "quests": unwrap_data(quests),
        "hideout": unwrap_data(hideout),
        "projects": unwrap_data(projects),
        "blueprints": unwrap_data(blueprints),
    }))
}

async fn fetch_arctracker_bundle(
    client: &reqwest::Client,
    app_key: &str,
    bearer_token: &str,
) -> Result<Value, String> {
    if !app_key.is_empty() {
        fetch_via_rest(client, app_key, bearer_token).await
    } else {
        match fetch_via_mcp(client, bearer_token).await {
            Ok(data) => Ok(data),
            Err(_) => fetch_via_rest(client, "", bearer_token).await,
        }
    }
}

#[tauri::command]
pub async fn sync_arctracker_quests(
    state: tauri::State<'_, ApiBridgeState>,
    app_key: Option<String>,
    user_key: Option<String>,
    api_key: Option<String>,
) -> Result<Value, String> {
    let raw_user = user_key.or(api_key).unwrap_or_default();
    let trimmed = raw_user.trim();
    if trimmed.is_empty() {
        return Err("请先点击一键授权或填入密钥".into());
    }
    let clean_token = if trimmed.len() > 7 && trimmed[..7].eq_ignore_ascii_case("bearer ") {
        trimmed[7..].trim()
    } else {
        trimmed
    };
    let clean_app_key = app_key.unwrap_or_default().trim().to_string();

    let data = fetch_arctracker_bundle(&state.http, &clean_app_key, clean_token).await?;

    Ok(json!({
        "ok": true,
        "syncedAt": now_ms(),
        "profile": data.get("profile").cloned().unwrap_or(Value::Null),
        "quests": data.get("quests").cloned().unwrap_or(Value::Null),
        "hideout": data.get("hideout").cloned().unwrap_or(Value::Null),
        "projects": data.get("projects").cloned().unwrap_or(Value::Null),
        "blueprints": data.get("blueprints").cloned().unwrap_or(Value::Null),
    }))
}

// ============================================================================
// Production Desktop OAuth 2.0 PKCE Loopback Flow
// ============================================================================

fn build_callback_html(ok: bool, err_msg: &str) -> String {
    let title = if ok { "✓ 数据同步完成" } else { "授权失败" };
    let subtitle = if ok {
        "请切回 only raiders 界面，此页面可直接关闭".to_string()
    } else {
        err_msg
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
    };
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\"><title>only raiders · 授权同步</title></head>\
         <body style=\"background:#0d0f17;color:#f5ebd6;font-family:sans-serif;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;height:100vh;margin:0\">\
         <div style=\"font-size:18px;font-weight:700;color:#ffbc13\">{title}</div>\
         <div style=\"font-size:13px;color:#9ca3af\">{subtitle}</div>\
         <script>try{{setTimeout(function(){{window.close();}},800);}}catch(e){{}}</script>\
         </body></html>"
    )
}

fn write_http_html(mut stream: std::net::TcpStream, html: &str) {
    let bytes = html.as_bytes();
    let header = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        bytes.len()
    );
    let _ = stream.write_all(header.as_bytes());
    let _ = stream.write_all(bytes);
    let _ = stream.flush();
}

#[tauri::command]
pub async fn start_arctracker_oauth(
    state: tauri::State<'_, ApiBridgeState>,
) -> Result<Value, String> {
    // Clean up stale OAuth sessions
    if let Ok(mut pending) = state.pending_pkce.lock() {
        pending.retain(|_, v| v.created_at.elapsed() < OAUTH_SESSION_TTL);
    }

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("无法绑定本地授权回调端口：{e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("读取本地回调端口失败：{e}"))?
        .port();
    let _ = listener.set_nonblocking(true);

    let redirect_uri = format!("http://127.0.0.1:{port}/api/arctracker-oauth/callback");

    let reg_resp = state
        .http
        .post("https://arctracker.io/api/auth/oauth2/register")
        .json(&json!({
            "client_name": "ARC Map Local",
            "redirect_uris": [&redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
            "scope": "game:read progress:read inventory:read offline_access",
        }))
        .send()
        .await
        .map_err(|e| format!("OAuth 客户端注册请求失败：{e}"))?;

    let reg_json = reg_resp
        .json::<Value>()
        .await
        .map_err(|e| format!("解析 OAuth 注册响应失败：{e}"))?;
    let client_id = reg_json
        .get("client_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "OAuth 客户端注册失败".to_string())?
        .to_string();

    let mut rnd_verifier = [0u8; 32];
    let mut rnd_state = [0u8; 16];
    fill_csprng(&mut rnd_verifier);
    fill_csprng(&mut rnd_state);

    let verifier = base64url_encode(&rnd_verifier);
    let challenge = base64url_encode(&sha256(verifier.as_bytes()));
    let oauth_state = hex_encode(&rnd_state);

    if let Ok(mut pending) = state.pending_pkce.lock() {
        pending.insert(
            oauth_state.clone(),
            PendingPkce {
                client_id: client_id.clone(),
                verifier,
                redirect_uri: redirect_uri.clone(),
                created_at: Instant::now(),
            },
        );
    }

    let auth_query = [
        ("response_type", "code"),
        ("client_id", client_id.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("scope", "game:read progress:read inventory:read offline_access"),
        ("code_challenge", challenge.as_str()),
        ("code_challenge_method", "S256"),
        ("state", oauth_state.as_str()),
        ("resource", "https://mcp.arctracker.io/mcp"),
    ]
    .iter()
    .map(|(k, v)| format!("{}={}", url_encode(k), url_encode(v)))
    .collect::<Vec<_>>()
    .join("&");

    let auth_init_url = format!("https://arctracker.io/api/auth/oauth2/authorize?{auth_query}");
    let mut target_url = auth_init_url.clone();

    if let Ok(auth_res) = state.http_no_redirect.get(&auth_init_url).send().await {
        if let Some(loc) = auth_res
            .headers()
            .get("location")
            .and_then(|v| v.to_str().ok())
        {
            target_url = if loc.starts_with("http") {
                loc.to_string()
            } else {
                format!("https://arctracker.io{loc}")
            };
        } else if let Ok(j) = auth_res.json::<Value>().await {
            if let Some(u) = j.get("url").and_then(|v| v.as_str()) {
                target_url = if u.starts_with("http") {
                    u.to_string()
                } else {
                    format!("https://arctracker.io{u}")
                };
            }
        }
    }

    open_system_browser(&target_url);

    let shared = state.inner().clone();
    let expected_state = oauth_state.clone();
    std::thread::spawn(move || {
        let started = Instant::now();
        while started.elapsed() < OAUTH_SESSION_TTL {
            match listener.accept() {
                Ok((mut stream, _)) => {
                    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
                    let mut buf = [0u8; 8192];
                    let n = stream.read(&mut buf).unwrap_or(0);
                    if n == 0 {
                        continue;
                    }
                    let req_str = String::from_utf8_lossy(&buf[..n]);
                    let first_line = req_str.lines().next().unwrap_or("");
                    let raw_target = first_line.split_whitespace().nth(1).unwrap_or("");
                    if !raw_target.starts_with("/api/arctracker-oauth/callback") {
                        write_http_html(stream, "<!doctype html><html><body>OK</body></html>");
                        continue;
                    }

                    let query = raw_target.splitn(2, '?').nth(1).unwrap_or("");
                    let params = parse_query_params(query);
                    let cb_state = params.get("state").cloned().unwrap_or_default();
                    let code = params.get("code").cloned().unwrap_or_default();
                    let oauth_err = params
                        .get("error_description")
                        .or_else(|| params.get("error"))
                        .cloned();

                    let pkce_opt = shared
                        .pending_pkce
                        .lock()
                        .ok()
                        .and_then(|mut m| m.remove(&cb_state));

                    if oauth_err.is_some() || code.is_empty() || pkce_opt.is_none() {
                        let msg = oauth_err.unwrap_or_else(|| "无效的授权状态".to_string());
                        let html = build_callback_html(false, &msg);
                        write_http_html(stream, &html);
                        let target_key = if cb_state.is_empty() {
                            expected_state.clone()
                        } else {
                            cb_state
                        };
                        if let Ok(mut done) = shared.completed_oauth.lock() {
                            done.insert(
                                target_key,
                                json!({ "ok": false, "error": msg }),
                            );
                        }
                        break;
                    }

                    let pkce = pkce_opt.unwrap();
                    let outcome = tauri::async_runtime::block_on(async {
                        let form_body = [
                            ("grant_type", "authorization_code"),
                            ("client_id", pkce.client_id.as_str()),
                            ("code", code.as_str()),
                            ("redirect_uri", pkce.redirect_uri.as_str()),
                            ("code_verifier", pkce.verifier.as_str()),
                            ("resource", "https://mcp.arctracker.io/mcp"),
                        ]
                        .iter()
                        .map(|(k, v)| format!("{}={}", url_encode(k), url_encode(v)))
                        .collect::<Vec<_>>()
                        .join("&");

                        let token_res = shared
                            .http
                            .post("https://arctracker.io/api/auth/oauth2/token")
                            .header("Content-Type", "application/x-www-form-urlencoded")
                            .body(form_body)
                            .send()
                            .await
                            .map_err(|e| format!("换取访问令牌失败：{e}"))?;

                        let token_json = token_res.json::<Value>().await.unwrap_or(Value::Null);
                        let access_token = token_json
                            .get("access_token")
                            .and_then(|v| v.as_str())
                            .ok_or_else(|| {
                                token_json
                                    .get("error_description")
                                    .or_else(|| token_json.get("error"))
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("未能获取访问令牌")
                                    .to_string()
                            })?
                            .to_string();
                        let refresh_token = token_json
                            .get("refresh_token")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();

                        let bundle = fetch_arctracker_bundle(&shared.http, "", &access_token).await?;
                        Ok::<Value, String>(json!({
                            "ok": true,
                            "syncedAt": now_ms(),
                            "accessToken": access_token,
                            "refreshToken": refresh_token,
                            "clientId": pkce.client_id,
                            "profile": bundle.get("profile").cloned().unwrap_or(Value::Null),
                            "quests": bundle.get("quests").cloned().unwrap_or(Value::Null),
                            "hideout": bundle.get("hideout").cloned().unwrap_or(Value::Null),
                            "projects": bundle.get("projects").cloned().unwrap_or(Value::Null),
                            "blueprints": bundle.get("blueprints").cloned().unwrap_or(Value::Null),
                        }))
                    });

                    match outcome {
                        Ok(payload) => {
                            let html = build_callback_html(true, "");
                            write_http_html(stream, &html);
                            if let Ok(mut done) = shared.completed_oauth.lock() {
                                done.insert(cb_state, payload);
                            }
                        }
                        Err(err) => {
                            let html = build_callback_html(false, &err);
                            write_http_html(stream, &html);
                            if let Ok(mut done) = shared.completed_oauth.lock() {
                                done.insert(cb_state, json!({ "ok": false, "error": err }));
                            }
                        }
                    }
                    break;
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(120));
                }
                Err(_) => break,
            }
        }
    });

    Ok(json!({
        "ok": true,
        "state": oauth_state,
        "authUrl": target_url,
    }))
}

#[tauri::command]
pub async fn poll_arctracker_oauth(
    state: tauri::State<'_, ApiBridgeState>,
    oauth_state: String,
) -> Result<Value, String> {
    if let Ok(mut done) = state.completed_oauth.lock() {
        if let Some(mut res) = done.remove(&oauth_state) {
            if let Some(obj) = res.as_object_mut() {
                obj.insert("status".to_string(), Value::String("done".to_string()));
            }
            return Ok(res);
        }
    }
    if let Ok(mut pending) = state.pending_pkce.lock() {
        if let Some(entry) = pending.get(&oauth_state) {
            if entry.created_at.elapsed() < OAUTH_SESSION_TTL {
                return Ok(json!({ "status": "pending" }));
            }
            pending.remove(&oauth_state);
        }
    }
    Ok(json!({
        "status": "expired",
        "ok": false,
        "error": "授权会话已过期",
    }))
}
