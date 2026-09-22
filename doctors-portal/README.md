# Indostates Health · Doctors Portal

A clickable, frontend-only mockup of the doctor's slice of the Indostates Health
EMR, built from `../UI_ATLAS.md`.

```bash
npm install
npm run dev     # http://localhost:5173 → lands on /clinician
npm run build   # tsc -b && vite build
```

You arrive as **Dr Ananya Iyer** (`SD-S-01`, consultant in general medicine) at
**08:40 on Monday 21 September 2026**, the fixed moment §8.6 pins every screen
to. There is no backend and no network call; everything is in memory, with the
session and the clinical record persisted to `localStorage`.

---

## What is here

**57 screens**, 13 of them Tier 1. Five are modals or overlays rather than
routes, because that is what the atlas says they are.

| Module | Screens | What it is |
|---|---|---|
| **M-06** Outpatient Consultation | 10 | The clinician's workspace — where the record is written |
| **M-09** Orders, CPOE & Results | 7 | One order pipeline, and the loop closed on results |
| **M-08** Inpatient, doctor slice | 3 | My inpatients, the ward-round note, the admission assessment |
| **M-13** Discharge & Transitions | 4 | The handover that decides whether the patient comes back |
| **M-05** Scheduling, doctor slice | 4 | Queue, session templates, leave, referrals |
| **M-02** Break-glass | 1 | Proceeding when there is no care relationship |
| **M-18** Stroke-AI Command Centre | 20 | The flagship — a network run as a clock, not a queue |
| **M-28** Assistants | 2 | The clinician and stroke assistants |
| Adjuncts | 6 | Imaging viewer, critical-finding escalation, telehealth, ADR |

### The five walkthroughs worth doing

1. **`W-06-1`, the outpatient consultation** — `/clinician` → open R. Lakshmanan
   → **Write the round note** → *Dictate* → disposition each drafted section.
   One section arrives at MED confidence, expanded and unselected. **Sign stays
   disabled until every drafted block has a decision.**
