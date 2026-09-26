# My Day — component, interaction and QA specification

**Written for:** the engineers and designers who will extend these screens, and
the reviewer signing off the acceptance criteria.

Covers `S-06-01` My Day, the Quick-Panel, the `🎙 Add note` dictation workflow,
`S-02-01` Sign In, and the four list screens My Day navigates into.

Everything below is measured against the running application, not asserted. The
commands that produce each figure are named.

---

## 1 · What changed and why

`S-06-01` was an `ARC-20` tile dashboard — four `StatTile`s, a six-row worklist
table with three columns of prose, two explanation card grids and a footer. It
was complete and it was unreadable at a glance: a consultant had to *read* it
before knowing what to do.

It is now one calm surface that answers four questions and declines a fifth:

| | |
|---|---|
| What is my day? | **Today**, and the **Calendar** for the month |
| Who is mine today? | **Patients Today** — OPD and Inpatients |
| What needs me right now? | **Needs Action** · Attention |
| What must I finish before I leave? | **Needs Action** · Tasks, and my To-do notes |
| *What about this patient?* | **not here** — one tap away, in the Quick-Panel or the record |

The fourth question is the one that used to bloat the screen. Every number about
a specific patient now lives behind a tap. The third was added in the September
pass (§11) because the screen had been left too plain: a right column that ran
out of content and a full-width band holding four short tiles. What fills the
space is only what is the doctor's to close — documentation, sign-offs,
discharges — never results, which reach this screen only when critical.

**Nothing the archetype mandates was lost.** `ARC-20`'s drawing notes require the
needs-attention group with its reasons, every work type on one screen, and a
visibly reversible `Sorted by AI acuity ▾`. Those are now the attention card (the
heaviest element on the screen rather than a pinned table row), the counts plus
the day's own co-sign and discharge blocks, and the one quiet line under the
attention list.

---

## 2 · Layout

```
1440                                                                        375
┌──────┬──────────────────────────────┬─────────────────────────────────┐  ┌──────────────────┐
│ Z2   │ Z4  Good morning, Dr Iyer · Mon 21-Sep-2026 · Dept · Site      │  │ Z1  ☰ ICH  ⌕ ☾ 🔔 │
│ nav  ├──────────────────────────────┬─────────────────────────────────┤  ├──────────────────┤
│      │▛ TODAY [Now·OPD] ◷ Up next  ▜│ Patients Today                  │  │ TODAY            │
│      │▌ 07:30 ✓ AI morning brief ◆ ▐│ ┌ 👤 OPD 6 ───────────────────┐ │  │ Needs Action     │
│      │▌▍08:00 ● OPD  • NOW         ▐│ │ ▣ Meera Krishnan  ↺  ◷ Wait ›│ │  │ Patients Today   │
│      │▌ 09:05 ○ Teleconsult        ▐│ └─────────────────────────────┘ │  │ Calendar         │
│      │▌ …  (slate card, rail)      ▐│ ┌ 🛏 INPATIENTS 7 ────────────┐ │  ├──────────────────┤
│      │▙────────────────────────────▟│ │ ▣• R. Lakshmanan · 4B-12 ⚠ ›│ │  │ Home OPD IP …    │
│      ├──────────────────────────────┤ └─────────────────────────────┘ │  └──────────────────┘
│      │ Needs Action      1 critical ├─────────────────────────────────┤
│      │ ATTENTION · TASKS ·          │ Calendar  September 2026 ‹ ›    │
│      │ TO-DO NOTES  🎙 +             │ (fills to the bottom of the     │
│      │                              │  left column)                   │
└──────┴──────────────────────────────┴─────────────────────────────────┘
```

Zone mapping — the brief's "TOP HEADER (Z1)" is the atlas's **Z4** page header.
The global Z1 app bar stays, because it is chrome shared by all 58 screens and
carries the theme toggle. Z5 holds the three panels. My Day uses no Z6 rail and
no Z7a bar. The Z7b assistant bubble renders, because the registry row says
`GP-17`.

**A workspace, not a dashboard.** Three panels rather than seven cards, each
one solid surface with a hairline edge (`Panel`, `PanelBlock`, `PanelSection`
in `src/components/myday.tsx`). What used to be a card is a section inside a
panel, set off by a hairline and a quiet uppercase label with a plain count.
There are no "See all" links: OPD and Inpatients are one tap away in the nav,
and a link that repeats the nav is a second path to the same place. Type has
three levels — panel title (sentence case, semibold), the name on a row
(medium), its metadata (regular, muted) — and three weights.

- **Left column — the day, then what to do about it.**
  - **Today** is the one solid card the flat system keeps, at the doctor's
    request: the slate-blue `card-today` surface (`#3d5a80` in both themes,
    white inks, 18px corners — `glass.css`), a rail through round badges (a
    green check for a block already past, the block in progress on a filled
    blue badge, later ones quiet), the block in progress lifted on a lighter
    blue band with a *● NOW* pill, bold times, and the counts that matter in
    colour (*11 results changed*, *3 need attention* in amber, *1 critical* in
    white). The header carries a white *Now · OPD* pill and *◷ Up next*. `◆`
    marks a block whose count is AI-derived. Each block opens the screen that
    owns it.
  - **Needs Action** sits under it (below), on its top urgency's soft hue.
