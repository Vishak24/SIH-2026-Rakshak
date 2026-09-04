// TODO (Task A1 / Dev B): Shared simulator stub.
// Dev B will replace this with the real physics/route-based simulator under Task B1.
// Contract: getPatrols(), getIncidents(), fireSos(lat, lng), reset()

export interface SimulatedPatrol {
  patrolId: string;
  name: string;
  officer: string;
  zone: string;
  lat: number;
  lng: number;
  heading: number;
  status: 'PATROLLING' | 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE';
  assignedIncidentId: string | null;
  etaSeconds: number | null;
}

export interface SimulatedIncident {
  id: string;
  citizenName: string;
  zone: string;
  lat: number;
  lng: number;
  status: 'RECEIVED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'RESOLVED';
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
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

const mockPatrols: SimulatedPatrol[] = [
  { patrolId: 'P-101', name: 'Hawk 1', officer: 'Insp. Ramesh', zone: 'Adyar', lat: 13.0012, lng: 80.2565, heading: 45, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-102', name: 'Cheetah 2', officer: 'Sub-Insp. Priya', zone: 'T. Nagar', lat: 13.0418, lng: 80.2341, heading: 120, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-103', name: 'Falcon 3', officer: 'Head-Const. Vignesh', zone: 'Mylapore', lat: 13.0336, lng: 80.2687, heading: 90, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-104', name: 'Eagle 4', officer: 'Insp. Anand', zone: 'Velachery', lat: 12.9815, lng: 80.2180, heading: 180, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-105', name: 'Panther 5', officer: 'Sub-Insp. Deepa', zone: 'Anna Nagar', lat: 13.0850, lng: 80.2101, heading: 270, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-106', name: 'Tiger 6', officer: 'Const. Saravanan', zone: 'Marina Beach', lat: 13.0544, lng: 80.2825, heading: 15, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-107', name: 'Cobra 7', officer: 'Sub-Insp. Karthik', zone: 'Guindy', lat: 13.0067, lng: 80.2025, heading: 210, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-108', name: 'Viper 8', officer: 'Const. Senthil', zone: 'Tambaram', lat: 12.9249, lng: 80.1280, heading: 330, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-109', name: 'Rhino 9', officer: 'Head-Const. Murugan', zone: 'Besant Nagar', lat: 12.9982, lng: 80.2664, heading: 80, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
  { patrolId: 'P-110', name: 'Bison 10', officer: 'Insp. Kavitkumar', zone: 'Egmore', lat: 13.0784, lng: 80.2608, heading: 160, status: 'PATROLLING', assignedIncidentId: null, etaSeconds: null },
];

const mockIncidents: SimulatedIncident[] = [
  {
    id: 'INC-849201',
    citizenName: 'Ananya S.',
    zone: 'T. Nagar',
    lat: 13.0425,
    lng: 80.2335,
    status: 'EN_ROUTE',
    createdAt: Date.now() - 180000,
    assignedAt: Date.now() - 150000,
    enRouteAt: Date.now() - 120000,
    arrivedAt: null,
    resolvedAt: null,
    assignedPatrolId: 'P-102',
    patrol: { patrolId: 'P-102', name: 'Cheetah 2', officer: 'Sub-Insp. Priya' },
    etaSeconds: 120,
    dispatchDistanceM: 850,
    priority: 'CRITICAL',
  },
  {
    id: 'INC-849202',
    citizenName: 'Karthik Raja',
    zone: 'Velachery',
    lat: 12.9820,
    lng: 80.2205,
    status: 'ASSIGNED',
    createdAt: Date.now() - 60000,
    assignedAt: Date.now() - 30000,
    enRouteAt: null,
    arrivedAt: null,
    resolvedAt: null,
    assignedPatrolId: 'P-104',
    patrol: { patrolId: 'P-104', name: 'Eagle 4', officer: 'Insp. Anand' },
    etaSeconds: 240,
    dispatchDistanceM: 1400,
    priority: 'HIGH',
  },
];

class SimulatorStub {
  private patrols = [...mockPatrols];
  private incidents = [...mockIncidents];

  getPatrols(): SimulatedPatrol[] {
    // Slight jitter to simulate movement in mock mode
    return this.patrols.map((p, idx) => ({
      ...p,
      lat: p.lat + (Math.sin(Date.now() / 3000 + idx) * 0.0001),
      lng: p.lng + (Math.cos(Date.now() / 3000 + idx) * 0.0001),
    }));
  }

  getIncidents(): SimulatedIncident[] {
    return [...this.incidents];
  }

  fireSos(lat: number, lng: number): SimulatedIncident {
    const newInc: SimulatedIncident = {
      id: `INC-${Math.floor(100000 + Math.random() * 900000)}`,
      citizenName: 'Emergency Caller',
      zone: 'Chennai Central',
      lat,
      lng,
      status: 'RECEIVED',
      createdAt: Date.now(),
      assignedAt: null,
      enRouteAt: null,
      arrivedAt: null,
      resolvedAt: null,
      assignedPatrolId: null,
      etaSeconds: 300,
      dispatchDistanceM: 2000,
      priority: 'CRITICAL',
    };
    this.incidents.unshift(newInc);
    return newInc;
  }

  reset(): void {
    this.incidents = [...mockIncidents];
    this.patrols = [...mockPatrols];
  }
}

export const simulator = new SimulatorStub();

if (typeof window !== 'undefined') {
  (window as unknown as { __sim: SimulatorStub }).__sim = simulator;
}

export default simulator;
