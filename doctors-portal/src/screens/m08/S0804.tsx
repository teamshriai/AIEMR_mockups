/**
 * S-08-04 · Inpatient Progress Note — `/ip/encounter/:id/note` · T1 · ARC-15
 *
 * "Where the consultant records the daily ward-round note, with an AI scribe
 * drafting from dictation."
 *
 * Deck beat #12: "The ward round writes itself."
 *
 * The authoring surface is shared with S-06-03. What makes this the inpatient
 * screen is what surrounds it: AI-102 drafts from the ward round rather than a
 * consultation, AI-201's deterioration strip is the reason you are at the bed,
 * and AI-301 proposes the orders the note implies.
 */

import { useNavigate } from 'react-router-dom'

import { Diamond, SuggestionCard } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { NOTE_DRAFT_SD_P_03, ORDER_SUGGESTIONS, RISK_STRIPS, VITALS, encounter } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'

import { NoteAuthoring } from '../shared/NoteAuthoring'

export function S0804({ id }: { id?: string }) {
  const navigate = useNavigate()
  const placeOrders = useClinical((s) => s.placeOrders)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const risk = RISK_STRIPS[p.id]
  const vitals = VITALS[p.id] ?? []

  return (
    <NoteAuthoring
      screenId="S-08-04"
      encounter={enc}
      patient={p}
      seeds={NOTE_DRAFT_SD_P_03}
      scribeModel="round-scribe v3.7.0"
      onSigned={() => navigate('/ip/patients')}
      headerActions={
        <>
          <Button icon="Mic" tone="ai" title="AI-102 drafts from the ward round, handover or intra-op dictation">
            Dictate the round
          </Button>
          <Button icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/rx`)}>
            Prescribe
          </Button>
          <Button icon="ClipboardList" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
            Order
          </Button>
        </>
      }
      banner={
        p.allergies.length > 0 && (
          <Alert tone="caution" title={`Documented allergy: ${p.allergies.join(', ')}`}>
            This constrains prescribing. A beta-lactam on this patient is a deterministic hard stop, not a warning —
            the Prescribe action will show it.
          </Alert>
        )
      }
      rail={
        <div className="space-y-4">
          {/* Why you are at this bed. */}
          {risk && risk.band !== 'ABSTAIN' && (
            <Card className="border-l-[3px] border-l-abnormal p-4">
              <p className="flex items-center gap-2 font-semibold text-abnormal">
                <Icon name="TriangleAlert" size={16} />
                Deterioration risk {risk.band}
              </p>
              <p className="tabular mt-1 text-[0.95em]">
                {risk.score} · {risk.trend}
              </p>
              <ul className="mt-2.5 space-y-1">
                {risk.drivers.map((d) => (
                  <li key={d.label} className="flex items-center gap-1.5 text-[0.9em] text-ink-2">
                    <Icon
                      name={d.direction === 'up' ? 'ArrowUp' : 'ArrowDown'}
                      size={12}
                      className={d.direction === 'up' ? 'text-abnormal' : 'text-brand'}
                    />
                    {d.label}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[0.84em] text-ink-3">
                {risk.modelVersion} · computed {formatTime(risk.computedAt)}
              </p>
            </Card>
          )}

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Latest observations</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              {vitals.map((v) => (
                <KeyValue key={v.label} label={v.label}>
                  <span className="tabular">{v.value}</span>
                </KeyValue>
              ))}
            </dl>
            {vitals[0] && (
              <p className="tabular mt-2 text-[0.84em] text-ink-3">charted {formatTime(vitals[0].at)}</p>
            )}
          </Card>

          {/* AI-301 — the orders the plan implies, offered rather than placed. */}
          <div className="space-y-3">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Orders this plan implies
            </h3>
            {ORDER_SUGGESTIONS.slice(0, 3).map((s, i) => (
              <SuggestionCard
                key={s.item}
                touchpointId={`${enc.id}:round-order-${i}`}
                capabilityId="AI-301"
                title={s.item}
                evidence={s.evidence}
                band={s.band}
                score={s.confidence}
                gate="G2"
                onAccept={() => placeOrders([{ id: `RO-${i}`, item: s.item }], p.id, 'Dr Ananya Iyer')}
                explain={{
                  touchpointId: `${enc.id}:round-order-${i}`,
                  capabilityId: 'AI-301',
                  claim: `${s.item} follows from the plan you have drafted.`,
                  confidence: s.confidence,
                  band: s.band,
                  computedAt: formatTime(NOW),
                  inputs: [
                    { label: 'Drafted plan section', source: `Encounter ${enc.encounterNo}` },
                    { label: 'Recent results', source: 'Results, last 72 hours' },
                    { label: 'Charted vitals', source: 'Flowsheet, most recent set' },
                  ],
                  evidence: [s.evidence],
                  model: 'order-sug v3.0.2',
                  limits: [
                    'Reads the plan text and the structured record; it does not examine the patient.',
                    'Accepting places the order against this encounter — it is not a standing instruction.',
                    'Manual order search is always available.',
                  ],
                }}
              />
            ))}
          </div>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-102 · round scribe
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              The ward-round variant of the scribe. It listens at the bedside rather than in a consulting room, so it
              expects a shorter, more telegraphic dictation and drafts accordingly.
            </p>
            <Chip tone="neutral" className="mt-2">
              Fallback: type manually
            </Chip>
          </Card>
        </div>
      }
    />
  )
}
