/**
 * S-18-07 · Parallel Task Board — `/stroke/case/:id/tasks` · T2 · ARC-04
 *
 * "Eight things happening at once, each with an owner and a timer."
 *
 * The board exists because a stroke pathway is parallel, not sequential — and
 * ARC-04's rule about refused drags earns its place here: a task that cannot
 * legitimately move is refused with the reason on the target column, because
 * "load the ambulance before the bolus" is a clinical error, not a UI mistake.
 */

import { useNavigate } from 'react-router-dom'

import { Board } from '@/archetypes'
import type { BoardColumn } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { STROKE_TASKS, strokeCase } from '@/data/stroke'
import type { StrokeTask } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const COLUMNS = ['To do', 'In progress', 'Blocked', 'Done'] as const

export function S1807({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const { taskColumns, moveTask, isStamped } = useStroke()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  const columnOf = (t: StrokeTask) => taskColumns[t.id] ?? t.column
  const inColumn = (k: string) => STROKE_TASKS.filter((t) => columnOf(t) === k)

  const columns: BoardColumn<StrokeTask>[] = COLUMNS.map((k) => ({
    key: k,
    label: k,
    tone: k === 'Blocked' ? 'abnormal' : k === 'Done' ? 'normal' : k === 'In progress' ? 'caution' : 'neutral',
    rows: inColumn(k),
  }))

  /**
   * The hard rules. "Load the ambulance" cannot move out of Blocked until the
   * needle is stamped — drip-and-ship means the bolus first.
   */
  function canDrop(task: StrokeTask, columnKey: string): true | string {
    if (task.id === 'T-07' && columnKey !== 'Blocked' && !isStamped('needle')) {
      return 'The needle has not been stamped. Drip-and-ship requires the bolus before the patient is loaded — this task unblocks itself once thrombolysis is given.'
    }
    if (task.id === 'T-06' && columnKey === 'Done' && columnOf(task) === 'To do') {
      return 'The second dose check cannot go straight to done. Record who performed it on the thrombolysis screen and it moves itself.'
    }
    return true
  }

  const blocked = inColumn('Blocked')

  return (
    <Screen
      screenId="S-18-07"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="board"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF']}
      wide
      chips={
        <>
          <Chip tone="normal">{inColumn('Done').length} done</Chip>
          {blocked.length > 0 && <Chip tone="abnormal">{blocked.length} blocked</Chip>}
        </>
      }
      actions={
        <Button icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
          Case clock
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why parallel</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Consent, imaging, blood pressure and pre-authorisation all run at the same time. Sequenced, they add up
              to more than the window. The board exists so nobody waits for a step they are not blocking.
            </p>
          </Card>

          {aiActive && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                <Diamond size={10} />
                AI-619 · which to do next
              </p>
              <p className="mt-1.5 text-[0.9em] text-ink-2">
                Tasks are ordered by how much clock they free, not by when they were created. The reason chip on each
                card says why it sits where it does.
              </p>
              <p className="mt-2 text-[0.84em] text-ink-3">Fallback: due-time order.</p>
            </Card>
          )}
        </div>
      }
      railTitle="Coordination"
    >
      <div className="space-y-5">
        {blocked.length > 0 && (
          <Alert tone="abnormal" title={`${blocked.length} task blocked`}>
            {blocked[0].blockedBy} Dragging it out of Blocked is refused with that reason on the target column, because
            the ordering is clinical rather than administrative.
          </Alert>
        )}

        <Board
          columns={columns}
          rowKey={(t) => t.id}
          canDrop={canDrop}
          onDrop={(t, k) => {
            moveTask(t.id, k)
            toast({ tone: 'info', title: `${t.label} → ${k}`, detail: `owner ${t.owner}` })
          }}
          legend={
            <>
              <Chip tone="caution">In progress</Chip>
              <Chip tone="abnormal">Blocked</Chip>
              <span className="text-[0.86em] text-ink-3">
                Drag a card. A refusal names the clinical reason on the column you tried to drop onto.
              </span>
            </>
          }
          asOf={
            <span className="tabular text-[0.86em] text-ink-3">
              <Icon name="Radio" size={12} className="mr-1 inline" />
              server {formatTime(caseNow)}
            </span>
          }
          renderCard={(t) => (
            <Card className={cx('cursor-grab p-3.5 active:cursor-grabbing', columnOf(t) === 'Blocked' && 'border-abnormal/40')}>
              <p className="font-medium">{t.label}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[0.86em] text-ink-3">
                <Icon name="User" size={12} />
                {t.owner}
              </p>
              {t.dueInMin !== null && (
                <p
                  className={cx(
                    'tabular mt-1.5 flex items-center gap-1.5 text-[0.86em] font-semibold',
                    t.dueInMin <= 10 ? 'text-abnormal' : 'text-caution',
                  )}
                >
                  <Icon name="Timer" size={12} />
                  {t.dueInMin} min
                </p>
              )}
              {t.reason && aiActive && (
                <p className="mt-2 flex items-start gap-1.5 rounded-panel bg-glass-fill-muted px-2.5 py-1.5 text-[0.84em] text-ink-2">
                  <Diamond size={8} className="mt-1 shrink-0" />
                  {t.reason}
                </p>
              )}
              {t.blockedBy && (
                <p className="mt-2 flex items-start gap-1.5 rounded-panel bg-abnormal-soft px-2.5 py-1.5 text-[0.84em] font-medium text-abnormal">
                  <Icon name="Ban" size={12} className="mt-0.5 shrink-0" />
                  {t.blockedBy}
                </p>
              )}
            </Card>
          )}
        />
      </div>
    </Screen>
  )
}
