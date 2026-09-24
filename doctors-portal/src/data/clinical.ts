/**
 * Clinical records derived from the §8 cast. Every value traces to a screen
 * spec's "Sample data" line — nothing here is invented (§8.6).
 *
 * The three that carry the demo:
 *   S-06-01  "SD-S-01 at 08:40 — 18 in clinic, 6 inpatients (SD-P-03 risk
 *             HIGH), 3 results to review, 2 co-signs pending."
 *   S-06-03  "SD-P-01 thyroid follow-up with SD-S-01; four sections drafted,
 *             one at MED confidence."
 *   S-06-07  "SD-P-03, documented penicillin allergy, co-amoxiclav 1.2g IV
 *             proposed → hard stop, three alternatives offered."
 */

import type { ConfidenceBand } from '@/atlas/confidence'
import type { Gate } from '@/atlas/gates'

import { minutesAgo, minutesAhead, NOW } from './format'

// ───────────────────────────────────────────────────────────────── Encounters

export type EncounterType = 'OP' | 'IP' | 'ED' | 'TELE'

export interface Encounter {
  id: string
  /** M-06.8 — display format `OP/{fy}/{seq}`. FY 26-27. */
  encounterNo: string
  patientId: string
  type: EncounterType
  startedAt: Date
  consultantStaffId: string
  department: string
  /** OP queue token, where there is one. */
  token?: string
  ward?: string
}

export const ENCOUNTERS: Encounter[] = [
  {
    id: 'E-118402',
    encounterNo: 'OP/26-27/118402',
    patientId: 'SD-P-01',
    type: 'OP',
    startedAt: minutesAgo(6),
    consultantStaffId: 'SD-S-01',
    department: 'General Medicine',
    token: 'MED-042',
  },
  {
    id: 'E-118366',
    encounterNo: 'IP/26-27/118366',
    patientId: 'SD-P-03',
    type: 'IP',
    startedAt: new Date(2026, 8, 17, 14, 20),
    consultantStaffId: 'SD-S-01',
    department: 'General Medicine',
    ward: '4B',
  },
  {
    id: 'E-118201',
    encounterNo: 'IP/26-27/118201',
    patientId: 'SD-P-07',
    type: 'IP',
    startedAt: new Date(2026, 8, 15, 3, 10),
    consultantStaffId: 'SD-S-01',
    department: 'Critical Care',
    ward: 'ICU-1',
  },
  {
    id: 'E-118380',
    encounterNo: 'IP/26-27/118380',
    patientId: 'SD-P-02',
    type: 'IP',
    startedAt: new Date(2026, 8, 19, 9, 0),
    consultantStaffId: 'SD-S-01',
    department: 'Cardiothoracic Surgery',
    ward: '2A',
  },
  {
    id: 'E-118421',
    encounterNo: 'ED/26-27/118421',
    patientId: 'SD-P-05',
    type: 'ED',
    startedAt: minutesAgo(34),
    consultantStaffId: 'SD-S-03',
    department: 'Emergency',
    ward: 'ED',
  },
  {
    id: 'E-118430',
    encounterNo: 'OP/26-27/118430',
    patientId: 'SD-P-10',
    type: 'TELE',
    startedAt: minutesAhead(25),
    consultantStaffId: 'SD-S-01',
    department: 'Dermatology',
  },
  {
    id: 'E-118412',
    encounterNo: 'ED/26-27/118412',
    patientId: 'SD-P-08',
    type: 'ED',
    startedAt: minutesAgo(95),
    consultantStaffId: 'SD-S-01',
    department: 'Emergency',
    ward: 'ED',
  },
]

const encountersById = new Map(ENCOUNTERS.map((e) => [e.id, e]))

export function encounter(id: string): Encounter {
  const e = encountersById.get(id)
  if (!e) throw new Error(`Unknown encounter ${id}`)
  return e
}

export function maybeEncounter(id: string | undefined): Encounter | undefined {
  return id ? encountersById.get(id) : undefined
}

export function encounterForPatient(patientId: string): Encounter | undefined {
  return ENCOUNTERS.find((e) => e.patientId === patientId)
}

// ─────────────────────────────────────────── Note sections (AIP-01 ghost text)

export type SectionKey = 'subjective' | 'objective' | 'assessment' | 'plan'

export interface NoteSectionSeed {
  key: SectionKey
  label: string
  /** Which capability drafted it. */
  ai: string
  gate: Gate
  /** The ghost text, as the model produced it. */
  draft: string
  confidence: number
  band: ConfidenceBand
  /**
   * AI-101's explainability is stronger than the default: "the transcript span
   * behind each sentence". This is what the Why? drawer shows.
   */
  transcriptSpan: string
  /** C-42 panel 2 — "What it used", each clickable back to its source record. */
  inputs: { label: string; source: string }[]
}

/**
 * S-06-03 · SD-P-01 thyroid follow-up with SD-S-01.
 * Four sections drafted, one at MED confidence — drawn expanded and unselected
 * per §4.5, because MED must never arrive pre-selected.
 */
