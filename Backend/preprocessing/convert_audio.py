from pathlib import Path

import av
import numpy as np
import soundfile as sf

TARGET_SAMPLE_RATE = 16000
TARGET_CHANNELS = 1


def prepare_audio_for_transcription(audio_path):
    """Convert uploaded audio/video into a mono 16 kHz WAV for STT and diarization."""
    source_path = Path(audio_path)

    if (
        source_path.suffix.lower() == ".wav"
        and _is_target_wav(source_path)
    ):
        return str(source_path)

    output_path = source_path.with_name(f"{source_path.stem}.prepared.wav")
    samples = _decode_audio(source_path)
    sf.write(output_path, samples, TARGET_SAMPLE_RATE, subtype="PCM_16")
    return str(output_path)


def _is_target_wav(audio_path):
    try:
        info = sf.info(audio_path)
    except Exception:
        return False

    return info.samplerate == TARGET_SAMPLE_RATE and info.channels == TARGET_CHANNELS


def _decode_audio(audio_path):
    chunks = []

    with av.open(str(audio_path)) as container:
        audio_stream = next((stream for stream in container.streams if stream.type == "audio"), None)

        if audio_stream is None:
            raise ValueError("Uploaded file does not contain an audio stream.")

        resampler = av.AudioResampler(
            format="s16",
            layout="mono",
            rate=TARGET_SAMPLE_RATE,
        )

        for frame in container.decode(audio_stream):
            resampled_frames = resampler.resample(frame)

            if not isinstance(resampled_frames, list):
                resampled_frames = [resampled_frames]

            for resampled in resampled_frames:
                array = resampled.to_ndarray()

                if array.ndim > 1:
                    array = array.mean(axis=0)

                chunks.append(array.astype(np.float32) / 32768.0)

    if not chunks:
        raise ValueError("No decodable audio frames were found.")

    return np.clip(np.concatenate(chunks), -1.0, 1.0)
