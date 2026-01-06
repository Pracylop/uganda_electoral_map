/**
 * Keyboard Shortcuts Provider
 * Wraps the app and provides global keyboard shortcut handling
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp';

interface KeyboardShortcutsProviderProps {
  children: ReactNode;
}

export function KeyboardShortcutsProvider({ children }: KeyboardShortcutsProviderProps) {
  const [showHelp, setShowHelp] = useState(false);

  // Set up keyboard shortcuts
  useKeyboardShortcuts({
    enabled: true,
    onShowHelp: () => setShowHelp(true),
  });

  return (
    <>
      {children}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </>
  );
}
