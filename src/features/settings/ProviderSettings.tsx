import { useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { Badge, Button, Panel, Toggle, InfoBanner, cx } from '../../components/ui/primitives';
import { ExternalLinkIcon, ShieldIcon, CheckIcon, AlertIcon } from '../../components/ui/icons';
import type { ProviderApplyResult, ProviderConfigPreview, ProviderScope } from '../../lib/types';

const SCOPES: Array<{ id: ProviderScope; label: string; hint: string }> = [
  { id: 'user',    label: 'User',    hint: '~/.claude/settings.json · applies to all projects' },
  { id: 'project', label: 'Project', hint: '.claude/settings.json · shared with repo' },
  { id: 'local',   label: 'Local',   hint: '.claude/settings.local.json · git-ignored' },
];

/**
 * Provider configuration (Phase 4). Every write is previewed, backed up, and
 * requires explicit consent. Cancel leaves the file untouched.
 */
export function ProviderSettings() {
  const bridge      = useAppStore((s) => s.bridge);
  const projectPath = useAppStore((s) => s.projectPath);
  const runAuthCheck = useAppStore((s) => s.runAuthCheck);

  const [scope,   setScope]   = useState<ProviderScope>('user');
  const [preview, setPreview] = useState<ProviderConfigPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [ack,     setAck]     = useState(false);
  const [result,  setResult]  = useState<ProviderApplyResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);

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
    <div className="flex flex-col gap-5">
      <Panel
        title="Provider configuration"
        subtitle="Writes are previewed, backed up, and require your confirmation."
      >
        {/* Scope selector */}
        <fieldset className="mb-5">
          <legend className="mb-3 text-xs font-semibold text-fg-muted">Configuration scope</legend>
          <div className="grid grid-cols-3 gap-2">
            {SCOPES.map((s) => (
              <label
                key={s.id}
                className={cx(
                  'flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 text-xs transition-all duration-150',
                  scope === s.id
                    ? 'border-[var(--color-border-focus)] bg-accent/8 shadow-[var(--shadow-glow)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-focus)]/50 hover:bg-elevated',
                )}
              >
                <input
                  type="radio"
                  name="provider-scope"
                  value={s.id}
                  checked={scope === s.id}
                  onChange={() => { setScope(s.id); reset(); }}
                  className="sr-only"
                />
                <span className={cx('font-semibold capitalize', scope === s.id ? 'text-accent' : 'text-fg')}>
                  {s.label}
                </span>
                <span className="text-[10px] leading-relaxed text-fg-muted">{s.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => void doPreview()} loading={loading}>
            Preview change
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void runAuthCheck()}>
            Test readiness
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void bridge?.openExternal('https://docs.claude.com/en/docs/claude-code/settings')}
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Docs
          </Button>
        </div>

        {/* Error */}
        {error && (
          <InfoBanner icon={<AlertIcon className="h-4 w-4" />} tone="danger" >
            {error}
          </InfoBanner>
        )}

        {/* Success */}
        {result && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-xs text-success animate-fade-in">
            <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{result.message}</p>
              {result.backupPath && (
                <p className="mt-0.5 text-success/70">Backup: {result.backupPath}</p>
              )}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="mt-5 flex flex-col gap-4 animate-fade-in">
            <div className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-bg px-4 py-3 text-xs">
              <span className="text-fg-muted">Target file</span>
              <code className="break-all font-mono text-fg">{preview.targetPath}</code>
              <span className="text-fg-muted">Backup</span>
              <code className="break-all font-mono text-fg">
                {preview.backupPath ?? 'none (new file)'}
              </code>
            </div>

            {preview.warnings.length > 0 && (
              <InfoBanner icon={<AlertIcon className="h-4 w-4" />} tone="warn">
                <ul className="list-disc pl-3 space-y-0.5">
                  {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </InfoBanner>
            )}

            {/* Diff */}
            <div className="rounded-xl border border-[var(--color-border)] bg-bg p-4 font-mono text-xs overflow-auto max-h-64">
              {preview.diff.length === 0 ? (
                <p className="text-fg-muted">No changes.</p>
              ) : (
                preview.diff.map((line, i) => (
                  <div
                    key={i}
                    className={cx(
                      'whitespace-pre-wrap break-words leading-relaxed',
                      line.kind === 'added'   && 'text-success bg-success/5',
                      line.kind === 'removed' && 'text-danger bg-danger/5',
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
              description="This cannot be undone automatically — a backup is created."
            />

            <div className="flex gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void doApply()}
                disabled={!ack}
                loading={loading}
              >
                Apply change
              </Button>
              <Button variant="secondary" size="sm" onClick={reset}>
                Cancel
              </Button>
              {preview.backupPath && (
                <Button variant="ghost" size="sm" onClick={() => void doRollback()}>
                  Restore backup
                </Button>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* Security note */}
      <Panel title="Security">
        <InfoBanner icon={<ShieldIcon className="h-4 w-4 text-accent" />} tone="info">
          Credentials are never written to settings files by Nani and never logged. Secret
          values are masked in the interface and in diagnostic exports.
        </InfoBanner>
      </Panel>

      {/* Omni placeholder */}
      <Panel title="Omni-Company integration">
        <div className="flex items-center gap-3">
          <Badge tone="neutral">Pending</Badge>
          <p className="text-xs text-fg-muted">
            No API, endpoint, or behavior is assumed. Will be assessed after the official
            link or repository is provided.
          </p>
        </div>
      </Panel>
    </div>
  );
}
