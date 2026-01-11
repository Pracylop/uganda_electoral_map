/**
 * DataPreloader - Prefetches ALL BOUNDARIES and metadata on app startup
 *
 * NEW ARCHITECTURE: Static GeoJSON file approach
 * - Single 125MB file with all 64,690 village polygons
 * - Indexed by level using properties (DISTRICT, CONSTITUENCY, etc.)
 * - Much faster than API-based loading (~550MB via multiple calls)
 *
 * Preloads:
 * - Elections list and parties (metadata)
 * - All boundary geometries (single static file, all 6 levels indexed)
 * - Issue categories (metadata)
 *
 * Does NOT preload (fetched on-demand since they're tiny):
 * - Election results data (~73KB per election)
 * - Demographics data (~30KB)
 * - Issues data (~15KB)
 */

import { useState, useEffect, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { boundaryService } from '../lib/boundaryService';
import { isTauriEnvironment } from '../stores/authStore';

interface DataPreloaderProps {
  children: ReactNode;
  onComplete?: () => void;
}

interface PreloadPhase {
  name: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  detail?: string;
}

interface Election {
  id: number;
  name: string;
  electionDate: string;
  electionType: { name: string; code: string; electoralLevel: number };
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function DataPreloader({ children, onComplete }: DataPreloaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [phases, setPhases] = useState<PreloadPhase[]>([
    { name: 'Elections & Parties', status: 'pending' },
    { name: 'Boundaries (All Levels)', status: 'pending' },
    { name: 'Issue Categories', status: 'pending' },
    { name: 'Dashboard Data', status: 'pending' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState('');
  const queryClient = useQueryClient();

  const updatePhase = (index: number, update: Partial<PreloadPhase>) => {
    setPhases(prev => prev.map((p, i) => i === index ? { ...p, ...update } : p));
  };

  useEffect(() => {
    const preloadData = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setIsLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      try {
        // ============================================
        // PHASE 1: Elections & Parties (0-10%)
        // ============================================
        setCurrentPhase('Loading elections...');
        updatePhase(0, { status: 'loading' });
        setProgress(2);

        const elections = await api.getElections();
        queryClient.setQueryData(['elections'], elections);
        console.log('📦 Preloaded:', elections.length, 'elections');

        // Fetch parties
        try {
          const partiesResponse = await fetch(`${API_BASE}/api/map/parties`, { headers });
          if (partiesResponse.ok) {
            const parties = await partiesResponse.json();
            queryClient.setQueryData(['parties'], parties);
            console.log('📦 Preloaded:', parties.length, 'parties');
          }
        } catch (e) {
          console.warn('Failed to preload parties:', e);
        }

        updatePhase(0, { status: 'done', detail: `${elections.length} elections` });
        setProgress(15);

        // ============================================
        // PHASE 2: All Boundaries (Single Static File) (15-90%)
        // Loads 125MB GeoJSON with all 64,690 village polygons
        // ============================================
        setCurrentPhase('Loading boundaries (single file)...');
        updatePhase(1, { status: 'loading' });

        try {
          await boundaryService.loadStaticBoundaries();
          const stats = boundaryService.getStats();
          console.log('📦 Preloaded all boundaries:', stats);
          updatePhase(1, {
            status: 'done',
            detail: `${stats.totalFeatures.toLocaleString()} features`
          });
        } catch (e) {
          console.warn('Failed to preload boundaries:', e);
          updatePhase(1, { status: 'error', detail: 'Failed' });
        }

        setProgress(90);

        // ============================================
        // PHASE 3: Issue Categories (90-95%)
        // ============================================
        setCurrentPhase('Loading categories...');
        updatePhase(2, { status: 'loading' });

        try {
          const categories = await api.getIssueCategories();
          queryClient.setQueryData(['issueCategories'], categories);
          console.log('📦 Preloaded:', categories.length, 'issue categories');
          updatePhase(2, { status: 'done', detail: `${categories.length} categories` });
        } catch (e) {
          console.warn('Failed to preload incident categories:', e);
          updatePhase(2, { status: 'error', detail: 'Failed' });
        }

        setProgress(92);

        // ============================================
        // PHASE 4: Dashboard Data (92-100%)
        // Preloads national results for presidential elections
        // ============================================
        setCurrentPhase('Loading dashboard data...');
        updatePhase(3, { status: 'loading' });

        try {
          // Get presidential elections sorted by year
          const presidentialElections = (elections as Election[])
            .filter(e => e.name.toLowerCase().includes('presidential'))
            .sort((a, b) => {
              const yearA = new Date(a.electionDate).getFullYear();
              const yearB = new Date(b.electionDate).getFullYear();
              return yearB - yearA;
            });

          // Preload national results for all presidential elections
          let latestWithData: number | null = null;
          const turnoutData: Array<{ year: number; turnout: number; name: string }> = [];

          for (const election of presidentialElections) {
            try {
              const year = new Date(election.electionDate).getFullYear();
              const result = await fetch(`${API_BASE}/api/results/national/${election.id}`, { headers });
              if (result.ok) {
                const data = await result.json();
                // Cache the result
                queryClient.setQueryData(['nationalResults', election.id], data);

                // Track latest election with data
                if (data.candidateResults && data.candidateResults.length > 0) {
                  if (!latestWithData) latestWithData = election.id;

                  // Collect turnout data
                  if (data.turnoutPercentage && data.turnoutPercentage > 0) {
                    turnoutData.push({
                      year,
                      turnout: data.turnoutPercentage,
                      name: `${year}`,
                    });
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to preload results for election ${election.id}:`, e);
            }
          }

          // Cache the derived dashboard data
          queryClient.setQueryData(['dashboardLatestElection'], latestWithData);
          queryClient.setQueryData(['dashboardTurnoutData'], turnoutData.sort((a, b) => a.year - b.year));

          console.log('📦 Preloaded dashboard data:', {
            latestElectionId: latestWithData,
            turnoutDataPoints: turnoutData.length,
          });
          updatePhase(3, { status: 'done', detail: `${turnoutData.length} elections` });
        } catch (e) {
          console.warn('Failed to preload dashboard data:', e);
          updatePhase(3, { status: 'error', detail: 'Failed' });
        }

        setProgress(100);

        // ============================================
        // Done!
        // ============================================
        setCurrentPhase('Ready!');

        // Log boundary service statistics
        const stats = boundaryService.getStats();
        console.log('✅ Preload complete! Boundary stats:', stats);

        // Small delay to show 100% before hiding
        await new Promise(resolve => setTimeout(resolve, 300));
        setIsLoading(false);
        onComplete?.();

      } catch (err) {
        console.error('Preload error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
        // Still allow app to continue even if preload fails
        setTimeout(() => {
          setIsLoading(false);
          onComplete?.();
        }, 1500);
      }
    };

    preloadData();
  }, [queryClient, onComplete]);

  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-16 h-16 bg-yellow-500 rounded-lg flex items-center justify-center">
          <span className="text-gray-900 font-bold text-2xl">UG</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Uganda Electoral Map</h1>
          <p className="text-gray-400">2026 Elections</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-96 mb-4">
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{progress}%</span>
          <span>{currentPhase}</span>
        </div>
      </div>

      {/* Phase status */}
      <div className="text-sm text-gray-400 space-y-2 w-96">
        {error ? (
          <p className="text-red-400 text-center">{error}</p>
        ) : (
          phases.map((phase, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-center">
                {phase.status === 'done' ? '✓' :
                 phase.status === 'loading' ? '⏳' :
                 phase.status === 'error' ? '✗' : '○'}
              </span>
              <span className={phase.status === 'loading' ? 'text-yellow-400' : ''}>
                {phase.name}
              </span>
              {phase.detail && (
                <span className="text-gray-500 ml-auto">{phase.detail}</span>
              )}
            </div>
          ))
        )}
      </div>

      {/* Info about preloading */}
      <p className="mt-6 text-xs text-gray-600 max-w-sm text-center">
        Loading all boundary data for instant navigation. This may take a moment...
      </p>

      {/* Desktop mode indicator */}
      {isTauriEnvironment() && (
        <p className="mt-2 text-xs text-gray-500">
          Running in Desktop Mode
        </p>
      )}
    </div>
  );
}
