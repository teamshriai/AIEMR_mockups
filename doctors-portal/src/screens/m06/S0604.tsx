/**
 * S-06-04 · Ambient Scribe Session — overlay on S-06-03 · T1 · ARC-21
 *
 * "The scribe listening while the consultation happens."
 *
 * Deck beat #7 — the screen that answers "where did that note come from?".
 * It is an overlay, so it carries no Z7b bubble of its own (§6.1).
 *
 * Two guardrails are visible on the surface rather than asserted:
 *   AI-101 — "RAW TRANSCRIPT RETAINED VERBATIM; typing always available."
 *   AI-104 — dictation cleanup, with the raw text preserved beside the cleaned
 *   version so the clinician can see what was changed.
 */

import { useEffect, useRef, useState } from 'react'

import { Confidence, Diamond } from '@/components/ai'
import { Modal } from '@/components/overlays'
import { Button, Chip, Icon, Toggle, cx } from '@/components/primitives'
import type { NoteSectionSeed } from '@/data/clinical'
import { LANGUAGES } from '@/data/kit'
import { useSession } from '@/store/session'

interface TranscriptLine {
  speaker: 'Clinician' | 'Patient'
  atSec: number
  raw: string
  /** AI-104's cleaned rendering, where it differs from the raw capture. */
  cleaned?: string
  /** Which note section this line fed. */
  feeds?: NoteSectionSeed['key']
}

/** The consultation behind SD-P-01's drafted note. */
const TRANSCRIPT: TranscriptLine[] = [
  { speaker: 'Clinician', atSec: 4, raw: 'right so meera how have you been since march', feeds: 'subjective', cleaned: 'Right, so Meera — how have you been since March?' },
  {
    speaker: 'Patient',
    atSec: 11,
    raw: 'much better doctor the tiredness is much better than last time i take the tablet first thing before breakfast never missed it',
    cleaned:
      'Much better, doctor. The tiredness is much better than last time. I take the tablet first thing before breakfast, never missed it.',
    feeds: 'subjective',
  },
  { speaker: 'Clinician', atSec: 24, raw: 'any feeling cold constipation voice changes', cleaned: 'Any feeling cold, constipation, voice changes?', feeds: 'subjective' },
  { speaker: 'Patient', atSec: 31, raw: 'no none of that', cleaned: 'No, none of that.', feeds: 'subjective' },
  { speaker: 'Clinician', atSec: 38, raw: 'and no palpitations or tremor heat intolerance', cleaned: 'And no palpitations or tremor, heat intolerance?', feeds: 'subjective' },
  { speaker: 'Patient', atSec: 46, raw: 'no nothing like that weight is the same periods regular', cleaned: 'No, nothing like that. Weight is the same, periods regular.', feeds: 'subjective' },
  { speaker: 'Clinician', atSec: 58, raw: 'let me just examine you', cleaned: 'Let me just examine you.' },
  {
    speaker: 'Clinician',
    atSec: 71,
    raw: 'pulse is seventy six pressure one eighteen over seventy four no goitre no nodule reflexes normal',
    cleaned: 'Pulse is 76, pressure 118/74. No goitre, no nodule. Reflexes normal.',
    feeds: 'objective',
  },
  { speaker: 'Clinician', atSec: 84, raw: 'chest is clear heart sounds normal', cleaned: 'Chest is clear, heart sounds normal.', feeds: 'objective' },
  {
    speaker: 'Clinician',
    atSec: 98,
    raw: 'i think she is euthyroid now the tsh came back at two point four',
    cleaned: 'I think she is euthyroid now — the TSH came back at 2.4.',
    feeds: 'assessment',
  },
  {
    speaker: 'Clinician',
    atSec: 112,
    raw: 'keep the same dose repeat thyroid function in six months see me then',
    cleaned: 'Keep the same dose. Repeat thyroid function in six months, see me then.',
    feeds: 'plan',
  },
  {
    speaker: 'Clinician',
    atSec: 124,
    raw: 'and remember four hours gap from your calcium tablets',
    cleaned: 'And remember, a four-hour gap from your calcium tablets.',
    feeds: 'plan',
  },
]

const SECTION_LABELS: Record<NoteSectionSeed['key'], string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
}

