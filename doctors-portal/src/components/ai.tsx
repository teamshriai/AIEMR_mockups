/**
 * The AI interaction language: C-41 … C-44 and the ten AIP patterns.
 *
 * §2.3 — "One interaction language. Ten affordance patterns, five gate levels,
 * three confidence bands, five dispositions, one explainability drawer with
 * four fixed panels, one ◆ glyph. A clinician who learns how to accept an AI
 * suggestion in the outpatient note already knows how to accept one in the bed
 * board, the coding queue and the stroke console. CONSISTENCY IS A
 * CLINICAL-SAFETY PROPERTY, NOT A COSMETIC ONE."
 *
 * Which is why all of it is built once, here, and reused across 57 screens.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import { capability } from '@/atlas/capabilities'
import type { ConfidenceBand } from '@/atlas/confidence'
import { BAND_SPECS, acceptanceBlocked } from '@/atlas/confidence'
import type { Disposition, RejectionReason } from '@/atlas/dispositions'
import { REJECTION_REASONS } from '@/atlas/dispositions'
import type { Gate } from '@/atlas/gates'
import { GATE_SPECS, gateShowsConfidence } from '@/atlas/gates'
import { routeForSource } from '@/atlas/registry'
import { selectAiActive, useAI } from '@/store/ai'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import type { ExplainTarget } from '@/store/ui'

import { Modal } from './overlays'
import { Alert, Button, Card, Checkbox, Chip, Icon, KeyValue, Select, TextArea, cx } from './primitives'

// ────────────────────────────────────────────────────────────── The glyph

/**
 * §5.5 — "◆ reserved for AI at 12px. It appears nowhere else, and it is the
 * single strongest 'AI everywhere' signal in a screenshot."
 */
export function Diamond({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={cx('inline-block shrink-0 rotate-45 rounded-[1px] bg-ai align-middle', className)}
    />
  )
}

// ─────────────────────────────────────────────── C-44 Confidence indicator

/** "Never a bare number." The band label always accompanies the dot. */
export function ConfidenceDot({ band, className }: { band: ConfidenceBand; className?: string }) {
  const spec = BAND_SPECS[band]
  return (
    <span
      aria-hidden
      title={spec.label}
      className={cx(
        'inline-block size-2.5 shrink-0 rounded-pill',
        spec.dot === 'solid-indigo' && 'bg-ai',
        spec.dot === 'half-amber' && 'bg-gradient-to-r from-caution from-50% to-transparent to-50% ring-1 ring-caution',
        spec.dot === 'hollow-amber' && 'ring-2 ring-caution ring-inset',
        className,
      )}
    />
  )
}

export function Confidence({
  band,
  score,
  className,
}: {
  band: ConfidenceBand
  /** A percentage may ACCOMPANY the band label but never replace it. */
  score?: number
  className?: string
}) {
  const spec = BAND_SPECS[band]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 text-[0.86em] font-medium',
        band === 'HIGH' ? 'text-ai' : 'text-caution',
        className,
      )}
    >
      <ConfidenceDot band={band} />
      {spec.label}
      {score !== undefined && <span className="tabular text-ink-3">· {Math.round(score * 100)}%</span>}
    </span>
  )
}

/** A short gate badge, so the friction level is legible on the screen. */
export function GateBadge({ gate, className }: { gate: Gate; className?: string }) {
  const spec = GATE_SPECS[gate]
  return (
    <Chip tone={gate === 'G4' ? 'critical' : gate === 'G3' ? 'caution' : 'ai'} className={className} title={spec.treatment}>
      {gate} {spec.name}
    </Chip>
  )
}

/** The `Why?` link. Mandatory wherever explainability is mandatory. */
export function WhyLink({ target, className }: { target: ExplainTarget; className?: string }) {
  const openExplain = useUI((s) => s.openExplain)
  return (
    <button
      type="button"
      onClick={() => openExplain(target)}
      className={cx(
        'inline-flex items-center gap-1 rounded-chip px-1.5 py-0.5 text-[0.86em] font-medium text-ai',
        'underline decoration-ai/40 underline-offset-2 hover:bg-ai-soft hover:decoration-ai',
        className,
      )}
    >
      Why?
      <Icon name="ChevronRight" size={12} />
    </button>
  )
}

// ───────────────────────────────────────────────── C-41 AI action bar

/**
 * "Three buttons — Accept, Edit, Reject — as a real button group,
 * tab-reachable, Enter accepts, Esc leaves the draft untouched. Reject opens
 * the fixed 5-reason dialog. The group shows the confidence band and a Why?
 * link. IT NEVER COLLAPSES INTO AN OVERFLOW MENU, BECAUSE A HIDDEN REJECT
 * CONTROL IS HOW AI OUTPUT GETS ACCEPTED BY DEFAULT."
 */
