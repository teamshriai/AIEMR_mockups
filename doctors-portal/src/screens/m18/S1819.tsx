/**
 * S-18-19 · Transfer, DIDO Clock & Single-Act Reservation — `/stroke/case/:id/transfer` · T2 · ARC-08
 *
 * "One action that holds an ambulance, a cath lab, an anaesthetist and a bed."
 *
 * DD-012 is the reason this screen exists in the shape it does: "Single-act
 * reservation must hold a bed, a cath lab and an ambulance ATOMICALLY." The
 * atlas calls it "the exception that justifies itself" — it is the one place
 * the flagship reaches upward across module boundaries, and the reason is that
 * a transfer with three of four resources is not a transfer.
 *
 * So the reservation is all-or-nothing, and a partial failure names the
 * resource that failed rather than leaving you half-committed.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ClockRing } from '@/archetypes'
import { Diamond, WhyLink } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Chip, Icon, KeyValue, cx } from '@/components/primitives'
import { formatElapsed, formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { TRANSFER_RESERVATION, TRANSFER_ROUTE, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock, useLiveIntervals } from './CaseClock'

export function S1819({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const intervals = useLiveIntervals()
  const { reservationHeld, reservationAt, holdReservation, releaseReservation, stamp, isStamped } = useStroke()

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)

  const [confirmHold, setConfirmHold] = useState(false)
  const [simulateFailure, setSimulateFailure] = useState(false)

  const dido = intervals.find((i) => i.key === 'dido')
  const needleGiven = isStamped('needle')
  /** All four, or none. */
  const allAvailable = TRANSFER_RESERVATION.every((r) => r.status === 'available') && !simulateFailure
  const failedResource = simulateFailure ? TRANSFER_RESERVATION[1] : null

  return (
    <Screen
      screenId="S-18-19"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-ABSTAIN']}
      chips={
        <>
          {dido && (
            <Chip tone={dido.state === 'BREACH' ? 'abnormal' : 'caution'} className="tabular">
              DIDO {dido.elapsed}/{dido.targetMin} min
            </Chip>
          )}
          <Chip tone={reservationHeld ? 'normal' : 'neutral'} icon={reservationHeld ? 'Check' : 'Lock'}>
            {reservationHeld ? 'four resources held' : 'nothing held'}
          </Chip>
        </>
      }
      actions={
        <Button icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
          Case clock
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">The DIDO clock</h3>
            <div className="mt-3 flex justify-center">
              {dido && (
                <ClockRing
                  label={dido.label}
                  elapsedMin={dido.elapsed}
                  targetMin={dido.targetMin}
                  state={dido.state}
                  size={110}
                />
              )}
            </div>
            <p className="mt-2 text-center text-[0.9em] text-ink-2">Door-in to door-out at the spoke</p>
            {dido?.blockingStep && (
              <p className="mt-2 rounded-panel bg-abnormal-soft px-3 py-2 text-[0.88em] font-medium text-abnormal">
                {dido.blockingStep}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Why all four or none
            </h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              An ambulance with no cath lab at the other end is a two-hour journey to a closed door. A cath lab with no
              anaesthetist is a team standing around. The reservation is atomic because a transfer with three of four
              resources is not a transfer.
            </p>
            <p className="mt-2 text-[0.86em] text-ink-3">
              DD-012 · the one place the flagship reaches across module boundaries, and the reason it is allowed to.
            </p>
          </Card>
        </div>
      }
      railTitle="Transfer"
      actionBar={
        <>
          {reservationHeld ? (
            <>
              <Button icon="Undo2" onClick={releaseReservation}>
                Release the reservation
              </Button>
              <span className="tabular text-[0.88em] text-normal">
                Held since {reservationAt ? formatTime(reservationAt) : '—'} · all four
              </span>
              <Button
                tone="primary"
                className="ml-auto"
                icon="Ambulance"
                disabled={isStamped('door-out')}
                onClick={() => {
                  stamp('door-out', 'Door-out', me.name)
                  toast({
                    tone: 'success',
                    title: 'Door-out stamped',
                    detail: `DIDO closed at ${dido?.elapsed} min. The ambulance is loaded and moving.`,
                  })
                }}
              >
                {isStamped('door-out') ? 'Door-out stamped' : 'Load and stamp door-out'}
              </Button>
            </>
          ) : (
            <>
              <Button
                icon="TriangleAlert"
                onClick={() => setSimulateFailure((v) => !v)}
                title="Show what a partial failure looks like"
              >
                {simulateFailure ? 'Restore the cath lab' : 'Simulate a lost resource'}
              </Button>
              <span className="text-[0.88em] text-ink-3">
                {allAvailable ? 'All four are available' : `${failedResource?.resource} is no longer available`}
              </span>
              <Button
                tone="primary"
                className="ml-auto"
                icon="Lock"
                disabled={!allAvailable}
                onClick={() => setConfirmHold(true)}
              >
                Hold all four
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="space-y-5">
        {!needleGiven && (
          <Alert tone="caution" title="The needle has not been stamped">
            This is a drip-and-ship transfer, so the bolus is given before the patient is loaded. Loading first is why
            the task board blocks that step.
          </Alert>
        )}

        {!allAvailable && (
          <Alert tone="abnormal" role="alert" title={`${failedResource?.resource} is no longer available`}>
            The whole reservation is refused rather than partially committed. {failedResource?.detail} —{' '}
            {failedResource?.ownerModule} owns it, and it has been taken by another case. Nothing has been held, so you
            are not half-committed to a transfer you cannot complete.
          </Alert>
        )}

        {reservationHeld && (
          <Alert tone="normal" title="All four held atomically">
            Reserved at {reservationAt ? formatTime(reservationAt) : '—'} by {me.name}. If any one of them is lost, the
            whole hold is released and you are told which — you will never discover it on arrival.
          </Alert>
        )}

        <ScreenSection title="The four resources" subtitle="Held together, or not at all">
          <div className="grid gap-4 sm:grid-cols-2">
            {TRANSFER_RESERVATION.map((r) => {
              const lost = simulateFailure && r.key === 'cathlab'
              return (
                <Card
                  key={r.key}
                  className={cx(
                    'p-4',
                    reservationHeld && 'border-normal/40',
                    lost && 'border-abnormal/50 bg-abnormal-soft/30',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{r.resource}</p>
                      <p className="text-[0.9em] text-ink-2">{r.detail}</p>
                    </div>
                    <Chip
                      tone={lost ? 'abnormal' : reservationHeld ? 'normal' : 'neutral'}
                      icon={lost ? 'Ban' : reservationHeld ? 'Lock' : 'Check'}
                    >
                      {lost ? 'taken' : reservationHeld ? 'held' : r.status}
                    </Chip>
                  </div>
                  <p className="mt-2 flex items-center gap-1.5 text-[0.84em] text-ink-3">
                    <Icon name="Layers" size={12} />
                    owned by {r.ownerModule}
                  </p>
                </Card>
              )
            })}
          </div>
        </ScreenSection>

        <ScreenSection title="The journey">
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-2 font-semibold">
                <Icon name="Building2" size={16} className="text-ink-3" />
                {TRANSFER_ROUTE.from}
              </span>
              <Icon name="ArrowRight" size={16} className="text-ink-muted" />
              <span className="flex items-center gap-2 font-semibold">
                <Icon name="Hospital" size={16} className="text-ink-3" />
                {TRANSFER_ROUTE.to}
              </span>
            </div>

            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-panel bg-glass-fill-muted px-3.5 py-3">
                <dt className="text-[0.82em] tracking-wide text-ink-3 uppercase">Distance</dt>
                <dd className="tabular mt-1 text-lg font-semibold">{TRANSFER_ROUTE.distanceKm} km</dd>
              </div>
              <div className="rounded-panel bg-glass-fill-muted px-3.5 py-3">
                <dt className="text-[0.82em] tracking-wide text-ink-3 uppercase">Mode</dt>
                <dd className="mt-1 font-semibold">{TRANSFER_ROUTE.mode}</dd>
              </div>
              <div className="rounded-panel bg-glass-fill-muted px-3.5 py-3">
                <dt className="flex items-center gap-1.5 text-[0.82em] tracking-wide text-ink-3 uppercase">
                  ETA
                  {aiActive && <Diamond size={8} />}
                </dt>
                <dd className="tabular mt-1 text-lg font-semibold">{formatElapsed(TRANSFER_ROUTE.etaMinutes)}</dd>
              </div>
            </dl>

            {aiActive && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="text-[0.86em] text-ink-3">
                  AI-616 · {TRANSFER_ROUTE.aiEta.model}
                </span>
                <WhyLink
                  target={{
                    touchpointId: `transfer:${c.id}:eta`,
                    capabilityId: 'AI-616',
                    claim: `The transfer is predicted to take about ${formatElapsed(TRANSFER_ROUTE.etaMinutes)} door to door.`,
                    confidence: TRANSFER_ROUTE.aiEta.confidence,
                    band: TRANSFER_ROUTE.aiEta.band,
                    computedAt: formatTime(caseNow),
                    inputs: [
                      { label: 'Ambulance GPS position', source: 'AMB-INS-03' },
                      { label: 'Air ambulance availability', source: 'Transport desk' },
                      { label: 'Historical transfer times on this route', source: 'Stroke registry' },
                    ],
                    evidence: [
                      `${TRANSFER_ROUTE.distanceKm} km makes a road transfer implausible inside the window.`,
                      'Air to HAL then road is the route the network uses for this pair.',
                    ],
                    model: TRANSFER_ROUTE.aiEta.model,
                    limits: [
                      'GPS position remains available if this is unavailable — you lose the estimate, not the tracking.',
                      'It does not know whether the aircraft is fuelled.',
                      'Weather is not an input, which is the commonest reason it is wrong.',
                    ],
                  }}
                />
              </div>
            )}

            <p className="mt-3 flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2.5 text-[0.9em] font-medium text-caution">
              <Icon name="TriangleAlert" size={14} className="mt-0.5 shrink-0" />
              {TRANSFER_ROUTE.distanceKm} km is too far for a road transfer inside any meaningful window. The network
              topology forces air transport for this pair, and the screen says so rather than quoting a road ETA nobody
              can meet.
            </p>
          </Card>
        </ScreenSection>

        <Card className="p-4">
          <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Handover pack</h3>
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {[
              'Imaging, pushed ahead of the patient',
              'NIHSS with the examiner named',
              'Thrombolysis time, dose and second checker',
              'Every stamped clock event',
              'Allergies and the medication list',
              'Next of kin and the consent discussion',
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-[0.92em] text-ink-2">
                <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[0.86em] text-ink-3">
            The pack travels before the ambulance does, so the receiving team is reading it while the patient is in the
            air.
          </p>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmHold}
        title="Hold all four resources?"
        consequence="The ambulance, the cath lab, the anaesthetist and the neuro-ICU bed are reserved in one atomic action. If any one of them cannot be held, none is — and you are told which failed. Holding them takes them away from other cases, so release the hold if the transfer is called off."
        confirmLabel="Hold all four"
        onConfirm={() => {
          holdReservation()
          setConfirmHold(false)
          toast({
            tone: 'success',
            title: 'Four resources held',
            detail: `Atomic reservation by ${me.name} at ${formatTime(caseNow)}.`,
          })
        }}
        onCancel={() => setConfirmHold(false)}
      >
        <dl className="divide-y divide-glass-hairline">
          {TRANSFER_RESERVATION.map((r) => (
            <KeyValue key={r.key} label={r.resource}>
              {r.detail}
            </KeyValue>
          ))}
        </dl>
      </ConfirmDialog>
    </Screen>
  )
}
