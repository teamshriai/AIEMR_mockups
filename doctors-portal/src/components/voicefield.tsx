/**
 * VoiceField — a note field that is typed into always and spoken into on one press.
 *
 * Every note surface in the portal (consultation note, ward-round note,
 * admission assessment, discharge summary, patient instructions, addendum,
 * co-sign return comment, teleconsult note, the narrative boxes on the
 * safety forms) uses this for its free text, so the behaviour is learned once:
 *
 *   • The field opens EMPTY. Nothing is pre-filled, ever.
 *   • The field is a chat bar: a box that is always typable, with the
 *     microphone inside it. There is no mode and no "start" button — pressing
 *     the mic raises the browser's own permission prompt and listens; the
 *     words are written INTO THE FIELD as they are spoken, after whatever was
 *     already there, which is kept. Stop ends it; the text is then plain,
 *     editable text like any other. Pressing the mic again adds to it.
 *   • Beneath a dictated field sits one quiet provenance line: ◆ dictated ·
 *     live · confidence · Why?.
 *   • Where the browser cannot listen (Firefox; Brave, whose speech service is
 *     blocked; a page not on https), the field says so in one line and stays
 *     typeable. There is no canned text standing in for speech.
 *
 * On saving: dictated words are handed to `onChange` as they arrive, exactly as
 * typed text is on each keystroke, so a Save pressed mid-sentence saves what
 * the field shows. `onDictated` fires once, on Stop, with the model and the
 * confidence. That differs deliberately from My Day's `DictationPanel`, which
 * COMMITS a free-standing draft to the record and so saves nothing until Save;
 * this field only fills a form that is itself a draft until the clinician
 * signs it. Nothing enters the legal record from here before Sign.
 *
 * AI-OFF (§1.5): the mic is an AI-101 affordance and is HIDDEN, not greyed.
 * The field degrades to a plain textarea and typing keeps working.
 *
 * Transcription is not a draft. The clinician's own words, transcribed, need no
 * Accept / Edit / Reject bar — reading, editing and signing them is the
 * confirmation. Only the scribe's structured drafts (AIP-01 `GhostSection`)
 * carry C-41.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { ConfidenceBand } from '@/atlas/confidence'
import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { BCP47, DictationNotice, RequestingLine, Waveform, useDictation, useVoiceArbiter } from '@/components/dictation'
import type { DictationRun } from '@/components/dictation'
import { Icon, IconButton, TextArea, cx } from '@/components/primitives'
import { tidyText } from '@/data/abbreviations'
import { formatClock } from '@/data/format'
import { LANGUAGES } from '@/data/kit'
import { joinSpeech } from '@/data/scribe'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff, useSession } from '@/store/session'

export interface DictatedMeta {
  /** The field's value after the words landed. */
  text: string
  model: string
  band: ConfidenceBand
  confidence: number
  /** False where the recogniser gave no score — show the band, not a percentage. */
  scored: boolean
  /** Always true: there is no other kind of dictation. Kept for callers that log it. */
  live: boolean
  words: number
}

/** Joins a fresh transcript onto whatever is already in the field. */
function append(existing: string, spoken: string): string {
  const a = existing.trim()
  const b = spoken.trim()
  if (!a) return b
  if (!b) return a
  return `${a}${/[.!?]$/.test(a) ? '' : '.'} ${b}`
}

