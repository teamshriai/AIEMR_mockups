/**
 * The top of the patient record: what a doctor wants before opening anything.
 * Four compact cells — the latest vitals, the results that are outside range,
 * the newest scan with the AI's read of it, and one line of AI insight — and
 * nothing else. Long text and the full lists live one tap away, on the tabs
 * above; no cell here is a button.
 */

import { Diamond } from '@/components/ai'
import { CountPill, SectionCard } from '@/components/calm'
import { Chip, ClinicalFlag, cx } from '@/components/primitives'
import { VITALS, resultsFor } from '@/data/clinical'
import { formatDate, formatTime } from '@/data/format'
import { aiFlagFor, imagingFor } from '@/data/imaging'
import type { Patient } from '@/data/kit'
import { conditionFor } from '@/data/record'
import { selectAiActive, useAI } from '@/store/ai'

export function SummaryCard({ patient: p }: { patient: Patient }) {
  const aiActive = useAI(selectAiActive)
  const vitals = (VITALS[p.id] ?? []).slice(0, 5)
  const results = resultsFor(p.id)
  const abnormal = results.filter((r) => r.flag !== 'Normal').slice(0, 3)
  const toReview = results.filter((r) => !r.acknowledged).length
  const study = imagingFor(p.id)[0]
  const flag = study && aiActive ? aiFlagFor(study) : undefined
  const ai = aiActive ? conditionFor(p.id)?.ai : undefined

  return (
    <SectionCard title="Summary" tone="patient" bodyClassName="px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Cell label="Vitals" meta={vitals[0] && `charted ${formatTime(vitals[0].at)}`}>
          {vitals.length === 0 ? (
            <Quiet>No observations charted</Quiet>
          ) : (
            <dl className="space-y-1">
              {vitals.map((v) => (
                <div key={v.label} className="flex items-center justify-between gap-3">
                  <dt className="truncate text-[0.9em] text-ink-2">{v.label}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5">
                    <span className="tabular text-[0.92em] font-medium">{v.value}</span>
                    {v.flag !== 'Normal' && <ClinicalFlag flag={v.flag} />}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </Cell>

        <Cell
          label="Test results"
          meta={toReview > 0 && <CountPill tone="pending">{toReview} to review</CountPill>}
        >
          {results.length === 0 ? (
            <Quiet>No results on the record</Quiet>
          ) : abnormal.length === 0 ? (
            <Quiet>All recent results normal</Quiet>
          ) : (
            <ul className="space-y-1">
              {abnormal.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="truncate text-[0.9em] text-ink-2">{r.test}</span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <span className="tabular text-[0.92em] font-medium">
                      {r.value}
                      {r.unit && ` ${r.unit}`}
                    </span>
                    <ClinicalFlag flag={r.flag} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cell>

        <Cell label="Scan reports" meta={study && formatDate(study.acquiredAt)}>
          {!study ? (
            <Quiet>No scans on the record</Quiet>
          ) : (
            <>
              <p className="text-[0.92em] font-medium">{study.description}</p>
              <p className="line-clamp-1 text-[0.88em] text-ink-2">{study.impression}</p>
              {flag && (
                <span className="mt-1.5 flex items-center gap-1.5">
                  <Diamond size={8} />
                  <Chip tone={flag.tone} icon={flag.tone === 'normal' ? 'Check' : 'TriangleAlert'}>
                    {flag.label}
                  </Chip>
                </span>
              )}
            </>
          )}
        </Cell>

        {ai && (
          <Cell label="AI insight" glyph className="bg-ai-soft" labelClassName="text-ai">
            <p className="line-clamp-2 text-[0.92em] text-ink-2">{ai.text}</p>
          </Cell>
        )}
      </div>
    </SectionCard>
  )
}

function Cell({
  label,
  meta,
  glyph,
  className,
  labelClassName,
  children,
}: {
  label: string
  meta?: React.ReactNode
  glyph?: boolean
  className?: string
  labelClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className={cx('min-w-0 rounded-panel bg-glass-inset px-3 py-2.5', className)}>
      <p
        className={cx(
          'flex items-center justify-between gap-2 text-[0.78em] font-semibold tracking-wider text-ink-2 uppercase',
          labelClassName,
        )}
      >
        <span className="flex items-center gap-1.5">
          {glyph && <Diamond size={9} />}
          {label}
        </span>
        {meta && <span className="tabular font-normal tracking-normal text-ink-3 normal-case">{meta}</span>}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

function Quiet({ children }: { children: string }) {
  return <p className="text-[0.9em] text-ink-2">{children}</p>
}
