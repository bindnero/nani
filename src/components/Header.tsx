import { useAppStore } from '../state/appStore';
import { readinessView, sessionStateView } from '../lib/status';
import { Badge, Button, StatusDot } from './ui/primitives';
import { FolderIcon, RefreshIcon } from './ui/icons';

export function Header() {
  const projectPath   = useAppStore((s) => s.projectPath);
  const detection     = useAppStore((s) => s.detection);
  const auth          = useAppStore((s) => s.auth);
  const sessionState  = useAppStore((s) => s.sessionState);
  const pickProject   = useAppStore((s) => s.pickProject);
  const runDetection  = useAppStore((s) => s.runDetection);
  const cliEngines    = useAppStore((s) => s.cliEngines);
  const activeCliId   = useAppStore((s) => s.activeCliId);
  const setActiveCliId = useAppStore((s) => s.setActiveCliId);
  const activeCli     = cliEngines.find((c) => c.id === activeCliId);

  const readiness = readinessView(detection, auth);
  const session   = sessionStateView(sessionState);

  const isRunning = sessionState === 'Running';

  const dotStatus =
    isRunning                            ? 'running'
    : sessionState === 'Failed'          ? 'error'
    : readiness.badge.tone === 'success' ? 'success'
    : readiness.badge.tone === 'warn'    ? 'warn'
    : 'idle';

  return (
    <header className="flex h-12 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-surface px-4">
      {/* Left: project path */}
      <button
        type="button"
        onClick={() => void pickProject()}
        className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-elevated"
        title={projectPath ?? 'Click to choose a project folder'}
      >
        <FolderIcon className="h-4 w-4 shrink-0 text-fg-muted group-hover:text-accent transition-colors" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-fg">
            {projectPath ? basename(projectPath) : 'No project selected'}
          </p>
          <p className="truncate text-[10px] text-fg-muted">
            {projectPath ?? 'Click to choose a folder'}
          </p>
        </div>
      </button>

      {/* Right: status pills */}
      <div className="flex shrink-0 items-center gap-2">
        {/* Active CLI engine selector */}
        {cliEngines.length > 1 ? (
          <select
            value={activeCliId}
            onChange={(e) => setActiveCliId(e.target.value)}
            className="h-6 rounded-md border border-[var(--color-border)] bg-elevated px-2 text-[11px] font-medium text-fg outline-none hover:border-[var(--color-border-focus)] transition-colors cursor-pointer"
            title="Switch active CLI Engine"
          >
            {cliEngines.map((cli) => (
              <option key={cli.id} value={cli.id}>
                ⚡ {cli.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-elevated px-2 py-0.5 text-[11px] font-medium text-fg-muted border border-[var(--color-border)]">
            ⚡ {activeCli?.name ?? 'Claude Code'}
          </span>
        )}

        {/* CLI readiness */}
        <div className="flex items-center gap-1.5">
          <StatusDot status={dotStatus} />
          <Badge tone={readiness.badge.tone}>{readiness.badge.label}</Badge>
        </div>

        {/* Session state */}
        <Badge
          tone={
            isRunning                      ? 'accent'
            : sessionState === 'Failed'    ? 'danger'
            : sessionState === 'Starting'  ? 'warn'
            : 'neutral'
          }
          dot={isRunning}
        >
          {session.label}
        </Badge>

        {/* Re-detect button */}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => void runDetection()}
          aria-label="Re-check Claude Code"
          title="Re-detect Claude Code CLI"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
        </Button>
      </div>
    </header>
  );
}

function basename(path: string): string {
  const parts = path.replace(/[/\\]+$/, '').split(/[/\\]/);
  return parts[parts.length - 1] || path;
}
