/**
 * The Quick-Panel — everything My Day deliberately leaves off the home screen.
 *
 * The home screen answers two questions: what is my day, and what needs me now.
 * This answers the third, which only matters once you have picked someone:
 * WHAT CHANGED SINCE I LAST SAW THEM. That cut-off is the whole idea — a ward
 * round is not a re-read of the chart, it is a diff.
 *
 * Three rules from the atlas apply here rather than on the home screen, because
 * this is where patient data appears:
 *   §5.3  a clinical value carries an icon and a word, never a colour alone.
 *   §4.5  an AI finding carries its band; one that cannot score says so.
 *   §3.2  no care relationship means GP-11 offers break-glass rather than
 *         refusing, and the record is written synchronously (DD-014).
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Confidence, Diamond, WhyLink } from '@/components/ai'
import { Sparkline } from '@/components/charts'
import { DictationPanel } from '@/components/dictation'
import { Drawer } from '@/components/overlays'
import { Button, Chip, Icon, TextArea, cx } from '@/components/primitives'
import { PatientRecordLinks } from '@/components/recordlinks'
import { RESULT_TRENDS, RESULTS, RISK_STRIPS } from '@/data/clinical'
import { NOW, formatDateTime, formatElapsed, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { cardFor, deltasFor, derivedLastSeen, lastNoteFor } from '@/data/myday'
import type { AttentionItem, Delta } from '@/data/myday'
import { selectAiActive, useAI } from '@/store/ai'
import { auditLabel, useAudit } from '@/store/audit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'

/** The trend behind a delta, where the record holds one. */
function trendFor(patientId: string, delta: Delta) {
  const result = RESULTS.find(
    (r) => r.patientId === patientId && delta.label.startsWith(r.test),
  )
  if (!result) return undefined
  const series = RESULT_TRENDS[result.id]
  if (!series || series.length < 2) return undefined
  return { series, unit: result.unit, label: result.test }
}

