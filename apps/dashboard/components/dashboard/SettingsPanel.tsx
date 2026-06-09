// apps\dashboard\components\dashboard\SettingsPanel.tsx
interface SettingsState {
  minScore: number;
  maxDailyApplications: number;
  autoApply: boolean;
  preferredLocation: string;
  blacklistedKeywords: string[];
}

interface SettingsPanelProps {
  settings: SettingsState;
}

export function SettingsPanel({ settings }: SettingsPanelProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Score</p>
        <p className="mt-3 text-3xl font-semibold text-slate-100">Mínimo {settings.minScore}</p>
        <p className="mt-2 text-sm text-slate-400">Valor mínimo para aplicar automaticamente em uma vaga.</p>
      </div>
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Auto Apply</p>
        <p className="mt-3 text-3xl font-semibold text-slate-100">{settings.autoApply ? 'Ativo' : 'Desativado'}</p>
        <p className="mt-2 text-sm text-slate-400">Controle se o worker deve aplicar automaticamente em vagas Classe A.</p>
      </div>
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Limite diário</p>
        <p className="mt-3 text-3xl font-semibold text-slate-100">{settings.maxDailyApplications}</p>
        <p className="mt-2 text-sm text-slate-400">Número máximo de aplicações diárias permitido.</p>
      </div>
    </div>
  );
}
