import json
import mimetypes
import os
import urllib.error
import urllib.request
import uuid
from pathlib import Path

GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions"


def transcribe_with_groq(audio_file, language=None):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not configured.")

    audio_path = Path(audio_file)
    selected_language = None if language in (None, "", "auto") else language
    fields = {
        "model": os.getenv("GROQ_STT_MODEL", "whisper-large-v3"),
        "response_format": "verbose_json",
        "timestamp_granularities[]": ["segment"],
        "temperature": "0",
    }
    prompt = os.getenv("GROQ_STT_PROMPT", "").strip()

    if selected_language:
        fields["language"] = selected_language

    if prompt:
        fields["prompt"] = prompt

    body, content_type = _multipart_body(
        fields,
        file_field="file",
        file_path=audio_path,
    )
    request = urllib.request.Request(
        GROQ_TRANSCRIPTIONS_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": content_type,
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Groq transcription failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Groq transcription failed: {exc.reason}") from exc

    return _normalize_groq_response(payload, selected_language)


def _multipart_body(fields, file_field, file_path):
    boundary = f"----call-center-{uuid.uuid4().hex}"
    chunks = []

    for name, value in fields.items():
        values = value if isinstance(value, (list, tuple)) else [value]

        for item in values:
            chunks.extend(
                [
                    f"--{boundary}\r\n".encode("utf-8"),
                    f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"),
                    str(item).encode("utf-8"),
                    b"\r\n",
                ]
            )

    content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    chunks.extend(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="{file_field}"; '
                f'filename="{file_path.name}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"),
            file_path.read_bytes(),
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )

    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _normalize_groq_response(payload, selected_language):
    raw_segments = payload.get("segments") or []
    segments = []

    for index, segment in enumerate(raw_segments, start=1):
        text = str(segment.get("text") or "").strip()

        if not text:
            continue

        segments.append(
            {
                "id": index,
                "start": round(float(segment.get("start") or 0), 2),
                "end": round(float(segment.get("end") or 0), 2),
                "text": text,
            }
        )

    text = str(payload.get("text") or "").strip()

    if not segments and text:
        segments.append(
            {
                "id": 1,
                "start": 0,
                "end": round(float(payload.get("duration") or 0), 2),
                "text": text,
            }
        )

    duration = payload.get("duration")
    if duration is None and segments:
        duration = max(segment["end"] for segment in segments)

    return {
        "text": text or " ".join(segment["text"] for segment in segments).strip(),
        "segments": segments,
        "language": payload.get("language") or selected_language or "unknown",
        "duration": round(float(duration or 0), 2),
        "provider": "groq",
        "warning": None,
    }
