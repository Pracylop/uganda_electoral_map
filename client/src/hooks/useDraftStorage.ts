import { useState, useEffect, useCallback, useRef } from 'react';

interface DraftData {
  data: Record<string, unknown>;
  timestamp: number;
  formId: string;
}

interface UseDraftStorageOptions {
  formId: string;
  debounceMs?: number;
  maxAgeMs?: number;
}

interface UseDraftStorageResult<T> {
  draft: T | null;
  hasDraft: boolean;
  draftAge: string | null;
  saveDraft: (data: T) => void;
  clearDraft: () => void;
  restoreDraft: () => T | null;
  dismissDraft: () => void;
  lastSaved: Date | null;
  isSaving: boolean;
}

const DRAFT_PREFIX = 'form_draft_';
const DEFAULT_DEBOUNCE_MS = 2000; // Auto-save every 2 seconds
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Hook for auto-saving form drafts to localStorage with crash recovery
 *
 * @param options - Configuration options
 * @param options.formId - Unique identifier for the form (e.g., 'results_entry_123')
 * @param options.debounceMs - Debounce time for auto-save (default: 2000ms)
 * @param options.maxAgeMs - Maximum age of draft before it's considered stale (default: 24h)
 *
 * @example
 * const { draft, hasDraft, saveDraft, clearDraft, restoreDraft } = useDraftStorage<FormData>({
 *   formId: `results_entry_${electionId}`,
 * });
 */
export function useDraftStorage<T extends Record<string, unknown>>(
  options: UseDraftStorageOptions
): UseDraftStorageResult<T> {
  const {
    formId,
    debounceMs = DEFAULT_DEBOUNCE_MS,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
  } = options;

  const storageKey = `${DRAFT_PREFIX}${formId}`;
  const [draft, setDraft] = useState<T | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: DraftData = JSON.parse(stored);
        const age = Date.now() - parsed.timestamp;

        // Check if draft is still valid (not too old)
        if (age < maxAgeMs) {
          setDraft(parsed.data as T);
          setHasDraft(true);
          setLastSaved(new Date(parsed.timestamp));
        } else {
          // Draft is too old, remove it
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error('Error loading draft:', error);
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, maxAgeMs]);

  // Calculate human-readable draft age
  const getDraftAge = useCallback((): string | null => {
    if (!lastSaved) return null;

    const ageMs = Date.now() - lastSaved.getTime();
    const minutes = Math.floor(ageMs / 60000);
    const hours = Math.floor(ageMs / 3600000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    return 'over a day ago';
  }, [lastSaved]);

  // Save draft to localStorage with debounce
  const saveDraft = useCallback((data: T) => {
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    setIsSaving(true);

    // Set new timer for debounced save
    debounceTimer.current = setTimeout(() => {
      try {
        const draftData: DraftData = {
          data,
          timestamp: Date.now(),
          formId,
        };
        localStorage.setItem(storageKey, JSON.stringify(draftData));
        setDraft(data);
        setHasDraft(true);
        setLastSaved(new Date());
        setIsSaving(false);
      } catch (error) {
        console.error('Error saving draft:', error);
        setIsSaving(false);
      }
    }, debounceMs);
  }, [storageKey, formId, debounceMs]);

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    localStorage.removeItem(storageKey);
    setDraft(null);
    setHasDraft(false);
    setLastSaved(null);
  }, [storageKey]);

  // Restore draft data (returns the draft and keeps it)
  const restoreDraft = useCallback((): T | null => {
    return draft;
  }, [draft]);

  // Dismiss draft without using it (clears it)
  const dismissDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    draft,
    hasDraft,
    draftAge: getDraftAge(),
    saveDraft,
    clearDraft,
    restoreDraft,
    dismissDraft,
    lastSaved,
    isSaving,
  };
}

/**
 * Get all stored drafts (for debugging/admin purposes)
 */
export function getAllDrafts(): DraftData[] {
  const drafts: DraftData[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) {
      try {
        const data = localStorage.getItem(key);
        if (data) {
          drafts.push(JSON.parse(data));
        }
      } catch (error) {
        console.error(`Error parsing draft ${key}:`, error);
      }
    }
  }

  return drafts;
}

/**
 * Clear all stored drafts
 */
export function clearAllDrafts(): void {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(DRAFT_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => localStorage.removeItem(key));
}
