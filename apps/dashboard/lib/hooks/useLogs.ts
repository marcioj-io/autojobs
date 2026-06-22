"use client";

import { useQuery } from '@tanstack/react-query';

export function useLogs() {
  return useQuery({
    queryKey: ['logs', 'recent'],
    queryFn: async () => {
      const res = await fetch('/api/logs');
      if (!res.ok) throw new Error('Failed to fetch logs');
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 15000
  });
}

export default useLogs;
