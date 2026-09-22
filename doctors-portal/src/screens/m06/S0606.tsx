/**
 * S-06-06 · Clinical Timeline — `/patient/:id/timeline` · T2 · ARC-25
 *
 * "The whole record, in time order, unsummarised."
 *
 * The one-liner is the design brief. AI-105 is available in Z6, but the spine
 * of the screen is deliberately the raw record — this is the screen the chart
 * summary's guardrail points at when it says the unsummarised record is always
 * one click away.
 */

import { useMemo, useState } from 'react'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { Button, Card, Chip, Icon, Tabs, cx } from '@/components/primitives'
import { timelineFor } from '@/data/clinical'
import type { TimelineEvent } from '@/data/clinical'
import { formatDate, formatDateTime, formatTime, NOW } from '@/data/format'
import { patientByAnyId } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

const KINDS: { key: TimelineEvent['kind'] | 'all'; label: string; icon: string }[] = [
  { key: 'all', label: 'Everything', icon: 'List' },
  { key: 'note', label: 'Notes', icon: 'FileText' },
  { key: 'result', label: 'Results', icon: 'FlaskConical' },
  { key: 'medication', label: 'Medication', icon: 'Pill' },
  { key: 'order', label: 'Orders', icon: 'ClipboardList' },
  { key: 'imaging', label: 'Imaging', icon: 'Scan' },
  { key: 'vitals', label: 'Observations', icon: 'Activity' },
]

export function S0606({ id }: { id?: string }) {
  const aiActive = useAI(selectAiActive)
  const p = patientByAnyId(id) ?? patientByAnyId('SD-P-03')!
  const [kind, setKind] = useState<string>('all')
  const [summaryOpen, setSummaryOpen] = useState(false)

  const events = timelineFor(p.id)
  const filtered = kind === 'all' ? events : events.filter((e) => e.kind === kind)

  /** Group by day, since a clinician reads a record by day, not by row. */
  const byDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = formatDate(e.at)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()]
  }, [filtered])

  return (
    <Screen
      screenId="S-06-06"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      chips={<Chip tone="neutral">{events.length} entries</Chip>}
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Summary</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              This screen is the unsummarised record on purpose. A summary is available, but it is the option here, not
              the default.
            </p>
            <Button
              className="mt-2.5 w-full"
              tone={summaryOpen ? 'secondary' : 'ai'}
              icon="Sparkles"
              disabled={!aiActive}
              onClick={() => setSummaryOpen((v) => !v)}
            >
              {summaryOpen ? 'Hide the summary' : 'Summarise this timeline'}
            </Button>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Entries by type</h3>
            <ul className="mt-2 space-y-1">
              {KINDS.filter((k) => k.key !== 'all').map((k) => {
                const n = events.filter((e) => e.kind === k.key).length
                return (
                  <li key={k.key} className="flex items-center justify-between gap-2 py-1">
                    <span className="flex items-center gap-2 text-[0.92em] text-ink-2">
                      <Icon name={k.icon} size={14} className="text-ink-3" />
                      {k.label}
                    </span>
                    <span className="tabular text-[0.9em] font-medium">{n}</span>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              Where AI touched the record
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Entries with an indigo marker had an AI touchpoint. Every one of them carries a recorded human
              disposition — the marker is disclosure, not credit.
            </p>
          </Card>
        </div>
      }
      railTitle="Timeline"
    >
      <div className="space-y-5">
        {aiActive && summaryOpen && (
          <Card className="border-l-[3px] border-l-ai p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Diamond />
                Timeline summary
              </h2>
              <div className="flex items-center gap-2">
                <Confidence band="MED" score={0.77} />
                <WhyLink
                  target={{
                    touchpointId: `timeline-${p.id}`,
                    capabilityId: 'AI-105',
                    claim: 'A chronological précis of this record, with the turning points named.',
                    confidence: 0.77,
                    band: 'MED',
                    computedAt: formatTime(NOW),
                    inputs: events.slice(0, 6).map((e) => ({ label: e.label, source: formatDateTime(e.at) })),
                    evidence: ['Assembled from the entries below — nothing outside this timeline.'],
                    model: 'chart-sum v3.4.0',
                    limits: [
                      'Summarises what is charted, in the order it was charted.',
                      'A late entry about an early event will read as late here.',
                      'The entries below are the authoritative version.',
                    ],
                  }}
                />
              </div>
            </div>
            <p className="mt-3 leading-relaxed text-ink-2">
              Admitted on 17-Sep and started on broad antibiotic cover the same afternoon. Imaging on 19-Sep confirmed a
              right lower lobe consolidation with no effusion. The turning point is overnight on 20/21-Sep: oxygen
              doubled at 04:20, the deterioration score reached 7 and rising, and CRP came back nearly doubled. The
              blood culture is still negative, so the organism is unknown at 72 hours.
            </p>
          </Card>
        )}

        <Tabs active={kind} onChange={setKind} tabs={KINDS.map((k) => ({ key: k.key, label: k.label }))} />

        {byDay.length === 0 ? (
          <Card className="p-10 text-center text-ink-2">
            Nothing of this type is recorded for this patient. Switch the filter, or choose Everything.
          </Card>
        ) : (
          <div className="space-y-5">
            {byDay.map(([day, dayEvents]) => (
              <section key={day}>
                <h2 className="tabular sticky top-0 z-10 mb-2 inline-block rounded-pill bg-glass-fill-strong px-3 py-1 text-[0.86em] font-semibold backdrop-blur-glass">
                  {day}
                </h2>
                <Card className="overflow-hidden">
                  <ol>
                    {dayEvents.map((e, i) => (
                      <li
                        key={`${e.at.toISOString()}-${i}`}
                        className={cx(
                          'flex gap-4 px-5 py-4',
                          i < dayEvents.length - 1 && 'border-b border-glass-hairline',
                        )}
                      >
                        <div className="flex flex-col items-center">
                          <span className="tabular mb-1.5 text-[0.8em] text-ink-3">{formatTime(e.at)}</span>
                          <span
                            className={cx(
                              'flex size-8 shrink-0 items-center justify-center rounded-pill',
                              e.ai ? 'bg-ai-soft text-ai' : 'bg-glass-fill-muted text-ink-3',
                            )}
                          >
                            <Icon name={ICON_FOR[e.kind] ?? 'Circle'} size={14} />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            {e.label}
                            {e.ai && (
                              <Chip tone="ai">
                                <Diamond size={9} />
                                {e.ai}
                              </Chip>
                            )}
                          </p>
                          <p className="mt-0.5 text-[0.92em] text-ink-2">{e.detail}</p>
                          <p className="mt-1 text-[0.84em] text-ink-3">{e.by}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              </section>
            ))}
          </div>
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
