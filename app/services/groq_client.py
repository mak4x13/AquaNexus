import json
from typing import Dict, List, Optional, Tuple

from groq import Groq

from app.config import settings
from app.models import SimulationResponse


_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else Groq()


def _build_messages(prompt: str, context: Optional[Dict[str, object]]) -> List[Dict[str, str]]:
    messages = [{"role": "user", "content": prompt}]
    if context:
        context_blob = json.dumps(context, indent=2)
        messages.append({"role": "user", "content": f"Context:\n{context_blob}"})
    return messages


def _policy_context(simulation: SimulationResponse) -> Dict[str, object]:
    primary = simulation.primary
    daily = primary.daily

    worst_reservoir = sorted(daily, key=lambda d: d.reservoir_end)[:3]
    worst_gini = sorted(daily, key=lambda d: d.gini, reverse=True)[:3]

    return {
        "summary": primary.summary.model_dump(),
        "farms": [farm.model_dump() for farm in primary.farms],
        "worst_reservoir_days": [
            {
                "day": d.day,
                "reservoir_end": d.reservoir_end,
                "total_allocated": d.total_allocated,
                "gini": d.gini,
                "drought": d.drought,
                "rainfall": d.rainfall,
            }
            for d in worst_reservoir
        ],
        "highest_inequality_days": [
            {
                "day": d.day,
                "gini": d.gini,
                "total_allocated": d.total_allocated,
                "drought": d.drought,
                "rainfall": d.rainfall,
            }
            for d in worst_gini
        ],
    }


def generate_negotiation(
    prompt: str,
    context: Optional[Dict[str, object]] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> Tuple[str, str]:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    messages = _build_messages(prompt, context)
    completion = _client.chat.completions.create(
        model=model or settings.groq_model,
        messages=messages,
        temperature=temperature,
    )
    return completion.choices[0].message.content, completion.model


def generate_policy_brief(
    simulation: SimulationResponse,
    region: str,
    focus: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
) -> Tuple[str, str]:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    focus_line = focus or "Balance yield, equity, and sustainability."
    prompt = (
        "You are a water policy analyst. Write a concise policy brief with 8-12 bullet points. "
        "Include: key risks, allocation recommendations, fairness implications, and climate resilience actions. "
        "Mention region-specific issues when relevant. Avoid inventing numbers not present in the context. "
        f"Region: {region}. Focus: {focus_line}"
    )

    context = _policy_context(simulation)
    messages = [
        {"role": "system", "content": "You are a concise policy analyst."},
        {"role": "user", "content": prompt},
        {"role": "user", "content": f"Context:\n{json.dumps(context, indent=2)}"},
    ]

    completion = _client.chat.completions.create(
        model=model or settings.groq_model,
        messages=messages,
        temperature=temperature,
    )
    return completion.choices[0].message.content, completion.model