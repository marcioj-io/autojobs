"use client";

import { useQuery } from '@tanstack/react-query';

export function useApplications(page = 1, perPage = 25) {
  return useQuery({
    queryKey: ['applications', page, perPage],
    queryFn: async () => {
      const res = await fetch(`/api/applications?page=${page}&perPage=${perPage}`);
      if (!res.ok) throw new Error('Failed to fetch applications');
      const body = await res.json();
      return body.data;
    }
  });
}

export default useApplications;
