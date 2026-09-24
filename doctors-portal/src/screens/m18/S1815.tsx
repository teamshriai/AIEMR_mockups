/**
 * S-18-15 · ASPECTS Scoring Workspace — `/stroke/case/:id/aspects` · T2 · ARC-11
 *
 * "ASPECTS scored by the model and adjusted by the human, both kept."
 *
 * Both kept is the design. The model's score and the human's adjusted score
 * sit side by side in the record — overwriting the model score would erase the
 * disagreement, and the disagreement is the most useful thing on the screen for
 * whoever audits the model later.
 *
 * Calm pass: the two regions that lost a point are the surface; the eight
 * normal ones fold behind one line and stay editable. The model's score is
 * named once, on the total row, and inline on the regions it marked. The
 * methodology, the caption and the scoring stamp fold behind Why.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Confidence, Diamond } from '@/components/ai'
import { Disclosure, SectionCard, Why } from '@/components/calm'
import { Alert, Button, Card, KeyValue, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { ASPECTS_REGIONS, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

export function S1815({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const { aspectsHuman, setAspectsRegion } = useStroke()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const [recorded, setRecorded] = useState(false)

  const modelScore = 10 - ASPECTS_REGIONS.filter((r) => r.aiAffected).length
  const humanAffected = (key: string, fallback: boolean) => aspectsHuman[key] ?? fallback
  const humanScore = 10 - ASPECTS_REGIONS.filter((r) => humanAffected(r.key, r.aiAffected)).length
  const disagreements = ASPECTS_REGIONS.filter((r) => humanAffected(r.key, r.aiAffected) !== r.aiAffected)

  /** The regions that cost a point — or that you moved — are the ones in view. */
  const inView = ASPECTS_REGIONS.filter(
    (r) => humanAffected(r.key, r.aiAffected) || r.aiAffected || humanAffected(r.key, r.aiAffected) !== r.aiAffected,
  )
  const normal = ASPECTS_REGIONS.filter((r) => !inView.includes(r))

  /** One region. Affected regions carry the model's own verdict inline. */
  const regionRow = (r: (typeof ASPECTS_REGIONS)[number], full: boolean) => {
    const affected = humanAffected(r.key, r.aiAffected)
    const changed = affected !== r.aiAffected
    return (
      <li
        key={r.key}
        className={cx(
          'flex flex-wrap items-center justify-between gap-2 rounded-panel px-3',
          full ? 'py-2.5' : 'py-2',
          changed && 'bg-caution-soft/40',
        )}
      >
        <span className="min-w-0">
          <span className={cx('block font-medium', !full && 'text-[0.95em] text-ink-2')}>{r.label}</span>
          {full && aiActive && (
            <span className="flex items-center gap-1.5 text-[0.84em] text-ink-3">
              <Diamond size={8} />
              model: {r.aiAffected ? 'affected' : 'normal'}
              {changed && <span className="font-semibold text-caution">· you changed it</span>}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          <Button size="sm" tone={affected ? 'secondary' : 'primary'} onClick={() => setAspectsRegion(r.key, false)}>
            Normal
          </Button>
          <Button size="sm" tone={affected ? 'destructive' : 'secondary'} onClick={() => setAspectsRegion(r.key, true)}>
            Affected
          </Button>
        </span>
      </li>
    )
  }

  return (
    <Screen
      screenId="S-18-15"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="tiles"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      heading="ASPECTS"
      subheading={
        <>
          ASPECTS {humanScore} of 10 · {inView.length} region{inView.length === 1 ? '' : 's'} affected
          {disagreements.length > 0 &&
            ` · ${disagreements.length} changed from the model`}
        </>
      }
      actions={
        <>
          <Button icon="Scan" onClick={() => navigate(`/stroke/case/${c.id}/imaging`)}>
            Triage card
          </Button>
          <Button icon="Activity" onClick={() => navigate(`/stroke/case/${c.id}/perfusion`)}>
            Perfusion
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Both scores are kept" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <dl className="divide-y divide-glass-hairline">
              <KeyValue label="Adjusted by you">
                <span className="tabular font-semibold">{humanScore}/10</span>
              </KeyValue>
              <KeyValue label="Examiner">
                <span>{me.name}</span>
              </KeyValue>
            </dl>
          </SectionCard>

          <Why label="What ASPECTS decides">
            <p className="text-ink-2">
              A score of 6 or above keeps thrombectomy on the table. Below 6, the established core is large enough that
              reperfusion is less likely to help and more likely to bleed.
            </p>
            <p className="text-ink-3">One point is one region. At the margin, one region changes the decision.</p>
          </Why>
        </div>
      }
      railTitle="Scoring"
      actionBar={
        <>
          <span className="text-[0.88em] text-ink-3">
            {humanScore >= 6
              ? 'Thrombectomy remains on the table at this score'
              : 'Below 6 — reperfusion is less likely to help'}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Check"
            disabled={recorded}
            onClick={() => {
              setRecorded(true)
              toast({
                tone: 'success',
                title: `ASPECTS ${humanScore} recorded`,
                detail: aiActive
                  ? `Model scored ${modelScore}. Both are kept, with ${disagreements.length} region${disagreements.length === 1 ? '' : 's'} changed by you.`
                  : `Scored manually by ${me.name}.`,
              })
            }}
          >
            {recorded ? 'Recorded' : 'Record both scores'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {disagreements.length > 0 && (
          <Alert tone="caution" title={`You have changed ${disagreements.length} region${disagreements.length === 1 ? '' : 's'}`}>
            {disagreements.map((d) => d.label).join(', ')} — recorded as your adjustment alongside the model&rsquo;s
            original. Neither replaces the other.
          </Alert>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* The ten regions, schematically. */}
          <Card className="overflow-hidden">
            <div className="aspect-square w-full bg-[#0a0d14] p-4">
              <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label="ASPECTS region map, left hemisphere. A filled region is scored as affected; a dashed amber outline marks a disagreement with the model.">
                <ellipse cx="100" cy="100" rx="78" ry="92" fill="#1a2030" stroke="#3a4560" strokeWidth="4" />
                <path d="M100 14 L100 186" stroke="#2c3447" strokeWidth="2" />
                {ASPECTS_REGIONS.map((r, i) => {
                  const affected = humanAffected(r.key, r.aiAffected)
                  const modelSays = r.aiAffected
                  const col = i % 2
                  const row = Math.floor(i / 2)
                  const x = 112 + col * 34
                  const y = 44 + row * 28
                  return (
                    <g key={r.key}>
                      <rect
                        x={x}
                        y={y}
                        width={30}
                        height={24}
                        rx={4}
                        fill={affected ? 'var(--color-abnormal)' : '#2c3447'}
                        stroke={modelSays !== affected ? 'var(--color-caution)' : '#3a4560'}
                        strokeWidth={modelSays !== affected ? 2.5 : 1}
                        strokeDasharray={modelSays !== affected ? '4 3' : undefined}
                      />
                      <text
                        x={x + 15}
                        y={y + 15}
                        textAnchor="middle"
                        className="fill-white text-[8px] font-bold"
                      >
                        {r.label.split(' ')[0].slice(0, 4)}
                      </text>
                    </g>
                  )
                })}
                <text x="20" y="190" className="fill-[#6b7690] text-[8px]">
                  right
                </text>
                <text x="150" y="190" className="fill-[#6b7690] text-[8px]">
                  left — affected side
                </text>
              </svg>
            </div>
          </Card>

          {/* The regions that lost a point; the normal eight fold. */}
          <SectionCard
            title="Regions"
            meta={<span className="text-[0.88em] text-ink-3">one point each</span>}
          >
            <ul className="divide-y divide-glass-hairline">{inView.map((r) => regionRow(r, true))}</ul>

            {normal.length > 0 && (
              <Disclosure label="normal regions" count={normal.length} className="mt-1">
                <ul className="divide-y divide-glass-hairline">{normal.map((r) => regionRow(r, false))}</ul>
              </Disclosure>
            )}

            {/* The one place the model's score is named. */}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-panel bg-glass-fill-strong px-3 py-3">
              <span className="font-semibold">Total</span>
              <span className="flex items-center gap-3">
                {aiActive && (
                  <span className="tabular flex items-center gap-1.5 text-ink-3">
                    <Diamond size={9} />
                    model {modelScore}/10
                  </span>
                )}
                <span className="tabular text-xl font-bold">{humanScore}/10</span>
              </span>
            </div>
          </SectionCard>
        </div>

        <Why label="How this score is produced, and how it is recorded">
          <p className="text-ink-2">
            A filled region on the map is scored as affected. A dashed amber outline marks where you and the model
            disagree.
          </p>
          <p className="text-ink-2">
            Your adjustment does not overwrite the model score. Both go into the record, and the difference is what
            tells model governance where the model is wrong.
          </p>
          {aiActive && (
            <>
              <p className="flex flex-wrap items-center gap-2 text-[0.9em] font-semibold text-ink-3">
                <Diamond size={10} />
                AI-405 · ASPECTS auto-scoring
                <Confidence band="HIGH" score={0.86} />
              </p>
              <p className="text-ink-2">
                Scored from the non-contrast CT. It is less reliable in the first hour, when early ischaemic change is
                subtle, and it does not distinguish an old infarct from a new one — which is the commonest reason a
                human overrules it. Manual region-by-region scoring is the fallback.
              </p>
            </>
          )}
          <p className="tabular text-ink-3">
            Scored {formatTime(caseNow)} by {me.name} · {me.identifierKind} {me.identifier}
          </p>
        </Why>
      </div>
    </Screen>
  )
}
