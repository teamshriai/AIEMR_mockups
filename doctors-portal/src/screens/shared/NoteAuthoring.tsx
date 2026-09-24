/**
 * The clinical note authoring surface, shared by S-06-03 (outpatient
 * consultation) and S-08-04 (inpatient progress note).
 *
 * Both are T1, both are ARC-15, and both carry the same three rules. Writing
 * them twice would be two places for those rules to drift apart:
 *
 *   • Sign is disabled until every section has text, EVERY AI-DRAFTED BLOCK
 *     HAS A DECISION, a leaf ICD-10 code is chosen, and the banned-abbreviation
 *     check has cleared.
 *   • CMP-NABH-10 — a signed note is never edited. LOCKED plus Addendum, and
 *     `amend` is a separate capability from `write`.
 *   • A resident holds `note.write` but not `note.sign`, so their primary
 *     action becomes "Save for co-sign".
 *
 * ONE TRUTH. `notes[enc].text[key]` in the clinical store is what will be
 * signed. A section shows its stored text whenever it has any; the AI ghost
 * draft shows only while the section is empty and undecided. Accept and Edit
 * copy the draft into the store; Reject and Undo empty it. A Deferred draft is
 * undecided and blocks Sign — it never signs as blank text.
 *
 * The note opens EMPTY. Each section is a `VoiceField`: spoken into first,
 * typed into always, tidied by AI-104 on request. Dictated or typed text is the
 * clinician's own and needs no Accept / Edit / Reject — signing confirms it.
 * "Draft with AI" is the one optional scribe path, and only ITS sections carry
 * C-41 and gate Sign.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup, FormGroups } from '@/archetypes'
import { can, canSignNotes } from '@/atlas/personas'
import { FieldChip, GhostSection } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { PrintPreview } from '@/components/print'
import { Alert, Button, Card, Chip, Field, Icon, TextInput } from '@/components/primitives'
import { LockedBanner, ValidationSummary } from '@/components/states'
import { InputModeSwitch, VoiceField } from '@/components/voicefield'
import type { DictatedMeta } from '@/components/voicefield'
import { bannedIn } from '@/data/abbreviations'
import { CODE_SUGGESTIONS, problemsFor } from '@/data/clinical'
import type { Encounter, NoteSectionSeed, SectionKey } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import { DIAGNOSES } from '@/data/kit'
import type { Patient } from '@/data/kit'
import { useAI, useOutstanding } from '@/store/ai'
import { useAudit } from '@/store/audit'
import { useClinical } from '@/store/clinical'
import type { SectionProvenance } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

export { bannedIn }

/** "OP number 26-27/118402" — the number staff quote, with its kind said once. */
export function encounterLabel(enc: Encounter): string {
  const [kind, ...rest] = enc.encounterNo.split('/')
  return `${kind} number ${rest.join('/')}`
}

export interface NoteAuthoringProps {
  screenId: string
  encounter: Encounter
  patient: Patient
  seeds: NoteSectionSeed[]
  /** Model name for the explainability drawer, per scribe capability. */
  scribeModel: string
  /** Opens the scribe overlay — the one emphasised header action. */
  onDraftAll?: () => void
  /** Extra Z4 actions, e.g. Prescribe / Order. Passed in as tertiary. */
  headerActions?: ReactNode
  /** Z6. */
  rail?: ReactNode
  railTitle?: string
  /** The count on the collapsed rail tab — how many actionable items it holds. */
  railBadge?: ReactNode
  /** Rendered above the fields — a risk banner, a NABH clock, a scribe overlay. */
  banner?: ReactNode
  /** Extra field groups below the standard ones. */
  extraGroups?: ReactNode
  /** Where Sign returns to. */
  onSigned?: () => void
  /** Whether to show the diagnosis-and-code group. */
  showCoding?: boolean
  /** Bound to Z3 as the case-clock strip or similar. */
  bannerExtra?: ReactNode
}

interface CodeOption {
  icd10: string
  label: string
  leaf: boolean
}

