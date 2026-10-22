"""
backend/app/services/alerts.py — Alert Lifecycle, Smart Deduplication & Webhook Outbox Staging.
Groups events into 10-minute sliding buckets by (agent_id, rule_id or "anomaly").
Stages webhook delivery records within the alert transaction.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Tuple, List, Optional, Dict, Any
from sqlalchemy.orm import Session

from ..db.models import Alert, AlertComment, WebhookEndpoint, WebhookDelivery, Action, Rule
from ..core.config import settings

logger = logging.getLogger("agentshield.services.alerts")

class AlertService:
    """Service handling alert deduplication, grouping, triage, and outbox staging."""

    @staticmethod
    def create_or_deduplicate_alert(
        org_id: str,
        agent_id: str,
        action: Action,
        matched_rules: List[Rule],
        risk_score: float,
        db: Session,
        reason: Optional[str] = None,
    ) -> Tuple[Alert, bool]:
        """
        Deduplicates alerts by (agent_id, rule_id/anomaly, 10-minute bucket).
        Returns (alert_record, is_new_alert).
        """
        now = datetime.now(timezone.utc)
        rule_ident = matched_rules[0].id if matched_rules else "anomaly"
        # 10-minute time bucket (YYYYMMDDHHM0)
        time_bucket = now.strftime("%Y%m%d%H%M")[:11] + "0"
        group_key = f"{org_id}:{agent_id}:{rule_ident}:{time_bucket}"

        # Check for open alert with matching group_key
        existing_alert = (
            db.query(Alert)
            .filter(
                Alert.org_id == org_id,
                Alert.group_key == group_key,
                Alert.status.in_(["Open", "open", "Acknowledged", "acknowledged"]),
            )
            .first()
        )

        if existing_alert:
            existing_alert.count = (existing_alert.count or 1) + 1
            existing_alert.last_seen = now
            existing_alert.risk_score = max(existing_alert.risk_score, risk_score)
            return existing_alert, False

        # Create new Alert
        alert_id = f"ALT-{uuid.uuid4().hex[:6].upper()}"
        severity = "Critical" if risk_score >= 80 else "High" if risk_score >= 60 else "Medium"
        title = f"Security Violation: {matched_rules[0].name}" if matched_rules else "High Behavioral Anomaly"

        new_alert = Alert(
            id=alert_id,
            org_id=org_id,
            agent_id=agent_id,
            first_action_id=action.id,
            rule_id=matched_rules[0].id if matched_rules else None,
            title=title,
            severity=severity,
            risk_score=risk_score,
            status="Open",
            group_key=group_key,
            count=1,
            first_seen=now,
            last_seen=now,
            resolution_note=reason,
        )
        db.add(new_alert)
        db.flush()

        # Stage transactional outbox deliveries
        AlertService.stage_webhook_deliveries(new_alert, action, db)
        return new_alert, True

    @staticmethod
    def stage_webhook_deliveries(alert: Alert, action: Action, db: Session):
        """Stages pending webhook delivery rows for all matching active endpoints in the org."""
        endpoints = (
            db.query(WebhookEndpoint)
            .filter(
                WebhookEndpoint.org_id == alert.org_id,
                WebhookEndpoint.is_active == True,
            )
            .all()
        )

        payload = {
            "event": "alert.created",
            "alert_id": alert.id,
            "title": alert.title,
            "severity": alert.severity,
            "risk_score": alert.risk_score,
            "agent_id": alert.agent_id,
            "rule_id": alert.rule_id,
            "timestamp": alert.first_seen.isoformat() if alert.first_seen else "",
            "action": {
                "id": action.id,
                "action_type": action.action_type,
                "tool_name": action.tool_name,
                "parameters": action.parameters,
                "risk_score": action.risk_score,
            },
        }

        for ep in endpoints:
            events = ep.events if isinstance(ep.events, list) else []
            if "alert.created" in events or "all" in events or not events:
                delivery = WebhookDelivery(
                    id=str(uuid.uuid4()),
                    org_id=alert.org_id,
                    endpoint_id=ep.id,
                    alert_id=alert.id,
                    event_type="alert.created",
                    payload=payload,
                    status="pending",
                    attempts=0,
                    created_at=datetime.now(timezone.utc),
                )
                db.add(delivery)

    @staticmethod
    def add_comment(alert_id: str, user_id: str, body: str, db: Session) -> AlertComment:
        """Adds an analyst investigation note to the alert thread."""
        comment = AlertComment(
            id=str(uuid.uuid4()),
            alert_id=alert_id,
            user_id=user_id,
            body=body,
            created_at=datetime.now(timezone.utc),
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        return comment

    @staticmethod
    def get_comments(alert_id: str, db: Session) -> List[AlertComment]:
        """Retrieves chronological investigation notes for an alert."""
        return (
            db.query(AlertComment)
            .filter(AlertComment.alert_id == alert_id)
            .order_by(AlertComment.created_at.asc())
            .all()
        )
