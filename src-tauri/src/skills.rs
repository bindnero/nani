use crate::error::{NaniError, NaniResult};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSummary {
    pub name: String,
    pub description: Option<String>,
    pub source: String,
    pub path: String,
    pub valid: bool,
    pub warnings: Vec<String>,
    pub contains_scripts: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDetail {
    #[serde(flatten)]
    pub summary: SkillSummary,
    pub frontmatter: serde_json::Value,
    pub files: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillImportPreview {
    pub source: String,
    pub target_name: String,
    pub target_path: String,
    pub overwrites: bool,
    pub files: Vec<String>,
    pub warnings: Vec<String>,
}

fn user_skills_root() -> NaniResult<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| NaniError::Other("No home directory".into()))?;
    Ok(home.join(".claude").join("skills"))
}

fn project_skills_root(project_dir: &Path) -> PathBuf {
    project_dir.join(".claude").join("skills")
}

/// Parse YAML-ish frontmatter between the first pair of `---` fences. Only simple
/// `key: value` scalars are read; that is sufficient for `name` and `description`
/// and avoids executing anything.
pub fn parse_frontmatter(content: &str) -> Option<HashMap<String, String>> {
    let mut lines = content.lines();
    if lines.next()?.trim() != "---" {
        return None;
    }
    let mut map = HashMap::new();
    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            return Some(map);
        }
        if let Some((key, value)) = trimmed.split_once(':') {
            let key = key.trim().to_string();
            let value = value.trim().trim_matches(['"', '\''].as_ref()).to_string();
            if !key.is_empty() {
                map.insert(key, value);
            }
        }
    }
    None
}

const SCRIPT_EXTENSIONS: &[&str] = &["sh", "ps1", "bat", "cmd", "py", "js", "mjs", "ts", "rb"];

fn dir_contains_scripts(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if dir_contains_scripts(&path) {
                return true;
            }
            continue;
        }
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if SCRIPT_EXTENSIONS.contains(&ext.to_ascii_lowercase().as_str()) {
                return true;
            }
        }
    }
    false
}

fn list_files(dir: &Path) -> Vec<String> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    files.push(name.to_string());
                }
            }
        }
    }
    files.sort();
    files
}

fn read_skill(dir: &Path, source: &str) -> SkillSummary {
    let skill_md = dir.join("SKILL.md");
    let mut warnings = Vec::new();
    let mut description = None;
    let mut valid = true;

    if !skill_md.is_file() {
        valid = false;
        warnings.push("Missing SKILL.md".into());
    } else if let Ok(content) = std::fs::read_to_string(&skill_md) {
        match parse_frontmatter(&content) {
            Some(fm) => {
                if !fm.contains_key("name") {
                    warnings.push("Frontmatter is missing a 'name' field".into());
                    valid = false;
                }
                description = fm.get("description").cloned();
            }
            None => {
                warnings.push("SKILL.md has no valid frontmatter block".into());
                valid = false;
            }
        }
    } else {
        warnings.push("SKILL.md is not readable".into());
        valid = false;
    }

    let name = dir
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    SkillSummary {
        name,
        description,
        source: source.to_string(),
        path: dir.to_string_lossy().to_string(),
        valid,
        warnings,
        contains_scripts: dir_contains_scripts(dir),
    }
}

/// List skills from the user and (when given) project skill directories.
pub fn list_skills(project_dir: Option<&Path>) -> NaniResult<Vec<SkillSummary>> {
    let mut roots: Vec<(PathBuf, &str)> = Vec::new();
    if let Ok(user) = user_skills_root() {
        roots.push((user, "user"));
    }
    if let Some(project) = project_dir {
        roots.push((project_skills_root(project), "project"));
    }

    let mut skills = Vec::new();
    for (root, source) in roots {
        let Ok(entries) = std::fs::read_dir(&root) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                skills.push(read_skill(&path, source));
            }
        }
    }
    Ok(skills)
}

pub fn get_skill_detail(path: &str) -> NaniResult<SkillDetail> {
    let dir = PathBuf::from(path);
    if !dir.is_dir() {
        return Err(NaniError::NotFound(format!("Skill directory not found: {path}")));
    }
    let summary = read_skill(&dir, "user");
    let content = std::fs::read_to_string(dir.join("SKILL.md")).unwrap_or_default();
    let fm = parse_frontmatter(&content).unwrap_or_default();
    let frontmatter = serde_json::to_value(fm)?;
    Ok(SkillDetail {
        summary,
        frontmatter,
        files: list_files(&dir),
    })
}

/// Reject any file name that is not a plain, safe directory name.
fn safe_name(raw: &str) -> NaniResult<String> {
    let name = raw.trim();
    if name.is_empty() || name == "." || name == ".." {
        return Err(NaniError::UnsafePath("Skill name is empty or unsafe".into()));
    }
    if name.contains('/') || name.contains('\\') || name.contains('\0') {
        return Err(NaniError::UnsafePath(
            "Skill name must not contain path separators".into(),
        ));
    }
    Ok(name.to_string())
}

