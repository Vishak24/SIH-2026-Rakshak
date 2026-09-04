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

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint: string;
  variant: 'incidents' | 'patrols' | 'response' | 'risk';
  badge: {
    text: string;
    type: 'danger' | 'success' | 'info' | 'neutral';
  };
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  hint,
  variant,
  badge,
}) => {
  return (
    <div className={`kpi-card kpi-card--${variant}`}>
      <div className="kpi-card-header">
        <span className="kpi-card-label">{label}</span>
        <span className={`kpi-badge kpi-badge--${badge.type}`}>
          {badge.text}
        </span>
      </div>

      <div className="kpi-card-metric">{value}</div>

      <div className="kpi-card-footer">
        <span className="kpi-card-hint">{hint}</span>
      </div>
    </div>
  );
};

/**
 * KpiCards Component
 * Owned by: Dev A (src/panels/KpiCards.tsx)
 *
 * Renders 4 high-density stat cards arranged in a 2x2 tactical grid:
 * 1. Active Incidents (non-RESOLVED)
 * 2. Patrols Available / Total (PATROLLING / total)
 * 3. Avg Response Time (mean of arrivedAt - createdAt in mm:ss or "—")
 * 4. City Risk (mean operationalRisk across zones from derive.ts)
 */
export const KpiCards: React.FC<KpiCardsProps> = ({
  incidents,
  patrols,
  predictions = [],
}) => {
  // 1. Active Incidents
  const activeCount = incidents.filter((i) => i.status !== 'RESOLVED').length;
  const animatedActive = useAnimatedNumber(activeCount, 300);

  // 2. Patrols Available / Total
  const availableCount = patrols.filter((p) => p.status === 'PATROLLING').length;
  const totalPatrols = patrols.length;
  const animatedAvailable = useAnimatedNumber(availableCount, 300);

  // 3. Avg Response Time
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

  const formatAvgResponseTime = (totalSec: number | null) => {
    if (totalSec === null || totalSec === undefined || isNaN(totalSec)) {
      return '—';
    }
    const mins = Math.floor(totalSec / 60);
    const secs = Math.floor(totalSec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 4. City Risk Index
  const cityRiskValue =
    predictions.length > 0
      ? calculateCityRisk(predictions, incidents, patrols)
      : null;
  const animatedCityRisk = useAnimatedNumber(cityRiskValue, 300);

  return (
    <div className="kpi-panel-wrapper">
      <div className="kpi-grid">
        {/* Card 1: Active Incidents */}
        <StatCard
          variant="incidents"
          label="Active Alerts"
          value={
            <span className={activeCount > 0 ? 'metric--danger' : 'metric--nominal'}>
              {animatedActive !== null ? Math.round(animatedActive) : '—'}
            </span>
          }
          hint={activeCount > 0 ? 'Requires dispatch attention' : 'All sectors nominal'}
          badge={
            activeCount > 0
              ? { text: 'HIGH PRIORITY', type: 'danger' }
              : { text: 'NOMINAL', type: 'success' }
          }
        />

        {/* Card 2: Patrols Available / Total */}
        <StatCard
          variant="patrols"
          label="Patrol Fleet"
          value={
            <span>
              {animatedAvailable !== null ? Math.round(animatedAvailable) : '—'}
              <span className="metric-denominator"> / {totalPatrols || '—'}</span>
            </span>
          }
          hint={`${totalPatrols - availableCount} units currently engaged`}
          badge={{
            text: availableCount >= 4 ? 'OPTIMAL' : 'ENGAGED',
            type: availableCount >= 4 ? 'success' : 'info',
          }}
        />

        {/* Card 3: Avg Response Time */}
        <StatCard
          variant="response"
          label="Avg Response"
          value={
            <span className="metric-time">
              {formatAvgResponseTime(animatedAvgSeconds)}
            </span>
          }
          hint={
            responseTimes.length > 0
              ? `${responseTimes.length} on-scene arrivals`
              : 'Awaiting arrival events'
          }
          badge={{ text: 'DISPATCH TO SCENE', type: 'info' }}
        />

        {/* Card 4: City Risk Index */}
        <StatCard
          variant="risk"
          label="City Risk Index"
          value={
            <span className="metric-risk">
              {animatedCityRisk !== null ? `${Math.round(animatedCityRisk)}%` : '—'}
            </span>
          }
          hint="Multi-factor operational telemetry"
          badge={{ text: 'AI PREDICTIVE', type: 'neutral' }}
        />
      </div>
    </div>
  );
};

export default KpiCards;
