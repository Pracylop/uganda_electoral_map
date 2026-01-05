import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Monitor, LogOut, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { ConnectionIndicator } from './ConnectionIndicator';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) => `
    px-3 py-1.5 rounded text-sm font-medium transition-colors
    ${isActive(path)
      ? 'bg-gray-700 text-white'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
    }
  `;

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      {/* Compact Header */}
      <header className="bg-gray-800 text-white px-4 py-2 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between gap-4">
          {/* Logo - Compact */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">UG</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold leading-tight">Electoral Map</h1>
              <p className="text-xs text-gray-400 leading-tight">2026 Elections</p>
            </div>
          </Link>

          {/* Main Navigation - Center */}
          <nav className="flex items-center gap-1">
            <Link to="/" className={navLinkClass('/')}>
              Home
            </Link>
            <Link to="/elections" className={navLinkClass('/elections')}>
              Elections
            </Link>
            <Link to="/map" className={navLinkClass('/map')}>
              Map
            </Link>
            <Link to="/demographics" className={navLinkClass('/demographics')}>
              Demographics
            </Link>
            <Link to="/issues" className={navLinkClass('/issues')}>
              Issues
            </Link>

            {/* More dropdown for admin/editor links */}
            {(user?.role === 'editor' || user?.role === 'admin') && (
              <div className="relative">
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  onBlur={() => setTimeout(() => setMoreMenuOpen(false), 150)}
                  className={`
                    px-3 py-1.5 rounded text-sm font-medium transition-colors
                    flex items-center gap-1
                    ${moreMenuOpen ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}
                  `}
                >
                  More
                  <ChevronDown size={14} />
                </button>
                {moreMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px] z-50">
                    <Link
                      to="/approval-queue"
                      className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                    >
                      Approval Queue
                    </Link>
                    {user?.role === 'admin' && (
                      <>
                        <Link
                          to="/users"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                          User Management
                        </Link>
                        <Link
                          to="/audit-log"
                          className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
                        >
                          Audit Log
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right Side - Broadcast, Status, User */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Broadcast Button */}
            <button
              onClick={() => window.open('/broadcast?fullscreen=true', '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 text-gray-900 text-sm font-semibold rounded hover:bg-yellow-400 transition-colors"
              title="Launch Broadcast Mode"
            >
              <Monitor size={16} />
              <span className="hidden md:inline">Broadcast</span>
            </button>

            {/* Connection Status */}
            <ConnectionIndicator />

            {/* User Info & Logout */}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-700">
              <Link
                to="/profile"
                className="flex items-center gap-2 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
                title="View Profile"
              >
                <span className="text-xs text-gray-400 hidden lg:block hover:text-white">
                  {user?.fullName}
                </span>
                <span className="px-2 py-0.5 bg-gray-700 text-xs text-gray-300 rounded">
                  {user?.role}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded hover:bg-red-600 text-gray-400 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Takes remaining space */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>

      {/* Compact Footer */}
      <footer className="bg-gray-800 text-gray-500 px-4 py-2 text-center text-xs flex-shrink-0">
        Uganda Electoral Map 2026 | React & MapLibre
      </footer>
    </div>
  );
}
