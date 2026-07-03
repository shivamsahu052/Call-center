from .diarization import add_speaker_labels, apply_speaker_turns, diarize_audio
from .whisper_model import get_whisper_model

VAD_PARAMETERS = {
    "min_silence_duration_ms": 350,
    "speech_pad_ms": 300,
}


def transcribe_audio(audio_file, language=None, task="transcribe"):
    model = get_whisper_model()
    selected_language = None if language in (None, "", "auto") else language
    speaker_turns = diarize_audio(audio_file)
    initial_prompt = (
        "Call center audio. Transcribe exactly what each speaker says. "
        "Keep Hindi and Hinglish words in English letters. Do not translate. "
        "Do not correct grammar. Preserve names, numbers, and repeated words."
    )

    segments, info = model.transcribe(
        audio_file,
        language=selected_language,
        task=task,
        beam_size=5,
        best_of=5,
        temperature=0,
        condition_on_previous_text=False,
        initial_prompt=initial_prompt if task == "transcribe" else None,
        vad_filter=True,
        vad_parameters=VAD_PARAMETERS,
        multilingual=selected_language is None,
        language_detection_segments=3,
        word_timestamps=True,
        hallucination_silence_threshold=1.0,
    )

    script_segments = []
    transcript_parts = []

    for segment in segments:
        text = segment.text.strip()

        if not text:
            continue

        if speaker_turns and getattr(segment, "words", None):
            script_segments.extend(_segments_from_words(segment.words, speaker_turns))
        else:
            script_segments.append(
                {
                    "id": len(script_segments) + 1,
                    "start": round(float(segment.start), 2),
                    "end": round(float(segment.end), 2),
                    "text": text,
                }
            )

        transcript_parts.append(text)

    if speaker_turns:
        script_segments = apply_speaker_turns(script_segments, speaker_turns)
    else:
        script_segments = add_speaker_labels(script_segments, audio_file)

    return {
        "text": " ".join(transcript_parts).strip(),
        "segments": script_segments,
        "language": getattr(info, "language", selected_language or "unknown"),
        "duration": round(float(getattr(info, "duration", 0) or 0), 2),
        "provider": "local",
        "model": getattr(model, "model_size_or_path", None),
        "warning": None,
    }


def _segments_from_words(words, speaker_turns):
    grouped_segments = []
    active = None

    for word in words:
        text = str(getattr(word, "word", "") or "").strip()

        if not text:
            continue

        start = float(getattr(word, "start", 0) or 0)
        end = float(getattr(word, "end", start) or start)
        speaker = _speaker_for_time((start + end) / 2, speaker_turns)

        if active and active["speaker"] == speaker and start - active["end"] <= 0.75:
            active["text"] = f'{active["text"]} {text}'.strip()
            active["end"] = end
            continue

        if active:
            grouped_segments.append(active)

        active = {
            "id": len(grouped_segments) + 1,
            "start": start,
            "end": end,
            "speaker": speaker,
            "text": text,
        }

    if active:
        grouped_segments.append(active)

    return [
        {
            **segment,
            "id": index,
            "start": round(segment["start"], 2),
            "end": round(segment["end"], 2),
        }
        for index, segment in enumerate(grouped_segments, start=1)
    ]


def _speaker_for_time(time_seconds, speaker_turns):
    best_turn = max(
        speaker_turns,
        key=lambda turn: max(0, min(time_seconds, turn["end"]) - max(time_seconds, turn["start"])),
    )

    if best_turn["start"] <= time_seconds <= best_turn["end"]:
        return best_turn["speaker"]

    nearest_turn = min(
        speaker_turns,
        key=lambda turn: min(abs(time_seconds - turn["start"]), abs(time_seconds - turn["end"])),
    )
    return nearest_turn["speaker"]


def transcribe(audio_file, language=None):
    return transcribe_audio(audio_file, language=language)["text"]


def translate_to_english(audio_file, language=None):
    return transcribe_audio(audio_file, language=language, task="translate")["text"]
