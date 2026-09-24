/**
 * C-01 … C-30 — the primitive component library (§5.6).
 *
 * Two atlas rules shape almost everything here:
 *   §5.3  "Colour is never the only carrier... Every semantic state carries an
 *          ICON AND A TEXT LABEL in addition to colour."
 *   §10.4 Touch targets >= 44px on any frame a gloved or mobile persona uses,
 *          which in a hospital is all of them.
 */

import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from 'react'

import { ICONS } from './icons'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

// ─────────────────────────────────────────────────────────────────── Icon

/** §5.5 — one 24px outline set at 2px stroke, with a 16px variant for tables. */
export function Icon({
  name,
  size = 16,
  className,
  strokeWidth = 2,
}: {
  name: string
  size?: number
  className?: string
  strokeWidth?: number
}) {
  const Cmp = ICONS[name as keyof typeof ICONS]
  if (!Cmp) {
    if (import.meta.env.DEV) console.warn(`Icon "${name}" is not in the icon registry — add it to components/icons.ts`)
    return null
  }
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} aria-hidden />
}

// ───────────────────────────────────────────────────────────── C-01 Button

type ButtonTone = 'primary' | 'secondary' | 'tertiary' | 'destructive' | 'ai'

const BUTTON_TONES: Record<ButtonTone, string> = {
  primary: 'bg-brand text-brand-on hover:bg-brand-dark border border-transparent',
  secondary: 'glass border-glass-border text-ink hover:bg-glass-fill-hover',
  tertiary: 'bg-transparent text-ink-2 hover:bg-glass-fill border border-transparent',
  destructive: 'bg-critical text-critical-on hover:brightness-110 border border-transparent',
  ai: 'ai-surface hover:brightness-105',
}

export function Button({
  tone = 'secondary',
  icon,
  iconAfter,
  size = 'md',
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<'button'> & {
  tone?: ButtonTone
  icon?: string
  iconAfter?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const pad = size === 'lg' ? 'px-6 py-3.5 text-base' : size === 'sm' ? 'px-3 py-1.5' : 'px-4 py-2.5'
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-pill font-medium',
        'transition-all duration-150 ease-out-clinical',
        'disabled:cursor-not-allowed disabled:opacity-45',
        size !== 'sm' && 'min-h-11',
        pad,
        BUTTON_TONES[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 16} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={size === 'lg' ? 20 : 16} />}
    </button>
  )
}

