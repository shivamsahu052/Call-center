import os

from faster_whisper import WhisperModel

_model = None
_model_config = None


def get_whisper_model():
    global _model
    global _model_config

    model_config = (
        os.getenv("WHISPER_MODEL_SIZE", "large-v3"),
        os.getenv("WHISPER_DEVICE", "cpu"),
        os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
    )

    if _model is None or _model_config != model_config:
        _model = WhisperModel(
            model_config[0],
            device=model_config[1],
            compute_type=model_config[2],
        )
        _model_config = model_config

    return _model
