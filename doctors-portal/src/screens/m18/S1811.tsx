/**
 * S-18-11 · Telestroke Session — `/stroke/case/:id/telestroke` · T2 · ARC-22
 *
 * "Video, imaging and the NIHSS on one surface."
 *
 * ARC-22 puts video in Z5 and the live transcript plus the drafted note in Z6.
 * The reason the three are on one surface is practical: a neurologist who has
 * to switch windows to see the CT loses the examination.
 *
 * Calm pass: the imaging panel is one line and a link to the screen that owns
 * the read, rather than a second copy of the findings table; the two "why this
 * is here" notes fold behind Why. The recording indicator, the extracted-NIHSS
 * suggestion, the transcript, the note and the Z7a bar are untouched.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SuggestionCard } from '@/components/ai'
import { PillLink, SectionCard, Why } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Button, Card, Chip, Icon, cx } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { formatTime } from '@/data/format'
import { patient, staff } from '@/data/kit'
import { NIHSS_TOTAL, strokeCase } from '@/data/stroke'
import { triageSummary } from '@/data/strokeai'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const TRANSCRIPT = [
  { at: 12, who: 'Hub', text: 'Dr. Menon, I can see you. Can you turn the camera to the patient?' },
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
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [ending, setEnding] = useState(false)
  const toast = useUI((s) => s.toast)

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
      heading="Telestroke session"
      subheading={
        <>
          {hub.name} at the hub · {spoke.name} at {c.originFacility}
        </>
      }
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
          <Button icon="PhoneOff" tone="destructive" onClick={() => setEnding(true)}>
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
        {/* Z5 — the examination itself. */}
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
              {/* Recording is visible to everyone on the call, always. */}
              <div className="absolute top-3 left-3 flex items-center gap-2 rounded-pill bg-[rgb(0_0_0/0.5)] px-2.5 py-1">
                <span className="size-2 rounded-pill bg-abnormal" />
                <span className="text-[0.78em] font-semibold text-white">RECORDING · with consent</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-4 py-3">
              <Button size="sm" icon={muted ? 'MicOff' : 'Mic'} aria-pressed={muted} tone={muted ? 'primary' : 'secondary'} onClick={() => setMuted((m) => !m)}>
                {muted ? 'Unmute' : 'Mute'}
              </Button>
              <Button size="sm" icon="Video" aria-pressed={cameraOff} tone={cameraOff ? 'primary' : 'secondary'} onClick={() => setCameraOff((v) => !v)}>
                {cameraOff ? 'Camera off' : 'Camera'}
              </Button>
              <Button
                size="sm"
                icon="MonitorSmartphone"
                onClick={() => toast({ tone: 'info', title: 'CT shared to the call', detail: `${spoke.name} now sees the same slice you do.` })}
              >
                Share the CT
              </Button>
            </div>
          </Card>

          {aiActive && (
            <SectionCard
              title="Imaging"
              action={<PillLink to={`/stroke/case/${c.id}/imaging`}>Open the read</PillLink>}
              bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
            >
              <p className="text-[0.95em]">
                {triageSummary(c).map((f, i) => (
                  <span key={f.label}>
                    {i > 0 && <span className="text-ink-3"> · </span>}
                    <span className="text-ink-3">{f.label} </span>
                    <span className={cx('tabular font-semibold', f.emphasisNegative && 'text-normal')}>{f.value}</span>
                  </span>
                ))}
              </p>
              <Why label="Why the scan sits beside the examination" className="mt-2">
                <p className="text-ink-2">
                  Shown here so the examination and the scan are read together. Confirming the finding still happens on
                  the imaging screen, under its own G3 gate — this line is a reminder, not the read.
                </p>
              </Why>
            </SectionCard>
          )}
        </div>

        {/* Z6 — live transcript and the drafted note. */}
        <div className="space-y-4">
          <SectionCard
            title="Live transcript"
            meta={<span className="text-[0.88em] text-ink-3">speech to text</span>}
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <div className="thin-scroll max-h-72 space-y-2.5 overflow-y-auto">
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
            <Why label="What is kept, and what happens if the service drops" className="mt-2">
              <p className="text-ink-2">
                The raw transcript is retained verbatim. If the speech service drops, the video continues and this
                becomes plain typing.
              </p>
            </Why>
          </SectionCard>

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

          <SectionCard title="Your note" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <VoiceField
              id={`telestroke-note-${c.id}`}
              label="Telestroke note"
              rows={5}
              value={notes}
              onChange={setNotes}
              patientId={p.id}
              placeholder="Anything the transcript will not capture — what you saw rather than what was said…"
            />
          </SectionCard>
        </div>
      </div>
      <ConfirmDialog
        open={ending}
        title="End the telestroke session?"
        consequence="The call closes for everyone on it. The recording and the transcript are kept with the case; the note you have written stays a draft."
        confirmLabel="End the session"
        tone="destructive"
        onConfirm={() => {
          setEnding(false)
          toast({ tone: 'info', title: 'Session ended', detail: `${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s · recording kept with case ${c.caseNo}.` })
          navigate('/stroke/telestroke/queue')
        }}
        onCancel={() => setEnding(false)}
      />
    </Screen>
  )
}
