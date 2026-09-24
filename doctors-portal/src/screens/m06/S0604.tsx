/**
 * S-06-04 · Ambient Scribe Session — overlay on S-06-03 · T1 · ARC-21
 *
 * "The scribe listening while the consultation happens."
 *
 * Deck beat #7 — the screen that answers "where did that note come from?".
 * It is an overlay, so it carries no Z7b bubble of its own (§6.1).
 *
 * It LISTENS FOR REAL. Opening it (from "Draft with AI" on S-06-03 and S-08-04)
 * raises the browser's microphone prompt, and every line in the transcript is
 * a line the browser's speech recogniser actually heard — nothing is streamed
 * from a script. Pause and Resume close and reopen the microphone and keep
 * what was heard; the clock counts only time spent listening. Where the
 * browser cannot listen (Firefox; Brave, whose speech service is blocked), it
 * says so in one line and "Use this draft" stays off.
 *
 * Two guardrails are visible on the surface rather than asserted:
 *   AI-101 — "RAW TRANSCRIPT RETAINED VERBATIM; typing always available."
 *   AI-104 — dictation cleanup, with the raw capture one toggle away so the
 *   clinician can see exactly what was changed (a capital and a full stop).
 *
 * Calm pass: the provenance is the transcript's own structure. Lines sit under
 * the section they will feed, so no line needs a chip saying so; drafting
 * progress is one line; the retention rationale is behind a Why.
 *
 * "Use this draft" hands back, per section, the sentences routed to it
 * (`data/scribe.ts`), and writes them to the note that aimed the scribe. The
 * note shows that text as the ghost awaiting Accept / Edit / Reject; sections
 * the clinician already wrote are left alone. If nothing has been heard there
 * is nothing to draft, and the action says why it is off.
 */

import { useEffect, useMemo, useRef, useState } from 'react'

import { Confidence, Diamond } from '@/components/ai'
import { Why } from '@/components/calm'
import { DictationNotice, RequestingLine, useDictation } from '@/components/dictation'
import { Modal } from '@/components/overlays'
import { Button, Chip, Icon, Toggle, cx } from '@/components/primitives'
import type { NoteSectionSeed } from '@/data/clinical'
import { formatClock } from '@/data/format'
import { LANGUAGES } from '@/data/kit'
import {
  SCRIBE_SECTION_KEYS,
  draftFromTranscript,
  routeSentence,
  splitSentences,
  tidySentence,
  useScribeDrafts,
} from '@/data/scribe'
import type { ScribeSections } from '@/data/scribe'
import { useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useSession } from '@/store/session'

type SectionKey = NoteSectionSeed['key']

const SECTION_LABELS: Record<SectionKey, string> = {
  subjective: 'Subjective',
  objective: 'Objective',
  assessment: 'Assessment',
  plan: 'Plan',
}

