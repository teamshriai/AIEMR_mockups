/**
 * S-18-09 · Team Paging & Acknowledgement — `/stroke/case/:id/team` · T2 · ARC-01
 *
 * "Who was paged, and who actually answered."
 *
 * The distinction in the title is the whole screen. A paging system that
 * reports "team notified" when nobody picked up is worse than one that reports
 * nothing, because it stops anyone chasing.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond } from '@/components/ai'
import { Alert, Button, Card, Chip, Icon, KeyValue, Table, Td, Th, Tr, cx } from '@/components/primitives'
import { formatTime } from '@/data/format'
import { patient } from '@/data/kit'
import { PAGING_LOG, strokeCase } from '@/data/stroke'
import { selectAiActive, useAI } from '@/store/ai'
import { minutesBetween, useStroke } from '@/store/stroke'
import { useUI } from '@/store/ui'
import { Screen, ScreenSection } from '@/shell/Screen'

import { CaseClockStrip, useCaseClock } from './CaseClock'

const ESCALATION = [
  { step: 1, channel: 'Push notification', wait: '0 min' },
  { step: 2, channel: 'Automated call to the registered mobile', wait: '2 min' },
  { step: 3, channel: 'Call to the second contact on the rota', wait: '4 min' },
  { step: 4, channel: 'Switchboard pages the next person in the speciality', wait: '6 min' },
  { step: 5, channel: 'On-call consultant for the division is paged', wait: '10 min' },
]

export function S1809({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const aiActive = useAI(selectAiActive)
  const caseNow = useCaseClock()
  const running = useStroke((s) => s.running)

  const c = strokeCase(id ?? '0141')
  const p = patient(c.patientId)
  const [repaged, setRepaged] = useState<string[]>([])

  const acked = PAGING_LOG.filter((x) => x.ackAt)
  const unanswered = PAGING_LOG.filter((x) => !x.ackAt)
  const medianAck =
    acked.length > 0
      ? Math.round(acked.reduce((s, x) => s + minutesBetween(x.pagedAt, x.ackAt!), 0) / acked.length)
      : 0

  return (
    <Screen
      screenId="S-18-09"
      patient={p}
      bannerExtra={<CaseClockStrip caseId={c.id} />}
      loadingShape="list"
      states={['LOADING', 'EMPTY', 'PARTIAL', 'ERROR', 'DENIED', 'BREAKGLASS', 'OFFLINE', 'STALE', 'AI-OFF']}
      chips={
        <>
          <Chip tone="normal">
            {acked.length} of {PAGING_LOG.length} answered
          </Chip>
          {unanswered.length > 0 && (
            <Chip tone="abnormal" icon="TriangleAlert">
              {unanswered.length} no answer
            </Chip>
          )}
        </>
      }
      actions={
        <Button icon="Clock" onClick={() => navigate(`/stroke/case/${c.id}/clock`)}>
          Case clock
        </Button>
      }
      rail={
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">Escalation ladder</h3>
            <ol className="mt-2 space-y-2">
              {ESCALATION.map((e) => (
                <li key={e.step} className="flex gap-2.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-pill bg-glass-fill-muted text-[0.8em] font-semibold">
                    {e.step}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.9em]">{e.channel}</span>
                    <span className="tabular block text-[0.84em] text-ink-3">at {e.wait}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-3 rounded-panel bg-glass-fill-muted px-3 py-2 text-[0.86em] text-ink-2">
              The ladder runs automatically. Nobody has to notice that nobody answered.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="text-[0.82em] font-semibold tracking-wide text-ink-3 uppercase">This case</h3>
            <dl className="mt-2 divide-y divide-glass-hairline">
              <KeyValue label="Median acknowledgement">
                <span className="tabular">{medianAck} min</span>
              </KeyValue>
              <KeyValue label="Paged">{PAGING_LOG.length}</KeyValue>
              <KeyValue label="Answered">{acked.length}</KeyValue>
            </dl>
          </Card>

          {aiActive && (
            <Card className="p-4">
              <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
                <Diamond size={10} />
                AI-623 · who to page
              </p>
              <p className="mt-1.5 text-[0.9em] text-ink-2">
                Picks from the live rota rather than a static list, so a swapped shift does not page someone who is
                asleep at home. It suggests; the coordinator can always page anyone.
              </p>
            </Card>
          )}
        </div>
      }
      railTitle="Paging"
    >
      <div className="space-y-5">
        {unanswered.length > 0 && (
          <Alert
            tone="abnormal"
            role="alert"
            title={`${unanswered[0].role} has not answered`}
            action={
              <Button
                size="sm"
                tone="destructive"
                icon="PhoneCall"
                onClick={() => {
                  setRepaged((r) => [...r, unanswered[0].role])
                  toast({
                    tone: 'caution',
                    title: `${unanswered[0].role} re-paged`,
                    detail: 'Escalated to step 3 — the second contact on the rota is being called.',
                  })
                }}
              >
                Escalate now
              </Button>
            }
          >
            {unanswered[0].name} was paged at {formatTime(unanswered[0].pagedAt)} on {unanswered[0].channel.toLowerCase()}. The
            ladder escalates on its own, but you can push it forward.
          </Alert>
        )}

        <ScreenSection title="Paged for this case" subtitle="Paged is not the same as answered">
          <Card className="overflow-hidden">
            <Table
              caption="Team paging log"
              rowCount={`${PAGING_LOG.length} paged · ${acked.length} answered · median ${medianAck} min`}
              head={
                <>
                  <Th>Role</Th>
                  <Th>Person</Th>
                  <Th>Channel</Th>
                  <Th>Paged</Th>
                  <Th>Answered</Th>
                  <Th className="text-right">Action</Th>
                </>
              }
            >
              {PAGING_LOG.map((x) => (
                <Tr key={x.role} className={cx(!x.ackAt && 'bg-abnormal-soft/40')}>
                  <Td className="font-medium">{x.role}</Td>
                  <Td>{x.name}</Td>
                  <Td className="text-[0.9em] text-ink-3">{x.channel}</Td>
                  <Td className="tabular">{formatTime(x.pagedAt)}</Td>
                  <Td>
                    {x.ackAt ? (
                      <span className="tabular flex items-center gap-1.5">
                        <Icon name="Check" size={13} className="text-normal" />
                        {formatTime(x.ackAt)}
                        <span className="text-ink-3">· {minutesBetween(x.pagedAt, x.ackAt)} min</span>
                      </span>
                    ) : (
                      <Chip tone="abnormal" icon="TriangleAlert">
                        no answer · {minutesBetween(x.pagedAt, caseNow)} min
                      </Chip>
                    )}
                  </Td>
                  <Td className="text-right">
                    {x.ackAt ? (
                      <span className="text-[0.86em] text-ink-3">—</span>
                    ) : repaged.includes(x.role) ? (
                      <Chip tone="caution">escalated</Chip>
                    ) : (
                      <Button
                        size="sm"
                        icon="PhoneCall"
                        onClick={(e) => {
                          e.stopPropagation()
                          setRepaged((r) => [...r, x.role])
                          toast({ tone: 'caution', title: `${x.role} re-paged` })
                        }}
                      >
                        Re-page
                      </Button>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          </Card>
        </ScreenSection>

        <p className="flex items-start gap-2 text-[0.86em] text-ink-3">
          <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
          The clock is {running ? 'running' : 'paused'} at {formatTime(caseNow)}. Paging times are stamped from the
          server, so an acknowledgement cannot be back-dated from a phone.
        </p>
      </div>
    </Screen>
  )
}
