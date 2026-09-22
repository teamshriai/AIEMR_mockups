/**
 * AI-911 · Contextual RAG help & documentation assistant — its content.
 *
 * §6.1 states the retrieval backend is hypothetical and later work (OQ-539,
 * OQ-540): "What this document specifies — and what the mockup must show — is
 * the AFFORDANCE and the SURFACE... Treat every example answer in M-28 as
 * illustrative copy for a mockup, not a committed capability."
 *
 * So the answers here are canned. What is NOT canned is the behaviour around
 * them, because that is the part the atlas actually specifies:
 *
 *   Guardrail 1  A clinical question is DECLINED AND ROUTED to the capability
 *                that owns it, under its own gate. Never answered here.
 *   Guardrail 2  Grounded or silent. An answer with no citations renders the
 *                AI-ABSTAIN frame instead of prose — "an uncited answer is not
 *                rendered at all."
 *   Guardrail 3  Retrieval is filtered to what the caller may already read.
 *   Guardrail 4  No PHI it did not already have — only the Z3 patient.
 *   Guardrail 5  Every answer is citable and reportable.
 *   Guardrail 6  It is never the only path.
 */

import type { ConfidenceBand } from '@/atlas/confidence'
import type { Gate } from '@/atlas/gates'

export interface Citation {
  n: number
  label: string
  /** Where it came from — a policy ID, an SOP, a screen spec, a record. */
  source: string
}

/**
 * The five terminal outcomes of W-28-1. Every one is reachable in the UI,
 * because a refusal taxonomy that only exists on paper is not a refusal
 * taxonomy.
 */
export type AnswerKind =
  /** O1 — a cited answer. */
  | 'cited'
  /** O2 — clinical, so routed to the capability that owns it under its own gate. */
  | 'routed'
  /** O3 — out of scope, declined NAMING what it does cover, with two examples. */
  | 'out-of-scope'
  /** O4 — nothing relevant retrieved. AI-ABSTAIN. */
  | 'no-evidence'
  /** O5 — would exceed the caller's access. Declines as though it does not exist. */
  | 'beyond-access'

export interface AssistantAnswer {
  kind: AnswerKind
  body: string
  /** Empty means the AI-ABSTAIN frame renders instead of the body. */
  citations: Citation[]
  band: ConfidenceBand
  /** Set on a routed answer: where the question actually belongs. */
  routedTo?: {
    capability: string
    name: string
    gate: Gate
    where: string
  }
  /** Set on an out-of-scope refusal: what it DOES cover. Two examples minimum. */
  covers?: { summary: string; examples: string[] }
  /** Set on no-evidence: the support route that remains. */
  supportRoute?: string
}

interface Entry {
  /** Lowercase substrings that select this answer. */
  match: string[]
  answer: AssistantAnswer
}

// ───────────────────────────────────────────── Screen-specific suggestions

/**
 * §M-28's S-28-02 requires 3–4 screen-specific suggested prompts:
 * "A blank chat box on a clinical screen gets no use." The EMPTY state is
 * "never a blank box".
 */
