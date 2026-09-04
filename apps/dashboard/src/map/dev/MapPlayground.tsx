import React, { useState, useEffect } from 'react';
import { CityMap } from '../CityMap';
import { simulator } from '../sim/simulator';
import { Patrol, Incident, HeatPoint, Zone } from '../../lib/types';
import zonesData from '../assets/zones.json';
import { Radio, RotateCcw, Layers, ArrowLeft, ShieldAlert } from 'lucide-react';

export const MapPlayground: React.FC = () => {
  const [patrols, setPatrols] = useState<Patrol[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('T Nagar');
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);
  const [focusIncidentId, setFocusIncidentId] = useState<string | null>(null);

  const zones = zonesData as Zone[];

  // 3s poll from simulator
  useEffect(() => {
    const poll = () => {
      setPatrols(simulator.getPatrols().patrols);
      setIncidents(simulator.getIncidents().incidents);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  // Derived heatmap data around zones for development visualization
  const heatPoints: HeatPoint[] = zones.flatMap((z) => {
    return Array.from({ length: 8 }, () => ({
      lat: z.lat + (Math.random() - 0.5) * 0.012,
      lng: z.lng + (Math.random() - 0.5) * 0.012,
      weight: 45 + Math.floor(Math.random() * 45),
    }));
  });

  // Fire SOS at a randomly chosen zone's centroid using window.__sim.fireSos()
  const handleFireRandomSos = () => {
    if (zones.length === 0) return;
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const targetLat = randomZone.lat;
    const targetLng = randomZone.lng;

    let fired: Incident;
    const winSim = typeof window !== 'undefined' ? (window as unknown as { __sim?: typeof simulator }).__sim : undefined;
    if (winSim && typeof winSim.fireSos === 'function') {
      fired = winSim.fireSos(targetLat, targetLng);
    } else {
      fired = simulator.fireSos(targetLat, targetLng);
    }

    setFocusIncidentId(fired.id);
    setSelectedZone(randomZone.name);
    // Update state immediately
    setPatrols(simulator.getPatrols().patrols);
    setIncidents(simulator.getIncidents().incidents);
  };

  const handleReset = () => {
    const winSim = typeof window !== 'undefined' ? (window as unknown as { __sim?: typeof simulator }).__sim : undefined;
    if (winSim && typeof winSim.reset === 'function') {
      winSim.reset();
    } else {
      simulator.reset();
    }
    setPatrols(simulator.getPatrols().patrols);
    setIncidents(simulator.getIncidents().incidents);
    setFocusIncidentId(null);
  };

  const activeIncidents = incidents.filter((i) => i.status !== 'RESOLVED');

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-app)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      {/* Playground Header */}
      <header
        style={{
          height: 52,
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          color: 'var(--text-primary)',
          zIndex: 1000,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--accent-blue)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Central Command
          </a>
          <span style={{ color: 'var(--border-medium)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={18} color="var(--accent-blue)" />
            <span
              style={{
                fontWeight: 700,
                letterSpacing: '0.05em',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            >
              DEV PLAYGROUND (/map-dev)
            </span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            Patrols: {patrols.length}/10 · Active SOS: {activeIncidents.length}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => setShowHeatmap(!showHeatmap)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: showHeatmap ? 'var(--accent-blue-glow)' : 'var(--bg-card)',
              border: `1px solid ${showHeatmap ? 'var(--border-active)' : 'var(--border-subtle)'}`,
              color: showHeatmap ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              transition: 'all 0.15s ease',
            }}
          >
            <Layers size={14} /> Heatmap: {showHeatmap ? 'ON' : 'OFF'}
          </button>

          <button
            type="button"
            id="btn-fire-sos"
            onClick={handleFireRandomSos}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--accent-red-glow)',
              border: '1px solid var(--accent-red)',
              color: 'var(--text-primary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              boxShadow: 'var(--shadow-glow-red)',
              transition: 'all 0.15s ease',
            }}
          >
            <Radio size={14} /> Fire SOS (Random Zone Centroid)
          </button>

          <button
            type="button"
            id="btn-reset-sim"
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
          >
            <RotateCcw size={14} /> Reset Sim
          </button>
        </div>
      </header>

      {/* CityMap presentation container */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: 'calc(100vh - 52px)' }}>
        <CityMap
          patrols={patrols}
          incidents={incidents}
          zones={zones}
          heatData={heatPoints}
          selectedZone={selectedZone}
          onSelectZone={(z) => setSelectedZone(z)}
          showHeatmap={showHeatmap}
          focusIncidentId={focusIncidentId}
        />
      </div>
    </div>
  );
};
