/**
 * Keyboard Shortcuts Help Dialog
 * Shows all available keyboard shortcuts organized by category
 */

import { X, Keyboard } from 'lucide-react';
import { KEYBOARD_SHORTCUTS } from '../hooks/useKeyboardShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const navigationShortcuts = KEYBOARD_SHORTCUTS.filter(s => s.category === 'navigation');
  const actionShortcuts = KEYBOARD_SHORTCUTS.filter(s => s.category === 'actions');
  const broadcastShortcuts = KEYBOARD_SHORTCUTS.filter(s => s.category === 'broadcast');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <Keyboard size={24} className="text-yellow-400" />
            <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Navigation */}
            <div>
              <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">
                Navigation
              </h3>
              <div className="space-y-2">
                {navigationShortcuts.map(shortcut => (
                  <ShortcutRow
                    key={shortcut.key}
                    shortcut={shortcut.combo || shortcut.key}
                    description={shortcut.description}
                  />
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">
                Actions
              </h3>
              <div className="space-y-2">
                {actionShortcuts.map(shortcut => (
                  <ShortcutRow
                    key={shortcut.key}
                    shortcut={shortcut.combo || shortcut.key}
                    description={shortcut.description}
                  />
                ))}
                <ShortcutRow shortcut="Ctrl + Enter" description="Submit form" />
                <ShortcutRow shortcut="Tab" description="Next field" />
                <ShortcutRow shortcut="Shift + Tab" description="Previous field" />
              </div>
            </div>

            {/* Broadcast Mode */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">
                Broadcast Mode
              </h3>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {broadcastShortcuts.map(shortcut => (
                  <ShortcutRow
                    key={shortcut.key}
                    shortcut={shortcut.key}
                    description={shortcut.description}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer tip */}
          <div className="mt-6 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              <span className="text-gray-300">Tip:</span> Shortcuts are disabled when typing in input fields.
              Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs">?</kbd> anytime to show this help.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShortcutRow({ shortcut, description }: { shortcut: string; description: string }) {
  // Split combo shortcuts like "G then E" into parts
  const parts = shortcut.split(' then ');

  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-300 text-sm">{description}</span>
      <div className="flex items-center gap-1">
        {parts.map((part, index) => (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && <span className="text-gray-500 text-xs">then</span>}
            <kbd className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs font-mono text-gray-200 min-w-[24px] text-center">
              {part}
            </kbd>
          </span>
        ))}
      </div>
    </div>
  );
}
