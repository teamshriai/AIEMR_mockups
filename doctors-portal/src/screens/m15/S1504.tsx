/**
 * S-15-04 · Imaging — `/radiology/study/:id/view` · T1 · ARC-11
 *
 * "The viewer, with the AI overlay a radiologist will actually leave on."
 *
 * That one-liner is a design requirement, not a boast. An overlay a radiologist
 * switches off on the first study is worse than no overlay, so the toggle is
 * prominent, the unmarked image is always one click away, and the findings sit
 * beside the image rather than on top of it.
 *
 * REAL PIXELS. The study is an imported CQ500 head CT, windowed to the brain
 * window at import time and served as PNG slices (see `npm run ncct:import`).
 * The findings are derived from that study's own ground-truth labels, so the
 * words cannot contradict the image. The same viewer and report the Stroke-AI
 * console uses are used here — one imaging surface in the product.
 *
 * Beside the image: the AI read, the full clinical report, a reading note that
 * is dictated first and saved with the study, and the questions a clinician
 * asks about a scan — answered by the assistant with citations.
 *
 * Night theme is the default for this screen and for P-13 as a persona:
 * "no large white fields" in a reading room.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AIActionBar, Confidence, Diamond } from '@/components/ai'
import { Disclosure, SectionCard, Why } from '@/components/calm'
import { NcctViewer } from '@/components/ncct'
import { Alert, Button, Card, Chip, EmptyState, Icon, KeyValue, TextInput, cx } from '@/components/primitives'
import { PatientRecordLinks } from '@/components/recordlinks'
import { VoiceField } from '@/components/voicefield'
import { promptsFor, resolveAnswer } from '@/data/assistant'
import { formatDateTime, formatTime } from '@/data/format'
import { maybeImagingStudy, ncctFor } from '@/data/imaging'
import type { ImagingStudy } from '@/data/imaging'
import { patient } from '@/data/kit'
import { NCCT_WINDOW } from '@/data/ncct.generated'
import type { NcctStudy } from '@/data/ncct.generated'
import { IMAGING_TRIAGE, maybeStrokeCase } from '@/data/stroke'
import { ncctFindings, overlaysFor, triageVerdict } from '@/data/strokeai'
import { selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { StrokeAIReport } from '../m18/StrokeAIReport'
import { S1506 } from './S1506'

/** A read the AI makes on any head CT that is not a stroke case — the haemorrhage and mass-effect classifiers. */
const NCCT_MODEL = 'ncct-ich v3.1.0'

export function S1504({ id }: { id?: string }) {
  const record = maybeImagingStudy(id ?? 'ST-9914')
  const series = record ? ncctFor(record) : undefined
  if (!record) return <StudyNotFound id={id} />
  if (!series) return <ReportOnly study={record} />
  return <Viewer record={record} study={series} />
}

/** An address that names no study. Says so, rather than opening someone else's scan. */
function StudyNotFound({ id }: { id?: string }) {
  const navigate = useNavigate()
  return (
    <Screen
      screenId="S-15-04"
      subheading="No study at this address."
      actions={
        <Button tone="primary" icon="List" onClick={() => navigate('/radiology/worklist')}>
          Imaging worklist
        </Button>
      }
    >
      <Card className="max-w-2xl">
        <EmptyState
          icon="Scan"
          why={`There is no study “${id ?? ''}” on the record. The imaging worklist lists every study there is.`}
        />
      </Card>
    </Screen>
  )
}

