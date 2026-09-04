import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Patrol, Incident, Prediction, AiSummary, HeatPoint, Zone } from './lib/types';
import { getPatrols, getIncidents, resolveIncident, getPredictions, getAiSummary } from './api/client';
import { deriveTimeline } from './lib/derive';
import { Header } from './panels/Header';
import { KpiCards } from './panels/KpiCards';
import { IncidentPanel } from './panels/IncidentPanel';
import { Timeline } from './panels/Timeline';
import { AiPanel } from './panels/AiPanel';
import { PatrolStrip } from './panels/PatrolStrip';
import { CityMap } from './map/CityMap';
import { MapPlayground } from './map/dev/MapPlayground';
import zonesData from '@shared/routes/zones.json';
import './App.css';

export const App: React.FC = () => {
  const isPlayground =
    typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/map-dev') || window.location.search.includes('map-dev'));

  if (isPlayground) {
    return <MapPlayground />;
  }

  // Top-level State per §3
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('T Nagar');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<AiSummary | null>(null);
  const [, setServerTime] = useState<number>(Date.now());
  const [connectionOk, setConnectionOk] = useState<boolean>(true);
  const [focusIncidentId, setFocusIncidentId] = useState<string | null>('SOS-4921');

  const zones: Zone[] = useMemo(() => zonesData as Zone[], []);

  // 1. Initial Predictions load & 5-minute periodic poll
  useEffect(() => {
    let isMounted = true;
    const loadPredictions = async () => {
      try {
        const preds = await getPredictions();
        if (isMounted && preds.length > 0) {
          setPredictions(preds);
          // Default selected zone to highest risk zone if not yet interacted
          const highestRiskZone = [...preds].sort((a, b) => b.riskScore - a.riskScore)[0];
          if (highestRiskZone) {
            setSelectedZone(highestRiskZone.zone);
          }
        }
      } catch (err) {
        console.error('Failed to load predictions:', err);
      }
    };

    loadPredictions();
    const predInterval = setInterval(loadPredictions, 300000); // 5 minutes
    return () => {
      isMounted = false;
      clearInterval(predInterval);
    };
  }, []);

  // 2. Fetch AI summary on selectedZone change (cached 60s inside client)
  useEffect(() => {
    let isMounted = true;
    const fetchSummary = async () => {
      try {
        const summary = await getAiSummary(selectedZone, predictions);
        if (isMounted) {
          setAiSummary(summary);
        }
      } catch (err) {
        console.error('Failed to load AI summary:', err);
      }
    };
    fetchSummary();
    return () => {
      isMounted = false;
    };
  }, [selectedZone, predictions]);

  // 3. Central 3-second poller via Promise.allSettled (§4)
  useEffect(() => {
    let isMounted = true;

    const pollTelemetry = async () => {
      try {
        const [patrolsResult, incidentsResult] = await Promise.allSettled([
          getPatrols(),
          getIncidents(),
        ]);

        let pollSuccessful = false;

        if (patrolsResult.status === 'fulfilled') {
          pollSuccessful = true;
          if (isMounted) {
            setPatrols(patrolsResult.value.patrols);
            setServerTime(patrolsResult.value.serverTime);
          }
        } else {
          console.warn('[Poller] Patrols fetch error:', patrolsResult.reason);
        }

        if (incidentsResult.status === 'fulfilled') {
          pollSuccessful = true;
          if (isMounted) {
            setIncidents(incidentsResult.value.incidents);
            setServerTime(incidentsResult.value.serverTime);
          }
        } else {
          console.warn('[Poller] Incidents fetch error:', incidentsResult.reason);
        }

        if (isMounted) {
          setConnectionOk(pollSuccessful);
        }
      } catch (err) {
        console.error('[Poller] Unexpected poll error:', err);
        if (isMounted) {
          setConnectionOk(false);
        }
      }
    };

    // Initial immediate poll
    pollTelemetry();
    const interval = setInterval(pollTelemetry, 3000); // 3 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 4. Resolve Incident handler
  const handleResolveIncident = useCallback(async (id: string) => {
    try {
      // Optimistic update
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === id ? { ...inc, status: 'RESOLVED', resolvedAt: Date.now() } : inc))
      );
      await resolveIncident(id);
    } catch (err) {
      console.error('Resolve incident failed:', err);
    }
  }, []);

  // 5. Focus Incident & Zone
  const handleFocusIncident = useCallback((id: string, zone: string) => {
    setFocusIncidentId(id);
    setSelectedZone(zone);
  }, []);

  // 6. Select Zone
  const handleSelectZone = useCallback((zone: string) => {
    setSelectedZone(zone);
  }, []);

  // 7. Toggle Heatmap
  const handleToggleHeatmap = useCallback(() => {
    setShowHeatmap((prev) => !prev);
  }, []);

  // 8. Derived Timeline events (survives refresh)
  const timelineEvents = useMemo(() => deriveTimeline(incidents), [incidents]);

  // 9. Derive Heat points for HeatLayer (cluster of 10-12 points ±800m around each zone centroid)
  const heatPoints = useMemo(() => {
    const pts: HeatPoint[] = [];
    for (const z of zones) {
      const pred = predictions.find((p) => p.zone.toLowerCase() === z.name.toLowerCase());
      const weight = pred ? pred.riskScore : 40;

      // Seeded jitter points
      for (let i = 0; i < 10; i++) {
        const angle = (2 * Math.PI * i) / 10 + (weight % 7);
        const distRatio = 0.3 + 0.6 * ((i * 3) % 5) * 0.2; // 0.3 to 0.9 of 800m
        const rLat = (0.007 * distRatio);
        const rLng = (0.007 * distRatio);

        pts.push({
          lat: Number((z.lat + rLat * Math.sin(angle)).toFixed(6)),
          lng: Number((z.lng + rLng * Math.cos(angle)).toFixed(6)),
          weight,
        });
      }
    }
    return pts;
  }, [zones, predictions]);

  return (
    <div className="rakshak-app-container">
      {/* Top Header */}
      <Header
        connectionOk={connectionOk}
        showHeatmap={showHeatmap}
        onToggleHeatmap={handleToggleHeatmap}
      />

      {/* KPI Cards Row */}
      <KpiCards
        incidents={incidents}
        patrols={patrols}
        predictions={predictions}
      />

      {/* Main Command Workspace */}
      <main className="command-workspace-grid">
        {/* Left / Center: Chennai City Map */}
        <div className="map-panel-cell">
          <CityMap
            patrols={patrols}
            incidents={incidents}
            zones={zones}
            heatData={heatPoints}
            selectedZone={selectedZone}
            onSelectZone={handleSelectZone}
            showHeatmap={showHeatmap}
            focusIncidentId={focusIncidentId}
          />
        </div>

        {/* Right Stack: Incidents, Timeline, AI Risk */}
        <aside className="sidebar-panels-cell">
          <IncidentPanel
            incidents={incidents}
            onResolve={handleResolveIncident}
            onFocusIncident={handleFocusIncident}
            selectedIncidentId={focusIncidentId}
          />

          <Timeline events={timelineEvents} />

          <AiPanel
            selectedZone={selectedZone}
            onSelectZone={handleSelectZone}
            predictions={predictions}
            incidents={incidents}
            patrols={patrols}
            aiSummary={aiSummary}
          />
        </aside>
      </main>

      {/* Bottom: Patrol Fleet Availability Strip */}
      <PatrolStrip
        patrols={patrols}
        onFocusPatrol={handleFocusIncident}
      />
    </div>
  );
};

export default App;
