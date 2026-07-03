AGENT_HINTS = (
    "hello sir",
    "hello ma'am",
    "hello mam",
    "good morning",
    "good afternoon",
    "good evening",
    "thank you for calling",
    "thank you for contacting",
    "take care",
    "how can i help",
    "how may i help",
    "may i help",
    "can you tell",
    "can i have",
    "could you please",
    "please provide",
    "please tell",
    "let me check",
    "let me help",
    "i can help",
    "i will help",
    "please hold",
    "hold for a moment",
    "register your service",
    "service ticket",
    "ticket number",
    "case number",
    "complaint number",
    "you will get sms",
    "you are welcome",
    "welcome to",
    "is there anything else",
    "anything else",
    "sorry for the inconvenience",
    "i apologize",
    "we apologize",
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
    "my phone",
    "my internet",
    "my bill",
    "my account",
    "my order",
    "i called",
    "i am calling",
    "i have a problem",
    "i need help",
    "i want",
    "i cannot",
    "i can't",
    "i did not",
    "i didn't",
    "not working",
    "please help",
    "can you help",
    "refund",
    "complaint",
    "i paid",
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
    "agent": "Agent",
    "customer": "Customer",
}

_pyannote_pipeline = None
_pyannote_failed = False


def add_speaker_labels(segments, audio_path=None):
    """Apply PyAnnote diarization when configured, otherwise infer basic call turns."""
    if not segments:
        return []

    if any(segment.get("speaker") for segment in segments):
        return _merge_adjacent_segments(
            _apply_clear_role_names([_normalize_existing_speaker(segment) for segment in segments])
        )

    diarized_segments = _label_with_pyannote(segments, audio_path)
    if diarized_segments:
        return _merge_adjacent_segments(_apply_clear_role_names(diarized_segments))

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
        expecting_customer = any(
            hint in normalized_text
            for hint in (
                "how can i help",
                "how may i help",
                "may i help",
                "how can i assist",
                "is there anything else",
                "anything else",
                "have a great day",
            )
        )
        collecting_account_number = (
            "register number" in normalized_text
            or "registered number" in normalized_text
            or (collecting_account_number and current_role == "customer" and _is_account_number_part(normalized_text))
        )

        if current_role == "agent" and "thank you sir" in normalized_text:
            collecting_account_number = False

        labeled_segments.append({**segment, "speaker": ROLE_SPEAKERS[current_role]})

    return _merge_adjacent_segments(labeled_segments)


def diarize_audio(audio_path):
    """Run speaker diarization before transcription when PyAnnote is configured."""
    global _pyannote_pipeline
    global _pyannote_failed

    if _pyannote_failed or not audio_path:
        return None

    try:
        import os

        token = os.getenv("PYANNOTE_AUTH_TOKEN")
        if not token:
            return None

        if _pyannote_pipeline is None:
            from pyannote.audio import Pipeline

            model_name = os.getenv("PYANNOTE_MODEL", "pyannote/speaker-diarization-3.1")
            _pyannote_pipeline = Pipeline.from_pretrained(model_name, use_auth_token=token)

        diarization = _pyannote_pipeline(str(audio_path))
        speaker_names = {}
        speaker_turns = []

        for turn, _, speaker in diarization.itertracks(yield_label=True):
            if speaker not in speaker_names:
                speaker_names[speaker] = f"Speaker {len(speaker_names) + 1}"

            speaker_turns.append(
                {
                    "start": float(turn.start),
                    "end": float(turn.end),
                    "speaker": speaker_names[speaker],
                }
            )

        return speaker_turns or None
    except Exception:
        _pyannote_failed = True
        return None


def apply_speaker_turns(segments, speaker_turns):
    if not segments or not speaker_turns:
        return segments

    diarized_segments = [
        {
            **segment,
            "speaker": _best_speaker_for_segment(segment, speaker_turns),
        }
        for segment in segments
    ]
    return _merge_adjacent_segments(_apply_clear_role_names(diarized_segments))


def _label_with_pyannote(segments, audio_path):
    speaker_turns = diarize_audio(audio_path)

    if not speaker_turns:
        return None

    return [
        {
            **segment,
            "speaker": _best_speaker_for_segment(segment, speaker_turns),
        }
        for segment in segments
    ]


def label_inferred_call_roles(segments):
    if not segments:
        return []

    return _merge_adjacent_segments(_apply_clear_role_names(segments))


