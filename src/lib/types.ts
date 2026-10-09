/**
 * Shared type contracts between the React frontend and the Tauri/Rust service layer.
 *
 * Every value shown to the user must derive from a real event or be explicitly
 * labelled as unknown/not provided. These types intentionally make "unknown"
 * representable so the UI cannot silently fabricate status, cost or progress.
 */

/** Session lifecycle state model (architecture §5). */
export type SessionState =
  | 'Idle'
  | 'Starting'
  | 'Running'
  | 'Stopping'
  | 'Completed'
  | 'Failed';

/** How the CLI executable was discovered. */
export type DetectionSource = 'PATH' | 'well-known' | 'environment' | 'configured' | 'none';

export interface DetectionError {
  /** Stable machine code, e.g. `not_found`, `permission_denied`, `version_check_failed`. */
  code: string;
  /** Human readable explanation. */
  message: string;
}

export interface DetectionResult {
  /** True only when an executable was actually located and confirmed. */
  found: boolean;
  /** Absolute path of the detected executable, when found. */
  path: string | null;
  /** Version string reported by the CLI, when it could be read. */
  version: string | null;
  /** How the executable was found. */
  source: DetectionSource;
  /** Raw exit code of the version check, when it ran. */
  versionExitCode: number | null;
  /** Populated when detection or version check failed. */
  error: DetectionError | null;
  /** ISO-8601 timestamp of when this detection actually ran. */
  checkedAt: string;
}

/**
 * Authentication / provider readiness. This is deliberately separate from
 * `DetectionResult`: a CLI can be installed but not authenticated.
 */
export type AuthState = 'ready' | 'not_ready' | 'unknown';

export interface AuthStatus {
  state: AuthState;
  /** Documented credential source, e.g. `ANTHROPIC_API_KEY`, `oauth`, `apiKeyHelper`. */
  method: string | null;
  /** Account/organization detail when the CLI reports it. */
  detail: string | null;
  /** Raw command output, redacted. */
  raw: string | null;
  /** Exit code of the real check that ran, when one ran. */
  exitCode: number | null;
  /** ISO-8601 timestamp of when this check actually ran. */
  checkedAt: string;
  error: DetectionError | null;
}

export type ProjectInvalidReason =
  | 'not_found'
  | 'not_a_directory'
  | 'permission_denied'
  | 'unsafe_path'
  | 'unknown';

export interface ProjectValidation {
  valid: boolean;
  path: string;
  reason: ProjectInvalidReason | null;
  message: string | null;
  isDirectory: boolean;
  readable: boolean;
}

export interface StartSessionRequest {
  /** Absolute working directory for the CLI. */
  projectPath: string;
  /** User prompt text, passed as a discrete argument (never shell-concatenated). */
  prompt: string;
  /** Optional model alias/name. */
  model?: string | null;
  /** CLI output mode. Defaults to `stream-json` for structured streaming. */
  outputFormat?: 'text' | 'json' | 'stream-json';
  /** Extra directories to allow tool access to. */
  addDirs?: string[];
  /** Permission mode, restricted to documented values. */
  permissionMode?:
    | 'default'
    | 'acceptEdits'
    | 'plan'
    | 'bypassPermissions'
    | 'dontAsk'
    | 'manual'
    | 'auto'
    | null;
}

export interface StartSessionResult {
  sessionId: string;
  startedAt: string;
  pid: number | null;
}

/* ------------------------------------------------------------------ */
/* Event contract (architecture §6).                                   */
/* ------------------------------------------------------------------ */

export interface BaseEvent {
  sessionId: string;
  /** Monotonic sequence number assigned by the service layer. */
  seq: number;
  /** ISO-8601 timestamp of when the event was emitted. */
  at: string;
}

export interface SessionStartedEvent extends BaseEvent {
  type: 'session_started';
  pid: number | null;
}

export interface StdoutChunkEvent extends BaseEvent {
  type: 'stdout_chunk';
  text: string;
}

