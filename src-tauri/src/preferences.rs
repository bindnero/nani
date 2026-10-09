use crate::error::NaniResult;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub theme: String,
    pub log_retention_days: u32,
    pub persist_sessions: bool,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            log_retention_days: 30,
            persist_sessions: true,
        }
    }
}

pub fn preferences_path() -> NaniResult<PathBuf> {
    let dir = dirs::config_dir()
        .map(|d| d.join("nani"))
        .ok_or_else(|| crate::error::NaniError::Other("No config directory".into()))?;
    Ok(dir.join("preferences.json"))
}

pub fn load_from(path: &Path) -> Preferences {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save_to(path: &Path, prefs: &Preferences) -> NaniResult<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let json = serde_json::to_string_pretty(prefs)?;
    std::fs::write(path, json)?;
    Ok(())
}

pub fn load() -> Preferences {
    preferences_path()
        .map(|p| load_from(&p))
        .unwrap_or_default()
}

pub fn save(prefs: &Preferences) -> NaniResult<()> {
    save_to(&preferences_path()?, prefs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_sensible() {
        let p = Preferences::default();
        assert_eq!(p.theme, "dark");
        assert!(p.persist_sessions);
    }

    #[test]
    fn round_trips_through_disk() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("preferences.json");
        let prefs = Preferences {
            theme: "light".into(),
            log_retention_days: 7,
            persist_sessions: false,
        };
        save_to(&path, &prefs).unwrap();
        assert_eq!(load_from(&path), prefs);
    }

    #[test]
    fn missing_file_returns_defaults() {
        let dir = tempfile::tempdir().unwrap();
        assert_eq!(load_from(&dir.path().join("nope.json")), Preferences::default());
    }
}
