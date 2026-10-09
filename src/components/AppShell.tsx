import { useMemo, useState, type ReactNode } from 'react';
import { useAppStore } from '../state/appStore';
import { sessionStateView, formatCost, formatDuration, formatTokens } from '../lib/status';
import { RouteContext, type AppRoute } from './ui/primitives';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppShell({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<AppRoute>('workspace');
  const routeValue = useMemo(() => ({ route, navigate: setRoute }), [route]);

  return (
    <RouteContext.Provider value={routeValue}>
      <div className="flex h-full">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          <StatusStrip />
        </div>
      </div>
    </RouteContext.Provider>
  );
}

function StatusStrip() {
  const sessionState = useAppStore((s) => s.sessionState);
  const usage = useAppStore((s) => s.usage);
  const exitInfo = useAppStore((s) => s.exitInfo);
  const session = sessionStateView(sessionState);

  return (
    <footer
      className="flex h-8 items-center gap-4 border-t border-border bg-surface px-4 text-xs text-fg-muted"
      aria-label="Status"
    >
      <span aria-live="polite">State: {session.label}</span>
      {exitInfo && (
        <span>
          Exit: {exitInfo.code ?? '—'}
          {exitInfo.signal !== null ? ` (signal ${exitInfo.signal})` : ''}
        </span>
      )}
      <span>Tokens (in/out): {formatTokens(usage.inputTokens)} / {formatTokens(usage.outputTokens)}</span>
      <span>Cost: {formatCost(usage)}</span>
      <span>Duration: {formatDuration(usage.durationMs)}</span>
      {!usage.provided && (
        <span className="opacity-70">Usage "Not provided" until a result event supplies it.</span>
      )}
    </footer>
  );
}
