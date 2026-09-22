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
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { Modal } from '@/components/overlays'
import { Button, Checkbox, Chip, ClinicalFlag, Icon, KeyValue, TextArea } from '@/components/primitives'
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

        <div className="rounded-panel bg-glass-fill-muted px-4 py-3">
          <p className="flex items-center gap-2 text-[0.88em] font-semibold text-ink-2">
            <Diamond size={10} />
            AI-213 · why this fired
          </p>
          <p className="mt-1 text-[0.92em] text-ink-2">{result.aiReason}</p>
          <p className="mt-2 text-[0.86em] text-ink-3">
            The threshold is rule-based and never fully off. The model ranks and explains; it does not decide what
            counts as critical.
          </p>
        </div>

        <Checkbox
          checked={attested}
          onChange={setAttested}
          label={
            <>
              I have seen this result. <span className="text-ink-3">Fixed wording — it is not editable.</span>
            </>
          }
        />

        <div>
          <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">
            What you are doing about it <span className="text-ink-3">(optional here, required in the record)</span>
          </p>
          <TextArea
            rows={2}
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="Calcium gluconate and insulin-dextrose given, ECG requested, repeat in 1 hour…"
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-[0.86em] text-ink-3">
            <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
            Acknowledging records that you saw it. What you did about it belongs in an addendum or a new note —
            &ldquo;Acknowledge and document&rdquo; takes you straight there.
          </p>
        </div>

        <p className="flex flex-wrap items-center gap-2">
          <Chip tone="critical" icon="OctagonAlert">
            G2 gate
          </Chip>
          <span className="text-[0.86em] text-ink-3">
            This dialog cannot be dismissed without a disposition. Reassigning is a disposition; closing it is not.
          </span>
        </p>
      </div>
    </Modal>
  )
}
