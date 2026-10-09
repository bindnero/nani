import { useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { ProjectPicker } from './ProjectPicker';
import { PromptComposer } from './PromptComposer';
import { SessionOutput } from './SessionOutput';
import { ActivityPanel } from './ActivityPanel';
import { TerminalDrawer } from './TerminalDrawer';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { AlertIcon } from '../../components/ui/icons';

export function WorkspaceScreen() {
  const detection = useAppStore((s) => s.detection);
  const startError = useAppStore((s) => s.startError);
  const [terminalOpen, setTerminalOpen] = useState(false);

  if (detection && !detection.found) {
    return <OnboardingScreen />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-border bg-surface p-3">
            <ProjectPicker />
          </div>
          {startError && (
            <div
              role="alert"
              className="flex items-start gap-2 border-b border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger"
            >
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{startError}</span>
            </div>
          )}
          <div className="min-h-0 flex-1">
            <SessionOutput />
          </div>
          <PromptComposer />
        </div>
        <ActivityPanel />
      </div>
      <TerminalDrawer open={terminalOpen} onToggle={() => setTerminalOpen((v) => !v)} />
    </div>
  );
}
