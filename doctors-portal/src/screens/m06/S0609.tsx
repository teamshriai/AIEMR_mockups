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
import { Diamond } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Alert, Button, Card, Chip, Icon, TextArea } from '@/components/primitives'
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
      key: 'patient',
      label: 'Patient',
      cell: (row) => {
        const p = patient(row.patientId)
        return (
          <span className="block min-w-0">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="tabular block text-[0.86em] text-ink-3">
              {p.uhid} · {p.bed ?? 'outpatient'}
            </span>
          </span>
        )
      },
    },
    { key: 'kind', label: 'Document', cell: (row) => <Chip tone="neutral">{row.documentKind}</Chip> },
    {
      key: 'author',
      label: 'Authored by',
      secondary: true,
      cell: (row) => (
        <span className="block min-w-0">
          <span className="block truncate">{row.authoredBy}</span>
          <span className="block text-[0.86em] text-ink-3">{row.authoredByPersona}</span>
        </span>
      ),
    },
    {
      key: 'waiting',
      label: 'Waiting',
      cell: (row) => (
        <span className="tabular">{formatElapsed((NOW.getTime() - row.authoredAt.getTime()) / 60000)}</span>
      ),
    },
    {
      key: 'quality',
      label: 'Quality check',
      cell: (row) =>
        row.qualityFlags.length === 0 ? (
          <Chip tone="normal" icon="Check">
            Clean
          </Chip>
        ) : (
          <span className="flex flex-col gap-1">
            {row.qualityFlags.map((f) => (
              <Chip key={f} tone="caution" icon="TriangleAlert" title="AI-114 · CMP-NABH-05">
                <Diamond size={9} />
                {f}
              </Chip>
            ))}
          </span>
        ),
    },
    {
      key: 'actions',
      label: '',
      className: 'text-right',
      cell: (row) => (
        <span className="flex justify-end gap-1.5">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setActing({ row, outcome: 'returned' })
            }}
          >
            Return
          </Button>
          <Button
            size="sm"
            tone="primary"
            icon="Signature"
            onClick={(e) => {
              e.stopPropagation()
              setActing({ row, outcome: 'co-signed' })
            }}
          >
            Co-sign
          </Button>
        </span>
      ),
    },
  ]

  return (
    <Screen
      screenId="S-06-09"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'SAVING', 'AI-OFF']}
      chips={<Chip tone={rows.length ? 'caution' : 'normal'}>{rows.length} pending</Chip>}
      empty={
        <Card className="p-10 text-center">
          <p className="text-lg font-medium">Nothing is waiting for your signature.</p>
          <p className="mx-auto mt-2 max-w-md text-ink-3">
            A registrar saving a note that requires a consultant, or an addendum to a signed record, would appear here.
          </p>
        </Card>
      }
    >
      <div className="space-y-5">
        <Alert tone="info" title="Co-signing is an accreditation requirement, not a courtesy">
          A registrar holds <code className="font-mono text-[0.9em]">note.write</code> but not{' '}
          <code className="font-mono text-[0.9em]">note.sign</code> for these classes. If you disagree with an entry you
          do not edit it — you append your own addendum, and both remain visible and separately attributed.
        </Alert>

        <Worklist
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
          emptyWhy="Nothing is waiting for your signature. A registrar saving a note that requires a consultant would appear here."
          filters={
            <>
              <Chip tone="neutral" icon="Users">
                Your registrars
              </Chip>
              <Chip tone="neutral" icon="Clock">
                24h target
              </Chip>
            </>
          }
        />

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
          <TextArea
            rows={3}
            autoFocus
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder="What needs changing before you will sign it…"
          />
        )}
      </ConfirmDialog>
    </Screen>
  )
}
