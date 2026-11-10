import { AvailabilityCard } from '../goals/AvailabilityCard';
import { GoalsCard } from '../goals/GoalsCard';
import { OverridesCard } from '../goals/OverridesCard';
import { PlanSettingsCard } from '../goals/PlanSettingsCard';
import { PageHeader } from '../components/PageHeader';

export function GoalsScreen() {
  return (
    <section className="screen">
      <PageHeader eyebrow="Planning inputs" title="Goals & availability" />
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
