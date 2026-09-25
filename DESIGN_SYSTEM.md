# Indostates Health — Shared Design System

**For:** every portal team (Doctors, Patient, Telehealth, Front Office, and any new portal).
**Source of truth:** `doctors-portal/src/styles/theme.css` (tokens) and `doctors-portal/src/styles/glass.css` (surfaces and base styles). The spec behind them is `UI_ATLAS.md` §5 and §6.
**Goal:** every portal looks the same and works the same way, so staff and patients moving between portals never have to re-learn colours, layout or wording.

> **One-line summary:** Glass surfaces, Indostates blue for brand, a fixed clinical colour set for clinical meaning, indigo for AI only. These never mix.

---

## 1. Quick start for a new portal

Use the same stack so tokens and classes work without changes:

| Piece | Version / choice |
|---|---|
| Framework | React 19 + Vite + TypeScript |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) with `@theme` tokens |
| Icons | `lucide-react` (outline, 2px stroke) |
| Font | Plus Jakarta Sans (Latin), Noto Sans Devanagari / per-script Noto for Indic |
| State | zustand |

**Step 1 — copy the two stylesheets as they are:**

```
doctors-portal/src/styles/index.css   →  your-portal/src/styles/index.css
doctors-portal/src/styles/theme.css   →  your-portal/src/styles/theme.css
doctors-portal/src/styles/glass.css   →  your-portal/src/styles/glass.css
```

Import `index.css` once in `main.tsx`. **Don't fork the values.** If you need a new token, add it to the shared file and tell the other teams.

**Step 2 — load the fonts in `index.html`:**

```html
<html lang="en" data-theme="light" data-density="comfortable">
<head>
  <meta name="color-scheme" content="light dark" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300..800;1,300..800&family=Noto+Sans+Devanagari:wght@400;500;600&display=swap" rel="stylesheet" />
  <title>Indostates Health · <Portal name></title>
</head>
```

**Step 3 — switch theme and density on `<html>`:**

```ts
document.documentElement.dataset.theme = 'light' | 'night'
document.documentElement.dataset.density = 'compact' | 'comfortable' | 'wall'
```

**Step 4 — reuse the primitives.** Copy `doctors-portal/src/components/primitives.tsx` (Button, IconButton, Card, Chip, ClinicalFlag, StatTile, Table, Tabs, Field, TextInput, Select, Toggle, Checkbox, Alert, EmptyState, Skeleton, Stepper, KeyValue) and `components/icons.ts`. Building your own button almost always ends up looking slightly different.

---

## 2. The core rule: four palettes, never mixed

| Palette | What it means | Where it's used | Never used for |
|---|---|---|---|
| **Brand** (Indostates blue) | "This is Indostates" / "do this" | Navigation, primary buttons, logo, selected nav item | Clinical status of any kind |
| **Clinical** (green / amber / red / deep red / violet / grey) | A clinical fact about a patient | Results, vitals, alerts, infection flags | Buttons, branding, decoration |
| **AI** (indigo) | "AI made or suggested this" | ◆ glyph, AI suggestions, ghost text, AI buttons, focus ring | Anything not AI |
| **Priority** (My Day) | "This needs you next" | Task urgency, queue ordering | Clinical findings |

Charts have their own series colours (`viz-*`). A trend line isn't a status, so it doesn't borrow clinical colours.

**Why:** a blue that means "brand" in the header and "normal result" in the body leads to mistakes. Keeping the palettes apart means each colour has only one meaning.

---

## 3. Colour tokens

Each token becomes a Tailwind utility automatically: `--color-brand` → `bg-brand`, `text-brand`, `border-brand`, `bg-brand/20` and so on.

### 3.1 Brand

| Token | Light | Night | Use |
|---|---|---|---|
| `brand` | `#1B4D8F` | `#8AB9EE` | Primary buttons, active nav text, links |
| `brand-dark` | `#0F2F57` | `#A8CCF4` | Primary button hover |
| `brand-soft` | `#E8F0F9` | `rgb(124 176 236 / .16)` | Active nav background, selected table row |
| `brand-on` | `#FFFFFF` | `#0D1220` | Text on a `brand` fill |

