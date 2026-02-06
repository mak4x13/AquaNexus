from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class FarmConfig(BaseModel):
    id: str = Field(min_length=1)
    crop_type: str = Field(min_length=1)
    base_demand: float = Field(ge=0)
    yield_a: float = Field(default=1.0, ge=0)
    resilience: float = Field(default=0.5, ge=0, le=1)


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

    sustainability_threshold: float = Field(default=0.2, ge=0, le=1)
    alpha: float = Field(default=1.0, ge=0)
    beta: float = Field(default=1.0, ge=0)
    fairness_weight: float = Field(default=0.5, ge=0, le=1)
    seed: Optional[int] = None


class SimulationRequest(BaseModel):
    farms: List[FarmConfig]
    config: SimulationConfig
    policy: Literal["fair", "equal", "proportional"] = "fair"
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
    total_allocated: float
    total_yield: float
    gini: float
    depletion_risk: float
    score: float


class SimulationSummary(BaseModel):
    policy: str
    total_yield: float
    avg_gini: float
    avg_depletion_risk: float
    final_reservoir: float
    sustainability_score: float


class SimulationResult(BaseModel):
    summary: SimulationSummary
    daily: List[DayMetrics]
    farms: List[FarmSummary]


class SimulationResponse(BaseModel):
    primary: SimulationResult
    comparisons: List[SimulationResult] = Field(default_factory=list)


class NegotiationRequest(BaseModel):
    prompt: str = Field(min_length=1)
    context: Optional[Dict[str, object]] = None
    model: Optional[str] = None
    temperature: float = Field(default=0.2, ge=0, le=2)


class NegotiationResponse(BaseModel):
    model: str
    content: str