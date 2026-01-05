import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface AuditLog {
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
}

interface AuditStats {
  total: number;
  byActionType: Array<{ actionType: string; count: number }>;
  byUser: Array<{ userId: number; username: string; fullName: string; count: number }>;
}

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const limit = 25;

  // Filter states
  const [actionTypes, setActionTypes] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    actionType: '',
    entityType: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadFilterOptions();
    loadStats();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadFilterOptions = async () => {
    try {
      const [actions, entities] = await Promise.all([
        api.getAuditActionTypes(),
        api.getAuditEntityTypes(),
      ]);
      setActionTypes(actions);
      setEntityTypes(entities);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  };

  const loadStats = async () => {
    try {
      const data = await api.getAuditStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const params: any = {
        limit,
        offset: page * limit,
      };
      if (filters.actionType) params.actionType = filters.actionType;
      if (filters.entityType) params.entityType = filters.entityType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const data = await api.getAuditLogs(params);
      setLogs(data.logs);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      actionType: '',
      entityType: '',
      startDate: '',
      endDate: '',
    });
    setPage(0);
  };

  const handleExport = () => {
    const exportUrl = api.exportAuditLogs(filters);
    const token = localStorage.getItem('auth_token');
    // Open in new window with auth
    window.open(
      `http://localhost:3000${exportUrl}`,
      '_blank'
    );
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('LOGIN')) return 'bg-blue-900 text-blue-200';
    if (action.includes('CREATE')) return 'bg-green-900 text-green-200';
    if (action.includes('UPDATE')) return 'bg-yellow-900 text-yellow-200';
    if (action.includes('DELETE')) return 'bg-red-900 text-red-200';
    if (action.includes('APPROVE')) return 'bg-emerald-900 text-emerald-200';
    if (action.includes('REJECT')) return 'bg-orange-900 text-orange-200';
    return 'bg-gray-700 text-gray-200';
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex-1 bg-gray-900 text-white p-8 overflow-auto">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Audit Log</h1>
            <p className="text-gray-400 mt-1">
              View and export system activity logs
            </p>
          </div>
          <button
            onClick={handleExport}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-md p-4 mb-6">
            <p className="text-red-200">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400">Total Entries</h3>
              <p className="text-2xl font-bold mt-1">{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400">Top Action</h3>
              <p className="text-2xl font-bold mt-1">
                {stats.byActionType[0]?.actionType || 'N/A'}
              </p>
              <p className="text-sm text-gray-400">
                {stats.byActionType[0]?.count.toLocaleString() || 0} entries
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400">Most Active User</h3>
              <p className="text-2xl font-bold mt-1">
                {stats.byUser[0]?.fullName || 'N/A'}
              </p>
              <p className="text-sm text-gray-400">
                {stats.byUser[0]?.count.toLocaleString() || 0} actions
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Action Type
              </label>
              <select
                value={filters.actionType}
                onChange={(e) => handleFilterChange('actionType', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                {actionTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Entity Type
              </label>
              <select
                value={filters.entityType}
                onChange={(e) => handleFilterChange('entityType', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Entities</option>
                {entityTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No audit logs found</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Entity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      IP Address
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {logs.map((log) => (
                    <>
                      <tr key={log.id} className="hover:bg-gray-750">
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium">
                              {log.user.fullName}
                            </div>
                            <div className="text-xs text-gray-400">
                              @{log.user.username}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${getActionBadgeColor(
                              log.actionType
                            )}`}
                          >
                            {log.actionType}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          <span className="text-gray-300">{log.entityType}</span>
                          {log.entityId && (
                            <span className="text-gray-500 ml-1">#{log.entityId}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {(log.comment || log.newValue || log.oldValue) && (
                            <button
                              onClick={() =>
                                setExpandedLog(expandedLog === log.id ? null : log.id)
                              }
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {expandedLog === log.id ? 'Hide' : 'View'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr key={`${log.id}-details`}>
                          <td colSpan={6} className="px-4 py-3 bg-gray-750">
                            <div className="space-y-2">
                              {log.comment && (
                                <div>
                                  <span className="text-gray-400 text-sm">Comment: </span>
                                  <span className="text-sm">{log.comment}</span>
                                </div>
                              )}
                              {log.newValue && (
                                <div>
                                  <span className="text-gray-400 text-sm">New Value: </span>
                                  <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-auto max-h-40">
                                    {JSON.stringify(log.newValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {log.oldValue && (
                                <div>
                                  <span className="text-gray-400 text-sm">Old Value: </span>
                                  <pre className="text-xs bg-gray-900 p-2 rounded mt-1 overflow-auto max-h-40">
                                    {JSON.stringify(log.oldValue, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-4 py-3 bg-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Showing {page * limit + 1} to {Math.min((page + 1) * limit, total)} of{' '}
                  {total.toLocaleString()} entries
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-gray-300">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
