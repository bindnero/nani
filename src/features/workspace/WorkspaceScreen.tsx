import { useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { ProjectPicker }  from './ProjectPicker';
import { PromptComposer } from './PromptComposer';
import { SessionOutput }  from './SessionOutput';
import { ActivityPanel }  from './ActivityPanel';
import { TerminalDrawer } from './TerminalDrawer';
import { OnboardingScreen } from '../onboarding/OnboardingScreen';
import { AlertIcon } from '../../components/ui/icons';

export function WorkspaceScreen() {
  const detection  = useAppStore((s) => s.detection);
  const startError = useAppStore((s) => s.startError);
  const [terminalOpen, setTerminalOpen] = useState(false);

  if (detection && !detection.found) {
    return <OnboardingScreen />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Main split: output + activity */}
      <div className="flex min-h-0 flex-1">
        {/* Left: project picker + output + composer */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Project bar */}
          <div className="border-b border-[var(--color-border)] bg-surface px-3 py-2">
            <ProjectPicker />
          </div>

          {/* Error banner */}
          {startError && (
            <div
              role="alert"
              className="flex items-start gap-2 border-b border-danger/20 bg-danger/8 px-4 py-2.5 text-xs text-danger animate-fade-in"
            >
              <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="leading-relaxed">{startError}</span>
            </div>
          )}

          {/* Output */}
          <div className="min-h-0 flex-1">
            <SessionOutput />
          </div>

          {/* Prompt composer */}
          <PromptComposer />
        </div>

        {/* Right: activity panel */}
        <ActivityPanel />
      </div>

      {/* Terminal drawer */}
      <TerminalDrawer open={terminalOpen} onToggle={() => setTerminalOpen((v) => !v)} />
    </div>
  );
}
