# Indostates Health · Doctors Portal

A clickable, frontend-only mockup of the doctor's slice of the Indostates Health
EMR, built from `../UI_ATLAS.md`.

```bash
npm install
npm run dev     # http://localhost:5180 → /login, then My Day
npm run build   # tsc -b && vite build
npm run verify  # icons · vocabulary · routes · RAG · acceptance · contrast
```

Sign in with any email address and any password of eight or more characters —
there is no authentication server, and the login screen says so. You arrive as
**Dr Ananya Iyer** (`SD-S-01`, consultant in general medicine) at **Indostates
Health Hospital, Coimbatore** (`ICH`, the hub) at **08:40 on Monday 21 September
2026**, the fixed moment §8.6 pins every screen to. There is
no backend and no network call; everything is in memory, with the session, the
clinical record and the audit trail persisted to `localStorage`.

---

## What is here

**59 screens**, 16 of them Tier 1. Five are modals or overlays rather than
routes, because that is what the atlas says they are.

| Module | Screens | What it is |
|---|---|---|
| **M-06** Outpatient Consultation | 10 | The clinician's workspace — where the record is written |
| **M-09** Orders, CPOE & Results | 7 | One order pipeline, and the loop closed on results |
| **M-08** Inpatient, doctor slice | 3 | Inpatients, the ward-round note, the admission assessment |
| **M-13** Discharge & Transitions | 4 | The handover that decides whether the patient comes back |
| **M-05** Scheduling, doctor slice | 4 | Queue, session templates, leave, referrals |
| **M-02** Access | 2 | Sign in, and proceeding when there is no care relationship |
| **M-18** Stroke-AI Command Centre | 21 | The flagship — a network run as a clock, not a queue, and a console reading real CT |
| **M-28** Assistants | 2 | The clinician and stroke assistants |
| Adjuncts | 6 | Imaging viewer, critical-finding escalation, telehealth, ADR |

### Stroke-AI Console — real pixels

`/stroke/ai-console` (`S-18-21`) shows a **real non-contrast head CT** beside the
model's reading of it and the full clinical report underneath. The slices are an
imported CQ500 study, windowed to the clinical brain window **W 80 / L 40** at
build time by `npm run ncct:import`, which also emits `src/data/ncct.generated.ts`.
No DICOM parser ships to the browser; the viewer is an `<img>` over generated
PNGs with a slice scrubber, zoom and a removable AI overlay.

Every finding is **derived from that study's own ground-truth labels**, so the
words cannot contradict the pixels: swap in a study with blood in it and the
report says ICH POSITIVE and the thrombolysis card flips to contraindicated
without a word of copy changing. The patient named on screen is always the §8
sample-kit patient the case belongs to; the CQ500 id appears once, as provenance.

### Imaging — the same real pixels, everywhere a scan is read

`/radiology/study/ST-9914/view` (`S-15-04`) opens the imported head CT in the
same viewer the console uses, with the AI read derived from the study's own
labels beside it, the full Stroke-AI report folded beneath, **Original beside
overlay** for the unmarked image, a dictated **reading note** that saves against
the study, and a card of questions about this scan that open the assistant with
a cited answer.

### One vocabulary

`VOCABULARY.md` fixes one word per thing and `npm run verify:vocab` fails the
build on a banned term. The rule that was broken: **`Inpatients` is the whole;
`Ward`, `ICU` and `ED` are its parts** — a tile labelled `Ward` must never open a
screen titled `My inpatients`. My Day's four tiles are now a partition
(`OPD · Ward · ICU · ED`), so they sum to the total; `Follow-up` was a subset of
`OPD` and made the header read 15 for a consultant with 13.

### My Day — the calm home

`/clinician` answers three questions and deliberately declines a fourth. Three
columns fill the frame edge to edge: the day as a vertical timeline; beside it
the three to five things that need attention and, under those, **Pending
today** — ward round notes due, notes to co-sign, dictated notes to sign, a
discharge summary to sign, referrals to review; in the third column the patient
counts with one line each on what is pending there, and **Discharges today**
with what stands in the way of each. Anything about a specific patient is **one tap
away**, in a Quick-Panel that shows *what changed since you last saw them*.
Results are deliberately not a widget: a critical one interrupts through the
attention card; the rest live in Results.

`🎙 Add note` dictates. It uses the browser's real `SpeechRecognition` where it
exists and falls back to a captured sample where it does not, saying which is
running. The draft is editable and **nothing is saved until you press Save** —
the one place in this application that does not autosave, because a half-heard
sentence in a clinical record is a different problem from a half-typed one.

### Notes — voice first, empty by default

Every note field in the portal — the consultation note, the ward-round note, the
admission assessment, the six discharge-summary sections, patient instructions,
the addendum dialog, the co-sign return comment and the teleconsult note — is a
`VoiceField` (`src/components/voicefield.tsx`). It opens **empty**. In the
default **Voice** mode it is one mic button with *or type* a tap away; in
**Type** mode the textarea is primary and the mic sits by the label. The
preference is per person (`Voice · Type` in the page header) and persists.
Dictated text is the clinician's own words and needs no Accept / Edit / Reject;
signing confirms it. **Tidy up with AI** sits under any field with text and
offers sentence case and the full words for every banned abbreviation, with an
Undo. The scribe is the one optional AI path — **Draft with AI** fills the
sections still empty as ghost drafts (never over your words), and those, and
only those, gate Sign until each has a decision. The stored text is the only
text that signs: a deferred draft blocks Sign, a cleared section stays empty,
and decisions persist across a reload. With the AI fabric off every mic
disappears and typing keeps working.

`MY_DAY_SPEC.md` is the component, interaction and QA specification for all of
it, including the eight acceptance tests and their measured results.

