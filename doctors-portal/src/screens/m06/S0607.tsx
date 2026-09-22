/**
 * S-06-07 · Prescription Writer — `/encounter/:id/rx` · T1 · ARC-07
 *
 * "Prescribing — and the one screen where the AI is visibly overruled."
 *
 * The atlas calls this "DECK BEAT #8 — THE SINGLE MOST IMPORTANT FRAME IN THE
 * DECK", and says why: "This is where the AI story converts from a risk into a
 * reassurance... Show the deterministic nature plainly — THE BLOCK IS NOT THE
 * MODEL'S OPINION, IT IS A RULE."
 *
 * So three things are true in the code, not just in the copy:
 *   1. The hard stop is computed from the allergy record and the drug class.
 *      It does not consult a confidence score, and it fires with the AI off.
 *   2. Sign cannot be reached while a hard stop is outstanding — the gate modal
 *      is not dismissible without a disposition.
 *   3. An override needs a reason AND a second consultant's authentication, and
 *      records both identities.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { canPrescribe } from '@/atlas/personas'
import { Confidence, Diamond, DualSignatureGate, FieldChip, HardStopGate, SuggestionCard } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import {
  Alert,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Field,
  Icon,
  KeyValue,
  Select,
  TextArea,
  TextInput,
  Toggle,
  cx,
} from '@/components/primitives'
import { LockedBanner } from '@/components/states'
import {
  FORMULARY,
  PENICILLIN_HARD_STOP,
  RX_BASKET_SD_P_01,
  RX_BASKET_SD_P_03,
  encounter,
} from '@/data/clinical'
import type { RxLine } from '@/data/clinical'
import { formatDateTime, formatRupees, formatTime, NOW } from '@/data/format'
import { STAFF, patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { allDispositioned, outstandingCount } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

/**
 * The deterministic rule. It reads the documented allergy and the drug's class
 * from the formulary — nothing else. No model, no threshold, no confidence.
 * This is the function that makes the demo honest.
 */
function hardStopFor(drug: string, allergies: string[]): typeof PENICILLIN_HARD_STOP | undefined {
  const entry = FORMULARY.find((f) => f.drug === drug)
  if (!entry?.betaLactam) return undefined
  if (!allergies.includes('Penicillin')) return undefined
  return PENICILLIN_HARD_STOP
}

