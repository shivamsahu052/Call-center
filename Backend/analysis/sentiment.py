import os
import re

_sentiment_pipeline = None
_sentiment_pipeline_failed = False

POSITIVE_WORDS = {
    "appreciate",
    "awesome",
    "clear",
    "fixed",
    "good",
    "great",
    "happy",
    "helpful",
    "perfect",
    "resolved",
    "satisfied",
    "thanks",
    "thank",
    "working",
}

NEGATIVE_WORDS = {
    "angry",
    "bad",
    "broken",
    "complaint",
    "confused",
    "delay",
    "disappointed",
    "frustrated",
    "issue",
    "not",
    "problem",
    "repeat",
    "slow",
    "terrible",
    "unhappy",
    "wrong",
}

FRUSTRATION_WORDS = {
    "again",
    "angry",
    "bad",
    "complaint",
    "disappointed",
    "frustrated",
    "still",
    "terrible",
    "unhappy",
    "upset",
}

CONFUSION_PHRASES = (
    "confused",
    "not clear",
    "not sure",
    "unclear",
    "what do you mean",
)

RELIEF_PHRASES = (
    "fine",
    "good",
    "great",
    "okay",
    "ok",
    "resolved",
    "thank",
    "thanks",
    "working",
)

UNRESOLVED_PHRASES = (
    "again",
    "issue",
    "not fixed",
    "not resolved",
    "not working",
    "problem",
    "still",
    "still not",
)


def analyze_sentiment(text):
    """Return local sentiment analysis with a safe heuristic fallback."""
    text = text or ""
    model_result = _analyze_with_hugging_face(text)

    if model_result:
        return {
            **model_result,
            "textLength": len(text),
            "source": "huggingface",
        }

    return {
        **_analyze_with_heuristics(text),
        "textLength": len(text),
        "source": "heuristic",
    }


def analyze_customer_sentiment_agent(customer_text, segments=None, context=None):
    """Analyze customer sentiment with conversation context and turn-level signals."""
    context = context or {}
    customer_turns = _customer_turns(segments)
    basis_text = customer_text or " ".join(customer_turns)
    base_sentiment = analyze_sentiment(basis_text)
    turn_analysis = _analyze_turns(customer_turns)
    window_size = _sentiment_window_size(customer_turns)
    start_sentiment = _window_sentiment(customer_turns[:window_size], basis_text)
    end_sentiment = _window_sentiment(customer_turns[-window_size:], basis_text)
    emotion = _customer_emotion_label(basis_text, end_sentiment, context)
    risk_factors = _sentiment_risk_factors(
        basis_text,
        base_sentiment,
        start_sentiment,
        end_sentiment,
        context,
    )
    adjusted = _context_adjusted_sentiment(base_sentiment, end_sentiment, risk_factors, context)

    return {
        **adjusted,
        "basis": "customer_only_with_call_context",
        "source": f"sentiment-agent:{base_sentiment.get('source', 'unknown')}",
        "textLength": len(basis_text or ""),
        "turnCount": len(customer_turns),
        "startSentiment": start_sentiment,
        "endSentiment": end_sentiment,
        "trend": _sentiment_trend(start_sentiment, end_sentiment),
        "emotion": emotion,
        "riskLevel": _risk_level(risk_factors),
        "riskFactors": risk_factors,
        "turnAnalysis": turn_analysis,
        "evidence": _sentiment_evidence(basis_text, customer_turns),
    }


def _analyze_with_hugging_face(text):
    global _sentiment_pipeline
    global _sentiment_pipeline_failed

    if _sentiment_pipeline_failed or not _hf_enabled() or not text.strip():
        return None

    try:
        if _sentiment_pipeline is None:
            from transformers import pipeline

            model_name = os.getenv(
                "HF_SENTIMENT_MODEL",
                "distilbert/distilbert-base-uncased-finetuned-sst-2-english",
            )
            _sentiment_pipeline = pipeline(
                "sentiment-analysis",
                model=model_name,
                tokenizer=model_name,
                local_files_only=_hf_local_only(),
            )

        result = _sentiment_pipeline(text[:4000])[0]
        label = str(result.get("label", "neutral")).lower()
        normalized = "neutral"

        if "pos" in label:
            normalized = "positive"
        elif "neg" in label:
            normalized = "negative"

        return {
            "label": normalized,
            "score": round(float(result.get("score", 0.0)), 3),
        }
    except Exception:
        _sentiment_pipeline_failed = True
        return None


def _analyze_with_heuristics(text):
    words = re.findall(r"[a-z']+", text.lower())

    if not words:
        return {"label": "neutral", "score": 0.0}

    positive_hits = sum(1 for word in words if word in POSITIVE_WORDS)
    negative_hits = sum(1 for word in words if word in NEGATIVE_WORDS)
    total_hits = positive_hits + negative_hits

    if total_hits == 0:
        return {"label": "neutral", "score": 0.5}

    polarity = (positive_hits - negative_hits) / total_hits

    if polarity > 0.2:
        return {"label": "positive", "score": round(0.55 + min(polarity, 1) * 0.4, 3)}

    if polarity < -0.2:
        return {"label": "negative", "score": round(0.55 + min(abs(polarity), 1) * 0.4, 3)}

    return {"label": "neutral", "score": round(1 - abs(polarity), 3)}


