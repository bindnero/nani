import { useMemo, useState, type ReactNode } from 'react';
import { useAppStore } from '../state/appStore';
import { sessionStateView, formatCost, formatDuration, formatTokens } from '../lib/status';
import { RouteContext, type AppRoute, StatusDot, cx } from './ui/primitives';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

import { FolderPickerModal } from '../features/workspace/FolderPickerModal';

export function AppShell({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>('workspace');
  const routeValue = useMemo(() => ({ route, navigate: setRoute }), [route]);

  return (
    <RouteContext.Provider value={routeValue}>
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          <StatusStrip />
        </div>
      </div>
      <FolderPickerModal />
    </RouteContext.Provider>
  );
}

function StatusStrip() {
  const sessionState = useAppStore((s) => s.sessionState);
  const usage        = useAppStore((s) => s.usage);
  const exitInfo     = useAppStore((s) => s.exitInfo);
  const session      = sessionStateView(sessionState);
  const isRunning    = sessionState === 'Running';

  const dotStatus =
    isRunning                      ? 'running'
    : sessionState === 'Failed'    ? 'error'
    : sessionState === 'Idle'      ? 'idle'
    : 'success';

  return (
    <footer
      className="flex h-7 items-center gap-4 border-t border-[var(--color-border)] bg-surface px-4"
      style={{ fontSize: '11px' }}
      aria-label="Status bar"
    >
      {/* Session state */}
      <span className="flex items-center gap-1.5 text-fg-muted" aria-live="polite">
        <StatusDot status={dotStatus} />
        <span className={cx(isRunning ? 'text-accent font-medium' : 'text-fg-muted')}>
          {session.label}
        </span>
      </span>

      <Divider />

      {/* Exit code */}
      {exitInfo && (
        <>
          <span className="text-fg-muted">
            Exit <code className="font-mono">{exitInfo.code ?? '—'}</code>
            {exitInfo.signal !== null ? ` (sig ${exitInfo.signal})` : ''}
          </span>
          <Divider />
        </>
      )}

      {/* Tokens */}
      <span className="text-fg-subtle">
        ↑ {formatTokens(usage.inputTokens)} · ↓ {formatTokens(usage.outputTokens)} tok
      </span>

      <Divider />

      {/* Cost */}
      <span className="text-fg-subtle">{formatCost(usage)}</span>

      <Divider />

      {/* Duration */}
      <span className="text-fg-subtle">{formatDuration(usage.durationMs)}</span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* Privacy notice (subtle) */}
      <span className="text-fg-subtle opacity-50">local-first · no telemetry</span>
    </footer>
  );
}

function Divider() {
  return <span className="h-3 w-px bg-[var(--color-border)] shrink-0" />;
}
