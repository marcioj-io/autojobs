"use client";

import { useState, useEffect } from 'react';
import { WorkerProfile } from '../../lib/services/workerApi';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Select, { SelectChangeEvent } from '@mui/material/Select';

interface ProfileFormProps {
  profile?: WorkerProfile | null;
  isLoading?: boolean;
  onSubmit: (profile: Partial<WorkerProfile>) => Promise<void>;
  onCancel: () => void;
}

export function ProfileForm({ profile, isLoading = false, onSubmit, onCancel }: ProfileFormProps) {
  const [formData, setFormData] = useState<Partial<WorkerProfile>>({
    name: '',
    status: 'Ativo',
    dailyLimit: 25,
    minScore: 70,
    seniority: 'mid',
    cv: ''
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData(profile);
    }
  }, [profile]);

  // const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | { name?: string; value: any }) => {
  //   let name: string | undefined;
  //   let value: any;

  //   if ('target' in e) {
  //     // Event from HTML input/textarea
  //     name = e.target?.name;
  //     value = e.target?.value;
  //   } else {
  //     // Object from MUI Select
  //     name = e.name;
  //     value = e.value;
  //   }
    
  //   if (!name) return;

  //   setFormData(prev => ({
  //     ...prev,
  //     [name]: name === 'dailyLimit' || name === 'minScore' ? parseInt(value, 10) : value
  //   }));
  //   setError(null);
  // }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string>
  ) => {
    const name = e.target.name;
    const value = e.target.value;

    if (!name) return;

    setFormData(prev => ({
      ...prev,
      [name]: name === 'dailyLimit' || name === 'minScore' ? parseInt(value as string, 10) : value
    }));
    setError(null);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.name?.trim()) {
      setError('Nome do perfil é obrigatório');
      return;
    }

    if (!formData.dailyLimit || formData.dailyLimit <= 0) {
      setError('Limite diário deve ser maior que 0');
      return;
    }

    if (formData.minScore === undefined || formData.minScore < 0 || formData.minScore > 100) {
      setError('Score mínimo deve estar entre 0 e 100');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      // Form will be closed by parent via onCancel callback after mutation succeeds
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5">
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        fullWidth
        label="Nome do Perfil"
        name="name"
        value={formData.name || ''}
        onChange={handleChange}
        placeholder="ex: backend, frontend, fullstack"
        disabled={isSubmitting || isLoading}
        variant="outlined"
        size="small"
      />

      <FormControl fullWidth size="small" disabled={isSubmitting || isLoading}>
        <InputLabel>Status</InputLabel>
        <Select
          name="status"
          value={formData.status || 'Ativo'}
          onChange={handleChange}
          label="Status"
        >
          <MenuItem value="Ativo">Ativo</MenuItem>
          <MenuItem value="Inativo">Inativo</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="Limite Diário de Aplicações"
        name="dailyLimit"
        type="number"
        value={formData.dailyLimit || 25}
        onChange={handleChange}
        inputProps={{ min: 1, step: 1 }}
        disabled={isSubmitting || isLoading}
        variant="outlined"
        size="small"
      />

      <TextField
        fullWidth
        label="Score Mínimo (0-100)"
        name="minScore"
        type="number"
        value={formData.minScore || 70}
        onChange={handleChange}
        inputProps={{ min: 0, max: 100, step: 1 }}
        disabled={isSubmitting || isLoading}
        variant="outlined"
        size="small"
      />

      <FormControl fullWidth size="small" disabled={isSubmitting || isLoading}>
        <InputLabel>Nível de Senioridade</InputLabel>
        <Select
          name="seniority"
          value={formData.seniority || 'mid'}
          onChange={handleChange}
          label="Nível de Senioridade"
        >
          <MenuItem value="junior">Junior</MenuItem>
          <MenuItem value="mid">Mid-level</MenuItem>
          <MenuItem value="senior">Senior</MenuItem>
          <MenuItem value="lead">Lead</MenuItem>
        </Select>
      </FormControl>

      <TextField
        fullWidth
        label="CV / Descrição"
        name="cv"
        value={formData.cv || ''}
        onChange={handleChange}
        placeholder="Breve descrição do CV ou experiências principais"
        multiline
        rows={3}
        disabled={isSubmitting || isLoading}
        variant="outlined"
        size="small"
      />

      <div className="flex gap-3 justify-end pt-4">
        <Button
          variant="outlined"
          onClick={onCancel}
          disabled={isSubmitting || isLoading}
        >
          Cancelar
        </Button>
        <Button
          variant="contained"
          type="submit"
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? <CircularProgress size={20} /> : (profile ? 'Atualizar' : 'Criar')} Perfil
        </Button>
      </div>
    </form>
  );
}
