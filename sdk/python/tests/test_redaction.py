"""
sdk/python/tests/test_redaction.py — Unit Tests for Secret Scrubber & Redaction.
"""

from agentshield.redaction import redact_string, redact_secrets


def test_redact_api_key_patterns():
    # OpenAI key
    text_openai = "Connecting with sk-proj-abcdef1234567890abcdef1234567890 for prompt generation."
    redacted = redact_string(text_openai)
    assert "[REDACTED:openai_api_key]" in redacted
    assert "sk-proj-" not in redacted

    # Anthropic key
    text_ant = "Auth header: Bearer sk-ant-api03-abcdef1234567890abcdef1234567890"
    redacted_ant = redact_string(text_ant)
    assert "[REDACTED:anthropic_api_key]" in redacted_ant
    assert "sk-ant-" not in redacted_ant

    # AWS Access Key
    text_aws = "S3 config with AKIAIOSFODNN7EXAMPLE key"
    redacted_aws = redact_string(text_aws)
    assert "[REDACTED:aws_access_key]" in redacted_aws
    assert "AKIAIOSFODNN7EXAMPLE" not in redacted_aws

    # GitHub token
    text_gh = "git remote set-url origin https://ghp_1234567890abcdefghijklmnopqrstuvwxyz@github.com"
    redacted_gh = redact_string(text_gh)
    assert "[REDACTED:github_token]" in redacted_gh
    assert "ghp_" not in redacted_gh


def test_redact_sensitive_dictionary_keys():
    payload = {
        "user": "alice",
        "password": "SuperSecretPassword123!",
        "api_key": "some_plain_key",
        "nested": {
            "access_token": "token_abc_xyz",
            "safe_param": 42,
        },
        "items": [
            {"secret": "hidden_val", "name": "public_item"},
        ],
    }

    cleaned = redact_secrets(payload)
    assert cleaned["user"] == "alice"
    assert cleaned["password"] == "[REDACTED]"
    assert cleaned["api_key"] == "[REDACTED]"
    assert cleaned["nested"]["access_token"] == "[REDACTED]"
    assert cleaned["nested"]["safe_param"] == 42
    assert cleaned["items"][0]["secret"] == "[REDACTED]"
    assert cleaned["items"][0]["name"] == "public_item"
