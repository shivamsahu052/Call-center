from pathlib import Path

import numpy as np
import soundfile as sf


def remove_silence(audio_path):
    """Trim leading/trailing silence and compress long silent gaps."""
    source_path = Path(audio_path)
    samples, sample_rate = sf.read(source_path, always_2d=False)
    samples = np.asarray(samples, dtype=np.float32)

    if samples.ndim > 1:
        samples = samples.mean(axis=1)

    if samples.size == 0:
        return str(source_path)

    trimmed = _trim_and_compress_silence(samples, sample_rate)
    output_path = source_path.with_name(f"{source_path.stem}.trimmed.wav")
    sf.write(output_path, trimmed, sample_rate, subtype="PCM_16")
    return str(output_path)


def _trim_and_compress_silence(samples, sample_rate):
    frame_size = max(320, int(sample_rate * 0.02))
    hop_size = frame_size
    rms_values = []

    for start in range(0, len(samples), hop_size):
        frame = samples[start:start + frame_size]
        rms_values.append(float(np.sqrt(np.mean(frame ** 2))) if frame.size else 0)

    if not rms_values:
        return samples

    rms = np.asarray(rms_values)
    threshold = max(float(np.percentile(rms, 35)) * 1.8, 0.006)
    voiced = rms > threshold

    if not voiced.any():
        return samples

    pad_frames = max(4, int(0.25 / 0.02))
    keep = np.zeros_like(voiced, dtype=bool)

    for index, is_voiced in enumerate(voiced):
        if is_voiced:
            start = max(index - pad_frames, 0)
            end = min(index + pad_frames + 1, len(keep))
            keep[start:end] = True

    max_silence_frames = max(1, int(0.8 / 0.02))
    output_chunks = []
    silent_run = 0

    for index, should_keep in enumerate(keep):
        start = index * hop_size
        frame = samples[start:start + hop_size]

        if should_keep:
            silent_run = 0
            output_chunks.append(frame)
            continue

        if silent_run < max_silence_frames:
            output_chunks.append(frame)

        silent_run += 1

    return np.concatenate(output_chunks) if output_chunks else samples
