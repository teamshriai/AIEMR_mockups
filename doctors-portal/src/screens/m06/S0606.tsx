/**
 * S-06-06 · Clinical Timeline — `/patient/:id/timeline` · T2 · ARC-25
 *
 * "The whole record, in time order, unsummarised."
 *
 * The one-liner is the design brief. AI-105 is available in Z6, but the spine
 * of the screen is deliberately the raw record — this is the screen the chart
 * summary's guardrail points at when it says the unsummarised record is always
 * one click away.
 *
 * Calm pass: today is open, every earlier day is behind one "earlier days"
 * fold, and an AI touch on an entry is one quiet word rather than a chip.
 */

import { useMemo, useState } from 'react'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { CountPill, Disclosure, ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { Button, Icon, cx } from '@/components/primitives'
import { timelineFor } from '@/data/clinical'
import type { TimelineEvent } from '@/data/clinical'
import { formatDate, formatDateTime, formatTime, NOW } from '@/data/format'
import { patientByAnyId } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

type Kind = TimelineEvent['kind'] | 'all'

const KINDS: { key: Kind; label: string; icon: string }[] = [
  { key: 'all', label: 'Everything', icon: 'List' },
  { key: 'note', label: 'Notes', icon: 'FileText' },
  { key: 'result', label: 'Results', icon: 'FlaskConical' },
  { key: 'medication', label: 'Medication', icon: 'Pill' },
  { key: 'order', label: 'Orders', icon: 'ClipboardList' },
  { key: 'imaging', label: 'Imaging', icon: 'Scan' },
  { key: 'vitals', label: 'Observations', icon: 'Activity' },
]
const KIND_KEYS = KINDS.map((k) => k.key)

export function S0606({ id }: { id?: string }) {
  const aiActive = useAI(selectAiActive)
  const p = patientByAnyId(id) ?? patientByAnyId('SD-P-03')!
  const [kind, setKind] = useScope<Kind>(KIND_KEYS, 'all', 'kind')
  const [summaryOpen, setSummaryOpen] = useState(false)

  const events = timelineFor(p.id)
  const filtered = kind === 'all' ? events : events.filter((e) => e.kind === kind)
  const today = formatDate(NOW)
  const todayCount = events.filter((e) => formatDate(e.at) === today).length
  const aiTouched = events.filter((e) => e.ai).length

  /** Group by day, since a clinician reads a record by day, not by row. */
  const byDay = useMemo(() => {
    const map = new Map<string, TimelineEvent[]>()
    for (const e of filtered) {
      const key = formatDate(e.at)
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return [...map.entries()]
  }, [filtered])

  const todayEvents = byDay.find(([day]) => day === today)?.[1] ?? []
  const earlierDays = byDay.filter(([day]) => day !== today)

  return (
    <Screen
      screenId="S-06-06"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      heading="Timeline"
      subheading={
        <>
          {todayCount} {todayCount === 1 ? 'entry' : 'entries'} today · {events.length} in the record · unsummarised
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Summary" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <Button
              className="w-full"
              tone={summaryOpen ? 'secondary' : 'ai'}
              icon="Sparkles"
              disabled={!aiActive}
              onClick={() => setSummaryOpen((v) => !v)}
            >
              {summaryOpen ? 'Hide the summary' : 'Summarise this timeline'}
            </Button>
            <Why className="mt-3">
              <p className="text-ink-2">
                This screen is the unsummarised record on purpose. A summary is available, but it is the option here,
                not the default.
              </p>
              <p className="text-ink-2">
                Where AI touched the record: {aiTouched} {aiTouched === 1 ? 'entry carries' : 'entries carry'} the word
                &ldquo;AI-assisted&rdquo;. Every one of them has a recorded human disposition — the word is disclosure,
                not credit.
              </p>
            </Why>
          </SectionCard>
        </div>
      }
      railTitle="Timeline"
    >
      <div className="space-y-5">
        {aiActive && summaryOpen && (
          <SectionCard
            title="Timeline summary"
            meta={<Confidence band="MED" score={0.77} />}
            action={
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
            }
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <p className="leading-relaxed text-ink-2">
              Admitted on 17-Sep and started on broad antibiotic cover the same afternoon. Imaging on 19-Sep confirmed a
              right lower lobe consolidation with no effusion. The turning point is overnight on 20/21-Sep: oxygen
              doubled at 04:20, the deterioration score reached 7 and rising, and CRP came back nearly doubled. The
              blood culture is still negative, so the organism is unknown at 72 hours.
            </p>
          </SectionCard>
        )}

        <ScopeTabs
          value={kind}
          onChange={setKind}
          ariaLabel="Entry type"
          options={KINDS.map((k) => ({
            key: k.key,
            label: k.label,
            icon: k.key === 'all' ? undefined : k.icon,
            count: k.key === 'all' ? undefined : events.filter((e) => e.kind === k.key).length,
          }))}
        />

        {byDay.length === 0 ? (
          <p className="px-1 py-6 text-center text-ink-2">
            Nothing of this type is recorded for this patient. Switch the filter, or choose Everything.
          </p>
        ) : (
          <>
            <SectionCard title="Today" meta={<CountPill>{todayEvents.length}</CountPill>}>
              {todayEvents.length === 0 ? (
                <p className="px-2 py-3 text-[0.92em] text-ink-2">
                  Nothing {kind === 'all' ? '' : 'of this type '}has been recorded today. Earlier days are below.
                </p>
              ) : (
                <DayList events={todayEvents} />
              )}
            </SectionCard>

            {earlierDays.length > 0 && (
              <Disclosure label="earlier days" count={earlierDays.length}>
                <div className="space-y-4">
                  {earlierDays.map(([day, dayEvents]) => (
                    <SectionCard key={day} title={day} meta={<CountPill>{dayEvents.length}</CountPill>}>
                      <DayList events={dayEvents} />
                    </SectionCard>
                  ))}
                </div>
              </Disclosure>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}

/** One day's entries. The row is the entry; provenance is one quiet word. */
function DayList({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="divide-y divide-glass-hairline">
      {events.map((e, i) => (
        <li key={`${e.at.toISOString()}-${i}`} className="flex min-h-11 gap-3 px-2 py-3">
          <span className="tabular w-12 shrink-0 pt-0.5 text-[0.84em] text-ink-3">{formatTime(e.at)}</span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-glass-fill-muted text-ink-3">
            <Icon name={ICON_FOR[e.kind] ?? 'Circle'} size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={cx('flex flex-wrap items-center gap-1.5 font-medium')}>
              {/* The ◆ only where the entry IS an AI entry — once, on the header. */}
              {e.kind === 'ai' && <Diamond size={9} />}
              {e.label}
            </span>
            <span className="mt-0.5 block text-[0.92em] text-ink-2">{e.detail}</span>
            <span className="mt-1 block text-[0.84em] text-ink-3">
              {e.by}
              {e.ai && ' · AI-assisted'}
            </span>
          </span>
        </li>
      ))}
    </ol>
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