### The walkthroughs worth doing

1. **`W-06-1`, the ward-round note** — `/clinician` → open R. Lakshmanan →
   **Write the round note**. Four empty sections. Dictate the subjective one
   (the captured sample streams where the browser has no recogniser) and it
   lands in the field, editable, with its provenance line. Then **Draft with
   AI**: the other sections arrive as ghost drafts, one at MED confidence,
   expanded and unselected. **Sign stays disabled until every AI-drafted block
   has a decision and a leaf ICD-10 code is chosen** — accept the proposed
   code, tap a problem, or search the index. Dictated and typed text never
   needs a decision.
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
5. **The calm day** — from `/clinician`, tap **Critical lab** to open the
   Quick-Panel, read what changed, **Mark seen** and watch the row leave the
   list. Force `OFFLINE` from the page header first and the same action queues
   with a visible count, then flushes when you clear the state. Force `AI-LOW`
   and the ranking arrives collapsed behind an amber band, with the list in time
   order until you expand it.
6. **The assistant** — press <kbd>?</kbd> on any screen. Ask "how do I add an
   addendum", then "is this dose safe" (declined and routed), then "what is the
   weather" (declined naming what it covers).

### Three switches that change everything

| Where | What it does |
|---|---|
| **User menu → Sign in as** | Switch to the **Resident** and *Sign* becomes *Save for co-sign*; the entry lands in `/clinician/cosign`. Switch to the **Spoke physician** and the outpatient clinic disappears from the rail rather than greying out. |
| **User menu → AI fabric** | The §4.8 kill switch. Every `◆` affordance is **hidden, not greyed**, the assistant bubble unmounts, and the deterministic safety floors keep running. |
| **Page header → State** | Forces any of the 14 screen states on the current screen. `DENIED` shows no patient data at all; `OFFLINE` preserves typed content; `AI-ABSTAIN` states what is missing rather than scoring zero. |

| **User menu → Sign out** | Returns to `/login`. Break-glass grants end with the session. |

Plus the **theme toggle** in the app bar (night default) and **`/`** for global
search.

---

## How it is put together

```
src/
  atlas/        UI_ATLAS.md as TypeScript — one module per frozen vocabulary
  data/         the §8 sample data kit, verbatim, plus derived clinical records
  store/        zustand: session, ai, clinical, stroke, ui, audit
  styles/       theme.css (all tokens, both themes) · glass.css (surfaces)
  components/   C-01…C-49, the AIP patterns, the 14 state frames, charts,
                My Day's own components, the dictation panel
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
npx tsc -b               # strict, noUnusedLocals, verbatimModuleSyntax
npm run build            # 975 KB / 279 KB gzipped
npm run dev              # then, in another terminal:
npm run verify           # all three suites below
```

Three suites, each measuring rather than asserting:

| | |
|---|---|
| `verify:routes` | `scripts/walk-routes.sh` visits all 53 routed screens in headless Chrome and asserts each rendered its own `data-screen-id`. The command wall is the deliberate exception: `ARC-12` strips the shell entirely. |
| `verify:accept` | `scripts/acceptance.mjs` drives real Chrome over the DevTools Protocol — Node's global `WebSocket`, no test framework — and runs the 8 acceptance tests against the rendered DOM. |
| `verify:contrast` | `scripts/contrast.mjs` screenshots each screen, samples the **modal pixel** behind every text run, and measures the ratio in both themes. Computed-style compositing cannot see the page gradient or a `backdrop-filter`; pixels can. |

Current results:

- **52 of 53 routes render** — the one miss is the documented `ARC-12` wall.
- **Registry reconciles** — 58 rows, 53 routed, 58 components, no gaps, no orphans.
- **12 of 12 acceptance tests pass.** Full table in `MY_DAY_SPEC.md`.
- **0 contrast failures** across 325 text runs in both themes, measured on
  rendered pixels. Finding and fixing them turned up a pre-existing night-theme
  bug where white on the critical fill measured 2.27:1.
- **The `Z7b` contract** — the bubble renders exactly where each row's `z7b`
  field declares, and is absent on the wall, both assistant screens and `/login`.
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
- **Not the whole atlas.** 58 of 270 screens: the doctor's portal plus the
  stroke flagship. The remaining modules — nursing, pharmacy, billing, the
  patient channels — are out of scope for this build.

### Notes carried forward from the atlas

- §6.1 freezes `Z7b` as "a 56px floating bubble, **not a bar**", but two
  `S-08-01` wireframes and the §10.4 checklist call it a "RAG help bar". §6.1 and
  the frozen zone table win here; the bar renderings are treated as drafting
  slips.
- §5.3 makes the night theme mandatory on `S-12-*`, `S-13-*`, `S-18-*` and
  `S-15-04/05`. Night is the default for this build, with an explicit toggle
  to light. Where a clinician has switched to light, those screens **surface**
  the rule — one dismissible line with a one-click switch — rather than
  changing the theme underneath them.
- §1.2 allocates `C-01…C-48` while §5.6 defines `C-49`. This build follows §5.6.
- §8.6 says "18 in clinic, 4 seen", but the §8 cast is ten patients and three of
  them are an inpatient, a stroke transfer and an ED MLC — so eighteen distinct
  outpatient slots cannot be filled without inventing patients, which §8 forbids.
  The counts are the cohort sizes of the modelled rows and the figure 18 does not
  appear on screen.
- `S-02-01`'s spec line says it carries the `GP-17` bubble. It does not here:
  §6.1 requires every answer to be filtered to what the caller may already read,
  and before sign-in there is no caller. `MY_DAY_SPEC.md` §9 lists every
  deviation with its reason.
