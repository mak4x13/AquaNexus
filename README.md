# AquaNexus

AI-assisted water allocation simulation for climate-resilient agriculture in Pakistan.

## Team
Team Name: VizMinds  
Team Members: Muneeb Ahmed Khan, Abdullah, Ayna Khan

## Project Goal
AquaNexus is a decision-support platform, not an autonomous controller.  
Its goal is to help compare water allocation policies under scarcity and uncertainty by balancing:
- crop yield
- fairness across farm/province agents
- reservoir sustainability

The project is designed for hackathon and policy-prototype use, with a path toward real operational data integration.

## Why This Matters
Pakistan faces recurring water stress, inter-provincial allocation tension, drought risk, and canal losses.  
AquaNexus provides a transparent simulation environment so planners can test policy tradeoffs before applying decisions in the real system.

## What It Does Today
1. Simulates multi-day allocation for farm agents across `Punjab`, `Sindh`, `Khyber Pakhtunkhwa`, and `Balochistan`.
2. Runs a Pakistan-only live dashboard mode (no separate default mode in UI).
3. Supports policy modes: `fair`, `equal`, `proportional`, `quota`, `pakistan-quota`.
4. Computes core metrics: total yield, Gini fairness index, depletion risk, sustainability score, groundwater/conveyance impact.
5. Exposes LLM endpoints for negotiation draft generation, multi-agent transcript generation, and policy brief generation.
6. Shows live weather feed for provinces with safe fallback values when the weather API is unavailable.
7. Auto-ingests latest FFD river-state dam signals and runs live Pakistan simulation without manual payload entry.

## What Is Real vs Simulated
`Simulated`: reservoir dynamics, farm demand/yield curves, policy allocation outcomes, and projected multi-day inflow sequence.  
`Real/External`: live dam inflow/outflow/current-level signals from FFD river-state, weather data from Open-Meteo via `GET /weather/pakistan`, and Groq LLM responses when `dry_run=false` and network access works.

If weather API is unreachable, fallback weather values are used so the app remains functional.

## Agent Model
`Climate agent`: provides rainfall/drought signals to simulation.  
`Reservoir agent`: enforces release/storage constraints and tracks depletion.  
`Policy agent`: applies allocation policy and fairness logic.  
`Farm agents`: submit demand and convert allocation to yield.  
`LLM negotiation agents`: produce textual negotiation transcripts/briefs through Groq APIs.

Note: the numeric simulation engine and LLM negotiation layer are currently parallel components.

## Repository Structure
- `backend/` FastAPI API and simulation engine
- `frontend/` Next.js dashboard
- `INTEGRATION_MEMO.md` integration handoff notes

## Clone
```powershell
git clone https://github.com/mak4x13/AquaNexus.git
cd AquaNexus
```

## Prerequisites
- Python 3.9+
- Node.js 18+
- npm 9+

## Environment Variables
Create `.env` at repo root (recommended). `backend/.env` also works.

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=groq/compound
GROQ_TIMEOUT_SECONDS=40
GROQ_BASE_URL=
```

Notes:
- Backend reads `.env` from root `.env` or `backend/.env`.
- If `GROQ_API_KEY` is missing, use `dry_run=true` for LLM endpoints.

## Setup
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
cd frontend
npm install
```

## Run Backend
```powershell
cd backend
..\.venv\Scripts\python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend URLs:
- API base: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

## Run Frontend
```powershell
cd frontend
npm run dev -- -p 3000
```

Frontend URL:
- `http://127.0.0.1:3000`

Optional `frontend/.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## API Endpoints
- `GET /`
- `GET /health`
- `GET /presets`
- `GET /llm/health`
- `GET /weather/pakistan`
- `GET /data/dams/pakistan-live`
- `GET /data/dams/history`
- `GET /simulate/pakistan-live`
- `POST /data/dams/ingest`
- `POST /simulate`
- `POST /stress-test`
- `POST /negotiate`
- `POST /negotiate/multi`
- `POST /policy/brief`

## Zero-Manual Live Mode
You do not need to manually call POST endpoints for normal use.

1. Start backend + frontend.
2. Open `http://127.0.0.1:3000`.
3. Dashboard automatically calls `GET /simulate/pakistan-live` and displays live-driven simulation.

Direct API quick check:
```powershell
Invoke-RestMethod "http://127.0.0.1:8000/data/dams/pakistan-live"
Invoke-RestMethod "http://127.0.0.1:8000/data/dams/history?days=30"
Invoke-RestMethod "http://127.0.0.1:8000/simulate/pakistan-live?policy=pakistan-quota&days=30"
```

## Live History and Calibration Inputs
Use `GET /data/dams/history?days=N` to retrieve rolling persisted snapshots from live FFD fetches.

Returned metadata:
- `data_quality`: quality label of the latest snapshot in window (`high`, `medium`, `low`, `unknown`).
- `sample_count`: number of snapshots returned in the requested window.
- `last_success_at`: last successful live fetch timestamp in UTC.

