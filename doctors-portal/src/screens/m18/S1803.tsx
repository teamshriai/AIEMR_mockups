/**
 * S-18-03 · Spoke-Site Readiness Strip — `/stroke/network/sites` · T2 · ARC-20
 *
 * "Whether each spoke can actually do its part tonight."
 *
 * The question this answers is the one that decides where an ambulance goes.
 * AI-816 finds training gaps and AI-622 predicts equipment failure, both at G1
 * — they notice; the manual training matrix and the preventive-maintenance
 * schedule remain the fallbacks.
 *
 * Calm pass: the flagged sites are the slice acted on tonight, so they open by
 * default; the ready ones are one tap away. Each site is one card, one line of
 * facts, one line of flags.
 */

import { useNavigate } from 'react-router-dom'

import { ScopeTabs, SectionCard, Why, useScope } from '@/components/calm'
import { Button, Chip, Icon, KeyValue } from '@/components/primitives'
import { NETWORK_SITES, NETWORK_TODAY } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen } from '@/shell/Screen'

type Scope = 'flagged' | 'ready'
const SCOPES: readonly Scope[] = ['flagged', 'ready']

type Site = (typeof NETWORK_SITES)[number]

export function S1803() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)
  const [scope, setScope] = useScope(SCOPES, 'flagged')

  const flagged = NETWORK_SITES.filter((s) => s.readiness.length > 0)
  const ready = NETWORK_SITES.filter((s) => s.readiness.length === 0)
  const fullyReady = NETWORK_SITES.filter((s) => s.ctStatus !== 'none' && s.readiness.length === 0).length
  const transferOnly = NETWORK_SITES.filter((s) => s.ctStatus === 'none')

  const shown = scope === 'flagged' ? flagged : ready

  return (
    <Screen
      screenId="S-18-03"
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      heading="Site readiness"
      subheading={
        <>
          {NETWORK_SITES.length} sites · {fullyReady} fully ready · {flagged.length} flagged · {transferOnly.length}{' '}
          transfer-only
        </>
      }
      actions={
        <Button icon="Brain" onClick={() => navigate('/stroke/wall')}>
          Command wall
        </Button>
      }
      rail={
        <SectionCard title="Tonight">
          <dl className="divide-y divide-glass-hairline px-2">
            <KeyValue label="Fully ready">
              {fullyReady} of {NETWORK_SITES.length}
            </KeyValue>
            <KeyValue label="Transfer-only">
              {transferOnly.length} · {transferOnly.map((s) => s.code).join(', ')}, no CT
            </KeyValue>
            <KeyValue label="Activations today">{NETWORK_TODAY.activations}</KeyValue>
          </dl>
        </SectionCard>
      }
      railTitle="Readiness"
    >
      <div className="space-y-5">
        <ScopeTabs
          value={scope}
          onChange={setScope}
          options={[
            { key: 'flagged', label: 'Flagged', icon: 'TriangleAlert', count: flagged.length },
            { key: 'ready', label: 'Ready', icon: 'Check', count: ready.length },
          ]}
        />

        {shown.length === 0 ? (
          <SectionCard title={scope === 'flagged' ? 'Flagged' : 'Ready'} bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5">
            <p className="text-[0.95em] text-ink-2">
              {scope === 'flagged'
                ? 'No site has a readiness flag tonight.'
                : 'No site is clear of flags tonight — each one has something that changes where the ambulance goes.'}
            </p>
          </SectionCard>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {shown.map((s) => (
              <SiteCard key={s.code} site={s} aiActive={aiActive} />
            ))}
          </div>
        )}

        <Why label="What ready means, and how the flags are found">
          <ul className="space-y-1.5 text-ink-2">
            {[
              'A working CT with a radiographer on shift',
              'A physician who has completed the stroke competency in the last 12 months',
              'A stroke bed, or a transfer agreement if there is not one',
              'Bandwidth sufficient for a video teleconsult',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                {t}
              </li>
            ))}
          </ul>
          <p className="text-ink-2">
            A site missing any of these is not unusable — it changes where the ambulance goes, which is why this screen
            exists rather than a single up-or-down status.
          </p>
          <p className="text-ink-3">
            The flags are AI-816 gap detections and AI-622 failure predictions at G1 — they notice, and nobody is
            stopped from working. The training matrix and the maintenance schedule remain the authority.
          </p>
        </Why>
      </div>
    </Screen>
  )
}

/** One site: name · beds · CT chip, then the flags as one line. */
function SiteCard({ site: s, aiActive }: { site: Site; aiActive: boolean }) {
  const flagged = s.readiness.length > 0
  return (
    <SectionCard
      title={
        <>
          {s.code} <span className="font-medium normal-case tracking-normal text-ink-3">· {s.name}</span>
        </>
      }
      accent={flagged ? 'warning' : undefined}
      meta={
        <Chip tone={s.role === 'hub' ? 'brand' : s.role === 'spoke' ? 'caution' : 'neutral'}>{s.role}</Chip>
      }
      action={
        <Chip
          tone={s.ctStatus === 'free' ? 'normal' : s.ctStatus === 'none' ? 'inactive' : 'caution'}
          icon={s.ctStatus === 'none' ? 'Ban' : 'Scan'}
        >
          CT {s.ctStatus}
        </Chip>
      }
      bodyClassName="px-4 pb-4 sm:px-5 sm:pb-5"
    >
      <p className="tabular flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.92em] text-ink-2">
        <span>
          beds {s.strokeBeds.free}/{s.strokeBeds.total}
        </span>
        <span className="text-ink-muted">·</span>
        <span>cath lab {s.cathLab}</span>
        <span className="text-ink-muted">·</span>
        <span className="min-w-0 truncate">{s.neurologist}</span>
      </p>

      {flagged ? (
        <p className="mt-2.5 flex items-start gap-2 text-[0.92em] font-medium text-caution">
          <Icon name={aiActive ? 'Sparkles' : 'TriangleAlert'} size={14} className="mt-0.5 shrink-0" />
          <span>{s.readiness.join(' · ')}</span>
        </p>
      ) : (
        <p className="mt-2.5 flex items-center gap-2 text-[0.92em] font-medium text-normal">
          <Icon name="Check" size={14} />
          No readiness flags tonight
        </p>
      )}
    </SectionCard>
  )
}
