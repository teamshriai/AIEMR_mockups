/**
 * S-05-03 · OP Queue & Token Board — `/op-queue` · T1 · ARC-04
 *
 * "The waiting room told the truth about how long it will be."
 *
 * Deck beat #4: "The queue is predicted, not just counted."
 *
 * AI-607 is a G0 touchpoint — disclosure only, never a dialog — because a
 * predicted wait is not something a clinician accepts or rejects. Its fallback
 * is "position in queue only", which is the honest degradation: you still know
 * you are fifth, you just stop knowing when.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Board } from '@/archetypes'
import type { BoardColumn } from '@/archetypes'
import { Diamond, WhyLink } from '@/components/ai'
import { Button, Card, Chip, Icon, KeyValue, StatTile, cx } from '@/components/primitives'
import { StaleChip } from '@/components/states'
import { CLINIC_LIST, encounterForPatient } from '@/data/clinical'
import type { ClinicRow } from '@/data/clinical'
import { formatElapsed, formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

export function S0503() {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const [called, setCalled] = useState<string[]>([])

  const status = (r: ClinicRow) => (called.includes(r.token) ? 'In room' : r.status)

  const cols: BoardColumn<ClinicRow>[] = [
    {
      key: 'notarrived',
      label: 'Not arrived',
      tone: 'neutral',
      rows: CLINIC_LIST.filter((r) => status(r) === 'Not arrived'),
    },
    {
      key: 'waiting',
      label: 'Waiting',
      tone: 'caution',
      capacity: `longest ${formatElapsed(18)}`,
      rows: CLINIC_LIST.filter((r) => status(r) === 'Waiting'),
    },
    {
      key: 'inroom',
      label: 'In room',
      tone: 'normal',
      rows: CLINIC_LIST.filter((r) => status(r) === 'In room'),
    },
    { key: 'seen', label: 'Seen', tone: 'neutral', rows: CLINIC_LIST.filter((r) => status(r) === 'Seen') },
  ]

  const waiting = CLINIC_LIST.filter((r) => status(r) === 'Waiting')
  const next = waiting[0]
  const seen = CLINIC_LIST.filter((r) => status(r) === 'Seen').length

  return (
    <Screen
      screenId="S-05-03"
      loadingShape="board"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      wide
      chips={
        <>
          <Chip tone="neutral">{CLINIC_LIST.length} booked today</Chip>
          {aiActive && (
            <Chip tone="ai">
              <Diamond size={9} />
              AI-607 · G0
            </Chip>
          )}
        </>
      }
      actions={
        next && (
          <Button
            tone="primary"
            icon="ArrowRight"
            onClick={() => {
              setCalled((c) => [...c, next.token])
              const enc = encounterForPatient(next.patientId)
              toast({
                tone: 'info',
                title: `Calling ${next.token}`,
                detail: `${patient(next.patientId).name} · the note opens with the scribe ready.`,
              })
              if (enc) navigate(`/encounter/${enc.id}/note`)
            }}
          >
            Call {next.token}
          </Button>
        )
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Session</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Booked">{CLINIC_LIST.length}</KeyValue>
              <KeyValue label="Seen">{seen}</KeyValue>
              <KeyValue label="Waiting">{waiting.length}</KeyValue>
              <KeyValue label="Mean consultation">11 min</KeyValue>
              <KeyValue label="Running">
                <span className="text-caution">6 min behind</span>
              </KeyValue>
            </dl>
          </Card>

          {aiActive && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                <Diamond size={10} />
                Why a prediction, not a count
              </p>
              <p className="mt-1.5 text-[0.9em] text-ink-2">
                &ldquo;You are fifth&rdquo; tells a patient nothing they can plan around. &ldquo;About 28
                minutes&rdquo; lets them sit down, or step out and come back. The count is the fallback, not the
                product.
              </p>
              <p className="mt-2 text-[0.84em] text-ink-3">
                G0 · disclosure only. There is nothing here to accept or reject, so there is no dialog.
              </p>
            </Card>
          )}
        </div>
      }
      railTitle="Clinic"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Next token" value={next?.token ?? '—'} sub={next ? patient(next.patientId).name : 'none waiting'} />
          <StatTile
            label="Predicted wait"
            value={aiActive && next?.predictedWaitMin !== undefined ? `${next.predictedWaitMin}m` : '—'}
            sub={aiActive ? 'for the next patient' : 'position in queue only'}
            badge={aiActive && <Chip tone="ai"><Diamond size={9} />AI-607</Chip>}
          />
          <StatTile label="Seen" value={seen} sub={`of ${CLINIC_LIST.length} booked`} tone="normal" />
          <StatTile
            label="Longest wait"
            value={formatElapsed(18)}
            sub="target under 30 min"
            tone="caution"
          />
        </div>

        <Board
          columns={cols}
          rowKey={(r) => r.token}
          asOf={<StaleChip asOf={NOW} onRefresh={() => undefined} />}
          legend={
            <>
              <Chip tone="caution">Waiting</Chip>
              <Chip tone="normal">In room</Chip>
              <span className="text-[0.86em] text-ink-3">
                Token order is the deterministic order. Nothing here reorders a patient without a reason on the card.
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
                      <Diamond size={9} />
                      ~{r.predictedWaitMin}m to be called
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
                  <Button
                    size="sm"
                    tone="primary"
                    className="mt-2.5 w-full"
                    icon="ArrowRight"
                    onClick={() => {
                      setCalled((c) => [...c, r.token])
                      const enc = encounterForPatient(r.patientId)
                      if (enc) navigate(`/encounter/${enc.id}/note`)
                    }}
                  >
                    Call this patient
                  </Button>
                )}
              </Card>
            )
          }}
        />

        <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          The token slip prints on an 80mm roll and carries the predicted wait. The board in the waiting area shows the
          same numbers — a queue that tells staff one thing and patients another is worse than no board.
        </p>
      </div>
    </Screen>
  )
}
