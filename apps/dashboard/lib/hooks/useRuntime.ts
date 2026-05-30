"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

type RuntimeOverview = any;

export function useRuntime() {
  const qc = useQueryClient();

  const query = useQuery<RuntimeOverview>({
    queryKey: ['runtime', 'overview'],
    queryFn: async () => {
      const res = await fetch('/api/runtime');
      if (!res.ok) throw new Error('Failed to fetch runtime overview');
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 10000
  });

  const control = useMutation({
    mutationFn: async (action: string) => {
      const res = await fetch('/api/runtime', { method: 'POST', body: JSON.stringify({ action }), headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error('Failed to perform runtime action');
      const body = await res.json();
      return body.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['runtime', 'overview'] } as any)
  });

  return { ...query, control };
}

export default useRuntime;
