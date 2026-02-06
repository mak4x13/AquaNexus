import json
from typing import Dict, List, Optional, Tuple

from groq import Groq

from app.config import settings
from app.models import MultiAgentNegotiationRequest, SimulationResponse


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


def _dry_run_transcript(request: MultiAgentNegotiationRequest) -> Dict[str, object]:
    transcript = []
    for round_index in range(1, request.rounds + 1):
        for agent in request.agents:
            constraint_line = ""
            if agent.constraints:
                constraint_line = f" Constraints: {', '.join(agent.constraints)}."
            region_line = f" Region: {request.region}." if request.region else ""
            message = (
                f"Round {round_index}: {agent.goal}.{constraint_line}{region_line} "
                "Proposes a water-sharing adjustment based on risk and fairness."
            )
            transcript.append(
                {
                    "round": round_index,
                    "agent_id": agent.id,
                    "role": agent.role,
                    "message": message,
                }
            )

    agreement = (
        "Draft agreement: prioritize minimum survival allocations, enforce drought rationing, "
        "and publish transparent schedules for tail-end equity."
    )
    return {"transcript": transcript, "agreement": agreement}


def _parse_json_response(content: str) -> Dict[str, object]:
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return {
            "transcript": [
                {
                    "round": 1,
                    "agent_id": "facilitator",
                    "role": "observer",
                    "message": content,
                }
            ],
            "agreement": None,
        }


def generate_negotiation(
    prompt: str,
    context: Optional[Dict[str, object]] = None,
    model: Optional[str] = None,
    temperature: float = 0.2,
    dry_run: bool = False,
) -> Tuple[str, str]:
    if dry_run:
        return "Dry run enabled. No Groq call was made.", "dry-run"
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
    dry_run: bool = False,
) -> Tuple[str, str]:
    if dry_run:
        return "Dry run enabled. Provide simulation data to generate a policy brief.", "dry-run"
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


def generate_multiagent_transcript(
    request: MultiAgentNegotiationRequest,
) -> Tuple[Dict[str, object], str]:
    if request.dry_run:
        return _dry_run_transcript(request), "dry-run"
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")

    agent_context = [agent.model_dump() for agent in request.agents]
    payload = {
        "prompt": request.prompt,
        "agents": agent_context,
        "rounds": request.rounds,
        "region": request.region,
        "context": request.context or {},
    }

    system = (
        "You are a facilitator generating a multi-agent negotiation transcript. "
        "Return ONLY valid JSON with keys: transcript (list) and agreement (string)."
    )
    user_prompt = (
        "Simulate a multi-round negotiation. Each round must include each agent exactly once. "
        "Keep each message under 60 words. Ensure fairness and sustainability themes are explicit."
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
        {"role": "user", "content": f"Context:\n{json.dumps(payload, indent=2)}"},
    ]

    completion = _client.chat.completions.create(
        model=request.model or settings.groq_model,
        messages=messages,
        temperature=request.temperature,
    )

    data = _parse_json_response(completion.choices[0].message.content)
    return data, completion.model