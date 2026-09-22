/**
 * S-15-04 · Image Viewer with AI Overlay — `/radiology/study/:id/view` · T1 · ARC-11
 *
 * "The viewer, with the AI overlay a radiologist will actually leave on."
 *
 * That one-liner is a design requirement, not a boast. An overlay a radiologist
 * switches off on the first study is worse than no overlay, so the toggle is
 * prominent, the unmarked image is always one click away, and the findings sit
 * beside the image rather than on top of it.
 *
 * Night theme is the default for this screen and for P-13 as a persona:
 * "no large white fields" in a reading room.
 */

import { useState } from 'react'
import { AIActionBar, Confidence, Diamond } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue, Toggle, cx } from '@/components/primitives'
import { formatDateTime, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { S1506 } from './S1506'

/** AI-402's findings on SD-P-03's chest film, plus AI-408's comparison. */
const FINDINGS = [
  { label: 'Right lower lobe consolidation', value: 'Present', band: 'HIGH' as const, confidence: 0.93, critical: false },
  { label: 'Pleural effusion', value: 'Small, right', band: 'MED' as const, confidence: 0.68, critical: true },
  { label: 'Pneumothorax', value: 'None', band: 'HIGH' as const, confidence: 0.97, critical: false },
  { label: 'Cardiomegaly', value: 'None', band: 'HIGH' as const, confidence: 0.91, critical: false },
]

const PRIOR_COMPARISON = {
  priorDate: '19-Sep-2026',
  change: 'The consolidation has extended cranially by about 2 cm and a small effusion is new since 19-Sep.',
  band: 'MED' as const,
  confidence: 0.74,
}

export function S1504({ id }: { id?: string }) {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)

  const p = patient('SD-P-03')
  const studyId = id ?? 'ST-4471'
  const [overlay, setOverlay] = useState(true)
  const [escalate, setEscalate] = useState(false)
  const [window, setWindow] = useState('Lung')

  const criticalFinding = FINDINGS.find((f) => f.critical)
  const reported = dispositions[`imaging:${studyId}:report`]

  return (
    <Screen
      screenId="S-15-04"
      patient={p}
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      wide
      chips={
        <>
          <Chip tone="neutral" className="tabular">
            {studyId}
          </Chip>
          <Chip tone="neutral">Chest X-ray PA</Chip>
          {aiActive && (
            <Chip tone="caution" icon="ShieldAlert">
              G3 · standard queue is the fallback
            </Chip>
          )}
        </>
      }
      actions={
        <>
          <Button icon="Columns2">Compare with {PRIOR_COMPARISON.priorDate}</Button>
          <Button tone="primary" icon="Mic" onClick={() => toast({ tone: 'info', title: 'Dictation started' })}>
            Dictate the report
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Study</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Acquired">
                <span className="tabular">{formatDateTime(new Date(2026, 8, 21, 8, 52))}</span>
              </KeyValue>
              <KeyValue label="Modality">DX · portable</KeyValue>
              <KeyValue label="Ordered by">Dr Ananya Iyer</KeyValue>
              <KeyValue label="Indication">Deterioration at 72h on antibiotics</KeyValue>
              <KeyValue label="Prior">{PRIOR_COMPARISON.priorDate}</KeyValue>
            </dl>
          </Card>

          {aiActive && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                <Diamond size={10} />
                AI-408 · change since the prior
              </p>
              <p className="mt-1.5 text-[0.9em] text-ink-2">{PRIOR_COMPARISON.change}</p>
              <Confidence band={PRIOR_COMPARISON.band} score={PRIOR_COMPARISON.confidence} className="mt-2" />
              <p className="mt-2 text-[0.84em] text-ink-3">
                Manual side-by-side is the fallback, and the prior is one click away either way.
              </p>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Windowing</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {['Lung', 'Soft tissue', 'Bone', 'Mediastinum'].map((w) => (
                <Button key={w} size="sm" tone={window === w ? 'primary' : 'secondary'} onClick={() => setWindow(w)}>
                  {w}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      }
      railTitle="Study"
    >
      <div className="space-y-5">
        {aiActive && criticalFinding && (
          <Alert
            tone="caution"
            title={`${criticalFinding.label} — ${criticalFinding.value}`}
            action={
              <Button size="sm" tone="destructive" icon="PhoneCall" onClick={() => setEscalate(true)}>
                Escalate
              </Button>
            }
          >
            AI-407 has flagged this as a finding that needs a named clinician told, not left in a report queue. The
            escalation is a separate act from the report — it reaches a person, and it records who.
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* The image. */}
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <p className="tabular text-[0.9em] font-semibold">
                {p.name} · {p.age}/{p.sex} · {window} window
              </p>
              {aiActive && (
                <label className="flex items-center gap-2 text-[0.88em]">
                  <Toggle checked={overlay} onChange={setOverlay} label="AI overlay" />
                  overlay {overlay ? 'on' : 'off'}
                </label>
              )}
            </div>

            <div className="relative aspect-[4/5] w-full bg-[#07090e]">
              <svg viewBox="0 0 200 250" className="absolute inset-0 size-full" role="img" aria-label="Chest radiograph, postero-anterior, with the AI region of interest at the right lower zone">
                {/* Thorax. */}
                <rect x="0" y="0" width="200" height="250" fill="#07090e" />
                <path d="M62 30 Q100 18 138 30 L146 200 Q100 218 54 200 Z" fill="#1c222e" />
                {/* Lung fields — patient's right is image left. */}
                <ellipse cx="76" cy="110" rx="26" ry="60" fill="#0e1218" />
                <ellipse cx="124" cy="110" rx="26" ry="60" fill="#0e1218" />
                {/* Mediastinum and heart. */}
                <path d="M96 60 L104 60 L108 150 Q100 162 92 150 Z" fill="#2a3242" />
                <ellipse cx="110" cy="140" rx="24" ry="30" fill="#2a3242" />
                {/* Diaphragm. */}
                <path d="M54 176 Q76 166 100 176 Q124 166 146 176 L146 200 Q100 218 54 200 Z" fill="#242c3a" />
                {/* The consolidation, right lower zone. */}
                <ellipse cx="74" cy="152" rx="22" ry="24" fill="#4a5568" opacity="0.9" />
                {/* The small effusion. */}
                <path d="M54 172 Q66 168 78 174 L78 182 Q64 184 54 180 Z" fill="#5a6678" opacity="0.8" />

                {overlay && aiActive && (
                  <>
                    <ellipse
                      cx="74"
                      cy="152"
                      rx="27"
                      ry="29"
                      fill="none"
                      stroke="var(--color-ai)"
                      strokeWidth="2"
                      strokeDasharray="5 4"
                    />
                    <text x="74" y="196" textAnchor="middle" className="fill-[var(--color-ai)] text-[7px] font-bold">
                      RLL CONSOLIDATION
                    </text>
                    <path
                      d="M52 170 Q66 165 80 173 L80 184 Q63 187 52 182 Z"
                      fill="none"
                      stroke="var(--color-caution)"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                    />
                    <text x="40" y="196" textAnchor="middle" className="fill-[var(--color-caution)] text-[7px] font-bold">
                      EFFUSION
                    </text>
                  </>
                )}
                <text x="12" y="240" className="fill-[#5a6478] text-[8px]">
                  R
                </text>
                <text x="184" y="240" className="fill-[#5a6478] text-[8px]">
                  L
                </text>
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              {aiActive && (
                <>
                  <Button size="sm" disabled={!overlay} onClick={() => setOverlay(false)}>
                    Show the original
                  </Button>
                  <Button size="sm" disabled={overlay} onClick={() => setOverlay(true)}>
                    Show the overlay
                  </Button>
                </>
              )}
              <span className="ml-auto text-[0.84em] text-ink-3">
                The unmarked image is always one click away — an overlay you cannot remove is an overlay you switch off
                for good.
              </span>
            </div>
          </Card>

          {/* The findings. */}
          <div className="space-y-4">
            {aiActive ? (
              <Card className="p-5">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Diamond size={12} />
                  Findings
                </h2>
                <dl className="mt-3 divide-y divide-glass-hairline">
                  {FINDINGS.map((f) => (
                    <div key={f.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <dt className={cx('text-[0.95em]', f.critical && 'font-semibold text-caution')}>
                        {f.label}
                        {f.critical && (
                          <Chip tone="caution" icon="TriangleAlert" className="ml-2">
                            escalate
                          </Chip>
                        )}
                      </dt>
                      <dd className="flex items-center gap-2">
                        <span className={cx('font-semibold', f.value === 'None' && 'text-normal')}>{f.value}</span>
                        <Confidence band={f.band} score={f.confidence} />
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="tabular mt-3 flex items-center gap-2 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.86em]">
                  <Icon name="Cpu" size={13} className="shrink-0 text-ink-3" />
                  cxr-triage v5.4.2 · read {formatTime(new Date(2026, 8, 21, 8, 54))}
                </p>

                <AIActionBar
                  className="mt-3"
                  touchpointId={`imaging:${studyId}:report`}
                  capabilityId="AI-402"
                  gate="G3"
                  band="HIGH"
                  score={0.93}
                  explain={{
                    touchpointId: `imaging:${studyId}:report`,
                    capabilityId: 'AI-402',
                    claim: 'Right lower lobe consolidation with a new small effusion, on a portable chest radiograph.',
                    confidence: 0.93,
                    band: 'HIGH',
                    computedAt: formatTime(new Date(2026, 8, 21, 8, 54)),
                    inputs: [
                      { label: `Study ${studyId}, PA projection`, source: 'Acquired 08:52' },
                      { label: `Prior study ${PRIOR_COMPARISON.priorDate}`, source: 'Comparison series' },
                      { label: 'Clinical indication from the order', source: 'Order O-5501' },
                    ],
                    evidence: [
                      'Homogeneous opacity in the right lower zone with an air bronchogram.',
                      'Blunting of the right costophrenic angle, new since the prior.',
                    ],
                    model: 'cxr-triage v5.4.2',
                    limits: [
                      'Validated on frontal chest radiographs in adults. Portable films are within scope but lower performing.',
                      'It does not distinguish consolidation from atelectasis reliably.',
                      'At G3 the finding does not enter the report until a radiologist attests to it.',
                      'The standard reporting queue is the fallback.',
                    ],
                  }}
                />

                {reported && (
                  <p className="mt-2.5 rounded-panel bg-normal-soft px-3 py-2 text-[0.9em] font-medium text-normal">
                    Attested by {reported.by}. It is now part of the report.
                  </p>
                )}
              </Card>
            ) : (
              <Card className="p-5">
                <h2 className="font-semibold">No automated findings</h2>
                <p className="mt-2 text-ink-2">
                  The AI is off, so this study sits in the standard reporting queue in chronological order. That is
                  AI-402&rsquo;s documented fallback — you lose the prioritisation, not the study.
                </p>
              </Card>
            )}

            <ScreenSection title="Report">
              <Card className="p-4">
                <p className="text-[0.9em] text-ink-2">
                  Dictation opens the report authoring screen, where the drafted narrative and the codes are a separate
                  G3 touchpoint. A finding confirmed here does not write itself into the report.
                </p>
                <Button
                  className="mt-3 w-full"
                  tone="primary"
                  icon="FileText"
                  onClick={() => toast({ tone: 'info', title: 'Report authoring', detail: 'S-15-05 is outside this build’s scope.' })}
                >
                  Author the report
                </Button>
              </Card>
            </ScreenSection>
          </div>
        </div>

        <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          Reading room defaults to the night theme — {me.name} reads on a diagnostic workstation, and large white
          fields in a darkened room cost contrast sensitivity.
        </p>
      </div>

      {/* S-15-06, the modal it is specified to be. */}
      <S1506
        open={escalate}
        finding={criticalFinding?.label ?? ''}
        studyId={studyId}
        onClose={() => setEscalate(false)}
      />
    </Screen>
  )
}
