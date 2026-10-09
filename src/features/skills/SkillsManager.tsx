import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/appStore';
import { Badge, Button, EmptyState, Input, Panel } from '../../components/ui/primitives';
import { AlertIcon, DownloadIcon, ShieldIcon, TrashIcon } from '../../components/ui/icons';
import type { SkillDetail, SkillImportPreview } from '../../lib/types';

/**
 * Skills manager (Phase 5). Lists and inspects skills, previews imports and
 * removes them with confirmation. Imported scripts are never executed — this is
 * surfaced explicitly to the user.
 */
export function SkillsManager() {
  const bridge = useAppStore((s) => s.bridge);
  const skills = useAppStore((s) => s.skills);
  const loadSkills = useAppStore((s) => s.loadSkills);
  const removeSkill = useAppStore((s) => s.removeSkill);

  const [selected, setSelected] = useState<SkillDetail | null>(null);
  const [source, setSource] = useState('');
  const [preview, setPreview] = useState<SkillImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inspect = async (path: string) => {
    if (!bridge) return;
    try {
      setSelected(await bridge.getSkillDetail(path));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doPreview = async () => {
    if (!bridge || !source.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await bridge.previewSkillImport(source.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    if (!bridge || !preview) return;
    setBusy(true);
    try {
      await bridge.importSkill(preview.source);
      setPreview(null);
      setSource('');
      await loadSkills();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async (path: string) => {
    setBusy(true);
    try {
      await removeSkill(path);
      setConfirmRemove(null);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
      <Panel
        title="Skills"
        actions={
          <Button size="sm" variant="secondary" onClick={() => void loadSkills()}>
            Refresh
          </Button>
        }
      >
        {skills.length === 0 ? (
          <EmptyState
            title="No skills found"
            description="Skills live in ~/.claude/skills and .claude/skills. Import one to see it listed here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {skills.map((skill) => (
              <li
                key={skill.path}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{skill.name}</span>
                    <Badge tone={skill.valid ? 'success' : 'warn'}>
                      {skill.valid ? 'Valid' : 'Warnings'}
                    </Badge>
                    <Badge tone="neutral">{skill.source}</Badge>
                    {skill.containsScripts && <Badge tone="warn">Contains scripts</Badge>}
                  </div>
                  <p className="truncate text-xs text-fg-muted" title={skill.path}>
                    {skill.description ?? skill.path}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="ghost" onClick={() => void inspect(skill.path)}>
                    Details
                  </Button>
                  {confirmRemove === skill.path ? (
                    <>
                      <Button size="sm" variant="danger" onClick={() => void doRemove(skill.path)} loading={busy}>
                        Confirm remove
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${skill.name}`}
                      onClick={() => setConfirmRemove(skill.path)}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Import a skill">
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor="skill-source" className="mb-1 block text-xs font-medium text-fg-muted">
                Source directory or archive
              </label>
              <Input
                id="skill-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="C:\path\to\my-skill"
              />
            </div>
            <Button variant="secondary" onClick={() => void doPreview()} loading={busy} disabled={!source.trim()}>
              Preview
            </Button>
          </div>

          {preview && (
            <div className="rounded-md border border-border bg-bg p-3 text-xs">
              <div className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
                <span className="text-fg-muted">Target</span>
                <code className="break-all">{preview.targetPath}</code>
                <span className="text-fg-muted">Files</span>
                <span>{preview.files.join(', ') || 'none'}</span>
                <span className="text-fg-muted">Overwrites</span>
                <span>{preview.overwrites ? 'Yes — will replace existing skill' : 'No'}</span>
              </div>
              {preview.warnings.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-warn">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" onClick={() => void doImport()} loading={busy}>
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Import
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>

      {selected && (
        <Panel title={`Skill: ${selected.name}`} actions={<Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Close</Button>}>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-fg-muted">Path</dt>
            <dd className="break-all font-mono">{selected.path}</dd>
            <dt className="text-fg-muted">Source</dt>
            <dd>{selected.source}</dd>
            <dt className="text-fg-muted">Files</dt>
            <dd>{selected.files.join(', ')}</dd>
          </dl>
          <p className="mt-3 text-xs text-fg-muted">Frontmatter</p>
          <pre className="mt-1 overflow-auto rounded-md border border-border bg-bg p-3 text-xs">
            {JSON.stringify(selected.frontmatter, null, 2)}
          </pre>
        </Panel>
      )}

      <Panel title="Safety">
        <div className="flex items-start gap-2 text-xs text-fg-muted">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <p>
            Importing a skill never executes its scripts or hooks. Nani rejects unsafe paths and
            asks before overwriting or deleting anything.
          </p>
        </div>
      </Panel>

      {error && (
        <div role="alert" className="flex items-center gap-2 text-xs text-danger">
          <AlertIcon className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