export function S0607({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const persona = useSession((s) => s.persona)
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const seedBasket = enc.patientId === 'SD-P-03' ? RX_BASKET_SD_P_03 : RX_BASKET_SD_P_01

  const { rx, signRx, removeRxLine, substitute, overrideHardStop } = useClinical()
  const record = rx(enc.id)

  const [gateOpen, setGateOpen] = useState(false)
  const [dualOpen, setDualOpen] = useState(false)
  const [confirmSign, setConfirmSign] = useState(false)
  const [search, setSearch] = useState('')
  const [added, setAdded] = useState<RxLine[]>([])

  const mayPrescribe = canPrescribe(persona)
  const locked = record.status === 'signed' || forced === 'LOCKED'

  /** The live basket: seeded lines minus removals, plus substitutions and additions. */
  const basket: RxLine[] = useMemo(() => {
    const fromSeed = seedBasket
      .filter((l) => !record.removedLines.includes(l.id))
      .map((l) => {
        const sub = record.substitutions[l.id]
        if (!sub) return l
        const alt = PENICILLIN_HARD_STOP.alternatives.find((a) => a.drug === sub)
        return {
          ...l,
          drug: alt ? `${alt.drug} ${alt.dose} ${alt.route}` : sub,
          dose: alt?.dose ?? l.dose,
          route: alt?.route ?? l.route,
          frequency: alt?.frequency ?? l.frequency,
          hardStop: undefined,
        }
      })
    return [...fromSeed, ...added]
  }, [seedBasket, record.removedLines, record.substitutions, added])

  /** Recomputed from the rule on every render — never cached from the seed. */
  const blocked = basket.filter((l) => hardStopFor(l.drug, p.allergies) !== undefined)
  const outstandingStop = blocked.length > 0 && !record.override

  const g2Touchpoints = basket.filter((l) => l.doseAdjustment).map((l) => `${enc.id}:dose:${l.id}`)
  const outstanding = outstandingCount(g2Touchpoints)
  const dosesDispositioned = allDispositioned(g2Touchpoints)

  const completenessGaps = basket.filter((l) => l.completenessGap)
  const canSign =
    mayPrescribe && !locked && !outstandingStop && dosesDispositioned && basket.length > 0 && completenessGaps.length === 0

  const matches = search.trim()
    ? FORMULARY.filter((f) => f.drug.toLowerCase().includes(search.trim().toLowerCase()))
    : FORMULARY.slice(0, 6)

  function addDrug(drug: string) {
    const entry = FORMULARY.find((f) => f.drug === drug)
    const stop = hardStopFor(drug, p.allergies)
    setAdded((a) => [
      ...a,
      {
        id: `RX-NEW-${a.length + 1}`,
        drug,
        dose: '—',
        route: drug.includes('IV') ? 'IV' : 'Oral',
        frequency: 'as prescribed',
        durationDays: 5,
        substitutionAllowed: entry?.nlem ?? true,
        hardStop: stop,
        completenessGap: 'Dose, frequency and duration are not stated yet.',
      },
    ])
    setSearch('')
    if (stop) {
      setGateOpen(true)
    } else if (entry?.nlem) {
      toast({
        tone: 'info',
        title: `${drug} is on the NLEM`,
        detail: `DPCO ceiling ${formatRupees(entry.ceilingPrice)}. Substitution is permitted by default.`,
      })
    }
  }

  return (
    <Screen
      screenId="S-06-07"
      patient={p}
      loadingShape="form"
      states={[
        'LOADING',
        'EMPTY',
        'PARTIAL',
        'ERROR',
        'VALIDATION',
        'DENIED',
        'BREAKGLASS',
        'OFFLINE',
        'SAVING',
        'LOCKED',
        'AI-OFF',
        'AI-ABSTAIN',
        'AI-LOW',
      ]}
      chips={
        <>
          <Chip tone={locked ? 'inactive' : 'caution'} icon={locked ? 'Lock' : 'Pill'}>
            {locked ? 'Signed' : 'Draft'}
          </Chip>
          {outstandingStop && (
            <Chip tone="critical" icon="OctagonAlert">
              Hard stop outstanding
            </Chip>
          )}
          {record.override && (
            <Chip tone="critical" icon="ShieldAlert">
              Overridden · dual signature
            </Chip>
          )}
        </>
      }
      actions={
        <Button icon="FileText" onClick={() => navigate(`/encounter/${enc.id}/note`)}>
          Back to the note
        </Button>
      }
      rail={<Rail encounterId={enc.id} basket={basket} />}
      railTitle="Checks & suggestions"
      actionBar={
        locked ? (
          <>
            <span className="flex items-center gap-2 text-[0.9em] text-ink-3">
              <Icon name="Lock" size={14} />
              Signed by {record.signedBy} · {record.registrationNo}
              {record.signedAt && ` · ${formatDateTime(record.signedAt)}`}
            </span>
            <div className="ml-auto flex gap-2">
              <Button icon="Printer">Print A5, bilingual</Button>
              <Button tone="primary" icon="ArrowRight" onClick={() => navigate('/clinician')}>
                Done
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="text-[0.88em] text-ink-3">
              {basket.length} {basket.length === 1 ? 'item' : 'items'} · {p.payer}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {outstandingStop && (
                <span className="flex items-center gap-1.5 text-[0.88em] font-semibold text-critical">
                  <Icon name="OctagonAlert" size={14} />
                  Resolve the hard stop first
                </span>
              )}
              {!outstandingStop && outstanding > 0 && (
                <span className="text-[0.88em] font-medium text-caution">
                  {outstanding} dose {outstanding === 1 ? 'adjustment needs' : 'adjustments need'} a decision
                </span>
              )}
              {!mayPrescribe && (
                <span className="text-[0.88em] font-medium text-caution">
                  This persona may draft, not sign — controlled classes need a consultant
                </span>
              )}
              <Button
                tone="primary"
                icon="Signature"
                disabled={!canSign}
                onClick={() => setConfirmSign(true)}
              >
                Sign prescription
              </Button>
            </div>
          </>
        )
      }
    >
      <div className="space-y-5">
        {locked && (
          <LockedBanner
            by={record.signedBy ?? me.name}
            at={record.signedAt ? formatDateTime(record.signedAt) : formatTime(NOW)}
            reason="signed"
          />
        )}

        {/* The blocked line, surfaced on the page and not only in the modal, so
            the state is legible without reopening the gate. */}
        {outstandingStop && (
          <Alert
            tone="critical"
            role="alert"
            title={`${blocked[0].drug} is blocked for this patient`}
            action={
              <Button tone="destructive" size="sm" icon="OctagonAlert" onClick={() => setGateOpen(true)}>
                Resolve
              </Button>
            }
          >
            {PENICILLIN_HARD_STOP.finding} This is a static allergy-class rule, not a model output —{' '}
            {aiActive ? 'it would fire identically with the AI switched off.' : 'and the AI is currently off.'}
          </Alert>
        )}

        {record.override && (
          <Alert tone="critical" title="Hard stop overridden with a dual signature">
            <dl className="mt-1 space-y-0.5 text-[0.95em]">
              <div>Prescriber: {record.override.prescriber}</div>
              <div>Second consultant: {record.override.coSigner}</div>
              <div>Reason: {record.override.reason}</div>
              {record.override.reasonText && <div className="text-ink-2">&ldquo;{record.override.reasonText}&rdquo;</div>}
              <div className="tabular text-ink-3">
                <code className="font-mono">{record.override.auditEvent}</code> ·{' '}
                {formatDateTime(record.override.at)} · reviewed within 24 hours
              </div>
            </dl>
          </Alert>
        )}

        {/* ARC-07: >=1280 two-pane. Z5a catalogue, Z5b basket. */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Z5a — search and catalogue. */}
          <ScreenSection title="Formulary" subtitle="`/` focuses search · Enter adds to the basket">
            <Card className="p-4">
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches[0]) {
                    e.preventDefault()
                    addDrug(matches[0].drug)
                  }
                }}
                placeholder="Search the formulary…"
                disabled={locked}
              />
              <ul className="mt-3 space-y-1.5">
                {matches.map((f) => {
                  const wouldBlock = hardStopFor(f.drug, p.allergies) !== undefined
                  return (
                    <li key={f.drug}>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => addDrug(f.drug)}
                        className="flex w-full min-h-11 items-center gap-2.5 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover disabled:opacity-50"
                      >
                        <Icon name="Pill" size={15} className="shrink-0 text-ink-3" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{f.drug}</span>
                          <span className="tabular block text-[0.84em] text-ink-3">
                            {f.nlem ? 'NLEM' : 'non-NLEM'} · ceiling {formatRupees(f.ceilingPrice)}
                          </span>
                        </span>
                        {wouldBlock && (
                          <Chip tone="critical" icon="OctagonAlert" title="Contraindicated by a documented allergy">
                            blocked
                          </Chip>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
              <p className="mt-3 text-[0.84em] text-ink-3">
                CMP-DRUG-03 · an NLEM-listed equivalent is prompted as a substitution, and the DPCO ceiling is shown
                rather than the sticker price.
              </p>
            </Card>
          </ScreenSection>

          {/* Z5b — the basket. */}
          <ScreenSection title="Prescription" subtitle={`${p.name} · ${p.weightKg} kg · ${p.payer}`}>
            {basket.length === 0 ? (
              <Card>
                <EmptyState
                  icon="Pill"
                  why="Nothing prescribed yet. Search the formulary on the left and press Enter to add the first item."
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {basket.map((line) => (
                  <RxLineCard
                    key={line.id}
                    line={line}
                    encounterId={enc.id}
                    patientWeight={p.weightKg ?? 70}
                    locked={locked}
                    hardStop={hardStopFor(line.drug, p.allergies)}
                    overridden={record.override?.lineId === line.id}
                    onOpenGate={() => setGateOpen(true)}
                    onRemove={() => removeRxLine(enc.id, line.id)}
                  />
                ))}
              </div>
            )}
          </ScreenSection>
        </div>
      </div>

      {/* AIP-09 — not dismissible without a disposition. */}
      <HardStopGate
        open={gateOpen && outstandingStop}
        capabilityId="AI-205"
        drug={blocked[0]?.drug ?? ''}
        rule={PENICILLIN_HARD_STOP.rule}
        finding={PENICILLIN_HARD_STOP.finding}
        documentedAt={PENICILLIN_HARD_STOP.documentedAt}
        documentedBy={PENICILLIN_HARD_STOP.documentedBy}
        alternatives={PENICILLIN_HARD_STOP.alternatives}
        onAcceptAlternative={(drug) => {
          const target = blocked[0]
          if (target.id.startsWith('RX-NEW')) {
            setAdded((a) => a.filter((l) => l.id !== target.id))
            const alt = PENICILLIN_HARD_STOP.alternatives.find((x) => x.drug === drug)
            if (alt) {
              setAdded((a) => [
                ...a,
                {
                  id: `RX-ALT-${a.length + 1}`,
                  drug: `${alt.drug} ${alt.dose} ${alt.route}`,
                  dose: alt.dose,
                  route: alt.route,
                  frequency: alt.frequency,
                  durationDays: 7,
                  substitutionAllowed: true,
                  indication: 'Community-acquired pneumonia (J18.9)',
                },
              ])
            }
          } else {
            substitute(enc.id, target.id, drug)
          }
          setGateOpen(false)
          toast({
            tone: 'success',
            title: `${drug} substituted`,
            detail: 'No beta-lactam cross-reactivity. No override was needed.',
          })
        }}
        onOverride={() => {
          setGateOpen(false)
          setDualOpen(true)
        }}
        onCancel={() => {
          const target = blocked[0]
          if (target.id.startsWith('RX-NEW')) {
            setAdded((a) => a.filter((l) => l.id !== target.id))
          } else {
            removeRxLine(enc.id, target.id)
          }
          setGateOpen(false)
          toast({ tone: 'info', title: `${target.drug} removed from the prescription` })
        }}
      />

      {/* G4 — reason AND a second consultant, both identities recorded. */}
      <DualSignatureGate
        open={dualOpen}
        what={`You are prescribing ${blocked[0]?.drug ?? 'a contraindicated drug'} to a patient with a documented penicillin allergy.`}
        auditEvent={PENICILLIN_HARD_STOP.auditEvent}
        prescriber={me.name}
        coSignerOptions={STAFF.filter((s) => s.identifierKind === 'HPR').map((s) => ({
          name: s.name,
          identifier: s.identifier,
        }))}
        onCancel={() => {
          setDualOpen(false)
          setGateOpen(true)
        }}
        onConfirm={({ reason, reasonText, coSigner }) => {
          overrideHardStop({
            encounterId: enc.id,
            lineId: blocked[0].id,
            reason,
            reasonText,
            prescriber: me.name,
            coSigner,
            auditEvent: PENICILLIN_HARD_STOP.auditEvent,
          })
          setDualOpen(false)
          toast({
            tone: 'critical',
            title: 'Hard stop overridden',
            detail: `${PENICILLIN_HARD_STOP.auditEvent} emitted. Both identities recorded. Reviewed within 24 hours.`,
          })
        }}
      />

      <ConfirmDialog
        open={confirmSign}
        title="Sign this prescription?"
        consequence={`Signing is irreversible. The prescription is committed with your name and ${me.identifierKind} ${me.identifier}, printed bilingually on A5, sent to the pharmacy dispensing queue, and queued to publish to ABDM.`}
        confirmLabel="Sign prescription"
        onConfirm={() => {
          signRx({ encounterId: enc.id, by: me.name, registrationNo: me.identifier })
          setConfirmSign(false)
          toast({
            tone: 'success',
            title: 'Prescription signed',
            detail: `HPR ${me.identifier} printed on it. Now in the pharmacy queue.`,
          })
        }}
        onCancel={() => setConfirmSign(false)}
      />
    </Screen>
  )
}

/** One basket line, with AI-206's dose adjustment and AI-305's completeness gap. */
function RxLineCard({
  line,
  encounterId,
  patientWeight,
  locked,
  hardStop,
  overridden,
  onOpenGate,
  onRemove,
}: {
  line: RxLine
  encounterId: string
  patientWeight: number
  locked: boolean
  hardStop?: typeof PENICILLIN_HARD_STOP
  overridden?: boolean
  onOpenGate: () => void
  onRemove: () => void
}) {
  const [substitution, setSubstitution] = useState(line.substitutionAllowed)
  const [instructions, setInstructions] = useState(line.instructions ?? '')
  const [dose, setDose] = useState(line.dose)

  const blockedNow = hardStop && !overridden

  return (
    <Card
      className={cx(
        'p-4',
        blockedNow && 'border-critical/50 ring-1 ring-critical/30',
        overridden && 'border-critical/40',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <Icon name="Pill" size={15} className="text-ink-3" />
            {line.drug}
            {blockedNow && (
              <Chip tone="critical" icon="OctagonAlert">
                Blocked
              </Chip>
            )}
            {overridden && (
              <Chip tone="critical" icon="ShieldAlert">
                Overridden
              </Chip>
            )}
          </p>
          {line.indication && <p className="mt-0.5 text-[0.88em] text-ink-3">for {line.indication}</p>}
        </div>
        <div className="flex items-center gap-1">
          {blockedNow && (
            <Button tone="destructive" size="sm" onClick={onOpenGate}>
              Resolve
            </Button>
          )}
          <Button tone="tertiary" size="sm" icon="Trash2" disabled={locked} onClick={onRemove}>
            Remove
          </Button>
        </div>
      </div>

      <Divider className="my-3" />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          label="Dose"
          required
          hint={`Per-kg doses show the weight and its capture time · ${patientWeight} kg`}
          aiSlot={
            line.doseAdjustment && (
              <FieldChip
                touchpointId={`${encounterId}:dose:${line.id}`}
                capabilityId="AI-206"
                suggestion={line.doseAdjustment.proposed}
                band={line.doseAdjustment.band}
                score={line.doseAdjustment.confidence}
                gate="G2"
                onAccept={() => setDose(line.doseAdjustment!.proposed)}
                explain={{
                  touchpointId: `${encounterId}:dose:${line.id}`,
                  capabilityId: 'AI-206',
                  claim: `The dose should be reduced to ${line.doseAdjustment.proposed} for renal function.`,
                  confidence: line.doseAdjustment.confidence,
                  band: line.doseAdjustment.band,
                  computedAt: formatTime(NOW),
                  inputs: [
                    { label: 'Serum creatinine 212 µmol/L, 21-Sep-2026', source: 'Result R-88405' },
                    { label: `Weight ${patientWeight} kg`, source: 'Vitals, most recent set' },
                    { label: 'Drug renal-dosing table', source: 'Drug knowledge base' },
                  ],
                  evidence: [line.doseAdjustment.reason],
                  model: 'renal-dose v2.1.4',
                  limits: [
                    'Uses the most recent creatinine. It does not know if the patient is still deteriorating.',
                    'The printed dosing reference remains the fallback.',
                    'Does not cover dialysis or continuous renal replacement.',
                  ],
                }}
              />
            )
          }
        >
          <TextInput value={dose} disabled={locked} onChange={(e) => setDose(e.target.value)} />
        </Field>

        <Field label="Route & frequency" required>
          <Select
            disabled={locked}
            defaultValue={`${line.route} · ${line.frequency}`}
            aria-label="Route and frequency"
          >
            <option>{`${line.route} · ${line.frequency}`}</option>
            <option>IV · 12-hourly</option>
            <option>Oral · once daily</option>
          </Select>
        </Field>

        <Field label="Duration" required>
          <Select disabled={locked} defaultValue={String(line.durationDays)} aria-label="Duration in days">
            {[3, 5, 7, 14, 180].map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* AI-305 completeness, as an AIP-05 strip on the line it concerns. */}
      {line.completenessGap && (
        <div className="mt-3 flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2">
          <Diamond size={10} className="mt-1 shrink-0" />
          <p className="text-[0.9em] font-medium text-caution">
            AI-305 · {line.completenessGap}
            <span className="ml-1 font-normal opacity-80">
              Static dose tables produce this even with the model off.
            </span>
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2.5 text-[0.9em]">
          <Toggle checked={substitution} onChange={setSubstitution} label="Substitution allowed" />
          Substitution allowed
          <span className="text-ink-3">— drives pharmacy dispensing</span>
        </label>
      </div>

      <Field
        label="Instructions for the patient"
        className="mt-3"
        hint="Printed bilingually — English plus the patient's preferred language (CMP-DPDP-02)"
      >
        <TextArea
          rows={2}
          disabled={locked}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="How to take it, and what to avoid…"
        />
      </Field>
    </Card>
  )
}

/** Z6 — the checks, with what survives the AI being off stated plainly. */
function Rail({ encounterId, basket }: { encounterId: string; basket: RxLine[] }) {
  const aiActive = useAI(selectAiActive)

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Safety checks</h3>
        <dl className="mt-2 divide-y divide-glass-hairline">
          <KeyValue label="Allergy & interaction">
            <span className="flex items-center gap-1.5 text-normal">
              <Icon name="ShieldCheck" size={14} />
              Deterministic
            </span>
          </KeyValue>
          <KeyValue label="Dose range">
            <span className="flex items-center gap-1.5 text-normal">
              <Icon name="ShieldCheck" size={14} />
              Static tables
            </span>
          </KeyValue>
          <KeyValue label="Renal adjustment">
            <span className={cx('flex items-center gap-1.5', aiActive ? 'text-ai' : 'text-inactive')}>
              {aiActive ? <Diamond size={10} /> : <Icon name="CircleDot" size={14} />}
              {aiActive ? 'AI-206 live' : 'printed reference'}
            </span>
          </KeyValue>
        </dl>
        <p className="mt-3 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.88em] text-ink-2">
          The first two never switch off. Safety on this screen does not depend on a model being up — which is why the
          block still fires in the AI-OFF state.
        </p>
      </Card>

      {basket.some((l) => l.doseAdjustment) && (
        <SuggestionCard
          touchpointId={`${encounterId}:stewardship`}
          capabilityId="AI-305"
          title="Two lines are missing a stated ceiling"
          evidence="A PRN analgesic without a 24-hour maximum is the commonest documentation gap found at NABH audit."
          band="HIGH"
          score={0.91}
          gate="G2"
          explain={{
            touchpointId: `${encounterId}:stewardship`,
            capabilityId: 'AI-305',
            claim: 'The prescription is incomplete: a PRN line has no maximum daily dose.',
            confidence: 0.91,
            band: 'HIGH',
            computedAt: formatTime(NOW),
            inputs: [{ label: 'Prescription lines in the basket', source: `Encounter ${encounterId}` }],
            evidence: ['CMP-NABH-05 requires orders to be legible and complete.'],
            model: 'rx-complete v1.8.0',
            limits: [
              'Checks structure and dose ranges, not clinical appropriateness.',
              'The static dose-range tables remain when the model is unavailable.',
            ],
          }}
        />
      )}

      <Card className="p-4">
        <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">On signing</h3>
        <ul className="mt-2 space-y-2 text-[0.9em] text-ink-2">
          {[
            'Printed A5, bilingual, with your HPR number on it',
            'Sent to the pharmacy dispensing queue',
            'Queued to publish to ABDM as a Prescription record',
            'No PHI goes out in any SMS — only a pointer back in',
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
              {t}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
          <Diamond size={10} />
          Confidence is not the point here
        </p>
        <Confidence band="HIGH" score={0.96} className="mt-2" />
        <p className="mt-2 text-[0.9em] text-ink-2">
          A hard stop has no confidence band, because it is not a prediction. It is the allergy record and the drug
          class, and nothing else.
        </p>
      </Card>
    </div>
  )
}
