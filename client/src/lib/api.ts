const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiError {
  error: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('auth_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({
      error: 'Network error',
    }));
    throw new Error(error.error);
  }

  return response.json();
}

export const api = {
  // Auth endpoints
  login: (username: string, password: string) =>
    apiRequest<{
      message: string;
      token: string;
      user: { id: number; username: string; fullName: string; role: string };
    }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () =>
    apiRequest<{
      id: number;
      username: string;
      fullName: string;
      role: string;
      isActive: boolean;
      createdAt: string;
    }>('/api/auth/me'),

  // User management endpoints
  getUsers: () =>
    apiRequest<
      Array<{
        id: number;
        username: string;
        fullName: string;
        role: string;
        isActive: boolean;
        createdAt: string;
      }>
    >('/api/users'),

  createUser: (userData: {
    username: string;
    password: string;
    fullName: string;
    role: string;
  }) =>
    apiRequest<{
      message: string;
      user: {
        id: number;
        username: string;
        fullName: string;
        role: string;
        isActive: boolean;
      };
    }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUser: (
    id: number,
    userData: {
      username?: string;
      password?: string;
      fullName?: string;
      role?: string;
      isActive?: boolean;
    }
  ) =>
    apiRequest<{
      message: string;
      user: {
        id: number;
        username: string;
        fullName: string;
        role: string;
        isActive: boolean;
      };
    }>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  deleteUser: (id: number) =>
    apiRequest<{ message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    }),

  // Election endpoints
  getElections: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        electionDate: string;
        electionType: string;
        isActive: boolean;
        createdAt: string;
        _count: { candidates: number; results: number };
      }>
    >('/api/elections'),

  getActiveElection: () =>
    apiRequest<{
      id: number;
      name: string;
      electionDate: string;
      electionType: string;
      isActive: boolean;
      candidates: Array<{
        id: number;
        name: string;
        party: string;
        partyColor: string | null;
        photoUrl: string | null;
      }>;
    }>('/api/elections/active'),

  getElectionById: (id: number) =>
    apiRequest<{
      id: number;
      name: string;
      electionDate: string;
      electionType: string;
      isActive: boolean;
      candidates: Array<{
        id: number;
        name: string;
        party: string;
        partyColor: string | null;
      }>;
      _count: { results: number };
    }>(`/api/elections/${id}`),

  // Results endpoints
  getResultsByElection: (electionId: number) =>
    apiRequest<
      Array<{
        id: number;
        electionId: number;
        candidateId: number;
        administrativeUnitId: number;
        votes: number;
        validVotes: number | null;
        invalidVotes: number | null;
        turnout: number | null;
        status: string;
        candidate: {
          id: number;
          name: string;
          party: string;
          partyColor: string | null;
        };
        administrativeUnit: {
          id: number;
          name: string;
          code: string | null;
          level: number;
        };
      }>
    >(`/api/results/election/${electionId}`),

  getPendingResults: () =>
    apiRequest<
      Array<{
        id: number;
        electionId: number;
        candidateId: number;
        adminUnitId: number;
        votes: number;
        status: string;
        updatedAt: string;
        election: { name: string };
        candidate: { name: string; party: string };
        administrativeUnit: { name: string };
      }>
    >('/api/results/pending'),

  createResult: (data: {
    electionId: number;
    candidateId: number;
    administrativeUnitId: number;
    votes: number;
    validVotes?: number;
    invalidVotes?: number;
    turnout?: number;
  }) =>
    apiRequest<{
      message: string;
      result: any;
    }>('/api/results', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  submitResultForApproval: (id: number) =>
    apiRequest<{ message: string; result: any }>(
      `/api/results/${id}/submit`,
      {
        method: 'POST',
      }
    ),

  approveResult: (id: number) =>
    apiRequest<{ message: string; result: any }>(
      `/api/results/${id}/approve`,
      {
        method: 'POST',
      }
    ),

  rejectResult: (id: number, reason: string) =>
    apiRequest<{ message: string; result: any }>(
      `/api/results/${id}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),
};
