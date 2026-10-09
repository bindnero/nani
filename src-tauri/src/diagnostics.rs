use crate::auth::{self, AuthStatus};
use crate::detector::{self, DetectionResult};
use crate::error::NaniResult;
use crate::preferences::{self, Preferences};
use crate::redact::redact;
use chrono::Utc;
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsBundle {
    pub generated_at: String,
    pub app_version: String,
    pub os: String,
    pub arch: String,
    pub detection: DetectionResult,
    pub auth: AuthStatus,
    pub preferences: Preferences,
    pub entries: Vec<String>,
}

/// Build a diagnostics bundle. Every free-text entry is redacted and we record
/// only boolean presence of environment variables, never their values.
pub fn build() -> NaniResult<DiagnosticsBundle> {
    let detection = detector::detect(None)?;
    let auth = auth::check();

    let mut entries = vec![
        "Diagnostics are redacted; secret-looking values are masked before export.".to_string(),
        format!(
            "ANTHROPIC_API_KEY present: {}",
            std::env::var_os("ANTHROPIC_API_KEY").is_some()
        ),
        format!(
            "NANI_CLAUDE_PATH present: {}",
            std::env::var_os("NANI_CLAUDE_PATH").is_some()
        ),
    ];
    entries = entries.into_iter().map(|e| redact(&e)).collect();

    Ok(DiagnosticsBundle {
        generated_at: Utc::now().to_rfc3339(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        detection,
        auth,
        preferences: preferences::load(),
        entries,
    })
}
