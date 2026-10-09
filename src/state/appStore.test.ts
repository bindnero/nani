import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NaniBridge } from '../lib/bridge';
import type {
  DiagnosticsBundle,
  ProviderApplyRequest,
  ProviderApplyResult,
  ProviderConfigPreview,
  ProviderScope,
  SessionEvent,
  SkillDetail,
  SkillImportPreview,
  SkillSummary,
  StartSessionRequest,
} from '../lib/types';
import { MAX_OUTPUT_LINES, useAppStore } from './appStore';

/** A bridge whose events are emitted by the test, so transitions are exact. */
class ManualBridge implements NaniBridge {
  handler: ((event: SessionEvent) => void) | null = null;
  startCalls: StartSessionRequest[] = [];
  stopCalls: string[] = [];
  spawnError: string | null = null;
  projectValid = true;

  emit(event: SessionEvent): void {
    this.handler?.(event);
  }

  async detectClaudeCode() {
    return {
      found: true,
      path: 'C:\\claude.exe',
      version: '2.1.295',
      source: 'PATH' as const,
      versionExitCode: 0,
      error: null,
      checkedAt: new Date().toISOString(),
    };
  }
  async checkAuth() {
    return {
      state: 'ready' as const,
      method: 'ANTHROPIC_API_KEY',
      detail: null,
      raw: null,
      exitCode: 0,
      checkedAt: new Date().toISOString(),
      error: null,
    };
  }
  async pickProjectDirectory() {
    return 'C:\\proj';
  }
  async validateProject(path: string) {
    return {
      valid: this.projectValid,
      path,
      reason: this.projectValid ? null : ('not_found' as const),
      message: this.projectValid ? null : 'missing',
      isDirectory: true,
      readable: true,
    };
  }
  async startSession(request: StartSessionRequest) {
    if (this.spawnError) throw new Error(this.spawnError);
    this.startCalls.push(request);
    return { sessionId: 's1', startedAt: new Date().toISOString(), pid: 1 };
  }
  async stopSession(id: string) {
    this.stopCalls.push(id);
  }
  async onSessionEvent(handler: (event: SessionEvent) => void) {
    this.handler = handler;
    return () => {
      this.handler = null;
    };
  }
  async previewProviderConfig(
    _scope: ProviderScope,
    _projectPath?: string | null,
  ): Promise<ProviderConfigPreview> {
    throw new Error('not used');
  }
  async applyProviderConfig(_request: ProviderApplyRequest): Promise<ProviderApplyResult> {
    throw new Error('not used');
  }
  async listSkills(_projectPath?: string | null): Promise<SkillSummary[]> {
    return [];
  }
  async getSkillDetail(_path: string): Promise<SkillDetail> {
    throw new Error('not used');
  }
  async previewSkillImport(_source: string): Promise<SkillImportPreview> {
    throw new Error('not used');
  }
  async importSkill(_source: string): Promise<SkillSummary> {
    throw new Error('not used');
  }
  async removeSkill(_path: string): Promise<void> {}
  async getPreferences() {
    return { theme: 'dark' as const, logRetentionDays: 30, persistSessions: true };
  }
  async savePreferences(): Promise<void> {}
  async exportDiagnostics(): Promise<DiagnosticsBundle> {
    throw new Error('not used');
  }
  async openExternal(_url: string): Promise<void> {}
}

const baseEvent = { sessionId: 's1', seq: 1, at: new Date().toISOString() };

let bridge: ManualBridge;

beforeEach(async () => {
  bridge = new ManualBridge();
  useAppStore.setState({
    bridge: null,
    ready: false,
    detection: null,
    projectPath: null,
    projectValidation: null,
    draftPrompt: '',
    sessionId: null,
    sessionState: 'Idle',
    startError: null,
    output: [],
    activity: [],
    exitInfo: null,
  });
  await useAppStore.getState().init(bridge);
  useAppStore.setState({ detection: await bridge.detectClaudeCode() });
  useAppStore.getState().setProjectPath('C:\\proj');
  await useAppStore.getState().validateProject();
});

