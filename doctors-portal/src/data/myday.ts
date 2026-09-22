/**
 * S-06-01 · My Day — the day plan, the patient counts and the attention list.
 *
 * Everything here is DERIVED from the §8 sample-data kit and the records in
 * `clinical.ts`. Nothing is invented (§8.6), with two labelled exceptions noted
 * at their definitions: `WARD_EXTENSIONS` and the OPD cohort size.
 *
 * On the OPD count. §8.6 says "18 in clinic, 4 seen", but the §8 cast is ten
 * patients and three of them are an inpatient, a stroke transfer and an ED
 * MLC — so eighteen distinct outpatient slots cannot be filled without
 * inventing patients, which §8 forbids. The counts here are therefore the
 * cohort sizes of the MODELLED rows (OPD 7), and the figure 18 does not appear
 * on screen. The brief asks for only the numbers that mean something, so
 * dropping it is also the calmer reading.
 */

import type { ConfidenceBand } from '@/atlas/confidence'
import type { PersonaId } from '@/atlas/personas'

import {
  CLINIC_LIST,
  COSIGN_QUEUE,
  DISCHARGE_BOARD,
  INPATIENTS,
  RESULTS,
  RISK_STRIPS,
  TIMELINE,
  VITALS,
  encounter,
  ordersFor,
  timelineFor,
} from './clinical'
import { NOW, formatTime, minutesAgo } from './format'
import { patient } from './kit'
import { NETWORK_TODAY, STROKE_CASES } from './stroke'

// ═══════════════════════════════════════════════════════════ The day plan

export interface DayBlock {
  id: string
  /** The clock face, large type. */
  at: Date
  /** Ends, where the activity occupies a span rather than a moment. */
  until?: Date
  /** Medium type. Short — one or two words wherever possible. */
  title: string
  /**
   * ONE line. The brief is explicit: no long descriptions, no unnecessary
   * labels. Numbers that matter are marked up by `emphasis`.
   */
  summary: string
  /** Substrings of `summary` rendered in the priority ink rather than quietly. */
  emphasis?: { text: string; tone: 'critical' | 'warning' | 'pending' }[]
  icon: string
  /** Where tapping the block goes. */
  to: string
  /** Set where the block's summary is AI-derived, so it can carry ◆. */
  ai?: string
  band?: ConfidenceBand
}

function at(hour: number, minute = 0): Date {
  return new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), hour, minute)
}

/** The clinical day — P-04 and P-05. */
function clinicalDay(persona: PersonaId): DayBlock[] {
  const unreviewed = RESULTS.filter((r) => !r.acknowledged)
  const critical = unreviewed.filter((r) => r.critical)
  const seen = CLINIC_LIST.filter((c) => c.status === 'Seen').length
  const next = CLINIC_LIST.find((c) => c.status === 'Waiting')
  const attention = INPATIENTS.filter((r) => r.risk === 'HIGH').length
  const tele = encounter('E-118430')
  const dischargesToday = DISCHARGE_BOARD.filter((d) => d.likelihood === 'Today').length
  const canSign = persona === 'P-04'

  const blocks: DayBlock[] = [
    {
      id: 'brief',
      at: minutesAgo(70),
      title: 'AI morning brief',
      summary: `${unreviewed.length} results changed · ${critical.length} critical`,
      emphasis: [
        { text: `${unreviewed.length} results changed`, tone: 'warning' },
        { text: `${critical.length} critical`, tone: 'critical' },
      ],
      icon: 'Sunrise',
      to: '/results/inbox',
      ai: 'AI-212',
      band: 'HIGH',
    },
    {
      id: 'opd-am',
      at: at(8, 0),
      until: at(9, 0),
      title: 'OPD',
      summary: `${CLINIC_LIST.length} patients · ${seen} seen · next ${next?.token ?? '—'}`,
      icon: 'Stethoscope',
      to: '/op-queue',
    },
    {
      id: 'tele',
      at: tele.startedAt,
      title: 'Teleconsult',
      summary: `1 patient · ${tele.department}`,
      icon: 'Video',
      to: '/tele/queue',
    },
    {
      id: 'round',
      at: at(10, 30),
      title: 'Ward round',
      summary: `${INPATIENTS.length} patients · ${attention} need attention`,
      emphasis: [{ text: `${attention} need attention`, tone: 'warning' }],
      icon: 'BedDouble',
      to: '/ip/patients',
    },
    {
      id: 'cosign',
      at: at(12, 0),
      title: canSign ? 'Co-sign' : 'Awaiting co-sign',
      summary: `${COSIGN_QUEUE.length} pending`,
      emphasis: [{ text: `${COSIGN_QUEUE.length} pending`, tone: 'pending' }],
      icon: 'PenLine',
      to: '/clinician/cosign',
    },
    {
      id: 'opd-pm',
      at: at(14, 0),
      until: at(16, 0),
      title: 'OPD',
      summary: 'afternoon session',
      icon: 'Stethoscope',
      to: '/op-queue',
    },
    {
      id: 'discharge',
      at: at(16, 30),
      title: 'Discharge round',
      summary: `${dischargesToday} predicted today`,
      icon: 'DoorOpen',
      to: '/discharge/board',
      ai: 'AI-610',
      band: 'MED',
    },
  ]

  // A resident does not run a co-sign session; theirs is a wait, not a task.
  return blocks
}

