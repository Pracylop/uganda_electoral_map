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

  updateProfile: (data: { fullName: string }) =>
    apiRequest<{
      message: string;
      user: {
        id: number;
        username: string;
        fullName: string;
        role: string;
        isActive: boolean;
        createdAt: string;
      };
    }>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiRequest<{ message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

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

  // Electoral Issues
  getIssueCategories: () =>
    apiRequest<
      Array<{
        id: number;
        name: string;
        code: string;
        description: string | null;
        severity: number;
        color: string | null;
        isActive: boolean;
      }>
    >('/api/issues/categories'),

  getIssues: (params?: {
    categoryId?: number;
    districtId?: number;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId.toString());
    if (params?.districtId) searchParams.append('districtId', params.districtId.toString());
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      issues: Array<{
        id: number;
        date: string;
        time: string | null;
        summary: string;
        fullText: string | null;
        location: string | null;
        village: string | null;
        status: string;
        issueCategory: { id: number; name: string; code: string; severity: number; color: string | null };
        district: { id: number; name: string } | null;
        constituency: { id: number; name: string } | null;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/api/issues${query}`);
  },

  getIssuesGeoJSON: (params?: {
    categoryId?: number;
    districtId?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryId) searchParams.append('categoryId', params.categoryId.toString());
    if (params?.districtId) searchParams.append('districtId', params.districtId.toString());
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      type: 'FeatureCollection';
      features: Array<{
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: {
          id: number;
          date: string;
          category: string;
          categoryCode: string;
          categoryColor: string;
          severity: number;
          summary: string;
          location: string | null;
          district: string | null;
          districtId: number | null;
          status: string;
        };
      }>;
    }>(`/api/issues/geojson${query}`);
  },

  getIssueStats: (params?: {
    districtId?: number;
    categoryIds?: number[];
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.districtId) searchParams.append('districtId', params.districtId.toString());
    if (params?.categoryIds && params.categoryIds.length > 0) {
      searchParams.append('categoryIds', params.categoryIds.join(','));
    }
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      total: number;
      byCategory: Array<{ category: string; categoryCode: string; color: string | null; count: number }>;
      byStatus: Array<{ status: string; count: number }>;
      topDistricts: Array<{ district: string; districtId: number | null; count: number }>;
    }>(`/api/issues/stats${query}`);
  },

  getIssuesChoropleth: (params?: {
    categoryIds?: number[];
    startDate?: string;
    endDate?: string;
    severity?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.categoryIds && params.categoryIds.length > 0) {
      searchParams.append('categoryIds', params.categoryIds.join(','));
    }
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.severity) searchParams.append('severity', params.severity.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      type: 'FeatureCollection';
      features: Array<{
        type: 'Feature';
        id: number;
        geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
        properties: {
          unitId: number;
          unitName: string;
          unitCode: string;
          issueCount: number;
          lastIssueDate: string | null;
          fillColor: string;
          intensity: number;
        };
      }>;
      metadata: {
        totalIssues: number;
        districtsWithIssues: number;
        maxIssuesPerDistrict: number;
      };
    }>(`/api/issues/choropleth${query}`);
  },

  // Polling Station endpoints
  getPollingStations: (params?: {
    districtId?: number;
    constituencyId?: number;
    subcountyId?: number;
    parishId?: number;
    electionId?: number;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.districtId) searchParams.append('districtId', params.districtId.toString());
    if (params?.constituencyId) searchParams.append('constituencyId', params.constituencyId.toString());
    if (params?.subcountyId) searchParams.append('subcountyId', params.subcountyId.toString());
    if (params?.parishId) searchParams.append('parishId', params.parishId.toString());
    if (params?.electionId) searchParams.append('electionId', params.electionId.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      stations: Array<{
        id: number;
        code: string;
        name: string;
        parish: {
          id: number;
          name: string;
          parent: {
            id: number;
            name: string;
            parent: {
              id: number;
              name: string;
              parent: { id: number; name: string } | null;
            } | null;
          } | null;
        };
        electionData: Array<{
          electionId: number;
          totalVoters: number;
          election: { name: string; year: number };
        }>;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/api/polling-stations${query}`);
  },

  getPollingStationsGeoJSON: (params?: {
    districtId?: number;
    electionId?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.districtId) searchParams.append('districtId', params.districtId.toString());
    if (params?.electionId) searchParams.append('electionId', params.electionId.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      type: 'FeatureCollection';
      features: Array<{
        type: 'Feature';
        geometry: { type: 'Point'; coordinates: [number, number] };
        properties: {
          parishId: number;
          parishName: string;
          subcounty: string | null;
          constituency: string | null;
          district: string | null;
          stationCount: number;
          totalVoters: number;
          stations: Array<{ id: number; name: string; code: string }>;
        };
      }>;
    }>(`/api/polling-stations/geojson${query}`);
  },

  getPollingStationStats: (electionId?: number) => {
    const query = electionId ? `?electionId=${electionId}` : '';
    return apiRequest<{
      totalStations: number;
      totalElectionData: number;
      byElection: Array<{
        electionId: number;
        electionName: string;
        year: number;
        stationCount: number;
        totalVoters: number;
      }>;
      topDistricts: Array<{ district: string; districtId: number; count: number }>;
    }>(`/api/polling-stations/stats${query}`);
  },

  // Demographics API
  getDemographicsStats: (censusYear?: number) => {
    const query = censusYear ? `?censusYear=${censusYear}` : '';
    return apiRequest<{
      censusYear: number;
      national: {
        totalPopulation: number;
        malePopulation: number;
        femalePopulation: number;
        votingAgePopulation: number;
        youthPopulation: number;
        elderlyPopulation: number;
        numberOfHouseholds: number;
        parishCount: number;
      };
      districts: Array<{
        districtId: number;
        districtName: string;
        totalPopulation: number;
        malePopulation: number;
        femalePopulation: number;
        votingAgePopulation: number;
        youthPopulation: number;
        elderlyPopulation: number;
        numberOfHouseholds: number;
        parishCount: number;
      }>;
    }>(`/api/demographics/stats${query}`);
  },

  getDemographicsByUnit: (adminUnitId: number, censusYear?: number) => {
    const query = censusYear ? `?censusYear=${censusYear}` : '';
    return apiRequest<{
      adminUnit: { id: number; name: string; level: number };
      demographics: {
        totalPopulation: number;
        malePopulation: number;
        femalePopulation: number;
        votingAgePopulation: number;
        youthPopulation: number;
        elderlyPopulation: number;
        numberOfHouseholds: number;
        avgHouseholdSize?: number;
      };
    }>(`/api/demographics/${adminUnitId}${query}`);
  },

  getDemographicsGeoJSON: (params?: {
    level?: number;
    parentId?: number;
    censusYear?: number;
    metric?: 'population' | 'votingAge' | 'density';
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.level) searchParams.append('level', params.level.toString());
    if (params?.parentId) searchParams.append('parentId', params.parentId.toString());
    if (params?.censusYear) searchParams.append('censusYear', params.censusYear.toString());
    if (params?.metric) searchParams.append('metric', params.metric);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      type: 'FeatureCollection';
      properties: {
        censusYear: number;
        level: number;
        metric: string;
        featureCount: number;
      };
      features: Array<{
        type: 'Feature';
        properties: {
          id: number;
          name: string;
          level: number;
          totalPopulation: number;
          malePopulation: number;
          femalePopulation: number;
          votingAgePopulation: number;
          youthPopulation: number;
          elderlyPopulation: number;
          numberOfHouseholds: number;
          parishCount: number;
          votingAgePercent: number;
          malePercent: number;
        };
        geometry: GeoJSON.Geometry;
      }>;
    }>(`/api/demographics/geojson${query}`);
  },

  // Audit Log API
  getAuditLogs: (params?: {
    userId?: number;
    actionType?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.append('userId', params.userId.toString());
    if (params?.actionType) searchParams.append('actionType', params.actionType);
    if (params?.entityType) searchParams.append('entityType', params.entityType);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiRequest<{
      logs: Array<{
        id: number;
        timestamp: string;
        userId: number;
        userRole: string;
        actionType: string;
        entityType: string;
        entityId: number | null;
        oldValue: any;
        newValue: any;
        ipAddress: string | null;
        comment: string | null;
        user: { id: number; username: string; fullName: string };
      }>;
      total: number;
      limit: number;
      offset: number;
    }>(`/api/audit${query}`);
  },

  getAuditActionTypes: () =>
    apiRequest<string[]>('/api/audit/action-types'),

  getAuditEntityTypes: () =>
    apiRequest<string[]>('/api/audit/entity-types'),

  getAuditStats: () =>
    apiRequest<{
      total: number;
      byActionType: Array<{ actionType: string; count: number }>;
      byUser: Array<{ userId: number; username: string; fullName: string; count: number }>;
      recentActivity: Array<{
        id: number;
        timestamp: string;
        actionType: string;
        entityType: string;
        user: { username: string; fullName: string };
      }>;
    }>('/api/audit/stats'),

  exportAuditLogs: (params?: {
    userId?: number;
    actionType?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.userId) searchParams.append('userId', params.userId.toString());
    if (params?.actionType) searchParams.append('actionType', params.actionType);
    if (params?.entityType) searchParams.append('entityType', params.entityType);
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return `/api/audit/export${query}`;
  },
};
