import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchClaims, fetchRecommendation } from './api-requests';

const CLAIMS_QUERY_KEY = ['claims'];

export function useClaims() {
  const query = useQuery({
    queryKey: CLAIMS_QUERY_KEY,
    queryFn: () => fetchClaims(),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const queryClient = useQueryClient();

  // Hard-refresh: bypass the server-side TTL cache and invalidate the client cache
  const forceRefetch = useCallback(async () => {
    await queryClient.fetchQuery({
      queryKey: CLAIMS_QUERY_KEY,
      queryFn: () => fetchClaims({ forceRefresh: true }),
      staleTime: 0,
    });
  }, [queryClient]);

  return { ...query, forceRefetch };
}

export function useRecommendation(claimId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['recommendation', claimId],
    queryFn: () => fetchRecommendation(claimId),
    enabled,
    staleTime: Infinity,
    retry: 1,
  });
}
