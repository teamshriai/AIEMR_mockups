/**
 * S-06-11 · Patient record — `/patient/:id/record` · T2 · ARC-20
 *
 * "Everything on file for one patient, one tile per part — opened only when
 * asked."
 *
 * A follow-up patient's history is six different things — how they are now,
 * their results, their reports, what was written, what they take, when they
 * are due — and a screen that shows all six at once shows none of them well.
 * So this screen shows only the headline of each, as a tile, and each tile
 * opens a screen of its own. Nothing is expanded by default.
 */

import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { CountPill } from '@/components/calm'
import { PatientRecordLinks } from '@/components/recordlinks'
import { Button, Chip, Icon, cx } from '@/components/primitives'
import { encounterForPatient, resultsFor } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import {
  activeMedicines,
  conditionFor,
  nextAppointment,
  pastNotesFor,
  reportsFor,
} from '@/data/record'
import type { ConditionStatus } from '@/data/record'
import { selectAiActive, useAI } from '@/store/ai'

import { RecordScreen, SECTION_META, recordPath, useSectionCounts, useSessionNotesFor, useVoiceNotesFor } from './shared'
import type { RecordSection } from './shared'

export const STATUS_TONE: Record<ConditionStatus, 'critical' | 'abnormal' | 'caution' | 'normal' | 'brand'> = {
  Critical: 'critical',
  Deteriorating: 'abnormal',
  Stable: 'brand',
  Improving: 'normal',
  Recovered: 'normal',
}

/** Where "start the consultation" goes, by the kind of encounter the patient has. */
export function consultPath(p: Patient): string | undefined {
  const enc = encounterForPatient(p.id)
  if (!enc) return undefined
  return enc.type === 'IP' ? `/ip/encounter/${enc.id}/note` : `/encounter/${enc.id}/note`
}

export function S0611({ id }: { id?: string }) {
  return (
    <RecordScreen
      id={id}
      section="record"
      actions={(p) => <HubActions patient={p} />}
    >
      {(p) => <Hub patient={p} />}
    </RecordScreen>
  )
}

function HubActions({ patient: p }: { patient: Patient }) {
  const navigate = useNavigate()
  const consult = consultPath(p)
  return (
    <>
      <Button icon="History" onClick={() => navigate(`/patient/${p.uhid}/timeline`)}>
        Timeline
      </Button>
      {consult && (
        <Button tone="primary" icon="Stethoscope" onClick={() => navigate(consult)}>
          {encounterForPatient(p.id)?.type === 'IP' ? 'Write progress note' : 'Start consultation'}
        </Button>
      )}
    </>
  )
}

function Hub({ patient: p }: { patient: Patient }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const counts = useSectionCounts(p)
  const condition = conditionFor(p.id)
  const next = nextAppointment(p.id)
  const results = resultsFor(p.id)
  const abnormal = results.filter((r) => r.flag !== 'Normal')
  const toReview = results.filter((r) => !r.acknowledged)
  const reports = reportsFor(p.id)
  const meds = activeMedicines(p.id)
  const voice = useVoiceNotesFor(p.id)
  const session = useSessionNotesFor(p.id)
  const past = pastNotesFor(p.id)
  const drafts = voice.filter((n) => n.status === 'draft').length

  const lastNote = voice[0]
    ? { text: voice[0].body, when: new Date(voice[0].at), by: voice[0].by, dictated: true }
    : past[0]
      ? { text: `${past[0].kind} — ${past[0].assessment}`, when: past[0].at, by: past[0].by, dictated: false }
      : undefined

  const tiles: { section: Exclude<RecordSection, 'record'>; line: React.ReactNode; badge?: React.ReactNode }[] = [
    {
      section: 'condition',
      line: condition ? condition.headline : 'No condition summary yet',
      badge: condition && <Chip tone={STATUS_TONE[condition.status]}>{condition.status}</Chip>,
    },
    {
      section: 'results',
      line:
        results.length === 0
          ? 'No results on the record'
          : `${results[0].test} ${results[0].value}${results[0].unit ? ` ${results[0].unit}` : ''} · ${formatDate(results[0].reportedAt)}`,
      badge:
        toReview.length > 0 ? (
          <CountPill tone="pending">{toReview.length} to review</CountPill>
        ) : abnormal.length > 0 ? (
          <CountPill>{abnormal.length} abnormal</CountPill>
        ) : undefined,
    },
    {
      section: 'reports',
      line: reports[0] ? `${reports[0].title} · ${formatDate(reports[0].at)}` : 'No reports on the record',
    },
    {
      section: 'notes',
      line: lastNote
        ? `${lastNote.dictated ? 'Dictated' : 'Last'} · ${formatDate(lastNote.when)} — ${lastNote.text}`
        : session.length > 0
          ? 'Today’s note in progress'
          : 'Nothing written yet',
      badge: drafts > 0 ? <CountPill tone="pending">{drafts} to sign</CountPill> : undefined,
    },
    {
      section: 'prescriptions',
      line: meds.length > 0 ? meds.slice(0, 3).map((m) => `${m.drug} ${m.dose}`).join(' · ') : 'Nothing current',
    },
    {
      section: 'appointments',
      line: next ? `${next.purpose} · ${formatDate(next.at)} ${formatTime(next.at)}` : 'Nothing booked',
      badge: next?.status === 'Today' ? <CountPill tone="brand">Today</CountPill> : undefined,
    },
  ]

  return (
    <>
      {/* The one thing to know before opening anything. */}
      {condition && (
        <button
          type="button"
          onClick={() => navigate(recordPath(p, 'condition'))}
          className="glass-strong lift flex w-full flex-col gap-2 rounded-card px-5 py-4 text-left sm:flex-row sm:items-center sm:gap-5"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <Chip tone={STATUS_TONE[condition.status]}>{condition.status}</Chip>
              <span className="font-semibold tracking-tight">{condition.headline}</span>
            </span>
            {aiActive && (
              <span className="flex items-start gap-1.5 text-[0.92em] text-ink-2">
                <Diamond size={10} className="mt-1 shrink-0" />
                {condition.ai.text}
              </span>
            )}
          </span>
          {next && (
            <span className="flex shrink-0 items-center gap-2 text-[0.9em] text-ink-2">
              <Icon name="CalendarCheck" size={15} className="text-ink-3" />
              <span className="tabular">
                Next: {next.status === 'Today' ? `today ${formatTime(next.at)}` : `${formatDate(next.at)}`}
              </span>
            </span>
          )}
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tiles.map((t) => {
          const meta = SECTION_META[t.section]
          const count = counts[t.section]
          return (
            <button
              key={t.section}
              type="button"
              onClick={() => navigate(recordPath(p, t.section))}
              className={cx(
                'glass-strong lift group flex min-h-36 flex-col justify-between gap-3 rounded-card p-4 text-left',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              )}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-field bg-brand-soft text-brand">
                    <Icon name={meta.icon} size={17} />
                  </span>
                  <span className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">{meta.label}</span>
                </span>
                <span className="tabular text-2xl leading-none font-bold tracking-tight">{count}</span>
              </span>
              <span className="line-clamp-2 text-[0.92em] text-ink-2">{t.line}</span>
              <span className="flex items-center justify-between gap-2">
                <span>{t.badge}</span>
                <span className="inline-flex items-center gap-1 text-[0.86em] font-semibold text-brand">
                  Open
                  <Icon name="ChevronRight" size={13} />
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <PatientRecordLinks patient={p} exclude={['record', 'results', 'reports']} label="Also open" />
    </>
  )
}
