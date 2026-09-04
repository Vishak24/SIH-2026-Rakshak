import React from 'react';
import { Car } from 'lucide-react';
import { Patrol } from '../lib/types';

interface PatrolStripProps {
  patrols: Patrol[];
  onFocusPatrol: (incidentId: string, zone: string) => void;
}

export const PatrolStrip: React.FC<PatrolStripProps> = ({ patrols, onFocusPatrol }) => {
  const getStatusDotClass = (status: Patrol['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return 'dot-enroute';
      case 'ON_SCENE':
        return 'dot-onscene';
      case 'PATROLLING':
      default:
        return 'dot-patrolling';
    }
  };

  const getStatusLabel = (status: Patrol['status']) => {
    switch (status) {
      case 'EN_ROUTE':
        return 'EN ROUTE';
      case 'ON_SCENE':
        return 'ON SCENE';
      case 'PATROLLING':
      default:
        return 'PATROL';
    }
  };

  // Sort patrols P01..P10
  const sortedPatrols = [...patrols].sort((a, b) => a.patrolId.localeCompare(b.patrolId));

  return (
    <footer className="patrol-strip-container">
      <div className="patrol-strip-title">
        <Car size={14} className="text-accent-blue" />
        <span>PATROL FLEET</span>
      </div>

      <div className="patrol-chips-scroll">
        {sortedPatrols.map((p) => {
          const isAssigned = p.status === 'EN_ROUTE' || p.status === 'ON_SCENE';

          return (
            <div
              key={p.patrolId}
              className={`patrol-chip ${isAssigned ? 'patrol-chip-assigned' : ''}`}
              onClick={() => {
                if (p.assignedIncidentId) {
                  onFocusPatrol(p.assignedIncidentId, p.zone);
                }
              }}
              title={`${p.name} (${p.officer}) · ${p.zone} · Status: ${p.status}${
                p.assignedIncidentId ? ` · Assigned to ${p.assignedIncidentId}` : ''
              }`}
            >
              <span className={`patrol-chip-dot ${getStatusDotClass(p.status)}`}></span>
              <span className="patrol-chip-id font-mono">{p.patrolId}</span>
              <span className="patrol-chip-zone">{p.zone}</span>

              {p.assignedIncidentId && (
                <span className="patrol-chip-incident font-mono">
                  ▲ {p.assignedIncidentId}
                </span>
              )}

              {!p.assignedIncidentId && (
                <span className="patrol-chip-status font-mono">
                  {getStatusLabel(p.status)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </footer>
  );
};
