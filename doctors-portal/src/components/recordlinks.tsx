/**
 * The way out of any one screen into the rest of a patient's record.
 *
 * A note editor, a chart, a quick panel — each shows one slice of a patient,
 * and a doctor reading one of them usually wants the results or the scan
 * next. So every patient surface carries the same row of doors, in the same
 * order, with the same words: Record · Test results · Reports · Imaging ·
 * Stroke-AI console. A door only appears where there is something behind it
 * — an Imaging button that opens "no study" is worse than no button.
 */

import { useNavigate } from 'react-router-dom'

import { Button, cx } from '@/components/primitives'
import { resultsFor } from '@/data/clinical'
import { viewableStudyFor } from '@/data/imaging'
import type { Patient } from '@/data/kit'
import { NCCT_STUDIES } from '@/data/ncct.generated'
import { reportsFor } from '@/data/record'
import { strokeCaseForPatient } from '@/data/stroke'

export type RecordLinkKey = 'record' | 'results' | 'reports' | 'imaging' | 'stroke'

export interface RecordLink {
  key: RecordLinkKey
  label: string
  icon: string
  to: string
}

/** Every door this patient's record has, in the one fixed order. */
export function recordLinksFor(p: Patient): RecordLink[] {
  const base = `/patient/${p.uhid}`
  const links: RecordLink[] = [{ key: 'record', label: 'Patient record', icon: 'BookOpen', to: `${base}/record` }]
  if (resultsFor(p.id).length > 0) {
    links.push({ key: 'results', label: 'Test results', icon: 'FlaskConical', to: `${base}/results` })
  }
  if (reportsFor(p.id).length > 0) {
    links.push({ key: 'reports', label: 'Reports', icon: 'ScrollText', to: `${base}/reports` })
  }
  const study = viewableStudyFor(p.id)
  if (study) links.push({ key: 'imaging', label: 'Imaging', icon: 'Scan', to: `/radiology/study/${study.id}/view` })
  const sc = strokeCaseForPatient(p.id)
  if (sc && NCCT_STUDIES[sc.id]) {
    links.push({ key: 'stroke', label: 'Stroke-AI console', icon: 'Brain', to: `/stroke/ai-console?case=${sc.id}` })
  }
  return links
}

export function PatientRecordLinks({
  patient,
  exclude = [],
  label = 'Record',
  className,
}: {
  patient: Patient
  /** Doors not worth showing here — the screen you are already on. */
  exclude?: RecordLinkKey[]
  /** The quiet uppercase word before the row. Pass null for none. */
  label?: string | null
  className?: string
}) {
  const navigate = useNavigate()
  const links = recordLinksFor(patient).filter((l) => !exclude.includes(l.key))
  if (links.length === 0) return null
  return (
    <nav aria-label={`${patient.name}’s record`} className={cx('flex flex-wrap items-center gap-2', className)}>
      {label && <span className="mr-1 text-[0.8em] font-bold tracking-[0.08em] text-ink-3 uppercase">{label}</span>}
      {links.map((l) => (
        <Button key={l.key} size="sm" icon={l.icon} onClick={() => navigate(l.to)}>
          {l.label}
        </Button>
      ))}
    </nav>
  )
}
