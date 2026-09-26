/**
 * How this patient's results fall, at a glance — the one pie on the record.
 *
 * It answers "is anything out of range, and how much of it?" before a doctor
 * reads a single value: a small ring of Normal / Out of range / Critical with
 * the total in the middle, a legend that says each count in words, and then
 * the out-of-range tests themselves, each one tap from its detail. Everything
 * else is on the Results tab.
 */

import { Link } from 'react-router-dom'

import { CountPill, PillLink, SectionCard } from '@/components/calm'
import { Donut } from '@/components/charts'
import type { DonutSlice } from '@/components/charts'
import { ClinicalFlag, Icon } from '@/components/primitives'
import { resultsFor } from '@/data/clinical'
import type { Patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'

import { recordPath } from './shared'

export function ResultsCard({ patient: p, className }: { patient: Patient; className?: string }) {
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const results = resultsFor(p.id)
  if (results.length === 0) return null

  const critical = results.filter((r) => r.flag.includes('Critical')).length
  const normal = results.filter((r) => r.flag === 'Normal').length
  const outOfRange = results.length - normal - critical
  const toReview = results.filter((r) => !r.acknowledged && acknowledgements[r.id] === undefined).length
  // Three at most, so the card stays on the first screen; the rest are one tap away in Results.
  const flagged = results.filter((r) => r.flag !== 'Normal').slice(0, 3)

  const slices: DonutSlice[] = [
    { key: 'normal', label: 'Normal', value: normal, color: 'var(--color-viz-normal)' },
    { key: 'out', label: 'Out of range', value: outOfRange, color: 'var(--color-viz-abnormal)' },
    { key: 'critical', label: 'Critical', value: critical, color: 'var(--color-viz-critical)' },
  ]

  return (
    <SectionCard
      tone="investigations"
      title="Test results"
      className={className}
      meta={toReview > 0 && <CountPill tone="pending">{toReview} to review</CountPill>}
      action={<PillLink to={recordPath(p, 'results')}>See all</PillLink>}
      bodyClassName="px-3 pb-3 sm:px-4 sm:pb-4"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Donut
          slices={slices}
          label={`${results.length} results: ${slices.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}`}
          center={
            <span>
              <span className="tabular block text-xl leading-none font-bold">{results.length}</span>
              <span className="mt-0.5 block text-[0.72em] text-ink-3">results</span>
            </span>
          }
        />
        <ul className="min-w-[9rem] flex-1 space-y-1.5">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2.5 text-[0.92em]">
              <span aria-hidden className="size-2.5 shrink-0 rounded-pill" style={{ background: s.color }} />
              <span className="flex-1 text-ink-2">{s.label}</span>
              <span className="tabular font-semibold">{s.value}</span>
            </li>
          ))}
        </ul>
      </div>

      {flagged.length > 0 && (
        <ul className="mt-3 divide-y divide-glass-hairline border-t border-glass-hairline pt-1">
          {flagged.map((r) => (
            <li key={r.id}>
              <Link
                to={`/results/${r.id}`}
                className="flex min-h-11 items-center gap-3 rounded-panel px-1.5 py-1.5 transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover"
              >
                <span className="min-w-0 flex-1 truncate text-[0.92em] text-ink-2">{r.test}</span>
                <span className="tabular shrink-0 text-[0.92em] font-medium">
                  {r.value}
                  {r.unit && ` ${r.unit}`}
                </span>
                <ClinicalFlag flag={r.flag} />
                <Icon name="ChevronRight" size={14} className="shrink-0 text-ink-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