describe('session state machine', () => {
  it('goes Idle -> Starting -> Running -> Completed', async () => {
    useAppStore.getState().setDraftPrompt('do work');
    await useAppStore.getState().startSession();
    expect(useAppStore.getState().sessionState).toBe('Starting');

    bridge.emit({ ...baseEvent, type: 'session_started', pid: 1 });
    expect(useAppStore.getState().sessionState).toBe('Running');

    bridge.emit({ ...baseEvent, type: 'session_exited', code: 0, signal: null, ok: true });
    expect(useAppStore.getState().sessionState).toBe('Completed');
    expect(useAppStore.getState().exitInfo?.ok).toBe(true);
  });

  it('goes to Failed on nonzero exit', async () => {
    useAppStore.getState().setDraftPrompt('x');
    await useAppStore.getState().startSession();
    bridge.emit({ ...baseEvent, type: 'session_started', pid: 1 });
    bridge.emit({ ...baseEvent, type: 'session_exited', code: 1, signal: null, ok: false });
    expect(useAppStore.getState().sessionState).toBe('Failed');
  });

  it('prevents duplicate launches while running', async () => {
    useAppStore.getState().setDraftPrompt('x');
    await useAppStore.getState().startSession();
    bridge.emit({ ...baseEvent, type: 'session_started', pid: 1 });
    await useAppStore.getState().startSession();
    expect(bridge.startCalls).toHaveLength(1);
  });

  it('stops a session and ends in Failed after a killed exit', async () => {
    useAppStore.getState().setDraftPrompt('x');
    await useAppStore.getState().startSession();
    bridge.emit({ ...baseEvent, type: 'session_started', pid: 1 });
    await useAppStore.getState().stopSession();
    expect(useAppStore.getState().sessionState).toBe('Stopping');
    expect(bridge.stopCalls).toEqual(['s1']);

    bridge.emit({ ...baseEvent, type: 'session_exited', code: null, signal: 15, ok: false });
    expect(useAppStore.getState().sessionState).toBe('Failed');
  });

  it('fails fast when the project is invalid', async () => {
    bridge.projectValid = false;
    useAppStore.setState({ projectValidation: null });
    useAppStore.getState().setDraftPrompt('x');
    await useAppStore.getState().startSession();
    expect(useAppStore.getState().sessionState).toBe('Failed');
    expect(useAppStore.getState().startError).toBe('missing');
  });

  it('surfaces a spawn error as Failed', async () => {
    bridge.spawnError = 'spawn ENOENT';
    useAppStore.getState().setDraftPrompt('x');
    await useAppStore.getState().startSession();
    expect(useAppStore.getState().sessionState).toBe('Failed');
    expect(useAppStore.getState().startError).toBe('spawn ENOENT');
  });
});

describe('output and activity', () => {
  it('routes stdout and stderr into labelled entries', () => {
    bridge.emit({ ...baseEvent, type: 'stdout_chunk', text: 'out\n' });
    bridge.emit({ ...baseEvent, type: 'stderr_chunk', text: 'err\n' });
    const streams = useAppStore.getState().output.map((e) => e.stream);
    expect(streams).toEqual(['stdout', 'stderr']);
  });

  it('derives activity and usage from structured events only', () => {
    bridge.emit({
      ...baseEvent,
      type: 'structured_cli_event',
      event: { type: 'system', subtype: 'init', session_id: 's1' },
    });
    bridge.emit({
      ...baseEvent,
      type: 'structured_cli_event',
      event: {
        type: 'result',
        subtype: 'success',
        session_id: 's1',
        total_cost_usd: 0.01,
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    });
    expect(useAppStore.getState().activity).toHaveLength(2);
    expect(useAppStore.getState().usage.provided).toBe(true);
    expect(useAppStore.getState().usage.costUsd).toBeCloseTo(0.01);
  });

  it('bounds retained output to MAX_OUTPUT_LINES', () => {
    for (let i = 0; i < MAX_OUTPUT_LINES + 100; i++) {
      bridge.emit({ ...baseEvent, type: 'stdout_chunk', text: `line ${i}\n` });
    }
    const output = useAppStore.getState().output;
    expect(output).toHaveLength(MAX_OUTPUT_LINES);
    expect(output[output.length - 1]?.text).toBe(`line ${MAX_OUTPUT_LINES + 99}\n`);
  });

  it('labels Nani diagnostics distinctly from CLI output', () => {
    bridge.emit({ ...baseEvent, type: 'diagnostic', level: 'warn', message: 'heads up' });
    expect(useAppStore.getState().output[0]?.stream).toBe('diagnostic');
  });
});

describe('misc', () => {
  it('records diagnostics failure as an unknown auth state, never ready', async () => {
    const failing: ManualBridge = new ManualBridge();
    failing.checkAuth = vi.fn().mockRejectedValue(new Error('boom')) as never;
    useAppStore.setState({ bridge: failing });
    await useAppStore.getState().runAuthCheck();
    expect(useAppStore.getState().auth?.state).toBe('unknown');
  });
});
