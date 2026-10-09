use regex::Regex;
use std::sync::OnceLock;

/// Aggressive secret redaction, mirroring the frontend rules. Better to over-mask
/// than to leak a credential into logs or a diagnostics bundle (architecture §9).
fn patterns() -> &'static Vec<(Regex, &'static str)> {
    static PATTERNS: OnceLock<Vec<(Regex, &'static str)>> = OnceLock::new();
    PATTERNS.get_or_init(|| {
        vec![
            (
                Regex::new(r"sk-ant-[A-Za-z0-9_\-]{8,}").unwrap(),
                "sk-ant-***REDACTED***",
            ),
            (
                Regex::new(r"\bsk-[A-Za-z0-9]{20,}").unwrap(),
                "sk-***REDACTED***",
            ),
            (
                Regex::new(r"(?i)\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=\-]+").unwrap(),
                "$1 ***REDACTED***",
            ),
            (
                Regex::new(
                    r#"(?i)("(?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|secret|password|passwd|client[_-]?secret)"\s*:\s*")[^"]*(")"#,
                )
                .unwrap(),
                "$1***REDACTED***$2",
            ),
            (
                Regex::new(
                    r#"\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"']+"#,
                )
                .unwrap(),
                "$1=***REDACTED***",
            ),
        ]
    })
}

/// Redact anything resembling a secret from `input`.
pub fn redact(input: &str) -> String {
    let mut out = input.to_string();
    for (re, replacement) in patterns() {
        out = re.replace_all(&out, *replacement).to_string();
    }
    out
}

/// True when the text appears to contain something matching a secret pattern.
pub fn contains_likely_secret(input: &str) -> bool {
    patterns().iter().any(|(re, _)| re.is_match(input))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn masks_anthropic_keys() {
        let out = redact("key=sk-ant-api03-ABC123DEF456ghi789");
        assert!(!out.contains("ABC123DEF456ghi789"));
        assert!(out.contains("***REDACTED***"));
    }

    #[test]
    fn masks_bearer_tokens() {
        let out = redact("Authorization: Bearer abc.def.ghi123");
        assert!(out.contains("Bearer ***REDACTED***"));
    }

    #[test]
    fn masks_json_secret_fields() {
        let out = redact(r#"{"apiKey":"supersecretvalue","model":"claude"}"#);
        assert!(out.contains("\"apiKey\":\"***REDACTED***\""));
        assert!(out.contains("\"model\":\"claude\""));
        assert!(!out.contains("supersecretvalue"));
    }

    #[test]
    fn leaves_ordinary_text_untouched() {
        let text = "compiled 3 files successfully";
        assert_eq!(redact(text), text);
    }

    #[test]
    fn detects_likely_secrets() {
        assert!(contains_likely_secret("sk-ant-api03-abcdefghijkl"));
        assert!(!contains_likely_secret("hello world"));
    }
}
