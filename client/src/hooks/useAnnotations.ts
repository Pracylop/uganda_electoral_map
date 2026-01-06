import { useState, useCallback, useRef } from 'react';

export type AnnotationTool = 'circle' | 'arrow' | 'freehand' | 'text' | 'rectangle';

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  type: AnnotationTool;
  points: Point[];
  color: string;
  strokeWidth: number;
  text?: string;
}

// Party colors for quick selection
export const ANNOTATION_COLORS = [
  { name: 'NRM Yellow', value: '#FBBF24' },
  { name: 'FDC Blue', value: '#3B82F6' },
  { name: 'NUP Red', value: '#EF4444' },
  { name: 'UPC Red', value: '#DC2626' },
  { name: 'DP Green', value: '#22C55E' },
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#000000' },
];

export const STROKE_WIDTHS = [
  { name: 'Thin', value: 3 },
  { name: 'Medium', value: 5 },
  { name: 'Thick', value: 8 },
];

interface UseAnnotationsReturn {
  annotations: Annotation[];
  activeTool: AnnotationTool | null;
  activeColor: string;
  strokeWidth: number;
  isDrawing: boolean;
  currentPoints: Point[];
  setActiveTool: (tool: AnnotationTool | null) => void;
  setActiveColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  startDrawing: (point: Point) => void;
  continueDrawing: (point: Point) => void;
  finishDrawing: (text?: string) => void;
  cancelDrawing: () => void;
  undo: () => void;
  redo: () => void;
  clearAll: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const [activeTool, setActiveTool] = useState<AnnotationTool | null>(null);
  const [activeColor, setActiveColor] = useState(ANNOTATION_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState(STROKE_WIDTHS[1].value);

  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);

  const idCounter = useRef(0);

  const generateId = useCallback(() => {
    idCounter.current += 1;
    return `annotation-${idCounter.current}-${Date.now()}`;
  }, []);

  const startDrawing = useCallback((point: Point) => {
    if (!activeTool) return;
    setIsDrawing(true);
    setCurrentPoints([point]);
  }, [activeTool]);

  const continueDrawing = useCallback((point: Point) => {
    if (!isDrawing) return;
    setCurrentPoints((prev) => [...prev, point]);
  }, [isDrawing]);

  const finishDrawing = useCallback((text?: string) => {
    if (!isDrawing || !activeTool || currentPoints.length === 0) {
      setIsDrawing(false);
      setCurrentPoints([]);
      return;
    }

    // Save current state for undo
    setUndoStack((prev) => [...prev, annotations]);
    setRedoStack([]);

    const newAnnotation: Annotation = {
      id: generateId(),
      type: activeTool,
      points: currentPoints,
      color: activeColor,
      strokeWidth,
      text: activeTool === 'text' ? text : undefined,
    };

    setAnnotations((prev) => [...prev, newAnnotation]);
    setIsDrawing(false);
    setCurrentPoints([]);
  }, [isDrawing, activeTool, currentPoints, annotations, activeColor, strokeWidth, generateId]);

  const cancelDrawing = useCallback(() => {
    setIsDrawing(false);
    setCurrentPoints([]);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, annotations]);
    setAnnotations(previousState);
    setUndoStack((prev) => prev.slice(0, -1));
  }, [undoStack, annotations]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, annotations]);
    setAnnotations(nextState);
    setRedoStack((prev) => prev.slice(0, -1));
  }, [redoStack, annotations]);

  const clearAll = useCallback(() => {
    if (annotations.length === 0) return;

    setUndoStack((prev) => [...prev, annotations]);
    setRedoStack([]);
    setAnnotations([]);
  }, [annotations]);

  return {
    annotations,
    activeTool,
    activeColor,
    strokeWidth,
    isDrawing,
    currentPoints,
    setActiveTool,
    setActiveColor,
    setStrokeWidth,
    startDrawing,
    continueDrawing,
    finishDrawing,
    cancelDrawing,
    undo,
    redo,
    clearAll,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
