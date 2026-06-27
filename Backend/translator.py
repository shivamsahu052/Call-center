def translate_to_hindi(text):
    if not text:
        return "", None

    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        return "", "Install deep-translator to enable Hindi translation."

    try:
        return GoogleTranslator(source="auto", target="hi").translate(text), None
    except Exception as exc:
        return "", f"Hindi translation is unavailable right now: {exc}"
