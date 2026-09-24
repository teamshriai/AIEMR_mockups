/**
 * S-05-04 · Clinician Session Template Setup — `/schedule/templates` · T3 · ARC-18
 *
 * "A clinician's recurring session pattern."
 *
 * Effective-dated master data (ARC-18): changing a template does not rewrite
 * the appointments already booked against the old one. AI-608 suggests capacity
 * changes at G1 — it notices that a session consistently overruns, and manual
 * template editing remains the fallback.
 *
 * Calm pass: the surface opens on today's session only; the week is one tap
 * away. The effective-dating rule and the throughput caveat are folded behind
 * `Why`, and the two AI-608 suggestions stay in the rail because they are the
 * only actionable things here.
 */

import { useState } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { SuggestionCard } from '@/components/ai'
import { ScopeTabs, Why, useScope } from '@/components/calm'
import { Modal } from '@/components/overlays'
import { Button, Card, Chip, Field, Select, TextInput } from '@/components/primitives'
import { formatTime, NOW } from '@/data/format'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

interface Session {
  id: string
  day: string
  start: string
  end: string
  slotMin: number
  clinic: string
  capacity: number
  effectiveFrom: string
  /** AI-608's observation about this session. */
  observation?: string
  observationBand?: 'HIGH' | 'MED' | 'LOW'
  observationConfidence?: number
}

const SESSIONS: Session[] = [
  {
    id: 'T-1',
    day: 'Monday',
    start: '08:00',
    end: '12:00',
    slotMin: 10,
    clinic: 'General medicine, new and follow-up',
    capacity: 24,
    effectiveFrom: '01-Apr-2026',
    observation:
      'This session has run over by a median of 34 minutes across the last 12 weeks. At 24 slots of 10 minutes against a mean consultation of 11, the template is 24 minutes short before anything goes wrong.',
    observationBand: 'HIGH',
    observationConfidence: 0.91,
  },
  { id: 'T-2', day: 'Tuesday', start: '14:00', end: '17:00', slotMin: 15, clinic: 'Thyroid and endocrine follow-up', capacity: 12, effectiveFrom: '01-Apr-2026' },
  { id: 'T-3', day: 'Thursday', start: '08:00', end: '11:00', slotMin: 10, clinic: 'General medicine, follow-up only', capacity: 18, effectiveFrom: '01-Apr-2026' },
  {
    id: 'T-4',
    day: 'Friday',
    start: '09:00',
    end: '12:00',
    slotMin: 20,
    clinic: 'Complex and multi-morbidity',
    capacity: 9,
    effectiveFrom: '01-Jul-2026',
    observation:
      'Consistently finishes 18 minutes early. Two more slots would fit without pushing the mean consultation down.',
    observationBand: 'MED',
    observationConfidence: 0.74,
  },
]

/** NOW is Mon 21-Sep-2026, so "today" is the Monday pattern. */
const TODAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][NOW.getDay()]

type Scope = 'today' | 'week'
const SCOPES: readonly Scope[] = ['today', 'week']

