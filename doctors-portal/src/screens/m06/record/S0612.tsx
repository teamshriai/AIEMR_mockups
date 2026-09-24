/**
 * S-06-12 · Previous reports — `/patient/:id/reports` · T2 · ARC-10
 *
 * "Every report on the record — imaging, discharge summaries, operative
 * notes, ECGs."
 *
 * Each report is one line until opened: what it was, when, who signed it, and
 * the impression. The body is one tap away. An imaging report with real
 * pixels behind it opens the viewer; one without says so, rather than
 * pretending with somebody else's scan.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CountPill, PillTabs, SectionCard } from '@/components/calm'
import { Button, Chip, EmptyState, Icon, cx } from '@/components/primitives'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { reportsFor } from '@/data/record'
import type { RecordReport } from '@/data/record'

import { RecordScreen } from './shared'

type Filter = 'all' | 'imaging' | 'documents'

const KIND_ICON: Record<RecordReport['kind'], string> = {
  Imaging: 'Scan',
  'Discharge summary': 'DoorOpen',
  'Operative note': 'Syringe',
  ECG: 'HeartPulse',
  Echocardiogram: 'HeartPulse',
  Ultrasound: 'Radio',
  'Medico-legal': 'Gavel',
}

export function S0612({ id }: { id?: string }) {
  return (
    <RecordScreen id={id} section="reports">
      {(p) => <Reports patient={p} />}
    </RecordScreen>
  )
}

function Reports({ patient: p }: { patient: Patient }) {
  const [filter, setFilter] = useState<Filter>('all')
  const all = reportsFor(p.id)
  const imaging = all.filter((r) => r.kind === 'Imaging')
  const docs = all.filter((r) => r.kind !== 'Imaging')
  const shown = filter === 'imaging' ? imaging : filter === 'documents' ? docs : all

  return (
    <SectionCard
      title="Previous reports"
      meta={<CountPill>{all.length}</CountPill>}
      action={
        <PillTabs
          ariaLabel="Which reports"
          value={filter}
          onChange={setFilter}
          options={[
            { key: 'all', label: 'All', count: all.length },
            { key: 'imaging', label: 'Imaging', icon: 'Scan', count: imaging.length },
            { key: 'documents', label: 'Documents', icon: 'FileText', count: docs.length },
          ]}
        />
      }
    >
      {shown.length === 0 ? (
        <EmptyState
          icon="ScrollText"
          why={
            all.length === 0
              ? `No reports are on ${p.name}’s record yet. A scan, an ECG or a discharge summary would appear here once reported.`
              : 'Nothing in this group. Choose All to see every report.'
          }
        />
      ) : (
        <ul className="divide-y divide-glass-hairline">
          {shown.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function ReportRow({ report: r }: { report: RecordReport }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const hasBody = (r.body?.length ?? 0) > 0

  return (
    <li className="px-2 py-3 sm:px-3">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-field bg-glass-inset text-ink-2">
          <Icon name={KIND_ICON[r.kind]} size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{r.title}</span>
            <Chip tone="neutral">{r.kind}</Chip>
            {r.kind === 'Imaging' && r.by === 'Awaiting radiologist' && <Chip tone="caution">Awaiting report</Chip>}
          </p>
          <p className="mt-1 leading-relaxed text-ink-2">{r.summary}</p>
          <p className="tabular mt-1 text-[0.86em] text-ink-3">
            {formatDate(r.at)} {formatTime(r.at)} · {r.by}
          </p>
          {open && hasBody && (
            <ul className="mt-2 space-y-1 rounded-panel bg-glass-inset px-3.5 py-2.5 text-[0.92em] text-ink-2">
              {r.body!.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasBody && (
            <Button size="sm" tone="tertiary" icon={open ? 'ChevronDown' : 'ChevronRight'} onClick={() => setOpen((v) => !v)}>
              {open ? 'Less' : 'Full report'}
            </Button>
          )}
          {r.studyId && (
            <Button
              size="sm"
              tone={r.viewable ? 'primary' : 'secondary'}
              icon={r.viewable ? 'Scan' : 'FileText'}
              onClick={() => navigate(`/radiology/study/${r.studyId}/view`)}
              className={cx(!r.viewable && 'text-ink-2')}
            >
              {r.viewable ? 'Open images' : 'Report only'}
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}
