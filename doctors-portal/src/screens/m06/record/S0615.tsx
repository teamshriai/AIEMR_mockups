/**
 * S-06-15 · Current condition — `/patient/:id/condition` · T2 · ARC-02
 *
 * "How the patient is now — status, what to watch, and the AI read of the
 * record."
 *
 * The status word comes first because it is what a colleague asks: "how is
 * she?" Then the few things to watch, the problem list, the latest
 * observations, and — clearly marked as the model's — the AI read with what
 * drove it.
 */

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { CountPill, SectionCard } from '@/components/calm'
import { Chip, ClinicalFlag, EmptyState, Icon, cx } from '@/components/primitives'
import { RISK_STRIPS, VITALS, problemsFor } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { conditionFor } from '@/data/record'
import { selectAiActive, useAI } from '@/store/ai'

import { RecordScreen, STATUS_TONE } from './shared'

export function S0615({ id }: { id?: string }) {
  return (
    <RecordScreen id={id} section="condition">
      {(p) => <Condition patient={p} />}
    </RecordScreen>
  )
}

function Condition({ patient: p }: { patient: Patient }) {
  const aiActive = useAI(selectAiActive)
  const c = conditionFor(p.id)
  const problems = problemsFor(p.id)
  const vitals = VITALS[p.id] ?? []
  const risk = RISK_STRIPS[p.id]

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="min-w-0 space-y-5">
        <SectionCard
          title="How they are now"
          meta={c && <Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip>}
          bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
        >
          {c ? (
            <>
              <p className="text-lg font-semibold tracking-tight">{c.headline}</p>
              <p className="mt-1.5 leading-relaxed text-ink-2">{c.summary}</p>
              <p className="tabular mt-2 text-[0.86em] text-ink-3">
                Updated {formatDate(c.updatedAt)} {formatTime(c.updatedAt)} · {c.updatedBy}
              </p>
            </>
          ) : (
            <p className="text-ink-2">No condition summary has been written for {p.name} yet.</p>
          )}
        </SectionCard>

        {c && c.watch.length > 0 && (
          <SectionCard title="What to watch" meta={<CountPill>{c.watch.length}</CountPill>}>
            <ul className="divide-y divide-glass-hairline">
              {c.watch.map((w, i) => (
                <li key={w} className="flex items-start gap-3 px-2 py-2.5 sm:px-3">
                  <span
                    className={cx(
                      'tabular grid size-6 shrink-0 place-items-center rounded-pill text-[0.78em] font-bold',
                      i === 0 ? 'bg-pri-warning-soft text-pri-warning-ink' : 'bg-glass-inset text-ink-2',
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-ink-2">{w}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        <SectionCard title="Problem list" meta={<CountPill>{problems.length}</CountPill>}>
          {problems.length === 0 ? (
            <EmptyState icon="ClipboardList" why="No problems are coded on this record yet." />
          ) : (
            <ul className="divide-y divide-glass-hairline">
              {problems.map((pr) => (
                <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2.5 sm:px-3">
                  <span className="min-w-0">
                    <span className="font-medium">{pr.label}</span>
                    <span className="tabular block text-[0.86em] text-ink-3">
                      ICD-10 {pr.icd10} · since {pr.onset}
                    </span>
                  </span>
                  <Chip tone={pr.status === 'Open' ? 'brand' : 'inactive'}>{pr.status}</Chip>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="min-w-0 space-y-5">
        {aiActive && c && (
          <SectionCard
            title={
              <span className="flex items-center gap-2">
                <Diamond size={10} /> AI read of the record
              </span>
            }
            tone="ai"
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <p className="leading-relaxed">{c.ai.text}</p>
            <ul className="mt-3 space-y-1.5">
              {c.ai.drivers.map((d) => (
                <li key={d} className="flex items-start gap-2 text-[0.92em] text-ink-2">
                  <Icon name="CornerDownRight" size={13} className="mt-1 shrink-0 text-ink-3" />
                  {d}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Confidence band={c.ai.band} />
              <WhyLink
                target={{
                  touchpointId: `condition-${p.id}`,
                  capabilityId: 'AI-105',
                  claim: c.ai.text,
                  confidence: c.ai.band === 'HIGH' ? 0.9 : c.ai.band === 'MED' ? 0.72 : 0.45,
                  band: c.ai.band,
                  computedAt: formatTime(c.updatedAt),
                  inputs: [
                    { label: 'Results, observations and notes on the record', source: `${p.uhid} record` },
                    { label: 'Problem list', source: `${problems.length} coded problems` },
                  ],
                  evidence: c.ai.drivers,
                  model: c.ai.model,
                  limits: [
                    'Summarises what is charted — anything not written down is invisible to it.',
                    'It describes the record; the clinical judgement is yours.',
                  ],
                }}
              />
            </div>
          </SectionCard>
        )}

        {risk && aiActive && (
          <SectionCard title="Deterioration risk" tone="ai" meta={<Chip tone={risk.band === 'HIGH' ? 'abnormal' : risk.band === 'MODERATE' ? 'caution' : 'normal'}>{risk.band}</Chip>} bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className="tabular font-semibold">
              {risk.score} <span className="font-normal text-ink-3">· {risk.trend}</span>
            </p>
            <ul className="mt-2 space-y-1.5">
              {risk.drivers.map((d) => (
                <li key={d.label} className="flex items-center gap-2 text-[0.92em] text-ink-2">
                  <Icon name={d.direction === 'up' ? 'ArrowUp' : 'ArrowDown'} size={13} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">{d.label}</span>
                  <span className="tabular text-ink-3">{Math.round(d.weight * 100)}%</span>
                </li>
              ))}
            </ul>
            <p className="tabular mt-2 text-[0.84em] text-ink-3">
              {risk.modelVersion} · {formatTime(risk.computedAt)}
            </p>
          </SectionCard>
        )}

        <SectionCard title="Latest observations" meta={vitals[0] && <span className="tabular text-[0.86em] text-ink-3">{formatDate(vitals[0].at)} {formatTime(vitals[0].at)}</span>}>
          {vitals.length === 0 ? (
            <EmptyState icon="Activity" why="No observations have been charted for this patient in this record." />
          ) : (
            <dl className="divide-y divide-glass-hairline">
              {vitals.map((v) => (
                <div key={v.label} className="flex flex-wrap items-center justify-between gap-2 px-2 py-2.5 sm:px-3">
                  <dt className="text-ink-2">{v.label}</dt>
                  <dd className="flex items-center gap-2">
                    <span className="tabular font-semibold">{v.value}</span>
                    {v.flag !== 'Normal' && <ClinicalFlag flag={v.flag} />}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
