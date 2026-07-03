from pathlib import Path

import numpy as np
import soundfile as sf


def remove_noise(audio_path):
    """Reduce steady background noise while preserving speech shape."""
    source_path = Path(audio_path)
    samples, sample_rate = sf.read(source_path, always_2d=False)
    samples = _to_mono_float(samples)

    if samples.size == 0:
        return str(source_path)

    reduced = _spectral_gate(samples, sample_rate)
    output_path = source_path.with_name(f"{source_path.stem}.denoised.wav")
    sf.write(output_path, reduced, sample_rate, subtype="PCM_16")
    return str(output_path)


def enhance_voice(audio_path):
    """Apply simple echo reduction, speech-band emphasis, and loudness normalization."""
    source_path = Path(audio_path)
    samples, sample_rate = sf.read(source_path, always_2d=False)
    samples = _to_mono_float(samples)

    if samples.size == 0:
        return str(source_path)

    enhanced = _reduce_short_echo(samples, sample_rate)
    enhanced = _emphasize_speech_band(enhanced, sample_rate)
    enhanced = _normalize_peak(enhanced)

    output_path = source_path.with_name(f"{source_path.stem}.enhanced.wav")
    sf.write(output_path, enhanced, sample_rate, subtype="PCM_16")
    return str(output_path)


def _to_mono_float(samples):
    samples = np.asarray(samples, dtype=np.float32)

    if samples.ndim > 1:
        samples = samples.mean(axis=1)

    return np.nan_to_num(samples)


def _spectral_gate(samples, sample_rate):
    frame_size = max(512, int(sample_rate * 0.032))
    hop_size = max(160, int(sample_rate * 0.010))
    window = np.hanning(frame_size).astype(np.float32)
    padded = np.pad(samples, (0, frame_size), mode="constant")
    frames = []

    for start in range(0, max(len(samples) - frame_size, 0) + 1, hop_size):
        frame = padded[start:start + frame_size] * window
        spectrum = np.fft.rfft(frame)
        frames.append(spectrum)

    if not frames:
        return samples

    spectra = np.vstack(frames)
    magnitudes = np.abs(spectra)
    phases = np.exp(1j * np.angle(spectra))
    frame_energy = magnitudes.mean(axis=1)
    quiet_count = max(1, int(len(frame_energy) * 0.15))
    quiet_indices = np.argsort(frame_energy)[:quiet_count]
    noise_floor = np.percentile(magnitudes[quiet_indices], 65, axis=0)
    gate = np.maximum(magnitudes - noise_floor * 1.25, magnitudes * 0.18)
    cleaned = gate * phases
    output = np.zeros(len(padded), dtype=np.float32)
    weights = np.zeros(len(padded), dtype=np.float32)

    for index, start in enumerate(range(0, max(len(samples) - frame_size, 0) + 1, hop_size)):
        frame = np.fft.irfft(cleaned[index], n=frame_size).real.astype(np.float32)
        output[start:start + frame_size] += frame * window
        weights[start:start + frame_size] += window ** 2

    safe_weights = np.where(weights > 1e-6, weights, 1)
    return np.clip(output[:len(samples)] / safe_weights[:len(samples)], -1.0, 1.0)


def _reduce_short_echo(samples, sample_rate):
    delay = max(1, int(sample_rate * 0.035))

    if len(samples) <= delay:
        return samples

    delayed = np.pad(samples[:-delay], (delay, 0), mode="constant")
    return np.clip(samples - delayed * 0.22, -1.0, 1.0)


def _emphasize_speech_band(samples, sample_rate):
    emphasized = _high_pass(samples, sample_rate, cutoff_hz=95)
    smoothed = _moving_average(emphasized, max(1, int(sample_rate / 4200)))
    return np.clip(emphasized * 1.15 - smoothed * 0.15, -1.0, 1.0)


def _high_pass(samples, sample_rate, cutoff_hz):
    alpha = sample_rate / (sample_rate + 2 * np.pi * cutoff_hz)
    output = np.zeros_like(samples)
    previous_output = 0.0
    previous_input = 0.0

    for index, value in enumerate(samples):
        previous_output = alpha * (previous_output + value - previous_input)
        output[index] = previous_output
        previous_input = value

    return output


def _moving_average(samples, width):
    if width <= 1:
        return samples

    kernel = np.ones(width, dtype=np.float32) / width
    return np.convolve(samples, kernel, mode="same")


def _normalize_peak(samples, target_peak=0.92):
    peak = float(np.max(np.abs(samples)) or 0)

    if peak < 1e-6:
        return samples

    return np.clip(samples * min(target_peak / peak, 6.0), -1.0, 1.0)
