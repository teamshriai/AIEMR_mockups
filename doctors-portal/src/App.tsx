/**
 * The router, generated from the registry rather than hand-listed — so a screen
 * cannot exist without a route, and a route cannot exist without a screen.
 */

import { useEffect } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'

import { PERSONA_SPECS } from '@/atlas/personas'
import { ROUTED_SCREENS, OVERLAY_SCREENS } from '@/atlas/registry'
import { verifyRegistry } from '@/atlas/verify'
import { AppShell } from '@/shell/AppShell'
import { SCREEN_COMPONENTS } from '@/screens/registry'
import { useSession } from '@/store/session'

/** Adapts a route's `:id` param into the screen component's prop. */
function RouteAdapter({ screenId }: { screenId: string }) {
  const params = useParams()
  const Cmp = SCREEN_COMPONENTS[screenId]
  if (!Cmp) return <Missing screenId={screenId} />
  return <Cmp id={params.id} />
}

function Missing({ screenId }: { screenId: string }) {
  return (
    <div className="gutter py-16">
      <div className="glass-strong glass-card mx-auto max-w-lg p-6">
        <h1 className="text-lg font-semibold">{screenId} has no component</h1>
        <p className="mt-2 text-ink-2">
          The registry names this screen but nothing implements it. That is the gap the startup assertion reports.
        </p>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div className="gutter py-16">
      <div className="glass-strong glass-card mx-auto max-w-lg p-6">
        <h1 className="text-lg font-semibold">No screen at this address</h1>
        <p className="mt-2 text-ink-2">
          Routes here are client-side screen addresses from the atlas registry, not endpoints. Press{' '}
          <kbd className="rounded bg-glass-fill-muted px-1.5 py-0.5 font-mono text-[0.85em]">/</kbd> to search for one.
        </p>
      </div>
    </div>
  )
}

/** Sends a signing-in persona to the screen the atlas says they land on. */
function Landing() {
  const persona = useSession((s) => s.persona)
  return <Navigate to={PERSONA_SPECS[persona].landing} replace />
}

/**
 * S-02-01's entry condition: "any unauthenticated request (redirect)".
 *
 * The requested address is carried in `?next=` so signing in returns you to
 * where you were going rather than to a landing page, which is what the spec's
 * Exit line asks for. `signedIn` says only that someone authenticated — §3.2
 * rule 3 means every screen still evaluates its own capability per request.
 */
function RequireSession() {
  const signedIn = useSession((s) => s.signedIn)
  const { pathname, search } = useLocation()
  if (signedIn) return <Outlet />
  const next = encodeURIComponent(`${pathname}${search}`)
  return <Navigate to={`/login?next=${next}`} replace />
}

export function App() {
  // The completeness assertion. Reported, not thrown, so a gap is visible in
  // the console without taking the whole app down mid-build.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const result = verifyRegistry(
      ROUTED_SCREENS.map((s) => s.route!),
      Object.keys(SCREEN_COMPONENTS),
    )
    const label = `Registry check — ${result.counts.screens} screens · ${result.counts.routed} routed · ${result.counts.overlays} overlays · ${result.counts.t1} T1 · ${result.counts.withBubble} carry the Z7b bubble`
    if (result.ok) {
      console.info(`✓ ${label}`)
    } else {
      console.warn(`✗ ${label}`)
      for (const p of result.problems) console.warn('  ·', p)
    }
    console.info(
      `  ${OVERLAY_SCREENS.map((s) => `${s.id} (${s.surface})`).join(', ')} are modals or overlays, not routes.`,
    )
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* The one public route. It sits OUTSIDE the session gate. */}
          <Route path="/login" element={<RouteAdapter screenId="S-02-01" />} />

          <Route element={<RequireSession />}>
            <Route path="/" element={<Landing />} />
            {ROUTED_SCREENS.filter((s) => s.permission !== 'public').map((spec) => (
              <Route key={spec.id} path={spec.route!} element={<RouteAdapter screenId={spec.id} />} />
            ))}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
