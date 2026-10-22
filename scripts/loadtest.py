#!/usr/bin/env python3
"""
scripts/loadtest.py — Benchmark AgentShield synchronous pre-flight evaluate endpoint latency.
Evaluates p50, p90, p95, and p99 latency against the target budget (p95 < 50ms).
"""

import sys
import time
import math
import argparse
import asyncio
from typing import List, Dict, Any
import httpx

def calculate_percentiles(latencies: List[float]) -> Dict[str, float]:
    if not latencies:
        return {"min": 0, "avg": 0, "p50": 0, "p90": 0, "p95": 0, "p99": 0, "max": 0}
    sorted_lats = sorted(latencies)
    n = len(sorted_lats)

    def get_p(p: float) -> float:
        k = (n - 1) * p
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_lats[int(k)]
        d0 = sorted_lats[int(f)] * (c - k)
        d1 = sorted_lats[int(c)] * (k - f)
        return d0 + d1

    return {
        "min": sorted_lats[0],
        "avg": sum(sorted_lats) / n,
        "p50": get_p(0.50),
        "p90": get_p(0.90),
        "p95": get_p(0.95),
        "p99": get_p(0.99),
        "max": sorted_lats[-1],
    }

async def provision_api_key(base_url: str, client: httpx.AsyncClient) -> str:
    """Attempts to provision a test key via admin auth, or returns fallback test key."""
    login_url = f"{base_url}/api/v1/auth/login"
    try:
        login_res = await client.post(
            login_url,
            json={"email": "admin@agentshield.local", "password": "AdminPassword2026!"},
            timeout=5.0,
        )
        if login_res.status_code == 200:
            token = login_res.json().get("access_token")
            # Create temporary key
            key_res = await client.post(
                f"{base_url}/api/v1/api-keys",
                json={"name": "Loadtest Evaluation Key", "is_test": True, "scopes": "ingest,evaluate"},
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0,
            )
            if key_res.status_code == 200:
                return key_res.json().get("api_key")
    except Exception as exc:
        print(f"[loadtest] Note: Could not auto-provision key ({exc}), falling back to direct key header.")
    return "ashield_test_dev_default_key"

async def run_worker(
    worker_id: int,
    url: str,
    headers: Dict[str, str],
    queue: asyncio.Queue,
    latencies: List[float],
    errors: List[str],
    client: httpx.AsyncClient,
):
    payload = {
        "agent_id": f"AGT-BENCH-{worker_id % 4:02d}",
        "action_type": "database_query",
        "tool_name": "postgres_query",
        "parameters": {"query": "SELECT 1 FROM health_check WHERE id = 1"},
        "persist": False,
    }
    while not queue.empty():
        try:
            _ = queue.get_nowait()
        except asyncio.QueueEmpty:
            break

        start = time.perf_counter()
        try:
            res = await client.post(url, json=payload, headers=headers, timeout=5.0)
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            if res.status_code in (200, 202):
                latencies.append(elapsed_ms)
            else:
                errors.append(f"HTTP {res.status_code}: {res.text[:100]}")
        except Exception as e:
            errors.append(str(e))
        finally:
            queue.task_done()

async def main_async(args):
    eval_url = f"{args.url.rstrip('/')}/api/v1/evaluate"
    print(f"================================================================")
    print(f" AgentShield AI — Pre-Flight Evaluation Benchmark (/evaluate)")
    print(f" Target URL     : {eval_url}")
    print(f" Requests       : {args.requests}")
    print(f" Concurrency    : {args.concurrency}")
    print(f" Target p95     : < {args.target_p95_ms:.1f}ms")
    print(f"================================================================")

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=args.concurrency * 2)) as client:
        # Check health
        try:
            health_res = await client.get(f"{args.url.rstrip('/')}/health", timeout=3.0)
            if health_res.status_code != 200:
                print(f"[!] Warning: Health check returned {health_res.status_code}")
        except Exception as e:
            print(f"[!] Failed to connect to {args.url}: {e}")
            print("Make sure the AgentShield backend server is running.")
            sys.exit(1)

        api_key = args.api_key
        if not api_key:
            api_key = await provision_api_key(args.url.rstrip("/"), client)
            print(f"[*] Authenticated with key: {api_key[:16]}...")

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        # Warmup (10 requests)
        print("[*] Warming up JIT and threadpools (10 requests)...")
        for _ in range(10):
            try:
                await client.post(
                    eval_url,
                    json={"agent_id": "AGT-WARMUP", "action_type": "ping", "parameters": {}, "persist": False},
                    headers=headers,
                    timeout=5.0,
                )
            except Exception:
                pass

        # Fill queue
        queue = asyncio.Queue()
        for i in range(args.requests):
            queue.put_nowait(i)

        latencies: List[float] = []
        errors: List[str] = []

        wall_start = time.perf_counter()
        tasks = [
            asyncio.create_task(run_worker(i, eval_url, headers, queue, latencies, errors, client))
            for i in range(args.concurrency)
        ]
        await asyncio.gather(*tasks)
        wall_time = time.perf_counter() - wall_start

    # Metrics
    success_count = len(latencies)
    error_count = len(errors)
    rps = success_count / wall_time if wall_time > 0 else 0
    stats = calculate_percentiles(latencies)

    print("\nBenchmark Results:")
    print("-" * 64)
    print(f" Total Requests : {args.requests}")
    print(f" Successful     : {success_count} ({success_count/args.requests*100:.1f}%)")
    print(f" Errors         : {error_count}")
    print(f" Wall Time      : {wall_time:.2f}s")
    print(f" Throughput     : {rps:.1f} req/sec")
    print("-" * 64)
    print(f" Latency Min    : {stats['min']:.2f} ms")
    print(f" Latency Avg    : {stats['avg']:.2f} ms")
    print(f" Latency p50    : {stats['p50']:.2f} ms")
    print(f" Latency p90    : {stats['p90']:.2f} ms")
    print(f" Latency p95    : {stats['p95']:.2f} ms (Budget: < {args.target_p95_ms:.1f} ms)")
    print(f" Latency p99    : {stats['p99']:.2f} ms")
    print(f" Latency Max    : {stats['max']:.2f} ms")
    print("-" * 64)

    if errors:
        print("\nFirst 3 Errors:")
        for err in errors[:3]:
            print(f" - {err}")

    if stats["p95"] <= args.target_p95_ms:
        print(f"\n[PASS] Pre-flight evaluation p95 latency is {stats['p95']:.2f}ms (< {args.target_p95_ms:.1f}ms).")
        sys.exit(0)
    else:
        print(f"\n[WARN] p95 latency ({stats['p95']:.2f}ms) exceeded target ({args.target_p95_ms:.1f}ms).")
        if args.strict:
            sys.exit(1)
        sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description="AgentShield Pre-flight /evaluate Latency Loadtester")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Base URL of AgentShield API")
    parser.add_argument("--api-key", default=None, help="Explicit API key to authenticate with")
    parser.add_argument("--requests", type=int, default=200, help="Total requests to execute")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent async workers")
    parser.add_argument("--target-p95-ms", type=float, default=50.0, help="p95 latency threshold in ms")
    parser.add_argument("--strict", action="store_true", help="Fail if p95 exceeds budget")
    args = parser.parse_args()

    asyncio.run(main_async(args))

if __name__ == "__main__":
    main()
