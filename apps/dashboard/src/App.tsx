import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  getPatrols,
  getIncidents,
  getPredictions,
  getAiSummary,
  Patrol,
  Incident,
  Prediction,
  AiSummary,
} from './api/client';
import './App.css';

/**
 * Rakshak Central Command — App Shell
 * Owned by: Dev A (src/App.*)
 *
 * Manages the unified polling loop, top-level state, and responsive command layout.
 */
export const App: React.FC = () => {
  // Exact state shape required by contract:
  // { patrols, incidents, predictions, selectedZone, showHeatmap, aiSummary, serverTime, connectionOk }
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [serverTime, setServerTime] = useState<number | null>(null);
  const [connectionOk, setConnectionOk] = useState<boolean>(true);

  // Focus incident state (part of the shared CityMap contract)
  const [focusIncidentId, setFocusIncidentId] = useState<string | null>(null);

  // Per-zone AI Summary cache: keyed by zone name -> { data, expiresAt }
  const aiCacheRef = useRef<Map<string, { data: AiSummary; expiresAt: number }>>(
    new Map()
  );

  // Local clock formatted as HH:MM:SS for the command header
  const [clockTime, setClockTime] = useState<string>('--:--:--');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockTime(
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
    const clockInterval = setInterval(updateClock, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  /**
   * Main 3000ms polling loop:
   * Calls getPatrols() and getIncidents() together via Promise.allSettled.
   * Keeps last-known-good data if both fail, and marks connectionOk accordingly.
   */
  useEffect(() => {
    let isMounted = true;

    const pollLiveTelemetry = async () => {
      try {
        const [patrolsResult, incidentsResult] = await Promise.allSettled([
          getPatrols(),
          getIncidents(),
        ]);

        if (!isMounted) return;

        const isPatrolsFulfilled = patrolsResult.status === 'fulfilled';
        const isIncidentsFulfilled = incidentsResult.status === 'fulfilled';

        if (isPatrolsFulfilled) {
          setPatrols(patrolsResult.value.patrols);
          if (patrolsResult.value.serverTime) {
            setServerTime(patrolsResult.value.serverTime);
          }
        }

        if (isIncidentsFulfilled) {
          setIncidents(incidentsResult.value.incidents);
          if (incidentsResult.value.serverTime) {
            setServerTime(incidentsResult.value.serverTime);
          }
        }

        if (isPatrolsFulfilled || isIncidentsFulfilled) {
          setConnectionOk(true);
        } else {
          // Both calls failed in this tick: mark offline but NEVER clear existing state
          setConnectionOk(false);
          console.warn('[Rakshak Poller] Both live telemetry endpoints failed in this tick. Retaining last-known data.');
        }
      } catch (err) {
        if (!isMounted) return;
        setConnectionOk(false);
        console.error('[Rakshak Poller] Unexpected polling cycle error:', err);
      }
    };

    // Execute immediately on mount
    pollLiveTelemetry();

    // Re-poll every 3000ms
    const pollInterval = setInterval(pollLiveTelemetry, 3000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, []);

  /**
   * Predictions: fetched once on mount and then again every 5 minutes (300,000ms)
   */
  useEffect(() => {
    let isMounted = true;

    const fetchPredictions = async () => {
      try {
        const data = await getPredictions();
        if (isMounted) {
          if (Array.isArray(data)) {
            setPredictions(data);
          } else {
            setPredictions([data]);
          }
        }
      } catch (err) {
        console.error('[Rakshak Predictions] Failed to load predictions:', err);
      }
    };

    fetchPredictions();
    const predInterval = setInterval(fetchPredictions, 300000);

    return () => {
      isMounted = false;
      clearInterval(predInterval);
    };
  }, []);

  /**
   * AI Summary: fetched when selectedZone changes.
   * Cached per-zone for 60 seconds to avoid refetching on rapid toggle.
   */
  const fetchAiSummaryForZone = useCallback(async (zone: string | null) => {
    const targetKey = zone || '__DEFAULT__';
    const cached = aiCacheRef.current.get(targetKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      setAiSummary(cached.data);
      return;
    }

    try {
      const summary = await getAiSummary(zone);
      aiCacheRef.current.set(targetKey, {
        data: summary,
        expiresAt: now + 60000, // 60s TTL
      });
      setAiSummary(summary);
    } catch (err) {
      console.error('[Rakshak AI] Failed to fetch AI summary:', err);
    }
  }, []);

  useEffect(() => {
    fetchAiSummaryForZone(selectedZone);
  }, [selectedZone, fetchAiSummaryForZone]);

  // Handler to toggle heatmap via Header button
  const handleToggleHeatmap = () => {
    setShowHeatmap((prev) => !prev);
  };

  // Handler for zone selection (shared contract with CityMap onSelectZone)
  const handleSelectZone = (zone: string | null) => {
    setSelectedZone((prev) => (prev === zone ? null : zone));
  };

  // Quick zone list for testing zone selection interaction in shell
  const availableZones = ['Adyar', 'T. Nagar', 'Mylapore', 'Velachery', 'Anna Nagar'];

  return (
    <div className="rakshak-shell">
      {/* 1. Header Bar across the top */}
      <header className="header-bar">
        <div className="header-brand">
          <div className="header-badge">LIVE OP</div>
          <div className="header-titles">
            <h1 className="header-title">RAKSHAK</h1>
            <span className="header-subtitle">Central City Safety Command &bull; Chennai</span>
          </div>
        </div>

        {/* Zone Selector Pills for testing lifted onSelectZone state */}
        <div className="header-zone-pills">
          <span className="zone-pills-label">Zone:</span>
          <button
            type="button"
            className={`zone-pill ${selectedZone === null ? 'zone-pill--active' : ''}`}
            onClick={() => handleSelectZone(null)}
          >
            All
          </button>
          {availableZones.map((z) => (
            <button
              key={z}
              type="button"
              className={`zone-pill ${selectedZone === z ? 'zone-pill--active' : ''}`}
              onClick={() => handleSelectZone(z)}
            >
              {z}
            </button>
          ))}
        </div>

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
            <span className="clock-value">{clockTime}</span>
          </div>

          <button
            type="button"
            className={`btn-heatmap-toggle ${showHeatmap ? 'btn-heatmap-toggle--active' : ''}`}
            onClick={handleToggleHeatmap}
            title="Toggle risk heatmap layer"
          >
            <span className="toggle-indicator" />
            Heatmap {showHeatmap ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {/* 2. Main Two-Column Area */}
      <main className="main-content">
        {/* Left Column: Map Slot (Single one-line swap with Dev B's <CityMap />) */}
        <section className="map-column">
          <div className="map-slot">
            <div className="map-loading-indicator">
              <div className="pulse-ring" />
              <span>Map loading…</span>
              <small className="map-hint">
                Dev B CityMap contract mounted here &bull; Active Zone: {selectedZone || 'All Zones'}
                {focusIncidentId ? ` &bull; Focus ID: ${focusIncidentId}` : ''}
              </small>
            </div>
          </div>
        </section>

        {/* Right Column: Stacked Panels */}
        <aside className="panel-column">
          {/* Active Incidents Panel Placeholder */}
          <section className="dashboard-panel panel-incidents">
            <div className="panel-header">
              <h2 className="panel-title">Active Incidents</h2>
              <span className="panel-counter">{incidents.length}</span>
            </div>
            <div className="panel-placeholder-body">
              <span className="placeholder-text">
                Active Incidents content container (Task A3) &bull; {incidents.length} Live Incidents Polled
              </span>
            </div>
          </section>

          {/* Timeline Panel Placeholder */}
          <section className="dashboard-panel panel-timeline">
            <div className="panel-header">
              <h2 className="panel-title">Operational Timeline</h2>
              <span className="panel-tag">
                {serverTime ? `Synced ${new Date(serverTime).toLocaleTimeString('en-IN')}` : 'Real-time'}
              </span>
            </div>
            <div className="panel-placeholder-body">
              <span className="placeholder-text">Timeline content container (Task A4)</span>
            </div>
          </section>

          {/* AI Risk Panel Placeholder */}
          <section className="dashboard-panel panel-ai-risk">
            <div className="panel-header">
              <h2 className="panel-title">AI Predictive Risk</h2>
              <span className="panel-tag">
                {selectedZone ? `Zone: ${selectedZone}` : 'Citywide'} ({predictions.length} Models)
              </span>
            </div>
            <div className="panel-placeholder-body">
              <span className="placeholder-text">
                {aiSummary ? aiSummary.text : 'AI Risk content container (Task A5)'}
              </span>
            </div>
          </section>
        </aside>
      </main>

      {/* 3. Patrol Availability Strip along the bottom */}
      <footer className="patrol-strip-bar">
        <div className="patrol-strip-header">
          <h3 className="patrol-strip-title">Patrol Fleet Status</h3>
          <span className="patrol-count-badge">{patrols.length} Units Deployed</span>
        </div>
        <div className="patrol-strip-slot">
          <span className="placeholder-text">
            Patrol Availability strip container (Task A6) &bull;{' '}
            {patrols.filter((p) => p.status === 'PATROLLING').length} of {patrols.length} Available
          </span>
        </div>
      </footer>
    </div>
  );
};

export default App;
