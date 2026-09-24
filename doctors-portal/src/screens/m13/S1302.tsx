/**
 * S-13-02 · Discharge Summary Authoring — `/encounter/:id/discharge-summary` · T2 · ARC-15
 *
 * "The discharge summary, drafted from the admission and blocked until
 * complete."
 *
 * AI-106 is a G3 touchpoint — attest, not merely confirm — because a discharge
 * summary enters the legal record and is published to ABDM. So the primary
 * action carries a signature block and a fixed-wording attestation, not just an
 * Accept button.
 *
 * "the handover that decides whether the patient comes back" is M-13's
 * one-liner, which is why the follow-up and the red-flag sections are required
 * rather than optional.
 *
 * The six sections open EMPTY. Each is a `VoiceField` — spoken first, typed
 * always. "Draft with AI" is the one AI path: it fills all six as
 * AI-106 ghost drafts, and those carry the G3 bar until each has a decision.
 * The draft text lives in the shared clinical store, so leaving and returning
 * does not lose it.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup, FormGroups } from '@/archetypes'
import { AIActionBar, Diamond } from '@/components/ai'
import { SectionCard, Why } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { PrintPreview } from '@/components/print'
import { Button, Checkbox, Chip, Icon, Select, cx } from '@/components/primitives'
import { LockedBanner, ValidationSummary } from '@/components/states'
import { InputModeSwitch, VoiceField } from '@/components/voicefield'
import { DISCHARGE_DRAFT_SD_P_03, encounter, problemsFor } from '@/data/clinical'
import { formatDate, formatDateTime, formatTime, NOW } from '@/data/format'
import { LANGUAGES, patient } from '@/data/kit'
import { decided, selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import type { SectionProvenance } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const SECTIONS = DISCHARGE_DRAFT_SD_P_03

/** A draft short enough to fit two lines needs no "Read more". */
const CLAMP_FROM = 170

