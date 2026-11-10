/**
 * FTP estimates from test rides (PLAN §7: FTP test protocols).
 *  - Ramp test: 75 % of the best 1-minute power.
 *  - 20-minute test: 95 % of the best 20-minute average.
 */

export type FtpTestKind = 'ramp' | 'ftp20';

export const TEST_OF_TEMPLATE: Record<string, FtpTestKind> = { ramp_test: 'ramp', ftp20: 'ftp20' };
export const RAMP_FACTOR = 0.75;
export const TWENTY_MIN_FACTOR = 0.95;
/** Suggest a new test after this long. */
export const TEST_DUE_DAYS = 56;

/** Best average power over any `seconds`-long window of 1 Hz samples. */
export function bestAverage(powers: readonly number[], seconds: number): number | null {
  if (powers.length < seconds) return null;
  let sum = 0;
  let best = 0;
  for (let i = 0; i < powers.length; i++) {
    sum += powers[i]!;
    if (i >= seconds) sum -= powers[i - seconds]!;
    if (i >= seconds - 1) best = Math.max(best, sum / seconds);
  }
  return best;
}

export function estimateFtp(kind: FtpTestKind, powers: readonly number[]): number | null {
  const best = kind === 'ramp' ? bestAverage(powers, 60) : bestAverage(powers, 20 * 60);
  if (best === null || best <= 0) return null;
  return Math.round(best * (kind === 'ramp' ? RAMP_FACTOR : TWENTY_MIN_FACTOR));
}