export const SCREEN_PROMPTS: Record<string, string[]> = {
  'S-06-01': [
    'What does the acuity sort actually rank on?',
    'How do I pin a patient to needs-attention?',
    'Who covers my list when I am on leave?',
    'What happens to a co-sign I do not action today?',
  ],
  'S-06-02': [
    'What does "catch me up" summarise from?',
    'How do I see the unsummarised record?',
    'Can I search this chart in plain language?',
  ],
  'S-06-03': [
    'How do I add an addendum to a signed note?',
    'Why is Sign still disabled?',
    'Which abbreviations are banned here?',
    'What gets published to ABDM when I sign?',
  ],
  'S-06-04': [
    'Is the raw transcript kept?',
    'What happens if the scribe service drops mid-consultation?',
    'Can I dictate in Hindi?',
  ],
  'S-06-05': [
    'Why can I not pick J18?',
    'What is a leaf code?',
    'How do I code an uncertain diagnosis?',
  ],
  'S-06-06': [
    'How far back does this timeline go?',
    'Can I filter to one episode?',
    'What does the AI badge on an event mean?',
  ],
  'S-06-07': [
    'What is the override process for a hard stop?',
    'Why was this drug blocked?',
    'How is the NLEM substitution prompt decided?',
    'Where does the prescription print from?',
  ],
  'S-06-08': [
    'Which languages can instructions print in?',
    'Does the patient get this on the app?',
    'Can I keep my own wording as well?',
  ],
  'S-06-09': [
    'What is the co-sign turnaround target?',
    'Can I reject an entry rather than co-sign it?',
    'What does an amendment look like to an auditor?',
  ],
  'S-06-10': [
    'How do I promote a personal order set to facility-wide?',
    'Who owns a facility-wide order set?',
    'What is a review date for?',
  ],
  'S-08-03': [
    'How is this list ordered?',
    'Why has the AI abstained on one patient?',
    'How do I hand over my list?',
  ],
  'S-08-04': [
    'How do I add an addendum to a signed note?',
    'What is the ward-round scribe drafting from?',
    'Why is Sign still disabled?',
  ],
  'S-08-07': [
    'When does the 24-hour assessment clock start?',
    'What counts as a completed initial assessment?',
    'What happens if the window closes before I finish?',
  ],
  'S-09-01': [
    'How do I apply an order set?',
    'Why is this test flagged as a duplicate?',
    'What happens to a verbal order?',
  ],
  'S-09-02': [
    'Who governs facility-wide order sets?',
    'How often are pathways reviewed?',
    'Can I apply a set to a patient rather than an encounter?',
  ],
  'S-09-03': [
    'What does "overdue" mean for an order?',
    'Who chases an unresulted order?',
    'Who is notified when I void an order?',
  ],
  'S-09-04': [
    'How is this inbox ranked?',
    'What is the acknowledgement window for a critical result?',
    'What happens if I do not acknowledge?',
    'How do I sort chronologically instead?',
  ],
  'S-09-05': [
    'What is a delta check?',
    'How far back does the trend go?',
    'Why is the interpretation a G3 touchpoint?',
  ],
  'S-09-08': [
    'What makes a test low-value?',
    'Can I disagree with a stewardship flag?',
    'Where do my rejections go?',
  ],
  'S-13-01': [
    'What does the discharge prediction use?',
    'Why is financial clearance blocking?',
    'How do I mark a patient as medically fit?',
  ],
  'S-13-02': [
    'What blocks a discharge summary from being signed?',
    'Is the summary bilingual?',
    'When does this publish to ABDM?',
  ],
  'S-13-03': [
    'What does reconciliation compare?',
    'How do I record a stopped medicine?',
    'What happens to a medicine I do not carry forward?',
  ],
  'S-13-06': [
    'What is the MCCD sequence?',
    'When is police intimation required?',
    'Who can certify a death here?',
  ],
  'S-05-03': [
    'How is the wait time predicted?',
    'What does a token skip do to the queue?',
    'Does the patient see the same wait I see?',
  ],
  'S-05-04': [
    'How do I change my clinic template?',
    'What is an overbooking policy?',
    'Does changing a template move existing appointments?',
  ],
  'S-05-05': [
    'How much notice does a leave block need?',
    'Who approves an override?',
    'What happens to patients already booked into a blocked session?',
  ],
  'S-05-06': [
    'How are referrals triaged?',
    'What is the urgent referral target?',
    'What goes back to the referring doctor?',
  ],
  'S-02-05': [
    'What is break-glass and when may I use it?',
    'Who reviews my break-glass access?',
    'Is the patient told?',
  ],
  'S-15-04': [
    'What does the overlay show?',
    'Can I turn the overlay off?',
    'How do I escalate a critical finding?',
  ],
  'S-15-06': [
    'Who must acknowledge a critical finding?',
    'What is the escalation ladder?',
    'What if I cannot reach the named clinician?',
  ],
  'S-27-02': [
    'How is the teleconsult queue ordered?',
    'What if the patient has no video?',
    'Can a teleconsult become a face-to-face appointment?',
  ],
  'S-27-03': [
    'Is the session recorded?',
    'What consent is needed for a teleconsult?',
    'What should the note say about what I could not examine?',
  ],
  'S-27-04': [
    'Which drug categories can I not tele-prescribe?',
    'What are categories O, A and B?',
    'Does a telephone consultation change what I can prescribe?',
  ],
  'S-16-08': [
    'What is PvPI and what must I report?',
    'How soon must an ADR be reported?',
    'Does reporting add the allergy to the patient record?',
  ],
  // ── Stroke
  'S-18-01': [
    'Which sites are active tonight?',
    'What does a dimmed wall mean?',
    'Why does the wall carry no assistant bubble?',
  ],
  'S-18-03': [
    'What makes a spoke "not ready"?',
    'How often is readiness recomputed?',
    'Where does an ambulance go if the nearest site is not ready?',
  ],
  'S-18-04': [
    'What does activation trigger?',
    'Can I activate without a CT?',
    'How do I de-activate a mimic?',
  ],
  'S-18-05': [
    'Which six fields actually change the decision?',
    'What if the LKW is unknown?',
    'Does the intake block the clock?',
  ],
  'S-18-06': [
    'What are the DTN and DIDO targets?',
    'Why is the DIDO clock projected to breach?',
    'How do I stamp the needle?',
    'Which clock is authoritative if two disagree?',
  ],
  'S-18-07': [
    'Why can I not move this task to In progress?',
    'Who owns the next action?',
    'Why is loading the ambulance blocked before the needle?',
  ],
  'S-18-08': [
    'Which timestamp source wins?',
    'Can I correct a stamped event?',
    'What happens to the intervals when I amend a timestamp?',
  ],
  'S-18-09': [
    'What is the paging escalation ladder?',
    'What if nobody acknowledges?',
    'Does the escalation ladder run on its own?',
  ],
  'S-18-10': [
    'How is the telestroke queue ranked?',
    'What is the response target?',
    'What happens to a request outside the window?',
  ],
  'S-18-11': [
    'What does the session record?',
    'How do I share imaging in-session?',
    'What if the patient declines recording?',
  ],
  'S-18-12': [
    'Can NIHSS be scored over video?',
    'What if an item is not testable?',
    'Why is an untested item not scored zero?',
  ],
  'S-18-13': [
    'What do I do first if there is no neurologist here?',
    'How do I request the hub?',
    'What if the CT will not upload?',
    'Can I activate offline?',
  ],
  'S-18-14': [
    'What does this model detect and not detect?',
    'What does G3 confirm required mean?',
    'Why is ICH shown as an explicit no?',
  ],
  'S-18-15': [
    'How is ASPECTS scored?',
    'Is my adjustment kept alongside the model score?',
    'What does a score below 6 mean for thrombectomy?',
  ],
  'S-18-16': [
    'What is a target mismatch profile?',
    'What are the core and penumbra thresholds?',
    'Why are core and penumbra on one axis?',
  ],
  'S-18-17': [
    'What is the protocol if BP is above 185/110?',
    'Can I proceed with an uncertain DOAC history?',
    'Does the cost block treatment?',
    'Who does the second dose check?',
  ],
  'S-18-18': [
    'What are the EVT selection criteria?',
    'How do I record a disagreement?',
    'Does recording a disagreement block the decision?',
  ],
  'S-18-19': [
    'What does single-act reservation hold?',
    'What happens if one resource becomes unavailable?',
    'What happens if one of the four resources is lost?',
  ],
  'S-18-20': [
    'What is mRS and when is it collected?',
    'Which registry does this export to?',
    'What is exported to the registry, and is it audited?',
  ],
}

