/**
 * The one trend on the record: the lab value that matters most for this
 * patient, over time, against its reference range.
 *
 * "Matters most" is decided in the open, in this order: a result still waiting
 * for review, then one out of range, then the newest. Where a patient has more
 * than one series (up to three), a pill switches between them — the same
 * chart, never a second one. A patient with no repeated result has no trend,
 * and the card is not drawn at all rather than drawn empty.
 */

import { useState } from 'react'

import { PillLink, PillTabs, SectionCard } from '@/components/calm'
import { TrendChart } from '@/components/charts'
import { RESULT_TRENDS, resultsFor, trendPointsFor } from '@/data/clinical'
import type { ResultRow } from '@/data/clinical'
import { formatDate } from '@/data/format'
import type { Patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'

export function TrendCard({ patient: p, className }: { patient: Patient; className?: string }) {
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const [chosen, setChosen] = useState<string | null>(null)

  const toReview = (r: ResultRow) => !r.acknowledged && acknowledgements[r.id] === undefined
  // `resultsFor` is newest first, and the sort is stable, so newest breaks every tie.
  const series = resultsFor(p.id)
    .filter((r) => (RESULT_TRENDS[r.id]?.length ?? 0) > 1)
    .sort((a, b) => Number(toReview(b)) - Number(toReview(a)) || Number(b.flag !== 'Normal') - Number(a.flag !== 'Normal'))
    .slice(0, 3)
  if (series.length === 0) return null

  const r = series.find((x) => x.id === chosen) ?? series[0]
  const points = trendPointsFor(r)
  // Over a year or more, the axis names the month and year; otherwise the day.
  const long = points.length > 1 && points[points.length - 1].at.getTime() - points[0].at.getTime() > 300 * 86_400_000

  return (
    <SectionCard
      tone="investigations"
      title="Trend"
      className={className}
      action={<PillLink to={`/results/${r.id}`}>Open result</PillLink>}
      bodyClassName="px-3 pb-3 sm:px-4 sm:pb-4"
    >
      {series.length > 1 && (
        <PillTabs
          ariaLabel="Which result to trend"
          value={r.id}
          className="mb-3"
          options={series.map((x) => ({ key: x.id, label: x.test }))}
          onChange={setChosen}
        />
      )}
      <TrendChart
        title={r.test}
        unit={r.unit}
        points={points}
        refLow={r.refLow}
        refHigh={r.refHigh}
        height={180}
        label={(d) => (long ? formatDate(d).slice(3) : formatDate(d).replace(/-\d{4}$/, ''))}
      />
    </SectionCard>
  )
}