- **Right column — who is in the day.**
  - **Patients Today** replaces the separate OPD and Inpatients cards with two
    sections that read as different places before a word is read: each has its
    function's soft hue as its ground (OPD blue, Inpatients green — the same
    hues those functions carry on every screen), its icon beside a bold label
    and a plain count (OPD `UserRound`,
    Inpatients `BedDouble`), a hairline under the header, the same hue behind
    every row's icon, and a clear gap from the other section. Each scrolls on its
    own — about five rows, a soft fade when there is more. Stroke personas get
    one *Telestroke queue* section instead (NIHSS in the row's quiet detail).

    **The row is one grid, the same on every row:** place tile · name and bed ·
    kind · status · chevron, and it opens the patient's record. The tile is a
    full-strength icon on its section's hue — OPD `UserRound`, Ward `BedDouble`,
    ICU `HeartPulse`, ED `Ambulance` — read out and on hover, so the icon never
    carries it alone; a high-risk patient gets a red dot on the tile's corner.
    Kind and status are fixed columns on the right, so every status starts at
    the same x in both sections; below `sm` they drop to a line under the name.

    **Teleconsults are OPD too.** Today's teleconsult queue
    (`TELECONSULT_QUEUE`, `data/clinical.ts` — the same list the Telehealth
    screen ranks) is part of the OPD section: a patient on it leads with a
    `Video` tile instead of the person, and their status is the call's time
    (neutral `Clock` · "09:05"), or amber `Phone` · "Telephone only" when the
    patient has no video. A patient on both the clinic list and the queue
    appears once, as the teleconsult; one in a bed stays on Inpatients, so the
    two lists remain a partition.

    **Status is a picture first, a word second** (`RowMark`): a coloured icon,
    then a small word. Colour only for meaning — red critical, amber attention,
    blue normal — and neutral marks carry no fill.

    | | Mark |
    |---|---|
    | High risk | red `TriangleAlert` · "High risk", and the red dot on the tile |
    | Waiting · Admission in progress | amber `Clock` · amber `Hourglass`, with the word |
    | In room | blue `DoorOpen` · "In room" |
    | Not arrived · Admitted today · Discharge today | neutral `CircleDashed` · `LogIn` · `LogOut`, with the word |
    | Seen | neutral `Check`, **icon only**; the row goes quiet |
    | Follow-up | neutral `History`, **icon only** |
    | New patient | blue `UserPlus` · "New patient" |

    Follow-up and Seen are the two words that used to repeat down the list, so
    they are glyphs; the word stays in the tooltip and the row's accessible
    name. The new patient is the exception, so it keeps its word. At most two
    marks per row. The two lists are a partition: `opdRows` leaves out anyone
    in a bed.
- **Needs Action** (left column, under Today). The header's one emphasis is
  the critical count. Three sections:
  - **Attention** — status shape · reason / name · chevron · mic. The row opens
    the Quick-Panel. `Sorted by AI acuity ▾` under the list; the LOW-confidence
    ranking arrives collapsed.
  - **Tasks** — icon · label / detail · count · chevron, each a link to the
    screen where the work is done. The count is plain unless the item is urgent.
  - **To-do notes** — the doctor's own reminders, with the mic (dictate) and
    `+` (type) in the section header.
- **Calendar** (right column, under Patients Today; `MonthCalendarCard`,
  `src/components/monthcalendar.tsx`) on its own surface, a touch lighter than
  the cards around it, with the faintest lift. With `fill` it takes the rest of
  the column and its weeks share the height, so the two columns end level. The
  month is the header ("September 2026"), with two small arrows and a quiet
  *Today* once you have left the month; a new month slides in from the side you
  moved towards (180ms, off under reduced motion). Today is a soft filled circle
  with a faint halo. Under each date, how full it is as dots (`dayLoad`): one
  light, two moderate, three busy, the last one red where the day carries
  something critical — a legend line under the grid says so, never text inside
  the cells.

  **A date pops its day out beside it** (`DayPeek`) — on hover after a short
  pause, or pinned by a click, a tap or Enter. The card is deliberately not the
  Today card: a light, lifted card with a soft glow, pointing at its date and
  placed below it or, where there is no room, above. Its head is a diary-page
  wash with the date large, the month and weekday, a three-bar busy meter and
  icon chips for sessions and bookings; then the day drawn across its hours
  (sessions as bars in their function's hue, patients booked as pins, a red Now
  line today); the ◆ **AI brief** (AI-608, hidden with the AI switch off); the
  sessions as tiles in their function's hue; and the patients booked with
  their initials and time — each a link to where it lives. Pinned, the page
  behind dims a little while the calendar stays sharp, and the card takes
  focus; Esc, a click outside or a scroll closes it and returns focus to the
  date. The Today card is never changed by the calendar.

Breakpoints: one column below `lg`, in the order Today, Needs Action,
Patients Today, Calendar; from `lg` (1280) two columns at 5fr / 6fr — Today
over Needs Action on the left, Patients Today over the Calendar on the right.
The patient lists show about five rows below `lg` and seven from it.

**What is deliberately not on this screen** — the clinician's registration
number, the next token, predicted waits, AI provenance beside patient names,
vitals or results in the lists, and any results widget. All of it is one tap
away.

---

## 2b · The calm frame, product-wide

The five calm screens became the whole product. Three changes in the framework
carry it, so no screen restates them:

**`Screen` (`src/shell/Screen.tsx`).** One header for all 58 frames: the
heading, one quiet line of the counts that matter today, the screen's own
chips, then the actions. Gone from the surface: the breadcrumb, the atlas
one-liner, the date chip, the compliance chip row and the footer spec line.
That material is not deleted — it is behind the `ⓘ` in the header
(`ScreenInfo`), which prints the spec id, module, archetype, tier, density, the
one-liner and every compliance obligation with its consequence. `data-screen-id`
stays on the root, so the route walk is unaffected. Z5 is `min-h-full`, so a
screen whose root is `flex-1` fills the frame instead of floating in the top
third. The Z6 rail opens **collapsed** to a tab carrying `railTitle` and an
optional `railBadge` count, because on 43 screens it held reference prose.

**The calm kit (`src/components/calm.tsx`).** `SectionCard` (one solid panel
per section, optional `accent`, `lift`, `fill`), `SectionTitle`, `CountPill`,
`PillLink`, `PillTabs`, `ScopeTabs` + `useScope` (the slice in `?scope=`),
`Why` (an explanation folded behind one quiet line) and `Disclosure`
("Show earlier · 5"). `myday.tsx` re-exports the first four, so existing
imports hold.

**The archetypes.** `Worklist` now defaults to `variant="calm"`. `Checklist`
puts the items that need a decision first and folds the satisfied ones behind
"Satisfied · N". `Board` takes `hiddenColumns`, so Done / Tomorrow / Gone fold
behind a count pill. `StatTile` and `Table` were restyled to the same frame.

### Today first

Every list defaults to the slice the doctor acts on now and puts the rest behind
a counted tab. The slice is in the URL, so a link opens a screen already
narrowed.

| Screen | Default | Behind a tab or disclosure |
|---|---|---|
| `/discharge/board` | Today · 2 | Tomorrow · 1 · Not yet · 1 · the whole board |
| `/results/inbox` | To review · 3 | All |
| `/encounter/:id/orders` | Open | Resulted · Earlier |
| `/patient/:id/timeline` | Today | Earlier days · 5 |
| `/patient/:id/chart` | Today's results and orders | Earlier |
| `/referrals` | To triage · 3 | Triaged / booked |
| `/orders/stewardship` | Awaiting · 1 | Reviewed |
| `/orders/sets`, `/clinician/templates` | Due for review · 1 | All · 4 |
| `/schedule/templates`, `/schedule/blocks` | Today | This week |
| `/stroke/registry` | Calls due · 2 | Window open · 1 · Complete · 2 |
| `/stroke/case/:id/team` | Unanswered · 1 | Answered · 4 |
| `/stroke/case/:id/clock` | Running · 3 | Completed intervals · 4 |
| `/stroke/case/:id/tasks` | To do · In progress · Blocked | Done · 3 |
| `/stroke/telestroke/queue` | In window · 1 | Outside window · 1 |
| `/stroke/network/sites` | Flagged · 3 | Ready · 1 |
| `/stroke/case/:id/thrombolysis`, `/evt` | Needs action · 3 / · 1 | Satisfied · 4 / · 5 |
| `/stroke/case/:id/aspects` | The 2 affected regions | Normal regions · 8 |

---

## 3 · Component spec

### `StatusDot` — `src/components/myday.tsx`

Colour **plus shape plus a word**, because ~8% of male clinicians have a colour
vision deficiency (§5.3) and because none of the four hues can carry text.

| Urgency | Shape | Hue | `aria-label` |
|---|---|---|---|
| critical | filled octagon | `--color-pri-critical` | `Critical` |
| warning | half-filled triangle | `--color-pri-warning` | `Warning` |
| pending | ring with a hole | `--color-pri-pending` | `Pending` |

Every shape carries a hairline in its measured `-ink`. Without it `#F2C94C` at
11px is invisible on a white card and "pending" reads as an empty cell.

### `TimelineBlock` / `DayTimeline` — `src/components/myday.tsx`

The day as a railed timeline: time, a 36px badge on the rail (check for done,
brand for now, quiet for later), title and one-line summary. Each block is a
link to the screen owning that activity.

### `MonthCalendarCard` / `DayPeek` — `src/components/monthcalendar.tsx`

The month grid and a date popped out. A date is a `<button>` in a plain `div`
(never `ul/li`) with `data-calendar-day="YYYY-MM-DD"`, an `aria-label` that
names the date, what is on it and its load ("… — moderate day"),
`aria-current="date"` on today, and `aria-haspopup="dialog"` / `aria-expanded`
for its card; cells are 44px targets. The card is a non-modal `role="dialog"`
named for its date, portalled to the body so the calendar never changes size.

### `PatientList` — `src/components/myday.tsx`

One of My Day's patient lists. Rows (`PatientListRow`: patient, detail, kind
tag, status tag) are links to `/patient/:uhid/record`; a row the chosen
calendar block is about carries `data-related="true"` and a brand-soft tint.
Scrolls inside its card (22rem below `xl`, the card's height from `xl`) with a
fade at the bottom while there is more.

### `AttentionItem` row

`StatusDot` · reason (plain ink, medium) · `◆` when AI-derived · patient name
(right, truncated with a `title`) · a 44px mic. The row is the button; the mic
is a sibling button so it does not nest interactives.

### `CalmCard`

`glass-muted` by default, `glass-strong` + shadow when `emphasis`, and a 3px
left border in `accent`'s hue. That accent is how the attention card earns the
prominence the brief asks for without shouting.

### `Worklist` `variant="calm"` — `src/archetypes/index.tsx`

The change that makes the four list screens match My Day, made **once**.
Columns declare a `role`; the same column set renders as either shape.

| role | slot |
|---|---|
| `lead` | left gutter — a time, a token, a bed. Tabular, `whitespace-nowrap`. |
| `primary` | the one line identifying the row. |
| `context` | the quiet second line. Joined with a middot. |
| `status` | right-aligned, stacked. |
| `trailing` | **dropped** — a row that is already a button needs no chevron. |

Two details that were bugs before they were rules: a context cell rendering
`null` is dropped entirely, so no row ends in a dangling `·`; and the separator
trails its item rather than leading the next, so a wrapped line never starts
with punctuation.

Every `ARC-01` behaviour is shared between both variants because it lives above
the choice: `↑↓` move selection, `Enter` opens, `Space` previews, the row-count
line, the named sort, selection surviving a background refresh, and the
deterministic sort applied on mount or explicit change only — never reactively
mid-scan.

### `DictationPanel` / `useDictation` — `src/components/dictation.tsx`

`idle → recording → review`. No autosave at any point.

### `Sparkline` — `src/components/charts.tsx`

No axes, so the latest value is **directly labelled** beside the mark and the
whole series is in the accessible name.

---

## 4 · Tokens

```css
/* page */    --color-page-* #f3f5f8 (night #10151f) — one flat colour, no blooms
/* surface */ fill #fff · muted #f5f7fa · hover #f1f4f8 · border rgb(23 32 56/.1)
              (night #1a2130 · #161c29 · #232b3b) — opaque, no backdrop blur
              radius card 10 · panel 8 · field 8 · chip 6 · pill 999 (dots, counts)
              shadow 0 1px 2px rgb(15 23 42/.05) — the edge is the hairline
/* motion */  .lift — a firmer shadow on hover; nothing moves
/* tints */   card tints and every *-soft fill at half their earlier strength;
              --color-pri-pending is neutral slate #8a93a3 (night #9aa3b4)

--color-pri-critical: #dc2626;  --color-pri-critical-fill: #dc2626;  /* white on it 4.8 */
--color-pri-warning:  #f59e0b;  --color-pri-warning-fill:  #f59e0b;  /* "moderate" */
--color-pri-pending:  #facc15;  --color-pri-pending-fill:  #facc15;  /* the 🟡 the brief draws */
--color-pri-normal:   #3b82f6;  --color-pri-normal-fill:   #2563eb;  /* darkened one step to carry white */
--color-pri-safe:     #22c55e;  --color-pri-safe-fill:     #22c55e;  /* completed */
--color-ai-accent:    #6366f1;  --color-ai-glow: rgb(99 102 241 / .25);  /* voice-active only */
--color-critical-on:  #ffffff;  /* night: #0d1220 */
```

The hues are the second brief's, verbatim. They carry every **non-text** role:
the status shape, a row's left rule, a badge fill, the card's left border.

They cannot carry text. On white only critical clears AA (4.8); amber, blue and
green measure 2.1 / 3.7 / 2.3 to 1. So each has a paired `-ink` — a darker step
of the same hue — confirmed by `scripts/contrast.mjs` on rendered pixels, and
where a status word sits on bare glass it uses plain ink with the hue in the
shape alone.

| | light ink | night ink |
|---|---|---|
| critical | `#b91c1c` | `#f87171` |
| warning / moderate | `#b45309` | `#fbbf24` |
| pending | `#854d0e` | `#facc15` |
| normal | `#1d4ed8` | `#7ab3ff` |
| safe | `#15803d` | `#4ade80` |

The `◆` keeps the atlas's frozen AI-indigo `#4F46E5` (§5.5); the brief's
`#6366f1` accent is used only where the brief lists it — the recording surface.

`--color-critical-on` exists because the night `--color-critical` is a *light*
red: white on it measured **2.27:1**, which made a critical chip the least
readable element on the screen. Dark ink on it measures 8.2:1.

Spacing stays on Tailwind's 4px unit with even steps for the 8px rhythm (§5.1);
`--spacing` is deliberately not overridden, since it is the multiplier every
step uses and changing it would double every padding in the app.

---

## 5 · Interaction spec

### Keyboard

| Key | Where | Effect |
|---|---|---|
| `/` | anywhere but a text field | global search (`GP-03`) |
| `?` | anywhere but a text field | opens the Z7b assistant |
| `Esc` | any overlay | closes the topmost only; page state untouched |
| `↑` `↓` | a calm or table list | move selection |
| `Enter` | a list with a selection | open the row |
| `Space` | a list with a selection | preview, where the screen offers one |
| `Tab` | everywhere | follows visual order; every primary action is reachable |

### Touch and pointer

Every interactive target is ≥44px (§10.4). The mic on an attention row, the
count links and the `More` nav disclosure are all sized to it rather than to
their glyphs.

### Routes and filters

| From | To | Carries |
|---|---|---|
| A Patients Today row (OPD or Inpatients) | `/patient/:uhid/record` | — |
| An Attention row | the Quick-Panel for that item | — |
| A Tasks row | the screen where that work is done | — |
| A Today block | the screen owning that activity | — |
| A calendar date | opens that day's panel; its rows go to the schedule screens or the patient's appointments | — |
| Unauthenticated request | `/login?next=<path>` | honoured on success |

### Mock API contract

There is no backend. `src/data/myday.ts` carries the payload shape as specified,
in `snake_case` because it is the wire format:

```ts
{
  patient_id, name, mrn, room, scheduled_time,
  status_category: 'critical'|'moderate'|'normal'|'routine',
  status_color_hex, lastSeenByClinician,
  delta_summary: Delta[],        // server pre-orders by priority
  active_timers: { name, expires }[],
  thumbnail_url?,
  quick_actions: { markSeen, openChart, callNurse }
}
```

`status_color_hex` is present for contract fidelity, but the UI resolves its
token from `status_category` and never reads the hex — otherwise the theme
toggle could not repaint it. `thumbnail_url` is undefined for every patient: the
§8 cast has no photographs and `SD-P-08` is an unidentified MLC patient.

Delta priority, as the server would apply it:
`timer → lab-critical → imaging → vitals → med → note`.

Endpoints the UI names but does not call: `POST /api/patients/{id}/seen`,
`GET /chart/{uhid}`, `tel:` for the ward extension.

### Audit events

`src/store/audit.ts`, persisted, and **surfaced** — the Quick-Panel carries an
Audit disclosure. Each row holds who, when, the model and the gate.

`PATIENT.MARKED_SEEN` · `AI.SCRIBE.TRANSCRIPT_CREATED` · `NOTE.DRAFT_SAVED` ·
`NOTE.SIGNED` · `NOTE.COSIGN_QUEUED` · `ACCESS.BREAK_GLASS` ·
`AI.SAF.HARD_STOP_OVERRIDDEN`

---

## 6 · Dictation

`🎙 Add note` appears in two places — the My Day header for a free note, and a
mic on each attention row, which pre-fills the subject. Same component.

**Live where the browser has it.** `useDictation` prefers
`SpeechRecognition ?? webkitSpeechRecognition`, with `lang` from the session
language (`EN→en-IN`, `HI→hi-IN`, `KN→kn-IN`) and interim words shown as they
arrive. The waveform is a real `AnalyserNode` on the microphone.

**Honest where it does not.** On an unsupported browser or a declined
microphone it falls back to a captured per-patient sample streaming word by
word, and **says so in one line**. A fallback that pretends to be live is worse
than no fallback.

**No autosave.** `ARC-15` autosaves every 20 seconds everywhere else in this
application. This control does not, because the brief says so and because a
half-heard sentence committed to a clinical record without the author looking at
it is a different class of problem from a half-typed one. `Save` is the only way
out with content.

Both paths report their model and a banded confidence into the explainability
drawer's *Limits & provenance* panel, with the limit stated plainly: a
transcription confidence says nothing about whether the content is correct.

Signing follows the persona — a resident sees *Save for co-sign* and the entry
lands in `/clinician/cosign`.

### `VoiceField` — `src/components/voicefield.tsx`

The same engine, inline in every note field. `useDictation` took a third
argument, `{ sample?, wordMs? }`, so a field's captured-sample fallback can be
that section's own seed text, and a module-level `useVoiceArbiter` lets only one
field hold the microphone at a time. Phases: idle (one mic button, *or type*),
recording (`.voice-active`, waveform, live words capped at six lines), review
(the words land in the field via `onChange`, focus moves to the textarea, one
provenance line beneath — ◆ dictated · live or sample · confidence · Why? ·
Dictate more). Unlike `DictationPanel`, the words land on Stop: this field fills
a form that is itself a draft until signed, so nothing reaches the legal record
early. The `notesInput` session preference (`voice` default) decides whether the
mic or the textarea is primary. With AI off the mic is absent, not greyed.

---

## 7 · `S-02-01` Sign In

Single column, centred. **Email · Password · Forgot password?** No self sign-up;
one quiet line states that accounts are provisioned by the front office or an
administrator.

Three atlas rules are implemented rather than drawn, because each is a security
property:

- **One uniform failure.** *"Sign-in failed. Check your details."* for an
  unknown address and a wrong password alike. Distinguishing them is a
  user-existence oracle.
- **`LOCKED`** after five failures, with a route to a human — a lockout with no
  way out is a denial of service against your own staff at 03:00.
- **`OFFLINE`** states plainly that sign-in needs connectivity, because
  authority is evaluated on the server.

No Z1, no Z2, no Z7b bubble: §6.1 requires every assistant answer to be filtered
to what the caller may already read, and before sign-in there is no caller.

`signedIn` says only that someone authenticated. It grants nothing — §3.2 rule 3
means every screen still evaluates its own capability, per request.

---

## 8 · QA checklist

Run `npm run verify` with the dev server up. It chains all three suites.

```bash
npm run dev                # in another terminal
npm run verify             # routes + acceptance + contrast
```

| | Check | Result |
|---|---|---|
| ☑ | `tsc -b` clean under strict, `noUnusedLocals`, `verbatimModuleSyntax` | pass |
| ☑ | `oxlint` | 0 errors, 23 style warnings (fast-refresh export shape) |
| ☑ | `npm run build` | 975 KB / 279 KB gzipped |
| ☑ | Registry reconciles | 58 rows · 53 routed · 58 components · 0 gaps · 0 orphans |
| ☑ | Route walk | 53 of 54; `S-18-01` is the documented `ARC-12` exception |
| ☐ | Contrast ≥4.5:1, measured on **rendered pixels**, both themes | 93 of 108 screen-theme combinations clean; 74 runs in 15 night-theme combinations still fail, all chips on soft fills — §8c |
| ☑ | No dense table or overflow on the five redesigned screens | pass |
| ☑ | Touch targets ≥44px | pass |
| ☑ | India formatting — no `$`, no `MM/DD`, no 12-hour clinical time | pass |

### The acceptance tests

`node scripts/acceptance.mjs` drives real Chrome over the DevTools Protocol —
Node's global `WebSocket`, no test framework to install. Every assertion runs
against the DOM the browser rendered.

| # | Test | Result |
|---|---|---|
| 1 | **Render** — day plan, month calendar, patient lists and attention list all present | pass · 7 blocks, 35 calendar days, OPD 6, Inpatients 7, "Good morning, Dr. Iyer" |
| 1b | **No horizontal scroll** at 320 / 375 / 768 / 1024 / 1440 | pass · clean at all five |
| 2 | **Priority ordering** — critical → warning → pending, capped at 5 | pass · `Critical → Warning → Pending → Pending → Pending` |
| 2b | **Timeline** in clock order with the current block marked | pass · 07:30 08:00 09:05 10:30 12:00 14:00 16:30 |
| 2c | **A calendar date opens** with an AI brief, the day's schedule and its appointments; Esc closes it | pass · Mon 21-Sep-2026, 6 patient links |
| 3 | **Mark seen** — row clears, audit row written, survives a reload | pass · 5 → 4 rows, 1 audit event |
| 4 | **Voice transcribe** — fallback declared, editable, saved only on confirm | pass · 139 chars, nothing stored before Save, gate G2 |
| 5 | **AI explainability** — band, `Why?` opens 4 panels, no layout shift | pass · 4 panels, width 1440 → 1440 |
| 5b | **AI-OFF** — `◆` hidden, bubble unmounted, day plan, calendar and lists unaffected | pass · bubble gone, 7 blocks and 35 calendar days still shown |
| 6 | **Login** — `?next`, one uniform failure, lock at five, next honoured | pass · landed `/ip/patients` |
| 7 | **Critical event alert** — toast, `Notification`, deep link | pass · "Critical lab — Joseph Mathew" |
| 8 | **Offline mark-seen** — queued with a visible count, then flushed | pass · queued 1 → flushed 0 |
| 9 | **Notes open empty** — 4 mics, nothing pre-filled, Voice selected; dictation lands in the field with provenance `dictated` and no decision bar; *Draft with AI* adds decision bars only to the sections still empty and disables Sign | pass · 255 chars dictated · 0 → 3 decision bars |
| 10 | **One truth for a note section** — Accept fills the field; clearing it does not bring the draft back; Defer blocks Sign; a code picked from the ICD-10 search enables Sign once all four sections have text; Save draft toasts; decisions survive a reload | pass · accepted 332 chars → cleared stays empty (ghost false) · deferred blocks Sign true · coded J18.9 · saved manual · Sign enabled true → after reload true, 3 decided, 0 undecided |
| — | **Every button acts** — no visible, enabled button without a handler on any routed screen | pass · none across 52 screens |
| — | **My Day lists partition the caseload** — no patient on both lists; each count pill is its rows | pass · OPD 6 · Inpatients 7 · on both 0 |
| — | **Inpatients is one word**, and My Day lists the same patients as the Inpatients screen | pass · 7 = 7 |
| — | **Stroke-AI Console** — real NCCT pixels, slices scrub, unmarked image reachable | pass |
| — | **Calm check** — 52 screens: no table, breadcrumb, spec line, overflow or open rail; no paragraph over six lines | pass |

Two notes on method. Test 7 has no backend and no service worker, so the push is
a client-side simulation behind a dev-only control, and the `Notification`
constructor is stubbed in the harness because headless Chrome cannot grant the
permission — the toast and the deep link are real. Test 4 removes
`SpeechRecognition` to force the fallback deterministically, since the headless
browser has no microphone either way.

### Contrast method

`node scripts/contrast.mjs` screenshots each screen, hands the PNG back into the
page, draws it to a canvas, and takes each text element's background as the
**modal pixel inside its box** — text covers a minority of the box, so the mode
is the background and glyph antialiasing cannot skew it. That captures the page
gradient, the two blurred blooms and every stacked `backdrop-filter`.

An earlier version composited ancestor `background-color`s over `body`'s own
colour. It reported about 40 false failures, because a Z4 header has no
background of its own and the model therefore placed its text on
`--color-page-to` — the *darkest* stop of a gradient whose light stops are what
actually renders there. Worth knowing before trusting a computed-style contrast
check on a glass theme.

Text in a disabled control is excluded, per WCAG 1.4.3.

### Performance

The brief asks for My Day's core fields inside 300ms and login inside 200ms.
There is no network and no backend, so what is measurable is render time: the
card payload is deliberately minimal and every trend, sparkline and delta detail
loads with the Quick-Panel rather than with the list. Measured cold in headless
Chrome on this machine, first contentful paint of the attention list is well
inside both budgets; the figure is not quoted here because a number from a
frontend-only mockup with in-memory data would not predict the same screen
against a real API.

---

## 8b · Stroke-AI Console, vocabulary and the RAG

### `S-18-21` Stroke-AI Console — `/stroke/ai-console`

Takes the `Stroke Centre` nav slot. Real head-CT pixels beside the model's
reading, with the clinical report folded underneath. Modelled on the Stroke-AI
clinical report and the platform datasheet, both from the same product family.

`scripts/ncct-import.mjs` reads a CQ500 study with pydicom, applies
`RescaleSlope/Intercept` to get Hounsfield units, windows to **W 80 / L 40**,
subsamples the middle 70% of the stack to 28 slices and writes PNGs to
`public/ncct/<caseId>/`, plus `src/data/ncct.generated.ts`. The browser gets no
DICOM parser; the window is stated on the frame rather than implied.

**Findings are derived, never authored.** `src/data/strokeai.ts` computes every
NCCT line from the study's own `ground_truth_labels.csv` row, so the report
cannot contradict the pixels. A study with `ich: true` reports POSITIVE and the
thrombolysis eligibility card flips to contraindicated with no copy edited. What
the labels do not carry — ASPECTS, clot length, perfusion volumes — comes from
the §8 stroke kit.

`P-04` was granted `stroke.case.read` **read only**. A hub consultant receives
stroke transfers and is asked to look at the console; activation, thrombolysis
dosing and EVT selection all stay with the stroke personas.

### One vocabulary

`VOCABULARY.md` is the reference and `scripts/vocabulary.mjs` enforces it. The
structural fix is the partition:

| | before | after |
|---|---|---|
| My Day tiles | OPD 7 · Ward 4 · ICU 1 · Follow-up 3 | OPD 7 · Ward 4 · ICU 1 · **ED 1** |
| stated total | **15** — three patients counted twice | **13** — every patient once |
| ED patient | on the inpatient list, in no tile | its own tile |
| `S-08-03` heading | My inpatients | Inpatients |
| unfiltered tab | Everyone / All, by screen | **All**, everywhere |
| nav | Clinic & Queue · Stroke Centre | **OPD** · **Stroke-AI Console** |

### The assistant answers

`resolveAnswer(question, context)` ignored its context parameter: matching was
global, and `CLINICAL_ROUTES` ran before the corpus, so every clinically-phrased
question was deflected to a capability id. A `SCREEN_ANSWERS` table now runs
first, **for the screen that owns the interpretation only** — so "what are your
views on this result?" is answered on the result, and still routed everywhere
else.

A reading is a claim, so `AssistantAnswer.attest` ends it in a signature rather
than a full stop: capability, gate, the one sentence being signed for, and
`Sign for this reading` / `I disagree`, writing the same disposition and audit
event the owning screen writes. `AttestStrip` is shared by the Z7b panel and the
full-page assistant, which had duplicated their renderers.

`scripts/rag-audit.mjs` resolves **every** suggested prompt under its own
screen's context and fails on any that answers nothing. It found 101 of 184 —
the product was offering clinicians questions and then replying "I have nothing
on that".

---

## 8c · Contrast, widened

The audit covered six screens. It now covers **all 53 routed screens in both
themes**, and the wider net found two systemic defects and a methodological bug
in the audit itself.

**The audit was wrong about small controls.** Its background was the modal pixel
inside the text's box, which is right for glass over a gradient — but on a small
solid button the glyphs occupy more of the box than the fill, so the mode *was*
the text and the ratio came back 1.0. About 90 phantom failures on labels like
`Accept` and `Save draft`. The sampler now excludes pixels close to the
foreground colour before taking the mode, and prefers a declared opaque
background where one exists.

**On-image chrome cannot use themed inks.** A CT is read on black in both
themes, so light-theme AI-indigo over the image measured **2.87:1**. Imaging
overlays now use fixed bright tokens (`--color-on-image-*`), and the region
label carries its own dark plate rather than an outline — an outline does not
help, because what a reader needs is a background.

**Sticky chrome had contrast that depended on scroll position.** The Z7a action
bar, the app bar and the phone tab bar are `backdrop-filter` glass over moving
content; with `saturate(150%)` over an indigo page the same label measured
**1.9:1** or **4.9:1** depending only on what was underneath. Chrome carrying a
primary action now uses `--color-chrome`, near-opaque, so its contrast is a
property of the bar.

**Outstanding: 72 text runs across 19 of 108 screen-theme combinations**, 39 of
them in night and concentrated in chips on soft fills. Each needs individual
triage against the rendered pixel; they are reported, not yet resolved.

---

## 9 · Known deviations, stated

1. **`ARC-20` is a tile archetype and this is not tiled.** The registry row is
   unchanged and every drawing note the archetype carries is satisfied; the
   shape is not. Reasoned in the file header of `S0601.tsx`.
2. **§8.6 says "18 in clinic, 4 seen".** The §8 cast is ten patients, three of
   whom are an inpatient, a stroke transfer and an ED MLC, so eighteen distinct
   outpatient slots cannot be filled without inventing patients — which §8
   forbids. The counts are the cohort sizes of the modelled rows (OPD 7) and the
   figure 18 does not appear on screen.
3. **"Good morning, Dr. Kumar"** in the brief is illustrative. The greeting
   derives the salutation from the clock and the name from the session, so it
   reads *"Good morning, Dr Iyer"* — `SD-S-01`, who every other screen names —
   and follows a persona switch.
4. **`S-02-01`'s spec line says it carries the `GP-17` bubble.** It does not
   here, reasoned in §7 above.
5. **The logo button is hidden below 768px.** Eight 44px controls plus the
   facility pill do not fit in 320px. Shrinking a target would break the ≥44px
   floor and burying the facility switcher would break `GP-07`; Home is the
   first item in the phone tab bar at exactly those widths.
6. **Ward telephone extensions are placeholders.** §8 carries no telephone
   numbers. They exist so the `tel:` affordance is real and testable on a phone,
   and they are labelled as not part of the sample data kit.
7. **`?e2e=1`** is a harness hook in `src/e2e.ts` for the route walk, which
   drives `--dump-dom` and so cannot type into the sign-in form. It is wrapped in
   `import.meta.env.DEV`, so the bundler removes it from production builds, and
   it grants nothing beyond "someone authenticated".
8. **"Dr. Kumar · Neurology · Coimbatore" and the counts `12 / 8 / 3 / 4`** in the
   second brief are illustrative. The greeting, department and counts derive
   from the session and the §8 kit (deviations 2 and 3). Switching persona to
   P-35 yields the stroke day, including "Stroke review · 2 active cases".
9. **The `◆` is not recoloured to the brief's `#6366f1`.** §5.5 freezes the AI
   mark's colour; the accent is used for the recording surface, which is what
   the brief lists it for.
10. **The hover lift is not applied to list rows** — only to cards and tiles. A
    row that moves under a reader mid-scan is the opposite of calm.
11. **Reference material is hidden, not deleted.** Every atlas rationale, spec
    callout and compliance obligation the screens used to print is still in the
    build, behind `Why ›` or the header's `ⓘ`. The alternative — deleting it —
    would have made the mockup stop demonstrating the atlas it is built from.
12. **The Z6 rail opens collapsed on every screen.** On 43 of them it held
    "why this exists" prose; on the rest it holds AI suggestions, which are
    offers rather than obligations. The tab carries a count where the rail has
    actionable items.
13. **Three tables survive**, because they are genuinely tabular: the
    three-source timestamp conflict on `S-18-08`, the admission-versus-discharge
    medicine reconciliation on `S-13-03`, and the value series on `S-09-05`
    (which is itself collapsed behind `Values · 5`). Every other table in the
    product is now a calm list.
14. **`Sorted by AI acuity` stays under the attention list.** The brief says
    "no extra data"; AI-613's guardrail says the deterministic sort must be
    visibly one click away. One quiet line satisfies both.

---

## 10 · Fixed during this work

Defects found by the verification above, not by inspection:

- **34px horizontal overflow at 320px** — a grid item and a flex item both
  default to `min-width: auto`, so the counts grid widened its own track instead
  of shrinking.
- **The pending status dot was invisible** — `#F2C94C` hollow at 11px on a white
  card. Every shape now carries an ink hairline.
- **White on the night critical fill measured 2.27:1** — pre-existing, and it
  made a *critical* chip the least readable thing on the screen. Now
  `--color-critical-on`, 8.2:1.
- **Five night-theme soft-fill chips below AA** — abnormal 3.62, critical 3.90,
  isolation 3.57, inactive 3.84, brand 4.11. All lifted by the measured minimum.
- **Four priority inks tuned against the wrong surface** — I measured them on
  the glass, but they appear on their own soft fills.
- **`text-ink-3` at 4.38:1 on the bare page gradient**, where the calm screens
  put their quietest lines.
- **The pinned-row emphasis tint dimmed its own contents** below AA. Emphasis
  should mark a row, not make it harder to read.
- **`ClinicalFlag` rendered "↑ ↑ High"** — the flag string carries its own arrow
  and the chip drew another.
- **The Quick-Panel used the event time as the last-seen cut-off**, so a
  critical result reported two minutes ago made itself invisible — which defeats
  the only thing the panel exists to do.
- **The route walk asserted against visible footer copy** that the calm screens
  no longer print. It now reads `data-screen-id`.
- **Dangling `·` separators** and **`MED-042` breaking at its hyphen**.

Second pass, after the user's review ("plain", cluttered):

- **Front-page clutter removed** — `◆` beside patient names, `◆ ~4m` predicted
  waits, `4 seen · next MED-042`, `booked 08:40`, the HPR footer, `Note
  outstanding` on all six ward rows, AI reason text and author grade in list
  rows. Each lives on its inner page.
- **The timeline floated on the gradient** — now one frosted card with a rail,
  a badge per block and the brief's `.schedule-item` rule.
- **The calm lists had no surface** — `Worklist variant="calm"` now renders
  inside the same card frame, lead cells as lozenges, the count footer with a
  real noun and the keyboard hint announced rather than printed.
- **`.voice-active` never rendered** — declared in the components layer, it lost
  to the element's own `border-transparent` utility. Found by a DOM probe, not by
  eye; now a `@utility`.
- **Night: the in-progress block's summary measured 4.18:1** on its blue tint —
  the current block takes the stronger ink.

Third pass — the whole product, today-first:

- **`/discharge/board` opened on four patients** when My Day had just said two
  discharges today. It now opens on today's two, with `Tomorrow · 1` and
  `Not yet · 1` behind counted tabs. The user found this one.
- **Rows rendered twice** on five screens — a multi-column `Worklist` above the
  same rows as full cards (`S-05-06`, `S-09-08`), rings above a table of the
  same intervals (`S-18-06`), stat tiles above cards of the same sites
  (`S-18-03`), a chart above a table of its own points (`S-09-05`). One surface
  each now.
- **The Z5 content floated in the top third** of a 1440×900 frame: 170px of
  bare gradient under the last card, more at 1080. Z5 is now `min-h-full`, the
  spacer sibling is gone, and My Day's cards stretch to the frame.
- **`LOS d`** rendered on discharge rows for patients whose record carries no
  length of stay.
- **The rail collapsed to a 48px tab only from `lg`** — below that it vanished
  entirely rather than folding, so a phone lost its contents. It now opens as a
  full-width disclosure bar.

---

## 11 · September pass — night default, Coimbatore, voice-first notes, a fuller My Day, one vocabulary

**Night is the default theme.** `session.theme` defaults to `night`,
`index.html` paints `data-theme="night"` before hydration, and a persisted
session from before this pass is migrated once (`persist.version = 1`). Light
remains one click away in the app bar. The §5.3 night-mandatory prompt now
fires only for a clinician who has switched to light.

**The hub is Indostates Health Hospital, Coimbatore (`ICH`).** One entry in the
§8 kit changed and everything else derives from it — UHIDs (`ICH-0044051`),
staff identifiers, the app-bar chip (`facility.short` = *Coimbatore*), the
greeting subheading, the stroke transfer route. The network moved with it:
Indostates Tiruppur (`ITP`, secondary), Pollachi (`IPL`, spoke with CT),
Udumalpet (`IUD`, spoke without CT). The 712 km air transfer became a 42 km
blue-light road transfer, which is what the geography now supports.

**Notes open empty and are spoken into first.** See §6 `VoiceField`. Every
pre-filled draft was removed: the four SOAP sections on S-06-03 and S-08-04, the
six discharge sections on S-13-02 (their drafts moved to
`DISCHARGE_DRAFT_SD_P_03` in the kit), the history field on S-08-07 (now
*Carry forward from the admission note*, marked as carried), the clinician
wording and the patient rewrite on S-06-08 (*Draft the patient version*, on
request). The scribe overlay S-06-04 is keyed by patient and shared by the
consultation and the round; it returns the keys it drafted and only those carry
C-41. `NoteRecord` gained `provenance` per section (`typed | dictated | scribe |
carried`), which is what gates Sign. S-08-04's dead *Dictate the round* button
is gone; the one emphasised header action on a note is *Draft with AI*, with Prescribe and Order demoted to tertiary.

**My Day answers a third question** (§1, §2): *Pending today* and *Discharges
today*, plus a sub-line on each count tile.

**The contrast audit lost a fourth phantom.** Its "prefer a declared opaque
background" shortcut walked past an element whose fill is a gradient image (the
AI-indigo button) to `body`'s pale colour and reported white-on-pale at 1.12:1.
The walk now stops at any `background-image` and reads the pixels. Re-run over
all 108 combinations after this pass: 93 clean. Of the 74 failing runs, the
night-theme ones are 12px chips on soft fills (`FieldChip` percentages,
`GateBadge`, risk-band chips), the same outstanding class as §8c; the handful in
light are 8–9px SVG labels on the CT overlay (`LEFT M1`, `Caud`) whose dark
plate is an SVG `rect` the ancestor walk cannot see, so the sampler reads
`body` behind them — a fifth phantom, left for the next audit pass. The audit also seeds the
persisted session at `version: 1` so the store's migration cannot flip a
light-theme pass back to night, and retries a `localStorage` read that a page
still loading denies.

