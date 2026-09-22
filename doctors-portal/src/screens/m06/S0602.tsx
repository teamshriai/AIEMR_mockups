/**
 * S-06-02 · Patient Chart Summary — `/patient/:id/chart` · T2 · ARC-02
 *
 * "Catching up on a patient in thirty seconds."
 *
 * AI-105's guardrail is the design: "THE UNSUMMARISED RECORD IS ALWAYS ONE
 * CLICK AWAY." So the summary is a panel you can collapse, sitting next to a
 * tab that shows the record in full, and the button that opens it is never
 * buried.
 *
 * AI-901's guardrail: "returns nothing the caller cannot already read" — which
 * is why "Ask the record" searches this chart only.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import {
  Button,
  Card,
  CardHeader,
  Chip,
  ClinicalFlag,
  Icon,
  KeyValue,
  Table,
  Tabs,
  Td,
  Th,
  TextInput,
  Tr,
  cx,
} from '@/components/primitives'
import { ORDERS, PROBLEMS, RESULTS, VITALS, encounterForPatient, timelineFor } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
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

export function S0602({ id }: { id?: string }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const p = patientByAnyId(id) ?? patientByAnyId('SD-P-03')!
  const enc = encounterForPatient(p.id)

  const [tab, setTab] = useState('summary')
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [askOpen, setAskOpen] = useState(false)
  const [askQuery, setAskQuery] = useState('')

  const summary = SUMMARIES[p.id]
  const problems = PROBLEMS.filter((x) => x.patientId === p.id)
  const results = RESULTS.filter((r) => r.patientId === p.id)
  const orders = ORDERS.filter((o) => o.patientId === p.id)
  const vitals = VITALS[p.id] ?? []
  const events = timelineFor(p.id)

  return (
    <Screen
      screenId="S-06-02"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={enc && <Chip tone="neutral" className="tabular">{enc.encounterNo}</Chip>}
      actions={
        <>
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
          <Button icon="Activity" onClick={() => navigate(`/patient/${p.uhid}/timeline`)}>
            Timeline
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          {/* The two Z6 actions the spec names, and their guardrails. */}
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Chart tools</h3>
            <div className="mt-2.5 space-y-2">
              <Button
                tone={summaryOpen ? 'secondary' : 'ai'}
                className="w-full"
                icon="Sparkles"
                onClick={() => setSummaryOpen((v) => !v)}
                disabled={!aiActive}
              >
                {summaryOpen ? 'Hide the summary' : 'Catch me up'}
              </Button>
              <Button
                className="w-full"
                icon="Search"
                onClick={() => setAskOpen((v) => !v)}
                disabled={!aiActive}
              >
                Ask the record
              </Button>
              <Button
                className="w-full"
                icon="FileText"
                onClick={() => {
                  setSummaryOpen(false)
                  setTab('timeline')
                }}
              >
                Open the unsummarised record
              </Button>
            </div>
            <p className="mt-3 text-[0.86em] text-ink-3">
              The unsummarised record is always one click away — that is AI-105&rsquo;s guardrail, not a preference.
            </p>
          </Card>

          {askOpen && (
            <Card className="border-l-[3px] border-l-ai p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ai">
                <Diamond size={10} />
                AI-901 · natural-language record search
              </p>
              <TextInput
                className="mt-2"
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
                  <p className="mt-2 text-[0.88em] text-ink-3">
                    2 sources in this chart. Nothing outside it was searched — the search returns nothing you could not
                    already open.
                  </p>
                </div>
              )}
            </Card>
          )}

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">At a glance</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Payer">{p.payer}</KeyValue>
              <KeyValue label="Allergies">
                {p.allergies.length ? (
                  <span className="font-semibold text-critical">{p.allergies.join(', ')}</span>
                ) : (
                  'None known'
                )}
              </KeyValue>
              <KeyValue label="ABHA">{p.abha ?? '⊘ not linked'}</KeyValue>
              {p.weightKg && <KeyValue label="Weight">{p.weightKg} kg</KeyValue>}
              <KeyValue label="Active problems">{problems.filter((x) => x.status === 'Active').length}</KeyValue>
            </dl>
          </Card>
        </div>
      }
      railTitle="Chart"
    >
      <div className="space-y-5">
        {/* AI-105's summary, collapsible, with its provenance. */}
        {aiActive && summaryOpen && summary && (
          <Card className="border-l-[3px] border-l-ai p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Diamond />
                Catch me up
              </h2>
              <div className="flex items-center gap-2">
                <Confidence band={summary.band} score={summary.confidence} />
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
              </div>
            </div>
            <p className="mt-3 leading-relaxed text-ink-2">{summary.text}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" icon="FileText" onClick={() => setTab('timeline')}>
                Read the record instead
              </Button>
              <Button size="sm" tone="tertiary" icon="X" onClick={() => setSummaryOpen(false)}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* C-28 tabs, the ARC-02 shape. */}
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'summary', label: 'Overview' },
            { key: 'problems', label: 'Problems', badge: <Chip tone="neutral">{problems.length}</Chip> },
            { key: 'results', label: 'Results', badge: <Chip tone="neutral">{results.length}</Chip> },
            { key: 'orders', label: 'Orders', badge: <Chip tone="neutral">{orders.length}</Chip> },
            { key: 'timeline', label: 'Record, unsummarised' },
          ]}
        />

        {tab === 'summary' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Latest observations" subtitle={vitals[0] ? `charted ${formatTime(vitals[0].at)}` : undefined} icon="Activity" />
              <dl className="divide-y divide-glass-hairline px-5 pb-4">
                {vitals.map((v) => (
                  <div key={v.label} className="flex items-center justify-between gap-3 py-2">
                    <dt className="text-[0.92em] text-ink-2">{v.label}</dt>
                    <dd className="flex items-center gap-2">
                      <span className="tabular font-medium">{v.value}</span>
                      <ClinicalFlag flag={v.flag} />
                    </dd>
                  </div>
                ))}
                {vitals.length === 0 && (
                  <p className="py-4 text-[0.9em] text-ink-3">
                    No observations charted. This is why the deterioration score abstains rather than scoring zero.
                  </p>
                )}
              </dl>
            </Card>

            <Card>
              <CardHeader title="Active problems" icon="Stethoscope" />
              <ul className="divide-y divide-glass-hairline px-5 pb-4">
                {problems.map((pr) => (
                  <li key={pr.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{pr.label}</span>
                      <span className="tabular block text-[0.86em] text-ink-3">
                        {pr.icd10} · onset {pr.onset}
                      </span>
                    </span>
                    <Chip tone={pr.status === 'Active' ? 'brand' : 'inactive'}>{pr.status}</Chip>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'problems' && (
          <Card className="overflow-hidden">
            <Table
              caption="Problem list"
              rowCount={`${problems.length} problems`}
              head={
                <>
                  <Th>Problem</Th>
                  <Th>ICD-10</Th>
                  <Th className="hidden md:table-cell">SNOMED</Th>
                  <Th>Onset</Th>
                  <Th>Status</Th>
                </>
              }
            >
              {problems.map((pr) => (
                <Tr key={pr.id} onClick={() => enc && navigate(`/encounter/${enc.id}/problems`)}>
                  <Td className="font-medium">{pr.label}</Td>
                  <Td className="tabular">{pr.icd10}</Td>
                  <Td className="tabular hidden md:table-cell">{pr.snomed}</Td>
                  <Td className="tabular">{pr.onset}</Td>
                  <Td>
                    <Chip tone={pr.status === 'Active' ? 'brand' : 'inactive'}>{pr.status}</Chip>
                  </Td>
                </Tr>
              ))}
            </Table>
          </Card>
        )}

        {tab === 'results' && (
          <Card className="overflow-hidden">
            <Table
              caption="Results for this patient"
              rowCount={`${results.length} results`}
              head={
                <>
                  <Th>Test</Th>
                  <Th>Value</Th>
                  <Th className="hidden md:table-cell">Reference</Th>
                  <Th>Flag</Th>
                  <Th className="hidden md:table-cell">Reported</Th>
                </>
              }
            >
              {results.map((r) => (
                <Tr key={r.id} onClick={() => navigate(`/results/${r.id}`)}>
                  <Td className="font-medium">{r.test}</Td>
                  <Td className="tabular">
                    {r.value} {r.unit}
                  </Td>
                  <Td className="tabular hidden md:table-cell">{r.refRange}</Td>
                  <Td>
                    <ClinicalFlag flag={r.flag} />
                  </Td>
                  <Td className="tabular hidden md:table-cell">{formatDateTime(r.reportedAt)}</Td>
                </Tr>
              ))}
            </Table>
          </Card>
        )}

        {tab === 'orders' && (
          <Card className="overflow-hidden">
            <Table
              caption="Orders for this patient"
              rowCount={`${orders.length} orders`}
              head={
                <>
                  <Th>Item</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                  <Th className="hidden md:table-cell">Placed</Th>
                </>
              }
            >
              {orders.map((o) => (
                <Tr key={o.id}>
                  <Td className="font-medium">{o.item}</Td>
                  <Td>
                    <Chip tone="neutral">{o.category}</Chip>
                  </Td>
                  <Td>
                    <Chip tone={o.status === 'Overdue' ? 'abnormal' : o.status === 'Resulted' ? 'normal' : 'neutral'}>
                      {o.status}
                    </Chip>
                  </Td>
                  <Td className="tabular hidden md:table-cell">{formatDateTime(o.placedAt)}</Td>
                </Tr>
              ))}
            </Table>
          </Card>
        )}

        {tab === 'timeline' && (
          <Card className="p-5">
            <h2 className="font-semibold">The record, in time order, unsummarised</h2>
            <p className="mt-1 text-[0.9em] text-ink-3">
              No model has touched this view. It is what was written, when, and by whom.
            </p>
            <ol className="mt-4 space-y-0">
              {events.map((e, i) => (
                <li key={`${e.at.toISOString()}-${i}`} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className={cx(
                        'mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-pill',
                        e.ai ? 'bg-ai-soft text-ai' : 'bg-glass-fill-muted text-ink-3',
                      )}
                    >
                      <Icon name={ICON_FOR[e.kind]} size={13} />
                    </span>
                    {i < events.length - 1 && <span className="my-1 w-px flex-1 bg-glass-hairline" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-5">
                    <p className="font-medium">{e.label}</p>
                    <p className="mt-0.5 text-[0.92em] text-ink-2">{e.detail}</p>
                    <p className="tabular mt-1 text-[0.84em] text-ink-3">
                      {formatDateTime(e.at)} · {e.by}
                      {e.ai && <span className="ml-2 text-ai">{e.ai}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </Screen>
  )
}

const ICON_FOR: Record<string, string> = {
  note: 'FileText',
  order: 'ClipboardList',
  result: 'FlaskConical',
  medication: 'Pill',
  vitals: 'Activity',
  admission: 'BedDouble',
  imaging: 'Scan',
  ai: 'Sparkles',
}
