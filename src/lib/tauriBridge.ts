import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import type { NaniBridge } from './bridge';
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

/** Event name the Rust service layer emits session events on. */
export const SESSION_EVENT_NAME = 'nani://session-event';

/**
 * Real bridge. Every method maps to a single Rust command or Tauri plugin call.
 * No method fabricates a value: if the native side cannot answer, it returns an
 * error or an explicit "unknown" shape.
 */
export class TauriBridge implements NaniBridge {
  detectClaudeCode(): Promise<DetectionResult> {
    return invoke<DetectionResult>('detect_claude_code');
  }

  checkAuth(): Promise<AuthStatus> {
    return invoke<AuthStatus>('check_auth');
  }

  async pickProjectDirectory(): Promise<string | null> {
    const selection = await open({
      directory: true,
      multiple: false,
      title: 'Select a project folder',
    });
    if (selection === null) return null;
    return Array.isArray(selection) ? selection[0] ?? null : selection;
  }

  validateProject(path: string): Promise<ProjectValidation> {
    return invoke<ProjectValidation>('validate_project', { path });
  }

  startSession(request: StartSessionRequest): Promise<StartSessionResult> {
    return invoke<StartSessionResult>('start_session', { request });
  }

  stopSession(sessionId: string): Promise<void> {
    return invoke<void>('stop_session', { sessionId });
  }

  async onSessionEvent(handler: (event: SessionEvent) => void): Promise<() => void> {
    const unlisten = await listen<SessionEvent>(SESSION_EVENT_NAME, (e) => handler(e.payload));
    return () => {
      unlisten();
    };
  }

  previewProviderConfig(
    scope: ProviderScope,
    projectPath?: string | null,
  ): Promise<ProviderConfigPreview> {
    return invoke<ProviderConfigPreview>('preview_provider_config', {
      scope,
      projectPath: projectPath ?? null,
    });
  }

  applyProviderConfig(request: ProviderApplyRequest): Promise<ProviderApplyResult> {
    return invoke<ProviderApplyResult>('apply_provider_config', { request });
  }

  listSkills(projectPath?: string | null): Promise<SkillSummary[]> {
    return invoke<SkillSummary[]>('list_skills', { projectPath: projectPath ?? null });
  }

  getSkillDetail(path: string): Promise<SkillDetail> {
    return invoke<SkillDetail>('get_skill_detail', { path });
  }

  previewSkillImport(source: string): Promise<SkillImportPreview> {
    return invoke<SkillImportPreview>('preview_skill_import', { source });
  }

  importSkill(source: string): Promise<SkillSummary> {
    return invoke<SkillSummary>('import_skill', { source });
  }

  removeSkill(path: string): Promise<void> {
    return invoke<void>('remove_skill', { path });
  }

  getPreferences(): Promise<Preferences> {
    return invoke<Preferences>('get_preferences');
  }

  savePreferences(preferences: Preferences): Promise<void> {
    return invoke<void>('save_preferences', { preferences });
  }

  exportDiagnostics(): Promise<DiagnosticsBundle> {
    return invoke<DiagnosticsBundle>('export_diagnostics');
  }

  async openExternal(url: string): Promise<void> {
    await invoke('open_external', { url });
  }
}
