interface ProfileSummary {
  id: string;
  name: string;
  status: string;
  seniority: string;
  dailyLimit: number;
  minScore: number;
  cv?: string;
}

interface ProfileCardProps {
  profile: ProfileSummary;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">{profile.name}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">{profile.status}</p>
        </div>
        <span className="rounded-2xl bg-slate-800 px-3 py-1 text-sm text-slate-300">{profile.seniority}</span>
      </div>
      <div className="mt-6 space-y-3 text-sm text-slate-400">
        <p>Limite diário: {profile.dailyLimit}</p>
        <p>Score mínimo: {profile.minScore}</p>
        <p>CV: {profile.cv}</p>
      </div>
    </div>
  );
}
