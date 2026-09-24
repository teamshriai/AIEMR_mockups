/**
 * A scaffold frame for a screen whose Z5 is not yet built.
 *
 * The shell around it is real, so a route is never a blank page and the
 * atlas's completeness assertion has something to reconcile against. What a
 * doctor sees is one sentence; the registry row and the AI touchpoints are
 * specification material, so they sit behind the same `Why` disclosure every
 * other screen puts its rationale behind.
 */

import { capability } from '@/atlas/capabilities'
import { GATE_SPECS } from '@/atlas/gates'
import { screen } from '@/atlas/registry'
import { SectionCard, Why } from '@/components/calm'
import { Chip, Icon, KeyValue } from '@/components/primitives'
import { patientByAnyId } from '@/data/kit'
import { Screen } from '@/shell/Screen'

export function Placeholder({ screenId, patientId }: { screenId: string; patientId?: string }) {
  const spec = screen(screenId)
  const p = patientByAnyId(patientId)

  return (
    <Screen
      screenId={screenId}
      patient={spec.patientScoped ? p : undefined}
      subheading="The content region of this screen is not built yet."
      chips={<Chip tone="caution">Z5 pending</Chip>}
    >
      <div className="max-w-3xl space-y-4">
        <SectionCard title="Not built yet" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
          <p className="flex items-start gap-2.5 text-ink-2">
            <Icon name="Hammer" size={16} className="mt-0.5 shrink-0 text-ink-3" />
            The frame around this region is real — the zones, the archetype contract, the compliance obligations and
            the assistant all come from this screen&rsquo;s registry row.
          </p>
        </SectionCard>

        <Why label="The registry row and its AI touchpoints">
          <SectionCard title="Registry row" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <dl className="divide-y divide-glass-hairline">
              <KeyValue label="Screen">
                {spec.id} · {spec.name}
              </KeyValue>
              <KeyValue label="Route">{spec.route ?? `⊘ ${spec.surface}`}</KeyValue>
              <KeyValue label="Zones">{spec.zones.join(' · ')}</KeyValue>
              <KeyValue label="Permission">{spec.permission}</KeyValue>
              <KeyValue label="Personas">{spec.personas.join(' · ')}</KeyValue>
            </dl>
          </SectionCard>

          {spec.ai.length > 0 && (
            <SectionCard title="AI touchpoints" bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
              <ul className="space-y-2.5">
                {spec.ai.map((id) => {
                  const cap = capability(id)
                  return (
                    <li key={id}>
                      <p className="font-medium">
                        {cap.id} · {cap.name}
                      </p>
                      <p className="mt-0.5 text-[0.88em] text-ink-3">
                        gate {cap.gate} {GATE_SPECS[cap.gate].name} · if unavailable: {cap.fallback}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>
          )}
        </Why>
      </div>
    </Screen>
  )
}

/**
 * Five screens in scope have no route — they are modals, overlays or an
 * in-place expansion (S-06-04, S-09-06, S-02-05, S-15-06, S-18-02). They still
 * need a component so the completeness check reconciles, but it is never
 * rendered: each is mounted by the screen that opens it.
 */
export function overlayEntry(screenId: string, openedFrom: string) {
  const Cmp = () => {
    const spec = screen(screenId)
    return (
      <Screen screenId={screenId} chips={<Chip tone="neutral">{spec.surface}</Chip>}>
        <SectionCard
          title={spec.surface === 'in-place' ? 'An in-place expansion' : `A ${spec.surface}`}
          className="max-w-2xl"
          bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
        >
          <p className="text-ink-2">
            {spec.id} has no route of its own. Open it from <strong className="font-semibold">{openedFrom}</strong>,
            which mounts it.
          </p>
        </SectionCard>
      </Screen>
    )
  }
  Cmp.displayName = `Overlay(${screenId})`
  return Cmp
}