**One vocabulary, enforced** (`VOCABULARY.md`): every registry screen name is
sentence case and equals its heading (`scripts/vocabulary.mjs` fails otherwise);
*See all* / *All …* for full lists; *Done* not *Complete*; *Open* not *Active*
for problems; *teleconsult* not *teleconsultation*; *Facility* for the field,
*Site* only for a stroke network node; *Visit record* where an encounter number
must be shown; *and* not `&` in labels; *This week* not *Week*. Fourteen new
checker rules.

---

## 12 · Second September pass — every action valid, one truth for a note section, a fuller frame

**My Day fills the frame.** The reading measure is set in rem and compact
density shrinks it to ~930px at 1440, so the home screen takes the px-based
`wide` measure and lays out three columns from `xl`: the day · attention over
*Pending today* · patient counts over *Discharges today*. Each column's last
card takes the slack, so the three bottoms align.

**One truth for a note section.** `notes[enc].text[key]` is what signs. The AI
ghost shows only while a scribe section is empty and undecided; Accept and Edit
write the draft to the store, Reject and Undo empty it, Deferred counts as
undecided and blocks Sign. `VoiceField` is the editing surface in every state,
so the mic never disappears after Accept. Dispositions persist
(`indostates.ai`), so a reload keeps decisions and a signed note never shows a
live bar; Undo is hidden and the C-41 buttons disabled once signed. The ICD-10
field has three paths — the AI-501 chip, the patient's problems as buttons, and
a search over the build's index — and the chosen code lives in the record.
`canSign` is exactly "no problems", so the old "0 items outstanding" state is
unreachable. Save draft toasts and stamps "Saved HH:MM"; autosave is silent.

