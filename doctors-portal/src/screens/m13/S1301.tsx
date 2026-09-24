/**
 * S-13-01 · Discharge Readiness Board — `/discharge/board` · T1 · ARC-04
 *
 * "Who goes home today, known at 07:00 instead of 16:00."
 *
 * Deck beat #24. Two capabilities, and the second is the one that surprises
 * people: AI-610 predicts the clinical discharge, and AI-514 predicts the
 * FINANCIAL clearance — because a medically fit patient waiting on a TPA
 * approval is the commonest reason a bed does not free up.
 *
 * Two views, and the calm one is the default. The LIST is what a consultant
 * on the 07:00 round wants: who is likely to go home today, what is in the
 * way, one row each. Tomorrow and the rest are one tap away. The BOARD is
 * `ARC-04`, kept behind a button because it does a job the list cannot — the
 * drag that moves a patient, refused with an inline reason when a hard rule
 * says no. Its far columns are folded until tapped for the same reason.
 *
 * ARC-04's load-bearing rule is implemented here: "a drag that violates a hard
 * rule is refused with an inline reason on the target", never silently
 * reverted.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Board } from '@/archetypes'
import type { BoardColumn } from '@/archetypes'
import { WhyLink } from '@/components/ai'
import { ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { Button, Card, Chip, Icon } from '@/components/primitives'
import { StaleChip } from '@/components/states'
import { DISCHARGE_BOARD, encounterForPatient } from '@/data/clinical'
import type { DischargeRow } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import type { ExplainTarget } from '@/store/ui'
import { useUI } from '@/store/ui'
import { useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

type ColumnKey = 'today' | 'tomorrow' | 'notyet' | 'gone'
type Scope = 'today' | 'tomorrow' | 'notyet'

const SCOPES: readonly Scope[] = ['today', 'tomorrow', 'notyet']
const COMPUTED_AT = new Date(2026, 8, 21, 7, 0)

const LIKELIHOOD: Record<DischargeRow['likelihood'], { tone: 'normal' | 'caution' | 'inactive'; icon: string }> = {
  Today: { tone: 'normal', icon: 'CalendarCheck' },
  Tomorrow: { tone: 'caution', icon: 'Clock' },
  'Not yet': { tone: 'inactive', icon: 'Ban' },
}

/** The AI-610 provenance, reached from the `Why?` on a row or a card. */
function explainFor(r: DischargeRow): ExplainTarget {
  const p = patient(r.patientId)
  return {
    touchpointId: `discharge:${r.patientId}`,
    capabilityId: 'AI-610',
    claim: `${p.name} is predicted to be discharged ${r.likelihood.toLowerCase()}.`,
    confidence: r.confidence,
    band: r.band,
    computedAt: formatTime(COMPUTED_AT),
    inputs: [
      { label: 'Observation trend, last 48 hours', source: 'Flowsheet' },
      { label: 'Active orders and their status', source: `Orders for ${p.id}` },
      { label: 'Length of stay against the pathway', source: 'Care pathway' },
      { label: 'Financial clearance state', source: 'Billing · AI-514' },
    ],
    evidence: [r.reason, ...r.blockers],
    model: 'discharge-pred v2.9.1',
    limits: [
      'Predicts from the structured record. A family who cannot collect until Friday is invisible to it.',
      'The fallback is clinician-flagged discharges only.',
      'It predicts; it does not discharge. A clinician still marks the patient fit.',
    ],
  }
}

