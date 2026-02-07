import math
import random
from typing import Dict, List, Sequence, Tuple

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
PAKISTAN_PROVINCES = {
    "Punjab",
    "Sindh",
    "Khyber Pakhtunkhwa",
    "Balochistan",
}


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


def _resolve_climate_series(config: SimulationConfig) -> List[ClimateDay]:
    base_series = _generate_climate_series(config)
    external = config.external_inflow_series
    if not external:
        return base_series

    if len(external) < config.days:
        raise ValueError(
            "external_inflow_series length must be at least equal to config.days."
        )
    if any(value < 0 for value in external):
        raise ValueError("external_inflow_series values must be non-negative.")

    inflow = [float(value) for value in external[: config.days]]
    baseline = sum(inflow) / len(inflow) if inflow else 0.0
    drought_threshold = baseline * config.drought_multiplier

    resolved: List[ClimateDay] = []
    for i, _ in enumerate(base_series):
        rainfall = inflow[i]
        if baseline <= 0:
            drought = True
        else:
            drought = rainfall < drought_threshold
        resolved.append((rainfall, drought))
    return resolved


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


def _validate_farms(farms: List[FarmConfig]) -> None:
    if not farms:
        raise ValueError("At least one farm is required.")

    seen_ids = set()
    duplicates = set()
    for farm in farms:
        if farm.id in seen_ids:
            duplicates.add(farm.id)
        seen_ids.add(farm.id)

    if duplicates:
        duplicate_list = ", ".join(sorted(duplicates))
        raise ValueError(f"Farm IDs must be unique. Duplicate IDs: {duplicate_list}.")


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


def _normalize_quotas(quotas: Dict[str, float]) -> Dict[str, float]:
    total = sum(max(0.0, value) for value in quotas.values())
    if total <= 0:
        raise ValueError("province_quotas must contain positive values.")
    return {key: max(0.0, value) / total for key, value in quotas.items()}


def _allocate_with_quota(
    farms: List[FarmConfig],
    demands: List[float],
    available: float,
    config: SimulationConfig,
) -> List[float]:
    if not config.province_quotas:
        raise ValueError("province_quotas must be provided for quota policy.")

    provinces = []
    for farm in farms:
        if not farm.province:
            raise ValueError("All farms must include a province for quota policy.")
        provinces.append(farm.province)

    allocations = [0.0] * len(farms)

    if config.quota_mode == "share":
        shares = _normalize_quotas(config.province_quotas)
        province_caps = {prov: available * shares.get(prov, 0.0) for prov in set(provinces)}
    else:
        total_quota = sum(max(0.0, value) for value in config.province_quotas.values())
        if total_quota <= 0:
            raise ValueError("province_quotas must contain positive values.")
        scale = min(1.0, available / total_quota) if total_quota > 0 else 0.0
        province_caps = {
            prov: max(0.0, config.province_quotas.get(prov, 0.0)) * scale
            for prov in set(provinces)
        }

    for province in set(provinces):
        indices = [i for i, prov in enumerate(provinces) if prov == province]
        if not indices:
            continue
        province_demands = [demands[i] for i in indices]
        cap = province_caps.get(province, 0.0)
        province_allocs = _allocate_water(province_demands, cap, "fair", config.fairness_weight)
        for idx, alloc in zip(indices, province_allocs):
            allocations[idx] = alloc

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


def _allocate_groundwater(unmet: List[float], available: float) -> List[float]:
    if available <= 0:
        return [0.0] * len(unmet)
    total_unmet = sum(unmet)
    if total_unmet <= 0:
        return [0.0] * len(unmet)
    return [available * demand / total_unmet for demand in unmet]


