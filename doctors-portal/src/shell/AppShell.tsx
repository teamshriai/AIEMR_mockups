/**
 * The zone shell. Z1 app bar, Z2 nav rail, Z7b assistant bubble, Z8 overlays.
 * Z3–Z7a are composed per screen by <Screen>.
 *
 * ARC-12 command walls strip all of it — "Z5 only. No Z1, no Z2, no input
 * affordances, no Z7b bubble. Read at 3-4 metres, runs unattended for a shift."
 * A wall route therefore renders outside this shell entirely.
 */

import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'

import { useAdmissionService } from '@/api/admissions'
import { isBare, screenForPath } from '@/atlas/registry'
import { useSession } from '@/store/session'
import { useUI } from '@/store/ui'

import { AppBar } from './AppBar'
import { AssistantBubble } from './Assistant'
import { NavRail, NavTabBar } from './NavRail'
import { OverlayHost } from './OverlayHost'

export function AppShell() {
  const { pathname } = useLocation()
  const theme = useSession((s) => s.theme)
  // The front office's side of an admission, running wherever the doctor is in the app.
  useAdmissionService()

  const spec = screenForPath(pathname)
  // The registry decides this, not the shell — a wall through its archetype,
  // sign-in through its own `bare` field.
  const bare = spec ? isBare(spec) : false

  // The theme lives on <html> so the page backdrop and every token follow it.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  // GP-03 — `/` focuses global search from anywhere but a text field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      const typing =
        t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT' || t?.isContentEditable
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        useUI.getState().openSearch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Scroll to the top of a new screen, as a page navigation should.
  useEffect(() => {
    document.querySelector('main')?.scrollTo?.({ top: 0 })
  }, [pathname])

  if (bare) {
    return (
      <>
        <Outlet />
        <OverlayHost />
      </>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar />

      <div className="flex min-h-0 flex-1">
        <NavRail />
        <div className="flex min-w-0 flex-1 flex-col">
          <Outlet />
        </div>
      </div>

      {/* <768px — Z2 becomes a bottom tab bar. */}
      <NavTabBar />

      {/* Z7b — one bubble for the whole application, never per screen. */}
      <AssistantBubble />

      <OverlayHost />
    </div>
  )
}
