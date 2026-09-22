/**
 * S-13-06 · Death, MCCD & Body Handover — `/encounter/:id/death` · T2 · ARC-03
 *
 * "Death certification, and the handover that follows it."
 *
 * A multi-step wizard, because the statutory order matters: CMP-STAT-03's MCCD
 * records cause of death as a SEQUENCE, not a list, and CMP-STAT-01 means a
 * medico-legal case is intimated to the police and acknowledged BEFORE the body
 * is released.
 *
 * Density is comfortable rather than compact. This is not a screen to make
 * dense.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Chip,
  Field,
  Icon,
  Select,
  Stepper,
  TextArea,
  TextInput,
} from '@/components/primitives'
import { encounter } from '@/data/clinical'
import { formatDate, NOW } from '@/data/format'
import { DIAGNOSES, patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const STEPS = ['Verification', 'Cause of death', 'Medico-legal', 'Handover']

export function S1306({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)

  const enc = encounter(id ?? 'E-118201')
  const p = patient(enc.patientId)

  const [step, setStep] = useState(0)
  const [verifiedAt, setVerifiedAt] = useState('')
  const [immediate, setImmediate] = useState('')
  const [antecedent1, setAntecedent1] = useState('')
  const [antecedent2, setAntecedent2] = useState('')
  const [contributing, setContributing] = useState('')
  const [isMlc, setIsMlc] = useState(p.mlc ?? false)
  const [policeAck, setPoliceAck] = useState(false)
  const [releasedTo, setReleasedTo] = useState('')
  const [confirm, setConfirm] = useState(false)

  const stepValid = [
    verifiedAt.trim().length > 0,
    immediate.trim().length > 0 && antecedent1.trim().length > 0,
    !isMlc || policeAck,
    releasedTo.trim().length > 0,
  ]

  const canComplete = stepValid.every(Boolean)

  return (
    <Screen
      screenId="S-13-06"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF']}
      chips={
        <>
          <Chip tone="caution" icon="FileText">
            MCCD Form 4
          </Chip>
          {isMlc && (
            <Chip tone="isolation" icon="Gavel">
              MLC
            </Chip>
          )}
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why a sequence</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Part I records a causal chain, read downwards: (a) is caused by (b), which is caused by (c). Part II is
              for conditions that contributed without being in that chain. Recorded as a list instead, the certificate
              cannot be coded and the registration is rejected.
            </p>
            <p className="mt-2 text-[0.84em] text-ink-3">CMP-STAT-03 · Form 4 for an institutional death.</p>
          </Card>

          {isMlc && (
            <Card className="border-l-[3px] border-l-isolation p-4">
              <h3 className="text-[0.82em] font-semibold tracking-wide text-isolation uppercase">Medico-legal</h3>
              <p className="mt-1.5 text-[0.9em] text-ink-2">
                Police intimation must be made and <strong>acknowledged</strong> before the body is released. The
                acknowledgement is the gate — sending the intimation is not enough.
              </p>
              <p className="mt-2 text-[0.84em] text-ink-3">CMP-STAT-01 · intimation with acknowledgement.</p>
            </Card>
          )}

          {aiActive && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                <Diamond size={10} />
                AI-810 · completeness
              </p>
              <p className="mt-1.5 text-[0.9em] text-ink-2">
                Checks that the sequence is causally coherent and that the medico-legal steps are present. It flags; it
                never fills the cause of death in for you.
              </p>
            </Card>
          )}
        </div>
      }
      railTitle="Statutory"
      actionBar={
        <>
          {step > 0 && (
            <Button icon="ChevronLeft" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          )}
          <span className="text-[0.88em] text-ink-3">
            Step {step + 1} of {STEPS.length}
          </span>
          {step < STEPS.length - 1 ? (
            <Button
              tone="primary"
              className="ml-auto"
              iconAfter="ChevronRight"
              disabled={!stepValid[step]}
              onClick={() => setStep((s) => s + 1)}
            >
              Continue
            </Button>
          ) : (
            <Button
              tone="primary"
              className="ml-auto"
              icon="Signature"
              disabled={!canComplete}
              onClick={() => setConfirm(true)}
            >
              Certify and release
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <Stepper steps={STEPS} current={step} />

        {step === 0 && (
          <FieldGroup title="Verification of death" hint="Recorded by the clinician who verified it, with the time">
            <Field label="Time of death" required htmlFor="dod-time" hint="24-hour clock, as it was observed">
              <TextInput
                id="dod-time"
                type="datetime-local"
                value={verifiedAt}
                onChange={(e) => setVerifiedAt(e.target.value)}
              />
            </Field>
            <Field label="Verified by" htmlFor="dod-by">
              <TextInput id="dod-by" value={`${me.name} · ${me.identifierKind} ${me.identifier}`} readOnly />
            </Field>
            <Field label="Family informed" htmlFor="dod-family">
              <Select id="dod-family" defaultValue="In person, by the treating team">
                {['In person, by the treating team', 'By telephone', 'Family present at the time', 'Unable to contact'].map(
                  (o) => (
                    <option key={o}>{o}</option>
                  ),
                )}
              </Select>
            </Field>
          </FieldGroup>
        )}

        {step === 1 && (
          <>
            <Alert tone="info" title="Part I is a chain, read downwards">
              Each line is caused by the line below it. If there is no antecedent cause, leave (b) and (c) empty rather
              than repeating (a).
            </Alert>
            <FieldGroup title="Part I · the causal sequence">
              <Field label="(a) Immediate cause" required htmlFor="cod-a">
                <TextInput
                  id="cod-a"
                  list="dx-list"
                  value={immediate}
                  onChange={(e) => setImmediate(e.target.value)}
                  placeholder="The condition directly leading to death"
                />
              </Field>
              <Field label="(b) Due to, or as a consequence of" required htmlFor="cod-b">
                <TextInput
                  id="cod-b"
                  list="dx-list"
                  value={antecedent1}
                  onChange={(e) => setAntecedent1(e.target.value)}
                  placeholder="The antecedent cause"
                />
              </Field>
              <Field label="(c) Due to, or as a consequence of" htmlFor="cod-c">
                <TextInput
                  id="cod-c"
                  list="dx-list"
                  value={antecedent2}
                  onChange={(e) => setAntecedent2(e.target.value)}
                  placeholder="The underlying cause, if there is one"
                />
              </Field>
              <datalist id="dx-list">
                {DIAGNOSES.map((d) => (
                  <option key={d.icd10} value={`${d.label} (${d.icd10})`} />
                ))}
              </datalist>
            </FieldGroup>
            <FieldGroup
              title="Part II · other significant conditions"
              hint="Contributed to death but were not part of the sequence above"
            >
              <Field label="Contributing conditions" htmlFor="cod-ii">
                <TextArea
                  id="cod-ii"
                  rows={3}
                  value={contributing}
                  onChange={(e) => setContributing(e.target.value)}
                  placeholder="Type 2 diabetes, chronic kidney disease…"
                />
              </Field>
            </FieldGroup>
            {aiActive && immediate && antecedent1 && (
              <Card className="border-l-[3px] border-l-ai p-4">
                <p className="flex items-center gap-2 text-[0.88em] font-semibold text-ai">
                  <Diamond size={10} />
                  AI-810 · the sequence reads coherently
                </p>
                <p className="mt-1.5 text-[0.92em] text-ink-2">
                  &ldquo;{immediate}&rdquo; caused by &ldquo;{antecedent1}&rdquo;
                  {antecedent2 && ` caused by "${antecedent2}"`} is a recognised causal chain. Both lines will code.
                </p>
              </Card>
            )}
          </>
        )}

        {step === 2 && (
          <FieldGroup title="Medico-legal status">
            <Checkbox
              checked={isMlc}
              onChange={setIsMlc}
              label={
                <>
                  This is a medico-legal case
                  <span className="block text-[0.88em] text-ink-3">
                    Unnatural death, injury, poisoning, custody, or a death within 24 hours of admission without a
                    clear cause.
                  </span>
                </>
              }
            />
            {isMlc && (
              <>
                <Alert tone="caution" title="Police intimation is required, and must be acknowledged">
                  The body is not released until the acknowledgement is recorded. Sending the intimation is not the
                  gate; receiving the acknowledgement is.
                </Alert>
                <Field label="Police station and docket" required htmlFor="mlc-station">
                  <TextInput id="mlc-station" placeholder="Whitefield PS · docket number" />
                </Field>
                <Checkbox
                  checked={policeAck}
                  onChange={setPoliceAck}
                  label={
                    <>
                      Acknowledgement received and filed
                      <span className="block text-[0.88em] text-ink-3">
                        Records who acknowledged it and when. This unblocks the handover step.
                      </span>
                    </>
                  }
                />
              </>
            )}
            {!isMlc && (
              <p className="flex items-start gap-2 rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.9em] text-ink-2">
                <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                A natural death with a clear cause proceeds to handover directly. If in doubt, mark it medico-legal —
                it is reversible before certification and not afterwards.
              </p>
            )}
          </FieldGroup>
        )}

        {step === 3 && (
          <FieldGroup title="Body handover" hint="Who is receiving, and their relationship to the deceased">
            <Field label="Released to" required htmlFor="handover-to">
              <TextInput
                id="handover-to"
                value={releasedTo}
                onChange={(e) => setReleasedTo(e.target.value)}
                placeholder="Name and relationship"
              />
            </Field>
            <Field label="Identification produced" htmlFor="handover-id">
              <Select id="handover-id" defaultValue="Aadhaar">
                {['Aadhaar', 'Voter ID', 'Driving licence', 'Passport', 'None — witnessed by two staff'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Belongings returned" htmlFor="handover-belongings">
              <TextArea id="handover-belongings" rows={2} placeholder="Itemised, and countersigned by the receiver" />
            </Field>
            {isMlc && !policeAck && (
              <Alert tone="abnormal" role="alert" title="Handover is blocked">
                This is a medico-legal case and the police acknowledgement has not been recorded. Go back to the
                medico-legal step.
              </Alert>
            )}
          </FieldGroup>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        title="Certify the cause of death and release the body?"
        consequence={`This issues the MCCD under your name and ${me.identifierKind} ${me.identifier}, registers the death with the civil registration system, and records the handover. It cannot be undone — a correction is a formal amendment to the certificate.`}
        confirmLabel="Certify and release"
        onConfirm={() => {
          setConfirm(false)
          toast({
            tone: 'success',
            title: 'MCCD issued',
            detail: `Form 4 certified by ${me.name} on ${formatDate(NOW)}. Registration queued; handover recorded.`,
          })
          navigate('/ip/patients')
        }}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  )
}
