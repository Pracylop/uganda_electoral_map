/**
 * IndexedDB Cache for Offline Support
 * Uses Dexie for clean Promise-based IndexedDB access
 */

import Dexie, { type Table } from 'dexie';

// Cache entry types
interface CachedElections {
  id: number; // Use 0 as key for full list
  data: any;
  cachedAt: number;
}

interface CachedMapData {
  key: string; // `${electionId}-${level}-${parentId}`
  data: any;
  cachedAt: number;
}

interface CachedNationalTotals {
  electionId: number;
  data: any;
  cachedAt: number;
}

interface CachedPartySummary {
  key: string; // `${electionId}-${districtId}`
  data: any;
  cachedAt: number;
}

// Dexie database class
class ElectoralCache extends Dexie {
  elections!: Table<CachedElections>;
  mapData!: Table<CachedMapData>;
  nationalTotals!: Table<CachedNationalTotals>;
  partySummary!: Table<CachedPartySummary>;

  constructor() {
    super('ElectoralCache');
    this.version(1).stores({
      elections: 'id, cachedAt',
      mapData: 'key, cachedAt',
      nationalTotals: 'electionId, cachedAt',
      partySummary: 'key, cachedAt'
    });
  }
}

// Export singleton instance
export const cache = new ElectoralCache();

// Cache TTL constants (in milliseconds)
export const CACHE_TTL = {
  ELECTIONS: 24 * 60 * 60 * 1000,    // 24 hours
  MAP_DATA: 5 * 60 * 1000,            // 5 minutes
  NATIONAL_TOTALS: 30 * 1000,         // 30 seconds
  PARTY_SUMMARY: 30 * 1000            // 30 seconds
};

/**
 * Check if cached data is stale
 */
export function isStale(cachedAt: number, maxAgeMs: number): boolean {
  return Date.now() - cachedAt > maxAgeMs;
}

/**
 * Generate cache key for map data
 */
export function getMapDataKey(electionId: number, level: number, parentId: number | null): string {
  return `${electionId}-${level}-${parentId ?? 'null'}`;
}

/**
 * Generate cache key for party summary
 */
export function getPartySummaryKey(electionId: number, districtId?: number | null): string {
  return `${electionId}-${districtId ?? 'null'}`;
}

// Helper functions for common cache operations

/**
 * Get cached elections list
 */
export async function getCachedElections(): Promise<any | null> {
  try {
    const cached = await cache.elections.get(0);
    if (cached && !isStale(cached.cachedAt, CACHE_TTL.ELECTIONS)) {
      return cached.data;
    }
    return null;
  } catch (error) {
    console.error('Error reading elections from cache:', error);
    return null;
  }
}

/**
 * Save elections list to cache
 */
export async function setCachedElections(data: any): Promise<void> {
  try {
    await cache.elections.put({
      id: 0,
      data,
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error('Error saving elections to cache:', error);
  }
}

/**
 * Get cached map data
 */
export async function getCachedMapData(
  electionId: number,
  level: number,
  parentId: number | null
): Promise<any | null> {
  try {
    const key = getMapDataKey(electionId, level, parentId);
    const cached = await cache.mapData.get(key);
    if (cached && !isStale(cached.cachedAt, CACHE_TTL.MAP_DATA)) {
      return cached.data;
    }
    return null;
  } catch (error) {
    console.error('Error reading map data from cache:', error);
    return null;
  }
}

/**
 * Save map data to cache
 */
export async function setCachedMapData(
  electionId: number,
  level: number,
  parentId: number | null,
  data: any
): Promise<void> {
  try {
    const key = getMapDataKey(electionId, level, parentId);
    await cache.mapData.put({
      key,
      data,
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error('Error saving map data to cache:', error);
  }
}

/**
 * Get cached national totals
 */
export async function getCachedNationalTotals(electionId: number): Promise<any | null> {
  try {
    const cached = await cache.nationalTotals.get(electionId);
    if (cached && !isStale(cached.cachedAt, CACHE_TTL.NATIONAL_TOTALS)) {
      return cached.data;
    }
    return null;
  } catch (error) {
    console.error('Error reading national totals from cache:', error);
    return null;
  }
}

/**
 * Save national totals to cache
 */
export async function setCachedNationalTotals(electionId: number, data: any): Promise<void> {
  try {
    await cache.nationalTotals.put({
      electionId,
      data,
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error('Error saving national totals to cache:', error);
  }
}

/**
 * Get cached party summary
 */
export async function getCachedPartySummary(
  electionId: number,
  districtId?: number | null
): Promise<any | null> {
  try {
    const key = getPartySummaryKey(electionId, districtId);
    const cached = await cache.partySummary.get(key);
    if (cached && !isStale(cached.cachedAt, CACHE_TTL.PARTY_SUMMARY)) {
      return cached.data;
    }
    return null;
  } catch (error) {
    console.error('Error reading party summary from cache:', error);
    return null;
  }
}

/**
 * Save party summary to cache
 */
export async function setCachedPartySummary(
  electionId: number,
  districtId: number | null | undefined,
  data: any
): Promise<void> {
  try {
    const key = getPartySummaryKey(electionId, districtId);
    await cache.partySummary.put({
      key,
      data,
      cachedAt: Date.now()
    });
  } catch (error) {
    console.error('Error saving party summary to cache:', error);
  }
}

/**
 * Clear all cached data (useful for logout or manual refresh)
 */
export async function clearAllCache(): Promise<void> {
  try {
    await Promise.all([
      cache.elections.clear(),
      cache.mapData.clear(),
      cache.nationalTotals.clear(),
      cache.partySummary.clear()
    ]);
    console.log('All cache cleared');
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Clear stale entries from cache
 */
export async function clearStaleCache(): Promise<void> {
  try {
    // Clear stale map data
    const staleMapData = await cache.mapData
      .filter(item => isStale(item.cachedAt, CACHE_TTL.MAP_DATA))
      .toArray();
    await cache.mapData.bulkDelete(staleMapData.map(item => item.key));

    // Clear stale national totals
    const staleNationalTotals = await cache.nationalTotals
      .filter(item => isStale(item.cachedAt, CACHE_TTL.NATIONAL_TOTALS))
      .toArray();
    await cache.nationalTotals.bulkDelete(staleNationalTotals.map(item => item.electionId));

    // Clear stale party summary
    const stalePartySummary = await cache.partySummary
      .filter(item => isStale(item.cachedAt, CACHE_TTL.PARTY_SUMMARY))
      .toArray();
    await cache.partySummary.bulkDelete(stalePartySummary.map(item => item.key));

    console.log('Stale cache entries cleared');
  } catch (error) {
    console.error('Error clearing stale cache:', error);
  }
}
