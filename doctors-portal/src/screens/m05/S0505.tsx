/**
 * S-05-05 · Leave, Block & Override — `/schedule/blocks` · T3 · ARC-05
 *
 * "Leave, blocks and one-off overrides."
 *
 * A scheduler grid: resources down, time across. The thing that makes it
 * clinical rather than administrative is what happens to the patients already
 * booked — blocking a session does not cancel them, it surfaces them, and
 * somebody has to decide where each one goes.
 *
 * Calm pass: the surface opens on today's seven slots as a list; the week grid
 * is one tap away. The displaced-patient list is shown exactly once — inside
 * the confirmation, before the block is made — and the notice-period rule and
 * the legend are folded behind `Why`.
 */

import { useState } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { ScopeTabs, Why, useScope } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Card, Chip, Field, Icon, Select, TextArea, cx } from '@/components/primitives'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const DAYS = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24', 'Fri 25']
/** NOW is Mon 21-Sep-2026. */
const TODAY = DAYS[0]
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00']

type CellState = 'clinic' | 'free' | 'blocked' | 'theatre' | 'oncall'

/** The base week. Blocks are layered over it. */
const BASE: Record<string, CellState> = {
  'Mon 21|08:00': 'clinic',
  'Mon 21|09:00': 'clinic',
  'Mon 21|10:00': 'clinic',
  'Mon 21|11:00': 'clinic',
  'Tue 22|14:00': 'clinic',
  'Tue 22|15:00': 'clinic',
  'Tue 22|16:00': 'clinic',
  'Wed 23|08:00': 'theatre',
  'Wed 23|09:00': 'theatre',
  'Wed 23|10:00': 'theatre',
  'Thu 24|08:00': 'clinic',
  'Thu 24|09:00': 'clinic',
  'Thu 24|10:00': 'clinic',
  'Fri 25|09:00': 'clinic',
  'Fri 25|10:00': 'clinic',
  'Fri 25|11:00': 'clinic',
  'Fri 25|16:00': 'oncall',
}

const TONE: Record<CellState, string> = {
  clinic: 'bg-brand-soft text-brand',
  free: 'bg-glass-fill-muted text-ink-3',
  blocked: 'bg-abnormal-soft text-abnormal',
  theatre: 'bg-isolation-soft text-isolation',
  oncall: 'bg-caution-soft text-caution',
}

const LABEL: Record<CellState, string> = {
  clinic: 'Clinic',
  free: '—',
  blocked: 'Blocked',
  theatre: 'Theatre',
  oncall: 'On call',
}

/** The list's state chip — icon and word, never colour alone. */
const CHIP: Record<CellState, { tone: 'brand' | 'inactive' | 'abnormal' | 'isolation' | 'caution'; icon: string; label: string }> = {
  clinic: { tone: 'brand', icon: 'Stethoscope', label: 'OPD' },
  free: { tone: 'inactive', icon: 'CircleDot', label: 'Free' },
  blocked: { tone: 'abnormal', icon: 'Ban', label: 'Blocked' },
  theatre: { tone: 'isolation', icon: 'Syringe', label: 'Theatre' },
  oncall: { tone: 'caution', icon: 'Phone', label: 'On call' },
}

/** Patients booked into a session, surfaced when it is blocked. */
const BOOKED: Record<string, { name: string; token: string }[]> = {
  'Thu 24|08:00': [
    { name: 'Meera Krishnan', token: 'MED-061' },
    { name: 'Fatima Bi', token: 'MED-062' },
  ],
  'Thu 24|09:00': [
    { name: 'Arjun Nair', token: 'MED-064' },
    { name: 'Kavya Reddy', token: 'MED-065' },
    { name: 'Abdul Rahman Sheikh', token: 'MED-066' },
  ],
  'Thu 24|10:00': [{ name: 'Joseph Mathew', token: 'MED-070' }],
}

type Scope = 'today' | 'week'
const SCOPES: readonly Scope[] = ['today', 'week']

interface SlotRow {
  key: string
  slot: string
}