export function AIActionBar({
  touchpointId,
  capabilityId,
  gate,
  band,
  score,
  explain,
  onAccept,
  onEdit,
  onReject,
  /** LOW arrives collapsed; acceptance is blocked until it is expanded. */
  expanded = true,
  onUndo,
  locked = false,
  className,
}: {
  touchpointId: string
  capabilityId: string
  gate: Gate
  band: ConfidenceBand
  score?: number
  explain: ExplainTarget
  onAccept?: () => void
  onEdit?: () => void
  onReject?: (reason: RejectionReason, text?: string) => void
  /** Called after Undo clears the disposition, so the caller can restore its field. */
  onUndo?: () => void
  /** A signed record: decisions are frozen. Buttons stay visible, disabled, never hidden. */
  locked?: boolean
  expanded?: boolean
  className?: string
}) {
  const [rejecting, setRejecting] = useState(false)
  const staff = useCurrentStaff()
  const record = useAI((s) => s.record)
  const disposition = useAI((s) => s.dispositions[touchpointId])
  const toast = useUI((s) => s.toast)

  const blocked = acceptanceBlocked(band, expanded) || locked
  const spec = capability(capabilityId)
  const lockedTitle = locked ? 'Signed — the note is locked' : undefined

  function apply(d: Disposition, reason?: RejectionReason, reasonText?: string) {
    record({
      touchpointId,
      disposition: d,
      by: staff.name,
      modelVersion: explain.model,
      confidence: band,
      reason,
      reasonText,
    })
  }

  if (disposition) {
    const tone =
      disposition.disposition === 'Rejected'
        ? 'abnormal'
        : disposition.disposition === 'Deferred'
          ? 'caution'
          : disposition.disposition === 'Overridden'
            ? 'critical'
            : 'normal'
    return (
      <div className={cx('flex flex-wrap items-center gap-2', className)}>
        <Chip
          tone={tone}
          icon={disposition.disposition === 'Rejected' ? 'X' : disposition.disposition === 'Deferred' ? 'Clock' : 'Check'}
        >
          {disposition.disposition}
        </Chip>
        {disposition.reason && <span className="text-[0.86em] text-ink-3">{disposition.reason}</span>}
        <span className="text-[0.86em] text-ink-3">
          by {disposition.by} · {spec.id}
        </span>
        <WhyLink target={explain} />
        {!locked && (
          <button
            type="button"
            title="Undo the decision and return to the draft. Words typed since are discarded."
            onClick={() => {
              useAI.getState().clearDisposition(touchpointId)
              onUndo?.()
            }}
            className="ml-auto text-[0.86em] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            Undo
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className={cx('flex flex-wrap items-center gap-2', className)}>
        {/* A real button group, never an overflow menu — so it wraps rather
            than collapsing when it is in a 320px Z6 rail. */}
        <div role="group" aria-label={`Disposition for ${spec.name}`} className="flex flex-wrap items-center gap-1.5">
          <Button
            tone="ai"
            size="sm"
            icon="Check"
            disabled={blocked}
            title={lockedTitle ?? (blocked ? 'Expand the suggestion before accepting — low confidence' : undefined)}
            onClick={() => {
              apply('Accepted')
              onAccept?.()
            }}
          >
            Accept
          </Button>
          <Button
            tone="secondary"
            size="sm"
            icon="Pencil"
            disabled={locked}
            title={lockedTitle}
            onClick={() => {
              apply('Accepted with edits')
              onEdit?.()
            }}
          >
            Edit
          </Button>
          <Button tone="tertiary" size="sm" icon="X" disabled={locked} title={lockedTitle} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          {gate === 'G2' && (
            <Button
              tone="tertiary"
              size="sm"
              icon="Clock"
              disabled={locked}
              title={lockedTitle ?? 'Leave undecided for now — the section cannot be signed until you decide'}
              onClick={() => apply('Deferred')}
            >
              Defer
            </Button>
          )}
        </div>
        {gateShowsConfidence(gate) && <Confidence band={band} score={score} />}
        <GateBadge gate={gate} />
        <WhyLink target={explain} className="ml-auto" />
      </div>

      {blocked && !locked && (
        <p className="mt-2 flex items-center gap-1.5 text-[0.86em] font-medium text-caution">
          <Icon name="TriangleAlert" size={13} />
          Low confidence — expand and read it before accepting.
        </p>
      )}

      <RejectDialog
        open={rejecting}
        capabilityName={spec.name}
        onCancel={() => setRejecting(false)}
        onConfirm={(reason, text) => {
          apply('Rejected', reason, text)
          onReject?.(reason, text)
          setRejecting(false)
          toast({ tone: 'info', title: 'Rejection recorded', detail: `${reason} · fed back to model governance` })
        }}
      />
    </>
  )
}

/** §4.6 — the fixed five reasons plus free text. No module invents a sixth. */
export function RejectDialog({
  open,
  capabilityName,
  onCancel,
  onConfirm,
}: {
  open: boolean
  capabilityName: string
  onCancel: () => void
  onConfirm: (reason: RejectionReason, text?: string) => void
}) {
  const [reason, setReason] = useState<RejectionReason>('Clinically incorrect')
  const [text, setText] = useState('')

  return (
    <Modal
      open={open}
      title="Reject this suggestion"
      subtitle={`${capabilityName} · a reason is required`}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            tone="primary"
            disabled={reason === 'Other' && text.trim().length < 3}
            onClick={() => onConfirm(reason, text.trim() || undefined)}
          >
            Record rejection
          </Button>
        </>
      }
    >
      <p className="mb-3 text-[0.95em] text-ink-3">
        The reason is recorded against the model version and feeds model governance. It is how a rule that is wrong
        gets found.
      </p>
      <div className="space-y-1">
        {REJECTION_REASONS.map((r) => (
          <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2.5">
            <input
              type="radio"
              name="reject-reason"
              checked={reason === r}
              onChange={() => setReason(r)}
              className="size-4 accent-[var(--color-brand)]"
            />
            <span>{r}</span>
          </label>
        ))}
      </div>
      {reason === 'Other' && (
        <TextArea
          className="mt-3"
          rows={3}
          placeholder="Say what was wrong with it…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      )}
    </Modal>
  )
}

// ───────────────────────────── C-42 Explainability drawer, four fixed panels

/**
 * §4.7 — four panels, identical on every screen. Panel 2 is called out in the
 * atlas as "the panel that earns clinical trust", because every input is
 * clickable back to its source record.
 *
 * Rendered by OverlayHost, driven by the ui store.
 */
export function ExplainPanels({ target }: { target: ExplainTarget }) {
  const spec = capability(target.capabilityId)
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const closeExplain = useUI((s) => s.closeExplain)
  const staff = useCurrentStaff()

  /** Panel 2's promise: every input opens its source record where this build has one. */
  function openSource(label: string, source: string) {
    const route = routeForSource(source)
    if (route) {
      closeExplain()
      navigate(route)
    } else {
      toast({ tone: 'info', title: label, detail: `${source} — the source record is not part of this build.` })
    }
  }

  return (
    <div className="space-y-4 px-5 py-4">
      {/* 1 · What this is */}
      <Card as="div" className="p-4">
        <h3 className="flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
          <span className="flex size-5 items-center justify-center rounded-pill bg-ai-soft text-[0.9em] text-ai">1</span>
          What this is
        </h3>
        <p className="mt-2 leading-relaxed">{target.claim}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Confidence band={target.band as ConfidenceBand} score={target.confidence} />
          <span className="text-[0.86em] text-ink-3">computed {target.computedAt}</span>
        </div>
      </Card>

      {/* 2 · What it used — "the panel that earns clinical trust" */}
      <Card as="div" className="p-4">
        <h3 className="flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
          <span className="flex size-5 items-center justify-center rounded-pill bg-ai-soft text-[0.9em] text-ai">2</span>
          What it used
        </h3>
        <ul className="mt-2 space-y-1.5">
          {target.inputs.map((i) => (
            <li key={`${i.label}-${i.source}`}>
              <button
                type="button"
                onClick={() => openSource(i.label, i.source)}
                className="flex w-full items-start gap-2 rounded-chip px-2 py-1.5 text-left hover:bg-glass-fill-hover"
              >
                <Icon name="CornerDownRight" size={14} className="mt-0.5 shrink-0 text-ink-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block">{i.label}</span>
                  <span className="block text-[0.86em] text-ink-3">{i.source}</span>
                </span>
                <Icon name="ExternalLink" size={13} className="mt-0.5 shrink-0 text-ink-muted" />
              </button>
            </li>
          ))}
          {target.inputs.length === 0 && <li className="text-[0.92em] text-ink-3">No inputs recorded.</li>}
        </ul>
      </Card>

      {/* 3 · Why — drivers with direction and weight, or the retrieved evidence */}
      <Card as="div" className="p-4">
        <h3 className="flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
          <span className="flex size-5 items-center justify-center rounded-pill bg-ai-soft text-[0.9em] text-ai">3</span>
          Why
        </h3>
        {target.drivers && target.drivers.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {target.drivers.map((d) => (
              <li key={d.label}>
                <div className="flex items-center justify-between gap-3 text-[0.95em]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Icon
                      name={d.direction === 'up' ? 'ArrowUp' : 'ArrowDown'}
                      size={13}
                      className={d.direction === 'up' ? 'text-abnormal' : 'text-brand'}
                    />
                    <span className="truncate">{d.label}</span>
                  </span>
                  <span className="tabular shrink-0 text-ink-3">{Math.round(d.weight * 100)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-pill bg-glass-fill-muted">
                  <div className="h-full rounded-pill bg-ai" style={{ width: `${d.weight * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : target.evidence && target.evidence.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-[0.95em]">
            {target.evidence.map((e) => (
              <li key={e} className="flex gap-2">
                <Icon name="Quote" size={13} className="mt-1 shrink-0 text-ink-muted" />
                <span>{e}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[0.92em] text-ink-3">
            No driver breakdown is available for this capability. Never raw feature names — if drivers cannot be stated
            in clinical language, they are not shown.
          </p>
        )}
      </Card>

      {/* 4 · Limits & provenance */}
      <Card as="div" className="p-4">
        <h3 className="flex items-center gap-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
          <span className="flex size-5 items-center justify-center rounded-pill bg-ai-soft text-[0.9em] text-ai">4</span>
          Limits &amp; provenance
        </h3>
        <dl className="mt-2 divide-y divide-glass-hairline">
          <KeyValue label="Capability">
            {spec.id} · {spec.name}
          </KeyValue>
          <KeyValue label="Model">{target.model}</KeyValue>
          <KeyValue label="Maximum gate">
            {spec.gate} {GATE_SPECS[spec.gate].name}
          </KeyValue>
          <KeyValue label="If unavailable">{spec.fallback}</KeyValue>
        </dl>
        <ul className="mt-3 space-y-1.5 text-[0.92em] text-ink-2">
          {target.limits.map((l) => (
            <li key={l} className="flex gap-2">
              <Icon name="Minus" size={13} className="mt-1 shrink-0 text-ink-muted" />
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 rounded-panel bg-caution-soft px-3 py-2 text-[0.9em] font-medium text-caution">
          This is decision support. It is not a diagnosis.
        </p>
        <Button
          tone="tertiary"
          size="sm"
          icon="Flag"
          className="mt-3"
          onClick={() => {
            toast({
              tone: 'success',
              title: 'Reported to model governance',
              detail: `${spec.id} · ${target.model} · by ${staff.name}. The output stays on screen; nothing is changed by reporting it.`,
            })
            closeExplain()
          }}
        >
          Report a problem with this output
        </Button>
      </Card>
    </div>
  )
}

// ────────────────────────────────────────── AIP-01 Inline ghost content

/**
 * §4.3 — "85% opacity, left accent rule in AI-indigo, C-41 action bar beneath.
 * GHOST TEXT SITS IN THE FIELD, NOT IN A SIDE CARD."
 *
 * That last sentence is the whole pitch of deck beat #6, so this component
 * renders the draft inside the editable region rather than beside it.
 */
export function GhostSection({
  touchpointId,
  capabilityId,
  label,
  draft,
  band,
  score,
  gate,
  explain,
  value,
  field,
  onAccept,
  onEdit,
  onReject,
  onUndo,
  /** A LOW section arrives collapsed. */
  defaultExpanded,
  locked,
}: {
  touchpointId: string
  capabilityId: string
  label: string
  /** The AI draft. ABSENT means nothing has been drafted: the section is the clinician's `field`. */
  draft?: string
  band: ConfidenceBand
  score: number
  gate: Gate
  explain: ExplainTarget
  /** The stored text — THE truth of what will be signed. '' when empty. */
  value: string
  /** The one editing surface (a `VoiceField`), rendered in every state but the undecided ghost. */
  field: ReactNode
  /** Accept / Edit write the draft into the store; Reject and Undo write ''. The caller owns the store. */
  onAccept: () => void
  onEdit: () => void
  onReject: () => void
  onUndo: () => void
  defaultExpanded?: boolean
  locked?: boolean
}) {
  const aiEnabled = useAI(selectAiActive)
  const expandedMap = useAI((s) => s.expanded)
  const expand = useAI((s) => s.expand)
  const disposition = useAI((s) => s.dispositions[touchpointId])

  const startsExpanded = defaultExpanded ?? band !== 'LOW'
  const isExpanded = expandedMap[touchpointId] ?? startsExpanded

  // AI-OFF (§1.5) or nothing drafted: the section is the clinician's field.
  if (!aiEnabled || draft === undefined) return <>{field}</>

  /**
   * The ghost shows only while there is nothing of the clinician's to show:
   * undecided (or deferred) AND empty. Once text exists — accepted, edited,
   * dictated or typed — the field is the surface and the draft never returns
   * over it. Clearing an accepted section leaves it empty; it does not resurrect.
   */
  const undecided = disposition === undefined || disposition.disposition === 'Deferred'
  const showGhost = undecided && value.trim() === ''

  return (
    <div className="min-w-0">
      {showGhost ? (
        <>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label htmlFor={touchpointId} className="flex items-center gap-2 text-[0.92em] font-medium text-ink-2">
              {label} <span className="text-abnormal">*</span>
              <Diamond />
              <span className="text-[0.86em] font-normal text-ink-3">AI draft</span>
            </label>
            {band === 'LOW' && !isExpanded && (
              <button
                type="button"
                onClick={() => expand(touchpointId)}
                className="inline-flex items-center gap-1.5 rounded-chip bg-caution-soft px-2 py-1 text-[0.86em] font-medium text-caution"
              >
                <Icon name="ChevronDown" size={13} />
                Expand to review
              </button>
            )}
          </div>
          <div
            id={touchpointId}
            role="region"
            /* Every ◆ region carries the confidence band in its accessible name. */
            aria-label={`${label} — AI draft, ${BAND_SPECS[band].label}`}
            className={cx('ai-ghost rounded-field px-3.5 py-2.5 leading-relaxed', !isExpanded && 'max-h-14 overflow-hidden')}
          >
            {isExpanded ? draft : `${draft.slice(0, 92)}…`}
          </div>
        </>
      ) : (
        field
      )}

      {/* C-41 beneath, never beside. */}
      <AIActionBar
        className="mt-2"
        touchpointId={touchpointId}
        capabilityId={capabilityId}
        gate={gate}
        band={band}
        score={score}
        explain={explain}
        expanded={isExpanded}
        locked={locked}
        onAccept={onAccept}
        onEdit={onEdit}
        onReject={onReject}
        onUndo={onUndo}
      />
    </div>
  )
}

// ──────────────────────────────────────────── AIP-02 Inline field chip

/** "Chip inside the field: ◆ + confidence dot + accept/reject." */
export function FieldChip({
  touchpointId,
  capabilityId,
  suggestion,
  band,
  score,
  gate,
  explain,
  onAccept,
  onUndo,
  disabledReason,
  locked = false,
}: {
  touchpointId: string
  capabilityId: string
  suggestion: string
  band: ConfidenceBand
  score?: number
  gate: Gate
  explain: ExplainTarget
  onAccept: () => void
  /** Called after Undo clears the decision. */
  onUndo?: () => void
  /** Where the suggestion is blocked by a rule — e.g. a parent-only code. */
  disabledReason?: string
  locked?: boolean
}) {
  const aiEnabled = useAI(selectAiActive)
  const staff = useCurrentStaff()
  const record = useAI((s) => s.record)
  const disposition = useAI((s) => s.dispositions[touchpointId])

  if (!aiEnabled) return null

  if (disposition) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Chip tone={disposition.disposition === 'Rejected' ? 'inactive' : 'normal'} icon={disposition.disposition === 'Rejected' ? 'X' : 'Check'}>
          {disposition.disposition}
        </Chip>
        {!locked && (
          <button
            type="button"
            title="Undo the decision"
            onClick={() => {
              useAI.getState().clearDisposition(touchpointId)
              onUndo?.()
            }}
            className="text-[0.86em] text-ink-3 underline decoration-dotted underline-offset-2 hover:text-ink"
          >
            Undo
          </button>
        )}
      </span>
    )
  }

  if (locked) return null

  return (
    <span
      role="region"
      aria-label={`${capabilityId} suggestion: ${suggestion}, ${BAND_SPECS[band].label}`}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-chip border border-ai/25 bg-ai-soft px-2 py-1',
        'text-[0.86em]',
        disabledReason && 'opacity-70',
      )}
    >
      <Diamond size={10} />
      <ConfidenceDot band={band} />
      <span className="font-medium text-ai">{suggestion}</span>
      {disabledReason ? (
        <span title={disabledReason} className="flex items-center gap-1 font-medium text-caution">
          <Icon name="Ban" size={12} /> blocked
        </span>
      ) : (
        <>
          <button
            type="button"
            aria-label={`Accept ${suggestion}`}
            title="Accept"
            onClick={() => {
              record({
                touchpointId,
                disposition: 'Accepted',
                by: staff.name,
                modelVersion: explain.model,
                confidence: band,
              })
              onAccept()
            }}
            className="rounded-pill p-0.5 text-normal hover:bg-normal-soft"
          >
            <Icon name="Check" size={13} />
          </button>
          <button
            type="button"
            aria-label={`Dismiss ${suggestion}`}
            title="Dismiss"
            onClick={() =>
              record({
                touchpointId,
                disposition: 'Rejected',
                by: staff.name,
                modelVersion: explain.model,
                confidence: band,
                reason: 'Not relevant to this patient',
              })
            }
            className="rounded-pill p-0.5 text-ink-3 hover:bg-glass-fill-hover"
          >
            <Icon name="X" size={13} />
          </button>
        </>
      )}
      {gateShowsConfidence(gate) && <WhyLink target={explain} />}
      {score !== undefined && <span className="tabular text-ink-3">{Math.round(score * 100)}%</span>}
    </span>
  )
}

// ──────────────────────────────────────────── AIP-03 Suggestion card

/** "Z6 card, evidence line, per-card accept / edit / dismiss." */
export function SuggestionCard({
  touchpointId,
  capabilityId,
  title,
  evidence,
  band,
  score,
  gate,
  explain,
  onAccept,
  caution,
  children,
}: {
  touchpointId: string
  capabilityId: string
  title: ReactNode
  evidence: string
  band: ConfidenceBand
  score?: number
  gate: Gate
  explain: ExplainTarget
  onAccept?: () => void
  caution?: string
  children?: ReactNode
}) {
  const aiEnabled = useAI(selectAiActive)
  const expandedMap = useAI((s) => s.expanded)
  const expand = useAI((s) => s.expand)
  if (!aiEnabled) return null

  const isExpanded = expandedMap[touchpointId] ?? band !== 'LOW'

  return (
    <Card
      as="article"
      role="region"
      aria-label={`${capabilityId} suggestion, ${BAND_SPECS[band].label}`}
      className="border-l-[3px] border-l-ai p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Diamond />
          <span>{title}</span>
        </h3>
        <span className="shrink-0 text-[0.82em] whitespace-nowrap text-ink-3">{capabilityId}</span>
      </div>

      {band === 'LOW' && !isExpanded ? (
        <button
          type="button"
          onClick={() => expand(touchpointId)}
          className="mt-2 flex w-full items-center gap-2 rounded-panel bg-caution-soft px-3 py-2 text-left text-[0.9em] font-medium text-caution"
        >
          <Icon name="ChevronDown" size={14} />
          Low confidence — expand to read before accepting
        </button>
      ) : (
        <>
          <p className="mt-1.5 text-[0.92em] text-ink-3">{evidence}</p>
          {children && <div className="mt-2">{children}</div>}
          {caution && (
            <p className="mt-2 flex items-start gap-1.5 rounded-panel bg-caution-soft px-2.5 py-1.5 text-[0.88em] text-caution">
              <Icon name="TriangleAlert" size={13} className="mt-0.5 shrink-0" />
              {caution}
            </p>
          )}
        </>
      )}

      <AIActionBar
        className="mt-3"
        touchpointId={touchpointId}
        capabilityId={capabilityId}
        gate={gate}
        band={band}
        score={score}
        explain={explain}
        expanded={isExpanded}
        onAccept={onAccept}
      />
    </Card>
  )
}

// ──────────────────────────────────────────── AIP-05 Banner / strip

/** "Z3 or Z4 full-width strip, severity-coloured, with a Why? link." */
export function AIBanner({
  capabilityId,
  title,
  detail,
  tone = 'caution',
  explain,
  action,
  className,
}: {
  capabilityId: string
  title: ReactNode
  detail?: ReactNode
  tone?: 'info' | 'caution' | 'abnormal' | 'critical' | 'ai' | 'normal'
  explain?: ExplainTarget
  action?: ReactNode
  className?: string
}) {
  const aiEnabled = useAI(selectAiActive)
  if (!aiEnabled) return null

  return (
    <Alert
      tone={tone}
      role="status"
      className={className}
      title={
        <span className="flex items-start gap-2">
          <Diamond className="mt-[0.4em]" />
          {/* One wrapping run of text — as separate flex items the words squeeze into columns at phone width. */}
          <span className="min-w-0">{title}</span>
        </span>
      }
      action={
        <div className="flex items-center gap-2">
          {action}
          {explain && <WhyLink target={explain} />}
        </div>
      }
    >
      {detail}
      <span className="mt-1 block text-[0.86em] opacity-75">{capabilityId}</span>
    </Alert>
  )
}

// ──────────────────────────────────────────── AIP-06 List / row badge

/** "Badge plus band dot, sortable, tooltip on hover AND focus." */
export function RowBadge({
  band,
  label,
  reason,
  tone,
  className,
}: {
  band?: ConfidenceBand
  label: string
  /** The per-row reason chip AIP-06 and AIP-07 both require. */
  reason?: string
  tone?: 'critical' | 'abnormal' | 'caution' | 'normal' | 'neutral' | 'ai'
  className?: string
}) {
  const aiEnabled = useAI(selectAiActive)
  if (!aiEnabled) return null

  return (
    <span className={cx('inline-flex flex-wrap items-center gap-1.5', className)}>
      <Chip tone={tone ?? 'ai'} title={reason}>
        <Diamond size={9} />
        {label}
        {band && <ConfidenceDot band={band} />}
      </Chip>
      {reason && <span className="text-[0.86em] text-ink-3">{reason}</span>}
    </span>
  )
}

// ──────────────────────────────── AIP-07 Ranked list header control

/**
 * "'Sorted by AI acuity ▾' header control plus a per-row reason chip. ALWAYS
 * REVERSIBLE TO A DETERMINISTIC SORT."
 *
 * ARC-01 adds: the current sort is always named, and with the AI off the list
 * reverts to deterministic order "without re-ordering under the user mid-scan."
 */
export function RankedSortControl({
  aiSort,
  onChange,
  aiLabel = 'AI acuity',
  deterministicLabel = 'Chronological',
  capabilityId,
  className,
}: {
  aiSort: boolean
  onChange: (aiSort: boolean) => void
  aiLabel?: string
  deterministicLabel?: string
  capabilityId: string
  className?: string
}) {
  const aiEnabled = useAI(selectAiActive)
  const effective = aiEnabled && aiSort

  return (
    <div className={cx('flex flex-nowrap items-center gap-2', className)}>
      <span className="shrink-0 text-[0.86em] whitespace-nowrap text-ink-3">Sorted by</span>
      <Select
        aria-label="Sort order"
        value={effective ? 'ai' : 'det'}
        onChange={(e) => onChange(e.target.value === 'ai')}
        className="min-h-9 w-auto py-1.5 text-[0.92em]"
      >
        {aiEnabled && <option value="ai">{aiLabel}</option>}
        <option value="det">{deterministicLabel}</option>
      </Select>
      {effective ? (
        <Chip tone="ai" title={`${capabilityId} — the deterministic sort is always one click away`}>
          <Diamond size={9} />
          {capabilityId}
        </Chip>
      ) : (
        <Chip tone="neutral" icon="ListFilter">
          Deterministic
        </Chip>
      )}
    </div>
  )
}

// ──────────────────────────────── AIP-09 Modal gate (the hard stop)

/**
 * "C-31 modal, NOT DISMISSIBLE WITHOUT A DISPOSITION."
 *
 * Used for the penicillin hard stop on S-06-07 — deck beat #8, and the atlas's
 * single most important frame. The block is deterministic: it is a rule, not
 * the model's opinion, and it fires with the AI switched off.
 */
export function HardStopGate({
  open,
  /** What was blocked. */
  drug,
  rule,
  finding,
  documentedAt,
  documentedBy,
  alternatives,
  onAcceptAlternative,
  onOverride,
  onCancel,
  capabilityId,
}: {
  open: boolean
  drug: string
  rule: string
  finding: string
  documentedAt: string
  documentedBy: string
  alternatives: { drug: string; dose: string; route: string; frequency: string; rationale: string; caution?: string }[]
  onAcceptAlternative: (drug: string) => void
  onOverride: () => void
  onCancel: () => void
  capabilityId: string
}) {
  const aiEnabled = useAI(selectAiActive)

  return (
    <Modal
      open={open}
      alert
      /* Not dismissible without a disposition: no Esc, no backdrop, no X. */
      dismissible={false}
      size="lg"
      title={
        <span className="flex items-center gap-2 text-critical">
          <Icon name="OctagonAlert" size={20} />
          Prescription blocked
        </span>
      }
      subtitle={`${rule} · this is a deterministic rule, not a model output`}
      footer={
        <>
          <Button onClick={onCancel} icon="Undo2">
            Remove {drug}
          </Button>
          <Button tone="destructive" icon="ShieldAlert" onClick={onOverride}>
            Override — needs a second consultant
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-panel border border-critical/40 bg-critical-soft px-4 py-3">
          <p className="font-semibold text-critical">{drug} cannot be signed for this patient.</p>
          <p className="mt-1.5 text-[0.95em] text-ink-2">{finding}</p>
          <p className="mt-2 text-[0.88em] text-ink-3">
            Allergy documented {documentedAt} by {documentedBy}.
          </p>
        </div>

        {/*
          The distinction that makes the whole demo work: with the AI off, the
          static tables still block. Safety never depends on the model.
        */}
        <div className="flex items-start gap-2.5 rounded-panel bg-glass-fill-muted px-4 py-3 text-[0.92em] text-ink-2">
          <Icon name="ShieldCheck" size={16} className="mt-0.5 shrink-0 text-brand" />
          <p>
            {aiEnabled ? (
              <>
                <strong>{capabilityId}</strong> surfaced this, but the block itself is a static allergy-class rule. It
                fires identically when the AI is switched off — safety is never gated on a model being up.
              </>
            ) : (
              <>
                The AI is currently off. <strong>This block still fired</strong>, because the static interaction and
                allergy tables are never fully off.
              </>
            )}
          </p>
        </div>

        <div>
          <h3 className="mb-2 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
            Three alternatives with no beta-lactam cross-reactivity
          </h3>
          <ul className="space-y-2">
            {alternatives.map((a) => (
              <li key={a.drug}>
                <div className="glass rounded-panel p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{a.drug}</p>
                      <p className="tabular text-[0.9em] text-ink-3">
                        {a.dose} · {a.route} · {a.frequency}
                      </p>
                    </div>
                    <Button tone="primary" size="sm" icon="Check" onClick={() => onAcceptAlternative(a.drug)}>
                      Use this
                    </Button>
                  </div>
                  <p className="mt-2 text-[0.92em] text-ink-2">{a.rationale}</p>
                  {a.caution && (
                    <p className="mt-2 flex items-start gap-1.5 text-[0.88em] font-medium text-caution">
                      <Icon name="TriangleAlert" size={13} className="mt-0.5 shrink-0" />
                      {a.caution}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

// ──────────────────────────── The G4 dual-signature override dialog

/**
 * §4.4 G4 — "C-31 modal plus second-user authentication; reason mandatory;
 * BOTH identities recorded."
 */
export function DualSignatureGate({
  open,
  what,
  auditEvent,
  prescriber,
  onCancel,
  onConfirm,
  coSignerOptions,
}: {
  open: boolean
  what: string
  auditEvent: string
  prescriber: string
  onCancel: () => void
  onConfirm: (args: { reason: RejectionReason; reasonText: string; coSigner: string }) => void
  coSignerOptions: { name: string; identifier: string }[]
}) {
  const [reason, setReason] = useState<RejectionReason>('Other')
  const [reasonText, setReasonText] = useState('')
  const [coSigner, setCoSigner] = useState('')
  const [pin, setPin] = useState('')
  const [attested, setAttested] = useState(false)

  const ready = reasonText.trim().length >= 10 && coSigner !== '' && pin.length >= 4 && attested

  return (
    <Modal
      open={open}
      alert
      size="md"
      title={
        <span className="flex items-center gap-2 text-critical">
          <Icon name="ShieldAlert" size={20} />
          Dual signature required
        </span>
      }
      subtitle="G4 — a second qualified consultant must authenticate. Both identities are recorded."
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            tone="destructive"
            disabled={!ready}
            icon="Signature"
            onClick={() => onConfirm({ reason, reasonText: reasonText.trim(), coSigner })}
          >
            Override and proceed
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Alert tone="critical" title="You are proceeding past a hard stop">
          {what} This is audited as <code className="font-mono text-[0.9em]">{auditEvent}</code> and reviewed within 24
          hours.
        </Alert>

        <div>
          <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">
            Reason <span className="text-abnormal">*</span>
          </p>
          <Select value={reason} onChange={(e) => setReason(e.target.value as RejectionReason)}>
            {REJECTION_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <TextArea
            className="mt-2"
            rows={3}
            placeholder="State the clinical justification — at least ten characters, and it is read at review…"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">
              Second consultant <span className="text-abnormal">*</span>
            </p>
            <Select value={coSigner} onChange={(e) => setCoSigner(e.target.value)}>
              <option value="">Select a consultant…</option>
              {coSignerOptions
                .filter((c) => c.name !== prescriber)
                .map((c) => (
                  <option key={c.identifier} value={c.name}>
                    {c.name} · {c.identifier}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <p className="mb-1.5 text-[0.92em] font-medium text-ink-2">
              Their authentication <span className="text-abnormal">*</span>
            </p>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="min-h-11 w-full rounded-field border border-glass-hairline bg-glass-fill-strong px-3.5 py-2.5 tracking-[0.3em]"
            />
          </div>
        </div>

        <Checkbox
          checked={attested}
          onChange={setAttested}
          label={
            <>
              We have both reviewed the documented allergy and the alternatives offered, and accept clinical
              responsibility for proceeding. <span className="text-ink-3">Prescriber: {prescriber}</span>
            </>
          }
        />
      </div>
    </Modal>
  )
}

// ─────────────────────────── The assistant signing for a reading it gave

/**
 * An answer that READ something clinical ends here rather than in a full stop.
 *
 * The assistant is allowed to give a view — routing "what are your views on
 * this result?" to a capability id is a non-answer, and clinicians stop asking.
 * But a view is a claim, so it carries the same gate, the same disposition and
 * the same audit event it would carry on the screen that owns it. Agreeing is
 * a signature; disagreeing is recorded, because a disagreement is the artefact
 * model governance actually needs.
 *
 * Shared by the Z7b panel and the full-page assistant so the two cannot drift.
 */
export function AttestStrip({
  attest,
}: {
  attest: NonNullable<import('@/data/assistant').AssistantAnswer['attest']>
}) {
  const disposition = useAI((s) => s.dispositions[attest.touchpointId])
  const record = useAI((s) => s.record)
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)

  if (disposition) {
    const agreed = disposition.disposition === 'Accepted'
    return (
      <p
        className={cx(
          'mt-3 flex flex-wrap items-center gap-2 rounded-panel px-3 py-2 text-[0.88em]',
          agreed ? 'bg-normal-soft text-normal' : 'bg-caution-soft text-caution',
        )}
      >
        <Icon name={agreed ? 'Signature' : 'Undo2'} size={14} className="shrink-0" />
        {agreed ? 'Signed' : 'Recorded as a disagreement'} by {disposition.by}
      </p>
    )
  }

  function act(kind: 'Accepted' | 'Rejected') {
    record({
      touchpointId: attest.touchpointId,
      disposition: kind,
      by: me.name,
      modelVersion: attest.capabilityId,
      confidence: 'HIGH',
    })
    toast({
      tone: kind === 'Accepted' ? 'success' : 'caution',
      title: kind === 'Accepted' ? 'Reading signed' : 'Disagreement recorded',
      detail:
        kind === 'Accepted'
          ? `${attest.claim} — stamped ${me.name} · ${me.identifier}`
          : 'The reading stays in the record with your disagreement beside it.',
    })
  }

  return (
    <div className="mt-3 rounded-panel border border-ai/30 bg-ai-ghost px-3 py-2.5">
      <p className="flex flex-wrap items-center gap-2 text-[0.86em] font-medium text-ink-2">
        <Diamond size={10} />
        {attest.capabilityId} · <GateBadge gate={attest.gate} />
        <span className="min-w-0">needs your signature, not just your click.</span>
      </p>
      <p className="mt-1 text-[0.88em] text-ink-2">{attest.claim}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" tone="primary" icon="Signature" onClick={() => act('Accepted')}>
          Sign for this reading
        </Button>
        <Button size="sm" icon="Undo2" onClick={() => act('Rejected')}>
          I disagree
        </Button>
      </div>
    </div>
  )
}