/** Fallback prompts where a screen has no specific set. */
export const DEFAULT_PROMPTS = [
  'What is this screen for?',
  'Who else can see what I enter here?',
  'What happens when I save?',
]

export function promptsFor(screenId: string): string[] {
  return SCREEN_PROMPTS[screenId] ?? DEFAULT_PROMPTS
}

// ─────────────────────────────────────────────────────── The answer corpus

/**
 * The canonical example from §6.1's own wireframe: "how do I add an addendum"
 * answered with two citations, one a compliance obligation and one a screen
 * specification.
 */
const ADDENDUM: AssistantAnswer = {
  kind: 'cited',
  body:
    'A signed clinical entry is never edited. To change or add to one, open it and use **Addendum** — the original and the addendum both remain visible and are separately attributed, each with its own author and timestamp.\n\nAdding an addendum needs the `amend` capability, which is granted separately from `write`. If the Addendum action is absent on a signed note, you hold `write` but not `amend`; your medical superintendent grants it.',
  citations: [
    { n: 1, label: 'A signed record is never edited — only amended', source: 'CMP-NABH-10' },
    { n: 2, label: 'Consultation Note — LOCKED state and Addendum action', source: 'S-06-03 · M-06.10' },
    { n: 3, label: 'amend is a distinct capability from write', source: '§3.2 verb matrix' },
  ],
  band: 'HIGH',
}

const SIGN_DISABLED: AssistantAnswer = {
  kind: 'cited',
  body:
    'Sign stays disabled until three things are true:\n\n1. Every required field is valid.\n2. **Every AI-drafted block has a recorded disposition** — Accept, Accept with edits, or Reject. A section left undecided keeps Sign disabled, and a LOW-confidence section cannot be accepted until you expand it.\n3. The banned-abbreviation check has cleared.\n\nThe screen tells you which of the three is outstanding. If the count says "3 items need attention", focus moves to the first one.',
  citations: [
    { n: 1, label: 'The page’s primary action stays disabled until every G2 item has a disposition', source: '§4.4 gate ladder · G2' },
    { n: 2, label: 'LOW is delivered collapsed; acceptance blocked until expanded', source: '§4.5 confidence bands' },
    { n: 3, label: 'Medication orders legible, complete, no banned abbreviations', source: 'CMP-NABH-05' },
  ],
  band: 'HIGH',
}

const HARD_STOP_OVERRIDE: AssistantAnswer = {
  kind: 'cited',
  body:
    'A hard stop is a **deterministic rule**, not a model output — it fires identically when the AI is switched off, because the static interaction and allergy tables are never fully off.\n\nTo proceed past one you need all of:\n\n• a stated reason, from the fixed list or free text;\n• **a second consultant’s authentication** at the dialog — not yours again;\n• both identities are recorded against the prescription.\n\nThe override emits `AI.SAF.HARD_STOP_OVERRIDDEN` and is reviewed within 24 hours. Accepting one of the offered alternatives instead needs no override.',
  citations: [
    { n: 1, label: 'Override of a hard stop requires reason and a second qualified user', source: '§4.4 gate ladder · G4' },
    { n: 2, label: 'Hard stop is deterministic; static interaction tables never fully off', source: 'AI-205 · §4.2' },
    { n: 3, label: 'Prescription Writer — Override hard stop action', source: 'S-06-07 · M-06.10' },
  ],
  band: 'HIGH',
}

const CRITICAL_RESULT: AssistantAnswer = {
  kind: 'cited',
  body:
    'A critical value interrupts a **named** clinician — not a pool and not a ward. That clinician must acknowledge it, and if the acknowledgement does not arrive inside the window the alert escalates to the next person on the rota.\n\nAcknowledging is not the same as acting. You are expected to document what you did in an addendum or a new note; the acknowledgement records only that you saw it.',
  citations: [
    { n: 1, label: 'Critical-value detection & escalation — rule-based thresholds, never fully off', source: 'AI-213 · §4.2' },
    { n: 2, label: 'Critical Result Acknowledgement — interrupts a named clinician', source: 'S-09-06 · M-09.10' },
    { n: 3, label: 'Review a result and act', source: 'Workflow W-06-3' },
  ],
  band: 'HIGH',
}

const ACUITY_SORT: AssistantAnswer = {
  kind: 'cited',
  body:
    'The list is ranked by predicted clinical acuity, not by appointment time. Each row carries a one-line reason chip saying why it sits where it does — for example "NEWS2 7, rising 4h".\n\nThe header always names the sort in use, and **the deterministic chronological sort is one click away**. If the ranking model is unavailable the list reverts to chronological order without re-ordering under you mid-scan.',
  citations: [
    { n: 1, label: 'Ranked list — always reversible to a deterministic sort', source: 'AIP-07 · §4.3' },
    { n: 2, label: 'Clinician worklist prioritisation — fallback is chronological with manual pinning', source: 'AI-613 · §4.2' },
    { n: 3, label: 'Worklist archetype — the current sort is always named in the header', source: 'ARC-01 · §10.1' },
  ],
  band: 'HIGH',
}

