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
import { SectionCard, Why } from '@/components/calm'
import { PrintPreview } from '@/components/print'
import { Alert, Button, Checkbox, Chip, Field, Select, TextArea } from '@/components/primitives'
import { InputModeSwitch, VoiceField } from '@/components/voicefield'
import { encounter } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { LANGUAGES, patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'

import { encounterLabel } from '../shared/NoteAuthoring'
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

  /** Empty until dictated or typed. The patient version is drafted only on request, from what you wrote. */
  const [clinicianText, setClinicianText] = useState('')
  const [plainText, setPlainText] = useState('')
  const [drafted, setDrafted] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const hasDraft = plainText.trim() !== ''
  const rewriteId = `${enc.id}:instructions`
  const rejected = useAI((s) => s.dispositions[rewriteId]?.disposition === 'Rejected')
  const clearDisposition = useAI((s) => s.clearDisposition)
  /** CMP-DPDP-02 — the PATIENT's language, not the user's. */
  const [patientLanguage, setPatientLanguage] = useState('KN')
  const [channels, setChannels] = useState({ print: true, app: true, sms: false })
  const languageLabel = LANGUAGES.find((l) => l.code === patientLanguage)?.label ?? patientLanguage

  return (
    <Screen
      screenId="S-06-08"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      chips={<Chip tone="neutral" icon="Globe">{LANGUAGES.find((l) => l.code === patientLanguage)?.label}</Chip>}
      actions={<InputModeSwitch />}
      actionBar={
        <>
          <Button icon="Printer" disabled={!hasDraft} title={hasDraft ? undefined : 'Nothing to print yet'} onClick={() => setPrintOpen(true)}>
            Preview the A5 print
          </Button>
          {!hasDraft && (
            <span className="text-[0.88em] text-ink-3">
              {clinicianText.trim() === '' ? 'Dictate or type your instructions first' : 'Draft the patient version to issue'}
            </span>
          )}
          <Button
            tone="primary"
            className="ml-auto"
            icon="Send"
            disabled={!hasDraft}
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
          <SectionCard title="Channels" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <div className="space-y-1">
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
              <Alert tone="caution" className="mt-2" title="The SMS carries no PHI">
                It will say only that instructions are available. It never carries the reason for the visit, a
                diagnosis or a result.
              </Alert>
            )}
          </SectionCard>

          <SectionCard title="Patient's language" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <Select
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
            {/* The rail rationale, one line by default. */}
            <p className="mt-2 text-[0.86em] text-ink-3">Follows the patient&rsquo;s preference, not yours.</p>
          </SectionCard>
        </div>
      }
      railTitle="Delivery"
    >
      <div className="space-y-5">
        <Why label="Why two versions">
          <p className="text-ink-2">
            The rewrite does not replace what you wrote. Your wording stays in the record; the plain-language version
            is what the patient receives — AI-111&rsquo;s guardrail.
          </p>
        </Why>

        <FormGroups columns={2}>
          <FieldGroup title="Your wording" hint="Stays in the clinical record exactly as you say or write it">
            <VoiceField
              id="clinician-text"
              label="Clinical instructions"
              required
              rows={8}
              value={clinicianText}
              onChange={setClinicianText}
              patientId={p.id}
              sample={CLINICIAN_WORDING}
            />
            <Why label="Abbreviations">
              <p className="text-ink-2">
                Abbreviations are fine here — this version is read by clinicians. The patient version expands them.
              </p>
            </Why>
          </FieldGroup>

          <FieldGroup title="What the patient reads" hint="AI-111 · plain language, then translated">
            {aiActive && !drafted && rejected ? (
              /* The rewrite was rejected: the patient version is yours to write, and the AI can try again. */
              <div className="space-y-2">
                <Field label="Patient instructions" htmlFor="plain-text" hint="Rewrite rejected — write the patient version yourself, or ask the AI to draft again.">
                  <TextArea
                    id="plain-text"
                    rows={8}
                    value={plainText}
                    onChange={(e) => setPlainText(e.target.value)}
                    placeholder="Write the patient version in plain language…"
                  />
                </Field>
                <Button
                  tone="tertiary"
                  size="sm"
                  icon="Sparkles"
                  onClick={() => {
                    clearDisposition(rewriteId)
                    setPlainText(PLAIN_ENGLISH)
                    setDrafted(true)
                  }}
                >
                  Draft again with AI
                </Button>
              </div>
            ) : aiActive && !drafted ? (
              /* Nothing is rewritten until you ask, and not before you have written something to rewrite. */
              <div className="flex flex-col items-start gap-3 rounded-field border border-dashed border-glass-border bg-glass-fill-muted px-4 py-5">
                <p className="text-[0.92em] text-ink-2">
                  The plain-language version is drafted from your instructions, at roughly a grade-6 reading level, then
                  translated into the patient&rsquo;s language.
                </p>
                <Button
                  tone="ai"
                  icon="Sparkles"
                  disabled={clinicianText.trim() === ''}
                  title={clinicianText.trim() === '' ? 'Write or dictate your instructions first' : undefined}
                  onClick={() => {
                    setPlainText(PLAIN_ENGLISH)
                    setDrafted(true)
                  }}
                >
                  Draft with AI
                </Button>
              </div>
            ) : aiActive ? (
              <>
                <div className="ai-ghost rounded-field px-3.5 py-3">
                  <p className="mb-2 flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ai uppercase">
                    <Diamond size={10} />
                    AI-111 rewrite
                  </p>
                  {/* One <p> per paragraph rather than one pre-line blob: this is
                      the document the patient receives, so it is marked up as prose. */}
                  <div className="space-y-2 leading-relaxed">
                    {plainText.split(/\n{2,}/).map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                  </div>
                </div>
                <AIActionBar
                  touchpointId={`${enc.id}:instructions`}
                  capabilityId="AI-111"
                  gate="G2"
                  band="HIGH"
                  score={0.89}
                  onEdit={() => setPlainText(PLAIN_ENGLISH)}
                  /* A rejected rewrite must not be issuable: it leaves the screen and Issue disables. */
                  onReject={() => {
                    setPlainText('')
                    setDrafted(false)
                  }}
                  onUndo={() => {
                    setPlainText(PLAIN_ENGLISH)
                    setDrafted(true)
                  }}
                  explain={{
                    touchpointId: `${enc.id}:instructions`,
                    capabilityId: 'AI-111',
                    claim: 'Your instructions, rewritten at roughly a grade-6 reading level, with the reason for each step made explicit.',
                    confidence: 0.89,
                    band: 'HIGH',
                    computedAt: formatTime(NOW),
                    inputs: [
                      { label: 'Your clinical instructions', source: encounterLabel(enc) },
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
                <TextArea
                  id="plain-text"
                  rows={8}
                  value={plainText}
                  onChange={(e) => setPlainText(e.target.value)}
                  placeholder="Write the patient version in plain language…"
                />
              </Field>
            )}
          </FieldGroup>

          {hasDraft && (
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
                <div
                  className="space-y-2 rounded-field bg-glass-fill-muted px-4 py-3 leading-loose"
                  lang={patientLanguage.toLowerCase()}
                  style={{ fontFamily: "'Noto Sans Devanagari', var(--font-sans)" }}
                >
                  {KANNADA.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <Why label="Script and fallback">
                  <p className="text-ink-2">
                    Line height is raised 15% over Latin, as the type rules require for Indic scripts. If translation is
                    unavailable the document prints in English with that limitation stated on it — it never prints a
                    partial translation.
                  </p>
                </Why>
              </>
            )}
          </FieldGroup>
          )}
        </FormGroups>
      </div>

      <PrintPreview
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        title="Patient instructions"
        patient={p}
        meta={`${encounterLabel(enc)} · English${patientLanguage === 'EN' ? '' : ` and ${languageLabel}`}`}
        paper="A5"
        sections={[
          { heading: 'Your instructions', body: plainText },
          ...(patientLanguage === 'EN' ? [] : [{ heading: languageLabel, body: KANNADA, lang: patientLanguage.toLowerCase() }]),
        ]}
      />
    </Screen>
  )
}
