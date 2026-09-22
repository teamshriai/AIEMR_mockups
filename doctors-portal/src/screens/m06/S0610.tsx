/**
 * S-06-10 · Template & Order-Set Manager — `/clinician/templates` · T3 · ARC-18
 *
 * "Order sets and templates — personal, then governed."
 *
 * W-06-4's step 3 is the point of the screen: "facility-wide promotion is a
 * GOVERNANCE ACT with a named owner and a review date." A personal set that is
 * wrong affects your patients; a facility-wide one affects everyone's, so
 * someone has to be accountable for it by name.
 */

import { useState } from 'react'

import { SuggestionCard } from '@/components/ai'
import { ConfirmDialog } from '@/components/overlays'
import {
  Alert,
  Button,
  Card,
  Chip,
  Field,
  Icon,
  Select,
  Table,
  Td,
  Th,
  TextInput,
  Tr,
  cx,
} from '@/components/primitives'
import { ORDER_SETS } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { STAFF } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

export function S0610() {
  const toast = useUI((s) => s.toast)
  const { promotedSets, promoteSet } = useClinical()

  const [effectiveOn, setEffectiveOn] = useState('2026-09-21')
  const [search, setSearch] = useState('')
  const [promoting, setPromoting] = useState<string | null>(null)
  const [owner, setOwner] = useState('Dr Vivek Sharma')
  const [reviewDue, setReviewDue] = useState('2027-03-31')

  const sets = ORDER_SETS.filter(
    (s) => !search.trim() || s.name.toLowerCase().includes(search.trim().toLowerCase()),
  ).map((s) => {
    const promoted = promotedSets[s.id]
    return promoted
      ? { ...s, scope: 'Facility-wide' as const, owner: promoted.owner, reviewDue: promoted.reviewDue }
      : s
  })

  const target = ORDER_SETS.find((s) => s.id === promoting)

  return (
    <Screen
      screenId="S-06-10"
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF']}
      chips={<Chip tone="neutral">{sets.length} sets</Chip>}
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
          <Button tone="primary" icon="Plus">
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

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Why promotion differs</h3>
            <p className="mt-1.5 text-[0.9em] text-ink-2">
              A personal set is yours to change freely. A facility-wide one needs a named owner and a review date,
              because it changes what everyone else orders.
            </p>
          </Card>
        </div>
      }
      railTitle="Governance"
    >
      <div className="space-y-5">
        <Alert tone="info" title="Effective-dated">
          Changing a set does not rewrite history. Each version is effective from a date, and an order placed last month
          still shows the set as it was then.
        </Alert>

        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order sets and templates…"
        />

        <Card className="overflow-hidden">
          <Table
            caption="Order sets and templates"
            rowCount={`${sets.length} sets · effective on ${effectiveOn}`}
            head={
              <>
                <Th>Set</Th>
                <Th>Scope</Th>
                <Th className="hidden md:table-cell">Owner</Th>
                <Th className="hidden md:table-cell">Review due</Th>
                <Th>Used this month</Th>
                <Th className="text-right">Action</Th>
              </>
            }
          >
            {sets.map((s) => (
              <Tr key={s.id} className={cx(promotedSets[s.id] && 'bg-normal-soft/40')}>
                <Td>
                  <span className="block font-medium">{s.name}</span>
                  <span className="tabular block text-[0.86em] text-ink-3">{s.id}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {s.items.slice(0, 4).map((i) => (
                      <Chip key={i} tone="neutral">
                        {i}
                      </Chip>
                    ))}
                    {s.items.length > 4 && <Chip tone="neutral">+{s.items.length - 4}</Chip>}
                  </span>
                </Td>
                <Td>
                  <Chip tone={s.scope === 'Facility-wide' ? 'brand' : 'neutral'} icon={s.scope === 'Facility-wide' ? 'Building2' : 'User'}>
                    {s.scope}
                  </Chip>
                </Td>
                <Td className="hidden md:table-cell">{s.owner}</Td>
                <Td className="tabular hidden md:table-cell">{s.reviewDue}</Td>
                <Td className="tabular">{s.usedThisMonth}</Td>
                <Td className="text-right">
                  {s.scope === 'Personal' ? (
                    <Button size="sm" icon="ArrowUp" onClick={() => setPromoting(s.id)}>
                      Promote
                    </Button>
                  ) : (
                    <Button size="sm" tone="tertiary" icon="Pencil">
                      Edit
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Table>
        </Card>
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
    </Screen>
  )
}
