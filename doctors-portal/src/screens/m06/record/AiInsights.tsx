/**
 * What the AI has read about this patient, in handover order: the record, the
 * scan, the results, the orders it would suggest. Every row names its
 * capability and model and opens the same four-panel explanation the rest of
 * the product uses. Readings, not decisions — nothing here is accepted or
 * rejected; that happens where the work is done.
 */

import type { ConfidenceBand } from '@/atlas/confidence'
import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { SectionCard } from '@/components/calm'
import { ORDER_SUGGESTIONS, resultsFor } from '@/data/clinical'
import { formatDate, formatDateTime, formatTime } from '@/data/format'
import { ncctFor, viewableStudyFor } from '@/data/imaging'
import type { Patient } from '@/data/kit'
import { conditionFor } from '@/data/record'
import { IMAGING_TRIAGE, maybeStrokeCase } from '@/data/stroke'
import { ncctFindings, triageVerdict } from '@/data/strokeai'
import { selectAiActive, useAI } from '@/store/ai'
import type { ExplainTarget } from '@/store/ui'

interface Reading {
  key: string
  label: string
  text: string
  band: ConfidenceBand
  score?: number
  explain: ExplainTarget
}

/** The same string the reading room prints for a study with no stroke case. */
const NCCT_MODEL = 'ncct-ich v3.1.0'

const bandScore = (band: ConfidenceBand) => (band === 'HIGH' ? 0.9 : band === 'MED' ? 0.72 : 0.45)

export function AiInsights({ patient: p }: { patient: Patient }) {
  const aiActive = useAI(selectAiActive)
  if (!aiActive) return null
  const readings = readingsFor(p).slice(0, 4)
  if (readings.length === 0) return null

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Diamond size={10} /> AI insights
        </span>
      }
      tone="ai"
    >
      <ul className="divide-y divide-glass-hairline">
        {readings.map((r) => (
          <li key={r.key} className="grid gap-x-3 gap-y-1 px-2 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:px-3">
            <span className="pt-0.5 text-[0.78em] font-semibold tracking-wider text-ai uppercase">{r.label}</span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[0.95em]">{r.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Confidence band={r.band} score={r.score} />
                <span className="tabular text-[0.82em] text-ink-3">
                  {r.explain.capabilityId} · {r.explain.model}
                </span>
                <WhyLink target={r.explain} className="ml-auto" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

/** Never the sentence the Summary card already shows — the drivers behind it instead. */
function readingsFor(p: Patient): Reading[] {
  const out: Reading[] = []

  const c = conditionFor(p.id)
  if (c) {
    out.push({
      key: 'condition',
      label: 'Condition',
      text: c.ai.drivers.join(' · '),
      band: c.ai.band,
      explain: {
        touchpointId: `condition-${p.id}`,
        capabilityId: 'AI-105',
        claim: c.ai.text,
        confidence: bandScore(c.ai.band),
        band: c.ai.band,
        computedAt: formatTime(c.updatedAt),
        inputs: [{ label: 'Results, observations and notes on the record', source: `${p.uhid} record` }],
        evidence: c.ai.drivers,
        model: c.ai.model,
        limits: [
          'Summarises what is charted — anything not written down is invisible to it.',
          'It describes the record; the clinical judgement is yours.',
        ],
      },
    })
  }

  const study = viewableStudyFor(p.id)
  const series = study ? ncctFor(study) : undefined
  if (study && series) {
    const sc = maybeStrokeCase(series.strokeCaseId)
    const verdict = triageVerdict(series.truth, sc)
    const findings = ncctFindings(series.truth, sc)
    const lead = findings[0]
    const model = sc?.imaging.lvo ? IMAGING_TRIAGE.model : NCCT_MODEL
    const deliveredAt = sc?.imaging.deliveredAt ?? new Date(study.acquiredAt.getTime() + 4 * 60000)
    out.push({
      key: 'scan',
      label: 'Scan',
      text: `${study.description} ${formatDate(study.acquiredAt)} — ${verdict.detail}`,
      band: lead?.band ?? 'MED',
      score: lead?.confidence,
      explain: {
        /* The same touchpoint the reading room signs, so one attestation is one attestation. */
        touchpointId: `imaging:${study.id}:report`,
        capabilityId: 'AI-404',
        claim: verdict.detail,
        confidence: lead?.confidence ?? bandScore('MED'),
        band: lead?.band ?? 'MED',
        computedAt: formatTime(deliveredAt),
        inputs: [
          { label: `Study ${study.id}, ${series.slices} slices`, source: `Acquired ${formatDateTime(study.acquiredAt)}` },
          { label: 'Ground-truth labels of the imported series', source: series.sourcePatientId },
        ],
        evidence: findings.map((f) => `${f.label}: ${f.value} — ${f.gloss}`),
        model,
        limits: IMAGING_TRIAGE.limits,
      },
    })
  }

  const results = resultsFor(p.id)
  const r = results.find((x) => !x.acknowledged && x.flag !== 'Normal') ?? results[0]
  if (r) {
    out.push({
      key: 'results',
      label: 'Results',
      text: `${r.test} ${r.value}${r.unit ? ` ${r.unit}` : ''} — ${r.aiReason}`,
      band: r.band,
      explain: {
        touchpointId: `result:${r.id}:delta`,
        capabilityId: 'AI-212',
        claim: r.aiReason,
        confidence: bandScore(r.band),
        band: r.band,
        computedAt: formatTime(r.reportedAt),
        inputs: [
          { label: `${r.test} ${r.value} ${r.unit}`, source: `Result ${r.id}` },
          ...(r.priorValue ? [{ label: `Prior ${r.priorValue}${r.delta ? ` (${r.delta})` : ''}`, source: 'Previous result' }] : []),
        ],
        evidence: [r.aiReason],
        model: 'result-delta v1.2.0',
        limits: [
          'Compares one analyte with its prior and its reference range.',
          'Reference ranges and the prior value are always shown without it.',
        ],
      },
    })
  }

  /* AI-301's suggestions are drawn from R. Lakshmanan's plan; nobody else inherits them. */
  if (p.id === 'SD-P-03') {
    const s = ORDER_SUGGESTIONS.filter((x) => x.band !== 'LOW')
    if (s.length > 0) {
      out.push({
        key: 'orders',
        label: 'Orders',
        text: `${s.length} suggested — ${s.map((x) => x.item).join(', ')}`,
        band: s[0].band,
        score: s[0].confidence,
        explain: {
          touchpointId: `orders-${p.id}`,
          capabilityId: 'AI-301',
          claim: `${s.length} orders the record implies, offered rather than placed.`,
          confidence: s[0].confidence,
          band: s[0].band,
          computedAt: formatTime(new Date()),
          inputs: s.map((x) => ({ label: x.item, source: x.evidence })),
          evidence: s.map((x) => `${x.item}: ${x.evidence}`),
          model: 'order-sug v3.0.2',
          limits: [
            'Reads the plan text and the structured record; it does not examine the patient.',
            'Manual order search is always available.',
          ],
        },
      })
    }
  }

  return out
}