/** The stroke day — P-35, P-36, P-38. */
function strokeDay(): DayBlock[] {
  const active = STROKE_CASES.filter((c) => c.status === 'active').length

  return [
    {
      id: 'brief',
      at: minutesAgo(70),
      title: 'Overnight brief',
      summary: `${NETWORK_TODAY.activations} activations · DTN median ${NETWORK_TODAY.dtnMedianMin} min`,
      icon: 'Sunrise',
      to: '/stroke/wall',
    },
    {
      id: 'stroke-review',
      at: at(8, 0),
      title: 'Stroke review',
      summary: `${active} active ${active === 1 ? 'case' : 'cases'}`,
      emphasis: [{ text: `${active} active`, tone: 'critical' }],
      icon: 'Brain',
      to: '/stroke/wall',
    },
    {
      id: 'telestroke',
      at: at(9, 30),
      title: 'Telestroke queue',
      summary: 'requests from the spokes',
      icon: 'Video',
      to: '/stroke/telestroke/queue',
    },
    {
      id: 'sites',
      at: at(11, 0),
      title: 'Spoke readiness',
      summary: '4 sites · CT and cover',
      icon: 'Network',
      to: '/stroke/network/sites',
    },
    {
      id: 'registry',
      at: at(15, 0),
      title: 'Registry',
      summary: 'mRS-90 follow-up calls',
      icon: 'ClipboardList',
      to: '/stroke/registry',
    },
  ]
}

const STROKE_PERSONAS: PersonaId[] = ['P-35', 'P-36', 'P-38']

export function dayPlanFor(persona: PersonaId): DayBlock[] {
  if (STROKE_PERSONAS.includes(persona)) return strokeDay()
  return clinicalDay(persona)
}

/** The block covering `NOW` — rendered as in progress. */
export function currentBlock(blocks: DayBlock[]): DayBlock | undefined {
  return blocks.find((b) => {
    const end = b.until ?? new Date(b.at.getTime() + 30 * 60000)
    return NOW >= b.at && NOW < end
  })
}

// ═══════════════════════════════════════════════════════ My patients — counts

export interface PatientCount {
  key: string
  label: string
  value: number
  /** Where the count opens, already narrowed. */
  to: string
  icon: string
}

/**
 * A clinic row is a follow-up where the patient's documented scenario says so,
 * or where the record already holds a prior encounter. Everything else is new.
 */
export function isFollowUp(patientId: string): boolean {
  const s = patient(patientId).scenario.toLowerCase()
  if (s.includes('follow-up') || s.includes('chronic')) return true
  return (TIMELINE[patientId]?.length ?? 0) > 0
}

