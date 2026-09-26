/**
 * S-06-11 · Patient record — `/patient/:id/record` · T2 · ARC-20
 *
 * One patient on one page: the latest scan or document, the vitals, how their
 * results fall, the AI's readings, the one trend that matters and their
 * report — with each part of the record one tab away.
 *
 * The first screen holds what a doctor opens a record for — the scan, the
 * vitals, how the results fall, and every AI reading in one card at the top
 * right — so none of it waits below the fold. The trend and the report sit
 * beneath. The page uses the full frame, so there is no empty band either
 * side.
 */

import { useNavigate } from 'react-router-dom'

import { AdmitButton } from '@/components/admission'
import { Button, cx } from '@/components/primitives'
import { encounterForPatient } from '@/data/clinical'
import type { Patient } from '@/data/kit'
import { selectAiActive, useAI } from '@/store/ai'

import { AiInsights } from './AiInsights'
import { hasTrend, hasViewer, insightsFor } from './overview'
import { PatientReport } from './PatientReport'
import { ReportViewer } from './ReportViewer'
import { ResultsCard } from './ResultsCard'
import { RecordScreen } from './shared'
import { TrendCard } from './TrendCard'
import { VitalsCard } from './VitalsCard'

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
    <RecordScreen id={id} section="record" wide actions={(p) => <HubActions patient={p} />}>
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
      {/* Admit — one tap into a small modal; absent once the patient is in, or on the way into, a bed. */}
      <AdmitButton patient={p} encounterId={encounterForPatient(p.id)?.id} />
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
  const viewer = hasViewer(p)
  const { lead, readings } = insightsFor(p)
  const insights = aiActive && (lead !== undefined || readings.length > 0)
  const columns = 1 + Number(viewer) + Number(insights)
  const trend = hasTrend(p)

  return (
    <>
      {/*
        The first screen: the scan, the vitals and results, and every AI
        reading at the top right — none of them below the fold. A missing card
        takes its column with it rather than leaving a hole. The AI card takes
        the row's height without setting it, and scrolls inside.
      */}
      <div
        className={cx(
          'grid gap-5',
          columns === 3 && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)]',
          columns === 2 && 'lg:grid-cols-2',
        )}
      >
        {viewer && <ReportViewer patient={p} className="h-full" />}
        <div className="flex min-w-0 flex-col gap-5">
          <VitalsCard patient={p} />
          <ResultsCard patient={p} className="flex-1" />
        </div>
        {insights && (
          <div className="min-w-0 lg:h-0 lg:min-h-full">
            <AiInsights patient={p} className="lg:h-full" />
          </div>
        )}
      </div>

      {/* Below: the one trend that matters, and the patient's report. */}
      <div className={cx('grid gap-5', trend && 'lg:grid-cols-2')}>
        <TrendCard patient={p} className="h-full" />
        <PatientReport patient={p} className="h-full" />
      </div>
    </>
  )
}
