"""
AgentShield AI — Simulation Service Bridge
Coordinates background agent simulation using the unified detection & ingestion pipeline.
"""

import asyncio
import random
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..db.models import Agent, Organization
from ..simulator.scenarios import (
    SIMULATED_AGENTS,
    NORMAL_ACTIONS,
    THREAT_SCENARIOS,
    get_scenario,
    generate_random_action,
)
from ..core.config import settings

logger = logging.getLogger("agentshield.simulator")

# Convert threat scenario dictionary into list for indexing
THREAT_SCENARIOS_LIST: List[Dict[str, Any]] = [
    {
        "agent": sc["agent_id"],
        "type": sc["action_type"],
        "params": sc["parameters"],
        "description": sc["description"],
    }
    for sc in THREAT_SCENARIOS.values()
]
# Expose backward compatibility alias
THREAT_SCENARIOS = THREAT_SCENARIOS_LIST

class AgentSimulator:
    """Coordinates autonomous agent simulation via the production ingestion pipeline."""

    def __init__(self):
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.actions_sent = 0
        self.threats_sent = 0
        self.start_time: Optional[float] = None

    def seed_agents(self, db: Optional[Session] = None) -> int:
        """Initializes simulated demo agents in the database if not present."""
        owns_db = False
        if db is None:
            db = SessionLocal()
            owns_db = True

        seeded = 0
        try:
            # Ensure org_default exists
            org = db.query(Organization).filter(Organization.id == "org_default").first()
            if not org:
                org = Organization(
                    id="org_default",
                    name="Default Organization",
                    slug="default-org",
                    plan="enterprise",
                )
                db.add(org)
                db.flush()

            for ag in SIMULATED_AGENTS:
                existing = (
                    db.query(Agent)
                    .filter(Agent.external_id == ag["id"], Agent.org_id == org.id)
                    .first()
                )
                if not existing:
                    agent = Agent(
                        id=f"{org.id}_{ag['id']}",
                        external_id=ag["id"],
                        name=ag["name"],
                        org_id=org.id,
                        framework="custom",
                        environment="production",
                        status="active",
                        risk_score=random.uniform(5.0, 20.0),
                        is_synthetic=True,
                        metadata_json={
                            "role": ag.get("role", "Worker"),
                            "type": ag.get("type", "Autonomous Agent"),
                        },
                    )
                    db.add(agent)
                    seeded += 1
            db.commit()
            return seeded
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to seed demo agents: {e}")
            return 0
        finally:
            if owns_db:
                db.close()

    async def start(self):
        """Starts background simulation loop."""
        if self.is_running:
            return
        self.is_running = True
        import time
        self.start_time = time.time()
        self.seed_agents()
        self._task = asyncio.create_task(self._simulation_loop())
        logger.info("Autonomous agent simulation started.")

    async def stop(self):
        """Stops background simulation loop."""
        self.is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        logger.info("Autonomous agent simulation stopped.")

    async def _simulation_loop(self):
        while self.is_running:
            try:
                # 80% normal actions, 20% threat injection
                is_threat = random.random() < 0.20
                if is_threat:
                    threat = random.choice(THREAT_SCENARIOS_LIST)
                    await self.inject_event(
                        agent_id=threat["agent"],
                        action_type=threat["type"],
                        parameters=threat["params"],
                    )
                    self.threats_sent += 1
                else:
                    agent = random.choice(SIMULATED_AGENTS)
                    normal = random.choice(NORMAL_ACTIONS)
                    await self.inject_event(
                        agent_id=agent["id"],
                        action_type=normal["action_type"],
                        parameters=normal["parameters"],
                    )

                self.actions_sent += 1
                await asyncio.sleep(settings.SIMULATOR_INTERVAL_SECONDS)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in simulator loop: {e}")
                await asyncio.sleep(5)

    async def inject_event(
        self,
        agent_id: str,
        action_type: str,
        parameters: Dict[str, Any],
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """Ingests an action event through the full production pipeline."""
        from ..api.v1.actions import process_single_action, ActionEvent
        from ..realtime.bus import bus

        owns_db = False
        if db is None:
            db = SessionLocal()
            owns_db = True
        try:
            org = db.query(Organization).filter(Organization.id == "org_default").first()
            if not org:
                org = Organization(
                    id="org_default",
                    name="Default Organization",
                    slug="default-org",
                    plan="enterprise",
                )
                db.add(org)
                db.flush()

            event = ActionEvent(
                agent_id=agent_id,
                action_type=action_type,
                parameters=parameters,
            )

            action, matched_rules, alert_id = process_single_action(
                event=event,
                org=org,
                db=db,
                persist=True,
            )
            db.commit()

            ws_payload = {
                "type": "ACTION_EVENT",
                "action_id": action.id,
                "agent": agent_id,
                "action": action_type,
                "risk": action.risk_score,
                "anomaly": action.anomaly_score,
                "tone": "danger" if action.risk_score >= 75 else "warning" if action.risk_score >= 45 else "success",
                "time": action.timestamp.strftime("%H:%M:%S.%f")[:12],
                "status": "Critical" if action.risk_score >= 80 else "Suspicious" if action.risk_score >= 50 else "Normal",
                "alert": {"alert_id": alert_id, "agent_id": agent_id, "risk_score": action.risk_score} if alert_id else None,
            }
            return ws_payload
        finally:
            if owns_db:
                db.close()

simulator = AgentSimulator()
