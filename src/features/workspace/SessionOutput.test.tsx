import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionOutput } from './SessionOutput';
import { useAppStore } from '../../state/appStore';

beforeEach(() => {
  useAppStore.setState({ output: [], sessionState: 'Idle', autoScroll: true });
});

describe('SessionOutput', () => {
  it('renders CLI output as inert text, not executable markup', () => {
    useAppStore.setState({
      output: [
        {
          id: 1,
          stream: 'stdout',
          text: '<img src=x onerror="alert(1)">\n<script>window.__pwned = true</script>\n',
          at: new Date().toISOString(),
        },
      ],
    });

    render(<SessionOutput />);

    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
    // No element was actually created from the injected markup.
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('shows an empty state before any output arrives', () => {
    render(<SessionOutput />);
    expect(screen.getByText('No output yet')).toBeInTheDocument();
  });

  it('exposes the stream as an accessible log region', () => {
    render(<SessionOutput />);
    expect(screen.getByRole('log', { name: 'Session output' })).toBeInTheDocument();
  });
});
