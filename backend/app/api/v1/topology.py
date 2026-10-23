"""
backend/app/api/v1/topology.py — Multi-Agent Communication Graph & Dynamic Containment API.
Enables real-time inspection of multi-agent communication topology, blast-radius calculation,
and instantaneous network isolation to arrest lateral adversarial movement.
"""

from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...services.topology import TopologyService
from ...core.deps import get_optional_user

router = APIRouter(prefix="/topology", tags=["Multi-Agent Topology"])


class ContainRequest(BaseModel):
    agent_id: str = Field(..., description="ID of the agent to isolate from the mesh")
    reason: Optional[str] = Field(default="Automated containment against lateral movement", description="Reason for containment")


class RestoreRequest(BaseModel):
    agent_id: str = Field(..., description="ID of the agent to restore to the mesh")


@router.get("/graph")
def get_topology_graph(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Retrieves the complete multi-agent communication graph including nodes,
    directed communication edges, risk ratings, and mesh resilience stats.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    return TopologyService.get_graph(db=db, org_id=org_id)


@router.post("/contain")
async def contain_agent(
    payload: ContainRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Quarantines an agent and severs all of its communication channels across the mesh.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    actor = getattr(request.state, "user_id", "system")
    result = await TopologyService.contain_agent(
        agent_id=payload.agent_id,
        reason=payload.reason or "Manual administrative containment",
        db=db,
        org_id=org_id,
        actor=actor,
    )
    return result


@router.post("/restore")
async def restore_agent(
    payload: RestoreRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Restores a quarantined agent and reconnects healthy communication channels.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    actor = getattr(request.state, "user_id", "system")
    result = await TopologyService.restore_agent(
        agent_id=payload.agent_id,
        db=db,
        org_id=org_id,
        actor=actor,
    )
    return result


@router.get("/blast-radius/{agent_id}")
def get_agent_blast_radius(
    agent_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Calculates downstream reachability and cascading risk blast radius if the agent is compromised.
    """
    org_id = getattr(request.state, "org_id", "org_default")
    return TopologyService.calculate_blast_radius(agent_id=agent_id, db=db, org_id=org_id)
