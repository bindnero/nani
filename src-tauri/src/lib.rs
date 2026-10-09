mod auth;
mod detector;
mod diagnostics;
mod error;
mod events;
mod preferences;
mod process;
mod project;
mod provider_config;
mod redact;
mod session;
mod skills;

use diagnostics::DiagnosticsBundle;
use error::NaniResult;
use preferences::Preferences;
use provider_config::{ProviderApplyRequest, ProviderApplyResult, ProviderConfigPreview};
use session::{SessionManager, StartSessionRequest, StartSessionResult};
use skills::{SkillDetail, SkillImportPreview, SkillSummary};
use std::path::Path;
use tauri::{AppHandle, State};

#[tauri::command]
fn detect_claude_code() -> NaniResult<detector::DetectionResult> {
    detector::detect(None)
}

#[tauri::command]
fn check_auth() -> auth::AuthStatus {
    auth::check()
}

#[tauri::command]
fn validate_project(path: String) -> project::ProjectValidation {
    project::validate_project(&path)
}

#[tauri::command]
fn start_session(
    app: AppHandle,
    state: State<'_, SessionManager>,
    request: StartSessionRequest,
) -> NaniResult<StartSessionResult> {
    state.start(app, request)
}

#[tauri::command]
fn stop_session(
    app: AppHandle,
    state: State<'_, SessionManager>,
    session_id: String,
) -> NaniResult<()> {
    state.stop(&app, &session_id)
}

#[tauri::command]
fn preview_provider_config(
    scope: String,
    project_path: Option<String>,
) -> NaniResult<ProviderConfigPreview> {
    provider_config::preview(&scope, project_path.as_deref().map(Path::new))
}

#[tauri::command]
fn apply_provider_config(request: ProviderApplyRequest) -> NaniResult<ProviderApplyResult> {
    provider_config::apply(&request)
}

#[tauri::command]
fn list_skills(project_path: Option<String>) -> NaniResult<Vec<SkillSummary>> {
    skills::list_skills(project_path.as_deref().map(Path::new))
}

#[tauri::command]
fn get_skill_detail(path: String) -> NaniResult<SkillDetail> {
    skills::get_skill_detail(&path)
}

#[tauri::command]
fn preview_skill_import(source: String) -> NaniResult<SkillImportPreview> {
    skills::preview_import(&source)
}

#[tauri::command]
fn import_skill(source: String) -> NaniResult<SkillSummary> {
    skills::import_skill(&source)
}

#[tauri::command]
fn remove_skill(path: String) -> NaniResult<()> {
    skills::remove_skill(&path)
}

#[tauri::command]
fn get_preferences() -> Preferences {
    preferences::load()
}

#[tauri::command]
fn save_preferences(preferences: Preferences) -> NaniResult<()> {
    preferences::save(&preferences)
}

#[tauri::command]
fn export_diagnostics() -> NaniResult<DiagnosticsBundle> {
    diagnostics::build()
}

/// Open a URL in the user's default browser. Only http(s) links are allowed so
/// this can never be used to launch a local executable or shell scheme.
#[tauri::command]
fn open_external(url: String) -> NaniResult<()> {
    let lower = url.trim().to_ascii_lowercase();
    if !(lower.starts_with("https://") || lower.starts_with("http://")) {
        return Err(error::NaniError::InvalidInput(
            "Only http(s) URLs may be opened".into(),
        ));
    }
    opener::open(&url)
        .map_err(|e| error::NaniError::Other(format!("Failed to open URL: {e}")))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(SessionManager::new())
        .invoke_handler(tauri::generate_handler![
            detect_claude_code,
            check_auth,
            validate_project,
            start_session,
            stop_session,
            preview_provider_config,
            apply_provider_config,
            list_skills,
            get_skill_detail,
            preview_skill_import,
            import_skill,
            remove_skill,
            get_preferences,
            save_preferences,
            export_diagnostics,
            open_external,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nani");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_external_rejects_non_http_schemes() {
        assert!(open_external("file:///C:/Windows/System32/cmd.exe".into()).is_err());
        assert!(open_external("javascript:alert(1)".into()).is_err());
        assert!(open_external("cmd.exe".into()).is_err());
    }
}
