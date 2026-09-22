/**
 * S-06-01 · Clinician Home / My Day — `/clinician` · T1 · ARC-20
 *
 * "The consultant's day, ranked by who needs them first."
 *
 * Deck beat #5. The drawing notes are specific about what has to be visible:
 *   • the NEEDS-ATTENTION group PINNED AT THE TOP with reason chips —
 *     "NEWS2 7, rising 4h", "critical potassium";
 *   • all four work types on one screen: clinic, inpatients, results, co-signs,
 *     "That is what 'my day' means to a consultant";
 *   • the sort control reading "Sorted by AI acuity ▾" so reversibility is
 *     visible.
 *
 * Sample data: SD-S-01 at 08:40 — 18 in clinic, 6 inpatients (SD-P-03 risk
 * HIGH), 3 results to review, 2 co-signs pending.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { TileGrid, Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { Diamond, RowBadge, WhyLink } from '@/components/ai'
import { Button, Card, Chip, Icon, StatTile, cx } from '@/components/primitives'
import { AbstainCard } from '@/components/states'
import {
  CLINIC_LIST,
  COSIGN_QUEUE,
  INPATIENTS,
  NEEDS_ATTENTION,
  RESULTS,
  RISK_STRIPS,
} from '@/data/clinical'
import type { WorklistRow } from '@/data/clinical'
import { formatElapsed, minutesAgo, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

export function S0601() {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const coSigned = useClinical((s) => s.coSigned)
  const [aiSort, setAiSort] = useState(true)

  const seen = CLINIC_LIST.filter((c) => c.status === 'Seen').length
  const next = CLINIC_LIST.find((c) => c.status === 'Waiting')
  const resultsToReview = RESULTS.filter((r) => !r.acknowledged && !acknowledgements[r.id])
  const criticalOutstanding = resultsToReview.filter((r) => r.critical)
  const coSignOutstanding = COSIGN_QUEUE.filter((c) => !coSigned[c.id])

  /** The rest of the list, below the pinned group. */
  const others = INPATIENTS.filter((r) => !NEEDS_ATTENTION.some((n) => n.patientId === r.patientId))
  const ordered = aiSort
    ? others
    : [...others].sort((a, b) => a.chronologicalAt.getTime() - b.chronologicalAt.getTime())

  const columns: WorklistColumn<WorklistRow>[] = [
    {
      key: 'patient',
      label: 'Patient',
      cell: (row) => {
        const p = patient(row.patientId)
        return (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="tabular block text-[0.86em] text-ink-3">
              {p.age}/{p.sex} · {row.bed ?? 'outpatient'}
            </span>
          </span>
        )
      },
    },
    {
      key: 'risk',
      label: 'Deterioration risk',
      cell: (row) =>
        row.risk === 'ABSTAIN' ? (
          <span className="flex items-center gap-1.5 text-[0.88em] font-medium text-caution">
            <Icon name="CircleHelp" size={14} />
            Cannot assess
          </span>
        ) : (
          <RowBadge
            label={row.risk ?? '—'}
            reason={row.reason}
            tone={row.risk === 'HIGH' ? 'abnormal' : row.risk === 'MODERATE' ? 'caution' : 'normal'}
            band="HIGH"
          />
        ),
    },
    {
      key: 'pending',
      label: 'Waiting on you',
      secondary: true,
      cell: (row) =>
        row.pending.length === 0 ? (
          <span className="text-[0.88em] text-ink-3">Nothing</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {row.pending.map((p) => (
              <Chip key={p} tone="neutral">
                {p}
              </Chip>
            ))}
          </span>
        ),
    },
    {
      key: 'open',
      label: '',
      className: 'w-10 text-right',
      cell: () => <Icon name="ChevronRight" size={15} className="text-ink-muted" />,
    },
  ]

  function openPatient(row: WorklistRow) {
    navigate(`/patient/${patient(row.patientId).uhid}/chart`)
  }

  return (
    <Screen
      screenId="S-06-01"
      loadingShape="tiles"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">Nothing is waiting on you.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            No clinic session is open, you have no inpatients assigned, and no results are unreviewed. A session
            starting or a patient being admitted under you would put something here.
          </p>
        </Card>
      }
      chips={
        <>
          <Chip tone="ai">
            <Diamond size={9} />
            AI-613 · AI-201
          </Chip>
          <Chip tone="neutral">{me.speciality}</Chip>
        </>
      }
      actions={
        <Button icon="Video" onClick={() => navigate('/tele/queue')}>
          Teleconsults
        </Button>
      }
    >
      <div className="space-y-6">
        {/* The four work types, on one screen. */}
        <TileGrid>
          <StatTile
            label="Clinic today"
            value={CLINIC_LIST.length > 0 ? 18 : 0}
            sub={`${seen} seen · next ${next?.token ?? '—'}`}
            action={
              <Button
                tone="primary"
                size="sm"
                icon="ArrowRight"
                onClick={() => {
                  if (!next) return
                  toast({
                    tone: 'info',
                    title: `Calling ${next.token}`,
                    detail: `${patient(next.patientId).name} · the note opens with the scribe ready.`,
                  })
                  navigate('/encounter/E-118402/note')
                }}
              >
                Call next
              </Button>
            }
            badge={
              <Chip tone="ai" title="AI-607 predicts the wait, not just the position">
                <Diamond size={9} />
                {next?.predictedWaitMin ?? 0}m wait
              </Chip>
            }
          />

          <StatTile
            label="Inpatients"
            value={INPATIENTS.length}
            sub="1 discharge predicted today"
            tone="neutral"
            onClick={() => navigate('/ip/patients')}
            badge={
              <Chip tone="abnormal" icon="TriangleAlert">
                2 high risk
              </Chip>
            }
          />

          <StatTile
            label="Results"
            value={resultsToReview.length}
            sub={
              criticalOutstanding.length > 0
                ? `${criticalOutstanding.length} critical, unacknowledged`
                : 'none critical'
            }
            tone={criticalOutstanding.length > 0 ? 'critical' : 'neutral'}
            onClick={() => navigate('/results/inbox')}
            badge={
              <Chip tone="ai">
                <Diamond size={9} />
                AI-212
              </Chip>
            }
          />

          <StatTile
            label="Co-sign"
            value={coSignOutstanding.length}
            sub={coSignOutstanding.length ? 'from your registrar' : 'nothing pending'}
            tone={coSignOutstanding.length ? 'caution' : 'normal'}
            onClick={() => navigate('/clinician/cosign')}
          />
        </TileGrid>

        {/* The needs-attention group, pinned, with reason chips. */}
        <ScreenSection
          title="My patients"
          subtitle="Ranked by who needs you first. The deterministic sort is one click away."
        >
          <Worklist
            rows={ordered}
            pinned={NEEDS_ATTENTION}
            pinnedLabel="Needs attention"
            columns={columns}
            rowKey={(r) => r.patientId}
            onOpen={openPatient}
            aiSort={aiSort}
            onSortChange={setAiSort}
            sortCapability="AI-613"
            caption="Inpatients under this consultant, ranked by deterioration risk"
            emptyWhy="No patients are assigned to you at this facility. Admitting a patient under your name, or being added to a care team, would put them here."
            filters={
              <>
                <Chip tone="neutral" icon="Building2">
                  {me.facilityCode}
                </Chip>
                <Chip tone="neutral" icon="Clock">
                  as of 08:40
                </Chip>
              </>
            }
          />
        </ScreenSection>

        {/* AI-201's abstention, shown rather than hidden. */}
        {INPATIENTS.some((r) => r.risk === 'ABSTAIN') && (
          <AbstainCard
            capabilityId="AI-201"
            missing={
              RISK_STRIPS['SD-P-08']?.abstainReason ??
              'No vitals charted recently enough to score one patient on this list.'
            }
            fixAction={
              <Button size="sm" icon="Activity" onClick={() => navigate('/ip/patients')}>
                Open the patient and chart observations
              </Button>
            }
          />
        )}

        {/* The two rows the deck frame calls for, spelled out with their clocks. */}
        <ScreenSection title="Why those two are pinned" subtitle="The reason chip is the whole point of a ranked list">
          <div className="grid gap-4 md:grid-cols-2">
            {NEEDS_ATTENTION.map((row) => {
              const p = patient(row.patientId)
              const risk = RISK_STRIPS[row.patientId]
              return (
                <Card key={row.patientId} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="tabular text-[0.86em] text-ink-3">
                        {p.age}/{p.sex} · {row.bed}
                      </p>
                    </div>
                    <Chip tone="abnormal" icon="TriangleAlert">
                      {row.risk}
                    </Chip>
                  </div>
                  <p className="mt-2.5 flex items-start gap-2 rounded-panel bg-abnormal-soft px-3 py-2 text-[0.92em] font-medium text-abnormal">
                    <Diamond size={10} className="mt-1" />
                    {row.reason}
                  </p>
                  {risk && risk.band !== 'ABSTAIN' && (
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <span className="text-[0.86em] text-ink-3">
                        computed {formatElapsed((NOW.getTime() - risk.computedAt.getTime()) / 60000)} ago ·{' '}
                        {risk.modelVersion}
                      </span>
                      <WhyLink
                        target={{
                          touchpointId: `home-risk-${row.patientId}`,
                          capabilityId: 'AI-201',
                          claim: `${p.name} is at ${risk.band} risk of deterioration — ${risk.score}, ${risk.trend}.`,
                          confidence: 0.88,
                          band: 'HIGH',
                          computedAt: '08:40',
                          inputs: risk.drivers.map((d) => ({
                            label: d.label,
                            source: 'Flowsheet, most recent set',
                          })),
                          drivers: risk.drivers,
                          model: risk.modelVersion,
                          limits: [
                            'Derived from charted vitals only.',
                            'Abstains below the vitals-recency floor rather than scoring on stale observations.',
                            'Validated on adult inpatients.',
                          ],
                        }}
                      />
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => navigate(`/patient/${p.uhid}/chart`)}>
                      Open chart
                    </Button>
                    {row.patientId === 'SD-P-03' && (
                      <Button size="sm" tone="primary" onClick={() => navigate('/ip/encounter/E-118366/note')}>
                        Write the round note
                      </Button>
                    )}
                    {row.patientId === 'SD-P-07' && (
                      <Button size="sm" tone="primary" onClick={() => navigate('/results/inbox')}>
                        Acknowledge the critical result
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        </ScreenSection>

        {/* The critical-result escalation clock, since the wireframe names it. */}
        {criticalOutstanding.length > 0 && (
          <Card className="border-l-[3px] border-l-critical p-4">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-critical">
              <Icon name="TriangleAlert" size={16} />
              {criticalOutstanding.length} critical result unacknowledged
              <span className={cx('tabular font-normal text-ink-3')}>
                {criticalOutstanding[0].unackMinutes} min · escalates to the on-call at 15 min
              </span>
            </p>
            <p className="mt-1.5 text-[0.92em] text-ink-2">
              A critical value interrupts a named clinician who must answer for it — not a pool, and not a ward.
            </p>
            <Button
              tone="destructive"
              size="sm"
              className="mt-3"
              icon="ArrowRight"
              onClick={() => navigate('/results/inbox')}
            >
              Go to {criticalOutstanding[0].test} {criticalOutstanding[0].value} {criticalOutstanding[0].unit}
            </Button>
          </Card>
        )}

        <p className="text-[0.84em] text-ink-3">
          Clinic session opened {formatElapsed((NOW.getTime() - minutesAgo(70).getTime()) / 60000)} ago ·{' '}
          {me.name} · {me.identifierKind} {me.identifier}
        </p>
      </div>
    </Screen>
  )
}
