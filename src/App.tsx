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
import { MockBridge } from './lib/mockBridge';

function RoutedContent() {
  const { route } = useRoute();
  switch (route) {
    case 'skills':
      return <SkillsManager />;
    case 'settings':
      return (
        <div className="h-full overflow-auto">
          <ProviderSettings />
          <PreferencesPanel />
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
    const bridge = isTauri() ? new TauriBridge() : new MockBridge();
    setBridge(bridge);
    void init(bridge);
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
