/**
 * S-06-01 · My Day — `/clinician` · T1 · ARC-20
 *
 * "The consultant's day, ranked by who needs them first."
 *
 * Deck beat #5, rebuilt for calm. The screen answers three questions and
 * declines to answer a fourth:
 *   1. What is my day?                   → the timeline card
 *   2. What needs me right now?          → the attention card
 *   3. What must I finish before I leave? → the to-finish card, and who is
 *                                           going home today
 * Anything about a specific patient is ONE TAP AWAY, in the Quick-Panel. Put it
 * here instead and the screen stops being scannable, which is the whole point.
 * Results are deliberately absent as a widget: a critical one interrupts
 * through the attention card; the rest belong in Results, not on the home.
 *
 * Six surfaces, all on the same frosted frame (`SectionCard`), so the screen
 * has structure without a single table: the day, the attention list, the work
 * to finish, the doctor's own to-do notes, the counts, today's discharges. The attention card carries a top
 * accent in the top urgency's hue and a count pill — it is the one thing on
 * the screen allowed to be loud.
 *
 * `ARC-20` is a tile dashboard and this is not tiled, which is a deliberate
 * deviation. What the archetype's drawing notes actually require is kept:
 *   • the needs-attention group at the top with its reason;
 *   • all the work types on one screen — clinic, ward, ICU and follow-up as
 *     counts, co-sign and discharge as blocks in the day;
 *   • "Sorted by AI acuity ▾" reversible and visible — the line under the
 *     attention list, because AI-613's guardrail is that the deterministic sort
 *     is always one click away.
 *
 * Sample data: SD-S-01 at 08:40.
 */

