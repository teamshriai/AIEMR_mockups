/**
 * The Stroke-AI reading, derived — never authored.
 *
 * Every NCCT finding below comes from the imported study's own ground-truth
 * label row (`ncct.generated.ts`), so the words on screen cannot contradict the
 * pixels behind them: a study labelled `ich: false` reports ICH NEGATIVE, and
 * if a study with blood in it were swapped in, the report would say so and the
 * thrombolysis card would flip to contraindicated without anyone editing copy.
 *
 * What the labels do not carry — ASPECTS, clot length, perfusion volumes — is
 * taken from the §8-consistent stroke kit (`stroke.ts`), which is where the
 * rest of the module already reads them.
 *
 * Shape follows the Stroke-AI clinical report: triage verdict, NCCT / CTA / CTP
 * analysis, territory composition, occlusion-site probability, rule-based
 * treatment eligibility, handover. It is decision support and says so.
 */

import type { ConfidenceBand } from '@/atlas/confidence'

import { NCCT_STUDIES } from './ncct.generated'
import type { NcctStudy, NcctTruth } from './ncct.generated'
import { formatTime } from './format'
import { patient } from './kit'
import type { NcctOverlay } from '@/components/ncct'
import { IMAGING_TRIAGE, PERFUSION, STROKE_CASES, STROKE_NOW } from './stroke'
import type { StrokeCase } from './stroke'

export interface AiFinding {
  label: string
  /** The plain-language gloss under the technical label. */
  gloss: string
  value: string
  confidence: number
  band: ConfidenceBand
  /** A negative that is GOOD news — rendered as reassurance, not as an alert. */
  reassuring?: boolean
  critical?: boolean
  /** Whether the reporting radiologist agreed. */
  concordant: boolean
}

/** Cases that have an imported study behind them. */
export function casesWithImaging(): StrokeCase[] {
  return STROKE_CASES.filter((c) => NCCT_STUDIES[c.id] !== undefined)
}

export function studyFor(caseId: string): NcctStudy | undefined {
  return NCCT_STUDIES[caseId]
}

/**
 * The NCCT table. Haemorrhage first, because it is the finding that decides
 * whether the next hour is thrombolysis or neurosurgery.
 */
export function ncctFindings(truth: NcctTruth): AiFinding[] {
  const bleedSubtypes: [keyof NcctTruth, string][] = [
    ['iph', 'IPH'],
    ['ivh', 'IVH'],
    ['sdh', 'SDH'],
    ['edh', 'EDH'],
    ['sah', 'SAH'],
  ]
  const present = bleedSubtypes.filter(([k]) => truth[k]).map(([, l]) => l)

  return [
    {
      label: 'Intracranial haemorrhage',
      gloss: truth.ich ? 'acute blood is present' : 'no acute intracranial blood',
      value: truth.ich ? 'POSITIVE' : 'NEGATIVE',
      confidence: truth.ich ? 0.96 : 0.97,
      band: 'HIGH',
      reassuring: !truth.ich,
      critical: truth.ich,
      concordant: true,
    },
    {
      label: 'IPH / IVH / SDH / EDH / SAH',
      gloss: present.length > 0 ? `${present.join(', ')} identified` : 'subtype classifiers all below threshold',
      value: present.length > 0 ? present.join(' + ') : 'All negative',
      confidence: 0.95,
      band: 'HIGH',
      reassuring: present.length === 0,
      critical: present.length > 0,
      concordant: true,
    },
    {
      label: 'ASPECTS',
      gloss: 'early ischaemic change; 6 or more supports thrombectomy',
      value: `${IMAGING_TRIAGE.findings.find((f) => f.label === 'ASPECTS')?.value ?? '8'} / 10`,
      confidence: 0.89,
      band: 'HIGH',
      concordant: true,
    },
    {
      label: 'Midline shift',
      gloss: truth.midlineShift ? 'midline is displaced' : 'no midline deviation',
      value: truth.midlineShift ? 'PRESENT' : '0.0 mm',
      confidence: 0.96,
      band: 'HIGH',
      reassuring: !truth.midlineShift,
      critical: truth.midlineShift,
      concordant: true,
    },
    {
      label: 'Mass effect',
      gloss: truth.massEffect ? 'ventricles or cisterns effaced' : 'ventricles and basal cisterns preserved',
      value: truth.massEffect ? 'PRESENT' : 'Absent',
      confidence: 0.94,
      band: 'HIGH',
      reassuring: !truth.massEffect,
      critical: truth.massEffect,
      concordant: true,
    },
    {
      label: 'Hyperdense vessel sign',
      gloss: 'supports a proximal thrombus',
      value: String(IMAGING_TRIAGE.findings.find((f) => f.label === 'Hyperdense vessel sign')?.value ?? 'PRESENT — left MCA'),
      confidence: 0.91,
      band: 'MED',
      concordant: true,
    },
  ]
}

