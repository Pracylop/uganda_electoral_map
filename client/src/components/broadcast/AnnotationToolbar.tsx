import {
  Circle,
  ArrowUpRight,
  Pencil,
  Type,
  Square,
  Undo2,
  Redo2,
  Trash2,
  X,
} from 'lucide-react';
import { IconButton } from './IconButton';
import {
  ANNOTATION_COLORS,
  STROKE_WIDTHS,
  type AnnotationTool,
} from '../../hooks/useAnnotations';
import { useBroadcastStore } from '../../stores/broadcastStore';

interface AnnotationToolbarProps {
  activeTool: AnnotationTool | null;
  activeColor: string;
  strokeWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  onSelectTool: (tool: AnnotationTool | null) => void;
  onSelectColor: (color: string) => void;
  onSelectStrokeWidth: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearAll: () => void;
}

const tools: { tool: AnnotationTool; icon: typeof Circle; label: string }[] = [
  { tool: 'circle', icon: Circle, label: 'Circle' },
  { tool: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { tool: 'rectangle', icon: Square, label: 'Highlight' },
  { tool: 'freehand', icon: Pencil, label: 'Freehand' },
  { tool: 'text', icon: Type, label: 'Text' },
];

export function AnnotationToolbar({
  activeTool,
  activeColor,
  strokeWidth,
  canUndo,
  canRedo,
  onSelectTool,
  onSelectColor,
  onSelectStrokeWidth,
  onUndo,
  onRedo,
  onClearAll,
}: AnnotationToolbarProps) {
  const { annotationMode, toggleAnnotationMode, sidebarExpanded, sidebarPosition } = useBroadcastStore();

  if (!annotationMode) return null;

  const isLeft = sidebarPosition === 'left';

  return (
    <div
      className={`
        fixed bottom-6
        flex items-center gap-4
        p-4
        bg-gray-900/95 backdrop-blur-sm
        rounded-2xl
        border border-gray-700
        shadow-2xl
        z-30
        animate-slideUp
        ${isLeft
          ? `left-6 right-6 ${sidebarExpanded ? 'ml-20' : ''}`
          : `left-6 right-6 ${sidebarExpanded ? 'mr-20' : ''}`
        }
      `}
    >
      {/* Drawing Tools */}
      <div className="flex items-center gap-2">
        {tools.map(({ tool, icon, label }) => (
          <IconButton
            key={tool}
            icon={icon}
            label={label}
            onClick={() => onSelectTool(activeTool === tool ? null : tool)}
            active={activeTool === tool}
            size="md"
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-12 bg-gray-700" />

      {/* Color Picker */}
      <div className="flex items-center gap-2">
        {ANNOTATION_COLORS.slice(0, 5).map((color) => (
          <button
            key={color.value}
            onClick={() => onSelectColor(color.value)}
            className={`
              w-10 h-10
              rounded-full
              border-2
              transition-transform
              ${activeColor === color.value
                ? 'border-white scale-110'
                : 'border-transparent hover:scale-105'
              }
            `}
            style={{ backgroundColor: color.value }}
            title={color.name}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-12 bg-gray-700" />

      {/* Stroke Width */}
      <div className="flex items-center gap-2">
        {STROKE_WIDTHS.map((sw) => (
          <button
            key={sw.value}
            onClick={() => onSelectStrokeWidth(sw.value)}
            className={`
              w-10 h-10
              flex items-center justify-center
              rounded-lg
              transition-colors
              ${strokeWidth === sw.value
                ? 'bg-yellow-500 text-gray-900'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }
            `}
            title={sw.name}
          >
            <div
              className="rounded-full bg-current"
              style={{
                width: sw.value * 2,
                height: sw.value * 2,
              }}
            />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-12 bg-gray-700" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <IconButton
          icon={Undo2}
          label="Undo"
          onClick={onUndo}
          disabled={!canUndo}
          size="sm"
          shortcut="Z"
        />
        <IconButton
          icon={Redo2}
          label="Redo"
          onClick={onRedo}
          disabled={!canRedo}
          size="sm"
          shortcut="Y"
        />
        <IconButton
          icon={Trash2}
          label="Clear All"
          onClick={onClearAll}
          size="sm"
          className="hover:bg-red-600"
        />
      </div>

      {/* Divider */}
      <div className="w-px h-12 bg-gray-700" />

      {/* Close */}
      <IconButton
        icon={X}
        label="Close Annotation Mode"
        onClick={toggleAnnotationMode}
        size="md"
        className="bg-gray-700 hover:bg-gray-600"
      />
    </div>
  );
}
