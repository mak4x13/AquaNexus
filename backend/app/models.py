from datetime import date
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class FarmConfig(BaseModel):
    id: str = Field(min_length=1)
    crop_type: str = Field(min_length=1)
    base_demand: float = Field(ge=0)
    yield_a: float = Field(default=1.0, ge=0)
    resilience: float = Field(default=0.5, ge=0, le=1)
    province: Optional[str] = None


class SimulationConfig(BaseModel):
    days: int = Field(default=30, ge=1, le=365)
    reservoir_capacity: float = Field(ge=0)
    initial_reservoir: float = Field(ge=0)
    max_daily_allocation: float = Field(ge=0)

    rainfall_prob: float = Field(default=0.3, ge=0, le=1)
    rainfall_mean: float = Field(default=20.0, ge=0)
    rainfall_std: float = Field(default=5.0, ge=0)
    drought_prob: float = Field(default=0.1, ge=0, le=1)
    drought_multiplier: float = Field(default=0.5, ge=0, le=1)
    drought_demand_reduction: float = Field(default=0.25, ge=0, le=1)

    conveyance_loss_rate: float = Field(default=0.0, ge=0, le=0.95)

    sustainability_threshold: float = Field(default=0.2, ge=0, le=1)
    alpha: float = Field(default=1.0, ge=0)
    beta: float = Field(default=1.0, ge=0)
    fairness_weight: float = Field(default=0.5, ge=0, le=1)

    province_quotas: Optional[Dict[str, float]] = None
    quota_mode: Literal["share", "absolute"] = "share"

    groundwater_capacity: float = Field(default=0.0, ge=0)
    initial_groundwater: float = Field(default=0.0, ge=0)
    max_groundwater_pumping: float = Field(default=0.0, ge=0)
    groundwater_recharge: float = Field(default=0.0, ge=0)
    groundwater_penalty_weight: float = Field(default=0.0, ge=0)

    external_inflow_series: Optional[List[float]] = None
    seed: Optional[int] = None


class SimulationRequest(BaseModel):
    farms: List[FarmConfig]
    config: SimulationConfig
    policy: Literal["fair", "equal", "proportional", "quota", "pakistan-quota"] = "fair"
    compare_policies: bool = True


class FarmSummary(BaseModel):
    id: str
    crop_type: str
    total_allocated: float
    total_yield: float
    average_allocation: float
    average_yield: float
    unmet_demand_total: float


class DayMetrics(BaseModel):
    day: int
    rainfall: float
    drought: bool
    reservoir_start: float
    reservoir_end: float
    groundwater_end: float
    total_allocated: float
    total_yield: float
    conveyance_loss: float
    groundwater_used: float
    gini: float
    depletion_risk: float
    score: float


class SimulationSummary(BaseModel):
    policy: str
    total_yield: float
    avg_gini: float
    avg_depletion_risk: float
    final_reservoir: float
    final_groundwater: float
    sustainability_score: float
    total_conveyance_loss: float
    total_groundwater_used: float


class SimulationResult(BaseModel):
    summary: SimulationSummary
    daily: List[DayMetrics]
    farms: List[FarmSummary]


class SimulationResponse(BaseModel):
    primary: SimulationResult
    comparisons: List[SimulationResult] = Field(default_factory=list)


class StressMetric(BaseModel):
    mean: float
    p10: float
    p90: float
    min: float
    max: float


class StressTestSummary(BaseModel):
    runs: int
    total_yield: StressMetric
    avg_gini: StressMetric
    avg_depletion_risk: StressMetric
    final_reservoir: StressMetric
    final_groundwater: StressMetric
    total_groundwater_used: StressMetric
    prob_below_threshold: float


class StressTestRequest(BaseModel):
    farms: List[FarmConfig]
    config: SimulationConfig
    policy: Literal["fair", "equal", "proportional", "quota", "pakistan-quota"] = "fair"
    runs: int = Field(default=50, ge=1, le=500)


class StressTestResponse(BaseModel):
    summary: StressTestSummary