export function S0505() {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const [blocks, setBlocks] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [reason, setReason] = useState('Annual leave')
  const [note, setNote] = useState('')
  const [scope, setScope] = useScope(SCOPES, 'today')

  const stateFor = (key: string): CellState => (blocks[key] ? 'blocked' : (BASE[key] ?? 'free'))

  const affected = pending ? (BOOKED[pending] ?? []) : []
  const blockedKeys = Object.keys(blocks)

  /** Clicking a session: unblock if blocked, otherwise ask before blocking. */
  function toggle(key: string) {
    const st = stateFor(key)
    if (st === 'free') return
    if (blocks[key]) {
      setBlocks((b) => {
        const next = { ...b }
        delete next[key]
        return next
      })
      return
    }
    setPending(key)
  }

  const todayRows: SlotRow[] = SLOTS.map((slot) => ({ key: `${TODAY}|${slot}`, slot }))
  const todaySessions = todayRows.filter((r) => BASE[r.key] && BASE[r.key] !== 'free').length
  const todayBlocked = todayRows.filter((r) => blocks[r.key]).length

  const columns: WorklistColumn<SlotRow>[] = [
    { key: 'time', label: 'Time', role: 'lead', cell: (r) => r.slot },
    {
      key: 'what',
      label: 'Session',
      role: 'primary',
      cell: (r) => {
        const base = BASE[r.key] ?? 'free'
        return base === 'free' ? 'Nothing scheduled' : base === 'clinic' ? 'Clinic session' : base === 'theatre' ? 'Theatre list' : 'On call'
      },
    },
    {
      key: 'booked',
      label: 'Booked',
      role: 'context',
      cell: (r) => {
        const n = (BOOKED[r.key] ?? []).length
        return n > 0 ? <span className="tabular">{n} booked</span> : null
      },
    },
    {
      key: 'reason',
      label: 'Reason',
      role: 'context',
      cell: (r) => (blocks[r.key] ? blocks[r.key] : null),
    },
    {
      key: 'state',
      label: 'State',
      role: 'status',
      cell: (r) => {
        const st = stateFor(r.key)
        const c = CHIP[st]
        return (
          <Chip tone={c.tone} icon={c.icon}>
            {c.label}
          </Chip>
        )
      },
    },
    {
      key: 'block',
      label: '',
      role: 'status',
      cell: (r) => {
        const st = stateFor(r.key)
        if (st === 'free') return null
        return (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              toggle(r.key)
            }}
            className={cx(
              'inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-[0.86em] font-semibold',
              st === 'blocked'
                ? 'bg-glass-inset text-ink-2 hover:bg-glass-fill-hover'
                : 'bg-brand-soft text-brand hover:bg-brand hover:text-brand-on',
            )}
          >
            {st === 'blocked' ? 'Unblock' : 'Block'}
          </span>
        )
      },
    },
  ]

  return (
    <Screen
      screenId="S-05-05"
      loadingShape={scope === 'week' ? 'board' : 'list'}
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'AI-OFF']}
      heading="Blocks and leave"
      subheading={
        <>
          {todaySessions} sessions today
          {todayBlocked > 0 && ` · ${todayBlocked} blocked today`}
          {blockedKeys.length > 0 && ` · ${blockedKeys.length} blocked this week`}
        </>
      }
      wide={scope === 'week'}
      rail={
        <Card strong className="p-4">
          <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
            <Diamond size={10} />
            AI-608 · cover suggestions
          </p>
          <p className="mt-1.5 text-[0.9em] text-ink-2">
            Where a colleague has spare capacity in the same speciality on the same day, it is proposed as cover. It
            suggests; the rota owner decides.
          </p>
        </Card>
      }
      railTitle="Cover"
    >
      <div className={cx('space-y-5', scope === 'today' && 'max-w-4xl')}>
        {scope === 'today' ? (
          <Worklist
            rows={todayRows}
            columns={columns}
            rowKey={(r) => r.key}
            onOpen={(r) => toggle(r.key)}
            caption={`${TODAY} — this clinician's slots`}
            noun="slots"
            emptyWhy="No slots are templated for today."
            filters={
              <ScopeTabs
                value={scope}
                onChange={setScope}
                options={[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This week' },
                ]}
              />
            }
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ScopeTabs
                value={scope}
                onChange={setScope}
                options={[
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This week' },
                ]}
              />
              <span className="text-[0.88em] text-ink-3">Click a session to block it</span>
            </div>
            <Card strong className="overflow-hidden p-4">
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="w-16" />
                      {DAYS.map((d) => (
                        <th key={d} className="pb-1 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SLOTS.map((slot) => (
                      <tr key={slot}>
                        <th className="tabular pr-2 text-right text-[0.84em] font-medium text-ink-3">{slot}</th>
                        {DAYS.map((day) => {
                          const key = `${day}|${slot}`
                          const st = stateFor(key)
                          const bookedCount = (BOOKED[key] ?? []).length
                          return (
                            <td key={key}>
                              <button
                                type="button"
                                disabled={st === 'free'}
                                onClick={() => toggle(key)}
                                className={cx(
                                  'min-h-14 w-full min-w-24 rounded-field px-2 py-1.5 text-left transition-colors',
                                  TONE[st],
                                  st !== 'free' && 'hover:brightness-95',
                                  st === 'free' && 'cursor-default',
                                )}
                              >
                                <span className="block text-[0.84em] font-semibold">{LABEL[st]}</span>
                                {bookedCount > 0 && st !== 'blocked' && (
                                  <span className="tabular block text-[0.78em] opacity-80">{bookedCount} booked</span>
                                )}
                                {st === 'blocked' && (
                                  <span className="block truncate text-[0.78em] opacity-80">{blocks[key]}</span>
                                )}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Why label="Legend" className="mt-3">
                <div className="flex flex-wrap items-center gap-3">
                  {(['clinic', 'theatre', 'oncall', 'blocked', 'free'] as CellState[]).map((s) => (
                    <span key={s} className="flex items-center gap-1.5 text-[0.9em]">
                      <span className={cx('block size-3 rounded-[3px]', TONE[s])} />
                      {s === 'free' ? 'Free' : LABEL[s]}
                    </span>
                  ))}
                </div>
              </Why>
            </Card>
          </>
        )}

        <Why label="Why a block surfaces patients, and who may set one">
          <p className="text-ink-2">
            Blocking a session does not cancel the patients already booked into it. They are listed before you confirm,
            not after, and each one moves to the waitlist for rebooking or cover — they are told the appointment has
            moved, not why.
          </p>
          <p className="text-ink-2">
            A block inside 14 days needs an administrator&rsquo;s override, because patients are already booked. Beyond
            14 days it is yours to set.
          </p>
          <p className="text-ink-3">Approved by the medical superintendent for anything shorter.</p>
        </Why>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={`Block ${pending?.replace('|', ' at ')}?`}
        consequence={
          affected.length > 0
            ? `${affected.length} patient${affected.length === 1 ? ' is' : 's are'} already booked into this session. Blocking it does not cancel them — they move to the waitlist for rebooking, and they are told the appointment has moved, not why.`
            : 'No patients are booked into this session, so blocking it has no downstream effect.'
        }
        confirmLabel="Block this session"
        tone={affected.length > 0 ? 'destructive' : 'primary'}
        onConfirm={() => {
          if (!pending) return
          setBlocks((b) => ({ ...b, [pending]: reason }))
          toast({
            tone: affected.length > 0 ? 'caution' : 'info',
            title: 'Session blocked',
            detail:
              affected.length > 0
                ? `${affected.length} patients moved to the waitlist. ${me.name} · ${reason}.`
                : `${reason}.`,
          })
          setPending(null)
          setNote('')
        }}
        onCancel={() => {
          setPending(null)
          setNote('')
        }}
      >
        <div className="space-y-3">
          <Field label="Reason" required htmlFor="block-reason">
            <Select id="block-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
              {['Annual leave', 'Study leave', 'Conference', 'Theatre list', 'Administrative', 'Sick leave'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the rota owner should know…" />
          {affected.length > 0 && (
            <div className="rounded-panel bg-abnormal-soft px-3 py-2.5">
              <p className="flex items-center gap-2 text-[0.88em] font-semibold text-abnormal">
                <Icon name="Users" size={14} />
                Already booked
              </p>
              <ul className="mt-1.5 space-y-1">
                {affected.map((b) => (
                  <li key={b.token} className="tabular flex items-center justify-between gap-2 text-[0.9em]">
                    <span>{b.name}</span>
                    <span className="text-ink-3">{b.token}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ConfirmDialog>
    </Screen>
  )
}
