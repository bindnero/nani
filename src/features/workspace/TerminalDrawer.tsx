import { useAppStore } from '../../state/appStore';
import { Button, cx } from '../../components/ui/primitives';
import { TerminalIcon, TrashIcon } from '../../components/ui/icons';

/**
 * Bottom drawer terminal view. Keeps stdout, stderr and Nani diagnostics
 * visually distinguishable (PRD §5.4, architecture §6).
 */
export function TerminalDrawer({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const output = useAppStore((s) => s.output);
  const clearOutput = useAppStore((s) => s.clearOutput);

  return (
    <div className="border-t border-border bg-surface">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex items-center gap-2 text-xs font-medium text-fg-muted hover:text-fg"
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          Terminal {open ? '▾' : '▸'}
        </button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-3 text-[10px] text-fg-muted">
            <Legend tone="stdout" label="stdout" />
            <Legend tone="stderr" label="stderr" />
            <Legend tone="diagnostic" label="nani" />
          </span>
          <Button size="sm" variant="ghost" onClick={clearOutput} disabled={!output.length}>
            <TrashIcon className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>
      {open && (
        <div
          className="h-48 overflow-auto border-t border-border bg-bg p-2 font-mono text-xs"
          role="log"
          aria-label="Terminal output"
        >
          {output.length === 0 ? (
            <p className="text-fg-muted">No output.</p>
          ) : (
            output.map((entry) => (
              <div key={entry.id} className="flex gap-2">
                <span className="shrink-0 text-[10px] uppercase text-fg-muted">
                  {entry.stream === 'diagnostic' ? 'nani' : entry.stream}
                </span>
                <pre
                  className={cx(
                    'whitespace-pre-wrap break-words',
                    entry.stream === 'stderr' && 'text-warn',
                    entry.stream === 'diagnostic' && 'italic text-fg-muted',
                    entry.stream === 'stdout' && 'text-fg',
                  )}
                >
                  {entry.text}
                </pre>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cx(
          'inline-block h-2 w-2 rounded-full',
          tone === 'stdout' && 'bg-fg',
          tone === 'stderr' && 'bg-warn',
          tone === 'diagnostic' && 'bg-fg-muted',
        )}
      />
      {label}
    </span>
  );
}