Calibration-ready fields per snapshot:
- `fetched_at_utc`, `updated_at_pkt`
- `stations[].inflow_cusecs`, `stations[].outflow_cusecs`
- `stations[].current_level_ft`, `stations[].estimated_storage_maf`

Suggested calibration workflow:
1. Pull 30-180 day history from `/data/dams/history`.
2. Align with observed allocation/outcome records (IRSA, WAPDA, provincial irrigation reports).
3. Tune model params (`maf_to_model_units`, `drought_multiplier`, `conveyance_loss_rate`, groundwater limits) to minimize error on observed reservoir/yield trends.
4. Freeze calibrated parameter sets per season and rerun scenario comparisons.

## Real Dam Data Ingestion
Use `POST /data/dams/ingest` with real daily records (for example from IRSA/WAPDA bulletins after conversion to JSON).

Request payload format:
```json
{
  "source": "irsa-bulletin",
  "maf_to_model_units": 120,
  "records": [
    {
      "date": "2026-01-01",
      "dam": "Tarbela",
      "storage_maf": 4.72,
      "inflow_cusecs": 42100,
      "outflow_cusecs": 39700
    },
    {
      "date": "2026-01-01",
      "dam": "Mangla",
      "storage_maf": 2.95,
      "inflow_cusecs": 29800,
      "outflow_cusecs": 25500
    }
  ]
}
```

What this endpoint returns:
1. Aggregated storage/inflow/outflow summary.
2. A `suggested_config` object containing:
- `days`
- `reservoir_capacity`
- `initial_reservoir`
- `max_daily_allocation`
- `external_inflow_series`
3. Notes about scaling assumptions.

How to run simulation with ingested data:
1. Call `POST /data/dams/ingest`.
2. Copy `suggested_config` fields into your `/simulate` request `config`.
3. Ensure `config.days` matches the number of `external_inflow_series` entries you want to use.

## Quick Validation Checklist
After starting backend:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod http://127.0.0.1:8000/presets
Invoke-RestMethod http://127.0.0.1:8000/weather/pakistan
Invoke-RestMethod "http://127.0.0.1:8000/data/dams/pakistan-live"
Invoke-RestMethod "http://127.0.0.1:8000/data/dams/history?days=30"
Invoke-RestMethod "http://127.0.0.1:8000/simulate/pakistan-live?policy=pakistan-quota&days=30"
Invoke-RestMethod "http://127.0.0.1:8000/llm/health"
Invoke-RestMethod "http://127.0.0.1:8000/llm/health?probe=true"
```

Quick ingest test:
```powershell
$payload = @'
{
  "source": "manual-test",
  "maf_to_model_units": 120,
  "records": [
    {"date":"2026-01-01","dam":"Tarbela","storage_maf":4.7,"inflow_cusecs":42000,"outflow_cusecs":39000},
    {"date":"2026-01-01","dam":"Mangla","storage_maf":2.9,"inflow_cusecs":30000,"outflow_cusecs":26000},
    {"date":"2026-01-02","dam":"Tarbela","storage_maf":4.8,"inflow_cusecs":43000,"outflow_cusecs":40000},
    {"date":"2026-01-02","dam":"Mangla","storage_maf":3.0,"inflow_cusecs":31000,"outflow_cusecs":27000}
  ]
}
'@
Invoke-RestMethod -Uri "http://127.0.0.1:8000/data/dams/ingest" -Method Post -ContentType "application/json" -Body $payload
```

After starting frontend:
- Open `http://127.0.0.1:3000`
- Move reservoir day slider to an earlier day and confirm it stays pinned
- Click `Jump to latest` and confirm it returns to current day
- Switch scenario and confirm cards/metrics update

## Troubleshooting
1. If `npm run dev -- --port 3000` fails, run `npm run dev -- -p 3000`.
2. If `GET /llm/health?probe=true` returns unreachable, verify internet access and firewall/proxy/TLS restrictions.
3. If reservoir reaches `0.0%` early, this can be valid for current demand/release/loss settings; tune `initial_reservoir`, `max_daily_allocation`, rainfall, and loss parameters.

## Current Limitations
- Core water dynamics are simulation-based, not yet calibrated to real dam operations.
- Live endpoint currently uses latest available FFD snapshot and projects a multi-day inflow series from that snapshot.
- Live history endpoint stores rolling runtime snapshots for calibration but is not a full historical archive yet.
- Dam ingestion currently expects pre-cleaned JSON records (no direct PDF scraping/CSV parser endpoint yet).
- No persistent database/history/audit log yet.
- LLM negotiation is advisory text, not direct optimizer control.

## Next High-Impact Step
Integrate real Pakistan dam and hydrology data (Tarbela, Mangla, Chashma, inflow/storage series) into simulation initialization and daily constraints.

## Notes
Frontend defaults to backend at `http://localhost:8000` if `NEXT_PUBLIC_API_BASE_URL` is not set.
