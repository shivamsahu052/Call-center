import os
import re

_emotion_pipeline = None
_emotion_pipeline_failed = False

EMPATHY_PHRASES = (
    "i understand",
    "i can understand",
    "i am sorry",
    "sorry for",
    "i apologize",
    "let me help",
    "let me check",
    "i can help",
    "that must be",
    "thank you for waiting",
    "thanks for waiting",
)

DISMISSIVE_PHRASES = (
    "calm down",
    "you are wrong",
    "not my problem",
    "you should have",
    "as i said",
    "listen to me",
)


def analyze_empathy(text):
    text = text or ""
    model_result = _analyze_emotion_with_hugging_face(text)
    heuristic = _score_empathy(text)

    if model_result:
        return {
            **heuristic,
            "emotion": model_result,
            "source": "huggingface+heuristic",
            "textLength": len(text),
        }

    return {
        **heuristic,
        "emotion": {"label": "neutral", "score": 0.0},
        "source": "heuristic",
        "textLength": len(text),
    }


def _score_empathy(text):
    normalized = " ".join(text.lower().split())
    empathy_hits = sum(normalized.count(phrase) for phrase in EMPATHY_PHRASES)
    dismissive_hits = sum(normalized.count(phrase) for phrase in DISMISSIVE_PHRASES)
    question_count = normalized.count("?")

    raw_score = 58 + empathy_hits * 12 + min(question_count, 4) * 3 - dismissive_hits * 18
    score = max(0, min(100, raw_score))

    if score >= 78:
        label = "strong"
    elif score >= 58:
        label = "adequate"
    else:
        label = "needs_attention"

    return {
        "label": label,
        "score": score,
        "signals": {
            "empathyPhraseCount": empathy_hits,
            "dismissivePhraseCount": dismissive_hits,
            "questionCount": question_count,
        },
    }


def _analyze_emotion_with_hugging_face(text):
    global _emotion_pipeline
    global _emotion_pipeline_failed

    if _emotion_pipeline_failed or not _hf_enabled() or not text.strip():
        return None

    try:
        if _emotion_pipeline is None:
            from transformers import pipeline

            model_name = os.getenv(
                "HF_EMOTION_MODEL",
                "j-hartmann/emotion-english-distilroberta-base",
            )
            _emotion_pipeline = pipeline(
                "text-classification",
                model=model_name,
                tokenizer=model_name,
                top_k=None,
                local_files_only=_hf_local_only(),
            )

        result = _emotion_pipeline(text[:4000])
        if result and isinstance(result[0], list):
            result = result[0]

        best = max(result, key=lambda item: item.get("score", 0.0))
        return {
            "label": str(best.get("label", "neutral")).lower(),
            "score": round(float(best.get("score", 0.0)), 3),
        }
    except Exception:
        _emotion_pipeline_failed = True
        return None


def extract_customer_emotion(segments):
    customer_text = " ".join(
        segment.get("text", "")
        for segment in segments or []
        if "2" in str(segment.get("speaker", "")) or "customer" in str(segment.get("speaker", "")).lower()
    )
    normalized = customer_text.lower()

    if re.search(r"\b(frustrated|angry|upset|again|still|not working|bad|complaint)\b", normalized):
        start = "Frustrated"
    elif re.search(r"\b(confused|not sure|unclear|what do you mean)\b", normalized):
        start = "Confused"
    else:
        start = "Neutral"

    closing_text = " ".join(
        segment.get("text", "")
        for segment in (segments or [])[-3:]
        if "2" in str(segment.get("speaker", "")) or "customer" in str(segment.get("speaker", "")).lower()
    ).lower()

    if re.search(r"\b(thank|okay|ok|fine|working|resolved|great)\b", closing_text):
        end = "Neutral"
    elif re.search(r"\b(still|not|again|problem|issue|unclear|confused)\b", closing_text):
        end = start
    else:
        end = "Neutral" if start != "Neutral" else "Neutral"

    return f"{start} -> {end}" if start != end else start


def _hf_enabled():
    return os.getenv("ENABLE_HF_ANALYSIS", "true").lower() in {"1", "true", "yes"}


def _hf_local_only():
    return os.getenv("HF_LOCAL_ONLY", "true").lower() in {"1", "true", "yes"}
