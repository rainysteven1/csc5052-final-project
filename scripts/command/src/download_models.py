"""Interactive model downloader for SpeakSure++."""

from __future__ import annotations

import argparse
import fnmatch
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

import httpx
import yaml
from dotenv import load_dotenv
from huggingface_hub import HfApi, snapshot_download
from pydantic import BaseModel, Field, ValidationError
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm, Prompt
from rich.table import Table

console = Console()
REPO_ROOT = Path(__file__).resolve().parents[3]
CONFIG_PATH = REPO_ROOT / "scripts" / "command" / "config" / "download_models.yaml"

FALLBACK_CONFIG: dict[str, Any] = {
    "defaults": {
        "hf_endpoint": "https://hf-mirror.com",
        "disable_xet": True,
        "download_timeout": 60,
        "etag_timeout": 30,
        "max_workers": 2,
        "onnx_match_keyword": "int8",
        "onnx_common_patterns": [
            "config.json",
            "generation_config.json",
            "preprocessor_config.json",
            "feature_extractor.json",
            "processor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "added_tokens.json",
            "normalizer.json",
            "vocab.json",
            "vocab.txt",
            "merges.txt",
            "sentencepiece.bpe.model",
            "spiece.model",
        ],
        "non_onnx_common_patterns": [
            "config.json",
            "generation_config.json",
            "preprocessor_config.json",
            "feature_extractor.json",
            "processor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "added_tokens.json",
            "normalizer.json",
            "vocab.json",
            "vocab.txt",
            "merges.txt",
            "sentencepiece.bpe.model",
            "spiece.model",
        ],
        "non_onnx_weight_priority": [
            ["model.safetensors"],
            ["model.safetensors.index.json", "model-*.safetensors"],
            ["pytorch_model.bin"],
            ["pytorch_model.bin.index.json", "pytorch_model-*.bin"],
        ],
    },
    "models": {
        "1": {
            "repo_id": "onnx-community/whisper-large-v3-turbo",
            "local_dir": "services/asr/models/onnx-community__whisper-large-v3-turbo",
            "title": "Whisper ONNX",
            "note": "Best CPU default; downloads only the minimal int8 merged-decoder files.",
            "allow_patterns": [
                "config.json",
                "generation_config.json",
                "preprocessor_config.json",
                "tokenizer.json",
                "tokenizer_config.json",
                "merges.txt",
                "vocab.json",
                "normalizer.json",
                "added_tokens.json",
                "special_tokens_map.json",
                "onnx/encoder_model_int8.onnx",
                "onnx/decoder_model_merged_int8.onnx",
            ],
        },
        "2": {
            "repo_id": "onnx-community/pyannote-segmentation-3.0",
            "local_dir": "services/asr/models/onnx-community__pyannote-segmentation-3.0",
            "title": "Segmentation ONNX",
            "note": "CPU-friendly VAD / segmentation.",
            "dynamic_onnx_int8_selection": True,
        },
        "3": {
            "repo_id": "pyannote/segmentation-3.0",
            "local_dir": "services/asr/models/pyannote__segmentation-3.0",
            "title": "Segmentation (original)",
            "note": "Requires accepting the gated model terms on Hugging Face and setting HF_TOKEN.",
            "requires_token": True,
            "dynamic_weight_selection": True,
        },
        "4": {
            "repo_id": "papluca/xlm-roberta-base-language-detection",
            "local_dir": "services/agent/models/papluca__xlm-roberta-base-language-detection",
            "title": "Language detection",
            "note": "Transcript-level language identification.",
            "dynamic_weight_selection": True,
        },
        "5": {
            "repo_id": "FireRedTeam/FireRedPunc",
            "local_dir": "services/agent/models/FireRedTeam__FireRedPunc",
            "title": "Punctuation restoration (ZH/EN)",
            "note": "Recommended default for mixed Chinese and English.",
            "allow_patterns": [
                "config.yaml",
                "model.pth.tar",
                "out_dict",
                "chinese-bert-wwm-ext_vocab.txt",
                "chinese-lert-base/added_tokens.json",
                "chinese-lert-base/config.json",
                "chinese-lert-base/pytorch_model.bin",
                "chinese-lert-base/special_tokens_map.json",
                "chinese-lert-base/tokenizer.json",
                "chinese-lert-base/tokenizer_config.json",
                "chinese-lert-base/vocab.txt",
            ],
        },
        "6": {
            "repo_id": "felflare/bert-restore-punctuation",
            "local_dir": "services/agent/models/felflare__bert-restore-punctuation",
            "title": "Punctuation restoration (EN)",
            "note": "Lighter English-only fallback.",
            "dynamic_weight_selection": True,
        },
        "7": {
            "repo_id": "audeering/wav2vec2-large-robust-12-ft-emotion-msp-dim",
            "local_dir": "services/agent/models/audeering__wav2vec2-large-robust-12-ft-emotion-msp-dim",
            "title": "Emotion / prosody proxy",
            "note": "Emotion and prosody proxy features.",
            "dynamic_weight_selection": True,
        },
        "8": {
            "repo_id": "sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
            "local_dir": "services/agent/models/sentence-transformers__paraphrase-multilingual-mpnet-base-v2",
            "title": "Semantic embeddings",
            "note": "Multilingual embeddings / retrieval.",
            "dynamic_weight_selection": True,
            "extra_patterns": ["modules.json", "config_sentence_transformers.json", "1_Pooling/config.json"],
        },
    },
    "presets": {
        "cpu-minimal": {
            "title": "CPU recommended minimal set",
            "note": "Whisper ONNX + segmentation ONNX + language detection + FireRedPunc",
            "model_codes": ["1", "2", "4", "5"],
            "recommended": True,
        },
        "full-demo": {
            "title": "Full local demo set",
            "note": "Recommended set + emotion / prosody proxy + semantic embeddings",
            "model_codes": ["1", "2", "4", "5", "7", "8"],
        },
    },
    "recommended_codes": ["1", "2", "4", "5"],
    "wizard": {
        "title": "Model Download Wizard",
        "preset_prompt": "Choose a mode",
        "custom_label": "Custom step-by-step selection",
        "custom_note": "Choose each model interactively",
        "steps": [
            {
                "key": "asr",
                "title": "ASR model",
                "type": "single_choice",
                "prompt": "Pick one",
                "default": "1",
                "options": [
                    {"value": "0", "label": "Skip"},
                    {"value": "1", "label": "Whisper ONNX", "description": "recommended", "recommended": True, "model_codes": ["1"]},
                ],
            },
            {
                "key": "vad",
                "title": "VAD / segmentation",
                "type": "single_choice",
                "prompt": "Pick one",
                "default": "1",
                "options": [
                    {"value": "0", "label": "Skip"},
                    {"value": "1", "label": "ONNX version", "description": "recommended", "recommended": True, "model_codes": ["2"]},
                    {"value": "2", "label": "Original pyannote", "description": "requires HF_TOKEN", "model_codes": ["3"]},
                ],
            },
            {
                "key": "language",
                "title": "Transcript language detection",
                "type": "confirm",
                "prompt": "Download transcript language detection?",
                "default": True,
                "model_codes": ["4"],
            },
            {
                "key": "punctuation",
                "title": "Punctuation restoration",
                "type": "single_choice",
                "prompt": "Pick one",
                "default": "1",
                "options": [
                    {"value": "0", "label": "Skip"},
                    {"value": "1", "label": "FireRedPunc", "description": "recommended for ZH/EN", "recommended": True, "model_codes": ["5"]},
                    {"value": "2", "label": "bert-restore-punctuation", "description": "English", "model_codes": ["6"]},
                    {"value": "3", "label": "Download both", "model_codes": ["5", "6"]},
                ],
            },
            {
                "key": "emotion",
                "title": "Emotion / prosody proxy",
                "type": "confirm",
                "prompt": "Download emotion / prosody proxy model?",
                "default": False,
                "model_codes": ["7"],
            },
            {
                "key": "embeddings",
                "title": "Semantic embeddings",
                "type": "confirm",
                "prompt": "Download semantic embedding model?",
                "default": False,
                "model_codes": ["8"],
            },
        ],
    },
}


