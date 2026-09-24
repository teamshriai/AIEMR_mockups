/**
 * S-18-20 · Stroke Outcomes, mRS-90 & Registry — `/stroke/registry` · T2 · ARC-19
 *
 * "Ninety days later, still chasing the call the award depends on."
 *
 * The one-liner is the honest version of an outcomes screen: the clinical work
 * finished three months ago, and what is left is a phone call somebody has to
 * make. AI-708 prioritises the outreach; the fallback is a scheduled call list,
 * which is what most registries actually run on.
 *
 * Calm pass: the default slice is the calls due now. The seven-column table is
 * a calm worklist whose status column is the chip and the call button. The
 * hard 90-day deadline is stated once, on the alert; the class-3 audit rule is
 * stated once, behind Why.
 */

import { useState } from 'react'
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { IndicatorBars } from '@/components/charts'
import { Alert, Button, Chip, Icon, Select, cx } from '@/components/primitives'
import { OUTCOMES, REGISTRY_INDICATORS } from '@/data/stroke'
import type { OutcomeRow } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const MRS_LABEL: Record<number, string> = {
  0: 'No symptoms',
  1: 'No significant disability',
  2: 'Slight disability, independent',
  3: 'Moderate, walks unaided',
  4: 'Moderately severe, needs help',
  5: 'Severe, bedridden',
  6: 'Died',
}

type Scope = 'due' | 'open' | 'complete'
const SCOPES: readonly Scope[] = ['due', 'open', 'complete']

/** An action inside a calm worklist row — a span, because the row is already a button. */
function RowAction({
  icon,
  onClick,
  children,
}: {
  icon: string
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
      className="inline-flex min-h-11 items-center gap-1.5 rounded-pill bg-brand px-3.5 text-[0.88em] font-semibold text-brand-on transition-colors hover:bg-brand-dark"
    >
      <Icon name={icon} size={14} />
      {children}
    </span>
  )
}

