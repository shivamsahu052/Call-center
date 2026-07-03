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


def _hf_enabled():
    return os.getenv("ENABLE_HF_ANALYSIS", "true").lower() in {"1", "true", "yes"}


def _hf_local_only():
    return os.getenv("HF_LOCAL_ONLY", "true").lower() in {"1", "true", "yes"}
