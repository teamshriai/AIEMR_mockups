/**
 * S-09-02 · Order Sets & Pathways — `/orders/sets` · T3 · ARC-07
 *
 * "Order sets and pathways, applied rather than remembered."
 *
 * AI-303 monitors adherence at G1 — it notices, you may ignore it, and the
 * printed protocol remains the fallback. It reports where care diverged from
 * the pathway; it does not enforce the pathway.
 */

import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, Table, Td, Th, Tr } from '@/components/primitives'
import { ORDER_SETS } from '@/data/clinical'
import { Screen, ScreenSection } from '@/shell/Screen'
import { selectAiActive, useAI } from '@/store/ai'

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

export function S0902() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)

  return (
    <Screen
      screenId="S-09-02"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF']}
      chips={<Chip tone="neutral">{ORDER_SETS.length} sets</Chip>}
      actions={
        <Button icon="Settings" onClick={() => navigate('/clinician/templates')}>
          Manage sets
        </Button>
      }
      rail={
        <Card className="p-4">
          <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">What adherence means here</h3>
          <p className="mt-1.5 text-[0.9em] text-ink-2">
            A pathway is a default, not a rule. Divergence is often the right call — a patient who cannot produce
            sputum cannot have a sputum culture. What the monitoring gives you is the pattern, so a systematic
            constraint can be told apart from a habit.
          </p>
          <p className="mt-2.5 text-[0.86em] text-ink-3">
            AI-303 · G1, and the printed protocol remains the fallback.
          </p>
        </Card>
      }
      railTitle="Adherence"
    >
      <div className="space-y-5">
        <Alert tone="info" title="A set is applied to an encounter, not to a patient">
          Applying a set places its orders against the encounter you are in. It does not create a standing instruction,
          and changing the set later does not change orders already placed.
        </Alert>

        <ScreenSection title="Available sets">
          <Card className="overflow-hidden">
            <Table
              caption="Order sets and pathways"
              rowCount={`${ORDER_SETS.length} sets`}
              head={
                <>
                  <Th>Set</Th>
                  <Th>Scope</Th>
                  <Th className="hidden md:table-cell">Owner</Th>
                  <Th className="hidden md:table-cell">Review due</Th>
                  <Th>Used</Th>
                </>
              }
            >
              {ORDER_SETS.map((s) => (
                <Tr key={s.id} onClick={() => navigate('/encounter/E-118366/orders/new')}>
                  <Td>
                    <span className="block font-medium">{s.name}</span>
                    <span className="mt-1 flex flex-wrap gap-1">
                      {s.items.map((i) => (
                        <Chip key={i} tone="neutral">
                          {i}
                        </Chip>
                      ))}
                    </span>
                  </Td>
                  <Td>
                    <Chip tone={s.scope === 'Facility-wide' ? 'brand' : 'neutral'}>{s.scope}</Chip>
                  </Td>
                  <Td className="hidden md:table-cell">{s.owner}</Td>
                  <Td className="tabular hidden md:table-cell">{s.reviewDue}</Td>
                  <Td className="tabular">{s.usedThisMonth}</Td>
                </Tr>
              ))}
            </Table>
          </Card>
        </ScreenSection>

        {aiActive && (
          <ScreenSection
            title="Pathway adherence"
            subtitle="Where care diverged from the pathway this month, and how often"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {PATHWAY_ADHERENCE.map((pw) => (
                <Card key={pw.pathway} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{pw.pathway}</h3>
                      <p className="tabular text-[0.86em] text-ink-3">{pw.cases} cases this month</p>
                    </div>
                    <Chip tone={pw.adherence >= 0.85 ? 'normal' : 'caution'} icon={pw.adherence >= 0.85 ? 'Check' : 'TriangleAlert'}>
                      {Math.round(pw.adherence * 100)}% overall
                    </Chip>
                  </div>

                  <ul className="mt-3 space-y-3">
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
                        {d.note && (
                          <p className="mt-1 flex items-start gap-1.5 text-[0.86em] text-ink-3">
                            <Diamond size={9} className="mt-1" />
                            {d.note}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 flex items-start gap-2 text-[0.86em] text-ink-3">
                    <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
                    Percentages are of cases where the step was clinically applicable, so an inapplicable step does not
                    count as a miss.
                  </p>
                </Card>
              ))}
            </div>
          </ScreenSection>
        )}
      </div>
    </Screen>
  )
}
