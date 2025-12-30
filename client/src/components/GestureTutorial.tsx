/**
 * GestureTutorial - Touch gesture onboarding overlay
 * Shows available gestures on first launch or on demand
 */
import { useState, useEffect } from 'react';

interface GestureTutorialProps {
  onDismiss: () => void;
  isVisible: boolean;
}

interface GestureInfo {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const gestures: GestureInfo[] = [
  {
    icon: (
      <svg viewBox="0 0 64 64" className="w-16 h-16">
        <circle cx="32" cy="32" r="8" fill="currentColor" opacity="0.5" />
        <path d="M32 20 L32 12 M32 44 L32 52 M20 32 L12 32 M44 32 L52 32"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    ),
    title: 'Drag to Pan',
    description: 'Touch and drag with one finger to move around the map'
  },
  {
    icon: (
      <svg viewBox="0 0 64 64" className="w-16 h-16">
        <circle cx="22" cy="32" r="6" fill="currentColor" />
        <circle cx="42" cy="32" r="6" fill="currentColor" />
        <path d="M22 32 L10 32 M42 32 L54 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="d" values="M22 32 L10 32 M42 32 L54 32;M22 32 L16 32 M42 32 L48 32;M22 32 L10 32 M42 32 L54 32" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M16 26 L10 32 L16 38 M48 26 L54 32 L48 38" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Pinch to Zoom',
    description: 'Use two fingers to pinch in or out to zoom the map'
  },
  {
    icon: (
      <svg viewBox="0 0 64 64" className="w-16 h-16">
        <circle cx="22" cy="32" r="6" fill="currentColor" />
        <circle cx="42" cy="32" r="6" fill="currentColor" />
        <path d="M22 24 A8 8 0 0 1 22 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="45 32 32" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M42 24 A8 8 0 0 0 42 40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="45 32 32" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M32 10 L36 16 L28 16 Z" fill="currentColor">
          <animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="3s" repeatCount="indefinite" />
        </path>
      </svg>
    ),
    title: 'Rotate Map',
    description: 'Twist with two fingers to rotate the map view'
  },
  {
    icon: (
      <svg viewBox="0 0 64 64" className="w-16 h-16">
        <circle cx="22" cy="36" r="6" fill="currentColor" />
        <circle cx="42" cy="36" r="6" fill="currentColor" />
        <path d="M22 36 L22 24 M42 36 L42 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <animate attributeName="d" values="M22 36 L22 24 M42 36 L42 24;M22 36 L22 44 M42 36 L42 44;M22 36 L22 24 M42 36 L42 24" dur="2s" repeatCount="indefinite" />
        </path>
        <ellipse cx="32" cy="16" rx="16" ry="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
        <ellipse cx="32" cy="48" rx="20" ry="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      </svg>
    ),
    title: 'Tilt View',
    description: 'Drag up/down with two fingers to tilt the 3D perspective'
  },
  {
    icon: (
      <svg viewBox="0 0 64 64" className="w-16 h-16">
        <circle cx="32" cy="32" r="6" fill="currentColor">
          <animate attributeName="r" values="6;4;6;4;6" dur="0.6s" repeatCount="indefinite" />
        </circle>
        <circle cx="32" cy="32" r="12" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
          <animate attributeName="r" values="12;16;12" dur="0.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="0.6s" repeatCount="indefinite" />
        </circle>
      </svg>
    ),
    title: 'Double-Tap to Zoom',
    description: 'Quickly tap twice to zoom in on a location'
  },
  {
    icon: (
      <svg viewBox="0 0 64 64" className="w-16 h-16">
        <circle cx="32" cy="32" r="6" fill="currentColor" />
        <rect x="20" y="44" width="24" height="4" rx="2" fill="currentColor" opacity="0.5" />
        <path d="M32 38 L32 48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <text x="32" y="58" textAnchor="middle" fontSize="8" fill="currentColor">TAP</text>
      </svg>
    ),
    title: 'Tap for Details',
    description: 'Tap any region to see detailed election results'
  }
];

export function GestureTutorial({ onDismiss, isVisible }: GestureTutorialProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  // Handle swipe navigation within tutorial
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const deltaX = e.changedTouches[0].clientX - touchStart.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.y;

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0 && currentPage > 0) {
        setCurrentPage(currentPage - 1);
      } else if (deltaX < 0 && currentPage < gestures.length - 1) {
        setCurrentPage(currentPage + 1);
      }
    }
    setTouchStart(null);
  };

  // Reset to first page when shown
  useEffect(() => {
    if (isVisible) {
      setCurrentPage(0);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const gesture = gestures[currentPage];

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onDismiss}
    >
      <div
        className="bg-gray-900 rounded-2xl p-8 max-w-md mx-4 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Touch Gestures</h2>
          <button
            onClick={onDismiss}
            className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition-colors"
            aria-label="Close tutorial"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Gesture Display */}
        <div className="text-center py-8">
          <div className="text-blue-400 mb-4 flex justify-center">
            {gesture.icon}
          </div>
          <h3 className="text-2xl font-bold mb-2">{gesture.title}</h3>
          <p className="text-gray-400">{gesture.description}</p>
        </div>

        {/* Page Indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {gestures.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={`w-3 h-3 rounded-full transition-all ${
                index === currentPage
                  ? 'bg-blue-500 w-6'
                  : 'bg-gray-600 hover:bg-gray-500'
              }`}
              aria-label={`Go to gesture ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {currentPage > 0 && (
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              className="flex-1 py-3 px-6 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Previous
            </button>
          )}
          {currentPage < gestures.length - 1 ? (
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              className="flex-1 py-3 px-6 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="flex-1 py-3 px-6 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
            >
              Got it!
            </button>
          )}
        </div>

        {/* Skip hint */}
        <p className="text-center text-gray-500 text-sm mt-4">
          Swipe left/right to navigate • Tap outside to close
        </p>
      </div>
    </div>
  );
}

// Hook to manage tutorial visibility
export function useGestureTutorial() {
  const STORAGE_KEY = 'gesture-tutorial-seen';
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

  useEffect(() => {
    // Check if user has seen the tutorial
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      // Check if this is a touch device
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      if (isTouchDevice) {
        setShowTutorial(true);
        setHasSeenTutorial(false);
      }
    }
  }, []);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasSeenTutorial(true);
  };

  const openTutorial = () => {
    setShowTutorial(true);
  };

  return {
    showTutorial,
    hasSeenTutorial,
    dismissTutorial,
    openTutorial
  };
}