export function S1302({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)
  const forced = useAI((s) => s.forcedState)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const { note, setSectionText, applyScribeDraft, signNote, saveDraft } = useClinical()
  const noteId = `${enc.id}:discharge`
  const record = note(noteId)
  const [printOpen, setPrintOpen] = useState(false)

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [attested, setAttested] = useState(false)
  const [language, setLanguage] = useState('KN')
  const [confirmSign, setConfirmSign] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const locked = record.status === 'signed' || forced === 'LOCKED'

  // ARC-15: autosave every 20s, silently.
  useEffect(() => {
    if (locked) return
    const t = window.setInterval(() => saveDraft(noteId, 'auto'), 20_000)
    return () => window.clearInterval(t)
  }, [noteId, locked, saveDraft])

  const isScribe = (key: string) => aiActive && record.provenance[key] === 'scribe'
  const scribeKeys = SECTIONS.filter((s) => isScribe(s.key)).map((s) => `${enc.id}:disch:${s.key}`)
  // Deferred is undecided: it must never let a blank section through to attestation.
  const outstanding = scribeKeys.filter((k) => !decided(dispositions[k])).length
  /** The stored text is the only text that counts — never the draft on its own. */
  const valueOf = (s: (typeof SECTIONS)[number]) => record.text[s.key] ?? ''
  const written = SECTIONS.filter((s) => valueOf(s).trim().length >= 20).length

  const problems = useMemo(() => {
    const out: { field: string; message: string }[] = []
    for (const s of SECTIONS) {
      if (s.required && valueOf(s).trim().length < 20) {
        out.push({ field: s.label, message: 'required — dictate or type at least 20 characters' })
      }
    }
    if (!attested) out.push({ field: 'Attestation', message: 'a G3 touchpoint needs your signature, not just a click' })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.text, attested])

  const canSign = problems.length === 0 && outstanding === 0 && !locked
  const languageLabel = LANGUAGES.find((l) => l.code === language)?.label ?? language

  return (
    <Screen
      screenId="S-13-02"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      subheading={
        locked ? (
          <>Signed · prints in English and {languageLabel}</>
        ) : (
          <>
            {written} of {SECTIONS.length} sections written · prints in English and {languageLabel}
          </>
        )
      }
      chips={
        <Chip tone={locked ? 'inactive' : 'caution'} icon={locked ? 'Lock' : 'PenLine'}>
          {locked ? 'Signed' : 'Draft'}
        </Chip>
      }
      actions={
        <>
          {!locked && <InputModeSwitch />}
          {!locked && aiActive && (
            <Button
              tone="ai"
              icon="Sparkles"
              onClick={() => {
                const drafted = applyScribeDraft(
                  noteId,
                  SECTIONS.map((s) => s.key),
                )
                toast({
                  tone: 'info',
                  title:
                    drafted.length === 0
                      ? 'Nothing to draft — every section already has your words'
                      : `${drafted.length} of 6 sections drafted from the record`,
                  detail:
                    drafted.length === 0
                      ? 'The scribe never overwrites what you dictated or typed.'
                      : 'AI-106 read signed entries only. Each drafted section needs a decision, then you attest by name.',
                })
              }}
            >
              Draft with AI
            </Button>
          )}
          <Button tone="tertiary" icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/med-rec`)}>
            Medication reconciliation
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Patient's language" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Patient's language">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-[0.86em] text-ink-3">
              The summary prints in English plus this language, following the patient&rsquo;s preference.
            </p>
          </SectionCard>

          <Why label="What happens on signing">
            <ul className="space-y-2 text-ink-2">
              {[
                'Printed A4, 2–4 pages, bilingual',
                'Published to ABDM as a DischargeSummary',
                'Pushed to the patient app in their language',
                'Copy to the referring doctor',
                'The bed is released on the discharge board',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[0.92em] text-ink-3">
              On request, AI-106 drafts the six sections from the admission note, the course of treatment, the results
              and the medication record, from signed entries only. Dictating or typing each section yourself is the
              default.
            </p>
          </Why>
        </div>
      }
      railTitle="Discharge"
      actionBar={
        locked ? (
          <>
            <span className="flex items-center gap-2 text-[0.9em] text-ink-3">
              <Icon name="Lock" size={14} />
              Signed by {record.signedBy} · {formatDateTime(record.signedAt ?? NOW)}
            </span>
            <div className="ml-auto flex gap-2">
              <Button icon="Printer" onClick={() => setPrintOpen(true)}>
                Print A4, bilingual
              </Button>
              <Button tone="primary" icon="ArrowRight" onClick={() => navigate('/discharge/board')}>
                Back to the board
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button
              icon="Save"
              onClick={() => {
                saveDraft(noteId, 'manual')
                toast({ tone: 'info', title: 'Draft saved', detail: 'Nothing is signed. The summary stays a draft until you attest and sign it.' })
              }}
            >
              Save draft
            </Button>
            <span className="tabular text-[0.86em] text-ink-3">
              {record.savedAt ? `${record.savedHow === 'auto' ? 'Autosaved' : 'Saved'} ${formatTime(record.savedAt)}` : 'Autosave on'}
            </span>
            <span className="text-[0.88em] text-ink-3">
              {outstanding > 0
                ? `${outstanding} drafted ${outstanding === 1 ? 'section needs' : 'sections need'} a decision`
                : written < SECTIONS.length
                  ? `${written} of ${SECTIONS.length} sections written`
                  : problems.length > 0
                    ? `${problems.length} outstanding`
                    : 'Ready to attest'}
            </span>
            <Button
              tone="primary"
              className="ml-auto"
              icon="Signature"
              disabled={!canSign}
              onClick={() => {
                if (!canSign) {
                  setShowValidation(true)
                  return
                }
                setConfirmSign(true)
              }}
            >
              Attest and sign
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {locked && (
          <LockedBanner by={record.signedBy ?? me.name} at={formatDateTime(record.signedAt ?? NOW)} reason="signed" />
        )}

        {(showValidation || forced === 'VALIDATION') && problems.length > 0 && (
          <ValidationSummary problems={problems} />
        )}

        <FormGroups columns={1}>
          <FieldGroup title="Summary" hint="Six sections, all required · dictate or type, or Draft with AI">
          <div className="space-y-5">
          {SECTIONS.map((s) => {
            const key = `${enc.id}:disch:${s.key}`
            const d = dispositions[key]
            const scribe = isScribe(s.key)
            const accepted = d?.disposition === 'Accepted' || d?.disposition === 'Accepted with edits'
            const clampable = s.draft.length > CLAMP_FROM
            const open = expanded[s.key] ?? false
            /** Accepted text stays the AI's; words typed into an empty or rejected section are the clinician's. */
            const provenanceFor = (v: string): SectionProvenance | undefined =>
              !scribe ? undefined : accepted || v.trim() === '' ? 'scribe' : 'typed'
            const field = (
              <VoiceField
                id={key}
                label={s.label}
                required={s.required}
                rows={s.key === 'course' ? 6 : 3}
                value={valueOf(s)}
                onChange={(v) => setSectionText(noteId, s.key, v, provenanceFor(v))}
                onDictated={(meta) => setSectionText(noteId, s.key, meta.text, 'dictated')}
                patientId={p.id}
                sample={s.draft}
                disabled={locked}
                placeholder={d?.disposition === 'Rejected' ? `Draft rejected. Dictate or type the ${s.label.toLowerCase()}…` : undefined}
              />
            )
            // The ghost shows only while there is nothing of the clinician's to show: undecided AND empty.
            const showGhost = scribe && !decided(d) && valueOf(s).trim() === ''
            return (
              <div key={s.key} className="min-w-0">
                {showGhost ? (
                  <>
                    <p className="mb-1.5 flex items-center gap-2 text-[0.92em] font-medium text-ink-2">
                      {s.label} <span className="text-abnormal">*</span>
                      <Diamond size={10} />
                      <span className="text-[0.86em] font-normal text-ink-3">AI-106 draft</span>
                    </p>
                    <div className="ai-ghost rounded-field px-3.5 py-3">
                      <p className={cx('leading-relaxed', clampable && !open && 'line-clamp-2')}>{s.draft}</p>
                      {clampable && (
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setExpanded((x) => ({ ...x, [s.key]: !open }))}
                          className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-pill px-1.5 text-[0.86em] font-medium text-ink-3 hover:bg-glass-fill-hover hover:text-ink-2"
                        >
                          {open ? 'Show less' : 'Read more'}
                          <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={12} />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  field
                )}
                {scribe && (
                    <AIActionBar
                      className="mt-2"
                      touchpointId={key}
                      capabilityId="AI-106"
                      gate="G3"
                      band="MED"
                      score={0.81}
                      locked={locked}
                      onAccept={() => setSectionText(noteId, s.key, s.draft, 'scribe')}
                      onEdit={() => setSectionText(noteId, s.key, s.draft, 'scribe')}
                      onReject={() => setSectionText(noteId, s.key, '', 'scribe')}
                      onUndo={() => setSectionText(noteId, s.key, '', 'scribe')}
                      explain={{
                        touchpointId: key,
                        capabilityId: 'AI-106',
                        claim: `The ${s.label.toLowerCase()} section, drafted from the admission record and the course of treatment.`,
                        confidence: 0.81,
                        band: 'MED',
                        computedAt: formatTime(NOW),
                        inputs: [
                          { label: 'Admission note', source: `IP number ${enc.encounterNo.split('/').slice(1).join('/')}` },
                          { label: 'Signed progress notes', source: 'Notes, whole admission' },
                          { label: 'Results across the admission', source: `Results for ${p.id}` },
                          ...problemsFor(p.id).map((pr) => ({
                            label: `${pr.label} (${pr.icd10})`,
                            source: 'Problem list',
                          })),
                        ],
                        evidence: ['Assembled from signed entries only — it does not read unsigned drafts.'],
                        model: 'discharge-draft v3.1.0',
                        limits: [
                          'Drafts from what was charted. A conversation with the family that was not documented is not in it.',
                          'At G3 it does not enter the record until you attest to it by name.',
                          'Dictating or typing the section yourself is always available.',
                        ],
                      }}
                    />
                )}
              </div>
            )
          })}
          </div>
          </FieldGroup>

          <FieldGroup
            title="Attestation"
            hint="Fixed wording, required at G3 — it is not editable and it is stamped with your registration number"
          >
            <Checkbox
              checked={attested}
              onChange={setAttested}
              disabled={locked}
              label={
                <>
                  I have reviewed this content and it is accurate.
                  <span className="block text-[0.88em] text-ink-3">
                    {me.name} · {me.identifierKind} {me.identifier} · will stamp {formatDate(NOW)}
                  </span>
                </>
              }
            />
            <Why label="Why attest rather than confirm">
              <p className="text-ink-2">
                A discharge summary enters the legal medical record and is published to ABDM, so AI-106 sits at G3.
                Accepting the drafted sections is not enough: the primary action requires a signature and this
                fixed-wording attestation that you have reviewed the content.
              </p>
            </Why>
          </FieldGroup>
        </FormGroups>
      </div>

      <ConfirmDialog
        open={confirmSign}
        title="Attest and sign this discharge summary?"
        consequence="Attesting is irreversible. The summary is committed to the legal record with your name and registration number, printed bilingually, published to ABDM, pushed to the patient app and copied to the referring doctor. After this it can only be amended."
        confirmLabel="Attest and sign"
        onConfirm={() => {
          signNote({ encounterId: noteId, by: me.name, registrationNo: me.identifier, canSign: true })
          setConfirmSign(false)
          toast({
            tone: 'success',
            title: 'Discharge summary published',
            detail: `Stamped ${me.name} · ${me.identifier}. ABDM publish queued; the bed is released on the board.`,
          })
        }}
        onCancel={() => setConfirmSign(false)}
      />

      <PrintPreview
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Discharge summary"
        patient={p}
        meta={`${enc.encounterNo} · signed by ${record.signedBy ?? me.name} · ${formatDateTime(record.signedAt ?? NOW)} · English and ${languageLabel}`}
        sections={SECTIONS.map((s) => ({ heading: s.label, body: valueOf(s) }))}
        paper="A4"
      />
    </Screen>
  )
}
