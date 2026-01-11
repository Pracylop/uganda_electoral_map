/**
 * DataCompletenessBadge Component
 *
 * Shows the source and completeness of data being displayed.
 * - Published: Official data from authoritative sources (green)
 * - Calculated: Computed from database records (blue)
 * - Partial: Incomplete data coverage (yellow)
 * - Missing: No data available (gray)
 */

import React from 'react';

interface DataCompletenessBadgeProps {
  type: 'published' | 'calculated' | 'partial' | 'missing';
  source?: string;
  recordCount?: number;
  expectedCount?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

const typeConfig = {
  published: {
    icon: '✓',
    label: 'Official Data',
    color: '#22c55e', // green
    bgColor: 'rgba(34, 197, 94, 0.1)',
    description: 'Data from authoritative sources (Electoral Commission, IPU, etc.)',
  },
  calculated: {
    icon: '⚡',
    label: 'Live Calculation',
    color: '#3b82f6', // blue
    bgColor: 'rgba(59, 130, 246, 0.1)',
    description: 'Computed from database records in real-time',
  },
  partial: {
    icon: '⚠',
    label: 'Partial Data',
    color: '#eab308', // yellow
    bgColor: 'rgba(234, 179, 8, 0.1)',
    description: 'Some records are missing or incomplete',
  },
  missing: {
    icon: '✕',
    label: 'No Data',
    color: '#6b7280', // gray
    bgColor: 'rgba(107, 114, 128, 0.1)',
    description: 'No data available for this selection',
  },
};

const sizeConfig = {
  sm: {
    fontSize: '10px',
    padding: '2px 6px',
    iconSize: '10px',
  },
  md: {
    fontSize: '12px',
    padding: '4px 10px',
    iconSize: '12px',
  },
  lg: {
    fontSize: '14px',
    padding: '6px 14px',
    iconSize: '14px',
  },
};

export const DataCompletenessBadge: React.FC<DataCompletenessBadgeProps> = ({
  type,
  source,
  recordCount,
  expectedCount,
  className = '',
  size = 'md',
  showTooltip = true,
}) => {
  const config = typeConfig[type];
  const sizes = sizeConfig[size];

  // Calculate completeness percentage for partial data
  const completenessPercent =
    type === 'partial' && recordCount !== undefined && expectedCount !== undefined && expectedCount > 0
      ? Math.round((recordCount / expectedCount) * 100)
      : null;

  const displayLabel =
    type === 'partial' && completenessPercent !== null
      ? `${completenessPercent}% Complete`
      : config.label;

  const tooltipText = [
    config.description,
    source && `Source: ${source}`,
    recordCount !== undefined && expectedCount !== undefined && `Records: ${recordCount}/${expectedCount}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span
      className={className}
      title={showTooltip ? tooltipText : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: sizes.padding,
        fontSize: sizes.fontSize,
        fontWeight: 500,
        color: config.color,
        backgroundColor: config.bgColor,
        borderRadius: '4px',
        border: `1px solid ${config.color}30`,
        cursor: showTooltip ? 'help' : 'default',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: sizes.iconSize }}>{config.icon}</span>
      <span>{displayLabel}</span>
      {source && size !== 'sm' && (
        <span
          style={{
            opacity: 0.7,
            fontSize: `calc(${sizes.fontSize} - 1px)`,
            marginLeft: '2px',
          }}
        >
          ({source})
        </span>
      )}
    </span>
  );
};

/**
 * Inline source attribution for use in cards/stats
 */
interface SourceAttributionProps {
  source: string;
  year?: number;
  className?: string;
}

export const SourceAttribution: React.FC<SourceAttributionProps> = ({
  source,
  year,
  className = '',
}) => {
  return (
    <span
      className={className}
      style={{
        fontSize: '10px',
        color: '#6b7280',
        opacity: 0.8,
      }}
    >
      Source: {source}
      {year && `, ${year}`}
    </span>
  );
};

/**
 * Hook to determine data type based on available data
 */
export function useDataType(options: {
  hasPublished: boolean;
  calculatedCount?: number;
  expectedCount?: number;
}): {
  type: 'published' | 'calculated' | 'partial' | 'missing';
  source?: string;
} {
  const { hasPublished, calculatedCount, expectedCount } = options;

  if (hasPublished) {
    return { type: 'published' };
  }

  if (calculatedCount === undefined || calculatedCount === 0) {
    return { type: 'missing' };
  }

  if (expectedCount !== undefined && calculatedCount < expectedCount * 0.9) {
    return { type: 'partial' };
  }

  return { type: 'calculated' };
}

export default DataCompletenessBadge;