export function QuickPanel({
  item,
  onClose,
}: {
  item: AttentionItem | null
  onClose: () => void
}) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const aiActive = useAI(selectAiActive)
  const forced = useAI((s) => s.forcedState)
  const toast = useUI((s) => s.toast)

  const seenAt = useClinical((s) => s.seenAt)
  const pendingSeen = useClinical((s) => s.pendingSeen)
  const markSeen = useClinical((s) => s.markSeen)
  const voiceNotes = useClinical((s) => s.voiceNotes)
  const grantBreakGlass = useSession((s) => s.grantBreakGlass)
  const breakGlassPatients = useSession((s) => s.breakGlassPatients)
  const record = useAudit((s) => s.record)
  const auditRows = useAudit((s) => s.rows)

  const [dictating, setDictating] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [bgReason, setBgReason] = useState('')
  const [askingBreakGlass, setAskingBreakGlass] = useState(false)

  if (!item) return null
  // Captured, so the closures below keep the narrowing a destructured
  // parameter does not carry across a function boundary.
  const it: AttentionItem = item

  const p = patient(it.patientId)
  const offline = forced === 'OFFLINE'
  const queued = pendingSeen.includes(it.patientId)

  /**
   * A patient nobody holds a care relationship with is sealed until
   * break-glass — the case GP-11 exists for.
   */
  const noRelationship = p.consultant === undefined
  const broken = Boolean(breakGlassPatients[it.patientId])
  const sealed = noRelationship && !broken

  const lastSeen = seenAt[it.patientId] ? new Date(seenAt[it.patientId]) : derivedLastSeen(it.patientId)
  /** Across a day boundary the bare HH:MM would read as this morning. */
  const sameDay = lastSeen.toDateString() === NOW.toDateString()
  const deltas = sealed ? [] : deltasFor(it.patientId, lastSeen)
  const card = sealed ? null : cardFor(it.patientId, lastSeen, it.urgency)
  const charted = sealed ? undefined : lastNoteFor(it.patientId)
  /** A note dictated in this session is the last thing written, once it is newer than the charted one. */
  const dictated = sealed ? [] : (voiceNotes[it.patientId] ?? []).slice().sort((a, b) => b.at.localeCompare(a.at))
  const latestDictated = dictated[0]
  const lastNote =
    latestDictated && (!charted || new Date(latestDictated.at) > charted.at)
      ? {
          label: latestDictated.status === 'signed' ? 'Dictated note · signed' : 'Dictated note · draft',
          detail: latestDictated.body,
          by: latestDictated.by,
          initials: latestDictated.by
            .replace(/^(Dr\.?|Sr\.?|Mr|Ms)\s+/, '')
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2),
          at: new Date(latestDictated.at),
        }
      : charted
  const risk = RISK_STRIPS[it.patientId]
  const subjectAudit = auditRows.filter((r) => r.subject === it.patientId).slice().reverse()

  function doMarkSeen() {
    markSeen(it.patientId, NOW.toISOString(), offline)
    record({
      event: 'PATIENT.MARKED_SEEN',
      actor: me.name,
      actorId: me.id,
      subject: it.patientId,
      at: NOW.toISOString(),
      detail: offline ? 'Queued — device offline' : `${deltas.length} changes cleared`,
      queued: offline,
    })
    toast(
      offline
        ? {
            tone: 'caution',
            title: 'Queued — you are offline',
            detail: `${p.name} will sync when the connection returns. Nothing is lost.`,
          }
        : { tone: 'success', title: 'Marked seen', detail: `${p.name} · changes cleared` },
    )
  }

  function confirmBreakGlass() {
    if (bgReason.trim().length < 8) return
    grantBreakGlass(it.patientId, bgReason.trim())
    record({
      event: 'ACCESS.BREAK_GLASS',
      actor: me.name,
      actorId: me.id,
      subject: it.patientId,
      detail: bgReason.trim(),
    })
    setAskingBreakGlass(false)
    setBgReason('')
    toast({
      tone: 'caution',
      title: 'Break-glass recorded',
      detail: 'This access is logged and reviewed within 24 hours.',
    })
  }

  return (
    <>
      <Drawer
        open={item !== null}
        onClose={onClose}
        width={440}
        header={
          <header className="border-b border-glass-hairline px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight" title={p.name}>
                  {p.name}
                </h2>
                <p className="tabular mt-0.5 text-[0.9em] text-ink-3">
                  {p.age}/{p.sex} · {card?.room ?? p.bed ?? '—'} · {p.uhid}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-pill hover:bg-glass-fill-hover"
              >
                <Icon name="X" size={16} />
              </button>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <Chip tone={it.urgency === 'critical' ? 'critical' : it.urgency === 'warning' ? 'caution' : 'neutral'}>
                {it.reason}
              </Chip>
            </div>
          </header>
        }
      >
        <div className="space-y-5 px-5 py-4">
          {/* GP-11 — offered, not refused. No patient data renders behind it. */}
          {sealed ? (
            <div className="rounded-panel border border-caution/35 bg-caution-soft px-4 py-3.5">
              <p className="flex items-center gap-2 font-semibold text-caution">
                <Icon name="Lock" size={16} />
                No care relationship
              </p>
              <p className="mt-1.5 text-[0.92em] text-ink-2">
                You hold the capability to read this record but you are not on this patient&rsquo;s care team. You can
                proceed with break-glass. The access is written before the record opens, and reviewed within 24 hours.
              </p>
              {askingBreakGlass ? (
                <div className="mt-3">
                  <label htmlFor="bg-reason" className="text-[0.9em] font-medium text-ink-2">
                    Why do you need this record?
                  </label>
                  <TextArea
                    id="bg-reason"
                    rows={2}
                    value={bgReason}
                    onChange={(e) => setBgReason(e.target.value)}
                    placeholder="Stated in your own words — this is read by the reviewer, not a dropdown."
                    className="mt-1.5"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      tone="destructive"
                      size="sm"
                      icon="ShieldCheck"
                      disabled={bgReason.trim().length < 8}
                      onClick={confirmBreakGlass}
                    >
                      Record and open
                    </Button>
                    <Button size="sm" onClick={() => setAskingBreakGlass(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button tone="destructive" size="sm" icon="Unlock" className="mt-3" onClick={() => setAskingBreakGlass(true)}>
                  Break glass
                </Button>
              )}
            </div>
          ) : (
            <>
              {broken && (
                <p className="flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2.5 text-[0.9em] text-caution">
                  <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
                  Break-glass access · logged and reviewed within 24 hours
                </p>
              )}

              {/* The cut-off, in one line. */}
              <p className="flex flex-wrap items-center gap-x-2 text-[0.92em] text-ink-3">
                <Icon name="Eye" size={13} className="shrink-0" />
                You last saw {p.name.split(' ').at(-1)} at{' '}
                <span className="tabular font-medium text-ink-2">
                  {sameDay ? formatTime(lastSeen) : formatDateTime(lastSeen)}
                </span>
                <span>· {formatElapsed((NOW.getTime() - lastSeen.getTime()) / 60000)} ago</span>
              </p>

              {/* The rest of the record, one tap away — results, reports, the scan. */}
              <PatientRecordLinks patient={p} label={null} />

              {/* What changed since then. Three, by priority. */}
              <section>
                <h3 className="mb-2 text-[0.8em] font-semibold tracking-wider text-ink-3 uppercase">
                  Changed since then
                </h3>
                {deltas.length === 0 ? (
                  <p className="rounded-panel bg-glass-fill-muted px-3 py-3 text-[0.92em] text-ink-2">
                    Nothing has changed since you last saw this patient. New observations, results or medication
                    changes would appear here.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {deltas.slice(0, 3).map((d) => {
                      const t = trendFor(it.patientId, d)
                      return (
                        <li key={`${d.type}-${d.ts}`} className="rounded-panel bg-glass-fill-muted px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <span className="flex min-w-0 items-center gap-2 font-medium">
                              <Icon name={d.icon} size={14} className="shrink-0 text-ink-3" />
                              <span className="truncate">{d.label}</span>
                              {d.ai && aiActive && <Diamond size={9} />}
                            </span>
                            {t ? (
                              <Sparkline points={t.series} unit={t.unit} label={t.label} />
                            ) : (
                              d.value && <span className="tabular text-[0.9em] font-semibold">{d.value}</span>
                            )}
                          </div>
                          {d.detail && <p className="mt-1 text-[0.88em] text-ink-3">{d.detail}</p>}
                          <p className="tabular mt-1 text-[0.82em] text-ink-muted">
                            {new Date(d.ts).toDateString() === NOW.toDateString()
                              ? formatTime(new Date(d.ts))
                              : formatDateTime(new Date(d.ts))}
                          </p>
                        </li>
                      )
                    })}
                    {deltas.length > 3 && (
                      <li className="px-3 text-[0.88em] text-ink-3">
                        +{deltas.length - 3} more on the timeline
                      </li>
                    )}
                  </ul>
                )}
              </section>

              {/* The AI finding behind the ranking, with its band and its Why. */}
              {it.ai && aiActive && (
                <section className="rounded-panel border border-ai/20 bg-ai-soft px-3 py-2.5">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <Diamond size={11} />
                    <span className="tabular">{it.ai}</span>
                    <span className="text-ink-2">{it.detail}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {it.band ? (
                      <Confidence band={it.band} />
                    ) : (
                      /* §4.5 — a capability that cannot score shows ABSTAIN, not LOW. */
                      <span className="flex items-center gap-1.5 text-[0.86em] font-medium text-caution">
                        <Icon name="CircleHelp" size={13} />
                        Cannot assess — no score, not a zero
                      </span>
                    )}
                    <WhyLink
                      target={{
                        touchpointId: `quick-${it.id}`,
                        capabilityId: it.ai,
                        claim: it.detail,
                        confidence: it.band === 'HIGH' ? 0.9 : it.band === 'MED' ? 0.72 : 0.4,
                        band: it.band ?? 'LOW',
                        computedAt: formatTime(it.since),
                        inputs:
                          risk && risk.band !== 'ABSTAIN'
                            ? risk.drivers.map((d) => ({ label: d.label, source: 'Flowsheet, most recent set' }))
                            : [{ label: 'Record entries since your last visit', source: `${p.uhid} timeline` }],
                        drivers: risk && risk.band !== 'ABSTAIN' ? risk.drivers : undefined,
                        model: risk?.modelVersion ?? `${it.ai} (mockup)`,
                        limits: [
                          'Derived from charted data only — anything not written down is invisible to it.',
                          'Abstains rather than scoring where the inputs are too old.',
                          'It ranks what needs attention; it does not decide what to do.',
                        ],
                      }}
                    />
                  </div>
                </section>
              )}

              {/* The last thing written on this record. */}
              {lastNote && (
                <section>
                  <h3 className="mb-2 flex items-center justify-between gap-2 text-[0.8em] font-semibold tracking-wider text-ink-3 uppercase">
                    Last note
                    {dictated.length > 0 && (
                      <button
                        type="button"
                        onClick={() => navigate(`/patient/${p.uhid}/notes`)}
                        className="inline-flex min-h-8 items-center gap-1 rounded-pill px-2 font-semibold tracking-normal text-brand normal-case hover:bg-brand-soft"
                      >
                        {dictated.length} dictated
                        <Icon name="ChevronRight" size={12} />
                      </button>
                    )}
                  </h3>
                  <div className="flex gap-2.5">
                    <span
                      title={lastNote.by}
                      className={cx(
                        'tabular flex size-8 shrink-0 items-center justify-center rounded-pill text-[0.8em] font-bold',
                        lastNote.by.startsWith('AI-') ? 'bg-ai-soft text-ai' : 'bg-brand-soft text-brand',
                      )}
                    >
                      {lastNote.by.startsWith('AI-') ? <Diamond size={12} /> : lastNote.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium">{lastNote.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-[0.9em] text-ink-3">{lastNote.detail}</p>
                      <p className="tabular mt-0.5 text-[0.82em] text-ink-muted">
                        {lastNote.by} · {formatTime(lastNote.at)}
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

        {/* The three actions, plus dictation. One tap each. */}
        {!sealed && card && (
          <footer className="sticky bottom-0 border-t border-glass-hairline bg-[var(--color-menu)] px-5 py-3">
            {queued && (
              <p className="mb-2 flex items-center gap-2 text-[0.86em] font-medium text-caution">
                <Icon name="WifiOff" size={13} />
                1 mark-seen queued for sync
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button tone="primary" size="sm" icon="ArrowRight" onClick={() => navigate(card.quick_actions.openChart)}>
                Open record
              </Button>
              <Button size="sm" icon="Check" onClick={doMarkSeen} disabled={seenAt[it.patientId] !== undefined && !offline}>
                {seenAt[it.patientId] ? 'Seen' : 'Mark seen'}
              </Button>
              <a
                href={card.quick_actions.callNurse}
                className={cx(
                  'glass inline-flex min-h-11 items-center gap-2 rounded-pill border-glass-border px-3 py-1.5',
                  'font-medium hover:bg-glass-fill-hover',
                )}
              >
                <Icon name="Phone" size={16} />
                Call nurse
              </a>
              <Button size="sm" icon="Mic" onClick={() => setDictating(true)}>
                Add note
              </Button>
            </div>

            {/* The trail, visible. A log nobody can read is not a control. */}
            <button
              type="button"
              onClick={() => setShowAudit((v) => !v)}
              aria-expanded={showAudit}
              className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 text-[0.86em] text-ink-3 hover:text-ink-2"
            >
              <span className="flex items-center gap-1.5">
                <Icon name="History" size={13} />
                Audit — {subjectAudit.length} {subjectAudit.length === 1 ? 'event' : 'events'}
              </span>
              <Icon name={showAudit ? 'ChevronDown' : 'ChevronRight'} size={13} />
            </button>
            {showAudit && (
              <ul className="mt-1 max-h-40 space-y-1.5 overflow-y-auto">
                {subjectAudit.length === 0 && (
                  <li className="text-[0.86em] text-ink-3">
                    Nothing recorded against this patient in this session yet.
                  </li>
                )}
                {subjectAudit.map((r) => (
                  <li key={r.id} className="text-[0.84em]">
                    <span className="tabular text-ink-muted">{formatTime(new Date(r.at))}</span>{' '}
                    <span className="font-medium">{auditLabel(r.event)}</span>{' '}
                    <span className="text-ink-3">
                      · {r.actor}
                      {r.model ? ` · ${r.model}` : ''}
                      {r.gate ? ` · ${r.gate}` : ''}
                      {r.queued ? ' · queued' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </footer>
        )}
      </Drawer>

      <DictationPanel
        open={dictating}
        onClose={() => setDictating(false)}
        patientId={it.patientId}
        patientName={p.name}
      />
    </>
  )
}
