/**
 * S-06-16 · Prescriptions — `/patient/:id/prescriptions` · T2 · ARC-02
 *
 * "What the patient takes now, and every prescription before it."
 *
 * "Taking now" is one list across every prescription on the record, because
 * that is the question at a follow-up. The history below keeps each
 * prescription as it was written — a stopped drug stays visible with the
 * reason it stopped, which is what stops it being restarted by mistake.
 */

import { useNavigate } from 'react-router-dom'

import { CountPill, SectionCard } from '@/components/calm'
import { Button, Chip, EmptyState, Icon, cx } from '@/components/primitives'
import { encounterForPatient } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { activeMedicines, prescriptionsFor } from '@/data/record'
import type { RxItem } from '@/data/record'
import { useClinical } from '@/store/clinical'

import { RecordScreen } from './shared'

const STATUS_TONE: Record<RxItem['status'], 'normal' | 'inactive' | 'neutral'> = {
  Active: 'normal',
  Stopped: 'inactive',
  Completed: 'neutral',
}

export function S0616({ id }: { id?: string }) {
  const navigate = useNavigate()
  return (
    <RecordScreen
      id={id}
      section="prescriptions"
      actions={(p) => {
        const enc = encounterForPatient(p.id)
        return (
          enc && (
            <Button tone="primary" icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/rx`)}>
              Write prescription
            </Button>
          )
        )
      }}
    >
      {(p) => <Prescriptions patient={p} />}
    </RecordScreen>
  )
}

function Prescriptions({ patient: p }: { patient: Patient }) {
  const rxStore = useClinical((s) => s.prescriptions)
  const enc = encounterForPatient(p.id)
  const today = enc ? rxStore[enc.id] : undefined
  const active = activeMedicines(p.id)
  const history = prescriptionsFor(p.id)

  return (
    <>
      {today?.status === 'signed' && (
        <p className="flex items-center gap-2 rounded-panel bg-normal-soft px-4 py-3 text-[0.95em] font-medium text-normal">
          <Icon name="Signature" size={15} />
          Today’s prescription was signed{today.signedAt ? ` at ${formatTime(today.signedAt)}` : ''}
          {today.signedBy ? ` by ${today.signedBy}` : ''}.
        </p>
      )}

      <SectionCard title="Taking now" meta={<CountPill tone={active.length > 0 ? 'brand' : 'neutral'}>{active.length}</CountPill>}>
        {active.length === 0 ? (
          <EmptyState icon="Pill" why={`Nothing is currently prescribed for ${p.name}.`} />
        ) : (
          <ul className="divide-y divide-glass-hairline">
            {active.map((m) => (
              <li key={`${m.drug}-${m.since.toISOString()}`} className="flex flex-wrap items-start justify-between gap-2 px-2 py-2.5 sm:px-3">
                <span className="min-w-0">
                  <span className="font-semibold">
                    {m.drug} <span className="font-normal">{m.dose}</span>
                  </span>
                  <span className="block text-[0.9em] text-ink-2">
                    {m.route} · {m.frequency} · {m.duration}
                  </span>
                  {m.note && <span className="block text-[0.86em] text-ink-3">{m.note}</span>}
                </span>
                <span className="tabular text-[0.86em] text-ink-3">
                  since {formatDate(m.since)} · {m.by}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Prescription history" meta={<CountPill>{history.length}</CountPill>}>
        {history.length === 0 ? (
          <EmptyState icon="History" why="No earlier prescriptions are on the record." />
        ) : (
          <ol className="space-y-3 px-2 pb-1 sm:px-3">
            {history.map((r) => (
              <li key={r.id} className="rounded-panel border border-glass-hairline bg-glass-inset px-3.5 py-3">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.context}</span>
                  <span className="tabular text-[0.86em] text-ink-3">
                    {formatDate(r.at)} {formatTime(r.at)} · {r.by}
                  </span>
                </p>
                <ul className="mt-2 space-y-1.5">
                  {r.items.map((i) => (
                    <li key={i.drug} className="flex flex-wrap items-start justify-between gap-2 text-[0.92em]">
                      <span className={cx('min-w-0', i.status === 'Stopped' && 'text-ink-3')}>
                        <span className={cx('font-medium', i.status === 'Stopped' && 'line-through decoration-ink-muted')}>
                          {i.drug}
                        </span>{' '}
                        {i.dose !== '—' && `${i.dose} · ${i.route} · ${i.frequency}`}
                        {i.note && <span className="block text-[0.92em] text-ink-3">{i.note}</span>}
                      </span>
                      <Chip tone={STATUS_TONE[i.status]}>{i.status}</Chip>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </>
  )
}
