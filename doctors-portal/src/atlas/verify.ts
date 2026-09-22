/**
 * The atlas's own completeness guarantee, applied to the code.
 *
 * §0.3: "Three sets must reconcile exactly: the screen IDs in the registry ·
 * the specification headings · the screen IDs referenced anywhere else. A
 * screen in the registry with no specification is a gap; a specification not in
 * the registry is an orphan. Neither is permitted."
 *
 * Here the equivalent sets are: the registry rows · the mounted routes · the
 * screen components. Any mismatch throws in development, loudly, at startup.
 */

import { ARCHETYPE_SPECS } from './archetypes'
import { CAPABILITIES } from './capabilities'
import { COMPLIANCE } from './compliance'
import { NAV_ITEMS } from './nav'
import { ROUTED_SCREENS, SCREENS, isBare, showsAssistantBubble } from './registry'

export interface VerifyResult {
  ok: boolean
  problems: string[]
  counts: {
    screens: number
    routed: number
    overlays: number
    t1: number
    withBubble: number
  }
}

/**
 * @param mountedRoutes every route string the router actually mounts
 * @param implementedScreens every screen id that has a component
 */
export function verifyRegistry(mountedRoutes: string[], implementedScreens: string[]): VerifyResult {
  const problems: string[] = []

  const ids = new Set<string>()
  for (const s of SCREENS) {
    if (ids.has(s.id)) problems.push(`Duplicate registry row for ${s.id}`)
    ids.add(s.id)
  }

  // Every routed screen must be mounted, and every mounted route must have a row.
  const mounted = new Set(mountedRoutes)
  for (const s of ROUTED_SCREENS) {
    if (!mounted.has(s.route!)) {
      problems.push(`${s.id} "${s.name}" has route ${s.route} but the router does not mount it`)
    }
  }
  const declared = new Set(ROUTED_SCREENS.map((s) => s.route!))
  for (const route of mountedRoutes) {
    if (!declared.has(route)) problems.push(`Route ${route} is mounted but has no registry row`)
  }

  // Every screen — routed or overlay — must have a component.
  const implemented = new Set(implementedScreens)
  for (const s of SCREENS) {
    if (!implemented.has(s.id)) problems.push(`${s.id} "${s.name}" has no component`)
  }
  for (const id of implementedScreens) {
    if (!ids.has(id)) problems.push(`Component ${id} is an orphan — no registry row`)
  }

  // Referential integrity against the frozen vocabularies.
  for (const s of SCREENS) {
    if (!ARCHETYPE_SPECS[s.archetype]) problems.push(`${s.id} names unknown archetype ${s.archetype}`)
    for (const ai of s.ai) {
      if (!CAPABILITIES[ai]) problems.push(`${s.id} names unknown AI capability ${ai}`)
    }
    for (const cmp of s.compliance ?? []) {
      if (!COMPLIANCE[cmp]) problems.push(`${s.id} names unknown compliance obligation ${cmp}`)
    }
    if (s.route === null && !s.surface) {
      problems.push(`${s.id} has no route and no surface — say whether it is a modal or an overlay`)
    }

    // §6.1 — an ARC-12 wall carries no input affordances, so no bubble.
    if (isBare(s) && showsAssistantBubble(s)) {
      problems.push(`${s.id} is an ARC-12 wall but declares Z7b GP-17 — a wall has no operator at it`)
    }
    // The assistant screens are their own entry point, never an element on themselves.
    if (s.module === 'M-28' && s.z7b !== 'n/a') {
      problems.push(`${s.id} is an assistant screen and must declare Z7b n/a`)
    }
  }

  // Every nav item must point at a real route.
  for (const item of NAV_ITEMS) {
    const hit = ROUTED_SCREENS.some((s) => {
      const pattern = s.route!.split('/').filter(Boolean)
      const parts = item.to.split('/').filter(Boolean)
      return (
        pattern.length === parts.length &&
        pattern.every((seg, i) => seg.startsWith(':') || seg === parts[i])
      )
    })
    if (!hit) problems.push(`Nav item "${item.label}" points at ${item.to}, which no screen serves`)
  }

  return {
    ok: problems.length === 0,
    problems,
    counts: {
      screens: SCREENS.length,
      routed: ROUTED_SCREENS.length,
      overlays: SCREENS.length - ROUTED_SCREENS.length,
      t1: SCREENS.filter((s) => s.tier === 'T1').length,
      withBubble: SCREENS.filter(showsAssistantBubble).length,
    },
  }
}
