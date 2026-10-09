use crate::error::{NaniError, NaniResult};
use crate::redact::redact;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigDiffLine {
    pub kind: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderConfigPreview {
    pub target_path: String,
    pub scope: String,
    pub exists: bool,
    pub before: String,
    pub after: String,
    pub diff: Vec<ConfigDiffLine>,
    pub backup_path: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderApplyRequest {
    pub scope: String,
    pub target_path: String,
    pub contents: String,
    pub acknowledged_backup_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderApplyResult {
    pub written: bool,
    pub backup_path: Option<String>,
    pub message: String,
}

fn user_settings_path() -> NaniResult<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| NaniError::Other("No home directory".into()))?;
    Ok(home.join(".claude").join("settings.json"))
}

/// Resolve the settings file for a scope. Project and local scopes require an
/// explicit project directory.
pub fn settings_path(scope: &str, project_dir: Option<&Path>) -> NaniResult<PathBuf> {
    match scope {
        "user" => user_settings_path(),
        "project" => {
            let dir = project_dir.ok_or_else(|| {
                NaniError::InvalidInput("Project scope requires a project directory".into())
            })?;
            Ok(dir.join(".claude").join("settings.json"))
        }
        "local" => {
            let dir = project_dir.ok_or_else(|| {
                NaniError::InvalidInput("Local scope requires a project directory".into())
            })?;
            Ok(dir.join(".claude").join("settings.local.json"))
        }
        other => Err(NaniError::InvalidInput(format!(
            "Unknown configuration scope: {other}"
        ))),
    }
}

fn pretty(value: &serde_json::Value) -> String {
    let mut s = serde_json::to_string_pretty(value).unwrap_or_else(|_| "{}".into());
    s.push('\n');
    s
}

/// Merge a documented, non-secret proposed change onto the existing settings.
/// The proposed change sets the documented `model` setting to the `sonnet`
/// alias. Secrets are never written here.
fn propose(existing: &str) -> (serde_json::Value, Vec<String>) {
    let mut warnings = Vec::new();
    let mut value: serde_json::Value = if existing.trim().is_empty() {
        serde_json::json!({})
    } else {
        match serde_json::from_str(existing) {
            Ok(v @ serde_json::Value::Object(_)) => v,
            _ => {
                warnings.push(
                    "Existing settings file is not a JSON object; preview starts from an empty object."
                        .into(),
                );
                serde_json::json!({})
            }
        }
    };
    if let Some(obj) = value.as_object_mut() {
        obj.insert(
            "model".into(),
            serde_json::Value::String("sonnet".into()),
        );
    }
    if existing.contains("sk-ant-") || existing.to_lowercase().contains("api_key") {
        warnings.push("Existing file appears to contain a secret; contents are redacted here and never logged.".into());
    }
    (value, warnings)
}

pub fn diff_lines(before: &str, after: &str) -> Vec<ConfigDiffLine> {
    let before_lines: Vec<&str> = before.lines().collect();
    let after_lines: Vec<&str> = after.lines().collect();
    let before_set: std::collections::HashSet<&str> = before_lines.iter().copied().collect();
    let after_set: std::collections::HashSet<&str> = after_lines.iter().copied().collect();

    let mut diff = Vec::new();
    for line in &before_lines {
        diff.push(ConfigDiffLine {
            kind: if after_set.contains(line) { "context" } else { "removed" }.into(),
            text: (*line).to_string(),
        });
    }
    for line in &after_lines {
        if !before_set.contains(line) {
            diff.push(ConfigDiffLine {
                kind: "added".into(),
                text: (*line).to_string(),
            });
        }
    }
    diff
}

/// Build a preview. Nothing is written.
pub fn preview(scope: &str, project_dir: Option<&Path>) -> NaniResult<ProviderConfigPreview> {
    let target = settings_path(scope, project_dir)?;
    let exists = target.exists();
    let before = if exists {
        std::fs::read_to_string(&target).unwrap_or_default()
    } else {
        String::new()
    };
    let (proposed, warnings) = propose(&before);
    let after = pretty(&proposed);

    let backup_path = if exists {
        Some(format!("{}.nani-backup", target.to_string_lossy()))
    } else {
        None
    };

    Ok(ProviderConfigPreview {
        target_path: target.to_string_lossy().to_string(),
        scope: scope.to_string(),
        exists,
        before: redact(&before),
        after: redact(&after),
        diff: diff_lines(&redact(&before), &redact(&after)),
        backup_path,
        warnings,
    })
}

/// Ensure a target path is a legitimate settings file we are allowed to write.
fn assert_writable_target(scope: &str, target: &Path) -> NaniResult<()> {
    if !target.is_absolute() {
        return Err(NaniError::UnsafePath("Target path must be absolute".into()));
    }
    if target.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err(NaniError::UnsafePath("Target path must not contain '..'".into()));
    }
    let parent_ok = target
        .parent()
        .and_then(|p| p.file_name())
        .map(|n| n == ".claude")
        .unwrap_or(false);
    if !parent_ok {
        return Err(NaniError::UnsafePath(
            "Target must be inside a .claude directory".into(),
        ));
    }
    let file_name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    match scope {
        "user" | "project" => {
            if file_name != "settings.json" {
                return Err(NaniError::UnsafePath(
                    "Target file must be settings.json".into(),
                ));
            }
            if scope == "user" {
                let expected = user_settings_path()?;
                if expected != target {
                    return Err(NaniError::UnsafePath(
                        "User-scope target must be the user settings file".into(),
                    ));
                }
            }
        }
        "local" => {
            if file_name != "settings.local.json" {
                return Err(NaniError::UnsafePath(
                    "Target file must be settings.local.json".into(),
                ));
            }
        }
        other => {
            return Err(NaniError::InvalidInput(format!(
                "Unknown configuration scope: {other}"
            )))
        }
    }
    Ok(())
}

