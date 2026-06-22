import type { WorkerJob } from '../../lib/services/workerApi';

interface JobsTableProps {
  jobs: WorkerJob[];
}

export function JobsTable({ jobs }: JobsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-y-3 text-left text-sm">
        <thead>
          <tr className="text-slate-400">
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">Vaga</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Localização</th>
            <th className="px-4 py-3">Modalidade</th>
            <th className="px-4 py-3">Easy Apply</th>
            <th className="px-4 py-3">Data</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="rounded-3xl bg-slate-900 text-slate-200 shadow-inner">
              <td className="px-4 py-4">{job.company}</td>
              <td className="px-4 py-4 font-medium text-slate-100">{job.title}</td>
              <td className="px-4 py-4">{job.score}</td>
              <td className="px-4 py-4 text-slate-300">{job.status}</td>
              <td className="px-4 py-4">{job.location}</td>
              <td className="px-4 py-4">{job.modality}</td>
              <td className="px-4 py-4">{job.easyApply ? 'Sim' : 'Não'}</td>
              <td className="px-4 py-4">{job.postedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
