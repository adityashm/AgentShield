"""
AgentShield AI — Decoupled Simulator HTTP Client
Communicates strictly over HTTP/HTTPS with AgentShield API using Organization API Keys.
No direct database writes or internal state coupling.
"""

import asyncio
import time
from typing import Dict, Any, List, Optional
import httpx
import requests

from .scenarios import (
    SIMULATED_AGENTS,
    NORMAL_ACTIONS,
    THREAT_SCENARIOS,
    get_scenario,
    generate_random_action,
    generate_batch,
)

DEFAULT_BASE_URL = "http://localhost:8000"
DEFAULT_DEMO_API_KEY = "ashield_test_default_demo_key_12345"

class SimulatorClient:
    """Decoupled client simulating autonomous AI agents sending telemetry and evaluation requests."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str = DEFAULT_DEMO_API_KEY,
        timeout: float = 10.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": self.api_key,
            "User-Agent": "AgentShield-Simulator/1.0",
        }

        # Background loop state
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.actions_sent = 0
        self.threats_sent = 0
        self.start_time: Optional[float] = None
        self.last_error: Optional[str] = None

    # -------------------------------------------------------------------------
    # Async Methods (used in ASGI/FastAPI or async CLI)
    # -------------------------------------------------------------------------

    async def ping(self) -> Dict[str, Any]:
        """Verify connectivity and API key validity against AgentShield."""
        url = f"{self.base_url}/api/v1/api-keys/ping"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.get(url, headers=self.headers)
            r.raise_for_status()
            return r.json()

    async def send_action(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Ingests a single action event via POST /api/v1/actions."""
        url = f"{self.base_url}/api/v1/actions"
        payload = {
            "agent_id": agent_id,
            "action_type": action_type,
            "parameters": parameters,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(url, json=payload, headers=self.headers)
            r.raise_for_status()
            self.actions_sent += 1
            return r.json()

    async def send_batch(self, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Ingests a batch of actions via POST /api/v1/actions/batch."""
        url = f"{self.base_url}/api/v1/actions/batch"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(url, json=actions, headers=self.headers)
            r.raise_for_status()
            self.actions_sent += len(actions)
            return r.json()

    async def evaluate_action(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Performs pre-flight policy evaluation via POST /api/v1/evaluate."""
        url = f"{self.base_url}/api/v1/evaluate"
        payload = {
            "agent_id": agent_id,
            "action_type": action_type,
            "parameters": parameters,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(url, json=payload, headers=self.headers)
            r.raise_for_status()
            return r.json()

    async def inject_scenario(self, scenario_key: str, evaluate: bool = False) -> Dict[str, Any]:
        """Injects a specific threat scenario by key."""
        scenario = get_scenario(scenario_key)
        if evaluate:
            return await self.evaluate_action(
                agent_id=scenario["agent_id"],
                action_type=scenario["action_type"],
                parameters=scenario["parameters"],
            )
        else:
            res = await self.send_action(
                agent_id=scenario["agent_id"],
                action_type=scenario["action_type"],
                parameters=scenario["parameters"],
            )
            self.threats_sent += 1
            return res

    # -------------------------------------------------------------------------
    # Synchronous Methods (for CLI execution)
    # -------------------------------------------------------------------------

    def sync_ping(self) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/api-keys/ping"
        r = requests.get(url, headers=self.headers, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def sync_send_action(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/actions"
        payload = {
            "agent_id": agent_id,
            "action_type": action_type,
            "parameters": parameters,
        }
        r = requests.post(url, json=payload, headers=self.headers, timeout=self.timeout)
        r.raise_for_status()
        self.actions_sent += 1
        return r.json()

    def sync_send_batch(self, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/actions/batch"
        r = requests.post(url, json=actions, headers=self.headers, timeout=self.timeout)
        r.raise_for_status()
        self.actions_sent += len(actions)
        return r.json()

    def sync_evaluate_action(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict[str, Any],
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/api/v1/evaluate"
        payload = {
            "agent_id": agent_id,
            "action_type": action_type,
            "parameters": parameters,
        }
        r = requests.post(url, json=payload, headers=self.headers, timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    # -------------------------------------------------------------------------
    # Background Async Loop
    # -------------------------------------------------------------------------

    async def start_loop(
        self,
        interval: float = 3.0,
        threat_probability: float = 0.15,
        batch_size: int = 1,
    ) -> None:
        """Starts asynchronous autonomous simulation loop."""
        if self.is_running:
            return
        self.is_running = True
        self.start_time = time.time()
        self.last_error = None
        self._task = asyncio.create_task(
            self._loop_worker(interval, threat_probability, batch_size)
        )

    async def stop_loop(self) -> None:
        """Stops asynchronous simulation loop."""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop_worker(
        self,
        interval: float,
        threat_probability: float,
        batch_size: int,
    ) -> None:
        while self.is_running:
            try:
                if batch_size > 1:
                    batch = generate_batch(size=batch_size, threat_probability=threat_probability)
                    await self.send_batch(batch)
                else:
                    action = generate_random_action(threat_probability=threat_probability)
                    await self.send_action(
                        agent_id=action["agent_id"],
                        action_type=action["action_type"],
                        parameters=action["parameters"],
                    )
                    if action["is_threat"]:
                        self.threats_sent += 1

                self.last_error = None
                await asyncio.sleep(interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.last_error = str(e)
                await asyncio.sleep(max(interval, 5.0))

    def get_status(self) -> Dict[str, Any]:
        """Returns live simulation stats."""
        uptime = time.time() - self.start_time if (self.is_running and self.start_time) else 0.0
        return {
            "running": self.is_running,
            "actions_sent": self.actions_sent,
            "threats_sent": self.threats_sent,
            "uptime_seconds": round(uptime, 1),
            "last_error": self.last_error,
            "base_url": self.base_url,
            "simulated_agents_count": len(SIMULATED_AGENTS),
        }
