/**
 * S-18-13 · Spoke-Site Simplified Console — `/stroke/spoke` · T1 · ARC-15
 *
 * "Six fields for a general physician who is alone at 02:00."
 *
 * Deck beat #18, and the atlas calls it "THE MOST IMPORTANT DESIGN DECISION IN
 * THE MODULE": "A console built for a hub specialist goes unused at a spoke —
 * and an unused spoke console means the network does not exist."
 *
 * So the constraints are the design:
 *   Six fields. Not sixty — the hub collects the rest.
 *   One primary action, always enabled, never gated on the AI or the network.
 *   Targets >= 64px, usable one-handed while holding a phone to the ear.
 *   The phone path is a first-class route and is never removed.
 *   OFFLINE is the EXPECTED state, not the exception.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, SuggestionCard } from '@/components/ai'
import { Alert, Button, Card, Chip, Field, Icon, Select, TextInput, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { facility, patient } from '@/data/kit'
import { ACTIVE_CASE } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { useCaseNow } from './CaseClock'
import { Screen } from '@/shell/Screen'

/** The six questions that actually change the decision. */
const SIX = [
  {
    key: 'lkw',
    label: 'When was the patient last known well?',
    hint: 'Not when they were found — when they were last definitely normal. If nobody saw it, say unknown.',
    type: 'time' as const,
  },
  {
    key: 'deficit',
    label: 'What is the deficit?',
    hint: 'In your own words. The hub scores the NIHSS over video.',
    type: 'select' as const,
    options: [
      'Right-sided weakness with speech difficulty',
      'Left-sided weakness',
      'Speech difficulty only',
      'Visual loss',
      'Reduced consciousness',
      'Other',
    ],
  },
  {
    key: 'anticoag',
    label: 'Is the patient on a blood thinner?',
    hint: 'Warfarin, or any of the newer ones. Unknown is an acceptable answer and does not block.',
    type: 'select' as const,
    options: ['No', 'Yes — warfarin', 'Yes — a newer anticoagulant (DOAC)', 'Unknown'],
  },
  {
    key: 'bp',
    label: 'Blood pressure now',
    hint: 'Systolic over diastolic. Above 185/110 needs treating before thrombolysis.',
    type: 'text' as const,
  },
  {
    key: 'glucose',
    label: 'Capillary glucose',
    hint: 'Hypoglycaemia mimics a stroke. This is the one test that changes the diagnosis.',
    type: 'text' as const,
  },
  {
    key: 'weight',
    label: 'Weight, measured or estimated',
    hint: 'The thrombolytic dose is per kilogram, so an estimate is better than a blank.',
    type: 'text' as const,
  },
]

