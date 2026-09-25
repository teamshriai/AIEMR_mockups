/**
 * The latest thing on file that can be looked at: the patient's own CT, read
 * in the same viewer the reading room uses, with the model's verdict beneath;
 * failing that, the newest document report; failing that, an honest empty
 * state. One card, three shapes — a doctor never wonders where the scan is.
 */

import { Diamond } from '@/components/ai'
import { PillLink, SectionCard } from '@/components/calm'
import { NcctViewer } from '@/components/ncct'
import { Chip, EmptyState } from '@/components/primitives'
import { formatDate, formatTime } from '@/data/format'
import { ncctFor, viewableStudyFor } from '@/data/imaging'
import type { Patient } from '@/data/kit'
import { reportsFor } from '@/data/record'
import { maybeStrokeCase } from '@/data/stroke'
import { overlaysFor, triageVerdict } from '@/data/strokeai'
import { selectAiActive, useAI } from '@/store/ai'

import { recordPath } from './shared'

export function ReportViewer({ patient: p }: { patient: Patient }) {
  const aiActive = useAI(selectAiActive)
  const study = viewableStudyFor(p.id)
  const series = study ? ncctFor(study) : undefined

  if (study && series) {
    const c = maybeStrokeCase(series.strokeCaseId)
    const verdict = triageVerdict(series.truth, c)
    const overlays = aiActive ? overlaysFor(series.key, c) : []
    const first = overlays[0]
    return (
      <SectionCard
        title="Report viewer"
        meta={
          <span className="tabular text-[0.86em] text-ink-3">
            {study.description} · {formatDate(study.acquiredAt)}
          </span>
        }
        action={
          <span className="flex flex-wrap gap-2">
            {c && (
              <PillLink to={`/stroke/ai-console?case=${c.id}`} icon="Brain">
                Stroke-AI Console
              </PillLink>
            )}
            <PillLink to={`/radiology/study/${study.id}/view`} icon="Scan">
              Open in Imaging
            </PillLink>
          </span>
        }
        bodyClassName="px-3 pb-3 sm:px-4 sm:pb-4"
      >
        {/* The frame is a square of its own width, so the cap is a max-width. */}
        <NcctViewer
          study={series}
          overlays={overlays}
          initialSlice={first ? Math.round((first.from + first.to) / 2) : undefined}
          className="mx-auto w-full max-w-[440px]"
        />
        {aiActive ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.92em]">
            <Diamond size={9} />
            <span className="font-semibold">{verdict.headline}</span>
            <Chip tone={verdict.tone}>{verdict.priorityWord}</Chip>
          </p>
        ) : (
          <p className="mt-3 line-clamp-2 text-[0.92em] text-ink-2">{study.impression}</p>
        )}
        <p className="tabular mt-1 text-[0.84em] text-ink-3">
          {study.reportedBy ?? 'Awaiting radiologist'} · {formatDate(study.acquiredAt)} {formatTime(study.acquiredAt)}
        </p>
      </SectionCard>
    )
  }

  const report = reportsFor(p.id)[0]
  if (report) {
    return (
      <SectionCard
        title="Report viewer"
        meta={<Chip tone="neutral">{report.kind}</Chip>}
        action={<PillLink to={recordPath(p, 'reports')}>See all</PillLink>}
        bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
      >
        <p className="font-semibold">{report.title}</p>
        <p className="tabular mt-0.5 text-[0.86em] text-ink-3">
          {formatDate(report.at)} {formatTime(report.at)} · {report.by}
        </p>
        <p className="mt-2 line-clamp-3 leading-relaxed text-ink-2">{report.summary}</p>
        {report.body && report.body.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-panel bg-glass-inset px-3.5 py-2.5 text-[0.92em] text-ink-2">
            {report.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        {report.studyId && !report.viewable && (
          <p className="mt-2 text-[0.86em] text-ink-3">Report only — the images for this study are not in this demo.</p>
        )}
      </SectionCard>
    )
  }

  return (
    <SectionCard title="Report viewer">
      <EmptyState
        icon="FileText"
        why="No report on file for this patient yet. A scan, an ECG or a discharge summary would appear here once reported."
      />
    </SectionCard>
  )
}
