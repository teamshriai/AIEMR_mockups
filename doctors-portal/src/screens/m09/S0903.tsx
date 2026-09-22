/**
 * S-09-03 · Active Orders & Status — `/encounter/:id/orders` · T2 · ARC-01
 *
 * "Which orders are actually happening."
 *
 * AI-308 closes the loop: it chases an order that has not moved. The fallback
 * is "a manual order status list", which is exactly what this screen is
 * underneath — the chasing is the addition, not the list.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Worklist } from '@/archetypes'
import type { WorklistColumn } from '@/archetypes'
import { Diamond, RowBadge } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import { Button, Card, Chip, Icon, Select, TextArea } from '@/components/primitives'
import { encounter, ordersFor } from '@/data/clinical'
import type { OrderRow } from '@/data/clinical'
import { formatDateTime, formatElapsed, NOW } from '@/data/format'
import { TRANSFER_REASONS, patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

const STATUS_TONE: Record<OrderRow['status'], 'neutral' | 'normal' | 'caution' | 'abnormal' | 'inactive'> = {
  Ordered: 'neutral',
  Collected: 'neutral',
  'In progress': 'caution',
  Resulted: 'normal',
  Cancelled: 'inactive',
  Overdue: 'abnormal',
}

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

  const ordered = aiSort
    ? [...all].sort((a, b) => (b.chase ? 1 : 0) - (a.chase ? 1 : 0) || b.placedAt.getTime() - a.placedAt.getTime())
    : [...all].sort((a, b) => b.placedAt.getTime() - a.placedAt.getTime())

  const chasing = all.filter((o) => o.chase)

  const columns: WorklistColumn<OrderRow>[] = [
    { key: 'item', label: 'Order', cell: (o) => <span className="font-medium">{o.item}</span> },
    { key: 'category', label: 'Category', cell: (o) => <Chip tone="neutral">{o.category}</Chip> },
    {
      key: 'status',
      label: 'Status',
      cell: (o) => (
        <Chip tone={STATUS_TONE[o.status]} icon={o.status === 'Resulted' ? 'Check' : o.status === 'Overdue' ? 'TriangleAlert' : undefined}>
          {o.status}
        </Chip>
      ),
    },
    {
      key: 'chase',
      label: 'Closing the loop',
      secondary: true,
      cell: (o) =>
        o.chase ? (
          <RowBadge label="Chasing" reason={o.chase} tone="caution" band="HIGH" />
        ) : o.status === 'Resulted' ? (
          <span className="text-[0.88em] text-normal">loop closed</span>
        ) : (
          <span className="text-[0.88em] text-ink-3">on track</span>
        ),
    },
    {
      key: 'placed',
      label: 'Placed',
      cell: (o) => (
        <span className="block">
          <span className="tabular block text-[0.9em]">{formatDateTime(o.placedAt)}</span>
          <span className="tabular block text-[0.84em] text-ink-3">
            {formatElapsed((NOW.getTime() - o.placedAt.getTime()) / 60000)} ago · {o.placedBy}
          </span>
        </span>
      ),
    },
    {
      key: 'action',
      label: '',
      className: 'text-right',
      cell: (o) =>
        o.status === 'Resulted' ? (
          <Button size="sm" icon="ArrowRight" onClick={(e) => { e.stopPropagation(); navigate('/results/inbox') }}>
            Result
          </Button>
        ) : o.status === 'Cancelled' ? (
          <span className="text-[0.86em] text-ink-3">voided</span>
        ) : (
          <Button
            size="sm"
            tone="tertiary"
            icon="X"
            onClick={(e) => {
              e.stopPropagation()
              setCancelling(o)
            }}
          >
            Cancel
          </Button>
        ),
    },
  ]

  return (
    <Screen
      screenId="S-09-03"
      patient={p}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF']}
      chips={<Chip tone="neutral" className="tabular">{enc.encounterNo}</Chip>}
      actions={
        <Button tone="primary" icon="Plus" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
          New order
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
              <Diamond size={10} />
              AI-308 · closed-loop chasing
            </p>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              An order that has not moved inside its expected window is chased, with the blocking step named. Without
              it this screen is still a status list — the chasing is what stops an order quietly going nowhere.
            </p>
          </Card>
          {chasing.length > 0 && (
            <Card className="border-l-[3px] border-l-caution p-4">
              <h3 className="text-[0.82em] font-semibold tracking-wide text-caution uppercase">
                {chasing.length} being chased
              </h3>
              <ul className="mt-2 space-y-2.5">
                {chasing.map((o) => (
                  <li key={o.id}>
                    <p className="font-medium">{o.item}</p>
                    <p className="text-[0.88em] text-ink-2">{o.chase}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      }
      railTitle="Order flow"
    >
      <Worklist
        rows={ordered}
        columns={columns}
        rowKey={(o) => o.id}
        aiSort={aiSort}
        onSortChange={setAiSort}
        sortCapability="AI-308"
        aiSortLabel="Needs chasing first"
        deterministicLabel="Most recent first"
        caption="Orders on this encounter"
        emptyWhy="No orders on this encounter yet. Placing one from the basket, or applying an order set, would fill this."
        emptyAction={
          <Button size="sm" tone="primary" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
            Open the order basket
          </Button>
        }
        filters={
          <>
            <Chip tone="neutral" icon="User">
              {p.name}
            </Chip>
            <Chip tone="neutral" icon="Clock">
              as of 08:40
            </Chip>
          </>
        }
      />

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
          <TextArea
            rows={2}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
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
