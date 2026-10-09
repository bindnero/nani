import { useAppStore } from '../../state/appStore';
import { Badge, Button, cx } from '../../components/ui/primitives';
import {
  FolderIcon,
  CopyIcon,
  RefreshIcon,
  CheckIcon,
  AlertIcon,
} from '../../components/ui/icons';

/** Project picker: native folder dialog, copyable path, live validation badge. */
export function ProjectPicker() {
  const projectPath  = useAppStore((s) => s.projectPath);
  const validation   = useAppStore((s) => s.projectValidation);
  const validating   = useAppStore((s) => s.validating);
  const pickProject  = useAppStore((s) => s.pickProject);
  const validateProject = useAppStore((s) => s.validateProject);

  const copyPath = () => {
    if (projectPath) void navigator.clipboard.writeText(projectPath);
  };

  if (!projectPath) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-elevated text-fg-muted">
          <FolderIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-fg">No project selected</p>
          <p className="text-[10px] text-fg-muted">
            Choose a folder to give Claude Code a working directory.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => void pickProject()}>
          <FolderIcon className="h-3.5 w-3.5" />
          Choose folder
        </Button>
      </div>
    );
  }

  const isValid = !validating && validation?.valid;
  const hasError = !validating && validation && !validation.valid;

  return (
    <div
      className={cx(
        'flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors',
        hasError
          ? 'border-danger/40 bg-danger/5'
          : isValid
          ? 'border-success/30 bg-success/5'
          : 'border-[var(--color-border)] bg-bg',
      )}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {validating && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        )}
        {isValid && <CheckIcon className="h-3.5 w-3.5 text-success" />}
        {hasError && <AlertIcon className="h-3.5 w-3.5 text-danger" />}
        {!validating && !validation && <FolderIcon className="h-3.5 w-3.5 text-fg-muted" />}
      </div>

      {/* Path */}
      <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-fg" title={projectPath}>
        {projectPath}
      </code>

      {/* Validation status text */}
      {isValid && (
        <Badge tone="success" dot>Valid</Badge>
      )}
      {hasError && (
        <Badge tone="danger">{validation.message ?? 'Invalid'}</Badge>
      )}

      {/* Actions */}
      <Button size="xs" variant="ghost" onClick={copyPath} aria-label="Copy path" title="Copy path">
        <CopyIcon className="h-3 w-3" />
      </Button>
      <Button
        size="xs"
        variant="ghost"
        onClick={() => void validateProject()}
        aria-label="Re-validate"
        title="Re-validate directory"
      >
        <RefreshIcon className="h-3 w-3" />
      </Button>
      <Button size="xs" variant="secondary" onClick={() => void pickProject()}>
        Change
      </Button>
    </div>
  );
}
