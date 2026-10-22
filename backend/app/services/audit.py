"""
backend/app/services/audit.py — Tamper-Evident Audit Logging Service with SHA-256 Hash Chaining.
Ensures every administrative or sensitive security operation (key rotation, quarantine,
policy modification, alerts triage) forms an immutable, verifiable cryptographic ledger.
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..db.models.audit import AuditLog

GENESIS_HASH = "0" * 64


def canonical_json(data: Any) -> str:
    """Produces deterministic canonical JSON string for hash stability."""
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def normalize_audit_timestamp(ts: datetime) -> str:
    """Standardizes datetime to UTC ISO string with microseconds for deterministic cryptographic hashing."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    else:
        ts = ts.astimezone(timezone.utc)
    return ts.isoformat()


def compute_audit_hash(
    prev_hash: str,
    ts: datetime,
    org_id: str,
    actor_type: str,
    actor_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Dict[str, Any],
) -> str:
    """
    Computes cryptographic SHA-256 digest over the audit entry fields.
    Format: SHA256(prev_hash:ts_norm:org_id:actor_type:actor_id:action:target_type:target_id:canonical_details)
    """
    ts_str = normalize_audit_timestamp(ts)
    det_str = canonical_json(details or {})
    raw = f"{prev_hash}:{ts_str}:{org_id}:{actor_type}:{actor_id}:{action}:{target_type}:{target_id}:{det_str}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class AuditService:
    @staticmethod
    def log_event(
        db: Session,
        org_id: str,
        action: str,
        target_type: str,
        target_id: str,
        actor_type: str = "user",
        actor_id: str = "system",
        ip: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        ts: Optional[datetime] = None,
    ) -> AuditLog:
        """
        Appends a new event to the organization's hash chain.
        Guarantees contiguous cryptographic link to the immediately prior record.
        """
        if ts is None:
            ts = datetime.now(timezone.utc)
        if details is None:
            details = {}

        # Look up latest record in the org's audit log
        last_entry = (
            db.query(AuditLog)
            .filter(AuditLog.org_id == org_id)
            .order_by(desc(AuditLog.ts), desc(AuditLog.id))
            .first()
        )
        prev_hash = last_entry.hash if (last_entry and last_entry.hash) else GENESIS_HASH

        entry_hash = compute_audit_hash(
            prev_hash=prev_hash,
            ts=ts,
            org_id=org_id,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )

        entry = AuditLog(
            id=str(uuid.uuid4()),
            org_id=org_id,
            ts=ts,
            actor_type=actor_type,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            ip=ip or "127.0.0.1",
            details=details,
            prev_hash=prev_hash,
            hash=entry_hash,
        )
        db.add(entry)
        db.flush()
        return entry

    @staticmethod
    def verify_chain(db: Session, org_id: str) -> Dict[str, Any]:
        """
        Iterates all audit records in chronological order and verifies the cryptographic chain.
        Returns:
            verified: bool
            total_records: int
            latest_hash: str
            tampered_at_id: Optional[str]
            reason: Optional[str]
        """
        entries = (
            db.query(AuditLog)
            .filter(AuditLog.org_id == org_id)
            .order_by(AuditLog.ts.asc(), AuditLog.id.asc())
            .all()
        )

        if not entries:
            return {
                "verified": True,
                "total_records": 0,
                "latest_hash": GENESIS_HASH,
                "message": "Audit chain empty",
            }

        expected_prev = GENESIS_HASH
        for idx, entry in enumerate(entries):
            # 1. Validate previous hash link
            if entry.prev_hash != expected_prev:
                return {
                    "verified": False,
                    "total_records": len(entries),
                    "tampered_at_index": idx,
                    "tampered_at_id": entry.id,
                    "reason": f"Broken chain link: entry prev_hash '{entry.prev_hash}' does not match expected '{expected_prev}'",
                }

            # 2. Recompute and validate stored SHA-256 hash
            recomputed = compute_audit_hash(
                prev_hash=entry.prev_hash,
                ts=entry.ts,
                org_id=entry.org_id,
                actor_type=entry.actor_type,
                actor_id=entry.actor_id,
                action=entry.action,
                target_type=entry.target_type,
                target_id=entry.target_id,
                details=entry.details,
            )

            if entry.hash != recomputed:
                return {
                    "verified": False,
                    "total_records": len(entries),
                    "tampered_at_index": idx,
                    "tampered_at_id": entry.id,
                    "reason": f"Payload modification detected: stored hash '{entry.hash}' != computed '{recomputed}'",
                }

            expected_prev = entry.hash

        return {
            "verified": True,
            "total_records": len(entries),
            "latest_hash": expected_prev,
            "message": "Cryptographic audit chain intact and verified",
        }

    @staticmethod
    def get_logs(
        db: Session,
        org_id: str,
        limit: int = 50,
        offset: int = 0,
        action: Optional[str] = None,
        actor_id: Optional[str] = None,
    ) -> Tuple[List[AuditLog], int]:
        """Queries audit log records with filtering and pagination."""
        q = db.query(AuditLog).filter(AuditLog.org_id == org_id)
        if action:
            q = q.filter(AuditLog.action == action)
        if actor_id:
            q = q.filter(AuditLog.actor_id == actor_id)

        total = q.count()
        entries = q.order_by(desc(AuditLog.ts)).offset(offset).limit(limit).all()
        return entries, total
