import { create } from 'zustand';
import { api } from '../lib/api';

// Key used by ProtectedRoute to track preload state
const PRELOAD_KEY = 'electoral_map_preloaded';

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: string;
  createdAt?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isDesktopMode: boolean;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  loginAsDesktop: () => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User) => void;
}

// Detect if running in Tauri (desktop mode)
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

// Check if there's a token - if so, we need to verify it before deciding auth state
const storedToken = localStorage.getItem('auth_token');

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: storedToken,
  isAuthenticated: false,
  // Start with isLoading: true if there's a stored token (needs verification)
  isLoading: !!storedToken,
  error: null,
  isDesktopMode: false,

  // Desktop mode login - no API call needed, uses local admin account
  loginAsDesktop: () => {
    const desktopUser: User = {
      id: 0,
      username: 'desktop_admin',
      fullName: 'Desktop Administrator',
      role: 'admin',
    };
    localStorage.setItem('auth_token', 'desktop_mode_token');
    localStorage.setItem('desktop_mode', 'true');
    set({
      user: desktopUser,
      token: 'desktop_mode_token',
      isAuthenticated: true,
      isLoading: false,
      isDesktopMode: true,
    });
  },

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.login(username, password);
      localStorage.setItem('auth_token', response.token);
      set({
        user: response.user,
        token: response.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('desktop_mode');
    sessionStorage.removeItem(PRELOAD_KEY); // Reset preload flag so it shows on next login
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isDesktopMode: false,
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    const isDesktop = localStorage.getItem('desktop_mode') === 'true';

    if (!token) {
      // Auto-login in Tauri desktop mode
      if (isTauriEnvironment()) {
        const desktopUser: User = {
          id: 0,
          username: 'desktop_admin',
          fullName: 'Desktop Administrator',
          role: 'admin',
        };
        localStorage.setItem('auth_token', 'desktop_mode_token');
        localStorage.setItem('desktop_mode', 'true');
        set({
          user: desktopUser,
          token: 'desktop_mode_token',
          isAuthenticated: true,
          isLoading: false,
          isDesktopMode: true,
        });
        return;
      }
      set({ isAuthenticated: false, isLoading: false });
      return;
    }

    // If desktop mode token, restore desktop session
    if (isDesktop && token === 'desktop_mode_token') {
      const desktopUser: User = {
        id: 0,
        username: 'desktop_admin',
        fullName: 'Desktop Administrator',
        role: 'admin',
      };
      set({
        user: desktopUser,
        token,
        isAuthenticated: true,
        isLoading: false,
        isDesktopMode: true,
      });
      return;
    }

    set({ isLoading: true });
    try {
      const user = await api.me();
      set({
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          createdAt: user.createdAt,
        },
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('desktop_mode');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        isDesktopMode: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  setUser: (user: User) => set({ user }),
}));
