/**
 * 🎙 Add note — voice to text, editable before saving.
 *
 * Tap → record → live transcription → editable box → edit → Save.
 *
 * THERE IS NO AUTOSAVE HERE, and that is deliberate. `ARC-15` autosaves a
 * draft every 20 seconds everywhere else in this application, but the brief for
 * this control is explicit — "No auto-save without confirmation" — and a
 * half-heard sentence committed to a clinical record without the author looking
 * at it is a different class of problem from a half-typed one. Nothing leaves
 * this panel until Save is pressed.
 *
 * Speech recognition is REAL where the browser has it. `SpeechRecognition` is
 * still prefixed in Chromium and absent in Firefox and in most WebViews, and a
 * clinician can decline the microphone, so there is a second path: a captured
 * sample streams word by word and the panel SAYS SO in one line. A fallback
 * that pretends to be live is worse than no fallback.
 *
 * Both paths report the same three things into the explainability drawer, which
 * §4.7 requires of any AI-assisted entry: what produced the text, how confident
 * it was, and what it cannot do.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { Modal } from '@/components/overlays'
import { Button, Icon, TextArea, cx } from '@/components/primitives'
import { bandFor } from '@/atlas/confidence'
import type { ConfidenceBand } from '@/atlas/confidence'
import { LANGUAGES } from '@/data/kit'
import type { LanguageCode } from '@/data/kit'
import { useAudit } from '@/store/audit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'

// ───────────────────────────────── The Web Speech API, minimally typed

/** `lib.dom` still does not ship these, so the surface we use is declared here. */
interface SRAlternative {
  transcript: string
  confidence: number
}
interface SRResult {
  readonly length: number
  readonly isFinal: boolean
  [index: number]: SRAlternative
}
interface SRResultList {
  readonly length: number
  [index: number]: SRResult
}
interface SREvent {
  resultIndex: number
  results: SRResultList
}
interface SRErrorEvent {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SREvent) => void) | null
  onerror: ((e: SRErrorEvent) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function recognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** GP-08 — dictation follows the USER's language, not the patient's. */
export const BCP47: Record<LanguageCode, string> = {
  EN: 'en-IN',
  HI: 'hi-IN',
  KN: 'kn-IN',
}

// ────────────────────────────────────────── The captured-sample fallback

/**
 * Seeded from each patient's own record, so the fallback is still THIS
 * patient's note rather than lorem ipsum. Kept short — this control is for a
 * bedside note, not a consultation; S-06-04 drafts those.
 */
const SAMPLES: Record<string, string> = {
  'SD-P-03':
    'Reviewed at the bedside. More breathless overnight, oxygen up to four litres since four twenty. Respiratory rate twenty-six, saturations ninety-two percent, still febrile at thirty-eight four. Not turning the corner at seventy-two hours. Broadening antibiotic cover after checking the allergy record, repeating the chest film today, and I will review again at two.',
  'SD-P-07':
    'Potassium six point eight on the sample from this morning, up from five point four. Ventilated, on noradrenaline, urine output falling. Starting insulin dextrose and calcium gluconate now, ECG requested, and I have spoken to the renal registrar about filtration.',
  'SD-P-02':
    'Day two after coronary artery bypass grafting. Comfortable, drains draining serous fluid, chest clear. For physiotherapy review and drain removal tomorrow if output stays below the threshold.',
  'SD-P-08':
    'Unidentified male, approximately forty, brought in after a road traffic accident. Observations have not been charted since seven oh five, so I have asked the nurse in charge for a full set now. Medico-legal docket still open and identity pending.',
  'SD-P-09': 'Stable for dialysis today at two. No fluid overload, access site clean and functioning.',
}

const DEFAULT_SAMPLE =
  'Reviewed at the bedside. Observations stable, patient comfortable, no new complaints. Continuing the current plan and will review tomorrow.'

/**
 * Per the atlas's own line on `AI-101`: dictation cleanup produces punctuation
 * and casing, and the confidence it reports is the recogniser's, not a
 * clinician's judgement of the content.
 */
const FALLBACK_MODEL = 'AI-101 v3.2.0 · captured sample'
const FALLBACK_CONFIDENCE = 0.88

// ───────────────────────────────────────────────────────────── The hook

type Phase = 'idle' | 'recording' | 'review'

export interface DictationState {
  phase: Phase
  /** Text already settled — final results, or the sample as it arrives. */
  settled: string
  /** The words still in flight. Rendered quietly, never editable. */
  interim: string
  /** 0…1 bars for the waveform. */
  bars: number[]
  live: boolean
  model: string
  confidence: number
  band: ConfidenceBand
  /** Set where the live path could not start, so the panel can say why. */
  notice: string | null
  elapsedSec: number
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * One microphone at a time. Several `VoiceField`s can sit on one note, and two
 * recognisers competing for the same stream is how words land in the wrong
 * section. The first to claim it records; the others say so and wait.
 */
export const useVoiceArbiter = create<{
  activeId: string | null
  claim: (id: string) => boolean
  release: (id: string) => void
}>()((set, get) => ({
  activeId: null,
  claim: (id) => {
    if (get().activeId !== null && get().activeId !== id) return false
    set({ activeId: id })
    return true
  },
  release: (id) => {
    if (get().activeId === id) set({ activeId: null })
  },
}))

export interface DictationOptions {
  /** Overrides the per-patient captured sample — e.g. the seed text for THIS section. */
  sample?: string
  /** Milliseconds per streamed word on the fallback path. */
  wordMs?: number
}

export function useDictation(patientId: string | undefined, open: boolean, opts?: DictationOptions): DictationState {
  const language = useSession((s) => s.language)
  const wordMs = opts?.wordMs ?? 130
  const sampleOverride = opts?.sample

  const [phase, setPhase] = useState<Phase>('idle')
  const [settled, setSettled] = useState('')
  const [interim, setInterim] = useState('')
  const [bars, setBars] = useState<number[]>(() => new Array(28).fill(0.06))
  const [live, setLive] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [confidence, setConfidence] = useState(FALLBACK_CONFIDENCE)
  const [elapsedSec, setElapsedSec] = useState(0)

  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const audio = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null)
  const sampleTimer = useRef<number | null>(null)

  const sample = useMemo(
    () => sampleOverride ?? (patientId ? (SAMPLES[patientId] ?? DEFAULT_SAMPLE) : DEFAULT_SAMPLE),
    [patientId, sampleOverride],
  )

  /** Everything the panel started gets torn down here, on every exit path. */
  const teardown = useCallback(() => {
    recognition.current?.abort()
    recognition.current = null
    if (sampleTimer.current !== null) {
      window.clearInterval(sampleTimer.current)
      sampleTimer.current = null
    }
    if (audio.current) {
      window.cancelAnimationFrame(audio.current.raf)
      audio.current.stream.getTracks().forEach((t) => t.stop())
      void audio.current.ctx.close()
      audio.current = null
    }
  }, [])

  useEffect(() => teardown, [teardown])
  useEffect(() => {
    if (!open) {
      teardown()
      setPhase('idle')
      setSettled('')
      setInterim('')
      setElapsedSec(0)
      setNotice(null)
      setBars(new Array(28).fill(0.06))
    }
  }, [open, teardown])

  /** The elapsed counter, so a short recording is visibly short. */
  useEffect(() => {
    if (phase !== 'recording') return
    const t = window.setInterval(() => setElapsedSec((s) => s + 1), 1000)
    return () => window.clearInterval(t)
  }, [phase])

  /** A real waveform off the microphone, where we have one. */
  const startMeter = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      ctx.createMediaStreamSource(stream).connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)

      const tick = () => {
        analyser.getByteTimeDomainData(data)
        // Peak deviation from the 128 midpoint, as a 0…1 amplitude.
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
        setBars((prev) => [...prev.slice(1), Math.max(0.06, Math.min(1, peak * 2.2))])
        if (audio.current) audio.current.raf = window.requestAnimationFrame(tick)
      }
      audio.current = { ctx, stream, raf: window.requestAnimationFrame(tick) }
      return stream
    } catch {
      return null
    }
  }, [])

  /** The captured sample, word by word, with a synthetic but plausible trace. */
  const startSample = useCallback(() => {
    const words = sample.split(' ')
    let i = 0
    setLive(false)
    setConfidence(FALLBACK_CONFIDENCE)
    setPhase('recording')
    sampleTimer.current = window.setInterval(() => {
      i += 1
      setSettled(words.slice(0, i).join(' '))
      setInterim(i < words.length ? words[i] : '')
      // Deterministic, so the demo looks the same every time it is run.
      setBars((prev) => [...prev.slice(1), 0.18 + Math.abs(Math.sin(i * 0.9)) * 0.72])
      if (i >= words.length) {
        if (sampleTimer.current !== null) window.clearInterval(sampleTimer.current)
        sampleTimer.current = null
        setInterim('')
        setPhase('review')
      }
    }, wordMs)
  }, [sample, wordMs])

  const start = useCallback(() => {
    setSettled('')
    setInterim('')
    setElapsedSec(0)
    setNotice(null)

    const Ctor = recognitionCtor()
    if (!Ctor) {
      setNotice(
        'Live speech recognition is unavailable in this browser — showing a captured sample. Typing is always available.',
      )
      startSample()
      return
    }

    void (async () => {
      const stream = await startMeter()
      if (!stream) {
        setNotice(
          'The microphone was not available — showing a captured sample. Typing is always available.',
        )
        startSample()
        return
      }

      const rec = new Ctor()
      rec.lang = BCP47[language]
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1

      rec.onresult = (e) => {
        let final = ''
        let pending = ''
        let best = 0
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const r = e.results[i]
          const alt = r[0]
          if (r.isFinal) {
            final += alt.transcript
            best = Math.max(best, alt.confidence || 0)
          } else {
            pending += alt.transcript
          }
        }
        if (final) {
          setSettled((s) => (s ? `${s}${final}` : final.replace(/^\s+/, '')))
          // The recogniser reports 0 in some builds; a reported 0 is not a
          // measured 0, so it is treated as "no score" rather than as LOW.
          if (best > 0) setConfidence(best)
        }
        setInterim(pending)
      }

      rec.onerror = (e) => {
        setNotice(
          e.error === 'not-allowed'
            ? 'Microphone access was declined — showing a captured sample. Typing is always available.'
            : `Speech recognition stopped (${e.error}) — showing a captured sample. Typing is always available.`,
        )
        teardown()
        startSample()
      }

      rec.onend = () => {
        setInterim('')
        setPhase((p) => (p === 'recording' ? 'review' : p))
      }

      recognition.current = rec
      setLive(true)
      setPhase('recording')
      try {
        rec.start()
      } catch {
        setNotice('Speech recognition would not start — showing a captured sample.')
        teardown()
        startSample()
      }
    })()
  }, [language, startMeter, startSample, teardown])

  const stop = useCallback(() => {
    if (recognition.current) {
      recognition.current.stop()
    } else if (sampleTimer.current !== null) {
      window.clearInterval(sampleTimer.current)
      sampleTimer.current = null
    }
    if (audio.current) {
      window.cancelAnimationFrame(audio.current.raf)
      audio.current.stream.getTracks().forEach((t) => t.stop())
      void audio.current.ctx.close()
      audio.current = null
    }
    setInterim('')
    setPhase('review')
  }, [])

  const reset = useCallback(() => {
    teardown()
    setPhase('idle')
    setSettled('')
    setInterim('')
    setElapsedSec(0)
    setBars(new Array(28).fill(0.06))
  }, [teardown])

  return {
    phase,
    settled,
    interim,
    bars,
    live,
    model: live ? `${navigator.userAgent.includes('Edg') ? 'Edge' : 'Chromium'} SpeechRecognition · ${BCP47[language]}` : FALLBACK_MODEL,
    confidence,
    band: bandFor(confidence),
    notice,
    elapsedSec,
    start,
    stop,
    reset,
  }
}

