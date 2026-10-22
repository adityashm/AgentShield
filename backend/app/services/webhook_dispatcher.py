import hmac
import hashlib
import json
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import httpx
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import WebhookEndpoint

logger = logging.getLogger("agentshield.webhooks")

SEVERITY_ORDER = {
    "low": 1,
    "medium": 2,
    "high": 3,
    "critical": 4,
}

class WebhookDispatcher:
    def __init__(self):
        # In-memory cooldown cache: key -> float timestamp
        # Prevents alert flapping storms from overwhelming webhooks
        self._cooldown_cache: Dict[str, float] = {}
        self.cooldown_seconds = 15.0

    def compute_hmac_signature(self, secret: str, timestamp: int, payload_bytes: bytes) -> str:
        """
        Computes HMAC-SHA256 signature for webhook payload authenticity.
        Format: v1={hex_digest} computed over '{timestamp}.{payload}'
        """
        signed_content = f"{timestamp}.".encode("utf-8") + payload_bytes
        signature = hmac.new(
            secret.encode("utf-8"),
            signed_content,
            hashlib.sha256
        ).hexdigest()
        return f"t={timestamp},v1={signature}"

    def format_generic_payload(self, alert_data: Dict[str, Any], action_data: Optional[Dict[str, Any]], org_id: str) -> Dict[str, Any]:
        return {
            "event": "alert.created",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "org_id": org_id,
            "alert": alert_data,
            "action": action_data or {},
        }

    def format_slack_payload(self, alert_data: Dict[str, Any], action_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        severity = str(alert_data.get("severity", "High")).upper()
        emoji = "🚨" if severity == "CRITICAL" else "⚠️" if severity == "HIGH" else "ℹ️"
        agent_id = alert_data.get("agent_id", "Unknown")
        risk_score = alert_data.get("risk_score", 0.0)
        trigger_type = alert_data.get("trigger_type", "Rule Match")
        notes = alert_data.get("notes", "Security threshold violation detected")

        return {
            "text": f"{emoji} AgentShield Alert: [{severity}] on agent {agent_id} (Risk: {risk_score:.1f}/100)",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} AgentShield Security Alert — {severity}",
                        "emoji": True
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Agent ID:*\n`{agent_id}`"},
                        {"type": "mrkdwn", "text": f"*Risk Score:*\n`{risk_score:.1f} / 100`"},
                        {"type": "mrkdwn", "text": f"*Trigger:*\n{trigger_type}"},
                        {"type": "mrkdwn", "text": f"*Severity:*\n*{severity}*"}
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Description:*\n{notes}"
                    }
                }
            ]
        }

    def format_discord_payload(self, alert_data: Dict[str, Any], action_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        severity = str(alert_data.get("severity", "High")).upper()
        # Discord embed colors (decimal): Critical=Red (0xEF4444), High=Orange (0xF97316), Medium=Yellow (0xEAB308)
        color = 0xEF4444 if severity == "CRITICAL" else 0xF97316 if severity == "HIGH" else 0xEAB308
        agent_id = alert_data.get("agent_id", "Unknown")
        risk_score = alert_data.get("risk_score", 0.0)
        trigger_type = alert_data.get("trigger_type", "Rule Match")
        notes = alert_data.get("notes", "Security threshold violation detected")

        return {
            "username": "AgentShield Guardrail",
            "embeds": [
                {
                    "title": f"🚨 AgentShield Alert: {severity}",
                    "color": color,
                    "description": notes,
                    "fields": [
                        {"name": "Agent ID", "value": f"`{agent_id}`", "inline": True},
                        {"name": "Risk Score", "value": f"`{risk_score:.1f}/100`", "inline": True},
                        {"name": "Trigger", "value": trigger_type, "inline": True},
                    ],
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "footer": {"text": "AgentShield Autonomous Security Gateway"}
                }
            ]
        }

    def should_deliver(self, endpoint: WebhookEndpoint, alert_data: Dict[str, Any]) -> bool:
        if not endpoint.enabled:
            return False

        # Severity filter
        alert_sev = str(alert_data.get("severity", "High")).lower()
        min_sev = str(endpoint.min_severity or "High").lower()
        if SEVERITY_ORDER.get(alert_sev, 2) < SEVERITY_ORDER.get(min_sev, 3):
            return False

        # Anti-flapping deduplication (skip cooldown for Critical alerts)
        if alert_sev != "critical":
            cache_key = f"{endpoint.endpoint_id}:{alert_data.get('agent_id')}:{alert_data.get('trigger_type')}"
            now = time.time()
            last_sent = self._cooldown_cache.get(cache_key, 0.0)
            if (now - last_sent) < self.cooldown_seconds:
                logger.info(f"Webhook {endpoint.endpoint_id} throttled due to anti-flapping cooldown ({cache_key}).")
                return False
            self._cooldown_cache[cache_key] = now

        return True

    async def deliver_to_endpoint(
        self,
        endpoint_id: str,
        url: str,
        secret: Optional[str],
        target_type: str,
        payload_data: Dict[str, Any],
    ) -> bool:
        """Sends payload with exponential backoff retries."""
        raw_body = json.dumps(payload_data).encode("utf-8")
        timestamp = int(time.time())

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AgentShield-Webhook/1.0",
            "X-AgentShield-Timestamp": str(timestamp),
            "X-AgentShield-Event": "alert.created",
        }
        if secret:
            headers["X-AgentShield-Signature"] = self.compute_hmac_signature(secret, timestamp, raw_body)

        success = False
        max_attempts = 3
        backoff = 0.5

        async with httpx.AsyncClient(timeout=5.0) as client:
            for attempt in range(1, max_attempts + 1):
                try:
                    response = await client.post(url, content=raw_body, headers=headers)
                    if response.status_code in (200, 201, 202, 204):
                        success = True
                        break
                    else:
                        logger.warning(f"Webhook {endpoint_id} returned HTTP {response.status_code} (attempt {attempt})")
                except Exception as exc:
                    logger.warning(f"Webhook {endpoint_id} delivery error (attempt {attempt}): {exc}")

                if attempt < max_attempts:
                    await asyncio.sleep(backoff)
                    backoff *= 2.0

        # Update database record asynchronously
        db = SessionLocal()
        try:
            ep = db.query(WebhookEndpoint).filter(WebhookEndpoint.endpoint_id == endpoint_id).first()
            if ep:
                if success:
                    ep.last_triggered_at = datetime.now(timezone.utc)
                    ep.failure_count = 0
                else:
                    ep.failure_count = (ep.failure_count or 0) + 1
                db.commit()
        except Exception as e:
            logger.error(f"Failed to update webhook stats: {e}")
        finally:
            db.close()

        return success

    async def dispatch_alert_async(
        self,
        org_id: str,
        alert_data: Dict[str, Any],
        action_data: Optional[Dict[str, Any]] = None,
    ):
        """Asynchronously dispatches an alert to all active org webhook endpoints."""
        db = SessionLocal()
        endpoints: List[WebhookEndpoint] = []
        try:
            endpoints = (
                db.query(WebhookEndpoint)
                .filter(WebhookEndpoint.org_id == org_id, WebhookEndpoint.enabled == True)
                .all()
            )
            # Detach endpoint properties
            endpoint_configs = [
                (ep.endpoint_id, ep.url, ep.secret, ep.target_type, ep.min_severity, ep.enabled)
                for ep in endpoints
            ]
        finally:
            db.close()

        tasks = []
        for ep_id, url, secret, target_type, min_sev, enabled in endpoint_configs:
            # Check delivery condition
            alert_sev = str(alert_data.get("severity", "High")).lower()
            min_s = str(min_sev or "High").lower()
            if SEVERITY_ORDER.get(alert_sev, 2) < SEVERITY_ORDER.get(min_s, 3):
                continue

            # Format payload based on target type
            if target_type == "slack":
                payload = self.format_slack_payload(alert_data, action_data)
            elif target_type == "discord":
                payload = self.format_discord_payload(alert_data, action_data)
            else:
                payload = self.format_generic_payload(alert_data, action_data, org_id)

            tasks.append(self.deliver_to_endpoint(ep_id, url, secret, target_type, payload))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def test_endpoint(self, endpoint: WebhookEndpoint) -> Dict[str, Any]:
        """Sends an immediate test ping alert to verify connectivity."""
        test_alert = {
            "alert_id": "ALT-TEST-PING",
            "agent_id": "AGT-SEC-TEST",
            "severity": "Critical",
            "risk_score": 96.5,
            "trigger_type": "diagnostic_ping",
            "notes": "AgentShield security integration ping test. Webhook is functional.",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        test_action = {
            "action_id": "ACT-TEST-PING",
            "action_type": "guardrail_verification",
            "parameters": {"test": True, "ping": "pong"},
        }

        if endpoint.target_type == "slack":
            payload = self.format_slack_payload(test_alert, test_action)
        elif endpoint.target_type == "discord":
            payload = self.format_discord_payload(test_alert, test_action)
        else:
            payload = self.format_generic_payload(test_alert, test_action, endpoint.org_id)

        start_time = time.time()
        raw_body = json.dumps(payload).encode("utf-8")
        timestamp = int(start_time)
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AgentShield-Webhook-Test/1.0",
            "X-AgentShield-Timestamp": str(timestamp),
            "X-AgentShield-Event": "diagnostic.ping",
        }
        if endpoint.secret:
            headers["X-AgentShield-Signature"] = self.compute_hmac_signature(endpoint.secret, timestamp, raw_body)

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(endpoint.url, content=raw_body, headers=headers)
                latency = round((time.time() - start_time) * 1000, 2)
                return {
                    "success": res.status_code in (200, 201, 202, 204),
                    "status_code": res.status_code,
                    "latency_ms": latency,
                    "message": f"Webhook returned HTTP {res.status_code} ({latency}ms)",
                }
        except Exception as exc:
            latency = round((time.time() - start_time) * 1000, 2)
            return {
                "success": False,
                "status_code": 0,
                "latency_ms": latency,
                "message": f"Connection failed: {str(exc)}",
            }

webhook_dispatcher = WebhookDispatcher()
