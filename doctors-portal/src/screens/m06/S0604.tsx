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
 *
 * Calm pass: the provenance is the transcript's own structure. Lines sit under
 * the section they fed, so no line needs a chip saying so; drafting progress
 * is one line; the retention rationale is behind a Why.
 *
 * It is opened ON REQUEST — "Draft with AI" on S-06-03 and S-08-04 — and hands back the section keys it drafted, which the
 * note marks as scribe drafts needing a disposition. The transcript is keyed
 * by patient; where no rich capture exists, one line per section is
 * synthesised from that section's own transcript span, so a round on the
 * pneumonia patient never streams the thyroid consultation.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { Confidence, Diamond } from '@/components/ai'
import { Why } from '@/components/calm'
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
const TRANSCRIPT_SD_P_01: TranscriptLine[] = [
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

const TRANSCRIPTS: Record<string, TranscriptLine[]> = { 'SD-P-01': TRANSCRIPT_SD_P_01 }

/** One clinician line per section, from the seed's own span, where no rich capture exists. */
function synthesise(sections: NoteSectionSeed[]): TranscriptLine[] {
  return sections.map((s, i) => ({
    speaker: 'Clinician' as const,
    atSec: 12 * (i + 1),
    raw: s.transcriptSpan.toLowerCase().replace(/[.,;:—-]/g, ''),
    cleaned: s.transcriptSpan,
    feeds: s.key,
  }))
}

const SECTION_LABELS: Record<NoteSectionSeed['key'], string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
}
const SECTION_KEYS = Object.keys(SECTION_LABELS) as NoteSectionSeed['key'][]

const BAND_RANK = { HIGH: 0, MED: 1, LOW: 2 } as const

export function S0604({
  open,
  onClose,
  onFinish,
  patientId,
  patientName,
  sections,
}: {
  open: boolean
  onClose: () => void
  /** Hands the drafted section keys back to the note. */
  onFinish: (keys: NoteSectionSeed['key'][]) => void
  patientId: string
  patientName: string
  sections: NoteSectionSeed[]
}) {
  const language = useSession((s) => s.language)
  const transcript = useMemo(() => TRANSCRIPTS[patientId] ?? synthesise(sections), [patientId, sections])
  const total = transcript[transcript.length - 1]?.atSec ?? 0
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState(true)
  const [showRaw, setShowRaw] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  /** The session streams — which is the point of showing it at all. */
  useEffect(() => {
    if (!open || !recording) return
    const t = window.setInterval(() => setElapsed((e) => Math.min(e + 2, total)), 220)
    return () => window.clearInterval(t)
  }, [open, recording, total])

  useEffect(() => {
    if (open) {
      setElapsed(0)
      setRecording(true)
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [elapsed])

  const heard = transcript.filter((l) => l.atSec <= elapsed)
  const done = elapsed >= total

  /** A section counts as drafted once every contributing line has been heard. */
  const drafted = SECTION_KEYS.filter((key) => {
    const lines = transcript.filter((l) => l.feeds === key)
    return lines.length > 0 && lines.every((l) => l.atSec <= elapsed)
  })
  /** The weakest band among the drafted sections — the one that will need the most reading. */
  const overallBand = drafted
    .map((key) => sections.find((s) => s.key === key)?.band)
    .filter((b): b is NoteSectionSeed['band'] => b !== undefined)
    .sort((a, b) => BAND_RANK[b] - BAND_RANK[a])[0]

  const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`

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
      subtitle={`${patientName} · the raw transcript is retained verbatim`}
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
              onFinish(drafted)
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
              <span className="tabular ml-2 text-ink-3">{clock(elapsed)}</span>
            </p>
            {/* Progress, in one line. */}
            <p className="tabular flex flex-wrap items-center gap-x-2 text-[0.88em] text-ink-3">
              {drafted.length} of {SECTION_KEYS.length} sections drafted
              {overallBand && (
                <>
                  <span aria-hidden>·</span>
                  <Confidence band={overallBand} />
                </>
              )}
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

        {/* The transcript, grouped under the section each run of lines fed. AI-104 cleans it; the raw capture stays available. */}
        <div>
          <h3 className="mb-2 flex items-center justify-between gap-2 text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">
            <span>Transcript</span>
            <span className="font-normal tracking-normal text-ink-3 normal-case">
              {showRaw ? 'raw capture, as recognised' : 'cleaned · punctuation and formatting'}
            </span>
          </h3>
          <div className="thin-scroll max-h-72 space-y-2.5 overflow-y-auto rounded-panel bg-glass-fill-muted p-3">
            {heard.length === 0 && <p className="py-6 text-center text-[0.9em] text-ink-3">Waiting for speech…</p>}
            {heard.map((line, i) => {
              const prev = heard[i - 1]
              const newSection = line.feeds !== undefined && line.feeds !== prev?.feeds
              return (
                <div key={`${line.atSec}-${line.speaker}`}>
                  {newSection && (
                    <p className={cx('text-[0.74em] font-semibold tracking-[0.08em] text-ink-3 uppercase', i > 0 && 'mt-3')}>
                      {SECTION_LABELS[line.feeds!]}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <span className="tabular w-10 shrink-0 pt-0.5 text-[0.8em] text-ink-muted">{clock(line.atSec)}</span>
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
                    </span>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>
        </div>

        <Why label="What is kept, and what happens if the speech service drops">
          <p className="text-ink-2">
            The raw transcript is kept verbatim and every drafted sentence links back to the span it came from. If the
            speech service drops, the AI affordances disappear and this becomes plain typing — nothing already captured
            is lost. Speech is transcribed and the note drafts as you talk; you can type at any point instead.
          </p>
        </Why>
      </div>
    </Modal>
  )
}
