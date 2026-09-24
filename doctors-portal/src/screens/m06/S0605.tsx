/**
 * S-06-05 · Problem List & Diagnosis Coding — `/encounter/:id/problems` · T2 · ARC-15
 *
 * "The problem list, coded properly the first time."
 *
 * Two AI touchpoints with opposite jobs:
 *   AI-501 proposes a code and BLOCKS PARENT-ONLY ONES. Manual search never
 *   goes away.
 *   AI-204 checks the other direction — whether the charted evidence actually
 *   supports the diagnosis someone has coded. It flags; the coder review
 *   downstream is the fallback.
 *
 * Calm pass: the list is one row per problem with the decision on the right;
 * "flags, does not block" is said once, in the alert; the refusal rationale
 * for parent codes is behind a Why beside the search that would hit it.
 */

import { useState } from 'react'

import { FieldGroup } from '@/archetypes'
import { FieldChip, SuggestionCard } from '@/components/ai'
import { CountPill, SectionCard, Why } from '@/components/calm'
import { Alert, Button, Chip, Field, Icon, TextInput, cx } from '@/components/primitives'
import { CODE_SUGGESTIONS, encounter, problemsFor } from '@/data/clinical'
import { DIAGNOSES } from '@/data/kit'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useUI } from '@/store/ui'
import { Screen } from '@/shell/Screen'

import { encounterLabel } from '../shared/NoteAuthoring'

