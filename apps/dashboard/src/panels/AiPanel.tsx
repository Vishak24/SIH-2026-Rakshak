import React, { useMemo } from 'react';
import { Incident, Patrol, Prediction, AiSummary } from '../api/client';
import { operationalRisk, RiskBand } from '../lib/derive';
import './AiPanel.css';

export interface AiPanelProps {
  predictions: Prediction[];
  incidents: Incident[];
  patrols: Patrol[];
  selectedZone: string | null;
  aiSummary: AiSummary | null;
  onSelectZone: (zone: string | null) => void;
}

/**
 * Maps risk band to theme color tokens
 */
function getRiskBandClass(band: RiskBand): string {
  switch (band) {
    case 'LOW':
      return 'risk-badge--low';
    case 'MODERATE':
      return 'risk-badge--moderate';
    case 'ELEVATED':
      return 'risk-badge--elevated';
    case 'HIGH':
      return 'risk-badge--high';
  }
}

/**
 * AiPanel Component
 * Owned by: Dev A (src/panels/AiPanel.tsx)
 *
 * Renders the AI predictive risk analysis for the currently selected zone,
 * defaulting to the highest-risk zone when none is selected.
 */
export const AiPanel: React.FC<AiPanelProps> = ({
  predictions,
  incidents,
  patrols,
  selectedZone,
  aiSummary,
  onSelectZone,
}) => {
  // Collect all available zones from predictions, incidents, and patrols
  const allZones = useMemo(() => {
    const set = new Set<string>();
    predictions.forEach((p) => p.zone && set.add(p.zone));
    incidents.forEach((i) => i.zone && set.add(i.zone));
    patrols.forEach((p) => p.zone && set.add(p.zone));

    if (set.size === 0) {
      // Fallback zones list if no telemetry has loaded yet
      return ['Adyar', 'T. Nagar', 'Mylapore', 'Velachery', 'Anna Nagar'];
    }
    return Array.from(set).sort();
  }, [predictions, incidents, patrols]);

  // Determine effective zone:
  // If selectedZone is set and valid, use it.
  // Otherwise, default to the zone with the HIGHEST operational risk.
  const effectiveZone = useMemo(() => {
    if (selectedZone) return selectedZone;

    if (allZones.length === 0) return 'Adyar';

    let highestZone = allZones[0];
    let maxRisk = -1;

    for (const zone of allZones) {
      const risk = operationalRisk(zone, predictions, incidents, patrols);
      if (risk.total > maxRisk) {
        maxRisk = risk.total;
        highestZone = zone;
      }
    }

    return highestZone;
  }, [selectedZone, allZones, predictions, incidents, patrols]);

  // Compute operational risk breakdown for effective zone
  const riskBreakdown = useMemo(() => {
    return operationalRisk(effectiveZone, predictions, incidents, patrols);
  }, [effectiveZone, predictions, incidents, patrols]);

  // Matching raw prediction object
  const matchingPrediction = useMemo(() => {
    return predictions.find(
      (p) => p.zone.toLowerCase() === effectiveZone.toLowerCase()
    );
  }, [predictions, effectiveZone]);

  // Client-side fallback narrative if aiSummary is missing or empty
  const narrativeText = useMemo(() => {
    if (aiSummary && aiSummary.text) {
      return aiSummary.text;
    }
    const cat = matchingPrediction?.category || 'Urban Patrol Sector';
    return `${effectiveZone} is currently categorized under ${cat} with a ${riskBreakdown.band.toLowerCase()} operational risk rating. Active units should maintain targeted situational awareness and prioritize key transit junctions.`;
  }, [aiSummary, matchingPrediction, effectiveZone, riskBreakdown.band]);

  const narrativeSource = aiSummary?.source || 'Rule-based';

  return (
    <section className="dashboard-panel ai-panel-container">
      {/* Panel Header with Zone Selector Dropdown */}
      <div className="panel-header">
        <div className="panel-header-left">
          <h2 className="panel-title">AI Predictive Risk</h2>
          <span className="ai-status-indicator">● LIVE</span>
        </div>

        <div className="zone-dropdown-wrapper">
          <label htmlFor="ai-zone-select" className="sr-only">
            Select Zone
          </label>
          <select
            id="ai-zone-select"
            className="ai-zone-select"
            value={effectiveZone}
            onChange={(e) => onSelectZone(e.target.value)}
          >
            {allZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="ai-panel-body">
        {/* Block 1: Operational Risk Score & Contribution Bars */}
        <div className="ai-block risk-score-block">
          <div className="risk-score-header">
            <span className="risk-score-label">Operational Risk</span>
            <span className={`risk-band-badge ${getRiskBandClass(riskBreakdown.band)}`}>
              {riskBreakdown.band}
            </span>
          </div>

          <div className="risk-score-number-row">
            <span className="risk-score-number">{riskBreakdown.total}</span>
            <span className="risk-score-max">/ 100</span>
          </div>

          {/* Three weighted contribution bars */}
          <div className="contribution-bars-list">
            {/* Model (max 55) */}
            <div className="contribution-bar-row">
              <div className="contribution-bar-labels">
                <span>Model Risk</span>
                <span className="contribution-val">{riskBreakdown.modelContribution}% / 55%</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill bar-fill--model"
                  style={{ width: `${(riskBreakdown.modelContribution / 55) * 100}%` }}
                />
              </div>
            </div>

            {/* Incidents (max 25) */}
            <div className="contribution-bar-row">
              <div className="contribution-bar-labels">
                <span>Incidents</span>
                <span className="contribution-val">{riskBreakdown.incidentsContribution}% / 25%</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill bar-fill--incidents"
                  style={{ width: `${(riskBreakdown.incidentsContribution / 25) * 100}%` }}
                />
              </div>
            </div>

            {/* Patrol Load (max 20) */}
            <div className="contribution-bar-row">
              <div className="contribution-bar-labels">
                <span>Patrol Load</span>
                <span className="contribution-val">{riskBreakdown.patrolLoadContribution}% / 20%</span>
              </div>
              <div className="bar-track">
                <div
                  className="bar-fill bar-fill--patrol"
                  style={{ width: `${(riskBreakdown.patrolLoadContribution / 20) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Block 2: Raw Model Prediction */}
        <div className="ai-block raw-prediction-block">
          <div className="block-title-row">
            <span className="block-title">Model Telemetry</span>
            <span className="model-version">
              {matchingPrediction?.modelVersion || 'rakshak-v1.4'}
            </span>
          </div>

          <div className="prediction-meta-grid">
            <div className="prediction-meta-item">
              <span className="meta-label">Category</span>
              <span className="meta-value">{matchingPrediction?.category || 'General Surveillance'}</span>
            </div>
            <div className="prediction-meta-item">
              <span className="meta-label">Confidence</span>
              <span className="meta-value">
                {matchingPrediction
                  ? `${Math.round(matchingPrediction.confidence * 100)}%`
                  : '85%'}
              </span>
            </div>
          </div>

          {matchingPrediction?.recommendation && (
            <div className="prediction-recommendation">
              <span className="rec-label">Recommendation:</span>
              <p className="rec-text">{matchingPrediction.recommendation}</p>
            </div>
          )}
        </div>

        {/* Block 3: Narrative Paragraph */}
        <div className="ai-block narrative-block">
          <div className="block-title-row">
            <span className="block-title">Tactical Brief</span>
            <span className="narrative-source-tag">{narrativeSource}</span>
          </div>
          <p className="narrative-paragraph">{narrativeText}</p>
        </div>
      </div>
    </section>
  );
};

export default AiPanel;
