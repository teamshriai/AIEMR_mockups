/**
 * The calm surface kit — the pieces every screen shares so the product reads
 * as one system rather than one nice home page.
 *
 *   SectionCard   one frosted frame per section (title · meta · action · body)
 *   CountPill     a small count in a card header
 *   PillLink      a pill-shaped card action — "See all ›"
 *   PillTabs      the one segmented filter, with optional counts
 *   ScopeTabs     PillTabs bound to `?scope=` — today first, the rest on tap
 *   Why           an explanation folded behind one quiet line
 *   Disclosure    "Show 5 earlier ›" for a collapsed group inside a list
 *
 * The rule these encode is the user's: a screen shows only what the doctor
 * needs at that moment of that day. Everything else is one tap away, in the
 * same place on every screen, so it is learned once.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Icon, cx, toneClass } from '@/components/primitives'
import type { CardTone } from '@/components/primitives'
import type { Urgency } from '@/data/myday'

export type { CardTone }

// ───────────────────────────────────────────────────────────── SectionCard

export function SectionCard({
  title,
  leading,
  meta,
  action,
  accent,
  tone,
  lift,
  fill,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode
  /** Before the title, outside the heading — an icon button that belongs to the card. */
  leading?: ReactNode
  /** Quiet, right of the title — a count, a time. */
  meta?: ReactNode
  action?: ReactNode
  /** A solid fill in this urgency's hue — how an attention card earns prominence. */
  accent?: Urgency
  /**
   * A solid fill naming what the card is about — a patient, the inpatients, the
   * day, the AI. The colour is the meaning, so it is never decorative, and the
   * same purpose takes the same colour on every screen.
   */
  tone?: CardTone
  /** The hover lift. Cards and tiles only, never rows. */
  lift?: boolean
  /** The body grows to the card's height, so the card can fill its track. */
  fill?: boolean
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={cx(
        'glass-strong relative min-w-0 overflow-hidden rounded-card',
        /* Urgency is the louder signal, so it wins over a tone. */
        accent ? `card-toned card-urgency-${accent}` : toneClass(tone),
        lift && 'lift',
        fill && 'flex h-full flex-col',
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pt-4 pb-2 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
          {leading}
          <h2 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">{title}</h2>
          {meta}
        </div>
        {action}
      </header>
      <div className={cx('px-2 pb-2 sm:px-3 sm:pb-3', fill && 'flex min-h-0 flex-1 flex-col', bodyClassName)}>
        {children}
      </div>
    </section>
  )
}

/** The uppercase section title on its own, for sections that are not cards. */
export function SectionTitle({
  title,
  meta,
  action,
  className,
}: {
  title: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <h2 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">{title}</h2>
        {meta}
      </div>
      {action}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── CountPill

const SOLID: Record<Urgency, string> = {
  critical: 'bg-pri-critical-fill text-pri-on-critical',
  warning: 'bg-pri-warning-fill text-pri-on-warning',
  pending: 'bg-pri-pending-fill text-pri-on-warning',
}

export function CountPill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: Urgency | 'neutral' | 'brand'
}) {
  const cls = tone === 'neutral' ? 'bg-glass-inset text-ink-2' : tone === 'brand' ? 'bg-brand text-brand-on' : SOLID[tone]
  return (
    <span className={cx('tabular inline-flex min-h-6 items-center rounded-pill px-2.5 text-[0.8em] font-bold', cls)}>
      {children}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────── PillLink

export function PillLink({
  to,
  onClick,
  children,
  icon = 'ChevronRight',
}: {
  to?: string
  onClick?: () => void
  children: ReactNode
  icon?: string
}) {
  const cls =
    'inline-flex min-h-9 items-center gap-1 rounded-pill bg-brand-soft px-3.5 text-[0.86em] font-semibold text-brand transition-colors duration-150 ease-out-clinical hover:bg-brand hover:text-brand-on'
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
        <Icon name={icon} size={13} />
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
      <Icon name={icon} size={13} />
    </button>
  )
}

// ──────────────────────────────────────────────────────────────── PillTabs

export interface PillTabOption<K extends string> {
  key: K
  label: string
  icon?: string
  /** Shown as a small count after the label — "Tomorrow · 1". */
  count?: number
}

/**
 * The one filter control used on every list — the same shape wherever a list
 * can be narrowed, so a doctor learns it once.
 */
export function PillTabs<K extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: K
  options: PillTabOption<K>[]
  onChange: (key: K) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cx('inline-flex flex-wrap gap-1 rounded-pill bg-glass-inset p-1', className)}>
      {options.map((o) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className={cx(
              'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3.5 text-[0.88em] font-semibold transition-colors duration-150 ease-out-clinical',
              active ? 'bg-brand text-brand-on shadow-glass' : 'text-ink-3 hover:bg-glass-fill-hover hover:text-ink',
            )}
          >
            {o.icon && <Icon name={o.icon} size={13} />}
            {o.label}
            {o.count !== undefined && (
              <span
                className={cx(
                  'tabular inline-flex min-h-5 min-w-5 items-center justify-center rounded-pill px-1.5 text-[0.82em] font-bold',
                  active ? 'bg-brand-on/20 text-brand-on' : 'bg-glass-fill-strong text-ink-2',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────── ScopeTabs

/**
 * The slice of a list the doctor is looking at, kept in the URL so a link can
 * open a screen already narrowed. The fallback is the "now" slice and is
 * never written to the URL, so a plain route always opens on today.
 */
export function useScope<K extends string>(
  options: readonly K[],
  fallback: K,
  param = 'scope',
): [K, (key: K) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get(param)
  const value = (options as readonly string[]).includes(raw ?? '') ? (raw as K) : fallback
  const set = (key: K) => {
    const next = new URLSearchParams(params)
    if (key === fallback) next.delete(param)
    else next.set(param, key)
    setParams(next, { replace: true })
  }
  return [value, set]
}

export function ScopeTabs<K extends string>(props: {
  value: K
  options: PillTabOption<K>[]
  onChange: (key: K) => void
  ariaLabel?: string
  className?: string
}) {
  return <PillTabs {...props} ariaLabel={props.ariaLabel ?? 'Which to show'} />
}

// ────────────────────────────────────────────────────────────────────── Why

/**
 * An explanation folded behind one quiet line. The atlas rationale a screen
 * carries stays reachable; the surface shows none of it until asked.
 */
export function Why({
  label = 'Why this works this way',
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cx('min-w-0', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-2 text-[0.84em] text-ink-3 transition-colors duration-150 hover:bg-glass-fill-hover hover:text-ink-2"
      >
        <Icon name="Info" size={13} />
        {label}
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={12} />
      </button>
      {open && <div className="mt-2 space-y-3 text-[0.95em]">{children}</div>}
    </div>
  )
}

// ────────────────────────────────────────────────────────────── Disclosure

/** "Show 5 earlier ›" — a collapsed group inside a list, opened on tap. */
export function Disclosure({
  label,
  count,
  children,
  defaultOpen = false,
  className,
}: {
  label: string
  count?: number
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cx('min-w-0', className)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-10 w-full items-center gap-2 rounded-panel px-3 text-left text-[0.88em] font-semibold text-ink-2 transition-colors duration-150 hover:bg-glass-fill-hover"
      >
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} className="text-ink-3" />
        {open ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        {count !== undefined && <CountPill>{count}</CountPill>}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  )
}
