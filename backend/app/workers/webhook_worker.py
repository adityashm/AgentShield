"""
backend/app/workers/webhook_worker.py — Asynchronous Webhook Outbox Delivery Worker.
Provides SSRF protection, multiple payload adapters (Slack Block Kit, Discord Embeds,
PagerDuty Events API v2, Generic HMAC), exponential backoff retries, and failure telemetry.
"""

import asyncio
import hashlib
import hmac
import ipaddress
import json
import logging
import socket
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from ..core.config import settings
from ..database import SessionLocal
from ..db.models.webhook import WebhookEndpoint, WebhookDelivery

logger = logging.getLogger("agentshield.webhook_worker")

# Retry backoff in seconds: 1st retry in 10s, 2nd in 60s, 3rd in 300s, 4th in 1800s
RETRY_BACKOFF_SECONDS = [10, 60, 300, 1800]
MAX_DELIVERY_ATTEMPTS = 5


def is_safe_webhook_url(url: str, allow_local: Optional[bool] = None) -> Tuple[bool, str]:
    """
    Validates webhook URL against Server-Side Request Forgery (SSRF) threats.
    Rejects private networks, loopbacks, link-local addresses, and AWS metadata endpoints.
    """
    if allow_local is None:
        allow_local = settings.ALLOW_LOCAL_WEBHOOKS

    if allow_local:
        return True, "Local testing allowed"

    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False, f"Invalid URL scheme '{parsed.scheme}'. Only http and https are allowed."

        hostname = parsed.hostname
        if not hostname:
            return False, "Missing hostname in target webhook URL."

        # Disallow localhost / 0.0.0.0 names directly
        lower_host = hostname.lower()
        if lower_host in ("localhost", "127.0.0.1", "::1", "0.0.0.0", "metadata.google.internal"):
            return False, f"Direct access to '{hostname}' is prohibited (SSRF prevention)."

        # Check if hostname itself is an IP address
        try:
            ip = ipaddress.ip_address(lower_host)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                return False, f"Target IP '{lower_host}' belongs to a private/reserved address space."
            # Check AWS metadata IP specifically
            if str(ip) == "169.254.169.254":
                return False, "Access to cloud instance metadata service is prohibited."
            return True, "IP is public and routable"
        except ValueError:
            pass

        # DNS resolution check for domain names
        try:
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                sockaddr = item[4]
                ip_str = sockaddr[0]
                resolved_ip = ipaddress.ip_address(ip_str)
                if (
                    resolved_ip.is_private
                    or resolved_ip.is_loopback
                    or resolved_ip.is_link_local
                    or resolved_ip.is_reserved
                    or resolved_ip.is_multicast
                ):
                    return False, f"Resolved IP '{ip_str}' for domain '{hostname}' is private/reserved."
                if str(resolved_ip) == "169.254.169.254":
                    return False, "Resolved IP matches cloud instance metadata service."
        except socket.gaierror:
            return False, f"Failed to resolve hostname '{hostname}' via DNS."

        return True, "URL is safe"
    except Exception as exc:
        return False, f"URL security check failed: {str(exc)}"


def compute_hmac_signature(secret: str, timestamp: int, payload_bytes: bytes) -> str:
    """Computes HMAC-SHA256 signature formatted as 't={timestamp},v1={hex_digest}'."""
    signed_content = f"{timestamp}.".encode("utf-8") + payload_bytes
    signature = hmac.new(
        secret.encode("utf-8"),
        signed_content,
        hashlib.sha256,
    ).hexdigest()
    return f"t={timestamp},v1={signature}"


