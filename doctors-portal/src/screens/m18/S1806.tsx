/**
 * S-18-06 · Live Case Clock — `/stroke/case/:id/clock` · T1 · ARC-13
 *
 * "Every clock in the room, on one screen, with an owner for the next action."
 *
 * Deck beat #20, and its drawing note names what makes it a coordination tool
 * rather than a dashboard: "Draw every interval with target, elapsed, projected
 * breach and WHO OWNS THE NEXT ACTION. The owner column is what turns a
 * dashboard into a coordination tool."
 *
 * Three behaviours from the spec are real here:
 *   Stamping is one keystroke (`e` on the focused event) and the stream is
 *   APPEND-ONLY — a stamped event cannot be re-stamped.
 *   A breach reason is captured AT THE MOMENT OF BREACH, not reconstructed at
 *   audit.
 *   AI-OFF leaves the screen "ENTIRELY UNAFFECTED" — no interval, target or
 *   clock value is AI-derived. Only the breach prediction hides.
 *
 * Calm pass: the running intervals are the surface, each ring carrying its own
 * "next · owner" line; the completed ones fold; the six-column table that
 * repeated the rings is gone; the rationale folds behind Why.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ClockRing } from '@/archetypes'
import { AIBanner } from '@/components/ai'
import { CountPill, Disclosure, SectionCard, Why } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Chip, Icon, Select, TextArea, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { STAMPABLE_EVENTS, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { atRisk, CaseClockStrip, useCaseClock, useLiveIntervals } from './CaseClock'

const BREACH_REASONS = [
  'Ambulance not yet loaded',
  'Awaiting family consent',
  'Imaging queue',
  'Receiving site not ready',
  'Clinical instability',
  'Other',
]

export function S1806({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)
  const caseNow = useCaseClock()
  const intervals = useLiveIntervals()

  const { stamp, isStamped, captureBreach, breachReasons, stamps } = useStroke()
  const [focused, setFocused] = useState<string>(STAMPABLE_EVENTS[1].key)
  const [breachFor, setBreachFor] = useState<string | null>(null)
  const [reason, setReason] = useState(BREACH_REASONS[0])
  const [detail, setDetail] = useState('')
  const [deactivate, setDeactivate] = useState(false)

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const breaching = intervals.find(atRisk)
  const offline = forced === 'OFFLINE'

  const running = intervals.filter((i) => i.state !== 'DONE')
  const completed = intervals.filter((i) => i.state === 'DONE')
  const breached = intervals.filter((i) => i.state === 'BREACH').length

  /** `e` stamps the focused event. Stamping is one keystroke by design. */
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      const t = ev.target as HTMLElement | null
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT') return
      if (ev.key !== 'e') return
      const event = STAMPABLE_EVENTS.find((x) => x.key === focused)
      if (!event || event.stamped || isStamped(event.key)) return
      ev.preventDefault()
      stamp(event.key, event.label, me.name)
      toast({ tone: 'success', title: `${event.label} stamped`, detail: `${formatTime(caseNow)} · append-only` })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, isStamped, stamp, me.name, toast, caseNow])

  /** One interval: the ring, its name, and the one line that makes it a coordination tool. */
  const intervalTile = (i: (typeof intervals)[number], full: boolean) => (
    <li
      key={i.key}
      className={cx(
        'flex min-w-0 flex-col items-center rounded-panel px-3 py-3 text-center',
        full ? 'w-44' : 'w-36',
        atRisk(i) && 'bg-abnormal-soft/50',
      )}
    >
      <ClockRing label={i.label} elapsedMin={i.elapsed} targetMin={i.targetMin} state={i.state} size={full ? 88 : 64} />
      <p className={cx('mt-1.5 font-semibold leading-tight', full ? 'text-[0.92em]' : 'text-[0.84em] text-ink-2')}>
        {i.label}
      </p>
      {full ? (
        <p className="mt-1 text-[0.86em] leading-snug text-ink-2">
          <span className="text-ink-3">next: </span>
          {i.nextAction}
          <span className="text-ink-3"> · </span>
          <span className="font-medium">{i.owner}</span>
        </p>
      ) : (
        i.stamp && <p className="tabular mt-0.5 text-[0.82em] text-ink-3">done {formatTime(i.stamp)}</p>
      )}
    </li>
  )

  return (
    <Screen
      screenId="S-18-06"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-ABSTAIN']}
      wide
      heading="Case clock"
      subheading={
        <>
          {running.length} running · {breached} breached · {completed.length} complete
        </>
      }
      actions={
        <>
          <Button icon="Columns2" onClick={() => navigate(`/stroke/case/${c.id}/tasks`)}>
            Task board
          </Button>
          <Button icon="Syringe" onClick={() => navigate(`/stroke/case/${c.id}/thrombolysis`)}>
            Eligibility
          </Button>
          <Button icon="Ambulance" onClick={() => navigate(`/stroke/case/${c.id}/transfer`)}>
            Transfer
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Reconcile" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <Button size="sm" icon="Columns2" onClick={() => navigate(`/stroke/case/${c.id}/events`)}>
              Reconcile a timestamp
            </Button>
          </SectionCard>

          <Why label="Which clock wins, and what the AI does here">
            <p className="text-ink-2">
              The server clock. Local device times are reconciled against it and never trusted. A disputed door time
              is a disputed door-to-needle — so corrections go through the reconciliation screen as audited
              amendments, never as overwrites.
            </p>
            <p className="text-ink-2">
              The owner column is what turns a dashboard into a coordination tool. An interval with no owner is an
              interval nobody is progressing.
            </p>
            <p className="text-ink-3">
              With the AI off this screen is entirely unaffected: no interval, target or clock value is AI-derived.
              Only the projected-breach line is hidden.
            </p>
          </Why>
        </div>
      }
      railTitle="Coordination"
      actionBar={
        <>
          <span className="tabular text-[0.88em] text-ink-3">
            server {formatTime(caseNow)}:{String(caseNow.getSeconds()).padStart(2, '0')} · press{' '}
            <kbd className="rounded bg-glass-fill-muted px-1.5 py-0.5 font-mono text-[0.9em]">e</kbd> to stamp the
            focused event
          </span>
          <Button tone="destructive" className="ml-auto" icon="Ban" onClick={() => setDeactivate(true)}>
            De-activate the case
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {offline && (
          <Alert tone="caution" title="Stamping is queueing locally">
            Each stamp is marked pending until it reaches the server, where its time is reconciled against the server
            clock.
          </Alert>
        )}

        {/* AI-209's projected breach — the only AI-derived thing on the screen. */}
        {aiActive && breaching && (
          <AIBanner
            capabilityId="AI-209"
            tone="abnormal"
            title={
              breaching.state === 'BREACH'
                ? `${breaching.label} has breached its ${breaching.targetMin}-minute target`
                : `${breaching.label} projected to breach in ${breaching.projectedBreachIn} minutes`
            }
            detail={
              <>
                <strong>Blocking:</strong> {breaching.blockingStep}
              </>
            }
            action={
              <Button size="sm" tone="destructive" icon="PenLine" onClick={() => setBreachFor(breaching.key)}>
                Capture the reason
              </Button>
            }
            explain={{
              touchpointId: `stroke:breach:${breaching.key}`,
              capabilityId: 'AI-209',
              claim:
                breaching.state === 'BREACH'
                  ? `${breaching.label} is past its ${breaching.targetMin}-minute target.`
                  : `${breaching.label} will exceed its ${breaching.targetMin}-minute target in about ${breaching.projectedBreachIn} minutes at the current rate.`,
              confidence: 0.86,
              band: 'HIGH',
              computedAt: formatTime(caseNow),
              inputs: [
                { label: 'Stamped events on this case', source: 'Case event stream' },
                { label: 'Ambulance state', source: 'AMB-IPL-03 · M-22' },
                { label: 'Historical DIDO distribution at this site', source: 'Stroke registry' },
              ],
              evidence: [breaching.blockingStep ?? ''],
              model: 'pathway-breach v1.7.3',
              limits: [
                'Projects from the stamped stream. An unstamped event makes the projection wrong, not absent.',
                'The one-tap manual activation button is never gated on this model.',
                'Clocks and targets are not AI-derived and are unaffected if this is unavailable.',
              ],
            }}
          />
        )}

        {/* The running intervals, each with its next action and owner. */}
        <SectionCard
          title="Intervals"
          meta={<CountPill tone={breached > 0 ? 'critical' : 'brand'}>Running · {running.length}</CountPill>}
        >
          {running.length === 0 ? (
            <p className="px-3 py-3 text-[0.95em] text-ink-2">Every interval on this case is complete.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">{running.map((i) => intervalTile(i, true))}</ul>
          )}
          {completed.length > 0 && (
            <Disclosure label="completed intervals" count={completed.length} className="mt-1">
              <ul className="flex flex-wrap gap-2">{completed.map((i) => intervalTile(i, false))}</ul>
            </Disclosure>
          )}
        </SectionCard>

        {/* Stamping. One tap or one keystroke; append-only. */}
        <SectionCard
          title="Stamp an event"
          meta={<span className="text-[0.88em] text-ink-3">one tap or one keystroke · append-only</span>}
        >
          <div className="flex flex-wrap gap-2.5 px-1 pb-1">
            {STAMPABLE_EVENTS.map((e) => {
              const already = e.stamped ?? undefined
              const sessionStamp = stamps.find((s) => s.key === e.key)
              const done = Boolean(already ?? sessionStamp)
              return (
                <button
                  key={e.key}
                  type="button"
                  onFocus={() => setFocused(e.key)}
                  onClick={() => {
                    if (done) return
                    stamp(e.key, e.label, me.name)
                    toast({
                      tone: 'success',
                      title: `${e.label} stamped`,
                      detail: `${formatTime(caseNow)} · by ${me.name} · append-only`,
                    })
                  }}
                  disabled={done}
                  className={cx(
                    'min-h-14 min-w-40 rounded-field px-4 py-2.5 text-left transition-colors',
                    done
                      ? 'bg-normal-soft text-normal'
                      : focused === e.key
                        ? 'ring-2 ring-ai bg-glass-fill-strong'
                        : 'bg-glass-fill-muted hover:bg-glass-fill-hover',
                  )}
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Icon name={done ? 'Check' : 'Timer'} size={15} />
                    {e.label}
                  </span>
                  <span className="tabular mt-0.5 block text-[0.86em] opacity-80">
                    {done
                      ? `stamped ${formatTime((already ?? sessionStamp!.at) as Date)}`
                      : focused === e.key
                        ? 'press e, or tap'
                        : 'not stamped'}
                  </span>
                </button>
              )
            })}
          </div>
        </SectionCard>

        {breachReasons.length > 0 && (
          <SectionCard title="Breach reasons captured" meta={<CountPill>{breachReasons.length}</CountPill>}>
            <ul className="divide-y divide-glass-hairline">
              {breachReasons.map((b, i) => (
                <li key={i} className="px-3 py-2.5">
                  <p className="font-medium">{b.reason}</p>
                  {b.detail && <p className="text-[0.9em] text-ink-2">{b.detail}</p>}
                  <p className="tabular mt-0.5 flex flex-wrap items-center gap-2 text-[0.84em] text-ink-3">
                    <Chip tone="neutral">{b.intervalKey}</Chip>
                    captured {formatTime(b.at)} by {b.by}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      <ConfirmDialog
        open={breachFor !== null}
        title="Capture the breach reason"
        consequence="This is recorded against the interval now, at the moment it happened. A reason written three weeks later at audit is not the same evidence, which is why the capture is here rather than in a report."
        confirmLabel="Record the reason"
        onConfirm={() => {
          if (!breachFor) return
          captureBreach({ intervalKey: breachFor, reason, detail: detail.trim() || undefined, by: me.name })
          toast({ tone: 'info', title: 'Breach reason recorded', detail: `${reason} · ${formatTime(caseNow)}` })
          setBreachFor(null)
          setDetail('')
        }}
        onCancel={() => {
          setBreachFor(null)
          setDetail('')
        }}
      >
        <div className="space-y-3">
          <Select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Breach reason">
            {BREACH_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <TextArea rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Anything specific…" />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deactivate}
        title="De-activate this case?"
        consequence="The clock closes and the case leaves the active wall. A de-activated case keeps its record and its reason — this is how a stroke mimic is recorded honestly rather than deleted."
        confirmLabel="De-activate with a reason"
        tone="destructive"
        onConfirm={() => {
          setDeactivate(false)
          toast({ tone: 'caution', title: 'Case de-activated', detail: 'The clock is closed. The record remains.' })
          navigate('/stroke/wall')
        }}
        onCancel={() => setDeactivate(false)}
      >
        <Select defaultValue="Stroke mimic — seizure" aria-label="De-activation reason">
          {['Stroke mimic — seizure', 'Stroke mimic — migraine', 'Stroke mimic — hypoglycaemia', 'Diagnosis revised', 'Other'].map(
            (r) => (
              <option key={r}>{r}</option>
            ),
          )}
        </Select>
      </ConfirmDialog>
    </Screen>
  )
}