const BREAK_GLASS: AssistantAnswer = {
  kind: 'cited',
  body:
    'Break-glass is for when you hold the capability but have **no care relationship** with the patient — a remote on-call reading a chart at another site, for instance.\n\nYou are not refused. You state a reason, you proceed, and the access is logged and reviewed within 24 hours. The patient’s record shows an amber banner while you are in it.\n\nThe reason this exists rather than a refusal: an authorization model that can block resuscitation is the wrong model.',
  citations: [
    { n: 1, label: 'Break-glass proceeds rather than refusing; reason mandatory', source: 'GP-11 · §6' },
    { n: 2, label: 'Break-glass access request', source: 'S-02-05 · M-02.10' },
    { n: 3, label: 'An authorization model that can block resuscitation is the wrong model', source: 'DD-014 · §3.2' },
  ],
  band: 'HIGH',
}

const ABDM_PUBLISH: AssistantAnswer = {
  kind: 'cited',
  body:
    'Signing queues a FHIR R4 bundle to ABDM as the health information provider. Five record types publish: OPConsultation, DiagnosticReport, Prescription, DischargeSummary and ImmunizationRecord.\n\nTwo things worth knowing:\n\n• A publish failure **never** blocks or alters the clinical record. It lands in the publish-failure queue, visible and retryable.\n• Your HPR number goes on every published prescription.',
  citations: [
    { n: 1, label: 'HIP publish of 5 record types', source: 'CMP-ABDM-03' },
    { n: 2, label: 'Publish failures must be visible and retryable', source: 'CMP-ABDM-04' },
    { n: 3, label: 'HPR ID on every prescription', source: 'CMP-ABDM-07' },
  ],
  band: 'HIGH',
}

const LEAF_CODE: AssistantAnswer = {
  kind: 'cited',
  body:
    'A leaf code is the most specific code in its branch — one with no children. `J18.9` is a leaf; `J18` is the category above it.\n\nThe coding assistant proposes leaf codes and **blocks parent-only ones**, because a category code will not group for a claim and will not satisfy a coder audit. Manual search is always available if the suggestion is wrong.',
  citations: [
    { n: 1, label: 'Blocks parent-only codes; manual search always available', source: 'AI-501 · M-06.5' },
    { n: 2, label: 'Problem & code field — SNOMED plus ICD-10 leaf only', source: 'S-06-03 field 3' },
  ],
  band: 'HIGH',
}

const DTN_TARGETS: AssistantAnswer = {
  kind: 'cited',
  body:
    'The network runs to these targets:\n\n• **Door → CT start** 25 min\n• **CT → AI result** 5 min\n• **CT → read** 20 min\n• **Door → needle (DTN)** 60 min\n• **Door-in → door-out (DIDO)** 60 min at a spoke\n• **Groin puncture** 90 min\n\nEvery interval names who owns the next action. A projected breach is captured with a **structured reason at the moment of breach**, not reconstructed at audit — which is the whole point of the screen.',
  citations: [
    { n: 1, label: 'Live Case Clock — intervals, targets and owners', source: 'S-18-06 · M-18.10' },
    { n: 2, label: 'Capture breach reason at the moment of breach', source: 'S-18-06 actions' },
    { n: 3, label: 'Pathway & protocol adherence monitoring', source: 'AI-303 · §4.2' },
  ],
  band: 'HIGH',
}

const CLOCK_AUTHORITY: AssistantAnswer = {
  kind: 'cited',
  body:
    'The **server clock is authoritative**, and the event stream is append-only. Local device times are reconciled against the server, never trusted.\n\nWhere two sources disagree — a triage entry, an ambulance handover form, a DICOM header — the reconciliation screen shows all of them and which one won. Corrections are audited amendments, never overwrites.\n\nThis matters because a disputed door time is a disputed door-to-needle.',
  citations: [
    { n: 1, label: 'Local times reconciled against the server clock, never trusted', source: 'DD-012' },
    { n: 2, label: 'Event Stamping & Timestamp Reconciliation', source: 'S-18-08 · M-18.10' },
    { n: 3, label: 'A closed case is read-only; corrections are audited amendments', source: 'S-18-06 LOCKED state' },
  ],
  band: 'HIGH',
}

const BP_PROTOCOL: AssistantAnswer = {
  kind: 'cited',
  body:
    'Blood pressure above 185/110 blocks thrombolysis, and the item unblocks **only when a reading below threshold is documented** — not when someone asserts it has been treated.\n\nThe treat-to-target sub-flow on the screen carries the departmental protocol, and re-measurement is recorded against the case clock so the delay is visible.\n\nThis is a process answer. For the drug and dose, the screen’s own dosing panel owns that decision under its own check.',
  citations: [
    { n: 1, label: 'BP gate with its treat-to-target sub-flow', source: 'S-18-17 · M-18.10' },
    { n: 2, label: 'Thrombolysis eligibility criteria and consequences', source: 'S-18-17 Z5 items' },
  ],
  band: 'MED',
}

