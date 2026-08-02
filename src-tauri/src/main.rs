#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_fs::FsExt;

// The arcdps log folder the user picks via the native folder dialog can live
// anywhere on disk (a different drive, a Steam library path, a custom GW2
// install, etc.) - none of Tauri's built-in scoped base directories (AppData,
// Home, Documents, ...) reliably cover it, and a static capability can't
// grant access to a path that's only known at runtime. So instead we extend
// the fs plugin's scope programmatically right after the frontend learns
// which folder the user picked (or reconnects to). This is the officially
// documented pattern for "user picks an arbitrary folder via the dialog
// plugin, then the fs plugin needs to read it":
// https://v2.tauri.app/plugin/file-system/#usage
#[tauri::command]
fn grant_folder_scope(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![grant_folder_scope])
        .run(tauri::generate_context!())
        .expect("error while running Entropy");
}
