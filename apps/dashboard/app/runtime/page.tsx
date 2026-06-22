import { SectionHeader } from '../../components/dashboard/SectionHeader';
import RuntimeOverviewCard from '../../components/dashboard/runtime/RuntimeOverviewCard';

export default function RuntimePage() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Runtime" description="Status operacional, controles e histórico do runtime." />
      <div className="grid gap-6 xl:grid-cols-3">
        <RuntimeOverviewCard />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Metrics and timeline panels go here */}
      </div>
    </div>
  );
}
