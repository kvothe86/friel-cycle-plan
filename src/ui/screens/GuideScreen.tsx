import { POWER_ZONES, ZONE_FLOOR } from '../../engine/workout';

/** How CyclingHub plans, in plain words. */
export function GuideScreen() {
  return (
    <section className="guide">
      <h1>How CyclingHub plans</h1>

      <div className="card">
        <h2>1. The season</h2>
        <p>
          Your A goal sets the season. Counting back from the event, the weeks are split into <strong>Base</strong> (aerobic volume, sweet
          spot), <strong>Build</strong> (threshold and VO2max), <strong>Peak</strong> (race-specific, less volume) and the{' '}
          <strong>Race</strong> week (taper, openers). Every 3rd or 4th week is a recovery week. Without a dated goal, the plan rolls
          16-week blocks for your specialty.
        </p>
        <p>
          Fitness (CTL) is planned to rise by 3–7 per week depending on your experience, but never beyond what your available time allows.
          B events get a lighter week; C events are trained through.
        </p>
      </div>

      <div className="card">
        <h2>2. The week and each day</h2>
        <p>
          Each week gets 1–3 <strong>key sessions</strong> (by phase and specialty) on your longest free days, never two hard days in a row.
          Interval sessions go on indoor days; outdoor days get zone guidance. The remaining days are endurance rides that fill up to the
          week's load target, or rest. Only today is fixed; the next 13 days are a forecast that re-plans whenever something changes.
        </p>
        <p>
          Your own workouts in intervals.icu are fixed days the plan works around. Missed sessions are written off: the rest of the week
          gets at most 10 % more than its share, so missed load is never crammed in.
        </p>
      </div>

      <div className="card">
        <h2>3. Readiness, illness and levels</h2>
        <p>
          <strong>Readiness</strong> (0–100) combines HRV and resting HR against your own baseline, sleep, form (TSB) and how you feel. Below
          40 today becomes a recovery ride; 40–60 rules out hard sessions. The key session moves to another day when one fits.
        </p>
        <p>
          <strong>Sick or injured:</strong> rest until you're better (at least 3 days if you don't know), then re-entry (short endurance) and
          reload (no threshold/VO2) before the normal plan resumes. Severe illness adds 2 rest days and a longer return.
        </p>
        <p>
          <strong>Progression levels</strong> (1–10 per energy system) go up after planned sessions you complete and down after ones you
          can't finish. Key sessions are built half a level above your current level.
        </p>
      </div>

      <div className="card">
        <h2>4. Power zones</h2>
        <table className="table compact">
          <tbody>
            {POWER_ZONES.map((z, i) => (
              <tr key={z.zone}>
                <td><span className="zone-dot" style={{ background: z.color }} /> Z{z.zone}</td>
                <td>{z.name}</td>
                <td className="num">{Math.round(ZONE_FLOOR[i]! * 100)}–{Number.isFinite(z.max) ? `${Math.round(z.max * 100)}%` : '…'} FTP</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">
          Sweet spot is 88–93 % FTP. Test your FTP every 6–8 weeks (ramp test or 20-minute test); the app reminds you after 8 weeks.
        </p>
      </div>
    </section>
  );
}
