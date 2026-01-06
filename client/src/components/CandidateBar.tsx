import React, { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CandidateBarProps {
  candidateName: string;
  party: string;
  partyColor: string | null;
  totalVotes: number;
  percentage: number;
  isWinner?: boolean;
  label?: string; // "votes" or "seats"
}

const CandidateBar: React.FC<CandidateBarProps> = ({
  candidateName,
  party,
  partyColor,
  totalVotes,
  percentage,
  isWinner = false,
  label = 'votes'
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const [animatedVotes, setAnimatedVotes] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | null>(null);
  const [trendValue, setTrendValue] = useState(0);
  const prevVotes = useRef(totalVotes);
  const trendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track vote changes and show trend indicator
  useEffect(() => {
    if (prevVotes.current !== totalVotes && prevVotes.current !== 0) {
      const diff = totalVotes - prevVotes.current;
      setTrendValue(Math.abs(diff));
      setTrend(diff > 0 ? 'up' : 'down');

      // Clear any existing timeout
      if (trendTimeout.current) {
        clearTimeout(trendTimeout.current);
      }

      // Hide trend after 5 seconds
      trendTimeout.current = setTimeout(() => {
        setTrend(null);
      }, 5000);
    }
    prevVotes.current = totalVotes;

    return () => {
      if (trendTimeout.current) {
        clearTimeout(trendTimeout.current);
      }
    };
  }, [totalVotes]);

  useEffect(() => {
    // Animate the bar width
    const timer = setTimeout(() => {
      setAnimatedPercentage(percentage);
    }, 100);

    // Animate the vote count
    const duration = 1500; // 1.5 seconds
    const steps = 60;
    const increment = totalVotes / steps;
    let current = 0;
    let step = 0;

    const voteTimer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setAnimatedVotes(totalVotes);
        clearInterval(voteTimer);
      } else {
        setAnimatedVotes(Math.round(current));
      }
    }, duration / steps);

    return () => {
      clearTimeout(timer);
      clearInterval(voteTimer);
    };
  }, [percentage, totalVotes]);

  // Default color if none provided
  const barColor = partyColor || '#3B82F6';

  return (
    <div className={`candidate-bar ${isWinner ? 'winner' : ''}`}>
      <div className="candidate-info">
        <div className="candidate-name">
          {candidateName}
          {isWinner && <span className="winner-badge">★</span>}
        </div>
        <div className="candidate-party">{party}</div>
      </div>

      <div className="bar-container">
        <div
          className="bar-fill"
          style={{
            width: `${animatedPercentage}%`,
            backgroundColor: barColor,
            transition: 'width 1.5s ease-out'
          }}
        >
          <div className="bar-glow" style={{ backgroundColor: barColor }}></div>
        </div>
      </div>

      <div className="candidate-stats">
        <div className="votes">
          {animatedVotes.toLocaleString()} {label}
          {trend && (
            <span className={`trend-indicator ${trend}`}>
              {trend === 'up' ? <TrendingUp /> : <TrendingDown />}
              +{trendValue.toLocaleString()}
            </span>
          )}
        </div>
        <div className="percentage">{percentage.toFixed(2)}%</div>
      </div>
    </div>
  );
};

export default CandidateBar;
