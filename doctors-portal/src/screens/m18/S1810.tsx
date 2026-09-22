/**
 * S-18-10 · Telestroke Request Queue — `/stroke/telestroke/queue` · T2 · ARC-01
 *
 * "Requests from the spokes, ranked by clock and severity."
 *
 * The ranking here is the highest-stakes use of AIP-07 in the product, so the
 * reversibility rule matters more than usual: the deterministic sort is one
 * click away, and the per-row reason chip says what the ranking used.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { Diamond, RowBadge } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { formatElapsed, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { TELESTROKE_QUEUE } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

import { useCaseClock } from './CaseClock'

type Row = (typeof TELESTROKE_QUEUE)[number]

export function S1810() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const [aiSort, setAiSort] = useState(true)

  /** Time-value ranking: window remaining, then severity. */
  const remaining = (r: Row) => Math.max(0, 270 - r.lkwElapsedMin)
  const rows = aiSort
    ? [...TELESTROKE_QUEUE].sort((a, b) => remaining(a) - remaining(b) || b.nihss - a.nihss)
    : [...TELESTROKE_QUEUE].sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())

  const columns: WorklistColumn<Row>[] = [
    {
      key: 'case',
      label: 'Case',
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <span className="block min-w-0">
            <span className="tabular block truncate font-medium">STROKE/26-27/{r.caseId}</span>
            <span className="tabular block text-[0.86em] text-ink-3">
              {p.age}/{p.sex} · {r.site}
            </span>
          </span>
        )
      },
    },
    {
      key: 'window',
      label: 'Window remaining',
      cell: (r) => (
        <span className="block">
          <span
            className={`tabular block font-semibold ${remaining(r) <= 0 ? 'text-abnormal' : remaining(r) < 90 ? 'text-caution' : 'text-normal'}`}
          >
            {remaining(r) <= 0 ? 'outside the window' : formatElapsed(remaining(r))}
          </span>
          <span className="tabular block text-[0.84em] text-ink-3">LKW {formatElapsed(r.lkwElapsedMin)} ago</span>
        </span>
      ),
    },
    { key: 'nihss', label: 'NIHSS', cell: (r) => <span className="tabular font-semibold">{r.nihss}</span> },
    {
      key: 'finding',
      label: 'Imaging',
      secondary: true,
      cell: (r) =>
        aiActive ? (
          <span className="flex items-center gap-1.5 text-[0.9em]">
            <Diamond size={9} />
            {r.aiFinding}
          </span>
        ) : (
          <span className="text-[0.88em] text-ink-3">awaiting a read</span>
        ),
    },
    {
      key: 'why',
      label: 'Why it is ranked here',
      secondary: true,
      cell: (r) => <RowBadge label="rank" reason={r.rankReason} tone="ai" band={r.band} />,
    },
    {
      key: 'status',
      label: 'Status',
      cell: (r) => (
        <Chip tone={r.status === 'In session' ? 'normal' : 'caution'} icon={r.status === 'In session' ? 'Video' : 'Clock'}>
          {r.status}
        </Chip>
      ),
    },
    {
      key: 'action',
      label: '',
      className: 'text-right',
      cell: (r) => (
        <Button
          size="sm"
          tone={r.status === 'In session' ? 'primary' : 'secondary'}
          icon="Video"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/stroke/case/${r.caseId}/telestroke`)
          }}
        >
          {r.status === 'In session' ? 'Rejoin' : 'Start'}
        </Button>
      ),
    },
  ]

  const urgent = rows.filter((r) => remaining(r) > 0 && remaining(r) < 120)

  return (
    <Screen
      screenId="S-18-10"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      chips={
        <>
          <Chip tone="neutral">{TELESTROKE_QUEUE.length} requests</Chip>
          {urgent.length > 0 && <Chip tone="abnormal">{urgent.length} inside the window</Chip>}
        </>
      }
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">No telestroke requests waiting.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            A spoke site activating a code stroke raises a request here automatically. There is nothing to poll.
          </p>
        </Card>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Response target</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Answer a request">within 5 min</KeyValue>
              <KeyValue label="Complete the NIHSS">within 15 min</KeyValue>
              <KeyValue label="Decision to the spoke">within 20 min</KeyValue>
            </dl>
            <p className="tabular mt-2 text-[0.86em] text-ink-3">server {formatTime(caseNow)}</p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              What the ranking uses
            </h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Window remaining first, then severity. A request that arrived later can rank above one that arrived
              earlier, which is exactly why the reason chip is on every row and the deterministic sort is one click
              away.
            </p>
          </Card>
        </div>
      }
      railTitle="Queue"
    >
      <div className="space-y-5">
        <Alert tone="info" title="Ranked by clock, not by arrival">
          A patient whose window closes in 90 minutes outranks one who arrived first but is already outside it. Where
          the ranking is wrong, sorting by arrival time is one click away and the list does not re-order under you
          mid-scan.
        </Alert>

        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(r) => r.caseId}
          onOpen={(r) => navigate(`/stroke/case/${r.caseId}/telestroke`)}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-613"
          aiSortLabel="Time value"
          deterministicLabel="Arrival time"
          caption="Telestroke requests from the network"
          emptyWhy="No telestroke requests waiting. A spoke activating a code stroke raises one here automatically."
          filters={
            <>
              <Chip tone="neutral" icon="Brain">
                on call
              </Chip>
              <Chip tone="neutral" icon="Building2">
                all sites
              </Chip>
            </>
          }
        />

        {rows.some((r) => remaining(r) <= 0) && (
          <Card className="border-l-[3px] border-l-inactive p-4">
            <p className="flex items-center gap-2 font-semibold text-ink-2">
              <Icon name="Clock" size={16} />
              One request is outside the thrombolysis window
            </p>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              It is still in the queue and still needs answering — outside the window is a different decision, not no
              decision. Extended-window imaging selection may still apply, and the patient needs a plan either way.
            </p>
          </Card>
        )}

        <p className="tabular flex items-start gap-2 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          Windows are computed from last-known-well against a 4.5-hour thrombolysis window, recomputed every second
          against the server clock. A minute here is about two million neurons.
        </p>
      </div>
    </Screen>
  )
}

