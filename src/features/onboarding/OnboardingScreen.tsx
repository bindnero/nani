import { useEffect } from 'react';
import { useAppStore } from '../../state/appStore';
import { readinessView } from '../../lib/status';
import { Badge, Button, Panel, Spinner } from '../../components/ui/primitives';
import { AlertIcon, CheckIcon, RefreshIcon, ExternalLinkIcon } from '../../components/ui/icons';

const INSTALL_DOCS = 'https://docs.claude.com/en/docs/claude-code/setup';
const AUTH_DOCS = 'https://docs.claude.com/en/docs/claude-code/settings';

/**
 * Onboarding / diagnostics. Implements the explicit states from the UI spec §4:
 * checking, CLI missing, CLI detected, ready, error — and keeps installation
 * separate from authentication.
 */
export function OnboardingScreen() {
  const detection = useAppStore((s) => s.detection);
  const detecting = useAppStore((s) => s.detecting);
  const detectionError = useAppStore((s) => s.detectionError);
  const auth = useAppStore((s) => s.auth);
  const checkingAuth = useAppStore((s) => s.checkingAuth);
  const runDetection = useAppStore((s) => s.runDetection);
  const runAuthCheck = useAppStore((s) => s.runAuthCheck);
  const openExternal = useAppStore((s) => s.bridge)?.openExternal;

  useEffect(() => {
    if (!detection && !detecting) {
      void runDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readiness = readinessView(detection, auth);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Panel
        title="Claude Code status"
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void runDetection()}
            loading={detecting}
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Check again
          </Button>
        }
      >
        {detecting && (
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <Spinner /> Detecting the Claude Code executable…
          </div>
        )}

        {!detecting && detectionError && (
          <div className="flex items-start gap-2 text-sm text-danger" role="alert">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Detection failed</p>
              <p className="text-fg-muted">{detectionError}</p>
            </div>
          </div>
        )}

        {!detecting && detection && !detection.found && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
              <div>
                <p className="text-sm font-medium">Claude Code was not found</p>
                <p className="text-xs text-fg-muted">
                  {detection.error?.message ??
                    'The executable could not be located using PATH or well-known locations.'}
                </p>
              </div>
            </div>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-fg-muted">
              <li>Install Claude Code using the official instructions.</li>
              <li>Ensure the install directory is on your PATH.</li>
              <li>Return here and choose “Check again”.</li>
            </ol>
            <div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openExternal?.(INSTALL_DOCS)}
                disabled={!openExternal}
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                Official installation guide
              </Button>
            </div>
          </div>
        )}

        {!detecting && detection?.found && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <CheckIcon className="h-4 w-4 text-success" />
              <Badge tone={readiness.badge.tone}>{readiness.badge.label}</Badge>
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-fg-muted">Path</dt>
              <dd className="break-all font-mono text-fg">{detection.path}</dd>
              <dt className="text-fg-muted">Version</dt>
              <dd className="font-mono text-fg">{detection.version ?? 'Not reported'}</dd>
              <dt className="text-fg-muted">Found via</dt>
              <dd className="text-fg">{detection.source}</dd>
              <dt className="text-fg-muted">Checked at</dt>
              <dd className="text-fg">{new Date(detection.checkedAt).toLocaleString()}</dd>
            </dl>

            <div className="rounded-md border border-border bg-bg p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Authentication / provider readiness</p>
                  <p className="text-xs text-fg-muted">{readiness.authDetail}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => void runAuthCheck()}
                  loading={checkingAuth}
                >
                  Test readiness
                </Button>
              </div>
              {auth && (
                <p className="mt-2 text-xs text-fg-muted" aria-live="polite">
                  Last real check: {new Date(auth.checkedAt).toLocaleString()}
                  {auth.exitCode !== null ? ` · exit ${auth.exitCode}` : ''}
                </p>
              )}
              <p className="mt-2 text-xs text-fg-muted">
                Installation and authentication are different.{' '}
                <button
                  type="button"
                  className="underline hover:text-fg"
                  onClick={() => openExternal?.(AUTH_DOCS)}
                >
                  Configure a provider
                </button>
                .
              </p>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
