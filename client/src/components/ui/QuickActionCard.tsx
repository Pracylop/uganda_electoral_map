import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface QuickActionCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  to: string;
  badge?: string | number;
  badgeVariant?: 'default' | 'warning' | 'success';
}

export function QuickActionCard({
  title,
  description,
  icon,
  to,
  badge,
  badgeVariant = 'default',
}: QuickActionCardProps) {
  const badgeStyles = {
    default: 'bg-gray-600 text-gray-200',
    warning: 'bg-status-warning text-black',
    success: 'bg-status-success text-white',
  };

  return (
    <Link
      to={to}
      className="
        group block bg-surface/85 rounded-lg p-4
        border border-gray-700 hover:border-accent-cyan
        transition-all hover:bg-surface
      "
    >
      <div className="flex items-start gap-3">
        <div className="text-accent-cyan group-hover:text-accent-gold transition-colors">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-headline font-semibold truncate">
              {title}
            </h3>
            {badge !== undefined && (
              <span className={`px-2 py-0.5 text-xs rounded-full ${badgeStyles[badgeVariant]}`}>
                {badge}
              </span>
            )}
          </div>
          <p className="text-gray-400 text-sm mt-1 line-clamp-2">
            {description}
          </p>
        </div>
        <ChevronRight
          size={20}
          className="text-gray-600 group-hover:text-accent-cyan transition-colors flex-shrink-0"
        />
      </div>
    </Link>
  );
}
