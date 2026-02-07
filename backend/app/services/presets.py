from typing import List

from app.models import FarmConfig, PresetResponse, SimulationConfig, SimulationRequest


def list_presets() -> List[PresetResponse]:
    pakistan_request = SimulationRequest(
        farms=[
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
        ],
        config=SimulationConfig(
            days=30,
            reservoir_capacity=1200,
            initial_reservoir=800,
            max_daily_allocation=150,
            rainfall_prob=0.35,
            rainfall_mean=18,
            rainfall_std=6,
            drought_prob=0.15,
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
            seed=42,
        ),
        policy="quota",
        compare_policies=True,
    )

    return [
        PresetResponse(
            id="pk-irrigation-demo",
            name="Pakistan Irrigation Mix (Demo)",
            description=(
                "Illustrative 4-province crop mix and quota shares inspired by Pakistan's irrigation context. "
                "Quota values are demo-only and should be tuned with local data."
            ),
            request=pakistan_request,
        ),
        PresetResponse(
            id="pk-irrigation-auto-quota",
            name="Pakistan Irrigation (Auto Quota)",
            description=(
                "Pakistan policy layer with inter-provincial quotas derived automatically from farm provinces."
            ),
            request=pakistan_request.model_copy(update={"policy": "pakistan-quota"}),
        )
    ]
