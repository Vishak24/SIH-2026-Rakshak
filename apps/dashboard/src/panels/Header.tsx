import React, { useState, useEffect } from 'react';
import './Header.css';

export interface HeaderProps {
  connectionOk: boolean;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  selectedZone?: string | null;
  onSelectZone?: (zone: string | null) => void;
}

/**
 * Header Component
 * Owned by: Dev A (src/panels/Header.tsx)
 *
 * Renders the primary command bar: product wordmark, live IST clock,
 * telemetry status indicator, zone filter pills, and heatmap toggle.
 */
export const Header: React.FC<HeaderProps> = ({
  connectionOk,
  showHeatmap,
  onToggleHeatmap,
  selectedZone,
  onSelectZone,
}) => {
  const [istTime, setIstTime] = useState<string>('--:--:--');

  // Live clock updating every second in HH:MM:SS format (Asia/Kolkata)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setIstTime(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };

    updateClock();
    const intervalId = setInterval(updateClock, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const availableZones = ['Adyar', 'T. Nagar', 'Mylapore', 'Velachery', 'Anna Nagar'];

  return (
    <header className="command-header">
      {/* 1. Left Brand & Operation Identity */}
      <div className="header-brand-group">
        <div className="brand-shield-icon">
          <span className="radar-sweep" />
          <span className="shield-symbol">🛡️</span>
        </div>
        <div className="brand-text-block">
          <div className="brand-title-row">
            <h1 className="brand-name">RAKSHAK</h1>
            <span className="brand-sub-badge">LIVE OPS</span>
          </div>
          <span className="brand-subtitle">
            Central Safety Command &bull; Chennai Metro
          </span>
        </div>
      </div>

      {/* 2. Center: Sector / Zone Filter Pills */}
      {onSelectZone && (
        <nav className="header-zone-nav" aria-label="Sector Filter">
          <span className="zone-nav-label">Sector:</span>
          <div className="zone-pills-bar">
            <button
              type="button"
              className={`zone-pill-btn ${selectedZone === null ? 'zone-pill-btn--active' : ''}`}
              onClick={() => onSelectZone(null)}
            >
              All Sectors
            </button>
            {availableZones.map((zone) => (
              <button
                key={zone}
                type="button"
                className={`zone-pill-btn ${selectedZone === zone ? 'zone-pill-btn--active' : ''}`}
                onClick={() => onSelectZone(zone)}
              >
                {zone}
              </button>
            ))}
          </div>
        </nav>
      )}

      {/* 3. Right: Telemetry, Clock, and Heatmap Toggle */}
      <div className="header-telemetry-group">
        {/* Connection Status Badge */}
        <div
          className={`telemetry-status-badge ${
            connectionOk ? 'telemetry--online' : 'telemetry--offline'
          }`}
        >
          <span className="telemetry-beacon" />
          <span className="telemetry-text">
            {connectionOk ? 'TELEMETRY ONLINE' : 'DISCONNECTED'}
          </span>
        </div>

        {/* Live IST Monospace Clock */}
        <div className="header-clock-capsule">
          <span className="clock-tz">IST</span>
          <span className="clock-digits">{istTime}</span>
        </div>

        {/* Heatmap Toggle Switch */}
        <button
          type="button"
          className={`heatmap-switch-btn ${showHeatmap ? 'heatmap-switch-btn--active' : ''}`}
          onClick={onToggleHeatmap}
          title="Toggle risk heatmap layer on map"
        >
          <span className="heatmap-switch-knob" />
          <span className="heatmap-switch-label">
            Heatmap <span className="state-tag">{showHeatmap ? 'ON' : 'OFF'}</span>
          </span>
        </button>
      </div>
    </header>
  );
};

export default Header;
