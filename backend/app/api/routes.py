from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import ValidationError

from app.models import (
    AgentTurn,
    AgentProfile,
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


def _build_agents_from_simulation(request: MultiAgentNegotiationRequest) -> List[AgentProfile]:
    if not request.simulation:
        raise ValueError("simulation payload is required when auto_agents is true.")

    agents: List[AgentProfile] = []
    for farm in request.simulation.primary.farms:
        agents.append(
            AgentProfile(
                id=farm.id,
                role="farm",
                goal=f"Protect {farm.crop_type} yields and secure fair allocation.",
                constraints=["variable rainfall", "canal loss risk"],
            )
        )

    agents.append(
        AgentProfile(
            id="reservoir",
            role="reservoir",
            goal="Maintain reservoir above sustainability threshold.",
            constraints=["storage volatility"],
        )
    )
    agents.append(
        AgentProfile(
            id="policy",
            role="policy",
            goal="Balance equity, yield, and drought resilience.",
            constraints=["tail-end fairness"],
        )
    )

    return agents


@router.get("/")
def root() -> dict:
    return {
        "status": "ok",
        "docs": "/docs",
        "health": "/health",
    }


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
        if request.auto_agents:
            request = request.model_copy(update={"agents": _build_agents_from_simulation(request)})
        elif not request.agents:
            raise ValueError("agents list cannot be empty unless auto_agents is true.")
        data, model = generate_multiagent_transcript(request)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}") from exc

    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="Negotiation response is not a JSON object.")

    transcript_raw = data.get("transcript")
    if transcript_raw is None:
        transcript_raw = []
    elif not isinstance(transcript_raw, list):
        raise HTTPException(status_code=502, detail="Negotiation transcript is not a list.")

    try:
        transcript = [AgentTurn(**turn) for turn in transcript_raw]
    except (TypeError, ValidationError) as exc:
        raise HTTPException(status_code=502, detail=f"Negotiation transcript validation failed: {exc}") from exc
    agreement = data.get("agreement")
    return MultiAgentNegotiationResponse(model=model, transcript=transcript, agreement=str(agreement) if agreement is not None else None)


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
