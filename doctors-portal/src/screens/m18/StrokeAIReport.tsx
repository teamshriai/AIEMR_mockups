/**
 * The Stroke-AI clinical report — the document the console produces.
 *
 * It is a REPORT, not a dashboard: it reads top to bottom, every number carries
 * its confidence, and it ends in three named signatures and a disclaimer that
 * is not small print. Every finding is derived from the imported study's ground
 * truth or from the §8 stroke kit; none of it is authored here.
 *
 * Eligibility is rule-based on AI inputs — the model reports, the rules decide,
 * and a clinician signs. That ordering is the whole safety argument, so the
 * eligibility card states which criterion each tick belongs to.
 */

import { SplitBar } from '@/components/charts'
import { Chip, Icon, cx } from '@/components/primitives'
import { formatDateLong, formatTime } from '@/data/format'
import { facility, patient } from '@/data/kit'
import type { NcctStudy } from '@/data/ncct.generated'
import {
  CTA_ANALYSIS,
  CTP_ANALYSIS,
  DECISION_SUPPORT_NOTICE,
  OCCLUSION_PROBABILITY,
  eligibility,
  ncctFindings,
  pathway,
  triageVerdict,
} from '@/data/strokeai'
import { PERFUSION } from '@/data/stroke'
import type { StrokeCase } from '@/data/stroke'

function Block({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0', className)}>
      <h3 className="mb-2 rounded-panel bg-brand px-3 py-1.5 text-[0.76em] font-bold tracking-[0.08em] text-brand-on uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Row({ label, value, confidence }: { label: string; value: string; confidence?: number | null }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-glass-hairline py-1.5 first:border-t-0">
      <span className="min-w-0 text-[0.92em] text-ink-2">{label}</span>
      <span className="flex items-baseline gap-2">
        <span className="tabular font-semibold">{value}</span>
        {confidence !== undefined && confidence !== null && (
          <span className="tabular text-[0.8em] text-ink-3">{confidence.toFixed(2)}</span>
        )}
      </span>
    </div>
  )
}

