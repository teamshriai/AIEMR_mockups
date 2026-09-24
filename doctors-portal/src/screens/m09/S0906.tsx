/**
 * S-09-06 · Critical Result Acknowledgement — modal · T2 · ARC-16
 *
 * "A critical value reaching a named human who must answer for it."
 *
 * W-06-3 step 2!: "Interrupts a NAMED clinician who must acknowledge; escalates
 * if unacknowledged in the window."
 *
 * The distinction the screen has to make, because it is the one clinicians get
 * wrong: acknowledging records that you SAW it. Acting on it is documented
 * separately. So the modal offers both, and does not pretend the first is the
 * second.
 *
 * Calm pass: everything that gates is untouched — undismissable, the value, the
 * escalation clock, the fixed attestation, the three dispositions. Only the
 * prose moved: why the alert fired and why it cannot be dismissed are one `Why`,
 * and acknowledge-versus-act is said once, on the field it governs.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { Why } from '@/components/calm'
import { Modal } from '@/components/overlays'
import { Button, Checkbox, ClinicalFlag, Icon, KeyValue } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import type { ResultRow } from '@/data/clinical'
import { encounterForPatient } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'

export function S0906({ result, onClose }: { result: ResultRow | null; onClose: () => void }) {
  const me = useCurrentStaff()
  const navigate = useNavigate()
  const acknowledge = useClinical((s) => s.acknowledge)
  const toast = useUI((s) => s.toast)

  const [attested, setAttested] = useState(false)
  const [action, setAction] = useState('')

  if (!result) return null

  const p = patient(result.patientId)
  const enc = encounterForPatient(p.id)

  function confirm(thenDocument: boolean) {
    acknowledge(result!.id, me.name, action.trim() || undefined)
    onClose()
    setAttested(false)
    setAction('')
    toast({
      tone: 'success',
      title: 'Acknowledged',
      detail: `${me.name} at ${formatTime(NOW)}. Escalation stopped. ${
        thenDocument ? 'Now document what you did.' : 'Acting on it is still to be documented.'
      }`,
    })
    if (thenDocument && enc) {
      navigate(enc.type === 'IP' ? `/ip/encounter/${enc.id}/note` : `/encounter/${enc.id}/note`)
    }
  }

  return (
    <Modal
      open
      alert
      /* AIP-09: a gate is not dismissible without a disposition. Acknowledging
         IS the disposition, so there is no close button and no backdrop exit. */
      dismissible={false}
      size="md"
      title={
        <span className="flex items-center gap-2 text-critical">
          <Icon name="TriangleAlert" size={20} />
          Critical result
        </span>
      }
      subtitle={`Addressed to you by name · unacknowledged ${result.unackMinutes ?? 0} minutes`}
      footer={
        <>
          <Button
            onClick={() => {
              onClose()
              setAttested(false)
            }}
          >
            Not me — reassign
          </Button>
          <Button disabled={!attested} icon="Check" onClick={() => confirm(false)}>
            Acknowledge only
          </Button>
          <Button tone="primary" disabled={!attested} icon="PenLine" onClick={() => confirm(true)}>
            Acknowledge and document
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-panel border border-critical/40 bg-critical-soft px-4 py-3.5">
          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold">{result.test}</span>
            <span className="tabular text-2xl font-bold text-critical">
              {result.value} {result.unit}
            </span>
            <ClinicalFlag flag={result.flag} />
          </p>
          <p className="tabular mt-1 text-[0.92em] text-ink-2">
            Reference {result.refRange}
            {result.priorValue && ` · prior ${result.priorValue} · ${result.delta}`}
          </p>
        </div>

        <dl className="divide-y divide-glass-hairline">
          <KeyValue label="Patient">
            {p.name} · {p.age}/{p.sex} · {p.bed}
          </KeyValue>
          <KeyValue label="UHID">{p.uhid}</KeyValue>
          <KeyValue label="Reported">{formatDateTime(result.reportedAt)}</KeyValue>
          <KeyValue label="Addressed to">{me.name}</KeyValue>
          <KeyValue label="Escalates at">
            <span className="font-semibold text-critical">15 minutes · to the on-call consultant</span>
          </KeyValue>
        </dl>

        <Checkbox
          checked={attested}
          onChange={setAttested}
          label={
            <>
              I have seen this result. <span className="text-ink-3">Fixed wording — it is not editable.</span>
            </>
          }
        />

        <VoiceField
          id={`critical-action-${result.id}`}
          label="What you are doing about it"
          rows={2}
          value={action}
          onChange={setAction}
          patientId={p.id}
          placeholder="Calcium gluconate and insulin-dextrose given, ECG requested, repeat in 1 hour…"
          hint="Optional here, required in the record — acknowledging records only that you saw it."
        />

        <Why label="Why this fired, and why it cannot be dismissed">
          <p className="flex flex-wrap items-center gap-2 text-ink-2">
            <Diamond size={10} />
            {result.aiReason}
          </p>
          <p className="text-ink-2">
            The threshold is rule-based and never fully off. The model ranks and explains; it does not decide what
            counts as critical.
          </p>
          <p className="text-[0.92em] text-ink-3">
            AI-213 · G2 gate. This dialog cannot be dismissed without a disposition — reassigning is a disposition,
            closing it is not.
          </p>
        </Why>
      </div>
    </Modal>
  )
}
