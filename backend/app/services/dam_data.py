from collections import defaultdict
from statistics import mean
from typing import Dict, List, Tuple

from app.models import (
    DamConfigSuggestion,
    DamDataIngestRequest,
    DamDataIngestResponse,
    DamDailyRecord,
)


CUSECS_TO_MAF_PER_DAY = 0.000001984


def _group_by_date(records: List[DamDailyRecord]) -> List[Tuple[str, Dict[str, float]]]:
    grouped: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"storage_maf": 0.0, "inflow_cusecs": 0.0, "outflow_cusecs": 0.0}
    )

    for row in records:
        key = row.date.isoformat()
        grouped[key]["storage_maf"] += row.storage_maf
        grouped[key]["inflow_cusecs"] += row.inflow_cusecs
        grouped[key]["outflow_cusecs"] += row.outflow_cusecs

    return sorted(grouped.items(), key=lambda item: item[0])


def build_dam_ingest_summary(request: DamDataIngestRequest) -> DamDataIngestResponse:
    grouped = _group_by_date(request.records)
    if not grouped:
        raise ValueError("No valid records found.")

    storage_series = [row["storage_maf"] for _, row in grouped]
    inflow_series_cusecs = [row["inflow_cusecs"] for _, row in grouped]
    outflow_series_cusecs = [row["outflow_cusecs"] for _, row in grouped]

    latest_storage = storage_series[-1]
    max_storage = max(storage_series)
    mean_inflow_cusecs = mean(inflow_series_cusecs)
    mean_outflow_cusecs = mean(outflow_series_cusecs)

    scale = request.maf_to_model_units
    inflow_series_model = [
        max(0.0, flow * CUSECS_TO_MAF_PER_DAY * scale) for flow in inflow_series_cusecs
    ]
    mean_outflow_model = max(1.0, mean_outflow_cusecs * CUSECS_TO_MAF_PER_DAY * scale)

    reservoir_capacity = max(1.0, max_storage * scale)
    initial_reservoir = min(reservoir_capacity, latest_storage * scale)
    max_daily_allocation = min(reservoir_capacity, mean_outflow_model)

    notes = [
        "Derived from aggregated records across all dams per date.",
        "Storage converted from MAF using maf_to_model_units scaling.",
        "Daily external inflow series is derived from inflow_cusecs values.",
        "Tune maf_to_model_units to calibrate simulator units to your policy context.",
    ]

    suggestion = DamConfigSuggestion(
        days=len(grouped),
        reservoir_capacity=round(reservoir_capacity, 3),
        initial_reservoir=round(initial_reservoir, 3),
        max_daily_allocation=round(max_daily_allocation, 3),
        external_inflow_series=[round(value, 3) for value in inflow_series_model],
        notes=notes,
    )

    date_from = grouped[0][0]
    date_to = grouped[-1][0]

    return DamDataIngestResponse(
        source=request.source,
        dams=sorted({row.dam for row in request.records}),
        date_from=date_from,
        date_to=date_to,
        observations=len(request.records),
        latest_total_storage_maf=round(latest_storage, 6),
        max_total_storage_maf=round(max_storage, 6),
        mean_inflow_cusecs=round(mean_inflow_cusecs, 3),
        mean_outflow_cusecs=round(mean_outflow_cusecs, 3),
        suggested_config=suggestion,
    )
