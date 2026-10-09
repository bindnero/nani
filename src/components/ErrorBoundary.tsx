import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui/primitives';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Top-level error boundary. Keeps a crash from blanking the window and offers a
 * real recovery action instead of a fabricated "success" state.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Local, non-secret diagnostics. No telemetry, no upload.
    console.error('Nani crashed:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-lg border border-danger/40 bg-surface p-6">
          <h1 className="text-base font-semibold text-fg">Something went wrong</h1>
          <p className="mt-2 text-sm text-fg-muted">
            The interface hit an unexpected error. Your settings and session logs were not
            modified.
          </p>
          <pre className="mt-3 max-h-40 overflow-auto rounded-md border border-border bg-bg p-3 text-xs text-danger">
            {error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <Button variant="primary" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button onClick={() => window.location.reload()}>Reload window</Button>
          </div>
        </div>
      </div>
    );
  }
}
