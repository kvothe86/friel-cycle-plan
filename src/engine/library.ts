import type { SessionType } from './focus';
import type { Specialty } from './types';
import {
  intensityFactor, intensityFor, maxPower, totalSeconds, workoutTss,
  type Block, type OutdoorGuidance, type Step, type Workout,
} from './workout';

/**
 * Parametric workout templates (PLAN §3.5). Each template fills a main set
 * for the given time at a progression level (1–10); warm-up, cool-down
 * and endurance filler make the workout exactly as long as asked.
 */

const MIN = 60;
const steady = (minutes: number, power: number, label?: string, cadence?: number): Step => ({
  kind: 'steady', seconds: Math.round(minutes * MIN), power, ...(label && { label }), ...(cadence && { cadence }),
});
const ramp = (minutes: number, from: number, to: number, label?: string): Step => ({
  kind: 'ramp', seconds: Math.round(minutes * MIN), from, to, ...(label && { label }),
});
const clampLevel = (l: number) => Math.min(10, Math.max(1, Math.round(l)));
const round2 = (x: number) => Math.round(x * 100) / 100;
const fmtMin = (m: number) => (m % 1 === 0 ? `${m} min` : `${Math.floor(m)}:${String(Math.round((m % 1) * 60)).padStart(2, '0')}`);

export interface BuildContext {
  level: number;
  specialty: Specialty;
  outdoor: boolean;
  /** Overrides endurance power (fraction of FTP) when the week needs more load. */
  endurancePower?: number;
}

/** Top of Z2: endurance rides never go above this. */
export const MAX_ENDURANCE_POWER = 0.75;

interface MainSet {
  name: string;
  description: string;
  blocks: Block[];
}

interface Template {
  id: string;
  /** Builds the whole workout (own warm-up/cool-down, fixed length). */
  selfContained?: boolean;
  type: SessionType;
  /** Shortest total duration (minutes) this template makes sense for. */
  minMinutes: number;
  /** Interval workouts need the trainer; outdoor days get zone guidance instead. */
  indoorOnly: boolean;
  /** Builds the main set within `mainMinutes`. May use less; the rest becomes endurance. */
  main: (mainMinutes: number, ctx: BuildContext) => MainSet;
  outdoor?: (minutes: number, ctx: BuildContext) => OutdoorGuidance;
}

function specialtyCue(specialty: Specialty, type: SessionType): { cadence?: number; note: string } {
  if (specialty === 'climbing' && ['sweetspot', 'threshold', 'overunder', 'tempo'].includes(type)) {
    return { cadence: 70, note: ' Ride the work intervals at 65–75 rpm to mimic climbing.' };
  }
  if (specialty === 'tt' && ['sweetspot', 'threshold', 'tempo'].includes(type)) {
    return { note: ' Ride the work intervals in your TT/aero position.' };
  }
  return { note: '' };
}

/** Fits `reps` × (work + rest) into the time, capped by total work time and max reps. */
function fitReps(mainMinutes: number, work: number, rest: number, maxWork: number, maxReps = 12): number {
  const byTime = Math.floor((mainMinutes + rest) / (work + rest));
  const byWork = Math.floor(maxWork / work);
  return Math.max(0, Math.min(byTime, byWork, maxReps));
}

function intervalSet(label: string, reps: number, work: Step, rest: Step | null): Block {
  // The last rest is dropped: recovery after the final rep is part of the filler/cool-down.
  return { label, repeat: 1, steps: Array.from({ length: reps }, (_, i) => (i < reps - 1 && rest ? [work, rest] : [work])).flat() };
}

