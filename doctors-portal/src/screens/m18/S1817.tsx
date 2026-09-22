/**
 * S-18-17 · Thrombolysis Eligibility & Dosing — `/stroke/case/:id/thrombolysis` · T1 · ARC-14
 *
 * "Eligibility, dose, consent and cost — with cost never blocking."
 *
 * Deck beat #21. Three drawing notes, all implemented rather than illustrated:
 *
 *   "Draw the checklist with every item answerable UNKNOWN and each unknown
 *    showing its consequence. That is what makes it usable by a general
 *    physician at 02:00."
 *
 *   "Draw the BP gate with its treat-to-target sub-flow — the item UNBLOCKS
 *    ONLY WHEN BP IS DOCUMENTED BELOW THRESHOLD."
 *
 *   "Draw the cost panel with 'treat now, authorize in parallel'. In India,
 *    settling money is the commonest non-clinical cause of delay."
 *
 * And: "Show the independent second dose check as mandatory EVEN WHEN THE AI IS
 * OFF" — because the check is a rule, not a model output.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Checklist } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Checkbox, Chip, Icon, KeyValue, Select, TextInput, cx } from '@/components/primitives'
import { formatRupees, formatTime } from '@/data/format'
import { STAFF, patient } from '@/data/kit'
import { THROMBOLYSIS_COST, THROMBOLYSIS_CRITERIA, THROMBOLYSIS_DOSE, strokeCase } from '@/data/stroke'
import type { CriterionState } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock, useLiveIntervals } from './CaseClock'

export function S1817({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const intervals = useLiveIntervals()

  const { criteria, answerCriterion, bpTreated, treatBp, secondCheckBy, setSecondCheck, stamp } = useStroke()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  const [bpSystolic, setBpSystolic] = useState('')
  const [bpDiastolic, setBpDiastolic] = useState('')
  const [treating, setTreating] = useState(false)
  const [checker, setChecker] = useState('')
  const [consent, setConsent] = useState(false)
  const [confirmGive, setConfirmGive] = useState(false)
  const [overrideDoac, setOverrideDoac] = useState(false)

  /** The BP item unblocks only when a reading below threshold is DOCUMENTED. */
  const bpResolved = bpTreated !== null && bpTreated.systolic < 185 && bpTreated.diastolic < 110

  const items = THROMBOLYSIS_CRITERIA.map((crit) => {
    let state: CriterionState | 'resolved' = crit.state
    let answer: string = crit.answer

    if (crit.key === 'bp' && bpResolved) {
      state = 'resolved'
      answer = `${bpTreated!.systolic}/${bpTreated!.diastolic} after treatment, documented ${formatTime(bpTreated!.at)}`
    }
    if (crit.key === 'doac' && overrideDoac) {
      state = 'resolved'
      answer = 'Family confirmed the last dose was more than 48 hours ago'
    }
    if (criteria[crit.key]) {
      answer = criteria[crit.key]
      if (criteria[crit.key] === 'Unknown') state = 'unknown'
    }

    return {
      key: crit.key,
      label: crit.label,
      answer: <span className="tabular">{answer}</span>,
      consequence: crit.consequence,
      state,
      subFlow:
        crit.key === 'bp' && !bpResolved ? (
          <div className="rounded-panel border border-caution/35 bg-caution-soft px-3.5 py-3">
            <p className="flex items-center gap-2 font-semibold text-caution">
              <Icon name="Syringe" size={15} />
              {crit.subFlow?.label}
            </p>
            <p className="mt-1 text-[0.92em] text-ink-2">{crit.subFlow?.detail}</p>
            {!treating ? (
              <Button size="sm" tone="primary" className="mt-2.5" onClick={() => setTreating(true)}>
                Start treat-to-target
              </Button>
            ) : (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div>
                  <p className="mb-1 text-[0.86em] font-medium text-ink-2">Systolic</p>
                  <TextInput
                    value={bpSystolic}
                    inputMode="numeric"
                    onChange={(e) => setBpSystolic(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-24"
                    placeholder="172"
                  />
                </div>
                <div>
                  <p className="mb-1 text-[0.86em] font-medium text-ink-2">Diastolic</p>
                  <TextInput
                    value={bpDiastolic}
                    inputMode="numeric"
                    onChange={(e) => setBpDiastolic(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-24"
                    placeholder="94"
                  />
                </div>
                <Button
                  tone="primary"
                  icon="Check"
                  disabled={!bpSystolic || !bpDiastolic}
                  onClick={() => {
                    const s = Number(bpSystolic)
                    const d = Number(bpDiastolic)
                    treatBp(s, d, me.name)
                    if (s >= 185 || d >= 110) {
                      toast({
                        tone: 'caution',
                        title: 'Still above threshold',
                        detail: `${s}/${d} is recorded, and the item stays blocked. Repeat the labetalol and re-measure.`,
                      })
                    } else {
                      toast({
                        tone: 'success',
                        title: 'BP documented below threshold',
                        detail: `${s}/${d} at ${formatTime(caseNow)}. The item is unblocked.`,
                      })
                    }
                  }}
                >
                  Document this reading
                </Button>
                {bpTreated && !bpResolved && (
                  <p className="w-full text-[0.9em] font-medium text-abnormal">
                    {bpTreated.systolic}/{bpTreated.diastolic} recorded at {formatTime(bpTreated.at)} — still above
                    185/110, so the item remains blocked. Documenting a reading is not the same as reaching the target.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : undefined,
      actions: (
        <>
          {crit.actions?.map((a) =>
            a === 'Override with reason' ? (
              <Button key={a} size="sm" tone="destructive" icon="ShieldAlert" onClick={() => setOverrideDoac(true)}>
                {a}
              </Button>
            ) : a === 'Family call' ? (
              <Button
                key={a}
                size="sm"
                icon="PhoneCall"
                onClick={() => {
                  setOverrideDoac(true)
                  toast({
                    tone: 'info',
                    title: 'Family reached',
                    detail: 'Last DOAC dose confirmed as more than 48 hours ago. Recorded against the case.',
                  })
                }}
              >
                {a}
              </Button>
            ) : (
              <Button key={a} size="sm" icon="Send">
                {a}
              </Button>
            ),
          )}
          {/* Every item is answerable unknown. */}
          {crit.state !== 'unknown' && !criteria[crit.key] && (
            <Button size="sm" tone="tertiary" onClick={() => answerCriterion(crit.key, 'Unknown')}>
              Answer unknown
            </Button>
          )}
        </>
      ),
    }
  })

  const blocking = items.filter((i) => i.state === 'blocks' || i.state === 'contraindicated')
  const canGive = blocking.length === 0 && secondCheckBy !== null && consent

  const dtn = intervals.find((i) => i.key === 'dtn')

  return (
    <Screen
      screenId="S-18-17"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={
        <>
          <Chip tone={blocking.length === 0 ? 'normal' : 'abnormal'} icon={blocking.length === 0 ? 'Check' : 'Ban'}>
            {items.length - blocking.length} of {items.length} clear
          </Chip>
          {dtn && (
            <Chip tone={dtn.state === 'BREACH' ? 'abnormal' : 'caution'} className="tabular">
              DTN {dtn.elapsed}/{dtn.targetMin} min
            </Chip>
          )}
        </>
      }
      actions={
        <Button icon="Activity" onClick={() => navigate(`/stroke/case/${c.id}/nihss`)}>
          NIHSS {c.nihss}
        </Button>
      }
      rail={
        <div className="space-y-4">
          {/* Cost. Display only, and the frame says so. */}
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Cost &amp; coverage</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Tenecteplase">
                <span className="tabular font-semibold">{formatRupees(THROMBOLYSIS_COST.drugCost)}</span>
              </KeyValue>
              <KeyValue label="PM-JAY">
                <Chip tone="caution">{THROMBOLYSIS_COST.pmjay}</Chip>
              </KeyValue>
              <KeyValue label="TPA">
                <Chip tone="caution">{THROMBOLYSIS_COST.tpa}</Chip>
              </KeyValue>
            </dl>
            <p className="mt-3 rounded-panel bg-normal-soft px-3 py-2.5 text-[0.9em] font-medium text-normal">
              <Icon name="Check" size={13} className="mr-1 inline" />
              Display only. This panel does not block, and the primary action below does not wait for it.
            </p>
            <p className="mt-2 text-[0.86em] text-ink-3">{THROMBOLYSIS_COST.note}</p>
            <Button
              size="sm"
              className="mt-2.5 w-full"
              icon="Send"
              onClick={() =>
                toast({
                  tone: 'info',
                  title: 'Pre-authorisation raised in parallel',
                  detail: 'The TPA desk has it. It is not on the critical path.',
                })
              }
            >
              Authorise in parallel
            </Button>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why unknown is allowed</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A checklist that only accepts yes or no forces a guess at 02:00. Every item here takes
              &ldquo;unknown&rdquo;, and each unknown shows what follows from it — which is the difference between a
              usable checklist and a form.
            </p>
          </Card>
        </div>
      }
      railTitle="Alongside"
      actionBar={
        <>
          <Button icon="Ban" tone="secondary" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
            Not eligible
          </Button>
          <span className="text-[0.88em] text-ink-3">
            {blocking.length > 0
              ? `${blocking.length} item${blocking.length === 1 ? '' : 's'} blocking`
              : !secondCheckBy
                ? 'The second dose check is outstanding'
                : !consent
                  ? 'Consent is outstanding'
                  : 'Ready'}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Syringe"
            disabled={!canGive}
            onClick={() => setConfirmGive(true)}
          >
            Administer &amp; stamp the needle
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {blocking.length > 0 && (
          <Alert
            tone="abnormal"
            role="alert"
            title={`${blocking.length} item${blocking.length === 1 ? '' : 's'} blocking thrombolysis`}
          >
            Each one names what would unblock it. A blocked item is not a refusal — it is a step you have not taken
            yet.
          </Alert>
        )}

        <ScreenSection
          title="Eligibility"
          subtitle="Every item answerable unknown, and every unknown shows its consequence"
        >
          <Checklist items={items} />
        </ScreenSection>

        {/* The dose. Weight-based, so the weight and its capture time are shown. */}
        <ScreenSection title="Dose" subtitle="Weight-based, so the weight and when it was taken are on the screen">
          <Card className="p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-lg font-semibold">{THROMBOLYSIS_DOSE.drug}</span>
              <span className="tabular text-ink-2">
                {THROMBOLYSIS_DOSE.perKg} {THROMBOLYSIS_DOSE.unit} × {THROMBOLYSIS_DOSE.weightKg} kg
              </span>
              <span className="tabular text-2xl font-bold text-brand">= {THROMBOLYSIS_DOSE.totalMg} mg</span>
              <span className="text-[0.9em] text-ink-3">{THROMBOLYSIS_DOSE.administration}</span>
            </div>

            <p className="tabular mt-2 flex flex-wrap items-center gap-2 text-[0.88em] text-ink-3">
              <Icon name="Scale" size={13} />
              Weight taken {formatTime(THROMBOLYSIS_DOSE.weightCapturedAt)} · {THROMBOLYSIS_DOSE.weightSource}
            </p>

            {/* Mandatory even when the AI is off — it is a rule, not a model. */}
            <div
              className={cx(
                'mt-4 rounded-panel px-4 py-3.5',
                secondCheckBy ? 'bg-normal-soft' : 'border border-caution/40 bg-caution-soft',
              )}
            >
              <p
                className={cx(
                  'flex items-center gap-2 font-semibold',
                  secondCheckBy ? 'text-normal' : 'text-caution',
                )}
              >
                <Icon name={secondCheckBy ? 'Check' : 'Users'} size={16} />
                Independent second check — mandatory
              </p>
              {secondCheckBy ? (
                <p className="mt-1 text-[0.92em] text-ink-2">
                  Checked by {secondCheckBy} at {formatTime(caseNow)}. Both identities are recorded against the
                  administration.
                </p>
              ) : (
                <>
                  <p className="mt-1 text-[0.92em] text-ink-2">
                    A second qualified person recomputes the dose from the weight independently. This is a rule, not an
                    AI output — {aiActive ? 'it is required with the model on and with it off.' : 'the AI is off and it is still required.'}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-end gap-2">
                    <div className="min-w-56">
                      <p className="mb-1 text-[0.86em] font-medium text-ink-2">Who checked it</p>
                      <Select value={checker} onChange={(e) => setChecker(e.target.value)} aria-label="Second checker">
                        <option value="">Select…</option>
                        {STAFF.filter((s) => s.name !== me.name).map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name} · {s.personaLabel}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <Button
                      tone="primary"
                      icon="Check"
                      disabled={!checker}
                      onClick={() => {
                        setSecondCheck(checker)
                        toast({ tone: 'success', title: 'Second check recorded', detail: `${checker} · ${THROMBOLYSIS_DOSE.totalMg} mg` })
                      }}
                    >
                      Record the second check
                    </Button>
                  </div>
                </>
              )}
            </div>

            <Checkbox
              className="mt-3"
              checked={consent}
              onChange={setConsent}
              label={
                <>
                  Consent discussed and taken — risks, benefits and the alternative of not treating.
                  <span className="block text-[0.88em] text-ink-3">
                    Where the patient cannot consent, the discussion with the family is recorded instead. A thumb
                    impression with a witness is a first-class signature mode here.
                  </span>
                </>
              }
            />
          </Card>
        </ScreenSection>

        {aiActive && (
          <Card className="border-l-[3px] border-l-ai p-4">
            <p className="flex items-center gap-2 text-[0.88em] font-semibold text-ai">
              <Diamond size={10} />
              AI-305 · dose-range check
            </p>
            <p className="mt-1.5 text-[0.92em] text-ink-2">
              {THROMBOLYSIS_DOSE.totalMg} mg is within the licensed range for {THROMBOLYSIS_DOSE.weightKg} kg at{' '}
              {THROMBOLYSIS_DOSE.perKg} mg/kg, and below the 25 mg single-bolus ceiling. The static dose table produces
              the same answer with the model off.
            </p>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmGive}
        title="Administer tenecteplase and stamp the needle?"
        consequence={`${THROMBOLYSIS_DOSE.totalMg} mg as a single IV bolus. Stamping the needle closes the door-to-needle interval at the server time and cannot be undone — a correction is an audited amendment on the reconciliation screen.`}
        confirmLabel="Administer and stamp"
        onConfirm={() => {
          stamp('needle', 'Needle', me.name)
          setConfirmGive(false)
          const dtnNow = dtn?.elapsed ?? 0
          toast({
            tone: 'success',
            title: `Needle stamped · DTN ${dtnNow} min`,
            detail: `${THROMBOLYSIS_DOSE.totalMg} mg given by ${me.name}, checked by ${secondCheckBy}. Target was 60 minutes.`,
          })
          navigate(`/stroke/case/${c.id}/transfer`)
        }}
        onCancel={() => setConfirmGive(false)}
      >
        <dl className="divide-y divide-glass-hairline">
          <KeyValue label="Drug">{THROMBOLYSIS_DOSE.drug}</KeyValue>
          <KeyValue label="Dose">
            <span className="tabular font-semibold">{THROMBOLYSIS_DOSE.totalMg} mg</span>
          </KeyValue>
          <KeyValue label="Second check">{secondCheckBy}</KeyValue>
          <KeyValue label="Prescriber">{me.name}</KeyValue>
          <KeyValue label="Server time">
            <span className="tabular">{formatTime(caseNow)}</span>
          </KeyValue>
        </dl>
      </ConfirmDialog>
    </Screen>
  )
}
