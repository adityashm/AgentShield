"""
agentshield.redaction — Client-Side Secret and Credential Redaction Engine.
Sanitizes telemetry payloads before dispatching to the server so API keys, passwords,
and private credentials are never leaked in transit or storage.
"""

import re
from typing import Any, Dict, List, Pattern

PATTERNS: List[tuple[Pattern, str]] = [
    (re.compile(r"-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]+?-----END [A-Z ]+PRIVATE KEY-----"), "[REDACTED:private_key]"),
    (re.compile(r"\bsk-ant-[A-Za-z0-9_-]{20,}\b"), "[REDACTED:anthropic_api_key]"),
    (re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"), "[REDACTED:openai_api_key]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED:aws_access_key]"),
    (re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}\b"), "[REDACTED:github_token]"),
    (re.compile(r"\bey[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b"), "[REDACTED:jwt]"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9_-]{10,}\b"), "[REDACTED:slack_token]"),
]

SENSITIVE_KEY_RE = re.compile(
    r"(?i)(password|secret|api_key|access_token|auth_token|credential|private_key|refresh_token)"
)


def redact_string(val: str) -> str:
    """Scans and replaces secret patterns in a string."""
    if not isinstance(val, str) or not val:
        return val
    result = val
    for pattern, replacement in PATTERNS:
        result = pattern.sub(replacement, result)
    return result


def redact_secrets(data: Any, max_depth: int = 8) -> Any:
    """
    Recursively redacts sensitive keys and secret patterns from nested dictionaries, lists, and strings.
    """
    if max_depth <= 0:
        return "[TRUNCATED:max_depth]"

    if isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            str_key = str(k)
            if SENSITIVE_KEY_RE.search(str_key):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = redact_secrets(v, max_depth=max_depth - 1)
        return cleaned

    elif isinstance(data, list):
        return [redact_secrets(item, max_depth=max_depth - 1) for item in data]

    elif isinstance(data, str):
        return redact_string(data)

    elif isinstance(data, (int, float, bool)) or data is None:
        return data

    else:
        # For non-standard objects, convert to string and scrub
        return redact_string(str(data))
