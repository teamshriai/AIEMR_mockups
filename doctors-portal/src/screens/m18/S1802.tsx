/**
 * S-18-02 · Single-Case Expand View — in place on S-18-01 · T2 · ARC-13
 *
 * "One case, expanded without leaving the wall."
 *
 * It has no route and it is not a modal in the usual sense: it expands over the
 * wall, which is why its Z7b line reads "⊘ absent — rendered within S-18-01".
 * A wall operator who navigates away loses the wall.
 *
 * Calm pass: the three live intervals in full, the completed ones one tap away;
 * imaging and team each reduced to the one line the wall operator needs, with
 * the screen that owns the detail linked from it.
 */

import { useNavigate } from 'react-router-dom'

import { ClockRing } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { Disclosure, PillLink } from '@/components/calm'
import { Button, Chip, Icon } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { IMAGING_TRIAGE, PAGING_LOG, STROKE_TASKS, strokeCase } from '@/data/stroke'
import { triageHeadline } from '@/data/strokeai'
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
  const live = intervals.filter((i) => i.state !== 'DONE')
  const done = intervals.filter((i) => i.state === 'DONE')
  const acked = PAGING_LOG.filter((x) => x.ackAt).length
  const inProgress = STROKE_TASKS.filter((t) => t.column === 'In progress' || t.column === 'Blocked')

  const lvo = IMAGING_TRIAGE.findings.find((f) => f.label === 'LVO')
  const ich = IMAGING_TRIAGE.findings.find((f) => f.label === 'ICH')

  const ring = (i: (typeof intervals)[number], size: number) => (
    <div key={i.key} className="flex w-24 flex-col items-center text-center">
      <ClockRing label={i.label} elapsedMin={i.elapsed} targetMin={i.targetMin} state={i.state} size={size} />
      <p className="mt-1 text-[0.74em] leading-tight text-ink-3">{i.label}</p>
    </div>
  )

  return (
    <div className="fixed inset-0 z-90 overflow-y-auto bg-[rgb(10_14_26/0.55)] backdrop-blur-[4px]">
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        <div className="overlay-surface glass-card p-5 md:p-7">
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

          {/* The live clocks, larger than on the card. Completed ones fold. */}
          <section className="mt-6">
            <h3 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">Live intervals</h3>
            <div className="mt-3 flex flex-wrap gap-5">{live.map((i) => ring(i, 80))}</div>
            {done.length > 0 && (
              <Disclosure label="all intervals" count={intervals.length} className="mt-3">
                <div className="flex flex-wrap gap-4 px-1 pt-1">{done.map((i) => ring(i, 64))}</div>
              </Disclosure>
            )}
          </section>

          {/* The one operative alert: what is about to breach, and who moves it. */}
          {blocking && (
            <div className="mt-5 rounded-panel border border-abnormal/40 bg-abnormal-soft px-4 py-3">
              <p className="flex items-center gap-2 font-bold text-abnormal">
                <Icon name="TriangleAlert" size={17} />
                {blocking.label}{' '}
                {blocking.state === 'BREACH'
                  ? `past its ${blocking.targetMin}-minute target`
                  : `projected to breach in ${blocking.projectedBreachIn} minutes`}
              </p>
              <p className="mt-1 text-[0.95em] text-ink-2">
                <strong>Blocking:</strong> {blocking.blockingStep}
              </p>
              <p className="mt-0.5 text-[0.92em] text-ink-2">
                <strong>Next action:</strong> {blocking.nextAction} — owner {blocking.owner}
              </p>
            </div>
          )}

          {/* Imaging and team, one line each, each linking to the screen that owns it. */}
          <ul className="mt-5 divide-y divide-glass-hairline rounded-panel bg-glass-fill-muted">
            {aiActive && !c.imaging.lvo && (
              <li className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="flex items-center gap-2 text-[0.95em]">
                  <Diamond size={10} />
                  <span className="font-semibold">{triageHeadline(c)}</span>
                  <span className="text-[0.86em] text-ink-3">· G3 confirm required</span>
                </span>
                <PillLink to={`/stroke/case/${c.id}/imaging`}>Imaging</PillLink>
              </li>
            )}
            {aiActive && c.imaging.lvo && lvo && ich && (
              <li className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="flex items-center gap-2 text-[0.95em]">
                  <Diamond size={10} />
                  <span className="font-semibold">LVO · {lvo.value.replace('LEFT ', '')}</span>
                  <span className="text-ink-3">·</span>
                  <span className={ich.emphasisNegative ? 'font-semibold text-normal' : ''}>
                    ICH {ich.value.toLowerCase()}
                  </span>
                  <span className="text-[0.86em] text-ink-3">· G3 confirm required</span>
                </span>
                <PillLink to={`/stroke/case/${c.id}/imaging`}>Imaging</PillLink>
              </li>
            )}
            <li className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-4 py-2">
              <span className="tabular flex items-center gap-2 text-[0.95em]">
                <Icon name="Users" size={14} className="text-ink-3" />
                <span className="font-semibold">
                  {acked} of {PAGING_LOG.length} answered
                </span>
                {acked < PAGING_LOG.length && (
                  <Chip tone="abnormal" icon="TriangleAlert">
                    {PAGING_LOG.length - acked} no answer
                  </Chip>
                )}
              </span>
              <PillLink to={`/stroke/case/${c.id}/team`}>Team</PillLink>
            </li>
          </ul>

          {/* What is moving right now. */}
          <section className="mt-5">
            <h3 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">In progress</h3>
            <ul className="mt-2 divide-y divide-glass-hairline">
              {inProgress.map((t) => (
                <li key={t.id} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2 text-[0.92em]">
                  <span className="min-w-0 truncate">
                    {t.label} · <span className="text-ink-3">{t.owner}</span>
                  </span>
                  <Chip
                    tone={t.column === 'Blocked' ? 'abnormal' : 'caution'}
                    icon={t.column === 'Blocked' ? 'Ban' : 'Timer'}
                  >
                    {t.column}
                    {t.dueInMin !== null && ` · ${t.dueInMin}m`}
                  </Chip>
                </li>
              ))}
            </ul>
          </section>

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
            <span className="tabular ml-auto self-center text-[0.84em] text-ink-3">server {formatTime(caseNow)}</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