def format_slack_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Formats payload as Slack Block Kit message."""
    title = payload.get("title", "Security Alert")
    severity = str(payload.get("severity", "HIGH")).upper()
    agent_id = payload.get("agent_id", "Unknown")
    risk_score = payload.get("risk_score", 0.0)
    rule_id = payload.get("rule_id", "ANOMALY")
    emoji = "🚨" if severity == "CRITICAL" else "⚠️" if severity == "HIGH" else "ℹ️"

    return {
        "text": f"{emoji} AgentShield Alert: [{severity}] on agent {agent_id} (Risk: {risk_score})",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} AgentShield Threat Alert — {severity}",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Agent:*\n`{agent_id}`"},
                    {"type": "mrkdwn", "text": f"*Risk Score:*\n`{risk_score:.1f}` / 100"},
                    {"type": "mrkdwn", "text": f"*Rule / Trigger:*\n`{rule_id}`"},
                    {"type": "mrkdwn", "text": f"*Severity:*\n*{severity}*"},
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Details:*\n{title}",
                },
            },
        ],
    }


def format_discord_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Formats payload as Discord rich embed."""
    severity = str(payload.get("severity", "HIGH")).upper()
    color = 0xEF4444 if severity == "CRITICAL" else 0xF97316 if severity == "HIGH" else 0xEAB308
    agent_id = payload.get("agent_id", "Unknown")
    risk_score = payload.get("risk_score", 0.0)
    rule_id = payload.get("rule_id", "ANOMALY")
    title = payload.get("title", "Security Alert")

    return {
        "username": "AgentShield Guardrail",
        "embeds": [
            {
                "title": f"🚨 AgentShield Alert: {severity}",
                "description": title,
                "color": color,
                "fields": [
                    {"name": "Agent ID", "value": f"`{agent_id}`", "inline": True},
                    {"name": "Risk Score", "value": f"`{risk_score:.1f}/100`", "inline": True},
                    {"name": "Trigger Rule", "value": f"`{rule_id}`", "inline": True},
                ],
                "timestamp": payload.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                "footer": {"text": "AgentShield Runtime Threat Monitor"},
            }
        ],
    }


def format_pagerduty_payload(payload: Dict[str, Any], routing_key: str) -> Dict[str, Any]:
    """Formats payload according to PagerDuty Events API v2 specification."""
    severity = str(payload.get("severity", "HIGH")).lower()
    pd_severity = "critical" if severity in ("critical", "high") else "warning" if severity == "medium" else "info"
    title = payload.get("title", "Security Alert")
    agent_id = payload.get("agent_id", "agent")
    alert_id = payload.get("alert_id", "ALT-UNKNOWN")

    return {
        "routing_key": routing_key,
        "event_action": "trigger",
        "dedup_key": f"agentshield:{alert_id}",
        "payload": {
            "summary": f"[{severity.upper()}] AgentShield: {title} (Agent: {agent_id})",
            "severity": pd_severity,
            "source": f"agentshield:{agent_id}",
            "custom_details": payload,
        },
    }