const TEMPLATES: Template[] = [
  {
    id: 'recovery', type: 'recovery', minMinutes: 20, indoorOnly: false,
    main: (m) => ({ name: 'Recovery spin', description: 'Very easy spinning, high cadence, no pressure on the pedals.', blocks: [{ label: 'Recovery', repeat: 1, steps: [steady(m, 0.5, 'Easy spin', 95)] }] }),
    outdoor: () => ({ summary: 'Easy spin, stay in Z1. Flat route, no efforts.', zone: 1, minShareInZone: 0.9, maxZone: 2 }),
  },
  {
    id: 'endurance', type: 'endurance', minMinutes: 30, indoorOnly: false,
    main: (m, { level, endurancePower }) => {
      const power = round2(Math.min(MAX_ENDURANCE_POWER, endurancePower ?? 0.62 + 0.01 * level));
      return {
        name: power >= 0.7 ? 'Endurance (upper Z2)' : 'Endurance ride',
        description:
          power >= 0.7
            ? 'Steady upper Z2: purposeful but still aerobic. Smooth pedalling at 85–95 rpm.'
            : 'Steady Z2. Conversational pace, smooth pedalling at 85–95 rpm.',
        blocks: [{ label: 'Endurance', repeat: 1, steps: [steady(m, power, 'Z2 steady', 90)] }],
      };
    },
    outdoor: () => ({ summary: 'Steady endurance: keep at least 80 % of the ride in Z2 or lower. Spin up the climbs, avoid Z4+.', zone: 2, minShareInZone: 0.8, maxZone: 3 }),
  },
  {
    id: 'long', type: 'long', minMinutes: 90, indoorOnly: false,
    main: (m, { level }) => ({
      name: 'Long endurance ride',
      description: 'Long Z2 ride for durability. Eat and drink from the start (60–90 g carbs per hour).',
      blocks: [{ label: 'Long endurance', repeat: 1, steps: [steady(m, round2(0.62 + 0.008 * level), 'Z2 steady', 88)] }],
    }),
    outdoor: () => ({ summary: 'Long Z2 ride: at least 75 % in Z2 or lower. Short Z3 on climbs is fine; avoid Z4+. Fuel every 20–30 min.', zone: 2, minShareInZone: 0.75, maxZone: 3 }),
  },
  {
    id: 'tempo', type: 'tempo', minMinutes: 45, indoorOnly: false,
    main: (m, { level, specialty }) => {
      const work = 10 + 2 * level;
      const reps = Math.max(1, fitReps(m, work, 5, 30 + 6 * level, 4));
      const w = Math.min(work, m);
      const cue = specialtyCue(specialty, 'tempo');
      return {
        name: `Tempo ${reps} × ${fmtMin(w)}`,
        description: `Tempo blocks in Z3: comfortably hard, steady breathing.${cue.note}`,
        blocks: [intervalSet('Tempo', reps, steady(w, round2(0.8 + 0.005 * level), 'Tempo', cue.cadence), steady(5, 0.6, 'Easy'))],
      };
    },
    outdoor: (m) => ({ summary: `Endurance with ${Math.round(Math.min(40, m / 3))} min of Z3 tempo in total, e.g. on climbs or a long flat stretch. Rest of the ride Z2.`, zone: 3, maxZone: 3 }),
  },
  {
    id: 'sweetspot', type: 'sweetspot', minMinutes: 45, indoorOnly: true,
    main: (m, { level, specialty }) => {
      const work = Math.round(8 + 1.2 * level);
      const rest = Math.max(3, Math.round(work / 3));
      const reps = fitReps(m, work, rest, 30 + 6 * level, 6);
      const cue = specialtyCue(specialty, 'sweetspot');
      return {
        name: `Sweet spot ${reps} × ${work} min`,
        description: `Sweet spot (88–93 % FTP): strong but sustainable. The most time-efficient base builder.${cue.note}`,
        blocks: [intervalSet('Sweet spot', reps, steady(work, round2(0.88 + 0.005 * level), 'Sweet spot', cue.cadence), steady(rest, 0.55, 'Recover'))],
      };
    },
  },
  {
    id: 'threshold', type: 'threshold', minMinutes: 45, indoorOnly: true,
    main: (m, { level, specialty }) => {
      const work = 5 + level;
      const rest = Math.max(3, Math.round(work / 2.5));
      const reps = fitReps(m, work, rest, 20 + 4 * level, 5);
      const cue = specialtyCue(specialty, 'threshold');
      return {
        name: `Threshold ${reps} × ${work} min`,
        description: `Threshold intervals at 95–100 % FTP. Hard but even; don't start too fast.${cue.note}`,
        blocks: [intervalSet('Threshold', reps, steady(work, round2(0.95 + 0.005 * level), 'Threshold', cue.cadence), steady(rest, 0.55, 'Recover'))],
      };
    },
  },
  {
    id: 'overunder', type: 'overunder', minMinutes: 50, indoorOnly: true,
    main: (m, { level, specialty }) => {
      const k = 2 + Math.floor(level / 3);
      const setMin = k * 3;
      const sets = fitReps(m, setMin, 5, 12 + 4 * level, 4);
      const cue = specialtyCue(specialty, 'overunder');
      const set: Step[] = Array.from({ length: k }, () => [steady(2, 0.95, 'Under', cue.cadence), steady(1, 1.05, 'Over', cue.cadence)]).flat();
      return {
        name: `Over-unders ${sets} × ${setMin} min`,
        description: `Alternate 2 min just under and 1 min just over threshold. Teaches you to clear lactate while riding hard.${cue.note}`,
        blocks: Array.from({ length: sets }, (_, i) => ({ label: `Set ${i + 1}`, repeat: 1, steps: i < sets - 1 ? [...set, steady(5, 0.55, 'Recover')] : set })),
      };
    },
  },
  {
    id: 'vo2', type: 'vo2', minMinutes: 45, indoorOnly: true,
    main: (m, { level }) => {
      const work = Math.round((2 + 0.3 * level) * 2) / 2;
      const power = round2(1.2 - (work - 2) * 0.03);
      const reps = fitReps(m, work, work, 12 + 2 * level, 8);
      return {
        name: `VO2max ${reps} × ${fmtMin(work)}`,
        description: 'VO2max intervals (110–120 % FTP). Breathing maxed out by the end of each rep; recover fully in between.',
        blocks: [intervalSet('VO2max', reps, steady(work, power, 'VO2max', 100), steady(work, 0.5, 'Recover'))],
      };
    },
  },
  {
    id: 'vo2_3030', type: 'vo2', minMinutes: 40, indoorOnly: true,
    main: (m, { level }) => {
      const k = 6 + Math.floor(level / 2);
      const sets = fitReps(m, k, 5, 30, 3);
      const set: Step[] = Array.from({ length: k }, () => [steady(0.5, round2(1.2 + 0.01 * level), 'On', 100), steady(0.5, 0.5, 'Off')]).flat();
      return {
        name: `30/30s ${sets} × ${k}`,
        description: '30 s hard / 30 s easy. Lots of time near VO2max with shorter, more manageable efforts.',
        blocks: Array.from({ length: sets }, (_, i) => ({ label: `Set ${i + 1}`, repeat: 1, steps: i < sets - 1 ? [...set, steady(5, 0.55, 'Recover')] : set })),
      };
    },
  },
  {
    id: 'anaerobic', type: 'anaerobic', minMinutes: 45, indoorOnly: true,
    main: (m, { level }) => {
      const reps = fitReps(m, 1, 4, 4 + level, 10);
      return {
        name: `Anaerobic ${reps} × 1 min`,
        description: 'One-minute efforts well above VO2max. Start hard, hold on. Full recovery in between.',
        blocks: [intervalSet('Anaerobic', reps, steady(1, round2(1.3 + 0.01 * level), 'Hard', 105), steady(4, 0.5, 'Recover'))],
      };
    },
  },
  {
    id: 'sprint', type: 'sprint', minMinutes: 40, indoorOnly: true,
    main: (m, { level }) => {
      const reps = Math.max(1, Math.min(4 + Math.floor(level / 2), Math.floor(m / 5)));
      return {
        name: `Endurance with ${reps} sprints`,
        description: 'Z2 ride with short all-out sprints. Turn ERG off for the sprints (or use a heavy gear), seated then standing.',
        blocks: [intervalSet('Sprints', reps, steady(0.25, 1.8, 'Sprint', 110), steady(4.75, 0.6, 'Easy'))],
      };
    },
  },
  {
    id: 'race_sim', type: 'race_sim', minMinutes: 50, indoorOnly: true,
    main: (m, { level }) => {
      const sets = fitReps(m, 15, 4, 30 + 3 * level, 4);
      const set: Step[] = Array.from({ length: 3 }, () => [steady(4, 0.9, 'Hold'), steady(1, round2(1.15 + 0.01 * level), 'Surge')]).flat();
      return {
        name: `Race simulation ${sets} × 15 min`,
        description: 'Steady high tempo with hard surges every few minutes: the rhythm of a race.',
        blocks: Array.from({ length: sets }, (_, i) => ({ label: `Set ${i + 1}`, repeat: 1, steps: i < sets - 1 ? [...set, steady(4, 0.55, 'Recover')] : set })),
      };
    },
  },
  {
    // Ramp test: +6 % FTP every minute until you can't hold it. FTP ≈ 75 % of the best minute.
    id: 'ramp_test', type: 'ftp_test', minMinutes: 35, indoorOnly: true, selfContained: true,
    main: () => ({
      name: 'FTP ramp test',
      description: 'Ramp test: the target rises every minute. Keep going until you cannot hold it any more, then end the ride. FTP ≈ 75 % of your best minute.',
      blocks: [
        { label: 'Warm-up', repeat: 1, steps: [steady(5, 0.45, 'Easy')] },
        { label: 'Ramp', repeat: 1, steps: Array.from({ length: 20 }, (_, i) => steady(1, round2(0.5 + 0.06 * i), `Ramp ${i + 1}`)) },
        { label: 'Cool-down', repeat: 1, steps: [ramp(10, 0.5, 0.4, 'Cool-down')] },
      ],
    }),
  },
  {
    // Classic 20-minute test: FTP ≈ 95 % of the 20-minute average. ERG is off for the test block.
    id: 'ftp20', type: 'ftp_test', minMinutes: 60, indoorOnly: true, selfContained: true,
    main: () => ({
      name: 'FTP 20-minute test',
      description: '20-minute test: after the warm-up, ride the 20 minutes as hard as you can sustain evenly. ERG is off for that block. FTP ≈ 95 % of the 20-minute average.',
      blocks: [
        { label: 'Warm-up', repeat: 1, steps: [ramp(15, 0.5, 0.75, 'Warm-up')] },
        intervalSet('Openers', 3, steady(1, 1.05, 'Opener'), steady(1, 0.55, 'Easy')),
        { label: 'Easy', repeat: 1, steps: [steady(9, 0.55, 'Easy')] },
        { label: 'Test', repeat: 1, steps: [{ ...steady(20, 1.0, 'All-out 20 min'), free: true }] },
        { label: 'Cool-down', repeat: 1, steps: [ramp(10, 0.55, 0.4, 'Cool-down')] },
      ],
    }),
  },
  {
    id: 'openers', type: 'openers', minMinutes: 30, indoorOnly: false,
    main: () => ({
      name: 'Race openers',
      description: 'Short sharp efforts to wake the legs up the day before an event. Keep it short.',
      blocks: [
        intervalSet('Openers', 3, steady(1, 1.1, 'Opener'), steady(2, 0.55, 'Easy')),
        { label: 'Easy', repeat: 1, steps: [steady(2, 0.55, 'Easy')] },
        intervalSet('Sprints', 3, steady(1 / 6, 1.5, 'Sprint'), steady(2 + 5 / 6, 0.55, 'Easy')),
      ],
    }),
    outdoor: () => ({ summary: 'Easy ride with 3 × 1 min hard and 3 short sprints. Total no longer than 45–60 min.', zone: 2, maxZone: 6 }),
  },
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

export function templatesFor(type: SessionType): Template[] {
  return TEMPLATES.filter((t) => t.type === type);
}

export function minMinutesFor(type: SessionType, outdoor = false): number {
  const ts = templatesFor(type).filter((t) => !outdoor || !t.indoorOnly);
  return ts.length ? Math.min(...ts.map((t) => t.minMinutes)) : Infinity;
}

export function canRideOutdoor(type: SessionType): boolean {
  return templatesFor(type).some((t) => !t.indoorOnly);
}

function warmupMinutes(total: number) {
  return total >= 60 ? 10 : total >= 40 ? 8 : 5;
}
function cooldownMinutes(total: number) {
  return total >= 60 ? 8 : 5;
}

/**
 * Builds a workout of exactly `minutes` from a template. `variant` picks
 * between templates of the same type (e.g. VO2 long intervals vs 30/30s).
 */
export function buildWorkout(type: SessionType, minutes: number, ctx: BuildContext, variant = 0): Workout {
  const options = templatesFor(type).filter((t) => !ctx.outdoor || !t.indoorOnly);
  const tpl = options[variant % Math.max(1, options.length)] ?? BY_ID.get('endurance')!;
  const level = clampLevel(ctx.level);
  const total = Math.max(tpl.minMinutes, Math.round(minutes));
  const c = { ...ctx, level };

  let blocks: Block[];
  let name: string;
  let description: string;

  if (tpl.selfContained) {
    ({ name, description, blocks } = tpl.main(total, c));
  } else if (tpl.id === 'recovery' || tpl.id === 'endurance' || tpl.id === 'long') {
    ({ name, description, blocks } = tpl.main(total, c));
  } else {
    const wu = warmupMinutes(total);
    const cd = cooldownMinutes(total);
    const mainMinutes = total - wu - cd;
    const main = tpl.main(mainMinutes, c);
    const used = totalSeconds(main.blocks);
    const filler = mainMinutes * MIN - used;
    blocks = [
      { label: 'Warm-up', repeat: 1, steps: [ramp(wu, 0.5, 0.75, 'Warm-up')] },
      ...main.blocks,
      ...(filler >= MIN ? [{ label: 'Endurance', repeat: 1, steps: [{ kind: 'steady' as const, seconds: filler, power: 0.65, label: 'Z2' }] }] : []),
      { label: 'Cool-down', repeat: 1, steps: [ramp(cd + (filler > 0 && filler < MIN ? filler / MIN : 0), 0.6, 0.45, 'Cool-down')] },
    ];
    ({ name, description } = main);
  }

  const ifactor = intensityFactor(blocks);
  const workout: Workout = {
    templateId: tpl.id,
    type,
    name,
    description,
    intensity: intensityFor(ifactor, maxPower(blocks)),
    blocks,
    seconds: totalSeconds(blocks),
    tss: Math.round(workoutTss(blocks)),
    intensityFactor: round2(ifactor),
    level,
  };
  if (ctx.outdoor && tpl.outdoor) workout.outdoor = tpl.outdoor(total, c);
  return workout;
}

/** Approximate TSS per hour of an endurance ride at a given level, for load budgeting. */
export function enduranceTssPerHour(level: number): number {
  const p = 0.62 + 0.01 * clampLevel(level);
  return p * p * 100;
}
