/**
 * The mutable clinical record for this session.
 *
 * This is what makes the workflows walkable rather than illustrated: signing a
 * note removes it from the worklist and locks the screen, a resident's entry
 * appears in the consultant's co-sign queue, acknowledging a critical result
 * stops its escalation clock, and overriding a hard stop records both
 * identities.
 *
 * CMP-NABH-10 is enforced here, not just drawn: a signed entry is never
 * edited. `addendum()` is the only way to change one, and it appends.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NoteStatus = 'draft' | 'signed' | 'cosign-pending'

/**
 * Where a section's text came from. Only `'scribe'` is an AI DRAFT that needs a
 * C-41 disposition before the note can be signed; dictated text is the
 * clinician's own words transcribed (AI-101), and signing is its confirmation.
 */
export type SectionProvenance = 'typed' | 'dictated' | 'scribe' | 'carried'

export interface Addendum {
  id: string
  body: string
  by: string
  registrationNo: string
  at: string
}

export interface NoteRecord {
  encounterId: string
  /** Section text, by section key. Empty until the clinician dictates, types or accepts a draft. */
  text: Record<string, string>
  /** Per-section provenance. Absent ⇒ the section is untouched. */
  provenance: Record<string, SectionProvenance>
  status: NoteStatus
  signedBy?: string
  /** CMP-NABH-11 — stamped on sign, never typed. */
  registrationNo?: string
  signedAt?: string
  /** CMP-ABDM-03 — per-record publish status on the signed note. */
  publishStatus?: 'queued' | 'published' | 'failed'
  addenda: Addendum[]
  /** A draft save timestamp, shown in the Z7a bar. */
  savedAt?: string
  savedHow?: 'manual' | 'auto'
  /** The chosen ICD-10 leaf code — the truth for the coding field, however it was picked. */
  code?: string
}

export interface RxRecord {
  encounterId: string
  status: 'draft' | 'signed'
  signedBy?: string
  registrationNo?: string
  signedAt?: string
  /** Lines the user removed from the proposed basket. */
  removedLines: string[]
  /** Alternatives accepted in place of a blocked drug. */
  substitutions: Record<string, string>
  /** A G4 override, with both identities, as §4.6 requires. */
  override?: {
    lineId: string
    reason: string
    reasonText?: string
    prescriber: string
    coSigner: string
    at: string
    auditEvent: string
  }
}

interface ClinicalState {
  notes: Record<string, NoteRecord>
  prescriptions: Record<string, RxRecord>
  /** Result ids acknowledged, with who and when. */
  acknowledgements: Record<string, { by: string; at: string; action?: string }>
  /** Co-sign queue items actioned this session. */
  coSigned: Record<string, { by: string; at: string; outcome: 'co-signed' | 'returned' }>
  /** Orders placed from the basket this session. */
  placedOrders: { id: string; item: string; patientId: string; at: string; by: string }[]
  /** Orders cancelled via a stewardship flag. */
  cancelledOrders: Record<string, { reason: string; at: string }>
  /** Order sets promoted to facility-wide — a governance act. */
  promotedSets: Record<string, { owner: string; reviewDue: string; at: string }>
  /** Referrals triaged. */
  triagedReferrals: Record<string, { outcome: string; at: string }>
  /**
   * When this clinician last saw each patient. The "what changed since I last
   * saw them" cut-off — anything older than this is not a change.
   */
  seenAt: Record<string, string>
  /**
   * Mark-seen events held locally because the device is offline. §1.5's
   * OFFLINE rule: name what is queued, and never lose it.
   */
  pendingSeen: string[]
  /** A free dictated note, per patient. `null` key holds an unattached one. */
  voiceNotes: Record<string, { body: string; at: string; by: string; model: string; band: string }[]>

  setSectionText: (encounterId: string, key: string, text: string, provenance?: SectionProvenance) => void
  /**
   * Marks sections as AI-drafted by the scribe, so they need a disposition.
   * Text lands on Accept/Edit. A section the clinician has already dictated or
   * typed is LEFT ALONE — the scribe never overwrites the clinician's words.
   * Returns the keys it actually drafted.
   */
  applyScribeDraft: (encounterId: string, keys: string[]) => string[]
  clearSection: (encounterId: string, key: string) => void
  setNoteCode: (encounterId: string, code: string | undefined) => void
  saveDraft: (encounterId: string, how?: 'manual' | 'auto') => void
  signNote: (args: { encounterId: string; by: string; registrationNo: string; canSign: boolean }) => NoteStatus
  addendum: (args: { encounterId: string; body: string; by: string; registrationNo: string }) => void
  setPublishStatus: (encounterId: string, status: NoteRecord['publishStatus']) => void

