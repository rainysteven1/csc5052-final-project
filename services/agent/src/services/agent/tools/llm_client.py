"""OpenAI-compatible MiniMax client helpers for reasoning/feedback nodes."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

from services.agent.src.config import get_config
from services.agent.src.logger import logger

DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.chat/v1"
DEFAULT_MINIMAX_MODEL = "MiniMax-M2.7-highspeed"


class LLMClientError(RuntimeError):
    """Raised when the runtime LLM client cannot produce a usable response."""


def _normalize_base_url(base_url: str) -> str:
    normalized = base_url.strip() or DEFAULT_MINIMAX_BASE_URL
    if "api.minimax.chat" in normalized:
        return normalized.replace("api.minimax.chat", "api.minimaxi.chat")
    return normalized


@dataclass(frozen=True)
class RuntimeLLMConfig:
    provider: str
    model: str
    api_key: str
    base_url: str
    enabled: bool


def resolve_runtime_llm_config() -> RuntimeLLMConfig:
    api_key = os.getenv("MINIMAX_API_KEY", "").strip()
    base_url = _normalize_base_url(os.getenv("MINIMAX_BASE_URL", DEFAULT_MINIMAX_BASE_URL))
    model = os.getenv("SPEAKSURE_LLM_MODEL", DEFAULT_MINIMAX_MODEL).strip() or DEFAULT_MINIMAX_MODEL
    return RuntimeLLMConfig(
        provider="minimax",
        model=model,
        api_key=api_key,
        base_url=base_url,
        enabled=bool(api_key),
    )


def _strip_code_fence(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned
    lines = cleaned.splitlines()
    if len(lines) >= 3:
        return "\n".join(lines[1:-1]).strip()
    return cleaned.strip("`").strip()


class RuntimeLLMClient:
    """Small OpenAI-compatible client for MiniMax-backed JSON generation."""

    def __init__(self, config: RuntimeLLMConfig | None = None) -> None:
        self.config = config or resolve_runtime_llm_config()
        if not self.config.enabled:
            raise LLMClientError("MiniMax credentials are not configured in the environment.")
        self._client = OpenAI(api_key=self.config.api_key, base_url=self.config.base_url)
        try:
            self._seed = get_config().seed
        except Exception:
            self._seed = None

    @property
    def provider(self) -> str:
        return self.config.provider

    @property
    def model(self) -> str:
        return self.config.model

    def chat_json(self, *, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        logger.info(f"[LLM] Calling {self.provider} model {self.model} for structured runtime output")
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        }
        if self._seed is not None:
            kwargs["seed"] = self._seed

        try:
            response = self._client.chat.completions.create(**kwargs)
        except Exception as exc:  # pragma: no cover - external API path
            raise LLMClientError(f"LLM completion failed: {exc}") from exc

        content = response.choices[0].message.content or ""
        if not content.strip():
            raise LLMClientError("LLM returned an empty response.")

        try:
            return json.loads(_strip_code_fence(content))
        except json.JSONDecodeError as exc:
            raise LLMClientError("LLM did not return valid JSON.") from exc
