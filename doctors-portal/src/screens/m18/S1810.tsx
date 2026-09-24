/**
 * S-18-10 · Telestroke Request Queue — `/stroke/telestroke/queue` · T2 · ARC-01
 *
 * "Requests from the spokes, ranked by clock and severity."
 *
 * The ranking here is the highest-stakes use of AIP-07 in the product, so the
 * reversibility rule matters more than usual: the deterministic sort is one
 * click away.
 *
 * Calm pass: the requests inside the window are the default slice; the one
 * outside it is a tap away and still needs answering. The row reads window ·
 * case · severity · status; the ranking's reasoning is in the Why.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { ScopeTabs, Why, useScope } from '@/components/calm'
import { Card, Chip, Icon, KeyValue, cx } from '@/components/primitives'
import { formatElapsed, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { TELESTROKE_QUEUE } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

import { useCaseClock } from './CaseClock'

type Row = (typeof TELESTROKE_QUEUE)[number]
type Scope = 'inside' | 'outside'
const SCOPES: readonly Scope[] = ['inside', 'outside']

/** The 4.5-hour thrombolysis window, in minutes from last known well. */
const WINDOW_MIN = 270

/** An action inside a calm worklist row — a span, because the row is already a button. */
function RowAction({
  icon,
  primary,
  onClick,
  children,
}: {
  icon: string
  primary?: boolean
  onClick: () => void
  children: ReactNode
}) {
  const fire = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onClick()
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={fire}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') fire(e)
      }}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3.5 text-[0.88em] font-semibold transition-colors',
        primary ? 'bg-brand text-brand-on hover:bg-brand-dark' : 'bg-glass-fill-strong text-ink hover:bg-glass-fill-hover',
      )}
    >
      <Icon name={icon} size={14} />
      {children}
    </span>
  )
}

export function S1810() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const [aiSort, setAiSort] = useState(true)
  const [scope, setScope] = useScope(SCOPES, 'inside')

  /** Time-value ranking: window remaining, then severity. */
  const remaining = (r: Row) => Math.max(0, WINDOW_MIN - r.lkwElapsedMin)
  const sorted = aiSort
    ? [...TELESTROKE_QUEUE].sort((a, b) => remaining(a) - remaining(b) || b.nihss - a.nihss)
    : [...TELESTROKE_QUEUE].sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())

  const inside = sorted.filter((r) => remaining(r) > 0)
  const outside = sorted.filter((r) => remaining(r) <= 0)
  const rows = scope === 'inside' ? inside : outside
  const inSession = TELESTROKE_QUEUE.filter((r) => r.status === 'In session').length

  const open = (r: Row) => navigate(`/stroke/case/${r.caseId}/telestroke`)

  const columns: WorklistColumn<Row>[] = [
    {
      key: 'window',
      label: 'Window',
      role: 'lead',
      cell: (r) => (
        <span className={remaining(r) <= 0 ? 'text-ink-3' : remaining(r) < 90 ? 'text-caution' : 'text-normal'}>
          {remaining(r) <= 0 ? 'closed' : formatElapsed(remaining(r))}
        </span>
      ),
    },
    {
      key: 'case',
      label: 'Case',
      role: 'primary',
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <>
            STROKE/26-27/{r.caseId} <span className="font-normal text-ink-3">· {r.site}</span>
            <span className="tabular ml-2 font-normal text-ink-3">
              {p.age}/{p.sex}
            </span>
          </>
        )
      },
    },
    { key: 'nihss', label: 'NIHSS', role: 'context', cell: (r) => <span className="tabular">NIHSS {r.nihss}</span> },
    {
      key: 'finding',
      label: 'Imaging',
      role: 'context',
      cell: (r) => (aiActive ? r.aiFinding : 'awaiting a read'),
    },
    {
      key: 'lkw',
      label: 'LKW',
      role: 'context',
      cell: (r) => <span className="tabular">LKW {formatElapsed(r.lkwElapsedMin)} ago</span>,
    },
    {
      key: 'status',
      label: 'Status',
      role: 'status',
      cell: (r) => (
        <Chip tone={r.status === 'In session' ? 'normal' : 'caution'} icon={r.status === 'In session' ? 'Video' : 'Clock'}>
          {r.status}
        </Chip>
      ),
    },
    {
      key: 'action',
      label: '',
      role: 'status',
      cell: (r) => (
        <RowAction icon="Video" primary={r.status === 'In session'} onClick={() => open(r)}>
          {r.status === 'In session' ? 'Rejoin' : 'Start'}
        </RowAction>
      ),
    },
  ]

  return (
    <Screen
      screenId="S-18-10"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      heading="Telestroke queue"
      subheading={
        <>
          {TELESTROKE_QUEUE.length} requests · {inside.length} inside the window · {inSession} in session · ranked by
          clock, not arrival
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
    >
      <div className="space-y-5">
        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(r) => r.caseId}
          onOpen={open}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-613"
          aiSortLabel="Time value"
          deterministicLabel="Arrival time"
          caption="Telestroke requests from the network"
          noun="requests"
          emptyWhy={
            scope === 'inside'
              ? 'No request is inside the thrombolysis window right now. Requests outside it are one tap away and still need a plan.'
              : 'Every waiting request is still inside its window.'
          }
          filters={
            <ScopeTabs
              value={scope}
              onChange={setScope}
              options={[
                { key: 'inside', label: 'In window', icon: 'Timer', count: inside.length },
                { key: 'outside', label: 'Outside window', icon: 'Clock', count: outside.length },
              ]}
            />
          }
        />

        <Why label="How the queue is ranked, and what outside the window means">
          <p className="text-ink-2">
            Window remaining first, then severity. A patient whose window closes in 90 minutes outranks one who arrived
            first but is already outside it. Where the ranking is wrong, sorting by arrival time is one click away and
            the list does not re-order under you mid-scan.
          </p>
          <p className="text-ink-2">
            A request outside the window is still in the queue and still needs answering — outside the window is a
            different decision, not no decision. Extended-window imaging selection may still apply, and the patient
            needs a plan either way.
          </p>
          <dl className="divide-y divide-glass-hairline">
            <KeyValue label="Answer a request">within 5 min</KeyValue>
            <KeyValue label="Complete the NIHSS">within 15 min</KeyValue>
            <KeyValue label="Decision to the spoke">within 20 min</KeyValue>
          </dl>
          <p className="tabular text-ink-3">
            Windows are computed from last-known-well against a 4.5-hour thrombolysis window, recomputed every second
            against the server clock ({formatTime(caseNow)}).
          </p>
        </Why>
      </div>
    </Screen>
  )
}
