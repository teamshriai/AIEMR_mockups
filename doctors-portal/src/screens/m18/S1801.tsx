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
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { WallFrame, ClockRing } from '@/archetypes'
import { Diamond } from '@/components/ai'
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
              INS and IKP are unreachable. Their cases are shown with their last-known state and are NOT removed from
              the wall — a case that disappears is a case nobody is watching.
            </p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* The case rail — on a phone, this is the whole screen. */}
          <section>
            <h2 className="mb-2.5 text-[0.9em] font-bold tracking-wider text-ink-3 uppercase md:text-base">
              Active cases ({active.length})
            </h2>
            <div className="space-y-3">
              {active.map((c) => {
                const p = patient(c.patientId)
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setExpanded(c.id)}
                    className="glass glass-card glass-hover block w-full p-4 text-left md:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="tabular text-[0.9em] font-bold tracking-wide md:text-lg">{c.caseNo}</p>
                        {/* "Card faces carry no clinical detail beyond age/sex
                            and the active interval." */}
                        <p className="tabular mt-0.5 text-[0.9em] text-ink-2 md:text-xl">
                          {p.age}/{p.sex} · {c.originFacility} {c.originFacility !== c.destinationFacility && `→ ${c.destinationFacility}`}
                        </p>
                      </div>
                      <Chip tone="isolation" icon="Brain">
                        {c.originFacility === 'INS' ? 'spoke' : 'hub'}
                      </Chip>
                    </div>

                    {/* Per-interval clock rings — the frame's centrepiece. */}
                    <div className="mt-4 flex flex-wrap gap-4 md:gap-6">
                      {intervals
                        .filter((i) => ['d2ct', 'dtn', 'dido', 'groin'].includes(i.key))
                        .map((i) => (
                          <ClockRing
                            key={i.key}
                            label={i.label}
                            elapsedMin={i.elapsed}
                            targetMin={i.targetMin}
                            state={i.state}
                            size={72}
                          />
                        ))}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 md:gap-6">
                      {intervals
                        .filter((i) => ['d2ct', 'dtn', 'dido', 'groin'].includes(i.key))
                        .map((i) => (
                          <span key={i.key} className="w-[72px] text-center text-[0.72em] leading-tight text-ink-3">
                            {i.label}
                          </span>
                        ))}
                    </div>

                    {/* AI-404's finding hides with the AI off; the clocks do not. */}
                    {aiActive && (
                      <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.92em] font-semibold text-isolation md:text-lg">
                        <Diamond size={11} />
                        AI-404 · LVO {IMAGING_TRIAGE.findings[1].value} · HIGH
                      </p>
                    )}

                    <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.9em] md:text-lg">
                      <span className="text-ink-3">next:</span>
                      <span className="font-semibold">
                        {(intervals.find(atRisk) ?? intervals.find((i) => i.state === 'RUNNING'))?.nextAction ?? '—'}
                      </span>
                      <span className="text-ink-3">
                        owner {(intervals.find(atRisk) ?? intervals.find((i) => i.state === 'RUNNING'))?.owner ?? '—'}
                      </span>
                    </p>
                  </button>
                )
              })}

              {deactivated.map((c) => (
                <div key={c.id} className="glass-muted rounded-card p-4 opacity-70">
                  <p className="tabular text-[0.9em] font-bold md:text-base">{c.caseNo}</p>
                  <p className="mt-0.5 text-[0.88em] text-ink-3 md:text-base">
                    {c.originFacility} · de-activated · {c.deactivationReason}
                  </p>
                </div>
              ))}

              {active.length === 0 && (
                /* The quiet state is still informative. */
                <Card className="p-6 text-center">
                  <p className="text-lg font-semibold">No active stroke cases</p>
                  <p className="tabular mt-2 text-ink-2">
                    {NETWORK_TODAY.activations} activations today · DTN median {NETWORK_TODAY.dtnMedianMin} min ·{' '}
                    {NETWORK_TODAY.mimics} mimic de-activated
                  </p>
                </Card>
              )}
            </div>
          </section>

          {/* The network map and the resource strip — secondary on a phone. */}
          <div className="space-y-4">
            <Card className="p-4 md:p-5">
              <h2 className="text-[0.9em] font-bold tracking-wider text-ink-3 uppercase">Network</h2>
              <ul className="mt-3 space-y-2.5">
                {NETWORK_SITES.map((s) => (
                  <li
                    key={s.code}
                    className={cx(
                      'flex flex-wrap items-center justify-between gap-2 rounded-panel px-3 py-2.5',
                      active.some((c) => c.originFacility === s.code)
                        ? 'bg-isolation-soft'
                        : 'bg-glass-fill-muted',
                    )}
                  >
                    <span className="min-w-0">
                      <span className="tabular block font-bold md:text-lg">
                        {s.code}
                        {active.some((c) => c.originFacility === s.code) && (
                          <span className="ml-2 text-[0.8em] font-semibold text-isolation">← active</span>
                        )}
                      </span>
                      <span className="block truncate text-[0.86em] text-ink-3 md:text-base">
                        {s.role} · {s.neurologist}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <Chip tone={s.ctStatus === 'free' ? 'normal' : s.ctStatus === 'none' ? 'inactive' : 'caution'}>
                        CT {s.ctStatus}
                      </Chip>
                      <span className="tabular text-[0.82em] text-ink-3">
                        beds {s.strokeBeds.free}/{s.strokeBeds.total}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4 md:p-5">
              <h2 className="text-[0.9em] font-bold tracking-wider text-ink-3 uppercase">Resources</h2>
              <dl className="mt-3 space-y-2">
                {[
                  { label: 'CATH-1', value: 'free', tone: 'normal' as const },
                  { label: 'CT at AWF', value: 'free', tone: 'normal' as const },
                  { label: 'Stroke beds', value: '2 of 4', tone: 'caution' as const },
                  { label: 'On call', value: 'Dr R. Desai (phone)', tone: 'neutral' as const },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-3">
                    <dt className="text-[0.92em] text-ink-2 md:text-lg">{r.label}</dt>
                    <dd>
                      <Chip tone={r.tone}>{r.value}</Chip>
                    </dd>
                  </div>
                ))}
              </dl>

              {INBOUND_AMBULANCES.map((a) => (
                <div key={a.id} className="mt-3 rounded-panel bg-caution-soft px-3 py-2.5">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-caution md:text-lg">
                    <Icon name="Ambulance" size={16} />
                    {a.id} · ETA {a.etaMinutes} min → {a.to}
                    {aiActive && <Diamond size={9} />}
                  </p>
                  <p className="mt-0.5 text-[0.86em] text-ink-2">{a.note}</p>
                </div>
              ))}
            </Card>

            <Card className="p-4 md:p-5">
              <h2 className="text-[0.9em] font-bold tracking-wider text-ink-3 uppercase">Today</h2>
              <p className="tabular mt-2 md:text-lg">
                {NETWORK_TODAY.activations} activations · DTN median {NETWORK_TODAY.dtnMedianMin} min ·{' '}
                {NETWORK_TODAY.transfers} transfer · {NETWORK_TODAY.mimics} mimic
              </p>
              {!aiActive && (
                <p className="mt-2 flex items-start gap-2 text-[0.86em] text-ink-3">
                  <Icon name="CircleDot" size={13} className="mt-0.5 shrink-0" />
                  AI findings are hidden. Clocks, targets and resource state are unaffected — none of them are
                  AI-derived.
                </p>
              )}
            </Card>

            <p className="flex items-start gap-2 px-1 text-[0.8em] text-ink-3">
              <Icon name="Info" size={12} className="mt-0.5 shrink-0" />
              A wall has no operator at it, so this screen carries no input affordances and no assistant bubble. Read-only,
              auto-refreshing every 5 seconds, no motion beyond a value change.
            </p>
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
