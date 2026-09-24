/**
 * S-13-03 · Discharge Medication Reconciliation — `/encounter/:id/med-rec` · T2 · ARC-09
 *
 * "Admission meds against discharge meds, reconciled line by line."
 *
 * ARC-09 is the two-column match: source on the left, target on the right, and
 * AI-306 proposes a match per row at G2. AI-205 runs over the resulting list,
 * because a reconciliation that introduces an interaction is worse than no
 * reconciliation.
 *
 * The rule that makes the screen honest: every admission medicine must be
 * accounted for. "Not carried forward" is a decision, and it needs a reason.
 *
 * Calm: the three-column grid IS the tool, so it stays. What went was the
 * prose around it — the rationale now shows only where a decision is still
 * open or where something changed, and the explanation of the rule is one tap
 * away under the list.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { FieldChip } from '@/components/ai'
import { SectionCard, Why } from '@/components/calm'
import { Button, Icon, Select, TextInput, cx } from '@/components/primitives'
import { encounter } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

type Decision = 'continue' | 'changed' | 'stopped' | 'new' | null

interface MedRow {
  id: string
  /** What the patient was on before or during admission. */
  admission: { drug: string; dose: string; frequency: string } | null
  /** What AI-306 proposes for discharge. */
  proposed: { drug: string; dose: string; frequency: string } | null
  matchConfidence?: number
  matchBand?: 'HIGH' | 'MED' | 'LOW'
  rationale?: string
  /** Interaction or contraindication on the proposed line. */
  caution?: string
}

const ROWS: MedRow[] = [
  {
    id: 'M-1',
    admission: { drug: 'Metformin 500mg', dose: '500 mg', frequency: 'twice daily' },
    proposed: { drug: 'Metformin 500mg', dose: '500 mg', frequency: 'twice daily' },
    matchConfidence: 0.96,
    matchBand: 'HIGH',
    rationale: 'Held during the acute kidney injury and restarted on 23-Sep once creatinine recovered. Unchanged.',
  },
  {
    id: 'M-2',
    admission: { drug: 'Atorvastatin 40mg', dose: '40 mg', frequency: 'at night' },
    proposed: { drug: 'Atorvastatin 40mg', dose: '40 mg', frequency: 'at night' },
    matchConfidence: 0.94,
    matchBand: 'HIGH',
    rationale: 'Continued. No change.',
    caution: 'Interacts with clarithromycin. If a macrolide is added, hold the statin for the course.',
  },
  {
    id: 'M-3',
    admission: { drug: 'Piperacillin-tazobactam 4.5g IV', dose: '4.5 g', frequency: '8-hourly' },
    proposed: { drug: 'Levofloxacin 750mg', dose: '750 mg', frequency: 'once daily, 3 days' },
    matchConfidence: 0.72,
    matchBand: 'MED',
    rationale:
      'Intravenous cover switched to an oral step-down. Not a like-for-like substitution — the class changed because of the documented penicillin allergy.',
  },
  {
    id: 'M-4',
    admission: { drug: 'Enoxaparin 40mg SC', dose: '20 mg', frequency: 'once daily (renally adjusted)' },
    proposed: null,
    matchConfidence: 0.88,
    matchBand: 'HIGH',
    rationale: 'Thromboprophylaxis for the inpatient stay only. Stopped on discharge as mobility is restored.',
  },
  {
    id: 'M-5',
    admission: null,
    proposed: { drug: 'Paracetamol 1g IV', dose: '1 g oral', frequency: '6-hourly as required, max 4 g in 24 hours' },
    matchConfidence: 0.9,
    matchBand: 'HIGH',
    rationale: 'New on discharge for residual pleuritic pain. A 24-hour ceiling is stated, per the completeness rule.',
  },
]

const DECISION_LABEL: Record<Exclude<Decision, null>, string> = {
  continue: 'Continued',
  changed: 'Changed',
  stopped: 'Stopped',
  new: 'New',
}

