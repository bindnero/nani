import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { Button, Field, Input, Panel, Toggle, InfoBanner, cx } from '../../components/ui/primitives';
import { DownloadIcon, CheckIcon } from '../../components/ui/icons';
import type { DiagnosticsBundle, ThemePreference } from '../../lib/types';

const THEMES: Array<{ value: ThemePreference; label: string; desc: string }> = [
  { value: 'dark',   label: '🌙 Dark',   desc: 'Dark UI'   },
  { value: 'light',  label: '☀️ Light',  desc: 'Light UI'  },
  { value: 'system', label: '💻 System', desc: 'Follow OS' },
];

export function PreferencesPanel() {
  const bridge    = useAppStore((s) => s.bridge);
  const theme     = useAppStore((s) => s.theme);
  const setTheme  = useAppStore((s) => s.setTheme);

  const [retention,    setRetention]   = useState(30);
  const [persist,      setPersist]     = useState(true);
  const [saved,        setSaved]       = useState(false);
  const [diagnostics,  setDiagnostics] = useState<DiagnosticsBundle | null>(null);
  const [error,        setError]       = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!bridge) return;
      try {
        const prefs = await bridge.getPreferences();
        if (cancelled) return;
        setTheme(prefs.theme);
        setRetention(prefs.logRetentionDays);
        setPersist(prefs.persistSessions);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  const save = async () => {
    if (!bridge) return;
    setError(null);
    try {
      await bridge.savePreferences({ theme, logRetentionDays: retention, persistSessions: persist });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const exportDiagnostics = async () => {
    if (!bridge) return;
    try {
      setDiagnostics(await bridge.exportDiagnostics());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const cliEngines      = useAppStore((s) => s.cliEngines);
  const activeCliId     = useAppStore((s) => s.activeCliId);
  const setActiveCliId  = useAppStore((s) => s.setActiveCliId);
  const addCliEngine    = useAppStore((s) => s.addCliEngine);
  const removeCliEngine = useAppStore((s) => s.removeCliEngine);
  const verifyCliEngine = useAppStore((s) => s.verifyCliEngine);

  const [showAddCli, setShowAddCli] = useState(false);
  const [newCliName, setNewCliName] = useState('');
  const [newCliCommand, setNewCliCommand] = useState('');
  const [newCliArgs, setNewCliArgs] = useState('');
  const [cliAdding, setCliAdding] = useState(false);
  const [cliAddError, setCliAddError] = useState<string | null>(null);

  const handleAddCli = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCliName.trim() || !newCliCommand.trim()) return;
    setCliAdding(true);
    setCliAddError(null);
    try {
      const args = newCliArgs.trim() ? newCliArgs.trim().split(/\s+/) : [];
      await addCliEngine({
        name: newCliName.trim(),
        command: newCliCommand.trim(),
        args,
      });
      setNewCliName('');
      setNewCliCommand('');
      setNewCliArgs('');
      setShowAddCli(false);
    } catch (err: unknown) {
      setCliAddError(err instanceof Error ? err.message : String(err));
    } finally {
      setCliAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* CLI Engines (Any CLI) */}
      <Panel
        title="CLI Engines (Any CLI)"
        subtitle="Configure Claude Code CLI or connect any external CLI / agent tool."
        actions={
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setShowAddCli(!showAddCli)}
          >
            {showAddCli ? 'Cancel' : '+ Add Any CLI'}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {showAddCli && (
            <form onSubmit={handleAddCli} className="rounded-xl border border-[var(--color-border-focus)] bg-elevated/60 p-4 animate-fade-in flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-fg">Add New CLI Engine</h4>
              <p className="text-[11px] text-fg-muted">
                Add any CLI binary or command on your machine (e.g. Gemini CLI, Aider, custom script, or custom Claude location).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="CLI Name" hint="e.g. Gemini CLI, Aider, Custom Agent">
                  {({ id }) => (
                    <Input
                      id={id}
                      placeholder="My CLI"
                      value={newCliName}
                      onChange={(e) => setNewCliName(e.target.value)}
                      required
                    />
                  )}
                </Field>
                <Field label="Command / Executable" hint="Binary name on PATH or absolute path">
                  {({ id }) => (
                    <Input
                      id={id}
                      placeholder="e.g. gemini, aider, or C:\path\to\tool.exe"
                      value={newCliCommand}
                      onChange={(e) => setNewCliCommand(e.target.value)}
                      required
                    />
                  )}
                </Field>
              </div>
              <Field label="Default Arguments (Optional)" hint="Space-separated arguments passed on launch">
                {({ id }) => (
                  <Input
                    id={id}
                    placeholder="e.g. --stream"
                    value={newCliArgs}
                    onChange={(e) => setNewCliArgs(e.target.value)}
                  />
                )}
              </Field>
              {cliAddError && (
                <p className="text-xs text-danger">{cliAddError}</p>
              )}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button size="xs" variant="ghost" type="button" onClick={() => setShowAddCli(false)}>
                  Cancel
                </Button>
                <Button size="xs" variant="primary" type="submit" disabled={cliAdding}>
                  {cliAdding ? 'Verifying & Adding…' : 'Add Engine'}
                </Button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 gap-2.5">
            {cliEngines.map((engine) => {
              const isActive = activeCliId === engine.id;
              return (
                <div
                  key={engine.id}
                  className={cx(
                    'flex items-center justify-between gap-3 rounded-xl border p-3 transition-all',
                    isActive
                      ? 'border-[var(--color-border-focus)] bg-accent/8 shadow-[var(--shadow-glow)]'
                      : 'border-[var(--color-border)] bg-surface hover:bg-elevated/40',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-fg">{engine.name}</span>
                      {isActive && (
                        <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent">
                          Active
                        </span>
                      )}
                      {engine.status === 'verified' && (
                        <span className="rounded-full bg-success/20 px-1.5 py-0.5 text-[9px] font-medium text-success">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-fg-muted mt-0.5">
                      {engine.command} {engine.args?.join(' ')}
                    </p>
                    {engine.version && (
                      <p className="text-[10px] text-fg-subtle mt-0.5">Version: {engine.version}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => void verifyCliEngine(engine.id)}
                      title="Test executable"
                    >
                      Test
                    </Button>
                    {!isActive ? (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setActiveCliId(engine.id)}
                      >
                        Select
                      </Button>
                    ) : (
                      <span className="text-xs text-accent font-medium px-2">In use</span>
                    )}
                    {!engine.isDefault && (
                      <Button
                        size="xs"
                        variant="danger"
                        onClick={() => removeCliEngine(engine.id)}
                        title="Delete CLI engine"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
      {/* Appearance */}
      <Panel title="Appearance" subtitle="Choose your preferred colour scheme.">
        <fieldset>
          <legend className="sr-only">Theme</legend>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <label
                key={t.value}
                className={cx(
                  'flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-center transition-all duration-150',
                  theme === t.value
                    ? 'border-[var(--color-border-focus)] bg-accent/8 shadow-[var(--shadow-glow)]'
                    : 'border-[var(--color-border)] hover:bg-elevated',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  checked={theme === t.value}
                  onChange={() => setTheme(t.value)}
                />
                <span className="text-base">{t.label.split(' ')[0]}</span>
                <span className={cx('text-xs font-medium', theme === t.value ? 'text-accent' : 'text-fg')}>
                  {t.label.split(' ').slice(1).join(' ')}
                </span>
                <span className="text-[10px] text-fg-muted">{t.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      {/* Local data */}
      <Panel title="Local data" subtitle="Nani never uploads your data anywhere.">
        <div className="flex flex-col gap-5">
          <Toggle
            checked={persist}
            onChange={setPersist}
            label="Keep session transcripts"
            description="Save session output to disk for later review."
          />

          <Field
            label="Log retention (days)"
            hint="Older local session logs are automatically pruned."
          >
            {({ id, ...aria }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={3650}
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
                className="max-w-28"
                {...aria}
              />
            )}
          </Field>

          {/* Save row */}
          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={() => void save()}>
              Save preferences
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-xs text-success animate-fade-in">
                <CheckIcon className="h-3.5 w-3.5" />
                Saved
              </span>
            )}
            {error && (
              <span role="alert" className="text-xs text-danger">
                {error}
              </span>
            )}
          </div>

          <InfoBanner tone="info">
            Nani has no telemetry. Prompts, files, logs, and credentials are never uploaded
            to a Nani-controlled service.
          </InfoBanner>
        </div>
      </Panel>

      {/* Diagnostics */}
      <Panel
        title="Diagnostics"
        subtitle="Redacted bundles for bug reports — nothing is sent automatically."
        actions={
          <Button size="xs" variant="secondary" onClick={() => void exportDiagnostics()}>
            <DownloadIcon className="h-3 w-3" />
            Generate bundle
          </Button>
        }
      >
        {diagnostics ? (
          <pre className="max-h-72 overflow-auto rounded-xl border border-[var(--color-border)] bg-bg p-4 text-xs font-mono leading-relaxed animate-fade-in">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        ) : (
          <p className="text-xs text-fg-muted">
            Click "Generate bundle" to create a redacted diagnostics file.
          </p>
        )}
      </Panel>
    </div>
  );
}
