/**
 * Secret redaction for anything that may be shown in logs, diagnostics or
 * exported bundles. This is intentionally aggressive: better to over-mask than
 * to leak a credential. (Architecture §9)
 */

const PATTERNS: Array<{ name: string; re: RegExp; replace: string }> = [
  // Anthropic API keys and long-lived auth tokens.
  { name: 'anthropic-key', re: /sk-ant-[A-Za-z0-9_-]{8,}/g, replace: 'sk-ant-***REDACTED***' },
  { name: 'openai-key', re: /sk-[A-Za-z0-9]{20,}/g, replace: 'sk-***REDACTED***' },
  // Bearer / Basic authorization headers.
  { name: 'auth-header', re: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/gi, replace: '$1 ***REDACTED***' },
  // JSON-ish secret fields: "apiKey": "...", "token": "..." etc.
  {
    name: 'json-secret',
    re: /("(?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|secret|password|passwd|client[_-]?secret)"\s*:\s*")[^"]*(")/gi,
    replace: '$1***REDACTED***$2',
  },
  // KEY=value assignments for secret-looking names (env dumps).
  {
    name: 'env-secret',
    re: /\b([A-Z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL)[A-Z0-9_]*)\s*=\s*[^\s"']+/g,
    replace: '$1=***REDACTED***',
  },
];

export function redactSecrets(input: string): string {
  let out = input;
  for (const { re, replace } of PATTERNS) {
    out = out.replace(re, replace);
  }
  return out;
}

/** True when the text appears to contain something matching a secret pattern. */
export function containsLikelySecret(input: string): boolean {
  return PATTERNS.some(({ re }) => {
    // Reset lastIndex defensively for global regexes reused across calls.
    re.lastIndex = 0;
    return re.test(input);
  });
}

/**
 * Mask a secret for display: keep a short prefix/suffix only when the value is
 * long enough for that to be non-revealing.
 */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 2)}${'•'.repeat(Math.min(12, value.length - 4))}${value.slice(-2)}`;
}
