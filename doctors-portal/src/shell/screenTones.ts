/**
 * The soft hue each screen gives its cards — the screen's FUNCTION, so the
 * same kind of work carries the same colour everywhere, in both themes.
 *
 * A card inherits its screen's hue (primitives.tsx `CardToneContext`); a card
 * that does a different job names its own — the AI insights on a patient's
 * record are indigo, its test results olive. The palette itself is in
 * theme.css (CARD TINTS).
 */

import type { CardTone } from '@/components/primitives'

/** By module, the function most of its screens serve. */
const BY_MODULE: Record<string, CardTone> = {
  'S-05': 'schedule', // sessions, templates, blocks
  'S-06': 'patient', // the clinician's workspace and the patient record
  'S-08': 'inpatients', // ward and bed
  'S-09': 'investigations', // orders and results
  'S-13': 'discharge', // discharge and the end of a stay
  'S-15': 'investigations', // imaging
  'S-16': 'medication', // pharmacovigilance
  'S-18': 'stroke', // the stroke network
  'S-27': 'schedule', // the teleconsult queue
  'S-28': 'ai', // the assistant
}

/** Screens whose function differs from their module's. */
const BY_SCREEN: Record<string, CardTone> = {
  // My Day tints its own panels, section by section.
  'S-06-01': 'none',
  // Documentation: notes, the scribe, co-sign, templates.
  'S-06-03': 'signoff',
  'S-06-04': 'signoff',
  'S-06-09': 'signoff',
  'S-06-10': 'signoff',
  'S-06-14': 'signoff',
  'S-08-04': 'signoff',
  // Medication.
  'S-06-07': 'medication',
  'S-06-16': 'medication',
  'S-13-03': 'medication',
  'S-27-04': 'medication',
  // Investigations on the patient's record.
  'S-06-12': 'investigations',
  'S-06-13': 'investigations',
  // A patient's appointments are the schedule.
  'S-06-17': 'schedule',
  // The OPD queue, referrals and a teleconsult are about the patient in front of you.
  'S-05-03': 'patient',
  'S-05-06': 'patient',
  'S-27-03': 'patient',
  // Sign-in and break-glass are not work surfaces.
  'S-02-01': 'none',
  'S-02-05': 'none',
}

export function screenTone(screenId: string): CardTone | undefined {
  return BY_SCREEN[screenId] ?? BY_MODULE[screenId.slice(0, 4)]
}
