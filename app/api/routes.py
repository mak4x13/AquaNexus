from fastapi import APIRouter, HTTPException

from app.models import NegotiationRequest, NegotiationResponse, SimulationRequest, SimulationResponse
from app.services.groq_client import generate_negotiation
from app.services.simulation import run_simulation


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest) -> SimulationResponse:
    try:
        return run_simulation(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/negotiate", response_model=NegotiationResponse)
def negotiate(request: NegotiationRequest) -> NegotiationResponse:
    try:
        content, model = generate_negotiation(
            prompt=request.prompt,
            context=request.context,
            model=request.model,
            temperature=request.temperature,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Groq request failed.") from exc

    return NegotiationResponse(model=model, content=content)