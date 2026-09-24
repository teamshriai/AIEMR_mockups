/**
 * S-16-08 · ADR Reporting (PvPI) — `/pharmacy/adr` · T3 · ARC-15
 *
 * "Reporting an adverse drug reaction to PvPI."
 *
 * AI-815 detects a signal at G1 and the fallback is clinician-initiated
 * reporting — which is how essentially all pharmacovigilance actually works,
 * and why the detection is worth having: the reaction that never gets reported
 * is the one nobody had time to write up.
 *
 * Calm: the signal card stays, because it is an offer with an Accept/Reject —
 * its supporting detail folds to two lines. The "suspected is enough"
 * reassurance and the "why report" / "what happens next" rail move behind one
 * `Why`. The hard-stop consequence of submitting stays stated once, at the
 * point of submission.
 */

import { useState } from 'react'

import { FieldGroup, FormGroups } from '@/archetypes'
import { AIActionBar, Diamond } from '@/components/ai'
import { Why } from '@/components/calm'
import { Card, Checkbox, Chip, Field, Icon, Select, TextInput, cx } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { Button } from '@/components/primitives'
import { formatDate, formatTime, NOW } from '@/data/format'
import { DRUGS, PATIENTS } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

/** The signal AI-815 has found in this session's data. */
const SIGNAL = {
  drug: 'Co-amoxiclav 1.2g IV',
  reaction: 'Urticaria with facial swelling',
  summary: 'Three patients at this facility have had a urticarial reaction within two hours of a first co-amoxiclav dose in the last 90 days.',
  detail:
    'Three patients at this facility have had a urticarial reaction within two hours of a first co-amoxiclav dose in the last 90 days. Two were not reported to PvPI.',
  confidence: 0.72,
  band: 'MED' as const,
}

const SEVERITY = ['Mild', 'Moderate', 'Severe', 'Life-threatening', 'Fatal']
const OUTCOMES = ['Recovered', 'Recovering', 'Not recovered', 'Recovered with sequelae', 'Fatal', 'Unknown']
const CAUSALITY = ['Certain', 'Probable', 'Possible', 'Unlikely', 'Unclassified', 'Unassessable']

