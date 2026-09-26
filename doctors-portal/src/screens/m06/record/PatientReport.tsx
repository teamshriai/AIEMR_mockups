/**
 * The patient's story on one surface — who they are here for, what is coded,
 * what they react to, what they take, what was last written and when they are
 * next due. Six facts, each one line or a short list, never a paragraph: the
 * detail lives on the tabs above, so this card can stay readable at a glance.
 */

import { CountPill, SectionCard } from '@/components/calm'
import { Chip } from '@/components/primitives'
import { encounterForPatient, problemsFor } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { activeMedicines, conditionFor, nextAppointment, pastNotesFor } from '@/data/record'

import { STATUS_TONE } from './shared'

const VISIT_WORD = { IP: 'Inpatient', OP: 'OPD', ED: 'ED', TELE: 'Teleconsult' } as const

export function PatientReport({ patient: p, className }: { patient: Patient; className?: string }) {
  const c = conditionFor(p.id)
  const enc = encounterForPatient(p.id)
  const problems = problemsFor(p.id)
  const open = problems.filter((x) => x.status === 'Open')
  const meds = activeMedicines(p.id)
  const note = pastNotesFor(p.id)[0]
  const next = nextAppointment(p.id)

  const visit = enc
    ? [VISIT_WORD[enc.type], enc.department, p.bed ?? enc.encounterNo, p.losDays !== undefined && `day ${p.losDays}`]
        .filter(Boolean)
        .join(' · ')
    : 'No open visit'

  return (
    <SectionCard
      title="Patient report"
      className={className}
      meta={c && <Chip tone={STATUS_TONE[c.status]}>{c.status}</Chip>}
      action={c && <span className="tabular text-[0.86em] text-ink-3">updated {formatDate(c.updatedAt)}</span>}
      bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
    >
      {/* The lead — the story in two lines. */}
      <p className="text-[1.05em] font-semibold tracking-tight">{c?.headline ?? p.scenario}</p>
      {c && <p className="mt-1 line-clamp-3 text-[0.95em] leading-relaxed text-ink-2">{c.summary}</p>}

      <dl className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
        <Fact label={enc?.type === 'IP' ? 'Admission' : 'Visit'} sub={[p.consultant, p.payer].filter(Boolean).join(' · ')}>
          {visit}
        </Fact>
        <Fact label="Problems" sub={problems.length > open.length ? `${problems.length - open.length} resolved` : undefined}>
          {open.length === 0 ? 'None coded yet' : open.slice(0, 3).map((x) => x.label).join(' · ')}
          {open.length > 3 && <span className="text-ink-3"> · +{open.length - 3} more</span>}
        </Fact>
        <Fact label="Allergies">
          {p.allergies.length === 0 ? (
            'None recorded'
          ) : (
            <span className="flex flex-wrap gap-1.5">
              {p.allergies.map((a) => (
                <Chip key={a} tone="abnormal" icon="TriangleAlert">
                  {a}
                </Chip>
              ))}
            </span>
          )}
        </Fact>
        <Fact label="Medicines" sub={meds[0] && `since ${formatDate(meds[0].since)} · ${meds[0].by}`}>
          {meds.length === 0 ? 'Nothing current' : meds.slice(0, 3).map((m) => `${m.drug} ${m.dose} ${m.frequency}`).join(' · ')}
          {meds.length > 3 && <span className="text-ink-3"> · +{meds.length - 3} more</span>}
        </Fact>
        <Fact label="Last note" sub={note && `${formatDate(note.at)} ${formatTime(note.at)} · ${note.by} · ${note.setting}`}>
          {note ? `${note.kind} — ${note.assessment}` : 'Nothing written yet'}
        </Fact>
        <Fact label="Next appointment" sub={next && `${next.clinic} · ${next.with}`}>
          {next ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>
                {next.purpose} · {formatDate(next.at)} {formatTime(next.at)}
              </span>
              {next.status === 'Today' && <CountPill tone="brand">Today</CountPill>}
            </span>
          ) : (
            'Nothing booked'
          )}
        </Fact>
      </dl>
    </SectionCard>
  )
}

/** Label over value — the same label voice as the Summary card's cells, so the two read as one. */
function Fact({ label, sub, children }: { label: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-b border-glass-hairline py-2 last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
      <dt className="text-[0.78em] font-semibold tracking-wider text-ink-2 uppercase">{label}</dt>
      <dd className="mt-0.5 line-clamp-2 text-[0.95em]">{children}</dd>
      {sub && <dd className="tabular mt-0.5 truncate text-[0.84em] text-ink-3">{sub}</dd>}
    </div>
  )
}
