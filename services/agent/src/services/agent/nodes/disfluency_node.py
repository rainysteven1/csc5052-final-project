"""Rule-based disfluency detection for the runtime pipeline."""

from __future__ import annotations

import re

from services.agent.src.schemas.analysis import DisfluencyIssue, DisfluencyOutput, SegmentHighlight
from services.agent.src.state import AnalysisState

FILLER_PATTERNS: tuple[tuple[str, str], ...] = (
    ("um", r"\bum\b"),
    ("uh", r"\buh\b"),
    ("er", r"\ber\b"),
    ("ah", r"\bah\b"),
    ("you know", r"\byou know\b"),
    ("like", r"\blike\b"),
    ("嗯", r"嗯+"),
    ("呃", r"呃+"),
    ("那个", r"那个"),
)

SELF_REPAIR_PATTERNS: tuple[tuple[str, str], ...] = (
    ("i mean", r"\bi mean\b"),
    ("sorry", r"\bsorry\b"),
    ("rather", r"\brather\b"),
    ("不是", r"不是"),
    ("我的意思是", r"我的意思是"),
)

TOKEN_PATTERN = re.compile(r"\b[\w']+\b", flags=re.IGNORECASE)


def _collect_fillers(text: str) -> tuple[list[DisfluencyIssue], list[SegmentHighlight], float]:
    issues: list[DisfluencyIssue] = []
    highlights: list[SegmentHighlight] = []
    score = 0.0

    for label, pattern in FILLER_PATTERNS:
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if not matches:
            continue
        issues.append(DisfluencyIssue(type="filler", text=label, count=len(matches)))
        score += 0.12 * len(matches)
        for match in matches:
            highlights.append(
                SegmentHighlight(
                    type="filler",
                    text=match.group(0),
                    start_char=match.start(),
                    end_char=match.end(),
                )
            )

    return issues, highlights, score


def _collect_repetitions(text: str) -> tuple[list[DisfluencyIssue], list[SegmentHighlight], float]:
    tokens = list(TOKEN_PATTERN.finditer(text))
    issues: list[DisfluencyIssue] = []
    highlights: list[SegmentHighlight] = []
    score = 0.0

    i = 0
    while i < len(tokens) - 1:
        current = tokens[i]
        nxt = tokens[i + 1]
        if current.group(0).lower() != nxt.group(0).lower():
            i += 1
            continue

        repeated = [current]
        j = i + 1
        while j < len(tokens) and tokens[j].group(0).lower() == current.group(0).lower():
            repeated.append(tokens[j])
            j += 1

        issues.append(
            DisfluencyIssue(
                type="repeat",
                text=" ".join(match.group(0) for match in repeated),
                count=len(repeated),
            )
        )
        score += 0.18
        highlights.append(
            SegmentHighlight(
                type="repeat",
                text=text[repeated[0].start() : repeated[-1].end()],
                start_char=repeated[0].start(),
                end_char=repeated[-1].end(),
            )
        )
        i = j

    return issues, highlights, score


def _collect_self_repairs(text: str) -> tuple[list[DisfluencyIssue], list[SegmentHighlight], float]:
    issues: list[DisfluencyIssue] = []
    highlights: list[SegmentHighlight] = []
    score = 0.0

    for label, pattern in SELF_REPAIR_PATTERNS:
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if not matches:
            continue
        issues.append(DisfluencyIssue(type="self_repair", text=label, count=len(matches)))
        score += 0.16 * len(matches)
        for match in matches:
            highlights.append(
                SegmentHighlight(
                    type="self_repair",
                    text=match.group(0),
                    start_char=match.start(),
                    end_char=match.end(),
                )
            )

    return issues, highlights, score


def analyze_disfluency(state: AnalysisState) -> AnalysisState:
    outputs: list[DisfluencyOutput] = []

    for segment in state.segments:
        filler_issues, filler_highlights, filler_score = _collect_fillers(segment.text)
        repeat_issues, repeat_highlights, repeat_score = _collect_repetitions(segment.text)
        repair_issues, repair_highlights, repair_score = _collect_self_repairs(segment.text)

        issues = filler_issues + repeat_issues + repair_issues
        highlights = filler_highlights + repeat_highlights + repair_highlights
        score = round(min(filler_score + repeat_score + repair_score, 1.0), 3)

        explanations: list[str] = []
        if filler_issues:
            explanations.append("该句包含填充词，影响语流干净程度。")
        if repeat_issues:
            explanations.append("该句存在重复现象，影响表达流畅度。")
        if repair_issues:
            explanations.append("该句包含自我修正痕迹，削弱了表达稳定性。")

        segment.scores.disfluency = score
        segment.highlights.extend(highlights)

        outputs.append(
            DisfluencyOutput(
                segment_id=segment.segment_id,
                score=score,
                issues=issues,
                explanations=explanations,
            )
        )

    state.agent_outputs.disfluency = outputs
    return state
