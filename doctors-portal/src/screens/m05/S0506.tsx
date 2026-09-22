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
 */

import { useState } from 'react'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { AIActionBar, Diamond, RowBadge } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, Select } from '@/components/primitives'
import { REFERRALS } from '@/data/clinical'
import type { ReferralRow } from '@/data/clinical'
import { formatDateTime, formatElapsed, formatTime, NOW } from '@/data/format'
import { useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

const TARGETS: Record<ReferralRow['triage'], string> = {
  Urgent: '48 hours',
  Soon: '2 weeks',
  Routine: '6 weeks',
}

export function S0506() {
  const toast = useUI((s) => s.toast)
  const dispositions = useAI((s) => s.dispositions)
  const { triagedReferrals, triageReferral } = useClinical()
  const [aiSort, setAiSort] = useState(true)
  const [slots, setSlots] = useState<Record<string, string>>({})

  const order: Record<ReferralRow['triage'], number> = { Urgent: 0, Soon: 1, Routine: 2 }
  const rows = aiSort
    ? [...REFERRALS].sort((a, b) => order[a.triage] - order[b.triage])
    : [...REFERRALS].sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime())

  const columns: WorklistColumn<ReferralRow>[] = [
    {
      key: 'patient',
      label: 'Patient',
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate font-medium">{r.patientName}</span>
          <span className="block truncate text-[0.86em] text-ink-3">{r.speciality}</span>
        </span>
      ),
    },
    {
      key: 'from',
      label: 'Referred by',
      secondary: true,
      cell: (r) => (
        <span className="block min-w-0">
          <span className="block truncate">{r.fromDoctor}</span>
          <span className="block truncate text-[0.86em] text-ink-3">{r.fromFacility}</span>
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      cell: (r) => <span className="block max-w-72 text-[0.92em]">{r.reason}</span>,
    },
    {
      key: 'triage',
      label: 'Proposed urgency',
      cell: (r) => (
        <RowBadge
          label={r.triage}
          reason={`${r.reason609} · target ${TARGETS[r.triage]}`}
          tone={r.triage === 'Urgent' ? 'abnormal' : r.triage === 'Soon' ? 'caution' : 'neutral'}
          band={r.band}
        />
      ),
    },
    {
      key: 'received',
      label: 'Received',
      cell: (r) => (
        <span className="block">
          <span className="tabular block text-[0.9em]">{formatDateTime(r.receivedAt)}</span>
          <span className="tabular block text-[0.84em] text-ink-3">
            {formatElapsed((NOW.getTime() - r.receivedAt.getTime()) / 60000)} ago
          </span>
        </span>
      ),
    },
    {
      key: 'state',
      label: 'Booked',
      cell: (r) =>
        triagedReferrals[r.id] ? (
          <Chip tone="normal" icon="Check">
            {triagedReferrals[r.id].outcome}
          </Chip>
        ) : (
          <Chip tone="neutral">not booked</Chip>
        ),
    },
  ]

  const untriaged = REFERRALS.filter((r) => !dispositions[`referral:${r.id}`])

  return (
    <Screen
      screenId="S-05-06"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-LOW']}
      chips={
        <>
          <Chip tone="neutral">{REFERRALS.length} in</Chip>
          {untriaged.length > 0 && <Chip tone="caution">{untriaged.length} to triage</Chip>}
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
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Targets</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              {(['Urgent', 'Soon', 'Routine'] as const).map((t) => (
                <div key={t} className="flex items-center justify-between gap-2 py-1.5">
                  <dt className="flex items-center gap-2 text-[0.92em]">
                    <Chip tone={t === 'Urgent' ? 'abnormal' : t === 'Soon' ? 'caution' : 'neutral'}>{t}</Chip>
                  </dt>
                  <dd className="tabular font-medium">{TARGETS[t]}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-609 · triage, not queueing
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A date-ordered inbox puts a chest pain with ischaemic changes behind a stable psoriasis that arrived
              yesterday. Triage is the whole difference, and it is proposed at G2 so a wrong call is visibly yours to
              overturn.
            </p>
            <p className="mt-2 text-[0.84em] text-ink-3">Fallback: manual triage.</p>
          </Card>
        </div>
      }
      railTitle="Triage"
    >
      <div className="space-y-5">
        <Alert tone="info" title="The referring doctor has no login">
          A referral is inbound data, not a portal session. Everything the referrer needs to know goes back out as a
          letter and a status update — which is why the reason they wrote is shown verbatim rather than summarised.
        </Alert>

        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-609"
          aiSortLabel="Clinical urgency"
          deterministicLabel="Date received"
          caption="Inbound referrals"
          emptyWhy="No referrals waiting. One from a GP or another facility would arrive here."
          filters={
            <>
              <Chip tone="neutral" icon="Stethoscope">
                General Medicine
              </Chip>
              <Chip tone="neutral" icon="Clock">
                last 7 days
              </Chip>
            </>
          }
        />

        <ScreenSection title="Triage each one" subtitle="Accept the proposal, change it, or reject it with a reason">
          <div className="space-y-4">
            {rows.map((r) => (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold">
                      {r.patientName} · {r.speciality}
                    </h3>
                    <p className="text-[0.86em] text-ink-3">
                      {r.fromDoctor} · {r.fromFacility} · received {formatDateTime(r.receivedAt)}
                    </p>
                  </div>
                  <Chip tone={r.triage === 'Urgent' ? 'abnormal' : r.triage === 'Soon' ? 'caution' : 'neutral'}>
                    {r.triage} · target {TARGETS[r.triage]}
                  </Chip>
                </div>

                <p className="mt-3 rounded-panel bg-glass-fill-muted px-4 py-3 text-[0.95em] text-ink-2">
                  &ldquo;{r.reason}&rdquo;
                </p>

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
                  <span className="flex items-center gap-1.5 text-[0.86em] text-ink-3">
                    <Icon name="Mail" size={13} />
                    The reply names the slot, not the reason for the visit
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </ScreenSection>
      </div>
    </Screen>
  )
}
