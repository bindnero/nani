import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ──────────────────────────────── Button ───────────────────────────────── */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-accent-fg hover:opacity-90 active:scale-[0.97] shadow-[0_0_0_1px_transparent] hover:shadow-[var(--shadow-glow)]',
  secondary:
    'bg-elevated border border-[var(--color-border)] text-fg hover:bg-elevated2 hover:border-[var(--color-border-focus)] active:scale-[0.97]',
  ghost:
    'bg-transparent text-fg-muted hover:text-fg hover:bg-elevated active:scale-[0.97]',
  danger:
    'bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white active:scale-[0.97]',
  success:
    'bg-success/10 text-success border border-success/30 hover:bg-success hover:text-white active:scale-[0.97]',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  xs: 'h-6 px-2 text-[11px] rounded-md gap-1',
  sm: 'h-7 px-2.5 text-xs rounded-md gap-1.5',
  md: 'h-8 px-3.5 text-sm rounded-lg gap-2',
  lg: 'h-10 px-5 text-sm rounded-lg gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-bg',
        BUTTON_SIZES[size],
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

/* ─────────────────────────────── Spinner ───────────────────────────────── */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent',
        className ?? 'h-4 w-4',
      )}
    />
  );
}

/* ──────────────────────────────── Badge ────────────────────────────────── */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger' | 'accent';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-elevated border-[var(--color-border)] text-fg-muted',
  info:    'bg-accent/10 border-accent/30 text-accent',
  accent:  'bg-accent/10 border-accent/30 text-accent',
  success: 'bg-success/10 border-success/30 text-success',
  warn:    'bg-warn/10 border-warn/30 text-warn',
  danger:  'bg-danger/10 border-danger/30 text-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  icon,
  dot,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
  dot?: boolean;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        BADGE_TONES[tone],
      )}
    >
      {dot && (
        <span
          className={cx(
            'inline-block h-1.5 w-1.5 rounded-full',
            tone === 'success' && 'bg-success',
            tone === 'warn'    && 'bg-warn',
            tone === 'danger'  && 'bg-danger',
            tone === 'accent'  && 'bg-accent',
            (tone === 'neutral' || tone === 'info') && 'bg-fg-muted',
          )}
        />
      )}
      {icon}
      {children}
    </span>
  );
}

/* ──────────────────────────────── Panel ────────────────────────────────── */

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className,
  noPadding,
  ...rest
}: {
  title?: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx(
        'rounded-xl border border-[var(--color-border)] bg-surface',
        'shadow-[var(--shadow-sm)]',
        'animate-fade-in',
        className,
      )}
      {...rest}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-3">
          <div className="min-w-0 flex-1">
            {typeof title === 'string' ? (
              <h2 className="text-sm font-semibold text-fg">{title}</h2>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={noPadding ? '' : 'p-5'}>{children}</div>
    </section>
  );
}

/* ──────────────────────────────── Field ────────────────────────────────── */

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: (props: { id: string; 'aria-describedby': string | undefined }) => ReactNode;
}) {
  const id = useId();
  const describedBy = cx(hint && `${id}-hint`, error && `${id}-error`) || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-fg-muted">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy })}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-xs text-danger">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-danger" />
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_CLASSES =
  'w-full rounded-lg border border-[var(--color-border)] bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted ' +
  'transition-all duration-150 ' +
  'focus:border-[var(--color-border-focus)] focus:outline-none focus:ring-2 focus:ring-accent/20 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(INPUT_CLASSES, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(INPUT_CLASSES, 'resize-none leading-relaxed', className)} {...rest} />;
});

/* ──────────────────────────────── Toggle ───────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <label htmlFor={inputId} className="text-sm font-medium text-fg cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-xs text-fg-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={inputId}
        role="switch"
        type="button"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-all duration-200',
          checked
            ? 'border-accent bg-accent shadow-[var(--shadow-glow)]'
            : 'border-[var(--color-border)] bg-elevated',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ─────────────────────────────── EmptyState ────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center">
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-elevated text-fg-muted">
          {icon}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-fg">{title}</p>
        {description && (
          <p className="mt-1 max-w-xs text-xs text-fg-muted leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────── StatusDot ────────────────────────────── */

export function StatusDot({ status }: { status: 'idle' | 'running' | 'success' | 'error' | 'warn' }) {
  return (
    <span className="relative inline-flex h-2 w-2">
      <span
        className={cx(
          'absolute inline-flex h-full w-full rounded-full opacity-75',
          status === 'running' && 'animate-ping bg-accent',
        )}
      />
      <span
        className={cx(
          'relative inline-flex h-2 w-2 rounded-full',
          status === 'idle'    && 'bg-fg-subtle',
          status === 'running' && 'bg-accent',
          status === 'success' && 'bg-success',
          status === 'error'   && 'bg-danger',
          status === 'warn'    && 'bg-warn',
        )}
      />
    </span>
  );
}

/* ─────────────────────────────── KbdShortcut ───────────────────────────── */

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-fg-muted shadow-[0_1px_0_var(--color-border)]">
      {children}
    </kbd>
  );
}

/* ─────────────────────────────── InfoBanner ────────────────────────────── */

export function InfoBanner({
  icon,
  children,
  tone = 'info',
}: {
  icon?: ReactNode;
  children: ReactNode;
  tone?: 'info' | 'warn' | 'danger' | 'success';
}) {
  const styles = {
    info:    'border-accent/20 bg-accent/8 text-fg-muted',
    warn:    'border-warn/20 bg-warn/8 text-warn',
    danger:  'border-danger/20 bg-danger/8 text-danger',
    success: 'border-success/20 bg-success/8 text-success',
  };
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-lg border px-4 py-3 text-xs',
        styles[tone],
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

/* ───────────────────────────── Route context ───────────────────────────── */

export type AppRoute = 'workspace' | 'skills' | 'settings';

export interface RouteContextValue {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
}

export const RouteContext = createContext<RouteContextValue>({
  route: 'workspace',
  navigate: () => {},
});

export function useRoute(): RouteContextValue {
  return useContext(RouteContext);
}