export function S1301() {
  const forceState = useAI((s) => s.forceState)
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const [moved, setMoved] = useState<Record<string, ColumnKey>>({})
  const [view, setView] = useState<'list' | 'board'>('list')
  const [scope, setScope] = useScope(SCOPES, 'today')

  const columnFor = (r: DischargeRow): ColumnKey =>
    moved[r.patientId] ?? (r.likelihood === 'Today' ? 'today' : r.likelihood === 'Tomorrow' ? 'tomorrow' : 'notyet')

  const inColumn = (key: ColumnKey) => DISCHARGE_BOARD.filter((r) => columnFor(r) === key)

  const today = inColumn('today')
  const tomorrow = inColumn('tomorrow')
  const notYet = inColumn('notyet')
  const gone = inColumn('gone')
  const blockerCount = today.reduce((n, r) => n + r.blockers.length + (r.financialClearance === 'Clear' ? 0 : 1), 0)

  const columns: BoardColumn<DischargeRow>[] = [
    { key: 'today', label: 'Going home today', tone: 'normal', capacity: `${today.length} beds freeing`, rows: today },
    { key: 'tomorrow', label: 'Tomorrow', tone: 'caution', rows: tomorrow },
    { key: 'notyet', label: 'Not on a discharge path', tone: 'neutral', rows: notYet },
    { key: 'gone', label: 'Discharged', tone: 'neutral', capacity: 'bed released', rows: gone },
  ]

  /**
   * The hard rules. A deteriorating patient cannot be moved to "discharged",
   * and an unsigned summary blocks the release — those are rules, not
   * preferences, so the refusal names them on the target column.
   */
  function canDrop(row: DischargeRow, columnKey: string): true | string {
    if (columnKey === 'gone') {
      if (row.likelihood === 'Not yet') {
        return `${patient(row.patientId).name} is deteriorating. A patient on a rising deterioration score cannot be marked discharged.`
      }
      if (row.blockers.some((b) => b.toLowerCase().includes('summary'))) {
        return 'The discharge summary is unsigned. A discharge without a signed summary is not a discharge.'
      }
      if (row.financialClearance !== 'Clear') {
        return `Financial clearance is outstanding: ${row.financialClearance.toLowerCase()}. The bed cannot be released until it clears.`
      }
    }
    return true
  }

  /** The two navigations a row offers, shared by the list row and the board card. */
  function actionsFor(r: DischargeRow, compact?: boolean) {
    const enc = encounterForPatient(r.patientId)
    if (!enc) return null
    const summaryBlocked = r.blockers.some((b) => b.includes('summary'))
    return (
      <>
        <Button
          size="sm"
          className={compact ? undefined : 'min-h-11'}
          tone={summaryBlocked ? 'primary' : 'secondary'}
          icon="FileText"
          onClick={() => navigate(`/encounter/${enc.id}/discharge-summary`)}
        >
          Summary
        </Button>
        <Button
          size="sm"
          className={compact ? undefined : 'min-h-11'}
          icon="Pill"
          onClick={() => navigate(`/encounter/${enc.id}/med-rec`)}
        >
          Med rec
        </Button>
      </>
    )
  }

  const scoped = scope === 'today' ? today : scope === 'tomorrow' ? tomorrow : notYet
  const emptyLine =
    scope === 'today'
      ? 'Nobody is predicted to go home today. A patient becoming afebrile with no active orders would appear here.'
      : scope === 'tomorrow'
        ? 'Nobody is predicted for tomorrow.'
        : 'Everyone on the ward is on a discharge path.'

  return (
    <Screen
      screenId="S-13-01"
      loadingShape={view === 'board' ? 'board' : 'list'}
      wide={view === 'board'}
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      subheading={
        <>
          {today.length} likely today · {tomorrow.length} tomorrow · {blockerCount} {blockerCount === 1 ? 'blocker' : 'blockers'}
        </>
      }
    >
      {view === 'list' ? (
        <div className="max-w-4xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ScopeTabs
              value={scope}
              onChange={setScope}
              options={[
                { key: 'today', label: 'Today', count: today.length },
                { key: 'tomorrow', label: 'Tomorrow', count: tomorrow.length },
                { key: 'notyet', label: 'Not yet', count: notYet.length },
              ]}
            />
            <Button size="sm" icon="Grid2x2" onClick={() => setView('board')}>
              Board view
            </Button>
          </div>

          <SectionCard
            title={scope === 'today' ? 'Going home today' : scope === 'tomorrow' ? 'Tomorrow' : 'Not on a discharge path'}
            meta={<span className="tabular text-[0.86em] text-ink-3">as of {formatTime(COMPUTED_AT)}</span>}
          >
            {scoped.length === 0 ? (
              <p className="px-2 py-4 text-[0.95em] text-ink-2">{emptyLine}</p>
            ) : (
              <ul className="divide-y divide-glass-hairline">
                {scoped.map((r) => {
                  const p = patient(r.patientId)
                  const like = LIKELIHOOD[r.likelihood]
                  const clear = r.financialClearance === 'Clear'
                  return (
                    <li
                      key={r.patientId}
                      className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-3 sm:px-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-[1.02em] font-semibold tracking-tight">{p.name}</span>
                          <Chip tone={like.tone} icon={like.icon}>
                            {r.likelihood}
                          </Chip>
                        </p>
                        <p className="tabular mt-0.5 text-[0.88em] text-ink-3">
                          {p.age}/{p.sex} · {r.bed}
                          {p.losDays !== undefined && ` · LOS ${p.losDays}d`}
                        </p>
                        {r.blockers.length > 0 && (
                          <p className="mt-1 flex items-start gap-1.5 text-[0.88em] font-medium text-caution">
                            <Icon name="TriangleAlert" size={12} className="mt-1 shrink-0" />
                            <span className="min-w-0">{r.blockers.join(' · ')}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone={clear ? 'normal' : 'caution'} icon={clear ? 'Check' : 'Wallet'}>
                          {r.financialClearance}
                        </Chip>
                        {actionsFor(r)}
                        <WhyLink target={explainFor(r)} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <Why label="Why 07:00 matters">
            <p className="text-ink-2">
              A discharge discovered at 16:00 frees a bed the next morning. The same discharge known at 07:00 frees it
              the same afternoon. The prediction is not the point — the timing of it is.
            </p>
            <p className="tabular text-ink-2">
              Right now: {today.length} predicted today · {DISCHARGE_BOARD.filter((r) => r.financialClearance !== 'Clear').length} blocked
              on money · {DISCHARGE_BOARD.filter((r) => r.blockers.some((b) => b.includes('summary'))).length} blocked on a
              summary · {gone.length} released so far.
            </p>
            <p className="text-[0.92em] text-ink-3">
              AI-610 predicts the clinical discharge and AI-514 the financial clearance, both at G1 and computed at
              07:00. Nothing discharges automatically; a clinician still marks the patient fit.
            </p>
          </Why>
        </div>
      ) : (
        <div className="space-y-4">
          <Button size="sm" icon="ArrowLeft" onClick={() => setView('list')}>
            Back to the list
          </Button>
          <Board
            columns={columns}
            rowKey={(r) => r.patientId}
            hiddenColumns={['tomorrow', 'notyet', 'gone']}
            asOf={<StaleChip asOf={new Date(NOW.getTime() - 100 * 60_000)} onRefresh={() => forceState(null)} />}
            legend={
              <span className="text-[0.86em] text-ink-3">Drag a card. A refusal names its reason on the column.</span>
            }
            canDrop={canDrop}
            onDrop={(row, columnKey) => {
              setMoved((m) => ({ ...m, [row.patientId]: columnKey as ColumnKey }))
              toast({
                tone: columnKey === 'gone' ? 'success' : 'info',
                title:
                  columnKey === 'gone'
                    ? `${patient(row.patientId).name} discharged`
                    : `${patient(row.patientId).name} moved`,
                detail: columnKey === 'gone' ? 'Bed released to the bed board.' : undefined,
              })
            }}
            renderCard={(r) => {
              const p = patient(r.patientId)
              const like = LIKELIHOOD[r.likelihood]
              const clear = r.financialClearance === 'Clear'
              return (
                <Card className="cursor-grab p-3.5 active:cursor-grabbing">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="tabular text-[0.86em] text-ink-3">
                        {p.age}/{p.sex} · {r.bed}
                          {p.losDays !== undefined && ` · LOS ${p.losDays}d`}
                      </p>
                    </div>
                    <Chip tone={like.tone} icon={like.icon}>
                      {r.likelihood}
                    </Chip>
                  </div>

                  {r.blockers.length > 0 && (
                    <p className="mt-2 flex items-start gap-1.5 text-[0.86em] font-medium text-caution">
                      <Icon name="TriangleAlert" size={12} className="mt-0.5 shrink-0" />
                      <span className="min-w-0">{r.blockers.join(' · ')}</span>
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Chip tone={clear ? 'normal' : 'caution'} icon={clear ? 'Check' : 'Wallet'}>
                      {r.financialClearance}
                    </Chip>
                    {actionsFor(r, true)}
                    <WhyLink target={explainFor(r)} />
                  </div>
                </Card>
              )
            }}
          />
        </div>
      )}
    </Screen>
  )
}
