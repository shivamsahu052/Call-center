import os
import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

try:
    from ..analysis.coaching import evaluate_call
    from ..database.mongo import calls_collection, users_collection
    from ..preprocessing.convert_audio import prepare_audio_for_transcription
    from ..preprocessing.remove_noise import enhance_voice
    from ..preprocessing.remove_noise import remove_echo
    from ..preprocessing.remove_noise import remove_noise
    from ..preprocessing.remove_silence import remove_silence
    from ..stt.romanize import romanize_text
except ImportError:
    from analysis.coaching import evaluate_call
    from database.mongo import calls_collection, users_collection
    from preprocessing.convert_audio import prepare_audio_for_transcription
    from preprocessing.remove_noise import enhance_voice
    from preprocessing.remove_noise import remove_echo
    from preprocessing.remove_noise import remove_noise
    from preprocessing.remove_silence import remove_silence
    from stt.romanize import romanize_text

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


def request_user(request: Request):
    employee_id = (request.headers.get("X-User-Employee-Id") or "").strip()
    role = (request.headers.get("X-User-Role") or "").strip()

    if not employee_id or role not in {"Manager", "Employee"}:
        raise HTTPException(status_code=401, detail="User identity is required.")

    user = users_collection.find_one({"employeeId": employee_id}, {"passwordHash": 0})

    if not user or user.get("role") != role:
        raise HTTPException(status_code=403, detail="User role could not be verified.")

    return user

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
    provider = os.getenv("STT_PROVIDER", "local").lower()

    if provider == "groq":
        try:
            if __package__ and __package__.startswith("Backend."):
                from ..stt.groq_transcriber import transcribe_with_groq
            else:
                from stt.groq_transcriber import transcribe_with_groq

            return transcribe_with_groq(audio_path, language=language)
        except Exception as exc:
            raise HTTPException(status_code=503, detail=str(exc))

    return _transcribe_with_local_whisper(audio_path, language)


def _transcribe_with_local_whisper(audio_path, language):
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

    result = transcribe_audio(audio_path, language=language)
    result.setdefault("provider", "local")
    result.setdefault("warning", None)
    return result


def _format_timestamp(seconds):
    safe_seconds = max(float(seconds or 0), 0)
    minutes = int(safe_seconds // 60)
    remainder = int(safe_seconds % 60)
    hours = minutes // 60
    minutes = minutes % 60

    if hours:
        return f"{hours:02d}:{minutes:02d}:{remainder:02d}"

    return f"{minutes:02d}:{remainder:02d}"


def _format_labeled_transcript(segments):
    lines = []

    for segment in segments or []:
        text = str(segment.get("text") or "").strip()

        if not text:
            continue

        speaker = segment.get("speaker") or "Speaker"
        start = _format_timestamp(segment.get("start"))
        end = _format_timestamp(segment.get("end"))
        lines.append(f"{speaker} ({start} - {end}): {text}")

    return "\n\n".join(lines).strip()


def _apply_output_language(result, output_language):
    romanized_segments = [
        {
            **segment,
            "text": romanize_text(segment["text"]),
        }
        for segment in result["segments"]
    ]
    romanized_text = " ".join(segment["text"] for segment in romanized_segments).strip()

    if output_language != "hi":
        return {
            **result,
            "text": romanized_text,
            "segments": romanized_segments,
            "displayText": _format_labeled_transcript(romanized_segments) or romanized_text,
            "displaySegments": romanized_segments,
            "outputLanguage": "original",
            "translationError": None,
        }

    return {
        **result,
        "text": romanized_text,
        "segments": romanized_segments,
        "displayText": _format_labeled_transcript(romanized_segments) or romanized_text,
        "displaySegments": romanized_segments,
        "outputLanguage": "hi-roman",
        "translationError": None,
    }

@router.post("/upload")
async def upload_audio_for_transcription(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form("auto"),
    outputLanguage: str = Form("original"),
    employeeId: str = Form("UNASSIGNED"),
    employeeName: str = Form("Unknown Employee"),
):
    user = request_user(request)

    if user["role"] == "Manager":
        raise HTTPException(status_code=403, detail="Managers cannot upload or transcribe calls.")

    if employeeId.strip() and employeeId.strip() != user["employeeId"]:
        raise HTTPException(status_code=403, detail="Employees can only transcribe calls for themselves.")

    employeeId = user["employeeId"]
    employeeName = user.get("fullName") or employeeName

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
        prepared_path = prepare_audio_for_transcription(saved_path)
        cleaned_path = remove_noise(prepared_path)
        echo_reduced_path = remove_echo(cleaned_path)
        enhanced_path = enhance_voice(echo_reduced_path)
        final_audio_path = remove_silence(enhanced_path)
        result = _transcribe_audio(final_audio_path, language=language)
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

    evaluation = evaluate_call(
        {
            "transcript": result["text"],
            "segments": result["segments"],
            "originalSegments": result["segments"],
            "duration": result["duration"],
        }
    )
    call_document = {
        "filename": original_name,
        "storedFilename": saved_name,
        "transcriptFile": transcript_name,
        "employeeId": employeeId.strip() or "UNASSIGNED",
        "employeeName": employeeName.strip() or "Unknown Employee",
        "transcript": result["text"],
        "displayTranscript": result["displayText"],
        "segments": result["displaySegments"],
        "originalSegments": result["segments"],
        "language": result["language"],
        "outputLanguage": result["outputLanguage"],
        "duration": result["duration"],
        "transcriptionProvider": result.get("provider"),
        "transcriptionWarning": result.get("warning"),
        "evaluation": evaluation,
        "createdAt": datetime.utcnow(),
    }
    inserted = calls_collection.insert_one(call_document)

    return {
        "ok": True,
        "callId": str(inserted.inserted_id),
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
        "transcriptionProvider": result.get("provider"),
        "transcriptionWarning": result.get("warning"),
        "duration": result["duration"],
        "evaluation": evaluation,
    }
