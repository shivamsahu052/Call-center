try:
    from .stt.transcriber import transcribe, transcribe_audio, translate_to_english
except ImportError:
    from stt.transcriber import transcribe, transcribe_audio, translate_to_english
