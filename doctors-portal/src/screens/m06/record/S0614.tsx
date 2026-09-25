/**
 * S-06-14 · Saved notes — `/patient/:id/notes` · T2 · ARC-02
 *
 * "What was written last time, and what was dictated today, in one place."
 *
 * Three groups, newest first: notes dictated today (drafts until signed —
 * signing here is what takes them off My Day's "to sign" list), today's
 * consultation note if one has been started, and every earlier SOAP note.
 * An earlier note opens to its four sections; closed, it is one line.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { CountPill, SectionCard } from '@/components/calm'
import { DictationPanel } from '@/components/dictation'
import { Button, Chip, EmptyState, Icon, IconButton } from '@/components/primitives'
import { formatDate, formatTime } from '@/data/format'
import type { Patient } from '@/data/kit'
import { pastNotesFor } from '@/data/record'
import type { PastNote } from '@/data/record'
import { useAudit } from '@/store/audit'
import { useClinical } from '@/store/clinical'
import type { VoiceNote } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'

import { consultPath, noteActionLabel } from './S0611'
import { RecordScreen, useSessionNotesFor, useVoiceNotesFor } from './shared'

const SOAP: { key: 'subjective' | 'objective' | 'assessment' | 'plan'; label: string }[] = [
  { key: 'subjective', label: 'Subjective' },
  { key: 'objective', label: 'Objective' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'plan', label: 'Plan' },
]

export function S0614({ id }: { id?: string }) {
  const [dictating, setDictating] = useState<Patient | null>(null)
  return (
    <>
      <RecordScreen
        id={id}
        section="notes"
        actions={(p) => (
          <Button tone="primary" icon="Mic" onClick={() => setDictating(p)}>
            Add note
          </Button>
        )}
      >
        {(p) => <Notes patient={p} />}
      </RecordScreen>
      <DictationPanel
        open={dictating !== null}
        onClose={() => setDictating(null)}
        patientId={dictating?.id}
        patientName={dictating?.name}
      />
    </>
  )
}

function Notes({ patient: p }: { patient: Patient }) {
  const navigate = useNavigate()
  const voice = useVoiceNotesFor(p.id)
  const session = useSessionNotesFor(p.id)
  const past = pastNotesFor(p.id)
  const consult = consultPath(p)
  const nothing = voice.length === 0 && session.length === 0 && past.length === 0

  if (nothing) {
    return (
      <SectionCard title="Saved notes">
        <EmptyState
          icon="FileText"
          why={`Nothing has been written on ${p.name}’s record yet. A dictated note, or a consultation note once started, will appear here.`}
          action={
            consult && (
              <Button icon="Stethoscope" onClick={() => navigate(consult)}>
                {noteActionLabel(p)}
              </Button>
            )
          }
        />
      </SectionCard>
    )
  }

  return (
    <>
      {voice.length > 0 && (
        <SectionCard
          title="Dictated"
          meta={<CountPill tone={voice.some((n) => n.status === 'draft') ? 'pending' : 'neutral'}>{voice.length}</CountPill>}
        >
          <ul className="divide-y divide-glass-hairline">
            {voice.map((n) => (
              <VoiceNoteRow key={n.id} patient={p} note={n} />
            ))}
          </ul>
        </SectionCard>
      )}

      {session.map(({ encounter, record }) => (
        <SectionCard
          key={encounter.id}
          title="This visit"
          meta={
            <Chip tone={record.status === 'signed' ? 'normal' : 'caution'} icon={record.status === 'signed' ? 'Signature' : 'PenLine'}>
              {record.status === 'signed' ? `Signed ${record.signedAt ? formatTime(record.signedAt) : ''}` : 'Draft'}
            </Chip>
          }
          action={
            consult && (
              <Button size="sm" icon="ArrowRight" onClick={() => navigate(consult)}>
                Open the note
              </Button>
            )
          }
          bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
        >
          <dl className="grid gap-3 sm:grid-cols-2">
            {SOAP.filter((s) => (record.text[s.key] ?? '').trim() !== '').map((s) => (
              <div key={s.key} className="min-w-0">
                <dt className="text-[0.8em] font-bold tracking-[0.08em] text-ink-3 uppercase">{s.label}</dt>
                <dd className="mt-1 leading-relaxed whitespace-pre-line text-ink-2">{record.text[s.key]}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      ))}

      {past.length > 0 && (
        <SectionCard title="Earlier notes" meta={<CountPill>{past.length}</CountPill>}>
          <ul className="divide-y divide-glass-hairline">
            {past.map((n) => (
              <PastNoteRow key={n.id} note={n} />
            ))}
          </ul>
        </SectionCard>
      )}
    </>
  )
}

function VoiceNoteRow({ patient: p, note: n }: { patient: Patient; note: VoiceNote }) {
  const me = useCurrentStaff()
  const sign = useClinical((s) => s.signVoiceNote)
  const remove = useClinical((s) => s.deleteVoiceNote)
  const record = useAudit((s) => s.record)
  const toast = useUI((s) => s.toast)

  function doSign() {
    sign(p.id, n.id, me.name)
    record({
      event: 'NOTE.SIGNED',
      actor: me.name,
      actorId: me.id,
      subject: p.id,
      model: n.model,
      detail: `Dictated note signed · ${n.body.trim().split(/\s+/).length} words`,
    })
    toast({ tone: 'success', title: 'Note signed', detail: `${p.name} · now part of the record` })
  }

  return (
    <li className="flex flex-wrap items-start gap-3 px-2 py-3 sm:px-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-field bg-ai-soft text-ai">
        <Icon name="Mic" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed whitespace-pre-line">{n.body}</p>
        <p className="tabular mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.86em] text-ink-3">
          <span>
            {n.by} · {formatDate(n.at)} {formatTime(n.at)}
          </span>
          <span className="flex items-center gap-1">
            <Diamond size={8} />
            {/^typed/i.test(n.model) ? 'typed' : 'dictated'}
          </span>
          {n.status === 'signed' && n.signedAt && (
            <span>
              · signed {formatTime(n.signedAt)}
              {n.signedBy ? ` by ${n.signedBy}` : ''}
            </span>
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {n.status === 'draft' ? (
          <>
            <Button size="sm" tone="primary" icon="Signature" onClick={doSign}>
              Sign
            </Button>
            <IconButton
              icon="Trash2"
              label="Discard this draft"
              onClick={() => {
                remove(p.id, n.id)
                toast({ tone: 'info', title: 'Draft discarded', detail: p.name })
              }}
              className="size-9"
              size={15}
            />
          </>
        ) : (
          <Chip tone="normal" icon="Signature">
            Signed
          </Chip>
        )}
      </div>
    </li>
  )
}

function PastNoteRow({ note: n }: { note: PastNote }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-panel px-2 py-3 text-left transition-colors duration-150 hover:bg-glass-fill-hover sm:px-3"
      >
        <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={15} className="mt-1 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{n.kind}</span>
            <span className="text-[0.9em] text-ink-3">{n.setting}</span>
          </span>
          {!open && <span className="mt-0.5 line-clamp-1 block text-[0.92em] text-ink-2">{n.assessment}</span>}
          <span className="tabular mt-0.5 block text-[0.86em] text-ink-3">
            {formatDate(n.at)} {formatTime(n.at)} · {n.by}
          </span>
        </span>
      </button>
      {open && (
        <dl className="grid gap-3 px-4 pb-4 sm:grid-cols-2 sm:pl-11">
          {SOAP.map((s) => (
            <div key={s.key} className="min-w-0">
              <dt className="text-[0.8em] font-bold tracking-[0.08em] text-ink-3 uppercase">{s.label}</dt>
              <dd className="mt-1 leading-relaxed text-ink-2">{n[s.key]}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}
