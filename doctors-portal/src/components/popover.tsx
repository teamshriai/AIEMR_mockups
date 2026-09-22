import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { cx } from './primitives'

/**
 * A small anchored popover for the Z1 app bar's switchers and menus.
 * Closes on Escape, on outside click, and on route change via its `key`.
 */
export function Popover({
  trigger,
  children,
  align = 'right',
  width = 280,
  label,
}: {
  trigger: (args: { open: boolean; toggle: () => void }) => ReactNode
  children: (args: { close: () => void }) => ReactNode
  align?: 'left' | 'right'
  width?: number
  label: string
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={cx(
            'glass-strong absolute top-[calc(100%+8px)] z-70 max-w-[calc(100vw-2rem)]',
            'overflow-hidden rounded-panel shadow-glass-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  icon,
  children,
  onClick,
  selected,
  detail,
  tone,
}: {
  icon?: ReactNode
  children: ReactNode
  onClick?: () => void
  selected?: boolean
  detail?: ReactNode
  tone?: 'default' | 'critical'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full min-h-11 items-center gap-3 px-4 py-2.5 text-left',
        'transition-colors duration-150 hover:bg-glass-fill-hover',
        selected && 'bg-brand-soft',
        tone === 'critical' && 'text-critical',
      )}
    >
      {icon && <span className="flex size-5 shrink-0 items-center justify-center text-ink-3">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {detail && <span className="block truncate text-[0.86em] text-ink-3">{detail}</span>}
      </span>
    </button>
  )
}

export function MenuSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-glass-hairline py-1.5 last:border-b-0">
      <p className="px-4 pt-1 pb-1.5 text-[0.76em] font-semibold tracking-wider text-ink-3 uppercase">{title}</p>
      {children}
    </div>
  )
}
