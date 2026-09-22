/**
 * The per-screen frame. Reads the registry row and composes the zones it
 * declares — so no screen re-derives its own title, density, theme default,
 * breadcrumb or state table.
 *
 * §5.2 — "A screen specification describes ONLY THE ZONES IT CHANGES."
 * The corollary here: a screen component renders only its Z5 (and optionally a
 * Z6 rail and a Z7a bar). Everything else comes from the registry.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { ARCHETYPE_SPECS } from '@/atlas/archetypes'
import { COMPLIANCE } from '@/atlas/compliance'
import { screen } from '@/atlas/registry'
import type { ScreenSpec } from '@/atlas/registry'
import { DECLARED_STATES } from '@/atlas/states'
import type { DeclaredState } from '@/atlas/states'
import { Button, Chip, Icon, IconButton, cx } from '@/components/primitives'
import {
  AiOffLine,
  DeniedPanel,
  ErrorFrame,
  LoadingFrame,
  OfflineStrip,
  StaleChip,
} from '@/components/states'
import { StateSwitcher } from '@/components/states'
import type { Patient } from '@/data/kit'
import { NOW, formatDateLong, formatTime } from '@/data/format'
import { useAI } from '@/store/ai'
import { useSession } from '@/store/session'
import { useUI } from '@/store/ui'

import { PatientBanner } from './PatientBanner'

export interface ScreenProps {
  screenId: string
  /** Z3 — supplied where the screen is patient-scoped. */
  patient?: Patient
  /** Extra content inside Z3, e.g. the stroke module's live case-clock strip. */
  bannerExtra?: ReactNode
  /** Z4 — status chips beside the title. */
  chips?: ReactNode
  /** Z4 — secondary actions in the page header. */
  actions?: ReactNode
  /** Z6 — the right rail. 320px, collapsible. */
  rail?: ReactNode
  railTitle?: string
  /** Z7a — the sticky action bar. */
  actionBar?: ReactNode
  /** Which of the 14 states this screen can demonstrate. */
  states?: DeclaredState[]
  /** The skeleton shape for LOADING. */
  loadingShape?: 'list' | 'tiles' | 'form' | 'board' | 'thread'
  /** Rendered when the forced state is EMPTY. */
  empty?: ReactNode
  /** Z5. */
  children: ReactNode
  /** Widen Z5 beyond the default reading measure. */
  wide?: boolean
  /**
   * `minimal` strips Z4 down to a heading and one quiet subline — no
   * breadcrumb, no one-liner, no date chip, no compliance row. The calm
   * screens use it; everything else keeps the specification-forward default.
   */
  headerVariant?: 'default' | 'minimal'
  /** The minimal header's large line. */
  heading?: ReactNode
  /** The minimal header's quiet line. */
  subheading?: ReactNode
  /** Drops the footer spec line, for a screen that must stay quiet. */
  hideSpecLine?: boolean
}

