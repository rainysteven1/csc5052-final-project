"""Rule-based lexical uncertainty detection for the runtime pipeline."""

from __future__ import annotations

from dataclasses import dataclass

from services.agent.src.schemas.analysis import LexicalOutput, SegmentHighlight
from services.agent.src.services.agent.tools.text_rewrite import build_lexical_rewrite
from services.agent.src.state import AnalysisState


@dataclass(frozen=True)
class LexicalRule:
    phrase: str
    weight: float
    explanation: str


LEXICAL_RULES: tuple[LexicalRule, ...] = (
    LexicalRule("i think", 0.24, "出现弱承诺表达，陈述显得不够直接。"),
    LexicalRule("maybe", 0.22, "出现模糊词，降低了表达确定性。"),
    LexicalRule("probably", 0.22, "出现概率化措辞，表达偏保守。"),
    LexicalRule("i guess", 0.24, "出现猜测式表达，显得不够肯定。"),
    LexicalRule("kind of", 0.18, "出现弱化短语，削弱了表达力度。"),
    LexicalRule("sort of", 0.18, "出现弱化短语，削弱了表达力度。"),
    LexicalRule("not sure", 0.30, "直接表达不确定，会显著拉低置信感。"),
    LexicalRule("try to", 0.14, "表达目标偏保守，承诺力度不足。"),
    LexicalRule("可能", 0.22, "出现模糊词，降低了表达确定性。"),
    LexicalRule("也许", 0.22, "出现模糊词，降低了表达确定性。"),
    LexicalRule("大概", 0.20, "出现模糊词，表述偏保守。"),
    LexicalRule("我觉得", 0.24, "出现主观弱承诺表达，显得不够直接。"),
    LexicalRule("应该", 0.18, "出现推测式措辞，确定性有所下降。"),
)

def _find_all_occurrences(text: str, phrase: str) -> list[tuple[int, int]]:
    lowered = text.lower()
    lowered_phrase = phrase.lower()
    results: list[tuple[int, int]] = []
    start = 0
    while True:
        idx = lowered.find(lowered_phrase, start)
        if idx < 0:
            return results
        results.append((idx, idx + len(phrase)))
        start = idx + len(phrase)
def analyze_lexical_uncertainty(state: AnalysisState) -> AnalysisState:
    outputs: list[LexicalOutput] = []

    for segment in state.segments:
        text = segment.text.strip()
        text_lower = text.lower()
        triggers: list[str] = []
        explanations: list[str] = []
        highlights: list[SegmentHighlight] = []
        score = 0.0

        for rule in LEXICAL_RULES:
            if rule.phrase not in text_lower and rule.phrase not in text:
                continue
            occurrences = _find_all_occurrences(text, rule.phrase)
            if not occurrences and rule.phrase != rule.phrase.lower():
                occurrences = _find_all_occurrences(text, rule.phrase.lower())
            if not occurrences and rule.phrase in text:
                occurrences = [(text.index(rule.phrase), text.index(rule.phrase) + len(rule.phrase))]
            if not occurrences:
                continue

            score += rule.weight * len(occurrences)
            matched_text = text[occurrences[0][0] : occurrences[0][1]]
            if matched_text not in triggers:
                triggers.append(matched_text)
            if rule.explanation not in explanations:
                explanations.append(rule.explanation)
            for start_char, end_char in occurrences:
                highlights.append(
                    SegmentHighlight(
                        type="trigger",
                        text=text[start_char:end_char],
                        start_char=start_char,
                        end_char=end_char,
                    )
                )

        bounded_score = round(min(score, 1.0), 3)
        segment.scores.lexical = bounded_score
        segment.highlights = highlights

        outputs.append(
            LexicalOutput(
                segment_id=segment.segment_id,
                score=bounded_score,
                triggers=[highlight.text for highlight in highlights],
                explanations=explanations,
            )
        )

    state.agent_outputs.lexical = outputs
    return state
