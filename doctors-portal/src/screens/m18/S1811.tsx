/**
 * S-18-11 · Telestroke Session — `/stroke/case/:id/telestroke` · T2 · ARC-22
 *
 * "Video, imaging and the NIHSS on one surface."
 *
 * ARC-22 puts video in Z5 and the live transcript plus the drafted note in Z6.
 * The reason the three are on one surface is practical: a neurologist who has
 * to switch windows to see the CT loses the examination.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, SuggestionCard } from '@/components/ai'
import { Button, Card, Chip, Icon, TextArea, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient, staff } from '@/data/kit'
import { IMAGING_TRIAGE, NIHSS_TOTAL, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const TRANSCRIPT = [
  { at: 12, who: 'Hub', text: 'Dr Menon, I can see you. Can you turn the camera to the patient?' },
  { at: 24, who: 'Spoke', text: 'One moment. There — can you see his face?' },
  { at: 38, who: 'Hub', text: 'Yes. Mr Malhotra, can you smile for me? Good. Now show me your teeth.' },
  { at: 56, who: 'Hub', text: 'Right lower facial weakness. Now both arms out in front of you, palms up.' },
  { at: 74, who: 'Hub', text: 'Right arm drops immediately, no effort against gravity. That is a three.' },
  { at: 96, who: 'Hub', text: 'Mr Malhotra, what is this object? Can you name it for me?' },
  { at: 112, who: 'Spoke', text: 'He is trying but not getting the word out.' },
  { at: 124, who: 'Hub', text: 'Expressive aphasia. That is a two on language. Total is fourteen.' },
]

export function S1811({ id }: { id?: string }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const [elapsed, setElapsed] = useState(0)
  const [notes, setNotes] = useState('')

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const spoke = staff('SD-S-03')
  const hub = staff('SD-S-02')

  useEffect(() => {
    const t = window.setInterval(() => setElapsed((e) => Math.min(e + 2, 130)), 300)
    return () => window.clearInterval(t)
  }, [])

  const heard = TRANSCRIPT.filter((l) => l.at <= elapsed)

  return (
    <Screen
      screenId="S-18-11"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="thread"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'AI-OFF', 'AI-LOW']}
      wide
      chips={
        <>
          <Chip tone="normal" icon="Video">
            in session · {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </Chip>
          <Chip tone="caution" icon="WifiLow">
            bandwidth 640 kbps
          </Chip>
        </>
      }
      actions={
        <>
          <Button icon="Activity" onClick={() => navigate(`/stroke/case/${c.id}/nihss`)}>
            NIHSS
          </Button>
          <Button icon="Scan" onClick={() => navigate(`/stroke/case/${c.id}/imaging`)}>
            Imaging
          </Button>
        </>
      }
      actionBar={
        <>
          <Button icon="PhoneOff" tone="destructive">
            End the session
          </Button>
          <span className="text-[0.88em] text-ink-3">
            Recorded with consent · the session note is drafted from the transcript
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Syringe"
            onClick={() => navigate(`/stroke/case/${c.id}/thrombolysis`)}
          >
            Go to the decision
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* Z5 — video and imaging side by side. */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="relative aspect-video w-full bg-[#0a0d14]">
              {/* A representational video frame. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <span className="mx-auto flex size-16 items-center justify-center rounded-pill bg-[#1a2030] text-[#6b7690]">
                    <Icon name="User" size={30} />
                  </span>
                  <p className="mt-2 text-[0.9em] text-[#8b94a8]">
                    {p.name} · bedside camera at {c.originFacility}
                  </p>
                </div>
              </div>
              {/* The spoke physician, picture-in-picture. */}
              <div className="absolute right-3 bottom-3 flex size-24 flex-col items-center justify-center rounded-panel bg-[#151b28] text-center">
                <Icon name="User" size={18} className="text-[#6b7690]" />
                <p className="mt-1 px-1 text-[10px] leading-tight text-[#8b94a8]">{spoke.name}</p>
              </div>
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-pill bg-[rgb(0_0_0/0.5)] px-2.5 py-1">
                <span className="size-2 rounded-pill bg-abnormal" />
                <span className="text-[0.78em] font-semibold text-white">RECORDING</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <Button size="sm" icon="Mic">
                Mute
              </Button>
              <Button size="sm" icon="Video">
                Camera
              </Button>
              <Button size="sm" icon="MonitorSmartphone">
                Share the CT
              </Button>
              <span className="ml-auto text-[0.84em] text-ink-3">
                {hub.name} · hub · {formatTime(caseNow)}
              </span>
            </div>
          </Card>

          {aiActive && (
            <Card className="p-4">
              <h3 className="flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
                <Diamond size={10} />
                Imaging alongside the examination
              </h3>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {IMAGING_TRIAGE.findings.map((f) => (
                  <div key={f.label} className="flex items-center justify-between gap-2 rounded-panel bg-glass-fill-muted px-3 py-2">
                    <dt className="text-[0.9em] text-ink-2">{f.label}</dt>
                    <dd className={cx('tabular font-semibold', f.emphasisNegative && 'text-normal')}>{f.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-[0.84em] text-ink-3">
                Shown here so the examination and the scan are read together. Confirming the finding still happens on
                the imaging screen, under its own G3 gate.
              </p>
            </Card>
          )}
        </div>

        {/* Z6 — live transcript and the drafted note. */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="flex items-center justify-between gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              <span>Live transcript</span>
              {aiActive && (
                <span className="flex items-center gap-1.5 font-normal normal-case">
                  <Diamond size={9} />
                  AI-101
                </span>
              )}
            </h3>
            <div className="thin-scroll mt-2 max-h-72 space-y-2.5 overflow-y-auto">
              {heard.length === 0 && <p className="py-6 text-center text-[0.9em] text-ink-3">Waiting for speech…</p>}
              {heard.map((l) => (
                <div key={l.at} className="flex gap-2.5">
                  <span className="tabular w-8 shrink-0 pt-0.5 text-[0.78em] text-ink-muted">
                    {String(Math.floor(l.at / 60)).padStart(2, '0')}:{String(l.at % 60).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1 text-[0.92em]">
                    <span
                      className={cx(
                        'mr-1.5 text-[0.82em] font-semibold',
                        l.who === 'Hub' ? 'text-brand' : 'text-ink-3',
                      )}
                    >
                      {l.who}
                    </span>
                    {l.text}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.84em] text-ink-3">
              The raw transcript is retained verbatim. If the speech service drops, the video continues and this
              becomes plain typing.
            </p>
          </Card>

          {aiActive && elapsed >= 124 && (
            <SuggestionCard
              touchpointId={`tele:${c.id}:nihss`}
              capabilityId="AI-112"
              title={`NIHSS ${NIHSS_TOTAL} extracted from the examination`}
              evidence="Nine of the fifteen items were scored aloud during the examination and have been extracted. Six were not tested and remain blank rather than zero."
              band="MED"
              score={0.78}
              gate="G2"
              onAccept={() => navigate(`/stroke/case/${c.id}/nihss`)}
              explain={{
                touchpointId: `tele:${c.id}:nihss`,
                capabilityId: 'AI-112',
                claim: `A total NIHSS of ${NIHSS_TOTAL} was extracted from what you scored aloud.`,
                confidence: 0.78,
                band: 'MED',
                computedAt: formatTime(caseNow),
                inputs: TRANSCRIPT.filter((l) => l.who === 'Hub').slice(0, 4).map((l) => ({
                  label: l.text,
                  source: `Session transcript at ${String(Math.floor(l.at / 60)).padStart(2, '0')}:${String(l.at % 60).padStart(2, '0')}`,
                })),
                evidence: [
                  '"Right arm drops immediately, no effort against gravity. That is a three."',
                  '"Expressive aphasia. That is a two on language."',
                ],
                model: 'extract v4.1.0',
                limits: [
                  'Extracts only items you scored aloud. An item examined silently is not captured.',
                  'An untested item stays blank rather than defaulting to zero, because zero means normal.',
                  'Manual scoring is the fallback and the authority.',
                ],
              }}
            />
          )}

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Your note</h3>
            <TextArea
              className="mt-2"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the transcript will not capture — what you saw rather than what was said…"
            />
          </Card>
        </div>
      </div>
    </Screen>
  )
}
