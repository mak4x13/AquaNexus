import math
import re
import ssl
from datetime import datetime, timezone
from statistics import mean
from typing import Dict, List, Literal, Optional, Tuple
from urllib.error import URLError
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener

from app.models import (
    FarmConfig,
    LiveDamStation,
    PakistanLiveDamResponse,
    SimulationConfig,
    SimulationRequest,
)
from app.services.weather import get_pakistan_weather


RIVER_STATE_URL = "https://ffd.pmd.gov.pk/river-state?zoom=6"
CUSECS_TO_MAF_PER_DAY = 0.000001984
CACHE_TTL_SECONDS = 600

DAM_CAPACITY_MAF = {
    "Tarbela Dam": 11.62,
    "Mangla Dam": 7.39,
    "Chashma": 0.87,
}

DAM_LEVEL_BOUNDS_FT = {
    "Tarbela Dam": (1402.0, 1550.0),
    "Mangla Dam": (1050.0, 1242.0),
}


_LIVE_CACHE: Dict[str, object] = {
    "expires_at": 0.0,
    "value": None,
}


def _parse_number(value: str) -> float:
    cleaned = value.replace(",", "").strip()
    return float(cleaned)


def _build_http_opener() -> object:
    # Some hosts fail when system proxy points to local tooling; bypass proxies explicitly.
    context = ssl._create_unverified_context()
    return build_opener(
        ProxyHandler({}),
        HTTPSHandler(context=context),
    )


