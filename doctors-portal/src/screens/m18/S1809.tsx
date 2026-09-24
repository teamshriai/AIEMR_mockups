/**
 * S-18-09 · Team Paging & Acknowledgement — `/stroke/case/:id/team` · T2 · ARC-01
 *
 * "Who was paged, and who actually answered."
 *
 * The distinction in the title is the whole screen. A paging system that
 * reports "team notified" when nobody picked up is worse than one that reports
 * nothing, because it stops anyone chasing.
 *
 * Calm pass: the unanswered page is the default slice; the answered ones are
 * one tap away. The six-column table is a calm worklist. The ladder and the
 * per-case figures fold behind one Why.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { ScopeTabs, Why, useScope } from '@/components/calm'
import { Alert, Button, Chip, Icon, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { PAGING_LOG, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { minutesBetween, useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const ESCALATION = [
  { step: 1, channel: 'Push notification', wait: '0 min' },
  { step: 2, channel: 'Automated call to the registered mobile', wait: '2 min' },
  { step: 3, channel: 'Call to the second contact on the rota', wait: '4 min' },
  { step: 4, channel: 'Switchboard pages the next person in the speciality', wait: '6 min' },
  { step: 5, channel: 'On-call consultant for the division is paged', wait: '10 min' },
]

type Page = (typeof PAGING_LOG)[number]
type Scope = 'unanswered' | 'answered'
const SCOPES: readonly Scope[] = ['unanswered', 'answered']

/**
 * An action inside a calm worklist row. The row is already a button, so this
 * is a span with the button role — nested buttons are invalid markup.
 */
function RowAction({
  icon,
  tone = 'secondary',
  onClick,
  children,
}: {
  icon: string
  tone?: 'primary' | 'secondary' | 'destructive'
  onClick: () => void
  children: ReactNode
}) {
  const fire = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onClick()
  }
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={fire}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') fire(e)
      }}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3.5 text-[0.88em] font-semibold transition-colors',
        tone === 'primary'
          ? 'bg-brand text-brand-on hover:bg-brand-dark'
          : tone === 'destructive'
            ? 'bg-critical text-critical-on hover:brightness-110'
            : 'bg-glass-fill-strong text-ink hover:bg-glass-fill-hover',
      )}
    >
      <Icon name={icon} size={14} />
      {children}
    </span>
  )
}

export function S1809({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const running = useStroke((s) => s.running)
  const [scope, setScope] = useScope(SCOPES, 'unanswered')

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const [repaged, setRepaged] = useState<string[]>([])

  const acked = PAGING_LOG.filter((x) => x.ackAt)
  const unanswered = PAGING_LOG.filter((x) => !x.ackAt)
  const medianAck =
    acked.length > 0
      ? Math.round(acked.reduce((s, x) => s + minutesBetween(x.pagedAt, x.ackAt!), 0) / acked.length)
      : 0

  const rows = scope === 'unanswered' ? unanswered : acked

  const escalate = (x: Page) => {
    setRepaged((r) => [...r, x.role])
    toast({
      tone: 'caution',
      title: `${x.role} re-paged`,
      detail: 'Escalated to step 3 — the second contact on the rota is being called.',
    })
  }

  const columns: WorklistColumn<Page>[] = [
    { key: 'paged', label: 'Paged', role: 'lead', cell: (x) => formatTime(x.pagedAt) },
    {
      key: 'who',
      label: 'Role',
      role: 'primary',
      cell: (x) => (
        <>
          {x.role} <span className="font-normal text-ink-3">· {x.name}</span>
        </>
      ),
    },
    { key: 'channel', label: 'Channel', role: 'context', cell: (x) => x.channel },
    {
      key: 'waited',
      label: 'Waited',
      role: 'context',
      cell: (x) =>
        x.ackAt ? (
          <span className="tabular">answered in {minutesBetween(x.pagedAt, x.ackAt)} min</span>
        ) : (
          <span className="tabular font-medium text-abnormal">{minutesBetween(x.pagedAt, caseNow)} min, no answer</span>
        ),
    },
    {
      key: 'status',
      label: 'Answered',
      role: 'status',
      cell: (x) =>
        x.ackAt ? (
          <Chip tone="normal" icon="Check">
            answered {formatTime(x.ackAt)}
          </Chip>
        ) : repaged.includes(x.role) ? (
          <Chip tone="caution" icon="PhoneCall">
            escalated
          </Chip>
        ) : (
          <RowAction icon="PhoneCall" tone="destructive" onClick={() => escalate(x)}>
            Escalate
          </RowAction>
        ),
    },
  ]

  return (
    <Screen
      screenId="S-18-09"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF']}
      heading="Team"
      subheading={
        <>
          {acked.length} of {PAGING_LOG.length} answered · {unanswered.length} no answer · median {medianAck} min
        </>
      }
      actions={
        <Button icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
          Case clock
        </Button>
      }
    >
      <div className="space-y-5">
        {/* The operative alert: it exists only while someone has not answered. */}
        {unanswered.length > 0 && (
          <Alert tone="abnormal" role="alert" title={`${unanswered[0].role} has not answered`}>
            {unanswered[0].name} was paged at {formatTime(unanswered[0].pagedAt)} on{' '}
            {unanswered[0].channel.toLowerCase()} — the ladder escalates on its own, or you can push it now.
          </Alert>
        )}

        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(x) => x.role}
          caption="Team paging log"
          noun="pages"
          emptyWhy={
            scope === 'unanswered'
              ? 'Everyone paged for this case has answered.'
              : 'Nobody has answered yet. The ladder is running.'
          }
          filters={
            <ScopeTabs
              value={scope}
              onChange={setScope}
              options={[
                { key: 'unanswered', label: 'Unanswered', icon: 'TriangleAlert', count: unanswered.length },
                { key: 'answered', label: 'Answered', icon: 'Check', count: acked.length },
              ]}
            />
          }
        />

        <Why label="How the ladder escalates, and how these times are stamped">
          <ol className="space-y-1.5">
            {ESCALATION.map((e) => (
              <li key={e.step} className="flex gap-2.5">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-glass-fill-muted text-[0.8em] font-semibold">
                  {e.step}
                </span>
                <span className="min-w-0 flex-1 text-ink-2">
                  {e.channel} <span className="tabular text-ink-3">· at {e.wait}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="text-ink-2">
            The ladder runs automatically. Nobody has to notice that nobody answered. On this case {PAGING_LOG.length}{' '}
            were paged, {acked.length} answered, median {medianAck} min.
          </p>
          {aiActive && (
            <p className="text-ink-2">
              AI-623 picks who to page from the live rota rather than a static list, so a swapped shift does not page
              someone asleep at home. It suggests; the coordinator can always page anyone.
            </p>
          )}
          <p className="text-ink-3">
            The clock is {running ? 'running' : 'paused'} at {formatTime(caseNow)}. Paging times are stamped from the
            server, so an acknowledgement cannot be back-dated from a phone.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
