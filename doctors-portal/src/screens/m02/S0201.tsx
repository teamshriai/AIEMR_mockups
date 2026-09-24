/**
 * S-02-01 · Sign In — `/login` · T3 · ARC-15
 *
 * "Sign in — and nothing else is decided here."
 *
 * That one-liner is the whole design. §3.2 rule 3: "default is deny, evaluated
 * at REQUEST TIME — never baked into a token." So authenticating establishes
 * who is calling and grants nothing; every screen after this still checks its
 * own capability against its own subject.
 *
 * Three rules here are implemented rather than drawn, because each one is a
 * security property and not a style:
 *
 *   ONE UNIFORM FAILURE. An unknown address and a wrong password produce the
 *   same sentence. Distinguishing them is a user-existence oracle — it tells an
 *   attacker which addresses are real, which is the first thing they want.
 *
 *   LOCKED after repeated failures, with a route to a human. A lockout with no
 *   way out is a denial of service against your own staff at 03:00.
 *
 *   NO SELF SIGN-UP. Accounts are provisioned by the front office or an
 *   administrator (S-02-03), and a dated role record is what grants authority —
 *   never a shared password (DEC-001 D-4).
 *
 * The screen carries no Z1, no Z2 and no Z7b assistant bubble. §6.1 requires
 * every assistant answer to be filtered to what the caller may already read,
 * and before sign-in there is no caller to filter against.
 *
 * Sample data: SD-S-01 signing in at SD-F-01.
 */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { Why } from '@/components/calm'
import { Modal } from '@/components/overlays'
import { Button, Field, Icon, TextInput } from '@/components/primitives'
import { PERSONA_SPECS } from '@/atlas/personas'
import { HUB } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useSession } from '@/store/session'

/** The one sentence. It never varies by failure mode. */
const UNIFORM_FAILURE = 'Sign-in failed. Check your details.'

