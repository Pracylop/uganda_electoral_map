/**
 * Global Keyboard Shortcuts Hook
 * Provides navigation and action shortcuts throughout the application
 */

import { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface KeyboardShortcut {
  key: string;
  description: string;
  category: 'navigation' | 'actions' | 'broadcast';
  combo?: string; // For display (e.g., "G then E")
}

// Define all shortcuts
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // Navigation
  { key: 'g+h', description: 'Go to Home', category: 'navigation', combo: 'G then H' },
  { key: 'g+e', description: 'Go to Elections', category: 'navigation', combo: 'G then E' },
  { key: 'g+m', description: 'Go to Map', category: 'navigation', combo: 'G then M' },
  { key: 'g+d', description: 'Go to Demographics', category: 'navigation', combo: 'G then D' },
  { key: 'g+i', description: 'Go to Issues', category: 'navigation', combo: 'G then I' },

  // Actions
  { key: '?', description: 'Show keyboard shortcuts', category: 'actions' },
  { key: 'Escape', description: 'Close dialog / Cancel', category: 'actions' },

  // Broadcast Mode
  { key: 'M', description: 'Map view', category: 'broadcast' },
  { key: 'D', description: 'Dashboard view', category: 'broadcast' },
  { key: 'C', description: 'Comparison view', category: 'broadcast' },
  { key: 'I', description: 'Issues view', category: 'broadcast' },
  { key: 'G', description: 'Demographics view', category: 'broadcast' },
  { key: 'E', description: 'Election selector', category: 'broadcast' },
  { key: 'A', description: 'Annotation mode', category: 'broadcast' },
  { key: 'L', description: 'Layers panel', category: 'broadcast' },
  { key: '/', description: 'Search', category: 'broadcast' },
];

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  onShowHelp?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, onShowHelp } = options;
  const navigate = useNavigate();
  const location = useLocation();

  // Track "g" key prefix for navigation shortcuts
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);

  // Check if we're in an input field
  const isInputFocused = useCallback(() => {
    const active = document.activeElement;
    if (!active) return false;
    const tagName = active.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      (active as HTMLElement).isContentEditable
    );
  }, []);

  // Handle navigation
  const handleNavigation = useCallback((path: string) => {
    if (location.pathname !== path) {
      navigate(path);
    }
  }, [navigate, location.pathname]);

  // Main keyboard handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Don't trigger shortcuts in input fields
    if (isInputFocused()) return;

    const key = event.key.toLowerCase();

    // Handle help shortcut (? or Shift+/)
    if (key === '?' || (event.shiftKey && key === '/')) {
      event.preventDefault();
      onShowHelp?.();
      return;
    }

    // Handle Escape
    if (key === 'escape') {
      setPendingPrefix(null);
      return;
    }

    // Handle "g" prefix for navigation
    if (key === 'g' && !pendingPrefix) {
      event.preventDefault();
      setPendingPrefix('g');
      // Clear prefix after 1 second if no second key pressed
      setTimeout(() => setPendingPrefix(null), 1000);
      return;
    }

    // Handle second key after "g" prefix
    if (pendingPrefix === 'g') {
      event.preventDefault();
      setPendingPrefix(null);

      switch (key) {
        case 'h':
          handleNavigation('/');
          break;
        case 'e':
          handleNavigation('/elections');
          break;
        case 'm':
          handleNavigation('/map');
          break;
        case 'd':
          handleNavigation('/demographics');
          break;
        case 'i':
          handleNavigation('/issues');
          break;
      }
    }
  }, [enabled, isInputFocused, pendingPrefix, handleNavigation, onShowHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    pendingPrefix,
  };
}

/**
 * Hook for form-specific shortcuts (Ctrl+Enter to submit, etc.)
 */
export function useFormShortcuts(options: {
  onSubmit?: () => void;
  onCancel?: () => void;
  enabled?: boolean;
}) {
  const { onSubmit, onCancel, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+Enter to submit
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        onSubmit?.();
        return;
      }

      // Escape to cancel (only if not in input)
      if (event.key === 'Escape') {
        const active = document.activeElement;
        const tagName = active?.tagName.toLowerCase();
        if (tagName !== 'input' && tagName !== 'textarea') {
          event.preventDefault();
          onCancel?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onSubmit, onCancel]);
}
