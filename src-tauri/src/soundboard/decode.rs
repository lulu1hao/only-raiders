use std::{
    fs::File,
    path::Path,
    sync::atomic::{AtomicU64, Ordering},
};
use symphonia::core::{
    audio::SampleBuffer,
    codecs::DecoderOptions,
    errors::Error,
    formats::FormatOptions,
    io::{MediaSource, MediaSourceStream},
    meta::MetadataOptions,
    probe::Hint,
};

pub struct Clip {
    pub frames: Vec<[f32; 2]>,
    pub rate: u32,
}
impl Clip {
    pub fn duration(&self) -> f64 {
        self.frames.len() as f64 / self.rate as f64
    }
    pub fn sample(&self, position: f64) -> [f32; 2] {
        let index = position as usize;
        let Some(a) = self.frames.get(index) else {
            return [0.; 2];
        };
        let b = self.frames.get(index + 1).unwrap_or(a);
        let mix = position.fract() as f32;
        [a[0] + (b[0] - a[0]) * mix, a[1] + (b[1] - a[1]) * mix]
    }
}
pub fn decode_file(path: &Path, generation: &AtomicU64, ticket: u64) -> Result<Clip, String> {
    let file = File::open(path).map_err(|e| format!("无法打开音频，文件可能已移动：{e}"))?;
    if file.metadata().map_err(|e| e.to_string())?.len() > 256 * 1024 * 1024 {
        return Err("单个文件不能超过 256 MB".into());
    }
    decode(
        Box::new(file),
        path.extension().and_then(|s| s.to_str()).unwrap_or(""),
        || generation.load(Ordering::Acquire) != ticket,
    )
}
fn decode(
    source: Box<dyn MediaSource>,
    extension: &str,
    cancelled: impl Fn() -> bool,
) -> Result<Clip, String> {
    let mut hint = Hint::new();
    hint.with_extension(extension);
    let stream = MediaSourceStream::new(source, Default::default());
    let mut format = symphonia::default::get_probe()
        .format(
            &hint,
            stream,
            &FormatOptions::default(),
            &MetadataOptions::default(),
        )
        .map_err(|e| format!("无法识别音频：{e}"))?
        .format;
    let track = format.default_track().ok_or("文件中没有音轨")?;
    let id = track.id;
    let mut decoder = symphonia::default::get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|e| format!("不支持的音频编码：{e}"))?;
    let mut frames = Vec::new();
    let mut rate = 0;
    let mut sample_buf: Option<SampleBuffer<f32>> = None;
    let mut sample_buf_cap = 0usize;
    loop {
        if cancelled() {
            return Err("已取消加载".into());
        }
        let packet = match format.next_packet() {
            Ok(packet) => packet,
            Err(Error::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(format!("音频读取失败：{e}")),
        };
        if packet.track_id() != id {
            continue;
        }
        let decoded = decoder
            .decode(&packet)
            .map_err(|e| format!("音频解码失败：{e}"))?;
        let spec = *decoded.spec();
        if rate != 0 && rate != spec.rate {
            return Err("暂不支持中途改变采样率的音频".into());
        }
        rate = spec.rate;
        let channels = spec.channels.count();
        if rate == 0 || !(1..=2).contains(&channels) {
            return Err("首版支持单声道或双声道音频，请先转换多声道文件".into());
        }
        if frames.len() + decoded.frames() > (rate as usize * 60 * 15).min(24_000_000) {
            return Err("音频过长：最多 15 分钟，解码后的音频上限为 192 MB".into());
        }
        let needed_cap = decoded.capacity();
        if sample_buf.is_none() || sample_buf_cap < needed_cap {
            sample_buf = Some(SampleBuffer::<f32>::new(needed_cap as u64, spec));
            sample_buf_cap = needed_cap;
        }
        let buffer = sample_buf.as_mut().unwrap();
        buffer.copy_interleaved_ref(decoded);
        frames.extend(buffer.samples().chunks_exact(channels).map(|s| {
            let clean = |v: f32| if v.is_finite() { v.clamp(-1., 1.) } else { 0. };
            [clean(s[0]), clean(s[channels - 1])]
        }));
    }
    if frames.is_empty() {
        return Err("音频文件为空".into());
    }
    frames.shrink_to_fit();
    Ok(Clip { frames, rate })
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    fn wav() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend(b"RIFF");
        bytes.extend(40u32.to_le_bytes());
        bytes.extend(b"WAVEfmt ");
        bytes.extend(16u32.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(1u16.to_le_bytes());
        bytes.extend(48000u32.to_le_bytes());
        bytes.extend(96000u32.to_le_bytes());
        bytes.extend(2u16.to_le_bytes());
        bytes.extend(16u16.to_le_bytes());
        bytes.extend(b"data");
        bytes.extend(4u32.to_le_bytes());
        bytes.extend(16384i16.to_le_bytes());
        bytes.extend((-16384i16).to_le_bytes());
        bytes
    }
    #[test]
    fn decodes_mono_wav_and_interpolates_stereo() {
        let clip = decode(Box::new(Cursor::new(wav())), "wav", || false).unwrap();
        assert_eq!(clip.rate, 48000);
        assert_eq!(clip.frames.len(), 2);
        assert_eq!(clip.frames[0], [0.5, 0.5]);
        assert_eq!(clip.sample(0.5), [0., 0.]);
    }
    #[test]
    fn rejects_corrupt_files_and_cancels() {
        assert!(decode(Box::new(Cursor::new(vec![0; 40])), "mp3", || false).is_err());
        assert_eq!(
            decode(Box::new(Cursor::new(wav())), "wav", || true)
                .err()
                .unwrap(),
            "已取消加载"
        );
    }
}
