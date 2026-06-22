import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';

export function Topbar() {
  return (
    <div className="mb-8 flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/85 p-6 shadow-glow backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Bem-vindo de volta</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-100">Painel de automação</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Monitoramento diário de vagas, score, filas manuais e desempenho de aplicações.
        </p>
      </div>
      <div className="flex items-center gap-3 rounded-3xl bg-slate-900 p-4 text-slate-300">
        <div className="rounded-2xl bg-slate-800 p-3 text-sky-300">
          <TrendingUpOutlinedIcon />
        </div>
        <div>
          <p className="text-sm uppercase text-slate-500">Performance</p>
          <p className="text-lg font-semibold text-slate-100">+12% este mês</p>
        </div>
        <button className="ml-4 inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
          <NotificationsNoneOutlinedIcon className="h-4 w-4" />
          Atualizar
        </button>
      </div>
    </div>
  );
}
