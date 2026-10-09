import { useAppStore } from '../state/appStore';
import { readinessView, sessionStateView } from '../lib/status';
import { Badge } from './ui/primitives';

export function Header() {
  const projectPath = useAppStore((s) => s.projectPath);
  const detection = useAppStore((s) => s.detection);
  const auth = useAppStore((s) => s.auth);
  const sessionState = useAppStore((s) => s.sessionState);

  const readiness = readinessView(detection, auth);
  const session = sessionStateView(sessionState);

  const statusTitle =
    detection?.found && projectPath
      ? 'Project selected; ready to start a session'
      : 'Select a project to begin';

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg" title={statusTitle}>
          {projectPath ? basename(projectPath) : 'No project selected'}
        </p>
        <p
          className="truncate text-xs text-fg-muted"
          title={projectPath ?? undefined}
          aria-label="Working directory"
        >
          {projectPath ?? 'Choose a folder to give Claude Code a working directory.'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={readiness.badge.tone}>{readiness.badge.label}</Badge>
        <Badge tone={session.tone}>{session.label}</Badge>
      </div>
    </header>
  );
}

function basename(path: string): string {
  const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
  return parts[parts.length - 1] || path;
}
