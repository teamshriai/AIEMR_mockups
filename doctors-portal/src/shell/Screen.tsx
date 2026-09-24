/**
 * The per-screen frame. Reads the registry row and composes the zones it
 * declares — so no screen re-derives its own title, density, theme default or
 * state table.
 *
 * §5.2 — "A screen specification describes ONLY THE ZONES IT CHANGES."
 * The corollary here: a screen component renders only its Z5 (and optionally a
 * Z6 rail and a Z7a bar). Everything else comes from the registry.
 *
 * The frame is CALM by construction. The Z4 header is a heading, one quiet
 * line and the actions — no breadcrumb, no atlas one-liner, no compliance
 * chip row, no footer spec line. All of that is still here, folded into one
 * `ⓘ` popover (`ScreenInfo`), because a reviewer needs to trace a frame and a
 * doctor does not. The Z6 rail opens collapsed, because on 43 screens it is
 * reference material, and reference material is one tap away.
 */

import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { ARCHETYPE_SPECS } from '@/atlas/archetypes'
import { COMPLIANCE } from '@/atlas/compliance'
import { screen } from '@/atlas/registry'
import type { ScreenSpec } from '@/atlas/registry'
import { DECLARED_STATES } from '@/atlas/states'
import type { DeclaredState } from '@/atlas/states'
import { SectionTitle } from '@/components/calm'
import { MenuSection, Popover } from '@/components/popover'
import { Chip, Icon, IconButton, cx } from '@/components/primitives'
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
import { NOW } from '@/data/format'
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
  /** Z4 — status chips, rendered on the quiet line under the heading. */
  chips?: ReactNode
  /** Z4 — secondary actions in the page header. */
  actions?: ReactNode
  /** Z6 — the right rail. 320px, opens collapsed. */
  rail?: ReactNode
  railTitle?: string
  /** A count on the collapsed rail tab — "3 suggestions". */
  railBadge?: ReactNode
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
  /** Widen Z5 to the full frame — boards, walls, two-pane editors. */
  wide?: boolean
  /** The large line. Defaults to the registry name. */
  heading?: ReactNode
  /** The quiet line — one line of the counts that matter today. */
  subheading?: ReactNode
}

export function Screen({
  screenId,
  patient,
  bannerExtra,
  chips,
  actions,
  rail,
  railTitle = 'Context',
  railBadge,
  actionBar,
  states,
  loadingShape = 'list',
  empty,
  children,
  wide,
  heading,
  subheading,
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

  /** These four replace the content entirely; the rest wrap or annotate it. */
  const replacesContent = forced === 'LOADING' || forced === 'EMPTY' || forced === 'ERROR' || forced === 'DENIED'

  /**
   * DENIED is the one state that must not render Z3 either — §1.5 is explicit:
   * "and NO PATIENT DATA ANYWHERE ON SCREEN." A banner showing the patient's
   * name above a refusal panel would defeat the whole rule.
   */
  const showBanner = patient && forced !== 'DENIED'

  /** One reading measure for the whole product; boards and editors go wide. */
  const measure = wide ? 'max-w-[1600px]' : 'max-w-6xl'

  return (
    /**
     * `data-screen-id` is how the route walk proves a component mounted rather
     * than falling through to the router's fallback.
     */
    <div data-screen-id={spec.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
      {showBanner && <PatientBanner patient={patient} extra={bannerExtra} />}

      {forced === 'OFFLINE' && (
        <OfflineStrip
          pendingCount={3}
          works={['Reading the record', 'Typing and drafting', 'Static protocols']}
          queued={['Sign', 'Order placement', 'ABDM publish']}
          blocked={['Live bed state', 'New imaging']}
        />
      )}

      {/* Z4 — page header. Separated by space, not by a rule. */}
      <header className="gutter shrink-0 pt-6 pb-1">
        <div className={cx('mx-auto flex flex-wrap items-start justify-between gap-x-4 gap-y-3', measure)}>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{heading ?? spec.name}</h1>
            {(subheading || chips) && (
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.95em] text-ink-3">
                {subheading && <p className="min-w-0">{subheading}</p>}
                {chips && <span className="flex flex-wrap items-center gap-1.5">{chips}</span>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {forced === 'STALE' && (
              <StaleChip asOf={new Date(NOW.getTime() - 1000 * 60 * 34)} onRefresh={() => forceState(null)} />
            )}

            {/*
              §5.3 makes night mandatory on this screen. The brief is light-by-default
              with an explicit toggle, so the rule is surfaced rather than enforced:
              one pill, one click, dismissible, and it never switches underneath you.
            */}
            {spec.nightDefault && theme === 'light' && !nightPromptDismissed && (
              <span className="inline-flex items-center gap-0.5 rounded-pill bg-glass-fill-muted pl-1">
                <button
                  type="button"
                  onClick={() => setTheme('night')}
                  title="This screen is specified for night use — ICU, radiology reading rooms and stroke calls happen at 03:00."
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-pill px-2.5 text-[0.86em] font-medium text-ink-2 hover:bg-glass-fill-hover"
                >
                  <Icon name="Moon" size={13} />
                  Night recommended
                </button>
                <IconButton icon="X" label="Dismiss" onClick={dismissNightPrompt} className="size-8" size={12} />
              </span>
            )}

            {actions}
            <ScreenInfo spec={spec} />
            <StateSwitcher available={states ?? DECLARED_STATES} compact />
          </div>
        </div>
      </header>

      {/* Z5 + Z6. */}
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div
          className={cx(
            /*
              `min-h-full` + the bottom padding (rather than a spacer sibling)
              makes Z5 as tall as the frame, so a screen whose root is `flex-1`
              fills the viewport instead of floating in the top third. The
              padding is what the Z7b bubble, the Z7a bar and the phone tab bar
              need to clear.
            */
            'gutter mx-auto flex min-h-full w-full flex-col gap-6 py-4',
            actionBar ? 'pb-28' : 'pb-24',
            'max-sm:pb-40',
            measure,
            // The rail — open or collapsed to its tab — sits beside Z5 from lg.
            rail ? 'lg:flex-row' : undefined,
          )}
        >
          <main className="flex min-w-0 flex-1 flex-col">
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
                  <div className="glass-strong glass-card p-10 text-center text-ink-2">
                    Nothing to show here yet, and the reason is stated on the screen this stands in for.
                  </div>
                ))
              )
            ) : (
              children
            )}
          </main>

          {/* Z6 — 320px right rail. Opens collapsed; the tab carries a count. */}
          {rail && !replacesContent && (
            <aside className={cx('shrink-0', railCollapsed ? 'lg:w-12' : 'w-full lg:w-z6')}>
              {railCollapsed ? (
                <>
                  <button
                    type="button"
                    onClick={toggleRail}
                    className="glass-strong lift sticky top-0 hidden w-12 flex-col items-center gap-2 rounded-card py-3 lg:flex"
                    title={`Show ${railTitle}`}
                  >
                    <Icon name="PanelRight" size={16} className="text-ink-3" />
                    {railBadge !== undefined && railBadge !== null && (
                      <span className="tabular inline-flex min-h-5 min-w-5 items-center justify-center rounded-pill bg-brand px-1 text-[0.72em] font-bold text-brand-on">
                        {railBadge}
                      </span>
                    )}
                    <span className="text-[0.72em] font-semibold text-ink-3 [writing-mode:vertical-rl]">{railTitle}</span>
                  </button>
                  {/* Below lg the rail has no column of its own, so it opens inline. */}
                  <button
                    type="button"
                    onClick={toggleRail}
                    className="glass-strong mt-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-card px-4 text-[0.9em] font-semibold text-ink-2 lg:hidden"
                  >
                    <span className="flex items-center gap-2">
                      <Icon name="PanelRight" size={15} className="text-ink-3" />
                      {railTitle}
                      {railBadge !== undefined && railBadge !== null && (
                        <span className="tabular inline-flex min-h-5 min-w-5 items-center justify-center rounded-pill bg-brand px-1 text-[0.76em] font-bold text-brand-on">
                          {railBadge}
                        </span>
                      )}
                    </span>
                    <Icon name="ChevronDown" size={14} className="text-ink-3" />
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <SectionTitle
                    title={railTitle}
                    action={
                      <IconButton icon="PanelRight" label={`Collapse ${railTitle}`} onClick={toggleRail} className="size-9" size={15} />
                    }
                  />
                  {rail}
                </div>
              )}
            </aside>
          )}
        </div>

      </div>

      {/* Z7a — sticky action bar. The Z7b bubble floats ABOVE this, never in it. */}
      {actionBar && !replacesContent && (
        <div className="chrome-bar sticky bottom-0 z-50 shrink-0 border-t border-glass-hairline max-sm:mb-14">
          <div className={cx('gutter mx-auto flex flex-wrap items-center gap-3 py-3', measure)}>{actionBar}</div>
        </div>
      )}
    </div>
  )
}

