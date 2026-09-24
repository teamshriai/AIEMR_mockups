/**
 * S-18-01 · Stroke Network Command Wall — `/stroke/wall` · T1 · ARC-12
 *
 * "The network, live, on a wall and on a phone."
 *
 * Deck beat #17 — "Now the part nobody else will show you."
 *
 * ARC-12 strips the shell: "Z5 ONLY. No Z1, no Z2, no input affordances, no
 * Z7b bubble. Read at 3-4 metres, runs unattended for a shift." The atlas is
 * equally clear about the other end of the range: "<768 PHONE-FIRST: the case
 * rail only, tap to expand, clock ring large", because P-35 and P-37 read this
 * at 02:00 on a phone.
 *
 * Two behaviours matter more than the layout:
 *   STALE — "past 2× the 5s refresh the wall DIMS and states its last-good time
 *   in large type. A wall showing confidently wrong data is worse than one
 *   showing none."
 *   AI-OFF — "clocks, targets and resource state are UNAFFECTED — none of them
 *   are AI-derived."
 *
 * Calm pass: one label per ring (the ring itself only prints its state word);
 * de-activated cases fold behind a disclosure; the Resources card no longer
 * repeats the bed and CT figures the Network card already carries.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { WallFrame, ClockRing } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { CountPill, Disclosure, SectionCard } from '@/components/calm'
import { Card, Chip, Icon, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import {
  IMAGING_TRIAGE,
  INBOUND_AMBULANCES,
  NETWORK_SITES,
  NETWORK_TODAY,
  STROKE_CASES,
} from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'

import { atRisk, CaseClockStrip, useCaseClock, useLiveIntervals } from './CaseClock'
import { S1802 } from './S1802'

const WALL_RINGS = ['d2ct', 'dtn', 'dido', 'groin']

/** The short name a ring wears on the wall — readable at 3–4 m. */
function ringLabel(key: string): string {
  switch (key) {
    case 'd2ct':
      return 'D2CT'
    case 'dtn':
      return 'DTN'
    case 'dido':
      return 'DIDO'
    case 'groin':
      return 'GROIN'
    default:
      return key.toUpperCase()
  }
}