export function S0605({ id }: { id?: string }) {
  const enc = encounter(id ?? 'E-118402')
  const p = patient(enc.patientId)
  const toast = useUI((s) => s.toast)

  const [search, setSearch] = useState('')
  const [confirmed, setConfirmed] = useState<string[]>([])

  const problems = problemsFor(p.id)
  const flagged = problems.filter((pr) => pr.consistencyFlag)
  const confirm = (id: string) => setConfirmed((c) => [...new Set([...c, id])])

  const matches = search.trim()
    ? DIAGNOSES.filter(
        (d) =>
          d.label.toLowerCase().includes(search.trim().toLowerCase()) ||
          d.icd10.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : []

  const rail =
    flagged.length > 0 ? (
      <div className="space-y-4">
        {flagged.map((pr) => (
          <SuggestionCard
            key={pr.id}
            touchpointId={`${enc.id}:consistency:${pr.id}`}
            capabilityId="AI-204"
            title={`${pr.label} may not be supported`}
            evidence={pr.consistencyFlag!}
            band={pr.band ?? 'MED'}
            score={pr.confidence}
            gate="G1"
            explain={{
              touchpointId: `${enc.id}:consistency:${pr.id}`,
              capabilityId: 'AI-204',
              claim: `The charted evidence does not clearly support ${pr.label} (${pr.icd10}).`,
              confidence: pr.confidence ?? 0.6,
              band: pr.band ?? 'MED',
              computedAt: formatTime(NOW),
              inputs: [
                { label: 'Charted vitals and flowsheet', source: 'Flowsheet, last 24h' },
                { label: 'Laboratory results', source: 'Results, last 48h' },
                { label: 'Coding rule for this diagnosis', source: 'ICD-10 coding guidance' },
              ],
              evidence: [pr.consistencyFlag!],
              model: 'dx-consistency v1.6.2',
              limits: [
                'Checks whether the charted evidence supports the code, not whether the diagnosis is right.',
                'A missing observation looks the same as an absent finding to this check.',
                'The coder review queue catches what this misses.',
              ],
            }}
          />
        ))}
      </div>
    ) : undefined

  return (
    <Screen
      screenId="S-06-05"
      patient={p}
      loadingShape="form"
      states={['LOADING', 'EMPTY', 'ERROR', 'VALIDATION', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'SAVING', 'LOCKED', 'AI-OFF', 'AI-ABSTAIN', 'AI-LOW']}
      heading="Problems and coding"
      subheading={
        <>
          {problems.length} {problems.length === 1 ? 'problem' : 'problems'} · {confirmed.length} confirmed
          {flagged.length > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-caution">
                {flagged.length} {flagged.length === 1 ? 'needs' : 'need'} evidence
              </span>
            </>
          )}
        </>
      }
      chips={<Chip tone="neutral" className="tabular">{enc.encounterNo}</Chip>}
      rail={rail}
      railTitle="Checks"
      railBadge={flagged.length > 0 ? flagged.length : undefined}
      actionBar={
        <>
          <span className="text-[0.88em] text-ink-3">
            {confirmed.length} of {problems.length} confirmed
          </span>
          <Button
            tone="primary"
            className="ml-auto"
            icon="Check"
            disabled={confirmed.length < problems.length}
            onClick={() => toast({ tone: 'success', title: 'Problem list confirmed' })}
          >
            Confirm the problem list
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* The one place "flags, does not block" is said. */}
        {flagged.length > 0 && (
          <Alert tone="caution" title={`${flagged.length} coded ${flagged.length === 1 ? 'problem needs' : 'problems need'} evidence`}>
            The supporting evidence is not charted. Coding it anyway is permitted — the flag is a prompt, not a block —
            but it will surface again at coder review.
          </Alert>
        )}

        <SectionCard title="Problem list" meta={<CountPill>{problems.length}</CountPill>}>
          <ul className="divide-y divide-glass-hairline">
            {problems.map((pr) => {
              const isConfirmed = confirmed.includes(pr.id)
              return (
                <li
                  key={pr.id}
                  className={cx(
                    'flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 rounded-panel px-2 py-2',
                    pr.consistencyFlag && 'bg-caution-soft/40',
                  )}
                >
                  <span className="min-w-0 flex-1 basis-48">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {pr.label}
                      {pr.consistencyFlag && (
                        <Chip tone="caution" icon="TriangleAlert">
                          evidence
                        </Chip>
                      )}
                    </span>
                    <span className="tabular block text-[0.86em] text-ink-3">
                      onset {pr.onset} · {pr.icd10} · SNOMED {pr.snomed}
                    </span>
                  </span>

                  <span className="flex flex-wrap items-center justify-end gap-1.5">
                    {pr.leaf ? (
                      <Chip tone="normal" icon="Check">
                        leaf
                      </Chip>
                    ) : (
                      <Chip tone="abnormal" icon="Ban">
                        parent
                      </Chip>
                    )}
                    {pr.aiSuggested ? (
                      <FieldChip
                        touchpointId={`${enc.id}:code:${pr.id}`}
                        capabilityId="AI-501"
                        suggestion={pr.icd10}
                        band={pr.band ?? 'HIGH'}
                        score={pr.confidence}
                        gate="G2"
                        onAccept={() => confirm(pr.id)}
                        explain={{
                          touchpointId: `${enc.id}:code:${pr.id}`,
                          capabilityId: 'AI-501',
                          claim: `${pr.icd10} is the most specific code supported for ${pr.label}.`,
                          confidence: pr.confidence ?? 0.85,
                          band: pr.band ?? 'HIGH',
                          computedAt: formatTime(NOW),
                          inputs: [
                            { label: `Problem: ${pr.label}`, source: `SNOMED ${pr.snomed}` },
                            { label: 'Note assessment section', source: encounterLabel(enc) },
                          ],
                          evidence: ['Leaf codes only; parent categories are blocked at the field.'],
                          model: 'code-assist v3.2.0',
                          limits: [
                            'Suggests from the note and the problem list.',
                            'Does not apply reimbursement optimisation.',
                            'Manual ICD-10 search is always available.',
                          ],
                        }}
                      />
                    ) : (
                      <Chip tone="neutral" icon="Pencil">
                        coded manually
                      </Chip>
                    )}
                    <Button
                      size="sm"
                      tone={isConfirmed ? 'secondary' : 'primary'}
                      icon={isConfirmed ? 'Check' : undefined}
                      onClick={() => confirm(pr.id)}
                    >
                      {isConfirmed ? 'Confirmed' : 'Confirm'}
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
        </SectionCard>

        <FieldGroup title="Add a problem" hint="Search SNOMED and ICD-10">
          <Field label="Search" htmlFor="dx-search">
            <TextInput
              id="dx-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="pneumonia · J18.9 · stroke…"
            />
          </Field>
          {matches.length > 0 && (
            <ul className="space-y-1.5">
              {matches.map((d) => (
                <li key={d.icd10}>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      toast({ tone: 'success', title: `${d.label} added`, detail: `Coded ${d.icd10}` })
                    }}
                    className="flex w-full min-h-11 items-center gap-2.5 rounded-panel px-3 py-2 text-left hover:bg-glass-fill-hover"
                  >
                    <Icon name="Plus" size={14} className="shrink-0 text-ink-3" />
                    <span className="min-w-0 flex-1 truncate">{d.label}</span>
                    <Chip tone="neutral" className="tabular">
                      {d.icd10}
                    </Chip>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* AI-501's rule and its worked example, folded together. */}
          <Why label="Why a parent code is refused">
            <p className="text-ink-2">
              A parent category will not group for a claim and will not satisfy a coder audit, so the field refuses it
              and says why. The suggestion list shows both, so the refusal is legible rather than mysterious. The
              manual path is never removed.
            </p>
            <ul className="space-y-2">
              {CODE_SUGGESTIONS.map((s) => (
                <li
                  key={s.icd10}
                  className={cx(
                    'flex flex-wrap items-center justify-between gap-2 rounded-panel px-3 py-2.5',
                    s.leaf ? 'bg-glass-fill-muted' : 'bg-abnormal-soft',
                  )}
                >
                  <span className="min-w-0">
                    <span className="tabular font-medium">{s.icd10}</span>
                    <span className="ml-2 text-[0.92em] text-ink-2">{s.label}</span>
                  </span>
                  {s.leaf ? (
                    <Chip tone="normal" icon="Check">
                      selectable
                    </Chip>
                  ) : (
                    <Chip tone="abnormal" icon="Ban">
                      parent-only — blocked
                    </Chip>
                  )}
                </li>
              ))}
            </ul>
          </Why>
        </FieldGroup>
      </div>
    </Screen>
  )
}
