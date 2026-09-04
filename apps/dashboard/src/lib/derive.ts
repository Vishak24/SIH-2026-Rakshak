import { Incident, Patrol, Prediction, TimelineEvent, OperationalRiskBreakdown } from './types';

// Map of first-seen ETA seconds for incidents so enRouteAt text doesn't mutate continuously
const incidentInitialEtaMap = new Map<string, number>();

export function formatEta(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms) || ms < 0) {
    return '—';
  }
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function deriveTimeline(incidents: Incident[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const inc of incidents) {
    // Record initial ETA when seen
    if (inc.etaSeconds && !incidentInitialEtaMap.has(inc.id)) {
      incidentInitialEtaMap.set(inc.id, inc.etaSeconds);
    }
    const initialEta = incidentInitialEtaMap.get(inc.id) ?? inc.etaSeconds ?? 0;

    const patrolName = inc.patrol?.name || (inc.assignedPatrolId ? `Patrol ${inc.assignedPatrolId}` : 'Patrol');
    const distKm = inc.dispatchDistanceM ? (inc.dispatchDistanceM / 1000).toFixed(1) : '1.2';

    // 1. createdAt -> SOS received
    if (inc.createdAt) {
      events.push({
        id: `${inc.id}-created`,
        incidentId: inc.id,
        timestamp: inc.createdAt,
        eventType: 'RECEIVED',
        text: `SOS received · ${inc.zone} · ${inc.citizenName}`,
        color: 'var(--accent-red)',
      });
    }

    // 2. assignedAt -> Patrol assigned
    if (inc.assignedAt) {
      events.push({
        id: `${inc.id}-assigned`,
        incidentId: inc.id,
        timestamp: inc.assignedAt,
        eventType: 'ASSIGNED',
        text: `${patrolName} assigned · ${distKm} km`,
        color: 'var(--accent-amber)',
      });
    }

    // 3. enRouteAt -> Patrol en route
    if (inc.enRouteAt) {
      events.push({
        id: `${inc.id}-enroute`,
        incidentId: inc.id,
        timestamp: inc.enRouteAt,
        eventType: 'EN_ROUTE',
        text: `${patrolName} en route · ETA ${formatEta(initialEta)}`,
        color: 'var(--accent-blue)',
      });
    }

    // 4. arrivedAt -> Patrol arrived on scene
    if (inc.arrivedAt) {
      events.push({
        id: `${inc.id}-arrived`,
        incidentId: inc.id,
        timestamp: inc.arrivedAt,
        eventType: 'ARRIVED',
        text: `${patrolName} arrived on scene`,
        color: 'var(--accent-cyan)',
      });
    }

    // 5. resolvedAt -> Incident resolved
    if (inc.resolvedAt) {
      const responseMins = Math.max(1, Math.round((inc.resolvedAt - inc.createdAt) / 60000));
      events.push({
        id: `${inc.id}-resolved`,
        incidentId: inc.id,
        timestamp: inc.resolvedAt,
        eventType: 'RESOLVED',
        text: `Incident resolved · response ${responseMins} min`,
        color: 'var(--accent-green)',
      });
    }
  }

  // Sort descending by timestamp, capped at 30
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events.slice(0, 30);
}

export function calculateOperationalRisk(
  zoneName: string,
  predictions: Prediction[],
  incidents: Incident[],
  patrols: Patrol[]
): OperationalRiskBreakdown {
  const pred = predictions.find((p) => p.zone.toLowerCase() === zoneName.toLowerCase());
  const mlRiskScore = pred ? pred.riskScore : 45;

  const zoneIncidents = incidents.filter(
    (inc) => inc.zone.toLowerCase() === zoneName.toLowerCase() && inc.status !== 'RESOLVED'
  );
  const activeIncidentsInZone = zoneIncidents.length;

  const zonePatrols = patrols.filter((p) => p.zone.toLowerCase() === zoneName.toLowerCase());
  const totalPatrolsInZone = Math.max(1, zonePatrols.length);
  const availablePatrolsInZone = zonePatrols.filter((p) => p.status === 'PATROLLING').length;

  // Formula per spec:
  // 0.55 * mlRiskScore + 0.25 * min(1, activeIncidentsInZone / 2) * 100 + 0.20 * (1 - availablePatrolsInZone / patrolsInZone) * 100
  const modelContrib = Math.round(0.55 * mlRiskScore);
  const incidentTerm = Math.min(1, activeIncidentsInZone / 2);
  const incidentContrib = Math.round(0.25 * incidentTerm * 100);
  const patrolTerm = 1 - availablePatrolsInZone / totalPatrolsInZone;
  const patrolContrib = Math.round(0.20 * patrolTerm * 100);

  const totalScore = Math.min(100, Math.max(0, modelContrib + incidentContrib + patrolContrib));

  let level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' = 'LOW';
  if (totalScore >= 70) level = 'HIGH';
  else if (totalScore >= 50) level = 'ELEVATED';
  else if (totalScore >= 35) level = 'MODERATE';

  return {
    score: totalScore,
    level,
    modelContrib,
    incidentContrib,
    patrolContrib,
  };
}

export function generateFallbackAiSummary(zoneName: string, pred?: Prediction): string {
  if (!pred) {
    return `Zone ${zoneName} operational readiness nominal. Routine patrols active with steady surveillance coverage across primary junctions.`;
  }
  const confPct = Math.round((pred.confidence || 0.7) * 100);
  return `Zone ${zoneName} currently registers ${pred.riskLevel} risk (${pred.riskScore}/100) with predicted concern ${pred.category} (${confPct}% confidence). Recommended action: ${pred.recommendation}.`;
}