export function S1820() {
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const [period, setPeriod] = useState('Last 90 days')
  const [called, setCalled] = useState<string[]>([])
  const [scope, setScope] = useScope(SCOPES, 'due')

  const isDone = (o: OutcomeRow) => o.mrs90 !== null || called.includes(o.caseNo)

  /** The three slices of the follow-up field. Calls due is the one acted on now. */
  const due = OUTCOMES.filter(
    (o) => !isDone(o) && (o.followUpStatus === 'Call due' || o.followUpStatus === 'Unreachable — 3 attempts'),
  )
  const open = OUTCOMES.filter((o) => !isDone(o) && o.followUpStatus === 'Window open')
  const complete = OUTCOMES.filter(isDone)
  const completeness = Math.round((complete.length / OUTCOMES.length) * 100)

  const rows = scope === 'due' ? due : scope === 'open' ? open : complete

  const indicators = REGISTRY_INDICATORS.map((i) => {
    /** Fraction of the target, capped for the bar. */
    const numeric = parseFloat(i.value)
    const targetNumeric = parseFloat(i.target.replace(/[^\d.]/g, ''))
    const lowerIsBetter = i.target.startsWith('≤')
    const fraction = lowerIsBetter
      ? Math.min(1.4, numeric / targetNumeric)
      : Math.min(1.4, numeric / targetNumeric)
    return { label: i.label, value: i.value, target: i.target, met: i.met, fraction: Math.min(1, fraction) }
  })

  const call = (o: OutcomeRow) => {
    setCalled((c) => [...c, o.caseNo])
    toast({
      tone: 'success',
      title: `${o.patientInitials} reached`,
      detail: 'mRS recorded. Completeness has moved.',
    })
  }

  const columns: WorklistColumn<OutcomeRow>[] = [
    {
      key: 'case',
      label: 'Case',
      role: 'lead',
      cell: (o) => <span title={o.caseNo}>{o.caseNo.split('/').pop()}</span>,
    },
    {
      key: 'site',
      label: 'Site',
      role: 'primary',
      cell: (o) => (
        <>
          {o.site} · {o.treatedWith}
          <span className="font-normal text-ink-3"> · {o.patientInitials}</span>
        </>
      ),
    },
    {
      key: 'dtn',
      label: 'DTN',
      role: 'context',
      cell: (o) => (o.dtnMin === null ? null : <span className="tabular">DTN {o.dtnMin} min</span>),
    },
    {
      key: 'ditg',
      label: 'Door to groin',
      role: 'context',
      cell: (o) => (o.ditgMin === null ? null : <span className="tabular">door-to-groin {o.ditgMin} min</span>),
    },
    {
      key: 'mrs',
      label: 'mRS at 90 days',
      role: 'context',
      cell: (o) =>
        o.mrs90 !== null ? (
          <span className="tabular">
            mRS {o.mrs90} · {MRS_LABEL[o.mrs90]}
          </span>
        ) : called.includes(o.caseNo) ? (
          'mRS collected'
        ) : (
          'mRS not yet recorded'
        ),
    },
    {
      key: 'reason',
      label: 'Why now',
      role: 'context',
      cell: (o) => (aiActive && !isDone(o) && o.outreachReason ? o.outreachReason : null),
    },
    {
      key: 'status',
      label: 'Follow-up',
      role: 'status',
      cell: (o) =>
        isDone(o) ? (
          <Chip tone="normal" icon="Check">
            Complete
          </Chip>
        ) : o.followUpStatus === 'Window open' ? (
          <Chip tone="neutral" icon="Clock">
            Window open
          </Chip>
        ) : (
          <Chip
            tone={o.followUpStatus.startsWith('Unreachable') ? 'abnormal' : 'caution'}
            icon={o.followUpStatus.startsWith('Unreachable') ? 'TriangleAlert' : 'PhoneCall'}
          >
            {o.followUpStatus}
          </Chip>
        ),
    },
    {
      key: 'action',
      label: '',
      role: 'status',
      cell: (o) =>
        isDone(o) || o.followUpStatus === 'Window open' ? null : (
          <RowAction icon="PhoneCall" onClick={() => call(o)}>
            Call now
          </RowAction>
        ),
    },
  ]

  return (
    <Screen
      screenId="S-18-20"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      heading="Stroke registry"
      subheading={
        <>
          {completeness}% follow-up complete against a 90% target · {due.length} call
          {due.length === 1 ? '' : 's'} due
        </>
      }
      actions={
        <>
          <Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Reporting period"
            className="min-h-9 w-auto py-1.5 text-[0.9em]"
          >
            {['Last 30 days', 'Last 90 days', 'This financial year'].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
          <Button
            icon="Download"
            onClick={() =>
              toast({
                tone: 'info',
                title: 'Registry export prepared',
                detail: 'The recipient and the fields are recorded.',
              })
            }
          >
            Export
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Completeness" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className={cx('tabular text-4xl font-bold', completeness >= 90 ? 'text-normal' : 'text-caution')}>
              {completeness}%
            </p>
            <p className="text-[0.9em] text-ink-3">target 90%</p>
            <p className="mt-2.5 text-[0.88em] text-ink-2">
              Incomplete follow-up is the single commonest reason a stroke centre loses its accreditation, and it has
              nothing to do with the quality of the care.
            </p>
          </SectionCard>

          {aiActive && (
            <Why label="How the call list is ordered">
              <p className="text-ink-2">
                AI-708 orders the call list by how close each case is to the end of its 90-day window, and suggests
                which contact to try. The fallback is a scheduled call list in date order.
              </p>
            </Why>
          )}
        </div>
      }
      railTitle="Registry"
    >
      <div className="space-y-5">
        {/* The one statement of the hard deadline. */}
        {due.length > 0 && (
          <Alert tone="caution" title={`${due.length} follow-up call${due.length === 1 ? '' : 's'} outstanding`}>
            {due[0].outreachReason} Once the 90-day window closes the outcome cannot be recorded at all, and the case
            counts against completeness for good.
          </Alert>
        )}

        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(o) => o.caseNo}
          caption="Stroke cases and their 90-day outcomes"
          noun="cases"
          emptyWhy={
            scope === 'due'
              ? 'No case is waiting on a call right now. The ones whose window is still open are one tap away.'
              : scope === 'open'
                ? 'Every case in this period is either called or due — none is still inside its window.'
                : 'No outcome has been recorded in this period yet.'
          }
          filters={
            <ScopeTabs
              value={scope}
              onChange={setScope}
              options={[
                { key: 'due', label: 'Calls due', icon: 'PhoneCall', count: due.length },
                { key: 'open', label: 'Window open', icon: 'Clock', count: open.length },
                { key: 'complete', label: 'Done', icon: 'Check', count: complete.length },
              ]}
            />
          }
        />

        <SectionCard
          title="Indicators"
          meta={<span className="text-[0.88em] text-ink-3">against target, one measure per bar</span>}
          bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
        >
          <IndicatorBars rows={indicators} />
          <Why label="Which two are missed, and what gets exported" className="mt-3">
            <p className="text-ink-2">
              Two are missed: DIDO at the spokes, and follow-up completeness. Both are coordination problems rather than
              clinical ones, which is the whole argument for the module.
            </p>
            <p className="text-ink-2">
              An export carries clocks, treatment, outcome and site, with de-identified case references. Every export is
              a class-3 audit event: the recipient, the fields and the reason are all recorded, because a registry
              submission is a disclosure of patient data however aggregated it looks.
            </p>
          </Why>
        </SectionCard>
      </div>
    </Screen>
  )
}
