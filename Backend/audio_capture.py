from collections import deque
from dataclasses import dataclass
from pathlib import Path
import time

import numpy as np
import soundcard as sc
import soundfile as sf

try:
    import pythoncom
except ImportError:
    pythoncom = None

SAMPLE_RATE = 16000
OUTPUT_FILE = Path(__file__).with_name("temp.wav")


@dataclass(frozen=True)
class VoiceActivityConfig:
    sample_rate: int = SAMPLE_RATE
    frame_duration_ms: int = 100
    threshold: float = 0.012
    min_speech_frames: int = 3
    max_silence_frames: int = 8
    max_recording_seconds: float = 20.0
    pre_roll_frames: int = 3


def _initialize_com():
    if pythoncom is None:
        return False

    try:
        pythoncom.CoInitializeEx(pythoncom.COINIT_MULTITHREADED)
        return True
    except pythoncom.com_error as exc:
        # RPC_E_CHANGED_MODE means the thread already initialized COM another way.
        if exc.hresult != -2147417850:
            raise
        return False


def _uninitialize_com(com_initialized):
    if com_initialized and pythoncom is not None:
        pythoncom.CoUninitialize()


def _default_loopback_microphone():
    speaker = sc.default_speaker()
    microphones = sc.all_microphones(include_loopback=True)

    for microphone in microphones:
        is_loopback = getattr(microphone, "isloopback", False)
        same_device = microphone.id == speaker.id or speaker.name in microphone.name

        if is_loopback and same_device:
            return microphone

    return sc.get_microphone(speaker.name, include_loopback=True)


def _audio_source(source):
    if source == "microphone":
        return sc.default_microphone()

    if source == "system":
        return _default_loopback_microphone()

    raise ValueError("source must be 'system' or 'microphone'")


def _to_mono(audio):
    audio = np.asarray(audio, dtype=np.float32)

    if audio.ndim == 1:
        return audio

    return audio.mean(axis=1)


def _rms(audio):
    if audio.size == 0:
        return 0.0

    return float(np.sqrt(np.mean(np.square(audio))))


def record_audio(seconds=5, source="system", output_file=OUTPUT_FILE, sample_rate=SAMPLE_RATE):
    com_initialized = _initialize_com()

    try:
        microphone = _audio_source(source)

        with microphone.recorder(samplerate=sample_rate) as recorder:
            data = recorder.record(numframes=sample_rate * seconds)

        output_file = Path(output_file)
        sf.write(output_file, _to_mono(data), sample_rate)
        return str(output_file)
    finally:
        _uninitialize_com(com_initialized)


def record_voice_chunk(
    seconds=1.5,
    source="microphone",
    output_file=OUTPUT_FILE,
    config=None,
):
    config = config or VoiceActivityConfig()
    com_initialized = _initialize_com()

    try:
        microphone = _audio_source(source)
        frame_count = int(config.sample_rate * seconds)

        with microphone.recorder(samplerate=config.sample_rate) as recorder:
            audio = _to_mono(recorder.record(numframes=frame_count))

        if _rms(audio) < config.threshold:
            return None

        output_file = Path(output_file)
        sf.write(output_file, audio, config.sample_rate)
        return str(output_file)
    finally:
        _uninitialize_com(com_initialized)


def record_voice_clip(
    source="system",
    output_file=OUTPUT_FILE,
    config=None,
    start_timeout_seconds=None,
):
    config = config or VoiceActivityConfig()
    com_initialized = _initialize_com()
    frame_count = int(config.sample_rate * config.frame_duration_ms / 1000)
    deadline = None

    if start_timeout_seconds is not None:
        deadline = time.monotonic() + start_timeout_seconds

    try:
        microphone = _audio_source(source)
        pre_roll = deque(maxlen=config.pre_roll_frames)
        frames = []
        speech_frames = 0
        silence_frames = 0
        speech_started = False
        clip_started_at = None

        with microphone.recorder(samplerate=config.sample_rate) as recorder:
            while True:
                audio = _to_mono(recorder.record(numframes=frame_count))
                is_voice = _rms(audio) >= config.threshold

                if not speech_started:
                    pre_roll.append(audio)
                    speech_frames = speech_frames + 1 if is_voice else 0

                    if speech_frames >= config.min_speech_frames:
                        speech_started = True
                        clip_started_at = time.monotonic()
                        frames.extend(pre_roll)
                    elif deadline is not None and time.monotonic() >= deadline:
                        return None

                    continue

                frames.append(audio)
                silence_frames = 0 if is_voice else silence_frames + 1

                clip_seconds = time.monotonic() - clip_started_at
                if silence_frames >= config.max_silence_frames:
                    break

                if clip_seconds >= config.max_recording_seconds:
                    break

        if not frames:
            return None

        output_file = Path(output_file)
        sf.write(output_file, np.concatenate(frames), config.sample_rate)
        return str(output_file)
    finally:
        _uninitialize_com(com_initialized)


def record_system_audio(seconds=5):
    return record_audio(seconds=seconds, source="system")


def record_microphone_audio(seconds=5):
    return record_audio(seconds=seconds, source="microphone")