def _simulate_policy(
    farms: List[FarmConfig],
    config: SimulationConfig,
    policy: str,
    climate_series: List[ClimateDay],
) -> SimulationResult:
    capacity = config.reservoir_capacity
    reservoir = min(config.initial_reservoir, capacity)

    groundwater_capacity = config.groundwater_capacity
    groundwater = min(config.initial_groundwater, groundwater_capacity)

    farm_alloc_total = [0.0] * len(farms)
    farm_yield_total = [0.0] * len(farms)
    unmet_demand_total = [0.0] * len(farms)

    total_conveyance_loss = 0.0
    total_groundwater_used = 0.0

    daily: List[DayMetrics] = []

    for day_index, (rainfall, drought) in enumerate(climate_series, 1):
        reservoir_start = reservoir
        reservoir = min(capacity, reservoir + rainfall)

        groundwater = min(groundwater_capacity, groundwater + config.groundwater_recharge)

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
        total_conveyance_loss += conveyance_loss

        if policy == "quota":
            allocations_surface = _allocate_with_quota(farms, demands, delivered, config)
        else:
            allocations_surface = _allocate_water(demands, delivered, policy, config.fairness_weight)

        unmet = [max(0.0, demand - alloc) for demand, alloc in zip(demands, allocations_surface)]

        groundwater_used = 0.0
        allocations_ground = [0.0] * len(farms)
        if config.max_groundwater_pumping > 0 and groundwater > 0 and sum(unmet) > 0:
            available_gw = min(config.max_groundwater_pumping, groundwater)
            groundwater_used = min(available_gw, sum(unmet))
            allocations_ground = _allocate_groundwater(unmet, groundwater_used)
            groundwater = max(0.0, groundwater - groundwater_used)
            total_groundwater_used += groundwater_used

        allocations = [
            surface + ground for surface, ground in zip(allocations_surface, allocations_ground)
        ]

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

        groundwater_penalty = 0.0
        if config.groundwater_penalty_weight > 0:
            denom = groundwater_capacity if groundwater_capacity > 0 else 1.0
            groundwater_penalty = config.groundwater_penalty_weight * (groundwater_used / denom)

        score = total_yield - config.alpha * depletion_risk - config.beta * gini - groundwater_penalty

        daily.append(
            DayMetrics(
                day=day_index,
                rainfall=rainfall,
                drought=drought,
                reservoir_start=reservoir_start,
                reservoir_end=reservoir,
                groundwater_end=groundwater,
                total_allocated=total_allocated,
                total_yield=total_yield,
                conveyance_loss=conveyance_loss,
                groundwater_used=groundwater_used,
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
        final_groundwater=groundwater,
        sustainability_score=sustainability_score,
        total_conveyance_loss=total_conveyance_loss,
        total_groundwater_used=total_groundwater_used,
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


def _apply_pakistan_quota_defaults(
    farms: List[FarmConfig],
    config: SimulationConfig,
) -> SimulationConfig:
    provinces = [farm.province for farm in farms]
    if not any(provinces):
        raise ValueError("province is required on farms for pakistan-quota policy.")
    if any(province is None for province in provinces):
        raise ValueError("All farms must include province for pakistan-quota policy.")

    unique = sorted({province for province in provinces if province is not None})
    invalid = [province for province in unique if province not in PAKISTAN_PROVINCES]
    if invalid:
        invalid_list = ", ".join(invalid)
        raise ValueError(
            "pakistan-quota policy only supports Punjab, Sindh, Khyber Pakhtunkhwa, "
            f"and Balochistan. Invalid province(s): {invalid_list}."
        )

    if config.province_quotas:
        invalid_quota_keys = sorted(
            province for province in config.province_quotas if province not in PAKISTAN_PROVINCES
        )
        if invalid_quota_keys:
            invalid_list = ", ".join(invalid_quota_keys)
            raise ValueError(
                "province_quotas contains invalid province(s) for pakistan-quota policy: "
                f"{invalid_list}."
            )
        return config

    share = 1.0 / len(unique)
    quotas = {province: share for province in unique}
    return config.model_copy(update={"province_quotas": quotas, "quota_mode": "share"})


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
    _validate_farms(request.farms)
    if request.config.initial_reservoir > request.config.reservoir_capacity:
        raise ValueError("initial_reservoir cannot exceed reservoir_capacity.")
    if request.config.initial_groundwater > request.config.groundwater_capacity:
        raise ValueError("initial_groundwater cannot exceed groundwater_capacity.")

    policy = request.policy
    config = request.config
    if policy == "pakistan-quota":
        config = _apply_pakistan_quota_defaults(request.farms, config)
        policy = "quota"

    climate_series = _resolve_climate_series(config)
    primary = _simulate_policy(request.farms, config, policy, climate_series)

    comparisons: List[SimulationResult] = []
    if request.compare_policies:
        active_policy = "quota" if request.policy == "pakistan-quota" else request.policy
        for policy in ["equal", "proportional", "fair"]:
            if policy == active_policy:
                continue
            comparisons.append(_simulate_policy(request.farms, config, policy, climate_series))

    return SimulationResponse(primary=primary, comparisons=comparisons)


def run_stress_test(request: StressTestRequest) -> StressTestResponse:
    _validate_farms(request.farms)
    if request.config.initial_reservoir > request.config.reservoir_capacity:
        raise ValueError("initial_reservoir cannot exceed reservoir_capacity.")
    if request.config.initial_groundwater > request.config.groundwater_capacity:
        raise ValueError("initial_groundwater cannot exceed groundwater_capacity.")

    policy = request.policy
    config = request.config
    if policy == "pakistan-quota":
        config = _apply_pakistan_quota_defaults(request.farms, config)
        policy = "quota"

    if config.seed is None:
        rng = random.Random()
        seeds = [rng.randint(0, 1_000_000_000) for _ in range(request.runs)]
    else:
        seeds = [config.seed + i for i in range(request.runs)]

    total_yield_vals: List[float] = []
    avg_gini_vals: List[float] = []
    avg_depletion_vals: List[float] = []
    final_reservoir_vals: List[float] = []
    final_groundwater_vals: List[float] = []
    total_groundwater_used_vals: List[float] = []

    for seed in seeds:
        config_run = config.model_copy(update={"seed": seed})
        climate_series = _resolve_climate_series(config_run)
        result = _simulate_policy(request.farms, config_run, policy, climate_series)
        summary = result.summary
        total_yield_vals.append(summary.total_yield)
        avg_gini_vals.append(summary.avg_gini)
        avg_depletion_vals.append(summary.avg_depletion_risk)
        final_reservoir_vals.append(summary.final_reservoir)
        final_groundwater_vals.append(summary.final_groundwater)
        total_groundwater_used_vals.append(summary.total_groundwater_used)

    threshold = request.config.sustainability_threshold * request.config.reservoir_capacity
    below_threshold = sum(1 for val in final_reservoir_vals if val < threshold)
    prob_below_threshold = below_threshold / len(final_reservoir_vals) if final_reservoir_vals else 0.0

    summary = StressTestSummary(
        runs=request.runs,
        total_yield=_build_metric(total_yield_vals),
        avg_gini=_build_metric(avg_gini_vals),
        avg_depletion_risk=_build_metric(avg_depletion_vals),
        final_reservoir=_build_metric(final_reservoir_vals),
        final_groundwater=_build_metric(final_groundwater_vals),
        total_groundwater_used=_build_metric(total_groundwater_used_vals),
        prob_below_threshold=prob_below_threshold,
    )

    return StressTestResponse(summary=summary)
