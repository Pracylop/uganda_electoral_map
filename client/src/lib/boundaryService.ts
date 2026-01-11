/**
 * BoundaryService - Manages administrative boundary geometries
 *
 * NEW ARCHITECTURE: Static GeoJSON file approach
 * - Loads single 125MB file with all 64,690 village polygons
 * - Indexes by level using properties (DISTRICT, CONSTITUENCY, etc.)
 * - For choropleth, colors villages by parent level's data
 *
 * See: Documentation/Static_Boundaries_Implementation.md
 */

import { cacheService } from './cacheService';

// Level property mapping
const LEVEL_PROPERTIES: Record<number, string> = {
  1: 'SUBREGION',
  2: 'DISTRICT',
  3: 'CONSTITUENCY',
  4: 'SUBCOUNTY',
  5: 'PARISH',
  6: 'VILLAGE',
};

// Type definitions
export interface BoundaryFeature {
  unitId: number;
  name: string;
  code: string | null;
  level: number;
  parentId: number | null;
  geometry: GeoJSON.Geometry;
}

export interface DataRecord {
  unitId: number;
  unitName: string;
  [key: string]: any;
}

// Raw feature from static GeoJSON
interface RawFeature extends GeoJSON.Feature {
  properties: {
    OBJECTID: number;
    SUBREGION: string;
    DISTRICT: string;
    CONSTITUENCY: string;
    SUBCOUNTY: string;
    PARISH: string;
    VILLAGE: string;
  };
}

// Index structure for each level
interface LevelIndex {
  // All unique unit names at this level
  uniqueNames: Set<string>;
  // Map from unit name to all villages that belong to it
  villagesByUnit: Map<string, RawFeature[]>;
  // For drill-down: Map from parent name to child unit names
  childrenByParent: Map<string, Set<string>>;
}

/**
 * BoundaryService singleton
 *
 * NEW: Uses static GeoJSON file instead of API calls
 *
 * Usage:
 *   // Load all boundaries (single file)
 *   await boundaryService.loadStaticBoundaries();
 *
 *   // Fetch data (tiny payload)
 *   const data = await api.getElectionResultsData(electionId, 2);
 *
 *   // Join client-side (instant)
 *   const geojson = boundaryService.createGeoJSON(2, data);
 */
class BoundaryService {
  // Raw static data
  private staticData: GeoJSON.FeatureCollection<GeoJSON.Geometry, RawFeature['properties']> | null = null;

  // Indexes by level
  private levelIndexes: Map<number, LevelIndex> = new Map();

  // Loading state
  private loadingPromise: Promise<void> | null = null;
  private isLoaded = false;

  // Statistics
  private stats = {
    totalFeatures: 0,
    loadTimeMs: 0,
    joins: 0,
  };

  /**
   * Load static boundaries file
   * This is the main entry point - call once at app startup
   */
  async loadStaticBoundaries(): Promise<void> {
    if (this.isLoaded) {
      console.log('🚀 Boundaries: Already loaded');
      return;
    }

    if (this.loadingPromise) {
      console.log('⏳ Boundaries: Waiting for in-progress load');
      return this.loadingPromise;
    }

    this.loadingPromise = this._loadAndIndex();

    try {
      await this.loadingPromise;
      this.isLoaded = true;
    } finally {
      this.loadingPromise = null;
    }
  }

  /**
   * Legacy method - redirects to loadStaticBoundaries
   * Kept for backward compatibility with existing code
   */
  async loadLevel(_level: number): Promise<void> {
    await this.loadStaticBoundaries();
  }

  /**
   * Check if boundaries are loaded
   */
  hasLevel(level: number): boolean {
    return this.isLoaded && this.levelIndexes.has(level);
  }

  /**
   * Get the count of unique units at a level
   */
  getCount(level: number): number {
    return this.levelIndexes.get(level)?.uniqueNames.size || 0;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalFeatures: number;
    loadTimeMs: number;
    levels: { level: number; count: number }[];
    joins: number;
  } {
    return {
      totalFeatures: this.stats.totalFeatures,
      loadTimeMs: this.stats.loadTimeMs,
      levels: Array.from(this.levelIndexes.entries()).map(([level, index]) => ({
        level,
        count: index.uniqueNames.size,
      })),
      joins: this.stats.joins,
    };
  }

