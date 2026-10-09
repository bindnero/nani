import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../../state/appStore';
import { Button, EmptyState, cx } from '../../components/ui/primitives';
import { ArrowDownIcon, CopyIcon, TrashIcon } from '../../components/ui/icons';

/**
 * Live output stream. Content is always rendered as inert text — never as
 * executable markup (architecture §9). Copy/clear/scroll controls per UI spec.
 */
export function SessionOutput() {
  const output = useAppStore((s) => s.output);
  const autoScroll = useAppStore((s) => s.autoScroll);
  const setAutoScroll = useAppStore((s) => s.setAutoScroll);
  const clearOutput = useAppStore((s) => s.clearOutput);
  const sessionState = useAppStore((s) => s.sessionState);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [output, autoScroll]);

  const text = useMemo(
    () => output.map((entry) => entry.text).join(''),
    [output],
  );

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
      /* clipboard may be unavailable; ignore */
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-fg-muted">Output</span>
        <div className="flex items-center gap-1">
          {!autoScroll && (
            <Button size="sm" variant="ghost" onClick={scrollToLatest}>
              <ArrowDownIcon className="h-3.5 w-3.5" />
              Latest
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => void copyAll()} disabled={!text}>
            <CopyIcon className="h-3.5 w-3.5" />
            Copy
          </Button>
          <Button size="sm" variant="ghost" onClick={clearOutput} disabled={!output.length}>
            <TrashIcon className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs"
        role="log"
        aria-label="Session output"
        aria-live={sessionState === 'Running' ? 'polite' : 'off'}
      >
        {output.length === 0 ? (
          <div className="h-full">
            <EmptyState
              title="No output yet"
              description="Choose a project, write a prompt, and start a session. Real CLI output will stream here."
            />
          </div>
        ) : (
          output.map((entry) => (
            <pre
              key={entry.id}
              className={cx(
                'whitespace-pre-wrap break-words',
                entry.stream === 'stderr' && 'text-warn',
                entry.stream === 'diagnostic' && 'text-fg-muted italic',
                entry.stream === 'stdout' && 'text-fg',
              )}
            >
              {entry.text}
            </pre>
          ))
        )}
      </div>
    </div>
  );
}
