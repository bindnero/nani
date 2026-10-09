import { useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { Badge, Button, Panel, Toggle, cx } from '../../components/ui/primitives';
import { ExternalLinkIcon, ShieldIcon } from '../../components/ui/icons';
import type { ProviderApplyResult, ProviderConfigPreview, ProviderScope } from '../../lib/types';

const SCOPES: Array<{ id: ProviderScope; label: string; hint: string }> = [
  { id: 'user', label: 'User', hint: 'Applies to all projects (~/.claude/settings.json)' },
  { id: 'project', label: 'Project', hint: 'Shared with the repo (.claude/settings.json)' },
  { id: 'local', label: 'Local', hint: 'Project-local, git-ignored (.claude/settings.local.json)' },
];

/**
 * Provider configuration (Phase 4). Every write is previewed, backed up, and
 * requires explicit consent. Cancel leaves the file untouched. Secrets are never
 * written to a settings file from here.
 */
export function ProviderSettings() {
  const bridge = useAppStore((s) => s.bridge);
  const projectPath = useAppStore((s) => s.projectPath);
  const runAuthCheck = useAppStore((s) => s.runAuthCheck);

  const [scope, setScope] = useState<ProviderScope>('user');
  const [preview, setPreview] = useState<ProviderConfigPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<ProviderApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPreview(null);
    setAck(false);
    setResult(null);
    setError(null);
  };

  const doPreview = async () => {
    if (!bridge) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAck(false);
    try {
      setPreview(await bridge.previewProviderConfig(scope, projectPath));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const doApply = async () => {
    if (!bridge || !preview || !ack) return;
    setLoading(true);
    setError(null);
    try {
      const applied = await bridge.applyProviderConfig({
        scope: preview.scope,
        targetPath: preview.targetPath,
        contents: preview.after,
        acknowledgedBackupPath: preview.backupPath,
      });
      setResult(applied);
      setPreview(null);
      setAck(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const doRollback = async () => {
    if (!bridge || !preview?.backupPath) return;
    setLoading(true);
    try {
      const applied = await bridge.applyProviderConfig({
        scope: preview.scope,
        targetPath: preview.targetPath,
        contents: preview.before,
        acknowledgedBackupPath: null,
      });
      setResult(applied);
      setPreview(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Panel title="Provider configuration">
        <p className="mb-3 text-xs text-fg-muted">
          Nani only edits documented Claude Code settings after showing you an exact diff,
          writing a backup, and getting your confirmation. Nothing is written silently.
        </p>

        <fieldset className="mb-4">
          <legend className="mb-2 text-xs font-medium text-fg-muted">Configuration scope</legend>
          <div className="flex flex-col gap-2">
            {SCOPES.map((s) => (
              <label
                key={s.id}
                className={cx(
                  'flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm',
                  scope === s.id ? 'border-accent bg-elevated' : 'border-border',
                )}
              >
                <input
                  type="radio"
                  name="provider-scope"
                  value={s.id}
                  checked={scope === s.id}
                  onChange={() => {
                    setScope(s.id);
                    reset();
                  }}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium text-fg">{s.label}</span>
                  <span className="block text-xs text-fg-muted">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => void doPreview()} loading={loading}>
            Preview change
          </Button>
          <Button variant="secondary" onClick={() => void runAuthCheck()}>
            Test readiness
          </Button>
          <Button
            variant="secondary"
            onClick={() => void bridge?.openExternal('https://docs.claude.com/en/docs/claude-code/settings')}
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Settings reference
          </Button>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-3 rounded-md border border-success/40 bg-success/10 p-3 text-xs">
            <p className="font-medium text-success">{result.message}</p>
            {result.backupPath && (
              <p className="mt-1 text-fg-muted">Backup written to: {result.backupPath}</p>
            )}
          </div>
        )}

        {preview && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1 text-xs">
              <span className="text-fg-muted">Target file</span>
              <code className="break-all">{preview.targetPath}</code>
              <span className="text-fg-muted">Backup</span>
              <code className="break-all">{preview.backupPath ?? 'none (file does not exist yet)'}</code>
            </div>

            {preview.warnings.length > 0 && (
              <ul className="list-disc space-y-1 rounded-md border border-warn/40 bg-warn/10 p-3 pl-6 text-xs text-warn">
                {preview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <div className="rounded-md border border-border bg-bg p-2 font-mono text-xs">
              {preview.diff.length === 0 ? (
                <p className="text-fg-muted">No changes.</p>
              ) : (
                preview.diff.map((line, i) => (
                  <div
                    key={i}
                    className={cx(
                      'whitespace-pre-wrap break-words',
                      line.kind === 'added' && 'text-success',
                      line.kind === 'removed' && 'text-danger',
                      line.kind === 'context' && 'text-fg-muted',
                    )}
                  >
                    {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  '}
                    {line.text}
                  </div>
                ))
              )}
            </div>

            <Toggle
              checked={ack}
              onChange={setAck}
              label="I have reviewed this diff and consent to writing this file"
            />

            <div className="flex gap-2">
              <Button variant="primary" onClick={() => void doApply()} disabled={!ack} loading={loading}>
                Apply change
              </Button>
              <Button variant="secondary" onClick={reset}>
                Cancel
              </Button>
              {preview.backupPath && (
                <Button variant="ghost" onClick={() => void doRollback()}>
                  Restore previous contents
                </Button>
              )}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Security">
        <div className="flex items-start gap-2 text-xs text-fg-muted">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>
            Credentials are never written to settings files by Nani and never logged. Secret
            values are masked in the interface and in diagnostic exports.
          </p>
        </div>
      </Panel>

      <Panel title="Omni-Company integration">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">Integration pending details</Badge>
          <p className="text-xs text-fg-muted">
            No API, endpoint, or behavior is assumed. This will be assessed only after the
            official link or repository is provided.
          </p>
        </div>
      </Panel>
    </div>
  );
}