def _fetch_html(url: str) -> str:
    opener = _build_http_opener()
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with opener.open(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def _extract_station_block(html: str, station: str) -> Optional[str]:
    match = re.search(
        rf"<h5\s*>\s*{re.escape(station)}\s*</h5>(.*?)</table>",
        html,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return match.group(1) if match else None


def _extract_inflow_outflow(block: str) -> Tuple[float, float]:
    inflow_match = re.search(
        r"<td>\s*INFLOW\s*</td>\s*<td>\s*([0-9,\.]+)",
        block,
        flags=re.IGNORECASE | re.DOTALL,
    )
    outflow_match = re.search(
        r"<td>\s*OUTFLOW\s*</td>\s*<td>\s*([0-9,\.]+)",
        block,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if not inflow_match or not outflow_match:
        raise ValueError("Could not parse inflow/outflow values from station block.")
    return _parse_number(inflow_match.group(1)), _parse_number(outflow_match.group(1))


def _extract_current_level_near_station(html: str, station: str) -> Optional[float]:
    marker = f"<h5 >{station}</h5>"
    station_index = html.find(marker)
    if station_index < 0:
        station_index = html.lower().find(station.lower())
    if station_index < 0:
        return None

    prefix = html[max(0, station_index - 3000) : station_index]
    levels = re.findall(r"Current Level:\s*<b>([0-9\.]+)</b>", prefix, flags=re.IGNORECASE)
    if not levels:
        return None
    return _parse_number(levels[-1])


def _estimate_storage_maf(station: str, current_level_ft: Optional[float]) -> Optional[float]:
    capacity = DAM_CAPACITY_MAF.get(station)
    if capacity is None:
        return None

    bounds = DAM_LEVEL_BOUNDS_FT.get(station)
    if bounds is None or current_level_ft is None:
        return capacity * 0.55

    dead_level, full_level = bounds
    if full_level <= dead_level:
        return capacity * 0.55

    ratio = (current_level_ft - dead_level) / (full_level - dead_level)
    ratio = max(0.0, min(1.0, ratio))
    return capacity * ratio


def _cache_get() -> Optional[PakistanLiveDamResponse]:
    cached = _LIVE_CACHE.get("value")
    expires_at = _LIVE_CACHE.get("expires_at", 0.0)
    if not isinstance(cached, PakistanLiveDamResponse):
        return None
    if datetime.now(timezone.utc).timestamp() > float(expires_at):
        return None
    return cached


def _cache_set(value: PakistanLiveDamResponse) -> None:
    _LIVE_CACHE["value"] = value
    _LIVE_CACHE["expires_at"] = datetime.now(timezone.utc).timestamp() + CACHE_TTL_SECONDS


def fetch_pakistan_live_dams() -> PakistanLiveDamResponse:
    cached = _cache_get()
    if cached is not None:
        return cached

    try:
        html = _fetch_html(RIVER_STATE_URL)
    except URLError as exc:
        stale = _LIVE_CACHE.get("value")
        if isinstance(stale, PakistanLiveDamResponse):
            stale_copy = stale.model_copy(deep=True)
            stale_copy.notes.append(
                "Serving stale cache because live source is temporarily unreachable."
            )
            return stale_copy
        raise RuntimeError(f"Unable to reach live dam source: {exc}") from exc

    updated_match = re.search(
        r"Map is last updated on\s*<b>([^<]+)</b>",
        html,
        flags=re.IGNORECASE,
    )
    updated_at_pkt = updated_match.group(1).strip() if updated_match else None

    stations: List[LiveDamStation] = []
    notes: List[str] = []
    expected = ["Tarbela Dam", "Mangla Dam", "Chashma"]

    for name in expected:
        block = _extract_station_block(html, name)
        if block is None:
            notes.append(f"{name} was not found in live source.")
            continue

        inflow, outflow = _extract_inflow_outflow(block)
        level_ft = _extract_current_level_near_station(html, name)
        estimated_storage = _estimate_storage_maf(name, level_ft)
        stations.append(
            LiveDamStation(
                dam=name,
                inflow_cusecs=inflow,
                outflow_cusecs=outflow,
                current_level_ft=level_ft,
                estimated_storage_maf=estimated_storage,
            )
        )

    if not stations:
        raise RuntimeError("Live dam source returned no parseable stations.")

    notes.append("Data is parsed from FFD river-state dashboard values.")
    notes.append("Estimated storage uses level-to-capacity mapping for Tarbela/Mangla and heuristic for Chashma.")

    result = PakistanLiveDamResponse(
        source="ffd-river-state",
        source_url=RIVER_STATE_URL,
        fetched_at_utc=datetime.now(timezone.utc).isoformat(),
        updated_at_pkt=updated_at_pkt,
        stations=stations,
        notes=notes,
    )
    _cache_set(result)
    return result


def _build_projection_series(base_inflow_units: float, drought_risk: float, days: int) -> List[float]:
    if days <= 0:
        return []
    if base_inflow_units <= 0:
        return [0.0] * days

    risk_factor = 1.0 - min(0.6, max(0.0, drought_risk * 0.4))
    series: List[float] = []
    for day in range(days):
        weekly_cycle = 1.0 + 0.12 * math.sin((2 * math.pi * day) / 7.0)
        value = base_inflow_units * risk_factor * weekly_cycle
        series.append(max(0.0, value))
    return series


def _default_pakistan_farms() -> List[FarmConfig]:
    return [
        FarmConfig(
            id="pk-wheat",
            crop_type="wheat",
            base_demand=42,
            yield_a=7.5,
            resilience=0.55,
            province="Punjab",
        ),
        FarmConfig(
            id="pk-rice",
            crop_type="rice",
            base_demand=58,
            yield_a=9.5,
            resilience=0.35,
            province="Sindh",
        ),
        FarmConfig(
            id="pk-maize-kp",
            crop_type="maize",
            base_demand=34,
            yield_a=7.8,
            resilience=0.5,
            province="Khyber Pakhtunkhwa",
        ),
        FarmConfig(
            id="pk-orchard-balochistan",
            crop_type="orchard",
            base_demand=26,
            yield_a=6.8,
            resilience=0.62,
            province="Balochistan",
        ),
    ]


def build_pakistan_live_request(
    policy: Literal["fair", "equal", "proportional", "quota", "pakistan-quota"] = "pakistan-quota",
    days: int = 30,
    compare_policies: bool = False,
    maf_to_model_units: float = 120.0,
) -> Tuple[PakistanLiveDamResponse, SimulationRequest]:
    if days < 1 or days > 365:
        raise ValueError("days must be between 1 and 365.")

    live = fetch_pakistan_live_dams()
    total_capacity_maf = sum(DAM_CAPACITY_MAF.values())
    total_storage_maf = sum(
        station.estimated_storage_maf or 0.0 for station in live.stations
    )
    total_inflow_cusecs = sum(station.inflow_cusecs for station in live.stations)
    total_outflow_cusecs = sum(station.outflow_cusecs for station in live.stations)

    reservoir_capacity = max(1.0, total_capacity_maf * maf_to_model_units)
    initial_reservoir = max(0.0, min(reservoir_capacity, total_storage_maf * maf_to_model_units))
    max_daily_allocation = max(
        1.0,
        total_outflow_cusecs * CUSECS_TO_MAF_PER_DAY * maf_to_model_units,
    )
    base_inflow_units = total_inflow_cusecs * CUSECS_TO_MAF_PER_DAY * maf_to_model_units

    weather = get_pakistan_weather()
    drought_risk = mean(row.drought_risk for row in weather.provinces) if weather.provinces else 0.4
    external_inflow_series = _build_projection_series(base_inflow_units, drought_risk, days)

    config = SimulationConfig(
        days=days,
        reservoir_capacity=reservoir_capacity,
        initial_reservoir=initial_reservoir,
        max_daily_allocation=max_daily_allocation,
        rainfall_prob=0.25,
        rainfall_mean=10.0,
        rainfall_std=3.0,
        drought_prob=max(0.05, min(0.8, drought_risk)),
        drought_multiplier=0.5,
        drought_demand_reduction=0.3,
        conveyance_loss_rate=0.25,
        sustainability_threshold=0.2,
        alpha=1.0,
        beta=1.0,
        fairness_weight=0.6,
        province_quotas={
            "Punjab": 0.48,
            "Sindh": 0.38,
            "Khyber Pakhtunkhwa": 0.09,
            "Balochistan": 0.05,
        },
        quota_mode="share",
        groundwater_capacity=300,
        initial_groundwater=200,
        max_groundwater_pumping=20,
        groundwater_recharge=3,
        groundwater_penalty_weight=0.5,
        external_inflow_series=external_inflow_series,
        seed=42,
    )

    live.notes.append(
        "Multi-day inflow series is projected from latest live inflow/outflow snapshot and weather-driven drought risk."
    )

    request = SimulationRequest(
        farms=_default_pakistan_farms(),
        config=config,
        policy=policy,
        compare_policies=compare_policies,
    )
    return live, request
