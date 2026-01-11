/**
 * usePublishedStats Hook
 *
 * Provides access to published official statistics from authoritative sources.
 */

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

// Types for published stats
export interface PublishedElection {
  id: number;
  year: number;
  electionType: string;
  registeredVoters: number;
  totalVotesCast: number;
  validVotes: number;
  invalidVotes: number;
  turnoutPercentage: string;
  pollingStations: number | null;
  source: string;
  candidateResults: Array<{
    id: number;
    candidateName: string;
    partyAbbreviation: string | null;
    votes: number;
    percentage: string;
    position: number;
  }>;
}

export interface WomenRepresentationData {
  data: Array<{
    year: number;
    parliamentNumber: number;
    totalSeats: number;
    totalWomenMps: number;
    womenPercentage: number;
    change: number;
    direction: 'up' | 'down' | 'stable';
  }>;
  summary: {
    earliest: { year: number; womenPercentage: number };
    latest: { year: number; womenPercentage: number };
    peak: { year: number; womenPercentage: number };
    totalGrowth: number;
  };
}

export interface PublishedIncidents {
  data: Array<{
    year: number;
    deathsReported: number | null;
    injuriesReported: number | null;
    arrestsReported: number | null;
    petitionsFiled: number;
    observerRating: string | null;
    source: string;
  }>;
  totals: {
    totalDeaths: number;
    totalInjuries: number;
    totalArrests: number;
    totalPetitions: number;
  };
}

/**
 * Hook to fetch all published elections
 */
export function usePublishedElections() {
  const [data, setData] = useState<PublishedElection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.getPublishedElections()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch published election for a specific year
 */
export function usePublishedElection(year: number) {
  const [data, setData] = useState<PublishedElection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!year) return;

    setLoading(true);
    api.getPublishedElection(year)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [year]);

  return { data, loading, error };
}

/**
 * Hook to fetch women's representation trend
 */
export function useWomenRepresentation() {
  const [data, setData] = useState<WomenRepresentationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.getWomenRepresentation()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch published incidents
 */
export function usePublishedIncidents() {
  const [data, setData] = useState<PublishedIncidents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.getPublishedIncidents()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/**
 * Hook to fetch published incident for a specific year
 */
export function usePublishedIncidentByYear(year: number) {
  const [data, setData] = useState<PublishedIncidents['data'][0] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!year) return;

    setLoading(true);
    api.getPublishedIncident(year)
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [year]);

  return { data, loading, error };
}

/**
 * Hook to fetch available years with published data
 */
export function usePublishedYears() {
  const [data, setData] = useState<{
    years: number[];
    hasElectionData: number[];
    hasParliamentData: number[];
    hasIncidentData: number[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.getPublishedYears()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

/**
 * Hook to get data with fallback - prefers published, falls back to calculated
 */
export function useDataWithFallback<T, C>(options: {
  fetchPublished: () => Promise<T>;
  fetchCalculated: () => Promise<C>;
  selectFromPublished: (data: T) => any;
  selectFromCalculated: (data: C) => any;
}) {
  const [data, setData] = useState<any>(null);
  const [source, setSource] = useState<'published' | 'calculated' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try published first
      const publishedData = await options.fetchPublished();
      const selected = options.selectFromPublished(publishedData);
      if (selected !== null && selected !== undefined) {
        setData(selected);
        setSource('published');
        return;
      }
    } catch (e) {
      // Published not available, try calculated
    }

    try {
      const calculatedData = await options.fetchCalculated();
      const selected = options.selectFromCalculated(calculatedData);
      setData(selected);
      setSource('calculated');
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [options]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, source, loading, error, refetch: fetch };
}
