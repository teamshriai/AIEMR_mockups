/**
 * S-06-02 · Patient Chart Summary — `/patient/:id/chart` · T2 · ARC-02
 *
 * "Catching up on a patient in thirty seconds."
 *
 * AI-105's guardrail is the design: "THE UNSUMMARISED RECORD IS ALWAYS ONE
 * CLICK AWAY." The click is the pill in the page header — it opens S-06-06,
 * the timeline, which is the record in full with no model between you and it.
 * Rendering that record a second time as a tab here was the same thing twice.
 *
 * Calm pass: the surface is today's slice of each list, the older rows fold
 * behind "earlier · N", and the summary opens at two lines.
 *
 * AI-901's guardrail: "returns nothing the caller cannot already read" — which
 * is why "Ask the record" searches this chart only.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { Confidence, WhyLink } from '@/components/ai'
import { CountPill, Disclosure, PillLink, ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { Button, Chip, ClinicalFlag, TextInput, cx } from '@/components/primitives'
import { ORDERS, PROBLEMS, RESULTS, VITALS, encounterForPatient, timelineFor } from '@/data/clinical'
import { formatDate, formatDateTime, formatTime, NOW } from '@/data/format'
import { patientByAnyId } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

const SUMMARIES: Record<string, { text: string; confidence: number; band: 'HIGH' | 'MED' | 'LOW' }> = {
  'SD-P-03': {
    text: 'Day 4 of an admission for right lower lobe community-acquired pneumonia. Treated with piperacillin-tazobactam since admission; no organism identified and blood cultures negative at 48 hours. He has deteriorated overnight — oxygen went from 2 L to 4 L at 04:20, NEWS2 is 7 and rising, and CRP has nearly doubled to 184. Creatinine has risen 64 in 24 hours, which affects two active prescriptions. A documented penicillin allergy constrains the antibiotic choice. PM-JAY funded, no discharge trajectory today.',
    confidence: 0.9,
    band: 'HIGH',
  },
  'SD-P-01': {
    text: 'Well 34-year-old with primary hypothyroidism diagnosed in 2019, on levothyroxine 75 mcg daily. Attending a routine six-monthly review. TSH on 18-Sep was 2.4 with a free T4 of 14.2, both within target, and her fatigue has improved since March. No red flags, no new medication, no admissions. Self-funding by UPI; ABHA linked.',
    confidence: 0.94,
    band: 'HIGH',
  },
  'SD-P-07': {
    text: 'Day 6 of an ICU admission for septic shock, ventilated and on noradrenaline. SOFA 11, stable over the last six hours. A critical potassium of 6.8 was reported 12 minutes ago, up from 5.4 — it has not been acknowledged and an ECG has just been ordered. Sulfa allergy documented. CGHS funded.',
    confidence: 0.86,
    band: 'HIGH',
  },
}

type Tab = 'overview' | 'problems' | 'results' | 'orders'
const TABS: readonly Tab[] = ['overview', 'problems', 'results', 'orders']

const isToday = (d: Date) => formatDate(d) === formatDate(NOW)

export function S0602({ id }: { id?: string }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const p = patientByAnyId(id) ?? patientByAnyId('SD-P-03')!
  const enc = encounterForPatient(p.id)

  const [tab, setTab] = useScope<Tab>(TABS, 'overview', 'tab')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [askQuery, setAskQuery] = useState('')

  const summary = SUMMARIES[p.id]
  const problems = PROBLEMS.filter((x) => x.patientId === p.id)
  const results = RESULTS.filter((r) => r.patientId === p.id)
  const orders = ORDERS.filter((o) => o.patientId === p.id)
  const vitals = VITALS[p.id] ?? []
  const events = timelineFor(p.id)

  const resultsToday = results.filter((r) => isToday(r.reportedAt))
  const resultsEarlier = results.filter((r) => !isToday(r.reportedAt))
  const ordersToday = orders.filter((o) => isToday(o.placedAt))
  const ordersEarlier = orders.filter((o) => !isToday(o.placedAt))

  const criticalToday = resultsToday.filter((r) => r.flag.includes('Critical')).length
  const openOrders = orders.filter((o) => o.status !== 'Resulted' && o.status !== 'Cancelled').length
  const activeProblems = problems.filter((x) => x.status === 'Open').length

  const recordPath = `/patient/${p.uhid}/timeline`

  return (
    <Screen
      screenId="S-06-02"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      heading="Chart"
      subheading={
        <>
          {resultsToday.length} {resultsToday.length === 1 ? 'result' : 'results'} today
          {criticalToday > 0 && <> · <span className="font-semibold text-critical">{criticalToday} critical</span></>}
          {' · '}
          {openOrders} {openOrders === 1 ? 'order' : 'orders'} open · {activeProblems} active{' '}
          {activeProblems === 1 ? 'problem' : 'problems'}
        </>
      }
      chips={enc && <Chip tone="neutral" className="tabular">{enc.encounterNo}</Chip>}
      actions={
        <>
          {/* AI-105's guardrail, as the one prominent link: the record, unsummarised, one click away. */}
          <PillLink to={recordPath}>Read the record, unsummarised</PillLink>
          {enc && (
            <Button
              tone="primary"
              icon="PenLine"
              onClick={() =>
                navigate(enc.type === 'IP' ? `/ip/encounter/${enc.id}/note` : `/encounter/${enc.id}/note`)
              }
            >
              Start note
            </Button>
          )}
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Chart tools" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="space-y-2">
              <Button
                tone={summaryOpen ? 'secondary' : 'ai'}
                className="w-full"
                icon="Sparkles"
                onClick={() => setSummaryOpen((v) => !v)}
                disabled={!aiActive}
              >
                {summaryOpen ? 'Hide the summary' : 'Catch me up'}
              </Button>
              <Button className="w-full" icon="Search" onClick={() => setAskOpen((v) => !v)} disabled={!aiActive}>
                Ask the record
              </Button>
              <Button className="w-full" icon="FileText" onClick={() => navigate(recordPath)}>
                Open the unsummarised record
              </Button>
            </div>
            <Why className="mt-3">
              <p className="text-ink-2">
                The unsummarised record is always one click away — that is AI-105&rsquo;s guardrail, not a preference.
                The summary can be hidden; the record cannot.
              </p>
              <p className="text-ink-2">
                &ldquo;Ask the record&rdquo; searches this chart only and returns nothing you could not already open
                (AI-901).
              </p>
            </Why>
          </SectionCard>

          {askOpen && (
            <SectionCard title="Ask the record" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
              <TextInput
                autoFocus
                value={askQuery}
                onChange={(e) => setAskQuery(e.target.value)}
                placeholder="When did the oxygen requirement change?"
              />
              {askQuery.trim().length > 4 && (
                <div className="mt-3 rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.9em]">
                  <p className="text-ink-2">
                    Nursing note at 04:25 records oxygen increased from 2 L to 4 L after saturations fell to 89%. The
                    flowsheet entry at 07:50 shows SpO₂ 92% on 4 L.
                  </p>
                  <p className="mt-2 text-[0.88em] text-ink-3">2 sources in this chart. Nothing outside it was searched.</p>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      }
      railTitle="Chart"
    >
      <div className="space-y-5">
        {/* AI-105's summary — two lines by default, with its provenance. */}
        {aiActive && summaryOpen && summary && (
          <SectionCard
            title="Catch me up"
            meta={<Confidence band={summary.band} score={summary.confidence} />}
            action={
              <WhyLink
                target={{
                  touchpointId: `chart-summary-${p.id}`,
                  capabilityId: 'AI-105',
                  claim: 'A summary of this record, assembled from the notes, results, orders and flowsheet.',
                  confidence: summary.confidence,
                  band: summary.band,
                  computedAt: formatTime(NOW),
                  inputs: events.slice(0, 5).map((e) => ({
                    label: e.label,
                    source: `${formatDateTime(e.at)} · ${e.by}`,
                  })),
                  evidence: [
                    'Assembled from the structured record and the signed notes.',
                    'It does not read unsigned drafts.',
                  ],
                  model: 'chart-sum v3.4.0',
                  limits: [
                    'Summarises what is charted. It cannot know what a clinician has not written down.',
                    'The unsummarised record remains one click away and is the authoritative version.',
                    'Does not summarise imaging pixels — only the reports.',
                  ],
                }}
              />
            }
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <p className={cx('leading-relaxed text-ink-2', !summaryExpanded && 'line-clamp-2')}>{summary.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                tone="tertiary"
                icon={summaryExpanded ? 'ChevronDown' : 'ChevronRight'}
                onClick={() => setSummaryExpanded((v) => !v)}
              >
                {summaryExpanded ? 'Show less' : 'Read more'}
              </Button>
              <Button size="sm" icon="FileText" onClick={() => navigate(recordPath)}>
                Read the record instead
              </Button>
              <Button size="sm" tone="tertiary" icon="X" onClick={() => setSummaryOpen(false)}>
                Dismiss
              </Button>
            </div>
          </SectionCard>
        )}

        <ScopeTabs
          value={tab}
          onChange={setTab}
          ariaLabel="Chart section"
          options={[
            { key: 'overview', label: 'Overview' },
            { key: 'problems', label: 'Problems', count: problems.length },
            { key: 'results', label: 'Results', count: resultsToday.length },
            { key: 'orders', label: 'Orders', count: ordersToday.length },
          ]}
        />

        {tab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title="Latest observations"
              meta={vitals[0] && <span className="tabular text-[0.86em] text-ink-3">charted {formatTime(vitals[0].at)}</span>}
            >
              {vitals.length === 0 ? (
                <p className="px-2 py-3 text-[0.92em] text-ink-2">
                  No observations charted, which is why the deterioration score abstains rather than scoring zero.
                </p>
              ) : (
                <dl className="divide-y divide-glass-hairline">
                  {vitals.map((v) => (
                    <div key={v.label} className="flex min-h-11 items-center justify-between gap-3 px-2 py-1.5">
                      <dt className="text-[0.92em] text-ink-2">{v.label}</dt>
                      <dd className="flex items-center gap-2">
                        <span className="tabular font-medium">{v.value}</span>
                        <ClinicalFlag flag={v.flag} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </SectionCard>

            <SectionCard
              title="Active problems"
              meta={<CountPill>{activeProblems}</CountPill>}
              action={enc && <PillLink to={`/encounter/${enc.id}/problems`}>Code</PillLink>}
            >
              <ul className="divide-y divide-glass-hairline">
                {problems
                  .filter((pr) => pr.status === 'Open')
                  .map((pr) => (
                    <Row
                      key={pr.id}
                      primary={pr.label}
                      context={`${pr.icd10} · onset ${pr.onset}`}
                    />
                  ))}
              </ul>
            </SectionCard>
          </div>
        )}

        {tab === 'problems' && (
          <SectionCard title="Problem list" meta={<CountPill>{problems.length}</CountPill>}>
            <ul className="divide-y divide-glass-hairline">
              {problems.map((pr) => (
                <Row
                  key={pr.id}
                  primary={pr.label}
                  context={`${pr.icd10} · SNOMED ${pr.snomed} · onset ${pr.onset}`}
                  status={<Chip tone={pr.status === 'Open' ? 'brand' : 'inactive'}>{pr.status}</Chip>}
                  onOpen={enc ? () => navigate(`/encounter/${enc.id}/problems`) : undefined}
                />
              ))}
            </ul>
          </SectionCard>
        )}

        {tab === 'results' && (
          <SectionCard title="Results" meta={<CountPill>{resultsToday.length} today</CountPill>}>
            {resultsToday.length === 0 ? (
              <p className="px-2 py-3 text-[0.92em] text-ink-2">No results have been reported today.</p>
            ) : (
              <ul className="divide-y divide-glass-hairline">
                {resultsToday.map((r) => (
                  <ResultRowItem key={r.id} r={r} onOpen={() => navigate(`/results/${r.id}`)} />
                ))}
              </ul>
            )}
            {resultsEarlier.length > 0 && (
              <Disclosure label="earlier" count={resultsEarlier.length} className="mt-1">
                <ul className="divide-y divide-glass-hairline">
                  {resultsEarlier.map((r) => (
                    <ResultRowItem key={r.id} r={r} dated onOpen={() => navigate(`/results/${r.id}`)} />
                  ))}
                </ul>
              </Disclosure>
            )}
          </SectionCard>
        )}

        {tab === 'orders' && (
          <SectionCard title="Orders" meta={<CountPill>{ordersToday.length} today</CountPill>}>
            {ordersToday.length === 0 ? (
              <p className="px-2 py-3 text-[0.92em] text-ink-2">No orders have been placed today.</p>
            ) : (
              <ul className="divide-y divide-glass-hairline">
                {ordersToday.map((o) => (
                  <OrderRowItem key={o.id} o={o} />
                ))}
              </ul>
            )}
            {ordersEarlier.length > 0 && (
              <Disclosure label="earlier" count={ordersEarlier.length} className="mt-1">
                <ul className="divide-y divide-glass-hairline">
                  {ordersEarlier.map((o) => (
                    <OrderRowItem key={o.id} o={o} dated />
                  ))}
                </ul>
              </Disclosure>
            )}
          </SectionCard>
        )}
      </div>
    </Screen>
  )
}

/** One calm row: a lead, the primary line, a quiet context line, the status on the right. */
function Row({
  lead,
  primary,
  context,
  status,
  onOpen,
}: {
  lead?: ReactNode
  primary: ReactNode
  context?: ReactNode
  status?: ReactNode
  onOpen?: () => void
}) {
  const inner = (
    <>
      {lead && <span className="tabular w-14 shrink-0 pt-0.5 text-[0.84em] text-ink-3">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{primary}</span>
        {context && <span className="tabular block truncate text-[0.86em] text-ink-3">{context}</span>}
      </span>
      {status && <span className="flex shrink-0 items-center gap-1.5">{status}</span>}
    </>
  )
  const cls = 'flex min-h-11 w-full items-center gap-3 rounded-panel px-2 py-2 text-left'
  return (
    <li>
      {onOpen ? (
        <button type="button" onClick={onOpen} className={cx(cls, 'hover:bg-glass-fill-hover')}>
          {inner}
        </button>
      ) : (
        <div className={cls}>{inner}</div>
      )}
    </li>
  )
}

function ResultRowItem({
  r,
  dated,
  onOpen,
}: {
  r: (typeof RESULTS)[number]
  dated?: boolean
  onOpen: () => void
}) {
  return (
    <Row
      lead={dated ? formatDate(r.reportedAt) : formatTime(r.reportedAt)}
      primary={r.test}
      context={`${r.value} ${r.unit} · ref ${r.refRange}`}
      status={<ClinicalFlag flag={r.flag} />}
      onOpen={onOpen}
    />
  )
}

function OrderRowItem({ o, dated }: { o: (typeof ORDERS)[number]; dated?: boolean }) {
  return (
    <Row
      lead={dated ? formatDate(o.placedAt) : formatTime(o.placedAt)}
      primary={o.item}
      context={`${o.category} · ${o.placedBy}`}
      status={
        <Chip
          tone={o.status === 'Overdue' ? 'abnormal' : o.status === 'Resulted' ? 'normal' : 'neutral'}
          icon={o.status === 'Overdue' ? 'Clock' : o.status === 'Resulted' ? 'Check' : 'CircleDot'}
        >
          {o.status}
        </Chip>
      }
    />
  )
}
