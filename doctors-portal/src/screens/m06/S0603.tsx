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
 * The note opens empty; each section is spoken or typed. What is here is what
 * makes this screen the outpatient one: the AI-101 scribe overlay behind
 * "Draft with AI", and AI-203's differential in the Z6 rail — the
 * confident ones on the surface, the low-confidence ones folded, the rationale
 * behind a Why.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { SuggestionCard } from '@/components/ai'
import { Disclosure, Why } from '@/components/calm'
import { Button } from '@/components/primitives'
import { NOTE_DRAFT_SD_P_01, NOTE_DRAFT_SD_P_03, encounter } from '@/data/clinical'
import { formatTime, NOW } from '@/data/format'
import { patient } from '@/data/kit'
import { useClinical } from '@/store/clinical'
import { useUI } from '@/store/ui'

import { NoteAuthoring } from '../shared/NoteAuthoring'
import { S0604 } from './S0604'

export function S0603({ id }: { id?: string }) {
  const navigate = useNavigate()
  const toast = useUI((s) => s.toast)
  const applyScribeDraft = useClinical((s) => s.applyScribeDraft)
  const [scribeOpen, setScribeOpen] = useState(false)

  const enc = encounter(id ?? 'E-118402')
  const p = patient(enc.patientId)
  const seeds = enc.patientId === 'SD-P-03' ? NOTE_DRAFT_SD_P_03 : NOTE_DRAFT_SD_P_01
  const differentials = differentialsFor(p.id)

  return (
    <>
      <NoteAuthoring
        screenId="S-06-03"
        encounter={enc}
        patient={p}
        seeds={seeds}
        scribeModel="scribe v5.1.2"
        onSigned={() => navigate('/clinician')}
        onDraftAll={() => setScribeOpen(true)}
        headerActions={
          <>
            <Button tone="tertiary" icon="Pill" onClick={() => navigate(`/encounter/${enc.id}/rx`)}>
              Prescribe
            </Button>
            <Button tone="tertiary" icon="ClipboardList" onClick={() => navigate(`/encounter/${enc.id}/orders/new`)}>
              Order
            </Button>
          </>
        }
        rail={<DifferentialRail encounterId={enc.id} patientId={p.id} />}
        railTitle="Differential"
        railBadge={differentials.length}
      />

      {/* S-06-04, as the overlay it is specified to be. */}
      <S0604
        open={scribeOpen}
        patientId={p.id}
        patientName={p.name}
        sections={seeds}
        onClose={() => setScribeOpen(false)}
        onFinish={(keys) => {
          setScribeOpen(false)
          const drafted = applyScribeDraft(enc.id, keys)
          const kept = keys.length - drafted.length
          toast({
            tone: 'info',
            title:
              drafted.length === 0
                ? 'Nothing to draft — every section already has your words'
                : `${drafted.length === 4 ? 'Four' : drafted.length} ${drafted.length === 1 ? 'section' : 'sections'} drafted`,
            detail:
              drafted.length === 0
                ? 'The scribe never overwrites what you dictated or typed.'
                : `Each one needs Accept, Edit or Reject before Sign will enable.${kept > 0 ? ` ${kept} you had already written ${kept === 1 ? 'was' : 'were'} left as yours.` : ''}`,
          })
        }}
      />
    </>
  )
}

interface Differential {
  title: string
  evidence: string
  confidence: number
  band: 'HIGH' | 'MED' | 'LOW'
}

function differentialsFor(patientId: string): Differential[] {
  return patientId === 'SD-P-03'
    ? [
        {
          title: 'Parapneumonic effusion or empyema',
          evidence: 'CRP nearly doubled at 72h with a rising oxygen requirement and no organism identified.',
          confidence: 0.71,
          band: 'MED',
        },
        {
          title: 'Resistant or atypical organism',
          evidence: 'Blood culture negative at 48h on broad beta-lactam cover.',
          confidence: 0.64,
          band: 'MED',
        },
        {
          title: 'Hospital-acquired secondary infection',
          evidence: 'Day 4 of admission with a new fever spike.',
          confidence: 0.42,
          band: 'LOW',
        },
      ]
    : [
        {
          title: 'Adequately replaced primary hypothyroidism',
          evidence: 'TSH 2.4 within target on an unchanged dose, with symptom resolution.',
          confidence: 0.92,
          band: 'HIGH',
        },
        {
          title: 'Coexisting iron deficiency',
          evidence: 'Fatigue improved but not resolved; no recent haemoglobin on file.',
          confidence: 0.48,
          band: 'LOW',
        },
      ]
}

/** Z6 — AI-203's differential, which suggests and never concludes. */
export function DifferentialRail({ encounterId, patientId }: { encounterId: string; patientId: string }) {
  const differentials = differentialsFor(patientId)
  const confident = differentials.filter((d) => d.band !== 'LOW')
  const low = differentials.filter((d) => d.band === 'LOW')

  const card = (d: Differential) => {
    const i = differentials.indexOf(d)
    return (
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
    )
  }

  return (
    <div className="space-y-4">
      {confident.map(card)}

      {low.length > 0 && (
        <Disclosure label="low-confidence" count={low.length}>
          <div className="space-y-4">{low.map(card)}</div>
        </Disclosure>
      )}

      <Why label="How this note is checked">
        <p className="text-ink-2">
          Documentation quality (AI-114): banned abbreviations are checked when you leave a field and rejected rather
          than warned about. The message names what to write instead — CMP-NABH-05, legible and complete orders.
        </p>
      </Why>
    </div>
  )
}
