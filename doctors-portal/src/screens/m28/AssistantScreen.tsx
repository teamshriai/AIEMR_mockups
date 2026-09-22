/**
 * S-28-02 · Clinician Assistant — `/assistant/clinician` · T1 · ARC-21
 * S-28-09 · Stroke Command Assistant — `/assistant/stroke` · T2 · ARC-21
 *
 * ARC-21's note is unusually blunt: "the archetype IS the AI."
 *
 * These are the conversation surfaces the Z7b bubble is the entry point to. Per
 * §6.1 they are the only screens whose Z7b line reads `⊘ n/a` — "this screen IS
 * the assistant; the GP-17 bubble is its entry point, not an element on it."
 *
 * §M-28.1's reason for one assistant per portal rather than one bot with a role
 * switch: "'What can I usefully ask' differs completely by portal." So the two
 * screens share this surface but not their prompts, scope or examples.
 */

import { useEffect, useRef, useState } from 'react'

import { Confidence, Diamond } from '@/components/ai'
import { Button, Card, Chip, Icon, cx } from '@/components/primitives'
import type { AssistantAnswer } from '@/data/assistant'
import { FORCEABLE_OUTCOMES, promptsFor, resolveAnswer } from '@/data/assistant'
import { patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useSession } from '@/store/session'
import { Screen } from '@/shell/Screen'

interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  answer?: AssistantAnswer
  reported?: boolean
}