### 3.2 Ink (text)

| Token | Light | Night | Use |
|---|---|---|---|
| `ink` | `#15161C` | `#EEF1F7` | Body text, headings |
| `ink-2` | `#3F4453` | `#C4CAD8` | Secondary text, labels |
| `ink-3` | `#555C6C` | `#9AA3B6` | Subtitles, table headers, meta |
| `ink-muted` | `#6B7280` | `#939BAE` | Placeholders, disabled hints |
| `ink-invert` | `#FFFFFF` | `#0D1220` | Text on an inverted surface |

### 3.3 Clinical semantics (closed set)

Every clinical state **must also show an icon and a text label.** Colour alone is never enough (about 8% of male clinicians have a colour-vision deficiency).

| Token | Light | Night | Meaning | Icon to pair |
|---|---|---|---|---|
| `normal` / `normal-soft` | `#137547` / `#E3F3EA` | `#34D399` / 16% | Within range, compliant | `Check` / `CircleCheck` |
| `caution` / `caution-soft` | `#B05109` / `#FDF0E1` | `#FBBF24` / 16% | Borderline, due soon | `TriangleAlert` |
| `abnormal` / `abnormal-soft` | `#B42318` / `#FDECEB` | `#FA9090` / 16% | Out of range, overdue | `ArrowUp` / `ArrowDown` / `CircleAlert` |
| `critical` / `critical-soft` | `#7A0C16` / `#FBE4E6` | `#FF9F9F` / 20% | Life-threatening, hard stop | `TriangleAlert` / `OctagonAlert` |
| `critical-on` | `#FFFFFF` | `#0D1220` | Text on a solid critical fill | — |
| `isolation` / `isolation-soft` | `#7C3AED` / `#F2EBFE` | `#B9A3FB` / 16% | Isolation, infection flag | — |
| `inactive` / `inactive-soft` | `#626C80` / `#EEF0F3` | `#A7B0BE` / 14% | Cancelled, discharged, historical | `CircleSlash` |

Chip pattern: `bg-{tone}-soft text-{tone}`. Critical is always a **solid** fill: `bg-critical text-critical-on`.

### 3.4 AI

| Token | Light | Night | Use |
|---|---|---|---|
| `ai` | `#4F46E5` | `#A5B4FC` | ◆ glyph, AI text, **focus ring** |
| `ai-strong` | `#3F36CF` | `#C7D2FE` | Emphasis |
| `ai-soft` | `#EEF2FF` | 14% | AI chip / alert background |
| `ai-ghost` | 5% indigo | 7% | Background of ghost (draft) text |
| `ai-on` | `#FFFFFF` | `#0D1220` | Text on AI fill |
| `ai-grad-from → ai-grad-to` | `#4F46E5 → #7C79E8` | `#4F46E5 → #8B86F0` | `.ai-surface` hero card / AI button |
| `ai-accent` / `ai-glow` | `#6366F1` / 25% | — / 35% | **Only** for the live-microphone (`voice-active`) state |

### 3.5 Priority (My Day / queues / worklists)

The hue goes on **shapes** (dot, left rule, badge). Reason text stays in plain `ink`. Use `-ink` only when the text itself has to be coloured.

| Level | Hue (shape) | Solid badge `-fill` | Text on badge | `-ink` light / night |
|---|---|---|---|---|
| `pri-critical` | `#DC2626` | `#DC2626` | white | `#B91C1C` / `#F87171` |
| `pri-warning` | `#F59E0B` | `#F59E0B` | `#15161C` (dark) | `#B45309` / `#FBBF24` |
| `pri-pending` | `#FACC15` | `#FACC15` | dark | `#854D0E` / `#FACC15` |
| `pri-normal` | `#3B82F6` | `#2563EB` | white | `#1D4ED8` / `#7AB3FF` |
| `pri-safe` (done) | `#22C55E` | `#22C55E` | dark | `#15803D` / `#4ADE80` |

