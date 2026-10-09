import { describe, expect, it } from 'vitest';
import { containsLikelySecret, maskSecret, redactSecrets } from './redact';

describe('redactSecrets', () => {
  it('masks Anthropic API keys', () => {
    const out = redactSecrets('key=sk-ant-api03-ABC123DEF456ghi789');
    expect(out).not.toContain('ABC123DEF456ghi789');
    expect(out).toContain('***REDACTED***');
  });

  it('masks bearer tokens', () => {
    const out = redactSecrets('Authorization: Bearer abc.def.ghi123');
    expect(out).toContain('Bearer ***REDACTED***');
  });

  it('masks JSON secret fields but keeps the key name', () => {
    const out = redactSecrets('{"apiKey":"supersecretvalue","model":"claude"}');
    expect(out).toContain('"apiKey":"***REDACTED***"');
    expect(out).toContain('"model":"claude"');
    expect(out).not.toContain('supersecretvalue');
  });

  it('masks env-style assignments', () => {
    const out = redactSecrets('ANTHROPIC_API_KEY=sk-live-abcdefghijklmnop');
    expect(out).toBe('ANTHROPIC_API_KEY=***REDACTED***');
  });

  it('leaves ordinary text untouched', () => {
    const text = 'compiled 3 files successfully';
    expect(redactSecrets(text)).toBe(text);
  });

  it('detects likely secrets', () => {
    expect(containsLikelySecret('sk-ant-api03-abcdefghijkl')).toBe(true);
    expect(containsLikelySecret('hello world')).toBe(false);
  });
});

describe('maskSecret', () => {
  it('fully masks short values', () => {
    expect(maskSecret('abcd')).toBe('••••');
  });

  it('keeps only short prefix/suffix for long values', () => {
    const masked = maskSecret('abcdefghijklmnop');
    expect(masked.startsWith('ab')).toBe(true);
    expect(masked.endsWith('op')).toBe(true);
    expect(masked).not.toContain('efghijklmn');
  });
});
