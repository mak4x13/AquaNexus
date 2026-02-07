# AquaNexus Backend

FastAPI backend for multi-agent water allocation simulation and Groq-powered negotiation summaries.

**Quick Start**
1. `python -m venv .venv`
2. `.\.venv\Scripts\Activate.ps1`
3. `pip install -r requirements.txt`
4. Set `GROQ_API_KEY` in `.env`.
5. `uvicorn app.main:app --reload`

**Endpoints**
- `GET /health`
- `GET /presets`
- `POST /simulate`
- `POST /stress-test`
- `POST /negotiate`
- `POST /negotiate/multi`
- `POST /policy/brief`

**Sample Simulate Request**
```json
{
  "farms": [
    {"id": "farm-1", "crop_type": "wheat", "base_demand": 40, "yield_a": 8, "province": "Punjab"},
    {"id": "farm-2", "crop_type": "rice", "base_demand": 55, "yield_a": 10, "province": "Sindh"},
    {"id": "farm-3", "crop_type": "maize", "base_demand": 30, "yield_a": 7, "province": "Punjab"}
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
    "province_quotas": { "Punjab": 0.55, "Sindh": 0.45 },
    "quota_mode": "share",
    "seed": 42
  },
  "policy": "quota",
  "compare_policies": true
}
```

**Sample Negotiate Request**
```json
{
  "prompt": "Draft a fair water allocation agreement for 3 farms facing drought risk.",
  "context": {
    "farms": [
      {"id": "farm-1", "crop_type": "wheat", "demand": 40},
      {"id": "farm-2", "crop_type": "rice", "demand": 55},
      {"id": "farm-3", "crop_type": "maize", "demand": 30}
    ],
    "reservoir": {"capacity": 1200, "available_today": 120}
  }
}
```

**Sample Stress Test Request**
```json
{
  "farms": [
    {"id": "farm-1", "crop_type": "wheat", "base_demand": 40, "yield_a": 8},
    {"id": "farm-2", "crop_type": "rice", "base_demand": 55, "yield_a": 10}
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
    "seed": 42
  },
  "policy": "fair",
  "runs": 50
}
```

**Sample Policy Brief Request**
```json
{
  "simulation": { "primary": { "summary": {}, "daily": [], "farms": [] }, "comparisons": [] },
  "region": "Pakistan",
  "focus": "Tail-end equity and drought resilience"
}
```

**Sample Multi-Agent Negotiation Request**
```json
{
  "prompt": "Negotiate a drought water-sharing plan.",
  "region": "Pakistan",
  "rounds": 3,
  "agents": [
    {"id": "farm-1", "role": "farm", "goal": "Protect wheat yields", "constraints": ["limited storage"]},
    {"id": "farm-2", "role": "farm", "goal": "Maintain rice allocation", "constraints": ["high water demand"]},
    {"id": "reservoir", "role": "reservoir", "goal": "Keep reservoir above safety threshold"},
    {"id": "policy", "role": "policy", "goal": "Ensure equity for tail-end users"}
  ],
  "dry_run": true
}
```

**Notes**
- `policy` supports `fair`, `equal`, `proportional`, `quota`, and `pakistan-quota` (auto-derives quotas from farm provinces).
- `compare_policies` returns baseline comparisons for quick demo charts.
- `conveyance_loss_rate` models canal and distribution losses (set to 0 for none).
- `drought_demand_reduction` uses farm `resilience` to reduce demand during droughts.
- LLM endpoints accept `dry_run: true` to avoid external API calls during testing.
- For `quota`, each farm must include `province`, and `province_quotas` must be set.
- Groundwater fields let you model pumping buffer and penalty.
