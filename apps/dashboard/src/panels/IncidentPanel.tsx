import React, { useState } from 'react';
import { Incident, IncidentStatus, resolveIncident } from '../api/client';
import { IncidentCard } from './IncidentCard';
import './IncidentPanel.css';

export interface IncidentPanelProps {
  incidents: Incident[];
  selectedZone?: string | null;
  focusIncidentId?: string | null;
  onFocusIncident?: (id: string) => void;
  onSelectZone?: (zone: string | null) => void;
}

interface OptimisticState {
  status: IncidentStatus;
  resolvedAt: number;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * IncidentPanel Component
 * Owned by: Dev A (src/panels/IncidentPanel.tsx)
 *
 * Renders active incident cards sorted newest-first by createdAt,
 * manages optimistic resolution with rollback, ETA countdowns,
 * 10-minute resolved filtering, and calm empty state.
 */
export const IncidentPanel: React.FC<IncidentPanelProps> = ({
  incidents,
  selectedZone,
  focusIncidentId,
  onFocusIncident,
  onSelectZone,
}) => {
  // Optimistic overrides for resolution: keyed by incident ID
  const [optimisticOverrides, setOptimisticOverrides] = useState<Map<string, OptimisticState>>(
    new Map()
  );

  // In-flight resolve tracking: Set of incident IDs
  const [inFlightResolves, setInFlightResolves] = useState<Set<string>>(new Set());

  // Error banners for failed resolve attempts: keyed by incident ID
  const [resolveErrors, setResolveErrors] = useState<Map<string, string>>(new Map());

  // Current timestamp for client-side 10-minute resolved filtering
  const now = Date.now();

  // Optimistic resolve handler
  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (inFlightResolves.has(id)) return;

    // 1. Optimistically mark as RESOLVED in local state
    const resolvedTimestamp = Date.now();
    setOptimisticOverrides((prev) => {
      const next = new Map(prev);
      next.set(id, { status: 'RESOLVED', resolvedAt: resolvedTimestamp });
      return next;
    });

    setInFlightResolves((prev) => new Set(prev).add(id));
    setResolveErrors((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });

    try {
      // 2. Dispatch real or mock resolve call
      await resolveIncident(id);
    } catch (err: unknown) {
      // 3. Roll back optimistic update on failure and display inline error
      const message =
        err instanceof Error ? err.message : 'Network error resolving incident';

      setOptimisticOverrides((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      setResolveErrors((prev) => {
        const next = new Map(prev);
        next.set(id, message);
        return next;
      });
    } finally {
      setInFlightResolves((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Card click: focus incident on map and select its zone for AI panel
  const handleCardClick = (incident: Incident) => {
    if (onFocusIncident) {
      onFocusIncident(incident.id);
    }
    if (onSelectZone) {
      onSelectZone(incident.zone);
    }
  };

  // 1. Filter out resolved incidents that are older than 10 minutes
  const visibleIncidents = incidents.filter((incident) => {
    const override = optimisticOverrides.get(incident.id);
    const effectiveStatus = override ? override.status : incident.status;
    const effectiveResolvedAt = override ? override.resolvedAt : incident.resolvedAt;

    if (effectiveStatus === 'RESOLVED' && effectiveResolvedAt) {
      const timeSinceResolved = now - effectiveResolvedAt;
      if (timeSinceResolved > TEN_MINUTES_MS) {
        return false; // Hide completely after 10 minutes
      }
    }
    return true;
  });

  // 2. Sort newest-first by createdAt
  const sortedIncidents = [...visibleIncidents].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );

  const activeCount = sortedIncidents.filter((inc) => {
    const override = optimisticOverrides.get(inc.id);
    const status = override ? override.status : inc.status;
    return status !== 'RESOLVED';
  }).length;

  return (
    <section className="dashboard-panel incident-panel-container">
      <div className="panel-header">
        <div className="panel-header-left">
          <h2 className="panel-title">Active Incidents</h2>
          <span className="panel-counter">{activeCount}</span>
        </div>
        {selectedZone && (
          <span className="panel-zone-badge">{selectedZone}</span>
        )}
      </div>

      <div className="incident-panel-body">
        {sortedIncidents.length === 0 ? (
          <div className="calm-empty-state">
            <div className="empty-state-icon">🛡️</div>
            <p className="empty-state-title">No active incidents — city nominal</p>
            <span className="empty-state-desc">
              Automated dispatch and patrols are monitoring all city sectors.
            </span>
          </div>
        ) : (
          <div className="incident-cards-list">
            {sortedIncidents.map((incident) => {
              const override = optimisticOverrides.get(incident.id);
              const effectiveStatus = override ? override.status : incident.status;
              const effectiveResolvedAt = override
                ? override.resolvedAt
                : incident.resolvedAt;
              const isResolving = inFlightResolves.has(incident.id);
              const errorMessage = resolveErrors.get(incident.id);
              const isSelectedZone = selectedZone === incident.zone;
              const isFocused = focusIncidentId === incident.id;

              return (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  effectiveStatus={effectiveStatus}
                  effectiveResolvedAt={effectiveResolvedAt}
                  isResolving={isResolving}
                  errorMessage={errorMessage}
                  isSelectedZone={isSelectedZone}
                  isFocused={isFocused}
                  onResolve={handleResolve}
                  onCardClick={handleCardClick}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default IncidentPanel;
