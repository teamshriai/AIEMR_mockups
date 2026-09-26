/**
 * Z3 · GP-05 · C-46 — the patient context banner.
 *
 * The atlas is unusually emphatic about this one:
 *
 *   "Z3 IS THE HIGHEST-LEVERAGE COMPONENT IN THE PRODUCT. It appears on ~150
 *    screens, it is where a wrong-patient error is caught. It is SPECIFIED
 *    ONCE in GP-05 and MUST NOT BE REDESIGNED inside a screen spec."
 *
 * So it lives here, once, and no screen draws its own. 64px, two lines.
 *
 * Contents per GP-05: UHID, name, age/sex, ward-bed, consultant, LOS, payer,
 * allergy flag, MLC flag, ABHA chip. The deterioration risk strip (AI-201)
 * that used to sit beneath it — a full-width red band on every screen — is
 * gone: the reading now lives with the rest of the AI's in the Overview's AI
 * insights card, on the Condition tab, and in My Day's attention list.
 */

import { Link, useLocation } from 'react-router-dom'

import { AdmissionChip } from '@/components/admission'
import { Chip, Icon, cx } from '@/components/primitives'
import { BreakGlassBanner } from '@/components/states'
import type { Patient } from '@/data/kit'
import { ageSex } from '@/data/format'
import { useSession } from '@/store/session'

export function PatientBanner({
  patient,
  /** The stroke module shows the live case clock strip alongside the banner. */
  extra,
  className,
}: {
  patient: Patient
  extra?: React.ReactNode
  className?: string
}) {
  const breakGlass = useSession((s) => s.breakGlassPatients[patient.id])
  const { pathname } = useLocation()
  /** The record's own screens carry their own navigation between its parts. */
  const onRecord = /^\/patient\/[^/]+\/(record|condition|results|reports|notes|prescriptions|appointments)$/.test(pathname)

  return (
    <div className={cx('shrink-0', className)}>
      {/* GP-10 — amber, full width, reason before content. */}
      {breakGlass && <BreakGlassBanner reason={breakGlass.reason} by="you" />}

      <div className="glass border-b border-glass-hairline px-4 py-2.5 md:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Line 1 — identity. The wrong-patient catch. */}
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cx(
                'flex size-9 shrink-0 items-center justify-center rounded-pill text-[0.82em] font-bold',
                patient.unidentified ? 'bg-caution-soft text-caution' : 'bg-brand-soft text-brand',
              )}
            >
              {patient.unidentified ? <Icon name="CircleHelp" size={17} /> : initials(patient.name)}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="truncate text-[1.05em] font-semibold tracking-tight">{patient.name}</span>
                {patient.nameNative && <span className="truncate text-[0.88em] text-ink-3">{patient.nameNative}</span>}
                <span className="tabular text-ink-2">{ageSex(patient.age, patient.sex)}</span>
              </p>
              <p className="tabular flex flex-wrap items-center gap-x-2.5 text-[0.86em] text-ink-3">
                <span>{patient.uhid}</span>
                {patient.bed && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{patient.bed}</span>
                  </>
                )}
                {patient.losDays !== undefined && (
                  <>
                    <span aria-hidden>·</span>
                    <span>LOS {patient.losDays}d</span>
                  </>
                )}
                {patient.consultant && (
                  <>
                    <span aria-hidden>·</span>
                    <span className="truncate">{patient.consultant}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Line 2 — the flags. Each carries an icon and a word, never colour alone. */}
          <div className="flex flex-wrap items-center gap-1.5 md:ml-auto">
            {/* Where an admission ordered for this patient has got to. Nothing when there is none. */}
            <AdmissionChip patientId={patient.id} />

            {/* The allergy flag is the one that stops a prescription. */}
            {patient.allergies.length > 0 ? (
              <Chip tone="critical" icon="TriangleAlert" title="Documented allergy — prescribing is gated on this">
                Allergy: {patient.allergies.join(', ')}
              </Chip>
            ) : (
              <Chip tone="neutral" icon="Check">
                No known allergy
              </Chip>
            )}

            {patient.mlc && (
              <Chip tone="isolation" icon="Gavel" title="Medico-legal case — police intimation required">
                MLC
              </Chip>
            )}

            <Chip tone="neutral" icon="Wallet">
              {patient.payer}
            </Chip>

            {/* GP-09 consent & ABHA chip. */}
            <Chip
              tone={patient.abhaStatus === 'Linked' ? 'normal' : 'caution'}
              icon={patient.abhaStatus === 'Linked' ? 'BadgeCheck' : 'CircleAlert'}
              title={patient.abha ?? 'No ABHA linked to this record'}
            >
              ABHA {patient.abhaStatus}
            </Chip>

            {/* The one door into the record. Absent on the record's own screens, which carry their own navigation. */}
            {!onRecord && (
              <Link
                to={`/patient/${patient.uhid}/record`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-pill border border-glass-hairline bg-glass-fill-muted px-2.5 py-1 text-[0.88em] font-medium hover:bg-glass-fill-hover"
              >
                <Icon name="BookOpen" size={13} />
                Patient record
              </Link>
            )}
          </div>
        </div>

        {extra && <div className="mt-2.5">{extra}</div>}
      </div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .replace(/^(Dr\.?|Sr\.|Mr|Ms|Mrs)\s+/i, '')
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}
