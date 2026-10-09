import type {
  AuthStatus,
  DetectionResult,
  DiagnosticsBundle,
  Preferences,
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
} from './types';

/**
 * The complete typed surface the React app is allowed to use to reach native
 * capabilities. Two implementations exist:
 *
 *  - `TauriBridge`  -> real `invoke()` calls into the Rust service layer.
 *  - `MockBridge`   -> an in-memory fake CLI for browser dev and unit tests.
 *
 * Keeping this interface narrow makes it impossible for presentational code to
 * reach the OS directly, and lets tests drive every failure path.
 */
export interface NaniBridge {
  /** Phase 2: locate the CLI executable and read its version. */
  detectClaudeCode(): Promise<DetectionResult>;
  /** Phase 2: real readiness check, distinct from mere installation. */
  checkAuth(): Promise<AuthStatus>;

  /** Phase 3: native folder picker. Returns null when the user cancels. */
  pickProjectDirectory(): Promise<string | null>;
  /** Phase 3: validate a directory before launch. */
  validateProject(path: string): Promise<ProjectValidation>;

  /** Phase 3: launch a session. Rejects on spawn failure. */
  startSession(request: StartSessionRequest): Promise<StartSessionResult>;
  /** Phase 3: request a stop; final state arrives as `session_exited`. */
  stopSession(sessionId: string): Promise<void>;
  /** Subscribe to real session events. Returns an unsubscribe function. */
  onSessionEvent(handler: (event: SessionEvent) => void): Promise<() => void>;

  /**
   * Phase 4: build a preview/diff without writing anything. Project and local
   * scopes need the active project directory to resolve their settings file.
   */
  previewProviderConfig(
    scope: ProviderScope,
    projectPath?: string | null,
  ): Promise<ProviderConfigPreview>;
  /** Phase 4: apply a previewed change (backup + write). */
  applyProviderConfig(request: ProviderApplyRequest): Promise<ProviderApplyResult>;

  /** Phase 5: skills. No imported script is ever executed. */
  listSkills(projectPath?: string | null): Promise<SkillSummary[]>;
  getSkillDetail(path: string): Promise<SkillDetail>;
  previewSkillImport(source: string): Promise<SkillImportPreview>;
  importSkill(source: string): Promise<SkillSummary>;
  removeSkill(path: string): Promise<void>;

  /** Preferences + diagnostics. */
  getPreferences(): Promise<Preferences>;
  savePreferences(preferences: Preferences): Promise<void>;
  exportDiagnostics(): Promise<DiagnosticsBundle>;

  /** Open an https URL in the user's default browser. */
  openExternal(url: string): Promise<void>;
}

export class BridgeUnavailableError extends Error {
  constructor(scope: string) {
    super(
      `The native service for "${scope}" is not available in this build. ` +
        'Run inside the Nani desktop app (Tauri) or use the mock bridge.',
    );
    this.name = 'BridgeUnavailableError';
  }
}

/** Detect whether we are running inside a Tauri webview. */
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as Record<string, unknown>)['__TAURI_INTERNALS__'] !== 'undefined'
  );
}

let active: NaniBridge | null = null;

export function setBridge(bridge: NaniBridge): void {
  active = bridge;
}

export function getBridge(): NaniBridge {
  if (!active) {
    throw new BridgeUnavailableError('bridge');
  }
  return active;
}
