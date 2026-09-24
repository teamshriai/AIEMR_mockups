/**
 * S-06-10 · Template & Order-Set Manager — `/clinician/templates` · T3 · ARC-18
 *
 * "Order sets and templates — personal, then governed."
 *
 * W-06-4's step 3 is the point of the screen: "facility-wide promotion is a
 * GOVERNANCE ACT with a named owner and a review date." A personal set that is
 * wrong affects your patients; a facility-wide one affects everyone's, so
 * someone has to be accountable for it by name.
 *
 * Calm pass: the default slice is what is due for review, the six-column
 * table becomes rows with the review-due state on the right, and a row's item
 * chips only show once the row is expanded.
 */

import { useState } from 'react'

import { SuggestionCard } from '@/components/ai'
import { CountPill, ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { ConfirmDialog, Modal } from '@/components/overlays'
import { Button, Chip, Field, Icon, Select, TextArea, TextInput, cx } from '@/components/primitives'
import { ORDER_SETS } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { STAFF } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

type Scope = 'due' | 'all'

/** A set is due for review once its review date has passed or falls within 30 days. */
function isDue(reviewDue: string): boolean {
  if (reviewDue === '—') return false
  const d = new Date(reviewDue.replace(/(\d+)-(\w+)-(\d+)/, '$2 $1, $3'))
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() - NOW.getTime() < 30 * 24 * 3_600_000
}

export function S0610() {
  const toast = useUI((s) => s.toast)
  const { promotedSets, promoteSet } = useClinical()

  const [effectiveOn, setEffectiveOn] = useState('2026-09-21')
  const [search, setSearch] = useState('')
  const [scope, setScope] = useScope<Scope>(['due', 'all'], 'due')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [owner, setOwner] = useState('Dr. Vivek Sharma')
  const [reviewDue, setReviewDue] = useState('2027-03-31')
  /** Sets created here, this device only — personal scope until promoted. */
  const [created, setCreated] = useState<(typeof ORDER_SETS)[number][]>([])
  const [creating, setCreating] = useState(false)
  const [newSet, setNewSet] = useState({ name: '', items: '' })

  const allSets = [...ORDER_SETS, ...created].filter(
    (s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()),
  ).map((s) => {
    const promoted = promotedSets[s.id]
    return promoted
      ? { ...s, scope: 'Facility-wide' as const, owner: promoted.owner, reviewDue: promoted.reviewDue }
      : s
  })

  const due = allSets.filter((s) => isDue(s.reviewDue))
  const sets = scope === 'due' ? due : allSets

  const target = ORDER_SETS.find((s) => s.id === promoting)

  return (
    <Screen
      screenId="S-06-10"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF']}
      heading="Templates and order sets"
      subheading={
        <>
          {allSets.length} sets · {due.length} due for review
        </>
      }
      actions={
        <>
          <Field label="" htmlFor="effective-on" className="hidden sm:block">
            <TextInput
              id="effective-on"
              type="date"
              value={effectiveOn}
              onChange={(e) => setEffectiveOn(e.target.value)}
              className="min-h-9 py-1.5 text-[0.9em]"
              aria-label="Effective on"
            />
          </Field>
          <Button tone="primary" icon="Plus" onClick={() => setCreating(true)}>
            New set
          </Button>
        </>
      }
      rail={
        <div className="space-y-4">
          <SuggestionCard
            touchpointId="templates:suggest"
            capabilityId="AI-302"
            title="Add a sputum culture to your CAP set"
            evidence="You have added a sputum culture manually to 11 of your last 14 pneumonia admissions. The facility set does not include it."
            band="MED"
            score={0.78}
            gate="G2"
            explain={{
              touchpointId: 'templates:suggest',
              capabilityId: 'AI-302',
              claim: 'Your local practice diverges from the facility order set on one item.',
              confidence: 0.78,
              band: 'MED',
              computedAt: formatTime(NOW),
              inputs: [
                { label: 'Your last 14 pneumonia admissions', source: 'Order history, 90 days' },
                { label: 'OS.CAP-ADULT contents', source: 'Order set library' },
              ],
              evidence: [
                'Sputum culture added manually in 11 of 14 cases.',
                'Adding it to the set would remove 11 manual steps a quarter.',
              ],
              model: 'orderset-rec v2.0.3',
              limits: [
                'Learns from your ordering, so it will reproduce your habits including the unhelpful ones.',
                'A browsable library is the fallback and is never hidden.',
                'It cannot tell whether a divergence is an improvement or a deviation.',
              ],
            }}
          />
        </div>
      }
      railTitle="Governance"
      railBadge={1}
    >
      <div className="space-y-5">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order sets and templates…"
        />

        <ScopeTabs
          value={scope}
          onChange={setScope}
          ariaLabel="Which sets to show"
          options={[
            { key: 'due', label: 'Due for review', count: due.length },
            { key: 'all', label: 'All', count: allSets.length },
          ]}
        />

        <SectionCard title="Order sets and templates" meta={<CountPill>{sets.length}</CountPill>}>
          {sets.length === 0 ? (
            <p className="px-2 py-4 text-[0.95em] text-ink-2">
              Nothing is due for review. A set&rsquo;s review date passing, or one arriving without one, would put it
              here.
            </p>
          ) : (
            <ul className="divide-y divide-glass-hairline">
              {sets.map((s) => {
                const open = expanded === s.id
                const due = isDue(s.reviewDue)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setExpanded(open ? null : s.id)}
                      className="flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-panel px-2 py-2.5 text-left hover:bg-glass-fill-hover"
                    >
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="tabular block truncate text-[0.86em] text-ink-3">
                          {s.items.length} items · {s.scope} · {s.owner}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {due && (
                          <Chip tone="abnormal" icon="Clock">
                            review due {s.reviewDue}
                          </Chip>
                        )}
                        <span className="tabular text-[0.86em] text-ink-3">{s.usedThisMonth}/mo</span>
                        {s.scope === 'Personal' ? (
                          <span
                            role="button"
                            tabIndex={-1}
                            onClick={(e) => {
                              e.stopPropagation()
                              setPromoting(s.id)
                            }}
                            className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-pill bg-brand px-3 text-[0.86em] font-semibold text-brand-on"
                          >
                            <Icon name="ArrowUp" size={13} />
                            Promote
                          </span>
                        ) : (
                          <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} className="text-ink-3" />
                        )}
                      </span>
                    </button>
                    {open && (
                      <div className={cx('flex flex-wrap gap-1 px-2 pb-3')}>
                        {s.items.map((i) => (
                          <Chip key={i} tone="neutral">
                            {i}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </SectionCard>

        <Why label="Effective dates and governance">
          <p className="text-ink-2">
            Changing a set does not rewrite history. Each version is effective from a date, and an order placed last
            month still shows the set as it was then.
          </p>
          <p className="text-ink-2">
            A personal set is yours to change freely. A facility-wide one needs a named owner and a review date,
            because it changes what everyone else orders — which is why promotion asks for both.
          </p>
        </Why>
      </div>

      <ConfirmDialog
        open={promoting !== null}
        title="Promote to facility-wide?"
        consequence={`"${target?.name}" would become available to every clinician at this facility. That is a governance act: it acquires a named owner who is accountable for its contents, and a review date after which it must be re-approved.`}
        confirmLabel="Promote with an owner"
        onConfirm={() => {
          if (!promoting) return
          promoteSet(promoting, owner, reviewDue)
          toast({
            tone: 'success',
            title: 'Promoted to facility-wide',
            detail: `Owner ${owner} · review due ${reviewDue}. Recorded as a governance act.`,
          })
          setPromoting(null)
        }}
        onCancel={() => setPromoting(null)}
      >
        <div className="space-y-3">
          <Field label="Accountable owner" required htmlFor="set-owner">
            <Select id="set-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
              {STAFF.filter((s) => s.identifierKind === 'HPR').map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} · {s.personaLabel}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Review due" required htmlFor="set-review">
            <TextInput id="set-review" type="date" value={reviewDue} onChange={(e) => setReviewDue(e.target.value)} />
          </Field>
          <p className="flex items-start gap-2 text-[0.88em] text-ink-3">
            <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
            Your own version stays available as a personal set. Promotion copies it; it does not move it.
          </p>
        </div>
      </ConfirmDialog>
      <Modal
        open={creating}
        size="sm"
        title="New order set"
        subtitle="Personal scope. Promote it to facility-wide from the list once it has an owner and a review date."
        onClose={() => setCreating(false)}
        footer={
          <>
            <Button icon="X" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              tone="primary"
              icon="Check"
              disabled={newSet.name.trim().length < 3 || newSet.items.split(/\n|,/).filter((i) => i.trim()).length === 0}
              onClick={() => {
                const items = newSet.items.split(/\n|,/).map((i) => i.trim()).filter(Boolean)
                setCreated((c) => [
                  ...c,
                  { id: `OS.NEW-${c.length + 1}`, name: newSet.name.trim(), scope: 'Personal' as const, owner: 'Dr. Ananya Iyer', reviewDue: '31-Mar-2027', items, usedThisMonth: 0 },
                ])
                setCreating(false)
                setNewSet({ name: '', items: '' })
                toast({ tone: 'success', title: 'Order set created', detail: `${newSet.name.trim()} · ${items.length} ${items.length === 1 ? 'item' : 'items'} · personal scope.` })
              }}
            >
              Create set
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Name" required htmlFor="new-set-name">
            <TextInput id="new-set-name" value={newSet.name} onChange={(e) => setNewSet((d) => ({ ...d, name: e.target.value }))} placeholder="Acute asthma — adult" autoFocus />
          </Field>
          <Field label="Items" required htmlFor="new-set-items" hint="One per line, or comma-separated">
            <TextArea id="new-set-items" rows={5} value={newSet.items} onChange={(e) => setNewSet((d) => ({ ...d, items: e.target.value }))} placeholder={'CBC\nCRP\nChest X-ray PA'} />
          </Field>
        </div>
      </Modal>
    </Screen>
  )
}
