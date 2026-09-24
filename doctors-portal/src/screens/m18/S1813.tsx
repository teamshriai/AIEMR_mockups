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
 *
 * Calm pass: the six questions carry no paragraph of guidance each — the
 * guidance is the placeholder and the field's title. Both rail explainers fold
 * behind one Why. Nothing above is negotiable and nothing above moved.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, SuggestionCard } from '@/components/ai'
import { SectionCard, Why } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Chip, Field, Icon, Select, TextInput, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { facility } from '@/data/kit'
import { ACTIVE_CASE } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { useCaseNow } from './CaseClock'
import { Screen } from '@/shell/Screen'

/**
 * The six questions that actually change the decision. `help` is never rendered
 * as a paragraph — it is the input's placeholder or its title, so the form is
 * six lines rather than six essays.
 */
const SIX = [
  {
    key: 'lkw',
    label: 'When was the patient last known well?',
    help: 'Not when they were found — when they were last definitely normal. If nobody saw it, say unknown.',
    type: 'time' as const,
  },
  {
    key: 'deficit',
    label: 'What is the deficit?',
    help: 'In your own words. The hub scores the NIHSS over video.',
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
    help: 'Warfarin, or any of the newer ones. Unknown is an acceptable answer and does not block.',
    type: 'select' as const,
    options: ['No', 'Yes — warfarin', 'Yes — a newer anticoagulant (DOAC)', 'Unknown'],
  },
  {
    key: 'bp',
    label: 'Blood pressure now',
    help: 'Systolic over diastolic. Above 185/110 needs treating before thrombolysis.',
    placeholder: 'e.g. 196/104',
    type: 'text' as const,
  },
  {
    key: 'glucose',
    label: 'Capillary glucose',
    help: 'Hypoglycaemia mimics a stroke. This is the one test that changes the diagnosis.',
    placeholder: 'e.g. 7.2 mmol/L',
    type: 'text' as const,
  },
  {
    key: 'weight',
    label: 'Weight, measured or estimated',
    help: 'The thrombolytic dose is per kilogram, so an estimate is better than a blank.',
    placeholder: 'kg — an estimate beats a blank',
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
  const [calling, setCalling] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [ctProgress, setCtProgress] = useState(0)

  const site = facility(me.facilityCode === 'IPL' ? 'IPL' : 'IPL')
  const offline = forced === 'OFFLINE'
  const answered = SIX.filter((f) => (answers[f.key] ?? '').trim()).length
  const mimicCard = aiActive && activated

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
      heading="Spoke console"
      subheading={
        activated ? (
          <>
            STROKE/26-27/{ACTIVE_CASE.id} · clock running · {answered} of {SIX.length} answered
          </>
        ) : (
          'No case activated · one tap starts the clock and pages the hub'
        )
      }
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
        <Button tone="secondary" size="lg" icon="Phone" onClick={() => setCalling(true)}>
          Call the hub
        </Button>
      }
      rail={
        <div className="space-y-4">
          {mimicCard && (
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
                  { label: 'Site mimic rate', source: 'Stroke registry, IPL' },
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

          <Why label="Why six questions, and what happens if the network drops">
            <p className="text-ink-2">
              The hub needs sixty things. You need six. Everything else is collected at the hub from what you send and
              from the video call, because a console that asks a lone physician sixty questions at 02:00 gets closed.
            </p>
            <p className="text-ink-2">
              Activation and all six answers capture locally and queue. The phone number stays on screen. The printed
              protocol cards stay available. Nothing you have typed is lost.
            </p>
            <p className="text-ink-3">Offline is the expected state here, not an error.</p>
          </Why>
        </div>
      }
      railTitle="At a spoke"
      railBadge={mimicCard ? 1 : undefined}
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
              One action starts the clock and raises the telestroke request together — always enabled, never gated on
              the model, the network, or a complete form.
            </p>
            <button
              type="button"
              onClick={() => {
                setActivated(true)
                toast({
                  tone: 'critical',
                  title: 'Code stroke activated',
                  detail: 'The clock has started and the hub has been paged. Dr. Rohit Desai is on call.',
                })
              }}
              className="ai-surface mx-auto mt-6 flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-card px-8 text-lg font-bold shadow-bubble hover:brightness-110 active:scale-[0.99] md:text-xl"
            >
              <Icon name="Siren" size={26} />
              ACTIVATE &amp; REQUEST HUB
            </button>
          </Card>
        ) : (
          <>
            <Alert tone="normal" title="Activated — the clock is running and the hub is paged">
              STROKE/26-27/{ACTIVE_CASE.id} · Dr. Rohit Desai has acknowledged. Answer the six questions below while you
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

            {/* The six. One field per row, every target >= 64px. */}
            <SectionCard
              title="The six questions"
              meta={<span className="text-[0.88em] text-ink-3">none of them blocks</span>}
              bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
            >
              <div className="space-y-5">
                {SIX.map((f, i) => (
                  <div key={f.key} className="min-w-0">
                    <Field label={`${i + 1}. ${f.label}`} htmlFor={`six-${f.key}`} required={false}>
                      {f.type === 'select' ? (
                        <Select
                          id={`six-${f.key}`}
                          title={f.help}
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
                          title={f.help}
                          value={answers[f.key] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
                          className="min-h-16 text-base"
                          placeholder={f.type === 'time' ? undefined : f.placeholder}
                        />
                      )}
                    </Field>
                    {(answers[f.key] ?? '') === 'Unknown' && (
                      <p className="mt-2 flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2 text-[0.9em] font-medium text-caution">
                        <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                        Unknown is recorded as unknown, and the hub sees it as unknown. It is not treated as a no.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Poor bandwidth: the CT uploads progressively while the clock runs. */}
            <SectionCard
              title="Upload the CT"
              meta={
                <Chip tone="caution" icon="WifiLow">
                  bandwidth is poor here
                </Chip>
              }
              bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
            >
              <p className="text-ink-2">
                It uploads progressively — the hub reads a low-resolution series before the full study arrives.
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
            </SectionCard>
          </>
        )}
      </div>
      <ConfirmDialog
        open={calling}
        title={`Call the stroke hub at ${facility('ICH').name}?`}
        consequence="Rings the on-call stroke neurologist, Dr. Rohit Desai, on the hub's stroke line. The call is logged against this case with the time."
        confirmLabel="Call now"
        onConfirm={() => {
          setCalling(false)
          toast({ tone: 'info', title: 'Calling Dr. Rohit Desai', detail: `Hub stroke line · logged against the case at ${formatTime(caseNow)}.` })
        }}
        onCancel={() => setCalling(false)}
      />
    </Screen>
  )
}
