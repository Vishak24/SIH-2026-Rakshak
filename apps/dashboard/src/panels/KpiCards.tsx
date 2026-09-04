import React, { useEffect, useState } from 'react';
import { AlertOctagon, Car, Clock, Activity } from 'lucide-react';
import { Incident, Patrol, Prediction } from '../lib/types';
import { calculateOperationalRisk, formatDuration } from '../lib/derive';
import zonesData from '@shared/routes/zones.json';

interface KpiCardsProps {
  incidents: Incident[];
  patrols: Patrol[];
  predictions: Prediction[];
}

function AnimatedNumber({ value, suffix = '', duration = 300 }: { value: number; suffix?: string; duration?: number }) {
  const [displayVal, setDisplayVal] = useState(value);

  useEffect(() => {
    let startVal = displayVal;
    const diff = value - startVal;
    if (diff === 0) return;

    const startTime = performance.now();

    const frame = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const current = Math.round(startVal + diff * progress);
      setDisplayVal(current);
      if (progress < 1) {
        requestAnimationFrame(frame);
      }
    };

    const animId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return (
    <span className="kpi-value font-mono">
      {displayVal}
      {suffix}
    </span>
  );
}

export const KpiCards: React.FC<KpiCardsProps> = ({ incidents, patrols, predictions }) => {
  // 1. Active Incidents count
  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');
  const activeCount = activeIncidents.length;

  // 2. Patrols available / total
  const totalPatrols = patrols.length || 10;
  const availablePatrols = patrols.filter((p) => p.status === 'PATROLLING').length;

  // 3. Avg Response Time (mean of arrivedAt - createdAt over incidents with arrivedAt)
  const respondedIncidents = incidents.filter((i) => i.arrivedAt && i.createdAt);
  let avgResponseTimeMs: number | null = null;
  if (respondedIncidents.length > 0) {
    const totalMs = respondedIncidents.reduce((acc, curr) => acc + ((curr.arrivedAt ?? 0) - curr.createdAt), 0);
    avgResponseTimeMs = Math.round(totalMs / respondedIncidents.length);
  }

  // 4. City Risk: mean operational risk across all zones (0-100)
  let sumRisk = 0;
  for (const z of zonesData) {
    const breakdown = calculateOperationalRisk(z.name, predictions, incidents, patrols);
    sumRisk += breakdown.score;
  }
  const meanCityRisk = zonesData.length > 0 ? Math.round(sumRisk / zonesData.length) : 48;

  const getRiskBadgeClass = (score: number) => {
    if (score >= 70) return 'kpi-risk-high';
    if (score >= 50) return 'kpi-risk-elevated';
    if (score >= 35) return 'kpi-risk-moderate';
    return 'kpi-risk-low';
  };

  return (
    <div className="kpi-cards-grid">
      {/* Active Incidents */}
      <div className={`kpi-card ${activeCount > 0 ? 'kpi-card-active-alert' : ''}`}>
        <div className="kpi-header">
          <span className="kpi-label">ACTIVE INCIDENTS</span>
          <AlertOctagon size={16} className={activeCount > 0 ? 'text-accent-red' : 'text-muted'} />
        </div>
        <div className="kpi-body">
          <AnimatedNumber value={activeCount} />
          <span className="kpi-subtext">
            {activeCount === 1 ? '1 emergency active' : `${activeCount} emergencies`}
          </span>
        </div>
      </div>

      {/* Patrols Available */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">PATROLS AVAILABLE</span>
          <Car size={16} className="text-accent-blue" />
        </div>
        <div className="kpi-body">
          <span className="kpi-value font-mono">
            {availablePatrols}
            <span className="kpi-denom">/{totalPatrols}</span>
          </span>
          <span className="kpi-subtext">
            {totalPatrols - availablePatrols} dispatched · {availablePatrols} on routine beat
          </span>
        </div>
      </div>

      {/* Avg Response Time */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">AVG RESPONSE TIME</span>
          <Clock size={16} className="text-accent-cyan" />
        </div>
        <div className="kpi-body">
          <span className="kpi-value font-mono">
            {avgResponseTimeMs !== null ? formatDuration(avgResponseTimeMs) : '02:45'}
          </span>
          <span className="kpi-subtext">Target &lt; 04:00 min (City SLA)</span>
        </div>
      </div>

      {/* City Risk Score */}
      <div className="kpi-card">
        <div className="kpi-header">
          <span className="kpi-label">CITY RISK INDEX</span>
          <Activity size={16} className="text-accent-amber" />
        </div>
        <div className="kpi-body">
          <div className="flex items-center gap-2">
            <AnimatedNumber value={meanCityRisk} />
            <span className={`kpi-badge font-mono ${getRiskBadgeClass(meanCityRisk)}`}>
              {meanCityRisk >= 70 ? 'HIGH' : meanCityRisk >= 50 ? 'ELEVATED' : 'NOMINAL'}
            </span>
          </div>
          <span className="kpi-subtext">Aggregate 10-zone ML operational risk</span>
        </div>
      </div>
    </div>
  );
};
