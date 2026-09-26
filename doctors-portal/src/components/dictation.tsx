/**
 * 🎙 Dictation — the clinician's own voice, turned into editable text.
 *
 * Tap → the browser asks for the microphone → live transcription into the box
 * → Stop → edit → Save.
 *
 * THERE IS NO AUTOSAVE HERE, and that is deliberate. `ARC-15` autosaves a
 * draft every 20 seconds everywhere else in this application, but the brief for
 * this control is explicit — "No auto-save without confirmation" — and a
 * half-heard sentence committed to a clinical record without the author looking
 * at it is a different class of problem from a half-typed one. Nothing leaves
 * this panel until Save is pressed.
 *
 * Speech recognition is REAL, and only real. It is the browser's own Web
 * Speech API — `SpeechRecognition`, still prefixed in Chromium and Safari —
 * which Chrome, Edge and Safari ship and Firefox does not. Brave ships the
 * constructor but blocks the speech service behind it, so it fails on its
 * first network call. Where recognition cannot run, the panel SAYS WHY in one
 * line and offers typing instead. There is no canned fallback: text that looks
 * like a transcription and is not one is worse than an empty box.
 *
 * The permission prompt is the browser's, not ours. `getUserMedia` raises it
 * (and feeds the waveform); the recogniser then reuses the same grant. A
 * refusal, a missing microphone and an insecure page each get their own
 * sentence, because each has a different fix.
 *
 * Chrome ends a recognition session on its own — after a few seconds of
 * silence, and again at about a minute. The clinician did not press Stop, so
 * the session is restarted in place, rate-limited so a recogniser that keeps
 * dying cannot spin. `no-speech` and `aborted` are part of that normal rhythm;
 * everything else is a real failure, and what was already heard is kept.
 *
 * ONE MICROPHONE AT A TIME. Every recorder in the product goes through
 * `useVoiceArbiter`: starting one stops whichever other one is listening (its
 * words land where they were going), so two recognisers never fight over the
 * stream and no word lands in the wrong section.
 *
 * Every run reports the same three things into the explainability drawer,
 * which §4.7 requires of any AI-assisted entry: what produced the text, how
 * confident it was, and what it cannot do.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { create } from 'zustand'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { Modal } from '@/components/overlays'
import { Button, Icon, IconButton, TextArea, cx } from '@/components/primitives'
import { bandFor } from '@/atlas/confidence'
import type { ConfidenceBand } from '@/atlas/confidence'
import { formatClock } from '@/data/format'
import { LANGUAGES } from '@/data/kit'
import type { LanguageCode } from '@/data/kit'
import { joinSpeech } from '@/data/scribe'
import { useAudit } from '@/store/audit'
import { UNATTACHED, useClinical } from '@/store/clinical'
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

/** The engine is the browser's, so the model line names the browser. */
function browserName(): string {
  const ua = navigator.userAgent
  if ((navigator as unknown as { brave?: unknown }).brave) return 'Brave'
  if (/Edg\//.test(ua)) return 'Edge'
  if (/OPR\//.test(ua)) return 'Opera'
  if (/Chrome|Chromium|CriOS/.test(ua)) return 'Chrome'
  if (/Safari/.test(ua)) return 'Safari'
  return 'this browser'
}

function speechModel(language: LanguageCode): string {
  return `Web Speech API · ${browserName()} · ${BCP47[language]}`
}

// ─────────────────────────────────────────────── What to say when it cannot run

const NOTICE = {
  insecure: 'The microphone needs a secure page — open this site over https or on localhost.',
  unsupported: 'This browser can’t turn speech into text. Use Chrome, Edge or Safari — or type instead.',
  blocked:
    'Microphone access was blocked. Allow it from the padlock / site settings in the address bar, then press Dictate again.',
  noMic: 'No microphone was found on this device.',
  network:
    'The browser’s speech service could not be reached (Brave and some privacy settings block it). Use Chrome, Edge or Safari, or type instead.',
  keepsStopping:
    'Speech recognition keeps stopping on its own. What was heard is kept — press Dictate again, or type instead.',
} as const

function languageNotice(language: LanguageCode): string {
  const label = LANGUAGES.find((l) => l.code === language)?.label ?? BCP47[language]
  return `This browser’s speech recognition does not support ${label}. Switch your language in settings, or type instead.`
}

function mediaErrorNotice(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return NOTICE.blocked
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return NOTICE.noMic
  if (name === 'NotReadableError' || name === 'AbortError')
    return 'The microphone is in use by another app or tab. Close it there, then press Dictate again — or type instead.'
  return 'The microphone could not be opened. Press Dictate again, or type instead.'
}

// ─────────────────────────────────────────────────── One microphone at a time

/**
 * Several `VoiceField`s can sit on one note, and the scribe can open over
 * them. Two recognisers competing for the same stream is how words land in the
 * wrong section, so `take` stops whoever is listening before the next one
 * starts — their words land where they were going — and fields render their
 * mic as busy while another is live.
 */
export const useVoiceArbiter = create<{
  activeId: string | null
  take: (id: string, stop: () => void) => void
  release: (id: string) => void
}>()((set, get) => {
  /** The live recorder's Stop, held outside state so taking the mic never re-renders anyone. */
  let stopActive: (() => void) | null = null
  return {
    activeId: null,
    take: (id, stop) => {
      const current = get().activeId
      if (current !== null && current !== id) {
        const previous = stopActive
        stopActive = null
        previous?.()
      }
      stopActive = stop
      set({ activeId: id })
    },
    release: (id) => {
      if (get().activeId !== id) return
      stopActive = null
      set({ activeId: null })
    },
  }
})

// ───────────────────────────────────────────────────────────── The hook

export type DictationPhase = 'idle' | 'requesting' | 'recording' | 'review' | 'unavailable'

/** One final result from the recogniser — roughly, one utterance between pauses. */
export interface HeardSegment {
  text: string
  /** Seconds into the session when it settled. */
  atSec: number
}

/** What a finished run hands its owner. */
export interface DictationRun {
  text: string
  model: string
  confidence: number
  /** False where the recogniser reported no score — the band is then MED, never a number. */
  scored: boolean
  band: ConfidenceBand
  notice: string | null
}

export interface DictationState {
  phase: DictationPhase
  /** Final results, joined. */
  settled: string
  /** The words still in flight. */
  interim: string
  /** The final results one by one, with when each settled. */
  segments: HeardSegment[]
  /** 0…1 bars for the waveform. */
  bars: number[]
  /** True while the microphone is live. There is no other kind of run. */
  live: boolean
  model: string
  confidence: number
  scored: boolean
  band: ConfidenceBand
  /** Why recognition could not run or stopped, in words the clinician can act on. */
  notice: string | null
  /**
   * Set before anything is pressed where this browser cannot listen at all —
   * an insecure page, or no recogniser (Firefox). Brave is only found out on
   * the first attempt, because it ships the constructor and blocks the service.
   */
  supportNotice: string | null
  elapsedSec: number
  /** `resume` keeps what was heard and the clock — Pause / Resume on the scribe. */
  start: (opts?: { resume?: boolean }) => void
  stop: () => void
  /** Discards everything and returns to idle. `onEnd` is not called. */
  reset: () => void
}

export interface DictationOptions {
  /** The id this recorder holds the microphone under. Defaults to one per hook. */
  arbiterId?: string
  /**
   * Fires exactly once per `start()`, when that run ends — Stop, a failure, or
   * the microphone never opening — with what was heard. Not called by `reset`.
   */
  onEnd?: (run: DictationRun) => void
}

/**
 * Chrome reports 0 in some builds and Safari often reports nothing at all. A
 * reported 0 is not a measured 0, so it is "no score" — shown as the MED band
 * with no percentage — rather than LOW.
 */
const UNSCORED_CONFIDENCE = 0.7
/** Restarts allowed inside the window before a recogniser that keeps dying is called failed. */
const MAX_RESTARTS = 8
const RESTART_WINDOW_MS = 10_000
const QUIET_BARS = () => new Array<number>(28).fill(0.06)

/** Seconds recorded so far: what earlier runs banked, plus the run in progress. */
function secondsOf(c: { base: number; since: number | null }): number {
  return Math.floor(c.base + (c.since === null ? 0 : (Date.now() - c.since) / 1000))
}

export function useDictation(_patientId: string | undefined, open: boolean, opts?: DictationOptions): DictationState {
  const language = useSession((s) => s.language)
  const ownId = useId()
  const arbiterId = opts?.arbiterId ?? `dictation-${ownId}`

  const [phase, setPhase] = useState<DictationPhase>('idle')
  const [settled, setSettled] = useState('')
  const [interim, setInterim] = useState('')
  const [segments, setSegments] = useState<HeardSegment[]>([])
  const [bars, setBars] = useState<number[]>(QUIET_BARS)
  const [notice, setNotice] = useState<string | null>(null)
  const [confidence, setConfidence] = useState(UNSCORED_CONFIDENCE)
  const [scored, setScored] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [supportNotice] = useState<string | null>(() =>
    !window.isSecureContext
      ? NOTICE.insecure
      : !recognitionCtor() || !navigator.mediaDevices?.getUserMedia
        ? NOTICE.unsupported
        : null,
  )

  // The truth lives in refs, so event handlers never read a stale render.
  const text = useRef({ settled: '', interim: '', segments: [] as HeardSegment[] })
  const score = useRef({ confidence: UNSCORED_CONFIDENCE, scored: false })
  const recognition = useRef<SpeechRecognitionLike | null>(null)
  const audio = useRef<{ ctx: AudioContext | null; stream: MediaStream; raf: number } | null>(null)
  /** Final results already taken from the current recogniser session — a restart begins a new list. */
  const consumed = useRef(0)
  const clock = useRef<{ base: number; since: number | null }>({ base: 0, since: null })
  const run = useRef({ active: false, token: 0, stopping: false, restarts: [] as number[] })
  const optsRef = useRef(opts)
  const languageRef = useRef(language)
  const stopRef = useRef<() => void>(() => {})

  useEffect(() => {
    optsRef.current = opts
    languageRef.current = language
  })

  /** Everything a run opened is closed here, on every exit path. */
  const teardown = useCallback(() => {
    const rec = recognition.current
    recognition.current = null
    if (rec) {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      try {
        rec.abort()
      } catch {
        /* already ended */
      }
    }
    if (audio.current) {
      window.cancelAnimationFrame(audio.current.raf)
      audio.current.stream.getTracks().forEach((t) => t.stop())
      void audio.current.ctx?.close().catch(() => undefined)
      audio.current = null
    }
    const c = clock.current
    if (c.since !== null) {
      c.base += (Date.now() - c.since) / 1000
      c.since = null
    }
    // The trace settles when the microphone closes.
    setBars(QUIET_BARS())
  }, [])

  /** Words still in flight when a run ends are kept as heard, never dropped. */
  const promoteInterim = useCallback(() => {
    const t = text.current
    const pending = t.interim.trim()
    if (pending === '') return
    t.settled = joinSpeech(t.settled, pending)
    t.segments = [...t.segments, { text: pending, atSec: secondsOf(clock.current) }]
    t.interim = ''
    setSettled(t.settled)
    setSegments(t.segments)
    setInterim('')
  }, [])

  /** Closes the run's books: the arbiter is released and the owner told, once. */
  const endRun = useCallback(
    (endNotice: string | null) => {
      if (!run.current.active) return
      run.current.active = false
      useVoiceArbiter.getState().release(arbiterId)
      const s = score.current
      const conf = s.scored ? s.confidence : UNSCORED_CONFIDENCE
      optsRef.current?.onEnd?.({
        text: text.current.settled,
        model: speechModel(languageRef.current),
        confidence: conf,
        scored: s.scored,
        band: bandFor(conf),
        notice: endNotice,
      })
    },
    [arbiterId],
  )

  /** A real failure: keep what was heard, say why, stop listening. */
  const fail = useCallback(
    (why: string) => {
      run.current.stopping = true
      run.current.token += 1
      promoteInterim()
      teardown()
      setNotice(why)
      setPhase(text.current.settled.trim() !== '' ? 'review' : 'unavailable')
      endRun(why)
    },
    [endRun, promoteInterim, teardown],
  )

  const stop = useCallback(() => {
    if (!run.current.active) return
    const wasRequesting = recognition.current === null
    run.current.stopping = true
    run.current.token += 1
    promoteInterim()
    teardown()
    setElapsedSec(secondsOf(clock.current))
    setPhase(wasRequesting && text.current.settled.trim() === '' ? 'idle' : 'review')
    endRun(null)
  }, [endRun, promoteInterim, teardown])
  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  /** A real waveform off the microphone the browser just granted. */
  const startMeter = useCallback((stream: MediaStream) => {
    try {
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
    } catch {
      // No meter is not a reason to stop listening — the words still come.
      audio.current = { ctx: null, stream, raf: 0 }
    }
  }, [])

  const start = useCallback(
    (o?: { resume?: boolean }) => {
      if (run.current.active) return
      const resume = o?.resume === true
      if (!resume) {
        text.current = { settled: '', interim: '', segments: [] }
        score.current = { confidence: UNSCORED_CONFIDENCE, scored: false }
        clock.current = { base: 0, since: null }
        setSettled('')
        setSegments([])
        setConfidence(UNSCORED_CONFIDENCE)
        setScored(false)
        setElapsedSec(0)
      }
      setInterim('')
      setNotice(null)
      run.current = { active: true, token: run.current.token + 1, stopping: false, restarts: [] }
      const token = run.current.token
      useVoiceArbiter.getState().take(arbiterId, () => stopRef.current())

      if (!window.isSecureContext) return fail(NOTICE.insecure)
      const Ctor = recognitionCtor()
      if (!Ctor) return fail(NOTICE.unsupported)
      if (!navigator.mediaDevices?.getUserMedia) return fail(NOTICE.unsupported)

      setPhase('requesting')
      void (async () => {
        let stream: MediaStream
        try {
          // This is the call that raises the browser's permission prompt.
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (err) {
          if (token === run.current.token) fail(mediaErrorNotice(err))
          return
        }
        // Stopped or closed while the prompt was up.
        if (token !== run.current.token || run.current.stopping) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        startMeter(stream)

        const rec = new Ctor()
        rec.lang = BCP47[languageRef.current]
        rec.continuous = true
        rec.interimResults = true
        rec.maxAlternatives = 1

        rec.onresult = (e) => {
          if (recognition.current !== rec) return
          const t = text.current
          let pending = ''
          let best = 0
          const fresh: HeardSegment[] = []
          for (let i = e.resultIndex; i < e.results.length; i += 1) {
            const r = e.results[i]
            const alt = r[0]
            if (!alt) continue
            if (r.isFinal) {
              // A final result is taken once, however many events repeat it.
              if (i < consumed.current) continue
              consumed.current = i + 1
              const phrase = alt.transcript.trim()
              if (phrase !== '') fresh.push({ text: phrase, atSec: secondsOf(clock.current) })
              best = Math.max(best, alt.confidence || 0)
            } else {
              pending = joinSpeech(pending, alt.transcript)
            }
          }
          if (fresh.length > 0) {
            t.settled = fresh.reduce((acc, s) => joinSpeech(acc, s.text), t.settled)
            t.segments = [...t.segments, ...fresh]
            setSettled(t.settled)
            setSegments(t.segments)
            if (best > 0) {
              score.current = { confidence: best, scored: true }
              setConfidence(best)
              setScored(true)
            }
          }
          t.interim = pending
          setInterim(pending)
        }

        rec.onerror = (e) => {
          if (recognition.current !== rec) return
          // Silence, and Chrome's own session boundary, are the normal rhythm — `onend` restarts.
          if (e.error === 'no-speech' || e.error === 'aborted') return
          if (e.error === 'network') return fail(NOTICE.network)
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') return fail(NOTICE.blocked)
          if (e.error === 'audio-capture') return fail(NOTICE.noMic)
          if (e.error === 'language-not-supported') return fail(languageNotice(languageRef.current))
          fail(`Speech recognition stopped (${e.error}). What was heard is kept — press Dictate again, or type instead.`)
        }

        rec.onend = () => {
          if (recognition.current !== rec || run.current.stopping) return
          // Chrome ended the session itself — after silence, or at about a minute. Keep listening.
          const now = Date.now()
          const recent = run.current.restarts.filter((at) => now - at < RESTART_WINDOW_MS)
          if (recent.length >= MAX_RESTARTS) return fail(NOTICE.keepsStopping)
          run.current.restarts = [...recent, now]
          promoteInterim()
          consumed.current = 0
          try {
            rec.start()
          } catch {
            fail(NOTICE.keepsStopping)
          }
        }

        recognition.current = rec
        consumed.current = 0
        try {
          rec.start()
        } catch {
          fail('Speech recognition would not start in this browser. Type instead.')
          return
        }
        clock.current.since = Date.now()
        setPhase('recording')
      })()
    },
    [arbiterId, fail, promoteInterim, startMeter],
  )

  const reset = useCallback(() => {
    run.current.stopping = true
    run.current.token += 1
    teardown()
    if (run.current.active) {
      run.current.active = false
      useVoiceArbiter.getState().release(arbiterId)
    }
    text.current = { settled: '', interim: '', segments: [] }
    score.current = { confidence: UNSCORED_CONFIDENCE, scored: false }
    clock.current = { base: 0, since: null }
    setPhase('idle')
    setSettled('')
    setInterim('')
    setSegments([])
    setNotice(null)
    setConfidence(UNSCORED_CONFIDENCE)
    setScored(false)
    setElapsedSec(0)
  }, [arbiterId, teardown])

  // Closing the surface discards the session; unmounting it closes the microphone.
  useEffect(() => {
    if (!open) reset()
  }, [open, reset])
  useEffect(() => () => reset(), [reset])

  /** A real clock, so a short recording is visibly short and a paused one does not count on. */
  useEffect(() => {
    if (phase !== 'recording') return
    const t = window.setInterval(() => setElapsedSec(secondsOf(clock.current)), 500)
    return () => window.clearInterval(t)
  }, [phase])

  const conf = scored ? confidence : UNSCORED_CONFIDENCE
  return {
    phase,
    settled,
    interim,
    segments,
    bars,
    live: phase === 'recording',
    model: speechModel(language),
    confidence: conf,
    scored,
    band: bandFor(conf),
    notice,
    supportNotice,
    elapsedSec,
    start,
    stop,
    reset,
  }
}

// ────────────────────────────────────────────────────────────── Waveform

export function Waveform({ bars, active }: { bars: number[]; active: boolean }) {
  return (
    <div aria-hidden className="flex h-10 min-w-0 flex-1 items-center justify-between gap-[2px] overflow-hidden">
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

/** The one line shown while the browser's own permission prompt is up. */
export function RequestingLine({ className }: { className?: string }) {
  return (
    <p role="status" className={cx('flex items-center gap-2 text-[0.9em] text-ink-2', className)}>
      <Icon name="Loader" size={14} className="shrink-0 animate-spin text-ai" />
      Allow microphone access in your browser’s prompt…
    </p>
  )
}

/** Why recognition could not run, and what to do about it. */
export function DictationNotice({ children, className }: { children: string; className?: string }) {
  return (
    <p role="status" className={cx('flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2.5 text-[0.9em] text-caution', className)}>
      <Icon name="MicOff" size={14} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">{children}</span>
    </p>
  )
}

// ────────────────────────────────────────────────────────── The panel

export function DictationPanel({
  open,
  onClose,
  patientId,
  patientName,
  initialMode = 'voice',
}: {
  open: boolean
  onClose: () => void
  /** Undefined for a free note not yet attached to anyone. */
  patientId?: string
  patientName?: string
  /** Voice: the panel opens already listening. Type: it opens with the box focused. */
  initialMode?: 'voice' | 'type'
}) {
  const d = useDictation(patientId, open)
  const me = useCurrentStaff()
  const language = useSession((s) => s.language)
  const record = useAudit((s) => s.record)
  const saveVoiceNote = useClinical((s) => s.saveVoiceNote)
  const toast = useUI((s) => s.toast)

  /** The clinician's edit, once they make one. It wins over what was heard. */
  const [edited, setEdited] = useState<string | null>(null)
  /** What was in the box when the microphone was pressed, kept ahead of the spoken words. */
  const [prefix, setPrefix] = useState('')
  const transcriptLogged = useRef(false)
  const draftRef = useRef<HTMLTextAreaElement>(null)

  const recording = d.phase === 'recording'
  const requesting = d.phase === 'requesting'
  const listening = recording || requesting
  const heard = recording ? joinSpeech(d.settled, d.interim) : d.settled
  const dictated = heard.trim() !== ''
  const joined = prefix.trim() === '' ? heard : heard.trim() === '' ? prefix : `${prefix.trim()} ${heard.trim()}`
  // The body the clinician will actually save: their edit if they made one, otherwise what was typed and heard.
  const body = edited ?? joined
  const wordCount = body.trim() === '' ? 0 : body.trim().split(/\s+/).length

  const unsupported = d.supportNotice !== null
  const notice = d.notice ?? d.supportNotice

  /**
   * The microphone: pressed, it listens — after whatever is already in the
   * box, which is kept. There is no separate "start"; the mic is the start.
   */
  function startDictation() {
    setPrefix(body)
    setEdited(null)
    transcriptLogged.current = false
    d.start()
  }
  const startRef = useRef(d.start)
  startRef.current = d.start

  useEffect(() => {
    if (!open) {
      setEdited(null)
      setPrefix('')
      transcriptLogged.current = false
      return
    }
    // Opened from a microphone, it is already listening; opened from a plus, the box is ready to type.
    if (initialMode === 'voice' && !unsupported) startRef.current()
    else window.setTimeout(() => draftRef.current?.focus(), 0)
  }, [open, initialMode, unsupported])

  const logTranscript = useCallback(
    (words: string) => {
      if (transcriptLogged.current || words.trim() === '') return
      transcriptLogged.current = true
      /** Audit event one of two: the transcript existed. */
      record({
        event: 'AI.SCRIBE.TRANSCRIPT_CREATED',
        actor: me.name,
        actorId: me.id,
        subject: patientId,
        model: d.model,
        gate: 'G2',
        detail: `${words.trim().split(/\s+/).length} words · live recognition · ${d.band}`,
      })
    },
    [d.model, d.band, me.id, me.name, patientId, record],
  )

  useEffect(() => {
    if (d.phase === 'review') logTranscript(d.settled)
  }, [d.phase, d.settled, logTranscript])

  function save() {
    const text = body.trim()
    if (text === '') return
    if (listening) d.stop()
    if (dictated) logTranscript(heard)
    const model = dictated ? d.model : 'Typed — no speech recognition'
    const band: ConfidenceBand = dictated ? d.band : 'HIGH'
    saveVoiceNote({ patientId: patientId ?? UNATTACHED, body: text, by: me.name, model, band })
    /** Audit event two of two: what was committed, by whom, under which gate. */
    record({
      event: 'NOTE.DRAFT_SAVED',
      actor: me.name,
      actorId: me.id,
      subject: patientId,
      model,
      gate: 'G2',
      detail: `${dictated ? 'Dictated' : 'Typed'} note saved${dictated ? (edited !== null ? ' after manual edit' : ' unedited') : ''} · ${text.split(/\s+/).length} words`,
    })
    toast({
      tone: 'success',
      title: patientName ? 'Note saved as a draft' : 'To-do note saved',
      detail: patientName ? `${patientName} · not signed` : 'On My Day, under To-do notes',
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      size="md"
      title={
        <span className="flex items-center gap-2">
          <Icon name={initialMode === 'type' && !patientName ? 'PenLine' : 'Mic'} size={16} />
          {patientName ? 'Add note' : 'To-do note'}
        </span>
      }
      subtitle={patientName ?? 'Not attached to a patient'}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-[0.86em] text-ink-3">
            {wordCount > 0 ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'} · not saved yet` : ' '}
          </span>
          <Button icon="X" onClick={onClose}>
            Discard
          </Button>
          <Button
            tone="primary"
            icon="Check"
            disabled={requesting || wordCount === 0}
            title={wordCount === 0 ? 'Dictate or type the note first' : undefined}
            onClick={save}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/*
          One box, like a chat bar: always typable, the microphone inside it.
          Press the mic and it listens; the words appear in the box as they are
          spoken, after whatever was typed, and it is editable again on Stop.
        */}
        <div className="relative">
          <TextArea
            id="dictation-draft"
            ref={draftRef}
            rows={7}
            value={body}
            readOnly={listening}
            aria-busy={recording}
            aria-label="Your note"
            onChange={(e) => setEdited(e.target.value)}
            placeholder={recording ? 'Listening…' : unsupported ? 'Type the note…' : 'Type, or press the microphone and speak…'}
            className={cx('bg-glass-fill-strong', !unsupported && 'pr-16', recording && 'voice-active')}
          />
          {/* Absent where the browser cannot listen at all — never greyed. */}
          {!unsupported && (
            <div className="absolute right-2 bottom-2">
              {listening ? (
                <button
                  type="button"
                  onClick={d.stop}
                  aria-label="Stop recording"
                  title="Stop recording"
                  className="inline-flex size-11 items-center justify-center rounded-pill bg-abnormal text-abnormal-on"
                >
                  <Icon name="Square" size={18} />
                </button>
              ) : (
                <IconButton
                  icon="Mic"
                  label={dictated ? 'Dictate more' : 'Dictate'}
                  onClick={startDictation}
                  className="bg-ai text-ai-on hover:brightness-110"
                  size={18}
                />
              )}
            </div>
          )}
        </div>

        {/* While it listens: the waveform, the clock, and what is listening. */}
        {listening && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.86em] text-ink-3">
            {requesting ? (
              <RequestingLine className="min-w-0 flex-1" />
            ) : (
              <>
                <Waveform bars={d.bars} active />
                <span className="tabular font-medium text-ink-2">{formatClock(d.elapsedSec)}</span>
                <span className="flex items-center gap-1.5">
                  <Diamond size={10} />
                  Listening · live recognition
                </span>
                <span>{d.model}</span>
                <span>{LANGUAGES.find((l) => l.code === language)?.label}</span>
              </>
            )}
          </div>
        )}

        {/* Why it could not run, said plainly. The box above stays typeable. */}
        {notice && !recording && <DictationNotice>{notice}</DictationNotice>}

        {/* One quiet provenance line once something was heard or changed. */}
        {d.phase === 'review' && (dictated || edited !== null) && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[0.86em] text-ink-3">
            {dictated && (
              <>
                <span className="flex items-center gap-1.5">
                  <Diamond size={10} />
                  Dictated · live · {d.model}
                </span>
                <Confidence band={d.band} score={d.scored ? d.confidence : undefined} />
                <WhyLink
                  target={{
                    touchpointId: `dictation-${patientId ?? UNATTACHED}`,
                    capabilityId: 'AI-101',
                    claim: 'This text is a transcription of what was said, not a clinical assessment of it.',
                    confidence: d.confidence,
                    band: d.band,
                    computedAt: 'just now',
                    inputs: [
                      { label: 'Microphone audio, this session', source: d.model },
                      { label: 'Recognition language', source: BCP47[language] },
                    ],
                    evidence: [
                      'Words are transcribed as the browser’s recogniser heard them; it may add little or no punctuation.',
                      'No clinical content is inferred, checked or corrected.',
                    ],
                    model: d.model,
                    limits: [
                      'A transcription confidence is not a statement about whether the content is correct.',
                      'Accuracy falls with background noise, accent and unfamiliar drug names — read it before saving.',
                      'Nothing is written to the record until Save is pressed.',
                    ],
                  }}
                />
              </>
            )}
            {edited !== null && (
              <span className="flex items-center gap-1.5 font-medium text-normal">
                <Icon name="PenLine" size={12} />
                edited by you
              </span>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
