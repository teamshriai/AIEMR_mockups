/**
 * S-18-12 · Remote NIHSS Assessment — `/stroke/case/:id/nihss` · T2 · ARC-14
 *
 * "A 15-item NIHSS scored over video, with the examiner recorded."
 *
 * The one rule that makes this safe: an untested item is blank, not zero.
 * Zero means normal on this scale, so defaulting an untestable item to zero
 * understates the deficit — which is the direction that costs a patient
 * treatment.
 *
 * Calm pass: the fifteen items are the surface. "Untested is not zero" is said
 * once, in the action bar, where the consequence is. The severity bands and the
 * reason a remote examination is defensible fold behind one Why. The running
 * total lives in the header line, not also in a rail tile and a footnote.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, FieldChip } from '@/components/ai'
import { SectionCard, Why } from '@/components/calm'
import { Button, Card, Chip, KeyValue, Select, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { NIHSS_ITEMS, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

export function S1812({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  /** null means not tested. It is distinct from 0, which means normal. */
  const [scores, setScores] = useState<Record<string, number | null>>(
    Object.fromEntries(NIHSS_ITEMS.map((i) => [i.key, null])),
  )

  const tested = NIHSS_ITEMS.filter((i) => scores[i.key] !== null)
  const total = tested.reduce((s, i) => s + (scores[i.key] ?? 0), 0)
  const untested = NIHSS_ITEMS.length - tested.length
  const extractable = NIHSS_ITEMS.filter((x) => x.aiExtracted)
  const pendingExtracted = extractable.filter((x) => scores[x.key] === null)

  function acceptExtracted(key: string, value: number) {
    setScores((s) => ({ ...s, [key]: value }))
  }

  return (
    <Screen
      screenId="S-18-12"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      heading="NIHSS"
      subheading={
        <>
          NIHSS {total} · {tested.length} of {NIHSS_ITEMS.length} scored · {untested} not tested
        </>
      }
      chips={
        <Chip tone="neutral" icon="Video">
          over video
        </Chip>
      }
      actions={
        <Button icon="Video" onClick={() => navigate(`/stroke/case/${c.id}/telestroke`)}>
          Back to the session
        </Button>
      }
      rail={
        <div className="space-y-4">
          {/* The stamp: a remote NIHSS carries the name of whoever did it. */}
          <SectionCard title="Examiner" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className="font-medium">{me.name}</p>
            <p className="tabular text-[0.88em] text-ink-3">
              {me.identifierKind} {me.identifier}
            </p>
            <p className="mt-1.5 text-[0.86em] text-ink-2">Recorded against this score.</p>
          </SectionCard>

          <Why label="How the score is banded, and why a remote examination counts">
            <dl className="divide-y divide-glass-hairline">
              <KeyValue label="0">No stroke symptoms</KeyValue>
              <KeyValue label="1–4">Minor</KeyValue>
              <KeyValue label="5–15">Moderate</KeyValue>
              <KeyValue label="16–20">Moderate to severe</KeyValue>
              <KeyValue label="21–42">Severe</KeyValue>
            </dl>
            <p className="text-ink-2">
              A remote NIHSS is valid, and the atlas treats it as such. What makes it defensible is the record: who
              examined, over what link, at what time, and which items they could not test.
            </p>
          </Why>
        </div>
      }
      railTitle="NIHSS"
      actionBar={
        <>
          {/* The one statement of the rule, at the point where it has a consequence. */}
          <span className="text-[0.88em] text-ink-3">
            {untested > 0
              ? `${untested} item${untested === 1 ? '' : 's'} not tested — excluded from the total, never counted as zero`
              : 'All fifteen items scored'}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Check"
            disabled={tested.length < 8}
            onClick={() => {
              toast({
                tone: 'success',
                title: `NIHSS ${total} recorded`,
                detail: `${tested.length} of ${NIHSS_ITEMS.length} items, examined by ${me.name} at ${formatTime(caseNow)}.`,
              })
              navigate(`/stroke/case/${c.id}/thrombolysis`)
            }}
          >
            Record the score
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {aiActive && pendingExtracted.length > 0 && (
          <Card className="border-l-[3px] border-l-ai p-4">
            <p className="flex items-center gap-2 font-semibold text-ai">
              <Diamond size={11} />
              {extractable.length} items were scored aloud during the examination
            </p>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              Extracted from the session transcript. Each one still needs your disposition, and the items you did not
              test are left blank rather than filled in.
            </p>
            <Button
              size="sm"
              tone="ai"
              className="mt-3"
              icon="Check"
              onClick={() => {
                for (const i of extractable) acceptExtracted(i.key, i.score)
                toast({
                  tone: 'info',
                  title: 'Extracted items accepted',
                  detail: 'The untested items remain blank. Score them or leave them as not tested.',
                })
              }}
            >
              Accept all {extractable.length} extracted items
            </Button>
          </Card>
        )}

        <SectionCard
          title="The fifteen items"
          meta={<span className="tabular text-[0.88em] text-ink-3">total {total}</span>}
        >
          <ul className="divide-y divide-glass-hairline">
            {NIHSS_ITEMS.map((item) => {
              const value = scores[item.key]
              return (
                <li key={item.key} className={cx('rounded-panel px-3 py-3', value === null && 'bg-caution-soft/25')}>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        <span className="tabular mr-2 text-ink-3">{item.key}</span>
                        {item.label}
                      </p>
                      <p className="text-[0.86em] text-ink-3">
                        0 to {item.max}
                        {item.note && <span className="text-ink-2"> · {item.note}</span>}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {aiActive && item.aiExtracted && value === null && (
                        <FieldChip
                          touchpointId={`nihss:${c.id}:${item.key}`}
                          capabilityId="AI-112"
                          suggestion={String(item.score)}
                          band="MED"
                          score={0.78}
                          gate="G2"
                          onAccept={() => acceptExtracted(item.key, item.score)}
                          explain={{
                            touchpointId: `nihss:${c.id}:${item.key}`,
                            capabilityId: 'AI-112',
                            claim: `Item ${item.key} (${item.label}) was scored ${item.score} aloud during the examination.`,
                            confidence: 0.78,
                            band: 'MED',
                            computedAt: formatTime(caseNow),
                            inputs: [{ label: 'Session transcript', source: 'Telestroke session recording' }],
                            evidence: [item.note ?? 'Scored aloud by the examining neurologist.'],
                            model: 'extract v4.1.0',
                            limits: [
                              'Extracts only what was spoken. A silently examined item is not captured.',
                              'It never fills in an item that was not tested.',
                              'Manual scoring is the fallback and the authority.',
                            ],
                          }}
                        />
                      )}

                      <Select
                        value={value === null ? 'nt' : String(value)}
                        onChange={(e) =>
                          setScores((s) => ({
                            ...s,
                            [item.key]: e.target.value === 'nt' ? null : Number(e.target.value),
                          }))
                        }
                        aria-label={`Score for ${item.label}`}
                        className="min-h-11 w-auto py-1.5 text-[0.9em]"
                      >
                        <option value="nt">Not tested</option>
                        {Array.from({ length: item.max + 1 }, (_, n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </Select>

                      {value === null ? (
                        <Chip tone="caution" icon="CircleHelp">
                          not tested
                        </Chip>
                      ) : (
                        <Chip tone={value === 0 ? 'normal' : 'abnormal'} icon={value === 0 ? 'Check' : 'ArrowUp'}>
                          {value === 0 ? 'normal' : `${value} point${value === 1 ? '' : 's'}`}
                        </Chip>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </SectionCard>
      </div>
    </Screen>
  )
}
