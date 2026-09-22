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
 * ARC-04's load-bearing rule is implemented here: "a drag that violates a hard
 * rule is refused with an inline reason on the target", never silently
 * reverted.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Board } from '@/archetypes'
import type { BoardColumn } from '@/archetypes'
import { Diamond, WhyLink } from '@/components/ai'
import { Button, Card, Chip, Icon, KeyValue, cx } from '@/components/primitives'
import { StaleChip } from '@/components/states'
import { DISCHARGE_BOARD, encounterForPatient } from '@/data/clinical'
import type { DischargeRow } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

type ColumnKey = 'today' | 'tomorrow' | 'notyet' | 'gone'

export function S1301() {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const [moved, setMoved] = useState<Record<string, ColumnKey>>({})

  const columnFor = (r: DischargeRow): ColumnKey =>
    moved[r.patientId] ?? (r.likelihood === 'Today' ? 'today' : r.likelihood === 'Tomorrow' ? 'tomorrow' : 'notyet')

  const inColumn = (key: ColumnKey) => DISCHARGE_BOARD.filter((r) => columnFor(r) === key)

  const columns: BoardColumn<DischargeRow>[] = [
    { key: 'today', label: 'Going home today', tone: 'normal', capacity: `${inColumn('today').length} beds freeing`, rows: inColumn('today') },
    { key: 'tomorrow', label: 'Tomorrow', tone: 'caution', rows: inColumn('tomorrow') },
    { key: 'notyet', label: 'Not on a discharge path', tone: 'neutral', rows: inColumn('notyet') },
    { key: 'gone', label: 'Discharged', tone: 'neutral', capacity: 'bed released', rows: inColumn('gone') },
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

  return (
    <Screen
      screenId="S-13-01"
      loadingShape="board"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={
        <>
          <Chip tone="ai">
            <Diamond size={9} />
            AI-610 · AI-514
          </Chip>
          <Chip tone="neutral" icon="Clock">
            computed 07:00
          </Chip>
        </>
      }
      wide
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Today at a glance</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Predicted today">{inColumn('today').length}</KeyValue>
              <KeyValue label="Blocked on money">
                {DISCHARGE_BOARD.filter((r) => r.financialClearance !== 'Clear').length}
              </KeyValue>
              <KeyValue label="Blocked on a summary">
                {DISCHARGE_BOARD.filter((r) => r.blockers.some((b) => b.includes('summary'))).length}
              </KeyValue>
              <KeyValue label="Released so far">{inColumn('gone').length}</KeyValue>
            </dl>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              Why 07:00 matters
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A discharge discovered at 16:00 frees a bed the next morning. The same discharge known at 07:00 frees it
              the same afternoon. The prediction is not the point — the timing of it is.
            </p>
            <p className="mt-2 text-[0.84em] text-ink-3">
              AI-610 at G1. Nothing discharges automatically; a clinician still marks the patient fit.
            </p>
          </Card>
        </div>
      }
      railTitle="Flow"
    >
      <Board
        columns={columns}
        rowKey={(r) => r.patientId}
        asOf={<StaleChip asOf={new Date(NOW.getTime() - 100 * 60_000)} onRefresh={() => undefined} />}
        legend={
          <>
            <Chip tone="normal" icon="Check">
              Clear
            </Chip>
            <Chip tone="caution" icon="TriangleAlert">
              Blocked
            </Chip>
            <Chip tone="abnormal" icon="Ban">
              Not eligible
            </Chip>
            <span className="text-[0.86em] text-ink-3">Drag a card. A refusal names its reason on the column.</span>
          </>
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
          const enc = encounterForPatient(r.patientId)
          return (
            <Card className="cursor-grab p-3.5 active:cursor-grabbing">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="tabular text-[0.86em] text-ink-3">
                    {p.age}/{p.sex} · {r.bed} · LOS {p.losDays}d
                  </p>
                </div>
                <Chip
                  tone={r.likelihood === 'Today' ? 'normal' : r.likelihood === 'Tomorrow' ? 'caution' : 'inactive'}
                >
                  {r.likelihood}
                </Chip>
              </div>

              <p className="mt-2 flex items-start gap-1.5 text-[0.88em] text-ink-2">
                <Diamond size={9} className="mt-1 shrink-0" />
                {r.reason}
              </p>

              {r.blockers.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {r.blockers.map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-[0.86em] font-medium text-caution">
                      <Icon name="TriangleAlert" size={12} className="mt-0.5 shrink-0" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              <p
                className={cx(
                  'mt-2 flex items-center gap-1.5 text-[0.86em] font-medium',
                  r.financialClearance === 'Clear' ? 'text-normal' : 'text-caution',
                )}
              >
                <Icon name={r.financialClearance === 'Clear' ? 'Check' : 'Wallet'} size={12} />
                {r.financialClearance}
                <span className="font-normal text-ink-3">· AI-514</span>
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {enc && (
                  <Button
                    size="sm"
                    tone={r.blockers.some((b) => b.includes('summary')) ? 'primary' : 'secondary'}
                    icon="FileText"
                    onClick={() => navigate(`/encounter/${enc.id}/discharge-summary`)}
                  >
                    Summary
                  </Button>
                )}
                {enc && (
                  <Button size="sm" icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/med-rec`)}>
                    Med rec
                  </Button>
                )}
                <WhyLink
                  target={{
                    touchpointId: `discharge:${r.patientId}`,
                    capabilityId: 'AI-610',
                    claim: `${p.name} is predicted to be discharged ${r.likelihood.toLowerCase()}.`,
                    confidence: r.confidence,
                    band: r.band,
                    computedAt: formatTime(new Date(2026, 8, 21, 7, 0)),
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
                  }}
                />
              </div>
            </Card>
          )
        }}
      />
    </Screen>
  )
}
