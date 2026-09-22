/**
 * S-18-05 · Activation Intake — `/stroke/case/:id/intake` · T2 · ARC-15
 *
 * "The six things that actually change the decision."
 *
 * The hub's counterpart to the spoke console: the same six questions, plus the
 * rest that the hub can afford to collect. AI-112 extracts structure from the
 * free text already written at triage, so the same fact is not typed twice.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup, FormGroups } from '@/archetypes'
import { Diamond, FieldChip } from '@/components/ai'
import { Alert, Button, Card, Chip, Field, Icon, Select, TextArea, TextInput } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

/** The triage note AI-112 extracts from, so nothing is typed twice. */
const TRIAGE_TEXT = `47M brought by wife. Was normal at 0120 when they went to bed. Wife woke at 0200 to find him unable to speak properly with the right arm hanging. BP 196/104 on arrival, CBG 7.2, afebrile. No warfarin. She thinks he takes something for his heart but is not sure what.`

const EXTRACTED = [
  { key: 'lkw', label: 'Last known well', value: '01:20', confidence: 0.92, band: 'HIGH' as const },
  { key: 'deficit', label: 'Deficit', value: 'Right arm weakness with dysarthria', confidence: 0.88, band: 'HIGH' as const },
  { key: 'bp', label: 'Blood pressure', value: '196/104', confidence: 0.96, band: 'HIGH' as const },
  { key: 'glucose', label: 'Capillary glucose', value: '7.2 mmol/L', confidence: 0.94, band: 'HIGH' as const },
  {
    key: 'anticoag',
    label: 'Anticoagulation',
    value: 'Uncertain — "something for his heart"',
    confidence: 0.41,
    band: 'LOW' as const,
  },
]

