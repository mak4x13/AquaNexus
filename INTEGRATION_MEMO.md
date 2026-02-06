# AquaNexus Frontend Integration Memo

## Purpose
Document how the futuristic AquaNexus frontend can integrate with other projects, focusing on data flow, API contracts, and reuse patterns.

## Frontend Overview (Target)
- Framework: React (optionally Next.js)
- Styling: Tailwind CSS + glassmorphism components
- Motion: Framer Motion
- Visuals: Three.js (reservoir), D3/Recharts (charts)
- Data: REST for control, WebSocket for realtime state

## Core UI Modules (Reusable)
1. Reservoir Visualization
   - Inputs: reservoir_level, sustainability_threshold, inflow/outflow
   - Outputs: 3D level, alert states
2. Farm Agent Cards
   - Inputs: farms[] (requested, allocated, yield, fairness)
   - Outputs: per-farm status, fairness color
3. Climate Intelligence
   - Inputs: rainfall_probability, drought_risk, forecast_timeseries[]
   - Outputs: gauges, heat map, time-series chart
4. System Metrics
   - Inputs: total_yield[], sustainability_score, gini_index, depletion_risk
   - Outputs: KPI cards, graphs, alerts
5. Interaction Flow Map
   - Inputs: nodes[], edges[] (flow intensity)
   - Outputs: animated allocation graph
6. Scenario Toggle
   - Inputs: current_scenario, available_scenarios[]
   - Outputs: scenario switch, API trigger

## Integration Patterns (Other Projects)
Use these patterns to embed AquaNexus UI modules into other apps.

### Pattern A: Embed as a Route or Page
- Host AquaNexus as a standalone dashboard route inside an existing React/Next app.
- Add a layout wrapper for auth/nav from the host app.
- Use environment variables for API base URLs.

### Pattern B: Micro-Frontend (Module Federation)
- Expose AquaNexus dashboard as a remote module.
- Host apps load it dynamically and provide auth tokens and API URLs.

### Pattern C: Iframe + PostMessage (Quick Embed)
- Deploy AquaNexus frontend separately.
- Host app embeds via iframe and passes scenario changes via postMessage.
- Use a thin bridge to sync user sessions.

## API Contract (Baseline)
Base URL (REST): /api
WebSocket: /ws

Endpoints:
- POST /initialize
- POST /simulate_day
- GET /metrics
- POST /scenario_toggle

Sample response:
{
  "day": 12,
  "reservoir_level": 65.3,
  "farms": [
    {"id": 1, "requested": 30, "allocated": 25, "yield": 18.4},
    {"id": 2, "requested": 40, "allocated": 35, "yield": 22.1}
  ],
  "gini_index": 0.18,
  "depletion_risk": 0.25
}

## WebSocket Events (Realtime)
- event: state_update
  payload: day, reservoir_level, farms[], metrics, climate
- event: alert
  payload: type, severity, message
- event: scenario_changed
  payload: scenario

## Data Mapping Guide
- Reservoir Visualization <= reservoir_level, sustainability_threshold
- Farm Agent Cards <= farms[]
- Climate Panel <= rainfall_probability, drought_risk, forecast_timeseries[]
- System Metrics <= total_yield[], sustainability_score, gini_index, depletion_risk
- Flow Map <= nodes[], edges[]

## Reuse Checklist for Other Projects
- Provide API base URL and WebSocket URL
- Ensure auth token passthrough (if required)
- Match JSON schema (or add adapter)
- Decide integration pattern (A, B, or C)
- Confirm chart libraries compatibility

## Deployment Notes
- Frontend: Vercel or Netlify
- Backend: Render, Railway, or AWS
- Use HTTPS for WebSocket (wss://) in production

## Risks and Mitigations
- Realtime data volume: throttle updates to 2-5 Hz
- 3D load cost: lazy-load Three.js scene
- Schema drift: version the API and add adapters

## Next Steps
- Define exact JSON schema (fields + units)
- Decide integration pattern per host project
- Create API stubs or mock server for frontend work
