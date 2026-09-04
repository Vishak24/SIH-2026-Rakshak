import L from 'leaflet';
import { Zone, HeatPoint } from '../../lib/types';
import mockPredictions from '@shared/mock/predictions.json';

export interface ZoneLayerOptions {
  map: L.Map;
  onSelectZone: (zoneName: string) => void;
}

// Distance helper
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Map risk score (0-100) to theme token color
function getRiskColor(score: number): string {
  if (score >= 75) return '#ef4444'; // var(--risk-high)
  if (score >= 60) return '#f59e0b'; // var(--risk-elevated)
  if (score >= 40) return '#38bdf8'; // var(--risk-moderate)
  return '#10b981'; // var(--risk-low)
}

export class ZoneLayer {
  private map: L.Map;
  private layerGroup: L.LayerGroup;
  private onSelectZone: (zoneName: string) => void;

  // Track created layers: zone name (lowercase) -> { shape: L.Polygon | L.Circle, label: L.Marker, riskScore: number, isPolygon: boolean }
  private zoneItems = new Map<
    string,
    {
      shape: L.Polygon | L.Circle;
      label: L.Marker;
      riskScore: number;
      zoneName: string;
    }
  >();

  constructor(options: ZoneLayerOptions) {
    this.map = options.map;
    this.onSelectZone = options.onSelectZone;
    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  public update(zones: Zone[], heatData: HeatPoint[], selectedZone: string | null): void {
    const currentZones = zones || [];
    const currentHeat = heatData || [];

    // Clear obsolete layers
    this.layerGroup.clearLayers();
    this.zoneItems.clear();

    for (const zone of currentZones) {
      const isSelected = selectedZone?.toLowerCase() === zone.name.toLowerCase();

      // 1. Determine zone risk score from heatData or mock predictions fallback
      let riskScore = 40;
      const nearbyHeat = currentHeat.filter(
        (pt) => distanceMeters(zone.lat, zone.lng, pt.lat, pt.lng) <= 1800
      );
      if (nearbyHeat.length > 0) {
        // Average weight
        const total = nearbyHeat.reduce((acc, cur) => acc + (cur.weight || 0), 0);
        riskScore = Math.round(total / nearbyHeat.length);
      } else {
        const pred = (mockPredictions as Array<{ zone: string; riskScore: number }>).find(
          (p) => p.zone.toLowerCase() === zone.name.toLowerCase()
        );
        if (pred) {
          riskScore = pred.riskScore;
        }
      }

      const riskColor = getRiskColor(riskScore);
      // Higher risk = more visible fill (0.10 to 0.35)
      const baseFillOpacity = Math.min(0.35, Math.max(0.1, 0.1 + (riskScore / 100) * 0.25));

      // 2. Real polygon vs 1.2km circle fallback
      let shape: L.Polygon | L.Circle;
      const hasPolygon = Array.isArray(zone.polygon) && zone.polygon.length >= 3;

      const strokeColor = isSelected ? '#3b82f6' : '#273b5c';
      const strokeWeight = isSelected ? 3.5 : 1.2;
      const strokeOpacity = isSelected ? 1.0 : 0.7;
      const fillOpacity = isSelected ? Math.min(0.42, baseFillOpacity + 0.12) : baseFillOpacity;

      if (hasPolygon) {
        shape = L.polygon(zone.polygon!, {
          color: strokeColor,
          weight: strokeWeight,
          opacity: strokeOpacity,
          fillColor: isSelected ? '#3b82f6' : riskColor,
          fillOpacity,
          className: isSelected ? 'zone-polygon-selected' : 'zone-polygon',
        });
      } else {
        // Fallback: 1.2km circle drawn around zone centroid
        shape = L.circle([zone.lat, zone.lng], {
          radius: 1200, // 1.2 km
          color: strokeColor,
          weight: strokeWeight,
          opacity: strokeOpacity,
          fillColor: isSelected ? '#3b82f6' : riskColor,
          fillOpacity,
          className: isSelected ? 'zone-circle-selected' : 'zone-circle',
        });
      }

      // 3. Hover highlight (subtle border/fill change on mouseover)
      shape.on('mouseover', () => {
        if (selectedZone?.toLowerCase() !== zone.name.toLowerCase()) {
          shape.setStyle({
            color: '#60a5fa', // lighter border highlight
            weight: 2.2,
            opacity: 0.95,
            fillOpacity: Math.min(0.4, baseFillOpacity + 0.08),
          });
        }
      });

      shape.on('mouseout', () => {
        if (selectedZone?.toLowerCase() !== zone.name.toLowerCase()) {
          shape.setStyle({
            color: '#273b5c',
            weight: 1.2,
            opacity: 0.7,
            fillOpacity: baseFillOpacity,
          });
        }
      });

      // 4. Click handler: calls onSelectZone with that zone's identifier
      shape.on('click', () => {
        this.onSelectZone(zone.name);
      });

      shape.addTo(this.layerGroup);

      // 5. Centered zone name label
      const labelIcon = L.divIcon({
        className: 'zone-map-label-div',
        html: `<div style="
          color: ${isSelected ? '#93c5fd' : '#94a3b8'};
          font-family: var(--font-sans);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-shadow: 0 1px 4px #000, 0 0 8px rgba(0,0,0,0.8);
          pointer-events: none;
          text-align: center;
          white-space: nowrap;
          padding: 2px 6px;
        ">${zone.name}</div>`,
        iconSize: [120, 20],
        iconAnchor: [60, 10],
      });

      const labelMarker = L.marker([zone.lat, zone.lng], {
        icon: labelIcon,
        interactive: false,
        zIndexOffset: 100,
      }).addTo(this.layerGroup);

      this.zoneItems.set(zone.name.toLowerCase(), {
        shape,
        label: labelMarker,
        riskScore,
        zoneName: zone.name,
      });
    }
  }

  public destroy(): void {
    this.layerGroup.clearLayers();
    this.map.removeLayer(this.layerGroup);
    this.zoneItems.clear();
  }
}
