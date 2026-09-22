/**
 * S-18-03 · Spoke-Site Readiness Strip — `/stroke/network/sites` · T2 · ARC-20
 *
 * "Whether each spoke can actually do its part tonight."
 *
 * The question this answers is the one that decides where an ambulance goes.
 * AI-816 finds training gaps and AI-622 predicts equipment failure, both at G1
 * — they notice; the manual training matrix and the preventive-maintenance
 * schedule remain the fallbacks.
 */

import { useNavigate } from 'react-router-dom'

import { TileGrid } from '@/archetypes'
import { Diamond } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue, StatTile, cx } from '@/components/primitives'
import { NETWORK_SITES, NETWORK_TODAY } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { Screen, ScreenSection } from '@/shell/Screen'

export function S1803() {
  const navigate = useNavigate()
  const aiActive = useAI(selectAiActive)

  const ready = NETWORK_SITES.filter((s) => s.ctStatus !== 'none' && s.readiness.length === 0).length
  const withFlags = NETWORK_SITES.filter((s) => s.readiness.length > 0)

  return (
    <Screen
      screenId="S-18-03"
      loadingShape="tiles"
      states={['LOADING', 'PARTIAL', 'ERROR', 'DENIED', 'OFFLINE', 'STALE', 'AI-OFF', 'AI-ABSTAIN']}
      chips={<Chip tone="neutral">{NETWORK_SITES.length} sites</Chip>}
      actions={
        <Button icon="Brain" onClick={() => navigate('/stroke/wall')}>
          Command wall
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Tonight</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Fully ready">
                {ready} of {NETWORK_SITES.length}
              </KeyValue>
              <KeyValue label="Transfer-only">1 · IKP, no CT</KeyValue>
              <KeyValue label="Activations today">{NETWORK_TODAY.activations}</KeyValue>
            </dl>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">
              What &ldquo;ready&rdquo; means
            </h3>
            <ul className="mt-2 space-y-1.5 text-[0.9em] text-ink-2">
              {[
                'A working CT with a radiographer on shift',
                'A physician who has completed the stroke competency in the last 12 months',
                'A stroke bed, or a transfer agreement if there is not one',
                'Bandwidth sufficient for a video consultation',
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Icon name="Check" size={13} className="mt-1 shrink-0 text-normal" />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[0.86em] text-ink-3">
              A site missing any of these is not unusable — it changes where the ambulance goes, which is why this
              screen exists rather than a single up-or-down status.
            </p>
          </Card>
        </div>
      }
      railTitle="Readiness"
    >
      <div className="space-y-5">
        {aiActive && withFlags.length > 0 && (
          <Alert tone="caution" title={`${withFlags.length} sites have a readiness flag`}>
            These are predictions and gap detections at G1 — they notice, and nobody is stopped from working. The
            training matrix and the maintenance schedule remain the authority.
          </Alert>
        )}

        <TileGrid>
          {NETWORK_SITES.map((s) => (
            <StatTile
              key={s.code}
              label={s.code}
              value={s.ctStatus === 'none' ? '⊘' : `${s.strokeBeds.free}/${s.strokeBeds.total}`}
              sub={s.ctStatus === 'none' ? 'no CT — transfer only' : `stroke beds free · CT ${s.ctStatus}`}
              tone={s.ctStatus === 'none' ? 'inactive' : s.readiness.length > 0 ? 'caution' : 'normal'}
              badge={
                <Chip tone={s.role === 'hub' ? 'brand' : s.role === 'spoke' ? 'caution' : 'neutral'}>{s.role}</Chip>
              }
            />
          ))}
        </TileGrid>

        <ScreenSection title="Site by site">
          <div className="grid gap-4 lg:grid-cols-2">
            {NETWORK_SITES.map((s) => (
              <Card
                key={s.code}
                className={cx('p-5', s.readiness.length > 0 && 'border-l-[3px] border-l-caution')}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="tabular font-semibold">
                      {s.code} · {s.name}
                    </h3>
                    <p className="text-[0.88em] text-ink-3">{s.role}</p>
                  </div>
                  <Chip
                    tone={s.ctStatus === 'free' ? 'normal' : s.ctStatus === 'none' ? 'inactive' : 'caution'}
                    icon={s.ctStatus === 'none' ? 'Ban' : 'Scan'}
                  >
                    CT {s.ctStatus}
                  </Chip>
                </div>

                <dl className="mt-3 divide-y divide-glass-hairline">
                  <KeyValue label="Neurologist">{s.neurologist}</KeyValue>
                  <KeyValue label="Stroke beds">
                    <span className="tabular">
                      {s.strokeBeds.free} free of {s.strokeBeds.total}
                    </span>
                  </KeyValue>
                  <KeyValue label="Cath lab">
                    <Chip tone={s.cathLab === 'free' ? 'normal' : 'inactive'}>{s.cathLab}</Chip>
                  </KeyValue>
                </dl>

                {s.readiness.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {s.readiness.map((r) => (
                      <li
                        key={r}
                        className="flex items-start gap-2 rounded-panel bg-caution-soft px-3 py-2 text-[0.9em] font-medium text-caution"
                      >
                        {aiActive && <Diamond size={9} className="mt-1 shrink-0" />}
                        {!aiActive && <Icon name="TriangleAlert" size={13} className="mt-0.5 shrink-0" />}
                        {r}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 flex items-center gap-2 rounded-panel bg-normal-soft px-3 py-2 text-[0.9em] font-medium text-normal">
                    <Icon name="Check" size={14} />
                    No readiness flags tonight.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </ScreenSection>
      </div>
    </Screen>
  )
}