class NegotiationRequest(BaseModel):
    prompt: str = Field(min_length=1)
    context: Optional[Dict[str, object]] = None
    model: Optional[str] = None
    temperature: float = Field(default=0.2, ge=0, le=2)
    dry_run: bool = False


class NegotiationResponse(BaseModel):
    model: str
    content: str


class PolicyBriefRequest(BaseModel):
    simulation: SimulationResponse
    region: str = "Pakistan"
    focus: Optional[str] = None
    model: Optional[str] = None
    temperature: float = Field(default=0.2, ge=0, le=2)
    dry_run: bool = False


class PolicyBriefResponse(BaseModel):
    model: str
    content: str


class AgentProfile(BaseModel):
    id: str = Field(min_length=1)
    role: Literal["farm", "reservoir", "policy", "climate", "observer"]
    goal: str = Field(min_length=1)
    constraints: Optional[List[str]] = None


class AgentTurn(BaseModel):
    round: int
    agent_id: str
    role: str
    message: str


class MultiAgentNegotiationRequest(BaseModel):
    prompt: str = Field(min_length=1)
    agents: List[AgentProfile] = Field(default_factory=list)
    rounds: int = Field(default=3, ge=1, le=10)
    context: Optional[Dict[str, object]] = None
    simulation: Optional[SimulationResponse] = None
    auto_agents: bool = False
    region: Optional[str] = None
    model: Optional[str] = None
    temperature: float = Field(default=0.3, ge=0, le=2)
    dry_run: bool = False


class MultiAgentNegotiationResponse(BaseModel):
    model: str
    transcript: List[AgentTurn]
    agreement: Optional[str] = None


class PresetResponse(BaseModel):
    id: str
    name: str
    description: str
    request: SimulationRequest


class LlmHealthResponse(BaseModel):
    key_configured: bool
    model: str
    probe_attempted: bool
    reachable: bool
    detail: Optional[str] = None


class ProvinceWeather(BaseModel):
    province: str
    city: str
    latitude: float
    longitude: float
    temperature_c: float
    precipitation_mm: float
    windspeed_kmh: float
    drought_risk: float = Field(ge=0, le=1)


class PakistanWeatherResponse(BaseModel):
    source: str
    timestamp_utc: str
    provinces: List[ProvinceWeather]


class DamDailyRecord(BaseModel):
    date: date
    dam: str = Field(min_length=1)
    storage_maf: float = Field(ge=0)
    inflow_cusecs: float = Field(ge=0)
    outflow_cusecs: float = Field(ge=0)


class DamDataIngestRequest(BaseModel):
    source: str = Field(default="manual", min_length=1)
    records: List[DamDailyRecord] = Field(min_length=1)
    maf_to_model_units: float = Field(default=120.0, gt=0, le=10000)


class DamConfigSuggestion(BaseModel):
    days: int
    reservoir_capacity: float
    initial_reservoir: float
    max_daily_allocation: float
    external_inflow_series: List[float]
    notes: List[str]


class DamDataIngestResponse(BaseModel):
    source: str
    dams: List[str]
    date_from: str
    date_to: str
    observations: int
    latest_total_storage_maf: float
    max_total_storage_maf: float
    mean_inflow_cusecs: float
    mean_outflow_cusecs: float
    suggested_config: DamConfigSuggestion


class LiveDamStation(BaseModel):
    dam: str
    inflow_cusecs: float = Field(ge=0)
    outflow_cusecs: float = Field(ge=0)
    current_level_ft: Optional[float] = Field(default=None, ge=0)
    estimated_storage_maf: Optional[float] = Field(default=None, ge=0)


class PakistanLiveDamResponse(BaseModel):
    source: str
    source_url: str
    fetched_at_utc: str
    updated_at_pkt: Optional[str] = None
    stations: List[LiveDamStation]
    notes: List[str] = Field(default_factory=list)


class PakistanLiveSimulationResponse(BaseModel):
    live_data: PakistanLiveDamResponse
    request: SimulationRequest
    simulation: SimulationResponse
