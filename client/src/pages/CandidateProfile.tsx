import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2, X, User, Phone, MapPin, FileText, Upload, Camera, BarChart3 } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { api } from '../lib/api';

interface Candidate {
  id: number;
  personId: number;
  electionId: number;
  partyId: number | null;
  electoralAreaId: number | null;
  ballotOrder: number | null;
  photoUrl: string | null;
  isIndependent: boolean;
  person: {
    id: number;
    fullName: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    biography?: string | null;
    imageUrl?: string | null;
  };
  party: { id: number; name: string; abbreviation: string; color: string } | null;
  electoralArea: { name: string; code: string | null } | null;
  election: { id: number; name: string; year: number };
  _count: { results: number };
}

interface Party {
  id: number;
  name: string;
  abbreviation: string;
  color: string;
}

interface AdminUnit {
  id: number;
  name: string;
  code: string | null;
  level: number;
}

// Helper to generate initials from name
const getInitials = (name: string): string => {
  return name
    .split(' ')
    .filter(n => n.length > 0)
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

// Mock approval data - in real app this would come from API
const generateApprovalData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month, index) => ({
    month,
    approval: Math.floor(50 + Math.random() * 30 + (index * 2)),
  }));
};

export function CandidateProfile() {
  const { electionId, candidateId } = useParams<{ electionId: string; candidateId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state - check URL param
  const [isEditMode, setIsEditMode] = useState(searchParams.get('edit') === 'true');
  const [parties, setParties] = useState<Party[]>([]);
  const [adminUnits, setAdminUnits] = useState<AdminUnit[]>([]);
  const [editForm, setEditForm] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    biography: '',
    partyId: 0,
    electoralAreaId: 0,
    ballotOrder: '',
    photoUrl: '',
    isIndependent: false,
    hometown: '',
    contact: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Editable chart data
  const [approvalRating, setApprovalRating] = useState(Math.floor(60 + Math.random() * 25));
  const [approvalTrend, setApprovalTrend] = useState(generateApprovalData);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showTrendModal, setShowTrendModal] = useState(false);
  const [editRating, setEditRating] = useState(0);
  const [editTrendMonth, setEditTrendMonth] = useState('');
  const [editTrendValue, setEditTrendValue] = useState(0);

  useEffect(() => {
    loadCandidate();
  }, [candidateId]);

  // Load parties if starting in edit mode
  useEffect(() => {
    if (isEditMode && parties.length === 0) {
      api.getParties().then(setParties);
    }
  }, [isEditMode]);

  const loadCandidate = async () => {
    try {
      setIsLoading(true);
      // Fetch candidate data - we'll need to get full details
      const candidatesData = await api.getCandidatesByElection(parseInt(electionId || '0'));
      const found = candidatesData.find((c: Candidate) => c.id === parseInt(candidateId || '0'));

      if (found) {
        setCandidate(found);
        initEditForm(found);
      } else {
        setError('Candidate not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidate');
    } finally {
      setIsLoading(false);
    }
  };

  const initEditForm = (c: Candidate) => {
    setEditForm({
      fullName: c.person.fullName || '',
      dateOfBirth: c.person.dateOfBirth ? c.person.dateOfBirth.split('T')[0] : '',
      gender: c.person.gender || '',
      biography: c.person.biography || '',
      partyId: c.partyId || 0,
      electoralAreaId: c.electoralAreaId || 0,
      ballotOrder: c.ballotOrder?.toString() || '',
      photoUrl: c.photoUrl || '',
      isIndependent: c.isIndependent,
      hometown: '',
      contact: '',
    });
  };

  const handleEdit = async () => {
    if (parties.length === 0) {
      const partiesData = await api.getParties();
      setParties(partiesData);
    }
    if (candidate) {
      initEditForm(candidate);
    }
    setIsEditMode(true);
    setSearchParams({ edit: 'true' });
  };

  const handleCancelEdit = () => {
    if (candidate) {
      initEditForm(candidate);
    }
    setIsEditMode(false);
    setSearchParams({});
  };

  const handleUpdateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate) return;

    try {
      setIsSubmitting(true);
      await api.updateCandidate(candidate.id, {
        partyId: editForm.partyId || undefined,
        electoralAreaId: editForm.electoralAreaId || undefined,
        ballotOrder: editForm.ballotOrder ? parseInt(editForm.ballotOrder) : undefined,
        photoUrl: editForm.photoUrl || undefined,
        isIndependent: editForm.isIndependent,
      });
      setIsEditMode(false);
      setSearchParams({});
      await loadCandidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update candidate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!candidate) return;

    if (!confirm(`Are you sure you want to delete ${candidate.person.fullName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteCandidate(candidate.id);
      navigate(`/elections/${electionId}/candidates`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete candidate');
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreviewImage(base64);
        setEditForm({ ...editForm, photoUrl: base64 });
      };
      reader.readAsDataURL(file);
    }
  };

  // Chart editing handlers
  const handleEditRating = () => {
    setEditRating(approvalRating);
    setShowRatingModal(true);
  };

  const handleSaveRating = () => {
    setApprovalRating(editRating);
    setShowRatingModal(false);
  };

  const handleEditTrend = (month: string, value: number) => {
    setEditTrendMonth(month);
    setEditTrendValue(value);
    setShowTrendModal(true);
  };

  const handleSaveTrend = () => {
    setApprovalTrend(prev =>
      prev.map(item =>
        item.month === editTrendMonth ? { ...item, approval: editTrendValue } : item
      )
    );
    setShowTrendModal(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading candidate...</div>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex-1 bg-gray-900 text-white p-8">
        <div className="text-center py-12">
          <p className="text-red-400 text-lg mb-4">{error || 'Candidate not found'}</p>
          <Link
            to={`/elections/${electionId}/candidates`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Back to Candidates List
          </Link>
        </div>
      </div>
    );
  }

  const partyColor = candidate.party?.color || '#6B7280';
  const photoUrl = previewImage || editForm.photoUrl || candidate.photoUrl || candidate.person.imageUrl;

  // Chart data
  const approvalChartData = [
    { name: 'Approval', value: approvalRating },
    { name: 'Remaining', value: 100 - approvalRating },
  ];

  // Edit Mode View
  if (isEditMode) {
    return (
      <div className="flex-1 bg-gray-900 text-white p-6 overflow-auto">
        {/* Header */}
        <div className="mb-6">
          <Link
            to={`/elections/${electionId}/candidates`}
            className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm mb-4"
          >
            <ArrowLeft size={16} />
            Back to Candidates List
          </Link>
          <h1 className="text-2xl font-bold">Edit Candidate: {candidate.person.fullName}</h1>
        </div>

        <form onSubmit={handleUpdateCandidate}>
          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Photo */}
            <div className="lg:col-span-3">
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <div className="flex flex-col items-center">
                  {/* Avatar */}
                  <div className="relative mb-3">
                    {photoUrl ? (
                      <img
                        src={photoUrl}
                        alt={candidate.person.fullName}
                        className="w-24 h-24 rounded-full object-cover border-3"
                        style={{ borderColor: partyColor }}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-white border-3 ${photoUrl ? 'hidden' : ''}`}
                      style={{
                        backgroundColor: `${partyColor}40`,
                        borderColor: partyColor,
                      }}
                    >
                      {getInitials(candidate.person.fullName)}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 text-center mb-2">Notes on candidate</p>
                  <p className="text-xs text-gray-500 text-center">{candidate.election?.name}</p>

                  {/* Contact Info */}
                  <div className="w-full mt-4 pt-4 border-t border-gray-700/50">
                    <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                      <Phone size={14} />
                      <span>Contacts</span>
                    </div>
                    <input
                      type="text"
                      value={editForm.contact}
                      onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })}
                      placeholder="Contact info..."
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Center Column - Form Fields */}
            <div className="lg:col-span-6 space-y-4">
              {/* Form Grid */}
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <div className="grid grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Party */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Party</label>
                    <select
                      value={editForm.partyId}
                      onChange={(e) => {
                        const partyId = parseInt(e.target.value);
                        setEditForm({
                          ...editForm,
                          partyId,
                          isIndependent: partyId === 0,
                        });
                      }}
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value={0}>Independent</option>
                      {parties.map(party => (
                        <option key={party.id} value={party.id}>
                          {party.abbreviation}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.dateOfBirth}
                      onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Ballot Position */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Ballot Position</label>
                    <input
                      type="number"
                      value={editForm.ballotOrder}
                      onChange={(e) => setEditForm({ ...editForm, ballotOrder: e.target.value })}
                      min={1}
                      placeholder="Position..."
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Gender</label>
                    <select
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  {/* Electoral Area */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Electoral Area</label>
                    <input
                      type="text"
                      value={candidate.electoralArea?.name || 'National'}
                      disabled
                      className="w-full bg-gray-700/30 text-gray-400 text-sm px-3 py-2 rounded border border-gray-700 cursor-not-allowed"
                    />
                  </div>

                  {/* Hometown */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Hometown</label>
                    <select
                      value={editForm.hometown}
                      onChange={(e) => setEditForm({ ...editForm, hometown: e.target.value })}
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="Kampala">Kampala</option>
                      <option value="Wakiso">Wakiso</option>
                      <option value="Mbarara">Mbarara</option>
                      <option value="Gulu">Gulu</option>
                    </select>
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Candidate Photo</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 hover:border-cyan-500 hover:bg-gray-600/50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Upload size={14} />
                      Upload Photo
                    </button>
                  </div>
                </div>
              </div>

              {/* Political Party Section */}
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <div className="flex items-center gap-2 mb-3">
                  <FileText size={16} className="text-gray-400" />
                  <h3 className="text-sm font-medium text-white">Political Party</h3>
                </div>
                {candidate.party ? (
                  <div className="flex items-center gap-3 p-3 bg-gray-700/30 rounded-lg">
                    <div
                      className="w-8 h-8 rounded-full"
                      style={{ backgroundColor: candidate.party.color }}
                    />
                    <div>
                      <p className="text-white font-medium">{candidate.party.name}</p>
                      <p className="text-gray-400 text-xs">{candidate.party.abbreviation}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm">Independent Candidate</p>
                )}
              </div>

              {/* Biography Section */}
              <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700/50">
                <h3 className="text-sm font-semibold text-orange-400 mb-3">Biography Excerpt</h3>
                <textarea
                  value={editForm.biography}
                  onChange={(e) => setEditForm({ ...editForm, biography: e.target.value })}
                  rows={4}
                  placeholder="Enter candidate biography..."
                  className="w-full bg-gray-700/50 text-white text-sm px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={candidate._count.results > 0}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={candidate._count.results > 0 ? 'Cannot delete candidate with results' : ''}
                >
                  Delete Candidate
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-2.5 bg-gray-600 hover:bg-gray-500 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Right Column - Charts */}
            <div className="lg:col-span-3 space-y-4">
              {/* Approval Rating */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-cyan-400">Approval Rating</h3>
                  <button
                    type="button"
                    onClick={handleEditRating}
                    className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors"
                    title="Edit approval rating"
                  >
                    <Pencil size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-20">
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                      <PieChart>
                        <Pie
                          data={approvalChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={35}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                        >
                          <Cell fill="#00BCD4" />
                          <Cell fill="#374151" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Regional Estimate</p>
                    <p className="text-gray-500 text-xs">Survey Results</p>
                    <p className="text-cyan-400 text-2xl font-bold">{approvalRating}%</p>
                  </div>
                </div>
              </div>

              {/* Approval Trend */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-yellow-400">Approval Casting</h3>
                  <button
                    type="button"
                    onClick={() => handleEditTrend(approvalTrend[approvalTrend.length - 1].month, approvalTrend[approvalTrend.length - 1].approval)}
                    className="p-1.5 bg-yellow-500/20 text-yellow-400 rounded hover:bg-yellow-500/30 transition-colors"
                    title="Edit trend data"
                  >
                    <BarChart3 size={12} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">Polls & Analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-16">
                    <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                      <AreaChart data={approvalTrend.slice(-6)} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="editApprovalGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#00BCD4" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#00BCD4" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="approval"
                          stroke="#00BCD4"
                          strokeWidth={2}
                          fill="url(#editApprovalGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Last Month</p>
                    <p className="text-cyan-400 text-xl font-bold">{approvalTrend[approvalTrend.length - 1].approval}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Edit Rating Modal */}
        {showRatingModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Edit Approval Rating</h3>
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Approval Percentage</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editRating}
                  onChange={(e) => setEditRating(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-cyan-500 focus:outline-none"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={editRating}
                  onChange={(e) => setEditRating(parseInt(e.target.value))}
                  className="w-full mt-2 accent-cyan-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRatingModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRating}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 px-4 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Trend Modal */}
        {showTrendModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-sm mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Edit Trend Data</h3>
                <button
                  onClick={() => setShowTrendModal(false)}
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Month</label>
                <select
                  value={editTrendMonth}
                  onChange={(e) => {
                    const month = e.target.value;
                    const data = approvalTrend.find(d => d.month === month);
                    setEditTrendMonth(month);
                    setEditTrendValue(data?.approval || 50);
                  }}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-yellow-500 focus:outline-none"
                >
                  {approvalTrend.map(d => (
                    <option key={d.month} value={d.month}>{d.month}</option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Approval Value (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={editTrendValue}
                  onChange={(e) => setEditTrendValue(parseInt(e.target.value) || 0)}
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-yellow-500 focus:outline-none"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={editTrendValue}
                  onChange={(e) => setEditTrendValue(parseInt(e.target.value))}
                  className="w-full mt-2 accent-yellow-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTrendModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 px-4 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTrend}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // View Mode (unchanged from before)
  return (
    <div className="flex-1 bg-gray-900 text-white p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to={`/elections/${electionId}/candidates`}
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm mb-4"
        >
          <ArrowLeft size={16} />
          Back to Candidates List
        </Link>
        <h1 className="text-3xl font-bold">Candidate Profile</h1>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Photo and Actions */}
        <div className="space-y-4">
          {/* Photo Card */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="flex flex-col items-center">
              {/* Large Avatar */}
              <div className="relative mb-4">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={candidate.person.fullName}
                    className="w-40 h-40 rounded-full object-cover border-4"
                    style={{ borderColor: partyColor }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`w-40 h-40 rounded-full flex items-center justify-center text-4xl font-bold text-white border-4 ${photoUrl ? 'hidden' : ''}`}
                  style={{
                    backgroundColor: `${partyColor}40`,
                    borderColor: partyColor,
                  }}
                >
                  {getInitials(candidate.person.fullName)}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full space-y-3 mt-4">
                <button
                  onClick={handleEdit}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Pencil size={18} />
                  Edit Profile
                </button>
                <button
                  onClick={handleDelete}
                  disabled={candidate._count.results > 0}
                  className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  title={candidate._count.results > 0 ? 'Cannot delete candidate with results' : ''}
                >
                  <Trash2 size={18} />
                  Delete Candidate
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Center Column - Personal Details */}
        <div className="space-y-4">
          {/* Personal Details */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-cyan-400 mb-4">Personal Details</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">Full Name:</p>
                <p className="text-white font-medium">{candidate.person.fullName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-400 text-sm">Date of Birth:</p>
                  <p className="text-white">
                    {candidate.person.dateOfBirth
                      ? new Date(candidate.person.dateOfBirth).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Not available'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Ballot Position:</p>
                  <p className="text-white font-medium text-xl">{candidate.ballotOrder || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Gender:</p>
                <p className="text-white">{candidate.person.gender || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Political Affiliation */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-yellow-400 mb-4">Political Affiliation</h2>
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 text-sm">Party:</p>
                {candidate.party ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: candidate.party.color }}
                    />
                    <span className="font-medium">{candidate.party.abbreviation}</span>
                    <span className="text-gray-400">({candidate.party.name})</span>
                  </div>
                ) : (
                  <p className="text-white">Independent</p>
                )}
              </div>
              {candidate.electoralArea && (
                <div>
                  <p className="text-gray-400 text-sm">Electoral Area:</p>
                  <p className="text-white">{candidate.electoralArea.name}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-sm">Election:</p>
                <p className="text-white">{candidate.election?.name || 'Not specified'}</p>
              </div>
            </div>
          </div>

          {/* Biography */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-orange-400 mb-4">Biography Excerpt</h2>
            <p className="text-gray-300 text-sm leading-relaxed">
              {candidate.person.biography ||
                `${candidate.person.fullName} is a candidate in the ${candidate.election?.name || 'election'}${
                  candidate.party ? `, representing the ${candidate.party.name}` : ' as an Independent candidate'
                }. More biographical information will be added soon.`}
            </p>
          </div>
        </div>

        {/* Right Column - Statistics */}
        <div className="space-y-4">
          {/* Approval Rating */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-cyan-400 mb-4">Approval Rating</h2>
            <div className="flex items-center justify-between">
              <div className="w-32 h-32">
                <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                  <PieChart>
                    <Pie
                      data={approvalChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={50}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                    >
                      <Cell fill="#00BCD4" />
                      <Cell fill="#374151" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-right">
                <p className="text-gray-400 text-sm">Regional Estimate</p>
                <p className="text-cyan-400 text-4xl font-bold">{approvalRating}%</p>
              </div>
            </div>
          </div>

          {/* Approval Trend */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-yellow-400">Approval Casting</h2>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400">+3%</span>
                <span className="text-gray-500">Last Month</span>
              </div>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={50}>
                <AreaChart data={approvalTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="approvalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00BCD4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#00BCD4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#6B7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#6B7280', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={[40, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#9CA3AF' }}
                    itemStyle={{ color: '#00BCD4' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="approval"
                    stroke="#00BCD4"
                    strokeWidth={2}
                    fill="url(#approvalGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-lg font-semibold text-green-400 mb-4">Election Results</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                <span className="text-gray-400">Results Recorded</span>
                <span className="font-medium">{candidate._count.results.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-700/50">
                <span className="text-gray-400">Ballot Position</span>
                <span className="font-medium">{candidate.ballotOrder || 'Not set'}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Status</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  candidate._count.results > 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {candidate._count.results > 0 ? 'Active' : 'Pending Results'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