def _best_speaker_for_segment(segment, speaker_turns):
    segment_start = float(segment.get("start", 0) or 0)
    segment_end = float(segment.get("end", segment_start) or segment_start)
    best_turn = max(
        speaker_turns,
        key=lambda turn: _overlap_seconds(segment_start, segment_end, turn["start"], turn["end"]),
    )
    return best_turn["speaker"]


def _overlap_seconds(start_a, end_a, start_b, end_b):
    return max(0, min(end_a, end_b) - max(start_a, start_b))


def _normalize_existing_speaker(segment):
    speaker = segment.get("speaker")

    if isinstance(speaker, str):
        speaker = speaker.strip()

        if _standard_role_label(speaker):
            return {**segment, "speaker": _standard_role_label(speaker)}

        if speaker.lower().startswith("speaker"):
            return {**segment, "speaker": speaker}

    return {**segment, "speaker": f"Speaker {speaker}"}


def _apply_clear_role_names(segments):
    """Map diarized physical speakers to Agent/Customer labels for call transcripts."""
    if not segments:
        return []

    if all(_standard_role_label(segment.get("speaker")) for segment in segments):
        return [
            {
                **segment,
                "speaker": _standard_role_label(segment.get("speaker")),
                "speakerSource": "role",
            }
            for segment in segments
        ]

    speaker_order = []
    role_scores = {}

    for index, segment in enumerate(segments):
        speaker = str(segment.get("speaker") or "Speaker").strip()

        if speaker not in role_scores:
            speaker_order.append(speaker)
            role_scores[speaker] = {"agent": 0.0, "customer": 0.0}

        scores = _role_scores_for_text(segment.get("text", ""))
        role_scores[speaker]["agent"] += scores["agent"]
        role_scores[speaker]["customer"] += scores["customer"]

        if index == 0:
            role_scores[speaker]["agent"] += 1.5

    if not speaker_order:
        return segments

    if len(speaker_order) == 1:
        speaker = speaker_order[0]
        role = (
            "customer"
            if role_scores[speaker]["customer"] > role_scores[speaker]["agent"] + 1
            else "agent"
        )
        mapping = {speaker: ROLE_SPEAKERS[role]}
    else:
        agent_speaker = max(
            speaker_order,
            key=lambda speaker: role_scores[speaker]["agent"] - role_scores[speaker]["customer"],
        )
        remaining = [speaker for speaker in speaker_order if speaker != agent_speaker]
        customer_speaker = max(
            remaining,
            key=lambda speaker: role_scores[speaker]["customer"] - role_scores[speaker]["agent"],
        )
        mapping = {
            speaker: (
                ROLE_SPEAKERS["agent"]
                if speaker == agent_speaker
                else ROLE_SPEAKERS["customer"]
            )
            for speaker in speaker_order
        }
        mapping[customer_speaker] = ROLE_SPEAKERS["customer"]

    return [
        {
            **segment,
            "speaker": mapping.get(str(segment.get("speaker") or "Speaker").strip(), "Customer"),
            "speakerSource": segment.get("speaker"),
        }
        for segment in segments
    ]


def _standard_role_label(speaker):
    normalized = str(speaker or "").strip().lower()

    if not normalized:
        return None

    if "customer" in normalized:
        return ROLE_SPEAKERS["customer"]

    if "agent" in normalized:
        return ROLE_SPEAKERS["agent"]

    return None


def _role_scores_for_text(text):
    normalized = _normalize_text(text)
    agent_score = sum(2 for hint in AGENT_HINTS if hint in normalized)
    customer_score = sum(2 for hint in CUSTOMER_HINTS if hint in normalized)

    if normalized.startswith(("thank you for", "welcome to", "this is")):
        agent_score += 3

    if normalized.startswith(("my ", "i am", "i have", "i need", "i want", "i cannot", "i can't")):
        customer_score += 2

    if _is_account_number_part(normalized):
        customer_score += 1

    return {
        "agent": agent_score,
        "customer": customer_score,
    }


def _infer_role(text, current_role, expecting_customer, collecting_account_number):
    normalized = _normalize_text(text)

    if expecting_customer and (
        normalized in ("hello", "yes", "sir", "thank you", "thank you sir", "goodbye")
        or normalized.startswith("my name is")
    ):
        return "customer"

    if expecting_customer and normalized and not any(hint in normalized for hint in AGENT_HINTS):
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
