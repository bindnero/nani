use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectValidation {
    pub valid: bool,
    pub path: String,
    pub reason: Option<String>,
    pub message: Option<String>,
    pub is_directory: bool,
    pub readable: bool,
}

fn invalid(path: &str, reason: &str, message: &str) -> ProjectValidation {
    ProjectValidation {
        valid: false,
        path: path.to_string(),
        reason: Some(reason.into()),
        message: Some(message.into()),
        is_directory: false,
        readable: false,
    }
}

/// Validate a project directory before any launch. Rejects empty, non-absolute
/// and NUL-containing paths, distinguishes missing / not-a-directory /
/// permission-denied, and confirms the directory is readable.
pub fn validate_project(path_str: &str) -> ProjectValidation {
    let trimmed = path_str.trim();
    if trimmed.is_empty() {
        return invalid(path_str, "unsafe_path", "Path is empty");
    }
    if trimmed.contains('\0') {
        return invalid(path_str, "unsafe_path", "Path contains a NUL byte");
    }
    let path = Path::new(trimmed);
    if !path.is_absolute() {
        return invalid(path_str, "unsafe_path", "Path must be absolute");
    }

    match std::fs::metadata(path) {
        Ok(meta) => {
            if !meta.is_dir() {
                return ProjectValidation {
                    valid: false,
                    path: trimmed.to_string(),
                    reason: Some("not_a_directory".into()),
                    message: Some("Path is not a directory".into()),
                    is_directory: false,
                    readable: true,
                };
            }
            match std::fs::read_dir(path) {
                Ok(_) => ProjectValidation {
                    valid: true,
                    path: trimmed.to_string(),
                    reason: None,
                    message: None,
                    is_directory: true,
                    readable: true,
                },
                Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => ProjectValidation {
                    valid: false,
                    path: trimmed.to_string(),
                    reason: Some("permission_denied".into()),
                    message: Some("Directory is not readable".into()),
                    is_directory: true,
                    readable: false,
                },
                Err(e) => ProjectValidation {
                    valid: false,
                    path: trimmed.to_string(),
                    reason: Some("unknown".into()),
                    message: Some(e.to_string()),
                    is_directory: true,
                    readable: false,
                },
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            invalid(path_str, "not_found", "Directory does not exist")
        }
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => ProjectValidation {
            valid: false,
            path: trimmed.to_string(),
            reason: Some("permission_denied".into()),
            message: Some("Permission denied".into()),
            is_directory: false,
            readable: false,
        },
        Err(e) => invalid(path_str, "unknown", &e.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn empty_path_is_unsafe() {
        let v = validate_project("   ");
        assert!(!v.valid);
        assert_eq!(v.reason.as_deref(), Some("unsafe_path"));
    }

    #[test]
    fn relative_path_is_unsafe() {
        let v = validate_project("relative/path");
        assert!(!v.valid);
        assert_eq!(v.reason.as_deref(), Some("unsafe_path"));
    }

    #[test]
    fn nonexistent_absolute_path_is_not_found() {
        let v = validate_project(if cfg!(windows) {
            "C:\\definitely\\not\\here\\nani"
        } else {
            "/definitely/not/here/nani"
        });
        assert!(!v.valid);
        assert_eq!(v.reason.as_deref(), Some("not_found"));
    }

    #[test]
    fn a_real_directory_is_valid() {
        let dir = tempfile::tempdir().unwrap();
        let v = validate_project(&dir.path().to_string_lossy());
        assert!(v.valid);
        assert!(v.is_directory);
        assert!(v.readable);
    }

    #[test]
    fn a_file_is_not_a_directory() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("file.txt");
        fs::write(&file, "hi").unwrap();
        let v = validate_project(&file.to_string_lossy());
        assert!(!v.valid);
        assert_eq!(v.reason.as_deref(), Some("not_a_directory"));
    }

    #[test]
    fn nul_bytes_are_rejected() {
        let v = validate_project("C:\\bad\0path");
        assert!(!v.valid);
        assert_eq!(v.reason.as_deref(), Some("unsafe_path"));
    }
}
