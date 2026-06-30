def translate_to_hindi(text):
    translated, error = translate_texts_to_hindi([text])
    return (translated[0] if translated else ""), error


def translate_texts_to_hindi(texts):
    clean_texts = [text.strip() if text else "" for text in texts]

    if not any(clean_texts):
        return clean_texts, None

    try:
        from deep_translator import GoogleTranslator
    except ImportError:
        return clean_texts, "Install deep-translator to enable Hindi translation."

    translator = GoogleTranslator(source="auto", target="hi")

    try:
        translated = translator.translate_batch(clean_texts)
        return _normalize_translation_result(clean_texts, translated), None
    except Exception:
        translated = []
        errors = []

        for text in clean_texts:
            if not text:
                translated.append("")
                continue

            try:
                translated.append(translator.translate(text))
            except Exception as exc:
                translated.append(text)
                errors.append(str(exc))

        if errors:
            return translated, f"Hindi translation is partly unavailable: {errors[0]}"

        return translated, None


def _normalize_translation_result(original_texts, translated_texts):
    if isinstance(translated_texts, str):
        translated_texts = [translated_texts]

    translated = list(translated_texts or [])

    if len(translated) != len(original_texts):
        return original_texts

    return [item if item is not None else original for item, original in zip(translated, original_texts)]
