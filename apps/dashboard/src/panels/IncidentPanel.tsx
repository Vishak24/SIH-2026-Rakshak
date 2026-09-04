import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, Navigation, User, MapPin } from 'lucide-react';
import { Incident } from '../lib/types';
import { formatEta } from '../lib/derive';

interface IncidentPanelProps {
  incidents: Incident[];
  onResolve: (id: string) => Promise<void>;
  onFocusIncident: (id: string, zone: string) => void;
  selectedIncidentId?: string | null;
}

export const IncidentPanel: React.FC<IncidentPanelProps> = ({
  incidents,
  onResolve,
  onFocusIncident,
  selectedIncidentId,
}) => {
  const [resolvingIds, setResolvingIds] = useState<Set<string>>(new Set());
  const [localEtas, setLocalEtas] = useState<Record<string, number>>({});
  const [, setClockTick] = useState(0);

  // Sync incoming polled ETAs
  useEffect(() => {
    setLocalEtas((prev) => {
      const next = { ...prev };
      for (const inc of incidents) {
        if (inc.etaSeconds !== null && inc.etaSeconds !== undefined) {
          next[inc.id] = inc.etaSeconds;
        }
      }
      return next;
    });
  }, [incidents]);

  // Local 1-second ETA countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setLocalEtas((prev) => {
        const next: Record<string, number> = {};
        for (const [id, seconds] of Object.entries(prev)) {
          next[id] = Math.max(0, seconds - 1);
        }
        return next;
      });
      setClockTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleResolve = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (resolvingIds.has(id)) return;
    setResolvingIds((prev) => new Set(prev).add(id));
    try {
      await onResolve(id);
    } finally {
      setResolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const formatElapsedAgo = (createdAtMs: number) => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - createdAtMs) / 1000));
    if (elapsedSec < 60) return `${elapsedSec}s ago`;
    const mins = Math.floor(elapsedSec / 60);
    return `${mins}m ago`;
  };

  const getStatusChipClass = (status: Incident['status']) => {
    switch (status) {
      case 'RECEIVED':
        return 'chip-received';
      case 'ASSIGNED':
        return 'chip-assigned';
      case 'EN_ROUTE':
        return 'chip-enroute';
      case 'ARRIVED':
        return 'chip-arrived';
      case 'RESOLVED':
        return 'chip-resolved';
      default:
        return 'chip-received';
    }
  };

  // Sort: active incidents newest first, resolved at bottom
  const sortedIncidents = [...incidents].sort((a, b) => {
    if (a.status === 'RESOLVED' && b.status !== 'RESOLVED') return 1;
    if (a.status !== 'RESOLVED' && b.status === 'RESOLVED') return -1;
    return b.createdAt - a.createdAt;
  });

  return (
    <section className="incident-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <AlertCircle size={15} className="text-accent-red" />
          <h2 className="panel-title">ACTIVE INCIDENTS</h2>
        </div>
        <span className="incident-count-pill font-mono">
          {incidents.filter((i) => i.status !== 'RESOLVED').length}
        </span>
      </div>

      <div className="incident-list">
        {sortedIncidents.length === 0 ? (
          <div className="incident-empty-state">
            <CheckCircle2 size={32} className="text-accent-green opacity-70" />
            <p className="empty-title">No active incidents</p>
            <p className="empty-subtitle">City operational status nominal</p>
          </div>
        ) : (
          sortedIncidents.map((inc) => {
            const isResolved = inc.status === 'RESOLVED';
            const isSelected = selectedIncidentId === inc.id;
            const isResolving = resolvingIds.has(inc.id);
            const eta = localEtas[inc.id] ?? inc.etaSeconds ?? 0;
            const patrolName = inc.patrol?.name || (inc.assignedPatrolId ? `Patrol ${inc.assignedPatrolId}` : null);

            return (
              <div
                key={inc.id}
                className={`incident-card ${isResolved ? 'incident-card-resolved' : ''} ${
                  isSelected ? 'incident-card-selected' : ''
                }`}
                onClick={() => onFocusIncident(inc.id, inc.zone)}
              >
                <div className="incident-card-header">
                  <div className="flex items-center gap-2">
                    <span className="incident-id font-mono">{inc.id}</span>
                    <span className={`status-chip font-mono ${getStatusChipClass(inc.status)}`}>
                      {inc.status}
                    </span>
                  </div>
                  <span className="incident-elapsed font-mono">{formatElapsedAgo(inc.createdAt)}</span>
                </div>

                <div className="incident-card-body">
                  <div className="incident-info-row">
                    <div className="info-cell">
                      <MapPin size={13} className="cell-icon" />
                      <span className="cell-text">{inc.zone}</span>
                    </div>
                    <div className="info-cell">
                      <User size={13} className="cell-icon" />
                      <span className="cell-text">{inc.citizenName}</span>
                    </div>
                  </div>

                  <div className="incident-dispatch-row">
                    {patrolName ? (
                      <div className="patrol-badge">
                        <Navigation size={12} className="patrol-nav-icon" />
                        <span className="patrol-name font-mono">{patrolName}</span>
                      </div>
                    ) : (
                      <span className="dispatch-pending text-muted">Awaiting assignment...</span>
                    )}

                    {!isResolved && inc.status !== 'ARRIVED' && (
                      <div className="eta-badge font-mono">
                        <span className="eta-prefix">ETA</span>
                        <span className="eta-val">{formatEta(eta)}</span>
                      </div>
                    )}
                    {inc.status === 'ARRIVED' && (
                      <span className="onscene-badge font-mono">ON SCENE</span>
                    )}
                  </div>
                </div>

                {!isResolved && (
                  <div className="incident-card-actions">
                    <button
                      className="resolve-btn"
                      disabled={isResolving}
                      onClick={(e) => handleResolve(e, inc.id)}
                    >
                      {isResolving ? 'Resolving...' : 'Resolve Incident'}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};
