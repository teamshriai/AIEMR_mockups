/**
 * S-06-13 · Test results — `/patient/:id/results` · T2 · ARC-01
 *
 * "One patient's results, grouped by test, with the trend beside each."
 *
 * The results inbox is organised around the doctor's day; this is organised
 * around one patient's body. So a test appears once, with its latest value,
 * its flag in words, the reference range, and — where there is a series — the
 * shape of the trend. Each row opens the full result with its narrative.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { CountPill, PillTabs, SectionCard } from '@/components/calm'
import { Sparkline } from '@/components/charts'
import { Chip, ClinicalFlag, EmptyState, Icon, StatTile } from '@/components/primitives'
import { RESULT_TRENDS, resultsFor } from '@/data/clinical'
import type { ResultRow } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'

import { RecordScreen } from './shared'

type Filter = 'all' | 'abnormal' | 'review'

export function S0613({ id }: { id?: string }) {
  return (
    <RecordScreen id={id} section="results">
      {(p) => <Results patient={p} />}
    </RecordScreen>
  )
}

function Results({ patient: p }: { patient: Patient }) {
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const [filter, setFilter] = useState<Filter>('all')
  const all = resultsFor(p.id)
  const isReviewed = (r: ResultRow) => r.acknowledged || Boolean(acknowledgements[r.id])
  const abnormal = all.filter((r) => r.flag !== 'Normal')
  const review = all.filter((r) => !isReviewed(r))
  const critical = all.filter((r) => r.critical)
  const shown = filter === 'abnormal' ? abnormal : filter === 'review' ? review : all

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Results on file" value={all.length} sub={all[0] ? `latest ${formatDate(all[0].reportedAt)}` : 'none yet'} />
        <StatTile
          label="Outside range"
          value={abnormal.length}
          tone={critical.length > 0 ? 'critical' : abnormal.length > 0 ? 'abnormal' : 'normal'}
          sub={critical.length > 0 ? `${critical.length} critical` : abnormal.length > 0 ? 'high or low' : 'all within range'}
        />
        <StatTile
          label="To review"
          value={review.length}
          tone={review.length > 0 ? 'caution' : 'normal'}
          sub={review.length > 0 ? 'not yet acknowledged' : 'everything reviewed'}
        />
      </div>

      <SectionCard
        title="Test results"
        meta={<CountPill>{all.length}</CountPill>}
        action={
          <PillTabs
            ariaLabel="Which results"
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: 'All', count: all.length },
              { key: 'abnormal', label: 'Outside range', count: abnormal.length },
              { key: 'review', label: 'To review', count: review.length },
            ]}
          />
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            icon="FlaskConical"
            why={
              all.length === 0
                ? `No results are on ${p.name}’s record yet. A sample sent from any order would appear here once reported.`
                : 'Nothing in this group. Choose All to see every result.'
            }
          />
        ) : (
          <ul className="divide-y divide-glass-hairline">
            {shown.map((r) => (
              <ResultLine key={r.id} r={r} reviewed={isReviewed(r)} />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  )
}

function ResultLine({ r, reviewed }: { r: ResultRow; reviewed: boolean }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const series = RESULT_TRENDS[r.id] ?? []

  return (
    <li>
      <button
        type="button"
        onClick={() => navigate(`/results/${r.id}`)}
        className="grid w-full gap-x-4 gap-y-1.5 rounded-panel px-2 py-3 text-left transition-colors duration-150 hover:bg-glass-fill-hover sm:grid-cols-[minmax(0,1fr)_auto] sm:px-3"
      >
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{r.test}</span>
            <ClinicalFlag flag={r.flag} />
            {!reviewed && <Chip tone="caution">To review</Chip>}
          </span>
          <span className="tabular mt-1 block text-[0.88em] text-ink-3">
            {formatDate(r.reportedAt)} {formatTime(r.reportedAt)} · range {r.refRange}
            {r.unit ? ` ${r.unit}` : ''}
            {r.priorValue && ` · before ${r.priorValue}`}
            {r.delta && ` (${r.delta})`}
          </span>
          {aiActive && (
            <span className="mt-1 flex items-start gap-1.5 text-[0.88em] text-ink-2">
              <Diamond size={9} className="mt-1.5" />
              {r.aiReason}
            </span>
          )}
        </span>
        <span className="flex items-center gap-3 sm:justify-end">
          {series.length > 1 ? (
            <Sparkline points={series.map((s) => ({ at: s.at, value: s.value }))} unit={r.unit} label={r.test} />
          ) : (
            <span className="tabular text-lg font-bold">
              {r.value}
              {r.unit && <span className="ml-1 text-[0.7em] font-normal text-ink-3">{r.unit}</span>}
            </span>
          )}
          <Icon name="ChevronRight" size={15} className="text-ink-3" />
        </span>
      </button>
    </li>
  )
}
