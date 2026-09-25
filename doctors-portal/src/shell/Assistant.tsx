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
 */

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { assistantScreenFor } from '@/atlas/nav'
import { screenForPath, maybeScreen, routeForSource } from '@/atlas/registry'
import { AttestStrip, Confidence, Diamond } from '@/components/ai'
import { AssistantIcon } from '@/components/assistant-icon'
import { Drawer } from '@/components/overlays'
import { Button, Chip, Icon, IconButton, cx } from '@/components/primitives'
import type { AssistantAnswer } from '@/data/assistant'
import { promptsFor, resolveAnswer } from '@/data/assistant'
import { patientByAnyId } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useSession } from '@/store/session'
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
          /* A white disc, in both themes, so the assistant's face keeps its own colours. */
          'bg-bubble shadow-bubble ring-1 ring-glass-hairline',
          'transition-all duration-150 ease-out-clinical hover:brightness-110 active:scale-95',
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

/** The Z3 patient, if the calling screen had one. No Z3 ⇒ no patient scope. */
function usePatientInContext(): string | undefined {
  const { pathname } = useLocation()
  const spec = screenForPath(pathname)
  if (!spec?.patientScoped) return undefined

  // Routes carry either a UHID (/patient/:id/...) or an encounter/case id.
  const parts = pathname.split('/').filter(Boolean)
  for (const part of parts) {
    const hit = patientByAnyId(part)
    if (hit) return hit.id
  }
  // Stroke and encounter routes resolve their patient in the screen itself; the
  // panel falls back to naming no patient rather than guessing one, since
  // guarding against showing the wrong patient matters more than convenience.
  return undefined
}

// ──────────────────────────────────────────────────────────── The panel

