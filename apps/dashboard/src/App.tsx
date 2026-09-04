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
import {
  Header,
  KpiCards,
  IncidentPanel,
  Timeline,
  AiPanel,
  PatrolStrip,
} from './panels';
import './App.css';

/**
 * Rakshak Central Command — App Shell
 * Owned by: Dev A (src/App.*)
 *
 * Unified hero screen showing:
 * - Header with live IST clock, telemetry status, zone selector, and heatmap toggle
 * - KpiCards: Active Incidents, Patrols Available, Avg Response Time, City Risk
 * - Interactive Map Slot (waiting for Dev B CityMap)
 * - IncidentPanel: Live cards with ticking ETAs, optimistic resolution, and zone sync
 * - Operational Timeline: Real-time derived events stream with 250ms slide-ins
 * - AiPanel: Live operational risk model (0-100), contribution bars, model telemetry, and tactical narrative
 * - PatrolStrip: 10-unit fleet status with dispatched incident links
 */
export const App: React.FC = () => {
  // State shape required by contract:
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

  return (
    <div className="rakshak-shell">
      {/* 1. Command Header Bar */}
      <Header
        connectionOk={connectionOk}
        showHeatmap={showHeatmap}
        onToggleHeatmap={handleToggleHeatmap}
        selectedZone={selectedZone}
        onSelectZone={handleSelectZone}
      />

      {/* 2. Main Two-Column Area */}
      <main className="main-content">
        {/* Left Column: Map Slot (Single one-line swap with Dev B's <CityMap />) */}
        <section className="map-column">
          <div className="map-slot">
            {/* Tactical Grid Background & Overlay Lines */}
            <div className="tactical-grid-bg" />

            {/* Corner Brackets */}
            <div className="hud-corner hud-corner--tl" />
            <div className="hud-corner hud-corner--tr" />
            <div className="hud-corner hud-corner--bl" />
            <div className="hud-corner hud-corner--br" />

            {/* Top HUD Telemetry Bar */}
            <div className="map-hud-bar map-hud-bar--top">
              <div className="hud-badge hud-badge--left">
                <span className="hud-dot" />
                <span className="hud-text">
                  CHENNAI METRO TACTICAL GRID &bull; SECTOR:{' '}
                  <strong>{selectedZone ? selectedZone.toUpperCase() : 'ALL SECTORS'}</strong>
                </span>
              </div>
              <div className="hud-badge hud-badge--right">
                <span className="hud-text">
                  GPS: 13.0827&deg;N, 80.2707&deg;E &bull; REFRESH 3.0s
                </span>
              </div>
            </div>

            {/* Center Tactical Reticle / Dev B Mount Placeholder */}
            <div className="map-tactical-center">
              <div className="radar-orbit radar-orbit--outer">
                <div className="radar-sweep-beam" />
              </div>
              <div className="radar-orbit radar-orbit--inner" />
              <div className="target-reticle" />

              <div className="map-center-readout">
                <span className="map-status-lead">TACTICAL MAP ENGINE</span>
                <span className="map-status-sub">
                  Dev B &lt;CityMap /&gt; Mount Slot Active
                </span>
                {focusIncidentId && (
                  <span className="map-focus-pill">
                    🎯 TARGET FOCUS: #{focusIncidentId.slice(-6)}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom HUD Telemetry Bar */}
            <div className="map-hud-bar map-hud-bar--bottom">
              <div className="hud-badge hud-badge--left">
                <span className="hud-text">
                  FLEET SENSORS: 10/10 DEPLOYED &bull; AI PREDICTIVE MAPPING ACTIVE
                </span>
              </div>
              <div className="hud-badge hud-badge--right">
                <span className="hud-scale-mark">[ &mdash;&mdash; 2.5 KM &mdash;&mdash; ]</span>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Stacked Command Panels */}
        <aside className="panel-column">
          {/* Live KPI Cards with 300ms count-up/down animations */}
          <KpiCards
            incidents={incidents}
            patrols={patrols}
            predictions={predictions}
          />

          {/* Active Incidents Panel (Task A3) */}
          <div className="panel-wrapper panel-wrapper--incidents">
            <IncidentPanel
              incidents={incidents}
              selectedZone={selectedZone}
              focusIncidentId={focusIncidentId}
              onFocusIncident={setFocusIncidentId}
              onSelectZone={handleSelectZone}
            />
          </div>

          {/* Operational Timeline Panel (Task A4) */}
          <div className="panel-wrapper panel-wrapper--timeline">
            <Timeline
              incidents={incidents}
              onSelectZone={handleSelectZone}
              onFocusIncident={setFocusIncidentId}
            />
          </div>

          {/* AI Predictive Risk Panel (Task A5) */}
          <div className="panel-wrapper panel-wrapper--ai">
            <AiPanel
              predictions={predictions}
              incidents={incidents}
              patrols={patrols}
              selectedZone={selectedZone}
              aiSummary={aiSummary}
              onSelectZone={handleSelectZone}
            />
          </div>
        </aside>
      </main>

      {/* 3. Patrol Fleet Status Strip (Task A6) */}
      <PatrolStrip
        patrols={patrols}
        focusIncidentId={focusIncidentId}
        onFocusIncident={setFocusIncidentId}
      />
    </div>
  );
};

export default App;
