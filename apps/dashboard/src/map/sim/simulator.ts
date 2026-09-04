import { Patrol, Incident } from '../../lib/types';
import patrolRoutesData from '../assets/patrol_routes.json';
import zonesData from '../assets/zones.json';

export interface RouteWaypoint {
  lat: number;
  lng: number;
}

export interface RawRoute {
  patrolId: string;
  name: string;
  officer: string;
  zone: string;
  speedKmh: number;
  waypoints: [number, number][];
}

export interface ProcessedRoute {
  patrolId: string;
  name: string;
  officer: string;
  zone: string;
  speedMps: number; // meters per second (~35 km/h = 9.72 m/s)
  waypoints: RouteWaypoint[];
  cumulativeDistances: number[];
  totalDistance: number;
  offsetSeconds: number;
}

// Haversine distance in meters
export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Heading angle 0-360 degrees (0 = North, 90 = East, 180 = South, 270 = West)
export function calculateHeading(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

export type PatrolsResponse = Patrol[] & {
  patrols: Patrol[];
  serverTime: number;
};

export type IncidentsResponse = Incident[] & {
  incidents: Incident[];
  serverTime: number;
};

export class CitySimulator {
  private routes: ProcessedRoute[] = [];
  private incidents: Incident[] = [];
  private sosDispatchMap = new Map<
    string,
    {
      patrolId: string;
      startLat: number;
      startLng: number;
      targetLat: number;
      targetLng: number;
      startTime: number;
      durationMs: number;
    }
  >();

  constructor() {
    this.initRoutes();
    this.seedDefaultDemo();
    this.attachToWindow();
  }

  private initRoutes() {
    this.routes = (patrolRoutesData as unknown as RawRoute[]).map((r: RawRoute, idx: number) => {
      const waypoints = r.waypoints.map((w: [number, number]) => ({ lat: w[0], lng: w[1] }));
      const cumulative: number[] = [0];
      let total = 0;

      for (let i = 0; i < waypoints.length - 1; i++) {
        const d = haversineDistanceM(waypoints[i].lat, waypoints[i].lng, waypoints[i + 1].lat, waypoints[i + 1].lng);
        total += d;
        cumulative.push(total);
      }

      // If loop doesn't close back to first waypoint, add closing segment
      const last = waypoints[waypoints.length - 1];
      const first = waypoints[0];
      const closingDist = haversineDistanceM(last.lat, last.lng, first.lat, first.lng);
      if (closingDist > 10) {
        total += closingDist;
        cumulative.push(total);
      }

      return {
        patrolId: r.patrolId,
        name: r.name,
        officer: r.officer,
        zone: r.zone,
        speedMps: (r.speedKmh * 1000) / 3600, // ~9.72 m/s
        waypoints,
        cumulativeDistances: cumulative,
        totalDistance: Math.max(100, total),
        offsetSeconds: idx * 45, // Stagger patrols evenly
      };
    });
  }

  private attachToWindow() {
    if (typeof window !== 'undefined') {
      (window as unknown as { __sim: CitySimulator }).__sim = this;
      console.log('Rakshak CitySimulator attached to window.__sim. Call window.__sim.fireSos(lat, lng) to test.');
    }
  }

  public getPatrols(): PatrolsResponse {
    const now = Date.now();
    const patrols: Patrol[] = [];

    for (const route of this.routes) {
      const dispatch = this.sosDispatchMap.get(route.patrolId);

      if (dispatch) {
        // Patrol is dispatched to an SOS: interpolate position toward incident over durationMs (~240s)
        const elapsed = now - dispatch.startTime;
        const progress = Math.min(1, Math.max(0, elapsed / dispatch.durationMs));

        const curLat = dispatch.startLat + progress * (dispatch.targetLat - dispatch.startLat);
        const curLng = dispatch.startLng + progress * (dispatch.targetLng - dispatch.startLng);
        const heading = calculateHeading(curLat, curLng, dispatch.targetLat, dispatch.targetLng);
        const distRemaining = haversineDistanceM(curLat, curLng, dispatch.targetLat, dispatch.targetLng);
        const etaSeconds = Math.max(0, Math.round((dispatch.durationMs - elapsed) / 1000));

        const assignedInc = this.incidents.find((i) => i.assignedPatrolId === route.patrolId && i.status !== 'RESOLVED');

        let status: Patrol['status'] = 'EN_ROUTE';
        if (progress >= 1 || distRemaining < 25) {
          status = 'ON_SCENE';
          if (assignedInc && (assignedInc.status === 'EN_ROUTE' || assignedInc.status === 'ASSIGNED')) {
            assignedInc.status = 'ARRIVED';
            assignedInc.arrivedAt = now;
            assignedInc.etaSeconds = 0;
          }
        }

        if (assignedInc) {
          assignedInc.etaSeconds = etaSeconds;
        }

        patrols.push({
          patrolId: route.patrolId,
          name: route.name,
          officer: route.officer,
          zone: route.zone,
          lat: Number(curLat.toFixed(6)),
          lng: Number(curLng.toFixed(6)),
          heading: Math.round(heading),
          status,
          assignedIncidentId: assignedInc ? assignedInc.id : null,
          etaSeconds: status === 'ON_SCENE' ? 0 : etaSeconds,
        });
      } else {
        // Normal beat patrolling along closed loop: "time is the tick"
        // ((now_in_seconds + per-patrol offset) * speed) mod totalRouteLengthMeters
        const tSec = now / 1000 + route.offsetSeconds;
        const currentDist = (tSec * route.speedMps) % route.totalDistance;

        // Find waypoint segment
        let segIdx = 0;
        for (let i = 0; i < route.cumulativeDistances.length - 1; i++) {
          if (
            currentDist >= route.cumulativeDistances[i] &&
            currentDist <= route.cumulativeDistances[i + 1]
          ) {
            segIdx = i;
            break;
          }
        }

        const segStartDist = route.cumulativeDistances[segIdx];
        const segEndDist = route.cumulativeDistances[segIdx + 1] || route.totalDistance;
        const segLen = segEndDist - segStartDist;
        const segRatio = segLen > 0 ? (currentDist - segStartDist) / segLen : 0;

        const pA = route.waypoints[segIdx];
        const pB = route.waypoints[segIdx + 1] || route.waypoints[0];

        const lat = pA.lat + segRatio * (pB.lat - pA.lat);
        const lng = pA.lng + segRatio * (pB.lng - pA.lng);
        const heading = calculateHeading(pA.lat, pA.lng, pB.lat, pB.lng);

        patrols.push({
          patrolId: route.patrolId,
          name: route.name,
          officer: route.officer,
          zone: route.zone,
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          heading: Math.round(heading),
          status: 'PATROLLING',
          assignedIncidentId: null,
          etaSeconds: null,
        });
      }
    }

    // Dual-compatible return: array behaves as Patrol[] AND has .patrols and .serverTime
    const result = patrols as PatrolsResponse;
    result.patrols = patrols;
    result.serverTime = now;
    return result;
  }

  public getIncidents(): IncidentsResponse {
    const now = Date.now();
    // Filter out incidents resolved more than 10 minutes (600,000 ms) ago
    const validIncidents = this.incidents.filter(
      (inc) => inc.status !== 'RESOLVED' || (inc.resolvedAt && now - inc.resolvedAt < 600000)
    );
    this.incidents = validIncidents;

    const result = [...this.incidents] as IncidentsResponse;
    result.incidents = this.incidents;
    result.serverTime = now;
    return result;
  }

  public fireSos(lat: number, lng: number, zoneName?: string, citizenName?: string): Incident {
    const now = Date.now();
    const id = `SOS-${Math.floor(1000 + Math.random() * 9000)}`;

    // Identify closest zone if not provided
    let determinedZone = zoneName;
    if (!determinedZone) {
      let minDist = Infinity;
      for (const z of (zonesData as Array<{ name: string; lat: number; lng: number }>)) {
        const d = haversineDistanceM(lat, lng, z.lat, z.lng);
        if (d < minDist) {
          minDist = d;
          determinedZone = z.name;
        }
      }
    }

    // Find nearest available patrol (status PATROLLING)
    const currentPatrols = this.getPatrols().patrols;
    const available = currentPatrols.filter((p) => p.status === 'PATROLLING');

    let assignedPatrol: Patrol | null = null;
    let minPatrolDist = Infinity;

    for (const p of available) {
      const d = haversineDistanceM(p.lat, p.lng, lat, lng);
      if (d < minPatrolDist) {
        minPatrolDist = d;
        assignedPatrol = p;
      }
    }

    // Fallback: if all patrols are busy, assign the nearest patrol regardless
    if (!assignedPatrol && currentPatrols.length > 0) {
      for (const p of currentPatrols) {
        const d = haversineDistanceM(p.lat, p.lng, lat, lng);
        if (d < minPatrolDist) {
          minPatrolDist = d;
          assignedPatrol = p;
        }
      }
    }

    const citizens = ['Anita Sundaram', 'Rajesh Kanna', 'Deepak Verma', 'Meenakshi Iyer', 'Suresh Babu', 'Kavitha Nathan'];
    const selectedCitizen = citizenName || citizens[Math.floor(Math.random() * citizens.length)];

    const incident: Incident = {
      id,
      citizenName: selectedCitizen,
      zone: determinedZone || 'T Nagar',
      lat,
      lng,
      status: assignedPatrol ? 'EN_ROUTE' : 'RECEIVED',
      createdAt: now,
      assignedAt: assignedPatrol ? now + 1000 : null,
      enRouteAt: assignedPatrol ? now + 2000 : null,
      arrivedAt: null,
      resolvedAt: null,
      assignedPatrolId: assignedPatrol ? assignedPatrol.patrolId : null,
      patrol: assignedPatrol
        ? {
            patrolId: assignedPatrol.patrolId,
            name: assignedPatrol.name,
            officer: assignedPatrol.officer,
          }
        : null,
      etaSeconds: 240, // 240-second dispatch window
      dispatchDistanceM: Math.round(minPatrolDist),
      priority: 'HIGH',
    };

    this.incidents.unshift(incident);

    if (assignedPatrol) {
      this.sosDispatchMap.set(assignedPatrol.patrolId, {
        patrolId: assignedPatrol.patrolId,
        startLat: assignedPatrol.lat,
        startLng: assignedPatrol.lng,
        targetLat: lat,
        targetLng: lng,
        startTime: now,
        durationMs: 240000,
      });
    }

    console.log(`[Simulator] Fired SOS ${incident.id} at (${lat}, ${lng}) assigned to ${assignedPatrol?.patrolId}`);
    return incident;
  }

  public resolveIncident(id: string): Incident | null {
    const now = Date.now();
    const inc = this.incidents.find((i) => i.id === id);
    if (!inc) return null;

    inc.status = 'RESOLVED';
    inc.resolvedAt = now;

    if (inc.assignedPatrolId) {
      this.sosDispatchMap.delete(inc.assignedPatrolId);
    }

    console.log(`[Simulator] Resolved incident ${id}`);
    return inc;
  }

  public reset(): void {
    this.incidents = [];
    this.sosDispatchMap.clear();
    console.log('[Simulator] Reset: all simulated incidents cleared, all patrols returned to normal route');
  }

  public seedDefaultDemo(): void {
    const now = Date.now();
    const seedIncident: Incident = {
      id: 'SOS-4921',
      citizenName: 'Priya Raman',
      zone: 'T Nagar',
      lat: 13.0418,
      lng: 80.2341,
      status: 'EN_ROUTE',
      createdAt: now - 120000,
      assignedAt: now - 110000,
      enRouteAt: now - 100000,
      arrivedAt: null,
      resolvedAt: null,
      assignedPatrolId: 'P04',
      patrol: {
        patrolId: 'P04',
        name: 'Patrol 04',
        officer: 'Insp. R. Selvam',
      },
      etaSeconds: 192,
      dispatchDistanceM: 1450,
      priority: 'HIGH',
    };
    this.incidents = [seedIncident];

    const p04Route = this.routes.find((r) => r.patrolId === 'P04');
    const startLat = p04Route ? p04Route.waypoints[0].lat : 13.038;
    const startLng = p04Route ? p04Route.waypoints[0].lng : 80.23;

    this.sosDispatchMap.set('P04', {
      patrolId: 'P04',
      startLat,
      startLng,
      targetLat: seedIncident.lat,
      targetLng: seedIncident.lng,
      startTime: now - 48000,
      durationMs: 240000,
    });
  }
}

export const simulator = new CitySimulator();

export const getPatrols = () => simulator.getPatrols();
export const getIncidents = () => simulator.getIncidents();
export const fireSos = (lat: number, lng: number, zoneName?: string, citizenName?: string) =>
  simulator.fireSos(lat, lng, zoneName, citizenName);
export const reset = () => simulator.reset();
export const resolveIncident = (id: string) => simulator.resolveIncident(id);