export function S1813() {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)
  const caseNow = useCaseNow()

  const [activated, setActivated] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [ctProgress, setCtProgress] = useState(0)

  const site = facility(me.facilityCode === 'INS' ? 'INS' : 'INS')
  const p = patient(ACTIVE_CASE.patientId)
  const offline = forced === 'OFFLINE'
  const answered = SIX.filter((f) => (answers[f.key] ?? '').trim()).length

  function uploadCt() {
    setCtProgress(1)
    const t = window.setInterval(() => {
      setCtProgress((v) => {
        if (v >= 100) {
          window.clearInterval(t)
          return 100
        }
        return v + 7
      })
    }, 260)
  }

  return (
    <Screen
      screenId="S-18-13"
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'AI-OFF', 'AI-ABSTAIN']}
      chips={
        <>
          <Chip tone="isolation" icon="Building2">
            {site.code} · {site.role}
          </Chip>
          <Chip tone="caution" icon="UserX">
            no on-site neurologist
          </Chip>
          <Chip tone="neutral" icon="Clock">
            {formatTime(caseNow)}
          </Chip>
        </>
      }
      actions={
        /* The phone is always a path. Never remove it. */
        <Button tone="secondary" size="lg" icon="Phone">
          Call the hub
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why six</h3>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              The hub needs sixty things. You need six. Everything else is collected at the hub from what you send and
              from the video call, because a console that asks a lone physician sixty questions at 02:00 gets closed.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">If the network drops</h3>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              Activation and all six answers capture locally and queue. The phone number stays on screen. The printed
              protocol cards stay available. Nothing you have typed is lost.
            </p>
            <p className="mt-2 text-[0.88em] text-ink-3">Offline is the expected state here, not an error.</p>
          </Card>

          {aiActive && activated && (
            <SuggestionCard
              touchpointId="spoke:mimic"
              capabilityId="AI-203"
              title="Consider a stroke mimic"
              evidence="Check the capillary glucose before anything else — hypoglycaemia is the commonest mimic and is immediately reversible. Seizure with a post-ictal deficit is the second."
              band="MED"
              score={0.66}
              gate="G1"
              caution="Advisory. It suggests, never concludes, and it does not delay activation."
              explain={{
                touchpointId: 'spoke:mimic',
                capabilityId: 'AI-203',
                claim: 'A stroke mimic is worth excluding before committing to the pathway.',
                confidence: 0.66,
                band: 'MED',
                computedAt: formatTime(caseNow),
                inputs: [
                  { label: 'Presenting deficit as described', source: 'This form' },
                  { label: 'Site mimic rate', source: 'Stroke registry, INS' },
                ],
                evidence: [
                  'One of three activations at this site last month was a mimic.',
                  'Glucose is the single test with the highest yield here.',
                ],
                model: 'ddx v2.6.1',
                limits: [
                  'Advisory only. It never de-activates a case and never delays activation.',
                  'It cannot examine the patient.',
                  'Your own judgement is the fallback and the authority.',
                ],
              }}
            />
          )}
        </div>
      }
      railTitle="At a spoke"
    >
      <div className="space-y-6">
        {offline && (
          <Alert tone="caution" title="No connection — this is the expected state here">
            Activation and your answers are captured locally and will send when the link returns. Call the hub now on
            the number above; the phone path does not depend on this screen.
          </Alert>
        )}

        {/* One primary action, the largest target, always enabled. */}
        {!activated ? (
          <Card className="p-6 text-center md:p-10">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Suspected stroke?</h2>
            <p className="mx-auto mt-2 max-w-lg text-ink-2">
              One action starts the clock and raises the telestroke request together. You do not have to decide which
              first, and it works whether or not the AI or the network is up.
            </p>
            <button
              type="button"
              onClick={() => {
                setActivated(true)
                toast({
                  tone: 'critical',
                  title: 'Code stroke activated',
                  detail: 'The clock has started and the hub has been paged. Dr Rohit Desai is on call.',
                })
              }}
              className="ai-surface mx-auto mt-6 flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-card px-8 text-lg font-bold shadow-bubble hover:brightness-110 active:scale-[0.99] md:text-xl"
            >
              <Icon name="Siren" size={26} />
              ACTIVATE &amp; REQUEST HUB
            </button>
            <p className="mt-3 text-[0.9em] text-ink-3">
              Always enabled. Never gated on the model, the network, or a complete form.
            </p>
          </Card>
        ) : (
          <>
            <Alert tone="normal" title="Activated — the clock is running and the hub is paged">
              STROKE/26-27/{ACTIVE_CASE.id} · Dr Rohit Desai has acknowledged. Answer the six questions below while you
              wait for the video call; each one saves as you go.
            </Alert>

            <div className="grid gap-4 md:grid-cols-2">
              <Button
                size="lg"
                tone="primary"
                icon="Video"
                className="min-h-16"
                onClick={() => navigate(`/stroke/case/${ACTIVE_CASE.id}/telestroke`)}
              >
                Join the video call
              </Button>
              <Button
                size="lg"
                icon="Clock"
                className="min-h-16"
                onClick={() => navigate(`/stroke/case/${ACTIVE_CASE.id}/clock`)}
              >
                See the case clock
              </Button>
            </div>

            {/* The six. One field per view on a phone. */}
            <section>
              <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-lg font-semibold tracking-tight">The six questions</span>
                <span className="tabular text-[0.9em] text-ink-3">
                  {answered} of {SIX.length} answered — none of them blocks
                </span>
              </h2>
              <div className="space-y-4">
                {SIX.map((f, i) => (
                  <Card key={f.key} className="p-5">
                    <Field
                      label={`${i + 1}. ${f.label}`}
                      htmlFor={`six-${f.key}`}
                      hint={f.hint}
                      required={false}
                    >
                      {f.type === 'select' ? (
                        <Select
                          id={`six-${f.key}`}
                          value={answers[f.key] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                          className="min-h-16 text-base"
                        >
                          <option value="">Choose, or leave blank…</option>
                          {f.options?.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                          <option value="Unknown">Unknown</option>
                        </Select>
                      ) : (
                        <TextInput
                          id={`six-${f.key}`}
                          type={f.type === 'time' ? 'time' : 'text'}
                          value={answers[f.key] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                          className="min-h-16 text-base"
                          placeholder={f.type === 'time' ? undefined : 'Type it, or leave blank'}
                        />
                      )}
                    </Field>
                    {(answers[f.key] ?? '') === 'Unknown' && (
                      <p className="mt-2 flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2 text-[0.9em] font-medium text-caution">
                        <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                        Unknown is recorded as unknown, and the hub sees it as unknown. It is not treated as a no.
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </section>

            {/* Poor bandwidth: the CT uploads progressively while the clock runs. */}
            <Card className="p-5">
              <h2 className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-lg font-semibold tracking-tight">Upload the CT</span>
                <Chip tone="caution" icon="WifiLow">
                  bandwidth is poor here
                </Chip>
              </h2>
              <p className="mt-1.5 text-ink-2">
                It uploads progressively — the hub can read a low-resolution series before the full study arrives. The
                decision never waits on full resolution.
              </p>

              {ctProgress === 0 ? (
                <Button size="lg" tone="primary" icon="Upload" className="mt-4 min-h-16 w-full" onClick={uploadCt}>
                  Upload the NCCT
                </Button>
              ) : (
                <div className="mt-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {ctProgress >= 100 ? 'Uploaded — full resolution' : 'Uploading'}
                    </span>
                    <span className="tabular font-semibold">{Math.min(100, ctProgress)}%</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-pill bg-glass-fill-muted">
                    <div
                      className={cx('h-full rounded-pill transition-[width] duration-200', ctProgress >= 100 ? 'bg-normal' : 'bg-viz-1')}
                      style={{ width: `${Math.min(100, ctProgress)}%`, backgroundColor: ctProgress >= 100 ? undefined : 'var(--color-viz-1)' }}
                    />
                  </div>
                  <p className="mt-2 text-[0.9em] text-ink-2">
                    {ctProgress >= 35 && ctProgress < 100
                      ? 'Low-resolution series is already with the hub. They can start reading.'
                      : ctProgress >= 100
                        ? 'The hub has the full study.'
                        : 'Sending the first series…'}
                  </p>
                  {ctProgress >= 60 && aiActive && (
                    <Button
                      size="lg"
                      tone="ai"
                      icon="Scan"
                      className="mt-3 min-h-16 w-full"
                      onClick={() => navigate(`/stroke/case/${ACTIVE_CASE.id}/imaging`)}
                    >
                      <Diamond size={11} />
                      The AI has read it — see the triage card
                    </Button>
                  )}
                </div>
              )}
            </Card>

            <p className="flex items-start gap-2 text-[0.9em] text-ink-3">
              <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
              You are recorded as the activating clinician: {me.name} at {site.name}. The patient in the hub&rsquo;s
              view is {p.name}, {p.age}/{p.sex}.
            </p>
          </>
        )}
      </div>
    </Screen>
  )
}
