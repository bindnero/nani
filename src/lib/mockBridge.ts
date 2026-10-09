import type { NaniBridge } from './bridge';
import {
  UNKNOWN_USAGE,
  extractUsage,
  parseStreamJsonLine,
} from './claudeStream';
import { redactSecrets } from './redact';
import type {
  AuthStatus,
  DetectionResult,
  DiagnosticsBundle,
  ProjectValidation,
  ProviderApplyRequest,
  ProviderApplyResult,
  ProviderConfigPreview,
  ProviderScope,
  SessionEvent,
  SkillDetail,
  SkillImportPreview,
  SkillSummary,
  StartSessionRequest,
  StartSessionResult,
  UsageInfo,
} from './types';

/** One scripted line of simulated CLI output. */
export interface MockStep {
  stream: 'stdout' | 'stderr';
  text: string;
  delayMs?: number;
}

const DEFAULT_SCRIPT: MockStep[] = [
  { stream: 'stdout', text: '{"type":"system","subtype":"init","session_id":"mock-1","model":"claude-sonnet"}\n' },
  { stream: 'stdout', text: 'Working…\n' },
  { stream: 'stdout', text: 'Bonjour — unicodé ✅\n' },
  { stream: 'stderr', text: 'warning: simulated stderr line\n' },
  {
    stream: 'stdout',
    text:
      '{"type":"result","subtype":"success","session_id":"mock-1","is_error":false,' +
      '"duration_ms":1234,"num_turns":2,"total_cost_usd":0.0042,' +
      '"usage":{"input_tokens":1200,"output_tokens":340,"cache_read_input_tokens":50}}\n',
  },
];

export interface MockBridgeOptions {
  detection?: Partial<DetectionResult>;
  auth?: Partial<AuthStatus>;
  /** Directory returned by the fake picker; null simulates cancel. */
  pickedDirectory?: string | null;
  /** Force project validation to fail with this reason. */
  invalidProjectReason?: ProjectValidation['reason'];
  /** Make start_session reject with a spawn error. */
  spawnFailure?: string | null;
  /** Process exit code to report on completion (default 0). */
  exitCode?: number;
  script?: MockStep[];
  stepDelayMs?: number;
  skills?: SkillSummary[];
  preferences?: Partial<import('./types').Preferences>;
}

/**
 * In-memory implementation of the bridge used for browser development and for
 * unit tests. It never touches the OS and never fabricates data that a real run
 * would not produce: it replays a declared script and reports honest exit codes.
 */
export class MockBridge implements NaniBridge {
  private detection: DetectionResult;
  private auth: AuthStatus;
  private pickedDirectory: string | null;
  private invalidProjectReason: ProjectValidation['reason'] | undefined;
  private spawnFailure: string | null;
  private exitCode: number;
  private script: MockStep[];
  private stepDelayMs: number;
  private skills: SkillSummary[];
  private preferences: import('./types').Preferences;

  private handlers = new Set<(event: SessionEvent) => void>();
  private seq = 0;
  private sessionCounter = 0;
  private active: { id: string; cancelled: boolean; timers: ReturnType<typeof setTimeout>[] } | null =
    null;
  private idleResolvers: Array<() => void> = [];

  constructor(options: MockBridgeOptions = {}) {
    this.detection = {
      found: true,
      path: 'C:\\Users\\acer\\.local\\bin\\claude.exe',
      version: '2.1.295 (Claude Code)',
      source: 'PATH',
      versionExitCode: 0,
      error: null,
      checkedAt: new Date().toISOString(),
      ...options.detection,
    };
    this.auth = {
      state: 'ready',
      method: 'ANTHROPIC_API_KEY',
      detail: 'mock account',
      raw: null,
      exitCode: 0,
      checkedAt: new Date().toISOString(),
      error: null,
      ...options.auth,
    };
    this.pickedDirectory = options.pickedDirectory ?? 'C:\\Users\\acer\\projects\\demo';
    this.invalidProjectReason = options.invalidProjectReason;
    this.spawnFailure = options.spawnFailure ?? null;
    this.exitCode = options.exitCode ?? 0;
    this.script = options.script ?? DEFAULT_SCRIPT;
    this.stepDelayMs = options.stepDelayMs ?? 0;
    this.skills = options.skills ?? [];
    this.preferences = {
      theme: 'dark',
      logRetentionDays: 30,
      persistSessions: true,
      ...options.preferences,
    };
  }

  /* -------------------------- test controls -------------------------- */

  setDetection(partial: Partial<DetectionResult>): void {
    this.detection = { ...this.detection, ...partial };
  }

  setAuth(partial: Partial<AuthStatus>): void {
    this.auth = { ...this.auth, ...partial };
  }

  setPickedDirectory(path: string | null): void {
    this.pickedDirectory = path;
  }

