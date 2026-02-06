from typing import List

from fastapi import APIRouter, HTTPException

from app.models import (
    AgentTurn,
    MultiAgentNegotiationRequest,
    MultiAgentNegotiationResponse,
    NegotiationRequest,
    NegotiationResponse,
    PolicyBriefRequest,
    PolicyBriefResponse,
    PresetResponse,
    SimulationRequest,
    SimulationResponse,
    StressTestRequest,
    StressTestResponse,
)
from app.services.groq_client import (
    generate_multiagent_transcript,
    generate_negotiation,
    generate_policy_brief,
)
from app.services.presets import list_presets
from app.services.simulation import run_simulation, run_stress_test


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/presets", response_model=List[PresetResponse])
def presets() -> List[PresetResponse]:
    return list_presets()


@router.post("/simulate", response_model=SimulationResponse)
def simulate(request: SimulationRequest) -> SimulationResponse:
    try:
        return run_simulation(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/stress-test", response_model=StressTestResponse)
def stress_test(request: StressTestRequest) -> StressTestResponse:
    try:
        return run_stress_test(request)
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
            dry_run=request.dry_run,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}") from exc

    return NegotiationResponse(model=model, content=content)


@router.post("/negotiate/multi", response_model=MultiAgentNegotiationResponse)
def negotiate_multi(request: MultiAgentNegotiationRequest) -> MultiAgentNegotiationResponse:
    try:
        data, model = generate_multiagent_transcript(request)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}") from exc

    transcript = [AgentTurn(**turn) for turn in data.get("transcript", [])]
    agreement = data.get("agreement")
    return MultiAgentNegotiationResponse(model=model, transcript=transcript, agreement=agreement)


@router.post("/policy/brief", response_model=PolicyBriefResponse)
def policy_brief(request: PolicyBriefRequest) -> PolicyBriefResponse:
    try:
        content, model = generate_policy_brief(
            simulation=request.simulation,
            region=request.region,
            focus=request.focus,
            model=request.model,
            temperature=request.temperature,
            dry_run=request.dry_run,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}") from exc

    return PolicyBriefResponse(model=model, content=content)
