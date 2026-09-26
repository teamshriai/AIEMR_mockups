/**
 * The latest thing on file that can be looked at: the patient's own CT, read
 * in the same viewer the reading room uses, with the model's verdict beneath;
 * failing that, the newest document report. With nothing on file the card is
 * not drawn at all — the Reports tab's "0" says so, without a hole in the page.
 */

import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { PillLink, SectionCard } from '@/components/calm'
import { NcctViewer } from '@/components/ncct'
import { Chip, IconButton } from '@/components/primitives'
import { formatDate, formatTime } from '@/data/format'
import { ncctFor, viewableStudyFor } from '@/data/imaging'
import type { Patient } from '@/data/kit'
import { reportsFor } from '@/data/record'
import { maybeStrokeCase } from '@/data/stroke'
import { overlaysFor, triageVerdict } from '@/data/strokeai'
import { selectAiActive, useAI } from '@/store/ai'

import { recordPath } from './shared'

export function ReportViewer({ patient: p, className }: { patient: Patient; className?: string }) {
  const aiActive = useAI(selectAiActive)
  const navigate = useNavigate()
  const study = viewableStudyFor(p.id)
  const series = study ? ncctFor(study) : undefined

  if (study && series) {
    const c = maybeStrokeCase(series.strokeCaseId)
    const verdict = triageVerdict(series.truth, c)
    const overlays = aiActive ? overlaysFor(series.key, c) : []
    const first = overlays[0]
    return (
      <SectionCard
        tone="investigations"
        title="Report viewer"
        className={className}
        action={
          <span className="flex items-center gap-1.5">
            {c && (
              <IconButton
                icon="Brain"
                label="Open in the Stroke-AI Console"
                onClick={() => navigate(`/stroke/ai-console?case=${c.id}`)}
                className="size-9 bg-brand-soft text-brand-dark hover:bg-brand hover:text-brand-on"
                size={15}
              />
            )}
            <PillLink to={`/radiology/study/${study.id}/view`} icon="Scan">
              Open in Imaging
            </PillLink>
          </span>
        }
        bodyClassName="px-3 pb-3 sm:px-4 sm:pb-4"
      >
        {/* The frame is a square of its own width, so the cap is a max-width — small enough that the card sits on the first screen. */}
        <NcctViewer
          study={series}
          overlays={overlays}
          initialSlice={first ? Math.round((first.from + first.to) / 2) : undefined}
          className="mx-auto w-full max-w-[360px]"
          compact
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
        tone="investigations"
        title="Report viewer"
        className={className}
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

  // Nothing on file: no card. An empty viewer is a hole in the page, and the Reports tab already says "0".
  return null
}
