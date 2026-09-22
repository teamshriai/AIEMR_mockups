/**
 * S-18-20 · Stroke Outcomes, mRS-90 & Registry — `/stroke/registry` · T2 · ARC-19
 *
 * "Ninety days later, still chasing the call the award depends on."
 *
 * The one-liner is the honest version of an outcomes screen: the clinical work
 * finished three months ago, and what is left is a phone call somebody has to
 * make. AI-708 prioritises the outreach; the fallback is a scheduled call list,
 * which is what most registries actually run on.
 */

import { useState } from 'react'

import { Diamond, RowBadge } from '@/components/ai'
import { IndicatorBars } from '@/components/charts'
import {
  Alert,
  Button,
  Card,
  Chip,
  Icon,
  KeyValue,
  Select,
  Table,
  Td,
  Th,
  Tr,
  cx,
} from '@/components/primitives'
import { OUTCOMES, REGISTRY_INDICATORS } from '@/data/stroke'
import type { OutcomeRow } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

const MRS_LABEL: Record<number, string> = {
  0: 'No symptoms',
  1: 'No significant disability',
  2: 'Slight disability, independent',
  3: 'Moderate, walks unaided',
  4: 'Moderately severe, needs help',
  5: 'Severe, bedridden',
  6: 'Died',
}