  signRx: (args: { encounterId: string; by: string; registrationNo: string }) => void
  removeRxLine: (encounterId: string, lineId: string) => void
  substitute: (encounterId: string, lineId: string, drug: string) => void
  overrideHardStop: (args: {
    encounterId: string
    lineId: string
    reason: string
    reasonText?: string
    prescriber: string
    coSigner: string
    auditEvent: string
  }) => void

  acknowledge: (resultId: string, by: string, action?: string) => void
  coSign: (itemId: string, by: string, outcome: 'co-signed' | 'returned') => void
  placeOrders: (items: { id: string; item: string }[], patientId: string, by: string) => void
  cancelOrder: (orderId: string, reason: string) => void
  promoteSet: (setId: string, owner: string, reviewDue: string) => void
  triageReferral: (referralId: string, outcome: string) => void
  /**
   * `at` is passed in rather than read from the clock, because this build runs
   * on the frozen §8.6 moment. Stamping `new Date()` would put the marker in
   * 2026-real-time, ahead of every seeded delta, and clear badges by accident.
   */
  markSeen: (patientId: string, at: string, offline?: boolean) => void
  flushPendingSeen: (at: string) => void
  saveVoiceNote: (args: {
    patientId: string
    body: string
    by: string
    model: string
    band: string
  }) => void

  note: (encounterId: string) => NoteRecord
  rx: (encounterId: string) => RxRecord
  reset: () => void
}

function blankNote(encounterId: string): NoteRecord {
  return { encounterId, text: {}, provenance: {}, status: 'draft', addenda: [] }
}

function blankRx(encounterId: string): RxRecord {
  return { encounterId, status: 'draft', removedLines: [], substitutions: {} }
}

