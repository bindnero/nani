import { useAppStore } from '../../state/appStore';
import { Badge, Button, EmptyState } from '../../components/ui/primitives';
import { CopyIcon, FolderIcon, RefreshIcon } from '../../components/ui/icons';

/** Project selection: native picker, visible/copyable path, real validation. */
export function ProjectPicker() {
  const projectPath = useAppStore((s) => s.projectPath);
  const validation = useAppStore((s) => s.projectValidation);
  const validating = useAppStore((s) => s.validating);
  const pickProject = useAppStore((s) => s.pickProject);
  const validateProject = useAppStore((s) => s.validateProject);

  const copyPath = () => {
    if (projectPath) void navigator.clipboard.writeText(projectPath);
  };

  if (!projectPath) {
    return (
      <EmptyState
        title="No project selected"
        description="Choose a folder to give Claude Code a working directory. Nani does not scan or upload your files."
        action={
          <Button variant="primary" className="mt-2" onClick={() => void pickProject()}>
            <FolderIcon className="h-4 w-4" />
            Choose folder
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
        <FolderIcon className="h-4 w-4 shrink-0 text-fg-muted" />
        <code className="min-w-0 flex-1 truncate text-xs" title={projectPath}>
          {projectPath}
        </code>
        <Button size="sm" variant="ghost" onClick={copyPath} aria-label="Copy path">
          <CopyIcon className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void validateProject()}>
          <RefreshIcon className="h-3.5 w-3.5" />
          Re-check
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void pickProject()}>
          Change
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {validating && <span className="text-fg-muted">Validating…</span>}
        {!validating && validation?.valid && <Badge tone="success">Directory is valid</Badge>}
        {!validating && validation && !validation.valid && (
          <Badge tone="danger">{validation.message ?? 'Invalid directory'}</Badge>
        )}
      </div>
    </div>
  );
}