export function VoiceField({
  id,
  label,
  required,
  value,
  onChange,
  onDictated,
  onBlur,
  patientId,
  rows = 5,
  placeholder,
  disabled,
  hint,
  autoFocus,
  className,
  labelExtra,
  tidy,
}: {
  id: string
  label: string
  required?: boolean
  value: string
  /**
   * Every change to the text. `source` is `'dictation'` while words are being
   * written in from the microphone, so a caller that tracks provenance can
   * tell spoken words from typed ones without waiting for Stop.
   */
  onChange: (v: string, source?: 'dictation') => void
  /** Fires once per recording, on Stop, after the words have landed in the field. */
  onDictated?: (meta: DictatedMeta) => void
  onBlur?: () => void
  patientId?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  hint?: ReactNode
  autoFocus?: boolean
  className?: string
  /** Extra content right of the label — a chip, a count. */
  labelExtra?: ReactNode
  /** AI-104 tidy-up offer under a field with text. On by default. */
  tidy?: boolean
}) {
  const aiActive = useAI(selectAiActive)
  const recordDisposition = useAI((s) => s.record)
  const me = useCurrentStaff()
  const language = useSession((s) => s.language)

  const activeId = useVoiceArbiter((s) => s.activeId)

  /** What was in the field when recording started. Non-null exactly while a take is open. */
  const base = useRef<string | null>(null)
  const valueRef = useRef(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [dictatedMeta, setDictatedMeta] = useState<DictatedMeta | null>(null)
  /** What the text was before Tidy up, so Undo is exact. */
  const [beforeTidy, setBeforeTidy] = useState<{ was: string; changes: string[] } | null>(null)

  /** The take closes exactly once: the final words land, and `onDictated` hears about it. */
  function land(run: DictationRun) {
    const was = base.current
    base.current = null
    if (was === null) return
    const spoken = run.text.trim()
    if (spoken !== '') {
      const text = append(was, spoken)
      onChange(text, 'dictation')
      const meta: DictatedMeta = {
        text,
        model: run.model,
        band: run.band,
        confidence: run.confidence,
        scored: run.scored,
        live: true,
        words: spoken.split(/\s+/).length,
      }
      setDictatedMeta(meta)
      onDictated?.(meta)
    } else if (valueRef.current !== was) {
      // Nothing was heard: the field goes back to exactly what it held.
      onChange(was)
    }
    window.setTimeout(() => textareaRef.current?.focus(), 0)
  }

  const d = useDictation(patientId, true, { arbiterId: id, onEnd: land })

  useEffect(() => {
    valueRef.current = value
  })

  /** The words go INTO the field as they are spoken, after what was already there. */
  const recording = d.phase === 'recording'
  const liveSpoken = recording ? joinSpeech(d.settled, d.interim) : ''
  useEffect(() => {
    if (!recording || base.current === null || liveSpoken === '') return
    const next = append(base.current, liveSpoken)
    if (next !== valueRef.current) onChange(next, 'dictation')
    // `onChange` is the caller's and changes every render; the words are what drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, liveSpoken])

  const tidied = useMemo(() => tidyText(value), [value])
  const canTidy = tidy !== false && aiActive && !disabled && !recording && value.trim() !== '' && tidied.text !== value

  function start() {
    base.current = value
    d.start()
  }

  const requesting = d.phase === 'requesting'
  const listening = recording || requesting
  const someoneElse = activeId !== null && activeId !== id
  const hasText = value.trim() !== ''
  const micLabel = `Dictate into ${label.toLowerCase()}`
  const label_ = (
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id} className="flex items-center gap-2 text-[0.92em] font-medium text-ink-2">
        {label}
        {required && (
          <span className="text-abnormal" aria-label="required">
            *
          </span>
        )}
        {labelExtra}
      </label>
    </div>
  )

  // ── AI off, or locked: plain typing. The affordance is absent, not greyed.
  if (!aiActive || disabled) {
    return (
      <div className={cx('min-w-0', className)} onBlur={onBlur}>
        {label_}
        <TextArea
          id={id}
          rows={rows}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? `Type the ${label.toLowerCase()}…`}
          autoFocus={autoFocus}
        />
        {hint && <p className="mt-1.5 text-[0.88em] text-ink-3">{hint}</p>}
      </div>
    )
  }

  return (
    <div className={cx('min-w-0', className)} onBlur={onBlur}>
      {label_}

      {/*
        The field is a chat bar: always typable, the microphone inside it. Press
        it and it listens; the words land in the field after what is already
        there, and the field is yours to edit again on Stop.
      */}
      <div className="relative">
        <TextArea
          id={id}
          ref={textareaRef}
          rows={rows}
          value={value}
          readOnly={recording}
          aria-busy={recording}
          onChange={(e) => onChange(e.target.value)}
          placeholder={recording ? 'Listening…' : (placeholder ?? `Type the ${label.toLowerCase()}, or press the microphone…`)}
          autoFocus={autoFocus}
          className={cx('pr-16', recording && 'voice-active')}
        />
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
              label={micLabel}
              onClick={start}
              disabled={someoneElse}
              title={someoneElse ? 'Another field is listening' : micLabel}
              className="bg-ai text-ai-on hover:brightness-110"
              size={18}
            />
          )}
        </div>
      </div>

      {/* While it listens: the permission prompt, or the waveform and the clock. */}
      {listening && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[0.86em] text-ink-3">
          {requesting ? (
            <RequestingLine className="min-w-0 flex-1" />
          ) : (
            <>
              <Waveform bars={d.bars} active />
              <span className="tabular font-medium text-ink-2">{formatClock(d.elapsedSec)}</span>
              <span className="flex items-center gap-1.5">
                <Diamond size={9} />
                Listening · live
              </span>
            </>
          )}
        </div>
      )}

      {/* Why the microphone could not be used, said plainly. The field above stays typeable. */}
      {d.notice && !listening && <DictationNotice className="mt-2 py-2 text-[0.88em]">{d.notice}</DictationNotice>}

      {/* One quiet provenance line under a dictated field. */}
      {!listening && dictatedMeta && hasText && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[0.86em] text-ink-3">
          <span className="flex items-center gap-1.5">
            <Diamond size={9} />
            Dictated · live
          </span>
          <Confidence band={dictatedMeta.band} score={dictatedMeta.scored ? dictatedMeta.confidence : undefined} />
          <WhyLink
            target={{
              touchpointId: `dictation-${id}`,
              capabilityId: 'AI-101',
              claim: 'This text is a transcription of what was said, not a clinical assessment of it.',
              confidence: dictatedMeta.confidence,
              band: dictatedMeta.band,
              computedAt: 'just now',
              inputs: [
                { label: 'Microphone audio, this session', source: dictatedMeta.model },
                { label: 'Recognition language', source: `${BCP47[language]} · ${LANGUAGES.find((l) => l.code === language)?.label}` },
              ],
              evidence: [
                'Words are transcribed as the browser’s recogniser heard them; it may add little or no punctuation.',
                'No clinical content is inferred, checked or corrected.',
              ],
              model: dictatedMeta.model,
              limits: [
                'A transcription confidence is not a statement about whether the content is correct.',
                'Accuracy falls with background noise, accent and unfamiliar drug names — read it before signing.',
                'Nothing is written to the legal record until the note is signed.',
              ],
            }}
          />
        </div>
      )}

      {/* AI-104 — the same table that rejects a banned abbreviation offers to write it out. */}
      {!listening && (canTidy || beforeTidy) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[0.86em]">
          {canTidy && (
            <button
              type="button"
              onClick={() => {
                setBeforeTidy({ was: value, changes: tidied.changes })
                onChange(tidied.text)
                recordDisposition({
                  touchpointId: `tidy-${id}`,
                  disposition: 'Accepted',
                  by: me.name,
                  modelVersion: 'AI-104 tidy v1.0',
                  confidence: 'HIGH',
                })
              }}
              title={tidied.changes.join(' · ')}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-pill bg-ai-soft px-2.5 font-medium text-ai hover:brightness-95"
            >
              <Diamond size={9} />
              Tidy up with AI
              <span className="text-ink-3">· {tidied.changes.length} {tidied.changes.length === 1 ? 'change' : 'changes'}</span>
            </button>
          )}
          {beforeTidy && !canTidy && (
            <>
              <span className="flex items-center gap-1.5 text-ink-3">
                <Diamond size={9} />
                Tidied · {beforeTidy.changes.join(', ')}
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(beforeTidy.was)
                  setBeforeTidy(null)
                }}
                className="min-h-8 rounded-pill px-2 font-medium text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink-2"
              >
                Undo
              </button>
            </>
          )}
        </div>
      )}

      {hint && <p className="mt-1.5 text-[0.88em] text-ink-3">{hint}</p>}
    </div>
  )
}
