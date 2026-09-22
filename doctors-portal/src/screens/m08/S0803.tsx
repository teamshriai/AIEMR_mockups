/**
 * S-08-03 · My Inpatients — `/ip/patients` · T2 · ARC-01
 *
 * "A consultant's inpatient list, ordered by who needs them first."
 *
 * The same two capabilities as My Day, doing the same jobs — which is the
 * atlas's point about one interaction language. What differs is the scope: this
 * is the ward list, so the row carries the bed, the length of stay and what is
 * outstanding on the round.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { Diamond, RowBadge } from '@/components/ai'
import { Button, Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { AbstainCard } from '@/components/states'
import { INPATIENTS, NEEDS_ATTENTION, RISK_STRIPS, encounterForPatient } from '@/data/clinical'
import type { WorklistRow } from '@/data/clinical'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { Screen } from '@/shell/Screen'

export function S0803() {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const notes = useClinical((s) => s.notes)
  const [aiSort, setAiSort] = useState(true)

  const pinned = NEEDS_ATTENTION
  const others = INPATIENTS.filter((r) => !pinned.some((n) => n.patientId === r.patientId))
  const rows = aiSort
    ? others
    : [...others].sort((a, b) => a.chronologicalAt.getTime() - b.chronologicalAt.getTime())

  const noteDone = (patientId: string) => {
    const enc = encounterForPatient(patientId)
    return enc ? notes[enc.id]?.status === 'signed' : false
  }

  const columns: WorklistColumn<WorklistRow>[] = [
    {
      key: 'bed',
      label: 'Bed',
      className: 'w-20',
      cell: (r) => <span className="tabular font-medium">{r.bed ?? '—'}</span>,
    },
    {
      key: 'patient',
      label: 'Patient',
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="tabular block text-[0.86em] text-ink-3">
              {p.age}/{p.sex} · {p.uhid}
              {p.losDays !== undefined && ` · LOS ${p.losDays}d`}
            </span>
          </span>
        )
      },
    },
    {
      key: 'risk',
      label: 'Deterioration risk',
      cell: (r) =>
        r.risk === 'ABSTAIN' ? (
          <span className="flex items-center gap-1.5 text-[0.88em] font-medium text-caution">
            <Icon name="CircleHelp" size={14} />
            Cannot assess
          </span>
        ) : (
          <RowBadge
            label={r.risk ?? '—'}
            reason={r.reason}
            tone={r.risk === 'HIGH' ? 'abnormal' : r.risk === 'MODERATE' ? 'caution' : 'normal'}
            band="HIGH"
          />
        ),
    },
    {
      key: 'flags',
      label: 'Flags',
      secondary: true,
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <span className="flex flex-wrap gap-1">
            {p.allergies.length > 0 && (
              <Chip tone="critical" icon="TriangleAlert">
                {p.allergies[0]}
              </Chip>
            )}
            {p.mlc && (
              <Chip tone="isolation" icon="Gavel">
                MLC
              </Chip>
            )}
            <Chip tone="neutral">{p.payer}</Chip>
          </span>
        )
      },
    },
    {
      key: 'round',
      label: 'Round note',
      cell: (r) =>
        noteDone(r.patientId) ? (
          <Chip tone="normal" icon="Check">
            Signed
          </Chip>
        ) : (
          <Chip tone="caution" icon="PenLine">
            Outstanding
          </Chip>
        ),
    },
    {
      key: 'action',
      label: '',
      className: 'text-right',
      cell: (r) => {
        const enc = encounterForPatient(r.patientId)
        return enc ? (
          <Button
            size="sm"
            tone="primary"
            icon="PenLine"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/ip/encounter/${enc.id}/note`)
            }}
          >
            Round note
          </Button>
        ) : (
          <Icon name="ChevronRight" size={15} className="text-ink-muted" />
        )
      },
    },
  ]

  const outstanding = INPATIENTS.filter((r) => !noteDone(r.patientId)).length

  return (
    <Screen
      screenId="S-08-03"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      chips={
        <>
          <Chip tone="neutral">{INPATIENTS.length} inpatients</Chip>
          {outstanding > 0 && <Chip tone="caution">{outstanding} round notes outstanding</Chip>}
        </>
      }
      actions={
        <Button icon="DoorOpen" onClick={() => navigate('/discharge/board')}>
          Discharge board
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Your ward round</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Under you">{INPATIENTS.length}</KeyValue>
              <KeyValue label="High risk">
                {INPATIENTS.filter((r) => r.risk === 'HIGH').length}
              </KeyValue>
              <KeyValue label="Notes outstanding">{outstanding}</KeyValue>
              <KeyValue label="Discharge predicted">1</KeyValue>
            </dl>
            <p className="mt-3 text-[0.86em] text-ink-3">
              Across wards 4B, 2A, ICU-1 and the emergency department at {me.facilityCode}.
            </p>
          </Card>

          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              Same ranking, different scope
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              AI-613 and AI-201 are the same two capabilities as on My Day. A clinician who learned the reason chip
              there already knows it here — that consistency is treated as a safety property, not a style choice.
            </p>
          </Card>
        </div>
      }
      railTitle="Round"
    >
      <div className="space-y-5">
        <Worklist
          rows={rows}
          pinned={pinned}
          pinnedLabel="Needs attention"
          columns={columns}
          rowKey={(r) => r.patientId}
          onOpen={(r) => navigate(`/patient/${patient(r.patientId).uhid}/chart`)}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-613"
          caption="Inpatients under this consultant"
          emptyWhy="No inpatients are assigned to you at this facility. An admission under your name, or being added to a care team, would put them here."
          filters={
            <>
              <Chip tone="neutral" icon="Building2">
                {me.facilityCode}
              </Chip>
              <Chip tone="neutral" icon="BedDouble">
                4B · 2A · ICU-1 · ED
              </Chip>
            </>
          }
        />

        {INPATIENTS.some((r) => r.risk === 'ABSTAIN') && (
          <AbstainCard
            capabilityId="AI-201"
            missing={RISK_STRIPS['SD-P-08']?.abstainReason ?? 'No recent observations for one patient on this list.'}
            fixAction={
              <Button size="sm" icon="Activity" onClick={() => navigate('/patient/AWF-0044221/chart')}>
                Open the patient
              </Button>
            }
          />
        )}
      </div>
    </Screen>
  )
}
