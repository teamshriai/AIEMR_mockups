/**
 * S-09-05 · Result Detail & Trend — `/results/:id` · T2 · ARC-25
 *
 * "One result, its trend and what it means alongside it."
 *
 * AI-212's guardrail is why the numbers come first: "REFERENCE RANGES AND PRIOR
 * VALUE SHOWN" is the fallback, so the screen is built that way and the
 * interpretation sits beside it rather than in front of it.
 *
 * AI-109 drafts the narrative at G3 — attest, not merely confirm — because a
 * released report enters the legal record.
 *
 * Calm pass: the trend and the numbers are the surface. The series table
 * restates the chart point for point, so it is folded behind "values". The
 * ranking rationale and the one-axis footnote are `Why`s, and the G3 signal is
 * said once — on the action bar, where the act of attesting happens.
 */

import { useNavigate } from 'react-router-dom'

import { AIActionBar, Confidence, Diamond } from '@/components/ai'
import { TrendChart } from '@/components/charts'
import type { TrendPoint } from '@/components/charts'
import { Disclosure, Why } from '@/components/calm'
import { Alert, Button, Card, Chip, ClinicalFlag, KeyValue, Table, Td, Th, Tr } from '@/components/primitives'
import { RESULTS, RESULT_TRENDS, encounterForPatient, result as findResult } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { Screen } from '@/shell/Screen'

/** The narrative AI-109 drafts, per result — the finding, then what follows from it. */
const NARRATIVES: Record<string, string[]> = {
  'R-88410': [
    'Severe hyperkalaemia at 6.8 mmol/L, risen from 5.4 nine hours earlier. In the context of acute kidney injury and a ventilated septic patient this is an immediate cardiac risk.',
    'Urgent ECG and treatment are indicated; a repeat sample to exclude haemolysis should not delay treatment at this level.',
  ],
  'R-88402': [
    'CRP has risen from 96 to 184 mg/L over 48 hours on unchanged antibiotic cover.',
    'Taken with the increased oxygen requirement, this is a treatment-failure pattern rather than the expected downward trajectory at 72 hours.',
  ],
  'R-88405': [
    'Creatinine has risen 64 µmol/L in 24 hours, meeting stage 2 acute kidney injury by the KDIGO creatinine criterion.',
    'Two active prescriptions require renal dose adjustment.',
  ],
  'R-88210': [
    'TSH is within the target range on unchanged replacement, consistent with adequate dosing. No change is indicated; repeat in six months.',
  ],
}

const REF_BOUNDS: Record<string, { low: number; high: number }> = {
  'R-88410': { low: 3.5, high: 5.1 },
  'R-88402': { low: 0, high: 5 },
  'R-88405': { low: 62, high: 106 },
  'R-88210': { low: 0.4, high: 4.0 },
}

