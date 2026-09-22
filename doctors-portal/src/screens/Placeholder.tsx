/**
 * A scaffold frame for a screen whose Z5 is not yet built.
 *
 * It still renders the real registry row — the real title, one-liner, zones,
 * archetype, AI touchpoints, compliance chips, state switcher and the Z7b
 * bubble — so a route is never a blank page, and so the atlas's completeness
 * assertion has something to reconcile against while the build proceeds.
 */

import { ARCHETYPE_SPECS } from '@/atlas/archetypes'
import { capability } from '@/atlas/capabilities'
import { GATE_SPECS } from '@/atlas/gates'
import { screen } from '@/atlas/registry'
import { Diamond } from '@/components/ai'
import { Card, Chip, Icon, KeyValue } from '@/components/primitives'
import { patientByAnyId } from '@/data/kit'
import { Screen } from '@/shell/Screen'

export function Placeholder({ screenId, patientId }: { screenId: string; patientId?: string }) {
  const spec = screen(screenId)
  const archetype = ARCHETYPE_SPECS[spec.archetype]
  const p = patientByAnyId(patientId)

  return (
    <Screen
      screenId={screenId}
      patient={spec.patientScoped ? p : undefined}
      chips={<Chip tone="caution">Z5 pending</Chip>}
    >
      <div className="space-y-4">
        <Card className="p-5">
          <p className="flex items-center gap-2 font-semibold">
            <Icon name="Hammer" size={16} className="text-ink-3" />
            This screen&rsquo;s content region is not built yet
          </p>
          <p className="mt-1.5 text-ink-2">
            The shell around it is real: the zones, the archetype contract, the compliance obligations and the assistant
            bubble all come from the registry row below.
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Registry row</h2>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Screen">
                {spec.id} · {spec.name}
              </KeyValue>
              <KeyValue label="Module">{spec.module}</KeyValue>
              <KeyValue label="Route">{spec.route ?? `⊘ ${spec.surface}`}</KeyValue>
              <KeyValue label="Tier">{spec.tier}</KeyValue>
              <KeyValue label="Archetype">
                {spec.archetype} · {archetype.name}
              </KeyValue>
              <KeyValue label="Zones">{spec.zones.join(' · ')}</KeyValue>
              <KeyValue label="Density">{spec.density}</KeyValue>
              <KeyValue label="Permission">{spec.permission}</KeyValue>
              <KeyValue label="Personas">{spec.personas.join(' · ')}</KeyValue>
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">AI touchpoints</h2>
            <ul className="mt-2 space-y-2.5">
              {spec.ai.map((id) => {
                const cap = capability(id)
                return (
                  <li key={id}>
                    <p className="flex items-center gap-2 font-medium">
                      <Diamond size={10} />
                      {cap.id} · {cap.name}
                    </p>
                    <p className="mt-0.5 text-[0.88em] text-ink-3">
                      gate {cap.gate} {GATE_SPECS[cap.gate].name} · if unavailable: {cap.fallback}
                    </p>
                  </li>
                )
              })}
              <li>
                <p className="flex items-center gap-2 font-medium">
                  <Diamond size={10} />
                  AI-911 · Contextual assistant
                </p>
                <p className="mt-0.5 text-[0.88em] text-ink-3">
                  gate G1 · mandatory and cited · on every screen via GP-17
                </p>
              </li>
            </ul>
            <p className="mt-3 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.88em] text-ink-2">
              {archetype.shape}
            </p>
          </Card>
        </div>
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
        <Card className="p-5">
          <p className="font-semibold">
            {spec.id} is {spec.surface === 'in-place' ? 'an in-place expansion' : `a ${spec.surface}`}, not a page
          </p>
          <p className="mt-1.5 text-ink-2">
            It has no route in the atlas registry. Open it from <strong>{openedFrom}</strong>, which mounts it.
          </p>
        </Card>
      </Screen>
    )
  }
  Cmp.displayName = `Overlay(${screenId})`
  return Cmp
}
