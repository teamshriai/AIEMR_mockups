/**
 * S-06-01 · My Day — `/clinician` · T1 · ARC-20
 *
 * "The consultant's day, ranked by who needs them first."
 *
 * Deck beat #5, rebuilt as a workspace rather than a dashboard. The screen
 * answers four questions and declines to answer a fifth:
 *   1. What is my day?                    → Today
 *   2. Who is mine today?                 → Patients Today — OPD and Inpatients
 *   3. What needs me, and what must I     → Needs Action — Attention, Tasks and
 *      finish before I leave?                my own to-do notes
 *   4. What is the rest of my month?      → Calendar
 * Anything about a specific patient is ONE TAP AWAY — the Quick-Panel from an
 * attention row, the record from a patient row. Put it here instead and the
 * screen stops being scannable, which is the whole point. Results are
 * deliberately absent as a widget: a critical one interrupts through
 * Attention; the rest belong in Results, not on the home.
 *
 * Two columns. The left is the day and what to do about it: Today — the one
 * solid slate card the flat system keeps, with its rail, badges and Now band —
 * then Needs Action. The right is who is in the day: Patients Today, then the
 * month, which fills the rest of the column so both columns end level. The
 * patient lists are names, not counts, with a place icon, at most two marks and
 * no "See all" — OPD and Inpatients are one tap away in the nav. A date in the
 * month opens in a side panel with an AI brief of that day, its schedule and
 * who is booked.
 *
 * `ARC-20` is a tile dashboard and this is not tiled, which is a deliberate
 * deviation. What the archetype's drawing notes actually require is kept:
 *   • the needs-attention group at the top with its reason;
 *   • all the work types on one screen — clinic and ward as lists, co-sign
 *     and discharge as blocks in the day;
 *   • "Sorted by AI acuity ▾" reversible and visible — the line under the
 *     attention list, because AI-613's guardrail is that the deterministic sort
 *     is always one click away.
 *
 * Sample data: SD-S-01 at 08:40.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Diamond } from '@/components/ai'
import { MonthCalendarCard } from '@/components/monthcalendar'
import { CountPill, SectionCard } from '@/components/calm'
import {
  AttentionRow,
  DayTimeline,
  FinishRow,
  Greeting,
  Panel,
  PanelBlock,
  PanelSection,
  PatientGroup,
  PatientList,
  TodoNotesSection,
} from '@/components/myday'
import { DictationPanel } from '@/components/dictation'
import { Button, Card, Chip, Icon, IconButton, cx } from '@/components/primitives'
import { PartialRegion } from '@/components/states'
import { entriesOn } from '@/data/calendar'
import { NOW, formatDateLong, formatTime } from '@/data/format'
import { facility, patient } from '@/data/kit'
import {
  attentionChronological,
  attentionFor,
  currentBlock,
  dayPlanFor,
  inpatientList,
  isStrokePersona,
  opdList,
  telestrokeList,
  toFinishFor,
} from '@/data/myday'
import type { AttentionItem } from '@/data/myday'
import { useAdmissions } from '@/store/admissions'
import { selectAiActive, useAI } from '@/store/ai'
import { UNATTACHED, useClinical } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { QuickPanel } from './myday/QuickPanel'

export function S0601() {
  const me = useCurrentStaff()
  const persona = useSession((s) => s.persona)
  const facilityCode = useSession((s) => s.facilityCode)
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)
  const forceState = useAI((s) => s.forceState)
  const toast = useUI((s) => s.toast)

  const acknowledgements = useClinical((s) => s.acknowledgements)
  const seenAt = useClinical((s) => s.seenAt)
  const pendingSeen = useClinical((s) => s.pendingSeen)
  const flushPendingSeen = useClinical((s) => s.flushPendingSeen)
  const notes = useClinical((s) => s.notes)
  const coSigned = useClinical((s) => s.coSigned)
  const triagedReferrals = useClinical((s) => s.triagedReferrals)
  const voiceNotes = useClinical((s) => s.voiceNotes)
  const toggleVoiceNoteDone = useClinical((s) => s.toggleVoiceNoteDone)
  const deleteVoiceNote = useClinical((s) => s.deleteVoiceNote)
  const admissions = useAdmissions((s) => s.admissions)
  /** The doctor's own reminders — saved from Needs Action's to-do notes, attached to no patient. */
  const todos = voiceNotes[UNATTACHED] ?? []

  const [open, setOpen] = useState<AttentionItem | null>(null)
  const [dictating, setDictating] = useState<AttentionItem | null>(null)
  /** The free note's dialog: listening, ready to type, or closed. */
  const [freeNote, setFreeNote] = useState<'voice' | 'type' | null>(null)
  /** AI-LOW arrives collapsed; the ranking cannot be used until it is expanded. */
  const [rankingExpanded, setRankingExpanded] = useState(false)
  const [aiSort, setAiSort] = useState(true)

  const isStroke = isStrokePersona(persona)
  const blocks = useMemo(
    () => dayPlanFor(persona, { admissions, acknowledgements, coSigned }),
    [persona, admissions, acknowledgements, coSigned],
  )
  const toFinish = useMemo(
    () => toFinishFor(persona, { notes, coSigned, triagedReferrals, voiceNotes }),
    [persona, notes, coSigned, triagedReferrals, voiceNotes],
  )
  const opd = useMemo(() => opdList(admissions), [admissions])
  const inpatients = useMemo(() => inpatientList(admissions), [admissions])
  const telestroke = useMemo(() => telestrokeList(), [])
  const current = currentBlock(blocks)
  const upNext = blocks.find((b) => b.at > NOW && b.id !== current?.id)
  /** Everything on a date of the month calendar — today is the day plan above. */
  const entriesFor = useCallback(
    (day: Date) => entriesOn(day, { staffName: me.name, stroke: isStroke, today: blocks }),
    [me.name, isStroke, blocks],
  )

  /**
   * Anyone marked seen drops off the list — that is what marking seen is for.
   * Recomputed from the store so it survives a reload.
   */
  const ranked = useMemo(
    () => attentionFor(persona, acknowledgements, admissions).filter((i) => seenAt[i.patientId] === undefined),
    [persona, acknowledgements, seenAt, admissions],
  )

  const lowConfidence = forced === 'AI-LOW'
  const ordered = aiSort && aiActive && (!lowConfidence || rankingExpanded)
    ? ranked
    : attentionChronological(ranked)

  const criticalCount = ordered.filter((i) => i.urgency === 'critical').length
  const warningCount = ordered.filter((i) => i.urgency === 'warning').length

  /** C-37's promise kept: what was queued while offline actually syncs. */
  useEffect(() => {
    if (forced !== 'OFFLINE' && pendingSeen.length > 0) {
      const n = pendingSeen.length
      flushPendingSeen(NOW.toISOString())
      toast({
        tone: 'success',
        title: `${n} queued ${n === 1 ? 'update' : 'updates'} synced`,
        detail: 'Nothing was lost while you were offline.',
      })
    }
  }, [forced, pendingSeen, flushPendingSeen, toast])

  /**
   * Acceptance test 7. There is no backend and no service worker, so a "push"
   * is simulated here — a C-33 toast plus a real Notification where the browser
   * grants one. The affordance is dev-only, because it is a demo control.
   */
  function simulateCriticalEvent() {
    const worst = ranked.find((i) => i.urgency === 'critical') ?? ranked[0]
    if (!worst) return
    const p = patient(worst.patientId)
    toast({ tone: 'critical', title: `${worst.reason} — ${p.name}`, detail: worst.detail })
    if ('Notification' in window) {
      void Notification.requestPermission().then((granted) => {
        if (granted === 'granted') {
          new Notification(`${worst.reason} — ${p.name}`, { body: worst.detail })
        }
      })
    }
    setOpen(worst)
  }

  return (
    <>
      <Screen
        screenId="S-06-01"
        wide
        loadingShape="tiles"
        heading={<Greeting name={me.name} />}
        subheading={
          <>
            {formatDateLong(NOW)} · {me.speciality ?? me.personaLabel} · {facility(facilityCode).name}
          </>
        }
        states={['LOADING', 'EMPTY', 'PARTIAL', 'AI-OFF', 'AI-LOW', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE']}
        empty={
          <Card className="p-10 text-center">
            <p className="text-lg font-medium">Nothing is waiting on you.</p>
            <p className="mx-auto mt-2 max-w-md text-ink-3">
              No session is open, you have no inpatients assigned, and nothing is left to review. A session starting
              or a patient being admitted under you would put something here.
            </p>
          </Card>
        }
        actions={
          <>
            {/* A demo control, DEV-only and desktop-only. The to-do note is added from its own card. */}
            {import.meta.env.DEV && (
              <IconButton
                icon="BellRing"
                label="Simulate a critical event (demo)"
                onClick={simulateCriticalEvent}
                className="hidden size-9 lg:inline-flex"
                size={14}
              />
            )}
          </>
        }
      >
        {/*
          Two columns from `lg`. Left: Today — the day, on its own slate card —
          then Needs Action under it. Right: Patients Today, then the month,
          which takes whatever height is left so the two columns end level.
          Below `lg` the same order, stacked: Today, Needs Action, Patients
          Today, Calendar. `wide` because the reading measure is set in rem and
          compact density shrinks it; a home screen should fill its frame.
        */}
        <div className="grid min-w-0 flex-1 gap-5 pt-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
          {/* LEFT — the day, then what to do about it. */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* TODAY — the day as a timeline, on the one solid card the flat system keeps. */}
            <SectionCard
              title="Today"
              className="card-today"
              meta={
                current ? (
                  <CountPill tone="brand">Now · {current.title}</CountPill>
                ) : (
                  <CountPill>{blocks.length} activities</CountPill>
                )
              }
              action={
                upNext && (
                  <span className="tabular flex items-center gap-1.5 text-[0.86em] text-ink-3">
                    <Icon name="Clock" size={13} />
                    Up next {formatTime(upNext.at)} · <span className="font-semibold text-ink-2">{upNext.title}</span>
                  </span>
                )
              }
            >
              <DayTimeline blocks={blocks} currentId={current?.id} aiActive={aiActive} />
            </SectionCard>

            {/* NEEDS ACTION — what is urgent, what is the doctor's to close, and their own to-dos.
                Its hue is its top urgency's, as an attention card's is everywhere. */}
            <Panel className={cx(ordered.length > 0 && `card-toned card-urgency-${ordered[0].urgency}`)}>
              <PanelBlock
                title="Needs Action"
                meta={
                  ordered.length > 0 &&
                  (criticalCount > 0 ? (
                    <span className="text-[0.86em] font-medium text-pri-critical-ink">{criticalCount} critical</span>
                  ) : warningCount > 0 ? (
                    <span className="text-[0.86em] font-medium text-pri-warning-ink">
                      {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                    </span>
                  ) : (
                    <span className="text-[0.86em] text-ink-3">{ordered.length} pending</span>
                  ))
                }
              >
                <div className="divide-y divide-glass-hairline">
                  {/* ATTENTION — the ranked items; a row opens its Quick-Panel. */}
                  <PanelSection label="Attention" count={ordered.length > 0 ? ordered.length : undefined}>
                    {ordered.length === 0 ? (
                      <p className="px-2 pb-2 text-[0.95em] text-ink-2">
                        Nothing needs you right now. A critical result, a rising risk score or a note awaiting your
                        signature would appear here.
                      </p>
                    ) : (
                      <div className="flex min-h-0 flex-col">
                        {/* §4.5 — LOW arrives COLLAPSED and cannot be used until expanded. */}
                        {lowConfidence && aiActive && !rankingExpanded && (
                          <div className="mx-1 mb-2 rounded-panel border border-caution/35 bg-caution-soft px-3 py-2.5">
                            <p className="flex items-center gap-2 text-[0.9em] font-semibold text-caution">
                              <Icon name="TriangleAlert" size={14} />
                              Low confidence in this ranking
                            </p>
                            <p className="mt-1 text-[0.88em] text-ink-2">
                              AI-613 could not rank today&rsquo;s list with confidence. The list below is in time order
                              until you review the ranking.
                            </p>
                            <Button size="sm" icon="ChevronDown" className="mt-2" onClick={() => setRankingExpanded(true)}>
                              Show the ranking
                            </Button>
                          </div>
                        )}

                        <ul className="divide-y divide-glass-hairline">
                          {ordered.map((i) => (
                            <AttentionRow
                              key={i.id}
                              urgency={i.urgency}
                              reason={i.reason}
                              patientName={patient(i.patientId).name}
                              onOpen={() => setOpen(i)}
                              onDictate={() => setDictating(i)}
                            />
                          ))}
                        </ul>

                        {/* AI-613's guardrail, in one quiet line. */}
                        {aiActive ? (
                          <button
                            type="button"
                            onClick={() => setAiSort((v) => !v)}
                            className="flex min-h-10 items-center gap-1.5 self-start rounded-chip px-2 pt-1 text-[0.82em] text-ink-3 hover:bg-glass-fill-hover hover:text-ink-2"
                          >
                            {aiSort ? <Diamond size={9} /> : <Icon name="Clock" size={11} />}
                            {aiSort ? 'Sorted by AI acuity' : 'Sorted by time'}
                            <Icon name="ChevronDown" size={11} />
                          </button>
                        ) : (
                          <p className="px-2 pt-2 text-[0.82em] text-ink-3">Sorted by time · AI ranking is off</p>
                        )}
                      </div>
                    )}
                  </PanelSection>

                  {/* TASKS — documentation and sign-offs that are the doctor's to close. */}
                  <PanelSection
                    label="Tasks"
                    count={toFinish.length > 0 ? toFinish.reduce((n, i) => n + i.count, 0) : undefined}
                  >
                    {toFinish.length === 0 ? (
                      <p className="px-2 pb-2 text-[0.95em] text-ink-2">
                        Nothing left to sign or write. A ward round note, a co-sign or a referral to review would appear
                        here.
                      </p>
                    ) : (
                      <ul className="divide-y divide-glass-hairline">
                        {toFinish.map((i) => (
                          <FinishRow key={i.key} item={i} />
                        ))}
                      </ul>
                    )}
                  </PanelSection>

                  {/* TO-DO NOTES — what the doctor told themselves to do. Added from the section's own mic or plus. */}
                  <TodoNotesSection
                    notes={todos}
                    onAdd={setFreeNote}
                    onToggle={(id) => toggleVoiceNoteDone(UNATTACHED, id)}
                    onDelete={(n) => {
                      deleteVoiceNote(UNATTACHED, n.id)
                      toast({
                        tone: 'info',
                        title: 'To-do note deleted',
                        detail: `“${n.body.length > 60 ? `${n.body.slice(0, 60).trimEnd()}…` : n.body}”`,
                      })
                    }}
                  />
                </div>
              </PanelBlock>
            </Panel>
          </div>

          {/* RIGHT — who is mine today, then the month filling the rest of the column. */}
          <div className="flex min-w-0 flex-col gap-5">
            <Panel>
              <PanelBlock title="Patients Today">
                {/* Two sections that read as different places — ground, icon, row tiles — with a gap between. */}
                <div className="space-y-3 px-3 pb-3 sm:px-4">
                  {isStroke ? (
                    <PatientGroup label="Telestroke queue" icon="Video" tone="stroke" count={telestroke.length}>
                      {forced === 'PARTIAL' ? (
                        <PartialRegion what="Telestroke queue" since="08:12" onRetry={() => forceState(null)} />
                      ) : (
                        <PatientList
                          rows={telestroke}
                          tone="stroke"
                          label="Telestroke requests from the spokes"
                          empty="No spoke is waiting on a telestroke consult."
                        />
                      )}
                    </PatientGroup>
                  ) : (
                    <>
                      {/* OPD — today's clinic, who is next first. */}
                      <PatientGroup label="OPD" icon="UserRound" tone="opd" count={opd.length}>
                        <PatientList
                          rows={opd}
                          tone="opd"
                          label="Today's OPD patients"
                          empty="No one is booked into OPD today."
                        />
                      </PatientGroup>

                      {/* INPATIENTS — everyone in a bed under this consultant. */}
                      <PatientGroup label="Inpatients" icon="BedDouble" tone="inpatients" count={inpatients.length}>
                        {forced === 'PARTIAL' ? (
                          <PartialRegion what="Bed state" since="08:12" onRetry={() => forceState(null)} />
                        ) : (
                          <PatientList
                            rows={inpatients}
                            tone="inpatients"
                            label="Inpatients under you"
                            empty="No inpatients are assigned to you. An admission under your name would put them here."
                          />
                        )}
                      </PatientGroup>
                    </>
                  )}
                </div>
              </PanelBlock>
            </Panel>

            {/* CALENDAR — sessions and bookings by date; a date opens with an AI brief. */}
            <MonthCalendarCard entriesFor={entriesFor} fill className="lg:flex-1" />
          </div>

          {pendingSeen.length > 0 && (
            <div className="px-1 lg:col-span-2">
              <Chip tone="caution" icon="WifiOff">
                {pendingSeen.length} queued for sync
              </Chip>
            </div>
          )}
        </div>
      </Screen>

      <QuickPanel item={open} onClose={() => setOpen(null)} />

      {/* Per-patient dictation, from the mic on an attention row. */}
      <DictationPanel
        open={dictating !== null}
        onClose={() => setDictating(null)}
        patientId={dictating?.patientId}
        patientName={dictating ? patient(dictating.patientId).name : undefined}
      />

      {/* The global note, not attached to anyone yet. */}
      <DictationPanel open={freeNote !== null} initialMode={freeNote ?? 'voice'} onClose={() => setFreeNote(null)} />
    </>
  )
}
