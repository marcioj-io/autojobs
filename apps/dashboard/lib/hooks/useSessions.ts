"use client";

import { useQuery } from '@tanstack/react-query';

export function useSessions() {
  return useQuery({
    queryKey: ['sessions', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 15000
  });
}

export default useSessions;
