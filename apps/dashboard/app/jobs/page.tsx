import { JobsTable } from '../../components/dashboard/JobsTable';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { mockDashboardData } from '../../lib/mockData';

export default function JobsPage() {
  const { jobs } = mockDashboardData;

  return (
    <div className="space-y-6">
      <SectionHeader title="Vagas" description="Gerencie todas as oportunidades encontradas pelo worker." />
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
        <JobsTable jobs={jobs} />
      </div>
    </div>
  );
}
