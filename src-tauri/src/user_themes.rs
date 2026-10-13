//! The user's color-theme folder: `<app config dir>/themes/*.json`.
//!
//! Themes live as plain files so people can keep them long term, back them up,
//! share them, and edit them in a text editor. Rust only moves bytes around;
//! parsing and validation happen in `src/lib/colorThemes.ts`, the same code
//! path as an in-app import.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

/// Generous for a palette file; anything bigger is not a theme.
const MAX_THEME_BYTES: u64 = 256 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserThemeFile {
    pub file_name: String,
    /// `None` when the file couldn't be read (too large, not UTF-8, …).
    pub contents: Option<String>,
    pub error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserThemesListing {
    pub dir: String,
    pub files: Vec<UserThemeFile>,
}

fn themes_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("themes");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// A bare `name.json` — no separators or `..`, so it can't leave the folder.
fn safe_file_name(name: &str) -> Result<&str, String> {
    let ok = name.ends_with(".json")
        && name.len() <= 128
        && !name.starts_with('.')
        && Path::new(name).file_name().and_then(|n| n.to_str()) == Some(name);
    if ok {
        Ok(name)
    } else {
        Err(format!("Invalid theme file name: {name}"))
    }
}

fn read_theme(path: &Path) -> (Option<String>, Option<String>) {
    match fs::metadata(path) {
        Ok(meta) if meta.len() > MAX_THEME_BYTES => {
            (None, Some("File is larger than 256 KB".into()))
        }
        Ok(_) => match fs::read_to_string(path) {
            Ok(text) => (Some(text), None),
            Err(e) => (None, Some(e.to_string())),
        },
        Err(e) => (None, Some(e.to_string())),
    }
}

#[tauri::command]
pub fn list_user_themes(app: AppHandle) -> Result<UserThemesListing, String> {
    let dir = themes_dir(&app)?;
    let mut files: Vec<UserThemeFile> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().map(|t| t.is_file()).unwrap_or(false))
        .filter_map(|entry| {
            let file_name = entry.file_name().into_string().ok()?;
            safe_file_name(&file_name).ok()?;
            let (contents, error) = read_theme(&entry.path());
            Some(UserThemeFile { file_name, contents, error })
        })
        .collect();
    files.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(UserThemesListing {
        dir: dir.to_string_lossy().into_owned(),
        files,
    })
}

/// Writes (or overwrites) `file_name` in the themes folder.
#[tauri::command]
pub fn save_user_theme(app: AppHandle, file_name: String, contents: String) -> Result<(), String> {
    let name = safe_file_name(&file_name)?;
    if contents.len() as u64 > MAX_THEME_BYTES {
        return Err("Theme is larger than 256 KB".into());
    }
    fs::write(themes_dir(&app)?.join(name), contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_user_theme(app: AppHandle, file_name: String) -> Result<(), String> {
    let name = safe_file_name(&file_name)?;
    fs::remove_file(themes_dir(&app)?.join(name)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_user_themes_folder(app: AppHandle) -> Result<(), String> {
    let dir = themes_dir(&app)?;
    app.opener()
        .open_path(dir.to_string_lossy(), None::<&str>)
        .map_err(|e| e.to_string())
}