export function NoteAuthoring({
  screenId,
  encounter: enc,
  patient: p,
  seeds,
  scribeModel,
  onDraftAll,
  headerActions,
  rail,
  railTitle = 'Suggestions',
  railBadge,
  banner,
  extraGroups,
  onSigned,
  showCoding = true,
  bannerExtra,
}: NoteAuthoringProps) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const persona = useSession((s) => s.persona)
  const toast = useUI((s) => s.toast)
  const forced = useAI((s) => s.forcedState)
  const audit = useAudit((s) => s.record)

  const { note, setSectionText, setNoteCode, saveDraft, signNote, addendum } = useClinical()
  const record = note(enc.id)

  const [codeQuery, setCodeQuery] = useState('')
  const [blurred, setBlurred] = useState<Record<string, boolean>>({})
  const [confirmSign, setConfirmSign] = useState(false)
  const [addendumOpen, setAddendumOpen] = useState(false)
  const [addendumText, setAddendumText] = useState('')
  const [showValidation, setShowValidation] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)

  const locked = record.status === 'signed' || forced === 'LOCKED'
  const mayAmend = can(persona, 'op.note.amend') || can(persona, 'ip.note.amend')
  const maySign = canSignNotes(persona)

  /** Only sections the SCRIBE drafted are AI touchpoints. Dictated and typed text is the clinician's. */
  const scribed = useMemo(() => seeds.filter((s) => record.provenance[s.key] === 'scribe'), [seeds, record.provenance])
  const outstanding = useOutstanding(scribed.map((s) => `${enc.id}:${s.key}`))

  // ARC-15: autosave every 20s with a visible timestamp. Silent — no toast, no audit row.
  useEffect(() => {
    if (locked) return
    const t = window.setInterval(() => saveDraft(enc.id, 'auto'), 20_000)
    return () => window.clearInterval(t)
  }, [enc.id, locked, saveDraft])

  const textFor = (key: SectionKey) => record.text[key] ?? ''

  /** The ICD-10 index this build can search: the AI's proposals, the patient's problems, the kit's diagnoses. */
  const codeIndex = useMemo<CodeOption[]>(() => {
    const seen = new Set<string>()
    const out: CodeOption[] = []
    const add = (o: CodeOption) => {
      if (seen.has(o.icd10)) return
      seen.add(o.icd10)
      out.push(o)
    }
    for (const s of CODE_SUGGESTIONS) add({ icd10: s.icd10, label: s.label, leaf: s.leaf })
    for (const pr of problemsFor(p.id)) add({ icd10: pr.icd10, label: pr.label, leaf: pr.leaf })
    for (const d of DIAGNOSES) add({ icd10: d.icd10, label: d.label, leaf: true })
    return out
  }, [p.id])
  const codeMatches = useMemo(() => {
    const q = codeQuery.trim().toLowerCase()
    if (q.length < 2) return []
    return codeIndex.filter((o) => o.icd10.toLowerCase().includes(q) || o.label.toLowerCase().includes(q)).slice(0, 6)
  }, [codeQuery, codeIndex])

  /** Validation on blur, never on keystroke. The stored text is the only text that counts. */
  const problems = useMemo(() => {
    const out: { field: string; message: string }[] = []
    for (const seed of seeds) {
      const value = record.text[seed.key] ?? ''
      if (value.trim().length < 10) {
        out.push({ field: seed.label, message: 'dictate or type at least 10 characters' })
      } else if (blurred[seed.key]) {
        for (const h of bannedIn(value)) {
          out.push({ field: seed.label, message: `"${h.found}" is not accepted — write "${h.write}", or use Tidy up with AI` })
        }
      }
    }
    if (showCoding && !record.code) {
      out.push({ field: 'Diagnosis and ICD-10', message: 'a leaf ICD-10 code is required — accept the proposed code, pick a problem, or search' })
    }
    if (outstanding > 0) {
      out.push({
        field: 'AI drafts',
        message: `${outstanding} drafted ${outstanding === 1 ? 'section has' : 'sections have'} no decision yet`,
      })
    }
    return out
  }, [seeds, blurred, record.text, record.code, outstanding, showCoding])

  /** Every rule lives in `problems`, so this is the whole gate. */
  const canSignNow = problems.length === 0 && !locked
  const written = seeds.filter((s) => textFor(s.key).trim().length >= 10).length

  function doSign() {
    const status = signNote({ encounterId: enc.id, by: me.name, registrationNo: me.identifier, canSign: maySign })
    setConfirmSign(false)
    if (status === 'signed') {
      toast({
        tone: 'success',
        title: 'Note signed',
        detail: `Stamped ${me.name} · ${me.identifierKind} ${me.identifier} · ${formatTime(NOW)}. Queued to publish to ABDM.`,
      })
      onSigned?.()
    } else {
      toast({
        tone: 'caution',
        title: 'Saved for co-sign',
        detail: "You hold note.write but not note.sign for this class. It is now in the consultant's queue.",
      })
      navigate('/clinician/cosign')
    }
  }

  function doSaveDraft() {
    saveDraft(enc.id, 'manual')
    toast({ tone: 'info', title: 'Draft saved', detail: 'Nothing is signed. The draft stays on this device until you sign it.' })
  }

  const section = (seed: NoteSectionSeed) => (
    <Section
      key={seed.key}
      seed={seed}
      encounterId={enc.id}
      patientId={p.id}
      scribeModel={scribeModel}
      value={textFor(seed.key)}
      isScribe={record.provenance[seed.key] === 'scribe'}
      locked={locked}
      onChange={(v, prov) => setSectionText(enc.id, seed.key, v, prov)}
      onDictated={(meta) => {
        setSectionText(enc.id, seed.key, meta.text, 'dictated')
        /** §4.7 — every AI-assisted entry carries the model and the gate. */
        audit({
          event: 'AI.SCRIBE.TRANSCRIPT_CREATED',
          actor: me.name,
          actorId: me.id,
          subject: p.id,
          model: meta.model,
          gate: 'G2',
          detail: `${seed.label} · ${meta.words} words · ${meta.live ? 'live' : 'sample'} · ${meta.band}`,
        })
      }}
      onBlur={() => setBlurred((b) => ({ ...b, [seed.key]: true }))}
    />
  )

  const chosen = codeIndex.find((o) => o.icd10 === record.code)

  return (
    <Screen
      screenId={screenId}
      patient={p}
      bannerExtra={bannerExtra}
      loadingShape="form"
      states={[
        'LOADING',
        'PARTIAL',
        'ERROR',
        'VALIDATION',
        'DENIED',
        'BREAKGLASS',
        'OFFLINE',
        'SAVING',
        'LOCKED',
        'AI-OFF',
        'AI-ABSTAIN',
        'AI-LOW',
      ]}
      chips={
        <>
          <Chip tone={locked ? 'inactive' : 'caution'} icon={locked ? 'Lock' : 'PenLine'}>
            {record.status === 'signed' ? 'Signed' : record.status === 'cosign-pending' ? 'Co-sign pending' : 'Draft'}
          </Chip>
          <Chip tone="neutral" className="tabular" title={encounterLabel(enc)}>
            {enc.encounterNo}
          </Chip>
          {/* Only when it has left the building — "not published" is the silent default. */}
          {record.publishStatus !== undefined && (
            <Chip tone={record.publishStatus === 'failed' ? 'abnormal' : 'normal'} icon="Upload">
              ABDM {record.publishStatus}
            </Chip>
          )}
        </>
      }
      actions={
        <>
          {!locked && <InputModeSwitch />}
          {/* One emphasised action: the scribe. Everything else in the header is quiet. */}
          {!locked && onDraftAll && (
            <Button tone="ai" icon="Sparkles" onClick={onDraftAll}>
              Draft with AI
            </Button>
          )}
          {headerActions}
        </>
      }
      rail={rail}
      railTitle={railTitle}
      railBadge={railBadge}
      actionBar={
        locked ? (
          <>
            <span className="flex items-center gap-2 text-[0.9em] text-ink-3">
              <Icon name="Lock" size={14} />
              Signed by {record.signedBy ?? me.name}
              {record.signedAt && ` at ${formatDateTime(record.signedAt)}`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button icon="Printer" onClick={() => setPrintOpen(true)}>
                Print
              </Button>
              <Button
                tone="primary"
                icon="PenLine"
                disabled={!mayAmend}
                title={mayAmend ? undefined : 'Requires the amend capability, which is separate from write'}
                onClick={() => setAddendumOpen(true)}
              >
                Addendum
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button icon="Save" onClick={doSaveDraft}>
              Save draft
            </Button>
            <span className="tabular text-[0.86em] text-ink-3">
              {record.savedAt ? `${record.savedHow === 'auto' ? 'Autosaved' : 'Saved'} ${formatTime(record.savedAt)}` : 'Autosave on'}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {canSignNow ? (
                /* CMP-NABH-11 — the attestation is stamped on sign, never typed. Stated once, when it is about to happen. */
                <span className="tabular text-[0.88em] text-ink-3">
                  Signing will stamp {me.name} · {me.identifierKind} {me.identifier}
                </span>
              ) : (
                <span className="text-[0.88em] font-medium text-caution">
                  {outstanding > 0
                    ? `${outstanding} AI ${outstanding === 1 ? 'draft needs' : 'drafts need'} a decision`
                    : written < seeds.length
                      ? `${written} of ${seeds.length} sections written`
                      : showCoding && !record.code
                        ? 'ICD-10 code needed'
                        : `${problems.length} ${problems.length === 1 ? 'item' : 'items'} to fix`}
                </span>
              )}
              <Button
                tone="primary"
                icon="Signature"
                disabled={!canSignNow}
                title={canSignNow ? undefined : 'Every section needs text, every AI draft a decision, and a leaf ICD-10 code'}
                onClick={() => {
                  if (!canSignNow) {
                    setShowValidation(true)
                    return
                  }
                  setConfirmSign(true)
                }}
              >
                {maySign ? 'Sign' : 'Save for co-sign'}
              </Button>
            </div>
          </>
        )
      }
    >
      <div className="space-y-5">
        {locked && (
          <LockedBanner
            by={record.signedBy ?? me.name}
            at={record.signedAt ? formatDateTime(record.signedAt) : formatTime(NOW)}
            reason="signed"
            onAddendum={mayAmend ? () => setAddendumOpen(true) : undefined}
          />
        )}

        {!maySign && !locked && (
          <Alert tone="caution" title="You may write this note but not sign it">
            A registrar can write a note of this class but a consultant has to sign it. Your entry will be saved as{' '}
            <strong>Co-sign pending</strong> and appear in the consultant&rsquo;s queue.
          </Alert>
        )}

        {banner}

        {(showValidation || forced === 'VALIDATION') && problems.length > 0 && (
          <ValidationSummary
            problems={problems}
            onFocusFirst={() => {
              const first = seeds.find((s) => problems.some((pr) => pr.field === s.label))
              document.getElementById(`${enc.id}:${first?.key ?? seeds[0].key}`)?.scrollIntoView({ block: 'center' })
            }}
          />
        )}

        {/* S · O · A · P, then the code. The order a note is spoken in. */}
        <FormGroups columns={2}>
          <FieldGroup title="Subjective and objective" span>
            <div className="grid gap-5 lg:grid-cols-2">
              {seeds.filter((s) => s.key === 'subjective' || s.key === 'objective').map(section)}
            </div>
          </FieldGroup>

          <FieldGroup title="Assessment and plan" span>
            <div className="grid gap-5 lg:grid-cols-2">
              {seeds.filter((s) => s.key === 'assessment' || s.key === 'plan').map(section)}
            </div>
          </FieldGroup>

          {showCoding && (
            <FieldGroup title="Diagnosis and ICD-10" hint="SNOMED plus ICD-10 — leaf codes only" span>
              <Field
                label="ICD-10 code"
                required
                htmlFor={`${enc.id}-code-search`}
                hint={
                  record.code
                    ? `Coded ${record.code}. Pick another problem, or search, to change it.`
                    : 'Accept the proposed code, pick one of the patient’s problems, or search the ICD-10 index. A parent-only code is blocked.'
                }
                aiSlot={
                  <span className="flex flex-wrap items-center gap-1.5">
                    {CODE_SUGGESTIONS.slice(0, 2).map((s, i) => (
                      <FieldChip
                        key={s.icd10}
                        touchpointId={i === 0 ? `${enc.id}:code` : `${enc.id}:code-alt`}
                        capabilityId="AI-501"
                        suggestion={`${s.icd10} ${s.label}`}
                        band={s.confidence >= 0.85 ? 'HIGH' : s.confidence >= 0.6 ? 'MED' : 'LOW'}
                        score={s.confidence}
                        gate="G2"
                        locked={locked}
                        disabledReason={
                          s.leaf
                            ? undefined
                            : 'Parent-only code. A category will not group for a claim or satisfy a coder audit.'
                        }
                        onAccept={() => setNoteCode(enc.id, s.icd10)}
                        onUndo={() => {
                          if (record.code === s.icd10) setNoteCode(enc.id, undefined)
                        }}
                        explain={{
                          touchpointId: `${enc.id}:code`,
                          capabilityId: 'AI-501',
                          claim: `${s.icd10} — ${s.label} is the most specific code supported by the charted evidence.`,
                          confidence: s.confidence,
                          band: s.confidence >= 0.85 ? 'HIGH' : 'MED',
                          computedAt: formatTime(NOW),
                          inputs: problemsFor(p.id).map((pr) => ({
                            label: `${pr.label} (${pr.icd10})`,
                            source: `Problem list · onset ${pr.onset}`,
                          })),
                          evidence: [
                            'The assessment section names the condition explicitly.',
                            'Leaf codes only — parent categories are blocked at the field.',
                          ],
                          model: 'code-assist v3.2.0',
                          limits: [
                            'Proposes ICD-10 and SNOMED from the note text and the problem list.',
                            'Does not apply coding-for-reimbursement logic; that is the coder’s job downstream.',
                            'Picking a problem or searching the index is always available.',
                          ],
                        }}
                      />
                    ))}
                  </span>
                }
              >
                <div className="space-y-2.5">
                  {/* The patient's own problems — one tap codes the note. */}
                  <div className="flex flex-wrap gap-2">
                    {problemsFor(p.id).map((pr) => (
                      <button
                        key={pr.id}
                        type="button"
                        disabled={locked || !pr.leaf}
                        title={pr.leaf ? `Code this note ${pr.icd10}` : 'Parent-only code — pick a more specific one'}
                        aria-pressed={pr.icd10 === record.code}
                        onClick={() => setNoteCode(enc.id, pr.icd10)}
                        className="rounded-pill disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Chip tone={pr.icd10 === record.code ? 'brand' : 'neutral'} icon="Stethoscope">
                          {pr.label} · {pr.icd10}
                        </Chip>
                      </button>
                    ))}
                    {record.code && (
                      <span className="inline-flex items-center gap-1">
                        <Chip tone="normal" icon="Check">
                          Coded {record.code}
                          {chosen && ` · ${chosen.label}`}
                        </Chip>
                        {!locked && (
                          <button
                            type="button"
                            aria-label="Clear the code"
                            title="Clear the code"
                            onClick={() => setNoteCode(enc.id, undefined)}
                            className="inline-flex size-7 items-center justify-center rounded-pill text-ink-3 hover:bg-glass-fill-hover hover:text-ink"
                          >
                            <Icon name="X" size={13} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>

                  {/* The manual path the copy promises. Never hidden. */}
                  {!locked && (
                    <div className="relative max-w-md">
                      <TextInput
                        id={`${enc.id}-code-search`}
                        value={codeQuery}
                        onChange={(e) => setCodeQuery(e.target.value)}
                        placeholder="Search ICD-10 by code or diagnosis…"
                        aria-label="Search ICD-10"
                        autoComplete="off"
                      />
                      {codeQuery.trim().length >= 2 && (
                        <ul
                          role="listbox"
                          aria-label="ICD-10 matches"
                          className="menu-surface absolute z-20 mt-1 w-full overflow-hidden rounded-panel"
                        >
                          {codeMatches.length === 0 && (
                            <li className="px-3 py-2 text-[0.9em] text-ink-3">No match in this build&rsquo;s index.</li>
                          )}
                          {codeMatches.map((o) => (
                            <li key={o.icd10}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={o.icd10 === record.code}
                                disabled={!o.leaf}
                                title={o.leaf ? undefined : 'Parent-only code — a category cannot be signed'}
                                onClick={() => {
                                  setNoteCode(enc.id, o.icd10)
                                  setCodeQuery('')
                                }}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <span className="tabular w-16 shrink-0 font-semibold">{o.icd10}</span>
                                <span className="min-w-0 flex-1 truncate text-[0.95em]">{o.label}</span>
                                {!o.leaf && <Chip tone="caution">parent only</Chip>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </Field>
            </FieldGroup>
          )}

          {extraGroups}
        </FormGroups>

        {/*
          CMP-NABH-11 — the attestation is stamped on sign, never typed. While
          the note is a draft it is one line in the action bar; once signed it is
          on the LockedBanner and in the signed-by line. It is never a form block.
        */}

        {/* CMP-NABH-10 — original and addendum both visible, separately attributed. */}
        {record.addenda.length > 0 && (
          <Card className="p-5">
            <h2 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Addenda ({record.addenda.length})
            </h2>
            <ul className="mt-3 space-y-3">
              {record.addenda.map((a) => (
                <li key={a.id} className="rounded-panel border-l-[3px] border-l-brand bg-glass-fill-muted px-4 py-3">
                  <p className="leading-relaxed">{a.body}</p>
                  <p className="tabular mt-2 text-[0.86em] text-ink-3">
                    {a.by} · {a.registrationNo} · {formatDateTime(a.at)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.88em] text-ink-3">
              The original entry above is unchanged. A signed record is amended, never edited.
            </p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmSign}
        title={maySign ? 'Sign this note?' : 'Save for co-sign?'}
        consequence={
          maySign
            ? 'Signing is irreversible. The note is committed to the legal record, stamped with your name, registration number and the time, and queued to publish to ABDM. After this it can only be amended, never edited.'
            : "The note will be saved and sent to the consultant's co-sign queue. You will not be able to change it after that without an addendum."
        }
        confirmLabel={maySign ? 'Sign' : 'Save for co-sign'}
        onConfirm={doSign}
        onCancel={() => setConfirmSign(false)}
      />

      <ConfirmDialog
        open={addendumOpen}
        title="Add an addendum"
        consequence="The original entry stays exactly as signed. Your addendum is appended, separately attributed to you with its own timestamp."
        confirmLabel="Append addendum"
        onConfirm={() => {
          if (addendumText.trim().length < 5) return
          addendum({ encounterId: enc.id, body: addendumText.trim(), by: me.name, registrationNo: me.identifier })
          setAddendumText('')
          setAddendumOpen(false)
          toast({ tone: 'success', title: 'Addendum appended', detail: 'Both entries remain visible and attributed.' })
        }}
        onCancel={() => {
          setAddendumOpen(false)
          setAddendumText('')
        }}
      >
        <VoiceField
          id={`${enc.id}:addendum`}
          label="Addendum"
          rows={4}
          value={addendumText}
          onChange={setAddendumText}
          patientId={p.id}
          placeholder="What has changed, or what you are adding to the record…"
        />
      </ConfirmDialog>

      <PrintPreview
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title={enc.type === 'OP' ? 'Consultation note' : 'Progress note'}
        patient={p}
        meta={`${encounterLabel(enc)} · signed by ${record.signedBy ?? me.name}${record.signedAt ? ` · ${formatDateTime(record.signedAt)}` : ''}`}
        sections={[
          ...seeds.map((s) => ({ heading: s.label, body: textFor(s.key) })),
          ...(record.code ? [{ heading: 'Diagnosis and ICD-10', body: `${record.code}${chosen ? ` · ${chosen.label}` : ''}` }] : []),
          ...record.addenda.map((a) => ({ heading: `Addendum · ${a.by} · ${formatDateTime(a.at)}`, body: a.body })),
        ]}
        paper="A4"
      />
    </Screen>
  )
}

/**
 * One section. The stored text is the truth; the ghost draft shows only while
 * the section is empty and undecided; the VoiceField is the surface in every
 * other state, mic and all.
 */
function Section({
  seed,
  encounterId,
  patientId,
  scribeModel,
  value,
  isScribe,
  locked,
  onChange,
  onDictated,
  onBlur,
}: {
  seed: NoteSectionSeed
  encounterId: string
  patientId: string
  scribeModel: string
  value: string
  isScribe: boolean
  locked: boolean
  onChange: (v: string, provenance?: SectionProvenance) => void
  onDictated: (meta: DictatedMeta) => void
  onBlur: () => void
}) {
  const touchpointId = `${encounterId}:${seed.key}`
  const disposition = useAI((s) => s.dispositions[touchpointId])
  const accepted = disposition?.disposition === 'Accepted' || disposition?.disposition === 'Accepted with edits'
  const rejected = disposition?.disposition === 'Rejected'

  /**
   * Provenance for a scribe section: accepted text stays the AI's (the decision
   * says "with edits"); words typed into an empty or rejected section are the
   * clinician's, which drops the section out of the AI touchpoints.
   */
  const provenanceFor = (v: string): SectionProvenance | undefined =>
    !isScribe ? undefined : accepted || v.trim() === '' ? 'scribe' : 'typed'

  // The seed's draft doubles as the captured-sample fallback for THIS section,
  // so a browser without speech recognition still shows this patient's words.
  const field = (
    <VoiceField
      id={touchpointId}
      label={seed.label}
      required
      value={value}
      onChange={(v) => onChange(v, provenanceFor(v))}
      onDictated={onDictated}
      onBlur={onBlur}
      patientId={patientId}
      sample={seed.draft}
      disabled={locked}
      placeholder={rejected ? `Draft rejected. Dictate or type the ${seed.label.toLowerCase()}…` : undefined}
    />
  )

  if (!isScribe) return <div className="min-w-0">{field}</div>

  return (
    <div onBlur={onBlur} className="min-w-0">
      <GhostSection
        touchpointId={touchpointId}
        capabilityId={seed.ai}
        label={seed.label}
        draft={seed.draft}
        band={seed.band}
        score={seed.confidence}
        gate={seed.gate}
        locked={locked}
        value={value}
        field={field}
        onAccept={() => onChange(seed.draft, 'scribe')}
        onEdit={() => onChange(seed.draft, 'scribe')}
        onReject={() => onChange('', 'scribe')}
        onUndo={() => onChange('', 'scribe')}
        explain={{
          touchpointId,
          capabilityId: seed.ai,
          claim: `The ${seed.label.toLowerCase()} section was drafted from the encounter. You own the text once you accept it.`,
          confidence: seed.confidence,
          band: seed.band,
          computedAt: formatTime(NOW),
          inputs: seed.inputs,
          evidence: [seed.transcriptSpan],
          model: seed.ai === 'AI-103' ? 'note-draft v4.0.8' : scribeModel,
          limits: [
            'Drafts from the dictated transcript and the chart. It does not examine the patient.',
            'The raw transcript is retained verbatim and every sentence links back to its span.',
            'Dictating or typing is always available; nothing here requires the model.',
          ],
        }}
      />
    </div>
  )
}
