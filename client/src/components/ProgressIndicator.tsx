import React, { useEffect, useState } from 'react';

interface ProgressIndicatorProps {
  reportingAreas: number;
  totalAreas: number;
  reportingPercentage: number;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  reportingAreas,
  totalAreas,
  reportingPercentage
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);

  useEffect(() => {
    // Animate the progress bar
    const timer = setTimeout(() => {
      setAnimatedPercentage(reportingPercentage);
    }, 100);

    return () => clearTimeout(timer);
  }, [reportingPercentage]);

  return (
    <div className="progress-indicator">
      <h4>Reporting Progress</h4>

      <div className="progress-stats">
        <div className="stat">
          <span className="stat-value">{reportingAreas.toLocaleString()}</span>
          <span className="stat-label">Reporting</span>
        </div>
        <div className="stat-divider">/</div>
        <div className="stat">
          <span className="stat-value">{totalAreas.toLocaleString()}</span>
          <span className="stat-label">Total Areas</span>
        </div>
      </div>

      <div className="progress-bar-container">
        <div
          className="progress-bar-fill"
          style={{
            width: `${animatedPercentage}%`,
            transition: 'width 1.5s ease-out'
          }}
        >
          <div className="progress-shimmer"></div>
        </div>
        <div className="progress-percentage">{reportingPercentage.toFixed(1)}%</div>
      </div>

      <div className="progress-label">
        {reportingPercentage < 100
          ? `${(totalAreas - reportingAreas).toLocaleString()} areas remaining`
          : 'All areas reporting'}
      </div>
    </div>
  );
};

export default ProgressIndicator;
