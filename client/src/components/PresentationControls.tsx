/**
 * PresentationControls - Edge-swipe revealed controls for presentation mode
 * Shows controls panel when swiping from screen edges
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface PresentationControlsProps {
  isPresentationMode: boolean;
  onExitPresentation: () => void;
  onPreviousLevel?: () => void;
  onNextLevel?: () => void;
  onPreviousElection?: () => void;
  onNextElection?: () => void;
  onToggleDashboard?: () => void;
  onShowHelp?: () => void;
  currentLevel?: string;
  currentElection?: string;
  showDashboard?: boolean;
}

export function PresentationControls({
  isPresentationMode,
  onExitPresentation,
  onPreviousLevel,
  onNextLevel,
  onPreviousElection,
  onNextElection,
  onToggleDashboard,
  onShowHelp,
  currentLevel,
  currentElection,
  showDashboard
}: PresentationControlsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [edgeIndicator, setEdgeIndicator] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Auto-hide after inactivity
  const scheduleHide = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    hideTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 4000);
  }, []);

  const showControls = useCallback(() => {
    setIsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  // Handle edge touch detection
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!isPresentationMode) return;

    const touch = e.touches[0];
    const { clientX: x, clientY: y } = touch;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const edgeSize = 40;

    touchStartRef.current = { x, y, time: Date.now() };

    // Detect which edge
    if (x < edgeSize) {
      setEdgeIndicator('left');
    } else if (x > screenWidth - edgeSize) {
      setEdgeIndicator('right');
    } else if (y < edgeSize) {
      setEdgeIndicator('top');
    } else if (y > screenHeight - edgeSize) {
      setEdgeIndicator('bottom');
    }
  }, [isPresentationMode]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPresentationMode || !touchStartRef.current || !edgeIndicator) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // Check for swipe from edge
    const threshold = 60;
    if (
      (edgeIndicator === 'left' && deltaX > threshold) ||
      (edgeIndicator === 'right' && deltaX < -threshold) ||
      (edgeIndicator === 'top' && deltaY > threshold) ||
      (edgeIndicator === 'bottom' && deltaY < -threshold)
    ) {
      showControls();
      setEdgeIndicator(null);
    }
  }, [isPresentationMode, edgeIndicator, showControls]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    setEdgeIndicator(null);
  }, []);

  // Also show controls on any tap (for simpler interaction)
  const handleTap = useCallback((e: TouchEvent) => {
    if (!isPresentationMode) return;

    // Quick tap detection (< 200ms, < 10px movement)
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    const duration = Date.now() - touchStartRef.current.time;

    if (duration < 200 && deltaX < 10 && deltaY < 10) {
      showControls();
    }
  }, [isPresentationMode, showControls]);

  useEffect(() => {
    if (!isPresentationMode) {
      setIsVisible(false);
      return;
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchend', handleTap, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchend', handleTap);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [isPresentationMode, handleTouchStart, handleTouchMove, handleTouchEnd, handleTap]);

  if (!isPresentationMode) return null;

  return (
    <>
      {/* Edge indicators - show where to swipe */}
      {!isVisible && (
        <>
          {/* Left edge indicator */}
          <div className="fixed left-0 top-1/2 -translate-y-1/2 w-1 h-24 bg-white/20 rounded-r-full" />
          {/* Right edge indicator */}
          <div className="fixed right-0 top-1/2 -translate-y-1/2 w-1 h-24 bg-white/20 rounded-l-full" />
          {/* Top edge indicator */}
          <div className="fixed top-0 left-1/2 -translate-x-1/2 h-1 w-24 bg-white/20 rounded-b-full" />
        </>
      )}

      {/* Active edge swipe indicator */}
      {edgeIndicator && (
        <div className={`
          fixed z-50 pointer-events-none transition-opacity duration-200
          ${edgeIndicator === 'left' ? 'left-0 top-0 h-full w-16 bg-gradient-to-r from-blue-500/30 to-transparent' : ''}
          ${edgeIndicator === 'right' ? 'right-0 top-0 h-full w-16 bg-gradient-to-l from-blue-500/30 to-transparent' : ''}
          ${edgeIndicator === 'top' ? 'top-0 left-0 w-full h-16 bg-gradient-to-b from-blue-500/30 to-transparent' : ''}
          ${edgeIndicator === 'bottom' ? 'bottom-0 left-0 w-full h-16 bg-gradient-to-t from-blue-500/30 to-transparent' : ''}
        `} />
      )}

      {/* Control Panel */}
      <div className={`
        fixed bottom-8 left-1/2 -translate-x-1/2 z-50
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}
      `}>
        <div className="bg-black/80 backdrop-blur-lg rounded-2xl p-4 shadow-2xl">
          {/* Current state display */}
          <div className="text-center text-white mb-4 px-4">
            <div className="text-sm text-gray-400">{currentElection}</div>
            <div className="text-lg font-semibold">{currentLevel}</div>
          </div>

          {/* Control buttons */}
          <div className="flex items-center gap-3">
            {/* Navigation controls */}
            <div className="flex items-center gap-1 bg-gray-800/80 rounded-xl p-1">
              <button
                onClick={onPreviousLevel}
                disabled={!onPreviousLevel}
                className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                title="Previous Level"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                </svg>
              </button>
              <button
                onClick={onNextLevel}
                disabled={!onNextLevel}
                className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                title="Next Level"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-10 bg-gray-600" />

            {/* Election navigation */}
            <div className="flex flex-col gap-1">
              <button
                onClick={onPreviousElection}
                disabled={!onPreviousElection}
                className="w-12 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                title="Previous Election"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
                </svg>
              </button>
              <button
                onClick={onNextElection}
                disabled={!onNextElection}
                className="w-12 h-6 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition-colors"
                title="Next Election"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-10 bg-gray-600" />

            {/* Toggle dashboard */}
            <button
              onClick={onToggleDashboard}
              className={`
                w-14 h-14 rounded-lg flex items-center justify-center text-white transition-colors
                ${showDashboard ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}
              `}
              title="Toggle Dashboard"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
              </svg>
            </button>

            {/* Help button */}
            <button
              onClick={onShowHelp}
              className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-white transition-colors"
              title="Show Gestures Help"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" />
              </svg>
            </button>

            {/* Divider */}
            <div className="w-px h-10 bg-gray-600" />

            {/* Exit presentation mode */}
            <button
              onClick={onExitPresentation}
              className="w-14 h-14 rounded-lg bg-red-600 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
              title="Exit Presentation Mode (ESC)"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
              </svg>
            </button>
          </div>

          {/* Hint text */}
          <div className="text-center text-gray-500 text-xs mt-3">
            Tap anywhere to show/hide • Swipe from edges • Press ESC to exit
          </div>
        </div>
      </div>
    </>
  );
}
