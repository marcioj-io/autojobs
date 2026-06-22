"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchProfiles, WorkerProfile } from '../services/workerApi';

export function useProfiles() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['profiles', 'list'],
    queryFn: async () => {
      return await fetchProfiles();
    },
    refetchInterval: 15000
  });

  const create = useMutation({
    mutationFn: async (profile: Partial<WorkerProfile>) => {
      const res = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error('Failed to create profile');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles', 'list'] } as any)
  });

  const update = useMutation({
    mutationFn: async (profile: WorkerProfile) => {
      const res = await fetch(`/api/profiles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles', 'list'] } as any)
  });

  const delete_ = useMutation({
    mutationFn: async (profileId: string) => {
      const res = await fetch(`/api/profiles?id=${profileId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete profile');
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles', 'list'] } as any)
  });

  return { ...query, create, update, delete: delete_ };
}

export default useProfiles;
