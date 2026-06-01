"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSettings } from '../services/workerApi';

export interface SettingsState {
  id: string;
  minScore: number;
  autoApply: boolean;
  maxDailyApplications: number;
}

export function useSettings(settingsId: string = 'default') {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['settings', settingsId],
    queryFn: async () => {
      return await fetchSettings(settingsId);
    },
    refetchInterval: 30000
  });

  const update = useMutation({
    mutationFn: async (settings: Partial<SettingsState>) => {
      const res = await fetch(`/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: settingsId, ...settings })
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', settingsId] } as any)
  });

  return { ...query, update };
}

export default useSettings;
