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
        electionType: { name: string; code: string; electoralLevel: number };
        electionTypeName: string;
        electionTypeCode: string;
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
      electionType: {
        id: number;
        name: string;
        code: string;
        electoralLevel: number;
      };
      isActive: boolean;
      candidates: Array<{
        id: number;
        person: { fullName: string };
        party: { name: string; abbreviation: string; color: string } | null;
        electoralAreaId: number | null;
        isIndependent: boolean;
      }>;
      _count: { results: number };
    }>(`/api/elections/${id}`),

  getPartySummary: (electionId: number, districtId?: number) => {
    const params = new URLSearchParams();
    if (districtId) params.append('districtId', districtId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<{
      electionId: number;
      electionName: string;
      electoralLevel: number;
      totalSeats: number;
      partySummary: Array<{
        partyId: number | null;
        partyName: string;
        abbreviation: string;
        color: string;
        seatsWon: number;
        percentage: number;
      }>;
    }>(`/api/elections/${electionId}/party-summary${query}`);
  },

  // Results endpoints
  getResultsByElection: (electionId: number) =>
    apiRequest<
      Array<{
        id: number;
        electionId: number;
        candidateId: number;
        adminUnitId: number;
        votes: number;
        votePercent: string | null;
        status: string;
        candidate: {
          id: number;
          person: { fullName: string };
          party: { name: string; abbreviation: string; color: string } | null;
        };
        adminUnit: {
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

  // Reference data endpoints
  getElectionTypes: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        code: string;
        electoralLevel: number;
        description: string | null;
      }>
    >('/api/reference/election-types'),

  getParties: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        abbreviation: string;
        color: string;
        logoUrl: string | null;
        isActive: boolean;
      }>
    >('/api/reference/parties'),

  getPersons: (search?: string) =>
    apiRequest<
      Array<{
        id: number;
        fullName: string;
        gender: string | null;
      }>
    >(`/api/reference/persons${search ? `?search=${encodeURIComponent(search)}` : ''}`),

  createPerson: (data: { fullName: string; gender?: string }) =>
    apiRequest<{ message: string; person: { id: number; fullName: string } }>(
      '/api/reference/persons',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),

  getAdminUnits: (level?: number, parentId?: number) => {
    const params = new URLSearchParams();
    if (level !== undefined) params.append('level', level.toString());
    if (parentId !== undefined) params.append('parentId', parentId.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiRequest<
      Array<{
        id: number;
        name: string;
        code: string | null;
        level: number;
        parentId: number | null;
      }>
    >(`/api/reference/admin-units${query}`);
  },

  // Election management
  createElection: (data: {
    name: string;
    year: number;
    electionDate: string;
    electionTypeId: number;
    isActive?: boolean;
  }) =>
    apiRequest<{ message: string; election: any }>('/api/elections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateElection: (id: number, data: {
    name?: string;
    year?: number;
    electionDate?: string;
    electionTypeId?: number;
    isActive?: boolean;
  }) =>
    apiRequest<{ message: string; election: any }>(`/api/elections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteElection: (id: number) =>
    apiRequest<{ message: string }>(`/api/elections/${id}`, {
      method: 'DELETE',
    }),

  // Candidate management
  getCandidatesByElection: (electionId: number) =>
    apiRequest<
      Array<{
        id: number;
        personId: number;
        partyId: number | null;
        electoralAreaId: number | null;
        ballotOrder: number | null;
        isIndependent: boolean;
        person: { fullName: string };
        party: { name: string; abbreviation: string; color: string } | null;
        electoralArea: { name: string; code: string | null } | null;
        _count: { results: number };
      }>
    >(`/api/elections/${electionId}/candidates`),

  createCandidate: (data: {
    electionId: number;
    personId: number;
    partyId?: number;
    electoralAreaId?: number;
    ballotOrder?: number;
    isIndependent?: boolean;
  }) =>
    apiRequest<{ message: string; candidate: any }>('/api/candidates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCandidate: (id: number, data: {
    partyId?: number;
    electoralAreaId?: number;
    ballotOrder?: number;
    isIndependent?: boolean;
  }) =>
    apiRequest<{ message: string; candidate: any }>(`/api/candidates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCandidate: (id: number) =>
    apiRequest<{ message: string }>(`/api/candidates/${id}`, {
      method: 'DELETE',
    }),
};
