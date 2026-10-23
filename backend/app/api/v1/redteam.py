"""
backend/app/api/v1/redteam.py — Automated Adversarial Red Teaming & Jailbreak Arena API.
Provides endpoints to list adversarial probes, launch automated red-team assessments,
and retrieve historical vulnerability reports.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...services.redteam import RedTeamService, PROBE_CATALOG
from ...db.models import Organization
from ...core.deps import get_current_org_from_key
from ...core.errors import NotFoundError

router = APIRouter(prefix="/redteam", tags=["Red Team Arena"])


class ProbeItem(BaseModel):
    id: str
    name: str
    category: str
    severity: str
    owasp_id: str
    mitre_atlas: str
    description: str
    payload: Any
    expected_mitigation: str


class RedTeamExecuteRequest(BaseModel):
    target_agent_id: str = Field(default="AGT-001", description="Identifier of the agent to test")
    categories: Optional[List[str]] = Field(default=None, description="Optional filter by probe categories")
    probe_ids: Optional[List[str]] = Field(default=None, description="Optional specific probe IDs to execute")
    broadcast_live: bool = Field(default=True, description="Whether to broadcast probe events over WebSocket")


class RedTeamSingleProbeRequest(BaseModel):
    probe_id: str
    agent_id: str = "AGT-001"


@router.get("/probes", response_model=List[ProbeItem])
def list_probes(
    category: Optional[str] = Query(None, description="Filter probes by category (direct_jailbreak, evasion_encoding, indirect_injection, privilege_probing, crescendo_velocity)"),
):
    """
    Returns the catalog of 30+ adversarial probe vectors mapped to OWASP ASI and MITRE ATLAS.
    """
    probes = RedTeamService.get_catalog(category=category)
    return probes


@router.post("/execute")
async def execute_redteam_assessment(
    payload: RedTeamExecuteRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Executes an automated red-team assessment against the specified agent,
    evaluating probes through deep normalization, AST guardrails, and crescendo detection.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    report = await RedTeamService.run_assessment(
        target_agent_id=payload.target_agent_id,
        db=db,
        categories=payload.categories,
        probe_ids=payload.probe_ids,
        broadcast_live=payload.broadcast_live,
        org_id=org_id,
    )
    return report


@router.post("/evaluate-single")
def evaluate_single_probe(
    payload: RedTeamSingleProbeRequest,
    db: Session = Depends(get_db),
):
    """
    Executes a single specific probe synchronously and returns immediate evaluation verdict.
    """
    probe = next((p for p in PROBE_CATALOG if p["id"] == payload.probe_id), None)
    if not probe:
        raise NotFoundError(f"Probe with ID '{payload.probe_id}' not found in catalog.")
    return RedTeamService.evaluate_probe(probe, db=db, agent_id=payload.agent_id)


@router.get("/reports")
def get_reports(request: Request):
    """
    Retrieves historical red-team assessment reports, defense rates, and vulnerability grades.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    return RedTeamService.get_reports(org_id=org_id)
