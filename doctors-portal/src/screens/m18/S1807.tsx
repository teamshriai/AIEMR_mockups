/**
 * S-18-07 · Parallel Task Board — `/stroke/case/:id/tasks` · T2 · ARC-04
 *
 * "Eight things happening at once, each with an owner and a timer."
 *
 * The board exists because a stroke pathway is parallel, not sequential — and
 * ARC-04's rule about refused drags earns its place here: a task that cannot
 * legitimately move is refused with the reason on the target column, because
 * "load the ambulance before the bolus" is a clinical error, not a UI mistake.
 *
 * Calm pass: Done folds behind its count; the prioritisation reason is quiet
 * text rather than a chip; the rationale is one Why.
 */

import { useNavigate } from 'react-router-dom'

import { Board } from '@/archetypes'
import type { BoardColumn } from '@/archetypes'
import { Why } from '@/components/calm'
import { Alert, Button, Icon, cx } from '@/components/primitives'
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
      heading="Task board"
      subheading={
        <>
          {inColumn('To do').length} to do · {inColumn('In progress').length} in progress · {blocked.length} blocked ·{' '}
          {inColumn('Done').length} done
        </>
      }
      actions={
        <Button icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
          Case clock
        </Button>
      }
    >
      <div className="space-y-5">
        {blocked.length > 0 && (
          <Alert tone="abnormal" title={`${blocked.length} task blocked`}>
            {blocked[0].label} cannot move until the needle is stamped — the card says why.
          </Alert>
        )}

        <Board
          columns={columns}
          hiddenColumns={['Done']}
          rowKey={(t) => t.id}
          canDrop={canDrop}
          onDrop={(t, k) => {
            moveTask(t.id, k)
            toast({ tone: 'info', title: `${t.label} → ${k}`, detail: `owner ${t.owner}` })
          }}
          legend={
            <span className="text-[0.86em] text-ink-3">
              Drag a card · a refused drop names the clinical reason on the column
            </span>
          }
          asOf={
            <span className="tabular text-[0.86em] text-ink-3">
              <Icon name="Radio" size={12} className="mr-1 inline" />
              server {formatTime(caseNow)}
            </span>
          }
          renderCard={(t) => (
            /* A plain panel, not a glass card — the column is already glass. */
            <div
              className={cx(
                'cursor-grab rounded-panel bg-glass-fill-strong p-3.5 active:cursor-grabbing',
                columnOf(t) === 'Blocked' && 'ring-1 ring-abnormal/40',
              )}
            >
              <p className="font-medium">{t.label}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.86em] text-ink-3">
                <span className="flex items-center gap-1.5">
                  <Icon name="User" size={12} />
                  {t.owner}
                </span>
                {t.dueInMin !== null && (
                  <span
                    className={cx(
                      'tabular flex items-center gap-1 font-semibold',
                      t.dueInMin <= 10 ? 'text-abnormal' : 'text-caution',
                    )}
                  >
                    · {t.dueInMin} min
                  </span>
                )}
              </p>
              {/* The prioritisation reason, as quiet text. Provenance lives in the Why. */}
              {t.reason && aiActive && <p className="mt-1.5 text-[0.84em] text-ink-3">{t.reason}</p>}
              {t.blockedBy && (
                <p className="mt-2 flex items-start gap-1.5 rounded-panel bg-abnormal-soft px-2.5 py-1.5 text-[0.84em] font-medium text-abnormal">
                  <Icon name="Ban" size={12} className="mt-0.5 shrink-0" />
                  {t.blockedBy}
                </p>
              )}
            </div>
          )}
        />

        <Why label="Why the board is parallel, and how the cards are ordered">
          <p className="text-ink-2">
            Consent, imaging, blood pressure and pre-authorisation all run at the same time. Sequenced, they add up to
            more than the window. The board exists so nobody waits for a step they are not blocking.
          </p>
          {aiActive && (
            <p className="text-ink-2">
              AI-619 orders the cards by how much clock they free, not by when they were created; the quiet line on
              each card says why it sits where it does. Fallback: due-time order.
            </p>
          )}
          <p className="text-ink-3">
            A drag that violates a hard rule is refused with the reason on the target column, because the ordering is
            clinical rather than administrative.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
