import { useAppStore } from '../../state/appStore';
import { Badge, Button, Kbd, cx } from '../../components/ui/primitives';
import { StopIcon, ZapIcon } from '../../components/ui/icons';

/** Multiline prompt composer with send/stop controls (PRD §5.3). */
export function PromptComposer() {
  const draft        = useAppStore((s) => s.draftPrompt);
  const setDraft     = useAppStore((s) => s.setDraftPrompt);
  const sessionState = useAppStore((s) => s.sessionState);
  const projectPath  = useAppStore((s) => s.projectPath);
  const startSession = useAppStore((s) => s.startSession);
  const stopSession  = useAppStore((s) => s.stopSession);

  const active  = sessionState === 'Running' || sessionState === 'Starting' || sessionState === 'Stopping';
  const canSend = Boolean(projectPath) && draft.trim().length > 0 && !active;
  const charCount = draft.length;

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (canSend) void startSession();
    }
    // Escape to stop
    if (event.key === 'Escape' && active) {
      void stopSession();
    }
  };

  return (
    <div className="border-t border-[var(--color-border)] bg-surface">
      {/* Prompt textarea */}
      <div className="relative px-3 pt-3">
        <label htmlFor="prompt" className="sr-only">Prompt</label>
        <textarea
          id="prompt"
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            !projectPath
              ? 'Select a project first…'
              : active
              ? 'Session running — waiting for Claude…'
              : 'Describe the task for Claude Code…'
          }
          aria-describedby="prompt-hint"
          disabled={sessionState === 'Running' || sessionState === 'Stopping'}
          className={cx(
            'w-full resize-none rounded-xl border bg-bg px-4 py-3 font-sans text-sm text-fg',
            'placeholder:text-fg-subtle',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-accent/30',
            'disabled:cursor-not-allowed disabled:opacity-40',
            active
              ? 'border-accent/30 focus:border-accent/50'
              : 'border-[var(--color-border)] focus:border-[var(--color-border-focus)]',
          )}
          style={{ lineHeight: '1.6' }}
        />
        {/* Character count */}
        {charCount > 0 && (
          <span className="absolute bottom-5 right-6 text-[10px] text-fg-subtle tabular-nums">
            {charCount}
          </span>
        )}
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p id="prompt-hint" className="flex items-center gap-1.5 text-[10px] text-fg-subtle">
          <Kbd>Ctrl</Kbd>
          <span>+</span>
          <Kbd>Enter</Kbd>
          <span>to send</span>
          {!projectPath && (
            <span className="ml-1 text-warn">· select a project first</span>
          )}
        </p>

        <div className="flex items-center gap-2">
          {sessionState === 'Stopping' && (
            <Badge tone="warn" dot>Stopping…</Badge>
          )}
          {sessionState === 'Starting' && (
            <Badge tone="accent" dot>Starting…</Badge>
          )}

          {active ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => void stopSession()}
              loading={sessionState === 'Stopping'}
              disabled={sessionState === 'Stopping'}
            >
              <StopIcon className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={() => void startSession()}
              disabled={!canSend}
            >
              <ZapIcon className="h-3.5 w-3.5" />
              Run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
