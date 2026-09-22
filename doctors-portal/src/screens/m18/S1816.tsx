/**
 * S-18-16 · Perfusion & Mismatch Review — `/stroke/case/:id/perfusion` · T2 · ARC-11
 *
 * "Core, penumbra and whether there is tissue worth saving."
 *
 * Two quantities of the same kind, so one chart with one axis: a split bar,
 * both segments directly labelled. Core and penumbra on separate scales would
 * make the mismatch ratio meaningless.
 */

import { useNavigate } from 'react-router-dom'

import { AIActionBar, Confidence, Diamond } from '@/components/ai'
import { SplitBar } from '@/components/charts'
import { Alert, Button, Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { PERFUSION, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen, ScreenSection } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

export function S1816({ id }: { id?: string }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  return (
    <Screen
      screenId="S-18-16"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={
        <>
          <Chip tone={PERFUSION.targetMismatch ? 'normal' : 'abnormal'} icon={PERFUSION.targetMismatch ? 'Check' : 'Ban'}>
            {PERFUSION.targetMismatch ? 'target mismatch' : 'no target mismatch'}
          </Chip>
          <Chip tone="neutral" className="tabular">
            ratio {PERFUSION.mismatchRatio}
          </Chip>
        </>
      }
      actions={
        <>
          <Button icon="Grid2x2" onClick={() => navigate(`/stroke/case/${c.id}/aspects`)}>
            ASPECTS
          </Button>
          <Button tone="primary" icon="Route" onClick={() => navigate(`/stroke/case/${c.id}/evt`)}>
            EVT decision
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Thresholds</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Core">
                <span className="tabular">&lt; 70 mL</span>
              </KeyValue>
              <KeyValue label="Mismatch ratio">
                <span className="tabular">&gt; 1.8</span>
              </KeyValue>
              <KeyValue label="Penumbra">
                <span className="tabular">&gt; 15 mL</span>
              </KeyValue>
              <KeyValue label="Hypoperfusion index">
                <span className="tabular">&lt; 0.4 favours collaterals</span>
              </KeyValue>
            </dl>
            <p className="mt-2.5 text-[0.9em] text-ink-2">
              All four are met here, which is the profile that benefits most from thrombectomy.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why one axis</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Core and penumbra are the same quantity — millilitres of brain. Plotted on two scales, the mismatch ratio
              stops meaning anything. One bar, one axis, both segments labelled.
            </p>
          </Card>
        </div>
      }
      railTitle="Selection"
    >
      <div className="space-y-5">
        {!aiActive ? (
          <Alert tone="caution" title="Quantification is unavailable">
            The vendor perfusion maps are still on the workstation and can be read manually. That is the documented
            fallback for AI-406 — you lose the numbers, not the images.
          </Alert>
        ) : (
          <Alert tone="normal" title="Small core, large penumbra">
            {PERFUSION.interpretation}
          </Alert>
        )}

        <ScreenSection title="Volumes" subtitle="Millilitres of brain — one measure, one axis">
          <Card className="p-5">
            <SplitBar
              unit="mL"
              parts={[
                { label: 'Ischaemic core — already lost', value: PERFUSION.coreMl, slot: 1 },
                { label: 'Penumbra — salvageable', value: PERFUSION.penumbraMl, slot: 2 },
              ]}
              caption={`mismatch ratio ${PERFUSION.mismatchRatio}`}
            />

            <dl className="mt-5 grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Core', value: `${PERFUSION.coreMl} mL`, ok: PERFUSION.coreMl < 70 },
                { label: 'Penumbra', value: `${PERFUSION.penumbraMl} mL`, ok: PERFUSION.penumbraMl > 15 },
                { label: 'Mismatch ratio', value: String(PERFUSION.mismatchRatio), ok: PERFUSION.mismatchRatio > 1.8 },
                {
                  label: 'Hypoperfusion index',
                  value: String(PERFUSION.hypoperfusionIndex),
                  ok: PERFUSION.hypoperfusionIndex < 0.4,
                },
              ].map((m) => (
                <div key={m.label} className="rounded-panel bg-glass-fill-muted px-3.5 py-3">
                  <dt className="text-[0.82em] tracking-wide text-ink-3 uppercase">{m.label}</dt>
                  <dd className="tabular mt-1 text-xl font-semibold">{m.value}</dd>
                  <Chip tone={m.ok ? 'normal' : 'abnormal'} icon={m.ok ? 'Check' : 'Ban'} className="mt-1.5">
                    {m.ok ? 'threshold met' : 'threshold not met'}
                  </Chip>
                </div>
              ))}
            </dl>
          </Card>
        </ScreenSection>

        {aiActive && (
          <Card className="border-l-[3px] border-l-ai p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Diamond />
                Quantification
              </h2>
              <Confidence band="HIGH" score={PERFUSION.confidence} />
            </div>
            <p className="mt-2 leading-relaxed text-ink-2">{PERFUSION.interpretation}</p>
            <AIActionBar
              className="mt-3"
              touchpointId={`perfusion:${c.id}`}
              capabilityId="AI-406"
              gate="G2"
              band="HIGH"
              score={PERFUSION.confidence}
              explain={{
                touchpointId: `perfusion:${c.id}`,
                capabilityId: 'AI-406',
                claim: `Core ${PERFUSION.coreMl} mL and penumbra ${PERFUSION.penumbraMl} mL, a mismatch ratio of ${PERFUSION.mismatchRatio}. This is a target mismatch profile.`,
                confidence: PERFUSION.confidence,
                band: 'HIGH',
                computedAt: formatTime(caseNow),
                inputs: [
                  { label: 'CT perfusion source series', source: 'Study ST-9914, perfusion phase' },
                  { label: 'Arterial input function', source: 'Automatically selected, MCA' },
                  { label: 'rCBF < 30% threshold for core', source: 'Vendor algorithm default' },
                  { label: 'Tmax > 6s threshold for penumbra', source: 'Vendor algorithm default' },
                ],
                evidence: [
                  'Core defined at rCBF below 30% of the contralateral side.',
                  'Penumbra defined at Tmax above 6 seconds.',
                ],
                model: PERFUSION.model,
                limits: [
                  'Thresholds are vendor defaults and are a convention, not a physical boundary.',
                  'Motion during acquisition inflates the core volume.',
                  'A poorly chosen arterial input function shifts both volumes in the same direction.',
                  'The vendor maps remain readable manually if this is unavailable.',
                ],
              }}
            />
          </Card>
        )}

        {/* The maps, schematically. */}
        <ScreenSection title="Maps" subtitle="Core and penumbra, side by side on the same slice">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: 'Core — rCBF < 30%', colour: 'var(--color-viz-1)', size: 24 },
              { title: 'Penumbra — Tmax > 6s', colour: 'var(--color-viz-2)', size: 46 },
            ].map((m) => (
              <Card key={m.title} className="overflow-hidden">
                <p className="px-4 py-2.5 text-[0.88em] font-semibold">{m.title}</p>
                <div className="aspect-square w-full bg-[#0a0d14] p-4">
                  <svg viewBox="0 0 200 200" className="size-full" role="img" aria-label={m.title}>
                    <ellipse cx="100" cy="100" rx="76" ry="90" fill="#1a2030" stroke="#3a4560" strokeWidth="4" />
                    <ellipse cx="100" cy="100" rx="66" ry="80" fill="#222a3a" />
                    <path d="M100 18 L100 182" stroke="#1a2030" strokeWidth="2" />
                    <ellipse cx="130" cy="96" rx={m.size} ry={m.size * 1.25} fill={m.colour} opacity="0.85" />
                    <text x="150" y="190" className="fill-[#6b7690] text-[8px]">
                      left
                    </text>
                  </svg>
                </div>
              </Card>
            ))}
          </div>
        </ScreenSection>

        <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          The volumes decide whether there is tissue worth reperfusing. They do not decide whether to do it — that is
          the EVT selection screen, under its own gate.
        </p>
      </div>
    </Screen>
  )
}
