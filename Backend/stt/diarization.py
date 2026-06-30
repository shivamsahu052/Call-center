AGENT_HINTS = (
    "hello sir",
    "good morning",
    "thank you for calling",
    "take care",
    "how can i help",
    "can you tell",
    "register your service",
    "service ticket",
    "you will get sms",
    "you are welcome",
    "have a great day",
    "laptop support",
    "laptop supporter",
    "checked your details",
    "in warranty",
    "it will take",
    "our service will reach",
    "email information",
)

CUSTOMER_HINTS = (
    "my laptop",
    "i called",
    "how long",
    "over heating",
    "overheating",
    "hanging",
    "wait a minute",
    "called for service",
    "okay sir",
)

SPOKEN_NUMBERS = {
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
}

ROLE_SPEAKERS = {
    "agent": "Speaker 1",
    "customer": "Speaker 2",
}


def add_speaker_labels(segments):
    """Apply diarization labels when available, otherwise infer basic call turns."""
    if not segments:
        return []

    if any(segment.get("speaker") for segment in segments):
        return _merge_adjacent_segments([_normalize_existing_speaker(segment) for segment in segments])

    current_role = "agent"
    expecting_customer = False
    collecting_account_number = False
    labeled_segments = []

    for segment in segments:
        text = segment.get("text", "")
        role = _infer_role(text, current_role, expecting_customer, collecting_account_number)

        if role:
            current_role = role

        normalized_text = _normalize_text(text)
        expecting_customer = (
            "how can i help" in normalized_text
            or "have a great day" in normalized_text
        )
        collecting_account_number = (
            "register number" in normalized_text
            or (collecting_account_number and current_role == "customer" and _is_account_number_part(normalized_text))
        )

        if current_role == "agent" and "thank you sir" in normalized_text:
            collecting_account_number = False

        labeled_segments.append({**segment, "speaker": ROLE_SPEAKERS[current_role]})

    return _merge_adjacent_segments(labeled_segments)


def _normalize_existing_speaker(segment):
    speaker = segment.get("speaker")

    if isinstance(speaker, str) and speaker.lower().startswith("speaker"):
        return segment

    return {**segment, "speaker": f"Speaker {speaker}"}


def _infer_role(text, current_role, expecting_customer, collecting_account_number):
    normalized = _normalize_text(text)

    if expecting_customer and (
        normalized in ("hello", "yes", "sir", "thank you", "thank you sir", "goodbye")
        or normalized.startswith("my name is")
    ):
        return "customer"

    if collecting_account_number and normalized == "thank you sir":
        return "agent"

    if collecting_account_number and _is_account_number_part(normalized):
        return "customer"

    if any(hint in normalized for hint in AGENT_HINTS):
        return "agent"

    if any(hint in normalized for hint in CUSTOMER_HINTS):
        return "customer"

    return None


def _normalize_text(text):
    return " ".join(text.lower().strip(" .!?").split())


def _is_account_number_part(normalized_text):
    if normalized_text in ("yes", "wait a minute"):
        return True

    words = [word for word in normalized_text.split() if word]
    return bool(words) and all(word in SPOKEN_NUMBERS for word in words)


def _merge_adjacent_segments(segments):
    merged_segments = []

    for segment in segments:
        if (
            merged_segments
            and merged_segments[-1]["speaker"] == segment["speaker"]
            and float(segment.get("start", 0) or 0) - float(merged_segments[-1].get("end", 0) or 0) <= 0.8
        ):
            merged_segments[-1]["end"] = segment.get("end", merged_segments[-1]["end"])
            merged_segments[-1]["text"] = f'{merged_segments[-1]["text"]} {segment.get("text", "")}'.strip()
            continue

        merged_segments.append({**segment, "id": len(merged_segments) + 1})

    return merged_segments
