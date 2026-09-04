import L from 'leaflet';
import { Incident } from '../../lib/types';
import { PatrolLayer } from './PatrolLayer';

export interface SosLayerOptions {
  map: L.Map;
  patrolLayer: PatrolLayer;
}

// Generate Red Emergency DivIcon with optional expanding pulse-ring
function createSosDivIcon(isArrived: boolean): L.DivIcon {
  const html = `
    <div class="sos-pulse-marker ${isArrived ? 'sos-arrived' : ''}">
      ${!isArrived ? '<div class="sos-pulse-ring"></div>' : ''}
      <div class="sos-core-dot"></div>
    </div>
  `;
  return L.divIcon({
    className: 'custom-sos-div-icon',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function formatEta(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export class SosLayer {
  private map: L.Map;
  private patrolLayer: PatrolLayer;
  private layerGroup: L.LayerGroup;

  // Track SOS markers: incident id -> L.Marker
  private sosMarkers = new Map<string, L.Marker>();

  // Track dispatch vector lines & midpoint ETA markers: patrolId -> { line: L.Polyline, etaMarker: L.Marker, incidentId: string }
  private dispatchVectors = new Map<
    string,
    {
      line: L.Polyline;
      etaMarker: L.Marker;
      incidentId: string;
    }
  >();

  // Track last focused incident ID to flyTo only once on change
  private lastFocusedIncidentId: string | null = null;

  // Cache current active incidents for frame-by-frame vector updates
  private currentIncidents: Incident[] = [];

  constructor(options: SosLayerOptions) {
    this.map = options.map;
    this.patrolLayer = options.patrolLayer;
    this.layerGroup = L.layerGroup().addTo(this.map);

    // Subscribe to PatrolLayer rAF tween ticks so dispatch line tracks moving patrol in real time
    this.patrolLayer.onTweenTick = () => {
      this.updateDispatchLinePositions();
    };
  }

  // Real-time update of polyline endpoints & midpoint badge to follow moving patrol
  private updateDispatchLinePositions(): void {
    this.dispatchVectors.forEach((item, patrolId) => {
      const livePos = this.patrolLayer.getLivePosition(patrolId);
      if (!livePos) return;

      const inc = this.currentIncidents.find((i) => i.id === item.incidentId);
      if (!inc) return;

      // Update line from live patrol position to incident
      item.line.setLatLngs([
        [livePos.lat, livePos.lng],
        [inc.lat, inc.lng],
      ]);

      // Update midpoint ETA badge position
      const midLat = (livePos.lat + inc.lat) / 2;
      const midLng = (livePos.lng + inc.lng) / 2;
      item.etaMarker.setLatLng([midLat, midLng]);
    });
  }

  public update(incidents: Incident[], focusIncidentId: string | null): void {
    const activeIncidents = (incidents || []).filter((i) => i.status !== 'RESOLVED');
    this.currentIncidents = incidents || [];
    const activeIds = new Set(activeIncidents.map((i) => i.id));

    // 1. Handle RESOLVED incidents: fade out over ~1 second then remove from DOM
    this.sosMarkers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        const el = marker.getElement();
        if (el) {
          el.style.transition = 'opacity 1s ease-out';
          el.style.opacity = '0';
        }
        setTimeout(() => {
          this.layerGroup.removeLayer(marker);
          this.sosMarkers.delete(id);
        }, 1000);
      }
    });

    // Clean up dispatch vectors for inactive/resolved incidents
    const activeAssignedPatrolIds = new Set(
      activeIncidents.filter((i) => i.assignedPatrolId).map((i) => i.assignedPatrolId!)
    );
    this.dispatchVectors.forEach((item, patrolId) => {
      if (!activeAssignedPatrolIds.has(patrolId)) {
        this.layerGroup.removeLayer(item.line);
        this.layerGroup.removeLayer(item.etaMarker);
        this.dispatchVectors.delete(patrolId);
      }
    });

    // 2. Render / Update active emergency markers
    for (const inc of activeIncidents) {
      const isArrived = inc.status === 'ARRIVED';
      let marker = this.sosMarkers.get(inc.id);

      if (!marker) {
        // Create new SOS beacon
        const icon = createSosDivIcon(isArrived);
        marker = L.marker([inc.lat, inc.lng], {
          icon,
          zIndexOffset: 1000,
        }).addTo(this.layerGroup);

        marker.bindPopup(
          `<div style="font-family: var(--font-sans); font-size: 12px; line-height: 1.4; color: var(--text-primary);">
            <div style="font-weight: 800; color: #ef4444; margin-bottom: 2px;">EMERGENCY SOS: ${inc.id}</div>
            <div><strong>Citizen:</strong> ${inc.citizenName}</div>
            <div><strong>Zone:</strong> ${inc.zone}</div>
            <div><strong>Status:</strong> <span style="font-weight: 700; color: ${
              inc.status === 'EN_ROUTE' ? '#60a5fa' : inc.status === 'ARRIVED' ? '#fbbf24' : '#ef4444'
            }">${inc.status}</span></div>
            ${inc.assignedPatrolId ? `<div><strong>Assigned:</strong> ${inc.assignedPatrolId}</div>` : ''}
            ${inc.etaSeconds != null ? `<div><strong>ETA:</strong> ${formatEta(inc.etaSeconds)}</div>` : ''}
          </div>`
        );

        this.sosMarkers.set(inc.id, marker);
      } else {
        // Update marker icon in place (pulse ring stops if ARRIVED)
        marker.setIcon(createSosDivIcon(isArrived));
        marker.setLatLng([inc.lat, inc.lng]);
      }

      // 3. Dispatch Vector: Dashed line from assigned patrol's CURRENT tweened position
      if (inc.assignedPatrolId) {
        const patrolId = inc.assignedPatrolId;
        const livePos = this.patrolLayer.getLivePosition(patrolId) || { lat: inc.lat, lng: inc.lng };
        let vector = this.dispatchVectors.get(patrolId);

        const etaFormatted = formatEta(inc.etaSeconds);
        const etaBadgeIcon = L.divIcon({
          className: 'eta-badge-container',
          html: `<div class="eta-midpoint-badge">${etaFormatted}</div>`,
          iconSize: [52, 20],
          iconAnchor: [26, 10],
        });

        const midLat = (livePos.lat + inc.lat) / 2;
        const midLng = (livePos.lng + inc.lng) / 2;

        if (!vector) {
          const line = L.polyline(
            [
              [livePos.lat, livePos.lng],
              [inc.lat, inc.lng],
            ],
            {
              color: '#3b82f6',
              weight: 2.5,
              opacity: 0.85,
              dashArray: '6, 8',
            }
          ).addTo(this.layerGroup);

          const etaMarker = L.marker([midLat, midLng], {
            icon: etaBadgeIcon,
            interactive: false,
            zIndexOffset: 800,
          }).addTo(this.layerGroup);

          this.dispatchVectors.set(patrolId, { line, etaMarker, incidentId: inc.id });
        } else {
          // Update vector and ETA badge
          vector.incidentId = inc.id;
          vector.line.setLatLngs([
            [livePos.lat, livePos.lng],
            [inc.lat, inc.lng],
          ]);
          vector.etaMarker.setLatLng([midLat, midLng]);
          vector.etaMarker.setIcon(etaBadgeIcon);
        }
      }
    }

    // 4. One-Shot flyTo when focusIncidentId changes to a new value
    if (focusIncidentId && focusIncidentId !== this.lastFocusedIncidentId) {
      this.lastFocusedIncidentId = focusIncidentId;
      const target = activeIncidents.find((i) => i.id === focusIncidentId);
      if (target) {
        this.map.flyTo([target.lat, target.lng], 14, {
          duration: 1.2,
        });

        // Open popup on target SOS beacon
        const marker = this.sosMarkers.get(target.id);
        if (marker) {
          setTimeout(() => {
            if (!this.map) return;
            marker.openPopup();
          }, 1250);
        }
      }
    }
  }

  public destroy(): void {
    this.layerGroup.clearLayers();
    this.map.removeLayer(this.layerGroup);
    this.sosMarkers.clear();
    this.dispatchVectors.clear();
  }
}
