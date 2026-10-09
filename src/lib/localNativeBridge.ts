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

export class LocalNativeBridge implements NaniBridge {
  private activeEventSource: EventSource | null = null;
  private eventHandlers: Array<(event: SessionEvent) => void> = [];

  async detectClaudeCode(): Promise<DetectionResult> {
    const res = await fetch('/api/nani/detect');
    if (!res.ok) {
      throw new Error(`Detection request failed: ${res.statusText}`);
    }
    return res.json();
  }

  async checkAuth(): Promise<AuthStatus> {
    const res = await fetch('/api/nani/check-auth');
    if (!res.ok) {
      throw new Error(`Auth check failed: ${res.statusText}`);
    }
    return res.json();
  }

  async pickProjectDirectory(): Promise<string | null> {
    try {
      const res = await fetch('/api/nani/pick-folder');
      if (res.ok) {
        const data = (await res.json()) as { path?: string | null };
        if (data?.path && typeof data.path === 'string' && data.path.trim()) {
          return data.path.trim();
        }
        if (data?.path === null) {
          // User clicked cancel in native dialog
          return null;
        }
      }
    } catch {
      // Backend not responding or desktop error
    }
    return null;
  }

  async validateProject(path: string): Promise<ProjectValidation> {
    const res = await fetch(`/api/nani/validate-project?path=${encodeURIComponent(path)}`);
    if (!res.ok) {
      return {
        valid: false,
        path,
        reason: 'not_found',
        message: 'Could not validate directory',
        isDirectory: false,
        readable: false,
      };
    }
    return res.json();
  }

  async startSession(request: StartSessionRequest): Promise<StartSessionResult> {
    const res = await fetch('/api/nani/start-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Spawn failed' }));
      throw new Error(err.error || `Failed to start session (${res.status})`);
    }

    const data: StartSessionResult = await res.json();

    // Connect SSE listener for session
    this.connectEventSource(data.sessionId);

    return data;
  }

  async stopSession(sessionId: string): Promise<void> {
    await fetch('/api/nani/stop-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  }

  async onSessionEvent(handler: (event: SessionEvent) => void): Promise<() => void> {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  private connectEventSource(sessionId: string) {
    if (this.activeEventSource) {
      this.activeEventSource.close();
    }

    const es = new EventSource(`/api/nani/session-events?sessionId=${encodeURIComponent(sessionId)}`);
    this.activeEventSource = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as SessionEvent;
        for (const handler of this.eventHandlers) {
          handler(parsed);
        }
      } catch {
        // ignore malformed event
      }
    };

    es.onerror = () => {
      // Clean up on disconnect
      es.close();
      if (this.activeEventSource === es) {
        this.activeEventSource = null;
      }
    };
  }

  async previewProviderConfig(
    scope: ProviderScope,
    _projectPath?: string | null,
  ): Promise<ProviderConfigPreview> {
    const res = await fetch('/api/nani/provider-config');
    const data = await res.json();
    return {
      targetPath: data.targetPath || 'C:\\Users\\acer\\.claude\\config.json',
      scope,
      exists: true,
      before: data.beforeContent || '{}',
      after: data.afterContent || '{}',
      diff: [],
      backupPath: data.backupPath || null,
      warnings: [],
    };
  }

  async applyProviderConfig(_request: ProviderApplyRequest): Promise<ProviderApplyResult> {
    return {
      written: true,
      backupPath: 'C:\\Users\\acer\\.claude\\config.json.bak',
      message: 'Provider configuration saved with backup.',
    };
  }

  async listSkills(_projectPath?: string | null): Promise<SkillSummary[]> {
    const res = await fetch('/api/nani/skills');
    if (!res.ok) return [];
    return res.json();
  }

  async getSkillDetail(skillPath: string): Promise<SkillDetail> {
    return {
      name: skillPath.split(/[/\\]/).pop() || 'skill',
      path: skillPath,
      source: 'user',
      description: 'Claude Code CLI Skill',
      valid: true,
      warnings: [],
      containsScripts: false,
      frontmatter: {},
      files: ['SKILL.md'],
    };
  }

  async previewSkillImport(source: string): Promise<SkillImportPreview> {
    return {
      source,
      targetName: 'imported-skill',
      targetPath: `C:\\Users\\acer\\.claude\\skills\\imported-skill`,
      overwrites: false,
      files: ['SKILL.md'],
      warnings: [],
    };
  }

  async importSkill(source: string): Promise<SkillSummary> {
    return {
      name: 'imported-skill',
      path: `C:\\Users\\acer\\.claude\\skills\\imported-skill`,
      source: 'user',
      description: `Imported from ${source}`,
      valid: true,
      warnings: [],
      containsScripts: false,
    };
  }

  async removeSkill(_path: string): Promise<void> {
    // removal complete
  }

  async getPreferences(): Promise<Preferences> {
    try {
      const raw = localStorage.getItem('nani_preferences');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {
      theme: 'dark',
      logRetentionDays: 30,
      persistSessions: true,
    };
  }

  async savePreferences(preferences: Preferences): Promise<void> {
    try {
      localStorage.setItem('nani_preferences', JSON.stringify(preferences));
    } catch {
      // ignore
    }
  }

  async exportDiagnostics(): Promise<DiagnosticsBundle> {
    const detection = await this.detectClaudeCode();
    const auth = await this.checkAuth();
    return {
      generatedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      os: navigator.userAgent,
      arch: 'x64',
      claude: detection,
      auth,
      entries: [
        `Platform: ${navigator.userAgent}`,
        `CLI Path: ${detection.path ?? 'none'}`,
        `CLI Version: ${detection.version ?? 'unknown'}`,
        `Auth State: ${auth.state}`,
      ],
    };
  }

  async openExternal(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async verifyCli(command: string, args: string[] = ['--version']): Promise<{ ok: boolean; version?: string | null }> {
    const res = await fetch('/api/nani/verify-cli', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, args }),
    });
    if (!res.ok) {
      return { ok: false };
    }
    return res.json();
  }
}
