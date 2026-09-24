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
 * Full frame since the second review: every patient's results are here, not
 * just today's three, so the list is filtered by review state and by patient,
 * can be read grouped by patient, and a summary column says at a glance how
 * much is critical, outside range and still unreviewed.
 *
 * The two capabilities do different jobs and it matters that they look
 * different on screen:
 *   AI-212 RANKS and shows a delta against the prior value. G1 — you may
 *   ignore it, and the chronological sort is one click away.
 *   AI-213 ESCALATES. G2, rule-based thresholds that are never fully off, and
 *   it interrupts a NAMED clinician rather than a pool.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { CountPill, SectionCard } from '@/components/calm'
import { PillTabs } from '@/components/myday'
import { Alert, Button, Card, Chip, ClinicalFlag, Icon, Select, StatTile, cx } from '@/components/primitives'
import { RESULTS } from '@/data/clinical'
import type { ResultRow } from '@/data/clinical'
import { formatDate, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { Screen } from '@/shell/Screen'

import { S0906 } from './S0906'

export function S0904() {
  const navigate = useNavigate()
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const [aiSort, setAiSort] = useState(true)
  const [critical, setCritical] = useState<ResultRow | null>(null)
  const [filter, setFilter] = useState<'to-review' | 'reviewed' | 'all'>('to-review')
  const [who, setWho] = useState<string>('all')
  const [view, setView] = useState<'list' | 'patients'>('list')

  const acked = (r: ResultRow) => r.acknowledged || acknowledgements[r.id] !== undefined

  const forWho = who === 'all' ? RESULTS : RESULTS.filter((r) => r.patientId === who)
  const toReview = forWho.filter((r) => !acked(r))
  const reviewed = forWho.filter((r) => acked(r))
  const rows = filter === 'all' ? forWho : filter === 'reviewed' ? reviewed : toReview
  /**
   * AI-212's ranking: critical first, then by how far the value has moved.
   * The deterministic sort is strictly by report time.
   */
  const ordered = aiSort
    ? [...rows].sort((a, b) => Number(b.critical) - Number(a.critical) || b.reportedAt.getTime() - a.reportedAt.getTime())
    : [...rows].sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime())

  const criticalUnacked = RESULTS.filter((r) => r.critical && !acked(r))
  const outside = RESULTS.filter((r) => r.flag !== 'Normal')
  const allToReview = RESULTS.filter((r) => !acked(r))
  const oldest = [...allToReview].sort((a, b) => a.reportedAt.getTime() - b.reportedAt.getTime())[0]

  /** Everyone with a result, most to review first — the summary column and the patient filter. */
  const byPatient = useMemo(() => {
    const map = new Map<string, ResultRow[]>()
    for (const r of RESULTS) map.set(r.patientId, [...(map.get(r.patientId) ?? []), r])
    return [...map.entries()]
      .map(([patientId, list]) => ({
        patientId,
        list,
        review: list.filter((r) => !r.acknowledged && acknowledgements[r.id] === undefined).length,
        abnormal: list.filter((r) => r.flag !== 'Normal').length,
        critical: list.some((r) => r.critical),
      }))
      .sort((a, b) => Number(b.critical) - Number(a.critical) || b.review - a.review || b.abnormal - a.abnormal)
  }, [acknowledgements])

  /** Today reads as a time; anything earlier carries its date, so 18-Sep never reads as this morning. */
  const when = (d: Date) => (d.toDateString() === NOW.toDateString() ? formatTime(d) : formatDate(d).slice(0, 6))

  const columns: WorklistColumn<ResultRow>[] = [
    {
      key: 'clock',
      label: 'Reported',
      role: 'lead',
      cell: (r) => when(r.reportedAt),
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
      cell: (r) =>
        r.delta ? (
          <span className="tabular">{/\bsince\b/.test(r.delta) ? r.delta : `${r.delta} vs prior`}</span>
        ) : (
          <span>no prior</span>
        ),
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

  const filters = (
    <>
      <PillTabs
        ariaLabel="Which results"
        value={filter}
        options={[
          { key: 'to-review', label: 'To review', count: toReview.length },
          { key: 'reviewed', label: 'Reviewed', count: reviewed.length },
          { key: 'all', label: 'All', count: forWho.length },
        ]}
        onChange={setFilter}
      />
      <PillTabs
        ariaLabel="How to show them"
        value={view}
        options={[
          { key: 'list', label: 'List', icon: 'List' },
          { key: 'patients', label: 'By patient', icon: 'Users' },
        ]}
        onChange={setView}
      />
      <label className="inline-flex items-center gap-2 text-[0.88em] text-ink-3">
        <span className="sr-only">Patient</span>
        <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Patient" className="min-h-9 py-1.5">
          <option value="all">All patients</option>
          {byPatient.map((g) => (
            <option key={g.patientId} value={g.patientId}>
              {patient(g.patientId).name}
            </option>
          ))}
        </Select>
      </label>
      <Chip tone="neutral" icon="Clock">
        as of 08:40
      </Chip>
    </>
  )

  return (
    <Screen
      screenId="S-09-04"
      loadingShape="list"
      heading="Results"
      subheading={
        <>
          {allToReview.length} to review · {RESULTS.length} results across {byPatient.length} patients
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
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
      <div className="min-w-0 space-y-6">
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

        {view === 'list' ? (
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
            emptyWhy={
              filter === 'to-review'
                ? 'No results are waiting for review. A newly released result for one of your patients would appear here.'
                : 'No results match this filter.'
            }
            emptyAction={
              filter !== 'all' ? (
                <Button size="sm" onClick={() => setFilter('all')}>
                  Show every result
                </Button>
              ) : undefined
            }
            filters={filters}
          />
        ) : (
          <SectionCard title="Results by patient" meta={<CountPill>{rows.length}</CountPill>} action={filters}>
            {rows.length === 0 ? (
              <p className="px-2 py-4 text-[0.95em] text-ink-2">No results match this filter.</p>
            ) : (
              <div className="space-y-4">
                {byPatient
                  .filter((g) => rows.some((r) => r.patientId === g.patientId))
                  .map((g) => {
                    const p = patient(g.patientId)
                    const list = rows.filter((r) => r.patientId === g.patientId)
                    return (
                      <section key={g.patientId} className="rounded-panel bg-glass-inset px-2 py-2 sm:px-3">
                        <header className="flex flex-wrap items-center justify-between gap-2 px-1 py-1.5">
                          <span className="min-w-0">
                            <span className="font-semibold">{p.name}</span>
                            <span className="tabular ml-2 text-[0.86em] text-ink-3">
                              {p.age}/{p.sex} · {p.bed ?? 'outpatient'}
                            </span>
                          </span>
                          <Button size="sm" tone="tertiary" iconAfter="ChevronRight" onClick={() => navigate(`/patient/${p.uhid}/results`)}>
                            All of {p.name.split(' ')[0]}’s results
                          </Button>
                        </header>
                        <ul className="divide-y divide-glass-hairline">
                          {list.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => navigate(`/results/${r.id}`)}
                                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 rounded-panel px-1 py-2 text-left hover:bg-glass-fill-hover"
                              >
                                <span className="tabular min-w-0 text-[0.95em]">
                                  <span className="mr-2 text-ink-3">{when(r.reportedAt)}</span>
                                  <span className="font-semibold">{r.test}</span> {r.value} {r.unit}
                                </span>
                                <span className="flex items-center gap-2">
                                  {!acked(r) && <Chip tone="caution">To review</Chip>}
                                  <ClinicalFlag flag={r.flag} />
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )
                  })}
              </div>
            )}
          </SectionCard>
        )}

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

      {/* The summary column: how much is critical, outside range, unreviewed — and whose. */}
      <section className="min-w-0 space-y-4" aria-label="Results summary">
        <div className="grid grid-cols-3 gap-3 xl:grid-cols-1 2xl:grid-cols-3">
          <StatTile label="Critical" value={RESULTS.filter((r) => r.critical).length} tone={criticalUnacked.length > 0 ? 'critical' : 'neutral'} sub={criticalUnacked.length > 0 ? `${criticalUnacked.length} unacknowledged` : 'all acknowledged'} />
          <StatTile label="Outside range" value={outside.length} tone="abnormal" sub="high or low" />
          <StatTile label="To review" value={allToReview.length} tone={allToReview.length > 0 ? 'caution' : 'normal'} sub={oldest ? `oldest ${when(oldest.reportedAt)}` : 'nothing waiting'} />
        </div>

        <SectionCard title="Patients with results" meta={<CountPill>{byPatient.length}</CountPill>}>
          <ul className="divide-y divide-glass-hairline">
            {byPatient.map((g) => {
              const p = patient(g.patientId)
              const active = who === g.patientId
              return (
                <li key={g.patientId}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setWho(active ? 'all' : g.patientId)}
                    className={cx(
                      'flex min-h-12 w-full items-center gap-3 rounded-panel px-2 py-2 text-left transition-colors sm:px-3',
                      active ? 'bg-brand-soft' : 'hover:bg-glass-fill-hover',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="tabular block text-[0.84em] text-ink-3">
                        {g.list.length} results · {g.abnormal} outside range
                      </span>
                    </span>
                    {g.critical && <Chip tone="critical" icon="TriangleAlert">Critical</Chip>}
                    {g.review > 0 && <CountPill tone="pending">{g.review}</CountPill>}
                  </button>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      </section>
      </div>

      {/* S-09-06, the modal it is specified to be. */}
      <S0906 result={critical} onClose={() => setCritical(null)} />
    </Screen>
  )
}
