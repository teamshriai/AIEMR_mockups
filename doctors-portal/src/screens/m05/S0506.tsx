/**
 * S-05-06 · Referral Inbox — `/referrals` · T2 · ARC-01
 *
 * "Referrals in, triaged rather than queued."
 *
 * AI-609 triages at G2 — so each referral arrives with a proposed urgency that
 * you accept, edit or reject, and rejecting needs a reason. The atlas's sample
 * data is specific: "Three referrals from P-44; one urgent cardiology ranked
 * top with a reason chip."
 *
 * P-44, the referring doctor, is a persona with no screens — an inbound data
 * source rather than a portal. The referral arrives; they do not log in.
 *
 * Calm pass: the rows and the triage cards used to show the same three
 * referrals twice. The cards ARE the list now — one per referral, with the
 * disposition bar and the booking on it — opening on the ones still to
 * triage. The rationale, the targets and the no-login note are one `Why`.
 */

import { useState } from 'react'

import { AIActionBar, RankedSortControl } from '@/components/ai'
import { ScopeTabs, Why, useScope } from '@/components/calm'
import { Button, Card, Chip, Icon, Select, cx } from '@/components/primitives'
import { REFERRALS } from '@/data/clinical'
import type { ReferralRow } from '@/data/clinical'
import { formatDateTime, formatElapsed, formatTime, NOW } from '@/data/format'
import { useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const TARGETS: Record<ReferralRow['triage'], string> = {
  Urgent: '48 hours',
  Soon: '2 weeks',
  Routine: '6 weeks',
}

const TRIAGE_TONE: Record<ReferralRow['triage'], 'abnormal' | 'caution' | 'neutral'> = {
  Urgent: 'abnormal',
  Soon: 'caution',
  Routine: 'neutral',
}

type Scope = 'triage' | 'done'
const SCOPES: readonly Scope[] = ['triage', 'done']

export function S0506() {
  const toast = useUI((s) => s.toast)
  const dispositions = useAI((s) => s.dispositions)
  const { triagedReferrals, triageReferral } = useClinical()
  const [aiSort, setAiSort] = useState(true)
  const [slots, setSlots] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [scope, setScope] = useScope(SCOPES, 'triage')

  /** Deterministic sort is date received; AI-609's is by proposed urgency. */
  const order: Record<ReferralRow['triage'], number> = { Urgent: 0, Soon: 1, Routine: 2 }
  const sorted = aiSort
    ? [...REFERRALS].sort((a, b) => order[a.triage] - order[b.triage] || b.receivedAt.getTime() - a.receivedAt.getTime())
    : [...REFERRALS].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())

  const done = (r: ReferralRow) => dispositions[`referral:${r.id}`] !== undefined || triagedReferrals[r.id] !== undefined
  const toTriage = sorted.filter((r) => !done(r))
  const triaged = sorted.filter(done)
  const rows = scope === 'triage' ? toTriage : triaged
  const urgent = toTriage.filter((r) => r.triage === 'Urgent').length

  return (
    <Screen
      screenId="S-05-06"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-LOW']}
      heading="Referrals"
      subheading={
        <>
          {toTriage.length} to triage
          {urgent > 0 && ` · ${urgent} urgent`}
          {triaged.length > 0 && ` · ${triaged.length} triaged`}
        </>
      }
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">No referrals waiting.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            A referral from a GP, another facility in the group or an external clinic would arrive here. Referring
            doctors send in; they do not have a login.
          </p>
        </Card>
      }
    >
      <div className="max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ScopeTabs
            value={scope}
            onChange={setScope}
            options={[
              { key: 'triage', label: 'To triage', count: toTriage.length },
              { key: 'done', label: 'Triaged / booked', count: triaged.length },
            ]}
          />
          <RankedSortControl
            aiSort={aiSort}
            onChange={setAiSort}
            aiLabel="Clinical urgency"
            deterministicLabel="Date received"
            capabilityId="AI-609"
          />
        </div>

        {rows.length === 0 ? (
          <Card strong className="p-8 text-center text-ink-2">
            {scope === 'triage'
              ? 'Every referral has a triage decision. The booked ones are one tap away.'
              : 'Nothing has been triaged yet.'}
          </Card>
        ) : (
          <ul aria-label="Inbound referrals" className="space-y-4">
            {rows.map((r) => {
              const booked = triagedReferrals[r.id]
              const open = expanded[r.id] ?? false
              return (
                <li key={r.id}>
                  <Card strong className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold">
                          {r.patientName} · {r.speciality}
                        </h3>
                        <p className="text-[0.86em] text-ink-3">
                          {r.fromDoctor} · {r.fromFacility} ·{' '}
                          <span className="tabular">
                            {formatElapsed((NOW.getTime() - r.receivedAt.getTime()) / 60000)} ago
                          </span>
                        </p>
                      </div>
                      <Chip tone={TRIAGE_TONE[r.triage]} icon={r.triage === 'Urgent' ? 'TriangleAlert' : 'Clock'}>
                        {r.triage} · {TARGETS[r.triage]}
                      </Chip>
                    </div>

                    {/* The referrer's reason, verbatim — one line until asked. */}
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded((e) => ({ ...e, [r.id]: !open }))}
                      className="mt-3 flex min-h-11 w-full items-start gap-2 rounded-panel bg-glass-fill-muted px-4 py-2.5 text-left text-[0.95em] text-ink-2 hover:bg-glass-fill-hover"
                    >
                      <span className={cx('min-w-0 flex-1', !open && 'truncate')}>&ldquo;{r.reason}&rdquo;</span>
                      <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} className="mt-1 shrink-0 text-ink-3" />
                    </button>

                    <AIActionBar
                      className="mt-3"
                      touchpointId={`referral:${r.id}`}
                      capabilityId="AI-609"
                      gate="G2"
                      band={r.band}
                      score={r.confidence}
                      explain={{
                        touchpointId: `referral:${r.id}`,
                        capabilityId: 'AI-609',
                        claim: `This referral is proposed as ${r.triage.toLowerCase()}, with a ${TARGETS[r.triage]} target.`,
                        confidence: r.confidence,
                        band: r.band,
                        computedAt: formatTime(NOW),
                        inputs: [
                          { label: 'Referral reason as written', source: `Referral ${r.id}` },
                          { label: 'Speciality triage criteria', source: 'Departmental triage policy' },
                          { label: 'Referrer and facility', source: r.fromFacility },
                        ],
                        evidence: [r.reason609],
                        model: 'referral-triage v1.9.0',
                        limits: [
                          'Reads the referral text. It does not have the patient’s record at the referring practice.',
                          'A referral written vaguely triages low, which is a property of the letter rather than the patient.',
                          'Manual triage is the fallback and remains available on every row.',
                        ],
                      }}
                    />

                    {booked ? (
                      <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.9em]">
                        <Chip tone="normal" icon="Check">
                          Booked
                        </Chip>
                        <span className="text-ink-2">{booked.outcome}</span>
                        <span className="tabular text-ink-3">· received {formatDateTime(r.receivedAt)}</span>
                      </p>
                    ) : (
                      <div className="mt-3 flex flex-wrap items-end gap-3">
                        <div className="min-w-48">
                          <p className="mb-1.5 text-[0.88em] font-medium text-ink-2">Book into</p>
                          <Select
                            value={slots[r.id] ?? ''}
                            onChange={(e) => setSlots((s) => ({ ...s, [r.id]: e.target.value }))}
                            aria-label={`Slot for ${r.patientName}`}
                          >
                            <option value="">Choose a slot…</option>
                            <option>Tue 22-Sep 09:20 · rapid access</option>
                            <option>Thu 24-Sep 11:00 · general clinic</option>
                            <option>Mon 05-Oct 10:40 · general clinic</option>
                          </Select>
                        </div>
                        <Button
                          tone="primary"
                          icon="CalendarCheck"
                          disabled={!slots[r.id]}
                          onClick={() => {
                            triageReferral(r.id, slots[r.id])
                            toast({
                              tone: 'success',
                              title: `${r.patientName} booked`,
                              detail: `${slots[r.id]}. A confirmation goes back to ${r.fromDoctor}.`,
                            })
                          }}
                        >
                          Book and reply to the referrer
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              )
            })}
          </ul>
        )}

        <Why label="Why referrals are triaged, not queued">
          <p className="text-ink-2">
            A date-ordered inbox puts a chest pain with ischaemic changes behind a stable psoriasis that arrived
            yesterday. Triage is the whole difference, and it is proposed at G2 so a wrong call is visibly yours to
            overturn. Fallback: manual triage.
          </p>
          <dl className="tabular grid max-w-xs grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-2">
            {(['Urgent', 'Soon', 'Routine'] as const).map((t) => (
              <div key={t} className="contents">
                <dt className="text-ink-3">{t}</dt>
                <dd>seen within {TARGETS[t]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-ink-2">
            The referring doctor has no login. A referral is inbound data, not a portal session, so everything the
            referrer needs to know goes back out as a letter and a status update — which is why the reason they wrote
            is shown verbatim rather than summarised, and why the reply names the slot, not the reason for the visit.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
