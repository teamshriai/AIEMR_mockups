/**
 * S-09-04 · Results Inbox — `/results/inbox` · T1 · ARC-01
 *
 * "Results ranked by how much they should worry you."
 *
 * Deck beat #13: "Results come ranked, and the critical one escalates."
 *
 * Redesigned to match My Day — the calm `ARC-01` variant, a minimal header, and
 * the reference material that used to fill a 320px rail removed rather than
 * restated. What is NOT removed is the escalation: the critical banner still
 * interrupts, the acknowledgement is still a named act, and the modal is still
 * undismissable without a disposition. Calm is a property of the layout, not of
 * the safety path.
 *
 * The two capabilities do different jobs and it matters that they look
 * different on screen:
 *   AI-212 RANKS and shows a delta against the prior value. G1 — you may
 *   ignore it, and the chronological sort is one click away.
 *   AI-213 ESCALATES. G2, rule-based thresholds that are never fully off, and
 *   it interrupts a NAMED clinician rather than a pool.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { PillTabs } from '@/components/myday'
import { Alert, Button, Card, Chip, ClinicalFlag, Icon } from '@/components/primitives'
import { RESULTS } from '@/data/clinical'
import type { ResultRow } from '@/data/clinical'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { Screen } from '@/shell/Screen'

import { S0906 } from './S0906'

export function S0904() {
  const navigate = useNavigate()
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const [aiSort, setAiSort] = useState(true)
  const [critical, setCritical] = useState<ResultRow | null>(null)
  const [filter, setFilter] = useState<'to-review' | 'all'>('to-review')

  const acked = (r: ResultRow) => r.acknowledged || acknowledgements[r.id] !== undefined

  const rows = RESULTS.filter((r) => (filter === 'all' ? true : !acked(r)))
  /**
   * AI-212's ranking: critical first, then by how far the value has moved.
   * The deterministic sort is strictly by report time.
   */
  const ordered = aiSort
    ? [...rows].sort((a, b) => Number(b.critical) - Number(a.critical) || b.reportedAt.getTime() - a.reportedAt.getTime())
    : [...rows].sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())

  const criticalUnacked = RESULTS.filter((r) => r.critical && !acked(r))

  const columns: WorklistColumn<ResultRow>[] = [
    {
      key: 'clock',
      label: 'Reported',
      role: 'lead',
      cell: (r) => formatTime(r.reportedAt),
    },
    {
      key: 'patient',
      label: 'Patient',
      role: 'primary',
      cell: (r) => patient(r.patientId).name,
    },
    {
      key: 'test',
      label: 'Result',
      role: 'context',
      cell: (r) => (
        <span className="tabular font-semibold text-ink-2">
          {r.test} {r.value} {r.unit}
        </span>
      ),
    },
    {
      key: 'where',
      label: 'Location',
      role: 'context',
      cell: (r) => patient(r.patientId).bed ?? 'outpatient',
    },
    {
      /*
       * The movement against the prior value, as a number. The ◆ that used to
       * sit on it, and AI-212's one-line reason, live on the result detail —
       * where "Why?" opens the four panels. Here they doubled every row.
       */
      key: 'delta',
      label: 'Delta vs prior',
      role: 'context',
      cell: (r) => (r.delta ? <span className="tabular">{r.delta} vs prior</span> : <span>no prior</span>),
    },
    {
      key: 'flag',
      label: 'Range',
      role: 'status',
      cell: (r) => <ClinicalFlag flag={r.flag} />,
    },
    {
      key: 'ack',
      label: '',
      role: 'status',
      cell: (r) =>
        r.critical && !acked(r) ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              setCritical(r)
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-critical px-3 py-1 text-[0.86em] font-semibold text-critical-on"
          >
            <Icon name="TriangleAlert" size={13} />
            Acknowledge
            <span className="tabular font-normal opacity-80">{r.unackMinutes} min</span>
          </span>
        ) : acked(r) ? (
          <span className="text-[0.84em] text-normal">
            acknowledged{acknowledgements[r.id] ? ` · ${acknowledgements[r.id].by}` : ''}
          </span>
        ) : null,
    },
  ]

  return (
    <Screen
      screenId="S-09-04"
      loadingShape="list"
      heading="Results"
      subheading={
        <>
          {rows.length} to review
          {criticalUnacked.length > 0 && ` · ${criticalUnacked.length} critical, unacknowledged`}
        </>
      }
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">No results are waiting for review.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            Everything released for your patients has been seen. A newly released result, or a critical value on
            anyone you are covering, would appear here within seconds.
          </p>
        </Card>
      }
    >
      <div className="max-w-4xl space-y-6">
        {/* AI-213 escalating. This is allowed to interrupt; nothing else here is. */}
        {criticalUnacked.length > 0 && (
          <Alert
            tone="critical"
            role="alert"
            title={`${criticalUnacked[0].test} ${criticalUnacked[0].value} ${criticalUnacked[0].unit} — critical, unacknowledged ${criticalUnacked[0].unackMinutes} minutes`}
            action={
              <Button tone="destructive" size="sm" onClick={() => setCritical(criticalUnacked[0])}>
                Acknowledge now
              </Button>
            }
          >
            {patient(criticalUnacked[0].patientId).name} · {patient(criticalUnacked[0].patientId).bed}. This escalates
            to the on-call consultant at 15 minutes. Acknowledging records that you saw it — acting on it is documented
            separately.
          </Alert>
        )}

        <Worklist
          variant="calm"
          rows={ordered}
          columns={columns}
          rowKey={(r) => r.id}
          onOpen={(r) => navigate(`/results/${r.id}`)}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-212"
          aiSortLabel="Clinical concern"
          deterministicLabel="Most recent first"
          caption="Results released for this clinician's patients"
          noun="results"
          emptyWhy="No results are waiting for review. A newly released result for one of your patients would appear here."
          emptyAction={
            <Button size="sm" onClick={() => setFilter('all')}>
              Show results already reviewed
            </Button>
          }
          filters={
            <>
              <PillTabs
                ariaLabel="Which results"
                value={filter}
                options={[
                  { key: 'to-review', label: 'To review' },
                  { key: 'all', label: 'All' },
                ]}
                onChange={setFilter}
              />
              <Chip tone="neutral" icon="Clock">
                as of 08:40
              </Chip>
            </>
          }
        />

        {/* AI-212 abstains on the incomplete culture rather than scoring it low. */}
        {ordered.some((r) => r.aiReason.startsWith('Cannot assess')) && (
          <Card className="border-l-[3px] border-l-caution p-4">
            <p className="flex items-center gap-2 font-semibold text-caution">
              <Icon name="CircleHelp" size={16} />
              One result cannot be ranked
            </p>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              The blood culture is incomplete — a final read is due at 72 hours. AI-212 abstains rather than ranking it
              low, because &ldquo;low concern&rdquo; and &ldquo;cannot yet say&rdquo; are different claims.
            </p>
          </Card>
        )}
      </div>

      {/* S-09-06, the modal it is specified to be. */}
      <S0906 result={critical} onClose={() => setCritical(null)} />
    </Screen>
  )
}
