/**
 * M-27's doctor slice — three screens that reuse M-06's surfaces over video.
 *
 * S-27-02 · Clinician Teleconsult Queue — `/tele/queue` · T3 · ARC-01
 * S-27-03 · Teleconsult Session — `/tele/session/:id` · T2 · ARC-22
 * S-27-04 · Tele-Prescription & Category Gate — `/tele/session/:id/rx` · T2 · ARC-07
 *
 * The screen that earns its place is S-27-04. CMP-DRUG-06 and AI-310 make the
 * prescribing-category gate HARD-CODED and never AI-decided: "the prohibited
 * list is never off." A teleconsult can prescribe less than a face-to-face
 * consultation can, and the gate is the law rather than a policy choice.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { SectionCard, Why } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Button, Card, Chip, EmptyState, Icon, KeyValue, cx } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { TELECONSULT_QUEUE, encounterForPatient, maybeEncounter } from '@/data/clinical'
import type { Encounter, TeleRow } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import { patient, patientByAnyId } from '@/data/kit'
import type { Patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { noteActionLabel } from '../m06/record/S0611'

// ───────────────────────────────────────────── S-27-02 · the queue

/** Today's teleconsult queue — shared with My Day's OPD list (`TELECONSULT_QUEUE` in data/clinical.ts). */
const QUEUE: TeleRow[] = TELECONSULT_QUEUE

// ───────────────────────────────────────────── who is on the call

interface TeleParty {
  patient: Patient
  /** The visit the note and the prescription are written against, where one exists. */
  encounter?: Encounter
}

/**
 * The session is keyed by whoever sent you here: a teleconsult encounter from
 * the queue, or a patient (SD id or UHID) from the Connect button on their
 * record. An unknown id says so instead of silently showing someone else.
 */
function teleParty(id: string | undefined): TeleParty | undefined {
  const enc = maybeEncounter(id)
  if (enc) return { patient: patient(enc.patientId), encounter: enc }
  const p = patientByAnyId(id)
  return p ? { patient: p, encounter: encounterForPatient(p.id) } : undefined
}

function NoParty({ screenId, id }: { screenId: string; id?: string }) {
  const navigate = useNavigate()
  return (
    <Screen screenId={screenId} subheading="No patient at this address.">
      <Card className="max-w-2xl">
        <EmptyState
          icon="UserX"
          why={`There is no patient or teleconsult with the id “${id ?? ''}” here. Pick one from today’s queue.`}
          action={
            <Button icon="Video" onClick={() => navigate('/tele/queue')}>
              Telehealth
            </Button>
          }
        />
      </Card>
    </Screen>
  )
}

export function S2702() {
  const navigate = useNavigate()
  const [aiSort, setAiSort] = useState(true)

  const rows = aiSort
    ? [...QUEUE].sort((a, b) => Number(b.videoReady) - Number(a.videoReady) || a.scheduledAt.getTime() - b.scheduledAt.getTime())
    : [...QUEUE].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  const columns: WorklistColumn<TeleRow>[] = [
    {
      key: 'at',
      label: 'Scheduled',
      role: 'lead',
      cell: (r) => <span className="tabular">{formatTime(r.scheduledAt)}</span>,
    },
    {
      key: 'patient',
      label: 'Patient',
      role: 'primary',
      cell: (r) => patient(r.patientId).name,
    },
    {
      key: 'reason',
      label: 'Reason',
      role: 'context',
      cell: (r) => r.reason,
    },
    {
      key: 'video',
      label: 'Video',
      role: 'status',
      cell: (r) =>
        r.videoReady ? (
          <Chip tone="normal" icon="Video">
            ready
          </Chip>
        ) : (
          <Chip tone="caution" icon="Phone">
            telephone fallback
          </Chip>
        ),
    },
  ]

  return (
    <Screen
      screenId="S-27-02"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF']}
      subheading={<>{QUEUE.length} today</>}
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">No teleconsults booked.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            A patient booking a teleconsult, or a follow-up converted to remote, would appear here.
          </p>
        </Card>
      }
      rail={
        <Why label="A telephone fallback is not a failure">
          <p className="text-ink-2">
            One patient has no working video. The consultation still happens by telephone, and the prescribing
            category gate is stricter for it — which the prescription screen enforces rather than trusting anyone to
            remember.
          </p>
        </Why>
      }
      railTitle="Teleconsult"
    >
      <Worklist
        tone="schedule"
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        onOpen={(r) => navigate(`/tele/session/${maybeEncounter(r.id) ? r.id : r.patientId}`)}
        aiSort={aiSort}
        onSortChange={setAiSort}
        sortCapability="AI-613"
        aiSortLabel="Readiness"
        deterministicLabel="Appointment time"
        caption="Today's teleconsults"
        noun="teleconsults"
        emptyWhy="No teleconsults booked. A patient booking a teleconsult would appear here."
      />
    </Screen>
  )
}

