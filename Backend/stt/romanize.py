DEVANAGARI_VOWELS = {
    "अ": "a",
    "आ": "aa",
    "इ": "i",
    "ई": "ee",
    "उ": "u",
    "ऊ": "oo",
    "ऋ": "ri",
    "ए": "e",
    "ऐ": "ai",
    "ओ": "o",
    "औ": "au",
}

DEVANAGARI_MATRAS = {
    "ा": "aa",
    "ि": "i",
    "ी": "ee",
    "ु": "u",
    "ू": "oo",
    "ृ": "ri",
    "े": "e",
    "ै": "ai",
    "ो": "o",
    "ौ": "au",
}

DEVANAGARI_CONSONANTS = {
    "क": "k",
    "ख": "kh",
    "ग": "g",
    "घ": "gh",
    "ङ": "ng",
    "च": "ch",
    "छ": "chh",
    "ज": "j",
    "झ": "jh",
    "ञ": "ny",
    "ट": "t",
    "ठ": "th",
    "ड": "d",
    "ढ": "dh",
    "ण": "n",
    "त": "t",
    "थ": "th",
    "द": "d",
    "ध": "dh",
    "न": "n",
    "प": "p",
    "फ": "ph",
    "ब": "b",
    "भ": "bh",
    "म": "m",
    "य": "y",
    "र": "r",
    "ल": "l",
    "व": "v",
    "श": "sh",
    "ष": "sh",
    "स": "s",
    "ह": "h",
    "ळ": "l",
    "क्ष": "ksh",
    "त्र": "tr",
    "ज्ञ": "gy",
}

DEVANAGARI_SIGNS = {
    "ं": "n",
    "ँ": "n",
    "ः": "h",
    "़": "",
    "ॅ": "e",
    "ॉ": "o",
    "्": "",
    "।": ".",
    "॥": ".",
}

DEVANAGARI_DIGITS = {
    "०": "0",
    "१": "1",
    "२": "2",
    "३": "3",
    "४": "4",
    "५": "5",
    "६": "6",
    "७": "7",
    "८": "8",
    "९": "9",
}


def romanize_text(text):
    if not any("\u0900" <= character <= "\u097f" for character in text):
        return text

    output = []
    index = 0

    while index < len(text):
        pair = text[index:index + 2]

        if pair in DEVANAGARI_CONSONANTS:
            next_character = text[index + 2:index + 3]
            output.append(_consonant_sound(pair, next_character))
            index += 2
            continue

        character = text[index]

        if character in DEVANAGARI_CONSONANTS:
            next_character = text[index + 1:index + 2]
            output.append(_consonant_sound(character, next_character))
        elif character in DEVANAGARI_VOWELS:
            output.append(DEVANAGARI_VOWELS[character])
        elif character in DEVANAGARI_MATRAS:
            output.append(DEVANAGARI_MATRAS[character])
        elif character in DEVANAGARI_SIGNS:
            output.append(DEVANAGARI_SIGNS[character])
        elif character in DEVANAGARI_DIGITS:
            output.append(DEVANAGARI_DIGITS[character])
        else:
            output.append(character)

        index += 1

    return _normalize_spacing("".join(output))


def _consonant_sound(character, next_character):
    base = DEVANAGARI_CONSONANTS[character]

    if next_character in DEVANAGARI_MATRAS or next_character == "्":
        return base

    return f"{base}a"


def _normalize_spacing(text):
    text = text.replace(" ,", ",").replace(" .", ".").replace(" ?", "?").replace(" !", "!")
    return " ".join(text.split())