const COST_NEVER_BLOCKS: AssistantAnswer = {
  kind: 'cited',
  body:
    'No. The cost panel is **display only and does not block**. The primary action reads "Treat now, authorize in parallel", and taking it is audited.\n\nThe reasoning is stated as a design principle: in India, settling money is the commonest non-clinical cause of treatment delay, so pre-authorisation runs alongside the clinical pathway and never on its critical path.',
  citations: [
    { n: 1, label: 'Cost & coverage — display only, does not block', source: 'S-18-17 Z5' },
    { n: 2, label: 'Treat now, authorize in parallel', source: 'S-18-17 actions' },
    { n: 3, label: 'Tenecteplase ₹42,000 · PM-JAY package-inclusive', source: 'SD-M-07 · §8.4' },
  ],
  band: 'HIGH',
}

const SPOKE_FIRST_STEPS: AssistantAnswer = {
  kind: 'cited',
  body:
    'One action does both: **Activate & request hub**. It starts the case clock and raises the telestroke request together, and it is always enabled — it is never gated on the AI or on the network.\n\nThen answer the six questions. Not sixty; the hub collects the rest.\n\nIf the CT will not upload, it uploads progressively and the decision does not wait on full resolution. And the phone path is always there — calling the hub is a first-class route, never removed.',
  citations: [
    { n: 1, label: 'ACTIVATE & REQUEST HUB — largest target, always enabled', source: 'S-18-13 actions' },
    { n: 2, label: 'Six fields, not sixty', source: 'S-18-13 · M-18.10' },
    { n: 3, label: 'The phone is always a path — never remove it', source: 'S-18-13 Call hub' },
    { n: 4, label: 'Offline is the expected state at a spoke', source: 'S-18-13 OFFLINE state' },
  ],
  band: 'HIGH',
}

const IMAGING_MODEL_LIMITS: AssistantAnswer = {
  kind: 'cited',
  body:
    'The card names `lvo-det v4.2.1` and its gate is **G3 — confirm required**. It prioritises and notifies. **It never diagnoses.**\n\nWhat it reports: intracranial haemorrhage present or absent, large-vessel occlusion and its location, an ASPECTS estimate, and the hyperdense vessel sign.\n\nWhat it does not do reliably: posterior circulation occlusion, and it loses sensitivity with motion artefact or on scanners below 16 slices. The explainability drawer carries the validation population and the known failure modes.',
  citations: [
    { n: 1, label: 'Large-vessel-occlusion detection — G3, radiologist/neurologist read is the fallback', source: 'AI-404 · §4.2' },
    { n: 2, label: 'The card must name model@version', source: 'S-18-14 drawing notes' },
    { n: 3, label: 'Limits & provenance panel', source: 'C-42 panel 4 · §4.7' },
  ],
  band: 'HIGH',
}

const SINGLE_ACT_RESERVATION: AssistantAnswer = {
  kind: 'cited',
  body:
    'One action holds four resources **atomically**: the ambulance, the cath lab, the anaesthetist and the neuro-ICU bed. Either all four are held or none is — a transfer with three of the four is not a transfer.\n\nIf one becomes unavailable while you are deciding, the whole reservation is refused with the unavailable resource named, rather than partially committing you.',
  citations: [
    { n: 1, label: 'Single-act reservation must hold a bed, a cath lab and an ambulance atomically', source: 'DD-012' },
    { n: 2, label: 'Transfer, DIDO Clock & Single-Act Reservation', source: 'S-18-19 · M-18.10' },
  ],
  band: 'HIGH',
}

const ASSISTANT_SELF: AssistantAnswer = {
  kind: 'cited',
  body:
    'I answer questions about **process, policy and how this product works** — and only from documentation that exists, with the source cited. If nothing relevant is retrieved I say so rather than guessing.\n\nThree things I will not do:\n\n• Answer a clinical question. Those route to the capability that owns them, under its own human gate.\n• Show you a patient you have not opened.\n• Extrapolate a policy this hospital has not written.\n\nNo task in this product requires me to complete. The static help centre and a support contact are always available.',
  citations: [
    { n: 1, label: 'Six guardrails — never clinical, grounded or silent, capability-scoped', source: '§6.1' },
    { n: 2, label: 'No task anywhere in the product may require the assistant to complete', source: '§6.1 guardrail 6' },
  ],
  band: 'HIGH',
}

const CO_SIGN: AssistantAnswer = {
  kind: 'cited',
  body:
    'A resident holds `note.write` but not `note.sign` for the classes that require a consultant, so their entries are saved and land in your co-sign queue marked **Co-sign pending**.\n\nCountersigning a care plan is an accreditation requirement, not a courtesy. You can co-sign, or open the entry and add your own addendum where you disagree — the original stays visible and separately attributed either way.',
  citations: [
    { n: 1, label: 'Care plan documented and countersigned', source: 'CMP-NABH-03' },
    { n: 2, label: 'P-05 holds note.write but not note.sign', source: 'M-06.2' },
    { n: 3, label: 'Co-Sign & Amendment Queue', source: 'S-06-09 · M-06.10' },
  ],
  band: 'HIGH',
}

const BANNED_ABBREVIATIONS: AssistantAnswer = {
  kind: 'cited',
  body:
    'The check runs **on blur**, not on every keystroke, and banned abbreviations are rejected rather than warned about.\n\nThe common offenders: `OD` (write "once daily"), `U` or `IU` (write "units"), `cc` (write "mL"), a trailing zero after a decimal point, and `µg` (write "mcg"). Each rejection tells you what to write instead.',
  citations: [
    { n: 1, label: 'Medication orders legible, complete, no banned abbreviations', source: 'CMP-NABH-05' },
    { n: 2, label: 'Banned-abbreviation & documentation-quality check — checked on blur', source: 'AI-114 · M-06.5' },
  ],
  band: 'HIGH',
}

