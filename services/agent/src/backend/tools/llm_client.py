"""OpenAI-compatible MiniMax client helpers for judgment/coaching/feedback flows."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from openai import OpenAI

from services.agent.src.backend.tools.prompt_loader import render_prompt_template
from services.agent.src.config import get_config
from services.agent.src.logger import logger

DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.chat/v1"
DEFAULT_MINIMAX_MODEL = "MiniMax-M2.7"


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


def _smart_loads(raw: str) -> Any:
    """Best-effort JSON loader for slightly messy model responses."""
    if not raw:
        return {}

    try:
        return json.loads(raw)
    except Exception:
        pass

    decoder = json.JSONDecoder()
    for index, char in enumerate(raw):
        if char not in "[{":
            continue
        try:
            payload, _ = decoder.raw_decode(raw[index:])
            return payload
        except Exception:
            continue
    return {}


def _try_parse(raw: str) -> dict[str, Any] | None:
    """Try direct JSON, single-item list, then fenced JSON extraction."""
    try:
        data = _smart_loads(raw)
        if isinstance(data, dict) and data:
            return data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            logger.info("  JSON parse: list fallback succeeded")
            return data[0]
    except Exception:
        pass

    match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if not match:
        return None

    json_str = match.group(1).strip()
    try:
        data = _smart_loads(json_str)
        if isinstance(data, dict) and data:
            logger.info("  JSON parse: markdown extraction succeeded")
            return data
        if isinstance(data, list) and data and isinstance(data[0], dict):
            logger.info("  JSON parse: markdown + list fallback succeeded")
            return data[0]
    except Exception:
        return None
    return None


def _extract_json_from_response(raw: str) -> dict[str, Any] | None:
    """Try parsing the raw response with lightweight recovery."""
    result = _try_parse(raw)
    if result is not None:
        return result

    logger.warning("  Initial JSON parse failed")
    return None


class RuntimeLLMClient:
    """Small OpenAI-compatible client for MiniMax-backed JSON generation."""

    def __init__(
        self,
        config: RuntimeLLMConfig | None = None,
        *,
        config_path: str | Path | None = None,
    ) -> None:
        self.config = config or resolve_runtime_llm_config()
        self.config_path = config_path
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

    def _create_completion(
        self,
        *,
        messages: list[dict[str, str]],
        temperature: float,
        response_format: dict[str, str] | None = None,
    ) -> str:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if response_format is not None:
            kwargs["response_format"] = response_format
        if self._seed is not None:
            kwargs["seed"] = self._seed

        try:
            response = self._client.chat.completions.create(**kwargs)
        except Exception as exc:  # pragma: no cover - external API path
            raise LLMClientError(f"LLM completion failed: {exc}") from exc

        content = response.choices[0].message.content or ""
        if not content.strip():
            raise LLMClientError("LLM returned an empty response.")
        return content

    def _repair_json_response(
        self,
        *,
        raw_response: str,
        schema_name: str,
        schema_json: str,
        language: str | None = None,
    ) -> dict[str, Any] | None:
        logger.warning("[LLM] Attempting structured repair for malformed JSON output")
        repair_variables = {
            "schema_name": schema_name,
            "schema_json": schema_json,
            "raw_response": raw_response,
        }
        content = self._create_completion(
            messages=[
                {
                    "role": "system",
                    "content": render_prompt_template(
                        "json_repair_system",
                        variables=repair_variables,
                        config_path=self.config_path,
                        language=language,
                    ),
                },
                {
                    "role": "user",
                    "content": render_prompt_template(
                        "json_repair_user",
                        variables=repair_variables,
                        config_path=self.config_path,
                        language=language,
                    ),
                },
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        return _extract_json_from_response(_strip_code_fence(content))

    def chat_json(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        repair_schema_name: str | None = None,
        repair_schema_json: str | None = None,
        repair_language: str | None = None,
    ) -> dict[str, Any]:
        logger.info(f"[LLM] Calling {self.provider} model {self.model} for structured runtime output")
        content = self._create_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        payload = _extract_json_from_response(_strip_code_fence(content))
        if payload is not None:
            return payload

        if repair_schema_name and repair_schema_json:
            repaired = self._repair_json_response(
                raw_response=content,
                schema_name=repair_schema_name,
                schema_json=repair_schema_json,
                language=repair_language,
            )
            if repaired is not None:
                return repaired

        raise LLMClientError("LLM did not return valid JSON.")
