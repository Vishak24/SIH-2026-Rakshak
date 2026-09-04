import React from 'react';
import { Clock, History } from 'lucide-react';
import { TimelineEvent } from '../lib/types';

interface TimelineProps {
  events: TimelineEvent[];
}

export const Timeline: React.FC<TimelineProps> = ({ events }) => {
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <section className="timeline-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <History size={15} className="text-accent-blue" />
          <h2 className="panel-title">TIMELINE</h2>
        </div>
        <span className="event-count-pill font-mono">{events.length}</span>
      </div>

      <div className="timeline-list">
        {events.length === 0 ? (
          <div className="timeline-empty-state">
            <Clock size={20} className="text-muted" />
            <span>No dispatch events logged</span>
          </div>
        ) : (
          events.map((ev, index) => (
            <div
              key={ev.id}
              className="timeline-row animate-slide-in"
              style={{ animationDelay: `${Math.min(index * 25, 200)}ms` }}
            >
              <span className="timeline-time font-mono">{formatTime(ev.timestamp)}</span>
              <span
                className="timeline-dot"
                style={{ backgroundColor: ev.color, boxShadow: `0 0 6px ${ev.color}` }}
              ></span>
              <span className="timeline-text">{ev.text}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