export function patientCounts(persona: PersonaId): PatientCount[] {
  if (STROKE_PERSONAS.includes(persona)) {
    const active = STROKE_CASES.filter((c) => c.status === 'active')
    return [
      { key: 'active', label: 'Active', value: active.length, to: '/stroke/wall', icon: 'Brain' },
      { key: 'transfer', label: 'Transfer', value: active.filter((c) => c.originFacility !== c.destinationFacility).length, to: '/stroke/wall', icon: 'Ambulance' },
      { key: 'sites', label: 'Sites', value: 4, to: '/stroke/network/sites', icon: 'Network' },
      { key: 'registry', label: 'Follow-up', value: NETWORK_TODAY.transfers, to: '/stroke/registry', icon: 'ClipboardList' },
    ]
  }

  const icu = INPATIENTS.filter((r) => (r.bed ?? '').startsWith('ICU'))
  const ward = INPATIENTS.filter((r) => {
    const bed = r.bed ?? ''
    return bed !== '' && !bed.startsWith('ICU') && !bed.startsWith('ED')
  })

  return [
    { key: 'opd', label: 'OPD', value: CLINIC_LIST.length, to: '/op-queue', icon: 'Stethoscope' },
    { key: 'ward', label: 'Ward', value: ward.length, to: '/ip/patients?location=ward', icon: 'BedDouble' },
    { key: 'icu', label: 'ICU', value: icu.length, to: '/ip/patients?location=icu', icon: 'Activity' },
    {
      key: 'followup',
      label: 'Follow-up',
      value: CLINIC_LIST.filter((c) => isFollowUp(c.patientId)).length,
      to: '/op-queue?type=follow-up',
      icon: 'RotateCcw',
    },
  ]
}

// ══════════════════════════════════════════════ Needs my attention (3–5 max)

/** The brief's three colour rules, as a closed set. */
export type Urgency = 'critical' | 'warning' | 'pending'

export interface AttentionItem {
  id: string
  patientId: string
  urgency: Urgency
  /** Short. Two or three words — "Critical lab", "New deterioration". */
  reason: string
  /** The detail line, shown ONLY in the Quick-Panel, never on the home screen. */
  detail: string
  /** Set where the ranking or the finding is AI-derived. */
  ai?: string
  band?: ConfidenceBand
  /** Deterministic order, for the one-click reversal AI-613 requires. */
  since: Date
}

const URGENCY_ORDER: Record<Urgency, number> = { critical: 0, warning: 1, pending: 2 }

/**
 * Derived, ranked, and capped at five — "List only 3–5 items max". Anything
 * that does not make the cut is still reachable through `Review all`.
 */
export function attentionFor(persona: PersonaId, acknowledged: Record<string, unknown> = {}): AttentionItem[] {
  if (STROKE_PERSONAS.includes(persona)) {
    return STROKE_CASES.filter((c) => c.status === 'active').map((c) => ({
      id: `stroke-${c.id}`,
      patientId: c.patientId,
      urgency: 'critical' as Urgency,
      reason: 'Active stroke case',
      detail: `${c.caseNo} · ${c.originFacility} → ${c.destinationFacility}`,
      ai: 'AI-209',
      band: 'HIGH' as ConfidenceBand,
      since: minutesAgo(34),
    }))
  }

  const items: AttentionItem[] = []

  // 🔴 A critical value that no named clinician has answered for yet.
  for (const r of RESULTS) {
    if (!r.critical || r.acknowledged || acknowledged[r.id]) continue
    items.push({
      id: `result-${r.id}`,
      patientId: r.patientId,
      urgency: 'critical',
      reason: 'Critical lab',
      detail: `${r.test} ${r.value} ${r.unit} · ${r.delta ?? 'no prior'} · unacknowledged ${r.unackMinutes ?? 0} min`,
      ai: 'AI-212',
      band: r.band,
      since: r.reportedAt,
    })
  }

  // 🟠 Deterioration the model is confident about.
  for (const row of INPATIENTS) {
    if (row.risk !== 'HIGH') continue
    if (items.some((i) => i.patientId === row.patientId)) continue
    const strip = RISK_STRIPS[row.patientId]
    items.push({
      id: `risk-${row.patientId}`,
      patientId: row.patientId,
      urgency: 'warning',
      reason: 'New deterioration',
      detail: `${strip?.score ?? row.reason} · ${strip?.trend ?? ''} · ${row.bed}`.trim(),
      ai: 'AI-201',
      band: 'HIGH',
      since: row.chronologicalAt,
    })
  }

  // 🟡 A model that cannot score, saying so — never a zero (§4.5).
  for (const row of INPATIENTS) {
    if (row.risk !== 'ABSTAIN') continue
    items.push({
      id: `abstain-${row.patientId}`,
      patientId: row.patientId,
      urgency: 'pending',
      reason: 'Cannot assess',
      detail: row.abstainReason ?? 'Not enough charted data to score.',
      ai: 'AI-201',
      since: row.chronologicalAt,
    })
  }

  // 🟡 A note waiting on a signature.
  for (const cs of COSIGN_QUEUE) {
    if (items.some((i) => i.patientId === cs.patientId)) continue
    items.push({
      id: `cosign-${cs.id}`,
      patientId: cs.patientId,
      urgency: 'pending',
      reason: 'Co-sign waiting',
      detail: `${cs.documentKind} by ${cs.authoredByPersona}`,
      since: cs.authoredAt,
    })
  }

  return items
    .sort((a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency] || b.since.getTime() - a.since.getTime())
    .slice(0, 5)
}

