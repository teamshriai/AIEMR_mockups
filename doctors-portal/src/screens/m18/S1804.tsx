/**
 * S-18-04 · Code Stroke Activation — `/stroke/activate` · T2 · ARC-15
 *
 * "One tap that starts everything."
 *
 * AI-209's guardrail is the design constraint: "THE ONE-TAP MANUAL ACTIVATION
 * BUTTON IS ALWAYS PRESENT AND NEVER GATED ON THE MODEL." So the button comes
 * first on the page, works with the AI off, works offline, and needs no form
 * completed before it will fire.
 *
 * What activation actually does is listed, because a clinician who does not
 * know what one tap triggers will hesitate before tapping it.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AIBanner } from '@/components/ai'
import { Alert, Button, Card, Chip, Field, Icon, Select, TextInput } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { FACILITIES } from '@/data/kit'
import { ACTIVE_CASE, PAGING_LOG } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { useCaseNow } from './CaseClock'
import { Screen, ScreenSection } from '@/shell/Screen'

const TRIGGERS = [
  { icon: 'Clock', label: 'The case clock starts', detail: 'Door time is stamped from the server, not from a device.' },
  { icon: 'Users', label: 'The team is paged', detail: 'Neurologist, coordinator and radiographer, in parallel.' },
  { icon: 'Scan', label: 'CT is prioritised', detail: 'The scanner queue is reordered; the radiographer is told why.' },
  { icon: 'Brain', label: 'The case appears on the wall', detail: 'Visible at the hub and on every on-call phone.' },
  { icon: 'ClipboardList', label: 'The activation order set is offered', detail: 'NCCT, CTA, CTP, bloods, ECG — one action.' },
  { icon: 'Wallet', label: 'Pre-authorisation starts in parallel', detail: 'Never on the critical path.' },
]

export function S1804() {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)
  const caseNow = useCaseNow()

  const [site, setSite] = useState(me.facilityCode)
  const [source, setSource] = useState('Walk-in to the emergency department')
  const [lkw, setLkw] = useState('')
  const [activated, setActivated] = useState(false)

  const offline = forced === 'OFFLINE'

  return (
    <Screen
      screenId="S-18-04"
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'AI-OFF']}
      chips={
        <Chip tone="neutral" icon="Clock">
          {formatTime(caseNow)}
        </Chip>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Why the button is never gated
            </h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A detection model that is down, a network that has dropped, or a form that is half-filled must not be
              able to stop a code stroke. So activation is a manual, always-enabled action, and everything else on this
              page is optional context.
            </p>
            <p className="mt-2 text-[0.86em] text-ink-3">AI-209 · the manual path is the product, not the fallback.</p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">De-activating is normal</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              One in three activations at a spoke turns out to be a mimic. De-activation keeps the record and its
              reason — a network that only shows true strokes is not being honest about its own performance.
            </p>
          </Card>
        </div>
      }
      railTitle="Activation"
    >
      <div className="space-y-5">
        {offline && (
          <Alert tone="caution" title="No connection — activation still works">
            The activation and the clock capture locally and queue. The paging goes out over the phone rota instead.
          </Alert>
        )}

        {aiActive && !activated && (
          <AIBanner
            capabilityId="AI-209"
            tone="caution"
            title="A possible stroke has been detected from the triage note"
            detail="Sudden right-sided weakness with speech difficulty, onset within the window. This is a prompt — it does not activate anything."
            explain={{
              touchpointId: 'stroke:detect',
              capabilityId: 'AI-209',
              claim: 'The triage entry describes a presentation consistent with an acute stroke.',
              confidence: 0.83,
              band: 'HIGH',
              computedAt: formatTime(caseNow),
              inputs: [
                { label: 'ED triage free text', source: 'Triage assessment' },
                { label: 'Recorded onset time', source: 'Triage assessment' },
              ],
              evidence: ['Unilateral weakness plus dysarthria, with an onset time inside 4.5 hours.'],
              model: 'pathway-detect v3.3.0',
              limits: [
                'Reads the triage text. A presentation nobody has written down does not reach it.',
                'It prompts and never activates. The manual button is always present and never gated on this.',
                'It has no view of the examination you have just done.',
              ],
            }}
          />
        )}

        {!activated ? (
          <>
            {/* The one-tap action, first on the page. */}
            <Card className="p-6 text-center md:p-10">
              <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Activate a code stroke</h2>
              <p className="mx-auto mt-2 max-w-lg text-ink-2">
                One tap starts the clock, pages the team and puts the case on the network wall. Nothing below is
                required first.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActivated(true)
                  toast({
                    tone: 'critical',
                    title: 'Code stroke activated',
                    detail: `STROKE/26-27/${ACTIVE_CASE.id} · clock started at ${formatTime(caseNow)} · team paged.`,
                  })
                }}
                className="ai-surface mx-auto mt-6 flex min-h-20 w-full max-w-md items-center justify-center gap-3 rounded-card px-8 text-lg font-bold shadow-bubble hover:brightness-110 active:scale-[0.99] md:text-xl"
              >
                <Icon name="Siren" size={26} />
                ACTIVATE CODE STROKE
              </button>
              <p className="mt-3 text-[0.9em] text-ink-3">
                Always enabled · works offline · works with the AI off
              </p>
            </Card>

            <ScreenSection title="What one tap does" subtitle="Six things, in parallel">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {TRIGGERS.map((t) => (
                  <Card key={t.label} className="p-4">
                    <p className="flex items-center gap-2 font-medium">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-isolation-soft text-isolation">
                        <Icon name={t.icon} size={15} />
                      </span>
                      {t.label}
                    </p>
                    <p className="mt-1.5 text-[0.9em] text-ink-3">{t.detail}</p>
                  </Card>
                ))}
              </div>
            </ScreenSection>

            <ScreenSection title="Optional context" subtitle="None of it gates the activation">
              <Card className="p-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <Field label="Site" htmlFor="act-site">
                    <Select id="act-site" value={site} onChange={(e) => setSite(e.target.value)}>
                      {FACILITIES.map((f) => (
                        <option key={f.code} value={f.code}>
                          {f.code} · {f.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="How they arrived" htmlFor="act-source">
                    <Select id="act-source" value={source} onChange={(e) => setSource(e.target.value)}>
                      {[
                        'Walk-in to the emergency department',
                        'Ambulance, pre-notified',
                        'Ambulance, not pre-notified',
                        'In-hospital, already admitted',
                        'Transferred from another site',
                      ].map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Last known well" htmlFor="act-lkw" hint="Unknown is acceptable">
                    <TextInput id="act-lkw" type="time" value={lkw} onChange={(e) => setLkw(e.target.value)} />
                  </Field>
                </div>
              </Card>
            </ScreenSection>
          </>
        ) : (
          <>
            <Alert tone="normal" title={`Activated · STROKE/26-27/${ACTIVE_CASE.id}`}>
              The clock started at {formatTime(caseNow)}. Door time is stamped from the server. The team has been
              paged and the case is on the wall.
            </Alert>

            <ScreenSection title="Paging" subtitle="Who was paged, and who has answered">
              <Card className="overflow-hidden">
                <ul className="divide-y divide-glass-hairline">
                  {PAGING_LOG.map((x) => (
                    <li key={x.role} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{x.role}</span>
                        <span className="block truncate text-[0.88em] text-ink-3">
                          {x.name} · {x.channel}
                        </span>
                      </span>
                      {x.ackAt ? (
                        <Chip tone="normal" icon="Check">
                          answered {formatTime(x.ackAt)}
                        </Chip>
                      ) : (
                        <Chip tone="caution" icon="Clock">
                          paged {formatTime(x.pagedAt)}, no answer yet
                        </Chip>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            </ScreenSection>

            <div className="flex flex-wrap gap-2">
              <Button
                tone="primary"
                size="lg"
                icon="Clock"
                onClick={() => navigate(`/stroke/case/${ACTIVE_CASE.id}/clock`)}
              >
                Open the case clock
              </Button>
              <Button size="lg" icon="ClipboardList" onClick={() => navigate(`/stroke/case/${ACTIVE_CASE.id}/intake`)}>
                Complete the intake
              </Button>
              <Button size="lg" icon="Video" onClick={() => navigate('/stroke/telestroke/queue')}>
                Telestroke queue
              </Button>
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
