/**
 * React Query Client Configuration
 * Provides stale-while-revalidate pattern for offline-first UX
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data becomes stale after 30 seconds
      staleTime: 30 * 1000,

      // Keep unused data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,

      // Retry failed requests 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Refetch data when window regains focus (good for tabs)
      refetchOnWindowFocus: true,

      // Refetch when network connection is restored
      refetchOnReconnect: true,

      // Don't refetch on mount if data is fresh
      refetchOnMount: true,

      // Keep previous data while fetching new data
      placeholderData: (previousData: any) => previousData,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
    }
  },
});

/**
 * Invalidate queries related to an election (for WebSocket updates)
 */
export function invalidateElectionQueries(electionId: number): void {
  queryClient.invalidateQueries({ queryKey: ['mapData', electionId] });
  queryClient.invalidateQueries({ queryKey: ['nationalTotals', electionId] });
  queryClient.invalidateQueries({ queryKey: ['partySummary', electionId] });
}

/**
 * Invalidate all cached data (useful for manual refresh)
 */
export function invalidateAllQueries(): void {
  queryClient.invalidateQueries();
}
