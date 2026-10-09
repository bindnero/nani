import { useAppStore } from '../../state/appStore';
import { Button, cx } from '../../components/ui/primitives';
import { TerminalIcon, TrashIcon, ChevronDownIcon } from '../../components/ui/icons';

/**
 * Bottom drawer terminal. Keeps stdout, stderr and Nani diagnostics
 * visually distinct (PRD §5.4, architecture §6).
 */
export function TerminalDrawer({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const output      = useAppStore((s) => s.output);
  const clearOutput = useAppStore((s) => s.clearOutput);

  return (
    <div
      className={cx(
        'border-t border-[var(--color-border)] bg-surface transition-all duration-200',
        open ? '' : '',
      )}
    >
      {/* Toggle bar */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls="terminal-panel"
          className="flex items-center gap-2 text-xs font-medium text-fg-muted transition-colors hover:text-fg"
        >
          <TerminalIcon className="h-3.5 w-3.5" />
          <span>Terminal</span>
          <ChevronDownIcon
            className={cx(
              'h-3 w-3 transition-transform duration-200',
              open ? '' : '-rotate-90',
            )}
          />
        </button>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <span className="flex items-center gap-3 text-[10px] text-fg-subtle">
            <Legend tone="stdout"     label="stdout" />
            <Legend tone="stderr"     label="stderr" />
            <Legend tone="diagnostic" label="nani"   />
          </span>

          {/* Line count */}
          {output.length > 0 && (
            <span className="text-[10px] tabular-nums text-fg-subtle">
              {output.length} lines
            </span>
          )}

          <Button size="xs" variant="ghost" onClick={clearOutput} disabled={!output.length}>
            <TrashIcon className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>

      {/* Content */}
      {open && (
        <div
          id="terminal-panel"
          className="animate-slide-up h-44 overflow-auto border-t border-[var(--color-border)] bg-bg p-3 font-mono text-xs"
          role="log"
          aria-label="Terminal output"
          style={{ fontSize: '11.5px', lineHeight: '1.7' }}
        >
          {output.length === 0 ? (
            <p className="text-fg-subtle">No output.</p>
          ) : (
            output.map((entry) => (
              <div key={entry.id} className="flex gap-2">
                <span
                  className={cx(
                    'shrink-0 w-14 text-right text-[9px] uppercase tracking-wider opacity-50',
                    entry.stream === 'stderr'     && 'text-warn',
                    entry.stream === 'diagnostic' && 'text-fg-muted',
                    entry.stream === 'stdout'     && 'text-fg-muted',
                  )}
                >
                  {entry.stream === 'diagnostic' ? 'nani' : entry.stream}
                </span>
                <pre
                  className={cx(
                    'min-w-0 flex-1 whitespace-pre-wrap break-words',
                    entry.stream === 'stderr'     && 'text-warn',
                    entry.stream === 'diagnostic' && 'italic text-fg-muted',
                    entry.stream === 'stdout'     && 'text-fg',
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
          'inline-block h-1.5 w-1.5 rounded-full',
          tone === 'stdout'     && 'bg-fg',
          tone === 'stderr'     && 'bg-warn',
          tone === 'diagnostic' && 'bg-fg-muted',
        )}
      />
      {label}
    </span>
  );
}
