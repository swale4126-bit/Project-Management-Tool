import { AlertCircle, Inbox, RefreshCw, X } from 'lucide-react';
import { formatLabel } from '../../utils/format.js';

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, sublabel, icon: Icon, accent = 'blue' }) {
  const accentStyles = {
    blue: 'text-blue-500 bg-blue-500/10 ring-blue-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 ring-emerald-500/20',
    amber: 'text-amber-500 bg-amber-500/10 ring-amber-500/20',
    rose: 'text-rose-500 bg-rose-500/10 ring-rose-500/20',
    indigo: 'text-indigo-500 bg-indigo-500/10 ring-indigo-500/20',
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg p-2.5 ring-1 ${accentStyles[accent] || accentStyles.blue}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </Card>
  );
}

const STATUS_COLORS = {
  active: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  in_progress: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  available: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  mitigated: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  resolved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
  planning: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
  todo: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  backlog: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  draft: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  pending: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  submitted: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  under_review: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
  in_review: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30',
  on_hold: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  low_stock: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  monitoring: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  investigating: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  at_risk: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  blocked: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  rejected: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  depleted: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  missed: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  open: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  occurred: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
  cancelled: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/30',
  closed: 'bg-slate-500/15 text-slate-500 dark:text-slate-400 border-slate-500/30',
  low: 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30',
  medium: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
  critical: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30',
};

export function StatusBadge({ value }) {
  const cls = STATUS_COLORS[value] || STATUS_COLORS.todo;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {formatLabel(value)}
    </span>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 border-transparent shadow-sm',
    secondary:
      'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:border-slate-700',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 border-transparent',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 border-transparent',
    ghost:
      'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent dark:text-slate-300 dark:hover:bg-slate-800',
  };
  const sizes = {
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function LoadingSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-xl border border-slate-200 bg-slate-200/60 dark:border-slate-800 dark:bg-slate-800/50"
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </Card>
  );
}

export function ErrorBanner({ message, onRetry }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{message || 'Failed to load data.'}</span>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#111827]`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  isPending = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={isPending}>
          {isPending ? 'Processing...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export const labelClass = 'mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300';
