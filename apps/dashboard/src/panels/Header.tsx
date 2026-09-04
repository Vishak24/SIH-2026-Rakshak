import React, { useState, useEffect } from 'react';
import { Shield, Layers, Radio } from 'lucide-react';
import { simulator } from '../map/sim/simulator';

interface HeaderProps {
  connectionOk: boolean;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionOk,
  showHeatmap,
  onToggleHeatmap,
}) => {
  const [istTime, setIstTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Format as IST time (Asia/Kolkata)
      const formatted = now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setIstTime(formatted);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTriggerTestSos = () => {
    // Fire test SOS at T Nagar or nearby coordinates
    const testPoints = [
      { lat: 13.0418, lng: 80.2341, zone: 'T Nagar', name: 'Divya Krishnan' },
      { lat: 13.085, lng: 80.2101, zone: 'Anna Nagar', name: 'Kavitha Nathan' },
      { lat: 13.0339, lng: 80.2677, zone: 'Mylapore', name: 'Saravanan M' },
      { lat: 13.0012, lng: 80.2565, zone: 'Adyar', name: 'Shanthi Rao' },
    ];
    const pt = testPoints[Math.floor(Math.random() * testPoints.length)];
    simulator.fireSos(pt.lat, pt.lng, pt.zone, pt.name);
  };

  return (
    <header className="command-header">
      <div className="header-left">
        <div className="brand-badge">
          <Shield className="brand-icon" size={20} />
          <span className="brand-title">RAKSHAK COMMAND</span>
        </div>
        <div className="city-pill">
          <span className="city-dot"></span>
          <span className="city-name">Chennai City Police</span>
        </div>
        <div className="clock-badge font-mono">
          <span className="clock-time">{istTime || '13:42:00'}</span>
          <span className="clock-tz">IST</span>
        </div>
      </div>

      <div className="header-right">
        <div
          className={`status-pill ${connectionOk ? 'status-online' : 'status-reconnecting'}`}
          title={connectionOk ? 'Telemetry polling active (3s)' : 'Polling retrying...'}
        >
          <span className="status-indicator-dot"></span>
          <span className="status-label">{connectionOk ? 'LIVE' : 'RETRYING'}</span>
        </div>

        <button
          className={`heatmap-toggle-btn ${showHeatmap ? 'active' : ''}`}
          onClick={onToggleHeatmap}
          title="Toggle AI predictive crime risk heatmap"
        >
          <Layers size={15} />
          <span>Heatmap</span>
        </button>

        <button
          className="demo-trigger-btn"
          onClick={handleTriggerTestSos}
          title="Simulate random citizen SOS beacon"
        >
          <Radio size={14} className="animate-pulse" />
          <span>Test SOS</span>
        </button>
      </div>
    </header>
  );
};