const TELE_CATEGORIES: AssistantAnswer = {
  kind: 'cited',
  body:
    'The Telemedicine Practice Guidelines 2020 split prescribable drugs into three lists and one prohibition:\n\n• **List O** — over-the-counter and safe on any consultation mode.\n• **List A** — permitted on a first video consultation, or on a re-consult for the same condition.\n• **List B** — permitted only as an add-on to an existing prescription for the same condition.\n• **Prohibited list** — never by telemedicine, which includes Schedule X and narcotics.\n\nThe gate on the tele-prescription screen is **hard-coded and never AI-decided**, and it stays enforced when the model is off.',
  citations: [
    { n: 1, label: 'Teleconsultation prescribing categories (O / A / B) and prohibited list', source: 'CMP-DRUG-06' },
    { n: 2, label: 'Tele-prescription category gate — hard-coded prohibited list, never off', source: 'AI-310 · §4.2' },
  ],
  band: 'HIGH',
}

const DISCHARGE_PREDICTION: AssistantAnswer = {
  kind: 'cited',
  body:
    'The board is computed at 07:00 so the day can be planned rather than discovered at 16:00. It ranks likelihood of discharge today and names the blockers for each patient.\n\nSeparately, a financial-clearance readiness signal shows whether the money will be settled in time — a TPA approval still pending is the commonest reason a medically fit patient waits.\n\nIt is a prediction, at G1. Nothing discharges automatically; a clinician still marks the patient fit.',
  citations: [
    { n: 1, label: 'Discharge-today prediction — clinician-flagged discharges only is the fallback', source: 'AI-610 · §4.2' },
    { n: 2, label: 'Discharge financial clearance readiness', source: 'AI-514 · §4.2' },
    { n: 3, label: 'Discharge Readiness Board', source: 'S-13-01 · M-13.10' },
  ],
  band: 'HIGH',
}

const MCCD: AssistantAnswer = {
  kind: 'cited',
  body:
    'The medical certificate of cause of death uses Form 4 for an institutional death and Form 4A otherwise, and the cause is recorded as a **sequence**, not a list:\n\n• **Part I(a)** the immediate cause, then (b) and (c) the antecedent causes leading to it, each one caused by the line below.\n• **Part II** other significant conditions contributing but not in the sequence.\n\nRegistration is with the civil registration system. If the death is medico-legal, police intimation and the MLC docket come first and the body is not released until that is acknowledged.',
  citations: [
    { n: 1, label: 'Birth & death registration (CRS), MCCD Form 4 / 4A', source: 'CMP-STAT-03' },
    { n: 2, label: 'MLC, police intimation with acknowledgement', source: 'CMP-STAT-01' },
    { n: 3, label: 'Death, MCCD & Body Handover', source: 'S-13-06 · M-13.10' },
  ],
  band: 'MED',
}

const SCRIBE_TRANSCRIPT: AssistantAnswer = {
  kind: 'cited',
  body:
    'Yes. The **raw transcript is retained verbatim**, and each drafted sentence links back to the transcript span behind it — that span is what the Why? drawer shows.\n\nIf the speech service drops mid-consultation, every AI affordance is hidden rather than greyed out, and the sections collapse to plain typing. Nothing you have already dictated is lost, and typing is always available anyway.',
  citations: [
    { n: 1, label: 'Ambient scribe — raw transcript retained verbatim; typing always available', source: 'AI-101 · M-06.5' },
    { n: 2, label: 'Explainability — the transcript span behind each sentence', source: 'S-06-03 AI touchpoints' },
    { n: 3, label: 'AI-OFF — every affordance hidden, not greyed', source: '§1.5' },
  ],
  band: 'HIGH',
}

const ORDER_SET_GOVERNANCE: AssistantAnswer = {
  kind: 'cited',
  body:
    'A personal order set is yours to draft and change freely. Promoting one to facility-wide is a **governance act**: it acquires a named owner and a review date, and it needs the facility administrator.\n\nThat asymmetry is deliberate. A personal set that is wrong affects your patients; a facility-wide set that is wrong affects everyone’s, and someone has to be accountable for it by name.',
  citations: [
    { n: 1, label: 'Facility-wide promotion is a governance act with a named owner and a review date', source: 'Workflow W-06-4 s3' },
    { n: 2, label: 'Template & Order-Set Manager', source: 'S-06-10 · M-06.10' },
  ],
  band: 'HIGH',
}

const DUPLICATE_TEST: AssistantAnswer = {
  kind: 'cited',
  body:
    'The flag means the same test was resulted recently enough that a repeat is unlikely to change management on the current trajectory. The row tells you the prior value, when it was resulted, and the basis of the flag.\n\nIt is a **G2 suggestion, not a block**. You can accept it, edit the order, or reject it — and rejecting requires a reason from the fixed list, which is how the stewardship team learns where the rule is wrong.',
  citations: [
    { n: 1, label: 'Duplicate & low-value test detection', source: 'AI-304 · §4.2' },
    { n: 2, label: 'Rejected requires a reason from the fixed five', source: '§4.6 dispositions' },
  ],
  band: 'HIGH',
}

