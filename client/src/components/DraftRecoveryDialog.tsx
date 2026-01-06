import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface DraftRecoveryDialogProps {
  isOpen: boolean;
  draftAge: string | null;
  onRestore: () => void;
  onDiscard: () => void;
  formName?: string;
}

export function DraftRecoveryDialog({
  isOpen,
  draftAge,
  onRestore,
  onDiscard,
  formName = 'form',
}: DraftRecoveryDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-yellow-600 px-6 py-4 flex items-center gap-3">
          <AlertTriangle size={24} className="text-gray-900" />
          <h3 className="text-lg font-bold text-gray-900">Unsaved Draft Found</h3>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-300 mb-4">
            We found an unsaved draft for this {formName} from{' '}
            <span className="text-yellow-400 font-medium">{draftAge || 'recently'}</span>.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Would you like to restore your previous work or start fresh?
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onRestore}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              <RefreshCw size={18} />
              Restore Draft
            </button>
            <button
              onClick={onDiscard}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              <Trash2 size={18} />
              Start Fresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
