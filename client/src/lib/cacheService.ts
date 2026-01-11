/**
 * Centralized Cache Service
 *
 * Provides a unified caching layer with:
 * - L1: In-memory cache (instant access, cleared on page refresh)
 * - L2: IndexedDB cache (persists across sessions)
 *
 * Used by all map dashboards for consistent caching behavior.
 */

import { cache, CACHE_TTL, isStale } from './cache';

// Cache entry structure
interface CacheEntry<T = unknown> {
  data: T;
  cachedAt: number;
  ttl?: number;
}

// Cache statistics for debugging
interface CacheStats {
  l1Entries: number;
  l1Keys: string[];
  hits: number;
  misses: number;
  hitRate: number;
}

class CacheService {
  // L1: In-memory cache for instant access
  private memoryCache: Map<string, CacheEntry> = new Map();

  // Statistics tracking
  private hits = 0;
  private misses = 0;

  /**
   * Get data from cache (L1 → L2 → null)
   */
  async get<T>(key: string, maxAge?: number): Promise<T | null> {
    const ttl = maxAge ?? CACHE_TTL.MAP_DATA;

    // Check L1 (memory) first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !isStale(memEntry.cachedAt, memEntry.ttl ?? ttl)) {
      this.hits++;
      console.log('🚀 L1 CACHE HIT:', key);
      return memEntry.data as T;
    }

    // Check L2 (IndexedDB)
    try {
      const dbEntry = await cache.mapData.get(key);
      if (dbEntry && !isStale(dbEntry.cachedAt, ttl)) {
        this.hits++;
        console.log('💾 L2 CACHE HIT:', key);
        // Promote to L1 for faster subsequent access
        this.memoryCache.set(key, {
          data: dbEntry.data,
          cachedAt: dbEntry.cachedAt,
          ttl
        });
        return dbEntry.data as T;
      }
    } catch (error) {
      console.warn('L2 cache read error:', error);
    }

    this.misses++;
    console.log('🌐 CACHE MISS:', key);
    return null;
  }

  /**
   * Store data in cache (L1 + L2)
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      cachedAt: Date.now(),
      ttl: ttl ?? CACHE_TTL.MAP_DATA,
    };

    // Set in L1 (synchronous, instant)
    this.memoryCache.set(key, entry);
    console.log('📦 L1 CACHED:', key);

    // Set in L2 (async, non-blocking)
    try {
      await cache.mapData.put({
        key,
        data,
        cachedAt: entry.cachedAt,
      });
      console.log('💾 L2 CACHED:', key);
    } catch (error) {
      console.warn('L2 cache write error:', error);
    }
  }

  /**
   * Check if key exists in cache (L1 only for speed)
   */
  has(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry) return false;
    return !isStale(entry.cachedAt, entry.ttl ?? CACHE_TTL.MAP_DATA);
  }

  /**
   * Invalidate cache entries by key or prefix
   */
  invalidate(pattern: string | RegExp): void {
    const keysToDelete: string[] = [];

    // Find matching keys in L1
    for (const key of this.memoryCache.keys()) {
      const matches = typeof pattern === 'string'
        ? key.startsWith(pattern)
        : pattern.test(key);
      if (matches) {
        keysToDelete.push(key);
      }
    }

    // Delete from L1
    for (const key of keysToDelete) {
      this.memoryCache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log('🗑️ INVALIDATED:', keysToDelete.length, 'entries matching', pattern);
    }

    // Delete from L2 (async)
    this.invalidateL2(pattern).catch(console.warn);
  }

  /**
   * Invalidate L2 cache entries (async)
   */
  private async invalidateL2(pattern: string | RegExp): Promise<void> {
    try {
      const allEntries = await cache.mapData.toArray();
      const keysToDelete = allEntries
        .filter(entry => {
          return typeof pattern === 'string'
            ? entry.key.startsWith(pattern)
            : pattern.test(entry.key);
        })
        .map(entry => entry.key);

      if (keysToDelete.length > 0) {
        await cache.mapData.bulkDelete(keysToDelete);
      }
    } catch (error) {
      console.warn('L2 invalidation error:', error);
    }
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    this.hits = 0;
    this.misses = 0;

    try {
      await cache.mapData.clear();
      console.log('🗑️ ALL CACHE CLEARED');
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics for debugging
   */
  getStats(): CacheStats {
    return {
      l1Entries: this.memoryCache.size,
      l1Keys: Array.from(this.memoryCache.keys()),
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? this.hits / (this.hits + this.misses)
        : 0,
    };
  }

  /**
   * Prefetch data into cache (for background preloading)
   */
  async prefetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<void> {
    // Skip if already cached
    if (this.has(key)) {
      console.log('⏭️ PREFETCH SKIP (cached):', key);
      return;
    }

    try {
      console.log('⬇️ PREFETCHING:', key);
      const data = await fetcher();
      await this.set(key, data, ttl);
    } catch (error) {
      console.warn('Prefetch error for', key, ':', error);
    }
  }

  /**
   * Get or fetch data (convenience method)
   * Returns cached data if available, otherwise fetches and caches
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key, ttl);
    if (cached !== null) {
      return cached;
    }

    // Fetch and cache
    const data = await fetcher();
    await this.set(key, data, ttl);
    return data;
  }
}

// Export singleton instance
export const cacheService = new CacheService();

// Cache key generators for consistency
export const CacheKeys = {
  // Election results
  mapData: (electionId: number, level: number, parentId: number | null) =>
    `map-${electionId}-${level}-${parentId ?? 'null'}`,

  nationalTotals: (electionId: number) =>
    `national-${electionId}`,

  partySummary: (electionId: number, districtId?: number | null) =>
    `party-${electionId}-${districtId ?? 'null'}`,

  // Demographics
  demographics: (level: number, parentId: number | null) =>
    `demo-${level}-${parentId ?? 'null'}`,

  demographicsStats: () => 'demo-stats',

  // Incidents (Issues)
  incidents: (level: number, parentId: number | null) =>
    `incidents-${level}-${parentId ?? 'null'}`,

  incidentPoints: () => 'incident-points',

  incidentCategories: () => 'incident-categories',

  // Reference data
  elections: () => 'elections',
  parties: () => 'parties',
};

// TTL constants (re-export for convenience)
export { CACHE_TTL };
