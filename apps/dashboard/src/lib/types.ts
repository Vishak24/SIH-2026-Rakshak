export type PatrolStatus = 'PATROLLING' | 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE';

export interface Patrol {
  patrolId: string;
  name: string;
  officer: string;
  zone: string;
  lat: number;
  lng: number;
  heading: number;
  status: PatrolStatus;
  assignedIncidentId: string | null;
  etaSeconds: number | null;
}

export type IncidentStatus = 'RECEIVED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED';

export interface Incident {
  id: string;
  citizenName: string;
  zone: string;
  lat: number;
  lng: number;
  status: IncidentStatus;
  createdAt: number;
  assignedAt: number | null;
  enRouteAt: number | null;
  arrivedAt: number | null;
  resolvedAt: number | null;
  assignedPatrolId: string | null;
  patrol?: {
    patrolId: string;
    name: string;
    officer?: string;
  } | null;
  etaSeconds: number | null;
  dispatchDistanceM?: number;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface Zone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  polygon: [number, number][];
}

export interface Prediction {
  zone: string;
  hour: number;
  category: string;
  confidence: number;
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  recommendation: string;
  modelVersion: string;
  source: string;
}

export interface AiSummary {
  zone: string;
  text: string;
  source: string;
}

export interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

export interface TimelineEvent {
  id: string;
  incidentId: string;
  timestamp: number;
  eventType: IncidentStatus;
  text: string;
  color: string;
}

export interface OperationalRiskBreakdown {
  score: number;
  level: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
  modelContrib: number;
  incidentContrib: number;
  patrolContrib: number;
}
