import React, { useEffect, useState, useRef } from 'react';

interface LiveTotalsProps {
  totalVotesCast: number;
  totalRegisteredVoters: number;
  turnoutPercentage: number;
  totalInvalidVotes?: number;
  invalidPercentage?: number;
}

// Custom hook for animated counting
const useCountUp = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  const prevEnd = useRef(end);

  useEffect(() => {
    const start = prevEnd.current || 0;
    const increment = (end - start) / (duration / 16); // 60fps
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        setCount(end);
        clearInterval(timer);
        prevEnd.current = end;
      } else {
        setCount(Math.round(current));
      }
    }, 16);

    return () => clearInterval(timer);
  }, [end, duration]);

  return count;
};

const LiveTotals: React.FC<LiveTotalsProps> = ({
  totalVotesCast,
  totalRegisteredVoters,
  turnoutPercentage,
  totalInvalidVotes = 0,
  invalidPercentage = 0
}) => {
  const animatedVotesCast = useCountUp(totalVotesCast);
  const animatedRegistered = useCountUp(totalRegisteredVoters);
  const animatedTurnout = useCountUp(Math.round(turnoutPercentage * 100) / 100);
  const animatedInvalid = useCountUp(totalInvalidVotes);

  return (
    <div className="live-totals">
      <div className="total-card votes-cast">
        <div className="card-label">Total Votes Cast</div>
        <div className="card-value">{animatedVotesCast.toLocaleString()}</div>
      </div>

      <div className="total-card registered-voters">
        <div className="card-label">Registered Voters</div>
        <div className="card-value">{animatedRegistered.toLocaleString()}</div>
      </div>

      <div className="total-card turnout">
        <div className="card-label">Voter Turnout</div>
        <div className="card-value">
          {animatedTurnout.toFixed(2)}%
        </div>
      </div>

      {totalInvalidVotes > 0 && (
        <div className="total-card invalid-votes">
          <div className="card-label">Invalid/Spoilt</div>
          <div className="card-value">{animatedInvalid.toLocaleString()}</div>
          <div className="card-subvalue">{invalidPercentage.toFixed(2)}%</div>
        </div>
      )}
    </div>
  );
};

export default LiveTotals;