/** A study whose report is on the record but whose pixels are not in this demo. */
function ReportOnly({ study: s }: { study: ImagingStudy }) {
  const p = patient(s.patientId)
  return (
    <Screen
      screenId="S-15-04"
      patient={p}
      subheading={
        <span className="tabular">
          {s.id} · {s.description} · acquired {formatDateTime(s.acquiredAt)}
        </span>
      }
      chips={
        <Chip tone="neutral" icon="FileText">
          report only
        </Chip>
      }
    >
      <div className="max-w-3xl space-y-5">
        <SectionCard title="Report" meta={<span className="text-[0.86em] text-ink-3">{s.status}</span>} bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
          <p className="text-[0.8em] font-bold tracking-[0.08em] text-ink-3 uppercase">Impression</p>
          <p className="mt-1 text-lg leading-relaxed">{s.impression}</p>
          {s.findings && (
            <ul className="mt-3 space-y-1 text-ink-2">
              {s.findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <p className="tabular mt-3 text-[0.86em] text-ink-3">
            {s.reportedBy ?? 'Awaiting radiologist'} · {formatDateTime(s.acquiredAt)}
          </p>
        </SectionCard>
        <Alert tone="info" title="Images for this study are not in this demo">
          The report is on the record; the pixels are not loaded here. Only the head CTs carry real images — open one
          from the worklist.
        </Alert>
        <PatientRecordLinks patient={p} />
      </div>
    </Screen>
  )
}

function Viewer({ record, study }: { record: ImagingStudy; study: NcctStudy }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const openAssistant = useUI((s) => s.openAssistant)
  const pushTurn = useUI((s) => s.pushTurn)
  const aiActive = useAI(selectAiActive)
  const dispositions = useAI((s) => s.dispositions)
  const saveVoiceNote = useClinical((s) => s.saveVoiceNote)
  const voiceNotes = useClinical((s) => s.voiceNotes)

  const studyId = record.id
  const c = maybeStrokeCase(study.strokeCaseId)
  const p = patient(record.patientId)
  const findings = useMemo(() => ncctFindings(study.truth, c), [study, c])
  const verdict = triageVerdict(study.truth, c)
  const overlays = useMemo(() => overlaysFor(study.key, c), [study, c])
  const deliveredAt = c?.imaging.deliveredAt ?? new Date(record.acquiredAt.getTime() + 4 * 60000)
  const model = c?.imaging.lvo ? IMAGING_TRIAGE.model : NCCT_MODEL

  const [sideBySide, setSideBySide] = useState(false)
  const [escalate, setEscalate] = useState(false)
  const [note, setNote] = useState('')
  const [noteMeta, setNoteMeta] = useState<{ model: string; band: string } | null>(null)
  const [question, setQuestion] = useState('')

  /** What needs a person told: a bleed or shift, or on a clean scan the occlusion the triage found. */
  /** The one to escalate first: blood, then shift, then mass effect, then anything else flagged. */
  const ORDER = ['Intracranial haemorrhage', 'Midline shift', 'Mass effect']
  const bleed =
    ORDER.map((label) => findings.find((f) => f.critical && f.label === label)).find(Boolean) ??
    findings.find((f) => f.critical)
  const lvo = IMAGING_TRIAGE.findings.find((f) => f.label === 'LVO')
  const criticalFinding = bleed
    ? { label: bleed.label, value: bleed.value }
    : c?.imaging.lvo && lvo
      ? { label: 'Large vessel occlusion', value: lvo.value }
      : undefined
  const reported = dispositions[`imaging:${studyId}:report`]
  /** Only this study's reading notes — a patient with two scans keeps them apart. */
  const savedNotes = (voiceNotes[p.id] ?? []).filter((n) => n.body.startsWith(`${studyId} ·`))

  /** The same path the ? bubble takes, seeded with a question about THIS scan. */
  function ask(q: string) {
    const text = q.trim()
    if (text.length < 3) return
    openAssistant({ screenId: 'S-15-04', patientId: p.id })
    pushTurn({ role: 'user', text })
    const answer = resolveAnswer(text, { screenId: 'S-15-04', patientId: p.id, patientScoped: true })
    pushTurn({ role: 'assistant', text: answer.body, answer })
    setQuestion('')
  }

  function saveNote() {
    const body = note.trim()
    if (!body) return
    saveVoiceNote({
      patientId: p.id,
      body: `${studyId} · ${body}`,
      by: me.name,
      model: noteMeta?.model ?? 'typed',
      band: noteMeta?.band ?? 'HIGH',
    })
    toast({ tone: 'success', title: 'Reading note saved', detail: `${p.name} · ${studyId} · draft, not part of the report until you sign one.` })
    setNote('')
    setNoteMeta(null)
  }

  return (
    <Screen
      screenId="S-15-04"
      patient={p}
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      wide
      subheading={
        <span className="tabular">
          {studyId} · {record.description} · {study.slices} of {study.seriesTotal} slices · acquired{' '}
          {formatDateTime(record.acquiredAt)}
        </span>
      }
      chips={
        <>
          <Chip tone="neutral" icon="Scan">
            brain window W {NCCT_WINDOW.width} / L {NCCT_WINDOW.level}
          </Chip>
          {reported && (
            <Chip tone="normal" icon="Check">
              Attested
            </Chip>
          )}
        </>
      }
      actions={
        <>
          <Button icon="List" onClick={() => navigate('/radiology/worklist')}>
            Worklist
          </Button>
          <Button icon="Columns2" aria-pressed={sideBySide} onClick={() => setSideBySide((v) => !v)}>
            {sideBySide ? 'Single view' : 'Original beside overlay'}
          </Button>
          {c && (
            <Button tone="primary" icon="Brain" onClick={() => navigate(`/stroke/ai-console?case=${c.id}`)}>
              Stroke-AI console
            </Button>
          )}
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Study" bodyClassName="px-4 pb-3 sm:px-5 sm:pb-4">
            <dl className="divide-y divide-glass-hairline text-[0.92em]">
              <KeyValue label="Acquired">
                <span className="tabular">{formatDateTime(record.acquiredAt)}</span>
              </KeyValue>
              <KeyValue label="Series">
                {study.seriesDescription} · {study.sliceThickness} mm · {study.kvp} kVp
              </KeyValue>
              <KeyValue label="Matrix">
                <span className="tabular">
                  {study.rows} × {study.columns}
                </span>
              </KeyValue>
              <KeyValue label="Case">{c ? c.caseNo : 'Not a stroke case'}</KeyValue>
              <KeyValue label="Report">{record.status}</KeyValue>
              <KeyValue label="Source">
                <span className="tabular">{study.sourcePatientId}</span> · de-identified
              </KeyValue>
            </dl>
          </SectionCard>

          <Why label="Why this viewer works this way">
            <p className="text-ink-2">
              The unmarked image is always one click away — an overlay you cannot remove is an overlay you switch off
              for good.
            </p>
            <p className="text-ink-2">
              The model marks a region and names itself on the frame. It never writes a diagnosis on the image, and
              nothing it reports enters the record until a named clinician attests to it.
            </p>
            <p className="text-[0.92em] text-ink-3">
              The reading room defaults to the night theme — {me.name} reads on a diagnostic workstation, and large
              white fields in a darkened room cost contrast sensitivity.
            </p>
          </Why>

          <PatientRecordLinks patient={p} exclude={['imaging']} label={null} className="px-1" />
        </div>
      }
      railTitle="Study"
    >
      <div className="space-y-5">
        {/* The one operative alert: a critical finding that needs a person told. */}
        {aiActive && criticalFinding && !reported && (
          <Alert
            tone="caution"
            title={`${criticalFinding.label} — ${criticalFinding.value}`}
            action={
              <Button size="sm" tone="destructive" icon="PhoneCall" onClick={() => setEscalate(true)}>
                Escalate
              </Button>
            }
          >
            Flagged as a finding that needs a named clinician told, not left in a report queue. The escalation reaches
            a person, and it records who.
          </Alert>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* The image — real pixels, the same viewer the stroke console uses. */}
          <div className="min-w-0 space-y-3">
            <div className={cx('grid gap-3', sideBySide && 'md:grid-cols-2')}>
              {sideBySide && (
                <div className="min-w-0">
                  <p className="mb-1.5 text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">Original</p>
                  <NcctViewer study={study} overlays={[]} />
                </div>
              )}
              <div className="min-w-0">
                {sideBySide && (
                  <p className="mb-1.5 flex items-center gap-1.5 text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">
                    <Diamond size={9} /> With overlay
                  </p>
                )}
                <NcctViewer study={study} overlays={aiActive ? overlays : []} />
              </div>
            </div>

            {/* The reading note: spoken first, saved with the study. */}
            <Card className="p-4">
              <VoiceField
                id={`imaging-note-${studyId}`}
                label="Reading note"
                rows={4}
                value={note}
                onChange={setNote}
                onDictated={(meta) => setNoteMeta({ model: meta.model, band: meta.band })}
                patientId={p.id}
                placeholder="What you see, and what you want the team to know…"
                hint="Saved as a draft against the study. It becomes part of the record only when the report is signed."
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button tone="primary" icon="Save" disabled={note.trim() === ''} onClick={saveNote}>
                  Save note
                </Button>
                {note.trim() !== '' && (
                  <Button tone="tertiary" icon="X" onClick={() => setNote('')}>
                    Discard
                  </Button>
                )}
                {savedNotes.length > 0 && (
                  <span className="ml-auto text-[0.86em] text-ink-3">
                    {savedNotes.length} saved {savedNotes.length === 1 ? 'note' : 'notes'} · latest {formatTime(new Date(savedNotes[savedNotes.length - 1].at))}
                  </span>
                )}
              </div>
              {savedNotes.length > 0 && (
                <ul className="mt-3 divide-y divide-glass-hairline">
                  {savedNotes.slice(-3).reverse().map((n) => (
                    <li key={n.id} className="py-2 text-[0.92em]">
                      <p className="leading-relaxed">{n.body}</p>
                      <p className="tabular mt-1 text-[0.86em] text-ink-3">
                        {n.by} · {formatTime(new Date(n.at))} · {n.model === 'typed' ? 'typed' : 'dictated'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* The read, the report, and the questions. */}
          <div className="min-w-0 space-y-4">
            {aiActive ? (
              <SectionCard
                title="AI read"
                tone="ai"
                meta={<span className="tabular text-[0.86em] text-ink-3">delivered {formatTime(deliveredAt)}</span>}
                bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
              >
                <p
                  className={cx(
                    'font-semibold',
                    verdict.tone === 'critical' ? 'text-pri-critical-ink' : verdict.tone === 'caution' ? 'text-caution' : 'text-normal',
                  )}
                >
                  {verdict.headline}
                </p>
                <p className="mt-1 text-[0.92em] text-ink-2">{verdict.detail}</p>
                <dl className="mt-3 divide-y divide-glass-hairline">
                  {findings.map((f) => (
                    <div key={f.label} className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-2.5">
                      <dt className="min-w-0">
                        <span className={cx('text-[0.95em]', f.critical && 'font-semibold text-caution')}>{f.label}</span>
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

                <AIActionBar
                  className="mt-3"
                  touchpointId={`imaging:${studyId}:report`}
                  capabilityId="AI-404"
                  gate="G3"
                  band="HIGH"
                  score={0.94}
                  explain={{
                    touchpointId: `imaging:${studyId}:report`,
                    capabilityId: 'AI-404',
                    claim: verdict.detail,
                    confidence: 0.94,
                    band: 'HIGH',
                    computedAt: formatTime(deliveredAt),
                    inputs: [
                      { label: `Study ${studyId}, ${study.slices} slices`, source: `Acquired ${formatDateTime(record.acquiredAt)}` },
                      { label: 'Ground-truth labels of the imported series', source: study.sourcePatientId },
                      ...(c ? [{ label: 'Case clock and last known well', source: 'S-18-06 · M-18.10' }] : []),
                    ],
                    evidence: findings.map((f) => `${f.label}: ${f.value} — ${f.gloss}`),
                    model,
                    limits: IMAGING_TRIAGE.limits,
                  }}
                />

                {reported && (
                  <p className="mt-2.5 rounded-panel bg-normal-soft px-3 py-2 text-[0.9em] font-medium text-normal">
                    Attested by {reported.by}. It is now part of the report.
                  </p>
                )}
              </SectionCard>
            ) : (
              <SectionCard title="AI read" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
                <p className="font-semibold">No automated read</p>
                <p className="mt-1.5 text-[0.95em] text-ink-2">
                  The AI is off, so this study sits in the standard reporting queue in arrival order. You lose the
                  prioritisation, not the study.
                </p>
              </SectionCard>
            )}

            {/* The full report — a document, folded. A stroke case gets the stroke report; any other CT, the radiology report. */}
            {c ? (
              <SectionCard title="Clinical report" meta={<span className="text-[0.86em] text-ink-3">{c.caseNo}</span>}>
                <Disclosure label="the full report">
                  <StrokeAIReport strokeCase={c} study={study} />
                </Disclosure>
              </SectionCard>
            ) : (
              <SectionCard
                title="Radiology report"
                meta={<span className="text-[0.86em] text-ink-3">{record.status}</span>}
                bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
              >
                <p className="leading-relaxed">{record.impression}</p>
                {record.findings && (
                  <ul className="mt-2 space-y-1 text-[0.92em] text-ink-2">
                    {record.findings.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
                <p className="tabular mt-2 text-[0.86em] text-ink-3">{record.reportedBy ?? 'Awaiting radiologist'}</p>
              </SectionCard>
            )}

            {/* Questions about THIS scan, answered with citations by the assistant. */}
            {aiActive && (
              <SectionCard
                tone="ai"
                title={
                  <span className="flex items-center gap-2">
                    <Diamond size={10} /> Ask about this scan
                  </span>
                }
                bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
              >
                <ul className="flex flex-wrap gap-2">
                  {promptsFor('S-15-04').map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        onClick={() => ask(q)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-pill bg-ai-soft px-3 text-[0.9em] font-medium text-ai hover:brightness-95"
                      >
                        <Icon name="MessageSquare" size={13} />
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  className="mt-3 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    ask(question)
                  }}
                >
                  <TextInput
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder={`Ask about ${p.name.split(' ')[0]}’s scan…`}
                    aria-label="Ask the assistant about this scan"
                  />
                  <Button type="submit" tone="ai" icon="Send" disabled={question.trim().length < 3}>
                    Ask
                  </Button>
                </form>
                <p className="mt-2 text-[0.86em] text-ink-3">
                  Answers come from cited documentation. A clinical question is routed to the capability that owns it —
                  the assistant never reads the scan for you.
                </p>
              </SectionCard>
            )}
          </div>
        </div>
      </div>

      {/* S-15-06, the modal it is specified to be. */}
      <S1506
        open={escalate}
        patientId={p.id}
        finding={criticalFinding ? `${criticalFinding.label} — ${criticalFinding.value}` : ''}
        studyId={studyId}
        onClose={() => setEscalate(false)}
      />
    </Screen>
  )
}
