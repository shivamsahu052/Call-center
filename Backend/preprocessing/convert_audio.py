from pathlib import Path


def prepare_audio_for_transcription(audio_path):
    """Return an audio path that Whisper can consume."""
    return str(Path(audio_path))