class WebhookWorker:
    """
    Background worker that continuously drains the transactional webhook outbox,
    validates SSRF boundaries, adapts payloads to target endpoints, and executes retries.
    """

    def __init__(self, poll_interval: float = 3.0):
        self.poll_interval = poll_interval
        self._is_running = False
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        """Starts the background worker task."""
        if not self._is_running:
            self._is_running = True
            self._task = asyncio.create_task(self._run_loop())
            logger.info("Webhook outbox background worker started.")

    async def stop(self):
        """Stops the background worker gracefully."""
        self._is_running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
            logger.info("Webhook outbox background worker stopped.")

    async def _run_loop(self):
        while self._is_running:
            try:
                processed = await self.process_deliveries_batch()
                if processed == 0:
                    await asyncio.sleep(self.poll_interval)
                else:
                    await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.error(f"Error in webhook worker loop: {exc}")
                await asyncio.sleep(self.poll_interval)

    async def process_deliveries_batch(self, batch_size: int = 20) -> int:
        """
        Polls and delivers a batch of pending webhook deliveries.
        Returns count of deliveries processed.
        """
        db = SessionLocal()
        deliveries_to_process = []
        try:
            now = datetime.now(timezone.utc)
            deliveries = (
                db.query(WebhookDelivery)
                .filter(
                    WebhookDelivery.status == "pending",
                    WebhookDelivery.next_attempt_at <= now,
                )
                .order_by(WebhookDelivery.created_at.asc())
                .limit(batch_size)
                .all()
            )

            for d in deliveries:
                endpoint = d.endpoint
                if not endpoint or not endpoint.enabled:
                    d.status = "failed"
                    d.last_error = "Endpoint disabled or missing"
                    continue

                deliveries_to_process.append({
                    "delivery_id": d.id,
                    "endpoint_id": endpoint.id,
                    "url": endpoint.url,
                    "secret": endpoint.secret,
                    "routing_key": endpoint.routing_key_enc or endpoint.secret,
                    "type": endpoint.type,
                    "payload": d.payload,
                    "attempts": d.attempts,
                })

            db.commit()
        except Exception as exc:
            logger.error(f"Failed to query pending webhook deliveries: {exc}")
            db.rollback()
            return 0
        finally:
            db.close()

        if not deliveries_to_process:
            return 0

        # Execute deliveries concurrently
        tasks = [self._deliver_single(item) for item in deliveries_to_process]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Update database with results
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            for item, res in zip(deliveries_to_process, results):
                delivery = db.query(WebhookDelivery).filter(WebhookDelivery.id == item["delivery_id"]).first()
                endpoint = db.query(WebhookEndpoint).filter(WebhookEndpoint.id == item["endpoint_id"]).first()
                if not delivery:
                    continue

                if isinstance(res, Exception):
                    success = False
                    status_code = None
                    error_msg = str(res)
                else:
                    success, status_code, error_msg = res

                delivery.attempts += 1
                delivery.response_code = status_code

                if success:
                    delivery.status = "sent"
                    delivery.sent_at = now
                    delivery.last_error = None
                    if endpoint:
                        endpoint.last_triggered_at = now
                        endpoint.failure_count = 0
                else:
                    delivery.last_error = error_msg[:1000] if error_msg else "Unknown delivery error"
                    if delivery.attempts >= MAX_DELIVERY_ATTEMPTS:
                        delivery.status = "dead"
                    else:
                        delivery.status = "pending"
                        delay_idx = min(delivery.attempts - 1, len(RETRY_BACKOFF_SECONDS) - 1)
                        delivery.next_attempt_at = now + timedelta(seconds=RETRY_BACKOFF_SECONDS[delay_idx])

                    if endpoint:
                        endpoint.failure_count = (endpoint.failure_count or 0) + 1

            db.commit()
        except Exception as exc:
            logger.error(f"Failed to update delivery results: {exc}")
            db.rollback()
        finally:
            db.close()

        return len(deliveries_to_process)

    async def _deliver_single(self, item: Dict[str, Any]) -> Tuple[bool, Optional[int], Optional[str]]:
        """Validates SSRF and dispatches HTTP POST request to endpoint."""
        url = item["url"]
        is_safe, reason = is_safe_webhook_url(url)
        if not is_safe:
            logger.warning(f"Webhook delivery rejected for {item['endpoint_id']}: {reason}")
            return False, 400, f"SSRF blocked: {reason}"

        ep_type = (item.get("type") or "generic").lower()
        payload = item["payload"]

        # Adapt payload to destination service
        if ep_type == "slack":
            formatted_data = format_slack_payload(payload)
        elif ep_type == "discord":
            formatted_data = format_discord_payload(payload)
        elif ep_type == "pagerduty":
            formatted_data = format_pagerduty_payload(payload, item.get("routing_key") or "")
        else:
            formatted_data = payload

        raw_body = json.dumps(formatted_data).encode("utf-8")
        timestamp = int(time.time())

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "AgentShield-Webhook/1.0",
            "X-AgentShield-Timestamp": str(timestamp),
            "X-AgentShield-Event": payload.get("event", "alert.created"),
            "X-AgentShield-Delivery": item["delivery_id"],
        }

        if item.get("secret"):
            headers["X-AgentShield-Signature"] = compute_hmac_signature(item["secret"], timestamp, raw_body)

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(url, content=raw_body, headers=headers)
                if resp.status_code in (200, 201, 202, 204):
                    return True, resp.status_code, None
                else:
                    return False, resp.status_code, f"Remote returned HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as exc:
            return False, None, f"HTTP dispatch error: {str(exc)}"


webhook_worker = WebhookWorker()
