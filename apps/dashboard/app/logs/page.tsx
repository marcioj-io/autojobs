"use client";

import { LogsTable } from '../../components/dashboard/LogsTable';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import useLogs from '../../lib/hooks/useLogs';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

export default function LogsPage() {
  const { data: logs, isLoading, isError, error } = useLogs();

  if (isLoading) return <div className="p-6"><CircularProgress /></div>;
  if (isError) return <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar logs'}</Alert>;

  return (
    <div className="space-y-6">
      <SectionHeader title="Logs" description="Veja erros, execuções e eventos importantes do worker." />
      <LogsTable logs={logs ?? []} />
    </div>
  );
}
