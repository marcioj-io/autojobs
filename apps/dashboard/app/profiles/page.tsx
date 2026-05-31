import { ProfileCard } from '../../components/dashboard/ProfileCard';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { getBackend } from '../../lib/services/backend';

export default async function ProfilesPage() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const profiles = await be.getProfiles();

  return (
    <div className="space-y-6">
      <SectionHeader title="Perfis" description="Visualize os perfis fixos e seus limites de busca." />
      <div className="grid gap-5 xl:grid-cols-3">
        {profiles.map((profile: any) => (
          <ProfileCard key={profile.name} profile={profile} />
        ))}
      </div>
    </div>
  );
}
