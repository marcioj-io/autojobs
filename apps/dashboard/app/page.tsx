import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { MetricCard } from '../components/dashboard/MetricCard';
import { JobsTable } from '../components/dashboard/JobsTable';
import { getBackend } from '../lib/services/backend';

export default async function Page() {
  const be = await getBackend((globalThis as any).AUTOJOBS_D1);
  const [jobs, reviews, applications] = await Promise.all([
    be.getJobs(),
    be.getReviews(),
    be.getApplications()
  ]);

  const metrics = [
    {
      label: 'Vagas',
      value: String(jobs.length),
      delta: '',
      icon: '💼'
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
      value: jobs.length ? String(Math.round(jobs.reduce((sum: any, job: any) => sum + (job.score ?? 0), 0) / jobs.length)) : '0',
      delta: '',
      icon: '📈'
    }
  ];

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
                  {reviews.map((review: any) => (
                    <div key={review.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-100">Revisão {review.id}</p>
                          <p className="text-sm text-slate-400">Perfil: {review.profile}</p>
                        </div>
                        <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm text-amber-200">{review.reviewStatus}</span>
                      </div>
                      <p className="mt-3 text-sm text-slate-400">{review.reviewReason || review.reviewNotes || 'Sem motivo disponível'}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-glow backdrop-blur-xl">
                <h3 className="mb-4 text-xl font-semibold text-slate-100">Perfis de busca</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Backend</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">Ativo</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Frontend</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">Ativo</p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">Fullstack</p>
                    <p className="mt-2 text-lg font-semibold text-slate-100">Ativo</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
