# Rakshak API Contract

## Endpoints

### 1. `GET /patrols`
Returns all active patrol units in Chennai.
```json
{
  "patrols": [
    {
      "patrolId": "P04",
      "name": "Patrol 04",
      "officer": "Insp. R. Selvam",
      "zone": "T Nagar",
      "lat": 13.0418,
      "lng": 80.2341,
      "heading": 42.5,
      "status": "PATROLLING",
      "assignedIncidentId": null,
      "etaSeconds": null
    }
  ],
  "serverTime": 1788493200000
}
```
Patrol statuses: `PATROLLING`, `ASSIGNED`, `EN_ROUTE`, `ON_SCENE`.

### 2. `GET /sos/live`
Returns all active (non-purged) SOS incidents.
```json
{
  "incidents": [
    {
      "id": "SOS-4921",
      "citizenName": "Priya Raman",
      "zone": "T Nagar",
      "lat": 13.0418,
      "lng": 80.2341,
      "status": "EN_ROUTE",
      "createdAt": 1788493180000,
      "assignedAt": 1788493185000,
      "enRouteAt": 1788493190000,
      "arrivedAt": null,
      "resolvedAt": null,
      "assignedPatrolId": "P04",
      "patrol": {
        "patrolId": "P04",
        "name": "Patrol 04"
      },
      "etaSeconds": 192,
      "dispatchDistanceM": 1450,
      "priority": "HIGH"
    }
  ],
  "serverTime": 1788493200000
}
```
Incident statuses: `RECEIVED`, `ASSIGNED`, `EN_ROUTE`, `ARRIVED`, `RESOLVED`.

### 3. `PATCH /sos/resolve/{id}`
Marks an incident as resolved.
Returns updated incident object with `resolvedAt` timestamp and status `RESOLVED`.

### 4. `GET /predict`
Returns ML crime risk predictions for all zones (or single zone with `?zone=name`).
```json
[
  {
    "zone": "T Nagar",
    "hour": 14,
    "category": "Harassment",
    "confidence": 0.71,
    "riskScore": 68,
    "riskLevel": "ELEVATED",
    "recommendation": "Intensify pedestrian beat patrols near Usman Road shopping corridor",
    "modelVersion": "v2.4-xgboost",
    "source": "Bedrock"
  }
]
```

### 5. `GET /ai/summary?zone={zone}`
Returns executive risk synthesis narrative.
```json
{
  "zone": "T Nagar",
  "text": "Zone T Nagar currently experiences elevated risk (Score: 68) primarily driven by pedestrian harassment indicators near commercial hubs. Recommended 2 additional mobile beats along Usman Road.",
  "source": "Bedrock"
}
```
Client fallback template if offline:
`Zone {zone} currently registers {riskLevel} risk ({riskScore}/100) with predicted concern {category} ({confidence}% confidence). Recommended action: {recommendation}.`
Source labeled: `Rule-based`.