Each level also has a `-soft` tint (12–20% alpha) for row backgrounds.

### 3.6 Charts

| Token | Light | Night |
|---|---|---|
| `viz-1` (blue) | `#2A78D6` | `#3987E5` |
| `viz-2` (orange) | `#EB6834` | `#D95926` |
| `viz-band` (reference range) | green 10% | green 12% |
| `viz-grid` | ink 10% | white 12% |

`viz-2` reaches only 2.88:1 on light cards, so any chart that uses it also needs direct labels and a table view.

### 3.7 Imaging (CT / DICOM viewers)

Images are always read on black, in both themes. For chrome drawn over an image, use these instead of themed inks: `on-image-ai #A5B4FC`, `on-image-critical #FCA5A5`, `on-image-ink white/72%`.

---

## 4. Surfaces (glassmorphism)

### 4.1 Page background

A fixed 135° gradient on `body::before`. **Light:** `#EEF2FF → #F8FAFC → #E0F2FE → #EEF2FF`. **Night:** `#0D1220 → #161D2E`, plus two blurred blooms (indigo 16%, mint 8%). This is already handled in `glass.css`, so you don't need to add anything.

### 4.2 Surface classes

| Class | When |
|---|---|
| `.glass` | Default frosted card (white 55%, 14px blur) |
| `.glass-strong` | Cards with **body text or dense data** (white 72%) |
| `.glass-muted` | Secondary, cooler panel; tab track; search field |
| `.glass-inset` | Nested inside a glass card (no second blur); table header row |
| `.glass-card` | Adds the 18px card radius |
| `.glass-hover` | Background + shadow change on hover (list items, rows) |
| `.lift` | 2px hover lift. **Cards and tiles only, never list rows** |
| `.chrome-bar` | Sticky app bar, bottom action bar, phone tab bar (93% opaque) |
| `.menu-surface` | Dropdowns, notification panel, user menu (99% opaque) |
| `.overlay-surface` | Drawers, modals and toasts (99% opaque, like `.menu-surface`) — the page underneath never shows through |
| `.ai-surface` | Indigo gradient. **AI only** |
| `.ai-ghost` / `.ai-ghost-accepted` | AI draft text in a field / after accept |
| `voice-active` | Indigo border and glow while the mic is live |
| `.thin-scroll`, `.no-scrollbar` | Scroll areas |
| `.gutter` | 16px side padding (24px from 1024px up) |
| `.tap` | 44 × 44px minimum touch target |
| `.tabular` | Tabular numerals |

### 4.3 The five glass rules

1. **Text never sits directly on the page gradient.** Always put it on a glass fill.
2. **Colour is never the only signal.** Always add an icon and a text label.
3. **Clinical states never use glass.** A critical chip is opaque.
4. **The ◆ is reserved for AI:** 12px, AI-indigo, and nowhere else.
5. **Stack at most two `backdrop-filter` layers.** `glass.css` already provides the opaque fallback.

---

## 5. Shape, shadow, motion

| Token | Value | Use |
|---|---|---|
| `--radius-card` | 18px | Cards (`rounded-card`) |
| `--radius-panel` | 14px | Panels, alerts, menus |
| `--radius-field` | 14px | Inputs, selects |
| `--radius-chip` | 10px | Chips |
| `--radius-pill` | 999px | **Buttons, tabs, nav items, icon buttons** (everything clickable is a pill) |
| `--blur-glass` | 14px | Every glass layer |
| `--shadow-glass` | `0 6px 20px rgb(0 0 0/.08)` + inset highlight | Cards |
| `--shadow-glass-lg` | `0 12px 32px rgb(0 0 0/.12)` | Hover, raised |
| `--shadow-menu` | deep, two-layer | Floating menus |
| `--ease-out-clinical` | `cubic-bezier(.22,1,.36,1)` | All UI transitions |

**Motion rules:** transitions last 150–200ms (`duration-150 ease-out-clinical`), and nothing on a clinical screen animates longer than 200ms. `prefers-reduced-motion` makes every transition instant (already in `glass.css`). A new critical alert **must not take focus**. Announce it with `role="status"` / `aria-live` instead.

