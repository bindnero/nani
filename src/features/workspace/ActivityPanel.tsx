import { useAppStore } from '../../state/appStore';
import { EmptyState, StatusDot } from '../../components/ui/primitives';
import { ActivityIcon } from '../../components/ui/icons';

/**
 * Structured activity panel — renders only documented structured CLI events;
 * never invents tool calls from plain text (architecture §6).
 */
export function ActivityPanel() {
  const activity = useAppStore((s) => s.activity);

  return (
    <aside
      className="flex h-full w-64 min-h-0 flex-col border-l border-[var(--color-border)] bg-surface"
      aria-label="Structured activity"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-3.5 w-3.5 text-fg-muted" />
          <span className="text-xs font-semibold text-fg-muted">Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          {activity.length > 0 && (
            <span className="rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-accent">
              {activity.length}
            </span>
          )}
          <span className="text-[9px] text-fg-subtle">stream-json</span>
        </div>
      </header>

      {/* Events */}
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {activity.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon className="h-5 w-5" />}
            title="No events yet"
            description="Structured activity appears only when the CLI emits documented JSON events. Plain text is never fabricated into tool calls."
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {activity.map((item) => (
              <li
                key={item.id}
                className="group animate-fade-in rounded-lg border border-[var(--color-border)] bg-bg px-3 py-2 text-xs transition-colors hover:border-[var(--color-border-focus)]/30"
              >
                {/* Kind + time */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status="idle" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-accent">
                      {item.kind}
                    </span>
                  </div>
                  <time className="text-[10px] tabular-nums text-fg-subtle">
                    {new Date(item.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </time>
                </div>

                {/* Summary */}
                <p className="mt-1 break-words leading-relaxed text-fg-muted">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
