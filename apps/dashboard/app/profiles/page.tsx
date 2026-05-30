import { ProfileCard } from '../../components/dashboard/ProfileCard';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { mockDashboardData } from '../../lib/mockData';

export default function ProfilesPage() {
  const { profiles } = mockDashboardData;

  return (
    <div className="space-y-6">
      <SectionHeader title="Perfis" description="Visualize os perfis fixos e seus limites de busca." />
      <div className="grid gap-5 xl:grid-cols-3">
        {profiles.map((profile) => (
          <ProfileCard key={profile.name} profile={profile} />
        ))}
      </div>
    </div>
  );
}
