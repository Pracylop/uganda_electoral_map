import { Cloud, CloudOff, Loader2 } from 'lucide-react';

interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges?: boolean;
}

export function AutoSaveIndicator({
  isSaving,
  lastSaved,
  hasUnsavedChanges = false,
}: AutoSaveIndicatorProps) {
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isSaving) {
    return (
      <div className="flex items-center gap-2 text-yellow-400 text-sm">
        <Loader2 size={14} className="animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm">
        <Cloud size={14} />
        <span>Saved at {formatTime(lastSaved)}</span>
      </div>
    );
  }

  if (hasUnsavedChanges) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <CloudOff size={14} />
        <span>Unsaved changes</span>
      </div>
    );
  }

  return null;
}