export function S1608() {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)

  const [patientId, setPatientId] = useState('SD-P-03')
  const [drug, setDrug] = useState<string>(SIGNAL.drug)
  const [reaction, setReaction] = useState(SIGNAL.reaction)
  const [severity, setSeverity] = useState('Moderate')
  const [outcome, setOutcome] = useState('Recovered')
  const [causality, setCausality] = useState('Probable')
  const [narrative, setNarrative] = useState('')
  const [rechallenge, setRechallenge] = useState(false)
  const [attested, setAttested] = useState(false)
  const [detailExpanded, setDetailExpanded] = useState(false)

  const ready = reaction.trim().length > 3 && narrative.trim().length >= 20 && attested
  const signalActioned = dispositions['adr:signal']

  return (
    <Screen
      screenId="S-16-08"
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'AI-OFF', 'AI-LOW']}
      subheading={<>PvPI Form 1</>}
      chips={
        aiActive &&
        !signalActioned && (
          <Chip tone="caution" icon="TriangleAlert">
            1 signal detected
          </Chip>
        )
      }
      rail={
        <div className="space-y-4">
          <Why label="Why reporting matters">
            <p className="text-ink-2">
              A reaction recorded in the chart protects this patient. A reaction reported to PvPI protects everyone
              else&rsquo;s. They are different acts, and only the second one needs this form.
            </p>
            <p className="text-ink-2">
              Suspected is enough — a report does not assert causation. &ldquo;Possible&rdquo; is a valid causality
              assessment and a useful report; waiting for certainty is how signals get missed.
            </p>
            <ul className="space-y-1.5 text-ink-2">
              {[
                'The allergy is added to the patient record immediately',
                'Prescribing this drug for them becomes a hard stop',
                'The report goes to the ADR monitoring centre',
                'A serious reaction is escalated within 15 days',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[0.92em] text-ink-3">CMP-DRUG-04 · ADR reporting.</p>
          </Why>
        </div>
      }
      railTitle="PvPI"
      actionBar={
        <>
          <Button
            icon="Save"
            onClick={() => toast({ tone: 'info', title: 'Draft saved', detail: 'The ADR report stays a draft on this device until you submit it to PvPI.' })}
          >
            Save draft
          </Button>
          <span className="text-[0.88em] text-ink-3">
            {ready ? 'Ready to submit' : 'A narrative and the attestation are required'}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Send"
            disabled={!ready}
            onClick={() =>
              toast({
                tone: 'success',
                title: 'ADR reported to PvPI',
                detail: `${drug} · ${reaction}. The allergy is on the patient record and prescribing it is now a hard stop.`,
              })
            }
          >
            Submit the report
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {aiActive && !signalActioned && (
          <Card className="border-l-[3px] border-l-caution p-5">
            <h2 className="flex items-center gap-2 font-semibold text-caution">
              <Diamond size={12} />
              A signal has been detected
            </h2>
            <p className="mt-2 font-medium">
              {SIGNAL.drug} → {SIGNAL.reaction}
            </p>
            <p className={cx('mt-1.5 text-[0.95em] text-ink-2', !detailExpanded && 'line-clamp-2')}>
              {SIGNAL.detail}
            </p>
            <button
              type="button"
              aria-expanded={detailExpanded}
              onClick={() => setDetailExpanded((v) => !v)}
              className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-pill px-1.5 text-[0.86em] font-medium text-ink-3 hover:bg-glass-fill-hover hover:text-ink-2"
            >
              {detailExpanded ? 'Show less' : 'Read more'}
              <Icon name={detailExpanded ? 'ChevronDown' : 'ChevronRight'} size={12} />
            </button>
            <AIActionBar
              className="mt-3"
              touchpointId="adr:signal"
              capabilityId="AI-815"
              gate="G1"
              band={SIGNAL.band}
              score={SIGNAL.confidence}
              onAccept={() => {
                setDrug(SIGNAL.drug)
                setReaction(SIGNAL.reaction)
                toast({ tone: 'info', title: 'Form pre-filled from the signal', detail: 'Check every field before submitting.' })
              }}
              explain={{
                touchpointId: 'adr:signal',
                capabilityId: 'AI-815',
                claim: 'A cluster of urticarial reactions following first-dose co-amoxiclav has been detected at this facility.',
                confidence: SIGNAL.confidence,
                band: SIGNAL.band,
                computedAt: formatTime(NOW),
                inputs: [
                  { label: 'Administration records, 90 days', source: 'eMAR' },
                  { label: 'New allergy entries, 90 days', source: 'Allergy records' },
                  { label: 'PvPI reports already filed', source: 'ADR register' },
                ],
                evidence: [
                  'Three reactions within two hours of a first dose.',
                  'Two of the three were never reported to PvPI.',
                ],
                model: 'adr-signal v1.4.0',
                limits: [
                  'Detects temporal association, not causation. Three cases is a signal, not a finding.',
                  'It cannot see a reaction that was never charted.',
                  'Clinician-initiated reporting remains the fallback and the main route.',
                ],
              }}
            />
          </Card>
        )}

        <FormGroups columns={2}>
          <FieldGroup title="Patient">
            <Field label="Patient" required htmlFor="adr-patient">
              <Select id="adr-patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                {PATIENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.uhid} · {p.age}/{p.sex}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date of the reaction" required htmlFor="adr-date">
              <TextInput id="adr-date" type="date" defaultValue="2026-09-21" />
            </Field>
          </FieldGroup>

          <FieldGroup title="Suspected drug">
            <Field label="Drug" required htmlFor="adr-drug">
              <Select id="adr-drug" value={drug} onChange={(e) => setDrug(e.target.value)}>
                {DRUGS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dose, route and frequency" htmlFor="adr-dose">
              <TextInput id="adr-dose" defaultValue="1.2 g IV, first dose" />
            </Field>
            <Checkbox
              checked={rechallenge}
              onChange={setRechallenge}
              label={
                <>
                  Rechallenge was attempted
                  <span className="block text-[0.88em] text-ink-3">
                    Rarely appropriate, and it strengthens the causality assessment when it happened.
                  </span>
                </>
              }
            />
          </FieldGroup>

          <FieldGroup title="The reaction" span>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Reaction" required htmlFor="adr-reaction">
                <TextInput id="adr-reaction" value={reaction} onChange={(e) => setReaction(e.target.value)} />
              </Field>
              <Field label="Severity" required htmlFor="adr-severity">
                <Select id="adr-severity" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  {SEVERITY.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Outcome" required htmlFor="adr-outcome">
                <Select id="adr-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                  {OUTCOMES.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label="Causality assessment"
              required
              htmlFor="adr-causality"
              hint="WHO-UMC scale. Possible is a valid and useful answer."
            >
              <Select id="adr-causality" value={causality} onChange={(e) => setCausality(e.target.value)}>
                {CAUSALITY.map((cz) => (
                  <option key={cz}>{cz}</option>
                ))}
              </Select>
            </Field>
            <VoiceField
              id="adr-narrative"
              label="Narrative"
              required
              rows={4}
              value={narrative}
              onChange={setNarrative}
              patientId={patientId}
              placeholder="Developed an urticarial rash over the trunk with periorbital swelling within 90 minutes of the first dose. The infusion was stopped, chlorphenamine and hydrocortisone were given, and the rash settled over four hours…"
              hint="What happened, in what order, and what was done about it — at least twenty characters"
            />
          </FieldGroup>

          <FieldGroup title="Reporter" span>
            <div className="rounded-panel bg-glass-fill-muted px-4 py-3">
              <p className="font-medium">{me.name}</p>
              <p className="tabular text-[0.9em] text-ink-3">
                {me.identifierKind} {me.identifier} · {me.personaLabel}
              </p>
              <p className="tabular mt-1 text-[0.9em] text-ink-3">{formatDate(NOW)}</p>
            </div>
            <Checkbox
              checked={attested}
              onChange={setAttested}
              label={
                <>
                  The information above is accurate to the best of my knowledge.
                  <span className="block text-[0.88em] text-ink-3">
                    Submitting also adds the allergy to the patient record, which makes prescribing this drug for them
                    a hard stop.
                  </span>
                </>
              }
            />
          </FieldGroup>
        </FormGroups>
      </div>
    </Screen>
  )
}
