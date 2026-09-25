/**
 * S-06-11 · Patient record — `/patient/:id/record` · T2 · ARC-20
 *
 * One patient on one page: the summary, their report, the latest scan or
 * document, and the AI's readings — with each part of the record one tab
 * away. Nothing on this page is a door to somewhere else; the tabs are.
 */

import { useNavigate } from 'react-router-dom'

import { Button, cx } from '@/components/primitives'
import { encounterForPatient } from '@/data/clinical'
import type { Patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'

import { AiInsights } from './AiInsights'
import { PatientReport } from './PatientReport'
import { ReportViewer } from './ReportViewer'
import { RecordScreen } from './shared'
import { SummaryCard } from './SummaryCard'

/** Where "start the consultation" goes, by the kind of encounter the patient has. */
export function consultPath(p: Patient): string | undefined {
  const enc = encounterForPatient(p.id)
  if (!enc) return undefined
  return enc.type === 'IP' ? `/ip/encounter/${enc.id}/note` : `/encounter/${enc.id}/note`
}

/** The one label for starting the note, wherever it is offered. */
export function noteActionLabel(p: Patient): string {
  return encounterForPatient(p.id)?.type === 'IP' ? 'Write progress note' : 'Start consultation'
}

export function S0611({ id }: { id?: string }) {
  return (
    <RecordScreen id={id} section="record" actions={(p) => <HubActions patient={p} />}>
      {(p) => <Hub patient={p} />}
    </RecordScreen>
  )
}

function HubActions({ patient: p }: { patient: Patient }) {
  const navigate = useNavigate()
  const consult = consultPath(p)
  return (
    <>
      <Button icon="History" onClick={() => navigate(`/patient/${p.uhid}/timeline`)}>
        Timeline
      </Button>
      {/* One click into Telehealth, with this patient already loaded. */}
      <Button icon="Video" onClick={() => navigate(`/tele/session/${p.uhid}`)}>
        Connect
      </Button>
      {consult && (
        <Button tone="primary" icon="Stethoscope" onClick={() => navigate(consult)}>
          {noteActionLabel(p)}
        </Button>
      )}
    </>
  )
}

function Hub({ patient: p }: { patient: Patient }) {
  const aiActive = useAI(selectAiActive)
  return (
    <>
      {/* First: the scan beside the AI's readings — the viewer wider; one column when the AI is off. */}
      <div className={cx('grid gap-5 lg:items-start', aiActive && 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]')}>
        <ReportViewer patient={p} />
        <AiInsights patient={p} />
      </div>
      <SummaryCard patient={p} />
      <PatientReport patient={p} />
    </>
  )
}