interface HeardLine {
  key: string
  atSec: number
  raw: string
  cleaned: string
  feeds: SectionKey
}

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
  /**
   * Hands back the keys it drafted and, for each, the text it heard. The text
   * is also written to the note that aimed the scribe, so a caller that only
   * reads the keys still gets the scribe's words — never a seed.
   */
  onFinish: (keys: SectionKey[], drafts: ScribeSections) => void
  patientId: string
  patientName: string
  /** The note's sections, for their labels. */
  sections: NoteSectionSeed[]
}) {
  const language = useSession((s) => s.language)
  const clearDisposition = useAI((s) => s.clearDisposition)
  const d = useDictation(patientId, open, { arbiterId: 'ambient-scribe' })
  const [showRaw, setShowRaw] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const { start } = d

  /** Listening begins when the overlay opens — asking for the scribe is asking for the microphone. */
  useEffect(() => {
    if (open) start()
  }, [open, start])

  /** Every settled phrase, split into sentences, each under the section it will feed. */
  const lines = useMemo<HeardLine[]>(
    () =>
      d.segments.flatMap((seg, i) =>
        splitSentences(seg.text).map((raw, j) => ({
          key: `${i}-${j}`,
          atSec: seg.atSec,
          raw,
          cleaned: tidySentence(raw),
          feeds: routeSentence(raw),
        })),
      ),
    [d.segments],
  )

  // What has been heard so far, one recognised phrase per line — the words in flight included.
  const transcript = [...d.segments.map((s) => s.text), d.interim.trim()].filter(Boolean).join('\n')
  const drafts = useMemo(() => draftFromTranscript(transcript), [transcript])
  const drafted = SCRIBE_SECTION_KEYS.filter((k) => drafts[k] !== undefined)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [lines.length])

  const labelFor = (key: SectionKey) => sections.find((s) => s.key === key)?.label ?? SECTION_LABELS[key]
  const recording = d.phase === 'recording'
  const requesting = d.phase === 'requesting'
  const unavailable = d.phase === 'unavailable'
  const cannotListen = d.supportNotice !== null

  function adoptDraft() {
    if (drafted.length === 0) return
    d.stop()
    const encounterId = useScribeDrafts.getState().publish({
      patientId,
      sections: drafts,
      transcript,
      model: d.model,
      band: d.band,
      confidence: d.confidence,
      scored: d.scored,
      at: new Date().toISOString(),
    })
    if (encounterId) {
      // A new draft for a section that is still empty needs a new decision, not the last one.
      const note = useClinical.getState().note(encounterId)
      for (const k of drafted) if ((note.text[k] ?? '').trim() === '') clearDisposition(`${encounterId}:${k}`)
    }
    onFinish(drafted, drafts)
  }

  const status = recording
    ? 'Listening'
    : requesting
      ? 'Waiting for the microphone'
      : unavailable
        ? 'Not listening'
        : d.phase === 'review'
          ? 'Paused'
          : 'Starting'

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
            disabled={drafted.length === 0}
            title={drafted.length === 0 ? 'Nothing has been heard yet, so there is nothing to draft' : undefined}
            onClick={adoptDraft}
          >
            Use this draft
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* The recording state, plainly. */}
        <div
          className={cx(
            'flex flex-wrap items-center gap-3 rounded-panel border bg-glass-fill-muted px-4 py-3',
            'transition-[border-color,box-shadow] duration-[250ms]',
            recording ? 'voice-active' : 'border-transparent',
          )}
        >
          <span
            className={cx(
              'flex size-9 shrink-0 items-center justify-center rounded-pill',
              recording ? 'bg-abnormal-soft text-abnormal' : unavailable ? 'bg-caution-soft text-caution' : 'bg-glass-inset text-ink-2',
            )}
          >
            <Icon name={unavailable ? 'MicOff' : recording ? 'Mic' : d.phase === 'review' ? 'Pause' : 'Mic'} size={17} />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="font-medium">
              {status}
              <span className="tabular ml-2 text-ink-3">{formatClock(d.elapsedSec)}</span>
            </p>
            {requesting ? (
              <RequestingLine className="text-[0.88em]" />
            ) : (
              /* Progress, in one line. */
              <p className="tabular flex flex-wrap items-center gap-x-2 text-[0.88em] text-ink-3">
                {drafted.length} of {SCRIBE_SECTION_KEYS.length} sections drafted
                {drafted.length > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <Confidence band={d.band} score={d.scored ? d.confidence : undefined} />
                  </>
                )}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Chip tone="neutral" icon="Globe">
              {LANGUAGES.find((l) => l.code === language)?.label}
            </Chip>
            {recording && (
              <Button size="sm" icon="Pause" onClick={d.stop}>
                Pause
              </Button>
            )}
            {(d.phase === 'review' || (unavailable && !cannotListen)) && (
              <Button size="sm" icon={unavailable ? 'RotateCcw' : 'Play'} onClick={() => d.start({ resume: true })}>
                {unavailable ? 'Try again' : 'Resume'}
              </Button>
            )}
          </div>
        </div>

        {d.notice && <DictationNotice>{d.notice}</DictationNotice>}

        {/* The transcript, grouped under the section each run of lines feeds. AI-104 cleans it; the raw capture stays available. */}
        <div>
          <h3 className="mb-2 flex items-center justify-between gap-2 text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">
            <span>Transcript</span>
            <span className="font-normal tracking-normal text-ink-3 normal-case">
              {showRaw ? 'raw capture, as recognised' : 'cleaned · a capital and a full stop per sentence'}
            </span>
          </h3>
          <div
            aria-live="polite"
            className="thin-scroll max-h-72 space-y-2.5 overflow-y-auto rounded-panel bg-glass-fill-muted p-3"
          >
            {lines.length === 0 && d.interim.trim() === '' && (
              <p className="py-6 text-center text-[0.9em] text-ink-3">
                {recording ? 'Listening — speak normally; the lines appear here as they are heard.' : unavailable ? 'Nothing was heard.' : 'Waiting for speech…'}
              </p>
            )}
            {lines.map((line, i) => {
              const newSection = line.feeds !== lines[i - 1]?.feeds
              return (
                <div key={line.key}>
                  {newSection && (
                    <p className={cx('text-[0.74em] font-semibold tracking-[0.08em] text-ink-3 uppercase', i > 0 && 'mt-3')}>
                      {labelFor(line.feeds)}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <span className="tabular w-10 shrink-0 pt-0.5 text-[0.8em] text-ink-muted">{formatClock(line.atSec)}</span>
                    <span className={cx('min-w-0 flex-1', showRaw && 'font-mono text-[0.9em] text-ink-2')}>
                      {showRaw ? line.raw : line.cleaned}
                    </span>
                  </div>
                </div>
              )
            })}
            {/* The words still in flight — quiet, and not yet in any draft section. */}
            {d.interim.trim() !== '' && (
              <div className="flex gap-3">
                <span className="tabular w-10 shrink-0 pt-0.5 text-[0.8em] text-ink-muted">{formatClock(d.elapsedSec)}</span>
                <span className="min-w-0 flex-1 text-ink-3 italic">{d.interim.trim()}…</span>
              </div>
            )}
            <div ref={endRef} />
          </div>
          {drafted.length === 0 && (
            <p className="mt-2 flex items-start gap-2 px-1 text-[0.86em] text-ink-3">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              {cannotListen || unavailable
                ? 'Nothing to draft without speech. Close this and dictate or type each section instead.'
                : 'Use this draft turns on once something has been heard.'}
            </p>
          )}
        </div>

        <Why label="What is kept, and what happens if the speech service drops">
          <p className="text-ink-2">
            The raw transcript is kept with the draft. Every drafted sentence is one that was said — the scribe places
            sentences in a section by the words used, and does not reword, add or infer. It cannot tell who is
            speaking. If the speech service drops, what was already heard is kept, and typing is always available.
          </p>
        </Why>
      </div>
    </Modal>
  )
}
