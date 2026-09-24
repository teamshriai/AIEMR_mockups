/**
 * screenId → component. One entry per registry row, and `verifyRegistry()`
 * reconciles the two sets at startup.
 *
 * The atlas's completeness guarantee, applied to the code: "A screen in the
 * registry with no specification is a gap; a specification not in the registry
 * is an orphan. Neither is permitted."
 */

import type { ComponentType } from 'react'

import { overlayEntry } from './Placeholder'
import { S0201 } from './m02/S0201'
import { S0601 } from './m06/S0601'
import { S0603 } from './m06/S0603'
import { S0607 } from './m06/S0607'
import { S0602 } from './m06/S0602'
import { S0605 } from './m06/S0605'
import { S0606 } from './m06/S0606'
import { S0608 } from './m06/S0608'
import { S0609 } from './m06/S0609'
import { S0610 } from './m06/S0610'
import { S0901 } from './m09/S0901'
import { S0902 } from './m09/S0902'
import { S0903 } from './m09/S0903'
import { S0904 } from './m09/S0904'
import { S0905 } from './m09/S0905'
import { S0908 } from './m09/S0908'
import { S0803 } from './m08/S0803'
import { S0804 } from './m08/S0804'
import { S0807 } from './m08/S0807'
import { S1301 } from './m13/S1301'
import { S1302 } from './m13/S1302'
import { S1303 } from './m13/S1303'
import { S1306 } from './m13/S1306'
import { S0503 } from './m05/S0503'
import { S0504 } from './m05/S0504'
import { S0505 } from './m05/S0505'
import { S0506 } from './m05/S0506'
import { S1801 } from './m18/S1801'
import { S1803 } from './m18/S1803'
import { S1804 } from './m18/S1804'
import { S1805 } from './m18/S1805'
import { S1806 } from './m18/S1806'
import { S1807 } from './m18/S1807'
import { S1808 } from './m18/S1808'
import { S1809 } from './m18/S1809'
import { S1810 } from './m18/S1810'
import { S1811 } from './m18/S1811'
import { S1812 } from './m18/S1812'
import { S1813 } from './m18/S1813'
import { S1814 } from './m18/S1814'
import { S1815 } from './m18/S1815'
import { S1816 } from './m18/S1816'
import { S1817 } from './m18/S1817'
import { S1818 } from './m18/S1818'
import { S1819 } from './m18/S1819'
import { S1820 } from './m18/S1820'
import { S1821 } from './m18/S1821'
import { S2802, S2809 } from './m28/AssistantScreen'
import { S1504 } from './m15/S1504'
import { S2702, S2703, S2704 } from './m27/Telehealth'
import { S1608 } from './m16/S1608'


export interface ScreenComponentProps {
  /** Route params, forwarded so a screen can resolve its subject. */
  id?: string
}

type ScreenComponent = ComponentType<ScreenComponentProps>

export const SCREEN_COMPONENTS: Record<string, ScreenComponent> = {
  // ── M-06 · Outpatient Consultation & Clinical Documentation
  'S-06-01': S0601,
  'S-06-02': S0602,
  'S-06-03': S0603,
  'S-06-04': overlayEntry('S-06-04', 'the Dictate action on S-06-03'),
  'S-06-05': S0605,
  'S-06-06': S0606,
  'S-06-07': S0607,
  'S-06-08': S0608,
  'S-06-09': S0609,
  'S-06-10': S0610,

  // ── M-09 · Orders, CPOE & Results Review
  'S-09-01': S0901,
  'S-09-02': S0902,
  'S-09-03': S0903,
  'S-09-04': S0904,
  'S-09-05': S0905,
  'S-09-06': overlayEntry('S-09-06', 'a critical row in the S-09-04 results inbox'),
  'S-09-08': S0908,

  // ── M-08 · Inpatient ADT, doctor slice
  'S-08-03': S0803,
  'S-08-04': S0804,
  'S-08-07': S0807,

  // ── M-13 · Discharge & Care Transitions
  'S-13-01': S1301,
  'S-13-02': S1302,
  'S-13-03': S1303,
  'S-13-06': S1306,

  // ── M-05 · Scheduling, doctor slice
  'S-05-03': S0503,
  'S-05-04': S0504,
  'S-05-05': S0505,
  'S-05-06': S0506,

  // ── M-02 · Access
  'S-02-01': S0201,
  'S-02-05': overlayEntry('S-02-05', 'opening a patient you have no care relationship with'),

  // ── M-18 · Stroke-AI Command Centre
  'S-18-01': S1801,
  'S-18-02': overlayEntry('S-18-02', 'a case card on the S-18-01 command wall'),
  'S-18-03': S1803,
  'S-18-04': S1804,
  'S-18-05': S1805,
  'S-18-06': S1806,
  'S-18-07': S1807,
  'S-18-08': S1808,
  'S-18-09': S1809,
  'S-18-10': S1810,
  'S-18-11': S1811,
  'S-18-12': S1812,
  'S-18-13': S1813,
  'S-18-14': S1814,
  'S-18-15': S1815,
  'S-18-16': S1816,
  'S-18-17': S1817,
  'S-18-18': S1818,
  'S-18-19': S1819,
  'S-18-20': S1820,
  'S-18-21': S1821,

  // ── M-28 · Assistants
  'S-28-02': S2802,
  'S-28-09': S2809,

  // ── Adjuncts
  'S-15-04': S1504,
  'S-15-06': overlayEntry('S-15-06', 'a critical finding on S-15-04'),
  'S-27-02': S2702,
  'S-27-03': S2703,
  'S-27-04': S2704,
  'S-16-08': S1608,
}
