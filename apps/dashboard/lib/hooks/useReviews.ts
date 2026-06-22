"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useReviews() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['reviews', 'list'],
    queryFn: async () => {
      const res = await fetch('/api/reviews');
      if (!res.ok) throw new Error('Failed to fetch reviews');
      const body = await res.json();
      return body.data;
    },
    refetchInterval: 15000
  });

  const action = useMutation({
    mutationFn: async ({ reviewId, action, note }: { reviewId: string; action: string; note?: string }) => {
      const res = await fetch('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId, action, note }) });
      if (!res.ok) throw new Error('Failed to perform review action');
      const body = await res.json();
      return body.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', 'list'] } as any)
  });

  return { ...query, action };
}

export default useReviews;
