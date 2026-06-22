"use client";

import { useQuery } from '@tanstack/react-query';

export function useSessionHealth() {
  return useQuery({
    queryKey: ['sessions', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/sessions/health');
      if (!res.ok) throw new Error('Failed to fetch session health');
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 15000
  });
}

export default useSessionHealth;