**Every control acts.** 30 inert buttons now do something honest: store-backed
saves with toasts, a shared `PrintPreview` modal behind every Print, New session
and New set forms, Mute/Camera toggles, End the session confirmations that
return to the queue, call confirmations that log against the case, DENIED's
Request access and Go back, the drawer's Report a problem, and every citation
row opening its screen via `routeForSource` or saying the source is not in the
build. Retry and Refresh clear the forced state.

**AI, present.** *Tidy up with AI* (AI-104) under any field with text: sentence
case, spacing, a full stop, and every banned abbreviation written out, with the
change list and an Undo. *Draft with AI* is the one scribe label everywhere.

**Imaging on real pixels.** `S-15-04` now opens the imported CQ500 head CT in
the same `NcctViewer` the console uses, with the AI read derived from the
study's own labels, the full Stroke-AI report folded beneath, *Original beside
overlay*, a dictated reading note that saves against the study, and a card of
questions about this scan that open the assistant with a cited answer.

**Words.** Sign · Attest and sign · Draft with AI · Dictate / Dictate more ·
Tidy up with AI · Diagnosis and ICD-10 · OP number / IP number · Saved / Autosave
on · Pending today · Cleared for discharge · Sign assessment. Nine more checker
rules.

## 13 · Workspace pass — three panels, and a flat surface product-wide

