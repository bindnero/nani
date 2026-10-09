import { describe, expect, it } from 'vitest';
import { readinessView, sessionStateView, formatCost, formatTokens } from './status';
import type { AuthStatus, DetectionResult, UsageInfo } from './types';

const detection: DetectionResult = {
  found: true,
  path: 'C:\\claude.exe',
  version: '2.1.295',
  source: 'PATH',
  versionExitCode: 0,
  error: null,
  checkedAt: new Date().toISOString(),
};

const auth: AuthStatus = {
  state: 'ready',
  method: 'ANTHROPIC_API_KEY',
  detail: null,
  raw: null,
  exitCode: 0,
  checkedAt: new Date().toISOString(),
  error: null,
};

describe('readinessView', () => {
  it('does not conflate installation with authentication', () => {
    const view = readinessView(detection, null);
    expect(view.badge.label).toContain('2.1.295');
    expect(view.authDetail).toContain('not checked');
  });

  it('reports a missing CLI distinctly', () => {
    const view = readinessView({ ...detection, found: false, path: null, version: null }, null);
    expect(view.badge.label).toBe('CLI missing');
    expect(view.badge.tone).toBe('danger');
  });

  it('marks installed-but-unauthenticated as a warning, not success', () => {
    const view = readinessView(detection, { ...auth, state: 'not_ready' });
    expect(view.badge.tone).toBe('warn');
    expect(view.authDetail).toBe('Not authenticated');
  });

  it('marks ready only when authenticated', () => {
    const view = readinessView(detection, auth);
    expect(view.badge.tone).toBe('success');
  });
});

describe('sessionStateView', () => {
  it('maps every state to a tone without inventing progress', () => {
    expect(sessionStateView('Idle').tone).toBe('neutral');
    expect(sessionStateView('Running').tone).toBe('info');
    expect(sessionStateView('Completed').tone).toBe('success');
    expect(sessionStateView('Failed').tone).toBe('danger');
  });
});

describe('usage formatting', () => {
  const unknown: UsageInfo = {
    provided: false,
    estimated: true,
    costUsd: null,
    inputTokens: null,
    outputTokens: null,
    cacheReadTokens: null,
    cacheCreationTokens: null,
    durationMs: null,
    numTurns: null,
    source: null,
  };

  it('shows "Not provided" when usage is unavailable', () => {
    expect(formatCost(unknown)).toBe('Not provided');
    expect(formatTokens(unknown.inputTokens)).toBe('—');
  });

  it('labels cost as estimated', () => {
    expect(formatCost({ ...unknown, provided: true, costUsd: 0.5 })).toContain('estimated');
  });
});