  /**
   * Create GeoJSON for choropleth rendering
   *
   * NEW APPROACH: Returns all village polygons, colored by their parent level's data
   *
   * @param level - The level to color by (2=district, 3=constituency, etc.)
   * @param data - Data records with unitName and coloring properties
   * @param parentFilter - Optional: only include villages under this parent
   */
  createGeoJSON(
    level: number,
    data: DataRecord[],
    parentFilter?: { level: number; name: string } | number | null
  ): GeoJSON.FeatureCollection {
    if (!this.staticData) {
      console.error('Boundaries not loaded');
      return { type: 'FeatureCollection', features: [] };
    }

    this.stats.joins++;
    const startTime = performance.now();

    const levelProp = LEVEL_PROPERTIES[level];
    if (!levelProp) {
      console.error(`Invalid level: ${level}`);
      return { type: 'FeatureCollection', features: [] };
    }

    // Build data lookup by unit name (normalized)
    const dataByName = new Map<string, DataRecord>();
    for (const record of data) {
      const name = this._normalizeName(record.unitName);
      dataByName.set(name, record);
    }

    // Get villages to include
    let villages = this.staticData.features;

    // Handle parentFilter - could be old format (number) or new format (object)
    if (parentFilter !== undefined && parentFilter !== null) {
      if (typeof parentFilter === 'object' && 'name' in parentFilter) {
        // New format: { level: 2, name: "KAMPALA" }
        const filterProp = LEVEL_PROPERTIES[parentFilter.level];
        const filterName = this._normalizeName(parentFilter.name);
        villages = villages.filter(v =>
          this._normalizeName(v.properties[filterProp as keyof typeof v.properties] as string) === filterName
        );
      } else if (typeof parentFilter === 'number') {
        // Old format: parentId number - try to find matching parent
        // This is a fallback for backward compatibility
        // We'll include all villages since we can't map unitId to name easily
        console.warn('parentFilter as number not supported in static mode, showing all');
      }
    }

    // Create features with data joined
    const features: GeoJSON.Feature[] = [];
    let featureId = 0;

    for (const village of villages) {
      const props = village.properties;
      const unitName = props[levelProp as keyof typeof props] as string;
      const normalizedName = this._normalizeName(unitName);
      const record = dataByName.get(normalizedName);

      features.push({
        type: 'Feature',
        id: featureId++,
        properties: {
          // Data properties (if matched)
          ...(record || { noData: true }),
          // Boundary properties
          unitName: unitName,
          name: unitName,
          level: level,
          // Original hierarchy for drill-down
          SUBREGION: props.SUBREGION,
          DISTRICT: props.DISTRICT,
          CONSTITUENCY: props.CONSTITUENCY,
          SUBCOUNTY: props.SUBCOUNTY,
          PARISH: props.PARISH,
          VILLAGE: props.VILLAGE,
        },
        geometry: village.geometry,
      });
    }

    const duration = performance.now() - startTime;
    console.log(`📦 BoundaryService: Created ${features.length} features for level ${level} in ${duration.toFixed(1)}ms`);

    return { type: 'FeatureCollection', features };
  }

  /**
   * Get boundaries without data (for basemap rendering)
   */
  getBoundariesGeoJSON(level: number, parentFilter?: { level: number; name: string } | number | null): GeoJSON.FeatureCollection {
    if (!this.staticData) {
      return { type: 'FeatureCollection', features: [] };
    }

    const levelProp = LEVEL_PROPERTIES[level];
    let villages = this.staticData.features;

    // Apply parent filter
    if (parentFilter && typeof parentFilter === 'object' && 'name' in parentFilter) {
      const filterProp = LEVEL_PROPERTIES[parentFilter.level];
      const filterName = this._normalizeName(parentFilter.name);
      villages = villages.filter(v =>
        this._normalizeName(v.properties[filterProp as keyof typeof v.properties] as string) === filterName
      );
    }

    let featureId = 0;
    const features: GeoJSON.Feature[] = villages.map(village => ({
      type: 'Feature',
      id: featureId++,
      properties: {
        name: village.properties[levelProp as keyof typeof village.properties],
        level,
        DISTRICT: village.properties.DISTRICT,
        CONSTITUENCY: village.properties.CONSTITUENCY,
        SUBCOUNTY: village.properties.SUBCOUNTY,
        PARISH: village.properties.PARISH,
        VILLAGE: village.properties.VILLAGE,
      },
      geometry: village.geometry,
    }));

    return { type: 'FeatureCollection', features };
  }

  /**
   * Get unique unit names at a level (for dropdowns, etc.)
   */
  getUniqueNames(level: number): string[] {
    const index = this.levelIndexes.get(level);
    return index ? Array.from(index.uniqueNames).sort() : [];
  }

