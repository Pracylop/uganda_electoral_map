/**
 * GestureIndicator - Visual feedback for touch gestures
 * Shows indicators for pinch, pan, rotate, and tilt gestures
 */
import { useState, useEffect, useCallback, useRef } from 'react';

type GestureType = 'idle' | 'pan' | 'pinch' | 'rotate' | 'tilt';

interface TouchPoint {
  id: number;
  x: number;
  y: number;
}

interface GestureIndicatorProps {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
}

export function GestureIndicator({ containerRef, enabled = true }: GestureIndicatorProps) {
  const [gestureType, setGestureType] = useState<GestureType>('idle');
  const [touchPoints, setTouchPoints] = useState<TouchPoint[]>([]);
  const [gestureInfo, setGestureInfo] = useState<string>('');
  const lastAngleRef = useRef<number | null>(null);
  const lastDistanceRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAngle = useCallback((p1: TouchPoint, p2: TouchPoint): number => {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
  }, []);

  const getDistance = useCallback((p1: TouchPoint, p2: TouchPoint): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;

    const points: TouchPoint[] = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY
    }));

    setTouchPoints(points);

    if (points.length === 1) {
      setGestureType('pan');
      setGestureInfo('Panning');
    } else if (points.length === 2) {
      lastAngleRef.current = getAngle(points[0], points[1]);
      lastDistanceRef.current = getDistance(points[0], points[1]);
      setGestureType('pinch');
      setGestureInfo('Pinch to zoom');
    }

    // Clear any fade timeout
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
  }, [enabled, getAngle, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled || e.touches.length === 0) return;

    const points: TouchPoint[] = Array.from(e.touches).map(t => ({
      id: t.identifier,
      x: t.clientX,
      y: t.clientY
    }));

    setTouchPoints(points);

    if (points.length === 2 && lastAngleRef.current !== null && lastDistanceRef.current !== null) {
      const currentAngle = getAngle(points[0], points[1]);
      const currentDistance = getDistance(points[0], points[1]);

      const angleDelta = Math.abs(currentAngle - lastAngleRef.current);
      const distanceDelta = Math.abs(currentDistance - lastDistanceRef.current);

      // Determine if rotating, zooming, or tilting based on gesture
      const verticalMovement = Math.abs(points[0].y - touchPoints[0]?.y || 0);

      if (angleDelta > 5 && angleDelta < 175) {
        setGestureType('rotate');
        const direction = currentAngle > lastAngleRef.current ? 'clockwise' : 'counter-clockwise';
        setGestureInfo(`Rotating ${direction}`);
      } else if (verticalMovement > 30 && distanceDelta < 20) {
        setGestureType('tilt');
        setGestureInfo('Tilting view');
      } else if (distanceDelta > 10) {
        setGestureType('pinch');
        const zoomDir = currentDistance > lastDistanceRef.current ? 'in' : 'out';
        setGestureInfo(`Zooming ${zoomDir}`);
      }
    }
  }, [enabled, getAngle, getDistance, touchPoints]);

  const handleTouchEnd = useCallback(() => {
    // Fade out after a short delay
    fadeTimeoutRef.current = setTimeout(() => {
      setGestureType('idle');
      setTouchPoints([]);
      setGestureInfo('');
      lastAngleRef.current = null;
      lastDistanceRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });
    container.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [containerRef, enabled, handleTouchStart, handleTouchMove, handleTouchEnd]);

  if (!enabled || gestureType === 'idle') return null;

  return (
    <>
      {/* Touch point indicators */}
      {touchPoints.map((point) => (
        <div
          key={point.id}
          className="fixed pointer-events-none z-40"
          style={{
            left: point.x - 30,
            top: point.y - 30,
            width: 60,
            height: 60
          }}
        >
          <div className="w-full h-full rounded-full border-4 border-blue-400 bg-blue-400/20 animate-pulse" />
        </div>
      ))}

      {/* Gesture type indicator */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="px-6 py-3 rounded-full bg-black/70 backdrop-blur-sm text-white flex items-center gap-3 shadow-lg transition-all duration-300 ease-out opacity-100 scale-100">
          {/* Gesture Icon */}
          <div className="w-8 h-8">
            {gestureType === 'pan' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L8 6h3v5H6V8l-4 4 4 4v-3h5v5H8l4 4 4-4h-3v-5h5v3l4-4-4-4v3h-5V6h3l-4-4z" />
              </svg>
            )}
            {gestureType === 'pinch' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="8" cy="12" r="3" />
                <circle cx="16" cy="12" r="3" />
                <path d="M8 12H2M16 12h6" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            )}
            {gestureType === 'rotate' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            )}
            {gestureType === 'tilt' && (
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l-5 9h10l-5-9zm0 20l5-9H7l5 9z" />
              </svg>
            )}
          </div>

          {/* Gesture Label */}
          <span className="font-medium text-lg">{gestureInfo}</span>
        </div>
      </div>

      {/* Connection line between two touch points */}
      {touchPoints.length === 2 && (
        <svg
          className="fixed inset-0 pointer-events-none z-30"
          style={{ width: '100%', height: '100%' }}
        >
          <line
            x1={touchPoints[0].x}
            y1={touchPoints[0].y}
            x2={touchPoints[1].x}
            y2={touchPoints[1].y}
            stroke="rgba(59, 130, 246, 0.5)"
            strokeWidth="3"
            strokeDasharray="8 4"
          />
          {/* Center point for rotation indicator */}
          {gestureType === 'rotate' && (
            <circle
              cx={(touchPoints[0].x + touchPoints[1].x) / 2}
              cy={(touchPoints[0].y + touchPoints[1].y) / 2}
              r="8"
              fill="rgba(59, 130, 246, 0.8)"
            />
          )}
        </svg>
      )}
    </>
  );
}
