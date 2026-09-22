/**
 * The clinical note authoring surface, shared by S-06-03 (outpatient
 * consultation) and S-08-04 (inpatient progress note).
 *
 * Both are T1, both are ARC-15, and both carry the same three rules. Writing
 * them twice would be two places for those rules to drift apart:
 *
 *   • Sign is disabled until every required field is valid, EVERY G2 BLOCK HAS
 *     A DISPOSITION, and the banned-abbreviation check has cleared.
 *   • CMP-NABH-10 — a signed note is never edited. LOCKED plus Addendum, and
 *     `amend` is a separate capability from `write`.
 *   • A resident holds `note.write` but not `note.sign`, so their primary
 *     action becomes "Save for co-sign".
 *
 * What differs between the two screens is passed in: which scribe capability
 * drafts the sections, what sits in the Z6 rail, and which extra actions the
 * page header offers.
 */

import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup, FormGroups } from '@/archetypes'
import { can, canSignNotes } from '@/atlas/personas'
import { FieldChip, GhostSection } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Chip, Field, Icon, TextArea } from '@/components/primitives'
import { LockedBanner, ValidationSummary } from '@/components/states'
import { CODE_SUGGESTIONS, problemsFor } from '@/data/clinical'
import type { Encounter, NoteSectionSeed, SectionKey } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import type { Patient } from '@/data/kit'
import { useAI } from '@/store/ai'
import { allDispositioned, outstandingCount } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

/**
 * AI-114 · CMP-NABH-05. "Checked ON BLUR", and banned abbreviations are
 * rejected rather than warned about — so the message names the replacement.
 */
const BANNED: { pattern: RegExp; write: string }[] = [
  { pattern: /\bOD\b/, write: 'once daily' },
  { pattern: /\bBD\b/, write: 'twice daily' },
  { pattern: /\bIU\b|\bU\b/, write: 'units' },
  { pattern: /\bcc\b/, write: 'mL' },
  { pattern: /µg|\bug\b/, write: 'mcg' },
  { pattern: /\d+\.0\b/, write: 'the whole number, with no trailing zero' },
]

export function bannedIn(text: string): { found: string; write: string }[] {
  const hits: { found: string; write: string }[] = []
  for (const rule of BANNED) {
    const m = rule.pattern.exec(text)
    if (m) hits.push({ found: m[0], write: rule.write })
  }
  return hits
}

export interface NoteAuthoringProps {
  screenId: string
  encounter: Encounter
  patient: Patient
  seeds: NoteSectionSeed[]
  /** Model name for the explainability drawer, per scribe capability. */
  scribeModel: string
  /** Extra Z4 actions, e.g. Dictate / Prescribe / Order. */
  headerActions?: ReactNode
  /** Z6. */
  rail?: ReactNode
  railTitle?: string
  /** Rendered above the fields — a risk banner, a NABH clock, a scribe overlay. */
  banner?: ReactNode
  /** Extra field groups below the standard ones. */
  extraGroups?: ReactNode
  /** Where Sign returns to. */
  onSigned?: () => void
  /** Whether to show the problem-and-code group. */
  showCoding?: boolean
  /** Bound to Z3 as the case-clock strip or similar. */
  bannerExtra?: ReactNode
}

