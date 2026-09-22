/**
 * S-18-02 · Single-Case Expand View — in place on S-18-01 · T2 · ARC-13
 *
 * "One case, expanded without leaving the wall."
 *
 * It has no route and it is not a modal in the usual sense: it expands over the
 * wall, which is why its Z7b line reads "⊘ absent — rendered within S-18-01".
 * A wall operator who navigates away loses the wall.
 */

import { useNavigate } from 'react-router-dom'

import { ClockRing } from '@/archetypes'
import { Confidence, Diamond } from '@/components/ai'
import { Button, Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { IMAGING_TRIAGE, PAGING_LOG, STROKE_TASKS, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'

import { atRisk, useCaseNow, useLiveIntervals } from './CaseClock'

export function S1802({ caseId, onClose }: { caseId: string | null; onClose: () => void }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const intervals = useLiveIntervals()
  const caseNow = useCaseNow()

  if (!caseId) return null

  const c = strokeCase(caseId)
  const p = patient(c.patientId)
  const blocking = intervals.find(atRisk)
  const acked = PAGING_LOG.filter((x) => x.ackAt).length

  return (
    <div className="fixed inset-0 z-90 overflow-y-auto bg-[rgb(10_14_26/0.55)] backdrop-blur-[3px]">
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="glass-strong glass-card p-5 shadow-glass-lg md:p-7">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="tabular text-lg font-bold tracking-tight md:text-2xl">{c.caseNo}</h2>
              <p className="tabular mt-0.5 text-ink-2 md:text-lg">
                {p.name} · {p.age}/{p.sex} · {c.originFacility} → {c.destinationFacility} · LKW{' '}
                {formatTime(c.lkw)}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2">
                <Chip tone="neutral">{c.payer}</Chip>
                <Chip tone="isolation">NIHSS {c.nihss}</Chip>
                {c.breakGlassBy && (
                  <Chip tone="caution" icon="TriangleAlert">
                    break-glass: {c.breakGlassBy}
                  </Chip>
                )}
              </p>
            </div>
            <Button icon="X" onClick={onClose}>
              Back to the wall
            </Button>
          </header>

          {/* The clocks, larger than on the card. */}
          <section className="mt-6">
            <h3 className="text-[0.86em] font-bold tracking-wider text-ink-3 uppercase">Intervals</h3>
            <div className="mt-3 flex flex-wrap gap-5">
              {intervals.map((i) => (
                <div key={i.key} className="w-24 text-center">
                  <ClockRing
                    label={i.label}
                    elapsedMin={i.elapsed}
                    targetMin={i.targetMin}
                    state={i.state}
                    size={80}
                  />
                  <p className="mt-1 text-[0.74em] leading-tight text-ink-3">{i.label}</p>
                </div>
              ))}
            </div>
          </section>

          {blocking && (
            <div className="mt-5 rounded-panel border border-abnormal/40 bg-abnormal-soft px-4 py-3">
              <p className="flex items-center gap-2 font-bold text-abnormal">
                <Icon name="TriangleAlert" size={17} />
                {blocking.label} projected to breach in {blocking.projectedBreachIn} minutes
              </p>
              <p className="mt-1 text-[0.95em] text-ink-2">
                <strong>Blocking:</strong> {blocking.blockingStep}
              </p>
              <p className="mt-0.5 text-[0.92em] text-ink-2">
                <strong>Next action:</strong> {blocking.nextAction} — owner {blocking.owner}
              </p>
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {aiActive && (
              <Card className="p-4">
                <h3 className="flex items-center gap-2 text-[0.86em] font-bold tracking-wider text-ink-3 uppercase">
                  <Diamond size={10} />
                  Imaging AI
                </h3>
                <dl className="mt-2 divide-y divide-glass-hairline">
                  {IMAGING_TRIAGE.findings.map((f) => (
                    <KeyValue key={f.label} label={f.label}>
                      <span className={f.emphasisNegative ? 'font-bold text-normal' : 'font-semibold'}>{f.value}</span>
                    </KeyValue>
                  ))}
                </dl>
                <p className="tabular mt-2 text-[0.84em] text-ink-3">
                  {IMAGING_TRIAGE.model} · delivered {formatTime(IMAGING_TRIAGE.deliveredAt)} · G3 confirm required
                </p>
                <Confidence band="HIGH" score={0.94} className="mt-2" />
              </Card>
            )}

            <Card className="p-4">
              <h3 className="text-[0.86em] font-bold tracking-wider text-ink-3 uppercase">Team</h3>
              <p className="tabular mt-1.5 text-[0.95em]">
                {acked} of {PAGING_LOG.length} acknowledged
              </p>
              <ul className="mt-2 space-y-1.5">
                {PAGING_LOG.map((x) => (
                  <li key={x.role} className="flex flex-wrap items-center justify-between gap-2 text-[0.9em]">
                    <span className="min-w-0 truncate">
                      {x.role} · <span className="text-ink-3">{x.name}</span>
                    </span>
                    {x.ackAt ? (
                      <Chip tone="normal" icon="Check">
                        {formatTime(x.ackAt)}
                      </Chip>
                    ) : (
                      <Chip tone="abnormal" icon="TriangleAlert">
                        no answer
                      </Chip>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-4 p-4">
            <h3 className="text-[0.86em] font-bold tracking-wider text-ink-3 uppercase">In progress</h3>
            <ul className="mt-2 space-y-1.5">
              {STROKE_TASKS.filter((t) => t.column === 'In progress' || t.column === 'Blocked').map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-[0.92em]">
                  <span className="min-w-0 truncate">
                    {t.label} · <span className="text-ink-3">{t.owner}</span>
                  </span>
                  <Chip tone={t.column === 'Blocked' ? 'abnormal' : 'caution'}>
                    {t.column}
                    {t.dueInMin !== null && ` · ${t.dueInMin}m`}
                  </Chip>
                </li>
              ))}
            </ul>
          </Card>

          <footer className="mt-5 flex flex-wrap gap-2">
            <Button tone="primary" icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
              Open the case clock
            </Button>
            <Button icon="Scan" onClick={() => navigate(`/stroke/case/${c.id}/imaging`)}>
              Imaging
            </Button>
            <Button icon="Syringe" onClick={() => navigate(`/stroke/case/${c.id}/thrombolysis`)}>
              Thrombolysis
            </Button>
            <Button icon="Ambulance" onClick={() => navigate(`/stroke/case/${c.id}/transfer`)}>
              Transfer
            </Button>
            <span className="tabular ml-auto self-center text-[0.84em] text-ink-3">
              server {formatTime(caseNow)}
            </span>
          </footer>
        </div>
      </div>
    </div>
  )
}
