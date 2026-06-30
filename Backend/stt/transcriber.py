from .diarization import add_speaker_labels
from .whisper_model import get_whisper_model


def transcribe_audio(audio_file, language=None, task="transcribe"):
    model = get_whisper_model()
    selected_language = None if language in (None, "", "auto") else language

    segments, info = model.transcribe(
        audio_file,
        language=selected_language,
        vad_filter=True,
        task=task,
    )

    script_segments = []
    transcript_parts = []

    for index, segment in enumerate(segments, start=1):
        text = segment.text.strip()

        if not text:
            continue

        script_segments.append(
            {
                "id": index,
                "start": round(float(segment.start), 2),
                "end": round(float(segment.end), 2),
                "text": text,
            }
        )
        transcript_parts.append(text)

    script_segments = add_speaker_labels(script_segments)

    return {
        "text": " ".join(transcript_parts).strip(),
        "segments": script_segments,
        "language": getattr(info, "language", selected_language or "unknown"),
        "duration": round(float(getattr(info, "duration", 0) or 0), 2),
    }


def transcribe(audio_file, language=None):
    return transcribe_audio(audio_file, language=language)["text"]


def translate_to_english(audio_file, language=None):
    return transcribe_audio(audio_file, language=language, task="translate")["text"]

