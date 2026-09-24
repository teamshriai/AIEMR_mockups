/**
 * The print preview — one modal for every "Print" in the portal.
 *
 * There is no print server in this build, so the preview IS the deliverable:
 * what the ward printer would put on paper, laid out as prose with the
 * patient line on top and each section under its heading. "Print" hands it to
 * the browser's own print dialog, which is real, and says which printer the
 * ward would normally use.
 */

import type { ReactNode } from 'react'

import { Modal } from '@/components/overlays'
import { Button, Icon } from '@/components/primitives'
import type { Patient } from '@/data/kit'
import { HUB } from '@/data/kit'
import { useUI } from '@/store/ui'

export interface PrintSection {
  heading: string
  body: string
  /** Rendered with the raised line height Indic scripts need. */
  lang?: string
}

export function PrintPreview({
  open,
  onClose,
  title,
  patient,
  meta,
  sections,
  paper = 'A4',
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  patient?: Patient
  /** One line under the title — encounter number, who signed, when. */
  meta?: string
  sections: PrintSection[]
  paper?: 'A4' | 'A5'
  footer?: ReactNode
}) {
  const toast = useUI((s) => s.toast)
  const printer = patient?.bed ? `${patient.bed.split('-')[0]} ward printer` : 'OPD front-desk printer'

  return (
    <Modal
      open={open}
      size="lg"
      title={
        <span className="flex items-center gap-2">
          <Icon name="Printer" size={16} />
          Print preview · {paper}
        </span>
      }
      subtitle={`${HUB.name} · ${printer}`}
      onClose={onClose}
      footer={
        <>
          {footer}
          <Button icon="X" onClick={onClose}>
            Close
          </Button>
          <Button
            tone="primary"
            icon="Printer"
            onClick={() => {
              toast({ tone: 'success', title: 'Sent to print', detail: `${title} · ${paper} · ${printer}.` })
              onClose()
              try {
                window.print()
              } catch {
                /* a browser without a print dialog — the toast has already said what happened */
              }
            }}
          >
            Print
          </Button>
        </>
      }
    >
      {/* Paper-white on purpose in both themes: this is what leaves the printer. */}
      <article
        className="mx-auto max-h-[60vh] overflow-y-auto rounded-panel bg-white px-8 py-7 text-[#111827] shadow-glass"
        style={{ maxWidth: paper === 'A5' ? '30rem' : '40rem' }}
      >
        <header className="border-b border-[#e5e7eb] pb-3">
          <p className="text-[0.78em] font-semibold tracking-[0.08em] text-[#6b7280] uppercase">{HUB.name}</p>
          <h1 className="mt-1 text-xl font-bold">{title}</h1>
          {patient && (
            <p className="mt-1 text-[0.95em]">
              <span className="font-semibold">{patient.name}</span>
              {patient.nameNative && <span className="ml-1.5">{patient.nameNative}</span>} · {patient.age}/{patient.sex} ·{' '}
              <span className="tabular">{patient.uhid}</span>
              {patient.bed && ` · ${patient.bed}`}
            </p>
          )}
          {meta && <p className="tabular mt-1 text-[0.88em] text-[#6b7280]">{meta}</p>}
        </header>
        <div className="mt-4 space-y-4">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="text-[0.8em] font-bold tracking-[0.08em] text-[#374151] uppercase">{s.heading}</h2>
              {s.body.trim() === '' ? (
                <p className="mt-1 text-[0.92em] italic text-[#9ca3af]">Not recorded.</p>
              ) : (
                <div className={s.lang ? 'mt-1 space-y-2 leading-loose' : 'mt-1 space-y-2 leading-relaxed'} lang={s.lang}>
                  {s.body.split(/\n{2,}/).map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </article>
    </Modal>
  )
}
