import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { Button, Badge, cx } from '../../components/ui/primitives';
import {
  FolderIcon,
  FolderOpenIcon,
  CloseIcon,
  CheckIcon,
  AlertIcon,
  RefreshIcon,
} from '../../components/ui/icons';

interface CommonPaths {
  home?: string;
  desktop?: string;
  downloads?: string;
  documents?: string;
  current?: string;
}

export function FolderPickerModal() {
  const isOpen = useAppStore((s) => s.folderModalOpen);
  const closeModal = useAppStore((s) => s.closeFolderModal);
  const setProjectPath = useAppStore((s) => s.setProjectPath);
  const validateProject = useAppStore((s) => s.validateProject);
  const currentPath = useAppStore((s) => s.projectPath);
  const bridge = useAppStore((s) => s.bridge);

  const [inputPath, setInputPath] = useState(currentPath ?? '');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message?: string | null;
  } | null>(null);
  const [commonPaths, setCommonPaths] = useState<CommonPaths>({});
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [isBrowsingNative, setIsBrowsingNative] = useState(false);

  // Load common paths & recents when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setInputPath(currentPath ?? '');
    setValidationResult(null);

    // Fetch recents
    try {
      const recents = JSON.parse(
        localStorage.getItem('nani_recent_projects') || '[]',
      ) as string[];
      setRecentProjects(recents.filter((p) => p && typeof p === 'string'));
    } catch {
      setRecentProjects([]);
    }

    // Fetch system common paths
    void fetch('/api/nani/common-paths')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: CommonPaths | null) => {
        if (data) {
          setCommonPaths(data);
        } else {
          // Fallback common Windows paths
          setCommonPaths({
            current: 'c:\\Nani cot',
            home: 'C:\\Users\\acer',
            desktop: 'C:\\Users\\acer\\Desktop',
            downloads: 'C:\\Users\\acer\\Downloads',
            documents: 'C:\\Users\\acer\\Documents',
          });
        }
      })
      .catch(() => {
        setCommonPaths({
          current: 'c:\\Nani cot',
          home: 'C:\\Users\\acer',
          desktop: 'C:\\Users\\acer\\Desktop',
          downloads: 'C:\\Users\\acer\\Downloads',
        });
      });
  }, [isOpen, currentPath]);

  // Live validation on path change
  useEffect(() => {
    if (!isOpen || !inputPath.trim() || !bridge) {
      setValidationResult(null);
      setIsValidating(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const res = await bridge.validateProject(inputPath.trim());
        setValidationResult({
          valid: res.valid,
          message: res.valid ? 'Valid directory' : (res.message ?? 'Invalid folder'),
        });
      } catch (err) {
        setValidationResult({
          valid: false,
          message: err instanceof Error ? err.message : 'Could not validate folder',
        });
      } finally {
        setIsValidating(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isOpen, inputPath, bridge]);

  if (!isOpen) return null;

  const handleNativeBrowse = async () => {
    if (!bridge) return;
    setIsBrowsingNative(true);
    try {
      const picked = await bridge.pickProjectDirectory();
      if (picked) {
        setInputPath(picked);
        setProjectPath(picked);
        await validateProject(picked);
        closeModal();
      }
    } catch (err) {
      console.warn('Native folder selection failed:', err);
    } finally {
      setIsBrowsingNative(false);
    }
  };

  const handleSelectPath = (path: string) => {
    setInputPath(path);
  };

  const handleConfirm = async () => {
    const trimmed = inputPath.trim();
    if (!trimmed) return;
    setProjectPath(trimmed);
    await validateProject(trimmed);
    closeModal();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && inputPath.trim() && validationResult?.valid) {
      void handleConfirm();
    } else if (e.key === 'Escape') {
      closeModal();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-surface shadow-2xl overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="folder-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <FolderOpenIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 id="folder-modal-title" className="text-sm font-bold text-fg">
                Choose Project Folder
              </h2>
              <p className="text-xs text-fg-muted">
                Give Claude Code a working directory to run inside
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted hover:bg-elevated hover:text-fg transition-colors"
            aria-label="Close"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4 max-h-[75vh] overflow-y-auto">
          {/* Native File Dialog Trigger */}
          <div className="rounded-lg border border-[var(--color-border)] bg-elevated/40 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-fg">Browse with System Dialog</p>
                <p className="text-[11px] text-fg-muted">
                  Open the standard Windows Explorer folder picker window
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleNativeBrowse()}
                disabled={isBrowsingNative}
                className="shrink-0"
              >
                {isBrowsingNative ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <FolderIcon className="h-3.5 w-3.5" />
                )}
                Browse Folder...
              </Button>
            </div>
          </div>

          {/* Manual Input Field */}
          <div>
            <label htmlFor="folder-input" className="block text-xs font-medium text-fg mb-1.5">
              Or enter absolute directory path
            </label>
            <div className="relative flex items-center">
              <input
                id="folder-input"
                type="text"
                value={inputPath}
                onChange={(e) => setInputPath(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. C:\Users\acer\Projects\my-project"
                autoFocus
                className="w-full rounded-lg border border-[var(--color-border)] bg-bg px-3 py-2 text-xs font-mono text-fg placeholder:text-fg-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {inputPath && (
                <button
                  type="button"
                  onClick={() => setInputPath('')}
                  className="absolute right-2 text-fg-muted hover:text-fg p-1"
                  title="Clear input"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Validation Feedback */}
            <div className="mt-2 min-h-5 flex items-center gap-2">
              {isValidating && (
                <span className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                  Validating path...
                </span>
              )}
              {!isValidating && validationResult && (
                <div className="flex items-center gap-1.5">
                  {validationResult.valid ? (
                    <Badge tone="success" dot>
                      <CheckIcon className="h-3 w-3 inline mr-1" />
                      {validationResult.message ?? 'Valid folder'}
                    </Badge>
                  ) : (
                    <Badge tone="danger">
                      <AlertIcon className="h-3 w-3 inline mr-1" />
                      {validationResult.message ?? 'Invalid directory'}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Access Folders */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted mb-2">
              Quick Shortcuts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {commonPaths.current && (
                <button
                  type="button"
                  onClick={() => handleSelectPath(commonPaths.current!)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                    inputPath === commonPaths.current
                      ? 'border-accent bg-accent/15 text-accent font-medium'
                      : 'border-[var(--color-border)] bg-elevated/50 text-fg hover:bg-elevated hover:border-fg-muted/30',
                  )}
                >
                  <span>⚡</span> Current Workspace
                </button>
              )}
              {commonPaths.home && (
                <button
                  type="button"
                  onClick={() => handleSelectPath(commonPaths.home!)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                    inputPath === commonPaths.home
                      ? 'border-accent bg-accent/15 text-accent font-medium'
                      : 'border-[var(--color-border)] bg-elevated/50 text-fg hover:bg-elevated hover:border-fg-muted/30',
                  )}
                >
                  <span>🏠</span> User Home
                </button>
              )}
              {commonPaths.desktop && (
                <button
                  type="button"
                  onClick={() => handleSelectPath(commonPaths.desktop!)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                    inputPath === commonPaths.desktop
                      ? 'border-accent bg-accent/15 text-accent font-medium'
                      : 'border-[var(--color-border)] bg-elevated/50 text-fg hover:bg-elevated hover:border-fg-muted/30',
                  )}
                >
                  <span>💻</span> Desktop
                </button>
              )}
              {commonPaths.downloads && (
                <button
                  type="button"
                  onClick={() => handleSelectPath(commonPaths.downloads!)}
                  className={cx(
                    'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors',
                    inputPath === commonPaths.downloads
                      ? 'border-accent bg-accent/15 text-accent font-medium'
                      : 'border-[var(--color-border)] bg-elevated/50 text-fg hover:bg-elevated hover:border-fg-muted/30',
                  )}
                >
                  <span>📥</span> Downloads
                </button>
              )}
            </div>
          </div>

          {/* Recent Folders */}
          {recentProjects.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted mb-2">
                Recently Opened Projects
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {recentProjects.slice(0, 5).map((recent) => (
                  <button
                    key={recent}
                    type="button"
                    onClick={() => handleSelectPath(recent)}
                    className={cx(
                      'w-full flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors',
                      inputPath === recent
                        ? 'border-accent bg-accent/10 text-accent font-medium'
                        : 'border-transparent bg-elevated/40 text-fg hover:bg-elevated',
                    )}
                  >
                    <span className="truncate font-mono text-[11px]">{recent}</span>
                    <RefreshIcon className="h-3 w-3 shrink-0 text-fg-muted" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] bg-elevated/20 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleConfirm()}
            disabled={!inputPath.trim()}
          >
            <CheckIcon className="h-3.5 w-3.5" />
            Set as Project Folder
          </Button>
        </div>
      </div>
    </div>
  );
}
