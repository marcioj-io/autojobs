"use client";

import { SectionHeader } from '../../components/dashboard/SectionHeader';
import useRuntimeMetrics from '../../lib/hooks/useRuntimeMetrics';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

export default function MetricsPage() {
  const { data: metrics, isLoading, isError, error } = useRuntimeMetrics();

  if (isLoading) return <div className="p-6"><CircularProgress /></div>;
  if (isError) return <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar métricas'}</Alert>;

  return (
    <div className="space-y-6">
      <SectionHeader title="Metrics" description="Métricas operacionais do runtime." />
      <div className="grid gap-6 lg:grid-cols-2">
        {(metrics ?? []).map((m: any) => (
          <div key={m.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <h3 className="text-lg font-semibold">{new Date(m.recordedAt).toLocaleString()}</h3>
            <p>Jobs/day: {m.jobsPerDay}</p>
            <p>Applies/day: {m.appliesPerDay}</p>
            <p>Apply rate: {(m.applySuccessRate * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}
