"""
backend/app/realtime/bus.py — Async In-Memory Pub/Sub Telemetry Event Bus.
Enables decoupled fan-out to WebSocket clients segmented by tenant and agent.
"""

import asyncio
import logging
from typing import Dict, Set, Any, Optional

logger = logging.getLogger("agentshield.realtime.bus")

class EventBus:
    """Async event bus for realtime telemetry and alert distributions."""

    def __init__(self):
        # channel_name -> set of asyncio.Queue
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, channel: str) -> asyncio.Queue:
        """Subscribe to a specific telemetry channel and return an event queue."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            if channel not in self._subscribers:
                self._subscribers[channel] = set()
            self._subscribers[channel].add(queue)
        logger.debug(f"Subscribed to {channel}. Total subscribers: {len(self._subscribers[channel])}")
        return queue

    async def unsubscribe(self, channel: str, queue: asyncio.Queue):
        """Unsubscribe and cleanup an event queue."""
        async with self._lock:
            if channel in self._subscribers:
                self._subscribers[channel].discard(queue)
                if not self._subscribers[channel]:
                    del self._subscribers[channel]
        logger.debug(f"Unsubscribed from {channel}.")

    async def publish(self, channel: str, event: Dict[str, Any]):
        """Publish event to all subscribers on the channel."""
        async with self._lock:
            subs = list(self._subscribers.get(channel, []))

        for queue in subs:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Discard oldest event on backpressure to keep stream real-time
                try:
                    _ = queue.get_nowait()
                    queue.put_nowait(event)
                except Exception:
                    pass

    async def broadcast_org_event(self, org_id: str, event: Dict[str, Any]):
        """Publishes event to organization channel and global channel."""
        await self.publish(f"org:{org_id}", event)
        await self.publish("global:events", event)

    async def broadcast_agent_event(self, org_id: str, agent_id: str, event: Dict[str, Any]):
        """Publishes event to agent channel, organization channel, and global channel."""
        await self.publish(f"org:{org_id}:agent:{agent_id}", event)
        await self.broadcast_org_event(org_id, event)

# Global bus instance
telemetry_bus = EventBus()
bus = telemetry_bus
