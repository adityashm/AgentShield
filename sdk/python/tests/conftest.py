"""
sdk/python/tests/conftest.py — Test Fixtures for AgentShield Python SDK.
"""

import pytest
import os

@pytest.fixture(autouse=True)
def clean_env():
    old_key = os.environ.get("AGENTSHIELD_API_KEY")
    old_ep = os.environ.get("AGENTSHIELD_ENDPOINT")
    yield
    if old_key is not None:
        os.environ["AGENTSHIELD_API_KEY"] = old_key
    else:
        os.environ.pop("AGENTSHIELD_API_KEY", None)
    if old_ep is not None:
        os.environ["AGENTSHIELD_ENDPOINT"] = old_ep
    else:
        os.environ.pop("AGENTSHIELD_ENDPOINT", None)