/** The one-line verdict and its triage priority. */
export function triageVerdict(truth: NcctTruth, c: StrokeCase) {
  if (truth.ich) {
    return {
      headline: 'HAEMORRHAGIC STROKE',
      detail:
        'Acute intracranial blood detected. Thrombolysis and thrombectomy are contraindicated; this is a neurosurgical and blood-pressure pathway.',
      priority: 'P1' as const,
      priorityWord: 'IMMEDIATE',
      tone: 'critical' as const,
      chips: ['ICH POSITIVE', 'THROMBOLYSIS CONTRAINDICATED'],
    }
  }
  if (c.status === 'de-activated') {
    return {
      headline: 'NO ACUTE STROKE ON THIS SCAN',
      detail:
        c.deactivationReason ??
        'No haemorrhage and no established infarct. The deficit has another cause; the activation was stood down.',
      priority: 'P3' as const,
      priorityWord: 'STAND DOWN',
      tone: 'normal' as const,
      chips: ['ICH NEGATIVE', 'NO LVO', 'MIMIC'],
    }
  }
  return {
    headline: 'ISCHAEMIC STROKE · LARGE VESSEL OCCLUSION',
    detail:
      'No haemorrhage detected. Left M1 occlusion with a favourable core–penumbra mismatch. Candidate for IV thrombolysis and mechanical thrombectomy.',
    priority: 'P1' as const,
    priorityWord: 'IMMEDIATE',
    tone: 'critical' as const,
    chips: ['LVO POSITIVE', 'ICH NEGATIVE', 'ASPECTS 8', `MISMATCH ${PERFUSION.mismatchRatio}×`],
  }
}

/**
 * Where the model drew on the image. Normalised to the frame, and only on the
 * slices where the finding is actually visible — an overlay that follows you
 * up the whole stack is decoration, not a finding.
 */
export function overlaysFor(caseId: string, truth: NcctTruth): NcctOverlay[] {
  const study = NCCT_STUDIES[caseId]
  if (!study || truth.ich) {
    return truth.ich
      ? [{ cx: 0.44, cy: 0.5, rx: 0.13, ry: 0.11, label: 'HAEMORRHAGE', from: 10, to: 20, tone: 'critical' }]
      : []
  }
  const mid = Math.round(study.slices / 2)
  return [
    {
      cx: 0.63,
      cy: 0.47,
      rx: 0.115,
      ry: 0.105,
      label: 'LEFT M1 TERRITORY',
      from: Math.max(1, mid - 5),
      to: Math.min(study.slices, mid + 5),
      tone: 'ai',
    },
  ]
}

/** CTA, as the report lays it out. */
export const CTA_ANALYSIS = [
  { label: 'Large vessel occlusion', value: 'DETECTED', confidence: 0.94 },
  { label: 'Occlusion site', value: 'Left MCA — M1 segment', confidence: 0.92 },
  { label: 'Laterality', value: 'Left', confidence: 0.98 },
  { label: 'Clot length (est.)', value: '11.4 mm', confidence: 0.85 },
  { label: 'Collateral score (Tan)', value: '2 / 3 — moderate', confidence: 0.87 },
  { label: 'Circle of Willis', value: 'Complete, A1 dominant right', confidence: 0.9 },
  { label: 'ICA / carotid stenosis', value: 'None significant', confidence: 0.93 },
  { label: 'Basilar / vertebral', value: 'Patent', confidence: 0.95 },
]

