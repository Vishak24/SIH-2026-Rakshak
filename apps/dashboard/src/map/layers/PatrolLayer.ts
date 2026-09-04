import L from 'leaflet';
import { Patrol } from '../../lib/types';

export interface PatrolLayerOptions {
  map: L.Map;
}

interface PatrolAnimState {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  t0: number;
  lastHeading: number;
  marker: L.Marker;
  patrol: Patrol;
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Generate SVG Police Car DivIcon styled by status and rotated by heading
function createPatrolDivIcon(status: Patrol['status'], heading: number): L.DivIcon {
  const isPatrolling = status === 'PATROLLING';
  const isEnRoute = status === 'EN_ROUTE';
  const statusClass = isPatrolling
    ? 'patrol-icon-patrolling'
    : isEnRoute
    ? 'patrol-icon-en-route'
    : 'patrol-icon-on-scene';

  const html = `
    <div class="patrol-marker-container" style="transform: rotate(${heading}deg);">
      ${isEnRoute ? '<div class="patrol-en-route-pulse"></div>' : ''}
      <div class="patrol-icon-inner ${statusClass}">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 11 2 11.5 2 12v4c0 .6.4 1 1 1h2"/>
          <circle cx="7" cy="17" r="2"/>
          <path d="M9 17h6"/>
          <circle cx="17" cy="17" r="2"/>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-patrol-div-icon',
    html,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function buildTooltipHtml(p: Patrol): string {
  const etaText = p.etaSeconds != null
    ? `${Math.floor(p.etaSeconds / 60)}m ${(p.etaSeconds % 60).toString().padStart(2, '0')}s`
    : '—';

  return `
    <div style="font-family: var(--font-sans); font-size: 11px; line-height: 1.4; color: var(--text-primary);">
      <div style="font-weight: 700; color: #60a5fa; font-size: 12px; margin-bottom: 2px;">
        ${p.name} (${p.patrolId})
      </div>
      <div><strong>Officer:</strong> ${p.officer}</div>
      <div><strong>Zone:</strong> ${p.zone}</div>
      <div><strong>Status:</strong> <span style="font-weight: 700; color: ${
        p.status === 'PATROLLING' ? '#34d399' : p.status === 'EN_ROUTE' ? '#60a5fa' : '#fbbf24'
      }">${p.status}</span></div>
      ${p.etaSeconds != null ? `<div><strong>ETA:</strong> ${etaText}</div>` : ''}
    </div>
  `;
}

export class PatrolLayer {
  private map: L.Map;
  private layerGroup: L.LayerGroup;
  private patrolAnimMap = new Map<string, PatrolAnimState>();
  private currentTweenedCoords = new Map<string, { lat: number; lng: number }>();
  private animFrameId: number | null = null;
  private isDestroyed = false;

  // Callback to inform external listeners (like SosLayer) of tween ticks
  public onTweenTick?: () => void;

  constructor(options: PatrolLayerOptions) {
    this.map = options.map;
    this.layerGroup = L.layerGroup().addTo(this.map);
    this.startSharedAnimLoop();
  }

  // Single shared requestAnimationFrame loop across all patrol markers
  private startSharedAnimLoop(): void {
    const loop = (timestamp: number) => {
      if (this.isDestroyed) return;

      this.patrolAnimMap.forEach((anim, patrolId) => {
        const elapsed = timestamp - anim.t0;
        // 3000ms duration matching the 3-second poll cycle
        const progress = Math.min(1, Math.max(0, elapsed / 3000));

        // lerp(from, to, progress)
        const curLat = anim.fromLat + progress * (anim.toLat - anim.fromLat);
        const curLng = anim.fromLng + progress * (anim.toLng - anim.fromLng);

        anim.marker.setLatLng([curLat, curLng]);
        this.currentTweenedCoords.set(patrolId, { lat: curLat, lng: curLng });
      });

      if (this.onTweenTick) {
        this.onTweenTick();
      }

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  // Called whenever new patrols prop arrives
  public update(patrols: Patrol[]): void {
    if (this.isDestroyed || !patrols) return;
    const now = performance.now();
    const activeIds = new Set(patrols.map((p) => p.patrolId));

    // Clean up markers for removed patrols
    this.patrolAnimMap.forEach((anim, id) => {
      if (!activeIds.has(id)) {
        this.layerGroup.removeLayer(anim.marker);
        this.patrolAnimMap.delete(id);
        this.currentTweenedCoords.delete(id);
      }
    });

    for (const p of patrols) {
      let anim = this.patrolAnimMap.get(p.patrolId);

      if (!anim) {
        // Initial marker creation - reused in place going forward
        const icon = createPatrolDivIcon(p.status, p.heading);
        const marker = L.marker([p.lat, p.lng], {
          icon,
          zIndexOffset: 500,
        }).addTo(this.layerGroup);

        marker.bindTooltip(buildTooltipHtml(p), {
          direction: 'top',
          offset: [0, -18],
          className: 'patrol-custom-tooltip',
        });

        anim = {
          fromLat: p.lat,
          fromLng: p.lng,
          toLat: p.lat,
          toLng: p.lng,
          t0: now,
          lastHeading: p.heading,
          marker,
          patrol: p,
        };
        this.patrolAnimMap.set(p.patrolId, anim);
        this.currentTweenedCoords.set(p.patrolId, { lat: p.lat, lng: p.lng });
      } else {
        // Marker already exists: REUSE and update in place
        anim.patrol = p;
        const curTween = this.currentTweenedCoords.get(p.patrolId) || { lat: anim.toLat, lng: anim.toLng };
        const distToNewPos = haversineMeters(curTween.lat, curTween.lng, p.lat, p.lng);

        if (distToNewPos > 500) {
          // Snap immediately if new position is > 500m (teleport after incident resolution)
          anim.fromLat = p.lat;
          anim.fromLng = p.lng;
          anim.toLat = p.lat;
          anim.toLng = p.lng;
          anim.t0 = now;
          anim.marker.setLatLng([p.lat, p.lng]);
          this.currentTweenedCoords.set(p.patrolId, { lat: p.lat, lng: p.lng });
        } else {
          // Smoothly glide from current rendered position to new polled position
          anim.fromLat = curTween.lat;
          anim.fromLng = curTween.lng;
          anim.toLat = p.lat;
          anim.toLng = p.lng;
          anim.t0 = now;
        }

        // Heading rotation with 5-degree deadband to prevent noise jitter
        let effectiveHeading = anim.lastHeading;
        const headingDiff = Math.abs(p.heading - anim.lastHeading);
        // Handle circular difference 355° vs 5°
        const normalizedDiff = Math.min(headingDiff, 360 - headingDiff);
        if (normalizedDiff >= 5) {
          effectiveHeading = p.heading;
          anim.lastHeading = p.heading;
        }

        // Update icon and tooltip in place
        anim.marker.setIcon(createPatrolDivIcon(p.status, effectiveHeading));
        anim.marker.setTooltipContent(buildTooltipHtml(p));
      }
    }
  }

  // Live interpolated position for a patrol (used by SosLayer for dispatch vectors)
  public getLivePosition(patrolId: string): { lat: number; lng: number } | null {
    return this.currentTweenedCoords.get(patrolId) || null;
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId != null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.layerGroup.clearLayers();
    this.map.removeLayer(this.layerGroup);
    this.patrolAnimMap.clear();
    this.currentTweenedCoords.clear();
  }
}
