# Clinical vocabulary — one word per thing, everywhere

Every screen, nav item, tab, chip and empty-state uses the word in the left
column. The right column lists what was used before and must not reappear.
These are the words hospital staff actually use in an Indian tertiary centre,
not synonyms invented per screen.

## Where a patient is

| Canonical | Means | Never write |
|---|---|---|
| **OPD** | The outpatient department, and a patient booked into today's clinic session. | "Clinic & Queue", "OP queue", "Outpatients" as a heading |
| **Inpatient** | A patient admitted and occupying a bed. Collective noun for Ward + ICU + ED holding. | "admitted patients", "IP patients", "My inpatients" |
| **Ward** | A general inpatient bed area. A subset of inpatients, never a synonym for one. | "floor", "general ward" |
| **ICU** | Intensive care. A subset of inpatients. | "critical care unit", "ITU" |
| **ED** | The emergency department, including a patient still held there. | "Casualty", "A&E", "ER" |

**The rule that was broken:** `Inpatients` is the whole; `Ward`, `ICU` and `ED`
are its parts. A tile labelled `Ward` must never open a screen titled
`My inpatients`. The module is `Inpatients`; the tile is the location it filters
to; the screen states both.

## Counts

`OPD · Inpatients` is a **partition** — every patient appears in exactly one,
as a count or as a name. My Day lists them by name, so a patient in a bed is
never also on the OPD list.
Ward, ICU and ED are parts of Inpatients, so they are the filter on the
Inpatients screen and never tiles beside the whole. `Follow-up` is a *visit
type* inside OPD, so it is a filter on the OPD screen and never a count beside
it; counting it alongside OPD counted three patients twice and made the total
read 15 when this consultant has 13.

## Visit and encounter

| Canonical | Means | Never write |
|---|---|---|
| **Follow-up** | A return visit for a known problem. | "revisit", "review visit" |
| **New patient** | A first visit for this problem. | "fresh case", "new case" |
| **Teleconsult** | A single video or telephone consultation. | "tele visit", "virtual consult" |
| **Telehealth** | The module holding teleconsults and telestroke. | "telemedicine" as a nav label |
| **Encounter** | The record a visit or admission is written against. Internal — rarely shown. | "episode" |

## List slices

| Canonical | Means | Never write |
|---|---|---|
| **All** | The unfiltered slice of any list. | "Everyone", "Show all", "Complete list" |
| **To review** | Not yet acted on by this clinician. | "Unreviewed", "Pending review" |
| **Open** | Still in progress. | "Active" (reserved for stroke cases) |
| **Done** / **Seen** / **Signed** | Completed, per the verb of that screen. | "Closed", "Complete" |

## Departments and modules

| Canonical | Never write |
|---|---|
| **OPD** | Clinic & Queue |
| **Inpatients** | Wards, IP |
| **Results** | Reports, Investigations |
| **Orders** | Requests |
| **Discharge** | Disposition |
| **Imaging** | Radiology (the department is Radiology; what a clinician opens is Imaging) |
| **Stroke-AI Console** | Stroke Centre |
| **Telehealth** | Telemedicine |

## Acts

| Canonical | Never write |
|---|---|
| **Co-sign** | Countersign, endorse |
| **Acknowledge** | Ack, confirm receipt |
| **Sign** | Finalise, commit |
| **Sign** | "Sign and publish", "Sign & publish" — publishing to ABDM is a consequence the confirm dialog states |
| **Attest and sign** | "Attest and publish" |
| **Draft with AI** | "Draft from the visit / round / record", "Dictate the round" — one label for the scribe, everywhere |
| **Dictate** · **Dictate more** | "Record", "Record again", "Dictate the subjective" (the field label already names the section) |
| **Tidy up with AI** | "Clean up", "Auto-correct" — AI-104, offered under a field, never applied on its own |
| **Save draft** · **Saved 15:15** · **Autosave on** | "Autosaves every 20 seconds" |
| **Addendum** | Amendment (an amendment changes; an addendum appends — CMP-NABH-10) |
| **Break-glass** | Emergency access, override access |
| **Admit** | "Request admission", "Send for admission", "IPD admit" — one button, one small modal (Ward or ICU, a priority, an optional note) |

