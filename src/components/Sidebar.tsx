import { useAppStore } from '../state/appStore';
import { cx, useRoute, type AppRoute } from './ui/primitives';
import { FolderIcon, SettingsIcon, ShieldIcon, SparklesIcon } from './ui/icons';

const NAV: Array<{ route: AppRoute; label: string; icon: typeof FolderIcon }> = [
  { route: 'workspace', label: 'Workspace', icon: FolderIcon },
  { route: 'skills', label: 'Skills', icon: SparklesIcon },
  { route: 'settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  const { route, navigate } = useRoute();
  const ready = useAppStore((s) => s.ready);

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-56 flex-col border-r border-border bg-surface"
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <ShieldIcon className="h-5 w-5 text-accent" />
        <span className="text-sm font-semibold tracking-wide">Nani</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1 px-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = route === item.route;
          return (
            <li key={item.route}>
              <button
                type="button"
                onClick={() => navigate(item.route)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-elevated text-fg'
                    : 'text-fg-muted hover:bg-elevated hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-border px-4 py-3 text-xs text-fg-muted">
        <p>{ready ? 'Local-first · no telemetry' : 'Starting…'}</p>
        <p className="mt-1 opacity-70">v0.1.0 · MIT</p>
      </div>
    </nav>
  );
}
