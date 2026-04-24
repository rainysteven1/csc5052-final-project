"""Rule-based prosody analysis for the runtime pipeline."""

from __future__ import annotations

from pathlib import Path

from services.agent.src.schemas.analysis import ProsodyOutput
from services.agent.src.services.agent.contracts.analysis_contracts import SegmentFeatureMap
from services.agent.src.services.agent.tools.feature_extractor import extract_segment_features
from services.agent.src.state import AnalysisState


def analyze_prosody(state: AnalysisState) -> AnalysisState:
    audio_path = state.audio.normalized_path or state.audio.source_path
    resolved_audio = Path(audio_path).expanduser().resolve()
    outputs: list[ProsodyOutput] = []

    for segment in state.segments:
        features: SegmentFeatureMap = extract_segment_features(resolved_audio, segment)
        score = 0.0
        explanations: list[str] = []

        speech_rate = features["speech_rate"]
        pause_duration = features["pause_duration"]
        energy_var = features["energy_var"]
        pitch_var = features["pitch_var"]

        if speech_rate < 2.0:
            score += min((2.0 - speech_rate) * 0.18, 0.35)
            explanations.append("语速偏慢，表达显得不够利落。")
        elif speech_rate > 4.8:
            score += min((speech_rate - 4.8) * 0.08, 0.2)
            explanations.append("语速偏快，语流稳定性可能下降。")

        if pause_duration >= 0.5:
            score += min(pause_duration * 0.25, 0.25)
            explanations.append("句前停顿偏长，影响表达连贯性。")

        if energy_var < 0.05 and (segment.end - segment.start) >= 0.5:
            score += 0.12
            explanations.append("能量变化较平，听感上略显平。")

        if pitch_var < 0.01 and (segment.end - segment.start) >= 0.5:
            score += 0.08
            explanations.append("音高变化较少，表达起伏不足。")

        bounded_score = round(min(score, 1.0), 3)
        segment.scores.prosody = bounded_score

        outputs.append(
            ProsodyOutput(
                segment_id=segment.segment_id,
                score=bounded_score,
                features=features,
                explanations=explanations,
            )
        )

    state.agent_outputs.prosody = outputs
    return state
