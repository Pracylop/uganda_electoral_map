/**
 * Election Data Hooks with Offline Support
 * Uses React Query for caching + IndexedDB for persistence
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import {
  getCachedElections,
  setCachedElections,
  getCachedMapData,
  setCachedMapData,
  getCachedNationalTotals,
  setCachedNationalTotals,
  getCachedPartySummary,
  setCachedPartySummary,
  CACHE_TTL
} from '../lib/cache';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Helper to make authenticated API requests
 */
async function fetchWithAuth<T>(endpoint: string): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Hook for elections list with offline support
 */
export function useElections() {
  return useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      const data = await api.getElections();
      // Save to IndexedDB for offline use
      await setCachedElections(data);
      return data;
    },
    staleTime: CACHE_TTL.ELECTIONS,
    placeholderData: () => {
      // This will be called synchronously, but we need async for IndexedDB
      // React Query will handle this gracefully
      return undefined;
    },
    // Use initialData from IndexedDB (set in component)
  });
}

/**
 * Hook to get cached elections for initial data
 */
export function useElectionsWithOffline() {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['elections'],
    queryFn: async () => {
      try {
        const data = await api.getElections();
        await setCachedElections(data);
        return data;
      } catch (error) {
        // If network fails, try to get from cache
        const cached = await getCachedElections();
        if (cached) {
          console.log('Using cached elections (offline)');
          return cached;
        }
        throw error;
      }
    },
    staleTime: CACHE_TTL.ELECTIONS,
    initialDataUpdatedAt: 0, // Force refetch even with initial data
    initialData: () => {
      // Try to get from query cache first
      return queryClient.getQueryData(['elections']);
    }
  });
}

/**
 * Hook for map data (aggregated results) with offline support
 */
export function useMapData(
  electionId: number | null,
  level: number,
  parentId: number | null,
  enabled = true
) {
  return useQuery({
    queryKey: ['mapData', electionId, level, parentId],
    queryFn: async () => {
      if (!electionId) return null;

      // Build URL with params
      let url = `/api/map/aggregated/${electionId}?level=${level}`;
      if (parentId !== null) {
        url += `&parentId=${parentId}`;
      }

      try {
        const data = await fetchWithAuth<any>(url);
        // Save to IndexedDB for offline use
        await setCachedMapData(electionId, level, parentId, data);
        return data;
      } catch (error) {
        // If network fails, try to get from cache
        const cached = await getCachedMapData(electionId, level, parentId);
        if (cached) {
          console.log('Using cached map data (offline)');
          return cached;
        }
        throw error;
      }
    },
    staleTime: CACHE_TTL.MAP_DATA,
    enabled: enabled && electionId !== null,
  });
}

/**
 * Hook for national totals with offline support
 */
export function useNationalTotals(electionId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['nationalTotals', electionId],
    queryFn: async () => {
      if (!electionId) return null;

      try {
        const data = await fetchWithAuth<any>(`/api/map/national/${electionId}`);
        // Save to IndexedDB for offline use
        await setCachedNationalTotals(electionId, data);
        return data;
      } catch (error) {
        // If network fails, try to get from cache
        const cached = await getCachedNationalTotals(electionId);
        if (cached) {
          console.log('Using cached national totals (offline)');
          return cached;
        }
        throw error;
      }
    },
    staleTime: CACHE_TTL.NATIONAL_TOTALS,
    enabled: enabled && electionId !== null,
  });
}

/**
 * Hook for party summary with offline support
 */
export function usePartySummary(
  electionId: number | null,
  districtId?: number | null,
  enabled = true
) {
  return useQuery({
    queryKey: ['partySummary', electionId, districtId ?? null],
    queryFn: async () => {
      if (!electionId) return null;

      try {
        const data = await api.getPartySummary(electionId, districtId ?? undefined);
        // Save to IndexedDB for offline use
        await setCachedPartySummary(electionId, districtId ?? null, data);
        return data;
      } catch (error) {
        // If network fails, try to get from cache
        const cached = await getCachedPartySummary(electionId, districtId ?? null);
        if (cached) {
          console.log('Using cached party summary (offline)');
          return cached;
        }
        throw error;
      }
    },
    staleTime: CACHE_TTL.PARTY_SUMMARY,
    enabled: enabled && electionId !== null,
  });
}

/**
 * Hook for swing analysis data
 */
export function useSwingData(
  election1Id: number | null,
  election2Id: number | null,
  level: number,
  parentId: number | null,
  enabled = true
) {
  return useQuery({
    queryKey: ['swingData', election1Id, election2Id, level, parentId],
    queryFn: async () => {
      if (!election1Id || !election2Id) return null;

      let url = `/api/map/swing/${election1Id}/${election2Id}?level=${level}`;
      if (parentId !== null) {
        url += `&parentId=${parentId}`;
      }

      return fetchWithAuth<any>(url);
    },
    staleTime: CACHE_TTL.MAP_DATA,
    enabled: enabled && election1Id !== null && election2Id !== null,
  });
}

/**
 * Hook for admin unit details (breadcrumb)
 */
export function useAdminUnit(unitId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['adminUnit', unitId],
    queryFn: async () => {
      if (!unitId) return null;
      return fetchWithAuth<any>(`/api/map/admin-unit/${unitId}`);
    },
    staleTime: CACHE_TTL.ELECTIONS, // Admin units rarely change
    enabled: enabled && unitId !== null,
  });
}

/**
 * Hook for parties (for legend)
 */
export function useParties() {
  return useQuery({
    queryKey: ['parties'],
    queryFn: () => fetchWithAuth<any>('/api/map/parties'),
    staleTime: CACHE_TTL.ELECTIONS, // Parties rarely change
  });
}

/**
 * Hook for regional breakdown (results by subregion)
 */
export function useRegionalBreakdown(electionId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['regionalBreakdown', electionId],
    queryFn: async () => {
      if (!electionId) return null;
      return fetchWithAuth<any>(`/api/results/regional/${electionId}`);
    },
    staleTime: CACHE_TTL.NATIONAL_TOTALS,
    enabled: enabled && electionId !== null,
  });
}

/**
 * Prefetch map data for a specific election and level
 * Call this to warm the cache for smoother navigation
 */
export function usePrefetchMapData() {
  const queryClient = useQueryClient();

  return async (electionId: number, level: number, parentId: number | null) => {
    await queryClient.prefetchQuery({
      queryKey: ['mapData', electionId, level, parentId],
      queryFn: async () => {
        let url = `/api/map/aggregated/${electionId}?level=${level}`;
        if (parentId !== null) {
          url += `&parentId=${parentId}`;
        }
        const data = await fetchWithAuth<any>(url);
        await setCachedMapData(electionId, level, parentId, data);
        return data;
      },
      staleTime: CACHE_TTL.MAP_DATA,
    });
  };
}