export function S0201() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const signIn = useSession((s) => s.signIn)
  const persona = useSession((s) => s.persona)
  const lockedUntil = useSession((s) => s.lockedUntil)
  const failedAttempts = useSession((s) => s.failedAttempts)
  const forced = useAI((s) => s.forcedState)
  const aiActive = useAI(selectAiActive)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [reveal, setReveal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [forgot, setForgot] = useState(false)

  const locked = lockedUntil !== null && new Date(lockedUntil) > new Date()
  const offline = forced === 'OFFLINE'
  const next = params.get('next')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (locked || offline) return
    setSubmitting(true)
    setError(null)

    // A short delay so SAVING is a real state rather than a claim.
    window.setTimeout(() => {
      const ok = signIn(email, password)
      setSubmitting(false)
      if (ok) {
        navigate(next && next.startsWith('/') ? next : PERSONA_SPECS[persona].landing, { replace: true })
      } else {
        setError(UNIFORM_FAILURE)
        setPassword('')
      }
    }, 320)
  }

  return (
    <main
      data-screen-id="S-02-01"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-10"
    >
      <div className="w-full max-w-md">
        {/* Identity, and the facility this session will open in — GP-07's scope
            is obvious from the first screen, which the spec asks for. */}
        <header className="mb-6 text-center">
          <span
            aria-hidden
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-card bg-brand text-brand-on shadow-glass ring-4 ring-brand-soft"
          >
            <Icon name="HeartPulse" size={26} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Indostates Health</h1>
          <p className="mt-1 text-[0.92em] text-ink-3">{HUB.name}</p>
        </header>

        {/* The same frosted frame as every card in the product. */}
        <form onSubmit={submit} className="glass-strong glass-card lift space-y-4 p-6 sm:p-7" noValidate>
          <h2 className="text-[0.8em] font-bold tracking-[0.08em] text-ink-2 uppercase">Sign in</h2>
          <Field label="Email" htmlFor="login-email" required>
            <TextInput
              id="login-email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={locked || offline}
              aria-invalid={error !== null}
              autoFocus
            />
          </Field>

          <Field label="Password" htmlFor="login-password" required>
            <div className="relative">
              <TextInput
                id="login-password"
                type={reveal ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={locked || offline}
                aria-invalid={error !== null}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setReveal((v) => !v)}
                aria-label={reveal ? 'Hide password' : 'Show password'}
                title={reveal ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 inline-flex w-11 items-center justify-center rounded-pill text-ink-3 hover:text-ink"
              >
                <Icon name={reveal ? 'EyeOff' : 'Eye'} size={16} />
              </button>
            </div>
          </Field>

          {/*
            VALIDATION. One message, one place, for both failure modes. There is
            deliberately no per-field "no such user" and no "wrong password".
          */}
          {error && !locked && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-panel bg-abnormal-soft px-3 py-2.5 text-[0.92em] font-medium text-abnormal"
            >
              <Icon name="CircleAlert" size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          {/* LOCKED — with a route to a human, not a dead end. */}
          {locked && (
            <p
              role="alert"
              className="rounded-panel bg-caution-soft px-3 py-2.5 text-[0.92em] text-caution"
            >
              <span className="flex items-center gap-2 font-semibold">
                <Icon name="Lock" size={14} />
                Temporarily locked
              </span>
              <span className="mt-1 block">
                Too many attempts. Try again in 15 minutes, or call the service desk on 1800-200-4040 to have it
                cleared.
              </span>
            </p>
          )}

          {/* OFFLINE — sign-in needs connectivity, said plainly. */}
          {offline && (
            <p className="rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.92em] text-ink-2">
              <span className="flex items-center gap-2 font-semibold">
                <Icon name="WifiOff" size={14} />
                No connection
              </span>
              <span className="mt-1 block">
                Signing in needs connectivity — authority is checked on the server, so it cannot be done offline. A
                session already open keeps working, and anything typed into it is held locally.
              </span>
            </p>
          )}

          <Button
            type="submit"
            tone="primary"
            size="lg"
            icon={submitting ? 'Loader' : undefined}
            disabled={email.trim() === '' || password === '' || locked || offline || submitting}
            className="w-full"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setForgot(true)}
              className="min-h-11 rounded-pill px-3 text-[0.92em] font-medium text-brand hover:bg-glass-fill"
            >
              Forgot password?
            </button>
          </div>
        </form>

        {/* No self sign-up — stated once, quietly, so nobody looks for it. */}
        <p className="mt-5 text-center text-[0.86em] text-ink-3">
          Accounts are created by the front office or your administrator. There is no self sign-up.
        </p>

        {/* AI-908 watches access patterns. G1, advisory, and it may not gate a
            login — §3.2 is explicit that no fact from it enters an
            authorization decision. So it is mentioned, and does nothing here. */}
        {aiActive && failedAttempts > 0 && !locked && (
          <p className="mt-2 text-center text-[0.82em] text-ink-muted">
            Unusual access patterns are reviewed after the fact. They never block a sign-in.
          </p>
        )}

        {/* The mockup's own note, folded behind one line so the product copy stands alone. */}
        <div className="mt-4 flex justify-center">
          <Why label="About this mockup sign-in">
            <p className="rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.9em] text-ink-3">
              There is no authentication server. Any valid email address and any password of eight or more characters
              signs you in as <strong className="font-semibold text-ink-2">Dr. Ananya Iyer</strong>. Five rejected
              attempts demonstrate the lock.
            </p>
          </Why>
        </div>
      </div>

      <Modal
        open={forgot}
        size="sm"
        title="Reset your password"
        onClose={() => setForgot(false)}
        footer={
          <Button tone="primary" icon="Mail" onClick={() => setForgot(false)}>
            Send the link
          </Button>
        }
      >
        <p className="text-ink-2">
          A reset link goes to the address on your staff record. It expires in 30 minutes and can only be used once.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-panel bg-glass-fill-muted px-3 py-2.5 text-[0.92em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          Security messages go by email regardless of your notification preference, because a channel you have muted is
          not a channel that can warn you.
        </p>
      </Modal>
    </main>
  )
}
