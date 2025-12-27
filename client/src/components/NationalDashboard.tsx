import React, { useEffect, useState } from 'react';
import LiveTotals from './LiveTotals';
import CandidateBar from './CandidateBar';
import ProgressIndicator from './ProgressIndicator';
import '../dashboard.css';

interface CandidateResult {
  candidateId: number;
  candidateName: string;
  party: string;
  partyColor: string | null;
  totalVotes: number;
  percentage: number;
}

interface Winner {
  candidateId: number;
  candidateName: string;
  party: string;
  totalVotes: number;
  percentage: number;
}

interface NationalTotalsData {
  electionId: number;
  electionName: string;
  electionDate: string;
  totalVotesCast: number;
  totalRegisteredVoters: number;
  turnoutPercentage: number;
  reportingAreas: number;
  totalAreas: number;
  reportingPercentage: number;
  candidateResults: CandidateResult[];
  winner: Winner | null;
}

interface NationalDashboardProps {
  electionId: number;
  onClose?: () => void;
}

const NationalDashboard: React.FC<NationalDashboardProps> = ({ electionId, onClose }) => {
  const [data, setData] = useState<NationalTotalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNationalTotals = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`http://localhost:3000/api/results/national/${electionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch national totals');
      }

      const totals = await response.json();
      setData(totals);
      setError(null);
    } catch (err) {
      console.error('Error fetching national totals:', err);
      setError('Failed to load national totals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNationalTotals();

    // Set up WebSocket listener for real-time updates
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      // Authenticate WebSocket connection
      const token = localStorage.getItem('auth_token');
      ws.send(JSON.stringify({ type: 'AUTH', token }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Refresh totals when national totals are updated
        if (message.type === 'NATIONAL_TOTALS_UPDATED' && message.payload.electionId === electionId) {
          fetchNationalTotals();
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };

    return () => {
      ws.close();
    };
  }, [electionId]);

  if (loading) {
    return (
      <div className="national-dashboard loading">
        <div className="spinner">Loading national totals...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="national-dashboard error">
        <p>{error || 'No data available'}</p>
        {onClose && <button onClick={onClose}>Close</button>}
      </div>
    );
  }

  return (
    <div className="national-dashboard">
      {onClose && (
        <button className="close-button" onClick={onClose} aria-label="Close dashboard">
          ×
        </button>
      )}

      <header className="dashboard-header">
        <h1>{data.electionName}</h1>
        <p className="election-date">
          {new Date(data.electionDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </p>
        <div className="live-indicator">
          <span className="pulse"></span>
          LIVE
        </div>
      </header>

      {data.winner && (
        <div className="winner-announcement">
          <div className="winner-badge">PROJECTED WINNER</div>
          <h2>{data.winner.candidateName}</h2>
          <p className="winner-party">{data.winner.party}</p>
          <p className="winner-votes">
            {data.winner.totalVotes.toLocaleString()} votes ({data.winner.percentage}%)
          </p>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="totals-section">
          <LiveTotals
            totalVotesCast={data.totalVotesCast}
            totalRegisteredVoters={data.totalRegisteredVoters}
            turnoutPercentage={data.turnoutPercentage}
          />
        </div>

        <div className="progress-section">
          <ProgressIndicator
            reportingAreas={data.reportingAreas}
            totalAreas={data.totalAreas}
            reportingPercentage={data.reportingPercentage}
          />
        </div>
      </div>

      <div className="candidates-section">
        <h3>Results by Candidate</h3>
        <div className="candidate-bars">
          {data.candidateResults.map((candidate) => (
            <CandidateBar
              key={candidate.candidateId}
              candidateName={candidate.candidateName}
              party={candidate.party}
              partyColor={candidate.partyColor}
              totalVotes={candidate.totalVotes}
              percentage={candidate.percentage}
              isWinner={data.winner?.candidateId === candidate.candidateId}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default NationalDashboard;
