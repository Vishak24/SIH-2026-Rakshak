import React, { useMemo } from 'react';
import { Incident } from '../api/client';
import { deriveTimeline, TimelineEvent, TimelineEventType } from '../lib/derive';
import './Timeline.css';

export interface TimelineProps {
  incidents: Incident[];
  onSelectZone?: (zone: string | null) => void;
  onFocusIncident?: (id: string) => void;
}

/**
 * Maps each event type to a corresponding theme semantic class
 */
function getEventDotClass(type: TimelineEventType): string {
  switch (type) {
    case 'RECEIVED':
      return 'dot--received';
    case 'ASSIGNED':
      return 'dot--assigned';
    case 'EN_ROUTE':
      return 'dot--en-route';
    case 'ARRIVED':
      return 'dot--arrived';
    case 'RESOLVED':
      return 'dot--resolved';
    default:
      return 'dot--neutral';
  }
}

/**
 * Formats timestamp as HH:MM:SS in Asia/Kolkata timezone
 */
function formatEventTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Timeline Component
 * Owned by: Dev A (src/panels/Timeline.tsx)
 *
 * Renders up to 30 derived operational events sorted descending by timestamp,
 * with 250ms slide-in transitions and color-coded event dots.
 */
export const Timeline: React.FC<TimelineProps> = ({
  incidents,
  onSelectZone,
  onFocusIncident,
}) => {
  // Derive events and cap to exactly 30 rows
  const timelineEvents = useMemo(() => {
    const derived = deriveTimeline(incidents);
    return derived.slice(0, 30);
  }, [incidents]);

  const handleRowClick = (event: TimelineEvent) => {
    if (onSelectZone && event.zone) {
      onSelectZone(event.zone);
    }
    if (onFocusIncident && event.incidentId) {
      onFocusIncident(event.incidentId);
    }
  };

  return (
    <section className="dashboard-panel timeline-panel-container">
      <div className="panel-header">
        <div className="panel-header-left">
          <h2 className="panel-title">Operational Timeline</h2>
          <span className="panel-counter">{timelineEvents.length}</span>
        </div>
        <span className="panel-tag">Live Stream</span>
      </div>

      <div className="timeline-panel-body">
        {timelineEvents.length === 0 ? (
          <div className="timeline-empty-state">
            <span className="empty-icon">⏱️</span>
            <p className="empty-text">No operational events recorded yet</p>
            <small className="empty-hint">
              Events will derive automatically as incidents are received and dispatched.
            </small>
          </div>
        ) : (
          <div className="timeline-events-list">
            {timelineEvents.map((event) => (
              <div
                key={event.id}
                className="timeline-row"
                onClick={() => handleRowClick(event)}
                title={`Click to focus ${event.zone}`}
              >
                <div className="timeline-time-col">
                  <span className="event-time">{formatEventTime(event.timestamp)}</span>
                </div>

                <div className="timeline-dot-col">
                  <span className={`event-dot ${getEventDotClass(event.type)}`} />
                  <span className="timeline-connector-line" />
                </div>

                <div className="timeline-text-col">
                  <span className="event-text">{event.text}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Timeline;
