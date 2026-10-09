import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { Button, Field, Input, Panel, Toggle, cx } from '../../components/ui/primitives';
import { DownloadIcon } from '../../components/ui/icons';
import type { DiagnosticsBundle, ThemePreference } from '../../lib/types';

const THEMES: ThemePreference[] = ['dark', 'light', 'system'];

export function PreferencesPanel() {
  const bridge = useAppStore((s) => s.bridge);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const [retention, setRetention] = useState(30);
  const [persist, setPersist] = useState(true);
  const [saved, setSaved] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  const save = async () => {
    if (!bridge) return;
    setError(null);
    try {
      await bridge.savePreferences({
        theme,
        logRetentionDays: retention,
        persistSessions: persist,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <Panel title="Appearance">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-fg-muted">Theme</legend>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <label
                key={t}
                className={cx(
                  'cursor-pointer rounded-md border px-3 py-1.5 text-sm capitalize',
                  theme === t ? 'border-accent bg-elevated text-fg' : 'border-border text-fg-muted',
                )}
              >
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  checked={theme === t}
                  onChange={() => setTheme(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </fieldset>
      </Panel>

      <Panel title="Local data">
        <div className="flex flex-col gap-4">
          <Toggle
            checked={persist}
            onChange={setPersist}
            label="Keep session transcripts on this device"
          />
          <Field label="Log retention (days)" hint="Older local session logs are deleted automatically.">
            {({ id, ...aria }) => (
              <Input
                id={id}
                type="number"
                min={1}
                max={3650}
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value))}
                className="max-w-32"
                {...aria}
              />
            )}
          </Field>
          <p className="text-xs text-fg-muted">
            Nani has no telemetry. Prompts, files, logs and credentials are never uploaded to a
            Nani-controlled service.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => void save()}>
              Save preferences
            </Button>
            {saved && <span className="text-xs text-success">Saved</span>}
            {error && (
              <span role="alert" className="text-xs text-danger">
                {error}
              </span>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Diagnostics"
        actions={
          <Button size="sm" variant="secondary" onClick={() => void exportDiagnostics()}>
            <DownloadIcon className="h-3.5 w-3.5" />
            Generate redacted bundle
          </Button>
        }
      >
        <p className="text-xs text-fg-muted">
          Diagnostics are generated on request and are redacted before they are shown. Nothing is
          sent anywhere automatically.
        </p>
        {diagnostics && (
          <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-border bg-bg p-3 text-xs">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        )}
      </Panel>
    </div>
  );
}
