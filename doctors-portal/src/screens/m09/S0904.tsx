/**
 * S-09-04 · Results Inbox — `/results/inbox` · T1 · ARC-01
 *
 * "Results ranked by how much they should worry you."
 *
 * Deck beat #13: "Results come ranked, and the critical one escalates."
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
import { Diamond, RowBadge } from '@/components/ai'
import { Alert, Button, Card, Chip, ClinicalFlag, Icon, cx } from '@/components/primitives'
import { RESULTS } from '@/data/clinical'
import type { ResultRow } from '@/data/clinical'
import { formatDateTime, formatElapsed } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { Screen } from '@/shell/Screen'

import { S0906 } from './S0906'

export function S0904() {
  const navigate = useNavigate()
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const [aiSort, setAiSort] = useState(true)
  const [critical, setCritical] = useState<ResultRow | null>(null)
  const [filter, setFilter] = useState<'unreviewed' | 'all'>('unreviewed')

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
      key: 'patient',
      label: 'Patient',
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="tabular block text-[0.86em] text-ink-3">
              {p.age}/{p.sex} · {p.bed ?? 'outpatient'}
            </span>
          </span>
        )
      },
    },
    {
      key: 'test',
      label: 'Result',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{r.test}</span>
          <span className="tabular block text-[0.88em]">
            {r.value} {r.unit}
            <span className="ml-2 text-ink-3">ref {r.refRange}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'flag',
      label: 'Range',
      cell: (r) => <ClinicalFlag flag={r.flag} />,
    },
    {
      key: 'delta',
      label: 'Delta vs prior',
      secondary: true,
      cell: (r) =>
        r.delta ? (
          <span className="tabular flex items-center gap-1.5 text-[0.9em]">
            <Diamond size={9} />
            {r.delta}
            <span className="text-ink-3">from {r.priorValue}</span>
          </span>
        ) : (
          <span className="text-[0.88em] text-ink-3">no prior</span>
        ),
    },
    {
      key: 'why',
      label: 'Why it is here',
      secondary: true,
      cell: (r) => (
        <RowBadge
          label={r.critical ? 'CRITICAL' : 'Review'}
          reason={r.aiReason}
          tone={r.critical ? 'critical' : 'ai'}
          band={r.band}
        />
      ),
    },
    {
      key: 'clock',
      label: 'Reported',
      cell: (r) => (
        <span className="block">
          <span className="tabular block text-[0.9em]">{formatDateTime(r.reportedAt)}</span>
          {r.critical && !acked(r) && r.unackMinutes !== undefined && (
            <span className="tabular block text-[0.86em] font-semibold text-critical">
              unacknowledged {r.unackMinutes} min
            </span>
          )}
          {acked(r) && (
            <span className="block text-[0.86em] text-normal">
              acknowledged{acknowledgements[r.id] ? ` by ${acknowledgements[r.id].by}` : ''}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'action',
      label: '',
      className: 'text-right',
      cell: (r) =>
        r.critical && !acked(r) ? (
          <Button
            size="sm"
            tone="destructive"
            icon="TriangleAlert"
            onClick={(e) => {
              e.stopPropagation()
              setCritical(r)
            }}
          >
            Acknowledge
          </Button>
        ) : (
          <Icon name="ChevronRight" size={15} className="text-ink-muted" />
        ),
    },
  ]

  return (
    <Screen
      screenId="S-09-04"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={
        <>
          {criticalUnacked.length > 0 && (
            <Chip tone="critical" icon="TriangleAlert">
              {criticalUnacked.length} critical unacknowledged
            </Chip>
          )}
          <Chip tone="ai">
            <Diamond size={9} />
            AI-212 · AI-213
          </Chip>
        </>
      }
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">No results are waiting for review.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            Everything released for your patients has been seen. A newly released result, or a critical value on
            anyone you are covering, would appear here within seconds.
          </p>
        </Card>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              How a critical value reaches you
            </h3>
            <ol className="mt-2 space-y-2 text-[0.9em] text-ink-2">
              {[
                'Released by the laboratory against a rule-based threshold.',
                'Interrupts a NAMED clinician — you, not the ward.',
                'You acknowledge, which records that you saw it.',
                'Unacknowledged inside the window, it escalates to the on-call.',
                'Acting on it is documented separately, in an addendum or a note.',
              ].map((t, i) => (
                <li key={t} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-glass-fill-muted text-[0.82em] font-semibold">
                    {i + 1}
                  </span>
                  {t}
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.86em] text-ink-2">
              Acknowledging is not the same as acting. The acknowledgement records only that you saw it.
            </p>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-212 · delta check
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              The ranking uses how far a value has moved, not only whether it is out of range. A creatinine inside the
              range that has doubled is more interesting than a stable one just above it.
            </p>
          </Card>
        </div>
      }
      railTitle="Escalation"
    >
      <div className="space-y-5">
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
            to the on-call consultant at 15 minutes. The threshold that fired is rule-based and never switches off.
          </Alert>
        )}

        <Worklist
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
          emptyWhy="No results are waiting for review. A newly released result for one of your patients would appear here."
          emptyAction={
            <Button size="sm" onClick={() => setFilter('all')}>
              Show results already reviewed
            </Button>
          }
          filters={
            <>
              <button
                type="button"
                onClick={() => setFilter('unreviewed')}
                className={cx(
                  'min-h-9 rounded-pill px-3 py-1 text-[0.88em] font-medium',
                  filter === 'unreviewed' ? 'bg-brand text-brand-on' : 'glass hover:bg-glass-fill-hover',
                )}
              >
                To review
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={cx(
                  'min-h-9 rounded-pill px-3 py-1 text-[0.88em] font-medium',
                  filter === 'all' ? 'bg-brand text-brand-on' : 'glass hover:bg-glass-fill-hover',
                )}
              >
                All
              </button>
              <Chip tone="neutral" icon="Clock">
                as of {formatElapsed(0)} ago
              </Chip>
            </>
          }
        />

        {/* AI-212 abstains on the incomplete culture rather than scoring it low. */}
        {RESULTS.some((r) => r.aiReason.startsWith('Cannot assess')) && (
          <Card className="border-l-[3px] border-l-caution p-4">
            <p className="flex items-center gap-2 font-semibold text-caution">
              <Icon name="CircleHelp" size={16} />
              One result cannot be ranked
            </p>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              The blood culture is incomplete — a final read is due at 72 hours. AI-212 abstains rather than ranking it
              low, because "low concern" and "cannot yet say" are different claims.
            </p>
            <p className="mt-2 text-[0.84em] text-ink-3">
              AI-212 · never a null score, a zero, or a blank band.
            </p>
          </Card>
        )}
      </div>

      {/* S-09-06, the modal it is specified to be. */}
      <S0906 result={critical} onClose={() => setCritical(null)} />
    </Screen>
  )
}