  setInvalidProjectReason(reason: ProjectValidation['reason'] | undefined): void {
    this.invalidProjectReason = reason;
  }

  setSpawnFailure(message: string | null): void {
    this.spawnFailure = message;
  }

  setExitCode(code: number): void {
    this.exitCode = code;
  }

  setScript(script: MockStep[]): void {
    this.script = script;
  }

  setSkills(skills: SkillSummary[]): void {
    this.skills = skills;
  }

  /** Resolves once the most recent simulated session has fully exited. */
  whenIdle(): Promise<void> {
    if (!this.active) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  /* ---------------------------- det/auth ----------------------------- */

  async detectClaudeCode(): Promise<DetectionResult> {
    return { ...this.detection, checkedAt: new Date().toISOString() };
  }

  async checkAuth(): Promise<AuthStatus> {
    return { ...this.auth, checkedAt: new Date().toISOString() };
  }

  /* --------------------------- project ------------------------------- */

  async pickProjectDirectory(): Promise<string | null> {
    return this.pickedDirectory;
  }

  async validateProject(path: string): Promise<ProjectValidation> {
    if (this.invalidProjectReason) {
      return {
        valid: false,
        path,
        reason: this.invalidProjectReason,
        message: `Mock: project is invalid (${this.invalidProjectReason})`,
        isDirectory: this.invalidProjectReason !== 'not_a_directory',
        readable: this.invalidProjectReason !== 'permission_denied',
      };
    }
    const looksAbsolute = /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('/');
    return {
      valid: path.length > 0 && looksAbsolute,
      path,
      reason: looksAbsolute ? null : 'unsafe_path',
      message: looksAbsolute ? null : 'Mock: path must be absolute',
      isDirectory: true,
      readable: true,
    };
  }

  /* --------------------------- sessions ------------------------------ */

  async startSession(_request: StartSessionRequest): Promise<StartSessionResult> {
    if (this.spawnFailure) {
      throw new Error(this.spawnFailure);
    }
    const id = `mock-session-${++this.sessionCounter}`;
    const active = { id, cancelled: false, timers: [] as ReturnType<typeof setTimeout>[] };
    this.active = active;
    const startedAt = new Date().toISOString();

    // Emit session_started synchronously in the next tick.
    this.emit({
      type: 'session_started',
      sessionId: id,
      seq: this.nextSeq(),
      at: new Date().toISOString(),
      pid: 4242,
    });

    let elapsed = this.stepDelayMs;
    for (const step of this.script) {
      elapsed += this.stepDelayMs + (step.delayMs ?? 0);
      const timer = setTimeout(() => {
        if (active.cancelled) return;
        if (step.stream === 'stdout') {
          this.emitLine(id, step.text);
        } else {
          this.emit({
            type: 'stderr_chunk',
            sessionId: id,
            seq: this.nextSeq(),
            at: new Date().toISOString(),
            text: step.text,
          });
        }
      }, elapsed);
      active.timers.push(timer);
    }

    const finishTimer = setTimeout(
      () => this.finish(id),
      elapsed + this.stepDelayMs + 1,
    );
    active.timers.push(finishTimer);

    return { sessionId: id, startedAt, pid: 4242 };
  }

  async stopSession(sessionId: string): Promise<void> {
    const active = this.active;
    if (!active || active.id !== sessionId) return;
    active.cancelled = true;
    for (const t of active.timers) clearTimeout(t);
    active.timers = [];
    this.emit({
      type: 'session_stopping',
      sessionId,
      seq: this.nextSeq(),
      at: new Date().toISOString(),
    });
    this.emit({
      type: 'session_exited',
      sessionId,
      seq: this.nextSeq(),
      at: new Date().toISOString(),
      code: null,
      signal: 15,
      ok: false,
    });
    this.endActive();
  }

  async onSessionEvent(handler: (event: SessionEvent) => void): Promise<() => void> {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /* ------------------------ provider config -------------------------- */

  private providerBefore: Record<ProviderScope, string> = {
    user: '{}\n',
    project: '{}\n',
    local: '{}\n',
  };

  async previewProviderConfig(
    scope: ProviderScope,
    _projectPath?: string | null,
  ): Promise<ProviderConfigPreview> {
    const before = this.providerBefore[scope];
    const after = JSON.stringify(
      { model: 'claude-sonnet', env: { ANTHROPIC_BASE_URL: 'https://api.anthropic.com' } },
      null,
      2,
    ) + '\n';
    const target =
      scope === 'user'
        ? 'C:\\Users\\acer\\.claude\\settings.json'
        : `C:\\Users\\acer\\projects\\demo\\.claude\\settings${scope === 'local' ? '.local' : ''}.json`;
    return {
      targetPath: target,
      scope,
      exists: false,
      before: redactSecrets(before),
      after: redactSecrets(after),
      diff: diffText(before, after),
      backupPath: `${target}.bak`,
      warnings: [],
    };
  }

  async applyProviderConfig(request: ProviderApplyRequest): Promise<ProviderApplyResult> {
    this.providerBefore[request.scope] = request.contents;
    return {
      written: true,
      backupPath: request.acknowledgedBackupPath,
      message: `Mock: wrote ${request.targetPath}`,
    };
  }

  /* ----------------------------- skills ------------------------------ */

  async listSkills(_projectPath?: string | null): Promise<SkillSummary[]> {
    return this.skills.map((s) => ({ ...s }));
  }

  async getSkillDetail(path: string): Promise<SkillDetail> {
    const summary = this.skills.find((s) => s.path === path);
    if (!summary) throw new Error(`Mock: skill not found: ${path}`);
    return { ...summary, frontmatter: { name: summary.name }, files: ['SKILL.md'] };
  }

  async previewSkillImport(source: string): Promise<SkillImportPreview> {
    const name = source.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? 'skill';
    return {
      source,
      targetName: name,
      targetPath: `C:\\Users\\acer\\.claude\\skills\\${name}`,
      overwrites: false,
      files: ['SKILL.md'],
      warnings: [],
    };
  }

  async importSkill(source: string): Promise<SkillSummary> {
    const preview = await this.previewSkillImport(source);
    const skill: SkillSummary = {
      name: preview.targetName,
      description: 'Imported skill (mock)',
      source: 'user',
      path: preview.targetPath,
      valid: true,
      warnings: [],
      containsScripts: false,
    };
    this.skills = [...this.skills, skill];
    return skill;
  }

  async removeSkill(path: string): Promise<void> {
    this.skills = this.skills.filter((s) => s.path !== path);
  }

  /* -------------------------- preferences ---------------------------- */

  async getPreferences(): Promise<import('./types').Preferences> {
    return { ...this.preferences };
  }

  async savePreferences(preferences: import('./types').Preferences): Promise<void> {
    this.preferences = { ...preferences };
  }

  async exportDiagnostics(): Promise<DiagnosticsBundle> {
    return {
      generatedAt: new Date().toISOString(),
      appVersion: '0.1.0-mock',
      os: 'mock-os',
      arch: 'x64',
      claude: this.detection,
      auth: this.auth,
      entries: ['[mock] diagnostics are synthetic and redacted'],
    };
  }

  async openExternal(_url: string): Promise<void> {
    /* no-op in mock */
  }

  /* ----------------------------- internals --------------------------- */

  private emit(event: SessionEvent): void {
    for (const handler of this.handlers) handler(event);
  }

  private nextSeq(): number {
    return ++this.seq;
  }

  private emitLine(sessionId: string, text: string): void {
    // Mirror the real service layer: structured stream-json lines also produce
    // a `structured_cli_event`; everything is still emitted as raw stdout too.
    this.emit({
      type: 'stdout_chunk',
      sessionId,
      seq: this.nextSeq(),
      at: new Date().toISOString(),
      text,
    });
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseStreamJsonLine(line);
      if (!parsed) continue;
      this.emit({
        type: 'structured_cli_event',
        sessionId,
        seq: this.nextSeq(),
        at: new Date().toISOString(),
        event: parsed.raw,
      });
    }
  }

  private finish(sessionId: string): void {
    if (!this.active || this.active.id !== sessionId) return;
    this.emit({
      type: 'session_exited',
      sessionId,
      seq: this.nextSeq(),
      at: new Date().toISOString(),
      code: this.exitCode,
      signal: null,
      ok: this.exitCode === 0,
    });
    this.endActive();
  }

  private endActive(): void {
    this.active = null;
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    for (const r of resolvers) r();
  }
}

/** Compute the usage a consumer would derive from a scripted run (for tests). */
export function usageFromEvents(events: SessionEvent[]): UsageInfo {
  for (const event of events) {
    if (event.type === 'structured_cli_event') {
      const parsed = parseStreamJsonLine(JSON.stringify(event.event));
      if (parsed) {
        const usage = extractUsage(parsed);
        if (usage) return usage;
      }
    }
  }
  return UNKNOWN_USAGE;
}

/** Minimal line diff used by the mock preview. */
export function diffText(before: string, after: string): { kind: 'context' | 'added' | 'removed'; text: string }[] {
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const lines: { kind: 'context' | 'added' | 'removed'; text: string }[] = [];
  for (const line of beforeLines) {
    if (line === '' && beforeLines.length > 1) continue;
    lines.push({ kind: afterSet.has(line) ? 'context' : 'removed', text: line });
  }
  for (const line of afterLines) {
    if (line === '' && afterLines.length > 1) continue;
    if (!beforeSet.has(line)) lines.push({ kind: 'added', text: line });
  }
  return lines;
}
