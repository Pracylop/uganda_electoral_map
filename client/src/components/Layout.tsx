import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ConnectionIndicator } from './ConnectionIndicator';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 text-white px-6 py-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Uganda Electoral Map</h1>
            <p className="text-sm text-gray-400">
              2026 General Elections - Results Display System
            </p>
          </div>
          <nav className="flex items-center space-x-4">
            <Link
              to="/"
              className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/elections"
              className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Elections
            </Link>
            <Link
              to="/map"
              className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Electoral Map
            </Link>
            <Link
              to="/demographics"
              className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Demographics
            </Link>
            <Link
              to="/issues"
              className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
            >
              Issues
            </Link>
            {(user?.role === 'editor' || user?.role === 'admin') && (
              <Link
                to="/approval-queue"
                className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                Approval Queue
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link
                to="/users"
                className="px-3 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                User Management
              </Link>
            )}
            <div className="border-l border-gray-700 pl-4 ml-4 flex items-center gap-4">
              <ConnectionIndicator />
              <span className="text-sm text-gray-400">
                {user?.fullName} ({user?.role})
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-md bg-red-600 hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </nav>
        </div>
      </header>
      {children}
      <footer className="bg-gray-800 text-gray-400 px-6 py-3 text-center text-sm">
        © 2026 Uganda Electoral Map | Powered by React & MapLibre
      </footer>
    </div>
  );
}
