/**
 * S-08-04 · Inpatient Progress Note — `/ip/encounter/:id/note` · T1 · ARC-15
 *
 * "Where the consultant dictates the daily ward-round note; the scribe drafts
 * on request."
 *
 * Deck beat #12: "The ward round writes itself."
 *
 * The authoring surface is shared with S-06-03: four empty sections, spoken or
 * typed. What makes this the inpatient screen is what surrounds it: AI-102
 * drafts from the ward round rather than a consultation ("Draft with
 * AI"), AI-201's deterioration strip is the reason you are at the bed, and
 * AI-301 proposes the orders the note implies.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SuggestionCard } from '@/components/ai'
import { SectionCard, Why } from '@/components/calm'
import { Alert, Button, Icon, KeyValue } from '@/components/primitives'
import { PatientRecordLinks } from '@/components/recordlinks'
import { ORDER_SUGGESTIONS, RISK_STRIPS, VITALS, encounter, noteSeedsFor } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'

import { S0604 } from '../m06/S0604'
import { NoteAuthoring, encounterLabel } from '../shared/NoteAuthoring'

export function S0804({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const placeOrders = useClinical((s) => s.placeOrders)
  const applyScribeDraft = useClinical((s) => s.applyScribeDraft)
  const me = useCurrentStaff()
  const [scribeOpen, setScribeOpen] = useState(false)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const risk = RISK_STRIPS[p.id]
  const vitals = VITALS[p.id] ?? []
  const seeds = noteSeedsFor(p.id)
  /** AI-301's suggestions are drawn from R. Lakshmanan's plan; nobody else inherits them. */
  const suggestions = p.id === 'SD-P-03' ? ORDER_SUGGESTIONS.slice(0, 3) : []

  return (
    <>
    <NoteAuthoring
      screenId="S-08-04"
      encounter={enc}
      patient={p}
      seeds={seeds}
      scribeModel="round-scribe v3.7.0"
      onSigned={() => navigate('/ip/patients')}
      onDraftAll={() => setScribeOpen(true)}
      headerActions={
        <>
          <Button tone="tertiary" icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/rx`)}>
            Prescribe
          </Button>
          <Button tone="tertiary" icon="ClipboardList" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
            Order
          </Button>
        </>
      }
      banner={
        <>
          {/* Results, reports and the scan are one tap from the note — the ward round needs them beside it. */}
          <PatientRecordLinks patient={p} />
          {p.allergies.length > 0 && (
            <Alert tone="caution" title={`Documented allergy: ${p.allergies.join(', ')}`}>
              {p.allergies.includes('Penicillin')
                ? 'This constrains prescribing. A beta-lactam on this patient is a deterministic hard stop, not a warning — the Prescribe action will show it.'
                : 'This constrains prescribing. The Prescribe action checks every drug against it and stops a match.'}
            </Alert>
          )}
        </>
      }
      rail={
        <div className="space-y-4">
          {/* Why you are at this bed. */}
          {risk && risk.band !== 'ABSTAIN' && (
            <SectionCard
              title={`Deterioration risk ${risk.band}`}
              className="border-l-4 border-l-abnormal"
              bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
            >
              <p
                className="tabular text-[0.95em]"
                title={`${risk.modelVersion} · computed ${formatTime(risk.computedAt)}`}
              >
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
            </SectionCard>
          )}

          <SectionCard title="Latest observations" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <dl className="divide-y divide-glass-hairline">
              {vitals.map((v) => (
                <KeyValue key={v.label} label={v.label}>
                  <span className="tabular">{v.value}</span>
                </KeyValue>
              ))}
            </dl>
            {vitals[0] && (
              <p className="tabular mt-2 text-[0.84em] text-ink-3">charted {formatTime(vitals[0].at)}</p>
            )}
          </SectionCard>

          {/* AI-301 — the orders the plan implies, offered rather than placed. */}
          <div className="space-y-3">
            <h3 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">
              Orders this plan implies
            </h3>
            {suggestions.length === 0 && (
              <p className="text-[0.92em] text-ink-3">
                Nothing to suggest yet — suggestions follow from the plan once it is written.
              </p>
            )}
            {suggestions.map((s, i) => (
              <SuggestionCard
                key={s.item}
                touchpointId={`${enc.id}:round-order-${i}`}
                capabilityId="AI-301"
                title={s.item}
                evidence={s.evidence}
                band={s.band}
                score={s.confidence}
                gate="G2"
                onAccept={() => placeOrders([{ id: `RO-${i}`, item: s.item }], p.id, me.name)}
                explain={{
                  touchpointId: `${enc.id}:round-order-${i}`,
                  capabilityId: 'AI-301',
                  claim: `${s.item} follows from the plan you have drafted.`,
                  confidence: s.confidence,
                  band: s.band,
                  computedAt: formatTime(NOW),
                  inputs: [
                    { label: 'Drafted plan section', source: encounterLabel(enc) },
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

          <Why label="About the round scribe">
            <p className="text-ink-2">
              The ward-round variant of the scribe. It listens at the bedside rather than in a consulting room, so it
              expects a shorter, more telegraphic dictation and drafts accordingly. Fallback: type manually.
            </p>
          </Why>
        </div>
      }
      railBadge={suggestions.length || undefined}
    />

    {/* The round scribe, on request. Same overlay as the consultation; this patient's own lines. */}
    <S0604
      open={scribeOpen}
      patientId={p.id}
      patientName={p.name}
      sections={seeds}
      onClose={() => setScribeOpen(false)}
      onFinish={(keys, drafts) => {
        setScribeOpen(false)
        const drafted = applyScribeDraft(enc.id, keys, drafts)
        const kept = keys.length - drafted.length
        toast({
          tone: 'info',
          title:
            drafted.length === 0
              ? 'Nothing to draft — every section already has your words'
              : `${drafted.length} ${drafted.length === 1 ? 'section' : 'sections'} drafted from the round`,
          detail:
            drafted.length === 0
              ? 'The scribe never overwrites what you dictated or typed.'
              : `Each one needs Accept, Edit or Reject before Sign will enable.${kept > 0 ? ` ${kept} you had already written ${kept === 1 ? 'was' : 'were'} left as yours.` : ''}`,
        })
      }}
    />
    </>
  )
}
