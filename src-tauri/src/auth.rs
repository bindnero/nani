use crate::detector::{self, DetectionError};
use crate::redact::redact;
use chrono::Utc;
use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub state: String,
    pub method: Option<String>,
    pub detail: Option<String>,
    pub raw: Option<String>,
    pub exit_code: Option<i32>,
    pub checked_at: String,
    pub error: Option<DetectionError>,
}

impl AuthStatus {
    fn unknown(message: &str) -> Self {
        Self {
            state: "unknown".into(),
            method: None,
            detail: None,
            raw: None,
            exit_code: None,
            checked_at: Utc::now().to_rfc3339(),
            error: Some(DetectionError {
                code: "check_failed".into(),
                message: message.into(),
            }),
        }
    }
}

/// Determine authentication / provider readiness by running a real documented
/// check (`claude auth status`). This is intentionally separate from detection:
/// an installed CLI may not be authenticated.
pub fn check() -> AuthStatus {
    let Ok(detection) = detector::detect(None) else {
        return AuthStatus::unknown("Detection failed");
    };
    let Some(path) = detection.path else {
        return AuthStatus::unknown("Claude Code is not installed, so authentication N/A");
    };

    match Command::new(&path).args(["auth", "status"]).output() {
        Ok(output) => {
            let code = output.status.code();
            let raw = redact(&String::from_utf8_lossy(&output.stdout));
            let ready = code == Some(0);
            AuthStatus {
                state: if ready { "ready" } else { "not_ready" }.into(),
                method: parse_method(&raw),
                detail: parse_detail(&raw),
                raw: Some(raw),
                exit_code: code,
                checked_at: Utc::now().to_rfc3339(),
                error: None,
            }
        }
        Err(e) => AuthStatus::unknown(&format!("Failed to run `claude auth status`: {e}")),
    }
}

/// Pull a credential source name out of the (already redacted) output, if the
/// CLI reported one. Returns None rather than guessing.
fn parse_method(raw: &str) -> Option<String> {
    for line in raw.lines() {
        let lower = line.to_ascii_lowercase();
        if lower.contains("apikeysource") || lower.contains("api key source") {
            if let Some((_, value)) = line.split_once(':') {
                let value = value.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
        if lower.contains("tokensource") || lower.contains("token source") {
            if let Some((_, value)) = line.split_once(':') {
                let value = value.trim();
                if !value.is_empty() {
                    return Some(value.to_string());
                }
            }
        }
    }
    None
}

fn parse_detail(raw: &str) -> Option<String> {
    for line in raw.lines() {
        let lower = line.to_ascii_lowercase();
        if lower.contains("organization") || lower.contains("subscription") {
            let trimmed = line.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_api_key_source() {
        let raw = "Logged in\napiKeySource: ANTHROPIC_API_KEY\n";
        assert_eq!(parse_method(raw).as_deref(), Some("ANTHROPIC_API_KEY"));
    }

    #[test]
    fn returns_none_when_unknown() {
        assert!(parse_method("nothing useful here").is_none());
    }
}
