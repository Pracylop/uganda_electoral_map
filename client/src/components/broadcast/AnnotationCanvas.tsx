import { useRef, useCallback, useEffect } from 'react';
import type { Annotation, Point, AnnotationTool } from '../../hooks/useAnnotations';

interface AnnotationCanvasProps {
  annotations: Annotation[];
  isDrawing: boolean;
  currentPoints: Point[];
  activeTool: AnnotationTool | null;
  activeColor: string;
  strokeWidth: number;
  onStartDrawing: (point: Point) => void;
  onContinueDrawing: (point: Point) => void;
  onFinishDrawing: (text?: string) => void;
  enabled: boolean;
}

export function AnnotationCanvas({
  annotations,
  isDrawing,
  currentPoints,
  activeTool,
  activeColor,
  strokeWidth,
  onStartDrawing,
  onContinueDrawing,
  onFinishDrawing,
  enabled,
}: AnnotationCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const getPointerPosition = useCallback((e: React.PointerEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };

    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled || !activeTool) return;

    e.preventDefault();
    const point = getPointerPosition(e);
    onStartDrawing(point);
  }, [enabled, activeTool, getPointerPosition, onStartDrawing]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing) return;

    e.preventDefault();
    const point = getPointerPosition(e);
    onContinueDrawing(point);
  }, [isDrawing, getPointerPosition, onContinueDrawing]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawing) return;

    e.preventDefault();

    if (activeTool === 'text') {
      const text = prompt('Enter text:');
      if (text) {
        onFinishDrawing(text);
      } else {
        onFinishDrawing();
      }
    } else {
      onFinishDrawing();
    }
  }, [isDrawing, activeTool, onFinishDrawing]);

  // Prevent touch scrolling when drawing
  useEffect(() => {
    if (!enabled) return;

    const svg = svgRef.current;
    if (!svg) return;

    const preventDefault = (e: TouchEvent) => {
      if (isDrawing) {
        e.preventDefault();
      }
    };

    svg.addEventListener('touchmove', preventDefault, { passive: false });
    return () => svg.removeEventListener('touchmove', preventDefault);
  }, [enabled, isDrawing]);

  return (
    <svg
      ref={svgRef}
      className={`
        absolute inset-0 w-full h-full
        ${enabled ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}
        z-20
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Render completed annotations */}
      {annotations.map((annotation) => (
        <AnnotationShape key={annotation.id} annotation={annotation} />
      ))}

      {/* Render current drawing */}
      {isDrawing && currentPoints.length > 0 && activeTool && (
        <AnnotationShape
          annotation={{
            id: 'current',
            type: activeTool,
            points: currentPoints,
            color: activeColor,
            strokeWidth,
          }}
          isPreview
        />
      )}
    </svg>
  );
}

interface AnnotationShapeProps {
  annotation: Annotation;
  isPreview?: boolean;
}

function AnnotationShape({ annotation, isPreview }: AnnotationShapeProps) {
  const { type, points, color, strokeWidth, text } = annotation;

  if (points.length === 0) return null;

  const opacity = isPreview ? 0.7 : 1;

  switch (type) {
    case 'circle': {
      if (points.length < 2) {
        // Just show a dot while starting
        return (
          <circle
            cx={points[0].x}
            cy={points[0].y}
            r={5}
            fill={color}
            opacity={opacity}
          />
        );
      }
      // Calculate radius from first to last point
      const center = points[0];
      const edge = points[points.length - 1];
      const radius = Math.sqrt(
        Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
      );
      return (
        <circle
          cx={center.x}
          cy={center.y}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    }

    case 'arrow': {
      if (points.length < 2) return null;
      const start = points[0];
      const end = points[points.length - 1];

      // Calculate arrow head
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = 20;
      const headAngle = Math.PI / 6;

      const head1 = {
        x: end.x - headLength * Math.cos(angle - headAngle),
        y: end.y - headLength * Math.sin(angle - headAngle),
      };
      const head2 = {
        x: end.x - headLength * Math.cos(angle + headAngle),
        y: end.y - headLength * Math.sin(angle + headAngle),
      };

      return (
        <g opacity={opacity}>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <polygon
            points={`${end.x},${end.y} ${head1.x},${head1.y} ${head2.x},${head2.y}`}
            fill={color}
          />
        </g>
      );
    }

    case 'freehand': {
      if (points.length < 2) return null;
      const pathData = points.reduce((acc, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        return `${acc} L ${point.x} ${point.y}`;
      }, '');

      return (
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      );
    }

    case 'text': {
      const position = points[0];
      if (!text && isPreview) {
        // Show cursor indicator while placing
        return (
          <g opacity={opacity}>
            <line
              x1={position.x}
              y1={position.y - 15}
              x2={position.x}
              y2={position.y + 15}
              stroke={color}
              strokeWidth={2}
            />
            <text
              x={position.x + 10}
              y={position.y + 5}
              fill={color}
              fontSize="16"
              fontFamily="sans-serif"
            >
              Click to add text
            </text>
          </g>
        );
      }
      return (
        <text
          x={position.x}
          y={position.y}
          fill={color}
          fontSize="24"
          fontWeight="bold"
          fontFamily="sans-serif"
          style={{
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
          opacity={opacity}
        >
          {text}
        </text>
      );
    }

    case 'rectangle': {
      if (points.length < 2) {
        // Just show a dot while starting
        return (
          <circle
            cx={points[0].x}
            cy={points[0].y}
            r={5}
            fill={color}
            opacity={opacity}
          />
        );
      }
      // Calculate rectangle from first to last point
      const start = points[0];
      const end = points[points.length - 1];
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color}
          fillOpacity={0.3}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
        />
      );
    }

    default:
      return null;
  }
}
