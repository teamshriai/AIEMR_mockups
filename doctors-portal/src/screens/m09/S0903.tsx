/**
 * S-09-03 · Active Orders & Status — `/encounter/:id/orders` · T2 · ARC-01
 *
 * "Which orders are actually happening."
 *
 * AI-308 closes the loop: it chases an order that has not moved. The fallback
 * is "a manual order status list", which is exactly what this screen is
 * underneath — the chasing is the addition, not the list.
 *
 * Calm pass: the surface opens on the orders still open, one line each with
 * the chase reason on the line it belongs to. Resulted and earlier orders are
 * one tap away; voided ones stay visible, folded. The explainer is a `Why`.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { Disclosure, ScopeTabs, Why, useScope } from '@/components/calm'
import { ConfirmDialog } from '@/components/overlays'
import { Button, Icon, Select, cx } from '@/components/primitives'
import { VoiceField } from '@/components/voicefield'
import { encounter, ordersFor } from '@/data/clinical'
import type { OrderRow } from '@/data/clinical'
import { formatDate, formatTime, NOW } from '@/data/format'
import { TRANSFER_REASONS, patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

type Scope = 'open' | 'resulted' | 'earlier'
const SCOPES: readonly Scope[] = ['open', 'resulted', 'earlier']

const START_OF_TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())

export function S0903({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const { placedOrders, cancelledOrders, cancelOrder } = useClinical()

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)

  const [aiSort, setAiSort] = useState(true)
  const [cancelling, setCancelling] = useState<OrderRow | null>(null)
  const [reason, setReason] = useState<string>(TRANSFER_REASONS[0])
  const [reasonText, setReasonText] = useState('')
  const [scope, setScope] = useScope(SCOPES, 'open')

  /** Orders placed from the basket this session join the list. */
  const session: OrderRow[] = placedOrders
    .filter((o) => o.patientId === p.id)
    .map((o) => ({
      id: o.id,
      patientId: p.id,
      item: o.item,
      category: 'Lab' as const,
      placedAt: new Date(o.at),
      placedBy: o.by,
      status: 'Ordered' as const,
    }))

  const all = [...session, ...ordersFor(p.id)].map((o) =>
    cancelledOrders[o.id] ? { ...o, status: 'Cancelled' as const } : o,
  )

  const sort = (rows: OrderRow[]) =>
    aiSort
      ? [...rows].sort((a, b) => (b.chase ? 1 : 0) - (a.chase ? 1 : 0) || b.placedAt.getTime() - a.placedAt.getTime())
      : [...rows].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())

  const open = sort(all.filter((o) => o.status !== 'Resulted' && o.status !== 'Cancelled'))
  const resulted = sort(all.filter((o) => o.status === 'Resulted'))
  const earlier = sort(all.filter((o) => o.placedAt.getTime() < START_OF_TODAY.getTime()))
  const voided = sort(all.filter((o) => o.status === 'Cancelled'))
  const chasing = open.filter((o) => o.chase)

  const rows = scope === 'open' ? open : scope === 'resulted' ? resulted : earlier

  const columns: WorklistColumn<OrderRow>[] = [
    {
      key: 'placed',
      label: 'Placed',
      role: 'lead',
      cell: (o) =>
        o.placedAt.getTime() < START_OF_TODAY.getTime() ? formatDate(o.placedAt).replace('-2026', '') : formatTime(o.placedAt),
    },
    { key: 'item', label: 'Order', role: 'primary', cell: (o) => o.item },
    {
      key: 'status',
      label: 'Status',
      role: 'context',
      cell: (o) => (
        <span className={cx(o.status === 'Overdue' && 'font-semibold text-abnormal', o.status === 'Resulted' && 'text-normal')}>
          {o.status === 'Resulted' ? 'Resulted · loop closed' : o.status}
        </span>
      ),
    },
    {
      key: 'chase',
      label: 'Closing the loop',
      role: 'context',
      cell: (o) => (o.chase ? <span className="text-caution">chasing · {o.chase}</span> : null),
    },
    { key: 'by', label: 'By', role: 'context', cell: (o) => o.placedBy },
    {
      key: 'action',
      label: '',
      role: 'status',
      cell: (o) =>
        o.status === 'Resulted' ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              navigate('/results/inbox')
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-brand-soft px-3.5 text-[0.86em] font-semibold text-brand hover:bg-brand hover:text-brand-on"
          >
            Result
            <Icon name="ArrowRight" size={13} />
          </span>
        ) : o.status === 'Cancelled' ? (
          <span className="text-[0.86em] text-ink-3">voided</span>
        ) : (
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation()
              setCancelling(o)
            }}
            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-[0.86em] font-semibold text-ink-2 hover:bg-glass-fill-hover"
          >
            Cancel
          </span>
        ),
    },
  ]

  const tabs = (
    <ScopeTabs
      value={scope}
      onChange={setScope}
      options={[
        { key: 'open', label: 'Open', count: open.length },
        { key: 'resulted', label: 'Resulted', count: resulted.length },
        { key: 'earlier', label: 'Earlier', count: earlier.length },
      ]}
    />
  )

  return (
    <Screen
      screenId="S-09-03"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF']}
      heading="Orders"
      subheading={
        <>
          {open.length} open
          {chasing.length > 0 && ` · ${chasing.length} being chased`}
          {resulted.length > 0 && ` · ${resulted.length} resulted`}
        </>
      }
      actions={
        <Button tone="primary" icon="Plus" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
          New order
        </Button>
      }
    >
      <div className="max-w-4xl space-y-5">
        <Worklist
          rows={rows}
          columns={columns}
          rowKey={(o) => o.id}
          aiSort={aiSort}
          onSortChange={setAiSort}
          sortCapability="AI-308"
          aiSortLabel="Needs chasing first"
          deterministicLabel="Most recent first"
          caption={`Orders on ${enc.encounterNo}`}
          noun="orders"
          emptyWhy={
            scope === 'open'
              ? 'Nothing is open on this encounter. Everything placed has resulted or been voided.'
              : scope === 'resulted'
                ? 'No order on this encounter has resulted yet.'
                : 'No orders were placed on this encounter before today.'
          }
          emptyAction={
            scope === 'open' ? (
              <Button size="sm" tone="primary" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
                Open the order basket
              </Button>
            ) : undefined
          }
          filters={tabs}
        />

        {scope === 'open' && voided.length > 0 && (
          <Disclosure label="voided" count={voided.length}>
            <Worklist
              rows={voided}
              columns={columns}
              rowKey={(o) => o.id}
              caption="Voided orders on this encounter"
              noun="orders"
              emptyWhy="No orders have been voided."
            />
          </Disclosure>
        )}

        <Why label="Why some orders are chased">
          <p className="text-ink-2">
            An order that has not moved inside its expected window is chased, with the blocking step named. Without it
            this screen is still a status list — the chasing is what stops an order quietly going nowhere. AI-308 ·
            the deterministic sort is one click away.
          </p>
        </Why>
      </div>

      <ConfirmDialog
        open={cancelling !== null}
        title={`Cancel ${cancelling?.item}?`}
        consequence="The order is voided, not deleted. It stays visible with your reason recorded against it, and the performing department is notified."
        confirmLabel="Void this order"
        tone="destructive"
        onConfirm={() => {
          if (!cancelling) return
          cancelOrder(cancelling.id, reasonText.trim() || reason)
          toast({ tone: 'info', title: `${cancelling.item} voided`, detail: `Reason recorded: ${reasonText.trim() || reason}` })
          setCancelling(null)
          setReasonText('')
        }}
        onCancel={() => {
          setCancelling(null)
          setReasonText('')
        }}
      >
        <div className="space-y-3">
          <Select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Cancellation reason">
            {['No longer clinically indicated', 'Ordered in error', 'Duplicate of another order', 'Patient declined'].map(
              (r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ),
            )}
          </Select>
          <VoiceField
            id="cancel-order-note"
            label="Anything to add"
            rows={2}
            value={reasonText}
            onChange={setReasonText}
            patientId={p.id}
            placeholder="Anything to add…"
          />
          <p className="flex items-start gap-1.5 text-[0.86em] text-ink-3">
            <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
            A reason is mandatory on cancel, and the record keeps both the order and the void.
          </p>
        </div>
      </ConfirmDialog>
    </Screen>
  )
}