export function AssistantPanel() {
  const { assistantOpen, assistantFrom, closeAssistant, thread, pushTurn, reportAnswer, clearThread } = useUI()
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)

  /** A citation opens its screen where this build has one; otherwise it says so. */
  function openSource(label: string, source: string) {
    const route = routeForSource(source)
    if (route) {
      closeAssistant()
      navigate(route)
    } else {
      toast({ tone: 'info', title: label, detail: `${source} — documentation, not a screen in this build.` })
    }
  }
  const language = useSession((s) => s.language)
  const [draft, setDraft] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const threadEndRef = useRef<HTMLDivElement>(null)
  const persona = useSession((s) => s.persona)

  const from = assistantFrom ? maybeScreen(assistantFrom.screenId) : undefined
  const patient = patientByAnyId(assistantFrom?.patientId)
  const assistantId = assistantScreenFor(persona)
  const assistantName = assistantId === 'S-28-09' ? 'Stroke Command Assistant' : 'Clinician Assistant'

  // Scroll the thread, but never move focus off the composer — §M-28's
  // accessibility rule: "a new answer must not steal focus from the composer."
  useEffect(() => {
    if (thread.length > 0) threadEndRef.current?.scrollIntoView({ block: 'end' })
  }, [thread.length])

  useEffect(() => {
    if (assistantOpen) composerRef.current?.focus()
  }, [assistantOpen])

  function ask(question: string) {
    const q = question.trim()
    if (q.length < 3 || !assistantFrom) return
    pushTurn({ role: 'user', text: q })
    const answer = resolveAnswer(q, {
      screenId: assistantFrom.screenId,
      patientId: assistantFrom.patientId,
      patientScoped: Boolean(assistantFrom.patientId),
    })
    pushTurn({ role: 'assistant', text: answer.body, answer })
    setDraft('')
  }

  if (!assistantOpen || !assistantFrom) return null

  const prompts = promptsFor(assistantFrom.screenId)

  return (
    <Drawer
      open={assistantOpen}
      onClose={closeAssistant}
      width={420}
      labelledBy="assistant-title"
      header={
        <header className="border-b border-glass-hairline px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="assistant-title" className="flex items-center gap-2 font-semibold tracking-tight">
                <Diamond size={13} />
                {assistantName}
              </h2>
              {/* The panel names the calling screen and the Z3 patient. */}
              <p className="mt-0.5 truncate text-[0.86em] text-ink-3">
                from: {from ? `${from.id} ${from.name}` : 'this screen'}
                {patient && ` — ${patient.name}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {thread.length > 0 && (
                <IconButton icon="Eraser" label="Clear this conversation" onClick={clearThread} className="size-9" size={15} />
              )}
              <IconButton icon="X" label="Close the assistant" onClick={closeAssistant} className="size-9" size={16} />
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* Scope is stated, because guardrails 3 and 4 depend on it. */}
            <Chip tone="ai" icon="Focus">
              {patient ? `scope: ${patient.name}` : 'scope: this screen'}
            </Chip>
            <Chip tone="neutral" icon="Globe">
              {language}
            </Chip>
            <Chip tone="neutral" icon="ShieldCheck" title="Retrieval is filtered to what you may already read">
              your access only
            </Chip>
          </div>
        </header>
      }
      footer={
        <Composer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSubmit={() => ask(draft)}
        />
      }
    >
      <div className="px-4 py-4">
        {/* role="log" so answers are announced without stealing focus. */}
        <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-4">
          {thread.length === 0 && <EmptyThread />}
          {thread.map((turn) => (
            <Turn key={turn.id} turn={turn} onReport={() => reportAnswer(turn.id)} onOpenSource={openSource} />
          ))}
          <div ref={threadEndRef} />
        </div>

        {/*
          "3–4 screen-specific suggested prompts, because a blank chat box on a
          clinical screen gets no use." Shown when the thread is empty AND
          after any refusal.
        */}
        {showPrompts(thread) && (
          <div className="mt-5">
            <p className="mb-2 text-[0.8em] font-semibold tracking-wider text-ink-3 uppercase">
              {thread.length === 0 ? 'Try one of these' : 'Things I can answer here'}
            </p>
            <ul className="space-y-1.5">
              {prompts.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    onClick={() => ask(p)}
                    className="glass flex w-full items-center gap-2.5 rounded-panel px-3 py-2.5 text-left text-[0.95em] hover:bg-glass-fill-hover"
                  >
                    <Icon name="CornerDownRight" size={14} className="shrink-0 text-ink-muted" />
                    <span className="min-w-0 flex-1">{p}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-6 border-t border-glass-hairline pt-3 text-[0.8em] leading-relaxed text-ink-3">
          AI-911 · answers come only from cited documentation. Clinical questions are routed to the capability that owns
          them, under its own gate. No task in this product requires me to complete — the{' '}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() =>
              toast({ tone: 'info', title: 'Help centre', detail: 'Static help lives on the hospital intranet and is not part of this build. The service desk is on extension 4400.' })
            }
          >
            help centre
          </button>{' '}
          and the service desk are always available.
        </p>
      </div>
    </Drawer>
  )
}

/** Prompts reappear after a refusal, per §M-28's EMPTY rule. */
function showPrompts(thread: ThreadTurn[]): boolean {
  if (thread.length === 0) return true
  const last = thread[thread.length - 1]
  return last.role === 'assistant' && last.answer !== undefined && last.answer.kind !== 'cited'
}

function EmptyThread() {
  return (
    <div className="rounded-panel bg-glass-fill-muted px-4 py-4">
      <p className="flex items-center gap-2 font-medium">
        <Diamond />
        I answer from documentation, with the source cited.
      </p>
      <p className="mt-1.5 text-[0.92em] text-ink-3">
        Process, policy, accreditation obligations and how this product works. Not clinical advice — those questions go
        to the capability that owns them.
      </p>
    </div>
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
  onOpenSource: (label: string, source: string) => void
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

      {/* Citations: real links with discernible text, never a bare [1]. */}
      <div className="mt-3 border-t border-glass-hairline pt-3">
        <p className="mb-1.5 text-[0.78em] font-semibold tracking-wider text-ink-3 uppercase">Sources</p>
        <ul className="space-y-1">
          {answer.citations.map((c) => (
            <li key={c.n}>
              <button
                type="button"
                onClick={() => onOpenSource(c.label, c.source)}
                className="flex w-full items-start gap-2 rounded-chip px-1.5 py-1 text-left hover:bg-glass-fill-hover"
              >
                <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-[5px] bg-ai-soft text-[0.72em] font-bold text-ai">
                  {c.n}
                </span>
                <span className="min-w-0 flex-1 text-[0.9em]">
                  <span className="block">{c.label}</span>
                  <span className="block text-[0.9em] text-ink-3">{c.source}</span>
                </span>
                <Icon name="ExternalLink" size={12} className="mt-1 shrink-0 text-ink-muted" />
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
      <p className="mt-1.5 text-[0.92em] text-ink-2">
        Nothing relevant was retrieved, so there is nothing to cite — and I will not extrapolate a policy this hospital
        has not written.
      </p>
      {answer.supportRoute && (
        <p className="mt-2.5 flex items-start gap-2 text-[0.9em] text-ink-2">
          <Icon name="LifeBuoy" size={14} className="mt-0.5 shrink-0" />
          {answer.supportRoute}
        </p>
      )}
      <p className="mt-2 text-[0.8em] text-ink-3">AI-ABSTAIN · an uncited answer is not rendered at all.</p>
    </article>
  )
}

// ─────────────────────────────────────────────────────────── Composer

function Composer({
  ref,
  value,
  onChange,
  onSubmit,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
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
        placeholder="Ask about this screen…"
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
