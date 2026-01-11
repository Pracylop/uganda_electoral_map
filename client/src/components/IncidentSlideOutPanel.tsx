import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Incident {
  id: number;
  date: string;
  summary: string;
  issueCategory: { name: string; code: string; color: string | null };
  district: { name: string } | null;
}

interface PanelData {
  unitId: number;
  unitName: string;
  level: number;
  issueCount: number;
  injuries: number;
  deaths: number;
  arrests: number;
  topCategories: { name: string; count: number }[];
}

interface IncidentSlideOutPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: PanelData | null;
}

const levelNames: Record<number, string> = {
  2: 'District',
  3: 'Constituency',
  4: 'Subcounty',
  5: 'Parish',
};

export function IncidentSlideOutPanel({ isOpen, onClose, data }: IncidentSlideOutPanelProps) {
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !data) {
      setRecentIncidents([]);
      return;
    }

    if (data.issueCount === 0 || data.level !== 2) {
      setRecentIncidents([]);
      return;
    }

    setLoading(true);
    const params: any = { limit: 10, districtId: data.unitId };

    api.getIssues(params)
      .then((result) => {
        setRecentIncidents(result.issues);
      })
      .catch((err) => {
        console.error('Failed to load recent incidents:', err);
        setRecentIncidents([]);
      })
      .finally(() => setLoading(false));
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  const totalCasualties = data.injuries + data.deaths + data.arrests;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-gray-800 border-l border-gray-700 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-start">
          <div>
            <div className="text-xs text-gray-400 mb-1">{levelNames[data.level] || 'Region'}</div>
            <h2 className="text-xl font-bold text-white">{data.unitName}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {data.issueCount} incident{data.issueCount !== 1 ? 's' : ''} reported
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-64px)]">
          {/* Casualties */}
          {totalCasualties > 0 && (
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Casualties</h3>
              <div className="flex gap-4">
                {data.deaths > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 rounded-lg">
                    <span className="text-lg">💀</span>
                    <div>
                      <div className="text-lg font-bold text-red-400">{data.deaths}</div>
                      <div className="text-xs text-gray-400">Deaths</div>
                    </div>
                  </div>
                )}
                {data.injuries > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-900/30 rounded-lg">
                    <span className="text-lg">🩹</span>
                    <div>
                      <div className="text-lg font-bold text-orange-400">{data.injuries}</div>
                      <div className="text-xs text-gray-400">Injuries</div>
                    </div>
                  </div>
                )}
                {data.arrests > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 rounded-lg">
                    <span className="text-lg">🚔</span>
                    <div>
                      <div className="text-lg font-bold text-blue-400">{data.arrests}</div>
                      <div className="text-xs text-gray-400">Arrests</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Category Breakdown */}
          {data.topCategories.length > 0 && (
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">By Category</h3>
              <div className="space-y-2">
                {data.topCategories.map((cat, idx) => {
                  const percent = data.issueCount > 0 ? (cat.count / data.issueCount) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 truncate">{cat.name}</span>
                          <span className="text-white font-medium">{cat.count}</span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded">
                          <div
                            className="h-full bg-[#F59E0B] rounded"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Incidents */}
          {data.issueCount > 0 && data.level === 2 && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recent Incidents</h3>
              {loading ? (
                <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
              ) : recentIncidents.length > 0 ? (
                <div className="space-y-2">
                  {recentIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: incident.issueCategory.color || '#808080', color: '#fff' }}
                        >
                          {incident.issueCategory.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(incident.date).toLocaleDateString('en-UG', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2">{incident.summary}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400 text-sm">No incidents found</div>
              )}
            </div>
          )}

          {/* No incidents message */}
          {data.issueCount === 0 && (
            <div className="p-4">
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">No incidents reported in this region</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 border-t border-gray-700">
            <Link
              to={`/incidents/stats?districtId=${data.unitId}`}
              className="block w-full py-2 px-4 bg-[#F59E0B] hover:bg-[#F59E0B]/90 rounded-lg text-center text-sm font-medium text-gray-900"
            >
              View Statistics
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default IncidentSlideOutPanel;
