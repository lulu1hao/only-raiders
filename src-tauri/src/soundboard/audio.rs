use super::{decode::Clip, Settings};
use cpal::{
    traits::{DeviceTrait, HostTrait, StreamTrait},
    Device, SampleFormat, Stream, StreamConfig,
};
use rtrb::{Consumer, Producer, RingBuffer};
use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, AtomicU32, AtomicU64, AtomicU8, Ordering},
    mpsc, Arc, Mutex,
};

pub const OFF: u8 = 0;
pub const PREVIEW: u8 = 1;
pub const BROADCAST: u8 = 2;
#[derive(Default)]
pub struct Transport {
    pub clip: Option<Arc<Clip>>,
    pub track_id: Option<String>,
    pub cursor: f64,
    pub playing: bool,
    pub loading: bool,
}
impl Transport {
    fn next_music(&mut self, output_rate: u32, looping: bool) -> [f32; 2] {
        if !self.playing {
            return [0.; 2];
        }
        let Some(clip) = self.clip.as_ref() else {
            return [0.; 2];
        };
        if self.cursor >= clip.frames.len() as f64 {
            if looping {
                self.cursor %= clip.frames.len() as f64;
            } else {
                self.playing = false;
                return [0.; 2];
            }
        }
        let sample = clip.sample(self.cursor);
        self.cursor += clip.rate as f64 / output_rate as f64;
        sample
    }
}
pub struct Shared {
    pub transport: Mutex<Transport>,
    pub generation: AtomicU64,
    pub mode: AtomicU8,
    pub fault: AtomicBool,
    pub mic_muted: AtomicBool,
    pub looping: AtomicBool,
    pub music_gain: AtomicU32,
    pub mic_gain: AtomicU32,
    pub monitor_gain: AtomicU32,
    pub music_peak: AtomicU32,
    pub mic_peak: AtomicU32,
    pub output_peak: AtomicU32,
    pub error: Mutex<Option<String>>,
}
impl Default for Shared {
    fn default() -> Self {
        Self {
            transport: Mutex::new(Transport::default()),
            generation: AtomicU64::new(0),
            mode: AtomicU8::new(OFF),
            fault: AtomicBool::new(false),
            mic_muted: AtomicBool::new(false),
            looping: AtomicBool::new(false),
            music_gain: AtomicU32::new(0.5f32.to_bits()),
            mic_gain: AtomicU32::new(1f32.to_bits()),
            monitor_gain: AtomicU32::new(0.5f32.to_bits()),
            music_peak: AtomicU32::new(0),
            mic_peak: AtomicU32::new(0),
            output_peak: AtomicU32::new(0),
            error: Mutex::new(None),
        }
    }
}
pub fn gain(value: &AtomicU32) -> f32 {
    f32::from_bits(value.load(Ordering::Relaxed))
}
pub fn set_gain(value: &AtomicU32, gain: f32) {
    value.store(gain.to_bits(), Ordering::Relaxed);
}
impl Shared {
    pub fn apply(&self, settings: &Settings) {
        set_gain(&self.music_gain, settings.music_volume);
        set_gain(&self.mic_gain, settings.mic_volume);
        set_gain(&self.monitor_gain, settings.monitor_volume);
        self.looping.store(settings.looping, Ordering::Relaxed);
    }
    pub fn stop(&self) {
        // Stop also invalidates any decode in flight, so a late load cannot restart playback.
        let _old_clip = {
            let mut transport = self.transport.lock().unwrap();
            self.generation.fetch_add(1, Ordering::AcqRel);
            transport.playing = false;
            transport.loading = false;
            transport.cursor = 0.;
            transport.track_id = None;
            transport.clip.take()
        };
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub virtual_hint: bool,
}
#[derive(Serialize)]
pub struct Devices {
    pub inputs: Vec<AudioDevice>,
    pub outputs: Vec<AudioDevice>,
}
pub fn virtual_hint(name: &str) -> bool {
    let name = name.to_lowercase();
    if name.contains("virtual surround") || name.contains("virtual 7.1") {
        return false;
    }
    ["cable", "voicemeeter", "vb-audio", "virtual audio cable", "virtual cable"]
        .iter()
        .any(|s| name.contains(s))
}
pub fn devices() -> Result<Devices, String> {
    let host = cpal::default_host();
    let map = |device: Device| {
        device.name().ok().map(|name| AudioDevice {
            id: name.clone(),
            virtual_hint: virtual_hint(&name),
            name,
        })
    };
    Ok(Devices {
        inputs: host
            .input_devices()
            .map_err(|e| e.to_string())?
            .filter_map(map)
            .collect(),
        outputs: host
            .output_devices()
            .map_err(|e| e.to_string())?
            .filter_map(map)
            .collect(),
    })
}
fn find_device(name: &str, input: bool) -> Result<Device, String> {
    if name.is_empty() {
        return Err("请先选择音频设备并保存设置".into());
    }
    let host = cpal::default_host();
    let devices = if input {
        host.input_devices()
    } else {
        host.output_devices()
    }
    .map_err(|e| e.to_string())?;
    let mut matches = devices.filter(|d| d.name().ok().as_deref() == Some(name));
    let device = matches
        .next()
        .ok_or_else(|| format!("设备已离线：{name}。请刷新设备列表并重新选择。"))?;
    Ok(device)
}

// Bounded SPSC queues join independent hardware clocks. Interpolation belongs to
// the consumer. Occupancy corrects drift; discontinuities discard stale frames.
struct ClockBridge {
    consumer: Consumer<[f32; 2]>,
    rate: f64,
    target: usize,
    a: [f32; 2],
    b: [f32; 2],
    phase: f64,
    ready: bool,
    step: f64,
}
impl ClockBridge {
    fn new(consumer: Consumer<[f32; 2]>, source_rate: u32, target_rate: u32) -> Self {
        let rate = source_rate as f64 / target_rate as f64;
        Self {
            consumer,
            rate,
            target: (source_rate as usize / 50).max(2),
            a: [0.; 2],
            b: [0.; 2],
            phase: 0.,
            ready: false,
            step: rate,
        }
    }
    fn prepare(&mut self) {
        let available = self.consumer.slots();
        if available > self.target * 5 {
            for _ in 0..available - self.target {
                let _ = self.consumer.pop();
            }
            self.ready = false;
        }
        let error = (self.consumer.slots() as f64 - self.target as f64) / self.target as f64;
        self.step = self.rate * (1.0 + (error * 0.002).clamp(-0.01, 0.01));
    }
    fn next(&mut self) -> [f32; 2] {
        if !self.ready {
            if self.consumer.slots() < self.target {
                return [0.; 2];
            }
            self.a = self.consumer.pop().unwrap_or([0.; 2]);
            self.b = self.consumer.pop().unwrap_or([0.; 2]);
            self.phase = 0.;
            self.ready = true;
        }
        let mix = self.phase as f32;
        let sample = [
            self.a[0] + (self.b[0] - self.a[0]) * mix,
            self.a[1] + (self.b[1] - self.a[1]) * mix,
        ];
        self.phase += self.step;
        while self.phase >= 1.0 {
            self.phase -= 1.0;
            self.a = self.b;
            match self.consumer.pop() {
                Ok(b) => self.b = b,
                Err(_) => {
                    self.ready = false;
                    break;
                }
            }
        }
        sample
    }
}
pub enum EngineCommand {
    Connect(Settings, u8, mpsc::Sender<Result<(), String>>),
    Disconnect(mpsc::Sender<Result<(), String>>),
    Shutdown,
}
pub fn spawn(shared: Arc<Shared>) -> mpsc::Sender<EngineCommand> {
    let (tx, rx) = mpsc::channel();
    std::thread::Builder::new()
        .name("soundboard-devices".into())
        .spawn(move || {
            let mut streams = Vec::<Stream>::new();
            loop {
                match rx.recv_timeout(std::time::Duration::from_millis(100)) {
                    Ok(EngineCommand::Connect(settings, mode, reply)) => {
                        shared.mode.store(OFF, Ordering::Release);
                        shared.stop();
                        streams.clear();
                        shared.fault.store(false, Ordering::Release);
                        *shared.error.lock().unwrap() = None;
                        let result = connect(&shared, &settings, mode).map(|new_streams| {
                            streams = new_streams;
                            shared.mode.store(mode, Ordering::Release);
                        });
                        if let Err(error) = &result {
                            *shared.error.lock().unwrap() = Some(error.clone());
                        }
                        let _ = reply.send(result);
                    }
                    Ok(EngineCommand::Disconnect(reply)) => {
                        shared.mode.store(OFF, Ordering::Release);
                        shared.stop();
                        streams.clear();
                        let _ = reply.send(Ok(()));
                    }
                    Ok(EngineCommand::Shutdown) | Err(mpsc::RecvTimeoutError::Disconnected) => {
                        break
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                }
                if shared.fault.load(Ordering::Acquire) {
                    shared.mode.store(OFF, Ordering::Release);
                    shared.stop();
                    streams.clear();
                }
                if streams.is_empty() {
                    set_gain(&shared.music_peak, 0.);
                    set_gain(&shared.mic_peak, 0.);
                    set_gain(&shared.output_peak, 0.);
                }
            }
        })
        .expect("cannot start audio worker");
    tx
}
fn on_error(shared: Arc<Shared>) -> impl FnMut(cpal::StreamError) + Send + 'static {
    move |error| {
        shared.fault.store(true, Ordering::Release);
        *shared.error.lock().unwrap() =
            Some(format!("音频设备中断，发送已停止。请重新连接：{error}"));
    }
}
fn write_frame<T: cpal::Sample + cpal::FromSample<f32>>(frame: &mut [T], stereo: [f32; 2]) {
    let channels = frame.len();
    for (channel, sample) in frame.iter_mut().enumerate() {
        let value = if channels == 1 {
            (stereo[0] + stereo[1]) * 0.5
        } else if channel < 2 {
            stereo[channel]
        } else {
            0.
        };
        *sample = T::from_sample(value.clamp(-0.98, 0.98));
    }
}
fn capture<T>(
    device: &Device,
    config: &StreamConfig,
    mut producer: Producer<[f32; 2]>,
    shared: Arc<Shared>,
) -> Result<Stream, String>
where
    T: cpal::SizedSample,
    f32: cpal::FromSample<T>,
{
    let channels = config.channels as usize;
    device
        .build_input_stream(
            config,
            move |data: &[T], _| {
                for frame in data.chunks_exact(channels) {
                    let clean = |sample| {
                        let v = <f32 as cpal::FromSample<T>>::from_sample_(sample);
                        if v.is_finite() {
                            v
                        } else {
                            0.
                        }
                    };
                    let _ = producer.push([clean(frame[0]), clean(frame[(channels - 1).min(1)])]);
                }
            },
            on_error(shared),
            None,
        )
        .map_err(|e| format!("无法打开麦克风：{e}"))
}
fn monitor<T>(
    device: &Device,
    config: &StreamConfig,
    mut source: ClockBridge,
    shared: Arc<Shared>,
) -> Result<Stream, String>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let channels = config.channels as usize;
    let errors = shared.clone();
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| {
                source.prepare();
                let volume = gain(&shared.monitor_gain);
                for frame in data.chunks_exact_mut(channels) {
                    let music = source.next();
                    write_frame(
                        frame,
                        if shared.fault.load(Ordering::Relaxed) {
                            [0.; 2]
                        } else {
                            [music[0] * volume, music[1] * volume]
                        },
                    );
                }
            },
            on_error(errors),
            None,
        )
        .map_err(|e| format!("无法打开监听耳机：{e}"))
}
fn output<T>(
    device: &Device,
    config: &StreamConfig,
    mut mic: Option<ClockBridge>,
    mut monitor: Option<Producer<[f32; 2]>>,
    shared: Arc<Shared>,
    mode: u8,
) -> Result<Stream, String>
where
    T: cpal::SizedSample + cpal::FromSample<f32>,
{
    let channels = config.channels as usize;
    let rate = config.sample_rate.0;
    let errors = shared.clone();
    device
        .build_output_stream(
            config,
            move |data: &mut [T], _| {
                if let Some(source) = mic.as_mut() {
                    source.prepare();
                }
                let mut transport = shared.transport.try_lock().ok();
                let music_gain = if mode == PREVIEW {
                    gain(&shared.monitor_gain)
                } else {
                    gain(&shared.music_gain)
                };
                let mic_gain = if shared.mic_muted.load(Ordering::Relaxed) {
                    0.
                } else {
                    gain(&shared.mic_gain)
                };
                let looping = shared.looping.load(Ordering::Relaxed);
                let mut music_peak: f32 = 0.;
                let mut mic_peak: f32 = 0.;
                let mut output_peak: f32 = 0.;
                for frame in data.chunks_exact_mut(channels) {
                    let voice = mic.as_mut().map_or([0.; 2], |source| source.next());
                    let mut music = [0.; 2];
                    if let Some(t) = transport.as_mut() {
                        music = t.next_music(rate, looping);
                    }
                    if shared.fault.load(Ordering::Relaxed) {
                        write_frame(frame, [0.; 2]);
                        continue;
                    }
                    if let Some(sink) = monitor.as_mut() {
                        let _ = sink.push(music);
                    }
                    let mut mixed = [0.; 2];
                    for channel in 0..2 {
                        let m = music[channel] * music_gain;
                        let v = voice[channel] * mic_gain;
                        mixed[channel] = (m + v).clamp(-0.98, 0.98);
                        music_peak = music_peak.max(m.abs());
                        mic_peak = mic_peak.max(v.abs());
                        output_peak = output_peak.max(mixed[channel].abs());
                    }
                    write_frame(frame, mixed);
                }
                let decay = 0.85f32;
                set_gain(&shared.music_peak, music_peak.max(gain(&shared.music_peak) * decay));
                set_gain(&shared.mic_peak, mic_peak.max(gain(&shared.mic_peak) * decay));
                set_gain(&shared.output_peak, output_peak.max(gain(&shared.output_peak) * decay));
            },
            on_error(errors),
            None,
        )
        .map_err(|e| format!("无法打开播放设备：{e}"))
}
macro_rules! with_format {
    ($format:expr, $function:ident, $($arg:expr),*) => { match $format {
        SampleFormat::F32 => $function::<f32>($($arg),*), SampleFormat::I16 => $function::<i16>($($arg),*),
        SampleFormat::I32 => $function::<i32>($($arg),*), SampleFormat::U16 => $function::<u16>($($arg),*),
        _ => Err("不支持该设备的音频格式，请在 Windows 声音设置中选择 16/24/32 位格式".into()),
    }};
}
fn connect(shared: &Arc<Shared>, settings: &Settings, mode: u8) -> Result<Vec<Stream>, String> {
    if mode != PREVIEW && mode != BROADCAST {
        return Err("无效的连接模式".into());
    }
    let target = if mode == PREVIEW {
        &settings.monitor_device
    } else {
        &settings.output_device
    };
    if mode == BROADCAST && !virtual_hint(target) {
        return Err("游戏发送需要虚拟音频设备（如 CABLE Input）。请先安装虚拟声卡，或使用本地试听。".into());
    }
    if mode == PREVIEW && virtual_hint(target) {
        return Err("本地试听请选择真实耳机或扬声器".into());
    }
    if mode == BROADCAST
        && settings.monitor_enabled
        && settings.monitor_device == settings.output_device
    {
        return Err("监听耳机不能与发送设备相同，否则会重复播放".into());
    }
    let device = find_device(target, false)?;
    let supported = device.default_output_config().map_err(|e| e.to_string())?;
    let format = supported.sample_format();
    let config = supported.config();
    let mut streams = Vec::new();
    let mut mic_source = None;
    let mut monitor_sink = None;
    if mode == BROADCAST && settings.mic_enabled {
        if virtual_hint(&settings.mic_device) {
            return Err("真实麦克风不能选择虚拟声卡，以免形成回声循环".into());
        }
        let device = find_device(&settings.mic_device, true)?;
        let supported = device.default_input_config().map_err(|e| e.to_string())?;
        let input_config = supported.config();
        let (producer, consumer) = RingBuffer::new(input_config.sample_rate.0 as usize / 4);
        mic_source = Some(ClockBridge::new(
            consumer,
            input_config.sample_rate.0,
            config.sample_rate.0,
        ));
        streams.push(with_format!(
            supported.sample_format(),
            capture,
            &device,
            &input_config,
            producer,
            shared.clone()
        )?);
    }
    if mode == BROADCAST && settings.monitor_enabled {
        if virtual_hint(&settings.monitor_device) {
            return Err("监听设备请选择真实耳机或扬声器".into());
        }
        let device = find_device(&settings.monitor_device, false)?;
        let supported = device.default_output_config().map_err(|e| e.to_string())?;
        let monitor_config = supported.config();
        let (producer, consumer) = RingBuffer::new(config.sample_rate.0 as usize / 4);
        let source = ClockBridge::new(consumer, config.sample_rate.0, monitor_config.sample_rate.0);
        monitor_sink = Some(producer);
        streams.push(with_format!(
            supported.sample_format(),
            monitor,
            &device,
            &monitor_config,
            source,
            shared.clone()
        )?);
    }
    streams.push(with_format!(
        format,
        output,
        &device,
        &config,
        mic_source,
        monitor_sink,
        shared.clone(),
        mode
    )?);
    for stream in &streams {
        stream
            .play()
            .map_err(|e| format!("音频设备启动失败：{e}"))?;
    }
    Ok(streams)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bridge_waits_for_prefill_and_bounds_latency() {
        let (mut tx, rx) = RingBuffer::new(12000);
        let mut bridge = ClockBridge::new(rx, 48000, 44100);
        assert_eq!(bridge.next(), [0.; 2]);
        for _ in 0..8000 {
            tx.push([0.25; 2]).unwrap();
        }
        bridge.prepare();
        assert!(bridge.consumer.slots() <= bridge.target);
        for _ in 0..100 {
            assert_eq!(bridge.next(), [0.25; 2]);
        }
    }
    #[test]
    fn output_downmixes_and_limits() {
        let mut mono = [0f32];
        write_frame(&mut mono, [2., 2.]);
        assert_eq!(mono, [0.98]);
        let mut surround = [1f32; 6];
        write_frame(&mut surround, [0.5, -0.5]);
        assert_eq!(surround, [0.5, -0.5, 0., 0., 0., 0.]);
    }
    #[test]
    fn stop_invalidates_inflight_loads() {
        let state = Shared::default();
        state.transport.lock().unwrap().loading = true;
        let ticket = state.generation.load(Ordering::Acquire);
        state.stop();
        assert_ne!(ticket, state.generation.load(Ordering::Acquire));
        assert!(!state.transport.lock().unwrap().loading);
    }
    #[test]
    fn playback_resamples_pauses_and_loops_at_the_end() {
        let mut t = Transport {
            clip: Some(Arc::new(Clip {
                frames: vec![[0.2; 2], [0.6; 2]],
                rate: 24000,
            })),
            playing: true,
            ..Default::default()
        };
        assert_eq!(t.next_music(48000, false), [0.2; 2]);
        assert!((t.next_music(48000, false)[0] - 0.4).abs() < 0.0001);
        t.playing = false;
        let cursor = t.cursor;
        assert_eq!(t.next_music(48000, false), [0.; 2]);
        assert_eq!(t.cursor, cursor);
        t.playing = true;
        t.cursor = 2.;
        assert_eq!(t.next_music(48000, true), [0.2; 2]);
        t.cursor = 2.;
        assert_eq!(t.next_music(48000, false), [0.; 2]);
        assert!(!t.playing);
    }
    #[test]
    #[ignore = "Requires LULU_AUDIO_TEST_OUTPUT; plays silence only, never opens a microphone"]
    fn native_silent_playback_lifecycle() {
        let output = std::env::var("LULU_AUDIO_TEST_OUTPUT").expect("set a physical output device name");
        let shared = Arc::new(Shared::default());
        let tx = spawn(shared.clone());
        let settings = Settings { monitor_device: output, ..Default::default() };
        let (reply, rx) = mpsc::channel();
        tx.send(EngineCommand::Connect(settings, PREVIEW, reply)).unwrap();
        rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap().unwrap();
        assert_eq!(shared.mode.load(Ordering::Acquire), PREVIEW);
        {
            let mut t = shared.transport.lock().unwrap();
            t.clip = Some(Arc::new(Clip { frames: vec![[0.; 2]; 48000], rate: 48000 }));
            t.playing = true;
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
        {
            let mut t = shared.transport.lock().unwrap();
            assert!(t.cursor > 0., "the native output callback must consume frames");
            t.playing = false;
        }
        let paused = shared.transport.lock().unwrap().cursor;
        std::thread::sleep(std::time::Duration::from_millis(60));
        assert_eq!(shared.transport.lock().unwrap().cursor, paused);
        shared.stop();
        assert_eq!(shared.transport.lock().unwrap().cursor, 0.);
        assert_eq!(shared.mode.load(Ordering::Acquire), PREVIEW, "stopping music must preserve the connection");
        let (reply, rx) = mpsc::channel(); tx.send(EngineCommand::Disconnect(reply)).unwrap();
        rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap().unwrap();
        assert_eq!(shared.mode.load(Ordering::Acquire), OFF);
        tx.send(EngineCommand::Shutdown).unwrap();
    }
    #[test]
    #[ignore = "Read-only device enumeration; opens no stream and never plays or records"]
    fn enumerate_host_audio_devices() {
        let list = devices().expect("device enumeration failed");
        println!("outputs: {}", list.outputs.len());
        for device in &list.outputs {
            println!("  [out] virtual={} name={:?}", device.virtual_hint, device.name);
        }
        println!("inputs: {}", list.inputs.len());
        for device in &list.inputs {
            println!("  [in ] virtual={} name={:?}", device.virtual_hint, device.name);
        }
    }
    #[test]
    fn virtual_hint_correctly_classifies_devices() {
        assert!(virtual_hint("CABLE Input (VB-Audio Virtual Cable)"));
        assert!(virtual_hint("VoiceMeeter Aux Input"));
        assert!(virtual_hint("Line 1 (Virtual Audio Cable)"));
        assert!(!virtual_hint("Razer USB Audio - Virtual Surround"));
        assert!(!virtual_hint("Logitech G430 Virtual 7.1 Surround Sound"));
        assert!(!virtual_hint("HyperX 7.1 Virtual Surround Sound"));
        assert!(!virtual_hint("Realtek High Definition Audio"));
    }
}
