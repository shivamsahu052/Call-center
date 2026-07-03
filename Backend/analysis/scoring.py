import re


def score_call(text):
    text = text or ""
    normalized = " ".join(text.lower().split())

    issue_acknowledged = _has_any(
        normalized,
        (
            "let me confirm",
            "i understand",
            "you want",
            "your issue",
            "the problem is",
            "you are facing",
            "you mentioned",
        ),
    )
    resolution_attempted = _has_any(
        normalized,
        (
            "try",
            "restart",
            "resolved",
            "fixed",
            "solution",
            "ticket",
            "follow up",
            "engineer",
            "escalate",
            "plan has been changed",
        ),
    )
    confirmed_resolution = _has_any(
        normalized,
        (
            "is it working",
            "has this resolved",
            "are you satisfied",
            "anything else",
            "confirm",
            "can you confirm",
        ),
    )
    polite_language = _has_any(
        normalized,
        (
            "please",
            "thank you",
            "thanks",
            "sorry",
            "apologize",
            "welcome",
        ),
    )

    interruptions = count_interruptions(text)
    repeated_issue_count = estimate_repeated_issue_count(text)

    score = 48
    score += 12 if issue_acknowledged else -8
    score += 12 if resolution_attempted else -10
    score += 10 if confirmed_resolution else -12
    score += 8 if polite_language else -4
    score -= min(interruptions * 5, 15)
    score -= min(max(repeated_issue_count - 1, 0) * 6, 18)
    score = max(0, min(100, score))

    return {
        "score": score,
        "textLength": len(text),
        "signals": {
            "issueAcknowledged": issue_acknowledged,
            "resolutionAttempted": resolution_attempted,
            "confirmedResolution": confirmed_resolution,
            "politeLanguage": polite_language,
            "estimatedInterruptions": interruptions,
            "repeatedIssueCount": repeated_issue_count,
        },
    }


def count_interruptions(text):
    normalized = (text or "").lower()
    explicit = len(re.findall(r"\b(interrupt|let me finish|i was saying|as i said)\b", normalized))
    abrupt_markers = normalized.count("wait wait") + normalized.count("no no")
    return explicit + abrupt_markers


def estimate_repeated_issue_count(text):
    normalized = " ".join((text or "").lower().split())
    issue_terms = (
        "not working",
        "internet",
        "broadband",
        "plan",
        "billing",
        "slow",
        "disconnect",
        "connectivity",
        "laptop",
        "overheating",
    )
    counts = [normalized.count(term) for term in issue_terms]
    return max(counts) if counts else 0


def _has_any(text, phrases):
    return any(phrase in text for phrase in phrases)
