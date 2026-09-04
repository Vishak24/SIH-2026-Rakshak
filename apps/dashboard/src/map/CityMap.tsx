import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Patrol, Incident, Zone, HeatPoint } from '../lib/types';
import patrolRoutesData from './assets/patrol_routes.json';
import { ZoneLayer } from './layers/ZoneLayer';
import { PatrolLayer } from './layers/PatrolLayer';
import { SosLayer } from './layers/SosLayer';
import { HeatLayer } from './layers/HeatLayer';

export interface CityMapProps {
  patrols: Patrol[];
  incidents: Incident[];
  zones: Zone[];
  heatData: HeatPoint[];
  selectedZone: string | null;
  onSelectZone: (zone: string) => void;
  showHeatmap: boolean;
  focusIncidentId: string | null;
}

export const CityMap: React.FC<CityMapProps> = ({
  patrols = [],
  incidents = [],
  zones = [],
  heatData = [],
  selectedZone,
  onSelectZone,
  showHeatmap = false,
  focusIncidentId,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Layer references
  const routeGroupRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<ZoneLayer | null>(null);
  const patrolLayerRef = useRef<PatrolLayer | null>(null);
  const sosLayerRef = useRef<SosLayer | null>(null);
  const heatLayerRef = useRef<HeatLayer | null>(null);

  // 1. Initialize Map, Tile Layer, Beat Polylines, and ResizeObserver
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Chennai centroid: [13.05, 80.22], initial zoom 12
    const map = L.map(mapContainerRef.current, {
      center: [13.05, 80.22],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      minZoom: 10,
      maxZoom: 17,
    });

    // Dark Matter tile layer with resilient error handling
    const cartoDark = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }
    );
    cartoDark.addTo(map);

    // Polish: Position zoom controls at topleft so they never overlap right sidebar panels
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // STRETCH: Faintly draw each patrol's beat route polylines (opacity ~0.15)
    const routeGroup = L.layerGroup().addTo(map);
    routeGroupRef.current = routeGroup;

    patrolRoutesData.forEach((r: { waypoints: number[][] }) => {
      const latlngs: [number, number][] = r.waypoints.map((w: number[]) => [w[0], w[1]] as [number, number]);
      // Close loop back to first point for beat visualization
      if (latlngs.length > 2) {
        latlngs.push([latlngs[0][0], latlngs[0][1]]);
      }
      L.polyline(latlngs, {
        color: '#38bdf8',
        weight: 1.5,
        opacity: 0.16,
        dashArray: '4, 6',
      }).addTo(routeGroup);
    });

    // Instantiate visual layers in proper z-order
    const heatLayer = new HeatLayer({ map });
    heatLayerRef.current = heatLayer;

    const zoneLayer = new ZoneLayer({
      map,
      onSelectZone,
    });
    zoneLayerRef.current = zoneLayer;

    const patrolLayer = new PatrolLayer({ map });
    patrolLayerRef.current = patrolLayer;

    const sosLayer = new SosLayer({
      map,
      patrolLayer,
    });
    sosLayerRef.current = sosLayer;

    mapRef.current = map;

    // Polish: ResizeObserver to invalidateSize whenever grid cell layout changes size
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      routeGroup.clearLayers();
      heatLayer.destroy();
      zoneLayer.destroy();
      sosLayer.destroy();
      patrolLayer.destroy();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Update ZoneLayer on zones, heatData, selectedZone change
  useEffect(() => {
    if (zoneLayerRef.current) {
      zoneLayerRef.current.update(zones, heatData, selectedZone);
    }
  }, [zones, heatData, selectedZone]);

  // 3. Update PatrolLayer on patrols prop poll (every 3s)
  useEffect(() => {
    if (patrolLayerRef.current) {
      patrolLayerRef.current.update(patrols);
    }
  }, [patrols]);

  // 4. Update SosLayer on incidents or focusIncidentId change
  useEffect(() => {
    if (sosLayerRef.current) {
      sosLayerRef.current.update(incidents, focusIncidentId);
    }
  }, [incidents, focusIncidentId]);

  // 5. Update HeatLayer on showHeatmap, heatData, or zones change
  useEffect(() => {
    if (heatLayerRef.current) {
      heatLayerRef.current.update(showHeatmap, heatData, zones);
    }
  }, [showHeatmap, heatData, zones]);

  return (
    <div
      className="city-map-wrapper"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        background: 'var(--bg-app)',
        overflow: 'hidden',
      }}
    >
      {/* Map Leaflet Container - dark background fallback for bad network / tile blocking */}
      <div
        ref={mapContainerRef}
        className="city-map-container"
        style={{
          width: '100%',
          height: '100%',
          background: 'var(--bg-app)',
        }}
      />

      {/* Polish: Map Legend (Bottom-Left corner explaining marker colors and risk bands) */}
      <div
        className="map-legend"
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 900,
          background: 'rgba(11, 17, 28, 0.92)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          boxShadow: 'var(--shadow-md)',
          fontFamily: 'var(--font-sans)',
          backdropFilter: 'blur(8px)',
          pointerEvents: 'auto',
          minWidth: 200,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            marginBottom: 8,
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: 4,
          }}
        >
          MAP OVERLAY
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
          {/* Patrol Statuses */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)' }} />
            <span>Patrol (Patrolling)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent-blue)',
                boxShadow: '0 0 6px var(--accent-blue)',
              }}
            />
            <span>Patrol (En Route)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-amber)' }} />
            <span>Patrol (On Scene)</span>
          </div>

          {/* Citizen SOS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--accent-red)',
                boxShadow: '0 0 8px var(--accent-red)',
              }}
            />
            <span>Citizen SOS Beacon</span>
          </div>

          {/* Dispatch Vector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 14,
                height: 2,
                background: 'var(--accent-blue)',
                display: 'inline-block',
                borderTop: '2px dashed var(--accent-blue)',
              }}
            />
            <span>Dispatch Vector</span>
          </div>

          {/* Zone Risk scale */}
          <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>ZONE RISK SCALE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 6, borderRadius: 2, overflow: 'hidden' }}>
              <span style={{ flex: 1, height: '100%', background: 'var(--risk-low)' }} title="Low (<40)" />
              <span style={{ flex: 1, height: '100%', background: 'var(--risk-moderate)' }} title="Moderate (40-59)" />
              <span style={{ flex: 1, height: '100%', background: 'var(--risk-elevated)' }} title="Elevated (60-74)" />
              <span style={{ flex: 1, height: '100%', background: 'var(--risk-high)' }} title="High (75+)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
