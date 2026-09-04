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
 * Renders the product wordmark, Chennai city label, live 1s IST clock,
 * connection status dot, and heatmap toggle button.
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

  const sampleZones = ['Adyar', 'T. Nagar', 'Mylapore', 'Velachery', 'Anna Nagar'];

  return (
    <header className="header-bar">
      <div className="header-brand">
        <div className="header-badge">LIVE OP</div>
        <div className="header-titles">
          <h1 className="header-title">RAKSHAK</h1>
          <span className="header-subtitle">Central City Safety Command &bull; Chennai</span>
        </div>
      </div>

      {onSelectZone && (
        <div className="header-zone-pills">
          <span className="zone-pills-label">Zone:</span>
          <button
            type="button"
            className={`zone-pill ${selectedZone === null ? 'zone-pill--active' : ''}`}
            onClick={() => onSelectZone(null)}
          >
            All
          </button>
          {sampleZones.map((zone) => (
            <button
              key={zone}
              type="button"
              className={`zone-pill ${selectedZone === zone ? 'zone-pill--active' : ''}`}
              onClick={() => onSelectZone(zone)}
            >
              {zone}
            </button>
          ))}
        </div>
      )}

      <div className="header-controls">
        <div className="header-status-indicator">
          <span
            className={`status-dot ${connectionOk ? 'status-dot--online' : 'status-dot--offline'}`}
          />
          <span className="status-label">
            {connectionOk ? 'TELEMETRY ONLINE' : 'CONNECTION WARNING'}
          </span>
        </div>

        <div className="header-clock">
          <span className="clock-timezone">IST</span>
          <span className="clock-value">{istTime}</span>
        </div>

        <button
          type="button"
          className={`btn-heatmap-toggle ${showHeatmap ? 'btn-heatmap-toggle--active' : ''}`}
          onClick={onToggleHeatmap}
          title="Toggle risk heatmap layer"
        >
          <span className="toggle-indicator" />
          Heatmap {showHeatmap ? 'ON' : 'OFF'}
        </button>
      </div>
    </header>
  );
};

export default Header;
