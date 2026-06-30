import os
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

try:
    from ..preprocessing.convert_audio import prepare_audio_for_transcription
    from ..preprocessing.remove_noise import remove_noise
    from ..preprocessing.remove_silence import remove_silence
    from ..translator import translate_texts_to_hindi
except ImportError:
    from preprocessing.convert_audio import prepare_audio_for_transcription
    from preprocessing.remove_noise import remove_noise
    from preprocessing.remove_silence import remove_silence
    from translator import translate_texts_to_hindi

router = APIRouter(prefix="/api/transcription", tags=["transcription"])

BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "uploads"
MAX_UPLOAD_MB = int(os.getenv("MAX_AUDIO_UPLOAD_MB", "100"))
SUPPORTED_EXTENSIONS = {
    ".aac",
    ".flac",
    ".m4a",
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".ogg",
    ".wav",
    ".webm",
}


def _safe_filename(filename):
    clean_name = Path(filename or "call-audio").name
    clean_name = re.sub(r"[^A-Za-z0-9._-]+", "-", clean_name).strip(".-")
    return clean_name or "call-audio"


def _validate_audio_file(file):
    suffix = Path(file.filename or "").suffix.lower()

    if suffix not in SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format. Upload one of: {supported}",
        )


def _transcribe_audio(audio_path, language):
    try:
        if __package__ and __package__.startswith("Backend."):
            from ..stt.transcriber import transcribe_audio
        else:
            from stt.transcriber import transcribe_audio
    except ModuleNotFoundError as exc:
        if exc.name == "faster_whisper":
            raise HTTPException(
                status_code=503,
                detail=(
                    "Transcription dependencies are not installed. "
                    "Install faster-whisper and its runtime dependencies to use audio uploads."
                ),
            )
        raise

    return transcribe_audio(audio_path, language=language)


def _apply_output_language(result, output_language):
    if output_language != "hi":
        return {
            **result,
            "displayText": result["text"],
            "displaySegments": result["segments"],
            "outputLanguage": "original",
            "translationError": None,
        }

    segment_texts = [segment["text"] for segment in result["segments"]]
    translated_segments, translation_error = translate_texts_to_hindi(segment_texts)
    display_segments = [
        {
            **segment,
            "originalText": segment["text"],
            "text": translated_text,
        }
        for segment, translated_text in zip(result["segments"], translated_segments)
    ]

    return {
        **result,
        "displayText": " ".join(segment["text"] for segment in display_segments).strip(),
        "displaySegments": display_segments,
        "outputLanguage": "hi",
        "translationError": translation_error,
    }


@router.post("/upload")
async def upload_audio_for_transcription(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    outputLanguage: str = Form("original"),
):
    _validate_audio_file(file)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    original_name = _safe_filename(file.filename)
    suffix = Path(original_name).suffix.lower()
    saved_name = f"{uuid.uuid4().hex}{suffix}"
    saved_path = UPLOAD_DIR / saved_name
    max_bytes = MAX_UPLOAD_MB * 1024 * 1024
    written = 0

    try:
        with saved_path.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)

                if written > max_bytes:
                    saved_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=413,
                        detail=f"Audio file is too large. Maximum size is {MAX_UPLOAD_MB} MB.",
                    )

                output.write(chunk)
    finally:
        await file.close()

    try:
        prepared_path = prepare_audio_for_transcription(
            remove_silence(remove_noise(saved_path))
        )
        result = _transcribe_audio(prepared_path, language=language)
        result = _apply_output_language(result, outputLanguage)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to transcribe audio: {exc}",
        )

    transcript_name = f"{saved_path.stem}.txt"
    transcript_path = UPLOAD_DIR / transcript_name
    transcript_path.write_text(result["displayText"], encoding="utf-8")

    return {
        "ok": True,
        "filename": original_name,
        "storedFilename": saved_name,
        "transcriptFile": transcript_name,
        "transcript": result["text"],
        "displayTranscript": result["displayText"],
        "segments": result["displaySegments"],
        "originalSegments": result["segments"],
        "language": result["language"],
        "outputLanguage": result["outputLanguage"],
        "translationError": result["translationError"],
        "duration": result["duration"],
    }