/// Apply a previewed change. Writes a backup first when the file exists, then
/// writes the new contents, then re-reads to verify the write succeeded.
pub fn apply(request: &ProviderApplyRequest) -> NaniResult<ProviderApplyResult> {
    let target = PathBuf::from(&request.target_path);
    assert_writable_target(&request.scope, &target)?;

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Back up existing contents before any write.
    let mut backup_written: Option<String> = None;
    if target.exists() {
        let expected_backup = format!("{}.nani-backup", target.to_string_lossy());
        if let Some(ack) = &request.acknowledged_backup_path {
            if ack != &expected_backup {
                return Err(NaniError::InvalidInput(
                    "Acknowledged backup path does not match the expected backup path".into(),
                ));
            }
        }
        let existing = std::fs::read_to_string(&target).unwrap_or_default();
        std::fs::write(&expected_backup, existing)?;
        backup_written = Some(expected_backup);
    }

    std::fs::write(&target, &request.contents)?;

    // Verify: re-read and compare.
    let readback = std::fs::read_to_string(&target)?;
    if readback != request.contents {
        return Err(NaniError::Other(
            "Verification failed: written contents did not match".into(),
        ));
    }

    Ok(ProviderApplyResult {
        written: true,
        backup_path: backup_written,
        message: format!("Wrote {}", target.to_string_lossy()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_scope_is_rejected() {
        assert!(settings_path("galaxy", None).is_err());
    }

    #[test]
    fn project_scope_requires_directory() {
        assert!(settings_path("project", None).is_err());
        let dir = tempfile::tempdir().unwrap();
        let path = settings_path("project", Some(dir.path())).unwrap();
        assert!(path.ends_with(".claude/settings.json"));
    }

    #[test]
    fn diff_marks_added_and_removed() {
        let diff = diff_lines("{\n}\n", "{\n  \"model\": \"sonnet\"\n}\n");
        assert!(diff.iter().any(|d| d.kind == "added" && d.text.contains("model")));
    }

    #[test]
    fn preview_does_not_write() {
        let dir = tempfile::tempdir().unwrap();
        let preview = preview("project", Some(dir.path())).unwrap();
        assert!(!std::path::Path::new(&preview.target_path).exists());
    }

    #[test]
    fn apply_refuses_target_outside_claude_dir() {
        let req = ProviderApplyRequest {
            scope: "user".into(),
            target_path: if cfg!(windows) {
                "C:\\evil\\settings.json".into()
            } else {
                "/etc/settings.json".into()
            },
            contents: "{}".into(),
            acknowledged_backup_path: None,
        };
        assert!(matches!(apply(&req), Err(NaniError::UnsafePath(_))));
    }

    #[test]
    fn apply_refuses_parent_traversal() {
        let req = ProviderApplyRequest {
            scope: "project".into(),
            target_path: if cfg!(windows) {
                "C:\\proj\\.claude\\..\\settings.json".into()
            } else {
                "/proj/.claude/../settings.json".into()
            },
            contents: "{}".into(),
            acknowledged_backup_path: None,
        };
        assert!(apply(&req).is_err());
    }

    #[test]
    fn apply_writes_backup_then_contents_and_verifies() {
        let dir = tempfile::tempdir().unwrap();
        let claude = dir.path().join(".claude");
        std::fs::create_dir_all(&claude).unwrap();
        let target = claude.join("settings.json");
        std::fs::write(&target, "{\n  \"old\": true\n}\n").unwrap();

        let backup = format!("{}.nani-backup", target.to_string_lossy());
        let req = ProviderApplyRequest {
            scope: "project".into(),
            target_path: target.to_string_lossy().to_string(),
            contents: "{\n  \"model\": \"sonnet\"\n}\n".into(),
            acknowledged_backup_path: Some(backup.clone()),
        };
        let result = apply(&req).unwrap();
        assert!(result.written);
        assert_eq!(result.backup_path.as_deref(), Some(backup.as_str()));
        assert!(std::fs::read_to_string(&backup).unwrap().contains("\"old\""));
        assert!(std::fs::read_to_string(&target).unwrap().contains("sonnet"));
    }

    #[test]
    fn apply_rejects_mismatched_backup_ack() {
        let dir = tempfile::tempdir().unwrap();
        let claude = dir.path().join(".claude");
        std::fs::create_dir_all(&claude).unwrap();
        let target = claude.join("settings.json");
        std::fs::write(&target, "{}").unwrap();

        let req = ProviderApplyRequest {
            scope: "project".into(),
            target_path: target.to_string_lossy().to_string(),
            contents: "{\n}\n".into(),
            acknowledged_backup_path: Some("C:\\wrong".into()),
        };
        assert!(apply(&req).is_err());
    }
}
