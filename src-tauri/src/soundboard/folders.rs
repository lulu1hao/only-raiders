use super::{timestamp, Library, Track};
use serde::Serialize;
use std::path::{Path, PathBuf};

pub const AUDIO_EXTENSIONS: [&str; 3] = ["mp3", "wav", "flac"];
// Bounded so a huge or nested music tree can never stall the app or bloat the list.
pub const MAX_DEPTH: usize = 4;
pub const MAX_FILE_BYTES: u64 = 256 * 1024 * 1024;

#[derive(Serialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub added: usize,
    pub removed: usize,
    pub skipped: usize,
    pub total: usize,
    pub truncated: bool,
    pub folders: usize,
    pub cancelled: bool,
}

pub struct Found {
    path: PathBuf,
    root: PathBuf,
}

pub struct Scan {
    pub found: Vec<Found>,
    pub skipped: usize,
    pub truncated: bool,
}

pub fn is_audio(path: &Path) -> bool {
    path.extension()
        .and_then(|s| s.to_str())
        .map(|ext| AUDIO_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

// Recursive and bounded: hidden entries and links are skipped so a reparse point cannot loop.
pub fn scan(folders: &[PathBuf], hidden: &[PathBuf], limit: usize) -> Scan {
    let mut found = Vec::new();
    let mut skipped = 0;
    let mut truncated = false;
    'roots: for root in folders {
        let mut stack = vec![(root.clone(), 0usize)];
        while let Some((directory, depth)) = stack.pop() {
            let Ok(entries) = std::fs::read_dir(&directory) else {
                continue;
            };
            let mut entries: Vec<_> = entries.flatten().collect();
            entries.sort_by_key(|entry| entry.file_name());
            for entry in entries {
                if found.len() >= limit {
                    truncated = true;
                    break 'roots;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') {
                    continue;
                }
                let Ok(kind) = entry.file_type() else {
                    continue;
                };
                if kind.is_symlink() {
                    continue;
                }
                let path = entry.path();
                if kind.is_dir() {
                    if depth + 1 <= MAX_DEPTH {
                        stack.push((path, depth + 1));
                    }
                    continue;
                }
                if !is_audio(&path) || hidden.iter().any(|item| item == &path) {
                    continue;
                }
                if entry.metadata().map(|meta| meta.len() <= MAX_FILE_BYTES).unwrap_or(false) {
                    found.push(Found {
                        path,
                        root: root.clone(),
                    });
                } else {
                    skipped += 1;
                }
            }
        }
    }
    found.sort_by(|a, b| {
        a.path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase()
            .cmp(
                &b.path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_lowercase(),
            )
    });
    Scan {
        found,
        skipped,
        truncated,
    }
}

// Merges a scan into the library: identities are matched by path, so favourites, renames and
// per-track shortcuts survive rescans, while deleted or hidden files leave the list.
pub fn merge(library: &mut Library, scan: Scan, limit: usize) -> ScanSummary {
    let mut summary = ScanSummary {
        skipped: scan.skipped,
        truncated: scan.truncated,
        folders: library.folders.len(),
        ..Default::default()
    };
    let known: Vec<PathBuf> = scan.found.iter().map(|item| item.path.clone()).collect();
    let before = library.tracks.len();
    library.tracks.retain(|track| match &track.source_folder {
        None => true,
        Some(_) => known.contains(&track.path),
    });
    summary.removed = before - library.tracks.len();
    for item in &scan.found {
        if library.tracks.len() >= limit {
            summary.truncated = true;
            break;
        }
        if library.tracks.iter().any(|track| track.path == item.path) {
            continue;
        }
        library.tracks.push(Track {
            id: format!("f{}_{}", timestamp(), summary.added),
            name: item
                .path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            path: item.path.clone(),
            favorite: false,
            shortcut: String::new(),
            source_folder: Some(item.root.clone()),
        });
        summary.added += 1;
    }
    // Manual imports keep their insertion order; folder entries stay alphabetically sorted.
    let (mut manual, mut watched): (Vec<Track>, Vec<Track>) = library
        .tracks
        .drain(..)
        .partition(|track| track.source_folder.is_none());
    watched.sort_by_key(|track| track.name.to_lowercase());
    manual.append(&mut watched);
    library.tracks = manual;
    summary.total = library.tracks.len();
    summary
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn workspace(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lulu-scan-{}-{}", name, timestamp()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn touch(path: &Path) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, b"data").unwrap();
    }

    // Scans the library's own folders; bound separately because merge needs the mutable borrow.
    fn rescan(library: &mut Library, limit: usize) -> ScanSummary {
        let scanned = scan(&library.folders, &library.hidden, 100);
        merge(library, scanned, limit)
    }

    #[test]
    fn scan_finds_audio_recursively_and_skips_noise() {
        let root = workspace("scan");
        touch(&root.join("b.mp3"));
        touch(&root.join("a.WAV"));
        touch(&root.join("notes.txt"));
        touch(&root.join(".hidden.mp3"));
        touch(&root.join("album").join("c.flac"));
        touch(&root.join("album").join("deep").join("d.mp3"));
        let result = scan(&[root.clone()], &[], 100);
        let names: Vec<String> = result
            .found
            .iter()
            .map(|item| item.path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert_eq!(names, vec!["a.WAV", "b.mp3", "c.flac", "d.mp3"]);
        assert_eq!(result.skipped, 0);
        assert!(!result.truncated);
        assert!(result.found.iter().all(|item| item.root == root));
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn scan_respects_hidden_paths_depth_and_limit() {
        let root = workspace("limits");
        touch(&root.join("keep.mp3"));
        touch(&root.join("skip.mp3"));
        let mut deep = root.clone();
        for level in 0..(MAX_DEPTH + 2) {
            deep = deep.join(format!("l{level}"));
        }
        touch(&deep.join("toodeep.mp3"));
        let hidden = vec![root.join("skip.mp3")];
        let result = scan(&[root.clone()], &hidden, 100);
        let names: Vec<String> = result
            .found
            .iter()
            .map(|item| item.path.file_name().unwrap().to_string_lossy().to_string())
            .collect();
        assert_eq!(names, vec!["keep.mp3"], "隐藏项与超深目录都必须被跳过");
        let limited = scan(&[root.clone()], &[], 1);
        assert_eq!(limited.found.len(), 1);
        assert!(limited.truncated);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn merge_keeps_identity_removes_deleted_and_sorts_folder_entries() {
        let root = workspace("merge");
        let first = root.join("02-第二首.mp3");
        let second = root.join("01-第一首.mp3");
        touch(&first);
        touch(&second);
        touch(&root.join("readme.txt"));

        let mut library = Library::default();
        library.folders = vec![root.clone()];
        let summary = rescan(&mut library, 100);
        assert_eq!(summary.added, 2);
        assert_eq!(summary.total, 2);
        assert_eq!(
            library.tracks.iter().map(|t| t.name.clone()).collect::<Vec<_>>(),
            vec!["01-第一首", "02-第二首"],
            "文件夹条目按名称排序"
        );
        assert!(library.tracks.iter().all(|t| t.source_folder.as_deref() == Some(root.as_path())));

        // Favourites, renames and shortcuts must survive a rescan of unchanged files.
        let target = library.tracks[0].id.clone();
        let track = library.tracks.iter_mut().find(|t| t.id == target).unwrap();
        track.favorite = true;
        track.name = "开场曲".into();
        track.shortcut = "Ctrl+Alt+1".into();
        let again = rescan(&mut library, 100);
        assert_eq!(again.added, 0);
        assert_eq!(again.removed, 0);
        let kept = library.tracks.iter().find(|t| t.id == target).unwrap();
        assert!(kept.favorite);
        assert_eq!(kept.name, "开场曲");
        assert_eq!(kept.shortcut, "Ctrl+Alt+1");

        // A deleted file leaves the list; a manually imported track is never touched.
        library.tracks.push(Track {
            id: "manual".into(),
            name: "手动导入".into(),
            path: root.join("missing-manual.mp3"),
            favorite: false,
            shortcut: String::new(),
            source_folder: None,
        });
        fs::remove_file(&first).unwrap();
        let third = rescan(&mut library, 100);
        assert_eq!(third.removed, 1);
        assert!(library.tracks.iter().any(|t| t.id == "manual"), "手动导入的条目必须保留");
        assert_eq!(library.tracks.len(), 2);
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn merge_honours_the_limit_and_reports_truncation() {
        let root = workspace("cap");
        for index in 0..5 {
            touch(&root.join(format!("track{index}.mp3")));
        }
        let mut library = Library::default();
        library.folders = vec![root.clone()];
        let summary = rescan(&mut library, 2);
        assert_eq!(summary.added, 2);
        assert!(summary.truncated);
        assert_eq!(library.tracks.len(), 2);
        fs::remove_dir_all(&root).unwrap();
    }
}
