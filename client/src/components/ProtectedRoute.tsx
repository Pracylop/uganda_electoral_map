import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { DataPreloader } from './DataPreloader';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

// Use sessionStorage to track if preload has happened this browser session
// This persists across hot reloads but resets on page refresh
const PRELOAD_KEY = 'electoral_map_preloaded';

function hasPreloaded(): boolean {
  return sessionStorage.getItem(PRELOAD_KEY) === 'true';
}

function markPreloaded(): void {
  sessionStorage.setItem(PRELOAD_KEY, 'true');
}

// Reset preload flag when user logs out
export function resetPreloadFlag(): void {
  sessionStorage.removeItem(PRELOAD_KEY);
}

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, checkAuth } = useAuthStore();
  const [showPreloader, setShowPreloader] = useState(!hasPreloaded());

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // When preloader completes, mark as preloaded and hide it
  const handlePreloadComplete = () => {
    markPreloaded();
    setShowPreloader(false);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user && !requiredRole.includes(user.role)) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-400">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Show preloader only on first protected route access after auth
  if (showPreloader) {
    return <DataPreloader onComplete={handlePreloadComplete}>{children}</DataPreloader>;
  }

  return <>{children}</>;
}
