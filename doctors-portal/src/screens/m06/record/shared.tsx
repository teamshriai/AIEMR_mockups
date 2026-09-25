/**
 * What the seven patient-record screens (S-06-11 … S-06-17) share: resolving
 * the patient from the route, the one-line sub-navigation between the parts,
 * and the counts each tile and tab shows.
 *
 * The sub-navigation is the reason the parts can live on separate screens
 * without anyone getting lost: every part is one tap from every other, and
 * "Overview" is always the way back to the one-page record.
 */

import { useNavigate } from 'react-router-dom'

import { PillTabs } from '@/components/calm'
import { Card, EmptyState } from '@/components/primitives'
import { encounterForPatient, problemsFor, resultsFor } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import { patientByAnyId } from '@/data/kit'
import type { Patient } from '@/data/kit'
import type { ConditionStatus } from '@/data/record'
import {
  activeMedicines,
  appointmentsFor,
  conditionFor,
  nextAppointment,
  pastNotesFor,
  prescriptionsFor,
  reportsFor,
} from '@/data/record'
import { useClinical } from '@/store/clinical'
import type { VoiceNote } from '@/store/clinical'
import { Screen } from '@/shell/Screen'

export type RecordSection = 'record' | 'condition' | 'results' | 'reports' | 'notes' | 'prescriptions' | 'appointments'

/** `label` titles a tile; `short` names the tab, so the seven fit on one line. */
export const SECTION_META: Record<RecordSection, { label: string; short: string; icon: string; path: string; screenId: string }> = {
  record: { label: 'Overview', short: 'Overview', icon: 'BookOpen', path: 'record', screenId: 'S-06-11' },
  condition: { label: 'Current condition', short: 'Condition', icon: 'HeartPulse', path: 'condition', screenId: 'S-06-15' },
  results: { label: 'Test results', short: 'Results', icon: 'FlaskConical', path: 'results', screenId: 'S-06-13' },
  reports: { label: 'Previous reports', short: 'Reports', icon: 'ScrollText', path: 'reports', screenId: 'S-06-12' },
  notes: { label: 'Saved notes', short: 'Notes', icon: 'FileText', path: 'notes', screenId: 'S-06-14' },
  prescriptions: { label: 'Prescriptions', short: 'Medicines', icon: 'Pill', path: 'prescriptions', screenId: 'S-06-16' },
  appointments: { label: 'Appointments', short: 'Appointments', icon: 'CalendarCheck', path: 'appointments', screenId: 'S-06-17' },
}

const ORDER: RecordSection[] = ['record', 'condition', 'results', 'reports', 'notes', 'prescriptions', 'appointments']

/** The chip tone for a condition status — brand for stable, clinical hues for the rest. */
export const STATUS_TONE: Record<ConditionStatus, 'critical' | 'abnormal' | 'caution' | 'normal' | 'brand'> = {
  Critical: 'critical',
  Deteriorating: 'abnormal',
  Stable: 'brand',
  Improving: 'normal',
  Recovered: 'normal',
}

export function recordPath(p: Patient, section: RecordSection): string {
  return `/patient/${p.uhid}/${SECTION_META[section].path}`
}

/** The patient's dictated notes, newest first. */
export function useVoiceNotesFor(patientId: string): VoiceNote[] {
  const voiceNotes = useClinical((s) => s.voiceNotes)
  return (voiceNotes[patientId] ?? []).slice().sort((a, b) => b.at.localeCompare(a.at))
}

/** Notes written on this patient's encounters in this session, signed or draft. */
export function useSessionNotesFor(patientId: string) {
  const notes = useClinical((s) => s.notes)
  const enc = encounterForPatient(patientId)
  const record = enc ? notes[enc.id] : undefined
  const hasText = record && Object.values(record.text).some((t) => t.trim() !== '')
  return enc && record && hasText ? [{ encounter: enc, record }] : []
}

/** One count per part, for the tiles and the sub-navigation. */
export function useSectionCounts(p: Patient): Record<Exclude<RecordSection, 'record'>, number> {
  const voice = useVoiceNotesFor(p.id)
  const session = useSessionNotesFor(p.id)
  return {
    condition: problemsFor(p.id).length,
    results: resultsFor(p.id).length,
    reports: reportsFor(p.id).length,
    notes: pastNotesFor(p.id).length + voice.length + session.length,
    prescriptions: activeMedicines(p.id).length,
    appointments: appointmentsFor(p.id).length,
  }
}

/** The quiet sub-navigation under the patient banner. */
export function RecordNav({ patient, current }: { patient: Patient; current: RecordSection }) {
  const navigate = useNavigate()
  const counts = useSectionCounts(patient)
  return (
    <PillTabs
      ariaLabel={`Parts of ${patient.name}’s record`}
      value={current}
      className="max-w-full"
      options={ORDER.map((key) => ({
        key,
        label: SECTION_META[key].short,
        icon: SECTION_META[key].icon,
        count: key === 'record' ? undefined : counts[key],
      }))}
      onChange={(key) => navigate(recordPath(patient, key))}
    />
  )
}

/**
 * The frame every record sub-screen uses: banner, the sub-navigation, then the
 * one part. An unknown id says so instead of silently showing someone else.
 */
export function RecordScreen({
  id,
  section,
  subheading,
  actions,
  children,
}: {
  id?: string
  section: RecordSection
  subheading?: (p: Patient) => React.ReactNode
  actions?: (p: Patient) => React.ReactNode
  children: (p: Patient) => React.ReactNode
}) {
  const p = patientByAnyId(id)
  const meta = SECTION_META[section]
  if (!p) {
    return (
      <Screen screenId={meta.screenId} subheading="No patient at this address.">
        <Card className="max-w-2xl">
          <EmptyState
            icon="UserX"
            why={`There is no patient with the id “${id ?? ''}” in this sample record. Search with / to find the patient you meant.`}
          />
        </Card>
      </Screen>
    )
  }
  return (
    <Screen
      screenId={meta.screenId}
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF']}
      subheading={subheading?.(p) ?? defaultSubheading(p)}
      actions={actions?.(p)}
    >
      <div className="space-y-5">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <RecordNav patient={p} current={section} />
        </div>
        {children(p)}
      </div>
    </Screen>
  )
}

function defaultSubheading(p: Patient): string {
  const next = nextAppointment(p.id)
  const condition = conditionFor(p.id)
  const bits = [`${p.age}/${p.sex}`, condition?.headline ?? p.scenario]
  if (next) bits.push(`next: ${next.purpose.toLowerCase()} ${formatDate(next.at)} ${formatTime(next.at)}`)
  return bits.join(' · ')
}

/** Latest prescription date, for a tile line. */
export function lastPrescribed(p: Patient): Date | undefined {
  return prescriptionsFor(p.id)[0]?.at
}
