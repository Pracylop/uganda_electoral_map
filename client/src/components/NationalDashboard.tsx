import React from 'react';
import LiveTotals from './LiveTotals';
import CandidateBar from './CandidateBar';
import ProgressIndicator from './ProgressIndicator';
import RegionalBreakdown from './RegionalBreakdown';
import { useNationalTotals, usePartySummary, useRegionalBreakdown } from '../hooks/useElectionData';
import { useWebSocket } from '../hooks/useWebSocket';
import { invalidateElectionQueries } from '../lib/queryClient';
import '../dashboard.css';

interface CandidateResult {
  candidateId: number;
  candidateName: string;
  party: string;
  partyColor: string | null;
  totalVotes: number;
  percentage: number;
}

interface PartySummary {
  partyId: number | null;
  partyName: string;
  abbreviation: string;
  color: string;
  seatsWon: number;
  percentage: number;
}

interface NationalDashboardProps {
  electionId: number;
  onClose?: () => void;
}

const NationalDashboard: React.FC<NationalDashboardProps> = ({ electionId, onClose }) => {
  // Use React Query hooks with offline support
  const {
    data,
    isLoading: loading,
    error: queryError
  } = useNationalTotals(electionId);

  // Determine if we need party summary (for MP elections)
  const isMPElection = data?.electionType && data.electionType.electoralLevel >= 2;

  // Fetch party summary for MP elections
  const { data: partySummary } = usePartySummary(
    electionId,
    null,
    isMPElection
  );

  // Fetch regional breakdown for presidential elections
  const { data: regionalData } = useRegionalBreakdown(
    electionId,
    !isMPElection // Only fetch for presidential elections
  );

  // WebSocket for real-time updates (uses shared connection with exponential backoff)
  useWebSocket((message) => {
    if (message.type === 'NATIONAL_TOTALS_UPDATED' && message.payload?.electionId === electionId) {
      // Invalidate React Query cache to trigger refetch
      invalidateElectionQueries(electionId);
    }
    if (message.type === 'RESULT_APPROVED' && message.payload?.electionId === electionId) {
      invalidateElectionQueries(electionId);
    }
  });

  const error = queryError ? (queryError as Error).message : null;

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

  const winningParty = partySummary?.partySummary?.[0];

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

      {/* Presidential Election: Show Winner */}
      {!isMPElection && data.winner && (
        <div className="winner-announcement">
          <div className="winner-badge">PROJECTED WINNER</div>
          <h2>{data.winner.candidateName}</h2>
          <p className="winner-party">{data.winner.party}</p>
          <p className="winner-votes">
            {data.winner.totalVotes.toLocaleString()} votes ({data.winner.percentage}%)
          </p>
        </div>
      )}

      {/* MP Election: Show Leading Party */}
      {isMPElection && winningParty && (
        <div className="winner-announcement" style={{
          background: `linear-gradient(135deg, ${winningParty.color}dd 0%, ${winningParty.color}99 100%)`
        }}>
          <div className="winner-badge">LEADING PARTY</div>
          <h2>{winningParty.partyName}</h2>
          <p className="winner-party">{winningParty.abbreviation}</p>
          <p className="winner-votes">
            {winningParty.seatsWon} seats ({winningParty.percentage.toFixed(1)}%)
          </p>
        </div>
      )}

      {/* Margin of Victory (Presidential elections) */}
      {!isMPElection && data.marginOfVictory && (
        <div className="margin-of-victory">
          <div className="margin-label">MARGIN OF VICTORY</div>
          <div className="margin-stats">
            <div className="margin-votes">
              <span className="margin-value">+{data.marginOfVictory.votes.toLocaleString()}</span>
              <span className="margin-unit">votes</span>
            </div>
            <div className="margin-percentage">
              <span className="margin-value">+{data.marginOfVictory.percentage}%</span>
              <span className="margin-unit">lead</span>
            </div>
          </div>
          <div className="margin-candidates">
            {data.marginOfVictory.leadingCandidate} leads {data.marginOfVictory.runnerUp}
          </div>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="totals-section">
          {isMPElection && partySummary ? (
            // MP Elections: Show seats summary
            <div className="live-totals">
              <div className="total-card votes-cast">
                <div className="card-label">Total Seats</div>
                <div className="card-value">{partySummary.totalSeats}</div>
              </div>
              <div className="total-card registered-voters">
                <div className="card-label">Parties Represented</div>
                <div className="card-value">{partySummary.partySummary.length}</div>
              </div>
              <div className="total-card turnout">
                <div className="card-label">Areas Reporting</div>
                <div className="card-value">{data.reportingAreas}</div>
              </div>
            </div>
          ) : (
            // Presidential: Show vote totals
            <LiveTotals
              totalVotesCast={data.totalVotesCast}
              totalRegisteredVoters={data.totalRegisteredVoters}
              turnoutPercentage={data.turnoutPercentage}
              totalInvalidVotes={data.totalInvalidVotes}
              invalidPercentage={data.invalidPercentage}
            />
          )}
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
        {isMPElection && partySummary ? (
          // MP Elections: Show party seats
          <>
            <h3>Seats by Party</h3>
            <div className="candidate-bars">
              {partySummary.partySummary.map((party: PartySummary) => (
                <CandidateBar
                  key={party.partyId ?? 'ind'}
                  candidateName={party.partyName}
                  party={party.abbreviation}
                  partyColor={party.color}
                  totalVotes={party.seatsWon}
                  percentage={party.percentage}
                  isWinner={party === winningParty}
                  label="seats"
                />
              ))}
            </div>
          </>
        ) : data.candidateResults ? (
          // Presidential: Show candidate votes
          <>
            <h3>Results by Candidate</h3>
            <div className="candidate-bars">
              {data.candidateResults.map((candidate: CandidateResult) => (
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
          </>
        ) : null}
      </div>

      {/* Regional Breakdown (Presidential elections only) */}
      {!isMPElection && regionalData && (
        <RegionalBreakdown
          regionalBreakdown={regionalData.regionalBreakdown}
          totalSubregions={regionalData.totalSubregions}
          reportingSubregions={regionalData.reportingSubregions}
        />
      )}
    </div>
  );
};

export default NationalDashboard;
