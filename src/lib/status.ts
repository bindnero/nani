import type { BadgeTone } from '../components/ui/primitives';
import type { AuthStatus, DetectionResult, SessionState, UsageInfo } from './types';

export interface StatusView {
  label: string;
  tone: BadgeTone;
  description: string;
}

export function sessionStateView(state: SessionState): StatusView {
  switch (state) {
    case 'Idle':
      return { label: 'Idle', tone: 'neutral', description: 'No session is running.' };
    case 'Starting':
      return { label: 'Starting', tone: 'info', description: 'Launching Claude Code…' };
    case 'Running':
      return { label: 'Running', tone: 'info', description: 'A session is running.' };
    case 'Stopping':
      return { label: 'Stopping', tone: 'warn', description: 'Stop requested; waiting for exit.' };
    case 'Completed':
      return { label: 'Completed', tone: 'success', description: 'Session exited with success.' };
    case 'Failed':
      return { label: 'Failed', tone: 'danger', description: 'Session ended with an error.' };
  }
}

/**
 * Readiness is deliberately two-part: installation and authentication are not
 * the same thing (PRD §5.1). This returns a single honest headline plus the
 * nuance so the UI never conflates them.
 */
export function readinessView(
  detection: DetectionResult | null,
  auth: AuthStatus | null,
): { badge: StatusView; authDetail: string } {
  if (!detection) {
    return {
      badge: { label: 'CLI not checked', tone: 'neutral', description: 'Detection has not run.' },
      authDetail: 'Authentication not checked',
    };
  }
  if (!detection.found) {
    return {
      badge: { label: 'CLI missing', tone: 'danger', description: 'Claude Code was not found.' },
      authDetail: 'Not applicable — CLI not installed',
    };
  }
  const installed = `CLI v${detection.version ?? 'unknown'}`;
  if (!auth) {
    return {
      badge: { label: installed, tone: 'info', description: 'Installed; auth not checked.' },
      authDetail: 'Authentication not checked',
    };
  }
  if (auth.state === 'ready') {
    return {
      badge: {
        label: installed,
        tone: 'success',
        description: `Installed and authenticated via ${auth.method ?? 'unknown method'}.`,
      },
      authDetail: `Authenticated (${auth.method ?? 'unknown'})`,
    };
  }
  if (auth.state === 'not_ready') {
    return {
      badge: {
        label: `${installed} · not authenticated`,
        tone: 'warn',
        description: 'Installed, but no working credentials were found.',
      },
      authDetail: 'Not authenticated',
    };
  }
  return {
    badge: { label: installed, tone: 'info', description: 'Installed; auth state unknown.' },
    authDetail: auth.error?.message ?? 'Authentication unknown',
  };
}

export function formatCost(usage: UsageInfo): string {
  if (!usage.provided || usage.costUsd === null) return 'Not provided';
  return `$${usage.costUsd.toFixed(4)} (estimated)`;
}

export function formatTokens(value: number | null): string {
  if (value === null) return '—';
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
