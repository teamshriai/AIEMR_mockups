/**
 * The 14 screen states (§1.5), as renderable frames plus the host that decides
 * which one a screen shows.
 *
 * The atlas's position, which this implements: "They have thought about what
 * breaks. The offline strip, the break-glass banner, the AI-abstain state, the
 * publish-failure queue. Every buyer has been burned by a demo that only worked
 * on the happy path." (§2.2)
 *
 * So every state is reachable from the state switcher in Z4, and the ones with
 * real rules behind them enforce those rules rather than illustrating them —
 * DENIED shows no patient data at all, OFFLINE preserves typed content, and
 * AI-OFF hides rather than greys.
 */

import type { ReactNode } from 'react'

import type { DeclaredState } from '@/atlas/states'
import { STATE_SPECS } from '@/atlas/states'
import { formatTime } from '@/data/format'
import { useAI } from '@/store/ai'

import { Alert, Button, Card, Icon, Skeleton, cx } from './primitives'

// ───────────────────────────────────────────────────── C-45 LOADING skeleton

/**
 * "Skeleton geometry that MATCHES THE LOADED LAYOUT — never a spinner on a
 * blank page." So the skeleton takes the shape of the archetype it stands in
 * for, rather than being one generic block.
 */
export function LoadingFrame({ shape = 'list' }: { shape?: 'list' | 'tiles' | 'form' | 'board' | 'thread' }) {
  if (shape === 'tiles') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
    )
  }
  if (shape === 'form') {
    return (
      <div className="space-y-5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i}>
            <Skeleton className="mb-2 h-3.5 w-28" />
            <Skeleton className="h-24 rounded-field" />
          </div>
        ))}
      </div>
    )
  }
  if (shape === 'board') {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-8 rounded-pill" />
            <Skeleton className="h-24 rounded-panel" />
            <Skeleton className="h-24 rounded-panel" />
          </div>
        ))}
      </div>
    )
  }
  if (shape === 'thread') {
    return (
      <div className="space-y-4">
        <Skeleton className="ml-auto h-12 w-2/3 rounded-panel" />
        <Skeleton className="h-28 w-5/6 rounded-panel" />
        <Skeleton className="ml-auto h-12 w-1/2 rounded-panel" />
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 rounded-pill" />
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="h-14 rounded-panel" />
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────── PARTIAL — a failed region

/** "The screen stays usable; the failed region names what is missing and since when." */
export function PartialRegion({ what, since, onRetry }: { what: string; since: string; onRetry?: () => void }) {
  return (
    <Alert
      tone="caution"
      title={`${what} is unavailable`}
      action={onRetry && <Button size="sm" icon="RefreshCw" onClick={onRetry}>Retry</Button>}
    >
      Last reached {since}. Everything else on this screen is current and usable.
    </Alert>
  )
}

// ───────────────────────────────────────────────────────── ERROR

/** "Recoverable, with the user's input PRESERVED and an escape hatch." */
export function ErrorFrame({
  what,
  preserved,
  onRetry,
  onCopyOut,
}: {
  what: string
  /** What was kept. The atlas's escape hatch on S-06-03 is "Copy note text". */
  preserved?: string
  onRetry?: () => void
  onCopyOut?: () => void
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-abnormal-soft">
          <Icon name="CircleAlert" size={20} className="text-abnormal" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{what}</h2>
          {preserved && (
            <p className="mt-1.5 text-ink-2">
              <strong>{preserved} is kept.</strong> Nothing you typed has been lost.
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {onRetry && (
              <Button tone="primary" icon="RefreshCw" onClick={onRetry}>
                Try again
              </Button>
            )}
            {onCopyOut && (
              <Button icon="Copy" onClick={onCopyOut}>
                Copy the text out
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// ────────────────────────────────────────────────────── VALIDATION

/**
 * "Count of problems, inline errors, focus moved to the first, primary action
 * STAYS DISABLED."
 */
export function ValidationSummary({
  problems,
  onFocusFirst,
  className,
}: {
  problems: { field: string; message: string }[]
  onFocusFirst?: () => void
  className?: string
}) {
  if (problems.length === 0) return null
  return (
    <Alert
      tone="abnormal"
      role="alert"
      className={className}
      title={`${problems.length} ${problems.length === 1 ? 'item needs' : 'items need'} attention`}
      action={
        onFocusFirst && (
          <Button size="sm" onClick={onFocusFirst}>
            Go to the first
          </Button>
        )
      }
    >
      <ul className="mt-1 space-y-1">
        {problems.map((p) => (
          <li key={p.field} className="flex gap-2">
            <Icon name="Minus" size={13} className="mt-1 shrink-0" />
            <span>
              <strong>{p.field}</strong> — {p.message}
            </span>
          </li>
        ))}
      </ul>
    </Alert>
  )
}

// ──────────────────────────────────────────────── C-36 DENIED panel

/**
 * "What is missing, who grants it, a request action — AND NO PATIENT DATA
 * ANYWHERE ON SCREEN."
 *
 * §3.2's uniform-refusal rule is why the copy is identical across every cause
 * in its class: "no such patient" versus "not your patient" leaks that the
 * patient exists. A refusal that distinguishes causes is a
 * relationship-existence oracle.
 */
export function DeniedPanel({
  capability,
  grantedBy = 'your medical superintendent',
}: {
  capability: string
  grantedBy?: string
}) {
  return (
    <Card className="mx-auto max-w-lg p-7 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-pill bg-inactive-soft">
        <Icon name="ShieldX" size={22} className="text-inactive" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">This is not available to you</h2>
      <p className="mt-2 text-ink-2">
        You do not hold <code className="rounded-chip bg-glass-fill-muted px-1.5 py-0.5 font-mono text-[0.9em]">{capability}</code>{' '}
        for this subject.
      </p>
      <p className="mt-3 text-[0.92em] text-ink-3">
        The wording here is deliberately identical for every reason access can be refused. A message that distinguished
        them would reveal whether a record exists.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button tone="primary" icon="Send">
          Request access
        </Button>
        <Button icon="Undo2">Go back</Button>
      </div>
      <p className="mt-4 text-[0.88em] text-ink-3">Granted by {grantedBy}.</p>
    </Card>
  )
}

// ─────────────────────────────────── GP-10 / C-48 BREAKGLASS banner

/**
 * "Amber, full width, reason-before-render: 'This access is logged and
 * reviewed'." The reason is captured before the content renders, not after.
 */
export function BreakGlassBanner({
  reason,
  by,
  className,
}: {
  reason: string
  by: string
  className?: string
}) {
  return (
    <div
      role="status"
      className={cx(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-caution/35 bg-caution-soft px-4 py-2.5',
        className,
      )}
    >
      <Icon name="TriangleAlert" size={16} className="shrink-0 text-caution" />
      <p className="text-[0.92em] font-semibold text-caution">Break-glass access — logged and reviewed within 24 hours</p>
      <p className="text-[0.9em] text-caution/85">
        {by} · &ldquo;{reason}&rdquo;
      </p>
    </div>
  )
}

// ────────────────────────────────────────────── C-37 OFFLINE strip

/**
 * "What still works, what is queued, what is blocked. TYPED CONTENT IS NEVER
 * LOST." §2.1 A9 treats unreliable connectivity as normal, not exceptional.
 */
export function OfflineStrip({
  works,
  queued,
  blocked,
  pendingCount,
  className,
}: {
  works: string[]
  queued: string[]
  blocked: string[]
  pendingCount: number
  className?: string
}) {
  return (
    <div
      role="status"
      className={cx('border-y border-inactive/30 bg-inactive-soft px-4 py-2.5', className)}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 font-semibold text-ink-2">
          <Icon name="WifiOff" size={16} />
          Offline
        </span>
        <span className="text-[0.9em] text-ink-3">{pendingCount} changes waiting to sync</span>
      </div>
      <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-[0.88em] sm:grid-cols-3">
        <div>
          <dt className="font-medium text-normal">Still works</dt>
          <dd className="text-ink-3">{works.join(' · ')}</dd>
        </div>
        <div>
          <dt className="font-medium text-caution">Queued</dt>
          <dd className="text-ink-3">{queued.join(' · ')}</dd>
        </div>
        <div>
          <dt className="font-medium text-abnormal">Blocked</dt>
          <dd className="text-ink-3">{blocked.length ? blocked.join(' · ') : 'nothing'}</dd>
        </div>
      </dl>
    </div>
  )
}

// ──────────────────────────────────────────────────── STALE

/** "Timestamp turns amber, 'Data as of HH:MM · Refresh'." */
export function StaleChip({ asOf, onRefresh }: { asOf: Date; onRefresh?: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-chip bg-caution-soft px-2.5 py-1 text-[0.86em] font-medium text-caution">
      <Icon name="Clock" size={13} />
      <span className="tabular">Data as of {formatTime(asOf)}</span>
      {onRefresh && (
        <button type="button" onClick={onRefresh} className="underline underline-offset-2">
          Refresh
        </button>
      )}
    </span>
  )
}

// ──────────────────────────────────────────────────── LOCKED

/**
 * "Read-only render naming WHO HOLDS IT AND SINCE WHEN, plus the legitimate
 * next action (addendum, refresh)."
 *
 * On an authoring screen the legitimate next action is CMP-NABH-10's
 * Addendum — a signed record is never edited.
 */
export function LockedBanner({
  by,
  at,
  reason = 'signed',
  onAddendum,
  className,
}: {
  by: string
  at: string
  reason?: 'signed' | 'held' | 'closed'
  onAddendum?: () => void
  className?: string
}) {
  const copy =
    reason === 'signed'
      ? `Signed by ${by} at ${at}. A signed record is never edited — add an addendum instead.`
      : reason === 'closed'
        ? `Closed by ${by} at ${at}. Corrections are audited amendments, never overwrites.`
        : `Held by ${by} since ${at}. It will release when they close it.`

  return (
    <Alert
      tone="info"
      className={className}
      title={
        <span className="flex items-center gap-2">
          <Icon name="Lock" size={15} />
          Read-only
        </span>
      }
      action={
        onAddendum && (
          <Button tone="primary" size="sm" icon="PenLine" onClick={onAddendum}>
            Addendum
          </Button>
        )
      }
    >
      {copy}
    </Alert>
  )
}

// ────────────────────────────────── The three AI states

/**
 * AI-OFF — "one quiet line". Emphasis on quiet: the screen is fully usable and
 * nothing is greyed out, because greying advertises an absence the clinician
 * cannot act on.
 */
export function AiOffLine({ className }: { className?: string }) {
  return (
    <p className={cx('flex items-center gap-2 text-[0.88em] text-ink-3', className)}>
      <Icon name="CircleDot" size={13} />
      AI assistance is off. Everything on this screen works; deterministic safety checks still run.
    </p>
  )
}

/**
 * AI-ABSTAIN — "states what is missing and the action that would fix it;
 * NEVER a null or zero score."
 */
export function AbstainCard({
  capabilityId,
  missing,
  fixAction,
  className,
}: {
  capabilityId: string
  missing: string
  fixAction?: ReactNode
  className?: string
}) {
  return (
    <Card as="div" className={cx('border-l-[3px] border-l-caution p-4', className)}>
      <p className="flex items-center gap-2 font-semibold text-caution">
        <Icon name="CircleHelp" size={16} />
        Cannot assess
      </p>
      <p className="mt-1.5 text-[0.95em] text-ink-2">{missing}</p>
      {fixAction && <div className="mt-3">{fixAction}</div>}
      <p className="mt-2 text-[0.82em] text-ink-3">
        {capabilityId} · a capability that cannot produce a calibrated score abstains rather than scoring low.
      </p>
    </Card>
  )
}

// ──────────────────────────────────────────── The state switcher (Z4)

/**
 * A demo affordance, not a product one — but it is what turns the atlas's
 * fourteen state tables from a specification into something you can show a
 * client in the room.
 */
export function StateSwitcher({
  available,
  /**
   * On a calm screen the word "State" is one more thing to read, so the label
   * goes to the accessible name only and the control shrinks to the select.
   */
  compact,
}: {
  available: DeclaredState[]
  compact?: boolean
}) {
  const forced = useAI((s) => s.forcedState)
  const forceState = useAI((s) => s.forceState)

  const groups: Record<string, DeclaredState[]> = {}
  for (const code of available) {
    const family = STATE_SPECS[code].family
    groups[family] ??= []
    groups[family].push(code)
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label
        htmlFor="state-switcher"
        className={cx(
          'text-[0.82em] font-medium tracking-wide text-ink-3 uppercase',
          compact && 'sr-only',
        )}
      >
        State
      </label>
      <select
        id="state-switcher"
        value={forced ?? 'DEFAULT'}
        onChange={(e) => forceState(e.target.value === 'DEFAULT' ? null : (e.target.value as DeclaredState))}
        className={cx(
          'min-h-9 rounded-pill border px-3 py-1 text-[0.88em] font-medium',
          forced
            ? 'border-caution/40 bg-caution-soft text-caution'
            : 'border-glass-hairline bg-glass-fill-strong text-ink-2',
        )}
      >
        <option value="DEFAULT">Default</option>
        {Object.entries(groups).map(([family, codes]) => (
          <optgroup key={family} label={family}>
            {codes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {forced && (
        <button
          type="button"
          onClick={() => forceState(null)}
          title={STATE_SPECS[forced].draw}
          className="inline-flex items-center gap-1 rounded-pill bg-caution-soft px-2 py-1 text-[0.82em] font-medium text-caution"
        >
          <Icon name="X" size={12} />
          clear
        </button>
      )}
    </div>
  )
}