---

## 6. Typography

| Use | Setting |
|---|---|
| Family | `Plus Jakarta Sans` for Latin (one face everywhere, codes and keys included); Noto Sans per Indic script, with **line-height 15% taller** |
| Density: `compact` | 13px (clinicians, dense data) |
| Density: `comfortable` | 14px (default; **use for Patient and Front Office portals**) |
| Density: `wall` | 18px (wall displays read from 3–4 m) |
| Body line-height | 1.5 |
| Card title | `font-semibold tracking-tight` |
| Section / table header label | `text-[0.76em]–[0.8em] font-bold uppercase tracking-[0.08em] text-ink-3` |
| KPI value | `text-3xl font-bold tracking-tight tabular` |
| Numbers in columns, clocks, timers | **Tabular figures, always** (`.tabular`, automatic on `<table>`) |

Size text in `em` relative to density (`text-[0.92em]`) rather than fixed px, so the density switch scales the whole portal.

### India formatting rules (all portals)

- **Money:** `₹12,45,678` in Indian lakh/crore grouping. Dashboards may show `₹12.46 L` / `₹1.25 Cr`, but invoices never do.
- **Dates:** `DD-MMM-YYYY` (`21-Sep-2026`) or `DD/MM/YYYY`. **`MM/DD` is forbidden.**
- **Time:** 24-hour (`14:30`) in every clinical context.
- **Names:** shown in Latin and native script where available.
- **Doses, weights, heights:** always with units.
- **Patient-facing documents:** bilingual (English plus the patient's language).

---

## 7. Components (reuse these, don't restyle)

| Component | Recipe |
|---|---|
| **Button, primary** | `rounded-pill bg-brand text-brand-on hover:bg-brand-dark min-h-11 px-4 py-2.5 font-medium` |
| **Button, secondary** | `.glass text-ink hover:bg-glass-fill-hover` |
| **Button, tertiary** | transparent, `text-ink-2 hover:bg-glass-fill` |
| **Button, destructive** | `bg-critical text-critical-on` |
| **Button, AI** | `.ai-surface` (e.g. "Draft with AI") |
| Button sizes | sm `px-3 py-1.5` · md `px-4 py-2.5` · lg `px-6 py-3.5 text-base`; disabled `opacity-45` |
| **Icon button** | `size-11 rounded-pill`; **tooltip and `aria-label` are both required**; active = `bg-glass-fill-strong text-brand` |
| **Card** | `.glass-strong .glass-card`; header `px-5 pt-4 pb-3`, 16px icon in `text-ink-3` |
| **Card tone** | A highlighted card: a **solid** fill, the same in both themes, that carries its own inks (`.card-toned` redefines `--color-ink*`, the glass surfaces and brand on the card, so rows, badges and buttons inside follow). One purpose, one colour, on every screen — `patient` blue (a patient's summary, OPD), `inpatients` green, `schedule` slate (the day, appointments, teleconsult queue), `signoff` purple (pending sign-offs), `notes` gold with dark ink (the doctor's own to-do notes), `discharge` teal, `ai` indigo; an attention card takes `accent={urgency}` (red / amber / dark gold). Props on `SectionCard`, `Card`, `Worklist` and the My patients tiles. Tokens `--color-card-*` in theme.css. Results, imaging, orders, notes editors and stroke surfaces stay glass on purpose; clinical chips keep their own soft fills on any card. |
| **Chip** | `rounded-chip px-2 py-0.5 text-[0.86em] font-medium`, 12px icon |
| **Input / select / textarea** | `rounded-field border-glass-hairline bg-glass-fill-strong px-3.5 py-2.5 min-h-11`, focus = `border-ai` |
| **Field label** | `text-[0.92em] font-medium text-ink-2`; required `*` in `text-abnormal`; error text `text-abnormal` with icon |
| **Tabs** | Pill track `bg-glass-fill-muted p-1`; active tab `bg-glass-fill-strong text-ink shadow-glass`; inactive `text-ink-3` |
| **Table** | Header row `bg-glass-inset`, sticky; cells `px-4 py-3 border-t border-glass-hairline`; hover `bg-glass-fill-hover`; selected `bg-brand-soft` |
| **Nav item** | `rounded-pill min-h-11 px-3`; active `bg-brand-soft text-brand font-semibold`; idle `text-ink-2` |
| **Alert** | `rounded-panel border px-4 py-3` + tone: `bg-{tone}-soft text-{tone} border-{tone}/25` |
| **Toggle** | On = `bg-brand`, off = `bg-inactive-soft` |
| **Empty state** | Icon in a muted circle, a sentence explaining **why** it's empty, and an action |
| **Skeleton** | `animate-pulse rounded-field bg-glass-fill-muted` |
| **Focus ring** | `2px solid var(--color-ai)`, offset 2px, global |

---

## 8. Layout & flow (the shell every portal shares)

### 8.1 Zones (closed set of 8)

```
+-----------------------------------------------------------------------------+
| Z1  APP BAR  56px   logo | facility ▾ | search (/) | bell | lang ▾ | user   |
+--------+--------------------------------------------------------------------+
| Z2     | Z3  PATIENT BANNER 64px  (patient-scoped screens only)             |
| NAV    +--------------------------------------------------------------------+
| RAIL   | Z4  PAGE HEADER 64px  breadcrumb / title / chips / primary actions |
| 240px  +---------------------------------------------+----------------------+
| (64px  | Z5  MAIN CONTENT                            | Z6  RIGHT RAIL 320px |
| icons) |                                             |  AI / context        |
|        +---------------------------------------------+----------------------+
|        | Z7a STICKY ACTION BAR 64px                        (Z7b ◆ bubble 56px) |
+--------+--------------------------------------------------------------------+
  Z8 overlays (modal, drawer, toast) sit above everything
```

| Zone | Token | Notes |
|---|---|---|
| Z1 app bar | `h-z1` (56px) | `.chrome-bar sticky top-0`, the same in every portal |
| Z2 nav rail | `w-z2` 240 / `w-z2-collapsed` 64 | `.glass`; becomes a **bottom tab bar** under 768px. Modules the user can't access are **hidden, not disabled** |
| Z3 patient banner | `h-z3` 64px | Name, UHID, age/sex, allergy flag, ABHA chip. **Define it once and never redesign it per screen** |
| Z4 page header | `h-z4` | Title and primary action |
| Z6 right rail | `w-z6` 320px | Collapses to a 48px tab at `lg`, bottom sheet at `md` and below |
| Z7a action bar | `h-z7` | `.chrome-bar sticky bottom-0` |
| Z7b assistant bubble | 56px | **On every screen of every portal**, bottom-right. Never opens by itself |
| Assistant panel / explain drawer | 420px / 480px | Right-side overlays |

### 8.2 Stacking order (z-index)

| Layer | z |
|---|---|
| Sticky table header | 10 |
| In-page dropdown | 20 |
| Z7a action bar | 50 |
| Z1 app bar, phone tab bar | 60 |
| Assistant bubble | 70 |
| Drawers / assistant panel | 90 |
| Modals | 95 |
| Toasts | 100 |

### 8.3 Breakpoints

| Name | Min width | Layout |
|---|---|---|
| (base) | < 768 | Single column, bottom tab bar, bottom sheets. **Most Patient-portal traffic** |
| `sm` | 768 | Icon rail |
| `md` | 1024 | **Ward tablet, the breakpoint that matters most.** Design it first, not last |
| `lg` | 1280 | Right rail collapses to a tab |
| `xl` | 1440 | Full layout |
| `wall` | 1920 | Wall display: no nav, no inputs |

Side gutter: **16px minimum at every size** (`.gutter`). Spacing follows an 8px rhythm using even Tailwind steps (`p-2`, `p-4`, `p-6`). Don't change `--spacing`.

### 8.4 Flow rules (keep behaviour consistent)

- **Primary action:** one per screen, `brand` pill, in Z4 or Z7a.
- **Destructive or irreversible actions** need a confirmation that says exactly what will happen ("Sign is irreversible").
- **Authoring screens autosave** and show "Saved 15:15".
- **AI output** follows the gate ladder: if an AI suggestion needs a decision, show **Accept / Edit / Reject** as a visible button group (never inside an overflow menu). The page's primary action stays disabled until each suggestion has a decision.
- **AI confidence** is always a band plus a label, never a bare number: High (solid indigo dot), Moderate (half amber dot), Low (hollow amber ring, collapsed by default).
- **AI-sorted lists** always offer a one-click normal (deterministic) sort.
- **Keyboard:** `/` opens search, `?` opens the assistant, `Esc` closes overlays without changing the page. Every primary action can be reached without a mouse.
- **Touch targets:** at least 44px (`min-h-11`, `size-11`, `.tap`).
- **Notifications and SMS/WhatsApp never carry PHI.** "You have an appointment tomorrow at 14:30" is fine; the reason for the visit is not.

---

## 9. Themes: light and night

- Both themes come from the same token names. **Always use tokens** (`text-ink`, `bg-brand`), never raw hex or Tailwind palette colours (`text-blue-600`), so night mode works without extra effort.
- Night swaps every surface, ink and clinical hex for a dark-safe version. **Contrast must be at least 4.5:1 in both themes.**
- Night is recommended for ICU, radiology, stroke, and anything used at 03:00. Suggest it with a dismissible "Night recommended" pill, and **never switch themes without the user asking**.
- `color-scheme` follows the theme, so native pickers, selects and scrollbars match.
- **Suggested defaults per portal:**

| Portal | Theme default | Density default |
|---|---|---|
| Doctors | night (toggle available) | compact |
| Telehealth (clinician side) | light, night available | compact |
| Telehealth (patient side) | light | comfortable |
| Patient | light | comfortable |
| Front Office / Reception | light | comfortable |
| Wall displays / command centre | night | wall |

---

## 10. Vocabulary (one word per thing)

The full list is in `doctors-portal/VOCABULARY.md`. Use it in every portal. Key ones:

| Say | Never |
|---|---|
| OPD | Clinic & Queue, OP queue |
| Inpatients (Ward / ICU / ED are parts of it) | IP patients, admitted patients |
| ED | Casualty, A&E, ER |
| Teleconsult (one visit) · Telehealth (the module) | tele visit, telemedicine |
| Results · Orders · Imaging · Discharge | Reports · Requests · Radiology · Disposition |
| All · To review · Open · Done | Show all · Unreviewed · Active · Closed |
| Sign · Co-sign · Acknowledge · Addendum | Finalise · Countersign · Ack · Amendment |
| Draft with AI · Dictate · Tidy up with AI | Record, Auto-correct |

---

## 11. Do / Don't checklist (review every screen against this)

- [ ] Only tokens, no raw hex, no `blue-500`-style Tailwind colours
- [ ] Brand blue isn't used for any clinical status; clinical colours aren't used on buttons
- [ ] Indigo / ◆ appears **only** where AI is involved
- [ ] Every clinical or priority colour has an icon **and** a text label
- [ ] Text sits on a glass fill, not the raw gradient
- [ ] Clickable things are pills, 44px minimum, with a visible focus ring
- [ ] Icon-only buttons have `title` and `aria-label`
- [ ] Checked in **light and night** at 4.5:1 or better (`npm run verify:contrast` in doctors-portal shows how)
- [ ] Checked at **375px, 1024px and 1440px**
- [ ] Dates `DD-MMM-YYYY`, 24h time, `₹` with lakh grouping, units on every dose
- [ ] Assistant bubble present, bottom-right
- [ ] Animations ≤ 200ms and respect reduced-motion
- [ ] Wording matches `VOCABULARY.md`

---

*Maintainers: when a token or pattern changes in `doctors-portal/src/styles/`, update this file in the same commit and tell the other portal teams.*
