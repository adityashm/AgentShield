from typing import List, Dict, Any, Optional
from fastapi import WebSocket
import json
import logging

logger = logging.getLogger("agentshield.ws")

class WebSocketManager:
    """Manages active WebSocket connections and broadcasts telemetry streams."""

    def __init__(self):
        # Global client connections
        self.active_connections: List[WebSocket] = []
        # Specific agent stream connections: {agent_id: [WebSocket]}
        self.agent_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, agent_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if agent_id:
            if agent_id not in self.agent_connections:
                self.agent_connections[agent_id] = []
            self.agent_connections[agent_id].append(websocket)
        logger.info(f"WebSocket client connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, agent_id: Optional[str] = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if agent_id and agent_id in self.agent_connections:
            if websocket in self.agent_connections[agent_id]:
                self.agent_connections[agent_id].remove(websocket)
        logger.info(f"WebSocket client disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast telemetry event to all active WebSocket listeners."""
        from ..realtime.bus import telemetry_bus
        org_id = message.get("org_id", "org_default")
        await telemetry_bus.broadcast_org_event(org_id, message)

        json_str = json.dumps(message)
        dead_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json_str)
            except Exception:
                dead_connections.append(connection)

        for dead in dead_connections:
            if dead in self.active_connections:
                self.active_connections.remove(dead)

    async def broadcast_agent_event(self, agent_id: str, message: Dict[str, Any]):
        """Broadcast to specific agent subscribers and global feed."""
        from ..realtime.bus import telemetry_bus
        org_id = message.get("org_id", "org_default")
        await telemetry_bus.broadcast_agent_event(org_id, agent_id, message)
        await self.broadcast(message)

ws_manager = WebSocketManager()
