# AquaNexus

AquaNexus is a monorepo with:
- `backend/`: FastAPI multi-agent water allocation API
- `frontend/`: Next.js dashboard UI

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
Create `.env` at repo root or `backend/.env`:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=groq/compound
```

Notes:
- Backend reads `.env` from either `backend/.env` or root `.env`.
- If `GROQ_API_KEY` is missing, only `dry_run=true` LLM calls should be used.

## Backend Setup
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run Backend
```powershell
cd backend
uvicorn app.main:app --reload
```

API base URL: `http://127.0.0.1:8000`
Docs: `http://127.0.0.1:8000/docs`

## Frontend Setup
```powershell
cd frontend
npm install
```

Optional `.env.local`:
```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Run Frontend
```powershell
cd frontend
npm run dev
```

Frontend URL: `http://127.0.0.1:3000`

## Backend Endpoints
- `GET /`
- `GET /health`
- `GET /presets`
- `POST /simulate`
- `POST /stress-test`
- `POST /negotiate`
- `POST /negotiate/multi`
- `POST /policy/brief`

### Policy Modes
`simulate` / `stress-test` support:
- `fair`
- `equal`
- `proportional`
- `quota`
- `pakistan-quota`

`pakistan-quota` auto-derives equal shares from farm `province` values when quotas are not supplied.

## Sample Simulate Payload
```json
{
  "farms": [
    {"id": "farm-1", "crop_type": "wheat", "base_demand": 40, "yield_a": 8, "resilience": 0.6, "province": "Punjab"},
    {"id": "farm-2", "crop_type": "rice", "base_demand": 55, "yield_a": 10, "resilience": 0.3, "province": "Sindh"},
    {"id": "farm-3", "crop_type": "cotton", "base_demand": 45, "yield_a": 9, "resilience": 0.5, "province": "Punjab"}
  ],
  "config": {
    "days": 30,
    "reservoir_capacity": 1200,
    "initial_reservoir": 800,
    "max_daily_allocation": 140,
    "rainfall_prob": 0.3,
    "rainfall_mean": 20,
    "rainfall_std": 6,
    "drought_prob": 0.1,
    "drought_multiplier": 0.5,
    "drought_demand_reduction": 0.25,
    "conveyance_loss_rate": 0.25,
    "groundwater_capacity": 300,
    "initial_groundwater": 200,
    "max_groundwater_pumping": 20,
    "groundwater_recharge": 3,
    "groundwater_penalty_weight": 0.5,
    "sustainability_threshold": 0.2,
    "alpha": 1.0,
    "beta": 1.0,
    "fairness_weight": 0.6,
    "province_quotas": {"Punjab": 0.55, "Sindh": 0.45},
    "quota_mode": "share",
    "seed": 42
  },
  "policy": "quota",
  "compare_policies": true
}
```

## LLM Testing (Dry Run)
Use `dry_run: true` for:
- `POST /negotiate`
- `POST /negotiate/multi`
- `POST /policy/brief`

This verifies end-to-end behavior without external Groq calls.

## Validation Rules
- Farm IDs must be unique.
- `initial_reservoir <= reservoir_capacity`
- `initial_groundwater <= groundwater_capacity`
- `quota` policy requires farm `province` + `province_quotas`.
- `pakistan-quota` requires all farms to have `province`.

## Project Notes
- Integration notes for frontend consumers are in `INTEGRATION_MEMO.md`.
- Frontend defaults to backend at `http://localhost:8000`.