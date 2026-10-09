import { useEffect } from 'react';
import { useAppStore } from '../../state/appStore';
import { readinessView } from '../../lib/status';
import { Badge, Button, Panel, Spinner, InfoBanner } from '../../components/ui/primitives';
import {
  AlertIcon,
  CheckIcon,
  RefreshIcon,
  ExternalLinkIcon,
  ShieldIcon,
  ZapIcon,
} from '../../components/ui/icons';

const INSTALL_DOCS = 'https://docs.claude.com/en/docs/claude-code/setup';
const AUTH_DOCS    = 'https://docs.claude.com/en/docs/claude-code/settings';

/**
 * Onboarding / diagnostics. Implements explicit states from UI spec §4:
 * checking → CLI missing → CLI detected → ready → error.
 * Installation and authentication are kept visually separate.
 */
export function OnboardingScreen() {
  const detection      = useAppStore((s) => s.detection);
  const detecting      = useAppStore((s) => s.detecting);
  const detectionError = useAppStore((s) => s.detectionError);
  const auth           = useAppStore((s) => s.auth);
  const checkingAuth   = useAppStore((s) => s.checkingAuth);
  const runDetection   = useAppStore((s) => s.runDetection);
  const runAuthCheck   = useAppStore((s) => s.runAuthCheck);
  const openExternal   = useAppStore((s) => s.bridge)?.openExternal;

  useEffect(() => {
    if (!detection && !detecting) {
      void runDetection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readiness = readinessView(detection, auth);

  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-bg p-6">
      <div className="flex w-full max-w-xl flex-col gap-4 animate-fade-in">

        {/* Hero */}
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-0.5 shadow-lg ring-2 ring-white/20"
            style={{ boxShadow: '0 0 20px rgba(91, 156, 246, 0.3), 0 4px 12px rgba(0, 0, 0, 0.5)' }}
          >
            <img
              src="/logo.jpg"
              alt="Nani Logo"
              className="h-full w-full rounded-full object-cover select-none"
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-fg">Setup Claude Code</h1>
            <p className="text-xs text-fg-muted">
              Nani controls Claude Code CLI and custom agent CLI tools locally.
            </p>
          </div>
        </div>

        {/* Status panel */}
        <Panel
          title="CLI Detection"
          actions={
            <Button
              size="xs"
              variant="secondary"
              onClick={() => void runDetection()}
              loading={detecting}
            >
              <RefreshIcon className="h-3 w-3" />
              Check again
            </Button>
          }
        >
          {/* Checking */}
          {detecting && (
            <div className="flex items-center gap-3 text-sm text-fg-muted">
              <Spinner className="h-4 w-4 text-accent" />
              <span>Locating the Claude Code executable…</span>
            </div>
          )}

          {/* Detection error */}
          {!detecting && detectionError && (
            <InfoBanner icon={<AlertIcon className="h-4 w-4" />} tone="danger">
              <span className="font-semibold">Detection failed</span>
              <br />
              <span className="opacity-80">{detectionError}</span>
            </InfoBanner>
          )}

          {/* Not found */}
          {!detecting && detection && !detection.found && (
            <div className="flex flex-col gap-4">
              <InfoBanner icon={<AlertIcon className="h-4 w-4" />} tone="warn">
                <span className="font-semibold">Claude Code was not found</span>
                <br />
                <span className="opacity-80">
                  {detection.error?.message ??
                    'The executable could not be located on PATH or well-known paths.'}
                </span>
              </InfoBanner>

              <div className="rounded-lg border border-[var(--color-border)] bg-bg p-4">
                <p className="mb-2 text-xs font-semibold text-fg">Install steps</p>
                <ol className="flex flex-col gap-1.5 pl-0 text-xs text-fg-muted list-none">
                  {[
                    'Install Claude Code via the official instructions.',
                    'Ensure the install directory is on your PATH.',
                    'Return here and click "Check again".',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-elevated text-[10px] font-bold text-fg-muted">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => openExternal?.(INSTALL_DOCS)}
                disabled={!openExternal}
                className="self-start"
              >
                <ExternalLinkIcon className="h-3.5 w-3.5" />
                Official installation guide
              </Button>
            </div>
          )}

          {/* Found */}
          {!detecting && detection?.found && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-success" />
                <span className="text-sm font-semibold text-fg">Claude Code detected</span>
                <Badge tone={readiness.badge.tone}>{readiness.badge.label}</Badge>
              </div>

              {/* Details grid */}
              <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-bg p-4 text-xs">
                <dt className="text-fg-muted">Path</dt>
                <dd className="break-all font-mono text-fg">{detection.path}</dd>
                <dt className="text-fg-muted">Version</dt>
                <dd className="font-mono text-fg">{detection.version ?? 'Not reported'}</dd>
                <dt className="text-fg-muted">Found via</dt>
                <dd className="text-fg">{detection.source}</dd>
                <dt className="text-fg-muted">Checked at</dt>
                <dd className="text-fg">{new Date(detection.checkedAt).toLocaleString()}</dd>
              </dl>
            </div>
          )}
        </Panel>

        {/* Auth panel — only when CLI found */}
        {detection?.found && (
          <Panel
            title="Authentication"
            actions={
              <Button
                size="xs"
                variant="secondary"
                onClick={() => void runAuthCheck()}
                loading={checkingAuth}
              >
                <ZapIcon className="h-3 w-3" />
                Test readiness
              </Button>
            }
          >
            <div className="flex flex-col gap-3">
              <p className="text-xs text-fg-muted leading-relaxed">
                {readiness.authDetail}
              </p>

              {auth && (
                <div className="rounded-lg bg-bg px-4 py-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-fg-muted">Last checked</span>
                    <span className="tabular-nums text-fg">
                      {new Date(auth.checkedAt).toLocaleString()}
                      {auth.exitCode !== null ? ` · exit ${auth.exitCode}` : ''}
                    </span>
                  </div>
                </div>
              )}

              <InfoBanner icon={<ShieldIcon className="h-3.5 w-3.5" />} tone="info">
                Installation and authentication are separate.{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-fg transition-colors"
                  onClick={() => openExternal?.(AUTH_DOCS)}
                >
                  Configure a provider
                </button>{' '}
                if authentication fails.
              </InfoBanner>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
