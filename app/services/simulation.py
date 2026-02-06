import math
import random
from typing import List, Sequence, Tuple

from app.models import (
    DayMetrics,
    FarmConfig,
    FarmSummary,
    SimulationConfig,
    SimulationRequest,
    SimulationResponse,
    SimulationResult,
    SimulationSummary,
)

ClimateDay = Tuple[float, bool]


def _generate_climate_series(config: SimulationConfig) -> List[ClimateDay]:
    rng = random.Random(config.seed)
    series: List[ClimateDay] = []
    for _ in range(config.days):
        rainfall = 0.0
        if rng.random() < config.rainfall_prob:
            rainfall = max(0.0, rng.gauss(config.rainfall_mean, config.rainfall_std))
        drought = rng.random() < config.drought_prob
        series.append((rainfall, drought))
    return series


def _gini_coefficient(values: Sequence[float]) -> float:
    n = len(values)
    if n == 0:
        return 0.0
    total = sum(values)
    if total <= 0:
        return 0.0
    sorted_vals = sorted(values)
    cumulative = 0.0
    for i, val in enumerate(sorted_vals, 1):
        cumulative += i * val
    gini = (2 * cumulative) / (n * total) - (n + 1) / n
    return max(0.0, min(1.0, gini))


def _redistribute_leftover(allocations: List[float], demands: List[float], available: float) -> List[float]:
    leftover = available - sum(allocations)
    unmet = [i for i, demand in enumerate(demands) if allocations[i] < demand]
    while leftover > 1e-6 and unmet:
        share = leftover / len(unmet)
        used = 0.0
        for i in unmet:
            gap = demands[i] - allocations[i]
            if gap <= 0:
                continue
            add = min(share, gap)
            allocations[i] += add
            used += add
        if used <= 1e-9:
            break
        leftover -= used
        unmet = [i for i, demand in enumerate(demands) if allocations[i] < demand]
    return allocations


def _allocate_water(
    demands: List[float],
    available: float,
    policy: str,
    fairness_weight: float,
) -> List[float]:
    n = len(demands)
    if n == 0 or available <= 0:
        return [0.0] * n
    total_demand = sum(demands)
    if total_demand <= 0:
        return [0.0] * n

    if policy == "equal":
        base = [available / n] * n
    elif policy == "proportional":
        base = [available * demand / total_demand for demand in demands]
    elif policy == "fair":
        equal = [available / n] * n
        proportional = [available * demand / total_demand for demand in demands]
        base = [
            (1 - fairness_weight) * prop + fairness_weight * eq
            for prop, eq in zip(proportional, equal)
        ]
    else:
        raise ValueError(f"Unknown policy: {policy}")

    allocations = [min(b, d) for b, d in zip(base, demands)]
    return _redistribute_leftover(allocations, demands, available)


def _simulate_policy(
    farms: List[FarmConfig],
    config: SimulationConfig,
    policy: str,
    climate_series: List[ClimateDay],
) -> SimulationResult:
    capacity = config.reservoir_capacity
    reservoir = min(config.initial_reservoir, capacity)

    farm_alloc_total = [0.0] * len(farms)
    farm_yield_total = [0.0] * len(farms)
    unmet_demand_total = [0.0] * len(farms)

    daily: List[DayMetrics] = []

    for day_index, (rainfall, drought) in enumerate(climate_series, 1):
        reservoir_start = reservoir
        reservoir = min(capacity, reservoir + rainfall)

        max_allocation = config.max_daily_allocation
        if drought:
            max_allocation *= config.drought_multiplier

        available = min(max_allocation, reservoir)
        demands = [farm.base_demand for farm in farms]
        allocations = _allocate_water(demands, available, policy, config.fairness_weight)

        total_allocated = sum(allocations)
        reservoir = max(0.0, reservoir - total_allocated)

        yields = []
        for i, farm in enumerate(farms):
            farm_yield = farm.yield_a * math.log(allocations[i] + 1.0)
            yields.append(farm_yield)
            farm_alloc_total[i] += allocations[i]
            farm_yield_total[i] += farm_yield
            unmet_demand_total[i] += max(0.0, demands[i] - allocations[i])

        total_yield = sum(yields)
        gini = _gini_coefficient(allocations)

        threshold = config.sustainability_threshold * capacity
        depletion_risk = 0.0
        if threshold > 0 and reservoir < threshold:
            depletion_risk = (threshold - reservoir) / threshold

        score = total_yield - config.alpha * depletion_risk - config.beta * gini

        daily.append(
            DayMetrics(
                day=day_index,
                rainfall=rainfall,
                drought=drought,
                reservoir_start=reservoir_start,
                reservoir_end=reservoir,
                total_allocated=total_allocated,
                total_yield=total_yield,
                gini=gini,
                depletion_risk=depletion_risk,
                score=score,
            )
        )

    days = max(config.days, 1)
    avg_gini = sum(day.gini for day in daily) / days
    avg_depletion = sum(day.depletion_risk for day in daily) / days
    total_yield = sum(day.total_yield for day in daily)
    sustainability_score = max(0.0, 1.0 - avg_depletion)

    summary = SimulationSummary(
        policy=policy,
        total_yield=total_yield,
        avg_gini=avg_gini,
        avg_depletion_risk=avg_depletion,
        final_reservoir=reservoir,
        sustainability_score=sustainability_score,
    )

    farm_summaries: List[FarmSummary] = []
    for i, farm in enumerate(farms):
        avg_alloc = farm_alloc_total[i] / days
        avg_yield = farm_yield_total[i] / days
        farm_summaries.append(
            FarmSummary(
                id=farm.id,
                crop_type=farm.crop_type,
                total_allocated=farm_alloc_total[i],
                total_yield=farm_yield_total[i],
                average_allocation=avg_alloc,
                average_yield=avg_yield,
                unmet_demand_total=unmet_demand_total[i],
            )
        )

    return SimulationResult(summary=summary, daily=daily, farms=farm_summaries)


def run_simulation(request: SimulationRequest) -> SimulationResponse:
    if not request.farms:
        raise ValueError("At least one farm is required.")
    if request.config.initial_reservoir > request.config.reservoir_capacity:
        raise ValueError("initial_reservoir cannot exceed reservoir_capacity.")

    climate_series = _generate_climate_series(request.config)
    primary = _simulate_policy(request.farms, request.config, request.policy, climate_series)

    comparisons: List[SimulationResult] = []
    if request.compare_policies:
        for policy in ["equal", "proportional", "fair"]:
            if policy == request.policy:
                continue
            comparisons.append(_simulate_policy(request.farms, request.config, policy, climate_series))

    return SimulationResponse(primary=primary, comparisons=comparisons)