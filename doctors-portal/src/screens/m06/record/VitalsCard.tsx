/**
 * The latest vitals, first thing on the record: each measure, its value and —
 * only where it is out of range — the flag, with the time they were charted.
 * Nothing else: the AI's reading lives in the AI insights card, results in
 * their own card with the ring, the scan in its viewer. No row is a button.
 */

import { SectionCard } from '@/components/calm'
import { ClinicalFlag } from '@/components/primitives'
import { VITALS } from '@/data/clinical'
import { formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'

export function VitalsCard({ patient: p }: { patient: Patient }) {
  const vitals = (VITALS[p.id] ?? []).slice(0, 5)

  return (
    <SectionCard
      title="Vitals"
      tone="patient"
      meta={vitals[0] && <span className="tabular text-[0.86em] text-ink-3">charted {formatTime(vitals[0].at)}</span>}
      bodyClassName="px-4 pb-3 sm:px-5 sm:pb-4"
    >
      {vitals.length === 0 ? (
        <p className="text-[0.92em] text-ink-2">No observations charted.</p>
      ) : (
        <dl className="divide-y divide-glass-hairline">
          {vitals.map((v) => (
            <div key={v.label} className="flex min-h-9 items-center justify-between gap-3 py-1">
              <dt className="truncate text-[0.92em] text-ink-2">{v.label}</dt>
              <dd className="flex shrink-0 items-center gap-1.5">
                <span className="tabular text-[0.95em] font-medium">{v.value}</span>
                {v.flag !== 'Normal' && <ClinicalFlag flag={v.flag} />}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  )
}