## My Day

| Canonical | Never write |
|---|---|
| **Today** (the day's timeline card) · **Patients Today** (the patient panel, sections **OPD** · **Inpatients**) · **Calendar** (the month) | "My patients", "Outpatients", "Agenda", "Planner" |
| **Needs Action** (the action panel, sections **Attention** · **Tasks** · **To-do notes**) | "Alerts", "Urgent" or "Critical" as a heading — not every attention item is critical |
| **AI brief** (a calendar date's summary) · **Your sessions** · **Appointments with you** | "Day summary", "AI summary", "Events" |
| **New patient** · **Follow-up** (an OPD row's kind) · **Ward** · **ICU** · **ED** (an inpatient row's place, shown as its icon and bed — not as a tag). *Follow-up* and *Seen* show as their icon alone on My Day, and the word is kept in the tooltip and the accessible name. A **Teleconsult** row in OPD leads with the video icon | "New" alone, "Revisit" |
| **High risk** · **Admitted today** · **Discharge today** (an inpatient row's one status tag) | "Going home", "New admission" |
| **Tasks** — only as the Needs Action section for documentation and sign-offs | "To finish today", "To do" |
| **To-do notes** (the doctor's own reminders) · **To-do note saved** | "To-Do Note" in title case, "Reminders" |
| **Ward round notes due** · **Notes to co-sign** · **Dictated notes to sign** · **Discharge summary to sign** · **Referrals to review** | "Round notes to write", "Co-sign" alone, "Drafts" |
| **Discharges today** · **Cleared for discharge** | "Going home", "Nothing in the way" |
| **Sign assessment** | "Complete the assessment" |
| **Pending admissions** · **Admission in progress** · **Waiting for bed** · **Bed ICU-3 allocated** · **Admitted · ICU-3** | "Admission requested" as a status, "Bed assigned", "admitted patients" — three states only: not admitted (no chip), admission in progress, admitted |

## Links and filters

| Canonical | Means | Never write |
|---|---|---|
| **See all ›** | The pill link from a card to the full list. | "Review all", "Show all", "View all" |
| **All …** | The button or tab that clears a filter — "All locations", "All of OPD". | "Show the whole clinic", "Everyone" |
| **This week** | The seven-day range filter. | "Week" |
| **Open** | A problem still current on the problem list. | "Active" (reserved for stroke cases) |
| **Done** | A follow-up completed in the stroke registry. | "Complete" |

## Places

| Canonical | Means | Never write |
|---|---|---|
| **Indostates Health Hospital, Coimbatore** | The hub, `ICH`, the default facility. Shown in full in the greeting; as **Coimbatore** in the app-bar chip. | "Whitefield", any older site name |
| **Facility** | One of the four Indostates sites, wherever a field or switcher names one. | "Site" as a field label, "centre", "campus" |
| **Site** | A node in the stroke network view only (`/stroke/network/sites`). | — |
| **OP number** / **IP number** | The encounter number, where it must be shown at all — `IP number 26-27/118366`. | "Encounter E-…", "Visit record" |
| **Diagnosis and ICD-10** | The coding field on a note. | "Problem and code" |

## Screen names

Every screen has **one name**, in sentence case, held in `src/atlas/registry.ts`
and shown as the page heading. Acronyms (OPD, ICU, ED, AI, CT, MLC, NIHSS,
ASPECTS, EVT, DIDO, MCCD, ADR, PvPI) keep their case; `My Day` and `Stroke-AI
Console` are product names. A heading override on a screen may add patient
context but must not rename the screen.

Checked by `scripts/vocabulary.mjs`, which fails on any banned term in a
user-facing string and on any registry name that is not sentence case.
