import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../state/appStore';
import { Button, cx } from '../../components/ui/primitives';
import { ArrowDownIcon, CopyIcon, TrashIcon, LogIcon } from '../../components/ui/icons';

/**
 * Live output stream. Content rendered as inert text only — never as executable
 * markup (architecture §9). Copy/clear/scroll-to-latest controls.
 */
export function SessionOutput() {
  const output       = useAppStore((s) => s.output);
  const autoScroll   = useAppStore((s) => s.autoScroll);
  const setAutoScroll = useAppStore((s) => s.setAutoScroll);
  const clearOutput  = useAppStore((s) => s.clearOutput);
  const sessionState = useAppStore((s) => s.sessionState);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [output, autoScroll]);

  const text = useMemo(() => output.map((e) => e.text).join(''), [output]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (!nearBottom && autoScroll) setAutoScroll(false);
  };

  const scrollToLatest = () => {
    setAutoScroll(true);
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be unavailable */
    }
  };

  const isRunning = sessionState === 'Running';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-surface px-3 py-1.5">
        <div className="flex items-center gap-2">
          <LogIcon className="h-3.5 w-3.5 text-fg-muted" />
          <span className="text-xs font-semibold text-fg-muted">Output</span>
          {output.length > 0 && (
            <span className="rounded-full bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
              {output.length} lines
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-accent">
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-accent" />
              live
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!autoScroll && (
            <Button size="xs" variant="ghost" onClick={scrollToLatest}>
              <ArrowDownIcon className="h-3 w-3" />
              Latest
            </Button>
          )}
          <Button size="xs" variant="ghost" onClick={() => void copyAll()} disabled={!text}>
            <CopyIcon className="h-3 w-3" />
            Copy
          </Button>
          <Button size="xs" variant="ghost" onClick={clearOutput} disabled={!output.length}>
            <TrashIcon className="h-3 w-3" />
            Clear
          </Button>
        </div>
      </div>

      {/* Output area */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto bg-bg p-4 font-mono text-xs"
        role="log"
        aria-label="Session output"
        aria-live={isRunning ? 'polite' : 'off'}
        style={{ fontSize: '12px', lineHeight: '1.7' }}
      >
        {output.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex max-w-sm flex-col items-center text-center animate-fade-in">
              <div
                className="mb-3.5 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 shadow-lg ring-2 ring-white/20 transition-all duration-300 hover:scale-105"
                style={{ boxShadow: '0 0 24px rgba(91, 156, 246, 0.25), 0 4px 12px rgba(0, 0, 0, 0.4)' }}
              >
                <img
                  src="/logo.jpg"
                  alt="Nani"
                  className="h-full w-full rounded-full object-cover select-none"
                />
              </div>
              <h3 className="text-sm font-semibold text-fg">No output yet</h3>
              <p className="mt-1.5 text-xs text-fg-muted leading-relaxed">
                Choose a project folder, write a prompt, and start a session. Real CLI output will stream here.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-0">
            {output.map((entry) => (
              <pre
                key={entry.id}
                className={cx(
                  'whitespace-pre-wrap break-words',
                  entry.stream === 'stderr'     && 'text-warn',
                  entry.stream === 'diagnostic' && 'text-fg-subtle italic',
                  entry.stream === 'stdout'     && 'text-fg',
                )}
              >
                {entry.text}
              </pre>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
