/**
 * Z8 — overlays. C-31 modal, C-32 drawer, C-33 toast, C-35 confirm.
 *
 * "Z8 overlays render above all zones (incl. the expanded GP-17 chat panel)."
 *
 * The AIP-09 modal variant is "not dismissible without a disposition", so
 * `Modal` takes an explicit `dismissible` flag rather than assuming an Esc
 * handler is always welcome.
 *
 * Stacking order, since three of these can coexist: drawer 90 < modal 95 <
 * toast 100. A modal opened from inside a drawer has to sit above it, and a
 * status message a dialog can hide is not a status message.
 */

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

import { Icon, IconButton, cx } from './primitives'

function useFocusTrap(active: boolean, onEscape?: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return
    const node = ref.current
    const previous = document.activeElement as HTMLElement | null

    const focusable = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    focusable()[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && onEscape) {
        e.stopPropagation()
        onEscape()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusable()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previous?.focus()
    }
  }, [active, onEscape])

  return ref
}

// ─────────────────────────────────────────────────────────── C-31 Modal

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  /**
   * AIP-09 gates pass false. "C-31 modal, NOT DISMISSIBLE WITHOUT A
   * DISPOSITION" — so there is no Esc, no backdrop click and no close button.
   */
  dismissible = true,
  /** role="alertdialog" for a hard stop, per S-06-07's accessibility note. */
  alert,
  size = 'md',
  footer,
  children,
}: {
  open: boolean
  title: ReactNode
  subtitle?: ReactNode
  onClose?: () => void
  dismissible?: boolean
  alert?: boolean
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  children: ReactNode
}) {
  const ref = useFocusTrap(open, dismissible ? onClose : undefined)
  if (!open) return null

  const width = size === 'lg' ? 'max-w-3xl' : size === 'sm' ? 'max-w-md' : 'max-w-xl'

  return (
    <div className="fixed inset-0 z-95 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
        className={cx(
          'absolute inset-0 bg-[rgb(10_14_26/0.45)] backdrop-blur-[3px]',
          !dismissible && 'cursor-not-allowed',
        )}
      />
      <div
        ref={ref}
        role={alert ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'glass-strong relative max-h-[92dvh] w-full overflow-hidden',
          'flex flex-col rounded-t-card sm:rounded-card',
          'shadow-glass-lg',
          width,
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-glass-hairline px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[0.92em] text-ink-3">{subtitle}</p>}
          </div>
          {dismissible && onClose && <IconButton icon="X" label="Close" onClick={onClose} className="-mt-2 -mr-2" />}
        </header>
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-glass-hairline px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────── C-32 Drawer

/**
 * §6.1's responsive contract for the assistant panel, generalised:
 *   >=1024px  a right drawer of the given width
 *   768–1023  a 70%-height bottom sheet
 *   <768px    a full-screen sheet
 */
export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  width = 420,
  side = 'right',
  header,
  footer,
  children,
  labelledBy,
}: {
  open: boolean
  title?: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  width?: number
  side?: 'right' | 'left'
  /** Replaces the default header entirely, for the assistant's richer one. */
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  labelledBy?: string
}) {
  const ref = useFocusTrap(open, onClose)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-90 flex items-end justify-end md:items-stretch">
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-[rgb(10_14_26/0.35)] backdrop-blur-[2px]"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={!labelledBy && typeof title === 'string' ? title : undefined}
        style={{ ['--drawer-w' as string]: `${width}px` }}
        className={cx(
          'glass-strong relative flex w-full flex-col shadow-glass-lg',
          // phone: full-screen sheet
          'h-[100dvh] rounded-none',
          // small tablet: 70%-height bottom sheet
          'sm:h-[70dvh] sm:rounded-t-card',
          // >=1024: a right drawer at the given width
          'md:h-[100dvh] md:w-[var(--drawer-w)] md:max-w-[92vw] md:rounded-none',
          side === 'left' && 'md:order-first',
        )}
      >
        {header ?? (
          <header className="flex items-start justify-between gap-4 border-b border-glass-hairline px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-[0.92em] text-ink-3">{subtitle}</p>}
            </div>
            <IconButton icon="X" label="Close" onClick={onClose} className="-mt-2 -mr-2" />
          </header>
        )}
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="border-t border-glass-hairline px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────── C-35 Confirm

/**
 * §5.7 — "Every destructive or irreversible action gets an explicit
 * confirmation naming what will happen. `Sign` is irreversible and says so."
 */
export function ConfirmDialog({
  open,
  title,
  /** What will happen, named plainly. */
  consequence,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'primary',
  children,
}: {
  open: boolean
  title: string
  consequence: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  tone?: 'primary' | 'destructive'
  children?: ReactNode
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="glass min-h-11 rounded-pill px-4 py-2.5 font-medium hover:bg-glass-fill-hover"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cx(
              'min-h-11 rounded-pill px-4 py-2.5 font-medium',
              tone === 'destructive' ? 'bg-critical text-critical-on' : 'bg-brand text-brand-on',
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-ink-2">{consequence}</p>
      {children && <div className="mt-3">{children}</div>}
    </Modal>
  )
}

// ────────────────────────────────────────────────────────── C-33 Toasts

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; tone: 'info' | 'success' | 'caution' | 'critical'; title: string; detail?: string }[]
  onDismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  const TONES = {
    info: { cls: 'text-ink', icon: 'Info' },
    success: { cls: 'text-normal', icon: 'CircleCheck' },
    caution: { cls: 'text-caution', icon: 'TriangleAlert' },
    critical: { cls: 'text-critical', icon: 'OctagonAlert' },
  } as const

  return (
    <div
      /**
       * A new critical alert does not steal focus (§5.7): announced via
       * aria-live, role="status".
       */
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-100 flex flex-col items-center gap-2 md:right-6 md:left-auto md:bottom-6 md:items-end"
    >
      {toasts.map((t) => {
        const tone = TONES[t.tone]
        return (
          <div
            key={t.id}
            className="glass-strong pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-panel px-4 py-3 shadow-glass-lg"
          >
            <Icon name={tone.icon} size={17} className={cx('mt-0.5 shrink-0', tone.cls)} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t.title}</p>
              {t.detail && <p className="mt-0.5 text-[0.92em] text-ink-3">{t.detail}</p>}
            </div>
            <IconButton icon="X" label="Dismiss" onClick={() => onDismiss(t.id)} className="-mt-2 -mr-2 size-8" size={14} />
          </div>
        )
      })}
    </div>
  )
}
