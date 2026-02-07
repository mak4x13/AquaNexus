# AquaNexus

Monorepo for AquaNexus with a FastAPI backend and a Next.js frontend.

## Structure
- `backend/` FastAPI API server
- `frontend/` Next.js dashboard UI
- `INTEGRATION_MEMO.md` frontend integration notes

## Backend Quick Start
1. `cd backend`
2. `python -m venv .venv`
3. `.\.venv\Scripts\Activate.ps1`
4. `pip install -r requirements.txt`
5. Set `GROQ_API_KEY` in `backend/.env` (or keep a root `.env`).
6. `uvicorn app.main:app --reload`

See `backend/README.md` for endpoints and sample payloads.

## Frontend Quick Start
1. `cd frontend`
2. `npm install`
3. `npm run dev`

Optional: set `NEXT_PUBLIC_API_BASE_URL` to your backend URL (defaults to `http://localhost:8000`).