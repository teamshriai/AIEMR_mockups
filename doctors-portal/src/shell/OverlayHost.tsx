/**
 * Z8 — the single overlay host. The C-42 explainability drawer, the global
 * search palette, and the toast stack all live above every other zone.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { ROUTED_SCREENS } from '@/atlas/registry'
import { ExplainPanels } from '@/components/ai'
import { Drawer, Modal, ToastStack } from '@/components/overlays'
import { Chip, Icon, TextInput, cx } from '@/components/primitives'
import { PATIENTS } from '@/data/kit'
import { useUI } from '@/store/ui'

export function OverlayHost({
  searchOpen,
  onCloseSearch,
}: {
  searchOpen: boolean
  onCloseSearch: () => void
}) {
  const { explain, closeExplain, toasts, dismissToast } = useUI()

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

      <SearchPalette open={searchOpen} onClose={onCloseSearch} />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

/**
 * GP-03 — global search. "Patient, order, invoice, drug, staff. AI-901
 * natural-language mode. Keyboard /."
 *
 * AI-901's guardrail matters here and is honoured: it "returns nothing the
 * caller cannot already read", so the results are the ten §8 patients and the
 * screens this persona can reach — never a broader index.
 */
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (open) setQ('')
  }, [open])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return { patients: PATIENTS.slice(0, 4), screens: ROUTED_SCREENS.slice(0, 5) }
    return {
      patients: PATIENTS.filter(
        (p) => p.name.toLowerCase().includes(needle) || p.uhid.toLowerCase().includes(needle),
      ).slice(0, 6),
      screens: ROUTED_SCREENS.filter(
        (s) =>
          s.name.toLowerCase().includes(needle) ||
          s.id.toLowerCase().includes(needle) ||
          s.route!.toLowerCase().includes(needle),
      ).slice(0, 8),
    }
  }, [q])

  const natural = q.trim().split(/\s+/).length >= 3

  return (
    <Modal open={open} onClose={onClose} title="Search" subtitle="Patients, screens and orders — type / from anywhere">
      <TextInput
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="R. Lakshmanan · AWF-0044051 · results inbox · patients on my list deteriorating"
      />

      {natural && (
        <div className="mt-3 rounded-panel border border-ai/25 bg-ai-soft px-3 py-2.5">
          <p className="flex items-center gap-2 text-[0.88em] font-semibold text-ai">
            <span className="block size-2.5 rotate-45 rounded-[1px] bg-ai" aria-hidden />
            AI-901 natural-language mode
          </p>
          <p className="mt-1 text-[0.9em] text-ink-2">
            Interpreted as a cohort query. Retrieval is filtered to what you may already read — it returns nothing you
            could not open through the UI yourself.
          </p>
        </div>
      )}

      {results.patients.length > 0 && (
        <section className="mt-4">
          <p className="mb-1.5 text-[0.78em] font-semibold tracking-wider text-ink-3 uppercase">Patients</p>
          <ul>
            {results.patients.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/patient/${p.uhid}/chart`)
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
                  {p.allergies.length > 0 && (
                    <Chip tone="critical" icon="TriangleAlert">
                      Allergy
                    </Chip>
                  )}
                  {p.mlc && <Chip tone="isolation">MLC</Chip>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.screens.length > 0 && (
        <section className="mt-4">
          <p className="mb-1.5 text-[0.78em] font-semibold tracking-wider text-ink-3 uppercase">Screens</p>
          <ul>
            {results.screens.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(s.route!.replace(/:id/g, defaultIdFor(s.route!)))
                    onClose()
                  }}
                  className="flex w-full min-h-11 items-center gap-3 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover"
                >
                  <Icon name="Layers" size={15} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="tabular block truncate text-[0.86em] text-ink-3">
                      {s.id} · {s.route}
                    </span>
                  </span>
                  <Chip tone={s.tier === 'T1' ? 'ai' : 'neutral'}>{s.tier}</Chip>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {results.patients.length === 0 && results.screens.length === 0 && (
        <p className={cx('mt-6 text-center text-ink-3')}>
          Nothing matched. Only the ten patients in the sample-data kit exist here — the atlas forbids inventing an
          eleventh.
        </p>
      )}
    </Modal>
  )
}

/** Sensible default route params so search results land somewhere real. */
export function defaultIdFor(route: string): string {
  if (route.startsWith('/patient/')) return 'AWF-0044051'
  if (route.startsWith('/stroke/case/')) return '0141'
  if (route.startsWith('/radiology/study/')) return 'ST-4471'
  if (route.startsWith('/results/')) return 'R-88410'
  if (route.startsWith('/tele/session/')) return 'E-118430'
  if (route.startsWith('/ip/encounter/')) return 'E-118366'
  return 'E-118402'
}