export function S0905({ id }: { id?: string }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const acknowledgements = useClinical((s) => s.acknowledgements)

  const r = RESULTS.some((x) => x.id === id) ? findResult(id!) : findResult('R-88410')
  const p = patient(r.patientId)
  const enc = encounterForPatient(p.id)
  const bounds = REF_BOUNDS[r.id]
  const series = RESULT_TRENDS[r.id] ?? []

  const points: TrendPoint[] = series.map((s, i) => ({
    at: s.at,
    value: s.value,
    flag:
      i === series.length - 1 && r.critical
        ? 'critical'
        : bounds && s.value > bounds.high
          ? 'high'
          : bounds && s.value < bounds.low
            ? 'low'
            : undefined,
  }))

  const acked = r.acknowledged || acknowledgements[r.id] !== undefined

  return (
    <Screen
      screenId="S-09-05"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'LOCKED', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      heading={r.test}
      subheading={
        <>
          <span className="tabular">
            {r.value} {r.unit}
          </span>{' '}
          · reference <span className="tabular">{r.refRange}</span> · reported {formatTime(r.reportedAt)}
        </>
      }
      chips={
        <>
          <ClinicalFlag flag={r.flag} />
          {r.critical && (
            <Chip tone={acked ? 'normal' : 'critical'} icon={acked ? 'Check' : 'TriangleAlert'}>
              {acked ? 'Acknowledged' : 'Unacknowledged'}
            </Chip>
          )}
        </>
      }
      actions={
        <>
          <Button icon="ArrowLeft" onClick={() => navigate('/results/inbox')}>
            Inbox
          </Button>
          {enc && (
            <Button
              tone="primary"
              icon="PenLine"
              onClick={() => navigate(enc.type === 'IP' ? `/ip/encounter/${enc.id}/note` : `/encounter/${enc.id}/note`)}
            >
              Document the action
            </Button>
          )}
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">The numbers</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Result">
                <span className="tabular font-semibold">
                  {r.value} {r.unit}
                </span>
              </KeyValue>
              <KeyValue label="Reference">
                <span className="tabular">{r.refRange}</span>
              </KeyValue>
              {r.priorValue && (
                <KeyValue label="Prior">
                  <span className="tabular">{r.priorValue}</span>
                </KeyValue>
              )}
              {r.delta && (
                <KeyValue label="Delta">
                  <span className="tabular font-medium">{r.delta}</span>
                </KeyValue>
              )}
              <KeyValue label="Reported">
                <span className="tabular">{formatDateTime(r.reportedAt)}</span>
              </KeyValue>
            </dl>
            <p className="mt-3 text-[0.86em] text-ink-3">
              These are the fallback and the authority — enough to act on without the interpretation.
            </p>
          </Card>

          <Why label="Why this result was ranked where it was">
            <p className="text-ink-2">{r.aiReason}</p>
            <p className="flex flex-wrap items-center gap-2 text-ink-3">
              <Diamond size={10} />
              AI-212 · ranks and shows the delta at G1. The chronological order in the inbox is one click away.
            </p>
            <Confidence band={r.band} />
          </Why>
        </div>
      }
      railTitle="Result"
    >
      <div className="space-y-5">
        {r.critical && !acked && (
          <Alert tone="critical" role="alert" title="This critical value has not been acknowledged">
            Acknowledgement is recorded against a named clinician and stops the escalation clock. It is separate from
            documenting what you did.
          </Alert>
        )}

        <Card className="p-5">
          {points.length > 1 ? (
            <TrendChart
              title={`${r.test} — ${p.name}`}
              unit={r.unit}
              points={points}
              refLow={bounds?.low}
              refHigh={bounds?.high}
              label={(d) => formatDateTime(d).replace('-2026', '')}
            />
          ) : (
            <div className="py-8 text-center">
              <p className="font-medium">No prior values to trend</p>
              <p className="mt-1 text-[0.92em] text-ink-3">
                This is the first result of its kind for this patient, so there is nothing to compare it against — which
                is also why the delta column is empty rather than zero.
              </p>
            </div>
          )}
        </Card>

        {/* AI-109's narrative, at G3 — attest, not merely confirm. */}
        {aiActive && NARRATIVES[r.id] && (
          <Card className="border-l-[3px] border-l-ai p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Diamond />
              Drafted interpretation
            </h2>
            <div className="mt-2.5 space-y-2 leading-relaxed text-ink-2">
              {NARRATIVES[r.id].map((para) => (
                <p key={para}>{para}</p>
              ))}
            </div>
            <AIActionBar
              className="mt-3"
              touchpointId={`result:${r.id}:narrative`}
              capabilityId="AI-109"
              gate="G3"
              band={r.band}
              score={0.84}
              explain={{
                touchpointId: `result:${r.id}:narrative`,
                capabilityId: 'AI-109',
                claim: 'A drafted interpretation of this result in its clinical context, for attestation before it enters the record.',
                confidence: 0.84,
                band: r.band,
                computedAt: formatTime(NOW),
                inputs: [
                  { label: `${r.test} ${r.value} ${r.unit}`, source: `Result ${r.id}` },
                  ...(r.priorValue ? [{ label: `Prior ${r.priorValue}`, source: 'Previous result' }] : []),
                  { label: 'Active problem list', source: `Problems for ${p.id}` },
                  { label: 'Active prescriptions', source: 'Medication record' },
                ],
                evidence: [r.aiReason],
                model: 'lab-narrative v2.3.1',
                limits: [
                  'Interprets one analyte in the context of the structured record.',
                  'It cannot know whether the sample was haemolysed or taken from the wrong arm.',
                  'At G3 it does not enter the record until a clinician attests to it by name.',
                  'Numeric results with reference ranges remain the fallback.',
                ],
              }}
            />
            <Why label="What attesting to this means" className="mt-2.5">
              <p className="text-ink-2">
                A G3 touchpoint needs your signature, not just your click — anything entering the legal record does.
                Until you attest, this draft is not in the record and nobody else can see it.
              </p>
            </Why>
          </Card>
        )}

        {/* The same points the chart already draws — folded, not repeated. */}
        {series.length > 0 && (
          <Disclosure label="values" count={series.length}>
            <Card className="overflow-hidden">
              <Table
                caption={`All ${r.test} results for this patient`}
                rowCount={`${series.length} results`}
                head={
                  <>
                    <Th>When</Th>
                    <Th>Value</Th>
                    <Th>Reference</Th>
                    <Th>Range</Th>
                  </>
                }
              >
                {[...points].reverse().map((pt) => (
                  <Tr key={pt.at.toISOString()}>
                    <Td className="tabular">{formatDateTime(pt.at)}</Td>
                    <Td className="tabular font-medium">
                      {pt.value} {r.unit}
                    </Td>
                    <Td className="tabular">{r.refRange}</Td>
                    <Td>
                      {pt.flag === 'critical' ? (
                        <Chip tone="critical" icon="TriangleAlert">
                          Critical
                        </Chip>
                      ) : pt.flag ? (
                        <Chip tone="abnormal" icon={pt.flag === 'high' ? 'ArrowUp' : 'ArrowDown'}>
                          {pt.flag === 'high' ? 'High' : 'Low'}
                        </Chip>
                      ) : (
                        <Chip tone="normal" icon="Check">
                          In range
                        </Chip>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Table>
            </Card>
          </Disclosure>
        )}

        <Why label="Why there is one measure on this chart">
          <p className="text-ink-2">
            One measure, one axis. A second analyte on a second scale would be a separate chart — a dual axis makes two
            unrelated trends look like they are tracking each other.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