const OFFLINE_BEHAVIOUR: AssistantAnswer = {
  kind: 'cited',
  body:
    'Unreliable connectivity is treated as normal, not exceptional. When the network drops, a strip tells you three things: what still works, what is queued, and what is blocked — plus a pending-sync count.\n\n**Typed content is never lost.** On an authoring screen the note queues locally and Sign is offered as "will sign when reconnected". At a spoke, offline is the expected state, so activation and the six fields capture locally and the phone path is offered prominently.',
  citations: [
    { n: 1, label: 'Offline strip — what works, what is queued, what is blocked', source: 'GP-12 · §6' },
    { n: 2, label: 'Unreliable power and connectivity is normal, not exceptional', source: '§2.1 A9 · DD-015' },
    { n: 3, label: 'OFFLINE is the expected state at a spoke', source: 'S-18-13' },
  ],
  band: 'HIGH',
}

const ENTRIES: Entry[] = [
  { match: ['addendum', 'amend', 'edit a signed', 'change a signed', 'signed note'], answer: ADDENDUM },
  { match: ['sign still disabled', 'why is sign', 'cannot sign', "can't sign", 'sign disabled', 'enable sign'], answer: SIGN_DISABLED },
  { match: ['override', 'hard stop', 'blocked drug', 'why was this drug'], answer: HARD_STOP_OVERRIDE },
  { match: ['critical result', 'acknowledge', 'acknowledgement window', 'unacknowledged', 'escalate'], answer: CRITICAL_RESULT },
  { match: ['acuity', 'ranked', 'ranking', 'how is this list ordered', 'how is this inbox ranked', 'sort', 'chronolog'], answer: ACUITY_SORT },
  { match: ['break-glass', 'break glass', 'no care relationship'], answer: BREAK_GLASS },
  { match: ['abdm', 'publish', 'fhir', 'health information provider'], answer: ABDM_PUBLISH },
  { match: ['leaf code', 'j18', 'parent-only', 'parent code', 'code assist'], answer: LEAF_CODE },
  { match: ['dtn', 'dido', 'target', 'door to needle', 'door-to-needle', 'breach'], answer: DTN_TARGETS },
  { match: ['which clock', 'authoritative', 'timestamp', 'clocks disagree', 'door time'], answer: CLOCK_AUTHORITY },
  { match: ['185', 'blood pressure', 'bp is above', 'treat to target', 'labetalol'], answer: BP_PROTOCOL },
  { match: ['cost', 'money', 'does the cost block', 'authorise in parallel', 'authorize in parallel', 'pm-jay pending'], answer: COST_NEVER_BLOCKS },
  { match: ['no neurologist', 'what do i do first', 'request the hub', 'activate offline', 'ct will not upload', 'spoke'], answer: SPOKE_FIRST_STEPS },
  { match: ['model detect', 'g3', 'confirm required', 'explicit no', 'ich', 'lvo model', 'model version'], answer: IMAGING_MODEL_LIMITS },
  { match: ['single-act', 'single act', 'reservation', 'holds what', 'atomic'], answer: SINGLE_ACT_RESERVATION },
  { match: ['what can you', 'what can i ask', 'who are you', 'what do you do', 'help with'], answer: ASSISTANT_SELF },
  { match: ['co-sign', 'cosign', 'countersign', 'resident'], answer: CO_SIGN },
  { match: ['banned abbreviation', 'abbreviation', 'which abbreviations'], answer: BANNED_ABBREVIATIONS },
  { match: ['tele-prescri', 'tele prescri', 'category o', 'categories o', 'list a', 'list b', 'cannot tele'], answer: TELE_CATEGORIES },
  { match: ['discharge prediction', 'discharge today', 'financial clearance', 'medically fit'], answer: DISCHARGE_PREDICTION },
  { match: ['mccd', 'cause of death', 'death certificat', 'form 4'], answer: MCCD },
  { match: ['transcript', 'scribe', 'dictat', 'raw transcript'], answer: SCRIBE_TRANSCRIPT },
  { match: ['order set', 'promote', 'facility-wide', 'governance'], answer: ORDER_SET_GOVERNANCE },
  { match: ['duplicate', 'low-value', 'low value', 'unnecessary test', 'stewardship'], answer: DUPLICATE_TEST },
  { match: ['offline', 'no network', 'connectivity', 'queued'], answer: OFFLINE_BEHAVIOUR },
]

// ────────────────────────────────────────────── The four refusal outcomes

/**
 * O2 — a clinical question. Guardrail 1: "A clinical question — 'is this dose
 * safe', 'what does this result mean', 'should I thrombolyse' — is DECLINED AND
 * ROUTED to the capability that owns it under its own gate. The assistant never
 * answers it directly, at any confidence."
 */
const CLINICAL_ROUTES: { match: string[]; routedTo: NonNullable<AssistantAnswer['routedTo']> }[] = [
  {
    match: ['dose safe', 'is this dose', 'safe to give', 'interaction', 'allergic', 'allergy safe', 'contraindicat'],
    routedTo: {
      capability: 'AI-205',
      name: 'Drug interaction, allergy & contraindication check',
      gate: 'G2',
      where: 'the Prescription Writer, where it runs before the prescription is committed',
    },
  },
  {
    match: ['what does this result mean', 'interpret', 'is this result', 'significan'],
    routedTo: {
      capability: 'AI-212',
      name: 'Result interpretation & delta check',
      gate: 'G1',
      where: 'the result detail screen, alongside the reference range and the prior value',
    },
  },
  {
    match: ['should i thrombolyse', 'should i treat', 'should we thrombolyse', 'give tenecteplase', 'thrombolyse this'],
    routedTo: {
      capability: 'AI-203',
      name: 'Differential diagnosis suggestion',
      gate: 'G1',
      where: 'the thrombolysis eligibility checklist, which suggests and never concludes',
    },
  },
  {
    match: ['what is wrong with', 'diagnos', 'differential', 'what could this be'],
    routedTo: {
      capability: 'AI-203',
      name: 'Differential diagnosis suggestion',
      gate: 'G1',
      where: 'the consultation note, as a suggestion card that suggests and never concludes',
    },
  },
  {
    match: ['how much', 'what dose', 'dosage', 'mg/kg', 'adjust the dose'],
    routedTo: {
      capability: 'AI-206',
      name: 'Renal & hepatic dose adjustment',
      gate: 'G2',
      where: 'the prescription line itself, with the printed reference as the fallback',
    },
  },
]

