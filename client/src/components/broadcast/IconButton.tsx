import { useState, useRef, useCallback, type MouseEvent } from 'react';
import type { LucideIcon } from 'lucide-react';

type ButtonSize = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  size?: ButtonSize;
  active?: boolean;
  disabled?: boolean;
  badge?: number | string;
  className?: string;
  shortcut?: string;
}

const sizeClasses: Record<ButtonSize, { button: string; icon: number }> = {
  sm: { button: 'w-12 h-12', icon: 20 },  // 48px
  md: { button: 'w-14 h-14', icon: 24 },  // 56px
  lg: { button: 'w-16 h-16', icon: 28 },  // 64px
};

export function IconButton({
  icon: Icon,
  label,
  onClick,
  size = 'lg',
  active = false,
  disabled = false,
  badge,
  className = '',
  shortcut,
}: IconButtonProps) {
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rippleId = useRef(0);

  const handleClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;

    // Create ripple effect
    const button = buttonRef.current;
    if (button) {
      const rect = button.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = rippleId.current++;

      setRipples((prev) => [...prev, { x, y, id }]);

      // Remove ripple after animation
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 400);
    }

    onClick?.();
  }, [disabled, onClick]);

  const handleMouseEnter = useCallback(() => {
    tooltipTimeout.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }
    setShowTooltip(false);
  }, []);

  // Long press for touch tooltip
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressTimeout.current = setTimeout(() => {
      setShowTooltip(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
    // Hide tooltip after short delay on touch
    setTimeout(() => setShowTooltip(false), 1500);
  }, []);

  const { button: buttonSize, icon: iconSize } = sizeClasses[size];

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        disabled={disabled}
        className={`
          ${buttonSize}
          relative overflow-hidden
          flex items-center justify-center
          rounded-xl
          transition-all duration-150
          ${active
            ? 'bg-yellow-500 text-gray-900'
            : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
          }
          ${disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer active:scale-95'
          }
          ${className}
        `}
        aria-label={label}
        title={label}
      >
        <Icon size={iconSize} strokeWidth={2} />

        {/* Ripple effects */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
            style={{
              left: ripple.x - 50,
              top: ripple.y - 50,
              width: 100,
              height: 100,
            }}
          />
        ))}

        {/* Badge */}
        {badge !== undefined && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
            {badge}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className="
            absolute left-full ml-3 top-1/2 -translate-y-1/2
            px-3 py-2
            bg-gray-900 text-white text-sm
            rounded-lg shadow-lg
            whitespace-nowrap
            z-50
            animate-fadeIn
            pointer-events-none
          "
        >
          <span>{label}</span>
          {shortcut && (
            <span className="ml-2 px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
              {shortcut}
            </span>
          )}
          {/* Arrow */}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900" />
        </div>
      )}
    </div>
  );
}

// Divider component for grouping buttons
export function IconButtonDivider() {
  return <div className="w-10 h-px bg-gray-700 my-2 mx-auto" />;
}