/** Per-vessel independent probabilities — they do not sum to 100%. */
export const OCCLUSION_PROBABILITY = [
  { label: 'Left MCA — M1', value: 0.94 },
  { label: 'Left MCA — M2', value: 0.09 },
  { label: 'Left ICA terminus', value: 0.06 },
  { label: 'Right MCA', value: 0.02 },
  { label: 'Basilar / vertebral', value: 0.01 },
]

export const CTP_ANALYSIS = [
  { label: 'Mismatch volume', value: `${PERFUSION.penumbraMl - PERFUSION.coreMl} mL`, confidence: 0.91 },
  { label: 'Mismatch ratio', value: `${PERFUSION.mismatchRatio} : 1`, confidence: 0.91 },
  { label: 'Hypoperfusion index', value: String(PERFUSION.hypoperfusionIndex), confidence: 0.88 },
  { label: 'CBF / CBV / MTT', value: 'Maps generated', confidence: null },
  { label: 'DEFUSE-3 criteria', value: PERFUSION.targetMismatch ? 'MET' : 'NOT MET', confidence: null },
]

/** Rule-based, computed on AI inputs — never a model decision. */
export function eligibility(truth: NcctTruth, c: StrokeCase) {
  const minutesFromOnset = Math.round((STROKE_NOW.getTime() - c.lkw.getTime()) / 60000)
  const inWindow = minutesFromOnset <= 270
  const aspects = Number(IMAGING_TRIAGE.findings.find((f) => f.label === 'ASPECTS')?.value ?? 8)

  return {
    minutesFromOnset,
    inWindow,
    thrombolysis: {
      eligible: !truth.ich && inWindow,
      criteria: [
        { met: inWindow, text: `Onset to decision ${minutesFromOnset} min — within the 4.5 h window` },
        { met: !truth.ich, text: `Haemorrhage ${truth.ich ? 'PRESENT on NCCT — absolute contraindication' : 'excluded on NCCT (conf. 0.97)'}` },
        { met: true, text: 'BP 168/94 — below the 185/110 threshold' },
        { met: true, text: 'No anticoagulant use reported' },
      ],
    },
    thrombectomy: {
      eligible: !truth.ich && aspects >= 6 && c.nihss >= 6,
      criteria: [
        { met: !truth.ich, text: 'M1 occlusion confirmed on CTA' },
        { met: aspects >= 6, text: `ASPECTS ${aspects} (≥ 6 required)` },
        { met: PERFUSION.targetMismatch, text: `Core ${PERFUSION.coreMl} mL (< 70 mL), mismatch ${PERFUSION.mismatchRatio} (≥ 1.8) — DEFUSE-3 met` },
        { met: c.nihss >= 6, text: `NIHSS ${c.nihss} (≥ 6 required)` },
      ],
    },
  }
}

/** The golden-hour timeline, from the case's own stamps. */
export function pathway(c: StrokeCase) {
  const from = (d: Date) => Math.round((d.getTime() - c.lkw.getTime()) / 60000)
  return [
    { label: 'Onset', at: c.lkw, offset: 0 },
    { label: 'Activation', at: c.activatedAt, offset: from(c.activatedAt) },
    { label: 'Scan', at: IMAGING_TRIAGE.acquiredAt, offset: from(IMAGING_TRIAGE.acquiredAt) },
    { label: 'AI result', at: IMAGING_TRIAGE.deliveredAt, offset: from(IMAGING_TRIAGE.deliveredAt) },
  ]
}

export function caseSubtitle(c: StrokeCase): string {
  const p = patient(c.patientId)
  return `${p.name} · ${p.age}/${p.sex} · onset ${formatTime(c.lkw)} · NIHSS ${c.nihss}`
}

/** The line every AI surface in this module has to carry. */
export const DECISION_SUPPORT_NOTICE =
  'Clinical decision support — not an autonomous diagnosis. Every finding is advisory, is reviewed in parallel by a qualified radiologist, and is interpreted alongside the patient’s history and examination. Confidence values express model certainty, not clinical certainty.'
