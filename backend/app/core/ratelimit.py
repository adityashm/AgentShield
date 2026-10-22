import time
import threading
from typing import Dict, List, Tuple
from collections import defaultdict

class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding-window rate limiter."""
    def __init__(self):
        self._lock = threading.Lock()
        # Key -> list of float timestamps
        self._windows: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        """
        Evaluates whether a request with identifier 'key' is permitted.
        Returns (allowed: bool, retry_after_seconds: int).
        """
        now = time.time()
        window_start = now - window_seconds

        with self._lock:
            timestamps = self._windows[key]
            # Prune timestamps older than window_start
            valid_timestamps = [ts for ts in timestamps if ts > window_start]
            self._windows[key] = valid_timestamps

            if len(valid_timestamps) >= max_requests:
                oldest = valid_timestamps[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                return False, retry_after

            valid_timestamps.append(now)
            return True, 0

    def record_failure(self, key: str, window_seconds: int):
        """Records a failed action (e.g. failed login attempt)."""
        now = time.time()
        with self._lock:
            self._windows[key].append(now)

    def get_failure_count(self, key: str, window_seconds: int) -> int:
        now = time.time()
        window_start = now - window_seconds
        with self._lock:
            valid = [ts for ts in self._windows[key] if ts > window_start]
            self._windows[key] = valid
            return len(valid)

    def clear(self, key: str):
        with self._lock:
            if key in self._windows:
                del self._windows[key]

# Global singletons
api_key_limiter = SlidingWindowRateLimiter()
login_limiter = SlidingWindowRateLimiter()
