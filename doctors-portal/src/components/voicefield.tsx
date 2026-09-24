/**
 * VoiceField — a note field that is spoken into first and typed into always.
 *
 * Every note surface in the portal (consultation note, ward-round note,
 * admission assessment, discharge summary, patient instructions, addendum,
 * co-sign return comment, teleconsult note) uses this for its free text, so the
 * behaviour is learned once:
 *
 *   • The field opens EMPTY. Nothing is pre-filled, ever.
 *   • In `voice` mode (the per-person default, `session.notesInput`) the field
 *     is a single mic button with "or type" one tap away. In `type` mode the
 *     textarea is primary and the mic sits beside the label.
 *   • Recording streams live words; stopping lands them in the field, editable.
 *   • Beneath a dictated field sits one quiet provenance line: ◆ dictated ·
 *     live or sample · confidence · Why? · Dictate more.
 *
 * On saving: dictated text is written into the field on Stop, exactly as typed
 * text is written on each keystroke. That differs deliberately from My Day's
 * `DictationPanel`, which saves nothing until Save — that panel COMMITS a
 * free-standing draft to the record; this field only fills a form that is
 * itself a draft until the clinician signs it. Nothing enters the legal record
 * from here before Sign.
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
import { BCP47, Waveform, useDictation, useVoiceArbiter } from '@/components/dictation'
import { Button, Icon, IconButton, TextArea, cx } from '@/components/primitives'
import { tidyText } from '@/data/abbreviations'
import { LANGUAGES } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff, useSession } from '@/store/session'
import type { NotesInput } from '@/store/session'

export interface DictatedMeta {
  /** The field's value after the words landed. */
  text: string
  model: string
  band: ConfidenceBand
  confidence: number
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
  sample,
  rows = 5,
  placeholder,
  disabled,
  mode,
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
  onChange: (v: string) => void
  /** Fires once per recording, after the words have landed in the field. */
  onDictated?: (meta: DictatedMeta) => void
  onBlur?: () => void
  patientId?: string
  /** The captured-sample fallback for THIS field, where the browser has no recogniser. */
  sample?: string
  rows?: number
  placeholder?: string
  disabled?: boolean
  /** Overrides the session preference. */
  mode?: NotesInput
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
  const preference = useSession((s) => s.notesInput)
  const language = useSession((s) => s.language)
  const inputMode: NotesInput = mode ?? preference

  const activeId = useVoiceArbiter((s) => s.activeId)
  const claim = useVoiceArbiter((s) => s.claim)
  const release = useVoiceArbiter((s) => s.release)

  const d = useDictation(patientId, true, { sample })
  /**
   * Once the clinician has typed in the box it stays a box — a field that
   * collapses back to the mic prompt the moment its last character is deleted
   * would vanish under the cursor.
   */
  const [typing, setTyping] = useState(false)
  const [dictatedMeta, setDictatedMeta] = useState<DictatedMeta | null>(null)
  /** What the text was before Tidy up, so Undo is exact. */
  const [beforeTidy, setBeforeTidy] = useState<{ was: string; changes: string[] } | null>(null)
  const tidied = useMemo(() => tidyText(value), [value])
  const canTidy = tidy !== false && aiActive && !disabled && value.trim() !== '' && tidied.text !== value
  const landed = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  /** When the recogniser stops, the words land in the field once. */
  useEffect(() => {
    if (d.phase !== 'review' || landed.current) return
    landed.current = true
    release(id)
    const spoken = d.settled.trim()
    if (spoken !== '') {
      const text = append(value, spoken)
      onChange(text)
      const meta: DictatedMeta = {
        text,
        model: d.model,
        band: d.band,
        confidence: d.confidence,
        live: d.live,
        words: spoken.split(/\s+/).length,
      }
      setDictatedMeta(meta)
      onDictated?.(meta)
    }
    window.setTimeout(() => textareaRef.current?.focus(), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.phase])

  useEffect(() => () => release(id), [id, release])

  function start() {
    if (!claim(id)) return
    landed.current = false
    d.start()
  }

  const recording = d.phase === 'recording'
  const someoneElse = activeId !== null && activeId !== id
  const hasText = value.trim() !== ''
  const showTextArea = disabled || !aiActive || inputMode === 'type' || typing || hasText || d.phase === 'review'
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
      {/* Type mode: the mic sits by the label, secondary. */}
      {aiActive && !disabled && showTextArea && !recording && (
        <IconButton
          icon="Mic"
          label={`Dictate into ${label.toLowerCase()}`}
          onClick={start}
          disabled={someoneElse}
          title={someoneElse ? 'Another section is recording' : `Dictate into ${label.toLowerCase()}`}
          className="size-9 text-ai hover:bg-ai-soft"
          size={15}
        />
      )}
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

      {/* The recorder, while live. The brief's `.voice-active` glow marks the one field listening. */}
      {recording && (
        <div className="voice-active rounded-field border bg-glass-fill-muted px-3.5 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={d.stop}
              aria-label="Stop recording"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-pill bg-abnormal text-white"
            >
              <Icon name="Square" size={18} />
            </button>
            <Waveform bars={d.bars} active />
            <span className="tabular shrink-0 text-[0.92em] font-medium text-ink-2">
              {String(Math.floor(d.elapsedSec / 60)).padStart(2, '0')}:{String(d.elapsedSec % 60).padStart(2, '0')}
            </span>
          </div>
          <p aria-live="polite" className="ai-ghost mt-3 max-h-[9.5em] overflow-y-auto rounded-field px-3 py-2 leading-relaxed">
            {d.settled}
            {d.interim && <span className="text-ink-3"> {d.interim}</span>}
            {d.settled === '' && d.interim === '' && <span className="text-ink-muted">Listening…</span>}
          </p>
        </div>
      )}

      {/* Voice mode, nothing said yet: one control, and typing one tap away. */}
      {!recording && !showTextArea && (
        <div className="flex flex-wrap items-center gap-3 rounded-field border border-dashed border-glass-border bg-glass-fill-muted px-3.5 py-3">
          <Button
            tone="ai"
            icon="Mic"
            onClick={start}
            disabled={someoneElse}
            title={someoneElse ? 'Another section is recording' : undefined}
          >
            Dictate
          </Button>
          <button
            type="button"
            onClick={() => {
              setTyping(true)
              window.setTimeout(() => textareaRef.current?.focus(), 0)
            }}
            className="min-h-11 rounded-pill px-3 text-[0.9em] font-medium text-ink-3 hover:bg-glass-fill-hover hover:text-ink-2"
          >
            or type instead
          </button>
        </div>
      )}

      {/* The field itself. */}
      {!recording && showTextArea && (
        <TextArea
          id={id}
          ref={textareaRef}
          rows={rows}
          value={value}
          onFocus={() => setTyping(true)}
          onChange={(e) => {
            setTyping(true)
            onChange(e.target.value)
          }}
          placeholder={placeholder ?? `Type the ${label.toLowerCase()}…`}
          autoFocus={autoFocus}
        />
      )}

      {/* Which path ran, said plainly. */}
      {d.notice && d.phase !== 'idle' && (
        <p className="mt-2 flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2 text-[0.88em] text-caution">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          {d.notice}
        </p>
      )}

      {/* One quiet provenance line under a dictated field. */}
      {!recording && dictatedMeta && hasText && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5 text-[0.86em] text-ink-3">
          <span className="flex items-center gap-1.5">
            <Diamond size={9} />
            Dictated · {dictatedMeta.live ? 'live' : 'sample (no microphone)'}
          </span>
          <Confidence band={dictatedMeta.band} score={dictatedMeta.confidence} />
          <WhyLink
            target={{
              touchpointId: `dictation-${id}`,
              capabilityId: 'AI-101',
              claim: 'This text is a transcription of what was said, not a clinical assessment of it.',
              confidence: dictatedMeta.confidence,
              band: dictatedMeta.band,
              computedAt: 'just now',
              inputs: [
                {
                  label: dictatedMeta.live ? 'Microphone audio, this session' : 'Captured sample for this field',
                  source: dictatedMeta.model,
                },
                { label: 'Recognition language', source: `${BCP47[language]} · ${LANGUAGES.find((l) => l.code === language)?.label}` },
              ],
              evidence: [
                'Words are transcribed as recognised; punctuation and casing are added.',
                'No clinical content is inferred, checked or corrected.',
              ],
              model: dictatedMeta.model,
              limits: [
                'A transcription confidence is not a statement about whether the content is correct.',
                dictatedMeta.live
                  ? 'Accuracy falls with background noise, accent and unfamiliar drug names — read it before signing.'
                  : 'This is a captured sample, not your speech. It is shown because live recognition was unavailable.',
                'Nothing is written to the legal record until the note is signed.',
              ],
            }}
          />
          <button
            type="button"
            onClick={start}
            disabled={someoneElse}
            className="inline-flex min-h-8 items-center gap-1 rounded-pill px-2 font-medium text-ink-3 hover:bg-glass-fill-hover hover:text-ink-2 disabled:opacity-45"
          >
            <Icon name="Mic" size={12} />
            Dictate more
          </button>
        </div>
      )}

      {/* AI-104 — the same table that rejects a banned abbreviation offers to write it out. */}
      {!recording && (canTidy || beforeTidy) && (
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

// ────────────────────────────────────────────────────── Voice · Type

/** The per-person input preference, as a two-way switch in Z4. */
export function InputModeSwitch({ className }: { className?: string }) {
  const aiActive = useAI(selectAiActive)
  const mode = useSession((s) => s.notesInput)
  const setMode = useSession((s) => s.setNotesInput)
  if (!aiActive) return null

  const option = (m: NotesInput, icon: string, text: string) => (
    <button
      key={m}
      type="button"
      role="radio"
      aria-checked={mode === m}
      onClick={() => setMode(m)}
      className={cx(
        'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-3 text-[0.88em] font-medium transition-colors duration-150',
        mode === m ? 'bg-glass-fill-strong text-ink shadow-sm' : 'text-ink-3 hover:text-ink-2',
      )}
    >
      <Icon name={icon} size={14} />
      {text}
    </button>
  )

  return (
    <div
      role="radiogroup"
      aria-label="How to fill note fields"
      className={cx('inline-flex items-center gap-0.5 rounded-pill border border-glass-hairline bg-glass-fill-muted p-0.5', className)}
    >
      {option('voice', 'Mic', 'Voice')}
      {option('type', 'PenLine', 'Type')}
    </div>
  )
}