export interface StderrChunkEvent extends BaseEvent {
  type: 'stderr_chunk';
  text: string;
}

export interface StructuredCliEvent extends BaseEvent {
  type: 'structured_cli_event';
  /**
   * Only ever populated by parsing a documented structured output mode
   * (e.g. `--output-format stream-json`). Never synthesised from plain text.
   */
  event: Record<string, unknown>;
}

export interface SessionStoppingEvent extends BaseEvent {
  type: 'session_stopping';
}

export interface SessionExitedEvent extends BaseEvent {
  type: 'session_exited';
  code: number | null;
  signal: number | null;
  /** Derived: true when code is 0, false otherwise or when killed. */
  ok: boolean;
}

export interface DiagnosticEvent extends BaseEvent {
  type: 'diagnostic';
  level: 'info' | 'warn' | 'error';
  message: string;
}

export type SessionEvent =
  | SessionStartedEvent
  | StdoutChunkEvent
  | StderrChunkEvent
  | StructuredCliEvent
  | SessionStoppingEvent
  | SessionExitedEvent
  | DiagnosticEvent;

/**
 * Token usage / cost. Only shown when supplied by a trustworthy, documented
 * source. `provided:false` means "Not provided" must be displayed.
 */
export interface UsageInfo {
  provided: boolean;
  /** Documented as a client-side estimate, never a billing statement. */
  estimated: true;
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  durationMs: number | null;
  numTurns: number | null;
  source: string | null;
}

/* ------------------------------------------------------------------ */
/* Provider configuration (Phase 4).                                   */
/* ------------------------------------------------------------------ */

export type ProviderScope = 'user' | 'project' | 'local';

export interface ConfigDiffLine {
  kind: 'context' | 'added' | 'removed';
  text: string;
}

export interface ProviderConfigPreview {
  /** Absolute path of the settings file that would change. */
  targetPath: string;
  scope: ProviderScope;
  exists: boolean;
  /** Redacted before/after JSON, for review. */
  before: string;
  after: string;
  diff: ConfigDiffLine[];
  /** Path the existing file would be backed up to before any write. */
  backupPath: string | null;
  warnings: string[];
}

export interface ProviderApplyRequest {
  scope: ProviderScope;
  targetPath: string;
  /** The exact after-state that was previewed and consented to. */
  contents: string;
  /** Caller must echo the backup path it acknowledged. */
  acknowledgedBackupPath: string | null;
}

export interface ProviderApplyResult {
  written: boolean;
  backupPath: string | null;
  message: string;
}

/* ------------------------------------------------------------------ */
/* Skills (Phase 5).                                                   */
/* ------------------------------------------------------------------ */

export type SkillSource = 'user' | 'project' | 'plugin' | 'unknown';

export interface SkillSummary {
  name: string;
  description: string | null;
  source: SkillSource;
  /** Absolute directory containing SKILL.md. */
  path: string;
  valid: boolean;
  warnings: string[];
  /** Scripts are never executed; this reports whether any were found. */
  containsScripts: boolean;
}

export interface SkillDetail extends SkillSummary {
  frontmatter: Record<string, unknown>;
  files: string[];
}

export interface SkillImportPreview {
  source: string;
  targetName: string;
  targetPath: string;
  overwrites: boolean;
  files: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/* Preferences.                                                        */
/* ------------------------------------------------------------------ */

export type ThemePreference = 'dark' | 'light' | 'system';

export interface Preferences {
  theme: ThemePreference;
  /** Local retention for session logs, in days. */
  logRetentionDays: number;
  /** Whether to persist session transcripts locally. */
  persistSessions: boolean;
}

/* ------------------------------------------------------------------ */
/* Diagnostics.                                                        */
/* ------------------------------------------------------------------ */

export interface DiagnosticsBundle {
  generatedAt: string;
  appVersion: string;
  os: string;
  arch: string;
  claude: DetectionResult;
  auth: AuthStatus;
  /** Already redacted before it reaches the frontend. */
  entries: string[];
}