export const useClinical = create<ClinicalState>()(
  persist(
    (set, get) => ({
      notes: {},
      prescriptions: {},
      acknowledgements: {},
      coSigned: {},
      placedOrders: [],
      cancelledOrders: {},
      promotedSets: {},
      triagedReferrals: {},
      seenAt: {},
      pendingSeen: [],
      voiceNotes: {},

      // A record persisted before provenance existed is normalised on read.
      note: (encounterId) => {
        const stored = get().notes[encounterId]
        return stored ? { ...blankNote(encounterId), ...stored, provenance: stored.provenance ?? {} } : blankNote(encounterId)
      },
      rx: (encounterId) => get().prescriptions[encounterId] ?? blankRx(encounterId),

      setSectionText: (encounterId, key, text, provenance) => {
        const current = get().note(encounterId)
        // CMP-NABH-10 — a signed note is never edited. Silently refusing would
        // be worse than the UI simply not offering it, which it does not.
        if (current.status === 'signed') return
        const prior = current.provenance[key]
        // An explicit provenance wins; otherwise the section keeps what it had;
        // text arriving in an untouched section was typed.
        const next = provenance ?? prior ?? (text.trim() === '' ? undefined : 'typed')
        const nextProvenance = { ...current.provenance }
        if (next === undefined) delete nextProvenance[key]
        else nextProvenance[key] = next
        set({
          notes: {
            ...get().notes,
            [encounterId]: { ...current, text: { ...current.text, [key]: text }, provenance: nextProvenance },
          },
        })
      },

      applyScribeDraft: (encounterId, keys) => {
        const current = get().note(encounterId)
        if (current.status === 'signed') return []
        const provenance = { ...current.provenance }
        const applied: string[] = []
        for (const k of keys) {
          const own = current.provenance[k]
          if ((current.text[k] ?? '').trim() !== '' && own !== undefined && own !== 'scribe') continue
          provenance[k] = 'scribe'
          applied.push(k)
        }
        set({ notes: { ...get().notes, [encounterId]: { ...current, provenance } } })
        return applied
      },

      clearSection: (encounterId, key) => {
        const current = get().note(encounterId)
        if (current.status === 'signed') return
        const text = { ...current.text }
        const provenance = { ...current.provenance }
        delete text[key]
        delete provenance[key]
        set({ notes: { ...get().notes, [encounterId]: { ...current, text, provenance } } })
      },

      setNoteCode: (encounterId, code) => {
        const current = get().note(encounterId)
        if (current.status === 'signed') return
        set({ notes: { ...get().notes, [encounterId]: { ...current, code } } })
      },

      saveDraft: (encounterId, how = 'manual') => {
        const current = get().note(encounterId)
        if (current.status === 'signed') return
        set({
          notes: {
            ...get().notes,
            [encounterId]: { ...current, savedAt: new Date().toISOString(), savedHow: how },
          },
        })
      },

      /**
       * `canSign` comes from the persona's capabilities. A resident holds
       * note.write but not note.sign, so their entry becomes `cosign-pending`
       * and lands in the consultant's queue (CMP-NABH-03).
       */
      signNote: ({ encounterId, by, registrationNo, canSign }) => {
        const current = get().note(encounterId)
        const status: NoteStatus = canSign ? 'signed' : 'cosign-pending'
        set({
          notes: {
            ...get().notes,
            [encounterId]: {
              ...current,
              status,
              signedBy: by,
              registrationNo,
              signedAt: new Date().toISOString(),
              publishStatus: canSign ? 'queued' : undefined,
            },
          },
        })
        return status
      },

      addendum: ({ encounterId, body, by, registrationNo }) => {
        const current = get().note(encounterId)
        set({
          notes: {
            ...get().notes,
            [encounterId]: {
              ...current,
              addenda: [
                ...current.addenda,
                {
                  id: `AD-${current.addenda.length + 1}`,
                  body,
                  by,
                  registrationNo,
                  at: new Date().toISOString(),
                },
              ],
            },
          },
        })
      },

      setPublishStatus: (encounterId, publishStatus) => {
        const current = get().note(encounterId)
        set({ notes: { ...get().notes, [encounterId]: { ...current, publishStatus } } })
      },

      signRx: ({ encounterId, by, registrationNo }) => {
        const current = get().rx(encounterId)
        set({
          prescriptions: {
            ...get().prescriptions,
            [encounterId]: {
              ...current,
              status: 'signed',
              signedBy: by,
              registrationNo,
              signedAt: new Date().toISOString(),
            },
          },
        })
      },

      removeRxLine: (encounterId, lineId) => {
        const current = get().rx(encounterId)
        if (current.removedLines.includes(lineId)) return
        set({
          prescriptions: {
            ...get().prescriptions,
            [encounterId]: { ...current, removedLines: [...current.removedLines, lineId] },
          },
        })
      },

      substitute: (encounterId, lineId, drug) => {
        const current = get().rx(encounterId)
        set({
          prescriptions: {
            ...get().prescriptions,
            [encounterId]: {
              ...current,
              substitutions: { ...current.substitutions, [lineId]: drug },
            },
          },
        })
      },

      overrideHardStop: ({ encounterId, lineId, reason, reasonText, prescriber, coSigner, auditEvent }) => {
        const current = get().rx(encounterId)
        set({
          prescriptions: {
            ...get().prescriptions,
            [encounterId]: {
              ...current,
              override: {
                lineId,
                reason,
                reasonText,
                prescriber,
                coSigner,
                at: new Date().toISOString(),
                auditEvent,
              },
            },
          },
        })
      },

      acknowledge: (resultId, by, action) =>
        set({
          acknowledgements: {
            ...get().acknowledgements,
            [resultId]: { by, at: new Date().toISOString(), action },
          },
        }),

      coSign: (itemId, by, outcome) =>
        set({
          coSigned: { ...get().coSigned, [itemId]: { by, at: new Date().toISOString(), outcome } },
        }),

      placeOrders: (items, patientId, by) =>
        set({
          placedOrders: [
            ...get().placedOrders,
            ...items.map((i) => ({ ...i, patientId, by, at: new Date().toISOString() })),
          ],
        }),

      cancelOrder: (orderId, reason) =>
        set({
          cancelledOrders: {
            ...get().cancelledOrders,
            [orderId]: { reason, at: new Date().toISOString() },
          },
        }),

      promoteSet: (setId, owner, reviewDue) =>
        set({
          promotedSets: {
            ...get().promotedSets,
            [setId]: { owner, reviewDue, at: new Date().toISOString() },
          },
        }),

      triageReferral: (referralId, outcome) =>
        set({
          triagedReferrals: {
            ...get().triagedReferrals,
            [referralId]: { outcome, at: new Date().toISOString() },
          },
        }),

      /**
       * The UI updates optimistically either way; `offline` only decides
       * whether the write is recorded as still queued.
       */
      markSeen: (patientId, at, offline) =>
        set({
          seenAt: { ...get().seenAt, [patientId]: at },
          pendingSeen: offline
            ? get().pendingSeen.includes(patientId)
              ? get().pendingSeen
              : [...get().pendingSeen, patientId]
            : get().pendingSeen,
        }),

      flushPendingSeen: (at) => {
        const pending = get().pendingSeen
        if (pending.length === 0) return
        const seenAt = { ...get().seenAt }
        for (const id of pending) seenAt[id] = seenAt[id] ?? at
        set({ seenAt, pendingSeen: [] })
      },

      saveVoiceNote: ({ patientId, body, by, model, band }) =>
        set({
          voiceNotes: {
            ...get().voiceNotes,
            [patientId]: [
              ...(get().voiceNotes[patientId] ?? []),
              { body, at: new Date().toISOString(), by, model, band },
            ],
          },
        }),

      reset: () =>
        set({
          notes: {},
          prescriptions: {},
          acknowledgements: {},
          coSigned: {},
          placedOrders: [],
          cancelledOrders: {},
          promotedSets: {},
          triagedReferrals: {},
          seenAt: {},
          pendingSeen: [],
          voiceNotes: {},
        }),
    }),
    { name: 'indostates.clinical' },
  ),
)
