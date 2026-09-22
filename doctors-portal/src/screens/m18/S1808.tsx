/**
 * S-18-08 · Event Stamping & Timestamp Reconciliation — `/stroke/case/:id/events` · T2 · ARC-09
 *
 * "When two clocks disagree about the door time."
 *
 * DD-012 is the whole screen: "local times are RECONCILED AGAINST THE SERVER
 * CLOCK, NEVER TRUSTED." And the consequence the atlas states plainly: "a
 * disputed door time is a disputed door-to-needle."
 *
 * Corrections are audited amendments, never overwrites — so the original stays
 * visible next to the resolved value.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert, Button, Card, Chip, Icon, Table, Td, Th, TextArea, Tr, cx } from '@/components/primitives'
import { ConfirmDialog } from '@/components/overlays'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { TIMESTAMP_CONFLICTS, strokeCase } from '@/data/stroke'
import { useCurrentStaff } from '@/store/session'
import { useStroke, minutesBetween } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const AUTHORITY_TONE = { server: 'normal', device: 'brand', local: 'caution' } as const
const AUTHORITY_NOTE = {
  server: 'Authoritative. Recorded by the system, not by a person or a device.',
  device: 'Trusted for its own event. A DICOM header is the modality saying when it fired.',
  local: 'Recorded, never trusted as authoritative. Reconciled against the server.',
} as const

export function S1808({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const caseNow = useCaseClock()
  const stamps = useStroke((s) => s.stamps)

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  const [amending, setAmending] = useState<string | null>(null)
  const [rationale, setRationale] = useState('')

  const doorConflict = TIMESTAMP_CONFLICTS[0]
  const spreadMin = minutesBetween(
    doorConflict.sources.reduce((a, b) => (a.value < b.value ? a : b)).value,
    doorConflict.sources.reduce((a, b) => (a.value > b.value ? a : b)).value,
  )

  return (
    <Screen
      screenId="S-18-08"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF']}
      chips={
        <>
          <Chip tone="neutral" icon="Radio">
            server-authoritative
          </Chip>
          <Chip tone={spreadMin > 0 ? 'caution' : 'normal'}>
            {TIMESTAMP_CONFLICTS.length} events with disagreeing sources
          </Chip>
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
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why it matters</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A five-minute disagreement about the door time moves door-to-needle from 41 to 46 minutes. One of those
              numbers is inside the target and one is not — which is why the reconciliation is a clinical record rather
              than a data-quality exercise.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">The precedence rule</h3>
            <ul className="mt-2 space-y-2">
              {(['server', 'device', 'local'] as const).map((a) => (
                <li key={a}>
                  <Chip tone={AUTHORITY_TONE[a]}>{a}</Chip>
                  <p className="mt-1 text-[0.88em] text-ink-2">{AUTHORITY_NOTE[a]}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      }
      railTitle="Precedence"
    >
      <div className="space-y-5">
        <Alert tone="info" title="Corrections are amendments, never overwrites">
          A resolved value sits next to the sources it was resolved from. Nothing is deleted, and the amendment carries
          the name of whoever made it — the stream only ever grows.
        </Alert>

        {TIMESTAMP_CONFLICTS.map((conflict) => (
          <ScreenSection key={conflict.event} title={conflict.event}>
            <Card className="overflow-hidden">
              <div className="grid gap-0 md:grid-cols-[1fr_auto]">
                {/* Left: the disagreeing sources. */}
                <div>
                  <Table
                    caption={`${conflict.event} sources`}
                    head={
                      <>
                        <Th>Source</Th>
                        <Th>Time</Th>
                        <Th>Authority</Th>
                      </>
                    }
                  >
                    {conflict.sources.map((s) => (
                      <Tr
                        key={s.source}
                        className={cx(s.value.getTime() === conflict.resolved.getTime() && 'bg-normal-soft/50')}
                      >
                        <Td>{s.source}</Td>
                        <Td className="tabular font-semibold">{formatTime(s.value)}</Td>
                        <Td>
                          <Chip tone={AUTHORITY_TONE[s.authority]} title={AUTHORITY_NOTE[s.authority]}>
                            {s.authority}
                          </Chip>
                        </Td>
                      </Tr>
                    ))}
                  </Table>
                </div>

                {/* Right: the resolution. */}
                <div className="border-t border-glass-hairline bg-glass-fill-muted px-5 py-4 md:w-72 md:border-t-0 md:border-l">
                  <p className="text-[0.8em] font-semibold tracking-wide text-ink-3 uppercase">Resolved</p>
                  <p className="tabular mt-1 text-2xl font-bold">{formatTime(conflict.resolved)}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-[0.88em] font-medium text-normal">
                    <Icon name="Check" size={13} />
                    {conflict.resolvedBy}
                  </p>
                  <p className="mt-2.5 text-[0.9em] text-ink-2">{conflict.consequence}</p>
                  <Button
                    size="sm"
                    className="mt-3"
                    icon="PenLine"
                    onClick={() => setAmending(conflict.event)}
                  >
                    Amend with a reason
                  </Button>
                </div>
              </div>
            </Card>
          </ScreenSection>
        ))}

        {/* The append-only stream, including stamps made this session. */}
        <ScreenSection title="Event stream" subtitle="Append-only. Nothing here is ever edited in place.">
          <Card className="overflow-hidden">
            <Table
              caption="Case event stream"
              rowCount={`${stamps.length} stamps this session · server time ${formatTime(caseNow)}`}
              head={
                <>
                  <Th>Event</Th>
                  <Th>Stamped</Th>
                  <Th>By</Th>
                  <Th>State</Th>
                </>
              }
            >
              {stamps.length === 0 ? (
                <Tr>
                  <Td colSpan={4} className="py-6 text-center text-ink-3">
                    Nothing stamped yet in this session. Stamping happens on the case clock, one keystroke each.
                  </Td>
                </Tr>
              ) : (
                stamps.map((s) => (
                  <Tr key={s.key}>
                    <Td className="font-medium">{s.label}</Td>
                    <Td className="tabular">{formatTime(s.at)}</Td>
                    <Td>{s.by}</Td>
                    <Td>
                      <Chip tone={s.pending ? 'caution' : 'normal'} icon={s.pending ? 'Clock' : 'Check'}>
                        {s.pending ? 'pending sync' : 'committed'}
                      </Chip>
                    </Td>
                  </Tr>
                ))
              )}
            </Table>
          </Card>
        </ScreenSection>
      </div>

      <ConfirmDialog
        open={amending !== null}
        title={`Amend the ${amending?.toLowerCase()}?`}
        consequence="The original sources and the current resolution both stay visible. Your amendment is appended with your name and the time, and every interval that depends on this timestamp is recomputed and shown as recomputed."
        confirmLabel="Append the amendment"
        onConfirm={() => {
          if (rationale.trim().length < 10) return
          toast({
            tone: 'info',
            title: 'Amendment appended',
            detail: `${me.name} · ${formatTime(caseNow)}. Dependent intervals recomputed.`,
          })
          setAmending(null)
          setRationale('')
        }}
        onCancel={() => {
          setAmending(null)
          setRationale('')
        }}
      >
        <TextArea
          rows={3}
          autoFocus
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="Why the resolved time is wrong, and what evidence supports the change — at least ten characters…"
        />
      </ConfirmDialog>
    </Screen>
  )
}
