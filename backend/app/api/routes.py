from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from app.models import (
    AgentTurn,
    AgentProfile,
    DamDataIngestRequest,
    DamDataIngestResponse,
    LlmHealthResponse,
    PakistanLiveDamResponse,
    PakistanLiveSimulationResponse,
    MultiAgentNegotiationRequest,
    MultiAgentNegotiationResponse,
    NegotiationRequest,
    NegotiationResponse,
    PakistanWeatherResponse,
    PolicyBriefRequest,
    PolicyBriefResponse,
    PresetResponse,
    SimulationRequest,
    SimulationResponse,
    StressTestRequest,
    StressTestResponse,
)
from app.services.dam_data import build_dam_ingest_summary
from app.services.groq_client import (
    check_llm_health,
    generate_multiagent_transcript,
    generate_negotiation,
    generate_policy_brief,
)
from app.services.pakistan_live import build_pakistan_live_request, fetch_pakistan_live_dams
from app.services.presets import list_presets
from app.services.simulation import run_simulation, run_stress_test
from app.services.weather import get_pakistan_weather


router = APIRouter()


def _raise_groq_http_error(exc: RuntimeError) -> None:
    detail = str(exc)
    status_code = 400 if "GROQ_API_KEY is not set" in detail else 502
    raise HTTPException(status_code=status_code, detail=detail) from exc


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


@router.get("/llm/health", response_model=LlmHealthResponse)
def llm_health(
    probe: bool = Query(default=False, description="When true, performs a live Groq API probe."),
    model: Optional[str] = Query(default=None, description="Optional model override for probe."),
) -> LlmHealthResponse:
    return LlmHealthResponse(**check_llm_health(probe=probe, model=model))


@router.get("/weather/pakistan", response_model=PakistanWeatherResponse)
def pakistan_weather() -> PakistanWeatherResponse:
    return get_pakistan_weather()


@router.post("/data/dams/ingest", response_model=DamDataIngestResponse)
def ingest_dam_data(request: DamDataIngestRequest) -> DamDataIngestResponse:
    try:
        return build_dam_ingest_summary(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/data/dams/pakistan-live", response_model=PakistanLiveDamResponse)
def pakistan_live_dams() -> PakistanLiveDamResponse:
    try:
        return fetch_pakistan_live_dams()
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.get("/simulate/pakistan-live", response_model=PakistanLiveSimulationResponse)
def simulate_pakistan_live(
    policy: Literal["fair", "equal", "proportional", "quota", "pakistan-quota"] = Query(
        default="pakistan-quota",
        description="Policy to run on live Pakistan data.",
    ),
    days: int = Query(default=30, ge=1, le=365),
    compare_policies: bool = Query(default=False),
    maf_to_model_units: float = Query(default=120.0, gt=0),
) -> PakistanLiveSimulationResponse:
    try:
        live_data, request = build_pakistan_live_request(
            policy=policy,
            days=days,
            compare_policies=compare_policies,
            maf_to_model_units=maf_to_model_units,
        )
        simulation = run_simulation(request)
        return PakistanLiveSimulationResponse(
            live_data=live_data,
            request=request,
            simulation=simulation,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


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
        _raise_groq_http_error(exc)
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
        _raise_groq_http_error(exc)
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
        _raise_groq_http_error(exc)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Groq request failed: {exc}") from exc

    return PolicyBriefResponse(model=model, content=content)
