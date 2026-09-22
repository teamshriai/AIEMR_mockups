/**
 * Z2 · GP-02 — the nav rail. 240px, 64px collapsed.
 *
 * "Module-level navigation, scoped to the user's capabilities — A MODULE THE
 * USER CANNOT ENTER IS ABSENT, NOT DISABLED."
 *
 * That is why this renders `navFor(persona)` rather than the full list with
 * disabled items. Switch to the spoke physician and the outpatient clinic
 * simply is not there; switch to the radiologist and imaging is all that is.
 *
 * Responsive (§5.1): >=1024px a rail; 768–1023 an icon rail; <768 a bottom tab
 * bar, which is what the phone-first personas actually use.
 */

import { NavLink, useLocation } from 'react-router-dom'

import { navFor } from '@/atlas/nav'
import { screenForPath } from '@/atlas/registry'
import { Icon, cx } from '@/components/primitives'
import { useSession } from '@/store/session'

export function NavRail() {
  const persona = useSession((s) => s.persona)
  const collapsed = useSession((s) => s.navCollapsed)
  const items = navFor(persona)
  const { pathname } = useLocation()
  const current = screenForPath(pathname)

  return (
    <nav
      aria-label="Modules"
      className={cx(
        'glass sticky top-z1 hidden h-[calc(100dvh-var(--spacing-z1))] shrink-0 flex-col',
        'border-r border-glass-hairline py-3 transition-[width] duration-150 ease-out-clinical',
        'sm:flex',
        collapsed ? 'w-z2-collapsed px-2' : 'w-z2-collapsed px-2 md:w-z2 md:px-3',
      )}
    >
      <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const active = current?.navSection === item.section
          return (
            <li key={item.section}>
              <NavLink
                to={item.to}
                title={item.label}
                className={cx(
                  'flex min-h-11 items-center gap-3 rounded-pill px-3 py-2.5',
                  'transition-colors duration-150 ease-out-clinical',
                  active
                    ? 'bg-brand-soft font-semibold text-brand'
                    : 'text-ink-2 hover:bg-glass-fill-hover hover:text-ink',
                  collapsed && 'md:justify-center md:px-2',
                  'justify-center md:justify-start',
                )}
              >
                <Icon name={item.icon} size={18} className="shrink-0" />
                <span className={cx('hidden truncate', !collapsed && 'md:inline')}>{item.label}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>

      <p
        className={cx(
          'mt-3 hidden border-t border-glass-hairline px-3 pt-3 text-[0.78em] leading-snug text-ink-3',
          !collapsed && 'md:block',
        )}
      >
        A module you cannot enter is absent here, not greyed out.
      </p>
    </nav>
  )
}

/** <768px — Z2 becomes a bottom tab bar. The assistant bubble sits above it. */
export function NavTabBar() {
  const persona = useSession((s) => s.persona)
  const items = navFor(persona)
  const { pathname } = useLocation()
  const current = screenForPath(pathname)

  return (
    <nav
      aria-label="Modules"
      className="glass-strong fixed inset-x-0 bottom-0 z-60 border-t border-glass-hairline sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="no-scrollbar flex overflow-x-auto">
        {items.map((item) => {
          const active = current?.navSection === item.section
          return (
            <li key={item.section} className="flex-1">
              <NavLink
                to={item.to}
                className={cx(
                  'flex min-h-14 min-w-16 flex-col items-center justify-center gap-0.5 px-2 py-1.5',
                  active ? 'text-brand' : 'text-ink-3',
                )}
              >
                <Icon name={item.icon} size={19} />
                <span className="text-[10px] leading-none font-medium">{item.short}</span>
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
