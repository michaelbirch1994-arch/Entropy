#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_fs::FsExt;
use serde::Serialize;

const MAX_GW2SKILLS_PAGE_BYTES: usize = 3_000_000;
const MAX_GW2SKILLS_DATABASE_BYTES: usize = 12_000_000;

#[derive(Serialize)]
struct Gw2SkillsImportSource {
    html: String,
    database: serde_json::Value,
}

fn validate_gw2skills_editor_url(input: &str) -> Result<reqwest::Url, String> {
    let url = reqwest::Url::parse(input).map_err(|_| "Paste a complete gw2skills.net editor URL.".to_string())?;
    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
    let allowed_host = host == "gw2skills.net" || host.ends_with(".gw2skills.net");
    let allowed_path = matches!(url.path().to_ascii_lowercase().as_str(), "/editor" | "/editor/");
    if url.scheme() != "https" || !allowed_host || !allowed_path || url.query().unwrap_or("").is_empty() {
        return Err("Only complete public HTTPS gw2skills.net editor links can be imported.".to_string());
    }
    Ok(url)
}

fn gw2skills_database_file(html: &str, page_url: &reqwest::Url) -> Result<String, String> {
    if let Some(start) = html.find("ajax/db/") {
        let candidate = html[start + 8..]
            .chars()
            .take_while(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_'))
            .collect::<String>();
        if candidate.ends_with(".json") && !candidate.contains('/') {
            return Ok(candidate);
        }
    }

    let marker = "dbid:";
    let start = html.find(marker).ok_or_else(|| "The gw2skills catalog version could not be identified.".to_string())? + marker.len();
    let database_id = html[start..]
        .trim_start()
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>();
    if database_id.is_empty() {
        return Err("The gw2skills catalog version could not be identified.".to_string());
    }
    let language = page_url
        .host_str()
        .and_then(|host| host.split('.').next())
        .filter(|value| value.len() == 2 && value.chars().all(|character| character.is_ascii_alphabetic()))
        .unwrap_or("en")
        .to_ascii_lowercase();
    Ok(format!("{language}.{database_id}.json"))
}

async fn limited_response_bytes(response: reqwest::Response, limit: usize, label: &str) -> Result<Vec<u8>, String> {
    if !response.status().is_success() {
        return Err(format!("{label} returned {}.", response.status().as_u16()));
    }
    if response.content_length().is_some_and(|length| length > limit as u64) {
        return Err(format!("{label} response was unexpectedly large."));
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    if bytes.len() > limit {
        return Err(format!("{label} response was unexpectedly large."));
    }
    Ok(bytes.to_vec())
}

#[tauri::command]
async fn fetch_gw2skills_import_source(url: String) -> Result<Gw2SkillsImportSource, String> {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("Entropy Builder")
        .build()
        .map_err(|error| error.to_string())?;
    let mut page_url = validate_gw2skills_editor_url(&url)?;
    let mut page_response = None;
    for _ in 0..=3 {
        let response = client.get(page_url.clone()).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_redirection() {
            page_response = Some(response);
            break;
        }
        let location = response.headers().get(reqwest::header::LOCATION)
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| "gw2skills.net returned an invalid redirect.".to_string())?;
        page_url = validate_gw2skills_editor_url(
            page_url.join(location).map_err(|_| "gw2skills.net returned an invalid redirect.".to_string())?.as_str(),
        )?;
    }
    let page_response = page_response.ok_or_else(|| "gw2skills.net returned too many redirects.".to_string())?;
    let html_bytes = limited_response_bytes(page_response, MAX_GW2SKILLS_PAGE_BYTES, "gw2skills.net").await?;
    let html = String::from_utf8(html_bytes).map_err(|_| "gw2skills.net returned invalid text.".to_string())?;
    let database_file = gw2skills_database_file(&html, &page_url)?;
    let database_url = page_url.join(&format!("/ajax/db/{database_file}"))
        .map_err(|_| "The gw2skills item catalog URL was invalid.".to_string())?;
    let database_response = client.get(database_url).send().await.map_err(|error| error.to_string())?;
    let database_bytes = limited_response_bytes(database_response, MAX_GW2SKILLS_DATABASE_BYTES, "The gw2skills item catalog").await?;
    let database = serde_json::from_slice(&database_bytes)
        .map_err(|_| "The gw2skills item catalog was not valid JSON.".to_string())?;
    Ok(Gw2SkillsImportSource { html, database })
}

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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![grant_folder_scope, fetch_gw2skills_import_source])
        .run(tauri::generate_context!())
        .expect("error while running Entropy");
}
