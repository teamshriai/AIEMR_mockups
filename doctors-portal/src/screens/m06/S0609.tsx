/**
 * S-06-09 · Co-Sign & Amendment Queue — `/clinician/cosign` · T3 · ARC-08
 *
 * "What still needs a consultant's signature."
 *
 * CMP-NABH-03 makes countersigning an accreditation requirement rather than a
 * courtesy, and CMP-NABH-10 governs what happens when you disagree: you do not
 * edit the registrar's entry, you append your own.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { ConfirmDialog } from '@/components/overlays'
import { Card, Chip, Icon } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { COSIGN_QUEUE } from '@/data/clinical'
import type { CoSignRow } from '@/data/clinical'
import { formatDateTime, formatElapsed, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

export function S0609() {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const { coSigned, coSign, notes } = useClinical()

  const [aiSort, setAiSort] = useState(true)
  const [acting, setActing] = useState<{ row: CoSignRow; outcome: 'co-signed' | 'returned' } | null>(null)
  const [returnNote, setReturnNote] = useState('')

  /** Notes a registrar saved for co-sign this session join the queue. */
  const fromSession: CoSignRow[] = Object.values(notes)
    .filter((n) => n.status === 'cosign-pending')
    .map((n, i) => ({
      id: `CS-LIVE-${i}`,
      patientId: 'SD-P-01',
      documentKind: 'Consultation note' as const,
      authoredBy: n.signedBy ?? 'Registrar',
      authoredByPersona: 'P-05 Resident',
      authoredAt: n.signedAt ? new Date(n.signedAt) : NOW,
      qualityFlags: [],
      kind: 'cosign' as const,
    }))

  const all = [...fromSession, ...COSIGN_QUEUE].filter((r) => !coSigned[r.id])
  const rows = aiSort
    ? [...all].sort((a, b) => b.qualityFlags.length - a.qualityFlags.length)
    : [...all].sort((a, b) => a.authoredAt.getTime() - b.authoredAt.getTime())

  const columns: WorklistColumn<CoSignRow>[] = [
    {
      key: 'waiting',
      label: 'Waiting',
      role: 'lead',
      cell: (row) => formatElapsed((NOW.getTime() - row.authoredAt.getTime()) / 60000),
    },
    {
      key: 'patient',
      label: 'Patient',
      role: 'primary',
      cell: (row) => patient(row.patientId).name,
    },
    { key: 'kind', label: 'Document', role: 'context', cell: (row) => row.documentKind },
    {
      /* Who wrote it. Their grade and the bed are on the note itself. */
      key: 'author',
      label: 'Authored by',
      role: 'context',
      cell: (row) => row.authoredBy,
    },
    {
      /*
       * One chip per flag, the flag's words, no ◆. AI-114's provenance is on
       * the chip's title and on the note; a flag the consultant has to READ
       * before signing does not need a second marker in front of it.
       */
      key: 'quality',
      label: 'Quality check',
      role: 'status',
      cell: (row) =>
        row.qualityFlags.length === 0 ? (
          <Chip tone="normal" icon="Check">
            Clean
          </Chip>
        ) : (
          <span className="flex flex-col items-end gap-1">
            {row.qualityFlags.map((f) => (
              <Chip key={f} tone="caution" icon="TriangleAlert" title="AI-114 · CMP-NABH-05">
                {f}
              </Chip>
            ))}
          </span>
        ),
    },
    {
      key: 'actions',
      label: '',
      role: 'status',
      className: 'text-right',
      cell: (row) => (
        <span className="flex justify-end gap-1.5">
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              setActing({ row, outcome: 'returned' })
            }}
            className="inline-flex min-h-9 cursor-pointer items-center rounded-pill px-3 py-1 text-[0.86em] font-medium text-ink-3 hover:bg-glass-fill"
          >
            Return
          </span>
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              setActing({ row, outcome: 'co-signed' })
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-brand px-3 py-1 text-[0.86em] font-semibold text-brand-on"
          >
            <Icon name="Signature" size={13} />
            Co-sign
          </span>
        </span>
      ),
    },
  ]

  return (
    <Screen
      screenId="S-06-09"
      loadingShape="list"
      heading="Co-sign"
      subheading={
        <>
          {rows.length} awaiting your signature · 24h target · CMP-NABH-03
        </>
      }
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'SAVING', 'AI-OFF']}
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">Nothing is waiting for your signature.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            A registrar saving a note that requires a consultant, or an addendum to a signed record, would appear here.
          </p>
        </Card>
      }
    >
      <div className="max-w-4xl space-y-6">
        <Worklist
          variant="calm"
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          onOpen={(r) => navigate(`/patient/${patient(r.patientId).uhid}/chart`)}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-114"
          aiSortLabel="Quality flags first"
          deterministicLabel="Oldest first"
          caption="Entries awaiting a consultant co-signature"
          noun="entries"
          emptyWhy="Nothing is waiting for your signature. A registrar saving a note that requires a consultant would appear here."
          filters={
            <>
              <Chip tone="neutral" icon="Users">
                Your registrars
              </Chip>
            </>
          }
        />

        {/* CMP-NABH-10, in one line rather than a paragraph. */}
        <p className="flex items-start gap-2 px-1 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          Disagreeing with an entry means appending your own addendum, never editing theirs.
        </p>

        {Object.keys(coSigned).length > 0 && (
          <Card className="p-5">
            <h2 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Actioned this session</h2>
            <ul className="mt-2 divide-y divide-glass-hairline">
              {Object.entries(coSigned).map(([itemId, info]) => (
                <li key={itemId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="flex items-center gap-2">
                    <Icon
                      name={info.outcome === 'co-signed' ? 'Check' : 'Undo2'}
                      size={14}
                      className={info.outcome === 'co-signed' ? 'text-normal' : 'text-caution'}
                    />
                    <span className="tabular font-medium">{itemId}</span>
                    <Chip tone={info.outcome === 'co-signed' ? 'normal' : 'caution'}>{info.outcome}</Chip>
                  </span>
                  <span className="tabular text-[0.86em] text-ink-3">
                    {info.by} · {formatDateTime(info.at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={acting !== null}
        title={acting?.outcome === 'co-signed' ? 'Co-sign this entry?' : 'Return this entry to the author?'}
        consequence={
          acting?.outcome === 'co-signed'
            ? `Your name and ${me.identifierKind} ${me.identifier} are stamped alongside the author's. The entry becomes part of the legal record and can afterwards only be amended, never edited.`
            : 'The author is notified and the entry stays unsigned in their drafts. Nothing is deleted, and your comment is recorded against it.'
        }
        confirmLabel={acting?.outcome === 'co-signed' ? 'Co-sign' : 'Return with a comment'}
        tone={acting?.outcome === 'co-signed' ? 'primary' : 'destructive'}
        onConfirm={() => {
          if (!acting) return
          coSign(acting.row.id, me.name, acting.outcome)
          toast({
            tone: acting.outcome === 'co-signed' ? 'success' : 'caution',
            title: acting.outcome === 'co-signed' ? 'Co-signed' : 'Returned to the author',
            detail:
              acting.outcome === 'co-signed'
                ? `Stamped ${me.name} · ${me.identifier}`
                : 'The author has been notified. The entry remains in their drafts.',
          })
          setActing(null)
          setReturnNote('')
        }}
        onCancel={() => {
          setActing(null)
          setReturnNote('')
        }}
      >
        {acting?.outcome === 'returned' && (
          <VoiceField
            id="return-note"
            label="What needs changing"
            rows={3}
            value={returnNote}
            onChange={setReturnNote}
            patientId={acting.row.patientId}
            placeholder="What needs changing before you will sign it…"
          />
        )}
      </ConfirmDialog>
    </Screen>
  )
}
