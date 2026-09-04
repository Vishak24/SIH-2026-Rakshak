/**
 * Rakshak Central Command — API Client
 * Owned by: Dev A (src/api/client.*)
 *
 * Handles live backend calls and mock simulator dispatch for patrol,
 * incident, prediction, and AI narrative endpoints.
 */

// Deliberate shared dependency: Dev B builds src/map/sim/simulator
// TODO (Task A1): Confirm exact import path with Dev B when simulator is ready.
import { simulator } from '../map/sim/simulator';
import mockPredictions from '../../../../shared/mock/predictions.json';

export type PatrolStatus = 'PATROLLING' | 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE';
export type IncidentStatus = 'RECEIVED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED';
export type IncidentPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

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
    officer: string;
  } | null;
  etaSeconds: number | null;
  dispatchDistanceM: number | null;
  priority: IncidentPriority;
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

export interface PatrolsResponse {
  patrols: Patrol[];
  serverTime?: number;
}

export interface IncidentsResponse {
  incidents: Incident[];
  serverTime?: number;
}

/**
 * Reads environment variables dynamically at runtime
 */
function getEnvConfig() {
  const rawBase = import.meta.env.VITE_API_BASE;
  const apiBase = rawBase ? rawBase.replace(/\/+$/, '') : 'http://localhost:3000';
  const useMock =
    import.meta.env.VITE_USE_MOCK === 'true' ||
    import.meta.env.VITE_USE_MOCK === true ||
    import.meta.env.VITE_USE_MOCK === undefined; // default to mock if unset for demo reliability
  return { apiBase, useMock };
}

/**
 * 1. getPatrols()
 * Contract: GET /patrols -> { patrols: [...], serverTime }
 */
export async function getPatrols(): Promise<PatrolsResponse> {
  const { apiBase, useMock } = getEnvConfig();

  if (useMock) {
    const rawPatrols = simulator.getPatrols();
    return {
      patrols: rawPatrols,
      serverTime: Date.now(),
    };
  }

  const res = await fetch(`${apiBase}/patrols`);
  if (!res.ok) {
    throw new Error(`Failed to fetch patrols: ${res.status} ${res.statusText}`);
  }
  const data: PatrolsResponse = await res.json();
  return data;
}

/**
 * 2. getIncidents()
 * Contract: GET /sos/live -> { incidents: [...], serverTime }
 */
export async function getIncidents(): Promise<IncidentsResponse> {
  const { apiBase, useMock } = getEnvConfig();

  if (useMock) {
    const rawIncidents = simulator.getIncidents();
    return {
      incidents: rawIncidents,
      serverTime: Date.now(),
    };
  }

  const res = await fetch(`${apiBase}/sos/live`);
  if (!res.ok) {
    throw new Error(`Failed to fetch live incidents: ${res.status} ${res.statusText}`);
  }
  const data: IncidentsResponse = await res.json();
  return data;
}

/**
 * 3. resolveIncident(id)
 * Contract: PATCH /sos/resolve/{id} -> returns updated incident
 */
export async function resolveIncident(id: string): Promise<Incident> {
  const { apiBase, useMock } = getEnvConfig();

  if (useMock) {
    const currentIncidents = simulator.getIncidents();
    const target = currentIncidents.find((inc) => inc.id === id);
    if (!target) {
      throw new Error(`Mock incident ${id} not found`);
    }
    target.status = 'RESOLVED';
    target.resolvedAt = Date.now();
    return { ...target };
  }

  const res = await fetch(`${apiBase}/sos/resolve/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to resolve incident ${id}: ${res.status} ${res.statusText}`);
  }
  const data: Incident = await res.json();
  return data;
}

/**
 * 4. getPredictions(zone?)
 * Contract: GET /predict -> array of predictions. ?zone= returns a single object.
 */
export async function getPredictions(zone?: string): Promise<Prediction[] | Prediction> {
  const { apiBase, useMock } = getEnvConfig();

  if (useMock) {
    const predictionsList = (mockPredictions as Prediction[]) || [];
    if (zone) {
      const match = predictionsList.find(
        (p) => p.zone.toLowerCase() === zone.toLowerCase()
      );
      if (match) return match;
      // Fallback prediction object if specific zone not found in mock list
      return {
        zone,
        hour: new Date().getHours(),
        category: 'Area Patrol & Surveillance',
        confidence: 0.85,
        riskScore: 0.5,
        riskLevel: 'MODERATE',
        recommendation: 'Maintain standard patrol presence and check transit intersections.',
        modelVersion: 'rakshak-v1.4-chennai',
        source: 'Mock Predictive Model',
      };
    }
    return predictionsList;
  }

  const url = zone
    ? `${apiBase}/predict?zone=${encodeURIComponent(zone)}`
    : `${apiBase}/predict`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch predictions: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * 5. getAiSummary(zone?)
 * Contract: GET /ai/summary?zone= -> { zone, text, source }
 * Client-side fallback provided so AI panel is never empty even if backend endpoint is unavailable.
 */
export async function getAiSummary(zone?: string | null): Promise<AiSummary> {
  const { apiBase, useMock } = getEnvConfig();
  const targetZone = zone || 'Chennai Central';

  if (useMock) {
    // Hand-built fallback summary object for mock mode
    return {
      zone: targetZone,
      text: `Tactical telemetry indicates moderate activity in ${targetZone}. Patrol coverage is actively distributed with 2 rapid response units within 4-minute reach. High-risk arterial intersections are prioritized for preemptive deterrence.`,
      source: 'Rakshak AI Copilot (Simulated)',
    };
  }

  try {
    const res = await fetch(`${apiBase}/ai/summary?zone=${encodeURIComponent(targetZone)}`);
    if (!res.ok) {
      throw new Error(`AI summary HTTP ${res.status}`);
    }
    const data: AiSummary = await res.json();
    return data;
  } catch {
    // Graceful fallback if backend endpoint does not exist or fails
    return {
      zone: targetZone,
      text: `Patrol telemetry active for ${targetZone}. Units maintain automated grid presence. Preemptive route optimization is actively monitoring incoming dispatch calls.`,
      source: 'Rule-based fallback',
    };
  }
}
