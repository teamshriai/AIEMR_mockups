/**
 * S-05-03 · OP Queue & Token Board — `/op-queue` · T1 · ARC-04
 *
 * "The waiting room told the truth about how long it will be."
 *
 * Deck beat #4: "The queue is predicted, not just counted."
 *
 * This screen has two readers and they want different shapes, so it has two
 * views and the calm one is the default.
 *
 *   LIST is what a consultant between patients wants: who is next, how long
 *   they have waited, one line each. It is where My Day's OPD count lands, so
 *   it has to feel like My Day.
 *   BOARD is `ARC-04`, and it is kept because it does a job the list cannot —
 *   showing the flow of a whole session at a glance, which is what the front
 *   office and the waiting-area display need.
 *
 * A toggle rather than a compromise. Collapsing the board into the list would
 * lose the session view; leading with the board would open a four-column
 * kanban on a doctor who asked "who is next".
 *
 * AI-607 is a G0 touchpoint — disclosure only, never a dialog — because a
 * predicted wait is not something a clinician accepts or rejects. Its fallback
 * is "position in queue only", which is the honest degradation: you still know
 * you are fifth, you just stop knowing when.
 */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Board, Worklist } from '@/archetypes'
import type { BoardColumn, WorklistColumn } from '@/archetypes'
import { Diamond, WhyLink } from '@/components/ai'
import { PillTabs } from '@/components/myday'
import { Button, Card, Chip, Icon, cx } from '@/components/primitives'
import { StaleChip } from '@/components/states'
import { opdRows } from '@/data/admissions'
import { encounterForPatient } from '@/data/clinical'
import type { ClinicRow } from '@/data/clinical'
import { formatElapsed, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { isFollowUp } from '@/data/myday'
import { useAdmissions } from '@/store/admissions'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

export function S0503() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const forceState = useAI((s) => s.forceState)
  const [called, setCalled] = useState<string[]>([])
  const [view, setView] = useState<'list' | 'board'>('list')
  const admissions = useAdmissions((s) => s.admissions)

  const followUpOnly = params.get('type') === 'follow-up'
  const status = (r: ClinicRow) => (called.includes(r.token) ? 'In room' : r.status)
  /** Admitted from this clinic and waiting for a bed. Anyone who already has one has left OPD. */
  const admitting = (r: ClinicRow) => admissions[r.patientId] !== undefined

  function call(r: ClinicRow) {
    setCalled((c) => [...c, r.token])
    const enc = encounterForPatient(r.patientId)
    toast({
      tone: 'info',
      title: `Calling ${r.token}`,
      detail: `${patient(r.patientId).name} · the note opens with the scribe ready.`,
    })
    if (enc) navigate(`/encounter/${enc.id}/note`)
  }

  const scoped = opdRows(admissions).filter((r) => (followUpOnly ? isFollowUp(r.patientId) : true))
  const waiting = scoped.filter((r) => status(r) === 'Waiting' && !admitting(r))
  const next = waiting[0]
  const seen = scoped.filter((r) => status(r) === 'Seen').length

  /** The list view. Time order is the deterministic order for a token queue. */
  const listRows = [...scoped].sort((a, b) => {
    const rank = { Waiting: 0, 'In room': 1, 'Not arrived': 2, Seen: 3 } as const
    return rank[status(a)] - rank[status(b)] || a.bookedAt.getTime() - b.bookedAt.getTime()
  })

  const columns: WorklistColumn<ClinicRow>[] = [
    { key: 'token', label: 'Token', role: 'lead', cell: (r) => r.token },
    { key: 'patient', label: 'Patient', role: 'primary', cell: (r) => patient(r.patientId).name },
    {
      key: 'who',
      label: 'Age / sex',
      role: 'context',
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <span className="tabular">
            {p.age}/{p.sex}
          </span>
        )
      },
    },
    {
      key: 'visit',
      label: 'Visit',
      role: 'context',
      cell: (r) => (isFollowUp(r.patientId) ? 'Follow-up' : 'New patient'),
    },
    {
      /*
       * The state of the wait, not a prediction of it. "◆ ~4m" per row was the
       * AI-607 estimate, and next to every name it read as noise; the estimate
       * for the NEXT patient stays in the subheading and the full disclosure
       * stays on the session board, where the front office needs it.
       */
      key: 'state',
      label: 'Status',
      role: 'status',
      cell: (r) => {
        const st = status(r)
        if (admitting(r)) {
          return (
            <Chip tone="caution" icon="Hourglass">
              Admission in progress
            </Chip>
          )
        }
        if (st === 'Seen') {
          return (
            <Chip tone="normal" icon="Check">
              Seen
            </Chip>
          )
        }
        if (st === 'In room') {
          return (
            <Chip tone="brand" icon="DoorOpen">
              In room
            </Chip>
          )
        }
        if (st === 'Waiting' && r.arrivedAt) {
          return (
            <Chip tone="caution" icon="Clock">
              Waiting {formatElapsed((NOW.getTime() - r.arrivedAt.getTime()) / 60000)}
            </Chip>
          )
        }
        return (
          <Chip tone="neutral" icon="Clock">
            Not arrived
          </Chip>
        )
      },
    },
    {
      key: 'call',
      label: '',
      role: 'status',
      cell: (r) =>
        status(r) === 'Waiting' && !admitting(r) ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              call(r)
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-brand px-3 py-1 text-[0.86em] font-semibold text-brand-on"
          >
            Call
            <Icon name="ArrowRight" size={13} />
          </span>
        ) : null,
    },
  ]

  const cols: BoardColumn<ClinicRow>[] = [
    { key: 'notarrived', label: 'Not arrived', tone: 'neutral', rows: scoped.filter((r) => status(r) === 'Not arrived') },
    {
      key: 'waiting',
      label: 'Waiting',
      tone: 'caution',
      capacity: `longest ${formatElapsed(18)}`,
      rows: scoped.filter((r) => status(r) === 'Waiting'),
    },
    { key: 'inroom', label: 'In room', tone: 'normal', rows: scoped.filter((r) => status(r) === 'In room') },
    { key: 'seen', label: 'Seen', tone: 'neutral', rows: scoped.filter((r) => status(r) === 'Seen') },
  ]

  return (
    <Screen
      screenId="S-05-03"
      loadingShape={view === 'board' ? 'board' : 'list'}
      wide={view === 'board'}
      heading="OPD queue"
      subheading={
        <>
          {scoped.length} booked · {seen} seen · {waiting.length} waiting
          {aiActive && next?.predictedWaitMin !== undefined && ` · next in about ${next.predictedWaitMin} min`}
          {' · running 6 min behind'}
        </>
      }
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      actions={
        next && (
          <Button tone="primary" icon="ArrowRight" onClick={() => call(next)}>
            Call {next.token}
          </Button>
        )
      }
    >
      <div className={cx('space-y-6', view === 'list' && 'max-w-4xl')}>
        {view === 'list' ? (
          <Worklist
            variant="calm"
            tone="patient"
            rows={listRows}
            columns={columns}
            rowKey={(r) => r.token}
            // Opening a row opens the patient's record — earlier reports, results, notes, medicines and the next
            // appointment, one tile each. "Call" is the action that starts the consultation.
            onOpen={(r) => navigate(`/patient/${patient(r.patientId).uhid}/record`)}
            caption="Today's outpatient session"
            noun="patients"
            emptyWhy={
              followUpOnly
                ? 'No follow-up patients are booked into this session. Clearing the filter shows all of OPD.'
                : 'No patients are booked into this session. A booking, or a walk-in registered at the front office, would appear here.'
            }
            emptyAction={
              followUpOnly ? (
                <Button size="sm" icon="X" onClick={() => setParams({})}>
                  All of OPD
                </Button>
              ) : undefined
            }
            filters={
              <>
                <PillTabs
                  ariaLabel="Who to show"
                  value={followUpOnly ? 'followup' : 'all'}
                  options={[
                    { key: 'all', label: 'All' },
                    { key: 'followup', label: 'Follow-ups', icon: 'RotateCcw' },
                  ]}
                  onChange={(k) => setParams(k === 'followup' ? { type: 'follow-up' } : {})}
                />
                <Button size="sm" icon="Grid2x2" onClick={() => setView('board')}>
                  Session board
                </Button>
              </>
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" icon="ArrowLeft" onClick={() => setView('list')}>
                Back to the list
              </Button>
              <StaleChip asOf={NOW} onRefresh={() => forceState(null)} />
            </div>
            <Board
              columns={cols}
              rowKey={(r) => r.token}
              legend={
                <>
                  <Chip tone="caution">Waiting</Chip>
                  <Chip tone="normal">In room</Chip>
                  <span className="text-[0.86em] text-ink-3">
                    Token order is the deterministic order. Nothing here reorders a patient without a reason on the
                    card.
                  </span>
                </>
              }
              renderCard={(r) => {
                const p = patient(r.patientId)
                const st = status(r)
                return (
                  <Card className={cx('p-3.5', st === 'In room' && 'border-normal/40')}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="tabular font-semibold">{r.token}</p>
                        <p className="truncate text-[0.92em]">{p.name}</p>
                        <p className="tabular text-[0.86em] text-ink-3">
                          {p.age}/{p.sex} · booked {formatTime(r.bookedAt)}
                        </p>
                      </div>
                      {st === 'Seen' && <Icon name="Check" size={15} className="shrink-0 text-normal" />}
                    </div>

                    {r.arrivedAt && st !== 'Seen' && (
                      <p className="tabular mt-2 text-[0.88em] text-ink-2">
                        waiting {formatElapsed((NOW.getTime() - r.arrivedAt.getTime()) / 60000)}
                      </p>
                    )}

                    {aiActive && r.predictedWaitMin !== undefined && st !== 'Seen' && st !== 'In room' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Chip tone="ai">
                          <Diamond size={9} />~{r.predictedWaitMin}m to be called
                        </Chip>
                        <WhyLink
                          target={{
                            touchpointId: `queue:${r.token}`,
                            capabilityId: 'AI-607',
                            claim: `${p.name} is predicted to be called in about ${r.predictedWaitMin} minutes.`,
                            confidence: r.band === 'HIGH' ? 0.89 : 0.72,
                            band: r.band ?? 'MED',
                            computedAt: formatTime(NOW),
                            inputs: [
                              { label: 'Position in the token queue', source: 'OP queue' },
                              { label: 'Mean consultation length for this clinician', source: 'Session history, 90 days' },
                              { label: 'Current running delay', source: 'Live session' },
                              { label: 'Arrivals still expected', source: 'Appointment book' },
                            ],
                            evidence: [
                              'Six minutes behind schedule, mean consultation 11 minutes.',
                              'Two booked patients have not arrived, which shortens the queue if they do not.',
                            ],
                            model: 'queue-wait v4.2.0',
                            limits: [
                              'Predicts from the session, not from the individual patient’s complexity.',
                              'A long consultation ahead of you moves everything behind it.',
                              'Fallback is position in queue only — you still know you are fifth.',
                            ],
                          }}
                        />
                      </div>
                    )}

                    {st === 'Waiting' && (
                      <Button size="sm" tone="primary" className="mt-2.5 w-full" icon="ArrowRight" onClick={() => call(r)}>
                        Call this patient
                      </Button>
                    )}
                  </Card>
                )
              }}
            />
          </>
        )}
      </div>
    </Screen>
  )
}
