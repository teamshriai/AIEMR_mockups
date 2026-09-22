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
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup, FormGroups } from '@/archetypes'
import { AIActionBar, Diamond } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Checkbox, Chip, Field, Icon, Select, TextArea } from '@/components/primitives'
import { LockedBanner, ValidationSummary } from '@/components/states'
import { encounter, problemsFor } from '@/data/clinical'
import { formatDate, formatDateTime, formatTime, NOW } from '@/data/format'
import { LANGUAGES, patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const SECTIONS = [
  {
    key: 'reason',
    label: 'Reason for admission',
    required: true,
    draft:
      'Admitted on 17-Sep-2026 with a four-day history of productive cough, fever and progressive breathlessness. Chest imaging confirmed right lower lobe consolidation. Treated as community-acquired pneumonia.',
  },
  {
    key: 'course',
    label: 'Course in hospital',
    required: true,
    draft:
      'Started on piperacillin-tazobactam 4.5g IV 8-hourly on admission. Blood cultures were taken before antibiotics and showed no growth at 48 hours. Oxygen requirement rose from 2 L to 4 L overnight on 20/21-Sep with a NEWS2 of 7; CRP rose from 96 to 184 mg/L. Antibiotic cover was escalated after review of the documented penicillin allergy. Creatinine rose to 212 µmol/L, meeting stage 2 acute kidney injury, and the enoxaparin dose was renally adjusted. He improved from 22-Sep with weaning of oxygen to room air by 24-Sep.',
  },
  {
    key: 'diagnosis',
    label: 'Discharge diagnosis',
    required: true,
    draft: 'Community-acquired pneumonia, right lower lobe (J18.9). Acute kidney injury, stage 2, resolved. Type 2 diabetes (E11.9), pre-existing.',
  },
  {
    key: 'meds',
    label: 'Medication on discharge',
    required: true,
    draft:
      'Levofloxacin 750 mg orally once daily for a further 3 days. Atorvastatin 40 mg at night, continued. Metformin 500 mg twice daily, restarted 23-Sep after renal function recovered. Enoxaparin stopped on discharge.',
  },
  {
    key: 'followup',
    label: 'Follow-up',
    required: true,
    draft:
      'Chest clinic in 6 weeks with a repeat chest X-ray beforehand. Serum creatinine and electrolytes in 1 week at the local laboratory. General medicine review with Dr Iyer in 4 weeks.',
  },
  {
    key: 'redflags',
    label: 'When to come back',
    required: true,
    draft:
      'Return immediately if breathlessness worsens, fever returns above 38 °C, you cough up blood, or you become confused or unusually drowsy. Attend the emergency department rather than waiting for the clinic appointment.',
  },
] as const

export function S1302({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)
  const forced = useAI((s) => s.forcedState)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const { note, signNote } = useClinical()
  const record = note(`${enc.id}:discharge`)

  const [text, setText] = useState<Record<string, string>>({})
  const [attested, setAttested] = useState(false)
  const [language, setLanguage] = useState('KN')
  const [confirmSign, setConfirmSign] = useState(false)
  const [showValidation, setShowValidation] = useState(false)

  const locked = record.status === 'signed' || forced === 'LOCKED'

  const g2 = SECTIONS.map((s) => `${enc.id}:disch:${s.key}`)
  const outstanding = g2.filter((k) => !dispositions[k]).length

  const problems = useMemo(() => {
    const out: { field: string; message: string }[] = []
    for (const s of SECTIONS) {
      const d = dispositions[`${enc.id}:disch:${s.key}`]
      const value = text[s.key] ?? (d && d.disposition !== 'Rejected' ? s.draft : '')
      if (s.required && value.trim().length < 20) {
        out.push({ field: s.label, message: 'required, and at least 20 characters' })
      }
    }
    if (!attested) out.push({ field: 'Attestation', message: 'a G3 touchpoint needs your signature, not just a click' })
    return out
  }, [dispositions, enc.id, text, attested])

  const canSign = problems.length === 0 && outstanding === 0 && !locked

  return (
    <Screen
      screenId="S-13-02"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      chips={
        <>
          <Chip tone={locked ? 'inactive' : 'caution'} icon={locked ? 'Lock' : 'PenLine'}>
            {locked ? 'Signed' : 'Draft'}
          </Chip>
          <Chip tone="caution">G3 · attest</Chip>
          <Chip tone="neutral" icon="Globe">
            bilingual
          </Chip>
        </>
      }
      actions={
        <Button icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/med-rec`)}>
          Medication reconciliation
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">On signing</h3>
            <ul className="mt-2 space-y-2 text-[0.9em] text-ink-2">
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
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Patient&rsquo;s language
            </h3>
            <Select className="mt-2" value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Patient's language">
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-[0.86em] text-ink-3">
              The summary prints in English plus this language. It follows the patient&rsquo;s preference, not yours.
            </p>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-106 · drafted from the admission
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Six sections drafted from the admission note, the course of treatment, the results and the medication
              record. The fallback is a structured template you complete manually.
            </p>
          </Card>
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
              <Button icon="Printer">Print A4, bilingual</Button>
              <Button tone="primary" icon="ArrowRight" onClick={() => navigate('/discharge/board')}>
                Back to the board
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button icon="Save">Save draft</Button>
            <span className="text-[0.88em] text-ink-3">
              {outstanding > 0
                ? `${outstanding} drafted ${outstanding === 1 ? 'section needs' : 'sections need'} a decision`
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
              Attest &amp; publish
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {locked && (
          <LockedBanner by={record.signedBy ?? me.name} at={formatDateTime(record.signedAt ?? NOW)} reason="signed" />
        )}

        <Alert tone="caution" title="This is a G3 touchpoint — attest, not confirm">
          A discharge summary enters the legal medical record and is published to ABDM. Accepting the drafted sections
          is not enough: the primary action requires a signature and a fixed-wording attestation that you have reviewed
          the content.
        </Alert>

        {(showValidation || forced === 'VALIDATION') && problems.length > 0 && (
          <ValidationSummary problems={problems} />
        )}

        <FormGroups columns={1}>
          {SECTIONS.map((s) => {
            const key = `${enc.id}:disch:${s.key}`
            const d = dispositions[key]
            const accepted = d && d.disposition !== 'Rejected'
            return (
              <FieldGroup key={s.key} title={s.label}>
                {aiActive && !accepted && !locked ? (
                  <>
                    <div className="ai-ghost rounded-field px-3.5 py-3">
                      <p className="mb-2 flex items-center gap-2 text-[0.8em] font-semibold tracking-wide text-ai uppercase">
                        <Diamond size={10} />
                        AI-106 draft
                      </p>
                      <p className="leading-relaxed">{s.draft}</p>
                    </div>
                    <AIActionBar
                      touchpointId={key}
                      capabilityId="AI-106"
                      gate="G3"
                      band="MED"
                      score={0.81}
                      onAccept={() => setText((t) => ({ ...t, [s.key]: s.draft }))}
                      onEdit={() => setText((t) => ({ ...t, [s.key]: s.draft }))}
                      explain={{
                        touchpointId: key,
                        capabilityId: 'AI-106',
                        claim: `The ${s.label.toLowerCase()} section, drafted from the admission record and the course of treatment.`,
                        confidence: 0.81,
                        band: 'MED',
                        computedAt: formatTime(NOW),
                        inputs: [
                          { label: 'Admission note', source: `Encounter ${enc.encounterNo}` },
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
                          'The fallback is a structured template, completed manually.',
                        ],
                      }}
                    />
                  </>
                ) : (
                  <Field label={s.label} required={s.required} htmlFor={key}>
                    <TextArea
                      id={key}
                      rows={s.key === 'course' ? 6 : 3}
                      disabled={locked}
                      value={text[s.key] ?? (accepted ? s.draft : '')}
                      onChange={(e) => setText((t) => ({ ...t, [s.key]: e.target.value }))}
                      placeholder={`Write the ${s.label.toLowerCase()}…`}
                    />
                  </Field>
                )}
              </FieldGroup>
            )
          })}

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
          </FieldGroup>
        </FormGroups>
      </div>

      <ConfirmDialog
        open={confirmSign}
        title="Attest and publish this discharge summary?"
        consequence="Attesting is irreversible. The summary is committed to the legal record with your name and registration number, printed bilingually, published to ABDM, pushed to the patient app and copied to the referring doctor. After this it can only be amended."
        confirmLabel="Attest & publish"
        onConfirm={() => {
          signNote({ encounterId: `${enc.id}:discharge`, by: me.name, registrationNo: me.identifier, canSign: true })
          setConfirmSign(false)
          toast({
            tone: 'success',
            title: 'Discharge summary published',
            detail: `Stamped ${me.name} · ${me.identifier}. ABDM publish queued; the bed is released on the board.`,
          })
        }}
        onCancel={() => setConfirmSign(false)}
      />
    </Screen>
  )
}
