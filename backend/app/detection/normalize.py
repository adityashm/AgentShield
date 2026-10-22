"""
backend/app/detection/normalize.py — Layered payload normalization and deobfuscation.
Strips evasion techniques: zero-width chars, homoglyph confusables, nested encodings.
"""

import re
import html
import base64
import binascii
import unicodedata
import urllib.parse
from typing import Any, Dict, List, Union

# Invisible and zero-width characters
ZERO_WIDTH_CHARS = re.compile(
    r"[\u200B\u200C\u200D\u200E\u200F\uFEFF\u2060\u2061\u2062\u2063\u2064\u00AD\u180E]"
)

# Common Cyrillic & Greek homoglyphs to ASCII
HOMOGLYPH_MAP = {
    "а": "a", "А": "A",
    "с": "c", "С": "C",
    "е": "e", "Е": "E",
    "о": "o", "О": "O",
    "р": "p", "Р": "P",
    "ѕ": "s", "Ѕ": "S",
    "х": "x", "Х": "X",
    "у": "y", "У": "Y",
    "і": "i", "І": "I",
    "ј": "j", "Ј": "J",
    "ԁ": "d", "Ԃ": "D",
    "ԛ": "q", "Ԛ": "Q",
    "ԝ": "w", "Ԝ": "W",
    # Greek
    "α": "a", "Α": "A",
    "β": "b", "Β": "B",
    "γ": "g", "Γ": "G",
    "ε": "e", "Ε": "E",
    "η": "h", "Η": "H",
    "ι": "i", "Ι": "I",
    "κ": "k", "Κ": "K",
    "ν": "v", "Ν": "N",
    "ο": "o", "Ο": "O",
    "ρ": "p", "Ρ": "P",
    "τ": "t", "Τ": "T",
    "υ": "u", "Υ": "Y",
    "χ": "x", "Χ": "X",
}
HOMOGLYPH_TRANSLATION = str.maketrans(HOMOGLYPH_MAP)

# Hex escape regex \x41\x42 or 0x41
HEX_ESCAPE_RE = re.compile(r"\\x([0-9a-fA-F]{2})")

def strip_zero_width(text: str) -> str:
    """Removes all zero-width and invisible control format characters."""
    return ZERO_WIDTH_CHARS.sub("", text)

def replace_homoglyphs(text: str) -> str:
    """Normalizes known Cyrillic, Greek, and confusable lookalike characters to standard Latin."""
    return text.translate(HOMOGLYPH_TRANSLATION)

def decode_hex_escapes(text: str) -> str:
    """Decodes \\x41 style escape sequences into characters."""
    try:
        return HEX_ESCAPE_RE.sub(lambda m: chr(int(m.group(1), 16)), text)
    except Exception:
        return text

def try_decode_base64_segment(segment: str) -> str:
    """Attempts to decode a candidate base64 string if it contains readable text."""
    clean = segment.strip()
    if len(clean) < 8 or len(clean) % 4 != 0:
        return segment
    try:
        decoded_bytes = base64.b64decode(clean, validate=True)
        # Check if decoded content is printable ASCII or UTF-8 text
        decoded_text = decoded_bytes.decode("utf-8")
        if all(c.isprintable() or c in "\r\n\t " for c in decoded_text):
            return decoded_text
    except Exception:
        pass
    return segment

def recursive_deobfuscate(text: str, max_depth: int = 3) -> str:
    """
    Recursively decodes URL percent-encoding, HTML entities, hex escapes,
    and Base64 strings up to max_depth levels.
    """
    current = text
    for _ in range(max_depth):
        prev = current

        # 1. HTML entities
        current = html.unescape(current)

        # 2. URL percent decoding
        try:
            current = urllib.parse.unquote(current)
        except Exception:
            pass

        # 3. Hex escapes
        current = decode_hex_escapes(current)

        # 4. Standalone or embedded base64 blocks
        # Look for tokens that match base64 pattern
        tokens = current.split()
        modified_tokens = []
        for t in tokens:
            if len(t) >= 12 and re.match(r"^[A-Za-z0-9+/=]+$", t):
                decoded_t = try_decode_base64_segment(t)
                modified_tokens.append(decoded_t)
            else:
                modified_tokens.append(t)
        current = " ".join(modified_tokens)

        # If no further changes were made, terminate early
        if current == prev:
            break

    return current

def normalize_text(text: str, max_length: int = 65536) -> str:
    """
    Applies the full normalization pipeline:
    1. Truncate bounded size
    2. Unicode NFKC normalization
    3. Zero-width character stripping
    4. Homoglyph confusable normalization
    5. Recursive deobfuscation (URL/HTML/Hex/Base64)
    6. Whitespace collapse
    """
    if not isinstance(text, str):
        return str(text)

    # 1. Truncate
    if len(text) > max_length:
        text = text[:max_length]

    # 2. Unicode NFKC
    normalized = unicodedata.normalize("NFKC", text)

    # 3. Strip zero-width
    normalized = strip_zero_width(normalized)

    # 4. Homoglyphs
    normalized = replace_homoglyphs(normalized)

    # 5. Recursive deobfuscation
    normalized = recursive_deobfuscate(normalized, max_depth=3)

    # 6. Normalize newlines and collapse excessive spaces
    normalized = re.sub(r"[ \t]+", " ", normalized)

    return normalized

def normalize_payload(payload: Any, max_depth: int = 10) -> Any:
    """Recursively traverses dictionaries, lists, and strings to apply normalization."""
    if max_depth <= 0:
        return str(payload)[:1024]

    if isinstance(payload, str):
        return normalize_text(payload)
    elif isinstance(payload, dict):
        return {k: normalize_payload(v, max_depth - 1) for k, v in payload.items()}
    elif isinstance(payload, list):
        return [normalize_payload(item, max_depth - 1) for item in payload]
    return payload