2. **The hard stop** (deck beat #8, the atlas's most important frame) — from the
   round note, **Prescribe**. Co-amoxiclav is blocked for a penicillin-allergic
   patient by a *deterministic rule*, three alternatives are offered, and an
   override needs a reason **and** a second consultant's authentication.
   Switch the AI off from the user menu and the block still fires.
3. **The critical result** — `/results/inbox`. The potassium interrupts a named
   clinician who must acknowledge it; the dialog cannot be dismissed without a
   disposition, and acknowledging is offered separately from documenting.
4. **The stroke pathway** (deck beats #17–21) — `/stroke/wall` →
   `/stroke/spoke` → `/stroke/case/0141/imaging` →
   `/stroke/case/0141/clock` → `/stroke/case/0141/thrombolysis` →
   `/stroke/case/0141/transfer`. The case clock runs in real time; stamping the
   needle closes the door-to-needle interval.
5. **The assistant** — press <kbd>?</kbd> on any screen. Ask "how do I add an
   addendum", then "is this dose safe" (declined and routed), then "what is the
   weather" (declined naming what it covers).

### Three switches that change everything

| Where | What it does |
|---|---|
| **User menu → Sign in as** | Switch to the **Resident** and *Sign* becomes *Save for co-sign*; the entry lands in `/clinician/cosign`. Switch to the **Spoke physician** and the outpatient clinic disappears from the rail rather than greying out. |
| **User menu → AI fabric** | The §4.8 kill switch. Every `◆` affordance is **hidden, not greyed**, the assistant bubble unmounts, and the deterministic safety floors keep running. |
| **Page header → State** | Forces any of the 14 screen states on the current screen. `DENIED` shows no patient data at all; `OFFLINE` preserves typed content; `AI-ABSTAIN` states what is missing rather than scoring zero. |

Plus the **theme toggle** in the app bar (light default) and **`/`** for global
search.

---

## How it is put together

```
src/
  atlas/        UI_ATLAS.md as TypeScript — one module per frozen vocabulary
  data/         the §8 sample data kit, verbatim, plus derived clinical records
  store/        zustand: session, ai, clinical, stroke, ui
  styles/       theme.css (all tokens, both themes) · glass.css (surfaces)
  components/   C-01…C-49, the AIP patterns, the 14 state frames, charts
  archetypes/   one layout shell per ARC-xx
  shell/        Z1…Z8, including the Z7b assistant bubble and its panel
  screens/      one file per screen, grouped by module
```

**`src/atlas/registry.ts` is the spine.** Every screen is one typed row, and the
router, the nav rail, the breadcrumb, the page title, the density, the theme
default, the compliance chips and the assistant's context all derive from it.
Nothing about a screen is stated twice. `verifyRegistry()` reconciles the
registry against the mounted routes and the implemented components on startup in
development, and logs the result — the atlas's own completeness guarantee,
applied to the code.

### Design: glass over the atlas's semantics

**Glassmorphism governs surfaces; the atlas governs meaning.** §5.3 freezes three
palettes that never borrow from each other, so the reference image supplies only
the surface layer — the page gradient, the frosted fills, the blur, the borders
and the radii. Its indigo accent card happens to sit inside the atlas's AI-indigo
family, which is why the AI surface looks like the reference image's hero card
and nothing else does.

Four rules keep it legible, and three of them are atlas hard rules:

- **Text never sits on the page gradient.** It sits on a glass fill, and body
  copy uses the stronger one.
- **Colour is never the only carrier.** Every semantic state renders an icon
  **and** a word. An abnormal result reads `↑ High`, never a red cell.
- **Clinical semantics never get glass.** A critical chip is opaque. Frosting a
  critical value is how it gets missed.
- **`◆` is reserved for AI**, 12px, AI-indigo, nowhere else.

Contrast is ≥4.5:1 in both themes, measured on rendered pixels: worst sampled
ratio 5.29:1 (night) and 5.48:1 (light).

### Charts

Hand-rolled SVG rather than a chart library, so the mark specs are exact. One
axis per chart, never two. Series colours are a fourth palette — `--color-viz-1`
and `--color-viz-2`, validated at worst adjacent CVD ΔE 24.7 light / 26.8 dark —
kept separate from brand, clinical and AI for the same reason those three are
separate. The light-mode slot-2 orange sits at 2.88:1 on the surface, so every
chart that uses it ships direct labels and a table view.

### Icons

Referenced by string, because a registry row names its icon as data. The lookup
goes through the explicit map in `src/components/icons.ts` — a wildcard
`import * as Lucide` pulls in the whole library and cost this bundle about
900 KB. To add one, add it there; an unknown name renders nothing and warns in
development.

---

## Verification

```bash
npx tsc -b            # strict, noUnusedLocals, verbatimModuleSyntax
npm run build         # 923 KB / 261 KB gzipped
```

The route walk in `scripts/walk-routes.sh` visits all 52 routed screens in
headless Chrome and asserts each one rendered its own screen ID. The command
wall is the deliberate exception: `ARC-12` strips the shell entirely, so it has
no breadcrumb to print.

What has been checked, beyond the build:

- **All 52 routes render.** No blank screens, no router fallbacks.
- **Registry reconciles** — 57 rows, 57 components, no gaps, no orphans.
- **The `Z7b` contract** — the bubble is present on the five sampled clinical
  screens and absent on the command wall and both assistant screens, which is
  exactly what their `z7b` field declares.
- **Contrast ≥4.5:1** in both themes, sampled from screenshots.
- **India formatting** — no `$`, no `MM/DD`, no 12-hour clock in a clinical
  context, no cash tender anywhere. Dates and times go through
  `src/data/format.ts` and nothing else.

---

## What this is not

- **Not a backend.** No API, no persistence beyond `localStorage`, no auth. The
  routes are client-side screen addresses, which is what the atlas says they
  are.
- **Not a retrieval system.** §6.1 states the RAG backend is hypothetical and
  later work (`OQ-539`, `OQ-540`), and that what the mockup must show is "the
  affordance and the surface". So the answers in `src/data/assistant.ts` are
  canned and cited. What is *not* canned is the behaviour around them: a
  clinical question is declined and routed, an answer with no citations renders
  the abstain frame instead of its prose, and a cross-patient question is
  refused in wording identical to "I have no documentation for that".
- **Not the whole atlas.** 57 of 270 screens: the doctor's portal plus the
  stroke flagship. The remaining modules — nursing, pharmacy, billing, the
  patient channels — are out of scope for this build.

### Three notes carried forward from the atlas

- §6.1 freezes `Z7b` as "a 56px floating bubble, **not a bar**", but two
  `S-08-01` wireframes and the §10.4 checklist call it a "RAG help bar". §6.1 and
  the frozen zone table win here; the bar renderings are treated as drafting
  slips.
- §5.3 makes the night theme mandatory on `S-12-*`, `S-13-*`, `S-18-*` and
  `S-15-04/05`. The brief for this build was light-by-default with an explicit
  toggle, so those screens **surface** the rule — one dismissible line with a
  one-click switch — rather than changing the theme underneath you.
- §1.2 allocates `C-01…C-48` while §5.6 defines `C-49`. This build follows §5.6.
