/**
 * The stroke-case imaging screens for a case that is NOT a large-vessel
 * occlusion.
 *
 * S-18-14's triage card, S-18-15's ASPECTS map and S-18-16's perfusion maps
 * were drawn for one case: a left M1 occlusion. A haemorrhage, a late infarct
 * or a stood-down mimic opening those screens used to inherit that case's
 * findings, which is the one thing a clinical screen must never do. So a
 * non-LVO case gets its own triage card — its real scan, its own findings,
 * its own verdict — and the ASPECTS and perfusion screens say plainly why they
 * do not apply, and where to go instead.
 */

import { useNavigate } from 'react-router-dom'

import { Confidence, Diamond } from '@/components/ai'
import { SectionCard } from '@/components/calm'
import { NcctViewer } from '@/components/ncct'
import { PatientRecordLinks } from '@/components/recordlinks'
import { Button, Card, Chip, cx } from '@/components/primitives'
import { formatDateTime, formatTime } from '@/data/format'
import { IMAGING_STUDIES } from '@/data/imaging'
import { patient } from '@/data/kit'
import { NCCT_STUDIES } from '@/data/ncct.generated'
import type { StrokeCase } from '@/data/stroke'
import { ncctFindings, overlaysFor, triageVerdict } from '@/data/strokeai'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

function studyIdFor(c: StrokeCase): string | undefined {
  return IMAGING_STUDIES.find((s) => s.ncctKey === c.id)?.id
}

/** S-18-14 for a haemorrhage, a late infarct or a mimic. */
export function NonLvoTriage({ c }: { c: StrokeCase }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const p = patient(c.patientId)
  const study = NCCT_STUDIES[c.id]
  const studyId = studyIdFor(c)
  const verdict = study ? triageVerdict(study.truth, c) : undefined
  const findings = study ? ncctFindings(study.truth, c) : []

  return (
    <Screen
      screenId="S-18-14"
      patient={p}
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF']}
      heading="Imaging triage"
      subheading={
        <>
          {c.caseNo} · NCCT head · delivered {formatTime(c.imaging.deliveredAt)} ·{' '}
          {c.status === 'active' ? 'case active' : c.status === 'closed' ? 'case closed' : 'stood down'}
        </>
      }
      actions={
        <>
          {studyId && (
            <Button icon="Scan" onClick={() => navigate(`/radiology/study/${studyId}/view`)}>
              Open in the viewer
            </Button>
          )}
          <Button tone="primary" icon="Brain" onClick={() => navigate(`/stroke/ai-console?case=${c.id}`)}>
            Stroke-AI console
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {verdict && aiActive && (
          <SectionCard
            title="AI triage verdict"
            accent={verdict.tone === 'critical' ? 'critical' : verdict.tone === 'caution' ? 'warning' : undefined}
            meta={<Chip tone={verdict.tone === 'critical' ? 'critical' : verdict.tone === 'caution' ? 'caution' : 'normal'}>{verdict.priority} · {verdict.priorityWord}</Chip>}
            bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
          >
            <p className="text-[1.15em] font-bold tracking-tight">{verdict.headline}</p>
            <p className="mt-1 text-ink-2">{verdict.detail}</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {verdict.chips.map((chip) => (
                <Chip key={chip} tone={chip.includes('NEGATIVE') || chip.includes('NO ') ? 'normal' : 'critical'}>
                  {chip}
                </Chip>
              ))}
            </div>
          </SectionCard>
        )}

        {study && (
          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <NcctViewer study={study} overlays={aiActive ? overlaysFor(study.key, c) : []} />
            <SectionCard
              title={
                <span className="flex items-center gap-2">
                  <Diamond size={10} /> AI findings
                </span>
              }
              meta={<span className="tabular text-[0.86em] text-ink-3">acquired {formatDateTime(c.imaging.acquiredAt)}</span>}
            >
              <dl className="divide-y divide-glass-hairline">
                {findings.map((f) => (
                  <div key={f.label} className="flex min-h-11 flex-wrap items-center justify-between gap-2 px-2 py-2.5 sm:px-3">
                    <dt className="min-w-0">
                      <span className="text-[0.95em] font-medium">{f.label}</span>
                      <span className="block text-[0.86em] text-ink-3">{f.gloss}</span>
                    </dt>
                    <dd className="flex items-center gap-2">
                      <span className={cx('tabular font-semibold', f.reassuring && 'text-normal', f.critical && 'text-pri-critical-ink')}>
                        {f.value}
                      </span>
                      <Confidence band={f.band} score={f.confidence} />
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 rounded-panel bg-brand-soft px-3.5 py-2.5 text-[0.92em] font-medium">{c.imaging.recommendation}</p>
            </SectionCard>
          </div>
        )}

        <PatientRecordLinks patient={p} exclude={['stroke']} />
      </div>
    </Screen>
  )
}

/** S-18-15 and S-18-16 for a case they do not apply to. */
export function NotApplicable({
  c,
  screenId,
  heading,
  what,
}: {
  c: StrokeCase
  screenId: 'S-18-15' | 'S-18-16'
  heading: string
  what: string
}) {
  const navigate = useNavigate()
  const p = patient(c.patientId)
  const study = NCCT_STUDIES[c.id]
  const bleed = study?.truth.ich
  const reason = bleed
    ? `${c.caseNo} is a haemorrhage. ${what} is scored for an ischaemic stroke being considered for reperfusion, so it does not apply here.`
    : c.status === 'de-activated'
      ? `${c.caseNo} was stood down as a stroke mimic. There is no infarct to score.`
      : `${c.caseNo} was not a large-vessel occlusion under reperfusion assessment. ${c.imaging.notPerformed ?? ''}`

  return (
    <Screen
      screenId={screenId}
      patient={p}
      heading={heading}
      subheading={`${c.caseNo} · not applicable to this case`}
      actions={
        <>
          <Button icon="Scan" onClick={() => navigate(`/stroke/case/${c.id}/imaging`)}>
            Imaging triage
          </Button>
          <Button tone="primary" icon="Brain" onClick={() => navigate(`/stroke/ai-console?case=${c.id}`)}>
            Stroke-AI console
          </Button>
        </>
      }
    >
      <Card className="max-w-2xl p-6">
        <p className="text-lg font-semibold tracking-tight">{heading} does not apply to this case</p>
        <p className="mt-2 leading-relaxed text-ink-2">{reason.trim()}</p>
        {c.imaging.aspects !== null && screenId === 'S-18-15' && (
          <p className="tabular mt-2 text-ink-2">
            The NCCT read records ASPECTS {c.imaging.aspects} / 10 for completeness.
          </p>
        )}
        <p className="mt-3 rounded-panel bg-brand-soft px-3.5 py-2.5 font-medium">{c.imaging.recommendation}</p>
      </Card>
    </Screen>
  )
}
