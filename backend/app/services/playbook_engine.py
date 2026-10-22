"""
backend/app/services/playbook_engine.py — Automated Incident Remediation Engine.
Evaluates trigger conditions when alerts occur and executes automated defense playbooks.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from ..db.models import Playbook, Alert, Agent, AuditLog
from ..services.audit import AuditService
from ..services.websocket_manager import ws_manager

logger = logging.getLogger("agentshield.services.playbook")

class PlaybookEngine:
    @staticmethod
    def seed_default_playbooks(db: Session, org_id: str = "org_default"):
        """Seeds standard enterprise incident playbooks if none exist."""
        existing = db.query(Playbook).filter(Playbook.org_id == org_id).first()
        if existing:
            return

        defaults = [
            Playbook(
                id=f"pb_quarantine_critical_{org_id}",
                org_id=org_id,
                name="Auto-Quarantine on Repeated Critical Alerts",
                description="Immediately places an agent in quarantine if 2 or more Critical alerts occur within 5 minutes.",
                trigger_event="alert.created",
                severity_threshold="Critical",
                count_threshold=2,
                time_window_seconds=300,
                action_type="quarantine_agent",
                enabled=True,
            ),
            Playbook(
                id=f"pb_circuit_breaker_{org_id}",
                org_id=org_id,
                name="Autonomous Circuit Breaker on Anomaly Flood",
                description="Trips an emergency halt on an agent if 3 or more High/Critical alerts occur within 10 minutes.",
                trigger_event="alert.created",
                severity_threshold="High",
                count_threshold=3,
                time_window_seconds=600,
                action_type="trip_circuit_breaker",
                enabled=True,
            ),
        ]
        for pb in defaults:
            db.add(pb)
        try:
            db.commit()
            logger.info("Seeded default automated incident playbooks.")
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not seed playbooks: {e}")

    @staticmethod
    async def evaluate_alert(alert: Alert, db: Session):
        """
        Evaluates active playbooks after an alert is created.
        Executes automated actions if thresholds are reached.
        """
        now = datetime.now(timezone.utc)
        org_id = alert.org_id or "org_default"
        agent_id = alert.agent_id

        # Query enabled playbooks for this tenant
        playbooks = (
            db.query(Playbook)
            .filter(Playbook.org_id == org_id, Playbook.enabled == True)
            .all()
        )
        if not playbooks:
            return

        for pb in playbooks:
            # Check window
            window_start = now - timedelta(seconds=pb.time_window_seconds)
            
            # Count recent matching alerts for this agent
            sev_levels = ["Critical"] if pb.severity_threshold == "Critical" else ["Critical", "High"]
            recent_count = (
                db.query(Alert)
                .filter(
                    Alert.agent_id == agent_id,
                    Alert.created_at >= window_start,
                    Alert.severity.in_(sev_levels),
                )
                .count()
            )

            if recent_count >= pb.count_threshold:
                # Trigger action!
                agent = db.query(Agent).filter((Agent.id == agent_id) | (Agent.external_id == agent_id)).first()
                if not agent:
                    continue

                # Execute remediation
                action_taken = pb.action_type
                if pb.action_type == "quarantine_agent" and agent.status != "quarantined":
                    agent.status = "quarantined"
                    meta = dict(agent.metadata_json or {})
                    meta["quarantined_by_playbook"] = pb.name
                    meta["quarantined_at"] = now.isoformat()
                    agent.metadata_json = meta
                    logger.warning(f"PLAYBOOK TRIGGERED: Quarantined agent {agent.id} via {pb.name}")
                elif pb.action_type == "trip_circuit_breaker" and agent.status != "halted":
                    agent.status = "halted"
                    meta = dict(agent.metadata_json or {})
                    meta["halted_by_playbook"] = pb.name
                    meta["halted_at"] = now.isoformat()
                    agent.metadata_json = meta
                    logger.warning(f"PLAYBOOK TRIGGERED: Tripped circuit breaker on {agent.id} via {pb.name}")

                pb.execution_count = (pb.execution_count or 0) + 1
                pb.last_triggered_at = now

                # Audit log
                AuditService.log_event(
                    db=db,
                    org_id=org_id,
                    action="playbook.execute",
                    target_type="agent",
                    target_id=agent.id,
                    actor_type="playbook",
                    actor_id=pb.id,
                    ip="127.0.0.1",
                    details={
                        "playbook_name": pb.name,
                        "action_type": action_taken,
                        "recent_alert_count": recent_count,
                        "agent_id": agent.id,
                    },
                )
                db.commit()

                # Broadcast live event
                await ws_manager.broadcast({
                    "type": "PLAYBOOK_TRIGGERED",
                    "playbook": pb.name,
                    "action_type": action_taken,
                    "agent": agent.external_id,
                    "recent_alerts": recent_count,
                    "time": now.strftime("%H:%M:%S"),
                })
