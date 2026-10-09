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

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------- Button -------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90',
  secondary: 'bg-elevated text-fg border border-border hover:border-accent',
  ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-elevated',
  danger: 'bg-danger text-white hover:opacity-90',
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
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
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

/* ------------------------------- Spinner ------------------------------- */

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

/* -------------------------------- Badge -------------------------------- */

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warn' | 'danger';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-border text-fg-muted',
  info: 'border-accent text-accent',
  success: 'border-success text-success',
  warn: 'border-warn text-warn',
  danger: 'border-danger text-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  icon,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
        BADGE_TONES[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/* -------------------------------- Panel -------------------------------- */

export function Panel({
  title,
  actions,
  children,
  className,
  ...rest
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx('rounded-lg border border-border bg-surface', className)}
      {...rest}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          {typeof title === 'string' ? (
            <h2 className="text-sm font-semibold text-fg">{title}</h2>
          ) : (
            title
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/* -------------------------------- Field -------------------------------- */

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
        <p id={`${id}-error`} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_CLASSES =
  'w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(INPUT_CLASSES, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(INPUT_CLASSES, 'resize-none', className)} {...rest} />;
});

/* ------------------------------- Toggle -------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={inputId} className="text-sm text-fg">
        {label}
      </label>
      <button
        id={inputId}
        role="switch"
        type="button"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-5 w-9 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-border bg-elevated',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------ EmptyState ----------------------------- */

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {description && <p className="max-w-md text-xs text-fg-muted">{description}</p>}
      {action}
    </div>
  );
}

/* --------------------------- Optional context -------------------------- */

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

export { cx };
