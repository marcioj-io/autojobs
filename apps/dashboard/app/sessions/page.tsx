"use client";

import { SectionHeader } from '../../components/dashboard/SectionHeader';
import useSessions from '../../lib/hooks/useSessions';
import useSessionHealth from '../../lib/hooks/useSessionHealth';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

export default function SessionsPage() {
  const { data: sessions, isLoading: sLoading, isError: sError, error: sErrorObj } = useSessions();
  const { data: health, isLoading: hLoading, isError: hError, error: hErrorObj } = useSessionHealth();

  if (sLoading || hLoading) return <div className="p-6"><CircularProgress /></div>;
  if (sError) return <Alert severity="error">{(sErrorObj as Error)?.message ?? 'Erro ao carregar sessões'}</Alert>;
  if (hError) return <Alert severity="error">{(hErrorObj as Error)?.message ?? 'Erro ao carregar health'}</Alert>;

  return (
    <div className="space-y-6">
      <SectionHeader title="Sessions" description="Controle e visualização de sessões LinkedIn." />

      <div className="grid gap-6 lg:grid-cols-2">
        {(sessions ?? []).map((s: any) => (
          <div key={s.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <h3 className="text-lg font-semibold">{s.id}</h3>
            <p>State: {s.state}</p>
            <p>Age: {s.ageMinutes} min</p>
          </div>
        ))}

        {(health ?? []).map((h: any) => (
          <div key={h.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <h3 className="text-lg font-semibold">{h.sessionId}</h3>
            <p>Health: {h.healthScore}</p>
            <p>Last validated: {new Date(h.lastValidatedAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
