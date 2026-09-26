/**
 * Admit — one button, one small modal, one confirmation.
 *
 * The doctor chooses where (Ward or ICU), how soon (a priority, which must be
 * picked — a critical patient is never filed as Routine by default), and may
 * add a line. That is all the doctor is asked. No bed, no payer, no forms:
 * the front desk and bed allocation take it from there, and the patient's
 * chip says where it has got to.
 */

import { useCallback, useState } from 'react'

import { createAdmission } from '@/api/admissions'
import { Modal } from '@/components/overlays'
import { Button, Chip, cx } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { PRIORITY_LABEL, PRIORITY_TONE, TYPE_LABEL, canAdmit, stageLabel } from '@/data/admissions'
import type { Admission, AdmissionPriority, AdmissionType } from '@/data/admissions'
import { ageSex } from '@/data/format'
import type { Patient } from '@/data/kit'
import { useAdmissions } from '@/store/admissions'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'

/** The one Admit action. Absent for a patient who is already in, or on the way into, a bed. */
export function AdmitButton({
  patient: p,
  encounterId,
  tone = 'secondary',
}: {
  patient: Patient
  encounterId?: string
  tone?: 'secondary' | 'tertiary'
}) {
  const admissions = useAdmissions((s) => s.admissions)
  const [open, setOpen] = useState(false)
  // Stable, because the modal's focus trap re-runs whenever its close handler changes.
  const close = useCallback(() => setOpen(false), [])

  if (!open && !canAdmit(p, admissions)) return null
  return (
    <>
      <Button tone={tone} icon="BedDouble" onClick={() => setOpen(true)}>
        Admit
      </Button>
      {open && <AdmitModal patient={p} encounterId={encounterId} onClose={close} />}
    </>
  )
}

function AdmitModal({ patient: p, encounterId, onClose }: { patient: Patient; encounterId?: string; onClose: () => void }) {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const [type, setType] = useState<AdmissionType>('ward')
  const [priority, setPriority] = useState<AdmissionPriority | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  async function confirm() {
    if (!priority || sending) return
    setSending(true)
    try {
      await createAdmission({
        patientId: p.id,
        encounterId,
        type,
        priority,
        note,
        requestedBy: { id: me.id, name: me.name },
      })
      toast({
        tone: 'info',
        title: `Admission in progress — ${p.name}`,
        detail: `${TYPE_LABEL[type]} · ${PRIORITY_LABEL[priority]}`,
      })
      onClose()
    } catch {
      setSending(false)
      toast({ tone: 'critical', title: 'The admission did not go through', detail: 'Nothing was sent. Try Confirm again.' })
    }
  }

  return (
    <Modal
      open
      size="sm"
      title={`Admit ${p.name}`}
      subtitle={
        <span className="tabular">
          {p.uhid} · {ageSex(p.age, p.sex)}
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" icon="Check" disabled={!priority || sending} onClick={confirm}>
            Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Choice
          label="Type"
          value={type}
          options={[
            { key: 'ward', label: TYPE_LABEL.ward },
            { key: 'icu', label: TYPE_LABEL.icu },
          ]}
          onChange={setType}
        />
        <Choice
          label="Priority"
          value={priority}
          options={[
            { key: 'critical', label: PRIORITY_LABEL.critical },
            { key: 'urgent', label: PRIORITY_LABEL.urgent },
            { key: 'routine', label: PRIORITY_LABEL.routine },
          ]}
          onChange={setPriority}
        />
        <VoiceField
          id={`admit-note-${p.id}`}
          label="Note (optional)"
          value={note}
          onChange={setNote}
          patientId={p.id}
          rows={2}
          tidy={false}
          placeholder="Reason for admission, in a line — or press the microphone…"
        />
      </div>
    </Modal>
  )
}

/** A single choice, as pills — the same shape as the list filters, with radio semantics. */
function Choice<K extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: K | null
  options: { key: K; label: string }[]
  onChange: (key: K) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">{label}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-pill bg-glass-inset p-1">
        {options.map((o) => {
          const active = o.key === value
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.key)}
              className={cx(
                'inline-flex min-h-10 items-center rounded-pill px-4 text-[0.92em] font-semibold transition-colors duration-150 ease-out-clinical',
                active ? 'bg-brand text-brand-on shadow-glass' : 'text-ink-3 hover:bg-glass-fill-hover hover:text-ink',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Where this patient's admission has got to — on the patient banner, so every
 * screen that shows the patient shows it. Nothing for a patient with no
 * admission ordered here.
 */
export function AdmissionChip({ patientId }: { patientId: string }) {
  const admission = useAdmissions((s) => s.admissions[patientId])
  if (!admission) return null
  return admission.admittedAt !== undefined ? (
    <Chip tone="normal" icon="BedDouble">
      {stageLabel(admission)}
    </Chip>
  ) : (
    <Chip tone="caution" icon="Hourglass">
      Admission in progress · {admission.bed ? `bed ${admission.bed}` : 'waiting for bed'}
    </Chip>
  )
}

/** The priority the doctor gave, in the queue's rows. */
export function PriorityChip({ priority }: { priority: AdmissionPriority }) {
  return <Chip tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Chip>
}

/** An in-progress admission's step, in the queue's rows. */
export function StageChip({ admission }: { admission: Admission }) {
  return admission.bed ? (
    <Chip tone="brand" icon="BedDouble">
      {stageLabel(admission)}
    </Chip>
  ) : (
    <Chip tone="caution" icon="Hourglass">
      {stageLabel(admission)}
    </Chip>
  )
}
