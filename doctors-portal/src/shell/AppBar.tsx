/**
 * Z1 · GP-01 — the app bar. Identical on every screen, 56px.
 *
 * "Facility switcher, global search, notification bell, language, user menu."
 *
 * Plus, for this build, the theme toggle the brief asked for and the AI kill
 * switch (§4.8), which lives behind the user menu because it belongs to
 * governance rather than to the clinician's daily use — but it has to be
 * reachable to show what AI-OFF does to 57 screens at once.
 *
 * GP-07 carries a warning worth honouring: "Switching facility changes
 * authorization scope and MUST BE UNMISTAKABLE."
 */

import { useNavigate } from 'react-router-dom'

import { PERSONA_LIST, PERSONA_SPECS } from '@/atlas/personas'
import type { PersonaId } from '@/atlas/personas'
import { Diamond } from '@/components/ai'
import { MenuItem, MenuSection, Popover } from '@/components/popover'
import { Chip, Icon, IconButton, Toggle } from '@/components/primitives'
import { FACILITIES, LANGUAGES, STAFF_FOR_PERSONA, staff } from '@/data/kit'
import { useAI } from '@/store/ai'
import { useCurrentStaff, useSession } from '@/store/session'
import { useUI } from '@/store/ui'

export function AppBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const navigate = useNavigate()
  const {
    persona,
    facilityCode,
    language,
    theme,
    toggleTheme,
    setPersona,
    setFacility,
    setLanguage,
    toggleNav,
  } = useSession()
  const me = useCurrentStaff()
  const aiEnabled = useAI((s) => s.aiEnabled)
  const setAiEnabled = useAI((s) => s.setAiEnabled)
  const toast = useUI((s) => s.toast)

  const facility = FACILITIES.find((f) => f.code === facilityCode) ?? FACILITIES[0]

  function switchPersona(p: PersonaId) {
    setPersona(p)
    const spec = PERSONA_SPECS[p]
    navigate(spec.landing)
    toast({
      tone: 'info',
      title: `Signed in as ${spec.name}`,
      detail: spec.note ?? `Landing on ${spec.landing}. The nav rail now shows only what they may enter.`,
    })
  }

  return (
    <header
      className="glass-strong sticky top-0 z-60 flex h-z1 shrink-0 items-center gap-2 border-b border-glass-hairline px-3 md:px-4"
      /* GP-01 is the same everywhere; no screen redraws it. */
    >
      {/* Nav toggle — Z2 collapses to a 64px icon rail on desktop, a tab bar on phone. */}
      <IconButton icon="Menu" label="Toggle navigation" onClick={toggleNav} className="md:inline-flex" />

      <button
        type="button"
        onClick={() => navigate(PERSONA_SPECS[persona].landing)}
        className="flex shrink-0 items-center gap-2.5 rounded-pill px-1.5 py-1 hover:bg-glass-fill-hover"
      >
        <span className="flex size-7 items-center justify-center rounded-[9px] bg-brand text-brand-on">
          <Icon name="Hospital" size={16} />
        </span>
        <span className="hidden text-[0.98em] font-semibold tracking-tight sm:inline">Indostates</span>
      </button>

      {/* GP-07 facility switcher — always visible, never buried. */}
      <Popover
        label="Switch facility"
        width={320}
        align="left"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-pill border border-glass-hairline bg-glass-fill-muted px-2.5 py-1 text-[0.88em] font-medium hover:bg-glass-fill-hover"
          >
            <span className="tabular">{facility.code}</span>
            <span className="hidden max-w-36 truncate lg:inline">{facility.name.replace('Indostates ', '')}</span>
            <Icon name="ChevronDown" size={13} className="text-ink-3" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <MenuSection title="Facility — changes your authorization scope">
              {FACILITIES.map((f) => (
                <MenuItem
                  key={f.code}
                  selected={f.code === facilityCode}
                  detail={`${f.role} · ${f.beds} beds · ${f.strokeCapability}`}
                  onClick={() => {
                    setFacility(f.code)
                    close()
                    toast({
                      tone: 'caution',
                      title: `Scope changed to ${f.code}`,
                      detail: 'What you may read and write has changed with it.',
                    })
                  }}
                >
                  {f.code} · {f.name}
                </MenuItem>
              ))}
            </MenuSection>
          </>
        )}
      </Popover>

      {/* GP-03 global search. Keyboard `/`. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="mx-auto hidden min-h-9 w-full max-w-md items-center gap-2.5 rounded-pill border border-glass-hairline bg-glass-fill-muted px-3.5 py-1.5 text-left text-ink-3 hover:bg-glass-fill-hover md:flex"
      >
        <Icon name="Search" size={15} />
        <span className="flex-1 truncate text-[0.92em]">Patient, order, result, drug…</span>
        <Chip tone="neutral" className="font-mono">
          /
        </Chip>
      </button>
      <div className="flex-1 md:hidden" />
      <IconButton icon="Search" label="Search" onClick={onOpenSearch} className="md:hidden" />

      {/* The theme toggle the brief asked for. Light is the default. */}
      <IconButton
        icon={theme === 'light' ? 'Moon' : 'Sun'}
        label={theme === 'light' ? 'Switch to night theme' : 'Switch to light theme'}
        onClick={toggleTheme}
      />

      {/* GP-04 notification bell, criticality-tiered. */}
      <Popover
        label="Notifications"
        width={340}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label="Notifications, 3 unread"
            className="relative inline-flex size-11 items-center justify-center rounded-pill hover:bg-glass-fill-hover"
          >
            <Icon name="Bell" size={17} />
            <span className="absolute top-2 right-2 flex size-4 items-center justify-center rounded-pill bg-critical text-[9px] font-bold text-white">
              3
            </span>
          </button>
        )}
      >
        {({ close }) => (
          <>
            <MenuSection title="Critical — interrupts and escalates">
              <MenuItem
                icon={<Icon name="TriangleAlert" size={15} className="text-critical" />}
                detail="J. Mathew · ICU-1 · unacknowledged 12 min"
                onClick={() => {
                  navigate('/results/inbox')
                  close()
                }}
              >
                Critical potassium 6.8 mmol/L
              </MenuItem>
            </MenuSection>
            <MenuSection title="Urgent">
              <MenuItem
                icon={<Icon name="Brain" size={15} className="text-isolation" />}
                detail="STROKE/26-27/0141 · INS · DIDO projected breach"
                onClick={() => {
                  navigate('/stroke/wall')
                  close()
                }}
              >
                Code stroke active at Nashik
              </MenuItem>
            </MenuSection>
            <MenuSection title="Routine">
              <MenuItem
                icon={<Icon name="Signature" size={15} />}
                detail="2 entries from your registrar"
                onClick={() => {
                  navigate('/clinician/cosign')
                  close()
                }}
              >
                Co-signatures pending
              </MenuItem>
            </MenuSection>
            <div className="px-4 py-2.5 text-[0.84em] text-ink-3">
              An out-of-app message never carries the reason, the diagnosis or a result — only a pointer back in.
            </div>
          </>
        )}
      </Popover>

      {/* GP-08 language. Patient documents follow the patient's preference, not this. */}
      <Popover
        label="Language"
        width={240}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="hidden min-h-9 items-center gap-1 rounded-pill px-2.5 py-1 text-[0.88em] font-medium hover:bg-glass-fill-hover sm:inline-flex"
          >
            <Icon name="Globe" size={15} />
            {language}
          </button>
        )}
      >
        {({ close }) => (
          <MenuSection title="Interface language">
            {LANGUAGES.map((l) => (
              <MenuItem
                key={l.code}
                selected={l.code === language}
                onClick={() => {
                  setLanguage(l.code)
                  close()
                }}
              >
                {l.label}
              </MenuItem>
            ))}
          </MenuSection>
        )}
      </Popover>

      {/* User menu — persona switcher, the AI kill switch, and the reset. */}
      <Popover
        label="Account and demo controls"
        width={330}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex min-h-9 shrink-0 items-center gap-2 rounded-pill py-1 pr-2 pl-1 hover:bg-glass-fill-hover"
          >
            {/* A person glyph rather than initials: "Ananya Iyer" abbreviates to
                "AI", which is the one thing an avatar must not say on a product
                whose ◆ glyph means exactly that. */}
            <span className="flex size-7 items-center justify-center rounded-pill bg-brand-soft text-brand">
              <Icon name="User" size={15} />
            </span>
            <span className="hidden max-w-32 truncate text-[0.9em] font-medium lg:inline">{me.name}</span>
            <Icon name="ChevronDown" size={13} className="text-ink-3" />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <div className="border-b border-glass-hairline px-4 py-3">
              <p className="font-semibold">{me.name}</p>
              <p className="text-[0.88em] text-ink-3">{me.personaLabel}</p>
              <p className="tabular mt-1 text-[0.84em] text-ink-3">
                {me.identifierKind} {me.identifier}
              </p>
              {PERSONA_SPECS[persona].note && (
                <p className="mt-2 rounded-chip bg-caution-soft px-2 py-1 text-[0.84em] font-medium text-caution">
                  {PERSONA_SPECS[persona].note}
                </p>
              )}
            </div>

            <MenuSection title="Sign in as — the rail and the actions change">
              {PERSONA_LIST.map((p) => (
                <MenuItem
                  key={p.id}
                  selected={p.id === persona}
                  detail={`${p.id} · ${staff(STAFF_FOR_PERSONA[p.id]).name}`}
                  onClick={() => {
                    switchPersona(p.id)
                    close()
                  }}
                >
                  {p.name}
                </MenuItem>
              ))}
            </MenuSection>

            <MenuSection title="AI governance">
              <div className="flex items-start gap-3 px-4 py-2.5">
                <span className="mt-1 flex size-5 shrink-0 items-center justify-center">
                  <Diamond />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">AI fabric</p>
                  <p className="text-[0.84em] text-ink-3">
                    Off hides every ◆ and unmounts the assistant bubble. Deterministic safety checks keep running.
                  </p>
                </div>
                <Toggle
                  checked={aiEnabled}
                  label="AI fabric enabled"
                  onChange={(v) => {
                    setAiEnabled(v)
                    toast({
                      tone: v ? 'success' : 'caution',
                      title: v ? 'AI fabric on' : 'AI fabric off — AI-OFF state',
                      detail: v
                        ? 'Every touchpoint is back.'
                        : 'Affordances are hidden, not greyed. Hard stops still fire.',
                    })
                  }}
                />
              </div>
            </MenuSection>
          </>
        )}
      </Popover>
    </header>
  )
}

