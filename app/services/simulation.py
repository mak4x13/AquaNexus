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
    StressMetric,
    StressTestRequest,
    StressTestResponse,
    StressTestSummary,
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


def _compute_release(total_demand: float, reservoir: float, max_allocation: float, loss_rate: float) -> Tuple[float, float]:
    release_cap = min(max_allocation, reservoir)
    if release_cap <= 0:
        return 0.0, 0.0
    if loss_rate >= 1:
        return release_cap, 0.0

    deliverable_cap = release_cap * (1 - loss_rate)
    if total_demand <= deliverable_cap:
        release = total_demand / (1 - loss_rate) if total_demand > 0 else 0.0
    else:
        release = release_cap
    delivered = release * (1 - loss_rate)
    return release, delivered


def _effective_demand(farm: FarmConfig, drought: bool, config: SimulationConfig) -> float:
    if not drought or config.drought_demand_reduction <= 0:
        return farm.base_demand
    reduction = min(1.0, max(0.0, config.drought_demand_reduction * farm.resilience))
    return max(0.0, farm.base_demand * (1 - reduction))


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

        demands = [_effective_demand(farm, drought, config) for farm in farms]
        total_demand = sum(demands)

        release, delivered = _compute_release(
            total_demand=total_demand,
            reservoir=reservoir,
            max_allocation=max_allocation,
            loss_rate=config.conveyance_loss_rate,
        )
        conveyance_loss = max(0.0, release - delivered)

        allocations = _allocate_water(demands, delivered, policy, config.fairness_weight)

        total_allocated = sum(allocations)
        reservoir = max(0.0, reservoir - release)

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
                conveyance_loss=conveyance_loss,
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
    total_conveyance_loss = sum(day.conveyance_loss for day in daily)

    summary = SimulationSummary(
        policy=policy,
        total_yield=total_yield,
        avg_gini=avg_gini,
        avg_depletion_risk=avg_depletion,
        final_reservoir=reservoir,
        sustainability_score=sustainability_score,
        total_conveyance_loss=total_conveyance_loss,
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


def _quantile(values: Sequence[float], q: float) -> float:
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    pos = (len(sorted_vals) - 1) * q
    lower = int(math.floor(pos))
    upper = int(math.ceil(pos))
    if lower == upper:
        return sorted_vals[lower]
    weight = pos - lower
    return sorted_vals[lower] * (1 - weight) + sorted_vals[upper] * weight


def _build_metric(values: Sequence[float]) -> StressMetric:
    return StressMetric(
        mean=sum(values) / len(values) if values else 0.0,
        p10=_quantile(values, 0.1),
        p90=_quantile(values, 0.9),
        min=min(values) if values else 0.0,
        max=max(values) if values else 0.0,
    )


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


def run_stress_test(request: StressTestRequest) -> StressTestResponse:
    if not request.farms:
        raise ValueError("At least one farm is required.")
    if request.config.initial_reservoir > request.config.reservoir_capacity:
        raise ValueError("initial_reservoir cannot exceed reservoir_capacity.")

    if request.config.seed is None:
        rng = random.Random()
        seeds = [rng.randint(0, 1_000_000_000) for _ in range(request.runs)]
    else:
        seeds = [request.config.seed + i for i in range(request.runs)]

    total_yield_vals: List[float] = []
    avg_gini_vals: List[float] = []
    avg_depletion_vals: List[float] = []
    final_reservoir_vals: List[float] = []

    for seed in seeds:
        config = request.config.model_copy(update={"seed": seed})
        climate_series = _generate_climate_series(config)
        result = _simulate_policy(request.farms, config, request.policy, climate_series)
        summary = result.summary
        total_yield_vals.append(summary.total_yield)
        avg_gini_vals.append(summary.avg_gini)
        avg_depletion_vals.append(summary.avg_depletion_risk)
        final_reservoir_vals.append(summary.final_reservoir)

    threshold = request.config.sustainability_threshold * request.config.reservoir_capacity
    below_threshold = sum(1 for val in final_reservoir_vals if val < threshold)
    prob_below_threshold = below_threshold / len(final_reservoir_vals) if final_reservoir_vals else 0.0

    summary = StressTestSummary(
        runs=request.runs,
        total_yield=_build_metric(total_yield_vals),
        avg_gini=_build_metric(avg_gini_vals),
        avg_depletion_risk=_build_metric(avg_depletion_vals),
        final_reservoir=_build_metric(final_reservoir_vals),
        prob_below_threshold=prob_below_threshold,
    )

    return StressTestResponse(summary=summary)