/**
 * Z8 overlay state: the assistant panel, the explainability drawer, modals and
 * toasts.
 *
 * §6.1 constrains the bubble's behaviour and the panel's placement:
 *   "? opens from anywhere · Esc closes AND LEAVES THE PAGE STATE UNTOUCHED"
 *   "the bubble NEVER AUTO-OPENS"
 *   "shifts up when a C-33 toast is present"
 */

import { create } from 'zustand'

import type { AssistantAnswer } from '@/data/assistant'

export interface ThreadTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  answer?: AssistantAnswer
  at: string
  /** Set where the user has reported the answer as wrong. */
  reported?: boolean
}

/** What the C-42 explainability drawer is currently explaining. */
export interface ExplainTarget {
  touchpointId: string
  capabilityId: string
  /** Panel 1 — the plain-language claim. */
  claim: string
  confidence: number
  band: string
  computedAt: string
  /** Panel 2 — what it used, each clickable back to its source. */
  inputs: { label: string; source: string }[]
  /** Panel 3 — why: drivers with direction and weight, or retrieved evidence. */
  drivers?: { label: string; direction: 'up' | 'down'; weight: number }[]
  evidence?: string[]
  /** Panel 4 — limits & provenance. */
  model: string
  limits: string[]
}

export interface Toast {
  id: string
  tone: 'info' | 'success' | 'caution' | 'critical'
  title: string
  detail?: string
}

export interface ModalRequest {
  /** The screen id of the overlay being shown, from the registry. */
  screenId: string
  /** Free-form payload for the specific modal. */
  payload?: Record<string, unknown>
}

interface UIState {
  assistantOpen: boolean
  /** Screen the assistant was opened from — the panel header names it. */
  assistantFrom: { screenId: string; patientId?: string } | null
  thread: ThreadTurn[]
  /** An unread proactive nudge shows a dot. The bubble still never auto-opens. */
  assistantNudge: boolean

  explain: ExplainTarget | null
  modal: ModalRequest | null
  toasts: Toast[]
  /** Z6 right rail collapsed to a 48px tab with a badge (lg breakpoint). */
  railCollapsed: boolean

  openAssistant: (from: { screenId: string; patientId?: string }) => void
  closeAssistant: () => void
  pushTurn: (turn: Omit<ThreadTurn, 'id' | 'at'>) => void
  reportAnswer: (turnId: string) => void
  clearThread: () => void
  setNudge: (v: boolean) => void

  openExplain: (t: ExplainTarget) => void
  closeExplain: () => void
  openModal: (m: ModalRequest) => void
  closeModal: () => void
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  toggleRail: () => void
}

let seq = 0
const nextId = () => `u${++seq}`

export const useUI = create<UIState>()((set, get) => ({
  assistantOpen: false,
  assistantFrom: null,
  thread: [],
  assistantNudge: false,

  explain: null,
  modal: null,
  toasts: [],
  /** Collapsed by default: the rail is context, and context is one tap away. */
  railCollapsed: true,

  openAssistant: (assistantFrom) => set({ assistantOpen: true, assistantFrom, assistantNudge: false }),
  /** Closing leaves the thread intact — "leaves the page state untouched". */
  closeAssistant: () => set({ assistantOpen: false }),

  pushTurn: (turn) =>
    set({ thread: [...get().thread, { ...turn, id: nextId(), at: new Date().toISOString() }] }),

  reportAnswer: (turnId) =>
    set({ thread: get().thread.map((t) => (t.id === turnId ? { ...t, reported: true } : t)) }),

  clearThread: () => set({ thread: [] }),
  setNudge: (assistantNudge) => set({ assistantNudge }),

  openExplain: (explain) => set({ explain }),
  closeExplain: () => set({ explain: null }),
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),

  toast: (t) => {
    const id = nextId()
    set({ toasts: [...get().toasts, { ...t, id }] })
    window.setTimeout(() => get().dismissToast(id), 6000)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  toggleRail: () => set({ railCollapsed: !get().railCollapsed }),
}))
