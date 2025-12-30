/**
 * useSwipeNavigation - Edge swipe detection for navigation
 * Detects horizontal swipes at screen edges for level navigation
 * Detects vertical swipes for election cycling
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface SwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onEdgeSwipeLeft?: () => void;   // Swipe from left edge
  onEdgeSwipeRight?: () => void;  // Swipe from right edge
  enabled?: boolean;
  edgeThreshold?: number;         // Pixels from edge to trigger edge swipe
  swipeThreshold?: number;        // Minimum swipe distance
  velocityThreshold?: number;     // Minimum swipe velocity
}

interface SwipeState {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  isEdgeSwipe: boolean;
  progress: number; // 0-1 progress for visual feedback
}

export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onEdgeSwipeLeft,
  onEdgeSwipeRight,
  enabled = true,
  edgeThreshold = 30,
  swipeThreshold = 80,
  velocityThreshold = 0.3
}: SwipeNavigationOptions) {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    direction: null,
    isEdgeSwipe: false,
    progress: 0
  });

  const touchStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    isFromLeftEdge: boolean;
    isFromRightEdge: boolean;
  } | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const screenWidth = window.innerWidth;

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
      isFromLeftEdge: touch.clientX < edgeThreshold,
      isFromRightEdge: touch.clientX > screenWidth - edgeThreshold
    };
  }, [enabled, edgeThreshold]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // Determine swipe direction
    if (absX > absY && absX > 20) {
      const direction = deltaX > 0 ? 'right' : 'left';
      const isEdgeSwipe = direction === 'right'
        ? touchStartRef.current.isFromLeftEdge
        : touchStartRef.current.isFromRightEdge;
      const progress = Math.min(absX / swipeThreshold, 1);

      setSwipeState({ direction, isEdgeSwipe, progress });
    } else if (absY > absX && absY > 20) {
      const direction = deltaY > 0 ? 'down' : 'up';
      const progress = Math.min(absY / swipeThreshold, 1);
      setSwipeState({ direction, isEdgeSwipe: false, progress });
    }
  }, [enabled, swipeThreshold]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const duration = Date.now() - touchStartRef.current.time;
    const velocity = Math.max(absX, absY) / duration;

    // Check if swipe meets threshold
    const isValidSwipe = (absX > swipeThreshold || absY > swipeThreshold) ||
                         velocity > velocityThreshold;

    if (isValidSwipe) {
      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0) {
          // Swiping right
          if (touchStartRef.current.isFromLeftEdge && onEdgeSwipeLeft) {
            onEdgeSwipeLeft();
          } else if (onSwipeRight) {
            onSwipeRight();
          }
        } else {
          // Swiping left
          if (touchStartRef.current.isFromRightEdge && onEdgeSwipeRight) {
            onEdgeSwipeRight();
          } else if (onSwipeLeft) {
            onSwipeLeft();
          }
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    // Reset state
    touchStartRef.current = null;
    setSwipeState({ direction: null, isEdgeSwipe: false, progress: 0 });
  }, [
    enabled, swipeThreshold, velocityThreshold,
    onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown,
    onEdgeSwipeLeft, onEdgeSwipeRight
  ]);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return swipeState;
}

/**
 * SwipeIndicator - Visual feedback component for swipe gestures
 */
interface SwipeIndicatorProps {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  progress: number;
  isEdgeSwipe: boolean;
  labels?: {
    left?: string;
    right?: string;
    up?: string;
    down?: string;
  };
}

export function SwipeIndicator({
  direction,
  progress,
  isEdgeSwipe,
  labels = {
    left: 'Drill Down',
    right: 'Go Back',
    up: 'Next Election',
    down: 'Previous Election'
  }
}: SwipeIndicatorProps) {
  if (!direction || progress < 0.2) return null;

  const opacity = Math.min(progress * 1.5, 1);
  const scale = 0.8 + progress * 0.2;

  const positionClasses = {
    left: 'right-8 top-1/2 -translate-y-1/2',
    right: 'left-8 top-1/2 -translate-y-1/2',
    up: 'bottom-24 left-1/2 -translate-x-1/2',
    down: 'top-24 left-1/2 -translate-x-1/2'
  };

  const arrowRotation = {
    left: 'rotate-180',
    right: '',
    up: '-rotate-90',
    down: 'rotate-90'
  };

  const label = labels[direction];

  return (
    <div
      className={`fixed ${positionClasses[direction]} z-50 pointer-events-none`}
      style={{ opacity, transform: `scale(${scale})` }}
    >
      <div className={`
        flex items-center gap-3 px-6 py-4 rounded-2xl
        ${isEdgeSwipe ? 'bg-blue-600/90' : 'bg-gray-800/90'}
        backdrop-blur-sm shadow-2xl
      `}>
        {/* Arrow */}
        <div className={`w-8 h-8 ${arrowRotation[direction]}`}>
          <svg viewBox="0 0 24 24" fill="white">
            <path d="M10 17l5-5-5-5v10z" />
          </svg>
        </div>

        {/* Label */}
        <span className="text-white font-semibold text-lg whitespace-nowrap">
          {label}
        </span>

        {/* Progress indicator */}
        {progress >= 0.8 && (
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center animate-pulse">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
