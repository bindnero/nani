import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/appStore';
import {
  Badge,
  Button,
  EmptyState,
  InfoBanner,
  Input,
  Panel,
} from '../../components/ui/primitives';
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  DownloadIcon,
  FolderIcon,
  PlusIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
  SparklesIcon,
  TrashIcon,
} from '../../components/ui/icons';
import type { SkillDetail, SkillImportPreview } from '../../lib/types';

/**
 * Skills manager (Phase 5).
 * Lists and inspects skills, supports batch import, folder browsing,
 * previews with validation warnings, and safe removal with confirmation.
 * Imported scripts are NEVER executed — this is surfaced explicitly to the user.
 */
export function SkillsManager() {
  const bridge      = useAppStore((s) => s.bridge);
  const skills      = useAppStore((s) => s.skills);
  const loadSkills  = useAppStore((s) => s.loadSkills);
  const removeSkill = useAppStore((s) => s.removeSkill);

  const [selected,         setSelected]         = useState<SkillDetail | null>(null);
  const [sourcesText,      setSourcesText]       = useState('');
  const [showInstallPanel, setShowInstallPanel]  = useState(false);
  const [previews,         setPreviews]          = useState<SkillImportPreview[]>([]);
  const [error,            setError]             = useState<string | null>(null);
  const [successMsg,       setSuccessMsg]        = useState<string | null>(null);
  const [busy,             setBusy]              = useState(false);
  const [confirmRemove,    setConfirmRemove]     = useState<string | null>(null);
  const [searchQuery,      setSearchQuery]       = useState('');

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

  const handleBrowseFolder = async () => {
    if (!bridge) return;
    try {
      const picked = await bridge.pickProjectDirectory();
      if (picked) {
        setSourcesText((prev) => (prev.trim() ? `${prev.trim()}\n${picked}` : picked));
        await doPreviewPath(picked);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doPreviewPath = async (singlePath?: string) => {
    if (!bridge) return;
    const pathsToPreview = singlePath
      ? [singlePath]
      : sourcesText.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (pathsToPreview.length === 0) return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const results: SkillImportPreview[] = [];
      for (const p of pathsToPreview) {
        results.push(await bridge.previewSkillImport(p));
      }
      setPreviews(results);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doImportAll = async () => {
    if (!bridge || previews.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let n = 0;
      for (const p of previews) {
        await bridge.importSkill(p.source);
        n++;
      }
      setSuccessMsg(`Successfully installed ${n} skill${n > 1 ? 's' : ''}!`);
      setPreviews([]);
      setSourcesText('');
      setShowInstallPanel(false);
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
      setSuccessMsg('Skill removed successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const filteredSkills = skills.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q) ||
      s.source.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-6">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <SparklesIcon className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="text-base font-bold text-fg">Claude Code Skills</h1>
              <p className="text-xs text-fg-muted">
                Manage custom instructions, workflows, and tools.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void loadSkills()}>
              <RefreshIcon className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                setShowInstallPanel((p) => !p);
                setError(null);
                setSuccessMsg(null);
              }}
            >
              {showInstallPanel
                ? <CloseIcon className="h-3.5 w-3.5" />
                : <PlusIcon className="h-3.5 w-3.5" />}
              {showInstallPanel ? 'Cancel' : 'Install Skill'}
            </Button>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-xs text-success animate-fade-in">
            <CheckIcon className="h-4 w-4 shrink-0" />
            {successMsg}
          </div>
        )}
        {error && (
          <InfoBanner icon={<AlertIcon className="h-4 w-4" />} tone="danger">
            {error}
          </InfoBanner>
        )}

        {/* Install panel */}
        {showInstallPanel && (
          <Panel title="Install Skills" className="animate-fade-in">
            <div className="flex flex-col gap-4">
              <InfoBanner icon={<ShieldIcon className="h-4 w-4 text-accent" />} tone="info">
                <span className="font-semibold">Zero-Execution Guarantee — </span>
                Skills are imported as metadata and files only. Nani never executes scripts
                or hooks during import or inspection.
              </InfoBanner>

              <div className="flex flex-col gap-2">
                <label htmlFor="skill-source-input" className="text-xs font-medium text-fg">
                  Skill directory paths <span className="text-fg-muted">(one per line)</span>
                </label>
                <div className="flex gap-2">
                  <textarea
                    id="skill-source-input"
                    rows={2}
                    value={sourcesText}
                    onChange={(e) => setSourcesText(e.target.value)}
                    placeholder={'C:\\Users\\...\\my-skill\nC:\\skills\\skill-b'}
                    className="flex-1 rounded-xl border border-[var(--color-border)] bg-bg px-3 py-2.5 font-mono text-xs text-fg placeholder:text-fg-subtle focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
                  />
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleBrowseFolder()}
                    >
                      <FolderIcon className="h-3.5 w-3.5" />
                      Browse…
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void doPreviewPath()}
                      loading={busy}
                      disabled={!sourcesText.trim()}
                    >
                      Preview
                    </Button>
                  </div>
                </div>
              </div>

              {/* Preview results */}
              {previews.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-bg p-4 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-fg">
                      Ready to install ({previews.length})
                    </span>
                    <Button size="sm" variant="primary" onClick={() => void doImportAll()} loading={busy}>
                      <DownloadIcon className="h-3.5 w-3.5" />
                      Install {previews.length > 1 ? `All ${previews.length}` : '1'} Skill{previews.length > 1 ? 's' : ''}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {previews.map((prev, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-[var(--color-border)] bg-surface p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <code className="font-mono text-[11px] text-accent break-all">{prev.source}</code>
                          {prev.overwrites && <Badge tone="warn">Overwrites</Badge>}
                        </div>
                        <div className="mt-2 grid grid-cols-[5rem_1fr] gap-x-3 gap-y-1 text-[11px]">
                          <span className="text-fg-muted">Target:</span>
                          <code className="break-all font-mono text-fg">{prev.targetPath}</code>
                          <span className="text-fg-muted">Files:</span>
                          <span className="text-fg">{prev.files.join(', ') || 'None'}</span>
                        </div>
                        {prev.warnings.length > 0 && (
                          <ul className="mt-1.5 list-disc pl-4 text-[11px] text-warn space-y-0.5">
                            {prev.warnings.map((w, wIdx) => <li key={wIdx}>{w}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>
        )}

        {/* Installed skills */}
        <Panel
          title={`Installed Skills`}
          actions={
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{skills.length}</Badge>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search…"
                  className="h-7 w-40 pl-8 text-xs"
                />
              </div>
            </div>
          }
        >
          {skills.length === 0 ? (
            <EmptyState
              icon={<SparklesIcon className="h-5 w-5" />}
              title="No skills installed"
              description="Skills live in ~/.claude/skills (user) or .claude/skills (project). Click '+ Install Skill' to import one."
              action={
                <Button size="sm" variant="primary" onClick={() => setShowInstallPanel(true)}>
                  <PlusIcon className="h-3.5 w-3.5" />
                  Install your first skill
                </Button>
              }
            />
          ) : filteredSkills.length === 0 ? (
            <EmptyState
              title="No matching skills"
              description={`No skill matches "${searchQuery}".`}
              action={
                <Button size="sm" variant="secondary" onClick={() => setSearchQuery('')}>
                  Clear search
                </Button>
              }
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {filteredSkills.map((skill) => (
                <li
                  key={skill.path}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-bg px-4 py-3 transition-all duration-150 hover:border-[var(--color-border-focus)]/40 hover:bg-elevated"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-fg">{skill.name}</span>
                      <Badge tone={skill.valid ? 'success' : 'warn'} dot>
                        {skill.valid ? 'Valid' : 'Warnings'}
                      </Badge>
                      <Badge tone="neutral">{skill.source}</Badge>
                      {skill.containsScripts && (
                        <Badge tone="warn">Has scripts</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-fg-muted" title={skill.path}>
                      {skill.description ?? skill.path}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button size="xs" variant="ghost" onClick={() => void inspect(skill.path)}>
                      Details
                    </Button>
                    {confirmRemove === skill.path ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          variant="danger"
                          onClick={() => void doRemove(skill.path)}
                          loading={busy}
                        >
                          Confirm delete
                        </Button>
                        <Button size="xs" variant="ghost" onClick={() => setConfirmRemove(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        aria-label={`Remove ${skill.name}`}
                        onClick={() => setConfirmRemove(skill.path)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-muted hover:text-danger"
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

        {/* Skill detail */}
        {selected && (
          <Panel
            title={`Skill: ${selected.name}`}
            actions={
              <Button size="xs" variant="ghost" onClick={() => setSelected(null)}>
                <CloseIcon className="h-3.5 w-3.5" />
                Close
              </Button>
            }
            className="animate-fade-in"
          >
            <div className="flex flex-col gap-4 text-xs">
              <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-bg px-4 py-3">
                <dt className="text-fg-muted">Directory</dt>
                <dd className="break-all font-mono text-fg">{selected.path}</dd>
                <dt className="text-fg-muted">Scope</dt>
                <dd className="text-fg">{selected.source}</dd>
                <dt className="text-fg-muted">Files</dt>
                <dd className="text-fg">{selected.files.join(', ') || 'None'}</dd>
              </dl>

              <div>
                <p className="mb-2 font-semibold text-fg">Frontmatter / Metadata</p>
                <pre className="max-h-60 overflow-auto rounded-xl border border-[var(--color-border)] bg-bg p-4 font-mono text-[11px] leading-relaxed text-fg">
                  {JSON.stringify(selected.frontmatter, null, 2)}
                </pre>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
