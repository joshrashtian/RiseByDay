//! The user's sound folder: `<app config dir>/sounds/*.{mp3,wav,…}`.
//!
//! Imported task sounds live as plain audio files so they survive cache
//! clears, can be backed up, and can be dropped in straight from Finder.
//! Audio bytes cross the bridge as raw IPC bodies, not JSON arrays.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

const MAX_SOUND_BYTES: u64 = 2 * 1024 * 1024;
const AUDIO_EXTENSIONS: &[&str] = &["mp3", "wav", "ogg", "m4a", "aac", "webm"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSoundFile {
    pub file_name: String,
    pub size: u64,
    /// Epoch ms; lets the frontend skip re-reading unchanged files.
    pub modified: u64,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSoundsListing {
    pub dir: String,
    pub files: Vec<UserSoundFile>,
}

fn sounds_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("sounds");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// A bare `name.<audio ext>` — no separators or `..`, so it can't leave the folder.
fn safe_file_name(name: &str) -> Result<&str, String> {
    let ext_ok = Path::new(name)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| AUDIO_EXTENSIONS.contains(&e.to_ascii_lowercase().as_str()))
        .unwrap_or(false);
    let ok = ext_ok
        && name.len() <= 128
        && !name.starts_with('.')
        && Path::new(name).file_name().and_then(|n| n.to_str()) == Some(name);
    if ok {
        Ok(name)
    } else {
        Err(format!("Invalid sound file name: {name}"))
    }
}

#[tauri::command]
pub fn list_user_sounds(app: AppHandle) -> Result<UserSoundsListing, String> {
    let dir = sounds_dir(&app)?;
    let mut files: Vec<UserSoundFile> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|entry| {
            let file_name = entry.file_name().into_string().ok()?;
            safe_file_name(&file_name).ok()?;
            let meta = entry.metadata().ok()?;
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0);
            let error = (meta.len() > MAX_SOUND_BYTES).then(|| "File is larger than 2 MB".into());
            Some(UserSoundFile {
                file_name,
                size: meta.len(),
                modified,
                error,
            })
        })
        .collect();
    files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(UserSoundsListing {
        dir: dir.to_string_lossy().into_owned(),
        files,
    })
}

/// Returns the raw bytes of `file_name` (an `ArrayBuffer` on the JS side).
#[tauri::command]
pub fn read_user_sound(app: AppHandle, file_name: String) -> Result<Response, String> {
    let name = safe_file_name(&file_name)?;
    let path = sounds_dir(&app)?.join(name);
    let len = fs::metadata(&path).map_err(|e| e.to_string())?.len();
    if len > MAX_SOUND_BYTES {
        return Err("Sound is larger than 2 MB".into());
    }
    fs::read(path).map(Response::new).map_err(|e| e.to_string())
}

/// Writes (or overwrites) a sound. The body is the raw file bytes; the target
/// name travels in the `x-file-name` header (URI-encoded).
#[tauri::command]
pub fn save_user_sound(app: AppHandle, request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected raw audio bytes".into());
    };
    let header = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .ok_or("Missing file name")?;
    let decoded = percent_decode(header)?;
    let name = safe_file_name(&decoded)?;
    if bytes.len() as u64 > MAX_SOUND_BYTES {
        return Err("Sound is larger than 2 MB".into());
    }
    fs::write(sounds_dir(&app)?.join(name), bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_user_sound(app: AppHandle, file_name: String) -> Result<(), String> {
    let name = safe_file_name(&file_name)?;
    fs::remove_file(sounds_dir(&app)?.join(name)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_user_sounds_folder(app: AppHandle) -> Result<(), String> {
    let dir = sounds_dir(&app)?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Decodes `encodeURIComponent` output (headers must be ASCII).
fn percent_decode(input: &str) -> Result<String, String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|e| e.to_string())?;
            out.push(u8::from_str_radix(hex, 16).map_err(|e| e.to_string())?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|e| e.to_string())
}
