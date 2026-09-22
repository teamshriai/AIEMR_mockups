/**
 * S-18-18 · EVT Selection & Cath Lab Decision — `/stroke/case/:id/evt` · T2 · ARC-14
 *
 * "Selecting for thrombectomy, and recording the disagreement."
 *
 * The second half of that title is the unusual part and the reason the screen
 * is worth building: where the neurologist and the interventionist disagree,
 * the disagreement is recorded rather than resolved silently. A decision that
 * looks unanimous in the record when it was not is the version nobody can
 * learn from.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Checklist } from '@/archetypes'
import { Confidence, Diamond } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Chip, Icon, KeyValue, Select, TextArea } from '@/components/primitives'
import { SplitBar } from '@/components/charts'
import { formatRupees, formatTime } from '@/data/format'
import { STAFF, patient, tariff } from '@/data/kit'
import { EVT_CRITERIA, EVT_OUTCOME_PREDICTION, PERFUSION, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

export function S1818({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const { evtDisagreement, recordEvtDisagreement } = useStroke()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  const [disagreeOpen, setDisagreeOpen] = useState(false)
  const [disagreeBy, setDisagreeBy] = useState('Dr Rohit Desai')
  const [disagreeReason, setDisagreeReason] = useState('')
  const [selected, setSelected] = useState(false)

  const blocking = EVT_CRITERIA.filter((x) => x.state === 'blocks' || x.state === 'contraindicated')
  const evtTariff = tariff('SD-M-08')

  const items = EVT_CRITERIA.map((crit) => ({
    key: crit.key,
    label: crit.label,
    answer: <span className="tabular">{crit.answer}</span>,
    consequence: crit.consequence,
    state: crit.state,
  }))

  return (
    <Screen
      screenId="S-18-18"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-LOW']}
      chips={
        <>
          <Chip tone={blocking.length === 0 ? 'normal' : 'abnormal'} icon={blocking.length === 0 ? 'Check' : 'Ban'}>
            {items.length - blocking.length} of {items.length} clear
          </Chip>
          {evtDisagreement && (
            <Chip tone="caution" icon="MessageSquareWarning">
              disagreement recorded
            </Chip>
          )}
        </>
      }
      actions={
        <Button icon="Activity" onClick={() => navigate(`/stroke/case/${c.id}/perfusion`)}>
          Perfusion
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Imaging selection</h3>
            <SplitBar
              unit="mL"
              parts={[
                { label: 'Core', value: PERFUSION.coreMl, slot: 1 },
                { label: 'Penumbra', value: PERFUSION.penumbraMl, slot: 2 },
              ]}
              caption={`ratio ${PERFUSION.mismatchRatio}`}
            />
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Cost</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Self-pay">
                <span className="tabular">{formatRupees(evtTariff.selfPay)}</span>
              </KeyValue>
              <KeyValue label="PM-JAY (HBP)">
                <span className="tabular">{evtTariff.pmjay ? formatRupees(evtTariff.pmjay) : '⊘'}</span>
              </KeyValue>
              <KeyValue label="TPA negotiated">
                <span className="tabular">{formatRupees(evtTariff.tpa)}</span>
              </KeyValue>
            </dl>
            <p className="mt-2.5 rounded-panel bg-normal-soft px-3 py-2 text-[0.88em] font-medium text-normal">
              <Icon name="Check" size={13} className="mr-1 inline" />
              Shown, never blocking. The pre-authorisation runs in parallel.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Why disagreement is recorded
            </h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A neurologist and an interventionist can read the same perfusion map differently, and both can be
              reasonable. Recording the disagreement is how the registry learns which reading was right — a record that
              shows unanimity it did not have teaches nobody anything.
            </p>
          </Card>
        </div>
      }
      railTitle="Decision"
      actionBar={
        <>
          <Button icon="MessageSquareWarning" onClick={() => setDisagreeOpen(true)}>
            Record a disagreement
          </Button>
          <span className="text-[0.88em] text-ink-3">
            {blocking.length > 0 ? `${blocking.length} criterion outstanding` : 'Criteria met'}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Route"
            disabled={blocking.length > 0 || selected}
            onClick={() => {
              setSelected(true)
              toast({
                tone: 'success',
                title: 'Selected for thrombectomy',
                detail: `${me.name} at ${formatTime(caseNow)}. The cath lab reservation moves to the transfer screen.`,
              })
              navigate(`/stroke/case/${c.id}/transfer`)
            }}
          >
            {selected ? 'Selected' : 'Select for thrombectomy'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {evtDisagreement && (
          <Alert tone="caution" title={`Disagreement recorded by ${evtDisagreement.by}`}>
            &ldquo;{evtDisagreement.reason}&rdquo; — recorded at {formatTime(evtDisagreement.at)}. It sits alongside
            the decision in the case record and in the registry export.
          </Alert>
        )}

        <ScreenSection title="Selection criteria">
          <Checklist items={items} />
        </ScreenSection>

        {aiActive && (
          <ScreenSection title="Predicted outcome" subtitle="With and without thrombectomy, on the same scale">
            <Card className="p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: 'With thrombectomy', v: EVT_OUTCOME_PREDICTION.withEvt.goodOutcome, slot: 1 },
                  { label: 'Without', v: EVT_OUTCOME_PREDICTION.withoutEvt.goodOutcome, slot: 2 },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular text-xl font-bold">{Math.round(row.v * 100)}%</span>
                    </div>
                    <div className="mt-1.5 h-3 overflow-hidden rounded-pill bg-glass-fill-muted">
                      <div
                        className="h-full rounded-pill"
                        style={{
                          width: `${row.v * 100}%`,
                          backgroundColor: row.slot === 1 ? 'var(--color-viz-1)' : 'var(--color-viz-2)',
                        }}
                      />
                    </div>
                    <p className="mt-1 text-[0.86em] text-ink-3">{EVT_OUTCOME_PREDICTION.withEvt.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                  <Diamond size={10} />
                  AI-221
                </span>
                <Confidence band={EVT_OUTCOME_PREDICTION.band} score={EVT_OUTCOME_PREDICTION.confidence} />
                <span className="tabular text-[0.84em] text-ink-3">{EVT_OUTCOME_PREDICTION.model}</span>
              </div>

              <p className="mt-2.5 rounded-panel bg-caution-soft px-3 py-2.5 text-[0.9em] font-medium text-caution">
                <Icon name="TriangleAlert" size={13} className="mr-1 inline" />
                {EVT_OUTCOME_PREDICTION.limits}
              </p>
              <p className="mt-2 text-[0.88em] text-ink-2">
                This is a prediction about a population, applied to one person. It informs the conversation with the
                family; it does not make the decision.
              </p>
            </Card>
          </ScreenSection>
        )}
      </div>

      <ConfirmDialog
        open={disagreeOpen}
        title="Record a disagreement"
        consequence="This is recorded against the decision and travels with it into the registry. It does not block the decision or require it to be revisited — it makes the record honest about how the decision was reached."
        confirmLabel="Record it"
        onConfirm={() => {
          if (disagreeReason.trim().length < 10) return
          recordEvtDisagreement(disagreeBy, disagreeReason.trim())
          toast({ tone: 'info', title: 'Disagreement recorded', detail: `${disagreeBy} · ${formatTime(caseNow)}` })
          setDisagreeOpen(false)
          setDisagreeReason('')
        }}
        onCancel={() => {
          setDisagreeOpen(false)
          setDisagreeReason('')
        }}
      >
        <div className="space-y-3">
          <Select value={disagreeBy} onChange={(e) => setDisagreeBy(e.target.value)} aria-label="Who disagrees">
            {STAFF.filter((s) => s.identifierKind === 'HPR').map((s) => (
              <option key={s.id} value={s.name}>
                {s.name} · {s.personaLabel}
              </option>
            ))}
          </Select>
          <TextArea
            rows={3}
            value={disagreeReason}
            onChange={(e) => setDisagreeReason(e.target.value)}
            placeholder="What they read differently, and why — at least ten characters…"
          />
        </div>
      </ConfirmDialog>
    </Screen>
  )
}
