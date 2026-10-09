import { cx, useRoute, type AppRoute } from './ui/primitives';
import { useAppStore } from '../state/appStore';
import {
  FolderOpenIcon,
  SparklesIcon,
  SettingsIcon,
  ZapIcon,
} from './ui/icons';

const NAV: Array<{ route: AppRoute; label: string; icon: typeof FolderOpenIcon; description: string }> = [
  { route: 'workspace', label: 'Workspace',  icon: FolderOpenIcon, description: 'Run sessions' },
  { route: 'skills',   label: 'Skills',      icon: SparklesIcon,   description: 'Manage skills' },
  { route: 'settings', label: 'Settings',    icon: SettingsIcon,   description: 'Configure Nani' },
];

export function Sidebar() {
  const { route, navigate } = useRoute();
  const ready = useAppStore((s) => s.ready);

  return (
    <nav
      aria-label="Primary"
      className="flex h-full w-52 flex-col border-r border-[var(--color-border)] sidebar-gradient"
    >
      {/* ── Logo / Brand ─────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-border)]">
        <div
          className="logo-ring relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white transition-all duration-300 hover:scale-105 cursor-default select-none"
        >
          <img
            src="/logo.jpg"
            alt="Nani"
            className="h-full w-full rounded-full object-cover"
            draggable={false}
          />
        </div>
        <div className="min-w-0">
          <span className="block text-sm font-bold tracking-tight text-fg leading-tight">Nani</span>
          <span className="block text-[10px] font-medium text-accent opacity-80 leading-tight mt-0.5">
            Claude Code Desktop
          </span>
        </div>
      </div>

      {/* ── Nav items ─────────────────────────────────── */}
      <ul className="flex flex-1 flex-col gap-0.5 px-2 pt-3" role="list">
        {NAV.map((item) => {
          const Icon   = item.icon;
          const active = route === item.route;
          return (
            <li key={item.route}>
              <button
                type="button"
                onClick={() => navigate(item.route)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150',
                  active
                    ? 'bg-accent/10 shadow-[inset_0_0_0_1px_rgba(91,156,246,0.25)]'
                    : 'text-fg-muted hover:bg-elevated/60 hover:text-fg',
                )}
              >
                <Icon
                  className={cx(
                    'h-4 w-4 shrink-0 transition-all duration-150',
                    active
                      ? 'text-accent drop-shadow-[0_0_6px_rgba(91,156,246,0.6)]'
                      : 'text-fg-subtle group-hover:text-fg-muted',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <span className={cx('block text-xs font-semibold', active ? 'text-accent' : '')}>
                    {item.label}
                  </span>
                  <span className="block truncate text-[10px] text-fg-subtle">
                    {item.description}
                  </span>
                </div>
                {active && (
                  <span className="ml-auto h-4 w-0.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent)]" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* ── Footer ───────────────────────────────────── */}
      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2 text-[10px] text-fg-subtle">
          <ZapIcon className={cx('h-3 w-3 transition-colors', ready ? 'text-success' : 'text-fg-subtle animate-glow-pulse')} />
          <span className={ready ? 'text-fg-subtle' : ''}>{ready ? 'Ready · Local-first' : 'Starting…'}</span>
        </div>
        <p className="mt-0.5 text-[10px] text-fg-subtle opacity-50">v0.1.0 · MIT License</p>
      </div>
    </nav>
  );
}
