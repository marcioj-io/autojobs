"use client";

import { useEffect, useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { MetricCard } from '../components/dashboard/MetricCard';
import { JobsTable } from '../components/dashboard/JobsTable';
import { fetchJobs, fetchReviews, fetchApplications, fetchProfiles, WorkerJob, WorkerReview, WorkerApplication, WorkerProfile } from '../lib/services/workerApi';

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<WorkerJob[]>([]);
  const [reviews, setReviews] = useState<WorkerReview[]>([]);
  const [applications, setApplications] = useState<WorkerApplication[]>([]);
  const [profiles, setProfiles] = useState<WorkerProfile[]>([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [j, r, a, p] = await Promise.all([
        fetchJobs(),
        fetchReviews(),
        fetchApplications(),
        fetchProfiles()
      ]);
      setJobs(j);
      setReviews(r);
      setApplications(a);
      setProfiles(p);
      setLoading(false);
    }
    loadData();
  }, []);

  // Calculate metrics from real data
  const avgScore = jobs.length > 0
    ? Math.round(jobs.reduce((sum, job) => sum + (job.score || 0), 0) / jobs.length)
    : 0;

  const metrics = [
    {
      label: 'Vagas encontradas',
      value: String(jobs.length),
      delta: '',
      icon: '🔥'
    },
    {
      label: 'Aplicações automáticas',
      value: String(applications.length),
      delta: '',
      icon: '✅'
    },
    {
      label: 'Pendências',
      value: String(reviews.length),
      delta: '',
      icon: '⏳'
    },
    {
      label: 'Score médio',
      value: String(avgScore),
      delta: '',
      icon: '📈'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6 lg:p-10 flex items-center justify-center">
            <p className="text-slate-400">Carregando dados reais...</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 p-6 lg:p-10">
          <Topbar />

          <section className="space-y-6">
            <div className="grid gap-5 xl:grid-cols-4 lg:grid-cols-2">
              {metrics.map((metric) => (
                <MetricCard key={metric.label} metric={metric} />
              ))}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Jobs</p>
                  <h2 className="text-2xl font-semibold text-slate-100">Oportunidades recentes</h2>
                </div>
              </div>
              <JobsTable jobs={jobs} />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
                <h3 className="mb-4 text-xl font-semibold text-slate-100">Fila de revisão manual</h3>
                <p className="text-slate-400">As vagas com necessidade de análise humana aparecem aqui para aprovação rápida.</p>
                <div className="mt-6 space-y-3">
                  {reviews && reviews.length > 0 ? (
                    reviews.slice(0, 3).map((review) => (
                      <div key={review.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-100">{review.title}</p>
                            <p className="text-sm text-slate-400">{review.company}</p>
                          </div>
                          <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm text-amber-200">{review.category}</span>
                        </div>
                        <p className="mt-3 text-sm text-slate-400">{review.note}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">Nenhuma revisão pendente</p>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
                <h3 className="mb-4 text-xl font-semibold text-slate-100">Perfis de busca</h3>
                <div className="space-y-3">
                  {profiles && profiles.length > 0 ? (
                    profiles.map((profile) => (
                      <div key={profile.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-100">{profile.name}</p>
                          <span className={`text-sm px-2 py-1 rounded ${profile.status === 'Ativo' ? 'bg-green-500/15 text-green-200' : 'bg-slate-700 text-slate-300'}`}>
                            {profile.status}
                          </span>
                        </div>
                        {profile.seniority && <p className="text-xs text-slate-400 mt-1">{profile.seniority}</p>}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">Nenhum perfil configurado</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