export function S0604({
  open,
  onClose,
  onFinish,
  patientName,
  sections,
}: {
  open: boolean
  onClose: () => void
  /** Hands the drafted sections back to the note. */
  onFinish: () => void
  patientName: string
  sections: NoteSectionSeed[]
}) {
  const language = useSession((s) => s.language)
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  /** The session streams — which is the point of showing it at all. */
  useEffect(() => {
    if (!open || !recording) return
    const t = window.setInterval(() => setElapsed((e) => Math.min(e + 2, 132)), 220)
    return () => window.clearInterval(t)
  }, [open, recording])

  useEffect(() => {
    if (open) {
      setElapsed(0)
      setRecording(true)
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [elapsed])

  const heard = TRANSCRIPT.filter((l) => l.atSec <= elapsed)
  const done = elapsed >= 132

  /** A section starts drafting once its first contributing line has been heard. */
  const sectionProgress = (key: NoteSectionSeed['key']) => {
    const lines = TRANSCRIPT.filter((l) => l.feeds === key)
    if (lines.length === 0) return 0
    const got = lines.filter((l) => l.atSec <= elapsed).length
    return got / lines.length
  }

  return (
    <Modal
      open={open}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Diamond size={14} />
          Ambient scribe
        </span>
      }
      subtitle={`${patientName} · AI-101 · the raw transcript is retained verbatim`}
      onClose={onClose}
      footer={
        <>
          <div className="mr-auto flex items-center gap-3">
            <Toggle checked={showRaw} onChange={setShowRaw} label="Show the raw capture" />
            <span className="text-[0.88em] text-ink-3">Show raw capture</span>
          </div>
          <Button icon="X" onClick={onClose}>
            Cancel
          </Button>
          <Button
            tone="ai"
            icon="Check"
            disabled={heard.length === 0}
            onClick={() => {
              setRecording(false)
              onFinish()
            }}
          >
            {done ? 'Use this draft' : 'Stop and use what is drafted'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* The recording state, plainly. */}
        <div className="flex flex-wrap items-center gap-3 rounded-panel bg-glass-fill-muted px-4 py-3">
          <span
            className={cx(
              'flex size-9 items-center justify-center rounded-pill',
              recording && !done ? 'bg-abnormal-soft text-abnormal' : 'bg-normal-soft text-normal',
            )}
          >
            <Icon name={recording && !done ? 'Mic' : 'Check'} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {done ? 'Consultation captured' : recording ? 'Listening' : 'Paused'}
              <span className="tabular ml-2 text-ink-3">
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
            </p>
            <p className="text-[0.88em] text-ink-3">
              Speech is transcribed and the note drafts as you talk. You can type at any point instead.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone="neutral" icon="Globe">
              {LANGUAGES.find((l) => l.code === language)?.label}
            </Chip>
            <Button size="sm" icon={recording ? 'Pause' : 'Play'} onClick={() => setRecording((r) => !r)}>
              {recording ? 'Pause' : 'Resume'}
            </Button>
          </div>
        </div>

        {/* Which section each line is feeding — the provenance, live. */}
        <div className="grid gap-2 sm:grid-cols-4">
          {(Object.keys(SECTION_LABELS) as NoteSectionSeed['key'][]).map((key) => {
            const pct = sectionProgress(key)
            const seed = sections.find((s) => s.key === key)
            return (
              <div key={key} className="glass rounded-panel p-3">
                <p className="flex items-center justify-between gap-2 text-[0.84em] font-semibold">
                  {SECTION_LABELS[key]}
                  {pct >= 1 && <Icon name="Check" size={13} className="text-normal" />}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-glass-fill-muted">
                  <div
                    className="h-full rounded-pill bg-ai transition-[width] duration-200 ease-out-clinical"
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                {pct >= 1 && seed && <Confidence band={seed.band} className="mt-2" />}
              </div>
            )
          })}
        </div>

        {/* The transcript. AI-104 cleans it; the raw capture stays available. */}
        <div>
          <h3 className="mb-2 flex items-center justify-between gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
            <span>Transcript</span>
            <span className="font-normal normal-case">
              {showRaw ? 'raw capture, as recognised' : 'AI-104 cleaned · punctuation and formatting'}
            </span>
          </h3>
          <div className="thin-scroll max-h-72 space-y-2.5 overflow-y-auto rounded-panel bg-glass-fill-muted p-3">
            {heard.length === 0 && <p className="py-6 text-center text-[0.9em] text-ink-3">Waiting for speech…</p>}
            {heard.map((line) => (
              <div key={`${line.atSec}-${line.speaker}`} className="flex gap-3">
                <span className="tabular w-10 shrink-0 pt-0.5 text-[0.8em] text-ink-muted">
                  {String(Math.floor(line.atSec / 60)).padStart(2, '0')}:{String(line.atSec % 60).padStart(2, '0')}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'mr-2 text-[0.82em] font-semibold',
                      line.speaker === 'Clinician' ? 'text-brand' : 'text-ink-3',
                    )}
                  >
                    {line.speaker}
                  </span>
                  <span className={cx(showRaw && 'font-mono text-[0.9em] text-ink-2')}>
                    {showRaw ? line.raw : (line.cleaned ?? line.raw)}
                  </span>
                  {line.feeds && (
                    <Chip tone="ai" className="ml-2 align-middle">
                      → {SECTION_LABELS[line.feeds]}
                    </Chip>
                  )}
                </span>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.88em] text-ink-2">
          <Icon name="ShieldCheck" size={15} className="mt-0.5 shrink-0 text-brand" />
          <span>
            The raw transcript is kept verbatim and every drafted sentence links back to the span it came from. If the
            speech service drops, the ◆ affordances disappear and this becomes plain typing — nothing already captured
            is lost.
          </span>
        </p>
      </div>
    </Modal>
  )
}
