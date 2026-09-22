/**
 * S-06-08 · Patient Instructions & Education — `/encounter/:id/instructions` · T2 · ARC-15
 *
 * "What the patient is told, in the language they read."
 *
 * AI-111's guardrail shapes the layout: "THE CLINICIAN'S OWN WORDING IS
 * RETAINED ALONGSIDE." So this is a two-column screen — what you wrote, and
 * what the patient will read — rather than a rewrite that overwrites you.
 *
 * CMP-DPDP-02 requires the patient's language, not the user's, so the language
 * selector here is bound to the patient.
 */

import { useState } from 'react'

import { FieldGroup, FormGroups } from '@/archetypes'
import { AIActionBar, Diamond } from '@/components/ai'
import { Alert, Button, Card, Checkbox, Chip, Field, Icon, Select, TextArea } from '@/components/primitives'
import { encounter } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { LANGUAGES, patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const CLINICIAN_WORDING = `Continue levothyroxine 75 mcg OD on an empty stomach. Maintain 4h gap from Ca/Fe supplements. Repeat TFT in 6/12. Review with results.`

const PLAIN_ENGLISH = `Keep taking your thyroid tablet — levothyroxine, 75 micrograms — once every day.

Take it first thing in the morning, at least 30 minutes before you eat or drink anything except water.

If you take calcium or iron tablets, leave at least four hours between those and your thyroid tablet. They stop it being absorbed properly.

In six months, have a blood test for your thyroid. Book an appointment with Dr Iyer for after the test, and bring the results.

Come back sooner if the tiredness returns, you feel cold all the time, or your weight changes without you trying.`

const KANNADA = `ನಿಮ್ಮ ಥೈರಾಯ್ಡ್ ಮಾತ್ರೆ — ಲೆವೊಥೈರಾಕ್ಸಿನ್ 75 ಮೈಕ್ರೋಗ್ರಾಂ — ಪ್ರತಿದಿನ ಒಂದು ಬಾರಿ ತೆಗೆದುಕೊಳ್ಳುವುದನ್ನು ಮುಂದುವರಿಸಿ.

ಬೆಳಿಗ್ಗೆ ಎದ್ದ ತಕ್ಷಣ, ಆಹಾರ ಅಥವಾ ನೀರಿನ ಹೊರತಾಗಿ ಬೇರೇನೂ ಸೇವಿಸುವ ಮೊದಲು ಕನಿಷ್ಠ 30 ನಿಮಿಷ ಮುಂಚಿತವಾಗಿ ತೆಗೆದುಕೊಳ್ಳಿ.

ಕ್ಯಾಲ್ಸಿಯಂ ಅಥವಾ ಕಬ್ಬಿಣದ ಮಾತ್ರೆಗಳನ್ನು ತೆಗೆದುಕೊಳ್ಳುತ್ತಿದ್ದರೆ, ಅವುಗಳ ಮತ್ತು ಥೈರಾಯ್ಡ್ ಮಾತ್ರೆಯ ನಡುವೆ ಕನಿಷ್ಠ ನಾಲ್ಕು ಗಂಟೆಗಳ ಅಂತರ ಇರಲಿ.

ಆರು ತಿಂಗಳ ನಂತರ ಥೈರಾಯ್ಡ್ ರಕ್ತ ಪರೀಕ್ಷೆ ಮಾಡಿಸಿ, ನಂತರ ಡಾ. ಐಯರ್ ಅವರನ್ನು ಭೇಟಿ ಮಾಡಿ.`

export function S0608({ id }: { id?: string }) {
  const enc = encounter(id ?? 'E-118402')
  const p = patient(enc.patientId)
  const aiActive = useAI(selectAiActive)
  const toast = useUI((s) => s.toast)

  const [clinicianText, setClinicianText] = useState(CLINICIAN_WORDING)
  const [plainText, setPlainText] = useState(PLAIN_ENGLISH)
  /** CMP-DPDP-02 — the PATIENT's language, not the user's. */
  const [patientLanguage, setPatientLanguage] = useState('KN')
  const [channels, setChannels] = useState({ print: true, app: true, sms: false })

  return (
    <Screen
      screenId="S-06-08"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      chips={<Chip tone="neutral" icon="Globe">{LANGUAGES.find((l) => l.code === patientLanguage)?.label}</Chip>}
      actionBar={
        <>
          <Button icon="Printer">Preview the A5 print</Button>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Send"
            onClick={() =>
              toast({
                tone: 'success',
                title: 'Instructions issued',
                detail: 'Printed bilingually and pushed to the patient app. The SMS carries a pointer only, never the content.',
              })
            }
          >
            Issue to the patient
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Channels</h3>
            <div className="mt-2 space-y-1">
              <Checkbox
                checked={channels.print}
                onChange={(v) => setChannels((c) => ({ ...c, print: v }))}
                label="Printed A5, bilingual"
              />
              <Checkbox
                checked={channels.app}
                onChange={(v) => setChannels((c) => ({ ...c, app: v }))}
                label="Patient app, in their language"
              />
              <Checkbox
                checked={channels.sms}
                onChange={(v) => setChannels((c) => ({ ...c, sms: v }))}
                label="SMS notification"
              />
            </div>
            {channels.sms && (
              <p className="mt-2 flex items-start gap-2 rounded-panel bg-caution-soft px-2.5 py-2 text-[0.86em] font-medium text-caution">
                <Icon name="TriangleAlert" size={13} className="mt-0.5 shrink-0" />
                The SMS will say only that instructions are available. It never carries the reason for the visit, a
                diagnosis or a result.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Patient&rsquo;s language</h3>
            <Select
              className="mt-2"
              value={patientLanguage}
              onChange={(e) => setPatientLanguage(e.target.value)}
              aria-label="Patient's preferred language"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-[0.86em] text-ink-3">
              Patient-facing documents follow the patient&rsquo;s preference, not yours. Yours only changes the
              interface.
            </p>
          </Card>
        </div>
      }
      railTitle="Delivery"
    >
      <div className="space-y-5">
        <Alert tone="info" title="Both versions are kept">
          The rewrite does not replace what you wrote. Your wording stays in the record; the plain-language version is
          what the patient receives.
        </Alert>

        <FormGroups columns={2}>
          <FieldGroup title="Your wording" hint="Stays in the clinical record exactly as you write it">
            <Field label="Clinical instructions" htmlFor="clinician-text">
              <TextArea
                id="clinician-text"
                rows={8}
                value={clinicianText}
                onChange={(e) => setClinicianText(e.target.value)}
              />
            </Field>
            <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              Abbreviations are fine here — this version is read by clinicians. The patient version expands them.
            </p>
          </FieldGroup>

          <FieldGroup title="What the patient reads" hint="AI-111 · plain language, then translated">
            {aiActive ? (
              <>
                <div className="ai-ghost rounded-field px-3.5 py-3">
                  <p className="mb-2 flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ai uppercase">
                    <Diamond size={10} />
                    AI-111 rewrite
                  </p>
                  <div className="space-y-2 leading-relaxed whitespace-pre-line">{plainText}</div>
                </div>
                <AIActionBar
                  touchpointId={`${enc.id}:instructions`}
                  capabilityId="AI-111"
                  gate="G2"
                  band="HIGH"
                  score={0.89}
                  onEdit={() => setPlainText(PLAIN_ENGLISH)}
                  explain={{
                    touchpointId: `${enc.id}:instructions`,
                    capabilityId: 'AI-111',
                    claim: 'Your instructions, rewritten at roughly a grade-6 reading level, with the reason for each step made explicit.',
                    confidence: 0.89,
                    band: 'HIGH',
                    computedAt: formatTime(NOW),
                    inputs: [
                      { label: 'Your clinical instructions', source: `Encounter ${enc.encounterNo}` },
                      { label: 'Active medication list', source: 'Prescription record' },
                    ],
                    evidence: [
                      'Expanded "OD" to "once every day" and "TFT in 6/12" to a dated action.',
                      'Added why the four-hour gap matters, which the original assumed.',
                    ],
                    model: 'plain-lang v2.2.0',
                    limits: [
                      'Rewrites for readability. It does not add clinical content or change the plan.',
                      'Your own wording is retained alongside and is the clinical record.',
                      'Translation quality varies by script; a human check is offered before issue.',
                    ],
                  }}
                />
              </>
            ) : (
              <Field label="Patient instructions" htmlFor="plain-text">
                <TextArea id="plain-text" rows={8} value={plainText} onChange={(e) => setPlainText(e.target.value)} />
              </Field>
            )}
          </FieldGroup>

          <FieldGroup
            title={`Translation — ${LANGUAGES.find((l) => l.code === patientLanguage)?.label}`}
            hint="AI-110 · English-only is the fallback, with the limitation stated"
            span
          >
            {patientLanguage === 'EN' ? (
              <p className="rounded-panel bg-glass-fill-muted px-4 py-3 text-[0.92em] text-ink-2">
                The patient reads English, so no translation is needed. The print is single-language.
              </p>
            ) : (
              <>
                <div className="rounded-field bg-glass-fill-muted px-4 py-3">
                  <p
                    className="space-y-2 leading-loose whitespace-pre-line"
                    lang={patientLanguage.toLowerCase()}
                    style={{ fontFamily: "'Noto Sans Devanagari', var(--font-sans)" }}
                  >
                    {patientLanguage === 'KN' ? KANNADA : KANNADA}
                  </p>
                </div>
                <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
                  <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
                  Line height is raised 15% over Latin, as the type rules require for Indic scripts. If translation is
                  unavailable the document prints in English with that limitation stated on it — it never prints a
                  partial translation.
                </p>
              </>
            )}
          </FieldGroup>
        </FormGroups>
      </div>
    </Screen>
  )
}