/** C-02 — icon button. Tooltip AND accessible name are both mandatory. */
export function IconButton({
  icon,
  label,
  active,
  className,
  size = 16,
  ...rest
}: ComponentPropsWithoutRef<'button'> & { icon: string; label: string; active?: boolean; size?: number }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      {...rest}
      className={cx(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-pill',
        'transition-colors duration-150 ease-out-clinical',
        'hover:bg-glass-fill-hover disabled:opacity-45',
        active && 'bg-glass-fill-strong text-brand',
        className,
      )}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

// ───────────────────────────────────────────────────────────── Surfaces

/**
 * Every card in the product is the same frosted surface, so `SectionCard` and a
 * bare `Card` cannot sit side by side at two different brightnesses. `quiet`
 * asks for the lighter fill, for a card nested inside another surface.
 */
export function Card({
  className,
  children,
  strong,
  quiet,
  as: As = 'section',
  ...rest
}: ComponentPropsWithoutRef<'section'> & {
  /** Retained for callers that asked for the strong fill explicitly; now the default. */
  strong?: boolean
  quiet?: boolean
  as?: 'section' | 'div' | 'article' | 'aside'
}) {
  void strong
  return (
    <As {...rest} className={cx(quiet ? 'glass' : 'glass-strong', 'glass-card', className)}>
      {children}
    </As>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  icon?: string
  className?: string
}) {
  return (
    <header className={cx('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-semibold tracking-tight">
          {icon && <Icon name={icon} size={16} className="text-ink-3" />}
          <span className="truncate">{title}</span>
        </h2>
        {subtitle && <p className="mt-0.5 text-[0.92em] text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </header>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx('border-0 border-t border-glass-hairline', className)} />
}

// ───────────────────────────────────────────────────────────── Chips

type ChipTone = 'neutral' | 'brand' | 'normal' | 'caution' | 'abnormal' | 'critical' | 'isolation' | 'inactive' | 'ai'

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-glass-fill-muted text-ink-2 border-glass-hairline',
  brand: 'bg-brand-soft text-brand border-transparent',
  // Clinical semantics never get glass — an opaque chip cannot be misread.
  normal: 'bg-normal-soft text-normal border-transparent',
  caution: 'bg-caution-soft text-caution border-transparent',
  abnormal: 'bg-abnormal-soft text-abnormal border-transparent',
  critical: 'bg-critical text-critical-on border-transparent',
  isolation: 'bg-isolation-soft text-isolation border-transparent',
  inactive: 'bg-inactive-soft text-inactive border-transparent',
  ai: 'bg-ai-soft text-ai border-transparent',
}

export function Chip({
  tone = 'neutral',
  icon,
  children,
  className,
  title,
}: {
  tone?: ChipTone
  icon?: string
  children: ReactNode
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5',
        'text-[0.86em] font-medium whitespace-nowrap',
        CHIP_TONES[tone],
        className,
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

/**
 * The §5.3 rule made into a component: a clinical value always renders an
 * icon AND the word, so "↑ High" never depends on the colour being seen.
 */
export function ClinicalFlag({ flag, className }: { flag: string; className?: string }) {
  const map: Record<string, { tone: ChipTone; icon: string }> = {
    Normal: { tone: 'normal', icon: 'Check' },
    '↑ High': { tone: 'abnormal', icon: 'ArrowUp' },
    '↓ Low': { tone: 'abnormal', icon: 'ArrowDown' },
    '↑↑ Critical high': { tone: 'critical', icon: 'TriangleAlert' },
    '↓↓ Critical low': { tone: 'critical', icon: 'TriangleAlert' },
  }
  const style = map[flag] ?? { tone: 'neutral' as ChipTone, icon: 'Info' }
  return (
    <Chip tone={style.tone} icon={style.icon} className={className}>
      {/* The icon is the arrow; repeating it as a glyph reads as "↑ ↑ High". */}
      {flag.replace(/^[↑↓]+\s*/, '')}
    </Chip>
  )
}

// ───────────────────────────────────────────────────── C-24 Stat tile / KPI

export function StatTile({
  label,
  value,
  sub,
  tone = 'neutral',
  action,
  badge,
  onClick,
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: ChipTone
  action?: ReactNode
  badge?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const interactive = Boolean(onClick)
  const accent =
    tone === 'critical'
      ? 'text-critical'
      : tone === 'abnormal'
        ? 'text-abnormal'
        : tone === 'caution'
          ? 'text-caution'
          : tone === 'normal'
            ? 'text-normal'
            : 'text-ink'
  return (
    <Card
      as="div"
      strong
      onClick={onClick}
      className={cx('flex min-h-28 flex-col justify-between p-4', interactive && 'lift cursor-pointer', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">{label}</p>
        {badge}
      </div>
      <div>
        <p className={cx('tabular mt-2 text-3xl leading-none font-bold tracking-tight', accent)}>{value}</p>
        {sub && <p className="mt-1.5 text-[0.88em] text-ink-3">{sub}</p>}
      </div>
      {action && <div className="mt-3">{action}</div>}
    </Card>
  )
}

// ───────────────────────────────────────────────── C-19 / C-20 Data table

export function Table({
  head,
  children,
  /** ARC-01 requires a row-count line under every worklist. */
  rowCount,
  caption,
  className,
}: {
  head: ReactNode
  children: ReactNode
  rowCount?: string
  caption?: string
  className?: string
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full border-collapse text-left">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-10">
            <tr className="bg-glass-inset">{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {rowCount && <p className="border-t border-glass-hairline px-4 py-2 text-[0.86em] text-ink-3">{rowCount}</p>}
    </div>
  )
}

export function Th({ children, className, ...rest }: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      scope="col"
      {...rest}
      className={cx(
        'px-4 py-2',
        'text-[0.76em] font-bold tracking-[0.08em] text-ink-3 uppercase',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className, ...rest }: ComponentPropsWithoutRef<'td'>) {
  return (
    <td {...rest} className={cx('border-t border-glass-hairline px-4 py-3 align-middle', className)}>
      {children}
    </td>
  )
}

export function Tr({
  children,
  selected,
  onClick,
  className,
  ...rest
}: ComponentPropsWithoutRef<'tr'> & { selected?: boolean }) {
  return (
    <tr
      {...rest}
      onClick={onClick}
      aria-selected={selected}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick(e as unknown as React.MouseEvent<HTMLTableRowElement>)
              }
            }
          : undefined
      }
      className={cx(
        onClick && 'cursor-pointer',
        'transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover',
        selected && 'bg-brand-soft',
        className,
      )}
    >
      {children}
    </tr>
  )
}

// ───────────────────────────────────────────────────────────── C-28 Tabs

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { key: string; label: string; badge?: ReactNode }[]
  active: string
  onChange: (key: string) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cx('no-scrollbar flex gap-1 overflow-x-auto rounded-pill bg-glass-fill-muted p-1', className)}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cx(
            'inline-flex shrink-0 items-center gap-2 rounded-pill px-4 py-2',
            'text-[0.95em] font-medium transition-all duration-150 ease-out-clinical',
            active === t.key
              ? 'bg-glass-fill-strong text-ink shadow-glass'
              : 'text-ink-3 hover:bg-glass-fill hover:text-ink-2',
          )}
        >
          {t.label}
          {t.badge}
        </button>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────── C-03 / C-04 / C-06 fields

export function Field({
  label,
  required,
  hint,
  error,
  children,
  htmlFor,
  aiSlot,
  className,
}: {
  label: string
  required?: boolean
  hint?: ReactNode
  error?: string
  children: ReactNode
  htmlFor?: string
  /** Where an AIP-02 inline field chip sits. */
  aiSlot?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[0.92em] font-medium text-ink-2">
          {label}
          {required && (
            <span className="ml-1 text-abnormal" aria-label="required">
              *
            </span>
          )}
        </label>
        {aiSlot}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[0.88em] font-medium text-abnormal">
          <Icon name="CircleAlert" size={13} />
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[0.88em] text-ink-3">{hint}</p>
      )}
    </div>
  )
}

const FIELD_BASE =
  'w-full rounded-field border border-glass-hairline bg-glass-fill-strong px-3.5 py-2.5 ' +
  'text-ink placeholder:text-ink-muted transition-colors duration-150 ' +
  'focus:border-ai focus:outline-none disabled:opacity-60'

export function TextInput({ className, ...rest }: ComponentPropsWithoutRef<'input'>) {
  return <input {...rest} className={cx(FIELD_BASE, 'min-h-11', className)} />
}

/** C-04 — textarea, autogrow. Takes a `ref` (React 19 passes it as a prop). */
export function TextArea({ className, rows = 4, ...rest }: ComponentProps<'textarea'>) {
  return <textarea rows={rows} {...rest} className={cx(FIELD_BASE, 'resize-y leading-relaxed', className)} />
}

export function Select({ className, children, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return (
    <select {...rest} className={cx(FIELD_BASE, 'min-h-11 appearance-none pr-9', className)}>
      {children}
    </select>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill',
        'transition-colors duration-150 ease-out-clinical',
        checked ? 'bg-brand' : 'bg-inactive-soft',
        className,
      )}
    >
      <span
        className={cx(
          'block size-4.5 rounded-pill bg-white shadow transition-transform duration-150 ease-out-clinical',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-start gap-2.5 py-1', disabled && 'opacity-55', className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4.5 shrink-0 accent-[var(--color-brand)]"
      />
      <span className="text-[0.95em] leading-snug">{label}</span>
    </label>
  )
}

// ───────────────────────────────────────────── C-30 Empty state, C-45 skeleton

/**
 * C-30 — "must explain WHY empty and what to do". §1.5 forbids a bare
 * "No records".
 */
export function EmptyState({
  icon = 'Inbox',
  why,
  action,
  className,
}: {
  icon?: string
  why: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center gap-3 px-6 py-14 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-pill bg-glass-fill-muted">
        <Icon name={icon} size={22} className="text-ink-3" />
      </div>
      <p className="max-w-md text-ink-2">{why}</p>
      {action}
    </div>
  )
}

/** C-45 — "skeleton geometry that MATCHES THE LOADED LAYOUT". */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx('animate-pulse rounded-field bg-glass-fill-muted', className)}
      style={{ animationDuration: '1.4s' }}
    />
  )
}

// ───────────────────────────────────────────────────── C-34 Inline alert

type AlertTone = 'info' | 'caution' | 'abnormal' | 'critical' | 'ai' | 'normal'

const ALERT_TONES: Record<AlertTone, { wrap: string; icon: string }> = {
  info: { wrap: 'border-glass-hairline bg-glass-fill-muted text-ink-2', icon: 'Info' },
  normal: { wrap: 'border-normal/25 bg-normal-soft text-normal', icon: 'CircleCheck' },
  caution: { wrap: 'border-caution/25 bg-caution-soft text-caution', icon: 'TriangleAlert' },
  abnormal: { wrap: 'border-abnormal/25 bg-abnormal-soft text-abnormal', icon: 'CircleAlert' },
  critical: { wrap: 'border-critical/40 bg-critical-soft text-critical', icon: 'OctagonAlert' },
  ai: { wrap: 'border-ai/25 bg-ai-soft text-ai', icon: 'Sparkles' },
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
  role,
}: {
  tone?: AlertTone
  title: ReactNode
  children?: ReactNode
  action?: ReactNode
  className?: string
  role?: 'status' | 'alert'
}) {
  const t = ALERT_TONES[tone]
  return (
    <div
      role={role}
      className={cx('flex items-start gap-3 rounded-panel border px-4 py-3', t.wrap, className)}
    >
      <Icon name={t.icon} size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-1 text-[0.95em] opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** A labelled key/value row, used across detail panels. */
export function KeyValue({
  label,
  children,
  className,
}: {
  label: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-1.5', className)}>
      <dt className="text-[0.9em] text-ink-3">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  )
}

/** C-27 — progress stepper, for ARC-03 wizards. */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[]
  current: number
  className?: string
}) {
  return (
    <ol className={cx('no-scrollbar flex items-center gap-2 overflow-x-auto', className)}>
      {steps.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-2">
          <span
            className={cx(
              'flex size-7 items-center justify-center rounded-pill text-[0.82em] font-semibold',
              i < current
                ? 'bg-normal text-white'
                : i === current
                  ? 'bg-brand text-brand-on'
                  : 'bg-glass-fill-muted text-ink-3',
            )}
          >
            {i < current ? <Icon name="Check" size={13} /> : i + 1}
          </span>
          <span className={cx('text-[0.92em]', i === current ? 'font-semibold text-ink' : 'text-ink-3')}>{s}</span>
          {i < steps.length - 1 && <Icon name="ChevronRight" size={14} className="text-ink-muted" />}
        </li>
      ))}
    </ol>
  )
}
