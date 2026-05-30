interface SectionHeaderProps {
  title: string;
  description: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">{title}</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-100">{title}</h2>
        </div>
      </div>
      <p className="mt-4 text-slate-400">{description}</p>
    </div>
  );
}
