import { JobsTable } from '../../components/dashboard/JobsTable';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { Section, Card } from '../../components/layout/PageWrapper';
import { fetchJobs } from '../../lib/services/workerApi';

export default async function JobsPage() {
  const jobs = await fetchJobs();

  return (
    <Section>
      <SectionHeader title="Vagas" description="Gerencie todas as oportunidades encontradas pelo worker." />
      <Card>
        <JobsTable jobs={jobs} />
      </Card>
    </Section>
  );
}
