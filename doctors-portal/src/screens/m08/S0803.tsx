/**
 * S-08-03 · My Inpatients — `/ip/patients` · T2 · ARC-01
 *
 * "A consultant's inpatient list, ordered by who needs them first."
 *
 * Redesigned to match My Day, because this is where My Day's Ward and ICU
 * counts land and a calm home screen opening onto a dense grid is two products
 * rather than one. The rows and the data are unchanged; they render through the
 * `calm` variant of `ARC-01`, which keeps every behaviour the archetype
 * mandates — the keyboard map, the row-count line, the named sort, selection
 * surviving a refresh — and only changes the shape.
 *
 * The same two capabilities as My Day, doing the same jobs, which is the
 * atlas's point about one interaction language. What differs is the scope: this
 * is the ward list, so the row carries the bed, the length of stay and what is
 * outstanding on the round.
 *
 * `?location=ward|icu` arrives from My Day's counts so the list opens already
 * narrowed, and the narrowing is visible and removable rather than silent.
 */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { PillTabs } from '@/components/myday'
import { Button, Chip } from '@/components/primitives'
import { INPATIENTS, NEEDS_ATTENTION, encounterForPatient } from '@/data/clinical'
import type { WorklistRow } from '@/data/clinical'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { Screen } from '@/shell/Screen'

type Location = 'all' | 'ward' | 'icu' | 'ed'

/* VOCABULARY.md — `All` is the unfiltered slice on every list in the product. */
const LOCATION_LABEL: Record<Location, string> = {
  all: 'All',
  ward: 'Ward',
  icu: 'ICU',
  ed: 'ED',
}

function inLocation(row: WorklistRow, location: Location): boolean {
  const bed = row.bed ?? ''
  if (location === 'icu') return bed.startsWith('ICU')
  if (location === 'ed') return bed.startsWith('ED')
  if (location === 'ward') return bed !== '' && !bed.startsWith('ICU') && !bed.startsWith('ED')
  return true
}