function clinicalRefusal(routedTo: NonNullable<AssistantAnswer['routedTo']>): AssistantAnswer {
  return {
    kind: 'routed',
    body:
      'That is a clinical question, and I do not answer those — at any confidence.\n\nIt belongs to a capability with its own human gate, so that the answer arrives where you can accept, edit or reject it and the decision is recorded against your name.',
    citations: [
      { n: 1, label: 'It is not a clinical adviser — declined and routed', source: '§6.1 guardrail 1' },
      { n: 2, label: `${routedTo.capability} ${routedTo.name}`, source: `§4.2 · gate ${routedTo.gate}` },
    ],
    band: 'HIGH',
    routedTo,
  }
}

/**
 * O3 — out of scope. "declined NAMING WHAT IT DOES COVER, with two examples.
 * Not a generic 'I don't understand'."
 */
const OUT_OF_SCOPE: AssistantAnswer = {
  kind: 'out-of-scope',
  body: 'That is outside what I cover.',
  citations: [{ n: 1, label: 'Out-of-scope requests are declined explicitly', source: '§6.1 · GP-13' }],
  band: 'HIGH',
  covers: {
    summary:
      'I cover how this product works and the process and policy behind it — documentation, accreditation obligations, capability and access rules, and the clinical pathways as written.',
    examples: ['How do I add an addendum to a signed note?', 'What is the acknowledgement window for a critical result?'],
  },
}

/** O4 — nothing relevant retrieved. AI-ABSTAIN, never an extrapolated policy. */
const NO_EVIDENCE: AssistantAnswer = {
  kind: 'no-evidence',
  body: "I don't have documentation for that.",
  /** Empty by design — an uncited answer is not rendered at all. */
  citations: [],
  band: 'LOW',
  supportRoute: 'Static help centre, or the service desk on extension 4400.',
}

/**
 * O5 — would exceed the caller's access. "declines AS THOUGH THE CONTENT DOES
 * NOT EXIST — the refusal is uniform and does not confirm that the record
 * exists." Same rule as the DENIED state.
 */
const BEYOND_ACCESS: AssistantAnswer = {
  kind: 'beyond-access',
  body: "I don't have documentation for that.",
  citations: [],
  band: 'LOW',
  supportRoute: 'Static help centre, or the service desk on extension 4400.',
}

/** Questions that reach for a patient the caller has not opened. */
const CROSS_PATIENT_PATTERNS = [
  'another patient',
  'other patients',
  'any patient with',
  'list patients',
  'all patients in',
  'who else has',
  'show me a patient',
  'bed 3',
  'ward 3c',
]

/** Questions that are simply not about this product. */
const OFF_TOPIC_PATTERNS = [
  'weather',
  'cricket',
  'canteen',
  'parking',
  'salary',
  'holiday',
  'joke',
  'recipe',
  'flight',
  'stock price',
  'who won',
]

export interface AskContext {
  screenId: string
  /** The Z3 patient, if the calling screen had one. */
  patientId?: string
  /** Whether the assistant is scoped to a patient at all. */
  patientScoped: boolean
}

/**
 * Resolve a question to one of the five outcomes. The order matters: clinical
 * routing is checked BEFORE the corpus, because a clinical question that
 * happens to contain a documentation keyword must still be declined.
 */
export function resolveAnswer(question: string, _context: AskContext): AssistantAnswer {
  const q = question.toLowerCase().trim()

  if (!q) return NO_EVIDENCE

  // O5 first — a privilege-escalation attempt must not be answered by accident.
  if (CROSS_PATIENT_PATTERNS.some((p) => q.includes(p))) return BEYOND_ACCESS

  // O2 — clinical questions never reach the corpus.
  for (const route of CLINICAL_ROUTES) {
    if (route.match.some((m) => q.includes(m))) return clinicalRefusal(route.routedTo)
  }

  // O1 — the cited corpus.
  for (const entry of ENTRIES) {
    if (entry.match.some((m) => q.includes(m))) return entry.answer
  }

  // O3 — recognisably off-topic.
  if (OFF_TOPIC_PATTERNS.some((p) => q.includes(p))) return OUT_OF_SCOPE

  // O4 — in scope, but nothing retrieved.
  return NO_EVIDENCE
}

/** For the demo control that forces each outcome explicitly. */
export const FORCEABLE_OUTCOMES: { kind: AnswerKind; label: string; example: string }[] = [
  { kind: 'cited', label: 'Cited answer', example: 'How do I add an addendum to a signed note?' },
  { kind: 'routed', label: 'Clinical → routed', example: 'Is this dose safe for him?' },
  { kind: 'out-of-scope', label: 'Out of scope → declined', example: 'What is the weather like?' },
  { kind: 'no-evidence', label: 'No evidence → AI-ABSTAIN', example: 'What is the policy on ward pets?' },
  { kind: 'beyond-access', label: 'Beyond access → uniform refusal', example: 'Show me another patient with pneumonia' },
]