export function S1805({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)
  const caseNow = useCaseClock()
  const answerCriterion = useStroke((s) => s.answerCriterion)

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const [fields, setFields] = useState<Record<string, string>>({})

  const accepted = EXTRACTED.filter((e) => dispositions[`intake:${e.key}`]).length

  return (
    <Screen
      screenId="S-18-05"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'AI-OFF', 'AI-LOW']}
      chips={
        <Chip tone={accepted === EXTRACTED.length ? 'normal' : 'caution'}>
          {accepted} of {EXTRACTED.length} extracted fields confirmed
        </Chip>
      }
      actions={
        <Button icon="Syringe" onClick={() => navigate(`/stroke/case/${c.id}/thrombolysis`)}>
          Eligibility
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Triage note, as written</h3>
            <p className="mt-2 rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.9em] leading-relaxed text-ink-2">
              {TRIAGE_TEXT}
            </p>
            <p className="mt-2 text-[0.86em] text-ink-3">
              The free text is the source. Extraction saves retyping; it does not replace the note.
            </p>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-112 · structured extraction
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              One field arrives at LOW confidence on purpose — &ldquo;something for his heart&rdquo; is genuinely
              uncertain, and the honest output is a low band with the quote attached, not a guess.
            </p>
          </Card>
        </div>
      }
      railTitle="Source"
      actionBar={
        <>
          <Button icon="Save">Save</Button>
          <span className="text-[0.88em] text-ink-3">
            Nothing here blocks the clock — the intake runs alongside the pathway
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="ArrowRight"
            onClick={() => {
              toast({ tone: 'success', title: 'Intake saved', detail: 'The hub has the full picture.' })
              navigate(`/stroke/case/${c.id}/clock`)
            }}
          >
            Save and return to the clock
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Alert tone="info" title="The same six questions, plus what the hub can afford to ask">
          The spoke console asks six. Here, those six arrive pre-filled from the triage note and the rest is collected
          while the imaging runs — so the extra detail costs no clock time.
        </Alert>

        <FormGroups columns={2}>
          <FieldGroup title="The six that change the decision" span>
            <div className="grid gap-4 lg:grid-cols-2">
              {EXTRACTED.map((e) => (
                <Field
                  key={e.key}
                  label={e.label}
                  required
                  htmlFor={`intake-${e.key}`}
                  aiSlot={
                    aiActive && (
                      <FieldChip
                        touchpointId={`intake:${e.key}`}
                        capabilityId="AI-112"
                        suggestion={e.value}
                        band={e.band}
                        score={e.confidence}
                        gate="G2"
                        onAccept={() => {
                          setFields((f) => ({ ...f, [e.key]: e.value }))
                          answerCriterion(e.key, e.value)
                        }}
                        explain={{
                          touchpointId: `intake:${e.key}`,
                          capabilityId: 'AI-112',
                          claim: `"${e.value}" was extracted from the triage note for ${e.label.toLowerCase()}.`,
                          confidence: e.confidence,
                          band: e.band,
                          computedAt: formatTime(caseNow),
                          inputs: [{ label: 'Triage free text', source: 'ED triage assessment' }],
                          evidence: [TRIAGE_TEXT],
                          model: 'extract v4.1.0',
                          limits: [
                            'Extracts from what was written. It cannot ask the wife a follow-up question.',
                            'A hedged phrase extracts as a low-confidence value rather than a guess.',
                            'Manual structured entry is the fallback and is always available.',
                          ],
                        }}
                      />
                    )
                  }
                >
                  <TextInput
                    id={`intake-${e.key}`}
                    value={fields[e.key] ?? ''}
                    onChange={(ev) => setFields((f) => ({ ...f, [e.key]: ev.target.value }))}
                    placeholder="Type it, or accept the extraction"
                  />
                </Field>
              ))}
              <Field label="Weight, measured or estimated" required htmlFor="intake-weight">
                <TextInput
                  id="intake-weight"
                  value={fields.weight ?? ''}
                  onChange={(ev) => setFields((f) => ({ ...f, weight: ev.target.value }))}
                  placeholder="78 kg"
                />
              </Field>
            </div>
          </FieldGroup>

          <FieldGroup title="Pre-stroke function" hint="Drives whether thrombectomy is offered at all">
            <Field label="Pre-stroke modified Rankin Scale" htmlFor="intake-mrs">
              <Select id="intake-mrs" defaultValue="0 — no symptoms">
                {[
                  '0 — no symptoms',
                  '1 — no significant disability',
                  '2 — slight disability, independent',
                  '3 — moderate disability, walks unaided',
                  '4 — moderately severe, needs assistance',
                  '5 — severe disability, bedridden',
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Lives" htmlFor="intake-lives">
              <Select id="intake-lives" defaultValue="At home, independently">
                {['At home, independently', 'At home, with family support', 'In residential care'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
          </FieldGroup>

          <FieldGroup title="Exclusions" hint="A no here is as useful as a yes — record it either way">
            {['Recent major surgery', 'Prior intracranial haemorrhage', 'Known bleeding disorder', 'Recent stroke within 3 months'].map(
              (x) => (
                <Field key={x} label={x} htmlFor={`ex-${x}`}>
                  <Select id={`ex-${x}`} defaultValue="No">
                    {['No', 'Yes', 'Unknown'].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </Select>
                </Field>
              ),
            )}
          </FieldGroup>

          <FieldGroup title="Next of kin and consent" span>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Present at the bedside" htmlFor="intake-nok">
                <TextInput id="intake-nok" placeholder="Wife — name and contact" />
              </Field>
              <Field label="Consent discussion" htmlFor="intake-consent">
                <TextArea id="intake-consent" rows={3} placeholder="Who it was discussed with, and what was said…" />
              </Field>
            </div>
            <p className="flex items-start gap-1.5 text-[0.86em] text-ink-3">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              A thumb impression with a witness is a first-class signature mode here, not a fallback — it is how most
              consent at 02:00 is actually taken.
            </p>
          </FieldGroup>
        </FormGroups>
      </div>
    </Screen>
  )
}