export function NoteAuthoring({
  screenId,
  encounter: enc,
  patient: p,
  seeds,
  scribeModel,
  headerActions,
  rail,
  railTitle = 'Suggestions',
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
  const dispositions = useAI((s) => s.dispositions)

  const { note, setSectionText, saveDraft, signNote, addendum } = useClinical()
  const record = note(enc.id)

  const [problemCode, setProblemCode] = useState('')
  const [blurred, setBlurred] = useState<Record<string, boolean>>({})
  const [confirmSign, setConfirmSign] = useState(false)
  const [addendumOpen, setAddendumOpen] = useState(false)
  const [addendumText, setAddendumText] = useState('')
  const [showValidation, setShowValidation] = useState(false)

  const locked = record.status === 'signed' || forced === 'LOCKED'
  const mayAmend = can(persona, 'op.note.amend') || can(persona, 'ip.note.amend')
  const maySign = canSignNotes(persona)

  const g2Touchpoints = useMemo(
    () => [...seeds.map((s) => `${enc.id}:${s.key}`), ...(showCoding ? [`${enc.id}:code`] : [])],
    [seeds, enc.id, showCoding],
  )
  const outstanding = outstandingCount(g2Touchpoints)
  const dispositionsDone = allDispositioned(g2Touchpoints)

  // ARC-15: autosave every 20s with a visible timestamp.
  useEffect(() => {
    if (locked) return
    const t = window.setInterval(() => saveDraft(enc.id), 20_000)
    return () => window.clearInterval(t)
  }, [enc.id, locked, saveDraft])

  const textFor = (key: SectionKey) => record.text[key] ?? ''

  /** Validation on blur, never on keystroke. */
  const problems = useMemo(() => {
    const out: { field: string; message: string }[] = []
    for (const seed of seeds) {
      const d = dispositions[`${enc.id}:${seed.key}`]
      const value = textFor(seed.key) || (d && d.disposition !== 'Rejected' ? seed.draft : '')
      if (value.trim().length < 10) {
        out.push({ field: seed.label, message: 'at least 10 characters are required' })
      } else if (blurred[seed.key]) {
        for (const h of bannedIn(value)) {
          out.push({ field: seed.label, message: `"${h.found}" is banned — write "${h.write}"` })
        }
      }
    }
    if (showCoding && !problemCode) {
      out.push({ field: 'Problem & code', message: 'a leaf ICD-10 code is required' })
    }
    if (outstanding > 0) {
      out.push({
        field: 'AI drafts',
        message: `${outstanding} drafted ${outstanding === 1 ? 'section has' : 'sections have'} no disposition yet`,
      })
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeds, dispositions, enc.id, blurred, problemCode, outstanding, record.text, showCoding])

  const canSignNow = problems.length === 0 && dispositionsDone && !locked

  function doSign() {
    const status = signNote({ encounterId: enc.id, by: me.name, registrationNo: me.identifier, canSign: maySign })
    setConfirmSign(false)
    if (status === 'signed') {
      toast({
        tone: 'success',
        title: 'Signed and queued for ABDM',
        detail: `Stamped ${me.name} · ${me.identifierKind} ${me.identifier} · ${formatTime(NOW)}.`,
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
          <Chip tone="neutral" className="tabular">
            {enc.encounterNo}
          </Chip>
          {record.publishStatus && (
            <Chip tone={record.publishStatus === 'failed' ? 'abnormal' : 'normal'} icon="Upload">
              ABDM {record.publishStatus}
            </Chip>
          )}
        </>
      }
      actions={headerActions}
      rail={rail}
      railTitle={railTitle}
      actionBar={
        locked ? (
          <>
            <span className="flex items-center gap-2 text-[0.9em] text-ink-3">
              <Icon name="Lock" size={14} />
              Signed by {record.signedBy ?? me.name}
              {record.signedAt && ` at ${formatDateTime(record.signedAt)}`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button icon="Printer">Print</Button>
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
            <Button icon="Save" onClick={() => saveDraft(enc.id)}>
              Save draft
            </Button>
            <span className="tabular text-[0.86em] text-ink-3">
              {record.savedAt ? `Autosaved ${formatTime(record.savedAt)}` : 'Autosaves every 20 seconds'}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {!canSignNow && (
                <span className="text-[0.88em] font-medium text-caution">
                  {outstanding > 0
                    ? `${outstanding} AI ${outstanding === 1 ? 'draft needs' : 'drafts need'} a decision`
                    : `${problems.length} ${problems.length === 1 ? 'item' : 'items'} outstanding`}
                </span>
              )}
              <Button
                tone="primary"
                icon="Signature"
                disabled={!canSignNow}
                onClick={() => {
                  if (!canSignNow) {
                    setShowValidation(true)
                    return
                  }
                  setConfirmSign(true)
                }}
              >
                {maySign ? 'Sign & publish' : 'Save for co-sign'}
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
            A registrar holds <code className="font-mono text-[0.9em]">note.write</code> but not{' '}
            <code className="font-mono text-[0.9em]">note.sign</code> for classes that require a consultant. Your entry
            will be saved as <strong>Co-sign pending</strong> and appear in the consultant&rsquo;s queue.
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

        <FormGroups columns={2}>
          <FieldGroup title="Subjective & objective" span>
            <div className="grid gap-5 lg:grid-cols-2">
              {seeds
                .filter((s) => s.key === 'subjective' || s.key === 'objective')
                .map((seed) => (
                  <Section
                    key={seed.key}
                    seed={seed}
                    encounterId={enc.id}
                    scribeModel={scribeModel}
                    value={textFor(seed.key)}
                    locked={locked}
                    onChange={(v) => setSectionText(enc.id, seed.key, v)}
                    onBlur={() => setBlurred((b) => ({ ...b, [seed.key]: true }))}
                  />
                ))}
            </div>
          </FieldGroup>

          {showCoding && (
            <FieldGroup title="Problem & diagnosis code" hint="SNOMED plus ICD-10 — leaf codes only" span>
              <Field
                label="Problem & code"
                required
                htmlFor={`${enc.id}-code`}
                hint={
                  problemCode
                    ? `Coded ${problemCode}. Change it by picking another, or search the full ICD-10 index.`
                    : 'The assistant proposes a code; a parent-only code is blocked at the field.'
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
                        disabledReason={
                          s.leaf
                            ? undefined
                            : 'Parent-only code. A category will not group for a claim or satisfy a coder audit.'
                        }
                        onAccept={() => setProblemCode(s.icd10)}
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
                            'Manual search is always available and never hidden.',
                          ],
                        }}
                      />
                    ))}
                  </span>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {problemsFor(p.id).map((pr) => (
                    <Chip key={pr.id} tone={pr.icd10 === problemCode ? 'brand' : 'neutral'} icon="Stethoscope">
                      {pr.label} · {pr.icd10}
                    </Chip>
                  ))}
                  {problemCode && (
                    <Chip tone="normal" icon="Check">
                      Coded {problemCode}
                    </Chip>
                  )}
                </div>
              </Field>
            </FieldGroup>
          )}

          <FieldGroup title="Assessment & plan" span>
            <div className="grid gap-5 lg:grid-cols-2">
              {seeds
                .filter((s) => s.key === 'assessment' || s.key === 'plan')
                .map((seed) => (
                  <Section
                    key={seed.key}
                    seed={seed}
                    encounterId={enc.id}
                    scribeModel={scribeModel}
                    value={textFor(seed.key)}
                    locked={locked}
                    onChange={(v) => setSectionText(enc.id, seed.key, v)}
                    onBlur={() => setBlurred((b) => ({ ...b, [seed.key]: true }))}
                  />
                ))}
            </div>
          </FieldGroup>

          {extraGroups}

          {/* CMP-NABH-11 — stamped on sign, never typed. */}
          <FieldGroup
            title="Attestation"
            hint="Author identity, registration number and timestamp are stamped on signing — this block is never typed"
            span
          >
            <div className="rounded-panel bg-glass-fill-muted px-4 py-3">
              <p className="font-medium">{record.signedBy ?? me.name}</p>
              <p className="tabular text-[0.9em] text-ink-3">
                {me.identifierKind} {me.identifier} · {me.personaLabel}
              </p>
              <p className="tabular mt-1 text-[0.9em] text-ink-3">
                {record.signedAt ? formatDateTime(record.signedAt) : 'will stamp at the moment of signing'}
              </p>
            </div>
          </FieldGroup>
        </FormGroups>

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
        title={maySign ? 'Sign and publish this note?' : 'Save for co-sign?'}
        consequence={
          maySign
            ? 'Signing is irreversible. The note is committed to the legal record, stamped with your name, registration number and the time, and queued to publish to ABDM. After this it can only be amended, never edited.'
            : "The note will be saved and sent to the consultant's co-sign queue. You will not be able to change it after that without an addendum."
        }
        confirmLabel={maySign ? 'Sign & publish' : 'Save for co-sign'}
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
        <TextArea
          rows={4}
          autoFocus
          value={addendumText}
          onChange={(e) => setAddendumText(e.target.value)}
          placeholder="What has changed, or what you are adding to the record…"
        />
      </ConfirmDialog>
    </Screen>
  )
}

/** One drafted section: ghost text in the field, C-41 beneath it. */
function Section({
  seed,
  encounterId,
  scribeModel,
  value,
  locked,
  onChange,
  onBlur,
}: {
  seed: NoteSectionSeed
  encounterId: string
  scribeModel: string
  value: string
  locked: boolean
  onChange: (v: string) => void
  onBlur: () => void
}) {
  return (
    <div onBlur={onBlur} className="min-w-0">
      <GhostSection
        touchpointId={`${encounterId}:${seed.key}`}
        capabilityId={seed.ai}
        label={seed.label}
        draft={seed.draft}
        band={seed.band}
        score={seed.confidence}
        gate={seed.gate}
        locked={locked}
        value={value || undefined}
        onChange={onChange}
        explain={{
          touchpointId: `${encounterId}:${seed.key}`,
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
            'Typing is always available; nothing here requires the model.',
          ],
        }}
      />
    </div>
  )
}
