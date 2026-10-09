import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AppShell } from './components/AppShell';
import { useRoute } from './components/ui/primitives';
import { WorkspaceScreen } from './features/workspace/WorkspaceScreen';
import { SkillsManager } from './features/skills/SkillsManager';
import { ProviderSettings } from './features/settings/ProviderSettings';
import { PreferencesPanel } from './features/settings/PreferencesPanel';
import { useAppStore, applyTheme } from './state/appStore';
import { isTauri, setBridge } from './lib/bridge';
import { TauriBridge } from './lib/tauriBridge';
import { LocalNativeBridge } from './lib/localNativeBridge';
import { SettingsIcon } from './components/ui/icons';

function RoutedContent() {
  const { route } = useRoute();
  switch (route) {
    case 'skills':
      return <SkillsManager />;
    case 'settings':
      return (
        <div className="h-full overflow-auto">
          <div className="mx-auto max-w-4xl px-6 py-6">
            {/* Page header */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-elevated">
                <SettingsIcon className="h-5 w-5 text-fg-muted" />
              </div>
              <div>
                <h1 className="text-base font-bold text-fg">Settings</h1>
                <p className="text-xs text-fg-muted">Configure Claude Code and Nani preferences.</p>
              </div>
            </div>
            <ProviderSettings />
            <div className="mt-5" />
            <PreferencesPanel />
          </div>
        </div>
      );
    case 'workspace':
    default:
      return <WorkspaceScreen />;
  }
}

export default function App() {
  const init = useAppStore((s) => s.init);
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    async function start() {
      const bridge = isTauri() ? new TauriBridge() : new LocalNativeBridge();
      setBridge(bridge);
      await init(bridge);
    }
    void start();
  }, [init]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <AppShell>
        <RoutedContent />
      </AppShell>
    </ErrorBoundary>
  );
}
