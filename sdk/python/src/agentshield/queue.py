"""
agentshield.queue — Asynchronous Non-Blocking Telemetry Batch Queue.
Batches events up to 50 items or 0.5s intervals, applies secret redaction,
and safely flushes to the AgentShield ingestion API without blocking the host application.
"""

import queue
import threading
import time
import logging
from typing import Dict, Any, List, Optional
import httpx

from .redaction import redact_secrets

logger = logging.getLogger("agentshield.queue")


class TelemetryQueue:
    def __init__(
        self,
        endpoint: str,
        headers: Dict[str, str],
        batch_size: int = 50,
        flush_interval: float = 0.5,
        maxsize: int = 10000,
    ):
        self.endpoint = endpoint.rstrip("/")
        self.headers = headers
        self.batch_size = batch_size
        self.flush_interval = flush_interval

        self._queue: queue.Queue = queue.Queue(maxsize=maxsize)
        self._stop_event = threading.Event()
        self._worker_thread = threading.Thread(target=self._worker_loop, daemon=True, name="agentshield-worker")
        self._circuit_open_until = 0.0
        self._consecutive_failures = 0
        self._worker_thread.start()

    def enqueue(self, event: Dict[str, Any]):
        """Non-blockingly enqueues an event for asynchronous batch dispatch."""
        try:
            # Redact secrets before enqueueing
            sanitized = redact_secrets(event)
            self._queue.put_nowait(sanitized)
        except queue.Full:
            logger.warning("AgentShield telemetry queue is full; dropping event to preserve host performance.")

    def _worker_loop(self):
        while not self._stop_event.is_set():
            batch = []
            start_time = time.time()

            while len(batch) < self.batch_size and (time.time() - start_time) < self.flush_interval:
                try:
                    item = self._queue.get(timeout=0.1)
                    batch.append(item)
                    self._queue.task_done()
                except queue.Empty:
                    break

            if batch:
                self._dispatch_batch(batch)

    def _dispatch_batch(self, batch: List[Dict[str, Any]]):
        now = time.time()
        if now < self._circuit_open_until:
            logger.debug("AgentShield circuit breaker open; discarding batch.")
            return

        url = f"{self.endpoint}/actions/batch"
        try:
            with httpx.Client(timeout=4.0) as client:
                res = client.post(url, json=batch, headers=self.headers)
                if res.status_code in (200, 201, 202):
                    self._consecutive_failures = 0
                else:
                    self._handle_failure(f"HTTP {res.status_code}: {res.text[:200]}")
        except Exception as exc:
            self._handle_failure(str(exc))

    def _handle_failure(self, reason: str):
        self._consecutive_failures += 1
        logger.warning(f"AgentShield telemetry batch failed ({self._consecutive_failures} consecutive): {reason}")
        if self._consecutive_failures >= 5:
            # Open circuit for 10 seconds
            self._circuit_open_until = time.time() + 10.0
            logger.warning("AgentShield circuit breaker opened for 10 seconds due to repeated ingestion failures.")

    def flush(self):
        """Drains the queue immediately and dispatches all accumulated events."""
        while not self._queue.empty():
            batch = []
            while len(batch) < self.batch_size and not self._queue.empty():
                try:
                    item = self._queue.get_nowait()
                    batch.append(item)
                    self._queue.task_done()
                except queue.Empty:
                    break
            if batch:
                self._dispatch_batch(batch)

    def close(self):
        """Flushes remaining events and shuts down background worker thread."""
        self.flush()
        self._stop_event.set()
        if self._worker_thread.is_alive():
            self._worker_thread.join(timeout=2.0)
