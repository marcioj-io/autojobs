"use client";

import { SectionHeader } from '../../components/dashboard/SectionHeader';
import { JobsTable } from '../../components/dashboard/JobsTable';
import useApplications from '../../lib/hooks/useApplications';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

export default function ApplicationsPage() {
  const { data: apps, isLoading, isError, error } = useApplications();

  if (isLoading) return <div className="p-6"><CircularProgress /></div>;
  if (isError) return <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar aplicações'}</Alert>;

  return (
    <div className="space-y-6">
      <SectionHeader title="Applications" description="Histórico de aplicações e resultados." />
      <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
        <JobsTable jobs={(apps ?? []).map((a: any) => ({ id: a.id, title: a.title, company: a.company, score: 0, status: a.status, location: '', modality: '', easyApply: false, postedAt: a.appliedAt }))} />
      </div>
    </div>
  );
}