class DownloadDefaults(BaseModel):
    hf_endpoint: str = "https://hf-mirror.com"
    disable_xet: bool = True
    download_timeout: int = 60
    etag_timeout: int = 30
    max_workers: int = 2
    onnx_match_keyword: str = "int8"
    onnx_common_patterns: tuple[str, ...] = ()
    non_onnx_common_patterns: tuple[str, ...] = ()
    non_onnx_weight_priority: tuple[tuple[str, ...], ...] = ()


class ModelConfig(BaseModel):
    repo_id: str
    local_dir: str
    title: str
    note: str
    allow_patterns: tuple[str, ...] = ()
    extra_patterns: tuple[str, ...] = ()
    common_patterns: tuple[str, ...] = ()
    requires_token: bool = False
    dynamic_weight_selection: bool = False
    dynamic_onnx_int8_selection: bool = False
    weight_priority: tuple[tuple[str, ...], ...] = ()
    onnx_match_keyword: str | None = None


class PresetConfig(BaseModel):
    title: str
    note: str
    model_codes: tuple[str, ...]
    recommended: bool = False


class WizardOption(BaseModel):
    value: str
    label: str
    description: str = ""
    recommended: bool = False
    model_codes: tuple[str, ...] = ()


class WizardStep(BaseModel):
    key: str
    title: str
    type: Literal["single_choice", "confirm"]
    prompt: str
    default: str | bool | None = None
    model_codes: tuple[str, ...] = ()
    options: tuple[WizardOption, ...] = ()


