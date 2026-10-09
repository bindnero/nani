use crate::error::NaniResult;
use chrono::Utc;
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionResult {
    pub found: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    pub source: String,
    pub version_exit_code: Option<i32>,
    pub error: Option<DetectionError>,
    pub checked_at: String,
}

impl DetectionResult {
    fn missing(code: &str, message: &str) -> Self {
        Self {
            found: false,
            path: None,
            version: None,
            source: "none".into(),
            version_exit_code: None,
            error: Some(DetectionError {
                code: code.into(),
                message: message.into(),
            }),
            checked_at: Utc::now().to_rfc3339(),
        }
    }
}

/// Well-known install locations, ordered most-likely first. These are places the
/// native installer commonly uses; they are only *candidates* and are verified
/// before being reported as found.
pub fn well_known_candidates() -> Vec<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Some(home) = dirs::home_dir() {
        candidates.push(home.join(".local").join("bin").join(exe_name()));
        candidates.push(home.join(".claude").join("local").join(exe_name()));
    }
    if let Some(data) = dirs::data_local_dir() {
        candidates.push(data.join("Programs").join("claude").join(exe_name()));
    }
    if let Some(data) = dirs::data_dir() {
        candidates.push(data.join("npm").join(claude_cmd_name()));
    }

    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/usr/local/bin").join(exe_name()));
        candidates.push(PathBuf::from("/opt/homebrew/bin").join(exe_name()));
    }
    #[cfg(target_os = "linux")]
    {
        candidates.push(PathBuf::from("/usr/local/bin").join(exe_name()));
        candidates.push(PathBuf::from("/usr/bin").join(exe_name()));
        if let Some(home) = dirs::home_dir() {
            candidates.push(home.join(".npm-global").join("bin").join(exe_name()));
        }
    }

    candidates
}

#[cfg(windows)]
fn exe_name() -> &'static str {
    "claude.exe"
}
#[cfg(not(windows))]
fn exe_name() -> &'static str {
    "claude"
}

#[cfg(windows)]
fn claude_cmd_name() -> &'static str {
    "claude.cmd"
}
#[cfg(not(windows))]
fn claude_cmd_name() -> &'static str {
    "claude"
}

/// Extract a version string from `claude --version` output. Returns the first
/// non-empty line, trimmed. We never invent a version if the output is empty.
pub fn parse_version(raw: &str) -> Option<String> {
    raw.lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(|line| line.to_string())
}

/// Read the version by running the real executable. This is the only place a
/// version string can come from.
fn read_version(path: &Path) -> (Option<String>, Option<i32>) {
    match Command::new(path).arg("--version").output() {
        Ok(output) => {
            let code = output.status.code();
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            let version = parse_version(&stdout).or_else(|| parse_version(&stderr));
            (version, code)
        }
        Err(_) => (None, None),
    }
}

fn finish_found(path: PathBuf, source: &str) -> DetectionResult {
    let (version, code) = read_version(&path);
    DetectionResult {
        found: true,
        path: Some(path.to_string_lossy().to_string()),
        version,
        source: source.into(),
        version_exit_code: code,
        error: None,
        checked_at: Utc::now().to_rfc3339(),
    }
}

/// Detect the CLI executable and read its version. Discovery order:
/// explicit override -> `NANI_CLAUDE_PATH` env -> PATH -> well-known locations.
pub fn detect(explicit: Option<&Path>) -> NaniResult<DetectionResult> {
    // 1. Explicit path from the caller (used by tests and advanced users).
    if let Some(path) = explicit {
        if path.is_file() {
            return Ok(finish_found(path.to_path_buf(), "configured"));
        }
        return Ok(DetectionResult::missing(
            "not_found",
            &format!("Configured path does not exist: {}", path.display()),
        ));
    }

    // 2. Environment override.
    if let Some(value) = std::env::var_os("NANI_CLAUDE_PATH") {
        let path = PathBuf::from(value);
        if path.is_file() {
            return Ok(finish_found(path, "environment"));
        }
        return Ok(DetectionResult::missing(
            "not_found",
            &format!("NANI_CLAUDE_PATH does not exist: {}", path.display()),
        ));
    }

    // 3. PATH lookup.
    if let Ok(found) = which::which("claude") {
        return Ok(finish_found(found, "PATH"));
    }

    // 4. Well-known locations.
    for candidate in well_known_candidates() {
        if candidate.is_file() {
            return Ok(finish_found(candidate, "well-known"));
        }
    }

    Ok(DetectionResult::missing(
        "not_found",
        "Claude Code was not found on PATH or in well-known install locations.",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn candidates_are_not_empty() {
        assert!(!well_known_candidates().is_empty());
    }

    #[test]
    fn parse_version_takes_first_non_empty_line() {
        assert_eq!(
            parse_version("\n  2.1.295 (Claude Code)\n"),
            Some("2.1.295 (Claude Code)".to_string())
        );
        assert_eq!(parse_version("   \n  "), None);
    }

    #[test]
    fn explicit_missing_path_is_reported_not_found() {
        let result = detect(Some(Path::new("C:\\does\\not\\exist\\claude.exe"))).unwrap();
        assert!(!result.found);
        assert_eq!(result.error.unwrap().code, "not_found");
    }
}
