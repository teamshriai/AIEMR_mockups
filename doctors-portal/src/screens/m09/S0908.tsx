/**
 * S-09-08 · Duplicate & Unnecessary Test Review — `/orders/stewardship` · T2 · ARC-08
 *
 * "Which tests are being ordered that need not be."
 *
 * An approval queue with a recommended disposition per item (ARC-08), where
 * the recommendation is AI-304's at G2. Disagreeing needs a reason from the
 * fixed five — which is the mechanism by which a wrong rule gets found, so the
 * screen says so rather than treating rejection as noise.
 *
 * Calm pass: there is one list, not two. The table that summarised the flags
 * and the cards that carried them were the same rows twice, so the cards — the
 * only place a decision can actually be made — are the list. The surface opens
 * on what is still awaiting a decision; what has been reviewed is one tap away.
 */

import { useState } from 'react'

import { AIActionBar, RankedSortControl } from '@/components/ai'
import { ScopeTabs, SectionTitle, Why, useScope } from '@/components/calm'
import { Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { ORDERS } from '@/data/clinical'
import { formatDateTime, formatRupees, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

/** What a repeat costs, from the §8.4 tariff card. */
const UNIT_COST: Record<string, number> = { CRP: 480, CBC: 350, 'Serum creatinine': 320, 'Blood culture': 1200 }

type Scope = 'awaiting' | 'reviewed'
const SCOPES: readonly Scope[] = ['awaiting', 'reviewed']

export function S0908() {
  const dispositions = useAI((s) => s.dispositions)
  const [scope, setScope] = useScope(SCOPES, 'awaiting')
  /**
   * AIP-07's guardrail survives the table's removal: a ranked list always keeps
   * the deterministic order one click away, whatever shape the rows take.
   */
  const [aiSort, setAiSort] = useState(true)

  const flaggedRaw = ORDERS.filter((o) => o.duplicateReason)
  const flagged = aiSort
    ? [...flaggedRaw].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    : [...flaggedRaw].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())

  const reviewed = flagged.filter((o) => dispositions[`stewardship:${o.id}`])
  const awaiting = flagged.filter((o) => !dispositions[`stewardship:${o.id}`])
  const rows = scope === 'awaiting' ? awaiting : reviewed

  const avoided = reviewed
    .filter((o) => dispositions[`stewardship:${o.id}`].disposition !== 'Rejected')
    .reduce((sum, o) => sum + (UNIT_COST[o.item] ?? 400), 0)

  return (
    <Screen
      screenId="S-09-08"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-LOW']}
      heading="Test stewardship"
      subheading={
        <>
          {awaiting.length} awaiting your decision · {flagged.length} flagged in the last 7 days
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
        <Card className="p-4">
          <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">This session</h3>
          <dl className="mt-2 divide-y divide-glass-hairline">
            <KeyValue label="Reviewed">
              <span className="tabular">
                {reviewed.length} of {flagged.length}
              </span>
            </KeyValue>
            <KeyValue label="Cost avoided">
              <span className="tabular">{formatRupees(avoided)}</span>
            </KeyValue>
          </dl>
        </Card>
      }
      railTitle="Stewardship"
    >
      <div className="max-w-4xl space-y-5">
        <SectionTitle
          title="Flagged tests"
          meta={<span className="tabular text-[0.88em] text-ink-3">{rows.length} shown</span>}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <ScopeTabs
                value={scope}
                onChange={setScope}
                options={[
                  { key: 'awaiting', label: 'Awaiting', count: awaiting.length },
                  { key: 'reviewed', label: 'Reviewed', count: reviewed.length },
                ]}
              />
              <RankedSortControl
                aiSort={aiSort}
                onChange={setAiSort}
                aiLabel="Strongest signal"
                deterministicLabel="Most recent first"
                capabilityId="AI-304"
              />
            </div>
          }
        />

        {rows.length === 0 ? (
          <Card className="p-8 text-center text-ink-2">
            {scope === 'awaiting'
              ? 'Every flagged test has a decision recorded against it. The reviewed ones are one tap away.'
              : 'Nothing has been dispositioned yet this session.'}
          </Card>
        ) : (
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
                        {p.bed ?? 'outpatient'} · order {o.id} · placed {formatDateTime(o.placedAt)} by {o.placedBy}
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
        )}

        <Why label="Why rejecting matters more than accepting">
          <p className="text-ink-2">
            Rejecting a flag requires a reason from the fixed five. Those reasons are the only signal that tells
            stewardship the rule is wrong rather than the clinician. An accept teaches nothing.
          </p>
          <p className="text-ink-2">
            A flagged test may be exactly right. This is a queue of suggestions, not a queue of errors — it exists so
            the decision is recorded either way, and so a rule that keeps being overruled gets noticed.
          </p>
          <p className="text-ink-3">
            AI-304 · G2, strongest signal first. The retrospective stewardship round remains the fallback.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
