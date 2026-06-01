"use client";

import { useProfiles } from '../../lib/hooks/useProfiles';
import { ProfileCard } from '../../components/dashboard/ProfileCard';
import { SectionHeader } from '../../components/dashboard/SectionHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useState } from 'react';

export default function ProfilesPage() {
  const { data: profiles, isLoading, isError, error } = useProfiles();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) return <div className="p-6"><CircularProgress /></div>;
  if (isError) return <Alert severity="error">{(error as Error)?.message ?? 'Erro ao carregar perfis'}</Alert>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionHeader title="Perfis" description="Visualize os perfis fixos e seus limites de busca." />
        <Button variant="contained" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancelar' : 'Novo Perfil'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
          <p className="text-slate-400">Formulário de novo perfil será adicionado aqui</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        {profiles && profiles.length > 0 ? (
          profiles.map((profile: any) => (
            <ProfileCard key={profile.id || profile.name} profile={profile} />
          ))
        ) : (
          <p className="text-slate-400 col-span-full">Nenhum perfil configurado</p>
        )}
      </div>
    </div>
  );
}