def _customer_turns(segments):
    turns = []

    for segment in segments or []:
        speaker = str(segment.get("speaker", "")).lower()
        text = str(segment.get("text") or "").strip()

        if text and ("customer" in speaker or "2" in speaker):
            turns.append(text)

    return turns


def _analyze_turns(turns):
    analysis = []

    for index, turn in enumerate(turns or [], start=1):
        sentiment = analyze_sentiment(turn)
        analysis.append(
            {
                "turn": index,
                "label": sentiment["label"],
                "score": sentiment["score"],
                "emotion": _emotion_from_text(turn),
                "textPreview": _preview(turn),
            }
        )

    return analysis[:20]


def _window_sentiment(turns, fallback):
    text = " ".join(turns).strip() or fallback or ""
    result = analyze_sentiment(text)
    return {
        "label": result["label"],
        "score": result["score"],
    }


def _sentiment_window_size(turns):
    count = len(turns or [])

    if count <= 1:
        return 1
    if count <= 3:
        return 1
    return min(3, max(1, count // 3))


def _customer_emotion_label(text, end_sentiment, context):
    normalized = _normalized(text)

    if _contains_any(normalized, CONFUSION_PHRASES):
        return "Confused"

    if any(word in normalized.split() for word in FRUSTRATION_WORDS):
        if context.get("resolutionStatus") == "Resolved" and end_sentiment.get("label") != "negative":
            return "Frustrated -> Relieved"
        return "Frustrated"

    if end_sentiment.get("label") == "positive":
        return "Satisfied"

    if context.get("resolutionStatus") != "Resolved" and _contains_any(normalized, UNRESOLVED_PHRASES):
        return "Unresolved"

    return "Neutral"


def _sentiment_risk_factors(text, base_sentiment, start_sentiment, end_sentiment, context):
    normalized = _normalized(text)
    factors = []

    if base_sentiment.get("label") == "negative":
        factors.append("Customer language was mostly negative.")
    if end_sentiment.get("label") == "negative":
        factors.append("Customer ended the call with negative sentiment.")
    if _sentiment_value(end_sentiment) < _sentiment_value(start_sentiment):
        factors.append("Customer sentiment declined during the call.")
    if _contains_any(normalized, UNRESOLVED_PHRASES):
        factors.append("Customer used unresolved-issue language.")
    if context.get("resolutionStatus") != "Resolved":
        factors.append("Resolution was not clearly confirmed.")
    if context.get("miscommunicationDetected"):
        factors.append("Request/response mismatch may have affected sentiment.")
    if context.get("repeatedIssueCount", 0) >= 2:
        factors.append("Customer repeated the issue more than once.")
    if context.get("confirmationDetected") is False:
        factors.append("No final customer satisfaction confirmation was detected.")

    return factors[:6]


def _context_adjusted_sentiment(base_sentiment, end_sentiment, risk_factors, context):
    value = _sentiment_value(base_sentiment)
    value = (value * 0.6) + (_sentiment_value(end_sentiment) * 0.4)
    value -= min(len(risk_factors) * 0.12, 0.48)

    if context.get("resolutionStatus") == "Resolved":
        value += 0.12

    value = max(-1.0, min(1.0, value))

    if value >= 0.25:
        label = "positive"
    elif value <= -0.25:
        label = "negative"
    else:
        label = "neutral"

    return {
        "label": label,
        "score": round(0.5 + abs(value) * 0.5, 3),
    }


def _sentiment_trend(start_sentiment, end_sentiment):
    delta = _sentiment_value(end_sentiment) - _sentiment_value(start_sentiment)

    if delta > 0.25:
        return "improved"
    if delta < -0.25:
        return "declined"
    return "stable"


def _risk_level(risk_factors):
    if len(risk_factors) >= 4:
        return "high"
    if len(risk_factors) >= 2:
        return "medium"
    return "low"


def _sentiment_evidence(text, turns):
    phrases = []
    normalized_turns = turns or [text]

    for turn in normalized_turns:
        normalized = _normalized(turn)
        if _contains_any(normalized, UNRESOLVED_PHRASES + CONFUSION_PHRASES) or any(
            word in normalized.split() for word in FRUSTRATION_WORDS
        ):
            phrases.append(_preview(turn))
        elif _contains_any(normalized, RELIEF_PHRASES):
            phrases.append(_preview(turn))

        if len(phrases) == 3:
            break

    return phrases


def _emotion_from_text(text):
    normalized = _normalized(text)

    if _contains_any(normalized, CONFUSION_PHRASES):
        return "confused"
    if any(word in normalized.split() for word in FRUSTRATION_WORDS):
        return "frustrated"
    if _contains_any(normalized, RELIEF_PHRASES):
        return "relieved"
    return "neutral"


def _sentiment_value(sentiment):
    label = sentiment.get("label")
    score = float(sentiment.get("score") or 0.5)
    magnitude = max(0.2, min(score, 1.0))

    if label == "positive":
        return magnitude
    if label == "negative":
        return -magnitude
    return 0.0


def _preview(text):
    clean = " ".join(str(text or "").split())
    return clean[:117] + "..." if len(clean) > 120 else clean


def _normalized(text):
    return " ".join(str(text or "").lower().split())


def _contains_any(text, phrases):
    return any(phrase in text for phrase in phrases)


def _hf_enabled():
    return os.getenv("ENABLE_HF_ANALYSIS", "true").lower() in {"1", "true", "yes"}


def _hf_local_only():
    return os.getenv("HF_LOCAL_ONLY", "true").lower() in {"1", "true", "yes"}
