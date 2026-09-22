/**
 * S-05-05 · Leave, Block & Override — `/schedule/blocks` · T3 · ARC-05
 *
 * "Leave, blocks and one-off overrides."
 *
 * A scheduler grid: resources down, time across. The thing that makes it
 * clinical rather than administrative is what happens to the patients already
 * booked — blocking a session does not cancel them, it surfaces them, and
 * somebody has to decide where each one goes.
 */

import { useState } from 'react'

import { Diamond } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Card, Chip, Field, Icon, Select, TextArea, cx } from '@/components/primitives'
import { formatDate } from '@/data/format'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

const DAYS = ['Mon 21', 'Tue 22', 'Wed 23', 'Thu 24', 'Fri 25']
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

export function S0505() {
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const [blocks, setBlocks] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<string | null>(null)
  const [reason, setReason] = useState('Annual leave')
  const [note, setNote] = useState('')

  const stateFor = (key: string): CellState => (blocks[key] ? 'blocked' : (BASE[key] ?? 'free'))

  const affected = pending ? (BOOKED[pending] ?? []) : []
  const blockedKeys = Object.keys(blocks)
  const displaced = blockedKeys.flatMap((k) => BOOKED[k] ?? [])

  return (
    <Screen
      screenId="S-05-05"
      loadingShape="board"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'AI-OFF']}
      chips={
        <>
          <Chip tone="neutral">week of {formatDate(new Date(2026, 8, 21))}</Chip>
          {blockedKeys.length > 0 && <Chip tone="abnormal">{blockedKeys.length} blocked</Chip>}
        </>
      }
      wide
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Notice period</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A block inside 14 days needs an administrator&rsquo;s override, because patients are already booked.
              Beyond 14 days it is yours to set.
            </p>
            <p className="mt-2 text-[0.84em] text-ink-3">
              Approved by the medical superintendent for anything shorter.
            </p>
          </Card>

          {displaced.length > 0 && (
            <Card className="border-l-[3px] border-l-abnormal p-4">
              <h3 className="text-[0.82em] font-semibold tracking-wide text-abnormal uppercase">
                {displaced.length} patients displaced
              </h3>
              <ul className="mt-2 space-y-1.5">
                {displaced.map((b) => (
                  <li key={b.token} className="flex items-center justify-between gap-2 text-[0.9em]">
                    <span className="truncate">{b.name}</span>
                    <span className="tabular text-ink-3">{b.token}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[0.86em] text-ink-2">
                Blocking a session does not cancel them. Each one needs rebooking or covering, and the waitlist screen
                picks them up.
              </p>
            </Card>
          )}

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-608 · cover suggestions
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Where a colleague has spare capacity in the same speciality on the same day, it is proposed as cover. It
              suggests; the rota owner decides.
            </p>
          </Card>
        </div>
      }
      railTitle="Impact"
    >
      <div className="space-y-5">
        <Alert tone="info" title="A block surfaces patients rather than cancelling them">
          The grid is the easy part. The consequence is the list of people already booked into the session you are
          blocking — which is why it appears before you confirm, not after.
        </Alert>

        <ScreenSection title="This week" subtitle="Click a clinic session to block it">
          <Card className="overflow-hidden p-4">
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
                              onClick={() => {
                                if (blocks[key]) {
                                  setBlocks((b) => {
                                    const next = { ...b }
                                    delete next[key]
                                    return next
                                  })
                                  return
                                }
                                setPending(key)
                              }}
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

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(['clinic', 'theatre', 'oncall', 'blocked', 'free'] as CellState[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[0.86em]">
                  <span className={cx('block size-3 rounded-[3px]', TONE[s])} />
                  {LABEL[s]}
                </span>
              ))}
            </div>
          </Card>
        </ScreenSection>
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
