/**
 * S-08-07 · Admission Assessment — `/ip/encounter/:id/assessment` · T3 · ARC-15
 *
 * "The admission assessment the 24-hour NABH clock is counting down to."
 *
 * CMP-NABH-01 requires an initial assessment within 24 hours of admission, so
 * the clock is the screen's organising idea rather than a footnote. AI-211
 * scores fall, pressure-ulcer and VTE risk at G1 — it notices, and the manual
 * assessment scales remain the fallback.
 */

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldGroup } from '@/archetypes'
import { AIActionBar } from '@/components/ai'
import { Why } from '@/components/calm'
import { LockedBanner } from '@/components/states'
import { Alert, Button, Card, Checkbox, Chip, Field, Icon, Select } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { NOTE_DRAFT_SD_P_03, encounter } from '@/data/clinical'
import { formatDateTime, formatElapsed, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { decided, selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const RISK_SCALES = [
  {
    key: 'falls',
    name: 'Falls risk — Morse',
    score: 55,
    band: 'High' as const,
    drivers: ['History of falling', 'Intravenous access in situ', 'Weak gait'],
    action: 'Bed in the low position, call bell within reach, hourly rounding.',
    confidence: 0.84,
  },
  {
    key: 'pressure',
    name: 'Pressure ulcer — Braden',
    score: 14,
    band: 'Moderate' as const,
    drivers: ['Reduced mobility', 'Poor oral intake', 'Moisture from diaphoresis'],
    action: 'Two-hourly repositioning, pressure-redistributing mattress, skin inspection each shift.',
    confidence: 0.79,
  },
  {
    key: 'vte',
    name: 'VTE risk — Padua',
    score: 5,
    band: 'High' as const,
    drivers: ['Acute infection', 'Reduced mobility > 3 days', 'Age over 70 — not met'],
    action: 'Pharmacological prophylaxis unless contraindicated. Already prescribed, renally adjusted.',
    confidence: 0.88,
  },
]

export function S0807({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const dispositions = useAI((s) => s.dispositions)
  const forced = useAI((s) => s.forcedState)

  /**
   * Everything the form holds lives in the clinical record under its own key,
   * so Save draft persists, a reload keeps the work, and signing locks it.
   * History is empty until dictated, typed or explicitly carried forward — and
   * then marked as such.
   */
  const { note, setSectionText, saveDraft, signNote } = useClinical()
  const noteId = `${enc.id}:assessment`
  const record = note(noteId)
  const history = record.text.history ?? ''
  const carried = record.provenance.history === 'carried'
  const nutrition = record.text.nutrition ?? 'At risk'
  const functional = record.text.function ?? 'Needs assistance'
  const complete = record.text.complete === 'yes'
  const locked = record.status === 'signed' || forced === 'LOCKED'

  useEffect(() => {
    if (locked) return
    const t = window.setInterval(() => saveDraft(noteId, 'auto'), 20_000)
    return () => window.clearInterval(t)
  }, [noteId, locked, saveDraft])

  /** A scale is confirmed by an AI decision that is not a rejection, or by the manual checkbox. */
  const confirmedBy = (key: string) => {
    const d = dispositions[`${enc.id}:scale:${key}`]
    return (decided(d) && d?.disposition !== 'Rejected') || record.text[`scale:${key}`] === 'confirmed'
  }
  const confirmedCount = RISK_SCALES.filter((sc) => confirmedBy(sc.key)).length
  const canSign = !locked && complete && history.trim().length >= 10 && confirmedCount === RISK_SCALES.length

  /** CMP-NABH-01's clock. Admitted 17-Sep 14:20; the 24h window has passed. */
  const hoursSince = (NOW.getTime() - enc.startedAt.getTime()) / 3_600_000
  const overdue = hoursSince > 24
  const remaining = Math.max(0, 24 - hoursSince)

  return (
    <Screen
      screenId="S-08-07"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      heading="Admission assessment"
      subheading={`CMP-NABH-01 · admitted ${formatDateTime(enc.startedAt)}`}
      chips={
        <Chip
          tone={overdue ? 'abnormal' : 'caution'}
          icon="Clock"
          title="Initial assessment due within 24 hours of admission"
        >
          {overdue
            ? `${formatElapsed((hoursSince - 24) * 60)} overdue`
            : `${formatElapsed(remaining * 60)} remaining`}
        </Chip>
      }
      actions={
        <>
          <Button tone="tertiary" icon="PenLine" onClick={() => navigate(`/ip/encounter/${enc.id}/note`)}>
            Progress note
          </Button>
        </>
      }
      actionBar={
        locked ? (
          <>
            <span className="flex items-center gap-2 text-[0.9em] text-ink-3">
              <Icon name="Lock" size={14} />
              Signed by {record.signedBy ?? me.name} · {formatDateTime(record.signedAt ?? NOW)}
            </span>
            <Button tone="primary" className="ml-auto" icon="ArrowRight" onClick={() => navigate(`/ip/encounter/${enc.id}/note`)}>
              Progress note
            </Button>
          </>
        ) : (
          <>
            <Button
              icon="Save"
              onClick={() => {
                saveDraft(noteId, 'manual')
                toast({ tone: 'info', title: 'Draft saved', detail: 'Nothing is signed. The NABH clock keeps running until you sign.' })
              }}
            >
              Save draft
            </Button>
            <span className="tabular text-[0.86em] text-ink-3">
              {record.savedAt ? `${record.savedHow === 'auto' ? 'Autosaved' : 'Saved'} ${formatTime(record.savedAt)}` : 'Autosave on'}
            </span>
            <span className="text-[0.88em] text-ink-3">
              {confirmedCount} of {RISK_SCALES.length} scales confirmed
              {history.trim().length < 10 && ' · history needed'}
              {!complete && confirmedCount === RISK_SCALES.length && history.trim().length >= 10 && ' · tick the declaration'}
            </span>
            <Button
              tone="primary"
              className="ml-auto"
              icon="Signature"
              disabled={!canSign}
              title={canSign ? undefined : 'History, all three scales and the declaration are needed'}
              onClick={() => {
                signNote({ encounterId: noteId, by: me.name, registrationNo: me.identifier, canSign: true })
                toast({
                  tone: 'success',
                  title: 'Admission assessment signed',
                  detail: `Stamped ${me.name} · ${me.identifier}. The NABH clock is closed${overdue ? ', with the delay recorded' : ''}.`,
                })
              }}
            >
              Sign assessment
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {locked && <LockedBanner by={record.signedBy ?? me.name} at={formatDateTime(record.signedAt ?? NOW)} reason="signed" />}
        {overdue && !locked && (
          <Alert tone="abnormal" role="alert" title="This assessment is past its 24-hour window">
            Completing it now is still the right thing to do. The delay is recorded rather than hidden — an accreditation
            record that quietly back-dates itself is worse than one that shows a miss.
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-2">
          <FieldGroup title="History and presenting problem" hint="Dictate or type. The admission note can be carried forward, and is marked as such.">
            <VoiceField
              id="ass-history"
              label="History"
              required
              rows={7}
              value={history}
              onChange={(v) => setSectionText(noteId, 'history', v, carried && v.trim() !== '' ? 'carried' : undefined)}
              onDictated={(meta) => setSectionText(noteId, 'history', meta.text, 'dictated')}
              patientId={p.id}
              disabled={locked}
              labelExtra={
                carried && (
                  <Chip tone="neutral" icon="ArrowRight">
                    carried forward
                  </Chip>
                )
              }
            />
            {history.trim() === '' && !locked && (
              <Button
                tone="tertiary"
                size="sm"
                icon="ArrowRight"
                onClick={() => setSectionText(noteId, 'history', NOTE_DRAFT_SD_P_03[0].draft, 'carried')}
              >
                Carry forward from the admission note
              </Button>
            )}
            <p className="flex items-start gap-1.5 text-[0.86em] text-ink-3">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              Carried-forward text is marked as carried forward, so a reviewer can tell it from something newly
              assessed today.
            </p>
          </FieldGroup>

          <FieldGroup title="Nutrition and functional screening">
            <Field label="Nutrition risk" required htmlFor="ass-nutrition">
              <Select id="ass-nutrition" value={nutrition} disabled={locked} onChange={(e) => setSectionText(noteId, 'nutrition', e.target.value)}>
                {['Not at risk', 'At risk', 'High risk — dietitian referral'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Functional status on admission" required htmlFor="ass-function">
              <Select id="ass-function" value={functional} disabled={locked} aria-label="Functional status" onChange={(e) => setSectionText(noteId, 'function', e.target.value)}>
                {['Independent', 'Needs assistance', 'Fully dependent'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGroup>
        </div>

        <FieldGroup title="Risk assessment scales" hint="Pre-scored · each needs a disposition" span>
          <Why label="How these scales are pre-scored">
            <p className="text-ink-2">
              Three scales are pre-scored from the record. Each still needs your disposition, and the manual scale is
              the fallback — the score is a starting point, not the assessment.
            </p>
          </Why>
          <div className="space-y-4">
            {RISK_SCALES.map((scale) => (
              <Card key={scale.key} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-semibold">{scale.name}</h4>
                    <p className="tabular text-[0.9em] text-ink-2">
                      Score {scale.score} · {scale.band} risk
                    </p>
                  </div>
                  <Chip tone={scale.band === 'High' ? 'abnormal' : 'caution'} icon="TriangleAlert">
                    {scale.band}
                  </Chip>
                </div>

                {/* Only the criteria that are MET — a driver that did not fire is not evidence. */}
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {scale.drivers
                    .filter((d) => !d.toLowerCase().includes('not met'))
                    .map((d) => (
                      <Chip key={d} tone="neutral">
                        {d}
                      </Chip>
                    ))}
                </ul>

                <p className="mt-2.5 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.92em] text-ink-2">
                  <strong>Required action.</strong> {scale.action}
                </p>

                {aiActive && (
                  <AIActionBar
                    className="mt-3"
                    touchpointId={`${enc.id}:scale:${scale.key}`}
                    capabilityId="AI-211"
                    gate="G1"
                    band={scale.confidence >= 0.85 ? 'HIGH' : 'MED'}
                    score={scale.confidence}
                    locked={locked}
                    explain={{
                      touchpointId: `${enc.id}:scale:${scale.key}`,
                      capabilityId: 'AI-211',
                      claim: `${scale.name} scores ${scale.score}, which is ${scale.band.toLowerCase()} risk.`,
                      confidence: scale.confidence,
                      band: scale.confidence >= 0.85 ? 'HIGH' : 'MED',
                      computedAt: formatTime(NOW),
                      inputs: scale.drivers.map((d) => ({ label: d, source: 'Admission record and flowsheet' })),
                      evidence: [scale.action],
                      model: 'risk-scales v2.4.0',
                      limits: [
                        'Scores from what is charted. An unrecorded fall at home does not reach it.',
                        'The manual scale remains the fallback and the authority.',
                        'Scales are validated for adult inpatients only.',
                      ],
                    }}
                  />
                )}
                {/* The manual scale is the fallback and the authority — with the AI off, or after its score is rejected. */}
                {(!aiActive || dispositions[`${enc.id}:scale:${scale.key}`]?.disposition === 'Rejected') && (
                  <Checkbox
                    className="mt-2"
                    checked={record.text[`scale:${scale.key}`] === 'confirmed'}
                    disabled={locked}
                    onChange={(v) => setSectionText(noteId, `scale:${scale.key}`, v ? 'confirmed' : '')}
                    label="Scored manually and confirmed"
                  />
                )}
              </Card>
            ))}
          </div>
        </FieldGroup>

        <Card className="p-5">
          <Checkbox
            checked={complete}
            disabled={locked}
            onChange={(v) => setSectionText(noteId, 'complete', v ? 'yes' : '')}
            label={
              <>
                I have completed the initial assessment, including the risk scales and the actions they require.
                <span className="block text-[0.88em] text-ink-3">
                  Fixed wording. It is stamped with your name, registration number and the time on completion.
                </span>
              </>
            }
          />
        </Card>
      </div>
    </Screen>
  )
}
