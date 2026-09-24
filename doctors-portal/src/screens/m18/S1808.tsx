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
 *
 * Calm pass: the unresolved slice opens by default — tonight it is empty and
 * says so in one sentence; the resolved conflicts are one tap away with their
 * three-source tables intact. The precedence rule and the rationale fold.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Button, Chip, Icon, Table, Td, Th, TextArea, Tr, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { TIMESTAMP_CONFLICTS, strokeCase } from '@/data/stroke'
import { useCurrentStaff } from '@/store/session'
import { useStroke, minutesBetween } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const AUTHORITY_TONE = { server: 'normal', device: 'brand', local: 'caution' } as const
const AUTHORITY_NOTE = {
  server: 'Authoritative. Recorded by the system, not by a person or a device.',
  device: 'Trusted for its own event. A DICOM header is the modality saying when it fired.',
  local: 'Recorded, never trusted as authoritative. Reconciled against the server.',
} as const

type Scope = 'unresolved' | 'resolved'
const SCOPES: readonly Scope[] = ['unresolved', 'resolved']

type Conflict = (typeof TIMESTAMP_CONFLICTS)[number]

export function S1808({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const caseNow = useCaseClock()
  const stamps = useStroke((s) => s.stamps)
  const [scope, setScope] = useScope(SCOPES, 'unresolved')

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  const [amending, setAmending] = useState<string | null>(null)
  const [rationale, setRationale] = useState('')

  /** A conflict is resolved once a server-reconciled value has been chosen. */
  const isResolved = (x: Conflict) => Boolean(x.resolved)
  const resolved = TIMESTAMP_CONFLICTS.filter(isResolved)
  const unresolved = TIMESTAMP_CONFLICTS.filter((x) => !isResolved(x))
  const shown = scope === 'unresolved' ? unresolved : resolved

  const spread = (x: Conflict) =>
    minutesBetween(
      x.sources.reduce((a, b) => (a.value < b.value ? a : b)).value,
      x.sources.reduce((a, b) => (a.value > b.value ? a : b)).value,
    )

  return (
    <Screen
      screenId="S-18-08"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF']}
      heading="Timestamps"
      subheading={
        <>
          {unresolved.length} unresolved · {resolved.length} resolved · {stamps.length} stamped this session
        </>
      }
      actions={
        <Button icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
          Case clock
        </Button>
      }
    >
      <div className="space-y-5">
        <ScopeTabs
          value={scope}
          onChange={setScope}
          options={[
            { key: 'unresolved', label: 'Unresolved', icon: 'TriangleAlert', count: unresolved.length },
            { key: 'resolved', label: 'Resolved', icon: 'Check', count: resolved.length },
          ]}
        />

        {shown.length === 0 && (
          <SectionCard title={scope === 'unresolved' ? 'Unresolved' : 'Resolved'} bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className="flex items-center gap-2 text-[0.95em] text-ink-2">
              <Icon name="Check" size={15} className="text-normal" />
              {scope === 'unresolved'
                ? 'Both door-time conflicts are resolved.'
                : 'No conflict has been resolved on this case yet.'}
            </p>
          </SectionCard>
        )}

        {shown.map((conflict) => (
          <SectionCard
            key={conflict.event}
            title={conflict.event}
            meta={
              <span className="tabular text-[0.88em] text-ink-3">
                {conflict.sources.length} sources · {spread(conflict)} min apart
              </span>
            }
            action={
              <Button size="sm" icon="PenLine" onClick={() => setAmending(conflict.event)}>
                Amend with a reason
              </Button>
            }
          >
            <div className="grid gap-0 md:grid-cols-[1fr_auto]">
              {/* The disagreeing sources. */}
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

              {/* The resolution, beside the sources it came from. */}
              <div className="rounded-panel bg-glass-fill-muted px-4 py-3 md:w-64">
                <p className="text-[0.78em] font-bold tracking-[0.08em] text-ink-3 uppercase">Resolved</p>
                <p className="tabular mt-1 text-2xl font-bold">{formatTime(conflict.resolved)}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[0.88em] font-medium text-normal">
                  <Icon name="Check" size={13} />
                  {conflict.resolvedBy}
                </p>
                <p className="mt-2 text-[0.88em] text-ink-2">{conflict.consequence}</p>
              </div>
            </div>
          </SectionCard>
        ))}

        {/* The append-only stream, including stamps made this session. */}
        <SectionCard title="Event stream" meta={<span className="text-[0.88em] text-ink-3">append-only</span>}>
          {stamps.length === 0 ? (
            <p className="px-3 py-3 text-[0.95em] text-ink-2">
              Nothing stamped yet in this session. Stamping happens on the case clock, one keystroke each.
            </p>
          ) : (
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
              {stamps.map((s) => (
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
              ))}
            </Table>
          )}
        </SectionCard>

        <Why label="Which source wins, and why it matters">
          <ul className="space-y-2">
            {(['server', 'device', 'local'] as const).map((a) => (
              <li key={a} className="flex items-start gap-2">
                <Chip tone={AUTHORITY_TONE[a]}>{a}</Chip>
                <span className="text-ink-2">{AUTHORITY_NOTE[a]}</span>
              </li>
            ))}
          </ul>
          <p className="text-ink-2">
            A five-minute disagreement about the door time moves door-to-needle from 41 to 46 minutes. One of those
            numbers is inside the target and one is not — which is why the reconciliation is a clinical record rather
            than a data-quality exercise.
          </p>
          <p className="text-ink-3">
            Corrections are amendments, never overwrites. A resolved value sits next to the sources it was resolved
            from; nothing is deleted, and the amendment carries the name of whoever made it.
          </p>
        </Why>
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
