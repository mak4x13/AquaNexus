# AquaNexus Backend

FastAPI backend for multi-agent water allocation simulation and Groq-powered negotiation summaries.

**Quick Start**
1. `python -m venv .venv`
2. `.\.venv\Scripts\Activate.ps1`
3. `pip install -r requirements.txt`
4. Set `GROQ_API_KEY` in `.env` (see `.env.example`).
5. `uvicorn app.main:app --reload`

**Endpoints**
- `GET /health`
- `POST /simulate`
- `POST /negotiate`

**Sample Simulate Request**
```json
{
  "farms": [
    {"id": "farm-1", "crop_type": "wheat", "base_demand": 40, "yield_a": 8},
    {"id": "farm-2", "crop_type": "rice", "base_demand": 55, "yield_a": 10},
    {"id": "farm-3", "crop_type": "maize", "base_demand": 30, "yield_a": 7}
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
    "sustainability_threshold": 0.2,
    "alpha": 1.0,
    "beta": 1.0,
    "fairness_weight": 0.6,
    "seed": 42
  },
  "policy": "fair",
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

**Notes**
- `policy` supports `fair`, `equal`, and `proportional`.
- `compare_policies` returns baseline comparisons for quick demo charts.