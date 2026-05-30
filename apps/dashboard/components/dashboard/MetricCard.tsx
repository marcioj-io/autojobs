import type { ReactNode } from 'react';

interface MetricCardProps {
  metric: {
    label: string;
    value: string;
    delta: string;
    icon: ReactNode;
  };
}

export function MetricCard({ metric }: MetricCardProps) {
  const { label, value, delta, icon } = metric;
  return (
    <article className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-slate-100">{value}</p>
        </div>
        <div className="rounded-2xl bg-slate-800 p-3 text-sky-300">{icon}</div>
      </div>
      <p className="mt-4 text-sm text-slate-400">{delta}</p>
    </article>
  );
}
