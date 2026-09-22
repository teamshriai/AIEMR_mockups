/**
 * S-05-04 · Clinician Session Template Setup — `/schedule/templates` · T3 · ARC-18
 *
 * "A clinician's recurring session pattern."
 *
 * Effective-dated master data (ARC-18): changing a template does not rewrite
 * the appointments already booked against the old one. AI-608 suggests capacity
 * changes at G1 — it notices that a session consistently overruns, and manual
 * template editing remains the fallback.
 */

import { useState } from 'react'

import { SuggestionCard } from '@/components/ai'
import { Alert, Button, Card, Chip, Field, Icon, Select, Table, Td, Th, TextInput, Tr } from '@/components/primitives'
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

export function S0504() {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const [effectiveOn, setEffectiveOn] = useState('2026-09-21')
  const [editing, setEditing] = useState<Session | null>(null)
  const [slotMin, setSlotMin] = useState(10)

  return (
    <Screen
      screenId="S-05-04"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      chips={<Chip tone="neutral">{SESSIONS.length} weekly sessions</Chip>}
      actions={
        <>
          <TextInput
            type="date"
            value={effectiveOn}
            onChange={(e) => setEffectiveOn(e.target.value)}
            className="min-h-9 w-auto py-1.5 text-[0.9em]"
            aria-label="Effective on"
          />
          <Button tone="primary" icon="Plus">
            New session
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          {SESSIONS.filter((s) => s.observation).map((s) => (
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
    >
      <div className="space-y-5">
        <Alert tone="info" title="Effective-dated, so a change is never retrospective">
          Editing a template creates a new version effective from a date you choose. Appointments already booked keep
          the template they were booked against — a patient does not lose their slot because the pattern changed.
        </Alert>

        <Card className="overflow-hidden">
          <Table
            caption="Weekly session pattern"
            rowCount={`${SESSIONS.length} sessions · effective on ${effectiveOn} · ${me.name}`}
            head={
              <>
                <Th>Day</Th>
                <Th>Time</Th>
                <Th>Clinic</Th>
                <Th>Slot</Th>
                <Th>Capacity</Th>
                <Th className="hidden md:table-cell">Effective from</Th>
                <Th className="text-right">Edit</Th>
              </>
            }
          >
            {SESSIONS.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium">{s.day}</Td>
                <Td className="tabular">
                  {s.start}–{s.end}
                </Td>
                <Td>{s.clinic}</Td>
                <Td className="tabular">{s.slotMin} min</Td>
                <Td className="tabular">
                  {s.capacity}
                  {s.observation && (
                    <Chip tone="caution" className="ml-2" icon="TriangleAlert">
                      review
                    </Chip>
                  )}
                </Td>
                <Td className="tabular hidden md:table-cell">{s.effectiveFrom}</Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    icon="Pencil"
                    onClick={() => {
                      setEditing(s)
                      setSlotMin(s.slotMin)
                    }}
                  >
                    Edit
                  </Button>
                </Td>
              </Tr>
            ))}
          </Table>
        </Card>

        {editing && (
          <Card className="p-5">
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
            <p className="mt-3 flex items-start gap-1.5 text-[0.86em] text-ink-3">
              <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
              Shortening a slot raises capacity but not throughput. If the mean consultation is 11 minutes, ten-minute
              slots guarantee the session runs late.
            </p>
          </Card>
        )}
      </div>
    </Screen>
  )
}
