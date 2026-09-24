/**
 * S-06-17 · Appointments — `/patient/:id/appointments` · T2 · ARC-02
 *
 * "When the patient is next due, what to prepare, and every visit before."
 *
 * The next appointment is the whole top of the screen — date, place, who with,
 * what for, and what to bring — because that is what gets read out to a
 * patient at the end of a visit. Everything else is a quiet list.
 */

import { CountPill, SectionCard } from '@/components/calm'
import { Chip, EmptyState, Icon, cx } from '@/components/primitives'
import { formatDateLong, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { appointmentsFor, nextAppointment } from '@/data/record'
import type { Appointment } from '@/data/record'

import { RecordScreen } from './shared'

const STATUS_TONE: Record<Appointment['status'], 'brand' | 'normal' | 'neutral' | 'abnormal'> = {
  Today: 'brand',
  Booked: 'normal',
  Completed: 'neutral',
  Missed: 'abnormal',
}

const KIND_ICON: Record<Appointment['kind'], string> = {
  'Follow-up': 'Stethoscope',
  Review: 'Eye',
  Procedure: 'Syringe',
  Investigation: 'FlaskConical',
  Teleconsult: 'Video',
  Transfer: 'Ambulance',
}

export function S0617({ id }: { id?: string }) {
  return (
    <RecordScreen id={id} section="appointments">
      {(p) => <Appointments patient={p} />}
    </RecordScreen>
  )
}

function Appointments({ patient: p }: { patient: Patient }) {
  const all = appointmentsFor(p.id)
  const next = nextAppointment(p.id)
  const upcoming = all.filter((a) => a !== next && (a.status === 'Booked' || a.status === 'Today'))
  const past = all.filter((a) => a.status === 'Completed' || a.status === 'Missed').reverse()

  return (
    <>
      {next ? (
        <section className="glass-strong rounded-card border-l-4 border-l-brand px-5 py-4">
          <p className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">Next appointment</p>
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-field bg-brand-soft text-brand">
              <Icon name={KIND_ICON[next.kind]} size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="tabular text-xl font-bold tracking-tight">
                {next.status === 'Today' ? 'Today' : formatDateLong(next.at)} · {formatTime(next.at)}
              </p>
              <p className="mt-0.5 font-medium">{next.purpose}</p>
              <p className="mt-0.5 text-ink-2">
                {next.clinic} · {next.with}
                {next.location ? ` · ${next.location}` : ''}
              </p>
            </div>
            <Chip tone={STATUS_TONE[next.status]}>{next.kind}</Chip>
          </div>
          {next.prepare && next.prepare.length > 0 && (
            <div className="mt-3 rounded-panel bg-glass-inset px-3.5 py-2.5">
              <p className="text-[0.8em] font-bold tracking-[0.08em] text-ink-3 uppercase">Before this visit</p>
              <ul className="mt-1.5 space-y-1">
                {next.prepare.map((x) => (
                  <li key={x} className="flex items-start gap-2 text-[0.92em] text-ink-2">
                    <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <SectionCard title="Next appointment">
          <EmptyState icon="CalendarCheck" why={`Nothing is booked for ${p.name}. A follow-up booked at the end of a visit would appear here.`} />
        </SectionCard>
      )}

      {upcoming.length > 0 && (
        <SectionCard title="Also booked" meta={<CountPill>{upcoming.length}</CountPill>}>
          <ul className="divide-y divide-glass-hairline">
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="Earlier visits" meta={<CountPill>{past.length}</CountPill>}>
        {past.length === 0 ? (
          <EmptyState icon="History" why="No earlier visits are on this record — this is the first." />
        ) : (
          <ul className="divide-y divide-glass-hairline">
            {past.map((a) => (
              <AppointmentRow key={a.id} a={a} />
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  )
}

function AppointmentRow({ a }: { a: Appointment }) {
  return (
    <li className="flex flex-wrap items-start gap-3 px-2 py-3 sm:px-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-field bg-glass-inset text-ink-2">
        <Icon name={KIND_ICON[a.kind]} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{a.purpose}</span>
        <span className="block text-[0.9em] text-ink-2">
          {a.clinic} · {a.with}
        </span>
        {a.prepare && a.prepare.length > 0 && (
          <span className="block text-[0.86em] text-ink-3">Before: {a.prepare.join(' · ')}</span>
        )}
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className={cx('tabular text-[0.9em]', a.status === 'Completed' ? 'text-ink-3' : 'font-semibold')}>
          {a.status === 'Today' ? 'Today' : formatDateLong(a.at)} · {formatTime(a.at)}
        </span>
        <Chip tone={STATUS_TONE[a.status]}>{a.status}</Chip>
      </span>
    </li>
  )
}
