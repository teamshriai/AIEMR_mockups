/**
 * S-18-21 · Stroke-AI Console — `/stroke/ai-console` · T1 · ARC-11
 *
 * "The scan, the reading, and the decision it unlocks — on one surface."
 *
 * This is the screen the Stroke-AI platform exists to produce: a real
 * non-contrast head CT beside the model's reading of it, with the clinical
 * report underneath and a clinician's signature between the reading and any
 * treatment. It replaces the Stroke Centre entry in the nav.
 *
 * Three things are load-bearing and are not styling:
 *
 *   THE PIXELS ARE REAL. The slices are an imported head-CT study, windowed
 *   W 80 / L 40 at build time. The findings beside them are derived from that
 *   study's own ground-truth labels, so a study with blood in it reports
 *   haemorrhage and flips the thrombolysis card to contraindicated without a
 *   word of copy changing.
 *
 *   THE UNMARKED IMAGE IS ONE CONTROL AWAY. AIP-04. An overlay a reader cannot
 *   remove is a finding they cannot disagree with.
 *
 *   G3. AI-404 prioritises and notifies. It never diagnoses, and the reading
 *   enters the record only over a clinician's signature.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AIActionBar, Confidence } from '@/components/ai'
import { CountPill, Disclosure, SectionCard, Why } from '@/components/calm'
import { NcctViewer } from '@/components/ncct'
import { Button, Chip, Icon, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import {
  DECISION_SUPPORT_NOTICE,
  casesWithImaging,
  ncctFindings,
  overlaysFor,
  studyFor,
  triageVerdict,
} from '@/data/strokeai'
import { IMAGING_TRIAGE, STROKE_NOW } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

import { StrokeAIReport } from './StrokeAIReport'

export function S1821() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const cases = casesWithImaging()
  const [selectedId, setSelectedId] = useState(cases.find((c) => c.status === 'active')?.id ?? cases[0]?.id)

  const current = cases.find((c) => c.id === selectedId) ?? cases[0]
  const study = current ? studyFor(current.id) : undefined
  const truth = study?.truth
  const findings = truth ? ncctFindings(truth) : []
  const verdict = truth && current ? triageVerdict(truth, current) : undefined
  const active = cases.filter((c) => c.status === 'active').length

  if (!current || !study || !truth || !verdict) {
    return (
      <Screen screenId="S-18-21" heading="Stroke-AI Console" subheading="No imaged case is open.">
        <SectionCard title="Nothing to read" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
          <p className="text-ink-2">
            No stroke case currently has an imported study. A code stroke with a completed scan appears here within
            seconds of reconstruction.
          </p>
        </SectionCard>
      </Screen>
    )
  }

  const p = patient(current.patientId)

  /** Scan to reading, as a clinician would say it: "4 min 00 s". */
  const readSeconds = Math.round(
    (IMAGING_TRIAGE.deliveredAt.getTime() - IMAGING_TRIAGE.acquiredAt.getTime()) / 1000,
  )
  const readTime = `${Math.floor(readSeconds / 60)} min ${String(readSeconds % 60).padStart(2, '0')} s`

  return (
    <Screen
      screenId="S-18-21"
      wide
      heading="Stroke-AI Console"
      subheading={
        <>
          {cases.length} imaged {cases.length === 1 ? 'case' : 'cases'} · {active} active · reading delivered{' '}
          {formatTime(IMAGING_TRIAGE.deliveredAt)}
        </>
      }
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-LOW']}
      actions={
        <Button icon="Network" onClick={() => navigate('/stroke/wall')}>
          Command wall
        </Button>
      }
    >
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,4fr)_minmax(0,9fr)]">
        {/* The cases with a study behind them. Active first. */}
        <SectionCard title="Cases" meta={<CountPill tone={active > 0 ? 'critical' : 'neutral'}>{active} active</CountPill>}>
          <ul className="divide-y divide-glass-hairline">
            {cases.map((c) => {
              const cp = patient(c.patientId)
              const isOpen = c.id === current.id
              const live = c.status === 'active'
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(c.id)}
                    aria-current={isOpen}
                    className={cx(
                      'flex min-h-16 w-full items-center gap-3 rounded-panel px-3 py-3 text-left transition-colors',
                      isOpen ? 'bg-brand-soft' : 'hover:bg-glass-fill-hover',
                    )}
                  >
                    <span
                      className={cx(
                        'grid size-9 shrink-0 place-items-center rounded-field',
                        live ? 'bg-pri-critical-soft text-pri-critical-ink' : 'bg-glass-inset text-ink-3',
                      )}
                    >
                      <Icon name="Brain" size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold tracking-tight">{cp.name}</span>
                      <span className={cx('tabular block truncate text-[0.86em]', isOpen ? 'text-ink-2' : 'text-ink-3')}>
                        {c.id} · {cp.age}/{cp.sex} · NIHSS {c.nihss}
                      </span>
                    </span>
                    <Chip tone={live ? 'critical' : 'inactive'} icon={live ? 'Siren' : 'CircleSlash'}>
                      {live ? 'Active' : 'Stood down'}
                    </Chip>
                  </button>
                </li>
              )
            })}
          </ul>
        </SectionCard>

        <div className="min-w-0 space-y-5">
          {/* The verdict, stated once and in one line. */}
          <SectionCard
            title="AI triage verdict"
            accent={verdict.tone === 'critical' ? 'critical' : undefined}
            meta={
              <span className="tabular inline-flex min-h-6 items-center gap-1.5 rounded-pill bg-pri-critical-fill px-2.5 text-[0.8em] font-bold text-pri-on-critical">
                {verdict.priority} · {verdict.priorityWord}
              </span>
            }
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <p className="text-[1.15em] font-bold tracking-tight">{verdict.headline}</p>
            <p className="mt-1 text-ink-2">{verdict.detail}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {verdict.chips.map((c) => (
                <Chip key={c} tone={c.includes('NEGATIVE') || c.includes('NO ') ? 'normal' : 'critical'}>
                  {c}
                </Chip>
              ))}
            </div>
          </SectionCard>

          {/* The scan and its reading, side by side. */}
          <SectionCard
            title="Non-contrast CT"
            meta={
              <span className="tabular text-[0.86em] text-ink-3">
                {p.name} · acquired {formatTime(IMAGING_TRIAGE.acquiredAt)}
              </span>
            }
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <NcctViewer study={study} overlays={aiActive ? overlaysFor(current.id, truth) : []} />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">AI findings</h3>
                  <span className="tabular text-[0.82em] text-ink-3">read in {readTime}</span>
                </div>

                {aiActive ? (
                  <>
                    <ul className="mt-2 divide-y divide-glass-hairline">
                      {findings.map((f) => (
                        <li key={f.label} className="py-2.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="min-w-0 font-medium">{f.label}</span>
                            <span
                              className={cx(
                                'tabular font-bold',
                                f.critical
                                  ? 'text-pri-critical-ink'
                                  : f.reassuring
                                    ? 'text-normal'
                                    : 'text-ink',
                              )}
                            >
                              {f.value}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.86em] text-ink-3">
                            <span className="min-w-0">{f.gloss}</span>
                            <Confidence band={f.band} score={f.confidence} />
                            {f.concordant && (
                              <span className="text-normal" title="The reporting radiologist agreed">
                                radiologist agrees
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <p className="tabular mt-2 flex items-center gap-2 rounded-panel bg-glass-inset px-3 py-2 text-[0.82em] text-ink-3">
                      <Icon name="Cpu" size={13} className="shrink-0" />
                      {IMAGING_TRIAGE.model} · study {study.sourcePatientId} · {study.seriesTotal} images
                    </p>

                    <AIActionBar
                      className="mt-3"
                      touchpointId={`strokeai:${current.id}:ncct`}
                      capabilityId="AI-404"
                      gate="G3"
                      band="HIGH"
                      score={0.94}
                      explain={{
                        touchpointId: `strokeai:${current.id}:ncct`,
                        capabilityId: 'AI-404',
                        claim: `${verdict.headline}. ${verdict.detail}`,
                        confidence: 0.94,
                        band: 'HIGH',
                        computedAt: formatTime(IMAGING_TRIAGE.deliveredAt),
                        inputs: [
                          { label: `Non-contrast CT head, ${study.seriesTotal} images`, source: `${study.seriesDescription} · ${study.sliceThickness} mm` },
                          { label: 'CT angiogram, arch to vertex', source: IMAGING_TRIAGE.study },
                          { label: 'Last known well and NIHSS', source: `Case ${current.caseNo}` },
                        ],
                        evidence: [
                          `Haemorrhage classifier ${truth.ich ? 'positive' : 'negative'} at 0.97 across all five subtypes.`,
                          'Hyperdense left MCA on the source images, with M1 cut-off on the angiogram.',
                        ],
                        model: IMAGING_TRIAGE.model,
                        limits: IMAGING_TRIAGE.limits,
                      }}
                    />

                    <Why label="What this reading is, and is not" className="mt-3">
                      <p className="text-ink-2">{DECISION_SUPPORT_NOTICE}</p>
                      <p className="text-ink-2">
                        G3 — AI-404 prioritises the study and notifies a named clinician. It does not diagnose, and
                        nothing it reports enters the record until you sign for it.
                      </p>
                    </Why>
                  </>
                ) : (
                  <p className="mt-2 rounded-panel bg-glass-inset px-3 py-3 text-[0.95em] text-ink-2">
                    Automated reading is off. The study is unchanged and the radiologist worklist is the route —
                    unprioritised, in arrival order. The clock keeps running.
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* The full report, folded — it is a document, not a dashboard. */}
          <SectionCard title="Clinical report" meta={<span className="text-[0.86em] text-ink-3">{current.caseNo}</span>}>
            <Disclosure label="the full Stroke-AI report">
              <StrokeAIReport strokeCase={current} study={study} />
            </Disclosure>
          </SectionCard>
        </div>
      </div>
    </Screen>
  )
}

/** Exported for the case clock, which links here once a study lands. */
export const STROKE_AI_CONSOLE_ROUTE = '/stroke/ai-console'
export { STROKE_NOW }
