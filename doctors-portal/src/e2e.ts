/**
 * A harness hook for `scripts/walk-routes.sh`, and nothing else.
 *
 * The route walk drives headless Chrome with `--dump-dom`, which runs the
 * page's own JavaScript but gives no way to inject any — so it cannot type into
 * the sign-in form, and every route would redirect to `/login`.
 *
 * `?e2e=1` writes the same `signedIn` flag a real sign-in writes, into the same
 * persisted store. Two things keep it contained:
 *
 *   It is wrapped in `import.meta.env.DEV`, so the bundler removes the whole
 *   branch from a production build. There is no such parameter in `dist`.
 *
 *   It grants nothing. §3.2 rule 3: authority is evaluated per request from the
 *   persona's capabilities, and this touches neither. It only says that someone
 *   authenticated.
 *
 * THIS MODULE MUST BE IMPORTED BEFORE `App`. ES modules evaluate in import
 * order, and zustand's `persist` middleware reads localStorage when the store
 * module is first evaluated — which App pulls in transitively. Writing the key
 * after that point has no effect, which is the bug this file's existence fixes.
 */

if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('e2e')) {
  const KEY = 'indostates.session'
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) ?? '{}') as {
      state?: Record<string, unknown>
      version?: number
    }
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...existing,
        state: { ...(existing.state ?? {}), signedIn: true },
        version: existing.version ?? 0,
      }),
    )
  } catch {
    // A blocked or full localStorage just means the walk sees /login, which is
    // a legible failure rather than a silent one.
  }
}

/**
 * The RAG audit needs the resolver, and the resolver is a module rather than a
 * network call — so DEV exposes it for `scripts/rag-audit.mjs`, which asserts
 * that every suggested prompt actually resolves to a cited answer on the screen
 * that offers it. A suggestion that answers "I have nothing on that" is worse
 * than no suggestion, and nothing else in the build would catch one.
 *
 * DEV-only, like the flag above: the branch is absent from `dist`.
 */
if (import.meta.env.DEV) {
  void import('./data/assistant').then((m) => {
    ;(window as unknown as Record<string, unknown>).__rag = {
      resolveAnswer: m.resolveAnswer,
      promptsFor: m.promptsFor,
      screenPrompts: m.SCREEN_PROMPTS,
    }
  })
}

export {}
