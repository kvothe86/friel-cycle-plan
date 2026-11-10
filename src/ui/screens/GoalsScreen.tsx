import { AvailabilityCard } from '../goals/AvailabilityCard';
import { GoalsCard } from '../goals/GoalsCard';
import { OverridesCard } from '../goals/OverridesCard';
import { PlanSettingsCard } from '../goals/PlanSettingsCard';

export function GoalsScreen() {
  return (
    <section>
      <h1>Goals & availability</h1>
      <GoalsCard />
      <div className="two-col">
        <AvailabilityCard />
        <div>
          <OverridesCard />
          <PlanSettingsCard />
        </div>
      </div>
    </section>
  );
}
