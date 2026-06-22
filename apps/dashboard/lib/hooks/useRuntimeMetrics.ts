"use client";

import { useQuery } from '@tanstack/react-query';

export function useRuntimeMetrics() {
  return useQuery({
    queryKey: ['runtime', 'metrics'],
    queryFn: async () => {
      const res = await fetch('/api/runtime/metrics');
      if (!res.ok) throw new Error('Failed to fetch runtime metrics');
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 15000
  });
}

export default useRuntimeMetrics;
