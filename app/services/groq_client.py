import json
from typing import Dict, List, Optional, Tuple

from groq import Groq

from app.config import settings


_client = Groq(api_key=settings.groq_api_key) if settings.groq_api_key else Groq()


def _build_messages(prompt: str, context: Optional[Dict[str, object]]) -> List[Dict[str, str]]:
    messages = [{"role": "user", "content": prompt}]
    if context:
        context_blob = json.dumps(context, indent=2)
        messages.append({"role": "user", "content": f"Context:\n{context_blob}"})
    return messages


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