export function S0504() {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const [effectiveOn, setEffectiveOn] = useState('2026-09-21')
  const [editing, setEditing] = useState<Session | null>(null)
  const [slotMin, setSlotMin] = useState(10)
  const [scope, setScope] = useScope(SCOPES, 'today')
  /** Sessions created here, this device only. */
  const [created, setCreated] = useState<Session[]>([])
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ day: TODAY_NAME, start: '14:00', end: '17:00', slotMin: 15, clinic: '' })
  const allSessions = [...SESSIONS, ...created]

  const today = allSessions.filter((s) => s.day === TODAY_NAME)
  const suggested = allSessions.filter((s) => s.observation)
  const rows = scope === 'today' ? today : allSessions

  function edit(s: Session) {
    setEditing(s)
    setSlotMin(s.slotMin)
  }

  const columns: WorklistColumn<Session>[] = [
    {
      key: 'time',
      label: 'Time',
      role: 'lead',
      cell: (s) => `${s.start}–${s.end}`,
    },
    { key: 'clinic', label: 'OPD', role: 'primary', cell: (s) => s.clinic },
    { key: 'day', label: 'Day', role: 'context', cell: (s) => s.day },
    { key: 'slot', label: 'Slot', role: 'context', cell: (s) => <span className="tabular">{s.slotMin}-min slots</span> },
    {
      key: 'capacity',
      label: 'Capacity',
      role: 'context',
      cell: (s) => <span className="tabular">{s.capacity} patients</span>,
    },
    {
      key: 'effective',
      label: 'Effective from',
      role: 'status',
      cell: (s) => (
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {s.observation && (
            <Chip tone="caution" icon="TriangleAlert">
              capacity review
            </Chip>
          )}
          <Chip tone="neutral" className="tabular">
            from {s.effectiveFrom}
          </Chip>
        </span>
      ),
    },
    {
      key: 'edit',
      label: '',
      role: 'status',
      cell: (s) => (
        <span
          role="button"
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation()
            edit(s)
          }}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-brand-soft px-3.5 text-[0.86em] font-semibold text-brand hover:bg-brand hover:text-brand-on"
        >
          Edit
        </span>
      ),
    },
  ]

  return (
    <Screen
      screenId="S-05-04"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      heading="Session templates"
      subheading={
        <>
          {today.length} session today · {allSessions.length} this week
          {suggested.length > 0 && ` · ${suggested.length} capacity suggestions`}
        </>
      }
      actions={
        <>
          <TextInput
            type="date"
            value={effectiveOn}
            onChange={(e) => setEffectiveOn(e.target.value)}
            className="min-h-9 w-auto py-1.5 text-[0.9em]"
            aria-label="Effective on"
          />
          <Button tone="primary" icon="Plus" onClick={() => setCreating(true)}>
            New session
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          {suggested.map((s) => (
            <SuggestionCard
              key={s.id}
              touchpointId={`template:${s.id}`}
              capabilityId="AI-608"
              title={`${s.day} ${s.start} — ${s.capacity > 12 ? 'over-booked' : 'under-booked'}`}
              evidence={s.observation!}
              band={s.observationBand ?? 'MED'}
              score={s.observationConfidence}
              gate="G1"
              explain={{
                touchpointId: `template:${s.id}`,
                capabilityId: 'AI-608',
                claim: `The ${s.day} ${s.start} template does not match how the session actually runs.`,
                confidence: s.observationConfidence ?? 0.75,
                band: s.observationBand ?? 'MED',
                computedAt: formatTime(NOW),
                inputs: [
                  { label: 'Session start and finish times, 12 weeks', source: 'Clinic session history' },
                  { label: 'Consultation durations', source: 'Encounter records' },
                  { label: 'Did-not-attend rate for this session', source: 'Appointment book' },
                ],
                evidence: [s.observation!],
                model: 'capacity-opt v2.2.0',
                limits: [
                  'Observes the past. A change in case mix makes it wrong until it has re-learned.',
                  'It does not know which overruns were worth having.',
                  'Manual template editing is the fallback.',
                ],
              }}
            />
          ))}
        </div>
      }
      railTitle="Capacity"
      railBadge={suggested.length}
    >
      <div className="max-w-4xl space-y-5">
        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(s) => s.id}
          onOpen={edit}
          caption={`Weekly session pattern · effective on ${effectiveOn} · ${me.name}`}
          noun="sessions"
          emptyWhy={
            scope === 'today'
              ? `No session is templated for ${TODAY_NAME}. The week's pattern is one tap away.`
              : 'No sessions are templated yet. A new session would appear here.'
          }
          emptyAction={
            scope === 'today' ? (
              <Button size="sm" onClick={() => setScope('week')}>
                Show this week
              </Button>
            ) : undefined
          }
          filters={
            <ScopeTabs
              value={scope}
              onChange={setScope}
              options={[
                { key: 'today', label: 'Today', count: today.length },
                { key: 'week', label: 'This week', count: allSessions.length },
              ]}
            />
          }
        />

        <Why label="Why a change is never retrospective">
          <p className="text-ink-2">
            Editing a template creates a new version effective from a date you choose. Appointments already booked keep
            the template they were booked against — a patient does not lose their slot because the pattern changed.
          </p>
          <p className="text-ink-3">
            Shortening a slot raises capacity but not throughput. If the mean consultation is 11 minutes, ten-minute
            slots guarantee the session runs late.
          </p>
        </Why>

        {editing && (
          <Card strong className="p-5">
            <h2 className="font-semibold">
              {editing.day} {editing.start}–{editing.end}
            </h2>
            <p className="text-[0.9em] text-ink-3">{editing.clinic}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Slot length" htmlFor="slot-len">
                <Select
                  id="slot-len"
                  value={String(slotMin)}
                  onChange={(e) => setSlotMin(Number(e.target.value))}
                >
                  {[10, 12, 15, 20, 30].map((m) => (
                    <option key={m} value={m}>
                      {m} minutes
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Resulting capacity" htmlFor="cap">
                <TextInput
                  id="cap"
                  readOnly
                  value={String(
                    Math.floor(
                      (Number(editing.end.split(':')[0]) * 60 +
                        Number(editing.end.split(':')[1]) -
                        (Number(editing.start.split(':')[0]) * 60 + Number(editing.start.split(':')[1]))) /
                        slotMin,
                    ),
                  )}
                />
              </Field>
              <Field label="Effective from" htmlFor="eff-from">
                <TextInput id="eff-from" type="date" defaultValue="2026-10-01" />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                tone="primary"
                icon="Check"
                onClick={() => {
                  toast({
                    tone: 'success',
                    title: `${editing.day} template updated`,
                    detail: 'Effective from 01-Oct-2026. Existing bookings are untouched.',
                  })
                  setEditing(null)
                }}
              >
                Save a new version
              </Button>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </Card>
        )}
      </div>
      <Modal
        open={creating}
        size="sm"
        title="New session template"
        subtitle="A recurring clinic session. Effective from the date in the header."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button icon="X" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              icon="Check"
              disabled={draft.clinic.trim().length < 3 || draft.start >= draft.end}
              onClick={() => {
                const [sh, sm] = draft.start.split(':').map(Number)
                const [eh, em] = draft.end.split(':').map(Number)
                const capacity = Math.max(1, Math.floor(((eh * 60 + em) - (sh * 60 + sm)) / draft.slotMin))
                setCreated((c) => [
                  ...c,
                  { id: `T-${SESSIONS.length + c.length + 1}`, day: draft.day, start: draft.start, end: draft.end, slotMin: draft.slotMin, clinic: draft.clinic.trim(), capacity, effectiveFrom: effectiveOn },
                ])
                setCreating(false)
                setDraft({ day: TODAY_NAME, start: '14:00', end: '17:00', slotMin: 15, clinic: '' })
                toast({ tone: 'success', title: 'Session created', detail: `${draft.day} ${draft.start}–${draft.end} · ${capacity} slots of ${draft.slotMin} min · from ${effectiveOn}.` })
              }}
            >
              Create session
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Clinic" required htmlFor="new-session-clinic">
            <TextInput id="new-session-clinic" value={draft.clinic} onChange={(e) => setDraft((d) => ({ ...d, clinic: e.target.value }))} placeholder="General medicine, follow-up only" autoFocus />
          </Field>
          <Field label="Day" required htmlFor="new-session-day">
            <Select id="new-session-day" value={draft.day} onChange={(e) => setDraft((d) => ({ ...d, day: e.target.value }))}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Start" required htmlFor="new-session-start">
              <TextInput id="new-session-start" type="time" value={draft.start} onChange={(e) => setDraft((d) => ({ ...d, start: e.target.value }))} />
            </Field>
            <Field label="End" required htmlFor="new-session-end">
              <TextInput id="new-session-end" type="time" value={draft.end} onChange={(e) => setDraft((d) => ({ ...d, end: e.target.value }))} />
            </Field>
            <Field label="Slot" required htmlFor="new-session-slot">
              <Select id="new-session-slot" value={draft.slotMin} onChange={(e) => setDraft((d) => ({ ...d, slotMin: Number(e.target.value) }))}>
                {[10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </Modal>
    </Screen>
  )
}