export function StrokeAIReport({ strokeCase, study }: { strokeCase: StrokeCase; study: NcctStudy }) {
  const p = patient(strokeCase.patientId)
  const truth = study.truth
  const verdict = triageVerdict(truth, strokeCase)
  const findings = ncctFindings(truth, strokeCase)
  const img = strokeCase.imaging
  const el = eligibility(truth, strokeCase)
  const steps = pathway(strokeCase)

  return (
    <article className="min-w-0 space-y-5 px-1 pb-2">
      {/* Masthead */}
      <header className="rounded-card bg-brand-dark px-4 py-3 text-brand-on">
        <p className="text-[1.05em] font-bold tracking-tight">
          Stroke-AI · acute stroke imaging and triage report
        </p>
        <p className="mt-0.5 text-[0.86em] opacity-80">
          {img.lvo ? 'AI-assisted NCCT · CT angiogram · CT perfusion' : 'AI-assisted NCCT'} — hub-and-spoke emergency
          pathway
        </p>
      </header>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Block title="Patient and event">
          <Row label="Case" value={strokeCase.caseNo} />
          <Row label="Patient" value={`${p.name} · ${p.age}/${p.sex}`} />
          <Row label="UHID" value={p.uhid} />
          <Row label="Last known well" value={`${formatTime(strokeCase.lkw)} · ${formatDateLong(strokeCase.lkw)}`} />
          <Row label="Presenting NIHSS" value={String(strokeCase.nihss)} />
          <Row label="Activated by" value={`${strokeCase.activatedBy} · ${formatTime(strokeCase.activatedAt)}`} />
          <Row label="Scanned at" value={facility(strokeCase.originFacility).name} />
          <Row label="Receiving hub" value={facility(strokeCase.destinationFacility).name} />
          <Row label="Payer" value={strokeCase.payer} />
        </Block>

        <Block title="Golden-hour timeline">
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span
                  className={cx(
                    'grid size-7 shrink-0 place-items-center rounded-pill text-[0.76em] font-bold',
                    i === steps.length - 1 ? 'bg-normal text-white' : 'bg-brand text-brand-on',
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-[0.92em] font-medium">{s.label}</span>
                <span className="tabular text-[0.86em] text-ink-3">{formatTime(s.at)}</span>
                <span className="tabular w-16 text-right text-[0.86em] font-semibold">+{s.offset} min</span>
              </li>
            ))}
          </ol>
          <p
            className={cx(
              'tabular mt-3 rounded-panel px-3 py-2 text-center text-[0.88em] font-semibold',
              el.inWindow ? 'bg-normal-soft text-normal' : 'bg-caution-soft text-caution',
            )}
          >
            {el.minutesFromOnset} min from onset —{' '}
            {el.inWindow ? 'within the 4.5 h thrombolysis window' : 'outside the 4.5 h window'}
          </p>
        </Block>
      </div>

      {/* The verdict */}
      <section
        className={cx(
          'rounded-card px-4 py-3.5',
          verdict.tone === 'critical' ? 'bg-pri-critical-soft' : verdict.tone === 'caution' ? 'bg-pri-warning-soft' : 'bg-normal-soft',
        )}
      >
        <p className="text-[0.76em] font-bold tracking-[0.08em] text-ink-2 uppercase">AI triage verdict — decision support</p>
        <p className="mt-1 text-[1.2em] font-bold tracking-tight">{verdict.headline}</p>
        <p className="mt-1 text-ink-2">{verdict.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {verdict.chips.map((c) => (
            <Chip key={c} tone={c.includes('NEGATIVE') || c.includes('NO ') ? 'normal' : 'critical'}>
              {c}
            </Chip>
          ))}
          <span
            className={cx(
              'tabular ml-auto inline-flex min-h-7 items-center rounded-pill px-3 text-[0.86em] font-bold',
              verdict.tone === 'critical'
                ? 'bg-pri-critical-fill text-pri-on-critical'
                : verdict.tone === 'caution'
                  ? 'bg-pri-warning-fill text-pri-on-warning'
                  : 'bg-pri-safe-soft text-pri-safe-ink',
            )}
          >
            {verdict.priority} · {verdict.priorityWord}
          </span>
        </div>
      </section>

      <Block title="Non-contrast CT (NCCT) — AI analysis">
        {findings.map((f) => (
          <div
            key={f.label}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-t border-glass-hairline py-2 first:border-t-0"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[0.92em] font-medium">{f.label}</span>
              <span className="block text-[0.84em] text-ink-3">{f.gloss}</span>
            </span>
            <span
              className={cx('tabular font-bold', f.critical ? 'text-pri-critical-ink' : f.reassuring ? 'text-normal' : 'text-ink')}
            >
              {f.value}
            </span>
            <span className="tabular w-12 text-right text-[0.82em] text-ink-3">{f.confidence.toFixed(2)}</span>
            <span className="w-24 text-right text-[0.82em] text-normal">{f.concordant ? 'Concordant' : '—'}</span>
          </div>
        ))}
      </Block>

      {img.lesion && (
        <Block title={truth.ich ? 'Haemorrhage — characterisation' : 'Lesion — characterisation'}>
          <Row label="Lesion site" value={img.lesion.site} />
          {img.lesion.volumeMl !== undefined && <Row label="Volume (ABC/2)" value={`about ${img.lesion.volumeMl} mL`} confidence={0.86} />}
          {img.lesion.shiftMm !== undefined && <Row label="Midline shift" value={`${img.lesion.shiftMm} mm`} confidence={0.9} />}
          {img.lesion.extension && <Row label="Extension / mass effect" value={img.lesion.extension} />}
          {img.ichScore !== undefined && <Row label="ICH score" value={`${img.ichScore} / 6`} />}
          {img.anticoagulant && <Row label="Anticoagulant" value={img.anticoagulant} />}
          <Row label="Blood pressure at scan" value={img.bp} />
        </Block>
      )}

      {img.lvo ? (
        <>
        <div className="grid min-w-0 gap-5 lg:grid-cols-2">
          <Block title="CT angiography (CTA) — AI analysis">
            {CTA_ANALYSIS.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} confidence={r.confidence} />
            ))}
          </Block>

          <Block title="CT perfusion (CTP) — AI analysis">
            <div className="mb-3">
              <SplitBar
                parts={[
                  { label: `Core ${PERFUSION.coreMl} mL`, value: PERFUSION.coreMl, slot: 2 },
                  { label: `Penumbra ${PERFUSION.penumbraMl} mL`, value: PERFUSION.penumbraMl, slot: 1 },
                ]}
                unit="mL"
                caption={`Infarct core rCBF < 30% · penumbra at risk Tmax > 6 s — ${PERFUSION.coreMl + PERFUSION.penumbraMl} mL hypoperfused in total`}
              />
            </div>
            {CTP_ANALYSIS.map((r) => (
              <Row key={r.label} label={r.label} value={r.value} confidence={r.confidence} />
            ))}
          </Block>
        </div>

        <Block title="Occlusion site probability (CTA model)">
          <ul className="space-y-1.5 pt-1">
            {OCCLUSION_PROBABILITY.map((o) => (
              <li key={o.label} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-[0.9em]">{o.label}</span>
                <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-glass-inset">
                  <span
                    style={{ width: `${o.value * 100}%` }}
                    className={cx('block h-full rounded-pill', o.value > 0.5 ? 'bg-pri-critical-fill' : 'bg-viz-1')}
                  />
                </span>
                <span className="tabular w-12 text-right text-[0.86em] font-semibold">{Math.round(o.value * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.82em] text-ink-3">
            Per-vessel independent probabilities — they do not sum to 100%.
          </p>
        </Block>
        </>
      ) : (
        <Block title="CT angiography and perfusion">
          <p className="rounded-panel bg-glass-inset px-3.5 py-3 text-[0.92em] text-ink-2">
            {img.notPerformed ?? 'Not performed for this case.'}
          </p>
        </Block>
      )}

      <Block title="Next step">
        <p className="rounded-panel border-l-4 border-l-brand bg-brand-soft px-3.5 py-3 font-medium">{img.recommendation}</p>
        {strokeCase.outcome && <p className="mt-2 text-[0.9em] text-ink-2">{strokeCase.outcome}</p>}
      </Block>

      <Block title="Treatment eligibility — rule-based, computed on AI inputs">
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          {[
            { name: 'IV thrombolysis (tenecteplase)', d: el.thrombolysis },
            { name: 'Mechanical thrombectomy (EVT)', d: el.thrombectomy },
          ].map(({ name, d }) => (
            <div
              key={name}
              className={cx(
                'rounded-panel border-l-4 px-3.5 py-3',
                d.eligible ? 'border-l-normal bg-normal-soft/50' : 'border-l-pri-critical bg-pri-critical-soft/50',
              )}
            >
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{name}</span>
                <Chip tone={d.eligible ? 'normal' : 'critical'} icon={d.eligible ? 'Check' : 'Ban'}>
                  {d.eligible ? 'Eligible' : 'Not eligible'}
                </Chip>
              </p>
              <ul className="mt-2 space-y-1">
                {d.criteria.map((c) => (
                  <li key={c.text} className="flex items-start gap-2 text-[0.88em] text-ink-2">
                    <Icon
                      name={c.met ? 'Check' : 'X'}
                      size={13}
                      className={cx('mt-0.5 shrink-0', c.met ? 'text-normal' : 'text-pri-critical-ink')}
                    />
                    <span className="min-w-0">{c.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Block>

      {/* Signatures — a report without a named human is not a report. */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        {[
          { role: 'Reporting radiologist', who: 'Dr. Anitha Venkatesan', detail: `Reviewed ${formatTime(img.deliveredAt)}` },
          { role: 'Treating clinician', who: strokeCase.activatedBy, detail: `Authorised ${formatTime(strokeCase.activatedAt)}` },
          { role: 'Receiving team', who: facility(strokeCase.destinationFacility).name, detail: img.receiving },
        ].map((s) => (
          <div key={s.role} className="rounded-panel bg-glass-inset px-3.5 py-3">
            <p className="text-[0.74em] font-bold tracking-[0.08em] text-ink-3 uppercase">{s.role}</p>
            <p className="mt-1 font-semibold">{s.who}</p>
            <p className="tabular text-[0.84em] text-ink-3">{s.detail}</p>
          </div>
        ))}
      </div>

      <p className="rounded-panel border-l-4 border-l-pri-critical bg-pri-critical-soft/40 px-3.5 py-3 text-[0.88em] text-ink-2">
        <strong className="font-bold text-pri-critical-ink">Clinical decision support — not an autonomous diagnosis.</strong>{' '}
        {DECISION_SUPPORT_NOTICE.replace('Clinical decision support — not an autonomous diagnosis. ', '')}
      </p>
    </article>
  )
}
