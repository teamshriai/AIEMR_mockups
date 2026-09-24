/**
 * S-09-02 · Order Sets & Pathways — `/orders/sets` · T3 · ARC-07
 *
 * "Order sets and pathways, applied rather than remembered."
 *
 * AI-303 monitors adherence at G1 — it notices, you may ignore it, and the
 * printed protocol remains the fallback. It reports where care diverged from
 * the pathway; it does not enforce the pathway.
 *
 * Calm pass: the surface opens on the set that is due for review; the whole
 * catalogue is one tap away, and a set's items show only when its row is
 * opened. The adherence report is folded, and the two explanations are one
 * `Why`.
 */

import { useNavigate } from 'react-router-dom'

import { Disclosure, ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { Button, Chip } from '@/components/primitives'
import { ORDER_SETS } from '@/data/clinical'
import { NOW } from '@/data/format'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

const PATHWAY_ADHERENCE = [
  {
    pathway: 'Community-acquired pneumonia — adult',
    cases: 142,
    adherence: 0.87,
    divergences: [
      { step: 'Sputum culture within 24h', rate: 0.61, note: 'Most often omitted when the patient cannot expectorate' },
      { step: 'Antibiotic review at 48h', rate: 0.92, note: '' },
      { step: 'Oxygen target documented', rate: 0.78, note: 'Charted as a range rather than a target in most misses' },
    ],
  },
  {
    pathway: 'Sepsis bundle — first hour',
    cases: 88,
    adherence: 0.71,
    divergences: [
      { step: 'Lactate within 1h', rate: 0.64, note: 'Analyser turnaround is the constraint, not the ordering' },
      { step: 'Blood culture before antibiotics', rate: 0.83, note: '' },
      { step: 'Fluids started within 1h', rate: 0.94, note: '' },
    ],
  },
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `30-Sep-2026` → a Date; `—` → null. */
function parseDue(s: string): Date | null {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s)
  if (!m) return null
  const month = MONTHS.indexOf(m[2])
  if (month < 0) return null
  return new Date(Number(m[3]), month, Number(m[1]))
}

const DAY_MS = 86_400_000

type Scope = 'due' | 'all'
const SCOPES: readonly Scope[] = ['due', 'all']

export function S0902() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const [scope, setScope] = useScope(SCOPES, 'due')

  const daysUntil = (s: (typeof ORDER_SETS)[number]) => {
    const d = parseDue(s.reviewDue)
    return d ? Math.round((d.getTime() - NOW.getTime()) / DAY_MS) : null
  }

  /** Due for review: the soonest review date, plus anything else inside 90 days. */
  const dated = ORDER_SETS.filter((s) => daysUntil(s) !== null).sort((a, b) => daysUntil(a)! - daysUntil(b)!)
  const due = dated.filter((s, i) => i === 0 || daysUntil(s)! <= 90)
  const rows = scope === 'due' ? due : ORDER_SETS
  const used = ORDER_SETS.reduce((n, s) => n + s.usedThisMonth, 0)

  const apply = () => navigate('/encounter/E-118366/orders/new')

  return (
    <Screen
      screenId="S-09-02"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF']}
      heading="Order sets"
      subheading={
        <>
          {due.length} due for review · {ORDER_SETS.length} sets · used {used} times this month
        </>
      }
      actions={
        <Button icon="Settings" onClick={() => navigate('/clinician/templates')}>
          Manage sets
        </Button>
      }
    >
      <div className="max-w-4xl space-y-5">
        <SectionCard
          title="Sets and pathways"
          meta={<span className="tabular text-[0.88em] text-ink-3">{rows.length} shown</span>}
          action={
            <ScopeTabs
              value={scope}
              onChange={setScope}
              options={[
                { key: 'due', label: 'Due for review', count: due.length },
                { key: 'all', label: 'All', count: ORDER_SETS.length },
              ]}
            />
          }
        >
          {rows.length === 0 ? (
            <p className="px-3 py-6 text-center text-ink-2">No set is due for review. The whole catalogue is one tap away.</p>
          ) : (
            <ul aria-label="Order sets and pathways" className="divide-y divide-glass-hairline">
              {rows.map((s) => {
                const days = daysUntil(s)
                const soon = days !== null && days <= 90
                return (
                  <li key={s.id} className="py-1">
                    <button
                      type="button"
                      onClick={apply}
                      className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 rounded-panel px-3 py-2.5 text-left transition-colors duration-150 hover:bg-glass-fill-hover"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[1.02em] font-semibold tracking-tight">{s.name}</span>
                        <span className="mt-0.5 block text-[0.88em] text-ink-3">
                          <span className="tabular">{s.items.length} items</span> · {s.scope} · {s.owner} ·{' '}
                          <span className="tabular">used {s.usedThisMonth} times this month</span>
                        </span>
                      </span>
                      <span className="flex flex-col items-end gap-1.5">
                        {days !== null ? (
                          <Chip tone={soon ? 'caution' : 'neutral'} icon={soon ? 'TriangleAlert' : 'Check'} className="tabular">
                            {soon ? `review due ${s.reviewDue}` : `reviewed to ${s.reviewDue}`}
                          </Chip>
                        ) : (
                          <Chip tone="neutral" icon="Check">
                            personal · no review
                          </Chip>
                        )}
                      </span>
                    </button>
                    <Disclosure label="items" count={s.items.length}>
                      <div className="flex flex-wrap gap-1.5 px-3 pb-2">
                        {s.items.map((i) => (
                          <Chip key={i} tone="neutral">
                            {i}
                          </Chip>
                        ))}
                      </div>
                    </Disclosure>
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        {aiActive && (
          <Disclosure label="pathway adherence" count={PATHWAY_ADHERENCE.length}>
            <div className="grid gap-4 lg:grid-cols-2">
              {PATHWAY_ADHERENCE.map((pw) => (
                <SectionCard
                  key={pw.pathway}
                  title={pw.pathway}
                  meta={<span className="tabular text-[0.88em] text-ink-3">{pw.cases} cases this month</span>}
                  action={
                    <Chip tone={pw.adherence >= 0.85 ? 'normal' : 'caution'} icon={pw.adherence >= 0.85 ? 'Check' : 'TriangleAlert'}>
                      {Math.round(pw.adherence * 100)}% overall
                    </Chip>
                  }
                  bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
                >
                  <ul className="space-y-3">
                    {pw.divergences.map((d) => (
                      <li key={d.step}>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-[0.95em]">{d.step}</span>
                          <span className="tabular text-[0.9em] font-semibold">{Math.round(d.rate * 100)}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-pill bg-glass-fill-muted">
                          <div
                            className="h-full rounded-pill"
                            style={{
                              width: `${d.rate * 100}%`,
                              backgroundColor: d.rate >= 0.85 ? 'var(--color-viz-1)' : 'var(--color-caution)',
                            }}
                          />
                        </div>
                        {d.note && <p className="mt-1 text-[0.86em] text-ink-3">{d.note}</p>}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              ))}
            </div>
          </Disclosure>
        )}

        <Why label="Why a set is applied, not remembered — and what adherence means">
          <p className="text-ink-2">
            A set is applied to an encounter, not to a patient. Applying it places its orders against the encounter you
            are in; it does not create a standing instruction, and changing the set later does not change orders
            already placed.
          </p>
          <p className="text-ink-2">
            A pathway is a default, not a rule. Divergence is often the right call — a patient who cannot produce sputum
            cannot have a sputum culture. What the monitoring gives you is the pattern, so a systematic constraint can
            be told apart from a habit. Percentages are of cases where the step was clinically applicable, so an
            inapplicable step does not count as a miss.
          </p>
          <p className="text-ink-3">AI-303 · G1, and the printed protocol remains the fallback.</p>
        </Why>
      </div>
    </Screen>
  )
}