export function S0803() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const me = useCurrentStaff()
  const notes = useClinical((s) => s.notes)
  const [aiSort, setAiSort] = useState(true)

  const raw = params.get('location')
  const location: Location = raw === 'ward' || raw === 'icu' || raw === 'ed' ? raw : 'all'

  const noteDone = (patientId: string) => {
    const enc = encounterForPatient(patientId)
    return enc ? notes[enc.id]?.status === 'signed' : false
  }

  const scoped = INPATIENTS.filter((r) => inLocation(r, location))
  const pinned = NEEDS_ATTENTION.filter((r) => inLocation(r, location))
  const others = scoped.filter((r) => !pinned.some((n) => n.patientId === r.patientId))
  const rows = aiSort
    ? others
    : [...others].sort((a, b) => a.chronologicalAt.getTime() - b.chronologicalAt.getTime())

  const columns: WorklistColumn<WorklistRow>[] = [
    {
      key: 'bed',
      label: 'Bed',
      role: 'lead',
      className: 'w-20',
      cell: (r) => r.bed ?? '—',
    },
    {
      key: 'patient',
      label: 'Patient',
      role: 'primary',
      cell: (r) => patient(r.patientId).name,
    },
    {
      key: 'who',
      label: 'Age / sex',
      role: 'context',
      cell: (r) => {
        const p = patient(r.patientId)
        return (
          <span className="tabular">
            {p.age}/{p.sex}
            {p.losDays !== undefined && ` · LOS ${p.losDays}d`}
          </span>
        )
      },
    },
    {
      /* The one line that says WHY the row sits where it does. */
      key: 'reason',
      label: 'Reason',
      role: 'context',
      cell: (r) => (r.risk === 'ABSTAIN' ? null : r.reason),
    },
    {
      key: 'flags',
      label: 'Flags',
      role: 'context',
      cell: (r) => {
        const p = patient(r.patientId)
        if (p.allergies.length === 0 && !p.mlc) return null
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
          </span>
        )
      },
    },
    {
      /*
       * One chip, the word in it, nothing else. The AI-201 provenance (◆, the
       * confidence dot, the reason chip) moves to the patient's chart — on a
       * six-row list it was the loudest thing in every row and said the same
       * thing six times.
       */
      key: 'risk',
      label: 'Deterioration risk',
      role: 'status',
      cell: (r) =>
        r.risk === 'ABSTAIN' ? (
          /* §4.5 — cannot score is not a zero, and it says so in words. */
          <Chip tone="caution" icon="CircleHelp">
            Cannot assess
          </Chip>
        ) : r.risk === 'HIGH' ? (
          <Chip tone="abnormal" icon="TriangleAlert">
            High risk
          </Chip>
        ) : r.risk === 'MODERATE' ? (
          <Chip tone="caution" icon="CircleAlert">
            Moderate
          </Chip>
        ) : (
          <Chip tone="normal" icon="Check">
            Low risk
          </Chip>
        ),
    },
    {
      /*
       * Only the exception is marked. "Note outstanding" on all six rows
       * carried no information; the count is in the subheading.
       */
      key: 'round',
      label: 'Round note',
      role: 'status',
      cell: (r) =>
        noteDone(r.patientId) ? (
          <Chip tone="normal" icon="PenLine">
            Note signed
          </Chip>
        ) : null,
    },
  ]

  const outstanding = scoped.filter((r) => !noteDone(r.patientId)).length
  const highRisk = scoped.filter((r) => r.risk === 'HIGH').length

  return (
    <Screen
      screenId="S-08-03"
      loadingShape="list"
      heading="Inpatients"
      subheading={
        <>
          {scoped.length} under you · {highRisk} high risk · {outstanding} round{' '}
          {outstanding === 1 ? 'note' : 'notes'} outstanding
        </>
      }
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      actions={
        <Button icon="DoorOpen" onClick={() => navigate('/discharge/board')}>
          Discharge board
        </Button>
      }
    >
      <div className="max-w-4xl space-y-6">
        <Worklist
          variant="calm"
          rows={rows}
          pinned={pinned}
          pinnedLabel="Needs attention"
          columns={columns}
          rowKey={(r) => r.patientId}
          onOpen={(r) => {
            const enc = encounterForPatient(r.patientId)
            navigate(enc ? `/ip/encounter/${enc.id}/note` : `/patient/${patient(r.patientId).uhid}/chart`)
          }}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-613"
          caption="Inpatients under this consultant"
          noun="patients"
          emptyWhy={
            location === 'all'
              ? 'No inpatients are assigned to you at this facility. An admission under your name, or being added to a care team, would put them here.'
              : `No inpatients of yours are in ${location === 'icu' ? 'the ICU' : location === 'ed' ? 'the ED' : 'a ward bed'} right now. Clearing the filter shows the rest of your list.`
          }
          emptyAction={
            location !== 'all' ? (
              <Button size="sm" icon="X" onClick={() => setParams({})}>
                All locations
              </Button>
            ) : undefined
          }
          filters={
            <>
              <Chip tone="neutral" icon="Building2">
                {me.facilityCode}
              </Chip>
              {/* The narrowing that arrived in the URL, visible and removable. */}
              <PillTabs
                ariaLabel="Location"
                value={location}
                options={(['all', 'ward', 'icu', 'ed'] as Location[]).map((l) => ({
                  key: l,
                  label: LOCATION_LABEL[l],
                  icon: l === 'ward' ? 'BedDouble' : l === 'icu' ? 'Activity' : l === 'ed' ? 'Siren' : undefined,
                  count: INPATIENTS.filter((r) => inLocation(r, l)).length,
                }))}
                onChange={(l) => setParams(l === 'all' ? {} : { location: l })}
              />
            </>
          }
        />
      </div>
    </Screen>
  )
}
