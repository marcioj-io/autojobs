"use client";

import { useSettings, SettingsState } from '../../lib/hooks/useSettings';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { useState } from 'react';

export default function SettingsPage() {
  const { data: settings, isLoading, isError, error, update } = useSettings('default');
  const [formData, setFormData] = useState<Partial<SettingsState>>({});
  const [editMode, setEditMode] = useState(false);

  if (isLoading) return <div className="p-6"><CircularProgress /></div>;
  if (isError) return <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar settings'}</Alert>;

  const currentSettings = settings || { id: 'default', minScore: 0, autoApply: true, maxDailyApplications: 5 };

  const handleSave = async () => {
    await update.mutateAsync(formData);
    setEditMode(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Settings" description="Ajuste regras de score, limites e parâmetros automáticos." />
        {!editMode && <Button variant="contained" onClick={() => setEditMode(true)}>Editar</Button>}
        {editMode && (
          <>
            <Button variant="contained" color="success" onClick={handleSave}>Salvar</Button>
            <Button variant="outlined" onClick={() => setEditMode(false)}>Cancelar</Button>
          </>
        )}
      </div>

      {editMode ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <label className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Score Mínimo</label>
            <TextField
              type="number"
              fullWidth
              value={formData.minScore ?? currentSettings.minScore}
              onChange={(e) => setFormData({ ...formData, minScore: parseInt(e.target.value) })}
              sx={{ mt: 2, '& .MuiOutlinedInput-root': { color: '#e2e8f0' } }}
            />
            <p className="mt-2 text-sm text-slate-400">Valor mínimo para aplicar automaticamente em uma vaga.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <label className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Aplicações Diárias</label>
            <TextField
              type="number"
              fullWidth
              value={formData.maxDailyApplications ?? currentSettings.maxDailyApplications}
              onChange={(e) => setFormData({ ...formData, maxDailyApplications: parseInt(e.target.value) })}
              sx={{ mt: 2, '& .MuiOutlinedInput-root': { color: '#e2e8f0' } }}
            />
            <p className="mt-2 text-sm text-slate-400">Número máximo de aplicações diárias permitido.</p>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl col-span-full">
            <FormControlLabel
              control={<Switch checked={formData.autoApply ?? currentSettings.autoApply} onChange={(e) => setFormData({ ...formData, autoApply: e.target.checked })} />}
              label="Auto Apply (aplicar automaticamente em vagas Classe A)"
              sx={{ color: '#e2e8f0' }}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Score</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">Mínimo {currentSettings.minScore}</p>
            <p className="mt-2 text-sm text-slate-400">Valor mínimo para aplicar automaticamente em uma vaga.</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Auto Apply</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">{currentSettings.autoApply ? 'Ativo' : 'Desativado'}</p>
            <p className="mt-2 text-sm text-slate-400">Controle se o worker deve aplicar automaticamente em vagas Classe A.</p>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-glow backdrop-blur-xl">
            <p className="text-sm uppercase tracking-[0.3em] text-sky-300/80">Limite diário</p>
            <p className="mt-3 text-3xl font-semibold text-slate-100">{currentSettings.maxDailyApplications}</p>
            <p className="mt-2 text-sm text-slate-400">Número máximo de aplicações diárias permitido.</p>
          </div>
        </div>
      )}
    </div>
  );
}
