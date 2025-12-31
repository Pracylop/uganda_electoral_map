import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Search, MapPin, ChevronRight } from 'lucide-react';
import { useBroadcastStore } from '../../stores/broadcastStore';

interface Region {
  id: number;
  name: string;
  level: number;
  levelName: string;
  parentName?: string;
}

// Level names mapping
const LEVEL_NAMES: Record<number, string> = {
  2: 'Region',
  3: 'District',
  4: 'Constituency',
  5: 'Parish',
};

export function RegionSearch() {
  const { searchOpen, toggleSearch, drillDown, sidebarExpanded } = useBroadcastStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Region[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (searchOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [searchOpen]);

  // Search function (would call API in real implementation)
  const searchRegions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);

    try {
      // API call would go here
      const response = await fetch(
        `/api/regions/search?q=${encodeURIComponent(searchQuery)}`
      );

      if (response.ok) {
        const data = await response.json();
        setResults(
          data.map((r: any) => ({
            id: r.id,
            name: r.name,
            level: r.level,
            levelName: LEVEL_NAMES[r.level] || 'Region',
            parentName: r.parentName,
          }))
        );
      }
    } catch (error) {
      console.error('Search failed:', error);
      // Fallback: show mock results for demo
      setResults([
        { id: 1, name: 'KAMPALA', level: 3, levelName: 'District', parentName: 'Central' },
        { id: 2, name: 'WAKISO', level: 3, levelName: 'District', parentName: 'Central' },
      ].filter((r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase())
      ));
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchRegions(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchRegions]);

  const handleSelect = (region: Region) => {
    drillDown(region.id, region.name);
    toggleSearch();
    setQuery('');
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      toggleSearch();
    }
  };

  if (!searchOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={toggleSearch}
      />

      {/* Modal */}
      <div
        className={`
          fixed top-1/4 left-1/2 -translate-x-1/2
          w-full max-w-xl
          bg-gray-900
          rounded-2xl
          border border-gray-700
          shadow-2xl
          z-50
          animate-scaleIn
          overflow-hidden
          ${sidebarExpanded ? 'ml-10' : ''}
        `}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-700">
          <Search size={24} className="text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a region, district, or constituency..."
            className="
              flex-1
              bg-transparent
              text-xl text-white
              placeholder-gray-500
              outline-none
            "
          />
          <button
            onClick={toggleSearch}
            className="w-12 h-12 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500" />
            </div>
          ) : query && results.length === 0 ? (
            <p className="text-center text-gray-400 py-12">
              No results found for "{query}"
            </p>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((region) => (
                <button
                  key={region.id}
                  onClick={() => handleSelect(region)}
                  className="
                    w-full
                    flex items-center gap-4
                    px-6 py-4
                    text-left
                    hover:bg-gray-800
                    transition-colors
                  "
                >
                  <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-700 text-gray-300">
                    <MapPin size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {region.name}
                    </h3>
                    <p className="text-gray-400">
                      {region.levelName}
                      {region.parentName && (
                        <>
                          {' '}&bull; {region.parentName}
                        </>
                      )}
                    </p>
                  </div>
                  <ChevronRight size={20} className="text-gray-500" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8">
              <p className="text-gray-400 text-center">
                Start typing to search for regions
              </p>
              <div className="mt-6 space-y-2">
                <p className="text-sm text-gray-500 text-center">Quick shortcuts:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['KAMPALA', 'WAKISO', 'MBARARA', 'GULU', 'JINJA'].map((name) => (
                    <button
                      key={name}
                      onClick={() => setQuery(name)}
                      className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard hints */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500">
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded">Enter</kbd> to select
            </span>
            <span>
              <kbd className="px-2 py-1 bg-gray-800 rounded">Esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