class WizardConfig(BaseModel):
    title: str = "Model Download Wizard"
    preset_prompt: str = "Choose a mode"
    custom_label: str = "Custom step-by-step selection"
    custom_note: str = "Choose each model interactively"
    steps: tuple[WizardStep, ...] = ()


class DownloadConfig(BaseModel):
    defaults: DownloadDefaults = Field(default_factory=DownloadDefaults)
    models: dict[str, ModelConfig]
    presets: dict[str, PresetConfig] = Field(default_factory=dict)
    recommended_codes: tuple[str, ...] = ()
    wizard: WizardConfig = Field(default_factory=WizardConfig)


class RuntimeState(BaseModel):
    defaults: DownloadDefaults
    models: dict[str, ModelConfig]
    presets: dict[str, PresetConfig]
    recommended_codes: set[str]
    wizard: WizardConfig


@dataclass(frozen=True)
class DownloadOutcome:
    spec: ModelConfig
    code: str
    status: Literal["downloaded", "error"]
    detail: str

    @property
    def ok(self) -> bool:
        return self.status == "downloaded"


class ModelDownloadError(RuntimeError):
    """Raised when a single model cannot be prepared or downloaded."""


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = dict(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _validate_references(parsed: DownloadConfig) -> None:
    model_codes = set(parsed.models)

    for preset_name, preset in parsed.presets.items():
        missing = [code for code in preset.model_codes if code not in model_codes]
        if missing:
            raise SystemExit(f"Preset `{preset_name}` references unknown model codes: {', '.join(missing)}")

    missing_recommended = [code for code in parsed.recommended_codes if code not in model_codes]
    if missing_recommended:
        raise SystemExit(
            "recommended_codes contains unknown model codes: " + ", ".join(missing_recommended)
        )

    for step in parsed.wizard.steps:
        if step.type == "single_choice":
            for option in step.options:
                missing = [code for code in option.model_codes if code not in model_codes]
                if missing:
                    raise SystemExit(
                        f"Wizard step `{step.key}` option `{option.value}` references unknown model codes: {', '.join(missing)}"
                    )
        else:
            missing = [code for code in step.model_codes if code not in model_codes]
            if missing:
                raise SystemExit(
                    f"Wizard step `{step.key}` references unknown model codes: {', '.join(missing)}"
                )


def _load_runtime_state() -> RuntimeState:
    merged_data = dict(FALLBACK_CONFIG)
    if CONFIG_PATH.exists():
        raw = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
        if not isinstance(raw, dict):
            raise SystemExit(f"Invalid YAML content in {CONFIG_PATH}: expected a mapping at the root.")
        merged_data = _deep_merge(FALLBACK_CONFIG, raw)
        console.print(f"[cyan]Loaded config[/cyan] from {CONFIG_PATH}")
    else:
        console.print(f"[yellow]Config file not found at {CONFIG_PATH}. Using built-in fallback rules.[/yellow]")

    try:
        parsed = DownloadConfig.model_validate(merged_data)
    except ValidationError as exc:
        raise SystemExit(f"Invalid download config: {exc}") from exc

    _validate_references(parsed)
    return RuntimeState(
        defaults=parsed.defaults,
        models=parsed.models,
        presets=parsed.presets,
        recommended_codes=set(parsed.recommended_codes),
        wizard=parsed.wizard,
    )


def _model_path(spec: ModelConfig) -> Path:
    return (REPO_ROOT / spec.local_dir).resolve()


def _path_status(spec: ModelConfig) -> tuple[str, str]:
    path = _model_path(spec)
    if not path.exists():
        return "missing", "[red]missing[/red]"
    if spec.allow_patterns:
        missing = [pattern for pattern in spec.allow_patterns if "*" not in pattern and not (path / pattern).exists()]
        if missing:
            return "partial", f"[yellow]partial[/yellow] ({len(missing)} missing)"
        return "ready", "[green]ready[/green]"
    file_count = sum(1 for item in path.rglob("*") if item.is_file())
    if file_count == 0:
        return "empty", "[yellow]empty[/yellow]"
    return "ready", f"[green]ready[/green] ({file_count} files)"


def _render_existing_models(runtime: RuntimeState) -> None:
    table = Table(title="Current Model Status", show_lines=False)
    table.add_column("Code", style="bold cyan", no_wrap=True)
    table.add_column("Model")
    table.add_column("Recommended", no_wrap=True)
    table.add_column("Status", no_wrap=True)
    table.add_column("Directory")
    for code in sorted(runtime.models, key=int):
        spec = runtime.models[code]
        _, label = _path_status(spec)
        recommended = "[bold green]yes[/bold green]" if code in runtime.recommended_codes else "-"
        table.add_row(code, spec.title, recommended, label, spec.local_dir)
    console.print(table)


def _render_plan(models: list[tuple[str, ModelConfig]]) -> None:
    table = Table(title="Download Plan", show_lines=False)
    table.add_column("Code", style="bold cyan", no_wrap=True)
    table.add_column("Model")
    table.add_column("Repo")
    table.add_column("Target Directory")
    for code, spec in models:
        table.add_row(code, spec.title, spec.repo_id, spec.local_dir)
    console.print(table)


def _render_selection_summary(
    all_models: list[tuple[str, ModelConfig]],
    queued_models: list[tuple[str, ModelConfig]],
    *,
    skip_existing: bool,
) -> None:
    queued_codes = {code for code, _ in queued_models}
    ready_count = 0

    table = Table(title="Selection Summary", show_lines=False)
    table.add_column("Code", style="bold cyan", no_wrap=True)
    table.add_column("Model")
    table.add_column("Action", no_wrap=True)

    for code, spec in all_models:
        state, _ = _path_status(spec)
        if code in queued_codes:
            action = "[bold green]download[/bold green]"
        elif skip_existing and state == "ready":
            action = "[yellow]skip existing[/yellow]"
            ready_count += 1
        else:
            action = "[cyan]keep selection[/cyan]"
        table.add_row(code, spec.title, action)

    console.print(table)
    console.print(
        Panel.fit(
            f"[bold]Selected:[/bold] {len(all_models)}    "
            f"[bold green]To download:[/bold green] {len(queued_models)}    "
            f"[bold yellow]Already ready:[/bold yellow] {ready_count if skip_existing else 0}",
            border_style="blue",
        )
    )


def _pick_preset(runtime: RuntimeState) -> list[str]:
    preset_items = list(runtime.presets.items())
    lines = [f"[bold]{runtime.wizard.title}[/bold]"]
    choices: list[str] = []

    for index, (_, preset) in enumerate(preset_items, start=1):
        suffix = " [green](best for most users)[/green]" if preset.recommended else ""
        lines.append(f"[bold green]{index}. {preset.title}[/bold green]{suffix}")
        lines.append(f"   {preset.note}")
        lines.append("")
        choices.append(str(index))

    custom_choice = str(len(preset_items) + 1)
    lines.append(f"{custom_choice}. {runtime.wizard.custom_label}")
    lines.append(f"   {runtime.wizard.custom_note}")
    choices.append(custom_choice)

    console.print(Panel.fit("\n".join(lines), border_style="green"))
    mode = Prompt.ask(runtime.wizard.preset_prompt, choices=choices, default="1")
    if mode == custom_choice:
        return _pick_custom(runtime)
    selected_index = int(mode) - 1
    return list(preset_items[selected_index][1].model_codes)


def _render_single_choice_step(step: WizardStep) -> None:
    lines = [f"[bold]{step.title}[/bold]"]
    for option in step.options:
        label = option.label
        if option.recommended:
            label = f"[bold green]{label}[/bold green]"
        description = f" [green]({option.description})[/green]" if option.description and option.recommended else ""
        if option.description and not option.recommended:
            description = f" [yellow]({option.description})[/yellow]"
        lines.append(f"  {option.value} = {label}{description}")
    console.print(Panel.fit("\n".join(lines), border_style="green"))


def _pick_custom(runtime: RuntimeState) -> list[str]:
    selected: list[str] = []
    for step in runtime.wizard.steps:
        if step.type == "single_choice":
            _render_single_choice_step(step)
            default_value = str(step.default) if step.default is not None else None
            answer = Prompt.ask(step.prompt, choices=[option.value for option in step.options], default=default_value)
            option = next(item for item in step.options if item.value == answer)
            selected.extend(option.model_codes)
        else:
            default_value = bool(step.default) if isinstance(step.default, bool) else False
            if Confirm.ask(step.prompt, default=default_value):
                selected.extend(step.model_codes)
    return selected


def _dedupe(codes: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for code in codes:
        if code not in seen:
            ordered.append(code)
            seen.add(code)
    return ordered


def _resolve_models(runtime: RuntimeState, codes: list[str], *, include_existing: bool) -> list[tuple[str, ModelConfig]]:
    models = [(code, runtime.models[code]) for code in _dedupe(codes) if code in runtime.models]
    if include_existing:
        return models
    filtered: list[tuple[str, ModelConfig]] = []
    for code, spec in models:
        state, _ = _path_status(spec)
        if state == "ready":
            continue
        filtered.append((code, spec))
    return filtered


def _ask_skip_existing() -> bool:
    return Confirm.ask("Skip models that already look ready?", default=True)


def _load_project_dotenv() -> Path | None:
    dotenv_path = REPO_ROOT / ".env"
    if not dotenv_path.exists():
        console.print(f"[yellow]No root .env found at {dotenv_path}. Using defaults and current environment.[/yellow]")
        return None
    load_dotenv(dotenv_path, override=False)
    console.print(f"[cyan]Loaded .env[/cyan] from {dotenv_path}")
    return dotenv_path


def _configure_hf_endpoint(default_endpoint: str) -> str:
    endpoint = os.getenv("HF_ENDPOINT", "").strip() or default_endpoint
    os.environ["HF_ENDPOINT"] = endpoint
    console.print(f"[cyan]HF_ENDPOINT[/cyan] = {endpoint}")
    return endpoint


def _configure_download_defaults(defaults: DownloadDefaults) -> tuple[int, int, int]:
    disable_xet = os.getenv("HF_HUB_DISABLE_XET")
    if disable_xet is None or not disable_xet.strip():
        disable_xet = "1" if defaults.disable_xet else "0"

    download_timeout = int(os.getenv("HF_HUB_DOWNLOAD_TIMEOUT", str(defaults.download_timeout)))
    etag_timeout = int(os.getenv("HF_HUB_ETAG_TIMEOUT", str(defaults.etag_timeout)))
    max_workers = int(os.getenv("HF_DOWNLOAD_MAX_WORKERS", str(defaults.max_workers)))

    os.environ["HF_HUB_DISABLE_XET"] = disable_xet
    os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = str(download_timeout)
    os.environ["HF_HUB_ETAG_TIMEOUT"] = str(etag_timeout)
    os.environ["HF_DOWNLOAD_MAX_WORKERS"] = str(max_workers)

    console.print(
        f"[cyan]HF_HUB_DISABLE_XET[/cyan] = {disable_xet}\n"
        f"[cyan]Download settings[/cyan] = timeout {download_timeout}s, "
        f"etag {etag_timeout}s, workers {max_workers}"
    )
    return download_timeout, etag_timeout, max_workers


def _pick_non_onnx_weight_patterns(repo_files: set[str], weight_priority: tuple[tuple[str, ...], ...]) -> tuple[str, ...]:
    for candidate in weight_priority:
        matched_all = True
        for item in candidate:
            if "*" in item:
                if not any(fnmatch.fnmatch(path, item) for path in repo_files):
                    matched_all = False
                    break
            elif item not in repo_files:
                matched_all = False
                break
        if matched_all:
            return candidate
    return ()


def _pick_onnx_int8_patterns(repo_files: set[str], keyword: str) -> tuple[str, ...]:
    int8_files = sorted(path for path in repo_files if path.endswith(".onnx") and keyword.lower() in path.lower())
    if not int8_files:
        return ()

    selected: list[str] = []
    for onnx_file in int8_files:
        selected.append(onnx_file)
        data_file = f"{onnx_file}_data"
        if data_file in repo_files:
            selected.append(data_file)
    return tuple(selected)


def _require_token_for_model(spec: ModelConfig) -> str | None:
    token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")
    if spec.requires_token and not token:
        raise ModelDownloadError(
            f"Missing HF_TOKEN for gated model {spec.repo_id}. Accept the model terms first."
        )
    return token


def _resolve_allow_patterns(
    spec: ModelConfig,
    *,
    defaults: DownloadDefaults,
    endpoint: str,
    token: str | None,
) -> tuple[str, ...] | None:
    if spec.allow_patterns:
        return spec.allow_patterns
    if not spec.dynamic_weight_selection and not spec.dynamic_onnx_int8_selection:
        return None

    api = HfApi(endpoint=endpoint, token=token if spec.requires_token else None)
    repo_files = set(api.list_repo_files(spec.repo_id))

    if spec.dynamic_onnx_int8_selection:
        common_patterns = spec.common_patterns or defaults.onnx_common_patterns
        keyword = spec.onnx_match_keyword or defaults.onnx_match_keyword
        onnx_patterns = _pick_onnx_int8_patterns(repo_files, keyword)
        if not onnx_patterns:
            raise ModelDownloadError(
                f"Could not find any {keyword} ONNX files in {spec.repo_id}."
            )

        selected: list[str] = []
        for pattern in (*common_patterns, *spec.extra_patterns, *onnx_patterns):
            if pattern not in selected:
                selected.append(pattern)

        console.print(f"[cyan]Selected ONNX files[/cyan] for {spec.repo_id}: {', '.join(onnx_patterns)}")
        return tuple(selected)

    common_patterns = spec.common_patterns or defaults.non_onnx_common_patterns
    weight_priority = spec.weight_priority or defaults.non_onnx_weight_priority
    weight_patterns = _pick_non_onnx_weight_patterns(repo_files, weight_priority)
    if not weight_patterns:
        raise ModelDownloadError(
            f"Could not find model.safetensors or pytorch_model.bin files in {spec.repo_id}."
        )

    selected: list[str] = []
    for pattern in (*common_patterns, *spec.extra_patterns, *weight_patterns):
        if pattern not in selected:
            selected.append(pattern)

    console.print(f"[cyan]Selected weights[/cyan] for {spec.repo_id}: {', '.join(weight_patterns)}")
    return tuple(selected)


def _download_one(
    code: str,
    spec: ModelConfig,
    *,
    defaults: DownloadDefaults,
    endpoint: str,
    etag_timeout: int,
    max_workers: int,
) -> DownloadOutcome:
    console.rule(f"[bold green]Download {code}[/bold green]")
    console.print(f"[bold]{spec.title}[/bold]")
    console.print(f"[cyan]{spec.repo_id}[/cyan]")
    console.print(f"Target: {spec.local_dir}")

    target_path = _model_path(spec)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        token = _require_token_for_model(spec)
        allow_patterns = _resolve_allow_patterns(spec, defaults=defaults, endpoint=endpoint, token=token)
        with console.status(f"[bold green]downloading {spec.repo_id}...[/bold green]"):
            snapshot_download(
                repo_id=spec.repo_id,
                local_dir=str(target_path),
                allow_patterns=list(allow_patterns) if allow_patterns else None,
                token=token if spec.requires_token else None,
                endpoint=endpoint,
                etag_timeout=etag_timeout,
                max_workers=max_workers,
                resume_download=True,
            )
    except (httpx.TimeoutException, TimeoutError) as exc:
        detail = (
            "Timeout. Re-run the same command to resume, or increase "
            "HF_HUB_DOWNLOAD_TIMEOUT / HF_HUB_ETAG_TIMEOUT, or lower HF_DOWNLOAD_MAX_WORKERS."
        )
        console.print(f"[red]Error[/red] {spec.repo_id}: {detail}")
        return DownloadOutcome(spec=spec, code=code, status="error", detail=detail)
    except ModelDownloadError as exc:
        detail = str(exc)
        console.print(f"[red]Error[/red] {spec.repo_id}: {detail}")
        return DownloadOutcome(spec=spec, code=code, status="error", detail=detail)
    except Exception as exc:  # pragma: no cover
        detail = str(exc).strip() or exc.__class__.__name__
        console.print(f"[red]Error[/red] {spec.repo_id}: {detail}")
        return DownloadOutcome(spec=spec, code=code, status="error", detail=detail)

    detail = f"Done -> {spec.local_dir}"
    console.print(f"[green]Done[/green] {spec.repo_id} -> {spec.local_dir}\n")
    return DownloadOutcome(spec=spec, code=code, status="downloaded", detail=detail)


def _download_all(
    models: list[tuple[str, ModelConfig]],
    *,
    defaults: DownloadDefaults,
    endpoint: str,
    etag_timeout: int,
    max_workers: int,
) -> list[DownloadOutcome]:
    outcomes: list[DownloadOutcome] = []
    for code, spec in models:
        outcomes.append(
            _download_one(
                code,
                spec,
                defaults=defaults,
                endpoint=endpoint,
                etag_timeout=etag_timeout,
                max_workers=max_workers,
            )
        )
    return outcomes


def _render_download_summary(outcomes: list[DownloadOutcome]) -> None:
    table = Table(title="Final Download Summary", show_lines=False)
    table.add_column("Code", style="bold cyan", no_wrap=True)
    table.add_column("Model")
    table.add_column("Status", no_wrap=True)
    table.add_column("Details")

    success_count = 0
    error_count = 0
    for outcome in outcomes:
        status = "[bold green]downloaded[/bold green]" if outcome.ok else "[bold red]error[/bold red]"
        success_count += int(outcome.ok)
        error_count += int(not outcome.ok)
        table.add_row(outcome.code, outcome.spec.title, status, outcome.detail)

    console.print(table)
    console.print(
        Panel.fit(
            f"[bold green]Downloaded:[/bold green] {success_count}    [bold red]Errors:[/bold red] {error_count}",
            border_style="green" if error_count == 0 else "red",
        )
    )


def _list_available(runtime: RuntimeState) -> None:
    _render_existing_models(runtime)
    table = Table(title="Available Models", show_lines=False)
    table.add_column("Code", style="bold cyan", no_wrap=True)
    table.add_column("Model")
    table.add_column("Recommended", no_wrap=True)
    table.add_column("Notes")
    for code in sorted(runtime.models, key=int):
        spec = runtime.models[code]
        suffix = " [requires HF_TOKEN]" if spec.requires_token else ""
        recommended = "[bold green]yes[/bold green]" if code in runtime.recommended_codes else "-"
        table.add_row(code, f"{spec.title}{suffix}", recommended, spec.note)
    console.print(table)
    console.print(f"\nPresets: {', '.join(sorted(runtime.presets))}")


def main() -> int:
    runtime = _load_runtime_state()

    parser = argparse.ArgumentParser(description="Download SpeakSure++ models via uv + rich wizard.")
    parser.add_argument("--list", action="store_true", help="Show current model status and available options.")
    parser.add_argument("--preset", choices=sorted(runtime.presets), help="Skip the wizard and use a preset selection.")
    parser.add_argument("--include-existing", action="store_true", help="Download even if the target directory already looks ready.")
    parser.add_argument("--yes", action="store_true", help="Skip the final confirmation prompt.")
    args = parser.parse_args()

    if args.list:
        _list_available(runtime)
        return 0

    _render_existing_models(runtime)
    selected_codes = list(runtime.presets[args.preset].model_codes) if args.preset else _pick_preset(runtime)
    if not selected_codes:
        console.print("[yellow]No models selected. Exiting.[/yellow]")
        return 0

    all_models = [(code, runtime.models[code]) for code in _dedupe(selected_codes) if code in runtime.models]
    include_existing = args.include_existing
    if args.include_existing:
        skip_existing = False
    elif args.yes:
        skip_existing = True
        include_existing = False
    else:
        skip_existing = _ask_skip_existing()
        include_existing = not skip_existing

    models = _resolve_models(runtime, selected_codes, include_existing=include_existing)
    _render_selection_summary(all_models, models, skip_existing=skip_existing)
    if not models:
        console.print("[green]Everything you selected already looks ready. Nothing to download.[/green]")
        return 0

    _render_plan(models)
    _load_project_dotenv()
    endpoint = _configure_hf_endpoint(runtime.defaults.hf_endpoint)
    _, etag_timeout, max_workers = _configure_download_defaults(runtime.defaults)
    if not args.yes and not Confirm.ask("Start download now?", default=True):
        console.print("[yellow]Cancelled.[/yellow]")
        return 0

    outcomes = _download_all(models, defaults=runtime.defaults, endpoint=endpoint, etag_timeout=etag_timeout, max_workers=max_workers)
    _render_download_summary(outcomes)
    if any(not outcome.ok for outcome in outcomes):
        console.print("\n[bold yellow]Completed with some errors.[/bold yellow]")
        return 1

    console.print("\n[bold green]All downloads completed successfully.[/bold green]")
    return 0