/**
 * The atlas trace for this frame — spec id, archetype, tier, density, the
 * one-liner, the compliance obligations and the Z7b disposition — behind one
 * `ⓘ`. It used to be the header and the footer; now it is a popover.
 */
function ScreenInfo({ spec }: { spec: ScreenSpec }) {
  const archetype = ARCHETYPE_SPECS[spec.archetype]
  return (
    <Popover
      label={`About ${spec.name}`}
      width={340}
      trigger={({ open, toggle }) => (
        <IconButton icon="Info" label="About this screen" onClick={toggle} active={open} className="size-9" size={15} />
      )}
    >
      {() => (
        <>
          <MenuSection title={`${spec.id} · ${spec.module}`}>
            <p className="px-4 pb-2 text-[0.92em] text-ink-2">{spec.oneLiner}</p>
            <dl className="tabular grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-4 pb-2 text-[0.84em] text-ink-3">
              <dt>Archetype</dt>
              <dd className="text-ink-2">
                {spec.archetype} · {archetype.name}
              </dd>
              <dt>Tier</dt>
              <dd className="text-ink-2">
                {spec.tier} · {spec.density}
              </dd>
              <dt>Assistant</dt>
              <dd className="text-ink-2">{spec.z7b === 'GP-17' ? 'GP-17, no deviation' : `⊘ ${spec.z7b}`}</dd>
            </dl>
          </MenuSection>
          {spec.compliance && spec.compliance.length > 0 && (
            <MenuSection title="Compliance obligations">
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
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
            </MenuSection>
          )}
        </>
      )}
    </Popover>
  )
}

/**
 * A section of Z5: the uppercase calm title, a quiet meta line and an action,
 * with the children below. It is NOT a glass card, because its children are
 * usually cards themselves and glass on glass is the thing the brief forbids.
 */
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
        <SectionTitle
          className="mb-3"
          title={title}
          meta={subtitle && <span className="text-[0.88em] text-ink-3">{subtitle}</span>}
          action={action}
        />
      )}
      {children}
    </section>
  )
}

/** Used by ARC-12 walls, which strip the shell entirely. */
export function useScreenSpec(screenId: string): ScreenSpec {
  return screen(screenId)
}