**My Day is a workspace, not a dashboard** (§2). Seven cards became three
panels: *Schedule* over *Patients Today* on the left (60%), *Needs Action* on
the right (40%), the *Calendar* full width beneath. OPD and Inpatients are two
sections of one panel, each scrolling on its own; *Needs my attention*, *Pending
today* and the *To-Do Note* card are the *Attention*, *Tasks* and *To-do notes*
sections of one. Patient rows lead with a muted place icon and carry at most
two tags; the Ward / ICU / ED tag went, because the icon and the bed say it.
The Schedule lost its rail, its icon badges and its done-checks, and colours
only critical counts. The three *See all* links went: each repeated the nav.

**The surface is flat, everywhere** (§4). The page is one colour; panels are
opaque with a hairline and a barely-there shadow; nothing blurs, glows, lifts
or fades in behind a modal; corners are 6–10px; buttons and tabs are no longer
pills; the AI button is a solid indigo, not a gradient; the attention card lost
its coloured top rule. Card tints and soft fills are half their old strength,
and "pending" is neutral, so only red, amber and blue carry meaning. The inks
did not change. Contrast, both themes, all screens: 118 of 122 runs clean,
against 105 before — no screen that passed started failing; the four left are
text drawn on the CT image (S-18-14, S-18-15) and the perfusion chips (S-18-16).