// ────────────────────────────────────────────────────────────── Waveform

export function Waveform({ bars, active }: { bars: number[]; active: boolean }) {
  return (
    <div
      aria-hidden
      className="flex h-10 flex-1 items-center justify-between gap-[2px] overflow-hidden"
    >
      {bars.map((b, i) => (
        <span
          key={i}
          className={cx('w-full rounded-pill transition-[height] duration-100', active ? 'bg-ai' : 'bg-inactive-soft')}
          style={{ height: `${Math.max(6, b * 100)}%` }}
        />
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────── The panel

export function DictationPanel({
  open,
  onClose,
  patientId,
  patientName,
}: {
  open: boolean
  onClose: () => void
  /** Undefined for a free note not yet attached to anyone. */
  patientId?: string
  patientName?: string
}) {
  const d = useDictation(patientId, open)
  const me = useCurrentStaff()
  const language = useSession((s) => s.language)
  const record = useAudit((s) => s.record)
  const saveVoiceNote = useClinical((s) => s.saveVoiceNote)
  const toast = useUI((s) => s.toast)

  const [edited, setEdited] = useState<string | null>(null)
  const transcriptLogged = useRef(false)

  // The body the clinician will actually save: their edit if they made one,
  // otherwise what was heard.
  const body = edited ?? d.settled

  useEffect(() => {
    if (!open) {
      setEdited(null)
      transcriptLogged.current = false
    }
  }, [open])

  /** Audit event one of two: the transcript existed. */
  useEffect(() => {
    if (d.phase !== 'review' || transcriptLogged.current || d.settled.trim() === '') return
    transcriptLogged.current = true
    record({
      event: 'AI.SCRIBE.TRANSCRIPT_CREATED',
      actor: me.name,
      actorId: me.id,
      subject: patientId,
      model: d.model,
      gate: 'G2',
      detail: `${d.settled.trim().split(/\s+/).length} words · ${d.live ? 'live recognition' : 'captured sample'} · ${d.band}`,
    })
  }, [d.phase, d.settled, d.model, d.live, d.band, me.id, me.name, patientId, record])

  function save() {
    const text = body.trim()
    if (text === '') return
    saveVoiceNote({ patientId: patientId ?? 'unattached', body: text, by: me.name, model: d.model, band: d.band })
    /** Audit event two of two: what was committed, by whom, under which gate. */
    record({
      event: 'NOTE.DRAFT_SAVED',
      actor: me.name,
      actorId: me.id,
      subject: patientId,
      model: d.model,
      gate: 'G2',
      detail: `Dictated note saved${edited !== null ? ' after manual edit' : ' unedited'} · ${text.split(/\s+/).length} words`,
    })
    toast({
      tone: 'success',
      title: 'Note saved as a draft',
      detail: patientName ? `${patientName} · not signed` : 'Not attached to a patient · not signed',
    })
    onClose()
  }

  const wordCount = body.trim() === '' ? 0 : body.trim().split(/\s+/).length

  return (
    <Modal
      open={open}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <Icon name="Mic" size={16} />
          Add note
        </span>
      }
      subtitle={patientName ?? 'Not attached to a patient'}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[0.86em] text-ink-3">
            {d.phase === 'review' ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'} · nothing is saved until you press Save` : ' '}
          </span>
          {d.phase === 'review' && (
            <Button icon="RotateCcw" onClick={() => { setEdited(null); d.reset() }}>
              Retry
            </Button>
          )}
          <Button icon="X" onClick={onClose}>
            Discard
          </Button>
          <Button tone="primary" icon="Check" disabled={d.phase !== 'review' || wordCount === 0} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* The recorder. One control, large, unambiguous. */}
        {/* The brief's `.voice-active`: accent border + glow only while the mic is live. */}
        <div
          className={cx(
            'flex flex-wrap items-center gap-4 rounded-panel border bg-glass-fill-muted px-4 py-3.5',
            'transition-[border-color,box-shadow] duration-[250ms]',
            d.phase === 'recording' ? 'voice-active' : 'border-transparent',
          )}
        >
          {d.phase === 'idle' ? (
            <Button tone="ai" size="lg" icon="Mic" onClick={d.start} className="w-full sm:w-auto">
              Start dictation
            </Button>
          ) : (
            <>
              <button
                type="button"
                onClick={d.phase === 'recording' ? d.stop : d.start}
                aria-label={d.phase === 'recording' ? 'Stop recording' : 'Dictate again'}
                className={cx(
                  'inline-flex size-12 shrink-0 items-center justify-center rounded-pill',
                  d.phase === 'recording' ? 'bg-abnormal text-white' : 'ai-surface',
                )}
              >
                <Icon name={d.phase === 'recording' ? 'Square' : 'Mic'} size={20} />
              </button>
              <Waveform bars={d.bars} active={d.phase === 'recording'} />
              <span className="tabular shrink-0 text-[0.92em] font-medium text-ink-2">
                {String(Math.floor(d.elapsedSec / 60)).padStart(2, '0')}:
                {String(d.elapsedSec % 60).padStart(2, '0')}
              </span>
            </>
          )}
        </div>

        {/* Which path is running, said plainly rather than implied. */}
        {d.notice ? (
          <p className="flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2.5 text-[0.9em] text-caution">
            <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
            {d.notice}
          </p>
        ) : (
          d.phase !== 'idle' && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.86em] text-ink-3">
              <span className="flex items-center gap-1.5">
                <Diamond size={10} />
                {d.live ? 'Live recognition' : 'Captured sample'}
              </span>
              <span>{d.model}</span>
              <span>{LANGUAGES.find((l) => l.code === language)?.label}</span>
            </p>
          )
        )}

        {/* Live words while recording; an editable box once it stops. */}
        {d.phase === 'recording' && (
          <p
            aria-live="polite"
            className="ai-ghost min-h-24 rounded-panel px-3.5 py-3 leading-relaxed"
          >
            {d.settled}
            {d.interim && <span className="text-ink-3"> {d.interim}</span>}
            {d.settled === '' && d.interim === '' && (
              <span className="text-ink-muted">Listening…</span>
            )}
          </p>
        )}

        {d.phase === 'review' && (
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="dictation-draft" className="text-[0.92em] font-medium text-ink-2">
                Draft — edit before saving
              </label>
              <Confidence band={d.band} score={d.confidence} />
            </div>
            <TextArea
              id="dictation-draft"
              rows={7}
              value={body}
              onChange={(e) => setEdited(e.target.value)}
              className="bg-glass-fill-strong"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <WhyLink
                target={{
                  touchpointId: `dictation-${patientId ?? 'unattached'}`,
                  capabilityId: 'AI-101',
                  claim: 'This text is a transcription of what was said, not a clinical assessment of it.',
                  confidence: d.confidence,
                  band: d.band,
                  computedAt: 'just now',
                  inputs: [
                    {
                      label: d.live ? 'Microphone audio, this session' : 'Captured sample for this patient',
                      source: d.model,
                    },
                    { label: 'Recognition language', source: BCP47[language] },
                  ],
                  evidence: [
                    'Words are transcribed as recognised; punctuation and casing are added.',
                    'No clinical content is inferred, checked or corrected.',
                  ],
                  model: d.model,
                  limits: [
                    'A transcription confidence is not a statement about whether the content is correct.',
                    d.live
                      ? 'Accuracy falls with background noise, accent and unfamiliar drug names — read it before saving.'
                      : 'This is a captured sample, not your speech. It is shown because live recognition was unavailable.',
                    'Nothing is written to the record until Save is pressed.',
                  ],
                }}
              />
              {edited !== null && (
                <span className="flex items-center gap-1.5 text-[0.86em] font-medium text-normal">
                  <Icon name="PenLine" size={12} />
                  edited by you
                </span>
              )}
            </div>
          </div>
        )}

        {d.phase === 'idle' && (
          <p className="flex items-start gap-2 px-1 text-[0.88em] text-ink-3">
            <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
            Speech is transcribed as you talk and stays editable. Nothing is saved until you press Save, and typing
            instead is always available.
          </p>
        )}
      </div>
    </Modal>
  )
}
