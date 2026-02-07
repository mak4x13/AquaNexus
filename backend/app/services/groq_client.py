import json
from typing import Dict, List, Optional, Tuple

from groq import APIConnectionError, APIStatusError, AuthenticationError, Groq, RateLimitError
from groq.types.chat import ChatCompletionMessageParam

from app.config import settings
from app.models import MultiAgentNegotiationRequest, SimulationResponse


_client: Optional[Groq] = None


def _get_client() -> Groq:
    if not settings.groq_api_key:
        raise RuntimeError("GROQ_API_KEY is not set in the environment.")
    global _client
    if _client is None:
        kwargs = {
            "api_key": settings.groq_api_key,
            "timeout": settings.groq_timeout_seconds,
        }
        if settings.groq_base_url:
            kwargs["base_url"] = settings.groq_base_url
        _client = Groq(**kwargs)
    return _client


def _format_groq_error(exc: Exception) -> str:
    if isinstance(exc, AuthenticationError):
        return "Groq authentication failed. Check GROQ_API_KEY."
    if isinstance(exc, RateLimitError):
        return "Groq rate limit reached. Retry in a moment."
    if isinstance(exc, APIConnectionError):
        return (
            "Unable to reach Groq API. Check internet, firewall/proxy, and TLS settings."
        )
    if isinstance(exc, APIStatusError):
        return f"Groq API returned status {exc.status_code}."
    return str(exc)


def _build_messages(prompt: str, context: Optional[Dict[str, object]]) -> List[ChatCompletionMessageParam]:
    messages: List[ChatCompletionMessageParam] = [{"role": "user", "content": prompt}]
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
    client = _get_client()
    try:
        messages = _build_messages(prompt, context)
        completion = client.chat.completions.create(
            model=model or settings.groq_model,
            messages=messages,
            temperature=temperature,
        )
        content = completion.choices[0].message.content or ""
        return content, completion.model
    except Exception as exc:
        raise RuntimeError(_format_groq_error(exc)) from exc


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
    client = _get_client()

    focus_line = focus or "Balance yield, equity, and sustainability."
    prompt = (
        "You are a water policy analyst. Write a concise policy brief with 8-12 bullet points. "
        "Include: key risks, allocation recommendations, fairness implications, and climate resilience actions. "
        "Mention region-specific issues when relevant. Avoid inventing numbers not present in the context. "
        f"Region: {region}. Focus: {focus_line}"
    )

    context = _policy_context(simulation)
    messages: List[ChatCompletionMessageParam] = [
        {"role": "system", "content": "You are a concise policy analyst."},
        {"role": "user", "content": prompt},
        {"role": "user", "content": f"Context:\n{json.dumps(context, indent=2)}"},
    ]

    try:
        completion = client.chat.completions.create(
            model=model or settings.groq_model,
            messages=messages,
            temperature=temperature,
        )
        content = completion.choices[0].message.content or ""
        return content, completion.model
    except Exception as exc:
        raise RuntimeError(_format_groq_error(exc)) from exc


def generate_multiagent_transcript(
    request: MultiAgentNegotiationRequest,
) -> Tuple[Dict[str, object], str]:
    if request.dry_run:
        return _dry_run_transcript(request), "dry-run"
    client = _get_client()

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

    messages: List[ChatCompletionMessageParam] = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
        {"role": "user", "content": f"Context:\n{json.dumps(payload, indent=2)}"},
    ]

    try:
        completion = client.chat.completions.create(
            model=request.model or settings.groq_model,
            messages=messages,
            temperature=request.temperature,
        )

        content = completion.choices[0].message.content or ""
        data = _parse_json_response(content)
        return data, completion.model
    except Exception as exc:
        raise RuntimeError(_format_groq_error(exc)) from exc


def check_llm_health(probe: bool = False, model: Optional[str] = None) -> Dict[str, object]:
    key_configured = bool(settings.groq_api_key)
    active_model = model or settings.groq_model
    result = {
        "key_configured": key_configured,
        "model": active_model,
        "probe_attempted": probe,
        "reachable": False,
        "detail": None,
    }

    if not key_configured:
        result["detail"] = "GROQ_API_KEY is not configured."
        return result

    if not probe:
        result["reachable"] = True
        result["detail"] = "Configuration present. Set probe=true to test network/API."
        return result

    try:
        client = _get_client()
        completion = client.chat.completions.create(
            model=active_model,
            messages=[{"role": "user", "content": "Reply with: ok"}],
            temperature=0,
            max_tokens=8,
        )
        result["reachable"] = True
        result["detail"] = f"Groq reachable. Response model: {completion.model}."
        return result
    except Exception as exc:
        result["detail"] = _format_groq_error(exc)
        return result