export function S1801() {
  const navigate = useNavigate()
  const caseNow = useCaseClock()
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)
  const intervals = useLiveIntervals()
  const [expanded, setExpanded] = useState<string | null>(null)

  const stale = forced === 'STALE'
  const offline = forced === 'OFFLINE'
  const active = STROKE_CASES.filter((c) => c.status === 'active')
  const deactivated = STROKE_CASES.filter((c) => c.status === 'de-activated')
  const next = intervals.find(atRisk) ?? intervals.find((i) => i.state === 'RUNNING')

  return (
    <>
      <WallFrame
        title="Stroke network"
        asOf={`${formatTime(caseNow)}:${String(caseNow.getSeconds()).padStart(2, '0')} IST`}
        stale={stale}
        onExit={() => navigate('/clinician')}
      >
        {/* OFFLINE declares the partition and names the unreachable sites. It
            never silently drops a case. */}
        {offline && (
          <div className="mb-5 rounded-card border border-abnormal/40 bg-abnormal-soft px-5 py-4">
            <p className="flex items-center gap-2 text-lg font-bold text-abnormal md:text-2xl">
              <Icon name="WifiOff" size={22} />
              Network partition
            </p>
            <p className="mt-1 text-[0.95em] text-ink-2 md:text-lg">
              IPL and IUD are unreachable. Their cases are shown with their last-known state and are NOT removed from
              the wall — a case that disappears is a case nobody is watching.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* The case rail — on a phone, this is the whole screen. */}
          <section>
            <h2 className="mb-2.5 flex items-center gap-2.5 text-[0.9em] font-bold tracking-wider text-ink-3 uppercase md:text-base">
              Active cases
              <CountPill tone={active.length > 0 ? 'brand' : 'neutral'}>{active.length}</CountPill>
            </h2>
            <div className="space-y-3">
              {active.map((c) => {
                const p = patient(c.patientId)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setExpanded(c.id)}
                    className="glass-strong lift block min-h-11 w-full rounded-card p-4 text-left md:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="tabular text-[0.9em] font-bold tracking-wide md:text-lg">{c.caseNo}</p>
                        {/* "Card faces carry no clinical detail beyond age/sex
                            and the active interval." */}
                        <p className="tabular mt-0.5 text-[0.9em] text-ink-2 md:text-xl">
                          {p.age}/{p.sex} · {c.originFacility}{' '}
                          {c.originFacility !== c.destinationFacility && `→ ${c.destinationFacility}`}
                        </p>
                      </div>
                      <Chip tone="isolation" icon="Brain">
                        {c.originFacility === 'IPL' ? 'spoke' : 'hub'}
                      </Chip>
                    </div>

                    {/* Per-interval clock rings — the frame's centrepiece. One
                        short name under each; the ring prints its own state. */}
                    <div className="mt-4 flex flex-wrap gap-4 md:gap-6">
                      {intervals
                        .filter((i) => WALL_RINGS.includes(i.key))
                        .map((i) => (
                          <div key={i.key} className="flex w-[72px] flex-col items-center">
                            <ClockRing
                              label={i.label}
                              elapsedMin={i.elapsed}
                              targetMin={i.targetMin}
                              state={i.state}
                              size={72}
                            />
                            <span className="tabular mt-0.5 text-[0.74em] font-semibold tracking-wide text-ink-3">
                              {ringLabel(i.key)}
                            </span>
                          </div>
                        ))}
                    </div>

                    {/* AI-404's finding hides with the AI off; the clocks do not. */}
                    {aiActive && (
                      <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.92em] font-semibold text-isolation md:text-lg">
                        <Diamond size={11} />
                        LVO {IMAGING_TRIAGE.findings[1].value} · HIGH
                      </p>
                    )}

                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.9em] md:text-lg">
                      <span className="text-ink-3">next:</span>
                      <span className="font-semibold">{next?.nextAction ?? '—'}</span>
                      <span className="text-ink-3">· {next?.owner ?? '—'}</span>
                    </p>
                  </button>
                )
              })}

              {active.length === 0 && (
                /* The quiet state is still informative. */
                <Card strong className="p-6 text-center">
                  <p className="text-lg font-semibold">No active stroke cases</p>
                  <p className="tabular mt-2 text-ink-2">
                    {NETWORK_TODAY.activations} activations today · DTN median {NETWORK_TODAY.dtnMedianMin} min ·{' '}
                    {NETWORK_TODAY.mimics} mimic de-activated
                  </p>
                </Card>
              )}

              {/* A de-activated case keeps its record; the wall keeps it one tap away. */}
              {deactivated.length > 0 && (
                <Disclosure label="de-activated" count={deactivated.length}>
                  <ul className="space-y-2">
                    {deactivated.map((c) => (
                      <li key={c.id} className="rounded-card bg-glass-fill-muted p-4 opacity-80">
                        <p className="tabular text-[0.9em] font-bold md:text-base">{c.caseNo}</p>
                        <p className="mt-0.5 text-[0.88em] text-ink-3 md:text-base">
                          {c.originFacility} · {c.deactivationReason}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Disclosure>
              )}
            </div>
          </section>

          {/* The network map and the resource strip — secondary on a phone. */}
          <div className="space-y-4">
            <SectionCard title="Network" meta={<CountPill>{NETWORK_SITES.length} sites</CountPill>}>
              <ul className="space-y-2">
                {NETWORK_SITES.map((s) => {
                  const live = active.some((c) => c.originFacility === s.code)
                  return (
                    <li
                      key={s.code}
                      className={cx(
                        'flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-panel px-3 py-2.5',
                        live ? 'bg-isolation-soft' : 'bg-glass-fill-muted',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="tabular block font-bold md:text-lg">
                          {s.code}
                          {live && <span className="ml-2 text-[0.8em] font-semibold text-isolation">← active</span>}
                        </span>
                        <span className="block truncate text-[0.86em] text-ink-3 md:text-base">
                          {s.role} · {s.neurologist}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <Chip
                          tone={s.ctStatus === 'free' ? 'normal' : s.ctStatus === 'none' ? 'inactive' : 'caution'}
                          icon={s.ctStatus === 'none' ? 'Ban' : 'Scan'}
                        >
                          CT {s.ctStatus}
                        </Chip>
                        <span className="tabular text-[0.82em] text-ink-3">
                          beds {s.strokeBeds.free}/{s.strokeBeds.total}
                        </span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>

            {/* Only what the Network card does not already say: the cath lab,
                who is on call, and anything on the road. */}
            <SectionCard title="Resources">
              <dl className="space-y-1 px-1">
                {[
                  { label: 'CATH-1', value: 'free', tone: 'normal' as const, icon: 'Check' },
                  { label: 'On call', value: 'Dr R. Desai (phone)', tone: 'neutral' as const, icon: 'Phone' },
                ].map((r) => (
                  <div key={r.label} className="flex min-h-9 items-center justify-between gap-3">
                    <dt className="text-[0.92em] text-ink-2 md:text-lg">{r.label}</dt>
                    <dd>
                      <Chip tone={r.tone} icon={r.icon}>
                        {r.value}
                      </Chip>
                    </dd>
                  </div>
                ))}
              </dl>

              {INBOUND_AMBULANCES.map((a) => (
                <div key={a.id} className="mt-2 rounded-panel bg-caution-soft px-3 py-2.5">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-caution md:text-lg">
                    <Icon name="Ambulance" size={16} />
                    {a.id} · ETA {a.etaMinutes} min → {a.to}
                  </p>
                  <p className="mt-0.5 text-[0.86em] text-ink-2">{a.note}</p>
                </div>
              ))}
            </SectionCard>

            <SectionCard title="Today" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
              <p className="tabular md:text-lg">
                {NETWORK_TODAY.activations} activations · DTN median {NETWORK_TODAY.dtnMedianMin} min ·{' '}
                {NETWORK_TODAY.transfers} transfer · {NETWORK_TODAY.mimics} mimic
              </p>
              {!aiActive && (
                <p className="mt-2 flex items-center gap-2 text-[0.86em] text-ink-3">
                  <Icon name="CircleDot" size={13} className="shrink-0" />
                  AI findings hidden · clocks and resources unaffected
                </p>
              )}
            </SectionCard>
          </div>
        </div>
      </WallFrame>

      {/* S-18-02 expands in place, without leaving the wall. */}
      <S1802 caseId={expanded} onClose={() => setExpanded(null)} />
    </>
  )
}

/** Exported so the module's other screens can reuse the strip. */
export { CaseClockStrip }
