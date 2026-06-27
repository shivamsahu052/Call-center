from faster_whisper import WhisperModel

_model = None


def _get_model():
    global _model

    if _model is None:
        _model = WhisperModel(
            "base",
            device="cpu",
            compute_type="int8",
        )

    return _model


def _run_whisper(audio_file, language=None, task="transcribe"):
    model = _get_model()
    segments, _ = model.transcribe(
        audio_file,
        language=language,
        vad_filter=True,
        task=task,
    )

    text = []

    for segment in segments:
        text.append(segment.text.strip())

    return " ".join(text).strip()


def transcribe(audio_file, language=None):
    return _run_whisper(audio_file, language=language, task="transcribe")


def translate_to_english(audio_file, language=None):
    return _run_whisper(audio_file, language=language, task="translate")
