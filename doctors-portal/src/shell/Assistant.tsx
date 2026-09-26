/**
 * Z7b · GP-17 · C-49 · AI-911 — the assistant bubble and its panel.
 *
 * §6.1 specifies this once, in full, and never again in a screen block,
 * "because it is the only element that appears on every screen in the product".
 * So it is built once, mounted in the app shell, and no screen renders its own.
 *
 * The contract, verbatim where it matters:
 *
 *   "A 56px floating bubble, bottom-right, carrying the ◆ glyph... It does NOT
 *    occupy a bar, a strip or any layout width — it floats above Z7a, so it
 *    costs no vertical space on any screen."
 *
 *   "Bottom-right, 24px inset. NEVER COVERS A PRIMARY ACTION, never overlaps
 *    Z3, and shifts up when a C-33 toast is present."
 *
 *   "? opens from anywhere · Esc closes AND LEAVES THE PAGE STATE UNTOUCHED."
 *
 *   "An unread proactive nudge shows a dot; THE BUBBLE NEVER AUTO-OPENS."
 *
 *   "Explainability: MANDATORY AND ALWAYS VISIBLE — an uncited answer is not
 *    rendered at all."
 *
 * The retrieval backend is explicitly hypothetical (OQ-539, OQ-540); what the
 * mockup must show is the affordance and the surface. The guardrails, though,
 * are real behaviour here — see resolveAnswer() in data/assistant.ts.
 *
 * The panel is a right sidebar that leaves the page usable behind it, because
 * the assistant is consulted in the middle of work, not instead of it. It opens
 * on up to four suggestions composed for the patient and the doctor's day
 * (suggestionsFor), and once a question is asked, the question and its answer
 * are all it shows.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { screenForPath, maybeScreen, routeForSource } from '@/atlas/registry'
import { AttestStrip, Confidence } from '@/components/ai'
import { AssistantIcon } from '@/components/assistant-icon'
import { Drawer } from '@/components/overlays'
import { Button, Chip, Icon, IconButton, cx } from '@/components/primitives'
import type { AssistantAnswer, Citation } from '@/data/assistant'
import { resolveAnswer, suggestionsFor } from '@/data/assistant'
import { callName } from '@/data/assistant-record'
import type { LiveContext } from '@/data/assistant-record'
import { maybeEncounter, maybeResult } from '@/data/clinical'
import { maybeImagingStudy } from '@/data/imaging'
import { patientByAnyId } from '@/data/kit'
import { maybeStrokeCase } from '@/data/stroke'
import { useAdmissions } from '@/store/admissions'
import { selectAiActive, useAI } from '@/store/ai'
import { useAudit } from '@/store/audit'
import type { AuditRow } from '@/store/audit'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'
import type { ThreadTurn } from '@/store/ui'

// ─────────────────────────────────────────────────────────── The bubble

export function AssistantBubble() {
  const { pathname } = useLocation()
  const aiEnabled = useAI(selectAiActive)
  const { assistantOpen, openAssistant, closeAssistant, assistantNudge, toasts } = useUI()

  const spec = screenForPath(pathname)
  const patientId = usePatientInContext()

  /**
   * Three reasons the bubble does not render, all from §6.1:
   *   the AI is off — "AI-OFF hides the bubble ENTIRELY (not greyed)";
   *   the screen is an ARC-12 wall — "a wall has no operator at it";
   *   the screen IS the assistant — the bubble is its entry point, not an
   *   element on it.
   */
  const renders = aiEnabled && spec?.z7b === 'GP-17'

  // `?` opens from anywhere. Registered globally, but never while typing.
  useEffect(() => {
    if (!renders) return
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (typing) return
      if (e.key === '?' && !assistantOpen) {
        e.preventDefault()
        openAssistant({ screenId: spec!.id, patientId })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [renders, assistantOpen, openAssistant, spec, patientId])

  /**
   * The panel does not block the page, so the doctor can move while it is
   * open — and its context moves with them. Only on a real change of page: a
   * screen that opens the panel itself (the imaging viewer's question box)
   * names its own patient and must not be overridden on the same page.
   */
  const lastPath = useRef(pathname)
  useEffect(() => {
    if (!assistantOpen) {
      lastPath.current = pathname
      return
    }
    if (!renders) {
      closeAssistant()
      return
    }
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    openAssistant({ screenId: spec!.id, patientId })
  }, [pathname, assistantOpen, renders, spec, patientId, openAssistant, closeAssistant])

  if (!renders) return null

  return (
    <>
      <button
        type="button"
        aria-label="Open the assistant. Keyboard shortcut: question mark"
        title="Ask the assistant  ·  ?"
        onClick={() => (assistantOpen ? closeAssistant() : openAssistant({ screenId: spec.id, patientId }))}
        style={{
          /**
           * Bottom-right, 24px inset, ABOVE Z7a — so it never covers a primary
           * action. It also shifts up when a C-33 toast is present, and clears
           * the phone tab bar.
           */
          bottom: `calc(var(--z7a-offset, 0px) + ${toasts.length > 0 ? '7.5rem' : '1.5rem'} + env(safe-area-inset-bottom))`,
        }}
        className={cx(
          'fixed right-6 z-70 flex items-center justify-center rounded-pill',
          // 48px below 1024px, 56px above — §6.1's responsive line.
          'size-12 md:size-z7b',
          /*
           * A white disc, in both themes, so the assistant's face keeps its own
           * colours. A slow indigo glow while it is closed invites the click;
           * once the panel is open there is nothing left to invite.
           */
          'bg-bubble',
          assistantOpen ? 'shadow-bubble ring-1 ring-glass-hairline' : 'assistant-glow',
          'transition-[filter,transform] duration-150 ease-out-clinical hover:brightness-110 active:scale-95',
          'max-sm:bottom-[calc(4.5rem+env(safe-area-inset-bottom))]!',
        )}
      >
        <AssistantIcon className="size-9 md:size-11" />
        {/* An unread nudge shows a dot. It still never auto-opens. */}
        {assistantNudge && !assistantOpen && (
          <span className="absolute top-1.5 right-1.5 size-3 rounded-pill bg-caution ring-2 ring-white/70" />
        )}
      </button>

      <AssistantPanel />
    </>
  )
}

/**
 * The Z3 patient, if the calling screen had one. No Z3 ⇒ no patient scope.
 *
 * Routes carry a UHID, or an id that names exactly one patient — an encounter,
 * a result, a study, a stroke case. Anything else names no patient rather than
 * guessing one, since showing the wrong patient matters more than convenience.
 */
function usePatientInContext(): string | undefined {
  const { pathname } = useLocation()
  const spec = screenForPath(pathname)
  if (!spec?.patientScoped || !spec.route) return undefined

  const at = spec.route.split('/').filter(Boolean).indexOf(':id')
  const id = at >= 0 ? pathname.split('/').filter(Boolean)[at] : undefined
  if (!id) return undefined
  return (
    patientByAnyId(id)?.id ??
    maybeEncounter(id)?.patientId ??
    maybeResult(id)?.patientId ??
    maybeImagingStudy(id)?.patientId ??
    (spec.route.startsWith('/stroke/case/') ? maybeStrokeCase(id)?.patientId : undefined)
  )
}

/** Audit rows written before this page load are history, not something the doctor has just done. */
const LOADED_AFTER = useAudit.getState().rows.at(-1)?.id

function recentAction(rows: AuditRow[], actorId: string): AuditRow | undefined {
  const start = LOADED_AFTER ? rows.findIndex((r) => r.id === LOADED_AFTER) + 1 : 0
  for (let i = rows.length - 1; i >= start; i -= 1) {
    if (rows[i].actorId === actorId) return rows[i]
  }
  return undefined
}

/** What the record answers read — the same session state My Day reads. */
function useLiveContext(): LiveContext {
  const persona = useSession((s) => s.persona)
  const breakGlass = useSession((s) => s.breakGlassPatients)
  const acknowledgements = useClinical((s) => s.acknowledgements)
  const seenAt = useClinical((s) => s.seenAt)
  const admissions = useAdmissions((s) => s.admissions)
  const rows = useAudit((s) => s.rows)
  const me = useCurrentStaff()

  return useMemo(() => {
    const recent = recentAction(rows, me.id)
    return {
      persona,
      breakGlass,
      acknowledgements,
      seenAt,
      admissions,
      recent: recent && { event: recent.event, subject: recent.subject },
    }
  }, [persona, breakGlass, acknowledgements, seenAt, admissions, rows, me.id])
}

// ──────────────────────────────────────────────────────────── The panel

export function AssistantPanel() {
  const { assistantOpen, assistantFrom, closeAssistant, thread, pushTurn, reportAnswer, clearThread } = useUI()
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const live = useLiveContext()

  /**
   * A citation opens what it cites. The panel stays open beside it on a wide
   * screen — that is what a sidebar is for — and gets out of the way on a
   * narrow one, where it would cover the page it just opened.
   */
  function openSource(c: Citation) {
    const route = c.to ?? routeForSource(c.source)
    if (!route) {
      toast({ tone: 'info', title: c.label, detail: `${c.source} — documentation, not a screen in this build.` })
      return
    }
    if (!window.matchMedia('(min-width: 1024px)').matches) closeAssistant()
    navigate(route)
  }

  const [draft, setDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const latestQuestionRef = useRef<HTMLDivElement>(null)

  const from = assistantFrom ? maybeScreen(assistantFrom.screenId) : undefined
  const patient = patientByAnyId(assistantFrom?.patientId)

  const context = useMemo(
    () =>
      assistantFrom && {
        screenId: assistantFrom.screenId,
        patientId: assistantFrom.patientId,
        patientScoped: Boolean(assistantFrom.patientId),
        live,
      },
    [assistantFrom, live],
  )
  const suggestions = useMemo(
    () => (context && thread.length === 0 ? suggestionsFor(context) : []),
    [context, thread.length],
  )

  // Bring the newest question to the top, with its answer under it — but never
  // move focus off the composer: "a new answer must not steal focus from the
  // composer" (§M-28).
  useEffect(() => {
    if (thread.length > 0) latestQuestionRef.current?.scrollIntoView({ block: 'start' })
  }, [thread.length])

  useEffect(() => {
    if (assistantOpen) composerRef.current?.focus()
  }, [assistantOpen])

  function ask(question: string) {
    const q = question.trim()
    if (q.length < 3 || !context) return
    pushTurn({ role: 'user', text: q })
    const answer = resolveAnswer(q, context)
    pushTurn({ role: 'assistant', text: answer.body, answer })
    setDraft('')
    composerRef.current?.focus()
  }

  /** Back to the suggestions, for a question that starts afresh. */
  function newQuestion() {
    clearThread()
    setDraft('')
    composerRef.current?.focus()
  }

  if (!assistantOpen || !assistantFrom) return null

  const lastQuestion = thread.findLastIndex((t) => t.role === 'user')

  return (
    <Drawer
      open={assistantOpen}
      onClose={closeAssistant}
      modal={false}
      width={440}
      labelledBy="assistant-title"
      header={
        <header className="flex items-start justify-between gap-4 border-b border-glass-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 id="assistant-title" className="text-lg font-semibold tracking-tight">
              Assistant
            </h2>
            {/* The panel names the Z3 patient and the calling screen — the scope of every answer. */}
            <p className="mt-0.5 truncate text-[0.92em] text-ink-3">
              {patient ? `${patient.name} · ${from?.name ?? 'this screen'}` : (from?.name ?? 'This screen')}
            </p>
          </div>
          <IconButton icon="X" label="Close the assistant" onClick={closeAssistant} className="-mt-2 -mr-2" />
        </header>
      }
      footer={
        <Composer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSubmit={() => ask(draft)}
          placeholder={
            thread.length > 0 ? 'Ask a follow-up…' : patient ? `Ask about ${callName(patient)}…` : 'Ask a question…'
          }
        />
      }
    >
      <div className="px-5 py-4">
        {/*
          "A blank chat box on a clinical screen gets no use" — so it opens on
          suggestions. They are for starting, and only for starting: once a
          question is asked they go, so a question and its answer are the only
          thing in view.
        */}
        {thread.length === 0 && suggestions.length > 0 && (
          <section aria-labelledby="assistant-suggested">
            <h3 id="assistant-suggested" className="mb-2.5 text-[0.8em] font-semibold tracking-wider text-ink-3 uppercase">
              {patient ? `Suggested for ${callName(patient)}` : 'Suggested'}
            </h3>
            <ul className="space-y-1.5">
              {suggestions.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => ask(p)}
                    className="glass flex min-h-11 w-full items-center gap-2.5 rounded-panel px-3 py-2.5 text-left text-[0.95em] hover:bg-glass-fill-hover"
                  >
                    <Icon name="CornerDownRight" size={14} className="shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* role="log" so answers are announced without stealing focus. */}
        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-4">
          {thread.map((turn, i) => (
            <div key={turn.id} ref={i === lastQuestion ? latestQuestionRef : undefined} className="scroll-mt-4">
              <Turn turn={turn} onReport={() => reportAnswer(turn.id)} onOpenSource={openSource} />
            </div>
          ))}
        </div>

        {/* A follow-up goes in the composer; this is the way back to a fresh start. */}
        {thread.length > 0 && (
          <button
            type="button"
            onClick={newQuestion}
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-chip px-2 py-1 text-[0.88em] font-medium text-ai hover:bg-glass-fill-hover"
          >
            <Icon name="RotateCcw" size={13} />
            New question
          </button>
        )}
      </div>
    </Drawer>
  )
}

// ──────────────────────────────────────────────────────────── A turn

function Turn({
  turn,
  onReport,
  onOpenSource,
}: {
  turn: ThreadTurn
  onReport: () => void
  onOpenSource: (c: Citation) => void
}) {
  if (turn.role === 'user') {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-panel rounded-br-sm bg-brand px-3.5 py-2.5 text-brand-on">{turn.text}</p>
      </div>
    )
  }

  const answer = turn.answer
  if (!answer) return null

  /**
   * THE rule for this panel: "an uncited answer is not rendered at all". An
   * answer object with an empty citations[] renders the abstain frame instead
   * of its prose, so there is no code path that shows ungrounded text.
   */
  if (answer.citations.length === 0) {
    return <AbstainFrame answer={answer} />
  }

  return (
    <article className="glass rounded-panel rounded-bl-sm p-4">
      {answer.kind === 'routed' && <RoutedNotice answer={answer} />}
      {answer.kind === 'out-of-scope' && <OutOfScopeNotice answer={answer} />}

      {answer.kind === 'cited' && (
        <div className="space-y-2.5 leading-relaxed">
          {answer.body.split('\n\n').map((para) => (
            <p key={para} dangerouslySetInnerHTML={{ __html: markdownish(para) }} />
          ))}
        </div>
      )}

      {/* Citations: real links with discernible text, never a bare [1]. One line each. */}
      <div className="mt-3 border-t border-glass-hairline pt-2.5">
        <p className="mb-1 text-[0.75em] font-semibold tracking-wider text-ink-3 uppercase">Sources</p>
        <ul>
          {answer.citations.map((c) => (
            <li key={c.n}>
              <button
                type="button"
                onClick={() => onOpenSource(c)}
                title={`${c.label} — ${c.source}`}
                className="flex w-full items-center gap-2 rounded-chip px-1.5 py-1 text-left text-[0.86em] hover:bg-glass-fill-hover"
              >
                <span className="flex size-4.5 shrink-0 items-center justify-center rounded-[5px] bg-ai-soft text-[0.8em] font-bold text-ai">
                  {c.n}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {c.label}
                  <span className="text-ink-3"> · {c.source}</span>
                </span>
                <Icon name="ExternalLink" size={12} className="shrink-0 text-ink-muted" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* A reading is a claim, so it ends in a signature rather than a full stop. */}
      {answer.attest && <AttestStrip attest={answer.attest} />}

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Confidence band={answer.band} />
        {turn.reported ? (
          <Chip tone="neutral" icon="Check">
            Reported — thank you
          </Chip>
        ) : (
          <button
            type="button"
            onClick={onReport}
            className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[0.84em] text-ink-3 hover:bg-glass-fill-hover hover:text-ink"
          >
            <Icon name="Flag" size={12} />
            Report wrong answer
          </button>
        )}
      </footer>
    </article>
  )
}

/** O2 — declined and routed, with the owning capability and its gate named. */
function RoutedNotice({ answer }: { answer: AssistantAnswer }) {
  const r = answer.routedTo
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 font-semibold text-caution">
        <Icon name="Stethoscope" size={16} />
        That is a clinical question
      </p>
      <p className="mt-1.5 leading-relaxed text-ink-2">{answer.body}</p>
      {r && (
        <div className="mt-3 rounded-panel border border-ai/25 bg-ai-soft px-3 py-2.5">
          <p className="text-[0.88em] font-semibold text-ai">
            {r.capability} · {r.name}
          </p>
          <p className="mt-1 text-[0.9em] text-ink-2">
            Answered on {r.where}, at gate <strong>{r.gate}</strong>.
          </p>
        </div>
      )}
    </div>
  )
}

/** O3 — declined NAMING what it does cover, with two examples. */
function OutOfScopeNotice({ answer }: { answer: AssistantAnswer }) {
  return (
    <div className="mb-3">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="CircleSlash" size={16} className="text-ink-3" />
        Outside what I cover
      </p>
      {answer.covers && (
        <>
          <p className="mt-1.5 leading-relaxed text-ink-2">{answer.covers.summary}</p>
          <ul className="mt-2.5 space-y-1.5">
            {answer.covers.examples.map((e) => (
              <li key={e} className="flex items-start gap-2 text-[0.92em] text-ink-2">
                <Icon name="CornerDownRight" size={13} className="mt-1 shrink-0 text-ink-muted" />
                <span>&ldquo;{e}&rdquo;</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/**
 * O4 and O5 — the abstain frame. "I don't have documentation for that" plus the
 * support route, and never an extrapolated policy.
 *
 * O5 deliberately looks identical to O4: the refusal is uniform and does not
 * confirm that a record exists.
 */
function AbstainFrame({ answer }: { answer: AssistantAnswer }) {
  return (
    <article className="rounded-panel border-l-[3px] border-l-caution bg-caution-soft/60 p-4">
      <p className="flex items-center gap-2 font-semibold text-caution">
        <Icon name="CircleHelp" size={16} />
        {answer.body}
      </p>
      {answer.supportRoute && (
        <p className="mt-2.5 flex items-start gap-2 text-[0.9em] text-ink-2">
          <Icon name="LifeBuoy" size={14} className="mt-0.5 shrink-0" />
          {answer.supportRoute}
        </p>
      )}
    </article>
  )
}

// ─────────────────────────────────────────────────────────── Composer

function Composer({
  ref,
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  placeholder: string
}) {
  /** Send enables at >= 3 characters, per S-28-02's composer rule. */
  const ready = value.trim().length >= 3

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter is a newline.
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (ready) onSubmit()
          }
        }}
        placeholder={placeholder}
        aria-label="Ask the assistant"
        className="max-h-32 min-h-11 flex-1 resize-none rounded-field border border-glass-hairline bg-glass-fill-strong px-3.5 py-2.5 leading-snug focus:border-ai focus:outline-none"
      />
      <Button tone="ai" icon="Send" disabled={!ready} onClick={onSubmit} aria-label="Send">
        <span className="sr-only sm:not-sr-only">Ask</span>
      </Button>
    </div>
  )
}

/** Just enough markdown for **bold** and `code` in the canned answers. */
function markdownish(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-[var(--color-glass-fill-muted)] px-1 py-0.5 font-mono text-[0.9em]">$1</code>')
    .replace(/\n/g, '<br/>')
}
