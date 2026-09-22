/**
 * S-06-03 · Consultation Note — `/encounter/:id/note` · T1 · ARC-15
 *
 * "The consultation note that is already written by the time the patient
 * leaves."
 *
 * Deck beat #6, and its drawing note is the whole pitch:
 *   "The draft is GHOST TEXT INSIDE THE NOTE, 85% opacity with a left accent
 *    rule — NOT A SIDE CARD. That is the entire pitch."
 *
 * The authoring surface itself lives in NoteAuthoring, shared with S-08-04.
 * What is here is what makes this screen the outpatient one: the AI-101 scribe
 * overlay, and AI-203's differential in the Z6 rail.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { Diamond, SuggestionCard } from '@/components/ai'
import { Button, Card } from '@/components/primitives'
import { NOTE_DRAFT_SD_P_01, NOTE_DRAFT_SD_P_03, encounter } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useUI } from '@/store/ui'

import { NoteAuthoring } from '../shared/NoteAuthoring'
import { S0604 } from './S0604'

export function S0603({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const [scribeOpen, setScribeOpen] = useState(false)
  const [scribeUsed, setScribeUsed] = useState(false)

  const enc = encounter(id ?? 'E-118402')
  const p = patient(enc.patientId)
  const seeds = enc.patientId === 'SD-P-03' ? NOTE_DRAFT_SD_P_03 : NOTE_DRAFT_SD_P_01

  return (
    <>
      <NoteAuthoring
        screenId="S-06-03"
        encounter={enc}
        patient={p}
        seeds={seeds}
        scribeModel="scribe v5.1.2"
        onSigned={() => navigate('/clinician')}
        headerActions={
          <>
            <Button icon="Mic" tone={scribeUsed ? 'secondary' : 'ai'} onClick={() => setScribeOpen(true)}>
              Dictate
            </Button>
            <Button icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/rx`)}>
              Prescribe
            </Button>
            <Button icon="ClipboardList" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
              Order
            </Button>
          </>
        }
        rail={<DifferentialRail encounterId={enc.id} patientId={p.id} />}
      />

      {/* S-06-04, as the overlay it is specified to be. */}
      <S0604
        open={scribeOpen}
        patientName={p.name}
        sections={seeds}
        onClose={() => setScribeOpen(false)}
        onFinish={() => {
          setScribeOpen(false)
          setScribeUsed(true)
          toast({
            tone: 'info',
            title: 'Four sections drafted',
            detail: 'Each one needs Accept, Edit or Reject before Sign will enable. One arrived at MED confidence.',
          })
        }}
      />
    </>
  )
}

/** Z6 — AI-203's differential, which suggests and never concludes. */
export function DifferentialRail({ encounterId, patientId }: { encounterId: string; patientId: string }) {
  const differentials =
    patientId === 'SD-P-03'
      ? [
          {
            title: 'Parapneumonic effusion or empyema',
            evidence: 'CRP nearly doubled at 72h with a rising oxygen requirement and no organism identified.',
            confidence: 0.71,
            band: 'MED' as const,
          },
          {
            title: 'Resistant or atypical organism',
            evidence: 'Blood culture negative at 48h on broad beta-lactam cover.',
            confidence: 0.64,
            band: 'MED' as const,
          },
          {
            title: 'Hospital-acquired secondary infection',
            evidence: 'Day 4 of admission with a new fever spike.',
            confidence: 0.42,
            band: 'LOW' as const,
          },
        ]
      : [
          {
            title: 'Adequately replaced primary hypothyroidism',
            evidence: 'TSH 2.4 within target on an unchanged dose, with symptom resolution.',
            confidence: 0.92,
            band: 'HIGH' as const,
          },
          {
            title: 'Coexisting iron deficiency',
            evidence: 'Fatigue improved but not resolved; no recent haemoglobin on file.',
            confidence: 0.48,
            band: 'LOW' as const,
          },
        ]

  return (
    <div className="space-y-4">
      {differentials.map((d, i) => (
        <SuggestionCard
          key={d.title}
          touchpointId={`${encounterId}:dx-${i}`}
          capabilityId="AI-203"
          title={d.title}
          evidence={d.evidence}
          band={d.band}
          score={d.confidence}
          gate="G1"
          caution="Suggests, never concludes. This is not a diagnosis."
          explain={{
            touchpointId: `${encounterId}:dx-${i}`,
            capabilityId: 'AI-203',
            claim: `${d.title} is consistent with the charted evidence and worth considering. It is a suggestion, not a conclusion.`,
            confidence: d.confidence,
            band: d.band,
            computedAt: formatTime(NOW),
            inputs: [
              { label: 'Problem list', source: `Problems for ${patientId}` },
              { label: 'Recent results', source: 'Results, last 72 hours' },
              { label: 'Charted vitals', source: 'Flowsheet, most recent set' },
            ],
            evidence: [d.evidence],
            model: 'ddx v2.6.1',
            limits: [
              'Ranks possibilities from the structured record. It does not see examination findings you have not charted yet.',
              'Never concludes and never orders. Your own differential is the fallback.',
              'Not validated as a triage tool for undifferentiated presentations.',
            ],
          }}
        />
      ))}

      <Card className="p-4">
        <p className="flex items-center gap-2 text-[0.86em] font-semibold text-ink-3">
          <Diamond size={10} />
          AI-114 · documentation quality
        </p>
        <p className="mt-1.5 text-[0.9em] text-ink-2">
          Banned abbreviations are checked when you leave a field, and rejected rather than warned about. The message
          names what to write instead.
        </p>
        <p className="mt-2 text-[0.84em] text-ink-3">CMP-NABH-05 · legible, complete orders.</p>
      </Card>
    </div>
  )
}