/** "Continued. No change." says nothing the row does not — it is not shown. */
const isTrivial = (t: string) => /^continued\.?\s*no change\.?$/i.test(t.trim())

const COLUMN_HEAD = 'text-[0.8em] font-bold tracking-[0.08em] text-ink-3 uppercase'

export function S1303({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)

  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const undecided = ROWS.filter((r) => !decisions[r.id])
  /** A "stopped" line needs a reason — it is a decision, not an omission. */
  const missingReason = ROWS.filter((r) => decisions[r.id] === 'stopped' && !(reasons[r.id] ?? '').trim())
  const interactions = ROWS.filter((r) => r.caution).length

  const done = undecided.length === 0 && missingReason.length === 0

  return (
    <Screen
      screenId="S-13-03"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      subheading={
        <>
          {ROWS.length - undecided.length} of {ROWS.length} reconciled
          {interactions > 0 && ` · ${interactions} interaction${interactions === 1 ? '' : 's'} to note`}
        </>
      }
      actions={
        <Button icon="FileText" onClick={() => navigate(`/encounter/${enc.id}/discharge-summary`)}>
          Discharge summary
        </Button>
      }
      actionBar={
        <>
          <span className="text-[0.88em] text-ink-3">
            {undecided.length > 0
              ? `${undecided.length} medicine${undecided.length === 1 ? '' : 's'} unaccounted for`
              : missingReason.length > 0
                ? `${missingReason.length} stopped medicine${missingReason.length === 1 ? '' : 's'} needs a reason`
                : 'Every medicine is accounted for'}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Check"
            disabled={!done}
            onClick={() => {
              toast({
                tone: 'success',
                title: 'Medication reconciled',
                detail: 'The discharge list is fixed and flows into the summary and the prescription.',
              })
              navigate(`/encounter/${enc.id}/discharge-summary`)
            }}
          >
            Confirm the discharge list
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <SectionCard
          title="Line by line"
          meta={<span className="tabular text-[0.86em] text-ink-3">{ROWS.length} medicines</span>}
          bodyClassName="px-0 pb-0 sm:px-0 sm:pb-0"
        >
          {/* Column headers, visible above md. */}
          <div className="hidden border-b border-glass-hairline px-4 py-2 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-4 sm:px-5">
            <p className={COLUMN_HEAD}>On admission</p>
            <p className={cx(COLUMN_HEAD, 'w-44 text-center')}>Decision</p>
            <p className={COLUMN_HEAD}>On discharge</p>
          </div>

          <ul className="divide-y divide-glass-hairline">
            {ROWS.map((r) => {
              const decision = decisions[r.id]
              const showRationale =
                r.rationale && !isTrivial(r.rationale) && (!decision || decision === 'stopped' || decision === 'changed')
              return (
                <li
                  key={r.id}
                  className={cx(
                    'px-4 py-4 sm:px-5',
                    !decision && 'bg-caution-soft/30',
                    decision === 'stopped' && !(reasons[r.id] ?? '').trim() && 'bg-abnormal-soft/30',
                  )}
                >
                  <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start md:gap-4">
                    {/* Left — admission. */}
                    <div className="min-w-0">
                      {r.admission ? (
                        <>
                          <p className="font-medium">{r.admission.drug}</p>
                          <p className="tabular text-[0.88em] text-ink-3">
                            {r.admission.dose} · {r.admission.frequency}
                          </p>
                        </>
                      ) : (
                        <p className="text-[0.9em] text-ink-3">
                          <Icon name="Minus" size={12} className="mr-1 inline" />
                          not on admission
                        </p>
                      )}
                    </div>

                    {/* Middle — the decision. */}
                    <div className="md:w-44">
                      <Select
                        value={decision ?? ''}
                        onChange={(e) => setDecisions((d) => ({ ...d, [r.id]: (e.target.value || null) as Decision }))}
                        aria-label={`Decision for ${r.admission?.drug ?? r.proposed?.drug}`}
                        className="min-h-11 py-1.5 text-[0.9em]"
                      >
                        <option value="">Decide…</option>
                        {(['continue', 'changed', 'stopped', 'new'] as const).map((k) => (
                          <option key={k} value={k}>
                            {DECISION_LABEL[k]}
                          </option>
                        ))}
                      </Select>
                      {aiActive && r.matchBand && !decision && (
                        <div className="mt-2">
                          <FieldChip
                            touchpointId={`${enc.id}:medrec:${r.id}`}
                            capabilityId="AI-306"
                            suggestion={
                              r.proposed === null ? 'Stopped' : r.admission === null ? 'New' : r.matchBand === 'HIGH' ? 'Continued' : 'Changed'
                            }
                            band={r.matchBand}
                            score={r.matchConfidence}
                            gate="G2"
                            onAccept={() =>
                              setDecisions((d) => ({
                                ...d,
                                [r.id]:
                                  r.proposed === null
                                    ? 'stopped'
                                    : r.admission === null
                                      ? 'new'
                                      : r.matchBand === 'HIGH'
                                        ? 'continue'
                                        : 'changed',
                              }))
                            }
                            explain={{
                              touchpointId: `${enc.id}:medrec:${r.id}`,
                              capabilityId: 'AI-306',
                              claim: r.rationale ?? 'A proposed match between the admission and discharge lists.',
                              confidence: r.matchConfidence ?? 0.8,
                              band: r.matchBand,
                              computedAt: formatTime(NOW),
                              inputs: [
                                ...(r.admission ? [{ label: r.admission.drug, source: 'Admission medication list' }] : []),
                                ...(r.proposed ? [{ label: r.proposed.drug, source: 'Inpatient medication record' }] : []),
                                { label: 'Renal function trend', source: 'Result R-88405' },
                                { label: 'Documented allergies', source: `Allergy record ${p.id}` },
                              ],
                              evidence: [r.rationale ?? ''],
                              model: 'med-rec v2.5.0',
                              limits: [
                                'Matches by drug, class and indication. A class switch is deliberately low confidence.',
                                'It cannot know what the patient actually took at home.',
                                'Manual side-by-side comparison is the fallback.',
                              ],
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Right — discharge. */}
                    <div className="min-w-0">
                      {r.proposed ? (
                        <>
                          <p className="font-medium">{r.proposed.drug}</p>
                          <p className="tabular text-[0.88em] text-ink-3">
                            {r.proposed.dose} · {r.proposed.frequency}
                          </p>
                        </>
                      ) : (
                        <p className="text-[0.9em] font-medium text-caution">
                          <Icon name="Ban" size={12} className="mr-1 inline" />
                          not carried forward
                        </p>
                      )}
                    </div>
                  </div>

                  {showRationale && <p className="mt-2 text-[0.9em] text-ink-2">{r.rationale}</p>}

                  {/* A real interaction on the discharge line — operative, so it stays. */}
                  {r.caution && (
                    <p className="mt-2 flex items-start gap-2 text-[0.88em] font-medium text-caution">
                      <Icon name="TriangleAlert" size={13} className="mt-0.5 shrink-0" />
                      {r.caution}
                    </p>
                  )}

                  {decision === 'stopped' && (
                    <div className="mt-2.5">
                      <TextInput
                        value={reasons[r.id] ?? ''}
                        onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
                        placeholder="Why it is not carried forward — required"
                        className={cx(!(reasons[r.id] ?? '').trim() && 'border-abnormal')}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </SectionCard>

        <Why label="Why every line needs a decision">
          <p className="text-ink-2">
            Every admission medicine must be accounted for. &ldquo;Not carried forward&rdquo; is a decision with a
            reason, not a blank — a medicine that silently disappears from the list is how a patient stops taking
            something they needed. The list cannot be confirmed with an unaccounted-for medicine on it.
          </p>
          <p className="text-[0.92em] text-ink-3">
            AI-306 proposes a match per row at G2. Where the class changed — an IV beta-lactam to an oral
            fluoroquinolone — the confidence drops and the rationale says why it is not like-for-like. AI-205 checks
            the resulting list for interactions. Fallback: manual side-by-side comparison.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