// ──────────────────────────────────────── S-27-03 · the session

export function S2703({ id }: { id?: string }) {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const [elapsed, setElapsed] = useState(0)
  const [notes, setNotes] = useState('')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [ending, setEnding] = useState(false)
  /** The call is joined on purpose, never on arrival. */
  const [joined, setJoined] = useState(false)
  const toast = useUI((s) => s.toast)

  useEffect(() => {
    if (!joined) return
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => window.clearInterval(t)
  }, [joined])

  const party = teleParty(id)
  if (!party) return <NoParty screenId="S-27-03" id={id} />
  const { patient: p, encounter: enc } = party

  return (
    <Screen
      screenId="S-27-03"
      patient={p}
      loadingShape="thread"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'AI-OFF', 'AI-LOW']}
      wide
      chips={
        joined ? (
          <Chip tone="normal" icon="Video">
            in session · {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
          </Chip>
        ) : (
          <Chip tone="neutral" icon="Video">
            Ready to join
          </Chip>
        )
      }
      actionBar={
        <>
          {joined ? (
            <Button icon="PhoneOff" tone="destructive" onClick={() => setEnding(true)}>
              End the session
            </Button>
          ) : (
            <span className="text-[0.88em] text-ink-3">Join the call to start the session</span>
          )}
          {enc && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button icon="FileText" onClick={() => navigate(`/encounter/${enc.id}/note`)}>
                {noteActionLabel(p)}
              </Button>
              <Button tone="primary" icon="Pill" onClick={() => navigate(`/tele/session/${enc.id}/rx`)}>
                Prescribe
              </Button>
            </div>
          )}
        </>
      }
      rail={
        <div className="space-y-4">
          <SectionCard title="Consent" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <dl className="divide-y divide-glass-hairline">
              <KeyValue label="Teleconsult">
                <Chip tone="normal" icon="Check">
                  taken
                </Chip>
              </KeyValue>
              <KeyValue label="Recording">
                <Chip tone="inactive" icon="X">
                  declined
                </Chip>
              </KeyValue>
              <KeyValue label="Language">English</KeyValue>
            </dl>
            <p className="mt-2 text-[0.86em] text-ink-3">
              The patient declined recording, so the transcript is not retained after the session. The note is.
            </p>
          </SectionCard>

          <Why label="What a teleconsult cannot do">
            <ul className="space-y-2 text-ink-2">
              {[
                'Palpate, percuss or auscultate',
                'Take a blood pressure or a temperature you can trust',
                'Assess a rash for texture, only for appearance',
                'Prescribe from the prohibited category list',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Icon name="X" size={13} className="mt-1 shrink-0 text-caution" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="text-[0.92em] text-ink-3">
              The last one is enforced by the prescription screen. The first three are yours to remember, and the note
              should say what you could not assess.
              {aiActive &&
                ' AI-101, the same ambient scribe as a face-to-face consultation, lands on the same note surface — off for this session because recording was declined.'}
            </p>
          </Why>
        </div>
      }
      railTitle="Session"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          {/* Video is read on black in both themes, like a scan — the tile's own colours are fixed. */}
          <div className="relative aspect-video w-full bg-[#0a0d14]">
            {joined ? (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <span className="mx-auto flex size-16 items-center justify-center rounded-pill bg-[#1a2030] text-[#6b7690]">
                      <Icon name="User" size={30} />
                    </span>
                    <p className="mt-2 text-[0.9em] text-[#8b94a8]">{p.name}</p>
                  </div>
                </div>
                <div className="absolute right-3 bottom-3 flex size-24 items-center justify-center rounded-panel bg-[#151b28]">
                  <Icon name="User" size={18} className="text-[#6b7690]" />
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <p className="text-[0.9em] text-on-image-ink">{p.name}</p>
                <Button tone="primary" size="lg" icon="Video" onClick={() => setJoined(true)}>
                  Join call
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <Button size="sm" icon={muted ? 'MicOff' : 'Mic'} aria-pressed={muted} tone={muted ? 'primary' : 'secondary'} onClick={() => setMuted((m) => !m)}>
              {muted ? 'Unmute' : 'Mute'}
            </Button>
            <Button size="sm" icon="Video" aria-pressed={cameraOff} tone={cameraOff ? 'primary' : 'secondary'} onClick={() => setCameraOff((v) => !v)}>
              {cameraOff ? 'Camera off' : 'Camera'}
            </Button>
            <Button
              size="sm"
              icon="Image"
              onClick={() => toast({ tone: 'info', title: 'No photographs uploaded', detail: `${p.name} has not sent any photographs for this teleconsult. Ask them to use the patient app.` })}
            >
              Patient photographs
            </Button>
            <span className="ml-auto text-[0.84em] text-ink-3">{formatTime(NOW)}</span>
          </div>
        </Card>

        {/* One note surface — the note the session ends with. */}
        <ScreenSection title="Your note">
          <Card className="p-4">
            <VoiceField
              id="tele-note"
              label="Teleconsult note"
              rows={10}
              value={notes}
              onChange={setNotes}
              patientId={p.id}
              placeholder="What you observed over video, and what you could not assess…"
              hint="What you could not examine matters as much as what you could. Record both. Dictation uses your microphone only; the teleconsult itself is not recorded."
            />
          </Card>
        </ScreenSection>
      </div>

      <ConfirmDialog
        open={ending}
        title="End the teleconsult?"
        consequence="The video call closes for the patient too. Your note stays a draft, and the prescription you have started is kept."
        confirmLabel="End the session"
        tone="destructive"
        onConfirm={() => {
          setEnding(false)
          toast({ tone: 'info', title: 'Teleconsult ended', detail: `${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, '0')} s with ${p.name}.` })
          navigate('/tele/queue')
        }}
        onCancel={() => setEnding(false)}
      />
    </Screen>
  )
}

// ─────────────────────────────── S-27-04 · the category gate

type Category = 'O' | 'A' | 'B' | 'Prohibited'

const TELE_FORMULARY: { drug: string; category: Category; why: string }[] = [
  { drug: 'Paracetamol 1g IV', category: 'O', why: 'Over-the-counter. Prescribable on any consultation mode.' },
  { drug: 'Atorvastatin 40mg', category: 'B', why: 'Add-on to an existing prescription for the same condition only.' },
  { drug: 'Metformin 500mg', category: 'B', why: 'Add-on for an established condition already under management.' },
  { drug: 'Co-amoxiclav 1.2g IV', category: 'A', why: 'Permitted on a first video teleconsult, or a re-consult for the same condition.' },
  { drug: 'Clopidogrel 75mg', category: 'B', why: 'Add-on only; not a first prescription by telemedicine.' },
  { drug: 'Tenecteplase', category: 'Prohibited', why: 'Never by telemedicine. Parenteral thrombolytic.' },
]

const CATEGORY_TONE: Record<Category, 'normal' | 'brand' | 'caution' | 'critical'> = {
  O: 'normal',
  A: 'brand',
  B: 'caution',
  Prohibited: 'critical',
}

export function S2704({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)

  /** Video vs telephone changes what is prescribable. Hard-coded, not a setting. */
  const [mode, setMode] = useState<'video' | 'telephone'>('video')
  const [basket, setBasket] = useState<string[]>([])

  /** The gate. Never AI-decided; never off. */
  function blockedReason(drug: string): string | null {
    const entry = TELE_FORMULARY.find((f) => f.drug === drug)
    if (!entry) return null
    if (entry.category === 'Prohibited') {
      return 'On the prohibited list. This cannot be prescribed by telemedicine under any circumstances.'
    }
    if (mode === 'telephone' && entry.category === 'A') {
      return 'List A requires a video teleconsult. On a telephone teleconsult only List O and List B add-ons are permitted.'
    }
    return null
  }

  const blocked = basket.filter((d) => blockedReason(d) !== null)

  const party = teleParty(id)
  if (!party) return <NoParty screenId="S-27-04" id={id} />
  const { patient: p, encounter: enc } = party

  return (
    <Screen
      screenId="S-27-04"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF']}
      subheading={
        <>
          {mode} consultation
          {blocked.length > 0 && ` · ${blocked.length} blocked by the category gate`}
        </>
      }
      rail={
        <div className="space-y-4">
          <Why label="The four categories">
            <ul className="space-y-2.5">
              {[
                { c: 'O' as Category, t: 'Over-the-counter. Any consultation mode.' },
                { c: 'A' as Category, t: 'First video teleconsult, or a re-consult for the same condition.' },
                { c: 'B' as Category, t: 'Add-on to an existing prescription for the same condition only.' },
                { c: 'Prohibited' as Category, t: 'Never by telemedicine. Includes Schedule X and narcotics.' },
              ].map((x) => (
                <li key={x.c}>
                  <Chip tone={CATEGORY_TONE[x.c]}>List {x.c}</Chip>
                  <p className="mt-1 text-[0.88em] text-ink-2">{x.t}</p>
                </li>
              ))}
            </ul>
            <p className="text-[0.92em] text-ink-3">
              Telemedicine Practice Guidelines 2020 · CMP-DRUG-06. The prohibited list is hard-coded and never
              AI-decided. {aiActive ? 'AI-310' : 'The static list'} decides nothing here — it is a regulatory
              boundary, and it holds with the AI on or off.
            </p>
          </Why>
        </div>
      }
      railTitle="Category gate"
      actionBar={
        <>
          <div className="flex items-center gap-1.5">
            <Button size="sm" tone={mode === 'video' ? 'primary' : 'secondary'} onClick={() => setMode('video')}>
              Video
            </Button>
            <Button size="sm" tone={mode === 'telephone' ? 'primary' : 'secondary'} onClick={() => setMode('telephone')}>
              Telephone
            </Button>
          </div>
          <span className="text-[0.88em] text-ink-3">
            {blocked.length > 0
              ? 'Remove the blocked items before signing'
              : `${basket.length} item${basket.length === 1 ? '' : 's'} · HPR printed on the prescription`}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Signature"
            disabled={basket.length === 0 || blocked.length > 0}
            onClick={() => {
              toast({
                tone: 'success',
                title: 'Tele-prescription signed',
                detail: 'Printed bilingually with your HPR number, and published to ABDM.',
              })
              navigate('/tele/queue')
            }}
          >
            Sign the tele-prescription
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <ScreenSection title="Formulary, filtered by mode">
            <Card className="overflow-hidden">
              <ul className="divide-y divide-glass-hairline">
                {TELE_FORMULARY.map((f) => {
                  const reason = blockedReason(f.drug)
                  return (
                    <li key={f.drug} className={cx('px-4 py-3', reason && 'bg-critical-soft/30')}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 font-medium">
                            {f.drug}
                            <Chip tone={CATEGORY_TONE[f.category]} title={f.why}>
                              List {f.category}
                            </Chip>
                          </p>
                        </div>
                        {reason ? (
                          <Chip tone="critical" icon="Ban">
                            blocked
                          </Chip>
                        ) : (
                          <Button
                            size="sm"
                            icon="Plus"
                            disabled={basket.includes(f.drug)}
                            onClick={() => setBasket((b) => [...b, f.drug])}
                          >
                            Add
                          </Button>
                        )}
                      </div>
                      {/* The blocked reason shown once, here — not on the chip title too. */}
                      {reason && (
                        <p className="mt-2 flex items-start gap-2 rounded-panel bg-critical-soft px-3 py-2 text-[0.88em] font-medium text-critical">
                          <Icon name="OctagonAlert" size={13} className="mt-0.5 shrink-0" />
                          {reason}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>
            </Card>
          </ScreenSection>

          <ScreenSection title="Prescription">
            {basket.length === 0 ? (
              <Card className="p-8 text-center text-ink-2">
                Nothing added yet. The formulary on the left shows which categories this consultation mode permits.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y divide-glass-hairline">
                  {basket.map((d) => {
                    const entry = TELE_FORMULARY.find((f) => f.drug === d)!
                    const reason = blockedReason(d)
                    return (
                      <li key={d} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex flex-wrap items-center gap-2 font-medium">
                            {d}
                            <Chip tone={CATEGORY_TONE[entry.category]}>List {entry.category}</Chip>
                          </span>
                          <Button
                            size="sm"
                            tone="tertiary"
                            icon="Trash2"
                            onClick={() => setBasket((b) => b.filter((x) => x !== d))}
                          >
                            Remove
                          </Button>
                        </div>
                        {/* The reason already appears once on the formulary row; the basket
                            just needs to say the item cannot be signed. */}
                        {reason && (
                          <p className="mt-2 text-[0.88em] font-medium text-critical">
                            <Icon name="Ban" size={12} className="mr-1 inline" />
                            Blocked — cannot be signed
                          </p>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <p className="border-t border-glass-hairline px-4 py-3 text-[0.86em] text-ink-3">
                  Signing prints bilingually with your HPR number and publishes a Prescription record to ABDM. No PHI
                  goes out in any SMS — only a pointer back in.
                </p>
              </Card>
            )}
          </ScreenSection>
        </div>

        <Why label="Why the formulary changes with the mode">
          <p className="text-ink-2">
            Switching between video and telephone changes what is prescribable, because the guidelines tie the
            category to the consultation mode — try the toggle in the bar below and watch the formulary change.
          </p>
          <p className="text-[0.92em] text-ink-3">
            Signing publishes a Prescription record to ABDM; no PHI goes out in any SMS, only a pointer back in.
            {enc && (
              <>
                Encounter {enc.encounterNo} · {formatDateTime(enc.startedAt)} ·{' '}
              </>
            )}
            The same note and prescription surfaces as a face-to-face consultation, with one extra gate that the law
            puts there.
          </p>
        </Why>
      </div>
    </Screen>
  )
}
