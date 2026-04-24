"""Text rewrite helpers shared across lexical and feedback nodes."""

from __future__ import annotations

REWRITE_SUGGESTIONS: dict[str, str] = {
    "i think": "",
    "maybe": "",
    "probably": "",
    "i guess": "",
    "kind of": "",
    "sort of": "",
    "not sure": "I can explain it more directly.",
    "try to": "will",
    "可能": "",
    "也许": "",
    "大概": "",
    "我觉得": "",
    "应该": "会",
}


def build_lexical_rewrite(text: str, triggers: list[str]) -> str:
    updated = text
    for trigger in sorted(set(triggers), key=len, reverse=True):
        replacement = REWRITE_SUGGESTIONS.get(trigger.lower(), REWRITE_SUGGESTIONS.get(trigger, ""))
        updated = updated.replace(trigger, replacement).replace(trigger.title(), replacement)
    compact = " ".join(updated.split())
    cleaned = compact.strip(" ,.")
    if not cleaned:
        return ""
    return cleaned if cleaned.endswith((".", "!", "?")) else f"{cleaned}."
