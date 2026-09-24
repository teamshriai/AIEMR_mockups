/**
 * S-15-06 · Critical Finding Escalation — modal · T2 · ARC-16
 *
 * "A critical imaging finding reaching a named clinician."
 *
 * The same principle as the critical lab value, and for the same reason: a
 * finding left in a report queue has not been communicated. AI-407's fallback
 * is "radiologist-initiated escalation call", which is exactly what this
 * records — the call still happens, the record just stops depending on someone
 * remembering it did.
 */

import { useState } from 'react'

import { Why } from '@/components/calm'
import { Modal } from '@/components/overlays'
import { Button, Checkbox, Icon, KeyValue, Select, TextArea } from '@/components/primitives'
import { formatTime, NOW } from '@/data/format'
import { STAFF, patient } from '@/data/kit'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'

export function S1506({
  open,
  finding,
  studyId,
  onClose,
}: {
  open: boolean
  finding: string
  studyId: string
  onClose: () => void
}) {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)

  const [recipient, setRecipient] = useState('Dr Ananya Iyer')
  const [channel, setChannel] = useState('Telephone, spoken to directly')
  const [detail, setDetail] = useState('')
  const [attested, setAttested] = useState(false)

  const p = patient('SD-P-03')
  const ready = attested && detail.trim().length >= 10

  return (
    <Modal
      open={open}
      alert
      size="md"
      title={
        <span className="flex items-center gap-2 text-caution">
          <Icon name="TriangleAlert" size={20} />
          Escalate a critical finding
        </span>
      }
      subtitle="A finding left in a report queue has not been communicated"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            tone="primary"
            icon="PhoneCall"
            disabled={!ready}
            onClick={() => {
              onClose()
              setAttested(false)
              setDetail('')
              toast({
                tone: 'success',
                title: `Escalated to ${recipient}`,
                detail: `${channel} at ${formatTime(NOW)}. Recorded against study ${studyId} and the patient record.`,
              })
            }}
          >
            Record the escalation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-panel border border-caution/40 bg-caution-soft px-4 py-3">
          <p className="font-semibold text-caution">{finding}</p>
          <p className="tabular mt-1 text-[0.92em] text-ink-2">
            {p.name} · {p.age}/{p.sex} · {p.bed} · study {studyId}
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">
            Who you told <span className="text-abnormal">*</span>
          </p>
          <Select value={recipient} onChange={(e) => setRecipient(e.target.value)} aria-label="Recipient">
            {STAFF.filter((s) => s.identifierKind === 'HPR' && s.name !== me.name).map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} · {s.personaLabel}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">How</p>
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
            {[
              'Telephone, spoken to directly',
              'Telephone, left a message with a named person',
              'In person',
              'Unable to reach — escalated to the on-call',
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
        </div>

        <div>
          <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">
            What you said <span className="text-abnormal">*</span>
          </p>
          <TextArea
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="New small right pleural effusion with extension of the consolidation. Suggested a repeat film in 24h and consideration of drainage if it enlarges…"
          />
        </div>

        <dl className="divide-y divide-glass-hairline">
          <KeyValue label="Escalated by">
            {me.name} · {me.identifierKind} {me.identifier}
          </KeyValue>
          <KeyValue label="At">
            <span className="tabular">{formatTime(NOW)}</span>
          </KeyValue>
        </dl>

        <Checkbox
          checked={attested}
          onChange={setAttested}
          label={
            <>
              I have communicated this finding to the named clinician.
              <span className="block text-[0.88em] text-ink-3">
                Fixed wording. It is stamped with your name and the time, and it is what an audit reads.
              </span>
            </>
          }
        />

        <Why label="Why this modal exists">
          <p className="text-ink-2">
            AI-407 flagged this finding. The escalation is yours — the model cannot make a phone call. Who you told
            must be a named person, not a ward or a pool; if they cannot be reached, escalate to the on-call and
            record that too.
          </p>
          <p className="text-[0.92em] text-ink-3">
            G2 gate. The report still has to be written — this records that somebody was told before it was.
          </p>
        </Why>
      </div>
    </Modal>
  )
}