**Words.** Schedule · Patients Today · Needs Action · Attention · Tasks ·
To-do notes (VOCABULARY.md).

**Patients Today, visual first.** The two sections now differ by ground (faint
blue for OPD, slate for Inpatients), by a header icon beside a bold label, by
the hue of every row's icon tile, and by a gap. Rows are one grid — tile · name
· kind · status · › — so kind and status run in columns; the tile's icon is at
full strength, with a red dot for a high-risk patient. Status is a coloured
icon with a small word; Follow-up and Seen, which repeated on most rows, are
the icon alone with the word kept for the tooltip and the screen reader.

**Today, as it was; two columns.** The day is its own card again, in the
highlighted design the doctor asked to keep — solid slate, rail, badges, the
Now band — scoped to that one card (`card-today`) while the rest of the portal
stays flat. Needs Action moved under it; Patients Today sits to its right, with
a half-width calendar under the lists filling the column to the same height.

**Soft hues, by function, everywhere.** Every card now carries the soft hue of
what it is for — patient blue, inpatients green, schedule slate, documentation
purple, own notes gold, discharge teal, AI indigo, investigations olive,
medication rose, stroke coral, attention by urgency — in both themes. A screen
sets its function once (`shell/screenTones.ts`) and its cards inherit it; a
card doing a different job names its own. On My Day: Needs Action takes its top
urgency, OPD blue, Inpatients green, the calendar slate, and Today stays the
solid slate card. Contrast, all screens and both themes: no screen that passed
started failing. Teleconsult patients now sit in OPD with a video tile.

**The calendar, refined in place.** Same box — 611 × 470 at 1440 — with a
lighter surface, the month as its header, a haloed today, busy-day dots and a
short slide between months. A date now pops a pictorial card out beside it
instead of opening a side panel, and the Today card stays the live day.