  /**
   * Get child unit names under a parent
   */
  getChildren(parentLevel: number, parentName: string, childLevel: number): string[] {
    if (!this.staticData) return [];

    const parentProp = LEVEL_PROPERTIES[parentLevel];
    const childProp = LEVEL_PROPERTIES[childLevel];
    const normalizedParent = this._normalizeName(parentName);

    const children = new Set<string>();
    for (const feature of this.staticData.features) {
      const props = feature.properties;
      if (this._normalizeName(props[parentProp as keyof typeof props] as string) === normalizedParent) {
        children.add(props[childProp as keyof typeof props] as string);
      }
    }

    return Array.from(children).sort();
  }

  /**
   * Clear all data (for memory management)
   */
  clearAll(): void {
    this.staticData = null;
    this.levelIndexes.clear();
    this.isLoaded = false;
    console.log('🗑️ BoundaryService: Cleared all data');
  }

  // Private methods

  private async _loadAndIndex(): Promise<void> {
    const startTime = performance.now();

    // Try cache first
    try {
      const cached = await cacheService.get<GeoJSON.FeatureCollection>('static-boundaries');
      if (cached && cached.features && cached.features.length > 0) {
        this.staticData = cached as any;
        this._buildIndexes();
        this.stats.loadTimeMs = performance.now() - startTime;
        console.log(`📦 Boundaries: Loaded ${this.stats.totalFeatures} features from cache in ${this.stats.loadTimeMs.toFixed(0)}ms`);
        return;
      }
    } catch (e) {
      console.warn('Cache read failed:', e);
    }

    // Fetch static file (gzip compressed)
    console.log('🌐 Boundaries: Loading static file...');
    const response = await fetch('/boundaries/UG_Admin_Boundaries.geojson.gz');

    if (!response.ok) {
      throw new Error(`Failed to load boundaries: ${response.status}`);
    }

    // Decompress gzip using DecompressionStream API
    const ds = new DecompressionStream('gzip');
    const decompressedStream = response.body!.pipeThrough(ds);
    const decompressedResponse = new Response(decompressedStream);
    this.staticData = await decompressedResponse.json();
    this.stats.totalFeatures = this.staticData?.features?.length || 0;

    // Build indexes
    this._buildIndexes();

    // Cache for future sessions
    try {
      await cacheService.set('static-boundaries', this.staticData);
      console.log('💾 Boundaries: Cached to IndexedDB');
    } catch (e) {
      console.warn('Cache write failed:', e);
    }

    this.stats.loadTimeMs = performance.now() - startTime;
    console.log(`📦 Boundaries: Loaded ${this.stats.totalFeatures} features in ${this.stats.loadTimeMs.toFixed(0)}ms`);
  }

  private _buildIndexes(): void {
    if (!this.staticData) return;

    // Build index for each level
    for (let level = 1; level <= 6; level++) {
      const prop = LEVEL_PROPERTIES[level];
      const index: LevelIndex = {
        uniqueNames: new Set(),
        villagesByUnit: new Map(),
        childrenByParent: new Map(),
      };

      for (const feature of this.staticData.features) {
        const props = feature.properties;
        const unitName = props[prop as keyof typeof props] as string;

        if (unitName) {
          index.uniqueNames.add(unitName);

          // Group villages by this unit
          if (!index.villagesByUnit.has(unitName)) {
            index.villagesByUnit.set(unitName, []);
          }
          index.villagesByUnit.get(unitName)!.push(feature as RawFeature);

          // Track parent-child relationships
          if (level > 1) {
            const parentProp = LEVEL_PROPERTIES[level - 1];
            const parentName = props[parentProp as keyof typeof props] as string;
            if (!index.childrenByParent.has(parentName)) {
              index.childrenByParent.set(parentName, new Set());
            }
            index.childrenByParent.get(parentName)!.add(unitName);
          }
        }
      }

      this.levelIndexes.set(level, index);
    }

    console.log('📇 Boundaries: Indexed all levels', {
      subregions: this.getCount(1),
      districts: this.getCount(2),
      constituencies: this.getCount(3),
      subcounties: this.getCount(4),
      parishes: this.getCount(5),
      villages: this.getCount(6),
    });
  }

  private _normalizeName(name: string): string {
    if (!name) return '';
    return name.trim().toUpperCase();
  }
}

// Singleton instance
export const boundaryService = new BoundaryService();
