/**
 * S-18-14 · Imaging AI Triage Card — `/stroke/case/:id/imaging` · T1 · ARC-11
 *
 * "LVO found, and on the neurologist's phone four minutes later."
 *
 * Deck beat #19, "the flagship's sharpest frame". Its drawing notes are three
 * hard requirements rather than suggestions:
 *   "Draw it PHONE-FIRST — SD-S-02 is at home at 02:00. The wall version is
 *    secondary."
 *   "The card must name MODEL@VERSION. A finding with no provenance is not
 *    actionable clinically or legally."
 *   "G3 — it PRIORITISES AND NOTIFIES; IT NEVER DIAGNOSES. Say so on the frame."
 *   "Show ICH as an explicit NO — that negative is what unlocks thrombolysis."
 *
 * Break-glass is the normal path here: a remote on-call has no care
 * relationship with a patient at another site.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AIActionBar, Confidence, Diamond } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue, Toggle, cx } from '@/components/primitives'
import { BreakGlassBanner } from '@/components/states'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { IMAGING_TRIAGE, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

export function S1814({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)
  const grantBreakGlass = useSession((s) => s.grantBreakGlass)
  const breakGlass = useSession((s) => s.breakGlassPatients)
  const caseNow = useCaseClock()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const [overlay, setOverlay] = useState(true)

  const confirmed = dispositions[`imaging:${c.id}:lvo`]
  const glass = breakGlass[p.id]

  const minsFromRecon = Math.round((IMAGING_TRIAGE.deliveredAt.getTime() - IMAGING_TRIAGE.reconstructedAt.getTime()) / 60000)

  return (
    <Screen
      screenId="S-18-14"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={
        <>
          <Chip tone="neutral">{IMAGING_TRIAGE.study}</Chip>
          <Chip tone="caution" icon="ShieldAlert">
            G3 · confirm required
          </Chip>
        </>
      }
      actions={
        <>
          <Button icon="Grid2x2" onClick={() => navigate(`/stroke/case/${c.id}/aspects`)}>
            ASPECTS
          </Button>
          <Button icon="Activity" onClick={() => navigate(`/stroke/case/${c.id}/perfusion`)}>
            Perfusion
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Provenance</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Model">
                <span className="tabular">{IMAGING_TRIAGE.model}</span>
              </KeyValue>
              <KeyValue label="Study">
                <span className="tabular">{IMAGING_TRIAGE.studyId}</span>
              </KeyValue>
              <KeyValue label="Acquired">
                <span className="tabular">{formatTime(IMAGING_TRIAGE.acquiredAt)}</span>
              </KeyValue>
              <KeyValue label="Reconstructed">
                <span className="tabular">{formatTime(IMAGING_TRIAGE.reconstructedAt)}</span>
              </KeyValue>
              <KeyValue label="Delivered to you">
                <span className="tabular">
                  {formatTime(IMAGING_TRIAGE.deliveredAt)} · {minsFromRecon} min later
                </span>
              </KeyValue>
              <KeyValue label="Gate">G3 — attest before it counts</KeyValue>
            </dl>
            <p className="mt-3 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.86em] text-ink-2">
              A finding with no model and no version is not actionable, clinically or legally. That is why the card
              names both on its face rather than in a drawer.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">What it does not do</h3>
            <ul className="mt-2 space-y-1.5 text-[0.9em] text-ink-2">
              {IMAGING_TRIAGE.limits.map((l) => (
                <li key={l} className="flex gap-2">
                  <Icon name="Minus" size={13} className="mt-1 shrink-0 text-ink-muted" />
                  {l}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
      railTitle="Model"
      actionBar={
        <>
          <span className="text-[0.88em] text-ink-3">
            {confirmed ? `Confirmed by ${confirmed.by}` : 'A G3 finding needs a named clinician to confirm it'}
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button icon="PhoneCall">Escalate to the neuro-interventionist</Button>
            <Button
              tone="primary"
              icon="Syringe"
              onClick={() => navigate(`/stroke/case/${c.id}/thrombolysis`)}
            >
              Go to eligibility
            </Button>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {/* Break-glass is the normal path for a remote on-call. */}
        {!glass ? (
          <Alert
            tone="caution"
            title="You have no care relationship with this patient"
            action={
              <Button
                size="sm"
                tone="primary"
                icon="ShieldAlert"
                onClick={() => {
                  grantBreakGlass(p.id, 'On-call stroke neurologist reviewing a spoke-site activation')
                  toast({
                    tone: 'caution',
                    title: 'Break-glass access granted',
                    detail: 'Logged and reviewed within 24 hours. An amber banner stays up while you are in the record.',
                  })
                }}
              >
                Break glass
              </Button>
            }
          >
            {p.name} is at {c.originFacility} and you are the hub on-call. You are not refused — state a reason and
            proceed. An authorization model that can block a code stroke is the wrong model.
          </Alert>
        ) : (
          <BreakGlassBanner reason={glass.reason} by={me.name} className="-mx-4 md:-mx-6" />
        )}

        {/* Phone-first: the card is a single column, sized for a phone at 02:00. */}
        <div className="mx-auto max-w-md space-y-4 lg:max-w-none lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-5 lg:space-y-0">
          {/* The image. */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-2.5">
              <p className="tabular text-[0.9em] font-semibold">
                {p.name} · {p.age}/{p.sex}
              </p>
              <label className="flex items-center gap-2 text-[0.86em]">
                <Toggle checked={overlay} onChange={setOverlay} label="AI overlay" />
                overlay {overlay ? 'on' : 'off'}
              </label>
            </div>

            {/* A representational NCCT with the overlay region marked. */}
            <div className="relative aspect-square w-full bg-[#0a0d14]">
              <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" role="img" aria-label="Non-contrast CT head, axial slice, with the AI region of interest marked on the left M1 territory">
                {/* Skull and brain, schematic. */}
                <ellipse cx="100" cy="100" rx="78" ry="92" fill="#1a2030" stroke="#3a4560" strokeWidth="5" />
                <ellipse cx="100" cy="100" rx="68" ry="82" fill="#2c3447" />
                <path d="M100 22 L100 178" stroke="#1a2030" strokeWidth="3" />
                {/* Ventricles. */}
                <ellipse cx="86" cy="92" rx="11" ry="24" fill="#151b28" />
                <ellipse cx="114" cy="92" rx="11" ry="24" fill="#151b28" />
                {/* The affected left insula/lentiform region — patient's left is image right. */}
                <ellipse cx="132" cy="96" rx="17" ry="24" fill="#333c52" />
                {overlay && (
                  <>
                    <ellipse
                      cx="132"
                      cy="96"
                      rx="20"
                      ry="27"
                      fill="none"
                      stroke="var(--color-ai)"
                      strokeWidth="2.5"
                      strokeDasharray="5 4"
                    />
                    <text x="132" y="140" textAnchor="middle" className="fill-[var(--color-ai)] text-[9px] font-bold">
                      LEFT M1
                    </text>
                    {/* The hyperdense vessel sign. */}
                    <line x1="124" y1="78" x2="140" y2="88" stroke="#e8eaf2" strokeWidth="3" strokeLinecap="round" />
                  </>
                )}
                <text x="14" y="194" className="fill-[#6b7690] text-[8px]">
                  R
                </text>
                <text x="182" y="194" className="fill-[#6b7690] text-[8px]">
                  L
                </text>
              </svg>
            </div>

            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <Button size="sm" onClick={() => setOverlay(false)} disabled={!overlay}>
                Show the original
              </Button>
              <Button size="sm" onClick={() => setOverlay(true)} disabled={overlay}>
                Show the overlay
              </Button>
              <span className="ml-auto text-[0.84em] text-ink-3">
                The unmarked image is always one tap away.
              </span>
            </div>
          </Card>

          {/* The findings. */}
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="flex items-center gap-2 font-semibold">
                {aiActive && <Diamond size={12} />}
                {aiActive ? 'AI findings' : 'Awaiting a radiologist read'}
              </h2>

              {aiActive ? (
                <>
                  <dl className="mt-3 divide-y divide-glass-hairline">
                    {IMAGING_TRIAGE.findings.map((f) => (
                      <div key={f.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <dt className="text-[0.95em] text-ink-2">{f.label}</dt>
                        <dd className="flex items-center gap-2">
                          <span
                            className={cx(
                              'tabular font-bold',
                              f.emphasisNegative ? 'text-lg text-normal' : 'text-base',
                            )}
                          >
                            {f.value}
                          </span>
                          {f.emphasisNegative && (
                            <Chip tone="normal" icon="Check">
                              unlocks thrombolysis
                            </Chip>
                          )}
                          {f.band && <Confidence band={f.band} score={f.confidence} />}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <p className="tabular mt-3 flex flex-wrap items-center gap-2 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.88em]">
                    <Icon name="Cpu" size={13} className="shrink-0 text-ink-3" />
                    {IMAGING_TRIAGE.model}
                    <span className="text-ink-3">
                      · delivered {formatTime(IMAGING_TRIAGE.deliveredAt)}, {minsFromRecon} min after reconstruction
                    </span>
                  </p>

                  <AIActionBar
                    className="mt-3"
                    touchpointId={`imaging:${c.id}:lvo`}
                    capabilityId="AI-404"
                    gate="G3"
                    band="HIGH"
                    score={0.94}
                    explain={{
                      touchpointId: `imaging:${c.id}:lvo`,
                      capabilityId: 'AI-404',
                      claim: 'A large-vessel occlusion is detected in the left M1 segment. This is a prioritisation and notification finding, not a diagnosis.',
                      confidence: 0.94,
                      band: 'HIGH',
                      computedAt: formatTime(IMAGING_TRIAGE.deliveredAt),
                      inputs: [
                        { label: `${IMAGING_TRIAGE.study}, ${IMAGING_TRIAGE.studyId}`, source: `Acquired ${formatTime(IMAGING_TRIAGE.acquiredAt)}` },
                        { label: 'Hyperdense vessel sign on the NCCT', source: 'Axial series, slice 14' },
                        { label: 'CTA vessel run-off', source: 'Arterial phase' },
                      ],
                      evidence: [
                        'Abrupt calibre change at the left M1 origin with no distal opacification.',
                        'Asymmetry of the insular ribbon on the same side.',
                      ],
                      model: IMAGING_TRIAGE.model,
                      limits: IMAGING_TRIAGE.limits,
                    }}
                  />

                  <p className="mt-3 rounded-panel bg-caution-soft px-3 py-2.5 text-[0.9em] font-medium text-caution">
                    G3 · this prioritises and notifies. <strong>It never diagnoses.</strong> The finding does not enter
                    the record until a named clinician confirms it.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 text-ink-2">
                    The AI is off, so no automated finding is shown. The study is in the radiologist&rsquo;s worklist in
                    the normal, unprioritised order.
                  </p>
                  <p className="mt-2 text-[0.9em] text-ink-3">
                    That is the documented fallback for AI-404: a radiologist or neurologist read. The clock keeps
                    running either way.
                  </p>
                  <Button className="mt-3" icon="PhoneCall">
                    Call the radiologist on call
                  </Button>
                </>
              )}
            </Card>

            {confirmed && (
              <Alert tone="normal" title="Finding confirmed">
                {confirmed.by} confirmed the LVO at {formatTime(caseNow)}. It is now part of the case record and the
                thrombectomy pathway is live.
              </Alert>
            )}
          </div>
        </div>
      </div>
    </Screen>
  )
}
