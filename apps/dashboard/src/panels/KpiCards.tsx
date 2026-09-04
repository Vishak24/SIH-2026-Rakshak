import React from 'react';
import { Incident, Patrol, Prediction } from '../api/client';
import { calculateCityRisk } from '../lib/derive';
import { useAnimatedNumber } from './useAnimatedNumber';
import './KpiCards.css';

export interface KpiCardsProps {
  incidents: Incident[];
  patrols: Patrol[];
  predictions?: Prediction[];
}

/**
 * Single Stat Card (reusing the legacy stat-card visual styling)
 */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  badge?: {
    text: string;
    type: 'danger' | 'success' | 'info' | 'neutral';
  };
}

const StatCard: React.FC<StatCardProps> = ({ label, value, hint, badge }) => {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {badge && (
          <span className={`stat-card-badge stat-card-badge--${badge.type}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="stat-card-value">{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
};

/**
 * KpiCards Component
 * Owned by: Dev A (src/panels/KpiCards.tsx)
 *
 * Renders 4 live KPI cards with 300ms count-up/down requestAnimationFrame tweens:
 * 1. Active incidents (non-RESOLVED)
 * 2. Patrols available / total (PATROLLING / total)
 * 3. Avg response time (mean of arrivedAt - createdAt in mm:ss or "—")
 * 4. City risk (mean operationalRisk across zones, stubs to "—" until Task A5)
 */
export const KpiCards: React.FC<KpiCardsProps> = ({ incidents, patrols, predictions = [] }) => {
  // 1. Active Incidents: non-RESOLVED count
  const activeCount = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const animatedActive = useAnimatedNumber(activeCount, 300);

  // 2. Patrols Available / Total: count of PATROLLING
  const availableCount = patrols.filter((p) => p.status === 'PATROLLING').length;
  const totalPatrols = patrols.length;
  const animatedAvailable = useAnimatedNumber(availableCount, 300);

  // 3. Avg Response Time: mean of (arrivedAt - createdAt) in ms
  const responseTimes = incidents.filter(
    (i) =>
      typeof i.createdAt === 'number' &&
      typeof i.arrivedAt === 'number' &&
      i.arrivedAt > i.createdAt
  );

  const avgResponseSeconds =
    responseTimes.length > 0
      ? Math.round(
          responseTimes.reduce(
            (sum, inc) => sum + ((inc.arrivedAt as number) - inc.createdAt),
            0
          ) /
            responseTimes.length /
            1000
        )
      : null;

  const animatedAvgSeconds = useAnimatedNumber(avgResponseSeconds, 300);

  // Format avg seconds to m:ss, or "—" if no completed response data
  const formatAvgResponseTime = (totalSec: number | null) => {
    if (totalSec === null || totalSec === undefined || isNaN(totalSec)) {
      return '—';
    }
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 4. City Risk: mean operationalRisk across all zones (0-100)
  const cityRiskValue =
    predictions.length > 0
      ? calculateCityRisk(predictions, incidents, patrols)
      : null;
  const animatedCityRisk = useAnimatedNumber(cityRiskValue, 300);

  return (
    <div className="kpi-cards-grid">
      {/* 1. Active Incidents Card */}
      <StatCard
        label="Active Incidents"
        value={
          <span className={activeCount > 0 ? 'value-alert' : 'value-nominal'}>
            {animatedActive !== null ? Math.round(animatedActive) : '—'}
          </span>
        }
        hint={activeCount > 0 ? 'Requires dispatch attention' : 'City nominal'}
        badge={
          activeCount > 0
            ? { text: 'HIGH PRIORITY', type: 'danger' }
            : { text: 'STABLE', type: 'success' }
        }
      />

      {/* 2. Patrols Available / Total Card */}
      <StatCard
        label="Patrols Available / Total"
        value={
          <span>
            {animatedAvailable !== null ? Math.round(animatedAvailable) : '—'}
            <span className="value-total"> / {totalPatrols || '—'}</span>
          </span>
        }
        hint={`${totalPatrols - availableCount} units deployed on calls`}
        badge={{
          text: availableCount > 3 ? 'OPTIMAL' : 'CONSTRAINED',
          type: availableCount > 3 ? 'success' : 'info',
        }}
      />

      {/* 3. Avg Response Time Card */}
      <StatCard
        label="Avg Response Time"
        value={<span>{formatAvgResponseTime(animatedAvgSeconds)}</span>}
        hint={
          responseTimes.length > 0
            ? `Based on ${responseTimes.length} on-scene arrivals`
            : 'No arrived incidents recorded'
        }
        badge={{ text: 'DISPATCH TO SCENE', type: 'info' }}
      />

      {/* 4. City Risk Index Card */}
      <StatCard
        label="City Risk Index"
        value={<span>{animatedCityRisk !== null ? `${Math.round(animatedCityRisk)}%` : '—'}</span>}
        hint="Task A5 operational risk aggregation"
        badge={{ text: 'AI PREDICTIVE', type: 'neutral' }}
      />
    </div>
  );
};

export default KpiCards;