import { useEffect, useMemo, useState } from 'react'
import { Diamond } from '@/components/ai'
import {
  AttentionRow,
  CountPill,
  DayTimeline,
  DischargeRow,
  FinishRow,
  Greeting,
  PatientCounts,
  PillLink,
  SectionCard,
  TodoNotesCard,
} from '@/components/myday'
import { DictationPanel } from '@/components/dictation'
import { Button, Card, Chip, Icon, IconButton } from '@/components/primitives'
import { PartialRegion } from '@/components/states'
import { NOW, formatDateLong, formatTime } from '@/data/format'
import { facility, patient } from '@/data/kit'
import {
  attentionChronological,
  attentionFor,
  currentBlock,
  dayPlanFor,
  dischargesToday,
  patientCounts,
  toFinishFor,
} from '@/data/myday'
import type { AttentionItem } from '@/data/myday'
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
  /** The doctor's own reminders — saved from "Add today's to-do note", attached to no patient. */
  const todos = voiceNotes[UNATTACHED] ?? []

  const [open, setOpen] = useState<AttentionItem | null>(null)
  const [dictating, setDictating] = useState<AttentionItem | null>(null)
  const [freeNote, setFreeNote] = useState(false)
  /** AI-LOW arrives collapsed; the ranking cannot be used until it is expanded. */
  const [rankingExpanded, setRankingExpanded] = useState(false)
  const [aiSort, setAiSort] = useState(true)

  const blocks = useMemo(() => dayPlanFor(persona), [persona])
  const counts = useMemo(() => patientCounts(persona), [persona])
  const toFinish = useMemo(
    () => toFinishFor(persona, { notes, coSigned, triagedReferrals, voiceNotes }),
    [persona, notes, coSigned, triagedReferrals, voiceNotes],
  )
  const discharges = useMemo(() => dischargesToday(), [])
  const isStroke = counts[0]?.key === 'active'
  const current = currentBlock(blocks)
  const upNext = blocks.find((b) => b.at > NOW && b.id !== current?.id)

  /**
   * Anyone marked seen drops off the list — that is what marking seen is for.
   * Recomputed from the store so it survives a reload.
   */
  const ranked = useMemo(
    () => attentionFor(persona, acknowledgements).filter((i) => seenAt[i.patientId] === undefined),
    [persona, acknowledgements, seenAt],
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
            <Button tone="primary" icon="Mic" onClick={() => setFreeNote(true)}>
              Add today&rsquo;s to-do note
            </Button>
            {/* A demo control, DEV-only and desktop-only — the header carries no extra icons. */}
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
          Vertical flow on a phone: the day, then attention, then what is left to
          finish, then counts, then discharges. From `lg` two columns; from `xl`
          three — the day, the two attention cards, the two patient cards — each
          a column whose last card takes the slack, so the three bottoms align
          and the frame is full at 1440 and 1920 without a fact that is not the
          doctor's to act on. `wide` because the reading measure is set in rem
          and compact density shrinks it; a home screen should fill its frame.
        */}
        <div className="grid min-w-0 flex-1 gap-5 pt-2 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:grid-rows-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)] xl:grid-rows-1">
          {/* THE DAY. The primary focus, and the only thing above the fold. */}
          <SectionCard
            title="Today"
            fill
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

          {/* Column two: attention first, where it matters most, then what is pending. */}
          <div className="flex min-w-0 flex-col gap-5">
            {/* NEEDS MY ATTENTION — the heaviest thing on the screen. */}
            <SectionCard
              title="Needs my attention"
              accent={ordered[0]?.urgency}
              lift
              meta={
                ordered.length > 0 &&
                (criticalCount > 0 ? (
                  <CountPill tone="critical">
                    {criticalCount} critical
                  </CountPill>
                ) : warningCount > 0 ? (
                  <CountPill tone="warning">
                    {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
                  </CountPill>
                ) : (
                  <CountPill tone="pending">{ordered.length} pending</CountPill>
                ))
              }
              action={ordered.length > 0 && <PillLink to="/ip/patients">See all</PillLink>}
            >
              {ordered.length === 0 ? (
                <p className="px-2 py-4 text-[0.95em] text-ink-2">
                  Nothing needs you right now. A critical result, a rising risk score or a note awaiting your signature
                  would appear here.
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
                        AI-613 could not rank today&rsquo;s list with confidence. The list below is in time order until
                        you review the ranking.
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
                      className="flex min-h-10 items-center gap-1.5 self-start rounded-pill px-2 pt-2 text-[0.82em] text-ink-3 hover:bg-glass-fill-hover hover:text-ink-2"
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
            </SectionCard>

            {/* PENDING TODAY — documentation and sign-offs that are the doctor's to close. Takes the slack. */}
            <SectionCard
              title="Pending today"
              lift
              fill
              className="flex-1"
              meta={toFinish.length > 0 && <CountPill>{toFinish.reduce((n, i) => n + i.count, 0)}</CountPill>}
            >
              {toFinish.length === 0 ? (
                <p className="px-2 py-4 text-[0.95em] text-ink-2">
                  Nothing left to sign or write. A ward round note, a co-sign or a referral to review would appear here.
                </p>
              ) : (
                <ul className="divide-y divide-glass-hairline">
                  {toFinish.map((i) => (
                    <FinishRow key={i.key} item={i} />
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Column three: my own to-dos, then who is mine and who goes home — those two side by side at lg, stacked from xl. */}
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-2 xl:col-span-1">
            {/* TODAY'S TO-DO NOTES — what the doctor told themselves to do. Saved from the header's dictation. */}
            <TodoNotesCard
              notes={todos}
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

            <div className="flex min-w-0 flex-1 flex-col gap-5 lg:flex-row xl:flex-col">
              {/* MY PATIENTS — counts only, with one line each on what is pending. The lists live on their own screens. */}
              <SectionCard
                title="My patients"
                lift
                fill={isStroke}
                className={isStroke ? 'flex-1' : 'lg:flex-1 xl:flex-none'}
                meta={<CountPill>{counts.reduce((n, c) => n + c.value, 0)}</CountPill>}
              >
                {forced === 'PARTIAL' ? (
                  <PartialRegion what="Bed state" since="08:12" onRetry={() => forceState(null)} />
                ) : (
                  <PatientCounts counts={counts} columns={2} />
                )}
              </SectionCard>

              {/* DISCHARGES TODAY — who is going home, and what is in the way. The consultant's afternoon. */}
              {!isStroke && (
                <SectionCard
                  title="Discharges today"
                  lift
                  fill
                  className="flex-1"
                  meta={<CountPill tone={discharges.length > 0 ? 'pending' : 'neutral'}>{discharges.length} today</CountPill>}
                  action={<PillLink to="/discharge/board">See all</PillLink>}
                >
                  {discharges.length === 0 ? (
                    <p className="px-2 py-4 text-[0.95em] text-ink-2">No one is predicted to go home today.</p>
                  ) : (
                    <ul className="divide-y divide-glass-hairline">
                      {discharges.map((r) => (
                        <DischargeRow key={r.patientId} row={r} />
                      ))}
                    </ul>
                  )}
                </SectionCard>
              )}
            </div>
          </div>

          {pendingSeen.length > 0 && (
            <div className="px-1 lg:col-span-2 xl:col-span-3">
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
      <DictationPanel open={freeNote} onClose={() => setFreeNote(false)} />
    </>
  )
}
