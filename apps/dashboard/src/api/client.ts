import { Patrol, Incident, Prediction, AiSummary } from '../lib/types';
import { simulator } from '../map/sim/simulator';
import { generateFallbackAiSummary } from '../lib/derive';
import mockPredictions from '@shared/mock/predictions.json';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

// 60-second AI summary cache per zone
interface CachedSummary {
  summary: AiSummary;
  timestamp: number;
}
const aiSummaryCache = new Map<string, CachedSummary>();

export async function getPatrols(): Promise<{ patrols: Patrol[]; serverTime: number }> {
  if (USE_MOCK) {
    return simulator.getPatrols();
  }

  try {
    const res = await fetch(`${API_BASE}/patrols`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      patrols: data.patrols || [],
      serverTime: data.serverTime || Date.now(),
    };
  } catch (err) {
    console.warn('[API] /patrols fetch failed, using simulator fallback:', err);
    return simulator.getPatrols();
  }
}

export async function getIncidents(): Promise<{ incidents: Incident[]; serverTime: number }> {
  if (USE_MOCK) {
    return simulator.getIncidents();
  }

  try {
    const res = await fetch(`${API_BASE}/sos/live`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      incidents: data.incidents || [],
      serverTime: data.serverTime || Date.now(),
    };
  } catch (err) {
    console.warn('[API] /sos/live fetch failed, using simulator fallback:', err);
    return simulator.getIncidents();
  }
}

export async function resolveIncident(id: string): Promise<Incident | null> {
  // Always update simulator so mock/offline stays synchronized
  const simUpdated = simulator.resolveIncident(id);

  if (USE_MOCK) {
    return simUpdated;
  }

  try {
    const res = await fetch(`${API_BASE}/sos/resolve/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[API] /sos/resolve failed on network, simulator resolved locally:', err);
    return simUpdated;
  }
}

export async function getPredictions(): Promise<Prediction[]> {
  if (USE_MOCK) {
    return mockPredictions as Prediction[];
  }

  try {
    const res = await fetch(`${API_BASE}/predict`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? (data as Prediction[]) : (mockPredictions as Prediction[]);
  } catch (err) {
    console.warn('[API] /predict failed, using mock predictions fallback:', err);
    return mockPredictions as Prediction[];
  }
}

export async function getAiSummary(zoneName: string, predictions?: Prediction[]): Promise<AiSummary> {
  const cached = aiSummaryCache.get(zoneName);
  const now = Date.now();
  if (cached && now - cached.timestamp < 60000) {
    return cached.summary;
  }

  if (USE_MOCK) {
    const pred = (predictions || (mockPredictions as Prediction[])).find(
      (p) => p.zone.toLowerCase() === zoneName.toLowerCase()
    );
    const summary: AiSummary = {
      zone: zoneName,
      text: generateFallbackAiSummary(zoneName, pred),
      source: 'Rule-based',
    };
    aiSummaryCache.set(zoneName, { summary, timestamp: now });
    return summary;
  }

  try {
    const res = await fetch(`${API_BASE}/ai/summary?zone=${encodeURIComponent(zoneName)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const summary: AiSummary = {
      zone: data.zone || zoneName,
      text: data.text || generateFallbackAiSummary(zoneName),
      source: data.source || 'Bedrock',
    };
    aiSummaryCache.set(zoneName, { summary, timestamp: now });
    return summary;
  } catch {
    const pred = predictions?.find((p) => p.zone.toLowerCase() === zoneName.toLowerCase());
    const fallback: AiSummary = {
      zone: zoneName,
      text: generateFallbackAiSummary(zoneName, pred),
      source: 'Rule-based',
    };
    aiSummaryCache.set(zoneName, { summary: fallback, timestamp: now });
    return fallback;
  }
}
