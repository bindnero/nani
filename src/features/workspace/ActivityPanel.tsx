import { useAppStore } from '../../state/appStore';
import { EmptyState } from '../../components/ui/primitives';

/**
 * Structured activity panel. It renders ONLY events parsed from a documented
 * structured CLI output mode; it never invents tool calls from plain text
 * (architecture §6). When the CLI emits nothing structured, it says so.
 */
export function ActivityPanel() {
  const activity = useAppStore((s) => s.activity);

  return (
    <aside
      className="flex h-full w-72 min-h-0 flex-col border-l border-border bg-surface"
      aria-label="Structured activity"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold text-fg-muted">Activity</h2>
        <span className="text-[10px] text-fg-muted">from stream-json</span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {activity.length === 0 ? (
          <EmptyState
            title="No structured events"
            description="Activity appears only when the CLI emits documented structured output. Plain text is never turned into fake tool events."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {activity.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-accent">
                    {item.kind}
                  </span>
                  <time className="text-[10px] text-fg-muted">
                    {new Date(item.at).toLocaleTimeString()}
                  </time>
                </div>
                <p className="mt-0.5 break-words text-fg-muted">{item.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
