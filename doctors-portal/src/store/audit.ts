/**
 * The audit trail.
 *
 * Two atlas rules make this a store rather than a console line:
 *   §3.2 — an access decision, and anything that follows from one, is written
 *   SYNCHRONOUSLY. "If it cannot be written, the absence is itself an alert"
 *   (DD-014). A break-glass that is not logged has not happened.
 *   §4.7 — every AI-assisted entry carries the model and the gate it passed
 *   under, so a reviewer can answer "who accepted what, on whose advice".
 *
 * It is SURFACED, not just written: the Quick-Panel carries an Audit
 * disclosure and the explainability drawer's provenance panel reads from here.
 * A log nobody can see is indistinguishable from no log.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { Gate } from '@/atlas/gates'

/** A closed set — an audit event nobody declared is an audit event nobody reviews. */
export type AuditEvent =
  | 'PATIENT.MARKED_SEEN'
  | 'AI.SCRIBE.TRANSCRIPT_CREATED'
  | 'NOTE.DRAFT_SAVED'
  | 'NOTE.SIGNED'
  | 'NOTE.COSIGN_QUEUED'
  | 'ACCESS.BREAK_GLASS'
  | 'AI.SAF.HARD_STOP_OVERRIDDEN'

export interface AuditRow {
  id: string
  event: AuditEvent
  /** Who. Named, never a role or a pool. */
  actor: string
  actorId: string
  /** ISO. */
  at: string
  /** Which patient or record it concerns. */
  subject?: string
  /** The model version, where a capability contributed. */
  model?: string
  /** The gate the action passed under (§4.4). */
  gate?: Gate
  detail?: string
  /** Set while the event is held locally because the device is offline. */
  queued?: boolean
}

interface AuditState {
  rows: AuditRow[]
  record: (row: Omit<AuditRow, 'id' | 'at'> & { at?: string }) => void
  /** Marks every queued row as written — the flush after reconnecting. */
  flushQueued: () => void
  forSubject: (subject: string) => AuditRow[]
  clear: () => void
}

let seq = 0

export const useAudit = create<AuditState>()(
  persist(
    (set, get) => ({
      rows: [],

      record: ({ at, ...row }) =>
        set({
          rows: [
            ...get().rows,
            { ...row, id: `AU-${Date.now().toString(36)}-${++seq}`, at: at ?? new Date().toISOString() },
          ],
        }),

      flushQueued: () => set({ rows: get().rows.map((r) => (r.queued ? { ...r, queued: false } : r)) }),

      forSubject: (subject) =>
        get()
          .rows.filter((r) => r.subject === subject)
          .slice()
          .reverse(),

      clear: () => set({ rows: [] }),
    }),
    { name: 'indostates.audit' },
  ),
)

const LABELS: Record<AuditEvent, string> = {
  'PATIENT.MARKED_SEEN': 'Marked seen',
  'AI.SCRIBE.TRANSCRIPT_CREATED': 'Dictation captured',
  'NOTE.DRAFT_SAVED': 'Note draft saved',
  'NOTE.SIGNED': 'Note signed',
  'NOTE.COSIGN_QUEUED': 'Queued for co-sign',
  'ACCESS.BREAK_GLASS': 'Break-glass access',
  'AI.SAF.HARD_STOP_OVERRIDDEN': 'Hard stop overridden',
}

export function auditLabel(event: AuditEvent): string {
  return LABELS[event]
}
