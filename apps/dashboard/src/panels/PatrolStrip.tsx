import React from 'react';
import { Patrol, PatrolStatus } from '../api/client';
import './PatrolStrip.css';

export interface PatrolStripProps {
  patrols: Patrol[];
  focusIncidentId?: string | null;
  onFocusIncident?: (incidentId: string) => void;
}

/**
 * Maps patrol status to theme semantic status dot class
 */
function getPatrolStatusDotClass(status: PatrolStatus): string {
  switch (status) {
    case 'PATROLLING':
      return 'patrol-dot--patrolling';
    case 'EN_ROUTE':
      return 'patrol-dot--en-route';
    case 'ON_SCENE':
      return 'patrol-dot--on-scene';
    case 'ASSIGNED':
      return 'patrol-dot--assigned';
    default:
      return 'patrol-dot--patrolling';
  }
}

/**
 * PatrolStrip Component
 * Owned by: Dev A (src/panels/PatrolStrip.tsx)
 *
 * Renders a single horizontal row of exactly ten chips spanning the bottom of the dashboard.
 * Never wraps, scaling/truncating text to remain visible across 1440px–1920px.
 * Clicking a chip with an assigned incident triggers focus on that incident.
 */
export const PatrolStrip: React.FC<PatrolStripProps> = ({
  patrols,
  focusIncidentId,
  onFocusIncident,
}) => {
  // Guarantee exactly up to ten chips
  const displayPatrols = patrols.slice(0, 10);

  const handleChipClick = (patrol: Patrol) => {
    if (patrol.assignedIncidentId && onFocusIncident) {
      onFocusIncident(patrol.assignedIncidentId);
    }
  };

  return (
    <footer className="patrol-strip-bar">
      <div className="patrol-strip-header">
        <span className="patrol-strip-title">Fleet Status</span>
        <span className="patrol-count-badge">
          {patrols.filter((p) => p.status === 'PATROLLING').length} / {displayPatrols.length} Avail
        </span>
      </div>

      <div className="patrol-chips-container">
        {displayPatrols.map((patrol) => {
          const hasAssignedIncident = Boolean(patrol.assignedIncidentId);
          const isFocused =
            hasAssignedIncident && focusIncidentId === patrol.assignedIncidentId;

          const shortIncId = patrol.assignedIncidentId
            ? patrol.assignedIncidentId.length > 6
              ? patrol.assignedIncidentId.slice(-6)
              : patrol.assignedIncidentId
            : null;

          return (
            <div
              key={patrol.patrolId}
              className={`patrol-chip ${
                hasAssignedIncident ? 'patrol-chip--clickable' : 'patrol-chip--idle'
              } ${isFocused ? 'patrol-chip--focused' : ''}`}
              onClick={() => handleChipClick(patrol)}
              role={hasAssignedIncident ? 'button' : undefined}
              tabIndex={hasAssignedIncident ? 0 : undefined}
              title={
                hasAssignedIncident
                  ? `Click to focus incident #${shortIncId} (${patrol.name})`
                  : `${patrol.name} (${patrol.officer}) - ${patrol.status}`
              }
            >
              {/* Status Dot */}
              <span className={`patrol-dot ${getPatrolStatusDotClass(patrol.status)}`} />

              {/* Patrol Identity */}
              <span className="patrol-name-text">{patrol.name}</span>

              {/* Current Zone */}
              <span className="patrol-zone-text">{patrol.zone}</span>

              {/* Assigned Incident Tag if Dispatched */}
              {shortIncId && (
                <span className="patrol-assigned-badge" title={`Assigned: ${patrol.assignedIncidentId}`}>
                  #{shortIncId}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </footer>
  );
};

export default PatrolStrip;
