import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin } from 'lucide-react';

interface RegionCandidate {
  candidateId: number;
  candidateName: string;
  party: string;
  partyColor: string | null;
  votes: number;
  percentage: number;
}

interface RegionData {
  subregionId: number;
  subregionName: string;
  totalVotes: number;
  leadingCandidate: RegionCandidate | null;
  candidates: RegionCandidate[];
}

interface RegionalBreakdownProps {
  regionalBreakdown: RegionData[];
  totalSubregions: number;
  reportingSubregions: number;
}

const RegionalBreakdown: React.FC<RegionalBreakdownProps> = ({
  regionalBreakdown,
  totalSubregions,
  reportingSubregions
}) => {
  const [expandedRegion, setExpandedRegion] = useState<number | null>(null);

  const toggleRegion = (regionId: number) => {
    setExpandedRegion(expandedRegion === regionId ? null : regionId);
  };

  if (regionalBreakdown.length === 0) {
    return (
      <div className="regional-breakdown">
        <div className="regional-header">
          <h3><MapPin size={20} /> Results by Region</h3>
          <span className="region-count">0 / {totalSubregions} reporting</span>
        </div>
        <div className="no-regional-data">
          No regional results available yet
        </div>
      </div>
    );
  }

  return (
    <div className="regional-breakdown">
      <div className="regional-header">
        <h3><MapPin size={20} /> Results by Region</h3>
        <span className="region-count">{reportingSubregions} / {totalSubregions} reporting</span>
      </div>

      <div className="region-list">
        {regionalBreakdown.map((region) => (
          <div
            key={region.subregionId}
            className={`region-card ${expandedRegion === region.subregionId ? 'expanded' : ''}`}
          >
            <div
              className="region-summary"
              onClick={() => toggleRegion(region.subregionId)}
            >
              <div className="region-info">
                <div className="region-name">{region.subregionName}</div>
                <div className="region-votes">{region.totalVotes.toLocaleString()} votes</div>
              </div>

              {region.leadingCandidate && (
                <div className="region-leader">
                  <div
                    className="leader-color"
                    style={{ backgroundColor: region.leadingCandidate.partyColor || '#3B82F6' }}
                  />
                  <div className="leader-info">
                    <span className="leader-name">{region.leadingCandidate.candidateName}</span>
                    <span className="leader-percentage">{region.leadingCandidate.percentage}%</span>
                  </div>
                </div>
              )}

              <div className="expand-icon">
                {expandedRegion === region.subregionId ? <ChevronUp /> : <ChevronDown />}
              </div>
            </div>

            {expandedRegion === region.subregionId && (
              <div className="region-details">
                {region.candidates.map((candidate) => (
                  <div key={candidate.candidateId} className="region-candidate">
                    <div
                      className="candidate-color"
                      style={{ backgroundColor: candidate.partyColor || '#6B7280' }}
                    />
                    <div className="candidate-info">
                      <span className="candidate-name">{candidate.candidateName}</span>
                      <span className="candidate-party">{candidate.party}</span>
                    </div>
                    <div className="candidate-votes">
                      <span className="votes-count">{candidate.votes.toLocaleString()}</span>
                      <span className="votes-percentage">{candidate.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default RegionalBreakdown;
