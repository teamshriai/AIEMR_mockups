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

import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { PriorityChip, StageChip } from '@/components/admission'
import { PillTabs } from '@/components/myday'
import { Button, Card, Chip, Icon } from '@/components/primitives'
import { TYPE_LABEL, inpatientRows, isAdmittedHere, pendingAdmissions } from '@/data/admissions'
import type { Admission } from '@/data/admissions'
import { NEEDS_ATTENTION, encounterForPatient } from '@/data/clinical'
import type { WorklistRow } from '@/data/clinical'
import { ageSex } from '@/data/format'
import { patient } from '@/data/kit'
import { useAdmissions } from '@/store/admissions'
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
  const admissions = useAdmissions((s) => s.admissions)
  const [aiSort, setAiSort] = useState(true)

  /** Everyone in a bed — the seeded list plus anyone admitted here — and who is still waiting for one. */
  const inpatients = useMemo(() => inpatientRows(admissions), [admissions])
  const pending = useMemo(() => pendingAdmissions(admissions), [admissions])

  const raw = params.get('location')
  const location: Location = raw === 'ward' || raw === 'icu' || raw === 'ed' ? raw : 'all'

  const noteDone = (patientId: string) => {
    // Admitted here from OPD: their encounter is the clinic visit, so a signed OPD note is not a round note.
    if (isAdmittedHere(patientId, admissions)) return false
    const enc = encounterForPatient(patientId)
    return enc ? notes[enc.id]?.status === 'signed' : false
  }

  const scoped = inpatients.filter((r) => inLocation(r, location))
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
        ) : r.risk === 'LOW' ? (
          <Chip tone="normal" icon="Check">
            Low risk
          </Chip>
        ) : null,
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
    >
      <div className="max-w-4xl space-y-6">
        {pending.length > 0 && <PendingAdmissions admissions={pending} />}

        <Worklist
          variant="calm"
          tone="inpatients"
          rows={rows}
          pinned={pinned}
          pinnedLabel="Needs attention"
          columns={columns}
          rowKey={(r) => r.patientId}
          onOpen={(r) => navigate(`/patient/${patient(r.patientId).uhid}/record`)}
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
                  count: inpatients.filter((r) => inLocation(r, l)).length,
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

/**
 * The front desk's queue, as the doctor sees it: who they admitted, how
 * urgently, and where each admission has got to. A row opens the patient's
 * record. Each patient moves into the list below once they have a bed.
 */
function PendingAdmissions({ admissions }: { admissions: Admission[] }) {
  return (
    <Card strong className="overflow-hidden">
      <div className="flex items-center gap-2 bg-pri-warning-soft/60 px-4 py-2">
        <Icon name="Hourglass" size={13} className="text-pri-warning-ink" />
        <h2 className="text-[0.78em] font-bold tracking-[0.08em] text-pri-warning-ink uppercase">Pending admissions</h2>
        <span className="tabular inline-flex min-h-5 items-center rounded-pill bg-pri-warning-fill px-2 text-[0.76em] font-bold text-pri-on-warning">
          {admissions.length}
        </span>
      </div>
      <ol className="divide-y divide-glass-hairline">
        {admissions.map((a) => {
          const p = patient(a.patientId)
          return (
            <li key={a.id}>
              <Link
                to={`/patient/${p.uhid}/record`}
                className="grid min-h-16 grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-3 py-3 transition-colors duration-150 ease-out-clinical hover:bg-glass-fill-hover sm:grid-cols-[4.75rem_1fr_auto] sm:px-4"
              >
                <span className="order-2 inline-flex min-h-8 items-center justify-center self-center justify-self-start rounded-field bg-glass-inset px-2.5 text-[0.86em] font-bold whitespace-nowrap text-ink-2 sm:order-none sm:w-full">
                  {TYPE_LABEL[a.type]}
                </span>
                <span className="order-1 min-w-0 sm:order-none">
                  <span className="block truncate text-[1.02em] font-semibold tracking-tight">{p.name}</span>
                  <span className="tabular mt-0.5 block text-[0.88em] text-ink-3">
                    {ageSex(p.age, p.sex)} · {p.uhid}
                  </span>
                </span>
                <span className="order-3 flex shrink-0 flex-col items-end gap-1.5 sm:order-none">
                  <PriorityChip priority={a.priority} />
                  <StageChip admission={a} />
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