/** The reversal AI-613's guardrail requires: newest first, no model involved. */
export function attentionChronological(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => b.since.getTime() - a.since.getTime())
}

// ═════════════════════════════════════════════ The card / delta wire contract

export type DeltaType = 'timer' | 'lab-critical' | 'imaging' | 'vitals' | 'med' | 'note'

/** Server-side priority, so the client stays light. */
const DELTA_PRIORITY: Record<DeltaType, number> = {
  timer: 0,
  'lab-critical': 1,
  imaging: 2,
  vitals: 3,
  med: 4,
  note: 5,
}

export interface Delta {
  type: DeltaType
  /** The card token — "BP 170/98 ↑", "CT ▲". Short. */
  shortLabel: string
  /** The Quick-Panel line. */
  label: string
  icon: string
  /** ISO. */
  ts: string
  value?: string
  priority: number
  /** Only the Quick-Panel reads these. */
  detail?: string
  trend?: { at: Date; value: number }[]
  ai?: string
}

/**
 * The payload shape as specified, in snake_case because it IS the wire format.
 * `status_color_hex` is carried for contract fidelity, but the UI resolves its
 * token from `status_category` and never reads the hex — otherwise the theme
 * toggle could not repaint it.
 */
export interface MyDayCard {
  patient_id: string
  name: string
  mrn: string
  room: string
  scheduled_time: string
  status_category: 'critical' | 'moderate' | 'normal' | 'routine'
  status_color_hex: string
  lastSeenByClinician: string
  /** Pre-ordered by priority by the server. */
  delta_summary: Delta[]
  active_timers: { name: string; expires: string }[]
  /**
   * Left undefined for every patient. The §8 cast carries no photographs and
   * SD-P-08 is an unidentified MLC patient; inventing patient faces for a
   * mockup is a liability, not a feature.
   */
  thumbnail_url?: string
  quick_actions: { markSeen: string; openChart: string; callNurse: string }
}

export const STATUS_HEX: Record<MyDayCard['status_category'], string> = {
  critical: '#D64545',
  moderate: '#E6A23C',
  normal: '#3A8DFF',
  routine: '#FFFFFF',
}

/**
 * §8 carries no telephone numbers. These exist so the `tel:` affordance is real
 * and testable on a phone; they are NOT part of the sample data kit.
 */
const WARD_EXTENSIONS: Record<string, string> = {
  '4B': '+918049001042',
  '2A': '+918049001021',
  'ICU-1': '+918049001101',
  ED: '+918049001911',
}

function extensionFor(bed: string | null): string {
  if (!bed) return '+918049001000'
  const ward = bed.split('-').slice(0, bed.startsWith('ICU') ? 2 : 1).join('-')
  return WARD_EXTENSIONS[ward] ?? '+918049001000'
}

/**
 * Every delta the record holds for a patient, newest-relevant first. The caller
 * passes `since` — the moment this clinician last saw them — and anything older
 * is not a change.
 */