export function S1820() {
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const [period, setPeriod] = useState('Last 90 days')
  const [called, setCalled] = useState<string[]>([])

  const outstanding = OUTCOMES.filter(
    (o) => o.mrs90 === null && o.followUpStatus !== 'Window open' && !called.includes(o.caseNo),
  )
  const complete = OUTCOMES.filter((o) => o.mrs90 !== null || called.includes(o.caseNo))
  const completeness = Math.round((complete.length / OUTCOMES.length) * 100)

  const indicators = REGISTRY_INDICATORS.map((i) => {
    /** Fraction of the target, capped for the bar. */
    const numeric = parseFloat(i.value)
    const targetNumeric = parseFloat(i.target.replace(/[^\d.]/g, ''))
    const lowerIsBetter = i.target.startsWith('≤')
    const fraction = lowerIsBetter
      ? Math.min(1.4, numeric / targetNumeric)
      : Math.min(1.4, numeric / targetNumeric)
    return { label: i.label, value: i.value, target: i.target, met: i.met, fraction: Math.min(1, fraction) }
  })

  return (
    <Screen
      screenId="S-18-20"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      chips={
        <>
          <Chip tone={completeness >= 90 ? 'normal' : 'caution'}>{completeness}% follow-up complete</Chip>
          {outstanding.length > 0 && <Chip tone="abnormal">{outstanding.length} calls outstanding</Chip>}
        </>
      }
      actions={
        <>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Reporting period"
            className="min-h-9 w-auto py-1.5 text-[0.9em]"
          >
            {['Last 30 days', 'Last 90 days', 'This financial year'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
          <Button
            icon="Download"
            onClick={() =>
              toast({
                tone: 'info',
                title: 'Registry export prepared',
                detail: 'Every export is an audited event. The recipient and the fields are recorded.',
              })
            }
          >
            Export
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Completeness</h3>
            <p className="tabular mt-1 text-4xl font-bold">{completeness}%</p>
            <p className="text-[0.9em] text-ink-3">target 90%</p>
            <dl className="mt-3 divide-y divide-glass-hairline">
              <KeyValue label="Cases in period">{OUTCOMES.length}</KeyValue>
              <KeyValue label="mRS recorded">{complete.length}</KeyValue>
              <KeyValue label="Calls outstanding">{outstanding.length}</KeyValue>
            </dl>
            <p className="mt-2.5 text-[0.88em] text-ink-2">
              Incomplete follow-up is the single commonest reason a stroke centre loses its accreditation, and it has
              nothing to do with the quality of the care.
            </p>
          </Card>

          {aiActive && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                <Diamond size={10} />
                AI-708 · outreach priority
              </p>
              <p className="mt-1.5 text-[0.9em] text-ink-2">
                Orders the call list by how close each case is to the end of its 90-day window, and suggests which
                contact to try. The fallback is a scheduled call list in date order.
              </p>
            </Card>
          )}
        </div>
      }
      railTitle="Registry"
    >
      <div className="space-y-5">
        {outstanding.length > 0 && (
          <Alert tone="caution" title={`${outstanding.length} follow-up call${outstanding.length === 1 ? '' : 's'} outstanding`}>
            {outstanding[0].outreachReason} Once the 90-day window closes the outcome cannot be recorded at all, and
            the case counts against completeness for good.
          </Alert>
        )}

        <ScreenSection title="Indicators" subtitle="Against target, one measure per bar">
          <Card className="p-5">
            <IndicatorBars rows={indicators} />
            <p className="mt-4 flex items-start gap-2 text-[0.86em] text-ink-3">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              Two are missed: DIDO at the spokes, and follow-up completeness. Both are coordination problems rather
              than clinical ones, which is the whole argument for the module.
            </p>
          </Card>
        </ScreenSection>

        <ScreenSection title="Cases and outcomes" subtitle="mRS at 90 days, and who still needs a call">
          <Card className="overflow-hidden">
            <Table
              caption="Stroke cases and their 90-day outcomes"
              rowCount={`${OUTCOMES.length} cases · ${complete.length} with an outcome recorded`}
              head={
                <>
                  <Th>Case</Th>
                  <Th>Site</Th>
                  <Th>Treated with</Th>
                  <Th>DTN</Th>
                  <Th className="hidden md:table-cell">Door to groin</Th>
                  <Th>mRS at 90 days</Th>
                  <Th>Follow-up</Th>
                </>
              }
            >
              {OUTCOMES.map((o: OutcomeRow) => {
                const done = o.mrs90 !== null || called.includes(o.caseNo)
                return (
                  <Tr key={o.caseNo} className={cx(!done && o.followUpStatus !== 'Window open' && 'bg-caution-soft/30')}>
                    <Td>
                      <span className="tabular block font-medium">{o.caseNo}</span>
                      <span className="block text-[0.86em] text-ink-3">{o.patientInitials}</span>
                    </Td>
                    <Td className="tabular">{o.site}</Td>
                    <Td>
                      <Chip tone={o.treatedWith === 'Conservative' ? 'inactive' : 'brand'}>{o.treatedWith}</Chip>
                    </Td>
                    <Td className="tabular">{o.dtnMin ?? '—'}</Td>
                    <Td className="tabular hidden md:table-cell">{o.ditgMin ?? '—'}</Td>
                    <Td>
                      {o.mrs90 !== null ? (
                        <span className="flex flex-col">
                          <span className="tabular font-semibold">{o.mrs90}</span>
                          <span className="text-[0.84em] text-ink-3">{MRS_LABEL[o.mrs90]}</span>
                        </span>
                      ) : called.includes(o.caseNo) ? (
                        <Chip tone="normal" icon="Check">
                          collected
                        </Chip>
                      ) : (
                        <Chip tone="caution" icon="CircleHelp">
                          not yet
                        </Chip>
                      )}
                    </Td>
                    <Td>
                      {done ? (
                        <Chip tone="normal" icon="Check">
                          Complete
                        </Chip>
                      ) : o.followUpStatus === 'Window open' ? (
                        <Chip tone="neutral" icon="Clock">
                          Window open
                        </Chip>
                      ) : (
                        <span className="flex flex-col gap-1.5">
                          {aiActive && o.outreachReason ? (
                            <RowBadge
                              label={o.followUpStatus}
                              reason={o.outreachReason}
                              tone={o.followUpStatus.startsWith('Unreachable') ? 'abnormal' : 'caution'}
                              band="HIGH"
                            />
                          ) : (
                            <Chip tone={o.followUpStatus.startsWith('Unreachable') ? 'abnormal' : 'caution'}>
                              {o.followUpStatus}
                            </Chip>
                          )}
                          <Button
                            size="sm"
                            tone="primary"
                            icon="PhoneCall"
                            onClick={(e) => {
                              e.stopPropagation()
                              setCalled((c) => [...c, o.caseNo])
                              toast({
                                tone: 'success',
                                title: `${o.patientInitials} reached`,
                                detail: 'mRS recorded. Completeness has moved.',
                              })
                            }}
                          >
                            Call now
                          </Button>
                        </span>
                      )}
                    </Td>
                  </Tr>
                )
              })}
            </Table>
          </Card>
        </ScreenSection>

        <Card className="p-4">
          <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">What gets exported</h3>
          <p className="mt-1.5 text-[0.9em] text-ink-2">
            Clocks, treatment, outcome and site — with de-identified case references. Every export is a class-3 audit
            event: the recipient, the fields and the reason are all recorded, because a registry submission is a
            disclosure of patient data however aggregated it looks.
          </p>
        </Card>
      </div>
    </Screen>
  )
}
