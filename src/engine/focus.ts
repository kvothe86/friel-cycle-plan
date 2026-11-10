import type { Phase } from './macro';
import type { Specialty } from './types';

/** Session families the session builder (M3) will draw from. */
export type SessionType =
  | 'recovery' | 'endurance' | 'long' | 'tempo' | 'sweetspot' | 'threshold'
  | 'overunder' | 'vo2' | 'anaerobic' | 'sprint' | 'race_sim' | 'openers';

export interface PhaseFocus {
  summary: string;
  /** Key sessions in priority order. */
  keySessions: SessionType[];
}

const BASE: Record<Phase, PhaseFocus> = {
  base: { summary: 'Aerobic volume, tempo/sweet spot, short neuromuscular drills', keySessions: ['sweetspot', 'long', 'tempo'] },
  build: { summary: 'Threshold and VO2max key sessions, endurance in between', keySessions: ['threshold', 'vo2', 'long'] },
  peak: { summary: 'Race-specific intensity, volume down', keySessions: ['race_sim', 'vo2', 'endurance'] },
  race: { summary: 'Taper: short openers, stay fresh', keySessions: ['openers', 'endurance'] },
};

const TWEAKS: Partial<Record<Specialty, Partial<Record<Phase, PhaseFocus>>>> = {
  climbing: {
    base: { summary: 'Long sweet spot climbs at low cadence, aerobic volume', keySessions: ['sweetspot', 'long', 'tempo'] },
    build: { summary: 'Long threshold intervals and over-unders', keySessions: ['threshold', 'overunder', 'vo2'] },
    peak: { summary: 'Climb-specific efforts at race power', keySessions: ['race_sim', 'threshold', 'endurance'] },
  },
  sprint: {
    base: { summary: 'Aerobic base plus sprint drills', keySessions: ['sweetspot', 'sprint', 'long'] },
    build: { summary: 'VO2max and anaerobic repeats', keySessions: ['vo2', 'anaerobic', 'sprint'] },
    peak: { summary: 'Race simulations and sprints', keySessions: ['race_sim', 'sprint', 'anaerobic'] },
  },
  tt: {
    base: { summary: 'Sweet spot in TT position, aerobic volume', keySessions: ['sweetspot', 'tempo', 'long'] },
    build: { summary: 'Long threshold blocks', keySessions: ['threshold', 'overunder', 'vo2'] },
    peak: { summary: 'Race-pace efforts', keySessions: ['race_sim', 'threshold', 'endurance'] },
  },
  endurance: {
    base: { summary: 'Long rides and tempo, durability', keySessions: ['long', 'tempo', 'sweetspot'] },
    build: { summary: 'Long rides with sweet spot/threshold blocks', keySessions: ['long', 'threshold', 'sweetspot'] },
    peak: { summary: 'Event-length rides at target pace', keySessions: ['long', 'race_sim', 'tempo'] },
  },
  gravel: {
    build: { summary: 'Threshold plus repeated surges', keySessions: ['threshold', 'overunder', 'long'] },
    peak: { summary: 'Long rides with surges', keySessions: ['race_sim', 'long', 'vo2'] },
  },
};

export function phaseFocus(phase: Phase, specialty: Specialty): PhaseFocus {
  return TWEAKS[specialty]?.[phase] ?? BASE[phase];
}
