import os

from faster_whisper import WhisperModel

_model = None


def get_whisper_model():
    global _model

    if _model is None:
        _model = WhisperModel(
            os.getenv("WHISPER_MODEL_SIZE", "base"),
            device=os.getenv("WHISPER_DEVICE", "cpu"),
            compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
        )

    return _model

