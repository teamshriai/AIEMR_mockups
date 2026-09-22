/**
 * S-09-01 · Order Entry / Basket — `/encounter/:id/orders/new` · T2 · ARC-07
 *
 * "One basket for everything a clinician can order."
 *
 * AI-301 proposes orders from context (AIP-03, G2) and AI-304 flags the
 * duplicate before it is placed rather than after — "retrospective stewardship
 * review" is the fallback, and catching it at the basket is the point.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, SuggestionCard } from '@/components/ai'
import {
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Icon,
  Select,
  TextInput,
  cx,
} from '@/components/primitives'
import { ORDERS, ORDER_SETS, ORDER_SUGGESTIONS, encounter, ordersFor } from '@/data/clinical'
import { formatDateTime, formatTime, NOW } from '@/data/format'
import { TESTS, patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'
import { useClinical } from '@/store/clinical'
import { useCurrentStaff } from '@/store/session'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

interface BasketItem {
  id: string
  item: string
  priority: 'Routine' | 'Urgent' | 'Stat'
  /** AI-304's duplicate warning, computed against existing orders. */
  duplicateOf?: { id: string; placedAt: Date; reason: string }
}

export function S0901({ id }: { id?: string }) {
  const navigate = useNavigate()
  const me = useCurrentStaff()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const placeOrders = useClinical((s) => s.placeOrders)

  const enc = encounter(id ?? 'E-118366')
  const p = patient(enc.patientId)
  const existing = ordersFor(p.id)

  const [search, setSearch] = useState('')
  const [basket, setBasket] = useState<BasketItem[]>([])

  const matches = search.trim()
    ? TESTS.filter((t) => t.toLowerCase().includes(search.trim().toLowerCase()))
    : TESTS.slice(0, 6)

  /** AI-304, at the moment of adding rather than at audit. */
  function duplicateCheck(item: string) {
    const prior = existing.find((o) => o.item === item && o.status === 'Resulted')
    if (!prior) return undefined
    const hours = (NOW.getTime() - prior.placedAt.getTime()) / 3_600_000
    if (hours > 24) return undefined
    const flagged = ORDERS.find((o) => o.item === item && o.duplicateReason)
    return {
      id: prior.id,
      placedAt: prior.placedAt,
      reason:
        flagged?.duplicateReason ??
        `${item} was resulted ${Math.round(hours)} hours ago. A repeat inside 24 hours rarely changes management on this trajectory.`,
    }
  }

  function add(item: string) {
    if (basket.some((b) => b.item === item)) return
    setBasket((b) => [
      ...b,
      { id: `B-${b.length + 1}`, item, priority: 'Routine', duplicateOf: aiActive ? duplicateCheck(item) : undefined },
    ])
    setSearch('')
  }

  function applySet(setId: string) {
    const set = ORDER_SETS.find((s) => s.id === setId)
    if (!set) return
    const fresh = set.items.filter((i) => !basket.some((b) => b.item === i))
    setBasket((b) => [
      ...b,
      ...fresh.map((item, i) => ({
        id: `B-${b.length + i + 1}`,
        item,
        priority: 'Routine' as const,
        duplicateOf: aiActive ? duplicateCheck(item) : undefined,
      })),
    ])
    toast({ tone: 'info', title: `${set.name} applied`, detail: `${fresh.length} orders added to the basket.` })
  }

  const duplicates = basket.filter((b) => b.duplicateOf)

  return (
    <Screen
      screenId="S-09-01"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      chips={<Chip tone="neutral">{basket.length} in the basket</Chip>}
      rail={
        <div className="space-y-4">
          {aiActive &&
            ORDER_SUGGESTIONS.map((s, i) => (
              <SuggestionCard
                key={s.item}
                touchpointId={`${enc.id}:order-sug-${i}`}
                capabilityId="AI-301"
                title={s.item}
                evidence={s.evidence}
                band={s.band}
                score={s.confidence}
                gate="G2"
                onAccept={() => add(s.item)}
                explain={{
                  touchpointId: `${enc.id}:order-sug-${i}`,
                  capabilityId: 'AI-301',
                  claim: `${s.item} is suggested from the current clinical picture.`,
                  confidence: s.confidence,
                  band: s.band,
                  computedAt: formatTime(NOW),
                  inputs: [
                    { label: 'Recent results', source: 'Results, last 72 hours' },
                    { label: 'Charted vitals', source: 'Flowsheet, most recent set' },
                    { label: 'Active problem list', source: `Problems for ${p.id}` },
                  ],
                  evidence: [s.evidence],
                  model: 'order-sug v3.0.2',
                  limits: [
                    'Suggests from the structured record; it does not examine the patient.',
                    'Manual order search is always available.',
                    'It does not know your local turnaround times, so urgency is yours to set.',
                  ],
                }}
              />
            ))}
        </div>
      }
      railTitle="Suggestions"
      actionBar={
        <>
          <Button icon="ArrowLeft" onClick={() => navigate(`/encounter/${enc.id}/orders`)}>
            Active orders
          </Button>
          <span className="text-[0.88em] text-ink-3">
            {basket.length} {basket.length === 1 ? 'order' : 'orders'}
            {duplicates.length > 0 && ` · ${duplicates.length} flagged as duplicate`}
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Send"
            disabled={basket.length === 0}
            onClick={() => {
              placeOrders(
                basket.map((b) => ({ id: b.id, item: b.item })),
                p.id,
                me.name,
              )
              toast({
                tone: 'success',
                title: `${basket.length} orders placed`,
                detail: 'They appear on the active orders screen and in the performing department queue.',
              })
              setBasket([])
              navigate(`/encounter/${enc.id}/orders`)
            }}
          >
            Place {basket.length > 0 ? basket.length : ''} orders
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {duplicates.length > 0 && (
          <Alert tone="caution" title={`${duplicates.length} order may be unnecessary`}>
            AI-304 has flagged a repeat. This is a suggestion at G2, not a block — you can place it anyway, and
            rejecting the flag needs a reason so the stewardship team learns where the rule is wrong.
          </Alert>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Z5a — catalogue and order sets. */}
          <ScreenSection title="What to order">
            <Card className="p-4">
              <TextInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches[0]) {
                    e.preventDefault()
                    add(matches[0])
                  }
                }}
                placeholder="Search tests, imaging and procedures…"
              />
              <ul className="mt-3 space-y-1">
                {matches.map((t) => {
                  const dup = duplicateCheck(t)
                  return (
                    <li key={t}>
                      <button
                        type="button"
                        onClick={() => add(t)}
                        disabled={basket.some((b) => b.item === t)}
                        className="flex w-full min-h-11 items-center gap-2.5 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover disabled:opacity-45"
                      >
                        <Icon name="Plus" size={14} className="shrink-0 text-ink-3" />
                        <span className="min-w-0 flex-1 truncate">{t}</span>
                        {dup && aiActive && (
                          <Chip tone="caution" icon="TriangleAlert">
                            <Diamond size={9} />
                            recent
                          </Chip>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>

              <h3 className="mt-5 text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Order sets</h3>
              <ul className="mt-2 space-y-1.5">
                {ORDER_SETS.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => applySet(s.id)}
                      className="flex w-full min-h-11 items-center gap-2.5 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover"
                    >
                      <Icon name="Layers" size={14} className="shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block text-[0.84em] text-ink-3">
                          {s.items.length} items · {s.scope.toLowerCase()} · owner {s.owner}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </ScreenSection>

          {/* Z5b — the basket. */}
          <ScreenSection title="Basket" subtitle="Enter adds · the basket is never submitted by Enter">
            {basket.length === 0 ? (
              <Card>
                <EmptyState
                  icon="ClipboardList"
                  why="The basket is empty. Search on the left, apply an order set, or accept one of the suggestions in the rail."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <ul className="divide-y divide-glass-hairline">
                  {basket.map((b) => (
                    <li key={b.id} className={cx('px-4 py-3', b.duplicateOf && 'bg-caution-soft/40')}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 font-medium">{b.item}</p>
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={b.priority}
                            aria-label={`Priority for ${b.item}`}
                            onChange={(e) =>
                              setBasket((items) =>
                                items.map((x) =>
                                  x.id === b.id ? { ...x, priority: e.target.value as BasketItem['priority'] } : x,
                                ),
                              )
                            }
                            className="min-h-9 w-auto py-1 text-[0.88em]"
                          >
                            <option>Routine</option>
                            <option>Urgent</option>
                            <option>Stat</option>
                          </Select>
                          <Button
                            size="sm"
                            tone="tertiary"
                            icon="Trash2"
                            onClick={() => setBasket((items) => items.filter((x) => x.id !== b.id))}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                      {b.duplicateOf && (
                        <div className="mt-2 rounded-panel bg-caution-soft px-3 py-2">
                          <p className="flex items-center gap-2 text-[0.88em] font-semibold text-caution">
                            <Diamond size={10} />
                            AI-304 · possible duplicate
                          </p>
                          <p className="mt-1 text-[0.9em] text-ink-2">{b.duplicateOf.reason}</p>
                          <p className="tabular mt-1 text-[0.84em] text-ink-3">
                            Prior order {b.duplicateOf.id} · {formatDateTime(b.duplicateOf.placedAt)}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              onClick={() => setBasket((items) => items.filter((x) => x.id !== b.id))}
                            >
                              Remove it
                            </Button>
                            <Button
                              size="sm"
                              tone="tertiary"
                              onClick={() =>
                                setBasket((items) =>
                                  items.map((x) => (x.id === b.id ? { ...x, duplicateOf: undefined } : x)),
                                )
                              }
                            >
                              Order anyway
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </ScreenSection>
        </div>
      </div>
    </Screen>
  )
}
