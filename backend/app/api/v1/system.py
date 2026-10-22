from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import time
from typing import Dict, Any

from ...database import get_db
from ...models import Agent, Action, Alert
from ...services.simulator import simulator, THREAT_SCENARIOS
from ...services.ml_engine import ml_engine

router = APIRouter(prefix="/system", tags=["system"])

SERVER_START_TIME = time.time()

@router.get("/health")
def system_health(db: Session = Depends(get_db)):
    """System health check and live infrastructure telemetry (SRS NFR-09)."""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    active_agents = db.query(Agent).filter(Agent.status == "active").count()
    actions_today = db.query(Action).filter(Action.timestamp >= today_start).count()
    open_alerts = db.query(Alert).filter(Alert.status == "Open").count()

    nodes = [
        {"node": "US-East-1 (Primary Ingestion)", "status": "ONLINE", "latency_ms": 14, "tone": "success"},
        {"node": "EU-Central-1 (Anomaly Engine)", "status": "ONLINE", "latency_ms": 28, "tone": "success"},
        {"node": "AP-South-1 (Edge Telemetry)", "status": "ONLINE", "latency_ms": 8, "tone": "success"},
    ]

    return {
        "status": "operational",
        "uptime_seconds": round(time.time() - SERVER_START_TIME, 1),
        "active_agents_count": active_agents,
        "total_actions_today": actions_today,
        "open_alerts_count": open_alerts,
        "isolation_forest_ready": ml_engine.is_trained,
        "simulator_active": simulator.is_running,
        "database_connected": True,
        "nodes": nodes,
    }

@router.post("/simulator/toggle")
async def toggle_simulator():
    """Toggle continuous synthetic agent telemetry generator."""
    if simulator.is_running:
        await simulator.stop()
        return {"status": "stopped", "simulator_active": False}
    else:
        await simulator.start()
        return {"status": "started", "simulator_active": True}

@router.post("/simulator/inject")
async def inject_threat_scenario(scenario_index: int = 0):
    """Manually trigger a targeted MITRE ATLAS threat injection (0=DB, 1=Prompt Injection, 2=Sudo, 3=Rate Flood, 4=Exfil)."""
    idx = max(0, min(len(THREAT_SCENARIOS) - 1, scenario_index))
    scenario = THREAT_SCENARIOS[idx]
    result = await simulator.inject_event(
        agent_id=scenario["agent"],
        action_type=scenario["type"],
        parameters=scenario["params"],
    )
    return {"injected_scenario": scenario["description"], "event": result}