export function Screen({
  screenId,
  patient,
  bannerExtra,
  chips,
  actions,
  rail,
  railTitle = 'Context',
  actionBar,
  states,
  loadingShape = 'list',
  empty,
  children,
  wide,
  headerVariant = 'default',
  heading,
  subheading,
  hideSpecLine,
}: ScreenProps) {
  const spec = screen(screenId)
  const forced = useAI((s) => s.forcedState)
  const forceState = useAI((s) => s.forceState)
  const { theme, density, setTheme, nightPromptDismissed, dismissNightPrompt } = useSession()
  const { railCollapsed, toggleRail } = useUI()

  // A forced state is a per-screen demo affordance, so it clears on navigation
  // rather than following the user around.
  useEffect(() => {
    return () => forceState(null)
  }, [screenId, forceState])

  // Density is declared per screen (§5.4) and applied to the document, since it
  // is a type token that cascades.
  useEffect(() => {
    document.documentElement.dataset.density = spec.density === 'wall' ? 'wall' : density
  }, [spec.density, density])

  /**
   * §6.1 — the Z7b bubble "floats above Z7a" and "NEVER COVERS A PRIMARY
   * ACTION". So the screen publishes whether it has a sticky action bar, and
   * the bubble lifts itself clear of it.
   */
  useEffect(() => {
    document.documentElement.style.setProperty('--z7a-offset', actionBar ? 'var(--spacing-z7)' : '0px')
    return () => document.documentElement.style.setProperty('--z7a-offset', '0px')
  }, [actionBar])

  const archetype = ARCHETYPE_SPECS[spec.archetype]
  const minimal = headerVariant === 'minimal'

  /** These four replace the content entirely; the rest wrap or annotate it. */
  const replacesContent = forced === 'LOADING' || forced === 'EMPTY' || forced === 'ERROR' || forced === 'DENIED'

  /**
   * DENIED is the one state that must not render Z3 either — §1.5 is explicit:
   * "and NO PATIENT DATA ANYWHERE ON SCREEN." A banner showing the patient's
   * name above a refusal panel would defeat the whole rule.
   */
  const showBanner = patient && forced !== 'DENIED'

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showBanner && <PatientBanner patient={patient} extra={bannerExtra} />}

      {forced === 'OFFLINE' && (
        <OfflineStrip
          pendingCount={3}
          works={['Reading the record', 'Typing and drafting', 'Static protocols']}
          queued={['Sign & publish', 'Order placement', 'ABDM publish']}
          blocked={['Live bed state', 'New imaging']}
        />
      )}

      {/* Z4 — page header. */}
      <header
        className={cx(
          'gutter shrink-0',
          // A calm header separates by space, not by a rule.
          minimal ? 'pt-6 pb-1' : 'border-b border-glass-hairline py-3',
        )}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-x-4 gap-y-3">
          {minimal ? (
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{heading ?? spec.name}</h1>
              {subheading && <p className="mt-1 text-[0.95em] text-ink-3">{subheading}</p>}
            </div>
          ) : (
            <div className="min-w-0">
              <nav
                aria-label="Breadcrumb"
                className="mb-1 flex flex-wrap items-center gap-1.5 text-[0.82em] text-ink-3"
              >
                <Link to="/clinician" className="hover:text-ink">
                  My Day
                </Link>
                <Icon name="ChevronRight" size={11} />
                <span className="tabular">{spec.module}</span>
                <Icon name="ChevronRight" size={11} />
                <span className="tabular font-medium text-ink-2">{spec.id}</span>
              </nav>
              <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xl font-semibold tracking-tight">
                {spec.name}
                {chips}
              </h1>
              <p className="mt-0.5 max-w-2xl text-[0.92em] text-ink-3">{spec.oneLiner}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {forced === 'STALE' ? (
              <StaleChip asOf={new Date(NOW.getTime() - 1000 * 60 * 34)} onRefresh={() => forceState(null)} />
            ) : (
              !minimal && (
                <span className="tabular hidden text-[0.86em] text-ink-3 lg:inline">
                  {formatDateLong(NOW)} · {formatTime(NOW)} IST
                </span>
              )
            )}
            {actions}
            <StateSwitcher available={states ?? DECLARED_STATES} compact={minimal} />
          </div>
        </div>

        {/*
          §5.3 makes night mandatory on this screen. The brief is light-by-default
          with an explicit toggle, so the rule is surfaced rather than enforced:
          one line, one click, dismissible, and it never switches underneath you.
        */}
        {spec.nightDefault && theme === 'light' && !nightPromptDismissed && (
          <div className="mx-auto mt-2.5 flex max-w-[1600px] flex-wrap items-center gap-2 rounded-panel bg-glass-fill-muted px-3 py-2">
            <Icon name="Moon" size={14} className="shrink-0 text-ink-3" />
            <p className="min-w-0 flex-1 text-[0.88em] text-ink-2">
              This screen is specified for night use — ICU, radiology reading rooms and stroke calls happen at 03:00.
            </p>
            <Button size="sm" icon="Moon" onClick={() => setTheme('night')}>
              Switch to night
            </Button>
            <IconButton icon="X" label="Dismiss" onClick={dismissNightPrompt} className="size-8" size={13} />
          </div>
        )}

        {/* Compliance obligations this screen carries, stated rather than implied. */}
        {!minimal && spec.compliance && spec.compliance.length > 0 && (
          <div className="mx-auto mt-2 flex max-w-[1600px] flex-wrap items-center gap-1.5">
            {spec.compliance.map((id) => {
              const cmp = COMPLIANCE[id]
              return (
                <Chip
                  key={id}
                  tone={cmp?.critical ? 'caution' : 'neutral'}
                  icon={cmp?.critical ? 'TriangleAlert' : 'ShieldCheck'}
                  title={cmp ? `${cmp.obligation} — ${cmp.consequence}` : id}
                >
                  {id}
                </Chip>
              )
            })}
          </div>
        )}
      </header>

      {/* Z5 + Z6. */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div
          className={cx(
            'gutter mx-auto flex w-full gap-6 py-5',
            wide ? 'max-w-[1600px]' : 'max-w-[1600px]',
            rail && !railCollapsed ? 'lg:flex-row' : 'flex-col',
          )}
        >
          <main className="min-w-0 flex-1">
            {forced === 'AI-OFF' && <AiOffLine className="mb-4" />}

            {replacesContent ? (
              forced === 'LOADING' ? (
                <LoadingFrame shape={loadingShape} />
              ) : forced === 'DENIED' ? (
                <DeniedPanel capability={spec.permission} />
              ) : forced === 'ERROR' ? (
                <ErrorFrame
                  what="That did not save"
                  preserved="Everything you typed"
                  onRetry={() => forceState(null)}
                  onCopyOut={() => forceState(null)}
                />
              ) : (
                (empty ?? (
                  <div className="glass glass-card p-10 text-center text-ink-2">
                    Nothing to show here yet, and the reason is stated on the screen this stands in for.
                  </div>
                ))
              )
            ) : (
              children
            )}
          </main>

          {/* Z6 — 320px right rail, collapsible. */}
          {rail && !replacesContent && (
            <aside
              className={cx(
                'shrink-0',
                railCollapsed ? 'lg:w-12' : 'w-full lg:w-z6',
              )}
            >
              {railCollapsed ? (
                <button
                  type="button"
                  onClick={toggleRail}
                  className="glass sticky top-0 hidden w-12 flex-col items-center gap-2 rounded-card py-3 lg:flex"
                  title={`Show ${railTitle}`}
                >
                  <Icon name="PanelRight" size={16} />
                  <span className="text-[0.72em] [writing-mode:vertical-rl]">{railTitle}</span>
                </button>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">{railTitle}</h2>
                    <IconButton
                      icon="PanelRight"
                      label={`Collapse ${railTitle}`}
                      onClick={toggleRail}
                      className="hidden size-9 lg:inline-flex"
                      size={15}
                    />
                  </div>
                  {rail}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Room for the sticky bar and the bubble. */}
        <div className={cx(actionBar ? 'h-24' : 'h-20', 'sm:h-8')} />
      </div>

      {/* Z7a — sticky action bar. The Z7b bubble floats ABOVE this, never in it. */}
      {actionBar && !replacesContent && (
        <div className="glass-strong sticky bottom-0 z-50 shrink-0 border-t border-glass-hairline max-sm:mb-14">
          <div className="gutter mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 py-3">{actionBar}</div>
        </div>
      )}

      {/* A quiet footer line naming the spec, so a reviewer can trace any frame. */}
      {!hideSpecLine && (
        <p className="gutter shrink-0 pb-3 text-[0.76em] text-ink-3 max-sm:mb-16">
          {spec.id} · {spec.module} · {spec.archetype} {archetype.name} · tier {spec.tier} · density {spec.density} ·
          Z7b {spec.z7b === 'GP-17' ? 'GP-17, no deviation' : `⊘ ${spec.z7b}`}
        </p>
      )}
    </div>
  )
}

/** A convenience for screens whose Z5 is a single card. */
export function ScreenSection({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('min-w-0', className)}>
      {title && (
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[1.05em] font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="text-[0.9em] text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

/** Used by ARC-12 walls, which strip the shell entirely. */
export function useScreenSpec(screenId: string): ScreenSpec {
  return screen(screenId)
}

