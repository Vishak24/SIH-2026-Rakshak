import React from 'react';
import { BrainCircuit, ChevronDown, Sparkles } from 'lucide-react';
import { Incident, Patrol, Prediction, AiSummary } from '../lib/types';
import { calculateOperationalRisk } from '../lib/derive';
import zonesData from '@shared/routes/zones.json';

interface AiPanelProps {
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  predictions: Prediction[];
  incidents: Incident[];
  patrols: Patrol[];
  aiSummary: AiSummary | null;
}

export const AiPanel: React.FC<AiPanelProps> = ({
  selectedZone,
  onSelectZone,
  predictions,
  incidents,
  patrols,
  aiSummary,
}) => {
  const currentPred = predictions.find(
    (p) => p.zone.toLowerCase() === selectedZone.toLowerCase()
  );

  const riskBreakdown = calculateOperationalRisk(
    selectedZone,
    predictions,
    incidents,
    patrols
  );

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH':
        return 'var(--risk-high)';
      case 'ELEVATED':
        return 'var(--risk-elevated)';
      case 'MODERATE':
        return 'var(--risk-moderate)';
      default:
        return 'var(--risk-low)';
    }
  };

  const confidencePct = currentPred ? Math.round(currentPred.confidence * 100) : 71;
  const category = currentPred ? currentPred.category : 'Commercial Dispute';
  const recommendation = currentPred
    ? currentPred.recommendation
    : 'Maintain heightened surveillance along primary thoroughfares.';
  const modelVersion = currentPred ? currentPred.modelVersion : 'v2.4-xgboost';

  const narrativeText =
    aiSummary?.text ||
    `Zone ${selectedZone} currently registers ${riskBreakdown.level} risk (${riskBreakdown.score}/100) with predicted concern ${category} (${confidencePct}% confidence). Recommended: ${recommendation}`;
  const narrativeSource = aiSummary?.source || 'Rule-based';

  return (
    <section className="ai-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <BrainCircuit size={16} className="text-accent-purple" />
          <h2 className="panel-title">AI RISK · PREDICTION</h2>
        </div>

        {/* Zone Selector Dropdown */}
        <div className="zone-dropdown-wrapper">
          <select
            className="zone-select-dropdown font-mono"
            value={selectedZone}
            onChange={(e) => onSelectZone(e.target.value)}
          >
            {zonesData.map((z) => (
              <option key={z.id} value={z.name}>
                {z.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="dropdown-arrow" />
        </div>
      </div>

      <div className="ai-panel-content">
        {/* Block 1: Operational Risk Score & Contributions */}
        <div className="risk-score-block">
          <div className="risk-score-main">
            <div className="risk-score-badge">
              <span
                className="risk-big-number font-mono"
                style={{ color: getRiskColor(riskBreakdown.level) }}
              >
                {riskBreakdown.score}
              </span>
              <span className="risk-scale font-mono">/100</span>
            </div>

            <div className="risk-meta">
              <span
                className="risk-level-tag font-mono"
                style={{
                  backgroundColor: `${getRiskColor(riskBreakdown.level)}22`,
                  color: getRiskColor(riskBreakdown.level),
                  borderColor: getRiskColor(riskBreakdown.level),
                }}
              >
                {riskBreakdown.level}
              </span>
              <span className="risk-zone-label">{selectedZone} Operational Risk</span>
            </div>
          </div>

          {/* Contribution Bars */}
          <div className="risk-contrib-bars">
            <div className="contrib-bar-item">
              <div className="contrib-bar-label">
                <span>Model (55%)</span>
                <span className="font-mono">{riskBreakdown.modelContrib}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-purple"
                  style={{ width: `${(riskBreakdown.modelContrib / 55) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="contrib-bar-item">
              <div className="contrib-bar-label">
                <span>Incidents (25%)</span>
                <span className="font-mono">{riskBreakdown.incidentContrib}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-red"
                  style={{ width: `${(riskBreakdown.incidentContrib / 25) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="contrib-bar-item">
              <div className="contrib-bar-label">
                <span>Patrol load (20%)</span>
                <span className="font-mono">{riskBreakdown.patrolContrib}</span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-amber"
                  style={{ width: `${(riskBreakdown.patrolContrib / 20) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Block 2: Model Prediction */}
        <div className="prediction-block">
          <div className="prediction-header">
            <div className="category-group">
              <span className="prediction-category">{category}</span>
              <span className="prediction-confidence font-mono">{confidencePct}% conf</span>
            </div>
            <span className="model-version font-mono">{modelVersion}</span>
          </div>
          <p className="prediction-recommendation">{recommendation}</p>
        </div>

        {/* Block 3: Narrative Summary */}
        <div className="narrative-block">
          <div className="narrative-header">
            <div className="flex items-center gap-1">
              <Sparkles size={12} className="text-accent-cyan" />
              <span className="narrative-title">Risk Synthesis</span>
            </div>
            <span
              className={`source-badge font-mono ${
                narrativeSource === 'Bedrock' ? 'source-bedrock' : 'source-rule'
              }`}
            >
              {narrativeSource}
            </span>
          </div>
          <p className="narrative-text">"{narrativeText}"</p>
        </div>
      </div>
    </section>
  );
};