export function deltasFor(patientId: string, since: Date): Delta[] {
  const out: Delta[] = []

  for (const r of RESULTS) {
    if (r.patientId !== patientId || r.acknowledged) continue
    if (r.flag === 'Normal') continue
    out.push({
      type: r.critical ? 'lab-critical' : 'vitals',
      shortLabel: `${r.test.replace('Serum ', '')} ${r.flag.startsWith('↑') ? '↑' : '↓'}`,
      label: `${r.test} ${r.value} ${r.unit}`,
      icon: r.critical ? 'TriangleAlert' : 'FlaskConical',
      ts: r.reportedAt.toISOString(),
      value: `${r.value} ${r.unit}`,
      priority: DELTA_PRIORITY[r.critical ? 'lab-critical' : 'vitals'],
      detail: `${r.delta ?? 'no prior value'} · reference ${r.refRange}`,
      ai: 'AI-212',
    })
  }

  const vitals = VITALS[patientId] ?? []
  const abnormal = vitals.filter((v) => v.flag !== 'Normal')
  if (abnormal.length > 0) {
    const worst = abnormal[0]
    out.push({
      type: 'vitals',
      shortLabel: `${worst.label.split(' ')[0]} ${worst.flag.startsWith('↑') ? '↑' : '↓'}`,
      label: `${worst.label} ${worst.value}`,
      icon: 'HeartPulse',
      ts: worst.at.toISOString(),
      value: worst.value,
      priority: DELTA_PRIORITY.vitals,
      detail: `${abnormal.length} of ${vitals.length} observations outside range at ${formatTime(worst.at)}`,
    })
  }

  for (const e of timelineFor(patientId)) {
    if (e.kind === 'imaging') {
      out.push({
        type: 'imaging',
        shortLabel: 'Imaging ▲',
        label: e.label,
        icon: 'Image',
        ts: e.at.toISOString(),
        priority: DELTA_PRIORITY.imaging,
        detail: e.detail,
        ai: e.ai,
      })
    } else if (e.kind === 'medication') {
      out.push({
        type: 'med',
        shortLabel: 'Med +',
        label: e.label,
        icon: 'Pill',
        ts: e.at.toISOString(),
        priority: DELTA_PRIORITY.med,
        detail: e.detail,
      })
    } else if (e.kind === 'note') {
      out.push({
        type: 'note',
        shortLabel: 'Note',
        label: e.label,
        icon: 'FileText',
        ts: e.at.toISOString(),
        priority: DELTA_PRIORITY.note,
        detail: e.detail,
      })
    }
  }

  const chasing = ordersFor(patientId).filter((o) => o.chase)
  if (chasing.length > 0) {
    out.push({
      type: 'timer',
      shortLabel: 'Overdue',
      label: chasing[0].item,
      icon: 'Clock',
      ts: chasing[0].placedAt.toISOString(),
      priority: DELTA_PRIORITY.timer,
      detail: chasing[0].chase,
      ai: 'AI-308',
    })
  }

  return out
    .filter((d) => new Date(d.ts) > since)
    .sort((a, b) => a.priority - b.priority || new Date(b.ts).getTime() - new Date(a.ts).getTime())
}

/** The last note on the record, with the author's initials. */
export function lastNoteFor(patientId: string): { label: string; detail: string; by: string; initials: string; at: Date } | undefined {
  const e = timelineFor(patientId).find((x) => x.kind === 'note' || x.kind === 'ai' || x.kind === 'result')
  if (!e) return undefined
  const initials = e.by
    .replace(/^(Dr|Sr\.?|Mr|Ms)\s+/, '')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
  return { label: e.label, detail: e.detail, by: e.by, initials, at: e.at }
}

export function cardFor(patientId: string, lastSeen: Date, urgency: Urgency): MyDayCard {
  const p = patient(patientId)
  const row = INPATIENTS.find((r) => r.patientId === patientId)
  const clinic = CLINIC_LIST.find((c) => c.patientId === patientId)
  const bed = row?.bed ?? p.bed
  const category: MyDayCard['status_category'] =
    urgency === 'critical' ? 'critical' : urgency === 'warning' ? 'moderate' : 'normal'

  return {
    patient_id: patientId,
    name: `${p.name} (${p.sex}/${p.age})`,
    mrn: p.uhid,
    room: bed ?? 'outpatient',
    scheduled_time: (clinic?.bookedAt ?? row?.chronologicalAt ?? NOW).toISOString(),
    status_category: category,
    status_color_hex: STATUS_HEX[category],
    lastSeenByClinician: lastSeen.toISOString(),
    delta_summary: deltasFor(patientId, lastSeen),
    active_timers: [],
    quick_actions: {
      markSeen: `POST /api/patients/${patientId}/seen`,
      openChart: `/patient/${p.uhid}/chart`,
      callNurse: `tel:${extensionFor(bed)}`,
    },
  }
}

/**
 * When this clinician last saw a patient. The store overrides it once they mark
 * someone seen; until then it is derived from the record — the last entry this
 * clinician authored, or the start of the shift.
 */
export function derivedLastSeen(patientId: string): Date {
  const mine = timelineFor(patientId).find((e) => e.by.startsWith('Dr Ananya'))
  return mine?.at ?? minutesAgo(70)
}
