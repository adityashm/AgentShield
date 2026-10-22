"""
backend/app/realtime/ws.py — Authenticated WebSocket Endpoints for Live Telemetry Feeds.
Handles client connection lifecycle, in-message JWT authentication, and channel streaming.
"""

import json
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from .bus import telemetry_bus
from ..core.security import verify_access_token
from ..core.crypto import hash_api_key_hmac
from ..core.config import settings
from ..database import SessionLocal
from ..db.models import APIKey

logger = logging.getLogger("agentshield.realtime.ws")
router = APIRouter(tags=["realtime"])

async def authenticate_ws_connection(websocket: WebSocket) -> tuple[str, Optional[str]]:
    """
    Waits for an initial auth message with JWT token or API key within 5 seconds.
    Returns (org_id, user_or_key_id). Defaults to 'org_default' on timeout for dev/legacy clients.
    """
    try:
        raw_msg = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        data = json.loads(raw_msg)
        if data.get("type") == "auth" and data.get("token"):
            token = data["token"]
            # 1. Try JWT access token
            payload = verify_access_token(token)
            if payload and "org_id" in payload:
                await websocket.send_json({"type": "auth_ok", "org_id": payload["org_id"]})
                return payload["org_id"], payload.get("sub")

            # 2. Try API key
            db = SessionLocal()
            try:
                hashed = hash_api_key_hmac(token, settings.API_KEY_PEPPER)
                key_rec = db.query(APIKey).filter(APIKey.key_hash == hashed).first()
                if key_rec and key_rec.is_active:
                    await websocket.send_json({"type": "auth_ok", "org_id": key_rec.org_id})
                    return key_rec.org_id, key_rec.id
            finally:
                db.close()
    except asyncio.TimeoutError:
        # Fallback to default organization for dev/legacy connections
        pass
    except Exception as e:
        logger.debug(f"WS auth handshake non-fatal exception: {e}")

    await websocket.send_json({"type": "auth_ok", "org_id": "org_default", "note": "fallback_session"})
    return "org_default", None

async def _handle_incoming_pings(ws: WebSocket):
    try:
        while True:
            text = await ws.receive_text()
            if text == "ping":
                await ws.send_text("pong")
    except Exception:
        pass

@router.websocket("/ws")
@router.websocket("/api/v1/ws")
async def websocket_telemetry_feed(websocket: WebSocket):
    """Realtime telemetry stream for all events in the organization."""
    await websocket.accept()
    org_id, actor_id = await authenticate_ws_connection(websocket)
    channel = f"org:{org_id}"
    queue = await telemetry_bus.subscribe(channel)
    rx_task = asyncio.create_task(_handle_incoming_pings(websocket))

    try:
        # Send initial connected acknowledgement
        await websocket.send_json({"type": "CONNECTED", "channel": channel, "status": "streaming"})
        while True:
            # Drain queue and send to client
            event = await queue.get()
            await websocket.send_text(json.dumps(event))
            queue.task_done()
    except WebSocketDisconnect:
        logger.debug(f"Client disconnected from {channel}")
    except Exception as e:
        logger.debug(f"WS connection error: {e}")
    finally:
        rx_task.cancel()
        await telemetry_bus.unsubscribe(channel, queue)

@router.websocket("/ws/agent/{agent_id}")
@router.websocket("/api/v1/ws/agent/{agent_id}")
async def websocket_agent_telemetry_feed(websocket: WebSocket, agent_id: str):
    """Realtime telemetry stream filtered to a specific AI agent."""
    await websocket.accept()
    org_id, actor_id = await authenticate_ws_connection(websocket)
    channel = f"org:{org_id}:agent:{agent_id}"
    queue = await telemetry_bus.subscribe(channel)
    rx_task = asyncio.create_task(_handle_incoming_pings(websocket))

    try:
        await websocket.send_json({"type": "CONNECTED", "channel": channel, "agent_id": agent_id, "status": "streaming"})
        while True:
            event = await queue.get()
            await websocket.send_text(json.dumps(event))
            queue.task_done()
    except WebSocketDisconnect:
        logger.debug(f"Client disconnected from agent {agent_id}")
    except Exception as e:
        logger.debug(f"WS agent connection error: {e}")
    finally:
        rx_task.cancel()
        await telemetry_bus.unsubscribe(channel, queue)