export const NOTE_DRAFT_SD_P_01: NoteSectionSeed[] = [
  {
    key: 'subjective',
    label: 'Subjective',
    ai: 'AI-101',
    gate: 'G2',
    draft:
      'Attends for routine review of primary hypothyroidism, diagnosed 2019. Reports good adherence to levothyroxine 75 mcg once daily on an empty stomach. Fatigue has improved substantially since the last visit; no cold intolerance, constipation or hoarseness. Weight stable. Menstrual cycles regular. No palpitations, tremor or heat intolerance to suggest over-replacement.',
    confidence: 0.93,
    band: 'HIGH',
    transcriptSpan:
      '"…so the tiredness is much better than last time, I take the tablet first thing before breakfast, never missed it…"',
    inputs: [
      { label: 'Dictated transcript, 06:12 of session', source: 'AI-101 session 08:34' },
      { label: 'Prior consultation 14-Mar-2026', source: 'NOTE/117204/01' },
      { label: 'Active medication list', source: 'RX/25-26/498210' },
    ],
  },
  {
    key: 'objective',
    label: 'Objective',
    ai: 'AI-103',
    gate: 'G2',
    draft:
      'Alert, comfortable. Pulse 76 regular, BP 118/74, temperature 36.8 °C, SpO₂ 99% on air, weight 58 kg. No periorbital puffiness. Thyroid not palpably enlarged, no nodule, no bruit. Reflexes normal with no delayed relaxation phase. Cardiovascular and respiratory examination unremarkable.',
    confidence: 0.88,
    band: 'HIGH',
    transcriptSpan: '"…pulse is seventy-six, pressure one-eighteen over seventy-four, no goitre…"',
    inputs: [
      { label: 'Vitals captured 08:31 by Sr. Lalitha Raman', source: 'Vitals 21-Sep-2026 08:31' },
      { label: 'Dictated transcript, 09:40 of session', source: 'AI-101 session 08:34' },
    ],
  },
  {
    /**
     * The MED-confidence section. §4.5: delivered expanded with NO
     * pre-selection. The drawing note for S-06-03 asks for exactly one.
     */
    key: 'assessment',
    label: 'Assessment',
    ai: 'AI-103',
    gate: 'G2',
    draft:
      'Primary hypothyroidism, clinically and biochemically euthyroid on the current dose. TSH 2.4 mIU/L on 18-Sep-2026, within target. Symptom improvement is consistent with adequate replacement rather than a dose change being required.',
    confidence: 0.71,
    band: 'MED',
    transcriptSpan: '"…I think she is euthyroid now, the TSH came back at two point four…"',
    inputs: [
      { label: 'TSH 2.4 mIU/L, 18-Sep-2026', source: 'Result R-88210' },
      { label: 'Free T4 14.2 pmol/L, 18-Sep-2026', source: 'Result R-88211' },
      { label: 'Dictated transcript, 11:02 of session', source: 'AI-101 session 08:34' },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    ai: 'AI-103',
    gate: 'G2',
    draft:
      'Continue levothyroxine 75 mcg once daily, unchanged. Repeat TSH and free T4 in six months. Advised to maintain a consistent four-hour gap from calcium and iron supplements. Review in six months, or sooner if symptoms recur. Written instructions issued in English and Kannada.',
    confidence: 0.9,
    band: 'HIGH',
    transcriptSpan: '"…keep the same dose, repeat thyroid function in six months, see me then…"',
    inputs: [
      { label: 'Current medication list', source: 'RX/25-26/498210' },
      { label: 'Departmental follow-up interval protocol', source: 'Endocrine SOP v3.1' },
    ],
  },
]

/** S-08-04 · SD-P-03 ward-round note, drafted by the AI-102 round scribe. */
export const NOTE_DRAFT_SD_P_03: NoteSectionSeed[] = [
  {
    key: 'subjective',
    label: 'Subjective',
    ai: 'AI-102',
    gate: 'G2',
    draft:
      'Day 4 of admission for community-acquired pneumonia. Breathlessness worse overnight; required increased oxygen from 2 L to 4 L via nasal cannula at 04:20. Productive cough continues with rust-coloured sputum. Slept poorly. Appetite poor, taking only sips.',
    confidence: 0.89,
    band: 'HIGH',
    transcriptSpan: '"…he was more breathless from about four this morning, nurses went up to four litres…"',
    inputs: [
      { label: 'Nursing note 04:25', source: 'Nursing 21-Sep-2026 04:25' },
      { label: 'Oxygen delivery record', source: 'Flowsheet 21-Sep-2026' },
    ],
  },
  {
    key: 'objective',
    label: 'Objective',
    ai: 'AI-103',
    gate: 'G2',
    draft:
      'Ill-looking, using accessory muscles. Respiratory rate 26, SpO₂ 92% on 4 L, pulse 108, BP 104/62, temperature 38.4 °C. NEWS2 7, rising over the last four hours. Coarse crackles and bronchial breathing at the right base with reduced air entry. Heart sounds normal. No peripheral oedema.',
    confidence: 0.91,
    band: 'HIGH',
    transcriptSpan: '"…respiratory rate is twenty-six, saturations ninety-two on four litres, still febrile…"',
    inputs: [
      { label: 'Vitals 21-Sep-2026 07:50', source: 'Flowsheet 07:50' },
      { label: 'AI-201 deterioration score, NEWS2 7', source: 'AI-201 21-Sep-2026 07:52' },
    ],
  },
  {
    key: 'assessment',
    label: 'Assessment',
    ai: 'AI-103',
    gate: 'G2',
    draft:
      'Community-acquired pneumonia (J18.9), right lower lobe, not responding adequately to current therapy at 72 hours. Rising NEWS2 and increasing oxygen requirement indicate clinical deterioration. Differential includes empyema, resistant organism and a secondary hospital-acquired process.',
    confidence: 0.68,
    band: 'MED',
    transcriptSpan: '"…he is not turning the corner at seventy-two hours, I want to rethink the cover…"',
    inputs: [
      { label: 'CRP 184 mg/L, 21-Sep-2026 06:40', source: 'Result R-88402' },
      { label: 'Blood culture, no growth at 48h', source: 'Result R-88310' },
      { label: 'Chest X-ray PA 19-Sep-2026', source: 'Study ST-4471' },
    ],
  },
  {
    key: 'plan',
    label: 'Plan',
    ai: 'AI-103',
    gate: 'G2',
    draft:
      'Escalate antimicrobial cover after review of the allergy record. Repeat chest imaging today to exclude an effusion or empyema. Repeat CBC, CRP and renal function. Continue oxygen titrated to SpO₂ 94–96%. Hourly observations and a further senior review at 14:00. Discuss ceiling of care with the family if no improvement by tomorrow.',
    confidence: 0.79,
    band: 'MED',
    transcriptSpan: '"…broaden the antibiotics, repeat the film, bloods, keep him on hourly obs…"',
    inputs: [
      { label: 'Documented allergy: Penicillin', source: 'Allergy record SD-P-03' },
      { label: 'Antimicrobial stewardship policy', source: 'ASP guideline v6' },
    ],
  },
]

// ─────────────────────────────────────────── Discharge summary (AI-106, G3)

export interface DischargeSectionSeed {
  key: 'reason' | 'course' | 'diagnosis' | 'meds' | 'followup' | 'redflags'
  label: string
  required: boolean
  /** AI-106's draft, shown only when the clinician asks for it. */
  draft: string
}

/** S-13-02 · SD-P-03's discharge summary, six sections, drafted on request. */
export const DISCHARGE_DRAFT_SD_P_03: DischargeSectionSeed[] = [
  {
    key: 'reason',
    label: 'Reason for admission',
    required: true,
    draft:
      'Admitted on 17-Sep-2026 with a four-day history of productive cough, fever and progressive breathlessness. Chest imaging confirmed right lower lobe consolidation. Treated as community-acquired pneumonia.',
  },
  {
    key: 'course',
    label: 'Course in hospital',
    required: true,
    draft:
      'Started on piperacillin-tazobactam 4.5g IV 8-hourly on admission. Blood cultures were taken before antibiotics and showed no growth at 48 hours. Oxygen requirement rose from 2 L to 4 L overnight on 20/21-Sep with a NEWS2 of 7; CRP rose from 96 to 184 mg/L. Antibiotic cover was escalated after review of the documented penicillin allergy. Creatinine rose to 212 µmol/L, meeting stage 2 acute kidney injury, and the enoxaparin dose was renally adjusted. He improved from 22-Sep with weaning of oxygen to room air by 24-Sep.',
  },
  {
    key: 'diagnosis',
    label: 'Discharge diagnosis',
    required: true,
    draft: 'Community-acquired pneumonia, right lower lobe (J18.9). Acute kidney injury, stage 2, resolved. Type 2 diabetes (E11.9), pre-existing.',
  },
  {
    key: 'meds',
    label: 'Medication on discharge',
    required: true,
    draft:
      'Levofloxacin 750 mg orally once daily for a further 3 days. Atorvastatin 40 mg at night, continued. Metformin 500 mg twice daily, restarted 23-Sep after renal function recovered. Enoxaparin stopped on discharge.',
  },
  {
    key: 'followup',
    label: 'Follow-up',
    required: true,
    draft:
      'Chest clinic in 6 weeks with a repeat chest X-ray beforehand. Serum creatinine and electrolytes in 1 week at the local laboratory. General medicine review with Dr Iyer in 4 weeks.',
  },
  {
    key: 'redflags',
    label: 'When to come back',
    required: true,
    draft:
      'Return immediately if breathlessness worsens, fever returns above 38 °C, you cough up blood, or you become confused or unusually drowsy. Attend the emergency department rather than waiting for the clinic appointment.',
  },
]

// ──────────────────────────────────────────────────────────── Problem list

export interface Problem {
  id: string
  patientId: string
  label: string
  icd10: string
  snomed: string
  onset: string
  /** VOCABULARY: Open, never Active — Active is reserved for stroke cases. */
  status: 'Open' | 'Resolved'
  /** Set where AI-501 proposed the code and it awaits a G2 disposition. */
  aiSuggested?: boolean
  confidence?: number
  band?: ConfidenceBand
  /** AI-204 flags a diagnosis the charted evidence does not support. */
  consistencyFlag?: string
  /** AI-501 blocks parent-only codes; leaf codes only. */
  leaf: boolean
}

export const PROBLEMS: Problem[] = [
  {
    id: 'PR-01',
    patientId: 'SD-P-01',
    label: 'Hypothyroidism',
    icd10: 'E03.9',
    snomed: '40930008',
    onset: '2019',
    status: 'Open',
    aiSuggested: true,
    confidence: 0.94,
    band: 'HIGH',
    leaf: true,
  },
  {
    id: 'PR-02',
    patientId: 'SD-P-03',
    label: 'Community-acquired pneumonia',
    icd10: 'J18.9',
    snomed: '385093006',
    onset: '17-Sep-2026',
    status: 'Open',
    aiSuggested: true,
    confidence: 0.91,
    band: 'HIGH',
    leaf: true,
  },
  {
    id: 'PR-03',
    patientId: 'SD-P-03',
    label: 'Type 2 diabetes',
    icd10: 'E11.9',
    snomed: '44054006',
    onset: '2014',
    status: 'Open',
    leaf: true,
  },
  {
    id: 'PR-04',
    patientId: 'SD-P-07',
    label: 'Septic shock',
    icd10: 'R65.21',
    snomed: '76571007',
    onset: '15-Sep-2026',
    status: 'Open',
    aiSuggested: true,
    confidence: 0.58,
    band: 'LOW',
    consistencyFlag:
      'Lactate has not been charted in the last 12 hours. Septic shock coding needs a lactate > 2 mmol/L with vasopressor support documented.',
    leaf: true,
  },
  {
    id: 'PR-05',
    patientId: 'SD-P-05',
    label: 'Acute ischaemic stroke',
    icd10: 'I63.9',
    snomed: '422504002',
    onset: '21-Sep-2026',
    status: 'Open',
    aiSuggested: true,
    confidence: 0.96,
    band: 'HIGH',
    leaf: true,
  },
]

export function problemsFor(patientId: string): Problem[] {
  return PROBLEMS.filter((p) => p.patientId === patientId)
}

/**
 * AI-501 code suggestions. The parent-only entry exists so the screen can show
 * a blocked code: "Blocks parent-only codes; manual search always available."
 */
export const CODE_SUGGESTIONS = [
  { icd10: 'J18.9', label: 'Pneumonia, unspecified organism', leaf: true, confidence: 0.91 },
  { icd10: 'J18', label: 'Pneumonia, unspecified organism (category)', leaf: false, confidence: 0.86 },
  { icd10: 'J15.9', label: 'Unspecified bacterial pneumonia', leaf: true, confidence: 0.64 },
  { icd10: 'J13', label: 'Pneumonia due to Streptococcus pneumoniae', leaf: true, confidence: 0.41 },
]

// ────────────────────────────────────────── Prescriptions and the hard stop

export interface RxLine {
  id: string
  drug: string
  dose: string
  route: string
  frequency: string
  durationDays: number
  indication?: string
  substitutionAllowed: boolean
  instructions?: string
  /** AI-206 renal/hepatic adjustment proposal, awaiting a G2 disposition. */
  doseAdjustment?: {
    proposed: string
    reason: string
    confidence: number
    band: ConfidenceBand
  }
  /** AI-305 completeness gap. */
  completenessGap?: string
  /** Set when AI-205's deterministic rule blocks this line. */
  hardStop?: HardStop
}

/**
 * S-06-07's hard stop. The atlas is emphatic on two points, and both are
 * modelled here:
 *   "Hard stop is DETERMINISTIC" — it is a rule, not the model's opinion, so it
 *   fires identically in AI-OFF.
 *   "Override needs a reason AND a second consultant" — a G4 dual signature.
 */
export interface HardStop {
  rule: string
  /** Why it fired, in the clinician's language. */
  finding: string
  severity: 'contraindicated'
  deterministic: true
  documentedAt: string
  documentedBy: string
  alternatives: {
    drug: string
    dose: string
    route: string
    frequency: string
    rationale: string
    /** Whether the alternative itself carries any caution. */
    caution?: string
  }[]
  auditEvent: string
}

export const PENICILLIN_HARD_STOP: HardStop = {
  rule: 'Allergy cross-reactivity — beta-lactam class',
  finding:
    'Co-amoxiclav is a beta-lactam. R. Lakshmanan has a documented penicillin allergy with a recorded reaction of urticaria and facial swelling.',
  severity: 'contraindicated',
  deterministic: true,
  documentedAt: '11-Aug-2021',
  documentedBy: 'Dr Ananya Iyer',
  alternatives: [
    {
      drug: 'Levofloxacin',
      dose: '750 mg',
      route: 'IV',
      frequency: 'once daily',
      rationale:
        'Respiratory fluoroquinolone. Covers typical and atypical community-acquired pathogens with no beta-lactam cross-reactivity.',
      caution: 'QT prolongation — review the ECG from 19-Sep-2026 before starting.',
    },
    {
      drug: 'Teicoplanin + Levofloxacin',
      dose: '400 mg + 750 mg',
      route: 'IV',
      frequency: '12-hourly loading, then daily',
      rationale: 'Adds Gram-positive cover where a resistant organism is suspected at 72 hours.',
    },
    {
      drug: 'Clarithromycin',
      dose: '500 mg',
      route: 'IV',
      frequency: '12-hourly',
      rationale: 'Macrolide monotherapy. Narrower cover; suitable only if atypical infection is the working diagnosis.',
      caution: 'Interacts with atorvastatin, which is on the active list.',
    },
  ],
  auditEvent: 'AI.SAF.HARD_STOP_OVERRIDDEN',
}

/** The proposed basket for SD-P-03 — deck beat #8. */
export const RX_BASKET_SD_P_03: RxLine[] = [
  {
    id: 'RX-L-01',
    drug: 'Co-amoxiclav 1.2g IV',
    dose: '1.2 g',
    route: 'IV',
    frequency: '8-hourly',
    durationDays: 7,
    indication: 'Community-acquired pneumonia (J18.9)',
    substitutionAllowed: true,
    hardStop: PENICILLIN_HARD_STOP,
  },
  {
    id: 'RX-L-02',
    drug: 'Enoxaparin 40mg SC',
    dose: '40 mg',
    route: 'SC',
    frequency: 'once daily',
    durationDays: 7,
    indication: 'VTE prophylaxis',
    substitutionAllowed: false,
    doseAdjustment: {
      proposed: '20 mg once daily',
      reason:
        'eGFR 28 mL/min/1.73m² on 21-Sep-2026. Enoxaparin accumulates below eGFR 30; halve the prophylactic dose.',
      confidence: 0.87,
      band: 'HIGH',
    },
  },
  {
    id: 'RX-L-03',
    drug: 'Paracetamol 1g IV',
    dose: '1 g',
    route: 'IV',
    frequency: '6-hourly as required',
    durationDays: 3,
    indication: 'Fever and pleuritic pain',
    substitutionAllowed: true,
    completenessGap: 'No maximum daily dose stated. Add a 24-hour ceiling (CMP-NABH-05).',
  },
]

/** SD-P-01's outpatient prescription — no hard stop, the routine path. */
export const RX_BASKET_SD_P_01: RxLine[] = [
  {
    id: 'RX-L-11',
    drug: 'Levothyroxine 75 mcg',
    dose: '75 mcg',
    route: 'Oral',
    frequency: 'once daily before food',
    durationDays: 180,
    indication: 'Hypothyroidism (E03.9)',
    substitutionAllowed: true,
    instructions: 'Take on an empty stomach, 30 minutes before breakfast. Keep a four-hour gap from calcium or iron.',
  },
]

/**
 * The formulary the typeahead searches. NLEM-listed drugs are prompted as a
 * substitution per CMP-DRUG-03.
 */
export const FORMULARY = [
  { drug: 'Co-amoxiclav 1.2g IV', nlem: true, ceilingPrice: 148, betaLactam: true },
  { drug: 'Piperacillin-tazobactam 4.5g IV', nlem: true, ceilingPrice: 412, betaLactam: true },
  { drug: 'Levofloxacin 750mg IV', nlem: true, ceilingPrice: 186, betaLactam: false },
  { drug: 'Clarithromycin 500mg IV', nlem: false, ceilingPrice: 298, betaLactam: false },
  { drug: 'Teicoplanin 400mg IV', nlem: false, ceilingPrice: 1240, betaLactam: false },
  { drug: 'Enoxaparin 40mg SC', nlem: true, ceilingPrice: 342, betaLactam: false },
  { drug: 'Atorvastatin 40mg', nlem: true, ceilingPrice: 62, betaLactam: false },
  { drug: 'Clopidogrel 75mg', nlem: true, ceilingPrice: 48, betaLactam: false },
  { drug: 'Metformin 500mg', nlem: true, ceilingPrice: 18, betaLactam: false },
  { drug: 'Paracetamol 1g IV', nlem: true, ceilingPrice: 34, betaLactam: false },
  { drug: 'Levothyroxine 75 mcg', nlem: true, ceilingPrice: 96, betaLactam: false },
  { drug: 'Tenecteplase 25mg', nlem: false, ceilingPrice: 42000, betaLactam: false },
]

// ───────────────────────────────────────────────────────── Results (M-09)

export interface ResultRow {
  id: string
  patientId: string
  test: string
  value: string
  unit: string
  refRange: string
  /**
   * §5.3 — colour is never the only carrier. An abnormal result reads
   * "↑ High", not a red cell, so the flag carries the word.
   */
  flag: 'Normal' | '↑ High' | '↓ Low' | '↑↑ Critical high' | '↓↓ Critical low'
  reportedAt: Date
  priorValue?: string
  /** AI-212 delta check. */
  delta?: string
  critical: boolean
  acknowledged: boolean
  /** AI-212's one-line ranking reason, shown as a per-row reason chip. */
  aiReason: string
  band: ConfidenceBand
  /** Minutes a critical result has gone unacknowledged, for the escalation clock. */
  unackMinutes?: number
}

export const RESULTS: ResultRow[] = [
  {
    /** The critical one. W-06-3 s2! — interrupts a NAMED clinician. */
    id: 'R-88410',
    patientId: 'SD-P-07',
    test: 'Serum potassium',
    value: '6.8',
    unit: 'mmol/L',
    refRange: '3.5 – 5.1',
    flag: '↑↑ Critical high',
    reportedAt: minutesAgo(12),
    priorValue: '5.4',
    delta: '+1.4 in 9h',
    critical: true,
    acknowledged: false,
    aiReason: 'Critical potassium, rising 1.4 in 9h, on a ventilated patient with AKI',
    band: 'HIGH',
    unackMinutes: 12,
  },
  {
    id: 'R-88402',
    patientId: 'SD-P-03',
    test: 'CRP',
    value: '184',
    unit: 'mg/L',
    refRange: '< 5',
    flag: '↑ High',
    reportedAt: minutesAgo(120),
    priorValue: '96',
    delta: '+88 in 48h',
    critical: false,
    acknowledged: false,
    aiReason: 'Nearly doubled at 72h of antibiotics — treatment failure pattern',
    band: 'HIGH',
  },
  {
    id: 'R-88405',
    patientId: 'SD-P-03',
    test: 'Serum creatinine',
    value: '212',
    unit: 'µmol/L',
    refRange: '62 – 106',
    flag: '↑ High',
    reportedAt: minutesAgo(120),
    priorValue: '148',
    delta: '+64 in 24h',
    critical: false,
    acknowledged: false,
    aiReason: 'AKI stage 2 by creatinine criteria; affects two active prescriptions',
    band: 'HIGH',
  },
  {
    id: 'R-88210',
    patientId: 'SD-P-01',
    test: 'TSH',
    value: '2.4',
    unit: 'mIU/L',
    refRange: '0.4 – 4.0',
    flag: 'Normal',
    reportedAt: new Date(2026, 8, 18, 11, 20),
    priorValue: '3.1',
    delta: '−0.7 in 6 months',
    critical: false,
    acknowledged: true,
    aiReason: 'Within target; no dose change indicated',
    band: 'HIGH',
  },
  {
    id: 'R-88211',
    patientId: 'SD-P-01',
    test: 'Free T4',
    value: '14.2',
    unit: 'pmol/L',
    refRange: '9.0 – 19.0',
    flag: 'Normal',
    reportedAt: new Date(2026, 8, 18, 11, 20),
    critical: false,
    acknowledged: true,
    aiReason: 'Stable, consistent with adequate replacement',
    band: 'HIGH',
  },
  {
    id: 'R-88310',
    patientId: 'SD-P-03',
    test: 'Blood culture',
    value: 'No growth at 48h',
    unit: '',
    refRange: 'No growth',
    flag: 'Normal',
    reportedAt: new Date(2026, 8, 20, 6, 40),
    critical: false,
    acknowledged: true,
    /**
     * AI-212 abstains here rather than scoring — §4.5: "a capability that
     * cannot produce a calibrated score shows AI-ABSTAIN, not LOW."
     */
    aiReason: 'Cannot assess: culture incomplete, final read due at 72h',
    band: 'LOW',
  },
]

/** The trend series behind S-09-05, for the result detail chart. */
export const RESULT_TRENDS: Record<string, { at: Date; value: number }[]> = {
  'R-88410': [
    { at: new Date(2026, 8, 19, 6, 0), value: 4.4 },
    { at: new Date(2026, 8, 19, 18, 0), value: 4.9 },
    { at: new Date(2026, 8, 20, 6, 0), value: 5.1 },
    { at: new Date(2026, 8, 20, 23, 0), value: 5.4 },
    { at: minutesAgo(12), value: 6.8 },
  ],
  'R-88402': [
    { at: new Date(2026, 8, 17, 15, 0), value: 142 },
    { at: new Date(2026, 8, 18, 6, 30), value: 118 },
    { at: new Date(2026, 8, 19, 6, 30), value: 96 },
    { at: new Date(2026, 8, 20, 6, 30), value: 138 },
    { at: minutesAgo(120), value: 184 },
  ],
  'R-88405': [
    { at: new Date(2026, 8, 17, 15, 0), value: 102 },
    { at: new Date(2026, 8, 18, 6, 30), value: 118 },
    { at: new Date(2026, 8, 19, 6, 30), value: 131 },
    { at: new Date(2026, 8, 20, 6, 30), value: 148 },
    { at: minutesAgo(120), value: 212 },
  ],
  'R-88210': [
    { at: new Date(2025, 2, 18, 11, 0), value: 5.8 },
    { at: new Date(2025, 8, 18, 11, 0), value: 4.2 },
    { at: new Date(2026, 2, 18, 11, 0), value: 3.1 },
    { at: new Date(2026, 8, 18, 11, 20), value: 2.4 },
  ],
}

export function result(id: string): ResultRow {
  const r = RESULTS.find((x) => x.id === id)
  if (!r) throw new Error(`Unknown result ${id}`)
  return r
}

// ──────────────────────────────────────────────────────────────── Orders

export interface OrderRow {
  id: string
  patientId: string
  item: string
  category: 'Lab' | 'Imaging' | 'Medication' | 'Nursing' | 'Procedure'
  placedAt: Date
  placedBy: string
  status: 'Ordered' | 'Collected' | 'In progress' | 'Resulted' | 'Cancelled' | 'Overdue'
  /** AI-308 closed-loop chasing note. */
  chase?: string
  /** AI-304 duplicate / low-value flag, awaiting a G2 disposition. */
  duplicateOf?: string
  duplicateReason?: string
  confidence?: number
  band?: ConfidenceBand
}

export const ORDERS: OrderRow[] = [
  {
    id: 'O-5501',
    patientId: 'SD-P-03',
    item: 'Chest X-ray PA',
    category: 'Imaging',
    placedAt: minutesAgo(25),
    placedBy: 'Dr Ananya Iyer',
    status: 'Ordered',
    chase: 'Porter not yet assigned — 25 min since order, target 30 min',
  },
  {
    id: 'O-5502',
    patientId: 'SD-P-03',
    item: 'CBC',
    category: 'Lab',
    placedAt: minutesAgo(140),
    placedBy: 'Dr Ananya Iyer',
    status: 'Resulted',
  },
  {
    id: 'O-5503',
    patientId: 'SD-P-03',
    item: 'CRP',
    category: 'Lab',
    placedAt: minutesAgo(20),
    placedBy: 'Dr Ananya Iyer',
    status: 'Ordered',
    duplicateOf: 'O-5504',
    duplicateReason:
      'CRP was resulted 2 hours ago at 184 mg/L. A repeat inside 24 hours changes management in under 3% of cases at this trajectory.',
    confidence: 0.82,
    band: 'MED',
  },
  {
    id: 'O-5504',
    patientId: 'SD-P-03',
    item: 'CRP',
    category: 'Lab',
    placedAt: minutesAgo(120),
    placedBy: 'Dr Ananya Iyer',
    status: 'Resulted',
  },
  {
    id: 'O-5505',
    patientId: 'SD-P-03',
    item: 'Blood culture',
    category: 'Lab',
    placedAt: new Date(2026, 8, 18, 6, 10),
    placedBy: 'Dr Ananya Iyer',
    status: 'In progress',
    chase: 'Final read due at 72h — 18:10 today',
  },
  {
    id: 'O-5510',
    patientId: 'SD-P-07',
    item: 'Serum potassium',
    category: 'Lab',
    placedAt: minutesAgo(70),
    placedBy: 'Dr Ananya Iyer',
    status: 'Resulted',
  },
  {
    id: 'O-5511',
    patientId: 'SD-P-07',
    item: 'ECG',
    category: 'Procedure',
    placedAt: minutesAgo(10),
    placedBy: 'Dr Ananya Iyer',
    status: 'Ordered',
    chase: 'Ordered in response to the critical potassium',
  },
]

export function ordersFor(patientId: string): OrderRow[] {
  return ORDERS.filter((o) => o.patientId === patientId)
}

/**
 * AI-301 order suggestions from clinical context, for the S-09-01 basket.
 * Each is a discrete rankable proposal (AIP-03) with an evidence line.
 */
export const ORDER_SUGGESTIONS = [
  {
    item: 'Chest X-ray PA',
    category: 'Imaging' as const,
    evidence: 'No imaging since 19-Sep and the oxygen requirement has doubled overnight',
    confidence: 0.9,
    band: 'HIGH' as ConfidenceBand,
  },
  {
    item: 'Serum creatinine',
    category: 'Lab' as const,
    evidence: 'Creatinine rose 64 µmol/L in 24h; two active drugs need renal dosing',
    confidence: 0.88,
    band: 'HIGH' as ConfidenceBand,
  },
  {
    item: 'Sputum culture and sensitivity',
    category: 'Lab' as const,
    evidence: 'Treatment failure at 72h with no organism identified',
    confidence: 0.74,
    band: 'MED' as ConfidenceBand,
  },
  {
    item: 'Arterial blood gas',
    category: 'Procedure' as const,
    evidence: 'SpO₂ 92% on 4 L with a respiratory rate of 26',
    confidence: 0.55,
    band: 'LOW' as ConfidenceBand,
  },
]

/** Order sets, for S-09-02 and S-06-10. */
export const ORDER_SETS = [
  {
    id: 'OS.CAP-ADULT',
    name: 'Community-acquired pneumonia — adult',
    scope: 'Facility-wide' as const,
    owner: 'Dr Vivek Sharma',
    reviewDue: '31-Mar-2027',
    items: ['CBC', 'CRP', 'Serum creatinine', 'Blood culture', 'Chest X-ray PA', 'Sputum culture'],
    usedThisMonth: 142,
  },
  {
    id: 'OS.SEPSIS-1H',
    name: 'Sepsis bundle — first hour',
    scope: 'Facility-wide' as const,
    owner: 'Dr Vivek Sharma',
    reviewDue: '30-Sep-2026',
    items: ['Blood culture', 'CBC', 'CRP', 'Serum creatinine', 'Lactate', 'Paracetamol 1g IV'],
    usedThisMonth: 88,
  },
  {
    id: 'OS.AIYER-THYROID',
    name: 'Thyroid follow-up — Dr Iyer',
    scope: 'Personal' as const,
    owner: 'Dr Ananya Iyer',
    reviewDue: '—',
    items: ['TSH', 'Free T4', 'HbA1c'],
    usedThisMonth: 34,
  },
  {
    id: 'OS.STROKE-CODE',
    name: 'Code stroke — activation bundle',
    scope: 'Facility-wide' as const,
    owner: 'Dr Rohit Desai',
    reviewDue: '31-Dec-2026',
    items: ['NCCT head', 'CT angiogram', 'CT perfusion', 'CBC', 'Serum creatinine', 'ECG', 'Troponin I'],
    usedThisMonth: 19,
  },
]

// ─────────────────────────────────────────── Worklists (S-06-01, S-08-03)

export interface WorklistRow {
  patientId: string
  bed: string | null
  /** AI-201 deterioration band. */
  risk?: 'HIGH' | 'MODERATE' | 'LOW' | 'ABSTAIN'
  /** The per-row reason chip AIP-06/AIP-07 requires. */
  reason?: string
  /** What is waiting on the clinician. */
  pending: string[]
  coSignState?: 'Co-sign pending' | null
  /** Why AI-201 abstained, where it did. */
  abstainReason?: string
  /** Deterministic sort key, for the one-click reversal. */
  chronologicalAt: Date
}

/**
 * S-06-01's needs-attention group, pinned at the top with reason chips. The
 * atlas's wireframe names both rows and both reasons verbatim.
 */
export const NEEDS_ATTENTION: WorklistRow[] = [
  {
    patientId: 'SD-P-03',
    bed: '4B-12',
    risk: 'HIGH',
    reason: 'NEWS2 7, rising 4h',
    pending: ['Ward round note', 'Antibiotic review', '2 results'],
    chronologicalAt: minutesAgo(48),
  },
  {
    patientId: 'SD-P-07',
    bed: 'ICU-1',
    risk: 'HIGH',
    reason: 'Critical K+ 6.8, unacknowledged 12 min',
    pending: ['Acknowledge critical result', 'ECG review'],
    chronologicalAt: minutesAgo(12),
  },
]

/** The rest of the consultant's inpatient list — 6 inpatients in total. */
export const INPATIENTS: WorklistRow[] = [
  ...NEEDS_ATTENTION,
  {
    patientId: 'SD-P-02',
    bed: '2A-04',
    risk: 'MODERATE',
    reason: 'Day 2 post-CABG, drains in situ',
    pending: ['Progress note'],
    chronologicalAt: minutesAgo(180),
  },
  {
    patientId: 'SD-P-09',
    bed: '4B-06',
    risk: 'LOW',
    reason: 'Stable, dialysis today',
    pending: [],
    chronologicalAt: minutesAgo(200),
  },
  {
    patientId: 'SD-P-06',
    bed: '4B-19',
    risk: 'LOW',
    reason: 'Afebrile 18h, for discharge',
    pending: ['Discharge summary'],
    coSignState: null,
    chronologicalAt: minutesAgo(240),
  },
  {
    patientId: 'SD-P-08',
    bed: 'ED-01',
    /**
     * AI-201 abstains here — "states what is missing and the action that would
     * fix it; never a null or zero score."
     */
    risk: 'ABSTAIN',
    abstainReason: 'No vitals charted since 07:05. Chart a set of observations to score.',
    pending: ['MLC docket', 'Identity pending'],
    chronologicalAt: minutesAgo(95),
  },
]

/** The OP clinic — 18 booked, 4 seen, next token MED-042. */
export interface ClinicRow {
  token: string
  patientId: string
  bookedAt: Date
  arrivedAt?: Date
  status: 'Seen' | 'In room' | 'Waiting' | 'Not arrived'
  /** AI-607 wait-time prediction. */
  predictedWaitMin?: number
  band?: ConfidenceBand
}

export const CLINIC_LIST: ClinicRow[] = [
  { token: 'MED-038', patientId: 'SD-P-09', bookedAt: new Date(2026, 8, 21, 8, 0), arrivedAt: minutesAgo(55), status: 'Seen' },
  { token: 'MED-039', patientId: 'SD-P-04', bookedAt: new Date(2026, 8, 21, 8, 10), arrivedAt: minutesAgo(48), status: 'Seen' },
  { token: 'MED-040', patientId: 'SD-P-06', bookedAt: new Date(2026, 8, 21, 8, 20), arrivedAt: minutesAgo(40), status: 'Seen' },
  { token: 'MED-041', patientId: 'SD-P-10', bookedAt: new Date(2026, 8, 21, 8, 30), arrivedAt: minutesAgo(32), status: 'Seen' },
  {
    token: 'MED-042',
    patientId: 'SD-P-01',
    bookedAt: new Date(2026, 8, 21, 8, 40),
    arrivedAt: minutesAgo(18),
    status: 'Waiting',
    predictedWaitMin: 4,
    band: 'HIGH',
  },
  {
    token: 'MED-043',
    patientId: 'SD-P-02',
    bookedAt: new Date(2026, 8, 21, 8, 50),
    arrivedAt: minutesAgo(9),
    status: 'Waiting',
    predictedWaitMin: 16,
    band: 'HIGH',
  },
  {
    token: 'MED-044',
    patientId: 'SD-P-07',
    bookedAt: new Date(2026, 8, 21, 9, 0),
    status: 'Not arrived',
    predictedWaitMin: 28,
    band: 'MED',
  },
]

/** S-06-09 — 2 co-signs pending. */
export interface CoSignRow {
  id: string
  patientId: string
  documentKind: 'Consultation note' | 'Inpatient progress note' | 'Admission assessment' | 'Addendum'
  authoredBy: string
  authoredByPersona: string
  authoredAt: Date
  /** AI-114 documentation-quality findings on the entry. */
  qualityFlags: string[]
  kind: 'cosign' | 'amendment'
}

export const COSIGN_QUEUE: CoSignRow[] = [
  {
    id: 'CS-01',
    patientId: 'SD-P-02',
    documentKind: 'Inpatient progress note',
    authoredBy: 'Dr Ananya Iyer',
    authoredByPersona: 'P-05 Resident',
    authoredAt: minutesAgo(95),
    qualityFlags: ['Banned abbreviation: "OD" — write "once daily"'],
    kind: 'cosign',
  },
  {
    id: 'CS-02',
    patientId: 'SD-P-09',
    documentKind: 'Admission assessment',
    authoredBy: 'Dr Ananya Iyer',
    authoredByPersona: 'P-05 Resident',
    authoredAt: minutesAgo(210),
    qualityFlags: [],
    kind: 'cosign',
  },
]

/** S-05-06 — three referrals, one urgent cardiology ranked top. */
export interface ReferralRow {
  id: string
  fromDoctor: string
  fromFacility: string
  patientName: string
  speciality: string
  reason: string
  receivedAt: Date
  /** AI-609 triage band and reason chip. */
  triage: 'Urgent' | 'Routine' | 'Soon'
  reason609: string
  confidence: number
  band: ConfidenceBand
}

export const REFERRALS: ReferralRow[] = [
  {
    id: 'REF-01',
    fromDoctor: 'Dr M. Venkatesh',
    fromFacility: 'Sunrise Clinic, Saibaba Colony',
    patientName: 'Abdul Rahman Sheikh',
    speciality: 'Cardiology',
    reason: 'Exertional chest pain, ECG shows lateral T-wave inversion',
    receivedAt: minutesAgo(55),
    triage: 'Urgent',
    reason609: 'Chest pain with ischaemic ECG changes — 48h target',
    confidence: 0.92,
    band: 'HIGH',
  },
  {
    id: 'REF-02',
    fromDoctor: 'Dr S. Kamath',
    fromFacility: 'Indostates Tiruppur',
    patientName: 'Fatima Bi',
    speciality: 'Nephrology',
    reason: 'Vascular access planning for long-term haemodialysis',
    receivedAt: minutesAgo(190),
    triage: 'Soon',
    reason609: 'Access planning, no acute feature — 2 week target',
    confidence: 0.81,
    band: 'MED',
  },
  {
    id: 'REF-03',
    fromDoctor: 'Dr L. Pereira',
    fromFacility: 'Pollachi General Practice',
    patientName: 'Arjun Nair',
    speciality: 'Dermatology',
    reason: 'Chronic plaque psoriasis, not responding to topical therapy',
    receivedAt: new Date(2026, 8, 20, 16, 30),
    triage: 'Routine',
    reason609: 'Chronic, stable, no red flags — routine list',
    confidence: 0.88,
    band: 'HIGH',
  },
]

/** S-13-01 discharge readiness — AI-610 predicts discharges at 07:00. */
export interface DischargeRow {
  patientId: string
  bed: string
  /** AI-610 band. */
  likelihood: 'Today' | 'Tomorrow' | 'Not yet'
  confidence: number
  band: ConfidenceBand
  blockers: string[]
  /** AI-514 financial clearance readiness. */
  financialClearance: 'Clear' | 'TPA approval pending' | 'Estimate unsigned'
  reason: string
}

export const DISCHARGE_BOARD: DischargeRow[] = [
  {
    patientId: 'SD-P-06',
    bed: '4B-19',
    likelihood: 'Today',
    confidence: 0.91,
    band: 'HIGH',
    blockers: ['Discharge summary unsigned'],
    financialClearance: 'Clear',
    reason: 'Afebrile 18h, oral intake established, no active orders',
  },
  {
    patientId: 'SD-P-09',
    bed: '4B-06',
    likelihood: 'Today',
    confidence: 0.78,
    band: 'MED',
    blockers: ['Dialysis session at 14:00', 'Transport not arranged'],
    financialClearance: 'Clear',
    reason: 'Routine chronic admission, dialysis completes at 16:30',
  },
  {
    patientId: 'SD-P-02',
    bed: '2A-04',
    likelihood: 'Tomorrow',
    confidence: 0.83,
    band: 'MED',
    blockers: ['Drains in situ', 'Physiotherapy sign-off'],
    financialClearance: 'TPA approval pending',
    reason: 'Day 2 post-CABG, on the standard 5-day pathway',
  },
  {
    patientId: 'SD-P-03',
    bed: '4B-12',
    likelihood: 'Not yet',
    confidence: 0.94,
    band: 'HIGH',
    blockers: ['Deteriorating — NEWS2 7', 'Antibiotics being escalated'],
    financialClearance: 'Estimate unsigned',
    reason: 'Rising oxygen requirement at 72h; not on a discharge trajectory',
  },
]

/** The record's audit trail, for the C-42 provenance panel and the timeline. */
export interface TimelineEvent {
  at: Date
  kind: 'note' | 'order' | 'result' | 'medication' | 'vitals' | 'admission' | 'imaging' | 'ai'
  label: string
  detail: string
  by: string
  /** Set where an AI touchpoint produced or influenced the entry. */
  ai?: string
}

export const TIMELINE: Record<string, TimelineEvent[]> = {
  'SD-P-03': [
    {
      at: new Date(2026, 8, 17, 14, 20),
      kind: 'admission',
      label: 'Admitted to 4B-12',
      detail: 'Community-acquired pneumonia. Transferred from Emergency after 3h 40m.',
      by: 'Dr Ananya Iyer',
    },
    {
      at: new Date(2026, 8, 17, 15, 5),
      kind: 'order',
      label: 'Order set applied — CAP adult',
      detail: 'OS.CAP-ADULT · 6 orders placed',
      by: 'Dr Ananya Iyer',
      ai: 'AI-302',
    },
    {
      at: new Date(2026, 8, 17, 16, 40),
      kind: 'medication',
      label: 'Piperacillin-tazobactam 4.5g IV started',
      detail: '8-hourly. Penicillin allergy override was NOT required — patient tolerated previously.',
      by: 'Dr Ananya Iyer',
    },
    {
      at: new Date(2026, 8, 19, 10, 15),
      kind: 'imaging',
      label: 'Chest X-ray PA',
      detail: 'Right lower lobe consolidation, no effusion.',
      by: 'Dr Neha Bhatt',
      ai: 'AI-402',
    },
    {
      at: new Date(2026, 8, 20, 6, 40),
      kind: 'result',
      label: 'Blood culture — no growth at 48h',
      detail: 'Final read due at 72h.',
      by: 'Laboratory',
    },
    {
      at: minutesAgo(170),
      kind: 'vitals',
      label: 'Oxygen increased 2 L → 4 L',
      detail: 'SpO₂ had fallen to 89% on 2 L.',
      by: 'Sr. Lalitha Raman',
    },
    {
      at: minutesAgo(48),
      kind: 'ai',
      label: 'Deterioration risk HIGH',
      detail: 'NEWS2 7, rising over 4 hours. Drivers: respiratory rate, SpO₂, temperature.',
      by: 'AI-201 v2.4.1',
      ai: 'AI-201',
    },
    {
      at: minutesAgo(120),
      kind: 'result',
      label: 'CRP 184 mg/L ↑ High',
      detail: 'Up from 96 mg/L. Treatment failure pattern at 72h.',
      by: 'Laboratory',
      ai: 'AI-212',
    },
  ],
  'SD-P-01': [
    {
      at: new Date(2026, 2, 14, 10, 30),
      kind: 'note',
      label: 'Consultation — thyroid review',
      detail: 'Levothyroxine continued at 75 mcg. Repeat TFT in 6 months.',
      by: 'Dr Ananya Iyer',
    },
    {
      at: new Date(2026, 8, 18, 11, 20),
      kind: 'result',
      label: 'TSH 2.4 mIU/L · Free T4 14.2 pmol/L',
      detail: 'Both within reference range.',
      by: 'Laboratory',
      ai: 'AI-212',
    },
    {
      at: minutesAgo(18),
      kind: 'admission',
      label: 'Arrived, ABHA Scan & Share',
      detail: 'Token MED-042. Demographics pulled from ABHA; nothing typed.',
      by: 'Front office',
      ai: 'AI-702',
    },
  ],
}

export function timelineFor(patientId: string): TimelineEvent[] {
  return (TIMELINE[patientId] ?? []).slice().sort((a, b) => b.at.getTime() - a.at.getTime())
}

/** Vitals for the patient banner risk strip and the objective section. */
export const VITALS: Record<string, { label: string; value: string; flag: 'Normal' | '↑ High' | '↓ Low'; at: Date }[]> = {
  'SD-P-03': [
    { label: 'Respiratory rate', value: '26 /min', flag: '↑ High', at: minutesAgo(50) },
    { label: 'SpO₂', value: '92% on 4 L', flag: '↓ Low', at: minutesAgo(50) },
    { label: 'Pulse', value: '108 bpm', flag: '↑ High', at: minutesAgo(50) },
    { label: 'BP', value: '104/62 mmHg', flag: 'Normal', at: minutesAgo(50) },
    { label: 'Temperature', value: '38.4 °C', flag: '↑ High', at: minutesAgo(50) },
  ],
  'SD-P-01': [
    { label: 'Pulse', value: '76 bpm', flag: 'Normal', at: minutesAgo(9) },
    { label: 'BP', value: '118/74 mmHg', flag: 'Normal', at: minutesAgo(9) },
    { label: 'Temperature', value: '36.8 °C', flag: 'Normal', at: minutesAgo(9) },
    { label: 'SpO₂', value: '99% on air', flag: 'Normal', at: minutesAgo(9) },
    { label: 'Weight', value: '58 kg', flag: 'Normal', at: minutesAgo(9) },
  ],
  'SD-P-07': [
    { label: 'Respiratory rate', value: '18 /min (SIMV)', flag: 'Normal', at: minutesAgo(20) },
    { label: 'SpO₂', value: '94% on FiO₂ 0.5', flag: 'Normal', at: minutesAgo(20) },
    { label: 'Pulse', value: '124 bpm', flag: '↑ High', at: minutesAgo(20) },
    { label: 'BP', value: '86/48 mmHg (noradrenaline)', flag: '↓ Low', at: minutesAgo(20) },
    { label: 'Temperature', value: '38.9 °C', flag: '↑ High', at: minutesAgo(20) },
  ],
}

/** The banner's deterioration strip — AI-201, AIP-05. */
export interface RiskStrip {
  band: 'HIGH' | 'MODERATE' | 'LOW' | 'ABSTAIN'
  score: string
  trend: string
  drivers: { label: string; direction: 'up' | 'down'; weight: number }[]
  modelVersion: string
  computedAt: Date
  /** Where AI-201 abstains, why — never a null or zero. */
  abstainReason?: string
}

export const RISK_STRIPS: Record<string, RiskStrip> = {
  'SD-P-03': {
    band: 'HIGH',
    score: 'NEWS2 7',
    trend: 'rising over 4h',
    drivers: [
      { label: 'Respiratory rate 26', direction: 'up', weight: 0.34 },
      { label: 'SpO₂ 92% on 4 L', direction: 'down', weight: 0.28 },
      { label: 'Temperature 38.4 °C', direction: 'up', weight: 0.19 },
      { label: 'Pulse 108', direction: 'up', weight: 0.12 },
    ],
    modelVersion: 'AI-201 v2.4.1',
    computedAt: minutesAgo(48),
  },
  'SD-P-07': {
    band: 'HIGH',
    score: 'SOFA 11',
    trend: 'stable 6h',
    drivers: [
      { label: 'Vasopressor requirement', direction: 'up', weight: 0.31 },
      { label: 'Creatinine 268 µmol/L', direction: 'up', weight: 0.26 },
      { label: 'Platelets 84 ×10⁹/L', direction: 'down', weight: 0.22 },
    ],
    modelVersion: 'AI-215 v1.9.0',
    computedAt: minutesAgo(35),
  },
  'SD-P-08': {
    band: 'ABSTAIN',
    score: '—',
    trend: '—',
    drivers: [],
    modelVersion: 'AI-201 v2.4.1',
    computedAt: NOW,
    abstainReason: 'Cannot assess: no vitals charted since 07:05. Chart a set of observations to score.',
  },
}
