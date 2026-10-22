"""
agentshield.context — Context Variables and Session Management for AgentShield SDK.
Provides thread-safe and asyncio-task-safe session and agent context propagation.
"""

import contextvars
import uuid
from typing import Optional
from contextlib import contextmanager

_current_agent_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("current_agent_id", default=None)
_current_session_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar("current_session_id", default=None)


def get_current_agent_id() -> Optional[str]:
    return _current_agent_id.get()


def get_current_session_id() -> Optional[str]:
    return _current_session_id.get()


class AgentShieldSession:
    def __init__(self, agent_id: str, session_id: Optional[str] = None):
        self.agent_id = agent_id
        self.session_id = session_id or f"sess_{uuid.uuid4().hex[:12]}"
        self._tokens = []

    def __enter__(self):
        token_agent = _current_agent_id.set(self.agent_id)
        token_sess = _current_session_id.set(self.session_id)
        self._tokens = [token_agent, token_sess]
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if len(self._tokens) == 2:
            _current_agent_id.reset(self._tokens[0])
            _current_session_id.reset(self._tokens[1])
        return False


def session(agent_id: str, session_id: Optional[str] = None) -> AgentShieldSession:
    """Creates a scoped session context manager for agent telemetry."""
    return AgentShieldSession(agent_id=agent_id, session_id=session_id)
