/**
 * Z8 — the single overlay host. The C-42 explainability drawer, the patient
 * search palette, and the toast stack all live above every other zone.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ExplainPanels } from '@/components/ai'
import { Drawer, Modal, ToastStack } from '@/components/overlays'
import { Icon, TextInput } from '@/components/primitives'
import { PATIENTS } from '@/data/kit'
import { useUI } from '@/store/ui'

export function OverlayHost() {
  const { explain, closeExplain, toasts, dismissToast, searchOpen, closeSearch } = useUI()

  return (
    <>
      {/* AIP-08 / C-42 — a 480px right drawer with four fixed panels. */}
      <Drawer
        open={explain !== null}
        onClose={closeExplain}
        width={480}
        title="Why this was suggested"
        subtitle="Four fixed panels, identical on every screen"
      >
        {explain && <ExplainPanels target={explain} />}
      </Drawer>

      <SearchPalette open={searchOpen} onClose={closeSearch} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

/**
 * GP-03 — patient search. One kind of result, because a doctor at the search
 * box is looking for a patient: screens are in the nav, and orders and results
 * live on the patient's record. Keyboard `/` or the sidebar's Patient search
 * — both open this one palette (on a phone, the app bar's one icon).
 *
 * AI-901's guardrail still holds: it "returns nothing the caller cannot
 * already read" — the §8 patients, never a broader index.
 */
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const patients = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return PATIENTS.slice(0, 6)
    return PATIENTS.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.uhid.toLowerCase().includes(needle),
    ).slice(0, 8)
  }, [q])

  return (
    <Modal open={open} onClose={onClose} title="Patient search" subtitle="Name or UHID · type / from anywhere">
      <TextInput autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="R. Lakshmanan · ICH-0044051" />

      {patients.length > 0 ? (
        <ul className="mt-4">
          {patients.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  navigate(`/patient/${p.uhid}/record`)
                  onClose()
                }}
                className="flex w-full min-h-11 items-center gap-3 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover"
              >
                <Icon name="User" size={15} className="shrink-0 text-ink-3" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.name}</span>
                  <span className="tabular block truncate text-[0.86em] text-ink-3">
                    {p.uhid} · {p.age}/{p.sex} · {p.bed ?? 'outpatient'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-center text-ink-3">
          Nothing matched. Only the {PATIENTS.length} patients in the sample-data kit exist here — the atlas forbids
          inventing another.
        </p>
      )}
    </Modal>
  )
}