export function AssistantScreen({
  screenId,
  title,
  covers,
  patientId,
}: {
  screenId: string
  title: string
  covers: string[]
  patientId?: string
}) {
  const aiActive = useAI(selectAiActive)
  const language = useSession((s) => s.language)
  const [thread, setThread] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const composer = useRef<HTMLTextAreaElement>(null)
  const end = useRef<HTMLDivElement>(null)

  const p = patientId ? patient(patientId) : undefined
  const prompts = promptsFor(screenId)

  useEffect(() => {
    if (thread.length > 0) end.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [thread.length])

  function ask(q: string) {
    const question = q.trim()
    if (question.length < 3) return
    const answer = resolveAnswer(question, { screenId, patientId, patientScoped: Boolean(patientId) })
    setThread((t) => [
      ...t,
      { id: `u${t.length}`, role: 'user', text: question },
      { id: `a${t.length}`, role: 'assistant', text: answer.body, answer },
    ])
    setDraft('')
    composer.current?.focus()
  }

  return (
    <Screen
      screenId={screenId}
      patient={p}
      loadingShape="thread"
      states={['LOADING', 'EMPTY', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={
        <>
          <Chip tone="ai">
            <Diamond size={9} />
            AI-911
          </Chip>
          <Chip tone="neutral" icon="ShieldCheck">
            {p ? `scope: ${p.name}` : 'scope: your access'}
          </Chip>
          <Chip tone="neutral" icon="Globe">
            {language}
          </Chip>
        </>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">What this covers</h3>
            <ul className="mt-2 space-y-1.5">
              {covers.map((c) => (
                <li key={c} className="flex gap-2 text-[0.9em] text-ink-2">
                  <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                  {c}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="border-l-[3px] border-l-caution p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-caution uppercase">
              What it will not do
            </h3>
            <ul className="mt-2 space-y-1.5 text-[0.9em] text-ink-2">
              <li className="flex gap-2">
                <Icon name="X" size={13} className="mt-1 shrink-0 text-caution" />
                Answer a clinical question. Those route to the capability that owns them, under its own gate.
              </li>
              <li className="flex gap-2">
                <Icon name="X" size={13} className="mt-1 shrink-0 text-caution" />
                Show you a patient you have not opened.
              </li>
              <li className="flex gap-2">
                <Icon name="X" size={13} className="mt-1 shrink-0 text-caution" />
                Extrapolate a policy this hospital has not written.
              </li>
            </ul>
          </Card>

          {/* The five outcomes, each reachable in one click. */}
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              Every outcome, in one click
            </h3>
            <p className="mt-1.5 text-[0.88em] text-ink-3">
              A refusal taxonomy that only exists on paper is not a refusal taxonomy. Try each one.
            </p>
            <div className="mt-2.5 space-y-1.5">
              {FORCEABLE_OUTCOMES.map((o) => (
                <button
                  key={o.kind}
                  type="button"
                  onClick={() => ask(o.example)}
                  className="glass flex w-full items-start gap-2 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover"
                >
                  <Icon name="CornerDownRight" size={12} className="mt-1 shrink-0 text-ink-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.88em] font-medium">{o.label}</span>
                    <span className="block text-[0.84em] text-ink-3">&ldquo;{o.example}&rdquo;</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      }
      railTitle="Scope"
      actionBar={
        <div className="flex w-full items-end gap-2">
          <textarea
            ref={composer}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(draft)
              }
            }}
            placeholder={aiActive ? 'Ask about process, policy or how this works…' : 'The assistant is off'}
            aria-label="Ask the assistant"
            disabled={!aiActive}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-field border border-glass-hairline bg-glass-fill-strong px-3.5 py-2.5 leading-snug focus:border-ai focus:outline-none disabled:opacity-50"
          />
          <Button tone="ai" icon="Send" disabled={!aiActive || draft.trim().length < 3} onClick={() => ask(draft)}>
            Ask
          </Button>
        </div>
      }
    >
      <div className="mx-auto max-w-3xl">
        {!aiActive ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-medium">The assistant is switched off</p>
            <p className="mx-auto mt-2 max-w-md text-ink-2">
              Every screen in the product still works. The static help centre and the service desk on extension 4400
              remain available — no task here requires the assistant to complete.
            </p>
            <Button className="mt-4" icon="BookOpen">
              Open the help centre
            </Button>
          </Card>
        ) : (
          <>
            {/* EMPTY is never a blank box. */}
            {thread.length === 0 && (
              <div className="space-y-4">
                <Card className="p-6">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Diamond size={14} />
                    {title}
                  </h2>
                  <p className="mt-2 text-ink-2">
                    I answer from documentation, with the source cited. If nothing relevant is retrieved I say so
                    rather than guessing — an uncited answer is not rendered at all.
                  </p>
                  {p && (
                    <p className="mt-2.5 flex flex-wrap items-center gap-2 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.9em]">
                      <Icon name="User" size={13} className="text-ink-3" />
                      Scoped to <strong>{p.name}</strong>, because you have them open. I cannot reach a patient you
                      have not.
                    </p>
                  )}
                </Card>

                <div>
                  <p className="mb-2 text-[0.8em] font-semibold tracking-wider text-ink-3 uppercase">
                    Try one of these
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {prompts.map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => ask(q)}
                          className="glass glass-hover flex w-full items-center gap-2.5 rounded-panel px-3.5 py-3 text-left"
                        >
                          <Icon name="CornerDownRight" size={14} className="shrink-0 text-ink-muted" />
                          <span className="min-w-0 flex-1">{q}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* The thread. role="log" so answers announce without stealing focus. */}
            <div role="log" aria-live="polite" aria-label="Conversation" className="space-y-4">
              {thread.map((turn) =>
                turn.role === 'user' ? (
                  <div key={turn.id} className="flex justify-end">
                    <p className="max-w-[80%] rounded-panel rounded-br-sm bg-brand px-4 py-2.5 text-brand-on">
                      {turn.text}
                    </p>
                  </div>
                ) : (
                  <AnswerBlock
                    key={turn.id}
                    answer={turn.answer!}
                    reported={turn.reported}
                    onReport={() =>
                      setThread((t) => t.map((x) => (x.id === turn.id ? { ...x, reported: true } : x)))
                    }
                  />
                ),
              )}
              <div ref={end} />
            </div>

            {/* Prompts reappear after a refusal. */}
            {thread.length > 0 &&
              thread[thread.length - 1].answer?.kind !== undefined &&
              thread[thread.length - 1].answer!.kind !== 'cited' && (
                <div className="mt-5">
                  <p className="mb-2 text-[0.8em] font-semibold tracking-wider text-ink-3 uppercase">
                    Things I can answer
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {prompts.slice(0, 4).map((q) => (
                      <li key={q}>
                        <button
                          type="button"
                          onClick={() => ask(q)}
                          className="glass flex w-full items-center gap-2.5 rounded-panel px-3.5 py-2.5 text-left text-[0.95em] hover:bg-glass-fill-hover"
                        >
                          <Icon name="CornerDownRight" size={13} className="shrink-0 text-ink-muted" />
                          <span className="min-w-0 flex-1">{q}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </>
        )}
      </div>
    </Screen>
  )
}

function AnswerBlock({
  answer,
  reported,
  onReport,
}: {
  answer: AssistantAnswer
  reported?: boolean
  onReport: () => void
}) {
  /** An uncited answer is not rendered at all. */
  if (answer.citations.length === 0) {
    return (
      <article className="rounded-panel border-l-[3px] border-l-caution bg-caution-soft/60 p-5">
        <p className="flex items-center gap-2 font-semibold text-caution">
          <Icon name="CircleHelp" size={17} />
          {answer.body}
        </p>
        <p className="mt-2 text-ink-2">
          Nothing relevant was retrieved, so there is nothing to cite — and I will not extrapolate a policy this
          hospital has not written.
        </p>
        {answer.supportRoute && (
          <p className="mt-2.5 flex items-start gap-2 text-[0.92em] text-ink-2">
            <Icon name="LifeBuoy" size={14} className="mt-0.5 shrink-0" />
            {answer.supportRoute}
          </p>
        )}
        <p className="mt-2 text-[0.84em] text-ink-3">AI-ABSTAIN · grounded or silent.</p>
      </article>
    )
  }

  return (
    <Card as="article" className="p-5">
      {answer.kind === 'routed' && answer.routedTo && (
        <div className="mb-3">
          <p className="flex items-center gap-2 font-semibold text-caution">
            <Icon name="Stethoscope" size={17} />
            That is a clinical question
          </p>
          <p className="mt-1.5 leading-relaxed text-ink-2">{answer.body}</p>
          <div className="mt-3 rounded-panel border border-ai/25 bg-ai-soft px-4 py-3">
            <p className="font-semibold text-ai">
              {answer.routedTo.capability} · {answer.routedTo.name}
            </p>
            <p className="mt-1 text-[0.95em] text-ink-2">
              Answered on {answer.routedTo.where}, at gate <strong>{answer.routedTo.gate}</strong>.
            </p>
          </div>
        </div>
      )}

      {answer.kind === 'out-of-scope' && answer.covers && (
        <div className="mb-3">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="CircleSlash" size={17} className="text-ink-3" />
            Outside what I cover
          </p>
          <p className="mt-1.5 leading-relaxed text-ink-2">{answer.covers.summary}</p>
          <ul className="mt-2.5 space-y-1.5">
            {answer.covers.examples.map((e) => (
              <li key={e} className="flex items-start gap-2 text-[0.95em] text-ink-2">
                <Icon name="CornerDownRight" size={13} className="mt-1 shrink-0 text-ink-muted" />
                &ldquo;{e}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {answer.kind === 'cited' && (
        <div className="space-y-3 leading-relaxed">
          {answer.body.split('\n\n').map((para) => (
            <p key={para} className={cx(para.startsWith('•') && 'pl-3')}>
              {para.replace(/\*\*/g, '')}
            </p>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-glass-hairline pt-3">
        <p className="mb-2 text-[0.78em] font-semibold tracking-wider text-ink-3 uppercase">Sources</p>
        <ul className="space-y-1">
          {answer.citations.map((c) => (
            <li key={c.n}>
              <button
                type="button"
                className="flex w-full items-start gap-2.5 rounded-chip px-2 py-1.5 text-left hover:bg-glass-fill-hover"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-ai-soft text-[0.75em] font-bold text-ai">
                  {c.n}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{c.label}</span>
                  <span className="block text-[0.86em] text-ink-3">{c.source}</span>
                </span>
                <Icon name="ExternalLink" size={13} className="mt-1 shrink-0 text-ink-muted" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <footer className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Confidence band={answer.band} />
        {reported ? (
          <Chip tone="neutral" icon="Check">
            Reported — thank you
          </Chip>
        ) : (
          <button
            type="button"
            onClick={onReport}
            className="inline-flex items-center gap-1.5 rounded-chip px-2 py-1 text-[0.88em] text-ink-3 hover:bg-glass-fill-hover hover:text-ink"
          >
            <Icon name="Flag" size={13} />
            Report wrong answer
          </button>
        )}
      </footer>
    </Card>
  )
}

export function S2802() {
  return (
    <AssistantScreen
      screenId="S-28-02"
      title="Clinician Assistant"
      patientId="SD-P-03"
      covers={[
        'How this product works — screens, actions and what a control does',
        'Accreditation obligations and what they require of you',
        'Capability and access rules, including break-glass',
        'Clinical pathways as this hospital has written them',
        'Where a clinical question belongs instead',
      ]}
    />
  )
}

export function S2809() {
  return (
    <AssistantScreen
      screenId="S-28-09"
      title="Stroke Command Assistant"
      patientId="SD-P-05"
      covers={[
        'The stroke pathway, its clocks and its targets',
        'Eligibility criteria as written, and what an unknown answer means',
        'Which timestamp source wins when two clocks disagree',
        'What the single-act reservation holds, and what happens if one resource is lost',
        'The spoke-site protocol when there is no neurologist on site',
      ]}
    />
  )
}
