/**
 * S-09-08 · Duplicate & Unnecessary Test Review — `/orders/stewardship` · T2 · ARC-08
 *
 * "Which tests are being ordered that need not be."
 *
 * An approval queue with a recommended disposition per item (ARC-08), where
 * the recommendation is AI-304's at G2. Disagreeing needs a reason from the
 * fixed five — which is the mechanism by which a wrong rule gets found, so the
 * screen says so rather than treating rejection as noise.
 */

import { useState } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { AIActionBar, Diamond } from '@/components/ai'
import { Alert, Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { ORDERS } from '@/data/clinical'
import type { OrderRow } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import { formatRupees } from '@/data/format'
import { patient } from '@/data/kit'
import { useAI } from '@/store/ai'
import { Screen, ScreenSection } from '@/shell/Screen'

/** What a repeat costs, from the §8.4 tariff card. */
const UNIT_COST: Record<string, number> = { CRP: 480, CBC: 350, 'Serum creatinine': 320, 'Blood culture': 1200 }

export function S0908() {
  const [aiSort, setAiSort] = useState(true)
  const dispositions = useAI((s) => s.dispositions)

  const flagged = ORDERS.filter((o) => o.duplicateReason)
  const rows = aiSort
    ? [...flagged].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    : [...flagged].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())

  const actioned = flagged.filter((o) => dispositions[`stewardship:${o.id}`])
  const avoided = actioned
    .filter((o) => dispositions[`stewardship:${o.id}`].disposition !== 'Rejected')
    .reduce((sum, o) => sum + (UNIT_COST[o.item] ?? 400), 0)

  const columns: WorklistColumn<OrderRow>[] = [
    {
      key: 'patient',
      label: 'Patient',
      cell: (o) => {
        const p = patient(o.patientId)
        return (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="tabular block text-[0.86em] text-ink-3">{p.bed ?? 'outpatient'}</span>
          </span>
        )
      },
    },
    { key: 'item', label: 'Test', cell: (o) => <span className="font-medium">{o.item}</span> },
    {
      key: 'placed',
      label: 'Placed',
      cell: (o) => <span className="tabular text-[0.9em]">{formatDateTime(o.placedAt)}</span>,
    },
    {
      key: 'cost',
      label: 'If avoided',
      secondary: true,
      cell: (o) => <span className="tabular">{formatRupees(UNIT_COST[o.item] ?? 400)}</span>,
    },
    {
      key: 'disposition',
      label: 'Your decision',
      cell: (o) => {
        const d = dispositions[`stewardship:${o.id}`]
        return d ? (
          <Chip tone={d.disposition === 'Rejected' ? 'caution' : 'normal'} icon={d.disposition === 'Rejected' ? 'X' : 'Check'}>
            {d.disposition}
          </Chip>
        ) : (
          <Chip tone="ai">
            <Diamond size={9} />
            awaiting
          </Chip>
        )
      },
    },
  ]

  return (
    <Screen
      screenId="S-09-08"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-LOW']}
      chips={
        <>
          <Chip tone="neutral">{flagged.length} flagged</Chip>
          {avoided > 0 && (
            <Chip tone="normal" icon="Check">
              {formatRupees(avoided)} avoided
            </Chip>
          )}
        </>
      }
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">Nothing has been flagged as low-value this week.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            A repeat test ordered inside its useful interval, or a test with no plausible bearing on the current
            problem, would appear here for review.
          </p>
        </Card>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Why rejecting matters more than accepting
            </h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Rejecting a flag requires a reason from the fixed five. Those reasons are the only signal that tells
              stewardship the rule is wrong rather than the clinician. An accept teaches nothing.
            </p>
          </Card>
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">This session</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Reviewed">
                {actioned.length} of {flagged.length}
              </KeyValue>
              <KeyValue label="Cost avoided">{formatRupees(avoided)}</KeyValue>
              <KeyValue label="Fallback">Retrospective review</KeyValue>
            </dl>
          </Card>
        </div>
      }
      railTitle="Stewardship"
    >
      <div className="space-y-5">
        <Alert tone="info" title="This is a queue of suggestions, not a queue of errors">
          A flagged test may be exactly right. The screen exists so the decision is recorded either way — and so a rule
          that keeps being overruled gets noticed.
        </Alert>

        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(o) => o.id}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-304"
          aiSortLabel="Strongest signal first"
          deterministicLabel="Most recent first"
          caption="Tests flagged as duplicate or low-value"
          emptyWhy="Nothing has been flagged this week. A repeat test inside its useful interval would appear here."
          filters={
            <>
              <Chip tone="neutral" icon="Building2">
                AWF
              </Chip>
              <Chip tone="neutral" icon="Clock">
                last 7 days
              </Chip>
            </>
          }
        />

        <ScreenSection title="Each flag, with its evidence and your decision">
          <div className="space-y-4">
            {rows.map((o) => {
              const p = patient(o.patientId)
              return (
                <Card key={o.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold">
                        {o.item} · {p.name}
                      </h3>
                      <p className="tabular text-[0.86em] text-ink-3">
                        Order {o.id} · placed {formatDateTime(o.placedAt)} by {o.placedBy}
                      </p>
                    </div>
                    <Chip tone="neutral" icon="IndianRupee">
                      {formatRupees(UNIT_COST[o.item] ?? 400)} if avoided
                    </Chip>
                  </div>

                  <p className="mt-3 rounded-panel bg-glass-fill-muted px-4 py-3 text-[0.95em] text-ink-2">
                    {o.duplicateReason}
                  </p>

                  {o.duplicateOf && (
                    <p className="tabular mt-2 flex items-center gap-2 text-[0.88em] text-ink-3">
                      <Icon name="CornerDownRight" size={13} />
                      Prior order {o.duplicateOf}
                    </p>
                  )}

                  <AIActionBar
                    className="mt-3"
                    touchpointId={`stewardship:${o.id}`}
                    capabilityId="AI-304"
                    gate="G2"
                    band={o.band ?? 'MED'}
                    score={o.confidence}
                    explain={{
                      touchpointId: `stewardship:${o.id}`,
                      capabilityId: 'AI-304',
                      claim: `${o.item} for ${p.name} looks like a repeat inside its useful interval.`,
                      confidence: o.confidence ?? 0.7,
                      band: o.band ?? 'MED',
                      computedAt: formatTime(NOW),
                      inputs: [
                        { label: `Prior ${o.item}`, source: `Order ${o.duplicateOf ?? '—'}` },
                        { label: 'Result trajectory', source: 'Results, last 72 hours' },
                        { label: 'Departmental repeat interval', source: 'Stewardship rule set' },
                      ],
                      evidence: [o.duplicateReason ?? ''],
                      model: 'low-value v1.5.0',
                      limits: [
                        'Compares against a departmental repeat interval, which is an average rather than a rule.',
                        'It does not know the clinical question you are asking of the repeat.',
                        'The retrospective stewardship round remains the fallback.',
                      ],
                    }}
                  />
                </Card>
              )
            })}
          </div>
        </ScreenSection>
      </div>
    </Screen>
  )
}
