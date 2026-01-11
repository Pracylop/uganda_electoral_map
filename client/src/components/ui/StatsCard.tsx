import type { ReactNode } from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: ReactNode;
  variant?: 'default' | 'highlight' | 'danger' | 'success';
  showProgress?: boolean;
  progressValue?: number; // 0-100
}

export function StatsCard({
  label,
  value,
  subtext,
  icon,
  variant = 'default',
  showProgress = false,
  progressValue = 0,
}: StatsCardProps) {
  const variantStyles = {
    default: 'border-gray-700',
    highlight: 'border-accent-gold',
    danger: 'border-status-error',
    success: 'border-status-success',
  };

  const progressColors = {
    default: 'bg-accent-cyan',
    highlight: 'bg-accent-gold',
    danger: 'bg-status-error',
    success: 'bg-status-success',
  };

  return (
    <div
      className={`
        bg-surface/85 rounded-lg p-4 border-l-4
        ${variantStyles[variant]}
        transition-all hover:bg-surface
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-body mb-1">{label}</p>
          <p className="text-white text-2xl font-mono font-medium">{value}</p>
          {subtext && (
            <p className="text-gray-500 text-xs mt-1">{subtext}</p>
          )}
        </div>
        {icon && (
          <div className="text-gray-500 ml-2">
            {icon}
          </div>
        )}
      </div>

      {showProgress && (
        <div className="mt-3">
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressColors[variant]} rounded-full transition-all duration-500`}
              style={{ width: `${Math.min(100, Math.max(0, progressValue))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
