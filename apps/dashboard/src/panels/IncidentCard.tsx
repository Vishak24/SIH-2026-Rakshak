import React, { useState, useEffect } from 'react';
import { Incident, IncidentStatus } from '../api/client';

export interface IncidentCardProps {
  incident: Incident;
  effectiveStatus: IncidentStatus;
  effectiveResolvedAt: number | null;
  isResolving: boolean;
  errorMessage?: string;
  isSelectedZone: boolean;
  isFocused: boolean;
  onResolve: (id: string, e: React.MouseEvent) => void;
  onCardClick: (incident: Incident) => void;
}

/**
 * Status color class mapping from theme semantic palette:
 * RECEIVED -> crimson/pulse
 * ASSIGNED -> sky blue
 * EN_ROUTE -> cyan
 * ARRIVED -> amber
 * RESOLVED -> muted slate
 */
function getStatusClass(status: IncidentStatus): string {
  switch (status) {
    case 'RECEIVED':
      return 'chip--received';
    case 'ASSIGNED':
      return 'chip--assigned';
    case 'EN_ROUTE':
      return 'chip--en-route';
    case 'ARRIVED':
      return 'chip--arrived';
    case 'RESOLVED':
      return 'chip--resolved';
    default:
      return 'chip--neutral';
  }
}

export const IncidentCard: React.FC<IncidentCardProps> = ({
  incident,
  effectiveStatus,
  effectiveResolvedAt,
  isResolving,
  errorMessage,
  isSelectedZone,
  isFocused,
  onResolve,
  onCardClick,
}) => {
  const isResolved = effectiveStatus === 'RESOLVED';

  // Shortened ID (last 6 characters)
  const shortId = incident.id.length > 6 ? incident.id.slice(-6) : incident.id;

  // Local ETA countdown state: seeded from props, ticks down 1s, re-syncs on new props
  const [localEta, setLocalEta] = useState<number | null>(incident.etaSeconds ?? null);

  useEffect(() => {
    setLocalEta(incident.etaSeconds ?? null);
  }, [incident.etaSeconds]);

  useEffect(() => {
    if (localEta === null || localEta <= 0 || isResolved) return;

    const timer = setInterval(() => {
      setLocalEta((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [localEta, isResolved]);

  // Relative "n min ago" calculation derived from createdAt
  const [relativeTime, setRelativeTime] = useState<string>('just now');

  useEffect(() => {
    const updateRelative = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - incident.createdAt) / 1000));
      if (diffSec < 60) {
        setRelativeTime('just now');
      } else if (diffSec < 3600) {
        const mins = Math.floor(diffSec / 60);
        setRelativeTime(`${mins}m ago`);
      } else {
        const hrs = Math.floor(diffSec / 3600);
        setRelativeTime(`${hrs}h ago`);
      }
    };

    updateRelative();
    const timer = setInterval(updateRelative, 10000);
    return () => clearInterval(timer);
  }, [incident.createdAt]);

  const formatEta = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined || isResolved) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const assignedPatrolName =
    incident.patrol?.name ||
    (incident.assignedPatrolId ? `Patrol ${incident.assignedPatrolId}` : 'Unassigned');

  return (
    <div
      className={`incident-card ${isResolved ? 'incident-card--resolved' : ''} ${
        isFocused ? 'incident-card--focused' : ''
      } ${isSelectedZone ? 'incident-card--zone-selected' : ''}`}
      onClick={() => onCardClick(incident)}
      role="button"
      tabIndex={0}
    >
      {/* Top Header: ID, Status Chip, Relative Time */}
      <div className="card-top-row">
        <div className="card-id-group">
          <span className="incident-id">#{shortId}</span>
          <span className={`status-chip ${getStatusClass(effectiveStatus)}`}>
            {effectiveStatus.replace('_', ' ')}
          </span>
        </div>
        <span className="incident-time">{relativeTime}</span>
      </div>

      {/* Citizen & Zone Details */}
      <div className="card-body-row">
        <div className="citizen-info">
          <span className="citizen-name">{incident.citizenName || 'Anonymous Citizen'}</span>
          <span className="incident-zone">{incident.zone}</span>
        </div>

        {/* ETA Display */}
        <div className="incident-eta-block">
          <span className="eta-label">ETA</span>
          <span className={`eta-value ${localEta && localEta <= 60 && !isResolved ? 'eta-value--imminent' : ''}`}>
            {formatEta(localEta)}
          </span>
        </div>
      </div>

      {/* Bottom Row: Assigned Patrol and Action Button */}
      <div className="card-bottom-row">
        <div className="patrol-info">
          <span className="patrol-label">Unit:</span>
          <span className="patrol-name">{assignedPatrolName}</span>
        </div>

        {!isResolved ? (
          <button
            type="button"
            className="btn-resolve"
            disabled={isResolving}
            onClick={(e) => onResolve(incident.id, e)}
            title="Mark incident as resolved"
          >
            {isResolving ? 'Resolving…' : 'Resolve'}
          </button>
        ) : (
          <span className="resolved-badge">Resolved</span>
        )}
      </div>

      {/* Inline Error Message on Optimistic Rollback */}
      {errorMessage && (
        <div className="card-error-banner" onClick={(e) => e.stopPropagation()}>
          ⚠️ {errorMessage}
        </div>
      )}
    </div>
  );
};

export default IncidentCard;