/// Fail when a source directory tree contains symlinks, which could escape it.
fn assert_no_symlinks(dir: &Path) -> NaniResult<()> {
    let entries = std::fs::read_dir(dir)?;
    for entry in entries.flatten() {
        let path = entry.path();
        let meta = std::fs::symlink_metadata(&path)?;
        if meta.file_type().is_symlink() {
            return Err(NaniError::UnsafePath(format!(
                "Refusing to import symlink: {}",
                path.to_string_lossy()
            )));
        }
        if meta.is_dir() {
            assert_no_symlinks(&path)?;
        }
    }
    Ok(())
}

pub fn preview_import(source: &str) -> NaniResult<SkillImportPreview> {
    let source_path = PathBuf::from(source);
    if !source_path.exists() {
        return Err(NaniError::NotFound(format!("Source not found: {source}")));
    }
    if !source_path.is_dir() {
        return Err(NaniError::UnsafePath(
            "Only directory skill imports are supported; archives are not extracted.".into(),
        ));
    }
    assert_no_symlinks(&source_path)?;

    let raw_name = source_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();
    let name = safe_name(raw_name)?;

    let target = user_skills_root()?.join(&name);
    let mut warnings = Vec::new();
    if !source_path.join("SKILL.md").is_file() {
        warnings.push("Source has no SKILL.md; the imported skill may be invalid.".into());
    }
    if dir_contains_scripts(&source_path) {
        warnings.push("Source contains scripts. They will be copied but never executed.".into());
    }

    Ok(SkillImportPreview {
        source: source.to_string(),
        target_name: name,
        target_path: target.to_string_lossy().to_string(),
        overwrites: target.exists(),
        files: list_files(&source_path),
        warnings,
    })
}

fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        let meta = std::fs::symlink_metadata(&from)?;
        if meta.is_dir() {
            copy_dir(&from, &to)?;
        } else if meta.file_type().is_symlink() {
            // Already rejected upstream, but never follow links regardless.
            continue;
        } else {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// Import a skill directory. Scripts are copied as inert files and never run.
pub fn import_skill(source: &str) -> NaniResult<SkillSummary> {
    let preview = preview_import(source)?;
    let target = PathBuf::from(&preview.target_path);
    if target.exists() {
        std::fs::remove_dir_all(&target)?;
    }
    copy_dir(Path::new(source), &target)?;
    Ok(read_skill(&target, "user"))
}

/// Assert a path is inside one of the known skill roots before deleting.
fn assert_within_roots(path: &Path) -> NaniResult<()> {
    let canonical = std::fs::canonicalize(path)
        .map_err(|_| NaniError::NotFound(format!("Path not found: {}", path.to_string_lossy())))?;
    let roots = [user_skills_root().ok()];
    for root in roots.into_iter().flatten() {
        if let Ok(root_canon) = std::fs::canonicalize(&root) {
            if canonical.starts_with(&root_canon) && canonical != root_canon {
                return Ok(());
            }
        }
    }
    Err(NaniError::UnsafePath(
        "Refusing to remove a path outside the known skills directory".into(),
    ))
}

pub fn remove_skill(path: &str) -> NaniResult<()> {
    let target = PathBuf::from(path);
    assert_within_roots(&target)?;
    std::fs::remove_dir_all(&target)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn parses_frontmatter_name_and_description() {
        let content = "---\nname: my-skill\ndescription: does things\n---\n# Body\n";
        let fm = parse_frontmatter(content).unwrap();
        assert_eq!(fm.get("name").unwrap(), "my-skill");
        assert_eq!(fm.get("description").unwrap(), "does things");
    }

    #[test]
    fn rejects_content_without_frontmatter() {
        assert!(parse_frontmatter("# no frontmatter\n").is_none());
        assert!(parse_frontmatter("---\nname: x\n").is_none());
    }

    #[test]
    fn unsafe_skill_names_are_rejected() {
        assert!(safe_name("..").is_err());
        assert!(safe_name("a/b").is_err());
        assert!(safe_name("a\\b").is_err());
        assert!(safe_name("").is_err());
        assert!(safe_name("ok-name").is_ok());
    }

    #[test]
    fn detects_scripts_without_running_them() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("run.sh"), "echo hi").unwrap();
        assert!(dir_contains_scripts(dir.path()));
    }

    #[test]
    fn import_rejects_archives() {
        let dir = tempfile::tempdir().unwrap();
        let archive = dir.path().join("skill.zip");
        fs::write(&archive, "PK").unwrap();
        assert!(preview_import(&archive.to_string_lossy()).is_err());
    }

    #[test]
    fn remove_refuses_paths_outside_skills_root() {
        let dir = tempfile::tempdir().unwrap();
        let outside = dir.path().join("not-a-skill");
        fs::create_dir_all(&outside).unwrap();
        let result = remove_skill(&outside.to_string_lossy());
        assert!(matches!(result, Err(NaniError::UnsafePath(_))));
    }
}
