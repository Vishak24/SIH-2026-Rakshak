import L from 'leaflet';
import { Zone, HeatPoint } from '../../lib/types';
import mockPredictions from '@shared/mock/predictions.json';

export interface HeatLayerOptions {
  map: L.Map;
}

function getHeatColor(weight: number): string {
  if (weight >= 75) return '#ef4444'; // var(--risk-high)
  if (weight >= 60) return '#f59e0b'; // var(--risk-elevated)
  if (weight >= 40) return '#38bdf8'; // var(--risk-moderate)
  return '#10b981'; // var(--risk-low)
}

export class HeatLayer {
  private map: L.Map;
  private layerGroup: L.LayerGroup;

  constructor(options: HeatLayerOptions) {
    this.map = options.map;
    this.layerGroup = L.layerGroup().addTo(this.map);
  }

  public update(showHeatmap: boolean, heatData: HeatPoint[], zones: Zone[]): void {
    this.layerGroup.clearLayers();

    if (!showHeatmap) return;

    let pointsToRender: HeatPoint[] = [];

    if (heatData && heatData.length > 0) {
      pointsToRender = heatData;
    } else if (zones && zones.length > 0) {
      // Fallback: generate cluster of 8-15 points jittered within ~800m of zone centroid weighted by predictions
      for (const z of zones) {
        const pred = (mockPredictions as Array<{ zone: string; riskScore: number }>).find(
          (p) => p.zone.toLowerCase() === z.name.toLowerCase()
        );
        const weight = pred ? pred.riskScore : 40;
        const count = 10;

        for (let i = 0; i < count; i++) {
          const angle = (2 * Math.PI * i) / count + (weight % 5);
          const distRatio = 0.25 + 0.65 * ((i * 3) % 7) / 7; // ~200m to 750m
          const rLat = 0.007 * distRatio;
          const rLng = 0.007 * distRatio;

          pointsToRender.push({
            lat: Number((z.lat + rLat * Math.sin(angle)).toFixed(6)),
            lng: Number((z.lng + rLng * Math.cos(angle)).toFixed(6)),
            weight,
          });
        }
      }
    }

    // Render subtle gradient circles with low opacity so patrols and SOS remain prominent
    for (const pt of pointsToRender) {
      const weight = pt.weight || 40;
      const radius = 550 + weight * 6; // 600m - 1100m
      const fillOpacity = Math.min(0.16, Math.max(0.04, 0.03 + (weight / 100) * 0.11));
      const color = getHeatColor(weight);

      L.circle([pt.lat, pt.lng], {
        radius,
        color: 'transparent',
        fillColor: color,
        fillOpacity,
        interactive: false,
      }).addTo(this.layerGroup);
    }
  }

  public destroy(): void {
    this.layerGroup.clearLayers();
    this.map.removeLayer(this.layerGroup);
  }
}
