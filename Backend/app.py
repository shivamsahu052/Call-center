from datetime import datetime

import streamlit as st

try:
    from .audio_capture import VoiceActivityConfig, record_voice_chunk
    from .transcriber import transcribe
    from .translator import translate_to_hindi
except ImportError:
    if __package__:
        raise

    from audio_capture import VoiceActivityConfig, record_voice_chunk
    from transcriber import transcribe
    from translator import translate_to_hindi

st.title("AI Call Center Live Transcription")

if "listening" not in st.session_state:
    st.session_state.listening = False

if "transcripts" not in st.session_state:
    st.session_state.transcripts = []

if "translation_error" not in st.session_state:
    st.session_state.translation_error = ""

spoken_language_label = st.radio(
    "Speaking language",
    ["Auto detect", "English", "Hindi"],
    horizontal=True,
)
spoken_language = {
    "Auto detect": None,
    "English": "en",
    "Hindi": "hi",
}[spoken_language_label]

show_hindi = st.checkbox("Show Hindi translation", value=True)

sensitivity = st.slider(
    "Voice sensitivity",
    min_value=1,
    max_value=10,
    value=6,
    help="Increase this if quiet voices are not detected. Decrease it if background noise is captured.",
)
threshold = 0.024 - (sensitivity * 0.002)

chunk_seconds = st.slider(
    "Live update speed",
    min_value=1.0,
    max_value=4.0,
    value=1.5,
    step=0.5,
    help="Lower values update faster. Higher values usually produce cleaner sentences.",
)

left, right = st.columns(2)

with left:
    if st.button("Start Listening", type="primary", disabled=st.session_state.listening):
        st.session_state.listening = True
        st.rerun()

with right:
    if st.button("Stop Listening", disabled=not st.session_state.listening):
        st.session_state.listening = False
        st.rerun()

status = st.empty()
latest = st.empty()
transcript_area = st.container()

if st.session_state.listening:
    status.info("Listening for voice...")

    config = VoiceActivityConfig(threshold=threshold)
    audio_file = record_voice_chunk(
        seconds=chunk_seconds,
        source="microphone",
        config=config,
    )

    if audio_file:
        status.info("Voice detected. Converting speech to text...")
        text = transcribe(audio_file, language=spoken_language)

        if text:
            hindi_text = ""

            if show_hindi:
                hindi_text, translation_error = translate_to_hindi(text)
                st.session_state.translation_error = translation_error or ""

            st.session_state.transcripts.append(
                {
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "text": text,
                    "hindi": hindi_text,
                }
            )
            latest.success(text)
        else:
            latest.warning("Voice detected, but no clear words were transcribed.")

    st.rerun()
else:
    status.warning("Listening is stopped.")

if show_hindi and st.session_state.translation_error:
    st.warning(st.session_state.translation_error)

with transcript_area:
    st.subheader("Live Transcript")
    transcript = st.session_state.transcripts

    if transcript:
        for item in reversed(transcript):
            st.write(f"{item['time']} - {item['text']}")

            if show_hindi and item["hindi"]:
                st.write(f"Hindi: {item['hindi']}")
    else:
        st.caption("Start listening to see converted text here.")
