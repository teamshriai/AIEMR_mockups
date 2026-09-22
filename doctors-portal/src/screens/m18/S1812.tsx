/**
 * S-18-12 · Remote NIHSS Assessment — `/stroke/case/:id/nihss` · T2 · ARC-14
 *
 * "A 15-item NIHSS scored over video, with the examiner recorded."
 *
 * The one rule that makes this safe: an untested item is blank, not zero.
 * Zero means normal on this scale, so defaulting an untestable item to zero
 * understates the deficit — which is the direction that costs a patient
 * treatment.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, FieldChip } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue, Select, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { NIHSS_ITEMS, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

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
  const complete = untested === 0

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
      chips={
        <>
          <Chip tone={complete ? 'normal' : 'caution'} className="tabular">
            NIHSS {total}
            {!complete && ` · ${untested} untested`}
          </Chip>
          <Chip tone="neutral" icon="Video">
            over video
          </Chip>
        </>
      }
      actions={
        <Button icon="Video" onClick={() => navigate(`/stroke/case/${c.id}/telestroke`)}>
          Back to the session
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Score</h3>
            <p className="tabular mt-1 text-4xl font-bold">{total}</p>
            <p className="text-[0.9em] text-ink-3">
              from {tested.length} of {NIHSS_ITEMS.length} items
            </p>
            <dl className="mt-3 divide-y divide-glass-hairline">
              <KeyValue label="0">No stroke symptoms</KeyValue>
              <KeyValue label="1–4">Minor</KeyValue>
              <KeyValue label="5–15">Moderate</KeyValue>
              <KeyValue label="16–20">Moderate to severe</KeyValue>
              <KeyValue label="21–42">Severe</KeyValue>
            </dl>
          </Card>

          <Card className="border-l-[3px] border-l-caution p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-caution uppercase">
              Untested is not zero
            </h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              Zero means normal. An item you could not test — ataxia in a hemiparetic limb, for instance — is recorded
              as not tested and excluded from the total, because scoring it zero would understate the deficit and could
              cost the patient treatment.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Examiner</h3>
            <p className="mt-1.5 font-medium">{me.name}</p>
            <p className="tabular text-[0.88em] text-ink-3">
              {me.identifierKind} {me.identifier}
            </p>
            <p className="mt-1.5 text-[0.86em] text-ink-2">
              Recorded against the score. A remote NIHSS is only as good as the person who did it, so the record says
              who.
            </p>
          </Card>
        </div>
      }
      railTitle="NIHSS"
      actionBar={
        <>
          <span className="text-[0.88em] text-ink-3">
            {untested > 0
              ? `${untested} item${untested === 1 ? '' : 's'} not tested — they are excluded, not counted as zero`
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
        <Alert tone="info" title="Scored over video, with the examiner named">
          A remote NIHSS is valid, and the atlas treats it as such. What makes it defensible is the record: who
          examined, over what link, at what time, and which items they could not test.
        </Alert>

        {aiActive && (
          <Card className="border-l-[3px] border-l-ai p-4">
            <p className="flex items-center gap-2 font-semibold text-ai">
              <Diamond size={11} />
              Nine items were scored aloud during the examination
            </p>
            <p className="mt-1.5 text-[0.95em] text-ink-2">
              AI-112 extracted them from the session transcript. Each one still needs your disposition, and the six you
              did not test are left blank rather than filled in.
            </p>
            <Button
              size="sm"
              tone="ai"
              className="mt-3"
              icon="Check"
              onClick={() => {
                for (const i of NIHSS_ITEMS.filter((x) => x.aiExtracted)) acceptExtracted(i.key, i.score)
                toast({
                  tone: 'info',
                  title: 'Extracted items accepted',
                  detail: 'The six untested items remain blank. Score them or leave them as not tested.',
                })
              }}
            >
              Accept all nine extracted items
            </Button>
          </Card>
        )}

        <ScreenSection title="The fifteen items">
          <Card className="overflow-hidden">
            <ul className="divide-y divide-glass-hairline">
              {NIHSS_ITEMS.map((item) => {
                const value = scores[item.key]
                return (
                  <li
                    key={item.key}
                    className={cx('px-5 py-3.5', value === null && 'bg-caution-soft/25')}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">
                          <span className="tabular mr-2 text-ink-3">{item.key}</span>
                          {item.label}
                        </p>
                        <p className="text-[0.86em] text-ink-3">0 to {item.max}</p>
                        {item.note && (
                          <p className="mt-0.5 text-[0.88em] text-ink-2">{item.note}</p>
                        )}
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
                          className="min-h-10 w-auto py-1.5 text-[0.9em]"
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
          </Card>
        </ScreenSection>

        <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          Total {total} from {tested.length} items, examined by {me.name} over video at {formatTime(caseNow)}. The six
          untested items are recorded as untested and are visible to anyone reading the score later.
        </p>
      </div>
    </Screen>
  )
}
