/**
 * Everything the AI has read about this patient, in one card — the only place
 * on the record an AI reading appears. It opens with the one-sentence reading
 * of the condition, then the rows in handover order: the deterioration risk,
 * the record, the scan, the results, the orders it would suggest. The risk
 * used to be a red band across every screen; here it is one row among the
 * readings, in plain ink.
 *
 * Every row names its capability and model and opens the same four-panel
 * explanation the rest of the product uses. Readings, not decisions — nothing
 * here is accepted or rejected; that happens where the work is done.
 */

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { SectionCard } from '@/components/calm'
import { Chip, cx } from '@/components/primitives'
import type { Patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'

import { insightsFor } from './overview'

export function AiInsights({ patient: p, className }: { patient: Patient; className?: string }) {
  const aiActive = useAI(selectAiActive)
  if (!aiActive) return null
  const { lead, readings } = insightsFor(p)
  if (!lead && readings.length === 0) return null

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <Diamond size={10} /> AI insights
        </span>
      }
      tone="ai"
      fill
      className={className}
      bodyClassName="thin-scroll min-h-0 overflow-y-auto px-2 pb-2 sm:px-3 sm:pb-3"
    >
      {/* The reading of the condition, in one sentence — what the rows below explain. */}
      {lead && <p className="px-2 pb-2 text-[0.98em] leading-relaxed font-medium sm:px-3">{lead}</p>}
      <ul className={cx('divide-y divide-glass-hairline', lead && 'border-t border-glass-hairline')}>
        {readings.map((r) => (
          <li key={r.key} className="grid gap-x-3 gap-y-1 px-2 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:px-3">
            <span className="pt-0.5 text-[0.78em] font-semibold tracking-wider text-ai uppercase">{r.label}</span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[0.95em]">{r.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                {r.abstain ? (
                  <Chip tone="caution" icon="CircleHelp">
                    Cannot assess
                  </Chip>
                ) : (
                  <Confidence band={r.band} score={r.score} />
                )}
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
