import { Incident } from '../api/client';

export type TimelineEventType =
  | 'RECEIVED'
  | 'ASSIGNED'
  | 'EN_ROUTE'
  | 'ARRIVED'
  | 'RESOLVED';

export interface TimelineEvent {
  id: string;
  incidentId: string;
  type: TimelineEventType;
  timestamp: number;
  text: string;
  zone: string;
}

/**
 * Cache for storing the "first seen" ETA for an incident when it first enters enRouteAt.
 * This guarantees that as etaSeconds continues to tick down on future polls,
 * the historical timeline event text does not retroactively change.
 */
const firstSeenEtaCache = new Map<string, number>();

/**
 * Helper to format seconds as mm:ss
 */
function formatEtaSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds)) {
    return '—';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Derives operational events from incident timestamps.
 * Walks each incident and emits an event for each timestamp present:
 * - createdAt  -> "SOS received · {zone} · {citizenName}"
 * - assignedAt -> "{patrol.name} assigned · {dispatchDistanceM/1000 rounded to 1 decimal} km"
 * - enRouteAt  -> "{patrol.name} en route · ETA {first-seen eta formatted mm:ss}"
 * - arrivedAt  -> "{patrol.name} arrived on scene"
 * - resolvedAt -> "Incident resolved · response {arrivedAt - createdAt in whole minutes} min"
 *
 * Merges events from all incidents and sorts descending by timestamp (newest first).
 */
export function deriveTimeline(incidents: Incident[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const inc of incidents) {
    const zone = inc.zone || 'Unknown Zone';
    const citizen = inc.citizenName || 'Citizen';
    const patrolName =
      inc.patrol?.name ||
      (inc.assignedPatrolId ? `Patrol ${inc.assignedPatrolId}` : 'Patrol Unit');

    // 1. createdAt
    if (typeof inc.createdAt === 'number' && inc.createdAt > 0) {
      events.push({
        id: `${inc.id}-RECEIVED`,
        incidentId: inc.id,
        type: 'RECEIVED',
        timestamp: inc.createdAt,
        text: `SOS received · ${zone} · ${citizen}`,
        zone,
      });
    }

    // 2. assignedAt
    if (typeof inc.assignedAt === 'number' && inc.assignedAt > 0) {
      const distKm =
        typeof inc.dispatchDistanceM === 'number'
          ? (inc.dispatchDistanceM / 1000).toFixed(1)
          : '—';
      events.push({
        id: `${inc.id}-ASSIGNED`,
        incidentId: inc.id,
        type: 'ASSIGNED',
        timestamp: inc.assignedAt,
        text: `${patrolName} assigned · ${distKm} km`,
        zone,
      });
    }

    // 3. enRouteAt
    if (typeof inc.enRouteAt === 'number' && inc.enRouteAt > 0) {
      let firstSeen = firstSeenEtaCache.get(inc.id);
      if (firstSeen === undefined && typeof inc.etaSeconds === 'number') {
        firstSeen = inc.etaSeconds;
        firstSeenEtaCache.set(inc.id, firstSeen);
      }
      const etaDisplay = formatEtaSeconds(firstSeen ?? inc.etaSeconds);
      events.push({
        id: `${inc.id}-EN_ROUTE`,
        incidentId: inc.id,
        type: 'EN_ROUTE',
        timestamp: inc.enRouteAt,
        text: `${patrolName} en route · ETA ${etaDisplay}`,
        zone,
      });
    }

    // 4. arrivedAt
    if (typeof inc.arrivedAt === 'number' && inc.arrivedAt > 0) {
      events.push({
        id: `${inc.id}-ARRIVED`,
        incidentId: inc.id,
        type: 'ARRIVED',
        timestamp: inc.arrivedAt,
        text: `${patrolName} arrived on scene`,
        zone,
      });
    }

    // 5. resolvedAt
    if (typeof inc.resolvedAt === 'number' && inc.resolvedAt > 0) {
      // response {(arrivedAt − createdAt) in whole minutes} min
      const baseline = inc.arrivedAt ?? inc.resolvedAt;
      const start = inc.createdAt ?? baseline;
      const diffMinutes = Math.max(1, Math.round((baseline - start) / 60000));

      events.push({
        id: `${inc.id}-RESOLVED`,
        incidentId: inc.id,
        type: 'RESOLVED',
        timestamp: inc.resolvedAt,
        text: `Incident resolved · response ${diffMinutes} min`,
        zone,
      });
    }
  }

  // Sort descending by timestamp (newest first)
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export type RiskBand = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';

export interface OperationalRiskBreakdown {
  total: number;
  modelContribution: number;
  incidentsContribution: number;
  patrolLoadContribution: number;
  band: RiskBand;
  activeIncidentsInZone: number;
  availablePatrolsInZone: number;
  patrolsInZone: number;
  rawMlRiskScore: number;
}

/**
 * Computes the operational risk for a given zone (0–100 scale) EXACTLY as:
 *   0.55 × mlRiskScore
 * + 0.25 × min(1, activeIncidentsInZone / 2)
 * + 0.20 × (1 − availablePatrolsInZone / patrolsInZone)
 *
 * Inputs are normalized to 0-1 before weighted sum, then multiplied by 100.
 * Guarded against division by zero (treats 0/0 patrols as full availability).
 */
export function operationalRisk(
  zone: string,
  predictions: import('../api/client').Prediction[],
  incidents: import('../api/client').Incident[],
  patrols: import('../api/client').Patrol[]
): OperationalRiskBreakdown {
  const normalizedZone = (zone || '').toLowerCase().trim();

  // 1. mlRiskScore: lookup matching prediction
  const matchingPred = predictions.find(
    (p) => p.zone.toLowerCase().trim() === normalizedZone
  );

  let rawMlRiskScore = matchingPred ? matchingPred.riskScore : 0.5;
  // Normalize if represented on 0-100 scale
  if (rawMlRiskScore > 1) {
    rawMlRiskScore = rawMlRiskScore / 100;
  }
  const mlRiskScore = Math.max(0, Math.min(1, rawMlRiskScore));

  // 2. activeIncidentsInZone: non-resolved incidents in this zone
  const activeIncidentsInZone = incidents.filter(
    (i) =>
      i.zone.toLowerCase().trim() === normalizedZone &&
      i.status !== 'RESOLVED'
  ).length;

  const incidentsFraction = Math.min(1, activeIncidentsInZone / 2);

  // 3. availablePatrolsInZone / patrolsInZone
  const patrolsInThisZone = patrols.filter(
    (p) => p.zone.toLowerCase().trim() === normalizedZone
  );
  const patrolsInZone = patrolsInThisZone.length;

  const availablePatrolsInZone = patrolsInThisZone.filter(
    (p) => p.status === 'PATROLLING'
  ).length;

  // Zero-denominator guard: if no patrols assigned to zone, treat as full availability (0 penalty)
  const patrolAvailabilityFraction =
    patrolsInZone > 0 ? availablePatrolsInZone / patrolsInZone : 1;

  const patrolDeficitFraction = Math.max(0, Math.min(1, 1 - patrolAvailabilityFraction));

  // Weighted contributions (scaled to 100)
  const modelContribution = 0.55 * mlRiskScore * 100;
  const incidentsContribution = 0.25 * incidentsFraction * 100;
  const patrolLoadContribution = 0.20 * patrolDeficitFraction * 100;

  const total = Math.round(
    Math.min(100, Math.max(0, modelContribution + incidentsContribution + patrolLoadContribution))
  );

  // Categorize risk band
  let band: RiskBand = 'LOW';
  if (total >= 75) {
    band = 'HIGH';
  } else if (total >= 50) {
    band = 'ELEVATED';
  } else if (total >= 25) {
    band = 'MODERATE';
  }

  return {
    total,
    modelContribution: Math.round(modelContribution * 10) / 10,
    incidentsContribution: Math.round(incidentsContribution * 10) / 10,
    patrolLoadContribution: Math.round(patrolLoadContribution * 10) / 10,
    band,
    activeIncidentsInZone,
    availablePatrolsInZone,
    patrolsInZone,
    rawMlRiskScore: mlRiskScore,
  };
}

/**
 * Calculates the mean operationalRisk (0–100) across all zones for the City Risk KPI card.
 */
export function calculateCityRisk(
  predictions: import('../api/client').Prediction[],
  incidents: import('../api/client').Incident[],
  patrols: import('../api/client').Patrol[]
): number | null {
  // Extract all distinct zones from predictions, incidents, and patrols
  const zoneSet = new Set<string>();
  predictions.forEach((p) => zoneSet.add(p.zone));
  incidents.forEach((i) => zoneSet.add(i.zone));
  patrols.forEach((p) => zoneSet.add(p.zone));

  const allZones = Array.from(zoneSet).filter(Boolean);
  if (allZones.length === 0) return null;

  const totalScore = allZones.reduce((sum, zone) => {
    const breakdown = operationalRisk(zone, predictions, incidents, patrols);
    return sum + breakdown.total;
  }, 0);

  return Math.round(totalScore / allZones.length);
}

