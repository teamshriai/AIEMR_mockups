/**
 * S-15-01 · Imaging worklist — `/radiology/worklist` · T2 · ARC-01
 *
 * "Every study on the record, the AI-flagged ones first — pick a patient,
 * then open the scan."
 *
 * The Imaging rail item used to open one study directly, which meant it
 * always opened the same patient. A worklist is what the item should have
 * been: the patients with imaging, their study, when it was done, and the AI
 * flag derived from that series' own labels. Nothing opens until a row is
 * chosen.
 *
 * Night is the default here, as it is for the viewer — this is a reading-room
 * screen.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PillTabs } from '@/components/calm'
import { Chip, Icon } from '@/components/primitives'
import type { WorklistColumn } from '@/archetypes'
import { Worklist } from '@/archetypes'
import { formatDate, formatTime } from '@/data/format'
import { IMAGING_STUDIES, aiFlagFor } from '@/data/imaging'
import type { ImagingStudy } from '@/data/imaging'
import { patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

type Filter = 'all' | 'flagged' | 'awaiting' | 'reported'

const FLAG_RANK = { critical: 0, caution: 1, normal: 2 } as const

export function S1501() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const [filter, setFilter] = useState<Filter>('all')
  const [aiSort, setAiSort] = useState(true)

  const flagged = IMAGING_STUDIES.filter((s) => {
    const f = aiFlagFor(s)
    return f && f.tone !== 'normal'
  })
  const awaiting = IMAGING_STUDIES.filter((s) => s.status === 'Awaiting report')
  const reported = IMAGING_STUDIES.filter((s) => s.status === 'Reported')

  const rows = useMemo(() => {
    const base =
      filter === 'flagged' ? flagged : filter === 'awaiting' ? awaiting : filter === 'reported' ? reported : IMAGING_STUDIES
    const byTime = [...base].sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime())
    if (!aiActive || !aiSort) return byTime
    // AI order: flagged first (bleed, then mass effect), awaiting before reported, then newest.
    return byTime.sort((a, b) => {
      const fa = aiFlagFor(a)
      const fb = aiFlagFor(b)
      const ra = fa ? FLAG_RANK[fa.tone] : 3
      const rb = fb ? FLAG_RANK[fb.tone] : 3
      if (ra !== rb) return ra - rb
      if (a.status !== b.status) return a.status === 'Awaiting report' ? -1 : 1
      return b.acquiredAt.getTime() - a.acquiredAt.getTime()
    })
  }, [filter, aiActive, aiSort, flagged, awaiting, reported])

  const columns: WorklistColumn<ImagingStudy>[] = [
    {
      key: 'when',
      label: 'Acquired',
      role: 'lead',
      cell: (s) => (
        <span className="tabular flex flex-col leading-tight">
          <span>{formatTime(s.acquiredAt)}</span>
          <span className="text-[0.8em] font-normal text-ink-3">{formatDate(s.acquiredAt).slice(0, 6)}</span>
        </span>
      ),
    },
    { key: 'patient', label: 'Patient', role: 'primary', cell: (s) => patient(s.patientId).name },
    {
      key: 'who',
      label: 'Age / sex',
      role: 'context',
      cell: (s) => {
        const p = patient(s.patientId)
        return (
          <span className="tabular">
            {p.age}/{p.sex} · {p.uhid}
          </span>
        )
      },
    },
    {
      key: 'study',
      label: 'Study',
      role: 'context',
      cell: (s) => (
        <span className="inline-flex items-center gap-1.5">
          <Icon name={s.modality === 'CT' ? 'Scan' : s.modality === 'X-ray' ? 'Image' : 'Radio'} size={13} />
          {s.id} · {s.description}
          {!s.ncctKey && ' · report only'}
        </span>
      ),
    },
    {
      key: 'flag',
      label: 'AI flag',
      role: 'status',
      cell: (s) => {
        const f = aiActive ? aiFlagFor(s) : undefined
        if (!f) return null
        return (
          <Chip tone={f.tone === 'critical' ? 'critical' : f.tone === 'caution' ? 'caution' : 'normal'} icon={f.tone === 'normal' ? 'Check' : 'TriangleAlert'}>
            {f.label}
          </Chip>
        )
      },
    },
    {
      key: 'status',
      label: 'Report',
      role: 'status',
      cell: (s) =>
        s.status === 'Awaiting report' ? (
          <Chip tone="caution" icon="Clock">
            Awaiting report
          </Chip>
        ) : (
          <Chip tone="neutral" icon="Check">
            Reported
          </Chip>
        ),
    },
  ]

  return (
    <Screen
      screenId="S-15-01"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF']}
      subheading={
        <>
          {IMAGING_STUDIES.length} studies · {aiActive ? `${flagged.length} flagged by AI · ` : ''}
          {awaiting.length} awaiting a report
        </>
      }
    >
      <div className="max-w-5xl">
        <Worklist
          variant="calm"
          rows={rows}
          columns={columns}
          rowKey={(s) => s.id}
          onOpen={(s) => navigate(`/radiology/study/${s.id}/view`)}
          aiSort={aiActive ? aiSort : false}
          onSortChange={setAiSort}
          sortCapability="AI-404"
          aiSortLabel="AI flag, then newest"
          deterministicLabel="Newest first"
          caption="Imaging studies on the record"
          noun="studies"
          emptyWhy="No studies match this filter. Choose All to see every study on the record."
          filters={
            <PillTabs
              ariaLabel="Which studies"
              value={filter}
              onChange={setFilter}
              options={[
                { key: 'all', label: 'All', count: IMAGING_STUDIES.length },
                ...(aiActive ? [{ key: 'flagged' as const, label: 'AI-flagged', count: flagged.length }] : []),
                { key: 'awaiting', label: 'Awaiting report', count: awaiting.length },
                { key: 'reported', label: 'Reported', count: reported.length },
              ]}
            />
          }
        />
      </div>
    </Screen>
  )
}
