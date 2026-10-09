import { useAppStore } from '../../state/appStore';
import { Badge, Button, Textarea } from '../../components/ui/primitives';
import { PlayIcon, StopIcon } from '../../components/ui/icons';

/** Multiline prompt composer with explicit send/stop controls (PRD §5.3). */
export function PromptComposer() {
  const draft = useAppStore((s) => s.draftPrompt);
  const setDraft = useAppStore((s) => s.setDraftPrompt);
  const sessionState = useAppStore((s) => s.sessionState);
  const projectPath = useAppStore((s) => s.projectPath);
  const startSession = useAppStore((s) => s.startSession);
  const stopSession = useAppStore((s) => s.stopSession);

  const active =
    sessionState === 'Running' || sessionState === 'Starting' || sessionState === 'Stopping';
  const canSend = Boolean(projectPath) && draft.trim().length > 0 && !active;

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      if (canSend) void startSession();
    }
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border bg-surface p-3">
      <label htmlFor="prompt" className="sr-only">
        Prompt
      </label>
      <Textarea
        id="prompt"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Describe the task for Claude Code…"
        aria-describedby="prompt-hint"
        disabled={sessionState === 'Running' || sessionState === 'Stopping'}
      />
      <div className="flex items-center justify-between gap-3">
        <p id="prompt-hint" className="text-xs text-fg-muted">
          Press <kbd className="rounded border border-border px-1">Ctrl</kbd>+
          <kbd className="rounded border border-border px-1">Enter</kbd> to send.
          {!projectPath && ' Select a project first.'}
        </p>
        <div className="flex items-center gap-2">
          {active ? (
            <Button
              variant="danger"
              onClick={() => void stopSession()}
              loading={sessionState === 'Stopping'}
              disabled={sessionState === 'Stopping'}
            >
              <StopIcon className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void startSession()} disabled={!canSend}>
              <PlayIcon className="h-4 w-4" />
              Send
            </Button>
          )}
          {sessionState === 'Stopping' && <Badge tone="warn">Stopping…</Badge>}
        </div>
      </div>
    </div>
  );
}
