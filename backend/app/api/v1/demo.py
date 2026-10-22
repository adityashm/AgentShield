"""
AgentShield AI — Demo Management API Router
Endpoints to seed demo environments and control autonomous agent simulation.
"""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...database import get_db
from ...services.simulator import simulator
from ...simulator.scenarios import SIMULATED_AGENTS, NORMAL_ACTIONS, THREAT_SCENARIOS
from ...core.deps import get_current_user, get_current_org_from_key
from ...db.models import User, Organization

router = APIRouter(prefix="/demo", tags=["Demo Management"])

class DemoStartRequest(BaseModel):
    interval_seconds: Optional[float] = Field(default=3.0, ge=0.5, le=60.0)
    threat_probability: Optional[float] = Field(default=0.20, ge=0.0, le=1.0)

class DemoStatusResponse(BaseModel):
    running: bool
    actions_sent: int
    threats_sent: int
    uptime_seconds: float
    simulated_agents_count: int

class DemoSeedResponse(BaseModel):
    status: str
    agents_seeded: int
    message: str

@router.post("/start", response_model=DemoStatusResponse)
async def start_demo(
    req: Optional[DemoStartRequest] = None,
    current_user: Optional[User] = Depends(get_current_user),
):
    """Start autonomous background agent simulation."""
    if not simulator.is_running:
        await simulator.start()
    
    import time
    uptime = time.time() - simulator.start_time if (simulator.is_running and simulator.start_time) else 0.0
    return DemoStatusResponse(
        running=simulator.is_running,
        actions_sent=simulator.actions_sent,
        threats_sent=simulator.threats_sent,
        uptime_seconds=round(uptime, 1),
        simulated_agents_count=len(SIMULATED_AGENTS),
    )

@router.post("/stop", response_model=DemoStatusResponse)
async def stop_demo(
    current_user: Optional[User] = Depends(get_current_user),
):
    """Stop autonomous background agent simulation."""
    if simulator.is_running:
        await simulator.stop()

    import time
    uptime = time.time() - simulator.start_time if (simulator.is_running and simulator.start_time) else 0.0
    return DemoStatusResponse(
        running=simulator.is_running,
        actions_sent=simulator.actions_sent,
        threats_sent=simulator.threats_sent,
        uptime_seconds=round(uptime, 1),
        simulated_agents_count=len(SIMULATED_AGENTS),
    )

@router.get("/status", response_model=DemoStatusResponse)
async def get_demo_status():
    """Retrieve current running status of the demo simulator."""
    import time
    uptime = time.time() - simulator.start_time if (simulator.is_running and simulator.start_time) else 0.0
    return DemoStatusResponse(
        running=simulator.is_running,
        actions_sent=simulator.actions_sent,
        threats_sent=simulator.threats_sent,
        uptime_seconds=round(uptime, 1),
        simulated_agents_count=len(SIMULATED_AGENTS),
    )

@router.post("/seed", response_model=DemoSeedResponse)
def seed_demo(db: Session = Depends(get_db)):
    """Seed demo organization with simulated agents and baseline operational state."""
    count = simulator.seed_agents(db=db)
    return DemoSeedResponse(
        status="seeded",
        agents_seeded=count,
        message=f"Successfully initialized demo environment with {len(SIMULATED_AGENTS)} simulated agents ({count} new).",
    )
